import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ClipboardList,
  CloudRain,
  FastForward,
  Lock,
  MapPin,
  Moon,
  Play,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tv,
  Users,
  X
} from 'lucide-react';
import type { GameState, MatchEnvironment, Mentality, Player, SubRole, Team } from '../types/game';
import { AR_T, FSD, POS, RN, TN } from '../data/thaiFootballData';
import { computeTurfMatchModifiers, getStadiumStyleSpec, getTurfGradeSpec } from '../data/crestAndKitData';
import { SFX } from '../utils/audioTheme';
import { clamp } from '../utils/math';
import { getFormationSlots, getShirtNo, matchKits, pickBestCaptain, pickGK, playerPen, xi } from '../engine/playerCore';
import {
  EXTRA_CUP_META,
  computeMatchAttendance,
  computeMatchStreamProjection,
  computeTeamFacilityMatchModifiers,
  ensureTeamFans,
  fmtFansShort,
  rate,
  sortTable
} from '../engine/simulation';
import { getMatchBroadcastChannel } from '../engine/liveStreamChat';
import { buildMatchEnvironment, getStadiumDisplayName, type MatchFixtureKind } from '../engine/matchEnv';
import { buildAssistantCoachNotes, recommendMatchPlanAndLineup, type AssistantAppliedPlanResult } from '../engine/assistantNotes';
import { ClubCrest, FormationPitch, PlayerFace } from '../components/SvgVisuals';
import { MatchPlayerThumb } from './MatchSharedComponents';
import { FacilityUpgradeSvg, getTravelTierLabel } from '../components/FacilityUpgradeSvg';
import { StatIconBadge } from '../components/StatIconBadge';
import { StaminaBar, getStaminaMeta } from '../components/StaminaBar';
import { CaptainBadge } from '../components/CaptainBadge';
import { PositionBadge } from '../components/PositionBadge';
import { MyTeamBadge } from '../components/MyTeamBadge';
import { OvrBadge } from '../components/OvrBadge';

