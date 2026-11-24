import React from 'react';
import type { Position, SubRole, Player, Team, ClubIdentity, PlayerCareerProfile, GameState, PitchPositionZone, PitchDragPreview } from '../types/game';
import { clamp } from '../utils/math';
import { CREST_SHAPES, CREST_PATTERNS, CREST_IC, KIT_PATTERNS } from '../data/crestAndKitData';
import { PCOL, SKIN_P, HAIR_P } from '../data/thaiFootballData';
import { getShirtNo, visOf, getFormationSlots, pen, xi, colLum, colDist, tc, pickGK } from '../engine/playerCore';

export const renderCrestPattern = (pat: number, uid: string, c1: string, c2: string) => (
  <>
    <rect width="24" height="24" fill={pat === 9 ? `url(#cg-${uid})` : pat === 19 ? `url(#cr-${uid})` : c1} />
    {pat === 0 && <rect y="7" width="24" height="5" fill={c2} />}
    {pat === 1 && <rect x="12" width="12" height="24" fill={c2} />}
    {pat === 2 && <path d="M0 24L24 0v8L8 24z" fill={c2} />}
    {pat === 3 && (
      <>
        <rect y="5" width="24" height="3" fill={c2} />
        <rect y="11" width="24" height="3" fill={c2} />
      </>
    )}
    {pat === 4 && [0, 1, 2, 3].map((i) => <rect key={i} x={i * 6 + 1.5} width="2.8" height="24" fill={c2} />)}
    {pat === 5 && (
      <>
        <rect x="12" y="0" width="12" height="12" fill={c2} />
        <rect x="0" y="12" width="12" height="12" fill={c2} />
      </>
    )}
    {pat === 6 && <path d="M0 6l12 9 12-9v5l-12 9-12-9z" fill={c2} />}
    {pat === 7 && (
      <>
        <rect x="9.5" y="0" width="5" height="24" fill={c2} />
        <rect x="0" y="9.5" width="24" height="5" fill={c2} />
      </>
    )}
    {pat === 8 && <circle cx="12" cy="12" r="7.5" fill="none" stroke={c2} strokeWidth="2.4" />}
    {pat === 10 && <rect y="12" width="24" height="12" fill={c2} />}
    {pat === 11 &&
      [0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((col) => ((r + col) % 2 === 1 ? <rect key={`${r}-${col}`} x={col * 6} y={r * 6} width="6" height="6" fill={c2} /> : null))
      )}
    {pat === 12 && <path d="M12 2.5L21.5 12 12 21.5 2.5 12z" fill={c2} />}
    {pat === 13 && (
      <>
        <path d="M-1 2L2 -1 25 22 22 25z" fill={c2} />
        <path d="M22 -1L25 2 2 25 -1 22z" fill={c2} />
      </>
    )}
    {pat === 14 && (
      <>
        <path d="M12 12L8 0h8zM12 12l12-4v8zM12 12l4 12H8zM12 12L0 16V8z" fill={c2} />
        <path d="M12 12L21 0h3v3zM12 12l12 9v3h-3zM12 12L3 24H0v-3zM12 12L0 3V0h3z" fill={c2} opacity="0.65" />
      </>
    )}
    {pat === 15 && <path d="M0 0h24L12 14z" fill={c2} />}
    {pat === 16 && (
      <>
        <path d="M-2 17L17 -2h5L-2 22z" fill={c2} />
        <path d="M4 26L26 4v5L9 26z" fill={c2} />
      </>
    )}
    {pat === 17 && <rect x="8.5" y="0" width="7" height="24" fill={c2} />}
    {pat === 18 &&
      [-12, -4, 4, 12, 20].map((off) => (
        <path key={off} d={`M${off} 24L${off + 24} 0h3.5L${off + 3.5} 24z`} fill={c2} />
      ))}
  </>
);

