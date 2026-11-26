import React from 'react';
import type { Position, SubRole, Player, Team, ClubIdentity, PlayerCareerProfile, GameState, PitchPositionZone, PitchDragPreview, CoachOutfitId } from '../types/game';
import { clamp } from '../utils/math';
import { CREST_SHAPES, CREST_PATTERNS, CREST_IC, KIT_PATTERNS } from '../data/crestAndKitData';
import { PCOL, SKIN_P, HAIR_P, HS_N, FH_N, FS_N, EY_N, ACC_N, COACH_OUTFITS } from '../data/thaiFootballData';
import { getShirtNo, visOf, getFormationSlots, playerPen, xi, colLum, colDist, tc, pickGK } from '../engine/playerCore';
import { getClubCaptainPalette } from './CaptainBadge';
import { getPositionCanvasPalette } from './PositionBadge';
import { getOvrCanvasPalette } from './OvrBadge';

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

interface ResolvedCrestSpec {
  c1: string;
  c2: string;
  c3: string;
  hasCustomC3: boolean;
  sh: number;
  d: string;
  pat: number;
  ic: string;
  borderStyle: number;
  strokeCol: string;
  stars: number;
  icCol: string;
  haloCol: string;
  icTransform: string;
}

const CREST_STAR_LAYOUTS: Record<number, readonly { cx: number; cy: number; r: number }[]> = {
  1: [{ cx: 12, cy: 1.92, r: 1.72 }],
  2: [
    { cx: 9.5, cy: 2.08, r: 1.54 },
    { cx: 14.5, cy: 2.08, r: 1.54 }
  ],
  3: [
    { cx: 7.4, cy: 2.38, r: 1.4 },
    { cx: 12, cy: 1.68, r: 1.6 },
    { cx: 16.6, cy: 2.38, r: 1.4 }
  ]
};

function buildStarPath(cx: number, cy: number, r: number, innerRatio = 0.43): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (((-90 + i * 36) * Math.PI) / 180);
    const radius = i % 2 === 0 ? r : r * innerRatio;
    const x = +(cx + Math.cos(rad) * radius).toFixed(2);
    const y = +(cy + Math.sin(rad) * radius).toFixed(2);
    pts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
  }
  return `${pts.join('')}Z`;
}

function resolveCrestSpec(
  name: string,
  team?: Team | null,
  club?: ClubIdentity | null,
  isMyClub?: boolean
): ResolvedCrestSpec {
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
  const icTransform = 'translate(5.2 5.2) scale(.57)';
  return {
    c1,
    c2,
    c3,
    hasCustomC3: Boolean(k?.c3),
    sh,
    d,
    pat,
    ic,
    borderStyle,
    strokeCol,
    stars,
    icCol,
    haloCol,
    icTransform
  };
}

function renderCrestPatternStr(pat: number, uid: string, c1: string, c2: string): string {
  const base = `<rect width="24" height="24" fill="${pat === 9 ? `url(#cg-${uid})` : pat === 19 ? `url(#cr-${uid})` : c1}"/>`;
  if (pat === 0) return `${base}<rect y="7" width="24" height="5" fill="${c2}"/>`;
  if (pat === 1) return `${base}<rect x="12" width="12" height="24" fill="${c2}"/>`;
  if (pat === 2) return `${base}<path d="M0 24L24 0v8L8 24z" fill="${c2}"/>`;
  if (pat === 3) return `${base}<rect y="5" width="24" height="3" fill="${c2}"/><rect y="11" width="24" height="3" fill="${c2}"/>`;
  if (pat === 4) return `${base}${[0, 1, 2, 3].map((i) => `<rect x="${i * 6 + 1.5}" width="2.8" height="24" fill="${c2}"/>`).join('')}`;
  if (pat === 5) return `${base}<rect x="12" y="0" width="12" height="12" fill="${c2}"/><rect x="0" y="12" width="12" height="12" fill="${c2}"/>`;
  if (pat === 6) return `${base}<path d="M0 6l12 9 12-9v5l-12 9-12-9z" fill="${c2}"/>`;
  if (pat === 7) return `${base}<rect x="9.5" y="0" width="5" height="24" fill="${c2}"/><rect x="0" y="9.5" width="24" height="5" fill="${c2}"/>`;
  if (pat === 8) return `${base}<circle cx="12" cy="12" r="7.5" fill="none" stroke="${c2}" stroke-width="2.4"/>`;
  if (pat === 10) return `${base}<rect y="12" width="24" height="12" fill="${c2}"/>`;
  if (pat === 11) {
    return `${base}${[0, 1, 2, 3]
      .flatMap((r) => [0, 1, 2, 3].map((col) => ((r + col) % 2 === 1 ? `<rect x="${col * 6}" y="${r * 6}" width="6" height="6" fill="${c2}"/>` : '')))
      .join('')}`;
  }
  if (pat === 12) return `${base}<path d="M12 2.5L21.5 12 12 21.5 2.5 12z" fill="${c2}"/>`;
  if (pat === 13) return `${base}<path d="M-1 2L2 -1 25 22 22 25z" fill="${c2}"/><path d="M22 -1L25 2 2 25 -1 22z" fill="${c2}"/>`;
  if (pat === 14) {
    return `${base}<path d="M12 12L8 0h8zM12 12l12-4v8zM12 12l4 12H8zM12 12L0 16V8z" fill="${c2}"/><path d="M12 12L21 0h3v3zM12 12l12 9v3h-3zM12 12L3 24H0v-3zM12 12L0 3V0h3z" fill="${c2}" opacity="0.65"/>`;
  }
  if (pat === 15) return `${base}<path d="M0 0h24L12 14z" fill="${c2}"/>`;
  if (pat === 16) return `${base}<path d="M-2 17L17 -2h5L-2 22z" fill="${c2}"/><path d="M4 26L26 4v5L9 26z" fill="${c2}"/>`;
  if (pat === 17) return `${base}<rect x="8.5" y="0" width="7" height="24" fill="${c2}"/>`;
  if (pat === 18) return `${base}${[-12, -4, 4, 12, 20].map((off) => `<path d="M${off} 24L${off + 24} 0h3.5L${off + 3.5} 24z" fill="${c2}"/>`).join('')}`;
  return base;
}

function buildCrestSvgMarkup(spec: ResolvedCrestSpec, uid: string, withStars = false): string {
  const hasStars = withStars && spec.stars > 0;
  const defs = `<defs><clipPath id="mcp-${uid}"><path d="${spec.d}"/></clipPath>${
    spec.pat === 9 ? `<linearGradient id="cg-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${spec.c1}"/><stop offset="100%" stop-color="${spec.c2}"/></linearGradient>` : ''
  }${
    spec.pat === 19 ? `<radialGradient id="cr-${uid}" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="${spec.c2}"/><stop offset="100%" stop-color="${spec.c1}"/></radialGradient>` : ''
  }${
    hasStars ? `<linearGradient id="cs-${uid}" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0%" stop-color="#fef9c3"/><stop offset="48%" stop-color="#facc15"/><stop offset="100%" stop-color="#d97706"/></linearGradient>` : ''
  }</defs>`;
  const patBody = renderCrestPatternStr(spec.pat, uid, spec.c1, spec.c2);
  const c3Stroke = spec.hasCustomC3 && spec.pat !== 8 ? `<path d="${spec.d}" fill="none" stroke="${spec.c3}" stroke-width="2.2" opacity="0.6"/>` : '';
  const borderExtra = spec.borderStyle === 2 ? `<path d="${spec.d}" fill="none" stroke="${spec.c3}" stroke-width="0.9" opacity="0.9"/>` : '';
  const starsHtml = hasStars
    ? (CREST_STAR_LAYOUTS[spec.stars] || [])
        .map(
          (st) =>
            `<path d="${buildStarPath(st.cx, st.cy, st.r)}" fill="url(#cs-${uid})" stroke="#451a03" stroke-width="0.34" stroke-linejoin="round" paint-order="stroke"/>`
        )
        .join('')
    : '';
  const icRaw = CREST_IC[spec.ic] || '';
  const body = `<g clip-path="url(#mcp-${uid})">${patBody}${c3Stroke}</g><path d="${spec.d}" fill="none" stroke="${spec.strokeCol}" stroke-width="${spec.borderStyle === 2 ? '2.2' : '1.8'}"/>${borderExtra}<g transform="${spec.icTransform}" fill="none" stroke="${spec.haloCol}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round">${icRaw}</g><g transform="${spec.icTransform}" fill="none" stroke="${spec.icCol}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icRaw}</g>`;
  return `${defs}${hasStars ? `<g transform="translate(12 13.85) scale(0.815) translate(-12 -12)">${body}</g>` : body}${starsHtml}`;
}

export const ClubCrest: React.FC<{
  name: string;
  size?: number;
  team?: Team | null;
  club?: ClubIdentity | null;
  isMyClub?: boolean;
}> = React.memo(({ name, size = 24, team, club, isMyClub }) => {
  const uid = React.useId().replace(/:/g, '');
  const spec = resolveCrestSpec(name, team, club, isMyClub);
  const hasStars = spec.stars > 0;
  const starLayouts = hasStars ? CREST_STAR_LAYOUTS[spec.stars] || [] : [];

  const crestBody = (
    <>
      <g clipPath={`url(#cp-${uid})`}>
        {renderCrestPattern(spec.pat, uid, spec.c1, spec.c2)}
        {spec.hasCustomC3 && spec.pat !== 8 && <path d={spec.d} fill="none" stroke={spec.c3} strokeWidth="2.2" opacity="0.6" />}
      </g>
      <path d={spec.d} fill="none" stroke={spec.strokeCol} strokeWidth={spec.borderStyle === 2 ? '2' : '1.5'} />
      {spec.borderStyle === 2 && <path d={spec.d} fill="none" stroke={spec.c3} strokeWidth="0.7" opacity="0.9" />}
      <g
        transform={spec.icTransform}
        fill="none"
        stroke={spec.haloCol}
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: CREST_IC[spec.ic] }}
      />
      <g
        transform={spec.icTransform}
        fill="none"
        stroke={spec.icCol}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: CREST_IC[spec.ic] }}
      />
    </>
  );

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <defs>
        <clipPath id={`cp-${uid}`}>
          <path d={spec.d} />
        </clipPath>
        {spec.pat === 9 && (
          <linearGradient id={`cg-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={spec.c1} />
            <stop offset="100%" stopColor={spec.c2} />
          </linearGradient>
        )}
        {spec.pat === 19 && (
          <radialGradient id={`cr-${uid}`} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={spec.c2} />
            <stop offset="100%" stopColor={spec.c1} />
          </radialGradient>
        )}
        {hasStars && (
          <linearGradient id={`cs-${uid}`} x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="48%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        )}
      </defs>
      {hasStars ? (
        <g transform="translate(12 13.85) scale(0.815) translate(-12 -12)">{crestBody}</g>
      ) : (
        crestBody
      )}
      {starLayouts.map((st, idx) => (
        <path
          key={idx}
          d={buildStarPath(st.cx, st.cy, st.r)}
          fill={`url(#cs-${uid})`}
          stroke="#451a03"
          strokeWidth="0.34"
          strokeLinejoin="round"
          paintOrder="stroke"
        />
      ))}
    </svg>
  );
});

const KIT_BODY_PATH = 'M30 10l-22 14 8 18 10-5v48h48V37l10 5 8-18-22-14c-4 8-10 10-20 10s-16-2-20-10z';

function renderKitPatternLayer(p: number, uid: string, c: string, d: string, accent: string) {
  return (
    <>
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
    </>
  );
}