interface PreMatchModalProps {
  state: GameState;
  kind: MatchFixtureKind;
  homeId: number;
  awayId: number;
  isDerby: boolean;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onKickOff: (env: MatchEnvironment) => void;
  onQuickSim: () => void;
  onOpenFullTactics: () => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

const PRESS_LABELS = ['ต่ำ', 'กลาง', 'สูง'] as const;
const TEMPO_LABELS = ['ช้า', 'กลาง', 'เร็ว'] as const;
const LINE_LABELS = ['ลึก', 'กลาง', 'สูง'] as const;
const WID_LABELS = ['แคบ', 'กลาง', 'กว้าง'] as const;
const PASS_LABELS = ['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'] as const;

export const PreMatchModal: React.FC<PreMatchModalProps> = ({
  state,
  kind,
  homeId,
  awayId,
  isDerby,
  onUpdateState,
  onKickOff,
  onQuickSim,
  onOpenFullTactics,
  onClose,
  onToast
}) => {
  const homeTeam = state.teams[homeId];
  const awayTeam = state.teams[awayId];
  const meIsHome = homeId === state.me;
  const isMgr = state.mode === 'm';

  const [viewMode, setViewMode] = useState<'H' | 'A' | 'compare'>(() => (meIsHome ? 'H' : 'A'));
  const [luTab, setLuTab] = useState<0 | 1 | 2>(0);
  const [swapPickName, setSwapPickName] = useState<string | null>(null);
  const [recommendedPlanBanner, setRecommendedPlanBanner] = useState<AssistantAppliedPlanResult | null>(null);
  const isNeutralVenue = kind === 'sc';

  const [homeKit, awayKit, homeTrim, awayTrim] = useMemo(
    () => matchKits(homeTeam, awayTeam, state),
    [homeTeam, awayTeam, state]
  );
  const homeGkKit = useMemo(() => pickGK(homeKit, awayKit), [homeKit, awayKit]);
  const awayGkKit = useMemo(() => pickGK(awayKit, homeKit, homeGkKit), [awayKit, homeKit, homeGkKit]);

  const matchEnv = useMemo<MatchEnvironment>(
    () => buildMatchEnvironment(homeTeam, kind, meIsHome, state),
    // Generate match conditions once per fixture opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homeId, awayId, kind, state.md, state.season]
  );

  const turfSpec = useMemo(() => getTurfGradeSpec(matchEnv.turfGrade), [matchEnv.turfGrade]);
  const turfMods = useMemo(() => computeTurfMatchModifiers(matchEnv), [matchEnv]);
  const stadiumStyleSpec = useMemo(() => getStadiumStyleSpec(matchEnv.stadiumStyle), [matchEnv.stadiumStyle]);

  const attendance = useMemo(
    () => computeMatchAttendance(homeTeam, awayTeam, state, { kind, derby: isDerby }),
    [homeTeam, awayTeam, state, kind, isDerby]
  );

  const streamProj = useMemo(
    () => computeMatchStreamProjection(homeTeam, awayTeam, state, { kind, derby: isDerby }),
    [homeTeam, awayTeam, state, kind, isDerby]
  );

  const broadcastChannel = useMemo(
    () =>
      getMatchBroadcastChannel({
        tier: homeTeam.tier,
        kind,
        planId: streamProj.plan.id,
        homeId: homeTeam.id,
        season: state.season
      }),
    [homeTeam.tier, homeTeam.id, kind, streamProj.plan.id, state.season]
  );

  const homeFacMods = useMemo(
    () =>
      computeTeamFacilityMatchModifiers(homeTeam, state, {
        isHome: !isNeutralVenue,
        isNeutral: isNeutralVenue,
        attendancePct: attendance.pct,
        turfCondOverride: matchEnv.turfCond
      }),
    [homeTeam, state, isNeutralVenue, attendance.pct, matchEnv.turfCond]
  );

  const awayFacMods = useMemo(
    () =>
      computeTeamFacilityMatchModifiers(awayTeam, state, {
        isHome: false,
        isNeutral: isNeutralVenue,
        attendancePct: attendance.pct
      }),
    [awayTeam, state, isNeutralVenue, attendance.pct]
  );

  const stadiumName = useMemo(
    () => getStadiumDisplayName(homeTeam, kind, meIsHome, state),
    [homeTeam, kind, meIsHome, state]
  );

  const ranks = useMemo(() => {
    const map = new Map<number, number>();
    [0, 1, 2].forEach((tier) => {
      sortTable(state.teams.filter((t) => t.tier === tier)).forEach((tm, idx) => {
        map.set(tm.id, idx + 1);
      });
    });
    return map;
  }, [state.teams]);

  const homeRate = useMemo(
    () => rate(homeTeam, state, false, undefined, undefined, undefined, !isNeutralVenue),
    [homeTeam, state, isNeutralVenue]
  );
  const awayRate = useMemo(
    () => rate(awayTeam, state, false, undefined, undefined, undefined, false),
    [awayTeam, state]
  );

  const homeXi = useMemo(() => xi(homeTeam), [homeTeam]);
  const awayXi = useMemo(() => xi(awayTeam), [awayTeam]);
  const homeXiOv = useMemo(
    () => Math.round(homeXi.reduce((s, q) => s + q.ov, 0) / Math.max(1, homeXi.length)),
    [homeXi]
  );
  const awayXiOv = useMemo(
    () => Math.round(awayXi.reduce((s, q) => s + q.ov, 0) / Math.max(1, awayXi.length)),
    [awayXi]
  );
  const homeSlots = useMemo(() => getFormationSlots(homeTeam), [homeTeam]);
  const awaySlots = useMemo(() => getFormationSlots(awayTeam), [awayTeam]);

  const homeCap = useMemo(
    () =>
      homeTeam.cap && homeXi.some((q) => q.n === homeTeam.cap)
        ? homeTeam.cap
        : pickBestCaptain(homeTeam, homeXi.map((q) => q.n), undefined, state.p) || homeXi[0]?.n || '',
    [homeTeam, homeXi, state.p]
  );
  const awayCap = useMemo(
    () =>
      awayTeam.cap && awayXi.some((q) => q.n === awayTeam.cap)
        ? awayTeam.cap
        : pickBestCaptain(awayTeam, awayXi.map((q) => q.n), undefined, state.p) || awayXi[0]?.n || '',
    [awayTeam, awayXi, state.p]
  );

  const homeBench = useMemo(() => {
    const used = new Set(homeXi.map((q) => q.n));
    return homeTeam.sq
      .filter((q) => !used.has(q.n))
      .sort((a, b) => {
        const aUn = a.inj > 0 || (a.sus || 0) > 0 ? 1 : 0;
        const bUn = b.inj > 0 || (b.sus || 0) > 0 ? 1 : 0;
        return aUn - bUn || POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov;
      });
  }, [homeTeam.sq, homeXi]);

  const awayBench = useMemo(() => {
    const used = new Set(awayXi.map((q) => q.n));
    return awayTeam.sq
      .filter((q) => !used.has(q.n))
      .sort((a, b) => {
        const aUn = a.inj > 0 || (a.sus || 0) > 0 ? 1 : 0;
        const bUn = b.inj > 0 || (b.sus || 0) > 0 ? 1 : 0;
        return aUn - bUn || POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov;
      });
  }, [awayTeam.sq, awayXi]);

  const myTeam = meIsHome ? homeTeam : awayTeam;
  const oppTeam = meIsHome ? awayTeam : homeTeam;
  const myXi = meIsHome ? homeXi : awayXi;
  const myAvgFit = Math.round(myXi.reduce((sum, q) => sum + (q.fit ?? 100), 0) / Math.max(1, myXi.length));
  const restNeededStarters = myXi.filter((q) => q.inj === 0 && (q.sus || 0) === 0 && Math.round(q.fit ?? 100) < 65);
  const tiredWarningStarters = myXi.filter(
    (q) => q.inj === 0 && (q.sus || 0) === 0 && Math.round(q.fit ?? 100) >= 65 && Math.round(q.fit ?? 100) < 75
  );

  const assistantReport = useMemo(() => {
    if (!isMgr) return null;
    return buildAssistantCoachNotes({
      state,
      myTeam,
      oppTeam,
      meIsHome,
      myRate: meIsHome ? homeRate : awayRate,
      oppRate: meIsHome ? awayRate : homeRate,
      matchEnv,
      kind,
      isDerby
    });
  }, [isMgr, state, myTeam, oppTeam, meIsHome, homeRate, awayRate, matchEnv, kind, isDerby]);

  const isRecommendedApplied = useMemo(() => {
    const rec = assistantReport?.recommendation;
    if (!assistantReport?.canApplyTactics || !rec) return false;
    return (
      !myTeam.cf &&
      myTeam.form === rec.form &&
      myTeam.tac === rec.tac &&
      (myTeam.pass ?? 1) === rec.pass &&
      (myTeam.press ?? 1) === rec.press &&
      (myTeam.tempo ?? 1) === rec.tempo &&
      (myTeam.line ?? 1) === rec.line &&
      (myTeam.wid ?? 1) === rec.wid
    );
  }, [assistantReport, myTeam]);

  const handleApplyAssistantTactics = () => {
    const rec = assistantReport?.recommendation;
    if (!isMgr || !assistantReport?.canApplyTactics || !rec) return;
    SFX.tap();
    onUpdateState((d) => {
      const t = d.teams[d.me];
      t.cf = undefined;
      t.form = rec.form;
      t.lu = null;
      t.tac = rec.tac;
      t.pass = rec.pass;
      t.press = rec.press;
      t.tempo = rec.tempo;
      t.line = rec.line;
      t.wid = rec.wid;
    });
    setSwapPickName(null);
    setViewMode(meIsHome ? 'H' : 'A');
    onToast(`📋 ปรับใช้แผน ${rec.form} (${AR_T[rec.tac]}) ตามบันทึกผู้ช่วยโค้ชแล้ว`);
  };

  const handleRecommendPlan = () => {
    if (!isMgr) return;
    const plan = recommendMatchPlanAndLineup({
      state,
      myTeam,
      oppTeam,
      meIsHome,
      myRate: meIsHome ? homeRate : awayRate,
      oppRate: meIsHome ? awayRate : homeRate,
      matchEnv,
      kind,
      isDerby,
      existingReport: assistantReport
    });
    SFX.tap();
    onUpdateState((d) => {
      const t = d.teams[d.me];
      t.cf = undefined;
      t.form = plan.form;
      t.tac = plan.tac;
      t.pass = plan.pass;
      t.press = plan.press;
      t.tempo = plan.tempo;
      t.line = plan.line;
      t.wid = plan.wid;
      t.lu = plan.lineupNames;
    });
    setSwapPickName(null);
    setViewMode(meIsHome ? 'H' : 'A');
    setRecommendedPlanBanner(plan);
    onToast(`🎯 แนะนำแผน ${plan.form} (${AR_T[plan.tac]}) และจัด 11 ตัวจริงฟิตสูงสุด (เฉลี่ย ${plan.avgFit}%) แล้ว`);
  };

  const compLabel =
    kind === 'asia'
      ? `🌏 บอลถ้วยทวีป · ${RN[state.ac?.r ?? 0] || 'รอบคัดเลือก'}`
      : kind === 'sc'
        ? `${EXTRA_CUP_META.sc.icon} ${EXTRA_CUP_META.sc.name} · นัดชิงชนะเลิศ`
        : kind === 'lc'
          ? `${EXTRA_CUP_META.lc.icon} ${EXTRA_CUP_META.lc.name} · ${RN[state.lc?.r ?? 0] || `รอบ ${(state.lc?.r ?? 0) + 1}`}`
          : kind === 'dc'
            ? `${EXTRA_CUP_META.dc.icon} ${EXTRA_CUP_META.dc.name} · ${RN[state.dc?.r ?? 0] || `รอบ ${(state.dc?.r ?? 0) + 1}`}`
            : kind === 'cup'
              ? `🏆 ถ้วยประชาชน · ${RN[state.cup.r] || `รอบ ${state.cup.r + 1}`}`
              : `⚽ ${TN[homeTeam.tier]} · นัดที่ ${state.md + 1}/${state.fx.length}`;


  const handleQuickSwap = (targetName: string) => {
    if (!isMgr) return;
    if ((viewMode === 'H' && !meIsHome) || (viewMode === 'A' && meIsHome)) return;
    const targetPlayer = myTeam.sq.find((q) => q.n === targetName);
    if (!targetPlayer) return;
    if (targetPlayer.inj > 0 || (targetPlayer.sus || 0) > 0) {
      onToast(
        (targetPlayer.sus || 0) > 0
          ? `${targetPlayer.n.split(' ')[0]} ติดโทษแบน ลงสนามไม่ได้`
          : `${targetPlayer.n.split(' ')[0]} มีอาการบาดเจ็บ ลงสนามไม่ได้`
      );
      return;
    }
    if (!swapPickName) {
      SFX.tap();
      setSwapPickName(targetName);
      return;
    }
    if (swapPickName === targetName) {
      SFX.tap();
      setSwapPickName(null);
      return;
    }
    const pA = myTeam.sq.find((q) => q.n === swapPickName);
    const pB = targetPlayer;
    if (!pA || pA.inj > 0 || (pA.sus || 0) > 0) {
      setSwapPickName(targetName);
      return;
    }
    const curNames = myXi.map((q) => q.n);
    const idxA = curNames.indexOf(pA.n);
    const idxB = curNames.indexOf(pB.n);
    if (idxA < 0 && idxB < 0) {
      SFX.tap();
      setSwapPickName(targetName);
      return;
    }
    SFX.tap();
    onUpdateState((d) => {
      const t = d.teams[d.me];
      const list = xi(t).map((q) => q.n);
      const i1 = list.indexOf(pA.n);
      const i2 = list.indexOf(pB.n);
      if (i1 >= 0 && i2 >= 0) {
        [list[i1], list[i2]] = [list[i2], list[i1]];
      } else if (i1 >= 0) {
        list[i1] = pB.n;
      } else if (i2 >= 0) {
        list[i2] = pA.n;
      }
      t.lu = list;
    });
    setSwapPickName(null);
    onToast(`สลับ ${pA.n.split(' ')[0]} ↔ ${pB.n.split(' ')[0]} แล้ว`);
  };

  const handleRestTiredStarters = () => {
    if (!isMgr) return;
    const threshold = restNeededStarters.length > 0 ? 65 : 75;
    const swapped: string[] = [];
    SFX.tap();
    onUpdateState((d) => {
      const t = d.teams[d.me];
      const curXi = xi(t);
      const nextLu = curXi.map((q) => q.n);
      const used = new Set(nextLu);
      const freshPool = t.sq
        .filter((q) => !used.has(q.n) && q.inj === 0 && (q.sus || 0) === 0 && (q.fit ?? 100) >= 75)
        .sort((a, b) => (b.fit ?? 100) * 0.55 + b.ov - ((a.fit ?? 100) * 0.55 + a.ov));

      curXi.forEach((starter, idx) => {
        if (starter.inj > 0 || (starter.sus || 0) > 0) return;
        if (Math.round(starter.fit ?? 100) >= threshold) return;
        const subIdx = freshPool.findIndex((b) =>
          starter.pos === 'GK' ? b.pos === 'GK' : b.pos === starter.pos
        );
        const fallbackIdx =
          subIdx >= 0
            ? subIdx
            : starter.pos === 'GK'
              ? -1
              : freshPool.findIndex((b) => b.pos !== 'GK');
        if (fallbackIdx >= 0) {
          const rep = freshPool.splice(fallbackIdx, 1)[0];
          nextLu[idx] = rep.n;
          swapped.push(`${starter.n.split(' ')[0]}→${rep.n.split(' ')[0]}`);
        }
      });
      t.lu = nextLu;
    });
    setSwapPickName(null);
    if (swapped.length > 0) {
      onToast(`🛌 พักตัวล้า ${swapped.length} ตำแหน่งเรียบร้อย`);
    } else {
      onToast('ยังไม่มีตัวสำรองที่ฟิตพอสลับในตำแหน่งที่ล้า');
    }
  };

  const renderFormDots = (fm?: string) => {
    const chars = (fm || '').slice(-5).split('');
    if (!chars.length) return <span className="text-[9px] text-[var(--mut)]">ยังไม่แข่ง</span>;
    return (
      <span className="inline-flex items-center gap-0.5">
        {chars.map((c, idx) => (
          <span
            key={idx}
            className={`w-3.5 h-3.5 mland:w-3 mland:h-3 rounded text-[8px] mland:text-[7px] font-black inline-flex items-center justify-center ${
              c === 'W'
                ? 'bg-[var(--g)] text-white'
                : c === 'D'
                  ? 'bg-amber-400 text-[#261900]'
                  : 'bg-[var(--red)] text-white'
            }`}
          >
            {c}
          </span>
        ))}
      </span>
    );
  };

  const activeSide: 'H' | 'A' = viewMode === 'A' ? 'A' : 'H';
  const activeTeam = activeSide === 'H' ? homeTeam : awayTeam;
  const activeXi = activeSide === 'H' ? homeXi : awayXi;
  const activeXiOv = activeSide === 'H' ? homeXiOv : awayXiOv;
  const activeSlots = activeSide === 'H' ? homeSlots : awaySlots;
  const activeBench = activeSide === 'H' ? homeBench : awayBench;
  const activeCap = activeSide === 'H' ? homeCap : awayCap;
  const activeRate = activeSide === 'H' ? homeRate : awayRate;
  const activeKit = activeSide === 'H' ? homeKit : awayKit;
  const activeGkKit = activeSide === 'H' ? homeGkKit : awayGkKit;
  const activeTrim = activeSide === 'H' ? homeTrim : awayTrim;
  const canEditActiveTeam = isMgr && activeTeam.id === state.me;

  const weatherBadge =
    matchEnv.timeOfDay === 'night'
      ? matchEnv.season === 'rainy'
        ? { icon: <CloudRain className="w-4 h-4 text-sky-400" />, title: 'เตะกลางคืน · ฝนตก/พื้นเปียก', sub: 'อากาศชื้น ไฟสนามส่องสว่าง' }
        : { icon: <Moon className="w-4 h-4 text-amber-300" />, title: 'เตะกลางคืน · ท้องฟ้าโปร่ง', sub: 'อากาศเย็นสบาย แสงไฟสนาม' }
      : matchEnv.season === 'rainy'
        ? { icon: <CloudRain className="w-4 h-4 text-sky-500" />, title: 'กลางวัน · ฤดูฝน', sub: 'ฟ้าครึ้ม มีฝนปรอย/สนามชุ่มน้ำ' }
        : { icon: <Sun className="w-4 h-4 text-amber-500" />, title: 'กลางวัน · แดดออก', sub: 'อากาศร้อน เสียความฟิตเร็วขึ้นเล็กน้อย' };

  const grassLenText = matchEnv.grassLength === 'short' ? 'ตัดสั้น (บอลไว)' : matchEnv.grassLength === 'long' ? 'หญ้ายาว (บอลหนืด)' : 'ปานกลาง (มาตรฐาน)';
  const dirtPct = Math.round((matchEnv.dirtMix || 0) * 100);
  const surfaceText = dirtPct <= 5 ? 'หญ้าแน่นสมบูรณ์' : dirtPct <= 25 ? `มีรอยสึกเล็กน้อย (${dirtPct}%)` : `พื้นสึก/ดินปน (${dirtPct}%)`;

  const myXiNameSet = useMemo(() => new Set(myXi.map((q) => q.n)), [myXi]);

  const renderPlayerRow = (
    pl: Player,
    slotLabel: SubRole,
    team: Team,
    isStarter: boolean,
    isCap: boolean,
    opts?: { compact?: boolean }
  ) => {
    const compact = Boolean(opts?.compact);
    const no = getShirtNo(team, pl);
    const stMeta = getStaminaMeta(pl.fit);
    const fit = stMeta.f;
    const pen = isStarter ? playerPen(pl, slotLabel) : 0;
    const unavailable = pl.inj > 0 || (pl.sus || 0) > 0;
    const canEditRow = isMgr && team.id === state.me && viewMode !== 'compare' && !unavailable;
    const isPicked = swapPickName === pl.n;
    const isMePlayer = Boolean(pl.me || (state.mode === 'p' && state.p?.name === pl.n));
    const isHomeSide = team.id === homeId;
    const kitColor = pl.pos === 'GK' ? (isHomeSide ? homeGkKit : awayGkKit) : (isHomeSide ? homeKit : awayKit);
    const trimColor = pl.pos === 'GK' ? undefined : (isHomeSide ? homeTrim : awayTrim);
    const rowStaminaTint =
      isStarter && !unavailable
        ? fit < 65
          ? 'bg-rose-500/[0.08] hover:bg-rose-500/[0.13]'
          : fit < 75
            ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.11]'
            : ''
        : '';

    const pickedIsStarter = swapPickName ? myXiNameSet.has(swapPickName) : false;
    const isCrossGroupSwap = Boolean(swapPickName && swapPickName !== pl.n && pickedIsStarter !== isStarter);
    const showSwapCol = canEditRow && !compact;
    const gridColsCls = showSwapCol
      ? 'grid-cols-[22px_34px_26px_minmax(0,1fr)_54px_26px_auto] mland:grid-cols-[19px_30px_24px_minmax(0,1fr)_48px_23px_auto]'
      : 'grid-cols-[22px_34px_26px_minmax(0,1fr)_54px_28px] mland:grid-cols-[19px_30px_24px_minmax(0,1fr)_48px_24px]';

    return (
      <div
        key={`${isStarter ? 'xi' : 'bn'}-${pl.n}`}
        role={canEditRow ? 'button' : undefined}
        tabIndex={canEditRow ? 0 : undefined}
        onClick={() => canEditRow && handleQuickSwap(pl.n)}
        onKeyDown={(e) => {
          if (canEditRow && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleQuickSwap(pl.n);
          }
        }}
        className={`w-full grid ${gridColsCls} items-center gap-1 mland:gap-0.5 px-2 py-[3.5px] mland:px-1.5 mland:py-[2.5px] text-left select-none transition-colors ${
          isPicked
            ? 'bg-[var(--g-soft)] ring-1 ring-inset ring-[var(--g)]'
            : isMePlayer
              ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/70'
              : rowStaminaTint || 'hover:bg-[var(--surface-2)]/65'
        } ${unavailable ? 'opacity-72' : ''} ${canEditRow ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center justify-start">
          <MatchPlayerThumb
            player={pl}
            team={team}
            state={state}
            kitColor={kitColor}
            trimColor={trimColor}
            size="xs"
          />
        </div>

        <div className="flex items-center justify-start">
          <PositionBadge role={slotLabel} size="2xs" />
        </div>

        <div className="text-left text-[10px] mland:text-[8.5px] font-extrabold text-[#b45309] dark:text-[var(--lamp)] tabular whitespace-nowrap">
          #{no}
        </div>

        <div className="flex items-center justify-start gap-1 min-w-0">
          <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate">{pl.n}</span>
          {isCap && <CaptainBadge team={team} state={state} size="xs" className="shrink-0" />}
          {isMePlayer && (
            <span
              title="ตัวคุณ"
              aria-label="ตัวคุณ"
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8px] font-black shrink-0"
            >
              ★
            </span>
          )}
          {(pl.hg || pl.customCreated) ? <span title="เด็กปั้นสโมสร" className="text-[10px] mland:text-[8.5px] shrink-0">🌱</span> : null}
          {isStarter && slotLabel !== pl.ro && (
            <span className="text-[8.5px] mland:text-[7.5px] text-[var(--mut)] shrink-0">
              ({pl.ro}{pen === 2 ? ' ⚠️' : ''})
            </span>
          )}
        </div>

        <div className="flex items-center justify-start min-w-0">
          {(pl.sus || 0) > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] mland:text-[8px] font-bold text-[var(--red)] tabular">
              <StatIconBadge kind="red" count={pl.sus} size="xs" />
              {(pl.sus || 0) <= 1 && <span>แบน</span>}
            </span>
          ) : pl.inj > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] mland:text-[8px] font-bold text-[var(--red)] tabular">
              <StatIconBadge kind="injury" size="xs" />
              <span>พัก {pl.inj}น</span>
            </span>
          ) : (
            <StaminaBar
              value={fit}
              variant="compact"
              showStatusLabel
              className="w-full"
            />
          )}
        </div>

        <div className="flex items-center justify-start">
          <OvrBadge ov={pl.ov} size="2xs" />
        </div>

        {showSwapCol && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleQuickSwap(pl.n);
            }}
            title={
              isPicked
                ? 'ยกเลิกการเลือก'
                : swapPickName
                  ? `สลับกับ ${swapPickName.split(' ')[0]}`
                  : 'กดเพื่อเปลี่ยนตัว/สลับตำแหน่ง'
            }
            className={`px-1.5 py-0.5 mland:px-1 mland:py-[1px] rounded-md border text-[9.5px] mland:text-[8px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              isPicked
                ? 'bg-[var(--g)] border-[var(--g)] text-white'
                : isCrossGroupSwap
                  ? 'bg-[var(--g-soft)] border-[var(--g)]/60 text-[var(--g)] hover:bg-[var(--g)] hover:text-white'
                  : swapPickName
                    ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/60 text-[#8a5b00] dark:text-[var(--lamp)] hover:bg-[var(--lamp)] hover:text-[#261900]'
                    : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)] hover:text-[var(--g)]'
            }`}
          >
            {isPicked ? 'ยกเลิก' : isCrossGroupSwap ? '↔ เปลี่ยน' : swapPickName ? '↔ สลับ' : 'สลับ'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/82 flex items-center justify-center p-2 sm:p-3.5 mland:p-1.5 safe-all overflow-hidden">
      <div className="w-full max-w-6xl mland:max-w-[97vw] h-[calc(var(--app-dvh,1dvh)*94)] max-h-[calc(var(--app-dvh,1dvh)*94)] mland:h-[calc(var(--app-dvh,1dvh)*97)] mland:max-h-[calc(var(--app-dvh,1dvh)*97)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden">
        {/* TOP MATCHUP HEADER */}
        <div className="shrink-0 px-3 py-2 sm:px-4 sm:py-2 mland:px-2.5 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex flex-wrap sm:flex-nowrap mland:flex-nowrap items-center justify-between gap-2 sm:gap-3 mland:gap-2">
          {/* Left: Competition Tier & Matchday */}
          <div className="order-1 min-w-0 shrink sm:max-w-[190px] mland:max-w-[145px]">
            <div className="font-extrabold text-[11px] sm:text-xs mland:text-[9.5px] text-[var(--g)] truncate leading-tight">
              {kind === 'league' ? `⚽ ${TN[homeTeam.tier]}` : compLabel.split(' · ')[0]}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] mland:text-[8px] text-[var(--mut)] truncate tabular leading-tight">
              <span>
                {kind === 'league'
                  ? `นัด ${state.md + 1}/${state.fx.length}`
                  : compLabel.split(' · ')[1] || ''}
              </span>
              <span>·</span>
              <span>ซีซั่น {state.season}</span>
              {isDerby && <span className="font-extrabold text-[var(--red)] shrink-0">· 🔥 ดาร์บี้</span>}
            </div>
          </div>

          {/* Center: Matchup Teams (Home VS Away) */}
          <div className="order-3 sm:order-2 mland:order-2 w-full sm:w-auto mland:w-auto sm:flex-1 mland:flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5 sm:gap-2 mland:gap-1">
            {/* Home Club Card */}
            <div
              className={`flex items-center justify-end gap-2 mland:gap-1 min-w-0 px-2 py-1 sm:px-2.5 sm:py-1.5 mland:px-1.5 mland:py-1 rounded-xl border ${
                meIsHome
                  ? 'bg-[var(--g-soft)]/45 border-[var(--g)]/45'
                  : 'bg-[var(--surface)]/85 border-[var(--line)]'
              }`}
            >
              <div className="text-right min-w-0 flex-1">
                <div className="flex items-center justify-end gap-1.5 min-w-0">
                  {meIsHome && <MyTeamBadge size="sm" />}
                  <span
                    className={`font-extrabold text-xs sm:text-[13px] mland:text-[10.5px] truncate font-display ${
                      meIsHome ? 'text-[var(--g)]' : 'text-[var(--ink)]'
                    }`}
                  >
                    {homeTeam.name}
                  </span>
                </div>
                <div className="mt-0.5 text-[9.5px] mland:text-[7.5px] text-[var(--mut)] flex items-center justify-end gap-1 tabular">
                  <span className="hidden xl:inline-flex items-center">
                    {renderFormDots(homeTeam.fm)}
                  </span>
                  <span>{isNeutralVenue ? 'กลาง' : 'เหย้า'}</span>
                  <span>·</span>
                  <span>#{ranks.get(homeTeam.id) ?? '-'}</span>
                  <span>·</span>
                  <span className="font-bold text-[var(--ink)]">XI {homeXiOv}</span>
                </div>
              </div>
              <div className="shrink-0 [&>svg]:w-9 [&>svg]:h-9 sm:[&>svg]:w-11 sm:[&>svg]:h-11 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                <ClubCrest name={homeTeam.name} size={44} team={homeTeam} club={state.club} isMyClub={meIsHome && isMgr} />
              </div>
            </div>

            {/* Center VS */}
            <div className="flex flex-col items-center justify-center px-2 sm:px-2.5 mland:px-1.5 py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
              <span className="text-[8px] mland:text-[6.5px] font-bold tracking-wide text-[var(--mut)] leading-none">
                VS
              </span>
              <span className="mt-0.5 text-xs sm:text-sm mland:text-[10px] font-black font-display tracking-wider text-[var(--ink)] leading-none">
                แข่ง
              </span>
            </div>

            {/* Away Club Card */}
            <div
              className={`flex items-center gap-2 mland:gap-1 min-w-0 px-2 py-1 sm:px-2.5 sm:py-1.5 mland:px-1.5 mland:py-1 rounded-xl border ${
                !meIsHome
                  ? 'bg-[var(--g-soft)]/45 border-[var(--g)]/45'
                  : 'bg-[var(--surface)]/85 border-[var(--line)]'
              }`}
            >
              <div className="shrink-0 [&>svg]:w-9 [&>svg]:h-9 sm:[&>svg]:w-11 sm:[&>svg]:h-11 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                <ClubCrest name={awayTeam.name} size={44} team={awayTeam} club={state.club} isMyClub={!meIsHome && isMgr} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`font-extrabold text-xs sm:text-[13px] mland:text-[10.5px] truncate font-display ${
                      !meIsHome ? 'text-[var(--g)]' : 'text-[var(--ink)]'
                    }`}
                  >
                    {awayTeam.name}
                  </span>
                  {!meIsHome && <MyTeamBadge size="sm" />}
                </div>
                <div className="mt-0.5 text-[9.5px] mland:text-[7.5px] text-[var(--mut)] flex items-center gap-1 tabular">
                  <span className="font-bold text-[var(--ink)]">XI {awayXiOv}</span>
                  <span>·</span>
                  <span>#{ranks.get(awayTeam.id) ?? '-'}</span>
                  <span>·</span>
                  <span>{isNeutralVenue ? 'กลาง' : 'เยือน'}</span>
                  <span className="hidden xl:inline-flex items-center">
                    {renderFormDots(awayTeam.fm)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Top Corner: Uniform-Height Kickoff & Match Actions (matching MatchModal dock) */}
          <div className="order-2 sm:order-3 mland:order-3 flex items-center justify-end gap-1.5 mland:gap-1 shrink-0 ml-auto sm:ml-0 mland:ml-0">
            {isMgr && (
              <button
                type="button"
                title="จัดทัพเต็ม"
                aria-label="จัดทัพเต็ม"
                onClick={() => {
                  SFX.tap();
                  onOpenFullTactics();
                }}
                className="btn btn-surface h-10 sm:h-11 md:h-12 mland:h-[38px] min-w-10 sm:min-w-0 px-2.5 sm:px-3 mland:px-2.5 rounded-xl mland:rounded-lg text-xs sm:text-[13px] mland:text-[11px] shrink-0"
              >
                <SlidersHorizontal className="w-4 h-4 mland:w-3.5 mland:h-3.5 shrink-0" />
                <span className="hidden xl:inline">จัดทัพเต็ม</span>
              </button>
            )}
            <button
              type="button"
              title="จำลองผลเกมนี้ทันที"
              aria-label="ข้ามเกม"
              onClick={() => {
                SFX.tap();
                onQuickSim();
              }}
              className="btn btn-surface h-10 sm:h-11 md:h-12 mland:h-[38px] min-w-10 sm:min-w-0 px-2.5 sm:px-3.5 mland:px-2.5 rounded-xl mland:rounded-lg text-xs sm:text-[13px] mland:text-[11px] shrink-0"
            >
              <FastForward className="w-4 h-4 mland:w-3.5 mland:h-3.5 shrink-0" />
              <span className="hidden sm:inline mland:inline">ข้าม</span>
            </button>
            <button
              type="button"
              title="เริ่มแข่ง"
              aria-label="เริ่มแข่ง"
              onClick={() => {
                SFX.whistle();
                onKickOff(matchEnv);
              }}
              className="btn btn-gold h-10 sm:h-11 md:h-12 mland:h-[38px] px-3 sm:px-4 mland:px-2.5 rounded-xl mland:rounded-lg text-xs sm:text-[13px] mland:text-[11px] shrink-0"
            >
              <Play className="w-4 h-4 mland:w-3.5 mland:h-3.5 fill-current shrink-0" />
              <span>เริ่มแข่ง</span>
            </button>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              aria-label="ปิดหน้าก่อนแข่ง"
              title="ปิด"
              className="btn btn-surface w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 mland:w-[38px] mland:h-[38px] p-0 rounded-xl mland:rounded-lg shrink-0"
            >
              <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>
          </div>
        </div>

        {/* MAIN 2-COLUMN BODY (Compact Right Stadium Column so Pitch + Squad Name Box fit completely) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_285px] xl:grid-cols-[minmax(0,1fr)_315px] mland:grid-cols-[minmax(0,1fr)_240px] overflow-y-auto lg:overflow-hidden mland:overflow-hidden">
          {/* LEFT COLUMN: LINEUPS & TACTICS */}
          <div className="flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r mland:border-b-0 mland:border-r border-[var(--line)] overflow-hidden">
            {/* Content Area */}
            {viewMode === 'compare' ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="shrink-0 px-3 sm:px-4 mland:px-2.5 py-2 mland:py-1 bg-[var(--surface)] border-b border-[var(--line)]/80 flex items-center justify-between gap-2">
                  <div className="seg-bar w-full grid grid-cols-3">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSwapPickName(null);
                        setViewMode('H');
                      }}
                      className="seg-btn inline-flex items-center justify-center gap-1 truncate"
                    >
                      <span>{isNeutralVenue ? '🏟️' : '🏠'}</span>
                      <span className="truncate">{homeTeam.name}</span>
                      {meIsHome && <MyTeamBadge size="2xs" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSwapPickName(null);
                        setViewMode('A');
                      }}
                      className="seg-btn inline-flex items-center justify-center gap-1 truncate"
                    >
                      <span>{isNeutralVenue ? '🏟️' : '✈️'}</span>
                      <span className="truncate">{awayTeam.name}</span>
                      {!meIsHome && <MyTeamBadge size="2xs" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSwapPickName(null);
                        setViewMode('compare');
                      }}
                      className="seg-btn seg-btn-active truncate"
                    >
                      <ArrowLeftRight className="w-3 h-3 shrink-0" />
                      <span>เทียบ 2 ทีม</span>
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 mland:p-2 grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2">
                {[
                  { side: 'H' as const, team: homeTeam, list: homeXi, slots: homeSlots, bench: homeBench, cap: homeCap, ov: homeXiOv },
                  { side: 'A' as const, team: awayTeam, list: awayXi, slots: awaySlots, bench: awayBench, cap: awayCap, ov: awayXiOv }
                ].map((col) => (
                  <div key={col.side} className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden flex flex-col min-w-0">
                    <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 bg-[var(--surface-2)]/85 border-b border-[var(--line)] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ClubCrest name={col.team.name} size={20} team={col.team} club={state.club} isMyClub={col.team.id === state.me && isMgr} />
                        <span className="font-extrabold text-xs mland:text-[10.5px] truncate">{col.team.name}</span>
                        {col.team.id === state.me && <MyTeamBadge size="2xs" />}
                      </div>
                      <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-bold tabular shrink-0">
                        {col.team.cf ? 'กำหนดเอง' : col.team.form} · {AR_T[col.team.tac]} · XI {col.ov}
                      </span>
                    </div>
                    <div
                      className="px-2.5 py-0.5 mland:px-2 border-b border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--g)]"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--g) 15%, var(--surface))' }}
                    >
                      <span>ตัวจริง</span>
                      <span className="tabular">{col.list.length} คน</span>
                    </div>
                    <div className="divide-y divide-[var(--line)]/50">
                      {col.list.map((pl, idx) =>
                        renderPlayerRow(pl, col.slots[idx]?.sp || pl.ro, col.team, true, pl.n === col.cap, { compact: true })
                      )}
                    </div>
                    {col.bench.length > 0 && (
                      <>
                        <div className="px-2.5 py-0.5 mland:px-2 bg-[var(--surface-2)] border-y border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--ink)]">
                          <span>ตัวสำรอง</span>
                          <span className="tabular text-[var(--mut)]">{col.bench.length} คน</span>
                        </div>
                        <div className="divide-y divide-[var(--line)]/50">
                          {col.bench.slice(0, 7).map((pl) =>
                            renderPlayerRow(pl, pl.ro, col.team, false, false, { compact: true })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[0.94fr_1.06fr] mland:grid-cols-[0.94fr_1.06fr] overflow-y-auto sm:overflow-hidden mland:overflow-hidden">
                {/* Formation Pitch Visual (Full Height & Width with Compact Logo Switcher Inside) */}
                <div className="p-1.5 sm:p-2 mland:p-1 bg-[#092818] flex items-center justify-center h-[400px] sm:h-full mland:h-full min-h-0 relative overflow-hidden">
                  {/* Compact Logo-Only Team & Compare Switcher Inside Pitch */}
                  <div className="absolute top-2 left-2 z-20 flex items-center gap-1 p-1 rounded-xl bg-[#05180e]/88 border border-white/25 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSwapPickName(null);
                        setViewMode('H');
                      }}
                      title={homeTeam.name}
                      aria-label={homeTeam.name}
                      className={`relative h-9 w-9 sm:h-10 sm:w-10 mland:h-8 mland:w-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors [&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-8 sm:[&>svg]:h-8 mland:[&>svg]:w-6 mland:[&>svg]:h-6 ${
                        viewMode === 'H'
                          ? 'bg-emerald-500 shadow-xs ring-1 ring-white/50'
                          : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                      }`}
                    >
                      <ClubCrest name={homeTeam.name} size={32} team={homeTeam} club={state.club} isMyClub={meIsHome && isMgr} />
                      {meIsHome && <MyTeamBadge size="2xs" className="absolute -top-0.5 -right-0.5 ring-1 ring-[#05180e]" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSwapPickName(null);
                        setViewMode('A');
                      }}
                      title={awayTeam.name}
                      aria-label={awayTeam.name}
                      className={`relative h-9 w-9 sm:h-10 sm:w-10 mland:h-8 mland:w-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors [&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-8 sm:[&>svg]:h-8 mland:[&>svg]:w-6 mland:[&>svg]:h-6 ${
                        viewMode === 'A'
                          ? 'bg-emerald-500 shadow-xs ring-1 ring-white/50'
                          : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                      }`}
                    >
                      <ClubCrest name={awayTeam.name} size={32} team={awayTeam} club={state.club} isMyClub={!meIsHome && isMgr} />
                      {!meIsHome && <MyTeamBadge size="2xs" className="absolute -top-0.5 -right-0.5 ring-1 ring-[#05180e]" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSwapPickName(null);
                        setViewMode('compare');
                      }}
                      title="เทียบ 2 ทีม"
                      aria-label="เทียบ 2 ทีม"
                      className="h-9 w-9 sm:h-10 sm:w-10 mland:h-8 mland:w-8 rounded-lg flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <ArrowLeftRight className="w-4.5 h-4.5 sm:w-5 sm:h-5 mland:w-4 mland:h-4" />
                    </button>
                  </div>

                  {/* Full-Height Formation Pitch */}
                  <div className="h-full min-h-0 w-full flex items-center justify-center">
                    <FormationPitch
                      team={activeTeam}
                      state={state}
                      lineupNames={activeXi.map((q) => q.n)}
                      kitOverride={activeKit}
                      gkKitOverride={activeGkKit}
                      trimOverride={activeTrim}
                      showFitBar={true}
                      showPitchCrest={true}
                      selectedPlayerName={swapPickName}
                      onPlayerClick={canEditActiveTeam ? (pl) => handleQuickSwap(pl.n) : undefined}
                      className="aspect-[300/380] h-full w-auto max-w-full mx-auto rounded-xl block select-none"
                    />
                  </div>
                </div>

                {/* Tactics Summary + Squad Lineup Panel (matching SquadTacticsView) */}
                <div className="flex flex-col min-h-0 sm:overflow-hidden mland:overflow-hidden p-2 sm:p-2.5 mland:p-1.5 gap-2 mland:gap-1.5">
                  {/* Tactics & Quick Adjustment */}
                  <div className="shrink-0 pb-2 mland:pb-1.5 border-b border-[var(--line)] space-y-1.5 mland:space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--ink)] flex items-center gap-1 min-w-0 truncate">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                        <span className="truncate">แผนการเล่น &amp; แท็กติก</span>
                      </span>
                      {canEditActiveTeam ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={handleRecommendPlan}
                            title="วิเคราะห์จุดอ่อนคู่แข่งจากผู้ช่วยโค้ช + จัด 11 ตัวจริงที่ความฟิตสูงสุดอัตโนมัติ"
                            className="h-7 mland:h-6 px-2 rounded-lg bg-[var(--g)] text-white text-[10.5px] mland:text-[9px] font-bold inline-flex items-center gap-1 hover:brightness-110 transition-all cursor-pointer shrink-0 whitespace-nowrap"
                          >
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span>แนะนำแผน</span>
                          </button>
                          <select
                            aria-label="เลือกแผนการเล่น"
                            value={activeTeam.cf ? '__custom__' : activeTeam.form}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__custom__') return;
                              SFX.tap();
                              onUpdateState((d) => {
                                const t = d.teams[d.me];
                                t.cf = undefined;
                                t.form = val;
                                t.lu = null;
                              });
                            }}
                            className="h-7 mland:h-6 px-2 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] cursor-pointer"
                          >
                            {activeTeam.cf && <option value="__custom__">กำหนดเอง</option>}
                            {Object.keys(FSD).map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--g)]">
                          {activeTeam.cf ? 'กำหนดเอง' : activeTeam.form}
                        </span>
                      )}
                    </div>

                    {canEditActiveTeam ? (
                      <div className="grid grid-cols-5 gap-1">
                        {(['X', 'A', 'B', 'D', 'Z'] as Mentality[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              onUpdateState((d) => {
                                d.teams[d.me].tac = m;
                              });
                            }}
                            className={`py-1 mland:py-0.5 px-1 rounded-lg text-[10px] mland:text-[8.5px] font-bold truncate border cursor-pointer transition-colors ${
                              activeTeam.tac === m
                                ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                : 'bg-[var(--surface-2)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {AR_T[m]}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular">
                      <span>จ่ายบอล: <b className="text-[var(--ink)]">{PASS_LABELS[activeTeam.pass ?? 1]}</b></span>
                      <span>·</span>
                      <span>เพรสซิ่ง: <b className="text-[var(--ink)]">{PRESS_LABELS[activeTeam.press ?? 1]}</b></span>
                      <span>·</span>
                      <span>จังหวะ: <b className="text-[var(--ink)]">{TEMPO_LABELS[activeTeam.tempo ?? 1]}</b></span>
                      <span>·</span>
                      <span>แนวรับ: <b className="text-[var(--ink)]">{LINE_LABELS[activeTeam.line ?? 1]}</b></span>
                      <span>·</span>
                      <span>กว้าง: <b className="text-[var(--ink)]">{WID_LABELS[activeTeam.wid ?? 1]}</b></span>
                    </div>

                    {canEditActiveTeam && recommendedPlanBanner && (
                      <div className="p-2 mland:p-1.5 rounded-lg bg-[var(--g-soft)]/70 border border-[var(--g)]/45 text-[10px] mland:text-[8.5px] space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-[var(--g)] tabular truncate">
                            🎯 จัดแผน {recommendedPlanBanner.form} ({AR_T[recommendedPlanBanner.tac]}) · 11 ตัวจริงฟิตเฉลี่ย {recommendedPlanBanner.avgFit}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setRecommendedPlanBanner(null)}
                            aria-label="ปิดสรุปแผนแนะนำ"
                            className="text-[var(--mut)] hover:text-[var(--ink)] shrink-0 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[var(--ink)]/90 leading-snug">
                          {recommendedPlanBanner.weaknessSummary}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Squad Panel (matching Post-Match Lineup Style) */}
                  <div className="flex-1 min-h-[240px] sm:min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-col overflow-hidden">
                    <div className="shrink-0 px-2.5 pt-2 pb-1.5 mland:px-2 mland:pt-1.5 mland:pb-1 bg-[var(--surface-2)]/55 border-b border-[var(--line)] space-y-1">
                      <div className="flex items-center justify-between gap-1.5 mland:gap-1 min-w-0">
                        <span className="font-bold text-xs mland:text-[10px] text-[var(--ink)] whitespace-nowrap shrink-0 flex items-center gap-1">
                          <span>👥 รายชื่อทีม</span>
                          {activeTeam.id === state.me && <MyTeamBadge size="2xs" />}
                        </span>

                        <div className="flex items-center justify-end gap-1 min-w-0 overflow-x-auto no-scrollbar">
                          <div className="seg-bar shrink-0 !p-[2px]">
                            {([['ทั้งหมด', 0], ['ตัวจริง', 1], [`สำรอง ${activeBench.length}`, 2]] as const).map(([l, k]) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  SFX.tap();
                                  setLuTab(k);
                                }}
                                className={`seg-btn !px-1.5 !py-0.5 mland:!px-1 mland:!py-[1px] !text-[10px] mland:!text-[8.5px] whitespace-nowrap ${
                                  luTab === k ? 'seg-btn-active' : ''
                                }`}
                              >
                                {l}
                              </button>
                            ))}
                          </div>

                          {canEditActiveTeam && (
                            <div className="flex items-center gap-1 shrink-0">
                              {(restNeededStarters.length > 0 || tiredWarningStarters.length > 0) && (
                                <button
                                  type="button"
                                  onClick={handleRestTiredStarters}
                                  title="สลับตัวจริงที่อ่อนล้าไปพักที่ม้านั่งสำรองและส่งตัวฟิตลงแทน"
                                  className={`h-[24px] mland:h-[20px] px-1.5 mland:px-1 rounded-lg border text-[10px] mland:text-[8.5px] font-bold inline-flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                                    restNeededStarters.length > 0
                                      ? 'bg-[var(--red)] border-[var(--red)] text-white hover:brightness-110'
                                      : 'bg-amber-500/15 border-amber-500/45 text-[#b45309] dark:text-[#fcd34d] hover:bg-amber-500 hover:text-white'
                                  }`}
                                >
                                  🛌 พักล้า ({restNeededStarters.length > 0 ? restNeededStarters.length : tiredWarningStarters.length})
                                </button>
                              )}
                              <button
                                type="button"
                                title={activeTeam.lu ? 'รีเซ็ตเป็นจัด 11 ตัวจริงอัตโนมัติ' : 'กำลังใช้ระบบจัดตัวจริงอัตโนมัติ'}
                                onClick={() => {
                                  SFX.tap();
                                  setSwapPickName(null);
                                  onUpdateState((d) => {
                                    d.teams[d.me].lu = null;
                                  });
                                  onToast('จัด 11 ตัวจริงอัตโนมัติแล้ว');
                                }}
                                className={`h-[24px] mland:h-[20px] px-1.5 mland:px-1 rounded-lg border text-[10px] mland:text-[8.5px] font-bold inline-flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                                  !activeTeam.lu
                                    ? 'bg-[var(--g-soft)] border-[var(--g)]/45 text-[var(--g)]'
                                    : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--g)] hover:text-white hover:border-[var(--g)]'
                                }`}
                              >
                                {activeTeam.lu ? '⚡ อัตโนมัติ' : '✓ อัตโนมัติ'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {canEditActiveTeam && (
                        <div className="flex items-center justify-between gap-2 px-1.5 py-0.5 rounded-md bg-[var(--surface)]/80 border border-[var(--line)]/60 text-[9.5px] mland:text-[7.5px]">
                          <span className="font-semibold text-[var(--mut)] shrink-0">ความฟิต:</span>
                          <div className="flex items-center gap-2 mland:gap-1.5 tabular truncate">
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                              <span className="w-2 h-2 rounded-full bg-[#ef4444]" /> &lt;65% ควรพัก
                            </span>
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-bold">
                              <span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> 65-74% เริ่มล้า
                            </span>
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                              <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> ≥75% พร้อม
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Player Rows */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      {luTab !== 2 && (
                        <>
                          <div
                            className="sticky top-0 z-10 px-2.5 py-0.5 mland:px-2 border-b border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--g)]"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--g) 15%, var(--surface))' }}
                          >
                            <span>ตัวจริง</span>
                            <span className="tabular">{activeXi.length} คน</span>
                          </div>
                          <div className="divide-y divide-[var(--line)]/50">
                            {activeXi.map((pl, idx) =>
                              renderPlayerRow(pl, activeSlots[idx]?.sp || pl.ro, activeTeam, true, pl.n === activeCap)
                            )}
                          </div>
                        </>
                      )}
                      {luTab !== 1 && (
                        <>
                          <div className="sticky top-0 z-10 px-2.5 py-0.5 mland:px-2 bg-[var(--surface-2)] border-y border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--ink)]">
                            <span>ตัวสำรอง</span>
                            <span className="tabular text-[var(--mut)]">{activeBench.length} คน</span>
                          </div>
                          {activeBench.length > 0 ? (
                            <div className="divide-y divide-[var(--line)]/50">
                              {activeBench.map((pl) => renderPlayerRow(pl, pl.ro, activeTeam, false, false))}
                            </div>
                          ) : (
                            <div className="text-center py-3 text-[10.5px] mland:text-[9px] text-[var(--mut)]">
                              ไม่มีนักเตะสำรองในทีม
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: COMPACT ASSISTANT COACH NOTES & STADIUM/PITCH INFO */}
          <div className="flex flex-col min-h-0 overflow-y-auto p-2 mland:p-1.5 space-y-2 mland:space-y-1.5 bg-[var(--surface)]">
            {isMgr && assistantReport && (
              <section
                aria-label="บันทึกโน้ตจากผู้ช่วยโค้ช"
                className="rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] p-2 mland:p-1.5 space-y-1.5 mland:space-y-1"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-[var(--line)]/80">
                  <div className="min-w-0">
                    <div className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--ink)] flex items-center gap-1">
                      <ClipboardList className="w-3.5 h-3.5 mland:w-3 mland:h-3 text-[var(--g)] shrink-0" />
                      <span className="truncate">โน้ตผู้ช่วยโค้ช</span>
                    </div>
                    <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                      {assistantReport.rankTitle} · {assistantReport.confidenceLabel}
                    </div>
                  </div>
                  {assistantReport.asstLv === 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Lv.0</span>
                    </span>
                  ) : null}
                </div>

                {/* Weaknesses & Key Observations */}
                <div className="divide-y divide-[var(--line)]/65">
                  {assistantReport.weaknesses.map((item, idx) => (
                    <div key={idx} className="py-1 first:pt-0 last:pb-0 space-y-0.5">
                      <div className="text-[10.5px] mland:text-[9px] font-extrabold text-[var(--ink)] leading-tight">
                        {assistantReport.asstLv > 0 ? `${idx + 1}. ` : ''}{item.title}
                      </div>
                      <p className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Danger Threat & Specific Target (Lv.2+ / Lv.5+) */}
                {(assistantReport.dangerThreat || assistantReport.targetPlayerNote) && (
                  <div className="pt-1 border-t border-[var(--line)]/70 space-y-1 text-[10px] mland:text-[8.5px]">
                    {assistantReport.dangerThreat && (
                      <div className="rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/70 px-2 py-1 space-y-0.5">
                        <div className="font-extrabold text-[var(--red)] leading-tight">{assistantReport.dangerThreat.title}</div>
                        <div className="text-[var(--mut)] leading-snug">{assistantReport.dangerThreat.detail}</div>
                      </div>
                    )}
                    {assistantReport.targetPlayerNote && (
                      <div className="rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/70 px-2 py-1 space-y-0.5">
                        <div className="font-extrabold text-[var(--g)] tabular leading-tight">
                          เจาะจุดอ่อน: {assistantReport.targetPlayerNote.name} ({assistantReport.targetPlayerNote.role} · OV {assistantReport.targetPlayerNote.ov} · {assistantReport.targetPlayerNote.fit}%)
                        </div>
                        <div className="text-[var(--mut)] leading-snug">
                          {assistantReport.targetPlayerNote.reason}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tactical Recommendation + 1-Click Apply */}
                {assistantReport.recommendation && (
                  <div className="pt-1.5 border-t border-[var(--line)]/80 space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10.5px] mland:text-[9px] font-extrabold text-[var(--g)] truncate">
                        คำแนะนำแผน
                      </span>
                      {assistantReport.canApplyTactics && (
                        <button
                          type="button"
                          onClick={handleApplyAssistantTactics}
                          disabled={isRecommendedApplied}
                          className={`btn btn-xs !h-6 !px-2 !text-[9.5px] mland:!text-[8px] shrink-0 ${isRecommendedApplied ? 'btn-surface text-[var(--g)] border-[var(--g)]/50' : 'btn-primary'}`}
                        >
                          {isRecommendedApplied ? (
                            <>
                              <Check className="w-2.5 h-2.5" />
                              <span>ใช้อยู่แล้ว</span>
                            </>
                          ) : (
                            <span>ใช้แผนแนะนำ</span>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="text-[10.5px] mland:text-[9px] font-bold text-[var(--ink)] tabular leading-tight">
                      {assistantReport.recommendation.summaryLine}
                    </div>
                    <p className="text-[9.5px] mland:text-[8px] text-[var(--mut)] leading-snug">
                      {assistantReport.recommendation.rationale}
                    </p>
                  </div>
                )}

                {/* Squad Fit / Pitch Condition Note */}
                {(assistantReport.squadFitNote || assistantReport.envNote) && (
                  <div className="pt-1 border-t border-[var(--line)]/65 space-y-0.5 text-[9.5px] mland:text-[8px] text-[var(--mut)] leading-snug">
                    {assistantReport.squadFitNote && (
                      <div>
                        <b className="text-[var(--ink)]">ความพร้อม:</b> {assistantReport.squadFitNote}
                      </div>
                    )}
                    {assistantReport.envNote && (
                      <div>
                        <b className="text-[var(--ink)]">จังหวะสนาม:</b> {assistantReport.envNote}
                      </div>
                    )}
                  </div>
                )}

                {/* Upgrade Hint */}
                {assistantReport.unlockHint && (
                  <div className="pt-1 border-t border-[var(--line)]/60 text-[9.5px] mland:text-[8px] text-[var(--mut)] leading-snug">
                    💡 {assistantReport.unlockHint}
                  </div>
                )}
              </section>
            )}

            {/* Compact Unified Stadium, Attendance, Weather & Pitch Card */}
            <section
              aria-label="สนามแข่งขันและสภาพสนาม"
              className="rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] p-2 mland:p-1.5 space-y-1.5 mland:space-y-1"
            >
              {/* Compact Stadium Header */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FacilityUpgradeSvg
                    kind="st"
                    stadiumStyle={matchEnv.stadiumStyle}
                    level={meIsHome && isMgr ? clamp(state.st ?? 1, 1, 10) : clamp(homeTeam.tier * 2 + 4, 2, 10)}
                    condition={100}
                    c1={homeKit}
                    c2={homeTrim}
                    className="w-[44px] h-[28px] mland:w-[36px] mland:h-[23px] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[9.5px] mland:text-[7.5px] font-bold text-[var(--g)] leading-none">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">สนามแข่งขัน</span>
                    </div>
                    <h3 className="font-extrabold text-xs mland:text-[10.5px] text-[var(--ink)] font-display truncate leading-tight mt-0.5">
                      {stadiumName}
                    </h3>
                    <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] truncate leading-tight">
                      {stadiumStyleSpec.name}
                      {stadiumStyleSpec.rainShield === 'full'
                        ? ' · กันฝน 100%'
                        : stadiumStyleSpec.rainShield === 'partial'
                          ? ' · กันฝนบางส่วน'
                          : ''}
                      {' · จุ '}
                      <b className="text-[var(--ink)] tabular">{attendance.cap.toLocaleString()}</b>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Attendance & Broadcast */}
              <div className="px-2 py-1.5 mland:px-1.5 mland:py-1 rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/65 space-y-1">
                <div className="flex items-center justify-between text-[10px] mland:text-[8.5px] tabular">
                  <span className="text-[var(--mut)] font-semibold inline-flex items-center gap-1">
                    <Users className="w-3 h-3 text-[var(--g)] shrink-0" />
                    <span>ผู้ชม</span>
                  </span>
                  <span className="font-extrabold text-[var(--ink)]">
                    {attendance.att.toLocaleString()} <span className="text-[var(--g)]">({attendance.pct}%)</span>
                  </span>
                </div>
                <div className="h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--g)]"
                    style={{ width: `${clamp(attendance.pct, 4, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-1 text-[9.5px] mland:text-[7.5px] text-[var(--mut)] tabular">
                  <span className="inline-flex items-center gap-1 truncate">
                    <Tv className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{broadcastChannel.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-[var(--ink)]">
                    ~{fmtFansShort(streamProj.baseViewers)} · แฟน {fmtFansShort(ensureTeamFans(homeTeam))}
                  </span>
                </div>
              </div>

              {/* Compact Weather & Turf */}
              <div className="pt-1 border-t border-[var(--line)]/70 space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 mland:w-5 mland:h-5 rounded-md bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">
                      {weatherBadge.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[10px] mland:text-[8.5px] text-[var(--ink)] truncate leading-tight">{weatherBadge.title}</div>
                      <div className="text-[9px] mland:text-[7.5px] text-[var(--mut)] truncate leading-tight">{weatherBadge.sub}</div>
                    </div>
                  </div>
                  <span className="text-[9.5px] mland:text-[7.5px] font-bold text-[var(--mut)] shrink-0 tabular">
                    {matchEnv.puddles.length > 0 ? `แอ่ง ${matchEnv.puddles.length}` : 'ระบายดี'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5 text-[10px] mland:text-[8.5px]">
                    <span className="font-extrabold text-[var(--ink)] truncate">{turfMods.gradeName}</span>
                    <span
                      className={`font-extrabold tabular shrink-0 ${
                        matchEnv.turfCond >= 80
                          ? 'text-[var(--g)]'
                          : matchEnv.turfCond >= 60
                            ? 'text-amber-600 dark:text-amber-300'
                            : 'text-[var(--red)]'
                      }`}
                    >
                      {matchEnv.turfCond}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--surface)] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        matchEnv.turfCond >= 80
                          ? 'bg-[var(--g)]'
                          : matchEnv.turfCond >= 60
                            ? 'bg-amber-500'
                            : 'bg-[var(--red)]'
                      }`}
                      style={{ width: `${clamp(matchEnv.turfCond, 5, 100)}%` }}
                    />
                  </div>
                  <p className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] leading-tight truncate" title={`${turfSpec.desc} · หญ้า ${grassLenText} · ${surfaceText}`}>
                    หญ้า<b className="text-[var(--ink)]">{grassLenText}</b> · <b className="text-[var(--ink)]">{surfaceText}</b>
                  </p>
                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    {turfMods.effectsSummary.map((line, i) => (
                      <div
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-[var(--surface)]/80 border border-[var(--line)]/60 text-[9.5px] mland:text-[7.5px] font-semibold text-[var(--ink)] tabular truncate"
                        title={line}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Compact Home Advantage & Away Travel Readiness */}
            {(() => {
              const fmtSign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
              const toneCls = (n: number) =>
                n > 0 ? 'text-[var(--g)]' : n < 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]';

              const homeCrowdDelta = homeFacMods.crowdDelta ?? 0;
              const homeTurfDelta = homeFacMods.homeTurfFamDelta ?? 0;
              const homeSlipSavePct = Math.round((1 - (homeFacMods.slipResistMult ?? 1)) * 100);
              const homeTravelLv = homeFacMods.levels.travelLv ?? 1;
              const homeTravelCond = homeFacMods.conditions.travelLv ?? 100;
              const homeTravelDelta = homeFacMods.travelDelta ?? 0;
              const homeTravelFatPct = Math.round(((homeFacMods.travelFatigueMult ?? 1) - 1) * 100);

              const awayTravelLv = awayFacMods.levels.travelLv ?? 1;
              const awayTravelCond = awayFacMods.conditions.travelLv ?? 100;
              const awayTravelDelta = awayFacMods.travelDelta ?? 0;
              const awayTravelFatPct = Math.round(((awayFacMods.travelFatigueMult ?? 1) - 1) * 100);

              return (
                <div className="rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] p-2 mland:p-1.5 space-y-1.5 mland:space-y-1">
                  <div className="font-extrabold text-[10px] mland:text-[8.5px] text-[var(--ink)] flex items-center gap-1 min-w-0 truncate">
                    <Sparkles className="w-3 h-3 text-[var(--lamp)] shrink-0" />
                    <span className="truncate">
                      {isNeutralVenue ? 'เดินทางสนามกลาง' : 'เจ้าบ้าน & เดินทางทีมเยือน'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {/* Home / Neutral Strip */}
                    <div className="px-1.5 py-1 rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/65 space-y-0.5">
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          {isNeutralVenue ? (
                            <FacilityUpgradeSvg
                              kind="travelLv"
                              level={homeTravelLv}
                              condition={homeTravelCond}
                              c1={homeKit}
                              c2={homeTrim}
                              className="w-[26px] h-[17px] shrink-0"
                            />
                          ) : (
                            <ClubCrest name={homeTeam.name} size={16} team={homeTeam} club={state.club} isMyClub={meIsHome && isMgr} />
                          )}
                          <span className="text-[10px] mland:text-[8.5px] font-extrabold text-[var(--ink)] truncate">
                            {homeTeam.name}
                          </span>
                        </div>
                        <span className="px-1 py-[1px] rounded bg-[var(--g-soft)] text-[var(--g)] text-[8px] mland:text-[7px] font-bold shrink-0">
                          {isNeutralVenue ? 'กลาง' : 'เหย้า'}
                        </span>
                      </div>

                      {!isNeutralVenue ? (
                        <div className="flex items-center justify-between gap-1 text-[9px] mland:text-[7.5px] tabular">
                          <span className="text-[var(--mut)] truncate">
                            เชียร์ Lv.{homeFacMods.levels.st} · หญ้า Lv.{homeFacMods.levels.turfLv}{homeSlipSavePct > 0 ? ` · เกาะ +${homeSlipSavePct}%` : ''}
                          </span>
                          <span className="font-bold shrink-0">
                            <span className={toneCls(homeCrowdDelta)}>นิ่ง {fmtSign(homeCrowdDelta)}</span>
                            <span className="text-[var(--mut)] mx-0.5">·</span>
                            <span className={toneCls(homeTurfDelta)}>คุม {fmtSign(homeTurfDelta)}</span>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1 text-[9px] mland:text-[7.5px] tabular">
                          <span className="text-[var(--mut)] truncate">
                            🚌 {getTravelTierLabel(homeTravelLv)} {homeTravelLv > 0 ? `Lv.${homeTravelLv} (${homeTravelCond}%)` : ''}
                          </span>
                          <span className="font-bold shrink-0">
                            <span className={toneCls(homeTravelDelta)}>นิ่ง {fmtSign(homeTravelDelta)}</span>
                            <span className="text-[var(--mut)] mx-0.5">·</span>
                            <span className={homeTravelFatPct < 0 ? 'text-[var(--g)]' : homeTravelFatPct > 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}>
                              ล้า {homeTravelFatPct > 0 ? `+${homeTravelFatPct}%` : `${homeTravelFatPct}%`}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Away Travel Strip */}
                    <div className="px-1.5 py-1 rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/65 space-y-0.5">
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <FacilityUpgradeSvg
                            kind="travelLv"
                            level={awayTravelLv}
                            condition={awayTravelCond}
                            c1={awayKit}
                            c2={awayTrim}
                            className="w-[26px] h-[17px] shrink-0"
                          />
                          <span className="text-[10px] mland:text-[8.5px] font-extrabold text-[var(--ink)] truncate">
                            {awayTeam.name}
                          </span>
                        </div>
                        <span
                          className={`px-1 py-[1px] rounded text-[8px] mland:text-[7px] font-bold shrink-0 ${
                            awayTravelLv <= 0
                              ? 'bg-[var(--red-soft)] text-[var(--red)]'
                              : 'bg-[var(--surface-2)] text-[var(--ink)]'
                          }`}
                        >
                          {isNeutralVenue ? 'กลาง' : 'เยือน'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 text-[9px] mland:text-[7.5px] tabular">
                        <span className={`truncate ${awayTravelLv <= 0 ? 'text-[var(--red)]' : awayTravelCond < 75 ? 'text-amber-600 dark:text-amber-300' : 'text-[var(--mut)]'}`}>
                          🚌 {awayTravelLv > 0 ? `${getTravelTierLabel(awayTravelLv)} Lv.${awayTravelLv} (${awayTravelCond}%)` : 'ไม่มีระบบเดินทาง'}
                        </span>
                        <span className="font-bold shrink-0">
                          <span className={toneCls(awayTravelDelta)}>นิ่ง {fmtSign(awayTravelDelta)}</span>
                          <span className="text-[var(--mut)] mx-0.5">·</span>
                          <span className={awayTravelFatPct < 0 ? 'text-[var(--g)]' : awayTravelFatPct > 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}>
                            {awayTravelFatPct < 0 ? `ล้า ${awayTravelFatPct}%` : awayTravelFatPct > 0 ? `ล้า +${awayTravelFatPct}%` : 'ปกติ'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
