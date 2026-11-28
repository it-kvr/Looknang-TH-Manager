import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BatteryLow,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  FileText,
  Handshake,
  Heart,
  HeartPulse,
  Landmark,
  Mail,
  Megaphone,
  MessageSquare,
  Mic,
  Newspaper,
  Search,
  Sparkles,
  Trophy,
  Users,
  X
} from 'lucide-react';
import type { ArchivedMatchReport, MainTab, MatchHighlightClip, Player, Team, GameState, VarReplayRecord } from '../types/game';
import { RN, TN, CONFED_META, getForeignTeamCountryMeta, getTeamTrainingPlan, syncTrainingFocusToPlan, type ForeignConfed } from '../data/thaiFootballData';
import {
  DOMESTIC_LEAGUE_SPECS,
  T3_ZONE_NAMES,
  WORLD_LEAGUE_SPECS,
  getRankZoneBadge,
  getSeasonCalendarMds,
  getT3ZoneLabel,
  getTeamLeagueName,
  getWorldLeagueSpec
} from '../data/leagueStructures';
import { SFX } from '../utils/audioTheme';
import { fmtMoney, fmtMoneyNum } from '../utils/math';
import { EffectText } from '../components/DeltaText';
import { xi, vlu, ensureCon, logFin } from '../engine/playerCore';
import { ovTextColorClass } from '../engine/missions';
import {
  sortTable,
  getTransferWindowInfo,
  teamStats,
  getIncomingOffers,
  getActiveBoardEffects,
  getBoardDirectiveProgress,
  EXTRA_CUP_META,
  getLeaguePrizeMoney,
  getActivePartnerDeals,
  getLeagueTransferContext,
  getFacilityCondition,
  getFacilityRenovateCost,
  getFacilityUpgradeCost,
  getActiveClubDemands,
  checkClubDemandsCompletion
} from '../engine/simulation';
import {
  getActiveFavBoost,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getTeamCareQuotaInfo,
  getTeamFavoritePlayers,
  isTeamFavoritePlayer
} from '../engine/wellbeing';
import type { FacilityKey } from '../types/game';
import { getLeagueLogoUrl, getWorldLeagueDisplay } from '../engine/mods';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { PositionBadge } from '../components/PositionBadge';
import { StatIconBadge } from '../components/StatIconBadge';
import { MyTeamBadge } from '../components/MyTeamBadge';
import { OvrBadge } from '../components/OvrBadge';
import { WdlFormStrip, WdlRecordBadges, getWdlDotClass, type WdlKind } from '../components/WdlBadge';
import { CupView } from './CupView';
import { RankingHubView } from '../components/RankingHubView';

