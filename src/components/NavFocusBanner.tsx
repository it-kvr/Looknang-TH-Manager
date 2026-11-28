import React, { useCallback, useEffect, useState } from 'react';
import { Crosshair, X } from 'lucide-react';
import type { MainTab, NavIntent } from '../types/game';
import { SFX } from '../utils/audioTheme';
import { EffectText } from './DeltaText';

export function useNavFocus(
  navIntent: NavIntent | null | undefined,
  tabs: MainTab | readonly MainTab[]
) {
  const [activeFocus, setActiveFocus] = useState<string | null>(null);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const tabKey: string = typeof tabs === 'string' ? tabs : tabs.join('|');

  const tabMatches = useCallback(
    (t?: MainTab) => {
      if (!t) return false;
      return tabKey.split('|').includes(t);
    },
    [tabKey]
  );

  useEffect(() => {
    if (!navIntent || !tabMatches(navIntent.tab)) return;
    if (!navIntent.focus && !navIntent.hint) {
      setActiveFocus(null);
      setActiveHint(null);
      return;
    }
    setActiveFocus(navIntent.focus ?? null);
    setActiveHint(navIntent.hint ?? null);
  }, [navIntent, tabMatches]);

  const scrollToFocused = useCallback((focusId: string | null) => {
    if (!focusId || typeof document === 'undefined') return;
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(focusId)
        : focusId.replace(/["\\]/g, '\\$&');
    const el = document.querySelector(`[data-focus-id="${escaped}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, []);

  useEffect(() => {
    if (!activeFocus) return;
    const timer = window.setTimeout(() => scrollToFocused(activeFocus), 85);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeFocus, scrollToFocused]);

  const clearFocus = useCallback(() => {
    setActiveFocus(null);
    setActiveHint(null);
  }, []);

  const isFocused = useCallback(
    (id: string) => Boolean(activeFocus && activeFocus === id),
    [activeFocus]
  );

  return {
    activeFocus,
    activeHint,
    clearFocus,
    isFocused,
    scrollToFocused: () => scrollToFocused(activeFocus)
  };
}

export const NavFocusBanner: React.FC<{
  hint: string | null;
  onJumpToTarget?: () => void;
  onDismiss: () => void;
}> = ({ hint, onJumpToTarget, onDismiss }) => {
  if (!hint) return null;
  return (
    <div
      role="status"
      className="relative shrink-0 overflow-hidden rounded-xl border border-amber-500/75 dark:border-[var(--lamp)]/80 bg-amber-500/12 dark:bg-amber-400/14 px-2.5 py-1.5 mland:px-2 mland:py-1 flex items-center justify-between gap-2 shadow-[0_0_14px_rgba(245,194,66,0.22)]"
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <span className="absolute inset-y-0 w-1/2 task-sweep-beam bg-gradient-to-r from-transparent via-amber-400/25 to-transparent" />
      </span>
      <div className="relative flex items-center gap-2 min-w-0 flex-1">
        <span className="w-5 h-5 mland:w-4 mland:h-4 rounded-lg bg-amber-500 text-[#261900] flex items-center justify-center shrink-0 shadow-2xs">
          <Crosshair className="w-3 h-3 mland:w-2.5 mland:h-2.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 text-[11px] mland:text-[9.5px] leading-snug text-[var(--ink)] font-semibold break-words">
          <span className="font-extrabold text-amber-800 dark:text-[var(--lamp)] mr-1">ต้องทำตรงนี้:</span>
          <EffectText text={hint} />
        </div>
      </div>
      <div className="relative flex items-center gap-1 shrink-0">
        {onJumpToTarget && (
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              onJumpToTarget();
            }}
            className="btn btn-xs btn-gold whitespace-nowrap"
          >
            ชี้จุด
          </button>
        )}
        <button
          type="button"
          aria-label="ปิดคำแนะนำ"
          onClick={() => {
            SFX.tap();
            onDismiss();
          }}
          className="w-6 h-6 mland:w-5 mland:h-5 rounded-lg border border-amber-500/40 bg-[var(--surface)]/80 hover:bg-[var(--surface)] text-[var(--mut)] hover:text-[var(--ink)] flex items-center justify-center cursor-pointer"
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export const NavFocusBadge: React.FC<{ label?: string }> = ({ label = 'ทำตรงนี้' }) => (
  <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded bg-amber-500 text-[#261900] text-[9.5px] mland:text-[8px] font-black leading-tight shrink-0 shadow-2xs">
    <Crosshair className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
    <span>{label}</span>
  </span>
);
