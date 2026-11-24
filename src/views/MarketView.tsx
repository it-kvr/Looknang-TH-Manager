import React, { useEffect, useMemo, useState } from 'react';
import type { SubRole, MainTab, Player, Team, ScoutMission, GameState } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { TN, LINE, SPX, ALL_SUB_ROLES, SPN, ROLE_L } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { assignTeamShirtNumbers, vlu, wagOf, ensureCon, logFin } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import { appendPlayerCareerLog } from '../engine/history';
import {
  LEAGUE_TRANSFER_RULES,
  getLeagueTransferContext,
  mkMarket,
  createScoutMission,
  getIncomingOffers,
  removeIncomingOffer,
  getPlayerSellCheck,
  canAcceptTransferOffer,
  acceptTransferOffer,
  resolveCounterOfferOutcome,
  applyCounterOfferOutcome,
  resolvePitchPlayerOutcome,
  applyPitchPlayerOutcome
} from '../engine/simulation';
import { PlayerFace } from '../components/SvgVisuals';
import { PitchPlayerModal } from '../modals/TacticsModals';

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

export const MarketView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team | null) => void;
  onToast: (msg: string) => void;
  navIntent?: { tab: MainTab; sub?: string; ts: number } | null;
}> = ({ state, onUpdateState, onInspectPlayer, onToast, navIntent }) => {
  const me = state.teams[state.me];
  const tx = getLeagueTransferContext(state, me);
  const [marketSource, setMarketSource] = useState<'mk' | 'club'>('mk');
  const [filter, setFilter] = useState<'ALL' | 'GK' | 'DF' | 'MF' | 'FW' | 'FREE'>('ALL');
  const [subFilter, setSubFilter] = useState<'ALL' | SubRole>('ALL');
  const [sortBy, setSortBy] = useState<'default' | 'ov_desc' | 'price_asc' | 'age_asc'>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [clubTierFilter, setClubTierFilter] = useState<'ALL' | 'MY_TIER'>('MY_TIER');
  const [scoutRole, setScoutRole] = useState<SubRole | ''>('');
  const [offerDraft, setOfferDraft] = useState<OfferDraft | null>(null);
  const [pitchTargetName, setPitchTargetName] = useState<string | null>(null);
  const [quickListName, setQuickListName] = useState('');
  const [renewIdx, setRenewIdx] = useState<number | null>(null);
  const [renewYr, setRenewYr] = useState(3);
  const [renewRole, setRenewRole] = useState<'key' | 'rot' | 'pro'>('rot');
  const [renewWb, setRenewWb] = useState<0 | 1 | 2>(1);
  const [renewMsg, setRenewMsg] = useState('');
  const [rightTab, setRightTab] = useState<'sell' | 'scout' | 'con'>('sell');

  useEffect(() => {
    if (navIntent?.tab === 'k' && (navIntent.sub === 'sell' || navIntent.sub === 'scout' || navIntent.sub === 'con')) {
      setRightTab(navIntent.sub);
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

  const clubMarketList = useMemo(() => {
    const items: { q: Player; team: Team; idx: number; price: number }[] = [];
    state.teams.forEach((t) => {
      if (t.id === state.me) return;
      if (clubTierFilter === 'MY_TIER' && Math.abs(t.tier - me.tier) > 1) return;
      t.sq.forEach((q, idx) => {
        if (q.me || q.loan) return;
        const lineOk = filter === 'ALL' || filter === 'FREE' || q.pos === filter;
        const subOk = subFilter === 'ALL' || q.ro === subFilter;
        const searchOk =
          !normalizedQuery ||
          q.n.toLowerCase().includes(normalizedQuery) ||
          t.name.toLowerCase().includes(normalizedQuery) ||
          q.ro.toLowerCase().includes(normalizedQuery);
        if (!lineOk || !subOk || !searchOk) return;
        items.push({ q, team: t, idx, price: Math.max(8, vlu(q)) });
      });
    });
    const sorted = items.sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price || b.q.ov - a.q.ov;
      if (sortBy === 'age_asc') return a.q.age - b.q.age || b.q.ov - a.q.ov;
      return b.q.ov - a.q.ov;
    });
    return sorted.slice(0, 60);
  }, [state.teams, state.me, me.tier, clubTierFilter, filter, subFilter, sortBy, normalizedQuery]);

  const loanPlayers = me.sq.map((q, i) => ({ q, i })).filter(({ q }) => q.loan && q.loanOpt);
  const contractList = me.sq
    .map((q, i) => ({ q, i, c: ensureCon(q) }))
    .filter(({ q }) => !q.loan)
    .sort((a, b) => a.c.yr - b.c.yr || b.q.ov - a.q.ov);

  const incomingOffers = getIncomingOffers(state);
  const listedPlayers = me.sq.filter((q) => q.listed && !q.loan);
  const unlistedEligible = me.sq
    .filter((q) => !q.listed && !q.loan)
    .slice()
    .sort((a, b) => b.ov - a.ov);
  const expiringCount = me.sq.filter((q) => !q.loan && ensureCon(q).yr <= 1).length;
  const activeCount = marketSource === 'mk' ? marketList.length : clubMarketList.length;

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
          const mIdx = srcList[offerDraft.idx] ? offerDraft.idx : srcList.findIndex((p) => p.n === (offerDraft.playerName || q.n));
          if (mIdx >= 0) {
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
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden" onClick={() => setOfferDraft(null)}>
        <div className="w-full max-w-3xl max-h-[92dvh] mland:max-h-[95dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="shrink-0 flex items-center gap-3 mland:gap-2 px-3.5 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
            <PlayerFace player={q} team={sellerTeam} state={state} size={44} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm sm:text-base mland:text-xs truncate">
                {q.n} <span className="text-xs mland:text-[10px] text-[var(--g)]">({q.ro} · {SPN[q.ro] || q.pos})</span>
              </div>
              <div className="text-[11px] sm:text-xs mland:text-[10px] text-[var(--mut)] truncate tabular">
                {sellerTeam ? `${sellerTeam.name} · ` : ''}อายุ {q.age} ปี · {q.free ? <b className="text-[var(--g)]">ฟรีเอเยนต์</b> : `ค่าตัว ${fmtMoney(q.price || 0)}`} · ค่าเหนื่อย ~{fmtMoneyNum(q.askWg || wagOf(q))}
              </div>
            </div>
            <span className="px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-xl text-white font-bold text-sm mland:text-xs tabular shrink-0" style={{ background: ovColor(q.ov) }}>
              {q.ov}
            </span>
            <button
              type="button"
              onClick={() => setOfferDraft(null)}
              aria-label="ปิดหน้าต่างเจรจา"
              className="w-8 h-8 mland:w-7 mland:h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer shrink-0 hover:border-[var(--g)]"
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
                        className={`px-3 py-1.5 mland:px-2.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-semibold whitespace-nowrap cursor-pointer disabled:opacity-40 transition-colors ${
                          offerDraft.type === k ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface-2)] hover:bg-[var(--line)]/50'
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
                        className={`py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-semibold tabular whitespace-nowrap cursor-pointer transition-colors ${
                          offerDraft.pct === p ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface-2)] hover:bg-[var(--line)]/50'
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
                        className={`py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-semibold whitespace-nowrap cursor-pointer ${
                          offerDraft.yr === y ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface-2)]'
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
                      className={`py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-semibold whitespace-nowrap cursor-pointer ${
                        offerDraft.role === k ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface-2)]'
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
                      className={`py-1.5 mland:py-1 px-1 rounded-lg text-xs mland:text-[10px] font-semibold whitespace-nowrap cursor-pointer truncate ${
                        offerDraft.wb === k ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface-2)]'
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
                    <button type="button" onClick={() => submitOffer(true)} className="w-full px-3 py-1.5 mland:py-1 rounded-lg bg-[var(--g)] text-white font-bold cursor-pointer">
                      ✅ ตกลงตามข้อเสนอสวน ({fmtMoneyNum(offerDraft.counter.cashNow)} · {fmtMoneyNum(offerDraft.counter.wg)}/นัด)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 p-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
            <button type="button" onClick={() => setOfferDraft(null)} className="px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] font-semibold text-sm mland:text-xs cursor-pointer whitespace-nowrap">
              ปิด
            </button>
            <button
              type="button"
              disabled={!canAfford || !needSwapOk || fullSq || loanCapHit || wageOverCap || !!q.locked}
              onClick={() => submitOffer(false)}
              className="flex-1 py-2 mland:py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-sm mland:text-xs disabled:opacity-40 cursor-pointer"
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
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden" onClick={() => setRenewIdx(null)}>
        <div className="w-full max-w-2xl max-h-[92dvh] mland:max-h-[96dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="shrink-0 flex items-center gap-3 px-3.5 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
            <PlayerFace player={q} team={me} state={state} size={42} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm mland:text-xs truncate">📋 ต่อสัญญา · {q.n}</div>
              <div className="text-xs mland:text-[10.5px] text-[var(--mut)] tabular">
                เหลือสัญญา <b>{con.yr} ปี</b> · ค่าเหนื่อยเดิม {fmtMoneyNum(con.wg)}/นัด
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-white font-bold text-xs tabular shrink-0" style={{ background: ovColor(q.ov) }}>
              {q.ov}
            </span>
            <button
              type="button"
              onClick={() => setRenewIdx(null)}
              aria-label="ปิดหน้าต่างต่อสัญญา"
              className="w-8 h-8 mland:w-7 mland:h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer shrink-0 hover:border-[var(--g)]"
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
                    <button key={y} type="button" onClick={() => setRenewYr(y)} className={`py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-semibold whitespace-nowrap cursor-pointer ${renewYr === y ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>
                      {y} ปี
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1">บทบาทในทีม</div>
                <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                  {([['key', '⭐ ตัวหลัก'], ['rot', '🔄 หมุนเวียน'], ['pro', '🌱 ดาวรุ่ง']] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setRenewRole(k)} className={`py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-semibold whitespace-nowrap cursor-pointer ${renewRole === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>
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
                    <button key={k} type="button" onClick={() => setRenewWb(k)} className={`px-1.5 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-semibold whitespace-nowrap truncate cursor-pointer ${renewWb === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>
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
            <button type="button" onClick={() => setRenewIdx(null)} className="px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] font-semibold text-xs cursor-pointer whitespace-nowrap">
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
              className="flex-1 py-2 mland:py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-xs disabled:opacity-40 cursor-pointer"
            >
              {renewOverCap ? `เกินเพดาน ${fmtMoneyNum(tx.wageCap)}` : `✅ ยืนยันต่อสัญญา (${fmtMoneyNum(newWg)}/นัด${bonus ? `, โบนัส ${fmtMoneyNum(bonus)}` : ''})`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Compact Executive Transfer Status Strip */}
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

        <div className="flex items-center gap-x-2 mland:gap-x-1.5 text-xs mland:text-[10px] text-[var(--mut)] tabular whitespace-nowrap overflow-x-auto">
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

      {/* Main Two-Column Transfer Workspace */}
      <div className="grid grid-cols-[1.15fr_0.85fr] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
        {/* LEFT PANE: Market & League Clubs Browser */}
        <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 p-2.5 mland:p-2 border-b border-[var(--line)] space-y-2 mland:space-y-1.5 bg-[var(--surface-2)]/30">
            {/* Row 1: Source Switcher + Quick Search + Context Action */}
            <div className="flex items-center gap-1.5">
              <div className="grid grid-cols-2 p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] shrink-0">
                <button
                  type="button"
                  onClick={() => setMarketSource('mk')}
                  className={`px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-lg mland:rounded-md text-xs mland:text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    marketSource === 'mk' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  🏪 ตลาดกลาง
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarketSource('club');
                    if (filter === 'FREE') setFilter('ALL');
                  }}
                  className={`px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-lg mland:rounded-md text-xs mland:text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    marketSource === 'club' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  🏟️ สโมสรในลีก
                </button>
              </div>

              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={marketSource === 'club' ? 'ค้นชื่อนักเตะ หรือสโมสร...' : 'ค้นชื่อ หรือตำแหน่ง...'}
                  aria-label="ค้นหานักเตะ"
                  className="w-full pl-2.5 pr-6 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] focus:outline-none focus:border-[var(--g)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="ล้างคำค้นหา"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {marketSource === 'mk' ? (
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
                  className="px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-xs mland:text-[10px] font-semibold whitespace-nowrap disabled:opacity-40 cursor-pointer shrink-0 transition-colors"
                >
                  🔄 หาใหม่ {fmtMoneyNum(15)}
                </button>
              ) : (
                <div className="flex p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] shrink-0">
                  <button
                    type="button"
                    onClick={() => setClubTierFilter('MY_TIER')}
                    className={`px-2 py-0.5 rounded-md text-[11px] mland:text-[9.5px] font-semibold whitespace-nowrap cursor-pointer ${
                      clubTierFilter === 'MY_TIER' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'
                    }`}
                  >
                    ลีกใกล้เคียง
                  </button>
                  <button
                    type="button"
                    onClick={() => setClubTierFilter('ALL')}
                    className={`px-2 py-0.5 rounded-md text-[11px] mland:text-[9.5px] font-semibold whitespace-nowrap cursor-pointer ${
                      clubTierFilter === 'ALL' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'
                    }`}
                  >
                    ทุกลีก
                  </button>
                </div>
              )}
            </div>

            {/* Row 2: Line Tabs + SubRole Select + Sort Select + Count */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
                {([['ALL', 'ทั้งหมด'], ['GK', 'GK'], ['DF', 'หลัง'], ['MF', 'กลาง'], ['FW', 'หน้า'], ...(marketSource === 'mk' ? [['FREE', 'ฟรี'] as const] : [])] as const).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setFilter(k);
                      setSubFilter('ALL');
                    }}
                    className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      filter === k ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <select
                  aria-label="กรองตำแหน่งย่อย"
                  value={subFilter}
                  onChange={(e) => setSubFilter(e.target.value as 'ALL' | SubRole)}
                  className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-semibold cursor-pointer max-w-[110px]"
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
                  className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-semibold cursor-pointer"
                >
                  <option value="default">แนะนำ</option>
                  <option value="ov_desc">OVR สูง</option>
                  <option value="price_asc">ค่าตัวถูก</option>
                  <option value="age_asc">อายุน้อย</option>
                </select>

                <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular whitespace-nowrap pl-0.5">
                  {activeCount} คน
                </span>
              </div>
            </div>
          </div>

          {/* Scrollable Player List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
            {marketSource === 'mk' ? (
              marketList.length > 0 ? (
                marketList.map(({ q, i }) => {
                  const blockedByWindow = !tx.tw.open && !q.free;
                  return (
                    <div
                      key={`${q.n}-${i}`}
                      className={`flex items-center gap-2.5 mland:gap-2 px-3 py-2 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/60 transition-colors ${blockedByWindow ? 'opacity-70' : ''}`}
                    >
                      <div className="shrink-0 [&>svg]:w-9 [&>svg]:h-9 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                        <PlayerFace player={q} size={36} />
                      </div>
                      <button type="button" onClick={() => onInspectPlayer(q, null)} className="flex-1 min-w-0 text-left cursor-pointer">
                        <div className="font-bold text-xs mland:text-[11px] truncate leading-tight">
                          <span className="text-[var(--g)] mr-1">{q.ro}</span>
                          {q.n}
                          {q.free ? (
                            <span className="ml-1.5 text-[10.5px] mland:text-[9.5px] text-[var(--g)] font-bold">· ฟรีเอเยนต์</span>
                          ) : q.age <= 19 ? (
                            <span className="ml-1.5 text-[10.5px] mland:text-[9.5px] text-[#9a6700] dark:text-[var(--lamp)] font-bold">· ดาวรุ่ง</span>
                          ) : null}
                        </div>
                        <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate tabular leading-tight mt-0.5">
                          {SPN[q.ro] || q.pos} · อายุ {q.age} · ศักยภาพ {q.pot || q.ov} · ค่าเหนื่อย ~{fmtMoneyNum(q.askWg || wagOf(q))}
                        </div>
                      </button>
                      <span className="w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                        {q.ov}
                      </span>
                      <button
                        type="button"
                        disabled={!!q.locked || blockedByWindow}
                        onClick={() => openNegotiation('mk', i, q)}
                        className={`min-w-[84px] mland:min-w-[72px] px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl text-xs mland:text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 transition-colors ${
                          blockedByWindow ? 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--mut)]' : 'bg-[var(--g)] hover:brightness-110 text-white'
                        }`}
                      >
                        {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิดตลาด' : q.free ? 'เซ็นฟรี' : `ยื่น ${fmtMoneyNum(q.price || 0)}`}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-[var(--mut)]">ไม่พบนักเตะตามเงื่อนไขที่เลือก</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilter('ALL');
                      setSubFilter('ALL');
                      setSortBy('default');
                      setSearchQuery('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold cursor-pointer"
                  >
                    ล้างตัวกรอง
                  </button>
                </div>
              )
            ) : clubMarketList.length > 0 ? (
              clubMarketList.map(({ q, team, idx, price }) => {
                const blockedByWindow = !tx.tw.open;
                return (
                  <div
                    key={`${team.id}-${q.n}-${idx}`}
                    className={`flex items-center gap-2.5 mland:gap-2 px-3 py-2 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/60 transition-colors ${blockedByWindow ? 'opacity-70' : ''}`}
                  >
                    <div className="shrink-0 [&>svg]:w-9 [&>svg]:h-9 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                      <PlayerFace player={q} team={team} state={state} size={36} />
                    </div>
                    <button type="button" onClick={() => onInspectPlayer(q, team)} className="flex-1 min-w-0 text-left cursor-pointer">
                      <div className="font-bold text-xs mland:text-[11px] truncate leading-tight">
                        <span className="text-[var(--g)] mr-1">{q.ro}</span>
                        {q.n}
                      </div>
                      <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate tabular leading-tight mt-0.5">
                        {team.name} ({TN[team.tier]}) · {SPN[q.ro] || q.pos} · อายุ {q.age}
                      </div>
                    </button>
                    <span className="w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                      {q.ov}
                    </span>
                    <button
                      type="button"
                      disabled={!!q.locked || blockedByWindow}
                      onClick={() => openNegotiation('club', idx, q, team)}
                      className={`min-w-[84px] mland:min-w-[72px] px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl text-xs mland:text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 transition-colors ${
                        blockedByWindow ? 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--mut)]' : 'bg-[var(--g)] hover:brightness-110 text-white'
                      }`}
                    >
                      {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิดตลาด' : `ยื่น ~${fmtMoneyNum(price)}`}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs text-[var(--mut)]">ไม่พบนักเตะในสโมสรอื่นตามตัวกรอง</p>
                <button
                  type="button"
                  onClick={() => {
                    setFilter('ALL');
                    setSubFilter('ALL');
                    setClubTierFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold cursor-pointer"
                >
                  ดูทุกลีกทั้งหมด
                </button>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANE: Unified Tabbed Club Deals, Scouting & Contracts */}
        <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 p-2 mland:p-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/30">
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
              {([
                ['sell', `🏷️ ขาย/ดีล${incomingOffers.length ? ` (${incomingOffers.length})` : ''}`],
                ['scout', `🔍 แมวมอง${state.scout?.results ? ' (พร้อม)' : state.scout ? ' (...)' : ''}`],
                ['con', `📋 สัญญา${expiringCount + loanPlayers.length ? ` (${expiringCount + loanPlayers.length})` : ''}`]
              ] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRightTab(k)}
                  className={`py-1.5 mland:py-1 px-1.5 rounded-lg text-xs mland:text-[10px] font-bold whitespace-nowrap truncate cursor-pointer transition-colors ${
                    rightTab === k ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 mland:p-2 space-y-3 mland:space-y-2">
            {/* TAB 1: INCOMING OFFERS & TRANSFER LISTING */}
            {rightTab === 'sell' && (
              <>
                {incomingOffers.length > 0 && (
                  <div className="rounded-xl border border-[var(--lamp)]/80 bg-[var(--lamp-soft)]/55 overflow-hidden">
                    <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--lamp)]/40 flex items-center justify-between text-xs sm:text-sm mland:text-[11px] font-bold">
                      <span>💼 ข้อเสนอซื้อนักเตะเข้าทีม</span>
                      <span className="tabular text-[#8a5b00] dark:text-[var(--lamp)]">{incomingOffers.length} รายการ</span>
                    </div>
                    <div className="divide-y divide-[var(--line)]/70 bg-[var(--surface)]">
                      {incomingOffers.map((off) => {
                        const targetQ = me.sq.find((q) => q.n === off.n);
                        if (!targetQ) return null;
                        const marketVal = vlu(targetQ);
                        const buyerTeam =
                          (off.teamId != null ? state.teams.find((t) => t.id === off.teamId) : undefined) ||
                          state.teams.find((t) => t.name === off.t);
                        return (
                          <div key={`${off.n}__${off.t}`} className="p-2.5 mland:p-2 space-y-2 mland:space-y-1.5">
                            <div className="flex items-center gap-2">
                              <PlayerFace player={targetQ} team={me} state={state} size={32} />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs mland:text-[10.5px] font-bold truncate leading-tight">
                                  {off.t}
                                  {buyerTeam ? ` (${TN[buyerTeam.tier] || ''})` : ''}
                                </div>
                                <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate mt-0.5">
                                  ซื้อ <b className="text-[var(--ink)]">{off.n}</b> ({targetQ.ro} · {targetQ.ov}) · ยื่น <b className="text-[var(--g)]">{fmtMoney(off.p)}</b> (ประเมิน {fmtMoneyNum(marketVal)})
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
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
                                className="px-2.5 py-1.5 mland:py-1 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold whitespace-nowrap cursor-pointer hover:brightness-105"
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
                                  className="px-2.5 py-1.5 mland:py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] font-bold whitespace-nowrap cursor-pointer hover:border-[var(--g)]"
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
                                className="px-2.5 py-1.5 mland:py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] font-semibold text-[var(--mut)] hover:text-[var(--red)] whitespace-nowrap cursor-pointer"
                              >
                                ✕ ปฏิเสธ
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2 mland:space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">🏷️ บัญชีขายของทีม ({listedPlayers.length})</h3>
                    <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] whitespace-nowrap">
                      {tx.tw.open ? 'ยื่นเสนอขายทีมอื่นได้' : 'รอตลาดเปิด'}
                    </span>
                  </div>

                  {unlistedEligible.length > 0 && (
                    <div className="flex gap-1.5">
                      <select
                        aria-label="เลือกนักเตะขึ้นบัญชีขาย"
                        value={quickListName}
                        onChange={(e) => setQuickListName(e.target.value)}
                        className="flex-1 min-w-0 px-2.5 py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10.5px] font-semibold"
                      >
                        <option value="">+ เลือกนักเตะขึ้นบัญชีขาย...</option>
                        {unlistedEligible.map((q) => (
                          <option key={q.n} value={q.n}>
                            {q.ro} · {q.n} (OVR {q.ov} · {fmtMoneyNum(vlu(q))})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!quickListName}
                        onClick={() => {
                          const targetName = quickListName;
                          if (!targetName) return;
                          SFX.tap();
                          onUpdateState((d) => {
                            const target = d.teams[d.me].sq.find((z) => z.n === targetName);
                            if (target) {
                              target.listed = 1;
                              target.askPrice = Math.max(5, vlu(target));
                            }
                          });
                          setQuickListName('');
                          onToast(`ขึ้นบัญชีขาย ${targetName} แล้ว`);
                        }}
                        className="px-3 py-1.5 mland:py-1 rounded-xl bg-[var(--lamp)] text-[#261900] text-xs mland:text-[10.5px] font-bold whitespace-nowrap cursor-pointer disabled:opacity-40 shrink-0"
                      >
                        ขึ้นตลาด
                      </button>
                    </div>
                  )}

                  {listedPlayers.length > 0 ? (
                    <div className="divide-y divide-[var(--line)]/60 rounded-xl border border-[var(--line)] overflow-hidden">
                      {listedPlayers.map((q) => {
                        const chk = getPlayerSellCheck(state, me, q);
                        const ask = q.askPrice || vlu(q);
                        return (
                          <div key={q.n} className="flex items-center gap-2 px-2.5 py-2 mland:p-1.5 bg-[var(--surface-2)]/30">
                            <PlayerFace player={q} team={me} state={state} size={32} />
                            <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                              <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight">
                                <span className="text-[var(--g)] mr-1">{q.ro}</span>
                                {q.n} <span className="text-[var(--mut)] tabular">({q.ov})</span>
                              </div>
                              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate mt-0.5">
                                ตั้งขาย {fmtMoney(ask)} · ประเมิน {fmtMoneyNum(vlu(q))}
                              </div>
                            </button>
                            <button
                              type="button"
                              title={chk.pitchedThisTurn ? 'เสนอขายไปแล้วในนัดนี้' : chk.canPitch ? 'ส่งเสนอขายให้ทีมอื่น' : chk.reason}
                              onClick={() => {
                                if (!chk.canPitch) {
                                  onToast(chk.reason || 'ยังไม่สามารถเสนอขายได้');
                                  return;
                                }
                                if (chk.pitchedThisTurn) {
                                  onToast('เสนอขายคนนี้ไปแล้วในนัดนี้');
                                  return;
                                }
                                SFX.tap();
                                setPitchTargetName(q.n);
                              }}
                              className={`px-2.5 py-1.5 mland:py-1 rounded-lg border text-[11px] mland:text-[9.5px] font-bold whitespace-nowrap cursor-pointer ${
                                chk.canPitch && !chk.pitchedThisTurn
                                  ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                  : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] opacity-70'
                              }`}
                            >
                              {!tx.tw.open ? '🔒 รอตลาด' : chk.pitchedThisTurn ? 'รอนัดหน้า' : '📨 เสนอขาย'}
                            </button>
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
                              className="px-2 py-1.5 mland:py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)] hover:text-[var(--red)] whitespace-nowrap cursor-pointer"
                            >
                              ถอด
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-[var(--line)] text-center text-xs mland:text-[10.5px] text-[var(--mut)]">
                      ยังไม่มีนักเตะในบัญชีขาย เลือกนักเตะด้านบนเพื่อตั้งขายและส่งเสนอสโมสรอื่น
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 2: SCOUTING HUB */}
            {rightTab === 'scout' && (
              <div className="space-y-3 mland:space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">🔍 แมวมองหานักเตะ</h3>
                  <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">ค่าส่ง {fmtMoneyNum(20)} · รอ 2 นัด · ใช้ได้ตลอดปี</span>
                </div>

                {!state.scout ? (
                  <div className="space-y-2.5 mland:space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 mland:grid-cols-2 gap-1.5">
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
                          className="px-2.5 py-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-xs mland:text-[10.5px] font-semibold text-left whitespace-nowrap disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[var(--line)]/70 space-y-1.5">
                      <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">หรือระบุตำแหน่งย่อยเจาะจง</div>
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label="เลือกตำแหน่งเจาะจงให้แมวมอง"
                          value={scoutRole}
                          onChange={(e) => setScoutRole(e.target.value as SubRole | '')}
                          className="flex-1 min-w-0 px-2.5 py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10.5px] font-semibold"
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
                          className="px-3 py-1.5 mland:py-1 rounded-xl bg-[var(--g)] text-white text-xs mland:text-[10.5px] font-bold whitespace-nowrap disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          ส่งเจาะจง
                        </button>
                      </div>
                    </div>
                  </div>
                ) : !state.scout.results ? (
                  <div className="p-3 mland:p-2.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 text-xs mland:text-[10.5px] space-y-1.5">
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span>⏳ แมวมองกำลังปฏิบัติภารกิจ</span>
                      <span className="tabular text-[#8a5b00] dark:text-[var(--lamp)]">เหลือ {state.scout.turnsLeft} นัด</span>
                    </div>
                    <p className="text-[var(--mut)]">
                      เป้าหมาย: <b className="text-[var(--ink)]">{state.scout.label}</b>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs mland:text-[10.5px]">
                      <span className="font-bold text-[var(--g)] truncate">รายงาน: {state.scout.label}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateState((d) => { d.scout = null; })}
                        className="text-[var(--mut)] hover:text-[var(--ink)] font-semibold whitespace-nowrap cursor-pointer"
                      >
                        ✕ ปิดรายงาน
                      </button>
                    </div>
                    <div className="divide-y divide-[var(--line)]/60 rounded-xl border border-[var(--g)]/35 overflow-hidden">
                      {state.scout.results.map((q, i) => {
                        const blockedByWindow = !tx.tw.open && !q.free;
                        return (
                          <div key={`${q.n}-${i}`} className="flex items-center gap-2 px-2.5 py-2 mland:p-1.5 bg-[var(--surface-2)]/30">
                            <PlayerFace player={q} size={32} />
                            <button type="button" onClick={() => onInspectPlayer(q, null)} className="flex-1 min-w-0 text-left cursor-pointer">
                              <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight">
                                <span className="text-[var(--g)] mr-1">{q.ro}</span>
                                {q.n}
                              </div>
                              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate mt-0.5">
                                {SPN[q.ro] || q.pos} · อายุ {q.age} · ศักยภาพ {q.pot} · {q.free ? 'ฟรี' : fmtMoneyNum(q.price || 0)}
                              </div>
                            </button>
                            <span className="w-8 text-center py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                              {q.ov}
                            </span>
                            <button
                              type="button"
                              disabled={!!q.locked || blockedByWindow}
                              onClick={() => openNegotiation('scout', i, q)}
                              className={`px-2.5 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 ${
                                blockedByWindow ? 'bg-[var(--surface)] border border-[var(--line)] text-[var(--mut)]' : 'bg-[var(--g)] text-white'
                              }`}
                            >
                              {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิดตลาด' : 'เจรจา'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CONTRACTS, LOAN BUYOUTS & YOUTH ACADEMY */}
            {rightTab === 'con' && (
              <div className="space-y-3 mland:space-y-2">
                {loanPlayers.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">📌 ออปชันซื้อขาดนักเตะยืมตัว</h3>
                    <div className="divide-y divide-[var(--line)]/60 rounded-xl border border-[var(--line)] overflow-hidden">
                      {loanPlayers.map(({ q, i }) => (
                        <div key={q.n} className="flex items-center gap-2 px-2.5 py-2 mland:p-1.5 bg-[var(--surface-2)]/30">
                          <PlayerFace player={q} team={me} state={state} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs mland:text-[10.5px] truncate">{q.pos} · {q.n}</div>
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
                            className="px-2.5 py-1.5 mland:py-1 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold whitespace-nowrap disabled:opacity-40 cursor-pointer"
                          >
                            {!tx.tw.open ? '🔒 รอตลาดเปิด' : `ซื้อขาด ${fmtMoneyNum(q.loanOpt || 0)}`}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">📋 สัญญานักเตะ ({contractList.length})</h3>
                    <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">≤ 1 ปี ควรรีบต่อก่อนหมด</span>
                  </div>
                  <div className="divide-y divide-[var(--line)]/60 rounded-xl border border-[var(--line)] overflow-hidden">
                    {contractList.map(({ q, i, c }) => (
                      <div key={q.n} className="flex items-center gap-2 px-2.5 py-2 mland:p-1.5 bg-[var(--surface-2)]/20">
                        <PlayerFace player={q} team={me} state={state} size={32} />
                        <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                          <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight">
                            <span className="text-[var(--g)] mr-1">{q.ro}</span>
                            {q.n}{' '}
                            <span className={c.yr <= 1 ? 'text-[var(--red)] font-bold' : 'text-[#9a6700] dark:text-[var(--lamp)] font-semibold'}>
                              · {c.yr <= 0 ? 'หมดสัญญา!' : `${c.yr} ปี`}
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
                          className={`px-2.5 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                            c.yr <= 1 ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)]'
                          }`}
                        >
                          ต่อสัญญา
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">🌱 เด็กเยาวชนอะคาเดมี่ ({state.yth?.length || 0})</h3>
                    <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">เซ็นฟรี · ดันขึ้นชุดใหญ่ได้ตลอดปี</span>
                  </div>
                  {(state.yth || []).length ? (
                    <div className="divide-y divide-[var(--line)]/60 rounded-xl border border-[var(--line)] overflow-hidden">
                      {state.yth.map((q, i) => (
                        <div key={q.n} className="flex items-center gap-2 px-2.5 py-2 mland:p-1.5 bg-[var(--surface-2)]/20">
                          <PlayerFace player={q} team={me} state={state} size={32} />
                          <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                            <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight">
                              <span className="text-[var(--g)] mr-1">{q.ro}</span>
                              {q.n}
                            </div>
                            <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate mt-0.5">
                              อายุ {q.age} ปี · ศักยภาพ {q.pot} · ค่าเหนื่อย ~{fmtMoneyNum(wagOf(q))}
                            </div>
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
                            className="px-2.5 py-1.5 mland:py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-xs mland:text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                          >
                            เซ็น 3 ปี
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-[var(--line)] text-center text-xs mland:text-[10.5px] text-[var(--mut)]">
                      ปลายซีซั่นจะมีเด็กเยาวชนชุดใหม่เข้ามา (อัปเกรดอะคาเดมี่เพื่อรับเด็กฝีเท้าดีขึ้น)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {renderNegotiationModal()}
      {renderRenewModal()}
      {pitchTargetName && (() => {
        const pitchPlayer = me.sq.find((z) => z.n === pitchTargetName);
        if (!pitchPlayer) return null;
        return (
          <PitchPlayerModal
            state={state}
            player={pitchPlayer}
            onClose={() => setPitchTargetName(null)}
            onConfirm={(askPct) => {
              const result = resolvePitchPlayerOutcome(state, pitchPlayer.n, askPct);
              setPitchTargetName(null);
              if (!result.ok) {
                onToast(result.err || 'เสนอขายไม่สำเร็จ');
                return;
              }
              onUpdateState((d) => applyPitchPlayerOutcome(d, pitchPlayer.n, result));
              if (result.offers.length > 0) {
                SFX.win();
                onToast(`มี ${result.offers.length} สโมสรยื่นข้อเสนอซื้อ ${pitchPlayer.n} แล้ว!`);
              } else {
                onToast(`ขึ้นบัญชีขาย ${pitchPlayer.n} แล้ว แต่รอบนี้ยังไม่มีทีมยื่นซื้อเข้ามาทันที`);
              }
            }}
          />
        );
      })()}
    </div>
  );
};
