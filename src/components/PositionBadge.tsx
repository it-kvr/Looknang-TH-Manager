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
  if (line === 'DF') return 'bg-orange-600 text-white';
  if (line === 'MF') return 'bg-blue-600 text-white';
  return 'bg-red-600 text-white';
}

export function getPositionCanvasPalette(roleOrPos?: string | null): { bg: string; text: string } {
  const line = resolvePositionLine(roleOrPos);
  if (line === 'GK') return { bg: '#16a34a', text: '#ffffff' };
  if (line === 'DF') return { bg: '#ea580c', text: '#ffffff' };
  if (line === 'MF') return { bg: '#2563eb', text: '#ffffff' };
  return { bg: '#dc2626', text: '#ffffff' };
}

export const PositionBadge: React.FC<{
  role: string;
  size?: '2xs' | 'xs' | 'sm';
  className?: string;
  title?: string;
}> = ({ role, size = 'xs', className = '', title }) => {
  const sizeCls =
    size === '2xs'
      ? 'px-1 py-[0.5px] rounded text-[8.5px] mland:text-[7.5px]'
      : size === 'sm'
        ? 'px-1.5 mland:px-1 py-0.5 rounded-md text-[10px] mland:text-[8.5px]'
        : 'px-1 py-[1px] rounded text-[9px] mland:text-[8px]';

  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center font-extrabold leading-tight shrink-0 tabular whitespace-nowrap ${sizeCls} ${getPositionBadgeClass(role)} ${className}`}
    >
      {role}
    </span>
  );
};
