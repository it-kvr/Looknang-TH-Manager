import React from 'react';
import type { Position } from '../types/game';
import { LINE } from '../data/thaiFootballData';

export function resolvePositionLine(roleOrPos?: string | null): Position {
  const key = (roleOrPos || '').trim().toUpperCase();
  if (key === 'GK' || key === 'DF' || key === 'MF' || key === 'FW') {
    return key;
  }
  return LINE[key] || 'MF';
}

export function getPositionBadgeClass(roleOrPos?: string | null): string {
  const line = resolvePositionLine(roleOrPos);
  if (line === 'GK') return 'bg-green-600 text-white';
  if (line === 'DF') return 'bg-purple-600 text-white';
  if (line === 'MF') return 'bg-blue-600 text-white';
  return 'bg-red-600 text-white';
}

export function getPositionCanvasPalette(roleOrPos?: string | null): { bg: string; text: string } {
  const line = resolvePositionLine(roleOrPos);
  if (line === 'GK') return { bg: '#16a34a', text: '#ffffff' };
  if (line === 'DF') return { bg: '#9333ea', text: '#ffffff' };
  if (line === 'MF') return { bg: '#2563eb', text: '#ffffff' };
  return { bg: '#dc2626', text: '#ffffff' };
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
      ? 'w-[28px] mland:w-[24px] h-[14px] mland:h-[12px] px-0.5 rounded text-[8.5px] mland:text-[7.5px]'
      : size === 'sm'
        ? 'w-[36px] mland:w-[30px] h-[18px] mland:h-[15px] px-0.5 rounded-md text-[10px] mland:text-[8.5px]'
        : 'w-[32px] mland:w-[27px] h-[16px] mland:h-[14px] px-0.5 rounded text-[9px] mland:text-[8px]'
    : size === '2xs'
      ? 'h-[14px] mland:h-[12px] px-1 rounded text-[8.5px] mland:text-[7.5px]'
      : size === 'sm'
        ? 'h-[18px] mland:h-[15px] px-1.5 mland:px-1 rounded-md text-[10px] mland:text-[8.5px]'
        : 'h-[16px] mland:h-[14px] px-1 rounded text-[9px] mland:text-[8px]';

  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center font-extrabold leading-none shrink-0 tabular whitespace-nowrap ${sizeCls} ${getPositionBadgeClass(role)} ${className}`}
    >
      {role}
    </span>
  );
};
