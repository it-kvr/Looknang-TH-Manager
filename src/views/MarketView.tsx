import React, { useEffect, useMemo, useState } from 'react';
import type { SubRole, MainTab, Player, Team, ScoutMission, GameState } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { TN, LINE, SPX, ALL_SUB_ROLES, SPN, ROLE_L } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { assignTeamShirtNumbers, vlu, wagOf, ensureCon, logFin, listCreatedPlayersForManager, deleteCustomPlayer, pushFeed, getPlayerBio, type CreatedPlayerCandidate } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import { appendPlayerCareerLog } from '../engine/history';
import {
  LEAGUE_TRANSFER_RULES,
  getLeagueTransferContext,
  mkMarket,
  createScoutMission,
  getIncomingOffers,
  removeIncomingOffer,
  canAcceptTransferOffer,
  acceptTransferOffer,
  resolveCounterOfferOutcome,
  applyCounterOfferOutcome,
  validateBatchSquadRemoval
} from '../engine/simulation';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { PlayerBioStrip } from '../components/PlayerBioStrip';
import { PotentialBadge } from '../components/PotentialBadge';
import { PositionBadge } from '../components/PositionBadge';
import { SquadSellModal } from '../modals/SquadActionModals';

export interface OfferDraft {
  source: 'mk' | 'scout' | 'club';
  idx: number;
  clubTeamId?: number;
  playerName?: string;
  type: 'free' | 'cash' | 'inst' | 'swap' | 'loan' | 'loanopt';
  pct: number;
  yr: number;
  role: 'key' | 'rot' | 'pro';
  wb: 0 | 1 | 2;
  swapIdx: number | null;
  msg: string;
  counter?: ReturnType<typeof evalOffer> | null;
}

export function evalOffer(q: Player, st: OfferDraft, me: Team) {
  const p0 = q.price || vlu(q);
  const wgAsk = q.askWg || wagOf(q);
  const type = q.free ? 'free' : st.type;
  const yr = type === 'loan' || type === 'loanopt' ? 1 : st.yr;
  const role = st.role;
  const wb = st.wb;
  const wf = [0.85, 1, 1.2][wb];
  const sgBonus = wb === 2 ? Math.max(4, Math.round(q.ov / 8)) : 0;
  const swapQ = type === 'swap' && st.swapIdx != null ? me.sq[st.swapIdx] : null;
  const swapVal = swapQ ? Math.round(vlu(swapQ) * 0.8) : 0;

  let cashNow = 0;
  let dueLater = 0;
  let loanOpt = 0;
  let clubScore = 0;

  if (type === 'free') {
    cashNow = sgBonus;
    clubScore = 100;
  } else if (type === 'cash') {
    cashNow = Math.round((p0 * st.pct) / 100) + sgBonus;
    clubScore = st.pct;
  } else if (type === 'inst') {
    cashNow = Math.round(((p0 * st.pct) / 100) * 0.55) + sgBonus;
    dueLater = Math.round(((p0 * st.pct) / 100) * 0.5);
    clubScore = st.pct - 6;
  } else if (type === 'swap') {
    cashNow = Math.max(0, Math.round((p0 * st.pct) / 100) - swapVal) + sgBonus;
    clubScore = (swapQ ? 100 : 0) + (st.pct - 100) + (swapVal >= p0 * 0.45 ? 6 : 0);
  } else if (type === 'loan') {
    cashNow = Math.max(3, Math.round(p0 * 0.28)) + sgBonus;
    clubScore = 96;
  } else if (type === 'loanopt') {
    cashNow = Math.max(4, Math.round(p0 * 0.32)) + sgBonus;
    loanOpt = Math.round(p0 * 0.78);
    clubScore = 98;
  }

  const roleBonus = role === 'key' ? 12 : role === 'rot' ? 2 : q.ov >= 68 ? -14 : 6;
  const yrBonus = q.age >= 30 ? (yr >= 3 ? 8 : -4) : yr >= 3 ? 6 : 0;
  const plScore = 74 + (wf - 1) * 65 + roleBonus + yrBonus + me.tier * 4;
  const chance = clamp(Math.round(q.free ? plScore : clubScore * 0.55 + plScore * 0.45 - 18), 8, 98);
  const wg = +(wgAsk * wf).toFixed(1);

  return { type, yr, role, wb, wg, sgBonus, swapQ, swapVal, cashNow, dueLater, loanOpt, chance, p0 };
}

type MarketTab = 'buy' | 'sell' | 'scout' | 'con';

