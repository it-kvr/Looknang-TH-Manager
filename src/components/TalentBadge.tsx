import React from 'react';
import { talentTierMeta, type TalentTierMeta } from '../engine/missions';
import { clamp } from '../utils/math';

export type TalentBadgeVariant = 'default' | 'card' | 'inline' | 'meter';
export type TalentBadgeSize = 'xs' | 'sm' | 'md';

interface TalentBadgeProps {
  talent: number;
  variant?: TalentBadgeVariant;
  size?: TalentBadgeSize;
  showLabel?: boolean;
  compactLabel?: boolean;
  prefix?: string;
  title?: string;
  tone?: 'dark' | 'light';
  className?: string;
}

const ICON_PX: Record<TalentBadgeSize, number> = {
  xs: 10,
  sm: 12,
  md: 14
};

export const TalentTierIcon: React.FC<{
  tierKey: TalentTierMeta['tierKey'];
  size?: TalentBadgeSize;
  onDarkCard?: boolean;
}> = ({ tierKey, size = 'sm', onDarkCard = false }) => {
  const px = ICON_PX[size];

  if (tierKey === 'legend') {
    return (
      <svg viewBox="0 0 16 16" width={px} height={px} aria-hidden="true" className="shrink-0">
        <polygon
          points="4.2,2.2 11.8,2.2 14.5,6 8,14 1.5,6"
          fill={onDarkCard ? '#fcd34d' : '#f59e0b'}
          stroke={onDarkCard ? '#fef3c7' : '#92400e'}
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
        <polyline
          points="1.7,6 14.3,6 8,14 5.2,6 6.8,2.3 9.2,2.3 10.8,6"
          fill="none"
          stroke={onDarkCard ? '#fffbeb' : '#fef3c7'}
          strokeWidth="0.95"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </svg>
    );
  }

  if (tierKey === 'high') {
    return (
      <svg viewBox="0 0 16 16" width={px} height={px} aria-hidden="true" className="shrink-0">
        <path
          d="M8 1.4 L9.85 5.45 L14.2 6.05 L11.05 9.1 L11.82 13.45 L8 11.38 L4.18 13.45 L4.95 9.1 L1.8 6.05 L6.15 5.45 Z"
          fill={onDarkCard ? '#6ee7b7' : '#10b981'}
          stroke={onDarkCard ? '#d1fae5' : '#065f46'}
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (tierKey === 'pro') {
    return (
      <svg viewBox="0 0 16 16" width={px} height={px} aria-hidden="true" className="shrink-0">
        <polygon
          points="9.2,1.4 3.4,8.8 7.5,8.8 6.6,14.6 12.6,7.1 8.4,7.1"
          fill={onDarkCard ? '#7dd3fc' : '#0ea5e9'}
          stroke={onDarkCard ? '#e0f2fe' : '#075985'}
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" width={px} height={px} aria-hidden="true" className="shrink-0">
      <path
        d="M8 1.8 L13.2 3.9 V7.9 C13.2 11.1 10.9 13.4 8 14.4 C5.1 13.4 2.8 11.1 2.8 7.9 V3.9 Z"
        fill={onDarkCard ? '#cbd5e1' : '#64748b'}
        stroke={onDarkCard ? '#f1f5f9' : '#334155'}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const TalentBadge: React.FC<TalentBadgeProps> = ({
  talent,
  variant = 'default',
  size = 'sm',
  showLabel = false,
  compactLabel = false,
  prefix = 'TL',
  title,
  tone = 'dark',
  className = ''
}) => {
  const tl = clamp(Math.round(talent), 25, 99);
  const meta = talentTierMeta(tl);
  const tierText = compactLabel ? meta.shortLabel : meta.label;
  const resolvedTitle = title || `พรสวรรค์ ${tl}/99 · ${meta.label}`;

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
        className={`inline-flex items-center gap-1 font-extrabold tabular leading-none align-middle ${meta.textCls} ${sizeCls} ${className}`}
      >
        <TalentTierIcon tierKey={meta.tierKey} size={size} />
        <span>
          {prefix} {tl}
          {showLabel ? ` · ${tierText}` : ''}
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
    const lightToneCls =
      meta.tierKey === 'legend'
        ? 'bg-amber-100/90 border-amber-400/70 text-amber-900'
        : meta.tierKey === 'high'
          ? 'bg-emerald-100/90 border-emerald-500/55 text-emerald-900'
          : meta.tierKey === 'pro'
            ? 'bg-sky-100/90 border-sky-500/55 text-sky-900'
            : 'bg-slate-200/85 border-slate-400/60 text-slate-800';
    return (
      <span
        title={resolvedTitle}
        className={`inline-flex items-center gap-1 rounded-md border font-display font-extrabold leading-none tracking-tight tabular select-none shrink-0 ${
          isLight ? lightToneCls : meta.darkCardCls
        } ${sizeCls} ${className}`}
      >
        <TalentTierIcon tierKey={meta.tierKey} size={size} onDarkCard={!isLight} />
        <span className="opacity-80 font-bold text-[0.84em] tracking-wider">{prefix}</span>
        <span>{tl}</span>
        {showLabel && <span className="opacity-90 font-semibold">· {tierText}</span>}
      </span>
    );
  }

  if (variant === 'meter') {
    const sizeCls =
      size === 'xs'
        ? 'px-1.5 py-[2px] text-[10px] mland:text-[8.5px]'
        : size === 'md'
          ? 'px-2.5 py-0.5 text-xs mland:text-[10px]'
          : 'px-2 py-[2px] text-[10.5px] mland:text-[9px]';
    return (
      <div className={`inline-flex flex-col items-end gap-1 ${className}`} title={resolvedTitle}>
        <span
          className={`inline-flex items-center gap-1 rounded-lg border font-bold leading-tight tabular select-none ${meta.badgeCls} ${sizeCls}`}
        >
          <TalentTierIcon tierKey={meta.tierKey} size={size} />
          <span className="text-[0.86em] opacity-75 font-extrabold tracking-wide">{prefix}</span>
          <span className="font-extrabold">{tl}</span>
          {showLabel && <span className="font-semibold opacity-90">· {tierText}</span>}
        </span>
        <div className="w-full min-w-[92px] h-1.5 rounded-full bg-[var(--surface)] border border-[var(--line)]/65 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${tl}%`, background: meta.barHex }}
          />
        </div>
      </div>
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
      className={`inline-flex items-center gap-1 rounded-lg border font-bold leading-tight tabular select-none shrink-0 ${meta.badgeCls} ${sizeCls} ${className}`}
    >
      <TalentTierIcon tierKey={meta.tierKey} size={size} />
      <span className="text-[0.86em] opacity-75 font-extrabold tracking-wide">{prefix}</span>
      <span className="font-extrabold">{tl}</span>
      {showLabel && <span className="font-semibold opacity-90">· {tierText}</span>}
    </span>
  );
};
