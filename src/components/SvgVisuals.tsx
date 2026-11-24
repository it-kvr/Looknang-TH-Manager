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
  const icTransform = `translate(5.2 ${stars > 0 ? 6.0 : 5.2}) scale(.57)`;
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
  const defs = `<defs><clipPath id="mcp-${uid}"><path d="${spec.d}"/></clipPath>${
    spec.pat === 9 ? `<linearGradient id="cg-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${spec.c1}"/><stop offset="100%" stop-color="${spec.c2}"/></linearGradient>` : ''
  }${
    spec.pat === 19 ? `<radialGradient id="cr-${uid}" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="${spec.c2}"/><stop offset="100%" stop-color="${spec.c1}"/></radialGradient>` : ''
  }</defs>`;
  const patBody = renderCrestPatternStr(spec.pat, uid, spec.c1, spec.c2);
  const c3Stroke = spec.hasCustomC3 && spec.pat !== 8 ? `<path d="${spec.d}" fill="none" stroke="${spec.c3}" stroke-width="2.2" opacity="0.6"/>` : '';
  const borderExtra = spec.borderStyle === 2 ? `<path d="${spec.d}" fill="none" stroke="${spec.c3}" stroke-width="0.9" opacity="0.9"/>` : '';
  const starsHtml =
    withStars && spec.stars > 0
      ? Array.from({ length: spec.stars })
          .map((_, idx) => `<circle cx="${12 + (idx - (spec.stars - 1) / 2) * 4.5}" cy="2.6" r="1.25" fill="#facc15" stroke="#1e293b" stroke-width="0.35"/>`)
          .join('')
      : '';
  const icRaw = CREST_IC[spec.ic] || '';
  return `${defs}<g clip-path="url(#mcp-${uid})">${patBody}${c3Stroke}</g><path d="${spec.d}" fill="none" stroke="${spec.strokeCol}" stroke-width="${spec.borderStyle === 2 ? '2.2' : '1.8'}"/>${borderExtra}${starsHtml}<g transform="${spec.icTransform}" fill="none" stroke="${spec.haloCol}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round">${icRaw}</g><g transform="${spec.icTransform}" fill="none" stroke="${spec.icCol}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icRaw}</g>`;
}

export const ClubCrest: React.FC<{
  name: string;
  size?: number;
  team?: Team | null;
  club?: ClubIdentity | null;
  isMyClub?: boolean;
}> = ({ name, size = 24, team, club, isMyClub }) => {
  const uid = React.useId().replace(/:/g, '');
  const spec = resolveCrestSpec(name, team, club, isMyClub);

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
      </defs>
      <g clipPath={`url(#cp-${uid})`}>
        {renderCrestPattern(spec.pat, uid, spec.c1, spec.c2)}
        {spec.hasCustomC3 && spec.pat !== 8 && <path d={spec.d} fill="none" stroke={spec.c3} strokeWidth="2.2" opacity="0.6" />}
      </g>
      <path d={spec.d} fill="none" stroke={spec.strokeCol} strokeWidth={spec.borderStyle === 2 ? '2' : '1.5'} />
      {spec.borderStyle === 2 && <path d={spec.d} fill="none" stroke={spec.c3} strokeWidth="0.7" opacity="0.9" />}
      {spec.stars > 0 &&
        Array.from({ length: spec.stars }).map((_, idx) => {
          const sx = 12 + (idx - (spec.stars - 1) / 2) * 4.5;
          return <circle key={idx} cx={sx} cy="2.6" r="1.25" fill="#facc15" stroke="#1e293b" strokeWidth="0.35" />;
        })}
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
    </svg>
  );
};

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
  size = 84,
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
  const J = 'M30 10l-22 14 8 18 10-5v48h48V37l10 5 8-18-22-14c-4 8-10 10-20 10s-16-2-20-10z';
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

export interface KitVisualSpec {
  uid: string;
  kitPattern: number;
  collar: number;
  accent: string;
  crestSpec: ResolvedCrestSpec | null;
}

