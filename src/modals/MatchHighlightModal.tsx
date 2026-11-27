import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Film,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Tv,
  X
} from 'lucide-react';
import type { GameState, MatchHighlightClip, SubRole, Team } from '../types/game';
import { ClubCrest } from '../components/SvgVisuals';
import { PositionBadge } from '../components/PositionBadge';
import { MatchPlayerThumb } from './MatchSharedComponents';
import { getShirtNo } from '../engine/playerCore';
import { getHighlightKindBadge, HL_ACT } from '../engine/matchHighlights';
import {
  drawHighlightClipToCanvas,
  resolveHighlightGoalImpactT,
  type HighlightCameraMode
} from './MatchPitchCanvas';
import { isCrowdAudioActive, setCrowdAudio, SFX, unlockAudio } from '../utils/audioTheme';

interface MatchHighlightModalProps {
  clips: MatchHighlightClip[];
  initialClipId?: string;
  homeOrig: Team;
  awayOrig: Team;
  state: GameState;
  homeKit: string;
  awayKit: string;
  homeGkKit: string;
  awayGkKit: string;
  homeTrim: string;
  awayTrim: string;
  compTitle?: string;
  scoreSummary?: string;
  onClose: () => void;
}

export const MatchHighlightModal: React.FC<MatchHighlightModalProps> = ({
  clips,
  initialClipId,
  homeOrig,
  awayOrig,
  state,
  homeKit,
  awayKit,
  homeGkKit,
  awayGkKit,
  homeTrim,
  awayTrim,
  compTitle,
  scoreSummary,
  onClose
}) => {
  const orderedClips = useMemo(
    () => (clips || []).slice().sort((a, b) => a.minute - b.minute || a.seq - b.seq),
    [clips]
  );

  const [activeId, setActiveId] = useState<string>(() => {
    if (initialClipId && orderedClips.some((c) => c.id === initialClipId)) return initialClipId;
    return orderedClips[0]?.id || '';
  });

  const activeIdx = Math.max(
    0,
    orderedClips.findIndex((c) => c.id === activeId)
  );
  const activeClip = orderedClips[activeIdx] || orderedClips[0];

  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [slowMoFocus, setSlowMoFocus] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<HighlightCameraMode>('broadcast');
  const [isEnded, setIsEnded] = useState<boolean>(false);
  const [showStartSlate, setShowStartSlate] = useState<boolean>(true);

  const pctRef = useRef<number>(0);
  const slowMoRef = useRef<boolean>(false);
  const showSlateRef = useRef<boolean>(true);
  const endedRef = useRef<boolean>(false);
  const scrubbingRef = useRef<boolean>(false);
  const pendingNextTimerRef = useRef<number | null>(null);
  const firedCueIdxRef = useRef<Set<number>>(new Set());
  const prevCrowdActiveRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fillBarRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const pctLabelRef = useRef<HTMLSpanElement | null>(null);

  const syncDomAndState = useRef<(nextPct: number, slowNow: boolean) => void>(() => {});
  syncDomAndState.current = (nextPct: number, slowNow: boolean) => {
    const p = Math.min(1, Math.max(0, nextPct));
    pctRef.current = p;

    if (fillBarRef.current) {
      fillBarRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
    }
    if (thumbRef.current) {
      thumbRef.current.style.left = `${(p * 100).toFixed(2)}%`;
    }
    if (pctLabelRef.current) {
      pctLabelRef.current.textContent = `${Math.round(p * 100)}%`;
    }

    const canvas = canvasRef.current;
    if (canvas && activeClip) {
      drawHighlightClipToCanvas(canvas, activeClip, p, {
        homeTeamName: homeOrig.name,
        awayTeamName: awayOrig.name,
        homeKit,
        awayKit,
        homeGkKit,
        awayGkKit,
        homeTrim,
        awayTrim,
        cameraMode,
        isSlowMo: slowNow,
        showNames: true
      });
    }

    const slateNow = p < 0.08;
    if (slateNow !== showSlateRef.current) {
      showSlateRef.current = slateNow;
      setShowStartSlate(slateNow);
    }
    const endNow = p >= 0.995;
    if (endNow !== endedRef.current) {
      endedRef.current = endNow;
      setIsEnded(endNow);
    }
  };

  const audioCues = useMemo(() => {
    if (!activeClip) return [] as { t: number; play: () => void }[];
    const cues: { t: number; play: () => void }[] = [];
    const frames = activeClip.frames || [];
    const clamp01 = (v: number) => Math.min(0.98, Math.max(0.01, v));

    const meActor = activeClip.actors.find((a) => a.me);
    const userSide: 'H' | 'A' | null =
      meActor?.s ??
      (homeOrig.id === state.me ? 'H' : awayOrig.id === state.me ? 'A' : null);
    const isPositiveClip = userSide ? activeClip.side === userSide : true;
    const isGoalClip = activeClip.kind.startsWith('goal_');
    const isNetShot =
      isGoalClip ||
      (activeClip.kind === 'shootout_kick' && activeClip.shootoutScored !== false);
    const impactT = clamp01(isNetShot ? resolveHighlightGoalImpactT(activeClip) : activeClip.peakT);
    const firstShotFrame = frames.find((f) => f.shot === 1);
    const firstShotT = firstShotFrame ? clamp01(firstShotFrame.t) : null;
    const shotCueT = firstShotT ?? clamp01(Math.min(impactT - 0.03, Math.max(0.04, impactT - 0.12)));

    // 1. Pre-shot buildup cues (passes, long kicks, headers, tackles, slips, whiffs) from sampled frames
    const buildupCutoff = Math.max(0.04, shotCueT - 0.025);
    let lastBuildupSfxT = -1;
    let prevSlideActive = false;
    let prevTackleActive = false;
    let prevSlipActive = false;
    let prevWhiffActive = false;

    for (let i = 1; i < frames.length; i++) {
      const f0 = frames[i - 1];
      const f1 = frames[i];
      if (f1.t >= buildupCutoff) break;
      if (f1.t - lastBuildupSfxT < 0.055) continue;

      const hasSlide = f1.p.some((row) => row[4] === HL_ACT.SLIDE);
      const hasTackle = f1.p.some((row) => row[4] === HL_ACT.TACKLE || row[4] === HL_ACT.CLASH);
      const hasSlip = f1.p.some((row) => row[4] === HL_ACT.SLIP);
      const hasWhiff = f1.p.some((row) => row[4] === HL_ACT.WHIFF);

      if (hasSlide && !prevSlideActive) {
        cues.push({ t: f1.t, play: () => SFX.tackle(true) });
        lastBuildupSfxT = f1.t;
      } else if (hasTackle && !prevTackleActive) {
        cues.push({ t: f1.t, play: () => SFX.tackle(false) });
        lastBuildupSfxT = f1.t;
      } else if (hasSlip && !prevSlipActive) {
        cues.push({ t: f1.t, play: () => SFX.slip() });
        lastBuildupSfxT = f1.t;
      } else if (hasWhiff && !prevWhiffActive) {
        cues.push({ t: f1.t, play: () => SFX.whiff() });
        lastBuildupSfxT = f1.t;
      } else if (f0.car !== undefined && f1.car === undefined && !f1.shot) {
        const passerRow = f0.p.find((row) => row[0] === f0.car);
        const passerAct = passerRow?.[4] || 0;
        const nextMaxZ = Math.max(f1.bz, frames[i + 1]?.bz ?? 0, frames[i + 2]?.bz ?? 0);
        if (passerAct === HL_ACT.HEADER || passerAct === HL_ACT.DIVING_HEADER) {
          cues.push({ t: f1.t, play: () => SFX.header() });
        } else if (nextMaxZ > 3.2) {
          cues.push({ t: f1.t, play: () => SFX.kick() });
        } else {
          cues.push({ t: f1.t, play: () => SFX.pass() });
        }
        lastBuildupSfxT = f1.t;
      }

      prevSlideActive = hasSlide;
      prevTackleActive = hasTackle;
      prevSlipActive = hasSlip;
      prevWhiffActive = hasWhiff;
    }

    // 2. Set-piece / Shot / Climax / Post-climax real-match SFX
    if (
      activeClip.kind === 'goal_freekick' ||
      activeClip.kind === 'goal_penalty' ||
      activeClip.kind === 'penalty_miss' ||
      activeClip.kind === 'shootout_kick'
    ) {
      cues.push({ t: clamp01(Math.max(0.02, shotCueT - 0.14)), play: () => SFX.foul() });
    }

    const hasHeaderShot =
      activeClip.kind === 'goal_header' ||
      frames.some(
        (f) =>
          Math.abs(f.t - shotCueT) <= 0.08 &&
          f.p.some((row) => row[4] === HL_ACT.HEADER || row[4] === HL_ACT.DIVING_HEADER)
      );

    if (
      isGoalClip ||
      activeClip.kind === 'super_save' ||
      activeClip.kind === 'woodwork' ||
      activeClip.kind === 'penalty_miss' ||
      activeClip.kind === 'shootout_kick' ||
      (activeClip.kind === 'var_overturn' && (!activeClip.varVerdict || activeClip.varVerdict === 'no_goal'))
    ) {
      cues.push({
        t: shotCueT,
        play: () => {
          if (hasHeaderShot) {
            SFX.header();
            SFX.cheer(0.38);
          } else {
            SFX.shot();
          }
        }
      });
    }

    if (activeClip.kind === 'goal_woodwork_in') {
      cues.push({
        t: clamp01(Math.max(shotCueT + 0.03, Math.min(impactT - 0.03, (shotCueT + impactT) * 0.54))),
        play: () => SFX.woodwork()
      });
    } else if (activeClip.kind === 'goal_deflect') {
      cues.push({
        t: clamp01(Math.max(shotCueT + 0.03, Math.min(impactT - 0.03, (shotCueT + impactT) * 0.5))),
        play: () => SFX.block()
      });
    }

    if (isGoalClip) {
      cues.push({
        t: impactT,
        play: () => SFX.goal(activeClip.kind === 'goal_og' ? false : isPositiveClip)
      });
      if (activeClip.kind !== 'goal_og' && isPositiveClip && impactT + 0.15 < 0.96) {
        cues.push({
          t: clamp01(impactT + 0.15),
          play: () => SFX.cheer(0.88)
        });
      }
    } else if (activeClip.kind === 'super_save') {
      cues.push({ t: impactT, play: () => SFX.save(1.05) });
    } else if (activeClip.kind === 'woodwork') {
      cues.push({ t: impactT, play: () => SFX.woodwork() });
    } else if (activeClip.kind === 'penalty_miss') {
      cues.push({ t: impactT, play: () => SFX.boo(0.75) });
    } else if (activeClip.kind === 'red_card') {
      cues.push({
        t: clamp01(Math.max(0.04, impactT - 0.14)),
        play: () => SFX.tackle(true)
      });
      cues.push({
        t: impactT,
        play: () => {
          SFX.card();
          SFX.boo(0.9);
        }
      });
    } else if (activeClip.kind === 'injury') {
      cues.push({
        t: clamp01(Math.max(0.04, impactT - 0.12)),
        play: () => SFX.tackle(true)
      });
      cues.push({
        t: impactT,
        play: () => {
          SFX.foul();
          SFX.boo(0.62);
        }
      });
    } else if (activeClip.kind === 'var_overturn') {
      cues.push({
        t: clamp01(Math.max(0.06, impactT - 0.18)),
        play: () => SFX.var()
      });
      cues.push({
        t: impactT,
        play: () => {
          SFX.foul();
          if (activeClip.varVerdict === 'pen') SFX.cheer(0.72);
          else SFX.boo(0.82);
        }
      });
    } else if (activeClip.kind === 'shootout_kick') {
      cues.push({
        t: impactT,
        play: () => {
          if (activeClip.shootoutScored !== false) {
            SFX.goal(isPositiveClip);
          } else if (activeClip.shootoutOutcome === 'save') {
            SFX.save(1.05);
          } else if (activeClip.shootoutOutcome === 'woodwork') {
            SFX.woodwork();
          } else {
            SFX.boo(0.78);
          }
        }
      });
    }

    return cues.sort((a, b) => a.t - b.t);
  }, [activeClip, state.me, homeOrig.id, awayOrig.id]);

  // Ambient stadium crowd audio synced with highlight playback (restores previous state on close)
  useEffect(() => {
    prevCrowdActiveRef.current = isCrowdAudioActive();
    unlockAudio();
    return () => {
      setCrowdAudio(prevCrowdActiveRef.current);
    };
  }, []);

  useEffect(() => {
    if (playing) {
      unlockAudio();
      setCrowdAudio(true);
    } else {
      setCrowdAudio(false);
    }
  }, [playing]);

  useEffect(() => {
    if (pendingNextTimerRef.current !== null) {
      window.clearTimeout(pendingNextTimerRef.current);
      pendingNextTimerRef.current = null;
    }
    pctRef.current = 0;
    slowMoRef.current = false;
    showSlateRef.current = true;
    endedRef.current = false;
    firedCueIdxRef.current.clear();
    setShowStartSlate(true);
    setIsEnded(false);
    setPlaying(true);
    syncDomAndState.current(0, false);
  }, [activeClip?.id]);

  // Redraw immediately when static visual options change & observe stage resize ONCE (never recreated per frame!)
  useEffect(() => {
    if (!activeClip) return;
    const isSlow = Boolean(slowMoFocus && playing && Math.abs(pctRef.current - activeClip.peakT) <= 0.12);
    slowMoRef.current = isSlow;
    syncDomAndState.current(pctRef.current, isSlow);

    const target = stageRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      syncDomAndState.current(pctRef.current, slowMoRef.current);
    });
    ro.observe(target);
    return () => ro.disconnect();
  }, [
    activeClip,
    homeOrig.name,
    awayOrig.name,
    homeKit,
    awayKit,
    homeGkKit,
    awayGkKit,
    homeTrim,
    awayTrim,
    cameraMode,
    playing,
    slowMoFocus
  ]);

  // Smooth zero-React-rerender 60fps RAF playback with automatic Slow-Mo around peakT
  useEffect(() => {
    if (!playing || !activeClip) return;
    let rafId = 0;
    let lastTs = performance.now();
    const baseDurationSec = 4.8;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const prev = pctRef.current;
      const nearClimax = slowMoFocus && Math.abs(prev - activeClip.peakT) <= 0.12;
      slowMoRef.current = nearClimax;
      const slowMul = nearClimax ? 0.42 : 1;
      const next = Math.min(1, prev + (dt * speed * slowMul) / baseDurationSec);

      syncDomAndState.current(next, nearClimax);

      for (let ci = 0; ci < audioCues.length; ci++) {
        if (firedCueIdxRef.current.has(ci)) continue;
        const cue = audioCues[ci];
        if ((prev === 0 && cue.t <= next) || (cue.t > prev && cue.t <= next)) {
          firedCueIdxRef.current.add(ci);
          cue.play();
        }
      }

      if (next >= 1) {
        if (autoAdvance && orderedClips.length > 1 && activeIdx < orderedClips.length - 1) {
          const nextClip = orderedClips[activeIdx + 1];
          pendingNextTimerRef.current = window.setTimeout(() => {
            pendingNextTimerRef.current = null;
            setActiveId(nextClip.id);
          }, 350);
        } else {
          setPlaying(false);
        }
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      if (pendingNextTimerRef.current !== null) {
        window.clearTimeout(pendingNextTimerRef.current);
        pendingNextTimerRef.current = null;
      }
    };
  }, [playing, speed, slowMoFocus, autoAdvance, activeClip, activeIdx, orderedClips, audioCues]);

  if (!activeClip) return null;

  const badgeMeta = getHighlightKindBadge(activeClip.kind);

  const renderClipActor = (clip: MatchHighlightClip) => {
    const actorTeam =
      clip.kind === 'goal_og'
        ? (clip.side === 'H' ? awayOrig : homeOrig)
        : (clip.side === 'H' ? homeOrig : awayOrig);
    const pl = actorTeam.sq.find((q) => q.n === clip.actorName) || null;
    const clipActor = clip.actors.find((a) => a.id === clip.actorName);
    const no = pl ? getShirtNo(actorTeam, pl) : clipActor?.no ?? null;
    const role = (pl?.ro || clipActor?.ro || null) as SubRole | null;
    const isHomeActor = actorTeam.id === homeOrig.id;
    const isGk = pl ? pl.pos === 'GK' : Boolean(clipActor?.gk);
    const kitColor = isGk ? (isHomeActor ? homeGkKit : awayGkKit) : (isHomeActor ? homeKit : awayKit);
    const trimColor = isGk ? undefined : (isHomeActor ? homeTrim : awayTrim);
    return (
      <span className="inline-flex items-center gap-1 min-w-0">
        <span className="shrink-0 inline-flex">
          <ClubCrest
            name={actorTeam.name}
            size={13}
            team={actorTeam}
            club={state.club}
            isMyClub={actorTeam.id === state.me && state.mode === 'm'}
          />
        </span>
        {pl && (
          <MatchPlayerThumb
            player={pl}
            team={actorTeam}
            state={state}
            kitColor={kitColor}
            trimColor={trimColor}
            size="xs"
            dark
          />
        )}
        {role && <PositionBadge role={role} size="2xs" />}
        {no != null && (
          <span className="text-[9.5px] mland:text-[8px] font-extrabold tabular text-[#fde047] shrink-0">
            #{no}
          </span>
        )}
        <span className="font-bold text-white truncate">{clip.actorName}</span>
      </span>
    );
  };

  const seekToRatio = (ratio: number) => {
    const r = Math.min(1, Math.max(0, ratio));
    firedCueIdxRef.current.clear();
    audioCues.forEach((cue, idx) => {
      if (cue.t < r) firedCueIdxRef.current.add(idx);
    });
    const isSlow = Boolean(slowMoFocus && playing && Math.abs(r - activeClip.peakT) <= 0.12);
    slowMoRef.current = isSlow;
    syncDomAndState.current(r, isSlow);
  };

  const handleTogglePlay = () => {
    unlockAudio();
    SFX.tap();
    if (pctRef.current >= 0.995) {
      pctRef.current = 0;
      endedRef.current = false;
      firedCueIdxRef.current.clear();
      setIsEnded(false);
      syncDomAndState.current(0, false);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  const handleSelectClip = (clipId: string) => {
    unlockAudio();
    SFX.tap();
    if (clipId === activeClip.id) {
      pctRef.current = 0;
      endedRef.current = false;
      firedCueIdxRef.current.clear();
      setIsEnded(false);
      syncDomAndState.current(0, false);
      setPlaying(true);
      return;
    }
    setActiveId(clipId);
  };

  const handlePrev = () => {
    if (orderedClips.length <= 1) return;
    const prevIdx = (activeIdx - 1 + orderedClips.length) % orderedClips.length;
    handleSelectClip(orderedClips[prevIdx].id);
  };

  const handleNext = () => {
    if (orderedClips.length <= 1) return;
    const nextIdx = (activeIdx + 1) % orderedClips.length;
    handleSelectClip(orderedClips[nextIdx].id);
  };

  const cycleSpeed = () => {
    SFX.tap();
    setSpeed((prev) => (prev === 0.5 ? 1 : prev === 1 ? 1.5 : prev === 1.5 ? 2 : 0.5));
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/88 flex items-center justify-center p-1.5 sm:p-3 mland:p-1 safe-all overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="ไฮไลท์การแข่งขัน"
    >
      <div className="w-full max-w-6xl mland:max-w-[98vw] h-[calc(var(--app-dvh,1dvh)*94)] max-h-[calc(var(--app-dvh,1dvh)*94)] mland:h-[calc(var(--app-dvh,1dvh)*97)] mland:max-h-[calc(var(--app-dvh,1dvh)*97)] rounded-2xl mland:rounded-xl bg-[#07111e] border border-amber-400/45 text-white shadow-2xl flex flex-col overflow-hidden">
        {/* Top Broadcast Studio Header */}
        <div className="shrink-0 px-2.5 py-1.5 sm:px-3.5 mland:px-2.5 mland:py-1 bg-[#0b192c] border-b border-white/12 flex items-center justify-between gap-2 whitespace-nowrap overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/55 text-amber-300 text-[10.5px] mland:text-[9px] font-black tracking-wide shrink-0">
              <Film className="w-3 h-3" />
              <span>ไฮไลท์การแข่งขัน</span>
            </span>
            <div className="flex items-center gap-1.5 min-w-0 text-xs mland:text-[10px] font-bold text-white/90 truncate">
              <ClubCrest name={homeOrig.name} size={15} team={homeOrig} club={state.club} isMyClub={homeOrig.id === state.me && state.mode === 'm'} />
              <span className="truncate hidden md:inline">{homeOrig.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] mland:text-[9px] font-extrabold tabular shrink-0">
                {scoreSummary || activeClip.scoreAfter}
              </span>
              <span className="truncate hidden md:inline">{awayOrig.name}</span>
              <ClubCrest name={awayOrig.name} size={15} team={awayOrig} club={state.club} isMyClub={awayOrig.id === state.me && state.mode === 'm'} />
              {compTitle && (
                <span className="hidden lg:inline text-[10px] text-white/55 truncate">· {compTitle}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded bg-white/8 border border-white/12 text-[10px] mland:text-[9px] font-extrabold tabular text-amber-200">
              ช็อตที่ {activeIdx + 1}/{orderedClips.length}
            </span>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              aria-label="ปิดหน้าต่างไฮไลท์"
              className="w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white/85 flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Broadcast Stage + Curated Playlist */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_280px] mland:grid mland:grid-cols-[minmax(0,1fr)_215px] overflow-hidden">
          {/* Left/Center Monitor Column */}
          <div className="flex-1 min-h-0 flex flex-col bg-[#050c16] overflow-hidden">
            {/* Pitch Canvas */}
            <div ref={stageRef} className="relative flex-1 min-h-0 p-1.5 sm:p-2 mland:p-1 flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                onClick={handleTogglePlay}
                className="w-full h-full rounded-xl mland:rounded-lg block cursor-pointer select-none shadow-2xl border border-white/10"
                aria-label="จอฉายไฮไลท์การแข่งขัน"
              />

              {/* Brief Director Title Slate on Clip Start */}
              {showStartSlate && (
                <div className="pointer-events-none absolute top-11 left-4 right-4 sm:left-auto sm:max-w-sm px-3 py-2 rounded-xl bg-slate-950/90 border border-amber-400/55 shadow-xl space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-300">
                    <span>{badgeMeta.icon}</span>
                    <span>
                      ช็อตที่ {activeIdx + 1} ·{' '}
                      {activeClip.kind === 'shootout_kick'
                        ? `ดวลจุดโทษ${activeClip.shootoutRound ? ` รอบ ${activeClip.shootoutRound}` : ''}`
                        : `นาที ${activeClip.minute}'`}
                    </span>
                  </div>
                  <div className="text-xs font-extrabold text-white truncate">{activeClip.title}</div>
                  <div className="text-[10px] text-white/90 flex items-center gap-1.5 min-w-0">
                    {renderClipActor(activeClip)}
                  </div>
                </div>
              )}
            </div>

            {/* Scrubber Bar */}
            <div className="shrink-0 px-3 py-1.5 mland:px-2 mland:py-1 bg-[#081322] border-t border-white/10">
              {/* Timeline progress bar with Climax Diamond */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] mland:text-[8.5px] font-extrabold tabular text-amber-300 w-9 shrink-0">
                  {activeClip.kind === 'shootout_kick' ? 'PEN' : `น.${activeClip.minute}'`}
                </span>
                <div
                  className="relative flex-1 h-4 flex items-center cursor-pointer group touch-none select-none"
                  onPointerDown={(e) => {
                    scrubbingRef.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const rect = e.currentTarget.getBoundingClientRect();
                    seekToRatio((e.clientX - rect.left) / Math.max(1, rect.width));
                  }}
                  onPointerMove={(e) => {
                    if (!scrubbingRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    seekToRatio((e.clientX - rect.left) / Math.max(1, rect.width));
                  }}
                  onPointerUp={() => {
                    scrubbingRef.current = false;
                  }}
                  onPointerCancel={() => {
                    scrubbingRef.current = false;
                  }}
                >
                  <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      ref={fillBarRef}
                      className="w-full h-full origin-left bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 will-change-transform"
                      style={{ transform: 'scaleX(0)' }}
                    />
                  </div>
                  {/* Climax peakT marker */}
                  <span
                    title="จังหวะชี้ขาด (Climax)"
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-amber-300 border border-slate-950 shadow-sm pointer-events-none"
                    style={{ left: `${Math.round(activeClip.peakT * 100)}%` }}
                  />
                  {/* Scrubber thumb */}
                  <span
                    ref={thumbRef}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-amber-400 shadow-md pointer-events-none"
                    style={{ left: '0%' }}
                  />
                </div>
                <span
                  ref={pctLabelRef}
                  className="text-[10px] mland:text-[8.5px] font-bold tabular text-white/65 w-10 text-right shrink-0"
                >
                  0%
                </span>
              </div>
            </div>

            {/* Playback & Camera Controls */}
            <div className="shrink-0 px-2.5 py-1.5 sm:px-3 mland:px-2 mland:py-1 bg-[#0b192c] border-t border-white/12 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="h-7 mland:h-6 px-2.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] mland:text-[9.5px] inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                {isEnded ? (
                  <>
                    <RotateCcw className="w-3 h-3" />
                    <span>ดูซ้ำ</span>
                  </>
                ) : playing ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>หยุด</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>เล่น</span>
                  </>
                )}
              </button>

              {orderedClips.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="h-7 mland:h-6 px-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10.5px] mland:text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                    title="ไฮไลท์ก่อนหน้า"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">ก่อนหน้า</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="h-7 mland:h-6 px-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10.5px] mland:text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                    title="ไฮไลท์ถัดไป"
                  >
                    <span className="hidden sm:inline">ถัดไป</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={cycleSpeed}
                className="h-7 mland:h-6 px-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10.5px] mland:text-[9px] font-extrabold tabular inline-flex items-center gap-1 cursor-pointer shrink-0"
                title="ความเร็วในการเล่น"
              >
                <Gauge className="w-3 h-3 text-amber-300" />
                <span>{speed}x</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setSlowMoFocus((v) => !v);
                }}
                className={`h-7 mland:h-6 px-2 rounded-md border text-[10.5px] mland:text-[9px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                  slowMoFocus
                    ? 'bg-amber-400/20 border-amber-400/60 text-amber-200'
                    : 'bg-white/6 border-white/15 text-white/70 hover:text-white'
                }`}
                title="สโลว์โมชันอัตโนมัติในจังหวะชี้ขาด"
              >
                <span>⏱️ สโลว์ช็อตเด็ด</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setCameraMode((m) => (m === 'broadcast' ? 'wide' : 'broadcast'));
                }}
                className="h-7 mland:h-6 px-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10.5px] mland:text-[9px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                title="สลับมุมกล้องถ่ายทอดสด"
              >
                <Camera className="w-3 h-3 text-sky-300" />
                <span>{cameraMode === 'broadcast' ? 'มุมกล้อง: ตามบอล' : 'มุมกล้อง: กว้าง'}</span>
              </button>

              {orderedClips.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setAutoAdvance((v) => !v);
                  }}
                  className={`ml-auto h-7 mland:h-6 px-2 rounded-md border text-[10px] mland:text-[8.5px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                    autoAdvance
                      ? 'bg-emerald-500/20 border-emerald-400/55 text-emerald-200'
                      : 'bg-white/6 border-white/15 text-white/65 hover:text-white'
                  }`}
                >
                  <Tv className="w-3 h-3" />
                  <span>เล่นต่อเนื่อง</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Curated Playlist (Horizontal strip on portrait mobile, sidebar on lg/mland) */}
          <div className="shrink-0 lg:shrink lg:h-full mland:h-full bg-[#091525] border-t lg:border-t-0 lg:border-l mland:border-t-0 mland:border-l border-white/12 flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-2.5 py-1.5 mland:px-2 mland:py-1 border-b border-white/10 flex items-center justify-between gap-2 bg-[#0d1d33]">
              <span className="text-[11px] mland:text-[9.5px] font-extrabold text-white/95 inline-flex items-center gap-1.5 truncate">
                <span>🎞️ ช็อตสำคัญในเกม</span>
              </span>
              <span className="text-[10px] mland:text-[8.5px] font-bold tabular text-amber-300 shrink-0">
                {orderedClips.length} ช็อต
              </span>
            </div>

            <div className="flex lg:flex-col mland:flex-col gap-1.5 p-2 mland:p-1.5 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto mland:overflow-x-hidden mland:overflow-y-auto flex-1 min-h-0">
              {orderedClips.map((clip, idx) => {
                const isActive = clip.id === activeClip.id;
                const b = getHighlightKindBadge(clip.kind);
                return (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => handleSelectClip(clip.id)}
                    className={`shrink-0 w-[235px] lg:w-full mland:w-full text-left p-2 mland:p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      isActive
                        ? 'bg-amber-400/15 border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 text-[10px] mland:text-[8.5px]">
                      <span className={`px-1.5 py-[1px] rounded border font-extrabold inline-flex items-center gap-1 ${b.toneClass}`}>
                        <span>{b.icon}</span>
                        <span>
                          {clip.kind === 'shootout_kick'
                            ? `ดวลเป้า${clip.shootoutRound ? ` R${clip.shootoutRound}` : ''}`
                            : `น.${clip.minute}'`}
                        </span>
                      </span>
                      <span className="font-bold tabular text-white/70 truncate">
                        {clip.kind.startsWith('goal_')
                          ? `${clip.scoreBefore} → ${clip.scoreAfter}`
                          : clip.kind === 'shootout_kick'
                            ? clip.shootoutScoreText
                              ? `จุดโทษ ${clip.shootoutScoreText}`
                              : `รอบ ${clip.shootoutRound || 1}`
                            : `สกอร์ ${clip.scoreAfter}`}
                      </span>
                    </div>

                    <div className="text-[11px] mland:text-[9.5px] font-extrabold text-white leading-snug line-clamp-2">
                      {idx + 1}. {clip.title}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px] mland:text-[8.5px] text-white/85 min-w-0">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        {renderClipActor(clip)}
                      </div>
                      {clip.crewTag.startsWith('⭐') && (
                        <span className="text-amber-300 font-extrabold text-[9px] mland:text-[7.5px] shrink-0">⭐ #1</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
