import React from 'react';
import type { PreferredFoot } from '../types/game';
import type { PlayerBio } from '../engine/playerCore';

export interface FootColorMeta {
  foot: PreferredFoot;
  label: string;
  shortLabel: string;
  dotColor: string;
  badgeCls: string;
  darkBadgeCls: string;
  buttonActiveCls: string;
  titleText: string;
}

export function getFootColorMeta(foot: PreferredFoot): FootColorMeta {
  if (foot === 'L') {
    return {
      foot: 'L',
      label: 'เท้าซ้าย',
      shortLabel: 'ซ้าย',
      dotColor: '#8b5cf6',
      badgeCls: 'bg-violet-500/14 border-violet-500/45 text-violet-700 dark:text-violet-300',
      darkBadgeCls: 'bg-violet-500/22 border-violet-400/55 text-violet-200',
      buttonActiveCls: 'bg-violet-600 text-white border-violet-500 shadow-xs',
      titleText: 'ถนัดเท้าซ้าย'
    };
  }
  if (foot === 'B') {
    return {
      foot: 'B',
      label: 'สองข้าง',
      shortLabel: '2 ข้าง',
      dotColor: '#eab308',
      badgeCls: 'bg-amber-400/20 border-amber-400/60 text-[#8a5b00] dark:text-[#fde047]',
      darkBadgeCls: 'bg-amber-400/22 border-amber-300/60 text-[#fde047]',
      buttonActiveCls: 'bg-gradient-to-b from-[#fad05a] to-[#eab308] text-[#261900] border-[#ca8a04] shadow-xs',
      titleText: 'ถนัดทั้งสองเท้า'
    };
  }
  return {
    foot: 'R',
    label: 'เท้าขวา',
    shortLabel: 'ขวา',
    dotColor: '#0ea5e9',
    badgeCls: 'bg-sky-500/14 border-sky-500/45 text-sky-700 dark:text-sky-300',
    darkBadgeCls: 'bg-sky-500/22 border-sky-400/55 text-sky-200',
    buttonActiveCls: 'bg-sky-600 text-white border-sky-500 shadow-xs',
    titleText: 'ถนัดเท้าขวา'
  };
}

export const PlayerBioStrip: React.FC<{
  bio: PlayerBio;
  variant?: 'grid' | 'card' | 'inline';
  className?: string;
}> = ({ bio, variant = 'grid', className = '' }) => {
  const fm = getFootColorMeta(bio.foot);

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 tabular flex-wrap ${className}`}>
        <span
          className="px-1.5 py-[1px] rounded-md border bg-teal-500/10 border-teal-500/35 text-teal-700 dark:text-teal-300 text-[9.5px] mland:text-[8px] font-bold leading-tight"
          title={`ส่วนสูง ${bio.heightCm} ซม.`}
        >
          {bio.heightCm} ซม.
        </span>
        <span
          className="px-1.5 py-[1px] rounded-md border bg-emerald-500/10 border-emerald-500/35 text-emerald-700 dark:text-emerald-300 text-[9.5px] mland:text-[8px] font-bold leading-tight"
          title={`น้ำหนัก ${bio.weightKg} กก.`}
        >
          {bio.weightKg} กก.
        </span>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-[1px] rounded-md border text-[9.5px] mland:text-[8px] font-extrabold leading-tight ${fm.badgeCls}`}
          title={fm.titleText}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: fm.dotColor }} />
          <span>{fm.label}</span>
        </span>
      </span>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`grid grid-cols-3 gap-1 mland:gap-0.5 text-center ${className}`}>
        <div className="px-1 py-1 mland:py-0.5 rounded-lg bg-teal-500/15 border border-teal-400/35">
          <div className="text-[8px] mland:text-[6.5px] text-teal-200/80 font-semibold leading-none">ส่วนสูง</div>
          <div className="text-[10.5px] mland:text-[8.5px] font-extrabold text-teal-200 tabular mt-0.5 leading-none">
            {bio.heightCm} ซม.
          </div>
        </div>
        <div className="px-1 py-1 mland:py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-400/35">
          <div className="text-[8px] mland:text-[6.5px] text-emerald-200/80 font-semibold leading-none">น้ำหนัก</div>
          <div className="text-[10.5px] mland:text-[8.5px] font-extrabold text-emerald-200 tabular mt-0.5 leading-none">
            {bio.weightKg} กก.
          </div>
        </div>
        <div className={`px-1 py-1 mland:py-0.5 rounded-lg border ${fm.darkBadgeCls}`} title={fm.titleText}>
          <div className="text-[8px] mland:text-[6.5px] opacity-80 font-semibold leading-none">เท้าถนัด</div>
          <div className="text-[10.5px] mland:text-[8.5px] font-extrabold mt-0.5 leading-none inline-flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: fm.dotColor }} />
            <span>{fm.shortLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-1 text-center ${className}`}>
      <div
        className="py-1 px-1 mland:py-0.5 rounded-lg border bg-teal-500/10 border-teal-500/35"
        title={`ส่วนสูง ${bio.heightCm} เซนติเมตร (${bio.physiqueLabel})`}
      >
        <div className="text-[8.5px] mland:text-[7px] text-teal-700/80 dark:text-teal-300/80 font-bold leading-none">
          📏 สูง
        </div>
        <div className="text-[11px] mland:text-[9px] font-extrabold text-teal-700 dark:text-teal-300 tabular mt-0.5 leading-none">
          {bio.heightCm} ซม.
        </div>
      </div>
      <div
        className="py-1 px-1 mland:py-0.5 rounded-lg border bg-emerald-500/10 border-emerald-500/35"
        title={`น้ำหนัก ${bio.weightKg} กิโลกรัม`}
      >
        <div className="text-[8.5px] mland:text-[7px] text-emerald-700/80 dark:text-emerald-300/80 font-bold leading-none">
          ⚖️ หนัก
        </div>
        <div className="text-[11px] mland:text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300 tabular mt-0.5 leading-none">
          {bio.weightKg} กก.
        </div>
      </div>
      <div
        className={`py-1 px-1 mland:py-0.5 rounded-lg border ${fm.badgeCls}`}
        title={fm.titleText}
      >
        <div className="text-[8.5px] mland:text-[7px] opacity-85 font-bold leading-none">
          🦶 เท้าถนัด
        </div>
        <div className="text-[11px] mland:text-[9px] font-extrabold mt-0.5 leading-none inline-flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: fm.dotColor }} />
          <span>{fm.label}</span>
        </div>
      </div>
    </div>
  );
};
