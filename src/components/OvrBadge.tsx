import React from 'react';
import { clamp } from '../utils/math';
import { statTierMeta } from '../engine/missions';

export type OvrBadgeVariant = 'badge' | 'card' | 'subtle' | 'inline';
export type OvrBadgeSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg';

interface OvrBadgeProps {
  ov: number;
  variant?: OvrBadgeVariant;
  size?: OvrBadgeSize;
  prefix?: string;
  fixedWidth?: boolean;
  tone?: 'dark' | 'light';
  title?: string;
  className?: string;
}

export interface OvrTierStyle {
  label: string;
  badgeCls: string;
  lightCardCls: string;
  darkCardCls: string;
}

export function getOvrTierStyle(v: number): OvrTierStyle {
  if (v >= 100) {
    return {
      label: 'ตำนานไร้ขีดจำกัด',
      badgeCls:
        'bg-gradient-to-b from-pink-500 to-rose-600 border-pink-300/65 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_4px_rgba(236,72,153,0.3)]',
      lightCardCls:
        'bg-gradient-to-b from-pink-100 to-rose-100 border-pink-400/75 text-pink-800',
      darkCardCls:
        'bg-gradient-to-b from-pink-500/30 to-rose-600/24 border-pink-300/60 text-pink-200 shadow-[0_0_10px_rgba(236,72,153,0.2)]'
    };
  }
  if (v >= 90) {
    return {
      label: 'ระดับโลก',
      badgeCls:
        'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 border-amber-200/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_1px_4px_rgba(245,158,11,0.3)]',
      lightCardCls:
        'bg-gradient-to-b from-amber-100 to-yellow-100 border-amber-400/80 text-amber-900',
      darkCardCls:
        'bg-gradient-to-b from-amber-500/30 to-yellow-600/24 border-amber-300/65 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
    };
  }
  if (v >= 80) {
    return {
      label: 'ตัวท็อป',
      badgeCls:
        'bg-gradient-to-b from-violet-500 to-purple-700 border-violet-300/55 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_1px_3px_rgba(124,58,237,0.25)]',
      lightCardCls:
        'bg-gradient-to-b from-violet-100 to-purple-100 border-violet-400/75 text-violet-900',
      darkCardCls:
        'bg-gradient-to-b from-violet-500/28 to-purple-600/22 border-violet-300/55 text-violet-200'
    };
  }
  if (v >= 70) {
    return {
      label: 'แกนหลัก',
      badgeCls:
        'bg-gradient-to-b from-emerald-500 to-emerald-700 border-emerald-300/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_1px_3px_rgba(16,185,129,0.22)]',
      lightCardCls:
        'bg-gradient-to-b from-emerald-100 to-teal-50 border-emerald-500/65 text-emerald-900',
      darkCardCls:
        'bg-gradient-to-b from-emerald-500/28 to-teal-600/22 border-emerald-300/55 text-emerald-200'
    };
  }
  if (v >= 60) {
    return {
      label: 'ตัวจริงลีก',
      badgeCls:
        'bg-gradient-to-b from-teal-500 to-teal-700 border-teal-300/45 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(20,184,166,0.2)]',
      lightCardCls:
        'bg-gradient-to-b from-teal-100 to-cyan-50 border-teal-500/60 text-teal-900',
      darkCardCls:
        'bg-gradient-to-b from-teal-500/26 to-cyan-600/20 border-teal-300/50 text-teal-200'
    };
  }
  if (v >= 50) {
    return {
      label: 'ระดับอาชีพ',
      badgeCls:
        'bg-gradient-to-b from-sky-500 to-sky-700 border-sky-300/45 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(14,165,233,0.18)]',
      lightCardCls:
        'bg-gradient-to-b from-sky-100 to-blue-50 border-sky-500/60 text-sky-900',
      darkCardCls:
        'bg-gradient-to-b from-sky-500/26 to-blue-600/20 border-sky-300/50 text-sky-200'
    };
  }
  if (v >= 40) {
    return {
      label: 'กำลังพัฒนา',
      badgeCls:
        'bg-gradient-to-b from-slate-500 to-slate-700 border-slate-300/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(15,23,42,0.18)]',
      lightCardCls:
        'bg-slate-200/90 border-slate-400/65 text-slate-800',
      darkCardCls:
        'bg-slate-400/20 border-slate-300/40 text-slate-200'
    };
  }
  return {
    label: 'เยาวชน',
    badgeCls:
      'bg-gradient-to-b from-slate-400 to-slate-600 border-slate-300/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]',
    lightCardCls:
      'bg-slate-200/75 border-slate-400/50 text-slate-700',
    darkCardCls:
      'bg-slate-400/15 border-slate-300/30 text-slate-300'
  };
}

export function getOvrCanvasPalette(v: number): { bg: string; stroke: string; text: string } {
  if (v >= 100) return { bg: '#db2777', stroke: '#fbcfe8', text: '#ffffff' };
  if (v >= 90) return { bg: '#d97706', stroke: '#fde68a', text: '#ffffff' };
  if (v >= 80) return { bg: '#7c3aed', stroke: '#ddd6fe', text: '#ffffff' };
  if (v >= 70) return { bg: '#059669', stroke: '#a7f3d0', text: '#ffffff' };
  if (v >= 60) return { bg: '#0d9488', stroke: '#99f6e4', text: '#ffffff' };
  if (v >= 50) return { bg: '#0284c7', stroke: '#bae6fd', text: '#ffffff' };
  if (v >= 40) return { bg: '#475569', stroke: '#cbd5e1', text: '#ffffff' };
  return { bg: '#64748b', stroke: '#e2e8f0', text: '#ffffff' };
}

