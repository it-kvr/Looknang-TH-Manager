import React from 'react';
import type { Position } from '../types/game';
import { LINE, SPN } from '../data/thaiFootballData';

export function resolvePositionLine(roleOrPos?: string | null): Position {
  const key = (roleOrPos || '').trim().toUpperCase();
  if (key === 'GK' || key === 'DF' || key === 'MF' || key === 'FW') {
    return key;
  }
  return LINE[key] || 'MF';
}

export function getPositionBadgeClass(roleOrPos?: string | null): string {
  const line = resolvePositionLine(roleOrPos);
  if (line === 'GK') return 'bg-green-600 text-white border border-black';
  if (line === 'DF') return 'bg-purple-600 text-white border border-black';
  if (line === 'MF') return 'bg-blue-600 text-white border border-black';
  return 'bg-red-600 text-white border border-black';
}

export function getPositionCanvasPalette(roleOrPos?: string | null): { bg: string; text: string; stroke: string } {
  const line = resolvePositionLine(roleOrPos);
  if (line === 'GK') return { bg: '#16a34a', text: '#ffffff', stroke: '#000000' };
  if (line === 'DF') return { bg: '#9333ea', text: '#ffffff', stroke: '#000000' };
  if (line === 'MF') return { bg: '#2563eb', text: '#ffffff', stroke: '#000000' };
  return { bg: '#dc2626', text: '#ffffff', stroke: '#000000' };
}

export const PositionBadge: React.FC<{
  role: string;
  size?: '2xs' | 'xs' | 'sm';
  fixedWidth?: boolean;
  className?: string;
  title?: string;
}> = ({ role, size = 'xs', fixedWidth = true, className = '', title }) => {
  const sizeCls = fixedWidth
    ? size === '2xs'
      ? 'w-[28px] mland:w-[25px] h-[14px] mland:h-[12.5px] px-[2px] rounded-[4px] text-[8px] mland:text-[7px] tracking-tight'
      : size === 'sm'
        ? 'w-[36px] mland:w-[31px] h-[18px] mland:h-[15.5px] px-1 rounded-[5px] text-[10px] mland:text-[8.5px] tracking-tight'
        : 'w-[32px] mland:w-[28px] h-[16px] mland:h-[14px] px-[2px] rounded-[4px] text-[9px] mland:text-[7.5px] tracking-tight'
    : size === '2xs'
      ? 'h-[14px] mland:h-[12.5px] min-w-[22px] px-1 rounded-[4px] text-[8px] mland:text-[7px] tracking-tight'
      : size === 'sm'
        ? 'h-[18px] mland:h-[15.5px] min-w-[28px] px-1.5 mland:px-1 rounded-[5px] text-[10px] mland:text-[8.5px] tracking-tight'
        : 'h-[16px] mland:h-[14px] min-w-[25px] px-1 rounded-[4px] text-[9px] mland:text-[7.5px] tracking-tight';

  const resolvedTitle = title ?? SPN[role] ?? role;

  return (
    <span
      title={resolvedTitle}
      className={`inline-flex items-center justify-center font-extrabold leading-none shrink-0 tabular whitespace-nowrap select-none shadow-[0_1px_0_rgba(0,0,0,0.28)] ${sizeCls} ${getPositionBadgeClass(role)} ${className}`}
    >
      {role}
    </span>
  );
};
