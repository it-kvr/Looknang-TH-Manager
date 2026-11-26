import React, { useEffect, useRef, useState } from 'react';
import { FastForward, Pause, Play, RotateCcw, SkipBack, SkipForward, Tv, X } from 'lucide-react';
import type { GameState, Team, VarReplayRecord } from '../types/game';
import { ClubCrest } from '../components/SvgVisuals';
import { drawVarReplayToCanvas } from './MatchPitchCanvas';
import { SFX } from '../utils/audioTheme';

export type { VarReplayRecord };

interface VarReplayModalProps {
  records: VarReplayRecord[];
  activeRecord: VarReplayRecord;
  liveMode?: boolean;
  onSelectRecord?: (id: string) => void;
  onSkipLiveVar?: () => void;
  onClose: () => void;
  homeOrig: Team;
  awayOrig: Team;
  state: GameState;
  homeKit: string;
  awayKit: string;
  homeGkKit: string;
  awayGkKit: string;
  homeTrim: string;
  awayTrim: string;
}

const VERDICT_BADGE_CLS: Record<VarReplayRecord['verdictTone'], string> = {
  goal: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300',
  no_goal: 'bg-rose-500/20 border-rose-400/60 text-rose-300',
  penalty: 'bg-rose-500/20 border-rose-400/60 text-rose-300',
  freekick: 'bg-sky-500/20 border-sky-400/60 text-sky-300',
  red: 'bg-rose-500/20 border-rose-400/60 text-rose-300',
  yellow: 'bg-amber-400/20 border-amber-300/60 text-amber-200'
};

