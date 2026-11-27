import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { SFX } from '../utils/audioTheme';
import type { SortDir } from '../utils/playerSort';

interface SortableColHeaderProps {
  label: string;
  active: boolean;
  dir?: SortDir;
  onClick: () => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  title?: string;
}

export const SortableColHeader: React.FC<SortableColHeaderProps> = ({
  label,
  active,
  dir = 'desc',
  onClick,
  align = 'center',
  className = '',
  title
}) => {
  const alignCls =
    align === 'left'
      ? 'justify-start text-left'
      : align === 'right'
        ? 'justify-end text-right'
        : 'justify-center text-center';

  return (
    <button
      type="button"
      onClick={() => {
        SFX.tap();
        onClick();
      }}
      title={title || `กดเพื่อเรียงตาม${label}`}
      aria-pressed={active}
      className={`inline-flex items-center gap-0.5 whitespace-nowrap cursor-pointer select-none transition-colors rounded px-1 -mx-1 py-0.5 ${alignCls} ${
        active
          ? 'text-[var(--g)] font-extrabold bg-[var(--g-soft)]/70'
          : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)]/75'
      } ${className}`}
    >
      <span>{label}</span>
      {active ? (
        dir === 'asc' ? (
          <ArrowUp className="w-2.5 h-2.5 mland:w-2 mland:h-2 shrink-0" />
        ) : (
          <ArrowDown className="w-2.5 h-2.5 mland:w-2 mland:h-2 shrink-0" />
        )
      ) : (
        <ArrowUpDown className="w-2.5 h-2.5 mland:w-2 mland:h-2 shrink-0 opacity-45" />
      )}
    </button>
  );
};
