import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Check, X, Dices, ArrowUpRight, ArrowLeftRight, RotateCcw, Trash2, AlertTriangle, Hammer, Shuffle, Shirt, Radio, Wand2, Link2, ChevronRight } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import type {
  Position,
  MainTab,
  Player,
  Team,
  ClubIdentity,
  CoachStyleId,
  CoachOutfitId,
  GameState,
  FacilityKey,
  StaffRoleKey,
  ClubMegastoreState,
  MegastoreSeasonArchive,
  PlayerJerseySaleRecord,
  StadiumStyleId,
  LiveStreamPlanId
} from '../types/game';
import { R, P, clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { CREST_SHAPES, CREST_PATTERNS, CREST_IC, CREST_IC_NAMES, KIT_PATTERNS, KIT_COLLARS, AWAY_KIT_PAIRINGS, getTurfGradeForLevel, STADIUM_STYLE_SPECS, getStadiumStyleSpec } from '../data/crestAndKitData';
import { TN, KIT_P, KIT_SW, SKIN_P, HAIR_P, HS_N, FH_N, FS_N, EY_N, ACC_N, COACH_STYLES, COACH_OUTFITS } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { wagOf, logFin, colDist, ensureClubIdentity, getDefaultCoachVis, getShirtNo } from '../engine/playerCore';
import {
  sortTable,
  getStaffState,
  getLeagueTransferContext,
  calcMatchdayFinanceEstimate,
  teamStats,
  getActiveBoardEffects,
  getBoardDirectiveProgress,
  issueBoardDirective,
  getClubFinanceChartData,
  MAX_FACILITY_LV,
  MAX_STAFF_LV,
  STAFF_HIRE_COSTS,
  getFacilityUpgradeCost,
  getFacilityDemolishRefund,
  getFacilityCondition,
  getFacilityRenovateCost,
  ensureTeamFans,
  fmtFans,
  fmtFansShort,
  adjustTeamFans,
  TICKET_PRICING_PLANS,
  resolveTicketPlan,
  MAIN_SPONSOR_PACKAGES,
  evaluateMainSponsorEligibility,
  calcMainSponsorPayout,
  PARTNER_DEAL_CATALOG,
  getMaxPartnerSlots,
  getActivePartnerDeals,
  syncPartnerDealsField,
  SOUVENIR_CATALOG,
  MEGASTORE_STOCK_TIERS,
  ensureMegastoreState,
  getMegastoreProjection,
  LIVE_STREAM_PLANS,
  resolveLiveStreamPlan,
  computeMatchStreamProjection,
  type ClubFinanceChartPoint
} from '../engine/simulation';
import { renderCrestPattern, ClubCrest, KitJersey, KitPatternThumb, PlayerFace } from '../components/SvgVisuals';
import { FacilityUpgradeSvg, StaffRoleSvg, getFacilityTierLabel, getStaffTierLabel, getTravelTierLabel } from '../components/FacilityUpgradeSvg';
import { ClubHistoryPanel } from '../components/ClubHistoryPanel';

interface FinTooltipProps {
  active?: boolean;
  payload?: { payload?: ClubFinanceChartPoint }[];
}

const ClubFinanceTooltip: React.FC<FinTooltipProps> = ({ active, payload }) => {
  const pt = payload?.[0]?.payload;
  if (!active || !pt) return null;
  const displayBal = pt.isProjection ? pt.projBal : pt.bal;
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--line)] px-2.5 py-2 shadow-lg text-[10.5px] space-y-1 min-w-[148px]">
      <div className="font-bold text-[var(--ink)] border-b border-[var(--line)]/60 pb-0.5 flex items-center justify-between gap-2 tabular">
        <span>{pt.label === 'เริ่ม' ? 'เปิดซีซั่น' : pt.label === 'ตอนนี้' ? 'สถานะล่าสุด' : pt.isProjection ? `คาดการณ์นัดที่ ${pt.md}` : `หลังจบนัดที่ ${pt.md}`}</span>
        {pt.isProjection && <span className="text-[9.5px] font-semibold text-[#b47b00] dark:text-[var(--lamp)]">คาดการณ์</span>}
      </div>
      {displayBal != null && (
        <div className="flex items-center justify-between gap-2 tabular">
          <span className="text-[var(--mut)]">งบคงคลัง</span>
          <b className={displayBal < 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>{fmtMoney(displayBal)}</b>
        </div>
      )}
      {(pt.inc > 0 || pt.exp > 0) && (
        <>
          <div className="flex items-center justify-between gap-2 tabular">
            <span className="text-[var(--mut)]">รายรับ</span>
            <b className="text-[var(--g)]">+{fmtMoneyNum(pt.inc)}</b>
          </div>
          <div className="flex items-center justify-between gap-2 tabular">
            <span className="text-[var(--mut)]">รายจ่าย</span>
            <b className="text-[var(--red)]">-{fmtMoneyNum(pt.exp)}</b>
          </div>
          <div className="flex items-center justify-between gap-2 tabular border-t border-[var(--line)]/50 pt-0.5">
            <span className="text-[var(--mut)]">ดุลสุทธิ</span>
            <b className={pt.net >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
              {pt.net >= 0 ? `+${fmtMoneyNum(pt.net)}` : fmtMoneyNum(pt.net)}
            </b>
          </div>
        </>
      )}
    </div>
  );
};