export const VarReplayModal: React.FC<VarReplayModalProps> = ({
  records,
  activeRecord,
  liveMode = false,
  onSelectRecord,
  onSkipLiveVar,
  onClose,
  homeOrig,
  awayOrig,
  state,
  homeKit,
  awayKit,
  homeGkKit,
  awayGkKit,
  homeTrim,
  awayTrim
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [pct, setPct] = useState<number>(() => (liveMode ? 0.15 : 0));
  const [playing, setPlaying] = useState<boolean>(true);
  const [replaySpeed, setReplaySpeed] = useState<0.5 | 1 | 1.5>(1);

  // Reset playback from start when switching between saved VAR incidents
  useEffect(() => {
    setPct(liveMode ? 0.15 : 0);
    setPlaying(true);
  }, [activeRecord.id, liveMode]);

  // Smooth RAF playback from 0 -> 1
  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    let lastTs = performance.now();
    const baseDurationSec = 5.4;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      setPct((prev) => {
        const next = prev + (dt * replaySpeed) / baseDurationSec;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [playing, replaySpeed, activeRecord.id]);

  // Render canvas whenever pct, record, or container dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = () => {
      drawVarReplayToCanvas(
        canvas,
        activeRecord.varState,
        pct,
        homeKit,
        awayKit,
        homeGkKit,
        awayGkKit,
        homeTrim,
        awayTrim
      );
    };
    render();
    const target = stageRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => render());
    ro.observe(target);
    return () => ro.disconnect();
  }, [activeRecord, pct, homeKit, awayKit, homeGkKit, awayGkKit, homeTrim, awayTrim]);

  const phaseLabel =
    pct >= 0.72
      ? 'คำตัดสินสุดท้าย VAR'
      : pct >= 0.36
        ? 'หยุดภาพตรวจจุดชี้ขาด'
        : 'สโลว์โมชันจังหวะปะทะ';

  const kindLabel =
    activeRecord.kind === 'goal'
      ? 'ตรวจสอบประตู / ล้ำหน้า'
      : activeRecord.kind === 'penalty'
        ? 'ตรวจสอบจุดโทษ & เส้นเขต'
        : 'ตรวจสอบฟาวล์รุนแรง / ใบแดง';

  const activeIdx = records.findIndex((r) => r.id === activeRecord.id);

  const handleTogglePlay = () => {
    SFX.tap();
    if (pct >= 0.995) {
      setPct(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  const handleJump = (targetPct: number) => {
    SFX.tap();
    setPlaying(false);
    setPct(targetPct);
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-2 sm:p-4 mland:p-1.5 safe-all overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mland:max-w-3xl max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-2xl bg-[#07111e] border border-sky-400/45 text-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Broadcast Header */}
        <div className="shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 mland:px-3 mland:py-1.5 bg-[#0b192c] border-b border-white/12 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/50 text-sky-300 text-[10.5px] mland:text-[9.5px] font-black tracking-wide shrink-0">
              <Tv className="w-3.5 h-3.5 mland:w-3 mland:h-3" />
              <span>VAR REPLAY</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10.5px] mland:text-[9.5px] font-extrabold tabular shrink-0">
              น.{activeRecord.minute}&apos;
            </span>
            <span className="text-xs sm:text-sm mland:text-[11px] font-bold text-white/95 truncate">
              {kindLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(!liveMode || pct >= 0.72) ? (
              <span
                className={`px-2 py-0.5 rounded-md border text-[10.5px] mland:text-[9.5px] font-extrabold whitespace-nowrap ${VERDICT_BADGE_CLS[activeRecord.verdictTone]}`}
              >
                {activeRecord.verdictShort}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md border border-sky-400/40 bg-sky-500/15 text-sky-200 text-[10.5px] mland:text-[9.5px] font-bold whitespace-nowrap animate-pulse">
                กำลังตรวจภาพช้า...
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              aria-label="ปิดหน้าต่าง VAR"
              className="w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white/85 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Match & Incident Summary Strip */}
        <div className="shrink-0 px-3 py-1.5 sm:px-4 mland:px-3 mland:py-1 bg-[#091524] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[9.5px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 font-bold text-white/90 truncate">
              <ClubCrest name={homeOrig.name} size={15} team={homeOrig} club={state.club} isMyClub={homeOrig.id === state.me && state.mode === 'm'} />
              <span className="truncate max-w-[115px] sm:max-w-[160px]">{homeOrig.name}</span>
            </span>
            <span className="text-white/40 font-bold">vs</span>
            <span className="inline-flex items-center gap-1 font-bold text-white/90 truncate">
              <ClubCrest name={awayOrig.name} size={15} team={awayOrig} club={state.club} isMyClub={awayOrig.id === state.me && state.mode === 'm'} />
              <span className="truncate max-w-[115px] sm:max-w-[160px]">{awayOrig.name}</span>
            </span>
          </div>
          <span className="text-sky-200/90 font-semibold truncate max-w-full">
            {activeRecord.varState.reasonText}
          </span>
        </div>

        {/* Zoomed VAR Monitor Canvas */}
        <div className="flex-1 min-h-0 p-2.5 sm:p-3.5 mland:p-2 flex flex-col items-center justify-center bg-[#050c16]">
          <div
            ref={stageRef}
            className="w-full aspect-[16/9] max-h-[50dvh] mland:max-h-[48dvh] rounded-xl overflow-hidden shadow-2xl"
          >
            <canvas
              ref={canvasRef}
              onClick={handleTogglePlay}
              className="w-full h-full block cursor-pointer select-none"
              aria-label="จอภาพช้า VAR มุมซูม"
            />
          </div>
        </div>

        {/* Scrub Bar + Playback Controls */}
        <div className="shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 mland:px-3 mland:py-1.5 bg-[#0b192c] border-t border-white/12 space-y-2 mland:space-y-1">
          {/* Timeline Scrubber */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] mland:text-[9px] font-bold">
              <span className="text-sky-300">{phaseLabel}</span>
              <span className="tabular text-white/75">{Math.round(pct * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(pct * 1000)}
              onChange={(e) => {
                setPlaying(false);
                setPct(Number(e.target.value) / 1000);
              }}
              aria-label="เลื่อนช่วงเวลาภาพช้า VAR"
              className="w-full h-2 rounded-full accent-sky-400 cursor-pointer bg-white/15"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="h-8 mland:h-7 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs mland:text-[10.5px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {pct >= 0.995 ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ดูซ้ำ</span>
                  </>
                ) : playing ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>หยุดภาพ</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>เล่นต่อ</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleJump(0)}
                className="h-8 mland:h-7 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] mland:text-[9.5px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="ย้อนไปจุดเริ่มต้น"
              >
                <SkipBack className="w-3 h-3" />
                <span>เริ่ม</span>
              </button>

              <button
                type="button"
                onClick={() => handleJump(0.55)}
                className="h-8 mland:h-7 px-2 rounded-lg bg-amber-400/18 border border-amber-300/40 hover:bg-amber-400/28 text-amber-200 text-[11px] mland:text-[9.5px] font-bold cursor-pointer transition-colors"
                title="หยุดที่จุดตีเส้น / จุดปะทะ"
              >
                🎯 จุดชี้ขาด
              </button>

              <button
                type="button"
                onClick={() => handleJump(1)}
                className="h-8 mland:h-7 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] mland:text-[9.5px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="ข้ามไปดูผลตัดสิน"
              >
                <SkipForward className="w-3 h-3" />
                <span>ผลตัดสิน</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="inline-flex items-center p-0.5 rounded-lg bg-white/8 border border-white/12">
                {([0.5, 1, 1.5] as const).map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setReplaySpeed(sp);
                    }}
                    className={`h-6 px-2 rounded-md text-[10.5px] mland:text-[9px] font-extrabold tabular cursor-pointer transition-colors ${
                      replaySpeed === sp
                        ? 'bg-sky-400 text-slate-950'
                        : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>

              {liveMode && onSkipLiveVar && (
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onSkipLiveVar();
                  }}
                  className="h-8 mland:h-7 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] mland:text-[9.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>ประกาศผลเลย</span>
                </button>
              )}
            </div>
          </div>

          {/* Multi-incident Selector Strip */}
          {!liveMode && records.length > 1 && onSelectRecord && (
            <div className="pt-1.5 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-[10px] mland:text-[9px] font-bold text-white/60 shrink-0">
                VAR ในเกม ({activeIdx + 1}/{records.length}):
              </span>
              {records.map((rec) => {
                const isCur = rec.id === activeRecord.id;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      onSelectRecord(rec.id);
                    }}
                    className={`shrink-0 px-2 py-1 rounded-lg border text-[10.5px] mland:text-[9px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                      isCur
                        ? 'bg-sky-500/25 border-sky-400 text-white'
                        : 'bg-white/6 border-white/12 text-white/75 hover:bg-white/12'
                    }`}
                  >
                    <span className="tabular font-extrabold text-sky-300">{rec.minute}&apos;</span>
                    <span>{rec.verdictShort}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
