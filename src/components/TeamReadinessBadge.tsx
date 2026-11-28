import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { GameState, MainTab } from '../types/game';
import { syncTrainingFocusToPlan } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { logFin } from '../engine/playerCore';
import {
  checkClubDemandsCompletion,
  getFacilityCondition,
  getFacilityRenovateCost
} from '../engine/simulation';
import {
  buildTeamReadinessSummary,
  type ReadinessTone,
  type TeamReadinessTask
} from '../engine/teamReadiness';
import { StatIconBadge } from './StatIconBadge';
import { EffectText } from './DeltaText';
import { fmtMoney } from '../utils/math';

const TONE_CHIP_STYLES: Record<ReadinessTone | 'ready', {
  btn: string;
  dotPing: string;
  dotCore: string;
  countBadge: string;
}> = {
  urg: {
    btn: 'bg-rose-500/12 hover:bg-rose-500/18 dark:bg-rose-500/16 dark:hover:bg-rose-500/24 border-rose-500/45 text-rose-700 dark:text-rose-200',
    dotPing: 'bg-rose-400',
    dotCore: 'bg-rose-500',
    countBadge: 'bg-rose-600 text-white'
  },
  warn: {
    btn: 'bg-amber-500/12 hover:bg-amber-500/18 dark:bg-amber-400/15 dark:hover:bg-amber-400/22 border-amber-500/45 text-amber-800 dark:text-amber-200',
    dotPing: 'bg-amber-400',
    dotCore: 'bg-amber-500',
    countBadge: 'bg-amber-500 text-[#261900]'
  },
  ok: {
    btn: 'bg-emerald-500/12 hover:bg-emerald-500/18 dark:bg-emerald-500/16 dark:hover:bg-emerald-500/22 border-emerald-500/45 text-emerald-800 dark:text-emerald-200',
    dotPing: 'bg-emerald-400',
    dotCore: 'bg-emerald-500',
    countBadge: 'bg-[var(--g)] text-white'
  },
  ready: {
    btn: 'bg-emerald-500/8 hover:bg-emerald-500/14 dark:bg-emerald-500/12 dark:hover:bg-emerald-500/18 border-emerald-500/35 text-[var(--g)]',
    dotPing: 'bg-emerald-400',
    dotCore: 'bg-emerald-500',
    countBadge: 'bg-emerald-600 text-white'
  }
};

