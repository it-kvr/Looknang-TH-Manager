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
      <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="7.25" fill="none" stroke={resolved.accent} strokeOpacity="0.58" strokeWidth="1" />
      <g
        transform="translate(6, 6) scale(1.5)"
        dangerouslySetInnerHTML={{ __html: buildSponsorEmblemSvg(resolved.motif, '#ffffff', resolved.accent) }}
      />
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

export interface BroadcastChannelBrandSpec {
  id: string;
  bg: string;
  bg2: string;
  accent: string;
  mark: string;
  motif: 'play' | 'shield' | 'bolt' | 'globe' | 'crown' | 'cup' | 'changsuek' | 'ring';
}

const CHANNEL_BRAND_SPECS: Record<string, BroadcastChannelBrandSpec> = {
  'BallThai Local Play': { id: 'ballthai_play', bg: '#0f766e', bg2: '#042f2e', accent: '#5eead4', mark: 'BT', motif: 'play' },
  'Siamball Stream TV': { id: 'siamball_tv', bg: '#0369a1', bg2: '#082f49', accent: '#7dd3fc', mark: 'SB', motif: 'ring' },
  'Thonburi Sports Net': { id: 'thonburi_net', bg: '#1e293b', bg2: '#090d16', accent: '#fbbf24', mark: 'TSN', motif: 'shield' },
  'BallThai Plus HD': { id: 'ballthai_plus', bg: '#1d4ed8', bg2: '#172554', accent: '#60a5fa', mark: 'BT+', motif: 'bolt' },
  'SiamFooty Network': { id: 'siamfooty_hd', bg: '#991b1b', bg2: '#450a0a', accent: '#fca5a5', mark: 'SF', motif: 'play' },
  'ThaiSport Channel 2': { id: 'thaisport_ch2', bg: '#6d28d9', bg2: '#2e1065', accent: '#c4b5fd', mark: 'TS2', motif: 'shield' },
  'SiamSport Prime HD': { id: 'siamsport_hd', bg: '#0f172a', bg2: '#020617', accent: '#facc15', mark: 'SS1', motif: 'crown' },
  'PrimeBall Thailand': { id: 'primeball_th', bg: '#312e81', bg2: '#1e1b4b', accent: '#38bdf8', mark: 'PB', motif: 'ring' },
  'ThaiPro TV1 Ultra': { id: 'thaipro_tv1', bg: '#065f46', bg2: '#022c22', accent: '#34d399', mark: 'TV1', motif: 'bolt' },
  'CupPlay Sports HD': { id: 'cupplay_hd', bg: '#92400e', bg2: '#451a03', accent: '#fde047', mark: 'CUP', motif: 'cup' },
  'SiamCup Live TV': { id: 'siamcup_tv', bg: '#be123c', bg2: '#4c0519', accent: '#fda4af', mark: 'SC', motif: 'cup' },
  'Thairath & Changsuek HD': { id: 'changsuek_hd', bg: '#1e3a8a', bg2: '#0f172a', accent: '#facc15', mark: 'TH', motif: 'changsuek' },
  'AsiaFootball Network HD': { id: 'asia_hd', bg: '#0c4a6e', bg2: '#082f49', accent: '#2dd4bf', mark: 'AFN', motif: 'globe' },
  'ThaiChampions Sports HD': { id: 'champions_hd', bg: '#27272a', bg2: '#09090b', accent: '#f59e0b', mark: 'TC', motif: 'crown' }
};

export function getBroadcastChannelBrandStyle(channelName?: string | null): BroadcastChannelBrandSpec {
  if (channelName && CHANNEL_BRAND_SPECS[channelName]) {
    return CHANNEL_BRAND_SPECS[channelName];
  }
  return {
    id: 'default_tv',
    bg: '#1e293b',
    bg2: '#090d16',
    accent: '#38bdf8',
    mark: (channelName || 'TV').slice(0, 2).toUpperCase(),
    motif: 'play'
  };
}

