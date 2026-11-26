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
import { computeTurfMatchModifiers, getTurfGradeSpec } from '../data/crestAndKitData';
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
import { buildAssistantCoachNotes } from '../engine/assistantNotes';
import { ovColor } from '../engine/missions';
import { ClubCrest, FormationPitch } from '../components/SvgVisuals';
import { StaminaBar } from '../components/StaminaBar';

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
  const [swapPickName, setSwapPickName] = useState<string | null>(null);

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
        isHome: true,
        attendancePct: attendance.pct,
        turfCondOverride: matchEnv.turfCond
      }),
    [homeTeam, state, attendance.pct, matchEnv.turfCond]
  );

  const awayFacMods = useMemo(
    () =>
      computeTeamFacilityMatchModifiers(awayTeam, state, {
        isHome: false,
        attendancePct: attendance.pct
      }),
    [awayTeam, state, attendance.pct]
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

  const homeRate = useMemo(() => rate(homeTeam, state), [homeTeam, state]);
  const awayRate = useMemo(() => rate(awayTeam, state), [awayTeam, state]);

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
      .filter((q) => !used.has(q.n) && q.inj === 0 && (q.sus || 0) === 0)
      .sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov)
      .slice(0, 7);
  }, [homeTeam.sq, homeXi]);

  const awayBench = useMemo(() => {
    const used = new Set(awayXi.map((q) => q.n));
    return awayTeam.sq
      .filter((q) => !used.has(q.n) && q.inj === 0 && (q.sus || 0) === 0)
      .sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov)
      .slice(0, 7);
  }, [awayTeam.sq, awayXi]);

  const myTeam = meIsHome ? homeTeam : awayTeam;
  const oppTeam = meIsHome ? awayTeam : homeTeam;
  const myXi = meIsHome ? homeXi : awayXi;
  const myAvgFit = Math.round(myXi.reduce((sum, q) => sum + (q.fit ?? 100), 0) / Math.max(1, myXi.length));
  const tiredStarterCount = myXi.filter((q) => q.inj === 0 && (q.sus || 0) === 0 && Math.round(q.fit ?? 100) < 72).length;

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

  const playerCareerStatus = useMemo(() => {
    if (state.mode !== 'p' || !state.p) return null;
    const mySq = myTeam.sq.find((q) => q.me || q.n === state.p?.name);
    const sus = mySq?.sus ?? state.p.sus ?? 0;
    const inj = mySq?.inj ?? state.p.inj ?? 0;
    if (sus > 0) return { tone: 'neg' as const, text: `🟥 คุณติดโทษแบนนัดนี้ (พักอีก ${sus} นัด)` };
    if (inj > 0) return { tone: 'neg' as const, text: `🩹 คุณมีอาการบาดเจ็บ (พักอีก ${inj} นัด)` };
    if (myXi.some((q) => q.me || q.n === state.p?.name)) {
      return { tone: 'pos' as const, text: `⭐ คุณมีชื่อเป็น 11 ตัวจริงของ ${myTeam.name} ในนัดนี้` };
    }
    return { tone: 'warn' as const, text: `🪑 คุณเริ่มต้นที่ม้านั่งสำรอง รอโอกาสเปลี่ยนตัวลงสนาม` };
  }, [state.mode, state.p, myTeam, myXi]);

  const handleQuickSwap = (targetName: string) => {
    if (!isMgr) return;
    if ((viewMode === 'H' && !meIsHome) || (viewMode === 'A' && meIsHome)) return;
    if (!swapPickName) {
      SFX.tap();
      setSwapPickName(targetName);
      return;
    }
    if (swapPickName === targetName) {
      setSwapPickName(null);
      return;
    }
    const pA = myTeam.sq.find((q) => q.n === swapPickName);
    const pB = myTeam.sq.find((q) => q.n === targetName);
    if (!pA || !pB) {
      setSwapPickName(null);
      return;
    }
    const curNames = myXi.map((q) => q.n);
    const idxA = curNames.indexOf(pA.n);
    const idxB = curNames.indexOf(pB.n);
    if (idxA < 0 && idxB < 0) {
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
        if (Math.round(starter.fit ?? 100) >= 72) return;
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
    if (swapped.length > 0) {
      onToast(`🛌 พักตัวล้า ${swapped.length} ตำแหน่งเรียบร้อย`);
    } else {
      onToast('ยังไม่มีตัวสำรองที่ฟิตพอสลับในตำแหน่งที่ล้า');
    }
  };

  const renderFormDots = (fm?: string) => {
    const chars = (fm || '').slice(-5).split('');
    if (!chars.length) return <span className="text-[10px] text-[var(--mut)]">ยังไม่แข่ง</span>;
    return (
      <span className="inline-flex items-center gap-1">
        {chars.map((c, idx) => (
          <span
            key={idx}
            className={`w-4 h-4 mland:w-3.5 mland:h-3.5 rounded text-[9px] mland:text-[8px] font-black inline-flex items-center justify-center ${
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
        : { icon: <Sun className="w-4 h-4 text-amber-500" />, title: 'กลางวัน · แดดออก', sub: 'อากาศร้อน ใช้พลังงานสูงขึ้นเล็กน้อย' };

  const grassLenText = matchEnv.grassLength === 'short' ? 'ตัดสั้น (บอลไว)' : matchEnv.grassLength === 'long' ? 'หญ้ายาว (บอลหนืด)' : 'ปานกลาง (มาตรฐาน)';
  const dirtPct = Math.round((matchEnv.dirtMix || 0) * 100);
  const surfaceText = dirtPct <= 5 ? 'หญ้าแน่นสมบูรณ์' : dirtPct <= 25 ? `มีรอยสึกเล็กน้อย (${dirtPct}%)` : `พื้นสึก/ดินปน (${dirtPct}%)`;

  const renderPlayerRow = (pl: Player, slotLabel: SubRole, team: Team, isStarter: boolean, isCap: boolean) => {
    const no = getShirtNo(team, pl);
    const fit = Math.round(pl.fit ?? 100);
    const pen = isStarter ? playerPen(pl, slotLabel) : 0;
    const isPicked = swapPickName === pl.n;
    const isMePlayer = Boolean(pl.me || (state.mode === 'p' && state.p?.name === pl.n));

    return (
      <button
        key={`${isStarter ? 'xi' : 'bn'}-${pl.n}`}
        type="button"
        disabled={!canEditActiveTeam}
        onClick={() => canEditActiveTeam && handleQuickSwap(pl.n)}
        className={`w-full px-2 py-1 mland:py-0.5 rounded-lg border text-left flex items-center gap-1.5 text-[11px] mland:text-[9.5px] transition-colors ${
          isPicked
            ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]'
            : isMePlayer
              ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/60'
              : 'bg-[var(--surface-2)]/65 border-[var(--line)]/65 hover:border-[var(--g)]/55'
        } ${canEditActiveTeam ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="w-5 text-center font-black tabular text-[#9a6700] dark:text-[var(--lamp)] shrink-0">
          {no}
        </span>
        <span
          className={`w-8 text-center py-[1px] rounded text-[9.5px] mland:text-[8.5px] font-extrabold shrink-0 ${
            pen === 0
              ? 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)]'
              : pen === 1
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35'
                : 'bg-[var(--red-soft)] text-[var(--red)] border border-[var(--red)]/35'
          }`}
        >
          {slotLabel}
        </span>
        <span className="font-bold truncate flex-1 min-w-0 text-[var(--ink)]">
          {pl.n}
          {isCap && <span className="ml-1 text-[9.5px] text-[#b45309] dark:text-[var(--lamp)] font-black">(C)</span>}
          {isMePlayer && <span className="ml-1 text-[9.5px] text-[var(--g)] font-black">★</span>}
        </span>
        <span className="font-extrabold tabular shrink-0" style={{ color: ovColor(pl.ov) }}>
          {pl.ov}
        </span>
        <StaminaBar value={fit} variant="inline" barWidthClass="w-8 mland:w-6" />
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/82 flex items-center justify-center p-2 sm:p-3.5 mland:p-1.5 safe-all overflow-hidden">
      <div className="w-full max-w-6xl mland:max-w-[97vw] h-[calc(var(--app-dvh,1dvh)*94)] max-h-[calc(var(--app-dvh,1dvh)*94)] mland:h-[calc(var(--app-dvh,1dvh)*97)] mland:max-h-[calc(var(--app-dvh,1dvh)*97)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden">
        {/* TOP MATCHUP HEADER */}
        <div className="shrink-0 px-3.5 py-2.5 sm:px-5 sm:py-3 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)]">
          <div className="flex items-center justify-between gap-2 mb-2 mland:mb-1">
            <div className="flex items-center gap-2 min-w-0 text-[11px] mland:text-[9.5px]">
              <span className="font-extrabold text-[var(--g)] truncate">{compLabel}</span>
              <span className="text-[var(--mut)] hidden sm:inline">·</span>
              <span className="text-[var(--mut)] hidden sm:inline truncate">ฤดูกาลที่ {state.season}</span>
              {isDerby && (
                <>
                  <span className="text-[var(--mut)]">·</span>
                  <span className="font-extrabold text-[var(--red)] shrink-0">🔥 ดาร์บี้แมตช์</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              aria-label="ปิดหน้าก่อนแข่ง"
              className="btn-icon w-7 h-7 mland:w-6 mland:h-6"
            >
              <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 mland:gap-2">
            {/* Home Club */}
            <div className="flex items-center justify-end gap-2.5 mland:gap-2 min-w-0">
              <div className="text-right min-w-0">
                <div className={`font-extrabold text-sm sm:text-base mland:text-xs truncate font-display ${meIsHome ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                  {homeTeam.name}
                </div>
                <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] flex items-center justify-end gap-1.5 flex-wrap tabular">
                  {meIsHome && <span className="font-extrabold text-[var(--g)]">★ ทีมคุณ</span>}
                  <span>เหย้า</span>
                  <span>·</span>
                  <span>อันดับ #{ranks.get(homeTeam.id) ?? '-'}</span>
                  <span>·</span>
                  <span className="font-bold text-[var(--ink)]">XI {homeXiOv}</span>
                </div>
                <div className="mt-1 hidden sm:flex mland:hidden justify-end">{renderFormDots(homeTeam.fm)}</div>
              </div>
              <div className="shrink-0 p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                <ClubCrest name={homeTeam.name} size={40} team={homeTeam} club={state.club} isMyClub={meIsHome && isMgr} />
              </div>
            </div>

            {/* Center VS */}
            <div className="flex flex-col items-center justify-center px-2.5 sm:px-4 py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
              <span className="text-[10px] mland:text-[8px] font-bold text-[var(--mut)]">PRE-MATCH</span>
              <span className="text-base sm:text-lg mland:text-sm font-black font-display tracking-wider text-[var(--ink)] leading-tight">
                VS
              </span>
              <span className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular">
                แผน {homeTeam.cf ? 'กำหนดเอง' : homeTeam.form} · {awayTeam.cf ? 'กำหนดเอง' : awayTeam.form}
              </span>
            </div>

            {/* Away Club */}
            <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
              <div className="shrink-0 p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                <ClubCrest name={awayTeam.name} size={40} team={awayTeam} club={state.club} isMyClub={!meIsHome && isMgr} />
              </div>
              <div className="min-w-0">
                <div className={`font-extrabold text-sm sm:text-base mland:text-xs truncate font-display ${!meIsHome ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                  {awayTeam.name}
                </div>
                <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] flex items-center gap-1.5 flex-wrap tabular">
                  <span className="font-bold text-[var(--ink)]">XI {awayXiOv}</span>
                  <span>·</span>
                  <span>อันดับ #{ranks.get(awayTeam.id) ?? '-'}</span>
                  <span>·</span>
                  <span>เยือน</span>
                  {!meIsHome && <span className="font-extrabold text-[var(--g)]">★ ทีมคุณ</span>}
                </div>
                <div className="mt-1 hidden sm:flex mland:hidden">{renderFormDots(awayTeam.fm)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN 2-COLUMN BODY */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] mland:grid-cols-[1.42fr_1fr] overflow-y-auto lg:overflow-hidden mland:overflow-hidden">
          {/* LEFT COLUMN: LINEUPS & TACTICS */}
          <div className="flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r mland:border-b-0 mland:border-r border-[var(--line)] overflow-hidden">
            {/* Sub-header & Team View Toggle */}
            <div className="shrink-0 px-3 sm:px-4 mland:px-2.5 py-2 mland:py-1 bg-[var(--surface)] border-b border-[var(--line)]/80 flex flex-wrap items-center justify-between gap-2">
              <div className="seg-bar">
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setSwapPickName(null);
                    setViewMode('H');
                  }}
                  className={`seg-btn ${viewMode === 'H' ? 'seg-btn-active' : ''}`}
                >
                  🏠 {homeTeam.name}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setSwapPickName(null);
                    setViewMode('A');
                  }}
                  className={`seg-btn ${viewMode === 'A' ? 'seg-btn-active' : ''}`}
                >
                  ✈️ {awayTeam.name}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setSwapPickName(null);
                    setViewMode('compare');
                  }}
                  className={`seg-btn ${viewMode === 'compare' ? 'seg-btn-active' : ''}`}
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>เทียบ 2 ทีม</span>
                </button>
              </div>

              {isMgr && tiredStarterCount > 0 && viewMode !== 'compare' && (
                <button
                  type="button"
                  onClick={handleRestTiredStarters}
                  className="btn btn-xs btn-secondary border-[var(--lamp)]/60 text-[#8a5b00] dark:text-[var(--lamp)]"
                >
                  🛌 พักตัวล้า ({tiredStarterCount})
                </button>
              )}
            </div>

            {playerCareerStatus && (
              <div
                className={`shrink-0 px-3.5 py-1.5 mland:py-1 text-[11px] mland:text-[9.5px] font-bold border-b border-[var(--line)]/70 ${
                  playerCareerStatus.tone === 'pos'
                    ? 'bg-[var(--g-soft)] text-[var(--g)]'
                    : playerCareerStatus.tone === 'neg'
                      ? 'bg-[var(--red-soft)] text-[var(--red)]'
                      : 'bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)]'
                }`}
              >
                {playerCareerStatus.text}
              </div>
            )}

            {/* Content Area */}
            {viewMode === 'compare' ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 mland:p-2 grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2">
                {[
                  { side: 'H' as const, team: homeTeam, list: homeXi, slots: homeSlots, bench: homeBench, cap: homeCap, ov: homeXiOv },
                  { side: 'A' as const, team: awayTeam, list: awayXi, slots: awaySlots, bench: awayBench, cap: awayCap, ov: awayXiOv }
                ].map((col) => (
                  <div key={col.side} className="space-y-2 mland:space-y-1.5 min-w-0">
                    <div className="pb-1.5 border-b border-[var(--line)] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ClubCrest name={col.team.name} size={20} team={col.team} club={state.club} isMyClub={col.team.id === state.me && isMgr} />
                        <span className="font-extrabold text-xs mland:text-[10.5px] truncate">{col.team.name}</span>
                      </div>
                      <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-bold tabular shrink-0">
                        {col.team.cf ? 'กำหนดเอง' : col.team.form} · {AR_T[col.team.tac]} · XI {col.ov}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {col.list.map((pl, idx) =>
                        renderPlayerRow(pl, col.slots[idx]?.sp || pl.ro, col.team, true, pl.n === col.cap)
                      )}
                    </div>
                    {col.bench.length > 0 && (
                      <div className="pt-1.5 border-t border-[var(--line)]/60 space-y-1">
                        <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)]">
                          ตัวสำรอง ({col.bench.length})
                        </div>
                        <div className="space-y-1">
                          {col.bench.slice(0, 5).map((pl) =>
                            renderPlayerRow(pl, pl.ro, col.team, false, false)
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[0.95fr_1.05fr] mland:grid-cols-[0.9fr_1.1fr] overflow-y-auto sm:overflow-hidden mland:overflow-hidden">
                {/* Formation Pitch Visual */}
                <div className="p-2.5 sm:p-3 mland:p-1.5 bg-[#092818] flex flex-col items-center justify-center min-h-[260px] sm:min-h-0 relative overflow-hidden">
                  <div className="w-full flex items-center justify-between gap-2 text-[10.5px] mland:text-[8.5px] text-white/90 font-bold mb-1.5 mland:mb-1 px-1 shrink-0">
                    <span className="truncate">
                      แผน {activeTeam.cf ? 'กำหนดเอง' : activeTeam.form} · {AR_T[activeTeam.tac]}
                    </span>
                    <span className="tabular text-emerald-300 shrink-0">
                      รุก {Math.round(activeRate.at)} · รับ {Math.round(activeRate.df)} · XI {activeXiOv}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                    <FormationPitch
                      team={activeTeam}
                      state={state}
                      lineupNames={activeXi.map((q) => q.n)}
                      kitOverride={activeKit}
                      gkKitOverride={activeGkKit}
                      trimOverride={activeTrim}
                      showFitBar={true}
                      selectedPlayerName={swapPickName}
                      onPlayerClick={canEditActiveTeam ? (pl) => handleQuickSwap(pl.n) : undefined}
                      className="aspect-[300/380] h-full max-h-[340px] sm:max-h-full w-auto max-w-full mx-auto rounded-xl block select-none"
                    />
                  </div>
                  {canEditActiveTeam && (
                    <div className="mt-1 text-[10px] mland:text-[8px] text-emerald-100/75 text-center shrink-0">
                      {swapPickName
                        ? `กำลังเลือก ${swapPickName.split(' ')[0]} · แตะอีกคนเพื่อสลับตำแหน่ง`
                        : 'แตะนักเตะในสนามหรือสำรองเพื่อสลับตัวก่อนแข่งได้ทันที'}
                    </div>
                  )}
                </div>

                {/* Tactics Summary + Starting XI & Bench List */}
                <div className="flex flex-col min-h-0 overflow-y-auto p-2.5 sm:p-3 mland:p-2 space-y-2.5 mland:space-y-1.5">
                  {/* Tactics & Quick Adjustment */}
                  <div className="pb-2 mland:pb-1.5 border-b border-[var(--line)] space-y-1.5 mland:space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--ink)] flex items-center gap-1">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--g)]" />
                        <span>แผนการเล่น &amp; แท็กติก</span>
                      </span>
                      {canEditActiveTeam ? (
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
                  </div>

                  {/* Starting 11 List */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] mland:text-[9.5px] font-bold">
                      <span className="text-[var(--ink)]">11 ตัวจริง</span>
                      <span className="text-[var(--mut)] tabular">
                        ฟิตเฉลี่ย {activeTeam.id === state.me ? myAvgFit : Math.round(activeXi.reduce((s, q) => s + (q.fit ?? 100), 0) / Math.max(1, activeXi.length))}%
                      </span>
                    </div>
                    <div className="space-y-1">
                      {activeXi.map((pl, idx) =>
                        renderPlayerRow(pl, activeSlots[idx]?.sp || pl.ro, activeTeam, true, pl.n === activeCap)
                      )}
                    </div>
                  </div>

                  {/* Bench List */}
                  {activeBench.length > 0 && (
                    <div className="pt-2 border-t border-[var(--line)]/70 space-y-1">
                      <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">
                        ตัวสำรอง ({activeBench.length})
                      </div>
                      <div className="space-y-1">
                        {activeBench.map((pl) =>
                          renderPlayerRow(pl, pl.ro, activeTeam, false, false)
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: ASSISTANT COACH NOTES (MANAGER) + STADIUM, WEATHER & PITCH CONDITIONS */}
          <div className="flex flex-col min-h-0 overflow-y-auto p-3 sm:p-4 mland:p-2.5 space-y-3 mland:space-y-2 bg-[var(--surface)]">
            {isMgr && assistantReport && (
              <section
                aria-label="บันทึกโน้ตจากผู้ช่วยโค้ช"
                className="rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] p-2.5 sm:p-3 mland:p-2 space-y-2 mland:space-y-1.5"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--line)]/80">
                  <div className="min-w-0">
                    <div className="text-[11px] sm:text-xs mland:text-[10px] font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                      <span className="truncate">บันทึกโน้ตจากผู้ช่วยโค้ช</span>
                    </div>
                    <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular truncate">
                      {assistantReport.rankTitle} · {assistantReport.tierLabel} · {assistantReport.confidenceLabel}
                    </div>
                  </div>
                  {assistantReport.asstLv === 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] shrink-0">
                      <Lock className="w-3 h-3" />
                      <span>ยังไม่ปลดล็อก</span>
                    </span>
                  ) : null}
                </div>

                {/* Weaknesses & Key Observations */}
                <div className="divide-y divide-[var(--line)]/65">
                  {assistantReport.weaknesses.map((item, idx) => (
                    <div key={idx} className="py-1.5 first:pt-0 last:pb-0 space-y-0.5">
                      <div className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--ink)]">
                        {assistantReport.asstLv > 0 ? `${idx + 1}. ` : ''}{item.title}
                      </div>
                      <p className="text-[10.5px] mland:text-[9px] text-[var(--mut)] leading-snug">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Danger Threat & Specific Target (Lv.2+ / Lv.5+) */}
                {(assistantReport.dangerThreat || assistantReport.targetPlayerNote) && (
                  <div className="pt-1.5 border-t border-[var(--line)]/70 space-y-1.5 text-[10.5px] mland:text-[9px]">
                    {assistantReport.dangerThreat && (
                      <div className="rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/70 px-2.5 py-1.5 space-y-0.5">
                        <div className="font-extrabold text-[var(--red)]">{assistantReport.dangerThreat.title}</div>
                        <div className="text-[var(--mut)] leading-snug">{assistantReport.dangerThreat.detail}</div>
                      </div>
                    )}
                    {assistantReport.targetPlayerNote && (
                      <div className="rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]/70 px-2.5 py-1.5 space-y-0.5">
                        <div className="font-extrabold text-[var(--g)] tabular">
                          เป้าหมายเจาะจุดอ่อน: {assistantReport.targetPlayerNote.name} ({assistantReport.targetPlayerNote.role} · OV {assistantReport.targetPlayerNote.ov} · ฟิต {assistantReport.targetPlayerNote.fit}%)
                        </div>
                        <div className="text-[var(--mut)] leading-snug">
                          สาเหตุ: {assistantReport.targetPlayerNote.reason} — เน้นขึ้นเกมบุกเข้าพื้นที่รับผิดชอบของรายนี้
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tactical Recommendation + 1-Click Apply */}
                {assistantReport.recommendation && (
                  <div className="pt-2 border-t border-[var(--line)]/80 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--g)]">
                        คำแนะนำการจัดแผน
                      </span>
                      {assistantReport.canApplyTactics && (
                        <button
                          type="button"
                          onClick={handleApplyAssistantTactics}
                          disabled={isRecommendedApplied}
                          className={`btn btn-xs ${isRecommendedApplied ? 'btn-surface text-[var(--g)] border-[var(--g)]/50' : 'btn-primary'}`}
                        >
                          {isRecommendedApplied ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>ใช้อยู่แล้ว</span>
                            </>
                          ) : (
                            <span>ใช้แผนที่ผู้ช่วยแนะนำ</span>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] tabular">
                      {assistantReport.recommendation.summaryLine}
                    </div>
                    <p className="text-[10.5px] mland:text-[9px] text-[var(--mut)] leading-snug">
                      {assistantReport.recommendation.rationale}
                    </p>
                  </div>
                )}

                {/* Squad Fit / Pitch Condition Note */}
                {(assistantReport.squadFitNote || assistantReport.envNote) && (
                  <div className="pt-1.5 border-t border-[var(--line)]/65 space-y-1 text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug">
                    {assistantReport.squadFitNote && (
                      <div>
                        <b className="text-[var(--ink)]">ความพร้อมทีมเรา:</b> {assistantReport.squadFitNote}
                      </div>
                    )}
                    {assistantReport.envNote && (
                      <div>
                        <b className="text-[var(--ink)]">สภาพสนาม &amp; จังหวะเกม:</b> {assistantReport.envNote}
                      </div>
                    )}
                  </div>
                )}

                {/* Upgrade Hint */}
                {assistantReport.unlockHint && (
                  <div className="pt-1.5 border-t border-[var(--line)]/60 text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug">
                    💡 {assistantReport.unlockHint}
                  </div>
                )}
              </section>
            )}

            {/* Stadium & Attendance */}
            <div className={`space-y-2 mland:space-y-1 ${isMgr ? 'pt-2.5 mland:pt-2 border-t border-[var(--line)]' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--g)] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>ข้อมูลสนามแข่งขัน</span>
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base mland:text-xs text-[var(--ink)] font-display truncate">
                    {stadiumName}
                  </h3>
                </div>
                <span className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--ink)] tabular shrink-0">
                  ความจุ {attendance.cap.toLocaleString()}
                </span>
              </div>

              <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70 space-y-1.5 mland:space-y-1">
                <div className="flex items-center justify-between text-[11px] mland:text-[9.5px] tabular">
                  <span className="text-[var(--mut)] font-semibold inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[var(--g)]" />
                    <span>คาดการณ์ผู้ชมเข้าสนาม</span>
                  </span>
                  <span className="font-extrabold text-[var(--ink)]">
                    {attendance.att.toLocaleString()} คน <span className="text-[var(--g)]">({attendance.pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden border border-[var(--line)]/60">
                  <div
                    className="h-full rounded-full bg-[var(--g)]"
                    style={{ width: `${clamp(attendance.pct, 4, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular pt-0.5">
                  <span className="inline-flex items-center gap-1 truncate">
                    <Tv className="w-3 h-3 shrink-0" />
                    <span className="truncate">{broadcastChannel.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-[var(--ink)]">
                    ผู้ชมสด ~{fmtFansShort(streamProj.baseViewers)} · แฟนเหย้า {fmtFansShort(ensureTeamFans(homeTeam))}
                  </span>
                </div>
              </div>
            </div>

            {/* Weather & Pitch Turf */}
            <div className="pt-2.5 mland:pt-2 border-t border-[var(--line)] space-y-2 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2 p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 mland:w-7 mland:h-7 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center shrink-0">
                    {weatherBadge.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)] truncate">{weatherBadge.title}</div>
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">{weatherBadge.sub}</div>
                  </div>
                </div>
                <span className="text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] shrink-0 tabular">
                  {matchEnv.puddles.length > 0 ? `แอ่งน้ำ ${matchEnv.puddles.length} จุด` : 'ระบายน้ำดี'}
                </span>
              </div>

              {/* Turf Grade & Condition */}
              <div className="space-y-1.5 mland:space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">{turfMods.gradeName}</span>
                  <span
                    className={`text-xs mland:text-[10px] font-extrabold tabular ${
                      matchEnv.turfCond >= 80
                        ? 'text-[var(--g)]'
                        : matchEnv.turfCond >= 60
                          ? 'text-amber-600 dark:text-amber-300'
                          : 'text-[var(--red)]'
                    }`}
                  >
                    สภาพ {matchEnv.turfCond}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
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
                <p className="text-[11px] mland:text-[9px] text-[var(--mut)] leading-snug">
                  {turfSpec.desc} · ความยาวหญ้า: <b className="text-[var(--ink)]">{grassLenText}</b> · พื้นผิว: <b className="text-[var(--ink)]">{surfaceText}</b>
                </p>

                {/* 4-cell Turf Impact Summary */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {turfMods.effectsSummary.map((line, i) => (
                    <div
                      key={i}
                      className="px-2 py-1.5 mland:py-1 rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)]/60 text-[10.5px] mland:text-[9px] font-semibold text-[var(--ink)] tabular truncate"
                      title={line}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Facility Match Modifiers */}
            <div className="pt-2.5 mland:pt-2 border-t border-[var(--line)] space-y-1.5 mland:space-y-1">
              <div className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--ink)] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[var(--lamp)]" />
                <span>ความได้เปรียบสนาม &amp; สิ่งอำนวยความสะดวก</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mland:gap-1.5">
                {[
                  { title: `${homeTeam.name} (เหย้า)`, list: homeFacMods.breakdown },
                  { title: `${awayTeam.name} (เยือน)`, list: awayFacMods.breakdown }
                ].map((box) => (
                  <div
                    key={box.title}
                    className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)]/65 space-y-1"
                  >
                    <div className="text-[10.5px] mland:text-[9px] font-bold text-[var(--ink)] truncate">{box.title}</div>
                    <div className="space-y-0.5 text-[10px] mland:text-[8.5px]">
                      {box.list.slice(0, 4).map((b) => (
                        <div key={b.key} className="flex items-center justify-between gap-1">
                          <span className="text-[var(--mut)] truncate">{b.label}</span>
                          <span
                            className={`font-bold tabular shrink-0 ${
                              b.tone === 'pos'
                                ? 'text-[var(--g)]'
                                : b.tone === 'neg'
                                  ? 'text-[var(--red)]'
                                  : 'text-[var(--mut)]'
                            }`}
                          >
                            {b.deltaText}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* STICKY ACTION FOOTER */}
        <div className="shrink-0 px-3.5 py-2.5 sm:px-5 sm:py-3 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              className="btn btn-md mland:btn-sm btn-surface"
            >
              ย้อนกลับ
            </button>
            {isMgr && (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onOpenFullTactics();
                }}
                className="btn btn-md mland:btn-sm btn-secondary"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>จัดทัพเต็ม</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onQuickSim();
              }}
              className="btn btn-md mland:btn-sm btn-secondary"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>ข้ามเกม</span>
            </button>
            <button
              type="button"
              onClick={() => {
                SFX.whistle();
                onKickOff(matchEnv);
              }}
              className="btn btn-lg mland:btn-md btn-gold px-5 mland:px-4 font-extrabold"
            >
              <Play className="w-4 h-4 mland:w-3.5 mland:h-3.5 fill-current" />
              <span>ลงสนามแข่งขัน</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