let _faceSeq = 0;

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
  const mine = Boolean(isMyClubProp || club || (team && state && team.id === state.me && state.mode === 'm'));
  const activeClub = club || (mine ? state?.club || null : null);
  const seedName = activeClub?.name || team?.name || fallbackName || 'Club';
  const h = ([...seedName].reduce((a, c, idx) => a + c.charCodeAt(0) * (idx + 3), 0) * 37) >>> 0;
  const rawPat = activeClub ? (activeClub.kit ?? 0) % KIT_PATTERNS.length : team ? (h >> 3) % KIT_PATTERNS.length : h % 6;
  const gkPatterns = [0, 4, 6, 10, 12, 13];
  const kitPattern = isGK ? gkPatterns[(rawPat + 2) % gkPatterns.length] : rawPat;
  const collar = activeClub ? (activeClub.collar ?? 0) % 4 : (h >> 5) % 4;
  const resolvedTrim = trimColor || activeClub?.c2 || team?.kc?.[1] || '#ffd75e';
  const accent = activeClub?.c3 || (colDist(resolvedTrim, '#ffffff') < 100 ? '#f4c63d' : '#ffffff');
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

export function faceBodySvg(
  v: number[],
  kit: string,
  trim: string,
  w = 38,
  bg = 'none',
  bare = false,
  showNo = true,
  kitSpec?: KitVisualSpec
): string {
  const ki = v[0] ?? 2;
  const hi = v[1] ?? 0;
  const hs = v[2] ?? 0;
  const fh = v[3] ?? 0;
  const ey = (v[4] ?? 0) % 8;
  const no = v[5] ?? 10;
  const fs = (v[6] ?? ((ki + hi + hs + no) % 6)) % 6;
  const acc = (v[7] ?? 0) % 8;
  const sk = SKIN_P[ki] || SKIN_P[2];
  const hr = HAIR_P[hi] || HAIR_P[0];

  const headD = [
    // 0: เรียว (Oval slim)
    'M16 25c0-10 6-15 14-15s14 5 14 15c0 9-5 16-14 16s-14-7-14-16z',
    // 1: กลม (Round)
    'M14.5 25.5c0-10 6.5-15.5 15.5-15.5s15.5 5.5 15.5 15.5c0 8.8-6 15.5-15.5 15.5s-15.5-6.7-15.5-15.5z',
    // 2: กรามคม (Sharp jaw)
    'M15.5 24.5c0-9.5 6-14.5 14.5-14.5s14.5 5 14.5 14.5l-1 9.5c-.8 3.8-6.5 7-13.5 7s-12.7-3.2-13.5-7z',
    // 3: เหลี่ยมคม (Square athletic)
    'M15 24c0-9.2 5.8-14 15-14s15 4.8 15 14l-.4 10.2c-.3 3.4-4.2 6.8-14.6 6.8s-14.3-3.4-14.6-6.8z',
    // 4: หน้ายาว (Long oval)
    'M17 24.5c0-10.2 5.4-15.2 13-15.2s13 5 13 15.2c0 10-4.6 17.3-13 17.3s-13-7.3-13-17.3z',
    // 5: โหนกแก้มชัด (Chiseled cheekbones)
    'M15.2 24.5c0-9.5 6.2-14.5 14.8-14.5s14.8 5 14.8 14.5l-1.8 6.4-3.6 7.4c-1.8 2-5.4 3.2-9.4 3.2s-7.6-1.2-9.4-3.2L17 30.9z'
  ][fs];

  const hBackHtml =
    hs % 14 === 10
      ? `<circle cx="30" cy="7.2" r="4.8" fill="${hr}"/><path d="M25.5 9.2h9" stroke="${trim}" stroke-width="1.4" stroke-linecap="round"/>`
      : hs % 14 === 11
        ? `<path d="M13.5 24v12M16 26v11M44 26v11M46.5 24v12" stroke="${hr}" stroke-width="3" stroke-linecap="round"/>`
        : hs % 14 === 12
          ? `<path d="M15.5 28l-2 11 4.5-2zM44.5 28l2 11-4.5-2z" fill="${hr}"/>`
          : '';

  const hHtml = [
    // 0: คลาสสิก
    `<path d="M15 24c0-11 7-17 15-17s15 6 15 17c-3-6-9-8-15-8s-12 2-15 8z" fill="${hr}"/>`,
    // 1: สไปกี้
    `<path d="M15 24c0-9 5-15 15-16c4 0 8 2 11 5l3-4-2 8c2 2 3 4 3 7c-3-6-9-8-15-8s-12 2-15 8z" fill="${hr}"/><path d="M20 12l4-5 4 4 4-6 4 5 5-3-2 7z" fill="${hr}"/>`,
    // 2: ปัดข้าง
    `<path d="M15 25c0-12 7-18 16-18s14 6 14 17c-4-4-12-5-20-2c-5 2-8 4-10 3z" fill="${hr}"/>`,
    // 3: หยิกฟู
    `<path d="M14 25c-2-5 1-11 5-13c2-5 8-7 13-6c6-1 11 2 12 7c4 2 5 8 2 12c-3-5-9-8-16-8s-13 3-16 8z" fill="${hr}"/>`,
    // 4: สกินเฮด
    `<path d="M16 23c1-9 6-14 14-14s13 5 14 14c-3-5-8-7-14-7s-11 2-14 7z" fill="${hr}" opacity="0.58"/>`,
    // 5: เสยเรียบ
    `<path d="M15 23c1-11 7-17 15-17s14 6 15 17c-2-8-8-10-15-10s-13 2-15 10z" fill="${hr}"/><path d="M21 11q9-3 18 0" stroke="#fff" stroke-width="0.9" opacity="0.25" fill="none"/>`,
    // 6: คาดผม
    `<path d="M15 24c0-11 7-17 15-17s15 6 15 17c-3-6-9-8-15-8s-12 2-15 8z" fill="${hr}"/><path d="M16 18q14-3 28 0" stroke="${trim}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    // 7: แสกกลาง
    `<path d="M15 25c0-11 7-17 15-17s15 6 15 17c-3-5-7-8-12-8l-3 5-3-5c-5 0-9 3-12 8z" fill="${hr}"/>`,
    // 8: โมฮอว์ก (Mohawk)
    `<path d="M24 19c1-8 3-14 6-14s5 6 6 14c-2-2-4-3-6-3s-4 1-6 3z" fill="${hr}"/><path d="M16 23c.5-4 2.5-7 5-9l1 6c-3 1-5 2-6 3zM44 23c-.5-4-2.5-7-5-9l-1 6c3 1 5 2 6 3z" fill="${hr}" opacity="0.28"/>`,
    // 9: อันเดอร์คัต (Undercut fade)
    `<path d="M16.5 23c1-6 4-14 13.5-15c9.5 1 12.5 9 13.5 15c-1.5-4-5-6.5-13.5-6.5S18 19 16.5 23z" fill="${hr}" opacity="0.32"/><path d="M20 17c0-7 4.5-11 10-11s10 4 10 11c-3-3-7-4-10-4s-7 1-10 4z" fill="${hr}"/><path d="M22 10.5l14-2.5" stroke="#fff" stroke-width="0.9" opacity="0.22" fill="none" stroke-linecap="round"/>`,
    // 10: มัดจุก (Top knot / Man bun)
    `<path d="M15.5 23.5c.8-10 6.5-14.5 14.5-14.5s13.7 4.5 14.5 14.5c-3-5.5-8.5-7.5-14.5-7.5s-11.5 2-14.5 7.5z" fill="${hr}"/><path d="M22 14l8-5 8 5" stroke="#000" stroke-width="0.7" opacity="0.16" fill="none"/>`,
    // 11: เดรดล็อก (Dreadlocks / Braids)
    `<path d="M15 24c0-11 7-16.5 15-16.5s15 5.5 15 16.5c-2.5-5.5-8.5-7.5-15-7.5s-12.5 2-15 7.5z" fill="${hr}"/><path d="M19 16l1-6M24 14l.5-6.5M30 13.5V7M36 14l-.5-6.5M41 16l-1-6" stroke="#000" stroke-width="0.9" opacity="0.28" stroke-linecap="round"/>`,
    // 12: มัลเล็ต (Modern mullet)
    `<path d="M15 24c0-10.5 6.8-16.2 15-16.2s15 5.7 15 16.2c-2.5-4.5-6.5-6.5-10-6.5-2.5 0-4 2.5-5 2.5s-2.5-2.5-5-2.5c-3.5 0-7.5 2-10 6.5z" fill="${hr}"/>`,
    // 13: หัวโล้น (Clean bald + subtle scalp highlight)
    `<path d="M23.5 13.5q6.5-2.5 13 0" stroke="#fff" stroke-width="1.6" opacity="0.32" fill="none" stroke-linecap="round"/>`
  ][hs % 14];

  const fhMod = fh % 8;
  const fhHtml =
    fhMod === 1
      ? `<path d="M25 37c2 3 8 3 10 0c-1 4-9 4-10 0z" fill="${hr}" opacity="0.88"/>`
      : fhMod === 2
        ? `<path d="M17 29c1 9 6 13 13 13s12-4 13-13c-2 5-6 8-13 8s-11-3-13-8z" fill="${hr}" opacity="0.82"/>`
        : fhMod === 3
          ? `<path d="M24 33q6-2.5 12 0q-6 1-12 0z" fill="${hr}" opacity="0.9"/>`
          : fhMod === 4
            ? `<path d="M18.5 31c1.2 6.8 5.2 10 11.5 10s10.3-3.2 11.5-10c-2 4.5-5.8 7-11.5 7s-9.5-2.5-11.5-7z" fill="${hr}" opacity="0.34"/>`
            : fhMod === 5
              ? `<path d="M24 32.8q6-2.4 12 0q-6 1.1-12 0zM25.5 36.8c1.8 2.8 7.2 2.8 9 0c-.8 3.6-8.2 3.6-9 0z" fill="${hr}" opacity="0.9"/>`
              : fhMod === 6
                ? `<path d="M16 25l1.6 7.5c1.5 5 5.8 8.5 12.4 8.5s10.9-3.5 12.4-8.5L44 25l-1.5 5.2c-1.8 5.2-6 8-12.5 8s-10.7-2.8-12.5-8z" fill="${hr}" opacity="0.84"/>`
                : fhMod === 7
                  ? `<path d="M16.2 28c.8 9.8 5.8 14.5 13.8 14.5S43 37.8 43.8 28c-2 4.8-5.5 7.4-9.5 8.2v-2.4q-4.3-1.6-8.6 0v2.4c-4-.8-7.5-3.4-9.5-8.2z" fill="${hr}" opacity="0.92"/>`
                  : '';

  const br =
    ey === 1
      ? `<path d="M19.5 22.2l7 1.4M40.5 22.2l-7 1.4" stroke="${hr}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
      : ey === 3
        ? `<path d="M19.5 22.8h7.2M33.3 22.8h7.2" stroke="${hr}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
        : ey === 4
          ? `<path d="M19.2 21.4l7.4 2.2M40.8 21.4l-7.4 2.2" stroke="${hr}" stroke-width="2" fill="none" stroke-linecap="round"/>`
          : ey === 5
            ? `<path d="M19.8 22.8q3.6-1.4 6.8-.2M33.2 21.9q3.6-2 7-.4" stroke="${hr}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
            : ey === 6
              ? `<path d="M19.8 21.5q3.7-2.2 7 0M33.2 21.5q3.7-2.2 7 0" stroke="${hr}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
              : ey === 7
                ? `<path d="M19.6 23.1l7-.4M33.4 22.7l7 .4" stroke="${hr}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
                : `<path d="M19.8 22.5q3.7-1.6 7 0M33.2 22.5q3.7-1.6 7 0" stroke="${hr}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.9"/>`;

  const eyes =
    ey === 3
      ? `<path d="M21 26.8h5.5M33.5 26.8h5.5" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/>`
      : ey === 6
        ? `<ellipse cx="23.8" cy="27" rx="2.9" ry="2.4" fill="#fff" opacity="0.96"/><ellipse cx="36.2" cy="27" rx="2.9" ry="2.4" fill="#fff" opacity="0.96"/><circle cx="23.8" cy="27" r="1.95" fill="#1a1a1a"/><circle cx="36.2" cy="27" r="1.95" fill="#1a1a1a"/><circle cx="23.1" cy="26.1" r="0.8" fill="#fff"/><circle cx="35.5" cy="26.1" r="0.8" fill="#fff"/>`
        : ey === 7
          ? `<ellipse cx="23.8" cy="27.2" rx="2.5" ry="1.4" fill="#fff" opacity="0.88"/><ellipse cx="36.2" cy="27.2" rx="2.5" ry="1.4" fill="#fff" opacity="0.88"/><circle cx="23.8" cy="27.2" r="1.45" fill="#1a1a1a"/><circle cx="36.2" cy="27.2" r="1.45" fill="#1a1a1a"/><path d="M21 25.8h5.6M33.4 25.8h5.6" stroke="${sk}" stroke-width="1" stroke-linecap="round"/>`
          : `<ellipse cx="23.8" cy="27" rx="2.5" ry="1.9" fill="#fff" opacity="0.92"/><ellipse cx="36.2" cy="27" rx="2.5" ry="1.9" fill="#fff" opacity="0.92"/><circle cx="23.8" cy="27" r="1.75" fill="#1a1a1a"/><circle cx="36.2" cy="27" r="1.75" fill="#1a1a1a"/><circle cx="23.2" cy="26.3" r="0.65" fill="#fff" opacity="0.9"/><circle cx="35.6" cy="26.3" r="0.65" fill="#fff" opacity="0.9"/>`;

  const mo =
    ey === 2 || ey === 6
      ? `<path d="M25 34q5 4.2 10 0z" fill="#fff" stroke="#222" stroke-width="0.8"/>`
      : ey === 1
        ? `<path d="M26 35h8" stroke="#222" stroke-width="1.4" stroke-linecap="round"/>`
        : ey === 3 || ey === 7
          ? `<path d="M26 35q4 1.5 8-.6" stroke="#222" fill="none" stroke-width="1.4" stroke-linecap="round"/>`
          : ey === 4
            ? `<path d="M25.5 35.8q4.5-2 9 0" stroke="#222" fill="none" stroke-width="1.5" stroke-linecap="round"/>`
            : ey === 5
              ? `<path d="M26 35q4.5 1.8 8.5-1.4" stroke="#222" fill="none" stroke-width="1.45" stroke-linecap="round"/>`
              : `<path d="M26 34.5q4 2.8 8 0" stroke="#222" fill="none" stroke-width="1.4" stroke-linecap="round"/>`;

  const uid = kitSpec?.uid || `f${(++_faceSeq).toString(36)}`;
  const pat = kitSpec?.kitPattern ?? 0;
  const collar = kitSpec?.collar ?? 0;
  const accent = kitSpec?.accent || trim;

  const accUnderHairHtml =
    acc === 2
      ? `<rect x="35.8" y="30.2" width="5.6" height="2.6" rx="0.8" transform="rotate(-14 38.6 31.5)" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.5"/><path d="M37.4 31.5h2.4" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="0.6 0.6"/>`
      : acc === 3
        ? `<rect x="27.2" y="28.3" width="5.6" height="1.8" rx="0.7" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.45"/>`
        : acc === 4
          ? `<path d="M21.4 20.5l-1.3 4" stroke="${sk}" stroke-width="1.35" stroke-linecap="round"/>`
          : acc === 6
            ? `<path d="M18.2 26.8c1-2.6 4.2-3.4 6.8-2.2l3 2.4h4l3-2.4c2.6-1.2 5.8-.4 6.8 2.2l-1.1 3.7c-1.5 2-4.4 2.2-6.5.8l-2.4-1.6h-3.6l-2.4 1.6c-2.1 1.4-5 1.2-6.5-.8z" fill="#1e293b" fill-opacity="0.76" stroke="#94a3b8" stroke-width="0.75"/>`
            : acc === 7
              ? `<rect x="19" y="30.6" width="5.2" height="1.3" rx="0.5" fill="${kit}"/><rect x="19.3" y="32.4" width="4.6" height="1.1" rx="0.5" fill="${trim}"/><rect x="35.8" y="30.6" width="5.2" height="1.3" rx="0.5" fill="${kit}"/><rect x="36.1" y="32.4" width="4.6" height="1.1" rx="0.5" fill="${trim}"/>`
              : '';

  const accOverHairHtml =
    acc === 1
      ? `<path d="M16 18.8q14-3.4 28 0" stroke="${accent}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M16.5 18.8q13.5-3.2 27 0" stroke="${trim}" stroke-width="1" fill="none" stroke-linecap="round" opacity="0.8"/>`
      : acc === 5
        ? `<rect x="19.8" y="24.5" width="8.2" height="5" rx="1.6" fill="#0f172a" fill-opacity="0.38" stroke="#0f172a" stroke-width="1.2"/><rect x="32" y="24.5" width="8.2" height="5" rx="1.6" fill="#0f172a" fill-opacity="0.38" stroke="#0f172a" stroke-width="1.2"/><path d="M28 26.8h4M16.8 26.5l3 .4M40.2 26.9l3-.4" stroke="#0f172a" stroke-width="1.1" stroke-linecap="round"/>`
        : '';

  const torsoPath = 'M8 64c0-14 7-20 22-20s22 6 22 20z';
  const torsoDefs = `<defs><clipPath id="jk-${uid}"><path d="${torsoPath}"/></clipPath>${
    pat === 11 ? `<linearGradient id="fg-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${kit}"/><stop offset="100%" stop-color="${trim}"/></linearGradient>` : ''
  }</defs>`;
  const torsoBody = `<g clip-path="url(#jk-${uid})">${renderFaceTorsoPattern(pat, kit, trim, accent, uid)}<path d="M12 52l4 12M48 52l-4 12" stroke="${accent}" stroke-width="1.6" opacity="0.32"/>${renderFaceCollar(collar, trim, accent)}</g><path d="${torsoPath}" fill="none" stroke="#0c1f15" stroke-opacity="0.35" stroke-width="0.8"/>`;
  const chestCrest = kitSpec?.crestSpec
    ? `<g transform="translate(35.8, 49.5) scale(0.32)">${buildCrestSvgMarkup(kitSpec.crestSpec, `${uid}-cc`)}</g>`
    : '';
  const noX = kitSpec?.crestSpec ? '22.5' : '30';
  const noY = kitSpec?.crestSpec ? '59.5' : '60';
  const noSize = kitSpec?.crestSpec ? '8.4' : '10';
  const noMarkup =
    showNo && w >= 44
      ? `<text x="${noX}" y="${noY}" text-anchor="middle" font-size="${noSize}" font-weight="800" font-family="Sarabun" fill="#fff" stroke="#0007" stroke-width="0.9" paint-order="stroke" opacity="0.95">${no || 10}</text>`
      : '';

  return `${bare ? '' : `<rect width="60" height="64" fill="${bg}"/><path d="M0 0h60v26L0 42z" fill="#fff" opacity="0.1"/>`}${torsoDefs}${torsoBody}${chestCrest}${noMarkup}<rect x="25" y="36" width="10" height="11" rx="3" fill="${sk}"/><ellipse cx="30" cy="40" rx="5" ry="2.4" fill="#000" opacity="0.14"/>${hBackHtml}<circle cx="14.6" cy="28" r="3.2" fill="${sk}"/><circle cx="45.4" cy="28" r="3.2" fill="${sk}"/><path d="${headD}" fill="${sk}"/>${fhHtml}<path d="M30 27.5v3.8l-1.3.9" stroke="#000" opacity="0.16" stroke-width="1.2" fill="none" stroke-linecap="round"/>${br}${eyes}${mo}${accUnderHairHtml}${hHtml}${accOverHairHtml}`;
}

export const PlayerFace: React.FC<{
  player?: Partial<Player> | null;
  team?: Team | null;
  state?: GameState | null;
  careerProfile?: PlayerCareerProfile | null;
  club?: ClubIdentity | null;
  isMyClub?: boolean;
  size?: number;
  bare?: boolean;
  kitColor?: string;
  trimColor?: string;
}> = ({ player, team, state, careerProfile, club, isMyClub, size = 38, bare = false, kitColor, trimColor }) => {
  const uid = React.useId().replace(/:/g, '');
  const q = player || {};
  const resolvedNo = q.no || (team && q.n ? getShirtNo(team, q) : undefined) || (q.me ? (careerProfile || state?.p)?.no : undefined);
  const v = visOf(resolvedNo ? { ...q, no: resolvedNo } : q, careerProfile || state?.p);
  const teamKit = team ? tc(team, state) : null;
  const isGK = q.pos === 'GK' || q.ro === 'GK';
  const kc = kitColor
    ? kitColor
    : isGK
      ? pickGK(teamKit || '#2f6fd6')
      : teamKit
        ? teamKit
        : q.me && (careerProfile || state?.p)
          ? (careerProfile || state?.p)!.c
          : '#2f6fd6';
  const tr = trimColor ? trimColor : team ? tc(team, state, true) : club?.c2 || '#ffd75e';
  const bg = bare ? 'transparent' : `color-mix(in srgb, ${kc} 18%, transparent)`;
  const kitSpec = resolveKitVisualForFace(team, state, club, isMyClub, kc, tr, isGK, uid, q.n);
  return (
    <svg
      className={`shrink-0 ${bare ? '' : 'rounded-xl border border-[var(--line)]'}`}
      width={size}
      height={Math.round((size * 64) / 60)}
      viewBox="0 0 60 64"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: faceBodySvg(v, kc, tr, size, bg, bare, true, kitSpec) }}
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
                dangerouslySetInnerHTML={{
                  __html: faceBodySvg(
                    visOf(q, state?.p),
                    kc,
                    trCol,
                    32,
                    '#10281d',
                    true,
                    false,
                    resolveKitVisualForFace(team, state, null, undefined, kc, trCol, z.sp === 'GK', `${uid}-m-${idx}`, q.n)
                  )
                }}
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
  className?: string;
}> = ({
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
  const gkCol = gkKitOverride || pickGK(col);
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
      style={{ touchAction: onPlayerPointerDown ? 'none' : 'manipulation', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      className={className || 'aspect-[300/340] h-full max-h-full w-auto max-w-full mx-auto rounded-2xl mland:rounded-xl block select-none'}
      viewBox="0 0 300 340"
    >
      <defs>
        <clipPath id={`fc-${uid}`}>
          <circle cx="30" cy="31" r="27" />
        </clipPath>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />

      {showPositionZones && (
        <g className="pointer-events-none">
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
        const cy = 24 + z.y * 2.9;
        const meta = matchMeta?.[q.n];
        const pn = meta?.offPosPen ?? pen(q.ro, z.sp);
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
        const kc = z.sp === 'GK' ? gkCol : col;
        const rad = isTarget ? 19 : 16;
        const sc = isTarget ? 0.58 : 0.5;
        const no = getShirtNo(team, q);

        const ratingVal = meta?.rating;
        const useRating = statMode === 'rating' && ratingVal != null;
        const rtBg = !useRating
          ? '#0b2018'
          : meta?.isMotm || ratingVal >= 8.2
            ? '#facc15'
            : ratingVal >= 7.1
              ? '#10b981'
              : ratingVal >= 6.2
                ? '#0f172a'
                : '#e11d48';
        const rtFg = !useRating ? '#fff' : meta?.isMotm || ratingVal >= 8.2 ? '#1c1300' : '#ffffff';
        const rtStroke = !useRating ? ed : meta?.isMotm || ratingVal >= 8.2 ? '#fef08a' : ratingVal >= 7.1 ? '#a7f3d0' : ratingVal >= 6.2 ? '#94a3b8' : '#fecdd3';

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

            {/* Top Center: Role Tag */}
            {isMe ? (
              <g transform={`translate(${cx},${cy - (isTarget ? 27 : 24)})`}>
                <rect x="-18" y="-9.5" width="36" height="12.5" rx="6" fill="#f5c242" stroke="#111" strokeWidth="0.9" />
                <text x="0" y="-0.6" textAnchor="middle" fontSize="8.5" fontWeight="800" fontFamily="Sarabun" fill="#1a1200">
                  ★ {z.sp}
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

            {/* Player Avatar Circle */}
            <circle cx={cx} cy={cy} r={rad} fill={kc} stroke={ed} strokeWidth="2.8" />
            <g
              transform={`translate(${(cx - 30 * sc).toFixed(1)},${(cy - 31 * sc).toFixed(1)}) scale(${sc})`}
              clipPath={`url(#fc-${uid})`}
              dangerouslySetInnerHTML={{
                __html: faceBodySvg(
                  visOf(q, state.p),
                  kc,
                  trCol,
                  32,
                  '#10281d',
                  true,
                  false,
                  resolveKitVisualForFace(team, state, null, undefined, kc, trCol, z.sp === 'GK', `${uid}-p-${i}`, q.n)
                )
              }}
            />

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
              <g transform={`translate(${cx - 13.5},${cy - 14})`}>
                <circle r="6" fill="#facc15" stroke="#fff" strokeWidth="1.1" />
                <path d="M-3.2 2.2 L-3.8 -1.8 L-1.4 0.3 L0 -2.6 L1.4 0.3 L3.8 -1.8 L3.2 2.2 Z" fill="#1c1300" />
              </g>
            )}
            {isCaptain && (
              <g transform={`translate(${meta?.isMotm ? cx - 21 : cx - 12.5},${meta?.isMotm ? cy - 5.5 : cy - 14.5})`}>
                <circle r="5.5" fill="#f4c63d" stroke="#111" strokeWidth="1" />
                <text y="2.8" textAnchor="middle" fontSize="7.8" fontWeight="800" fontFamily="Sarabun" fill="#111">
                  C
                </text>
              </g>
            )}

            {/* Top-Right: Cards & Injury (non-overlapping) */}
            {(isRed || isSus) ? (
              <rect x={cx + 9.5} y={cy - 19} width="7" height="10" rx="1.5" fill="#e5484d" stroke="#fff" strokeWidth="1.1" />
            ) : (meta?.yellowCards || 0) > 0 ? (
              <rect x={cx + 9.5} y={cy - 19} width="7" height="10" rx="1.5" fill="#facc15" stroke="#111" strokeWidth="0.9" />
            ) : null}
            {isInj && (
              <g transform={`translate(${hasCard ? cx + 20 : cx + 12.5},${hasCard ? cy - 9 : cy - 14.5})`}>
                <circle r="5.8" fill="#fff" stroke="#e5484d" strokeWidth="1.2" />
                <path d="M-2.8 0h5.6M0-2.8v5.6" stroke="#e5484d" strokeWidth="1.9" strokeLinecap="round" />
              </g>
            )}

            {/* Mid-Left Edge: Sub In / Sub Out Arrow Badge */}
            {hasSubIn && (
              <g transform={`translate(${cx - 19.5},${cy - 2.5})`}>
                <circle r="5.2" fill="#10b981" stroke="#fff" strokeWidth="0.9" />
                <path d="M0 -2.5 L2.7 2 L-2.7 2 Z" fill="#fff" />
              </g>
            )}
            {hasSubOut && (
              <g transform={`translate(${cx - 19.5},${cy - 2.5})`}>
                <circle r="5.2" fill="#f97316" stroke="#fff" strokeWidth="0.9" />
                <path d="M0 2.5 L2.7 -2 L-2.7 -2 Z" fill="#fff" />
              </g>
            )}
            {(q.hg || q.customCreated) && (
              <g transform={`translate(${cx - 19.5},${cy + (hasSubIn || hasSubOut ? 8 : -2.5)})`}>
                <circle r="5.2" fill="#064e3b" stroke="#4ade80" strokeWidth="0.95" />
                <text x="0" y="2.8" textAnchor="middle" fontSize="6.8">🌱</text>
              </g>
            )}

            {/* Mid-Right Edge: Goals & Assists Badges (Number in front, non-overlapping) */}
            {goalsCount > 0 && (() => {
              const gW = goalsCount > 1 ? 19.5 : 12.5;
              const gx = cx + 15;
              const gy = cy - 8;
              return (
                <g transform={`translate(${gx},${gy})`}>
                  <rect width={gW} height="11" rx="5.5" fill="#0b2018" stroke="#34d399" strokeWidth="0.95" />
                  <text
                    x={gW / 2}
                    y="8.1"
                    textAnchor="middle"
                    fontSize="7.4"
                    fontWeight="800"
                    fontFamily="Kanit, Sarabun, sans-serif"
                    fill="#ffffff"
                  >
                    {goalsCount > 1 ? `${goalsCount}⚽` : '⚽'}
                  </text>
                </g>
              );
            })()}
            {assistsCount > 0 && (() => {
              const aW = assistsCount > 1 ? 19.5 : 12.5;
              const gap = goalsCount > 0 ? (goalsCount > 1 ? 21 : 14) : 0;
              const ax = cx + 15 + gap;
              const ay = cy - 8;
              return (
                <g transform={`translate(${ax},${ay})`}>
                  <rect width={aW} height="11" rx="5.5" fill="#0c4a6e" stroke="#7dd3fc" strokeWidth="0.95" />
                  <text
                    x={aW / 2}
                    y="8.1"
                    textAnchor="middle"
                    fontSize="7.4"
                    fontWeight="800"
                    fontFamily="Kanit, Sarabun, sans-serif"
                    fill="#ffffff"
                  >
                    {assistsCount > 1 ? `${assistsCount}👟` : '👟'}
                  </text>
                </g>
              );
            })()}

            {/* Bottom Stamina Bar + Player Name */}
            {showFitBar && !isRed && (
              <>
                <rect x={cx - 23} y={cy + 18.5} width="28" height="4.8" rx="2.4" fill="#0b2018" stroke={efVal < restTh ? '#ef4444' : '#fff7'} strokeWidth={efVal < restTh ? '0.9' : '0.6'} />
                <rect x={cx - 23} y={cy + 18.5} width={(28 * efVal) / 100} height="4.8" rx="2.4" fill={efc} />
                <text
                  x={cx + 7}
                  y={cy + 23.2}
                  fontSize="8"
                  fontWeight="800"
                  fontFamily="Sarabun"
                  fill={efVal < restTh ? '#fca5a5' : efc}
                  stroke="#0b2018"
                  strokeWidth="2.2"
                  paintOrder="stroke"
                >
                  {efVal}%
                </text>
              </>
            )}
            <text
              x={clamp(cx, 26, 274)}
              y={showFitBar && !isRed ? cy + 32 : cy + 28.5}
              textAnchor="middle"
              fontSize={isMe || meta?.isMotm ? '9.6' : '9.2'}
              fontWeight={isMe || meta?.isMotm ? '800' : '600'}
              fontFamily="Sarabun"
              fill={meta?.isMotm || isMe ? '#fde047' : '#fff'}
              stroke="#0b2018"
              strokeWidth="2.5"
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
              dangerouslySetInnerHTML={{
                __html: faceBodySvg(
                  visOf(pq, state.p),
                  kc,
                  trCol,
                  32,
                  '#10281d',
                  true,
                  false,
                  resolveKitVisualForFace(team, state, null, undefined, kc, trCol, dragPreview.sp === 'GK', `${uid}-drag`, pq.n)
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
};

