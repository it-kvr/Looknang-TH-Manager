import React, { useCallback, useEffect, useState } from 'react';
import { Pin } from 'lucide-react';
import type { MainTab, NavIntent } from '../types/game';

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
}> = () => null;

const FOCUS_BADGE_TONE = {
  amber: 'bg-amber-500/18 dark:bg-amber-400/20 border-amber-500/75 text-amber-600 dark:text-amber-300',
  rose: 'bg-rose-500/18 dark:bg-rose-400/20 border-rose-500/75 text-rose-600 dark:text-rose-300',
  sky: 'bg-sky-500/18 dark:bg-sky-400/20 border-sky-500/75 text-sky-600 dark:text-sky-300',
  emerald: 'bg-emerald-500/18 dark:bg-emerald-400/20 border-emerald-500/75 text-[var(--g)]'
} as const;

export const NavFocusBadge: React.FC<{
  label?: string;
  tone?: keyof typeof FOCUS_BADGE_TONE;
}> = ({ label = 'จำเป็นต้องจัดการ', tone = 'amber' }) => (
  <span
    title={label}
    aria-label={label}
    className={`inline-flex items-center justify-center w-5 h-5 mland:w-4 mland:h-4 rounded-md border shrink-0 shadow-2xs ${FOCUS_BADGE_TONE[tone]}`}
  >
    <Pin className="w-3 h-3 mland:w-2.5 mland:h-2.5 shrink-0" aria-hidden="true" />
  </span>
);
