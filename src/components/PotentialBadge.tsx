import React from 'react';
import { clamp } from '../utils/math';

export type PotentialBadgeVariant = 'default' | 'card' | 'inline';
export type PotentialBadgeSize = 'xs' | 'sm' | 'md';

interface PotentialBadgeProps {
  pot: number;
  variant?: PotentialBadgeVariant;
  size?: PotentialBadgeSize;
  showLabel?: boolean;
  title?: string;
  tone?: 'dark' | 'light';
  className?: string;
}

const ICON_PX: Record<PotentialBadgeSize, number> = {
  xs: 10,
  sm: 12,
  md: 14
};

export interface PotentialTierMeta {
  tierKey: 'elite' | 'high' | 'solid' | 'base';
  label: string;
  badgeCls: string;
  darkCardCls: string;
  lightCardCls: string;
  textCls: string;
  primaryHex: string;
  darkPrimaryHex: string;
  strokeHex: string;
  darkStrokeHex: string;
}

export function potentialTierMeta(pot: number): PotentialTierMeta {
  if (pot >= 86) {
    return {
      tierKey: 'elite',
      label: 'ระดับซุปตาร์',
      badgeCls:
        'bg-gradient-to-r from-amber-500/18 via-yellow-400/12 to-amber-500/18 border-amber-500/45 text-amber-900 dark:from-amber-400/20 dark:via-yellow-400/10 dark:to-amber-500/15 dark:border-amber-400/45 dark:text-amber-200',
      darkCardCls:
        'bg-gradient-to-r from-amber-500/24 via-yellow-400/14 to-amber-500/20 border-amber-300/55 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.18)]',
      lightCardCls: 'bg-amber-100/90 border-amber-400/70 text-amber-900',
      textCls: 'text-amber-700 dark:text-amber-300',
      primaryHex: '#d97706',
      darkPrimaryHex: '#fcd34d',
      strokeHex: '#92400e',
      darkStrokeHex: '#fef3c7'
    };
  }
  if (pot >= 75) {
    return {
      tierKey: 'high',
      label: 'ศักยภาพสูง',
      badgeCls:
        'bg-gradient-to-r from-emerald-500/16 to-teal-500/12 border-emerald-600/40 text-emerald-900 dark:from-emerald-500/20 dark:to-teal-500/12 dark:border-emerald-400/45 dark:text-emerald-200',
      darkCardCls:
        'bg-gradient-to-r from-emerald-500/24 to-teal-400/16 border-emerald-300/50 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.14)]',
      lightCardCls: 'bg-emerald-100/90 border-emerald-500/55 text-emerald-900',
      textCls: 'text-emerald-700 dark:text-emerald-300',
      primaryHex: '#059669',
      darkPrimaryHex: '#6ee7b7',
      strokeHex: '#065f46',
      darkStrokeHex: '#d1fae5'
    };
  }
  if (pot >= 65) {
    return {
      tierKey: 'solid',
      label: 'กำลังพัฒนา',
      badgeCls:
        'bg-gradient-to-r from-sky-500/15 to-cyan-500/10 border-sky-600/40 text-sky-900 dark:from-sky-500/20 dark:to-cyan-500/12 dark:border-sky-400/45 dark:text-sky-200',
      darkCardCls:
        'bg-gradient-to-r from-sky-500/22 to-cyan-400/14 border-sky-300/45 text-sky-200',
      lightCardCls: 'bg-sky-100/90 border-sky-500/55 text-sky-900',
      textCls: 'text-sky-700 dark:text-sky-300',
      primaryHex: '#0284c7',
      darkPrimaryHex: '#7dd3fc',
      strokeHex: '#075985',
      darkStrokeHex: '#e0f2fe'
    };
  }
  return {
    tierKey: 'base',
    label: 'ศักยภาพทั่วไป',
    badgeCls:
      'bg-slate-500/12 border-slate-500/35 text-slate-700 dark:bg-slate-400/14 dark:border-slate-400/35 dark:text-slate-200',
    darkCardCls: 'bg-slate-400/15 border-slate-300/35 text-slate-200',
    lightCardCls: 'bg-slate-200/85 border-slate-400/60 text-slate-800',
    textCls: 'text-slate-600 dark:text-slate-300',
    primaryHex: '#64748b',
    darkPrimaryHex: '#cbd5e1',
    strokeHex: '#334155',
    darkStrokeHex: '#f1f5f9'
  };
}

