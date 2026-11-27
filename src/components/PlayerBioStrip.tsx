import React from 'react';
import type { PreferredFoot } from '../types/game';
import type { PlayerBio } from '../engine/playerCore';

export interface FootColorMeta {
  foot: PreferredFoot;
  label: string;
  shortLabel: string;
  dotColor: string;
  textCls: string;
  badgeCls: string;
  darkBadgeCls: string;
  buttonActiveCls: string;
  titleText: string;
}

export function getFootColorMeta(foot: PreferredFoot): FootColorMeta {
  const sharedMeta = {
    dotColor: '#10b981',
    textCls: 'text-[var(--g)]',
    badgeCls: 'bg-[var(--g-soft)] border-[var(--g)]/40 text-[var(--g)]',
    darkBadgeCls: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300',
    buttonActiveCls: 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--g)] ring-1 ring-[var(--g)]/35 shadow-xs'
  };

  if (foot === 'L') {
    return {
      foot: 'L',
      label: 'เท้าซ้าย',
      shortLabel: 'เท้าซ้าย',
      ...sharedMeta,
      titleText: 'เท้าซ้าย'
    };
  }
  if (foot === 'B') {
    return {
      foot: 'B',
      label: 'สองเท้า',
      shortLabel: 'สองเท้า',
      ...sharedMeta,
      titleText: 'สองเท้า'
    };
  }
  return {
    foot: 'R',
    label: 'เท้าขวา',
    shortLabel: 'เท้าขวา',
    ...sharedMeta,
    titleText: 'เท้าขวา'
  };
}

export const FootPairIcon: React.FC<{
  foot: PreferredFoot;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showTitle?: boolean;
}> = ({ foot, size = 'sm', className = '', showTitle = false }) => {
  const fm = getFootColorMeta(foot);
  const leftActive = foot === 'L' || foot === 'B';
  const rightActive = foot === 'R' || foot === 'B';

  const activeColor = '#10b981';
  const inactiveColor = '#94a3b8';
  const leftColor = leftActive ? activeColor : inactiveColor;
  const rightColor = rightActive ? activeColor : inactiveColor;
  const leftOpacity = leftActive ? 1 : 0.42;
  const rightOpacity = rightActive ? 1 : 0.42;

  const sizeCls =
    size === 'xs'
      ? 'w-[17px] h-[13px] mland:w-[15px] mland:h-[11px]'
      : size === 'md'
        ? 'w-[24px] h-[18px] mland:w-[20px] mland:h-[15px]'
        : 'w-[20px] h-[15px] mland:w-[17px] mland:h-[13px]';

  return (
    <svg
      viewBox="0 0 24 18"
      className={`shrink-0 inline-block ${sizeCls} ${className}`}
      fill="none"
      aria-label={fm.titleText}
      role="img"
    >
      {showTitle && <title>{fm.titleText}</title>}
      {/* Left Foot */}
      <g fill={leftColor} opacity={leftOpacity}>
        <path d="M5.8 16.4 C4.6 16.4 3.9 15.4 4.2 14.0 C4.5 12.7 4.9 11.7 4.5 10.3 C3.9 8.6 3.6 7.0 4.5 5.7 C5.4 4.4 7.8 4.3 9.2 5.3 C10.4 6.1 10.4 7.7 9.8 9.5 C9.3 10.9 9.2 12.5 8.8 14.1 C8.4 15.5 7.1 16.4 5.8 16.4 Z" />
        <ellipse cx="9.3" cy="2.6" rx="1.22" ry="1.45" transform="rotate(-6 9.3 2.6)" />
        <circle cx="7.1" cy="2.8" r="0.88" />
        <circle cx="5.4" cy="3.5" r="0.76" />
        <circle cx="4.1" cy="4.6" r="0.64" />
      </g>
      {/* Right Foot (mirrored around x = 12) */}
      <g transform="translate(24, 0) scale(-1, 1)" fill={rightColor} opacity={rightOpacity}>
        <path d="M5.8 16.4 C4.6 16.4 3.9 15.4 4.2 14.0 C4.5 12.7 4.9 11.7 4.5 10.3 C3.9 8.6 3.6 7.0 4.5 5.7 C5.4 4.4 7.8 4.3 9.2 5.3 C10.4 6.1 10.4 7.7 9.8 9.5 C9.3 10.9 9.2 12.5 8.8 14.1 C8.4 15.5 7.1 16.4 5.8 16.4 Z" />
        <ellipse cx="9.3" cy="2.6" rx="1.22" ry="1.45" transform="rotate(-6 9.3 2.6)" />
        <circle cx="7.1" cy="2.8" r="0.88" />
        <circle cx="5.4" cy="3.5" r="0.76" />
        <circle cx="4.1" cy="4.6" r="0.64" />
      </g>
    </svg>
  );
};

