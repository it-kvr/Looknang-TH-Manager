import React from 'react';

export type RatingTierKey = 'motm' | 'great' | 'good' | 'poor';

export interface RatingPalette {
  tier: RatingTierKey;
  label: string;
  bg: string;
  stroke: string;
  text: string;
  badgeCls: string;
  textCls: string;
  darkTextCls: string;
}

export function getRatingPalette(rt: number, isMotm = false): RatingPalette {
  if (isMotm || rt >= 8.0) {
    return {
      tier: 'motm',
      label: isMotm ? 'Man of the Match' : 'ยอดเยี่ยม',
      bg: '#facc15',
      stroke: '#fef08a',
      text: '#1c1300',
      badgeCls: 'bg-[#facc15] border-[#fef08a] text-[#1c1300] shadow-2xs',
      textCls: 'text-[#b45309] dark:text-[#fde047]',
      darkTextCls: 'text-[#fde047]'
    };
  }
  if (rt >= 7.0) {
    return {
      tier: 'great',
      label: 'ดีมาก',
      bg: '#10b981',
      stroke: '#a7f3d0',
      text: '#ffffff',
      badgeCls: 'bg-[#10b981] border-[#a7f3d0]/80 text-white shadow-2xs',
      textCls: 'text-emerald-600 dark:text-emerald-400',
      darkTextCls: 'text-emerald-300'
    };
  }
  if (rt >= 6.0) {
    return {
      tier: 'good',
      label: 'มาตรฐาน',
      bg: '#0284c7',
      stroke: '#bae6fd',
      text: '#ffffff',
      badgeCls: 'bg-[#0284c7] border-[#bae6fd]/80 text-white shadow-2xs',
      textCls: 'text-sky-600 dark:text-sky-400',
      darkTextCls: 'text-sky-300'
    };
  }
  return {
    tier: 'poor',
    label: 'ฟอร์มต่ำ',
    bg: '#e11d48',
    stroke: '#fecdd3',
    text: '#ffffff',
    badgeCls: 'bg-[#e11d48] border-[#fecdd3]/80 text-white shadow-2xs',
    textCls: 'text-rose-600 dark:text-rose-400',
    darkTextCls: 'text-rose-300'
  };
}

export function getRatingCanvasPalette(
  rt: number,
  isMotm = false
): { bg: string; stroke: string; text: string } {
  const pal = getRatingPalette(rt, isMotm);
  return { bg: pal.bg, stroke: pal.stroke, text: pal.text };
}

interface RatingBadgeProps {
  rt: number | null | undefined;
  isMotm?: boolean;
  variant?: 'badge' | 'inline';
  size?: '2xs' | 'xs' | 'sm' | 'md';
  decimals?: 1 | 2;
  fixedWidth?: boolean;
  showStar?: boolean;
  tone?: 'auto' | 'dark';
  title?: string;
  className?: string;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({
  rt,
  isMotm = false,
  variant = 'badge',
  size = 'xs',
  decimals = 1,
  fixedWidth = false,
  showStar = false,
  tone = 'auto',
  title,
  className = ''
}) => {
  if (rt == null || !Number.isFinite(rt) || rt <= 0) {
    return (
      <span className={`text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)]/55 tabular ${className}`}>
        —
      </span>
    );
  }

  const pal = getRatingPalette(rt, isMotm);
  const valText = rt.toFixed(decimals);
  const resolvedTitle = title ?? `เรตติ้ง ${valText} · ${pal.label}`;

  if (variant === 'inline') {
    const sizeCls =
      size === '2xs'
        ? 'text-[10px] mland:text-[8.5px]'
        : size === 'sm'
          ? 'text-xs mland:text-[10px]'
          : size === 'md'
            ? 'text-[13px] mland:text-[11px]'
            : 'text-[11px] mland:text-[9.5px]';
    const colorCls = tone === 'dark' ? pal.darkTextCls : pal.textCls;
    return (
      <span
        title={resolvedTitle}
        className={`inline-flex items-center gap-0.5 font-extrabold tabular leading-none whitespace-nowrap shrink-0 ${colorCls} ${sizeCls} ${className}`}
      >
        {showStar && <span aria-hidden="true">⭐</span>}
        <span>{valText}</span>
      </span>
    );
  }

  const sizeCls = fixedWidth
    ? size === '2xs'
      ? `${decimals === 2 ? 'w-[38px] mland:w-[32px]' : 'w-[32px] mland:w-[27px]'} h-[16px] mland:h-[14px] px-0.5 rounded-[4.5px] text-[9.5px] mland:text-[8px]`
      : size === 'sm'
        ? `${decimals === 2 ? 'w-[44px] mland:w-[36px]' : 'w-[36px] mland:w-[30px]'} h-[20px] mland:h-[16px] px-1 rounded-md text-[11px] mland:text-[9px]`
        : size === 'md'
          ? `${decimals === 2 ? 'w-[48px] mland:w-[40px]' : 'w-[40px] mland:w-[34px]'} h-[22px] mland:h-[18px] px-1 rounded-md text-xs mland:text-[10px]`
          : `${decimals === 2 ? 'w-[40px] mland:w-[34px]' : 'w-[34px] mland:w-[29px]'} h-[18px] mland:h-[15px] px-0.5 rounded-[5px] text-[10px] mland:text-[8.5px]`
    : size === '2xs'
      ? 'h-[16px] mland:h-[14px] px-1.5 mland:px-1 rounded-[4.5px] text-[9.5px] mland:text-[8px]'
      : size === 'sm'
        ? 'h-[20px] mland:h-[16px] px-2 mland:px-1.5 rounded-md text-[11px] mland:text-[9px]'
        : size === 'md'
          ? 'h-[22px] mland:h-[18px] px-2 mland:px-1.5 rounded-md text-xs mland:text-[10px]'
          : 'h-[18px] mland:h-[15px] px-1.5 mland:px-1 rounded-[5px] text-[10px] mland:text-[8.5px]';

  return (
    <span
      title={resolvedTitle}
      className={`inline-flex items-center justify-center gap-0.5 border font-extrabold leading-none tabular select-none shrink-0 whitespace-nowrap ${pal.badgeCls} ${sizeCls} ${className}`}
    >
      {showStar && <span aria-hidden="true" className="text-[0.86em]">⭐</span>}
      <span>{valText}</span>
    </span>
  );
};
