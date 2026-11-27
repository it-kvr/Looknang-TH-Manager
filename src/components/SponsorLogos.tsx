import React from 'react';
import type { LiveStreamPlanId } from '../types/game';
import {
  SHIRT_SPONSOR_BRANDS,
  buildSponsorEmblemSvg,
  resolveMainSponsorBrand,
  type ShirtSponsorBrand
} from '../data/sponsorBrands';

interface LogoPalette {
  bg: string;
  fg: string;
  accent: string;
  abbr: string;
}

export const MainSponsorLogo: React.FC<{
  idx: number;
  brand?: ShirtSponsorBrand | null;
  sponsorSeed?: number;
  size?: number;
  className?: string;
}> = ({
  idx,
  brand,
  sponsorSeed,
  size = 32,
  className = ''
}) => {
  const uid = React.useId().replace(/:/g, '');
  const resolved =
    brand ||
    (sponsorSeed != null ? resolveMainSponsorBrand(idx, sponsorSeed) : null) ||
    SHIRT_SPONSOR_BRANDS[((idx % SHIRT_SPONSOR_BRANDS.length) + SHIRT_SPONSOR_BRANDS.length) % SHIRT_SPONSOR_BRANDS.length] ||
    SHIRT_SPONSOR_BRANDS[0];
  const shortTag = resolved.code.replace(/\s+/g, '').slice(0, 6);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={`shrink-0 rounded-lg shadow-2xs ${className}`}
    >
      <defs>
        <linearGradient id={`msp-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={resolved.badgeBg} />
          <stop offset="100%" stopColor="#090d16" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="8" fill={resolved.badgeBg} />
      <rect width="36" height="36" rx="8" fill={`url(#msp-${uid})`} opacity="0.45" />
      <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="7.25" fill="none" stroke={resolved.accent} strokeOpacity="0.55" strokeWidth="1" />
      <g
        transform="translate(8, 4.5) scale(1.25)"
        dangerouslySetInnerHTML={{ __html: buildSponsorEmblemSvg(resolved.motif, '#ffffff', resolved.accent) }}
      />
      <rect x="3.5" y="25.5" width="29" height="7.5" rx="2.5" fill="#000000" fillOpacity="0.48" />
      <text
        x="18"
        y="31"
        textAnchor="middle"
        fill="#ffffff"
        fontSize={shortTag.length >= 6 ? '5.3' : '6'}
        fontWeight="900"
        letterSpacing="0.35"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {shortTag}
      </text>
    </svg>
  );
};

const PARTNER_PALETTES: Record<string, LogoPalette> = {
  drink: { bg: '#0284c7', fg: '#ffffff', accent: '#bae6fd', abbr: 'H2O' },
  snack: { bg: '#ea580c', fg: '#ffffff', accent: '#fde047', abbr: 'TARO' },
  apparel: { bg: '#15803d', fg: '#ffffff', accent: '#bbf7d0', abbr: 'LNT' },
  tyre: { bg: '#27272a', fg: '#ffffff', accent: '#fb923c', abbr: 'SDM' },
  convenience: { bg: '#be123c', fg: '#ffffff', accent: '#fef08a', abbr: '24H' },
  ecom: { bg: '#d97706', fg: '#ffffff', accent: '#fef3c7', abbr: 'THM' },
  telecom: { bg: '#2563eb', fg: '#ffffff', accent: '#67e8f9', abbr: '5G+' },
  fintech: { bg: '#7c3aed', fg: '#ffffff', accent: '#a7f3d0', abbr: 'DPY' },
  airline: { bg: '#0369a1', fg: '#ffffff', accent: '#fcd34d', abbr: 'TWG' },
  asia_tech: { bg: '#0f172a', fg: '#ffffff', accent: '#10b981', abbr: 'APT' }
};

export const PartnerBrandLogo: React.FC<{ id: string; name?: string; size?: number; className?: string }> = ({
  id,
  name,
  size = 32,
  className = ''
}) => {
  const pal = PARTNER_PALETTES[id] || {
    bg: '#334155',
    fg: '#ffffff',
    accent: '#cbd5e1',
    abbr: (name || 'PT').slice(0, 2).toUpperCase()
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={`shrink-0 rounded-lg shadow-2xs ${className}`}
    >
      <rect width="36" height="36" rx="8" fill={pal.bg} />
      <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="7.25" fill="none" stroke={pal.accent} strokeOpacity="0.45" strokeWidth="1" />

      {id === 'drink' && (
        <>
          <path d="M18 7 C18 7 25.5 15.5 25.5 21 A7.5 7.5 0 0 1 10.5 21 C10.5 15.5 18 7 18 7 Z" fill={pal.accent} fillOpacity="0.28" stroke={pal.fg} strokeWidth="1.9" />
          <path d="M19 14 L15.5 20 H18.5 L17 25.5 L21 19.5 H18 Z" fill={pal.accent} />
        </>
      )}
      {id === 'snack' && (
        <>
          <path d="M9 24 Q13.5 12 18 18 T27 12" fill="none" stroke={pal.accent} strokeWidth="3" strokeLinecap="round" />
          <path d="M9 27 Q14 21 18 24 T27 20" fill="none" stroke={pal.fg} strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      {id === 'apparel' && (
        <>
          <path d="M9 13 L14 9 H22 L27 13 L24 17 L22 15.5 V27 H14 V15.5 L12 17 Z" fill="none" stroke={pal.fg} strokeWidth="2" strokeLinejoin="round" />
          <path d="M15 20 L21 17" stroke={pal.accent} strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {id === 'tyre' && (
        <>
          <circle cx="18" cy="18" r="10" fill="none" stroke={pal.fg} strokeWidth="3.2" strokeDasharray="4 2.2" />
          <circle cx="18" cy="18" r="4.5" fill="none" stroke={pal.accent} strokeWidth="2" />
          <circle cx="18" cy="18" r="1.8" fill={pal.accent} />
        </>
      )}
      {id === 'convenience' && (
        <>
          <rect x="7" y="10" width="22" height="16" rx="3" fill="none" stroke={pal.accent} strokeWidth="1.8" />
          <text x="18" y="21.5" textAnchor="middle" fill={pal.fg} fontSize="11" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
            24
          </text>
        </>
      )}
      {id === 'ecom' && (
        <>
          <path d="M13 13 V11 A5 5 0 0 1 23 11 V13" fill="none" stroke={pal.accent} strokeWidth="2" strokeLinecap="round" />
          <rect x="9" y="13" width="18" height="14" rx="2.5" fill="none" stroke={pal.fg} strokeWidth="2" />
          <path d="M14 20 L18 17 L22 20" fill="none" stroke={pal.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {id === 'telecom' && (
        <>
          <path d="M10 15 A11 11 0 0 1 26 15" fill="none" stroke={pal.accent} strokeWidth="2" strokeLinecap="round" />
          <path d="M13.5 18.5 A6.5 6.5 0 0 1 22.5 18.5" fill="none" stroke={pal.fg} strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="23.5" r="2.2" fill={pal.accent} />
          <path d="M15.5 28 L18 25 L20.5 28" fill="none" stroke={pal.fg} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {id === 'fintech' && (
        <>
          <rect x="7" y="10" width="22" height="16" rx="3" fill="none" stroke={pal.fg} strokeWidth="1.9" />
          <path d="M7 15 H29" stroke={pal.accent} strokeWidth="2.5" />
          <rect x="11" y="19.5" width="6" height="3.5" rx="1" fill={pal.accent} />
        </>
      )}
      {id === 'airline' && (
        <>
          <path d="M8 21 L27 11 L21 24 L17 20 L12 25 Z" fill={pal.fg} />
          <path d="M9 26.5 H26" stroke={pal.accent} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {id === 'asia_tech' && (
        <>
          <circle cx="18" cy="18" r="9.5" fill="none" stroke={pal.accent} strokeWidth="1.9" />
          <ellipse cx="18" cy="18" rx="4.5" ry="9.5" fill="none" stroke={pal.fg} strokeWidth="1.5" />
          <path d="M8.5 18 H27.5" stroke={pal.fg} strokeWidth="1.5" />
        </>
      )}
      {!PARTNER_PALETTES[id] && (
        <text x="18" y="22" textAnchor="middle" fill={pal.fg} fontSize="11" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {pal.abbr}
        </text>
      )}
    </svg>
  );
};

const TICKET_PALETTES: Record<string, LogoPalette> = {
  student: { bg: '#059669', fg: '#ffffff', accent: '#a7f3d0', abbr: '80฿' },
  budget: { bg: '#0d9488', fg: '#ffffff', accent: '#99f6e4', abbr: '120' },
  standard: { bg: '#2563eb', fg: '#ffffff', accent: '#bfdbfe', abbr: 'STD' },
  prime: { bg: '#0284c7', fg: '#ffffff', accent: '#fde047', abbr: 'PRM' },
  premium: { bg: '#7c3aed', fg: '#ffffff', accent: '#ddd6fe', abbr: 'CLB' },
  vip: { bg: '#b45309', fg: '#ffffff', accent: '#fde68a', abbr: 'VIP' },
  royal: { bg: '#881337', fg: '#ffffff', accent: '#fcd34d', abbr: 'RYL' }
};

export const TicketPlanLogo: React.FC<{ id: string; size?: number; className?: string }> = ({
  id,
  size = 30,
  className = ''
}) => {
  const pal = TICKET_PALETTES[id] || TICKET_PALETTES.standard;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={`shrink-0 rounded-lg shadow-2xs ${className}`}
    >
      <rect width="36" height="36" rx="8" fill={pal.bg} />
      <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="7.25" fill="none" stroke={pal.accent} strokeOpacity="0.45" strokeWidth="1" />

      {id === 'student' && (
        <>
          <path d="M7 15 L18 10 L29 15 L18 20 Z" fill="none" stroke={pal.fg} strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 18 V24 C12 25.5 14.8 27 18 27 C21.2 27 24 25.5 24 24 V18" fill="none" stroke={pal.accent} strokeWidth="1.9" strokeLinecap="round" />
          <path d="M27 16 V23" stroke={pal.accent} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {id === 'budget' && (
        <>
          <path d="M7 13 H29 V16.5 A2 2 0 0 0 29 20.5 V24 H7 V20.5 A2 2 0 0 0 7 16.5 Z" fill="none" stroke={pal.fg} strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M14 13 V24" stroke={pal.accent} strokeWidth="1.6" strokeDasharray="2 2" />
          <circle cx="22" cy="18.5" r="2.3" fill={pal.accent} />
        </>
      )}
      {id === 'standard' && (
        <>
          <rect x="7" y="11" width="22" height="14" rx="2.5" fill="none" stroke={pal.fg} strokeWidth="2" />
          <path d="M11 16 H25 M11 20 H19" stroke={pal.accent} strokeWidth="2" strokeLinecap="round" />
          <circle cx="23.5" cy="20" r="1.5" fill={pal.fg} />
        </>
      )}
      {id === 'prime' && (
        <>
          <path d="M7 16 L18 9 L29 16" fill="none" stroke={pal.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="9" y="16" width="18" height="10" rx="2" fill="none" stroke={pal.fg} strokeWidth="1.9" />
          <path d="M13 21 H23" stroke={pal.accent} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {id === 'premium' && (
        <>
          <polygon points="18,7 21,14 28,14.5 22.5,19.5 24.5,27 18,23 11.5,27 13.5,19.5 8,14.5 15,14" fill="none" stroke={pal.accent} strokeWidth="1.9" strokeLinejoin="round" />
          <circle cx="18" cy="18" r="2.2" fill={pal.fg} />
        </>
      )}
      {id === 'vip' && (
        <>
          <rect x="6.5" y="10" width="23" height="16" rx="3" fill="none" stroke={pal.accent} strokeWidth="1.8" />
          <text x="18" y="21.5" textAnchor="middle" fill={pal.fg} fontSize="10.5" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
            VIP
          </text>
        </>
      )}
      {id === 'royal' && (
        <>
          <path d="M8 24 L10 13 L15 18 L18 10 L21 18 L26 13 L28 24 Z" fill="none" stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 27 H27" stroke={pal.fg} strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      {!TICKET_PALETTES[id] && (
        <text x="18" y="22" textAnchor="middle" fill={pal.fg} fontSize="10.5" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {pal.abbr}
        </text>
      )}
    </svg>
  );
};

const BROADCAST_PALETTES: Record<LiveStreamPlanId | string, LogoPalette> = {
  off: { bg: '#475569', fg: '#ffffff', accent: '#cbd5e1', abbr: 'LTV' },
  basic: { bg: '#0f766e', fg: '#ffffff', accent: '#5eead4', abbr: 'THS' },
  pro: { bg: '#1d4ed8', fg: '#ffffff', accent: '#38bdf8', abbr: 'HD+' },
  studio: { bg: '#be123c', fg: '#ffffff', accent: '#fde047', abbr: 'MAX' }
};

export const BroadcastPlanLogo: React.FC<{ id: string; size?: number; className?: string }> = ({
  id,
  size = 30,
  className = ''
}) => {
  const pal = BROADCAST_PALETTES[id] || BROADCAST_PALETTES.basic;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={`shrink-0 rounded-lg shadow-2xs ${className}`}
    >
      <rect width="36" height="36" rx="8" fill={pal.bg} />
      <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="7.25" fill="none" stroke={pal.accent} strokeOpacity="0.45" strokeWidth="1" />

      {id === 'off' && (
        <>
          <rect x="7" y="10" width="22" height="15" rx="2.8" fill="none" stroke={pal.fg} strokeWidth="1.9" />
          <text x="18" y="20.5" textAnchor="middle" fill={pal.accent} fontSize="8.5" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
            LTV
          </text>
          <path d="M13 28 H23" stroke={pal.accent} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {id === 'basic' && (
        <>
          <circle cx="18" cy="18" r="9.5" fill="none" stroke={pal.accent} strokeWidth="1.8" />
          <path d="M15.5 13.5 L23 18 L15.5 22.5 Z" fill={pal.fg} />
        </>
      )}
      {id === 'pro' && (
        <>
          <rect x="6.5" y="10" width="23" height="16" rx="3" fill="none" stroke={pal.accent} strokeWidth="1.9" />
          <text x="18" y="21.5" textAnchor="middle" fill={pal.fg} fontSize="10" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
            HD+
          </text>
        </>
      )}
      {id === 'studio' && (
        <>
          <path d="M10 12 A11.5 11.5 0 0 1 26 12" fill="none" stroke={pal.accent} strokeWidth="1.9" strokeLinecap="round" />
          <circle cx="18" cy="19.5" r="5.5" fill="none" stroke={pal.fg} strokeWidth="2" />
          <path d="M16.5 17 L21 19.5 L16.5 22 Z" fill={pal.accent} />
          <circle cx="27" cy="26" r="2" fill={pal.accent} />
        </>
      )}
      {!BROADCAST_PALETTES[id] && (
        <text x="18" y="22" textAnchor="middle" fill={pal.fg} fontSize="10" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {pal.abbr}
        </text>
      )}
    </svg>
  );
};