export const ClubCrest: React.FC<{
  name: string;
  size?: number;
  team?: Team | null;
  club?: ClubIdentity | null;
  isMyClub?: boolean;
}> = ({ name, size = 24, team, club, isMyClub }) => {
  const uid = React.useId().replace(/:/g, '');
  const h = ([...(name || 'T')].reduce((a, c, idx) => a + c.charCodeAt(0) * (idx + 3), 0) * 37) >>> 0;
  const k = isMyClub && club ? club : null;
  const kp = team?.kc;
  const c1 = k ? k.c1 : kp ? kp[0] : `hsl(${h % 360} 55% 38%)`;
  const c2 = k ? k.c2 : kp ? kp[1] : `hsl(${h % 360} 70% 70%)`;
  const c3 = k?.c3 || '#f4c63d';
  const sh = (k ? k.shape : h % CREST_SHAPES.length) % CREST_SHAPES.length;
  const d = CREST_SHAPES[sh]?.d || CREST_SHAPES[0].d;
  const pat = (k ? k.pat : (h >> 4) % CREST_PATTERNS.length) % CREST_PATTERNS.length;
  const icKeys = Object.keys(CREST_IC);
  const ic = k?.icon && CREST_IC[k.icon] ? k.icon : icKeys[h % icKeys.length];
  const borderStyle = k?.crestBorder ?? 0;
  const strokeCol = borderStyle === 1 ? '#f4c63d' : borderStyle === 3 ? '#0f172a' : '#ffffff';
  const stars = clamp(k?.stars || 0, 0, 3);

  const centerLum = pat !== 8 ? colLum(c1) * 0.52 + colLum(c2) * 0.48 : colLum(c1);
  const icCol = k?.iconColor ? k.iconColor : centerLum > 0.54 ? '#0f172a' : '#ffffff';
  const haloCol = colLum(icCol) > 0.52 ? 'rgba(9, 20, 15, 0.82)' : 'rgba(255, 255, 255, 0.92)';
  const icTransform = `translate(5.2 ${stars > 0 ? 6.0 : 5.2}) scale(.57)`;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <defs>
        <clipPath id={`cp-${uid}`}>
          <path d={d} />
        </clipPath>
        {pat === 9 && (
          <linearGradient id={`cg-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        )}
        {pat === 19 && (
          <radialGradient id={`cr-${uid}`} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={c2} />
            <stop offset="100%" stopColor={c1} />
          </radialGradient>
        )}
      </defs>
      <g clipPath={`url(#cp-${uid})`}>
        {renderCrestPattern(pat, uid, c1, c2)}
        {k?.c3 && pat !== 8 && <path d={d} fill="none" stroke={c3} strokeWidth="2.2" opacity="0.6" />}
      </g>
      <path d={d} fill="none" stroke={strokeCol} strokeWidth={borderStyle === 2 ? '2' : '1.5'} />
      {borderStyle === 2 && <path d={d} fill="none" stroke={c3} strokeWidth="0.7" opacity="0.9" />}
      {stars > 0 &&
        Array.from({ length: stars }).map((_, idx) => {
          const sx = 12 + (idx - (stars - 1) / 2) * 4.5;
          return <circle key={idx} cx={sx} cy="2.6" r="1.25" fill="#facc15" stroke="#1e293b" strokeWidth="0.35" />;
        })}
      <g
        transform={icTransform}
        fill="none"
        stroke={haloCol}
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: CREST_IC[ic] }}
      />
      <g
        transform={icTransform}
        fill="none"
        stroke={icCol}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: CREST_IC[ic] }}
      />
    </svg>
  );
};