export const BroadcastChannelLogo: React.FC<{
  channel?: { name: string; short?: string } | null;
  size?: number;
  muted?: boolean;
  className?: string;
}> = ({ channel, size = 28, muted = false, className = '' }) => {
  const uid = React.useId().replace(/:/g, '');
  const spec = getBroadcastChannelBrandStyle(channel?.name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={`shrink-0 rounded-lg shadow-2xs ${muted ? 'opacity-70 saturate-75' : ''} ${className}`}
    >
      <defs>
        <linearGradient id={`bcl-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={spec.bg} />
          <stop offset="100%" stopColor={spec.bg2} />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="8.5" fill={`url(#bcl-${uid})`} />
      <rect
        x="0.8"
        y="0.8"
        width="34.4"
        height="34.4"
        rx="7.7"
        fill="none"
        stroke={spec.accent}
        strokeOpacity="0.58"
        strokeWidth="1"
      />
      <path d="M5 10 C12 4, 24 4, 31 10" fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.2" />

      {spec.motif === 'play' && (
        <>
          <circle cx="18" cy="18" r="10.5" fill="none" stroke={spec.accent} strokeOpacity="0.45" strokeWidth="1.5" />
          <path d="M14.5 12.2 L24.5 18 L14.5 23.8 Z" fill="#ffffff" />
          <circle cx="27" cy="9" r="2.1" fill={spec.accent} />
        </>
      )}

      {spec.motif === 'ring' && (
        <>
          <circle cx="18" cy="18" r="9.5" fill="none" stroke={spec.accent} strokeWidth="1.9" />
          <path d="M11 18 H25 M18 8.5 A12 12 0 0 1 18 27.5" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.4" />
          <circle cx="18" cy="18" r="3" fill={spec.accent} />
        </>
      )}

      {spec.motif === 'shield' && (
        <>
          <path
            d="M18 7 L27 10.5 V18 C27 23.8 23.2 27.6 18 29.5 C12.8 27.6 9 23.8 9 18 V10.5 Z"
            fill="#ffffff"
            fillOpacity="0.1"
            stroke={spec.accent}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <text x="18" y="21.5" textAnchor="middle" fill="#ffffff" fontSize="8.8" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
            {spec.mark}
          </text>
        </>
      )}

      {spec.motif === 'bolt' && (
        <>
          <rect x="6.5" y="9" width="23" height="18" rx="4" fill="none" stroke={spec.accent} strokeWidth="1.6" />
          <text x="18" y="21.2" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
            {spec.mark}
          </text>
          <circle cx="27.2" cy="11.8" r="1.8" fill={spec.accent} />
        </>
      )}

      {spec.motif === 'crown' && (
        <>
          <path d="M9.5 14 L13 9.5 L18 13 L23 9.5 L26.5 14 Z" fill={spec.accent} />
          <rect x="8.5" y="15.5" width="19" height="12" rx="3" fill="#ffffff" fillOpacity="0.12" stroke={spec.accent} strokeOpacity="0.75" strokeWidth="1.2" />
          <text x="18" y="24.2" textAnchor="middle" fill="#ffffff" fontSize="8.8" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
            {spec.mark}
          </text>
        </>
      )}

      {spec.motif === 'cup' && (
        <>
          <path d="M12 9.5 H24 V15.5 C24 19 21.3 21.5 18 21.5 C14.7 21.5 12 19 12 15.5 Z" fill={spec.accent} fillOpacity="0.24" stroke={spec.accent} strokeWidth="1.7" />
          <path d="M18 21.5 V25.5 M13.5 26.5 H22.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 11.5 H9.5 C9.5 14.5 10.5 16 12 16 M24 11.5 H26.5 C26.5 14.5 25.5 16 24 16" fill="none" stroke={spec.accent} strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}

      {spec.motif === 'changsuek' && (
        <>
          <path d="M8 10 H28 V14 H8 Z" fill="#dc2626" opacity="0.88" />
          <path d="M8 22 H28 V26 H8 Z" fill="#dc2626" opacity="0.88" />
          <path d="M8 14 H28 V22 H8 Z" fill="#f8fafc" opacity="0.94" />
          <rect x="11" y="15" width="14" height="6" rx="1.8" fill="#172554" />
          <text x="18" y="19.9" textAnchor="middle" fill={spec.accent} fontSize="5.4" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
            LIVE
          </text>
        </>
      )}

      {spec.motif === 'globe' && (
        <>
          <circle cx="18" cy="18" r="10" fill="none" stroke={spec.accent} strokeWidth="1.8" />
          <ellipse cx="18" cy="18" rx="4.5" ry="10" fill="none" stroke="#ffffff" strokeOpacity="0.78" strokeWidth="1.3" />
          <path d="M8.5 15 H27.5 M8.5 21 H27.5" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" />
        </>
      )}
    </svg>
  );
};

