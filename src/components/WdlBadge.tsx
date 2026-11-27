import React from 'react';

export type WdlKind = 'W' | 'D' | 'L';

export function getWdlBadgeClass(kind: WdlKind): string {
  if (kind === 'W') return 'bg-emerald-600 text-white border border-black';
  if (kind === 'D') return 'bg-amber-400 text-black border border-black';
  return 'bg-red-600 text-white border border-black';
}

export const WdlCharBadge: React.FC<{
  kind: WdlKind;
  size?: '2xs' | 'xs' | 'sm';
  title?: string;
  className?: string;
}> = ({ kind, size = 'xs', title, className = '' }) => {
  const sizeCls =
    size === '2xs'
      ? 'w-3.5 h-3.5 mland:w-3 mland:h-3 rounded-[4px] text-[8px] mland:text-[7px]'
      : size === 'sm'
        ? 'w-[18px] h-[18px] mland:w-4 mland:h-4 rounded-[4px] text-[10px] mland:text-[8.5px]'
        : 'w-4 h-4 mland:w-3.5 mland:h-3.5 rounded-[4px] text-[9px] mland:text-[7.5px]';

  const label = title ?? (kind === 'W' ? 'ชนะ (W)' : kind === 'D' ? 'เสมอ (D)' : 'แพ้ (L)');

  return (
    <span
      title={label}
      className={`inline-flex items-center justify-center font-black leading-none shrink-0 select-none ${sizeCls} ${getWdlBadgeClass(kind)} ${className}`}
    >
      {kind}
    </span>
  );
};

export const WdlFormStrip: React.FC<{
  fm?: string;
  size?: '2xs' | 'xs' | 'sm';
  emptyText?: string;
  className?: string;
}> = ({ fm, size = 'xs', emptyText = '—', className = '' }) => {
  const chars = (fm || '')
    .slice(-5)
    .split('')
    .filter((c): c is WdlKind => c === 'W' || c === 'D' || c === 'L');
  if (!chars.length) {
    return <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">{emptyText}</span>;
  }
  const thaiForm = chars.map((c) => (c === 'W' ? 'ชนะ' : c === 'D' ? 'เสมอ' : 'แพ้')).join(' · ');
  return (
    <span className={`inline-flex items-center gap-0.5 shrink-0 ${className}`} title={`ฟอร์ม 5 นัดล่าสุด: ${thaiForm}`}>
      {chars.map((c, idx) => (
        <WdlCharBadge key={idx} kind={c} size={size} />
      ))}
    </span>
  );
};

export const WdlRecordBadges: React.FC<{
  w: number;
  d: number;
  l: number;
  size?: '2xs' | 'xs' | 'sm';
  countClassName?: string;
  className?: string;
}> = ({ w, d, l, size = '2xs', countClassName = 'text-[var(--ink)]', className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 tabular shrink-0 ${className}`}>
    <span className="inline-flex items-center gap-[3px]">
      <WdlCharBadge kind="W" size={size} />
      <span className={`font-extrabold leading-none ${countClassName}`}>{w}</span>
    </span>
    <span className="inline-flex items-center gap-[3px]">
      <WdlCharBadge kind="D" size={size} />
      <span className={`font-extrabold leading-none ${countClassName}`}>{d}</span>
    </span>
    <span className="inline-flex items-center gap-[3px]">
      <WdlCharBadge kind="L" size={size} />
      <span className={`font-extrabold leading-none ${countClassName}`}>{l}</span>
    </span>
  </span>
);