export const PlayerBioStrip: React.FC<{
  bio: PlayerBio;
  variant?: 'grid' | 'card' | 'inline';
  tone?: 'dark' | 'light';
  className?: string;
}> = ({ bio, variant = 'grid', tone = 'dark', className = '' }) => {
  const fm = getFootColorMeta(bio.foot);

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10.5px] mland:text-[8.5px] text-[var(--mut)] font-medium tabular leading-snug whitespace-nowrap ${className}`}
        title={`ส่วนสูง ${bio.heightCm} ซม. · น้ำหนัก ${bio.weightKg} กก. · ${fm.titleText}`}
      >
        <span className="text-[var(--ink)]/85 font-semibold">
          {bio.heightCm}<span className="text-[var(--mut)] font-normal ml-0.5">ซม.</span>
        </span>
        <span aria-hidden="true">·</span>
        <span className="text-[var(--ink)]/85 font-semibold">
          {bio.weightKg}<span className="text-[var(--mut)] font-normal ml-0.5">กก.</span>
        </span>
        <span aria-hidden="true">·</span>
        <span className={`inline-flex items-center gap-0.5 font-semibold ${fm.textCls}`}>
          <FootPairIcon foot={bio.foot} size="xs" />
          <span>{fm.shortLabel}</span>
        </span>
      </span>
    );
  }

  if (variant === 'card') {
    const isLight = tone === 'light';
    return (
      <div
        className={`grid grid-cols-3 items-center divide-x rounded-lg border px-1 py-1 mland:py-0.5 text-center whitespace-nowrap ${
          isLight
            ? 'divide-slate-300/75 bg-white/82 border-slate-300/80 shadow-2xs'
            : 'divide-white/12 bg-black/30 border-white/12'
        } ${className}`}
        title={`ส่วนสูง ${bio.heightCm} ซม. · น้ำหนัก ${bio.weightKg} กก. · ${fm.titleText}`}
      >
        <div className="px-1 text-[9.5px] mland:text-[7.5px] leading-none tabular truncate">
          <span className={`font-semibold mr-0.5 ${isLight ? 'text-slate-500' : 'text-white/55'}`}>
            สูง
          </span>
          <span className={`font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {bio.heightCm}
          </span>
          <span className={`text-[8px] mland:text-[6.5px] font-semibold ml-0.5 ${isLight ? 'text-slate-500' : 'text-white/60'}`}>
            ซม.
          </span>
        </div>
        <div className="px-1 text-[9.5px] mland:text-[7.5px] leading-none tabular truncate">
          <span className={`font-semibold mr-0.5 ${isLight ? 'text-slate-500' : 'text-white/55'}`}>
            หนัก
          </span>
          <span className={`font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {bio.weightKg}
          </span>
          <span className={`text-[8px] mland:text-[6.5px] font-semibold ml-0.5 ${isLight ? 'text-slate-500' : 'text-white/60'}`}>
            กก.
          </span>
        </div>
        <div className="px-1 inline-flex items-center justify-center gap-1 leading-none">
          <FootPairIcon foot={bio.foot} size="xs" />
          <span className={`text-[9px] mland:text-[7.5px] font-extrabold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
            {fm.shortLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-3 items-center divide-x divide-[var(--line)] rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)] py-1 mland:py-0.5 text-center ${className}`}
      title={`ส่วนสูง ${bio.heightCm} ซม. · น้ำหนัก ${bio.weightKg} กก. · ${fm.titleText}`}
    >
      <div className="px-1" title={`ส่วนสูง ${bio.heightCm} เซนติเมตร (${bio.physiqueLabel})`}>
        <div className="text-[8.5px] mland:text-[7px] text-[var(--mut)] font-bold leading-none">ส่วนสูง</div>
        <div className="text-[11px] mland:text-[9px] font-extrabold text-[var(--ink)] tabular mt-0.5 leading-none">
          {bio.heightCm} <span className="text-[9px] mland:text-[7.5px] font-semibold text-[var(--mut)]">ซม.</span>
        </div>
      </div>
      <div className="px-1" title={`น้ำหนัก ${bio.weightKg} กิโลกรัม`}>
        <div className="text-[8.5px] mland:text-[7px] text-[var(--mut)] font-bold leading-none">น้ำหนัก</div>
        <div className="text-[11px] mland:text-[9px] font-extrabold text-[var(--ink)] tabular mt-0.5 leading-none">
          {bio.weightKg} <span className="text-[9px] mland:text-[7.5px] font-semibold text-[var(--mut)]">กก.</span>
        </div>
      </div>
      <div className="px-1 flex flex-col items-center justify-center" title={fm.titleText}>
        <div className={`text-[8.5px] mland:text-[7px] font-bold leading-none whitespace-nowrap ${fm.textCls}`}>
          {fm.shortLabel}
        </div>
        <div className="mt-0.5 inline-flex items-center justify-center leading-none">
          <FootPairIcon foot={bio.foot} size="sm" />
        </div>
      </div>
    </div>
  );
};
