import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Lock, RefreshCw, Search, SlidersHorizontal, Star, Trash2, Unlock, Users, X } from 'lucide-react';
import type { SubRole, MainTab, Player, Team, ScoutMission, GameState, TransferLogKind } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { TN, LINE, SPX, ALL_SUB_ROLES, SPN, ROLE_L, POS } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { assignTeamShirtNumbers, ensureClubIdentity, vlu, wagOf, ensureCon, logFin, listCreatedPlayersForManager, deleteCustomPlayer, pushFeed, getPlayerBio, dtInfo, xi, type CreatedPlayerCandidate } from '../engine/playerCore';
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
  validateBatchSquadRemoval,
  isPlayerShortlisted,
  toggleShortlistPlayer,
  removeShortlistPlayer,
  resolveShortlistEntry,
  getLoanedOutPlayers,
  recallLoanedOutPlayer,
  recordTransferLog,
  getSeasonTransferStats
} from '../engine/simulation';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { FootPairIcon, PlayerBioStrip, getFootColorMeta } from '../components/PlayerBioStrip';
import { PotentialBadge } from '../components/PotentialBadge';
import { PositionBadge } from '../components/PositionBadge';
import { TalentBadge } from '../components/TalentBadge';
import { StatIconBadge } from '../components/StatIconBadge';
import { AnimatedMoney } from '../components/AnimatedMoney';
import { TransferMarketIcon } from '../components/TransferMarketIcon';
import { OvrBadge } from '../components/OvrBadge';
import { PlayerStatusBadge } from '../components/PlayerStatusBadge';
import { getStaminaMeta } from '../components/StaminaBar';
import { getRatingPalette } from '../components/RatingBadge';
import { SortableColHeader } from '../components/SortableColHeader';
import { comparePlayerFitnessStatus, type SortDir } from '../utils/playerSort';
import { SquadSellModal, SquadLoanOutModal } from '../modals/SquadActionModals';

type MarketSortCol = 'default' | 'pos' | 'age' | 'ov' | 'fit' | 'price';

const comparePlayersByColumn = (
  a: Player,
  b: Player,
  col: MarketSortCol,
  dir: SortDir,
  priceA: number,
  priceB: number
): number => {
  if (col === 'pos') {
    const cmp = POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov;
    return dir === 'desc' ? -cmp : cmp;
  }
  if (col === 'age') {
    const cmp = a.age - b.age || b.ov - a.ov;
    return dir === 'desc' ? -cmp : cmp;
  }
  if (col === 'ov') {
    const cmp = b.ov - a.ov || (b.pot || b.ov) - (a.pot || a.ov);
    return dir === 'asc' ? -cmp : cmp;
  }
  if (col === 'fit') {
    return comparePlayerFitnessStatus(a, b, dir);
  }
  if (col === 'price') {
    const cmp = priceA - priceB || b.ov - a.ov;
    return dir === 'desc' ? -cmp : cmp;
  }
  return 0;
};

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
  addOnPct?: 0 | 5 | 10;
  swapIdx: number | null;
  msg: string;
  roundLog?: string[];
  counter?: ReturnType<typeof evalOffer> | null;
}

export function evalOffer(q: Player, st: OfferDraft, me: Team) {
  const p0 = q.price || vlu(q);
  const wgAsk = q.askWg || wagOf(q);
  const type = q.free ? 'free' : st.type;
  const yr = type === 'loan' || type === 'loanopt' ? 1 : st.yr;
  const role = st.role;
  const wb = st.wb;
  const addOnPct: 0 | 5 | 10 = st.addOnPct || 0;
  const wf = [0.85, 1, 1.2][wb];
  const sgBonus = wb === 2 ? Math.max(4, Math.round(q.ov / 8)) : 0;
  const swapQ = type === 'swap' && st.swapIdx != null ? me.sq[st.swapIdx] : null;
  const swapVal = swapQ ? Math.round(vlu(swapQ) * 0.8) : 0;
  const addOnCash = addOnPct > 0
    ? Math.max(type === 'free' ? 2 : 1, Math.round(((type === 'free' ? Math.max(20, q.ov * 0.5) : p0) * addOnPct) / 100))
    : 0;

  let cashNow = 0;
  let dueLater = 0;
  let loanOpt = 0;
  let clubScore = 0;

  if (type === 'free') {
    cashNow = sgBonus;
    dueLater = addOnCash;
    clubScore = 100;
  } else if (type === 'cash') {
    cashNow = Math.round((p0 * st.pct) / 100) + sgBonus;
    dueLater = addOnCash;
    clubScore = st.pct + (addOnPct === 10 ? 10 : addOnPct === 5 ? 5 : 0);
  } else if (type === 'inst') {
    cashNow = Math.round(((p0 * st.pct) / 100) * 0.55) + sgBonus;
    dueLater = Math.round(((p0 * st.pct) / 100) * 0.5) + addOnCash;
    clubScore = st.pct - 6 + (addOnPct === 10 ? 11 : addOnPct === 5 ? 6 : 0);
  } else if (type === 'swap') {
    cashNow = Math.max(0, Math.round((p0 * st.pct) / 100) - swapVal) + sgBonus;
    dueLater = addOnCash;
    clubScore = (swapQ ? 100 : 0) + (st.pct - 100) + (swapVal >= p0 * 0.45 ? 6 : 0) + (addOnPct === 10 ? 9 : addOnPct === 5 ? 5 : 0);
  } else if (type === 'loan') {
    cashNow = Math.max(3, Math.round(p0 * 0.24)) + sgBonus;
    dueLater = addOnCash;
    const loanOpen = st.source === 'club' ? (q.age <= 24 ? 92 : q.ov >= 78 ? 64 : 80) : 94;
    clubScore = loanOpen + (addOnPct === 10 ? 8 : addOnPct === 5 ? 4 : 0);
  } else if (type === 'loanopt') {
    cashNow = Math.max(4, Math.round(p0 * 0.28)) + sgBonus;
    dueLater = addOnCash;
    loanOpt = Math.round(p0 * 0.85);
    const loanOpen = st.source === 'club' ? (q.age <= 24 ? 94 : q.ov >= 78 ? 68 : 84) : 96;
    clubScore = loanOpen + (addOnPct === 10 ? 8 : addOnPct === 5 ? 4 : 0);
  }

  const roleBonus = role === 'key' ? 12 : role === 'rot' ? 2 : q.ov >= 68 ? -14 : 6;
  const yrBonus = q.age >= 30 ? (yr >= 3 ? 8 : -4) : yr >= 3 ? 6 : 0;
  const addOnPlayerBonus = type === 'free' ? (addOnPct === 10 ? 10 : addOnPct === 5 ? 5 : 0) : (addOnPct === 10 ? 4 : addOnPct === 5 ? 2 : 0);
  const plScore = 74 + (wf - 1) * 65 + roleBonus + yrBonus + addOnPlayerBonus + me.tier * 4;
  const clubPct = clamp(Math.round(clubScore - 10), 8, 99);
  const playerPct = clamp(Math.round(plScore - 6), 8, 99);
  const chance = clamp(Math.round(q.free ? plScore : clubScore * 0.55 + plScore * 0.45 - 18), 8, 98);
  const wg = +(wgAsk * wf).toFixed(1);

  return { type, pct: st.pct, yr, role, wb, addOnPct, addOnCash, wg, sgBonus, swapQ, swapVal, cashNow, dueLater, loanOpt, chance, clubPct, playerPct, p0 };
}

type MarketTab = 'buy' | 'shortlist' | 'sell' | 'scout' | 'con' | 'history';