export const OvrBadge: React.FC<OvrBadgeProps> = ({
  ov,
  variant = 'badge',
  size = 'sm',
  prefix,
  fixedWidth = true,
  tone = 'dark',
  title,
  className = ''
}) => {
  const val = clamp(Math.round(ov || 0), 1, 199);
  const styleMeta = getOvrTierStyle(val);
  const tierMeta = statTierMeta(val);
  const resolvedTitle = title || `ค่าพลังรวม ${val} · ${styleMeta.label}`;

  if (variant === 'inline') {
    const sizeCls =
      size === '2xs'
        ? 'text-[10px] mland:text-[8.5px]'
        : size === 'xs'
          ? 'text-[10.5px] mland:text-[9px]'
          : size === 'md'
            ? 'text-xs sm:text-[13px] mland:text-[10.5px]'
            : size === 'lg'
              ? 'text-sm mland:text-xs'
              : 'text-[11px] mland:text-[9.5px]';
    return (
      <span
        title={resolvedTitle}
        className={`inline-flex items-baseline gap-0.5 font-display font-extrabold tabular leading-none whitespace-nowrap shrink-0 ${tierMeta.textClass} ${sizeCls} ${className}`}
      >
        {prefix && <span className="text-[0.76em] opacity-80 font-bold tracking-wider">{prefix}</span>}
        <span>{val}</span>
      </span>
    );
  }

  if (variant === 'card') {
    const isLight = tone === 'light';
    return (
      <span
        title={resolvedTitle}
        className={`inline-flex items-center justify-center gap-0.5 px-1.5 py-[2px] mland:px-1 mland:py-[1px] rounded-md border font-display font-extrabold text-[15px] sm:text-[16px] mland:text-[11.5px] leading-none tracking-tight tabular select-none shrink-0 ${
          isLight ? styleMeta.lightCardCls : styleMeta.darkCardCls
        } ${className}`}
      >
        {prefix && <span className="text-[0.58em] opacity-80 font-bold tracking-wider">{prefix}</span>}
        <span>{val}</span>
      </span>
    );
  }

  if (variant === 'subtle') {
    const sizeCls =
      size === '2xs'
        ? `${prefix || !fixedWidth ? 'px-1.5 mland:px-1' : 'w-[25px] mland:w-[22px] px-0.5'} h-[18px] mland:h-[15px] rounded-[5px] text-[10px] mland:text-[8.5px]`
        : size === 'xs'
          ? `${prefix || !fixedWidth ? 'px-1.5 mland:px-1' : 'w-[29px] mland:w-[25px] px-0.5'} h-[20px] mland:h-[17px] rounded-md text-[10.5px] mland:text-[9px]`
          : size === 'md'
            ? `${prefix || !fixedWidth ? 'px-2.5 mland:px-2' : 'w-[36px] mland:w-[30px] px-1'} h-[26px] mland:h-[21px] rounded-lg text-xs sm:text-[13px] mland:text-[10.5px]`
            : size === 'lg'
              ? `${prefix || !fixedWidth ? 'px-3 mland:px-2' : 'w-[42px] mland:w-[34px] px-1'} h-[30px] mland:h-[24px] rounded-xl text-sm mland:text-xs`
              : `${prefix || !fixedWidth ? 'px-2 mland:px-1.5' : 'w-[33px] mland:w-[28px] px-1'} h-[22px] mland:h-[18px] rounded-lg text-[11.5px] mland:text-[9.5px]`;
    return (
      <span
        title={resolvedTitle}
        className={`inline-flex items-center justify-center gap-0.5 border font-display font-extrabold leading-none tabular select-none shrink-0 whitespace-nowrap ${tierMeta.badgeClass} ${sizeCls} ${className}`}
      >
        {prefix && <span className="text-[0.72em] opacity-85 font-bold tracking-wider">{prefix}</span>}
        <span>{val}</span>
      </span>
    );
  }

  // Default: 'badge' — sleek gradient tier badge consistent everywhere
  const badgeSizeCls =
    size === '2xs'
      ? `${prefix || !fixedWidth ? 'px-1.5 mland:px-1' : 'w-[25px] mland:w-[22px] px-0.5'} h-[18px] mland:h-[15px] rounded-[5px] text-[10px] mland:text-[8.5px]`
      : size === 'xs'
        ? `${prefix || !fixedWidth ? 'px-1.5 mland:px-1' : 'w-[29px] mland:w-[25px] px-0.5'} h-[20px] mland:h-[17px] rounded-md text-[10.5px] mland:text-[9px]`
        : size === 'md'
          ? `${prefix || !fixedWidth ? 'px-2.5 mland:px-2' : 'w-[36px] mland:w-[30px] px-1'} h-[26px] mland:h-[21px] rounded-lg text-xs sm:text-[13px] mland:text-[10.5px]`
          : size === 'lg'
            ? `${prefix || !fixedWidth ? 'px-3 mland:px-2' : 'w-[42px] mland:w-[34px] px-1'} h-[30px] mland:h-[24px] rounded-xl text-sm mland:text-xs`
            : `${prefix || !fixedWidth ? 'px-2 mland:px-1.5' : 'w-[33px] mland:w-[28px] px-1'} h-[22px] mland:h-[18px] rounded-lg text-[11.5px] mland:text-[9.5px]`;

  return (
    <span
      title={resolvedTitle}
      className={`inline-flex items-center justify-center gap-0.5 border font-display font-extrabold leading-none tabular select-none shrink-0 whitespace-nowrap ${styleMeta.badgeCls} ${badgeSizeCls} ${className}`}
    >
      {prefix && <span className="text-[0.7em] opacity-90 font-bold tracking-wider">{prefix}</span>}
      <span>{val}</span>
    </span>
  );
};