export const LeagueView = React.memo<{
  state: GameState;
  onInspectTeam: (teamId: number) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onShallowPatch?: (patcher: (prev: GameState) => Partial<GameState>) => void;
  onNavigate?: (tab: MainTab, sub?: string, focus?: string, hint?: string) => void;
  onOpenSeasonStats?: (season?: number) => void;
  onOpenVarReplay?: (homeId: number, awayId: number, records: VarReplayRecord[]) => void;
  onOpenHighlights?: (homeId: number, awayId: number, clips: MatchHighlightClip[], title?: string, scoreSummary?: string) => void;
  onOpenMatchReport?: (report: ArchivedMatchReport, title?: string) => void;
  onOpenDilemma?: () => void;
  onToast?: (msg: string) => void;
}>(({ state, onInspectTeam, onInspectPlayer, onUpdateState, onShallowPatch, onNavigate, onOpenSeasonStats, onOpenVarReplay, onOpenHighlights, onOpenMatchReport, onOpenDilemma, onToast }) => {
  const me = state.teams[state.me];
  const myLeagueName = useMemo(() => getTeamLeagueName(me, { includeZone: true, withFlag: true }), [me]);
  const vt = state.lg ?? me.tier;
  const rawSub = state.v === 'c' ? 4 : (state.tv ?? 0);
  const sub = rawSub === 5 ? 2 : rawSub;
  const [newsFilter, setNewsFilter] = useState<'all' | 'staff' | 'club' | 'feed'>('all');
  const [prizeModalTier, setPrizeModalTier] = useState<number | null>(null);
  const [cupInitialStats, setCupInitialStats] = useState(false);
  const [t3Zone, setT3Zone] = useState<0 | 1>(() => (me.zone === 1 ? 1 : 0));
  const [worldViewMode, setWorldViewMode] = useState<'table' | 'scout'>('table');
  const [worldConfed, setWorldConfed] = useState<'all' | ForeignConfed>('all');
  const [worldCountry, setWorldCountry] = useState<string>('ALL');
  const [worldLeagueCode, setWorldLeagueCode] = useState<string>(() =>
    me.tier >= 3 && me.leagueCode ? me.leagueCode : (WORLD_LEAGUE_SPECS[0]?.code || 'GB')
  );

  useEffect(() => {
    if (me.tier >= 3 && me.leagueCode) {
      setWorldLeagueCode(me.leagueCode);
      setWorldConfed('all');
      setWorldViewMode('table');
    } else if (me.tier === 0) {
      setT3Zone(me.zone === 1 ? 1 : 0);
    }
  }, [me.id, me.tier, me.leagueCode, me.zone]);

  const tb = useMemo(
    () =>
      sortTable(
        state.teams.filter((t) => {
          if (vt >= 3) {
            return t.tier >= 3 && (!me.leagueCode || t.leagueCode === me.leagueCode);
          }
          return t.tier === vt && (vt !== 0 || (t.zone ?? 0) === t3Zone);
        })
      ),
    [state.teams, vt, t3Zone, me.leagueCode]
  );
  const myLeaguePos = useMemo(() => {
    const idx = tb.findIndex((t) => t.id === state.me);
    return idx >= 0 ? idx + 1 : null;
  }, [tb, state.me]);
  const ms = useMemo(() => teamStats(me, state), [me, state]);

  const nextMatchResolved = useMemo(() => {
    type NextKind = 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc' | 'po';

    const findCupPair = (
      cupObj: GameState['cup'] | undefined,
      flag: boolean | undefined,
      targetKind: NextKind
    ): { kind: NextKind; homeId: number; awayId: number; isDerby: boolean } | null => {
      if (!flag || !cupObj || !cupObj.alive || cupObj.done) return null;
      const idx = cupObj.ids.indexOf(state.me);
      if (idx < 0) return null;
      const pairIdx = Math.floor(idx / 2) * 2;
      return { kind: targetKind, homeId: cupObj.ids[pairIdx], awayId: cupObj.ids[pairIdx + 1], isDerby: false };
    };

    return (
      findCupPair(state.ac, state.pa, 'asia') ||
      findCupPair(state.sc, state.psc, 'sc') ||
      findCupPair(state.lc, state.plc, 'lc') ||
      findCupPair(state.dc, state.pdc, 'dc') ||
      findCupPair(state.cup, state.pc, 'cup') ||
      (state.ppo && state.po?.userPair
        ? {
            kind: 'po' as NextKind,
            homeId: state.po.userPair.homeId,
            awayId: state.po.userPair.awayId,
            isDerby: false
          }
        : null) ||
      (() => {
        if (state.md < state.fx.length) {
          const pair = state.fx[state.md].find((p) => p.includes(state.me));
          if (pair) {
            return { kind: 'league' as NextKind, homeId: pair[0], awayId: pair[1], isDerby: (pair[0] ^ 1) === pair[1] };
          }
        }
        return { kind: 'league' as NextKind, homeId: -1, awayId: -1, isDerby: false };
      })()
    );
  }, [state.ac, state.pa, state.sc, state.psc, state.lc, state.plc, state.dc, state.pdc, state.cup, state.pc, state.ppo, state.po, state.md, state.fx, state.me]);

  const nextMatchOppStats = useMemo(() => {
    const { homeId, awayId } = nextMatchResolved;
    if (homeId < 0 || awayId < 0) return null;
    const oppId = homeId === state.me ? awayId : homeId;
    const oppTeam = state.teams[oppId];
    return oppTeam ? teamStats(oppTeam, state) : null;
  }, [nextMatchResolved, state]);

  const renderFormDots = (fm?: string) => {
    const chars = (fm || '')
      .slice(-5)
      .split('')
      .filter((c): c is WdlKind => c === 'W' || c === 'D' || c === 'L');
    if (!chars.length) return <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">—</span>;
    const thaiForm = chars.map((c) => (c === 'W' ? 'ชนะ' : c === 'D' ? 'เสมอ' : 'แพ้')).join(' · ');
    return (
      <div
        className="flex items-center justify-center gap-[2px] sm:gap-0.5 mland:gap-[2px]"
        title={`ฟอร์ม 5 นัดหลัง: ${thaiForm}`}
      >
        {chars.map((c, idx) => (
          <span
            key={idx}
            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 mland:w-1.5 mland:h-1.5 rounded-full shrink-0 ${getWdlDotClass(c)}`}
          />
        ))}
      </div>
    );
  };

  const renderNextMatchCard = () => {
    const { kind, homeId, awayId, isDerby } = nextMatchResolved;

    if (homeId < 0 || awayId < 0 || !state.teams[homeId] || !state.teams[awayId]) {
      return (
        <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 text-center space-y-1">
          <div className="font-bold text-xs sm:text-sm mland:text-[11px] text-[#7a4f00] dark:text-[var(--lamp)]">
            🏁 จบโปรแกรมลีกฤดูกาลที่ {state.season} แล้ว
          </div>
          <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">
            กดปุ่ม &ldquo;สรุปจบฤดูกาล&rdquo; ด้านขวาบนเพื่อรับรางวัลและขึ้นฤดูกาลใหม่
          </p>
        </div>
      );
    }

    const H = state.teams[homeId];
    const A = state.teams[awayId];
    const oppId = homeId === state.me ? awayId : homeId;
    const oppTeam = state.teams[oppId];
    const oppSt = nextMatchOppStats || teamStats(oppTeam, state);
    const isHome = homeId === state.me;
    const compLabel =
      kind === 'asia'
        ? `🌏 นัดหน้า · ถ้วยทวีป ${state.ac ? RN[state.ac.r] || `รอบ ${state.ac.r + 1}` : ''}`
        : kind === 'sc'
          ? `${EXTRA_CUP_META.sc.icon} นัดหน้า · ${EXTRA_CUP_META.sc.name} (นัดชิง)`
          : kind === 'lc'
            ? `${EXTRA_CUP_META.lc.icon} นัดหน้า · ${EXTRA_CUP_META.lc.name} ${state.lc ? RN[state.lc.r] || `รอบ ${state.lc.r + 1}` : ''}`
            : kind === 'dc'
              ? `${EXTRA_CUP_META.dc.icon} นัดหน้า · ${EXTRA_CUP_META.dc.name} ${state.dc ? RN[state.dc.r] || `รอบ ${state.dc.r + 1}` : ''}`
              : kind === 'cup'
                ? `🏆 นัดหน้า · ถ้วยประชาชน ${RN[state.cup.r] || `รอบ ${state.cup.r + 1}`}`
                : kind === 'po'
                  ? `🔥 นัดหน้า · ${state.po?.userPair?.label || 'รอบเพลย์ออฟ'}`
                  : `⚽ นัดหน้า · นัดที่ ${state.md + 1}/${state.fx.length} (${isHome ? 'เกมเหย้า' : 'เกมเยือน'})`;

    return (
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-2.5 mland:space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9.5px]">
          <span className="font-bold text-[var(--g)] truncate">{compLabel}</span>
          {isDerby && <span className="font-bold text-[var(--red)] shrink-0">🔥 ดาร์บี้แมตช์</span>}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mland:gap-1.5 py-1 mland:py-0.5 px-2 rounded-xl bg-[var(--surface-2)]/70">
          <button
            type="button"
            onClick={() => { SFX.tap(); onInspectTeam(H.id); }}
            className="flex flex-col items-center gap-1 min-w-0 cursor-pointer group"
          >
            <div className="mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <ClubCrest name={H.name} size={32} team={H} club={state.club} isMyClub={H.id === state.me && state.mode === 'm'} />
            </div>
            <span className={`text-[11px] mland:text-[9.5px] text-center truncate max-w-full leading-tight group-hover:text-[var(--g)] ${H.id === state.me ? 'font-bold text-[var(--ink)]' : 'font-semibold text-[var(--mut)]'}`}>
              {H.name}
            </span>
          </button>

          <div className="text-center px-1 shrink-0">
            <div className="text-xs mland:text-[10px] font-black text-[var(--mut)] tracking-wider">VS</div>
            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5 font-display font-black">
              <span className="text-[var(--g)]">XI</span>{' '}
              <span className={ovTextColorClass(ms.ovXi)}>{ms.ovXi}</span>
              <span className="text-[var(--mut)] font-bold mx-0.5">:</span>
              <span className={ovTextColorClass(oppSt.ovXi)}>{oppSt.ovXi}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { SFX.tap(); onInspectTeam(A.id); }}
            className="flex flex-col items-center gap-1 min-w-0 cursor-pointer group"
          >
            <div className="mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <ClubCrest name={A.name} size={32} team={A} club={state.club} isMyClub={A.id === state.me && state.mode === 'm'} />
            </div>
            <span className={`text-[11px] mland:text-[9.5px] text-center truncate max-w-full leading-tight group-hover:text-[var(--g)] ${A.id === state.me ? 'font-bold text-[var(--ink)]' : 'font-semibold text-[var(--mut)]'}`}>
              {A.name}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => { SFX.tap(); onInspectTeam(oppId); }}
            className="btn btn-sm btn-secondary w-full"
          >
            🔍 ส่องคู่แข่ง
          </button>
          <button
            type="button"
            onClick={() => { SFX.tap(); onNavigate?.('q'); }}
            className="btn btn-sm btn-primary w-full"
          >
            {state.mode === 'm' ? '⚽ จัดทัพ 11 ตัวจริง' : '⚽ ดูแผน & รายชื่อทีม'}
          </button>
        </div>
      </div>
    );
  };

  const renderImportantNewsPanel = () => {
    type NewsTone = 'urg' | 'warn' | 'ok' | 'info';
    interface InboxItem {
      id: string;
      kind: 'alert' | 'req' | 'feed';
      group: 'staff' | 'club' | 'feed';
      tone: NewsTone;
      icon: React.ReactNode;
      sender: string;
      tag: string;
      title: React.ReactNode;
      detail: string;
      urgent?: boolean;
      actionLabel?: string;
      onAction?: () => void;
    }

    const items: InboxItem[] = [];
    const isMgr = state.mode === 'm';

    if (isMgr) {
      const starters = xi(me);
      const unreadyXi = starters.filter((q) => (q.inj || 0) > 0 || (q.sus || 0) > 0);
      const avgXiFit = Math.round(starters.reduce((sum, q) => sum + (q.fit ?? 100), 0) / Math.max(1, starters.length));
      const tiredStarters = starters.filter((q) => (q.fit ?? 100) < 74);
      const lowFitAll = me.sq.filter((q) => !q.inj && (q.fit ?? 100) < 62);
      const injuredList = me.sq.filter((q) => q.inj > 0);
      const ownPlayers = me.sq.filter((q) => !q.loan);
      const expiredCon = ownPlayers.filter((q) => ensureCon(q).yr <= 0);
      const expiringSoon = ownPlayers.filter((q) => ensureCon(q).yr === 1);
      const incomingOffers = getIncomingOffers(state);
      const curPlan = getTeamTrainingPlan(state);
      const tx = getLeagueTransferContext(state, me);
      const activeDeals = getActivePartnerDeals(state);
      const careQuota = getTeamCareQuotaInfo(state, me);
      const favList = getTeamFavoritePlayers(me);
      const unboostedFavs = favList.filter((fp) => getActiveFavBoost(fp, me, fp.me ? state.p : null) === 0);
      const avgMental = Math.round(
        me.sq.reduce((sum, q) => sum + getPlayerMentalScore(q, q.me ? state.p : null), 0) / Math.max(1, me.sq.length)
      );

      if (state.dilemma) {
        const dilemmaObj = state.dilemma;
        const isPressDilemma = Boolean(
          dilemmaObj.isPress || dilemmaObj.id === 'media_interview' || dilemmaObj.id.startsWith('press_')
        );
        const matchedBenchPlayer =
          dilemmaObj.id === 'bench_unhappy'
            ? me.sq.find((q) => dilemmaObj.desc.startsWith(q.n))?.n
            : undefined;
        const dilemmaSender =
          dilemmaObj.speaker ||
          (dilemmaObj.id === 'bench_unhappy'
            ? `${matchedBenchPlayer || 'นักเตะสำรอง'}`
            : dilemmaObj.id === 'local_sponsor'
              ? 'สปอนเซอร์ท้องถิ่น'
              : dilemmaObj.id === 'youth_trial'
                ? 'แมวมองท้องถิ่น'
                : isPressDilemma
                  ? 'ผู้สื่อข่าวกีฬา'
                  : dilemmaObj.category);
        items.push({
          id: 'active-dilemma',
          kind: 'alert',
          group: dilemmaObj.id === 'youth_trial' ? 'staff' : 'club',
          tone: 'urg',
          urgent: true,
          icon: isPressDilemma
            ? <Mic className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />
            : <Mail className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: dilemmaSender,
          tag: dilemmaObj.outlet || dilemmaObj.category,
          title: dilemmaObj.title,
          detail: isPressDilemma ? 'รอให้สัมภาษณ์' : 'รอเปิดอ่านและตัดสินใจ',
          actionLabel: isPressDilemma ? 'ให้สัมภาษณ์' : 'เปิดดู',
          onAction: () => {
            SFX.tap();
            onOpenDilemma?.();
          }
        });
      }

      if (state.money < 0 || (state.bd ?? 55) < 40) {
        const isMoneyNeg = state.money < 0;
        items.push({
          id: 'club-alert-fin-bd',
          kind: 'alert',
          group: 'club',
          tone: 'urg',
          urgent: true,
          icon: <AlertTriangle className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: isMoneyNeg ? 'ฝ่ายการเงิน' : 'บอร์ดบริหาร',
          tag: isMoneyNeg ? 'การเงิน' : 'บอร์ดบริหาร',
          title: isMoneyNeg ? `งบติดลบ ${fmtMoney(state.money)}` : `บอร์ดกังวล (${Math.round(state.bd ?? 55)}%)`,
          detail: isMoneyNeg ? 'ตลาดถูกระงับชั่วคราว' : 'เร่งเก็บแต้มเรียกความเชื่อมั่น',
          actionLabel: isMoneyNeg ? 'ดูการเงิน' : 'ดูบอร์ด',
          onAction: () =>
            isMoneyNeg
              ? onNavigate?.('f', 'overview', 'fin-cashflow', 'ตรวจดูสมดุลรายรับ-รายจ่าย และหาทุนเพิ่มหรือลดรายจ่ายเพื่อพ้นตัวแดง')
              : onNavigate?.('u', 'info', 'board-directive', 'ตรวจดูความเชื่อมั่นบอร์ดและเป้าหมายซีซั่นในกรอบที่ไฮไลต์')
        });
      }

      if (unreadyXi.length > 0) {
        const unreadyNames = unreadyXi.slice(0, 2).map((q) => q.n.split(' ')[0]).join(', ');
        items.push({
          id: 'xi-unready',
          kind: 'alert',
          group: 'staff',
          tone: 'urg',
          urgent: true,
          icon: <Users className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'ผู้ช่วยโค้ช',
          tag: 'จัดทัพ',
          title: `ตัวจริงไม่พร้อม ${unreadyXi.length} คน`,
          detail: unreadyXi
            .slice(0, 2)
            .map((q) => `${q.n.split(' ')[0]} (${q.inj > 0 ? 'เจ็บ' : 'แบน'})`)
            .join(', '),
          actionLabel: 'จัดทัพ',
          onAction: () =>
            onNavigate?.(
              'q',
              undefined,
              'xi-unready',
              `เปลี่ยนตัวจริงที่เจ็บ/แบน (${unreadyNames}) ออก — กด "⚡ สลับตัวพร้อมลง" ที่แถบแจ้งเตือนหรือลากสลับกับตัวสำรอง`
            )
        });
      }

      // Player & Fan Demands (คำเรียกร้องจากนักเตะ & แฟนบอล)
      const facBaseCostMap: Record<FacilityKey, number> = {
        st: 100,
        tr: 90,
        ya: 80,
        med: 80,
        merchLv: 75,
        turfLv: 75,
        analyticsLv: 85,
        travelLv: 70
      };
      const activeDemands = getActiveClubDemands(state);
      activeDemands.forEach((req) => {
        const remMd = Math.max(0, req.dueMd - (state.md ?? 0));
        const srcBadge = req.source === 'player' ? 'นักเตะขอ' : 'แฟนบอลขอ';
        let actionLabel = 'จัดการ';
        let detailText = `รางวัล: ${req.rewardText}`;
        let onAction = () => onNavigate?.('u', 'infra');

        if (req.kind === 'renovate_fac') {
          const fk = req.targetKey as FacilityKey;
          const lv = state[fk] ?? 1;
          const cond = getFacilityCondition(state, fk);
          const baseCost = facBaseCostMap[fk] ?? 80;
          const renCost = lv > 0 ? getFacilityRenovateCost(baseCost, lv, cond) : 0;
          if (lv > 0 && state.money >= renCost) {
            actionLabel = `ซ่อม ${fmtMoneyNum(renCost)}`;
            onAction = () => {
              let done: string[] = [];
              let paidCost = 0;
              onUpdateState((d) => {
                const curLv = d[fk] ?? 1;
                const curCond = getFacilityCondition(d, fk);
                const costNow = getFacilityRenovateCost(baseCost, curLv, curCond);
                if (curLv <= 0 || d.money < costNow) return;
                d.money -= costNow;
                paidCost = costNow;
                d.facCond = { ...(d.facCond || {}), [fk]: 100 };
                logFin(d, `ซ่อมบำรุงตามคำเรียกร้อง (${curCond}% → 100%)`, -costNow);
                done = checkClubDemandsCompletion(d);
              });
              const costTag = paidCost > 0 ? ` (-${fmtMoney(paidCost)})` : '';
              onToast?.(done.length ? `✅ ซ่อมบำรุงสำเร็จ!${costTag}` : `🔧 ปรับปรุงสภาพเรียบร้อยแล้ว${costTag}`);
            };
          } else {
            actionLabel = 'ไปซ่อม';
            onAction = () =>
              onNavigate?.(
                'u',
                'infra',
                `fac:${fk}`,
                `กดปุ่ม "🔧 ซ่อม" ที่การ์ดที่ไฮไลต์ด้านซ้าย (${req.title})`
              );
          }
        } else if (req.kind === 'upgrade_fac') {
          const fk = req.targetKey as FacilityKey;
          const lv = state[fk] ?? 1;
          const upgCost = getFacilityUpgradeCost(facBaseCostMap[fk] ?? 80, lv);
          detailText = `ค่าใช้จ่าย -${fmtMoneyNum(upgCost)} · ${req.rewardText}`;
          actionLabel = 'อัปเกรด';
          onAction = () =>
            onNavigate?.(
              'u',
              'infra',
              `fac:${fk}`,
              `กดปุ่ม "อัปเกรด" ที่การ์ดสิ่งอำนวยความสะดวกที่ไฮไลต์ด้านซ้าย (${req.title})`
            );
        } else if (req.kind === 'hire_staff') {
          actionLabel = 'จ้างทีมงาน';
          onAction = () =>
            onNavigate?.(
              'u',
              'infra',
              `staff:${req.targetKey}`,
              `กดปุ่ม "จ้าง / อัป" ที่การ์ดทีมงานสตาฟฟ์ที่ไฮไลต์ฝั่งขวา (${req.title})`
            );
        } else if (req.kind === 'ticket_price') {
          actionLabel = 'ปรับตั๋ว';
          onAction = () => {
            let done: string[] = [];
            onUpdateState((d) => {
              d.ticketPlan = 'standard';
              d.tp = 1;
              done = checkClubDemandsCompletion(d);
            });
            onToast?.(done.length ? '✅ ปรับราคาตั๋วมาตรฐานแล้ว!' : 'ปรับราคาตั๋วเรียบร้อย');
          };
        } else if (req.kind === 'live_stream') {
          actionLabel = 'เปิดสตรีม';
          onAction = () =>
            onNavigate?.(
              'f',
              'commercial',
              'stream',
              'เลือกแพ็กเกจถ่ายทอดสดที่ต้องการในกรอบที่ไฮไลต์ แล้วกด "💾 บันทึกการเปลี่ยนแปลง"'
            );
        } else if (req.kind === 'megastore_stock') {
          actionLabel = 'เติมร้าน';
          onAction = () =>
            onNavigate?.(
              'f',
              'megastore',
              'megastore-stock',
              'กด "+ทุน 25k" / "+พอดี 4 นัด" หรือเปิด "เติมอัตโนมัติ" ในกรอบที่ไฮไลต์'
            );
        }

        items.push({
          id: `demand-${req.id}`,
          kind: 'req',
          group: 'club',
          tone: remMd <= 1 ? 'urg' : 'warn',
          urgent: true,
          icon:
            req.source === 'player'
              ? <MessageSquare className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />
              : <Megaphone className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: req.source === 'player' ? (me.cap ? `${me.cap.split(' ')[0]} (กัปตัน)` : 'ตัวแทนนักเตะ') : 'ตัวแทนแฟนบอล',
          tag: `อีก ${remMd} นัด`,
          title: req.title,
          detail: detailText,
          actionLabel,
          onAction
        });
      });

      if (state.boardDirective && state.boardDirective.status === 'active') {
        const dir = state.boardDirective;
        const prog = getBoardDirectiveProgress(state, dir);
        const remMd = Math.max(0, dir.dueMd - (state.md ?? 0));
        items.push({
          id: 'board-directive-active',
          kind: 'alert',
          group: 'club',
          tone: prog.isComplete ? 'ok' : remMd <= 1 ? 'urg' : 'warn',
          urgent: true,
          icon: <ClipboardList className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'ประธานสโมสร',
          tag: `อีก ${remMd} นัด`,
          title: dir.title,
          detail: `${prog.progressText} (${Math.round(prog.ratio * 100)}%)`,
          actionLabel: 'ดูเป้า',
          onAction: () =>
            onNavigate?.(
              'u',
              'info',
              'board-directive',
              `ตรวจดูความคืบหน้าและกำหนดส่งคำสั่งบอร์ดในกรอบที่ไฮไลต์ (${dir.title})`
            )
        });
      } else {
        const activeBoardFx = getActiveBoardEffects(state);
        if (activeBoardFx.length > 0) {
          const topFx = activeBoardFx[0];
          items.push({
            id: 'board-effect-active',
            kind: 'alert',
            group: 'club',
            tone: topFx.tone === 'bonus' ? 'ok' : 'urg',
            urgent: false,
            icon:
              topFx.tone === 'bonus'
                ? <Sparkles className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />
                : <AlertTriangle className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
            sender: 'บอร์ดบริหาร',
            tag: 'ผลบอร์ด',
            title: topFx.label,
            detail: `อีก ${Math.max(1, topFx.expiresMd - (state.md ?? 0))} นัด`,
            actionLabel: 'ดูบอร์ด',
            onAction: () =>
              onNavigate?.('u', 'info', 'board-directive', 'ตรวจดูสถานะบอร์ดและผลกระทบปัจจุบันในกรอบที่ไฮไลต์')
          });
        }
      }

      if (incomingOffers.length > 0) {
        const topOff = incomingOffers[0];
        const isLoan = topOff.kind === 'loan' || topOff.kind === 'loanopt';
        items.push({
          id: 'transfer-offers',
          kind: 'alert',
          group: 'club',
          tone: 'warn',
          urgent: true,
          icon:
            isLoan
              ? <ArrowLeftRight className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />
              : <Briefcase className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: incomingOffers.length > 1 ? `${topOff.t} (+${incomingOffers.length - 1})` : topOff.t,
          tag: 'ซื้อ-ยืม',
          title: `${incomingOffers.length} ข้อเสนอรอตอบ`,
          detail: `${isLoan ? 'ขอยืม' : 'ขอซื้อ'} ${topOff.n} (+${fmtMoney(topOff.p)})`,
          actionLabel: 'เปิดดู',
          onAction: () =>
            onNavigate?.(
              'k',
              'sell',
              'incoming-offers',
              'กด "ขาย / ยอมรับ", "ต่อรองราคา" หรือ "ปฏิเสธ" ที่ข้อเสนอฝั่งซ้าย'
            )
        });
      }

      if (state.scout?.results) {
        items.push({
          id: 'scout-ready',
          kind: 'alert',
          group: 'staff',
          tone: 'ok',
          urgent: true,
          icon: <Search className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'หัวหน้าแมวมอง',
          tag: 'แมวมอง',
          title: `พบนักเตะ ${state.scout.results.length} ราย`,
          detail: state.scout.label,
          actionLabel: 'ดูรายชื่อ',
          onAction: () =>
            onNavigate?.(
              'k',
              'scout',
              'scout-report',
              'เลือกนักเตะจากรายงานฝั่งขวาเพื่อยื่นซื้อ/ยืมตัว หรือกดดาว ★ เก็บลงลิสต์'
            )
        });
      }

      if (expiredCon.length > 0 || expiringSoon.length > 0) {
        const namesPreview = [...expiredCon, ...expiringSoon].slice(0, 2).map((q) => q.n.split(' ')[0]).join(', ');
        const totalNeed = expiredCon.length + expiringSoon.length;
        items.push({
          id: 'contracts-expiring',
          kind: 'alert',
          group: 'club',
          tone: expiredCon.length > 0 ? 'urg' : 'warn',
          urgent: true,
          icon: <FileText className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'เลขาฯ สโมสร & เอเย่นต์',
          tag: 'สัญญา',
          title: expiredCon.length > 0 ? `หมดสัญญา ${expiredCon.length} คน` : `สัญญาเหลือ 1 ปี (${expiringSoon.length} คน)`,
          detail: `${namesPreview}${totalNeed > 2 ? ` +${totalNeed - 2}` : ''}`,
          actionLabel: 'ต่อสัญญา',
          onAction: () =>
            onNavigate?.(
              'k',
              'con',
              'contracts-expiring',
              'กรองเฉพาะ "ใกล้หมด" ไว้ให้แล้ว — กดปุ่ม "ต่อสัญญา" ที่นักเตะแต่ละคน'
            )
        });
      }

      const needRest = (tiredStarters.length > 0 || lowFitAll.length > 0 || avgXiFit < 76) && curPlan.program !== 'recovery';
      if (needRest) {
        items.push({
          id: 'rest-needed',
          kind: 'alert',
          group: 'staff',
          tone: avgXiFit < 68 || lowFitAll.length >= 3 ? 'urg' : 'warn',
          urgent: true,
          icon: <BatteryLow className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'โค้ชฟิตเนส',
          tag: 'ความฟิต',
          title: `ตัวจริงล้า (ฟิต ${avgXiFit}%)`,
          detail: `ล้า ${tiredStarters.length} คน · แนะนำพักฟื้น`,
          actionLabel: 'พักฟื้น',
          onAction: () => {
            SFX.tap();
            onUpdateState((d) => { syncTrainingFocusToPlan(d, 'F'); });
            onToast?.('สลับซ้อมเป็น "😴 พักผ่อน & ฟื้นฟู" แล้ว');
          }
        });
      }

      if (injuredList.length > 0) {
        items.push({
          id: 'club-injured-rehab',
          kind: 'alert',
          group: 'staff',
          tone: 'urg',
          urgent: true,
          icon: <HeartPulse className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'หัวหน้าทีมแพทย์',
          tag: 'พยาบาล',
          title: `บาดเจ็บ ${injuredList.length} คน`,
          detail: injuredList.slice(0, 2).map((q) => `${q.n.split(' ')[0]} (${q.inj} นัด)`).join(', '),
          actionLabel: 'ฟื้นฟู',
          onAction: () =>
            onNavigate?.(
              'r',
              'program',
              'rehab',
              'กด "✚ กายภาพกลุ่ม" ในกรอบที่ไฮไลต์ฝั่งซ้าย หรือกด "😴 พัก" ที่คนเจ็บฝั่งขวา'
            )
        });
      }

      if (unboostedFavs.length > 0 && careQuota.remaining > 0) {
        const favPl = unboostedFavs[0];
        const fm = getPlayerMentalScore(favPl, favPl.me ? state.p : null);
        const fp = getPlayerPhysScore(favPl, favPl.me ? state.p : null);
        const favShort = favPl.n.split(' ')[0];
        items.push({
          id: 'fav-needs-care',
          kind: 'alert',
          group: 'staff',
          tone: 'warn',
          urgent: true,
          icon: <Heart className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'ผู้ช่วยโค้ช',
          tag: 'ปลุกพลัง',
          title:
            unboostedFavs.length === 1
              ? `ลูกรักรอปลุกพลัง (${favShort})`
              : `ลูกรักรอปลุกพลัง ${unboostedFavs.length} คน (${favShort})`,
          detail: `ใจ ${fm} · กาย ${fp} (ต้อง ≥72)`,
          actionLabel: 'เข้าออฟฟิศ',
          onAction: () =>
            onNavigate?.(
              'r',
              'rooms',
              `talk:${favPl.n}`,
              `คุยส่วนตัวหรือส่งกายภาพให้ ${favPl.n} ในห้องออฟฟิศ (ทำ ใจ≥72 และ กาย≥72)`
            )
        });
      } else if (avgMental < 60 && careQuota.remaining > 0) {
        items.push({
          id: 'team-morale-low',
          kind: 'alert',
          group: 'staff',
          tone: 'warn',
          urgent: true,
          icon: <Users className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: me.cap ? `${me.cap.split(' ')[0]} (กัปตัน)` : 'ผู้ช่วยโค้ช',
          tag: 'ขวัญทีม',
          title: `ขวัญทีมต่ำ (${avgMental}/100)`,
          detail: `เหลือโควตาออฟฟิศ ${careQuota.remaining}/${careQuota.limit} ครั้ง`,
          actionLabel: 'ประชุมทีม',
          onAction: () =>
            onNavigate?.(
              'r',
              'rooms',
              'team-talk',
              'เลือกวาระประชุมรวมใน "ห้องประชุมทีม" เพื่อปลุกขวัญทั้งสโมสร'
            )
        });
      }

      const expiringDeal = activeDeals.find((d) => d.left <= 2);
      if (expiringDeal) {
        items.push({
          id: `sponsor-expiring-${expiringDeal.id}`,
          kind: 'alert',
          group: 'club',
          tone: 'warn',
          urgent: true,
          icon: <Handshake className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'ฝ่ายการตลาด',
          tag: 'พาร์ทเนอร์',
          title: `ดีล ${expiringDeal.name} เหลือ ${expiringDeal.left} นัด`,
          detail: 'ใกล้ครบสัญญา เตรียมเลือกดีลใหม่',
          actionLabel: 'ดูดีล',
          onAction: () =>
            onNavigate?.(
              'f',
              'commercial',
              'partner-deals',
              `ตรวจสอบดีล ${expiringDeal.name} และเลือกเซ็นดีลใหม่ในกรอบที่ไฮไลต์`
            )
        });
      }

      const bankRemain = state.bankLoan ? state.bankLoan.left * state.bankLoan.per : 0;
      const payDue = state.payDue || 0;
      if (payDue > 0 || (state.bankLoan && state.money < state.bankLoan.per * 2)) {
        items.push({
          id: 'fin-debt-watch',
          kind: 'alert',
          group: 'club',
          tone: payDue > 0 ? 'warn' : 'urg',
          urgent: true,
          icon: <Landmark className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'ฝ่ายการเงิน',
          tag: 'ภาระหนี้',
          title: `หนี้คงค้าง ${fmtMoney(bankRemain + payDue)}`,
          detail: payDue > 0 ? `ผ่อนปลายปี ${fmtMoneyNum(payDue)}` : 'ค่างวดใกล้ถึงกำหนด',
          actionLabel: 'ดูหนี้',
          onAction: () =>
            onNavigate?.(
              'f',
              'ledger',
              'bank-loan',
              'กด "จ่าย 1 งวด" หรือ "โปะปิดทั้งหมด" ในกรอบธนาคารที่ไฮไลต์'
            )
        });
      }

      if (tx.wagePct >= 95) {
        items.push({
          id: 'fin-ffp-wage',
          kind: 'alert',
          group: 'club',
          tone: 'urg',
          urgent: true,
          icon: <Coins className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'ฝ่ายบัญชี & FFP',
          tag: 'ค่าเหนื่อย',
          title: `ค่าเหนื่อยใกล้เต็ม (${tx.wagePct}%)`,
          detail: `${fmtMoneyNum(tx.curWage)} / ${fmtMoneyNum(tx.wageCap)}`,
          actionLabel: 'ดูงบ',
          onAction: () =>
            onNavigate?.(
              'f',
              'overview',
              'ffp-wage',
              'ตรวจเพดานค่าเหนื่อย (FFP) ในกรอบที่ไฮไลต์ — ปล่อยยืมหรือขายนักเตะเพื่อลดภาระค่าเหนื่อย'
            )
        });
      }
    } else if (state.p) {
      const p = state.p;
      const mePl = me.sq.find((q) => q.me || q.n === p.name) || null;
      if (state.dilemma) {
        const dilemmaObj = state.dilemma;
        const isPressDilemma = Boolean(
          dilemmaObj.isPress || dilemmaObj.id === 'media_interview' || dilemmaObj.id.startsWith('press_')
        );
        const dilemmaSender =
          dilemmaObj.speaker ||
          (isPressDilemma
            ? 'ผู้สื่อข่าวกีฬา'
            : dilemmaObj.id === 'player_charity'
              ? 'โรงเรียนท้องถิ่น'
              : dilemmaObj.category);
        items.push({
          id: 'active-dilemma',
          kind: 'alert',
          group: 'club',
          tone: 'urg',
          urgent: true,
          icon: isPressDilemma
            ? <Mic className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />
            : <Mail className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: dilemmaSender,
          tag: dilemmaObj.outlet || dilemmaObj.category,
          title: dilemmaObj.title,
          detail: isPressDilemma ? 'รอให้สัมภาษณ์' : 'รอเปิดอ่านและตัดสินใจ',
          actionLabel: isPressDilemma ? 'ให้สัมภาษณ์' : 'เปิดดู',
          onAction: () => {
            SFX.tap();
            onOpenDilemma?.();
          }
        });
      }
      if ((p.en ?? 100) < 70 && (p.plan ?? 1) !== 3) {
        items.push({
          id: 'player-rest-warn',
          kind: 'alert',
          group: 'staff',
          tone: p.en < 52 ? 'urg' : 'warn',
          urgent: true,
          icon: <BatteryLow className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'โค้ชฟิตเนส',
          tag: 'ความฟิต',
          title: `ความฟิตเหลือ ${p.en}%`,
          detail: 'ต่ำกว่า 58% เสี่ยงหลุดตัวจริง',
          actionLabel: 'ตั้งพักผ่อน',
          onAction: () => {
            SFX.tap();
            onUpdateState((d) => { if (d.p) d.p.plan = 3; });
            onToast?.('ปรับแผนสัปดาห์นี้เป็น "พักผ่อน" แล้ว');
          }
        });
      }
      if ((p.inj || 0) > 0) {
        items.push({
          id: 'player-inj-warn',
          kind: 'alert',
          group: 'staff',
          tone: 'urg',
          urgent: true,
          icon: <HeartPulse className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'แพทย์สโมสร',
          tag: 'อาการเจ็บ',
          title: `บาดเจ็บพัก ${p.inj} นัด`,
          detail: 'ฟื้นฟูร่างกายได้ที่หน้าอาชีพ',
          actionLabel: 'ฟื้นฟู',
          onAction: () =>
            onNavigate?.(
              'p',
              'plan',
              'wellbeing',
              'เลือกแผน "พักผ่อน" และกดปุ่มฟื้นฟู/กายภาพในการ์ดสุขภาพที่ไฮไลต์ด้านล่าง'
            )
        });
      }
      if ((p.sus || 0) > 0 || (p.yc || 0) >= 2) {
        items.push({
          id: 'player-card-warn',
          kind: 'alert',
          group: 'staff',
          tone: (p.sus || 0) > 0 ? 'urg' : 'warn',
          urgent: true,
          icon: (
            <span
              aria-hidden="true"
              className={`w-2.5 h-3.5 mland:w-2 mland:h-3 rounded-[2px] shadow-2xs ${
                (p.sus || 0) > 0 ? 'bg-rose-500' : 'bg-amber-400 border border-amber-600/40'
              }`}
            />
          ),
          sender: 'ผู้จัดการทีม',
          tag: 'วินัยสนาม',
          title: (p.sus || 0) > 0 ? `ติดโทษแบน ${p.sus} นัด` : `ใบเหลือง ${p.yc}/3 ใบ`,
          detail: (p.sus || 0) > 0 ? 'รอพ้นโทษแบน' : 'อีก 1 เหลืองโดนแบน 1 นัด'
        });
      }
      if ((p.mental ?? 70) < 58 || (p.phys ?? 70) < 58) {
        items.push({
          id: 'player-wellbeing-low',
          kind: 'alert',
          group: 'club',
          tone: 'warn',
          urgent: true,
          icon: <MessageSquare className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'นักจิตวิทยา',
          tag: 'ใจ/กาย',
          title: `ใจ ${p.mental ?? 70} · กาย ${p.phys ?? 70} ค่อนข้างต่ำ`,
          detail: 'คุยปรับใจหรือฟื้นฟูกล้ามเนื้อ',
          actionLabel: 'ดูแลตัวเอง',
          onAction: () =>
            onNavigate?.(
              'p',
              'plan',
              'wellbeing',
              'กดปุ่มคุยปรับใจหรือฟื้นฟูกล้ามเนื้อในการ์ดสุขภาพที่ไฮไลต์ด้านล่าง'
            )
        });
      } else if (mePl && isTeamFavoritePlayer(me, p.name) && getActiveFavBoost(mePl, me, p) === 0) {
        items.push({
          id: 'player-fav-boost-wait',
          kind: 'alert',
          group: 'club',
          tone: 'ok',
          urgent: true,
          icon: <Heart className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
          sender: 'ผู้จัดการทีม',
          tag: 'ลูกรักทีม',
          title: 'ลูกรักรอปลุกพลัง (+5~10)',
          detail: `ทำใจ ${p.mental ?? 70} และกาย ${p.phys ?? 70} ให้ถึง 72`,
          actionLabel: 'ฟื้นฟู',
          onAction: () =>
            onNavigate?.(
              'p',
              'plan',
              'wellbeing',
              'ดูแลจิตใจและร่างกายให้ถึง 72 ในการ์ดสุขภาพที่ไฮไลต์เพื่อเปิดโบนัส +5~10 OVR'
            )
        });
      }
    }

    const resolveFeedSender = (cat: string) => {
      if (cat.includes('สัมภาษณ์') || cat.includes('สื่อ')) return 'สื่อมวลชน';
      if (cat.includes('บอร์ด')) return 'บอร์ดบริหาร';
      if (cat.includes('แมวมอง')) return 'หัวหน้าแมวมอง';
      if (cat.includes('ตลาด') || cat.includes('ย้าย') || cat.includes('สัญญา') || cat.includes('ดีล')) {
        return 'ฝ่ายซื้อขาย & เอเย่นต์';
      }
      if (cat.includes('บุคลิก')) return 'ทีมสตาฟฟ์ & จิตวิทยา';
      if (cat.includes('แพทย์') || cat.includes('เจ็บ') || cat.includes('ฟิต')) return 'ทีมแพทย์';
      if (cat.includes('แฟน')) return 'แฟนบอล';
      if (cat.includes('เงิน') || cat.includes('สปอนเซอร์') || cat.includes('ธุรกิจ')) return 'ฝ่ายการเงิน';
      if (cat.includes('ทีมชาติ')) return 'สมาคมฟุตบอล';
      if (cat.includes('เหตุการณ์')) return 'สำนักงานสโมสร';
      return 'ผู้สื่อข่าวสโมสร';
    };

    (state.feed || []).forEach((f, idx) => {
      items.push({
        id: `feed-${idx}-${f.m}`,
        kind: 'feed',
        group: 'feed',
        tone: f.tone === 'urg' ? 'urg' : f.tone === 'offer' ? 'warn' : f.tone === 'ok' ? 'ok' : 'info',
        urgent: f.tone === 'urg' || f.tone === 'offer',
        icon:
          f.tone === 'urg'
            ? <AlertTriangle className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />
            : f.tone === 'offer'
              ? <Briefcase className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />
              : f.tone === 'ok'
                ? <Sparkles className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />
                : <Newspaper className="w-3.5 h-3.5 mland:w-3 mland:h-3" aria-hidden="true" />,
        sender: resolveFeedSender(f.cat),
        tag: `นัด ${f.m}${f.s !== state.season ? ` · S${f.s}` : ''}`,
        title: f.txt.includes('✚')
          ? (
            <span className="inline">
              {f.txt.split('✚').map((part, pIdx) => (
                <React.Fragment key={pIdx}>
                  {pIdx > 0 && (
                    <span className="inline-flex align-text-bottom mx-0.5">
                      <StatIconBadge kind="injury" size="xs" />
                    </span>
                  )}
                  <EffectText text={part} />
                </React.Fragment>
              ))}
            </span>
          )
          : <EffectText text={f.txt} />,
        detail: ''
      });
    });

    const pendingTasks = items.filter((it) => it.kind !== 'feed' && !!it.urgent);
    const pendingCount = pendingTasks.length;
    const hasCriticalTask = pendingTasks.some((it) => it.tone === 'urg');
    const hasWarnTask = pendingTasks.some((it) => it.tone === 'warn');
    const staffItems = items.filter((it) => it.group === 'staff');
    const clubItems = items.filter((it) => it.group === 'club');
    const staffCount = staffItems.length;
    const clubCount = clubItems.length;
    const staffUrgent = staffItems.some((it) => !!it.urgent);
    const clubUrgent = clubItems.some((it) => !!it.urgent);
    const filteredItems = items.filter((it) => {
      if (newsFilter === 'all') return true;
      return it.group === newsFilter;
    });

    const getCardStyle = (tone: NewsTone, isTask: boolean) => {
      if (!isTask) {
        const feedBar =
          tone === 'urg'
            ? 'bg-rose-500/75'
            : tone === 'warn'
              ? 'bg-amber-500/75'
              : tone === 'ok'
                ? 'bg-emerald-500/75'
                : 'bg-[var(--mut)]/30';
        const feedIcon =
          tone === 'urg'
            ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
            : tone === 'warn'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300'
              : tone === 'ok'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-[var(--g)]'
                : 'bg-[var(--surface)] border border-[var(--line)]/75 text-[var(--mut)]';
        return {
          card: 'bg-[var(--surface-2)]/28 hover:bg-[var(--surface-2)]/52 border-[var(--line)]/60',
          bar: feedBar,
          iconBox: feedIcon,
          dot: '',
          kickerCls: 'text-[var(--mut)]',
          kickerLabel: '',
          btn: 'btn-surface group-hover:bg-[var(--g)] group-hover:text-white group-hover:border-[var(--g)]'
        };
      }
      if (tone === 'urg') {
        return {
          card: 'bg-rose-500/[0.06] dark:bg-rose-500/[0.1] hover:bg-rose-500/[0.11] border-rose-500/40 dark:border-rose-400/40',
          bar: 'bg-rose-500',
          iconBox: 'bg-rose-500/12 border border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-2xs',
          dot: 'bg-rose-500 animate-pulse',
          kickerCls: 'text-rose-600 dark:text-rose-400 font-extrabold',
          kickerLabel: 'ด่วน',
          btn: 'bg-rose-600 group-hover:bg-rose-700 text-white border border-rose-500/40 shadow-xs'
        };
      }
      if (tone === 'ok') {
        return {
          card: 'bg-emerald-500/[0.05] dark:bg-emerald-500/[0.09] hover:bg-emerald-500/[0.1] border-emerald-500/35 dark:border-emerald-400/35',
          bar: 'bg-emerald-500',
          iconBox: 'bg-emerald-500/12 border border-emerald-500/40 text-[var(--g)] shadow-2xs',
          dot: 'bg-emerald-500 animate-pulse',
          kickerCls: 'text-[var(--g)] font-extrabold',
          kickerLabel: 'พร้อมตรวจ',
          btn: 'bg-[var(--g)] group-hover:brightness-110 text-white border border-emerald-400/30 shadow-xs'
        };
      }
      return {
        card: 'bg-amber-500/[0.05] dark:bg-amber-400/[0.08] hover:bg-amber-500/[0.1] border-amber-500/38 dark:border-amber-400/35',
        bar: 'bg-amber-500',
        iconBox: 'bg-amber-500/12 border border-amber-500/40 text-amber-600 dark:text-amber-300 shadow-2xs',
        dot: 'bg-amber-500 animate-pulse',
        kickerCls: 'text-amber-700 dark:text-amber-300 font-extrabold',
        kickerLabel: 'ต้องทำ',
        btn: 'bg-amber-500 group-hover:bg-amber-600 text-[#261900] border border-amber-600/35 font-extrabold shadow-xs'
      };
    };

    const filterTabs = (
      [
        ['all', `ทั้งหมด${pendingCount > 0 ? ` (${pendingCount})` : ''}`, pendingCount > 0],
        ['staff', `ทีมงาน${staffCount > 0 ? ` (${staffCount})` : ''}`, staffUrgent],
        ['club', `ติดต่อ${clubCount > 0 ? ` (${clubCount})` : ''}`, clubUrgent],
        ['feed', 'ข่าวทีม', false]
      ] as const
    );

    return (
      <div
        className={`relative p-2 sm:p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border shadow-xs space-y-1.5 mland:space-y-1 ${
          pendingCount > 0
            ? hasCriticalTask
              ? 'border-rose-500/40 dark:border-rose-400/40'
              : hasWarnTask
                ? 'border-amber-500/40 dark:border-amber-400/40'
                : 'border-emerald-500/40 dark:border-emerald-400/40'
            : 'border-[var(--line)]'
        }`}
      >
        <div className="relative seg-bar w-full grid grid-cols-4">
          {filterTabs.map(([fid, flbl, showRedDot]) => {
            const isActive = newsFilter === fid;
            return (
              <button
                key={fid}
                type="button"
                onClick={() => { SFX.tap(); setNewsFilter(fid); }}
                className={`seg-btn w-full justify-center gap-1 py-1 mland:py-0.5 text-[10.5px] mland:text-[9px] truncate ${
                  isActive ? 'seg-btn-active hover:text-white!' : ''
                }`}
              >
                {showRedDot && (
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isActive ? 'bg-red-200 ring-1 ring-white/80' : 'bg-red-500'
                    }`}
                  />
                )}
                <span className="truncate">{flbl}</span>
              </button>
            );
          })}
        </div>

        <div className="relative max-h-[340px] sm:max-h-[380px] mland:max-h-[240px] overflow-y-auto space-y-1 mland:space-y-1 p-0.5">
          {filteredItems.length === 0 ? (
            <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] py-4 text-center bg-[var(--surface-2)]/35 rounded-xl border border-dashed border-[var(--line)]">
              {newsFilter === 'staff'
                ? 'ทีมงานไม่มีเรื่องแจ้งเพิ่มเติม ทีมพร้อมลุย!'
                : newsFilter === 'club'
                  ? 'ไม่มีรายการติดต่อหรือคำขอค้างในตอนนี้'
                  : 'ไม่มีรายการสำคัญค้าง ทีมพร้อมลุยนัดถัดไป!'}
            </div>
          ) : (
            filteredItems.map((it, idx) => {
              const isUnresolvedTask = it.kind !== 'feed' && !!it.urgent;
              const isFirstFeedAfterTasks =
                newsFilter === 'all' &&
                it.kind === 'feed' &&
                idx > 0 &&
                filteredItems[idx - 1].kind !== 'feed';
              const style = getCardStyle(it.tone, isUnresolvedTask);
              const isInteractive = Boolean(it.actionLabel && it.onAction);

              const cardInner = (
                <>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${style.bar}`}
                  />
                  <div className={`relative w-7 h-7 mland:w-5.5 mland:h-5.5 ml-1 rounded-lg flex items-center justify-center shrink-0 ${style.iconBox}`}>
                    {it.icon}
                    {isUnresolvedTask && style.dot && (
                      <span
                        aria-hidden="true"
                        className={`absolute -top-0.5 -right-0.5 w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-full ring-2 ring-[var(--surface)] ${style.dot}`}
                      />
                    )}
                  </div>
                  <div className="relative min-w-0 flex-1 space-y-0.5">
                    <div className="font-bold text-[11px] mland:text-[9.5px] text-[var(--ink)] leading-snug break-words">
                      {typeof it.title === 'string' ? <EffectText text={it.title} /> : it.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] mland:text-[8.5px] leading-snug text-[var(--mut)]">
                      {isUnresolvedTask && style.kickerLabel && (
                        <>
                          <span className={`shrink-0 ${style.kickerCls}`}>{style.kickerLabel}</span>
                          <span aria-hidden="true" className="opacity-45">·</span>
                        </>
                      )}
                      <span className="font-semibold text-[var(--ink)]/85 truncate">
                        จาก {it.sender}
                      </span>
                      {(it.detail || it.tag) && (
                        <>
                          <span aria-hidden="true" className="opacity-45">·</span>
                          <span className="break-words">
                            <EffectText text={it.detail || it.tag} />
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {isInteractive && (
                    <span className={`relative btn btn-xs shrink-0 whitespace-nowrap gap-0.5 ${style.btn}`}>
                      <span>{it.actionLabel}</span>
                      <ChevronRight className="w-3 h-3 mland:w-2.5 mland:h-2.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  )}
                </>
              );

              return (
                <React.Fragment key={it.id}>
                  {isFirstFeedAfterTasks && (
                    <div className="flex items-center gap-2 pt-1 pb-0.5 text-[9.5px] mland:text-[8px] font-semibold text-[var(--mut)]">
                      <span className="h-px flex-1 bg-[var(--line)]/75" />
                      <span>ข่าวสโมสรล่าสุด</span>
                      <span className="h-px flex-1 bg-[var(--line)]/75" />
                    </div>
                  )}
                  {isInteractive ? (
                    <button
                      type="button"
                      onClick={() => { SFX.tap(); it.onAction?.(); }}
                      className={`group w-full text-left relative overflow-hidden pl-2.5 pr-2.5 py-1.5 mland:pl-2 mland:pr-2 mland:py-1 rounded-xl mland:rounded-lg border flex items-center justify-between gap-2 transition-all cursor-pointer ${style.card}`}
                    >
                      {cardInner}
                    </button>
                  ) : (
                    <div
                      className={`relative overflow-hidden pl-2.5 pr-2.5 py-1.5 mland:pl-2 mland:pr-2 mland:py-1 rounded-xl mland:rounded-lg border flex items-center justify-between gap-2 transition-colors ${style.card}`}
                    >
                      {cardInner}
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const worldClubsBundle = useMemo(() => {
    const rawForeign = state.teams.filter((t) => t.tier >= 3);
    const enriched = rawForeign.map((t) => {
      const meta = getForeignTeamCountryMeta(t.name, t.leagueCode);
      const st = teamStats(t, state);
      const totalVal = t.sq.reduce((s, q) => s + Math.max(vlu(q), q.price || 0), 0);
      return { team: t, meta, st, totalVal };
    });
    const countryMap = new Map<string, { code: string; flag: string; country: string; confed: ForeignConfed; count: number }>();
    enriched.forEach(({ meta }) => {
      if (!meta) return;
      const cur = countryMap.get(meta.code);
      if (cur) cur.count += 1;
      else countryMap.set(meta.code, { code: meta.code, flag: meta.flag, country: meta.country, confed: meta.confed, count: 1 });
    });
    const countries = Array.from(countryMap.values()).sort((a, b) => a.country.localeCompare(b.country, 'th'));
    const filtered = enriched
      .filter(({ meta }) => {
        if (worldConfed !== 'all' && (meta?.confed || 'asia') !== worldConfed) return false;
        if (worldCountry !== 'ALL' && meta?.code !== worldCountry) return false;
        return true;
      })
      .sort((a, b) => b.st.ovXi - a.st.ovXi || b.totalVal - a.totalVal);
    return { total: enriched.length, countries, filtered };
  }, [state, worldConfed, worldCountry]);

  const worldLeaguesFiltered = useMemo(
    () => WORLD_LEAGUE_SPECS.filter((w) => worldConfed === 'all' || w.confed === worldConfed),
    [worldConfed]
  );

  const activeWorldSpec = useMemo(() => {
    const direct = getWorldLeagueSpec(worldLeagueCode);
    if (direct && (worldConfed === 'all' || direct.confed === worldConfed)) return direct;
    return worldLeaguesFiltered[0] || WORLD_LEAGUE_SPECS[0];
  }, [worldLeagueCode, worldConfed, worldLeaguesFiltered]);

  const worldLeagueTable = useMemo(() => {
    if (!activeWorldSpec) return [];
    const teamsInLeague = state.teams.filter(
      (t) =>
        t.tier >= 3 &&
        (t.leagueCode === activeWorldSpec.code ||
          (!t.leagueCode && getForeignTeamCountryMeta(t.name)?.code === activeWorldSpec.code))
    );
    return sortTable(teamsInLeague);
  }, [state.teams, activeWorldSpec]);

  const rankBadgeFromTone = (tone: ReturnType<typeof getRankZoneBadge>['tone']) => {
    switch (tone) {
      case 'champ':
        return 'bg-amber-500 text-white';
      case 'acl_elite':
      case 'promo':
        return 'bg-[var(--g)] text-white';
      case 'acl2':
      case 'playoff':
        return 'bg-sky-600 text-white';
      case 'rel_po':
        return 'bg-orange-500 text-white';
      case 'rel':
        return 'bg-[var(--red)] text-white';
      default:
        return 'text-[var(--mut)]';
    }
  };

  const renderStandings = () => (
    <div className="flex-1 min-h-0 grid grid-cols-[1.42fr_0.88fr] gap-2.5 mland:gap-2 overflow-hidden">
      <div className="space-y-1.5 mland:space-y-1 h-full flex flex-col min-h-0">
        {vt >= 3 ? (
          <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 bg-[var(--surface-2)]/55 border-b border-[var(--line)]/70 flex flex-wrap items-center justify-between gap-2 text-[10.5px] sm:text-xs mland:text-[9px]">
              <div className="font-bold text-[var(--ink)] truncate flex items-center gap-1.5 min-w-0">
                <span>🌐</span>
                <span className="truncate">
                  {worldViewMode === 'table' && activeWorldSpec
                    ? `${activeWorldSpec.flag} ${getWorldLeagueDisplay(activeWorldSpec.code, activeWorldSpec.name)}`
                    : 'ทำเนียบสโมสรนานาชาติ'}
                </span>
                <span className="text-[var(--mut)] font-semibold shrink-0 tabular">
                  {worldViewMode === 'table' && activeWorldSpec
                    ? `· ${worldLeagueTable.length} ทีม · ${activeWorldSpec.matchdays} นัด`
                    : `· ${worldClubsBundle.filtered.length}/${worldClubsBundle.total} สโมสร · ${worldClubsBundle.countries.length} ประเทศ`}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="seg-bar">
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); setWorldViewMode('table'); }}
                    className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] ${worldViewMode === 'table' ? 'seg-btn-active' : ''}`}
                  >
                    ตารางคะแนน
                  </button>
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); setWorldViewMode('scout'); }}
                    className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] ${worldViewMode === 'scout' ? 'seg-btn-active' : ''}`}
                  >
                    ทำเนียบพลัง
                  </button>
                </div>
                {(() => {
                  const isViewingMyWorldLeague =
                    me.tier >= 3 &&
                    worldViewMode === 'table' &&
                    (!me.leagueCode || activeWorldSpec?.code === me.leagueCode);
                  if (!isViewingMyWorldLeague) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          if (me.tier >= 3) {
                            setWorldConfed('all');
                            setWorldViewMode('table');
                            if (me.leagueCode) setWorldLeagueCode(me.leagueCode);
                          } else if (me.tier === 0) {
                            setT3Zone(me.zone === 1 ? 1 : 0);
                          }
                          if (onShallowPatch) onShallowPatch(() => ({ lg: me.tier }));
                          else onUpdateState((d) => { d.lg = me.tier; });
                        }}
                        className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        ↩ กลับลีกฉัน
                      </button>
                    );
                  }
                  const myWorldIdx = worldLeagueTable.findIndex((t) => t.id === state.me);
                  const myWorldRank = myWorldIdx >= 0 ? myWorldIdx + 1 : null;
                  const worldPrize = getLeaguePrizeMoney(
                    3,
                    myWorldRank || 1,
                    Math.max(1, worldLeagueTable.length),
                    activeWorldSpec?.code
                  );
                  return (
                    <div className="flex items-center gap-2 shrink-0">
                      {myWorldRank && (
                        <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] tabular whitespace-nowrap">
                          อันดับของคุณ #{myWorldRank}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => { SFX.tap(); setPrizeModalTier(3); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--lamp)] text-[10px] mland:text-[8px] font-bold text-[var(--ink)] cursor-pointer transition-colors shadow-xs shrink-0"
                      >
                        <Coins className="w-3 h-3 text-[#b47b00] dark:text-[var(--lamp)] shrink-0" />
                        <span>รางวัล</span>
                        <span className="text-[var(--g)] font-extrabold tabular">+{fmtMoney(worldPrize)}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Confederation + League/Country Filter Bar */}
            <div className="shrink-0 px-2.5 sm:px-3 mland:px-2 py-1.5 mland:py-1 bg-[var(--surface-2)]/30 border-b border-[var(--line)]/70 flex flex-wrap items-center justify-between gap-1.5">
              <div className="seg-bar overflow-x-auto max-w-full">
                {(
                  [
                    ['all', '🌐 ทั้งหมด (33)'],
                    ['asia', `${CONFED_META.asia.icon} ${CONFED_META.asia.short}`],
                    ['europe', `${CONFED_META.europe.icon} ${CONFED_META.europe.short}`],
                    ['americas', `${CONFED_META.americas.icon} ${CONFED_META.americas.short}`],
                    ['africa', `${CONFED_META.africa.icon} ${CONFED_META.africa.short}`]
                  ] as const
                ).map(([cid, clbl]) => (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setWorldConfed(cid);
                      setWorldCountry('ALL');
                      if (cid !== 'all') {
                        const firstInConfed = WORLD_LEAGUE_SPECS.find((w) => w.confed === cid);
                        if (firstInConfed && getWorldLeagueSpec(worldLeagueCode)?.confed !== cid) {
                          setWorldLeagueCode(firstInConfed.code);
                        }
                      }
                    }}
                    className={`seg-btn py-1 mland:py-0.5 px-2 text-[10.5px] mland:text-[8.5px] whitespace-nowrap ${
                      worldConfed === cid ? 'seg-btn-active hover:text-white!' : ''
                    }`}
                  >
                    {clbl}
                  </button>
                ))}
              </div>

              {worldViewMode === 'table' ? (
                <select
                  aria-label="เลือกลีกต่างประเทศ"
                  value={activeWorldSpec?.code || ''}
                  onChange={(e) => {
                    SFX.tap();
                    setWorldLeagueCode(e.target.value);
                  }}
                  className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[var(--g)] max-w-[230px]"
                >
                  {worldLeaguesFiltered.map((sp) => (
                    <option key={sp.code} value={sp.code}>
                      {sp.flag} {getWorldLeagueDisplay(sp.code, sp.name)} ({sp.teamCount} ทีม · {sp.matchdays} นัด)
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  aria-label="กรองตามประเทศ"
                  value={worldCountry}
                  onChange={(e) => {
                    SFX.tap();
                    setWorldCountry(e.target.value);
                  }}
                  className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[var(--g)]"
                >
                  <option value="ALL">ทุกประเทศ ({worldClubsBundle.countries.length})</option>
                  {worldClubsBundle.countries
                    .filter((c) => worldConfed === 'all' || c.confed === worldConfed)
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.country} ({c.count})
                      </option>
                    ))}
                </select>
              )}
            </div>

            {worldViewMode === 'table' && activeWorldSpec ? (
              <>
                {/* League Zone Legend & Rules Note */}
                <div className="shrink-0 px-2.5 sm:px-3 mland:px-2 py-1 bg-[var(--surface-2)]/20 border-b border-[var(--line)]/60 flex flex-wrap items-center justify-between gap-1.5 text-[9.5px] mland:text-[8px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeWorldSpec.zones.map((z, idx) => {
                      const zRank = z.fromRank;
                      const zb = getRankZoneBadge(3, zRank, worldLeagueTable.length, { leagueCode: activeWorldSpec.code });
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-1.5 py-[1px] rounded border font-bold ${zb.badgeCls}`}
                        >
                          <span>{z.fromRank === z.toRank ? `#${z.fromRank}` : `#${z.fromRank}-${z.toRank}`}</span>
                          <span>{z.shortLabel}</span>
                        </span>
                      );
                    })}
                  </div>
                  {activeWorldSpec.note && (
                    <span className="text-[var(--mut)] font-semibold truncate">{activeWorldSpec.note}</span>
                  )}
                </div>

                {/* World Standings Column Header */}
                <div className="shrink-0 grid grid-cols-[18px_19px_minmax(0,1fr)_38px_24px_22px_26px_22px_25px_28px] sm:grid-cols-[24px_24px_minmax(0,1fr)_52px_30px_28px_32px_28px_32px_36px] mland:grid-cols-[18px_18px_minmax(0,1fr)_38px_24px_22px_26px_22px_24px_28px] items-center gap-0.5 sm:gap-1 mland:gap-0.5 px-1.5 sm:px-3 mland:px-1.5 py-1.5 mland:py-0.5 text-[9.5px] sm:text-[11px] mland:text-[8px] bg-[var(--surface-2)]/90 text-[var(--mut)] border-b border-[var(--line)] font-bold">
                  <span className="text-center">#</span>
                  <span />
                  <span className="truncate">สโมสร</span>
                  <span className="text-center text-[9px] sm:text-[11px] mland:text-[7.5px] whitespace-nowrap">5 นัด</span>
                  <span className="text-center whitespace-nowrap">แข่ง</span>
                  <span className="text-center whitespace-nowrap">ชนะ</span>
                  <span className="text-center whitespace-nowrap">เสมอ</span>
                  <span className="text-center whitespace-nowrap">แพ้</span>
                  <span className="text-center whitespace-nowrap">+/-</span>
                  <span className="text-center text-[var(--ink)] whitespace-nowrap">แต้ม</span>
                </div>

                <div className="divide-y divide-[var(--line)]/50 flex-1 min-h-0 overflow-y-auto">
                  {worldLeagueTable.map((t, i) => {
                    const zb = getRankZoneBadge(3, i + 1, worldLeagueTable.length, { leagueCode: activeWorldSpec.code });
                    const isMe = t.id === state.me;
                    const gd = t.gf - t.ga;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        title={zb.label ? `${t.name} · ${zb.label}` : t.name}
                        onClick={() => { SFX.tap(); onInspectTeam(t.id); }}
                        className={`w-full min-h-[26px] sm:min-h-[28px] mland:min-h-[20px] grid grid-cols-[18px_19px_minmax(0,1fr)_38px_24px_22px_26px_22px_25px_28px] sm:grid-cols-[24px_24px_minmax(0,1fr)_52px_30px_28px_32px_28px_32px_36px] mland:grid-cols-[18px_18px_minmax(0,1fr)_38px_24px_22px_26px_22px_24px_28px] items-center gap-0.5 sm:gap-1 mland:gap-0.5 px-1.5 sm:px-3 mland:px-1.5 py-1 mland:py-0.5 text-left text-[11px] sm:text-xs mland:text-[9px] leading-none transition-colors cursor-pointer ${
                          zb.tone !== 'neutral'
                            ? `${zb.rowCls} hover:brightness-95`
                            : isMe
                              ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/70'
                              : 'even:bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/75'
                        }`}
                      >
                        <span className={`text-center tabular font-bold text-[10px] mland:text-[8.5px] rounded-md mland:rounded py-0.5 mland:py-[1px] leading-none ${rankBadgeFromTone(zb.tone)}`}>
                          {i + 1}
                        </span>
                        <div className="flex items-center justify-center [&>svg]:w-[17px] [&>svg]:h-[17px] sm:[&>svg]:w-[19px] sm:[&>svg]:h-[19px] mland:[&>svg]:w-3.5 mland:[&>svg]:h-3.5">
                          <ClubCrest name={t.name} size={19} team={t} club={state.club} isMyClub={state.mode === 'm' && isMe} />
                        </div>
                        <div className="min-w-0 pr-0.5 flex items-center gap-1">
                          <span className={`truncate ${isMe ? 'font-bold text-[var(--ink)]' : 'font-semibold text-[var(--ink)]'}`}>{t.name}</span>
                          {isMe && <MyTeamBadge size="sm" />}
                        </div>
                        <div className="flex items-center justify-center">
                          {renderFormDots(t.fm)}
                        </div>
                        <span className="text-center tabular text-[var(--mut)]">{t.p}</span>
                        <span className="text-center tabular">{t.w}</span>
                        <span className="text-center tabular text-[var(--mut)]">{t.d}</span>
                        <span className="text-center tabular text-[var(--mut)]">{t.l}</span>
                        <span className={`text-center tabular font-semibold ${gd > 0 ? 'text-[var(--g)]' : gd < 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                          {gd > 0 ? `+${gd}` : gd}
                        </span>
                        <span className="text-center tabular font-extrabold text-[11px] sm:text-xs mland:text-[9px] rounded-md mland:rounded py-0.5 mland:py-[1px] leading-none bg-[var(--surface-2)]/85 text-[var(--ink)]">
                          {t.pts}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Power Directory Column Header */}
                <div className="shrink-0 grid grid-cols-[22px_20px_minmax(0,1fr)_82px_40px_64px] sm:grid-cols-[26px_24px_minmax(0,1fr)_110px_54px_76px_74px] mland:grid-cols-[20px_18px_minmax(0,1fr)_84px_38px_56px] items-center gap-1 sm:gap-1.5 px-2 sm:px-3 mland:px-1.5 py-1.5 mland:py-0.5 text-[9.5px] sm:text-[11px] mland:text-[8px] bg-[var(--surface-2)]/90 text-[var(--mut)] border-b border-[var(--line)] font-bold">
                  <span className="text-center">#</span>
                  <span />
                  <span>สโมสร</span>
                  <span>ประเทศ</span>
                  <span className="text-center font-display font-black text-[var(--g)]">XI</span>
                  <span className="text-center">รุก/รับ</span>
                  <span className="hidden sm:block text-right">มูลค่าทีม</span>
                </div>

                <div className="divide-y divide-[var(--line)]/50 flex-1 min-h-0 overflow-y-auto">
                  {worldClubsBundle.filtered.map(({ team, meta, st, totalVal }, idx) => {
                    const isMe = team.id === state.me;
                    return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onInspectTeam(team.id);
                      }}
                      className={`w-full grid grid-cols-[22px_20px_minmax(0,1fr)_82px_40px_64px] sm:grid-cols-[26px_24px_minmax(0,1fr)_110px_54px_76px_74px] mland:grid-cols-[20px_18px_minmax(0,1fr)_84px_38px_56px] items-center gap-1 sm:gap-1.5 px-2 sm:px-3 mland:px-1.5 py-1.5 mland:py-1 text-left text-[11px] sm:text-xs mland:text-[9px] transition-colors cursor-pointer ${
                        isMe ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/70' : 'even:bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/75'
                      }`}
                    >
                      <span className="text-center tabular font-bold text-[10px] mland:text-[8.5px] text-[var(--mut)]">
                        {idx + 1}
                      </span>
                      <div className="flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px] mland:[&>svg]:w-3.5 mland:[&>svg]:h-3.5">
                        <ClubCrest name={team.name} size={19} team={team} club={state.club} isMyClub={state.mode === 'm' && isMe} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--ink)] truncate leading-tight flex items-center gap-1 min-w-0">
                          <span className="truncate">{team.name}</span>
                          {isMe && <MyTeamBadge size="2xs" />}
                        </div>
                        <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] truncate">
                          {meta ? `${CONFED_META[meta.confed].icon} ${CONFED_META[meta.confed].short}` : 'นานาชาติ'} · {team.sq.length} คน
                        </div>
                      </div>
                      <div className="truncate text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--ink)]/90 flex items-center gap-1">
                        {(() => {
                          const lLogo = meta ? getLeagueLogoUrl(meta.code) : undefined;
                          const leagueDisplay = team.modLeagueName || (meta ? getWorldLeagueDisplay(meta.code, meta.country) : undefined);
                          if (meta) {
                            return (
                              <>
                                {lLogo ? (
                                  <img src={lLogo} alt="" className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                ) : (
                                  <span>{meta.flag}</span>
                                )}
                                <span className="truncate" title={leagueDisplay || meta.country}>
                                  {team.modLeagueName || (leagueDisplay && leagueDisplay !== meta.country ? leagueDisplay : meta.country)}
                                </span>
                              </>
                            );
                          }
                          return <span>{team.modLeagueName || '🌍 นานาชาติ'}</span>;
                        })()}
                      </div>
                      <div className="flex justify-center">
                        <OvrBadge ov={st.ovXi} variant="inline" size="sm" />
                      </div>
                      <div className="text-center tabular text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--mut)]">
                        {st.at}/{st.df}
                      </div>
                      <div className="hidden sm:block text-right tabular text-[10.5px] font-bold text-[var(--ink)]">
                        {fmtMoneyNum(totalVal)}
                      </div>
                    </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden flex-1 min-h-0 flex flex-col">
          {/* Active League & Season Banner */}
          <div className="shrink-0 px-2.5 sm:px-3 mland:px-2 py-1 mland:py-0.5 bg-[var(--surface-2)]/55 border-b border-[var(--line)]/70 flex flex-wrap items-center justify-between gap-1.5 text-[10.5px] sm:text-xs mland:text-[9px]">
            <div className="font-bold text-[var(--ink)] truncate flex items-center gap-1.5">
              {(() => {
                const tierLogo = getLeagueLogoUrl(vt);
                return tierLogo ? (
                  <img
                    src={tierLogo}
                    alt=""
                    className="w-4 h-4 object-contain shrink-0 rounded-xs"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span>🏆</span>
                );
              })()}
              <span className="truncate">
                {TN[vt]}
                {vt === 0 ? ` · ${getT3ZoneLabel(t3Zone)}` : ''}
              </span>
              <span className="text-[var(--mut)] font-semibold shrink-0">· ซีซั่น {state.season}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {vt === 0 && (
                <div className="seg-bar">
                  {([0, 1] as const).map((zIdx) => {
                    const isMyZone = me.tier === 0 && (me.zone ?? 0) === zIdx;
                    return (
                      <button
                        key={zIdx}
                        type="button"
                        onClick={() => { SFX.tap(); setT3Zone(zIdx); }}
                        className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] inline-flex items-center gap-1 ${
                          t3Zone === zIdx ? 'seg-btn-active' : ''
                        }`}
                      >
                        <span>{T3_ZONE_NAMES[zIdx]}</span>
                        {isMyZone && <MyTeamBadge size="2xs" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {vt !== me.tier ? (
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    if (me.tier === 0) setT3Zone(me.zone === 1 ? 1 : 0);
                    if (onShallowPatch) onShallowPatch(() => ({ lg: me.tier }));
                    else onUpdateState((d) => { d.lg = me.tier; });
                  }}
                  className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                >
                  ↩ กลับลีกฉัน
                </button>
              ) : myLeaguePos ? (
                <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] tabular shrink-0 whitespace-nowrap">
                  อันดับของคุณ #{myLeaguePos}
                </span>
              ) : vt === 0 ? (
                <button
                  type="button"
                  onClick={() => { SFX.tap(); setT3Zone(me.zone === 1 ? 1 : 0); }}
                  className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                >
                  ↩ กลับโซนฉัน
                </button>
              ) : null}
            </div>
          </div>
          {/* Table Column Header */}
          <div className="shrink-0 grid grid-cols-[18px_19px_minmax(0,1fr)_38px_24px_22px_26px_22px_25px_28px] sm:grid-cols-[24px_24px_minmax(0,1fr)_52px_30px_28px_32px_28px_32px_36px] mland:grid-cols-[18px_18px_minmax(0,1fr)_38px_24px_22px_26px_22px_24px_28px] items-center gap-0.5 sm:gap-1 mland:gap-0.5 px-1.5 sm:px-3 mland:px-1.5 py-1.5 mland:py-0.5 text-[9.5px] sm:text-[11px] mland:text-[8px] bg-[var(--surface-2)]/90 text-[var(--mut)] border-b border-[var(--line)] font-bold">
            <span className="text-center">#</span>
            <span />
            <span className="truncate">สโมสร</span>
            <span className="text-center text-[9px] sm:text-[11px] mland:text-[7.5px] whitespace-nowrap" title="ฟอร์ม 5 นัดหลังสุด">5 นัด</span>
            <span className="text-center whitespace-nowrap">แข่ง</span>
            <span className="text-center whitespace-nowrap">ชนะ</span>
            <span className="text-center whitespace-nowrap">เสมอ</span>
            <span className="text-center whitespace-nowrap">แพ้</span>
            <span className="text-center whitespace-nowrap" title="ประตูได้-เสีย">+/-</span>
            <span className="text-center text-[var(--ink)] whitespace-nowrap">แต้ม</span>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[var(--line)]/50 flex-1 min-h-0 overflow-y-auto flex flex-col">
            {tb.map((t, i) => {
              const zb = getRankZoneBadge(vt, i + 1, tb.length);
              const isMe = t.id === state.me;
              const gd = t.gf - t.ga;
              const rankBadge = rankBadgeFromTone(zb.tone);

              return (
                <button
                  key={t.id}
                  type="button"
                  title={zb.label ? `${t.name} · ${zb.label}` : t.name}
                  onClick={() => { SFX.tap(); onInspectTeam(t.id); }}
                  className={`w-full flex-1 basis-0 min-h-[20px] sm:min-h-[22px] mland:min-h-[14px] grid grid-cols-[18px_19px_minmax(0,1fr)_38px_24px_22px_26px_22px_25px_28px] sm:grid-cols-[24px_24px_minmax(0,1fr)_52px_30px_28px_32px_28px_32px_36px] mland:grid-cols-[18px_18px_minmax(0,1fr)_38px_24px_22px_26px_22px_24px_28px] items-center gap-0.5 sm:gap-1 mland:gap-0.5 px-1.5 sm:px-3 mland:px-1.5 py-0 text-left text-[11px] sm:text-xs mland:text-[9px] leading-none transition-colors cursor-pointer ${
                    zb.tone !== 'neutral'
                      ? `${zb.rowCls} hover:brightness-95`
                      : 'even:bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/75'
                  }`}
                >
                  <span className={`text-center tabular font-bold text-[10px] mland:text-[8.5px] rounded-md mland:rounded py-0.5 mland:py-[1px] leading-none ${rankBadge}`}>
                    {i + 1}
                  </span>
                  <div className="flex items-center justify-center [&>svg]:w-[17px] [&>svg]:h-[17px] sm:[&>svg]:w-[19px] sm:[&>svg]:h-[19px] mland:[&>svg]:w-3.5 mland:[&>svg]:h-3.5">
                    <ClubCrest name={t.name} size={19} team={t} club={state.club} isMyClub={state.mode === 'm' && isMe} />
                  </div>
                  <div className="min-w-0 pr-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`truncate text-[11px] sm:text-[12px] mland:text-[9px] leading-tight ${isMe ? 'font-bold text-[var(--ink)]' : ''}`}>
                        {t.name}
                      </span>
                      {isMe && <MyTeamBadge size="sm" />}
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    {renderFormDots(t.fm)}
                  </div>
                  <span className="text-center tabular text-[var(--mut)]">{t.p}</span>
                  <span className="text-center tabular">{t.w}</span>
                  <span className="text-center tabular text-[var(--mut)]">{t.d}</span>
                  <span className="text-center tabular text-[var(--mut)]">{t.l}</span>
                  <span className={`text-center tabular font-semibold ${gd > 0 ? 'text-[var(--g)]' : gd < 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                    {gd > 0 ? `+${gd}` : gd}
                  </span>
                  <span className="text-center tabular font-extrabold text-[11px] sm:text-xs mland:text-[9px] rounded-md mland:rounded py-0.5 mland:py-[1px] leading-none bg-[var(--surface-2)]/85 text-[var(--ink)]">
                    {t.pts}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {/* Right Column: Matchday Command Hub (Next Match + Playoff Bracket + Actionable Inbox + Recent Form) */}
      <div className="space-y-2 mland:space-y-1.5 h-full overflow-y-auto pr-0.5">
        {renderNextMatchCard()}
        {state.po && (
          <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-1.5">
            <div className="font-bold text-xs sm:text-sm mland:text-[11px] flex items-center justify-between gap-2">
              <span>🔥 รอบเพลย์ออฟ & ชิงแชมป์</span>
              <span className={`text-[10px] mland:text-[8.5px] font-extrabold ${state.po.done ? 'text-[var(--g)]' : 'text-amber-600 dark:text-[var(--lamp)]'}`}>
                {state.po.done ? 'สรุปผลแล้ว' : 'กำลังแข่งขัน'}
              </span>
            </div>
            <div className="space-y-1 text-[10.5px] mland:text-[9px] text-[var(--ink)]">
              {[...state.po.t2.log, ...state.po.t3.log].map((line, idx) => (
                <div key={idx} className="px-2 py-1 rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)]/60 truncate">
                  {line}
                </div>
              ))}
              {!state.po.done && state.po.t2.pairs.length > 0 && state.po.t2.winnerId == null && (
                <div className="text-[10px] text-[var(--mut)]">
                  T2 รอบรอง/ชิง: {state.po.t2.pairs.map((p) => `${state.teams[p[0]]?.name || '?'} vs ${state.teams[p[1]]?.name || '?'}`).join(' · ')}
                </div>
              )}
              {!state.po.done && state.po.t3.promoPairs.length > 0 && state.po.t3.promoWinnerId == null && (
                <div className="text-[10px] text-[var(--mut)]">
                  T3 ชปล.: {state.po.t3.promoPairs.map((p) => `${state.teams[p[0]]?.name || '?'} vs ${state.teams[p[1]]?.name || '?'}`).join(' · ')}
                </div>
              )}
            </div>
          </div>
        )}
        {renderImportantNewsPanel()}
        <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs">
          <div className="font-bold text-xs sm:text-sm mland:text-[11px] mb-2 mland:mb-1 flex items-center justify-between">
            <span>📋 ผลล่าสุดของคุณ</span>
            {me.fm && <WdlFormStrip fm={me.fm} size="2xs" />}
          </div>
          {(state.res || []).length ? (
            <div className="space-y-1">
              {state.res!.map((r, i) => {
                const isWin = r.includes('ชนะ') || r.startsWith('W');
                const isDraw = r.includes('เสมอ') || r.startsWith('D');
                const toneCls = isWin
                  ? 'bg-emerald-500/10 border-emerald-500/25'
                  : isDraw
                    ? 'bg-amber-400/12 border-amber-500/25'
                    : 'bg-rose-500/10 border-rose-500/25';
                const mdMatch = r.match(/^นัด\s+(\d+):/);
                const mdNumVal = mdMatch ? Number(mdMatch[1]) : 0;
                const rec = mdMatch ? state.schedRes?.[mdNumVal - 1] : undefined;
                const vars = rec?.varReplays;
                return (
                  <div key={i} className={`flex items-center justify-between gap-1.5 text-[11px] mland:text-[10px] px-2.5 py-1 mland:py-0.5 rounded-lg border leading-snug tabular ${toneCls}`}>
                    {rec && onOpenMatchReport ? (
                      <button
                        type="button"
                        onClick={() => onOpenMatchReport(rec, `${myLeagueName} · นัดที่ ${mdNumVal}`)}
                        className="min-w-0 flex-1 text-left truncate hover:underline cursor-pointer"
                        title="ดูสรุปหลังเกม"
                      >
                        {r}
                      </button>
                    ) : (
                      <span className="min-w-0 truncate">{r}</span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {rec?.highlightClips?.length && onOpenHighlights && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenHighlights(
                              rec.h,
                              rec.a,
                              rec.highlightClips!,
                              `${myLeagueName} · นัดที่ ${mdNumVal}`,
                              `${state.teams[rec.h]?.name || ''} ${rec.gh} - ${rec.ga} ${state.teams[rec.a]?.name || ''}`
                            )
                          }
                          className="px-1.5 py-[1px] rounded bg-amber-500/18 border border-amber-400/55 text-amber-700 dark:text-amber-300 text-[9.5px] mland:text-[8.5px] font-extrabold hover:bg-amber-500/28 cursor-pointer transition-colors whitespace-nowrap"
                          title="ชมไฮไลท์การแข่งขัน"
                        >
                          🎬 {rec.highlightClips.length}
                        </button>
                      )}
                      {vars && vars.length > 0 && rec && onOpenVarReplay && (
                        <button
                          type="button"
                          onClick={() => onOpenVarReplay(rec.h, rec.a, vars)}
                          className="px-1.5 py-[1px] rounded bg-sky-500/18 border border-sky-400/50 text-sky-700 dark:text-sky-300 text-[9.5px] mland:text-[8.5px] font-extrabold hover:bg-sky-500/28 cursor-pointer transition-colors whitespace-nowrap"
                          title="ดูภาพช้า VAR ย้อนหลัง"
                        >
                          🖥 VAR ({vars.length})
                        </button>
                      )}
                      {rec && onOpenMatchReport && (
                        <button
                          type="button"
                          onClick={() => onOpenMatchReport(rec, `${myLeagueName} · นัดที่ ${mdNumVal}`)}
                          className="px-1.5 py-[1px] rounded bg-[var(--surface)]/85 border border-[var(--line)] hover:border-[var(--g)] text-[var(--ink)] text-[9.5px] mland:text-[8.5px] font-bold cursor-pointer transition-colors whitespace-nowrap"
                          title="ดูหน้าจบเกม"
                        >
                          📊 สรุป
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] mland:text-[10px] text-[var(--mut)]">ยังไม่มีการแข่งขัน</p>
          )}
        </div>
      </div>
    </div>
  );


  const renderStatsAndAwards = () => {
    const isWorldStats = vt >= 3 && Boolean(activeWorldSpec);
    const statsTier = isWorldStats ? 3 : (vt < 3 ? vt : me.tier);
    const ts = state.teams.filter((t) => {
      if (isWorldStats && activeWorldSpec) {
        return (
          t.tier >= 3 &&
          (t.leagueCode === activeWorldSpec.code ||
            (!t.leagueCode && getForeignTeamCountryMeta(t.name)?.code === activeWorldSpec.code))
        );
      }
      return t.tier === statsTier && (statsTier !== 0 || (t.zone ?? 0) === t3Zone);
    });
    const tbStats = sortTable(ts);
    const ps = ts.flatMap((t) => t.sq.map((q) => ({ q, t })));
    const totalPlayedInTier = ts.reduce((s, t) => s + t.p, 0);
    const maxPlayedInTier = ts.reduce((m, t) => Math.max(m, t.p), 0);
    const totalRounds = isWorldStats && activeWorldSpec
      ? activeWorldSpec.matchdays
      : DOMESTIC_LEAGUE_SPECS[statsTier === 0 || statsTier === 1 || statsTier === 2 ? statsTier : 2].matchdays;
    const isSeasonDone = maxPlayedInTier >= totalRounds && totalRounds > 0;
    const teamRankMap = new Map<number, number>(tbStats.map((t, idx) => [t.id, idx]));

    interface AwardEntry {
      q: Player;
      t: Team;
      primaryValue: string;
      runnerValue: string;
      breakdown: string;
      scoreNum: number;
    }

    const goldenBootList: AwardEntry[] = ps
      .filter((x) => (x.q.sg || 0) > 0)
      .sort(
        (a, b) =>
          (b.q.sg || 0) - (a.q.sg || 0) ||
          (a.q.sp || 999) - (b.q.sp || 999) ||
          (b.q.sa || 0) - (a.q.sa || 0) ||
          b.q.ov - a.q.ov
      )
      .slice(0, 5)
      .map(({ q, t }) => {
        const apps = q.sp || t.p || 1;
        const gpg = ((q.sg || 0) / Math.max(1, apps)).toFixed(2);
        return {
          q,
          t,
          primaryValue: `${q.sg || 0} ประตู`,
          runnerValue: `${q.sg || 0}`,
          breakdown: `${q.sa || 0} จ่าย · ${q.sp || t.p || 0} นัด · ${gpg}/นัด`,
          scoreNum: q.sg || 0
        };
      });

    const goldenGloveList: AwardEntry[] = (totalPlayedInTier > 0
      ? ps.filter((x) => x.q.pos === 'GK' && ((x.q.cs || 0) > 0 || (x.q.sp || 0) > 0))
      : []
    )
      .sort(
        (a, b) =>
          (b.q.cs || 0) - (a.q.cs || 0) ||
          a.t.ga - b.t.ga ||
          (b.q.sp || 0) - (a.q.sp || 0) ||
          b.q.ov - a.q.ov
      )
      .slice(0, 5)
      .map(({ q, t }) => {
        const apps = q.sp || t.p || 1;
        const csPct = Math.round(((q.cs || 0) / Math.max(1, apps)) * 100);
        return {
          q,
          t,
          primaryValue: `${q.cs || 0} คลีนชีต`,
          runnerValue: `${q.cs || 0}`,
          breakdown: `ทีมเสีย ${t.ga} · ${q.sp || t.p || 0} นัด · ${csPct}%`,
          scoreNum: q.cs || 0
        };
      });

    const mvpList: AwardEntry[] = (totalPlayedInTier > 0
      ? ps.filter((x) => (x.q.sp || 0) > 0 || (x.q.sg || 0) > 0 || (x.q.sa || 0) > 0 || (x.q.cs || 0) > 0)
      : []
    )
      .map(({ q, t }) => {
        const rankIdx = teamRankMap.get(t.id) ?? Math.max(0, tb.length - 1);
        const goalWeight = q.pos === 'DF' ? 5.5 : q.pos === 'MF' ? 4.5 : 3.8;
        const assistWeight = q.pos === 'DF' ? 3.8 : 3.0;
        const csScore = q.pos === 'GK' ? (q.cs || 0) * 4.2 : 0;
        const defScore = q.pos === 'DF' && t.p > 0 ? (q.sp || 0) * Math.max(0, 1.4 - (t.ga / Math.max(1, t.p)) * 0.45) : 0;
        const appScore = Math.min(q.sp || 0, t.p || 30) * 0.45;
        const teamBonus = Math.max(0, (tb.length - rankIdx) / Math.max(1, tb.length)) * 6;
        const qualAdj = (q.ov - 50) * 0.25 - (q.yc || 0) * 0.5 - (q.rc || 0) * 2.5;
        const score = Math.max(
          0,
          Math.round(
            ((q.sg || 0) * goalWeight +
              (q.sa || 0) * assistWeight +
              csScore +
              defScore +
              appScore +
              teamBonus +
              qualAdj) *
              10
          ) / 10
        );
        const detailLine =
          q.pos === 'GK'
            ? `${q.cs || 0} คลีนชีต · ${q.sp || t.p || 0} นัด · อันดับ ${rankIdx + 1}`
            : `${q.sg || 0} ประตู · ${q.sa || 0} จ่าย · ${q.sp || t.p || 0} นัด · อันดับ ${rankIdx + 1}`;
        return {
          q,
          t,
          primaryValue: `${score.toFixed(1)} คะแนน`,
          runnerValue: `${score.toFixed(1)}`,
          breakdown: detailLine,
          scoreNum: score
        };
      })
      .sort(
        (a, b) =>
          b.scoreNum - a.scoreNum ||
          (b.q.sg || 0) + (b.q.sa || 0) - ((a.q.sg || 0) + (a.q.sa || 0)) ||
          b.q.ov - a.q.ov
      )
      .slice(0, 5);

    const awards: {
      id: string;
      icon: React.ReactNode;
      title: string;
      enTitle: string;
      shortCriteria: string;
      topStripe: string;
      accentText: string;
      spotlightBg: string;
      entries: AwardEntry[];
      emptyText: string;
    }[] = [
      {
        id: 'golden-boot',
        icon: <StatIconBadge kind="goal" size="md" title="รองเท้าทองคำ" />,
        title: 'รองเท้าทองคำ',
        enTitle: 'Golden Boot',
        shortCriteria: 'ดาวซัลโวสูงสุดประจำลีก',
        topStripe: 'linear-gradient(90deg, #eab308, #f5c242)',
        accentText: 'text-[#b45309] dark:text-[var(--lamp)]',
        spotlightBg: 'bg-[var(--lamp-soft)]/55 border-[var(--lamp)]/45',
        entries: goldenBootList,
        emptyText: 'ยังไม่มีผู้ทำประตูในลีกนี้ ลงสนามเพื่อเปิดบัญชีดาวยิง'
      },
      {
        id: 'golden-glove',
        icon: <StatIconBadge kind="cleansheet" size="md" title="ถุงมือทองคำ" />,
        title: 'ถุงมือทองคำ',
        enTitle: 'Golden Glove',
        shortCriteria: 'ผู้รักษาประตูคลีนชีตสูงสุด',
        topStripe: 'linear-gradient(90deg, #158049, #25b86c)',
        accentText: 'text-[var(--g)]',
        spotlightBg: 'bg-[var(--g-soft)]/60 border-[var(--g)]/35',
        entries: goldenGloveList,
        emptyText: 'ยังไม่มีสถิติคลีนชีตในลีกนี้ รอการลงสนามนัดแรก'
      },
      {
        id: 'poy',
        icon: '🌟',
        title: 'นักเตะยอดเยี่ยม',
        enTitle: 'Player of the Season',
        shortCriteria: 'คะแนนรวมผลงานและอันดับทีม',
        topStripe: 'linear-gradient(90deg, #0ea5e9, #158049)',
        accentText: 'text-[var(--ink)]',
        spotlightBg: 'bg-[var(--surface-2)]/85 border-[var(--line)]',
        entries: mvpList,
        emptyText: 'ยังไม่มีคะแนนผลงานประจำฤดูกาล รอการลงสนามนัดแรก'
      }
    ];

    const renderLeaderboardCard = (
      ic: React.ReactNode,
      title: string,
      unitLabel: string,
      valFn: (q: Player) => number,
      fmt: (q: Player) => React.ReactNode,
      filterFn?: (q: Player) => boolean,
      renderValue?: (q: Player, idx: number) => React.ReactNode
    ) => {
      const list = ps
        .filter((x) => (!filterFn || filterFn(x.q)) && valFn(x.q) > 0)
        .sort((a, b) => valFn(b.q) - valFn(a.q) || b.q.ov - a.q.ov)
        .slice(0, 5);
      return (
        <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-2xs flex flex-col overflow-hidden">
          <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 bg-[var(--surface-2)]/45 border-b border-[var(--line)] flex items-center justify-between gap-2">
            <h4 className="font-bold text-xs sm:text-[13px] mland:text-[10.5px] text-[var(--ink)] flex items-center gap-1.5 min-w-0 truncate">
              <span className="shrink-0 leading-none">{ic}</span>
              <span className="truncate">{title}</span>
            </h4>
            <span className="text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)] whitespace-nowrap shrink-0">
              {unitLabel}
            </span>
          </div>
          {list.length ? (
            <div className="divide-y divide-[var(--line)]/50 flex-1">
              {list.map((x, idx) => {
                const isMine = x.t.id === state.me;
                return (
                  <button
                    key={`${x.t.id}-${x.q.n}`}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      onInspectPlayer(x.q, x.t);
                    }}
                    className={`w-full flex items-center gap-2 mland:gap-1.5 px-3 py-1.5 mland:px-2 mland:py-1 text-left cursor-pointer transition-colors ${
                      isMine ? 'bg-[var(--lamp-soft)]/45 hover:bg-[var(--lamp-soft)]/75' : 'hover:bg-[var(--surface-2)]/65'
                    }`}
                  >
                    <span
                      className={`w-4 text-[11px] mland:text-[9.5px] font-extrabold tabular shrink-0 ${
                        idx === 0 ? 'text-[#b45309] dark:text-[var(--lamp)]' : 'text-[var(--mut)]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="shrink-0 mland:[&_svg]:w-5 mland:[&_svg]:h-5">
                      <PlayerFace player={x.q} team={x.t} state={state} club={state.club} isMyClub={isMine && state.mode === 'm'} size={26} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[11.5px] mland:text-[9.5px] text-[var(--ink)] flex items-center gap-1 min-w-0 leading-tight">
                        <PositionBadge role={x.q.ro || x.q.pos} size="2xs" />
                        <span className="truncate">{x.q.n}</span>
                      </div>
                      <div className="text-[10px] mland:text-[8px] text-[var(--mut)] truncate flex items-center gap-1 mt-0.5 leading-tight">
                        <ClubCrest name={x.t.name} size={11} team={x.t} club={state.club} isMyClub={isMine && state.mode === 'm'} />
                        <span className="truncate">{x.t.name}</span>
                        {isMine && <MyTeamBadge size="2xs" />}
                      </div>
                    </div>
                    {renderValue ? (
                      renderValue(x.q, idx)
                    ) : (
                      <span
                        className={`text-xs mland:text-[10px] font-extrabold tabular shrink-0 ${
                          idx === 0 ? 'text-[var(--g)]' : 'text-[var(--ink)]'
                        }`}
                      >
                        {fmt(x.q)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-5 mland:py-3 px-3 text-center">
              <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">รอข้อมูลหลังการแข่งขัน</p>
            </div>
          )}
        </section>
      );
    };

    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2.5 mland:gap-1.5 overflow-hidden">
        {/* Clean Context Header Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-2xs shrink-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <span className="font-bold text-xs sm:text-sm mland:text-[11px] text-[var(--ink)] whitespace-nowrap">
              🏅 สถิติและรางวัลประจำฤดูกาล
            </span>
            <span aria-hidden="true" className="text-[var(--mut)]">·</span>
            <span className="text-xs sm:text-sm mland:text-[10.5px] font-bold text-[var(--g)] truncate">
              {isWorldStats && activeWorldSpec
                ? `${activeWorldSpec.flag} ${getWorldLeagueDisplay(activeWorldSpec.code, activeWorldSpec.name)}`
                : `${TN[statsTier]}${statsTier === 0 ? ` (${getT3ZoneLabel(t3Zone)})` : ''}`}
            </span>
            <span aria-hidden="true" className="hidden sm:inline text-[var(--mut)]">·</span>
            <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular whitespace-nowrap">
              ซีซั่น {state.season} · แข่งแล้ว {maxPlayedInTier}/{totalRounds} นัด · {isSeasonDone ? 'สรุปผลแล้ว' : 'กำลังลุ้นรางวัล'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isWorldStats && activeWorldSpec && (
              <select
                aria-label="เลือกลีกต่างประเทศ"
                value={activeWorldSpec.code}
                onChange={(e) => {
                  SFX.tap();
                  setWorldLeagueCode(e.target.value);
                }}
                className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)] text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[var(--g)] max-w-[210px]"
              >
                {WORLD_LEAGUE_SPECS.map((sp) => (
                  <option key={sp.code} value={sp.code}>
                    {sp.flag} {getWorldLeagueDisplay(sp.code, sp.name)}
                  </option>
                ))}
              </select>
            )}
            {statsTier === 0 && (
              <div className="seg-bar">
                {([0, 1] as const).map((zIdx) => (
                  <button
                    key={zIdx}
                    type="button"
                    onClick={() => { SFX.tap(); setT3Zone(zIdx); }}
                    className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] ${t3Zone === zIdx ? 'seg-btn-active' : ''}`}
                  >
                    {T3_ZONE_NAMES[zIdx]}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setCupInitialStats(true);
                if (onShallowPatch) {
                  onShallowPatch((prev) => ({ v: prev.v === 'c' ? 't' : prev.v, tv: 4 }));
                } else {
                  onUpdateState((d) => {
                    if (d.v === 'c') d.v = 't';
                    d.tv = 4;
                  });
                }
              }}
              className="btn btn-xs btn-secondary"
            >
              🏅 สถิติบอลถ้วย ›
            </button>
            {onOpenSeasonStats && (state.seasonArchives?.length || 0) > 0 && (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onOpenSeasonStats();
                }}
                className="btn btn-xs btn-primary"
              >
                📜 สถิติซีซั่นที่จบแล้ว ({state.seasonArchives!.length})
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Awards + Leaderboards */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-3 mland:space-y-2">
          {/* 3-Column Major Awards Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 mland:grid-cols-3 gap-2.5 mland:gap-2 items-stretch">
            {awards.map((aw) => {
              const leader = aw.entries[0];
              const runners = aw.entries.slice(1);
              const leaderIsMe = leader?.t.id === state.me;

              return (
                <section
                  key={aw.id}
                  className="relative rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-2xs flex flex-col overflow-hidden"
                >
                  <div aria-hidden="true" className="h-[2.5px] w-full shrink-0" style={{ background: aw.topStripe }} />

                  <div className="p-3 mland:p-2 flex flex-col flex-1 gap-2.5 mland:gap-1.5">
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                        <span className="text-base mland:text-sm leading-none shrink-0" aria-hidden="true">{aw.icon}</span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] text-[var(--ink)] truncate leading-tight">
                            {aw.title}
                          </h3>
                          <p className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate leading-tight mt-0.5">
                            {aw.enTitle} · {aw.shortCriteria}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* #1 Leader Spotlight */}
                    {leader ? (
                      <button
                        type="button"
                        onClick={() => { SFX.tap(); onInspectPlayer(leader.q, leader.t); }}
                        className={`w-full p-2.5 mland:p-1.5 rounded-xl border text-left cursor-pointer transition-colors hover:border-[var(--g)] ${
                          leaderIsMe ? 'bg-[var(--lamp-soft)]/70 border-[var(--lamp)]' : aw.spotlightBg
                        }`}
                      >
                        <div className="flex items-center gap-2.5 mland:gap-2">
                          <div className="shrink-0 mland:[&_svg]:w-9 mland:[&_svg]:h-9">
                            <PlayerFace player={leader.q} team={leader.t} state={state} club={state.club} isMyClub={leaderIsMe && state.mode === 'm'} size={42} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] uppercase tracking-wide">
                                อันดับ 1
                              </span>
                              <span className={`text-sm mland:text-xs font-extrabold tabular shrink-0 ${aw.accentText}`}>
                                {leader.primaryValue}
                              </span>
                            </div>
                            <div className="font-bold text-xs sm:text-sm mland:text-[11px] text-[var(--ink)] truncate leading-tight mt-0.5">
                              {leader.q.n}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-[10.5px] mland:text-[8.5px] text-[var(--mut)] min-w-0">
                              <ClubCrest name={leader.t.name} size={13} team={leader.t} club={state.club} isMyClub={leaderIsMe && state.mode === 'm'} />
                              <span className="truncate font-medium text-[var(--ink)]/85">{leader.t.name}</span>
                              {leaderIsMe && <MyTeamBadge size="2xs" />}
                              <PositionBadge role={leader.q.ro} size="2xs" />
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 mland:mt-1 pt-1.5 mland:pt-1 border-t border-[var(--line)]/65 text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular truncate">
                          {leader.breakdown}
                        </div>
                      </button>
                    ) : (
                      <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] text-center space-y-0.5">
                        <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)]">ยังไม่มีผู้ครองอันดับ 1</div>
                        <p className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug">{aw.emptyText}</p>
                      </div>
                    )}

                    {/* Contenders #2 - #5 */}
                    <div className="pt-1 border-t border-[var(--line)]/75 flex-1 flex flex-col">
                      <div className="text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--mut)] mb-1 flex items-center justify-between">
                        <span>ผู้ท้าชิงอันดับ 2–5</span>
                        {runners.length > 0 && <span className="opacity-75">ผลงาน</span>}
                      </div>
                      {runners.length ? (
                        <div className="divide-y divide-[var(--line)]/45">
                          {runners.map((entry, idx) => {
                            const isMine = entry.t.id === state.me;
                            return (
                              <button
                                key={`${aw.id}-${entry.t.id}-${entry.q.n}`}
                                type="button"
                                onClick={() => { SFX.tap(); onInspectPlayer(entry.q, entry.t); }}
                                className={`w-full flex items-center gap-2 mland:gap-1.5 px-1.5 py-1.5 mland:py-0.5 rounded-lg text-left cursor-pointer transition-colors ${
                                  isMine ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/80' : 'hover:bg-[var(--surface-2)]/70'
                                }`}
                              >
                                <span className="w-3.5 text-[11px] mland:text-[9px] font-bold text-[var(--mut)] tabular shrink-0">
                                  {idx + 2}
                                </span>
                                <div className="shrink-0 mland:[&_svg]:w-5 mland:[&_svg]:h-5">
                                  <PlayerFace
                                    player={entry.q}
                                    team={entry.t}
                                    state={state}
                                    club={state.club}
                                    isMyClub={isMine && state.mode === 'm'}
                                    size={26}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11.5px] mland:text-[9.5px] font-semibold text-[var(--ink)] flex items-center gap-1 min-w-0 leading-tight">
                                    <PositionBadge role={entry.q.ro} size="2xs" />
                                    <span className="truncate">{entry.q.n}</span>
                                  </div>
                                  <div className="text-[10px] mland:text-[8px] text-[var(--mut)] truncate flex items-center gap-1 mt-0.5 leading-tight">
                                    <ClubCrest name={entry.t.name} size={11} team={entry.t} club={state.club} isMyClub={isMine && state.mode === 'm'} />
                                    <span className="truncate">{entry.t.name}</span>
                                    {isMine && <MyTeamBadge size="2xs" />}
                                  </div>
                                </div>
                                <span className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] tabular shrink-0">
                                  {entry.runnerValue}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] mland:text-[9px] text-[var(--mut)] py-2 text-center">
                          {leader ? 'ยังไม่มีผู้ท้าชิงอันดับรอง' : 'รอกรรมการบันทึกสถิติการแข่งขัน'}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          {/* 6 Complementary Stat Leaderboards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mland:grid-cols-3 gap-2.5 mland:gap-2 items-stretch">
            {renderLeaderboardCard(<StatIconBadge kind="assist" size="sm" title="👟" />, 'สูงสุด', 'ครั้ง', (q) => q.sa || 0, (q) => `${q.sa || 0}`)}
            {renderLeaderboardCard('🔥', 'มีส่วนร่วมประตู (G+A)', 'รวม', (q) => (q.sg || 0) + (q.sa || 0), (q) => `${(q.sg || 0) + (q.sa || 0)}`)}
            {renderLeaderboardCard('👑', 'แมนออฟเดอะแมตช์', 'MOTM', (q) => q.motm || 0, (q) => `${q.motm || 0}`)}
            {renderLeaderboardCard(
              '⭐',
              'เรตติ้งเฉลี่ยสูงสุด',
              'คะแนน',
              (q) => ((q.sra || 0) >= 1 ? Math.round(((q.srs || 0) / q.sra!) * 100) / 100 : 0),
              (q) => `${((q.srs || 0) / Math.max(1, q.sra || 1)).toFixed(2)}`,
              (q) => (q.sra || 0) >= 1
            )}
            {renderLeaderboardCard('💎', 'มูลค่าตลาดสูงสุด', 'ค่าตัว', vlu, (q) => fmtMoneyNum(vlu(q)))}
            {renderLeaderboardCard('⚡', 'พลังรวมสูงสุด', 'OVR', (q) => q.ov, (q) => `${q.ov}`, undefined, (q) => <OvrBadge ov={q.ov} size="xs" />)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-1.5 mland:gap-1 shrink-0">
        {/* Competition Sub-Navigation Menu: Single compact horizontal pill strip */}
        <div className="order-3 w-auto max-w-full seg-bar bg-[var(--surface)] shadow-xs overflow-x-auto">
          {(
            [
              [0, '🏆', 'บอลลีก'],
              [4, '🏅', 'บอลถ้วย'],
              [2, '⭐', 'สถิติ & รางวัล'],
              [3, '📅', 'ปฏิทิน'],
              [1, '📊', 'จัดอันดับ']
            ] as const
          ).map(([tabIdx, ic, fullLbl]) => (
            <button
              key={fullLbl}
              type="button"
              onClick={() => {
                SFX.tap();
                setCupInitialStats(false);
                if (onShallowPatch) {
                  onShallowPatch((prev) => ({ v: prev.v === 'c' ? 't' : prev.v, tv: tabIdx }));
                } else {
                  onUpdateState((d) => {
                    if (d.v === 'c') d.v = 't';
                    d.tv = tabIdx;
                  });
                }
              }}
              className={`seg-btn py-1.5 mland:py-1 px-3 mland:px-2 text-xs mland:text-[10px] shrink-0 min-w-0 ${
                sub === tabIdx
                  ? 'seg-btn-active hover:text-white!'
                  : 'hover:bg-[var(--surface-2)]/70'
              }`}
            >
              <span className="text-xs mland:text-[10px] leading-none">{ic}</span>
              <span className="truncate">{fullLbl}</span>
            </button>
          ))}
        </div>

        {/* Middle Empty Space (Standings): Zone Legend & League Prize Money */}
        {sub === 0 && vt < 3 && (
          <div className="order-2 flex items-center gap-2 mland:gap-1.5 text-[10.5px] mland:text-[8.5px] text-[var(--mut)] whitespace-nowrap min-w-0">
            <div className="flex items-center gap-2 mland:gap-1.5">
              {vt === 2 && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-xs bg-amber-500 inline-block shrink-0" />
                    <span>1 แชมป์/ACLE</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-xs bg-sky-500 inline-block shrink-0" />
                    <span>2-3 ACL2</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-xs bg-[var(--red)] inline-block shrink-0" />
                    <span>14-16 ตกชั้น</span>
                  </span>
                </>
              )}
              {vt === 1 && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-xs bg-[var(--g)] inline-block shrink-0" />
                    <span>1-2 ขึ้น T1</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-xs bg-sky-500 inline-block shrink-0" />
                    <span>3-6 เพลย์ออฟ</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-xs bg-[var(--red)] inline-block shrink-0" />
                    <span>16-18 ตกชั้น</span>
                  </span>
                </>
              )}
              {vt === 0 && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-xs bg-amber-500 inline-block shrink-0" />
                    <span>1 ขึ้น T2/ชิง T3</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-xs bg-sky-500 inline-block shrink-0" />
                    <span>2-3 ชปล. เพลย์ออฟ</span>
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => { SFX.tap(); setPrizeModalTier(vt); }}
              className="inline-flex items-center gap-1 px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--lamp)] text-[10.5px] mland:text-[8.5px] font-bold text-[var(--ink)] cursor-pointer transition-colors shadow-xs shrink-0"
            >
              <Coins className="w-3 h-3 mland:w-2.5 mland:h-2.5 text-[#b47b00] dark:text-[var(--lamp)] shrink-0" />
              <span>รางวัล</span>
              <span className="text-[var(--g)] font-extrabold tabular">
                +{myLeaguePos
                  ? fmtMoney(getLeaguePrizeMoney(vt, myLeaguePos, tb.length))
                  : fmtMoney(getLeaguePrizeMoney(vt, 1, tb.length))}
              </span>
            </button>
          </div>
        )}

        {/* Left Header Slot: Direct 1-tap League Switcher for Standings & Stats */}
        {sub === 0 || sub === 2 ? (
          <div className="order-1 w-auto seg-bar bg-[var(--surface)] shadow-xs shrink-0 max-w-full overflow-x-auto">
            {[
              [0, 'ไทยลีก 3'],
              [1, 'ไทยลีก 2'],
              [2, 'ไทยลีก 1'],
              ...(worldClubsBundle.total > 0 ? ([[3, '🌏 33 ลีกโลก']] as const) : [])
            ].map(([idx, lbl]) => {
              const tierIdx = Number(idx);
              const isMyTier = tierIdx >= 3 ? me.tier >= 3 : tierIdx === me.tier;
              const active = (vt >= 3 ? 3 : vt) === tierIdx;
              const tabTitle = tierIdx >= 3 ? '33 ลีกโลก' : (TN[tierIdx] || String(lbl));
              return (
                <button
                  key={tierIdx}
                  type="button"
                  title={isMyTier ? `${tabTitle} (ลีกของคุณ)` : tabTitle}
                  onClick={() => {
                    SFX.tap();
                    if (tierIdx >= 3 && me.tier >= 3 && me.leagueCode) {
                      setWorldLeagueCode(me.leagueCode);
                      setWorldConfed('all');
                    }
                    if (onShallowPatch) onShallowPatch(() => ({ lg: tierIdx }));
                    else onUpdateState((d) => { d.lg = tierIdx; });
                  }}
                  className={`seg-btn py-1.5 mland:py-1 px-3 mland:px-2 text-xs mland:text-[10px] min-w-0 whitespace-nowrap ${
                    active
                      ? 'seg-btn-active hover:text-white!'
                      : 'hover:bg-[var(--surface-2)]/70'
                  }`}
                >
                  <span className="truncate">{lbl}</span>
                  {isMyTier && <MyTeamBadge size="2xs" title="ลีกของคุณ" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="order-1 flex items-center gap-1.5 px-3 py-1.5 mland:px-2.5 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px] font-bold text-[var(--ink)] shadow-xs shrink-0">
            <span>{sub === 4 ? '🏅' : sub === 1 ? '📊' : '📅'}</span>
            <span>
              {sub === 4
                ? 'รายการแข่งขันบอลถ้วย'
                : sub === 1
                  ? `อันดับสโมสร & นักเตะ · ซีซั่น ${state.season}`
                  : 'โปรแกรมการแข่งขัน'}
            </span>
          </div>
        )}
      </div>
      {sub === 0 && renderStandings()}
      {sub === 1 && <RankingHubView state={state} onInspectTeam={onInspectTeam} onInspectPlayer={onInspectPlayer} />}
      {sub === 2 && renderStatsAndAwards()}
      {sub === 3 && (
        <ScheduleCalendarView
          state={state}
          onInspectTeam={onInspectTeam}
          onOpenMarket={state.mode === 'm' && onNavigate ? () => onNavigate('k') : undefined}
          onOpenVarReplay={onOpenVarReplay}
          onOpenHighlights={onOpenHighlights}
          onOpenMatchReport={onOpenMatchReport}
        />
      )}
      {sub === 4 && (
        <CupView
          key={cupInitialStats ? 'cup-stats' : 'cup-results'}
          state={state}
          onInspectTeam={onInspectTeam}
          onInspectPlayer={onInspectPlayer}
          onOpenVarReplay={onOpenVarReplay}
          onOpenHighlights={onOpenHighlights}
          onOpenMatchReport={onOpenMatchReport}
          initialRightPane={cupInitialStats ? 'stats' : 'results'}
        />
      )}

      {prizeModalTier !== null && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-3 sm:p-5 mland:p-2.5">
          <div className="w-full max-w-lg max-h-[88dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl overflow-hidden flex flex-col">
            <div className="shrink-0 px-4 py-3 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]/70 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-sm mland:text-xs font-display flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-[#b47b00] dark:text-[var(--lamp)] shrink-0" />
                  <span>เงินรางวัลบอลลีกประจำฤดูกาล</span>
                </h3>
                <p className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate">
                  จ่ายเข้าคลังสโมสรเมื่อจบฤดูกาลตามอันดับและระดับลีก
                </p>
              </div>
              <button
                type="button"
                onClick={() => { SFX.tap(); setPrizeModalTier(null); }}
                aria-label="ปิดหน้าต่าง"
                className="btn-icon rounded-full!"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="shrink-0 px-4 pt-2.5 mland:px-3 mland:pt-2">
              <div className={`seg-bar w-full grid ${me.tier >= 3 || prizeModalTier === 3 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {[0, 1, 2, ...(me.tier >= 3 || prizeModalTier === 3 ? [3] : [])].map((tierIdx) => {
                  const isWorldTab = tierIdx === 3;
                  const tabLabel = isWorldTab
                    ? activeWorldSpec
                      ? `${activeWorldSpec.flag} ${activeWorldSpec.shortName}`
                      : '🌏 ลีกต่างแดน'
                    : TN[tierIdx];
                  const isMyTab = isWorldTab ? me.tier >= 3 : tierIdx === me.tier;
                  return (
                    <button
                      key={tierIdx}
                      type="button"
                      onClick={() => { SFX.tap(); setPrizeModalTier(tierIdx); }}
                      className={`seg-btn py-1 mland:py-0.5 inline-flex items-center justify-center gap-1 truncate ${prizeModalTier === tierIdx ? 'seg-btn-active' : ''}`}
                    >
                      <span className="truncate">{tabLabel}</span>
                      {isMyTab && <MyTeamBadge size="2xs" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-3 grid grid-cols-2 gap-1.5 mland:gap-1 content-start">
              {(() => {
                const isWorldPrize = prizeModalTier >= 3;
                const modalCount = isWorldPrize
                  ? (activeWorldSpec?.teamCount || Math.max(10, worldLeagueTable.length || 20))
                  : (prizeModalTier === 0 ? 12 : prizeModalTier === 1 ? 18 : 16);
                const myWorldRank =
                  me.tier >= 3 && activeWorldSpec?.code === me.leagueCode
                    ? worldLeagueTable.findIndex((t) => t.id === state.me) + 1
                    : 0;
                return Array.from({ length: modalCount }, (_, idx) => {
                  const rank = idx + 1;
                  const amount = getLeaguePrizeMoney(
                    prizeModalTier,
                    rank,
                    modalCount,
                    isWorldPrize ? activeWorldSpec?.code : undefined
                  );
                  const zb = getRankZoneBadge(
                    prizeModalTier,
                    rank,
                    modalCount,
                    isWorldPrize ? { leagueCode: activeWorldSpec?.code } : undefined
                  );
                  const isMyCurRank = isWorldPrize
                    ? me.tier >= 3 && myWorldRank === rank
                    : prizeModalTier === me.tier &&
                      myLeaguePos === rank &&
                      vt === me.tier &&
                      (me.tier !== 0 || (me.zone ?? 0) === t3Zone);
                  return (
                    <div
                      key={rank}
                      className={`px-2.5 py-1.5 mland:py-1 rounded-xl border flex items-center justify-between gap-2 text-xs mland:text-[10.5px] ${
                        isMyCurRank
                          ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] font-bold'
                          : zb.tone === 'champ'
                            ? 'bg-amber-500/10 border-amber-500/35'
                            : zb.tone === 'promo' || zb.tone === 'acl_elite'
                              ? 'bg-[var(--g-soft)]/35 border-[var(--g)]/30'
                              : zb.tone === 'playoff' || zb.tone === 'acl2'
                                ? 'bg-sky-500/10 border-sky-500/30'
                                : zb.tone === 'rel'
                                  ? 'bg-[var(--red-soft)]/25 border-[var(--red)]/25'
                                  : 'bg-[var(--surface-2)]/60 border-[var(--line)]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0 font-bold tabular">
                        <span>{rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</span>
                        <span className="truncate text-[var(--ink)]">
                          {rank === 1 ? (prizeModalTier === 0 ? 'แชมป์โซน' : 'แชมป์ลีก') : `อันดับ ${rank}`}
                        </span>
                        {isMyCurRank && <MyTeamBadge size="2xs" />}
                      </span>
                      <span className="font-extrabold tabular text-[var(--g)] shrink-0">
                        +{fmtMoney(amount)}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const ScheduleCalendarView = React.memo<{
  state: GameState;
  onInspectTeam: (teamId: number) => void;
  onPlayNext?: () => void;
  onOpenMarket?: () => void;
  onOpenVarReplay?: (homeId: number, awayId: number, records: VarReplayRecord[]) => void;
  onOpenHighlights?: (homeId: number, awayId: number, clips: MatchHighlightClip[], title?: string, scoreSummary?: string) => void;
  onOpenMatchReport?: (report: ArchivedMatchReport, title?: string) => void;
}>(({ state, onInspectTeam, onPlayNext, onOpenMarket, onOpenVarReplay, onOpenHighlights, onOpenMatchReport }) => {
  const me = state.teams[state.me];
  const myLeagueName = useMemo(() => getTeamLeagueName(me, { includeZone: true, withFlag: true }), [me]);
  const totalMd = state.fx.length || 30;
  const cal = useMemo(() => getSeasonCalendarMds(totalMd), [totalMd]);

  const months = useMemo(() => {
    const chunkCount = totalMd <= 24 ? 4 : 5;
    const baseSize = Math.floor(totalMd / chunkCount);
    const rem = totalMd % chunkCount;
    const out: { idx: number; label: string; range: string; start: number; end: number }[] = [];
    let cursor = 0;
    for (let i = 0; i < chunkCount; i++) {
      const size = baseSize + (i < rem ? 1 : 0);
      const start = cursor;
      const end = Math.min(totalMd, cursor + size);
      out.push({
        idx: i,
        label: `เดือน ${i + 1}`,
        range: `${start + 1}–${end}`,
        start,
        end
      });
      cursor = end;
    }
    return out;
  }, [totalMd]);

  const defaultMonth = useMemo(() => {
    if (state.md >= totalMd) return Math.max(0, months.length - 1);
    const found = months.findIndex((m) => state.md >= m.start && state.md < m.end);
    return found >= 0 ? found : 0;
  }, [state.md, totalMd, months]);

  const [monthIdx, setMonthIdx] = useState<number>(defaultMonth);
  const currentNextIdx = Math.min(state.md, Math.max(0, totalMd - 1));
  const [roundPreview, setRoundPreview] = useState<number>(currentNextIdx);
  const [leftTab, setLeftTab] = useState<'round' | 'cup'>('round');
  const tw = getTransferWindowInfo(state);

  const visibleMdIndices = useMemo(
    () =>
      monthIdx === -1
        ? Array.from({ length: totalMd }, (_, i) => i)
        : Array.from(
            { length: Math.max(0, (months[monthIdx]?.end ?? totalMd) - (months[monthIdx]?.start ?? 0)) },
            (_, i) => (months[monthIdx]?.start ?? 0) + i
          ).filter((i) => i < totalMd),
    [monthIdx, months, totalMd]
  );

  const schedOppStatsMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof teamStats>>();
    visibleMdIndices.forEach((mdIdx) => {
      const pair = state.fx[mdIdx]?.find((x) => x.includes(state.me));
      if (!pair) return;
      const oppId = pair[0] === state.me ? pair[1] : pair[0];
      const opp = state.teams[oppId];
      if (opp && !map.has(opp.id)) {
        map.set(opp.id, teamStats(opp, state));
      }
    });
    return map;
  }, [visibleMdIndices, state]);

  const previewRoundPairs = state.fx[roundPreview] || [];
  const cupLogs = state.cupLog || [];
  const playedCount = Math.min(state.md, totalMd);
  const progressPct = Math.round((playedCount / Math.max(1, totalMd)) * 100);
  const hasMidweekCup = Boolean(state.pc || state.pa || state.plc || state.psc || state.pdc || (state.ppo && state.po?.userPair));

  const activeRangeText =
    monthIdx === -1
      ? `ทั้งหมด ${totalMd} นัด`
      : `นัดที่ ${(months[monthIdx]?.start ?? 0) + 1}–${Math.min(totalMd, months[monthIdx]?.end ?? totalMd)}`;

  const milestoneSchedule = [
    { icon: '✍🏻', name: 'ตลาดซื้อขายรอบ 1', rounds: `นัด ${cal.w1Start + 1}–${cal.w1End}` },
    { icon: '✍🏻', name: 'ตลาดซื้อขายรอบ 2', rounds: `นัด ${cal.w2Start + 1}–${cal.w2End}` },
    { icon: EXTRA_CUP_META.sc.icon, name: EXTRA_CUP_META.sc.name, rounds: `นัด ${cal.sc.join(', ')}` },
    { icon: '🌏', name: 'บอลถ้วยทวีป', rounds: `นัด ${cal.ac.join(', ')}` },
    { icon: EXTRA_CUP_META.lc.icon, name: EXTRA_CUP_META.lc.name, rounds: `นัด ${cal.lc.join(', ')}` },
    { icon: EXTRA_CUP_META.dc.icon, name: EXTRA_CUP_META.dc.name, rounds: `นัด ${cal.dc.join(', ')}` },
    { icon: '🏆', name: 'ถ้วยประชาชน', rounds: `นัด ${cal.cup.join(', ')}` }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[0.88fr_1.12fr] mland:grid-cols-[0.86fr_1.14fr] gap-2.5 mland:gap-2 flex-1 min-h-0 overflow-hidden">
      {/* LEFT COLUMN: Compact Season Overview + Tabbed League Round & Cup Schedule */}
      <div className="flex flex-col gap-2 mland:gap-1.5 min-h-0 overflow-hidden">
        {/* Season Overview Card */}
        <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs shrink-0 space-y-2 mland:space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ClubCrest
                name={me.name}
                size={26}
                team={me}
                club={state.club}
                isMyClub={state.mode === 'm'}
              />
              <div className="min-w-0">
                <div className="font-bold text-xs sm:text-sm mland:text-[11px] text-[var(--ink)] truncate">
                  ฤดูกาลที่ {state.season} · {myLeagueName}
                </div>
                <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
                  <span>แข่งแล้ว {playedCount}/{totalMd} นัด ({progressPct}%) ·</span>
                  <WdlRecordBadges w={me.w} d={me.d} l={me.l} size="2xs" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onOpenMarket && state.mode === 'm' ? (
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onOpenMarket();
                  }}
                  className={`h-7 mland:h-6 px-2.5 mland:px-2 rounded-lg text-[11px] mland:text-[9px] font-bold border inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                    tw.open
                      ? 'bg-[var(--g-soft)] border-[var(--g)]/50 text-[var(--g)] hover:border-[var(--g)]'
                      : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span>{tw.shortLabel}</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                </button>
              ) : (
                <span
                  className={`text-[11px] mland:text-[9px] font-bold whitespace-nowrap ${
                    tw.open ? 'text-[var(--g)]' : 'text-[var(--mut)]'
                  }`}
                >
                  {tw.shortLabel}
                </span>
              )}
              {onPlayNext && (
                <button
                  type="button"
                  onClick={onPlayNext}
                  className="btn btn-sm btn-gold px-3 mland:px-2"
                >
                  {state.ppo && state.po?.userPair
                    ? '🔥 แข่งเพลย์ออฟ'
                    : state.md >= totalMd
                      ? '🏁 สรุปจบฤดูกาล'
                      : state.pa
                        ? '🌏 แข่งถ้วยทวีป'
                        : state.psc
                          ? `${EXTRA_CUP_META.sc.icon} แข่ง${EXTRA_CUP_META.sc.short}`
                          : state.plc
                            ? `${EXTRA_CUP_META.lc.icon} แข่ง${EXTRA_CUP_META.lc.short}`
                            : state.pdc
                              ? `${EXTRA_CUP_META.dc.icon} แข่ง${EXTRA_CUP_META.dc.short}`
                              : state.pc
                                ? '🏆 แข่งถ้วยประชาชน'
                                : `▶ แข่งนัดที่ ${state.md + 1}`}
                </button>
              )}
            </div>
          </div>

          {/* Season Progress Bar */}
          <div className="h-1.5 mland:h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--g)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Unboxed Milestone Key Line */}
          <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug tabular">
            <span className="font-semibold text-[var(--g)]">ตลาด 1: นัด {cal.w1Start + 1}–{cal.w1End}</span>
            <span className="mx-1.5 opacity-45">·</span>
            <span className="font-semibold text-[var(--g)]">ตลาด 2: นัด {cal.w2Start + 1}–{cal.w2End}</span>
            <span className="mx-1.5 opacity-45">·</span>
            <span>ทวีป: {cal.ac.join(', ')}</span>
            <span className="mx-1.5 opacity-45">·</span>
            <span>ถ้วย ปชช.: {cal.cup.join(', ')}</span>
          </div>

          {/* Queued Midweek Cup / Playoff Alert */}
          {hasMidweekCup && (
            <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/70 flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
              <span className="font-bold text-[#7a4f00] dark:text-[var(--lamp)] truncate">
                {state.ppo && state.po?.userPair
                  ? `🔥 คิวแข่งพิเศษ: ${state.po.userPair.label}`
                  : state.pa && state.ac
                    ? `🌏 คิวแข่งกลางสัปดาห์: บอลถ้วยทวีป ${RN[state.ac.r] || `รอบ ${state.ac.r + 1}`}`
                    : state.psc && state.sc
                      ? `${EXTRA_CUP_META.sc.icon} คิวแข่งกลางสัปดาห์: ${EXTRA_CUP_META.sc.name} (ชิงชนะเลิศ)`
                      : state.plc && state.lc
                        ? `${EXTRA_CUP_META.lc.icon} คิวแข่งกลางสัปดาห์: ${EXTRA_CUP_META.lc.name} ${RN[state.lc.r] || `รอบ ${state.lc.r + 1}`}`
                        : state.pdc && state.dc
                          ? `${EXTRA_CUP_META.dc.icon} คิวแข่งกลางสัปดาห์: ${EXTRA_CUP_META.dc.name} ${RN[state.dc.r] || `รอบ ${state.dc.r + 1}`}`
                          : `🏆 คิวแข่งกลางสัปดาห์: ถ้วยประชาชน ${RN[state.cup.r] || `รอบ ${state.cup.r + 1}`}`}
              </span>
              {onPlayNext && (
                <button type="button" onClick={onPlayNext} className="btn btn-xs btn-gold shrink-0">
                  ▶ ลงสนาม
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom-Left Tabbed Panel: League Round Fixtures / Cup History & Milestones */}
        <div className="flex-1 min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-col overflow-hidden">
          <div className="shrink-0 px-2.5 py-1.5 mland:px-2 mland:py-1 bg-[var(--surface-2)]/70 border-b border-[var(--line)] flex items-center justify-between gap-2">
            <div className="seg-bar shrink-0">
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setLeftTab('round');
                }}
                className={`seg-btn py-1 mland:py-0.5 px-2.5 mland:px-2 text-[11px] mland:text-[9.5px] ${
                  leftTab === 'round' ? 'seg-btn-active' : ''
                }`}
              >
                <Calendar className="w-3 h-3 shrink-0" />
                <span>คู่อื่นในลีก</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setLeftTab('cup');
                }}
                className={`seg-btn py-1 mland:py-0.5 px-2.5 mland:px-2 text-[11px] mland:text-[9.5px] ${
                  leftTab === 'cup' ? 'seg-btn-active' : ''
                }`}
              >
                <Trophy className="w-3 h-3 shrink-0" />
                <span>บอลถ้วย</span>
                {cupLogs.length > 0 && (
                  <span className="tabular opacity-80">({cupLogs.length})</span>
                )}
              </button>
            </div>

            {leftTab === 'round' && (
              <div className="flex items-center gap-1 shrink-0">
                {roundPreview !== currentNextIdx && (
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setRoundPreview(currentNextIdx);
                    }}
                    className="px-2 py-0.5 rounded-md bg-[var(--g-soft)] text-[var(--g)] text-[10px] mland:text-[8.5px] font-bold hover:brightness-95 cursor-pointer whitespace-nowrap"
                    title="กลับไปยังนัดปัจจุบัน"
                  >
                    นัดปัจจุบัน
                  </button>
                )}
                <button
                  type="button"
                  disabled={roundPreview <= 0}
                  onClick={() => {
                    SFX.tap();
                    setRoundPreview((r) => Math.max(0, r - 1));
                  }}
                  aria-label="นัดก่อนหน้า"
                  className="w-6 h-6 mland:w-5.5 mland:h-5.5 rounded-md bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] disabled:opacity-40 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] mland:text-[9.5px] font-bold tabular text-[var(--ink)] min-w-[54px] text-center">
                  นัด {roundPreview + 1}/{totalMd}
                </span>
                <button
                  type="button"
                  disabled={roundPreview >= totalMd - 1}
                  onClick={() => {
                    SFX.tap();
                    setRoundPreview((r) => Math.min(totalMd - 1, r + 1));
                  }}
                  aria-label="นัดถัดไป"
                  className="w-6 h-6 mland:w-5.5 mland:h-5.5 rounded-md bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] disabled:opacity-40 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 mland:p-1.5">
            {leftTab === 'round' ? (
              <div className="divide-y divide-[var(--line)]/55">
                {previewRoundPairs.map(([hid, aid], i) => {
                  const ht = state.teams[hid];
                  const at = state.teams[aid];
                  if (!ht || !at) return null;
                  const involvesMe = hid === state.me || aid === state.me;
                  const rec = involvesMe ? state.schedRes?.[roundPreview] : undefined;
                  return (
                    <div
                      key={i}
                      className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 py-1.5 mland:px-1.5 mland:py-1 rounded-lg text-[11.5px] mland:text-[9.5px] ${
                        involvesMe ? 'bg-[var(--lamp-soft)]/70 font-bold' : 'hover:bg-[var(--surface-2)]/45'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onInspectTeam(hid)}
                        className="min-w-0 flex items-center justify-end gap-1.5 text-right hover:text-[var(--g)] cursor-pointer transition-colors"
                      >
                        {hid === state.me && <MyTeamBadge size="2xs" />}
                        <span className={`truncate ${hid === state.me ? 'text-[#8a5b00] dark:text-[var(--lamp)]' : ''}`}>
                          {ht.name}
                        </span>
                        <span className="shrink-0 inline-flex">
                          <ClubCrest name={ht.name} size={15} team={ht} club={state.club} isMyClub={state.mode === 'm' && hid === state.me} />
                        </span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {rec && onOpenMatchReport ? (
                          <button
                            type="button"
                            onClick={() => onOpenMatchReport(rec, `${myLeagueName} · นัดที่ ${roundPreview + 1}`)}
                            title="ดูหน้าสรุปหลังเกม"
                            className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-[11px] mland:text-[9px] font-extrabold tabular inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>{rec.gh}-{rec.ga}</span>
                            <span className="text-[9px] opacity-80">📊</span>
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[10.5px] mland:text-[9px] font-bold tabular text-[var(--mut)]">
                            {rec ? `${rec.gh}-${rec.ga}` : 'vs'}
                          </span>
                        )}
                        {rec?.highlightClips?.length && onOpenHighlights ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenHighlights(
                                rec.h,
                                rec.a,
                                rec.highlightClips!,
                                `${myLeagueName} · นัดที่ ${roundPreview + 1}`,
                                `${ht.name} ${rec.gh} - ${rec.ga} ${at.name}`
                              )
                            }
                            className="px-1.5 py-0.5 rounded-md bg-amber-500/18 border border-amber-400/55 text-amber-700 dark:text-amber-300 text-[9.5px] font-extrabold hover:bg-amber-500/28 cursor-pointer"
                            title="ชมไฮไลท์การแข่งขัน"
                          >
                            🎬 {rec.highlightClips.length}
                          </button>
                        ) : null}
                        {rec?.varReplays?.length && onOpenVarReplay ? (
                          <button
                            type="button"
                            onClick={() => onOpenVarReplay(rec.h, rec.a, rec.varReplays!)}
                            className="px-1.5 py-0.5 rounded-md bg-sky-500/18 border border-sky-400/50 text-sky-700 dark:text-sky-300 text-[9.5px] font-extrabold hover:bg-sky-500/28 cursor-pointer"
                            title="ดูภาพช้า VAR ย้อนหลัง"
                          >
                            VAR
                          </button>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => onInspectTeam(aid)}
                        className="min-w-0 flex items-center justify-start gap-1.5 text-left hover:text-[var(--g)] cursor-pointer transition-colors"
                      >
                        <span className="shrink-0 inline-flex">
                          <ClubCrest name={at.name} size={15} team={at} club={state.club} isMyClub={state.mode === 'm' && aid === state.me} />
                        </span>
                        <span className={`truncate ${aid === state.me ? 'text-[#8a5b00] dark:text-[var(--lamp)]' : ''}`}>
                          {at.name}
                        </span>
                        {aid === state.me && <MyTeamBadge size="2xs" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2.5 mland:space-y-1.5">
                {cupLogs.length > 0 && (
                  <div className="divide-y divide-[var(--line)]/55">
                    {cupLogs.map((cl, idx) => {
                      const ht = state.teams[cl.h];
                      const at = state.teams[cl.a];
                      const compLabel =
                        cl.kind === 'po'
                          ? cl.roundLabel || '🔥 เพลย์ออฟ'
                          : cl.comp === 'asia'
                            ? `🌏 ทวีป · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`
                            : cl.comp === 'sc'
                              ? `${EXTRA_CUP_META.sc.icon} ซูเปอร์คัพ`
                              : cl.comp === 'lc'
                                ? `${EXTRA_CUP_META.lc.icon} ลีกคัพ · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`
                                : cl.comp === 'dc'
                                  ? `${EXTRA_CUP_META.dc.icon} ดิวิชั่น · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`
                                  : `🏆 ปชช. · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`;
                      const cupTitle =
                        cl.kind === 'po'
                          ? cl.roundLabel || 'รอบเพลย์ออฟ'
                          : cl.comp === 'asia'
                            ? `บอลถ้วยทวีป · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`
                            : cl.comp === 'cup'
                              ? `ถ้วยประชาชน · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`
                              : `${EXTRA_CUP_META[cl.comp].name} · ${cl.comp === 'sc' ? 'ชิงชนะเลิศ' : RN[cl.r] || `รอบ ${cl.r + 1}`}`;
                      return (
                        <div key={idx} className="py-1.5 px-1 flex items-center justify-between gap-2 text-[11px] mland:text-[9.5px]">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)]">
                              {compLabel}
                              {cl.penText ? ` · ${cl.penText}` : ''}
                            </div>
                            <div className="font-semibold text-[var(--ink)] flex items-center gap-1 min-w-0 tabular">
                              {ht?.id === state.me && <MyTeamBadge size="2xs" />}
                              <span className="truncate">{ht?.name}</span>
                              <b className="mx-0.5 shrink-0">{cl.gh} - {cl.ga}</b>
                              <span className="truncate">{at?.name}</span>
                              {at?.id === state.me && <MyTeamBadge size="2xs" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {cl.highlightClips?.length && onOpenHighlights && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenHighlights(
                                    cl.h,
                                    cl.a,
                                    cl.highlightClips!,
                                    cupTitle,
                                    `${ht?.name || ''} ${cl.gh} - ${cl.ga} ${at?.name || ''}${cl.penText ? ` (${cl.penText})` : ''}`
                                  )
                                }
                                className="px-1.5 py-0.5 rounded-md bg-amber-500/18 border border-amber-400/55 text-amber-700 dark:text-amber-300 text-[10px] mland:text-[8.5px] font-extrabold hover:bg-amber-500/28 cursor-pointer whitespace-nowrap"
                                title="ชมไฮไลท์การแข่งขัน"
                              >
                                🎬 {cl.highlightClips.length}
                              </button>
                            )}
                            {cl.varReplays?.length && onOpenVarReplay && (
                              <button
                                type="button"
                                onClick={() => onOpenVarReplay(cl.h, cl.a, cl.varReplays!)}
                                className="px-1.5 py-0.5 rounded-md bg-sky-500/18 border border-sky-400/50 text-sky-700 dark:text-sky-300 text-[10px] mland:text-[8.5px] font-extrabold hover:bg-sky-500/28 cursor-pointer whitespace-nowrap"
                                title="ดูภาพช้า VAR ย้อนหลัง"
                              >
                                🖥 VAR ({cl.varReplays.length})
                              </button>
                            )}
                            {onOpenMatchReport && (
                              <button
                                type="button"
                                onClick={() => onOpenMatchReport(cl, cupTitle)}
                                className="px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-[var(--ink)] text-[10px] mland:text-[8.5px] font-bold cursor-pointer transition-colors whitespace-nowrap"
                                title="ดูหน้าสรุปหลังเกม"
                              >
                                📊 สรุป
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className={cupLogs.length > 0 ? 'pt-2 border-t border-[var(--line)]' : ''}>
                  <div className="text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] mb-1 px-1">
                    กำหนดการสำคัญประจำฤดูกาล
                  </div>
                  <div className="divide-y divide-[var(--line)]/45">
                    {milestoneSchedule.map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-2 px-1 py-1.5 mland:py-1 text-[11px] mland:text-[9.5px]">
                        <span className="font-semibold text-[var(--ink)] truncate">
                          <span className="mr-1.5">{item.icon}</span>
                          {item.name}
                        </span>
                        <span className="tabular font-bold text-[var(--mut)] shrink-0">
                          {item.rounds}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Main Matchday Calendar Stage */}
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs h-full flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 pb-2 mland:pb-1.5 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
          <div className="seg-bar overflow-x-auto max-w-full">
            {months.map((m) => {
              const isCurMonth = state.md >= m.start && state.md < m.end;
              const isActive = monthIdx === m.idx;
              return (
                <button
                  key={m.idx}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setMonthIdx(m.idx);
                  }}
                  className={`seg-btn py-1 mland:py-0.5 px-2.5 mland:px-2 text-[11px] mland:text-[9.5px] whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'seg-btn-active'
                      : isCurMonth
                        ? 'text-[#8a5b00] dark:text-[var(--lamp)] font-extrabold hover:bg-[var(--lamp-soft)]/50'
                        : ''
                  }`}
                >
                  <span>{m.label}</span>
                  {isCurMonth && !isActive && <span className="text-[9px] leading-none">★</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setMonthIdx(-1);
              }}
              className={`seg-btn py-1 mland:py-0.5 px-2.5 mland:px-2 text-[11px] mland:text-[9.5px] whitespace-nowrap shrink-0 ${
                monthIdx === -1 ? 'seg-btn-active' : ''
              }`}
            >
              ทั้ง {totalMd} นัด
            </button>
          </div>

          <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] tabular shrink-0">
            {activeRangeText}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5 flex-1 min-h-0 overflow-y-auto pt-2.5 mland:pt-1.5 pr-0.5 content-start">
          {visibleMdIndices.map((mdIdx) => {
            const mdNum = mdIdx + 1;
            const rd = state.fx[mdIdx];
            const pair = rd?.find((x) => x.includes(state.me));
            if (!pair) return null;
            const isHome = pair[0] === state.me;
            const opp = state.teams[isHome ? pair[1] : pair[0]];
            if (!opp) return null;
            const isDerby = (pair[0] ^ 1) === pair[1];
            const ost = schedOppStatsMap.get(opp.id) || teamStats(opp, state);
            const isNext = mdIdx === state.md && !hasMidweekCup;
            const isPast = mdIdx < state.md;
            const isPreviewed = leftTab === 'round' && roundPreview === mdIdx;
            const isWindowOpen = (mdIdx >= cal.w1Start && mdIdx < cal.w1End) || (mdIdx >= cal.w2Start && mdIdx < cal.w2End);
            const rec = state.schedRes?.[mdIdx];

            const cupIdx = cal.cup.indexOf(mdNum);
            const lcIdx = cal.lc.indexOf(mdNum);
            const dcIdx = cal.dc.indexOf(mdNum);
            const isSuperCup = cal.sc.includes(mdNum);
            const asiaIdx = cal.ac.indexOf(mdNum);

            const milestoneTag = isSuperCup
              ? { label: '🏅 ซูเปอร์คัพ', cls: 'text-amber-700 dark:text-[var(--lamp)]', title: EXTRA_CUP_META.sc.name }
              : asiaIdx >= 0
                ? { label: '🌏 ทวีป', cls: 'text-[var(--g)]', title: `กำหนดถ้วยทวีป ${RN[asiaIdx]}` }
                : lcIdx >= 0
                  ? { label: '🥇 ลีกคัพ', cls: 'text-sky-700 dark:text-sky-400', title: `กำหนด${EXTRA_CUP_META.lc.name} ${RN[lcIdx]}` }
                  : dcIdx >= 0
                    ? { label: '🛡️ ดิวิชั่น', cls: 'text-emerald-700 dark:text-emerald-400', title: `กำหนด${EXTRA_CUP_META.dc.name} ${RN[dcIdx]}` }
                    : cupIdx >= 0
                      ? { label: '🏆 ถ้วย ปชช.', cls: 'text-[#8a5b00] dark:text-[var(--lamp)]', title: `กำหนดถ้วยประชาชน ${RN[cupIdx]}` }
                      : isWindowOpen
                        ? { label: '🟢 ตลาดเปิด', cls: 'text-[var(--g)]', title: 'ช่วงเปิดตลาดซื้อขาย' }
                        : null;

            let resLabel = '';
            let resCls = 'bg-[var(--surface-2)] text-[var(--mut)]';
            if (rec) {
              const myG = rec.h === state.me ? rec.gh : rec.ga;
              const opG = rec.h === state.me ? rec.ga : rec.gh;
              if (myG > opG) {
                resLabel = `ชนะ ${myG}-${opG}`;
                resCls = 'bg-[var(--g)] text-white';
              } else if (myG < opG) {
                resLabel = `แพ้ ${myG}-${opG}`;
                resCls = 'bg-[var(--red)] text-white';
              } else {
                resLabel = `เสมอ ${myG}-${opG}`;
                resCls = 'bg-[var(--lamp)] text-[#261900]';
              }
            } else if (isPast) {
              resLabel = 'แข่งแล้ว';
            }

            return (
              <div
                key={mdNum}
                role="button"
                tabIndex={0}
                onClick={() => {
                  SFX.tap();
                  setLeftTab('round');
                  setRoundPreview(mdIdx);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    SFX.tap();
                    setLeftTab('round');
                    setRoundPreview(mdIdx);
                  }
                }}
                className={`p-2.5 mland:p-2 rounded-xl border flex flex-col justify-between gap-2 mland:gap-1.5 transition-colors cursor-pointer ${
                  isNext
                    ? 'bg-[var(--lamp-soft)]/75 border-[var(--lamp)] shadow-xs'
                    : isPreviewed
                      ? 'bg-[var(--surface-2)]/75 border-[var(--g)]/70'
                      : isPast
                        ? 'bg-[var(--surface-2)]/35 border-[var(--line)]/85 hover:border-[var(--line)]'
                        : 'bg-[var(--surface-2)]/65 border-[var(--line)] hover:border-[var(--g)]/60'
                }`}
              >
                {/* Clean Unboxed Top Metadata Line */}
                <div className="flex items-center justify-between gap-1.5 text-[10.5px] mland:text-[9px] tabular leading-none">
                  <div className="flex items-center gap-1 min-w-0 truncate">
                    <span className={`font-extrabold ${isNext ? 'text-[#8a5b00] dark:text-[var(--lamp)]' : 'text-[var(--ink)]'}`}>
                      นัด {mdNum}
                    </span>
                    <span className="text-[var(--mut)]/50">·</span>
                    <span className="font-semibold text-[var(--mut)]">
                      {isHome ? '🏠 เหย้า' : '✈️ เยือน'}
                    </span>
                    {isDerby && (
                      <>
                        <span className="text-[var(--mut)]/50">·</span>
                        <span className="text-[var(--red)] font-extrabold">🔥 ดาร์บี้</span>
                      </>
                    )}
                  </div>
                  {milestoneTag && (
                    <span
                      title={milestoneTag.title}
                      className={`font-bold shrink-0 ${milestoneTag.cls}`}
                    >
                      {milestoneTag.label}
                    </span>
                  )}
                </div>

                {/* Opponent + Result / Action Row */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      SFX.tap();
                      onInspectTeam(opp.id);
                    }}
                    className="flex items-center gap-2 text-left cursor-pointer group min-w-0 flex-1"
                    title={`ดูข้อมูลทีม ${opp.name}`}
                  >
                    <span className="shrink-0 inline-flex mland:[&>svg]:w-6 mland:[&>svg]:h-6">
                      <ClubCrest name={opp.name} size={28} team={opp} club={state.club} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs sm:text-[13px] mland:text-[10.5px] truncate group-hover:text-[var(--g)] transition-colors">
                        {opp.name}
                      </div>
                      <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular truncate">
                        เฉลี่ย <span className={`font-display font-extrabold ${ovTextColorClass(ost.ovSq)}`}>{ost.ovSq}</span>
                        {' · '}
                        <span className="text-[var(--g)] font-bold">ตัวจริง</span>{' '}
                        <span className={`font-display font-black ${ovTextColorClass(ost.ovXi)}`}>{ost.ovXi}</span>
                      </div>
                    </div>
                  </button>

                  {isPast ? (
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {rec?.highlightClips?.length && onOpenHighlights ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenHighlights(
                              rec.h,
                              rec.a,
                              rec.highlightClips!,
                              `${myLeagueName} · นัดที่ ${mdNum}`,
                              `${state.teams[rec.h]?.name || ''} ${rec.gh} - ${rec.ga} ${state.teams[rec.a]?.name || ''}`
                            )
                          }
                          title="ชมไฮไลท์การแข่งขัน"
                          className="px-1.5 py-1 mland:py-0.5 rounded-lg bg-amber-500/18 border border-amber-400/55 text-amber-700 dark:text-amber-300 text-[10px] mland:text-[8.5px] font-extrabold hover:bg-amber-500/28 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          🎬 {rec.highlightClips.length}
                        </button>
                      ) : null}
                      {rec?.varReplays?.length && onOpenVarReplay ? (
                        <button
                          type="button"
                          onClick={() => onOpenVarReplay(rec.h, rec.a, rec.varReplays!)}
                          title="ดูภาพช้า VAR ย้อนหลัง"
                          className="px-1.5 py-1 mland:py-0.5 rounded-lg bg-sky-500/18 border border-sky-400/50 text-sky-700 dark:text-sky-300 text-[10px] mland:text-[8.5px] font-extrabold hover:bg-sky-500/28 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          🖥 {rec.varReplays.length}
                        </button>
                      ) : null}
                      {rec && onOpenMatchReport ? (
                        <button
                          type="button"
                          onClick={() => onOpenMatchReport(rec, `${myLeagueName} · นัดที่ ${mdNum}`)}
                          title="ดูหน้าสรุปหลังเกม"
                          className={`inline-flex items-center gap-1 px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg text-[10.5px] mland:text-[9px] font-bold tabular shrink-0 cursor-pointer hover:brightness-110 transition-all shadow-2xs ${resCls}`}
                        >
                          <span>{resLabel}</span>
                          <span className="text-[9.5px] opacity-90">📊</span>
                        </button>
                      ) : (
                        <span className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg text-[10.5px] mland:text-[9px] font-bold tabular shrink-0 ${resCls}`}>
                          {resLabel}
                        </span>
                      )}
                    </div>
                  ) : isNext ? (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[10px] mland:text-[8.5px] font-extrabold shrink-0">
                      ถัดไป
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        SFX.tap();
                        onInspectTeam(opp.id);
                      }}
                      className="text-[11px] mland:text-[9px] text-[var(--g)] font-bold shrink-0 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      ส่องทีม ›
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});