export const KitPatternThumb: React.FC<{
  pattern: number;
  c: string;
  d: string;
  accent?: string;
  size?: number;
}> = React.memo(({ pattern, c, d, accent = '', size = 15 }) => {
  const uid = React.useId().replace(/:/g, '');
  const p = ((pattern || 0) % KIT_PATTERNS.length + KIT_PATTERNS.length) % KIT_PATTERNS.length;
  const effAccent = accent || (colDist(d, '#ffffff') < 100 ? '#f4c63d' : '#ffffff');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0" aria-hidden="true">
      <defs>
        <clipPath id={`kpt-${uid}`}>
          <path d={KIT_BODY_PATH} />
        </clipPath>
        {p === 11 && (
          <linearGradient id={`kg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={d} />
          </linearGradient>
        )}
      </defs>
      <g clipPath={`url(#kpt-${uid})`}>
        {renderKitPatternLayer(p, uid, c, d, effAccent)}
      </g>
      <path d={KIT_BODY_PATH} fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="4" />
    </svg>
  );
});

export const KitJersey: React.FC<{
  club: ClubIdentity;
  away?: boolean;
  size?: number;
  team?: Team | null;
  hideNumber?: boolean;
  shirtNo?: number | string;
  isGK?: boolean;
}> = ({
  club,
  away = false,
  size = 80,
  team = null,
  hideNumber = false,
  shirtNo = '10',
  isGK = false
}) => {
  const uid = React.useId().replace(/:/g, '');
  const gkBase = isGK ? pickGK(club.c1, club.c2) : null;
  const c = gkBase || (away ? club.c2 : club.c1);
  const d = gkBase ? (colDist(gkBase, '#111827') > 160 ? '#111827' : '#ffffff') : (away ? club.c1 : club.c2);
  const accent = gkBase ? '#ffffff' : (club.c3 || (colDist(d, '#ffffff') < 100 ? '#f4c63d' : '#ffffff'));
  const gkPatterns = [0, 4, 6, 10, 12, 13];
  const rawPat = ((away && club.awayKit != null ? club.awayKit : club.kit) || 0) % KIT_PATTERNS.length;
  const p = isGK ? gkPatterns[(rawPat + 2) % gkPatterns.length] : rawPat;
  const collar = (club.collar ?? 0) % 4;
  const cuffTrim = club.cuffTrim ?? true;
  const J = KIT_BODY_PATH;
  const numLightBg = colDist(c, '#ffffff') < 130 && [0, 5, 6, 10, 12, 13].includes(p);
  const numFill = gkBase
    ? colLum(c) > 0.55
      ? '#111827'
      : '#ffffff'
    : numLightBg
      ? '#111827'
      : p === 4 || p === 5 || p === 8 || p === 9 || p === 11
        ? '#ffffff'
        : d;
  const numText = String(shirtNo ?? '10');
  const numFontSize = numText.length >= 2 ? 21 : 23;

  return (
    <svg width={size} height={size} viewBox="5 7 90 81" className="shrink-0" aria-hidden="true">
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
        {renderKitPatternLayer(p, uid, c, d, accent)}

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

      {/* Real Club Crest on Left Chest */}
      <g
        transform="translate(55, 25) scale(0.46)"
        dangerouslySetInnerHTML={{ __html: buildCrestSvgMarkup(resolveCrestSpec(club.name || team?.name || 'Club', team, club, true), `${uid}-jc`) }}
      />

      {!hideNumber && (
        <text
          x="50"
          y="71"
          textAnchor="middle"
          fontSize={numFontSize}
          fontWeight="800"
          fontFamily="Sarabun"
          fill={numFill}
          stroke="#0008"
          strokeWidth="1.1"
        >
          {numText}
        </text>
      )}
    </svg>
  );
};
const MemoKitJersey = React.memo(KitJersey);
export { MemoKitJersey as KitJerseyMemo };

export interface KitVisualSpec {
  uid: string;
  kitPattern: number;
  collar: number;
  accent: string;
  crestSpec: ResolvedCrestSpec | null;
}

let _faceSeq = 0;

export function resolveGkKitPalette(baseColor: string, altColor = '', gkOverride?: string): { kit: string; trim: string; accent: string } {
  const kit = gkOverride || pickGK(baseColor, altColor);
  const trim = colDist(kit, '#111827') > 160 ? '#111827' : '#ffffff';
  return { kit, trim, accent: '#ffffff' };
}

function resolveKitVisualForFace(
  team?: Team | null,
  state?: GameState | null,
  club?: ClubIdentity | null,
  isMyClubProp?: boolean,
  kitColor?: string,
  trimColor?: string,
  isGK = false,
  uidOverride?: string,
  fallbackName?: string
): KitVisualSpec {
  const uid = uidOverride || `f${(++_faceSeq).toString(36)}`;
  const mine =
    isMyClubProp !== undefined
      ? Boolean(isMyClubProp)
      : Boolean(club || (team && state && team.id === state.me && state.mode === 'm'));
  const activeClub = mine ? (club || state?.club || null) : null;
  const seedName = activeClub?.name || team?.name || fallbackName || 'Club';
  const h = ([...seedName].reduce((a, c, idx) => a + c.charCodeAt(0) * (idx + 3), 0) * 37) >>> 0;
  const isAwayKitColor = Boolean(
    !isGK &&
      activeClub &&
      kitColor &&
      activeClub.c2 &&
      kitColor.toLowerCase() === activeClub.c2.toLowerCase() &&
      activeClub.c1.toLowerCase() !== activeClub.c2.toLowerCase()
  );
  const rawPat = activeClub
    ? ((isAwayKitColor && activeClub.awayKit != null ? activeClub.awayKit : activeClub.kit) ?? 0) % KIT_PATTERNS.length
    : team
      ? (h >> 3) % KIT_PATTERNS.length
      : h % 6;
  const gkPatterns = [0, 4, 6, 10, 12, 13];
  const kitPattern = isGK ? gkPatterns[(rawPat + 2) % gkPatterns.length] : rawPat;
  const collar = activeClub ? (activeClub.collar ?? 0) % 4 : (h >> 5) % 4;
  const resolvedTrim = trimColor || activeClub?.c2 || team?.kc?.[1] || '#ffd75e';
  const accent = isGK
    ? '#ffffff'
    : activeClub?.c3 || (colDist(resolvedTrim, '#ffffff') < 100 ? '#f4c63d' : '#ffffff');
  const crestSpec = team || activeClub ? resolveCrestSpec(seedName, team, activeClub, mine) : null;
  return { uid, kitPattern, collar, accent, crestSpec };
}

function renderFaceTorsoPattern(pat: number, kit: string, trim: string, accent: string, uid: string): string {
  const base = `<rect x="8" y="44" width="44" height="20" fill="${pat === 11 ? `url(#fg-${uid})` : kit}"/>`;
  let overlays = '';
  if (pat === 1) {
    overlays = [10, 17, 24, 31, 38, 45].map((x) => `<rect x="${x}" y="44" width="3.5" height="20" fill="${trim}"/>`).join('');
  } else if (pat === 2) {
    overlays = [45, 51, 57, 62].map((y) => `<rect x="8" y="${y}" width="44" height="3" fill="${trim}"/>`).join('');
  } else if (pat === 3) {
    overlays = `<rect x="30" y="44" width="22" height="20" fill="${trim}"/>`;
  } else if (pat === 4) {
    overlays = `<path d="M10 64L37 44h9L19 64z" fill="${trim}"/><path d="M8.5 64L35.5 44h1.5L10 64z" fill="${accent}" opacity="0.88"/>`;
  } else if (pat === 5) {
    overlays = `<rect x="8" y="52" width="44" height="6.2" fill="${trim}"/><rect x="8" y="51.2" width="44" height="1" fill="${accent}"/><rect x="8" y="58" width="44" height="1" fill="${accent}"/>`;
  } else if (pat === 6) {
    overlays = `<path d="M12 45l18 9 18-9v5L30 59 12 50z" fill="${trim}"/><path d="M12 50l18 9 18-9v1.8L30 60.8 12 51.8z" fill="${accent}"/>`;
  } else if (pat === 7) {
    overlays = [0, 1, 2]
      .flatMap((r) => [0, 1, 2, 3, 4, 5].map((c) => ((r + c) % 2 === 0 ? `<rect x="${8 + c * 7.5}" y="${44 + r * 7}" width="7.5" height="7" fill="${trim}"/>` : '')))
      .join('');
  } else if (pat === 8) {
    overlays = `<rect x="30" y="44" width="22" height="10" fill="${trim}"/><rect x="8" y="54" width="22" height="10" fill="${trim}"/>`;
  } else if (pat === 9) {
    overlays = `<rect x="27.2" y="44" width="5.6" height="20" fill="${trim}"/><rect x="8" y="51.5" width="44" height="5" fill="${trim}"/>`;
  } else if (pat === 10) {
    overlays = `<rect x="8" y="44" width="10.5" height="20" fill="${trim}"/><rect x="41.5" y="44" width="10.5" height="20" fill="${trim}"/><rect x="18" y="44" width="1.2" height="20" fill="${accent}"/><rect x="40.8" y="44" width="1.2" height="20" fill="${accent}"/>`;
  } else if (pat === 12) {
    overlays = [11, 15, 19, 23, 27, 31, 35, 39, 43, 47].map((x) => `<rect x="${x}" y="44" width="1.1" height="20" fill="${trim}" opacity="0.9"/>`).join('');
  } else if (pat === 13) {
    overlays = `<path d="M8 52l9-4 7 4 6-4 6 4 7-4 9 4v4.5l-9-4-7 4-6-4-6 4-7-4-9 4z" fill="${trim}" opacity="0.92"/><path d="M8 58l9-4 7 4 6-4 6 4 7-4 9 4v2.5l-9-4-7 4-6-4-6 4-7-4-9 4z" fill="${accent}" opacity="0.82"/>`;
  }
  return `${base}${overlays}`;
}

function renderFaceCollar(collar: number, trim: string, accent: string): string {
  if (collar === 1) return `<path d="M21 44l9 8 9-8" stroke="${accent}" stroke-width="2.2" fill="none" stroke-linejoin="round"/>`;
  if (collar === 2) return `<path d="M21 44l5.5 5.5 3.5-2 3.5 2L39 44z" fill="${trim}" stroke="${accent}" stroke-width="0.9"/><line x1="30" y1="47.5" x2="30" y2="52" stroke="${accent}" stroke-width="1.4" stroke-linecap="round"/>`;
  if (collar === 3) return `<path d="M21.5 44c2.5 5 5 6.5 8.5 6.5s6-1.5 8.5-6.5" fill="none" stroke="${trim}" stroke-width="2.8" stroke-linecap="round"/><path d="M22.5 44.3c2.2 4 4.4 5.2 7.5 5.2s5.3-1.2 7.5-5.2" fill="none" stroke="${accent}" stroke-width="1.1" stroke-linecap="round"/>`;
  return `<path d="M21.5 44c2.5 5 5 6.5 8.5 6.5s6-1.5 8.5-6.5" stroke="${accent}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
}

function renderCoachTorso(
  outfitId: CoachOutfitId | undefined,
  clubKit: string,
  tieCol: string,
  accent: string,
  crestSpec: ResolvedCrestSpec | null | undefined,
  uid: string
): string {
  const cfg = COACH_OUTFITS.find((o) => o.id === outfitId) || COACH_OUTFITS[0];
  const tieShade =
    colDist(tieCol, '#f8fafc') < 90
      ? '#b91c1c'
      : colDist(tieCol, '#000000') < 65
        ? '#334155'
        : tieCol;

  if (cfg.mode === 'tracksuit') {
    const jCol = clubKit || '#1e293b';
    const trimAccent = colDist(jCol, tieShade) < 55 ? '#f8fafc' : tieShade;
    const base = `<rect x="8" y="44" width="44" height="20" fill="${jCol}"/>`;
    const shoulderStripes =
      `<path d="M10 47l8 4v13h-3V52.5L10 50z" fill="${trimAccent}" opacity="0.9"/>` +
      `<path d="M50 47l-8 4v13h3V52.5L50 50z" fill="${trimAccent}" opacity="0.9"/>`;
    const collarZip =
      `<path d="M21.5 44h17l-2.5 5.2h-12z" fill="#0f172a"/>` +
      `<path d="M22.5 44.5h15l-1.8 4h-11.4z" fill="${trimAccent}" opacity="0.28"/>` +
      `<line x1="30" y1="45" x2="30" y2="64" stroke="#e2e8f0" stroke-width="1.1"/>` +
      `<rect x="29.1" y="47.8" width="1.8" height="2.8" rx="0.6" fill="#cbd5e1"/>`;
    const chestStripe = `<path d="M13 55h34" stroke="${trimAccent}" stroke-width="1.3" opacity="0.72"/>`;
    const pin = crestSpec
      ? `<g transform="translate(36.2, 50.6) scale(0.25)">${buildCrestSvgMarkup(crestSpec, `${uid}-cp`)}</g>`
      : `<circle cx="38" cy="52.5" r="1.6" fill="${trimAccent}" stroke="#ffffff" stroke-width="0.6"/>`;
    return `${base}${shoulderStripes}${chestStripe}${collarZip}${pin}`;
  }

  if (cfg.mode === 'polo') {
    const pCol = clubKit || '#1e293b';
    const trimAccent = colDist(pCol, tieShade) < 55 ? '#f8fafc' : tieShade;
    const base = `<rect x="8" y="44" width="44" height="20" fill="${pCol}"/>`;
    const collar =
      `<path d="M21 44l5.5 5.6 3.5-2.1 3.5 2.1L39 44z" fill="${trimAccent}" stroke="#0f172a" stroke-opacity="0.35" stroke-width="0.7"/>` +
      `<rect x="28.6" y="47.2" width="2.8" height="8" rx="0.8" fill="#0f172a" fill-opacity="0.32"/>` +
      `<circle cx="30" cy="49.4" r="0.65" fill="#f8fafc"/><circle cx="30" cy="52.6" r="0.65" fill="#f8fafc"/>`;
    const sleeveTrim =
      `<path d="M11 54l4 10" stroke="${trimAccent}" stroke-width="1.4" opacity="0.75"/>` +
      `<path d="M49 54l-4 10" stroke="${trimAccent}" stroke-width="1.4" opacity="0.75"/>`;
    const pin = crestSpec
      ? `<g transform="translate(36.2, 50.8) scale(0.25)">${buildCrestSvgMarkup(crestSpec, `${uid}-cp`)}</g>`
      : `<circle cx="38" cy="53" r="1.5" fill="${trimAccent}" stroke="#ffffff" stroke-width="0.6"/>`;
    return `${base}${sleeveTrim}${collar}${pin}`;
  }

  if (cfg.mode === 'shirt') {
    const shirt = '#f8fafc';
    const collarShadow = '#e2e8f0';
    const base = `<rect x="8" y="44" width="44" height="20" fill="${shirt}"/>`;
    const shading =
      `<path d="M8 44h11l4 20H8z" fill="#e2e8f0" opacity="0.36"/>` +
      `<path d="M52 44H41l-4 20h15z" fill="#e2e8f0" opacity="0.36"/>` +
      `<line x1="30" y1="48" x2="30" y2="64" stroke="#cbd5e1" stroke-width="0.9"/>`;
    const collar =
      `<path d="M21.2 44l4.2 5.4 4.6-3.4 4.6 3.4 4.2-5.4z" fill="${collarShadow}" stroke="#94a3b8" stroke-width="0.7"/>`;
    const tie =
      `<path d="M28.1 46.8h3.8l-.8 2.8h-2.2z" fill="${tieShade}"/>` +
      `<path d="M28.7 49.4h2.6l1.3 11.2-2.6 3.2-2.6-3.2z" fill="${tieShade}"/>` +
      `<path d="M28.7 49.4l1.3 14.4" stroke="${accent}" stroke-width="0.65" opacity="0.55"/>`;
    const pin = crestSpec
      ? `<g transform="translate(36.4, 51.2) scale(0.22)">${buildCrestSvgMarkup(crestSpec, `${uid}-cp`)}</g>`
      : `<circle cx="38" cy="53" r="1.3" fill="${tieShade}"/>`;
    return `${base}${shading}${collar}${tie}${pin}`;
  }

  // Suit modes: suit_navy, suit_black, suit_charcoal, suit_camel
  const blazer = cfg.coat;
  const lapel = cfg.lapel;
  const shirt = cfg.shirt;
  const base = `<rect x="8" y="44" width="44" height="20" fill="${blazer}"/>`;
  const lapels =
    `<path d="M21 44h18l-9 18z" fill="${shirt}"/>` +
    `<path d="M18.5 44l6.5 18.5-4.5 1.5-5-14z" fill="${lapel}"/>` +
    `<path d="M41.5 44l-6.5 18.5 4.5 1.5 5-14z" fill="${lapel}"/>` +
    `<path d="M21.5 44l3.8 5.2 4.7-3.4 4.7 3.4 3.8-5.2" fill="none" stroke="#e2e8f0" stroke-width="0.95"/>`;
  const tie =
    `<path d="M28.1 46.8h3.8l-.8 2.8h-2.2z" fill="${tieShade}"/>` +
    `<path d="M28.7 49.4h2.6l1.3 11.2-2.6 3.2-2.6-3.2z" fill="${tieShade}"/>` +
    `<path d="M28.7 49.4l1.3 14.4" stroke="${accent}" stroke-width="0.65" opacity="0.55"/>`;
  const pocketSquare =
    `<path d="M14.8 56.2l3.8-2.2 1.2 2.2z" fill="${shirt}" opacity="0.92"/>` +
    `<path d="M14.8 56.2l3.8-2.2" stroke="${tieShade}" stroke-width="0.8"/>`;
  const pin = crestSpec
    ? `<g transform="translate(36.2, 50.8) scale(0.24)">${buildCrestSvgMarkup(crestSpec, `${uid}-cp`)}</g>`
    : `<circle cx="38" cy="53" r="1.4" fill="${tieShade}" stroke="${accent}" stroke-width="0.6"/>`;
  return `${base}${lapels}${tie}${pocketSquare}${pin}`;
}

export function faceBodySvg(
  v: number[],
  kit: string,
  trim: string,
  w = 38,
  bg = 'none',
  bare = false,
  showNo = true,
  kitSpec?: KitVisualSpec,
  isCoach = false,
  coachOutfit?: CoachOutfitId,
  coachClubKit?: string
): string {
  const ki = v[0] ?? 2;
  const hi = v[1] ?? 0;
  const hs = (v[2] ?? 0) % HS_N.length;
  const fh = (v[3] ?? 0) % FH_N.length;
  const ey = (v[4] ?? 0) % EY_N.length;
  const no = v[5] ?? 10;
  const fs = (v[6] ?? ((ki + hi + hs + no) % FS_N.length)) % FS_N.length;
  const acc = (v[7] ?? 0) % ACC_N.length;
  const sk = SKIN_P[ki] || SKIN_P[2];
  const hr = HAIR_P[hi] || HAIR_P[0];
  const irisCol = ki <= 1 || ki === 5 ? '#2c221e' : '#1b1614';

  const headD = [
    // 0: เรียว (Sharp athletic oval)
    'M16.2 24.2c0-9.6 5.6-14.5 13.8-14.5s13.8 4.9 13.8 14.5l-.8 7.8c-.6 4.2-5.8 9-13 9s-12.4-4.8-13-9z',
    // 1: กลม (Balanced athletic round)
    'M15.2 25c0-9.6 6-15 14.8-15s14.8 5.4 14.8 15c0 8.5-5.6 15.6-14.8 15.6S15.2 33.5 15.2 25z',
    // 2: กรามคม (Chiseled sharp jaw)
    'M15.8 24c0-9.2 5.7-14.2 14.2-14.2s14.2 5 14.2 14.2l-1.2 9c-.8 3.6-5.2 6.8-13 7.8-7.8-1-12.2-4.2-13-7.8z',
    // 3: เหลี่ยมคม (Strong athletic square jaw)
    'M15.4 23.8c0-9 5.6-14 14.6-14s14.6 5 14.6 14l-.6 9.8c-.4 3.4-4.6 7-14 7.2-9.4-.2-13.6-3.8-14-7.2z',
    // 4: หน้ายาว (Sleek model oval)
    'M16.8 24.2c0-9.8 5.2-14.8 13.2-14.8s13.2 5 13.2 14.8l-.8 9c-.6 4.5-5 8-12.4 8s-11.8-3.5-12.4-8z',
    // 5: โหนกแก้มชัด (Sculpted cheekbones)
    'M15.4 24c0-9.2 6-14.2 14.6-14.2s14.6 5 14.6 14.2l-1.8 6.4-3.6 7c-1.8 2-5.2 3.4-9.2 3.4s-7.4-1.4-9.2-3.4l-3.6-7z'
  ][fs];

  const hBackHtml =
    hs === 10
      ? `<ellipse cx="30" cy="6.6" rx="4.4" ry="3.8" fill="${hr}"/><path d="M26.2 6.8c1.6-1.8 6-1.8 7.6 0" stroke="#fff" stroke-width="0.8" opacity="0.22" fill="none" stroke-linecap="round"/><path d="M25.6 9.3q4.4 1.1 8.8 0" stroke="${trim}" stroke-width="1.55" fill="none" stroke-linecap="round"/>`
      : hs === 11
        ? `<path d="M14.4 22.8c-.7 4-.9 8.2-.4 12.2M16.4 24.5c-.4 3.8-.5 7.4 0 11M45.6 22.8c.7 4 .9 8.2.4 12.2M43.6 24.5c.4 3.8.5 7.4 0 11" stroke="${hr}" stroke-width="2.3" stroke-linecap="round" fill="none"/><path d="M14.4 25.5c-.5 3.2-.6 6.2-.3 9M45.6 25.5c.5 3.2.6 6.2.3 9" stroke="#000" stroke-width="0.7" opacity="0.22" stroke-linecap="round" fill="none"/>`
        : hs === 12
          ? `<path d="M15.8 25.5c-1.1 4.2-2.2 8.2-1.2 12 1.3-.9 2.4-2.1 3.2-3.4l.8 2.2 1.8-2.6zM44.2 25.5c1.1 4.2 2.2 8.2 1.2 12-1.3-.9-2.4-2.1-3.2-3.4l-.8 2.2-1.8-2.6z" fill="${hr}"/><path d="M14.9 33.8c1-.6 2-1.6 2.8-2.8M45.1 33.8c-1-.6-2-1.6-2.8-2.8" stroke="#000" stroke-width="0.65" opacity="0.18" fill="none" stroke-linecap="round"/>`
          : hs === 18
            ? `<path d="M15.4 24.8c-1.5 4.4-2.4 8.6-1 12.6 1.5-.8 2.7-1.9 3.6-3.2l.9 1.9c1.1-1.3 1.8-2.8 2.1-4.5zM44.6 24.8c1.5 4.4 2.4 8.6 1 12.6-1.5-.8-2.7-1.9-3.6-3.2l-.9 1.9c-1.1-1.3-1.8-2.8-2.1-4.5z" fill="${hr}"/><path d="M15 33.2c1.2-.8 2.3-1.9 3-3.2M45 33.2c-1.2-.8-2.3-1.9-3-3.2" stroke="#000" stroke-width="0.7" opacity="0.2" fill="none" stroke-linecap="round"/>`
            : hs === 25
              ? `<path d="M15.1 24.6c-1.3 3.6-1.8 7.4-.6 10.8 1.3-.6 2.3-1.6 3.1-2.9l.8 1.6c.9-1.1 1.5-2.4 1.8-3.9zM44.9 24.6c1.3 3.6 1.8 7.4.6 10.8-1.3-.6-2.3-1.6-3.1-2.9l-.8 1.6c-.9-1.1-1.5-2.4-1.8-3.9z" fill="${hr}"/><path d="M14.8 31.8c1-.7 2-1.6 2.6-2.7M45.2 31.8c-1-.7-2-1.6-2.6-2.7" stroke="#000" stroke-width="0.65" opacity="0.18" fill="none" stroke-linecap="round"/>`
              : '';

  const hHtml = [
    // 0: คลาสสิก (Clean tapered athletic cut)
    `<path d="M15.4 25.4c-.2-1.9 0-3.4.3-4.6 1-8.2 6.8-13 14.3-13s13.3 4.8 14.3 13c.3 1.2.5 2.7.3 4.6l-1.4-2.2c-1-3.4-4-5.8-8.2-6.4-2-.3-3.6-.1-5 .3-1.4-.4-3-.6-5-.3-4.2.6-7.2 3-8.2 6.4z" fill="${hr}"/><path d="M20.4 11.9c5.6-2.2 13.6-2.2 19.2 0" stroke="#fff" stroke-width="0.9" opacity="0.22" fill="none" stroke-linecap="round"/><path d="M24.2 11.2c-1 2.2-1.3 4.1-.8 5.6" stroke="#000" stroke-width="0.65" opacity="0.16" fill="none" stroke-linecap="round"/>`,
    // 1: สไปกี้ (Sleek sculpted athletic spikes)
    `<path d="M15.8 25c.1-3.2.8-5.8 2.1-7.8 2.2-3.4 6.6-5.2 12.1-5.2s9.9 1.8 12.1 5.2c1.3 2 2 4.6 2.1 7.8l-1.3-1.8c-1.8-3.8-6.4-6-12.9-6s-11.1 2.2-12.9 6z" fill="${hr}" opacity="0.35"/><path d="M16.8 21.8c-.4-3.8 1-7.2 3.2-9.2l-.8-2.6c1.6.4 2.9 1.2 4 2.4.6-2.5 1.8-4.5 3.6-5.6.4 1.6.9 2.9 1.6 3.8 1-2.6 2.5-4.4 4.5-5.2.1 1.8.4 3.3 1 4.4 1.5-1.9 3.3-3 5.2-3.3-.6 1.7-.9 3.3-.8 4.8 1.4-.9 2.8-1.4 4.1-1.3-.9 1.7-1.2 3.5-.8 5.4.8 1.9 1.1 4 1 6.4-2.8-4-7.6-5.8-12.9-5.8s-10.1 1.8-12.9 5.8z" fill="${hr}"/><path d="M23.8 13.4c1.2-2.2 2.8-3.8 4.5-4.8M30.5 13c1.1-2.2 2.4-3.8 4-4.7" stroke="#fff" stroke-width="0.75" opacity="0.22" fill="none" stroke-linecap="round"/>`,
    // 2: ปัดข้าง (Handsome side-swept bangs)
    `<path d="M15.4 25.6c-.2-10.8 6.4-17.6 15.2-17.6 8.6 0 14.2 6.6 14 17.4l-1.3-2.2c-1.2-4-4.8-6.2-10-6.2-4.8 0-9.6 1.8-14.6 5.4-1.2.8-2.3 2-3.3 3.2z" fill="${hr}"/><path d="M18.6 18.8c4.8-3.4 11.4-4.4 18.2-2.8" stroke="#000" stroke-width="0.7" opacity="0.16" fill="none" stroke-linecap="round"/><path d="M20.8 12.2c5.4-2.5 12-2.5 17 .2" stroke="#fff" stroke-width="0.95" opacity="0.23" fill="none" stroke-linecap="round"/>`,
    // 3: หยิกฟู (Modern curly taper fade)
    `<path d="M15.8 25c.3-4.6 1.6-8.4 4-10.8h20.4c2.4 2.4 3.7 6.2 4 10.8l-1.3-1.8c-1.6-3.8-6-6-12.9-6s-11.3 2.2-12.9 6z" fill="${hr}" opacity="0.32"/><path d="M17.2 20.6c-1.1-1.9-.6-4.4 1.2-5.7-.3-2.4 1.4-4.7 3.8-5.1 1.2-2.3 4.2-3.4 6.6-2.3 1.4-1.2 3.8-1.2 5.2 0 2.4-1.1 5.4 0 6.6 2.3 2.4.4 4.1 2.7 3.8 5.1 1.8 1.3 2.3 3.8 1.2 5.7-1.4-2.2-3.2-3.7-5.6-4.3-1 .8-2.3 1-3.5.5-1.2 1-2.8 1.2-4.2.5-1.3.9-3.1.9-4.4 0-1.4.7-3 .5-4.2-.5-1.2.5-2.5.3-3.5-.5-2.4.6-4.2 2.1-5.6 4.3z" fill="${hr}"/><path d="M21 12.2c1.2-1.3 3-1.4 4.4-.2M27.4 10.8c1.5-1.4 3.7-1.4 5.2 0M34.6 12c1.4-1.2 3.2-1.1 4.4.2" stroke="#fff" stroke-width="0.8" opacity="0.2" fill="none" stroke-linecap="round"/>`,
    // 4: สกินเฮด (Crisp pro buzz cut & line-up)
    `<path d="M15.8 23.4c.7-8.4 6-13.6 14.2-13.6s13.5 5.2 14.2 13.6l-1.1-1.6c-1.5-3.4-4.2-5.4-7-6.1-2-.5-4-.6-6.1-.6s-4.1.1-6.1.6c-2.8.7-5.5 2.7-7 6.1z" fill="${hr}" opacity="0.38"/><path d="M17.2 19.6c1.5-6.2 6-9.8 12.8-9.8s11.3 3.6 12.8 9.8c-2.8-3.4-7.2-4.8-12.8-4.8s-10 1.4-12.8 4.8z" fill="${hr}" opacity="0.62"/><path d="M18.6 17.5c3.6-2.2 7.4-2.8 11.4-2.8s7.8.6 11.4 2.8" stroke="${hr}" stroke-width="0.85" opacity="0.68" fill="none" stroke-linecap="round"/>`,
    // 5: เสยเรียบ (Sleek brushed-back star cut)
    `<path d="M15.4 25.2c.3-11 6.4-18.2 14.6-18.2s14.3 7.2 14.6 18.2l-1.4-2.4c-1.4-5.4-6.4-8.8-13.2-8.8s-11.8 3.4-13.2 8.8z" fill="${hr}"/><path d="M20.4 11.4c5.8-2.7 13.4-2.7 19.2 0" stroke="#fff" stroke-width="1.15" opacity="0.26" fill="none" stroke-linecap="round"/><path d="M23.5 13.4c4.2-1.4 8.8-1.4 13 0" stroke="#000" stroke-width="0.65" opacity="0.16" fill="none" stroke-linecap="round"/>`,
    // 6: คาดผม (Sporty headband + clean flow)
    `<path d="M15.4 25.2c0-10.8 6.4-17.2 14.6-17.2s14.6 6.4 14.6 17.2l-1.4-2.2c-1.8-4.4-6.8-6.8-13.2-6.8s-11.4 2.4-13.2 6.8z" fill="${hr}"/><path d="M20.8 11.8c5.6-2.2 12.8-2.2 18.4 0" stroke="#fff" stroke-width="0.9" opacity="0.22" fill="none" stroke-linecap="round"/><path d="M16.2 18.6c9.2-2.6 18.4-2.6 27.6 0" stroke="${trim}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M17.2 18.6c8.5-2.3 17.1-2.3 25.6 0" stroke="#fff" stroke-width="0.7" opacity="0.28" fill="none" stroke-linecap="round"/>`,
    // 7: แสกกลาง (Handsome curtain bangs)
    `<path d="M15.3 25.6c-.1-10.8 6.4-17.4 14.7-17.4s14.8 6.6 14.7 17.4l-1.4-2.2c-1.4-4-4.2-6.4-8.2-6.8-1.8 2.4-3.4 4.3-4.7 5.2-.3.2-.5.2-.8 0-1.3-.9-2.9-2.8-4.7-5.2-4 .4-6.8 2.8-8.2 6.8z" fill="${hr}"/><path d="M21 12.4c2.4-1.5 5.1-1.7 7.6-.5M31.4 11.9c2.5-1.2 5.2-1 7.6.5" stroke="#fff" stroke-width="0.85" opacity="0.22" fill="none" stroke-linecap="round"/><path d="M30 9.4v5.6" stroke="#000" stroke-width="0.7" opacity="0.18" fill="none" stroke-linecap="round"/>`,
    // 8: โมฮอว์ก (Tapered athletic burst-fade mohawk)
    `<path d="M16 24.4c.5-4.4 2.4-8.2 5.4-10.6l2 5.6c-3 .9-5.4 2.4-7.4 5zM44 24.4c-.5-4.4-2.4-8.2-5.4-10.6l-2 5.6c3 .9 5.4 2.4 7.4 5z" fill="${hr}" opacity="0.28"/><path d="M23.6 18.8c.5-7.8 2.8-13.2 6.4-13.4 3.6.2 5.9 5.6 6.4 13.4-1.8-2-3.9-2.8-6.4-2.8s-4.6.8-6.4 2.8z" fill="${hr}"/><path d="M27.4 13.8c.6-3.4 1.5-5.6 2.6-6.8M32.6 13.8c-.6-3.4-1.5-5.6-2.6-6.8" stroke="#fff" stroke-width="0.8" opacity="0.22" fill="none" stroke-linecap="round"/>`,
    // 9: อันเดอร์คัต (Crisp undercut fade + sculpted volume)
    `<path d="M15.8 25.2c.4-6.6 3.8-14.6 14.2-15.4 10.4.8 13.8 8.8 14.2 15.4l-1.3-2c-1.8-3.8-5.6-5.8-12.9-5.8s-11.1 2-12.9 5.8z" fill="${hr}" opacity="0.32"/><path d="M19.4 17.8c-.2-6.8 4.4-11.2 10.8-11.2 6.4 0 10.6 4.4 10.4 11.2-3.2-3-6.8-4.2-10.6-4.2s-7.4 1.2-10.6 4.2z" fill="${hr}"/><path d="M21.4 10.6c5.4-2 11.6-2 16.8-.2" stroke="#fff" stroke-width="0.95" opacity="0.24" fill="none" stroke-linecap="round"/><path d="M20.2 16.2c3.2-2.2 6.4-3.2 9.8-3.2" stroke="#000" stroke-width="0.7" opacity="0.18" fill="none" stroke-linecap="round"/>`,
    // 10: มัดจุก (Top knot + clean fade)
    `<path d="M15.8 25c.5-8.4 5.8-15.6 14.2-15.8 8.4.2 13.7 7.4 14.2 15.8l-1.3-2c-1.8-4.4-6.4-6.8-12.9-6.8s-11.1 2.4-12.9 6.8z" fill="${hr}" opacity="0.34"/><path d="M19 18.6c1.2-6.2 5.4-9.8 11-9.8s9.8 3.6 11 9.8c-3.2-3.2-6.8-4.6-11-4.6s-7.8 1.4-11 4.6z" fill="${hr}"/><path d="M23.5 14.2c2-2.6 4.2-4.2 6.5-4.8M36.5 14.2c-2-2.6-4.2-4.2-6.5-4.8" stroke="#000" stroke-width="0.7" opacity="0.16" fill="none" stroke-linecap="round"/>`,
    // 11: เดรดล็อก (Neat athletic braided locs)
    `<path d="M15.4 25.4c.1-10.6 6.4-17.2 14.6-17.2s14.5 6.6 14.6 17.2l-1.4-2.2c-1.8-4.4-6.8-6.6-13.2-6.6s-11.4 2.2-13.2 6.6z" fill="${hr}"/><path d="M19.2 16.4c.3-2.6 1-5 2-6.8M24.2 14.2c.2-2.8.5-5 .9-6.4M30 13.8V7.8M35.8 14.2c-.2-2.8-.5-5-.9-6.4M40.8 16.4c-.3-2.6-1-5-2-6.8" stroke="#000" stroke-width="0.9" opacity="0.24" stroke-linecap="round" fill="none"/><path d="M21.8 14.8c.2-2 .6-3.8 1.2-5.2M27.2 13.8c.1-2 .2-3.8.4-5.2M32.8 13.8c-.1-2-.2-3.8-.4-5.2M38.2 14.8c-.2-2-.6-3.8-1.2-5.2" stroke="#fff" stroke-width="0.65" opacity="0.16" stroke-linecap="round" fill="none"/>`,
    // 12: มัลเล็ต (Modern textured mullet)
    `<path d="M15.4 25.2c0-10.2 6.4-16.8 14.6-16.8s14.6 6.6 14.6 16.8l-1.3-2c-1.4-3.6-4.4-5.6-7.6-5.8-1.2 1.2-2.3 1.9-3.2 1.9-.9 0-1.7-.7-2.5-1.8-.8 1.1-1.6 1.8-2.5 1.8-.9 0-2-.7-3.2-1.9-3.2.2-6.2 2.2-7.6 5.8z" fill="${hr}"/><path d="M21 12.2c5.4-2.2 12.6-2.2 18 0" stroke="#fff" stroke-width="0.85" opacity="0.22" fill="none" stroke-linecap="round"/>`,
    // 13: หัวโล้น (Clean athletic shaved)
    `<path d="M23.5 13.2c4.2-1.8 8.8-1.8 13 0" stroke="#fff" stroke-width="1.45" opacity="0.32" fill="none" stroke-linecap="round"/>`,
    // 14: ทูบล็อกเกาหลี (Korean Two-Block feathered fringe)
    `<path d="M15.4 25.6c-.1-11 6.2-17.6 14.6-17.6s14.7 6.6 14.6 17.6l-1.4-2.4c-1.2-3.8-3.2-6.1-5.8-6.6-.4 1.6-1.3 2.9-2.4 3.7-.3-1.4-.9-2.6-1.9-3.4-.6 1.6-1.7 2.8-3.1 3.4-1.4-.6-2.5-1.8-3.1-3.4-1 .8-1.6 2-1.9 3.4-1.1-.8-2-2.1-2.4-3.7-2.6.5-4.6 2.8-5.8 6.6z" fill="${hr}"/><path d="M20.8 11.9c5.6-2.4 12.8-2.4 18.4 0" stroke="#fff" stroke-width="0.95" opacity="0.24" fill="none" stroke-linecap="round"/>`,
    // 15: แสกคอมม่า (Trendy Handsome Comma Hair)
    `<path d="M15.4 25.6c0-11 6.2-17.8 14.6-17.8s14.6 6.8 14.6 17.8l-1.3-2.3c-1.4-4-4.4-6.4-8.4-6.8 1.6 2.6 1.1 5.3-1.5 6.8-.4-2.4-1.3-4.6-2.9-6.2-1.8.8-3.1 2.4-3.7 4.4-1.8-.9-2.9-2.4-3.3-4.4-2.8.8-5.2 3.1-6.8 6.4z" fill="${hr}"/><path d="M21 11.8c5.6-2.4 12.6-2.4 18-.2" stroke="#fff" stroke-width="0.95" opacity="0.23" fill="none" stroke-linecap="round"/><path d="M31.6 11.6c1.6 1.6 2.6 3.8 2.8 6" stroke="#000" stroke-width="0.65" opacity="0.16" fill="none" stroke-linecap="round"/>`,
    // 16: เฟดควิฟฟ์ (High-volume Fade Quiff)
    `<path d="M15.8 25c.4-5.8 3.2-12.2 14.2-13.2 11 1 13.8 7.4 14.2 13.2l-1.3-2c-1.8-3.6-5.6-5.4-12.9-5.4s-11.1 1.8-12.9 5.4z" fill="${hr}" opacity="0.3"/><path d="M18.4 18.8c-.6-7.6 4.6-13.2 12.2-13.6 7-.3 11 4.6 10.6 13-2.8-3.2-6.6-4.5-11.2-4.5-4.4 0-8.4 1.6-11.6 5.1z" fill="${hr}"/><path d="M21.8 10.2c5.2-2.6 10.8-2.8 15.6-.4" stroke="#fff" stroke-width="1.05" opacity="0.27" fill="none" stroke-linecap="round"/>`,
    // 17: สลิคแบ็กเท่ (Sharp Slick-Back Pompadour)
    `<path d="M15.6 25c.4-6.4 3.4-12.4 14.4-13.4 11 1 14 7 14.4 13.4l-1.3-2.1c-2-3.9-5.8-5.7-13.1-5.7s-11.1 1.8-13.1 5.7z" fill="${hr}" opacity="0.32"/><path d="M18 18c.2-7.8 5-12.6 12-12.6 7.2 0 11.8 4.8 12 12.6-3.2-4-7.4-5.5-12-5.5s-8.8 1.5-12 5.5z" fill="${hr}"/><path d="M21.6 9.8c5.2-1.8 10.6-2 15.6-.6M23.2 11.8c4.4-1.2 9.2-1.2 13.6 0" stroke="#fff" stroke-width="0.9" opacity="0.25" fill="none" stroke-linecap="round"/>`,
    // 18: วูล์ฟคัท (Stylish Layered Wolf Cut)
    `<path d="M15 25.6c-.3-11 6.4-17.8 15-17.8s15.3 6.8 15 17.8l-1.5-2.4c-1.4-3.8-3.8-6-7.2-6.4-.4 1.6-1.3 2.8-2.4 3.6-.3-1.4-.9-2.6-1.8-3.4-.6 1.6-1.2 2.8-2.1 3.5-.9-.7-1.5-1.9-2.1-3.5-.9.8-1.5 2-1.8 3.4-1.1-.8-2-2-2.4-3.6-3.4.4-5.8 2.6-7.2 6.4z" fill="${hr}"/><path d="M20.4 11.6c6-2.5 13.2-2.5 19.2 0" stroke="#fff" stroke-width="0.9" opacity="0.22" fill="none" stroke-linecap="round"/>`,
    // 19: เท็กซ์เจอร์ครอป (Textured French Crop)
    `<path d="M15.6 25c.5-5.6 3.4-11.6 14.4-12.6 11 1 13.9 7 14.4 12.6l-1.3-2c-1.8-3.6-5.8-5.4-13.1-5.4s-11.3 1.8-13.1 5.4z" fill="${hr}" opacity="0.3"/><path d="M18.4 18.8c0-7.2 4.8-12 11.6-12s11.6 4.8 11.6 12c-1.2-1.3-2.6-2-4.2-2.1-.6 1.2-1.5 2-2.5 2.2-.8-1-1.7-1.7-2.6-1.9-.6 1.1-1.4 1.8-2.3 2-.9-.2-1.7-.9-2.3-2-.9.2-1.8.9-2.6 1.9-1-.2-1.9-1-2.5-2.2-1.6.1-3 .8-4.2 2.1z" fill="${hr}"/><path d="M22 10.8c5.2-1.9 10.8-1.9 16 0" stroke="#fff" stroke-width="0.85" opacity="0.22" fill="none" stroke-linecap="round"/><path d="M23.5 13.8l1.2 1.8M29.8 13.2v2.2M36.5 13.8l-1.2 1.8" stroke="#000" stroke-width="0.7" opacity="0.16" stroke-linecap="round"/>`,
    // 20: ปอมปาดัวร์เฟด (Classic Pompadour Taper Fade)
    `<path d="M15.8 25c.4-6.2 3.4-12.8 14.2-13.8 10.8 1 13.8 7.6 14.2 13.8l-1.3-2c-1.8-3.8-5.6-5.6-12.9-5.6s-11.1 1.8-12.9 5.6z" fill="${hr}" opacity="0.3"/><path d="M18.6 18.8c-.8-7.6 4.2-14 11.8-14.3 6.8-.3 11.2 4.1 11 12.7-2.4-2.8-5.4-4-9.6-4.1-4.8-.1-9.4 1.7-13.2 5.7z" fill="${hr}"/><path d="M21.4 9.6c5.4-2.8 11-2.7 15.8-.3" stroke="#fff" stroke-width="1.1" opacity="0.28" fill="none" stroke-linecap="round"/><path d="M22.2 13.6c4.8-2 9.8-2.1 14.8-.4" stroke="#000" stroke-width="0.65" opacity="0.16" fill="none" stroke-linecap="round"/>`,
    // 21: ไซด์พาร์ทเนี้ยบ (Gentleman Side-Part Executive Cut)
    `<path d="M15.8 25.2c.4-6.4 3.4-13 14.2-13.8 10.8.8 13.8 7.4 14.2 13.8l-1.3-2c-1.8-3.8-5.6-5.6-12.9-5.6s-11.1 1.8-12.9 5.6z" fill="${hr}" opacity="0.3"/><path d="M17.4 21.6c-.4-8.4 5-14.2 13.2-14.2 7.8 0 12.8 5.2 13 15-1.8-3.4-5.4-5.4-11-5.4-4.4 0-8.6 1.1-11.8 3.6l-.8-3.4c-1.1 1.2-2 2.7-2.6 4.4z" fill="${hr}"/><path d="M21.8 10.2l-.8 4.4" stroke="${sk}" stroke-width="0.95" opacity="0.72" stroke-linecap="round"/><path d="M24.2 10.8c5.2-2.2 11.2-1.8 15.6.8" stroke="#fff" stroke-width="0.95" opacity="0.25" fill="none" stroke-linecap="round"/>`,
    // 22: ดรอปเฟดลอนคลื่น (Wavy Drop Fade)
    `<path d="M15.8 25c.4-5.8 3.2-12 14.2-12.8 11 .8 13.8 7 14.2 12.8l-1.3-1.9c-1.8-3.6-5.6-5.3-12.9-5.3s-11.1 1.7-12.9 5.3z" fill="${hr}" opacity="0.28"/><path d="M17.4 20.6c-.4-6.4 3.4-12.8 12.6-13.2 9.2.4 13 6.8 12.6 13.2-1.6-2-3.4-3-5.4-3.1-1.2 1.6-2.7 2.4-4.2 2.2-1.4-1.4-3-2-4.6-1.8-1.4 1.6-3 2.3-4.6 2-1.8-1.1-3.8-1.1-6.4.7z" fill="${hr}"/><path d="M21 12.6q2.6-2.2 5.2 0M28 11.8q2.6-2.2 5.2 0M34.6 12.8q2.2-1.8 4.4 0" stroke="#fff" stroke-width="0.85" opacity="0.23" fill="none" stroke-linecap="round"/>`,
    // 23: คอมม่าทูบล็อก (Soft Curtain Comma Two-Block)
    `<path d="M15.4 25.4c-.1-10.8 6.4-17.6 14.6-17.6s14.7 6.8 14.6 17.6l-1.3-2.2c-1.2-3.8-3.6-6-6.8-6.4 1.2 2.4.7 4.8-1.6 6.2-.4-2.2-1.3-4.2-2.7-5.6-1.3 1-2.5 2.4-3.2 4.1-1-1.8-2.2-3.2-3.8-4-1.6 1-2.8 2.5-3.6 4.4-1.4-1.4-2.2-3.1-2.4-5-1.6.9-2.8 2.8-3.8 8.5z" fill="${hr}"/><path d="M21 11.6c5.6-2.3 12.4-2.3 18 0" stroke="#fff" stroke-width="0.95" opacity="0.24" fill="none" stroke-linecap="round"/><path d="M29.4 9.6v4.6" stroke="#000" stroke-width="0.65" opacity="0.17" fill="none" stroke-linecap="round"/>`,
    // 24: เบิรสต์เฟดตั้งเท่ (Burst Fade Textured Faux Hawk)
    `<path d="M16 24.4c.5-4.4 2.4-8.2 5.4-10.6l2 5.6c-3 .9-5.4 2.4-7.4 5zM44 24.4c-.5-4.4-2.4-8.2-5.4-10.6l-2 5.6c3 .9 5.4 2.4 7.4 5z" fill="${hr}" opacity="0.26"/><path d="M20.6 18.6c-.2-5.4 2.2-10.8 5.6-12.8l1.4 3.4c1.2-2.6 3-4.3 5-4.8l.8 3.6c1.6-2 3.4-3 5.2-2.8-.4 2.2-.2 4.2.8 5.8 1.2 2 1.7 4.4 1.5 7.6-2.8-3.4-6.6-4.8-10.9-4.8s-7.4 1.4-9.4 4.8z" fill="${hr}"/><path d="M26.2 12.6c1-2.2 2.2-3.8 3.6-4.8M31.6 12.4c.9-2.1 2-3.6 3.4-4.5" stroke="#fff" stroke-width="0.85" opacity="0.24" fill="none" stroke-linecap="round"/>`,
    // 25: ซอฟต์เซอร์เฟอร์ (Handsome Layered Surfer Flow)
    `<path d="M15 25.4c-.3-10.8 6.4-17.4 15-17.4s15.3 6.6 15 17.4l-1.4-2.2c-1.4-4-4.2-6.2-7.8-6.4-1.4 2.2-3 3.6-4.6 4.2-.6-1.4-1-3-1.2-4.6-.2 1.6-.6 3.2-1.2 4.6-1.6-.6-3.2-2-4.6-4.2-3.6.2-6.4 2.4-7.8 6.4z" fill="${hr}"/><path d="M20.4 11.8c3.2-1.8 6.4-2.2 9.2-1.2M30.4 10.6c2.8-1 6-.6 9.2 1.2" stroke="#fff" stroke-width="0.9" opacity="0.23" fill="none" stroke-linecap="round"/>`
  ][hs];

  const fhHtml =
    fh === 1
      ? `<path d="M25.5 37.2c1.8 2.6 7.2 2.6 9 0-.8 3.4-8.2 3.4-9 0z" fill="${hr}" opacity="0.86"/>`
      : fh === 2
        ? `<path d="M17.2 29.2c1 8.4 5.8 12.2 12.8 12.2s11.8-3.8 12.8-12.2c-2 4.8-6 7.6-12.8 7.6s-10.8-2.8-12.8-7.6z" fill="${hr}" opacity="0.78"/>`
        : fh === 3
          ? `<path d="M24.2 33.1q5.8-2.2 11.6 0q-5.8.9-11.6 0z" fill="${hr}" opacity="0.88"/>`
          : fh === 4
            ? `<path d="M18.6 31.2c1.2 6.4 5 9.4 11.4 9.4s10.2-3 11.4-9.4c-2 4.2-5.6 6.6-11.4 6.6s-9.4-2.4-11.4-6.6z" fill="${hr}" opacity="0.28"/>`
            : fh === 5
              ? `<path d="M24.2 33q5.8-2.1 11.6 0q-5.8 1-11.6 0zM25.8 36.8c1.6 2.5 6.8 2.5 8.4 0-.8 3.2-7.6 3.2-8.4 0z" fill="${hr}" opacity="0.88"/>`
              : fh === 6
                ? `<path d="M16.2 25.4l1.5 7c1.5 4.8 5.6 8 12.3 8s10.8-3.2 12.3-8l1.5-7-1.4 5c-1.8 4.8-5.8 7.5-12.4 7.5s-10.6-2.7-12.4-7.5z" fill="${hr}" opacity="0.78"/>`
                : fh === 7
                  ? `<path d="M16.6 28.4c.8 9.2 5.6 13.6 13.4 13.6s12.6-4.4 13.4-13.6c-2 4.5-5.4 7-9.2 7.8v-2.2q-4.2-1.5-8.4 0v2.2c-3.8-.8-7.2-3.3-9.2-7.8z" fill="${hr}" opacity="0.9"/>`
                  : '';

  const br =
    ey === 1
      ? `<path d="M19.8 22.3l6.8 1.1M40.2 22.3l-6.8 1.1" stroke="${hr}" stroke-width="1.85" fill="none" stroke-linecap="round"/>`
      : ey === 3
        ? `<path d="M19.8 22.6q3.5-.7 6.8.1M33.4 22.7q3.3-.8 6.8-.1" stroke="${hr}" stroke-width="1.65" fill="none" stroke-linecap="round"/>`
        : ey === 4
          ? `<path d="M19.4 21.5l7.2 2M40.6 21.5l-7.2 2" stroke="${hr}" stroke-width="2" fill="none" stroke-linecap="round"/>`
          : ey === 5
            ? `<path d="M19.8 22.6q3.5-1.3 6.8-.1M33.2 21.7q3.6-2 7-.4" stroke="${hr}" stroke-width="1.65" fill="none" stroke-linecap="round"/>`
            : ey === 6
              ? `<path d="M19.8 21.6q3.6-1.9 6.8 0M33.4 21.6q3.6-1.9 6.8 0" stroke="${hr}" stroke-width="1.55" fill="none" stroke-linecap="round"/>`
              : ey === 7
                ? `<path d="M19.6 22.8l7-.3M33.4 22.5l7 .3" stroke="${hr}" stroke-width="1.75" fill="none" stroke-linecap="round"/>`
                : ey === 8
                  ? `<path d="M19.5 22.2q3.6-1.7 7.1.2M33.4 22.4q3.5-1.9 7.1-.2" stroke="${hr}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`
                  : ey === 9
                    ? `<path d="M19.8 22.3q3.5-1.6 6.8-.1M33.4 22.2q3.3-1.5 6.8.1" stroke="${hr}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
                    : `<path d="M19.8 22.4q3.6-1.5 6.8 0M33.4 22.4q3.6-1.5 6.8 0" stroke="${hr}" stroke-width="1.7" fill="none" stroke-linecap="round" opacity="0.92"/>`;

  const eyes =
    ey === 3 || ey === 7
      ? `<ellipse cx="23.8" cy="26.8" rx="2.65" ry="1.45" fill="#fff" opacity="0.94"/><ellipse cx="36.2" cy="26.8" rx="2.65" ry="1.45" fill="#fff" opacity="0.94"/><circle cx="23.8" cy="26.8" r="1.4" fill="${irisCol}"/><circle cx="36.2" cy="26.8" r="1.4" fill="${irisCol}"/><circle cx="23.2" cy="26.3" r="0.55" fill="#fff"/><circle cx="35.6" cy="26.3" r="0.55" fill="#fff"/><circle cx="24.4" cy="27.2" r="0.28" fill="#fff" opacity="0.72"/><circle cx="36.8" cy="27.2" r="0.28" fill="#fff" opacity="0.72"/><path d="M20.8 25.5q3-.95 5.8 0M33.4 25.5q2.8-.95 5.8 0" stroke="#16161a" stroke-width="1.45" fill="none" stroke-linecap="round"/>`
      : ey === 6 || ey === 9
        ? `<ellipse cx="23.8" cy="26.7" rx="2.8" ry="2.05" fill="#fff" opacity="0.97"/><ellipse cx="36.2" cy="26.7" rx="2.8" ry="2.05" fill="#fff" opacity="0.97"/><circle cx="23.8" cy="26.7" r="1.75" fill="${irisCol}"/><circle cx="36.2" cy="26.7" r="1.75" fill="${irisCol}"/><circle cx="23.1" cy="26" r="0.74" fill="#fff"/><circle cx="35.5" cy="26" r="0.74" fill="#fff"/><circle cx="24.5" cy="27.3" r="0.36" fill="#fff" opacity="0.82"/><circle cx="36.9" cy="27.3" r="0.36" fill="#fff" opacity="0.82"/><path d="M20.6 25.4q3.2-1.45 6.2-.1M33.2 25.3q3-1.35 6.2.1" stroke="#16161a" stroke-width="1.48" fill="none" stroke-linecap="round"/>`
        : `<ellipse cx="23.8" cy="26.8" rx="2.65" ry="1.72" fill="#fff" opacity="0.95"/><ellipse cx="36.2" cy="26.8" rx="2.65" ry="1.72" fill="#fff" opacity="0.95"/><circle cx="23.8" cy="26.8" r="1.6" fill="${irisCol}"/><circle cx="36.2" cy="26.8" r="1.6" fill="${irisCol}"/><circle cx="23.2" cy="26.2" r="0.62" fill="#fff" opacity="0.95"/><circle cx="35.6" cy="26.2" r="0.62" fill="#fff" opacity="0.95"/><circle cx="24.4" cy="27.2" r="0.3" fill="#fff" opacity="0.72"/><circle cx="36.8" cy="27.2" r="0.3" fill="#fff" opacity="0.72"/><path d="M20.8 25.5q3-1.25 5.9 0M33.3 25.5q2.9-1.25 5.9 0" stroke="#16161a" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;

  const mo =
    ey === 2 || ey === 6
      ? `<path d="M26 34.2q4 2.8 8 0q-4 1.6-8 0z" fill="#fff" stroke="#2a1e1a" stroke-width="0.9" stroke-linejoin="round"/><path d="M28.2 37.4q1.8.6 3.6 0" stroke="#000" opacity="0.16" stroke-width="0.75" fill="none" stroke-linecap="round"/>`
      : ey === 1
        ? `<path d="M26.6 34.8h6.8" stroke="#2a1e1a" stroke-width="1.35" stroke-linecap="round"/><path d="M28.4 37.3q1.6.5 3.2 0" stroke="#000" opacity="0.15" stroke-width="0.75" fill="none" stroke-linecap="round"/>`
        : ey === 3 || ey === 7
          ? `<path d="M26.4 34.8q3.6 1 7.2-.5" stroke="#2a1e1a" fill="none" stroke-width="1.3" stroke-linecap="round"/><path d="M28.4 37.4q1.6.5 3.2 0" stroke="#000" opacity="0.14" stroke-width="0.75" fill="none" stroke-linecap="round"/>`
          : ey === 4
            ? `<path d="M26.2 35.4q3.8-1.4 7.6 0" stroke="#2a1e1a" fill="none" stroke-width="1.4" stroke-linecap="round"/>`
            : ey === 5 || ey === 8 || ey === 9
              ? `<path d="M26.2 34.6q4 1.8 7.8-1.1" stroke="#2a1e1a" fill="none" stroke-width="1.35" stroke-linecap="round"/><path d="M28.4 37.4q1.6.6 3.2 0" stroke="#000" opacity="0.15" stroke-width="0.75" fill="none" stroke-linecap="round"/>`
              : `<path d="M26.5 34.4q3.5 1.9 7 0" stroke="#2a1e1a" fill="none" stroke-width="1.3" stroke-linecap="round"/><path d="M28.4 37.3q1.6.5 3.2 0" stroke="#000" opacity="0.14" stroke-width="0.75" fill="none" stroke-linecap="round"/>`;

  const uid = kitSpec?.uid || `f${(++_faceSeq).toString(36)}`;
  const pat = kitSpec?.kitPattern ?? 0;
  const collar = kitSpec?.collar ?? 0;
  const accent = kitSpec?.accent || trim;

  const accUnderHairHtml =
    acc === 2
      ? `<rect x="35.8" y="30.2" width="5.4" height="2.3" rx="0.8" transform="rotate(-14 38.5 31.3)" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.45"/><path d="M37.3 31.3h2.2" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="0.6 0.6"/>`
      : acc === 3
        ? `<rect x="27.4" y="28.3" width="5.2" height="1.7" rx="0.65" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.45"/>`
        : acc === 4
          ? `<path d="M21.4 20.5l-1.3 4" stroke="${sk}" stroke-width="1.35" stroke-linecap="round"/>`
          : acc === 6
            ? `<path d="M18.2 26.8c1-2.6 4.2-3.4 6.8-2.2l3 2.4h4l3-2.4c2.6-1.2 5.8-.4 6.8 2.2l-1.1 3.7c-1.5 2-4.4 2.2-6.5.8l-2.4-1.6h-3.6l-2.4 1.6c-2.1 1.4-5 1.2-6.5-.8z" fill="#1e293b" fill-opacity="0.76" stroke="#94a3b8" stroke-width="0.75"/>`
            : acc === 7
              ? `<rect x="19" y="30.6" width="5.2" height="1.3" rx="0.5" fill="${kit}"/><rect x="19.3" y="32.4" width="4.6" height="1.1" rx="0.5" fill="${trim}"/><rect x="35.8" y="30.6" width="5.2" height="1.3" rx="0.5" fill="${kit}"/><rect x="36.1" y="32.4" width="4.6" height="1.1" rx="0.5" fill="${trim}"/>`
              : '';

  const accOverHairHtml =
    acc === 1
      ? `<path d="M16 18.8q14-3.4 28 0" stroke="${accent}" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M16.5 18.8q13.5-3.2 27 0" stroke="${trim}" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>`
      : acc === 5
        ? `<rect x="19.8" y="24.5" width="8.2" height="4.8" rx="1.6" fill="#0f172a" fill-opacity="0.34" stroke="#0f172a" stroke-width="1.15"/><rect x="32" y="24.5" width="8.2" height="4.8" rx="1.6" fill="#0f172a" fill-opacity="0.34" stroke="#0f172a" stroke-width="1.15"/><path d="M28 26.8h4M16.8 26.5l3 .4M40.2 26.9l3-.4" stroke="#0f172a" stroke-width="1.05" stroke-linecap="round"/>`
        : '';

  const torsoPath = 'M8 64c0-14 7-20 22-20s22 6 22 20z';
  const torsoDefs = `<defs><clipPath id="jk-${uid}"><path d="${torsoPath}"/></clipPath>${
    !bare
      ? `<linearGradient id="bg-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${kit}" stop-opacity="0.26"/><stop offset="55%" stop-color="${kit}" stop-opacity="0.11"/><stop offset="100%" stop-color="${trim}" stop-opacity="0.2"/></linearGradient><radialGradient id="gl-${uid}" cx="50%" cy="32%" r="55%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`
      : ''
  }${
    !isCoach && pat === 11
      ? `<linearGradient id="fg-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${kit}"/><stop offset="100%" stop-color="${trim}"/></linearGradient>`
      : ''
  }</defs>`;
  const torsoBody = isCoach
    ? `<g clip-path="url(#jk-${uid})">${renderCoachTorso(coachOutfit, coachClubKit || kit, trim, accent, kitSpec?.crestSpec, uid)}<path d="M10.5 51.5c4.5-5.2 11.2-7.1 19.5-7.1s15 1.9 19.5 7.1" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1.1"/></g><path d="${torsoPath}" fill="none" stroke="#0f172a" stroke-opacity="0.34" stroke-width="0.9"/>`
    : `<g clip-path="url(#jk-${uid})">${renderFaceTorsoPattern(pat, kit, trim, accent, uid)}<path d="M12 52l4 12M48 52l-4 12" stroke="${accent}" stroke-width="1.6" opacity="0.32"/><path d="M10.5 51.5c4.5-5.2 11.2-7.1 19.5-7.1s15 1.9 19.5 7.1" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1.15"/>${renderFaceCollar(collar, trim, accent)}</g><path d="${torsoPath}" fill="none" stroke="#0f172a" stroke-opacity="0.32" stroke-width="0.9"/>`;
  const chestCrest =
    !isCoach && kitSpec?.crestSpec
      ? `<g transform="translate(35.8, 49.5) scale(0.32)">${buildCrestSvgMarkup(kitSpec.crestSpec, `${uid}-cc`)}</g>`
      : '';
  const noX = kitSpec?.crestSpec ? '22.5' : '30';
  const noY = kitSpec?.crestSpec ? '59.5' : '60';
  const noSize = kitSpec?.crestSpec ? '8.4' : '10';
  const noMarkup =
    !isCoach && showNo && w >= 44
      ? `<text x="${noX}" y="${noY}" text-anchor="middle" font-size="${noSize}" font-weight="800" font-family="Sarabun" fill="#fff" stroke="#0007" stroke-width="0.9" paint-order="stroke" opacity="0.95">${no || 10}</text>`
      : '';

  return `${torsoDefs}${bare ? '' : `<rect width="60" height="64" fill="url(#bg-${uid})"/><rect width="60" height="64" fill="url(#gl-${uid})"/>`}${torsoBody}${chestCrest}${noMarkup}<path d="M25.2 36h9.6v9.8q-4.8 3-9.6 0z" fill="${sk}" stroke="#0f172a" stroke-opacity="0.18" stroke-width="0.5"/><path d="M25.2 38.4q4.8 3.4 9.6 0v3.1q-4.8 2.4-9.6 0z" fill="#000" opacity="0.18"/>${hBackHtml}<path d="M15.8 25.4c-1.8-.3-2.5 1.4-2 3.2.4 1.5 1.3 2.1 2.2 1.8z" fill="${sk}" stroke="#0f172a" stroke-opacity="0.2" stroke-width="0.5"/><path d="M44.2 25.4c1.8-.3 2.5 1.4 2 3.2-.4 1.5-1.3 2.1-2.2 1.8z" fill="${sk}" stroke="#0f172a" stroke-opacity="0.2" stroke-width="0.5"/><path d="M15.3 26.8c-.35.75-.05 1.5.5 1.75M44.7 26.8c.35.75.05 1.5-.5 1.75" stroke="#0f172a" stroke-opacity="0.16" stroke-width="0.55" fill="none" stroke-linecap="round"/><path d="${headD}" fill="${sk}" stroke="#0f172a" stroke-opacity="0.24" stroke-width="0.65"/><path d="M18.2 33.8c2.2 3.6 6.8 6.4 11.8 6.6 5-.2 9.6-3 11.8-6.6-2.4 3.4-6.8 5.2-11.8 5.3-5-.1-9.4-1.9-11.8-5.3z" fill="#000" opacity="0.075"/><ellipse cx="21.4" cy="30.6" rx="2.3" ry="1.15" fill="#e11d48" opacity="0.065"/><ellipse cx="38.6" cy="30.6" rx="2.3" ry="1.15" fill="#e11d48" opacity="0.065"/>${fhHtml}<path d="M30 25.2v5c0 .8-.7 1.3-1.6 1.3" stroke="#000" opacity="0.2" stroke-width="1.05" fill="none" stroke-linecap="round"/><ellipse cx="30" cy="29.7" rx="0.65" ry="0.95" fill="#fff" opacity="0.16"/><path d="M29.4 31.6q.6.4 1.3.1" stroke="#000" opacity="0.16" stroke-width="0.8" fill="none" stroke-linecap="round"/>${br}${eyes}${mo}${accUnderHairHtml}${hHtml}${accOverHairHtml}`;
}

export const PlayerFace: React.FC<{
  player?: Partial<Player> | null;
  team?: Team | null;
  state?: GameState | null;
  careerProfile?: PlayerCareerProfile | null;
  club?: ClubIdentity | null;
  isMyClub?: boolean;
  isGK?: boolean;
  size?: number;
  bare?: boolean;
  kitColor?: string;
  trimColor?: string;
  isCoach?: boolean;
  coachOutfit?: CoachOutfitId;
  coachClubKit?: string;
}> = React.memo(({ player, team, state, careerProfile, club, isMyClub, isGK: isGKProp, size = 38, bare = false, kitColor, trimColor, isCoach = false, coachOutfit, coachClubKit }) => {
  const uid = React.useId().replace(/:/g, '');
  const q = player || {};
  const resolvedNo = q.no || (team && q.n ? getShirtNo(team, q) : undefined) || (q.me ? (careerProfile || state?.p)?.no : undefined);
  const v = visOf(resolvedNo ? { ...q, no: resolvedNo } : q, careerProfile || state?.p);
  const teamKit = team ? tc(team, state) : null;
  const teamTrim = team ? tc(team, state, true) : null;
  const isGK = !isCoach && (isGKProp !== undefined ? isGKProp : (q.pos === 'GK' || q.ro === 'GK'));
  const resolvedOutfit: CoachOutfitId | undefined = isCoach
    ? coachOutfit || (isMyClub ? club?.managerOutfit : undefined) || (state && team?.id === state.me ? state.club?.managerOutfit : undefined) || 'suit_navy'
    : undefined;
  const resolvedClubKit = coachClubKit || teamKit || club?.c1 || '#1e293b';
  const careerShirt = q.me && (careerProfile || state?.p) ? (careerProfile || state?.p)!.c : undefined;
  const gkPalette = resolveGkKitPalette(teamKit || careerShirt || '#2f6fd6', teamTrim || club?.c2 || '', kitColor);
  const kc = kitColor
    ? kitColor
    : isCoach
      ? '#1e293b'
      : isGK
        ? gkPalette.kit
        : teamKit
          ? teamKit
          : careerShirt
            ? careerShirt
            : '#2f6fd6';
  const tr = isGK
    ? (trimColor && trimColor !== teamTrim ? trimColor : gkPalette.trim)
    : trimColor
      ? trimColor
      : teamTrim || club?.c2 || '#ffd75e';
  const bg = bare ? 'transparent' : `color-mix(in srgb, ${kc} 18%, transparent)`;
  const kitSpec = resolveKitVisualForFace(team, state, club, isMyClub, kc, tr, isGK, uid, q.n);
  return (
    <svg
      className={`shrink-0 ${bare ? '' : 'rounded-xl border border-[var(--line)]'}`}
      width={size}
      height={Math.round((size * 64) / 60)}
      viewBox="0 0 60 64"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: faceBodySvg(v, kc, tr, size, bg, bare, !isCoach, kitSpec, isCoach, resolvedOutfit, resolvedClubKit) }}
    />
  );
});

export const PITCH_SVG_BASE =
  '<rect width="300" height="380" fill="#25834f"/><path fill="#2d965c" d="M0 0h300v47.5H0zM0 95h300v47.5H0zM0 190h300v47.5H0zM0 285h300v47.5H0z"/><g fill="none" stroke="#eef2e6" stroke-width="1.6" opacity="0.85"><rect x="6" y="6" width="288" height="368"/><path d="M6 190h288M90 6v58h120V6M90 374v-58h120v58M118 6v20h64V6M118 374v-20h64v20M124.63 64A32 32 0 0 0 175.37 64M124.63 316A32 32 0 0 1 175.37 316M13 6A7 7 0 0 1 6 13M294 13A7 7 0 0 1 287 6M287 374A7 7 0 0 1 294 367M6 367A7 7 0 0 1 13 374"/><circle cx="150" cy="190" r="36"/></g><g fill="#eef2e6" opacity="0.88"><circle cx="150" cy="190" r="2.2"/><circle cx="150" cy="44.5" r="2"/><circle cx="150" cy="335.5" r="2"/></g>';

export const TacticsMiniPitch: React.FC<{ team: Team; state?: GameState | null }> = ({ team, state }) => {
  const uid = React.useId().replace(/:/g, '');
  const col = tc(team, state);
  const trCol = tc(team, state, true);
  const gkPal = resolveGkKitPalette(col, trCol);
  const gkCol = gkPal.kit;
  const gkTrCol = gkPal.trim;
  const slots = getFormationSlots(team);
  const starters = xi(team);
  return (
    <svg className="w-full max-w-[200px] mx-auto rounded-xl block" viewBox="0 0 300 380" role="img" aria-label={`ผังแผน ${team.form}`}>
      <defs>
        <clipPath id={`mfc-${uid}`}>
          <circle cx="30" cy="31" r="27" />
        </clipPath>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />
      {slots.map((z, idx) => {
        const q = starters[idx];
        const cx = 18 + z.x * 2.64;
        const cy = 16 + z.y * 3.48;
        const slotIsGK = z.sp === 'GK';
        const kc = slotIsGK ? gkCol : col;
        const slotTrim = slotIsGK ? gkTrCol : trCol;
        const isMe = !!(q?.me || (state?.mode === 'p' && state?.p?.name === q?.n));
        const sc = 0.5;
        return (
          <g key={idx}>
            <circle cx={cx} cy={cy} r={16} fill={kc} stroke={isMe ? '#f5c242' : '#fff'} strokeWidth={isMe ? 2.8 : 2.2} />
            {q && (
              <g
                transform={`translate(${(cx - 30 * sc).toFixed(1)},${(cy - 31 * sc).toFixed(1)}) scale(${sc})`}
                clipPath={`url(#mfc-${uid})`}
                dangerouslySetInnerHTML={{
                  __html: faceBodySvg(
                    visOf(q, state?.p),
                    kc,
                    slotTrim,
                    32,
                    '#10281d',
                    true,
                    false,
                    resolveKitVisualForFace(team, state, null, undefined, kc, slotTrim, slotIsGK, `${uid}-m-${idx}`, q.n)
                  )
                }}
              />
            )}
            {(() => {
              const posPal = getPositionCanvasPalette(z.sp);
              const bw = isMe ? (z.sp.length >= 3 ? 34 : 30) : z.sp.length >= 3 ? 28 : 25;
              const bh = 12.5;
              return (
                <>
                  <rect
                    x={cx - bw / 2}
                    y={cy + 9.5}
                    width={bw}
                    height={bh}
                    rx="3.8"
                    fill={posPal.bg}
                    stroke={isMe ? '#f5c242' : 'rgba(6, 20, 13, 0.88)'}
                    strokeWidth={isMe ? '1.15' : '0.85'}
                  />
                  <text
                    x={cx}
                    y={cy + 9.5 + bh / 2 + 0.3}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="8"
                    fontWeight="800"
                    fontFamily="Sarabun"
                    fill={posPal.text}
                  >
                    {isMe && <tspan fill="#fde047">★ </tspan>}
                    {z.sp}
                  </text>
                </>
              );
            })()}
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


export interface PitchPlayerMeta {
  rating?: number;
  goals?: number;
  assists?: number;
  yellowCards?: number;
  isRed?: boolean;
  isInjured?: boolean;
  subInMin?: number;
  subOutMin?: number;
  isMotm?: boolean;
  fitVal?: number;
  offPosPen?: number;
  dim?: boolean;
}

export const FormationPitch: React.FC<{
  team: Team;
  state: GameState;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  showPositionZones?: boolean;
  dragSourceName?: string | null;
  dropTargetName?: string | null;
  dragPreview?: PitchDragPreview | null;
  touchPointerPitchPt?: { px: number; py: number } | null;
  onPlayerPointerDown?: (e: React.PointerEvent, player: Player, slotSp: SubRole, slotIdx?: number) => void;
  onPlayerClick?: (player: Player, slotSp: SubRole, slotIdx: number) => void;
  lineupNames?: string[];
  kitOverride?: string;
  gkKitOverride?: string;
  trimOverride?: string;
  matchMeta?: Record<string, PitchPlayerMeta>;
  statMode?: 'ovr' | 'rating';
  showFitBar?: boolean;
  selectedPlayerName?: string | null;
  validDropHighlight?: boolean;
  subAlertFitTh?: number;
  disableRedPlayers?: boolean;
  dropAttrPrefix?: 'default' | 'tactics';
  showPitchCrest?: boolean;
  className?: string;
}> = React.memo(({
  team,
  state,
  svgRef,
  showPositionZones = false,
  dragSourceName,
  dropTargetName,
  dragPreview,
  touchPointerPitchPt,
  onPlayerPointerDown,
  onPlayerClick,
  lineupNames,
  kitOverride,
  gkKitOverride,
  trimOverride,
  matchMeta,
  statMode = 'ovr',
  showFitBar = true,
  selectedPlayerName,
  validDropHighlight = false,
  subAlertFitTh,
  disableRedPlayers = false,
  dropAttrPrefix = 'default',
  showPitchCrest = false,
  className
}) => {
  const uid = React.useId().replace(/:/g, '');
  const baseStarters = xi(team);
  const starters = lineupNames
    ? lineupNames.map((n, idx) => team.sq.find((q) => q.n === n) || baseStarters[idx] || team.sq[idx]).filter(Boolean)
    : baseStarters;
  const slots = getFormationSlots(team);
  const col = kitOverride || tc(team, state);
  const trCol = trimOverride || tc(team, state, true);
  const gkPal = resolveGkKitPalette(col, trCol, gkKitOverride);
  const gkCol = gkPal.kit;
  const gkTrCol = gkPal.trim;
  const pitchCrestSpec = showPitchCrest
    ? resolveCrestSpec(team.name, team, state.club, state.mode === 'm' && team.id === state.me)
    : null;
  const zoneLineColors: Record<Position, { stroke: string; fill: string; text: string }> = {
    FW: { stroke: 'rgba(239, 68, 68, 0.58)', fill: 'rgba(220, 38, 38, 0.1)', text: 'rgba(254, 202, 202, 0.92)' },
    MF: { stroke: 'rgba(59, 130, 246, 0.58)', fill: 'rgba(37, 99, 235, 0.1)', text: 'rgba(191, 219, 254, 0.92)' },
    DF: { stroke: 'rgba(168, 85, 247, 0.58)', fill: 'rgba(147, 51, 234, 0.1)', text: 'rgba(233, 213, 255, 0.92)' },
    GK: { stroke: 'rgba(34, 197, 94, 0.58)', fill: 'rgba(22, 163, 74, 0.1)', text: 'rgba(187, 247, 208, 0.92)' }
  };

  return (
    <svg
      ref={svgRef}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: onPlayerPointerDown ? 'none' : 'manipulation', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      className={className || 'aspect-[300/380] h-full max-h-full w-auto max-w-full mx-auto rounded-2xl mland:rounded-xl block select-none'}
      viewBox="0 0 300 380"
    >
      <defs>
        <clipPath id={`fc-${uid}`}>
          <circle cx="30" cy="31" r="27" />
        </clipPath>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />
      {pitchCrestSpec && (
        <g className="pointer-events-none">
          <g transform="translate(256, 10)" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.42))' }}>
            <g
              transform="scale(1.42)"
              dangerouslySetInnerHTML={{ __html: buildCrestSvgMarkup(pitchCrestSpec, `${uid}-pcb`, true) }}
            />
          </g>
        </g>
      )}

      {showPositionZones && (
        <g className="pointer-events-none">
          {PITCH_POSITION_ZONES.map((z) => {
            const x = 18 + z.x1 * 2.64 + 1.2;
            const y = 16 + z.y1 * 3.48 + 1.2;
            const w = Math.max(8, (z.x2 - z.x1) * 2.64 - 2.4);
            const h = Math.max(8, (z.y2 - z.y1) * 3.48 - 2.4);
            const isActiveZone = dragPreview?.zoneId === z.id;
            const pal = zoneLineColors[z.line];
            const fitPen = isActiveZone && dragPreview ? playerPen(dragPreview.player, z.sp) : 0;
            const activeStroke = fitPen === 0 ? '#4ade80' : fitPen === 1 ? '#facc15' : '#f87171';
            const activeFill = fitPen === 0 ? 'rgba(74, 222, 128, 0.24)' : fitPen === 1 ? 'rgba(250, 204, 21, 0.24)' : 'rgba(248, 113, 113, 0.24)';

            return (
              <g key={z.id}>
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
                  opacity={dragPreview ? (isActiveZone ? 1 : 0.65) : 0.72}
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
        const cy = 16 + z.y * 3.48;
        const meta = matchMeta?.[q.n];
        const pn = meta?.offPosPen ?? playerPen(q, z.sp);
        const isMe = !!q.me || (state.mode === 'p' && state.p?.name === q.n);
        const isSelected = selectedPlayerName === q.n;
        const isMovingSelf = dragPreview?.slotIdx === i;
        const isTarget = dropTargetName === q.n && dragSourceName !== q.n;
        const isRed = Boolean(meta?.isRed);
        const isSus = (q.sus || 0) > 0;
        const isInj = Boolean(meta?.isInjured || (!matchMeta && q.inj > 0));
        const isDisabled = Boolean(disableRedPlayers && isRed);
        const isValidDrop = Boolean(validDropHighlight && !isDisabled && !isTarget && dragSourceName !== q.n);
        const efVal = isRed || isSus || isInj ? 0 : Math.max(0, Math.min(100, Math.round(meta?.fitVal ?? q.fit ?? 100)));
        const restTh = subAlertFitTh ?? 65;
        const warnTh = Math.max(75, restTh + 10);
        const efc = efVal >= warnTh ? '#22c55e' : efVal >= restTh ? '#f59e0b' : '#ef4444';
        const ed =
          isRed || isInj || isSus
            ? '#ef4444'
            : isTarget || meta?.isMotm || isMe
              ? '#f5c242'
              : isSelected
                ? '#38bdf8'
                : subAlertFitTh != null && efVal < restTh
                  ? '#ef4444'
                  : subAlertFitTh != null && efVal < warnTh
                    ? '#f59e0b'
                    : PCOL[pn];
        const slotIsGK = z.sp === 'GK';
        const kc = slotIsGK ? gkCol : col;
        const slotTrim = slotIsGK ? gkTrCol : trCol;
        const rad = isTarget ? 18 : 15;
        const sc = isTarget ? 0.56 : 0.48;
        const no = getShirtNo(team, q);

        const ratingVal = meta?.rating;
        const useRating = statMode === 'rating' && ratingVal != null;
        const ovPal = getOvrCanvasPalette(q.ov);
        const rtBg = !useRating
          ? ovPal.bg
          : meta?.isMotm || ratingVal >= 8.2
            ? '#facc15'
            : ratingVal >= 7.1
              ? '#10b981'
              : ratingVal >= 6.2
                ? '#0f172a'
                : '#e11d48';
        const rtFg = !useRating ? ovPal.text : meta?.isMotm || ratingVal >= 8.2 ? '#1c1300' : '#ffffff';
        const rtStroke = !useRating ? ovPal.stroke : meta?.isMotm || ratingVal >= 8.2 ? '#fef08a' : ratingVal >= 7.1 ? '#a7f3d0' : ratingVal >= 6.2 ? '#94a3b8' : '#fecdd3';

        const hasCard = isRed || isSus || (meta?.yellowCards || 0) > 0;
        const goalsCount = meta?.goals || 0;
        const assistsCount = meta?.assists || 0;
        const hasSubIn = meta?.subInMin != null;
        const hasSubOut = !hasSubIn && meta?.subOutMin != null;
        const isCaptain = team.cap === q.n;
        const nodeOpacity = isDisabled || meta?.dim ? 0.44 : isMovingSelf ? 0.24 : dragSourceName === q.n ? 0.45 : 1;

        const dropAttrs =
          dropAttrPrefix === 'tactics'
            ? {
                'data-tactics-drop-player': q.n,
                'data-tactics-drop-slot': z.sp,
                'data-tactics-drop-idx': String(i),
                'data-tactics-disabled': isDisabled ? '1' : '0'
              }
            : {
                'data-drop-player': q.n,
                'data-drop-slot': z.sp
              };

        return (
          <g
            key={`${q.n}-${i}`}
            {...dropAttrs}
            onPointerDown={onPlayerPointerDown ? (e) => onPlayerPointerDown(e, q, z.sp, i) : undefined}
            onClick={
              onPlayerClick
                ? (e) => {
                    e.stopPropagation();
                    onPlayerClick(q, z.sp, i);
                  }
                : undefined
            }
            onContextMenu={(e) => e.preventDefault()}
            style={{
              touchAction: onPlayerPointerDown ? 'none' : 'manipulation',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              opacity: nodeOpacity
            }}
            className={isDisabled ? 'cursor-default' : dragSourceName ? 'cursor-grabbing' : 'cursor-pointer'}
          >
            <circle cx={cx} cy={cy} r={24} fill="transparent" />
            {isMe && !isTarget && !isSelected && (
              <circle cx={cx} cy={cy} r={22.5} fill="#f5c2422e" stroke="#fde047" strokeWidth="2.2" />
            )}
            {meta?.isMotm && !isTarget && !isSelected && (
              <circle cx={cx} cy={cy} r={21} fill="#facc1528" stroke="#facc15" strokeWidth="1.9" />
            )}
            {isSelected && !isTarget && (
              <circle cx={cx} cy={cy} r={22.5} fill="#38bdf828" stroke="#38bdf8" strokeWidth="2.2" />
            )}
            {isValidDrop && (
              <circle cx={cx} cy={cy} r={21} fill="none" stroke="#6ee7b7" strokeWidth="1.7" strokeDasharray="3.5 2" />
            )}
            {isTarget && (
              <circle cx={cx} cy={cy} r={24} fill="#f5c24228" stroke="#f5c242" strokeWidth="2.2" strokeDasharray="4 2" />
            )}
            <ellipse cx={cx} cy={cy + 16} rx="13" ry="3.8" fill="#0005" />

            {/* Player Avatar Circle */}
            <circle cx={cx} cy={cy} r={rad} fill={kc} stroke={ed} strokeWidth="2.8" />
            <g
              transform={`translate(${(cx - 30 * sc).toFixed(1)},${(cy - 31 * sc).toFixed(1)}) scale(${sc})`}
              clipPath={`url(#fc-${uid})`}
              dangerouslySetInnerHTML={{
                __html: faceBodySvg(
                  visOf(q, state.p),
                  kc,
                  slotTrim,
                  32,
                  '#10281d',
                  true,
                  false,
                  resolveKitVisualForFace(team, state, null, undefined, kc, slotTrim, slotIsGK, `${uid}-p-${i}`, q.n)
                )
              }}
            />

            {/* Top Center: Role Badge (in front of avatar, raised cleanly onto top rim to clear hair) */}
            {(() => {
              const posPal = getPositionCanvasPalette(z.sp);
              const badgeW = isMe ? (z.sp.length >= 3 ? 34 : 30) : z.sp.length >= 3 ? 28 : 25;
              const badgeH = 12.5;
              const badgeStroke = isMe
                ? '#f5c242'
                : pn >= 2
                  ? '#ef4444'
                  : pn === 1
                    ? '#f59e0b'
                    : 'rgba(6, 20, 13, 0.88)';
              return (
                <g transform={`translate(${cx},${cy - (isTarget ? 20.5 : 17.5)})`}>
                  <rect
                    x={-badgeW / 2}
                    y="-8.5"
                    width={badgeW}
                    height={badgeH}
                    rx="3.8"
                    fill={posPal.bg}
                    stroke={badgeStroke}
                    strokeWidth={isMe || pn > 0 ? '1.15' : '0.85'}
                  />
                  <text
                    x="0"
                    y={-8.5 + badgeH / 2 + 0.3}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="8"
                    fontWeight="800"
                    fontFamily="Sarabun"
                    fill={posPal.text}
                  >
                    {isMe && <tspan fill="#fde047">★ </tspan>}
                    {z.sp}
                  </text>
                </g>
              );
            })()}

            {/* Bottom-Left: Shirt Number */}
            <rect x={cx - 23} y={cy + 5.5} width="19" height="12.5" rx="4.5" fill="#0b2018" stroke={ed} strokeWidth="1.1" />
            <text x={cx - 13.5} y={cy + 14.8} textAnchor="middle" fontSize="9.2" fontWeight="700" fontFamily="Sarabun" fill="#ffd75e">
              {no}
            </text>

            {/* Bottom-Right: OVR or Match Rating */}
            <rect x={cx + 3} y={cy + 5.5} width={useRating ? '21.5' : '19'} height="12.5" rx="4.5" fill={rtBg} stroke={rtStroke} strokeWidth="1.1" />
            <text x={cx + (useRating ? 13.8 : 12.5)} y={cy + 14.8} textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="Sarabun" fill={rtFg}>
              {useRating ? ratingVal.toFixed(1) : q.ov}
            </text>

            {/* Top-Left: MOTM Crown and/or Captain Badge */}
            {meta?.isMotm && (
              <g transform={`translate(${cx - 15.5},${cy - 10})`}>
                <circle r="6" fill="#111418" stroke="#facc15" strokeWidth="1.15" />
                <path d="M-3.2 2.2 L-3.8 -1.8 L-1.4 0.3 L0 -2.6 L1.4 0.3 L3.8 -1.8 L3.2 2.2 Z" fill="#fde047" />
              </g>
            )}
            {isCaptain && (() => {
              const capPal = getClubCaptainPalette(
                col,
                trCol,
                state.mode === 'm' && team.id === state.me ? state.club?.c3 || '' : ''
              );
              const capX = meta?.isMotm ? cx - 21 : cx - 15;
              const capY = meta?.isMotm ? cy - 2 : cy - 10;
              return (
                <g transform={`translate(${capX},${capY})`}>
                  <circle r="5.5" fill={capPal.bg} stroke={capPal.border} strokeWidth="1.05" />
                  <text y="2.8" textAnchor="middle" fontSize="7.6" fontWeight="900" fontFamily="Sarabun" fill={capPal.text}>
                    C
                  </text>
                </g>
              );
            })()}

            {/* Top-Right: Cards & Injury (non-overlapping with lowered role badge) */}
            {(isRed || isSus) ? (
              <rect x={cx + 12} y={cy - 16} width="7" height="10" rx="1.5" fill="#e5484d" stroke="#fff" strokeWidth="1.1" />
            ) : (meta?.yellowCards || 0) > 0 ? (
              <rect x={cx + 12} y={cy - 16} width="7" height="10" rx="1.5" fill="#facc15" stroke="#111" strokeWidth="0.9" />
            ) : null}
            {isInj && (
              <g transform={`translate(${hasCard ? cx + 21 : cx + 14.5},${hasCard ? cy - 6.5 : cy - 11.5})`}>
                <circle r="5.8" fill="#fff" stroke="#e5484d" strokeWidth="1.2" />
                <path d="M-2.8 0h5.6M0-2.8v5.6" stroke="#e5484d" strokeWidth="1.9" strokeLinecap="round" />
              </g>
            )}

            {/* Mid-Left Edge: Sub In / Sub Out Arrow Badge (matches StatIconBadge) */}
            {hasSubIn && (
              <g transform={`translate(${cx - 20.5},${cy + (meta?.isMotm && isCaptain ? 3 : -2)})`}>
                <circle r="5.5" fill="#10b981" stroke="#fff" strokeWidth="1" />
                <path d="M0 -2.85 L2.6 0.3 H1.0 V2.95 H-1.0 V0.3 H-2.6 Z" fill="#fff" />
              </g>
            )}
            {hasSubOut && (
              <g transform={`translate(${cx - 20.5},${cy + (meta?.isMotm && isCaptain ? 3 : -2)})`}>
                <circle r="5.5" fill="#f43f5e" stroke="#fff" strokeWidth="1" />
                <path d="M0 2.85 L2.6 -0.3 H1.0 V-2.95 H-1.0 V-0.3 H-2.6 Z" fill="#fff" />
              </g>
            )}
            {(q.hg || q.customCreated) && (
              <g transform={`translate(${cx - 19.5},${cy + (hasSubIn || hasSubOut ? 8 : -2.5)})`}>
                <circle r="5.2" fill="#064e3b" stroke="#4ade80" strokeWidth="0.95" />
                <text x="0" y="2.8" textAnchor="middle" fontSize="6.8">🌱</text>
              </g>
            )}

            {/* Mid-Right Edge: Goals & Assists Icons (No background box, crisp outline + shadow) */}
            {(goalsCount > 0 || assistsCount > 0) && (() => {
              const gW = goalsCount > 1 ? 17.5 : goalsCount > 0 ? 10.5 : 0;
              const aW = assistsCount > 1 ? 17.5 : assistsCount > 0 ? 10.5 : 0;
              const gap = goalsCount > 0 && assistsCount > 0 ? 1.5 : 0;
              const totalW = gW + gap + aW;
              const baseX = Math.min(cx + 16.5, 294 - totalW);
              const baseY = cy - 1.5;
              const gx = baseX + gW / 2;
              const ax = baseX + gW + gap + aW / 2;
              return (
                <g className="pointer-events-none select-none">
                  {goalsCount > 0 && (
                    <g transform={`translate(${gx},${baseY})`}>
                      {goalsCount > 1 ? (
                        <text
                          x="0"
                          y="3.2"
                          textAnchor="middle"
                          fontSize="8.8"
                          fontWeight="900"
                          fontFamily="Kanit, Sarabun, sans-serif"
                          fill="#ffffff"
                          stroke="#06140d"
                          strokeWidth="2.4"
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.85))' }}
                        >
                          {goalsCount}⚽
                        </text>
                      ) : (
                        <text
                          x="0"
                          y="3.4"
                          textAnchor="middle"
                          fontSize="9.6"
                          style={{ filter: 'drop-shadow(0 1px 1.6px rgba(0,0,0,0.88))' }}
                        >
                          ⚽
                        </text>
                      )}
                    </g>
                  )}
                  {assistsCount > 0 && (
                    <g transform={`translate(${ax},${baseY})`}>
                      {assistsCount > 1 ? (
                        <text
                          x="0"
                          y="3.2"
                          textAnchor="middle"
                          fontSize="8.8"
                          fontWeight="900"
                          fontFamily="Kanit, Sarabun, sans-serif"
                          fill="#ffffff"
                          stroke="#06140d"
                          strokeWidth="2.4"
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.85))' }}
                        >
                          {assistsCount}👟
                        </text>
                      ) : (
                        <text
                          x="0"
                          y="3.4"
                          textAnchor="middle"
                          fontSize="9.6"
                          style={{ filter: 'drop-shadow(0 1px 1.6px rgba(0,0,0,0.88))' }}
                        >
                          👟
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Bottom Stamina Bar + Player Name */}
            {showFitBar && !isRed && (
              <>
                <rect
                  x={cx - 22}
                  y={cy + 17}
                  width="27"
                  height="4.6"
                  rx="2.3"
                  fill="rgba(7, 20, 14, 0.88)"
                  stroke={efVal < restTh ? '#ef4444' : 'rgba(255, 255, 255, 0.36)'}
                  strokeWidth={efVal < restTh ? '0.85' : '0.6'}
                />
                {efVal > 0 && (
                  <>
                    <rect
                      x={cx - 21.5}
                      y={cy + 17.5}
                      width={Math.max(2.2, (26 * efVal) / 100)}
                      height="3.6"
                      rx="1.8"
                      fill={efc}
                    />
                    <rect
                      x={cx - 21.5}
                      y={cy + 17.6}
                      width={Math.max(2.2, (26 * efVal) / 100)}
                      height="1.2"
                      rx="0.6"
                      fill="rgba(255, 255, 255, 0.3)"
                    />
                  </>
                )}
                <text
                  x={cx + 7}
                  y={cy + 21.6}
                  fontSize="7.6"
                  fontWeight="800"
                  fontFamily="Sarabun"
                  fill={efVal < restTh ? '#fda4af' : efVal < warnTh ? '#fcd34d' : '#86efac'}
                  stroke="#0b2018"
                  strokeWidth="2.1"
                  paintOrder="stroke"
                >
                  {efVal}%
                </text>
              </>
            )}
            <text
              x={clamp(cx, 26, 274)}
              y={showFitBar && !isRed ? cy + 29.5 : cy + 26}
              textAnchor="middle"
              fontSize={isMe || meta?.isMotm ? '9.2' : '8.8'}
              fontWeight={isMe || meta?.isMotm ? '800' : '600'}
              fontFamily="Sarabun"
              fill={meta?.isMotm || isMe ? '#fde047' : '#fff'}
              stroke="#0b2018"
              strokeWidth="2.4"
              paintOrder="stroke"
            >
              {q.n.split(' ')[0]}
            </text>
          </g>
        );
      })}

      {/* Live Dragged Player Preview on Pitch (with fingertip offset tether on touch) */}
      {dragPreview && (() => {
        const pq = dragPreview.player;
        const gx = 18 + dragPreview.x * 2.64;
        const gy = 16 + dragPreview.y * 3.48;
        const pn = playerPen(pq, dragPreview.sp);
        const ed = pn === 0 ? '#4ade80' : pn === 1 ? '#facc15' : '#f87171';
        const dragIsGK = dragPreview.sp === 'GK';
        const kc = dragIsGK ? gkCol : col;
        const dragTrim = dragIsGK ? gkTrCol : trCol;
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
              dangerouslySetInnerHTML={{
                __html: faceBodySvg(
                  visOf(pq, state.p),
                  kc,
                  dragTrim,
                  32,
                  '#10281d',
                  true,
                  false,
                  resolveKitVisualForFace(team, state, null, undefined, kc, dragTrim, dragIsGK, `${uid}-drag`, pq.n)
                )
              }}
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
});