export const PotentialIcon: React.FC<{
  pot: number;
  size?: PotentialBadgeSize;
  onDarkCard?: boolean;
}> = ({ pot, size = 'sm', onDarkCard = false }) => {
  const px = ICON_PX[size];
  const meta = potentialTierMeta(pot);
  const fillCol = onDarkCard ? meta.darkPrimaryHex : meta.primaryHex;
  const edgeCol = onDarkCard ? meta.darkStrokeHex : meta.strokeHex;

  return (
    <svg viewBox="0 0 16 16" width={px} height={px} aria-hidden="true" className="shrink-0">
      <path
        d="M2.6 7.7 L8 2.3 L13.4 7.7 L11.7 9.4 L8 5.7 L4.3 9.4 Z"
        fill={fillCol}
        stroke={edgeCol}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path
        d="M4.1 12.2 L8 8.3 L11.9 12.2 L10.4 13.7 L8 11.3 L5.6 13.7 Z"
        fill={fillCol}
        opacity="0.88"
      />
    </svg>
  );
};

export const PotentialBadge: React.FC<PotentialBadgeProps> = ({
  pot,
  variant = 'default',
  size = 'sm',
  showLabel = false,
  title,
  tone = 'dark',
  className = ''
}) => {
  const val = clamp(Math.round(pot), 1, 199);
  const meta = potentialTierMeta(val);
  const resolvedTitle = title || `ศักยภาพสูงสุด ${val} · ${meta.label}`;

  if (variant === 'inline') {
    const sizeCls =
      size === 'xs'
        ? 'text-[10px] mland:text-[8.5px]'
        : size === 'md'
          ? 'text-xs mland:text-[10.5px]'
          : 'text-[11px] mland:text-[9px]';
    return (
      <span
        title={resolvedTitle}
        className={`inline-flex items-center gap-0.5 font-extrabold tabular leading-snug align-middle max-w-full ${meta.textCls} ${sizeCls} ${className}`}
      >
        <PotentialIcon pot={val} size={size} />
        <span>
          {val}
          {showLabel ? ` · ${meta.label}` : ''}
        </span>
      </span>
    );
  }

  if (variant === 'card') {
    const isLight = tone === 'light';
    const sizeCls =
      size === 'xs'
        ? 'px-1.5 py-[2px] mland:px-1 mland:py-[1px] text-[9px] mland:text-[7.5px]'
        : size === 'md'
          ? 'px-2 py-0.5 text-[10.5px] mland:text-[8.5px]'
          : 'px-1.5 py-[2px] text-[9.5px] mland:text-[8px]';
    return (
      <span
        title={resolvedTitle}
        className={`inline-flex items-center gap-1 rounded-md border font-display font-extrabold leading-none tracking-tight tabular select-none shrink-0 ${
          isLight ? meta.lightCardCls : meta.darkCardCls
        } ${sizeCls} ${className}`}
      >
        <PotentialIcon pot={val} size={size} onDarkCard={!isLight} />
        <span>{val}</span>
        {showLabel && <span className="opacity-90 font-semibold">· {meta.label}</span>}
      </span>
    );
  }

  const sizeCls =
    size === 'xs'
      ? 'px-1.5 py-[2px] mland:px-1 mland:py-[1px] text-[9.5px] mland:text-[8px]'
      : size === 'md'
        ? 'px-2.5 py-0.5 text-xs mland:text-[10px]'
        : 'px-2 mland:px-1.5 py-0.5 text-[10.5px] mland:text-[8.5px]';

  return (
    <span
      title={resolvedTitle}
      className={`inline-flex flex-wrap items-center gap-1 rounded-lg border font-bold leading-tight tabular select-none max-w-full ${meta.badgeCls} ${sizeCls} ${className}`}
    >
      <PotentialIcon pot={val} size={size} />
      <span className="font-extrabold">{val}</span>
      {showLabel && <span className="font-semibold opacity-95 whitespace-normal">· {meta.label}</span>}
    </span>
  );
};
