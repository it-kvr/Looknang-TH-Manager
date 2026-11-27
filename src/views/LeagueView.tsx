import React, { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Coins, Trophy, X } from 'lucide-react';
import type { ArchivedMatchReport, MainTab, MatchHighlightClip, Player, Team, GameState, VarReplayRecord } from '../types/game';
import { RN, TN, getTeamTrainingPlan, syncTrainingFocusToPlan } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { fmtMoney, fmtMoneyNum, clamp } from '../utils/math';
import { xi, vlu, ensureCon, logFin } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import {
  sortTable,
  getTransferWindowInfo,
  teamStats,
  getIncomingOffers,
  getActiveBoardEffects,
  getBoardDirectiveProgress,
  ensureTeamFans,
  fmtFansShort,
  EXTRA_CUP_META,
  getLeaguePrizeMoney,
  MAIN_SPONSOR_PACKAGES,
  evaluateMainSponsorEligibility,
  calcMainSponsorPayout,
  PARTNER_DEAL_CATALOG,
  getActivePartnerDeals,
  getMaxPartnerSlots,
  getLeagueTransferContext,
  getFacilityCondition,
  getFacilityRenovateCost,
  getFacilityUpgradeCost,
  getActiveClubDemands,
  checkClubDemandsCompletion
} from '../engine/simulation';
import { resolveStateSponsorBrand } from '../data/sponsorBrands';
import type { FacilityKey } from '../types/game';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { PositionBadge } from '../components/PositionBadge';
import { StatIconBadge } from '../components/StatIconBadge';
import { MyTeamBadge } from '../components/MyTeamBadge';
import { OvrBadge } from '../components/OvrBadge';
import { WdlFormStrip, WdlRecordBadges, getWdlDotClass, type WdlKind } from '../components/WdlBadge';
import { CupView } from './CupView';