export const TeamReadinessBadge = React.memo<{
  state: GameState;
  onNavigateToTab: (tab: MainTab, sub?: string, focus?: string, hint?: string) => void;
  onUpdateState?: (updater: (draft: GameState) => void) => void;
  onToast?: (msg: string) => void;
}>(({ state, onNavigateToTab, onUpdateState, onToast }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(() => buildTeamReadinessSummary(state), [state]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Close popover on matchday progression
  useEffect(() => {
    setOpen(false);
  }, [state.md, state.season, state.v]);

  const executeTask = (task: TeamReadinessTask) => {
    SFX.tap();
    setOpen(false);

    if (task.quickAction && onUpdateState) {
      const qa = task.quickAction;
      if (qa.type === 'rest_recovery') {
        onUpdateState((d) => { syncTrainingFocusToPlan(d, 'F'); });
        onToast?.('สลับซ้อมเป็น "😴 พักผ่อน & ฟื้นฟู" แล้ว');
        return;
      }
      if (qa.type === 'player_rest') {
        onUpdateState((d) => { if (d.p) d.p.plan = 3; });
        onToast?.('ปรับแผนสัปดาห์นี้เป็น "พักผ่อน" แล้ว');
        return;
      }
      if (qa.type === 'ticket_standard') {
        let done: string[] = [];
        onUpdateState((d) => {
          d.ticketPlan = 'standard';
          d.tp = 1;
          done = checkClubDemandsCompletion(d);
        });
        onToast?.(done.length ? '✅ ปรับราคาตั๋วมาตรฐานแล้ว!' : 'ปรับราคาตั๋วเรียบร้อย');
        return;
      }
      if (qa.type === 'renovate_fac' && qa.fk) {
        const fk = qa.fk;
        const baseCost = qa.baseCost ?? 80;
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
        return;
      }
    }

    if (task.nav) {
      onNavigateToTab(task.nav.tab, task.nav.sub, task.nav.focus, task.nav.hint);
    }
  };

  const toneStyle = TONE_CHIP_STYLES[summary.topTone];

  const renderPopover = () => {
    if (!open) return null;
    return (
      <div
        role="dialog"
        aria-label="สถานะทีมและภารกิจก่อนแข่ง"
        className="fixed left-3 right-3 sm:left-auto sm:right-4 top-[58px] sm:top-[62px] mland:left-auto mland:right-2.5 mland:top-[46px] sm:w-[340px] mland:w-[315px] max-w-[calc(100vw-1.5rem)] z-[80] rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-[0_14px_40px_rgba(0,0,0,0.22)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.55)] overflow-hidden text-left"
      >
        <div className="px-3 py-2 mland:py-1.5 bg-[var(--surface-2)]/85 border-b border-[var(--line)] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs mland:text-[10.5px] font-extrabold text-[var(--ink)] flex items-center gap-1.5">
              <span>{summary.totalCount > 0 ? '📋 ต้องจัดการก่อนแข่ง' : '✅ พร้อมลงสนาม'}</span>
              {summary.totalCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[9.5px] mland:text-[8.5px] font-black leading-none tabular ${toneStyle.countBadge}`}>
                  {summary.totalCount}
                </span>
              )}
            </div>
            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5">
              {state.mode === 'm'
                ? `ฟิตตัวจริง ${summary.avgXiFit}%${summary.unreadyStarterCount > 0 ? ` · ตัวจริงไม่พร้อม ${summary.unreadyStarterCount} คน` : ' · 11 ตัวจริงพร้อมลง'}`
                : `ความฟิตส่วนตัว ${summary.avgXiFit}%`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { SFX.tap(); setOpen(false); }}
            aria-label="ปิดรายการสถานะทีม"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2 mland:p-1.5 max-h-[250px] mland:max-h-[165px] overflow-y-auto space-y-1.5 mland:space-y-1">
          {summary.tasks.length === 0 ? (
            <div className="p-2.5 mland:p-2 rounded-xl bg-emerald-500/8 border border-emerald-500/30 space-y-2">
              <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--ink)]">
                ไม่มีรายการเร่งด่วนค้างคา ทีมพร้อมลุยนัดถัดไปได้ทันที
              </div>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setOpen(false);
                  onNavigateToTab('q');
                }}
                className="btn btn-xs btn-primary w-full justify-between"
              >
                <span>{state.mode === 'm' ? '⚽ ตรวจเช็ก 11 ตัวจริง & แผน' : '⚽ ดูแผน & รายชื่อทีม'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            summary.tasks.map((task) => {
              const rowCls =
                task.tone === 'urg'
                  ? 'bg-rose-500/[0.06] hover:bg-rose-500/[0.12] border-rose-500/35'
                  : task.tone === 'ok'
                    ? 'bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12] border-emerald-500/35'
                    : 'bg-amber-500/[0.06] hover:bg-amber-500/[0.12] border-amber-500/35';
              const btnCls =
                task.tone === 'urg'
                  ? 'bg-rose-600 text-white'
                  : task.tone === 'ok'
                    ? 'bg-[var(--g)] text-white'
                    : 'bg-amber-500 text-[#261900]';
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => executeTask(task)}
                  className={`group w-full text-left px-2.5 py-2 mland:px-2 mland:py-1.5 rounded-xl border flex items-center justify-between gap-2 transition-colors cursor-pointer ${rowCls}`}
                >
                  <div className="w-6 h-6 mland:w-5 mland:h-5 rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 flex items-center justify-center text-xs mland:text-[10px] shrink-0">
                    {task.iconKind === 'injury' ? <StatIconBadge kind="injury" size="xs" /> : task.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[11px] mland:text-[9.5px] text-[var(--ink)] leading-snug truncate">
                      <EffectText text={task.title} />
                    </div>
                    <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate mt-0.5">
                      <span className="font-semibold text-[var(--ink)]/75">{task.tag}</span>
                      {task.detail ? (
                        <>
                          {' · '}
                          <EffectText text={task.detail} />
                        </>
                      ) : null}
                    </div>
                  </div>
                  {task.actionLabel && (
                    <span className={`shrink-0 px-2 py-1 mland:py-0.5 rounded-lg text-[10px] mland:text-[8.5px] font-extrabold inline-flex items-center gap-0.5 shadow-2xs ${btnCls}`}>
                      <span>{task.actionLabel}</span>
                      <ChevronRight className="w-3 h-3 mland:w-2.5 mland:h-2.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {summary.missionHighlight && (
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              setOpen(false);
              onNavigateToTab(summary.missionHighlight!.tab, summary.missionHighlight!.sub);
            }}
            className="w-full px-3 py-2 mland:py-1.5 bg-[var(--surface-2)]/65 hover:bg-[var(--surface-2)] border-t border-[var(--line)] flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--ink)] truncate">
                🎯 {summary.missionHighlight.label}
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--surface)] border border-[var(--line)]/70 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--g)] transition-all"
                  style={{ width: `${Math.max(4, Math.min(100, summary.missionHighlight.pct))}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] mland:text-[8.5px] font-extrabold text-[var(--g)] tabular shrink-0">
              {summary.missionHighlight.pct}% ›
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => { SFX.tap(); setOpen((prev) => !prev); }}
        aria-expanded={open}
        title={summary.tooltipText}
        className={`btn h-10 mland:h-8 px-2.5 sm:px-3 mland:px-2 !rounded-r-none border border-r-0 gap-1.5 mland:gap-1 text-[11px] sm:text-xs mland:text-[10px] shadow-2xs ${toneStyle.btn}`}
      >
        <span className="relative flex h-2 w-2 mland:h-1.5 mland:w-1.5 shrink-0" aria-hidden="true">
          {summary.topTone === 'urg' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${toneStyle.dotPing}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 mland:h-1.5 mland:w-1.5 ${toneStyle.dotCore}`} />
        </span>

        <span className="whitespace-nowrap leading-none">
          {summary.compactLabel}
        </span>

        {summary.totalCount > 1 && (
          <span className={`px-1.5 py-[2px] mland:px-1 rounded-md text-[9.5px] mland:text-[8px] font-black leading-none tabular shrink-0 ${toneStyle.countBadge}`}>
            +{summary.totalCount - 1}
          </span>
        )}

        <ChevronDown
          className={`w-3 h-3 mland:w-2.5 mland:h-2.5 opacity-65 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {renderPopover()}
    </div>
  );
});
