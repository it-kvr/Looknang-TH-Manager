import React from 'react';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { SFX } from '../utils/audioTheme';

export interface QuickSortOption<T extends string> {
  value: T;
  label: string;
}

interface QuickSortSelectProps<T extends string> {
  value: T;
  onChange: (nextValue: T) => void;
  options: readonly QuickSortOption<T>[];
  defaultValue?: T;
  ariaLabel?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

export function QuickSortSelect<T extends string>({
  value,
  onChange,
  options,
  defaultValue,
  ariaLabel = 'เรียงด่วน',
  size = 'sm',
  className = ''
}: QuickSortSelectProps<T>) {
  const isCustomActive = defaultValue !== undefined && value !== defaultValue;
  const isXs = size === 'xs';

  return (
    <div
      className={`relative inline-flex items-center shrink-0 rounded-lg border transition-colors ${
        isCustomActive
          ? 'bg-[var(--g-soft)] border-[var(--g)]/55 text-[var(--g)]'
          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]/50'
      } ${className}`}
    >
      <ArrowUpDown
        className={`pointer-events-none shrink-0 ${
          isCustomActive ? 'text-[var(--g)]' : 'text-[var(--mut)]'
        } ${
          isXs
            ? 'w-2.5 h-2.5 ml-1.5 mland:w-2 mland:h-2 mland:ml-1'
            : 'w-3 h-3 ml-2 mland:w-2.5 mland:h-2.5 mland:ml-1.5'
        }`}
      />
      <select
        aria-label={ariaLabel}
        title={ariaLabel}
        value={value}
        onChange={(e) => {
          SFX.tap();
          onChange(e.target.value as T);
        }}
        className={`appearance-none bg-transparent font-bold cursor-pointer focus:outline-none truncate ${
          isXs
            ? 'pl-1 pr-4 py-[2px] mland:py-[1px] text-[10px] mland:text-[8.5px] max-w-[116px] mland:max-w-[96px]'
            : 'pl-1.5 pr-5 py-1 mland:py-0.5 text-[10.5px] sm:text-[11px] mland:text-[9px] max-w-[148px] mland:max-w-[118px]'
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[var(--surface)] text-[var(--ink)]">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 ${
          isCustomActive ? 'text-[var(--g)]' : 'text-[var(--mut)]'
        } ${isXs ? 'w-2.5 h-2.5 mland:right-1' : 'w-3 h-3 mland:w-2.5 mland:h-2.5 mland:right-1'}`}
      />
    </div>
  );
}
