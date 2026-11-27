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
  Sparkles,
  Tv,
  X
} from 'lucide-react';
import type { GameState, MatchHighlightClip, Team } from '../types/game';
import { ClubCrest } from '../components/SvgVisuals';
import { getHighlightKindBadge } from '../engine/matchHighlights';
import { drawHighlightClipToCanvas, type HighlightCameraMode } from './MatchPitchCanvas';
import { SFX } from '../utils/audioTheme';

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
    const topDrama = orderedClips.slice().sort((a, b) => b.dramaScore - a.dramaScore)[0];
    return topDrama?.id || orderedClips[0]?.id || '';
  });

  const activeIdx = Math.max(
    0,
    orderedClips.findIndex((c) => c.id === activeId)
  );
  const activeClip = orderedClips[activeIdx] || orderedClips[0];

  const [pct, setPct] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [slowMoFocus, setSlowMoFocus] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<HighlightCameraMode>('broadcast');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPct(0);
    setPlaying(true);
  }, [activeClip?.id]);

  // Smooth RAF playback with automatic Slow-Mo around peakT
  useEffect(() => {
    if (!playing || !activeClip) return;
    let rafId = 0;
    let lastTs = performance.now();
    const baseDurationSec = 4.8;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      setPct((prev) => {
        const nearClimax = slowMoFocus && Math.abs(prev - activeClip.peakT) <= 0.12;
        const slowMul = nearClimax ? 0.42 : 1;
        const next = prev + (dt * speed * slowMul) / baseDurationSec;
        if (next >= 1) {
          if (autoAdvance && orderedClips.length > 1 && activeIdx < orderedClips.length - 1) {
            const nextClip = orderedClips[activeIdx + 1];
            window.setTimeout(() => {
              setActiveId(nextClip.id);
              setPct(0);
              setPlaying(true);
            }, 350);
          } else {
            setPlaying(false);
          }
          return 1;
        }
        return next;
      });
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [playing, speed, slowMoFocus, autoAdvance, activeClip, activeIdx, orderedClips]);

  const isCurrentlySlowMo = Boolean(
    activeClip && slowMoFocus && playing && Math.abs(pct - activeClip.peakT) <= 0.12
  );

  // Canvas draw & resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeClip) return;
    const render = () => {
      drawHighlightClipToCanvas(canvas, activeClip, pct, {
        homeTeamName: homeOrig.name,
        awayTeamName: awayOrig.name,
        homeKit,
        awayKit,
        homeGkKit,
        awayGkKit,
        homeTrim,
        awayTrim,
        cameraMode,
        isSlowMo: isCurrentlySlowMo,
        showNames: true
      });
    };
    render();
    const target = stageRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => render());
    ro.observe(target);
    return () => ro.disconnect();
  }, [
    activeClip,
    pct,
    homeOrig.name,
    awayOrig.name,
    homeKit,
    awayKit,
    homeGkKit,
    awayGkKit,
    homeTrim,
    awayTrim,
    cameraMode,
    isCurrentlySlowMo
  ]);

  if (!activeClip) return null;

  const badgeMeta = getHighlightKindBadge(activeClip.kind);

  const handleTogglePlay = () => {
    SFX.tap();
    if (pct >= 0.995) {
      setPct(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  const handleSelectClip = (clipId: string) => {
    SFX.tap();
    setActiveId(clipId);
    setPct(0);
    setPlaying(true);
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
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="ไฮไลท์การแข่งขัน"
    >
      <div
        className="w-full max-w-6xl mland:max-w-[98vw] h-[calc(var(--app-dvh,1dvh)*94)] max-h-[calc(var(--app-dvh,1dvh)*94)] mland:h-[calc(var(--app-dvh,1dvh)*97)] mland:max-h-[calc(var(--app-dvh,1dvh)*97)] rounded-2xl mland:rounded-xl bg-[#07111e] border border-amber-400/45 text-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Broadcast Studio Header */}
        <div className="shrink-0 px-2.5 py-1.5 sm:px-3.5 mland:px-2.5 mland:py-1 bg-[#0b192c] border-b border-white/12 flex items-center justify-between gap-2 whitespace-nowrap overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/55 text-amber-300 text-[10.5px] mland:text-[9px] font-black tracking-wide shrink-0">
              <Film className="w-3 h-3" />
              <span>ไฮไลท์การแข่งขัน</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] mland:text-[8.5px] font-bold text-emerald-300/90 bg-emerald-500/15 border border-emerald-400/35 px-1.5 py-0.5 rounded shrink-0">
              <Sparkles className="w-2.5 h-2.5" />
              <span>ตัดต่อโดยทีมงานมืออาชีพ</span>
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
              {pct < 0.08 && (
                <div className="pointer-events-none absolute top-11 left-4 right-4 sm:left-auto sm:max-w-sm px-3 py-2 rounded-xl bg-slate-950/90 border border-amber-400/55 shadow-xl backdrop-blur-xs">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-300">
                    <span>{badgeMeta.icon}</span>
                    <span>ช็อตที่ {activeIdx + 1} · นาที {activeClip.minute}&apos;</span>
                  </div>
                  <div className="text-xs font-extrabold text-white truncate mt-0.5">{activeClip.title}</div>
                  <div className="text-[10px] text-emerald-300/90 font-semibold truncate">{activeClip.crewTag}</div>
                </div>
              )}
            </div>

            {/* Scrubber & Commentary Bar */}
            <div className="shrink-0 px-3 py-1.5 mland:px-2 mland:py-1 bg-[#081322] border-t border-white/10 space-y-1">
              {/* Timeline progress bar with Climax Diamond */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] mland:text-[8.5px] font-extrabold tabular text-amber-300 w-9 shrink-0">
                  น.{activeClip.minute}&apos;
                </span>
                <div
                  className="relative flex-1 h-4 flex items-center cursor-pointer group"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
                    setPct(ratio);
                  }}
                >
                  <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 transition-[width] duration-75"
                      style={{ width: `${Math.round(pct * 100)}%` }}
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
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-amber-400 shadow-md pointer-events-none"
                    style={{ left: `${Math.round(pct * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] mland:text-[8.5px] font-bold tabular text-white/65 w-10 text-right shrink-0">
                  {Math.round(pct * 100)}%
                </span>
              </div>

              {/* Commentary strip */}
              <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                <span className="text-white/90 font-semibold truncate">{activeClip.commentary}</span>
                {(activeClip.shotDistM || activeClip.shotSpeedKmh) && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded bg-white/8 text-[10px] font-bold tabular text-amber-200">
                    {activeClip.shotDistM ? <span>📏 {activeClip.shotDistM} ม.</span> : null}
                    {activeClip.shotSpeedKmh ? <span>⚡ {activeClip.shotSpeedKmh} กม./ชม.</span> : null}
                  </span>
                )}
              </div>
            </div>

            {/* Playback & Camera Controls */}
            <div className="shrink-0 px-2.5 py-1.5 sm:px-3 mland:px-2 mland:py-1 bg-[#0b192c] border-t border-white/12 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="h-7 mland:h-6 px-2.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] mland:text-[9.5px] inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                {pct >= 0.995 ? (
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
                <span>🎞️ คลิปที่ทีมงานคัดสรร</span>
              </span>
              <span className="text-[10px] mland:text-[8.5px] font-bold tabular text-amber-300 shrink-0">
                {orderedClips.length} ช็อต
              </span>
            </div>

            <div className="flex lg:flex-col mland:flex-col gap-1.5 p-2 mland:p-1.5 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto mland:overflow-x-hidden mland:overflow-y-auto flex-1 min-h-0">
              {orderedClips.map((clip, idx) => {
                const isActive = clip.id === activeClip.id;
                const b = getHighlightKindBadge(clip.kind);
                const team = clip.side === 'H' ? homeOrig : awayOrig;
                return (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => handleSelectClip(clip.id)}
                    className={`shrink-0 w-[225px] lg:w-full mland:w-full text-left p-2 mland:p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      isActive
                        ? 'bg-amber-400/15 border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 text-[10px] mland:text-[8.5px]">
                      <span className={`px-1.5 py-[1px] rounded border font-extrabold inline-flex items-center gap-1 ${b.toneClass}`}>
                        <span>{b.icon}</span>
                        <span>น.{clip.minute}&apos;</span>
                      </span>
                      <span className="font-bold tabular text-white/70 truncate">
                        {clip.kind.startsWith('goal_') ? `${clip.scoreBefore} → ${clip.scoreAfter}` : `สกอร์ ${clip.scoreAfter}`}
                      </span>
                    </div>

                    <div className="text-[11px] mland:text-[9.5px] font-extrabold text-white leading-snug line-clamp-2">
                      {idx + 1}. {clip.title}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[9.5px] mland:text-[8px] text-white/65">
                      <span className="inline-flex items-center gap-1 truncate">
                        <ClubCrest name={team.name} size={11} team={team} club={state.club} isMyClub={team.id === state.me && state.mode === 'm'} />
                        <span className="truncate">{clip.actorName.split(' ')[0]}</span>
                      </span>
                      {clip.crewTag.startsWith('⭐') && (
                        <span className="text-amber-300 font-extrabold shrink-0">⭐ อันดับ 1</span>
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