export const MarketView = React.memo<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team | null) => void;
  onToast: (msg: string) => void;
  navIntent?: { tab: MainTab; sub?: string; ts: number } | null;
}>(({ state, onUpdateState, onInspectPlayer, onToast, navIntent }) => {
  const me = state.teams[state.me];
  const tx = getLeagueTransferContext(state, me);
  const clubK = ensureClubIdentity(state);

  const [activeTab, setActiveTab] = useState<MarketTab>('buy');
  const [marketSource, setMarketSource] = useState<'mk' | 'club' | 'created'>('mk');
  const [createdRefresh, setCreatedRefresh] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'GK' | 'DF' | 'MF' | 'FW' | 'FREE'>('ALL');
  const [loanOnlyFilter, setLoanOnlyFilter] = useState(false);
  const [ageRangeFilter, setAgeRangeFilter] = useState<'ALL' | 'u21' | 'prime' | 'vet'>('ALL');
  const [minOvFilter, setMinOvFilter] = useState<number>(0);
  const [maxBudgetFilter, setMaxBudgetFilter] = useState<'ALL' | 'AFFORD' | '15' | '35' | '70' | '120'>('ALL');
  const [subFilter, setSubFilter] = useState<'ALL' | SubRole>('ALL');
  const [buySortCol, setBuySortCol] = useState<MarketSortCol>('default');
  const [buySortDir, setBuySortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [clubTierFilter, setClubTierFilter] = useState<'ALL' | 'MY_TIER'>('MY_TIER');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [shortlistFilter, setShortlistFilter] = useState<'all' | 'ready' | 'free' | 'club'>('all');
  const [shortlistSortCol, setShortlistSortCol] = useState<MarketSortCol>('default');
  const [shortlistSortDir, setShortlistSortDir] = useState<SortDir>('desc');
  const [scoutSortCol, setScoutSortCol] = useState<MarketSortCol>('default');
  const [scoutSortDir, setScoutSortDir] = useState<SortDir>('desc');

  const [histSeason, setHistSeason] = useState<number | 'all'>(state.season);
  const [histScope, setHistScope] = useState<'all' | 'mine' | 'ai' | 'loan'>('all');
  const [histKind, setHistKind] = useState<'all' | 'perm' | 'free' | 'loan'>('all');
  const [histSearch, setHistSearch] = useState('');
  const [histSortClubs, setHistSortClubs] = useState<'net_desc' | 'spent_desc' | 'recv_desc' | 'net_asc'>('net_desc');

  const [scoutRole, setScoutRole] = useState<SubRole | ''>('');
  const [offerDraft, setOfferDraft] = useState<OfferDraft | null>(null);
  const [sellModalNames, setSellModalNames] = useState<string[] | null>(null);
  const [loanModalNames, setLoanModalNames] = useState<string[] | null>(null);
  const [offerFilter, setOfferFilter] = useState<'all' | 'buy' | 'loan'>('all');
  const [sellSubView, setSellSubView] = useState<'all' | 'listed' | 'loan_list' | 'loaned_out'>('all');
  const [sellPosFilter, setSellPosFilter] = useState<'ALL' | 'GK' | 'DF' | 'MF' | 'FW'>('ALL');
  const [sellSearch, setSellSearch] = useState('');
  const [sellSortCol, setSellSortCol] = useState<MarketSortCol>('default');
  const [sellSortDir, setSellSortDir] = useState<SortDir>('desc');
  const [selectedSellNames, setSelectedSellNames] = useState<string[]>([]);

  const toggleSortCol = (
    col: Exclude<MarketSortCol, 'default'>,
    curCol: MarketSortCol,
    setCol: React.Dispatch<React.SetStateAction<MarketSortCol>>,
    setDir: React.Dispatch<React.SetStateAction<SortDir>>
  ) => {
    if (curCol === col) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setCol(col);
    setDir(col === 'age' || col === 'price' || col === 'pos' ? 'asc' : 'desc');
  };
  const [contractFilter, setContractFilter] = useState<'all' | 'expiring'>('all');

  const [renewIdx, setRenewIdx] = useState<number | null>(null);
  const [renewYr, setRenewYr] = useState(3);
  const [renewRole, setRenewRole] = useState<'key' | 'rot' | 'pro'>('rot');
  const [renewWb, setRenewWb] = useState<0 | 1 | 2>(1);
  const [renewMsg, setRenewMsg] = useState('');

  useEffect(() => {
    if (navIntent?.tab !== 'k') return;
    if (
      navIntent.sub === 'sell' ||
      navIntent.sub === 'scout' ||
      navIntent.sub === 'con' ||
      navIntent.sub === 'buy' ||
      navIntent.sub === 'shortlist' ||
      navIntent.sub === 'history'
    ) {
      setActiveTab(navIntent.sub);
    } else if (navIntent.sub === 'club') {
      setActiveTab('buy');
      setMarketSource('club');
    } else if (navIntent.sub === 'loan') {
      setActiveTab('sell');
      setSellSubView('loaned_out');
    }
  }, [navIntent]);

  const availableSubRoles: SubRole[] = useMemo(() => {
    if (filter === 'GK' || filter === 'DF' || filter === 'MF' || filter === 'FW') return SPX[filter];
    return ALL_SUB_ROLES;
  }, [filter]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const maxBudgetCap = useMemo(() => {
    if (maxBudgetFilter === 'ALL') return Infinity;
    if (maxBudgetFilter === 'AFFORD') return Math.max(0, state.money);
    return Number(maxBudgetFilter);
  }, [maxBudgetFilter, state.money]);

  const matchesBuyDetailFilters = (q: Player, effectivePrice: number) => {
    if (ageRangeFilter === 'u21' && q.age > 21) return false;
    if (ageRangeFilter === 'prime' && (q.age < 22 || q.age > 28)) return false;
    if (ageRangeFilter === 'vet' && q.age < 29) return false;
    if (minOvFilter > 0 && q.ov < minOvFilter) return false;
    if (maxBudgetCap !== Infinity && effectivePrice > maxBudgetCap) return false;
    return true;
  };

  const marketList = useMemo(() => {
    const base = (state.mk || [])
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => {
        const lineOk = filter === 'ALL' || (filter === 'FREE' ? !!q.free : q.pos === filter);
        const subOk = subFilter === 'ALL' || q.ro === subFilter;
        const loanOk = !loanOnlyFilter || !q.free;
        const effPrice = q.free ? 0 : q.price || vlu(q);
        const detailOk = matchesBuyDetailFilters(q, effPrice);
        const searchOk =
          !normalizedQuery ||
          q.n.toLowerCase().includes(normalizedQuery) ||
          q.ro.toLowerCase().includes(normalizedQuery) ||
          (SPN[q.ro] || '').toLowerCase().includes(normalizedQuery);
        return lineOk && subOk && loanOk && detailOk && searchOk;
      });
    if (buySortCol === 'default') return base;
    return [...base].sort((a, b) =>
      comparePlayersByColumn(
        a.q,
        b.q,
        buySortCol,
        buySortDir,
        a.q.free ? 0 : a.q.price || vlu(a.q),
        b.q.free ? 0 : b.q.price || vlu(b.q)
      )
    );
  }, [state.mk, filter, subFilter, loanOnlyFilter, ageRangeFilter, minOvFilter, maxBudgetCap, buySortCol, buySortDir, normalizedQuery]);

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
    const items = clubBasePool.filter(({ q, team: t, price }) => {
      const lineOk = filter === 'ALL' || filter === 'FREE' || q.pos === filter;
      const subOk = subFilter === 'ALL' || q.ro === subFilter;
      const loanOk = !loanOnlyFilter || (t.sq.length > 16 && (q.age <= 26 || q.ov <= 76));
      const detailOk = matchesBuyDetailFilters(q, price);
      const searchOk =
        !normalizedQuery ||
        q.n.toLowerCase().includes(normalizedQuery) ||
        t.name.toLowerCase().includes(normalizedQuery) ||
        q.ro.toLowerCase().includes(normalizedQuery);
      return lineOk && subOk && loanOk && detailOk && searchOk;
    });
    const sorted = items.slice().sort((a, b) => {
      if (buySortCol === 'default') return b.q.ov - a.q.ov;
      return comparePlayersByColumn(a.q, b.q, buySortCol, buySortDir, a.price, b.price);
    });
    return sorted.slice(0, 60);
  }, [clubBasePool, filter, subFilter, loanOnlyFilter, ageRangeFilter, minOvFilter, maxBudgetCap, buySortCol, buySortDir, normalizedQuery]);

  const loanInPlayers = useMemo(
    () => me.sq.map((q, i) => ({ q, i })).filter(({ q }) => !!q.loan),
    [me.sq]
  );
  const loanedOutList = useMemo(() => getLoanedOutPlayers(state, state.me), [state]);
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
  const buyOffersCount = useMemo(
    () => incomingOffers.filter((o) => !o.kind || o.kind === 'buy').length,
    [incomingOffers]
  );
  const loanOffersCount = useMemo(
    () => incomingOffers.filter((o) => o.kind === 'loan' || o.kind === 'loanopt').length,
    [incomingOffers]
  );
  const filteredIncomingOffers = useMemo(() => {
    if (offerFilter === 'buy') return incomingOffers.filter((o) => !o.kind || o.kind === 'buy');
    if (offerFilter === 'loan') return incomingOffers.filter((o) => o.kind === 'loan' || o.kind === 'loanopt');
    return incomingOffers;
  }, [incomingOffers, offerFilter]);

  const listedPlayers = useMemo(() => me.sq.filter((q) => q.listed && !q.loan), [me.sq]);
  const loanListedPlayers = useMemo(() => me.sq.filter((q) => q.loanListed && !q.loan), [me.sq]);
  const sellSearchNorm = sellSearch.trim().toLowerCase();
  const sellSquadList = useMemo(() => {
    if (sellSubView === 'loaned_out') return [];
    const base = me.sq.filter((q) => {
      if (sellSubView === 'listed' && (!q.listed || q.loan)) return false;
      if (sellSubView === 'loan_list' && (!q.loanListed || q.loan)) return false;
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
      if (sellSortCol !== 'default') {
        return comparePlayersByColumn(a, b, sellSortCol, sellSortDir, Math.max(5, vlu(a)), Math.max(5, vlu(b)));
      }
      if (!!b.listed !== !!a.listed) return b.listed ? 1 : -1;
      if (!!b.loanListed !== !!a.loanListed) return b.loanListed ? 1 : -1;
      return b.ov - a.ov;
    });
  }, [me.sq, sellSubView, sellPosFilter, sellSearchNorm, sellSortCol, sellSortDir]);
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

  const shortlistResolved = useMemo(() => {
    return (state.shortlist || []).map((entry) => ({
      entry,
      resolved: resolveShortlistEntry(state, entry)
    }));
  }, [state]);

  const filteredShortlist = useMemo(() => {
    const base = shortlistResolved.filter(({ resolved }) => {
      if (shortlistFilter === 'ready') {
        return (
          resolved.status === 'mk' ||
          resolved.status === 'scout' ||
          (resolved.status === 'club' && tx.tw.open)
        );
      }
      if (shortlistFilter === 'free') return !!resolved.player.free && resolved.status !== 'in_squad';
      if (shortlistFilter === 'club') return resolved.status === 'club';
      return true;
    });
    if (shortlistSortCol === 'default') return base;
    return [...base].sort((a, b) =>
      comparePlayersByColumn(
        a.resolved.player,
        b.resolved.player,
        shortlistSortCol,
        shortlistSortDir,
        a.resolved.player.free ? 0 : a.resolved.estPrice,
        b.resolved.player.free ? 0 : b.resolved.estPrice
      )
    );
  }, [shortlistResolved, shortlistFilter, shortlistSortCol, shortlistSortDir, tx.tw.open]);

  const sortedScoutResults = useMemo(() => {
    const base = (state.scout?.results || []).map((q, i) => ({ q, i }));
    if (scoutSortCol === 'default') return base;
    return [...base].sort((a, b) =>
      comparePlayersByColumn(
        a.q,
        b.q,
        scoutSortCol,
        scoutSortDir,
        a.q.free ? 0 : a.q.price || vlu(a.q),
        b.q.free ? 0 : b.q.price || vlu(b.q)
      )
    );
  }, [state.scout?.results, scoutSortCol, scoutSortDir]);

  const createdPool = useMemo(() => listCreatedPlayersForManager(), [createdRefresh, state.md, state.season, me.sq.length]);
  const createdMarketList = useMemo(() => {
    const items = createdPool.filter((c) => {
      const q = c.player;
      const lineOk = filter === 'ALL' || filter === 'FREE' || q.pos === filter;
      const subOk = subFilter === 'ALL' || q.ro === subFilter;
      const detailOk = matchesBuyDetailFilters(q, c.price);
      const searchOk =
        !normalizedQuery ||
        q.n.toLowerCase().includes(normalizedQuery) ||
        c.sourceLabel.toLowerCase().includes(normalizedQuery) ||
        (c.archName || '').toLowerCase().includes(normalizedQuery);
      return lineOk && subOk && detailOk && searchOk;
    });
    if (buySortCol === 'default') return items;
    return [...items].sort((a, b) =>
      comparePlayersByColumn(a.player, b.player, buySortCol, buySortDir, a.price, b.price)
    );
  }, [createdPool, filter, subFilter, ageRangeFilter, minOvFilter, maxBudgetCap, buySortCol, buySortDir, normalizedQuery]);

  const transferHistoryStats = useMemo(
    () => getSeasonTransferStats(state, histSeason),
    [state, histSeason]
  );

  const filteredHistoryEntries = useMemo(() => {
    const qNorm = histSearch.trim().toLowerCase();
    return transferHistoryStats.entries.filter((tr) => {
      if (histScope === 'mine' && tr.toTeamId !== state.me && tr.fromTeamId !== state.me) return false;
      if (histScope === 'ai' && (tr.toTeamId === state.me || tr.fromTeamId === state.me)) return false;
      if (histScope === 'loan' && tr.kind !== 'loan' && tr.kind !== 'loanopt') return false;
      if (histKind === 'perm' && tr.kind !== 'buy' && tr.kind !== 'swap' && tr.kind !== 'buyout') return false;
      if (histKind === 'free' && tr.kind !== 'free' && tr.kind !== 'youth') return false;
      if (histKind === 'loan' && tr.kind !== 'loan' && tr.kind !== 'loanopt') return false;
      if (
        qNorm &&
        !tr.playerName.toLowerCase().includes(qNorm) &&
        !tr.fromTeamName.toLowerCase().includes(qNorm) &&
        !tr.toTeamName.toLowerCase().includes(qNorm) &&
        !tr.ro.toLowerCase().includes(qNorm)
      ) {
        return false;
      }
      return true;
    });
  }, [transferHistoryStats.entries, histScope, histKind, histSearch, state.me]);

  const sortedClubNetSpend = useMemo(() => {
    const list = transferHistoryStats.clubSummaries.slice();
    if (histSortClubs === 'spent_desc') return list.sort((a, b) => b.spent - a.spent || b.netSpend - a.netSpend);
    if (histSortClubs === 'recv_desc') return list.sort((a, b) => b.received - a.received || a.netSpend - b.netSpend);
    if (histSortClubs === 'net_asc') return list.sort((a, b) => a.netSpend - b.netSpend || b.received - a.received);
    return list.sort((a, b) => b.netSpend - a.netSpend || b.spent - a.spent);
  }, [transferHistoryStats.clubSummaries, histSortClubs]);

  const expiringCount = contractList.filter(({ c }) => c.yr <= 1).length;
  const activeCount = marketSource === 'mk' ? marketList.length : marketSource === 'club' ? clubMarketList.length : createdMarketList.length;
  const hasBuyFilters =
    filter !== 'ALL' ||
    subFilter !== 'ALL' ||
    loanOnlyFilter ||
    ageRangeFilter !== 'ALL' ||
    minOvFilter > 0 ||
    maxBudgetFilter !== 'ALL' ||
    buySortCol !== 'default' ||
    searchQuery.trim() !== '';

  const resetBuyFilters = () => {
    setFilter('ALL');
    setSubFilter('ALL');
    setLoanOnlyFilter(false);
    setAgeRangeFilter('ALL');
    setMinOvFilter(0);
    setMaxBudgetFilter('ALL');
    setBuySortCol('default');
    setBuySortDir('desc');
    setSearchQuery('');
  };

  const activeBuyFilterChips: { key: string; label: string; clear: () => void }[] = [
    ...(filter !== 'ALL'
      ? [{ key: 'pos', label: filter === 'FREE' ? 'ฟรีเอเยนต์' : `ตำแหน่ง: ${filter}`, clear: () => { setFilter('ALL'); setSubFilter('ALL'); } }]
      : []),
    ...(subFilter !== 'ALL' ? [{ key: 'role', label: `บทบาท: ${subFilter}`, clear: () => setSubFilter('ALL') }] : []),
    ...(ageRangeFilter !== 'ALL'
      ? [{
          key: 'age',
          label: ageRangeFilter === 'u21' ? 'อายุ ≤21' : ageRangeFilter === 'prime' ? 'อายุ 22–28' : 'อายุ 29+',
          clear: () => setAgeRangeFilter('ALL')
        }]
      : []),
    ...(minOvFilter > 0 ? [{ key: 'ov', label: `OVR ${minOvFilter}+`, clear: () => setMinOvFilter(0) }] : []),
    ...(maxBudgetFilter !== 'ALL'
      ? [{
          key: 'budget',
          label: maxBudgetFilter === 'AFFORD' ? 'ไม่เกินงบที่มี' : `งบ ≤${fmtMoneyNum(Number(maxBudgetFilter))}`,
          clear: () => setMaxBudgetFilter('ALL')
        }]
      : []),
    ...(loanOnlyFilter ? [{ key: 'loan', label: 'เฉพาะยืมตัวได้', clear: () => setLoanOnlyFilter(false) }] : []),
    ...(buySortCol !== 'default'
      ? [{
          key: 'sort',
          label: `เรียง: ${
            buySortCol === 'ov'
              ? 'OVR'
              : buySortCol === 'price'
                ? 'ค่าตัว'
                : buySortCol === 'fit'
                  ? 'ความฟิต'
                  : buySortCol === 'pos'
                    ? 'ตำแหน่ง'
                    : 'อายุ'
          } ${buySortDir === 'asc' ? '↑' : '↓'}`,
          clear: () => {
            setBuySortCol('default');
            setBuySortDir('desc');
          }
        }]
      : []),
    ...(searchQuery.trim() !== '' ? [{ key: 'q', label: `"${searchQuery.trim()}"`, clear: () => setSearchQuery('') }] : [])
  ];

  const handleToggleShortlist = (
    q: Player,
    opts: { source: 'mk' | 'club' | 'scout' | 'created'; clubTeamId?: number; clubName?: string }
  ) => {
    SFX.tap();
    let added = false;
    onUpdateState((d) => {
      added = toggleShortlistPlayer(d, q, opts);
    });
    onToast(added ? `⭐ เพิ่ม ${q.n} เข้ารายชื่อที่สนใจแล้ว` : `นำ ${q.n} ออกจากรายชื่อที่สนใจแล้ว`);
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

  const openNegotiation = (
    source: 'mk' | 'scout' | 'club',
    idx: number,
    q: Player,
    sellerTeam?: Team,
    preferredType?: OfferDraft['type']
  ) => {
    if (!tx.tw.open && !q.free) {
      onToast(`ตลาดซื้อขายปิดอยู่! ช่วงนี้เซ็นได้เฉพาะฟรีเอเยนต์ (เปิดรอบหน้า: ${tx.tw.rangeText})`);
      return;
    }
    if (source === 'club' && sellerTeam) {
      if (sellerTeam.sq.length <= 16) {
        onToast(`${sellerTeam.name} มีนักเตะเหลือขั้นต่ำ (${sellerTeam.sq.length} คน) ไม่ปล่อยตัว`);
        return;
      }
      if (q.pos === 'GK' && sellerTeam.sq.filter((z) => z.pos === 'GK').length <= 2) {
        onToast(`${sellerTeam.name} เหลือผู้รักษาประตูเพียง 2 คน ไม่ปล่อยตัว`);
        return;
      }
    }
    const desiredType: OfferDraft['type'] = q.free ? 'free' : preferredType || 'cash';
    if ((desiredType === 'loan' || desiredType === 'loanopt') && tx.loansCount >= tx.maxLoans) {
      onToast(`ครบโควตายืมตัวสูงสุด ${tx.maxLoans} คนแล้ว`);
      return;
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
      type: desiredType,
      pct: 100,
      yr: 3,
      role: targetWithPrice.ov >= 70 ? 'key' : targetWithPrice.age <= 20 ? 'pro' : 'rot',
      wb: 1,
      addOnPct: 0,
      swapIdx: swCands[0] ? swCands[0].i : null,
      msg: '',
      roundLog: [],
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

        const origCon = target.con ? { ...target.con } : undefined;
        removeFromSrc();
        const incoming: Player = { ...target };
        if (deal.type === 'loan' || deal.type === 'loanopt') {
          incoming.loan = 1;
          if (deal.loanOpt) incoming.loanOpt = deal.loanOpt;
          if (sellerRef) {
            incoming.loanFromTeamId = sellerRef.id;
            incoming.loanFromTeamName = sellerRef.name;
            incoming.loanWageShare = 100;
            if (origCon) incoming.loanOrigCon = origCon;
          }
        }
        incoming.con = { yr: deal.yr, wg: deal.wg, role: deal.role };
        incoming.no = undefined;
        incoming.signedSeason = d.season;
        incoming.signedMd = d.md;
        delete incoming.listed;
        delete incoming.loanListed;
        appendPlayerCareerLog(incoming, `✍️ ย้ายซบ ${t.name} (${TN[t.tier]}) ซีซั่น ${d.season}${incoming.loan ? ' (ยืมตัว)' : ''}`);
        t.sq.push(incoming);
        assignTeamShirtNumbers(t);
        removeShortlistPlayer(d, incoming.n);
        const logKind: TransferLogKind =
          deal.type === 'free'
            ? 'free'
            : deal.type === 'swap'
              ? 'swap'
              : deal.type === 'loan'
                ? 'loan'
                : deal.type === 'loanopt'
                  ? 'loanopt'
                  : 'buy';
        recordTransferLog(d, {
          season: d.season,
          md: d.md,
          playerName: incoming.n,
          pos: incoming.pos,
          ro: incoming.ro,
          age: incoming.age,
          ov: incoming.ov,
          kind: logKind,
          fromTeamId: sellerRef ? sellerRef.id : -1,
          fromTeamName: sellerRef ? sellerRef.name : target.free ? 'ฟรีเอเยนต์' : 'ตลาดซื้อขายกลาง',
          toTeamId: d.me,
          toTeamName: t.name,
          fee: deal.cashNow + (deal.dueLater || 0),
          ...(incoming.loanOpt ? { buyOption: incoming.loanOpt } : {}),
          wage: deal.wg
        });
        pushFeed(
          d,
          incoming.loan ? 'ยืมตัวเข้าทีม' : 'เสริมทัพ',
          `${incoming.loan ? '🤝 ยืมตัว' : '✍️ เซ็น'} ${incoming.n} (${incoming.ro} OVR ${incoming.ov})${sellerRef ? ` จาก ${sellerRef.name}` : ''} เข้าทีมสำเร็จ`,
          'ok'
        );

        if (sellerRef && swappedOutPlayer) {
          swappedOutPlayer.no = undefined;
          sellerRef.sq.push(swappedOutPlayer);
          assignTeamShirtNumbers(sellerRef);
        }
      });
      setOfferDraft(null);
      SFX.win();
      onToast(
        deal.type === 'loan' || deal.type === 'loanopt'
          ? `🤝 ยืมตัว ${q.n} (${q.ro} · 1 ซีซั่น · ${fmtMoneyNum(deal.wg)}/นัด) สำเร็จ!`
          : `เซ็นสัญญา ${q.n} (${q.ro} · ${deal.yr} ปี · ${fmtMoneyNum(deal.wg)}/นัด) สำเร็จ!`
      );
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
          const byName = srcList.findIndex((p) => p.n === (offerDraft.playerName || q.n));
          const target = srcList[byName >= 0 ? byName : offerDraft.idx];
          if (!target) return;
          target.tries = (target.tries || 0) + 1;
          if (target.tries >= 3 || (deal.chance < 20 && !target.free)) target.locked = 1;
        }
      });
      const nextTries = (q.tries || 0) + 1;
      const prevLog = offerDraft.roundLog || [];
      const roundSummary = `รอบ ${nextTries}: ยื่น ${deal.type === 'free' ? 'เซ็นฟรี' : `${offerDraft.pct}% (${fmtMoneyNum(deal.cashNow)})`} · ค่าเหนื่อย ${fmtMoneyNum(deal.wg)}/นัด (${deal.chance}%)`;
      if (nextTries >= 3 || (deal.chance < 20 && !q.free)) {
        setOfferDraft({
          ...offerDraft,
          counter: null,
          roundLog: [...prevLog, `${roundSummary} → ปิดโต๊ะ`].slice(-3),
          msg: 'อีกฝ่ายปฏิเสธและยุติการเจรจาในรอบนี้แล้ว'
        });
      } else {
        const isLoanOffer = deal.type === 'loan' || deal.type === 'loanopt';
        const cPct = deal.type === 'free' || isLoanOffer ? 100 : Math.min(125, offerDraft.pct + 10);
        const cWb = Math.min(2, offerDraft.wb + 1) as 0 | 1 | 2;
        const cAddOn = (offerDraft.addOnPct || 0) < 5 && !q.free ? 5 : offerDraft.addOnPct || 0;
        const cDraft: OfferDraft = {
          ...offerDraft,
          pct: cPct,
          wb: cWb,
          addOnPct: cAddOn,
          role: q.ov >= 70 ? 'key' : offerDraft.role
        };
        const counter = evalOffer(q, cDraft, me);
        setOfferDraft({
          ...offerDraft,
          counter,
          roundLog: [...prevLog, `${roundSummary} → สวน ${fmtMoneyNum(counter.cashNow)}`].slice(-3),
          msg: `ขอปรับเงื่อนไขเป็น${
            deal.type === 'free' || isLoanOffer ? '' : `ค่าตัว ${cPct}% · `
          }${isLoanOffer ? 'ค่ายืม ' : 'จ่ายทันที '}${fmtMoneyNum(counter.cashNow)} · ค่าเหนื่อย ${fmtMoneyNum(counter.wg)}/นัด · ${ROLE_L[counter.role]}${
            cAddOn > 0 ? ` · โบนัส +${cAddOn}%` : ''
          }`
        });
      }
    }
  };

  const renderNegotiationModal = () => {
    if (!offerDraft) return null;
    const { q: rawQ, sellerTeam } = getDraftTarget(offerDraft, state);
    if (!rawQ) return null;
    const q: Player = offerDraft.source === 'club' && !rawQ.price ? { ...rawQ, price: Math.max(8, vlu(rawQ)) } : rawQ;
    const info = dtInfo(q);
    const swCands = me.sq
      .map((z, i) => ({ z, i }))
      .filter(({ z }) => !z.loan && !z.me && z.inj === 0 && tx.posCounts[z.pos] > tx.minPos[z.pos])
      .sort((a, b) => vlu(b.z) - vlu(a.z));
    const E = evalOffer(q, offerDraft, me);
    const isLoanType = offerDraft.type === 'loan' || offerDraft.type === 'loanopt';
    const isBuyFeeType = offerDraft.type === 'cash' || offerDraft.type === 'inst' || offerDraft.type === 'swap';
    const sellerMinBlocked = offerDraft.source === 'club' && !!sellerTeam && sellerTeam.sq.length <= 16 && offerDraft.type !== 'swap';
    const windowBlocked = !tx.tw.open && !q.free;
    const canAfford = state.money >= E.cashNow && !(tx.ffpLocked && E.cashNow > 0);
    const needSwapOk = offerDraft.type !== 'swap' || !!E.swapQ;
    const fullSq = me.sq.length >= tx.maxSquad && offerDraft.type !== 'swap';
    const loanCapHit = isLoanType && tx.loansCount >= tx.maxLoans;
    const freedWage = offerDraft.type === 'swap' && E.swapQ ? ensureCon(E.swapQ).wg : 0;
    const projectedWage = +(tx.curWage - freedWage + E.wg).toFixed(1);
    const wageOverCap = projectedWage > tx.wageCap;
    const moneyAfterDeal = +(state.money - E.cashNow).toFixed(1);
    const askWage = q.askWg || wagOf(q);
    const triesUsed = q.tries || 0;
    const triesLeft = Math.max(0, 3 - triesUsed);

    const counter = offerDraft.counter;
    const counterFreedWage = counter?.type === 'swap' && counter.swapQ ? ensureCon(counter.swapQ).wg : 0;
    const counterProjectedWage = counter ? +(tx.curWage - counterFreedWage + counter.wg).toFixed(1) : 0;
    const counterCanAfford = counter ? state.money >= counter.cashNow && !(tx.ffpLocked && counter.cashNow > 0) : true;
    const counterWageOverCap = counter ? counterProjectedWage > tx.wageCap : false;
    const counterBlocked = !!counter && (!counterCanAfford || counterWageOverCap || fullSq || loanCapHit || !needSwapOk || windowBlocked);

    const types: [OfferDraft['type'], string][] = q.free
      ? [['free', '🆓 เซ็นฟรีเอเยนต์']]
      : [['cash', '💰 จ่ายสด'], ['inst', '📅 ผ่อน 2 งวด'], ['swap', '🔄 แลกตัว+เงิน'], ['loan', '🤝 ยืม 1 ซีซั่น'], ['loanopt', '🤝 ยืม+ซื้อขาด']];
    const chCol = E.chance >= 75 ? 'var(--g)' : E.chance >= 45 ? '#b45309' : 'var(--red)';

    const cashSubNote = E.sgBonus > 0
      ? `รวมโบนัสเซ็น +${fmtMoneyNum(E.sgBonus)}`
      : offerDraft.type === 'inst'
        ? 'งวดแรก 55%'
        : offerDraft.type === 'swap' && E.swapQ
          ? `หักแลกตัว -${fmtMoneyNum(E.swapVal)}`
          : isLoanType
            ? 'ค่ายืม 1 ฤดูกาล'
            : q.free
              ? 'ไร้ค่าตัว'
              : 'จ่ายครั้งเดียว';

    const thirdCardLabel = E.dueLater > 0
      ? offerDraft.type === 'inst' && E.addOnCash > 0
        ? 'ผ่อน 50% + โบนัสผลงาน'
        : offerDraft.type === 'inst'
          ? 'ผ่อนจ่ายปลายปี'
          : 'โบนัสผลงานปลายปี'
      : E.loanOpt > 0
        ? 'ออปชันซื้อขาด'
        : offerDraft.type === 'swap' && E.swapQ
          ? 'มูลค่าแลกตัว (-80%)'
          : 'ราคาตลาดอ้างอิง';
    const thirdCardVal = E.dueLater > 0
      ? fmtMoneyNum(E.dueLater)
      : E.loanOpt > 0
        ? fmtMoneyNum(E.loanOpt)
        : offerDraft.type === 'swap' && E.swapQ
          ? fmtMoneyNum(E.swapVal)
          : q.free
            ? 'ฟรี'
            : fmtMoneyNum(E.p0);
    const thirdCardSub = E.dueLater > 0
      ? E.addOnCash > 0 && offerDraft.type !== 'inst'
        ? `เงื่อนไขผลงาน +${E.addOnPct}%`
        : 'ชำระเมื่อจบฤดูกาล'
      : E.loanOpt > 0
        ? 'จ่ายเมื่อใช้สิทธิ์ซื้อ'
        : offerDraft.type === 'swap' && E.swapQ
          ? `${E.swapQ.ro} · ${E.swapQ.n}`
          : q.free
            ? 'ประหยัดค่าตัว 100%'
            : isLoanType
              ? 'มูลค่านักเตะ'
              : `เสนอ ${offerDraft.pct}%`;

    const starterNames = new Set(xi(me).map((p) => p.n));
    const qRoles = new Set<SubRole>([q.ro, ...(q.altRoles || [])]);
    const directCompetitors: { p: Player; matchKind: 'exact' | 'alt'; isStarter: boolean }[] = [];
    const lineCompetitors: { p: Player; matchKind: 'line'; isStarter: boolean }[] = [];

    for (const z of me.sq) {
      const isStarter = starterNames.has(z.n);
      if (z.ro === q.ro) {
        directCompetitors.push({ p: z, matchKind: 'exact', isStarter });
      } else if ((z.altRoles || []).includes(q.ro) || (q.altRoles || []).includes(z.ro) || qRoles.has(z.ro)) {
        directCompetitors.push({ p: z, matchKind: 'alt', isStarter });
      } else if (z.pos === q.pos) {
        lineCompetitors.push({ p: z, matchKind: 'line', isStarter });
      }
    }

    directCompetitors.sort((a, b) => {
      if (a.matchKind !== b.matchKind) return a.matchKind === 'exact' ? -1 : 1;
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      return b.p.ov - a.p.ov;
    });
    lineCompetitors.sort((a, b) => {
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      return b.p.ov - a.p.ov;
    });

    const shownCompetitors = (
      directCompetitors.length >= 2 ? directCompetitors : [...directCompetitors, ...lineCompetitors]
    ).slice(0, 3);
    const totalLineCompetitors = directCompetitors.length + lineCompetitors.length;
    const topDirect = directCompetitors[0]?.p || lineCompetitors[0]?.p;
    const squadFitVerdict = !topDirect
      ? '✨ เติมตำแหน่งว่าง ลงตัวจริงได้ทันที'
      : q.ov - topDirect.ov >= 3
        ? `⬆️ ยกระดับตัวจริง (+${q.ov - topDirect.ov} OVR)`
        : q.ov >= topDirect.ov - 1
          ? '⚖️ แย่งชิงตัวจริงสูสีทันที'
          : '🔄 เสริมขุมกำลังหมุนเวียน';

    const stanceSummary = q.free
      ? `เอเยนต์ของ ${q.n} เปิดโต๊ะเจรจาเซ็นฟรี โดยเน้นบทบาททีมและค่าเหนื่อยราว ${fmtMoneyNum(askWage)}/นัด`
      : isLoanType
        ? `${sellerTeam ? sellerTeam.name : 'ต้นสังกัด'} พร้อมปล่อยยืม 1 ซีซั่นที่ค่ายืม ${fmtMoneyNum(E.cashNow - E.sgBonus)} และต้องการให้ช่วยรับค่าเหนื่อย`
        : `${sellerTeam ? sellerTeam.name : 'ต้นสังกัด'} ประเมินค่าตัวไว้ราว ${fmtMoneyNum(E.p0)} ขณะที่นักเตะขอค่าเหนื่อย ~${fmtMoneyNum(askWage)}/นัด`;

    const chanceLabel = E.chance >= 75 ? 'โอกาสสูง' : E.chance >= 45 ? 'กำลังต่อรอง' : E.chance >= 20 ? 'ข้อเสนอตึง' : 'เสี่ยงล่มทันที';
    const bidAssessLabel = offerDraft.pct < 92 ? 'ยื่นต่ำกว่าตลาด' : offerDraft.pct <= 105 ? 'ราคายุติธรรม' : 'ข้อเสนอจูงใจสูง';
    const roleMismatchWarn = offerDraft.role === 'pro' && q.ov >= 68;
    const footLabel = q.foot === 'L' ? 'เท้าซ้าย' : q.foot === 'B' ? 'สองเท้า' : 'เท้าขวา';
    const coreStats: [string, number][] = [
      ['ยิง', info.a.sh],
      ['จ่าย', info.a.ps],
      ['เลี้ยง', info.a.dr],
      ['รับ', info.a.tk],
      ['กาย', info.a.ph]
    ];

    return (
      <div className="fixed inset-0 z-50 bg-black/72 flex items-center justify-center stage-viewport overflow-hidden">
        <div
          className="w-full max-w-[900px] mland:max-w-[min(95vw,860px)] h-[min(calc(var(--app-dvh,1dvh)*90),620px)] mland:h-[calc(var(--app-dvh,1dvh)*95)] max-h-full rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Deal Room Header */}
          <div className="shrink-0 flex items-center justify-between gap-2.5 px-3.5 sm:px-4 py-2.5 mland:px-3 mland:py-1.5 border-b border-[var(--line)] bg-gradient-to-r from-[var(--surface-2)] via-[var(--surface-2)] to-[var(--surface)]">
            <button
              type="button"
              onClick={() => onInspectPlayer(q, sellerTeam || null)}
              title="ดูการ์ดนักเตะและค่าพลังทั้งหมด"
              className="flex items-center gap-2.5 mland:gap-2 min-w-0 flex-1 text-left cursor-pointer group"
            >
              <div className="shrink-0 [&>svg]:w-10 [&>svg]:h-10 mland:[&>svg]:w-8 mland:[&>svg]:h-8 rounded-xl bg-[var(--surface)] border border-[var(--line)]/80 group-hover:border-[var(--g)]/60 p-0.5 shadow-2xs transition-colors">
                <PlayerFace player={q} team={sellerTeam} state={state} size={40} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="text-[10px] mland:text-[8.5px] font-extrabold uppercase tracking-wider px-1.5 py-[1px] rounded bg-[var(--g-soft)] text-[var(--g)] shrink-0">
                    ห้องเจรจา
                  </span>
                  <PositionBadge role={q.ro} size="xs" />
                  <span className="font-extrabold text-sm sm:text-[15px] mland:text-xs truncate text-[var(--ink)] group-hover:text-[var(--g)] group-hover:underline transition-colors">
                    {q.n}
                  </span>
                  <span className="hidden sm:inline text-[10.5px] mland:text-[9px] text-[var(--mut)] shrink-0">
                    · {q.age} ปี ({info.gro}) · {footLabel}
                  </span>
                </div>
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate tabular mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {sellerTeam ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--ink)]/85">
                      <ClubCrest name={sellerTeam.name} size={12} team={sellerTeam} club={state.club} />
                      <span>{sellerTeam.name} ({TN[sellerTeam.tier]})</span>
                    </span>
                  ) : (
                    <span className={q.free ? 'text-[var(--g)] font-bold' : 'font-semibold'}>
                      {q.free ? 'ฟรีเอเยนต์' : 'ตลาดซื้อขายกลาง'}
                    </span>
                  )}
                  <span className="opacity-40">·</span>
                  <span>{q.free ? 'ไร้ค่าตัว' : `ประเมิน ${fmtMoneyNum(E.p0)}`}</span>
                  <span className="opacity-40">·</span>
                  <span>ขอ ~{fmtMoneyNum(askWage)}/นัด</span>
                  <span className="hidden md:inline opacity-40">·</span>
                  <span className="hidden md:inline">
                    <PlayerBioStrip bio={info.bio} variant="inline" />
                  </span>
                </div>
              </div>
            </button>

            <div className="shrink-0 flex items-center gap-1.5 mland:gap-1">
              <div className="hidden sm:flex items-center gap-1 mr-0.5">
                <PotentialBadge pot={q.pot || q.ov} size="xs" />
              </div>
              <OvrBadge ov={q.ov} size="md" />
              {(() => {
                const shortlisted = isPlayerShortlisted(state, q.n, sellerTeam?.id);
                return (
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleShortlist(q, {
                        source: offerDraft.source,
                        clubTeamId: sellerTeam?.id,
                        clubName: sellerTeam?.name
                      })
                    }
                    title={shortlisted ? 'นำออกจากรายชื่อที่สนใจ' : 'เพิ่มเข้ารายชื่อที่สนใจ'}
                    aria-label={shortlisted ? `นำ ${q.n} ออกจากรายชื่อที่สนใจ` : `เพิ่ม ${q.n} เข้ารายชื่อที่สนใจ`}
                    className={`w-7 h-7 mland:w-6 mland:h-6 inline-flex items-center justify-center rounded-lg border cursor-pointer transition-all shrink-0 active:scale-95 ${
                      shortlisted
                        ? 'bg-amber-400/20 border-amber-500/70 text-amber-500 dark:text-amber-300 shadow-[0_1px_6px_rgba(245,158,11,0.2)] hover:bg-amber-400/30'
                        : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-amber-500 hover:border-amber-400/60 hover:bg-amber-500/10'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 mland:w-3 mland:h-3 ${shortlisted ? 'fill-amber-400 text-amber-500 dark:text-amber-300' : ''}`} />
                  </button>
                );
              })()}
              <button
                type="button"
                onClick={() => setOfferDraft(null)}
                aria-label="ปิดหน้าต่างเจรจา"
                title="ปิดหน้าต่างเจรจา"
                className="btn-icon w-7 h-7 mland:w-6 mland:h-6"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2-Column Negotiation Room */}
          <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-hidden mland:overflow-hidden p-3 sm:p-3.5 mland:p-2 grid grid-cols-1 sm:grid-cols-[1.06fr_0.94fr] mland:grid-cols-[1.06fr_0.94fr] gap-2.5 sm:gap-3 mland:gap-2 items-stretch">
            {/* LEFT PANE: Proposal Controls */}
            <div className="min-h-0 flex flex-col gap-2 mland:gap-1.5 sm:overflow-y-auto mland:overflow-y-auto pr-0.5">
              {/* Deal Type & Fee Selector */}
              <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2 mland:space-y-1.5">
                <div className="flex items-center justify-between text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">
                  <span>1. รูปแบบข้อเสนอ</span>
                  <span className="tabular font-semibold">โควตายืม {tx.loansCount}/{tx.maxLoans}</span>
                </div>
                <div className={`grid gap-1 ${q.free ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 mland:grid-cols-3'}`}>
                  {types.map(([k, l]) => {
                    const isLoanBtn = k === 'loan' || k === 'loanopt';
                    const disabledLoan = isLoanBtn && tx.loansCount >= tx.maxLoans;
                    const disabledMinSeller = offerDraft.source === 'club' && !!sellerTeam && sellerTeam.sq.length <= 16 && k !== 'swap';
                    return (
                      <button
                        key={k}
                        type="button"
                        disabled={disabledLoan || disabledMinSeller}
                        onClick={() => setOfferDraft({ ...offerDraft, type: k, counter: null, msg: '' })}
                        className={`btn btn-xs sm:btn-sm truncate ${
                          offerDraft.type === k ? 'btn-primary' : 'btn-surface'
                        }`}
                      >
                        {l}{disabledLoan ? ' (เต็ม)' : ''}
                      </button>
                    );
                  })}
                </div>
                {sellerTeam && sellerTeam.sq.length <= 16 && (
                  <p className="text-[10px] mland:text-[8.5px] text-[#9a6700] dark:text-[var(--lamp)] font-medium">
                    ⚠️ {sellerTeam.name} มีนักเตะขั้นต่ำ {sellerTeam.sq.length} คน รับเฉพาะข้อเสนอแลกตัว
                  </p>
                )}

                {/* Fee / Swap / Loan Breakdown */}
                <div className="pt-1.5 border-t border-[var(--line)]/70 space-y-1.5 mland:space-y-1">
                  {isBuyFeeType ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9.5px] tabular">
                        <span className="font-bold text-[var(--mut)]">
                          ค่าตัวที่เสนอ ({offerDraft.pct}%)
                          <span className={`ml-1.5 font-semibold ${offerDraft.pct < 92 ? 'text-[#9a6700] dark:text-[var(--lamp)]' : offerDraft.pct > 105 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                            · {bidAssessLabel}
                          </span>
                        </span>
                        <b className="text-[var(--ink)]">{fmtMoneyNum(Math.round((E.p0 * offerDraft.pct) / 100))}</b>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        <button
                          type="button"
                          disabled={offerDraft.pct <= 75}
                          onClick={() => setOfferDraft({ ...offerDraft, pct: Math.max(75, offerDraft.pct - 5), counter: null, msg: '' })}
                          className="btn btn-xs sm:btn-sm btn-surface tabular"
                          title="ลดข้อเสนอ -5%"
                        >
                          -5%
                        </button>
                        {[85, 95, 100, 115].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setOfferDraft({ ...offerDraft, pct: p, counter: null, msg: '' })}
                            className={`btn btn-xs sm:btn-sm tabular ${
                              offerDraft.pct === p ? 'btn-primary' : 'btn-surface'
                            }`}
                          >
                            {p}%
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={offerDraft.pct >= 130}
                          onClick={() => setOfferDraft({ ...offerDraft, pct: Math.min(130, offerDraft.pct + 5), counter: null, msg: '' })}
                          className="btn btn-xs sm:btn-sm btn-surface tabular"
                          title="เพิ่มข้อเสนอ +5%"
                        >
                          +5%
                        </button>
                      </div>
                      {offerDraft.type === 'inst' && (
                        <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                          จ่ายทันที 55% ({fmtMoneyNum(Math.round(((E.p0 * offerDraft.pct) / 100) * 0.55))}) · ผ่อนปลายปี 50% ({fmtMoneyNum(Math.round(((E.p0 * offerDraft.pct) / 100) * 0.5))})
                        </div>
                      )}
                      {offerDraft.type === 'swap' && (
                        <div className="pt-1 space-y-1">
                          {swCands.length > 0 ? (
                            <>
                              <select
                                aria-label="เลือกนักเตะที่ใช้แลก"
                                value={offerDraft.swapIdx ?? ''}
                                onChange={(e) => setOfferDraft({ ...offerDraft, swapIdx: e.target.value ? Number(e.target.value) : null, counter: null, msg: '' })}
                                className="w-full px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-semibold"
                              >
                                {swCands.map(({ z, i }) => (
                                  <option key={z.n} value={i}>
                                    แลก: {z.ro} · {z.n} (OVR {z.ov} · หัก {fmtMoneyNum(Math.round(vlu(z) * 0.8))})
                                  </option>
                                ))}
                              </select>
                              {E.swapQ && (
                                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                                  หักค่าตัว -{fmtMoneyNum(E.swapVal)} · คืนเพดานค่าเหนื่อย {fmtMoneyNum(freedWage)}/นัด
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-[10.5px] text-[var(--red)] font-semibold">ไม่มีนักเตะเกินโควตาตำแหน่งให้แลก</p>
                          )}
                        </div>
                      )}
                    </>
                  ) : isLoanType ? (
                    <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[9px] tabular">
                      <span className="text-[var(--mut)]">
                        {offerDraft.type === 'loanopt'
                          ? `ยืม 1 ฤดูกาล + ออปชันซื้อขาด ${fmtMoneyNum(E.loanOpt)}`
                          : 'ยืมใช้งาน 1 ฤดูกาล (ส่งกลับต้นสังกัดหลังจบซีซั่น)'}
                      </span>
                      <b className="text-[var(--g)] shrink-0">ค่ายืม {fmtMoneyNum(E.cashNow - E.sgBonus)}</b>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[9px] tabular">
                      <span className="text-[var(--mut)]">เซ็นสัญญาไร้ค่าตัว ตกลงเฉพาะสัญญาส่วนตัว</span>
                      <b className="text-[var(--g)] shrink-0">ค่าตัว 0</b>
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Contract Terms + Performance Add-on */}
              <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-1.5 mland:space-y-1">
                <div className="flex items-center justify-between text-[11px] mland:text-[9.5px] tabular">
                  <span className="font-bold text-[var(--mut)]">2. สัญญาส่วนตัว &amp; เงื่อนไขโบนัส</span>
                  <span className="font-bold text-[var(--ink)]">
                    {fmtMoneyNum(E.wg)}/นัด{E.sgBonus > 0 ? ` · เซ็น +${fmtMoneyNum(E.sgBonus)}` : ''}
                  </span>
                </div>

                {!isLoanType ? (
                  <div className="grid grid-cols-[62px_1fr] items-center gap-1.5">
                    <span className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)]">ระยะสัญญา</span>
                    <div className="grid grid-cols-4 gap-1">
                      {[1, 2, 3, 5].map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => setOfferDraft({ ...offerDraft, yr: y, counter: null, msg: '' })}
                          className={`btn btn-xs sm:btn-sm ${
                            offerDraft.yr === y ? 'btn-primary' : 'btn-surface'
                          }`}
                        >
                          {y} ปี
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10.5px] mland:text-[9px] px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)]/70">
                    <span className="text-[var(--mut)] font-semibold">ระยะสัญญายืม</span>
                    <b className="text-[var(--ink)]">1 ฤดูกาล</b>
                  </div>
                )}

                <div className="grid grid-cols-[62px_1fr] items-center gap-1.5">
                  <span className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)]">บทบาททีม</span>
                  <div className="grid grid-cols-3 gap-1">
                    {([['key', '⭐ ตัวหลัก'], ['rot', '🔄 หมุนเวียน'], ['pro', '🌱 ดาวรุ่ง']] as const).map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setOfferDraft({ ...offerDraft, role: k, counter: null, msg: '' })}
                        className={`btn btn-xs sm:btn-sm truncate ${
                          offerDraft.role === k ? 'btn-primary' : 'btn-surface'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {roleMismatchWarn && (
                  <p className="text-[10px] mland:text-[8.5px] text-[#9a6700] dark:text-[var(--lamp)] font-medium pl-[68px]">
                    ⚠️ OVR {q.ov} สูงเกินบทบาทดาวรุ่ง ทำให้นักเตะไม่พอใจ
                  </p>
                )}

                <div className="grid grid-cols-[62px_1fr] items-center gap-1.5">
                  <span className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)]">ค่าเหนื่อย</span>
                  <div className="grid grid-cols-3 gap-1">
                    {([['ประหยัด -15%', 0], ['มาตรฐาน', 1], ['จัดเต็ม +20%', 2]] as const).map(([l, k]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setOfferDraft({ ...offerDraft, wb: k, counter: null, msg: '' })}
                        className={`btn btn-xs sm:btn-sm truncate ${
                          offerDraft.wb === k ? 'btn-primary' : 'btn-surface'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-[62px_1fr] items-center gap-1.5">
                  <span className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)]" title="จ่ายเมื่อจบฤดูกาล ช่วยเพิ่มโอกาสปิดดีลโดยไม่ต้องใช้งบสดทันที">
                    โบนัสผลงาน
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {([['ไม่มี', 0], ['+5% ปลายปี', 5], ['+10% ปลายปี', 10]] as const).map(([l, k]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setOfferDraft({ ...offerDraft, addOnPct: k, counter: null, msg: '' })}
                        className={`btn btn-xs sm:btn-sm truncate ${
                          (offerDraft.addOnPct || 0) === k ? 'btn-primary' : 'btn-surface'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Compact Squad Depth Strip */}
              <div className="px-2.5 py-2 mland:px-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/45 border border-[var(--line)]/85 space-y-1">
                <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[9px]">
                  <span className="font-bold text-[var(--mut)] inline-flex items-center gap-1 min-w-0 truncate">
                    <Users className="w-3 h-3 text-[var(--g)] shrink-0" />
                    <span className="truncate">คู่แข่งตำแหน่ง ({q.ro})</span>
                  </span>
                  <span className="text-[var(--mut)] tabular shrink-0">
                    ตรง <b className="text-[var(--ink)]">{directCompetitors.length}</b> · สาย {q.pos} <b className="text-[var(--ink)]">{totalLineCompetitors}</b>
                  </span>
                </div>
                <div className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--g)]">
                  {squadFitVerdict}
                </div>
                {shownCompetitors.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {shownCompetitors.map(({ p: z, isStarter }) => {
                      const ovDiff = q.ov - z.ov;
                      return (
                        <button
                          key={z.n}
                          type="button"
                          onClick={() => onInspectPlayer(z, me)}
                          title={`ดูการ์ด ${z.n}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 hover:border-[var(--g)]/55 text-[10px] mland:text-[8.5px] cursor-pointer transition-colors"
                        >
                          <PositionBadge role={z.ro} size="2xs" />
                          <span className="font-semibold text-[var(--ink)] max-w-[84px] truncate">{z.n}</span>
                          <b className="tabular text-[var(--ink)]">{z.ov}</b>
                          <span className={`font-bold tabular ${ovDiff > 0 ? 'text-[var(--g)]' : ovDiff < 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                            ({ovDiff > 0 ? `+${ovDiff}` : ovDiff === 0 ? '=' : ovDiff})
                          </span>
                          {isStarter && <span className="text-[8.5px] font-bold text-[var(--g)]">XI</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANE: Counterparty Stance, Patience, Ledger & Scouting */}
            <div className="min-h-0 flex flex-col gap-2 mland:gap-1.5 sm:overflow-y-auto mland:overflow-y-auto pr-0.5">
              {/* Negotiation Table Dialogue & Dual Sentiment */}
              <div
                className={`p-2.5 mland:p-2 rounded-xl border space-y-2 mland:space-y-1.5 ${
                  q.locked
                    ? 'bg-[var(--red-soft)]/55 border-[var(--red)]/40'
                    : offerDraft.msg
                      ? 'bg-[var(--lamp-soft)]/55 border-[var(--lamp)]/50'
                      : 'bg-[var(--surface-2)]/65 border-[var(--line)]'
                }`}
              >
                {/* Counterparty Header + Patience Pips */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--line)]/60">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {sellerTeam ? (
                      <ClubCrest name={sellerTeam.name} size={16} team={sellerTeam} club={state.club} />
                    ) : (
                      <span className="text-xs">🤝</span>
                    )}
                    <span className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--ink)] truncate">
                      {q.free ? `เอเยนต์ของ ${q.n}` : sellerTeam ? `โต๊ะเจรจา ${sellerTeam.name}` : 'ตัวแทนนักเตะ & ตลาด'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" title={`เหลือรอบเจรจา ${triesLeft}/3 ครั้ง`}>
                    <span className="text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)]">ความอดทน</span>
                    <div className="flex items-center gap-0.5">
                      {[0, 1, 2].map((pip) => {
                        const alive = pip < triesLeft && !q.locked;
                        return (
                          <span
                            key={pip}
                            className={`w-3.5 h-1.5 mland:w-2.5 rounded-full transition-colors ${
                              alive
                                ? triesLeft === 1
                                  ? 'bg-[var(--red)]'
                                  : triesLeft === 2
                                    ? 'bg-[var(--lamp)]'
                                    : 'bg-[var(--g)]'
                                : 'bg-[var(--line)]/70'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Overall Likelihood + Dual Sentiment Breakdown */}
                <div className="space-y-1.5 mland:space-y-1">
                  <div className="flex items-center justify-between text-[10.5px] mland:text-[9px] tabular">
                    <span className="font-bold text-[var(--mut)]">โอกาสปิดดีลรวม</span>
                    <span className="font-extrabold" style={{ color: chCol }}>
                      {E.chance}% · {chanceLabel}
                    </span>
                  </div>
                  <div className="h-2 mland:h-1.5 rounded-full bg-[var(--surface)] border border-[var(--line)]/60 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-200" style={{ width: `${E.chance}%`, background: chCol }} />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[9.5px] mland:text-[8px] tabular pt-0.5">
                    <div className="px-2 py-1 rounded-lg bg-[var(--surface)]/75 border border-[var(--line)]/60 flex items-center justify-between gap-1">
                      <span className="text-[var(--mut)] truncate">{q.free ? 'ค่าตัว/เซ็นฟรี' : 'ใจต้นสังกัด'}</span>
                      <b className={E.clubPct >= 75 ? 'text-[var(--g)]' : E.clubPct >= 50 ? 'text-[#b45309] dark:text-[var(--lamp)]' : 'text-[var(--red)]'}>
                        {E.clubPct}%
                      </b>
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-[var(--surface)]/75 border border-[var(--line)]/60 flex items-center justify-between gap-1">
                      <span className="text-[var(--mut)] truncate">ใจนักเตะ</span>
                      <b className={E.playerPct >= 75 ? 'text-[var(--g)]' : E.playerPct >= 50 ? 'text-[#b45309] dark:text-[var(--lamp)]' : 'text-[var(--red)]'}>
                        {E.playerPct}%
                      </b>
                    </div>
                  </div>
                  {!q.free && E.chance < 20 && !q.locked && !offerDraft.msg && (
                    <div className="text-[10px] mland:text-[8.5px] text-[var(--red)] font-semibold leading-tight">
                      ⚠️ โอกาสต่ำกว่า 20% หากถูกปฏิเสธ การเจรจาจะล่มทันที
                    </div>
                  )}
                </div>

                {/* Speech Bubble / Counter-Offer + Round Log */}
                <div className="p-2 mland:p-1.5 rounded-lg bg-[var(--surface)]/90 border border-[var(--line)]/75 text-[11px] mland:text-[9.5px] space-y-1.5">
                  {q.locked ? (
                    <div className="text-[var(--red)] font-semibold leading-snug">
                      🚫 การเจรจายุติลงแล้ว อีกฝ่ายปิดโต๊ะเจรจาในรอบนี้
                    </div>
                  ) : offerDraft.msg ? (
                    <>
                      <div className="flex items-center justify-between gap-2 font-bold text-[var(--ink)]">
                        <span>💬 ข้อเสนอตอบกลับจากอีกฝ่าย</span>
                        <span className="text-[9.5px] text-[var(--mut)] tabular">รอบ {triesUsed}/3</span>
                      </div>
                      <p className="text-[var(--ink)]/90 leading-snug">{offerDraft.msg}</p>
                      {counter && (
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-1 pt-0.5">
                          <button
                            type="button"
                            disabled={counterBlocked}
                            onClick={() => submitOffer(true)}
                            className="btn btn-sm btn-primary truncate"
                          >
                            {counterBlocked
                              ? counterWageOverCap
                                ? `เกินเพดาน (${fmtMoneyNum(tx.wageCap)})`
                                : !counterCanAfford
                                  ? 'เกินงบ / ติด FFP'
                                  : 'ยังไม่สามารถรับสวนได้'
                              : `✅ ตกลงตามข้อเสนอสวน (${fmtMoneyNum(counter.cashNow)} · ${fmtMoneyNum(counter.wg)}/นัด)`}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setOfferDraft({
                                ...offerDraft,
                                pct: counter.pct,
                                wb: counter.wb,
                                role: counter.role,
                                addOnPct: counter.addOnPct,
                                counter: null,
                                msg: ''
                              })
                            }
                            className="btn btn-sm btn-surface shrink-0"
                            title="นำตัวเลขข้อเสนอสวนมาปรับต่อเอง"
                          >
                            ปรับตาม
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[var(--mut)] leading-snug">
                      &ldquo;{stanceSummary}&rdquo;
                    </p>
                  )}

                  {offerDraft.roundLog && offerDraft.roundLog.length > 0 && (
                    <div className="pt-1 border-t border-[var(--line)]/50 space-y-0.5 text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular">
                      {offerDraft.roundLog.map((line, idx) => (
                        <div key={idx} className="truncate">• {line}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Impact Receipt */}
              <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-1.5 mland:space-y-1 text-[11px] mland:text-[9.5px] tabular">
                <div className="font-bold text-[var(--mut)] flex items-center justify-between">
                  <span>สรุปผลกระทบงบสโมสร</span>
                  <span className={tx.ffpLocked ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>
                    คลัง {fmtMoneyNum(state.money)}
                  </span>
                </div>

                <div className="divide-y divide-[var(--line)]/55 rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/70 px-2.5">
                  <div className="py-1.5 mland:py-1 flex items-center justify-between gap-2">
                    <span className="text-[var(--mut)]">จ่ายทันที ({cashSubNote})</span>
                    <b className={!canAfford ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>
                      {fmtMoneyNum(E.cashNow)}
                    </b>
                  </div>
                  {(E.dueLater > 0 || E.loanOpt > 0 || (offerDraft.type === 'swap' && E.swapQ)) && (
                    <div className="py-1.5 mland:py-1 flex items-center justify-between gap-2">
                      <span className="text-[var(--mut)]">{thirdCardLabel} ({thirdCardSub})</span>
                      <b className="text-[var(--ink)]">{thirdCardVal}</b>
                    </div>
                  )}
                  <div className="py-1.5 mland:py-1 flex items-center justify-between gap-2">
                    <span className="text-[var(--mut)]">ค่าเหนื่อย (ขอ ~{fmtMoneyNum(askWage)})</span>
                    <b className="text-[var(--ink)]">{fmtMoneyNum(E.wg)}/นัด</b>
                  </div>
                  <div className="py-1.5 mland:py-1 flex items-center justify-between gap-2">
                    <span className="text-[var(--mut)]">งบคงเหลือหลังดีล</span>
                    <b className={moneyAfterDeal < 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}>
                      {fmtMoneyNum(moneyAfterDeal)}
                    </b>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] mland:text-[8.5px] pt-0.5">
                  <span>
                    เพดานค่าเหนื่อย:{' '}
                    <b className={wageOverCap ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>
                      {fmtMoneyNum(projectedWage)}/{fmtMoneyNum(tx.wageCap)}
                    </b>
                  </span>
                  <span>
                    ขนาดทีม:{' '}
                    <b className={fullSq ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>
                      {me.sq.length}/{tx.maxSquad} คน
                    </b>
                  </span>
                </div>
              </div>

              {/* Compact 5-Attr Scout Snapshot */}
              <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/45 border border-[var(--line)]/80 space-y-1.5 mland:space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] mland:text-[8.5px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PotentialBadge pot={q.pot || q.ov} size="xs" showLabel />
                    <TalentBadge talent={info.D0.tlVal} size="xs" prefix="พรสวรรค์" />
                  </div>
                  <span className="text-[var(--mut)]">
                    ความฟิต <b className="text-[var(--ink)] tabular">{Math.round(q.fit ?? 100)}%</b>
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1 tabular">
                  {coreStats.map(([lbl, val]) => (
                    <div key={lbl} className="px-1.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/65 text-center">
                      <div className="text-[9px] mland:text-[7.5px] text-[var(--mut)] leading-none">{lbl}</div>
                      <div className={`text-[11px] mland:text-[9.5px] font-extrabold mt-0.5 leading-tight ${val >= 75 ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Deal Room Footer */}
          <div className="shrink-0 px-3.5 py-2 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOfferDraft(null)}
              className="btn btn-md btn-surface shrink-0"
            >
              ถอนตัว
            </button>
            <button
              type="button"
              disabled={!canAfford || !needSwapOk || fullSq || loanCapHit || wageOverCap || sellerMinBlocked || windowBlocked || !!q.locked}
              onClick={() => submitOffer(false)}
              className="btn btn-md btn-gold flex-1"
            >
              {q.locked
                ? 'การเจรจาล่มแล้ว'
                : windowBlocked
                  ? `ตลาดซื้อขายปิดอยู่ (${tx.tw.rangeText})`
                  : sellerMinBlocked
                    ? `ทีมขายมีนักเตะขั้นต่ำ ${sellerTeam?.sq.length} คน (ต้องแลกตัว)`
                    : loanCapHit
                      ? `โควตายืมเต็ม ${tx.maxLoans} คน`
                      : wageOverCap
                        ? `เกินเพดานค่าเหนื่อย ${fmtMoneyNum(tx.wageCap)}`
                        : fullSq
                          ? `ทีมเต็ม ${tx.maxSquad} คน`
                          : !needSwapOk
                            ? 'ยังไม่มีนักเตะให้แลกตัว'
                            : !canAfford
                              ? (tx.ffpLocked ? 'งบติดลบตามกฎ FFP' : 'งบสโมสรไม่พอจ่ายทันที')
                              : '🤝 ยื่นข้อเสนออย่างเป็นทางการ'}
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
      <div className="fixed inset-0 z-50 bg-black/72 flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
        <div className="w-full max-w-2xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
          <div className="shrink-0 flex items-center gap-3 px-3.5 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
            <PlayerFace player={q} team={me} state={state} size={42} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm mland:text-xs truncate">📋 ต่อสัญญา · {q.n}</div>
              <div className="text-xs mland:text-[10.5px] text-[var(--mut)] tabular">
                เหลือสัญญา <b>{con.yr} ปี</b> · ค่าเหนื่อยเดิม {fmtMoneyNum(con.wg)}/นัด
              </div>
              <PlayerBioStrip bio={getPlayerBio(q)} variant="inline" className="mt-1" />
            </div>
            <OvrBadge ov={q.ov} size="md" />
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

  const marketTabs: { id: MarketTab; icon: React.ReactNode; label: string; count?: string }[] = [
    { id: 'buy', icon: <TransferMarketIcon size={14} className="w-[14px] h-[14px] mland:w-[12px] mland:h-[12px] mland:!text-[11px]" />, label: 'ซื้อ & ยืมเข้า', count: `${activeCount}` },
    { id: 'shortlist', icon: '⭐', label: 'ที่สนใจ', count: shortlistResolved.length > 0 ? `${shortlistResolved.length}` : undefined },
    {
      id: 'sell',
      icon: '🏷️',
      label: 'ขาย · ปล่อยยืม',
      count:
        incomingOffers.length > 0
          ? `${incomingOffers.length} ดีล`
          : loanedOutList.length > 0
            ? `${loanedOutList.length} ยืมออก`
            : listedPlayers.length + loanListedPlayers.length > 0
              ? `${listedPlayers.length + loanListedPlayers.length}`
              : undefined
    },
    { id: 'scout', icon: '🔍', label: 'แมวมอง', count: state.scout?.results ? 'พร้อม' : state.scout ? `${state.scout.turnsLeft} นัด` : undefined },
    { id: 'con', icon: '📋', label: 'สัญญา · ยืม', count: expiringCount + loanInPlayers.length > 0 ? `${expiringCount + loanInPlayers.length}` : undefined },
    { id: 'history', icon: '📊', label: 'ประวัติลีก', count: transferHistoryStats.entries.length > 0 ? `${transferHistoryStats.entries.length}` : undefined }
  ];

  const scoutFocusCards: { focus: ScoutMission['focus']; icon: string; title: string; desc: string }[] = [
    { focus: 'wonderkid', icon: '🌟', title: 'ดาวรุ่ง U20', desc: 'อายุน้อย แววพัฒนาสูง' },
    { focus: 'free', icon: '🆓', title: 'ฟรีเอเยนต์', desc: 'ไร้ค่าตัว เซ็นได้ทันที' },
    { focus: 'gk', icon: '🧤', title: 'ผู้รักษาประตู', desc: 'นายด่านเฝ้าเสา' },
    { focus: 'defender', icon: '🛡️', title: 'กองหลัง', desc: 'แนวรับคุมเกมหลังบ้าน' },
    { focus: 'midfielder', icon: '🧭', title: 'กองกลาง', desc: 'ห้องเครื่องคุมจังหวะ' },
    { focus: 'striker', icon: '⚽', title: 'กองหน้า', desc: 'จอมสังหารจบสกอร์' }
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Top Club-Themed Transfer Window Banner */}
      <div
        className={`relative px-3.5 py-2 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl border shadow-2xs shrink-0 overflow-hidden ${
          tx.tw.open ? 'border-[var(--g)]/35' : 'border-[var(--line)]'
        }`}
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${clubK.c1} 12%, var(--surface)), var(--surface) 55%, color-mix(in srgb, ${clubK.c2} 7%, var(--surface)))`
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px]"
          style={{ background: `linear-gradient(90deg, ${clubK.c1}, ${clubK.c2})` }}
        />

        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 mland:gap-2 min-w-0">
          <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 mland:w-8 mland:h-8 rounded-xl mland:rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/75 shrink-0 [&>svg]:w-8 [&>svg]:h-8 sm:[&>svg]:w-9 sm:[&>svg]:h-9 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
              <ClubCrest name={me.name} size={36} team={me} club={clubK} isMyClub />
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className={`flex items-center gap-1.5 text-[10.5px] mland:text-[8.5px] font-bold leading-tight whitespace-nowrap truncate ${tx.tw.open ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                {tx.tw.open ? <Unlock className="w-3 h-3 shrink-0" /> : <Lock className="w-3 h-3 shrink-0" />}
                <span>{tx.tw.label}</span>
                <span className="hidden md:inline mland:inline font-medium text-[var(--mut)] truncate">
                  · {tx.tw.subLabel}
                </span>
              </div>
              <div className="flex items-baseline gap-2 min-w-0">
                <h2 className="font-display font-bold text-sm sm:text-base mland:text-xs text-[var(--ink)] truncate leading-snug">
                  ตลาดซื้อขายนักเตะ
                </h2>
                {tx.ffpLocked && (
                  <span className="text-[10.5px] mland:text-[9px] font-bold text-[var(--red)] whitespace-nowrap shrink-0">
                    · ล็อก FFP (งบติดลบ)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Structured KPI Readout */}
          <div className="flex items-center divide-x divide-[var(--line)]/75 text-right tabular shrink-0 overflow-x-auto max-w-full">
            <div className="pr-2.5 mland:pr-2">
              <div className="text-[9.5px] mland:text-[8px] font-semibold text-[var(--mut)] leading-none">งบสโมสร</div>
              <div className={`text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold mt-0.5 leading-tight whitespace-nowrap ${state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>
                <AnimatedMoney value={state.money} deltaPlacement="inline" />
              </div>
            </div>
            <div className="px-2.5 mland:px-2">
              <div className="text-[9.5px] mland:text-[8px] font-semibold text-[var(--mut)] leading-none">ค่าเหนื่อย/เพดาน</div>
              <div className={`text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold mt-0.5 leading-tight whitespace-nowrap ${tx.wagePct > 95 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                {fmtMoneyNum(tx.curWage)}/{fmtMoneyNum(tx.wageCap)}
                <span className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)] ml-1">({tx.wagePct}%)</span>
              </div>
            </div>
            <div className="px-2.5 mland:px-2">
              <div className="text-[9.5px] mland:text-[8px] font-semibold text-[var(--mut)] leading-none">ขนาดทีม</div>
              <div className="text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold text-[var(--ink)] mt-0.5 leading-tight whitespace-nowrap">
                {me.sq.length}/{tx.maxSquad}
              </div>
            </div>
            <div className="pl-2.5 mland:pl-2">
              <div className="text-[9.5px] mland:text-[8px] font-semibold text-[var(--mut)] leading-none">โควตายืม</div>
              <div className={`text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold mt-0.5 leading-tight whitespace-nowrap ${tx.loansCount >= tx.maxLoans ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>
                {tx.loansCount}/{tx.maxLoans}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6-Section Market Navigation */}
      <div className="seg-bar grid grid-cols-3 sm:grid-cols-6 mland:grid-cols-6 w-full shrink-0">
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
              className={`seg-btn min-w-0 gap-1 px-1 sm:px-2 ${active ? 'seg-btn-active' : ''}`}
            >
              <span className="inline-flex items-center justify-center gap-1 min-w-0">
                <span className="inline-flex items-center justify-center shrink-0 leading-none">{t.icon}</span>
                <span className="truncate whitespace-nowrap text-[10.5px] sm:text-xs mland:text-[10px]">{t.label}</span>
              </span>
              {t.count && (
                <span className={`hidden md:inline mland:inline text-[10px] mland:text-[8.5px] font-semibold tabular shrink-0 whitespace-nowrap ${active ? 'text-white/85' : 'text-[var(--mut)]'}`}>
                  ({t.count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: BUY & LOAN PLAYERS */}
      {activeTab === 'buy' && (
        <div className="grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[268px_1fr] mland:grid-cols-[228px_1fr] sm:grid-rows-[minmax(0,1fr)] mland:grid-rows-[minmax(0,1fr)] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
          {/* Left Filter & Source Sidebar */}
          <aside className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 max-h-[52vh] sm:max-h-none mland:max-h-none overflow-hidden shadow-2xs">
            {/* Sidebar Header */}
            <div className="shrink-0 px-3 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/55 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 mland:w-5 mland:h-5 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/30 text-[var(--g)] inline-flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 mland:w-2.5 mland:h-2.5" />
                </span>
                <div className="min-w-0 flex items-center gap-1.5">
                  <h3 className="font-extrabold text-xs mland:text-[10.5px] text-[var(--ink)] truncate">ตัวกรองตลาด</h3>
                  {activeBuyFilterChips.length > 0 && (
                    <span className="px-1.5 py-[1px] rounded-md bg-[var(--g)] text-white text-[9.5px] mland:text-[8px] font-black tabular shrink-0">
                      {activeBuyFilterChips.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasBuyFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      resetBuyFilters();
                    }}
                    className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--red)] hover:underline cursor-pointer"
                  >
                    ล้างค่า
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowMobileFilters((v) => !v)}
                  className="sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10.5px] font-bold text-[var(--ink)] cursor-pointer"
                >
                  <span>{showMobileFilters ? 'ซ่อน' : 'ตัวกรอง'}</span>
                  {showMobileFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Always-visible Quick Source + Search on Mobile, Full Stack on Desktop */}
            <div className="shrink-0 p-2.5 mland:p-2 border-b border-[var(--line)]/70 space-y-2 mland:space-y-1.5 bg-[var(--surface)]">
              <div className="p-0.5 rounded-xl bg-[var(--surface-2)]/85 border border-[var(--line)]/70 grid grid-cols-3 gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setMarketSource('mk');
                  }}
                  className={`py-1.5 mland:py-1 px-1 rounded-[9px] text-[10.5px] mland:text-[9px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    marketSource === 'mk'
                      ? 'bg-[var(--g)] text-white shadow-2xs'
                      : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  <TransferMarketIcon size={12} className="w-3 h-3 mland:w-2.5 mland:h-2.5 shrink-0" />
                  <span>ตลาดกลาง</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setMarketSource('club');
                    if (filter === 'FREE') setFilter('ALL');
                  }}
                  className={`py-1.5 mland:py-1 px-1 rounded-[9px] text-[10.5px] mland:text-[9px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    marketSource === 'club'
                      ? 'bg-[var(--g)] text-white shadow-2xs'
                      : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span>🏟️</span>
                  <span>สโมสร</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setMarketSource('created');
                    if (filter === 'FREE') setFilter('ALL');
                  }}
                  className={`py-1.5 mland:py-1 px-1 rounded-[9px] text-[10.5px] mland:text-[9px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    marketSource === 'created'
                      ? 'bg-[var(--g)] text-white shadow-2xs'
                      : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span>⭐</span>
                  <span>สร้างเอง</span>
                </button>
              </div>

              <div className="relative group">
                <Search className="w-3.5 h-3.5 mland:w-3 mland:h-3 text-[var(--mut)] group-focus-within:text-[var(--g)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={marketSource === 'club' ? 'ค้นชื่อนักเตะ, สโมสร, ตำแหน่ง...' : 'ค้นชื่อนักเตะ หรือตำแหน่ง...'}
                  aria-label="ค้นหานักเตะ"
                  className="w-full pl-8 pr-7 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/65 border border-[var(--line)] text-xs mland:text-[10px] text-[var(--ink)] placeholder:text-[var(--mut)]/75 focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--g)] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="ล้างคำค้นหา"
                    className="w-5 h-5 rounded-md inline-flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Detailed Filter Controls */}
            <div className={`${showMobileFilters ? 'flex' : 'hidden sm:flex mland:flex'} flex-col flex-1 min-h-0 overflow-y-auto px-3 py-2.5 mland:px-2.5 mland:py-2 divide-y divide-[var(--line)]/60`}>
              {/* Position & Role */}
              <div className="pb-2.5 mland:pb-1.5 space-y-1.5 mland:space-y-1">
                <div className="flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold uppercase tracking-wide text-[var(--mut)]">
                  <span>ตำแหน่งหลัก &amp; บทบาท</span>
                  {filter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter('ALL');
                        setSubFilter('ALL');
                      }}
                      className="text-[var(--g)] normal-case font-bold hover:underline cursor-pointer"
                    >
                      รีเซ็ต
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {([['ALL', 'ทั้งหมด'], ['GK', 'GK'], ['DF', 'กองหลัง'], ['MF', 'กองกลาง'], ['FW', 'กองหน้า'], ...(marketSource === 'mk' ? [['FREE', 'เซ็นฟรี'] as const] : [])] as const).map(([k, l]) => {
                    const active = filter === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setFilter(k);
                          setSubFilter('ALL');
                        }}
                        className={`py-1 mland:py-0.5 px-1.5 rounded-lg border text-[10.5px] mland:text-[9px] font-bold cursor-pointer transition-all truncate ${
                          active
                            ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-2xs'
                            : 'bg-[var(--surface-2)]/55 border-[var(--line)] text-[var(--ink)]/85 hover:border-[var(--g)]/55 hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
                <select
                  aria-label="กรองตำแหน่งย่อย"
                  value={subFilter}
                  onChange={(e) => setSubFilter(e.target.value as 'ALL' | SubRole)}
                  className="w-full px-2.5 py-1.5 mland:py-1 rounded-lg bg-[var(--surface-2)]/60 border border-[var(--line)] text-[11px] mland:text-[9.5px] font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[var(--g)]"
                >
                  <option value="ALL">บทบาทเฉพาะ: ทั้งหมด</option>
                  {availableSubRoles.map((role) => (
                    <option key={role} value={role}>
                      {role} · {SPN[role] || role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Age & OVR */}
              <div className="py-2.5 mland:py-1.5 space-y-2 mland:space-y-1">
                <div className="space-y-1">
                  <div className="text-[10px] mland:text-[8.5px] font-extrabold uppercase tracking-wide text-[var(--mut)]">
                    ช่วงอายุ
                  </div>
                  <div className="p-0.5 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--line)]/70 grid grid-cols-4 gap-0.5">
                    {([['ALL', 'ทั้งหมด'], ['u21', '≤21'], ['prime', '22–28'], ['vet', '29+']] as const).map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setAgeRangeFilter(k);
                        }}
                        className={`py-1 mland:py-0.5 rounded-[6px] text-[10px] mland:text-[8.5px] font-bold tabular cursor-pointer transition-all ${
                          ageRangeFilter === k
                            ? 'bg-[var(--surface)] text-[var(--g)] shadow-2xs border border-[var(--g)]/35'
                            : 'text-[var(--mut)] hover:text-[var(--ink)] border border-transparent'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] mland:text-[8.5px] font-extrabold uppercase tracking-wide text-[var(--mut)]">
                    OVR ขั้นต่ำ
                  </div>
                  <div className="p-0.5 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--line)]/70 grid grid-cols-5 gap-0.5">
                    {([0, 65, 70, 75, 80] as const).map((ov) => (
                      <button
                        key={ov}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setMinOvFilter(ov);
                        }}
                        className={`py-1 mland:py-0.5 rounded-[6px] text-[10px] mland:text-[8.5px] font-bold tabular cursor-pointer transition-all ${
                          minOvFilter === ov
                            ? 'bg-[var(--surface)] text-[var(--g)] shadow-2xs border border-[var(--g)]/35'
                            : 'text-[var(--mut)] hover:text-[var(--ink)] border border-transparent'
                        }`}
                      >
                        {ov === 0 ? 'ทุก' : `${ov}+`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Budget & Extra Options */}
              <div className="pt-2.5 mland:pt-1.5 space-y-2 mland:space-y-1.5">
                <div className="space-y-0.5">
                  <div className="text-[10px] mland:text-[8.5px] font-extrabold uppercase tracking-wide text-[var(--mut)]">
                    งบค่าตัวสูงสุด
                  </div>
                  <select
                    aria-label="กรองงบประมาณสูงสุด"
                    value={maxBudgetFilter}
                    onChange={(e) => setMaxBudgetFilter(e.target.value as 'ALL' | 'AFFORD' | '15' | '35' | '70' | '120')}
                    className="w-full px-2.5 py-1.5 mland:py-1 rounded-lg bg-[var(--surface-2)]/60 border border-[var(--line)] text-[11px] mland:text-[9.5px] font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[var(--g)]"
                  >
                    <option value="ALL">ไม่จำกัดงบ</option>
                    <option value="AFFORD">ไม่เกินงบที่มี ({fmtMoneyNum(Math.max(0, Math.floor(state.money)))})</option>
                    <option value="15">≤ {fmtMoneyNum(15)}</option>
                    <option value="35">≤ {fmtMoneyNum(35)}</option>
                    <option value="70">≤ {fmtMoneyNum(70)}</option>
                    <option value="120">≤ {fmtMoneyNum(120)}</option>
                  </select>
                </div>

                {marketSource === 'club' && (
                  <div className="space-y-1">
                    <div className="text-[10px] mland:text-[8.5px] font-extrabold uppercase tracking-wide text-[var(--mut)]">
                      ขอบเขตสโมสร
                    </div>
                    <div className="p-0.5 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--line)]/70 grid grid-cols-2 gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setClubTierFilter('MY_TIER');
                        }}
                        className={`py-1 mland:py-0.5 rounded-[6px] text-[10px] mland:text-[8.5px] font-bold cursor-pointer transition-all ${
                          clubTierFilter === 'MY_TIER'
                            ? 'bg-[var(--surface)] text-[var(--g)] shadow-2xs border border-[var(--g)]/35'
                            : 'text-[var(--mut)] hover:text-[var(--ink)] border border-transparent'
                        }`}
                      >
                        ลีกใกล้เคียง
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setClubTierFilter('ALL');
                        }}
                        className={`py-1 mland:py-0.5 rounded-[6px] text-[10px] mland:text-[8.5px] font-bold cursor-pointer transition-all ${
                          clubTierFilter === 'ALL'
                            ? 'bg-[var(--surface)] text-[var(--g)] shadow-2xs border border-[var(--g)]/35'
                            : 'text-[var(--mut)] hover:text-[var(--ink)] border border-transparent'
                        }`}
                      >
                        ทุกลีก
                      </button>
                    </div>
                  </div>
                )}

                {marketSource !== 'created' && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={loanOnlyFilter}
                    onClick={() => {
                      SFX.tap();
                      setLoanOnlyFilter((v) => !v);
                      if (!loanOnlyFilter && filter === 'FREE') setFilter('ALL');
                    }}
                    className={`w-full px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg border text-[11px] mland:text-[9.5px] font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      loanOnlyFilter
                        ? 'bg-[var(--g-soft)] border-[var(--g)]/55 text-[var(--g)]'
                        : 'bg-[var(--surface-2)]/55 border-[var(--line)] text-[var(--ink)]/85 hover:border-[var(--g)]/40'
                    }`}
                  >
                    <span>🤝 เฉพาะยืมตัวได้</span>
                    <span
                      className={`w-7 h-4 rounded-full p-0.5 inline-flex items-center transition-colors shrink-0 ${
                        loanOnlyFilter ? 'bg-[var(--g)] justify-end' : 'bg-[var(--line)] justify-start'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full bg-white shadow-2xs" />
                    </span>
                  </button>
                )}
              </div>
            </div>

            {marketSource === 'mk' && (
              <div className="shrink-0 p-2.5 mland:p-2 border-t border-[var(--line)] bg-[var(--surface-2)]/45">
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
                  className="btn btn-sm btn-surface w-full justify-between px-3"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 mland:w-3 mland:h-3 text-[var(--g)]" />
                    <span>หาชุดใหม่</span>
                  </span>
                  <span className="text-[10.5px] font-extrabold text-[var(--mut)] tabular">{fmtMoneyNum(15)}</span>
                </button>
              </div>
            )}
          </aside>

          {/* Right Player List */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden shadow-2xs">
            {/* List Top Header */}
            <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/45 space-y-1.5 mland:space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-extrabold text-xs sm:text-sm mland:text-[11px] text-[var(--ink)] truncate">
                    {marketSource === 'mk' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <TransferMarketIcon size={15} className="w-4 h-4 mland:w-[13px] mland:h-[13px] mland:!text-[12px]" />
                        <span>รายชื่อนักเตะในตลาดกลาง</span>
                      </span>
                    ) : marketSource === 'club'
                        ? '🏟️ นักเตะจากสโมสรในลีก'
                        : '⭐ นักเตะที่คุณสร้างเอง'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[10.5px] mland:text-[9px] text-[var(--ink)] font-extrabold tabular whitespace-nowrap">
                    {activeCount} คน
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0 ml-auto">
                  <span className="hidden lg:inline text-[10px] text-[var(--mut)]">กดหัวตารางเพื่อเรียงลำดับ</span>
                  {marketSource === 'created' ? (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--g-soft)] border border-[var(--g)]/30 text-[10px] mland:text-[8.5px] text-[var(--g)] font-bold whitespace-nowrap">
                      🌱 ดึงเป็นเด็กปั้นได้ทุกเวลา
                    </span>
                  ) : tx.tw.open ? (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--g-soft)] border border-[var(--g)]/30 text-[10px] mland:text-[8.5px] text-[var(--g)] font-bold whitespace-nowrap">
                      ● ตลาดเปิด · พร้อมเจรจา
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)] whitespace-nowrap">
                      {marketSource === 'mk' ? '🔒 ปิดตลาด · เซ็นได้เฉพาะฟรีเอเยนต์' : '🔒 รอเปิดตลาดซื้อขาย'}
                    </span>
                  )}
                </div>
              </div>

              {activeBuyFilterChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {activeBuyFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.clear}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--red)]/50 hover:text-[var(--red)] text-[10px] mland:text-[8.5px] font-semibold text-[var(--ink)] cursor-pointer transition-colors"
                    >
                      <span>{chip.label}</span>
                      <X className="w-2.5 h-2.5 opacity-65" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Squad-Style Roster Table Header (Always Visible & Clickable to Sort) */}
            {activeCount > 0 && (
              <div className="grid grid-cols-[minmax(0,1fr)_52px_56px_114px] sm:grid-cols-[minmax(0,1.4fr)_54px_58px_124px] md:grid-cols-[minmax(0,1.5fr)_34px_58px_64px_148px] lg:grid-cols-[minmax(0,1.65fr)_36px_64px_74px_92px_190px] mland:grid-cols-[minmax(0,1.45fr)_28px_48px_56px_128px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 border-b border-[var(--line)] shrink-0">
                <div className="flex items-center justify-start min-w-0">
                  <SortableColHeader
                    label="นักเตะ"
                    active={buySortCol === 'pos'}
                    dir={buySortDir}
                    onClick={() => toggleSortCol('pos', buySortCol, setBuySortCol, setBuySortDir)}
                    align="left"
                    title="เรียงตามตำแหน่ง (GK → DF → MF → FW)"
                  />
                </div>
                <div className="hidden md:flex mland:flex items-center justify-center">
                  <SortableColHeader
                    label="อายุ"
                    active={buySortCol === 'age'}
                    dir={buySortDir}
                    onClick={() => toggleSortCol('age', buySortCol, setBuySortCol, setBuySortDir)}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <SortableColHeader
                    label="OVR"
                    active={buySortCol === 'ov'}
                    dir={buySortDir}
                    onClick={() => toggleSortCol('ov', buySortCol, setBuySortCol, setBuySortDir)}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <SortableColHeader
                    label="สถานะ/ฟิต"
                    active={buySortCol === 'fit'}
                    dir={buySortDir}
                    onClick={() => toggleSortCol('fit', buySortCol, setBuySortCol, setBuySortDir)}
                  />
                </div>
                <div className="hidden lg:flex items-center justify-end">
                  <SortableColHeader
                    label="ค่าตัว / ค่าเหนื่อย"
                    active={buySortCol === 'price'}
                    dir={buySortDir}
                    onClick={() => toggleSortCol('price', buySortCol, setBuySortCol, setBuySortDir)}
                    align="right"
                  />
                </div>
                <div className="text-right">เจรจา</div>
              </div>
            )}

            {/* Player Roster Rows */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]">
              {marketSource === 'mk' ? (
                marketList.length > 0 ? (
                  marketList.map(({ q, i }) => {
                    const blockedByWindow = !tx.tw.open && !q.free;
                    const askWage = q.askWg || wagOf(q);
                    const shortlisted = isPlayerShortlisted(state, q.n);
                    const canLoanQuick = !q.free && !q.locked && !blockedByWindow && tx.loansCount < tx.maxLoans;
                    const bio = getPlayerBio(q);
                    const footMeta = getFootColorMeta(bio.foot);
                    const f = getStaminaMeta(q.fit).f;
                    const unavailable = q.inj > 0 || (q.sus || 0) > 0;
                    return (
                      <div
                        key={`${q.n}-${i}`}
                        className={`grid grid-cols-[minmax(0,1fr)_52px_56px_114px] sm:grid-cols-[minmax(0,1.4fr)_54px_58px_124px] md:grid-cols-[minmax(0,1.5fr)_34px_58px_64px_148px] lg:grid-cols-[minmax(0,1.65fr)_36px_64px_74px_92px_190px] mland:grid-cols-[minmax(0,1.45fr)_28px_48px_56px_128px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 transition-colors ${
                          unavailable ? 'bg-rose-500/[0.05] hover:bg-rose-500/[0.09]' : 'hover:bg-[var(--surface-2)]/45'
                        } ${blockedByWindow ? 'opacity-65' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(q, null)}
                          title="กดเพื่อดูการ์ดและค่าพลังนักเตะ"
                          className="flex items-center gap-1.5 sm:gap-2 mland:gap-1 min-w-0 text-left cursor-pointer group"
                        >
                          <div className="shrink-0 [&>svg]:w-8 [&>svg]:h-8 sm:[&>svg]:w-9 sm:[&>svg]:h-9 mland:[&>svg]:w-7 mland:[&>svg]:h-7 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/75 group-hover:border-[var(--g)]/60 p-0.5 transition-colors">
                            <PlayerFace player={q} size={36} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs mland:text-[10px] truncate leading-tight flex items-center gap-1">
                              <PositionBadge role={q.ro} size="2xs" />
                              <span className="truncate group-hover:text-[var(--g)] group-hover:underline transition-colors">{q.n}</span>
                              {q.free ? (
                                <span className="text-[9px] mland:text-[7.5px] px-1 py-[0.5px] rounded bg-[var(--g-soft)] border border-[var(--g)]/30 text-[var(--g)] font-bold shrink-0">ฟรี</span>
                              ) : q.age <= 19 ? (
                                <span className="text-[9px] mland:text-[7.5px] px-1 py-[0.5px] rounded bg-[var(--lamp-soft)] border border-[var(--lamp)]/35 text-[#9a6700] dark:text-[var(--lamp)] font-bold shrink-0">ดาวรุ่ง</span>
                              ) : null}
                            </div>
                            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1 tabular mt-0.5">
                              <span className="md:hidden mland:hidden shrink-0">{q.age} ปี ·</span>
                              <PotentialBadge pot={q.pot || q.ov} variant="inline" size="xs" />
                              <span
                                className="hidden sm:inline-flex mland:inline-flex items-center gap-1 px-1.5 py-[0.5px] rounded-md border bg-[var(--surface-2)]/75 border-[var(--line)] text-[9.5px] mland:text-[8px] font-bold tabular leading-tight shrink-0 whitespace-nowrap"
                                title={`สูง ${bio.heightCm} ซม. · หนัก ${bio.weightKg} กก. · ${footMeta.titleText}`}
                              >
                                <span className="text-[var(--ink)]/85">{bio.heightCm}/{bio.weightKg}</span>
                                <FootPairIcon foot={bio.foot} size="xs" />
                              </span>
                              <span className="lg:hidden font-semibold text-[var(--ink)]/85 truncate">
                                · {q.free ? 'ไร้ค่าตัว' : fmtMoneyNum(q.price || 0)} ({fmtMoneyNum(askWage)}/น)
                              </span>
                            </div>
                          </div>
                        </button>

                        <div className="hidden md:block mland:block text-center text-xs mland:text-[10px] tabular font-semibold">
                          {q.age}
                        </div>

                        <div className="flex items-center justify-center gap-0.5">
                          <OvrBadge ov={q.ov} size="sm" />
                          <span className="text-[9px] mland:text-[8px] text-[var(--mut)] tabular hidden sm:inline mland:inline">/{q.pot || q.ov}</span>
                        </div>

                        <div className="flex items-center justify-center min-w-0">
                          <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
                        </div>

                        <div className="hidden lg:block text-right text-[10.5px] tabular whitespace-nowrap">
                          <div className={`font-bold leading-tight ${q.free ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                            {q.free ? 'ไร้ค่าตัว' : fmtMoneyNum(q.price || 0)}
                          </div>
                          <div className="text-[var(--mut)] leading-tight">
                            {fmtMoneyNum(askWage)}/นัด
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1 mland:gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleShortlist(q, { source: 'mk' })}
                            title={shortlisted ? 'นำออกจากรายชื่อที่สนใจ' : 'เพิ่มเข้ารายชื่อที่สนใจ'}
                            aria-label={shortlisted ? `นำ ${q.n} ออกจากรายชื่อที่สนใจ` : `เพิ่ม ${q.n} เข้ารายชื่อที่สนใจ`}
                            className={`w-6 h-6 mland:w-5 mland:h-5 rounded-md border inline-flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 ${
                              shortlisted
                                ? 'bg-amber-400/20 border-amber-500/70 text-amber-500 dark:text-amber-300'
                                : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-amber-500 hover:border-amber-400/60'
                            }`}
                          >
                            <Star className={`w-3 h-3 mland:w-2.5 mland:h-2.5 shrink-0 ${shortlisted ? 'fill-amber-400 text-amber-500 dark:text-amber-300' : ''}`} />
                          </button>
                          {!q.free && (
                            <button
                              type="button"
                              disabled={!canLoanQuick}
                              onClick={() => openNegotiation('mk', i, q, undefined, 'loan')}
                              title={tx.loansCount >= tx.maxLoans ? `โควตายืมเต็ม ${tx.maxLoans} คน` : 'เจรจายืมตัว 1 ฤดูกาล'}
                              className="btn btn-xs btn-secondary shrink-0 px-1.5"
                            >
                              🤝
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!!q.locked || blockedByWindow}
                            onClick={() => openNegotiation('mk', i, q, undefined, q.free ? 'free' : 'cash')}
                            className={`btn btn-xs min-w-[54px] sm:min-w-[68px] mland:min-w-[52px] shrink-0 ${
                              blockedByWindow ? 'btn-secondary text-[var(--mut)]' : 'btn-primary'
                            }`}
                          >
                            {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิด' : q.free ? 'เซ็นฟรี' : `ซื้อ ${fmtMoneyNum(q.price || 0)}`}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2.5">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center text-[var(--mut)]">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-[var(--ink)]">ไม่พบนักเตะตามเงื่อนไขที่เลือก</p>
                      <p className="text-[11px] text-[var(--mut)]">ลองปรับช่วงอายุ OVR หรือล้างตัวกรองเพื่อดูนักเตะทั้งหมด</p>
                    </div>
                    <button
                      type="button"
                      onClick={resetBuyFilters}
                      className="btn btn-sm btn-secondary"
                    >
                      ล้างตัวกรองทั้งหมด
                    </button>
                  </div>
                )
              ) : marketSource === 'club' ? (
                clubMarketList.length > 0 ? (
                  clubMarketList.map(({ q, team, idx, price }) => {
                    const blockedByWindow = !tx.tw.open;
                    const shortlisted = isPlayerShortlisted(state, q.n, team.id);
                    const canLoanClub = !q.locked && !blockedByWindow && tx.loansCount < tx.maxLoans && team.sq.length > 16;
                    const bio = getPlayerBio(q);
                    const footMeta = getFootColorMeta(bio.foot);
                    const f = getStaminaMeta(q.fit).f;
                    const unavailable = q.inj > 0 || (q.sus || 0) > 0;
                    return (
                      <div
                        key={`${team.id}-${q.n}-${idx}`}
                        className={`grid grid-cols-[minmax(0,1fr)_52px_56px_114px] sm:grid-cols-[minmax(0,1.4fr)_54px_58px_124px] md:grid-cols-[minmax(0,1.5fr)_34px_58px_64px_148px] lg:grid-cols-[minmax(0,1.65fr)_36px_64px_74px_92px_190px] mland:grid-cols-[minmax(0,1.45fr)_28px_48px_56px_128px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 transition-colors ${
                          unavailable ? 'bg-rose-500/[0.05] hover:bg-rose-500/[0.09]' : 'hover:bg-[var(--surface-2)]/45'
                        } ${blockedByWindow ? 'opacity-65' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(q, team)}
                          title="กดเพื่อดูการ์ดและค่าพลังนักเตะ"
                          className="flex items-center gap-1.5 sm:gap-2 mland:gap-1 min-w-0 text-left cursor-pointer group"
                        >
                          <span className="hidden sm:inline-flex shrink-0 [&>svg]:w-4 [&>svg]:h-4 mland:[&>svg]:w-3.5 mland:[&>svg]:h-3.5">
                            <ClubCrest name={team.name} size={16} team={team} club={state.club} />
                          </span>
                          <div className="shrink-0 [&>svg]:w-8 [&>svg]:h-8 sm:[&>svg]:w-9 sm:[&>svg]:h-9 mland:[&>svg]:w-7 mland:[&>svg]:h-7 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/75 group-hover:border-[var(--g)]/60 p-0.5 transition-colors">
                            <PlayerFace player={q} team={team} state={state} size={36} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs mland:text-[10px] truncate leading-tight flex items-center gap-1">
                              <PositionBadge role={q.ro} size="2xs" />
                              <span className="truncate group-hover:text-[var(--g)] group-hover:underline transition-colors">{q.n}</span>
                              <span className="hidden sm:inline-flex items-center gap-1 px-1 py-[0.5px] rounded bg-[var(--surface-2)] border border-[var(--line)]/80 text-[9.5px] mland:text-[8px] font-semibold text-[var(--ink)]/85 truncate shrink">
                                {team.name}
                              </span>
                            </div>
                            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1 tabular mt-0.5">
                              <span className="truncate">{TN[team.tier]}<span className="md:hidden mland:hidden"> · {q.age} ปี</span></span>
                              <PotentialBadge pot={q.pot || q.ov} variant="inline" size="xs" />
                              <span
                                className="hidden sm:inline-flex mland:inline-flex items-center gap-1 px-1.5 py-[0.5px] rounded-md border bg-[var(--surface-2)]/75 border-[var(--line)] text-[9.5px] mland:text-[8px] font-bold tabular leading-tight shrink-0 whitespace-nowrap"
                                title={`สูง ${bio.heightCm} ซม. · หนัก ${bio.weightKg} กก. · ${footMeta.titleText}`}
                              >
                                <span className="text-[var(--ink)]/85">{bio.heightCm}/{bio.weightKg}</span>
                                <FootPairIcon foot={bio.foot} size="xs" />
                              </span>
                              <span className="lg:hidden font-semibold text-[var(--ink)]/85 truncate">
                                · ~{fmtMoneyNum(price)}
                              </span>
                            </div>
                          </div>
                        </button>

                        <div className="hidden md:block mland:block text-center text-xs mland:text-[10px] tabular font-semibold">
                          {q.age}
                        </div>

                        <div className="flex items-center justify-center gap-0.5">
                          <OvrBadge ov={q.ov} size="sm" />
                          <span className="text-[9px] mland:text-[8px] text-[var(--mut)] tabular hidden sm:inline mland:inline">/{q.pot || q.ov}</span>
                        </div>

                        <div className="flex items-center justify-center min-w-0">
                          <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
                        </div>

                        <div className="hidden lg:block text-right text-[10.5px] tabular whitespace-nowrap">
                          <div className="font-bold text-[var(--ink)] leading-tight">~{fmtMoneyNum(price)}</div>
                          <div className="text-[var(--mut)] leading-tight">~{fmtMoneyNum(wagOf(q))}/นัด</div>
                        </div>

                        <div className="flex items-center justify-end gap-1 mland:gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleShortlist(q, {
                                source: 'club',
                                clubTeamId: team.id,
                                clubName: team.name
                              })
                            }
                            title={shortlisted ? 'นำออกจากรายชื่อที่สนใจ' : 'เพิ่มเข้ารายชื่อที่สนใจ'}
                            aria-label={shortlisted ? `นำ ${q.n} ออกจากรายชื่อที่สนใจ` : `เพิ่ม ${q.n} เข้ารายชื่อที่สนใจ`}
                            className={`w-6 h-6 mland:w-5 mland:h-5 rounded-md border inline-flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 ${
                              shortlisted
                                ? 'bg-amber-400/20 border-amber-500/70 text-amber-500 dark:text-amber-300'
                                : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-amber-500 hover:border-amber-400/60'
                            }`}
                          >
                            <Star className={`w-3 h-3 mland:w-2.5 mland:h-2.5 shrink-0 ${shortlisted ? 'fill-amber-400 text-amber-500 dark:text-amber-300' : ''}`} />
                          </button>
                          <button
                            type="button"
                            disabled={!canLoanClub}
                            onClick={() => openNegotiation('club', idx, q, team, 'loan')}
                            title={tx.loansCount >= tx.maxLoans ? `โควตายืมเต็ม ${tx.maxLoans} คน` : 'เจรจาขอยืมตัวจากสโมสรนี้'}
                            className="btn btn-xs btn-secondary shrink-0 px-1.5"
                          >
                            🤝
                          </button>
                          <button
                            type="button"
                            disabled={!!q.locked || blockedByWindow}
                            onClick={() => openNegotiation('club', idx, q, team, 'cash')}
                            className={`btn btn-xs min-w-[54px] sm:min-w-[68px] mland:min-w-[52px] shrink-0 ${
                              blockedByWindow ? 'btn-secondary text-[var(--mut)]' : 'btn-primary'
                            }`}
                          >
                            {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิด' : `ซื้อ ${fmtMoneyNum(price)}`}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2.5">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center text-xl opacity-80">
                      🏟️
                    </div>
                    <p className="text-xs font-bold text-[var(--ink)]">ไม่พบนักเตะในสโมสรอื่นตามตัวกรอง</p>
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
                      recordTransferLog(d, {
                        season: d.season,
                        md: d.md,
                        playerName: incoming.n,
                        pos: incoming.pos,
                        ro: incoming.ro,
                        age: incoming.age,
                        ov: incoming.ov,
                        kind: fee > 0 ? 'buy' : 'youth',
                        fromTeamId: -1,
                        fromTeamName: cand.clubName || 'เด็กปั้นสโมสร',
                        toTeamId: d.me,
                        toTeamName: t.name,
                        fee,
                        wage: wg
                      });
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
                  const createdShortlisted = isPlayerShortlisted(state, q.n);
                  const bio = getPlayerBio(q);
                  const footMeta = getFootColorMeta(bio.foot);
                  const f = getStaminaMeta(q.fit).f;
                  return (
                    <div
                      key={cand.key}
                      className="grid grid-cols-[minmax(0,1fr)_52px_56px_114px] sm:grid-cols-[minmax(0,1.4fr)_54px_58px_124px] md:grid-cols-[minmax(0,1.5fr)_34px_58px_64px_148px] lg:grid-cols-[minmax(0,1.65fr)_36px_64px_74px_92px_190px] mland:grid-cols-[minmax(0,1.45fr)_28px_48px_56px_128px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 hover:bg-[var(--surface-2)]/45 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(q, null)}
                        title="กดเพื่อดูการ์ดและค่าพลังนักเตะ"
                        className="flex items-center gap-1.5 sm:gap-2 mland:gap-1 min-w-0 text-left cursor-pointer group"
                      >
                        <div className="shrink-0 [&>svg]:w-8 [&>svg]:h-8 sm:[&>svg]:w-9 sm:[&>svg]:h-9 mland:[&>svg]:w-7 mland:[&>svg]:h-7 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/75 group-hover:border-[var(--g)]/60 p-0.5 transition-colors">
                          <PlayerFace player={q} team={me} state={state} size={36} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs mland:text-[10px] truncate leading-tight flex items-center gap-1">
                            <PositionBadge role={q.ro} size="2xs" />
                            <span className="truncate group-hover:text-[var(--g)] group-hover:underline transition-colors">{q.n}</span>
                            <span className="text-[9px] mland:text-[7.5px] px-1 py-[0.5px] rounded bg-[var(--g-soft)] border border-[var(--g)]/30 text-[var(--g)] font-bold shrink-0">🌱 เด็กปั้น</span>
                          </div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1 tabular mt-0.5">
                            <span className="truncate">
                              {cand.sourceLabel}
                              {cand.sourceType === 'career_save' && cand.clubName ? ` · ${cand.clubName}` : ''}
                              <span className="md:hidden mland:hidden"> · {q.age} ปี</span>
                            </span>
                            <PotentialBadge pot={cand.pot} variant="inline" size="xs" className="shrink-0" />
                            <span
                              className="hidden sm:inline-flex mland:inline-flex items-center gap-1 px-1.5 py-[0.5px] rounded-md border bg-[var(--surface-2)]/75 border-[var(--line)] text-[9.5px] mland:text-[8px] font-bold tabular leading-tight shrink-0 whitespace-nowrap"
                              title={`สูง ${bio.heightCm} ซม. · หนัก ${bio.weightKg} กก. · ${footMeta.titleText}`}
                            >
                              <span className="text-[var(--ink)]/85">{bio.heightCm}/{bio.weightKg}</span>
                              <FootPairIcon foot={bio.foot} size="xs" />
                            </span>
                          </div>
                          <div className="hidden sm:flex text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular truncate leading-tight mt-0.5 flex-wrap items-center gap-x-1">
                            <span>
                              ยิง <b className="text-[var(--ink)]">{coreA.sh}</b> · จ่าย <b className="text-[var(--ink)]">{coreA.ps}</b> · เลี้ยง <b className="text-[var(--ink)]">{coreA.dr}</b> · แย่ง <b className="text-[var(--ink)]">{coreA.tk}</b>
                            </span>
                            {cs.apps > 0 && (
                              <span className="inline-flex items-center gap-1 text-[var(--g)] font-semibold">
                                <span>· {cs.apps}น</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <StatIconBadge kind="goal" size="xs" /> {cs.goals}
                                </span>
                                {q.pos === 'GK' ? (
                                  <span className="inline-flex items-center gap-0.5">
                                    <StatIconBadge kind="cleansheet" size="xs" /> {cs.cleanSheets}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5">
                                    <StatIconBadge kind="assist" size="xs" /> {cs.assists}
                                  </span>
                                )}
                                {cs.avgRating > 0 && <span className={`font-bold ${getRatingPalette(cs.avgRating).textCls}`}>⭐{cs.avgRating.toFixed(1)}</span>}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="hidden md:block mland:block text-center text-xs mland:text-[10px] tabular font-semibold">
                        {q.age}
                      </div>

                      <div className="flex items-center justify-center gap-0.5">
                        <OvrBadge ov={q.ov} size="sm" />
                        <span className="text-[9px] mland:text-[8px] text-[var(--mut)] tabular hidden sm:inline mland:inline">/{cand.pot || q.ov}</span>
                      </div>

                      <div className="flex items-center justify-center min-w-0">
                        <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
                      </div>

                      <div className="hidden lg:block text-right text-[10.5px] tabular whitespace-nowrap">
                        <div className="font-bold text-[var(--g)] leading-tight">ปั้นฟรี / {fmtMoneyNum(cand.price)}</div>
                        <div className="text-[var(--mut)] leading-tight">{fmtMoneyNum(wagOf(q))}/นัด</div>
                      </div>

                      <div className="flex items-center justify-end gap-1 mland:gap-0.5 shrink-0">
                        {alreadyInSquad ? (
                          <span className="text-[10.5px] mland:text-[9px] text-[var(--g)] font-bold whitespace-nowrap px-1.5">
                            ✓ อยู่ในทีม
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleShortlist(q, { source: 'created', clubName: cand.clubName || cand.sourceLabel })}
                              title={createdShortlisted ? 'นำออกจากรายชื่อที่สนใจ' : 'เพิ่มเข้ารายชื่อที่สนใจ'}
                              aria-label={createdShortlisted ? `นำ ${q.n} ออกจากรายชื่อที่สนใจ` : `เพิ่ม ${q.n} เข้ารายชื่อที่สนใจ`}
                              className={`w-6 h-6 mland:w-5 mland:h-5 rounded-md border inline-flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 ${
                                createdShortlisted
                                  ? 'bg-amber-400/20 border-amber-500/70 text-amber-500 dark:text-amber-300'
                                  : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-amber-500 hover:border-amber-400/60'
                              }`}
                            >
                              <Star className={`w-3 h-3 mland:w-2.5 mland:h-2.5 shrink-0 ${createdShortlisted ? 'fill-amber-400 text-amber-500 dark:text-amber-300' : ''}`} />
                            </button>
                            <button
                              type="button"
                              disabled={squadFull}
                              onClick={() => signCreatedPlayer(false)}
                              className="btn btn-xs btn-primary shrink-0 px-1.5"
                              title="ดึงเข้าทีมฟรีในฐานะเด็กปั้นสโมสร"
                            >
                              🌱 ฟรี
                            </button>
                            <button
                              type="button"
                              disabled={squadFull || state.money < cand.price || (tx.ffpLocked && cand.price > 0)}
                              onClick={() => signCreatedPlayer(true)}
                              className="btn btn-xs btn-gold shrink-0 px-1.5"
                              title="ซื้อตัวเข้าทีมพร้อมสัญลักษณ์เด็กปั้น"
                            >
                              {fmtMoneyNum(cand.price)}
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
                                className="w-6 h-6 mland:w-5 mland:h-5 rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--mut)] hover:text-[var(--red)] hover:border-[var(--red)]/50 inline-flex items-center justify-center cursor-pointer shrink-0 transition-all"
                              >
                                <Trash2 className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2">
                  <div className="text-2xl opacity-75">⭐</div>
                  <p className="text-xs font-bold text-[var(--ink)]">ยังไม่มีนักเตะที่คุณสร้างเอง</p>
                  <p className="text-[11px] text-[var(--mut)] max-w-xs">สร้างนักเตะในหน้าเมนูหลัก (โหมดนักเตะ หรือ สร้างนักเตะเก็บไว้) แล้วกลับมาซื้อหรือดึงเป็นเด็กปั้นที่นี่ได้เลย</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* SECTION 1B: SHORTLIST / WATCHLIST */}
      {activeTab === 'shortlist' && (
        <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col flex-1 min-h-0 overflow-hidden shadow-2xs">
          <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                ⭐ รายชื่อนักเตะที่สนใจ ({filteredShortlist.length}/{shortlistResolved.length})
              </h3>
              <span className="hidden sm:inline text-[11px] mland:text-[9.5px] text-[var(--mut)]">
                ติดตามสถานะและยื่นซื้อ/ขอยืมได้ทันที
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="seg-bar">
                {([
                  ['all', 'ทั้งหมด'],
                  ['ready', 'พร้อมเจรจา'],
                  ['free', 'ฟรีเอเยนต์'],
                  ['club', 'สโมสรอื่น']
                ] as const).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setShortlistFilter(k)}
                    className={`seg-btn ${shortlistFilter === k ? 'seg-btn-active' : ''}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              {shortlistResolved.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onUpdateState((d) => {
                      d.shortlist = [];
                    });
                    onToast('ล้างรายชื่อที่สนใจทั้งหมดแล้ว');
                  }}
                  className="btn btn-xs btn-ghost hover:text-[var(--red)]"
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>
          </div>

          {filteredShortlist.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_52px_56px_118px] sm:grid-cols-[minmax(0,1.45fr)_34px_58px_64px_150px] lg:grid-cols-[minmax(0,1.65fr)_36px_64px_74px_96px_190px] mland:grid-cols-[minmax(0,1.5fr)_28px_50px_58px_72px_142px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3.5 mland:px-2 py-1.5 mland:py-1 bg-[var(--surface-2)]/70 border-b border-[var(--line)] text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] shrink-0">
              <div className="flex items-center justify-start min-w-0">
                <SortableColHeader
                  label="นักเตะ"
                  active={shortlistSortCol === 'pos'}
                  dir={shortlistSortDir}
                  onClick={() => toggleSortCol('pos', shortlistSortCol, setShortlistSortCol, setShortlistSortDir)}
                  align="left"
                />
              </div>
              <div className="hidden sm:flex mland:flex items-center justify-center">
                <SortableColHeader
                  label="อายุ"
                  active={shortlistSortCol === 'age'}
                  dir={shortlistSortDir}
                  onClick={() => toggleSortCol('age', shortlistSortCol, setShortlistSortCol, setShortlistSortDir)}
                />
              </div>
              <div className="flex items-center justify-center">
                <SortableColHeader
                  label="OVR"
                  active={shortlistSortCol === 'ov'}
                  dir={shortlistSortDir}
                  onClick={() => toggleSortCol('ov', shortlistSortCol, setShortlistSortCol, setShortlistSortDir)}
                />
              </div>
              <div className="flex items-center justify-center">
                <SortableColHeader
                  label="สถานะ/ฟิต"
                  active={shortlistSortCol === 'fit'}
                  dir={shortlistSortDir}
                  onClick={() => toggleSortCol('fit', shortlistSortCol, setShortlistSortCol, setShortlistSortDir)}
                />
              </div>
              <div className="hidden lg:flex mland:flex items-center justify-end">
                <SortableColHeader
                  label="ประเมิน / ค่าเหนื่อย"
                  active={shortlistSortCol === 'price'}
                  dir={shortlistSortDir}
                  onClick={() => toggleSortCol('price', shortlistSortCol, setShortlistSortCol, setShortlistSortDir)}
                  align="right"
                />
              </div>
              <div className="text-right">จัดการ</div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]">
            {filteredShortlist.length > 0 ? (
              filteredShortlist.map(({ entry, resolved }) => {
                const { status, player: q, team: curTeam, idx, estPrice } = resolved;
                const canDeal = status === 'mk' || status === 'scout' || status === 'club';
                const blockedByWindow = !tx.tw.open && !q.free;
                const canLoanHere = canDeal && !q.free && !q.locked && !blockedByWindow && tx.loansCount < tx.maxLoans;
                const bio = getPlayerBio(q);
                const footMeta = getFootColorMeta(bio.foot);
                const f = getStaminaMeta(q.fit).f;
                const unavailable = q.inj > 0 || (q.sus || 0) > 0;
                const sourceLabel =
                  status === 'in_squad'
                    ? '✓ ย้ายเข้าทีมคุณแล้ว'
                    : status === 'mk'
                      ? q.free
                        ? '🆓 ฟรีเอเยนต์ (ตลาดกลาง)'
                        : '🌐 ตลาดกลาง'
                      : status === 'scout'
                        ? '🔍 รายงานแมวมอง'
                        : status === 'club' && curTeam
                          ? `🏟️ ${curTeam.name} (${TN[curTeam.tier]})`
                          : status === 'created'
                            ? '🌱 นักเตะสร้างเอง'
                            : '⏳ ย้ายออกนอกลีก/รอตลาดใหม่';

                return (
                  <div
                    key={`${entry.n}-${entry.clubTeamId ?? entry.source}`}
                    className={`grid grid-cols-[minmax(0,1fr)_52px_56px_118px] sm:grid-cols-[minmax(0,1.45fr)_34px_58px_64px_150px] lg:grid-cols-[minmax(0,1.65fr)_36px_64px_74px_96px_190px] mland:grid-cols-[minmax(0,1.5fr)_28px_50px_58px_72px_142px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3.5 mland:px-2 py-1.5 mland:py-1 transition-colors ${
                      unavailable ? 'bg-rose-500/[0.05] hover:bg-rose-500/[0.09]' : 'hover:bg-[var(--surface-2)]/45'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onInspectPlayer(q, curTeam || null)}
                      title="กดเพื่อดูการ์ดและค่าพลังนักเตะ"
                      className="flex items-center gap-1.5 sm:gap-2 mland:gap-1 min-w-0 text-left cursor-pointer group"
                    >
                      <div className="shrink-0 [&>svg]:w-8 [&>svg]:h-8 sm:[&>svg]:w-9 sm:[&>svg]:h-9 mland:[&>svg]:w-7 mland:[&>svg]:h-7 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/75 group-hover:border-[var(--g)]/60 p-0.5 transition-colors">
                        <PlayerFace player={q} team={curTeam} state={state} size={36} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs mland:text-[10px] truncate leading-tight flex items-center gap-1">
                          <PositionBadge role={q.ro} size="2xs" />
                          <span className="truncate group-hover:text-[var(--g)] group-hover:underline transition-colors">{q.n}</span>
                          <span
                            className={`text-[10px] mland:text-[8.5px] font-bold truncate ${
                              status === 'in_squad'
                                ? 'text-[var(--g)]'
                                : status === 'unavailable'
                                  ? 'text-[var(--mut)]'
                                  : q.free
                                    ? 'text-[var(--g)]'
                                    : 'text-[#8a5b00] dark:text-[var(--lamp)]'
                            }`}
                          >
                            · {sourceLabel}
                          </span>
                        </div>
                        <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1 tabular mt-0.5">
                          <span className="sm:hidden mland:hidden shrink-0">{q.age} ปี ·</span>
                          <PotentialBadge pot={q.pot || q.ov} variant="inline" size="xs" />
                          <span
                            className="hidden sm:inline-flex mland:inline-flex items-center gap-1 px-1.5 py-[0.5px] rounded-md border bg-[var(--surface-2)]/75 border-[var(--line)] text-[9.5px] mland:text-[8px] font-bold tabular leading-tight shrink-0 whitespace-nowrap"
                            title={`สูง ${bio.heightCm} ซม. · หนัก ${bio.weightKg} กก. · ${footMeta.titleText}`}
                          >
                            <span className="text-[var(--ink)]/85">{bio.heightCm}/{bio.weightKg}</span>
                            <FootPairIcon foot={bio.foot} size="xs" />
                          </span>
                          <span className="lg:hidden mland:hidden font-semibold text-[var(--ink)]/85 truncate">
                            · {q.free ? 'ไร้ค่าตัว' : `~${fmtMoneyNum(estPrice)}`}
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="hidden sm:block mland:block text-center text-xs mland:text-[10px] tabular font-semibold">
                      {q.age}
                    </div>

                    <div className="flex items-center justify-center gap-0.5">
                      <OvrBadge ov={q.ov} size="sm" />
                      <span className="text-[9px] mland:text-[8px] text-[var(--mut)] tabular hidden sm:inline mland:inline">/{q.pot || q.ov}</span>
                    </div>

                    <div className="flex items-center justify-center min-w-0">
                      <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
                    </div>

                    <div className="hidden lg:block mland:block text-right text-[10.5px] mland:text-[9px] tabular whitespace-nowrap">
                      <div className={`font-bold leading-tight ${q.free ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                        {q.free ? 'ไร้ค่าตัว' : `~${fmtMoneyNum(estPrice)}`}
                      </div>
                      <div className="text-[var(--mut)] leading-tight">
                        ~{fmtMoneyNum(q.askWg || wagOf(q))}/นัด
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 mland:gap-0.5 shrink-0">
                      {status === 'in_squad' ? (
                        <span className="text-[10.5px] mland:text-[9px] font-bold text-[var(--g)] px-1.5">✓ อยู่ในทีม</span>
                      ) : canDeal ? (
                        <>
                          {!q.free && (
                            <button
                              type="button"
                              disabled={!canLoanHere}
                              onClick={() => openNegotiation(status, idx, q, curTeam, 'loan')}
                              className="btn btn-xs btn-secondary shrink-0 px-1.5"
                            >
                              🤝
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!!q.locked || blockedByWindow}
                            onClick={() => openNegotiation(status, idx, q, curTeam, q.free ? 'free' : 'cash')}
                            className={`btn btn-xs shrink-0 ${blockedByWindow ? 'btn-secondary text-[var(--mut)]' : 'btn-primary'}`}
                          >
                            {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิด' : q.free ? 'เซ็นฟรี' : `ซื้อ ${fmtMoneyNum(estPrice)}`}
                          </button>
                        </>
                      ) : status === 'created' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('buy');
                            setMarketSource('created');
                          }}
                          className="btn btn-xs btn-secondary"
                        >
                          สร้างเอง
                        </button>
                      ) : (
                        <span className="text-[10px] text-[var(--mut)] px-1">ไม่พบ</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => removeShortlistPlayer(d, entry.n, entry.clubTeamId));
                          onToast(`นำ ${entry.n} ออกจากรายชื่อที่สนใจแล้ว`);
                        }}
                        title="นำออกจากรายชื่อที่สนใจ"
                        aria-label={`ลบ ${entry.n} ออกจากที่สนใจ`}
                        className="w-6 h-6 mland:w-5 mland:h-5 rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--mut)] hover:text-[var(--red)] hover:border-[var(--red)]/50 inline-flex items-center justify-center cursor-pointer shrink-0 transition-all active:scale-95"
                      >
                        <Trash2 className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2">
                <div className="text-2xl opacity-75">⭐</div>
                <p className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                  {shortlistResolved.length === 0 ? 'ยังไม่มีนักเตะในรายชื่อที่สนใจ' : 'ไม่พบนักเตะตามตัวกรองที่เลือก'}
                </p>
                <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-sm">
                  กดปุ่มรูปดาว ☆ บนรายชื่อนักเตะในตลาดกลาง สโมสรอื่น แมวมอง หรือการ์ดนักเตะ เพื่อบันทึกไว้ติดตามและยื่นซื้อ/ขอยืมได้ทันที
                </p>
                {shortlistResolved.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('buy')}
                    className="btn btn-sm btn-primary"
                  >
                    ไปเลือกดูนักเตะในตลาด
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SECTION 2: OUTGOING TRANSFERS, LOANS & INCOMING BIDS */}
      {activeTab === 'sell' && (
        <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-2 flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
          {/* Left: Incoming Buy & Loan Offers */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                💼 ทีมยื่นซื้อ &amp; ขอยืม ({incomingOffers.length})
              </h3>
              <div className="seg-bar shrink-0">
                <button
                  type="button"
                  onClick={() => setOfferFilter('all')}
                  className={`seg-btn tabular ${offerFilter === 'all' ? 'seg-btn-active' : ''}`}
                >
                  ทั้งหมด ({incomingOffers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOfferFilter('buy')}
                  className={`seg-btn tabular ${offerFilter === 'buy' ? 'seg-btn-active' : ''}`}
                >
                  💰 ซื้อ ({buyOffersCount})
                </button>
                <button
                  type="button"
                  onClick={() => setOfferFilter('loan')}
                  className={`seg-btn tabular ${offerFilter === 'loan' ? 'seg-btn-active' : ''}`}
                >
                  🤝 ยืม ({loanOffersCount})
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
              {filteredIncomingOffers.length > 0 ? (
                filteredIncomingOffers.map((off) => {
                  const targetQ = me.sq.find((q) => q.n === off.n);
                  if (!targetQ) return null;
                  const isLoanOffer = off.kind === 'loan' || off.kind === 'loanopt';
                  const marketVal = Math.max(5, vlu(targetQ));
                  const diffPct = Math.round(((off.p - marketVal) / marketVal) * 100);
                  const wg = ensureCon(targetQ).wg;
                  const wageShare = off.wageShare ?? 80;
                  const savedWg = Number(((wg * (isLoanOffer ? wageShare / 100 : 1))).toFixed(1));
                  const buyerTeam =
                    (off.teamId != null ? state.teams.find((t) => t.id === off.teamId) : undefined) ||
                    state.teams.find((t) => t.name === off.t);
                  return (
                    <div key={`${off.n}__${off.t}__${off.kind || 'buy'}`} className="px-3.5 py-2.5 mland:px-2.5 mland:py-2 space-y-2 mland:space-y-1.5 hover:bg-[var(--surface-2)]/40 transition-colors">
                      <div className="flex items-center gap-2.5 mland:gap-2">
                        <div className="shrink-0 flex items-center gap-1.5">
                          <ClubCrest
                            name={buyerTeam?.name || off.t}
                            size={24}
                            team={buyerTeam}
                            club={state.club}
                            isMyClub={false}
                          />
                          <PlayerFace player={targetQ} team={me} state={state} size={36} />
                        </div>
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(targetQ, me)}
                          className="flex-1 min-w-0 text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-1.5 text-xs sm:text-[13px] mland:text-[10.5px] font-bold leading-tight">
                            <span className="truncate group-hover:underline">{off.t}</span>
                            {buyerTeam && (
                              <span className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)] shrink-0">
                                ({TN[buyerTeam.tier] || ''})
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-[1px] rounded text-[9.5px] mland:text-[8px] font-extrabold shrink-0 ${
                                isLoanOffer
                                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30'
                                  : 'bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/30'
                              }`}
                            >
                              {off.kind === 'loanopt' ? '🤝 ยืม+ซื้อขาด' : off.kind === 'loan' ? '🤝 ขอยืมตัว' : '💰 ยื่นซื้อ'}
                            </span>
                          </div>
                          <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate mt-0.5 tabular flex items-center gap-1">
                            <span>{isLoanOffer ? 'ขอยืม' : 'ขอซื้อ'}</span>
                            <PositionBadge role={targetQ.ro} size="2xs" />
                            <b className="text-[var(--ink)] truncate">{off.n}</b>
                            <span>· ลดค่าเหนื่อย {fmtMoneyNum(savedWg)}/นัด</span>
                          </div>
                        </button>
                        <OvrBadge ov={targetQ.ov} size="sm" />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        {isLoanOffer ? (
                          <div className="flex flex-wrap items-baseline gap-1.5 text-[11px] mland:text-[9.5px] tabular">
                            <span className="font-extrabold text-sky-600 dark:text-sky-300 text-xs sm:text-[13px] mland:text-[11px]">
                              ค่ายืม +{fmtMoney(off.p)}
                            </span>
                            <span className="text-[var(--mut)]">· ช่วยค่าเหนื่อย {wageShare}%</span>
                            {off.kind === 'loanopt' && off.buyOption ? (
                              <span className="font-bold text-[#8a5b00] dark:text-[var(--lamp)]">
                                · ซื้อขาด {fmtMoneyNum(off.buyOption)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1.5 text-[11px] mland:text-[9.5px] tabular">
                            <span className="font-extrabold text-[var(--g)] text-xs sm:text-[13px] mland:text-[11px]">
                              ยื่น {fmtMoney(off.p)}
                            </span>
                            <span className="text-[var(--mut)]">· ประเมิน {fmtMoneyNum(marketVal)}</span>
                            <span
                              className={`font-bold ${
                                diffPct >= 0
                                  ? 'text-[var(--g)]'
                                  : 'text-[#8a5b00] dark:text-[var(--lamp)]'
                              }`}
                            >
                              ({diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`})
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const res = canAcceptTransferOffer(state, off);
                              if (!res.ok) {
                                onToast(res.err || 'ดำเนินการไม่สำเร็จ');
                                return;
                              }
                              onUpdateState((d) => {
                                acceptTransferOffer(d, off);
                              });
                              SFX.win();
                              onToast(
                                isLoanOffer
                                  ? `🤝 ปล่อยยืม ${off.n} ให้ ${res.buyerName || off.t} (ค่ายืม +${fmtMoney(off.p)}) สำเร็จ!`
                                  : `ขาย ${off.n} ให้ ${res.buyerName || off.t} รับ +${fmtMoney(off.p)}`
                              );
                            }}
                            className="btn btn-xs btn-primary"
                          >
                            {isLoanOffer ? '✓ ตอบรับปล่อยยืม' : '✓ ตอบรับขาย'}
                          </button>
                          {!off.cnt && (
                            <button
                              type="button"
                              onClick={() => {
                                const out = resolveCounterOfferOutcome(state, off);
                                onUpdateState((d) => applyCounterOfferOutcome(d, off, out));
                                if (out.accepted) {
                                  SFX.tap();
                                  onToast(
                                    isLoanOffer
                                      ? `${off.t} ยอมเพิ่มค่ายืมเป็น ${fmtMoney(out.newPrice ?? off.p)} (ค่าเหนื่อย ${out.newWageShare ?? wageShare}%)!`
                                      : `${off.t} ยอมเพิ่มราคาเป็น ${fmtMoney(out.newPrice ?? off.p)}!`
                                  );
                                } else {
                                  SFX.foul();
                                  onToast(`${off.t} ถอนข้อเสนอ${isLoanOffer ? 'ขอยืม' : 'ซื้อ'} ${off.n}`);
                                }
                              }}
                              className="btn btn-xs btn-secondary"
                            >
                              {isLoanOffer ? 'ต่อรอง +ค่ายืม' : 'โก่ง +15%'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateState((d) => removeIncomingOffer(d, off.n, off.t, off.kind));
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
                  <div className="text-xs sm:text-sm mland:text-xs font-bold">
                    {offerFilter === 'loan'
                      ? 'ยังไม่มีทีมยื่นขอยืมตัวเข้ามา'
                      : offerFilter === 'buy'
                        ? 'ยังไม่มีทีมยื่นซื้อตัวเข้ามา'
                        : 'ยังไม่มีข้อเสนอซื้อหรือขอยืมเข้ามา'}
                  </div>
                  <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs">
                    เลือกนักเตะด้านขวาแล้วกด &ldquo;🤝 ปล่อยยืม&rdquo; เพื่อเสนอปล่อยยืม หรือ &ldquo;💰 ขาย&rdquo; เพื่อขายด่วน/เสนอขายเรียกข้อเสนอทันที
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Right: Squad Selling, Loan Out & Currently Loaned Out */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 space-y-2 mland:space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                  🏷️ ขาย &amp; ปล่อยยืม ({sellSubView === 'loaned_out' ? loanedOutList.length : sellSquadList.length})
                </h3>
                <div className="seg-bar shrink-0 overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setSellSubView('all')}
                    className={`seg-btn tabular ${sellSubView === 'all' ? 'seg-btn-active' : ''}`}
                  >
                    ทั้งทีม ({me.sq.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellSubView('listed')}
                    className={`seg-btn tabular ${sellSubView === 'listed' ? 'seg-btn-active' : ''}`}
                  >
                    ตั้งขาย ({listedPlayers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellSubView('loan_list')}
                    className={`seg-btn tabular ${sellSubView === 'loan_list' ? 'seg-btn-active' : ''}`}
                  >
                    บัญชียืม ({loanListedPlayers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellSubView('loaned_out')}
                    className={`seg-btn tabular ${sellSubView === 'loaned_out' ? 'seg-btn-active' : ''}`}
                  >
                    ยืมออกอยู่ ({loanedOutList.length})
                  </button>
                </div>
              </div>

              {sellSubView !== 'loaned_out' && (
                <div className="flex flex-wrap items-center gap-1.5 mland:gap-1">
                  <div className="relative flex-1 min-w-[120px]">
                    <Search className="w-3 h-3 text-[var(--mut)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={sellSearch}
                      onChange={(e) => setSellSearch(e.target.value)}
                      placeholder="ค้นหาชื่อ / ตำแหน่ง..."
                      aria-label="ค้นหานักเตะในทีมเพื่อขายหรือปล่อยยืม"
                      className="w-full pl-7 pr-6 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] mland:text-[9.5px] focus:outline-none focus:border-[var(--g)]"
                    />
                    {sellSearch && (
                      <button
                        type="button"
                        onClick={() => setSellSearch('')}
                        aria-label="ล้างคำค้นหา"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
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
              )}

              {sellSubView !== 'loaned_out' && activeSelectedSell.length > 0 && sellBatchPreview && (
                <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--lamp-soft)]/75 border border-[var(--lamp)]/45 flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10px]">
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
                        setLoanModalNames(activeSelectedSell);
                      }}
                      className="btn btn-xs btn-secondary"
                    >
                      🤝 ปล่อยยืม ({activeSelectedSell.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSellModalNames(activeSelectedSell);
                      }}
                      className="btn btn-xs btn-primary"
                    >
                      💰 ขาย ({activeSelectedSell.length})
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

            {sellSubView !== 'loaned_out' && sellSquadList.length > 0 && (
              <div className="grid grid-cols-[24px_minmax(0,1fr)_48px_54px_102px] sm:grid-cols-[24px_minmax(0,1.4fr)_30px_54px_60px_118px] mland:grid-cols-[22px_minmax(0,1.4fr)_28px_46px_54px_96px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 border-b border-[var(--line)] shrink-0">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={
                      sellSquadList.some((q) => !q.me && !q.loan) &&
                      sellSquadList.filter((q) => !q.me && !q.loan).every((q) => activeSelectedSell.includes(q.n))
                    }
                    onChange={() => {
                      const selectableNames = sellSquadList.filter((q) => !q.me && !q.loan).map((q) => q.n);
                      const allSelected = selectableNames.length > 0 && selectableNames.every((n) => activeSelectedSell.includes(n));
                      setSelectedSellNames((prev) =>
                        allSelected ? prev.filter((n) => !selectableNames.includes(n)) : Array.from(new Set([...prev, ...selectableNames]))
                      );
                    }}
                    aria-label="เลือกนักเตะทั้งหมด"
                    className="w-3.5 h-3.5 accent-[var(--g)] cursor-pointer rounded"
                  />
                </div>
                <div className="flex items-center justify-start min-w-0">
                  <SortableColHeader
                    label="นักเตะ"
                    active={sellSortCol === 'pos'}
                    dir={sellSortDir}
                    onClick={() => toggleSortCol('pos', sellSortCol, setSellSortCol, setSellSortDir)}
                    align="left"
                  />
                </div>
                <div className="hidden sm:flex mland:flex items-center justify-center">
                  <SortableColHeader
                    label="อายุ"
                    active={sellSortCol === 'age'}
                    dir={sellSortDir}
                    onClick={() => toggleSortCol('age', sellSortCol, setSellSortCol, setSellSortDir)}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <SortableColHeader
                    label="OVR"
                    active={sellSortCol === 'ov'}
                    dir={sellSortDir}
                    onClick={() => toggleSortCol('ov', sellSortCol, setSellSortCol, setSellSortDir)}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <SortableColHeader
                    label="สถานะ/ฟิต"
                    active={sellSortCol === 'fit'}
                    dir={sellSortDir}
                    onClick={() => toggleSortCol('fit', sellSortCol, setSellSortCol, setSellSortDir)}
                  />
                </div>
                <div className="text-right">จัดการ</div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]">
              {sellSubView === 'loaned_out' ? (
                loanedOutList.length > 0 ? (
                  loanedOutList.map(({ q, hostTeam }) => (
                    <div
                      key={`${hostTeam.id}-${q.n}`}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/45 transition-colors"
                    >
                      <PlayerFace player={q} team={hostTeam} state={state} size={36} />
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(q, hostTeam)}
                        className="flex-1 min-w-0 text-left cursor-pointer group"
                      >
                        <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight flex items-center gap-1.5">
                          <PositionBadge role={q.ro} size="xs" />
                          <span className="truncate group-hover:underline">{q.n}</span>
                          <span className="text-sky-600 dark:text-sky-300 text-[10.5px] mland:text-[9px] font-bold truncate">
                            · ยืมตัวที่ {hostTeam.name}
                          </span>
                        </div>
                        <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular truncate mt-0.5 flex flex-wrap items-center gap-x-1.5">
                          <span>{TN[hostTeam.tier]} · ลง {q.sp || 0} นัด · {q.sg || 0} ยิง · {q.sa || 0} จ่าย</span>
                          <span>· ช่วยค่าเหนื่อย {q.loanWageShare ?? 80}%</span>
                          {q.loanOpt ? (
                            <span className="text-[#8a5b00] dark:text-[var(--lamp)] font-semibold">
                              · ออปชันซื้อ {fmtMoneyNum(q.loanOpt)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                      <OvrBadge ov={q.ov} size="sm" />
                      <button
                        type="button"
                        onClick={() => {
                          let errMsg = '';
                          onUpdateState((d) => {
                            const res = recallLoanedOutPlayer(d, q.n, hostTeam.id);
                            if (!res.ok) errMsg = res.err || 'ดึงตัวกลับไม่สำเร็จ';
                          });
                          if (errMsg) {
                            SFX.foul();
                            onToast(errMsg);
                          } else {
                            SFX.confirm();
                            onToast(`↩️ ดึง ${q.n} กลับจาก ${hostTeam.name} แล้ว`);
                          }
                        }}
                        className="btn btn-xs btn-secondary shrink-0"
                      >
                        ↩️ ดึงกลับ
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-1.5">
                    <div className="text-2xl opacity-75">✈️</div>
                    <div className="text-xs sm:text-sm mland:text-xs font-bold">ยังไม่มีนักเตะที่ปล่อยยืมตัวอยู่</div>
                    <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs">
                      เลือกนักเตะจาก &ldquo;ทั้งทีม&rdquo; แล้วกด &ldquo;🤝 ยืม&rdquo; เพื่อส่งออกไปเก็บเลเวลกับสโมสรอื่นและรับค่ายืมตัว
                    </p>
                  </div>
                )
              ) : sellSquadList.length > 0 ? (
                sellSquadList.map((q) => {
                  const marketVal = Math.max(5, vlu(q));
                  const wg = ensureCon(q).wg;
                  const bidCount = incomingOffers.filter((o) => o.n === q.n).length;
                  const selectable = !q.me && !q.loan;
                  const isChecked = selectable && activeSelectedSell.includes(q.n);
                  const f = getStaminaMeta(q.fit).f;
                  const unavailable = q.inj > 0 || (q.sus || 0) > 0;
                  return (
                    <div
                      key={q.n}
                      className={`grid grid-cols-[24px_minmax(0,1fr)_48px_54px_102px] sm:grid-cols-[24px_minmax(0,1.4fr)_30px_54px_60px_118px] mland:grid-cols-[22px_minmax(0,1.4fr)_28px_46px_54px_96px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 transition-colors ${
                        isChecked
                          ? 'bg-[var(--g-soft)]/55'
                          : unavailable
                            ? 'bg-rose-500/[0.05] hover:bg-rose-500/[0.09]'
                            : q.listed
                              ? 'bg-[var(--lamp-soft)]/20 hover:bg-[var(--surface-2)]/45'
                              : q.loanListed
                                ? 'bg-sky-500/8 hover:bg-[var(--surface-2)]/45'
                                : 'hover:bg-[var(--surface-2)]/45'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!selectable}
                          onChange={() =>
                            setSelectedSellNames((prev) =>
                              prev.includes(q.n) ? prev.filter((name) => name !== q.n) : [...prev, q.n]
                            )
                          }
                          aria-label={`เลือก ${q.n} เพื่อขายหรือปล่อยยืม`}
                          className="w-3.5 h-3.5 accent-[var(--g)] cursor-pointer rounded shrink-0 disabled:opacity-30"
                        />
                      </div>
                      <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex items-center gap-1.5 mland:gap-1 min-w-0 text-left cursor-pointer group">
                        <div className="shrink-0 [&>svg]:w-8 [&>svg]:h-8 mland:[&>svg]:w-7 mland:[&>svg]:h-7 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/75 p-0.5">
                          <PlayerFace player={q} team={me} state={state} size={32} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs mland:text-[10px] truncate leading-tight flex items-center gap-1">
                            <PositionBadge role={q.ro} size="2xs" />
                            <span className="truncate group-hover:underline">{q.n}</span>
                            {q.listed ? (
                              <span className="text-[#8a5b00] dark:text-[var(--lamp)] text-[9.5px] mland:text-[8px] font-bold shrink-0 tabular">
                                · ขาย {fmtMoneyNum(q.askPrice || marketVal)}
                              </span>
                            ) : null}
                            {q.loanListed ? (
                              <span className="text-sky-600 dark:text-sky-300 text-[9.5px] mland:text-[8px] font-bold shrink-0">
                                · ยืม
                              </span>
                            ) : null}
                            {bidCount > 0 ? (
                              <span className="px-1 rounded bg-[var(--g)] text-white text-[9px] font-bold shrink-0 tabular">
                                {bidCount} บิด
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular truncate mt-0.5">
                            <span className="sm:hidden mland:hidden">{q.age} ปี · </span>
                            ประเมิน {fmtMoneyNum(marketVal)} · {fmtMoneyNum(wg)}/น
                          </div>
                        </div>
                      </button>

                      <div className="hidden sm:block mland:block text-center text-xs mland:text-[10px] tabular font-semibold">
                        {q.age}
                      </div>

                      <div className="flex items-center justify-center">
                        <OvrBadge ov={q.ov} size="sm" />
                      </div>

                      <div className="flex items-center justify-center min-w-0">
                        <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
                      </div>

                      {q.loan ? (
                        <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold whitespace-nowrap text-right">
                          ยืมตัวเข้า
                        </span>
                      ) : q.me ? (
                        <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold whitespace-nowrap text-right">
                          ตัวหลัก
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1 mland:gap-0.5 shrink-0">
                          {(q.listed || q.loanListed) ? (
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateState((d) => {
                                  const t = d.teams[d.me].sq.find((z) => z.n === q.n);
                                  if (t) {
                                    t.listed = 0;
                                    t.loanListed = 0;
                                    delete t.askPrice;
                                    delete t.loanAskFee;
                                  }
                                });
                                onToast(`ถอด ${q.n} ออกจากบัญชีขาย/ปล่อยยืมแล้ว`);
                              }}
                              className="btn btn-xs btn-secondary hover:text-[var(--red)] px-1.5"
                            >
                              ถอด
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              setLoanModalNames([q.n]);
                            }}
                            title="ขึ้นบัญชีหรือเสนอปล่อยยืมตัว"
                            className="btn btn-xs btn-secondary px-1.5"
                          >
                            🤝
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              setSellModalNames([q.n]);
                            }}
                            className="btn btn-xs btn-gold px-1.5"
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
                    {sellSubView === 'listed'
                      ? 'ยังไม่มีนักเตะในบัญชีขาย'
                      : sellSubView === 'loan_list'
                        ? 'ยังไม่มีนักเตะในบัญชีปล่อยยืม'
                        : 'ไม่พบนักเตะตามเงื่อนไขที่เลือก'}
                  </div>
                  <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs">
                    {sellSubView === 'listed' || sellSubView === 'loan_list'
                      ? 'สลับไปดู "ทั้งทีม" แล้วกด "💰 ขาย" หรือ "🤝 ยืม" เพื่อตั้งบัญชีและเรียกข้อเสนอจากทีมอื่น'
                      : 'ลองล้างคำค้นหาหรือเลือกตำแหน่งทั้งหมด'}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* SECTION 3: SCOUTING DEPARTMENT */}
      {activeTab === 'scout' && (
        <div className="grid grid-cols-1 sm:grid-cols-[0.92fr_1.08fr] mland:grid-cols-[0.92fr_1.08fr] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
          {/* Left: Send Scout Mission */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between gap-2">
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">🔍 ส่งแมวมองหานักเตะ</h3>
              <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular whitespace-nowrap">
                ค่าส่ง {fmtMoneyNum(20)} · รอ 2 นัด
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 space-y-3 mland:space-y-2">
              {state.scout ? (
                <div className="p-3.5 mland:p-2.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] text-xs mland:text-[10.5px] space-y-2">
                  <div className="font-bold flex items-center justify-between gap-2">
                    <span className={state.scout.results ? 'text-[var(--g)]' : 'text-[var(--ink)]'}>
                      {state.scout.results ? '✅ รายงานแมวมองพร้อมแล้ว' : '⏳ แมวมองกำลังออกเดินทาง'}
                    </span>
                    <span className="tabular font-bold text-[#8a5b00] dark:text-[var(--lamp)]">
                      {state.scout.results ? 'พร้อมตรวจ' : `เหลือ ${state.scout.turnsLeft} นัด`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--g)] transition-all"
                      style={{ width: `${state.scout.results ? 100 : clamp(((2 - state.scout.turnsLeft) / 2) * 100, 18, 95)}%` }}
                    />
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
                      {scoutFocusCards.map(({ focus, icon, title, desc }) => (
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
                          className="text-left p-2.5 mland:p-2 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/65 hover:bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)]/60 transition-colors cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
                        >
                          <div className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)] flex items-center gap-1.5 leading-tight">
                            <span>{icon}</span>
                            <span className="truncate">{title}</span>
                          </div>
                          <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] mt-0.5 truncate">
                            {desc}
                          </div>
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
                        className="flex-1 min-w-0 px-2.5 py-2 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10.5px] font-semibold focus:outline-none focus:border-[var(--g)]"
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
            <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between gap-2">
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                {state.scout?.results ? `📋 รายงาน: ${state.scout.label}` : '📋 รายงานผลการส่อง'}
              </h3>
              {state.scout?.results && (
                <button
                  type="button"
                  onClick={() => onUpdateState((d) => { d.scout = null; })}
                  className="btn btn-xs btn-ghost shrink-0"
                >
                  ✕ ปิดรายงาน
                </button>
              )}
            </div>

            {state.scout?.results && state.scout.results.length > 0 && (
              <div className="grid grid-cols-[minmax(0,1fr)_50px_54px_108px] md:grid-cols-[minmax(0,1.4fr)_30px_54px_60px_132px] lg:grid-cols-[minmax(0,1.5fr)_34px_56px_64px_78px_142px] mland:grid-cols-[minmax(0,1.4fr)_28px_46px_54px_118px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 bg-[var(--surface-2)]/70 border-b border-[var(--line)] text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] shrink-0">
                <div className="flex items-center justify-start min-w-0">
                  <SortableColHeader
                    label="นักเตะ"
                    active={scoutSortCol === 'pos'}
                    dir={scoutSortDir}
                    onClick={() => toggleSortCol('pos', scoutSortCol, setScoutSortCol, setScoutSortDir)}
                    align="left"
                  />
                </div>
                <div className="hidden md:flex mland:flex items-center justify-center">
                  <SortableColHeader
                    label="อายุ"
                    active={scoutSortCol === 'age'}
                    dir={scoutSortDir}
                    onClick={() => toggleSortCol('age', scoutSortCol, setScoutSortCol, setScoutSortDir)}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <SortableColHeader
                    label="OVR"
                    active={scoutSortCol === 'ov'}
                    dir={scoutSortDir}
                    onClick={() => toggleSortCol('ov', scoutSortCol, setScoutSortCol, setScoutSortDir)}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <SortableColHeader
                    label="ฟิต"
                    active={scoutSortCol === 'fit'}
                    dir={scoutSortDir}
                    onClick={() => toggleSortCol('fit', scoutSortCol, setScoutSortCol, setScoutSortDir)}
                  />
                </div>
                <div className="hidden lg:flex items-center justify-end">
                  <SortableColHeader
                    label="ค่าตัว"
                    active={scoutSortCol === 'price'}
                    dir={scoutSortDir}
                    onClick={() => toggleSortCol('price', scoutSortCol, setScoutSortCol, setScoutSortDir)}
                    align="right"
                  />
                </div>
                <div className="text-right">เจรจา</div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]">
              {state.scout?.results ? (
                sortedScoutResults.map(({ q, i }) => {
                  const blockedByWindow = !tx.tw.open && !q.free;
                  const shortlisted = isPlayerShortlisted(state, q.n);
                  const canLoanScout = !q.free && !q.locked && !blockedByWindow && tx.loansCount < tx.maxLoans;
                  const bio = getPlayerBio(q);
                  const footMeta = getFootColorMeta(bio.foot);
                  const f = getStaminaMeta(q.fit).f;
                  const unavailable = q.inj > 0 || (q.sus || 0) > 0;
                  return (
                    <div
                      key={`${q.n}-${i}`}
                      className={`grid grid-cols-[minmax(0,1fr)_50px_54px_108px] md:grid-cols-[minmax(0,1.4fr)_30px_54px_60px_132px] lg:grid-cols-[minmax(0,1.5fr)_34px_56px_64px_78px_142px] mland:grid-cols-[minmax(0,1.4fr)_28px_46px_54px_118px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 transition-colors ${
                        unavailable ? 'bg-rose-500/[0.05] hover:bg-rose-500/[0.09]' : 'hover:bg-[var(--surface-2)]/45'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(q, null)}
                        title="กดเพื่อดูการ์ดและค่าพลังนักเตะ"
                        className="flex items-center gap-1.5 mland:gap-1 min-w-0 text-left cursor-pointer group"
                      >
                        <div className="shrink-0 [&>svg]:w-8 [&>svg]:h-8 mland:[&>svg]:w-7 mland:[&>svg]:h-7 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/75 group-hover:border-[var(--g)]/60 p-0.5 transition-colors">
                          <PlayerFace player={q} size={32} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs mland:text-[10px] truncate leading-tight flex items-center gap-1">
                            <PositionBadge role={q.ro} size="2xs" />
                            <span className="truncate group-hover:text-[var(--g)] group-hover:underline transition-colors">{q.n}</span>
                            {q.free && (
                              <span className="text-[9px] mland:text-[7.5px] px-1 py-[0.5px] rounded bg-[var(--g-soft)] border border-[var(--g)]/30 text-[var(--g)] font-bold shrink-0">ฟรี</span>
                            )}
                          </div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular truncate mt-0.5 flex items-center gap-1">
                            <span className="md:hidden mland:hidden shrink-0">{q.age} ปี ·</span>
                            <PotentialBadge pot={q.pot} variant="inline" size="xs" />
                            <span
                              className="hidden sm:inline-flex mland:inline-flex items-center gap-1 px-1 py-[0.5px] rounded bg-[var(--surface-2)]/75 border border-[var(--line)] text-[9px] mland:text-[7.5px] font-bold shrink-0 whitespace-nowrap"
                              title={`สูง ${bio.heightCm} ซม. · หนัก ${bio.weightKg} กก. · ${footMeta.titleText}`}
                            >
                              <span className="text-[var(--ink)]/85">{bio.heightCm}/{bio.weightKg}</span>
                              <FootPairIcon foot={bio.foot} size="xs" />
                            </span>
                            <span className="lg:hidden font-semibold text-[var(--ink)]/85 truncate">
                              · {q.free ? 'ไร้ค่าตัว' : fmtMoneyNum(q.price || 0)}
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="hidden md:block mland:block text-center text-xs mland:text-[10px] tabular font-semibold">
                        {q.age}
                      </div>

                      <div className="flex items-center justify-center gap-0.5">
                        <OvrBadge ov={q.ov} size="sm" />
                        <span className="text-[9px] mland:text-[8px] text-[var(--mut)] tabular hidden sm:inline mland:inline">/{q.pot || q.ov}</span>
                      </div>

                      <div className="flex items-center justify-center min-w-0">
                        <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
                      </div>

                      <div className="hidden lg:block text-right text-[10.5px] tabular whitespace-nowrap">
                        <div className={`font-bold leading-tight ${q.free ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                          {q.free ? 'ไร้ค่าตัว' : fmtMoneyNum(q.price || 0)}
                        </div>
                        <div className="text-[var(--mut)] leading-tight">
                          ~{fmtMoneyNum(q.askWg || wagOf(q))}/นัด
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 mland:gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleShortlist(q, { source: 'scout' })}
                          title={shortlisted ? 'นำออกจากรายชื่อที่สนใจ' : 'เพิ่มเข้ารายชื่อที่สนใจ'}
                          aria-label={shortlisted ? `นำ ${q.n} ออกจากรายชื่อที่สนใจ` : `เพิ่ม ${q.n} เข้ารายชื่อที่สนใจ`}
                          className={`w-6 h-6 mland:w-5 mland:h-5 rounded-md border inline-flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 ${
                            shortlisted
                              ? 'bg-amber-400/20 border-amber-500/70 text-amber-500 dark:text-amber-300'
                              : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-amber-500 hover:border-amber-400/60'
                          }`}
                        >
                          <Star className={`w-3 h-3 mland:w-2.5 mland:h-2.5 shrink-0 ${shortlisted ? 'fill-amber-400 text-amber-500 dark:text-amber-300' : ''}`} />
                        </button>
                        {!q.free && (
                          <button
                            type="button"
                            disabled={!canLoanScout}
                            onClick={() => openNegotiation('scout', i, q, undefined, 'loan')}
                            className="btn btn-xs btn-secondary shrink-0 px-1.5"
                          >
                            🤝
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!!q.locked || blockedByWindow}
                          onClick={() => openNegotiation('scout', i, q, undefined, q.free ? 'free' : 'cash')}
                          className={`btn btn-xs min-w-[50px] sm:min-w-[60px] shrink-0 ${
                            blockedByWindow ? 'btn-secondary text-[var(--mut)]' : 'btn-primary'
                          }`}
                        >
                          {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิด' : q.free ? 'เซ็นฟรี' : 'เจรจา'}
                        </button>
                      </div>
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

      {/* SECTION 4: CONTRACTS, LOAN BUYOUTS & YOUTH ACADEMY */}
      {activeTab === 'con' && (
        <div className="grid grid-cols-1 sm:grid-cols-[1.08fr_0.92fr] mland:grid-cols-[1.08fr_0.92fr] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
          {/* Left: First-Team Contracts */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between gap-2">
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
                  className={`seg-btn ${contractFilter === 'all' ? 'seg-btn-active' : ''}`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setContractFilter('expiring')}
                  className={`seg-btn tabular ${contractFilter === 'expiring' ? 'seg-btn-active' : ''}`}
                >
                  ใกล้หมด ({expiringCount})
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
              {displayedContracts.length > 0 ? (
                displayedContracts.map(({ q, i, c }) => (
                  <div key={q.n} className="flex items-center gap-2.5 px-3.5 py-2 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/45 transition-colors">
                    <PlayerFace player={q} team={me} state={state} size={36} />
                    <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer group">
                      <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight flex items-center gap-1.5">
                        <PositionBadge role={q.ro} size="xs" />
                        <span className="truncate group-hover:underline">{q.n}</span>
                        <span className={`shrink-0 tabular ${c.yr <= 1 ? 'text-[var(--red)] font-bold' : 'text-[#9a6700] dark:text-[var(--lamp)] font-semibold'}`}>
                          · {c.yr <= 0 ? 'หมดสัญญา!' : `เหลือ ${c.yr} ปี`}
                        </span>
                      </div>
                      <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate mt-0.5">
                        {ROLE_L[c.role]} · ค่าเหนื่อย {fmtMoneyNum(c.wg)}/นัด
                      </div>
                    </button>
                    <OvrBadge ov={q.ov} size="sm" />
                    <button
                      type="button"
                      onClick={() => {
                        setRenewIdx(i);
                        setRenewYr(Math.max(2, c.yr + 2 > 5 ? 3 : c.yr + 2));
                        setRenewRole(c.role);
                        setRenewWb(1);
                        setRenewMsg('');
                      }}
                      className={`btn btn-sm min-w-[78px] shrink-0 ${
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

          {/* Right: Loan Ins/Outs & Youth Academy */}
          <div className="flex flex-col min-h-0 gap-2.5 mland:gap-2 overflow-hidden">
            {loanInPlayers.length > 0 && (
              <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col shrink-0 max-h-[38%] overflow-hidden">
                <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between gap-2">
                  <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">📌 นักเตะที่ยืมตัวเข้ามา</h3>
                  <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">{loanInPlayers.length} คน</span>
                </div>
                <div className="overflow-y-auto divide-y divide-[var(--line)]/60">
                  {loanInPlayers.map(({ q, i }) => (
                    <div key={q.n} className="flex items-center gap-2.5 px-3.5 py-2 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/45 transition-colors">
                      <PlayerFace player={q} team={me} state={state} size={36} />
                      <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer group">
                        <div className="font-bold text-xs mland:text-[10.5px] truncate flex items-center gap-1.5">
                          <PositionBadge role={q.ro} size="xs" />
                          <span className="truncate group-hover:underline">{q.n}</span>
                        </div>
                        <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular mt-0.5 truncate">
                          {q.loanFromTeamName ? `ยืมจาก ${q.loanFromTeamName}` : 'สัญญายืม 1 ซีซั่น'}
                          {q.loanOpt ? ` · ซื้อขาด ${fmtMoney(q.loanOpt)}` : ' · ไม่มีออปชันซื้อขาด'}
                        </div>
                      </button>
                      <OvrBadge ov={q.ov} size="sm" />
                      {q.loanOpt ? (
                        <button
                          type="button"
                          disabled={!tx.tw.open || state.money < q.loanOpt}
                          onClick={() => {
                            const cost = q.loanOpt || 0;
                            onUpdateState((d) => {
                              d.money -= cost;
                              logFin(d, `ใช้ออปชันซื้อขาด ${q.n}`, -cost);
                              const target = d.teams[d.me].sq[i];
                              delete target.loan;
                              delete target.loanOpt;
                              delete target.loanFromTeamId;
                              delete target.loanFromTeamName;
                              delete target.loanWageShare;
                              delete target.loanOrigCon;
                              target.signedSeason = d.season;
                              target.signedMd = d.md;
                              target.con = { yr: 3, wg: wagOf(target), role: target.ov >= 70 ? 'key' : 'rot' };
                              appendPlayerCareerLog(target, `🤝 เซ็นสัญญาถาวรกับ ${d.teams[d.me].name} ซีซั่น ${d.season}`);
                              recordTransferLog(d, {
                                season: d.season,
                                md: d.md,
                                playerName: target.n,
                                pos: target.pos,
                                ro: target.ro,
                                age: target.age,
                                ov: target.ov,
                                kind: 'buyout',
                                fromTeamId: q.loanFromTeamId ?? -1,
                                fromTeamName: q.loanFromTeamName || 'ต้นสังกัดเดิม',
                                toTeamId: d.me,
                                toTeamName: d.teams[d.me].name,
                                fee: cost,
                                wage: target.con.wg
                              });
                            });
                            onToast(`ซื้อขาด ${q.n} ถาวรแล้ว!`);
                          }}
                          className="btn btn-sm btn-primary shrink-0"
                        >
                          {!tx.tw.open ? '🔒 รอตลาดเปิด' : `ซื้อขาด ${fmtMoneyNum(q.loanOpt)}`}
                        </button>
                      ) : (
                        <span className="text-[10.5px] text-[var(--mut)] font-semibold shrink-0">หมดซีซั่นคืนต้นสังกัด</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {loanedOutList.length > 0 && (
              <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col shrink-0 max-h-[34%] overflow-hidden">
                <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between gap-2">
                  <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">✈️ นักเตะที่ปล่อยยืมอยู่</h3>
                  <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">{loanedOutList.length} คน</span>
                </div>
                <div className="overflow-y-auto divide-y divide-[var(--line)]/60">
                  {loanedOutList.map(({ q, hostTeam }) => (
                    <div key={`${hostTeam.id}-${q.n}`} className="flex items-center gap-2.5 px-3.5 py-2 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/45 transition-colors">
                      <PlayerFace player={q} team={hostTeam} state={state} size={34} />
                      <button type="button" onClick={() => onInspectPlayer(q, hostTeam)} className="flex-1 min-w-0 text-left cursor-pointer group">
                        <div className="font-bold text-xs mland:text-[10.5px] truncate flex items-center gap-1.5">
                          <PositionBadge role={q.ro} size="xs" />
                          <span className="truncate group-hover:underline">{q.n}</span>
                        </div>
                        <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate mt-0.5">
                          อยู่ที่ {hostTeam.name} · ลง {q.sp || 0} นัด ({q.sg || 0}G/{q.sa || 0}A)
                        </div>
                      </button>
                      <OvrBadge ov={q.ov} size="sm" />
                      <button
                        type="button"
                        onClick={() => {
                          let errMsg = '';
                          onUpdateState((d) => {
                            const res = recallLoanedOutPlayer(d, q.n, hostTeam.id);
                            if (!res.ok) errMsg = res.err || 'ดึงตัวกลับไม่สำเร็จ';
                          });
                          if (errMsg) onToast(errMsg);
                          else onToast(`↩️ ดึง ${q.n} กลับจาก ${hostTeam.name} แล้ว`);
                        }}
                        className="btn btn-xs btn-secondary shrink-0"
                      >
                        ↩️ ดึงกลับ
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">🌱 เด็กเยาวชนอะคาเดมี่ ({state.yth?.length || 0})</h3>
                <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] whitespace-nowrap">เซ็นฟรีตลอดปี</span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
                {(state.yth || []).length ? (
                  state.yth.map((q, i) => (
                    <div key={q.n} className="flex items-center gap-2.5 px-3.5 py-2 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/45 transition-colors">
                      <PlayerFace player={q} team={me} state={state} size={36} />
                      <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer group">
                        <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight flex items-center gap-1.5">
                          <PositionBadge role={q.ro} size="xs" />
                          <span className="truncate group-hover:underline">{q.n}</span>
                        </div>
                        <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate leading-snug mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          <span>{q.age} ปี ·</span>
                          <PotentialBadge pot={q.pot} variant="inline" size="xs" />
                          <span aria-hidden="true">·</span>
                          <PlayerBioStrip bio={getPlayerBio(q)} variant="inline" />
                          <span>· ~{fmtMoneyNum(wagOf(q))}/นัด</span>
                        </div>
                      </button>
                      <OvrBadge ov={q.ov} size="sm" />
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
                            recordTransferLog(d, {
                              season: d.season,
                              md: d.md,
                              playerName: y.n,
                              pos: y.pos,
                              ro: y.ro,
                              age: y.age,
                              ov: y.ov,
                              kind: 'youth',
                              fromTeamId: -1,
                              fromTeamName: 'อะคาเดมี่สโมสร',
                              toTeamId: d.me,
                              toTeamName: t.name,
                              fee: 0,
                              wage: y.con.wg
                            });
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

      {/* SECTION 5: LEAGUE TRANSFER HISTORY & NET SPEND */}
      {activeTab === 'history' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
          {/* Top Filter Strip */}
          <div className="shrink-0 px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <select
                aria-label="เลือกซีซั่นประวัติย้ายทีม"
                value={histSeason === 'all' ? 'all' : String(histSeason)}
                onChange={(e) => setHistSeason(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-bold cursor-pointer focus:outline-none focus:border-[var(--g)]"
              >
                <option value="all">ทุกซีซั่น</option>
                {transferHistoryStats.seasonsAvailable.map((sn) => (
                  <option key={sn} value={sn}>
                    ซีซั่น {sn}
                  </option>
                ))}
              </select>

              <div className="seg-bar shrink-0">
                {(
                  [
                    ['all', 'ทั้งหมด'],
                    ['mine', 'ทีมเรา'],
                    ['ai', 'ทีมอื่นในลีก'],
                    ['loan', 'ดีลยืมตัว']
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setHistScope(k)}
                    className={`seg-btn px-2 ${histScope === k ? 'seg-btn-active' : ''}`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <select
                aria-label="กรองประเภทดีล"
                value={histKind}
                onChange={(e) => setHistKind(e.target.value as 'all' | 'perm' | 'free' | 'loan')}
                className="px-2 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-semibold cursor-pointer focus:outline-none focus:border-[var(--g)]"
              >
                <option value="all">ประเภท: ทั้งหมด</option>
                <option value="perm">ซื้อ-ขายขาด</option>
                <option value="free">ฟรี / อะคาเดมี่</option>
                <option value="loan">ยืมตัว</option>
              </select>
            </div>

            <div className="relative w-full sm:w-52 mland:w-44">
              <Search className="w-3.5 h-3.5 mland:w-3 mland:h-3 text-[var(--mut)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                placeholder="ค้นหานักเตะ / สโมสร..."
                aria-label="ค้นหาประวัติย้ายทีม"
                className="w-full pl-7.5 pr-6 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] focus:outline-none focus:border-[var(--g)]"
              />
              {histSearch && (
                <button
                  type="button"
                  onClick={() => setHistSearch('')}
                  aria-label="ล้างคำค้นหาประวัติ"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* 2-Column Feed & Net Spend */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] mland:grid-cols-[1.12fr_0.88fr] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
            {/* Left: Transfer Feed */}
            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                  📰 ความเคลื่อนไหวตลาด ({filteredHistoryEntries.length} ดีล)
                </h3>
                <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular whitespace-nowrap">
                  หมุนเวียนรวม {fmtMoneyNum(transferHistoryStats.totalVolume)}
                </span>
              </div>

              {/* My Club KPI Strip */}
              <div className="shrink-0 grid grid-cols-4 divide-x divide-[var(--line)]/70 border-b border-[var(--line)] bg-[var(--surface-2)]/20 px-2 py-2 mland:py-1.5 text-center tabular">
                <div className="px-1">
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">ดีลในตัวกรอง</div>
                  <div className="text-xs sm:text-sm mland:text-[11px] font-extrabold text-[var(--ink)]">{filteredHistoryEntries.length}</div>
                </div>
                <div className="px-1">
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">ทีมเราซื้อ/ยืม</div>
                  <div className="text-xs sm:text-sm mland:text-[11px] font-extrabold text-[var(--ink)]">{fmtMoneyNum(transferHistoryStats.mySpent)}</div>
                </div>
                <div className="px-1">
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">ทีมเราขายได้</div>
                  <div className="text-xs sm:text-sm mland:text-[11px] font-extrabold text-[var(--g)]">{fmtMoneyNum(transferHistoryStats.myReceived)}</div>
                </div>
                <div className="px-1">
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">Net Spend เรา</div>
                  <div
                    className={`text-xs sm:text-sm mland:text-[11px] font-extrabold ${
                      transferHistoryStats.myNetSpend > 0
                        ? 'text-[var(--red)]'
                        : transferHistoryStats.myNetSpend < 0
                          ? 'text-[var(--g)]'
                          : 'text-[var(--ink)]'
                    }`}
                  >
                    {transferHistoryStats.myNetSpend > 0
                      ? `-${fmtMoneyNum(transferHistoryStats.myNetSpend)}`
                      : transferHistoryStats.myNetSpend < 0
                        ? `+${fmtMoneyNum(Math.abs(transferHistoryStats.myNetSpend))}`
                        : fmtMoneyNum(0)}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
                {filteredHistoryEntries.length > 0 ? (
                  filteredHistoryEntries.map((tr) => {
                    const isMineIn = tr.toTeamId === state.me;
                    const isMineOut = tr.fromTeamId === state.me;
                    const kindText =
                      tr.kind === 'free'
                        ? 'ฟรีเอเยนต์'
                        : tr.kind === 'swap'
                          ? 'แลกตัว+เงิน'
                          : tr.kind === 'loan'
                            ? 'ยืมตัว'
                            : tr.kind === 'loanopt'
                              ? 'ยืม+ออปชันซื้อ'
                              : tr.kind === 'buyout'
                                ? 'ใช้ออปชันซื้อขาด'
                                : tr.kind === 'youth'
                                  ? 'อะคาเดมี่'
                                  : 'ซื้อขาด';
                    const fromTeam = tr.fromTeamId >= 0 ? state.teams.find((t) => t.id === tr.fromTeamId) : undefined;
                    const toTeam = tr.toTeamId >= 0 ? state.teams.find((t) => t.id === tr.toTeamId) : undefined;
                    const inspectTarget = () => {
                      const inTo = toTeam?.sq.find((p) => p.n === tr.playerName);
                      if (inTo && toTeam) {
                        onInspectPlayer(inTo, toTeam);
                        return;
                      }
                      for (const tm of state.teams) {
                        const found = tm.sq.find((p) => p.n === tr.playerName);
                        if (found) {
                          onInspectPlayer(found, tm);
                          return;
                        }
                      }
                      const inMk = (state.mk || []).find((p) => p.n === tr.playerName);
                      if (inMk) onInspectPlayer(inMk, null);
                    };

                    return (
                      <div
                        key={tr.id}
                        className={`flex items-center gap-2.5 mland:gap-1.5 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 hover:bg-[var(--surface-2)]/45 transition-colors ${
                          isMineIn ? 'bg-[var(--g-soft)]/25' : isMineOut ? 'bg-[var(--lamp-soft)]/18' : ''
                        }`}
                      >
                        <OvrBadge ov={tr.ov} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs sm:text-[13px] mland:text-[10.5px] truncate leading-tight flex items-center gap-1.5">
                            <PositionBadge role={tr.ro} size="xs" />
                            <button
                              type="button"
                              onClick={inspectTarget}
                              className="truncate hover:underline text-left cursor-pointer"
                            >
                              {tr.playerName}
                            </button>
                            <span className="text-[10.5px] mland:text-[9px] font-semibold text-[var(--mut)] shrink-0">
                              · {kindText}
                            </span>
                          </div>
                          <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate tabular mt-0.5 flex flex-wrap items-center gap-x-1">
                            <span className="inline-flex items-center gap-1 min-w-0">
                              {fromTeam && <ClubCrest name={fromTeam.name} size={12} team={fromTeam} club={state.club} />}
                              <span className={isMineOut ? 'text-[var(--ink)] font-bold' : ''}>{tr.fromTeamName}</span>
                            </span>
                            <span aria-hidden="true">→</span>
                            <span className="inline-flex items-center gap-1 min-w-0">
                              {toTeam && <ClubCrest name={toTeam.name} size={12} team={toTeam} club={state.club} />}
                              <span className={isMineIn ? 'text-[var(--g)] font-bold' : 'text-[var(--ink)] font-semibold'}>
                                {tr.toTeamName}
                              </span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              ซีซั่น {tr.season} {tr.md > 0 ? `นัดที่ ${tr.md}` : 'เปิดฤดูกาล'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right tabular shrink-0">
                          <div className={`text-xs mland:text-[10.5px] font-extrabold ${tr.fee === 0 ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                            {tr.fee === 0 ? 'ฟรี' : fmtMoneyNum(tr.fee)}
                          </div>
                          {tr.buyOption ? (
                            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">
                              ซื้อขาด {fmtMoneyNum(tr.buyOption)}
                            </div>
                          ) : (
                            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">
                              {tr.age} ปี
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-1.5">
                    <div className="text-2xl opacity-75">📰</div>
                    <div className="text-xs sm:text-sm font-bold text-[var(--ink)]">ยังไม่มีประวัติย้ายทีมตามตัวกรอง</div>
                    <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs">
                      ดีลซื้อ-ขายและยืมตัวของทั้งทีมคุณและสโมสรอื่นในลีกจะถูกบันทึกไว้ที่นี่ตลอดซีซั่น
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Right: Club Net Spend Ranking */}
            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                  💰 ตาราง Net Spend สโมสร ({sortedClubNetSpend.length})
                </h3>
                <select
                  aria-label="เรียงตาราง Net Spend"
                  value={histSortClubs}
                  onChange={(e) => setHistSortClubs(e.target.value as 'net_desc' | 'spent_desc' | 'recv_desc' | 'net_asc')}
                  className="px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] mland:text-[9px] font-semibold cursor-pointer focus:outline-none focus:border-[var(--g)]"
                >
                  <option value="net_desc">Net Spend สูงสุด</option>
                  <option value="spent_desc">ทุ่มซื้อสูงสุด</option>
                  <option value="recv_desc">ขายทำเงินสูงสุด</option>
                  <option value="net_asc">กำไรตลาดสูงสุด</option>
                </select>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
                {sortedClubNetSpend.length > 0 ? (
                  sortedClubNetSpend.map((cs, idx) => {
                    const tm = state.teams.find((t) => t.id === cs.teamId);
                    const isMine = cs.teamId === state.me;
                    const totalIn = cs.inCount + cs.loanInCount;
                    const totalOut = cs.outCount + cs.loanOutCount;
                    return (
                      <div
                        key={cs.teamId}
                        className={`flex items-center gap-2.5 mland:gap-1.5 px-3.5 py-2 mland:px-2.5 mland:py-1.5 ${
                          isMine ? 'bg-[var(--g-soft)]/35' : ''
                        }`}
                      >
                        <span className="w-5 text-center text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] tabular shrink-0">
                          {idx + 1}
                        </span>
                        <div className="shrink-0">
                          <ClubCrest name={cs.teamName} size={22} team={tm} club={state.club} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight flex items-center gap-1">
                            <span className={`truncate ${isMine ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>{cs.teamName}</span>
                            <span className="text-[10px] mland:text-[8.5px] font-normal text-[var(--mut)] shrink-0">
                              · {TN[cs.tier] || ''}
                            </span>
                          </div>
                          <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular truncate mt-0.5">
                            เข้า {totalIn} · ออก {totalOut} · จ่าย {fmtMoneyNum(cs.spent)} · รับ {fmtMoneyNum(cs.received)}
                          </div>
                        </div>
                        <div className="text-right tabular shrink-0 min-w-[66px]">
                          <div
                            className={`text-xs mland:text-[10.5px] font-extrabold ${
                              cs.netSpend > 0
                                ? 'text-[var(--red)]'
                                : cs.netSpend < 0
                                  ? 'text-[var(--g)]'
                                  : 'text-[var(--mut)]'
                            }`}
                          >
                            {cs.netSpend > 0
                              ? `-${fmtMoneyNum(cs.netSpend)}`
                              : cs.netSpend < 0
                                ? `+${fmtMoneyNum(Math.abs(cs.netSpend))}`
                                : fmtMoneyNum(0)}
                          </div>
                          <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">
                            {cs.netSpend > 0 ? 'จ่ายสุทธิ' : cs.netSpend < 0 ? 'กำไรสุทธิ' : 'สมดุล'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-1.5">
                    <div className="text-2xl opacity-75">📊</div>
                    <div className="text-xs font-bold">ยังไม่มีสรุปยอด Net Spend</div>
                    <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] max-w-xs">
                      เมื่อมีการซื้อ-ขายหรือยืมตัวเกิดขึ้นในซีซั่นนี้ ตาราง Net Spend จะอัปเดตอัตโนมัติ
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
      {loanModalNames && loanModalNames.length > 0 && (
        <SquadLoanOutModal
          state={state}
          team={me}
          playerNames={loanModalNames}
          onClose={() => setLoanModalNames(null)}
          onUpdateState={onUpdateState}
          onClearSelection={(names) =>
            setSelectedSellNames((prev) => prev.filter((name) => !names.includes(name)))
          }
          onToast={onToast}
        />
      )}
    </div>
  );
});