export const MarketView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team | null) => void;
  onToast: (msg: string) => void;
  navIntent?: { tab: MainTab; sub?: string; ts: number } | null;
}> = ({ state, onUpdateState, onInspectPlayer, onToast, navIntent }) => {
  const me = state.teams[state.me];
  const tx = getLeagueTransferContext(state, me);

  const [activeTab, setActiveTab] = useState<MarketTab>('buy');
  const [marketSource, setMarketSource] = useState<'mk' | 'club' | 'created'>('mk');
  const [createdRefresh, setCreatedRefresh] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'GK' | 'DF' | 'MF' | 'FW' | 'FREE'>('ALL');
  const [subFilter, setSubFilter] = useState<'ALL' | SubRole>('ALL');
  const [sortBy, setSortBy] = useState<'default' | 'ov_desc' | 'price_asc' | 'age_asc'>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [clubTierFilter, setClubTierFilter] = useState<'ALL' | 'MY_TIER'>('MY_TIER');

  const [scoutRole, setScoutRole] = useState<SubRole | ''>('');
  const [offerDraft, setOfferDraft] = useState<OfferDraft | null>(null);
  const [sellModalNames, setSellModalNames] = useState<string[] | null>(null);
  const [sellSubView, setSellSubView] = useState<'all' | 'listed'>('all');
  const [sellPosFilter, setSellPosFilter] = useState<'ALL' | 'GK' | 'DF' | 'MF' | 'FW'>('ALL');
  const [sellSearch, setSellSearch] = useState('');
  const [selectedSellNames, setSelectedSellNames] = useState<string[]>([]);
  const [contractFilter, setContractFilter] = useState<'all' | 'expiring'>('all');

  const [renewIdx, setRenewIdx] = useState<number | null>(null);
  const [renewYr, setRenewYr] = useState(3);
  const [renewRole, setRenewRole] = useState<'key' | 'rot' | 'pro'>('rot');
  const [renewWb, setRenewWb] = useState<0 | 1 | 2>(1);
  const [renewMsg, setRenewMsg] = useState('');

  useEffect(() => {
    if (navIntent?.tab !== 'k') return;
    if (navIntent.sub === 'sell' || navIntent.sub === 'scout' || navIntent.sub === 'con' || navIntent.sub === 'buy') {
      setActiveTab(navIntent.sub);
    } else if (navIntent.sub === 'club') {
      setActiveTab('buy');
      setMarketSource('club');
    }
  }, [navIntent]);

  const availableSubRoles: SubRole[] = useMemo(() => {
    if (filter === 'GK' || filter === 'DF' || filter === 'MF' || filter === 'FW') return SPX[filter];
    return ALL_SUB_ROLES;
  }, [filter]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const marketList = useMemo(() => {
    const base = (state.mk || [])
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => {
        const lineOk = filter === 'ALL' || (filter === 'FREE' ? !!q.free : q.pos === filter);
        const subOk = subFilter === 'ALL' || q.ro === subFilter;
        const searchOk =
          !normalizedQuery ||
          q.n.toLowerCase().includes(normalizedQuery) ||
          q.ro.toLowerCase().includes(normalizedQuery) ||
          (SPN[q.ro] || '').toLowerCase().includes(normalizedQuery);
        return lineOk && subOk && searchOk;
      });
    if (sortBy === 'ov_desc') return [...base].sort((a, b) => b.q.ov - a.q.ov);
    if (sortBy === 'price_asc') return [...base].sort((a, b) => (a.q.free ? 0 : a.q.price || vlu(a.q)) - (b.q.free ? 0 : b.q.price || vlu(b.q)));
    if (sortBy === 'age_asc') return [...base].sort((a, b) => a.q.age - b.q.age || b.q.ov - a.q.ov);
    return base;
  }, [state.mk, filter, subFilter, sortBy, normalizedQuery]);

  const clubBasePool = useMemo(() => {
    if (activeTab !== 'buy' || marketSource !== 'club') return [];
    const items: { q: Player; team: Team; idx: number; price: number }[] = [];
    state.teams.forEach((t) => {
      if (t.id === state.me) return;
      if (clubTierFilter === 'MY_TIER' && Math.abs(t.tier - me.tier) > 1) return;
      t.sq.forEach((q, idx) => {
        if (q.me || q.loan) return;
        items.push({ q, team: t, idx, price: Math.max(8, vlu(q)) });
      });
    });
    return items;
  }, [activeTab, marketSource, state.teams, state.me, me.tier, clubTierFilter]);

  const clubMarketList = useMemo(() => {
    const items = clubBasePool.filter(({ q, team: t }) => {
      const lineOk = filter === 'ALL' || filter === 'FREE' || q.pos === filter;
      const subOk = subFilter === 'ALL' || q.ro === subFilter;
      const searchOk =
        !normalizedQuery ||
        q.n.toLowerCase().includes(normalizedQuery) ||
        t.name.toLowerCase().includes(normalizedQuery) ||
        q.ro.toLowerCase().includes(normalizedQuery);
      return lineOk && subOk && searchOk;
    });
    const sorted = items.slice().sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price || b.q.ov - a.q.ov;
      if (sortBy === 'age_asc') return a.q.age - b.q.age || b.q.ov - a.q.ov;
      return b.q.ov - a.q.ov;
    });
    return sorted.slice(0, 60);
  }, [clubBasePool, filter, subFilter, sortBy, normalizedQuery]);

  const loanPlayers = useMemo(
    () => me.sq.map((q, i) => ({ q, i })).filter(({ q }) => q.loan && q.loanOpt),
    [me.sq]
  );
  const contractList = useMemo(
    () =>
      me.sq
        .map((q, i) => ({ q, i, c: ensureCon(q) }))
        .filter(({ q }) => !q.loan)
        .sort((a, b) => a.c.yr - b.c.yr || b.q.ov - a.q.ov),
    [me.sq]
  );
  const displayedContracts = useMemo(
    () => (contractFilter === 'expiring' ? contractList.filter(({ c }) => c.yr <= 1) : contractList),
    [contractFilter, contractList]
  );

  const incomingOffers = useMemo(() => getIncomingOffers(state), [state]);
  const listedPlayers = useMemo(() => me.sq.filter((q) => q.listed && !q.loan), [me.sq]);
  const sellSearchNorm = sellSearch.trim().toLowerCase();
  const sellSquadList = useMemo(() => {
    const base = me.sq.filter((q) => {
      if (sellSubView === 'listed' && (!q.listed || q.loan)) return false;
      if (sellPosFilter !== 'ALL' && q.pos !== sellPosFilter) return false;
      if (
        sellSearchNorm &&
        !q.n.toLowerCase().includes(sellSearchNorm) &&
        !q.ro.toLowerCase().includes(sellSearchNorm) &&
        !(SPN[q.ro] || '').toLowerCase().includes(sellSearchNorm)
      ) {
        return false;
      }
      return true;
    });
    return [...base].sort((a, b) => {
      if (!!b.listed !== !!a.listed) return b.listed ? 1 : -1;
      return b.ov - a.ov;
    });
  }, [me.sq, sellSubView, sellPosFilter, sellSearchNorm]);
  const activeSelectedSell = useMemo(
    () =>
      selectedSellNames.filter((name) => {
        const found = me.sq.find((q) => q.n === name);
        return !!found && !found.me && !found.loan;
      }),
    [selectedSellNames, me.sq]
  );
  const sellBatchPreview = useMemo(
    () => (activeSelectedSell.length > 0 ? validateBatchSquadRemoval(state, me, activeSelectedSell, 'sell', 85) : null),
    [state, me, activeSelectedSell]
  );
  const createdPool = useMemo(() => listCreatedPlayersForManager(), [createdRefresh, state.md, state.season, me.sq.length]);
  const createdMarketList = useMemo(() => {
    const items = createdPool.filter((c) => {
      const q = c.player;
      const lineOk = filter === 'ALL' || filter === 'FREE' || q.pos === filter;
      const subOk = subFilter === 'ALL' || q.ro === subFilter;
      const searchOk =
        !normalizedQuery ||
        q.n.toLowerCase().includes(normalizedQuery) ||
        c.sourceLabel.toLowerCase().includes(normalizedQuery) ||
        (c.archName || '').toLowerCase().includes(normalizedQuery);
      return lineOk && subOk && searchOk;
    });
    if (sortBy === 'ov_desc') return [...items].sort((a, b) => b.ov - a.ov);
    if (sortBy === 'price_asc') return [...items].sort((a, b) => a.price - b.price);
    if (sortBy === 'age_asc') return [...items].sort((a, b) => a.player.age - b.player.age || b.ov - a.ov);
    return items;
  }, [createdPool, filter, subFilter, sortBy, normalizedQuery]);

  const expiringCount = contractList.filter(({ c }) => c.yr <= 1).length;
  const activeCount = marketSource === 'mk' ? marketList.length : marketSource === 'club' ? clubMarketList.length : createdMarketList.length;
  const hasBuyFilters = filter !== 'ALL' || subFilter !== 'ALL' || sortBy !== 'default' || searchQuery.trim() !== '';

  const resetBuyFilters = () => {
    setFilter('ALL');
    setSubFilter('ALL');
    setSortBy('default');
    setSearchQuery('');
  };

  const getDraftTarget = (draft: OfferDraft, s: GameState): { q: Player | undefined; sellerTeam?: Team } => {
    if (draft.source === 'club' && draft.clubTeamId != null) {
      const seller = s.teams.find((t) => t.id === draft.clubTeamId);
      if (!seller) return { q: undefined };
      const q = seller.sq[draft.idx] || seller.sq.find((p) => p.n === draft.playerName);
      return { q, sellerTeam: seller };
    }
    const list = draft.source === 'mk' ? s.mk : s.scout?.results || [];
    const q = list[draft.idx] || list.find((p) => p.n === draft.playerName);
    return { q };
  };

  const openNegotiation = (source: 'mk' | 'scout' | 'club', idx: number, q: Player, sellerTeam?: Team) => {
    if (!tx.tw.open && !q.free) {
      onToast(`ตลาดซื้อขายปิดอยู่! ช่วงนี้เซ็นได้เฉพาะฟรีเอเยนต์ (เปิดรอบหน้า: ${tx.tw.rangeText})`);
      return;
    }
    if (source === 'club' && sellerTeam) {
      if (sellerTeam.sq.length <= 16) {
        onToast(`${sellerTeam.name} มีนักเตะเหลือขั้นต่ำ (${sellerTeam.sq.length} คน) ไม่ปล่อยขาย`);
        return;
      }
      if (q.pos === 'GK' && sellerTeam.sq.filter((z) => z.pos === 'GK').length <= 2) {
        onToast(`${sellerTeam.name} เหลือผู้รักษาประตูเพียง 2 คน ไม่ปล่อยขาย`);
        return;
      }
    }
    SFX.tap();
    const swCands = me.sq
      .map((z, i) => ({ z, i }))
      .filter(({ z }) => !z.loan && !z.me && z.inj === 0 && tx.posCounts[z.pos] > tx.minPos[z.pos])
      .sort((a, b) => vlu(b.z) - vlu(a.z));

    const targetWithPrice: Player = source === 'club' && !q.price ? { ...q, price: Math.max(8, vlu(q)) } : q;
    setOfferDraft({
      source,
      idx,
      clubTeamId: sellerTeam?.id,
      playerName: q.n,
      type: targetWithPrice.free ? 'free' : 'cash',
      pct: 100,
      yr: 3,
      role: targetWithPrice.ov >= 70 ? 'key' : targetWithPrice.age <= 20 ? 'pro' : 'rot',
      wb: 1,
      swapIdx: swCands[0] ? swCands[0].i : null,
      msg: '',
      counter: null
    });
  };

  const submitOffer = (useCounter = false) => {
    if (!offerDraft) return;
    const { q: rawQ, sellerTeam } = getDraftTarget(offerDraft, state);
    if (!rawQ) return;
    const q: Player = offerDraft.source === 'club' && !rawQ.price ? { ...rawQ, price: Math.max(8, vlu(rawQ)) } : rawQ;
    const deal = useCounter && offerDraft.counter ? offerDraft.counter : evalOffer(q, offerDraft, me);
    if (!tx.tw.open && !q.free) { onToast('ตลาดซื้อขายปิดอยู่ ไม่สามารถย้ายสังกัดสโมสรอื่นได้'); return; }
    if (offerDraft.source === 'club' && sellerTeam && deal.type !== 'swap' && sellerTeam.sq.length <= 16) {
      onToast(`${sellerTeam.name} มีขนาดทีมถึงขั้นต่ำแล้ว (ใช้การแลกตัวแทนได้)`);
      return;
    }
    if ((deal.type === 'loan' || deal.type === 'loanopt') && tx.loansCount >= tx.maxLoans) {
      onToast(`ครบโควตายืมตัวสูงสุด ${tx.maxLoans} คนแล้ว`);
      return;
    }
    if (tx.ffpLocked && deal.cashNow > 0) { onToast('งบติดลบตามกฎ FFP ห้ามจ่ายค่าตัวจนกว่างบจะกลับมาเป็นบวก'); return; }
    if (state.money < deal.cashNow) { onToast('งบสโมสรไม่พอจ่ายทันที'); return; }
    if (me.sq.length >= tx.maxSquad && deal.type !== 'swap') { onToast(`ทีมเต็ม ${tx.maxSquad} คนแล้ว`); return; }
    const freedWage = deal.type === 'swap' && deal.swapQ ? ensureCon(deal.swapQ).wg : 0;
    if (tx.curWage - freedWage + deal.wg > tx.wageCap) {
      onToast(`เกินเพดานค่าเหนื่อยลีก (${fmtMoneyNum(tx.wageCap)}/นัด) กรุณาขายหรือลดค่าเหนื่อยก่อน`);
      return;
    }
    const accepted = useCounter || Math.random() * 100 < deal.chance;
    if (accepted) {
      onUpdateState((d) => {
        const t = d.teams[d.me];
        let target: Player | undefined;
        let removeFromSrc: (() => void) | null = null;
        let sellerRef: Team | undefined;

        if (offerDraft.source === 'club' && offerDraft.clubTeamId != null) {
          sellerRef = d.teams.find((tm) => tm.id === offerDraft.clubTeamId);
          if (sellerRef) {
            const sIdx = sellerRef.sq.findIndex((p) => p.n === (offerDraft.playerName || q.n));
            if (sIdx >= 0) {
              target = sellerRef.sq[sIdx];
              removeFromSrc = () => {
                sellerRef!.sq.splice(sIdx, 1);
                sellerRef!.lu = null;
              };
            }
          }
        } else {
          const srcList = offerDraft.source === 'mk' ? d.mk : d.scout?.results || [];
          const byName = srcList.findIndex((p) => p.n === (offerDraft.playerName || q.n));
          const mIdx = byName >= 0 ? byName : offerDraft.idx;
          if (mIdx >= 0 && srcList[mIdx]) {
            target = srcList[mIdx];
            removeFromSrc = () => srcList.splice(mIdx, 1);
          }
        }
        if (!target || !removeFromSrc) return;

        d.money -= deal.cashNow;
        logFin(d, `${deal.type === 'loan' || deal.type === 'loanopt' ? 'ค่ายืมตัว ' : 'ซื้อตัว '}${target.n}${sellerRef ? ` (${sellerRef.name})` : ''}`, -deal.cashNow);
        if (deal.dueLater) d.payDue = (d.payDue || 0) + deal.dueLater;

        let swappedOutPlayer: Player | null = null;
        if (deal.type === 'swap' && deal.swapQ) {
          const si = t.sq.findIndex((z) => z.n === deal.swapQ!.n);
          if (si >= 0) {
            swappedOutPlayer = t.sq.splice(si, 1)[0];
            t.lu = null;
          }
        }

        removeFromSrc();
        const incoming: Player = { ...target };
        if (deal.type === 'loan' || deal.type === 'loanopt') {
          incoming.loan = 1;
          if (deal.loanOpt) incoming.loanOpt = deal.loanOpt;
        }
        incoming.con = { yr: deal.yr, wg: deal.wg, role: deal.role };
        incoming.no = undefined;
        incoming.signedSeason = d.season;
        incoming.signedMd = d.md;
        delete incoming.listed;
        appendPlayerCareerLog(incoming, `✍️ ย้ายซบ ${t.name} (${TN[t.tier]}) ซีซั่น ${d.season}${incoming.loan ? ' (ยืมตัว)' : ''}`);
        t.sq.push(incoming);
        assignTeamShirtNumbers(t);

        if (sellerRef && swappedOutPlayer) {
          swappedOutPlayer.no = undefined;
          sellerRef.sq.push(swappedOutPlayer);
          assignTeamShirtNumbers(sellerRef);
        }
      });
      setOfferDraft(null);
      SFX.win();
      onToast(`เซ็นสัญญา ${q.n} (${q.ro} · ${deal.yr} ปี · ${fmtMoneyNum(deal.wg)}/นัด) สำเร็จ!`);
    } else {
      onUpdateState((d) => {
        if (offerDraft.source === 'club' && offerDraft.clubTeamId != null) {
          const sellerRef = d.teams.find((tm) => tm.id === offerDraft.clubTeamId);
          const target = sellerRef?.sq.find((p) => p.n === (offerDraft.playerName || q.n));
          if (!target) return;
          target.tries = (target.tries || 0) + 1;
          if (target.tries >= 3 || deal.chance < 20) target.locked = 1;
        } else {
          const srcList = offerDraft.source === 'mk' ? d.mk : d.scout?.results || [];
          const target = srcList[offerDraft.idx];
          if (!target) return;
          target.tries = (target.tries || 0) + 1;
          if (target.tries >= 3 || (deal.chance < 20 && !target.free)) target.locked = 1;
        }
      });
      const nextTries = (q.tries || 0) + 1;
      if (nextTries >= 3 || (deal.chance < 20 && !q.free)) {
        setOfferDraft({ ...offerDraft, counter: null, msg: 'อีกฝ่ายปฏิเสธและยุติการเจรจาในรอบนี้แล้ว' });
      } else {
        const cPct = deal.type === 'free' ? 100 : Math.min(125, offerDraft.pct + 10);
        const cWb = Math.min(2, offerDraft.wb + 1) as 0 | 1 | 2;
        const cDraft: OfferDraft = { ...offerDraft, pct: cPct, wb: cWb, role: q.ov >= 70 ? 'key' : offerDraft.role };
        const counter = evalOffer(q, cDraft, me);
        setOfferDraft({
          ...offerDraft,
          counter,
          msg: `ขอปรับเงื่อนไขเป็น${deal.type === 'free' ? '' : ` ${cPct}% · `}จ่ายทันที ${fmtMoneyNum(counter.cashNow)} · ค่าเหนื่อย ${fmtMoneyNum(counter.wg)}/นัด · ${ROLE_L[counter.role]}`
        });
      }
    }
  };

  const renderNegotiationModal = () => {
    if (!offerDraft) return null;
    const { q: rawQ, sellerTeam } = getDraftTarget(offerDraft, state);
    if (!rawQ) return null;
    const q: Player = offerDraft.source === 'club' && !rawQ.price ? { ...rawQ, price: Math.max(8, vlu(rawQ)) } : rawQ;
    const swCands = me.sq
      .map((z, i) => ({ z, i }))
      .filter(({ z }) => !z.loan && !z.me && z.inj === 0 && tx.posCounts[z.pos] > tx.minPos[z.pos])
      .sort((a, b) => vlu(b.z) - vlu(a.z));
    const E = evalOffer(q, offerDraft, me);
    const canAfford = state.money >= E.cashNow && !(tx.ffpLocked && E.cashNow > 0);
    const needSwapOk = offerDraft.type !== 'swap' || !!E.swapQ;
    const fullSq = me.sq.length >= tx.maxSquad && offerDraft.type !== 'swap';
    const loanCapHit = (offerDraft.type === 'loan' || offerDraft.type === 'loanopt') && tx.loansCount >= tx.maxLoans;
    const freedWage = offerDraft.type === 'swap' && E.swapQ ? ensureCon(E.swapQ).wg : 0;
    const wageOverCap = tx.curWage - freedWage + E.wg > tx.wageCap;
    const types: [OfferDraft['type'], string][] = q.free
      ? [['free', '🆓 เซ็นฟรีเอเยนต์']]
      : [['cash', '💰 จ่ายสด'], ['inst', '📅 ผ่อน 2 งวด'], ['swap', '🔄 แลกตัว+เงิน'], ['loan', '🤝 ยืม 1 ซีซั่น'], ['loanopt', '🤝 ยืม+ซื้อขาด']];
    const chCol = E.chance >= 75 ? 'var(--g)' : E.chance >= 45 ? '#b45309' : 'var(--red)';

    return (
      <div className="fixed inset-0 z-50 bg-black/72 flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden" onClick={() => setOfferDraft(null)}>
        <div className="w-full max-w-3xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="shrink-0 flex items-center gap-3 mland:gap-2 px-3.5 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
            <PlayerFace player={q} team={sellerTeam} state={state} size={44} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm sm:text-base mland:text-xs truncate">
                {q.n} <span className="text-xs mland:text-[10px] text-[var(--g)]">({q.ro} · {SPN[q.ro] || q.pos})</span>
              </div>
              <div className="text-[11px] sm:text-xs mland:text-[10px] text-[var(--mut)] truncate tabular">
                {sellerTeam ? `${sellerTeam.name} · ` : ''}อายุ {q.age} ปี · {q.free ? <b className="text-[var(--g)]">ฟรีเอเยนต์</b> : `ค่าตัว ${fmtMoney(q.price || 0)}`} · ค่าเหนื่อย ~{fmtMoneyNum(q.askWg || wagOf(q))}
              </div>
              <PlayerBioStrip bio={getPlayerBio(q)} variant="inline" className="mt-1" />
            </div>
            <span className="px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-xl text-white font-bold text-sm mland:text-xs tabular shrink-0" style={{ background: ovColor(q.ov) }}>
              {q.ov}
            </span>
            <button
              type="button"
              onClick={() => setOfferDraft(null)}
              aria-label="ปิดหน้าต่างเจรจา"
              className="btn-icon"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 grid grid-cols-1 sm:grid-cols-[1.15fr_0.85fr] mland:grid-cols-[1.15fr_0.85fr] gap-3.5 mland:gap-2.5 items-start">
            <div className="space-y-3 mland:space-y-2">
              <div>
                <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1.5 mland:mb-1">1) รูปแบบข้อเสนอ</div>
                <div className="flex flex-wrap gap-1.5 mland:gap-1">
                  {types.map(([k, l]) => {
                    const isLoanType = k === 'loan' || k === 'loanopt';
                    const disabledLoan = isLoanType && tx.loansCount >= tx.maxLoans;
                    return (
                      <button
                        key={k}
                        type="button"
                        disabled={disabledLoan}
                        onClick={() => setOfferDraft({ ...offerDraft, type: k, counter: null, msg: '' })}
                        className={`btn btn-sm ${
                          offerDraft.type === k ? 'btn-primary' : 'btn-secondary'
                        }`}
                      >
                        {l}{disabledLoan ? ` (เต็ม ${tx.maxLoans})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {['cash', 'inst', 'swap'].includes(offerDraft.type) && (
                <div>
                  <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1.5 mland:mb-1 tabular">ระดับค่าตัวเทียบตลาด ({offerDraft.pct}%)</div>
                  <div className="grid grid-cols-4 gap-1.5 mland:gap-1">
                    {[85, 95, 100, 115].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setOfferDraft({ ...offerDraft, pct: p, counter: null, msg: '' })}
                        className={`btn btn-sm tabular ${
                          offerDraft.pct === p ? 'btn-primary' : 'btn-secondary'
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {offerDraft.type === 'swap' && (
                <div>
                  <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1.5 mland:mb-1">เลือกนักเตะที่ใช้แลก (หัก 80% ของค่าตัว)</div>
                  {swCands.length > 0 ? (
                    <select
                      aria-label="เลือกนักเตะที่ใช้แลก"
                      value={offerDraft.swapIdx ?? ''}
                      onChange={(e) => setOfferDraft({ ...offerDraft, swapIdx: e.target.value ? Number(e.target.value) : null, counter: null, msg: '' })}
                      className="w-full px-2.5 py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10.5px] font-semibold"
                    >
                      {swCands.map(({ z, i }) => (
                        <option key={z.n} value={i}>
                          {z.ro} · {z.n} (OVR {z.ov} · ลดค่าตัว {fmtMoneyNum(Math.round(vlu(z) * 0.8))})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-[var(--red)]">ไม่มีนักเตะเกินโควตาตำแหน่งให้แลก</p>
                  )}
                </div>
              )}

              <div>
                <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1.5 mland:mb-1">2) เงื่อนไขสัญญา</div>
                {!['loan', 'loanopt'].includes(offerDraft.type) && (
                  <div className="grid grid-cols-4 gap-1.5 mland:gap-1 mb-1.5 mland:mb-1">
                    {[1, 2, 3, 5].map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setOfferDraft({ ...offerDraft, yr: y, counter: null, msg: '' })}
                        className={`btn btn-sm ${
                          offerDraft.yr === y ? 'btn-primary' : 'btn-secondary'
                        }`}
                      >
                        {y} ปี
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-1.5 mland:gap-1 mb-1.5 mland:mb-1">
                  {([['key', '⭐ ตัวหลัก'], ['rot', '🔄 หมุนเวียน'], ['pro', '🌱 ดาวรุ่ง']] as const).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setOfferDraft({ ...offerDraft, role: k, counter: null, msg: '' })}
                      className={`btn btn-sm ${
                        offerDraft.role === k ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                  {([['ประหยัด (-15%)', 0], ['มาตรฐาน', 1], ['จัดเต็ม (+20%)', 2]] as const).map(([l, k]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setOfferDraft({ ...offerDraft, wb: k, counter: null, msg: '' })}
                      className={`btn btn-sm truncate ${
                        offerDraft.wb === k ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 mland:space-y-2">
              <div className="grid grid-cols-2 gap-2 mland:gap-1.5 text-center p-3 mland:p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
                <div>
                  <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">จ่ายทันที</div>
                  <b className={`text-sm mland:text-xs tabular ${!canAfford ? 'text-[var(--red)]' : ''}`}>{fmtMoneyNum(E.cashNow)}</b>
                </div>
                <div>
                  <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">ค่าเหนื่อยหลังดีล</div>
                  <b className={`text-sm mland:text-xs tabular ${wageOverCap ? 'text-[var(--red)]' : ''}`}>
                    {fmtMoneyNum(Math.round(tx.curWage - freedWage + E.wg))}/{fmtMoneyNum(tx.wageCap)}
                  </b>
                </div>
                <div>
                  <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">{E.dueLater ? 'ผ่อนปลายปี' : E.loanOpt ? 'ซื้อขาด' : 'ค่าเหนื่อยนักเตะ'}</div>
                  <b className="text-sm mland:text-xs tabular">{E.dueLater ? fmtMoneyNum(E.dueLater) : E.loanOpt ? fmtMoneyNum(E.loanOpt) : `${fmtMoneyNum(E.wg)}/นัด`}</b>
                </div>
                <div>
                  <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">งบคงเหลือ</div>
                  <b className="text-sm mland:text-xs tabular">{fmtMoneyNum(state.money)}</b>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs mland:text-[10.5px]">
                <span className="whitespace-nowrap font-semibold">โอกาสตอบรับ</span>
                <div className="flex-1 h-2.5 mland:h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${E.chance}%`, background: chCol }} />
                </div>
                <b className="tabular shrink-0" style={{ color: chCol }}>{E.chance}%</b>
              </div>

              {offerDraft.msg && (
                <div className="p-3 mland:p-2 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)] text-xs mland:text-[10.5px] space-y-2 mland:space-y-1.5">
                  <div className="font-bold">💬 ผลการเจรจา ({q.tries || 0}/3)</div>
                  <p className="leading-snug">{offerDraft.msg}</p>
                  {offerDraft.counter && (
                    <button type="button" onClick={() => submitOffer(true)} className="btn btn-sm btn-primary w-full">
                      ✅ ตกลงตามข้อเสนอสวน ({fmtMoneyNum(offerDraft.counter.cashNow)} · {fmtMoneyNum(offerDraft.counter.wg)}/นัด)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 p-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
            <button type="button" onClick={() => setOfferDraft(null)} className="btn btn-md btn-surface">
              ปิด
            </button>
            <button
              type="button"
              disabled={!canAfford || !needSwapOk || fullSq || loanCapHit || wageOverCap || !!q.locked}
              onClick={() => submitOffer(false)}
              className="btn btn-md btn-gold flex-1"
            >
              {q.locked
                ? 'การเจรจาล่มแล้ว'
                : loanCapHit
                  ? `โควตายืมเต็ม ${tx.maxLoans} คน`
                  : wageOverCap
                    ? `เกินเพดานค่าเหนื่อย ${fmtMoneyNum(tx.wageCap)}`
                    : fullSq
                      ? `ทีมเต็ม ${tx.maxSquad} คน`
                      : !canAfford
                        ? 'งบไม่พอ / ติดกฎ FFP'
                        : '🤝 ยื่นข้อเสนอเจรจา'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRenewModal = () => {
    if (renewIdx === null) return null;
    const q = me.sq[renewIdx];
    if (!q) return null;
    const con = ensureCon(q);
    const wf = [0.9, 1.05, 1.25][renewWb];
    const newWg = +(wagOf(q) * wf).toFixed(1);
    const bonus = renewWb === 2 ? Math.max(5, Math.round(q.ov / 7)) : renewWb === 1 ? 2 : 0;
    const ch = clamp(Math.round(58 + (wf - 1) * 120 + (renewRole === 'key' ? 14 : renewRole === 'rot' ? 4 : -10) + (renewYr >= 3 ? 6 : 0)), 15, 98);
    const wageDelta = newWg - con.wg;
    const renewOverCap = tx.curWage + wageDelta > tx.wageCap;

    return (
      <div className="fixed inset-0 z-50 bg-black/72 flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden" onClick={() => setRenewIdx(null)}>
        <div className="w-full max-w-2xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="shrink-0 flex items-center gap-3 px-3.5 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
            <PlayerFace player={q} team={me} state={state} size={42} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm mland:text-xs truncate">📋 ต่อสัญญา · {q.n}</div>
              <div className="text-xs mland:text-[10.5px] text-[var(--mut)] tabular">
                เหลือสัญญา <b>{con.yr} ปี</b> · ค่าเหนื่อยเดิม {fmtMoneyNum(con.wg)}/นัด
              </div>
              <PlayerBioStrip bio={getPlayerBio(q)} variant="inline" className="mt-1" />
            </div>
            <span className="px-2 py-0.5 rounded-lg text-white font-bold text-xs tabular shrink-0" style={{ background: ovColor(q.ov) }}>
              {q.ov}
            </span>
            <button
              type="button"
              onClick={() => setRenewIdx(null)}
              aria-label="ปิดหน้าต่างต่อสัญญา"
              className="btn-icon"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2.5 items-start">
            <div className="space-y-2.5 mland:space-y-2">
              <div>
                <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1">ระยะเวลาสัญญาใหม่</div>
                <div className="grid grid-cols-4 gap-1.5 mland:gap-1">
                  {[2, 3, 4, 5].map((y) => (
                    <button key={y} type="button" onClick={() => setRenewYr(y)} className={`btn btn-sm ${renewYr === y ? 'btn-primary' : 'btn-secondary'}`}>
                      {y} ปี
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1">บทบาทในทีม</div>
                <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                  {([['key', '⭐ ตัวหลัก'], ['rot', '🔄 หมุนเวียน'], ['pro', '🌱 ดาวรุ่ง']] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setRenewRole(k)} className={`btn btn-sm ${renewRole === k ? 'btn-primary' : 'btn-secondary'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2.5 mland:space-y-2">
              <div>
                <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1">ระดับค่าเหนื่อยที่เสนอ</div>
                <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                  {([['รัดเข็มขัด (-10%)', 0], ['เพิ่มนิด (+5%)', 1], ['จัดเต็ม (+25%)', 2]] as const).map(([l, k]) => (
                    <button key={k} type="button" onClick={() => setRenewWb(k)} className={`btn btn-sm truncate ${renewWb === k ? 'btn-primary' : 'btn-secondary'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-1.5">
                <div className="flex items-center gap-2 text-xs mland:text-[10.5px]">
                  <span className="whitespace-nowrap font-semibold">โอกาสตกลง</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--g)] transition-all" style={{ width: `${ch}%` }} />
                  </div>
                  <b className="tabular">{ch}%</b>
                </div>
                <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">
                  ค่าเหนื่อยใหม่: <b className="text-[var(--ink)]">{fmtMoneyNum(newWg)}/นัด</b>
                  {bonus ? ` · โบนัสเซ็น ${fmtMoneyNum(bonus)}` : ''}
                </div>
              </div>
              {renewOverCap && <p className="text-xs mland:text-[10.5px] text-[var(--red)] font-semibold">⚠️ ค่าเหนื่อยใหม่จะทำให้ทีมเกินเพดาน {fmtMoneyNum(tx.wageCap)}/นัด</p>}
              {renewMsg && <p className="text-xs mland:text-[10.5px] text-[var(--red)]">{renewMsg}</p>}
            </div>
          </div>

          <div className="shrink-0 p-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
            <button type="button" onClick={() => setRenewIdx(null)} className="btn btn-md btn-surface">
              ปิด
            </button>
            <button
              type="button"
              disabled={state.money < bonus || renewOverCap}
              onClick={() => {
                if (Math.random() * 100 < ch) {
                  onUpdateState((d) => {
                    d.money -= bonus;
                    if (bonus) logFin(d, `โบนัสต่อสัญญา ${q.n}`, -bonus);
                    d.teams[d.me].sq[renewIdx].con = { yr: renewYr, wg: newWg, role: renewRole };
                  });
                  setRenewIdx(null);
                  onToast(`ต่อสัญญา ${q.n} อีก ${renewYr} ปีแล้ว!`);
                } else {
                  setRenewMsg('นักเตะยังไม่พอใจข้อเสนอ ลองเพิ่มค่าเหนื่อยหรือบทบาท');
                }
              }}
              className="btn btn-md btn-gold flex-1"
            >
              {renewOverCap ? `เกินเพดาน ${fmtMoneyNum(tx.wageCap)}` : `✅ ยืนยันต่อสัญญา (${fmtMoneyNum(newWg)}/นัด${bonus ? `, โบนัส ${fmtMoneyNum(bonus)}` : ''})`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const marketTabs: { id: MarketTab; label: string; count?: string }[] = [
    { id: 'buy', label: '🛒 ซื้อ & ยืมนักเตะ', count: `${activeCount}` },
    { id: 'sell', label: '🏷️ ขายออก & ข้อเสนอ', count: incomingOffers.length > 0 ? `${incomingOffers.length} ดีลเข้า` : listedPlayers.length > 0 ? `${listedPlayers.length} ตั้งขาย` : undefined },
    { id: 'scout', label: '🔍 แมวมองสโมสร', count: state.scout?.results ? 'รายงานพร้อม' : state.scout ? `รอ ${state.scout.turnsLeft} นัด` : undefined },
    { id: 'con', label: '📋 สัญญา & เยาวชน', count: expiringCount + loanPlayers.length > 0 ? `${expiringCount + loanPlayers.length} ใกล้หมด` : undefined }
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Top Transfer Window Status & Club Budget Strip */}
      <div className={`px-3.5 py-2 mland:px-2.5 mland:py-1 rounded-2xl mland:rounded-xl border shrink-0 flex items-center justify-between gap-3 ${tx.tw.open ? 'bg-[var(--g-soft)] border-[var(--g)]/35' : 'bg-[var(--surface)] border-[var(--line)]'}`}>
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="font-bold text-xs sm:text-sm mland:text-[11px] whitespace-nowrap">
            {tx.tw.open ? '🟢 ' : '🔒 '}
            {tx.tw.label}
          </span>
          <span className="hidden md:inline mland:inline text-xs mland:text-[9.5px] text-[var(--mut)] truncate">
            · {tx.tw.subLabel}
          </span>
        </div>

        <div className="flex items-center gap-x-2.5 mland:gap-x-1.5 text-xs mland:text-[10px] text-[var(--mut)] tabular whitespace-nowrap overflow-x-auto">
          <span>
            ทีม <b className="text-[var(--ink)]">{me.sq.length}/{tx.maxSquad}</b>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            ยืม <b className={tx.loansCount >= tx.maxLoans ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>{tx.loansCount}/{tx.maxLoans}</b>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            ค่าเหนื่อย <b className={tx.wagePct > 95 ? 'text-[var(--red)]' : 'text-[var(--g)]'}>{fmtMoneyNum(tx.curWage)}/{fmtMoneyNum(tx.wageCap)} ({tx.wagePct}%)</b>
          </span>
          <span aria-hidden="true">·</span>
          <span className={`font-bold ${state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>
            งบ {fmtMoney(state.money)}
          </span>
          {tx.ffpLocked && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--red)] font-bold">FFP ติดลบ</span>
            </>
          )}
        </div>
      </div>

      {/* Divided 4-Section Market Sub-Navigation */}
      <div className="seg-bar grid grid-cols-4 w-full shrink-0">
        {marketTabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                SFX.tap();
                setActiveTab(t.id);
              }}
              className={`seg-btn min-w-0 ${active ? 'seg-btn-active' : ''}`}
            >
              <span className="truncate whitespace-nowrap">{t.label}</span>
              {t.count && (
                <span className={`hidden sm:inline mland:inline text-[10px] mland:text-[8.5px] font-semibold tabular shrink-0 whitespace-nowrap ${active ? 'text-white/85' : 'text-[var(--mut)]'}`}>
                  · {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: BUY & LOAN PLAYERS (Filter Sidebar + Spacious Player List) */}
      {activeTab === 'buy' && (
        <div className="grid grid-cols-[245px_1fr] mland:grid-cols-[210px_1fr] grid-rows-[minmax(0,1fr)] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
          {/* Left Filter & Source Panel */}
          <aside className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-3 mland:p-2 space-y-3 mland:space-y-2">
              <div className="space-y-1.5 mland:space-y-1">
                <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">แหล่งนักเตะ</div>
                <div className="seg-bar grid grid-cols-3 w-full">
                  <button
                    type="button"
                    onClick={() => setMarketSource('mk')}
                    className={`seg-btn px-1 ${
                      marketSource === 'mk' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : ''
                    }`}
                  >
                    🏪 ตลาด
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMarketSource('club');
                      if (filter === 'FREE') setFilter('ALL');
                    }}
                    className={`seg-btn px-1 ${
                      marketSource === 'club' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : ''
                    }`}
                  >
                    🏟️ สโมสร
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMarketSource('created');
                      if (filter === 'FREE') setFilter('ALL');
                    }}
                    className={`seg-btn px-1 ${
                      marketSource === 'created' ? 'bg-[var(--surface)] text-[var(--g)] shadow-xs' : ''
                    }`}
                  >
                    ⭐ สร้างเอง
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 mland:space-y-1">
                <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">ค้นหา</div>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={marketSource === 'club' ? 'ชื่อนักเตะ / สโมสร...' : 'ชื่อนักเตะ / ตำแหน่ง...'}
                    aria-label="ค้นหานักเตะ"
                    className="w-full pl-2.5 pr-6 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] focus:outline-none focus:border-[var(--g)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="ล้างคำค้นหา"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 mland:space-y-1">
                <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">ตำแหน่งหลัก</div>
                <div className="grid grid-cols-3 gap-1">
                  {([['ALL', 'ทั้งหมด'], ['GK', 'GK'], ['DF', 'หลัง'], ['MF', 'กลาง'], ['FW', 'หน้า'], ...(marketSource === 'mk' ? [['FREE', 'ฟรี'] as const] : [])] as const).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setFilter(k);
                        setSubFilter('ALL');
                      }}
                      className={`btn btn-xs ${
                        filter === k ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 mland:space-y-1">
                <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">บทบาท &amp; การเรียงลำดับ</div>
                <select
                  aria-label="กรองตำแหน่งย่อย"
                  value={subFilter}
                  onChange={(e) => setSubFilter(e.target.value as 'ALL' | SubRole)}
                  className="w-full px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-semibold cursor-pointer"
                >
                  <option value="ALL">บทบาท: ทั้งหมด</option>
                  {availableSubRoles.map((role) => (
                    <option key={role} value={role}>
                      {role} · {SPN[role] || role}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="เรียงลำดับนักเตะ"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'default' | 'ov_desc' | 'price_asc' | 'age_asc')}
                  className="w-full px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-semibold cursor-pointer"
                >
                  <option value="default">เรียง: แนะนำ</option>
                  <option value="ov_desc">เรียง: OVR สูงสุด</option>
                  <option value="price_asc">เรียง: ค่าตัวถูกสุด</option>
                  <option value="age_asc">เรียง: อายุน้อยสุด</option>
                </select>
              </div>

              {marketSource === 'club' && (
                <div className="space-y-1.5 mland:space-y-1">
                  <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">ขอบเขตลีก</div>
                  <div className="seg-bar grid grid-cols-2 w-full">
                    <button
                      type="button"
                      onClick={() => setClubTierFilter('MY_TIER')}
                      className={`seg-btn ${clubTierFilter === 'MY_TIER' ? 'seg-btn-active' : ''}`}
                    >
                      ลีกใกล้เคียง
                    </button>
                    <button
                      type="button"
                      onClick={() => setClubTierFilter('ALL')}
                      className={`seg-btn ${clubTierFilter === 'ALL' ? 'seg-btn-active' : ''}`}
                    >
                      ทุกลีก
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 p-2.5 mland:p-2 border-t border-[var(--line)] bg-[var(--surface-2)]/40 space-y-1.5">
              {marketSource === 'mk' && (
                <button
                  type="button"
                  disabled={state.money < 15}
                  onClick={() => {
                    SFX.tap();
                    onUpdateState((d) => {
                      d.money -= 15;
                      logFin(d, 'รีเฟรชตลาดซื้อขาย', -15);
                      mkMarket(d);
                    });
                    onToast('อัปเดตรายชื่อตลาดใหม่ครบทุกตำแหน่งแล้ว');
                  }}
                  className="btn btn-sm btn-surface w-full"
                >
                  🔄 หาชุดใหม่ ({fmtMoneyNum(15)})
                </button>
              )}
              {hasBuyFilters && (
                <button
                  type="button"
                  onClick={resetBuyFilters}
                  className="btn btn-xs btn-ghost w-full"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          </aside>

          {/* Right Spacious Player List */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/30 flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                  {marketSource === 'mk'
                    ? '🏪 รายชื่อนักเตะในตลาดกลาง'
                    : marketSource === 'club'
                      ? '🏟️ นักเตะจากสโมสรในลีก'
                      : '⭐ นักเตะที่คุณสร้างเอง (ดึงเป็นเด็กปั้นหรือซื้อเข้าทีม)'}
                </h3>
                <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular whitespace-nowrap">
                  · {activeCount} คน
                </span>
              </div>
              {!tx.tw.open && marketSource !== 'created' && (
                <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] whitespace-nowrap shrink-0">
                  {marketSource === 'mk' ? 'ช่วงปิดตลาดเซ็นได้เฉพาะฟรีเอเยนต์' : '🔒 รอเปิดตลาดซื้อขาย'}
                </span>
              )}
              {marketSource === 'created' && (
                <span className="text-[11px] mland:text-[9.5px] text-[var(--g)] font-bold whitespace-nowrap shrink-0">
                  🌱 ดึงเป็นเด็กปั้นได้ทุกเวลา
                </span>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
              {marketSource === 'mk' ? (
                marketList.length > 0 ? (
                  marketList.map(({ q, i }) => {
                    const blockedByWindow = !tx.tw.open && !q.free;
                    return (
                      <div
                        key={`${q.n}-${i}`}
                        className={`flex items-center gap-3 mland:gap-2 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/60 transition-colors ${blockedByWindow ? 'opacity-70' : ''}`}
                      >
                        <div className="shrink-0 [&>svg]:w-10 [&>svg]:h-10 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                          <PlayerFace player={q} size={40} />
                        </div>
                        <button type="button" onClick={() => onInspectPlayer(q, null)} className="flex-1 min-w-0 text-left cursor-pointer">
                          <div className="font-bold text-xs sm:text-[13px] mland:text-[11px] truncate leading-tight flex items-center gap-1.5">
                            <PositionBadge role={q.ro} size="xs" />
                            <span className="truncate">{q.n}</span>
                            {q.free ? (
                              <span className="ml-1.5 text-[11px] mland:text-[9.5px] text-[var(--g)] font-bold">· ฟรีเอเยนต์</span>
                            ) : q.age <= 19 ? (
                              <span className="ml-1.5 text-[11px] mland:text-[9.5px] text-[#9a6700] dark:text-[var(--lamp)] font-bold">· ดาวรุ่ง</span>
                            ) : null}
                          </div>
                          <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate tabular leading-tight mt-0.5 flex items-center gap-1">
                            <span>{SPN[q.ro] || q.pos} · อายุ {q.age} ปี ·</span>
                            <PotentialBadge pot={q.pot || q.ov} variant="inline" size="xs" />
                            <span>· ค่าเหนื่อย ~{fmtMoneyNum(q.askWg || wagOf(q))}/นัด</span>
                          </div>
                          <PlayerBioStrip bio={getPlayerBio(q)} variant="inline" className="mt-0.5" />
                        </button>
                        <span className="w-9 mland:w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                          {q.ov}
                        </span>
                        <button
                          type="button"
                          disabled={!!q.locked || blockedByWindow}
                          onClick={() => openNegotiation('mk', i, q)}
                          className={`btn btn-sm min-w-[92px] mland:min-w-[78px] shrink-0 ${
                            blockedByWindow ? 'btn-secondary text-[var(--mut)]' : 'btn-primary'
                          }`}
                        >
                          {q.locked ? 'เจรจาล่ม' : blockedByWindow ? '🔒 ปิดตลาด' : q.free ? 'เซ็นฟรี' : `ยื่น ${fmtMoneyNum(q.price || 0)}`}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-xs text-[var(--mut)]">ไม่พบนักเตะตามเงื่อนไขที่เลือก</p>
                    <button
                      type="button"
                      onClick={resetBuyFilters}
                      className="btn btn-sm btn-secondary"
                    >
                      ล้างตัวกรอง
                    </button>
                  </div>
                )
              ) : marketSource === 'club' ? (
                clubMarketList.length > 0 ? (
                  clubMarketList.map(({ q, team, idx, price }) => {
                    const blockedByWindow = !tx.tw.open;
                    return (
                      <div
                        key={`${team.id}-${q.n}-${idx}`}
                        className={`flex items-center gap-3 mland:gap-2 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/60 transition-colors ${blockedByWindow ? 'opacity-70' : ''}`}
                      >
                        <div className="shrink-0 [&>svg]:w-10 [&>svg]:h-10 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                          <PlayerFace player={q} team={team} state={state} size={40} />
                        </div>
                        <button type="button" onClick={() => onInspectPlayer(q, team)} className="flex-1 min-w-0 text-left cursor-pointer">
                          <div className="font-bold text-xs sm:text-[13px] mland:text-[11px] truncate leading-tight flex items-center gap-1.5">
                            <PositionBadge role={q.ro} size="xs" />
                            <span className="truncate">{q.n}</span>
                          </div>
                          <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate tabular leading-tight mt-0.5">
                            {team.name} ({TN[team.tier]}) · {SPN[q.ro] || q.pos} · อายุ {q.age} ปี
                          </div>
                          <PlayerBioStrip bio={getPlayerBio(q)} variant="inline" className="mt-0.5" />
                        </button>
                        <span className="w-9 mland:w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                          {q.ov}
                        </span>
                        <button
                          type="button"
                          disabled={!!q.locked || blockedByWindow}
                          onClick={() => openNegotiation('club', idx, q, team)}
                          className={`btn btn-sm min-w-[92px] mland:min-w-[78px] shrink-0 ${
                            blockedByWindow ? 'btn-secondary text-[var(--mut)]' : 'btn-primary'
                          }`}
                        >
                          {q.locked ? 'เจรจาล่ม' : blockedByWindow ? '🔒 ปิดตลาด' : `ยื่น ~${fmtMoneyNum(price)}`}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-xs text-[var(--mut)]">ไม่พบนักเตะในสโมสรอื่นตามตัวกรอง</p>
                    <button
                      type="button"
                      onClick={() => {
                        resetBuyFilters();
                        setClubTierFilter('ALL');
                      }}
                      className="btn btn-sm btn-secondary"
                    >
                      ดูทุกลีกทั้งหมด
                    </button>
                  </div>
                )
              ) : createdMarketList.length > 0 ? (
                createdMarketList.map((cand: CreatedPlayerCandidate) => {
                  const q = cand.player;
                  const alreadyInSquad = me.sq.some((z) => z.n === q.n);
                  const squadFull = me.sq.length >= tx.maxSquad;
                  const signCreatedPlayer = (payTransferFee: boolean) => {
                    if (alreadyInSquad) {
                      onToast(`${q.n} อยู่ในทีมของคุณแล้ว`);
                      return;
                    }
                    if (squadFull) {
                      onToast(`ทีมเต็ม ${tx.maxSquad} คนแล้ว`);
                      return;
                    }
                    const fee = payTransferFee ? cand.price : 0;
                    if (payTransferFee && tx.ffpLocked && fee > 0) {
                      onToast('งบติดลบตามกฎ FFP ห้ามจ่ายค่าตัวจนกว่างบจะกลับมาเป็นบวก (หรือดึงเป็นเด็กปั้นฟรีได้)');
                      return;
                    }
                    if (payTransferFee && state.money < fee) {
                      onToast(`งบไม่พอซื้อ (${fmtMoneyNum(fee)}) — สามารถกด "🌱 เด็กปั้นฟรี" ได้เลย`);
                      return;
                    }
                    const wg = wagOf(q);
                    if (tx.curWage + wg > tx.wageCap) {
                      onToast(`เกินเพดานค่าเหนื่อยลีก (${fmtMoneyNum(tx.wageCap)}/นัด)`);
                      return;
                    }
                    onUpdateState((d) => {
                      const t = d.teams[d.me];
                      if (t.sq.some((z) => z.n === q.n)) return;
                      if (fee > 0) {
                        d.money -= fee;
                        logFin(d, `ซื้อตัวสร้างเอง ${q.n}`, -fee);
                      }
                      const priorHistory = (q.history || []).map((h) => ({ ...h }));
                      if ((q.sp || 0) > 0 && cand.sourceSeason != null && !priorHistory.some((h) => h.season === cand.sourceSeason)) {
                        priorHistory.unshift({
                          season: cand.sourceSeason,
                          teamId: -1,
                          teamName: cand.clubName || 'สโมสรเดิม',
                          tier: cand.sourceTier ?? 0,
                          ov: q.ov,
                          sp: q.sp || 0,
                          sg: q.sg || 0,
                          sa: q.sa || 0,
                          cs: q.cs || 0,
                          motm: q.motm || 0,
                          yc: q.tyc ?? q.yc ?? 0,
                          rc: q.rc || 0,
                          avgRating: cand.careerStats.avgRating || 6.5
                        });
                      }
                      const incoming: Player = {
                        ...q,
                        sp: 0,
                        sg: 0,
                        sa: 0,
                        cs: 0,
                        motm: 0,
                        yc: 0,
                        tyc: 0,
                        rc: 0,
                        srs: 0,
                        sra: 0,
                        history: priorHistory.length ? priorHistory : undefined,
                        careerLog: q.careerLog ? [...q.careerLog] : undefined,
                        hg: 1,
                        customCreated: 1,
                        no: undefined,
                        signedSeason: d.season,
                        signedMd: d.md,
                        con: { yr: 3, wg, role: q.ov >= 72 ? 'key' : 'pro' }
                      };
                      appendPlayerCareerLog(
                        incoming,
                        fee > 0
                          ? `💰 ซื้อตัวเข้า ${t.name} (${TN[t.tier]}) ซีซั่น ${d.season} [🌱 เด็กปั้นสร้างเอง]`
                          : `🌱 ดึงตัวสู่ทีมชุดใหญ่ ${t.name} ในฐานะเด็กปั้นสโมสร ซีซั่น ${d.season}`
                      );
                      t.sq.push(incoming);
                      assignTeamShirtNumbers(t);
                      pushFeed(
                        d,
                        fee > 0 ? 'ซื้อตัวสร้างเอง' : 'เด็กปั้นสโมสร',
                        `🌱 ${q.n} (${q.ro} OVR ${q.ov}) เข้าร่วมทีมพร้อมสัญลักษณ์เด็กปั้นสโมสร!`,
                        'ok'
                      );
                    });
                    SFX.win();
                    setCreatedRefresh((n) => n + 1);
                    onToast(fee > 0 ? `💰 ซื้อ ${q.n} เข้าทีมเรียบร้อย (🌱 เด็กปั้น)!` : `🌱 ดึง ${q.n} เข้าทีมเป็นเด็กปั้นฟรีเรียบร้อย!`);
                  };

                  const cs = cand.careerStats;
                  const coreA = q.customA || cand.profile.a;
                  return (
                    <div
                      key={cand.key}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 mland:gap-2 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/60 transition-colors"
                    >
                      <div className="shrink-0 [&>svg]:w-10 [&>svg]:h-10 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                        <PlayerFace player={q} team={me} state={state} size={40} />
                      </div>
                      <button type="button" onClick={() => onInspectPlayer(q, null)} className="flex-1 min-w-0 text-left cursor-pointer group">
                        <div className="font-bold text-xs sm:text-[13px] mland:text-[11px] truncate leading-tight flex items-center gap-1.5">
                          <PositionBadge role={q.ro} size="xs" />
                          <span className="truncate group-hover:underline">{q.n}</span>
                          <span className="px-1.5 py-[1px] rounded bg-[var(--g-soft)] border border-[var(--g)]/35 text-[var(--g)] text-[9.5px] mland:text-[8px] font-bold shrink-0">
                            🌱 เด็กปั้น
                          </span>
                        </div>
                        <div className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate tabular leading-tight mt-0.5 flex items-center gap-1">
                          <span className="truncate">
                            {cand.sourceLabel}
                            {cand.sourceType === 'career_save' && cand.clubName ? ` · ${cand.clubName}` : ''}
                            {cand.archName ? ` · ${cand.archName}` : ''} · อายุ {q.age} ปี ·
                          </span>
                          <PotentialBadge pot={cand.pot} variant="inline" size="xs" className="shrink-0" />
                        </div>
                        <PlayerBioStrip bio={getPlayerBio(q)} variant="inline" className="mt-0.5" />
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] mland:text-[8.5px] tabular">
                          <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded bg-[var(--surface-2)] border border-[var(--line)]/80 text-[var(--ink)] font-semibold">
                            <span>ยิง <b>{coreA.sh}</b></span>
                            <span className="opacity-40">·</span>
                            <span>จ่าย <b>{coreA.ps}</b></span>
                            <span className="opacity-40">·</span>
                            <span>เลี้ยง <b>{coreA.dr}</b></span>
                            <span className="opacity-40">·</span>
                            <span>แย่ง <b>{coreA.tk}</b></span>
                            <span className="opacity-40">·</span>
                            <span>กาย <b>{coreA.ph}</b></span>
                          </span>
                          {cs.apps > 0 ? (
                            <span className="inline-flex flex-wrap items-center gap-1.5 px-1.5 py-[1px] rounded bg-emerald-500/10 border border-emerald-500/25 text-[var(--ink)] font-bold">
                              <span>👕 {cs.apps} นัด</span>
                              <span>⚽ {cs.goals}</span>
                              <span>{q.pos === 'GK' ? `🧤 ${cs.cleanSheets}` : `👟 ${cs.assists}`}</span>
                              {cs.avgRating > 0 && <span className="text-[#8a5b00] dark:text-[#fde047]">⭐ {cs.avgRating.toFixed(2)}</span>}
                              {cs.motm > 0 && <span>👑 {cs.motm}</span>}
                              {cs.ntCaps > 0 && <span>🇹🇭 {cs.ntCaps}</span>}
                            </span>
                          ) : (
                            <span className="text-[var(--mut)]">ยังไม่เคยลงแข่งอาชีพ</span>
                          )}
                        </div>
                      </button>
                      <span className="w-9 mland:w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                        {q.ov}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onInspectPlayer(q, null);
                          }}
                          className="btn btn-xs btn-secondary"
                          title="ดูการ์ดพลังและประวัติสถิติทั้งหมด"
                        >
                          📊 สถิติ
                        </button>
                        {alreadyInSquad ? (
                          <span className="px-2.5 py-1 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/35 text-[var(--g)] text-[11px] mland:text-[9.5px] font-bold shrink-0">
                            ✅ อยู่ในทีม
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={squadFull}
                              onClick={() => signCreatedPlayer(false)}
                              className="btn btn-xs btn-primary"
                              title="ดึงเข้าทีมฟรีในฐานะเด็กปั้นสโมสร"
                            >
                              🌱 ปั้นฟรี
                            </button>
                            <button
                              type="button"
                              disabled={squadFull || state.money < cand.price || (tx.ffpLocked && cand.price > 0)}
                              onClick={() => signCreatedPlayer(true)}
                              className="btn btn-xs btn-gold"
                              title="ซื้อตัวเข้าทีมพร้อมสัญลักษณ์เด็กปั้น"
                            >
                              💰 ซื้อ {fmtMoneyNum(cand.price)}
                            </button>
                            {cand.sourceType === 'custom_pool' && cand.templateId && (
                              <button
                                type="button"
                                onClick={() => {
                                  SFX.tap();
                                  deleteCustomPlayer(cand.templateId!);
                                  setCreatedRefresh((n) => n + 1);
                                  onToast(`ลบ ${q.n} ออกจากทำเนียบนักเตะสร้างเองแล้ว`);
                                }}
                                aria-label={`ลบ ${q.n}`}
                                className="btn btn-xs btn-danger"
                              >
                                🗑️
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center space-y-2">
                  <div className="text-2xl">⭐</div>
                  <p className="text-xs font-bold text-[var(--ink)]">ยังไม่มีนักเตะที่คุณสร้างเอง</p>
                  <p className="text-[11px] text-[var(--mut)]">สร้างนักเตะในหน้าเมนูหลัก (โหมดนักเตะ หรือ สร้างนักเตะเก็บไว้) แล้วกลับมาซื้อหรือดึงเป็นเด็กปั้นที่นี่ได้เลย</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* SECTION 2: OUTGOING TRANSFERS & INCOMING BIDS (Balanced 2-Column Workspace) */}
      {activeTab === 'sell' && (
        <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-2 flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
          {/* Left: Incoming Offers */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className={`shrink-0 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] flex items-center justify-between gap-2 ${incomingOffers.length > 0 ? 'bg-[var(--lamp-soft)]/55' : 'bg-[var(--surface-2)]/30'}`}>
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">💼 ข้อเสนอซื้อนักเตะเข้าทีม</h3>
              <span className={`text-[11px] mland:text-[9.5px] font-bold tabular whitespace-nowrap ${incomingOffers.length > 0 ? 'text-[#8a5b00] dark:text-[var(--lamp)]' : 'text-[var(--mut)]'}`}>
                {incomingOffers.length} รายการ
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
              {incomingOffers.length > 0 ? (
                incomingOffers.map((off) => {
                  const targetQ = me.sq.find((q) => q.n === off.n);
                  if (!targetQ) return null;
                  const marketVal = Math.max(5, vlu(targetQ));
                  const diffPct = Math.round(((off.p - marketVal) / marketVal) * 100);
                  const wg = ensureCon(targetQ).wg;
                  const buyerTeam =
                    (off.teamId != null ? state.teams.find((t) => t.id === off.teamId) : undefined) ||
                    state.teams.find((t) => t.name === off.t);
                  return (
                    <div key={`${off.n}__${off.t}`} className="p-3 mland:p-2 space-y-2 mland:space-y-1.5 hover:bg-[var(--surface-2)]/35 transition-colors">
                      <div className="flex items-center gap-2.5 mland:gap-2">
                        <div className="shrink-0 w-8 h-8 mland:w-7 mland:h-7 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center">
                          <ClubCrest
                            name={buyerTeam?.name || off.t}
                            size={22}
                            team={buyerTeam}
                            club={state.club}
                            isMyClub={false}
                          />
                        </div>
                        <PlayerFace player={targetQ} team={me} state={state} size={34} />
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(targetQ, me)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 text-xs sm:text-[13px] mland:text-[10.5px] font-bold leading-tight">
                            <span className="truncate">{off.t}</span>
                            {buyerTeam && (
                              <span className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)] shrink-0">
                                ({TN[buyerTeam.tier] || ''})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate mt-0.5 tabular flex items-center gap-1">
                            <span>ขอซื้อ</span>
                            <PositionBadge role={targetQ.ro} size="2xs" />
                            <b className="text-[var(--ink)] truncate">{off.n}</b>
                            <span>· ลดค่าเหนื่อย {fmtMoneyNum(wg)}/นัด</span>
                          </div>
                        </button>
                        <span
                          className="w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10px] font-bold tabular shrink-0"
                          style={{ background: ovColor(targetQ.ov) }}
                        >
                          {targetQ.ov}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pl-0.5">
                        <div className="flex items-center gap-2 text-[11px] mland:text-[9.5px] tabular">
                          <span className="font-extrabold text-[var(--g)] text-xs sm:text-[13px] mland:text-[11px]">
                            ยื่น {fmtMoney(off.p)}
                          </span>
                          <span className="text-[var(--mut)]">· ประเมิน {fmtMoneyNum(marketVal)}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] mland:text-[8.5px] ${
                              diffPct >= 0
                                ? 'bg-[var(--g-soft)] text-[var(--g)]'
                                : 'bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)]'
                            }`}
                          >
                            {diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const res = canAcceptTransferOffer(state, off);
                              if (!res.ok) {
                                onToast(res.err || 'ขายไม่สำเร็จ');
                                return;
                              }
                              onUpdateState((d) => {
                                acceptTransferOffer(d, off);
                              });
                              SFX.win();
                              onToast(`ขาย ${off.n} ให้ ${res.buyerName || off.t} รับ +${fmtMoney(off.p)}`);
                            }}
                            className="btn btn-xs btn-primary"
                          >
                            ✅ ตอบรับขาย
                          </button>
                          {!off.cnt && (
                            <button
                              type="button"
                              onClick={() => {
                                const out = resolveCounterOfferOutcome(state, off);
                                onUpdateState((d) => applyCounterOfferOutcome(d, off, out));
                                onToast(
                                  out.accepted
                                    ? `${off.t} ยอมเพิ่มราคาเป็น ${fmtMoney(out.newPrice ?? off.p)}!`
                                    : `${off.t} ถอนข้อเสนอซื้อ ${off.n}`
                                );
                              }}
                              className="btn btn-xs btn-secondary"
                            >
                              💰 โก่ง +15%
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateState((d) => removeIncomingOffer(d, off.n, off.t));
                              onToast(`ปฏิเสธข้อเสนอจาก ${off.t} แล้ว`);
                            }}
                            className="btn btn-xs btn-secondary hover:text-[var(--red)]"
                          >
                            ✕ ปฏิเสธ
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-1.5">
                  <div className="text-2xl opacity-75">💼</div>
                  <div className="text-xs sm:text-sm mland:text-xs font-bold">ยังไม่มีข้อเสนอซื้อนักเตะเข้ามา</div>
                  <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs">
                    เลือกนักเตะทางด้านขวาแล้วกด &ldquo;💰 ขาย&rdquo; เพื่อขายด่วนทันที หรือขึ้นบัญชี &amp; เสนอขายเพื่อเรียกข้อเสนอจากสโมสรอื่น
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Right: Squad Selling & Transfer List (Unified with SquadTacticsView) */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 p-3 mland:p-2 border-b border-[var(--line)] bg-[var(--surface-2)]/30 space-y-2 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                  🏷️ ขายนักเตะ &amp; บัญชีขาย ({sellSquadList.length})
                </h3>
                <div className="seg-bar shrink-0">
                  <button
                    type="button"
                    onClick={() => setSellSubView('all')}
                    className={`seg-btn ${
                      sellSubView === 'all' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : ''
                    }`}
                  >
                    นักเตะในทีม ({me.sq.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellSubView('listed')}
                    className={`seg-btn tabular ${
                      sellSubView === 'listed' ? 'seg-btn-active' : ''
                    }`}
                  >
                    ตั้งขาย ({listedPlayers.length})
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mland:gap-1">
                <div className="relative flex-1 min-w-[120px]">
                  <input
                    type="text"
                    value={sellSearch}
                    onChange={(e) => setSellSearch(e.target.value)}
                    placeholder="ค้นหาชื่อ / ตำแหน่ง..."
                    aria-label="ค้นหานักเตะในทีมเพื่อขาย"
                    className="w-full pl-2.5 pr-6 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] mland:text-[9.5px] focus:outline-none focus:border-[var(--g)]"
                  />
                  {sellSearch && (
                    <button
                      type="button"
                      onClick={() => setSellSearch('')}
                      aria-label="ล้างคำค้นหา"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="seg-bar shrink-0">
                  {(['ALL', 'GK', 'DF', 'MF', 'FW'] as const).map((posKey) => (
                    <button
                      key={posKey}
                      type="button"
                      onClick={() => setSellPosFilter(posKey)}
                      className={`seg-btn ${sellPosFilter === posKey ? 'seg-btn-active' : ''}`}
                    >
                      {posKey === 'ALL' ? 'ทั้งหมด' : posKey}
                    </button>
                  ))}
                </div>
              </div>

              {activeSelectedSell.length > 0 && sellBatchPreview && (
                <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--lamp-soft)]/80 border border-[var(--lamp)]/70 flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10px]">
                  <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular">
                    <span className="font-extrabold text-[var(--ink)]">☑ เลือก {activeSelectedSell.length} คน</span>
                    <span className="text-[var(--mut)]">
                      · ขายด่วน <b className="text-[var(--g)]">+{fmtMoneyNum(sellBatchPreview.totalQuickSellValue)}</b>
                    </span>
                    <span className="text-[var(--mut)] hidden sm:inline mland:inline">
                      · ลดค่าเหนื่อย <b className="text-[var(--ink)]">-{fmtMoneyNum(sellBatchPreview.totalSavedWage)}/นัด</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSellModalNames(activeSelectedSell);
                      }}
                      className="btn btn-xs btn-primary"
                    >
                      💰 ขายที่เลือก ({activeSelectedSell.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSellNames([])}
                      className="btn btn-xs btn-surface"
                    >
                      ล้าง
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
              {sellSquadList.length > 0 ? (
                sellSquadList.map((q) => {
                  const marketVal = Math.max(5, vlu(q));
                  const wg = ensureCon(q).wg;
                  const bidCount = incomingOffers.filter((o) => o.n === q.n).length;
                  const selectable = !q.me && !q.loan;
                  const isChecked = selectable && activeSelectedSell.includes(q.n);
                  return (
                    <div
                      key={q.n}
                      className={`flex items-center gap-2 sm:gap-2.5 px-3 py-2 mland:px-2.5 mland:py-1.5 transition-colors hover:bg-[var(--surface-2)]/40 ${
                        isChecked ? 'bg-[var(--g-soft)]/55' : q.listed ? 'bg-[var(--lamp-soft)]/20' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!selectable}
                        onChange={() =>
                          setSelectedSellNames((prev) =>
                            prev.includes(q.n) ? prev.filter((name) => name !== q.n) : [...prev, q.n]
                          )
                        }
                        aria-label={`เลือก ${q.n} เพื่อขาย`}
                        className="w-3.5 h-3.5 accent-[var(--g)] cursor-pointer rounded shrink-0 disabled:opacity-30"
                      />
                      <PlayerFace player={q} team={me} state={state} size={34} />
                      <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                        <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight flex items-center gap-1">
                          <PositionBadge role={q.ro} size="xs" />
                          <span className="truncate">{q.n}</span>
                          {q.listed ? (
                            <span className="px-1 rounded bg-[var(--lamp-soft)] border border-[var(--lamp)]/45 text-[#8a5b00] dark:text-[var(--lamp)] text-[9.5px] mland:text-[8px] font-bold shrink-0">
                              ตั้งขาย {fmtMoneyNum(q.askPrice || marketVal)}
                            </span>
                          ) : null}
                          {bidCount > 0 ? (
                            <span className="px-1 rounded bg-[var(--g)] text-white text-[9.5px] mland:text-[8px] font-bold shrink-0">
                              {bidCount} บิด
                            </span>
                          ) : null}
                          {q.loan ? (
                            <span className="text-[10px] mland:text-[8.5px] text-blue-600 dark:text-blue-400 font-bold shrink-0">[ยืม]</span>
                          ) : null}
                        </div>
                        <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular truncate mt-0.5">
                          อายุ {q.age} ปี · ประเมิน {fmtMoneyNum(marketVal)} · ค่าเหนื่อย {fmtMoneyNum(wg)}/นัด
                          {q.inj > 0 ? <span className="text-[var(--red)] font-semibold"> · 🩹 เจ็บ {q.inj} นัด</span> : null}
                        </div>
                      </button>
                      <span
                        className="w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10px] font-bold tabular shrink-0"
                        style={{ background: ovColor(q.ov) }}
                      >
                        {q.ov}
                      </span>
                      {q.loan ? (
                        <span className="px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold whitespace-nowrap shrink-0">
                          ยืมตัว
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          {q.listed ? (
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateState((d) => {
                                  const t = d.teams[d.me].sq.find((z) => z.n === q.n);
                                  if (t) {
                                    t.listed = 0;
                                    delete t.askPrice;
                                  }
                                });
                                onToast(`ถอด ${q.n} ออกจากบัญชีขายแล้ว`);
                              }}
                              className="btn btn-xs btn-secondary hover:text-[var(--red)]"
                            >
                              ถอด
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              setSellModalNames([q.n]);
                            }}
                            className="btn btn-xs bg-[var(--lamp-soft)] border border-[var(--lamp)]/55 text-[#7c5300] dark:text-[var(--lamp)] hover:brightness-95"
                          >
                            💰 ขาย
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-1.5">
                  <div className="text-2xl opacity-75">🏷️</div>
                  <div className="text-xs sm:text-sm mland:text-xs font-bold">
                    {sellSubView === 'listed' ? 'ยังไม่มีนักเตะในบัญชีขาย' : 'ไม่พบนักเตะตามเงื่อนไขที่เลือก'}
                  </div>
                  <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs">
                    {sellSubView === 'listed'
                      ? 'สลับไปดู "นักเตะในทีม" แล้วกด "💰 ขาย" เพื่อตั้งขายด่วนหรือส่งโปรไฟล์ให้ทีมอื่นพิจารณา'
                      : 'ลองล้างคำค้นหาหรือเลือกตำแหน่งทั้งหมด'}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* SECTION 3: SCOUTING DEPARTMENT (Mission Dispatch + Scout Report) */}
      {activeTab === 'scout' && (
        <div className="grid grid-cols-[0.92fr_1.08fr] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
          {/* Left: Send Scout Mission */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/30 flex items-center justify-between gap-2">
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">🔍 ส่งแมวมองหานักเตะ</h3>
              <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular whitespace-nowrap">
                ค่าส่ง {fmtMoneyNum(20)} · รอ 2 นัด
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 space-y-3 mland:space-y-2">
              {state.scout ? (
                <div className="p-3 mland:p-2.5 rounded-xl bg-[var(--lamp-soft)]/70 border border-[var(--lamp)]/50 text-xs mland:text-[10.5px] space-y-1.5">
                  <div className="font-bold flex items-center justify-between gap-2">
                    <span>{state.scout.results ? '✅ รายงานแมวมองพร้อมแล้ว' : '⏳ แมวมองกำลังออกเดินทาง'}</span>
                    {!state.scout.results && (
                      <span className="tabular text-[#8a5b00] dark:text-[var(--lamp)]">เหลือ {state.scout.turnsLeft} นัด</span>
                    )}
                  </div>
                  <p className="text-[var(--mut)]">
                    ภารกิจปัจจุบัน: <b className="text-[var(--ink)]">{state.scout.label}</b>
                  </p>
                  {state.scout.results && (
                    <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">
                      ตรวจสอบรายชื่อที่พบในช่องรายงานด้านขวา หรือกดปิดรายงานเพื่อส่งภารกิจใหม่
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">เลือกเป้าหมายด่วน</div>
                    <div className="grid grid-cols-2 gap-2 mland:gap-1.5">
                      {([['wonderkid', '🌟 ดาวรุ่ง U20'], ['free', '🆓 ฟรีเอเยนต์'], ['gk', '🧤 ผู้รักษาประตู'], ['defender', '🛡️ กองหลัง'], ['midfielder', '🧭 กองกลาง'], ['striker', '⚽ กองหน้า']] as [ScoutMission['focus'], string][]).map(([focus, lbl]) => (
                        <button
                          key={focus}
                          type="button"
                          disabled={state.money < 20}
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              d.money -= 20;
                              logFin(d, 'ค่าส่งแมวมองส่องนักเตะ', -20);
                              d.scout = createScoutMission(focus, scoutRole);
                            });
                            onToast('ส่งแมวมองออกเดินทางแล้ว! รอรายงานในอีก 2 นัด');
                          }}
                          className="btn btn-md btn-secondary justify-start"
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2.5 mland:pt-2 border-t border-[var(--line)]/70 space-y-1.5">
                    <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">หรือระบุตำแหน่งย่อยเจาะจง</div>
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label="เลือกตำแหน่งเจาะจงให้แมวมอง"
                        value={scoutRole}
                        onChange={(e) => setScoutRole(e.target.value as SubRole | '')}
                        className="flex-1 min-w-0 px-2.5 py-2 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10.5px] font-semibold"
                      >
                        <option value="">เลือกตำแหน่งที่ต้องการ...</option>
                        {ALL_SUB_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r} — {SPN[r] || r}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!scoutRole || state.money < 20}
                        onClick={() => {
                          if (!scoutRole) return;
                          SFX.tap();
                          const lineFocus: ScoutMission['focus'] =
                            LINE[scoutRole] === 'GK' ? 'gk' : LINE[scoutRole] === 'DF' ? 'defender' : LINE[scoutRole] === 'MF' ? 'midfielder' : 'striker';
                          onUpdateState((d) => {
                            d.money -= 20;
                            logFin(d, `ส่งแมวมองหาตำแหน่ง ${scoutRole}`, -20);
                            d.scout = createScoutMission(lineFocus, scoutRole);
                          });
                          onToast(`ส่งแมวมองหาตำแหน่ง ${scoutRole} แล้ว! รอรายงานในอีก 2 นัด`);
                        }}
                        className="btn btn-md btn-primary shrink-0"
                      >
                        ส่งเจาะจง
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Right: Scout Report */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/30 flex items-center justify-between gap-2">
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                {state.scout?.results ? `📋 รายงาน: ${state.scout.label}` : '📋 รายงานผลการส่อง'}
              </h3>
              {state.scout?.results && (
                <button
                  type="button"
                  onClick={() => onUpdateState((d) => { d.scout = null; })}
                  className="btn btn-xs btn-ghost"
                >
                  ✕ ปิดรายงาน
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
              {state.scout?.results ? (
                state.scout.results.map((q, i) => {
                  const blockedByWindow = !tx.tw.open && !q.free;
                  return (
                    <div key={`${q.n}-${i}`} className="flex items-center gap-3 mland:gap-2 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/50 transition-colors">
                      <PlayerFace player={q} size={36} />
                      <button type="button" onClick={() => onInspectPlayer(q, null)} className="flex-1 min-w-0 text-left cursor-pointer">
                        <div className="font-bold text-xs sm:text-[13px] mland:text-[10.5px] truncate leading-tight flex items-center gap-1.5">
                          <PositionBadge role={q.ro} size="xs" />
                          <span className="truncate">{q.n}</span>
                        </div>
                        <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate mt-0.5 flex items-center gap-1">
                          <span>{SPN[q.ro] || q.pos} · อายุ {q.age} ปี ·</span>
                          <PotentialBadge pot={q.pot} variant="inline" size="xs" />
                          <span>· {q.free ? 'ฟรีเอเยนต์' : fmtMoneyNum(q.price || 0)}</span>
                        </div>
                        <PlayerBioStrip bio={getPlayerBio(q)} variant="inline" className="mt-0.5" />
                      </button>
                      <span className="w-9 mland:w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                        {q.ov}
                      </span>
                      <button
                        type="button"
                        disabled={!!q.locked || blockedByWindow}
                        onClick={() => openNegotiation('scout', i, q)}
                        className={`btn btn-sm shrink-0 ${
                          blockedByWindow ? 'btn-secondary text-[var(--mut)]' : 'btn-primary'
                        }`}
                      >
                        {q.locked ? 'เจรจาล่ม' : blockedByWindow ? '🔒 ปิดตลาด' : 'เจรจา'}
                      </button>
                    </div>
                  );
                })
              ) : state.scout ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-1.5">
                  <div className="text-2xl opacity-75">⏳</div>
                  <div className="text-xs sm:text-sm mland:text-xs font-bold">กำลังติดตามฟอร์มนักเตะ ({state.scout.label})</div>
                  <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs tabular">
                    รายงานจะพร้อมในอีก {state.scout.turnsLeft} นัด · ใช้ได้ตลอดปีแม้ช่วงปิดตลาด
                  </p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-1.5">
                  <div className="text-2xl opacity-75">🔎</div>
                  <div className="text-xs sm:text-sm mland:text-xs font-bold">ยังไม่มีรายงานแมวมอง</div>
                  <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs">
                    เลือกเป้าหมายหรือตำแหน่งที่ต้องการทางด้านซ้าย เพื่อส่งแมวมองไปค้นหานักเตะศักยภาพสูง
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* SECTION 4: CONTRACTS, LOAN BUYOUTS & YOUTH ACADEMY (Clean 2-Column Layout) */}
      {activeTab === 'con' && (
        <div className="grid grid-cols-[1.08fr_0.92fr] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
          {/* Left: First-Team Contracts */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/30 flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">📋 สัญญานักเตะ ({displayedContracts.length})</h3>
                <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] hidden sm:inline mland:inline truncate">
                  ≤ 1 ปี ควรรีบต่อก่อนหมด
                </span>
              </div>

              <div className="seg-bar shrink-0">
                <button
                  type="button"
                  onClick={() => setContractFilter('all')}
                  className={`seg-btn ${
                    contractFilter === 'all' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : ''
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setContractFilter('expiring')}
                  className={`seg-btn tabular ${
                    contractFilter === 'expiring' ? 'seg-btn-active' : ''
                  }`}
                >
                  ใกล้หมด ({expiringCount})
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
              {displayedContracts.length > 0 ? (
                displayedContracts.map(({ q, i, c }) => (
                  <div key={q.n} className="flex items-center gap-2.5 px-3.5 py-2 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/40 transition-colors">
                    <PlayerFace player={q} team={me} state={state} size={34} />
                    <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                      <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight flex items-center gap-1">
                        <PositionBadge role={q.ro} size="xs" />
                        <span className="truncate">{q.n}</span>{' '}
                        <span className={c.yr <= 1 ? 'text-[var(--red)] font-bold' : 'text-[#9a6700] dark:text-[var(--lamp)] font-semibold'}>
                          · {c.yr <= 0 ? 'หมดสัญญา!' : `เหลือ ${c.yr} ปี`}
                        </span>
                      </div>
                      <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate mt-0.5">
                        {ROLE_L[c.role]} · ค่าเหนื่อย {fmtMoneyNum(c.wg)}/นัด
                      </div>
                    </button>
                    <span className="w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                      {q.ov}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRenewIdx(i);
                        setRenewYr(Math.max(2, c.yr + 2 > 5 ? 3 : c.yr + 2));
                        setRenewRole(c.role);
                        setRenewWb(1);
                        setRenewMsg('');
                      }}
                      className={`btn btn-sm shrink-0 ${
                        c.yr <= 1 ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      ต่อสัญญา
                    </button>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-1.5">
                  <div className="text-2xl opacity-75">✅</div>
                  <div className="text-xs font-bold">ไม่มีนักเตะที่สัญญาใกล้หมด</div>
                  <button
                    type="button"
                    onClick={() => setContractFilter('all')}
                    className="btn btn-sm btn-secondary"
                  >
                    แสดงสัญญาทั้งหมด
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Right: Loan Buyouts & Youth Academy */}
          <div className="flex flex-col min-h-0 gap-2.5 mland:gap-2 overflow-hidden">
            {loanPlayers.length > 0 && (
              <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col shrink-0 max-h-[42%] overflow-hidden">
                <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/30 flex items-center justify-between gap-2">
                  <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">📌 ออปชันซื้อขาดนักเตะยืมตัว</h3>
                  <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">{loanPlayers.length} คน</span>
                </div>
                <div className="overflow-y-auto divide-y divide-[var(--line)]/60">
                  {loanPlayers.map(({ q, i }) => (
                    <div key={q.n} className="flex items-center gap-2.5 px-3 py-2 mland:px-2.5 mland:py-1.5">
                      <PlayerFace player={q} team={me} state={state} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs mland:text-[10.5px] truncate flex items-center gap-1">
                          <PositionBadge role={q.ro} size="xs" />
                          <span className="truncate">{q.n}</span>
                        </div>
                        <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">ค่าฉีกซื้อขาด {fmtMoney(q.loanOpt || 0)}</div>
                      </div>
                      <button
                        type="button"
                        disabled={!tx.tw.open || state.money < (q.loanOpt || 0)}
                        onClick={() => {
                          const cost = q.loanOpt || 0;
                          onUpdateState((d) => {
                            d.money -= cost;
                            logFin(d, `ใช้ออปชันซื้อขาด ${q.n}`, -cost);
                            const target = d.teams[d.me].sq[i];
                            delete target.loan;
                            delete target.loanOpt;
                            target.signedSeason = d.season;
                            target.signedMd = d.md;
                            target.con = { yr: 3, wg: wagOf(target), role: target.ov >= 70 ? 'key' : 'rot' };
                            appendPlayerCareerLog(target, `🤝 เซ็นสัญญาถาวรกับ ${d.teams[d.me].name} ซีซั่น ${d.season}`);
                          });
                          onToast(`ซื้อขาด ${q.n} ถาวรแล้ว!`);
                        }}
                        className="btn btn-sm btn-primary shrink-0"
                      >
                        {!tx.tw.open ? '🔒 รอตลาดเปิด' : `ซื้อขาด ${fmtMoneyNum(q.loanOpt || 0)}`}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/30 flex items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">🌱 เด็กเยาวชนอะคาเดมี่ ({state.yth?.length || 0})</h3>
                <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] whitespace-nowrap">เซ็นฟรีตลอดปี</span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
                {(state.yth || []).length ? (
                  state.yth.map((q, i) => (
                    <div key={q.n} className="flex items-center gap-2.5 px-3 py-2 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/40 transition-colors">
                      <PlayerFace player={q} team={me} state={state} size={34} />
                      <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                        <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight flex items-center gap-1">
                          <PositionBadge role={q.ro} size="xs" />
                          <span className="truncate">{q.n}</span>
                        </div>
                        <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate mt-0.5 flex items-center gap-1">
                          <span>อายุ {q.age} ปี ·</span>
                          <PotentialBadge pot={q.pot} variant="inline" size="xs" />
                          <span>· ค่าเหนื่อย ~{fmtMoneyNum(wagOf(q))}</span>
                        </div>
                        <PlayerBioStrip bio={getPlayerBio(q)} variant="inline" className="mt-0.5" />
                      </button>
                      <span className="w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                        {q.ov}
                      </span>
                      <button
                        type="button"
                        disabled={me.sq.length >= tx.maxSquad || tx.curWage + wagOf(q) > tx.wageCap}
                        onClick={() => {
                          onUpdateState((d) => {
                            const t = d.teams[d.me];
                            const y = d.yth[i];
                            if (!y || t.sq.length >= LEAGUE_TRANSFER_RULES.maxSquad) return;
                            y.con = { yr: 3, wg: wagOf(y), role: 'pro' };
                            y.no = undefined;
                            y.signedSeason = d.season;
                            y.signedMd = d.md;
                            appendPlayerCareerLog(y, `🎓 เลื่อนชั้นจากอะคาเดมี่สู่ชุดใหญ่ ${t.name} ซีซั่น ${d.season}`);
                            t.sq.push(y);
                            assignTeamShirtNumbers(t);
                            d.yth.splice(i, 1);
                          });
                          onToast(`เซ็นเยาวชน ${q.n} สัญญา 3 ปี`);
                        }}
                        className="btn btn-sm btn-secondary shrink-0"
                      >
                        เซ็น 3 ปี
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-1.5">
                    <div className="text-2xl opacity-75">🌱</div>
                    <div className="text-xs font-bold">ยังไม่มีเยาวชนชุดใหม่ในรอบนี้</div>
                    <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs">
                      ปลายซีซั่นจะมีเด็กเยาวชนชุดใหม่เข้ามา (อัปเกรดอะคาเดมี่เพื่อรับเด็กฝีเท้าดีขึ้น)
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {renderNegotiationModal()}
      {renderRenewModal()}
      {sellModalNames && sellModalNames.length > 0 && (
        <SquadSellModal
          state={state}
          team={me}
          playerNames={sellModalNames}
          onClose={() => setSellModalNames(null)}
          onUpdateState={onUpdateState}
          onClearSelection={(soldNames) =>
            setSelectedSellNames((prev) => prev.filter((name) => !soldNames.includes(name)))
          }
          onToast={onToast}
        />
      )}
    </div>
  );
};
