import React, { useEffect, useRef, useState } from 'react';
import { FastForward, Pause, Play, RotateCcw, SkipBack, SkipForward, Tv, X } from 'lucide-react';
import type { GameState, Team, VarReplayRecord } from '../types/game';
import { ClubCrest } from '../components/SvgVisuals';
import { drawVarReplayToCanvas, type VarCameraMode } from './MatchPitchCanvas';
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
  const [replaySpeed, setReplaySpeed] = useState<0.25 | 0.5 | 1 | 1.5>(1);
  const [cameraMode, setCameraMode] = useState<VarCameraMode>('wide');
  const [followBall, setFollowBall] = useState<boolean>(false);

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
        awayTrim,
        cameraMode,
        followBall
      );
    };
    render();
    const target = stageRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => render());
    ro.observe(target);
    return () => ro.disconnect();
  }, [activeRecord, pct, homeKit, awayKit, homeGkKit, awayGkKit, homeTrim, awayTrim, cameraMode, followBall]);

  const phaseLabel =
    pct >= 0.64
      ? 'คำตัดสินสุดท้าย VAR'
      : pct >= 0.36
        ? 'หยุดภาพตรวจจุดชี้ขาด (Freeze)'
        : 'สโลว์โมชันจังหวะปะทะ';

  const sc = activeRecord.varState.replay?.scenario;
  const kindLabel =
    activeRecord.kind === 'goal'
      ? sc === 'goal_line_tech'
        ? 'โกล์ไลน์ · เช็กบอลข้ามเส้น'
        : sc === 'foul_buildup'
          ? 'ตรวจสอบฟาวล์จังหวะก่อนยิง'
          : 'ตรวจสอบประตู / เส้นล้ำหน้า'
      : activeRecord.kind === 'penalty'
        ? sc === 'handball_box'
          ? 'ตรวจสอบแฮนด์บอลในเขตโทษ'
          : sc === 'gk_clash_box'
            ? 'ตรวจสอบผู้รักษาประตูปะทะในกรอบ'
            : 'ตรวจสอบจุดโทษ & เส้นเขต'
        : sc === 'dogso'
          ? 'ตรวจสอบตัดเกมหลุดเดี่ยว (DOGSO)'
          : sc === 'reckless_duel'
            ? 'ตรวจสอบปะทะรุนแรง / นอกเกม'
            : 'ตรวจสอบฟาวล์รุนแรง / ใบแดง';

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
      className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-1.5 sm:p-3 mland:p-1 safe-all overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl mland:max-w-[97vw] h-[calc(var(--app-dvh,1dvh)*94)] max-h-[calc(var(--app-dvh,1dvh)*94)] mland:h-[calc(var(--app-dvh,1dvh)*97)] mland:max-h-[calc(var(--app-dvh,1dvh)*97)] rounded-2xl mland:rounded-xl bg-[#07111e] border border-sky-400/45 text-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Single-Row Top Broadcast Header */}
        <div className="shrink-0 px-2.5 py-1.5 sm:px-3.5 mland:px-2.5 mland:py-1 bg-[#0b192c] border-b border-white/12 flex items-center justify-between gap-2 whitespace-nowrap overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-sky-300 text-[10px] mland:text-[9px] font-black tracking-wide shrink-0">
              <Tv className="w-3 h-3" />
              <span>VAR</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] mland:text-[9px] font-extrabold tabular shrink-0">
              น.{activeRecord.minute}&apos;
            </span>
            <span className="hidden sm:inline-flex mland:inline-flex items-center gap-1 shrink-0" title={`${homeOrig.name} vs ${awayOrig.name}`}>
              <ClubCrest name={homeOrig.name} size={14} team={homeOrig} club={state.club} isMyClub={homeOrig.id === state.me && state.mode === 'm'} />
              <span className="text-[9.5px] text-white/40 font-bold">v</span>
              <ClubCrest name={awayOrig.name} size={14} team={awayOrig} club={state.club} isMyClub={awayOrig.id === state.me && state.mode === 'm'} />
            </span>
            <span
              className="text-xs sm:text-[13px] mland:text-[10.5px] font-bold text-white/95 min-w-0 truncate"
              title={`${kindLabel} · ${activeRecord.varState.reasonText}`}
            >
              {activeRecord.varState.reasonText || kindLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!liveMode && records.length > 1 && onSelectRecord && (
              <div className="hidden md:inline-flex items-center gap-1 p-0.5 rounded-lg bg-white/6 border border-white/10 max-w-[240px] overflow-x-auto no-scrollbar">
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
                      title={`${rec.minute}' · ${rec.verdictShort}`}
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-extrabold tabular cursor-pointer transition-colors ${
                        isCur
                          ? 'bg-sky-400 text-slate-950'
                          : 'text-white/75 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {rec.minute}&apos;
                    </button>
                  );
                })}
              </div>
            )}

            {(!liveMode || pct >= 0.72) ? (
              <span
                title={activeRecord.verdictLabel}
                className={`px-2 py-0.5 rounded-md border text-[10px] mland:text-[9px] font-extrabold whitespace-nowrap ${VERDICT_BADGE_CLS[activeRecord.verdictTone]}`}
              >
                {activeRecord.verdictShort}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md border border-sky-400/40 bg-sky-500/15 text-sky-200 text-[10px] mland:text-[9px] font-bold whitespace-nowrap">
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
              className="w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white/85 flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>
          </div>
        </div>

        {/* Full-Height Zoomed VAR Monitor Canvas */}
        <div className="flex-1 min-h-0 p-1 sm:p-1.5 mland:p-1 flex flex-col bg-[#050c16]">
          <div
            ref={stageRef}
            className="w-full h-full min-h-0 rounded-xl mland:rounded-lg overflow-hidden shadow-2xl"
          >
            <canvas
              ref={canvasRef}
              onClick={handleTogglePlay}
              className="w-full h-full block cursor-pointer select-none"
              aria-label="จอภาพช้า VAR"
            />
          </div>
        </div>

        {/* Single-Row Playback & Camera Controls */}
        <div className="shrink-0 px-2.5 py-1.5 sm:px-3 mland:px-2 mland:py-1 bg-[#0b192c] border-t border-white/12 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar whitespace-nowrap">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="h-7 mland:h-6 px-2.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-[11px] mland:text-[9.5px] inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
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

          <button
            type="button"
            onClick={() => handleJump(0)}
            className="h-7 mland:h-6 px-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10.5px] mland:text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer transition-colors shrink-0"
            title="ย้อนไปจุดเริ่มต้น"
          >
            <SkipBack className="w-3 h-3" />
            <span className="hidden sm:inline">เริ่ม</span>
          </button>

          <button
            type="button"
            onClick={() => handleJump(0.5)}
            className="h-7 mland:h-6 px-2 rounded-md bg-amber-400/18 border border-amber-300/40 hover:bg-amber-400/28 text-amber-200 text-[10.5px] mland:text-[9px] font-bold cursor-pointer transition-colors shrink-0"
            title="หยุดที่จุดตีเส้น / จุดปะทะ"
          >
            🎯 ชี้ขาด
          </button>

          <button
            type="button"
            onClick={() => handleJump(1)}
            className="h-7 mland:h-6 px-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10.5px] mland:text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer transition-colors shrink-0"
            title="ข้ามไปดูผลตัดสิน"
          >
            <SkipForward className="w-3 h-3" />
            <span className="hidden sm:inline">ตัดสิน</span>
          </button>

          <div className="flex-1 min-w-[96px] flex items-center gap-1.5 px-1">
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
              title={phaseLabel}
              className="flex-1 min-w-[60px] h-1.5 rounded-full accent-sky-400 cursor-pointer bg-white/15"
            />
            <span className="text-[10px] mland:text-[8.5px] font-extrabold text-sky-300 tabular shrink-0 w-8 text-right">
              {Math.round(pct * 100)}%
            </span>
          </div>

          <div className="inline-flex items-center p-0.5 rounded-md bg-white/8 border border-white/12 shrink-0">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setCameraMode('full');
                setFollowBall(false);
              }}
              title="มุมกว้างทั้งสนาม"
              className={`h-6 mland:h-5 px-1.5 rounded text-[10px] mland:text-[8.5px] font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                cameraMode === 'full'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              🏟️ ทั้งสนาม
            </button>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setCameraMode('wide');
              }}
              title="กล้องระยะไกล"
              className={`h-6 mland:h-5 px-1.5 rounded text-[10px] mland:text-[8.5px] font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                cameraMode === 'wide'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              🔭 ไกล
            </button>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setCameraMode('zoom');
              }}
              title="กล้องระยะใกล้"
              className={`h-6 mland:h-5 px-1.5 rounded text-[10px] mland:text-[8.5px] font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                cameraMode === 'zoom'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              🔍 ใกล้
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              SFX.tap();
              setFollowBall((prev) => {
                const next = !prev;
                if (next && cameraMode === 'full') {
                  setCameraMode('wide');
                }
                return next;
              });
            }}
            title="ให้กล้องติดตามลูกบอลอัตโนมัติ"
            className={`h-7 mland:h-6 px-2 rounded-md border text-[10px] mland:text-[8.5px] font-extrabold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              followBall && cameraMode !== 'full'
                ? 'bg-emerald-400 border-emerald-300 text-slate-950'
                : 'bg-white/8 border-white/15 text-white/80 hover:text-white hover:bg-white/14'
            }`}
          >
            ⚽ ตามบอล
          </button>

          <div className="inline-flex items-center p-0.5 rounded-md bg-white/8 border border-white/12 shrink-0">
            {([0.25, 0.5, 1, 1.5] as const).map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => {
                  SFX.tap();
                  setReplaySpeed(sp);
                }}
                className={`h-6 mland:h-5 px-1.5 rounded text-[10px] mland:text-[8.5px] font-extrabold tabular cursor-pointer transition-colors ${
                  replaySpeed === sp
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>

          {!liveMode && records.length > 1 && onSelectRecord && (
            <div className="md:hidden inline-flex items-center gap-1 shrink-0">
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
                    className={`h-6 px-1.5 rounded border text-[9.5px] font-extrabold tabular cursor-pointer transition-colors ${
                      isCur
                        ? 'bg-sky-400 border-sky-400 text-slate-950'
                        : 'bg-white/6 border-white/12 text-white/75'
                    }`}
                  >
                    {rec.minute}&apos;
                  </button>
                );
              })}
            </div>
          )}

          {liveMode && onSkipLiveVar && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onSkipLiveVar();
              }}
              className="h-7 mland:h-6 px-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10.5px] mland:text-[9px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <FastForward className="w-3 h-3" />
              <span>ประกาศผล</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