export const LeagueView: React.FC<{
  state: GameState;
  onInspectTeam: (teamId: number) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onShallowPatch?: (patcher: (prev: GameState) => Partial<GameState>) => void;
  onNavigate?: (tab: MainTab, sub?: string) => void;
  onOpenSeasonStats?: (season?: number) => void;
  onOpenVarReplay?: (homeId: number, awayId: number, records: VarReplayRecord[]) => void;
  onOpenHighlights?: (homeId: number, awayId: number, clips: MatchHighlightClip[], title?: string, scoreSummary?: string) => void;
  onOpenMatchReport?: (report: ArchivedMatchReport, title?: string) => void;
  onToast?: (msg: string) => void;
}> = ({ state, onInspectTeam, onInspectPlayer, onUpdateState, onShallowPatch, onNavigate, onOpenSeasonStats, onOpenVarReplay, onOpenHighlights, onOpenMatchReport, onToast }) => {
  const me = state.teams[state.me];
  const vt = state.lg ?? me.tier;
  const rawSub = state.v === 'c' ? 4 : (state.tv ?? 0);
  const sub = rawSub === 5 ? 2 : rawSub;
  const [cmpSort, setCmpSort] = useState<'ovSq' | 'ovXi' | 'at' | 'df'>('ovSq');
  const [newsFilter, setNewsFilter] = useState<'all' | 'urg' | 'req' | 'feed'>('all');
  const [prizeModalTier, setPrizeModalTier] = useState<number | null>(null);
  const [cupInitialStats, setCupInitialStats] = useState(false);

  const tb = useMemo(() => sortTable(state.teams.filter((t) => t.tier === vt)), [state.teams, vt]);
  const myLeaguePos = useMemo(() => {
    const idx = tb.findIndex((t) => t.id === state.me);
    return idx >= 0 ? idx + 1 : null;
  }, [tb, state.me]);
  const ms = useMemo(() => teamStats(me, state), [me, state]);

  const leagueRows = useMemo(() => {
    if (sub !== 1) return [];
    return state.teams
      .filter((t) => t.tier === vt)
      .map((t) => ({ t, st: teamStats(t, state) }))
      .sort((a, b) => b.st[cmpSort] - a.st[cmpSort] || b.st.ovXi - a.st.ovXi);
  }, [sub, state, vt, cmpSort]);

  const nextMatchResolved = useMemo(() => {
    type NextKind = 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc';

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
  }, [state.ac, state.pa, state.sc, state.psc, state.lc, state.plc, state.dc, state.pdc, state.cup, state.pc, state.md, state.fx, state.me]);

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
            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5">
              XI {ms.ovXi} : {oppSt.ovXi}
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
      tone: NewsTone;
      icon: React.ReactNode;
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
      const maxPartnerSlots = getMaxPartnerSlots(state);
      const tierMult = 1 + me.tier * 0.45;
      const readyDeals = PARTNER_DEAL_CATALOG.filter(
        (cat) => !activeDeals.some((d) => d.id === cat.id) && cat.checkReq(state, me).ok
      );

      if (state.dilemma) {
        items.push({
          id: 'active-dilemma',
          kind: 'alert',
          tone: 'urg',
          urgent: true,
          icon: '📌',
          tag: 'เหตุการณ์ด่วน',
          title: state.dilemma.title,
          detail: `${state.dilemma.category} · รอการตัดสินใจ`,
        });
      }

      if (state.money < 0 || (state.bd ?? 55) < 35) {
        items.push({
          id: 'club-alert-fin-bd',
          kind: 'alert',
          tone: 'urg',
          urgent: true,
          icon: '⚠️',
          tag: 'แจ้งเตือนด่วน',
          title: state.money < 0 ? `งบติดลบ (${fmtMoney(state.money)})` : `ความเชื่อมั่นบอร์ดต่ำ (${state.bd ?? 55}%)`,
          detail: state.money < 0 ? 'ตลาดถูกระงับชั่วคราว ควรปรับสมดุลงบ' : 'เร่งทำผลงานเพื่อเรียกศรัทธาบอร์ด',
          actionLabel: state.money < 0 ? 'ดูการเงิน' : 'ดูบอร์ด',
          onAction: () => onNavigate?.(state.money < 0 ? 'f' : 'u')
        });
      }

      // Player & Fan Upgrade / Improvement Demands (คำเรียกร้องจากนักเตะ & แฟนบอล)
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
        const srcBadge = req.source === 'player' ? '🗣️ นักเตะเรียกร้อง' : '📣 แฟนบอลเรียกร้อง';
        let actionLabel = 'ดำเนินการ';
        let detailText = `${req.detail} · รางวัล: ${req.rewardText}`;
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
              onUpdateState((d) => {
                const curLv = d[fk] ?? 1;
                const curCond = getFacilityCondition(d, fk);
                const costNow = getFacilityRenovateCost(baseCost, curLv, curCond);
                if (curLv <= 0 || d.money < costNow) return;
                d.money -= costNow;
                d.facCond = { ...(d.facCond || {}), [fk]: 100 };
                logFin(d, `ซ่อมบำรุงตามคำเรียกร้อง (${curCond}% → 100%)`, -costNow);
                done = checkClubDemandsCompletion(d);
              });
              onToast?.(done.length ? `✅ ซ่อมบำรุงและตอบรับคำเรียกร้องสำเร็จ!` : '🔧 ปรับปรุงสภาพเรียบร้อยแล้ว');
            };
          } else {
            actionLabel = 'ไปซ่อม';
            onAction = () => onNavigate?.('u', 'infra');
          }
        } else if (req.kind === 'upgrade_fac') {
          const fk = req.targetKey as FacilityKey;
          const lv = state[fk] ?? 1;
          const upgCost = getFacilityUpgradeCost(facBaseCostMap[fk] ?? 80, lv);
          detailText = `${req.detail} · งบอัป ~${fmtMoneyNum(upgCost)} · ${req.rewardText}`;
          actionLabel = 'ไปอัปเกรด';
          onAction = () => onNavigate?.('u', 'infra');
        } else if (req.kind === 'hire_staff') {
          actionLabel = 'จ้างทีมงาน';
          onAction = () => onNavigate?.('u', 'infra');
        } else if (req.kind === 'ticket_price') {
          actionLabel = 'ปรับตั๋วมาตรฐาน';
          onAction = () => {
            let done: string[] = [];
            onUpdateState((d) => {
              d.ticketPlan = 'standard';
              d.tp = 1;
              done = checkClubDemandsCompletion(d);
            });
            onToast?.(done.length ? '✅ ปรับราคาตั๋วเป็นมาตรฐานตามคำขอแฟนบอลแล้ว!' : 'ปรับราคาตั๋วเรียบร้อย');
          };
        } else if (req.kind === 'live_stream') {
          actionLabel = 'เลือกแพ็กเกจ';
          onAction = () => onNavigate?.('f', 'commercial');
        } else if (req.kind === 'megastore_stock') {
          actionLabel = 'เติมทุนร้าน';
          onAction = () => onNavigate?.('f', 'megastore');
        }

        items.push({
          id: `demand-${req.id}`,
          kind: 'req',
          tone: remMd <= 1 ? 'urg' : 'warn',
          urgent: true,
          icon: req.source === 'player' ? '🗣️' : '📣',
          tag: `${srcBadge} · ${req.requester} · อีก ${remMd} นัด`,
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
          tone: prog.isComplete ? 'ok' : remMd <= 1 ? 'urg' : 'warn',
          urgent: true,
          icon: '📋',
          tag: `คำสั่งบอร์ด · อีก ${remMd} นัด`,
          title: dir.title,
          detail: `${prog.progressText} (${Math.round(prog.ratio * 100)}%)`,
          actionLabel: 'ดูรายละเอียด',
          onAction: () => onNavigate?.('u', 'info')
        });
      } else {
        const activeBoardFx = getActiveBoardEffects(state);
        if (activeBoardFx.length > 0) {
          const topFx = activeBoardFx[0];
          items.push({
            id: 'board-effect-active',
            kind: 'alert',
            tone: topFx.tone === 'bonus' ? 'ok' : 'urg',
            urgent: false,
            icon: topFx.tone === 'bonus' ? '✨' : '📢',
            tag: 'ผลกระทบบอร์ด',
            title: topFx.label,
            detail: `มีผลอีก ${Math.max(1, topFx.expiresMd - (state.md ?? 0))} นัด`,
            actionLabel: 'ดูบอร์ด',
            onAction: () => onNavigate?.('u', 'info')
          });
        }
      }

      if (incomingOffers.length > 0) {
        const topOff = incomingOffers[0];
        items.push({
          id: 'transfer-offers',
          kind: 'alert',
          tone: 'warn',
          urgent: true,
          icon: '💼',
          tag: 'ข้อเสนอซื้อตัว',
          title: `${incomingOffers.length} ข้อเสนอรอพิจารณา`,
          detail: `${topOff.t} ยื่นซื้อ ${topOff.n} (${fmtMoney(topOff.p)})`,
          actionLabel: 'เปิดดู',
          onAction: () => onNavigate?.('k', 'sell')
        });
      }

      if (state.scout?.results) {
        items.push({
          id: 'scout-ready',
          kind: 'alert',
          tone: 'ok',
          urgent: true,
          icon: '🔍',
          tag: 'แมวมอง',
          title: `รายงาน "${state.scout.label}" พร้อมแล้ว`,
          detail: `พบนักเตะเป้าหมาย ${state.scout.results.length} ราย`,
          actionLabel: 'ดูรายงาน',
          onAction: () => onNavigate?.('k', 'scout')
        });
      }

      if (expiredCon.length > 0 || expiringSoon.length > 0) {
        const namesPreview = [...expiredCon, ...expiringSoon].slice(0, 2).map((q) => q.n.split(' ')[0]).join(', ');
        const totalNeed = expiredCon.length + expiringSoon.length;
        items.push({
          id: 'contracts-expiring',
          kind: 'alert',
          tone: expiredCon.length > 0 ? 'urg' : 'warn',
          urgent: true,
          icon: '📄',
          tag: 'สัญญาการเงิน · นักเตะ',
          title: expiredCon.length > 0 ? `หมดสัญญา ${expiredCon.length} คน` : `สัญญาเหลือ 1 ปี (${expiringSoon.length} คน)`,
          detail: `${namesPreview}${totalNeed > 2 ? ` +${totalNeed - 2}` : ''}`,
          actionLabel: 'ต่อสัญญา',
          onAction: () => onNavigate?.('k', 'con')
        });
      }

      // Financial & Commercial Contract To-Dos (สิ่งที่ต้องทำด้านสัญญาการเงิน)
      const curSpIdx = clamp(state.sp ?? 0, 0, MAIN_SPONSOR_PACKAGES.length - 1);
      const curSpBase = calcMainSponsorPayout({ sp: curSpIdx, promo: 0 }, me).base;
      const betterMainPkgs = MAIN_SPONSOR_PACKAGES.filter(
        (pkg) => pkg.idx !== curSpIdx && evaluateMainSponsorEligibility(pkg.idx, state, me).ok
      )
        .map((pkg) => ({
          pkg,
          base: calcMainSponsorPayout({ sp: pkg.idx, promo: 0 }, me).base
        }))
        .sort((a, b) => b.base - a.base);
      const topMainUpgrade = betterMainPkgs[0];
      if (topMainUpgrade && topMainUpgrade.base >= curSpBase + 2) {
        const upgBrand = resolveStateSponsorBrand(state, topMainUpgrade.pkg.idx);
        items.push({
          id: 'fin-main-sponsor-upgrade',
          kind: 'alert',
          tone: 'ok',
          urgent: true,
          icon: '👕',
          tag: 'สัญญาการเงิน · คาดอกเสื้อ',
          title: `ปลดล็อกดีล ${upgBrand.thName} (+${fmtMoneyNum(topMainUpgrade.base)}/นัด)`,
          detail: `จ่ายฐานสูงกว่าแพ็กเกจปัจจุบัน (+${fmtMoneyNum(topMainUpgrade.base - curSpBase)}/นัด) และได้โลโก้ใหม่บนเสื้อ`,
          actionLabel: 'เปลี่ยนดีล',
          onAction: () => onNavigate?.('f', 'commercial')
        });
      }

      if (activeDeals.length === 0) {
        items.push({
          id: 'sponsor-unselected',
          kind: 'alert',
          tone: 'warn',
          urgent: true,
          icon: '🤝',
          tag: `สัญญาการเงิน · ว่าง ${maxPartnerSlots} ช่อง`,
          title: 'ยังไม่ได้เซ็นดีลพาร์ทเนอร์ธุรกิจ',
          detail: readyDeals.length
            ? `พร้อมเซ็นทันที เช่น ${readyDeals[0].name} (+${fmtMoneyNum(Math.round(readyDeals[0].basePerMatch * tierMult))}/นัด)`
            : 'เลือกเซ็นสัญญาเพื่อรับรายได้เสริมทุกนัด',
          actionLabel: 'เลือกดีล',
          onAction: () => onNavigate?.('f', 'commercial')
        });
      } else {
        const expiringDeal = activeDeals.find((d) => d.left <= 2);
        if (expiringDeal) {
          items.push({
            id: `sponsor-expiring-${expiringDeal.id}`,
            kind: 'alert',
            tone: 'warn',
            urgent: true,
            icon: '🤝',
            tag: 'สัญญาการเงิน · พาร์ทเนอร์',
            title: `ดีล ${expiringDeal.name} เหลือ ${expiringDeal.left} นัด`,
            detail: 'เตรียมเซ็นสัญญาพาร์ทเนอร์ทดแทนเมื่อครบกำหนด',
            actionLabel: 'ดูดีล',
            onAction: () => onNavigate?.('f', 'commercial')
          });
        }
        if (activeDeals.length < maxPartnerSlots && readyDeals.length > 0) {
          items.push({
            id: 'partner-slot-open',
            kind: 'alert',
            tone: 'ok',
            urgent: true,
            icon: '📑',
            tag: `สัญญาการเงิน · ว่าง ${maxPartnerSlots - activeDeals.length}/${maxPartnerSlots} ช่อง`,
            title: `เซ็นพาร์ทเนอร์เพิ่มได้ทันที (${readyDeals[0].name})`,
            detail: `รับเงินเซ็น +${fmtMoneyNum(Math.round(readyDeals[0].baseSignBonus * tierMult))} และ +${fmtMoneyNum(Math.round(readyDeals[0].basePerMatch * tierMult))}/นัด`,
            actionLabel: 'เซ็นเพิ่ม',
            onAction: () => onNavigate?.('f', 'commercial')
          });
        }
      }

      if ((state.liveStream || 'off') === 'off') {
        items.push({
          id: 'fin-livestream-off',
          kind: 'alert',
          tone: 'info',
          urgent: true,
          icon: '📺',
          tag: 'สัญญาการเงิน · ถ่ายทอดสด',
          title: 'ยังไม่ได้เปิดสัญญาถ่ายทอดสดสโมสร',
          detail: 'เปิดสตรีมสร้างรายได้เพิ่มเติมตามจำนวนผู้ชมทุกแมตช์',
          actionLabel: 'เปิดสัญญา',
          onAction: () => onNavigate?.('f', 'commercial')
        });
      }

      const merchLv = state.merchLv ?? 1;
      const merchCap = state.megastore?.capital ?? 0;
      if (merchLv > 0 && merchCap < 8) {
        items.push({
          id: 'fin-megastore-lowcap',
          kind: 'alert',
          tone: 'warn',
          urgent: true,
          icon: '🛍️',
          tag: 'สัญญาการเงิน · เมกะสโตร์',
          title: `ทุนสต็อกเมกะสโตร์ใกล้หมด (${fmtMoney(merchCap)})`,
          detail: 'เติมเงินทุนหมุนเวียนเพื่อผลิตเสื้อขายก่อนเกมเหย้า',
          actionLabel: 'เติมทุนร้าน',
          onAction: () => onNavigate?.('f', 'megastore')
        });
      }

      const bankRemain = state.bankLoan ? state.bankLoan.left * state.bankLoan.per : 0;
      const payDue = state.payDue || 0;
      if (payDue > 0 || (state.bankLoan && state.money < state.bankLoan.per * 2)) {
        items.push({
          id: 'fin-debt-watch',
          kind: 'alert',
          tone: payDue > 0 ? 'warn' : 'urg',
          urgent: true,
          icon: '🏦',
          tag: 'สัญญาการเงิน · ภาระหนี้',
          title: `มีภาระหนี้คงค้างรวม ${fmtMoney(bankRemain + payDue)}`,
          detail: `${payDue > 0 ? `ผ่อนปลายปี ${fmtMoneyNum(payDue)}` : 'ค่างวดธนาคารใกล้ครบ'} · ตรวจสอบสภาพคล่อง`,
          actionLabel: 'ดูบัญชีหนี้',
          onAction: () => onNavigate?.('f', 'ledger')
        });
      } else if (state.money < 25 && !state.bankLoan) {
        items.push({
          id: 'fin-low-cash',
          kind: 'alert',
          tone: 'warn',
          urgent: true,
          icon: '💳',
          tag: 'สัญญาการเงิน · สภาพคล่อง',
          title: `งบหมุนเวียนเหลือน้อย (${fmtMoney(state.money)})`,
          detail: 'กู้สินเชื่อสโมสรหรือจัดโปรดีลเชิงพาณิชย์เพิ่มเติมได้',
          actionLabel: 'ดูสินเชื่อ',
          onAction: () => onNavigate?.('f', 'ledger')
        });
      }

      if (tx.wagePct >= 95) {
        items.push({
          id: 'fin-ffp-wage',
          kind: 'alert',
          tone: 'urg',
          urgent: true,
          icon: '📊',
          tag: 'สัญญาการเงิน · เพดาน FFP',
          title: `ค่าเหนื่อยใกล้เต็มเพดาน (${tx.wagePct}%)`,
          detail: `${fmtMoneyNum(tx.curWage)} / ${fmtMoneyNum(tx.wageCap)} · ระวังติดล็อกซื้อตัว`,
          actionLabel: 'ดูงบทีม',
          onAction: () => onNavigate?.('f', 'overview')
        });
      }

      const curTurn = state.season * 40 + state.md;
      const actCool = state.clubActMd != null && curTurn - state.clubActMd < 3;
      if (!actCool) {
        items.push({
          id: 'club-activity-ready',
          kind: 'alert',
          tone: 'ok',
          urgent: true,
          icon: '🎉',
          tag: 'กิจกรรมสโมสร',
          title: 'พร้อมจัดกิจกรรมกระตุ้นทีม',
          detail: 'เพิ่มขวัญแฟนบอลและกำลังใจในห้องแต่งตัว',
          actionLabel: 'จัดเลย',
          onAction: () => onNavigate?.('u', 'activities')
        });
      }

      const needRest = (tiredStarters.length > 0 || lowFitAll.length > 0 || avgXiFit < 76) && curPlan.program !== 'recovery';
      if (needRest) {
        items.push({
          id: 'rest-needed',
          kind: 'alert',
          tone: avgXiFit < 68 || lowFitAll.length >= 3 ? 'urg' : 'warn',
          urgent: true,
          icon: '😴',
          tag: 'ความฟิตทีม',
          title: `นักเตะเริ่มล้า (ฟิตตัวจริง ${avgXiFit}%)`,
          detail: `ตัวจริงล้า ${tiredStarters.length} คน · แนะนำพักฟื้น`,
          actionLabel: 'สลับพักฟื้น',
          onAction: () => {
            SFX.tap();
            onUpdateState((d) => { syncTrainingFocusToPlan(d, 'F'); });
            onToast?.('สลับโปรแกรมซ้อมเป็น "😴 พักผ่อน & ฟื้นฟู" แล้ว');
          }
        });
      }

      if (injuredList.length > 0) {
        items.push({
          id: 'club-injured-rehab',
          kind: 'alert',
          tone: 'urg',
          urgent: true,
          icon: <StatIconBadge kind="injury" size="xs" />,
          tag: 'ห้องพยาบาล',
          title: `นักเตะบาดเจ็บ ${injuredList.length} คน`,
          detail: injuredList.slice(0, 2).map((q) => `${q.n.split(' ')[0]} (${q.inj}นัด)`).join(', '),
          actionLabel: 'ฟื้นฟูทีม',
          onAction: () => onNavigate?.('r')
        });
      }
    } else if (state.p) {
      const p = state.p;
      if ((p.en ?? 100) < 70 && (p.plan ?? 1) !== 3) {
        items.push({
          id: 'player-rest-warn',
          kind: 'alert',
          tone: p.en < 52 ? 'urg' : 'warn',
          urgent: true,
          icon: '😴',
          tag: 'ความฟิต',
          title: `ความฟิตเหลือ ${p.en}% — แนะนำพักผ่อน`,
          detail: 'ต่ำกว่า 58% โค้ชอาจดรอปเป็นสำรอง',
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
          tone: 'urg',
          urgent: true,
          icon: <StatIconBadge kind="injury" size="xs" />,
          tag: 'อาการเจ็บ',
          title: `บาดเจ็บพักอีก ${p.inj} นัด`,
          detail: 'ทำกายภาพส่วนตัวได้ที่หน้าอาชีพนักเตะ',
          actionLabel: 'ไปฟื้นฟู',
          onAction: () => onNavigate?.('p')
        });
      }
      if ((p.sus || 0) > 0 || (p.yc || 0) >= 2) {
        items.push({
          id: 'player-card-warn',
          kind: 'alert',
          tone: (p.sus || 0) > 0 ? 'urg' : 'warn',
          urgent: true,
          icon: (p.sus || 0) > 0 ? '🟥' : '🟨',
          tag: 'วินัยสนาม',
          title: (p.sus || 0) > 0 ? `ติดโทษแบน ${p.sus} นัด` : `สะสมใบเหลือง ${p.yc}/3 ใบ`,
          detail: (p.sus || 0) > 0 ? 'รอชดใช้โทษแบนให้ครบ' : 'อีก 1 เหลืองจะโดนแบน 1 นัด'
        });
      }
    }

    (state.feed || []).slice(0, 8).forEach((f, idx) => {
      items.push({
        id: `feed-${idx}-${f.m}`,
        kind: 'feed',
        tone: f.tone === 'urg' ? 'urg' : f.tone === 'offer' ? 'warn' : f.tone === 'ok' ? 'ok' : 'info',
        urgent: f.tone === 'urg' || f.tone === 'offer',
        icon: f.tone === 'urg' ? '🚨' : f.tone === 'offer' ? '💼' : f.tone === 'ok' ? '✨' : '📰',
        tag: `${f.cat} · นัด ${f.m}`,
        title: f.txt.includes('✚')
          ? (
            <span className="inline-flex items-center gap-1">
              {f.txt.split('✚').map((part, pIdx) => (
                <React.Fragment key={pIdx}>
                  {pIdx > 0 && <StatIconBadge kind="injury" size="xs" />}
                  {part}
                </React.Fragment>
              ))}
            </span>
          )
          : f.txt,
        detail: `ซีซั่น ${f.s}`
      });
    });

    const urgentCount = items.filter((it) => it.urgent).length;
    const reqCount = items.filter((it) => it.kind === 'req').length;
    const filteredItems = items.filter((it) => {
      if (newsFilter === 'all') return true;
      if (newsFilter === 'urg') return !!it.urgent;
      if (newsFilter === 'req') return it.kind === 'req';
      return it.kind === 'feed';
    });

    const toneCls: Record<NewsTone, string> = {
      urg: 'bg-[var(--red-soft)]/35 border-[var(--red)]/30',
      warn: 'bg-[var(--lamp-soft)]/45 border-[var(--lamp)]/40',
      ok: 'bg-[var(--g-soft)]/35 border-[var(--g)]/30',
      info: 'bg-[var(--surface-2)]/65 border-[var(--line)]/70'
    };

    const filterTabs = isMgr
      ? ([
          ['all', 'ทั้งหมด'],
          ['urg', `ต้องทำ (${urgentCount})`],
          ['req', `คำขอ (${reqCount})`],
          ['feed', 'ข่าวทีม']
        ] as const)
      : ([
          ['all', 'ทั้งหมด'],
          ['urg', `ด่วน (${urgentCount})`],
          ['feed', 'ข่าวทีม']
        ] as const);

    return (
      <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-2 mland:space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
            📬 งานด่วน &amp; ข่าวสโมสร
          </div>
          <div className="seg-bar shrink-0">
            {filterTabs.map(([fid, flbl]) => (
              <button
                key={fid}
                type="button"
                onClick={() => { SFX.tap(); setNewsFilter(fid); }}
                className={`seg-btn ${newsFilter === fid ? 'seg-btn-active' : ''}`}
              >
                {flbl}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[210px] sm:max-h-[240px] mland:max-h-[148px] overflow-y-auto space-y-1.5 mland:space-y-1 pr-0.5">
          {filteredItems.length === 0 ? (
            <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] py-3 text-center">
              {newsFilter === 'req'
                ? 'ยังไม่มีคำเรียกร้องจากนักเตะหรือแฟนบอลในตอนนี้'
                : 'ไม่มีเรื่องเร่งด่วนในขณะนี้ ทีมพร้อมลงสนาม!'}
            </div>
          ) : (
            filteredItems.map((it) => (
              <div
                key={it.id}
                className={`p-2 mland:p-1.5 rounded-xl mland:rounded-lg border flex items-center justify-between gap-2 mland:gap-1.5 ${toneCls[it.tone]}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] mland:text-[8px] font-semibold text-[var(--mut)] truncate flex items-center gap-1">
                    {it.icon}
                    <span className="truncate">{it.tag}</span>
                  </div>
                  <div className="font-bold text-[11px] mland:text-[9.5px] text-[var(--ink)] leading-tight truncate">
                    {it.title}
                  </div>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug truncate">
                    {it.detail}
                  </div>
                </div>
                {it.actionLabel && it.onAction && (
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); it.onAction?.(); }}
                    className="btn btn-xs btn-surface hover:bg-[var(--g)] hover:text-white shrink-0"
                  >
                    {it.actionLabel}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderStandings = () => (
    <div className="flex-1 min-h-0 grid grid-cols-[1.42fr_0.88fr] gap-2.5 mland:gap-2 overflow-hidden">
      <div className="space-y-1.5 mland:space-y-1 h-full flex flex-col min-h-0">
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden flex-1 min-h-0 flex flex-col">
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
              const isPromo = i < 3 && vt < 2;
              const isRel = i >= tb.length - 3 && vt > 0;
              const isMe = t.id === state.me;
              const gd = t.gf - t.ga;
              const rankBadge = isPromo
                ? 'bg-[var(--g)] text-white'
                : isRel
                  ? 'bg-[var(--red)] text-white'
                  : 'text-[var(--mut)]';

              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.name}
                  onClick={() => { SFX.tap(); onInspectTeam(t.id); }}
                  className={`w-full flex-1 basis-0 min-h-[20px] sm:min-h-[22px] mland:min-h-[14px] grid grid-cols-[18px_19px_minmax(0,1fr)_38px_24px_22px_26px_22px_25px_28px] sm:grid-cols-[24px_24px_minmax(0,1fr)_52px_30px_28px_32px_28px_32px_36px] mland:grid-cols-[18px_18px_minmax(0,1fr)_38px_24px_22px_26px_22px_24px_28px] items-center gap-0.5 sm:gap-1 mland:gap-0.5 px-1.5 sm:px-3 mland:px-1.5 py-0 text-left text-[11px] sm:text-xs mland:text-[9px] leading-none transition-colors cursor-pointer ${
                    isPromo
                      ? 'bg-[var(--g-soft)]/25 hover:bg-[var(--g-soft)]/55'
                      : isRel
                        ? 'bg-[var(--red-soft)]/20 hover:bg-[var(--red-soft)]/45'
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

        <div className="flex items-center justify-between gap-2 text-[10px] mland:text-[8.5px] text-[var(--mut)] px-1 shrink-0 whitespace-nowrap">
          <div className="flex items-center gap-2.5 min-w-0">
            {vt < 2 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs bg-[var(--g)] inline-block shrink-0" />
                <span>1-3 ขึ้นชั้น</span>
              </span>
            )}
            {vt > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs bg-[var(--red)] inline-block shrink-0" />
                <span>3 ท้ายตกชั้น</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => { SFX.tap(); setPrizeModalTier(vt); }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--lamp)] text-[10px] mland:text-[8.5px] font-bold text-[var(--ink)] cursor-pointer transition-colors shadow-2xs shrink-0"
          >
            <Coins className="w-3 h-3 text-[#b47b00] dark:text-[var(--lamp)] shrink-0" />
            <span>รางวัล</span>
            <span className="text-[#9a6700] dark:text-[var(--lamp)] tabular">
              {myLeaguePos
                ? fmtMoney(getLeaguePrizeMoney(vt, myLeaguePos, tb.length))
                : fmtMoney(getLeaguePrizeMoney(vt, 1, tb.length))}
            </span>
          </button>
        </div>

      </div>

      {/* Right Column: Matchday Command Hub (Next Match + Actionable Inbox + Recent Form) */}
      <div className="space-y-2 mland:space-y-1.5 h-full overflow-y-auto pr-0.5">
        {renderNextMatchCard()}
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
                        onClick={() => onOpenMatchReport(rec, `${TN[vt]} · นัดที่ ${mdNumVal}`)}
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
                              `${TN[vt]} · นัดที่ ${mdNumVal}`,
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
                          onClick={() => onOpenMatchReport(rec, `${TN[vt]} · นัดที่ ${mdNumVal}`)}
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

  const renderPowerComparison = () => {
    const minV = Math.min(...leagueRows.map((x) => x.st[cmpSort])) - 4;
    const maxV = Math.max(...leagueRows.map((x) => x.st[cmpSort]), minV + 8);
    const sortLabels: Record<'ovSq' | 'ovXi' | 'at' | 'df', string> = { ovSq: 'เฉลี่ยทีม', ovXi: '11 ตัวจริง', at: 'พลังบุก', df: 'พลังรับ' };
    return (
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 mland:mb-1.5 shrink-0">
          <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">📊 เทียบพลังทีม · {TN[vt]}</h3>
          <div className="seg-bar shrink-0">
            {(['ovSq', 'ovXi', 'at', 'df'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setCmpSort(k)} className={`seg-btn ${cmpSort === k ? 'seg-btn-active' : ''}`}>
                {sortLabels[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-1.5 pr-0.5 content-start">
          {leagueRows.map(({ t, st }, idx) => {
            const val = st[cmpSort];
            const pct = Math.max(8, Math.min(100, Math.round(((val - minV) / (maxV - minV)) * 100)));
            const isMe = t.id === state.me;
            const df = val - ms[cmpSort];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onInspectTeam(t.id)}
                className={`w-full grid grid-cols-[22px_22px_minmax(0,1fr)_auto] sm:grid-cols-[24px_24px_minmax(0,1fr)_90px_auto] mland:grid-cols-[20px_20px_minmax(0,1fr)_auto] items-center gap-2 mland:gap-1.5 p-2 mland:p-1.5 rounded-xl border text-left cursor-pointer transition-colors ${
                  isMe ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/55 border-[var(--line)] hover:border-[var(--g)]'
                }`}
              >
                <span className="text-xs mland:text-[10px] font-bold text-center text-[var(--mut)] tabular">{idx + 1}</span>
                <ClubCrest name={t.name} size={20} team={t} club={state.club} isMyClub={state.mode === 'm' && isMe} />
                <div className="min-w-0">
                  <div className="font-bold text-xs mland:text-[10.5px] whitespace-normal break-words leading-tight flex items-center gap-1 flex-wrap">
                    <span>{t.name}</span>
                    {isMe && <MyTeamBadge size="xs" />}
                  </div>
                  <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate">ตัวจริง {st.ovXi} · หน้า {st.f} กลาง {st.m} หลัง {st.d} · 👥 {fmtFansShort(ensureTeamFans(t))}</div>
                </div>
                <div className="hidden sm:block mland:hidden">
                  <div className="flex justify-between text-[10.5px] font-bold mb-0.5">
                    <span className="text-[var(--mut)]">{sortLabels[cmpSort]}</span>
                    <span className="tabular">{val}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ovColor(st.ovXi) }} />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <OvrBadge ov={st.ovSq} size="xs" />
                  {!isMe && (
                    <span className={`text-[10.5px] mland:text-[9.5px] font-bold tabular ${df > 0 ? 'text-[var(--red)]' : df < 0 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                      {df > 0 ? `+${df}` : df}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStatsAndAwards = () => {
    const ts = state.teams.filter((t) => t.tier === vt);
    const ps = ts.flatMap((t) => t.sq.map((q) => ({ q, t })));
    const totalPlayedInTier = ts.reduce((s, t) => s + t.p, 0);
    const maxPlayedInTier = ts.reduce((m, t) => Math.max(m, t.p), 0);
    const totalRounds = state.fx.length || 30;
    const isSeasonDone = maxPlayedInTier >= totalRounds && totalRounds > 0;
    const teamRankMap = new Map<number, number>(tb.map((t, idx) => [t.id, idx]));

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
              {TN[vt]}
            </span>
            <span aria-hidden="true" className="hidden sm:inline text-[var(--mut)]">·</span>
            <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular whitespace-nowrap">
              ซีซั่น {state.season} · แข่งแล้ว {maxPlayedInTier}/{totalRounds} นัด · {isSeasonDone ? 'สรุปผลแล้ว' : 'กำลังลุ้นรางวัล'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
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
      <div className="flex flex-row items-center justify-between gap-1.5 shrink-0">
        {/* Competition Sub-Navigation Menu: Single compact horizontal pill strip */}
        <div className="order-2 w-auto max-w-full seg-bar bg-[var(--surface)] shadow-xs overflow-x-auto">
          {(
            [
              [0, '🏆', 'บอลลีก'],
              [4, '🏅', 'บอลถ้วย'],
              [2, '⭐', 'สถิติ & รางวัล'],
              [3, '📅', 'ปฏิทิน'],
              [1, '📊', 'พลังทีม']
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
              className={`seg-btn py-1.5 mland:py-1 px-3 mland:px-2.5 text-xs mland:text-[10.5px] shrink-0 min-w-0 ${
                sub === tabIdx
                  ? 'seg-btn-active'
                  : 'hover:bg-[var(--surface-2)]/70'
              }`}
            >
              <span className="text-xs mland:text-[10.5px] leading-none">{ic}</span>
              <span className="truncate">{fullLbl}</span>
            </button>
          ))}
        </div>

        {/* Left Header Slot: Standings puts Season label in front of League Switcher; Stats/Power use tier pills */}
        {sub === 0 ? (
          <div className="order-1 flex items-center gap-1.5 min-w-0 shrink">
            <div className="flex items-center gap-1.5 px-3 py-1.5 mland:px-2.5 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px] font-bold text-[var(--ink)] shadow-xs shrink-0 whitespace-nowrap">
              <span>🏆</span>
              <span>ตารางคะแนน · ซีซั่น {state.season}</span>
            </div>
            <div className="relative inline-flex items-center min-w-0">
              <select
                aria-label="เลือกลีกในตารางคะแนน"
                value={vt}
                onChange={(e) => {
                  const nextTier = Number(e.target.value);
                  SFX.tap();
                  if (onShallowPatch) {
                    onShallowPatch(() => ({ lg: nextTier }));
                  } else {
                    onUpdateState((d) => { d.lg = nextTier; });
                  }
                }}
                className="appearance-none bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] focus:border-[var(--g)] focus:outline-none rounded-xl pl-3 pr-7 mland:pl-2.5 mland:pr-6 py-1.5 mland:py-1 font-bold text-xs mland:text-[10.5px] text-[var(--ink)] cursor-pointer truncate max-w-[175px] sm:max-w-none transition-colors shadow-xs"
              >
                {[0, 1, 2].map((tierIdx) => (
                  <option key={tierIdx} value={tierIdx}>
                    {TN[tierIdx]}{tierIdx === me.tier ? ' ★' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 mland:w-3 mland:h-3 text-[var(--mut)] pointer-events-none absolute right-2 mland:right-1.5 top-1/2 -translate-y-1/2" />
            </div>
            {vt !== me.tier && (
              <button
                type="button"
                title="กลับลีกของฉัน"
                aria-label="กลับลีกของฉัน"
                onClick={() => {
                  SFX.tap();
                  if (onShallowPatch) onShallowPatch(() => ({ lg: me.tier }));
                  else onUpdateState((d) => { d.lg = me.tier; });
                }}
                className="btn btn-sm btn-gold shrink-0"
              >
                <span>↩</span>
                <span>กลับลีกฉัน</span>
                <MyTeamBadge size="xs" title="ลีกของคุณ" />
              </button>
            )}
          </div>
        ) : sub === 1 || sub === 2 ? (
          <div className="order-1 w-auto seg-bar bg-[var(--surface)] shadow-xs shrink-0">
            {['จังหวัด', 'ในประเทศ 2', 'ในประเทศ 1'].map((lbl, idx) => {
              const isMyTier = idx === me.tier;
              const active = vt === idx;
              return (
                <button
                  key={lbl}
                  type="button"
                  title={isMyTier ? `${lbl} (ลีกของคุณ)` : lbl}
                  onClick={() => {
                    SFX.tap();
                    if (onShallowPatch) onShallowPatch(() => ({ lg: idx }));
                    else onUpdateState((d) => { d.lg = idx; });
                  }}
                  className={`seg-btn py-1.5 mland:py-1 px-2.5 mland:px-2 text-xs mland:text-[10.5px] min-w-0 ${
                    active
                      ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs hover:text-[var(--bg)]'
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
            <span>{sub === 4 ? '🏅' : '📅'}</span>
            <span>{sub === 4 ? 'รายการแข่งขันบอลถ้วย' : 'โปรแกรมการแข่งขัน'}</span>
          </div>
        )}
      </div>
      {sub === 0 && renderStandings()}
      {sub === 1 && renderPowerComparison()}
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
              <div className="seg-bar w-full grid grid-cols-3">
                {[0, 1, 2].map((tierIdx) => (
                  <button
                    key={tierIdx}
                    type="button"
                    onClick={() => { SFX.tap(); setPrizeModalTier(tierIdx); }}
                    className={`seg-btn py-1 mland:py-0.5 inline-flex items-center justify-center gap-1 truncate ${prizeModalTier === tierIdx ? 'seg-btn-active' : ''}`}
                  >
                    <span className="truncate">{TN[tierIdx]}</span>
                    {tierIdx === me.tier && <MyTeamBadge size="2xs" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-3 grid grid-cols-2 gap-1.5 mland:gap-1 content-start">
              {Array.from({ length: 16 }, (_, idx) => {
                const rank = idx + 1;
                const amount = getLeaguePrizeMoney(prizeModalTier, rank, 16);
                const isPromoRank = prizeModalTier < 2 && rank <= 3;
                const isRelRank = prizeModalTier > 0 && rank >= 14;
                const isMyCurRank = prizeModalTier === vt && myLeaguePos === rank;
                return (
                  <div
                    key={rank}
                    className={`px-2.5 py-1.5 mland:py-1 rounded-xl border flex items-center justify-between gap-2 text-xs mland:text-[10.5px] ${
                      isMyCurRank
                        ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] font-bold'
                        : rank === 1
                          ? 'bg-amber-500/10 border-amber-500/35'
                          : isPromoRank
                            ? 'bg-[var(--g-soft)]/35 border-[var(--g)]/30'
                            : isRelRank
                              ? 'bg-[var(--red-soft)]/25 border-[var(--red)]/25'
                              : 'bg-[var(--surface-2)]/60 border-[var(--line)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0 font-bold tabular">
                      <span>{rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</span>
                      <span className="truncate text-[var(--ink)]">
                        {rank === 1 ? 'แชมป์ลีก' : `อันดับ ${rank}`}
                      </span>
                      {isMyCurRank && <MyTeamBadge size="2xs" />}
                    </span>
                    <span className="font-extrabold tabular text-[#9a6700] dark:text-[var(--lamp)] shrink-0">
                      +{fmtMoney(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ScheduleCalendarView: React.FC<{
  state: GameState;
  onInspectTeam: (teamId: number) => void;
  onPlayNext?: () => void;
  onOpenMarket?: () => void;
  onOpenVarReplay?: (homeId: number, awayId: number, records: VarReplayRecord[]) => void;
  onOpenHighlights?: (homeId: number, awayId: number, clips: MatchHighlightClip[], title?: string, scoreSummary?: string) => void;
  onOpenMatchReport?: (report: ArchivedMatchReport, title?: string) => void;
}> = ({ state, onInspectTeam, onPlayNext, onOpenMarket, onOpenVarReplay, onOpenHighlights, onOpenMatchReport }) => {
  const me = state.teams[state.me];
  const totalMd = state.fx.length || 30;
  const defaultMonth = state.md >= totalMd ? 4 : Math.min(4, Math.floor(state.md / 6));
  const [monthIdx, setMonthIdx] = useState<number>(defaultMonth);
  const currentNextIdx = Math.min(state.md, Math.max(0, totalMd - 1));
  const [roundPreview, setRoundPreview] = useState<number>(currentNextIdx);
  const [leftTab, setLeftTab] = useState<'round' | 'cup'>('round');
  const tw = getTransferWindowInfo(state);

  const months = [
    { idx: 0, label: 'เดือน 1', range: '1–6', start: 0, end: 6 },
    { idx: 1, label: 'เดือน 2', range: '7–12', start: 6, end: 12 },
    { idx: 2, label: 'เดือน 3', range: '13–18', start: 12, end: 18 },
    { idx: 3, label: 'เดือน 4', range: '19–24', start: 18, end: 24 },
    { idx: 4, label: 'เดือน 5', range: '25–30', start: 24, end: totalMd }
  ];

  const visibleMdIndices = useMemo(
    () =>
      monthIdx === -1
        ? Array.from({ length: totalMd }, (_, i) => i)
        : Array.from(
            { length: Math.max(0, (months[monthIdx]?.end ?? totalMd) - (months[monthIdx]?.start ?? 0)) },
            (_, i) => (months[monthIdx]?.start ?? 0) + i
          ).filter((i) => i < totalMd),
    [monthIdx, totalMd]
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
  const hasMidweekCup = Boolean(state.pc || state.pa || state.plc || state.psc || state.pdc);

  const activeRangeText =
    monthIdx === -1
      ? `ทั้งหมด ${totalMd} นัด`
      : `นัดที่ ${(months[monthIdx]?.start ?? 0) + 1}–${Math.min(totalMd, months[monthIdx]?.end ?? totalMd)}`;

  const milestoneSchedule = [
    { icon: '✍🏻', name: 'ตลาดซื้อขายรอบ 1', rounds: 'นัด 1–6' },
    { icon: '✍🏻', name: 'ตลาดซื้อขายรอบ 2', rounds: 'นัด 15–20' },
    { icon: EXTRA_CUP_META.sc.icon, name: EXTRA_CUP_META.sc.name, rounds: 'นัด 2' },
    { icon: '🌏', name: 'บอลถ้วยทวีป', rounds: 'นัด 3, 10, 17, 24' },
    { icon: EXTRA_CUP_META.lc.icon, name: EXTRA_CUP_META.lc.name, rounds: 'นัด 4, 11, 18, 25' },
    { icon: EXTRA_CUP_META.dc.icon, name: EXTRA_CUP_META.dc.name, rounds: 'นัด 5, 12, 19, 26' },
    { icon: '🏆', name: 'ถ้วยประชาชน', rounds: 'นัด 6, 13, 20, 27' }
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
                  ฤดูกาลที่ {state.season} · {TN[me.tier]}
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
                  {state.md >= totalMd
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
            <span className="font-semibold text-[var(--g)]">ตลาด 1: นัด 1–6</span>
            <span className="mx-1.5 opacity-45">·</span>
            <span className="font-semibold text-[var(--g)]">ตลาด 2: นัด 15–20</span>
            <span className="mx-1.5 opacity-45">·</span>
            <span>ทวีป: 3, 10, 17, 24</span>
            <span className="mx-1.5 opacity-45">·</span>
            <span>บอลถ้วย: 2, 4–6, 11–13, 18–20, 25–27</span>
          </div>

          {/* Queued Midweek Cup Alert */}
          {hasMidweekCup && (
            <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/70 flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
              <span className="font-bold text-[#7a4f00] dark:text-[var(--lamp)] truncate">
                {state.pa && state.ac
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
                            onClick={() => onOpenMatchReport(rec, `${TN[me.tier]} · นัดที่ ${roundPreview + 1}`)}
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
                                `${TN[me.tier]} · นัดที่ ${roundPreview + 1}`,
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
                        cl.comp === 'asia'
                          ? `🌏 ทวีป · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`
                          : cl.comp === 'sc'
                            ? `${EXTRA_CUP_META.sc.icon} ซูเปอร์คัพ`
                            : cl.comp === 'lc'
                              ? `${EXTRA_CUP_META.lc.icon} ลีกคัพ · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`
                              : cl.comp === 'dc'
                                ? `${EXTRA_CUP_META.dc.icon} ดิวิชั่น · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`
                                : `🏆 ปชช. · ${RN[cl.r] || `รอบ ${cl.r + 1}`}`;
                      const cupTitle =
                        cl.comp === 'asia'
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
            const isWindowOpen = mdIdx < 6 || (mdIdx >= 14 && mdIdx < 20);
            const rec = state.schedRes?.[mdIdx];

            const cupIdx = [6, 13, 20, 27].indexOf(mdNum);
            const lcIdx = [4, 11, 18, 25].indexOf(mdNum);
            const dcIdx = [5, 12, 19, 26].indexOf(mdNum);
            const isSuperCup = mdNum === 2;
            const asiaIdx = [3, 10, 17, 24].indexOf(mdNum);

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
                        เฉลี่ย {ost.ovSq} · ตัวจริง {ost.ovXi}
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
                              `${TN[me.tier]} · นัดที่ ${mdNum}`,
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
                          onClick={() => onOpenMatchReport(rec, `${TN[me.tier]} · นัดที่ ${mdNum}`)}
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
};


