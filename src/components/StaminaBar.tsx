import React from 'react';
import { clamp } from '../utils/math';

export interface StaminaMeta {
  f: number;
  label: string;
  shortLabel: string;
  barColor: string;
  barGradient: string;
  txtCls: string;
  darkSurfaceTxtCls: string;
  trackBorderCls: string;
  pillCls: string;
  rowTint: string;
  needRest: boolean;
}

export const getStaminaMeta = (fitRaw: number | undefined, restThreshold = 65): StaminaMeta => {
  const f = clamp(Math.round(fitRaw ?? 100), 0, 100);
  const restTh = clamp(Math.round(restThreshold), 40, 80);
  const warnTh = Math.max(75, restTh + 10);

  if (f < restTh) {
    return {
      f,
      label: 'ควรพัก',
      shortLabel: 'ควรพัก',
      barColor: '#ef4444',
      barGradient: 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)',
      txtCls: 'text-rose-600 dark:text-rose-400',
      darkSurfaceTxtCls: 'text-rose-300',
      trackBorderCls: 'border-rose-500/60 dark:border-rose-400/55',
      pillCls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35',
      rowTint: 'bg-rose-500/[0.08] border-rose-500/45 hover:border-rose-500/75',
      needRest: true
    };
  }
  if (f < warnTh) {
    return {
      f,
      label: 'เริ่มล้า',
      shortLabel: 'ล้า',
      barColor: '#f59e0b',
      barGradient: 'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)',
      txtCls: 'text-amber-700 dark:text-amber-300',
      darkSurfaceTxtCls: 'text-amber-300',
      trackBorderCls: 'border-amber-500/45 dark:border-amber-400/40',
      pillCls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35',
      rowTint: 'bg-amber-500/[0.06] border-amber-500/35 hover:border-amber-500/70',
      needRest: false
    };
  }
  if (f < 86) {
    return {
      f,
      label: 'พร้อม',
      shortLabel: 'พร้อม',
      barColor: '#22c55e',
      barGradient: 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)',
      txtCls: 'text-emerald-700 dark:text-emerald-400',
      darkSurfaceTxtCls: 'text-emerald-300',
      trackBorderCls: 'border-[var(--line)] dark:border-white/15',
      pillCls: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      rowTint: '',
      needRest: false
    };
  }
  return {
    f,
    label: 'ฟิตเต็ม',
    shortLabel: 'ฟิต',
    barColor: '#22c55e',
    barGradient: 'linear-gradient(90deg, #15803d 0%, #22c55e 65%, #4ade80 100%)',
    txtCls: 'text-emerald-700 dark:text-emerald-300',
    darkSurfaceTxtCls: 'text-emerald-300',
    trackBorderCls: 'border-[var(--line)] dark:border-white/15',
    pillCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
    rowTint: '',
    needRest: false
  };
};

export interface StaminaBarProps {
  value: number | undefined;
  variant?: 'card' | 'compact' | 'inline';
  label?: string;
  showStatusLabel?: boolean;
  restThreshold?: number;
  darkSurface?: boolean;
  barWidthClass?: string;
  className?: string;
}

export const StaminaBar: React.FC<StaminaBarProps> = ({
  value,
  variant = 'compact',
  label,
  showStatusLabel = false,
  restThreshold = 65,
  darkSurface = false,
  barWidthClass = 'w-11 sm:w-12 mland:w-9',
  className = ''
}) => {
  const meta = getStaminaMeta(value, restThreshold);
  const f = meta.f;
  const fillWidth = `${f > 0 ? clamp(f, 4, 100) : 0}%`;
  const textColor = darkSurface ? meta.darkSurfaceTxtCls : meta.txtCls;
  const trackSurface = darkSurface
    ? 'bg-black/45 border-white/25 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
    : `bg-[var(--surface-2)] dark:bg-black/40 border ${meta.trackBorderCls} shadow-[inset_0_1px_1px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]`;

  if (variant === 'card') {
    return (
      <div
        className={`space-y-1 mland:space-y-0.5 ${className}`}
        title={`ความฟิต ${f}% (${meta.label})`}
      >
        <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px] font-bold">
          <span className="text-[var(--ink)] inline-flex items-center gap-1 truncate">
            <span aria-hidden="true">⚡</span>
            <span>{label || 'ความฟิต'}</span>
          </span>
          <span className={`tabular font-extrabold shrink-0 inline-flex items-center gap-1 ${textColor}`}>
            <span>{meta.label}</span>
            <span aria-hidden="true" className="opacity-55">·</span>
            <span>{f}%</span>
          </span>
        </div>
        <div className={`w-full h-2 mland:h-1.5 rounded-full overflow-hidden ${trackSurface}`}>
          <div
            className="h-full rounded-full transition-[width] duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
            style={{ width: fillWidth, background: meta.barGradient }}
          />
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 shrink-0 tabular ${className}`}
        title={`ความฟิต ${f}% (${meta.label})`}
      >
        {label ? (
          <span className={`text-[10.5px] mland:text-[8.5px] font-bold ${darkSurface ? 'text-white/85' : 'text-[var(--mut)]'}`}>
            ⚡ {label}
          </span>
        ) : (
          <span className="text-[10px] mland:text-[8px] leading-none" aria-hidden="true">
            ⚡
          </span>
        )}
        <span className={`inline-block h-1.5 mland:h-1 rounded-full overflow-hidden shrink-0 ${barWidthClass} ${trackSurface}`}>
          <span
            className="block h-full rounded-full transition-[width] duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
            style={{ width: fillWidth, background: meta.barGradient }}
          />
        </span>
        <span className={`text-[10.5px] mland:text-[8.5px] font-extrabold leading-none ${textColor}`}>
          {f}%
        </span>
      </span>
    );
  }

  return (
    <div
      className={`flex flex-col items-stretch justify-center gap-0.5 shrink-0 ${className}`}
      title={`ความฟิต ${f}% (${meta.label})`}
    >
      <div className="flex items-center justify-between gap-1 leading-none tabular">
        {showStatusLabel ? (
          <span className={`text-[8.5px] mland:text-[7.5px] font-extrabold truncate ${textColor}`}>
            {meta.shortLabel}
          </span>
        ) : (
          <span className={`text-[8.5px] mland:text-[7.5px] font-bold leading-none ${textColor}`} aria-hidden="true">
            ⚡
          </span>
        )}
        <span className={`text-[9.5px] mland:text-[8px] font-extrabold ${textColor}`}>
          {f}%
        </span>
      </div>
      <div className={`w-full h-1.5 mland:h-1 rounded-full overflow-hidden ${trackSurface}`}>
        <div
          className="h-full rounded-full transition-[width] duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
          style={{ width: fillWidth, background: meta.barGradient }}
        />
      </div>
    </div>
  );
};
