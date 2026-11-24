import React, { useEffect } from 'react';
import type { GameState } from '../types/game';
import { TN } from '../data/thaiFootballData';
import { SFX, triggerConfetti } from '../utils/audioTheme';
import { finishSeasonComputation } from '../engine/simulation';
import { ClubCrest } from '../components/SvgVisuals';

export type SeasonSummaryData = ReturnType<typeof finishSeasonComputation>;

export const SeasonEndModal: React.FC<{
  state: GameState;
  summary: SeasonSummaryData;
  onOpenSeasonStats?: () => void;
  onStartNextSeason: (transferToTeamId?: number) => void;
}> = ({ state, summary, onOpenSeasonStats, onStartNextSeason }) => {
  const me = state.teams[state.me];
  useEffect(() => {
    if (summary.ch || summary.nt > summary.mt) {
      SFX.win();
      triggerConfetti();
    } else {
      SFX.whistle();
    }
  }, [summary]);

  const arc = summary.archive;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-3xl mland:max-w-[94vw] max-h-[92dvh] mland:h-[96dvh] mland:max-h-[96dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 p-4 sm:p-5 mland:p-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] text-center space-y-2 mland:space-y-0.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 mland:py-0.5 rounded-full bg-[var(--lamp-soft)] text-xs mland:text-[9.5px] font-bold text-[#7a4f00] dark:text-[var(--lamp)]">
            🏁 สรุปจบฤดูกาลที่ {state.season}
          </div>
          <div className="flex items-center justify-center gap-3 mland:gap-2">
            <div className="shrink-0 mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <ClubCrest name={me.name} size={42} team={me} club={state.club} isMyClub={state.mode === 'm'} />
            </div>
            <div className="text-left min-w-0">
              <h3 className="font-bold text-lg sm:text-xl mland:text-xs font-display truncate">{me.name}</h3>
              <p className="text-xs mland:text-[9.5px] text-[var(--mut)]">{TN[summary.mt]} · จบอันดับ {summary.pos}/{summary.totalTeams} ({me.pts} แต้ม)</p>
            </div>
          </div>
          <div className="text-base sm:text-lg mland:text-[11px] font-bold text-[var(--g)] pt-0.5 mland:pt-0">{summary.stText}</div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-2 grid grid-cols-2 gap-3 mland:gap-1.5 items-start">
          <div className="grid grid-cols-2 gap-2 mland:gap-1.5 text-xs mland:text-[10px]">
            <div className="p-3 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
              <div className="text-[var(--mut)] mland:text-[9px]">ผลงานถ้วยประชาชน</div>
              <b className="text-sm mland:text-[11px]">{summary.cupStatus}</b>
            </div>
            <div className="p-3 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
              <div className="text-[var(--mut)] mland:text-[9px]">ดิวิชั่นฤดูกาลหน้า</div>
              <b className="text-sm mland:text-[11px]">{TN[summary.nt]}</b>
            </div>
          </div>

          {(summary.bestScorer || summary.bestAssist) && (
            <div className="p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] space-y-1 text-xs mland:text-[10px]">
              <div className="font-bold">🏅 รางวัลประจำฤดูกาล ({TN[summary.mt]})</div>
              {summary.bestScorer && <div>⚽ ดาวซัลโว: <b>{summary.bestScorer}</b></div>}
              {summary.bestAssist && <div>🎯 จอมแอสซิสต์: <b>{summary.bestAssist}</b></div>}
            </div>
          )}

          {arc && (arc.topScorer || arc.topAssist || arc.topRating) && (
            <div className="p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--g-soft)]/35 border border-[var(--g)]/35 space-y-1 text-xs mland:text-[10px] col-span-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">⭐ ผู้นำสถิติประจำทีม ({me.name})</span>
                <span className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular">
                  ชนะ {arc.won} · เสมอ {arc.drawn} · แพ้ {arc.lost} ({arc.gf}-{arc.ga})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-1.5">
                <div className="px-2.5 py-1.5 mland:py-1 rounded-xl bg-[var(--surface)]/80 border border-[var(--line)]/60 truncate">
                  ⚽ ประตู: <b>{arc.topScorer ? `${arc.topScorer.name} (${arc.topScorer.sg})` : '-'}</b>
                </div>
                <div className="px-2.5 py-1.5 mland:py-1 rounded-xl bg-[var(--surface)]/80 border border-[var(--line)]/60 truncate">
                  🎯 จ่าย: <b>{arc.topAssist ? `${arc.topAssist.name} (${arc.topAssist.sa})` : '-'}</b>
                </div>
                <div className="px-2.5 py-1.5 mland:py-1 rounded-xl bg-[var(--surface)]/80 border border-[var(--line)]/60 truncate">
                  ⭐ เรตติ้งเฉลี่ย: <b>{arc.topRating ? `${arc.topRating.name} (${arc.topRating.avgRating.toFixed(2)})` : '-'}</b>
                </div>
              </div>
            </div>
          )}

          {state.mode === 'm' && (
            <div className="p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] text-xs mland:text-[10px] space-y-1 col-span-2">
              <div className="font-bold">📋 ประเมินจากบอร์ดบริหาร</div>
              <div>เป้าหมาย: จบอันดับ 1-{state.obj || '-'} · ความเชื่อมั่นบอร์ด: <b>{state.bd ?? 50}%</b></div>
              {state.sack === 1 && (
                <div className="text-[var(--red)] font-bold">❌ บอร์ดบริหารมีมติปลดคุณออกจากตำแหน่งหลังผลงานต่ำกว่าเป้า</div>
              )}
            </div>
          )}

          {state.mode === 'p' && summary.offers.length > 0 && (
            <div className="p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 space-y-2 mland:space-y-1 col-span-2">
              <div className="font-bold text-xs mland:text-[10px]">✉️ ข้อเสนอย้ายทีมจากลีกที่สูงกว่า!</div>
              <div className="grid grid-cols-2 gap-2 mland:gap-1.5">
                {summary.offers.map((club) => (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => onStartNextSeason(club.id)}
                    className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] flex items-center gap-2.5 mland:gap-1.5 text-left cursor-pointer"
                  >
                    <ClubCrest name={club.name} size={28} team={club} />
                    <div className="min-w-0">
                      <div className="font-bold text-xs mland:text-[10.5px] truncate">{club.name}</div>
                      <div className="text-[11px] mland:text-[9.5px] text-[var(--g)] font-semibold">ย้ายร่วมทีม ({TN[club.tier]}) ›</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 p-3.5 sm:p-4 mland:p-1.5 bg-[var(--surface-2)] border-t border-[var(--line)] flex items-center gap-2">
          {onOpenSeasonStats && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onOpenSeasonStats();
              }}
              className="px-4 mland:px-3 py-3 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-[var(--ink)] font-bold text-xs sm:text-sm mland:text-[10.5px] cursor-pointer whitespace-nowrap shrink-0"
            >
              📊 สรุปสถิตินักเตะ & สโมสร
            </button>
          )}
          <button
            type="button"
            onClick={() => onStartNextSeason()}
            className="flex-1 py-3 mland:py-1 rounded-xl bg-[var(--g)] text-white font-bold text-sm mland:text-xs hover:brightness-105 cursor-pointer shadow-sm"
          >
            {state.sack === 1 ? '🔄 กลับสู่หน้าหลัก' : `🚀 เริ่มฤดูกาลที่ ${state.season + 1}`}
          </button>
        </div>
      </div>
    </div>
  );
};

