import React from 'react';

interface MyTeamBadgeProps {
  size?: '2xs' | 'xs' | 'sm' | 'md';
  title?: string;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<MyTeamBadgeProps['size']>, string> = {
  '2xs': 'w-3 h-3 mland:w-2.5 mland:h-2.5 text-[7px] mland:text-[6px]',
  xs: 'w-3.5 h-3.5 mland:w-2.5 mland:h-2.5 text-[8px] mland:text-[6.5px]',
  sm: 'w-3.5 h-3.5 mland:w-2.5 mland:h-2.5 text-[8.5px] mland:text-[6.5px]',
  md: 'w-4 h-4 mland:w-3 mland:h-3 text-[9.5px] mland:text-[7.5px]'
};

export const MyTeamBadge: React.FC<MyTeamBadgeProps> = ({
  size = 'sm',
  title = 'ทีมของคุณ',
  className = ''
}) => (
  <span
    title={title}
    aria-label={title}
    className={`inline-flex items-center justify-center rounded-full bg-[var(--lamp)] text-[#261900] font-black leading-none shrink-0 ${SIZE_CLASSES[size]} ${className}`}
  >
    ★
  </span>
);
