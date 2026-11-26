import React from 'react';
import type { GameState, Team } from '../types/game';
import { awayOf, colDist, colLum, teamKits } from '../engine/playerCore';

export interface ClubCaptainPalette {
  bg: string;
  stripe: string;
  border: string;
  text: string;
}

export function getClubCaptainPalette(
  c1 = '#1c7a4a',
  c2 = '#f4c63d',
  c3 = ''
): ClubCaptainPalette {
  const bg = c1 || '#1c7a4a';
  const stripe = c2 && colDist(bg, c2) >= 115 ? c2 : awayOf(bg);
  const lumBg = colLum(bg);
  const lumStripe = colLum(stripe);
  const lumC3 = c3 ? colLum(c3) : -1;

  let text = lumBg > 0.56 ? '#0f172a' : '#ffffff';
  if (
    c3 &&
    colDist(bg, c3) >= 165 &&
    ((lumBg > 0.56 && lumC3 < 0.36) || (lumBg <= 0.56 && lumC3 > 0.52))
  ) {
    text = c3;
  } else if (
    colDist(bg, stripe) >= 165 &&
    ((lumBg > 0.56 && lumStripe < 0.36) || (lumBg <= 0.56 && lumStripe > 0.52))
  ) {
    text = stripe;
  }

  let border: string;
  if (lumBg > 0.72) {
    border = lumStripe < 0.65 ? stripe : 'rgba(15, 23, 42, 0.42)';
  } else if (lumBg < 0.16) {
    border = lumStripe > 0.35 ? stripe : 'rgba(255, 255, 255, 0.48)';
  } else {
    border = colDist(bg, stripe) >= 135 ? stripe : 'rgba(255, 255, 255, 0.42)';
  }

  return { bg, stripe, border, text };
}

export function resolveTeamCaptainPalette(
  team?: Team | null,
  state?: GameState | null
): ClubCaptainPalette {
  if (!team) {
    return getClubCaptainPalette('#1c7a4a', '#f4c63d');
  }
  const [c1, c2] = teamKits(team, state);
  const c3 =
    state?.mode === 'm' && state.club && team.id === state.me
      ? state.club.c3 || ''
      : '';
  return getClubCaptainPalette(c1, c2, c3);
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'w-[13px] h-[13px] mland:w-[11px] mland:h-[11px]',
  sm: 'w-[16px] h-[16px] mland:w-[13.5px] mland:h-[13.5px]',
  md: 'w-[20px] h-[20px] mland:w-[16px] mland:h-[16px]'
};

export const CaptainBadge: React.FC<{
  team?: Team | null;
  state?: GameState | null;
  c1?: string;
  c2?: string;
  c3?: string;
  size?: 'xs' | 'sm' | 'md';
  title?: string;
  className?: string;
}> = ({
  team,
  state,
  c1,
  c2,
  c3,
  size = 'sm',
  title = 'กัปตันทีม',
  className = ''
}) => {
  const pal = c1
    ? getClubCaptainPalette(c1, c2, c3)
    : resolveTeamCaptainPalette(team, state);

  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center shrink-0 align-middle select-none leading-none ${SIZE_CLASSES[size]} ${className}`}
    >
      <svg
        viewBox="0 0 16 16"
        className="w-full h-full block"
        aria-hidden="true"
      >
        <circle
          cx="8"
          cy="8"
          r="6.8"
          fill={pal.bg}
          stroke={pal.border}
          strokeWidth="1.25"
        />
        <text
          x="8"
          y="11.2"
          textAnchor="middle"
          fontSize="9.2"
          fontWeight="900"
          fontFamily="Sarabun, sans-serif"
          fill={pal.text}
        >
          C
        </text>
      </svg>
    </span>
  );
};