export const KitJersey: React.FC<{ club: ClubIdentity; away?: boolean; size?: number; team?: Team | null; hideNumber?: boolean }> = ({
  club,
  away = false,
  size = 84,
  team = null,
  hideNumber = false
}) => {
  const uid = React.useId().replace(/:/g, '');
  const c = away ? club.c2 : club.c1;
  const d = away ? club.c1 : club.c2;
  const accent = club.c3 || (colDist(d, '#ffffff') < 100 ? '#f4c63d' : '#ffffff');
  const p = ((away && club.awayKit != null ? club.awayKit : club.kit) || 0) % KIT_PATTERNS.length;
  const collar = (club.collar ?? 0) % 4;
  const cuffTrim = club.cuffTrim ?? true;
  const J = 'M30 10l-22 14 8 18 10-5v48h48V37l10 5 8-18-22-14c-4 8-10 10-20 10s-16-2-20-10z';
  const numLightBg = colDist(c, '#ffffff') < 130 && [0, 5, 6, 10, 12, 13].includes(p);
  const numFill = numLightBg ? '#111827' : p === 4 || p === 5 || p === 8 || p === 9 || p === 11 ? '#ffffff' : d;

  return (
    <svg width={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={`kc-${uid}`}>
          <path d={J} />
        </clipPath>
        {p === 11 && (
          <linearGradient id={`kg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={d} />
          </linearGradient>
        )}
      </defs>
      <g clipPath={`url(#kc-${uid})`}>
        <rect width="100" height="100" fill={p === 11 ? `url(#kg-${uid})` : c} />
        {p === 1 && [0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={i * 14} width="7" height="100" fill={d} />)}
        {p === 2 && [0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} y={i * 16} width="100" height="8" fill={d} />)}
        {p === 3 && <rect x="50" width="50" height="100" fill={d} />}
        {p === 4 && (
          <>
            <path d="M8 100L70 0h22L30 100z" fill={d} />
            <path d="M5 100L67 0h3L8 100z" fill={accent} opacity="0.85" />
          </>
        )}
        {p === 5 && (
          <>
            <rect y="36" width="100" height="18" fill={d} />
            <rect y="34" width="100" height="2" fill={accent} />
            <rect y="54" width="100" height="2" fill={accent} />
          </>
        )}
        {p === 6 && (
          <>
            <path d="M18 22l32 22 32-22v14L50 58 18 36z" fill={d} />
            <path d="M18 36l32 22 32-22v4L50 62 18 40z" fill={accent} />
          </>
        )}
        {p === 7 &&
          [0, 1, 2, 3, 4, 5].flatMap((row) =>
            [0, 1, 2, 3, 4, 5].map((col) =>
              (row + col) % 2 === 0 ? (
                <rect key={`${row}-${col}`} x={col * 17} y={row * 17} width="17" height="17" fill={d} />
              ) : null
            )
          )}
        {p === 8 && (
          <>
            <rect x="50" y="0" width="50" height="46" fill={d} />
            <rect x="0" y="46" width="50" height="54" fill={d} />
          </>
        )}
        {p === 9 && (
          <>
            <rect x="42" y="0" width="16" height="100" fill={d} />
            <rect x="0" y="38" width="100" height="15" fill={d} />
          </>
        )}
        {p === 10 && (
          <>
            <rect x="0" y="0" width="27" height="50" fill={d} />
            <rect x="73" y="0" width="27" height="50" fill={d} />
            <rect x="25" y="10" width="2.5" height="35" fill={accent} />
            <rect x="72.5" y="10" width="2.5" height="35" fill={accent} />
          </>
        )}
        {p === 12 && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={i * 12 + 4} width="2.2" height="100" fill={d} opacity="0.9" />)}
        {p === 13 && (
          <>
            <path d="M0 32l24-12 20 14 22-14 34 16v13L66 33 44 47 24 33 0 45z" fill={d} opacity="0.92" />
            <path d="M0 54l24-12 20 14 22-14 34 16v7L66 49 44 63 24 49 0 61z" fill={accent} opacity="0.8" />
          </>
        )}

        {/* Cuff & Hem Trim */}
        {cuffTrim && (
          <>
            <path d="M8 24l10 18 4-2-10-18z" fill={accent} opacity="0.92" />
            <path d="M92 24L82 42l-4-2 10-18z" fill={accent} opacity="0.92" />
            <rect x="24" y="81" width="52" height="5" fill={d} opacity="0.85" />
          </>
        )}

        {/* Collar Styles */}
        {collar === 0 && <path d="M30 10c4 9 10 11 20 11s16-2 20-11" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />}
        {collar === 1 && <path d="M30 10l20 17 20-17" fill="none" stroke={accent} strokeWidth="4" strokeLinejoin="round" />}
        {collar === 2 && (
          <>
            <path d="M30 10l12 12 8-4 8 4 12-12z" fill={d} stroke={accent} strokeWidth="1.5" />
            <line x1="50" y1="18" x2="50" y2="29" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
        {collar === 3 && (
          <>
            <path d="M30 10c4 9 10 11 20 11s16-2 20-11" fill="none" stroke={d} strokeWidth="5.5" />
            <path d="M32 11c4 7 9 9 18 9s14-2 18-9" fill="none" stroke={accent} strokeWidth="2" />
          </>
        )}
      </g>

      <path d={J} fill="none" stroke="#0e2b1f" strokeWidth="2" />

      {/* Mini Club Crest on Left Chest */}
      <g transform="translate(57, 27)">
        <circle cx="5.5" cy="5.5" r="5" fill={club.c1} stroke="#ffffff" strokeWidth="1" />
        <circle cx="5.5" cy="5.5" r="2.2" fill={club.c2} />
      </g>

      {!hideNumber && (
        <text
          x="50"
          y="71"
          textAnchor="middle"
          fontSize="23"
          fontWeight="800"
          fontFamily="Sarabun"
          fill={numFill}
          stroke="#0008"
          strokeWidth="1.1"
        >
          {team ? '10' : '10'}
        </text>
      )}
    </svg>
  );
};

export function faceBodySvg(
  v: number[],
  kit: string,
  trim: string,
  w = 38,
  bg = 'none',
  bare = false,
  showNo = true
): string {
  const ki = v[0] ?? 2;
  const hi = v[1] ?? 0;
  const hs = v[2] ?? 0;
  const fh = v[3] ?? 0;
  const ey = (v[4] ?? 0) % 4;
  const no = v[5] ?? 10;
  const fs = (v[6] ?? ((ki + hi + hs + no) % 3)) % 3;
  const sk = SKIN_P[ki] || SKIN_P[2];
  const hr = HAIR_P[hi] || HAIR_P[0];

  const headD = [
    'M16 25c0-10 6-15 14-15s14 5 14 15c0 9-5 16-14 16s-14-7-14-16z',
    'M14.5 25.5c0-10 6.5-15.5 15.5-15.5s15.5 5.5 15.5 15.5c0 8.8-6 15.5-15.5 15.5s-15.5-6.7-15.5-15.5z',
    'M15.5 24.5c0-9.5 6-14.5 14.5-14.5s14.5 5 14.5 14.5l-1 9.5c-.8 3.8-6.5 7-13.5 7s-12.7-3.2-13.5-7z'
  ][fs];

  const hHtml = [
    `<path d="M15 24c0-11 7-17 15-17s15 6 15 17c-3-6-9-8-15-8s-12 2-15 8z" fill="${hr}"/>`,
    `<path d="M15 24c0-9 5-15 15-16c4 0 8 2 11 5l3-4-2 8c2 2 3 4 3 7c-3-6-9-8-15-8s-12 2-15 8z" fill="${hr}"/><path d="M20 12l4-5 4 4 4-6 4 5 5-3-2 7z" fill="${hr}"/>`,
    `<path d="M15 25c0-12 7-18 16-18s14 6 14 17c-4-4-12-5-20-2c-5 2-8 4-10 3z" fill="${hr}"/>`,
    `<path d="M14 25c-2-5 1-11 5-13c2-5 8-7 13-6c6-1 11 2 12 7c4 2 5 8 2 12c-3-5-9-8-16-8s-13 3-16 8z" fill="${hr}"/>`,
    `<path d="M16 23c1-9 6-14 14-14s13 5 14 14c-3-5-8-7-14-7s-11 2-14 7z" fill="${hr}" opacity="0.58"/>`,
    `<path d="M15 23c1-11 7-17 15-17s14 6 15 17c-2-8-8-10-15-10s-13 2-15 10z" fill="${hr}"/><path d="M21 11q9-3 18 0" stroke="#fff" stroke-width="0.9" opacity="0.25" fill="none"/>`,
    `<path d="M15 24c0-11 7-17 15-17s15 6 15 17c-3-6-9-8-15-8s-12 2-15 8z" fill="${hr}"/><path d="M16 18q14-3 28 0" stroke="${trim}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<path d="M15 25c0-11 7-17 15-17s15 6 15 17c-3-5-7-8-12-8l-3 5-3-5c-5 0-9 3-12 8z" fill="${hr}"/>`
  ][hs % 8];

  const fhHtml =
    fh === 1
      ? `<path d="M25 37c2 3 8 3 10 0c-1 4-9 4-10 0z" fill="${hr}" opacity="0.88"/>`
      : fh === 2
        ? `<path d="M17 29c1 9 6 13 13 13s12-4 13-13c-2 5-6 8-13 8s-11-3-13-8z" fill="${hr}" opacity="0.82"/>`
        : fh === 3
          ? `<path d="M24 33q6-2.5 12 0q-6 1-12 0z" fill="${hr}" opacity="0.9"/>`
          : '';

  const br =
    ey === 1
      ? `<path d="M19.5 22.2l7 1.4M40.5 22.2l-7 1.4" stroke="${hr}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
      : ey === 3
        ? `<path d="M19.5 22.8h7.2M33.3 22.8h7.2" stroke="${hr}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
        : `<path d="M19.8 22.5q3.7-1.6 7 0M33.2 22.5q3.7-1.6 7 0" stroke="${hr}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.9"/>`;

  const eyes =
    ey === 3
      ? `<path d="M21 26.8h5.5M33.5 26.8h5.5" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/>`
      : `<ellipse cx="23.8" cy="27" rx="2.5" ry="1.9" fill="#fff" opacity="0.92"/><ellipse cx="36.2" cy="27" rx="2.5" ry="1.9" fill="#fff" opacity="0.92"/><circle cx="23.8" cy="27" r="1.75" fill="#1a1a1a"/><circle cx="36.2" cy="27" r="1.75" fill="#1a1a1a"/><circle cx="23.2" cy="26.3" r="0.65" fill="#fff" opacity="0.9"/><circle cx="35.6" cy="26.3" r="0.65" fill="#fff" opacity="0.9"/>`;

  const mo =
    ey === 2
      ? `<path d="M25 34q5 4.2 10 0z" fill="#fff" stroke="#222" stroke-width="0.8"/>`
      : ey === 1
        ? `<path d="M26 35h8" stroke="#222" stroke-width="1.4" stroke-linecap="round"/>`
        : ey === 3
          ? `<path d="M26 35q4 1.5 8-.6" stroke="#222" fill="none" stroke-width="1.4" stroke-linecap="round"/>`
          : `<path d="M26 34.5q4 2.8 8 0" stroke="#222" fill="none" stroke-width="1.4" stroke-linecap="round"/>`;

  return `${bare ? '' : `<rect width="60" height="64" fill="${bg}"/><path d="M0 0h60v26L0 42z" fill="#fff" opacity="0.1"/>`}<path d="M8 64c0-14 7-20 22-20s22 6 22 20z" fill="${kit}"/><path d="M21 44l9 8 9-8" stroke="${trim}" stroke-width="2.5" fill="none" stroke-linejoin="round"/><path d="M12 52l4 12M48 52l-4 12" stroke="${trim}" stroke-width="2" opacity="0.35"/>${showNo && w >= 44 ? `<text x="30" y="60" text-anchor="middle" font-size="10" font-weight="700" font-family="Sarabun" fill="#fff" stroke="#0005" stroke-width="0.6" opacity="0.92">${no || 10}</text>` : ''}<rect x="25" y="36" width="10" height="11" rx="3" fill="${sk}"/><ellipse cx="30" cy="40" rx="5" ry="2.4" fill="#000" opacity="0.14"/><circle cx="14.6" cy="28" r="3.2" fill="${sk}"/><circle cx="45.4" cy="28" r="3.2" fill="${sk}"/><path d="${headD}" fill="${sk}"/>${fhHtml}<path d="M30 27.5v3.8l-1.3.9" stroke="#000" opacity="0.16" stroke-width="1.2" fill="none" stroke-linecap="round"/>${br}${eyes}${mo}${hHtml}`;
}

export const PlayerFace: React.FC<{
  player?: Partial<Player> | null;
  team?: Team | null;
  state?: GameState | null;
  careerProfile?: PlayerCareerProfile | null;
  size?: number;
  bare?: boolean;
  kitColor?: string;
  trimColor?: string;
}> = ({ player, team, state, careerProfile, size = 38, bare = false, kitColor, trimColor }) => {
  const q = player || {};
  const resolvedNo = q.no || (team && q.n ? getShirtNo(team, q) : undefined) || (q.me ? (careerProfile || state?.p)?.no : undefined);
  const v = visOf(resolvedNo ? { ...q, no: resolvedNo } : q, careerProfile || state?.p);
  const teamKit = team ? tc(team, state) : null;
  const kc = kitColor
    ? kitColor
    : q.pos === 'GK'
      ? pickGK(teamKit || '#2f6fd6')
      : teamKit
        ? teamKit
        : q.me && (careerProfile || state?.p)
          ? (careerProfile || state?.p)!.c
          : '#2f6fd6';
  const tr = trimColor ? trimColor : team ? tc(team, state, true) : '#ffd75e';
  const bg = bare ? 'transparent' : `color-mix(in srgb, ${kc} 18%, transparent)`;
  return (
    <svg
      className={`shrink-0 ${bare ? '' : 'rounded-xl border border-[var(--line)]'}`}
      width={size}
      height={Math.round((size * 64) / 60)}
      viewBox="0 0 60 64"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: faceBodySvg(v, kc, tr, size, bg, bare, true) }}
    />
  );
};

export const PITCH_SVG_BASE =
  '<rect width="300" height="340" fill="#25834f"/><path fill="#2d965c" d="M0 0h300v42H0zM0 85h300v42H0zM0 170h300v42H0zM0 255h300v42H0z"/><g fill="none" stroke="#eef2e6" stroke-width="1.6" opacity="0.85"><rect x="6" y="6" width="288" height="328"/><path d="M6 170h288M90 6v52h120V6M90 334v-62h120v62"/><circle cx="150" cy="170" r="34"/></g>';

export const TacticsMiniPitch: React.FC<{ team: Team; state?: GameState | null }> = ({ team, state }) => {
  const uid = React.useId().replace(/:/g, '');
  const col = tc(team, state);
  const trCol = tc(team, state, true);
  const gkCol = pickGK(col);
  const slots = getFormationSlots(team);
  const starters = xi(team);
  return (
    <svg className="w-full max-w-[200px] mx-auto rounded-xl block" viewBox="0 0 300 340" role="img" aria-label={`ผังแผน ${team.form}`}>
      <defs>
        <clipPath id={`mfc-${uid}`}>
          <circle cx="30" cy="31" r="27" />
        </clipPath>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />
      {slots.map((z, idx) => {
        const q = starters[idx];
        const cx = 18 + z.x * 2.64;
        const cy = 24 + z.y * 2.9;
        const kc = z.sp === 'GK' ? gkCol : col;
        const isMe = !!(q?.me || (state?.mode === 'p' && state?.p?.name === q?.n));
        const sc = 0.5;
        return (
          <g key={idx}>
            <circle cx={cx} cy={cy} r={16} fill={kc} stroke={isMe ? '#f5c242' : '#fff'} strokeWidth={isMe ? 2.8 : 2.2} />
            {q && (
              <g
                transform={`translate(${(cx - 30 * sc).toFixed(1)},${(cy - 31 * sc).toFixed(1)}) scale(${sc})`}
                clipPath={`url(#mfc-${uid})`}
                dangerouslySetInnerHTML={{ __html: faceBodySvg(visOf(q, state?.p), kc, trCol, 32, '#10281d', true, false) }}
              />
            )}
            <rect x={cx - 14} y={cy + 10} width="28" height="11" rx="4" fill="#0b2018" stroke={isMe ? '#f5c242' : '#fff8'} strokeWidth="0.9" />
            <text
              x={cx}
              y={cy + 18.2}
              textAnchor="middle"
              fontSize="8.2"
              fontWeight="700"
              fontFamily="Sarabun"
              fill={isMe ? '#fde047' : '#fff'}
            >
              {z.sp}
            </text>
          </g>
        );
      })}
    </svg>
  );
};




export const PITCH_POSITION_ZONES: PitchPositionZone[] = [
  { id: 'LW', sp: 'LW', label: 'ปีกซ้าย', x1: 3, y1: 7, x2: 26, y2: 29, line: 'FW' },
  { id: 'ST', sp: 'ST', label: 'หน้าเป้า', x1: 26, y1: 7, x2: 74, y2: 20, line: 'FW' },
  { id: 'CF', sp: 'CF', label: 'หน้าต่ำ/เชื่อม', x1: 26, y1: 20, x2: 74, y2: 29.5, line: 'FW' },
  { id: 'RW', sp: 'RW', label: 'ปีกขวา', x1: 74, y1: 7, x2: 97, y2: 29, line: 'FW' },
  { id: 'LM', sp: 'LM', label: 'กลางซ้าย', x1: 3, y1: 29, x2: 25, y2: 57, line: 'MF' },
  { id: 'CAM', sp: 'CAM', label: 'กลางรุก', x1: 25, y1: 29.5, x2: 75, y2: 43, line: 'MF' },
  { id: 'RM', sp: 'RM', label: 'กลางขวา', x1: 75, y1: 29, x2: 97, y2: 57, line: 'MF' },
  { id: 'CM', sp: 'CM', label: 'กองกลาง', x1: 25, y1: 43, x2: 75, y2: 57, line: 'MF' },
  { id: 'LWB', sp: 'LWB', label: 'วิงแบ็กซ้าย', x1: 3, y1: 57, x2: 25, y2: 69, line: 'DF' },
  { id: 'CDM', sp: 'CDM', label: 'กลางตัวรับ', x1: 25, y1: 57, x2: 75, y2: 69, line: 'MF' },
  { id: 'RWB', sp: 'RWB', label: 'วิงแบ็กขวา', x1: 75, y1: 57, x2: 97, y2: 69, line: 'DF' },
  { id: 'LB', sp: 'LB', label: 'แบ็กซ้าย', x1: 3, y1: 69, x2: 23, y2: 85, line: 'DF' },
  { id: 'CB', sp: 'CB', label: 'เซนเตอร์แบ็ก', x1: 23, y1: 69, x2: 77, y2: 85, line: 'DF' },
  { id: 'RB', sp: 'RB', label: 'แบ็กขวา', x1: 77, y1: 69, x2: 97, y2: 85, line: 'DF' },
  { id: 'GK', sp: 'GK', label: 'ผู้รักษาประตู', x1: 28, y1: 85, x2: 72, y2: 96, line: 'GK' }
];

export const getPitchZoneAt = (x: number, y: number): PitchPositionZone => {
  const found = PITCH_POSITION_ZONES.find(
    (z) => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2
  );
  if (found) return found;
  if (y >= 85) return PITCH_POSITION_ZONES[PITCH_POSITION_ZONES.length - 1];
  return PITCH_POSITION_ZONES[7]; // CM fallback
};


export const FormationPitch: React.FC<{
  team: Team;
  state: GameState;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  showPositionZones?: boolean;
  dragSourceName?: string | null;
  dropTargetName?: string | null;
  dragPreview?: PitchDragPreview | null;
  touchPointerPitchPt?: { px: number; py: number } | null;
  tapMovePlayerName?: string | null;
  onPitchZoneTap?: (nx: number, ny: number, sp: SubRole, zoneLabel: string) => void;
  onPlayerPointerDown: (e: React.PointerEvent, player: Player, slotSp: SubRole, slotIdx?: number) => void;
}> = ({
  team,
  state,
  svgRef,
  showPositionZones = false,
  dragSourceName,
  dropTargetName,
  dragPreview,
  touchPointerPitchPt,
  tapMovePlayerName,
  onPitchZoneTap,
  onPlayerPointerDown
}) => {
  const uid = React.useId().replace(/:/g, '');
  const starters = xi(team);
  const slots = getFormationSlots(team);
  const col = tc(team, state);
  const trCol = tc(team, state, true);
  const gkCol = pickGK(col);
  const zoneLineColors: Record<Position, { stroke: string; fill: string; text: string }> = {
    FW: { stroke: 'rgba(110, 231, 183, 0.55)', fill: 'rgba(16, 185, 129, 0.08)', text: 'rgba(209, 250, 229, 0.85)' },
    MF: { stroke: 'rgba(252, 211, 77, 0.55)', fill: 'rgba(245, 158, 11, 0.08)', text: 'rgba(254, 243, 199, 0.85)' },
    DF: { stroke: 'rgba(125, 211, 252, 0.55)', fill: 'rgba(56, 189, 248, 0.08)', text: 'rgba(224, 242, 254, 0.85)' },
    GK: { stroke: 'rgba(216, 180, 254, 0.55)', fill: 'rgba(168, 85, 247, 0.09)', text: 'rgba(243, 232, 255, 0.85)' }
  };

  return (
    <svg
      ref={svgRef}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      className="w-full max-w-[440px] mland:h-full mland:max-h-full mland:w-auto mland:max-w-full mx-auto rounded-2xl mland:rounded-xl block select-none"
      viewBox="0 0 300 340"
    >
      <defs>
        <clipPath id={`fc-${uid}`}>
          <circle cx="30" cy="31" r="27" />
        </clipPath>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />

      {(showPositionZones || tapMovePlayerName) && (
        <g className={tapMovePlayerName && onPitchZoneTap ? 'cursor-pointer' : 'pointer-events-none'}>
          {PITCH_POSITION_ZONES.map((z) => {
            const x = 18 + z.x1 * 2.64 + 1.2;
            const y = 24 + z.y1 * 2.9 + 1.2;
            const w = Math.max(8, (z.x2 - z.x1) * 2.64 - 2.4);
            const h = Math.max(8, (z.y2 - z.y1) * 2.9 - 2.4);
            const isActiveZone = dragPreview?.zoneId === z.id;
            const pal = zoneLineColors[z.line];
            const fitPen = isActiveZone && dragPreview ? pen(dragPreview.player.ro, z.sp) : 0;
            const activeStroke = fitPen === 0 ? '#4ade80' : fitPen === 1 ? '#facc15' : '#f87171';
            const activeFill = fitPen === 0 ? 'rgba(74, 222, 128, 0.24)' : fitPen === 1 ? 'rgba(250, 204, 21, 0.24)' : 'rgba(248, 113, 113, 0.24)';
            const canTapZone = Boolean(tapMovePlayerName && onPitchZoneTap && z.sp !== 'GK');
            const zoneCenterX = Math.round((z.x1 + z.x2) / 2);
            const zoneCenterY = Math.round((z.y1 + z.y2) / 2);

            return (
              <g
                key={z.id}
                onClick={
                  canTapZone
                    ? (e) => {
                        e.stopPropagation();
                        onPitchZoneTap?.(zoneCenterX, zoneCenterY, z.sp, z.label);
                      }
                    : undefined
                }
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx="4.5"
                  fill={isActiveZone ? activeFill : pal.fill}
                  stroke={isActiveZone ? activeStroke : pal.stroke}
                  strokeWidth={isActiveZone ? '1.8' : '0.9'}
                  strokeDasharray={isActiveZone ? undefined : '3.5 2.5'}
                  opacity={dragPreview ? (isActiveZone ? 1 : 0.65) : tapMovePlayerName ? 0.88 : 0.72}
                />
                <text
                  x={x + 4}
                  y={y + 8.5}
                  fontSize={isActiveZone ? '8' : '6.8'}
                  fontWeight="800"
                  fontFamily="Sarabun"
                  fill={isActiveZone ? '#ffffff' : pal.text}
                  stroke="rgba(5, 22, 13, 0.8)"
                  strokeWidth="1.6"
                  paintOrder="stroke"
                  className="pointer-events-none"
                >
                  {isActiveZone ? `${z.sp} · ${z.label}` : z.sp}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {starters.map((q, i) => {
        const z = slots[i] || { sp: 'CM', x: 50, y: 50 };
        const cx = 18 + z.x * 2.64;
        const cy = 24 + z.y * 2.9;
        const pn = pen(q.ro, z.sp);
        const isMe = !!q.me || (state.mode === 'p' && state.p?.name === q.n);
        const isSource = dragSourceName === q.n || tapMovePlayerName === q.n;
        const isMovingSelf = dragPreview?.slotIdx === i;
        const isTarget = dropTargetName === q.n && dragSourceName !== q.n;
        const ed = q.inj > 0 || (q.sus || 0) > 0 ? '#ef4444' : tapMovePlayerName === q.n ? '#38bdf8' : isTarget || isMe ? '#f5c242' : PCOL[pn];
        const kc = z.sp === 'GK' ? gkCol : col;
        const rad = isTarget || tapMovePlayerName === q.n ? 19 : 16;
        const sc = isTarget || tapMovePlayerName === q.n ? 0.58 : 0.5;
        const no = getShirtNo(team, q);
        const efVal = q.inj > 0 || (q.sus || 0) > 0 ? 0 : Math.max(0, Math.min(100, Math.round(q.fit ?? 100)));
        const efc = efVal >= 85 ? '#3fcf7f' : efVal >= 65 ? '#f4c63d' : '#ff7a5c';

        return (
          <g
            key={`${q.n}-${i}`}
            data-drop-player={q.n}
            data-drop-slot={z.sp}
            onPointerDown={(e) => onPlayerPointerDown(e, q, z.sp, i)}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              opacity: isMovingSelf ? 0.24 : dragSourceName === q.n ? 0.45 : 1
            }}
            className={dragSourceName ? 'cursor-grabbing' : 'cursor-pointer'}
          >
            <circle cx={cx} cy={cy} r={24} fill="transparent" />
            {tapMovePlayerName === q.n && (
              <circle cx={cx} cy={cy} r={25} fill="rgba(56, 189, 248, 0.24)" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="4 2" />
            )}
            {isMe && !isTarget && tapMovePlayerName !== q.n && (
              <circle cx={cx} cy={cy} r={22.5} fill="#f5c2422e" stroke="#fde047" strokeWidth="2.2" />
            )}
            {isTarget && (
              <circle cx={cx} cy={cy} r={24} fill="#f5c24228" stroke="#f5c242" strokeWidth="2.2" strokeDasharray="4 2" />
            )}
            <ellipse cx={cx} cy={cy + 16} rx="13" ry="3.8" fill="#0005" />
            {isMe ? (
              <g transform={`translate(${cx},${cy - (isTarget ? 27 : 24)})`}>
                <rect x="-24" y="-9.5" width="48" height="12.5" rx="6" fill="#f5c242" stroke="#111" strokeWidth="0.9" />
                <text x="0" y="-0.6" textAnchor="middle" fontSize="8.3" fontWeight="800" fontFamily="Sarabun" fill="#1a1200">
                  ★ ฉัน · {z.sp}
                </text>
              </g>
            ) : (
              <text
                x={cx}
                y={cy - (isTarget ? 24 : 21)}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="Sarabun"
                fill={PCOL[pn]}
                stroke="#0b2018"
                strokeWidth="2.6"
                paintOrder="stroke"
              >
                {z.sp}
              </text>
            )}
            <circle cx={cx} cy={cy} r={rad} fill={kc} stroke={ed} strokeWidth="2.8" />
            <g
              transform={`translate(${(cx - 30 * sc).toFixed(1)},${(cy - 31 * sc).toFixed(1)}) scale(${sc})`}
              clipPath={`url(#fc-${uid})`}
              dangerouslySetInnerHTML={{ __html: faceBodySvg(visOf(q, state.p), kc, trCol, 32, '#10281d', true, false) }}
            />
            <rect x={cx + 4} y={cy + 6} width="18" height="11" rx="4.5" fill="#0b2018" stroke={ed} strokeWidth="1.1" />
            <text x={cx + 13} y={cy + 14.2} textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="Sarabun" fill="#fff">
              {q.ov}
            </text>
            <rect x={cx - 22} y={cy + 6} width="18" height="11" rx="4.5" fill="#0b2018" stroke={ed} strokeWidth="1.1" />
            <text x={cx - 13} y={cy + 14.2} textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="Sarabun" fill="#ffd75e">
              {no}
            </text>
            {team.cap === q.n && (
              <g transform={`translate(${cx - 12},${cy - 15})`}>
                <circle r="6" fill="#f4c63d" stroke="#111" strokeWidth="1" />
                <text y="3" textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="Sarabun" fill="#111">
                  C
                </text>
              </g>
            )}
            {(q.sus || 0) > 0 ? (
              <rect x={cx + 9} y={cy - 20} width="7" height="10" rx="1.5" fill="#e5484d" stroke="#fff" strokeWidth="1.2" />
            ) : q.inj > 0 ? (
              <g transform={`translate(${cx + 12},${cy - 15})`}>
                <circle r="6" fill="#fff" stroke="#e5484d" strokeWidth="1.2" />
                <path d="M-3 0h6M0-3v6" stroke="#e5484d" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : null}
            <text
              x={clamp(cx, 26, 274)}
              y={cy + 31.5}
              textAnchor="middle"
              fontSize={isMe ? '8.8' : '8.4'}
              fontWeight={isMe ? '800' : '600'}
              fontFamily="Sarabun"
              fill={isMe ? '#fde047' : '#fff'}
              stroke="#0b2018"
              strokeWidth="2.3"
              paintOrder="stroke"
            >
              {q.n.split(' ')[0]}
            </text>
            <rect x={cx - 23} y={cy + 18.5} width="28" height="4.5" rx="2.2" fill="#0b2018" stroke="#fff7" strokeWidth="0.6" />
            <rect x={cx - 23} y={cy + 18.5} width={(28 * efVal) / 100} height="4.5" rx="2.2" fill={efc} />
            <text
              x={cx + 7}
              y={cy + 23}
              fontSize="8"
              fontWeight="700"
              fontFamily="Sarabun"
              fill={efc}
              stroke="#0b2018"
              strokeWidth="2.2"
              paintOrder="stroke"
            >
              {efVal}%
            </text>
          </g>
        );
      })}

      {/* Live Dragged Player Preview on Pitch (with fingertip offset tether on touch) */}
      {dragPreview && (() => {
        const pq = dragPreview.player;
        const gx = 18 + dragPreview.x * 2.64;
        const gy = 24 + dragPreview.y * 2.9;
        const pn = pen(pq.ro, dragPreview.sp);
        const ed = pn === 0 ? '#4ade80' : pn === 1 ? '#facc15' : '#f87171';
        const kc = dragPreview.sp === 'GK' ? gkCol : col;
        const sc = 0.56;
        return (
          <g className="pointer-events-none">
            {touchPointerPitchPt && Math.hypot(touchPointerPitchPt.px - gx, touchPointerPitchPt.py - gy) > 8 && (
              <>
                <line
                  x1={touchPointerPitchPt.px}
                  y1={touchPointerPitchPt.py}
                  x2={gx}
                  y2={gy}
                  stroke={ed}
                  strokeWidth="1.6"
                  strokeDasharray="3.5 2.5"
                  opacity="0.85"
                />
                <circle
                  cx={touchPointerPitchPt.px}
                  cy={touchPointerPitchPt.py}
                  r="6"
                  fill="rgba(255,255,255,0.18)"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.2"
                />
              </>
            )}
            <circle cx={gx} cy={gy} r={23} fill={`${ed}30`} stroke={ed} strokeWidth="2" strokeDasharray="3 2" />
            <circle cx={gx} cy={gy} r={18} fill={kc} stroke="#fff" strokeWidth="2.5" />
            <g
              transform={`translate(${(gx - 30 * sc).toFixed(1)},${(gy - 31 * sc).toFixed(1)}) scale(${sc})`}
              clipPath={`url(#fc-${uid})`}
              dangerouslySetInnerHTML={{ __html: faceBodySvg(visOf(pq, state.p), kc, trCol, 32, '#10281d', true, false) }}
            />
            <rect x={clamp(gx - 38, 6, 218)} y={gy - 37} width="76" height="14" rx="7" fill="#0b2018" stroke={ed} strokeWidth="1.3" />
            <text x={clamp(gx, 44, 256)} y={gy - 27.2} textAnchor="middle" fontSize="8.2" fontWeight="800" fontFamily="Sarabun" fill={ed}>
              {dragPreview.sp} · {dragPreview.zoneLabel}
            </text>
            <text
              x={clamp(gx, 28, 272)}
              y={gy + 29}
              textAnchor="middle"
              fontSize="9"
              fontWeight="800"
              fontFamily="Sarabun"
              fill="#fde047"
              stroke="#0b2018"
              strokeWidth="2.6"
              paintOrder="stroke"
            >
              {pq.n.split(' ')[0]}
            </text>
          </g>
        );
      })()}
    </svg>
  );
};