export const FinanceClubView: React.FC<{
  tab: 'f' | 'u';
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onNavigate?: (tab: MainTab, sub?: string) => void;
  onToast: (msg: string) => void;
  onInspectPlayer?: (p: Player, t: Team | null) => void;
  onOpenSeasonStats?: (season?: number) => void;
  navIntent?: { tab: MainTab; sub?: string; ts: number } | null;
}> = ({ tab, state, onUpdateState, onNavigate, onToast, onInspectPlayer, onOpenSeasonStats, navIntent }) => {
  const [finTab, setFinTab] = useState<'overview' | 'commercial' | 'megastore' | 'ledger'>('overview');
  const [merchPeriod, setMerchPeriod] = useState<'season' | 'alltime' | 'seasons'>('season');
  const [partnerFilter, setPartnerFilter] = useState<'all' | 'ready' | 'merch'>('all');
  const [finChartMode, setFinChartMode] = useState<'balance' | 'cashflow'>('balance');
  const [clubTab, setClubTab] = useState<'info' | 'infra' | 'identity' | 'activities' | 'legacy'>('info');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'in' | 'out'>('all');
  const [showCoachEditor, setShowCoachEditor] = useState(false);
  const [editingClubInfo, setEditingClubInfo] = useState(false);
  const [clubEditFocusField, setClubEditFocusField] = useState<'name' | 'nick' | 'std' | 'managerName' | 'motto' | 'founded'>('name');
  const [autoSyncStadium, setAutoSyncStadium] = useState(true);
  const [clubDraft, setClubDraft] = useState({
    name: '',
    nick: '',
    std: '',
    managerName: '',
    motto: '',
    founded: '2568'
  });
  const [identityDraft, setIdentityDraft] = useState<ClubIdentity | null>(null);
  const [financeDraft, setFinanceDraft] = useState<{
    winBonus: number;
    sp: number;
    ticketPlan: string;
    tp: number;
    liveStream: LiveStreamPlanId;
    stockTier: number;
  } | null>(null);
  const [crestStudioTab, setCrestStudioTab] = useState<'shape' | 'icon'>('shape');
  const [identityMobilePane, setIdentityMobilePane] = useState<'crest' | 'kit'>('crest');
  const [kitColorTarget, setKitColorTarget] = useState<'c1' | 'c2' | 'c3'>('c1');
  const [kitPatternTarget, setKitPatternTarget] = useState<'home' | 'away'>('home');
  const [coachEditorTab, setCoachEditorTab] = useState<'look' | 'style'>('look');
  const [coachDraft, setCoachDraft] = useState<{
    name: string;
    vis: number[];
    style: CoachStyleId;
    outfit: CoachOutfitId;
    randomOutfitPerMatch: boolean;
  } | null>(null);
  const [demolishTarget, setDemolishTarget] = useState<{
    key: FacilityKey;
    title: string;
    baseCost: number;
    minLv: number;
  } | null>(null);
  const [showStadiumPicker, setShowStadiumPicker] = useState(false);

  useEffect(() => {
    if (
      navIntent?.tab === 'f' &&
      (navIntent.sub === 'overview' || navIntent.sub === 'commercial' || navIntent.sub === 'megastore' || navIntent.sub === 'ledger')
    ) {
      setFinTab(navIntent.sub);
    } else if (
      navIntent?.tab === 'u' &&
      (navIntent.sub === 'info' || navIntent.sub === 'infra' || navIntent.sub === 'identity' || navIntent.sub === 'activities' || navIntent.sub === 'legacy')
    ) {
      setClubTab(navIntent.sub);
    } else if (navIntent?.tab === 'f' && navIntent.sub === 'infra') {
      setClubTab('infra');
    }
  }, [navIntent]);

  useEffect(() => {
    if (clubTab !== 'info') {
      setEditingClubInfo(false);
      setShowCoachEditor(false);
      setCoachDraft(null);
    }
  }, [clubTab]);

  useEffect(() => {
    if (tab === 'u' && clubTab === 'identity') {
      setIdentityDraft({ ...ensureClubIdentity(state) });
    } else {
      setIdentityDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, clubTab]);

  useEffect(() => {
    if (tab === 'f') {
      const tpResolved = resolveTicketPlan(state);
      const streamResolved = resolveLiveStreamPlan(state);
      const msSnap = state.megastore || ensureMegastoreState({ ...state });
      setFinanceDraft({
        winBonus: state.winBonus || 0,
        sp: state.sp ?? 0,
        ticketPlan: tpResolved.id,
        tp: tpResolved.legacyIdx,
        liveStream: streamResolved.id,
        stockTier: msSnap.stockTier ?? 1
      });
    } else {
      setFinanceDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const me = state.teams[state.me];
  const stf = getStaffState(state);
  const megastoreSnap = useMemo<ClubMegastoreState>(() => {
    if (state.megastore) return state.megastore;
    const temp: GameState = { ...state };
    return ensureMegastoreState(temp);
  }, [state]);

  const committedTicketPlan = resolveTicketPlan(state);
  const committedStreamPlan = resolveLiveStreamPlan(state);
  const committedFinance = {
    winBonus: state.winBonus || 0,
    sp: state.sp ?? 0,
    ticketPlan: committedTicketPlan.id,
    tp: committedTicketPlan.legacyIdx,
    liveStream: committedStreamPlan.id,
    stockTier: megastoreSnap.stockTier ?? 1
  };
  const activeFinanceValues = tab === 'f' && financeDraft ? financeDraft : committedFinance;
  const changedFinItems = {
    winBonus: activeFinanceValues.winBonus !== committedFinance.winBonus,
    sp: activeFinanceValues.sp !== committedFinance.sp,
    ticket:
      activeFinanceValues.ticketPlan !== committedFinance.ticketPlan ||
      activeFinanceValues.tp !== committedFinance.tp,
    liveStream: activeFinanceValues.liveStream !== committedFinance.liveStream,
    stockTier: activeFinanceValues.stockTier !== committedFinance.stockTier
  };
  const changedFinCount = Object.values(changedFinItems).filter(Boolean).length;
  const hasFinanceChanges = tab === 'f' && changedFinCount > 0;

  const finPreviewState: GameState = useMemo(() => {
    if (tab !== 'f' || !financeDraft) return state;
    return {
      ...state,
      winBonus: financeDraft.winBonus,
      sp: financeDraft.sp,
      ticketPlan: financeDraft.ticketPlan,
      tp: financeDraft.tp,
      liveStream: financeDraft.liveStream,
      megastore: {
        ...megastoreSnap,
        stockTier: financeDraft.stockTier
      }
    };
  }, [tab, financeDraft, state, megastoreSnap]);

  const est = calcMatchdayFinanceEstimate(finPreviewState, me);
  const megastoreProj = useMemo(() => getMegastoreProjection(finPreviewState, me), [finPreviewState, me]);
  const chartData = useMemo(
    () => getClubFinanceChartData(finPreviewState, est, true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      finPreviewState.season,
      finPreviewState.md,
      finPreviewState.money,
      finPreviewState.finHist,
      finPreviewState.finPendIn,
      finPreviewState.finPendOut,
      est.homeIn,
      est.awayIn,
      est.totalOut
    ]
  );
  const chartLatestProj = chartData.length ? (chartData[chartData.length - 1].projBal ?? chartData[chartData.length - 1].bal ?? Math.round(state.money)) : Math.round(state.money);
  const seasonStartBal = chartData[0]?.bal ?? Math.round(state.money);
  const seasonBalDelta = Math.round(state.money) - seasonStartBal;
  const activeBoardEffects = getActiveBoardEffects(state);
  const memoizedClubStats = useMemo(() => (tab === 'u' ? teamStats(me, state) : null), [tab, me, state]);
  const memoizedTierTbl = useMemo(() => (tab === 'u' ? sortTable(state.teams.filter((t) => t.tier === me.tier)) : []), [tab, state.teams, me.tier]);

  const upgradeFac = (key: FacilityKey, title: string, baseCost: number) => {
    const lv = state[key] ?? 1;
    const cost = getFacilityUpgradeCost(baseCost, lv);
    if (lv >= MAX_FACILITY_LV || state.money < cost) {
      onToast(lv >= MAX_FACILITY_LV ? `${title} ถึงระดับสูงสุด Lv.${MAX_FACILITY_LV} แล้ว` : `งบสโมสรไม่พอ (ต้องการ ${fmtMoney(cost)})`);
      return;
    }
    SFX.tap();
    onUpdateState((d) => {
      d.money -= cost;
      const nextLv = (d[key] ?? 1) + 1;
      d[key] = nextLv;
      d.facCond = { ...(d.facCond || {}), [key]: 100 };
      logFin(d, `${lv <= 0 ? 'ก่อสร้าง' : 'อัปเกรด'}${title} Lv.${nextLv}`, -cost);
    });
    onToast(`${lv <= 0 ? 'ก่อสร้าง' : 'อัปเกรด'}${title}เป็น Lv.${lv + 1}/${MAX_FACILITY_LV} สำเร็จ!`);
  };

  const renovateFac = (key: FacilityKey, title: string, baseCost: number) => {
    const lv = state[key] ?? 1;
    if (lv <= 0) {
      onToast(`${title} ถูกทำลายอยู่ กดสร้างใหม่เพื่อใช้งาน`);
      return;
    }
    const cond = getFacilityCondition(state, key);
    if (cond >= 100) {
      onToast(`${title} สภาพสมบูรณ์ 100% อยู่แล้ว`);
      return;
    }
    const cost = getFacilityRenovateCost(baseCost, lv, cond);
    if (state.money < cost) {
      onToast(`งบไม่พอสำหรับปรับปรุง${title} (ต้องการ ${fmtMoney(cost)})`);
      return;
    }
    SFX.tap();
    onUpdateState((d) => {
      d.money -= cost;
      d.facCond = { ...(d.facCond || {}), [key]: 100 };
      if (cond < 88) {
        if (key === 'st' || key === 'merchLv') d.fan = clamp((d.fan ?? 55) + 1, 5, 100);
        else d.mor = clamp((d.mor ?? 55) + 1, 0, 100);
      }
      logFin(d, `ปรับปรุงบำรุงรักษา${title} (${cond}% → 100%)`, -cost);
    });
    onToast(`🔧 ปรับปรุง${title}กลับมาสภาพ 100% แล้ว`);
  };

  const demolishFac = (key: FacilityKey, title: string, baseCost: number, targetLv: number) => {
    const minLv = key === 'st' ? 1 : 0;
    const curLv = clamp(state[key] ?? 1, minLv, MAX_FACILITY_LV);
    const nextLv = clamp(targetLv, minLv, curLv);
    if (nextLv >= curLv) return;
    let refund = 0;
    for (let lvStep = curLv; lvStep > nextLv; lvStep--) {
      refund += getFacilityDemolishRefund(baseCost, lvStep);
    }
    SFX.tap();
    onUpdateState((d) => {
      d[key] = nextLv;
      d.money += refund;
      const curCond = getFacilityCondition(d, key);
      d.facCond = {
        ...(d.facCond || {}),
        [key]: nextLv === 0 ? 100 : clamp(curCond - 10, 40, 100)
      };
      if (nextLv === 0 && (key === 'merchLv' || key === 'ya')) {
        d.fan = clamp((d.fan ?? 55) - 1, 5, 100);
      }
      logFin(d, `รื้อถอน/ทำลาย${title} (Lv.${curLv} → Lv.${nextLv})`, refund);
    });
    setDemolishTarget(null);
    onToast(
      nextLv === 0
        ? `🏚️ ทำลาย${title}ทั้งหมดแล้ว (ได้รับคืนค่าวัสดุ +${fmtMoney(refund)})`
        : `🔨 รื้อถอน${title}เหลือ Lv.${nextLv} (ได้รับคืนค่าวัสดุ +${fmtMoney(refund)})`
    );
  };

  const renovateAllFacs = (defs: readonly { key: FacilityKey; title: string; baseCost: number }[]) => {
    let totalCost = 0;
    const toFix: { key: FacilityKey; cond: number }[] = [];
    defs.forEach((f) => {
      const curLv = state[f.key] ?? 1;
      if (curLv <= 0) return;
      const cond = getFacilityCondition(state, f.key);
      if (cond < 100) {
        totalCost += getFacilityRenovateCost(f.baseCost, curLv, cond);
        toFix.push({ key: f.key, cond });
      }
    });
    if (!toFix.length) {
      onToast('สิ่งอำนวยความสะดวกทุกแห่งสภาพ 100% แล้ว');
      return;
    }
    if (state.money < totalCost) {
      onToast(`งบไม่พอปรับปรุงทั้งหมด (ต้องการ ${fmtMoney(totalCost)})`);
      return;
    }
    SFX.tap();
    onUpdateState((d) => {
      d.money -= totalCost;
      const nextCond: Partial<Record<FacilityKey, number>> = { ...(d.facCond || {}) };
      toFix.forEach(({ key }) => {
        nextCond[key] = 100;
      });
      d.facCond = nextCond;
      if (toFix.some((x) => x.cond < 85)) {
        d.mor = clamp((d.mor ?? 55) + 2, 0, 100);
      }
      logFin(d, `ปรับปรุงสิ่งอำนวยความสะดวกทั้งสโมสร (${toFix.length} รายการ)`, -totalCost);
    });
    onToast(`🔧 ปรับปรุงสิ่งอำนวยความสะดวกทั้ง ${toFix.length} แห่งเป็น 100% สำเร็จ!`);
  };

  const curStadiumStyle: StadiumStyleId = state.club?.stadiumStyle || 'open_track';
  const curStadiumStyleSpec = getStadiumStyleSpec(curStadiumStyle);
  const builtStadiumStyles: StadiumStyleId[] = Array.isArray(state.club?.builtStadiumStyles) && state.club.builtStadiumStyles.length > 0
    ? state.club.builtStadiumStyles
    : [curStadiumStyle];

  const buildOrSelectStadiumStyle = (styleId: StadiumStyleId) => {
    const spec = getStadiumStyleSpec(styleId);
    if (styleId === curStadiumStyle) {
      onToast(`กำลังใช้งานรูปแบบ "${spec.name}" อยู่แล้ว`);
      return;
    }
    const alreadyBuilt = builtStadiumStyles.includes(styleId);
    if (alreadyBuilt) {
      SFX.tap();
      onUpdateState((d) => {
        const club = ensureClubIdentity(d);
        club.stadiumStyle = styleId;
      });
      onToast(`🏟️ เปลี่ยนรูปแบบสนามเป็น "${spec.name}" แล้ว`);
      return;
    }
    if (state.money < spec.buildCost) {
      onToast(`งบไม่พอสร้าง "${spec.name}" (ต้องการ ${fmtMoney(spec.buildCost)})`);
      return;
    }
    SFX.tap();
    onUpdateState((d) => {
      d.money -= spec.buildCost;
      const club = ensureClubIdentity(d);
      const prevBuilt = Array.isArray(club.builtStadiumStyles) && club.builtStadiumStyles.length > 0
        ? club.builtStadiumStyles
        : [club.stadiumStyle || 'open_track'];
      club.builtStadiumStyles = prevBuilt.includes(styleId) ? prevBuilt : [...prevBuilt, styleId];
      club.stadiumStyle = styleId;
      d.facCond = { ...(d.facCond || {}), st: 100 };
      logFin(d, `ก่อสร้างรูปแบบสนาม: ${spec.name}`, -spec.buildCost);
    });
    onToast(`🏗️ ก่อสร้างสนามรูปแบบ "${spec.name}" สำเร็จ!`);
  };

  const hireStaff = (role: StaffRoleKey, title: string) => {
    const cur = stf[role];
    if (cur >= MAX_STAFF_LV) {
      onToast(`${title} ระดับสูงสุด Lv.${MAX_STAFF_LV} แล้ว`);
      return;
    }
    const cost = STAFF_HIRE_COSTS[cur] ?? 300;
    if (state.money < cost) {
      onToast(`งบไม่พอ (ต้องการ ${fmtMoney(cost)})`);
      return;
    }
    SFX.tap();
    onUpdateState((d) => {
      d.money -= cost;
      d.staff = { ...getStaffState(d), [role]: cur + 1 };
      logFin(d, `จ้าง/อัปเกรด${title} Lv.${cur + 1}`, -cost);
    });
    onToast(`จ้าง${title} Lv.${cur + 1}/${MAX_STAFF_LV} เรียบร้อย`);
  };

  const fireStaff = (role: StaffRoleKey, title: string) => {
    const cur = stf[role];
    if (cur <= 0) return;
    SFX.tap();
    onUpdateState((d) => {
      d.staff = { ...getStaffState(d), [role]: cur - 1 };
    });
    onToast(`ลดระดับ${title}เหลือ Lv.${cur - 1} (ประหยัดค่าจ้าง ${fmtMoneyNum(1.2)}/นัด)`);
  };

  if (tab === 'f') {
    const tx = getLeagueTransferContext(state, me);
    const bankRemain = state.bankLoan ? state.bankLoan.left * state.bankLoan.per : 0;
    const totalDebt = bankRemain + (state.payDue || 0);
    const tierMult = 1 + me.tier * 0.45;

    const activeDeals = getActivePartnerDeals(state);
    const maxPartnerSlots = getMaxPartnerSlots(state);
    const partnerDeals = PARTNER_DEAL_CATALOG.map((cat) => {
      const req = cat.checkReq(state, me);
      const isSigned = activeDeals.some((d) => d.id === cat.id);
      return {
        id: cat.id,
        category: cat.category,
        name: cat.name,
        perMatch: Math.round(cat.basePerMatch * tierMult),
        matches: cat.matches,
        signBonus: Math.round(cat.baseSignBonus * tierMult),
        merchBoost: cat.merchBoost || 0,
        reqOk: req.ok,
        reqText: req.text,
        isSigned
      };
    });
    const visiblePartnerDeals = partnerDeals.filter((d) => {
      if (partnerFilter === 'ready') return d.reqOk && !d.isSigned;
      if (partnerFilter === 'merch') return d.merchBoost > 0;
      return true;
    });
    const currentTicketPlan = resolveTicketPlan(finPreviewState);

    const patchFinanceDraft = (
      fn: (draft: {
        winBonus: number;
        sp: number;
        ticketPlan: string;
        tp: number;
        liveStream: LiveStreamPlanId;
        stockTier: number;
      }) => void
    ) => {
      SFX.tap();
      setFinanceDraft((prev) => {
        const next = { ...(prev || committedFinance) };
        fn(next);
        return next;
      });
    };

    const saveFinanceDraft = () => {
      if (!financeDraft || !hasFinanceChanges) return;
      SFX.confirm();
      onUpdateState((d) => {
        d.winBonus = financeDraft.winBonus;
        d.sp = financeDraft.sp;
        d.ticketPlan = financeDraft.ticketPlan;
        d.tp = financeDraft.tp;
        d.liveStream = financeDraft.liveStream;
        ensureMegastoreState(d).stockTier = financeDraft.stockTier;
      });
      onToast('บันทึกการตั้งค่าการเงินเรียบร้อยแล้ว!');
    };

    const resetFinanceDraft = () => {
      SFX.tap();
      setFinanceDraft({ ...committedFinance });
      onToast('คืนค่าการตั้งค่าการเงินเดิมแล้ว');
    };

    const loanPackages = [
      { id: 'short', title: 'สินเชื่อหมุนเวียนระยะสั้น', amount: 80, per: 9, left: 10, desc: 'ดอกเบี้ยต่ำ เหมาะอุดงบขาดมือชั่วคราว' },
      { id: 'std', title: 'สินเชื่อมาตรฐานสโมสร', amount: 150, per: 18, left: 10, desc: 'วงเงินสมดุลสำหรับเสริมทัพหรืออัปสิ่งก่อสร้าง' },
      { id: 'big', title: 'สินเชื่อลงทุนโครงสร้างใหญ่', amount: 300, per: 30, left: 12, desc: 'ทุนก้อนโตสำหรับขยายสนามและทีมงาน' }
    ];

    const finEntries = state.finLog || [];
    const totalLogIn = finEntries.filter((x) => x.amt > 0).reduce((a, x) => a + x.amt, 0);
    const totalLogOut = finEntries.filter((x) => x.amt < 0).reduce((a, x) => a + Math.abs(x.amt), 0);
    const filteredEntries = finEntries.filter((x) => (ledgerFilter === 'in' ? x.amt > 0 : ledgerFilter === 'out' ? x.amt < 0 : true));

    const posWageMap: Record<Position, number> = {
      GK: me.sq.filter((q) => q.pos === 'GK').reduce((a, q) => a + wagOf(q), 0),
      DF: me.sq.filter((q) => q.pos === 'DF').reduce((a, q) => a + wagOf(q), 0),
      MF: me.sq.filter((q) => q.pos === 'MF').reduce((a, q) => a + wagOf(q), 0),
      FW: me.sq.filter((q) => q.pos === 'FW').reduce((a, q) => a + wagOf(q), 0)
    };
    const topEarners = me.sq.slice().sort((a, b) => wagOf(b) - wagOf(a)).slice(0, 3);

    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
        {/* Top 4 Financial KPIs */}
        <div className="grid grid-cols-4 gap-2 mland:gap-1.5 shrink-0">
          <div className="p-3.5 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">งบสโมสรปัจจุบัน</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-xs tabular mt-0.5 mland:mt-0 ${state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>
              {fmtMoney(state.money)}
            </div>
            <div className={`text-[11px] mland:text-[8.5px] mt-0.5 mland:mt-0 truncate ${state.money < 0 ? 'text-[var(--red)] font-bold' : 'text-[var(--mut)]'}`}>
              {state.money < 0 ? '⚠️ ติดลบ (ล็อก FFP ซื้อตัว)' : 'สถานะการเงินพร้อมดำเนินการ'}
            </div>
          </div>

          <div className="p-3.5 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)] flex items-center justify-between gap-1">
              <span className="truncate">คาดการณ์สุทธิ / นัดเหย้า</span>
              {hasFinanceChanges && <span className="text-[9.5px] mland:text-[8px] text-[#b47b00] dark:text-[var(--lamp)] shrink-0">จำลอง</span>}
            </div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-xs tabular mt-0.5 mland:mt-0 ${est.homeNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
              {est.homeNet >= 0 ? `+${fmtMoneyNum(est.homeNet)}` : fmtMoneyNum(est.homeNet)}
            </div>
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5 mland:mt-0 truncate">
              เกมเยือน: <b className={est.awayNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>{est.awayNet >= 0 ? `+${fmtMoneyNum(est.awayNet)}` : fmtMoneyNum(est.awayNet)}</b>
            </div>
          </div>

          <div className="p-3.5 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">ค่าเหนื่อยนักเตะ / เพดาน</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-xs tabular mt-0.5 mland:mt-0 ${tx.wagePct >= 95 ? 'text-[var(--red)]' : ''}`}>
              {fmtMoneyNum(tx.curWage)} <span className="text-xs mland:text-[9.5px] font-semibold text-[var(--mut)]">/ {fmtMoneyNum(tx.wageCap)}</span>
            </div>
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5 mland:mt-0 truncate">
              ใช้ไป {tx.wagePct}% · สตาฟฟ์ -{fmtMoneyNum(est.staffCost)}/นัด
            </div>
          </div>

          <div className="p-3.5 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">ภาระหนี้คงค้างรวม</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-xs tabular mt-0.5 mland:mt-0 ${totalDebt > 0 ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--g)]'}`}>
              {fmtMoney(totalDebt)}
            </div>
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5 mland:mt-0 truncate">
              ธนาคาร {fmtMoneyNum(bankRemain)} · ค่าตัวปลายปี {fmtMoneyNum(state.payDue || 0)}
            </div>
          </div>
        </div>

        {/* Finance Sub-navigation + Save / Reset Controls */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mland:gap-1.5 shrink-0">
          <div className="seg-bar grid grid-cols-4 flex-1 min-w-0 bg-[var(--surface)]">
            {(
              [
                ['overview', '📊 กระแสเงิน & แคมเปญ'],
                ['commercial', '💼 สปอนเซอร์ & ลิขสิทธิ์ถ่ายทอด'],
                ['megastore', '🛍️ เมกะสโตร์ & ยอดขาย'],
                ['ledger', '📒 ธนาคาร & บัญชี']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFinTab(id)}
                className={`seg-btn truncate whitespace-nowrap ${
                  finTab === id ? 'seg-btn-active' : 'hover:bg-[var(--surface-2)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {hasFinanceChanges && (
              <button
                type="button"
                onClick={resetFinanceDraft}
                className="btn btn-xs sm:btn-sm btn-secondary whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>คืนค่าเดิม</span>
              </button>
            )}
            <button
              type="button"
              disabled={!hasFinanceChanges}
              onClick={saveFinanceDraft}
              className={`btn btn-xs sm:btn-sm whitespace-nowrap shrink-0 ${
                hasFinanceChanges ? 'btn-primary' : 'btn-surface'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{hasFinanceChanges ? `บันทึก (${changedFinCount})` : 'บันทึกแล้ว'}</span>
            </button>
          </div>
        </div>

        {/* Sub-tab 1: Cashflow & Matchday Boosters */}
        {finTab === 'overview' && (
          <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
            <div className="space-y-2.5 mland:space-y-2 h-full overflow-y-auto pr-0.5">
              <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2">
                <h3 className="font-bold text-sm mland:text-xs">💰 ประมาณการกระแสเงินสดต่อแมตช์</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-1.5 text-xs">
                    <div className="font-bold text-[var(--g)] flex justify-between">
                      <span>🏠 เกมเหย้า</span>
                      <span className="tabular">{est.homeNet >= 0 ? `+${fmtMoneyNum(est.homeNet)}` : fmtMoneyNum(est.homeNet)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--mut)]"><span>ค่าตั๋ว (~{est.estAtt.toLocaleString()} คน · {est.ticketPlan.priceBaht}฿)</span><b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estTicket)}</b></div>
                    <div className="flex justify-between text-[var(--mut)]"><span>เมกะสโตร์สโมสร (Lv.{state.merchLv ?? 1})</span><b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estMerch)}</b></div>
                    <div className="flex justify-between text-[var(--mut)]"><span>สปอนเซอร์หลัก + พาร์ทเนอร์ ({est.activeDealsCount})</span><b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estSponsor + est.dealIncome)}</b></div>
                    <div className="flex justify-between text-[var(--mut)]">
                      <span>ขายลิขสิทธิ์ถ่ายทอดสด ({est.streamPlan.id === 'off' ? 'ไม่ขาย' : `~${fmtFansShort(est.estStreamViewers)} ดู`})</span>
                      <b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estStreamIn)}</b>
                    </div>
                    <div className="flex justify-between text-[var(--mut)] pt-1 border-t border-[var(--line)]/60">
                      <span>รายจ่ายรวม (รวมส่วนแบ่งแพลตฟอร์ม {fmtMoneyNum(est.estStreamOut)})</span>
                      <b className="text-[var(--red)] tabular">-{fmtMoneyNum(est.totalOut)}</b>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-1.5 text-xs">
                    <div className="font-bold flex justify-between">
                      <span>✈️ เกมเยือน</span>
                      <span className={`tabular ${est.awayNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>{est.awayNet >= 0 ? `+${fmtMoneyNum(est.awayNet)}` : fmtMoneyNum(est.awayNet)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--mut)]"><span>สปอนเซอร์หลัก + พาร์ทเนอร์</span><b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estSponsor + est.dealIncome)}</b></div>
                    <div className="flex justify-between text-[var(--mut)]">
                      <span>ลิขสิทธิ์ถ่ายทอดสดออนไลน์ ({est.streamPlan.short})</span>
                      <b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estStreamIn)}</b>
                    </div>
                    <div className="flex justify-between text-[var(--mut)]"><span>ค่าเหนื่อยนักเตะ + สตาฟฟ์</span><b className="text-[var(--red)] tabular">-{fmtMoneyNum(est.wageCost + est.staffCost)}</b></div>
                    <div className="flex justify-between text-[var(--mut)]"><span>ค่าธรรมเนียม/ส่วนแบ่งแพลตฟอร์ม</span><b className="text-[var(--red)] tabular">-{fmtMoneyNum(est.estStreamOut)}</b></div>
                    <div className="flex justify-between text-[var(--mut)] pt-1 border-t border-[var(--line)]/60"><span>ผ่อนเงินกู้ธนาคาร</span><b className="text-[var(--red)] tabular">-{fmtMoneyNum(est.loanCost)}</b></div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">⚖️ สรุปเสถียรภาพการเงิน &amp; เพดาน FFP</span>
                  <span className={`font-bold tabular ${tx.wagePct >= 95 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                    เพดานค่าเหนื่อย {tx.wagePct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${clamp(tx.wagePct, 4, 100)}%`,
                      background: tx.wagePct >= 95 ? 'var(--red)' : tx.wagePct >= 80 ? 'var(--lamp)' : 'var(--g)'
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                    <div className="text-[10px] text-[var(--mut)]">เฉลี่ยสุทธิเหย้า/เยือน</div>
                    <div className={`font-bold text-xs tabular ${Math.round((est.homeNet + est.awayNet) / 2) >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                      {Math.round((est.homeNet + est.awayNet) / 2) >= 0
                        ? `+${fmtMoneyNum(Math.round((est.homeNet + est.awayNet) / 2))}`
                        : fmtMoneyNum(Math.round((est.homeNet + est.awayNet) / 2))}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                    <div className="text-[10px] text-[var(--mut)]">อัตราเข้าชมเหย้า</div>
                    <div className="font-bold text-xs tabular">{est.attPct}%</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                    <div className="text-[10px] text-[var(--mut)]">พาร์ทเนอร์ ({activeDeals.length}/{maxPartnerSlots})</div>
                    <div className="font-bold text-xs tabular">
                      {activeDeals.length > 0 ? `+${fmtMoneyNum(est.dealIncome)}/นัด` : 'ว่าง'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 mland:space-y-2 h-full overflow-y-auto pr-0.5">
              {/* Club Finance Chart Card */}
              <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm mland:text-xs">📈 กราฟการเงินของสโมสร</h3>
                    <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
                      เทียบเปิดซีซั่น:{' '}
                      <b className={seasonBalDelta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
                        {seasonBalDelta >= 0 ? `+${fmtMoneyNum(seasonBalDelta)}` : fmtMoneyNum(seasonBalDelta)}
                      </b>
                      {' · '}คาด 5 นัด:{' '}
                      <b className={chartLatestProj < 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>
                        {fmtMoney(chartLatestProj)}
                      </b>
                    </div>
                  </div>
                  <div className="seg-bar shrink-0">
                    <button
                      type="button"
                      onClick={() => setFinChartMode('balance')}
                      className={`seg-btn ${
                        finChartMode === 'balance' ? 'seg-btn-active' : ''
                      }`}
                    >
                      ยอดเงินคงคลัง
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinChartMode('cashflow')}
                      className={`seg-btn ${
                        finChartMode === 'cashflow' ? 'seg-btn-active' : ''
                      }`}
                    >
                      รายรับ-รายจ่าย
                    </button>
                  </div>
                </div>

                <div className="h-[170px] mland:h-[132px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {finChartMode === 'balance' ? (
                      <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="clubBalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.5} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: 'var(--mut)' }}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--line)' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--mut)' }}
                          tickLine={false}
                          axisLine={false}
                          width={46}
                          tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}M` : `${v}k`)}
                        />
                        <Tooltip content={<ClubFinanceTooltip />} />
                        <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="3 3" strokeOpacity={0.75} />
                        <Area
                          type="monotone"
                          dataKey="bal"
                          name="งบจริง"
                          stroke="#10b981"
                          strokeWidth={2.2}
                          fill="url(#clubBalGrad)"
                          dot={{ r: 2.5, fill: '#10b981', strokeWidth: 0 }}
                          activeDot={{ r: 4 }}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="projBal"
                          name="คาดการณ์"
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={{ r: 2.2, fill: '#eab308', strokeWidth: 0 }}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    ) : (
                      <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.5} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: 'var(--mut)' }}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--line)' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--mut)' }}
                          tickLine={false}
                          axisLine={false}
                          width={46}
                          tickFormatter={(v: number) => `${v}k`}
                        />
                        <Tooltip content={<ClubFinanceTooltip />} />
                        <ReferenceLine y={0} stroke="var(--line)" />
                        <Bar dataKey="inc" name="รายรับ" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                        <Bar dataKey="exp" name="รายจ่าย" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                        <Line
                          type="monotone"
                          dataKey="net"
                          name="สุทธิ"
                          stroke="#3b82f6"
                          strokeWidth={1.8}
                          dot={{ r: 2, fill: '#3b82f6', strokeWidth: 0 }}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--mut)] pt-0.5 border-t border-[var(--line)]/50">
                  {finChartMode === 'balance' ? (
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#10b981] inline-block" /> งบจริง</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 border-t-2 border-dashed border-[#eab308] inline-block" /> คาดการณ์ 5 นัด</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 border-t border-dashed border-[var(--red)] inline-block" /> เส้นวิกฤติ 0฿</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#10b981] inline-block" /> รายรับ</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#ef4444] inline-block" /> รายจ่าย</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#3b82f6] inline-block" /> ดุลสุทธิ</span>
                    </div>
                  )}
                  <span className="tabular">ซีซั่นที่ {state.season} · นัดที่ {state.md}</span>
                </div>
              </div>

              <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-sm mland:text-xs">⚡ มาตรการกระตุ้นนัดถัดไป</h3>
                  <span className="text-[11px] text-[var(--mut)]">มีผลทันทีในแมตช์ที่กำลังจะลงแข่ง</span>
                </div>
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-xs">🏆 โบนัสอัดฉีดชัยชนะ (จ่ายเฉพาะเมื่อชนะ)</div>
                    {changedFinItems.winBonus && (
                      <span className="text-[10px] font-bold text-[#b47b00] dark:text-[var(--lamp)] shrink-0">รอการบันทึก</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--mut)]">เพิ่มความมุ่งมั่นและโอกาสทำผลงานดีในนัดสำคัญ</div>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      [0, 'ไม่มีโบนัส'],
                      [10, '10k (ขวัญ +)'],
                      [25, '25k (ขวัญ ++)']
                    ] as const).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => patchFinanceDraft((d) => { d.winBonus = v; })}
                        className={`btn btn-sm flex-1 ${
                          activeFinanceValues.winBonus === v ? 'btn-primary' : 'btn-surface'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-2">
                  <div className="font-bold text-xs">📣 แคมเปญโปรโมตวันแข่ง</div>
                  <div className="text-[11px] text-[var(--mut)]">
                    {state.promo === 1
                      ? '✅ กำลังใช้งาน: แคมเปญดึงดูดผู้ชม (ตั๋วนัดหน้า +35% และแฟนเข้าชม +15%)'
                      : state.promo === 2
                        ? '✅ กำลังใช้งาน: บูสต์สปอนเซอร์วันแข่ง (+35% รายได้สปอนเซอร์)'
                        : 'เลือกลงทุนโปรโมต 1 นัด เพื่อดันรายได้วันแข่งขัน'}
                  </div>
                  {!state.promo && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={state.money < 15}
                        onClick={() => {
                          onUpdateState((d) => {
                            d.money -= 15;
                            d.promo = 1;
                            logFin(d, 'โปรโมตตั๋ววันแข่ง', -15);
                          });
                          onToast('เปิดแคมเปญโปรโมตตั๋ววันแข่งแล้ว');
                        }}
                        className="btn btn-sm btn-surface flex-1"
                      >
                        โปรโมตตั๋ว (15k)
                      </button>
                      <button
                        type="button"
                        disabled={state.money < 25}
                        onClick={() => {
                          onUpdateState((d) => {
                            d.money -= 25;
                            d.promo = 2;
                            logFin(d, 'บูสต์สปอนเซอร์วันแข่ง', -25);
                          });
                          onToast('เปิดแคมเปญบูสต์สปอนเซอร์แล้ว');
                        }}
                        className="btn btn-sm btn-surface flex-1"
                      >
                        บูสต์สปอนฯ (25k)
                      </button>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Sub-tab 2: Expanded Main Sponsors (8), Multi-Slot Partners (10) & Ticket Tiers (7) */}
        {finTab === 'commercial' && (
          <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
            <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-0.5">
              {/* Main Sponsors (8 options) */}
              <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm mland:text-xs">🤝 สปอนเซอร์หลักคาดอกเสื้อ ({MAIN_SPONSOR_PACKAGES.length} แพ็กเกจ)</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {changedFinItems.sp && (
                      <span className="text-[10px] font-bold text-[#b47b00] dark:text-[var(--lamp)]">รอการบันทึก</span>
                    )}
                    <span className="text-[10.5px] font-bold text-[var(--g)] tabular">
                      รับปัจจุบัน {fmtMoneyNum(est.estSponsor)}/นัด
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {MAIN_SPONSOR_PACKAGES.map((pkg) => {
                    const active = activeFinanceValues.sp === pkg.idx;
                    const elig = evaluateMainSponsorEligibility(pkg.idx, state, me);
                    const preview = calcMainSponsorPayout({ sp: pkg.idx, promo: 0 }, me);
                    return (
                      <button
                        key={pkg.idx}
                        type="button"
                        disabled={!elig.ok}
                        onClick={() => {
                          patchFinanceDraft((d) => {
                            d.sp = pkg.idx;
                          });
                        }}
                        className={`w-full p-2.5 mland:p-2 rounded-xl border text-left transition-colors ${
                          !elig.ok
                            ? 'bg-[var(--surface-2)]/40 border-transparent opacity-65 cursor-not-allowed'
                            : active
                              ? 'bg-[var(--g-soft)] border-[var(--g)] cursor-pointer'
                              : 'bg-[var(--surface-2)] border-transparent hover:border-[var(--line)] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-bold">
                          <span className="truncate">
                            {pkg.title} · <span className="text-[var(--mut)] font-semibold">{pkg.brand}</span>
                          </span>
                          <span className="text-[var(--g)] tabular shrink-0">{preview.previewText}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[10.5px] text-[var(--mut)] mt-0.5">
                          <span className="truncate">{pkg.desc}</span>
                          <span className={`shrink-0 font-semibold ${elig.ok ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                            {active ? (committedFinance.sp === pkg.idx ? 'ใช้งานอยู่' : 'เลือกไว้ (รอบันทึก)') : elig.ok ? pkg.tag : elig.reqText}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Slot Partner Deals (10 options) */}
              <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm mland:text-xs">
                      📄 ดีลพาร์ทเนอร์ธุรกิจ ({PARTNER_DEAL_CATALOG.length} ราย · ช่องสัญญา {activeDeals.length}/{maxPartnerSlots})
                    </h3>
                    <div className="text-[10px] text-[var(--mut)]">
                      {maxPartnerSlots < 3
                        ? 'อัปเกรดเมกะสโตร์ Lv.5 เพื่อปลดล็อกช่องพาร์ทเนอร์ที่ 3'
                        : 'ปลดล็อกช่องสัญญาครบ 3 ช่องแล้ว'}
                    </div>
                  </div>
                  <div className="seg-bar shrink-0">
                    {(
                      [
                        ['all', 'ทั้งหมด'],
                        ['ready', 'พร้อมเซ็น'],
                        ['merch', '+สโตร์']
                      ] as const
                    ).map(([fid, flbl]) => (
                      <button
                        key={fid}
                        type="button"
                        onClick={() => setPartnerFilter(fid)}
                        className={`seg-btn whitespace-nowrap ${partnerFilter === fid ? 'seg-btn-active' : ''}`}
                      >
                        {flbl}
                      </button>
                    ))}
                  </div>
                </div>

                {activeDeals.length > 0 && (
                  <div className="space-y-1.5">
                    {activeDeals.map((ad) => (
                      <div
                        key={ad.id}
                        className="p-2.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {ad.name}
                            {ad.category ? <span className="text-[10px] text-[var(--mut)] font-normal"> · {ad.category}</span> : null}
                          </div>
                          <div className="text-[10.5px] text-[var(--mut)] tabular">
                            +{fmtMoneyNum(ad.perMatch)}/นัด · เหลือ {ad.left} นัด (รวมอีก ~{fmtMoney(ad.left * ad.perMatch)})
                            {ad.merchBoost ? ` · บูสต์สโตร์ +${Math.round(ad.merchBoost * 100)}%` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              const nextDeals = getActivePartnerDeals(d).filter((x) => x.id !== ad.id);
                              syncPartnerDealsField(d, nextDeals);
                            });
                            onToast(`ยกเลิกสัญญาพาร์ทเนอร์ ${ad.name} แล้ว`);
                          }}
                          className="btn btn-xs btn-surface text-[var(--red)] shrink-0 whitespace-nowrap"
                        >
                          ยกเลิกดีล
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  {visiblePartnerDeals.map((deal) => {
                    const slotsFull = activeDeals.length >= maxPartnerSlots;
                    const disabled = deal.isSigned || slotsFull || !deal.reqOk;
                    return (
                      <div key={deal.id} className="p-2.5 rounded-xl bg-[var(--surface-2)] flex items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">
                            {deal.name} <span className="text-[10px] font-medium text-[var(--mut)]">· {deal.category}</span>
                          </div>
                          <div className="text-[10.5px] text-[var(--mut)] tabular">
                            +{fmtMoneyNum(deal.perMatch)}/นัด · {deal.matches} นัด · โบนัสเซ็น +{fmtMoneyNum(deal.signBonus)}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${deal.reqOk ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                            {deal.reqText}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              const cur = getActivePartnerDeals(d);
                              if (cur.length >= getMaxPartnerSlots(d) || cur.some((x) => x.id === deal.id)) return;
                              syncPartnerDealsField(d, [
                                ...cur,
                                {
                                  id: deal.id,
                                  name: deal.name,
                                  category: deal.category,
                                  perMatch: deal.perMatch,
                                  left: deal.matches,
                                  merchBoost: deal.merchBoost
                                }
                              ]);
                              d.money += deal.signBonus;
                              logFin(d, `โบนัสเซ็นสัญญาพาร์ทเนอร์: ${deal.name}`, deal.signBonus);
                            });
                            onToast(`เซ็นสัญญากับ ${deal.name} สำเร็จ (+${fmtMoney(deal.signBonus)})`);
                          }}
                          className="btn btn-sm btn-primary shrink-0 whitespace-nowrap"
                        >
                          {deal.isSigned ? 'ใช้งานอยู่' : slotsFull ? 'ช่องเต็ม' : 'เซ็นสัญญา'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Ticket Pricing Tiers (7) + Unified Store Architecture Card */}
            <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-0.5">
              <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm mland:text-xs">🎫 นโยบายราคาตั๋วเข้าชม ({TICKET_PRICING_PLANS.length} ระดับ)</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {changedFinItems.ticket && (
                      <span className="text-[10px] font-bold text-[#b47b00] dark:text-[var(--lamp)]">รอการบันทึก</span>
                    )}
                    <span className="text-xs font-bold text-[var(--g)] tabular">
                      ~{est.estAtt.toLocaleString()} / {est.cap.toLocaleString()} ({est.attPct}%)
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {TICKET_PRICING_PLANS.map((plan) => {
                    const active = currentTicketPlan.id === plan.id;
                    const stLv = state.st ?? 1;
                    const locked = !!(plan.minStadiumLv && stLv < plan.minStadiumLv);
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          patchFinanceDraft((d) => {
                            d.ticketPlan = plan.id;
                            d.tp = plan.legacyIdx;
                          });
                        }}
                        className={`p-2.5 mland:p-2 rounded-xl text-left border transition-colors ${
                          locked
                            ? 'bg-[var(--surface-2)]/40 border-transparent opacity-60 cursor-not-allowed'
                            : active
                              ? 'bg-[var(--g)] text-white border-[var(--g)] cursor-pointer'
                              : 'bg-[var(--surface-2)] border-transparent hover:border-[var(--line)] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 text-xs font-bold">
                          <span className="truncate">{plan.label}</span>
                          <span className="tabular shrink-0">{plan.priceBaht}฿</span>
                        </div>
                        <div className={`text-[10px] mt-0.5 tabular ${active ? 'text-white/90' : 'text-[var(--mut)]'}`}>
                          ผู้ชม {Math.round(plan.attMult * 100)}% · รายรับ {Math.round(plan.revMult * 100)}% · สโตร์ +{Math.round((plan.merchMult - 1) * 100)}%
                        </div>
                        <div className={`text-[10px] mt-0.5 truncate ${active ? 'text-white/85' : locked ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                          {locked ? `ต้องอัปสนามเหย้า Lv.${plan.minStadiumLv}+` : plan.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)] flex items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--mut)]">
                    {changedFinItems.ticket ? 'ที่เลือกไว้:' : 'ใช้งาน:'}{' '}
                    <b className="text-[var(--ink)]">{currentTicketPlan.label} ({currentTicketPlan.priceBaht}฿)</b>
                  </span>
                  <b className="text-[var(--g)] tabular shrink-0">+{fmtMoney(est.estTicket)} / นัดเหย้า</b>
                </div>
              </div>

              {/* Online Live Streaming & Broadcast Rights Card */}
              {(() => {
                const curStreamPlan = resolveLiveStreamPlan(finPreviewState);
                const nxtRound = state.fx?.[state.md];
                const nxtPair = nxtRound?.find(([x, y]) => x === state.me || y === state.me);
                const oppId = nxtPair ? (nxtPair[0] === state.me ? nxtPair[1] : nxtPair[0]) : state.me;
                const oppTeam = state.teams[oppId] || me;
                return (
                  <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-sm mland:text-xs flex items-center gap-1.5">
                        <Radio className="w-4 h-4 text-[var(--red)] shrink-0" />
                        <span>ขายลิขสิทธิ์ถ่ายทอดสดออนไลน์</span>
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {changedFinItems.liveStream && (
                          <span className="text-[10px] font-bold text-[#b47b00] dark:text-[var(--lamp)]">รอการบันทึก</span>
                        )}
                        <span className="text-xs font-bold text-[var(--g)] tabular">
                          {curStreamPlan.id === 'off' ? 'ช่องกลางลีก' : `~${est.estStreamViewers.toLocaleString()} คนดู`}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {LIVE_STREAM_PLANS.map((plan) => {
                        const active = curStreamPlan.id === plan.id;
                        const proj = computeMatchStreamProjection(me, oppTeam, finPreviewState, {
                          kind: 'league',
                          derby: !!state.derby,
                          planOverride: plan
                        });
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => {
                              patchFinanceDraft((d) => {
                                d.liveStream = plan.id;
                              });
                            }}
                            className={`p-2.5 mland:p-2 rounded-xl text-left border transition-colors cursor-pointer ${
                              active
                                ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                : 'bg-[var(--surface-2)] border-transparent hover:border-[var(--line)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5 text-xs font-bold">
                              <span className="truncate">{plan.short}</span>
                              {plan.id === 'off' ? (
                                <span className="text-[10.5px] opacity-80 shrink-0">0฿ / นัด</span>
                              ) : (
                                <span
                                  className={`tabular text-[11px] shrink-0 ${
                                    active
                                      ? 'text-white'
                                      : proj.estNet >= 0
                                        ? 'text-[var(--g)]'
                                        : 'text-[var(--red)]'
                                  }`}
                                >
                                  สุทธิ {proj.estNet >= 0 ? `+${fmtMoneyNum(proj.estNet)}` : fmtMoneyNum(proj.estNet)}
                                </span>
                              )}
                            </div>
                            {plan.id === 'off' ? (
                              <div className={`text-[10px] mt-1 leading-snug ${active ? 'text-white/85' : 'text-[var(--mut)]'}`}>
                                {plan.desc}
                              </div>
                            ) : (
                              <>
                                <div className={`text-[10px] mt-0.5 tabular flex items-center justify-between gap-1 ${active ? 'text-white/90' : 'text-[var(--ink)]'}`}>
                                  <span>คนดู ~{fmtFansShort(proj.baseViewers)}</span>
                                  <span>รับ +{fmtMoneyNum(proj.estIn)} · หัก -{fmtMoneyNum(proj.estOut)}</span>
                                </div>
                                <div className={`text-[9.5px] mt-0.5 tabular truncate ${active ? 'text-white/80' : 'text-[var(--mut)]'}`}>
                                  ค่าประสานงาน {plan.crewCost}k · ค่าสัญญาณ {plan.gearCost}k · ส่วนแบ่งแพลตฟอร์ม {plan.rightsCost}k
                                </div>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {state.streamStats && state.streamStats.matches > 0 && (
                      <div className="p-2.5 rounded-xl bg-[var(--surface-2)] flex flex-wrap items-center justify-between gap-2 text-[11px] tabular">
                        <span className="text-[var(--mut)]">
                          ถ่ายทอดสดล่าสุด <b className="text-[var(--ink)]">{state.streamStats.lastPeakViewers.toLocaleString()}</b> คนดู · รวม {state.streamStats.matches} นัด
                        </span>
                        <span className="font-bold">
                          <span className="text-[var(--g)]">+{fmtMoneyNum(state.streamStats.totalIn)}</span>
                          <span className="text-[var(--mut)] mx-1">/</span>
                          <span className="text-[var(--red)]">-{fmtMoneyNum(state.streamStats.totalOut)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Clean Bridge Card resolving "Souvenir Shop vs Megastore" duplication */}
              {(() => {
                const merchLv = clamp(state.merchLv ?? 1, 0, MAX_FACILITY_LV);
                const merchCond = getFacilityCondition(state, 'merchLv');
                return (
                  <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                    <div className="flex items-start gap-3">
                      <FacilityUpgradeSvg
                        kind="merchLv"
                        level={merchLv}
                        condition={merchCond}
                        c1={me.kc[0]}
                        c2={me.kc[1]}
                        className="w-20 h-14 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-sm truncate">🛍️ เมกะสโตร์ &amp; ของที่ระลึกสโมสร</h3>
                          <span className={`text-xs font-bold tabular shrink-0 ${merchLv === 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                            Lv.{merchLv}/{MAX_FACILITY_LV}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--mut)] mt-0.5 leading-snug">
                          ร้านขายของที่ระลึกและเมกะสโตร์ถูกรวมเป็นระบบเดียว: อัปเกรด/ซ่อมอาคารที่แท็บ <b>สโมสร → สิ่งอำนวยความสะดวก</b> และดูยอดขายเสื้อ-ของชำร่วย-เติมเงินทุนได้ที่แท็บ <b>เมกะสโตร์ &amp; ยอดขาย</b>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                        <div className="text-[10px] text-[var(--mut)]">สภาพอาคาร</div>
                        <div className={`font-bold tabular ${merchLv <= 0 || merchCond < 75 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                          {merchLv <= 0 ? 'ปิดทำการ' : `${merchCond}%`}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                        <div className="text-[10px] text-[var(--mut)]">เงินทุนร้าน</div>
                        <div className="font-bold tabular">{fmtMoney(megastoreSnap.capital)}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                        <div className="text-[10px] text-[var(--mut)]">คาดการณ์/นัดเหย้า</div>
                        <div className="font-bold text-[var(--g)] tabular">+{fmtMoneyNum(est.estMerch)}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setFinTab('megastore');
                        }}
                        className="btn btn-sm btn-primary flex-1 whitespace-nowrap"
                      >
                        🛍️ เปิดเมกะสโตร์ &amp; ยอดขายเสื้อ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          if (onNavigate) onNavigate('u', 'infra');
                          else onToast('กรุณาเปิดแท็บ สโมสร → สิ่งอำนวยความสะดวก เพื่ออัปเกรดอาคาร');
                        }}
                        className="btn btn-sm btn-surface shrink-0 whitespace-nowrap"
                      >
                        🏟️ อัปเกรดอาคาร (สโมสร)
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Sub-tab 3: Club Megastore Working Capital, Blank/Player Jersey Rankings & Souvenirs */}
        {finTab === 'megastore' && (() => {
          const merchLv = clamp(state.merchLv ?? 1, 0, MAX_FACILITY_LV);
          const merchCond = getFacilityCondition(state, 'merchLv');
          const curTierDef = megastoreProj.tierDef;

          // Aggregate per-SKU all-time souvenir counts by summing archived seasons + active season
          const computeSouvenirRows = (period: 'season' | 'alltime'): {
            id: string;
            name: string;
            icon: string;
            unitPriceBaht: number;
            units: number;
            revenue: number;
          }[] => {
            return SOUVENIR_CATALOG.map((sku) => {
              let units = megastoreSnap.souvenirs[sku.id] || 0;
              let rev = megastoreSnap.souvenirRevs[sku.id] || 0;
              if (period === 'alltime') {
                megastoreSnap.seasonHistory.forEach((arch) => {
                  const found = arch.souvenirs.find((x) => x.id === sku.id);
                  if (found) {
                    units += found.units;
                    rev += found.revenue;
                  }
                });
              }
              return {
                id: sku.id,
                name: sku.name,
                icon: sku.icon,
                unitPriceBaht: Math.round(sku.unitPriceBaht * curTierDef.souvenirPriceMult),
                units,
                revenue: +rev.toFixed(2)
              };
            }).sort((a, b) => b.revenue - a.revenue);
          };

          const curSeasonPlayerRows = Object.values(megastoreSnap.playerJerseys)
            .slice()
            .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
          const curPrintedUnits = curSeasonPlayerRows.reduce((s, r) => s + r.units, 0);
          const curPrintedRev = +curSeasonPlayerRows.reduce((s, r) => s + r.revenue, 0).toFixed(2);
          const curSouvRows = computeSouvenirRows('season');
          const curSouvUnits = curSouvRows.reduce((s, r) => s + r.units, 0);
          const curSouvRev = +curSouvRows.reduce((s, r) => s + r.revenue, 0).toFixed(2);
          const curSeasonTotalRev = +(megastoreSnap.seasonRev || megastoreSnap.blankJerseyRev + curPrintedRev + curSouvRev).toFixed(2);
          const curSeasonNet = +(curSeasonTotalRev - megastoreSnap.seasonCost).toFixed(2);

          const allTimePlayerRows = Object.values(megastoreSnap.allTimePlayerJerseys)
            .slice()
            .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
          const allTimeSouvRows = computeSouvenirRows('alltime');

          const activeBlankUnits = merchPeriod === 'alltime' ? megastoreSnap.allTimeBlankUnits : megastoreSnap.blankJerseyUnits;
          const activeBlankRev = merchPeriod === 'alltime' ? megastoreSnap.allTimeBlankRev : megastoreSnap.blankJerseyRev;
          const activePrintedRows: PlayerJerseySaleRecord[] = merchPeriod === 'alltime' ? allTimePlayerRows : curSeasonPlayerRows;
          const activePrintedUnits =
            merchPeriod === 'alltime'
              ? Math.max(megastoreSnap.allTimePrintedUnits, allTimePlayerRows.reduce((s, r) => s + r.units, 0))
              : curPrintedUnits;
          const activePrintedRev =
            merchPeriod === 'alltime'
              ? +Math.max(megastoreSnap.allTimePrintedRev, allTimePlayerRows.reduce((s, r) => s + r.revenue, 0)).toFixed(2)
              : curPrintedRev;
          const activeSouvRows = merchPeriod === 'alltime' ? allTimeSouvRows : curSouvRows;
          const activeSouvUnits = activeSouvRows.reduce((s, r) => s + r.units, 0);
          const activeSouvRev = +activeSouvRows.reduce((s, r) => s + r.revenue, 0).toFixed(2);
          const topSeller = activePrintedRows[0] || null;
          const topSellerPlayer = topSeller ? me.sq.find((p) => p.n === topSeller.name) || null : null;
          const maxSouvRev = Math.max(0.1, ...activeSouvRows.map((x) => x.revenue));
          const maxJerseyUnits = Math.max(1, ...activePrintedRows.map((x) => x.units));

          const currentLiveArchive: MegastoreSeasonArchive = {
            season: state.season,
            capitalInvested: megastoreSnap.capitalInvestedSeason,
            productionCost: megastoreSnap.seasonCost,
            totalRevenue: curSeasonTotalRev,
            netProfit: curSeasonNet,
            blankJerseys: { units: megastoreSnap.blankJerseyUnits, revenue: megastoreSnap.blankJerseyRev },
            printedJerseysTotal: { units: curPrintedUnits, revenue: curPrintedRev },
            souvenirsTotal: { units: curSouvUnits, revenue: curSouvRev },
            topPlayer: curSeasonPlayerRows[0] || null,
            playerJerseys: curSeasonPlayerRows,
            souvenirs: curSouvRows.map((s) => ({
              id: s.id as 'scarf' | 'cap' | 'keychain' | 'mug' | 'ball' | 'poster',
              name: s.name,
              icon: s.icon,
              unitPriceBaht: s.unitPriceBaht,
              units: s.units,
              revenue: s.revenue
            }))
          };
          const combinedSeasons: MegastoreSeasonArchive[] = [
            currentLiveArchive,
            ...megastoreSnap.seasonHistory.filter((h) => h.season !== state.season)
          ].sort((a, b) => b.season - a.season);

          const topUpCapital = (amt: number) => {
            if (state.money < amt) {
              onToast(`งบสโมสรไม่พอ (ต้องการ ${fmtMoney(amt)})`);
              return;
            }
            SFX.tap();
            onUpdateState((d) => {
              const ms = ensureMegastoreState(d);
              d.money -= amt;
              ms.capital = +(ms.capital + amt).toFixed(2);
              ms.capitalInvestedSeason = +(ms.capitalInvestedSeason + amt).toFixed(2);
              logFin(d, `เพิ่มเงินทุนหมุนเวียนเมกะสโตร์`, -amt);
            });
            onToast(`เติมเงินทุนหมุนเวียนเมกะสโตร์ +${fmtMoney(amt)} สำเร็จ!`);
          };

          return (
            <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
              {/* Store Status & Physical Building Link Strip */}
              <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-bold text-xs sm:text-sm truncate">
                    🛍️ เมกะสโตร์สโมสร (Lv.{merchLv}/{MAX_FACILITY_LV})
                  </span>
                  <span className="text-[11px] text-[var(--mut)] tabular">
                    สภาพอาคาร <b className={merchLv <= 0 || merchCond < 75 ? 'text-[var(--red)]' : 'text-[var(--g)]'}>{merchLv <= 0 ? 'ถูกทำลาย' : `${merchCond}%`}</b>
                    {' · '}ตัวคูณสโตร์จากตั๋ว/สปอนเซอร์ <b className="text-[var(--ink)] tabular">×{megastoreProj.extraMerchMult.toFixed(2)}</b>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    if (onNavigate) onNavigate('u', 'infra');
                    else onToast('กรุณาไปที่แท็บ สโมสร → สิ่งอำนวยความสะดวก');
                  }}
                  className="btn btn-xs btn-surface shrink-0 whitespace-nowrap"
                >
                  🏟️ {merchLv <= 0 ? 'สร้างร้านเมกะสโตร์ใหม่' : 'อัปเกรด / ซ่อมอาคารร้าน'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
                {/* Left Column: Working Capital, Stock Quality & Souvenirs Breakdown */}
                <div className="space-y-2.5 mland:space-y-2 h-full overflow-y-auto pr-0.5">
                  <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-sm mland:text-xs">💼 เงินทุนหมุนเวียน &amp; ผลประกอบการ (ซ.{state.season})</h3>
                      <span className={`text-[10.5px] font-bold tabular ${megastoreProj.stockReady ? 'text-[var(--g)]' : 'text-[#b47b00] dark:text-[var(--lamp)]'}`}>
                        {megastoreProj.stockReady ? 'สต็อกพร้อมขายเต็มที่' : 'ทุนหมุนเวียนต่ำ'}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                        <div className="text-[10px] text-[var(--mut)]">เงินทุนร้าน</div>
                        <div className={`font-bold text-xs tabular mt-0.5 ${megastoreSnap.capital < 3 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>
                          {fmtMoney(megastoreSnap.capital)}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                        <div className="text-[10px] text-[var(--mut)]">ต้นทุนผลิต</div>
                        <div className="font-bold text-xs text-[var(--red)] tabular mt-0.5">
                          {fmtMoney(megastoreSnap.seasonCost)}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                        <div className="text-[10px] text-[var(--mut)]">ยอดขายรวม</div>
                        <div className="font-bold text-xs text-[var(--g)] tabular mt-0.5">
                          {fmtMoney(curSeasonTotalRev)}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                        <div className="text-[10px] text-[var(--mut)]">กำไรสุทธิ</div>
                        <div className={`font-bold text-xs tabular mt-0.5 ${curSeasonNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                          {curSeasonNet >= 0 ? `+${fmtMoney(curSeasonNet)}` : fmtMoney(curSeasonNet)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] bg-[var(--surface-2)] p-2 rounded-xl">
                      <span className="text-[var(--mut)]">
                        ทุนลงซีซั่นนี้: <b className="text-[var(--ink)] tabular">{fmtMoney(megastoreSnap.capitalInvestedSeason)}</b>
                        {' · '}คาดเหย้าหน้า <b className="text-[var(--g)] tabular">+{fmtMoney(megastoreProj.estMatchSales)}</b>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {([25, 50, 100] as const).map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            disabled={state.money < amt}
                            onClick={() => topUpCapital(amt)}
                            className="btn btn-xs btn-primary whitespace-nowrap"
                          >
                            +ทุน {amt}k
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold text-[var(--mut)]">เกรดสต็อกเสื้อ &amp; ราคาจำหน่ายหน้าร้าน</div>
                        {changedFinItems.stockTier && (
                          <span className="text-[10px] font-bold text-[#b47b00] dark:text-[var(--lamp)]">รอการบันทึก</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MEGASTORE_STOCK_TIERS.map((tier) => {
                          const active = activeFinanceValues.stockTier === tier.idx;
                          return (
                            <button
                              key={tier.idx}
                              type="button"
                              onClick={() => {
                                patchFinanceDraft((d) => {
                                  d.stockTier = tier.idx;
                                });
                              }}
                              className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[var(--g-soft)] border-[var(--g)]'
                                  : 'bg-[var(--surface-2)] border-transparent hover:border-[var(--line)]'
                              }`}
                            >
                              <div className="font-bold text-[11px] truncate">{tier.label}</div>
                              <div className="text-[10px] text-[var(--mut)] tabular mt-0.5">
                                เปล่า {tier.blankJerseyBaht}฿ · สกรีน {tier.printedJerseyBaht}฿
                              </div>
                              <div className="text-[9.5px] text-[var(--g)] font-semibold tabular mt-0.5">
                                ต้นทุน {(tier.costRate * 100).toFixed(0)}%
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Souvenirs Sales Breakdown */}
                  <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-sm mland:text-xs">
                        🎁 ของชำร่วยสโมสร ({merchPeriod === 'alltime' ? 'รวมตลอดกาล' : `ซีซั่น ${state.season}`})
                      </h3>
                      <span className="text-xs font-bold text-[var(--g)] tabular">
                        {activeSouvUnits.toLocaleString()} ชิ้น · {fmtMoney(activeSouvRev)}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {activeSouvRows.map((sku) => {
                        const pct = Math.max(4, Math.round((sku.revenue / maxSouvRev) * 100));
                        return (
                          <div key={sku.id} className="p-2 rounded-xl bg-[var(--surface-2)] space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold truncate">
                                {sku.icon} {sku.name}{' '}
                                <span className="text-[10px] text-[var(--mut)] font-normal tabular">({sku.unitPriceBaht}฿)</span>
                              </span>
                              <span className="tabular shrink-0 font-bold">
                                {sku.units.toLocaleString()} ชิ้น · <span className="text-[var(--g)]">{fmtMoney(sku.revenue)}</span>
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${sku.units > 0 ? pct : 0}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Blank vs Printed Jerseys + Per-Player Rankings + Season Champions */}
                <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <h3 className="font-bold text-sm mland:text-xs">👕 ยอดขายเสื้อแข่ง &amp; แชมป์ขายเสื้อ</h3>
                    <div className="seg-bar shrink-0">
                      {(
                        [
                          ['season', `ซ.${state.season}`],
                          ['alltime', 'รวมทุกซีซั่น'],
                          ['seasons', `แชมป์รายซีซั่น (${combinedSeasons.length})`]
                        ] as const
                      ).map(([pid, plbl]) => (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => setMerchPeriod(pid)}
                          className={`seg-btn whitespace-nowrap ${merchPeriod === pid ? 'seg-btn-active' : ''}`}
                        >
                          {plbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {merchPeriod !== 'seasons' ? (
                    <>
                      {/* 3 Comparison KPIs: Unprinted vs Printed Total vs Grand Jersey Total */}
                      <div className="grid grid-cols-3 gap-2 text-center shrink-0">
                        <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                          <div className="text-[10px] text-[var(--mut)]">เสื้อไม่สกรีนเบอร์/ชื่อ</div>
                          <div className="font-bold text-xs tabular mt-0.5">{activeBlankUnits.toLocaleString()} ตัว</div>
                          <div className="text-[10.5px] font-bold text-[var(--g)] tabular">{fmtMoney(activeBlankRev)}</div>
                        </div>
                        <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                          <div className="text-[10px] text-[var(--mut)]">เสื้อสกรีนนักเตะรวม</div>
                          <div className="font-bold text-xs tabular mt-0.5">{activePrintedUnits.toLocaleString()} ตัว</div>
                          <div className="text-[10.5px] font-bold text-[var(--g)] tabular">{fmtMoney(activePrintedRev)}</div>
                        </div>
                        <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                          <div className="text-[10px] text-[var(--mut)]">รวมเสื้อทุกแบบ</div>
                          <div className="font-bold text-xs tabular mt-0.5">
                            {(activeBlankUnits + activePrintedUnits).toLocaleString()} ตัว
                          </div>
                          <div className="text-[10.5px] font-bold text-[var(--g)] tabular">
                            {fmtMoney(activeBlankRev + activePrintedRev)}
                          </div>
                        </div>
                      </div>

                      {/* #1 Best Selling Player Spotlight */}
                      <div className="p-2.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/45 flex items-center justify-between gap-2.5 shrink-0">
                        {topSeller ? (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <KitJersey
                                club={ensureClubIdentity(state)}
                                team={me}
                                shirtNo={topSeller.no}
                                isGK={topSeller.pos === 'GK'}
                                size={36}
                              />
                              {topSellerPlayer && <PlayerFace player={topSellerPlayer} team={me} state={state} size={34} />}
                              <div className="min-w-0">
                                <div className="text-[10px] font-bold text-[var(--g)]">
                                  🏆 ขายเสื้ออันดับ 1 {merchPeriod === 'alltime' ? 'ตลอดกาล' : `ซีซั่น ${state.season}`}
                                </div>
                                <div className="font-bold text-xs sm:text-sm truncate">
                                  #{topSeller.no} {topSeller.name}
                                </div>
                                <div className="text-[10.5px] text-[var(--mut)] tabular">
                                  {topSeller.ro} ({topSeller.pos}) · ครองส่วนแบ่ง {activePrintedUnits > 0 ? Math.round((topSeller.units / activePrintedUnits) * 100) : 0}%
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 tabular">
                              <div className="font-extrabold text-sm text-[var(--ink)]">{topSeller.units.toLocaleString()} ตัว</div>
                              <div className="font-bold text-xs text-[var(--g)]">{fmtMoney(topSeller.revenue)}</div>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-[var(--mut)] w-full text-center py-1">
                            ยังไม่มีสถิติยอดขายเสื้อในซีซั่นนี้ — ยอดขายเสื้อรายเบอร์จะบันทึกหลังจบเกมเหย้าแรก
                          </div>
                        )}
                      </div>

                      {/* Per-Player Printed Shirt Leaderboard */}
                      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
                        {activePrintedRows.length === 0 ? (
                          <div className="text-xs text-[var(--mut)] text-center py-8">ยังไม่มีข้อมูลการขายเสื้อนักเตะรายบุคคล</div>
                        ) : (
                          activePrintedRows.map((row, idx) => {
                            const squadPl = me.sq.find((p) => p.n === row.name) || null;
                            const sharePct = activePrintedUnits > 0 ? Math.round((row.units / activePrintedUnits) * 100) : 0;
                            const barPct = Math.max(4, Math.round((row.units / maxJerseyUnits) * 100));
                            return (
                              <button
                                key={`${row.name}-${row.no}`}
                                type="button"
                                disabled={!squadPl || !onInspectPlayer}
                                onClick={() => {
                                  if (squadPl && onInspectPlayer) onInspectPlayer(squadPl, me);
                                }}
                                className={`w-full p-2 rounded-xl bg-[var(--surface-2)] text-left flex items-center gap-2.5 transition-colors ${
                                  squadPl && onInspectPlayer ? 'hover:bg-[var(--surface-2)]/70 cursor-pointer' : 'cursor-default'
                                }`}
                              >
                                <span className={`w-5 text-center font-extrabold text-xs tabular shrink-0 ${idx === 0 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                                  {idx + 1}
                                </span>
                                {squadPl && (
                                  <div className="shrink-0 [&>svg]:w-6 [&>svg]:h-6">
                                    <PlayerFace player={squadPl} team={me} state={state} club={state.club} isMyClub size={24} />
                                  </div>
                                )}
                                <span
                                  className="w-7 h-7 rounded-lg font-extrabold text-[11px] flex items-center justify-center tabular shrink-0 border border-[var(--line)]/60"
                                  style={{ background: me.kc[0], color: me.kc[1] }}
                                >
                                  {squadPl ? getShirtNo(me, squadPl) : row.no}
                                </span>
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-bold truncate">
                                      {row.name} <span className="text-[10px] font-medium text-[var(--mut)]">· {row.ro}</span>
                                    </span>
                                    <span className="tabular shrink-0 font-bold">
                                      {row.units.toLocaleString()} ตัว{' '}
                                      <span className="text-[var(--mut)] font-normal text-[10.5px]">({sharePct}%)</span>
                                    </span>
                                  </div>
                                  <div className="h-1 rounded-full bg-[var(--surface)] overflow-hidden">
                                    <div className="h-full rounded-full bg-[var(--g)]" style={{ width: `${barPct}%` }} />
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-[var(--g)] tabular shrink-0">
                                  {fmtMoney(row.revenue)}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  ) : (
                    /* Season-by-Season Jersey Champion & Merch History */
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
                      {combinedSeasons.map((arch) => (
                        <div key={arch.season} className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]/70 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-xs sm:text-sm">
                              ซีซั่น {arch.season} {arch.season === state.season ? '· กำลังดำเนินอยู่' : ''}
                            </span>
                            <div className="text-[11px] tabular flex items-center gap-2">
                              <span className="text-[var(--mut)]">ยอดขาย {fmtMoney(arch.totalRevenue)}</span>
                              <span className="text-[var(--red)]">ต้นทุน -{fmtMoney(arch.productionCost)}</span>
                              <b className={arch.netProfit >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
                                สุทธิ {arch.netProfit >= 0 ? `+${fmtMoney(arch.netProfit)}` : fmtMoney(arch.netProfit)}
                              </b>
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-[var(--surface)] flex items-center justify-between gap-2 text-xs">
                            <span className="truncate">
                              🏆 แชมป์ขายเสื้อ:{' '}
                              {arch.topPlayer ? (
                                <b>#{arch.topPlayer.no} {arch.topPlayer.name}</b>
                              ) : (
                                <span className="text-[var(--mut)]">ยังไม่มียอดขาย</span>
                              )}
                            </span>
                            {arch.topPlayer && (
                              <b className="text-[var(--g)] tabular shrink-0">
                                {arch.topPlayer.units.toLocaleString()} ตัว · {fmtMoney(arch.topPlayer.revenue)}
                              </b>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 text-[10.5px] text-center tabular">
                            <div className="p-1.5 rounded-lg bg-[var(--surface)]">
                              <div className="text-[var(--mut)]">สกรีนนักเตะ</div>
                              <b>{arch.printedJerseysTotal.units.toLocaleString()} ตัว</b> · {fmtMoney(arch.printedJerseysTotal.revenue)}
                            </div>
                            <div className="p-1.5 rounded-lg bg-[var(--surface)]">
                              <div className="text-[var(--mut)]">เสื้อไม่สกรีน</div>
                              <b>{arch.blankJerseys.units.toLocaleString()} ตัว</b> · {fmtMoney(arch.blankJerseys.revenue)}
                            </div>
                            <div className="p-1.5 rounded-lg bg-[var(--surface)]">
                              <div className="text-[var(--mut)]">ของชำร่วย</div>
                              <b>{arch.souvenirsTotal.units.toLocaleString()} ชิ้น</b> · {fmtMoney(arch.souvenirsTotal.revenue)}
                            </div>
                          </div>

                          {arch.playerJerseys.length > 1 && (
                            <div className="text-[10.5px] text-[var(--mut)] flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
                              {arch.playerJerseys.slice(0, 3).map((pj, rank) => (
                                <span key={`${pj.name}-${pj.no}`} className="tabular">
                                  {rank + 1}. #{pj.no} {pj.name} ({pj.units} ตัว)
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Bank Loans, Wage Structure & Filterable Ledger */}
        {finTab === 'ledger' && (
          <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
            <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-0.5">
              <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
                <h3 className="font-bold text-sm">🏦 ธนาคาร &amp; จัดการหนี้สิน</h3>
                {state.bankLoan ? (
                  <div className="p-3.5 rounded-xl bg-[var(--surface-2)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>เงินกู้ธนาคารคงค้าง</span>
                      <span className="text-[var(--red)] tabular">{fmtMoney(bankRemain)} ({state.bankLoan.left} งวด)</span>
                    </div>
                    <div className="text-[11px] text-[var(--mut)] tabular">ผ่อนชำระงวดละ {fmtMoney(state.bankLoan.per)} ทุกแมตช์</div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={state.money < state.bankLoan.per}
                        onClick={() => {
                          const per = state.bankLoan!.per;
                          onUpdateState((d) => {
                            if (!d.bankLoan) return;
                            d.money -= per;
                            d.bankLoan.left--;
                            logFin(d, 'ชำระล่วงหน้าเงินกู้ 1 งวด', -per);
                            if (d.bankLoan.left <= 0) d.bankLoan = null;
                          });
                          onToast('ชำระเงินกู้ล่วงหน้า 1 งวดแล้ว');
                        }}
                        className="btn btn-sm btn-surface"
                      >
                        จ่าย 1 งวด ({fmtMoneyNum(state.bankLoan.per)})
                      </button>
                      <button
                        type="button"
                        disabled={state.money < bankRemain}
                        onClick={() => {
                          onUpdateState((d) => {
                            d.money -= bankRemain;
                            logFin(d, 'โปะปิดเงินกู้ธนาคาร', -bankRemain);
                            d.bankLoan = null;
                          });
                          onToast('ปิดยอดหนี้ธนาคารทั้งหมดแล้ว');
                        }}
                        className="btn btn-sm btn-primary"
                      >
                        โปะปิดทั้งหมด ({fmtMoneyNum(bankRemain)})
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {loanPackages.map((lp) => (
                      <div key={lp.id} className="p-3 rounded-xl bg-[var(--surface-2)] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-xs">{lp.title} (+{fmtMoney(lp.amount)})</div>
                          <div className="text-[11px] text-[var(--mut)] tabular">ผ่อน {fmtMoneyNum(lp.per)} × {lp.left} นัด · {lp.desc}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              d.money += lp.amount;
                              d.bankLoan = { left: lp.left, per: lp.per };
                              logFin(d, `กู้${lp.title}`, lp.amount);
                            });
                            onToast(`รับเงินกู้ +${fmtMoney(lp.amount)} เข้าคลังสโมสรแล้ว`);
                          }}
                          className="btn btn-sm btn-gold shrink-0"
                        >
                          กู้ +{fmtMoneyNum(lp.amount)}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(state.payDue || 0) > 0 && (
                  <div className="p-3 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/40 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-bold">ค้างผ่อนค่าตัวนักเตะปลายปี</div>
                      <div className="text-[11px] text-[var(--mut)] tabular">ยอดคงเหลือ {fmtMoney(state.payDue || 0)} (หักอัตโนมัติเมื่อจบซีซั่น)</div>
                    </div>
                    <button
                      type="button"
                      disabled={state.money < (state.payDue || 0)}
                      onClick={() => {
                        const amt = state.payDue || 0;
                        onUpdateState((d) => {
                          d.money -= amt;
                          d.payDue = 0;
                          logFin(d, 'ชำระยอดผ่อนค่าตัวล่วงหน้า', -amt);
                        });
                        onToast('ชำระยอดค้างผ่อนค่าตัวครบแล้ว');
                      }}
                      className="btn btn-sm btn-surface shrink-0"
                    >
                      ปิดยอด {fmtMoneyNum(state.payDue || 0)}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                <h3 className="font-bold text-sm">📊 โครงสร้างค่าเหนื่อยรายตำแหน่ง</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(['GK', 'DF', 'MF', 'FW'] as Position[]).map((pos) => (
                    <div key={pos} className="p-2 rounded-xl bg-[var(--surface-2)]">
                      <div className="text-[10px] font-bold text-[var(--mut)]">{pos}</div>
                      <div className="font-bold text-xs tabular mt-0.5">{fmtMoneyNum(posWageMap[pos])}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-1 space-y-1">
                  <div className="text-[11px] font-bold text-[var(--mut)]">นักเตะค่าเหนื่อยสูงสุด 3 อันดับ</div>
                  {topEarners.map((q) => (
                    <div key={q.n} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-[var(--line)]/50 last:border-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="shrink-0 [&>svg]:w-5 [&>svg]:h-5">
                          <PlayerFace player={q} team={me} state={state} club={state.club} isMyClub size={22} />
                        </div>
                        <span className="truncate">{q.ro} · {q.n}</span>
                      </div>
                      <b className="tabular text-[var(--mut)] shrink-0">{fmtMoneyNum(wagOf(q))}/นัด</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 h-full flex flex-col min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <h3 className="font-bold text-sm mland:text-xs">📒 สมุดบัญชีรายรับ-รายจ่าย</h3>
                <div className="seg-bar shrink-0">
                  {([['all', 'ทั้งหมด'], ['in', 'รายรับ'], ['out', 'รายจ่าย']] as const).map(([fId, fLbl]) => (
                    <button
                      key={fId}
                      type="button"
                      onClick={() => setLedgerFilter(fId)}
                      className={`seg-btn ${ledgerFilter === fId ? 'seg-btn-active' : ''}`}
                    >
                      {fLbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mland:gap-1.5 text-center text-xs shrink-0">
                <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">รายรับ (บันทึก)</div>
                  <div className="font-bold text-[var(--g)] tabular">+{fmtMoneyNum(totalLogIn)}</div>
                </div>
                <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">รายจ่าย (บันทึก)</div>
                  <div className="font-bold text-[var(--red)] tabular">-{fmtMoneyNum(totalLogOut)}</div>
                </div>
                <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">ดุลสุทธิ</div>
                  <div className={`font-bold tabular ${totalLogIn - totalLogOut >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                    {totalLogIn - totalLogOut >= 0 ? `+${fmtMoneyNum(totalLogIn - totalLogOut)}` : fmtMoneyNum(totalLogIn - totalLogOut)}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
                {filteredEntries.length === 0 ? (
                  <div className="text-xs text-[var(--mut)] py-8 text-center">ยังไม่มีรายการบัญชีในหมวดนี้</div>
                ) : (
                  filteredEntries.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[var(--line)]/50 last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.t}</div>
                        <div className="text-[10px] text-[var(--mut)] tabular">ซีซั่น {e.s} · นัดที่ {e.m}</div>
                      </div>
                      <b className={`tabular shrink-0 ${e.amt >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                        {e.amt >= 0 ? `+${fmtMoneyNum(e.amt)}` : fmtMoneyNum(e.amt)}
                      </b>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Club Identity, Board, Facilities & Legacy View (tab === 'u')
  const k = ensureClubIdentity(state);
  const ts = memoizedClubStats || teamStats(me, state);
  const bd = clamp(state.bd ?? 50, 0, 100);
  const rep = state.mgrRep ?? 50;
  const repRank =
    rep >= 180 ? 'ตำนานลูกหนังไทย' : rep >= 130 ? 'ยอดกุนซือระดับทวีป' : rep >= 90 ? 'กุนซือมือทอง' : rep >= 65 ? 'โค้ชฝีมือดี' : 'กุนซือหน้าใหม่';
  const tierTbl = memoizedTierTbl;
  const curRank = Math.max(1, tierTbl.findIndex((t) => t.id === me.id) + 1);
  const targetRank = state.obj || 8;
  const cap = est.cap;
  const totV = me.sq.reduce((a, q) => a + Math.round((q.ov * q.ov) / 40), 0);
  const avgAge = (me.sq.reduce((a, q) => a + q.age, 0) / Math.max(1, me.sq.length)).toFixed(1);
  const bs = me.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0))[0];
  const ba = me.sq.slice().sort((a, b) => (b.sa || 0) - (a.sa || 0))[0];
  const bm = me.sq.slice().sort((a, b) => (b.ap || 0) - (a.ap || 0))[0];
  const topO = me.sq.slice().sort((a, b) => b.ov - a.ov)[0];
  const curTurn = state.season * 40 + state.md;
  const actCool = state.clubActMd != null && curTurn - state.clubActMd < 3;
  const remCd = state.clubActMd != null ? Math.max(0, 3 - (curTurn - state.clubActMd)) : 0;

  const clubPresets: { label: string; c1: string; c2: string; c3?: string }[] = [
    { label: 'แดง-ทอง', c1: '#c0392b', c2: '#f4c63d', c3: '#ffffff' },
    { label: 'น้ำเงิน-ขาว', c1: '#2f6fd6', c2: '#ffffff', c3: '#f4c63d' },
    { label: 'เขียว-ขาว', c1: '#1c7a4a', c2: '#ffffff', c3: '#f4c63d' },
    { label: 'กรมท่า-ทอง', c1: '#1b263b', c2: '#f4c63d', c3: '#0ea5e9' },
    { label: 'ส้ม-ดำ', c1: '#e67e22', c2: '#111111', c3: '#ffffff' },
    { label: 'ม่วง-ทอง', c1: '#7c3aed', c2: '#f4c63d', c3: '#ffffff' },
    { label: 'ฟ้า-ขาว', c1: '#0ea5e9', c2: '#ffffff', c3: '#1b263b' },
    { label: 'ชมพู-กรมท่า', c1: '#d6336c', c2: '#1b263b', c3: '#ffffff' },
    { label: 'เลือดหมู-ฟ้า', c1: '#881337', c2: '#0ea5e9', c3: '#f4c63d' },
    { label: 'เหลือง-ดำ', c1: '#facc15', c2: '#111111', c3: '#ffffff' }
  ];

  const dk: ClubIdentity = clubTab === 'identity' && identityDraft ? identityDraft : k;
  const hasIdentityChanges =
    clubTab === 'identity' &&
    identityDraft != null &&
    (identityDraft.c1 !== k.c1 ||
      identityDraft.c2 !== k.c2 ||
      (identityDraft.c3 || '') !== (k.c3 || '') ||
      identityDraft.shape !== k.shape ||
      identityDraft.pat !== k.pat ||
      (identityDraft.crestBorder ?? 0) !== (k.crestBorder ?? 0) ||
      (identityDraft.stars ?? 0) !== (k.stars ?? 0) ||
      identityDraft.icon !== k.icon ||
      (identityDraft.iconColor || '') !== (k.iconColor || '') ||
      (identityDraft.kit || 0) !== (k.kit || 0) ||
      identityDraft.awayKit !== k.awayKit ||
      (identityDraft.collar ?? 0) !== (k.collar ?? 0) ||
      (identityDraft.cuffTrim ?? true) !== (k.cuffTrim ?? true));

  const patchIdentityDraft = (fn: (draft: ClubIdentity) => void) => {
    SFX.tap();
    setIdentityDraft((prev) => {
      const next: ClubIdentity = { ...(prev || k) };
      fn(next);
      return next;
    });
  };

  const saveIdentityDraft = () => {
    if (!identityDraft) return;
    SFX.tap();
    onUpdateState((d) => {
      const cl = ensureClubIdentity(d);
      cl.c1 = identityDraft.c1;
      cl.c2 = identityDraft.c2;
      cl.c3 = identityDraft.c3;
      cl.shape = identityDraft.shape;
      cl.pat = identityDraft.pat;
      cl.crestBorder = identityDraft.crestBorder;
      cl.stars = identityDraft.stars;
      cl.icon = identityDraft.icon;
      cl.iconColor = identityDraft.iconColor;
      cl.kit = identityDraft.kit;
      cl.awayKit = identityDraft.awayKit;
      cl.collar = identityDraft.collar;
      cl.cuffTrim = identityDraft.cuffTrim;
      d.teams[d.me].kc = [identityDraft.c1, identityDraft.c2];
    });
    onToast('บันทึกตราและชุดแข่งสโมสรเรียบร้อยแล้ว!');
  };

  const resetIdentityDraft = () => {
    SFX.tap();
    setIdentityDraft({ ...k });
    onToast('คืนค่าตราและชุดแข่งเดิมแล้ว');
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Sleek Single-Row Club Identity Strip (zero duplication with Top HUD Board% & Fans) */}
      <div
        className={`relative px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl border shrink-0 overflow-hidden ${
          clubTab === 'identity' ? 'border-[var(--g)]/40 shadow-sm' : 'border-[var(--line)]'
        }`}
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${dk.c1} 13%, var(--surface)), var(--surface) 56%, color-mix(in srgb, ${dk.c2} 7%, var(--surface)))`
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px]"
          style={{ background: `linear-gradient(90deg, ${dk.c1}, ${dk.c2})` }}
        />
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 mland:gap-2 text-left min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 mland:gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 mland:px-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/75 shrink-0">
            <div className="shrink-0 [&>svg]:w-11 [&>svg]:h-11 sm:[&>svg]:w-13 sm:[&>svg]:h-13 mland:[&>svg]:w-10 mland:[&>svg]:h-10 flex items-center justify-center">
              <ClubCrest name={me.name} size={52} team={me} club={dk} isMyClub />
            </div>
            <div className="w-px h-9 sm:h-10 mland:h-8 bg-[var(--line)]/75" aria-hidden="true" />
            {clubTab === 'identity' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIdentityMobilePane('kit');
                    setKitPatternTarget('home');
                    setKitColorTarget('c1');
                  }}
                  title="คลิกเพื่อแก้ไขชุดเหย้า"
                  className={`shrink-0 flex flex-col items-center px-1 py-0.5 rounded-lg cursor-pointer transition-colors ${
                    kitPatternTarget === 'home' ? 'bg-[var(--g-soft)] ring-1 ring-[var(--g)]/60' : 'hover:bg-[var(--surface-2)]/60'
                  }`}
                >
                  <div className="[&>svg]:w-10 [&>svg]:h-10 sm:[&>svg]:w-11 sm:[&>svg]:h-11 mland:[&>svg]:w-9 mland:[&>svg]:h-9 flex items-center justify-center">
                    <KitJersey club={dk} away={false} size={44} />
                  </div>
                  <span className={`text-[8.5px] mland:text-[7.5px] font-bold leading-none mt-0.5 ${kitPatternTarget === 'home' ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                    เหย้า
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdentityMobilePane('kit');
                    setKitPatternTarget('away');
                    setKitColorTarget('c2');
                  }}
                  title="คลิกเพื่อแก้ไขชุดเยือน"
                  className={`shrink-0 flex flex-col items-center px-1 py-0.5 rounded-lg cursor-pointer transition-colors ${
                    kitPatternTarget === 'away' ? 'bg-[var(--g-soft)] ring-1 ring-[var(--g)]/60' : 'hover:bg-[var(--surface-2)]/60'
                  }`}
                >
                  <div className="[&>svg]:w-10 [&>svg]:h-10 sm:[&>svg]:w-11 sm:[&>svg]:h-11 mland:[&>svg]:w-9 mland:[&>svg]:h-9 flex items-center justify-center">
                    <KitJersey club={dk} away={true} size={44} />
                  </div>
                  <span className={`text-[8.5px] mland:text-[7.5px] font-bold leading-none mt-0.5 ${kitPatternTarget === 'away' ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                    เยือน
                  </span>
                </button>
              </>
            ) : (
              <>
                <div className="shrink-0 [&>svg]:w-10 [&>svg]:h-10 sm:[&>svg]:w-12 sm:[&>svg]:h-12 mland:[&>svg]:w-9 mland:[&>svg]:h-9 flex items-center justify-center">
                  <KitJersey club={dk} away={false} size={48} />
                </div>
                <div className="shrink-0 [&>svg]:w-10 [&>svg]:h-10 sm:[&>svg]:w-12 sm:[&>svg]:h-12 mland:[&>svg]:w-9 mland:[&>svg]:h-9 flex items-center justify-center">
                  <KitJersey club={dk} away={true} size={48} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0 text-[10px] mland:text-[8.5px] font-bold leading-tight">
              {clubTab === 'identity' ? (
                <span className={hasIdentityChanges ? 'text-[#b47b00] dark:text-[var(--lamp)]' : 'text-[var(--g)]'}>
                  {hasIdentityChanges
                    ? 'ตัวอย่างตรา & ชุดแข่ง (มีรายการแก้ไขที่ยังไม่บันทึก)'
                    : 'ตัวอย่างตรา & ชุดแข่งแบบเรียลไทม์'}
                </span>
              ) : (
                <>
                  <span className="text-[var(--g)] shrink-0">{TN[me.tier]} · ก่อตั้ง พ.ศ. {k.founded || 2568}</span>
                  {k.motto && (
                    <span className="hidden sm:inline text-[var(--mut)] font-medium italic truncate">
                      · &ldquo;{k.motto}&rdquo;
                    </span>
                  )}
                </>
              )}
            </div>

            <h2 className="font-bold text-sm sm:text-lg mland:text-sm font-display leading-snug text-[var(--ink)] truncate">
              {me.name}
              {k.nick ? (
                <span className="ml-1.5 text-[11px] sm:text-xs mland:text-[10px] font-semibold text-[var(--mut)] whitespace-nowrap">«{k.nick}»</span>
              ) : null}
            </h2>

            {clubTab === 'identity' ? (
              <p className="text-[10.5px] mland:text-[9px] text-[var(--mut)] leading-tight truncate">
                ตรา: <b className="text-[var(--ink)]">{CREST_SHAPES[dk.shape]?.label || 'โล่คลาสสิก'}</b> ·{' '}
                <b className="text-[var(--ink)]">{CREST_PATTERNS[dk.pat] || 'แถบขวาง'}</b> · เสื้อ:{' '}
                <b className="text-[var(--ink)]">{KIT_PATTERNS[dk.kit || 0]}</b> / เยือน{' '}
                <b className="text-[var(--ink)]">{KIT_PATTERNS[(dk.awayKit ?? dk.kit) || 0]}</b>
              </p>
            ) : (
              <p className="text-[10.5px] mland:text-[9px] text-[var(--mut)] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-tight truncate">
                <span>🏟️ {k.std} (จุ {cap.toLocaleString()} · Lv.{state.st ?? 1})</span>
                <span aria-hidden="true" className="opacity-45">·</span>
                <span className="font-semibold text-[var(--ink)]">
                  👔 {k.managerName || 'หัวหน้าผู้ฝึกสอน'}
                </span>
              </p>
            )}
          </div>

          {clubTab === 'identity' ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => {
                  const kp = P(KIT_P);
                  const icons = Object.keys(CREST_IC);
                  patchIdentityDraft((cl) => {
                    cl.c1 = kp[0];
                    cl.c2 = kp[1];
                    cl.c3 = P(['', '#f4c63d', '#ffffff', '#0ea5e9', '#111111']);
                    cl.shape = R(0, CREST_SHAPES.length - 1);
                    cl.pat = R(0, CREST_PATTERNS.length - 1);
                    cl.crestBorder = R(0, 3);
                    cl.kit = R(0, KIT_PATTERNS.length - 1);
                    const rndPairs = AWAY_KIT_PAIRINGS[cl.kit] || [0];
                    cl.awayKit = Math.random() < 0.45 ? undefined : P([...rndPairs]);
                    cl.collar = R(0, KIT_COLLARS.length - 1);
                    cl.cuffTrim = Math.random() < 0.75;
                    cl.icon = P(icons);
                    cl.iconColor = '';
                  });
                }}
                className="btn btn-xs sm:btn-sm btn-gold whitespace-nowrap shrink-0"
              >
                <Dices className="w-3.5 h-3.5" />
                <span>สุ่มดีไซน์</span>
              </button>
              {hasIdentityChanges && (
                <button
                  type="button"
                  onClick={resetIdentityDraft}
                  className="btn btn-xs sm:btn-sm btn-secondary whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>คืนค่าเดิม</span>
                </button>
              )}
              <button
                type="button"
                disabled={!hasIdentityChanges}
                onClick={saveIdentityDraft}
                className="btn btn-xs sm:btn-sm btn-primary whitespace-nowrap shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{hasIdentityChanges ? 'บันทึก' : 'บันทึกแล้ว'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 divide-x divide-[var(--line)]/65 rounded-xl mland:rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/70 shrink-0 w-full sm:w-auto mland:w-auto text-center">
              <div className="px-2.5 sm:px-3 py-1 mland:py-0.5">
                <div className="text-[9px] mland:text-[8px] text-[var(--mut)] whitespace-nowrap">พลัง XI/ทีม</div>
                <div className="text-[11px] sm:text-xs mland:text-[10px] font-extrabold tabular text-[var(--ink)]">
                  {ts.ovXi}/{ts.ovSq}
                </div>
              </div>
              <div className="px-2.5 sm:px-3 py-1 mland:py-0.5">
                <div className="text-[9px] mland:text-[8px] text-[var(--mut)] whitespace-nowrap">มูลค่าทีม</div>
                <div className="text-[11px] sm:text-xs mland:text-[10px] font-extrabold tabular text-[var(--ink)]">
                  {fmtMoneyNum(totV)}
                </div>
              </div>
              <div className="px-2.5 sm:px-3 py-1 mland:py-0.5">
                <div className="text-[9px] mland:text-[8px] text-[var(--mut)] whitespace-nowrap">อันดับ / เป้า</div>
                <div className={`text-[11px] sm:text-xs mland:text-[10px] font-extrabold tabular ${curRank <= targetRank ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                  #{curRank}<span className="text-[9.5px] font-semibold text-[var(--mut)]">/{targetRank}+</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Club HQ Sub-navigation (5 Tabs) */}
      <div className="seg-bar grid grid-cols-5 w-full bg-[var(--surface)] shrink-0">
        {(
          [
            ['info', '🏛️ ข้อมูล & บอร์ด'],
            ['infra', '🏗️ สนาม & ทีมงาน'],
            ['identity', '🎨 ตรา & ชุดแข่ง'],
            ['activities', '🤝 กิจกรรม'],
            ['legacy', '🏆 ประวัติ & ถ้วย']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setClubTab(id)}
            className={`seg-btn truncate ${
              clubTab === id ? 'seg-btn-active' : 'hover:bg-[var(--surface-2)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Club Tab 1: Basic Info + Board Confidence & Dressing Room */}
      {clubTab === 'info' && (() => {
        const coachVis = k.managerVis && k.managerVis.length >= 8 ? k.managerVis : getDefaultCoachVis(k.managerName || k.name || 'coach');
        const curOutfit = (k.managerOutfit || 'suit_navy') as CoachOutfitId;
        const capPlayer = me.sq.find((q) => q.n === me.cap) || topO;

        const openClubEdit = (focusField: 'name' | 'nick' | 'std' | 'managerName' | 'motto' | 'founded' = 'name') => {
          SFX.tap();
          const curName = k.name || me.name || '';
          const curStd = k.std || '';
          const synced = !curStd.trim() || curStd.trim() === `สนาม${curName.trim()}`;
          setAutoSyncStadium(synced);
          setClubDraft({
            name: curName,
            nick: k.nick || '',
            std: synced ? (curName.trim() ? `สนาม${curName.trim()}` : '') : curStd,
            managerName: k.managerName || '',
            motto: k.motto || '',
            founded: String(k.founded || 2568)
          });
          setClubEditFocusField(focusField);
          setEditingClubInfo(true);
        };

        const cancelClubEdit = () => {
          SFX.tap();
          setEditingClubInfo(false);
        };

        const saveClubEdit = () => {
          const clean = (s: string) => s.replace(/["'<>`]/g, '').trim();
          const nextName = clean(clubDraft.name) || 'ทีมของฉัน';
          const nextNick = clean(clubDraft.nick);
          const nextStd = autoSyncStadium ? `สนาม${nextName}` : (clean(clubDraft.std) || `สนาม${nextName}`);
          const nextMgr = clean(clubDraft.managerName);
          const nextMotto = clean(clubDraft.motto);
          const parsedYear = parseInt(clubDraft.founded.replace(/\D/g, ''), 10);
          const nextFounded = Number.isFinite(parsedYear) ? clamp(parsedYear, 2450, 2600) : 2568;

          SFX.tap();
          onUpdateState((d) => {
            const cl = ensureClubIdentity(d);
            cl.name = nextName;
            cl.nick = nextNick;
            cl.std = nextStd;
            cl.managerName = nextMgr;
            cl.motto = nextMotto;
            cl.founded = nextFounded;
            d.teams[d.me].name = nextName;
          });
          setEditingClubInfo(false);
          onToast('บันทึกข้อมูลสโมสรแล้ว');
        };

        const savedCoachStyle = (k.managerStyle || 'balanced') as CoachStyleId;
        const savedRandomOutfit = Boolean(k.managerRandomOutfitPerMatch);
        const displayCoachVis = coachVis;
        const displayCoachStyleId = savedCoachStyle;
        const displayCoachOutfitId = curOutfit;
        const displayRandomOutfit = savedRandomOutfit;
        const displayCoachStyle = COACH_STYLES.find((s) => s.id === displayCoachStyleId) || COACH_STYLES[0];
        const displayCoachOutfit = COACH_OUTFITS.find((o) => o.id === displayCoachOutfitId) || COACH_OUTFITS[0];

        const randomizeInlineCoachOutfit = () => {
          SFX.tap();
          const pool = COACH_OUTFITS.filter((o) => o.id !== displayCoachOutfitId);
          const src = pool.length ? pool : COACH_OUTFITS;
          const pick = src[R(0, src.length - 1)];
          if (!pick) return;
          onUpdateState((d) => {
            const cl = ensureClubIdentity(d);
            cl.managerOutfit = pick.id;
          });
          onToast(`เปลี่ยนชุดโค้ชเป็น "${pick.name}" แล้ว`);
        };

        const toggleInlineRandomOutfit = () => {
          SFX.tap();
          const nextRandom = !displayRandomOutfit;
          onUpdateState((d) => {
            const cl = ensureClubIdentity(d);
            cl.managerRandomOutfitPerMatch = nextRandom;
          });
          onToast(
            nextRandom
              ? 'เปิดสุ่มชุดโค้ชอัตโนมัติทุกนัดแล้ว!'
              : 'ปิดสุ่มชุดโค้ชอัตโนมัติแล้ว'
          );
        };

        const selectInlineCoachStyle = (styleId: CoachStyleId) => {
          SFX.tap();
          const styleInfo = COACH_STYLES.find((s) => s.id === styleId);
          onUpdateState((d) => {
            const cl = ensureClubIdentity(d);
            cl.managerStyle = styleId;
          });
          if (styleInfo) {
            onToast(`เลือกแนวทาง "${styleInfo.name}" แล้ว`);
          }
        };

        const coachFacePlayer: Player = {
          n: k.managerName || 'หัวหน้าผู้ฝึกสอน',
          pos: 'MF',
          ro: 'CM',
          ov: 75,
          age: 38,
          pot: 75,
          fit: 100,
          inj: 0,
          vis: displayCoachVis
        };

        const bdStatusText = bd < 30 ? 'วิกฤติ' : bd < 55 ? 'ต้องเร่งผลงาน' : bd >= 75 ? 'เชื่อมั่นสูง' : 'มั่นคง';
        const bdStatusCls =
          bd < 30
            ? 'text-[var(--red)]'
            : bd < 55
              ? 'text-[#9a6700] dark:text-[var(--lamp)]'
              : 'text-[var(--g)]';

        const morVal = clamp(state.mor ?? 55, 0, 100);
        const tacFamVal = clamp(me.tacFam ?? 65, 0, 100);
        const avgFit = Math.round(me.sq.reduce((a, q) => a + clamp(q.fit ?? 100, 0, 100), 0) / Math.max(1, me.sq.length));
        const injCount = me.sq.filter((q) => q.inj > 0).length;
        const susCount = me.sq.filter((q) => (q.sus || 0) > 0).length;
        const readyCount = Math.max(0, me.sq.length - me.sq.filter((q) => q.inj > 0 || (q.sus || 0) > 0).length);
        const morCls = morVal >= 70 ? 'text-[var(--g)]' : morVal < 45 ? 'text-[var(--red)]' : 'text-[var(--ink)]';
        const tacCls = tacFamVal >= 75 ? 'text-[var(--g)]' : tacFamVal < 50 ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--ink)]';
        const fitCls = avgFit >= 80 ? 'text-[var(--g)]' : avgFit < 65 ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--ink)]';
        const moodLabel =
          morVal >= 75 ? 'ห้องแต่งตัวคึกคัก' : morVal >= 55 ? 'สปิริตมั่นคง' : morVal >= 40 ? 'บรรยากาศทรงตัว' : 'ต้องปลุกใจทีม';
        const moodCls =
          morVal >= 75 ? 'text-[var(--g)]' : morVal < 40 ? 'text-[var(--red)]' : 'text-[var(--mut)]';

        const coreLeaders: Array<{
          key: string;
          roleLabel: string;
          player: Player | undefined;
          metricText: string;
          metricAccent?: boolean;
          isCaptain?: boolean;
          emptyText: string;
        }> = [
          {
            key: 'captain',
            roleLabel: 'กัปตันทีม',
            player: capPlayer,
            metricText: capPlayer ? `OVR ${capPlayer.ov}` : '-',
            isCaptain: true,
            emptyText: 'ยังไม่มีกัปตัน'
          },
          {
            key: 'topOvr',
            roleLabel: 'ดาวเด่นพลังสูงสุด',
            player: topO,
            metricText: topO ? `OVR ${topO.ov}` : '-',
            metricAccent: true,
            emptyText: '-'
          },
          {
            key: 'topScorer',
            roleLabel: 'ดาวซัลโวซีซั่นนี้',
            player: bs && bs.sg ? bs : undefined,
            metricText: bs && bs.sg ? `${bs.sg} ประตู` : '',
            metricAccent: true,
            emptyText: 'ยังไม่มีประตู'
          },
          {
            key: 'topAssist',
            roleLabel: 'จอมแอสซิสต์ซีซั่นนี้',
            player: ba && ba.sa ? ba : undefined,
            metricText: ba && ba.sa ? `${ba.sa} แอสซิสต์` : '',
            emptyText: 'ยังไม่มีข้อมูล'
          },
          {
            key: 'topApps',
            roleLabel: 'ลงสนามมากที่สุด',
            player: bm && bm.ap ? bm : undefined,
            metricText: bm && bm.ap ? `${bm.ap} นัด` : '',
            emptyText: 'ยังไม่มีข้อมูล'
          }
        ];

        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-2 gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-y-auto md:overflow-hidden mland:overflow-hidden">
              {/* Left Column: Compact Club Dossier & Head Coach Hub */}
              <div className="p-3 mland:p-2.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 h-full overflow-y-auto">
                {/* Section 1: Club Dossier (No duplicate Manager row since Coach hub is below) */}
                <section className="space-y-2 mland:space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">ข้อมูลสโมสร</h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setClubTab('identity');
                        }}
                        className="btn btn-xs btn-secondary whitespace-nowrap shrink-0"
                      >
                        <span>ตรา &amp; ชุดแข่ง</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => openClubEdit('name')} className="btn btn-xs btn-primary whitespace-nowrap shrink-0">
                        <Pencil className="w-3 h-3" />
                        <span>แก้ไข</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => openClubEdit('name')}
                      title="แตะเพื่อแก้ไขชื่อสโมสร"
                      className="min-w-0 border-b border-[var(--line)]/50 pb-1.5 text-left rounded-lg px-1.5 -mx-1.5 py-0.5 hover:bg-[var(--surface-2)]/55 transition-colors cursor-pointer group"
                    >
                      <div className="text-[10px] text-[var(--mut)] flex items-center justify-between gap-1">
                        <span>ชื่อสโมสร</span>
                        <Pencil className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
                      </div>
                      <div className="text-xs font-bold text-[var(--ink)] truncate">{me.name}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openClubEdit('nick')}
                      title="แตะเพื่อแก้ไขฉายาสโมสร"
                      className="min-w-0 border-b border-[var(--line)]/50 pb-1.5 text-left rounded-lg px-1.5 -mx-1.5 py-0.5 hover:bg-[var(--surface-2)]/55 transition-colors cursor-pointer group"
                    >
                      <div className="text-[10px] text-[var(--mut)] flex items-center justify-between gap-1">
                        <span>ฉายาสโมสร</span>
                        <Pencil className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
                      </div>
                      <div className="text-xs font-bold text-[var(--ink)] truncate">
                        {k.nick || <span className="font-normal text-[var(--mut)]">แตะเพื่อตั้งฉายา</span>}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openClubEdit('std')}
                      title="แตะเพื่อแก้ไขชื่อสนามเหย้า"
                      className="min-w-0 border-b border-[var(--line)]/50 pb-1.5 text-left rounded-lg px-1.5 -mx-1.5 py-0.5 hover:bg-[var(--surface-2)]/55 transition-colors cursor-pointer group"
                    >
                      <div className="text-[10px] text-[var(--mut)] flex items-center justify-between gap-1">
                        <span>สนามเหย้า</span>
                        <Pencil className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
                      </div>
                      <div className="text-xs font-bold text-[var(--ink)] truncate">{k.std}</div>
                      <div className="text-[9.5px] text-[var(--mut)] tabular truncate">
                        {getStadiumStyleSpec(k.stadiumStyle).shortName} · จุ {cap.toLocaleString()}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openClubEdit('motto')}
                      title="แตะเพื่อแก้ไขคำขวัญหรือปีที่ก่อตั้ง"
                      className="min-w-0 border-b border-[var(--line)]/50 pb-1.5 text-left rounded-lg px-1.5 -mx-1.5 py-0.5 hover:bg-[var(--surface-2)]/55 transition-colors cursor-pointer group"
                    >
                      <div className="text-[10px] text-[var(--mut)] flex items-center justify-between gap-1">
                        <span>คำขวัญ &amp; ก่อตั้ง</span>
                        <Pencil className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
                      </div>
                      <div className="text-xs font-semibold text-[var(--ink)] truncate">
                        {k.motto ? `“${k.motto}”` : <span className="font-normal text-[var(--mut)]">เพิ่มคำขวัญ</span>}
                      </div>
                      <div className="text-[9.5px] text-[var(--mut)] tabular truncate">พ.ศ. {k.founded || 2568}</div>
                    </button>
                  </div>
                </section>

                {/* Section 2: Head Coach & Tactical Style */}
                <section className="pt-2.5 mland:pt-2 border-t border-[var(--line)]/65 space-y-2.5 mland:space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setCoachDraft({
                            name: k.managerName || '',
                            vis: [...displayCoachVis],
                            style: displayCoachStyleId,
                            outfit: displayCoachOutfitId,
                            randomOutfitPerMatch: displayRandomOutfit
                          });
                          setCoachEditorTab('look');
                          setShowCoachEditor(true);
                        }}
                        title="คลิกเพื่อปรับแต่งโค้ช"
                        className="relative shrink-0 w-12 h-12 mland:w-11 mland:h-11 rounded-xl mland:rounded-lg bg-gradient-to-b from-[#eef5f1] via-[#dce9e2] to-[#c7dad0] dark:from-[#324d40] dark:via-[#24392f] dark:to-[#182820] border border-[var(--line)] hover:border-[var(--g)] flex items-end justify-center overflow-hidden cursor-pointer transition-colors shadow-inner"
                      >
                        <div className="relative z-10 w-full h-full pt-0.5 flex items-end justify-center [&>svg]:w-full [&>svg]:h-full">
                          <PlayerFace
                            player={coachFacePlayer}
                            team={me}
                            state={state}
                            club={k}
                            isMyClub
                            kitColor="#1e293b"
                            trimColor={k.c2 || '#facc15'}
                            coachOutfit={displayCoachOutfitId}
                            coachClubKit={k.c1 || me.kc[0]}
                            size={48}
                            bare
                            isCoach
                          />
                        </div>
                      </button>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm mland:text-[11px] text-[var(--ink)] truncate">
                          {k.managerName || 'หัวหน้าผู้ฝึกสอน'}
                        </div>
                        <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate tabular">
                          {repRank} (เครดิต {rep}) · {displayCoachOutfit.name}
                        </div>
                        <div className="text-[10px] mland:text-[9px] font-semibold text-[var(--g)] truncate">
                          {displayCoachStyle.icon} {displayCoachStyle.name} · {displayCoachStyle.effectDesc}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={randomizeInlineCoachOutfit}
                        title={`สุ่มเปลี่ยนชุดโค้ช (ปัจจุบัน: ${displayCoachOutfit.name})`}
                        className="btn btn-xs btn-secondary px-2 whitespace-nowrap"
                      >
                        <Shirt className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={toggleInlineRandomOutfit}
                        title="เปิด/ปิด สุ่มชุดโค้ชอัตโนมัติทุกนัด"
                        className={`btn btn-xs px-2 whitespace-nowrap ${
                          displayRandomOutfit
                            ? 'bg-[var(--g)] text-white border border-emerald-400/30 hover:brightness-110'
                            : 'btn-secondary'
                        }`}
                      >
                        <Shuffle className="w-3 h-3" />
                        <span>อัตโนมัติ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setCoachDraft({
                            name: k.managerName || '',
                            vis: [...displayCoachVis],
                            style: displayCoachStyleId,
                            outfit: displayCoachOutfitId,
                            randomOutfitPerMatch: displayRandomOutfit
                          });
                          setCoachEditorTab('look');
                          setShowCoachEditor(true);
                        }}
                        className="btn btn-xs btn-secondary whitespace-nowrap shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>แต่งโค้ช</span>
                      </button>
                    </div>
                  </div>

                  {/* Coaching Style Selector — Compact Structured List */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10.5px]">
                      <span className="font-bold text-[var(--ink)]">แนวทางการคุมทีม</span>
                      <span className="text-[10px] text-[var(--mut)] truncate">มีผลทั้งในสนามและตอนซ้อม</span>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] divide-y divide-[var(--line)]/55 overflow-hidden bg-[var(--surface-2)]/30">
                      {COACH_STYLES.map((st) => {
                        const active = displayCoachStyleId === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => selectInlineCoachStyle(st.id)}
                            className={`w-full px-2.5 py-1.5 mland:py-1 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                              active ? 'bg-[var(--g-soft)]' : 'hover:bg-[var(--surface-2)]/80'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm mland:text-xs shrink-0">{st.icon}</span>
                              <div className="min-w-0 flex items-baseline gap-1.5 truncate">
                                <span className="text-[11.5px] mland:text-[10.5px] font-bold text-[var(--ink)] shrink-0">{st.name}</span>
                                <span className="text-[10px] mland:text-[9px] text-[var(--mut)] truncate hidden sm:inline">· {st.shortDesc}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-[10px] mland:text-[9px] font-bold whitespace-nowrap ${
                                  active ? 'text-[var(--g)]' : 'text-[var(--mut)]'
                                }`}
                              >
                                {st.effectDesc}
                              </span>
                              <span
                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                                  active
                                    ? 'bg-[var(--g)] border-[var(--g)] text-white'
                                    : 'border-[var(--line)] bg-[var(--surface)]'
                                }`}
                              >
                                {active && <Check className="w-2.5 h-2.5" />}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column: Season Target & Board + Dressing Room Leaders */}
              <div className="space-y-2.5 mland:space-y-2 h-full overflow-y-auto pr-0.5">
                {/* Panel 1: Season Target & Board Status (no giant duplicate Board % card) */}
                <div className="p-3 mland:p-2.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">เป้าหมายซีซั่น &amp; บอร์ดบริหาร</h3>
                    <span className={`text-[11px] font-bold tabular ${bdStatusCls}`}>
                      เชื่อมั่น {bd}% · {bdStatusText}
                    </span>
                  </div>

                  {/* Slim Confidence Bar + 1-Line Target Evaluation */}
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${bd}%`,
                          backgroundColor: bd < 30 ? 'var(--red)' : bd < 55 ? 'var(--lamp)' : 'var(--g)'
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[10px]">
                      <span className="text-[var(--mut)] truncate">
                        {bd < 30
                          ? 'ความเชื่อมั่นวิกฤติ เร่งเก็บแต้มและรักษางบ'
                          : curRank <= targetRank
                            ? `ผลงานตามเป้า (อันดับ ${curRank}/${tierTbl.length} · เป้า ${targetRank}+)`
                            : `ต่ำกว่าเป้า (ตอนนี้ #${curRank} · ต้องติดอันดับ ${targetRank}+)`}
                      </span>
                      <span className="font-bold text-[var(--ink)] shrink-0 tabular">
                        เป้า 1–{targetRank}
                      </span>
                    </div>
                  </div>

                  {/* Streamlined Optional Board Directive Strip */}
                  <div className="pt-2 border-t border-[var(--line)]/60 space-y-1.5">
                    {state.boardDirective ? (() => {
                      const dir = state.boardDirective;
                      const prog = getBoardDirectiveProgress(state, dir);
                      const remMd = Math.max(0, dir.dueMd - (state.md ?? 0));
                      const directiveBg =
                        dir.status === 'passed'
                          ? 'border-[var(--g)]/40 bg-[var(--g-soft)]'
                          : dir.status === 'failed'
                            ? 'border-[var(--red)]/40 bg-[var(--red-soft)]'
                            : 'border-[var(--line)] bg-[var(--surface-2)]/65';
                      const statusLabel =
                        dir.status === 'active'
                          ? `น.${dir.dueMd} (อีก ${remMd} นัด)`
                          : dir.status === 'passed'
                            ? 'ผ่านภารกิจ'
                            : 'ไม่ผ่านเกณฑ์';

                      return (
                        <div className={`p-2.5 rounded-xl border space-y-1 ${directiveBg}`}>
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span className="truncate text-[var(--ink)]">📋 {dir.title}</span>
                            <span className="text-[10px] tabular shrink-0 text-[var(--mut)]">{statusLabel}</span>
                          </div>
                          <div className="text-[10.5px] font-semibold text-[var(--ink)]/90 truncate">{dir.targetLabel}</div>
                          {dir.status === 'active' && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <div className="flex-1 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(5, Math.round(prog.ratio * 100))}%`,
                                    backgroundColor: prog.isComplete ? 'var(--g)' : 'var(--lamp)'
                                  }}
                                />
                              </div>
                              <span className={`text-[10px] font-bold tabular shrink-0 ${prog.isComplete ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                                {prog.progressText}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 text-[9.5px] pt-0.5">
                            <span className="text-[var(--g)] truncate" title={dir.rewardText}>✓ {dir.rewardText}</span>
                            <span className="text-[var(--red)] truncate text-right" title={dir.penaltyText}>✕ {dir.penaltyText}</span>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="flex items-center justify-between gap-2 text-[10.5px]">
                        <span className="text-[var(--mut)] truncate">
                          ภารกิจเสริมจากบอร์ด: ว่างอยู่ (รับเพื่อลุ้นบัฟทีมชั่วคราว)
                        </span>
                        {(state.md ?? 0) < (state.fx?.length || 30) - 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              onUpdateState((d) => {
                                issueBoardDirective(d);
                              });
                              onToast('รับภารกิจเสริมจากบอร์ดแล้ว');
                            }}
                            className="btn btn-xs btn-secondary whitespace-nowrap shrink-0"
                          >
                            + รับภารกิจ
                          </button>
                        )}
                      </div>
                    )}

                    {activeBoardEffects.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] pt-0.5">
                        {activeBoardEffects.map((ef) => (
                          <span
                            key={ef.id}
                            className={`font-semibold tabular ${ef.tone === 'bonus' ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}
                          >
                            {ef.tone === 'bonus' ? '✦' : '⚠'} {ef.label} ({Math.max(1, ef.expiresMd - (state.md ?? 0))} นัด)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel 2: Dressing Room & Key Core (Read-only captain & leaders; captain assignment lives in Gameplan) */}
                <div className="p-3 mland:p-2.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">ห้องแต่งตัว &amp; แกนหลักทีม</h3>
                    <span className={`text-[10.5px] mland:text-[9px] font-semibold tabular truncate ${moodCls}`}>
                      {moodLabel} · พร้อมลง {readyCount}/{me.sq.length}
                      {injCount > 0 ? ` · เจ็บ ${injCount}` : ''}
                      {susCount > 0 ? ` · แบน ${susCount}` : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 divide-x divide-[var(--line)]/65 py-1.5 border-y border-[var(--line)]/65 text-center">
                    <div className="px-1">
                      <div className="text-[9.5px] mland:text-[8.5px] text-[var(--mut)]">ขวัญทีม</div>
                      <div className={`font-bold text-xs sm:text-sm mland:text-xs tabular ${morCls}`}>{morVal}%</div>
                    </div>
                    <div className="px-1">
                      <div className="text-[9.5px] mland:text-[8.5px] text-[var(--mut)]">เข้าใจแผน</div>
                      <div className={`font-bold text-xs sm:text-sm mland:text-xs tabular ${tacCls}`}>{tacFamVal}%</div>
                    </div>
                    <div className="px-1">
                      <div className="text-[9.5px] mland:text-[8.5px] text-[var(--mut)]">ความฟิตเฉลี่ย</div>
                      <div className={`font-bold text-xs sm:text-sm mland:text-xs tabular ${fitCls}`}>{avgFit}%</div>
                    </div>
                    <div className="px-1">
                      <div className="text-[9.5px] mland:text-[8.5px] text-[var(--mut)]">อายุเฉลี่ย</div>
                      <div className="font-bold text-xs sm:text-sm mland:text-xs tabular text-[var(--ink)]">{avgAge} ปี</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] mland:text-[8.5px] text-[var(--mut)]">
                      <span className="font-bold text-[var(--ink)]/85">แกนหลักทีม</span>
                      <span>แตะชื่อเพื่อดูข้อมูลนักเตะ</span>
                    </div>

                    <div className="divide-y divide-[var(--line)]/50">
                      {coreLeaders.map((row) => {
                        const pl = row.player;
                        const canInspect = Boolean(pl && onInspectPlayer);
                        if (!pl) {
                          return (
                            <div
                              key={row.key}
                              className="flex items-center justify-between gap-2 py-1.5 mland:py-1 text-[11px] mland:text-[9.5px]"
                            >
                              <span className="text-[var(--mut)]">{row.roleLabel}</span>
                              <span className="text-[var(--mut)]/80 tabular">{row.emptyText}</span>
                            </div>
                          );
                        }

                        const rowShirtNo = getShirtNo(me, pl);
                        const rowBody = (
                          <>
                            <div className="flex items-center gap-2.5 mland:gap-2 min-w-0 flex-1">
                              <div className="shrink-0 w-8 h-8 mland:w-7 mland:h-7 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/70 flex items-end justify-center overflow-hidden [&>svg]:w-7 [&>svg]:h-7 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
                                <PlayerFace player={{ ...pl, no: rowShirtNo }} team={me} state={state} club={k} isMyClub size={28} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] mland:text-[8.5px] font-medium text-[var(--mut)] truncate leading-tight">
                                  {row.roleLabel}
                                </div>
                                <div className="flex items-center gap-1 min-w-0 leading-tight mt-0.5">
                                  {row.isCaptain && (
                                    <span
                                      title="กัปตันทีม"
                                      className="text-[10px] mland:text-[9px] font-extrabold text-[#9a6700] dark:text-[var(--lamp)] shrink-0"
                                    >
                                      ©
                                    </span>
                                  )}
                                  <span className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)] group-hover:text-[var(--g)] truncate">
                                    {pl.n}
                                  </span>
                                  <span className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)] shrink-0 tabular">
                                    · {pl.ro} #{rowShirtNo}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-[11px] mland:text-[9.5px] font-extrabold tabular ${
                                  row.metricAccent ? 'text-[var(--g)]' : 'text-[var(--ink)]'
                                }`}
                              >
                                {row.metricText}
                              </span>
                              {canInspect && (
                                <ChevronRight className="w-3.5 h-3.5 text-[var(--mut)] opacity-45 group-hover:opacity-100 group-hover:text-[var(--g)] transition-opacity" />
                              )}
                            </div>
                          </>
                        );

                        return canInspect ? (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              onInspectPlayer?.(pl, me);
                            }}
                            className="w-full flex items-center justify-between gap-2 py-1.5 mland:py-1 px-1.5 -mx-1.5 rounded-xl hover:bg-[var(--surface-2)]/65 transition-colors cursor-pointer text-left group"
                          >
                            {rowBody}
                          </button>
                        ) : (
                          <div
                            key={row.key}
                            className="w-full flex items-center justify-between gap-2 py-1.5 mland:py-1 text-left"
                          >
                            {rowBody}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dedicated Spacious Club Info Editor Modal (Easy Thai Input + Clear Buttons + Mobile Keyboard Safe) */}
            {editingClubInfo && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4 mland:p-2"
                onClick={cancelClubEdit}
              >
                <form
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveClubEdit();
                  }}
                  className="w-full max-w-lg max-h-[calc(var(--app-dvh,1dvh)*90)] mland:max-h-[calc(var(--app-dvh,1dvh)*94)] flex flex-col rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl overflow-hidden"
                >
                  <div className="px-4 py-3 mland:py-2 border-b border-[var(--line)] flex items-center justify-between gap-3 shrink-0 bg-[var(--surface-2)]/40">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-[var(--ink)]">แก้ไขข้อมูลสโมสร</h3>
                      <p className="text-[11px] text-[var(--mut)] truncate">
                        พิมพ์สะดวก รองรับภาษาไทยครบทุกช่อง กดปุ่ม ✕ เพื่อล้างข้อความได้ทันที
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={cancelClubEdit}
                      aria-label="ปิดหน้าต่าง"
                      className="btn-icon"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 mland:p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-[var(--mut)] block mb-1">ชื่อสโมสร</label>
                        <div className="relative">
                          <input
                            type="text"
                            autoFocus={clubEditFocusField === 'name'}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            value={clubDraft.name}
                            maxLength={40}
                            placeholder="ระบุชื่อสโมสร"
                            onChange={(e) => {
                              const nextName = e.target.value;
                              setClubDraft((prev) => ({
                                ...prev,
                                name: nextName,
                                std: autoSyncStadium ? (nextName.trim() ? `สนาม${nextName.trim()}` : '') : prev.std
                              }));
                            }}
                            className="w-full pl-3.5 pr-9 py-2.5 sm:py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-base sm:text-sm font-semibold text-[var(--ink)] select-text focus:outline-none focus:border-[var(--g)]"
                          />
                          {clubDraft.name && (
                            <button
                              type="button"
                              aria-label="ล้างชื่อสโมสร"
                              onClick={() =>
                                setClubDraft((prev) => ({
                                  ...prev,
                                  name: '',
                                  std: autoSyncStadium ? '' : prev.std
                                }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-[var(--mut)] block mb-1">ฉายาสโมสร</label>
                        <div className="relative">
                          <input
                            type="text"
                            autoFocus={clubEditFocusField === 'nick'}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            value={clubDraft.nick}
                            maxLength={40}
                            placeholder="เช่น เสือล้านนา"
                            onChange={(e) => setClubDraft((prev) => ({ ...prev, nick: e.target.value }))}
                            className="w-full pl-3.5 pr-9 py-2.5 sm:py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-base sm:text-sm font-semibold text-[var(--ink)] select-text focus:outline-none focus:border-[var(--g)]"
                          />
                          {clubDraft.nick && (
                            <button
                              type="button"
                              aria-label="ล้างฉายาสโมสร"
                              onClick={() => setClubDraft((prev) => ({ ...prev, nick: '' }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <label className="text-xs font-semibold text-[var(--mut)]">ชื่อสนามเหย้า</label>
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              if (autoSyncStadium) {
                                setAutoSyncStadium(false);
                              } else {
                                setAutoSyncStadium(true);
                                const nm = clubDraft.name.trim();
                                setClubDraft((prev) => ({ ...prev, std: nm ? `สนาม${nm}` : '' }));
                              }
                            }}
                            title={autoSyncStadium ? 'กำลังเปลี่ยนชื่อสนามตามชื่อสโมสรอัตโนมัติ (แตะเพื่อตั้งชื่อเอง)' : 'แตะเพื่อให้ชื่อสนามเปลี่ยนตามชื่อสโมสรอัตโนมัติ'}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                              autoSyncStadium
                                ? 'bg-[var(--g-soft)] border-[var(--g)]/55 text-[var(--g)]'
                                : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] hover:border-[var(--g)]/55'
                            }`}
                          >
                            <Link2 className="w-2.5 h-2.5 shrink-0" />
                            <span>{autoSyncStadium ? 'ตามชื่อสโมสร' : 'ตั้งตามชื่อสโมสร'}</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            autoFocus={clubEditFocusField === 'std'}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            value={clubDraft.std}
                            maxLength={48}
                            placeholder={clubDraft.name.trim() ? `สนาม${clubDraft.name.trim()}` : 'ระบุชื่อสนามเหย้า'}
                            onChange={(e) => {
                              if (autoSyncStadium) setAutoSyncStadium(false);
                              setClubDraft((prev) => ({ ...prev, std: e.target.value }));
                            }}
                            className="w-full pl-3.5 pr-9 py-2.5 sm:py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-base sm:text-sm font-semibold text-[var(--ink)] select-text focus:outline-none focus:border-[var(--g)]"
                          />
                          {clubDraft.std && (
                            <button
                              type="button"
                              aria-label="ล้างชื่อสนามเหย้า"
                              onClick={() => {
                                setAutoSyncStadium(false);
                                setClubDraft((prev) => ({ ...prev, std: '' }));
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-[var(--mut)] block mb-1">ชื่อผู้จัดการทีม</label>
                        <div className="relative">
                          <input
                            type="text"
                            autoFocus={clubEditFocusField === 'managerName'}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            value={clubDraft.managerName}
                            maxLength={40}
                            placeholder="เช่น โค้ชต้น"
                            onChange={(e) => setClubDraft((prev) => ({ ...prev, managerName: e.target.value }))}
                            className="w-full pl-3.5 pr-9 py-2.5 sm:py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-base sm:text-sm font-semibold text-[var(--ink)] select-text focus:outline-none focus:border-[var(--g)]"
                          />
                          {clubDraft.managerName && (
                            <button
                              type="button"
                              aria-label="ล้างชื่อผู้จัดการทีม"
                              onClick={() => setClubDraft((prev) => ({ ...prev, managerName: '' }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold text-[var(--mut)] block mb-1">คำขวัญสโมสร</label>
                          <div className="relative">
                            <input
                              type="text"
                              autoFocus={clubEditFocusField === 'motto'}
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              value={clubDraft.motto}
                              maxLength={80}
                              placeholder="เช่น สู้สุดใจเพื่อชัยชนะ"
                              onChange={(e) => setClubDraft((prev) => ({ ...prev, motto: e.target.value }))}
                              className="w-full pl-3.5 pr-9 py-2.5 sm:py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-base sm:text-sm font-semibold text-[var(--ink)] select-text focus:outline-none focus:border-[var(--g)]"
                            />
                            {clubDraft.motto && (
                              <button
                                type="button"
                                aria-label="ล้างคำขวัญสโมสร"
                                onClick={() => setClubDraft((prev) => ({ ...prev, motto: '' }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[var(--mut)] block mb-1">ปีก่อตั้ง (พ.ศ.)</label>
                          <input
                            type="text"
                            autoFocus={clubEditFocusField === 'founded'}
                            inputMode="numeric"
                            maxLength={4}
                            value={clubDraft.founded}
                            onChange={(e) =>
                              setClubDraft((prev) => ({ ...prev, founded: e.target.value.replace(/\D/g, '').slice(0, 4) }))
                            }
                            className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-base sm:text-sm font-semibold text-[var(--ink)] tabular select-text focus:outline-none focus:border-[var(--g)]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-[var(--mut)] mr-1">คำขวัญด่วน:</span>
                      {['สู้ไม่ถอยเพื่อแฟนบอล', 'ใจเกินร้อย', 'ศักดิ์ศรีลูกหนังไทย'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setClubDraft((prev) => ({ ...prev, motto: preset }))}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-[11px] font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="px-4 py-3 mland:py-2 border-t border-[var(--line)] bg-[var(--surface-2)]/40 flex items-center justify-end gap-2 shrink-0">
                    <button type="button" onClick={cancelClubEdit} className="btn btn-sm btn-secondary">
                      <X className="w-3.5 h-3.5" />
                      <span>ยกเลิก</span>
                    </button>
                    <button type="submit" className="btn btn-sm btn-primary">
                      <Check className="w-3.5 h-3.5" />
                      <span>บันทึกข้อมูล</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Dedicated Coach Customization Studio Modal (Draft + Visual Presets + Direct Option Chips + Save/Reset) */}
            {showCoachEditor && (() => {
              const curDraft = coachDraft || {
                name: k.managerName || '',
                vis: [...coachVis],
                style: (k.managerStyle || 'balanced') as CoachStyleId,
                outfit: curOutfit,
                randomOutfitPerMatch: Boolean(k.managerRandomOutfitPerMatch)
              };
              const draftStyle = COACH_STYLES.find((s) => s.id === curDraft.style) || COACH_STYLES[0];
              const draftOutfit = COACH_OUTFITS.find((o) => o.id === curDraft.outfit) || COACH_OUTFITS[0];
              const hasCoachChanges =
                curDraft.name.trim() !== (k.managerName || '').trim() ||
                curDraft.style !== ((k.managerStyle || 'balanced') as CoachStyleId) ||
                curDraft.outfit !== curOutfit ||
                curDraft.randomOutfitPerMatch !== Boolean(k.managerRandomOutfitPerMatch) ||
                curDraft.vis.some((v, idx) => v !== (coachVis[idx] ?? 0));

              const draftCoachPlayer: Player = {
                ...coachFacePlayer,
                n: curDraft.name || 'หัวหน้าผู้ฝึกสอน',
                vis: curDraft.vis
              };

              const coachPresets: Array<{ label: string; vis: number[] }> = [
                { label: 'มาดสุขุม', vis: [1, 0, 5, 4, 3, 0, 2, 5] },
                { label: 'โค้ชไฟแรง', vis: [0, 0, 14, 0, 2, 0, 0, 0] },
                { label: 'จอมเก๋า', vis: [2, 5, 17, 2, 7, 0, 3, 5] },
                { label: 'สายลุย', vis: [3, 1, 9, 1, 4, 0, 2, 1] }
              ];

              const patchCoachVis = (idx: number, val: number) => {
                SFX.tap();
                setCoachDraft((prev) => {
                  const base = prev || curDraft;
                  const nextVis = [...base.vis];
                  nextVis[idx] = val;
                  return { ...base, vis: nextVis };
                });
              };

              const randomizeCoachDraft = () => {
                SFX.tap();
                setCoachDraft((prev) => ({
                  ...(prev || curDraft),
                  vis: [
                    R(0, SKIN_P.length - 1),
                    R(0, HAIR_P.length - 1),
                    R(0, HS_N.length - 1),
                    R(0, FH_N.length - 1),
                    R(0, EY_N.length - 1),
                    0,
                    R(0, FS_N.length - 1),
                    Math.random() < 0.35 ? 5 : 0
                  ]
                }));
              };

              const randomizeCoachOutfitDraft = () => {
                SFX.tap();
                const pool = COACH_OUTFITS.filter((o) => o.id !== curDraft.outfit);
                const pick = (pool.length ? pool : COACH_OUTFITS)[R(0, (pool.length ? pool : COACH_OUTFITS).length - 1)];
                if (pick) {
                  setCoachDraft((prev) => ({ ...(prev || curDraft), outfit: pick.id }));
                }
              };

              const saveCoachDraft = () => {
                SFX.tap();
                const cleanName = curDraft.name.replace(/["'<>`]/g, '').trim();
                onUpdateState((d) => {
                  const cl = ensureClubIdentity(d);
                  cl.managerName = cleanName;
                  cl.managerVis = [...curDraft.vis];
                  cl.managerStyle = curDraft.style;
                  cl.managerOutfit = curDraft.outfit;
                  cl.managerRandomOutfitPerMatch = curDraft.randomOutfitPerMatch;
                });
                setShowCoachEditor(false);
                setCoachDraft(null);
                onToast('บันทึกข้อมูล รูปลักษณ์ และการแต่งกายโค้ชเรียบร้อยแล้ว!');
              };

              const resetCoachDraft = () => {
                SFX.tap();
                setCoachDraft({
                  name: k.managerName || '',
                  vis: [...coachVis],
                  style: (k.managerStyle || 'balanced') as CoachStyleId,
                  outfit: curOutfit,
                  randomOutfitPerMatch: Boolean(k.managerRandomOutfitPerMatch)
                });
                onToast('คืนค่าโค้ชเดิมแล้ว');
              };

              const closeCoachEditor = () => {
                SFX.tap();
                setShowCoachEditor(false);
                setCoachDraft(null);
              };

              return (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4 mland:p-2"
                  onClick={closeCoachEditor}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-3xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*95)] flex flex-col rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl overflow-hidden"
                  >
                    {/* Modal Header */}
                    <div className="px-4 py-3 mland:py-2 border-b border-[var(--line)] flex items-center justify-between gap-3 shrink-0">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm sm:text-base text-[var(--ink)]">ปรับแต่งหัวหน้าผู้ฝึกสอน</h3>
                        <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate">
                          ออกแบบหน้าตา ทรงผม ชื่อ และแนวทางคุมทีมได้ดั่งใจ แล้วกดบันทึก
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeCoachEditor}
                        aria-label="ปิดหน้าต่าง"
                        className="btn-icon"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Modal Body: 2-Column Studio */}
                    <div className="flex-1 min-h-0 flex flex-col sm:flex-row mland:flex-row overflow-hidden">
                      {/* Left Live Preview & Quick Looks */}
                      <div className="sm:w-[235px] mland:w-[215px] shrink-0 p-4 mland:p-3 border-b sm:border-b-0 sm:border-r mland:border-b-0 mland:border-r border-[var(--line)]/70 bg-[var(--surface-2)]/35 flex flex-col gap-3 mland:gap-2 overflow-y-auto">
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className="relative w-28 h-28 mland:w-24 mland:h-24 rounded-2xl bg-gradient-to-b from-[#eef5f1] via-[#dce9e2] to-[#c7dad0] dark:from-[#324d40] dark:via-[#24392f] dark:to-[#182820] border border-[var(--line)] flex items-end justify-center overflow-hidden shadow-sm">
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.65),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_40%,rgba(232,248,240,0.24),transparent_72%)]"
                            />
                            <div className="relative z-10 w-full h-full pt-1 flex items-end justify-center [&>svg]:w-full [&>svg]:h-full">
                              <PlayerFace
                                player={draftCoachPlayer}
                                team={me}
                                state={state}
                                club={k}
                                isMyClub
                                kitColor="#1e293b"
                                trimColor={k.c2 || '#facc15'}
                                coachOutfit={curDraft.outfit}
                                coachClubKit={k.c1 || me.kc[0]}
                                size={104}
                                bare
                                isCoach
                              />
                            </div>
                          </div>
                          <div className="w-full min-w-0">
                            <div className="font-bold text-sm text-[var(--ink)] truncate">
                              {curDraft.name.trim() || 'หัวหน้าผู้ฝึกสอน'}
                            </div>
                            <div className="text-[11px] text-[var(--mut)] truncate tabular">
                              {repRank} · ชื่อเสียง {rep}
                            </div>
                            <div className="text-[11px] font-semibold text-[var(--g)] truncate mt-0.5">
                              {draftStyle.icon} {draftStyle.name} · {draftOutfit.name}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-[var(--mut)] block mb-1">ชื่อผู้จัดการทีม</label>
                          <input
                            value={curDraft.name}
                            maxLength={40}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="เช่น โค้ชต้น"
                            onChange={(e) => {
                              const val = e.target.value.replace(/["'<>`]/g, '');
                              setCoachDraft((prev) => ({ ...(prev || curDraft), name: val }));
                            }}
                            className="w-full px-3 py-2 mland:py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-base sm:text-xs font-semibold text-[var(--ink)] select-text focus:outline-none focus:border-[var(--g)]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[var(--mut)]">ลุคโค้ชสำเร็จรูป</span>
                            <button
                              type="button"
                              onClick={randomizeCoachDraft}
                              className="btn btn-xs btn-secondary whitespace-nowrap shrink-0"
                            >
                              <Dices className="w-3 h-3" />
                              <span>สุ่มหน้า</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-2 mland:grid-cols-2 gap-1.5">
                            {coachPresets.map((pr) => {
                              const active = pr.vis.every((v, idx) => curDraft.vis[idx] === v);
                              const presetPlayer: Player = { ...draftCoachPlayer, vis: pr.vis };
                              return (
                                <button
                                  key={pr.label}
                                  type="button"
                                  onClick={() => {
                                    SFX.tap();
                                    setCoachDraft((prev) => ({ ...(prev || curDraft), vis: [...pr.vis] }));
                                  }}
                                  className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                                    active
                                      ? 'bg-[var(--g-soft)] border-[var(--g)]'
                                      : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--g)]/60'
                                  }`}
                                >
                                  <div className="w-9 h-9 mland:w-8 mland:h-8 pt-0.5 flex items-end justify-center overflow-hidden [&>svg]:w-full [&>svg]:h-full">
                                    <PlayerFace
                                      player={presetPlayer}
                                      team={me}
                                      state={state}
                                      club={k}
                                      isMyClub
                                      kitColor="#1e293b"
                                      trimColor={k.c2 || '#facc15'}
                                      coachOutfit={curDraft.outfit}
                                      coachClubKit={k.c1 || me.kc[0]}
                                      size={34}
                                      bare
                                      isCoach
                                    />
                                  </div>
                                  <span className="text-[9.5px] font-semibold text-[var(--ink)] truncate w-full text-center">
                                    {pr.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Right Controls Column */}
                      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                        <div className="px-4 pt-3 mland:pt-2 pb-2 border-b border-[var(--line)]/60 shrink-0">
                          <div className="seg-bar grid grid-cols-2 w-full">
                            <button
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                setCoachEditorTab('look');
                              }}
                              className={`seg-btn ${coachEditorTab === 'look' ? 'seg-btn-active' : ''}`}
                            >
                              หน้าตา &amp; การแต่งกาย
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                setCoachEditorTab('style');
                              }}
                              className={`seg-btn ${coachEditorTab === 'style' ? 'seg-btn-active' : ''}`}
                            >
                              แนวทางการคุมทีม
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-3 space-y-3.5 mland:space-y-2.5 text-xs">
                          {coachEditorTab === 'look' ? (
                            <>
                              {/* Coach Outfit Selector */}
                              <div className="space-y-1.5 pb-3 border-b border-[var(--line)]/55">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <div className="min-w-0">
                                    <span className="text-[11px] font-bold text-[var(--mut)]">การแต่งกายของโค้ช</span>
                                    <span className="ml-1.5 text-[10.5px] font-semibold text-[var(--g)]">
                                      {draftOutfit.name} · {draftOutfit.desc}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={randomizeCoachOutfitDraft}
                                      className="btn btn-xs btn-secondary whitespace-nowrap shrink-0"
                                    >
                                      <Shirt className="w-3 h-3" />
                                      <span>สุ่มชุด</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        SFX.tap();
                                        setCoachDraft((prev) => ({
                                          ...(prev || curDraft),
                                          randomOutfitPerMatch: !(prev || curDraft).randomOutfitPerMatch
                                        }));
                                      }}
                                      className={`btn btn-xs whitespace-nowrap shrink-0 ${
                                        curDraft.randomOutfitPerMatch
                                          ? 'bg-[var(--g)] text-white border border-emerald-400/30 shadow-xs'
                                          : 'btn-secondary'
                                      }`}
                                    >
                                      <Shuffle className="w-3 h-3" />
                                      <span>อัตโนมัติ{curDraft.randomOutfitPerMatch ? ' ✓' : ''}</span>
                                    </button>
                                  </div>
                                </div>
                                {curDraft.randomOutfitPerMatch && (
                                  <div className="text-[10.5px] text-[var(--g)] font-medium bg-[var(--g-soft)] border border-[var(--g)]/30 rounded-lg px-2.5 py-1">
                                    เปิดอยู่: โค้ชจะสุ่มเปลี่ยนชุดข้างสนามใหม่อัตโนมัติทุกนัดที่ลงแข่งขัน (ชุดที่เลือกไว้ด้านล่างใช้แสดงในหน้าข้อมูลสโมสร)
                                  </div>
                                )}
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                  {COACH_OUTFITS.map((outfitOpt) => {
                                    const active = curDraft.outfit === outfitOpt.id;
                                    const swatchPrimary =
                                      outfitOpt.mode === 'tracksuit' || outfitOpt.mode === 'polo'
                                        ? k.c1 || me.kc[0] || '#1e293b'
                                        : outfitOpt.coat;
                                    const swatchSecondary =
                                      outfitOpt.mode === 'tracksuit' || outfitOpt.mode === 'polo'
                                        ? k.c2 || '#facc15'
                                        : outfitOpt.mode === 'shirt'
                                          ? k.c2 || '#1e293b'
                                          : outfitOpt.lapel;
                                    return (
                                      <button
                                        key={outfitOpt.id}
                                        type="button"
                                        onClick={() => {
                                          SFX.tap();
                                          setCoachDraft((prev) => ({ ...(prev || curDraft), outfit: outfitOpt.id }));
                                        }}
                                        className={`px-2 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-colors text-left ${
                                          active
                                            ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-xs'
                                            : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                                        }`}
                                      >
                                        <span
                                          className="w-4 h-4 rounded-md border border-black/20 shrink-0 relative overflow-hidden"
                                          style={{ background: swatchPrimary }}
                                        >
                                          <span
                                            className="absolute inset-y-0 right-0 w-1.5"
                                            style={{ background: swatchSecondary }}
                                          />
                                        </span>
                                        <span className="text-[10.5px] font-semibold truncate">
                                          {outfitOpt.name}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {/* Skin & Hair Colors */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-[var(--line)]/55">
                                <div className="space-y-1.5">
                                  <div className="text-[11px] font-bold text-[var(--mut)]">โทนสีผิว</div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {SKIN_P.map((col, idx) => (
                                      <button
                                        key={col}
                                        type="button"
                                        aria-label={`สีผิว ${idx + 1}`}
                                        onClick={() => patchCoachVis(0, idx)}
                                        className={`w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 shadow-xs cursor-pointer transition-transform ${
                                          curDraft.vis[0] === idx ? 'ring-2 ring-[var(--g)] scale-110' : 'hover:scale-105'
                                        }`}
                                        style={{ background: col }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="text-[11px] font-bold text-[var(--mut)]">สีผม &amp; หนวดเครา</div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {HAIR_P.map((col, idx) => (
                                      <button
                                        key={col}
                                        type="button"
                                        aria-label={`สีผม ${idx + 1}`}
                                        onClick={() => patchCoachVis(1, idx)}
                                        className={`w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 shadow-xs cursor-pointer transition-transform ${
                                          curDraft.vis[1] === idx ? 'ring-2 ring-[var(--g)] scale-110' : 'hover:scale-105'
                                        }`}
                                        style={{ background: col }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Direct Feature Option Chips */}
                              {(
                                [
                                  ['ทรงผม', 2, HS_N],
                                  ['รูปหน้า', 6, FS_N],
                                  ['ดวงตา & แววตา', 4, EY_N],
                                  ['หนวดเครา', 3, FH_N],
                                  ['เอกลักษณ์ & เครื่องประดับ', 7, ACC_N]
                                ] as const
                              ).map(([lbl, visIdx, opts]) => {
                                const curVal = (curDraft.vis[visIdx] ?? 0) % opts.length;
                                return (
                                  <div key={lbl} className="space-y-1.5 pb-2.5 border-b border-[var(--line)]/45 last:border-b-0 last:pb-0">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-bold text-[var(--mut)]">{lbl}</span>
                                      <span className="text-[10.5px] font-semibold text-[var(--g)]">{opts[curVal]}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {opts.map((optLabel, idx) => {
                                        const active = curVal === idx;
                                        return (
                                          <button
                                            key={optLabel}
                                            type="button"
                                            onClick={() => patchCoachVis(visIdx, idx)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${
                                              active
                                                ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                                : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                                            }`}
                                          >
                                            {optLabel}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          ) : (
                            <div className="rounded-xl border border-[var(--line)] divide-y divide-[var(--line)]/60 overflow-hidden bg-[var(--surface-2)]/30">
                              {COACH_STYLES.map((st) => {
                                const active = curDraft.style === st.id;
                                return (
                                  <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => {
                                      SFX.tap();
                                      setCoachDraft((prev) => ({ ...(prev || curDraft), style: st.id }));
                                    }}
                                    className={`w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors ${
                                      active ? 'bg-[var(--g-soft)]' : 'hover:bg-[var(--surface-2)]/80'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 border ${
                                          active
                                            ? 'bg-[var(--surface)] border-[var(--g)]/50'
                                            : 'bg-[var(--surface)] border-[var(--line)]/70'
                                        }`}
                                      >
                                        {st.icon}
                                      </span>
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-[var(--ink)]">{st.name}</div>
                                        <div className="text-[11px] text-[var(--mut)]">{st.shortDesc}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className={`text-[11px] font-bold whitespace-nowrap ${active ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                                        {st.effectDesc}
                                      </span>
                                      <span
                                        className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                                          active ? 'bg-[var(--g)] border-[var(--g)] text-white' : 'border-[var(--line)] bg-[var(--surface)]'
                                        }`}
                                      >
                                        {active && <Check className="w-2.5 h-2.5" />}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-4 py-3 mland:py-2 border-t border-[var(--line)] flex items-center justify-between gap-2 shrink-0 bg-[var(--surface-2)]/40">
                      <span className="text-[11px] text-[var(--mut)] truncate">
                        {hasCoachChanges ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'ข้อมูลตรงกับสถานะปัจจุบัน'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={closeCoachEditor} className="btn btn-sm btn-secondary whitespace-nowrap shrink-0">
                          ยกเลิก
                        </button>
                        {hasCoachChanges && (
                          <button type="button" onClick={resetCoachDraft} className="btn btn-sm btn-secondary whitespace-nowrap shrink-0">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>คืนค่าเดิม</span>
                          </button>
                        )}
                        <button type="button" onClick={saveCoachDraft} className="btn btn-sm btn-primary whitespace-nowrap shrink-0">
                          <Check className="w-3.5 h-3.5" />
                          <span>บันทึก</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        );
      })()}

      {/* Club Tab 2: Facilities & Backroom Staff (Unique evolving illustrations, Lv.10/Lv.6 progression & Renovations) */}
      {clubTab === 'infra' && (() => {
        const travelLvCur = clamp(state.travelLv ?? 1, 0, MAX_FACILITY_LV);
        const travelCondCur = travelLvCur <= 0 ? 40 : getFacilityCondition(state, 'travelLv');
        const travelReadyBonus = travelLvCur <= 0 ? -2 : Math.round(((travelLvCur - 1) / (MAX_FACILITY_LV - 1)) * 4 * (travelCondCur >= 75 ? 0.8 + (travelCondCur - 75) * 0.008 : 0.45 + ((travelCondCur - 40) / 35) * 0.35));
        const travelFatigueSavePct = travelLvCur <= 0 ? 0 : Math.round((1 - clamp(1.04 - (travelLvCur / MAX_FACILITY_LV) * (travelCondCur / 100) * 0.11, 0.92, 1.05)) * 100);
        const infraFacilityDefs: readonly { key: FacilityKey; title: string; desc: string; perkLine: string; baseCost: number }[] = [
          {
            key: 'st',
            title: 'สนามเหย้า & อัฒจันทร์',
            desc: `ความจุ ${est.cap.toLocaleString()} ที่นั่ง · เพิ่มสเตตัสความนิ่ง/มุ่งมั่นนัดเหย้า + ค่าตั๋ว & เพดานค่าจ้าง`,
            perkLine: `ความจุ ${est.cap.toLocaleString()} ที่นั่ง · ตั๋ว ~${fmtMoneyNum(est.estTicket)}/นัดเหย้า`,
            baseCost: 110
          },
          {
            key: 'tr',
            title: 'ศูนย์ฝึกซ้อมครบวงจร',
            desc: 'เพิ่มสเตตัสสปีด/ความคม/พละกำลังในสนาม & ลดเสียแรงแข่ง + อัปค่าพลังซ้อม',
            perkLine: `ซ้อมพัฒนา +${Math.round((state.tr ?? 1) * 1.4)}% ฟิต · ลดล้าในสนาม`,
            baseCost: 90
          },
          {
            key: 'travelLv',
            title: 'การเดินทาง & ความพร้อมเกมเยือน',
            desc: `${getTravelTierLabel(travelLvCur)} · จัดระบบเดินทาง ที่พัก และฟื้นฟูร่างกายเมื่อออกไปแข่งนอกบ้าน`,
            perkLine: `เกมเยือน นิ่ง/พร้อม ${travelReadyBonus >= 0 ? `+${travelReadyBonus}` : travelReadyBonus} · ลดล้าเดินทาง ${travelFatigueSavePct > 0 ? `-${travelFatigueSavePct}%` : '0%'} · ฟื้นหลังแข่ง +${Math.floor(Math.max(0, travelLvCur - 1) * 0.45)}%`,
            baseCost: 80
          },
          {
            key: 'ya',
            title: 'อะคาเดมี่เยาวชน',
            desc: 'ปั้นดาวรุ่ง OVR สูงขึ้นทุกซีซั่น & เพิ่มคุณภาพงานแมวมอง',
            perkLine: `ฐานปั้นเยาวชน Lv.${state.ya ?? 1}/${MAX_FACILITY_LV}`,
            baseCost: 85
          },
          {
            key: 'med',
            title: 'ศูนย์การแพทย์ & กายภาพ',
            desc: 'เพิ่มความอึด/ทรงตัว/ฟื้นตัวในเกม ลดความเร็วตกเมื่อล้า & ลดเจ็บหนักในสนาม',
            perkLine: `ลดเสี่ยงเจ็บ & เร่งฟื้นอาการบาดเจ็บ (Lv.${state.med ?? 1}/${MAX_FACILITY_LV})`,
            baseCost: 80
          },
          {
            key: 'turfLv',
            title: 'พื้นสนามหญ้า & ระบายน้ำ',
            desc: `${getTurfGradeForLevel(state.turfLv ?? 1, getFacilityCondition(state, 'turfLv')).name} · เร่งบอลบนพื้น คุมบอล/จ่ายบอลดีขึ้น ลดลื่น/เสียแรง/เจ็บ`,
            perkLine: `ระดับหญ้า: ${getTurfGradeForLevel(state.turfLv ?? 1, getFacilityCondition(state, 'turfLv')).name}`,
            baseCost: 75
          },
          {
            key: 'analyticsLv',
            title: 'ห้องวิเคราะห์เกม & วีดิทัศน์',
            desc: 'เพิ่มสเตตัสอ่านเกม/จ่ายบอล/จับจังหวะล้ำหน้าในสนาม + เร่งความคุ้นเคยแท็กติก',
            perkLine: `อ่านเกม/ล้ำหน้า + คุ้นเคยแผน +${Math.floor(Math.max(0, (state.analyticsLv ?? 1) - 1) / 2)}/นัด`,
            baseCost: 85
          },
          {
            key: 'merchLv',
            title: 'เมกะสโตร์ & แฟนโซน',
            desc: `เสริมบรรยากาศกองเชียร์นัดเหย้า รายได้วันแข่ง (+${fmtMoneyNum(est.estMerch)}) & เพดานค่าจ้าง`,
            perkLine: `ยอดขายเหย้า ~+${fmtMoneyNum(est.estMerch)} · พาร์ทเนอร์สูงสุด ${(state.merchLv ?? 1) >= 5 ? 3 : 2} ช่อง`,
            baseCost: 75
          }
        ];
        const staffDefs: readonly { role: StaffRoleKey; title: string; desc: string }[] = [
          { role: 'asst', title: 'ผู้ช่วยผู้จัดการทีม', desc: 'ปลดล็อกโน้ตจุดอ่อนคู่แข่ง & แนะนำจัดแผนก่อนแข่ง (ลึกขึ้นตาม Lv) + เร่งคุ้นเคยแท็กติก & อัป OVR ตอนซ้อม' },
          { role: 'fit', title: 'โค้ชฟิตเนส & พละกำลัง', desc: 'ฟื้นฟูความฟิตนักเตะหลังแข่ง +1.6%/Lv ทั้งตัวจริงและสำรอง' },
          { role: 'scout', title: 'หัวหน้าทีมแมวมอง', desc: 'ยกระดับ OVR & จำนวนแข้งเป้าหมายที่ค้นพบจากภารกิจแมวมอง' },
          { role: 'physio', title: 'ทีมแพทย์ & นักกายภาพ', desc: 'ลดโอกาสบาดเจ็บ -5%/Lv และลดค่ากายภาพบำบัดรายคน' },
          { role: 'gkCoach', title: 'โค้ชผู้รักษาประตู', desc: 'เร่งพัฒนาการผู้รักษาประตูในการซ้อม +2.4%/Lv' },
          { role: 'setPieceCoach', title: 'โค้ชลูกตั้งเตะ & ยุทธวิธี', desc: 'เพิ่มความคุ้นเคยแผนการเล่น & เสริมพัฒนาการผู้เล่นเอาต์ฟิลด์' }
        ];
        let totalRenovateAll = 0;
        let wornCount = 0;
        let lvSum = 0;
        let condSum = 0;
        let activeFacCount = 0;
        infraFacilityDefs.forEach((f) => {
          const curLv = clamp(state[f.key] ?? 1, f.key === 'st' ? 1 : 0, MAX_FACILITY_LV);
          lvSum += curLv;
          if (curLv <= 0) return;
          activeFacCount++;
          const cond = getFacilityCondition(state, f.key);
          condSum += cond;
          if (cond < 100) {
            wornCount++;
            totalRenovateAll += getFacilityRenovateCost(f.baseCost, curLv, cond);
          }
        });
        const avgFacLv = (lvSum / infraFacilityDefs.length).toFixed(1);
        const avgFacCond = activeFacCount > 0 ? Math.round(condSum / activeFacCount) : 0;
        const homeReadinessLv = Math.round(((clamp(state.st ?? 1, 1, 10) + clamp(state.turfLv ?? 1, 0, 10)) / 2) * 10) / 10;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-2 gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-y-auto md:overflow-hidden mland:overflow-hidden">
            {/* Left Column: 8 Unique Facilities Lv.10 + Compact Readiness Strip */}
            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5 h-full overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[var(--line)]/60">
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm mland:text-xs">🏟️ สิ่งอำนวยความสะดวก ({infraFacilityDefs.length} แห่ง · Lv.{MAX_FACILITY_LV})</h3>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">
                    เฉลี่ย Lv.{avgFacLv} · สภาพ {avgFacCond}% · เหย้า Lv.{homeReadinessLv} · เยือน Lv.{travelLvCur}
                  </div>
                </div>
                {wornCount > 0 && (
                  <button
                    type="button"
                    disabled={state.money < totalRenovateAll}
                    onClick={() => renovateAllFacs(infraFacilityDefs)}
                    className="btn btn-xs btn-gold whitespace-nowrap shrink-0"
                  >
                    🔧 ปรับปรุงทั้งหมด ({wornCount}) · {fmtMoneyNum(totalRenovateAll)}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {infraFacilityDefs.map(({ key, title, desc, perkLine, baseCost }) => {
                  const minLv = key === 'st' ? 1 : 0;
                  const lv = clamp(state[key] ?? 1, minLv, MAX_FACILITY_LV);
                  const cond = getFacilityCondition(state, key);
                  const upgCost = getFacilityUpgradeCost(baseCost, lv);
                  const renCost = getFacilityRenovateCost(baseCost, lv, cond);
                  const canDemolish = lv > minLv;
                  const isMaxLv = lv >= MAX_FACILITY_LV;
                  const condToneCls =
                    lv <= 0 || cond < 75
                      ? 'text-[var(--red)]'
                      : cond < 90
                        ? 'text-[#9a6700] dark:text-[var(--lamp)]'
                        : 'text-[var(--g)]';

                  return (
                    <div
                      key={key}
                      className={`p-2.5 mland:p-2 rounded-xl border space-y-1.5 transition-colors ${
                        lv <= 0
                          ? 'bg-[var(--red-soft)]/20 border-[var(--red)]/35'
                          : isMaxLv
                            ? 'bg-gradient-to-br from-[var(--g-soft)]/50 to-[var(--surface-2)]/45 border-[var(--g)]/45'
                            : cond < 75
                              ? 'bg-[var(--surface-2)]/70 border-[var(--red)]/35'
                              : 'bg-[var(--surface-2)]/45 border-[var(--line)]/75'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <FacilityUpgradeSvg
                          kind={key}
                          level={lv}
                          condition={cond}
                          c1={me.kc[0]}
                          c2={me.kc[1]}
                          stadiumStyle={key === 'st' ? curStadiumStyle : undefined}
                          className="w-[88px] h-[56px] mland:w-[76px] mland:h-[48px] shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-xs mland:text-[10.5px] truncate">{title}</span>
                            <span
                              className={`font-extrabold text-[10.5px] tabular shrink-0 ${
                                lv <= 0
                                  ? 'text-[var(--red)]'
                                  : isMaxLv
                                    ? 'text-[#8a5b00] dark:text-[var(--lamp)]'
                                    : 'text-[var(--g)]'
                              }`}
                            >
                              {isMaxLv ? `★ Lv.${lv}/${MAX_FACILITY_LV}` : `Lv.${lv}/${MAX_FACILITY_LV}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] truncate">
                            <span className={`font-semibold ${lv <= 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]/85'}`}>
                              {key === 'travelLv' ? getTravelTierLabel(lv) : getFacilityTierLabel(lv)}
                            </span>
                            <span className="opacity-40">·</span>
                            <span className={`font-bold tabular ${condToneCls}`}>
                              {lv <= 0
                                ? 'ถูกทำลาย'
                                : cond < 55
                                  ? `สภาพ ${cond}% (ชำรุด)`
                                  : cond < 75
                                    ? `สภาพ ${cond}% (ควรซ่อม)`
                                    : `สภาพ ${cond}%`}
                            </span>
                          </div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug line-clamp-2">{desc}</div>
                          <div className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--g)] tabular truncate">
                            ✦ {perkLine}
                          </div>
                          {key === 'st' && (
                            <div className="pt-0.5 flex flex-wrap items-center justify-between gap-1.5">
                              <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] truncate">
                                🏛️ {curStadiumStyleSpec.name} ({builtStadiumStyles.length}/{STADIUM_STYLE_SPECS.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  SFX.tap();
                                  setShowStadiumPicker((v) => !v);
                                }}
                                className={`btn btn-xs ${showStadiumPicker ? 'btn-surface border-[var(--g)] text-[var(--g)]' : 'btn-secondary'}`}
                              >
                                {showStadiumPicker ? 'ซ่อนแบบสนาม' : `เปลี่ยนแบบ (${STADIUM_STYLE_SPECS.length})`}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-10 gap-1">
                        {Array.from({ length: MAX_FACILITY_LV }, (_, idx) => idx + 1).map((step) => (
                          <span
                            key={step}
                            className={`h-1 rounded-full transition-colors ${
                              step <= lv
                                ? isMaxLv
                                  ? 'bg-[var(--lamp)]'
                                  : 'bg-[var(--g)]'
                                : 'bg-[var(--surface)] border border-[var(--line)]/60'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                        {lv > 0 ? (
                          <div className="flex-1 min-w-[50px] h-1.5 rounded-full bg-[var(--surface)] overflow-hidden border border-[var(--line)]/50">
                            <div
                              className={`h-full transition-all ${cond < 75 ? 'bg-[var(--red)]' : cond < 90 ? 'bg-[var(--lamp)]' : 'bg-emerald-500'}`}
                              style={{ width: `${cond}%` }}
                            />
                          </div>
                        ) : (
                          <span className="flex-1 text-[10px] mland:text-[9px] font-semibold text-[var(--mut)]">
                            พื้นที่ว่าง · สร้างใหม่ได้
                          </span>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                          {canDemolish && (
                            <button
                              type="button"
                              onClick={() => setDemolishTarget({ key, title, baseCost, minLv })}
                              className="btn btn-xs btn-danger"
                              title={`รื้อถอน/ทำลาย${title}`}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>รื้อ</span>
                            </button>
                          )}
                          {lv > 0 && cond < 100 && (
                            <button
                              type="button"
                              disabled={state.money < renCost}
                              onClick={() => renovateFac(key, title, baseCost)}
                              className="btn btn-xs btn-surface hover:border-[var(--lamp)]"
                            >
                              🔧 ซ่อม {fmtMoneyNum(renCost)}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={lv >= MAX_FACILITY_LV || state.money < upgCost}
                            onClick={() => upgradeFac(key, title, baseCost)}
                            className="btn btn-xs btn-primary"
                          >
                            {lv >= MAX_FACILITY_LV
                              ? `★ Lv.${MAX_FACILITY_LV} เต็ม`
                              : lv <= 0
                                ? `🏗️ สร้าง ${fmtMoneyNum(upgCost)}`
                                : `⬆️ Lv.${lv + 1} · ${fmtMoneyNum(upgCost)}`}
                          </button>
                        </div>
                      </div>

                      {key === 'st' && showStadiumPicker && (
                        <div className="pt-2 border-t border-[var(--line)]/70 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[9px]">
                            <span className="font-extrabold text-[var(--ink)]">
                              เลือกสร้างรูปแบบสนาม (ปลดล็อกแล้ว {builtStadiumStyles.length}/{STADIUM_STYLE_SPECS.length} แบบ · สร้างแล้วสลับใช้ซ้ำได้ฟรี)
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {STADIUM_STYLE_SPECS.map((spec) => {
                              const isActive = spec.id === curStadiumStyle;
                              const isBuilt = builtStadiumStyles.includes(spec.id);
                              const canAfford = isBuilt || state.money >= spec.buildCost;
                              return (
                                <div
                                  key={spec.id}
                                  className={`p-2 rounded-xl border flex flex-col justify-between gap-2 transition-colors ${
                                    isActive
                                      ? 'bg-[var(--g-soft)]/60 border-[var(--g)]'
                                      : isBuilt
                                        ? 'bg-[var(--surface)] border-[var(--line)]'
                                        : 'bg-[var(--surface)]/80 border-[var(--line)]/75'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <FacilityUpgradeSvg
                                      kind="st"
                                      level={lv}
                                      condition={100}
                                      c1={me.kc[0]}
                                      c2={me.kc[1]}
                                      stadiumStyle={spec.id}
                                      className="w-[74px] h-[48px] shrink-0"
                                    />
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-extrabold text-[11px] mland:text-[9.5px] text-[var(--ink)] truncate">
                                          {spec.name}
                                        </span>
                                        {isActive ? (
                                          <span className="px-1.5 py-0.5 rounded bg-[var(--g)] text-white text-[9px] font-bold shrink-0">
                                            ใช้งานอยู่
                                          </span>
                                        ) : isBuilt ? (
                                          <span className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)] text-[9px] font-bold shrink-0">
                                            สร้างแล้ว
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="text-[9.5px] mland:text-[8px] font-semibold text-[var(--mut)]">
                                        {spec.archTag}
                                      </div>
                                      <div className="space-y-0.5 pt-0.5">
                                        {spec.highlights.map((hl, hIdx) => (
                                          <div key={hIdx} className="text-[9.5px] mland:text-[8px] font-semibold text-[var(--g)] leading-tight">
                                            • {hl}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--line)]/50">
                                    <span className="text-[9.5px] text-[var(--mut)] truncate">{spec.desc}</span>
                                    <button
                                      type="button"
                                      disabled={isActive || !canAfford}
                                      onClick={() => buildOrSelectStadiumStyle(spec.id)}
                                      className={`btn btn-xs shrink-0 ${
                                        isActive
                                          ? 'btn-surface text-[var(--g)] border-[var(--g)]/40'
                                          : isBuilt
                                            ? 'btn-secondary'
                                            : 'btn-primary'
                                      }`}
                                    >
                                      {isActive
                                        ? '✓ กำลังใช้งาน'
                                        : isBuilt
                                          ? 'เปลี่ยนมาใช้'
                                          : spec.buildCost <= 0
                                            ? 'สร้างฟรี'
                                            : `🏗️ สร้าง ${fmtMoneyNum(spec.buildCost)}`}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: 6 Unique Staff Roles Lv.6 */}
            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5 h-full overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[var(--line)]/60">
                <div>
                  <h3 className="font-bold text-xs sm:text-sm mland:text-xs">🧑‍🏫 ทีมงานสตาฟฟ์โค้ช ({staffDefs.length} ตำแหน่ง · Lv.{MAX_STAFF_LV})</h3>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">ทีมงานเฉพาะทางแต่ละสายช่วยยกระดับทีมอย่างต่อเนื่อง</div>
                </div>
                <span className="text-xs mland:text-[10px] font-bold text-[var(--red)] tabular">-{fmtMoneyNum(est.staffCost)}/นัด</span>
              </div>

              <div className="space-y-2">
                {staffDefs.map(({ role, title, desc }) => {
                  const lv = clamp(stf[role], 0, MAX_STAFF_LV);
                  const nextCost = STAFF_HIRE_COSTS[lv] ?? 0;
                  return (
                    <div
                      key={role}
                      className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/45 border border-[var(--line)]/75 space-y-1.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <StaffRoleSvg
                          role={role}
                          level={lv}
                          c1={me.kc[0]}
                          c2={me.kc[1]}
                          className="w-[68px] h-[56px] mland:w-[58px] mland:h-[48px] shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-xs mland:text-[10.5px] truncate">{title}</span>
                            <span className={`font-extrabold text-[10.5px] tabular shrink-0 ${lv > 0 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                              Lv.{lv}/{MAX_STAFF_LV}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--mut)]">
                            <span className="font-semibold text-[var(--ink)]/85">{getStaffTierLabel(lv)}</span>
                            <span>·</span>
                            <span className="tabular">{(lv * 1.2).toFixed(1)} ล./นัด</span>
                          </div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug line-clamp-2">{desc}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 grid grid-cols-6 gap-1">
                          {Array.from({ length: MAX_STAFF_LV }, (_, idx) => idx + 1).map((step) => (
                            <span
                              key={step}
                              className={`h-1 rounded-full transition-colors ${step <= lv ? 'bg-[var(--g)]' : 'bg-[var(--surface)] border border-[var(--line)]/60'}`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {lv > 0 && (
                            <button
                              type="button"
                              onClick={() => fireStaff(role, title)}
                              className="btn btn-xs btn-surface text-[var(--mut)] hover:text-[var(--red)] hover:border-[var(--red)]/50"
                            >
                              ลด
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={lv >= MAX_STAFF_LV || state.money < nextCost}
                            onClick={() => hireStaff(role, title)}
                            className="btn btn-xs btn-primary"
                          >
                            {lv >= MAX_STAFF_LV ? `Lv.${MAX_STAFF_LV} เต็ม` : `${lv === 0 ? 'จ้าง' : 'เลื่อนขั้น'} ${fmtMoneyNum(nextCost)}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Club Tab 2: Crest & Jersey Studio (Compact & Structured) */}
      {clubTab === 'identity' && (
        <div className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-hidden">
          {/* Portrait mobile pane switcher so Crest & Kit stay compact without deep vertical scrolling */}
          <div className="md:hidden mland:hidden seg-bar grid grid-cols-2 shrink-0">
            <button
              type="button"
              onClick={() => setIdentityMobilePane('crest')}
              className={`seg-btn py-1.5 ${identityMobilePane === 'crest' ? 'seg-btn-active' : ''}`}
            >
              🛡️ ตราสโมสร
            </button>
            <button
              type="button"
              onClick={() => setIdentityMobilePane('kit')}
              className={`seg-btn py-1.5 ${identityMobilePane === 'kit' ? 'seg-btn-active' : ''}`}
            >
              🎽 ชุดแข่ง &amp; สี
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-2 gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
            {/* Left Panel: Crest Studio */}
            <div
              className={`${
                identityMobilePane === 'crest' ? 'flex' : 'hidden md:flex mland:flex'
              } rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex-col min-h-0 overflow-hidden`}
            >
              <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)]/65 bg-[var(--surface-2)]/30 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="font-bold text-xs sm:text-[13px] mland:text-xs text-[var(--ink)] whitespace-nowrap">🛡️ ตราสโมสร</h3>
                  <span className="hidden sm:inline text-[10px] mland:text-[9px] font-medium text-[var(--mut)] truncate">
                    {CREST_SHAPES[dk.shape]?.label} · {CREST_IC_NAMES[dk.icon] || dk.icon}
                  </span>
                </div>
                <div className="seg-bar shrink-0">
                  <button
                    type="button"
                    onClick={() => setCrestStudioTab('shape')}
                    className={`seg-btn whitespace-nowrap ${crestStudioTab === 'shape' ? 'seg-btn-active' : ''}`}
                  >
                    ทรง &amp; ลาย
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrestStudioTab('icon')}
                    className={`seg-btn whitespace-nowrap ${crestStudioTab === 'icon' ? 'seg-btn-active' : ''}`}
                  >
                    สัญลักษณ์ ({Object.keys(CREST_IC).length})
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 mland:px-2.5 mland:py-1.5 space-y-2 mland:space-y-1.5">
                {crestStudioTab === 'shape' ? (
                  <>
                    {/* Shapes */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold">รูปทรง ({CREST_SHAPES.length} แบบ)</span>
                        <span className="text-[10px] mland:text-[9px] font-bold text-[var(--g)]">
                          {CREST_SHAPES[dk.shape]?.label || 'โล่คลาสสิก'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {CREST_SHAPES.map((sh, i) => {
                          const active = dk.shape === i;
                          return (
                            <button
                              key={sh.label}
                              type="button"
                              onClick={() => patchIdentityDraft((cl) => { cl.shape = i; })}
                              className={`flex items-center gap-1.5 py-1 px-1.5 rounded-lg text-[10px] mland:text-[9px] font-semibold cursor-pointer border transition-colors min-w-0 ${
                                active
                                  ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--ink)]'
                                  : 'bg-[var(--surface-2)]/35 border-[var(--line)]/55 text-[var(--mut)] hover:text-[var(--ink)] hover:border-[var(--line)]'
                              }`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
                                <path d={sh.d} fill={dk.c1} stroke={active ? 'var(--g)' : 'var(--line)'} strokeWidth="1.7" />
                              </svg>
                              <span className="truncate">{sh.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Border & Stars */}
                    <div className="pt-2 mland:pt-1.5 border-t border-[var(--line)]/50 grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold mb-1">ขอบตรา</div>
                        <div className="seg-bar grid grid-cols-4 w-full">
                          {(['ขาว', 'ทอง', 'คู่', 'ดำ'] as const).map((lbl, i) => (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => patchIdentityDraft((cl) => { cl.crestBorder = i; })}
                              className={`seg-btn whitespace-nowrap px-1! ${(dk.crestBorder ?? 0) === i ? 'seg-btn-active' : ''}`}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold mb-1">ดาวเกียรติยศ</div>
                        <div className="seg-bar grid grid-cols-4 w-full">
                          {[0, 1, 2, 3].map((stCnt) => (
                            <button
                              key={stCnt}
                              type="button"
                              onClick={() => patchIdentityDraft((cl) => { cl.stars = stCnt; })}
                              className={`seg-btn whitespace-nowrap px-1! tabular ${(dk.stars ?? 0) === stCnt ? 'seg-btn-active' : ''}`}
                            >
                              {stCnt === 0 ? 'ไม่มี' : '★'.repeat(stCnt)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Patterns */}
                    <div className="pt-2 mland:pt-1.5 border-t border-[var(--line)]/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold">ลายพื้นหลัง ({CREST_PATTERNS.length} แบบ)</span>
                        <span className="text-[10px] mland:text-[9px] font-bold text-[var(--g)]">
                          {CREST_PATTERNS[dk.pat]}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-5 mland:grid-cols-5 gap-1">
                        {CREST_PATTERNS.map((l, i) => {
                          const active = dk.pat === i;
                          const shPath = CREST_SHAPES[dk.shape % CREST_SHAPES.length]?.d || CREST_SHAPES[0].d;
                          const patUid = `patprev-${i}`;
                          return (
                            <button
                              key={l}
                              type="button"
                              onClick={() => patchIdentityDraft((cl) => { cl.pat = i; })}
                              className={`flex items-center gap-1 py-1 px-1.5 rounded-lg text-[9.5px] mland:text-[8.5px] font-semibold cursor-pointer border transition-colors min-w-0 ${
                                active
                                  ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                  : 'bg-[var(--surface-2)]/35 border-[var(--line)]/55 text-[var(--mut)] hover:text-[var(--ink)] hover:border-[var(--line)]'
                              }`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
                                <defs>
                                  <clipPath id={`cp-${patUid}`}>
                                    <path d={shPath} />
                                  </clipPath>
                                  {i === 9 && (
                                    <linearGradient id={`cg-${patUid}`} x1="0" y1="0" x2="1" y2="1">
                                      <stop offset="0%" stopColor={dk.c1} />
                                      <stop offset="100%" stopColor={dk.c2} />
                                    </linearGradient>
                                  )}
                                  {i === 19 && (
                                    <radialGradient id={`cr-${patUid}`} cx="50%" cy="50%" r="55%">
                                      <stop offset="0%" stopColor={dk.c2} />
                                      <stop offset="100%" stopColor={dk.c1} />
                                    </radialGradient>
                                  )}
                                </defs>
                                <g clipPath={`url(#cp-${patUid})`}>
                                  {renderCrestPattern(i, patUid, dk.c1, dk.c2)}
                                </g>
                                <path d={shPath} fill="none" stroke={active ? '#ffffff' : 'var(--line)'} strokeWidth="1.5" />
                              </svg>
                              <span className="truncate">{l}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Emblem Color + Random */}
                    <div className="pb-2 mland:pb-1.5 border-b border-[var(--line)]/50 flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold mr-0.5">สีสัญลักษณ์:</span>
                        {(
                          [
                            ['', 'อัตโนมัติ'],
                            ['#ffffff', 'ขาว'],
                            ['#0f172a', 'ดำ'],
                            ['#facc15', 'ทอง'],
                            ['#38bdf8', 'ฟ้า'],
                            ['#ef4444', 'แดง']
                          ] as const
                        ).map(([colVal, lbl]) => {
                          const active = (dk.iconColor || '') === colVal;
                          return (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => patchIdentityDraft((cl) => { cl.iconColor = colVal; })}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] mland:text-[9px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                                active
                                  ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                  : 'bg-[var(--surface-2)]/35 border-[var(--line)]/65 text-[var(--mut)] hover:text-[var(--ink)]'
                              }`}
                            >
                              {colVal && (
                                <span
                                  className="w-2.5 h-2.5 rounded-xs border border-black/20 dark:border-white/25 shrink-0"
                                  style={{ background: colVal }}
                                />
                              )}
                              <span>{lbl}</span>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const icKeys = Object.keys(CREST_IC);
                          const picked = P(icKeys);
                          patchIdentityDraft((cl) => { cl.icon = picked; });
                        }}
                        className="btn btn-xs btn-secondary whitespace-nowrap shrink-0"
                      >
                        <Shuffle className="w-3 h-3" />
                        <span>สุ่ม</span>
                      </button>
                    </div>

                    {/* Visual Vector Emblem Grid */}
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-1">
                      {Object.keys(CREST_IC).map((ic) => {
                        const active = dk.icon === ic;
                        return (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => patchIdentityDraft((cl) => { cl.icon = ic; })}
                            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 mland:py-1 rounded-lg cursor-pointer border transition-colors min-w-0 ${
                              active
                                ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--g)] ring-1 ring-[var(--g)]'
                                : 'bg-[var(--surface-2)]/25 border-[var(--line)]/50 text-[var(--ink)] hover:border-[var(--line)] hover:bg-[var(--surface-2)]/60'
                            }`}
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
                              <g
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                dangerouslySetInnerHTML={{ __html: CREST_IC[ic] }}
                              />
                            </svg>
                            <span className="text-[9px] mland:text-[8px] font-semibold truncate max-w-full leading-tight">
                              {CREST_IC_NAMES[ic] || ic}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right Panel: Jersey Studio */}
            <div
              className={`${
                identityMobilePane === 'kit' ? 'flex' : 'hidden md:flex mland:flex'
              } rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex-col min-h-0 overflow-hidden`}
            >
              <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)]/65 bg-[var(--surface-2)]/30 flex items-center justify-between gap-2 shrink-0">
                <h3 className="font-bold text-xs sm:text-[13px] mland:text-xs text-[var(--ink)] whitespace-nowrap">🎽 ชุดแข่ง &amp; โทนสี</h3>
                <span className="text-[10px] mland:text-[9px] font-bold text-[var(--g)] truncate">
                  {KIT_PATTERNS[dk.kit || 0]} · {KIT_COLLARS[(dk.collar ?? 0) % 4]}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 mland:px-2.5 mland:py-1.5 space-y-2 mland:space-y-1.5">
                {/* Popular Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold">ชุดสียอดนิยม</span>
                    <button
                      type="button"
                      onClick={() =>
                        patchIdentityDraft((cl) => {
                          const prev1 = cl.c1;
                          cl.c1 = cl.c2;
                          cl.c2 = prev1;
                        })
                      }
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-[var(--line)]/70 bg-[var(--surface-2)]/50 hover:border-[var(--g)] text-[9.5px] font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap"
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>สลับเหย้า/เยือน</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {clubPresets.map((pr) => {
                      const active = dk.c1.toLowerCase() === pr.c1.toLowerCase() && dk.c2.toLowerCase() === pr.c2.toLowerCase();
                      return (
                        <button
                          key={pr.label}
                          type="button"
                          onClick={() => {
                            patchIdentityDraft((cl) => {
                              cl.c1 = pr.c1;
                              cl.c2 = pr.c2;
                              cl.c3 = pr.c3 || '';
                            });
                          }}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-[9.5px] mland:text-[8.5px] font-semibold cursor-pointer border transition-colors min-w-0 ${
                            active
                              ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--ink)]'
                              : 'bg-[var(--surface-2)]/35 border-[var(--line)]/55 text-[var(--mut)] hover:text-[var(--ink)] hover:border-[var(--line)]'
                          }`}
                        >
                          <span className="inline-flex items-center -space-x-0.5 shrink-0">
                            <span className="w-2.5 h-2.5 rounded-xs border border-black/15 dark:border-white/25" style={{ background: pr.c1 }} />
                            <span className="w-2.5 h-2.5 rounded-xs border border-black/15 dark:border-white/25" style={{ background: pr.c2 }} />
                          </span>
                          <span className="truncate">{pr.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Unified 3-Target Color Picker (Single clean palette saves huge space) */}
                <div className="pt-2 mland:pt-1.5 border-t border-[var(--line)]/50 space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="seg-bar grid grid-cols-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => setKitColorTarget('c1')}
                        className={`seg-btn inline-flex items-center justify-center gap-1 whitespace-nowrap ${kitColorTarget === 'c1' ? 'seg-btn-active' : ''}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-black/20 dark:border-white/30 shrink-0" style={{ background: dk.c1 }} />
                        <span>สีหลัก</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setKitColorTarget('c2')}
                        className={`seg-btn inline-flex items-center justify-center gap-1 whitespace-nowrap ${kitColorTarget === 'c2' ? 'seg-btn-active' : ''}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-black/20 dark:border-white/30 shrink-0" style={{ background: dk.c2 }} />
                        <span>สีรอง/เยือน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setKitColorTarget('c3')}
                        className={`seg-btn inline-flex items-center justify-center gap-1 whitespace-nowrap ${kitColorTarget === 'c3' ? 'seg-btn-active' : ''}`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20 dark:border-white/30 shrink-0"
                          style={{ background: dk.c3 || dk.c2 }}
                        />
                        <span>สีขลิบ</span>
                      </button>
                    </div>
                    {kitColorTarget === 'c3' && (
                      <button
                        type="button"
                        onClick={() => patchIdentityDraft((cl) => { cl.c3 = ''; })}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                          !dk.c3
                            ? 'bg-[var(--g-soft)] border-[var(--g)]/60 text-[var(--g)]'
                            : 'border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                        }`}
                      >
                        อัตโนมัติ
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mland:gap-1 pt-0.5">
                    {KIT_SW.map((col) => {
                      const isBlocked =
                        (kitColorTarget === 'c1' && colDist(col, dk.c2) < 150) ||
                        (kitColorTarget === 'c2' && colDist(col, dk.c1) < 150);
                      const isSelected =
                        (kitColorTarget === 'c1' && dk.c1 === col) ||
                        (kitColorTarget === 'c2' && dk.c2 === col) ||
                        (kitColorTarget === 'c3' && dk.c3 === col);
                      return (
                        <button
                          key={col}
                          type="button"
                          disabled={isBlocked}
                          title={
                            isBlocked
                              ? kitColorTarget === 'c1'
                                ? 'สีใกล้กับชุดเยือนมากเกินไป'
                                : 'สีใกล้กับชุดเหย้ามากเกินไป'
                              : col
                          }
                          onClick={() =>
                            patchIdentityDraft((cl) => {
                              if (kitColorTarget === 'c1') cl.c1 = col;
                              else if (kitColorTarget === 'c2') cl.c2 = col;
                              else cl.c3 = col;
                            })
                          }
                          className={`w-6 h-6 mland:w-5 mland:h-5 rounded-md border border-black/20 dark:border-white/25 disabled:opacity-20 cursor-pointer transition-transform ${
                            isSelected ? 'ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[var(--surface)] scale-105' : 'hover:scale-105'
                          }`}
                          style={{ background: col }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Unified Home & Away Kit Pattern Studio + 1-Tap Smart Match */}
                {(() => {
                  const homePat = (dk.kit || 0) % KIT_PATTERNS.length;
                  const effectiveAwayPat = dk.awayKit != null ? dk.awayKit % KIT_PATTERNS.length : homePat;
                  const isAwaySynced = dk.awayKit == null;
                  const editingAway = kitPatternTarget === 'away';
                  const activePat = editingAway ? effectiveAwayPat : homePat;
                  const previewC = editingAway ? dk.c2 : dk.c1;
                  const previewD = editingAway ? dk.c1 : dk.c2;

                  const handleSmartMatchAway = () => {
                    const pairPool = AWAY_KIT_PAIRINGS[homePat] || [0, 5, 4, 12];
                    const curIdx = pairPool.indexOf(effectiveAwayPat);
                    const nextAway = isAwaySynced || curIdx < 0 ? pairPool[0] : pairPool[(curIdx + 1) % pairPool.length];
                    patchIdentityDraft((cl) => {
                      cl.awayKit = nextAway;
                    });
                    setKitPatternTarget('away');
                    onToast(`แมตช์ชุดเยือน "${KIT_PATTERNS[nextAway]}" คู่กับชุดเหย้า "${KIT_PATTERNS[homePat]}" แล้ว`);
                  };

                  return (
                    <div className="pt-2 mland:pt-1.5 border-t border-[var(--line)]/50 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="seg-bar grid grid-cols-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setKitPatternTarget('home')}
                            className={`seg-btn whitespace-nowrap ${!editingAway ? 'seg-btn-active' : ''}`}
                          >
                            🏠 ลายเหย้า
                          </button>
                          <button
                            type="button"
                            onClick={() => setKitPatternTarget('away')}
                            className={`seg-btn whitespace-nowrap ${editingAway ? 'seg-btn-active' : ''}`}
                          >
                            ✈️ ลายเยือน
                          </button>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              patchIdentityDraft((cl) => {
                                cl.awayKit = undefined;
                              });
                              setKitPatternTarget('away');
                              onToast(`ตั้งชุดเยือนเป็นลายเดียวกับชุดเหย้า (${KIT_PATTERNS[homePat]})`);
                            }}
                            title="ตั้งให้ลายชุดเยือนเหมือนชุดเหย้าเป๊ะ"
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] mland:text-[9px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                              isAwaySynced
                                ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--g)]'
                                : 'bg-[var(--surface-2)]/40 border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                            }`}
                          >
                            <Link2 className="w-3 h-3 shrink-0" />
                            <span>เหมือนเหย้า</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSmartMatchAway}
                            title="สุ่ม/สลับลายชุดเยือนที่เข้าคู่ลงตัวกับลายชุดเหย้า"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/45 bg-amber-500/10 hover:bg-amber-500/20 text-[10px] mland:text-[9px] font-bold text-amber-700 dark:text-amber-300 cursor-pointer whitespace-nowrap transition-colors"
                          >
                            <Wand2 className="w-3 h-3 shrink-0" />
                            <span>แมตช์คู่สวย</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] mland:text-[9px] text-[var(--mut)]">
                        <span>
                          {editingAway
                            ? isAwaySynced
                              ? 'ชุดเยือน: กำลังใช้ลายเดียวกับเหย้า (แตะลายด้านล่างเพื่อแยก)'
                              : 'เลือกภาพลายเสื้อสำหรับชุดเยือน'
                            : 'เลือกภาพลายเสื้อสำหรับชุดเหย้า'}
                        </span>
                        <span className="font-bold text-[var(--g)]">
                          {KIT_PATTERNS[activePat]}
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1">
                        {KIT_PATTERNS.map((l, i) => {
                          const selected = activePat === i;
                          const syncedMark = editingAway && isAwaySynced && homePat === i;
                          return (
                            <button
                              key={l}
                              type="button"
                              onClick={() =>
                                patchIdentityDraft((cl) => {
                                  if (editingAway) cl.awayKit = i;
                                  else cl.kit = i;
                                })
                              }
                              className={`flex items-center gap-1 py-1 px-1.5 rounded-lg border text-[9.5px] mland:text-[8.5px] font-semibold cursor-pointer transition-colors min-w-0 ${
                                selected
                                  ? syncedMark
                                    ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--ink)] ring-1 ring-[var(--g)]'
                                    : 'bg-[var(--g)] text-white border-[var(--g)]'
                                  : 'bg-[var(--surface-2)]/35 border-[var(--line)]/55 text-[var(--mut)] hover:text-[var(--ink)] hover:border-[var(--line)]'
                              }`}
                            >
                              <KitPatternThumb pattern={i} c={previewC} d={previewD} accent={dk.c3} size={14} />
                              <span className="truncate">{l}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Collar & Cuff Trim */}
                <div className="pt-2 mland:pt-1.5 border-t border-[var(--line)]/50 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <div className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold mb-1">ทรงคอเสื้อ</div>
                    <div className="seg-bar grid grid-cols-4 w-full">
                      {KIT_COLLARS.map((clbl, ci) => (
                        <button
                          key={clbl}
                          type="button"
                          onClick={() => patchIdentityDraft((cl) => { cl.collar = ci; })}
                          className={`seg-btn whitespace-nowrap px-1! ${(dk.collar ?? 0) === ci ? 'seg-btn-active' : ''}`}
                        >
                          {clbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold mb-1">ขลิบแขน &amp; ชาย</div>
                    <div className="seg-bar grid grid-cols-2 w-full">
                      <button
                        type="button"
                        onClick={() => patchIdentityDraft((cl) => { cl.cuffTrim = true; })}
                        className={`seg-btn whitespace-nowrap ${(dk.cuffTrim ?? true) ? 'seg-btn-active' : ''}`}
                      >
                        เปิด
                      </button>
                      <button
                        type="button"
                        onClick={() => patchIdentityDraft((cl) => { cl.cuffTrim = false; })}
                        className={`seg-btn whitespace-nowrap ${!(dk.cuffTrim ?? true) ? 'seg-btn-active' : ''}`}
                      >
                        ปิด
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Club Tab 3: Club Activities (Compact & Responsive) */}
      {clubTab === 'activities' && (
        <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[var(--line)]/60 shrink-0">
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm mland:text-xs">🤝 กิจกรรมสโมสร &amp; มวลชนสัมพันธ์</h3>
              <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate">
                ขวัญทีม {state.mor ?? 55}% · เข้าใจแผน {me.tacFam ?? 65}% · คูลดาวน์ 3 นัดต่อครั้ง
              </p>
            </div>
            <span className={`text-xs mland:text-[10.5px] font-bold shrink-0 ${actCool ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--g)]'}`}>
              {actCool ? `⏳ รออีก ${remCd} นัด` : '✅ พร้อมจัดกิจกรรม'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mland:grid-cols-3 gap-2 mland:gap-1.5 flex-1 min-h-0 overflow-y-auto content-start pr-0.5">
            <button
              type="button"
              disabled={actCool}
              onClick={() => {
                let gained = 0;
                onUpdateState((d) => {
                  d.fan = clamp((d.fan ?? 50) + 6, 5, 100);
                  gained = Math.max(450, Math.round(ensureTeamFans(d.teams[d.me]) * 0.025));
                  adjustTeamFans(d.teams[d.me], gained);
                  d.clubActMd = curTurn;
                });
                onToast(`แฟนบอลประทับใจ! ผู้ติดตามสโมสร +${fmtFans(gained)} คน`);
              }}
              className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] transition-colors space-y-1"
            >
              <div className="flex items-center justify-between gap-2 font-bold text-xs mland:text-[11px]">
                <span className="truncate">📣 พบปะแฟนบอล</span>
                <span className="text-[var(--g)] shrink-0">ฟรี</span>
              </div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] leading-snug">เพิ่มแฟนบอล +2.5% และความคึกคักเข้าสนาม</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 20}
              onClick={() => {
                let gained = 0;
                onUpdateState((d) => {
                  d.money -= 20;
                  logFin(d, 'จัดงาน Open House สโมสร', -20);
                  d.fan = clamp((d.fan ?? 50) + 8, 5, 100);
                  gained = Math.max(700, Math.round(ensureTeamFans(d.teams[d.me]) * 0.04));
                  adjustTeamFans(d.teams[d.me], gained);
                  d.mor = clamp((d.mor ?? 50) + 5, 0, 100);
                  d.bd = clamp((d.bd ?? 50) + 3, 0, 100);
                  d.clubActMd = curTurn;
                });
                onToast(`Open House สำเร็จ! แฟนบอล +${fmtFans(gained)} คน · ขวัญ +5% · บอร์ด +3%`);
              }}
              className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] transition-colors space-y-1"
            >
              <div className="flex items-center justify-between gap-2 font-bold text-xs mland:text-[11px]">
                <span className="truncate">🎉 Open House สโมสร</span>
                <span className="tabular shrink-0 text-[var(--ink)]">20k</span>
              </div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] leading-snug">แฟนบอล +4% · ขวัญ +5% · บอร์ด +3%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 25}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 25;
                  logFin(d, 'แคมป์กระชับความสัมพันธ์ทีม', -25);
                  d.mor = clamp((d.mor ?? 50) + 8, 0, 100);
                  d.teams[d.me].sq.forEach((q) => {
                    q.fit = clamp((q.fit ?? 100) + 6, 30, 100);
                  });
                  d.clubActMd = curTurn;
                });
                onToast('เข้าแคมป์สำเร็จ! ขวัญทีม +8% ความฟิต +6%');
              }}
              className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] transition-colors space-y-1"
            >
              <div className="flex items-center justify-between gap-2 font-bold text-xs mland:text-[11px]">
                <span className="truncate">🏃 แคมป์กระชับทีม</span>
                <span className="tabular shrink-0 text-[var(--ink)]">25k</span>
              </div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] leading-snug">ขวัญทีม +8% · ฟิตทั้งทีม +6%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 15}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 15;
                  logFin(d, 'ติวเข้มแท็กติกทีม', -15);
                  d.teams[d.me].tacFam = clamp((d.teams[d.me].tacFam ?? 65) + 10, 30, 100);
                  d.mor = clamp((d.mor ?? 50) + 3, 0, 100);
                  d.clubActMd = curTurn;
                });
                onToast('ติวเข้มแท็กติกสำเร็จ! ความคุ้นเคยแผน +10% · ขวัญ +3%');
              }}
              className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] transition-colors space-y-1"
            >
              <div className="flex items-center justify-between gap-2 font-bold text-xs mland:text-[11px]">
                <span className="truncate">🎯 ติวเข้มแท็กติก</span>
                <span className="tabular shrink-0 text-[var(--ink)]">15k</span>
              </div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] leading-snug">ความคุ้นเคยแผน +10% · ขวัญ +3%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 10}
              onClick={() => {
                let gained = 0;
                onUpdateState((d) => {
                  d.money -= 10;
                  logFin(d, 'จัดแมตช์การกุศลสโมสร', -10);
                  d.fan = clamp((d.fan ?? 50) + 10, 5, 100);
                  gained = Math.max(900, Math.round(ensureTeamFans(d.teams[d.me]) * 0.05));
                  adjustTeamFans(d.teams[d.me], gained);
                  d.mgrRep = (d.mgrRep ?? 50) + 4;
                  d.bd = clamp((d.bd ?? 50) + 2, 0, 100);
                  d.clubActMd = curTurn;
                });
                onToast(`แมตช์การกุศลสุดประทับใจ! แฟนบอล +${fmtFans(gained)} คน · ชื่อเสียง +4`);
              }}
              className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] transition-colors space-y-1"
            >
              <div className="flex items-center justify-between gap-2 font-bold text-xs mland:text-[11px]">
                <span className="truncate">⚽ แมตช์การกุศล</span>
                <span className="tabular shrink-0 text-[var(--ink)]">10k</span>
              </div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] leading-snug">แฟนบอล +5% · ชื่อเสียงกุนซือ +4 · บอร์ด +2%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 12}
              onClick={() => {
                let boostedName = '';
                let gained = 0;
                onUpdateState((d) => {
                  d.money -= 12;
                  logFin(d, 'แคมเปญโซเชียลสโมสร', -12);
                  d.fan = clamp((d.fan ?? 50) + 7, 5, 100);
                  gained = Math.max(850, Math.round(ensureTeamFans(d.teams[d.me]) * 0.045));
                  adjustTeamFans(d.teams[d.me], gained);
                  const yPool = d.teams[d.me].sq.filter((q) => q.age <= 22 && q.ov < (q.pot || 90));
                  if (yPool.length) {
                    const pick = P(yPool);
                    pick.ov++;
                    boostedName = pick.n;
                  }
                  d.clubActMd = curTurn;
                });
                onToast(
                  boostedName
                    ? `แคมเปญปัง! แฟน +${fmtFans(gained)} และ ${boostedName} มีกำลังใจพัฒนา +1 OVR!`
                    : `แคมเปญโซเชียลปังมาก! ยอดผู้ติดตามสโมสร +${fmtFans(gained)} คน`
                );
              }}
              className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] transition-colors space-y-1"
            >
              <div className="flex items-center justify-between gap-2 font-bold text-xs mland:text-[11px]">
                <span className="truncate">📱 แคมเปญโซเชียล</span>
                <span className="tabular shrink-0 text-[var(--ink)]">12k</span>
              </div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] leading-snug">ยอดผู้ติดตาม +4.5% · กระตุ้นดาวรุ่งในทีม</div>
            </button>
          </div>
        </div>
      )}

      {/* Club Tab 4: Hall of Fame & Season History */}
      {clubTab === 'legacy' && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
          <ClubHistoryPanel
            team={me}
            state={state}
            onOpenSeasonStats={onOpenSeasonStats}
            onInspectPlayer={onInspectPlayer}
          />
        </div>
      )}

      {/* Facility Demolition Confirmation Modal */}
      {demolishTarget && (() => {
        const { key, title, baseCost, minLv } = demolishTarget;
        const curLv = clamp(state[key] ?? 1, minLv, MAX_FACILITY_LV);
        const cond = getFacilityCondition(state, key);
        const stepRefund = getFacilityDemolishRefund(baseCost, curLv);
        let fullRefund = 0;
        for (let lvStep = curLv; lvStep > minLv; lvStep--) {
          fullRefund += getFacilityDemolishRefund(baseCost, lvStep);
        }
        const canFull = curLv - minLv >= 2;
        return (
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--red)]/45 shadow-2xl overflow-hidden">
              <div className="px-4 py-3 bg-[var(--red-soft)]/60 border-b border-[var(--line)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-[var(--red)] shrink-0" />
                  <h4 className="font-bold text-sm truncate">ยืนยันการรื้อถอน/ทำลายสิ่งก่อสร้าง</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setDemolishTarget(null)}
                  className="btn-icon w-7 h-7"
                  aria-label="ปิด"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]">
                  <FacilityUpgradeSvg
                    kind={key}
                    level={curLv}
                    condition={cond}
                    c1={me.kc[0]}
                    c2={me.kc[1]}
                    className="w-24 h-16"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-bold text-sm truncate">{title}</div>
                    <div className="text-xs text-[var(--mut)] tabular">
                      ระดับปัจจุบัน <b className="text-[var(--ink)]">Lv.{curLv}/{MAX_FACILITY_LV}</b> · สภาพ {cond}%
                    </div>
                    <div className="text-[11px] text-[var(--g)] font-semibold tabular">
                      รื้อถอน 1 ขั้นคืนเงินวัสดุ +{fmtMoney(stepRefund)}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--mut)] leading-relaxed">
                  การรื้อถอนจะลดระดับสิ่งก่อสร้างลงและลดโบนัสที่ได้รับจากอาคารนี้ โดยจะได้รับเงินคืนค่าวัสดุประมาณ 35–38% ของต้นทุนระดับนั้น
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDemolishTarget(null)}
                    className="btn btn-sm btn-secondary"
                  >
                    ยกเลิก
                  </button>
                  {canFull && (
                    <button
                      type="button"
                      onClick={() => demolishFac(key, title, baseCost, minLv)}
                      className="btn btn-sm btn-danger"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{minLv === 0 ? 'ทำลายทั้งหมด (Lv.0)' : `รื้อถึง Lv.${minLv}`} +{fmtMoneyNum(fullRefund)}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => demolishFac(key, title, baseCost, curLv - 1)}
                    className="btn btn-sm bg-[var(--red)] text-white border border-red-400/30 hover:brightness-110"
                  >
                    <Hammer className="w-3.5 h-3.5" />
                    <span>รื้อถอนเหลือ Lv.{curLv - 1} (+{fmtMoneyNum(stepRefund)})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

