import React from 'react';
import { StatIconBadge } from './StatIconBadge';
import { StaminaBar } from './StaminaBar';

export interface PlayerStatusBadgeProps {
  sus?: number;
  inj?: number;
  yc?: number;
  fit?: number;
  restThreshold?: number;
  variant?: 'cell' | 'pill';
  showYellow?: boolean;
  showStatusLabel?: boolean;
  className?: string;
}

export const PlayerStatusBadge: React.FC<PlayerStatusBadgeProps> = ({
  sus = 0,
  inj = 0,
  yc = 0,
  fit = 100,
  restThreshold = 65,
  variant = 'cell',
  showYellow = false,
  showStatusLabel = true,
  className = ''
}) => {
  const susN = Math.max(0, Math.round(sus || 0));
  const injN = Math.max(0, Math.round(inj || 0));
  const ycN = Math.max(0, Math.round(yc || 0));

  if (variant === 'pill') {
    if (susN > 0) {
      return (
        <span
          title={`ติดโทษแบน ${susN} นัด`}
          aria-label={`ติดโทษแบน ${susN} นัด`}
          className={`inline-flex items-center gap-1 mland:gap-0.5 h-[18px] mland:h-[15px] px-1.5 mland:px-1 rounded-md border bg-rose-500/14 border-rose-500/40 text-rose-700 dark:text-rose-300 text-[9.5px] mland:text-[8px] font-bold leading-none tabular whitespace-nowrap shrink-0 ${className}`}
        >
          <StatIconBadge kind="red" count={1} size="2xs" />
          <span>แบน {susN} นัด</span>
        </span>
      );
    }

    if (injN > 0) {
      return (
        <span
          title={`บาดเจ็บพัก ${injN} นัด`}
          aria-label={`บาดเจ็บพัก ${injN} นัด`}
          className={`inline-flex items-center gap-1 mland:gap-0.5 h-[18px] mland:h-[15px] px-1.5 mland:px-1 rounded-md border bg-red-500/12 border-red-500/38 text-red-700 dark:text-red-300 text-[9.5px] mland:text-[8px] font-bold leading-none tabular whitespace-nowrap shrink-0 ${className}`}
        >
          <StatIconBadge kind="injury" size="2xs" />
          <span>เจ็บ {injN} นัด</span>
        </span>
      );
    }

    if (showYellow && ycN > 0) {
      const nearBan = ycN >= 2;
      return (
        <span
          title={nearBan ? `สะสมใบเหลือง ${ycN}/3 (อีก 1 ใบโดนแบน!)` : `สะสมใบเหลือง ${ycN}/3`}
          className={`inline-flex items-center gap-1 mland:gap-0.5 h-[18px] mland:h-[15px] px-1.5 mland:px-1 rounded-md border text-[9.5px] mland:text-[8px] font-bold leading-none tabular whitespace-nowrap shrink-0 ${
            nearBan
              ? 'bg-amber-500/18 border-amber-500/50 text-amber-800 dark:text-amber-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
          } ${className}`}
        >
          <StatIconBadge kind="yellow" count={1} size="2xs" />
          <span>เหลือง {ycN}/3</span>
        </span>
      );
    }

    return null;
  }

  // variant === 'cell': neat fixed-height slot matching compact StaminaBar height in squad lists
  if (susN > 0) {
    return (
      <div
        title={`ติดโทษแบน ${susN} นัด`}
        aria-label={`ติดโทษแบน ${susN} นัด`}
        className={`w-full h-[20px] mland:h-[16px] px-1.5 mland:px-1 rounded-md border bg-rose-500/14 border-rose-500/42 text-rose-700 dark:text-rose-300 inline-flex items-center justify-center gap-1 mland:gap-0.5 text-[9px] mland:text-[7.5px] font-extrabold tracking-tight leading-none tabular whitespace-nowrap overflow-hidden select-none shadow-2xs ${className}`}
      >
        <StatIconBadge kind="red" count={1} size="2xs" />
        <span className="truncate">แบน {susN} นัด</span>
      </div>
    );
  }

  if (injN > 0) {
    return (
      <div
        title={`บาดเจ็บพัก ${injN} นัด`}
        aria-label={`บาดเจ็บพัก ${injN} นัด`}
        className={`w-full h-[20px] mland:h-[16px] px-1.5 mland:px-1 rounded-md border bg-red-500/12 border-red-500/40 text-red-700 dark:text-red-300 inline-flex items-center justify-center gap-1 mland:gap-0.5 text-[9px] mland:text-[7.5px] font-extrabold tracking-tight leading-none tabular whitespace-nowrap overflow-hidden select-none shadow-2xs ${className}`}
      >
        <StatIconBadge kind="injury" size="2xs" />
        <span className="truncate">เจ็บ {injN} นัด</span>
      </div>
    );
  }

  return (
    <StaminaBar
      value={fit}
      variant="compact"
      showStatusLabel={showStatusLabel}
      restThreshold={restThreshold}
      className={`w-full ${className}`}
    />
  );
};
