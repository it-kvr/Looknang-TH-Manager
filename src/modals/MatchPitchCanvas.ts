import type { Team, PlayerCareerProfile, LivePitchAgent, LiveMatchWorld, LiveBenchSeat, LiveSidelineCoach, CoachOutfitId, VarReviewState, MatchHighlightClip, MatchHighlightFrame, MatchEnvironment, PitchPerimeterBrand } from '../types/game';
import { COACH_OUTFITS } from '../data/thaiFootballData';
import { getTurfGradeSpec } from '../data/crestAndKitData';
import { PARTNER_DEAL_BRAND_SPECS, SHIRT_SPONSOR_BRANDS } from '../data/sponsorBrands';
import { clamp } from '../utils/math';
import { getShirtNo, visOf, getFormationSlots, DT, colDist, getPlayerTraits } from '../engine/playerCore';
import { HL_ACT } from '../engine/matchHighlights';
import { faceBodySvg } from '../components/SvgVisuals';
import { getClubCaptainPalette } from '../components/CaptainBadge';
import { getPositionCanvasPalette } from '../components/PositionBadge';
import { getRatingCanvasPalette } from '../components/RatingBadge';

export const buildAgentsForTeam = (
  team: Team,
  side: 'H' | 'A',
  luNames: string[],
  sentOffNames: string[],
  yellowsMap: Record<string, number>,
  fitMap: Record<string, number>,
  careerP?: PlayerCareerProfile | null,
  myPlayerName?: string,
  secondHalf = false,
  statDeltas?: Record<string, number> | null,
  captainName?: string,
  subbedInNames?: string[]
): LivePitchAgent[] => {
  const slots = getFormationSlots(team);
  const attRight = (side === 'H') !== secondHalf;
  const activeCap = captainName || team.cap;
  const subInSet = subbedInNames?.length ? new Set(subbedInNames) : null;
  return luNames.map((name, i) => {
    const pl = team.sq.find((q) => q.n === name) || team.sq[i] || team.sq[0];
    const slot = slots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
    const homeBaseX = clamp(100 - slot.y, 4.5, 95.5);
    const baseX = attRight ? homeBaseX : 100 - homeBaseX;
    const baseY = attRight ? clamp(slot.x, 6, 94) : clamp(100 - slot.x, 6, 94);
    const kickoffX = attRight ? Math.min(baseX, 47) : Math.max(baseX, 53);
    const dt = pl
      ? DT(pl, careerP)
      : { d: { spd: 60, fin: 60, pw: 60, cur: 60, spass: 60, lpass: 60, crs: 60, run: 60, rd: 60, tkl: 60, pos: 60, mrk: 60, blk: 60, hd: 60, agi: 60, jmp: 60, tol: 60, rec: 65, end: 60, bal: 60, sv: 60, rfx: 60, hnd: 60, cl: 60, dist: 60, sta: 65, comp: 60, vis: 60, det: 60, str: 60 }, sig: 'comp', tr: 3 };
    const effectiveD: Record<string, number> = { ...dt.d };
    if (statDeltas) {
      Object.entries(statDeltas).forEach(([k, delta]) => {
        if (delta && typeof effectiveD[k] === 'number') {
          effectiveD[k] = clamp(Math.round(effectiveD[k] + delta), 20, 99);
        }
      });
    }
    return {
      id: name,
      shortName: name.split(' ')[0] || name,
      no: pl ? getShirtNo(team, pl) : i + 1,
      side,
      slotIndex: i,
      role: slot.sp,
      pos: slot.pos,
      slotX: slot.x,
      slotY: slot.y,
      isMe: Boolean(pl?.me || (myPlayerName && name === myPlayerName)),
      isCaptain: Boolean(activeCap && name === activeCap),
      x: kickoffX,
      y: baseY,
      vx: 0,
      vy: 0,
      tx: kickoffX,
      ty: baseY,
      facing: attRight ? 0 : Math.PI,
      stride: Math.random() * Math.PI * 2,
      intent: 'SUPPORT',
      intentTimer: 0,
      diveDir: 0,
      diveProgress: 0,
      acrobatTimer: 0,
      fit: fitMap[name] ?? pl?.fit ?? 100,
      hasYellow: (yellowsMap[name] || 0) > 0,
      sentOff: sentOffNames.includes(name),
      subbedIn: Boolean(subInSet?.has(name)),
      d: effectiveD,
      sig: dt.sig,
      tr: dt.tr,
      traits: pl ? getPlayerTraits(pl, careerP).map((t) => t.id) : [],
      ov: pl?.ov || 60,
      vis: pl ? visOf(pl, careerP) : [2, 0, 0, 0, 0, i + 1, 0]
    };
  });
};

export const PITCH_FACE_CACHE = new Map<string, HTMLCanvasElement | 'loading'>();
const MAX_PITCH_FACE_CACHE = 220;

const setBoundedPitchFaceCache = (key: string, val: HTMLCanvasElement | 'loading') => {
  if (!PITCH_FACE_CACHE.has(key) && PITCH_FACE_CACHE.size >= MAX_PITCH_FACE_CACHE) {
    const oldestKey = PITCH_FACE_CACHE.keys().next().value;
    if (oldestKey !== undefined) PITCH_FACE_CACHE.delete(oldestKey);
  }
  PITCH_FACE_CACHE.set(key, val);
};

export const getPitchFaceCanvas = (
  vis: number[],
  kit: string,
  trim: string,
  isCoach = false,
  coachOutfit?: CoachOutfitId,
  coachClubKit?: string
): HTMLCanvasElement | null => {
  const key = `${vis.join(',')}|${kit}|${trim}|${isCoach ? 1 : 0}|${coachOutfit || ''}|${coachClubKit || ''}`;
  const existing = PITCH_FACE_CACHE.get(key);
  if (existing && existing !== 'loading') return existing;
  if (existing === 'loading' || typeof Image === 'undefined' || typeof document === 'undefined') return null;

  setBoundedPitchFaceCache(key, 'loading');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="64" viewBox="0 0 60 64">${faceBodySvg(vis, kit, trim, 32, '#10281d', true, !isCoach, undefined, isCoach, coachOutfit, coachClubKit)}</svg>`;
  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas');
    off.width = 64;
    off.height = 68;
    const octx = off.getContext('2d');
    if (octx) {
      octx.drawImage(img, 0, 0, 64, 68);
      setBoundedPitchFaceCache(key, off);
    } else {
      PITCH_FACE_CACHE.delete(key);
    }
  };
  img.onerror = () => {
    PITCH_FACE_CACHE.delete(key);
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return null;
};

let pitchBgCache: { key: string; canvas: HTMLCanvasElement } | null = null;
const puddleSigCache = new WeakMap<object, string>();
const TEXT_WIDTH_CACHE = new Map<string, number>();
const MAX_TEXT_WIDTH_CACHE = 600;
const sortedAgentsBuf: LivePitchAgent[] = [];

const BALL_SPHERE_CACHE = new Map<number, HTMLCanvasElement>();
const MAX_BALL_SPHERE_CACHE = 32;
const getBallSphereSprite = (ballR: number): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null;
  const qR = Math.max(4, Math.round(ballR * 4));
  const hit = BALL_SPHERE_CACHE.get(qR);
  if (hit) return hit;
  const r = qR / 4;
  const scale = 2;
  const pad = 1;
  const dim = Math.ceil((r + pad) * 2 * scale);
  const off = document.createElement('canvas');
  off.width = dim;
  off.height = dim;
  const octx = off.getContext('2d');
  if (!octx) return null;
  octx.scale(scale, scale);
  octx.translate(r + pad, r + pad);
  octx.beginPath();
  octx.arc(0, 0, r, 0, Math.PI * 2);
  octx.clip();
  const sphGrad = octx.createRadialGradient(-r * 0.32, -r * 0.34, r * 0.1, 0, 0, r * 1.06);
  sphGrad.addColorStop(0, '#ffffff');
  sphGrad.addColorStop(0.55, '#f1f5f9');
  sphGrad.addColorStop(1, '#94a3b8');
  octx.fillStyle = sphGrad;
  octx.fillRect(-r - 1, -r - 1, r * 2 + 2, r * 2 + 2);
  if (BALL_SPHERE_CACHE.size >= MAX_BALL_SPHERE_CACHE) {
    const oldest = BALL_SPHERE_CACHE.keys().next().value;
    if (oldest !== undefined) BALL_SPHERE_CACHE.delete(oldest);
  }
  BALL_SPHERE_CACHE.set(qR, off);
  return off;
};

const BLESSED_AURA_CACHE = new Map<number, HTMLCanvasElement>();
const MAX_BLESSED_AURA_CACHE = 24;
const getBlessedAuraSprite = (playerRadius: number): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null;
  const qPr = Math.max(8, Math.round(playerRadius * 2));
  const hit = BLESSED_AURA_CACHE.get(qPr);
  if (hit) return hit;
  const pr = qPr / 2;
  const auraR = pr + 10;
  const scale = 2;
  const dim = Math.ceil(auraR * 2 * scale);
  const off = document.createElement('canvas');
  off.width = dim;
  off.height = dim;
  const octx = off.getContext('2d');
  if (!octx) return null;
  octx.scale(scale, scale);
  octx.translate(auraR, auraR);
  const auraGrad = octx.createRadialGradient(0, 0, pr * 0.5, 0, 0, auraR);
  auraGrad.addColorStop(0, 'rgba(250, 204, 21, 0.42)');
  auraGrad.addColorStop(0.65, 'rgba(52, 211, 153, 0.22)');
  auraGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
  octx.fillStyle = auraGrad;
  octx.beginPath();
  octx.arc(0, 0, auraR, 0, Math.PI * 2);
  octx.fill();
  if (BLESSED_AURA_CACHE.size >= MAX_BLESSED_AURA_CACHE) {
    const oldest = BLESSED_AURA_CACHE.keys().next().value;
    if (oldest !== undefined) BLESSED_AURA_CACHE.delete(oldest);
  }
  BLESSED_AURA_CACHE.set(qPr, off);
  return off;
};

const CTX_GRADIENT_CACHE = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();
const MAX_CTX_GRAD_CACHE = 48;
const getCachedCtxGradient = (
  ctx: CanvasRenderingContext2D,
  key: string,
  builder: () => CanvasGradient
): CanvasGradient => {
  let map = CTX_GRADIENT_CACHE.get(ctx);
  if (!map) {
    map = new Map();
    CTX_GRADIENT_CACHE.set(ctx, map);
  }
  const hit = map.get(key);
  if (hit) return hit;
  const grad = builder();
  if (map.size >= MAX_CTX_GRAD_CACHE) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, grad);
  return grad;
};

const drawSoftRoundedShadow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  spread = 2.5,
  dy = 2
) => {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.beginPath();
  ctx.roundRect(x - spread * 0.5, y + dy - spread * 0.25, w + spread, h + spread * 0.75, radius + 1.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.roundRect(x, y + dy, w, h, radius);
  ctx.fill();
};

const measureTextCached = (ctx: CanvasRenderingContext2D, text: string): number => {
  const key = `${ctx.font}|${text}`;
  const hit = TEXT_WIDTH_CACHE.get(key);
  if (hit !== undefined) return hit;
  const w = ctx.measureText(text).width;
  if (TEXT_WIDTH_CACHE.size >= MAX_TEXT_WIDTH_CACHE) {
    const oldest = TEXT_WIDTH_CACHE.keys().next().value;
    if (oldest !== undefined) TEXT_WIDTH_CACHE.delete(oldest);
  }
  TEXT_WIDTH_CACHE.set(key, w);
  return w;
};

const fitCanvasText = (ctx: CanvasRenderingContext2D, text: string, maxW: number): string => {
  if (measureTextCached(ctx, text) <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measureTextCached(ctx, `${text.slice(0, mid)}…`) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo)}…` : '…';
};

const resolvePitchPerimeterBrands = (
  env?: Pick<MatchEnvironment, 'perimeterBrands' | 'pitchSeed'> | null
): PitchPerimeterBrand[] => {
  if (env?.perimeterBrands?.length) {
    return env.perimeterBrands;
  }
  const seed = Math.abs(env?.pitchSeed ?? 137);
  const sp = SHIRT_SPONSOR_BRANDS[seed % SHIRT_SPONSOR_BRANDS.length] || SHIRT_SPONSOR_BRANDS[0];
  const p0 = PARTNER_DEAL_BRAND_SPECS[seed % PARTNER_DEAL_BRAND_SPECS.length];
  const p1 = PARTNER_DEAL_BRAND_SPECS[(seed + 3) % PARTNER_DEAL_BRAND_SPECS.length];
  const p2 = PARTNER_DEAL_BRAND_SPECS[(seed + 6) % PARTNER_DEAL_BRAND_SPECS.length];
  return [
    { kind: 'partner', id: p0.id, label: p0.label, shortLabel: p0.shortLabel, bg: p0.bg, accent: p0.accent },
    { kind: 'sponsor', id: sp.id, label: sp.thName, shortLabel: sp.code, bg: sp.badgeBg, accent: sp.accent, motif: sp.motif },
    { kind: 'partner', id: p1.id, label: p1.label, shortLabel: p1.shortLabel, bg: p1.bg, accent: p1.accent },
    { kind: 'partner', id: p2.id, label: p2.label, shortLabel: p2.shortLabel, bg: p2.bg, accent: p2.accent }
  ];
};

const getPerimeterSig = (brands: PitchPerimeterBrand[]): string =>
  brands.map((b) => `${b.kind[0]}:${b.id}`).join(',');

const drawPerimeterDealerLogoEmblem = (
  ctx: CanvasRenderingContext2D,
  brand: PitchPerimeterBrand,
  cx: number,
  cy: number,
  size: number
) => {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 36, size / 36);

  // Rounded logo tile
  ctx.fillStyle = brand.bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, 36, 36, 8);
  ctx.fill();
  ctx.strokeStyle = brand.accent;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(1, 1, 34, 34, 7.2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const fg = '#ffffff';
  const ac = brand.accent;

  if (brand.kind === 'partner') {
    switch (brand.id) {
      case 'drink': {
        ctx.fillStyle = ac;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.moveTo(18, 7);
        ctx.bezierCurveTo(18, 7, 25.5, 15.5, 25.5, 21);
        ctx.arc(18, 21, 7.5, 0, Math.PI, false);
        ctx.bezierCurveTo(10.5, 15.5, 18, 7, 18, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2.1;
        ctx.stroke();
        ctx.fillStyle = ac;
        ctx.beginPath();
        ctx.moveTo(19, 14);
        ctx.lineTo(15.5, 20);
        ctx.lineTo(18.5, 20);
        ctx.lineTo(17, 25.5);
        ctx.lineTo(21, 19.5);
        ctx.lineTo(18, 19.5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'snack': {
        ctx.lineCap = 'round';
        ctx.strokeStyle = ac;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(9, 23.5);
        ctx.quadraticCurveTo(13.5, 12, 18, 18);
        ctx.quadraticCurveTo(22.5, 24, 27, 12);
        ctx.stroke();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2.3;
        ctx.beginPath();
        ctx.moveTo(9, 27);
        ctx.quadraticCurveTo(14, 21, 18, 24);
        ctx.quadraticCurveTo(22.5, 27, 27, 20);
        ctx.stroke();
        break;
      }
      case 'apparel': {
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(9, 13);
        ctx.lineTo(14, 9);
        ctx.lineTo(22, 9);
        ctx.lineTo(27, 13);
        ctx.lineTo(24, 17);
        ctx.lineTo(22, 15.5);
        ctx.lineTo(22, 27);
        ctx.lineTo(14, 27);
        ctx.lineTo(14, 15.5);
        ctx.lineTo(12, 17);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = ac;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(15, 20);
        ctx.lineTo(21, 17);
        ctx.stroke();
        break;
      }
      case 'tyre': {
        ctx.strokeStyle = fg;
        ctx.lineWidth = 3.4;
        ctx.setLineDash([4.2, 2.3]);
        ctx.beginPath();
        ctx.arc(18, 18, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = ac;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.arc(18, 18, 4.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ac;
        ctx.beginPath();
        ctx.arc(18, 18, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'convenience': {
        ctx.strokeStyle = ac;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(7, 10, 22, 16, 3);
        ctx.stroke();
        ctx.fillStyle = fg;
        ctx.font = '900 11.5px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('24', 18, 18.6);
        break;
      }
      case 'ecom': {
        ctx.strokeStyle = ac;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(18, 12.5, 5, Math.PI, 0);
        ctx.stroke();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.roundRect(9, 13, 18, 14, 2.5);
        ctx.stroke();
        ctx.strokeStyle = ac;
        ctx.beginPath();
        ctx.moveTo(14, 20);
        ctx.lineTo(18, 17);
        ctx.lineTo(22, 20);
        ctx.stroke();
        break;
      }
      case 'telecom': {
        ctx.lineCap = 'round';
        ctx.strokeStyle = ac;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(18, 22, 10.5, Math.PI * 1.18, Math.PI * 1.82);
        ctx.stroke();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.arc(18, 22, 6.2, Math.PI * 1.18, Math.PI * 1.82);
        ctx.stroke();
        ctx.fillStyle = ac;
        ctx.beginPath();
        ctx.arc(18, 23.5, 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(15.5, 28);
        ctx.lineTo(18, 25);
        ctx.lineTo(20.5, 28);
        ctx.stroke();
        break;
      }
      case 'fintech': {
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.roundRect(7, 10, 22, 16, 3);
        ctx.stroke();
        ctx.strokeStyle = ac;
        ctx.lineWidth = 2.7;
        ctx.beginPath();
        ctx.moveTo(7, 15);
        ctx.lineTo(29, 15);
        ctx.stroke();
        ctx.fillStyle = ac;
        ctx.beginPath();
        ctx.roundRect(11, 19.5, 6.5, 3.6, 1);
        ctx.fill();
        break;
      }
      case 'airline': {
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(8, 21);
        ctx.lineTo(27, 11);
        ctx.lineTo(21, 24);
        ctx.lineTo(17, 20);
        ctx.lineTo(12, 25);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = ac;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(9, 26.5);
        ctx.lineTo(26, 26.5);
        ctx.stroke();
        break;
      }
      case 'asia_tech':
      default: {
        ctx.strokeStyle = ac;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.arc(18, 18, 9.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(18, 18, 4.5, 9.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.5, 18);
        ctx.lineTo(27.5, 18);
        ctx.stroke();
        break;
      }
    }
  } else {
    // Main shirt sponsor geometric emblem (matches motif buckets cleanly at small LED size)
    const m = ((brand.motif ?? 0) % 8 + 8) % 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (m === 0) {
      ctx.strokeStyle = ac;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(18, 7);
      ctx.lineTo(27, 11);
      ctx.lineTo(27, 19);
      ctx.quadraticCurveTo(27, 25.5, 18, 29.5);
      ctx.quadraticCurveTo(9, 25.5, 9, 19);
      ctx.lineTo(9, 11);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = fg;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(13.5, 18.5);
      ctx.lineTo(17, 22);
      ctx.lineTo(23.5, 14.5);
      ctx.stroke();
    } else if (m === 1) {
      ctx.fillStyle = ac;
      ctx.beginPath();
      ctx.moveTo(20, 7.5);
      ctx.lineTo(12, 19);
      ctx.lineTo(18, 19);
      ctx.lineTo(15.5, 28.5);
      ctx.lineTo(24.5, 16.5);
      ctx.lineTo(18.5, 16.5);
      ctx.closePath();
      ctx.fill();
    } else if (m === 2) {
      ctx.strokeStyle = ac;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(18, 18, 9.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(12.5, 23);
      ctx.lineTo(18, 11);
      ctx.lineTo(23.5, 23);
      ctx.closePath();
      ctx.fill();
    } else if (m === 3) {
      ctx.strokeStyle = ac;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(7.5, 9.5, 21, 15, 3);
      ctx.stroke();
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(15, 13.2);
      ctx.lineTo(22.5, 17);
      ctx.lineTo(15, 20.8);
      ctx.closePath();
      ctx.fill();
    } else if (m === 4) {
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(8, 22.5);
      ctx.quadraticCurveTo(15, 14, 28, 11);
      ctx.quadraticCurveTo(22, 18.5, 13, 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ac;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(10, 26.5);
      ctx.lineTo(26.5, 21.5);
      ctx.stroke();
    } else if (m === 5) {
      ctx.strokeStyle = ac;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(8, 24);
      ctx.lineTo(10.5, 12);
      ctx.lineTo(15, 17.5);
      ctx.lineTo(18, 9.5);
      ctx.lineTo(21, 17.5);
      ctx.lineTo(25.5, 12);
      ctx.lineTo(28, 24);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = fg;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(9, 27);
      ctx.lineTo(27, 27);
      ctx.stroke();
    } else if (m === 6) {
      ctx.strokeStyle = ac;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(18, 7.5);
      ctx.lineTo(27.5, 18);
      ctx.lineTo(18, 28.5);
      ctx.lineTo(8.5, 18);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(18, 18, 3.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = ac;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(18, 7.5);
      ctx.lineTo(21.1, 14);
      ctx.lineTo(28, 15);
      ctx.lineTo(23, 20);
      ctx.lineTo(24.2, 27);
      ctx.lineTo(18, 23.6);
      ctx.lineTo(11.8, 27);
      ctx.lineTo(13, 20);
      ctx.lineTo(8, 15);
      ctx.lineTo(14.9, 14);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(18, 18, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
};

const drawSingleDealerLedBoard = (
  ctx: CanvasRenderingContext2D,
  brand: PitchPerimeterBrand,
  x: number,
  y: number,
  w: number,
  h: number,
  isNight: boolean
) => {
  const rad = clamp(h * 0.2, 2.2, 4.5);
  ctx.save();

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 1.5, w, h, rad);
  ctx.fill();

  // LED board backdrop gradient
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, brand.bg);
  grad.addColorStop(1, isNight ? '#070d18' : '#0b1422');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
  ctx.fill();

  // Crisp LED frame border & glowing accent top bar
  ctx.strokeStyle = isNight ? 'rgba(255, 255, 255, 0.24)' : 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = Math.max(0.8, h * 0.055);
  ctx.stroke();

  ctx.fillStyle = brand.accent;
  ctx.globalAlpha = isNight ? 0.85 : 0.72;
  ctx.beginPath();
  ctx.roundRect(x + 1.5, y + 1, Math.max(4, w - 3), Math.max(1.2, h * 0.1), 1);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Brand emblem badge on left of LED panel
  const iconSize = clamp(h - 3.4, 8.5, 22);
  const padL = clamp(h * 0.22, 3, 6);
  const iconCx = x + padL + iconSize * 0.5;
  const iconCy = y + h * 0.53;
  drawPerimeterDealerLogoEmblem(ctx, brand, iconCx, iconCy, iconSize);

  // Brand label next to emblem (auto-selects Thai label or punchy shortLabel to prevent clipping)
  const textX = x + padL + iconSize + clamp(h * 0.22, 3.2, 7);
  const textMaxW = x + w - padL - textX;
  if (textMaxW >= 16) {
    const fontPx = clamp(h * 0.5, 7.2, 12.5);
    ctx.font = `800 ${fontPx.toFixed(1)}px "Noto Sans Thai", ui-sans-serif, system-ui, sans-serif`;
    const chosenText =
      measureTextCached(ctx, brand.label) <= textMaxW
        ? brand.label
        : fitCanvasText(ctx, brand.shortLabel || brand.label, textMaxW);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(chosenText, textX, y + h * 0.54);
  }

  ctx.restore();
};

const drawPitchPerimeterDealerBoards = (
  ctx: CanvasRenderingContext2D,
  opts: {
    padX: number;
    padTop: number;
    pw: number;
    ph: number;
    isNight: boolean;
    env?: MatchEnvironment | null;
  }
) => {
  const { padX, padTop, pw, ph, isNight, env } = opts;
  const brands = resolvePitchPerimeterBrands(env);
  if (!brands.length) return;

  // 1. Top Perimeter Dealer LED Row (ขอบสนามส่วนบน)
  const topBoardH = clamp(padTop * 0.44, 13, 28);
  const topGapFromLine = Math.max(3, padTop * 0.09);
  const topBoardY = Math.max(2, padTop - topBoardH - topGapFromLine);
  const topStartX = padX + 4;
  const topAvailW = Math.max(60, pw - 8);
  const topCount = topAvailW >= 900 ? 8 : topAvailW >= 410 ? 6 : 5;
  const panelGap = Math.max(3, pw * 0.0055);
  const topPanelW = (topAvailW - panelGap * (topCount - 1)) / topCount;

  for (let i = 0; i < topCount; i++) {
    const brand = brands[i % brands.length];
    const bx = topStartX + i * (topPanelW + panelGap);
    drawSingleDealerLedBoard(ctx, brand, bx, topBoardY, topPanelW, topBoardH, isNight);
  }

  // 2. Left & Right Behind-the-Goal Perimeter Dealer Boards (ขอบสนามซ้ายและขวา)
  const sideBoardT = clamp(padX * 0.56, 13, 28);
  const sideGapFromLine = Math.max(3, padX * 0.085);
  const leftCx = Math.max(sideBoardT * 0.5 + 1.5, padX - sideGapFromLine - sideBoardT * 0.5);
  const rightCx = padX + pw + sideGapFromLine + sideBoardT * 0.5;
  const wings: [number, number][] = [
    [padTop + ph * 0.025, padTop + ph * 0.385],
    [padTop + ph * 0.615, padTop + ph * 0.975]
  ];

  wings.forEach(([wy0, wy1], wingIdx) => {
    const wingH = Math.max(24, wy1 - wy0);
    const wingPanels = wingH >= 102 ? 2 : 1;
    const pGap = Math.max(3, ph * 0.012);
    const segLen = (wingH - pGap * (wingPanels - 1)) / wingPanels;

    for (let k = 0; k < wingPanels; k++) {
      const segCy = wy0 + segLen * 0.5 + k * (segLen + pGap);

      // Left edge board facing inward (-90 deg)
      const leftBrand = brands[(wingIdx * wingPanels + k + 1) % brands.length];
      ctx.save();
      ctx.translate(leftCx, segCy);
      ctx.rotate(-Math.PI / 2);
      drawSingleDealerLedBoard(ctx, leftBrand, -segLen / 2, -sideBoardT / 2, segLen, sideBoardT, isNight);
      ctx.restore();

      // Right edge board facing inward (+90 deg)
      const rightBrand = brands[(wingIdx * wingPanels + k + 2) % brands.length];
      ctx.save();
      ctx.translate(rightCx, segCy);
      ctx.rotate(Math.PI / 2);
      drawSingleDealerLedBoard(ctx, rightBrand, -segLen / 2, -sideBoardT / 2, segLen, sideBoardT, isNight);
      ctx.restore();
    }
  });
};

export type VarCameraMode = 'full' | 'wide' | 'zoom';

const renderVarMonitorPanel = (
  ctx: CanvasRenderingContext2D,
  vr: VarReviewState,
  pct: number,
  monX: number,
  monY: number,
  monW: number,
  monH: number,
  pitchAspect: number,
  homeKit: string,
  awayKit: string,
  homeGkKit: string,
  awayGkKit: string,
  homeTrim: string,
  awayTrim: string,
  isStandalone = false,
  cameraMode: VarCameraMode = 'wide',
  followBall = false
) => {
  const rep = vr.replay;
  const accent = vr.kind === 'foul_card' ? '#f59e0b' : '#38bdf8';
  const verdictPositiveForCall =
    vr.kind === 'goal'
      ? !vr.overturn
      : vr.kind === 'penalty'
        ? !vr.overturn
        : vr.pendingCardUpgrade !== 'R';
  const verdictColor =
    vr.kind === 'goal'
      ? vr.overturn
        ? '#ef4444'
        : '#22c55e'
      : vr.kind === 'penalty'
        ? vr.overturn
          ? '#38bdf8'
          : '#ef4444'
        : vr.pendingCardUpgrade === 'R'
          ? '#ef4444'
          : '#facc15';
  const showVerdict = pct >= 0.72;
  const frameAccent = showVerdict ? verdictColor : accent;
  const smallText = !isStandalone && monW < 185;
  const sc = rep?.scenario;

  // Forensic 3-stage timeline:
  // 0.00..0.36: Slow-mo buildup (simT 0.00 -> 0.49)
  // 0.36..0.64: Freeze-frame inspection lock (simT holds 0.49 -> 0.51 with micro-shimmer)
  // 0.64..1.00: Resumed follow-through & referee call (simT 0.51 -> 1.00)
  const isFreezePhase = pct >= 0.36 && pct < 0.64;
  const simT =
    pct < 0.36
      ? (pct / 0.36) * 0.49
      : pct < 0.64
        ? 0.49 + ((pct - 0.36) / 0.28) * 0.02
        : 0.51 + ((pct - 0.64) / 0.36) * 0.49;
  const zoomEnv =
    pct < 0.36
      ? Math.pow(clamp(pct / 0.36, 0, 1), 1.4)
      : pct < 0.64
        ? 1
        : 1 - clamp((pct - 0.64) / 0.3, 0, 1) * 0.55;

  ctx.save();
  if (!isStandalone) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.beginPath();
    ctx.roundRect(monX + 2, monY + 3, monW, monH, 9);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(8, 14, 26, 0.98)';
  ctx.strokeStyle = frameAccent;
  ctx.lineWidth = isStandalone ? 2.2 : 1.8;
  ctx.beginPath();
  ctx.roundRect(monX, monY, monW, monH, isStandalone ? 12 : 9);
  ctx.fill();
  ctx.stroke();

  const hdrH = isStandalone ? clamp(monH * 0.085, 20, 24) : smallText ? 16 : 19;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.98)';
  ctx.beginPath();
  ctx.roundRect(monX + 1.5, monY + 1.5, monW - 3, hdrH, isStandalone ? [10, 10, 0, 0] : [7.5, 7.5, 0, 0]);
  ctx.fill();

  const recBlink = pct < 0.72 ? 0.55 + 0.45 * Math.sin(pct * Math.PI * 14) : 1;
  ctx.fillStyle = showVerdict ? frameAccent : `rgba(239, 68, 68, ${recBlink.toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(monX + (isStandalone ? 13 : 9.5), monY + hdrH / 2 + 0.5, isStandalone ? 3.5 : 2.8, 0, Math.PI * 2);
  ctx.fill();

  const statusTag = showVerdict
    ? vr.kind === 'goal'
      ? sc === 'goal_line_tech'
        ? vr.overturn
          ? '❌ บอลยังไม่ข้ามเส้น · ริบประตู!'
          : '✅ บอลข้ามเส้นเต็มใบ · ให้ประตู!'
        : sc === 'foul_buildup'
          ? vr.overturn
            ? '❌ ฟาวล์จังหวะขึ้นเกม · ริบประตู!'
            : '✅ ปะทะปกติ · ยืนยันให้ประตู!'
          : vr.overturn
            ? '❌ ล้ำหน้า · ริบประตู!'
            : '✅ ไม่ล้ำหน้า · ให้ประตู!'
      : vr.kind === 'penalty'
        ? sc === 'handball_box'
          ? vr.overturn
            ? 'แขนแนบตัว/นอกเขต · ไม่จุดโทษ'
            : '🚨 แฮนด์บอลในเขต · จุดโทษ!'
          : sc === 'gk_clash_box'
            ? vr.overturn
              ? 'ผู้รักษาประตูถึงบอลก่อน · ไม่จุดโทษ'
              : '🚨 รวบในเขตโทษ · จุดโทษ!'
            : vr.overturn
              ? 'นอกกรอบ · ได้ฟรีคิก'
              : '🚨 ฟาวล์ในเขต · จุดโทษ!'
        : vr.pendingCardUpgrade === 'R'
          ? '🟥 ยกระดับเป็นใบแดง!'
          : '🟨 ให้แค่ใบเหลือง'
    : isFreezePhase
      ? 'หยุดภาพตรวจจุด'
      : 'สโลว์โมชัน';

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc';
  ctx.font = `800 ${isStandalone ? 11 : smallText ? 8 : 9}px "Noto Sans Thai", sans-serif`;
  const hdrTitleRaw = showVerdict
    ? '🖥 VAR'
    : isStandalone
      ? followBall && cameraMode !== 'full'
        ? `🖥 VAR · ตามบอล (${cameraMode === 'zoom' ? 'ใกล้' : 'ไกล'})`
        : cameraMode === 'full'
          ? '🖥 VAR · ทั้งสนาม'
          : cameraMode === 'wide'
            ? '🖥 VAR · ระยะไกล'
            : '🖥 VAR · ระยะใกล้'
      : '🖥 VAR REPLAY';
  const hdrLeftX = monX + (isStandalone ? 22 : 16);
  const statusFontSize = showVerdict ? (isStandalone ? 11 : smallText ? 7.8 : 8.8) : (isStandalone ? 10.5 : smallText ? 7.8 : 8.8);
  const titleNaturalW = measureTextCached(ctx, hdrTitleRaw);
  const titleReservedW = showVerdict
    ? Math.min(titleNaturalW + 8, isStandalone ? 76 : 58)
    : Math.min(titleNaturalW + 8, monW * 0.56);
  const maxTagW = Math.max(48, monW - (hdrLeftX - monX) - titleReservedW - (isStandalone ? 14 : 10));

  ctx.textAlign = 'right';
  ctx.fillStyle = frameAccent;
  ctx.font = `800 ${statusFontSize}px "Noto Sans Thai", sans-serif`;
  const fittedTag = fitCanvasText(ctx, statusTag, maxTagW);
  const fittedTagW = measureTextCached(ctx, fittedTag) + (isStandalone ? 16 : 10);
  ctx.fillText(fittedTag, monX + monW - (isStandalone ? 11 : 8), monY + hdrH / 2 + 0.6);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = `800 ${isStandalone ? 11 : smallText ? 8 : 9}px "Noto Sans Thai", sans-serif`;
  const hdrMaxW = Math.max(34, monW - (hdrLeftX - monX) - fittedTagW - (isStandalone ? 10 : 8));
  ctx.fillText(fitCanvasText(ctx, hdrTitleRaw, hdrMaxW), hdrLeftX, monY + hdrH / 2 + 0.6);

  if (showVerdict) {
    ctx.fillStyle = verdictColor;
    ctx.fillRect(monX + 2, monY + hdrH + 0.5, monW - 4, 1.8);
  }

  const scrPad = isStandalone ? 5 : 3.5;
  const scrX = monX + scrPad;
  const scrY = monY + hdrH + (showVerdict ? 3.5 : 2);
  const scrW = monW - scrPad * 2;
  const scrH = monH - hdrH - scrPad - (showVerdict ? 3.5 : 2);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(scrX, scrY, scrW, scrH, isStandalone ? 8 : 5.5);
  ctx.clip();

  const attRight = rep?.attRight ?? (vr.x >= 50);
  const attSide = vr.side;
  const defSide: 'H' | 'A' = attSide === 'H' ? 'A' : 'H';
  const attKit = attSide === 'H' ? homeKit : awayKit;
  const attTrim = attSide === 'H' ? homeTrim : awayTrim;
  const defKit = defSide === 'H' ? homeKit : awayKit;
  const defTrim = defSide === 'H' ? homeTrim : awayTrim;
  const defGkKit = defSide === 'H' ? homeGkKit : awayGkKit;

  // Dynamic Broadcast Camera: Full Pitch vs Wide Tactical Framing vs Close-Up Zoom + Follow Ball
  const isFullCam = cameraMode === 'full';
  const isWideCam = cameraMode === 'wide';
  const rawIncX = rep?.incidentX ?? vr.x;
  const rawIncY = rep?.incidentY ?? vr.y ?? 50;
  const attDir = attRight ? 1 : -1;
  let baseCamX = rawIncX;
  let baseCamY = rawIncY;
  let startCamX = rawIncX;
  let startCamY = rawIncY;
  let baseSpanX = isWideCam ? 52 : 28;
  if (isFullCam) {
    baseCamX = 50;
    baseCamY = 50;
    startCamX = 50;
    startCamY = 50;
    baseSpanX = Math.max(109, (106 * Math.max(1, scrW)) / (Math.max(1, scrH) * pitchAspect));
  } else if (vr.kind === 'goal') {
    if (sc === 'goal_line_tech') {
      const shooterX = attRight ? clamp(rep?.passFromX ?? 88, 76, 95.5) : clamp(rep?.passFromX ?? 12, 4.5, 24);
      const goalLineX = attRight ? 100 : 0;
      if (isWideCam) {
        const minNeedX = Math.min(shooterX - 5, attRight ? 82 : -2.5);
        const maxNeedX = Math.max(shooterX + 5, attRight ? 102.5 : 18);
        baseSpanX = clamp(maxNeedX - minNeedX + 10, 48, 58);
        baseCamX = attRight ? 102.5 - baseSpanX * 0.45 : -2.5 + baseSpanX * 0.45;
        baseCamY = clamp(rawIncY, 34, 66);
        startCamX = baseCamX - attDir * 2.0;
        startCamY = baseCamY;
      } else {
        baseSpanX = clamp(Math.abs(goalLineX - shooterX) + 14, 24, 34);
        baseCamX = attRight ? 102.2 - baseSpanX * 0.43 : -2.2 + baseSpanX * 0.43;
        baseCamY = clamp(rawIncY, 38, 62);
        startCamX = baseCamX - attDir * 1.8;
        startCamY = baseCamY;
      }
    } else if (sc === 'foul_buildup') {
      if (isWideCam) {
        const minNeedX = Math.min(rawIncX - 8, attRight ? 81 : -2.5);
        const maxNeedX = Math.max(rawIncX + 8, attRight ? 102.5 : 19);
        baseSpanX = clamp(maxNeedX - minNeedX + 10, 48, 60);
        baseCamX = (minNeedX + maxNeedX) * 0.5;
        baseCamY = clamp(rawIncY, 30, 70);
        startCamX = baseCamX - attDir * 2.0;
        startCamY = baseCamY;
      } else {
        baseCamX = attRight ? clamp(rawIncX + 3.5, 72, 91) : clamp(rawIncX - 3.5, 9, 28);
        baseCamY = clamp(rawIncY, 28, 72);
        startCamX = baseCamX - attDir * 2.5;
        startCamY = baseCamY;
        baseSpanX = 30;
      }
    } else {
      const defLX = rep?.defLineX ?? (attRight ? 84 : 16);
      const passX = rep?.passFromX ?? (attRight ? clamp(rawIncX - 13, 28, 80) : clamp(rawIncX + 13, 20, 72));
      if (isWideCam) {
        const minNeedX = Math.min(passX - 6, rawIncX - 5, defLX - 5, attRight ? 81 : -2.5);
        const maxNeedX = Math.max(passX + 6, rawIncX + 5, defLX + 5, attRight ? 102.5 : 19);
        baseSpanX = clamp(maxNeedX - minNeedX + 10, 50, 68);
        baseCamX = (minNeedX + maxNeedX) * 0.5;
        baseCamY = clamp(rep?.passFromY != null ? (rawIncY + rep.passFromY) * 0.5 : rawIncY, 28, 72);
        startCamX = baseCamX - attDir * 1.5;
        startCamY = baseCamY;
      } else {
        baseSpanX = clamp(Math.abs(rawIncX - defLX) + 26, 30, 40);
        baseCamX = (rawIncX + defLX) * 0.5 + attDir * 2.5;
        baseCamY = clamp(rawIncY, 28, 72);
        startCamX = rep?.passFromX != null ? baseCamX * 0.78 + rep.passFromX * 0.22 : baseCamX - attDir * 2.5;
        startCamY = rep?.passFromY != null ? clamp(baseCamY * 0.78 + rep.passFromY * 0.22, 26, 74) : baseCamY;
      }
    }
  } else if (vr.kind === 'penalty') {
    const boxEdge = attRight ? 83.5 : 16.5;
    if (isWideCam) {
      const minNeedX = Math.min(rawIncX - 8, rep?.passFromX ?? rawIncX, attRight ? 79 : -2.5);
      const maxNeedX = Math.max(rawIncX + 8, rep?.passFromX ?? rawIncX, attRight ? 102.5 : 21);
      baseSpanX = clamp(maxNeedX - minNeedX + 8, 48, 58);
      baseCamX = (minNeedX + maxNeedX) * 0.5;
      baseCamY = clamp(rawIncY, 30, 70);
      startCamX = baseCamX - attDir * 1.5;
      startCamY = baseCamY;
    } else if (sc === 'gk_clash_box') {
      baseCamX = attRight ? 90.5 : 9.5;
      baseCamY = clamp(rawIncY, 33, 67);
      startCamX = attRight ? 87.5 : 12.5;
      startCamY = baseCamY;
      baseSpanX = 28;
    } else {
      baseCamX = attRight ? clamp((rawIncX + boxEdge) * 0.5 + 1.5, 76, 92) : clamp((rawIncX + boxEdge) * 0.5 - 1.5, 8, 24);
      baseCamY = clamp(rawIncY, 24, 76);
      startCamX = baseCamX - attDir * 2.0;
      startCamY = baseCamY;
      baseSpanX = 28;
    }
  } else {
    const isDogsoCam = sc === 'dogso' || rep?.foulKind === 'dogso';
    if (isWideCam) {
      if (isDogsoCam) {
        const gX = attRight ? 102 : -2;
        const minNeedX = Math.min(rawIncX - 8, gX);
        const maxNeedX = Math.max(rawIncX + 8, gX);
        baseSpanX = clamp(maxNeedX - minNeedX + 10, 52, 68);
        baseCamX = (minNeedX + maxNeedX) * 0.5;
      } else {
        baseSpanX = 54;
        baseCamX = clamp(rawIncX, 24, 76);
      }
      baseCamY = clamp(rawIncY, 26, 74);
      startCamX = baseCamX - attDir * 1.5;
      startCamY = baseCamY;
    } else {
      baseCamX = clamp(rawIncX, 14, 86);
      baseCamY = clamp(rawIncY, 18, 82);
      if (isDogsoCam) {
        baseCamX = attRight ? clamp(rawIncX + 4.5, 16, 86) : clamp(rawIncX - 4.5, 14, 84);
      }
      startCamX = clamp(baseCamX - attDir * 2.2, 10, 90);
      startCamY = baseCamY;
      baseSpanX = isDogsoCam ? 34 : 27;
    }
  }

  const panT = clamp(simT / 0.5, 0, 1);
  const panEase = 1 - Math.pow(1 - panT, 2);
  const zoomMaxDrop = isFullCam ? 0 : isWideCam ? 0.05 : isStandalone ? 0.14 : 0.08;
  const spanX = baseSpanX * (1 - zoomMaxDrop * zoomEnv);
  const spanY = spanX * (scrH / Math.max(1, scrW)) * pitchAspect;
  const pxPerFx = scrW / Math.max(1, spanX);
  const pxPerFy = scrH / Math.max(1, spanY);
  const screenAngle = (fx0: number, fy0: number, fx1: number, fy1: number) =>
    Math.atan2((fy1 - fy0) * pxPerFy, (fx1 - fx0) * pxPerFx);

  const modeSizeScale = isFullCam ? 0.68 : isWideCam ? 0.78 : 1;
  const rawPlayT = clamp(simT / 0.49, 0, 1);
  const playT = 1 - Math.pow(1 - rawPlayT, 2.05);
  const slideStartPlayT = 1 - Math.pow(1 - clamp(0.2 / 0.49, 0, 1), 2.05);
  const slideActionProg = simT >= 0.2 ? clamp((simT - 0.2) / 0.58, 0, 1) : 0;
  const slideExtendNow = Math.sin(clamp(slideActionProg * 2, 0, 1) * (Math.PI / 2));
  const postT = clamp((simT - 0.51) / 0.49, 0, 1);
  const dirSign = attRight ? 1 : -1;
  const agentPixR = (isStandalone ? clamp(scrH * 0.072, 8.2, 12.6) : clamp(scrH * 0.074, 5.2, 7.4)) * modeSizeScale;
  const agentFxR = agentPixR / pxPerFx;
  const agentFyR = agentPixR / pxPerFy;
  const baseBallPixR = (isStandalone ? 5.4 : smallText ? 3.4 : 4.0) * (isFullCam ? 0.72 : isWideCam ? 0.82 : 1);
  const ballFxR = baseBallPixR / pxPerFx;
  const ballFyR = baseBallPixR / pxPerFy;

  let trackBallX = rawIncX;
  let trackBallY = rawIncY;
  if (followBall && !isFullCam) {
    if (vr.kind === 'goal') {
      if (sc === 'goal_line_tech') {
        const goalLineX = attRight ? 100 : 0;
        const incY = clamp(rep?.shotTargetY ?? rep?.incidentY ?? 50, 43.4, 56.6);
        const startX = attRight ? clamp(rep?.passFromX ?? 90.5, 78, 95.5) : clamp(rep?.passFromX ?? 9.5, 4.5, 22);
        const startY = clamp(rep?.passFromY ?? (incY + (incY < 50 ? 2.5 : -2.5)), 34, 66);
        const mm = rep?.goalLineMm ?? 24;
        const overlapFrac = clamp(mm / 110, 0.14, 0.78);
        const apexX = vr.overturn
          ? goalLineX + dirSign * ballFxR * (1 - overlapFrac)
          : goalLineX + dirSign * ballFxR * (1 + overlapFrac);
        const clearX = attRight ? 96.4 : 3.6;
        const netSettleX = attRight ? 101.8 : -1.8;
        const ballPhase = clamp((simT - 0.12) / 0.37, 0, 1);
        const easeBall = 1 - Math.pow(1 - ballPhase, 1.85);
        trackBallX =
          postT > 0
            ? vr.overturn
              ? apexX + (clearX - apexX) * postT
              : apexX + (netSettleX - apexX) * clamp(postT * 1.35, 0, 1)
            : startX + (apexX - startX) * easeBall;
        trackBallY = startY + (incY - startY) * easeBall + (vr.overturn ? postT * (incY < 50 ? 2.4 : -2.4) : 0);
      } else if (sc === 'foul_buildup') {
        const incX = rep?.incidentX ?? (attRight ? 80 : 20);
        const incY = rep?.incidentY ?? 48;
        const goalX = attRight ? 101.4 : -1.4;
        const goalY = clamp(rep?.shotTargetY ?? 50, 43.8, 56.2);
        const attShotFacing = screenAngle(incX, incY, goalX, goalY);
        const stepT = clamp(postT / 0.35, 0, 1);
        const attXNow = incX - dirSign * (1 - playT) * 4.5 + stepT * dirSign * 1.15;
        const attYNow = incY + (1 - playT) * 1.5 + stepT * (goalY - incY) * 0.04;
        const shootOriginX = incX + dirSign * 1.25;
        const shootOriginY = incY + (goalY - incY) * 0.04;
        const shotProg = clamp((postT - 0.14) / 0.86, 0, 1);
        const dribbleBallX = attXNow + Math.cos(attShotFacing) * (agentFxR * 0.72);
        const dribbleBallY = attYNow + Math.sin(attShotFacing) * (agentFyR * 0.72);
        trackBallX =
          shotProg > 0
            ? shootOriginX + (goalX - shootOriginX) * shotProg
            : dribbleBallX + (shootOriginX - dribbleBallX) * stepT;
        trackBallY =
          shotProg > 0
            ? shootOriginY + (goalY - shootOriginY) * shotProg
            : dribbleBallY + (shootOriginY - dribbleBallY) * stepT;
      } else {
        const incX = rep?.incidentX ?? (attRight ? 86 : 14);
        const incY = rep?.incidentY ?? 48;
        const goalX = attRight ? 101.4 : -1.4;
        const targetGoalY = clamp(rep?.shotTargetY ?? 50, 43.8, 56.2);
        const meetX = attRight ? clamp(incX + 2.4, 70, 95.8) : clamp(incX - 2.4, 4.2, 30);
        const meetY = clamp(incY + (targetGoalY - incY) * 0.16, 12, 88);
        const passStartX = rep?.passFromX ?? (incX - dirSign * 11);
        const passStartY = rep?.passFromY ?? clamp(incY + 7, 18, 82);
        const passAng = screenAngle(passStartX, passStartY, meetX, meetY);
        const passerFootX = passStartX + Math.cos(passAng) * (agentFxR * 0.9);
        const passerFootY = passStartY + Math.sin(passAng) * (agentFyR * 0.9);
        const recvT = clamp(postT / 0.46, 0, 1);
        const finishT = postT > 0.46 ? clamp((postT - 0.46) / 0.5, 0, 1) : 0;
        const passTravelT = simT < 0.49 ? 0 : recvT;
        trackBallX =
          finishT > 0
            ? meetX + (goalX - meetX) * finishT
            : passerFootX + (meetX - passerFootX) * passTravelT;
        trackBallY =
          finishT > 0
            ? meetY + (targetGoalY - meetY) * finishT
            : passerFootY + (meetY - passerFootY) * passTravelT;
      }
    } else if (vr.kind === 'penalty') {
      const incX = rep?.incidentX ?? (attRight ? 86 : 14);
      const incY = rep?.incidentY ?? 48;
      const boxLineX = rep?.defLineX ?? (attRight ? 83.5 : 16.5);
      const inBox = rep?.inBox ?? !vr.overturn;
      if (sc === 'handball_box') {
        const crossFromX = rep?.passFromX ?? (incX - dirSign * 9.5);
        const crossFromY = rep?.passFromY ?? clamp(incY + (incY < 50 ? 10 : -10), 14, 86);
        const hitT = clamp((simT - 0.14) / 0.35, 0, 1);
        const deflectT = postT;
        const deflX = incX - dirSign * 4.4;
        const deflY = incY + (incY < 50 ? 6.2 : -6.2);
        trackBallX = deflectT > 0 ? incX + (deflX - incX) * deflectT : crossFromX + (incX - crossFromX) * hitT;
        trackBallY = deflectT > 0 ? incY + (deflY - incY) * deflectT : crossFromY + (incY - crossFromY) * hitT;
      } else if (sc === 'gk_clash_box') {
        const attFacing = screenAngle(incX, incY, attRight ? 98 : 2, 50);
        const attXNow = incX - dirSign * (agentFxR * 0.7 + (1 - playT) * 4.8) + postT * dirSign * 1.1;
        const attYNow = incY + (1 - playT) * (incY < 50 ? -1.6 : 1.6);
        const dribbleBX = attXNow + Math.cos(attFacing) * (agentFxR * 0.72);
        const dribbleBY = attYNow + Math.sin(attFacing) * (agentFyR * 0.72);
        const clearToX = !inBox ? incX - dirSign * 4.4 : incX + dirSign * 3.8;
        const clearToY = incY + (incY < 50 ? -2.8 : 2.8);
        trackBallX = postT > 0 ? incX + (clearToX - incX) * postT : dribbleBX + (incX - dribbleBX) * playT;
        trackBallY = postT > 0 ? incY + (clearToY - incY) * postT : dribbleBY + (incY - dribbleBY) * playT;
      } else {
        const attFacing = screenAngle(incX, incY, attRight ? 96 : 4, 50);
        const attXNow = incX - dirSign * (1 - playT) * 4.4 + postT * dirSign * 0.8;
        const attYNow = incY + (1 - playT) * (incY < 50 ? -1.4 : 1.4);
        const rawBallX = attXNow + Math.cos(attFacing) * (agentFxR * 0.85 + ballFxR * 0.45);
        const preFreezeBallX = !inBox
          ? attRight
            ? Math.min(rawBallX, boxLineX - ballFxR * 1.1)
            : Math.max(rawBallX, boxLineX + ballFxR * 1.1)
          : rawBallX;
        trackBallX = preFreezeBallX + postT * dirSign * 2.1;
        trackBallY = attYNow + Math.sin(attFacing) * (agentFyR * 0.85 + ballFyR * 0.45) + postT * (incY < 50 ? 1.2 : -1.2);
      }
    } else {
      const incX = rep?.incidentX ?? vr.x;
      const incY = rep?.incidentY ?? vr.y;
      const attStartX = incX - dirSign * 4.2;
      const attStartY = clamp(incY + (incY < 50 ? -1.4 : 1.4), 6, 94);
      const attFacing = screenAngle(attStartX, attStartY, attRight ? 100 : 0, 50);
      const attXNow = attStartX + (incX - attStartX) * playT + postT * dirSign * 0.65;
      const attYNow = attStartY + (incY - attStartY) * playT;
      const isReckless = sc === 'reckless_duel';
      trackBallX = attXNow + Math.cos(attFacing) * (agentFxR * 0.85 + ballFxR * 0.45) + postT * dirSign * 2.4;
      trackBallY = attYNow + Math.sin(attFacing) * (agentFyR * 0.85 + ballFyR * 0.45) + (isReckless ? postT * 1.4 : 0);
    }
  }

  const rawCamCenterX = isFullCam
    ? 50
    : followBall
      ? trackBallX
      : startCamX + (baseCamX - startCamX) * panEase;
  const rawCamCenterY = isFullCam
    ? 50
    : followBall
      ? trackBallY
      : startCamY + (baseCamY - startCamY) * panEase;
  const halfSpanX = spanX / 2;
  const halfSpanY = spanY / 2;
  const camCenterX = isFullCam ? 50 : spanX < 107 ? clamp(rawCamCenterX, -3.5 + halfSpanX, 103.5 - halfSpanX) : 50;
  const camCenterY = isFullCam ? 50 : spanY < 105 ? clamp(rawCamCenterY, -2.5 + halfSpanY, 102.5 - halfSpanY) : 50;
  const minFX = camCenterX - halfSpanX;
  const minFY = camCenterY - halfSpanY;
  const mx = (fx: number) => scrX + ((fx - minFX) / spanX) * scrW;
  const my = (fy: number) => scrY + ((fy - minFY) / spanY) * scrH;

  // Stadium apron outside pitch bounds + clipped pitch turf & mowed bands (matching main pitch 12-band layout)
  const fullPitchX0 = mx(0);
  const fullPitchY0 = my(0);
  const fullPitchW = mx(100) - fullPitchX0;
  const fullPitchH = my(100) - fullPitchY0;
  ctx.fillStyle = '#071e12';
  ctx.fillRect(scrX, scrY, scrW, scrH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(fullPitchX0, fullPitchY0, fullPitchW, fullPitchH);
  ctx.clip();
  ctx.fillStyle = '#0f3823';
  ctx.fillRect(fullPitchX0, fullPitchY0, fullPitchW, fullPitchH);
  const stripeStep = 100 / 12;
  const firstStripeIdx = Math.max(0, Math.floor(Math.max(0, minFX) / stripeStep));
  const lastStripeIdx = Math.min(11, Math.floor((minFX + spanX) / stripeStep));
  for (let si = firstStripeIdx; si <= lastStripeIdx; si++) {
    if (si % 2 === 0) {
      const rx0 = mx(si * stripeStep);
      const rx1 = mx((si + 1) * stripeStep);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.048)';
      ctx.fillRect(rx0, fullPitchY0, rx1 - rx0, fullPitchH);
    }
  }
  ctx.restore();

  // Pitch chalk markings (exact 1:1 field coordinates with live match pitch)
  ctx.strokeStyle = 'rgba(242, 249, 242, 0.82)';
  ctx.lineWidth = isStandalone ? 1.85 : 1.3;
  ctx.strokeRect(fullPitchX0, fullPitchY0, fullPitchW, fullPitchH);

  // Halfway line & center circle
  ctx.beginPath();
  ctx.moveTo(mx(50), my(0));
  ctx.lineTo(mx(50), my(100));
  ctx.stroke();

  const centerCircleR = fullPitchH * 0.155;
  ctx.beginPath();
  ctx.arc(mx(50), my(50), centerCircleR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(242, 249, 242, 0.88)';
  ctx.beginPath();
  ctx.arc(mx(50), my(50), isStandalone ? 2.6 : 1.7, 0, Math.PI * 2);
  ctx.fill();

  const boxLineHighlight = vr.kind === 'penalty' && pct >= 0.36 && sc !== 'gk_clash_box';
  const boxHighlightClr = showVerdict ? verdictColor : '#38bdf8';
  // Right penalty box (83.5..100, y 21..79) & 6-yard box (94.5..100, y 36.5..63.5)
  ctx.save();
  if (boxLineHighlight && attRight) {
    ctx.fillStyle = showVerdict && !vr.overturn ? 'rgba(239, 68, 68, 0.09)' : 'rgba(56, 189, 248, 0.08)';
    ctx.fillRect(mx(83.5), my(21), mx(100) - mx(83.5), my(79) - my(21));
    ctx.strokeStyle = boxHighlightClr;
    ctx.lineWidth = isStandalone ? 3.2 : 2.2;
  }
  ctx.strokeRect(mx(83.5), my(21), mx(100) - mx(83.5), my(79) - my(21));
  ctx.restore();
  ctx.strokeRect(mx(94.5), my(36.5), mx(100) - mx(94.5), my(63.5) - my(36.5));

  // Left penalty box (0..16.5, y 21..79) & 6-yard box (0..5.5, y 36.5..63.5)
  ctx.save();
  if (boxLineHighlight && !attRight) {
    ctx.fillStyle = showVerdict && !vr.overturn ? 'rgba(239, 68, 68, 0.09)' : 'rgba(56, 189, 248, 0.08)';
    ctx.fillRect(mx(0), my(21), mx(16.5) - mx(0), my(79) - my(21));
    ctx.strokeStyle = boxHighlightClr;
    ctx.lineWidth = isStandalone ? 3.2 : 2.2;
  }
  ctx.strokeRect(mx(0), my(21), mx(16.5) - mx(0), my(79) - my(21));
  ctx.restore();
  ctx.strokeRect(mx(0), my(36.5), mx(5.5) - mx(0), my(63.5) - my(36.5));

  // Penalty spots (11 / 89) & D-arcs strictly outside 16.5 / 83.5 box line
  ctx.fillStyle = 'rgba(242, 249, 242, 0.9)';
  ctx.beginPath();
  ctx.arc(mx(89), my(50), isStandalone ? 2.8 : 1.8, 0, Math.PI * 2);
  ctx.arc(mx(11), my(50), isStandalone ? 2.8 : 1.8, 0, Math.PI * 2);
  ctx.fill();

  const spotToBoxDx = Math.max(4, mx(16.5) - mx(11));
  const penArcR = Math.max(spotToBoxDx * 1.44, fullPitchH * 0.145);
  const penArcAng = Math.acos(clamp(spotToBoxDx / penArcR, -0.96, 0.96));
  ctx.beginPath();
  ctx.arc(mx(11), my(50), penArcR, -penArcAng, penArcAng);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx(89), my(50), penArcR, Math.PI - penArcAng, Math.PI + penArcAng);
  ctx.stroke();

  // Corner arcs & subtle corner flag dots
  const cornerR = Math.max(4, fullPitchH * 0.032);
  [
    [mx(0), my(0), 0, Math.PI / 2],
    [mx(100), my(0), Math.PI / 2, Math.PI],
    [mx(100), my(100), Math.PI, Math.PI * 1.5],
    [mx(0), my(100), Math.PI * 1.5, Math.PI * 2]
  ].forEach(([cx, cy, sa, ea]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cornerR, sa, ea);
    ctx.stroke();
  });

  const mGoalD = Math.max(6, mx(100) - mx(97.4));
  const mGoalTop = my(42);
  const mGoalBot = my(58);
  const mGoalH = mGoalBot - mGoalTop;
  const drawVarGoalNet = (isRightGoal: boolean, rippleProg = 0, rippleY = 50, frameFlashColor?: string) => {
    const gx = isRightGoal ? mx(100) : mx(0) - mGoalD;
    const waveAmp = rippleProg > 0 && rippleProg < 1 ? Math.sin(rippleProg * Math.PI) * (isStandalone ? 4.8 : 3.0) : 0;
    const waveFreq = rippleProg * Math.PI * 6;
    const postX = isRightGoal ? mx(100) : mx(0);
    const bulgeOut = rippleProg > 0 ? Math.sin(rippleProg * Math.PI) * (isStandalone ? 4.2 : 2.5) : 0;
    const backX = isRightGoal ? gx + mGoalD + bulgeOut : gx - bulgeOut;
    const taper = isStandalone ? 2.2 : 1.4;
    ctx.save();
    ctx.fillStyle = rippleProg > 0 ? 'rgba(245, 194, 66, 0.24)' : 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(postX, mGoalTop);
    ctx.lineTo(backX, mGoalTop + taper);
    ctx.lineTo(backX, mGoalBot - taper);
    ctx.lineTo(postX, mGoalBot);
    ctx.closePath();
    ctx.fill();
    ctx.clip();

    ctx.strokeStyle = waveAmp > 0.2 ? 'rgba(255, 255, 255, 0.46)' : 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 0.75;
    const step = Math.max(3.5, mGoalD / 4);
    const impactScreenY = my(rippleY);
    const nxMin = Math.min(postX, backX);
    const nxMax = Math.max(postX, backX);
    for (let nx = nxMin; nx <= nxMax; nx += step) {
      ctx.beginPath();
      ctx.moveTo(nx, mGoalTop);
      if (waveAmp > 0) {
        const midY = clamp(impactScreenY, mGoalTop + 3, mGoalBot - 3);
        const bulge = Math.sin(waveFreq + (nx - nxMin) * 0.2) * waveAmp;
        ctx.quadraticCurveTo(nx + (isRightGoal ? Math.abs(bulge) : -Math.abs(bulge)), midY, nx, mGoalBot);
      } else {
        ctx.lineTo(nx, mGoalBot);
      }
      ctx.stroke();
    }
    for (let ny = mGoalTop; ny <= mGoalBot; ny += step) {
      ctx.beginPath();
      ctx.moveTo(nxMin, ny);
      const distFactor = Math.max(0, 1 - Math.abs(ny - impactScreenY) / Math.max(10, mGoalH * 0.6));
      const sag = waveAmp * distFactor * Math.sin(waveFreq);
      ctx.quadraticCurveTo((nxMin + nxMax) * 0.5, ny + sag, nxMax, ny);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    // Goal net outer frame & crisp front crossbar connecting both goalposts
    ctx.strokeStyle = frameFlashColor || '#ffffff';
    ctx.lineWidth = frameFlashColor ? (isStandalone ? 2.6 : 1.8) : isStandalone ? 2.1 : 1.5;
    ctx.beginPath();
    ctx.moveTo(postX, mGoalTop);
    ctx.lineTo(backX, mGoalTop + taper);
    ctx.lineTo(backX, mGoalBot - taper);
    ctx.lineTo(postX, mGoalBot);
    ctx.stroke();

    ctx.strokeStyle = frameFlashColor || 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = isStandalone ? 1.65 : 1.15;
    ctx.beginPath();
    ctx.moveTo(postX, mGoalTop);
    ctx.lineTo(postX, mGoalBot);
    ctx.stroke();

    // Exact circular goalposts anchored right on goal line (x = 0 or 100, y = 42 & 58)
    const postR = isStandalone ? 3.4 : 2.2;
    ctx.fillStyle = frameFlashColor || '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    [mGoalTop, mGoalBot].forEach((pyPost) => {
      ctx.beginPath();
      ctx.arc(postX, pyPost, postR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  };

  const drawVarTurfTrack = (
    sx0: number,
    sy0: number,
    sx1: number,
    sy1: number,
    isActivelySliding: boolean,
    phaseVal: number,
    sprayColor = 'rgba(74, 222, 128, 0.78)'
  ) => {
    const dx = sx1 - sx0;
    const dy = sy1 - sy0;
    const len = Math.hypot(dx, dy);
    if (len < 1.8) return;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const trackOff = isStandalone ? 2.1 : 1.35;

    ctx.save();
    // Soft turf scuff swath beneath parallel cleat grooves
    ctx.strokeStyle = 'rgba(12, 32, 18, 0.36)';
    ctx.lineWidth = isStandalone ? 6.4 : 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx1, sy1);
    ctx.stroke();

    // Parallel soil cleat gouge tracks perpendicular to slide direction
    ctx.strokeStyle = 'rgba(22, 42, 20, 0.78)';
    ctx.lineWidth = isStandalone ? 2.1 : 1.35;
    ctx.beginPath();
    ctx.moveTo(sx0 + px * trackOff, sy0 + py * trackOff);
    ctx.lineTo(sx1 + px * trackOff, sy1 + py * trackOff);
    ctx.moveTo(sx0 - px * trackOff, sy0 - py * trackOff);
    ctx.lineTo(sx1 - px * trackOff, sy1 - py * trackOff);
    ctx.stroke();

    // Flying grass blades / turf divots right behind the cleats while actively sliding
    if (isActivelySliding) {
      const angBase = Math.atan2(-dy, -dx);
      for (let k = 0; k < 5; k++) {
        const a = angBase + (k - 2) * 0.36;
        const dist = (isStandalone ? 3.5 : 2.2) + ((phaseVal * 26 + k * 2.1) % (isStandalone ? 10 : 6.5));
        ctx.fillStyle = k % 2 === 0 ? sprayColor : 'rgba(133, 94, 52, 0.88)';
        ctx.beginPath();
        ctx.arc(sx1 + Math.cos(a) * dist, sy1 + Math.sin(a) * dist, isStandalone ? 1.45 : 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  const drawVarSoccerBall = (
    fx: number,
    fy: number,
    spinPhase: number,
    opts?: {
      z?: number;
      radiusScale?: number;
      glowColor?: string;
      trailPts?: { x: number; y: number; z?: number }[];
      trailColor?: string;
    }
  ) => {
    const zVal = opts?.z ?? 0;
    const ballR = baseBallPixR * (1 + clamp(zVal / 26, 0, 0.45)) * (opts?.radiusScale ?? 1);
    const bx = mx(fx);
    const byGround = my(fy);
    const drawBy = byGround - zVal * (isStandalone ? 1.05 : 0.72);

    // Motion / shot comet trail
    if (opts?.trailPts && opts.trailPts.length >= 2) {
      ctx.save();
      ctx.lineCap = 'round';
      const nPts = opts.trailPts.length;
      for (let ti = 1; ti < nPts; ti++) {
        const p0 = opts.trailPts[ti - 1];
        const p1 = opts.trailPts[ti];
        const ratio = ti / nPts;
        ctx.strokeStyle = opts.trailColor || 'rgba(250, 204, 21, 0.55)';
        ctx.globalAlpha = ratio * 0.68;
        ctx.lineWidth = Math.max(1.2, ballR * 1.35 * ratio);
        ctx.beginPath();
        ctx.moveTo(mx(p0.x), my(p0.y) - (p0.z || 0) * (isStandalone ? 1.05 : 0.72));
        ctx.lineTo(mx(p1.x), my(p1.y) - (p1.z || 0) * (isStandalone ? 1.05 : 0.72));
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3D ground shadow
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${clamp(0.45 - zVal * 0.015, 0.14, 0.45)})`;
    ctx.beginPath();
    ctx.ellipse(
      bx + zVal * 0.25,
      byGround + ballR * 0.45 + zVal * 0.22,
      ballR * 0.96,
      ballR * 0.44,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(bx, drawBy);

    // Optional focus halo around ball
    if (opts?.glowColor) {
      ctx.save();
      ctx.fillStyle = opts.glowColor;
      ctx.globalAlpha = 0.28 + (isFreezePhase ? 0.14 : 0);
      ctx.beginPath();
      ctx.arc(0, 0, ballR * 1.78, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Clipped 3D spherical ball + spinning pentagon patches
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, ballR, 0, Math.PI * 2);
    ctx.clip();

    const ballSprite = getBallSphereSprite(ballR);
    if (ballSprite) {
      const spriteHalf = Math.max(4, Math.round(ballR * 4)) / 4 + 1;
      ctx.drawImage(ballSprite, -spriteHalf, -spriteHalf, spriteHalf * 2, spriteHalf * 2);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-ballR - 1, -ballR - 1, ballR * 2 + 2, ballR * 2 + 2);
    }

    const coreOffX = Math.cos(spinPhase * 0.65) * ballR * 0.14;
    const coreOffY = Math.sin(spinPhase * 0.55) * ballR * 0.14;
    const pentR = ballR * 0.37;

    ctx.save();
    ctx.translate(coreOffX, coreOffY);
    ctx.rotate(spinPhase);

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.68)';
    ctx.lineWidth = Math.max(0.75, ballR * 0.11);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const vx = Math.cos(a) * pentR;
      const vy = Math.sin(a) * pentR;
      const ox = Math.cos(a) * (ballR * 1.05);
      const oy = Math.sin(a) * (ballR * 1.05);
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(ox, oy);
      ctx.stroke();

      const pxOut = Math.cos(a) * (ballR * 0.96);
      const pyOut = Math.sin(a) * (ballR * 0.96);
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(pxOut, pyOut, ballR * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const pxV = Math.cos(a) * pentR;
      const pyV = Math.sin(a) * pentR;
      if (i === 0) ctx.moveTo(pxV, pyV);
      else ctx.lineTo(pxV, pyV);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.76)';
    ctx.beginPath();
    ctx.ellipse(-ballR * 0.34, -ballR * 0.36, ballR * 0.25, ballR * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Crisp outer rim
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = isStandalone ? 1.3 : 1.05;
    ctx.beginPath();
    ctx.arc(0, 0, ballR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  type VarAgentAction = 'run' | 'kick' | 'gk_ready' | 'gk_dive' | 'slide' | 'clash' | 'handball' | 'fall' | 'leap';

  const drawVarImpactBurst = (
    fx: number,
    fy: number,
    color: string,
    burstT: number,
    ringRadius?: number
  ) => {
    if (burstT <= 0 || burstT >= 1) return;
    const cxB = mx(fx);
    const cyB = my(fy);
    const alpha = Math.max(0, 1 - burstT);
    const baseR = ringRadius ?? (isStandalone ? 18 : 11);
    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    ctx.strokeStyle = color;
    ctx.lineWidth = (isStandalone ? 2.2 : 1.5) * (0.5 + 0.5 * alpha);
    ctx.beginPath();
    ctx.arc(cxB, cyB, baseR * (0.45 + burstT * 0.95), 0, Math.PI * 2);
    ctx.stroke();

    const sparkCount = 8;
    for (let i = 0; i < sparkCount; i++) {
      const ang = (i * Math.PI * 2) / sparkCount + 0.25;
      const dist = baseR * (0.35 + burstT * 1.15);
      const sx = cxB + Math.cos(ang) * dist;
      const sy = cyB + Math.sin(ang) * dist;
      ctx.fillStyle = i % 2 === 0 ? color : '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, (isStandalone ? 2.0 : 1.35) * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawMiniAgent = (
    fx: number,
    fy: number,
    kit: string,
    trim: string,
    no: number,
    shortName: string,
    vis?: number[],
    ringColor?: string,
    labelColor = '#f8fafc',
    opts?: {
      role?: string;
      facing?: number;
      stride?: number;
      action?: VarAgentAction;
      actionProg?: number;
      diveDir?: number;
      isGk?: boolean;
      handDir?: number;
      dimmed?: boolean;
    }
  ) => {
    const x = mx(fx);
    const y = my(fy);
    const scaleDim = (opts?.dimmed ? 0.88 : 1) * modeSizeScale;
    const r = (isStandalone ? clamp(scrH * 0.072, 8.2, 12.6) : clamp(scrH * 0.074, 5.2, 7.4)) * scaleDim;
    const facing = opts?.facing ?? (attRight ? 0 : Math.PI);
    const cosF = Math.cos(facing);
    const sinF = Math.sin(facing);
    const perpX = -sinF;
    const perpY = cosF;
    const action = opts?.action ?? 'run';
    const prog = clamp(opts?.actionProg ?? 0, 0, 1);
    const arcEnv = Math.sin(prog * Math.PI);
    const strideVal = opts?.stride ?? 0;
    const isMoving = action === 'run' || action === 'gk_ready';
    const strideSin = isMoving ? Math.sin(strideVal) : 0;

    ctx.save();
    if (opts?.dimmed) ctx.globalAlpha = 0.86;
    ctx.translate(x, y);

    // 1. Ground shadow (shrinks on aerial leap)
    const leapArc = action === 'leap' ? arcEnv : 0;
    const shScale = 1 - 0.26 * leapArc;
    ctx.fillStyle = `rgba(0,0,0,${(0.45 - 0.14 * leapArc).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(0, r * (0.86 + 0.14 * leapArc), r * 0.9 * shScale, r * 0.35 * shScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Sprint turf wake specks
    if (action === 'run' && strideVal > 0.2 && !isFreezePhase) {
      const dustPhase = (strideVal * 0.35) % 1;
      const d1 = r * (0.85 + dustPhase * 0.65);
      const d2 = r * (1.18 + ((dustPhase + 0.5) % 1) * 0.5);
      ctx.fillStyle = 'rgba(220, 252, 231, 0.38)';
      ctx.beginPath();
      ctx.arc(-cosF * d1 + sinF * 1.8, -sinF * d1 - cosF * 1.8 + r * 0.35, isStandalone ? 1.5 : 1.05, 0, Math.PI * 2);
      ctx.arc(-cosF * d2 - sinF * 1.8, -sinF * d2 + cosF * 1.8 + r * 0.35, isStandalone ? 1.2 : 0.85, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Action-specific body transforms & live-match FX arcs
    if (action === 'gk_dive') {
      const diveDir = opts?.diveDir ?? 1;
      const diveShift = diveDir * arcEnv * r * 0.78;
      ctx.translate(0, diveShift);
      ctx.rotate(diveDir * arcEnv * 0.82);
      // Cyan & gold supersave motion trail
      ctx.strokeStyle = `rgba(56, 189, 248, ${(0.88 * (0.4 + 0.6 * arcEnv)).toFixed(2)})`;
      ctx.lineWidth = isStandalone ? 2.4 : 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r + (isStandalone ? 5 : 3) + prog * 4, 0, Math.PI * 2);
      ctx.stroke();
      // Both extended diving gloves
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = isStandalone ? 1.2 : 0.9;
      ctx.beginPath();
      ctx.arc(cosF * r * 0.35, diveDir * (r * 1.18), r * 0.36, 0, Math.PI * 2);
      ctx.arc(-cosF * r * 0.15, diveDir * (r * 0.92), r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (action === 'kick') {
      const kickPhase = prog < 0.25 ? -(prog / 0.25) : Math.sin(((prog - 0.25) / 0.75) * Math.PI);
      const pushDist = kickPhase * r * 0.48;
      ctx.translate(cosF * pushDist, sinF * pushDist);
      ctx.rotate(0.24 * kickPhase);
      if (prog > 0.1) {
        ctx.strokeStyle = `rgba(251, 146, 60, ${(0.95 * (1 - prog * 0.5)).toFixed(2)})`;
        ctx.lineWidth = isStandalone ? 2.4 : 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r + (isStandalone ? 4.5 : 3) + Math.max(0, kickPhase) * 4, facing - 0.85, facing + 0.85);
        ctx.stroke();
      }
    } else if (action === 'slide') {
      const slideExtend = Math.sin(clamp(prog * 2, 0, 1) * (Math.PI / 2));
      const slidePush = slideExtend * r * 0.76;
      ctx.translate(cosF * slidePush, sinF * slidePush);
      ctx.rotate((sinF >= 0 ? 0.62 : -0.62) * arcEnv);
      ctx.strokeStyle = `rgba(56, 189, 248, ${(0.9 * (1 - prog * 0.4)).toFixed(2)})`;
      ctx.lineWidth = isStandalone ? 2.4 : 1.6;
      ctx.beginPath();
      ctx.moveTo(-cosF * r * 1.4, -sinF * r * 1.4);
      ctx.lineTo(cosF * r * 1.05, sinF * r * 1.05);
      ctx.stroke();
    } else if (action === 'clash') {
      const recoil = Math.sin(prog * Math.PI * 2) * (isStandalone ? 2.6 : 1.7);
      ctx.translate(cosF * recoil, sinF * recoil);
      ctx.strokeStyle = `rgba(251, 146, 60, ${(0.92 * (1 - prog * 0.5)).toFixed(2)})`;
      ctx.lineWidth = isStandalone ? 2.2 : 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + (isStandalone ? 4.2 : 2.8) + prog * 3.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (action === 'fall') {
      const fallEase = clamp(prog * 1.35, 0, 1);
      ctx.translate(cosF * r * 0.46 * fallEase, r * 0.36 * fallEase);
      ctx.rotate(1.12 * fallEase);
      ctx.strokeStyle = `rgba(248, 113, 113, ${(0.85 * (1 - prog * 0.65)).toFixed(2)})`;
      ctx.lineWidth = isStandalone ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.25, r + (isStandalone ? 4.5 : 3) + prog * 4, r * 0.55 + prog * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (action === 'leap') {
      const leapY = -r * 0.85 * arcEnv;
      const leapScale = 1 + 0.16 * arcEnv;
      ctx.translate(cosF * r * 0.3 * arcEnv, leapY);
      ctx.scale(leapScale, leapScale);
      ctx.strokeStyle = `rgba(253, 224, 71, ${(0.9 * (1 - prog * 0.45)).toFixed(2)})`;
      ctx.lineWidth = isStandalone ? 2.1 : 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, r + (isStandalone ? 4.2 : 2.8) + prog * 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Animated cleated boots along facing direction
    if (action !== 'gk_dive') {
      const kickSwing =
        action === 'kick'
          ? (prog < 0.25 ? -0.45 : Math.sin(((prog - 0.25) / 0.75) * Math.PI) * 1.1) * (r * 0.88)
          : strideSin * (r * 0.55);
      const backSwing = action === 'kick' ? -r * 0.26 : -kickSwing;
      const bLen = r * (action === 'kick' ? 0.36 : 0.31);
      const bWid = r * 0.19;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.ellipse(perpX * r * 0.38 + cosF * kickSwing, perpY * r * 0.38 + sinF * kickSwing + r * 0.34, bLen, bWid, facing, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-perpX * r * 0.38 + cosF * backSwing, -perpY * r * 0.38 + sinF * backSwing + r * 0.34, bLen * 0.94, bWid, facing, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Running bob & subtle shoulder sway
    const bobY = action === 'run' && !isFreezePhase ? -Math.abs(strideSin) * (isStandalone ? 1.5 : 1.0) : 0;
    ctx.translate(0, bobY);
    if (action === 'run' && !isFreezePhase) {
      ctx.rotate(strideSin * 0.07);
    }

    // 5. Outstretched handball arm OR GK ready-stance padded gloves
    if (action === 'handball') {
      const hDir = opts?.handDir ?? -1;
      const armAng = facing + hDir * (0.95 + 0.3 * arcEnv);
      const armLen = r * (1.32 + 0.24 * arcEnv);
      ctx.strokeStyle = kit;
      ctx.lineWidth = isStandalone ? 2.8 : 1.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(armAng) * armLen, Math.sin(armAng) * armLen);
      ctx.stroke();
      ctx.fillStyle = '#f1c27d';
      ctx.strokeStyle = prog > 0.32 ? '#ef4444' : 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(Math.cos(armAng) * armLen, Math.sin(armAng) * armLen, isStandalone ? 2.5 : 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (opts?.isGk && action !== 'gk_dive') {
      const gFwd = r * 0.72;
      const gSpread = r * 0.66;
      const readyBob = Math.sin(strideVal * 1.4) * (r * 0.08);
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = isStandalone ? 1.0 : 0.75;
      ctx.beginPath();
      ctx.arc(cosF * gFwd + perpX * gSpread, sinF * gFwd + perpY * gSpread + readyBob, r * 0.25, 0, Math.PI * 2);
      ctx.arc(cosF * gFwd - perpX * gSpread, sinF * gFwd - perpY * gSpread - readyBob, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 6. Jersey body + portrait face
    ctx.fillStyle = kit;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    const faceC = vis ? getPitchFaceCanvas(vis, kit, trim) : null;
    if (faceC) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, r - 0.6), 0, Math.PI * 2);
      ctx.clip();
      const fw = r * 2.1;
      const fh = (fw * 68) / 64;
      ctx.drawImage(faceC, -fw / 2, -fh * 0.45, fw, fh);
      ctx.restore();
    } else {
      ctx.fillStyle = colDist(kit, '#ffffff') < 110 ? '#111827' : '#ffffff';
      ctx.font = `800 ${Math.round(r * 1.05)}px Sarabun, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(no), 0, 0.3);
    }

    ctx.strokeStyle = ringColor || '#ffffff';
    ctx.lineWidth = ringColor ? (isStandalone ? 2.4 : 1.8) : isStandalone ? 1.5 : 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // Crisp position role micro-badge above each player in VAR (matching live match pitch)
    const roleStr = opts?.role || (opts?.isGk ? 'GK' : '');
    if (roleStr) {
      ctx.save();
      if (opts?.dimmed) ctx.globalAlpha = 0.88;
      const posPal = getPositionCanvasPalette(roleStr);
      const roleFont = isStandalone ? Math.max(7.2, Math.round(r * 0.62)) : smallText ? 5.2 : 6.0;
      ctx.font = `800 ${roleFont}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const rw = Math.max(isStandalone ? 16.5 : 12, measureTextCached(ctx, roleStr) + (isStandalone ? 5.5 : 3.8));
      const rh = isStandalone ? Math.max(9.2, roleFont + 3) : smallText ? 7.0 : 8.0;
      const leapLift = action === 'leap' ? r * 0.65 * arcEnv : 0;
      const diveShiftY = action === 'gk_dive' ? (opts?.diveDir ?? 1) * arcEnv * r * 0.78 : 0;
      const ry = y - r - rh - 1.5 - leapLift + diveShiftY;
      ctx.fillStyle = posPal.bg;
      ctx.strokeStyle = posPal.stroke;
      ctx.lineWidth = isStandalone ? 1.0 : 0.85;
      ctx.beginPath();
      ctx.roundRect(x - rw / 2, ry, rw, rh, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = posPal.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(roleStr, x, ry + rh / 2);
      ctx.restore();
    }

    if (shortName) {
      ctx.save();
      const fSize = isStandalone ? 10 : smallText ? 7.0 : 7.8;
      const pillH = isStandalone ? 13 : 9.5;
      ctx.font = `700 ${fSize}px "Noto Sans Thai", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(6, 12, 22, 0.84)';
      const lbl = `#${no} ${shortName}`;
      const lw = measureTextCached(ctx, lbl) + (isStandalone ? 9 : 6);
      ctx.beginPath();
      ctx.roundRect(x - lw / 2, y + r + 2, lw, pillH, 3);
      ctx.fill();
      ctx.fillStyle = labelColor;
      ctx.fillText(lbl, x, y + r + 2 + pillH / 2 + 0.3);
      ctx.restore();
    }
  };

  // Referee agent jogging in, touching VAR earpiece during freeze, and signaling call/card at >=0.72
  const drawVarReferee = (fx: number, fy: number, targetX: number, targetY: number) => {
    const rx = mx(fx);
    const ry = my(fy);
    const rr = (isStandalone ? clamp(scrH * 0.062, 7.2, 10.6) : clamp(scrH * 0.064, 4.6, 6.4)) * modeSizeScale;
    const ang = screenAngle(fx, fy, targetX, targetY);
    const walkSin = !isFreezePhase && pct < 0.72 ? Math.sin(simT * 20) : 0;

    ctx.save();
    ctx.translate(rx, ry);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(0, rr * 0.86, rr * 0.88, rr * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boots
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(Math.cos(ang) * walkSin * rr * 0.45, rr * 0.48, rr * 0.28, rr * 0.16, ang, 0, Math.PI * 2);
    ctx.fill();

    // Referee black/gold striped shirt
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = isStandalone ? 1.6 : 1.1;
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = `900 ${Math.max(6, Math.round(rr * 0.85))}px Sarabun, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', 0, 0.4);

    // Gesture overlays
    if (isFreezePhase) {
      // Hand to VAR headset + pulse wave
      const earPulse = 0.5 + 0.5 * Math.sin(pct * 40);
      ctx.strokeStyle = `rgba(56, 189, 248, ${(0.7 + 0.3 * earPulse).toFixed(2)})`;
      ctx.lineWidth = isStandalone ? 1.5 : 1.1;
      ctx.beginPath();
      ctx.arc(rr * 0.75, -rr * 0.35, rr * (0.45 + earPulse * 0.25), -0.9, 0.9);
      ctx.stroke();
    } else if (showVerdict) {
      if (vr.kind === 'foul_card' || (vr.kind === 'penalty' && !vr.overturn)) {
        // Raised Yellow or Red Card
        const cardClr =
          vr.kind === 'foul_card'
            ? vr.pendingCardUpgrade === 'R'
              ? '#ef4444'
              : '#facc15'
            : '#facc15';
        const cw = rr * 0.78;
        const ch = rr * 1.12;
        ctx.fillStyle = cardClr;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.roundRect(rr * 0.48, -rr * 1.45, cw, ch, 1.5);
        ctx.fill();
        ctx.stroke();
      } else {
        // VAR TV rectangle / signal badge
        ctx.strokeStyle = verdictColor;
        ctx.lineWidth = isStandalone ? 1.5 : 1.1;
        ctx.fillStyle = 'rgba(8, 15, 28, 0.9)';
        ctx.beginPath();
        ctx.roundRect(-rr * 0.75, -rr * 1.85, rr * 1.5, rr * 0.9, 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const drawTopPillBadge = (label: string, fgColor: string, cx?: number, borderColor?: string) => {
    ctx.save();
    ctx.font = `800 ${isStandalone ? 10.5 : smallText ? 7.2 : 8.0}px "Noto Sans Thai", sans-serif`;
    const bw = measureTextCached(ctx, label) + (isStandalone ? 14 : 9);
    const bh = isStandalone ? 18 : 12.5;
    const xPos = clamp(cx ?? scrX + scrW / 2, scrX + bw / 2 + 5, scrX + scrW - bw / 2 - 5);
    ctx.fillStyle = 'rgba(8, 15, 28, 0.9)';
    ctx.beginPath();
    ctx.roundRect(xPos - bw / 2, scrY + 6, bw, bh, 4);
    ctx.fill();
    if (borderColor) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    ctx.fillStyle = fgColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, xPos, scrY + 6 + bh / 2 + 0.3);
    ctx.restore();
  };

  // Decisive moment hits at simT = 0.49 (locked during pct 0.36..0.64!)
  // (playT, postT, dirSign, agentPixR, ballFxR computed earlier for follow-ball tracking)

  // In wide camera mode, draw opposite goal frame if it happens to enter view
  const drawVisibleOtherGoal = () => {
    const oppGoalX = attRight ? 0 : 100;
    if (oppGoalX >= minFX - 4 && oppGoalX <= minFX + spanX + 4) {
      drawVarGoalNet(!attRight, 0, 50);
    }
  };

  if (vr.kind === 'goal') {
    if (sc === 'goal_line_tech') {
      // GOAL-LINE TECHNOLOGY SCENARIO (Kick -> Flight -> Freeze on exact goal-line plane -> Ripple net or GK Push-away Save!)
      const goalLineX = attRight ? 100 : 0;
      const incY = clamp(rep?.shotTargetY ?? rep?.incidentY ?? 50, 43.4, 56.6);
      const startX = attRight ? clamp(rep?.passFromX ?? 90.5, 78, 95.5) : clamp(rep?.passFromX ?? 9.5, 4.5, 22);
      const startY = clamp(rep?.passFromY ?? (incY + (incY < 50 ? 2.5 : -2.5)), 34, 66);
      const mm = rep?.goalLineMm ?? 24;
      // Calibrate ball center against IFAB 110mm radius so main zoom & Hawkeye inset agree 1:1
      const overlapFrac = clamp(mm / 110, 0.14, 0.78);
      const apexX = vr.overturn
        ? goalLineX + dirSign * ballFxR * (1 - overlapFrac)
        : goalLineX + dirSign * ballFxR * (1 + overlapFrac);
      const clearX = attRight ? 96.4 : 3.6;
      const netSettleX = attRight ? 101.8 : -1.8;

      const ballPhase = clamp((simT - 0.12) / 0.37, 0, 1);
      const easeBall = 1 - Math.pow(1 - ballPhase, 1.85);
      const bxNow =
        postT > 0
          ? vr.overturn
            ? apexX + (clearX - apexX) * postT
            : apexX + (netSettleX - apexX) * clamp(postT * 1.35, 0, 1)
          : startX + (apexX - startX) * easeBall;
      const byNow = startY + (incY - startY) * easeBall + (vr.overturn ? postT * (incY < 50 ? 2.4 : -2.4) : 0);
      const bzNow = Math.sin(easeBall * Math.PI) * 3.8 + (vr.overturn ? postT * 1.6 : (1 - postT) * 0.9);

      // Draw goal net with live ripple when ball hits back of net
      const netRipple = !vr.overturn && postT > 0 ? clamp(postT * 1.35, 0, 1) : 0;
      const postFlash = pct >= 0.36 ? (vr.overturn ? '#ef4444' : '#22c55e') : undefined;
      drawVarGoalNet(attRight, netRipple, incY, postFlash);

      const gkStartX = rep?.gkX != null ? clamp(rep.gkX, attRight ? 94 : 1.5, attRight ? 98.5 : 6) : attRight ? 97.8 : 2.2;
      const gkStartY = rep?.gkY != null ? clamp(rep.gkY, 43.2, 56.8) : incY < 50 ? 54.5 : 45.5;
      const gkMoveT = clamp((simT - 0.14) / 0.35, 0, 1);
      const gkEaseT = 1 - Math.pow(1 - gkMoveT, 1.75);
      const gkDiveDir = incY >= gkStartY ? 1 : -1;
      // Compensate for drawMiniAgent's dive vertical shift so GK gloves meet (apexX, incY) at freeze (simT=0.49)
      const gkActionProg = simT < 0.49 ? clamp((simT - 0.14) / 0.7, 0, 0.5) : 0.5 + postT * 0.5;
      const gkArcNow = Math.sin(gkActionProg * Math.PI);
      const gkTargetX = attRight ? clamp(apexX - 0.8, 96.5, 99.3) : clamp(apexX + 0.8, 0.7, 3.5);
      const gkTargetY = incY - gkDiveDir * gkArcNow * agentFyR * 1.1;
      const gkX = gkStartX + (gkTargetX - gkStartX) * gkEaseT;
      const gkY = gkStartY + (gkTargetY - gkStartY) * gkEaseT;

      const attFacing = screenAngle(startX, startY, apexX, incY);
      const attKickApproach = clamp(simT / 0.14, 0, 1);
      const attXNow = clamp(
        startX - Math.cos(attFacing) * (agentFxR * 0.75 + (1 - attKickApproach) * 2.4) + postT * dirSign * 0.45,
        4,
        96
      );
      const attYNow = clamp(startY - Math.sin(attFacing) * (agentFyR * 0.75 + (1 - attKickApproach) * 1.1), 8, 92);

      // Glowing Goal-Line Laser Plane strictly across the goalmouth between the two goalposts (mGoalTop..mGoalBot)
      const glScreenX = mx(goalLineX);
      ctx.save();
      ctx.strokeStyle = pct >= 0.36 ? (vr.overturn ? '#ef4444' : '#22c55e') : '#38bdf8';
      ctx.lineWidth = isStandalone ? 2.8 : 2.0;
      ctx.beginPath();
      ctx.moveTo(glScreenX, mGoalTop);
      ctx.lineTo(glScreenX, mGoalBot);
      ctx.stroke();

      // Dashed shot trajectory from shooter toward goal line
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = isStandalone ? 1.5 : 1.05;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mx(startX), my(startY));
      ctx.lineTo(mx(apexX), my(incY));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      const trailPts =
        ballPhase > 0.04
          ? Array.from({ length: 6 }, (_, i) => {
              const t = Math.max(0, easeBall - (5 - i) * 0.06);
              return {
                x: startX + (apexX - startX) * t,
                y: startY + (incY - startY) * t,
                z: Math.sin(t * Math.PI) * 3.8
              };
            })
          : undefined;
      drawMiniAgent(
        attXNow,
        attYNow,
        attKit,
        attTrim,
        rep?.attNo ?? 9,
        rep?.attShort || vr.shooterShort || 'ผู้ยิง',
        rep?.attVis,
        '#facc15',
        '#fde047',
        {
          role: rep?.attRole || 'ST',
          facing: attFacing,
          stride: simT * 15,
          action: simT <= 0.28 ? 'kick' : 'run',
          actionProg: clamp(simT / 0.28, 0, 1)
        }
      );
      drawMiniAgent(
        gkX,
        gkY,
        defGkKit,
        '#ffffff',
        rep?.gkNo ?? 1,
        'GK',
        rep?.gkVis,
        pct >= 0.36 ? '#38bdf8' : undefined,
        '#bae6fd',
        {
          role: rep?.gkRole || 'GK',
          facing: attRight ? Math.PI : 0,
          stride: simT * 16,
          isGk: true,
          action: simT >= 0.14 ? 'gk_dive' : 'gk_ready',
          actionProg: gkActionProg,
          diveDir: gkDiveDir
        }
      );

      if (vr.overturn && postT > 0) {
        drawVarImpactBurst(apexX, incY, '#38bdf8', clamp(postT * 1.4, 0, 1));
      }

      drawVarSoccerBall(bxNow, byNow, simT * 16, {
        z: bzNow,
        trailPts: postT < 0.35 ? trailPts : undefined,
        trailColor: 'rgba(56, 189, 248, 0.55)',
        glowColor: pct >= 0.36 ? (vr.overturn ? '#ef4444' : '#22c55e') : '#38bdf8'
      });

      if (pct >= 0.36) {
        const badgeTxt = vr.overturn ? `โกล์ไลน์: ยังไม่เต็มใบ (-${mm} มม.)` : `โกล์ไลน์: ข้ามเต็มใบ (+${mm} มม.)`;
        drawTopPillBadge(badgeTxt, vr.overturn ? '#fca5a5' : '#86efac', undefined, vr.overturn ? '#ef4444' : '#22c55e');

        const boxW = isStandalone ? 86 : 56;
        const boxH = isStandalone ? 42 : 28;
        const boxX = attRight ? scrX + 8 : scrX + scrW - boxW - 8;
        const boxY = scrY + (isStandalone ? 30 : 21);
        ctx.save();
        ctx.fillStyle = 'rgba(6, 14, 28, 0.92)';
        ctx.strokeStyle = vr.overturn ? '#ef4444' : '#22c55e';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        const lineX = boxX + boxW * 0.5;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(lineX - 1.5, boxY + 5, 3, boxH - 10);
        const ballProjR = isStandalone ? 9 : 6;
        const offsetPx = vr.overturn
          ? dirSign * (ballProjR * (1 - overlapFrac))
          : dirSign * (ballProjR * (1 + overlapFrac));
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = vr.overturn ? '#ef4444' : '#22c55e';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(lineX + offsetPx, boxY + boxH / 2, ballProjR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (sc === 'foul_buildup') {
      // BUILDUP FOUL / HANDBALL BEFORE GOAL SCENARIO
      const incX = rep?.incidentX ?? (attRight ? 80 : 20);
      const incY = rep?.incidentY ?? 48;
      const goalX = attRight ? 101.4 : -1.4;
      const goalY = clamp(rep?.shotTargetY ?? 50, 43.8, 56.2);
      const defSideSign = rep?.defY != null ? (rep.defY < incY ? -1 : 1) : incY < 50 ? 1 : -1;

      const attShotFacing = screenAngle(incX, incY, goalX, goalY);
      const stepT = clamp(postT / 0.35, 0, 1);
      const attXNow = incX - dirSign * (1 - playT) * 4.5 + stepT * dirSign * 1.15;
      const attYNow = incY + (1 - playT) * 1.5 + stepT * (goalY - incY) * 0.04;
      const rawDefStartX = rep?.defX != null ? clamp(rep.defX, 2, 98) : incX + dirSign * 2.4;
      const rawDefStartY = clamp(rep?.defY ?? (incY + defSideSign * 5.2), 8, 92);
      const sepBuildup = Math.hypot(rawDefStartX - incX, rawDefStartY - incY);
      const defStartX = rawDefStartX;
      const defStartY = sepBuildup < 3.0 ? clamp(incY + defSideSign * 5.2, 8, 92) : rawDefStartY;
      const defContactX = incX + dirSign * (agentFxR * 0.55);
      const defContactY = incY + defSideSign * (agentFyR * 1.05);
      const defXNow = defStartX + (defContactX - defStartX) * playT;
      const defYNow = defStartY + (defContactY - defStartY) * playT;
      const gkDiveT = clamp((simT - 0.62) / 0.32, 0, 1);
      const gkStartX = rep?.gkX != null ? clamp(rep.gkX, attRight ? 94 : 1.5, attRight ? 98.5 : 6) : attRight ? 97.6 : 2.4;
      const gkBaseY = rep?.gkY != null ? clamp(rep.gkY, 43, 57) : clamp(50 + (incY - 50) * 0.25, 43.5, 56.5);
      const gkY = gkBaseY + (goalY - gkBaseY) * gkDiveT;
      const gkDiveDir = goalY >= gkBaseY ? 1 : -1;

      const shotProg = clamp((postT - 0.14) / 0.86, 0, 1);
      const netRipple = shotProg > 0.68 ? clamp((shotProg - 0.68) / 0.32, 0, 1) : 0;
      drawVarGoalNet(attRight, netRipple, goalY);

      const defFacing = screenAngle(defXNow, defYNow, attXNow, attYNow);
      if (simT >= 0.2) {
        const defSlideStartX = defStartX + (defContactX - defStartX) * slideStartPlayT;
        const defSlideStartY = defStartY + (defContactY - defStartY) * slideStartPlayT;
        const slidePushPx = slideExtendNow * agentPixR * 0.76;
        drawVarTurfTrack(
          mx(defSlideStartX),
          my(defSlideStartY) + agentPixR * 0.34,
          mx(defXNow) + Math.cos(defFacing) * slidePushPx,
          my(defYNow) + Math.sin(defFacing) * slidePushPx + agentPixR * 0.34,
          !isFreezePhase && simT < 0.51,
          simT
        );
      }

      const shootOriginX = incX + dirSign * 1.25;
      const shootOriginY = incY + (goalY - incY) * 0.04;

      // Shot path from buildup duel toward goal (visible from freeze onwards)
      if (pct >= 0.36) {
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = isStandalone ? 1.7 : 1.1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(mx(shootOriginX), my(shootOriginY));
        ctx.lineTo(mx(goalX), my(goalY));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (pct >= 0.36) {
        const ringClr = vr.overturn ? '#ef4444' : '#22c55e';
        ctx.save();
        ctx.fillStyle = vr.overturn ? 'rgba(239, 68, 68, 0.16)' : 'rgba(34, 197, 94, 0.14)';
        ctx.strokeStyle = ringClr;
        ctx.lineWidth = isStandalone ? 2.2 : 1.6;
        ctx.beginPath();
        ctx.arc(mx(incX), my(incY), (isStandalone ? 18 : 12) + Math.sin(pct * Math.PI * 10) * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        drawVarImpactBurst(incX, incY, ringClr, clamp((pct - 0.36) / 0.32, 0, 1));
        drawTopPillBadge(
          vr.overturn ? 'เช็กการปะทะก่อนยิง: ฟาวล์!' : 'เช็กการปะทะก่อนยิง: ปกติ',
          vr.overturn ? '#fca5a5' : '#86efac',
          undefined,
          ringClr
        );
      }

      const refX = incX - dirSign * (8.5 - playT * 2.5);
      const refY = clamp(incY + (incY < 50 ? 8.2 : -8.2), 14, 86);

      drawMiniAgent(gkStartX, gkY, defGkKit, '#ffffff', rep?.gkNo ?? 1, '', rep?.gkVis, undefined, '#bae6fd', {
        role: rep?.gkRole || 'GK',
        facing: attRight ? Math.PI : 0,
        stride: simT * 14,
        isGk: true,
        action: simT >= 0.62 ? 'gk_dive' : 'gk_ready',
        actionProg: gkDiveT,
        diveDir: gkDiveDir
      });
      drawVarReferee(refX, refY, incX, incY);
      drawMiniAgent(
        defXNow,
        defYNow,
        defKit,
        defTrim,
        rep?.defNo ?? 4,
        rep?.defShort || 'กองหลัง',
        rep?.defVis,
        pct >= 0.36 ? '#f59e0b' : undefined,
        '#fde68a',
        {
          role: rep?.defRole || 'CB',
          facing: defFacing,
          stride: simT * 14,
          action: simT >= 0.2 && simT <= 0.78 ? 'slide' : 'run',
          actionProg: slideActionProg
        }
      );
      drawMiniAgent(
        attXNow,
        attYNow,
        attKit,
        attTrim,
        rep?.attNo ?? 9,
        rep?.attShort || vr.shooterShort || 'ผู้ยิง',
        rep?.attVis,
        pct >= 0.36 ? (vr.overturn ? '#ef4444' : '#22c55e') : '#facc15',
        pct >= 0.36 ? (vr.overturn ? '#fca5a5' : '#86efac') : '#fde047',
        {
          role: rep?.attRole || 'ST',
          facing: attShotFacing,
          stride: simT * 15,
          action: postT >= 0.05 && postT <= 0.36 ? 'kick' : simT >= 0.42 && simT < 0.56 ? 'clash' : 'run',
          actionProg: postT >= 0.05 ? clamp((postT - 0.05) / 0.31, 0, 1) : clamp((simT - 0.42) / 0.14, 0, 1)
        }
      );

      // Ball travels at attacker's feet during dribble, advances slightly into kick spot, then fires into net
      const dribbleBallX = attXNow + Math.cos(attShotFacing) * (agentFxR * 0.72);
      const dribbleBallY = attYNow + Math.sin(attShotFacing) * (agentFyR * 0.72);
      const bxNow =
        shotProg > 0
          ? shootOriginX + (goalX - shootOriginX) * shotProg
          : dribbleBallX + (shootOriginX - dribbleBallX) * stepT;
      const byNow =
        shotProg > 0
          ? shootOriginY + (goalY - shootOriginY) * shotProg
          : dribbleBallY + (shootOriginY - dribbleBallY) * stepT;
      const trailPts =
        shotProg > 0.05
          ? Array.from({ length: 6 }, (_, i) => {
              const t = Math.max(0, shotProg - (5 - i) * 0.06);
              return { x: shootOriginX + (goalX - shootOriginX) * t, y: shootOriginY + (goalY - shootOriginY) * t, z: Math.sin(t * Math.PI) * 3.8 };
            })
          : undefined;
      drawVarSoccerBall(bxNow, byNow, simT * 15, {
        z: Math.sin(shotProg * Math.PI) * 3.8,
        trailPts,
        trailColor: 'rgba(250, 204, 21, 0.55)'
      });
    } else {
      // OFFSIDE CALIBRATION LINE SCENARIO (Freeze at exact pass release + Leading-Edge Drop-Lines + Follow-through Goal!)
      const incX = rep?.incidentX ?? (attRight ? 86 : 14);
      const incY = rep?.incidentY ?? 48;
      const defLineX = rep?.defLineX ?? (attRight ? 84 : 16);
      const goalX = attRight ? 101.4 : -1.4;
      const targetGoalY = clamp(rep?.shotTargetY ?? 50, 43.8, 56.2);

      // Fixed receive & strike spot so shot origin stays grounded when attacker shoots at postT = 0.46
      const meetX = attRight ? clamp(incX + 2.4, 70, 95.8) : clamp(incX - 2.4, 4.2, 30);
      const meetY = clamp(incY + (targetGoalY - incY) * 0.16, 12, 88);
      const passStartX = rep?.passFromX ?? (incX - dirSign * 11);
      const passStartY = rep?.passFromY ?? clamp(incY + 7, 18, 82);
      const passAng = screenAngle(passStartX, passStartY, meetX, meetY);
      const passerFootX = passStartX + Math.cos(passAng) * (agentFxR * 0.9);
      const passerFootY = passStartY + Math.sin(passAng) * (agentFyR * 0.9);

      const recvT = clamp(postT / 0.46, 0, 1);
      const finishT = postT > 0.46 ? clamp((postT - 0.46) / 0.5, 0, 1) : 0;
      const postStrikeStep = clamp((postT - 0.46) / 0.25, 0, 1);

      const attXNow =
        simT <= 0.51
          ? incX - dirSign * (1 - playT) * 5.2
          : postT <= 0.46
            ? incX + (meetX - incX) * recvT
            : meetX + dirSign * postStrikeStep * 0.55;
      const attYNow =
        simT <= 0.51
          ? incY + (1 - playT) * 1.8
          : postT <= 0.46
            ? incY + (meetY - incY) * recvT
            : meetY + (targetGoalY - meetY) * postStrikeStep * 0.05;

      const defSideSign = rep?.defY != null ? (rep.defY < incY ? -1 : 1) : incY < 50 ? 1 : -1;
      const defXNow = defLineX + dirSign * (1 - playT) * 1.3 - postT * dirSign * 0.6;
      const defYNow = clamp(rep?.defY ?? (incY + defSideSign * 4.2), 18, 82);

      // Ball rests at passer's kicking boot during freeze (simT 0.49..0.51), travels along pass to meetX/Y, then shoots to goal
      const passTravelT = simT < 0.49 ? 0 : recvT;
      const bxNow =
        finishT > 0
          ? meetX + (goalX - meetX) * finishT
          : passerFootX + (meetX - passerFootX) * passTravelT;
      const byNow =
        finishT > 0
          ? meetY + (targetGoalY - meetY) * finishT
          : passerFootY + (meetY - passerFootY) * passTravelT;
      const bzNow = finishT > 0 ? Math.sin(finishT * Math.PI) * 3.4 : Math.sin(passTravelT * Math.PI) * 2.5;

      const netRipple = finishT > 0.65 ? clamp((finishT - 0.65) / 0.35, 0, 1) : 0;
      drawVarGoalNet(attRight, netRipple, targetGoalY);

      const gkX = rep?.gkX != null ? clamp(rep.gkX, attRight ? 94 : 1.5, attRight ? 98.5 : 6) : attRight ? 97.6 : 2.4;
      const gkReadyY = rep?.gkY != null ? clamp(rep.gkY, 43, 57) : clamp(50 + (incY - 50) * 0.28, 43.5, 56.5);
      const gkY = finishT > 0 ? gkReadyY + (targetGoalY - gkReadyY) * finishT * 0.78 : gkReadyY + Math.sin(simT * 8) * 0.4;
      const passerXNow = passStartX - dirSign * (1 - playT) * 1.6;

      drawMiniAgent(gkX, gkY, defGkKit, '#ffffff', rep?.gkNo ?? 1, '', rep?.gkVis, undefined, '#bae6fd', {
        role: rep?.gkRole || 'GK',
        facing: attRight ? Math.PI : 0,
        stride: simT * 14,
        isGk: true,
        action: finishT > 0.14 ? 'gk_dive' : 'gk_ready',
        actionProg: finishT,
        diveDir: targetGoalY >= gkReadyY ? 1 : -1
      });

      // Animated passer teammate kicking the through-ball (freezes right at foot impact!)
      drawMiniAgent(
        passerXNow,
        passStartY,
        attKit,
        attTrim,
        rep?.passerNo ?? 10,
        '',
        rep?.passerVis,
        'rgba(250, 204, 21, 0.7)',
        '#fde047',
        {
          role: rep?.passerRole || 'CM',
          facing: passAng,
          stride: simT * 12,
          action: simT >= 0.3 && simT <= 0.68 ? 'kick' : 'run',
          actionProg: clamp((simT - 0.3) / 0.38, 0, 1)
        }
      );

      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = isStandalone ? 1.6 : 1.1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mx(passerFootX), my(passerFootY));
      ctx.lineTo(mx(meetX), my(meetY));
      if (postT > 0.42) {
        ctx.lineTo(mx(goalX), my(targetGoalY));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Calibration offside lines aligned strictly to leading shoulder/boot edge at pass-release freeze
      const leadEdgeOffset = dirSign * agentFxR * 0.85;
      if (pct >= 0.36) {
        const lineAlpha = clamp((pct - 0.36) / 0.1, 0, 1);
        const defEdgeFx = defLineX + leadEdgeOffset;
        const attEdgeFx = incX + leadEdgeOffset;
        const defScreenX = mx(defEdgeFx);
        const attScreenX = mx(attEdgeFx);
        const offsideClr = vr.overturn ? '#ef4444' : '#22c55e';

        ctx.save();
        ctx.globalAlpha = lineAlpha;
        ctx.fillStyle = vr.overturn ? 'rgba(239, 68, 68, 0.22)' : 'rgba(34, 197, 94, 0.2)';
        const bandX = Math.min(defScreenX, attScreenX);
        const bandW = Math.max(2, Math.abs(attScreenX - defScreenX));
        ctx.fillRect(bandX, fullPitchY0, bandW, fullPitchH);

        // Calibrated Blue Defender Line + visible Horizontal Projection Drop from Defender Center
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = isStandalone ? 2.6 : 1.8;
        ctx.beginPath();
        ctx.moveTo(defScreenX, fullPitchY0);
        ctx.lineTo(defScreenX, fullPitchY0 + fullPitchH);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(96, 165, 250, 0.92)';
        ctx.lineWidth = 1.25;
        ctx.setLineDash([2.5, 2]);
        ctx.beginPath();
        ctx.moveTo(mx(defLineX), my(defYNow));
        ctx.lineTo(defScreenX, my(defYNow));
        ctx.stroke();

        // Calibrated Attacker Offside Line + Horizontal Projection Drop from Attacker Freeze Center
        ctx.strokeStyle = offsideClr;
        ctx.lineWidth = isStandalone ? 2.6 : 1.8;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(attScreenX, fullPitchY0);
        ctx.lineTo(attScreenX, fullPitchY0 + fullPitchH);
        ctx.stroke();

        ctx.setLineDash([2.5, 2]);
        ctx.beginPath();
        ctx.moveTo(mx(incX), my(incY));
        ctx.lineTo(attScreenX, my(incY));
        ctx.stroke();
        ctx.setLineDash([]);

        const cm = rep?.offsideMarginCm ?? 18;
        const calText = vr.overturn ? `ล้ำหน้า +${cm} ซม.` : `ไม่ล้ำหน้า (${cm} ซม.)`;
        drawTopPillBadge(calText, offsideClr, (defScreenX + attScreenX) / 2, offsideClr);
        ctx.restore();
      }

      drawMiniAgent(
        defXNow,
        defYNow,
        defKit,
        defTrim,
        rep?.defNo ?? 4,
        rep?.defShort || 'กองหลัง',
        rep?.defVis,
        pct >= 0.36 ? '#3b82f6' : undefined,
        '#93c5fd',
        {
          role: rep?.defRole || 'CB',
          facing: attRight ? Math.PI * 0.92 : 0.08,
          stride: simT * 15,
          action: 'run'
        }
      );
      drawMiniAgent(
        attXNow,
        attYNow,
        attKit,
        attTrim,
        rep?.attNo ?? 9,
        rep?.attShort || vr.shooterShort || 'ผู้ยิง',
        rep?.attVis,
        pct >= 0.36 ? (vr.overturn ? '#ef4444' : '#22c55e') : '#facc15',
        pct >= 0.36 ? (vr.overturn ? '#fca5a5' : '#86efac') : '#fde047',
        {
          role: rep?.attRole || 'ST',
          facing: postT > 0.44 ? screenAngle(meetX, meetY, goalX, targetGoalY) : screenAngle(incX, incY, meetX, meetY),
          stride: simT * 17,
          action: finishT > 0 && finishT < 0.58 ? 'kick' : 'run',
          actionProg: clamp(finishT / 0.58, 0, 1)
        }
      );

      const passTrailPts = Array.from({ length: 6 }, (_, i) => {
        const t = Math.max(0, passTravelT - (5 - i) * 0.04);
        return {
          x: passerFootX + (meetX - passerFootX) * t,
          y: passerFootY + (meetY - passerFootY) * t,
          z: Math.sin(t * Math.PI) * 2.5
        };
      });
      const finishTrailPts =
        finishT > 0.04
          ? Array.from({ length: 6 }, (_, i) => {
              const t = Math.max(0, finishT - (5 - i) * 0.05);
              return {
                x: meetX + (goalX - meetX) * t,
                y: meetY + (targetGoalY - meetY) * t,
                z: Math.sin(t * Math.PI) * 3.4
              };
            })
          : undefined;
      drawVarSoccerBall(bxNow, byNow, simT * 15, {
        z: bzNow,
        trailPts: finishT > 0 ? finishTrailPts : simT >= 0.51 ? passTrailPts : undefined,
        trailColor: finishT > 0 ? 'rgba(250, 204, 21, 0.65)' : 'rgba(250, 204, 21, 0.5)'
      });
    }
  } else if (vr.kind === 'penalty') {
    const incX = rep?.incidentX ?? (attRight ? 86 : 14);
    const incY = rep?.incidentY ?? 48;
    const boxLineX = rep?.defLineX ?? (attRight ? 83.5 : 16.5);
    const inBox = rep?.inBox ?? !vr.overturn;
    const bxScreen = mx(boxLineX);
    const defSideSign = rep?.defY != null ? (rep.defY < incY ? -1 : 1) : incY < 50 ? 1 : -1;

    drawVarGoalNet(attRight, 0, 50);

    if (sc === 'handball_box') {
      // HANDBALL IN THE PENALTY BOX SCENARIO (Kick -> Cross flight -> Freeze on exact hand-ball contact -> Deflection!)
      const crossFromX = rep?.passFromX ?? (incX - dirSign * 9.5);
      const crossFromY = rep?.passFromY ?? clamp(incY + (incY < 50 ? 10 : -10), 14, 86);
      const defFacing = screenAngle(incX, incY, crossFromX, crossFromY);
      const handDir = crossFromY < incY ? -1 : 1;
      // Match drawMiniAgent's pixel-space arm angle & length at simT=0.49 freeze!
      const freezeArmProg = clamp((0.49 - 0.22) / 0.42, 0, 1);
      const freezeArmArc = Math.sin(freezeArmProg * Math.PI);
      const freezeArmAng = defFacing + handDir * (0.95 + 0.3 * freezeArmArc);
      const freezeArmLenPx = agentPixR * (1.32 + 0.24 * freezeArmArc);
      const defTargetX = clamp(incX - (Math.cos(freezeArmAng) * freezeArmLenPx) / pxPerFx, 2, 98);
      const defTargetY = clamp(incY - (Math.sin(freezeArmAng) * freezeArmLenPx) / pxPerFy, 4, 96);
      const defXNow = defTargetX + dirSign * (1 - playT) * 1.2;
      const defYNow = defTargetY + (1 - playT) * defSideSign * 1.8;

      const attFacing = screenAngle(crossFromX, crossFromY, incX, incY);
      const attApproach = clamp(simT / 0.14, 0, 1);
      const attXNow = crossFromX - Math.cos(attFacing) * (agentFxR * 0.72 + (1 - attApproach) * 2.1);
      const attYNow = crossFromY - Math.sin(attFacing) * (agentFyR * 0.72 + (1 - attApproach) * 1.0);

      const hitT = clamp((simT - 0.14) / 0.35, 0, 1);
      const deflectT = postT;
      const deflX = incX - dirSign * 4.4;
      const deflY = incY + (incY < 50 ? 6.2 : -6.2);
      const bxNow = deflectT > 0 ? incX + (deflX - incX) * deflectT : crossFromX + (incX - crossFromX) * hitT;
      const byNow = deflectT > 0 ? incY + (deflY - incY) * deflectT : crossFromY + (incY - crossFromY) * hitT;
      const bzNow = deflectT > 0 ? 4.0 * (1 - deflectT * 0.6) : 1.8 + hitT * 2.2;

      const gkX = attRight ? 97 : 3;
      const gkTrackY = clamp(50 + (byNow - 50) * 0.32, 43, 57);
      const refX = incX - dirSign * (7.2 - playT * 1.8);
      const refY = clamp(incY + (incY < 50 ? 9 : -9), 14, 86);

      drawMiniAgent(gkX, gkTrackY, defGkKit, '#ffffff', rep?.gkNo ?? 1, '', rep?.gkVis, undefined, '#bae6fd', {
        role: rep?.gkRole || 'GK',
        facing: attRight ? Math.PI : 0,
        stride: simT * 14,
        isGk: true,
        action: 'gk_ready'
      });
      drawVarReferee(refX, refY, incX, incY);
      drawTopPillBadge('เช็กแฮนด์บอล & เส้นเขตโทษ', '#bae6fd', bxScreen);

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = isStandalone ? 1.6 : 1.1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mx(crossFromX), my(crossFromY));
      ctx.lineTo(mx(incX), my(incY));
      if (pct >= 0.36) {
        ctx.lineTo(mx(deflX), my(deflY));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if (pct >= 0.36) {
        const contactClr = inBox ? '#ef4444' : '#38bdf8';
        const cX = mx(incX);
        const cY = my(incY);
        ctx.save();
        ctx.strokeStyle = contactClr;
        ctx.lineWidth = isStandalone ? 2.4 : 1.7;
        ctx.beginPath();
        ctx.arc(cX, cY, (isStandalone ? 14 : 9.5) + Math.sin(pct * Math.PI * 10) * 1.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([3, 2.5]);
        ctx.beginPath();
        ctx.moveTo(cX, cY);
        ctx.lineTo(bxScreen, cY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        if (pct >= 0.42) {
          drawVarImpactBurst(incX, incY, contactClr, clamp((pct - 0.42) / 0.32, 0, 1));
        }
      }

      drawMiniAgent(
        attXNow,
        attYNow,
        attKit,
        attTrim,
        rep?.attNo ?? 10,
        rep?.attShort || 'ผู้เปิด/ยิง',
        rep?.attVis,
        '#facc15',
        '#fde047',
        {
          role: rep?.attRole || 'RW',
          facing: attFacing,
          stride: simT * 14,
          action: simT <= 0.3 ? 'kick' : 'run',
          actionProg: clamp(simT / 0.3, 0, 1)
        }
      );
      drawMiniAgent(
        defXNow,
        defYNow,
        defKit,
        defTrim,
        rep?.defNo ?? 4,
        rep?.defShort || vr.culpritShort || 'ตัวสกัด',
        rep?.defVis,
        pct >= 0.36 ? (inBox ? '#ef4444' : '#38bdf8') : undefined,
        '#fca5a5',
        {
          role: rep?.defRole || 'CB',
          facing: defFacing,
          stride: simT * 12,
          action: simT >= 0.22 ? 'handball' : 'run',
          actionProg: clamp((simT - 0.22) / 0.42, 0, 1),
          handDir
        }
      );

      const trailPts =
        hitT > 0.04
          ? Array.from({ length: 6 }, (_, i) => {
              const t = Math.max(0, hitT - (5 - i) * 0.06);
              return { x: crossFromX + (incX - crossFromX) * t, y: crossFromY + (incY - crossFromY) * t, z: 1.8 + t * 2.2 };
            })
          : undefined;
      drawVarSoccerBall(bxNow, byNow, simT * 16, {
        z: bzNow,
        trailPts: deflectT > 0 ? undefined : trailPts,
        trailColor: 'rgba(56, 189, 248, 0.55)',
        glowColor: pct >= 0.36 ? (inBox ? '#ef4444' : '#38bdf8') : undefined
      });
    } else if (sc === 'gk_clash_box') {
      // GOALKEEPER / 1V1 COLLISION IN THE BOX SCENARIO (Dribble -> GK dive impact at ball -> Save clear or Penalty fall)
      const attFacing = screenAngle(incX, incY, attRight ? 98 : 2, 50);
      const attXNow = incX - dirSign * (agentFxR * 0.7 + (1 - playT) * 4.8) + postT * dirSign * 1.1;
      const attYNow = incY + (1 - playT) * (incY < 50 ? -1.6 : 1.6);

      const gkStartX = rep?.gkX != null ? clamp(rep.gkX, attRight ? 92 : 2, attRight ? 98.5 : 8) : attRight ? 97 : 3;
      const gkStartY = rep?.gkY != null ? clamp(rep.gkY, 41, 59) : 50;
      const gkMoveT = clamp(playT * 0.98, 0, 1);
      const gkDiveDir = incY >= gkStartY ? 1 : -1;
      const gkActionProg = simT < 0.49 ? clamp((simT - 0.22) / 0.54, 0, 0.5) : 0.5 + postT * 0.5;
      const gkArcNow = Math.sin(gkActionProg * Math.PI);
      const gkTargetX = incX + dirSign * (agentFxR * 0.55);
      const gkTargetY = incY - gkDiveDir * gkArcNow * agentFyR * 0.95;
      const gkXNow = gkStartX + (gkTargetX - gkStartX) * gkMoveT;
      const gkYNow = gkStartY + (gkTargetY - gkStartY) * gkMoveT;

      drawTopPillBadge('เช็กผู้รักษาประตูปะทะในกรอบ', '#bae6fd');

      if (simT >= 0.22) {
        const gkDiveStartPlayT = 1 - Math.pow(1 - clamp(0.22 / 0.49, 0, 1), 2.05);
        const gkDiveStartMoveT = clamp(gkDiveStartPlayT * 0.98, 0, 1);
        const gkDiveStartX = gkStartX + (gkTargetX - gkStartX) * gkDiveStartMoveT;
        const gkDiveStartY = gkStartY + (incY - gkStartY) * gkDiveStartMoveT;
        const gkDiveShiftPx = gkDiveDir * gkArcNow * agentPixR * 0.78;
        drawVarTurfTrack(
          mx(gkDiveStartX),
          my(gkDiveStartY) + agentPixR * 0.34,
          mx(gkXNow),
          my(gkYNow) + gkDiveShiftPx + agentPixR * 0.34,
          !isFreezePhase && simT < 0.51,
          simT,
          'rgba(56, 189, 248, 0.72)'
        );
      }

      if (pct >= 0.36) {
        const contactClr = inBox ? '#ef4444' : '#22c55e';
        const cX = mx(incX);
        const cY = my(incY);
        ctx.save();
        ctx.strokeStyle = contactClr;
        ctx.lineWidth = isStandalone ? 2.4 : 1.7;
        ctx.beginPath();
        ctx.arc(cX, cY, (isStandalone ? 15 : 10) + Math.sin(pct * Math.PI * 10) * 1.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        drawVarImpactBurst(incX, incY, contactClr, clamp((pct - 0.36) / 0.34, 0, 1));
      }

      const refX = incX - dirSign * (6.8 - playT * 2.0);
      const refY = clamp(incY + (incY < 50 ? 8.8 : -8.8), 16, 84);

      drawVarReferee(refX, refY, incX, incY);

      drawMiniAgent(
        attXNow,
        attYNow,
        attKit,
        attTrim,
        rep?.attNo ?? 9,
        rep?.attShort || 'ตัวรุก',
        rep?.attVis,
        '#facc15',
        '#fde047',
        {
          role: rep?.attRole || 'ST',
          facing: attFacing,
          stride: simT * 16,
          action: simT >= 0.5 ? 'fall' : simT >= 0.26 ? 'kick' : 'run',
          actionProg: simT >= 0.5 ? clamp((simT - 0.5) / 0.45, 0, 1) : clamp((simT - 0.26) / 0.24, 0, 1)
        }
      );
      drawMiniAgent(
        gkXNow,
        gkYNow,
        defGkKit,
        '#ffffff',
        rep?.gkNo ?? 1,
        rep?.defShort || 'GK',
        rep?.gkVis,
        pct >= 0.36 ? (inBox ? '#ef4444' : '#22c55e') : undefined,
        '#bae6fd',
        {
          role: rep?.gkRole || 'GK',
          facing: screenAngle(gkXNow, gkYNow, attXNow, attYNow),
          stride: simT * 16,
          isGk: true,
          action: simT >= 0.22 ? 'gk_dive' : 'gk_ready',
          actionProg: gkActionProg,
          diveDir: gkDiveDir
        }
      );

      // Ball dribbled at attacker's foot into (incX, incY), then deflected cleanly or spilled loose
      const dribbleBX = attXNow + Math.cos(attFacing) * (agentFxR * 0.72);
      const dribbleBY = attYNow + Math.sin(attFacing) * (agentFyR * 0.72);
      const clearToX = !inBox ? incX - dirSign * 4.4 : incX + dirSign * 3.8;
      const clearToY = incY + (incY < 50 ? -2.8 : 2.8);
      const bxNow = postT > 0 ? incX + (clearToX - incX) * postT : dribbleBX + (incX - dribbleBX) * playT;
      const byNow = postT > 0 ? incY + (clearToY - incY) * postT : dribbleBY + (incY - dribbleBY) * playT;
      drawVarSoccerBall(bxNow, byNow, simT * 14, { z: 0.5 + Math.sin(postT * Math.PI) * 1.6 });
    } else {
      // BOX-EDGE FOUL CHECK SCENARIO
      const attFacing = screenAngle(incX, incY, attRight ? 96 : 4, 50);
      const attXNow = incX - dirSign * (1 - playT) * 4.4 + postT * dirSign * 0.8;
      const attYNow = incY + (1 - playT) * (incY < 50 ? -1.4 : 1.4);
      const rawDefStartX = rep?.defX != null ? clamp(rep.defX, 2, 98) : incX + dirSign * 1.6;
      const rawDefStartY = clamp(rep?.defY ?? (incY + defSideSign * 5.8), 8, 92);
      const sepPen = Math.hypot(rawDefStartX - incX, rawDefStartY - incY);
      const defStartX = rawDefStartX;
      const defStartY = sepPen < 3.2 ? clamp(incY + defSideSign * 5.8, 8, 92) : rawDefStartY;
      const defContactX = incX + dirSign * (agentFxR * 0.58);
      const defContactY = incY + defSideSign * (agentFyR * 0.96);
      const defXNow = defStartX + (defContactX - defStartX) * playT;
      const defYNow = defStartY + (defContactY - defStartY) * playT;

      const gkX = attRight ? 97 : 3;
      const gkTrackY = clamp(50 + (attYNow - 50) * 0.35, 42, 58);
      const refX = incX - dirSign * (7.2 - playT * 2.0);
      const refY = clamp(incY + (incY < 50 ? 9.5 : -9.5), 14, 86);

      drawMiniAgent(gkX, gkTrackY, defGkKit, '#ffffff', rep?.gkNo ?? 1, '', rep?.gkVis, undefined, '#bae6fd', {
        role: rep?.gkRole || 'GK',
        facing: attRight ? Math.PI : 0,
        stride: simT * 14,
        isGk: true,
        action: 'gk_ready'
      });
      drawTopPillBadge('เส้นเขตโทษ', '#bae6fd', bxScreen);

      const defFacingPen = screenAngle(defXNow, defYNow, attXNow, attYNow);
      if (simT >= 0.2) {
        const defSlideStartX = defStartX + (defContactX - defStartX) * slideStartPlayT;
        const defSlideStartY = defStartY + (defContactY - defStartY) * slideStartPlayT;
        const slidePushPx = slideExtendNow * agentPixR * 0.76;
        drawVarTurfTrack(
          mx(defSlideStartX),
          my(defSlideStartY) + agentPixR * 0.34,
          mx(defXNow) + Math.cos(defFacingPen) * slidePushPx,
          my(defYNow) + Math.sin(defFacingPen) * slidePushPx + agentPixR * 0.34,
          !isFreezePhase && simT < 0.51,
          simT
        );
      }

      if (pct >= 0.36) {
        const contactClr = inBox ? '#ef4444' : '#38bdf8';
        const cX = mx(incX);
        const cY = my(incY);
        const ringR = (isStandalone ? 12 : 8) + Math.sin(pct * Math.PI * 10) * 1.8;
        ctx.save();
        ctx.strokeStyle = contactClr;
        ctx.lineWidth = isStandalone ? 2.2 : 1.6;
        ctx.beginPath();
        ctx.arc(cX, cY, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([3, 2.5]);
        ctx.beginPath();
        ctx.moveTo(cX, cY);
        ctx.lineTo(bxScreen, cY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = contactClr;
        ctx.beginPath();
        ctx.arc(cX, cY, isStandalone ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawVarImpactBurst(incX, incY, contactClr, clamp((pct - 0.36) / 0.34, 0, 1));
      }

      drawVarReferee(refX, refY, incX, incY);

      drawMiniAgent(
        attXNow,
        attYNow,
        attKit,
        attTrim,
        rep?.attNo ?? 10,
        rep?.attShort || 'ตัวรุก',
        rep?.attVis,
        '#facc15',
        '#fde047',
        {
          role: rep?.attRole || 'CAM',
          facing: attFacing,
          stride: simT * 16,
          action: simT >= 0.49 ? 'fall' : 'run',
          actionProg: clamp((simT - 0.49) / 0.44, 0, 1)
        }
      );
      drawMiniAgent(
        defXNow,
        defYNow,
        defKit,
        defTrim,
        rep?.defNo ?? 4,
        rep?.defShort || vr.culpritShort || 'ตัวสกัด',
        rep?.defVis,
        pct >= 0.36 ? (inBox ? '#ef4444' : '#38bdf8') : undefined,
        '#fca5a5',
        {
          role: rep?.defRole || 'CB',
          facing: defFacingPen,
          stride: simT * 14,
          action: simT >= 0.2 && simT <= 0.78 ? 'slide' : 'run',
          actionProg: slideActionProg
        }
      );

      // Keep ball strictly on attacker's side of box line during pre-freeze when overturned outside box
      const rawBallX = attXNow + Math.cos(attFacing) * (agentFxR * 0.85 + ballFxR * 0.45);
      const preFreezeBallX = !inBox
        ? attRight
          ? Math.min(rawBallX, boxLineX - ballFxR * 1.1)
          : Math.max(rawBallX, boxLineX + ballFxR * 1.1)
        : rawBallX;
      const bxNow = preFreezeBallX + postT * dirSign * 2.1;
      const byNow = attYNow + Math.sin(attFacing) * (agentFyR * 0.85 + ballFyR * 0.45) + postT * (incY < 50 ? 1.2 : -1.2);
      drawVarSoccerBall(bxNow, byNow, simT * 13, { z: 0.5 + postT * 0.4 });
    }
  } else {
    // FOUL / RED CARD VAR SCENARIOS
    const incX = rep?.incidentX ?? vr.x;
    const incY = rep?.incidentY ?? vr.y;
    const defSideSign = rep?.defY != null ? (rep.defY < incY ? -1 : 1) : 1;

    const attStartX = incX - dirSign * 4.2;
    const attStartY = clamp(incY + (incY < 50 ? -1.4 : 1.4), 6, 94);
    const attFacing = screenAngle(attStartX, attStartY, attRight ? 100 : 0, 50);
    const attXNow = attStartX + (incX - attStartX) * playT + postT * dirSign * 0.65;
    const attYNow = attStartY + (incY - attStartY) * playT;
    const rawDefStartX = rep?.defX != null ? clamp(rep.defX, 2, 98) : incX + dirSign * 1.6;
    const rawDefStartY = clamp(rep?.defY ?? (incY + defSideSign * 5.8), 6, 94);
    const sepFoul = Math.hypot(rawDefStartX - incX, rawDefStartY - incY);
    const defStartX = rawDefStartX;
    const defStartY = sepFoul < 3.2 ? clamp(incY + defSideSign * 5.8, 6, 94) : rawDefStartY;
    const defContactX = incX + dirSign * (agentFxR * 0.62);
    const defContactY = clamp(incY + defSideSign * (agentFyR * 0.96), 6, 94);
    const defXNow = defStartX + (defContactX - defStartX) * playT;
    const defYNow = defStartY + (defContactY - defStartY) * playT;

    const isDogso = sc === 'dogso' || rep?.foulKind === 'dogso';
    const isReckless = sc === 'reckless_duel';

    let dogsoGkX = attRight ? 96.5 - playT * 1.4 : 3.5 + playT * 1.4;
    let dogsoGkY = clamp(50 + (incY - 50) * 0.35, 43, 57);

    drawVisibleOtherGoal();

    const defFacingFoul = screenAngle(defXNow, defYNow, attXNow, attYNow);

    if (isDogso) {
      const gLineX = attRight ? 100 : 0;
      drawVarGoalNet(attRight, 0, 50);
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = isStandalone ? 1.5 : 1.0;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mx(incX), my(incY));
      ctx.lineTo(mx(gLineX), my(42));
      ctx.lineTo(mx(gLineX), my(58));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      const gkBaseX = rep?.gkX != null ? clamp(rep.gkX, attRight ? 88 : 2, attRight ? 98 : 12) : attRight ? 96.5 : 3.5;
      dogsoGkX = gkBaseX - dirSign * playT * 1.2;
      dogsoGkY = rep?.gkY != null ? clamp(rep.gkY, 42, 58) : clamp(50 + (incY - 50) * 0.35, 43, 57);
      drawMiniAgent(dogsoGkX, dogsoGkY, defGkKit, '#ffffff', rep?.gkNo ?? 1, '', rep?.gkVis, undefined, '#bae6fd', {
        role: rep?.gkRole || 'GK',
        facing: screenAngle(dogsoGkX, dogsoGkY, attXNow, attYNow),
        stride: simT * 14,
        isGk: true,
        action: 'gk_ready'
      });
    } else if (isReckless) {
      if (simT > 0.24) {
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.48)';
        ctx.lineWidth = isStandalone ? 2.0 : 1.4;
        ctx.setLineDash([3, 2.5]);
        ctx.beginPath();
        ctx.arc(mx((attXNow + defXNow) * 0.5), my((attYNow + defYNow) * 0.5), isStandalone ? 15 : 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    if (!isReckless && simT >= 0.2) {
      const defSlideStartX = defStartX + (defContactX - defStartX) * slideStartPlayT;
      const defSlideStartY = defStartY + (defContactY - defStartY) * slideStartPlayT;
      const slidePushPx = slideExtendNow * agentPixR * 0.76;
      drawVarTurfTrack(
        mx(defSlideStartX),
        my(defSlideStartY) + agentPixR * 0.34,
        mx(defXNow) + Math.cos(defFacingFoul) * slidePushPx,
        my(defYNow) + Math.sin(defFacingFoul) * slidePushPx + agentPixR * 0.34,
        !isFreezePhase && simT < 0.51,
        simT
      );
    }

    if (pct >= 0.36) {
      const isRedVerdict = vr.pendingCardUpgrade === 'R';
      const spotClr = showVerdict ? (isRedVerdict ? '#ef4444' : '#facc15') : '#f59e0b';
      const cxSpot = mx((attXNow + defXNow) * 0.5);
      const cySpot = my((attYNow + defYNow) * 0.5);
      ctx.save();
      ctx.fillStyle = isRedVerdict && showVerdict ? 'rgba(239, 68, 68, 0.16)' : 'rgba(245, 158, 11, 0.15)';
      ctx.strokeStyle = spotClr;
      ctx.lineWidth = isStandalone ? 2.4 : 1.8;
      ctx.beginPath();
      ctx.arc(cxSpot, cySpot, (isStandalone ? 21 : 14) + Math.sin(pct * Math.PI * 10) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      drawVarImpactBurst((attXNow + defXNow) * 0.5, (attYNow + defYNow) * 0.5, spotClr, clamp((pct - 0.36) / 0.34, 0, 1));
    }

    const refX = incX - dirSign * (5.6 - playT * 1.6);
    const refY = clamp(incY + (incY < 50 ? -7.4 : 7.4), 14, 86);
    drawVarReferee(refX, refY, (attXNow + defXNow) * 0.5, (attYNow + defYNow) * 0.5);

    drawMiniAgent(
      attXNow,
      attYNow,
      attKit,
      attTrim,
      rep?.attNo ?? 10,
      rep?.attShort || 'ผู้ถูกสกัด',
      rep?.attVis,
      '#ffffff',
      '#f8fafc',
      {
        role: rep?.attRole || 'ST',
        facing: attFacing,
        stride: simT * 16,
        action: isReckless
          ? simT >= 0.49
            ? 'fall'
            : simT >= 0.22
              ? 'clash'
              : 'run'
          : simT >= 0.49
            ? 'fall'
            : 'run',
        actionProg: isReckless
          ? simT >= 0.49
            ? clamp((simT - 0.49) / 0.42, 0, 1)
            : clamp((simT - 0.22) / 0.27, 0, 1)
          : clamp((simT - 0.49) / 0.42, 0, 1)
      }
    );
    drawMiniAgent(
      defXNow,
      defYNow,
      defKit,
      defTrim,
      rep?.defNo ?? 5,
      rep?.defShort || vr.culpritShort || 'ผู้ทำฟาวล์',
      rep?.defVis,
      pct >= 0.36 ? '#f59e0b' : undefined,
      '#fde047',
      {
        role: rep?.defRole || 'CB',
        facing: defFacingFoul,
        stride: simT * 15,
        action: isReckless
          ? simT >= 0.32
            ? 'clash'
            : simT >= 0.14
              ? 'leap'
              : 'run'
          : simT >= 0.2 && simT <= 0.78
            ? 'slide'
            : 'run',
        actionProg: isReckless
          ? simT >= 0.32
            ? clamp((simT - 0.32) / 0.36, 0, 1)
            : clamp((simT - 0.14) / 0.18, 0, 1)
          : slideActionProg
      }
    );

    const bxNow = attXNow + Math.cos(attFacing) * (agentFxR * 0.85 + ballFxR * 0.45) + postT * dirSign * 2.4;
    const byNow = attYNow + Math.sin(attFacing) * (agentFyR * 0.85 + ballFyR * 0.45) + (isReckless ? postT * 1.4 : 0);
    const bzNow = isReckless ? Math.abs(Math.sin(clamp((simT - 0.38) / 0.62, 0, 1) * Math.PI * 1.4)) * 3.8 : 0.6;
    drawVarSoccerBall(bxNow, byNow, simT * 14, { z: bzNow });

    if (pct >= 0.36) {
      const fTag = isDogso
        ? 'เช็กตัวสุดท้าย (DOGSO)'
        : isReckless
          ? 'เช็กจังหวะปะทะรุนแรง / นอกเกม'
          : 'เช็กจังหวะเปิดปุ่ม / เสียบช้า';
      drawTopPillBadge(fTag, '#fcd34d');
    }
  }

  // Sweeping Forensic VAR Laser Scanline during Freeze-frame lock
  if (isFreezePhase) {
    const scanFrac = (pct - 0.36) / 0.28;
    const scanY = scrY + scanFrac * scrH;
    const scanGrad = getCachedCtxGradient(ctx, 'var-scan-line', () => {
      const g = ctx.createLinearGradient(0, -10, 0, 10);
      g.addColorStop(0, 'rgba(56, 189, 248, 0)');
      g.addColorStop(0.5, 'rgba(56, 189, 248, 0.26)');
      g.addColorStop(1, 'rgba(56, 189, 248, 0)');
      return g;
    });
    ctx.save();
    ctx.translate(0, scanY);
    ctx.fillStyle = scanGrad;
    ctx.fillRect(scrX, -10, scrW, 20);
    ctx.restore();
  }

  // Subtle Broadcast Lens Vignette + Monitor Scanlines
  const vigGrad = getCachedCtxGradient(
    ctx,
    `var-vig|${scrX.toFixed(1)}|${scrY.toFixed(1)}|${scrW.toFixed(1)}|${scrH.toFixed(1)}`,
    () => {
      const g = ctx.createRadialGradient(
        scrX + scrW * 0.5,
        scrY + scrH * 0.5,
        Math.min(scrW, scrH) * 0.34,
        scrX + scrW * 0.5,
        scrY + scrH * 0.5,
        Math.max(scrW, scrH) * 0.76
      );
      g.addColorStop(0, 'rgba(0, 0, 0, 0)');
      g.addColorStop(1, 'rgba(2, 6, 23, 0.42)');
      return g;
    }
  );
  ctx.fillStyle = vigGrad;
  ctx.fillRect(scrX, scrY, scrW, scrH);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  for (let sy = scrY + 3; sy < scrY + scrH; sy += 4) {
    ctx.beginPath();
    ctx.moveTo(scrX, sy);
    ctx.lineTo(scrX + scrW, sy);
    ctx.stroke();
  }

  // Broadcast Speed / Frame HUD Telemetry (Bottom-Left / Bottom-Right in standalone & PiP)
  if (!smallText || isStandalone) {
    const modeChip = isFreezePhase ? '⏸ FREEZE · 120FPS' : pct < 0.36 ? '▶ SLOW-MO 0.25×' : '▶ CALL · LIVE';
    ctx.save();
    ctx.font = `800 ${isStandalone ? 9.5 : 7.0}px "Noto Sans Thai", sans-serif`;
    const mw = measureTextCached(ctx, modeChip) + (isStandalone ? 10 : 7);
    const mh = isStandalone ? 15 : 11;
    const hudY = scrY + scrH - mh - 6;
    ctx.fillStyle = 'rgba(6, 12, 24, 0.78)';
    ctx.beginPath();
    ctx.roundRect(scrX + 6, hudY, mw, mh, 3);
    ctx.fill();
    ctx.fillStyle = isFreezePhase ? '#7dd3fc' : showVerdict ? verdictColor : '#e2e8f0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(modeChip, scrX + 6 + (isStandalone ? 5 : 3.5), hudY + mh / 2 + 0.3);

    if (isStandalone) {
      const frmTxt = `FRM ${String(Math.round(pct * 120)).padStart(3, '0')}`;
      const fw = measureTextCached(ctx, frmTxt) + 10;
      ctx.fillStyle = 'rgba(6, 12, 24, 0.78)';
      ctx.beginPath();
      ctx.roundRect(scrX + scrW - fw - 6, hudY, fw, mh, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.textAlign = 'right';
      ctx.fillText(frmTxt, scrX + scrW - 11, hudY + mh / 2 + 0.3);
    }
    ctx.restore();
  }

  // Broadcast Viewfinder Corner Brackets
  const br = isStandalone ? 10 : 7;
  const bp = isStandalone ? 8 : 5;
  ctx.strokeStyle = isFreezePhase ? 'rgba(56, 189, 248, 0.78)' : 'rgba(255, 255, 255, 0.48)';
  ctx.lineWidth = isStandalone ? 1.6 : 1.2;
  ctx.beginPath();
  ctx.moveTo(scrX + bp, scrY + bp + br);
  ctx.lineTo(scrX + bp, scrY + bp);
  ctx.lineTo(scrX + bp + br, scrY + bp);
  ctx.moveTo(scrX + scrW - bp - br, scrY + bp);
  ctx.lineTo(scrX + scrW - bp, scrY + bp);
  ctx.lineTo(scrX + scrW - bp, scrY + bp + br);
  ctx.moveTo(scrX + bp, scrY + scrH - bp - br);
  ctx.lineTo(scrX + bp, scrY + scrH - bp);
  ctx.lineTo(scrX + bp + br, scrY + scrH - bp);
  ctx.moveTo(scrX + scrW - bp - br, scrY + scrH - bp);
  ctx.lineTo(scrX + scrW - bp, scrY + scrH - bp);
  ctx.lineTo(scrX + scrW - bp, scrY + scrH - bp - br);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
};

export const drawVarReplayToCanvas = (
  canvas: HTMLCanvasElement,
  vr: VarReviewState,
  pct: number,
  homeKit: string,
  awayKit: string,
  homeGkKit = '#16a34a',
  awayGkKit = '#ea580c',
  homeTrim = '#ffffff',
  awayTrim = '#ffffff',
  cameraMode: VarCameraMode = 'wide',
  followBall = false
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const rect = cw > 0 && ch > 0 ? null : canvas.getBoundingClientRect();
  const cssW = Math.max(280, Math.round((cw > 0 ? cw : rect?.width) || 480));
  const cssH = Math.max(160, Math.round((ch > 0 ? ch : rect?.height) || 270));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  renderVarMonitorPanel(
    ctx,
    vr,
    clamp(pct, 0, 1),
    1,
    1,
    cssW - 2,
    cssH - 2,
    1.65,
    homeKit,
    awayKit,
    homeGkKit,
    awayGkKit,
    homeTrim,
    awayTrim,
    true,
    cameraMode,
    followBall
  );
};

export const drawLivePitchToCanvas = (
  canvas: HTMLCanvasElement,
  world: LiveMatchWorld,
  homeKit: string,
  awayKit: string,
  homeGkKit: string,
  awayGkKit: string,
  showRunVectors: boolean,
  homeTrim = '#ffffff',
  awayTrim = '#ffffff',
  showPositions = true,
  showRatings = false,
  liveRatings?: Record<string, number>
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const rect = cw > 0 && ch > 0 ? null : canvas.getBoundingClientRect();
  const cssW = Math.max(320, Math.round((cw > 0 ? cw : rect?.width) || 640));
  const cssH = Math.max(180, Math.round((ch > 0 ? ch : rect?.height) || 330));
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const padX = Math.max(24, cssW * 0.048);
  const padTop = Math.max(34, cssH * 0.112);
  const padBottom = Math.max(30, cssH * 0.102);
  const padY = padTop;
  const pw = cssW - padX * 2;
  const ph = cssH - padTop - padBottom;
  const px = (x: number) => padX + (x / 100) * pw;
  const py = (y: number) => padY + (y / 100) * ph;

  const env = world.env;
  const isRainy = env?.season === 'rainy';
  const isNight = env?.timeOfDay === 'night';
  const turfSpec = getTurfGradeSpec(env?.turfGrade);
  const turfCond = clamp(Math.round(env?.turfCond ?? 100), 30, 100);
  const grassLength = env?.grassLength || (turfSpec.cutStyle === 'patchy' ? 'long' : turfSpec.cutStyle === 'checker' || turfSpec.cutStyle === 'hybrid_pro' ? 'short' : 'medium');
  const dirtMix = clamp(
    env?.dirtMix ?? (turfSpec.cutStyle === 'patchy' ? Math.max(0.35, (100 - turfCond) / 70) : turfCond < 75 ? (78 - turfCond) / 65 : 0),
    0,
    0.92
  );
  const pitchSeed = env?.pitchSeed ?? 137;
  let puddleSig = '';
  if (isRainy && env?.puddles?.length) {
    const cachedSig = puddleSigCache.get(env.puddles);
    if (cachedSig !== undefined) {
      puddleSig = cachedSig;
    } else {
      puddleSig = env.puddles
        .map((pd) => `${pd.x.toFixed(1)},${pd.y.toFixed(1)},${pd.rx.toFixed(1)},${pd.ry.toFixed(1)},${pd.rot.toFixed(2)},${pd.alpha.toFixed(2)}`)
        .join(';');
      puddleSigCache.set(env.puddles, puddleSig);
    }
  }
  const stadiumStyle = env?.stadiumStyle || 'modern_bowl';
  const perimeterSig = getPerimeterSig(resolvePitchPerimeterBrands(env));
  const bgKey = `${cssW}x${cssH}@${dpr}|${stadiumStyle}|${turfSpec.id}|${Math.round(turfCond / 5)}|${grassLength}|${Math.round(dirtMix * 20)}|${pitchSeed}|${isRainy ? 'r' : 's'}|${isNight ? 'n' : 'd'}|${(env?.sunAngle ?? 0.4).toFixed(3)}|${puddleSig}|${perimeterSig}`;

  if (typeof document !== 'undefined') {
    if (!pitchBgCache || pitchBgCache.key !== bgKey) {
      const bgCanvas = pitchBgCache?.canvas || document.createElement('canvas');
      if (bgCanvas.width !== pxW || bgCanvas.height !== pxH) {
        bgCanvas.width = pxW;
        bgCanvas.height = pxH;
      }
      const bctx = bgCanvas.getContext('2d');
      if (bctx) {
        bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // 1. Stadium apron & multi-grade mowed turf pattern (cached once offscreen for zero FPS lag)
        const [stripeEven, stripeOdd, apronFill] = isNight
          ? isRainy
            ? turfSpec.palette.nightRainy
            : turfSpec.palette.night
          : isRainy
            ? turfSpec.palette.rainy
            : turfSpec.palette.day;

        bctx.fillStyle = apronFill;
        bctx.fillRect(0, 0, cssW, cssH);

        // Stadium architectural apron surround (cached per stadiumStyle)
        bctx.save();
        if (stadiumStyle === 'open_track') {
          const trackPadX = Math.max(4, padX * 0.2);
          const trackPadY = Math.max(5, padY * 0.18);
          bctx.fillStyle = isNight ? 'rgba(138, 62, 46, 0.55)' : 'rgba(176, 82, 58, 0.58)';
          bctx.beginPath();
          bctx.roundRect(trackPadX, trackPadY, cssW - trackPadX * 2, cssH - trackPadY * 2, 26);
          bctx.fill();
          bctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          bctx.lineWidth = 1;
          for (let lane = 1; lane <= 3; lane++) {
            const inset = lane * 4.5;
            bctx.beginPath();
            bctx.roundRect(
              trackPadX + inset,
              trackPadY + inset,
              cssW - (trackPadX + inset) * 2,
              cssH - (trackPadY + inset) * 2,
              Math.max(8, 26 - inset)
            );
            bctx.stroke();
          }
        } else if (stadiumStyle === 'fortress_kop') {
          bctx.strokeStyle = isNight ? 'rgba(239, 68, 68, 0.36)' : 'rgba(185, 28, 28, 0.38)';
          bctx.lineWidth = 5;
          bctx.strokeRect(padX - 6, padY - 6, pw + 12, ph + 12);
          bctx.strokeStyle = 'rgba(255,255,255,0.18)';
          bctx.lineWidth = 1.5;
          bctx.strokeRect(padX - 10, padY - 10, pw + 20, ph + 20);
        } else if (stadiumStyle === 'thai_heritage') {
          bctx.strokeStyle = isNight ? 'rgba(244, 198, 61, 0.45)' : 'rgba(217, 159, 28, 0.48)';
          bctx.lineWidth = 2.5;
          bctx.strokeRect(padX - 7, padY - 7, pw + 14, ph + 14);
          const cornerSize = 14;
          bctx.fillStyle = 'rgba(244, 198, 61, 0.32)';
          [
            [padX - 9, padY - 9],
            [padX + pw - 5, padY - 9],
            [padX - 9, padY + ph - 5],
            [padX + pw - 5, padY + ph - 5]
          ].forEach(([cx, cy]) => {
            bctx.fillRect(cx, cy, cornerSize, cornerSize);
          });
        } else if (stadiumStyle === 'glass_pavilion') {
          bctx.strokeStyle = isNight ? 'rgba(125, 211, 252, 0.48)' : 'rgba(186, 230, 253, 0.56)';
          bctx.lineWidth = 2.5;
          bctx.strokeRect(padX - 6, padY - 6, pw + 12, ph + 12);
          const glassH = Math.max(6, padY - 11);
          bctx.fillStyle = 'rgba(125, 211, 252, 0.12)';
          bctx.fillRect(padX - 12, 3, pw + 24, glassH);
          bctx.fillRect(padX - 12, cssH - 3 - glassH, pw + 24, glassH);
        } else if (stadiumStyle === 'cyber_dome') {
          bctx.strokeStyle = isNight ? 'rgba(34, 211, 238, 0.65)' : 'rgba(56, 189, 248, 0.5)';
          bctx.lineWidth = 3;
          bctx.beginPath();
          bctx.roundRect(padX - 9, padY - 9, pw + 18, ph + 18, 16);
          bctx.stroke();
          bctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
          bctx.lineWidth = 1.2;
          bctx.beginPath();
          bctx.roundRect(padX - 14, padY - 14, pw + 28, ph + 28, 20);
          bctx.stroke();
        } else {
          // modern_bowl: crisp double ad-board perimeter
          bctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          bctx.lineWidth = 2;
          bctx.beginPath();
          bctx.roundRect(padX - 7, padY - 7, pw + 14, ph + 14, 10);
          bctx.stroke();
        }
        bctx.restore();

        // Top, Left & Right Perimeter Dealer / Partner LED Boards
        drawPitchPerimeterDealerBoards(bctx, { padX, padTop, pw, ph, isNight, env });

        const stripeCount =
          turfSpec.cutStyle === 'patchy'
            ? 8
            : turfSpec.cutStyle === 'bands'
              ? 10
              : turfSpec.cutStyle === 'hybrid_pro'
                ? 14
                : 12;
        const stripeW = pw / stripeCount;
        for (let i = 0; i < stripeCount; i++) {
          bctx.fillStyle = i % 2 === 0 ? stripeEven : stripeOdd;
          bctx.fillRect(padX + i * stripeW, padY, stripeW + 0.5, ph);
        }

        // Cross-cut / specialty elite stadium mowing patterns (drawn once into background bitmap)
        if (turfSpec.cutStyle === 'checker' || turfSpec.cutStyle === 'hybrid_pro') {
          const rowBands = turfSpec.cutStyle === 'hybrid_pro' ? 8 : 7;
          const bandH = ph / rowBands;
          bctx.save();
          bctx.beginPath();
          bctx.rect(padX, padY, pw, ph);
          bctx.clip();
          for (let r = 0; r < rowBands; r++) {
            if (r % 2 === 0) {
              bctx.fillStyle = turfSpec.cutStyle === 'hybrid_pro' ? 'rgba(6, 36, 20, 0.085)' : 'rgba(6, 34, 18, 0.075)';
              bctx.fillRect(padX, padY + r * bandH, pw, bandH + 0.4);
            }
          }
          if (turfSpec.cutStyle === 'hybrid_pro') {
            // Signature Champions League / FIFA Pro subtle center ring mow & penalty box cut frame
            bctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
            bctx.lineWidth = Math.max(8, ph * 0.045);
            bctx.beginPath();
            bctx.arc(px(50), py(50), ph * 0.22, 0, Math.PI * 2);
            bctx.stroke();

            bctx.strokeStyle = 'rgba(6, 32, 18, 0.14)';
            bctx.lineWidth = Math.max(4, pw * 0.008);
            bctx.strokeRect(padX + 2, padY + 2, pw - 4, ph - 4);
          }
          bctx.restore();
        } else if (turfSpec.cutStyle === 'pro_bands') {
          bctx.save();
          bctx.strokeStyle = 'rgba(6, 32, 18, 0.1)';
          bctx.lineWidth = Math.max(3, pw * 0.006);
          bctx.strokeRect(padX + 1.5, padY + 1.5, pw - 3, ph - 3);
          bctx.restore();
        }

        // Seeded PRNG for deterministic per-stadium organic turf texture (dirt patches, tufts, grass grain)
        let rngState = (pitchSeed ^ 0x9e3779b9) >>> 0;
        const nextRand = () => {
          rngState = (rngState + 0x6d2b79f5) | 0;
          let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        bctx.save();
        bctx.beginPath();
        bctx.rect(padX, padY, pw, ph);
        bctx.clip();

        // Organic uneven grass patches for medium / long grass pitches
        if (grassLength !== 'short' || dirtMix > 0.08) {
          const blotchCount = grassLength === 'long' ? 24 : 12;
          for (let i = 0; i < blotchCount; i++) {
            const bx = padX + nextRand() * pw;
            const by = padY + nextRand() * ph;
            const br = Math.max(10, (0.04 + nextRand() * 0.09) * pw);
            const bGrad = bctx.createRadialGradient(bx, by, br * 0.1, bx, by, br);
            const darkOrWarm = nextRand() > 0.42;
            const op = grassLength === 'long' ? 0.13 : 0.065;
            bGrad.addColorStop(
              0,
              darkOrWarm
                ? `rgba(10, 38, 16, ${op})`
                : isRainy
                  ? `rgba(42, 86, 36, ${op * 0.9})`
                  : `rgba(88, 128, 42, ${op * 0.95})`
            );
            bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            bctx.fillStyle = bGrad;
            bctx.beginPath();
            bctx.ellipse(bx, by, br, br * (0.55 + nextRand() * 0.45), nextRand() * Math.PI, 0, Math.PI * 2);
            bctx.fill();
          }
        }

        // Short grass: sleek roller sheen & fine crisp mowing lines
        if (grassLength === 'short') {
          bctx.strokeStyle = isNight ? 'rgba(255, 255, 255, 0.024)' : 'rgba(255, 255, 255, 0.036)';
          bctx.lineWidth = 0.8;
          const microStep = Math.max(4, ph / 48);
          for (let yLine = padY + microStep; yLine < padY + ph; yLine += microStep) {
            bctx.beginPath();
            bctx.moveTo(padX, yLine);
            bctx.lineTo(padX + pw, yLine);
            bctx.stroke();
          }
        } else {
          // Medium & long grass: visible grass blades / tufts
          const tuftCount = grassLength === 'long' ? 280 : 120;
          const bladeH = grassLength === 'long' ? Math.max(3.2, ph * 0.015) : Math.max(1.8, ph * 0.0085);
          for (let i = 0; i < tuftCount; i++) {
            const tx = padX + 4 + nextRand() * (pw - 8);
            const ty = padY + 4 + nextRand() * (ph - 8);
            const isSunTip = nextRand() > 0.45;
            bctx.strokeStyle = isSunTip
              ? isRainy
                ? 'rgba(84, 152, 74, 0.34)'
                : 'rgba(128, 188, 76, 0.36)'
              : 'rgba(8, 36, 16, 0.38)';
            bctx.lineWidth = grassLength === 'long' ? 1.05 : 0.8;
            bctx.beginPath();
            bctx.moveTo(tx - 1.1, ty);
            bctx.lineTo(tx - 1.8 - nextRand() * 0.8, ty - bladeH * (0.7 + nextRand() * 0.45));
            bctx.moveTo(tx, ty + 0.3);
            bctx.lineTo(tx + (nextRand() - 0.5) * 1.4, ty - bladeH * (0.85 + nextRand() * 0.4));
            if (grassLength === 'long') {
              bctx.moveTo(tx + 1.1, ty);
              bctx.lineTo(tx + 1.9 + nextRand() * 0.8, ty - bladeH * (0.65 + nextRand() * 0.45));
            }
            bctx.stroke();
          }
        }

        // Mixed dirt / clay / bare earth patches ("สนามที่มีดินผสมด้วย")
        if (dirtMix > 0.04) {
          const wearZones: { x: number; y: number; rx: number; ry: number; weight: number }[] = [
            { x: 4.5, y: 50, rx: 4.6, ry: 12.2, weight: 1.0 },
            { x: 95.5, y: 50, rx: 4.6, ry: 12.2, weight: 1.0 },
            { x: 50, y: 50, rx: 5.8, ry: 8.8, weight: 0.9 },
            { x: 11.5, y: 50, rx: 3.1, ry: 5.0, weight: 0.85 },
            { x: 88.5, y: 50, rx: 3.1, ry: 5.0, weight: 0.85 },
            { x: 24, y: 14, rx: 4.0, ry: 3.5, weight: 0.55 },
            { x: 76, y: 86, rx: 4.0, ry: 3.5, weight: 0.55 }
          ];

          const extraSpots = Math.round(dirtMix * 16);
          for (let i = 0; i < extraSpots; i++) {
            wearZones.push({
              x: 8 + nextRand() * 84,
              y: 8 + nextRand() * 84,
              rx: 2.2 + nextRand() * (3.6 + dirtMix * 3.2),
              ry: 1.8 + nextRand() * (3.2 + dirtMix * 2.6),
              weight: 0.45 + nextRand() * 0.55
            });
          }

          wearZones.forEach((wz) => {
            const cxW = px(wz.x);
            const cyW = py(wz.y);
            const rxW = Math.max(7, (wz.rx / 100) * pw * (0.78 + dirtMix * 0.42));
            const ryW = Math.max(6, (wz.ry / 100) * ph * (0.78 + dirtMix * 0.42));
            const maxR = Math.max(rxW, ryW);
            const coreAlpha = clamp(dirtMix * wz.weight * (isRainy ? 0.62 : 0.56), 0.08, 0.66);

            const wGrad = bctx.createRadialGradient(cxW, cyW, maxR * 0.12, cxW, cyW, maxR);
            if (isRainy) {
              wGrad.addColorStop(0, `rgba(74, 48, 27, ${coreAlpha})`);
              wGrad.addColorStop(0.55, `rgba(88, 60, 34, ${coreAlpha * 0.7})`);
              wGrad.addColorStop(1, 'rgba(62, 46, 26, 0)');
            } else {
              wGrad.addColorStop(0, `rgba(142, 102, 58, ${coreAlpha})`);
              wGrad.addColorStop(0.55, `rgba(124, 96, 52, ${coreAlpha * 0.68})`);
              wGrad.addColorStop(1, 'rgba(105, 88, 46, 0)');
            }
            bctx.fillStyle = wGrad;
            bctx.beginPath();
            bctx.ellipse(cxW, cyW, rxW, ryW, (nextRand() - 0.5) * 0.5, 0, Math.PI * 2);
            bctx.fill();

            // Granular dirt clods & earthy texture dots inside each soil patch
            const speckCount = Math.round(4 + dirtMix * 12 * wz.weight);
            for (let s = 0; s < speckCount; s++) {
              const ang = nextRand() * Math.PI * 2;
              const dist = Math.sqrt(nextRand()) * 0.72;
              const sx = cxW + Math.cos(ang) * rxW * dist;
              const sy = cyW + Math.sin(ang) * ryW * dist;
              const sr = 0.7 + nextRand() * 1.4;
              bctx.fillStyle = isRainy
                ? nextRand() > 0.5
                  ? `rgba(48, 30, 16, ${clamp(coreAlpha * 0.9, 0.15, 0.65)})`
                  : `rgba(98, 68, 40, ${clamp(coreAlpha * 0.75, 0.12, 0.5)})`
                : nextRand() > 0.45
                  ? `rgba(112, 74, 38, ${clamp(coreAlpha * 0.9, 0.15, 0.62)})`
                  : `rgba(176, 138, 86, ${clamp(coreAlpha * 0.72, 0.12, 0.48)})`;
              bctx.beginPath();
              bctx.arc(sx, sy, sr, 0, Math.PI * 2);
              bctx.fill();
            }
          });
        }

        bctx.restore();

        // Subtle rainy-season surface water patches on the turf (static layer)
        if (isRainy && env?.puddles?.length) {
          env.puddles.forEach((pd) => {
            const cxP = px(pd.x);
            const cyP = py(pd.y);
            const rX = Math.max(8, (pd.rx / 100) * pw);
            const rY = Math.max(5, (pd.ry / 100) * ph);

            bctx.save();
            bctx.translate(cxP, cyP);
            bctx.rotate(pd.rot);

            bctx.fillStyle = isNight ? 'rgba(4, 18, 12, 0.26)' : 'rgba(6, 26, 16, 0.2)';
            bctx.beginPath();
            bctx.ellipse(0, 0, rX * 1.24, rY * 1.24, 0, 0, Math.PI * 2);
            bctx.fill();

            const wGrad = bctx.createRadialGradient(-rX * 0.22, -rY * 0.22, rX * 0.08, 0, 0, rX);
            if (isNight) {
              wGrad.addColorStop(0, `rgba(186, 230, 253, ${pd.alpha + 0.08})`);
              wGrad.addColorStop(0.55, `rgba(125, 211, 252, ${pd.alpha * 0.72})`);
              wGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
            } else {
              wGrad.addColorStop(0, `rgba(219, 244, 255, ${pd.alpha + 0.06})`);
              wGrad.addColorStop(0.55, `rgba(147, 210, 235, ${pd.alpha * 0.68})`);
              wGrad.addColorStop(1, 'rgba(125, 211, 252, 0)');
            }
            bctx.fillStyle = wGrad;
            bctx.beginPath();
            bctx.ellipse(0, 0, rX, rY, 0, 0, Math.PI * 2);
            bctx.fill();

            bctx.strokeStyle = isNight ? 'rgba(224, 242, 254, 0.22)' : 'rgba(240, 249, 255, 0.26)';
            bctx.lineWidth = 0.85;
            bctx.beginPath();
            bctx.ellipse(0, 0, rX * 0.78, rY * 0.78, 0, -2.5, -0.8);
            bctx.stroke();

            bctx.restore();
          });
        }

        // Atmospheric stadium lighting: Summer Sun vs Night Floodlights vs Overcast Rainy Day
        if (isNight) {
          const nightVig = bctx.createRadialGradient(cssW * 0.5, cssH * 0.5, pw * 0.24, cssW * 0.5, cssH * 0.5, cssW * 0.72);
          nightVig.addColorStop(0, 'rgba(255, 252, 230, 0.05)');
          nightVig.addColorStop(0.62, 'rgba(6, 15, 28, 0.14)');
          nightVig.addColorStop(1, 'rgba(2, 6, 16, 0.56)');
          bctx.fillStyle = nightVig;
          bctx.fillRect(0, 0, cssW, cssH);

          const corners: [number, number][] = [
            [8, 8],
            [cssW - 8, 8],
            [8, cssH - 8],
            [cssW - 8, cssH - 8]
          ];
          corners.forEach(([fx, fy]) => {
            const cone = bctx.createRadialGradient(fx, fy, 2, cssW * 0.5, cssH * 0.5, cssW * 0.62);
            cone.addColorStop(0, isRainy ? 'rgba(215, 238, 255, 0.28)' : 'rgba(255, 248, 215, 0.3)');
            cone.addColorStop(0.32, isRainy ? 'rgba(186, 230, 253, 0.09)' : 'rgba(254, 243, 199, 0.1)');
            cone.addColorStop(1, 'rgba(255, 255, 255, 0)');
            bctx.fillStyle = cone;
            bctx.fillRect(0, 0, cssW, cssH);

            bctx.save();
            bctx.fillStyle = isRainy ? 'rgba(224, 242, 254, 0.92)' : 'rgba(254, 249, 195, 0.94)';
            bctx.shadowColor = isRainy ? '#7dd3fc' : '#fde047';
            bctx.shadowBlur = 10;
            bctx.beginPath();
            bctx.arc(fx, fy, 3.2, 0, Math.PI * 2);
            bctx.fill();
            bctx.restore();
          });
        } else if (!isRainy) {
          const sunX = cssW * (0.78 + Math.sin(env?.sunAngle ?? 0.4) * 0.12);
          const sunY = cssH * 0.06;
          const sunGlow = bctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, cssW * 0.72);
          sunGlow.addColorStop(0, 'rgba(255, 244, 179, 0.24)');
          sunGlow.addColorStop(0.35, 'rgba(253, 224, 71, 0.09)');
          sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
          bctx.fillStyle = sunGlow;
          bctx.fillRect(0, 0, cssW, cssH);

          bctx.save();
          const beamGrad = bctx.createLinearGradient(sunX, 0, cssW * 0.2, cssH);
          beamGrad.addColorStop(0, 'rgba(255, 246, 195, 0.1)');
          beamGrad.addColorStop(0.55, 'rgba(255, 246, 195, 0.03)');
          beamGrad.addColorStop(1, 'rgba(6, 26, 14, 0.14)');
          bctx.fillStyle = beamGrad;
          bctx.fillRect(0, 0, cssW, cssH);
          bctx.restore();
        } else {
          const sheen = bctx.createRadialGradient(cssW * 0.5, cssH * 0.5, pw * 0.12, cssW * 0.5, cssH * 0.5, pw * 0.68);
          sheen.addColorStop(0, 'rgba(215, 232, 238, 0.06)');
          sheen.addColorStop(1, 'rgba(4, 16, 11, 0.24)');
          bctx.fillStyle = sheen;
          bctx.fillRect(0, 0, cssW, cssH);
        }

        // 2. Pitch markings (crisper chalk on pro manicured turf, slightly worn on dirt-mixed grounds)
        const chalkAlpha = dirtMix > 0.35 ? 0.72 : dirtMix > 0.1 ? 0.82 : 0.9;
        bctx.strokeStyle = `rgba(242, 249, 242, ${chalkAlpha})`;
        bctx.lineWidth = Math.max(1.2, cssW * 0.0024);
        bctx.strokeRect(padX, padY, pw, ph);

        // Halfway line & center circle
        bctx.beginPath();
        bctx.moveTo(px(50), py(0));
        bctx.lineTo(px(50), py(100));
        bctx.stroke();

        bctx.beginPath();
        bctx.arc(px(50), py(50), ph * 0.155, 0, Math.PI * 2);
        bctx.stroke();

        bctx.fillStyle = 'rgba(240,248,240,0.9)';
        bctx.beginPath();
        bctx.arc(px(50), py(50), 2.5, 0, Math.PI * 2);
        bctx.fill();

        // Penalty boxes & 6-yard boxes
        const boxTop = py(21);
        const boxH = ph * 0.58;
        const boxW = pw * 0.165;
        const sixTop = py(36.5);
        const sixH = ph * 0.27;
        const sixW = pw * 0.055;

        bctx.strokeRect(padX, boxTop, boxW, boxH);
        bctx.strokeRect(padX + pw - boxW, boxTop, boxW, boxH);
        bctx.strokeRect(padX, sixTop, sixW, sixH);
        bctx.strokeRect(padX + pw - sixW, sixTop, sixW, sixH);

        // Penalty spots & arcs (D-arcs strictly outside each 18-yard box, intersecting box edge cleanly)
        const leftSpotX = px(11);
        const rightSpotX = px(89);
        const spotY = py(50);

        bctx.beginPath();
        bctx.arc(leftSpotX, spotY, 2, 0, Math.PI * 2);
        bctx.arc(rightSpotX, spotY, 2, 0, Math.PI * 2);
        bctx.fill();

        const leftBoxEdgeX = padX + boxW;
        const spotToBoxDx = Math.max(4, leftBoxEdgeX - leftSpotX);
        const penArcR = Math.max(spotToBoxDx * 1.44, ph * 0.145);
        const penArcAng = Math.acos(clamp(spotToBoxDx / penArcR, -0.96, 0.96));

        bctx.beginPath();
        bctx.arc(leftSpotX, spotY, penArcR, -penArcAng, penArcAng);
        bctx.stroke();
        bctx.beginPath();
        bctx.arc(rightSpotX, spotY, penArcR, Math.PI - penArcAng, Math.PI + penArcAng);
        bctx.stroke();

        // Corner arcs
        const cr = Math.max(5, ph * 0.032);
        [
          [padX, padY, 0, Math.PI / 2],
          [padX + pw, padY, Math.PI / 2, Math.PI],
          [padX + pw, padY + ph, Math.PI, Math.PI * 1.5],
          [padX, padY + ph, Math.PI * 1.5, Math.PI * 2]
        ].forEach(([cx, cy, sa, ea]) => {
          bctx.beginPath();
          bctx.arc(cx, cy, cr, sa, ea);
          bctx.stroke();
        });

        pitchBgCache = { key: bgKey, canvas: bgCanvas };
      }
    }
    if (pitchBgCache && pitchBgCache.key === bgKey) {
      ctx.drawImage(pitchBgCache.canvas, 0, 0, cssW, cssH);
    }
  }

  // Dynamic splash ripple when ball passes across a rainy-season puddle
  if (isRainy && env?.puddles?.length) {
    const ball = world.ball;
    if (ball.z < 3) {
      env.puddles.forEach((pd, idx) => {
        const distToBall = Math.hypot((ball.x - pd.x) / Math.max(1, pd.rx), (ball.y - pd.y) / Math.max(1, pd.ry));
        if (distToBall < 1.25) {
          const cxP = px(pd.x);
          const cyP = py(pd.y);
          const rX = Math.max(8, (pd.rx / 100) * pw);
          const rY = Math.max(5, (pd.ry / 100) * ph);
          const ripPhase = (world.minuteFloat * 40 + idx) % 1;
          ctx.save();
          ctx.translate(cxP, cyP);
          ctx.rotate(pd.rot);
          ctx.strokeStyle = `rgba(224, 242, 254, ${0.42 * (1 - ripPhase)})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.ellipse(0, 0, rX * (0.45 + ripPhase * 0.6), rY * (0.45 + ripPhase * 0.6), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });
    }
  }

  // Miracle Comeback Stadium Energy Pulse
  if (world.miracle && world.miracle.minsLeft > 0) {
    const pulse = 0.12 + 0.06 * Math.sin(world.minuteFloat * 8);
    const attRightMir = (world.miracle.side === 'H') !== world.secondHalf;
    const midX = px(50);
    const startX = attRightMir ? padX + pw : padX;
    const mGrad = getCachedCtxGradient(
      ctx,
      `mir|${attRightMir ? 1 : 0}|${startX.toFixed(1)}|${midX.toFixed(1)}`,
      () => {
        const g = ctx.createLinearGradient(startX, 0, midX, 0);
        g.addColorStop(0, 'rgba(250, 204, 21, 1)');
        g.addColorStop(1, 'rgba(250, 204, 21, 0)');
        return g;
      }
    );
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = mGrad;
    ctx.fillRect(padX, padY, pw, ph);
    ctx.restore();
  }

  // Goal frames & animated rippling nets
  const goalTop = py(42);
  const goalBot = py(58);
  const goalD = Math.max(9, padX * 0.55);
  const drawGoal = (isLeft: boolean, ripple: number) => {
    const gx = isLeft ? padX - goalD : padX + pw;
    const bulge = ripple > 0 ? Math.sin(ripple * 24) * 3.5 * ripple : 0;
    ctx.save();
    ctx.fillStyle = ripple > 0 ? 'rgba(245, 194, 66, 0.25)' : 'rgba(255, 255, 255, 0.14)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (isLeft) {
      ctx.moveTo(padX, goalTop);
      ctx.lineTo(gx - bulge, goalTop + 2);
      ctx.lineTo(gx - bulge, goalBot - 2);
      ctx.lineTo(padX, goalBot);
    } else {
      ctx.moveTo(padX + pw, goalTop);
      ctx.lineTo(gx + goalD + bulge, goalTop + 2);
      ctx.lineTo(gx + goalD + bulge, goalBot - 2);
      ctx.lineTo(padX + pw, goalBot);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  drawGoal(true, world.goalNetRippleLeft);
  drawGoal(false, world.goalNetRippleRight);

  // 2b. Sideline Dugouts (Substitutes Benches), Technical Areas, Warm-up Zones & Animated Coaches
  const coachSpeechDrawQueue: {
    c: LiveSidelineCoach;
    cx: number;
    cy: number;
    cr: number;
    kit: string;
    warmupPhase: number;
  }[] = [];
  if (world.sideline) {
    const sl = world.sideline;
    const touchBot = padY + ph;
    const apronH = Math.max(26, cssH - touchBot);
    const zoneH = clamp(apronH - 6, 20, 30);
    const zoneTop = touchBot + Math.max(2.5, (apronH - zoneH) * 0.5);
    const techH = zoneH;

    // Left (Home) & Right (Away) Technical Areas (FIFA-style dashed coach boxes flanking halfway line)
    const drawTechArea = (xStartPct: number, xEndPct: number, activeKit: string, trim: string) => {
      const tx0 = px(xStartPct);
      const tw = px(xEndPct) - tx0;
      ctx.save();
      ctx.fillStyle = 'rgba(6, 20, 13, 0.34)';
      ctx.beginPath();
      ctx.roundRect(tx0, zoneTop, tw, techH, 2.5);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.56)';
      ctx.lineWidth = 0.95;
      ctx.setLineDash([3, 2.2]);
      ctx.strokeRect(tx0 + 0.5, zoneTop + 0.5, tw - 1, techH - 1);
      ctx.setLineDash([]);

      // Subtle sideline team mat strip along the back edge of technical area
      ctx.fillStyle = activeKit;
      ctx.beginPath();
      ctx.roundRect(tx0 + 3, zoneTop + techH - 2.2, tw - 6, 1.4, 0.7);
      ctx.fill();
      ctx.fillStyle = trim;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(tx0 + 5, zoneTop + techH - 2.2, tw - 10, 0.55);
      ctx.restore();
    };
    drawTechArea(39.4, 47.4, homeKit, homeTrim);
    drawTechArea(52.6, 60.6, awayKit, awayTrim);

    // Team Dugouts / Substitutes Benches (Left = Home dugout, Right = Away dugout)
    const drawDugout = (xStartPct: number, xEndPct: number, kit: string, trim: string, seats: LiveBenchSeat[]) => {
      const bx = px(xStartPct);
      const bw = px(xEndPct) - bx;
      const by = zoneTop;
      const bh = zoneH;
      ctx.save();

      // Ground shadow under shelter
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.roundRect(bx + 1, by + 2, bw, bh, 5);
      ctx.fill();

      // Dugout shelter housing with subtle glass sheen
      const shellGrad = getCachedCtxGradient(
        ctx,
        `dugout|${by.toFixed(1)}|${bh.toFixed(1)}`,
        () => {
          const g = ctx.createLinearGradient(0, by, 0, by + bh);
          g.addColorStop(0, 'rgba(13, 35, 24, 0.96)');
          g.addColorStop(1, 'rgba(5, 16, 10, 0.94)');
          return g;
        }
      );
      ctx.fillStyle = shellGrad;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 5);
      ctx.fill();
      ctx.stroke();

      // Team-colored canopy roof bar + trim accent
      ctx.fillStyle = kit;
      ctx.beginPath();
      ctx.roundRect(bx + 2, by + 1.2, bw - 4, 2.6, 1.3);
      ctx.fill();
      ctx.fillStyle = trim;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(bx + 4, by + 3.4, bw - 8, 0.7);
      ctx.globalAlpha = 1;

      // Seated substitute players neatly inside 5 bucket seats
      const shown = seats.slice(0, 5);
      const seatCount = 5;
      const padInner = 4.5;
      const slotW = (bw - padInner * 2) / seatCount;
      const seatR = clamp(Math.min(slotW * 0.35, bh * 0.31), 4.0, 6.4);
      const seatY = by + bh * 0.55;

      for (let idx = 0; idx < seatCount; idx++) {
        const sx = bx + padInner + slotW * (idx + 0.5);
        const seat = shown[idx];

        // Bucket seat backrest & cushion base
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.roundRect(sx - seatR * 0.9, seatY - seatR * 0.92, seatR * 1.8, seatR * 1.84, 2.2);
        ctx.fill();
        ctx.stroke();

        if (!seat) continue;

        ctx.save();
        ctx.globalAlpha = seat.subbedOut ? 0.55 : 1;

        // Seated jersey circle backdrop
        ctx.fillStyle = kit;
        ctx.beginPath();
        ctx.arc(sx, seatY, seatR, 0, Math.PI * 2);
        ctx.fill();

        const seatFace = getPitchFaceCanvas(seat.vis, kit, trim);
        if (seatFace) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(sx, seatY, Math.max(1, seatR - 0.55), 0, Math.PI * 2);
          ctx.clip();
          const fw = seatR * 2.08;
          const fh = (fw * 68) / 64;
          ctx.drawImage(seatFace, sx - fw / 2, seatY - fh * 0.46, fw, fh);
          ctx.restore();
        }

        ctx.strokeStyle = seat.isMe ? '#facc15' : seat.subbedOut ? '#f43f5e' : '#ffffff';
        ctx.lineWidth = seat.isMe ? 1.5 : 1.0;
        ctx.beginPath();
        ctx.arc(sx, seatY, seatR, 0, Math.PI * 2);
        ctx.stroke();

        if (!seatFace) {
          ctx.fillStyle = colDist(kit, '#ffffff') < 110 ? '#111827' : '#ffffff';
          ctx.font = `800 ${Math.max(5.2, Math.round(seatR * 1.02))}px Sarabun, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(seat.no), sx, seatY + 0.3);
        } else {
          const noStr = String(seat.no);
          const nW = Math.max(7.2, noStr.length * 3.5 + 2.4);
          const nH = 6.2;
          const nx0 = clamp(sx + seatR * 0.1, sx - seatR, bx + bw - nW - 1.5);
          const ny0 = Math.min(seatY + seatR * 0.28, by + bh - nH - 1.2);
          ctx.fillStyle = 'rgba(9, 24, 17, 0.94)';
          ctx.strokeStyle = seat.subbedOut ? '#f43f5e' : kit;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.roundRect(nx0, ny0, nW, nH, 1.8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = seat.subbedOut ? '#fda4af' : '#ffd75e';
          ctx.font = '800 5.2px Sarabun, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(noStr, nx0 + nW / 2, ny0 + nH / 2 + 0.2);
        }
        if (seat.subbedOut) {
          ctx.globalAlpha = 1;
          const bxSub = sx - seatR * 0.72;
          const bySub = seatY - seatR * 0.72;
          const br = 3.5;
          ctx.fillStyle = '#f43f5e';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.arc(bxSub, bySub, br, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(bxSub, bySub + br * 0.54);
          ctx.lineTo(bxSub + br * 0.48, bySub - br * 0.05);
          ctx.lineTo(bxSub + br * 0.19, bySub - br * 0.05);
          ctx.lineTo(bxSub + br * 0.19, bySub - br * 0.55);
          ctx.lineTo(bxSub - br * 0.19, bySub - br * 0.55);
          ctx.lineTo(bxSub - br * 0.19, bySub - br * 0.05);
          ctx.lineTo(bxSub - br * 0.48, bySub - br * 0.05);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();
    };

    drawDugout(15.5, 36.2, homeKit, homeTrim, sl.benchH);
    drawDugout(63.8, 84.5, awayKit, awayTrim, sl.benchA);

    // Dedicated Sideline Warm-up Zones & Animated Warming-up Substitutes (Home = Left, Away = Right)
    const drawWarmupZone = (
      side: 'H' | 'A',
      xStartPct: number,
      xEndPct: number,
      bench: LiveBenchSeat[],
      kit: string,
      trim: string
    ) => {
      const zx = px(xStartPct);
      const zw = px(xEndPct) - zx;
      const zy = zoneTop;
      const zh = zoneH;
      const bibColor =
        side === 'H'
          ? colDist(kit, '#a3e635') < 95
            ? '#facc15'
            : '#a3e635'
          : colDist(kit, '#38bdf8') < 95
            ? '#f472b6'
            : '#38bdf8';

      ctx.save();
      // Artificial-turf warm-up mat
      ctx.fillStyle = 'rgba(22, 163, 74, 0.2)';
      ctx.beginPath();
      ctx.roundRect(zx, zy, zw, zh, 4.5);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 0.9;
      ctx.setLineDash([3, 2.5]);
      ctx.beginPath();
      ctx.roundRect(zx + 0.5, zy + 0.5, zw - 1, zh - 1, 4.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tiny orange training cones at both ends of the warm-up lane
      const coneY = zy + zh * 0.52;
      [zx + 4.5, zx + zw - 4.5].forEach((cxCone) => {
        ctx.fillStyle = '#fb923c';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(cxCone, coneY - 2.4);
        ctx.lineTo(cxCone + 2.1, coneY + 1.6);
        ctx.lineTo(cxCone - 2.1, coneY + 1.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      const activeSubs = bench.filter((b) => !b.subbedOut).slice(0, 2);
      const wr = clamp(Math.min(zw * 0.14, zh * 0.3), 4.0, 6.2);
      const laneW = Math.max(8, zw - 15);

      activeSubs.forEach((cand, idx) => {
        const slotCenter =
          activeSubs.length === 1
            ? zx + zw * 0.5
            : zx + 7.5 + laneW * (idx === 0 ? 0.3 : 0.72);
        const phase = sl.warmupPhase + (side === 'H' ? 0 : 1.9) + idx * 1.65;
        const maxDrift = Math.max(2, laneW * (activeSubs.length === 1 ? 0.22 : 0.09));
        const wx = slotCenter + Math.sin(phase) * maxDrift;
        const bounce = Math.abs(Math.sin(phase * 2.1)) * 1.2;
        const wy = zy + zh * 0.5 - bounce * 0.4;
        const jogStep = Math.sin(phase * 2.4) * (wr * 0.32);

        ctx.save();
        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
        ctx.beginPath();
        ctx.ellipse(wx, wy + wr * 0.85 + bounce * 0.3, wr * 0.85, wr * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Animated jogging boots
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(wx - wr * 0.3 + jogStep, wy + wr * 0.68, wr * 0.21, 0, Math.PI * 2);
        ctx.arc(wx + wr * 0.3 - jogStep, wy + wr * 0.68, wr * 0.21, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Training bib circle backdrop
        ctx.fillStyle = bibColor;
        ctx.beginPath();
        ctx.arc(wx, wy, wr, 0, Math.PI * 2);
        ctx.fill();

        const warmFace = getPitchFaceCanvas(cand.vis, bibColor, kit);
        if (warmFace) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(wx, wy, Math.max(1, wr - 0.7), 0, Math.PI * 2);
          ctx.clip();
          const fw = wr * 2.08;
          const fh = (fw * 68) / 64;
          ctx.drawImage(warmFace, wx - fw / 2, wy - fh * 0.46, fw, fh);
          ctx.restore();
        }

        ctx.strokeStyle = cand.isMe ? '#facc15' : '#ffffff';
        ctx.lineWidth = cand.isMe ? 1.5 : 1.05;
        ctx.beginPath();
        ctx.arc(wx, wy, wr, 0, Math.PI * 2);
        ctx.stroke();

        if (!warmFace) {
          ctx.fillStyle = '#0f172a';
          ctx.font = `800 ${Math.max(5.2, Math.round(wr * 1.0))}px Sarabun, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(cand.no), wx, wy + 0.3);
        } else {
          const noStr = String(cand.no);
          const nW = Math.max(7.2, noStr.length * 3.5 + 2.4);
          const nH = 6.2;
          const nx0 = wx + wr * 0.12;
          const ny0 = Math.min(wy + wr * 0.22, zy + zh - nH - 1.5);
          ctx.fillStyle = 'rgba(9, 24, 17, 0.94)';
          ctx.strokeStyle = bibColor;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.roundRect(nx0, ny0, nW, nH, 1.8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ffd75e';
          ctx.font = '800 5.2px Sarabun, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(noStr, nx0 + nW / 2, ny0 + nH / 2 + 0.2);
        }
        ctx.restore();
      });

      ctx.restore();
    };
    drawWarmupZone('H', 4.0, 13.5, sl.benchH, homeKit, homeTrim);
    drawWarmupZone('A', 86.5, 96.0, sl.benchA, awayKit, awayTrim);

    // Animated Head Coaches standing cleanly inside their Technical Areas
    const drawCoach = (c: LiveSidelineCoach, kit: string, trim: string) => {
      const cr = clamp(Math.min(cssW * 0.0155, zoneH * 0.36), 6.8, 8.6);
      const cx = px(c.x);
      const cy = zoneTop + techH * 0.48;
      const speed = Math.hypot(c.tx - c.x, c.ty - c.y);
      const paceStep = speed > 0.3 ? Math.sin(c.pacePhase) * (cr * 0.34) : 0;
      const coachVis =
        c.vis && c.vis.length >= 6
          ? c.vis
          : [c.side === 'H' ? 2 : 1, c.side === 'H' ? 0 : 5, c.side === 'H' ? 5 : 2, c.side === 'H' ? 1 : 0, 1, 0, c.side === 'H' ? 2 : 0, 0];

      ctx.save();
      ctx.translate(cx, cy);

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      ctx.ellipse(0, cr * 0.85, cr * 0.95, cr * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pacing shoes
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(-cr * 0.34 + paceStep, cr * 0.66, cr * 0.24, 0, Math.PI * 2);
      ctx.arc(cr * 0.34 - paceStep, cr * 0.66, cr * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const outfitCfg = COACH_OUTFITS.find((o) => o.id === (c.outfit || 'suit_navy')) || COACH_OUTFITS[0];
      const sleeveCol = outfitCfg.mode === 'tracksuit' || outfitCfg.mode === 'polo' ? kit : outfitCfg.coat;

      // Tactical coaching arm gesture (pointing / waving instructions)
      if (c.gestureTimer > 0 || (c.shoutTimer > 0 && c.shoutText)) {
        const wave = Math.sin(sl.warmupPhase * 2.4) * 0.38;
        const armAng = c.facing + wave;
        ctx.strokeStyle = sleeveCol;
        ctx.lineWidth = 2.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(armAng) * cr * 1.4, Math.sin(armAng) * cr * 1.4);
        ctx.stroke();
        ctx.fillStyle = '#f1c27d';
        ctx.beginPath();
        ctx.arc(Math.cos(armAng) * cr * 1.4, Math.sin(armAng) * cr * 1.4, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Suit / Manager jacket shoulders
      ctx.fillStyle = sleeveCol;
      ctx.beginPath();
      ctx.arc(0, 0, cr, 0, Math.PI * 2);
      ctx.fill();

      // Manager portrait face clipped inside outfit frame
      const tieCol = c.tieColor || trim;
      const coachFace = getPitchFaceCanvas(coachVis, '#1e293b', tieCol, true, c.outfit || 'suit_navy', kit);
      if (coachFace) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, cr - 0.85), 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#3f5c4e';
        ctx.fillRect(-cr, -cr, cr * 2, cr * 2);
        const fw = cr * 2.08;
        const fh = (fw * 68) / 64;
        ctx.drawImage(coachFace, -fw / 2, -fh * 0.5, fw, fh);
        ctx.restore();
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(-cr * 0.36, cr * 0.36);
        ctx.lineTo(cr * 0.36, cr * 0.36);
        ctx.lineTo(0, cr * 0.88);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = colDist(tieCol, '#f8fafc') < 90 ? '#b91c1c' : tieCol;
        ctx.beginPath();
        ctx.moveTo(-cr * 0.11, cr * 0.42);
        ctx.lineTo(cr * 0.11, cr * 0.42);
        ctx.lineTo(0, cr * 0.86);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f1c27d';
        ctx.beginPath();
        ctx.arc(0, -cr * 0.12, cr * 0.46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c.side === 'H' ? '#1f2937' : '#334155';
        ctx.beginPath();
        ctx.arc(0, -cr * 0.22, cr * 0.44, Math.PI * 0.9, Math.PI * 2.1);
        ctx.fill();
      }

      // Outer golden halo ring for the user's coach
      if (c.isUserCoach) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.52)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, cr + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crisp suit ring
      ctx.strokeStyle = c.isUserCoach ? '#facc15' : trim;
      ctx.lineWidth = c.isUserCoach ? 1.7 : 1.3;
      ctx.beginPath();
      ctx.arc(0, 0, cr, 0, Math.PI * 2);
      ctx.stroke();

      // User coach circular star badge ("★") matching MyTeamBadge, anchored at the bottom-left corner
      if (c.isUserCoach) {
        const starR = clamp(cr * 0.42, 4.4, 6.0);
        const bx = Math.max(-cx + starR + 2, -cr * 0.74);
        const by = Math.min(cssH - cy - starR - 1.5, cr * 0.74);
        ctx.fillStyle = '#f5c242';
        ctx.strokeStyle = '#05180e';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(bx, by, starR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#261900';
        ctx.font = `900 ${Math.max(7, Math.round(starR * 1.48))}px Sarabun, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', bx, by + 0.45);
      }

      ctx.restore();
      coachSpeechDrawQueue.push({ c, cx, cy, cr, kit, warmupPhase: sl.warmupPhase });
    };

    drawCoach(sl.coachH, homeKit, homeTrim);
    drawCoach(sl.coachA, awayKit, awayTrim);
  }

  // 3. Visual FX under players (Offside line, Foul ring, Free kick wall spray & barrier, Slides, One-Two, Clashes)
  if (world.pendingSetPiece?.type === 'freekick' && world.pendingSetPiece.wallPlayers?.length) {
    const spFk = world.pendingSetPiece;
    const wallPts = spFk.wallPlayers!;
    ctx.save();
    // Vanishing spray arc around ball spot
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(px(spFk.x), py(spFk.y), 9, 0, Math.PI * 2);
    ctx.stroke();
    // Vanishing foam spray line in front of wall
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(px(wallPts[0].x), py(wallPts[0].y));
    ctx.lineTo(px(wallPts[wallPts.length - 1].x), py(wallPts[wallPts.length - 1].y));
    ctx.stroke();
    // Compact wall badge
    const midWallX = (px(wallPts[0].x) + px(wallPts[wallPts.length - 1].x)) * 0.5;
    const topWallY = Math.min(py(wallPts[0].y), py(wallPts[wallPts.length - 1].y)) - 15;
    ctx.setLineDash([]);
    ctx.font = '700 8.5px "Noto Sans Thai", sans-serif';
    ctx.fillStyle = 'rgba(8, 20, 14, 0.9)';
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.roundRect(midWallX - 25, topWallY - 7, 50, 14, 4.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧱 กำแพง', midWallX, topWallY + 0.3);
    ctx.restore();
  }
  if (world.pendingSetPiece?.type === 'throwin') {
    const spTh = world.pendingSetPiece;
    const tx = px(spTh.x);
    const ty = py(spTh.y);
    const isTop = spTh.y < 50;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '700 8.5px "Noto Sans Thai", sans-serif';
    ctx.fillStyle = 'rgba(8, 20, 14, 0.9)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
    ctx.lineWidth = 0.85;
    const thX = clamp(tx - 22, 6, cssW - 50);
    const thY = ty + (isTop ? 10 : -23);
    ctx.beginPath();
    ctx.roundRect(thX, thY, 44, 14, 4.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🤲 ทุ่ม', thX + 22, thY + 7.3);
    ctx.restore();
  }
  world.fx.forEach((fx) => {
    const alpha = clamp(fx.ttl / fx.maxTtl, 0, 1);
    if (fx.type === 'offside' && fx.offsideX != null) {
      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.95})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(px(fx.offsideX), padY);
      ctx.lineTo(px(fx.offsideX), padY + ph);
      ctx.stroke();
      ctx.restore();
    }
    if ((fx.type === 'onetwo' || fx.type === 'through' || fx.type === 'cutback' || fx.type === 'trivela' || fx.type === 'cutinside' || fx.type === 'solo' || fx.type === 'throwin') && fx.toX != null && fx.toY != null) {
      const sx = px(fx.x);
      const sy = py(fx.y);
      const ex = px(fx.toX);
      const ey = py(fx.toY);
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle =
        fx.type === 'onetwo'
          ? '#34d399'
          : fx.type === 'cutback'
            ? '#2dd4bf'
            : fx.type === 'trivela'
              ? '#fb923c'
              : fx.type === 'cutinside'
                ? '#e879f9'
                : fx.type === 'solo'
                  ? '#fbbf24'
                  : fx.type === 'throwin'
                    ? '#38bdf8'
                    : '#facc15';
      ctx.lineWidth = fx.type === 'solo' || fx.type === 'cutback' ? 2.6 : 2.2;
      ctx.setLineDash(fx.type === 'trivela' || fx.type === 'cutinside' ? [] : [5, 3]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      if (fx.type === 'trivela' || fx.type === 'cutinside') {
        const bend = fx.type === 'trivela' ? (sy < ph * 0.5 + padY ? -22 : 22) : (sy < ph * 0.5 + padY ? 18 : -18);
        ctx.quadraticCurveTo((sx + ex) * 0.5, (sy + ey) * 0.5 + bend, ex, ey);
      } else {
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (fx.type === 'dragback' || fx.type === 'press') {
      const cx0 = px(fx.x);
      const cy0 = py(fx.y);
      const rad0 = 8 + (1 - alpha) * (fx.type === 'press' ? 20 : 13);
      ctx.save();
      ctx.globalAlpha = alpha * 0.88;
      ctx.strokeStyle = fx.type === 'press' ? '#f43f5e' : '#facc15';
      ctx.lineWidth = 2.2;
      ctx.setLineDash(fx.type === 'press' ? [4, 3] : [3, 2]);
      ctx.beginPath();
      ctx.arc(cx0, cy0, rad0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (fx.type === 'slide') {
      const ex = px(fx.toX ?? fx.x + 3);
      const ey = py(fx.toY ?? fx.y + 1);
      const sx = px(fx.x);
      const sy = py(fx.y);
      ctx.save();
      ctx.globalAlpha = alpha * 0.88;
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.78)';
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - (ex - sx) * 0.45, sy - (ey - sy) * 0.45 - 2);
      ctx.lineTo(ex, ey - 2);
      ctx.moveTo(sx - (ex - sx) * 0.45, sy - (ey - sy) * 0.45 + 2.5);
      ctx.lineTo(ex, ey + 2.5);
      ctx.stroke();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, 6 + (1 - alpha) * 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (fx.type === 'clash') {
      const rad = 7 + (1 - alpha) * 17;
      ctx.save();
      ctx.globalAlpha = alpha * 0.92;
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(px(fx.x) - 3, py(fx.y), rad * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(px(fx.x) + 3, py(fx.y), rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (fx.type === 'injury') {
      const ix = px(fx.x);
      const iy = py(fx.y);
      ctx.save();
      ctx.globalAlpha = alpha * 0.96;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(ix, iy, 11 + (1 - alpha) * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ix - 5.5, iy - 1.8, 11, 3.6);
      ctx.fillRect(ix - 1.8, iy - 5.5, 3.6, 11);
      ctx.restore();
    } else if (fx.type === 'slip') {
      const sx = px(fx.x);
      const sy = py(fx.y);
      ctx.save();
      ctx.globalAlpha = alpha * 0.92;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 10 + (1 - alpha) * 12, 5 + (1 - alpha) * 6, -0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(134, 239, 172, 0.8)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx - 9, sy + 4);
      ctx.lineTo(sx + 7, sy - 2);
      ctx.stroke();
      ctx.restore();
    } else if (fx.type === 'whiff') {
      const wx = px(fx.x);
      const wy = py(fx.y);
      const expand = (1 - alpha) * 18 + 7;
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(wx, wy, expand, -Math.PI * 0.75, Math.PI * 0.65);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(wx, wy, expand * 0.68, -Math.PI * 0.4, Math.PI * 0.45);
      ctx.stroke();
      ctx.restore();
    } else if (fx.type === 'kick_burst') {
      const kx = px(fx.x);
      const ky = py(fx.y);
      const dir = Math.atan2(py(fx.toY ?? fx.y) - ky, px(fx.toX ?? fx.x + 5) - kx);
      const prog = 1 - alpha;
      const ringR = 5 + prog * 18;
      ctx.save();
      ctx.globalAlpha = alpha * 0.95;
      ctx.strokeStyle = fx.color || '#fde047';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(kx, ky, ringR, dir - 0.95, dir + 0.95);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.8;
      for (let ray = -1; ray <= 1; ray++) {
        const ra = dir + ray * 0.38;
        const r0 = 4 + prog * 6;
        const r1 = 11 + prog * 16;
        ctx.beginPath();
        ctx.moveTo(kx + Math.cos(ra) * r0, ky + Math.sin(ra) * r0);
        ctx.lineTo(kx + Math.cos(ra) * r1, ky + Math.sin(ra) * r1);
        ctx.stroke();
      }
      ctx.restore();
    } else if (fx.type === 'sub') {
      const sx = px(fx.x);
      const sy = py(fx.y);
      const prog = 1 - alpha;
      ctx.save();
      ctx.globalAlpha = alpha * 0.92;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 8 + prog * 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, 5 + prog * 15, -prog * 3, Math.PI * 2 - prog * 3);
      ctx.stroke();
      ctx.setLineDash([]);

      // Upward emerald arrow (IN) + downward rose arrow (OUT)
      const shift = prog * 10;
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(sx - 10, sy - 6 - shift);
      ctx.lineTo(sx - 5.5, sy - 0.5 - shift);
      ctx.lineTo(sx - 8, sy - 0.5 - shift);
      ctx.lineTo(sx - 8, sy + 5 - shift);
      ctx.lineTo(sx - 12, sy + 5 - shift);
      ctx.lineTo(sx - 12, sy - 0.5 - shift);
      ctx.lineTo(sx - 14.5, sy - 0.5 - shift);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.moveTo(sx + 10, sy + 6 + shift);
      ctx.lineTo(sx + 5.5, sy + 0.5 + shift);
      ctx.lineTo(sx + 8, sy + 0.5 + shift);
      ctx.lineTo(sx + 8, sy - 5 + shift);
      ctx.lineTo(sx + 12, sy - 5 + shift);
      ctx.lineTo(sx + 12, sy + 0.5 + shift);
      ctx.lineTo(sx + 14.5, sy + 0.5 + shift);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (
      fx.type === 'foul' ||
      fx.type === 'save' ||
      fx.type === 'block' ||
      fx.type === 'woodwork' ||
      fx.type === 'goal' ||
      fx.type === 'skill' ||
      fx.type === 'tackle' ||
      fx.type === 'penalty'
    ) {
      const expand = (1 - alpha) * (fx.type === 'goal' ? 32 : fx.type === 'skill' || fx.type === 'tackle' ? 22 : 18) + 6;
      ctx.save();
      ctx.strokeStyle = fx.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = fx.type === 'skill' || fx.type === 'tackle' ? 2.5 : 2.2;
      if (fx.type === 'skill') ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(px(fx.x), py(fx.y), expand, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });

  // 4. Off-ball run arrows ("ทำทาง") + Pass / Shot trajectory line
  if (showRunVectors) {
    world.agents.forEach((ag) => {
      if (ag.sentOff || (ag.intent !== 'MAKE_RUN' && ag.intent !== 'OVERLAP')) return;
      if (ag.runToX == null || ag.runToY == null) return;
      const dist = Math.hypot(ag.runToX - ag.x, ag.runToY - ag.y);
      if (dist < 4) return;
      const sx = px(ag.x);
      const sy = py(ag.y);
      const ex = px(ag.runToX);
      const ey = py(ag.runToY);
      ctx.save();
      ctx.strokeStyle = ag.intent === 'OVERLAP' ? 'rgba(56, 189, 248, 0.72)' : 'rgba(250, 204, 21, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Arrowhead
      const ang = Math.atan2(ey - sy, ex - sx);
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.5) * 6, ey - Math.sin(ang - 0.5) * 6);
      ctx.lineTo(ex - Math.cos(ang + 0.5) * 6, ey - Math.sin(ang + 0.5) * 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  // Ball trail & target line when in flight
  const b = world.ball;
  if (!b.carrierId && b.flightType !== 'carry' && b.flightType !== 'bounce') {
    const startPx = px(b.fromX);
    const startPy = py(b.fromY);
    const endPx = px(b.toX);
    const endPy = py(b.toY);
    const midX = (startPx + endPx) * 0.5;
    const midY = (startPy + endPy) * 0.5 + b.curve * (ph / 100);
    const isSpecialShot =
      b.shotStyle === 'bicycle' ||
      b.shotStyle === 'volley' ||
      b.shotStyle === 'curler' ||
      b.shotStyle === 'trivela' ||
      b.shotStyle === 'knuckle' ||
      b.shotStyle === 'diving_header' ||
      b.shotStyle === 'deflected' ||
      b.shotStyle === 'screamer';
    ctx.save();
    ctx.strokeStyle =
      b.flightType === 'shot' || b.flightType === 'freekick'
        ? b.shotStyle === 'deflected'
          ? 'rgba(251, 146, 60, 0.85)'
          : b.shotStyle === 'curler'
            ? 'rgba(56, 189, 248, 0.75)'
            : b.shotStyle === 'trivela'
              ? 'rgba(249, 115, 22, 0.78)'
              : b.shotStyle === 'knuckle'
                ? 'rgba(192, 132, 252, 0.78)'
                : b.shotStyle === 'header' || b.shotStyle === 'diving_header'
                  ? 'rgba(253, 224, 71, 0.72)'
                  : isSpecialShot
                    ? 'rgba(251, 191, 36, 0.78)'
                    : 'rgba(248, 113, 113, 0.55)'
        : b.flightType === 'onetwo'
          ? 'rgba(52, 211, 153, 0.72)'
          : b.flightType === 'cutback'
            ? 'rgba(45, 212, 191, 0.85)'
            : b.flightType === 'trivela_pass'
              ? 'rgba(249, 115, 22, 0.85)'
              : b.flightType === 'throwin'
                ? 'rgba(56, 189, 248, 0.72)'
                : b.flightType === 'through'
                  ? 'rgba(250, 204, 21, 0.68)'
                  : b.flightType === 'lofted' || b.flightType === 'cross' || b.flightType === 'corner'
                    ? 'rgba(96, 165, 250, 0.62)'
                    : 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = isSpecialShot || b.flightType === 'cutback' || b.flightType === 'trivela_pass' ? 2.5 : b.flightType === 'onetwo' || b.flightType === 'through' || b.flightType === 'shot' ? 2 : 1.4;
    ctx.setLineDash(b.flightType === 'onetwo' ? [6, 3] : b.flightType === 'trivela_pass' ? [] : [4, 4]);
    ctx.beginPath();
    ctx.moveTo(startPx, startPy);
    ctx.quadraticCurveTo(midX, midY, endPx, endPy);
    ctx.stroke();
    ctx.restore();
  }

  if (b.trail.length > 1) {
    for (let i = 1; i < b.trail.length; i++) {
      const p0 = b.trail[i - 1];
      const p1 = b.trail[i];
      const a = (i / b.trail.length) * 0.72;
      ctx.strokeStyle =
        b.shotStyle === 'deflected'
          ? `rgba(251, 146, 60, ${Math.min(0.92, a + 0.15)})`
          : b.shotStyle === 'curler'
            ? `rgba(56, 189, 248, ${a})`
            : b.shotStyle === 'trivela'
              ? `rgba(249, 115, 22, ${a})`
              : b.shotStyle === 'knuckle'
                ? `rgba(216, 180, 254, ${a})`
                : b.shotStyle === 'bicycle' || b.shotStyle === 'volley' || b.shotStyle === 'screamer' || b.shotStyle === 'diving_header'
                  ? `rgba(251, 191, 36, ${a})`
                  : b.shotStyle === 'header'
                    ? `rgba(125, 211, 252, ${a})`
                    : b.flightType === 'onetwo'
                      ? `rgba(52, 211, 153, ${a})`
                      : b.flightType === 'cutback'
                        ? `rgba(45, 212, 191, ${Math.min(0.92, a + 0.14)})`
                        : b.flightType === 'trivela_pass'
                          ? `rgba(249, 115, 22, ${Math.min(0.92, a + 0.14)})`
                          : b.flightType === 'throwin'
                            ? `rgba(56, 189, 248, ${a})`
                            : b.flightType === 'through'
                              ? `rgba(250, 204, 21, ${a})`
                              : b.flightType === 'lofted' || b.flightType === 'cross' || b.flightType === 'corner'
                                ? `rgba(147, 197, 253, ${a * 0.85})`
                                : b.flightType === 'shot'
                                  ? `rgba(254, 240, 138, ${a})`
                                  : `rgba(255, 255, 255, ${a * 0.7})`;
      ctx.lineWidth = 1.6 + (i / b.trail.length) * (b.flightType === 'shot' || b.flightType === 'freekick' ? 3.2 : 2.1);
      ctx.beginPath();
      ctx.moveTo(px(p0.x), py(p0.y) - p0.z * 0.78);
      ctx.lineTo(px(p1.x), py(p1.y) - p1.z * 0.78);
      ctx.stroke();
    }
  }

  // 5. Render 22 Players with natural running strides, orientation, GK dives, stamina, portraits & labels
  const playerRadius = clamp(cssW * 0.018, 9, 13.5);
  sortedAgentsBuf.length = 0;
  for (let i = 0; i < world.agents.length; i++) {
    if (!world.agents[i].sentOff) sortedAgentsBuf.push(world.agents[i]);
  }
  sortedAgentsBuf.sort((a, b2) => a.y - b2.y);

  sortedAgentsBuf.forEach((ag) => {
    const cx = px(ag.x);
    const cy = py(ag.y);
    const speed = Math.hypot(ag.vx, ag.vy);
    const strideSin = Math.sin(ag.stride) * clamp(speed / 12, 0, 1);
    const isCarrier = b.carrierId === ag.id;
    const isTarget = b.targetId === ag.id;
    const kit = ag.pos === 'GK' ? (ag.side === 'H' ? homeGkKit : awayGkKit) : ag.side === 'H' ? homeKit : awayKit;
    const trim = ag.pos === 'GK' ? '#ffffff' : ag.side === 'H' ? homeTrim : awayTrim;

    ctx.save();
    ctx.translate(cx, cy);

    // Divine blessing / hot-streak golden halo aura (can occur on either team!)
    const isBlessed = (ag.blessedMins ?? 0) > 0;
    if (isBlessed) {
      const bPulse = 0.65 + 0.3 * Math.sin(world.minuteFloat * 10 + ag.slotIndex);
      const auraSprite = getBlessedAuraSprite(playerRadius);
      if (auraSprite) {
        const auraR = Math.max(8, Math.round(playerRadius * 2)) / 2 + 10;
        ctx.save();
        ctx.globalAlpha = bPulse;
        ctx.drawImage(auraSprite, -auraR, -auraR, auraR * 2, auraR * 2);
        ctx.restore();
      }

      ctx.strokeStyle = `rgba(253, 224, 71, ${0.9 * bPulse})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 6.5, 0, Math.PI * 2);
      ctx.stroke();

      // Orbiting 3 starlight sparks
      for (let g = 0; g < 3; g++) {
        const ang = world.minuteFloat * 4.2 + ag.slotIndex + (g * Math.PI * 2) / 3;
        const gx = Math.cos(ang) * (playerRadius + 7.2);
        const gy = Math.sin(ang) * (playerRadius + 7.2);
        ctx.fillStyle = g % 2 === 0 ? '#fef08a' : '#6ee7b7';
        ctx.beginPath();
        ctx.arc(gx, gy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Carrier or "Me" highlight ring
    if (ag.isMe) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 4.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isCarrier) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 3.8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isTarget) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 3.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (ag.intent === 'PRESS') {
      const pulse = 0.55 + Math.sin(world.minuteFloat * 14 + ag.slotIndex) * 0.25;
      ctx.strokeStyle = `rgba(244, 63, 94, ${pulse})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 5.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (ag.subEnterTimer && ag.subEnterTimer > 0) {
      const subMax = Math.max(0.4, ag.subEnterMax || 2.4);
      const subAlpha = clamp(ag.subEnterTimer / subMax, 0, 1);
      const subProg = 1 - subAlpha;
      const enterPop = subProg < 0.22 ? 0.72 + Math.sin((subProg / 0.22) * (Math.PI * 0.65)) * 0.42 : 1 + Math.sin(subProg * Math.PI * 3) * 0.06 * subAlpha;
      ctx.scale(enterPop, enterPop);
      const pulseRad = playerRadius + 4 + ((subProg * 2.2) % 1) * 11;
      ctx.strokeStyle = `rgba(16, 185, 129, ${(subAlpha * 0.92).toFixed(2)})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, pulseRad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(56, 189, 248, ${(subAlpha * 0.75).toFixed(2)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ground shadow (scales smaller & softens slightly during aerial leaps & goal celebration jumps)
    const isJumpAcrobat =
      (ag.acrobatTimer ?? 0) > 0 &&
      (ag.acrobatType === 'header' || ag.acrobatType === 'bicycle' || ag.acrobatType === 'diving_header' || ag.acrobatType === 'volley');
    const jumpProg = isJumpAcrobat ? clamp(1 - (ag.acrobatTimer ?? 0) / Math.max(0.2, ag.acrobatMax || 0.72), 0, 1) : 0;
    const celebPhase = clamp(ag.celebratePhase ?? 0, 0, 1);
    const isScorerAerialCeleb =
      ag.intent === 'CELEBRATE' &&
      ag.celebrateRole === 'scorer' &&
      ((ag.celebratePose === 'siu_jump' && celebPhase >= 0.34 && celebPhase <= 0.76) ||
        (ag.celebratePose === 'backflip' && celebPhase >= 0.28 && celebPhase <= 0.84));
    const celebAirProg = isScorerAerialCeleb
      ? ag.celebratePose === 'siu_jump'
        ? clamp((celebPhase - 0.34) / 0.42, 0, 1)
        : clamp((celebPhase - 0.28) / 0.56, 0, 1)
      : 0;
    const celebHopArc =
      ag.intent === 'CELEBRATE' &&
      (ag.celebrateRole === 'teammate' || ag.celebrateRole === 'assister' || ag.celebrateRole === 'gk') &&
      ag.celebratePose !== 'calm_shush'
        ? Math.abs(Math.sin((world.celebration?.elapsed ?? world.minuteFloat) * 10 + ag.slotIndex * 1.1)) * 0.38
        : 0;
    const jumpArc = Math.max(isJumpAcrobat ? Math.sin(jumpProg * Math.PI) : 0, Math.sin(celebAirProg * Math.PI), celebHopArc);
    const shadowScale = 1 - 0.24 * jumpArc;
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.32 - 0.11 * jumpArc).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(0, playerRadius * (0.82 + 0.12 * jumpArc), playerRadius * 0.92 * shadowScale, playerRadius * 0.36 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sprint turf wake specks behind fast-running players
    const cosF = Math.cos(ag.facing);
    const sinF = Math.sin(ag.facing);
    if (speed > 13.5 && ag.intent !== 'DIVE' && ag.acrobatType !== 'slip') {
      const dustPhase = (ag.stride * 0.7) % 1;
      const d1 = playerRadius * (0.88 + dustPhase * 0.65);
      const d2 = playerRadius * (1.2 + ((dustPhase + 0.5) % 1) * 0.55);
      ctx.fillStyle = 'rgba(220, 252, 231, 0.36)';
      ctx.beginPath();
      ctx.arc(-cosF * d1 + sinF * 2.2, -sinF * d1 - cosF * 2.2 + playerRadius * 0.38, 1.7, 0, Math.PI * 2);
      ctx.arc(-cosF * d2 - sinF * 2.4, -sinF * d2 + cosF * 2.4 + playerRadius * 0.38, 1.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // GK diving stretch offset & extended gloves
    if (ag.intent === 'DIVE' && ag.diveProgress > 0) {
      const diveSin = Math.sin(ag.diveProgress * Math.PI);
      const diveShiftY = ag.diveDir * diveSin * playerRadius * 0.65;
      ctx.translate(0, diveShiftY);
      ctx.rotate(ag.diveDir * diveSin * 0.72);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, ag.diveDir * (playerRadius * 1.15), playerRadius * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Wall defenders stance / brace jump cue
    if (ag.intent === 'WALL') {
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Acrobatics / Skill move / Duel / Slide / Super Save visual flair (distinct animations!)
    if (ag.acrobatTimer && ag.acrobatTimer > 0) {
      const maxAc = Math.max(0.2, ag.acrobatMax || 0.72);
      const prog = clamp(1 - ag.acrobatTimer / maxAc, 0, 1);
      const acAlpha = clamp(ag.acrobatTimer / maxAc, 0, 1);
      const arcEnv = Math.sin(prog * Math.PI);

      if (ag.acrobatType === 'bicycle') {
        ctx.translate(0, -playerRadius * 0.95 * arcEnv);
        ctx.rotate(-1.35 * arcEnv);
        ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 6, -Math.PI * 0.9, Math.PI * 0.3);
        ctx.stroke();
        ctx.strokeStyle = `rgba(251, 146, 60, ${acAlpha * 0.85})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 9.5, -Math.PI * 0.7, Math.PI * 0.2);
        ctx.stroke();
      } else if (ag.acrobatType === 'volley') {
        ctx.translate(0, -playerRadius * 0.35 * arcEnv);
        ctx.rotate(0.58 * arcEnv);
        ctx.strokeStyle = `rgba(251, 146, 60, ${acAlpha * 0.92})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 5, -Math.PI * 0.35, Math.PI * 0.45);
        ctx.stroke();
      } else if (ag.acrobatType === 'header') {
        const leapY = -playerRadius * 0.76 * arcEnv;
        const lungeX = Math.cos(ag.facing) * playerRadius * 0.38 * arcEnv;
        const lungeY = Math.sin(ag.facing) * playerRadius * 0.38 * arcEnv;
        const jumpScale = 1 + 0.16 * arcEnv;
        ctx.translate(lungeX, leapY + lungeY);
        ctx.scale(jumpScale, jumpScale);
        ctx.strokeStyle = `rgba(253, 224, 71, ${acAlpha * 0.92})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 4.5 + prog * 4, ag.facing - 0.9, ag.facing + 0.9);
        ctx.stroke();
      } else if (ag.acrobatType === 'diving_header') {
        const divePush = playerRadius * 0.95 * arcEnv;
        ctx.translate(Math.cos(ag.facing) * divePush, Math.sin(ag.facing) * divePush - playerRadius * 0.36 * arcEnv);
        ctx.rotate(Math.cos(ag.facing) * 0.42 * arcEnv);
        ctx.strokeStyle = `rgba(56, 189, 248, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(ag.facing) * playerRadius * 1.5, -Math.sin(ag.facing) * playerRadius * 1.5 - 3);
        ctx.lineTo(0, -3);
        ctx.moveTo(-Math.cos(ag.facing) * playerRadius * 1.5, -Math.sin(ag.facing) * playerRadius * 1.5 + 3);
        ctx.lineTo(0, 3);
        ctx.stroke();
        ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.9})`;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 5, ag.facing - 0.85, ag.facing + 0.85);
        ctx.stroke();
      } else if (ag.acrobatType === 'burst') {
        const bx1 = -Math.cos(ag.facing) * playerRadius * 0.85;
        const by1 = -Math.sin(ag.facing) * playerRadius * 0.85;
        ctx.save();
        ctx.fillStyle = `rgba(56, 189, 248, ${acAlpha * 0.35})`;
        ctx.beginPath();
        ctx.arc(bx1, by1, playerRadius * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx1 * 1.7, by1 * 1.7, playerRadius * 0.66, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(125, 211, 252, ${acAlpha * 0.95})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx1 * 1.9, by1 * 1.9 - 4);
        ctx.lineTo(0, -4);
        ctx.moveTo(bx1 * 1.9, by1 * 1.9 + 4);
        ctx.lineTo(0, 4);
        ctx.stroke();
        ctx.restore();
      } else if (ag.acrobatType === 'stepover') {
        const sway = Math.sin(prog * Math.PI * 4) * (playerRadius * 0.42);
        ctx.translate(-Math.sin(ag.facing) * sway, Math.cos(ag.facing) * sway);
        ctx.strokeStyle = `rgba(244, 114, 182, ${acAlpha * 0.92})`;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.arc(-3, 0, playerRadius + 3.5, Math.PI * 0.65, Math.PI * 1.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(3, 0, playerRadius + 3.5, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.stroke();
      } else if (ag.acrobatType === 'shield') {
        ctx.scale(1.08, 1.08);
        ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 5.2, ag.facing - 1.1, ag.facing + 1.1);
        ctx.stroke();
      } else if (ag.acrobatType === 'spin') {
        const spinDir = ag.skillSpinDir || 1;
        ctx.rotate(spinDir * prog * Math.PI * 2);
        ctx.strokeStyle = `rgba(192, 132, 252, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (ag.acrobatType === 'skill_pass') {
        ctx.rotate((ag.skillSpinDir || 1) * 0.9 * arcEnv);
        ctx.strokeStyle = `rgba(232, 121, 249, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 5, ag.facing + Math.PI * 0.5, ag.facing + Math.PI * 1.5);
        ctx.stroke();
      } else if (ag.acrobatType === 'dragback') {
        const rock = Math.sin(prog * Math.PI * 3) * (playerRadius * 0.28);
        ctx.translate(-Math.cos(ag.facing) * rock, -Math.sin(ag.facing) * rock);
        ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 4.8, 0, Math.PI * 1.65);
        ctx.stroke();
      } else if (ag.acrobatType === 'cutinside') {
        ctx.rotate((ag.skillSpinDir || 1) * 0.42 * arcEnv);
        ctx.strokeStyle = `rgba(232, 121, 249, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 5.8, ag.facing - 0.85, ag.facing + 0.85);
        ctx.stroke();
      } else if (ag.acrobatType === 'slide') {
        const slidePush = arcEnv * playerRadius * 0.72;
        ctx.translate(Math.cos(ag.facing) * slidePush, Math.sin(ag.facing) * slidePush);
        ctx.rotate(Math.sin(ag.facing) >= 0 ? 0.52 * arcEnv : -0.52 * arcEnv);
        ctx.strokeStyle = `rgba(56, 189, 248, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(ag.facing) * playerRadius * 1.4, -Math.sin(ag.facing) * playerRadius * 1.4);
        ctx.lineTo(Math.cos(ag.facing) * playerRadius * 1.1, Math.sin(ag.facing) * playerRadius * 1.1);
        ctx.stroke();
      } else if (ag.acrobatType === 'tackle') {
        ctx.translate(Math.cos(ag.facing) * arcEnv * 4, Math.sin(ag.facing) * arcEnv * 4);
        ctx.strokeStyle = `rgba(52, 211, 153, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 5.5, ag.facing - 0.95, ag.facing + 0.95);
        ctx.stroke();
      } else if (ag.acrobatType === 'clash') {
        const recoil = Math.sin(prog * Math.PI * 2) * 2.5;
        ctx.translate((ag.actionDirX || 1) * recoil, (ag.actionDirY || 0) * recoil);
        ctx.strokeStyle = `rgba(251, 146, 60, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 4.8 + prog * 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ag.acrobatType === 'supersave') {
        ctx.strokeStyle = `rgba(56, 189, 248, ${acAlpha * 0.98})`;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 6 + prog * 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.9})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 10 + prog * 9, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ag.acrobatType === 'slip') {
        // Player slips & tumbles onto the wet grass with water/turf splash
        const skidDist = arcEnv * playerRadius * 0.62;
        ctx.translate(-Math.cos(ag.facing) * skidDist * 0.45, arcEnv * playerRadius * 0.42);
        ctx.rotate((ag.skillSpinDir || 1) * 1.18 * arcEnv);
        ctx.strokeStyle = `rgba(56, 189, 248, ${acAlpha * 0.95})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(0, playerRadius * 0.35, playerRadius + 5.5 + prog * 5, playerRadius * 0.55 + prog * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(187, 247, 208, ${acAlpha * 0.78})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-playerRadius * 1.2, playerRadius * 0.2);
        ctx.lineTo(playerRadius * 0.9, -playerRadius * 0.15);
        ctx.stroke();
      } else if (ag.acrobatType === 'whiff') {
        // Big awkward air-swing stagger + wind swoosh arc
        const stagger = Math.sin(prog * Math.PI * 2) * 0.65;
        ctx.rotate(stagger);
        ctx.scale(1 + 0.08 * arcEnv, 1 + 0.08 * arcEnv);
        ctx.strokeStyle = `rgba(251, 146, 60, ${acAlpha * 0.96})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 6.5, ag.facing - 1.15, ag.facing + 1.15);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${acAlpha * 0.85})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius + 10.5, ag.facing - 0.75, ag.facing + 0.85);
        ctx.stroke();
      } else if (
        ag.acrobatType === 'kick' ||
        ag.acrobatType === 'shoot_power' ||
        ag.acrobatType === 'shoot_finesse' ||
        ag.acrobatType === 'shoot_chip'
      ) {
        // Distinct shooting motion: crisp wind-up recoil (prog < 0.25) -> explosive strike lunge + glowing swing arc
        const dir = ag.facing;
        const kickPhase = prog < 0.25 ? -(prog / 0.25) : Math.sin(((prog - 0.25) / 0.75) * Math.PI);
        const isPower = ag.acrobatType === 'shoot_power';
        const isFinesse = ag.acrobatType === 'shoot_finesse';
        const isChip = ag.acrobatType === 'shoot_chip';
        const pushDist = kickPhase * playerRadius * (isPower ? 0.56 : 0.42);
        const liftY = isChip ? -Math.max(0, kickPhase) * playerRadius * 0.28 : isPower ? -Math.max(0, kickPhase) * playerRadius * 0.14 : 0;
        const lean = isPower ? 0.26 * kickPhase : isFinesse ? -0.3 * kickPhase : 0.16 * kickPhase;
        ctx.translate(Math.cos(dir) * pushDist, Math.sin(dir) * pushDist + liftY);
        ctx.rotate(lean);
        const arcColor = isPower
          ? `rgba(251, 146, 60, ${acAlpha * 0.96})`
          : isFinesse
            ? `rgba(56, 189, 248, ${acAlpha * 0.96})`
            : isChip
              ? `rgba(250, 204, 21, ${acAlpha * 0.96})`
              : `rgba(253, 224, 71, ${acAlpha * 0.92})`;
        ctx.strokeStyle = arcColor;
        ctx.lineWidth = isPower ? 2.8 : 2.3;
        const ringRad = playerRadius + 4.5 + Math.max(0, kickPhase) * (isPower ? 6.5 : 4.5);
        ctx.beginPath();
        ctx.arc(0, 0, ringRad, dir - 0.85, dir + 0.85);
        ctx.stroke();
        if (isPower && prog >= 0.2) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${acAlpha * 0.85})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, ringRad + 3.5, dir - 0.55, dir + 0.55);
          ctx.stroke();
        }
      }
    }

    // Animated directional cleated boots oriented along facing direction (with extended striking boot on shots)
    const perpX = -sinF;
    const perpY = cosF;
    const isKickingNow =
      (ag.acrobatTimer ?? 0) > 0 &&
      (ag.acrobatType === 'kick' ||
        ag.acrobatType === 'shoot_power' ||
        ag.acrobatType === 'shoot_finesse' ||
        ag.acrobatType === 'shoot_chip' ||
        ag.acrobatType === 'volley');
    const kickProg = isKickingNow ? clamp(1 - (ag.acrobatTimer ?? 0) / Math.max(0.1, ag.acrobatMax || 0.45), 0, 1) : 0;
    const kickSwing = isKickingNow ? (kickProg < 0.25 ? -0.45 : Math.sin(((kickProg - 0.25) / 0.75) * Math.PI) * 1.15) : 0;
    const legSwing = isKickingNow ? kickSwing * (playerRadius * 0.9) : strideSin * (playerRadius * 0.58);
    const backSwing = isKickingNow ? -playerRadius * 0.28 : -legSwing;

    const bootLen = playerRadius * (isKickingNow ? 0.36 : 0.32);
    const bootWid = playerRadius * 0.2;
    const foot1X = perpX * (playerRadius * 0.4) + cosF * legSwing;
    const foot1Y = perpY * (playerRadius * 0.4) + sinF * legSwing + playerRadius * 0.36;
    const foot2X = -perpX * (playerRadius * 0.4) + cosF * backSwing;
    const foot2Y = -perpY * (playerRadius * 0.4) + sinF * backSwing + playerRadius * 0.36;

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(foot1X, foot1Y, bootLen, bootWid, ag.facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(foot2X, foot2Y, bootLen * 0.94, bootWid, ag.facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Subtle body bob & running shoulder sway
    const celebHopOffset =
      ag.intent === 'CELEBRATE' && ag.celebrateRole !== 'conceded'
        ? ag.celebrateRole === 'scorer' && (ag.celebratePose === 'siu_jump' || ag.celebratePose === 'backflip')
          ? 0
          : -celebHopArc * playerRadius * 0.65
        : 0;
    const bobY = -Math.abs(strideSin) * 1.65 + celebHopOffset;
    ctx.translate(0, bobY);
    if (speed > 2.5 && ag.intent !== 'DIVE' && ag.intent !== 'CELEBRATE') {
      ctx.rotate(strideSin * 0.075);
    }

    // Distinct Choreographed Goal Celebration Animations & Postures
    const cElapsed = world.celebration?.elapsed ?? 0;
    if (ag.intent === 'CELEBRATE' && ag.celebrateRole !== 'conceded') {
      const cPose = ag.celebratePose || 'group_huddle';
      const cRole = ag.celebrateRole || 'teammate';
      const cPh = clamp(ag.celebratePhase ?? 0, 0, 1);
      const sleeveC = kit;
      const skinC = '#f1c27d';

      if (cRole === 'scorer') {
        if (cPose === 'knee_slide') {
          const sliding = cPh >= 0.28 && cPh <= 0.78;
          const slideEnv = sliding ? Math.sin(((cPh - 0.28) / 0.5) * Math.PI) : 0;
          if (sliding) {
            ctx.rotate(-0.24 * slideEnv);
            ctx.translate(0, playerRadius * 0.14 * slideEnv);
            // Twin turf skid tracks trailing behind scorer
            ctx.save();
            ctx.strokeStyle = 'rgba(220, 252, 231, 0.78)';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-cosF * playerRadius * 2.5 + perpX * 2.8, -sinF * playerRadius * 2.5 + perpY * 2.8 + playerRadius * 0.45);
            ctx.lineTo(-cosF * playerRadius * 0.5 + perpX * 2.8, -sinF * playerRadius * 0.5 + perpY * 2.8 + playerRadius * 0.45);
            ctx.moveTo(-cosF * playerRadius * 2.5 - perpX * 2.8, -sinF * playerRadius * 2.5 - perpY * 2.8 + playerRadius * 0.45);
            ctx.lineTo(-cosF * playerRadius * 0.5 - perpX * 2.8, -sinF * playerRadius * 0.5 - perpY * 2.8 + playerRadius * 0.45);
            ctx.stroke();
            ctx.restore();
          }
          // Victory V-arms raised
          const armW = 0.2 + 0.3 * Math.sin(cElapsed * 12);
          ctx.strokeStyle = sleeveC;
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-playerRadius * 0.55, 0);
          ctx.lineTo(-playerRadius * 1.15, -playerRadius * (0.95 + armW * 0.25));
          ctx.moveTo(playerRadius * 0.55, 0);
          ctx.lineTo(playerRadius * 1.15, -playerRadius * (0.95 + armW * 0.25));
          ctx.stroke();
          ctx.fillStyle = skinC;
          ctx.beginPath();
          ctx.arc(-playerRadius * 1.15, -playerRadius * (0.95 + armW * 0.25), 1.9, 0, Math.PI * 2);
          ctx.arc(playerRadius * 1.15, -playerRadius * (0.95 + armW * 0.25), 1.9, 0, Math.PI * 2);
          ctx.fill();
        } else if (cPose === 'siu_jump') {
          if (cPh >= 0.34 && cPh <= 0.76) {
            const jT = (cPh - 0.34) / 0.42;
            const jArc = Math.sin(jT * Math.PI);
            ctx.translate(0, -playerRadius * 1.08 * jArc);
            ctx.rotate(jT * Math.PI * 2);
            ctx.strokeStyle = `rgba(250, 204, 21, ${(0.9 * jArc).toFixed(2)})`;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(0, 0, playerRadius + 5.5, 0, Math.PI * 1.6);
            ctx.stroke();
          } else if (cPh > 0.76) {
            const landT = clamp((cPh - 0.76) / 0.24, 0, 1);
            ctx.strokeStyle = `rgba(250, 204, 21, ${(0.95 * (1 - landT)).toFixed(2)})`;
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.arc(0, 0, playerRadius + 4 + landT * 18, 0, Math.PI * 2);
            ctx.stroke();
            // Wide outstretched power landing arms
            ctx.strokeStyle = sleeveC;
            ctx.lineWidth = 2.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-playerRadius * 0.6, 0);
            ctx.lineTo(-playerRadius * 1.55, playerRadius * 0.35);
            ctx.moveTo(playerRadius * 0.6, 0);
            ctx.lineTo(playerRadius * 1.55, playerRadius * 0.35);
            ctx.stroke();
            ctx.fillStyle = skinC;
            ctx.beginPath();
            ctx.arc(-playerRadius * 1.55, playerRadius * 0.35, 1.9, 0, Math.PI * 2);
            ctx.arc(playerRadius * 1.55, playerRadius * 0.35, 1.9, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (cPose === 'backflip') {
          if (cPh >= 0.28 && cPh <= 0.84) {
            const fT = (cPh - 0.28) / 0.56;
            const fArc = Math.sin(fT * Math.PI);
            ctx.translate(0, -playerRadius * 1.15 * fArc);
            ctx.rotate(-fT * Math.PI * 4);
            ctx.strokeStyle = `rgba(251, 146, 60, ${(0.95 * fArc).toFixed(2)})`;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(0, 0, playerRadius + 6, -Math.PI * 0.9, Math.PI * 0.4);
            ctx.stroke();
            ctx.strokeStyle = `rgba(254, 240, 138, ${(0.85 * fArc).toFixed(2)})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(0, 0, playerRadius + 9.5, Math.PI * 0.1, Math.PI * 1.35);
            ctx.stroke();
          } else {
            ctx.strokeStyle = sleeveC;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-playerRadius * 0.6, 0);
            ctx.lineTo(-playerRadius * 1.2, -playerRadius * 1.05);
            ctx.moveTo(playerRadius * 0.6, 0);
            ctx.lineTo(playerRadius * 1.2, -playerRadius * 1.05);
            ctx.stroke();
          }
        } else if (cPose === 'airplane') {
          const bank = Math.sin(cElapsed * 6.5) * 0.24;
          ctx.rotate(bank);
          // Wide airplane wings + wingtip trails
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(perpX * playerRadius * 1.65, perpY * playerRadius * 1.65);
          ctx.lineTo(perpX * playerRadius * 1.65 - cosF * playerRadius * 1.9, perpY * playerRadius * 1.65 - sinF * playerRadius * 1.9);
          ctx.moveTo(-perpX * playerRadius * 1.65, -perpY * playerRadius * 1.65);
          ctx.lineTo(-perpX * playerRadius * 1.65 - cosF * playerRadius * 1.9, -perpY * playerRadius * 1.65 - sinF * playerRadius * 1.9);
          ctx.stroke();

          ctx.strokeStyle = sleeveC;
          ctx.lineWidth = 2.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-perpX * playerRadius * 1.65, -perpY * playerRadius * 1.65);
          ctx.lineTo(perpX * playerRadius * 1.65, perpY * playerRadius * 1.65);
          ctx.stroke();
          ctx.fillStyle = skinC;
          ctx.beginPath();
          ctx.arc(perpX * playerRadius * 1.65, perpY * playerRadius * 1.65, 2, 0, Math.PI * 2);
          ctx.arc(-perpX * playerRadius * 1.65, -perpY * playerRadius * 1.65, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (cPose === 'bow_crowd') {
          const bowEnv = cPh > 0.32 ? Math.sin(clamp((cPh - 0.32) / 0.68, 0, 1) * Math.PI) : 0;
          ctx.scale(1 + 0.04 * bowEnv, 1 - 0.14 * bowEnv);
          ctx.strokeStyle = `rgba(250, 204, 21, ${(0.45 + 0.45 * bowEnv).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 4.5 + bowEnv * 7, 0, Math.PI * 2);
          ctx.stroke();
          // Hands joined in graceful Thai Wai / salute in front
          ctx.fillStyle = skinC;
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cosF * playerRadius * 0.92, sinF * playerRadius * 0.92, 2.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (cPose === 'calm_shush') {
          const pulseR = ((cElapsed * 1.6) % 1) * 13;
          const pulseA = 1 - ((cElapsed * 1.6) % 1);
          ctx.strokeStyle = `rgba(56, 189, 248, ${(pulseA * 0.9).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 3 + pulseR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 4.5, 0, Math.PI * 2);
          ctx.stroke();
        } else if (cPose === 'finger_point') {
          const pointLen = playerRadius * (1.35 + Math.sin(cElapsed * 11) * 0.14);
          ctx.strokeStyle = sleeveC;
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(cosF * pointLen, sinF * pointLen);
          ctx.stroke();
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(cosF * pointLen, sinF * pointLen, 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // group_huddle / own_goal_modest
          const wave = Math.sin(cElapsed * 13) * 0.25;
          ctx.strokeStyle = sleeveC;
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-playerRadius * 0.55, 0);
          ctx.lineTo(-playerRadius * 1.1, -playerRadius * (0.9 + wave));
          ctx.moveTo(playerRadius * 0.55, 0);
          ctx.lineTo(playerRadius * 1.1, -playerRadius * (0.9 - wave));
          ctx.stroke();
          ctx.strokeStyle = 'rgba(74, 222, 128, 0.78)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 4.5 + Math.sin(cElapsed * 8) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (cRole === 'assister' || cRole === 'teammate' || cRole === 'gk') {
        const wave = Math.sin(cElapsed * 12 + ag.slotIndex) * 0.28;
        ctx.strokeStyle = sleeveC;
        ctx.lineWidth = 2.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-playerRadius * 0.5, 0);
        ctx.lineTo(-playerRadius * 1.05, -playerRadius * (0.85 + wave));
        ctx.moveTo(playerRadius * 0.5, 0);
        ctx.lineTo(playerRadius * 1.05, -playerRadius * (0.85 - wave));
        ctx.stroke();
        ctx.fillStyle = skinC;
        ctx.beginPath();
        ctx.arc(-playerRadius * 1.05, -playerRadius * (0.85 + wave), 1.6, 0, Math.PI * 2);
        ctx.arc(playerRadius * 1.05, -playerRadius * (0.85 - wave), 1.6, 0, Math.PI * 2);
        ctx.fill();
        if (cRole === 'assister') {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (ag.intent === 'CELEBRATE' && ag.celebrateRole === 'conceded' && ag.isOgCulprit) {
      const shake = Math.sin(cElapsed * 18) * 0.14;
      ctx.rotate(shake);
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // GK ready-stance padded gloves slightly out in front when not mid-dive
    if (ag.pos === 'GK' && ag.intent !== 'DIVE') {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 0.95;
      const gFwd = playerRadius * 0.72;
      const gSpread = playerRadius * 0.68;
      ctx.beginPath();
      ctx.arc(cosF * gFwd + perpX * gSpread, sinF * gFwd + perpY * gSpread, playerRadius * 0.25, 0, Math.PI * 2);
      ctx.arc(cosF * gFwd - perpX * gSpread, sinF * gFwd - perpY * gSpread, playerRadius * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Direction nose/shoulder cue
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cosF * (playerRadius * 0.82), sinF * (playerRadius * 0.82), 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Jersey circle backdrop
    ctx.fillStyle = kit;
    ctx.beginPath();
    ctx.arc(0, 0, playerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Clipped player portrait inside circle
    const faceCanvas = getPitchFaceCanvas(ag.vis, kit, trim);
    if (faceCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, playerRadius - 0.8), 0, Math.PI * 2);
      ctx.clip();
      const fw = playerRadius * 2.06;
      const fh = (fw * 68) / 64;
      ctx.drawImage(faceCanvas, -fw / 2, -fh * 0.47, fw, fh);
      ctx.restore();
    }

    // Crisp outer ring
    ctx.strokeStyle = ag.isMe ? '#fde047' : ag.intent === 'PRESS' ? '#fca5a5' : '#ffffff';
    ctx.lineWidth = ag.isMe ? 2.2 : 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, playerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Shirt number (center fallback before SVG image decodes, otherwise compact corner badge)
    let noBadgeRightX = 0;
    if (!faceCanvas) {
      ctx.fillStyle = colDist(kit, '#ffffff') < 110 ? '#111827' : '#ffffff';
      ctx.font = `800 ${Math.round(playerRadius * 0.88)}px Sarabun, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ag.no), 0, 0.5);
    } else {
      const noStr = String(ag.no);
      const badgeW = Math.max(9.5, noStr.length * 4.5 + 3.2);
      const badgeH = 9.5;
      const bx0 = -playerRadius * 1.18;
      const by0 = playerRadius * 0.25;
      noBadgeRightX = bx0 + badgeW;
      ctx.fillStyle = 'rgba(11, 32, 24, 0.92)';
      ctx.strokeStyle = kit;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx0, by0, badgeW, badgeH, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd75e';
      ctx.font = '800 7px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(noStr, bx0 + badgeW / 2, by0 + badgeH / 2 + 0.3);
    }

    // Bottom-right pill: Live Match Rating when showRatings=true, or Player OVR when showRatings=false
    {
      let pillStr = '';
      let pillBg = '#0f172a';
      let pillFg = '#ffffff';
      let pillStroke = '#94a3b8';
      let pillW = 16.5;

      if (showRatings) {
        const rtVal = liveRatings?.[ag.id] ?? 6.5;
        const rtPal = getRatingCanvasPalette(rtVal);
        pillStr = rtVal.toFixed(1);
        pillBg = rtPal.bg;
        pillFg = rtPal.text;
        pillStroke = rtPal.stroke;
      } else {
        const ovVal = Math.round(ag.ov ?? 60);
        pillStr = String(ovVal);
        pillBg = ovVal >= 84 ? '#facc15' : ovVal >= 73 ? '#10b981' : ovVal >= 62 ? '#0284c7' : '#334155';
        pillFg = ovVal >= 84 ? '#1c1300' : '#ffffff';
        pillStroke = ovVal >= 84 ? '#fef08a' : ovVal >= 73 ? '#a7f3d0' : ovVal >= 62 ? '#bae6fd' : '#cbd5e1';
        pillW = 14.5;
      }

      const pillH = 9.5;
      const rx0 = faceCanvas ? Math.max(0.8, noBadgeRightX + 1.2) : playerRadius * 0.05;
      const ry0 = playerRadius * 0.25;
      ctx.fillStyle = pillBg;
      ctx.strokeStyle = pillStroke;
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.roundRect(rx0, ry0, pillW, pillH, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pillFg;
      ctx.font = '800 7px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillStr, rx0 + pillW / 2, ry0 + pillH / 2 + 0.3);
    }

    // Crisp position role micro-badge snug on top rim of each player during live play
    if (showPositions && ag.role) {
      const roleStr = String(ag.role);
      const posPal = getPositionCanvasPalette(ag.role || ag.pos);
      const roleFont = Math.max(6.4, Math.round(playerRadius * 0.56));
      ctx.font = `800 ${roleFont}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const rw = Math.max(17, measureTextCached(ctx, roleStr) + 5.5);
      const rh = Math.max(9.5, roleFont + 3.2);
      const ry = -playerRadius - rh * 0.72;
      ctx.fillStyle = posPal.bg;
      ctx.strokeStyle = posPal.stroke;
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.roundRect(-rw / 2, ry, rw, rh, 2.8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = posPal.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(roleStr, 0, ry + rh / 2);
    }

    // Yellow card mini indicator on right shoulder (clear of top position badge)
    if (ag.hasYellow) {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.95;
      ctx.fillRect(playerRadius * 0.78, -playerRadius * 0.62, 4.2, 5.8);
      ctx.strokeRect(playerRadius * 0.78, -playerRadius * 0.62, 4.2, 5.8);
    }

    // Substitute-in circular emerald up-arrow badge on mid-left edge (clear of captain & top position badge)
    if (ag.subbedIn) {
      const subX = ag.isCaptain ? -playerRadius * 1.22 : -playerRadius * 1.12;
      const subY = ag.isCaptain ? playerRadius * 0.12 : -playerRadius * 0.18;
      const srBadge = 4.1;
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(subX, subY, srBadge, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(subX, subY - srBadge * 0.54);
      ctx.lineTo(subX + srBadge * 0.48, subY + srBadge * 0.05);
      ctx.lineTo(subX + srBadge * 0.19, subY + srBadge * 0.05);
      ctx.lineTo(subX + srBadge * 0.19, subY + srBadge * 0.55);
      ctx.lineTo(subX - srBadge * 0.19, subY + srBadge * 0.55);
      ctx.lineTo(subX - srBadge * 0.19, subY + srBadge * 0.05);
      ctx.lineTo(subX - srBadge * 0.48, subY + srBadge * 0.05);
      ctx.closePath();
      ctx.fill();
    }

    // Captain 'C' circular badge drawn last on left outer shoulder so position badge never covers it
    if (ag.isCaptain) {
      const capPal = getClubCaptainPalette(kit, trim);
      const capX = -playerRadius * 1.06;
      const capY = ag.subbedIn ? -playerRadius * 0.44 : -playerRadius * 0.24;
      ctx.fillStyle = capPal.bg;
      ctx.strokeStyle = capPal.border;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.arc(capX, capY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = capPal.text;
      ctx.font = '900 5.9px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', capX, capY + 0.35);
    }

    // Live stamina micro-bar under every player on the pitch
    const stamPct = clamp(ag.fit, 0, 100) / 100;
    const barW = playerRadius * 1.9;
    const barH = 2.8;
    const barY = playerRadius + 1.5;
    ctx.fillStyle = 'rgba(7, 20, 14, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-barW / 2 - 0.6, barY - 0.6, barW + 1.2, barH + 1.2, 2);
    ctx.fill();
    ctx.strokeStyle = ag.fit < 65 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    if (stamPct > 0) {
      const fillW = Math.max(2, barW * stamPct);
      ctx.fillStyle = ag.fit >= 75 ? '#22c55e' : ag.fit >= 65 ? '#f59e0b' : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, fillW, barH, 1.4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, fillW, 0.9, 0.45);
      ctx.fill();
    }

    // Compact label for carrier, target, shooter, blessed hot-streak, or "★ ฉัน"
    if (isCarrier || isTarget || ag.isMe || isBlessed || (ag.intent === 'CELEBRATE' && ag.celebrateRole === 'scorer') || ag.intent === 'MAKE_RUN') {
      const prefix =
        ag.intent === 'CELEBRATE' && ag.celebrateRole === 'scorer'
          ? ag.celebratePose === 'knee_slide'
            ? '🦵 '
            : ag.celebratePose === 'siu_jump'
              ? '⚡ '
              : ag.celebratePose === 'backflip'
                ? '🤸 '
                : ag.celebratePose === 'airplane'
                  ? '✈️ '
                  : ag.celebratePose === 'bow_crowd'
                    ? '🙏 '
                    : ag.celebratePose === 'calm_shush'
                      ? '🤫 '
                      : ag.celebratePose === 'finger_point'
                        ? '👉 '
                        : '🎉 '
          : isBlessed
            ? '✨ '
            : '';
      const label = ag.isMe ? `${prefix}★ ${ag.shortName} ${Math.round(ag.fit)}%` : `${prefix}${ag.shortName}`;
      ctx.font = `700 ${Math.max(9.5, Math.round(playerRadius * 0.86))}px "Noto Sans Thai", sans-serif`;
      const tw = measureTextCached(ctx, label);
      const bw = tw + 10;
      const bh = 13.5;
      const by = playerRadius + 13;
      const lxOff = clamp(cx, bw / 2 + 4, cssW - bw / 2 - 4) - cx;
      ctx.fillStyle = isBlessed
        ? 'rgba(245, 158, 11, 0.94)'
        : ag.isMe
          ? 'rgba(250, 204, 21, 0.93)'
          : ag.intent === 'CELEBRATE' && ag.celebrateRole === 'scorer'
            ? 'rgba(16, 185, 129, 0.94)'
            : 'rgba(6, 18, 12, 0.84)';
      ctx.strokeStyle = isBlessed
        ? 'rgba(254, 240, 138, 0.85)'
        : ag.isMe
          ? 'rgba(254, 240, 138, 0.9)'
          : ag.intent === 'CELEBRATE' && ag.celebrateRole === 'scorer'
            ? 'rgba(167, 243, 208, 0.7)'
            : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(lxOff - bw / 2, by - bh / 2, bw, bh, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isBlessed || ag.isMe ? '#1a1200' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lxOff, by + 0.3);
    }

    ctx.restore();
  });

  // 6. Ball with 3D ground shadow, spinning pentagon panels, spherical shading & shot aura
  const bx = px(b.x);
  const by = py(b.y);
  const ballScale = 1 + clamp(b.z / 24, 0, 0.72);
  const ballR = clamp(cssW * 0.0092, 4.8, 6.8) * ballScale;

  // Ground shadow
  ctx.fillStyle = `rgba(0, 0, 0, ${clamp(0.42 - b.z * 0.012, 0.12, 0.42)})`;
  ctx.beginPath();
  ctx.ellipse(bx + b.z * 0.22, by + 3.2 + b.z * 0.28, ballR * 0.94, ballR * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  // Elevated 3D match ball
  const drawBy = by - b.z * 0.78;
  const isSpecialBall =
    b.shotStyle === 'bicycle' ||
    b.shotStyle === 'volley' ||
    b.shotStyle === 'screamer' ||
    b.shotStyle === 'trivela' ||
    b.shotStyle === 'diving_header' ||
    b.shotStyle === 'deflected';
  const isCurlBall = b.shotStyle === 'curler' || b.shotStyle === 'knuckle';
  const isPowerShot = b.flightType === 'shot' || b.flightType === 'freekick' || b.flightType === 'penalty' || b.flightType === 'shootout_kick';

  // Shot comet trail behind fast/special shots
  if (isPowerShot && b.trail.length >= 2) {
    ctx.save();
    ctx.lineCap = 'round';
    const tailLen = b.trail.length;
    for (let ti = 1; ti < tailLen; ti++) {
      const p0 = b.trail[ti - 1];
      const p1 = b.trail[ti];
      const ratio = ti / tailLen;
      ctx.strokeStyle = isCurlBall
        ? `rgba(56, 189, 248, ${ratio * 0.52})`
        : isSpecialBall
          ? `rgba(251, 146, 60, ${ratio * 0.58})`
          : `rgba(253, 224, 71, ${ratio * 0.46})`;
      ctx.lineWidth = Math.max(1.2, ballR * 1.45 * ratio);
      ctx.beginPath();
      ctx.moveTo(px(p0.x), py(p0.y) - (p0.z || 0) * 0.78);
      ctx.lineTo(px(p1.x), py(p1.y) - (p1.z || 0) * 0.78);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(bx, drawBy);

  // Subtle motion/shot glow behind the ball
  if (isCurlBall || isSpecialBall || isPowerShot) {
    ctx.save();
    ctx.fillStyle = isCurlBall
      ? 'rgba(56, 189, 248, 0.34)'
      : isSpecialBall
        ? 'rgba(251, 191, 36, 0.38)'
        : 'rgba(254, 240, 138, 0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, ballR * 1.54, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Spherical 3D shading + clipped spinning pentagon seams
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, ballR, 0, Math.PI * 2);
  ctx.clip();

  const ballSprite = getBallSphereSprite(ballR);
  if (ballSprite) {
    const spriteHalf = Math.max(4, Math.round(ballR * 4)) / 4 + 1;
    ctx.drawImage(ballSprite, -spriteHalf, -spriteHalf, spriteHalf * 2, spriteHalf * 2);
  } else {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-ballR - 1, -ballR - 1, ballR * 2 + 2, ballR * 2 + 2);
  }

  // Dynamic roll & spin based on field coordinates and flight progress
  const spinAng = (b.x * 0.38 + b.y * 0.27 + (b.progress || 0) * 10.5) * (isCurlBall ? 1.6 : 1);
  const coreOffX = Math.cos(spinAng * 0.65) * ballR * 0.14;
  const coreOffY = Math.sin(spinAng * 0.55) * ballR * 0.14;
  const pentR = ballR * 0.37;

  ctx.save();
  ctx.translate(coreOffX, coreOffY);
  ctx.rotate(spinAng);

  // Seams radiating from center pentagon to outer panels
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.65)';
  ctx.lineWidth = Math.max(0.7, ballR * 0.11);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const vx = Math.cos(a) * pentR;
    const vy = Math.sin(a) * pentR;
    const ox = Math.cos(a) * (ballR * 1.05);
    const oy = Math.sin(a) * (ballR * 1.05);
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(ox, oy);
    ctx.stroke();

    // Peripheral dark edge panels
    const pxOut = Math.cos(a) * (ballR * 0.96);
    const pyOut = Math.sin(a) * (ballR * 0.96);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(pxOut, pyOut, ballR * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center pentagon
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const pxV = Math.cos(a) * pentR;
    const pyV = Math.sin(a) * pentR;
    if (i === 0) ctx.moveTo(pxV, pyV);
    else ctx.lineTo(pxV, pyV);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Top-left glossy specular highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.ellipse(-ballR * 0.34, -ballR * 0.36, ballR * 0.24, ballR * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Crisp outer rim
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, ballR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 7. Floating event callouts (Offside flag, Foul, Save, Woodwork, Goal!)
  world.fx.forEach((fx) => {
    if (!fx.label) return;
    const alpha = clamp(fx.ttl / fx.maxTtl, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha * 1.4);
    const hasMedCross = fx.label.startsWith('✚ ');
    const textLabel = hasMedCross ? fx.label.slice(2) : fx.label;
    ctx.font = '700 10.5px "Noto Sans Thai", sans-serif';
    const maxCalloutW = Math.max(120, cssW - 24);
    const safeLabel = fitCanvasText(ctx, textLabel, maxCalloutW - (hasMedCross ? 26 : 18));
    const tw = measureTextCached(ctx, safeLabel);
    const bw = tw + (hasMedCross ? 26 : 18);
    const bh = 20;
    const fxX = clamp(px(fx.x), bw / 2 + 8, cssW - bw / 2 - 8);
    const fxY = clamp(py(fx.y) - 23 - (1 - alpha) * 9, 16, cssH - 16);

    drawSoftRoundedShadow(ctx, fxX - bw / 2, fxY - bh / 2, bw, bh, 6, 2, 1.5);
    ctx.fillStyle = 'rgba(7, 19, 13, 0.92)';
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(fxX - bw / 2, fxY - bh / 2, bw, bh, 6);
    ctx.fill();
    ctx.stroke();

    if (hasMedCross) {
      const cxIcon = fxX - bw / 2 + 11;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.arc(cxIcon, fxY, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cxIcon - 3.0, fxY - 1.0, 6.0, 2.0);
      ctx.fillRect(cxIcon - 1.0, fxY - 3.0, 2.0, 6.0);
    } else {
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.roundRect(fxX - bw / 2 + 4, fxY - 5, 2.5, 10, 1.25);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(safeLabel, hasMedCross ? fxX + 7 : fxX + 2.5, fxY + 0.3);
    ctx.restore();
  });

  // 8. Subtle Goal Sparkles & Broadcast Goal Strip
  if (world.sparkles.length > 0) {
    world.sparkles.forEach((sp) => {
      const a = clamp(sp.ttl / sp.maxTtl, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * 0.92;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(px(sp.x), py(sp.y), sp.size * (0.6 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  if (world.goalBanner && world.goalBanner.ttl > 0) {
    const gb = world.goalBanner;
    const prog = clamp(1 - gb.ttl / Math.max(0.01, gb.maxTtl), 0, 1);
    const enterT = clamp(prog / 0.22, 0, 1);
    const easeIn = 1 - Math.pow(1 - enterT, 3);
    const fadeOut = clamp(gb.ttl / 0.34, 0, 1);
    const easeExit = Math.pow(1 - fadeOut, 2);
    const alpha = Math.min(clamp(enterT * 2.4, 0, 1), fadeOut);
    ctx.save();
    ctx.globalAlpha = alpha;
    const rawTitle = gb.isOwnGoal
      ? `🤦 เข้าประตูตัวเอง!! (OG) · ${gb.scorer}`
      : gb.isMeScorer
        ? `🌟 คุณยิงประตู!! ${gb.scorer}`
        : `⚽ GOAL!! ${gb.scorer} (${gb.teamName})`;
    const rawSub = gb.isOwnGoal
      ? `${gb.teamName} ได้ประตูส้มหล่น!`
      : gb.assister
        ? `👟 ${gb.assister}`
        : gb.isMyGoal
          ? '🎉 เฮลั่นสนาม!'
          : '🔥 ตุงตาข่าย!';
    const maxBannerW = cssW - 24;
    ctx.font = '800 12.5px "Noto Sans Thai", sans-serif';
    const title = fitCanvasText(ctx, rawTitle, maxBannerW - 34);
    const w1 = measureTextCached(ctx, title);
    ctx.font = '600 10px "Noto Sans Thai", sans-serif';
    const sub = fitCanvasText(ctx, rawSub, maxBannerW - 34);
    const w2 = measureTextCached(ctx, sub);
    const cardW = clamp(Math.max(w1, w2) + 40, 184, maxBannerW);
    const cardH = 40;
    const targetY = Math.round(padTop + 6);
    const startY = -(cardH + 12);
    const cy = enterT < 1 ? startY + (targetY - startY) * easeIn : targetY - 22 * easeExit;
    const cx = cssW / 2;

    drawSoftRoundedShadow(ctx, cx - cardW / 2, cy, cardW, cardH, 10, 3, 2.5);
    ctx.fillStyle = gb.isOwnGoal ? 'rgba(28, 10, 16, 0.95)' : 'rgba(8, 22, 15, 0.94)';
    ctx.strokeStyle = gb.isOwnGoal ? '#fb7185' : gb.isMyGoal ? '#facc15' : '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    // Team color accent strip on left
    ctx.fillStyle = gb.kit;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2 + 5, cy + 5, 4.5, cardH - 10, 2.5);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = gb.isOwnGoal ? '#fda4af' : gb.isMyGoal ? '#fde047' : '#ffffff';
    ctx.font = '800 12.5px "Noto Sans Thai", sans-serif';
    ctx.fillText(title, cx + 3, cy + 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.font = '600 10px "Noto Sans Thai", sans-serif';
    ctx.fillText(sub, cx + 3, cy + 29);
    ctx.restore();
  }

  // 8b. Card Broadcast Banner (Yellow / 2nd Yellow / Direct Red)
  if (world.cardBanner && world.cardBanner.ttl > 0 && !world.goalBanner && !world.varReview) {
    const cb = world.cardBanner;
    const prog = clamp(1 - cb.ttl / Math.max(0.01, cb.maxTtl), 0, 1);
    const enterT = clamp(prog / 0.2, 0, 1);
    const fadeOut = clamp(cb.ttl / 0.35, 0, 1);
    const alpha = Math.min(clamp(enterT * 2.5, 0, 1), fadeOut);
    const isRed = cb.type === 'R' || cb.type === 'Y2R';
    const accent = isRed ? '#ef4444' : '#facc15';
    const rawTitle =
      cb.type === 'R'
        ? `ใบแดงไล่ออก!! ${cb.shortName}`
        : cb.type === 'Y2R'
          ? `เหลืองที่สอง (ใบแดง)!! ${cb.shortName}`
          : `ใบเหลือง · ${cb.shortName}`;
    const rawSub = isRed ? `${cb.teamName} เหลือผู้เล่นน้อยกว่า` : `${cb.teamName} · เตือนจังหวะเข้าหนัก`;
    const maxBannerW = cssW - 24;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '800 11.5px "Noto Sans Thai", sans-serif';
    const title = fitCanvasText(ctx, rawTitle, maxBannerW - 44);
    const w1 = measureTextCached(ctx, title);
    ctx.font = '600 9.5px "Noto Sans Thai", sans-serif';
    const sub = fitCanvasText(ctx, rawSub, maxBannerW - 44);
    const w2 = measureTextCached(ctx, sub);
    const cardW = clamp(Math.max(w1, w2) + 46, 178, maxBannerW);
    const cardH = 38;
    const cx = cssW / 2;
    const cy = Math.round(padTop + 6);
    drawSoftRoundedShadow(ctx, cx - cardW / 2, cy, cardW, cardH, 10, 3, 2.5);
    ctx.fillStyle = 'rgba(11, 18, 28, 0.94)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    // Mini card icon badge on left (overlapping yellow+red for Y2R, single card for Y/R)
    if (cb.type === 'Y2R') {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2 + 8, cy + 8, 9, 14, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2 + 13, cy + 12, 9, 14, 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = accent;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2 + 10, cy + 9, 12, 18, 2.5);
      ctx.fill();
      ctx.stroke();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = '800 11.5px "Noto Sans Thai", sans-serif';
    ctx.fillText(title, cx - cardW / 2 + 29, cy + 13.5);
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = '600 9.5px "Noto Sans Thai", sans-serif';
    ctx.fillText(sub, cx - cardW / 2 + 29, cy + 27);
    ctx.restore();
  }

  // 8c. Sideline Coach Speech Bubbles & Mood Emoticons (drawn above players/nameplates/FX so never occluded)
  if (coachSpeechDrawQueue.length > 0 && !world.varReview) {
    const bothShouting =
      coachSpeechDrawQueue.filter((item) => Boolean(item.c.shoutText && item.c.shoutTimer > 0)).length >= 2;
    const midSplitX = px(50);
    const touchBot = padY + ph;

    // Pass 1: Coach Speech Bubbles
    coachSpeechDrawQueue.forEach(({ c, cx, cy, cr, kit }) => {
      if (!(c.shoutText && c.shoutTimer > 0)) return;
      const sAlpha = clamp(c.shoutTimer / 0.4, 0, 1);
      ctx.save();
      ctx.globalAlpha = sAlpha;
      ctx.font = '700 9px "Noto Sans Thai", sans-serif';
      const maxShoutW = bothShouting ? Math.max(58, cssW * 0.24) : Math.max(72, cssW * 0.32);
      const shoutStr = fitCanvasText(ctx, c.shoutText, maxShoutW);
      const sw = measureTextCached(ctx, shoutStr) + 14;
      const sh = 16;
      let bx: number;
      if (bothShouting) {
        if (c.side === 'H') {
          bx = clamp(cx - sw * 0.72, 6, Math.max(6, midSplitX - sw - 4));
        } else {
          bx = clamp(cx - sw * 0.28, Math.min(cssW - sw - 6, midSplitX + 4), cssW - sw - 6);
        }
      } else if (c.side === 'H') {
        bx = clamp(cx - sw / 2, 6, Math.max(6, midSplitX - sw * 0.35));
      } else {
        bx = clamp(cx - sw / 2, Math.min(cssW - sw - 6, midSplitX - sw * 0.65), cssW - sw - 6);
      }
      const by = clamp(cy - cr - sh - 5.5, 4, cssH - sh - 4);
      const tailX = clamp(cx, bx + 6, bx + sw - 6);

      drawSoftRoundedShadow(ctx, bx, by, sw, sh, 5.5, 2, 1.5);
      ctx.fillStyle = 'rgba(7, 19, 13, 0.96)';
      ctx.strokeStyle = c.isUserCoach ? '#facc15' : kit;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(bx, by, sw, sh, 5.5);
      ctx.fill();
      ctx.stroke();

      // Pointer tail directed at the coach
      ctx.fillStyle = 'rgba(7, 19, 13, 0.96)';
      ctx.beginPath();
      ctx.moveTo(tailX - 3, by + sh - 0.6);
      ctx.lineTo(tailX, by + sh + 3.8);
      ctx.lineTo(tailX + 3, by + sh - 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.isUserCoach ? '#facc15' : kit;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(tailX - 2.8, by + sh);
      ctx.lineTo(tailX, by + sh + 3.8);
      ctx.lineTo(tailX + 2.8, by + sh);
      ctx.stroke();

      ctx.fillStyle = c.isUserCoach ? '#fde047' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shoutStr, bx + sw / 2, by + sh / 2 + 0.3);
      ctx.restore();
    });

    // Pass 2: Coach Mood Emojis (no background, placed cleanly in unobstructed sideline apron beside coach)
    coachSpeechDrawQueue.forEach(({ c, cx, cy, cr, warmupPhase }) => {
      if ((c.shoutText && c.shoutTimer > 0) || !c.moodEmoji || (c.moodTimer || 0) <= 0) return;
      const mTimer = c.moodTimer || 0;
      const mAlpha = clamp(mTimer / 0.35, 0, 1);
      const bob = Math.sin(warmupPhase * 1.8 + (c.side === 'H' ? 0 : 1.5)) * 1.0;
      const emSize = Math.round(clamp(cr * 1.65, 12, 15));
      const emOffset = cr + 9.5;
      let emX: number;
      if (c.side === 'H') {
        const innerX = cx + emOffset;
        emX = innerX <= midSplitX - 8 ? innerX : Math.max(10, cx - emOffset);
      } else {
        const innerX = cx - emOffset;
        emX = innerX >= midSplitX + 8 ? innerX : Math.min(cssW - 10, cx + emOffset);
      }
      const emY = clamp(cy - cr * 0.35 + bob, touchBot + emSize * 0.52, cssH - emSize * 0.55);

      ctx.save();
      ctx.globalAlpha = mAlpha;
      ctx.font = `${emSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", Sarabun, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.moodEmoji, emX, emY + 0.5);
      ctx.restore();
    });
  }

  // 9. VAR Check Broadcast Box & Mini Picture-in-Picture Replay Monitor
  if (world.varReview) {
    const vr = world.varReview;
    const pct = clamp(1 - vr.waitSec / Math.max(0.1, vr.totalSec), 0, 1);
    const accent = vr.kind === 'foul_card' ? '#f59e0b' : '#38bdf8';
    const rep = vr.replay;

    const verdictPositiveForCall =
      vr.kind === 'goal'
        ? !vr.overturn
        : vr.kind === 'penalty'
          ? !vr.overturn
          : vr.pendingCardUpgrade !== 'R';
    const verdictColor =
      vr.kind === 'goal'
        ? vr.overturn
          ? '#ef4444'
          : '#22c55e'
        : vr.kind === 'penalty'
          ? vr.overturn
            ? '#38bdf8'
            : '#ef4444'
          : vr.pendingCardUpgrade === 'R'
            ? '#ef4444'
            : '#facc15';
    const showVerdict = pct >= 0.72;
    const frameAccent = showVerdict ? verdictColor : accent;

    // 9a. Subtle VAR Incident Spotlight Ring on Main Pitch
    const incPitchX = px(rep?.incidentX ?? vr.x);
    const incPitchY = py(rep?.incidentY ?? vr.y);
    ctx.save();
    const pulseR = 13 + Math.sin(pct * Math.PI * 8) * 2.5;
    ctx.strokeStyle = frameAccent;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(incPitchX, incPitchY, pulseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 9b. Compact Single-Row Top Broadcast Header Bar
    ctx.save();
    const boxW = Math.min(410, cssW - 24);
    const boxH = 26;
    const cx = cssW / 2;
    const cy = Math.round(padTop + 5);
    drawSoftRoundedShadow(ctx, cx - boxW / 2, cy, boxW, boxH, 7, 2.5, 2);
    ctx.fillStyle = 'rgba(11, 25, 44, 0.95)';
    ctx.strokeStyle = frameAccent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2, cy, boxW, boxH, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = frameAccent;
    ctx.beginPath();
    ctx.arc(cx - boxW / 2 + 12, cy + 12, 3.2, 0, Math.PI * 2);
    ctx.fill();

    const kindShort =
      vr.kind === 'goal'
        ? 'VAR เช็กประตู'
        : vr.kind === 'foul_card'
          ? 'VAR เช็กใบแดง'
          : 'VAR เช็กจุดโทษ';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = frameAccent;
    ctx.font = '800 10.5px "Noto Sans Thai", sans-serif';
    const prefixStr = `${kindShort} · `;
    const prefixW = measureTextCached(ctx, prefixStr);
    const textStartX = cx - boxW / 2 + 20;
    ctx.fillText(prefixStr, textStartX, cy + 12.5);

    ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
    ctx.font = '600 10.5px "Noto Sans Thai", sans-serif';
    const remW = Math.max(48, boxW - 28 - prefixW);
    ctx.fillText(fitCanvasText(ctx, vr.reasonText, remW), textStartX + prefixW, cy + 12.5);

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(cx - boxW / 2 + 8, cy + boxH - 4, boxW - 16, 2);
    ctx.fillStyle = frameAccent;
    ctx.fillRect(cx - boxW / 2 + 8, cy + boxH - 4, (boxW - 16) * pct, 2);
    ctx.restore();

    // 9c. Taller Picture-in-Picture VAR Replay Monitor Screen (matching external VAR modal)
    const monW = clamp(pw * 0.44, 188, 340);
    const monH = clamp(ph * 0.68, 132, 248);
    const incidentOnRight = (rep?.incidentX ?? vr.x) >= 50;
    const monX = incidentOnRight ? Math.round(padX + 10) : Math.round(padX + pw - monW - 10);
    const monY = Math.max(Math.round(padTop + 36), Math.round(padY + (ph - monH) * 0.52));
    renderVarMonitorPanel(
      ctx,
      vr,
      pct,
      monX,
      monY,
      monW,
      monH,
      pw / Math.max(1, ph),
      homeKit,
      awayKit,
      homeGkKit,
      awayGkKit,
      homeTrim,
      awayTrim,
      false,
      'wide'
    );
  }

};

export type HighlightCameraMode = 'broadcast' | 'wide';

interface HlSampledAgent {
  idx: number;
  x: number;
  y: number;
  facing: number;
  vx: number;
  vy: number;
  act: number;
  dd: number;
  ap: number;
}

let hlPitchBgCache: { key: string; canvas: HTMLCanvasElement } | null = null;
const HL_BG_W = 1360;
const HL_BG_H = 820;
const HL_PAD_X = 58;
const HL_PAD_TOP = 80;
const HL_PAD_BOT = 80;
const HL_PW = HL_BG_W - HL_PAD_X * 2;
const HL_PH = HL_BG_H - HL_PAD_TOP - HL_PAD_BOT;

const getHighlightWorldBgCache = (
  env: MatchHighlightClip['matchEnv'],
  homeKit: string,
  awayKit: string,
  homeTrim: string,
  awayTrim: string
): { canvas: HTMLCanvasElement; apronFill: string } | null => {
  if (typeof document === 'undefined') return null;

  const isRainy = env?.season === 'rainy';
  const isNight = env?.timeOfDay === 'night';
  const turfSpec = getTurfGradeSpec(env?.turfGrade);
  const turfCond = clamp(Math.round(env?.turfCond ?? 100), 30, 100);
  const grassLength =
    env?.grassLength ||
    (turfSpec.cutStyle === 'patchy'
      ? 'long'
      : turfSpec.cutStyle === 'checker' || turfSpec.cutStyle === 'hybrid_pro'
        ? 'short'
        : 'medium');
  const dirtMix = clamp(
    env?.dirtMix ??
      (turfSpec.cutStyle === 'patchy' ? Math.max(0.35, (100 - turfCond) / 70) : turfCond < 75 ? (78 - turfCond) / 65 : 0),
    0,
    0.92
  );
  const pitchSeed = env?.pitchSeed ?? 137;
  const stadiumStyle = env?.stadiumStyle || 'modern_bowl';

  const [stripeEven, stripeOdd, apronFill] = isNight
    ? isRainy
      ? turfSpec.palette.nightRainy
      : turfSpec.palette.night
    : isRainy
      ? turfSpec.palette.rainy
      : turfSpec.palette.day;

  let puddleSig = '';
  if (isRainy && env?.puddles?.length) {
    const cachedSig = puddleSigCache.get(env.puddles);
    if (cachedSig !== undefined) {
      puddleSig = cachedSig;
    } else {
      puddleSig = env.puddles
        .map((pd) => `${pd.x.toFixed(1)},${pd.y.toFixed(1)},${pd.rx.toFixed(1)},${pd.ry.toFixed(1)},${pd.rot.toFixed(2)},${pd.alpha.toFixed(2)}`)
        .join(';');
      puddleSigCache.set(env.puddles, puddleSig);
    }
  }

  const perimeterSig = getPerimeterSig(resolvePitchPerimeterBrands(env));
  const key = `hl|${stadiumStyle}|${turfSpec.id}|${Math.round(turfCond / 5)}|${grassLength}|${Math.round(dirtMix * 20)}|${pitchSeed}|${isRainy ? 'r' : 's'}|${isNight ? 'n' : 'd'}|${(env?.sunAngle ?? 0.4).toFixed(2)}|${puddleSig}|${homeKit}|${awayKit}|${homeTrim}|${awayTrim}|${perimeterSig}`;

  if (hlPitchBgCache && hlPitchBgCache.key === key) {
    return { canvas: hlPitchBgCache.canvas, apronFill };
  }

  const bgCanvas = hlPitchBgCache?.canvas || document.createElement('canvas');
  if (bgCanvas.width !== HL_BG_W || bgCanvas.height !== HL_BG_H) {
    bgCanvas.width = HL_BG_W;
    bgCanvas.height = HL_BG_H;
  }
  const bctx = bgCanvas.getContext('2d');
  if (!bctx) return null;

  const padX = HL_PAD_X;
  const padY = HL_PAD_TOP;
  const pw = HL_PW;
  const ph = HL_PH;
  const pxW = (x: number) => padX + (x / 100) * pw;
  const pyW = (y: number) => padY + (y / 100) * ph;

  // 1. Stadium apron & architectural surround (exact live-match match)
  bctx.fillStyle = apronFill;
  bctx.fillRect(0, 0, HL_BG_W, HL_BG_H);

  bctx.save();
  if (stadiumStyle === 'open_track') {
    const trackPadX = Math.max(8, padX * 0.2);
    const trackPadY = Math.max(10, padY * 0.18);
    bctx.fillStyle = isNight ? 'rgba(138, 62, 46, 0.55)' : 'rgba(176, 82, 58, 0.58)';
    bctx.beginPath();
    bctx.roundRect(trackPadX, trackPadY, HL_BG_W - trackPadX * 2, HL_BG_H - trackPadY * 2, 48);
    bctx.fill();
    bctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    bctx.lineWidth = 2;
    for (let lane = 1; lane <= 3; lane++) {
      const inset = lane * 9;
      bctx.beginPath();
      bctx.roundRect(
        trackPadX + inset,
        trackPadY + inset,
        HL_BG_W - (trackPadX + inset) * 2,
        HL_BG_H - (trackPadY + inset) * 2,
        Math.max(16, 48 - inset)
      );
      bctx.stroke();
    }
  } else if (stadiumStyle === 'fortress_kop') {
    bctx.strokeStyle = isNight ? 'rgba(239, 68, 68, 0.36)' : 'rgba(185, 28, 28, 0.38)';
    bctx.lineWidth = 10;
    bctx.strokeRect(padX - 12, padY - 12, pw + 24, ph + 24);
    bctx.strokeStyle = 'rgba(255,255,255,0.18)';
    bctx.lineWidth = 3;
    bctx.strokeRect(padX - 20, padY - 20, pw + 40, ph + 40);
  } else if (stadiumStyle === 'thai_heritage') {
    bctx.strokeStyle = isNight ? 'rgba(244, 198, 61, 0.45)' : 'rgba(217, 159, 28, 0.48)';
    bctx.lineWidth = 5;
    bctx.strokeRect(padX - 14, padY - 14, pw + 28, ph + 28);
    const cornerSize = 26;
    bctx.fillStyle = 'rgba(244, 198, 61, 0.32)';
    [
      [padX - 18, padY - 18],
      [padX + pw - 8, padY - 18],
      [padX - 18, padY + ph - 8],
      [padX + pw - 8, padY + ph - 8]
    ].forEach(([cx, cy]) => {
      bctx.fillRect(cx, cy, cornerSize, cornerSize);
    });
  } else if (stadiumStyle === 'glass_pavilion') {
    bctx.strokeStyle = isNight ? 'rgba(125, 211, 252, 0.48)' : 'rgba(186, 230, 253, 0.56)';
    bctx.lineWidth = 5;
    bctx.strokeRect(padX - 12, padY - 12, pw + 24, ph + 24);
    const glassH = Math.max(12, padY - 22);
    bctx.fillStyle = 'rgba(125, 211, 252, 0.12)';
    bctx.fillRect(padX - 24, 6, pw + 48, glassH);
    bctx.fillRect(padX - 24, HL_BG_H - 6 - glassH, pw + 48, glassH);
  } else if (stadiumStyle === 'cyber_dome') {
    bctx.strokeStyle = isNight ? 'rgba(34, 211, 238, 0.65)' : 'rgba(56, 189, 248, 0.5)';
    bctx.lineWidth = 6;
    bctx.beginPath();
    bctx.roundRect(padX - 18, padY - 18, pw + 36, ph + 36, 30);
    bctx.stroke();
    bctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    bctx.lineWidth = 2.4;
    bctx.beginPath();
    bctx.roundRect(padX - 28, padY - 28, pw + 56, ph + 56, 38);
    bctx.stroke();
  } else {
    bctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    bctx.lineWidth = 4;
    bctx.beginPath();
    bctx.roundRect(padX - 14, padY - 14, pw + 28, ph + 28, 20);
    bctx.stroke();
  }
  bctx.restore();

  // Top, Left & Right Perimeter Dealer / Partner LED Boards
  drawPitchPerimeterDealerBoards(bctx, { padX, padTop: padY, pw, ph, isNight, env });

  // 2. Multi-grade mowed turf stripes
  const stripeCount =
    turfSpec.cutStyle === 'patchy'
      ? 8
      : turfSpec.cutStyle === 'bands'
        ? 10
        : turfSpec.cutStyle === 'hybrid_pro'
          ? 14
          : 12;
  const stripeW = pw / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    bctx.fillStyle = i % 2 === 0 ? stripeEven : stripeOdd;
    bctx.fillRect(padX + i * stripeW, padY, stripeW + 1, ph);
  }

  if (turfSpec.cutStyle === 'checker' || turfSpec.cutStyle === 'hybrid_pro') {
    const rowBands = turfSpec.cutStyle === 'hybrid_pro' ? 8 : 7;
    const bandH = ph / rowBands;
    bctx.save();
    bctx.beginPath();
    bctx.rect(padX, padY, pw, ph);
    bctx.clip();
    for (let r = 0; r < rowBands; r++) {
      if (r % 2 === 0) {
        bctx.fillStyle = turfSpec.cutStyle === 'hybrid_pro' ? 'rgba(6, 36, 20, 0.085)' : 'rgba(6, 34, 18, 0.075)';
        bctx.fillRect(padX, padY + r * bandH, pw, bandH + 1);
      }
    }
    if (turfSpec.cutStyle === 'hybrid_pro') {
      bctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
      bctx.lineWidth = Math.max(16, ph * 0.045);
      bctx.beginPath();
      bctx.arc(pxW(50), pyW(50), ph * 0.22, 0, Math.PI * 2);
      bctx.stroke();

      bctx.strokeStyle = 'rgba(6, 32, 18, 0.14)';
      bctx.lineWidth = Math.max(8, pw * 0.008);
      bctx.strokeRect(padX + 4, padY + 4, pw - 8, ph - 8);
    }
    bctx.restore();
  } else if (turfSpec.cutStyle === 'pro_bands') {
    bctx.save();
    bctx.strokeStyle = 'rgba(6, 32, 18, 0.1)';
    bctx.lineWidth = Math.max(6, pw * 0.006);
    bctx.strokeRect(padX + 3, padY + 3, pw - 6, ph - 6);
    bctx.restore();
  }

  // Seeded organic turf details (blotches, blades/roller lines, dirt/clay patches)
  let rngState = (pitchSeed ^ 0x9e3779b9) >>> 0;
  const nextRand = () => {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  bctx.save();
  bctx.beginPath();
  bctx.rect(padX, padY, pw, ph);
  bctx.clip();

  if (grassLength !== 'short' || dirtMix > 0.08) {
    const blotchCount = grassLength === 'long' ? 24 : 12;
    for (let i = 0; i < blotchCount; i++) {
      const bx = padX + nextRand() * pw;
      const by = padY + nextRand() * ph;
      const br = Math.max(20, (0.04 + nextRand() * 0.09) * pw);
      const bGrad = bctx.createRadialGradient(bx, by, br * 0.1, bx, by, br);
      const darkOrWarm = nextRand() > 0.42;
      const op = grassLength === 'long' ? 0.13 : 0.065;
      bGrad.addColorStop(
        0,
        darkOrWarm
          ? `rgba(10, 38, 16, ${op})`
          : isRainy
            ? `rgba(42, 86, 36, ${op * 0.9})`
            : `rgba(88, 128, 42, ${op * 0.95})`
      );
      bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      bctx.fillStyle = bGrad;
      bctx.beginPath();
      bctx.ellipse(bx, by, br, br * (0.55 + nextRand() * 0.45), nextRand() * Math.PI, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  if (grassLength === 'short') {
    bctx.strokeStyle = isNight ? 'rgba(255, 255, 255, 0.024)' : 'rgba(255, 255, 255, 0.036)';
    bctx.lineWidth = 1.6;
    const microStep = Math.max(8, ph / 48);
    for (let yLine = padY + microStep; yLine < padY + ph; yLine += microStep) {
      bctx.beginPath();
      bctx.moveTo(padX, yLine);
      bctx.lineTo(padX + pw, yLine);
      bctx.stroke();
    }
  } else {
    const tuftCount = grassLength === 'long' ? 280 : 120;
    const bladeH = grassLength === 'long' ? Math.max(6.4, ph * 0.015) : Math.max(3.6, ph * 0.0085);
    for (let i = 0; i < tuftCount; i++) {
      const tx = padX + 8 + nextRand() * (pw - 16);
      const ty = padY + 8 + nextRand() * (ph - 16);
      const isSunTip = nextRand() > 0.45;
      bctx.strokeStyle = isSunTip
        ? isRainy
          ? 'rgba(84, 152, 74, 0.34)'
          : 'rgba(128, 188, 76, 0.36)'
        : 'rgba(8, 36, 16, 0.38)';
      bctx.lineWidth = grassLength === 'long' ? 2 : 1.5;
      bctx.beginPath();
      bctx.moveTo(tx - 2.2, ty);
      bctx.lineTo(tx - 3.6 - nextRand() * 1.6, ty - bladeH * (0.7 + nextRand() * 0.45));
      bctx.moveTo(tx, ty + 0.6);
      bctx.lineTo(tx + (nextRand() - 0.5) * 2.8, ty - bladeH * (0.85 + nextRand() * 0.4));
      if (grassLength === 'long') {
        bctx.moveTo(tx + 2.2, ty);
        bctx.lineTo(tx + 3.8 + nextRand() * 1.6, ty - bladeH * (0.65 + nextRand() * 0.45));
      }
      bctx.stroke();
    }
  }

  if (dirtMix > 0.04) {
    const wearZones: { x: number; y: number; rx: number; ry: number; weight: number }[] = [
      { x: 4.5, y: 50, rx: 4.6, ry: 12.2, weight: 1.0 },
      { x: 95.5, y: 50, rx: 4.6, ry: 12.2, weight: 1.0 },
      { x: 50, y: 50, rx: 5.8, ry: 8.8, weight: 0.9 },
      { x: 11.5, y: 50, rx: 3.1, ry: 5.0, weight: 0.85 },
      { x: 88.5, y: 50, rx: 3.1, ry: 5.0, weight: 0.85 },
      { x: 24, y: 14, rx: 4.0, ry: 3.5, weight: 0.55 },
      { x: 76, y: 86, rx: 4.0, ry: 3.5, weight: 0.55 }
    ];
    const extraSpots = Math.round(dirtMix * 16);
    for (let i = 0; i < extraSpots; i++) {
      wearZones.push({
        x: 8 + nextRand() * 84,
        y: 8 + nextRand() * 84,
        rx: 2.2 + nextRand() * (3.6 + dirtMix * 3.2),
        ry: 1.8 + nextRand() * (3.2 + dirtMix * 2.6),
        weight: 0.45 + nextRand() * 0.55
      });
    }
    wearZones.forEach((wz) => {
      const cxW = pxW(wz.x);
      const cyW = pyW(wz.y);
      const rxW = Math.max(14, (wz.rx / 100) * pw * (0.78 + dirtMix * 0.42));
      const ryW = Math.max(12, (wz.ry / 100) * ph * (0.78 + dirtMix * 0.42));
      const maxR = Math.max(rxW, ryW);
      const coreAlpha = clamp(dirtMix * wz.weight * (isRainy ? 0.62 : 0.56), 0.08, 0.66);

      const wGrad = bctx.createRadialGradient(cxW, cyW, maxR * 0.12, cxW, cyW, maxR);
      if (isRainy) {
        wGrad.addColorStop(0, `rgba(74, 48, 27, ${coreAlpha})`);
        wGrad.addColorStop(0.55, `rgba(88, 60, 34, ${coreAlpha * 0.7})`);
        wGrad.addColorStop(1, 'rgba(62, 46, 26, 0)');
      } else {
        wGrad.addColorStop(0, `rgba(142, 102, 58, ${coreAlpha})`);
        wGrad.addColorStop(0.55, `rgba(124, 96, 52, ${coreAlpha * 0.68})`);
        wGrad.addColorStop(1, 'rgba(105, 88, 46, 0)');
      }
      bctx.fillStyle = wGrad;
      bctx.beginPath();
      bctx.ellipse(cxW, cyW, rxW, ryW, (nextRand() - 0.5) * 0.5, 0, Math.PI * 2);
      bctx.fill();

      const speckCount = Math.round(4 + dirtMix * 12 * wz.weight);
      for (let s = 0; s < speckCount; s++) {
        const ang = nextRand() * Math.PI * 2;
        const dist = Math.sqrt(nextRand()) * 0.72;
        const sx = cxW + Math.cos(ang) * rxW * dist;
        const sy = cyW + Math.sin(ang) * ryW * dist;
        const sr = 1.4 + nextRand() * 2.8;
        bctx.fillStyle = isRainy
          ? nextRand() > 0.5
            ? `rgba(48, 30, 16, ${clamp(coreAlpha * 0.9, 0.15, 0.65)})`
            : `rgba(98, 68, 40, ${clamp(coreAlpha * 0.75, 0.12, 0.5)})`
          : nextRand() > 0.45
            ? `rgba(112, 74, 38, ${clamp(coreAlpha * 0.9, 0.15, 0.62)})`
            : `rgba(176, 138, 86, ${clamp(coreAlpha * 0.72, 0.12, 0.48)})`;
        bctx.beginPath();
        bctx.arc(sx, sy, sr, 0, Math.PI * 2);
        bctx.fill();
      }
    });
  }
  bctx.restore();

  // Rainy-season puddles
  if (isRainy && env?.puddles?.length) {
    env.puddles.forEach((pd) => {
      const cxP = pxW(pd.x);
      const cyP = pyW(pd.y);
      const rX = Math.max(16, (pd.rx / 100) * pw);
      const rY = Math.max(10, (pd.ry / 100) * ph);

      bctx.save();
      bctx.translate(cxP, cyP);
      bctx.rotate(pd.rot);

      bctx.fillStyle = isNight ? 'rgba(4, 18, 12, 0.26)' : 'rgba(6, 26, 16, 0.2)';
      bctx.beginPath();
      bctx.ellipse(0, 0, rX * 1.24, rY * 1.24, 0, 0, Math.PI * 2);
      bctx.fill();

      const wGrad = bctx.createRadialGradient(-rX * 0.22, -rY * 0.22, rX * 0.08, 0, 0, rX);
      if (isNight) {
        wGrad.addColorStop(0, `rgba(186, 230, 253, ${pd.alpha + 0.08})`);
        wGrad.addColorStop(0.55, `rgba(125, 211, 252, ${pd.alpha * 0.72})`);
        wGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      } else {
        wGrad.addColorStop(0, `rgba(219, 244, 255, ${pd.alpha + 0.06})`);
        wGrad.addColorStop(0.55, `rgba(147, 210, 235, ${pd.alpha * 0.68})`);
        wGrad.addColorStop(1, 'rgba(125, 211, 252, 0)');
      }
      bctx.fillStyle = wGrad;
      bctx.beginPath();
      bctx.ellipse(0, 0, rX, rY, 0, 0, Math.PI * 2);
      bctx.fill();

      bctx.strokeStyle = isNight ? 'rgba(224, 242, 254, 0.22)' : 'rgba(240, 249, 255, 0.26)';
      bctx.lineWidth = 1.6;
      bctx.beginPath();
      bctx.ellipse(0, 0, rX * 0.78, rY * 0.78, 0, -2.5, -0.8);
      bctx.stroke();
      bctx.restore();
    });
  }

  // Atmospheric lighting (Night Floodlights / Sunbeams / Rainy Overcast)
  if (isNight) {
    const nightVig = bctx.createRadialGradient(HL_BG_W * 0.5, HL_BG_H * 0.5, pw * 0.24, HL_BG_W * 0.5, HL_BG_H * 0.5, HL_BG_W * 0.72);
    nightVig.addColorStop(0, 'rgba(255, 252, 230, 0.05)');
    nightVig.addColorStop(0.62, 'rgba(6, 15, 28, 0.14)');
    nightVig.addColorStop(1, 'rgba(2, 6, 16, 0.56)');
    bctx.fillStyle = nightVig;
    bctx.fillRect(0, 0, HL_BG_W, HL_BG_H);

    const corners: [number, number][] = [
      [16, 16],
      [HL_BG_W - 16, 16],
      [16, HL_BG_H - 16],
      [HL_BG_W - 16, HL_BG_H - 16]
    ];
    corners.forEach(([fx, fy]) => {
      const cone = bctx.createRadialGradient(fx, fy, 4, HL_BG_W * 0.5, HL_BG_H * 0.5, HL_BG_W * 0.62);
      cone.addColorStop(0, isRainy ? 'rgba(215, 238, 255, 0.28)' : 'rgba(255, 248, 215, 0.3)');
      cone.addColorStop(0.32, isRainy ? 'rgba(186, 230, 253, 0.09)' : 'rgba(254, 243, 199, 0.1)');
      cone.addColorStop(1, 'rgba(255, 255, 255, 0)');
      bctx.fillStyle = cone;
      bctx.fillRect(0, 0, HL_BG_W, HL_BG_H);

      bctx.save();
      bctx.fillStyle = isRainy ? 'rgba(224, 242, 254, 0.92)' : 'rgba(254, 249, 195, 0.94)';
      bctx.beginPath();
      bctx.arc(fx, fy, 6.5, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    });
  } else if (!isRainy) {
    const sunX = HL_BG_W * (0.78 + Math.sin(env?.sunAngle ?? 0.4) * 0.12);
    const sunY = HL_BG_H * 0.06;
    const sunGlow = bctx.createRadialGradient(sunX, sunY, 16, sunX, sunY, HL_BG_W * 0.72);
    sunGlow.addColorStop(0, 'rgba(255, 244, 179, 0.24)');
    sunGlow.addColorStop(0.35, 'rgba(253, 224, 71, 0.09)');
    sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    bctx.fillStyle = sunGlow;
    bctx.fillRect(0, 0, HL_BG_W, HL_BG_H);

    const beamGrad = bctx.createLinearGradient(sunX, 0, HL_BG_W * 0.2, HL_BG_H);
    beamGrad.addColorStop(0, 'rgba(255, 246, 195, 0.1)');
    beamGrad.addColorStop(0.55, 'rgba(255, 246, 195, 0.03)');
    beamGrad.addColorStop(1, 'rgba(6, 26, 14, 0.14)');
    bctx.fillStyle = beamGrad;
    bctx.fillRect(0, 0, HL_BG_W, HL_BG_H);
  } else {
    const sheen = bctx.createRadialGradient(HL_BG_W * 0.5, HL_BG_H * 0.5, pw * 0.12, HL_BG_W * 0.5, HL_BG_H * 0.5, pw * 0.68);
    sheen.addColorStop(0, 'rgba(215, 232, 238, 0.06)');
    sheen.addColorStop(1, 'rgba(4, 16, 11, 0.24)');
    bctx.fillStyle = sheen;
    bctx.fillRect(0, 0, HL_BG_W, HL_BG_H);
  }

  // 3. Crisp Chalk Markings
  const chalkAlpha = dirtMix > 0.35 ? 0.72 : dirtMix > 0.1 ? 0.82 : 0.9;
  bctx.strokeStyle = `rgba(242, 249, 242, ${chalkAlpha})`;
  bctx.lineWidth = 3.2;
  bctx.strokeRect(padX, padY, pw, ph);

  bctx.beginPath();
  bctx.moveTo(pxW(50), pyW(0));
  bctx.lineTo(pxW(50), pyW(100));
  bctx.stroke();

  bctx.beginPath();
  bctx.arc(pxW(50), pyW(50), ph * 0.155, 0, Math.PI * 2);
  bctx.stroke();

  bctx.fillStyle = 'rgba(240,248,240,0.92)';
  bctx.beginPath();
  bctx.arc(pxW(50), pyW(50), 5, 0, Math.PI * 2);
  bctx.fill();

  const boxTop = pyW(21);
  const boxH = ph * 0.58;
  const boxW = pw * 0.165;
  const sixTop = pyW(36.5);
  const sixH = ph * 0.27;
  const sixW = pw * 0.055;

  bctx.strokeRect(padX, boxTop, boxW, boxH);
  bctx.strokeRect(padX + pw - boxW, boxTop, boxW, boxH);
  bctx.strokeRect(padX, sixTop, sixW, sixH);
  bctx.strokeRect(padX + pw - sixW, sixTop, sixW, sixH);

  const leftSpotX = pxW(11);
  const rightSpotX = pxW(89);
  const spotY = pyW(50);
  bctx.beginPath();
  bctx.arc(leftSpotX, spotY, 4, 0, Math.PI * 2);
  bctx.arc(rightSpotX, spotY, 4, 0, Math.PI * 2);
  bctx.fill();

  const spotToBoxDx = Math.max(8, padX + boxW - leftSpotX);
  const penArcR = Math.max(spotToBoxDx * 1.44, ph * 0.145);
  const penArcAng = Math.acos(clamp(spotToBoxDx / penArcR, -0.96, 0.96));
  bctx.beginPath();
  bctx.arc(leftSpotX, spotY, penArcR, -penArcAng, penArcAng);
  bctx.stroke();
  bctx.beginPath();
  bctx.arc(rightSpotX, spotY, penArcR, Math.PI - penArcAng, Math.PI + penArcAng);
  bctx.stroke();

  const cr = Math.max(10, ph * 0.032);
  [
    [padX, padY, 0, Math.PI / 2],
    [padX + pw, padY, Math.PI / 2, Math.PI],
    [padX + pw, padY + ph, Math.PI, Math.PI * 1.5],
    [padX, padY + ph, Math.PI * 1.5, Math.PI * 2]
  ].forEach(([cx, cy, sa, ea]) => {
    bctx.beginPath();
    bctx.arc(cx, cy, cr, sa, ea);
    bctx.stroke();
  });

  // 4. Sideline Technical Areas, Dugouts & Warm-up Mats (matches real live pitch!)
  const touchBot = padY + ph;
  const zoneH = 56;
  const zoneTop = touchBot + Math.round((HL_PAD_BOT - zoneH) * 0.5);
  const techH = zoneH;

  const drawHlTechArea = (x0Pct: number, x1Pct: number, kit: string, trim: string) => {
    const tx0 = pxW(x0Pct);
    const tw = pxW(x1Pct) - tx0;
    bctx.save();
    bctx.fillStyle = 'rgba(6, 20, 13, 0.34)';
    bctx.beginPath();
    bctx.roundRect(tx0, zoneTop, tw, techH, 5);
    bctx.fill();
    bctx.strokeStyle = 'rgba(255, 255, 255, 0.56)';
    bctx.lineWidth = 1.8;
    bctx.setLineDash([6, 4.5]);
    bctx.strokeRect(tx0 + 1, zoneTop + 1, tw - 2, techH - 2);
    bctx.setLineDash([]);
    bctx.fillStyle = kit;
    bctx.beginPath();
    bctx.roundRect(tx0 + 6, zoneTop + techH - 4.4, tw - 12, 2.8, 1.4);
    bctx.fill();
    bctx.fillStyle = trim;
    bctx.globalAlpha = 0.55;
    bctx.fillRect(tx0 + 10, zoneTop + techH - 4.4, tw - 20, 1.1);
    bctx.restore();
  };
  drawHlTechArea(39.4, 47.4, homeKit, homeTrim);
  drawHlTechArea(52.6, 60.6, awayKit, awayTrim);

  const drawHlDugout = (x0Pct: number, x1Pct: number, kit: string, trim: string) => {
    const bx = pxW(x0Pct);
    const bw = pxW(x1Pct) - bx;
    const by = zoneTop;
    const bh = zoneH;
    bctx.save();
    bctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    bctx.beginPath();
    bctx.roundRect(bx + 2, by + 4, bw, bh, 10);
    bctx.fill();

    const shellGrad = bctx.createLinearGradient(bx, by, bx, by + bh);
    shellGrad.addColorStop(0, 'rgba(13, 35, 24, 0.96)');
    shellGrad.addColorStop(1, 'rgba(5, 16, 10, 0.94)');
    bctx.fillStyle = shellGrad;
    bctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    bctx.lineWidth = 2;
    bctx.beginPath();
    bctx.roundRect(bx, by, bw, bh, 10);
    bctx.fill();
    bctx.stroke();

    bctx.fillStyle = kit;
    bctx.beginPath();
    bctx.roundRect(bx + 4, by + 2.4, bw - 8, 5, 2.5);
    bctx.fill();
    bctx.fillStyle = trim;
    bctx.globalAlpha = 0.7;
    bctx.fillRect(bx + 8, by + 6.8, bw - 16, 1.4);
    bctx.globalAlpha = 1;

    const padInner = 9;
    const slotW = (bw - padInner * 2) / 5;
    const seatR = clamp(Math.min(slotW * 0.34, bh * 0.3), 8, 12.5);
    const seatY = by + bh * 0.56;
    for (let idx = 0; idx < 5; idx++) {
      const sx = bx + padInner + slotW * (idx + 0.5);
      bctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      bctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      bctx.lineWidth = 1.2;
      bctx.beginPath();
      bctx.roundRect(sx - seatR * 0.9, seatY - seatR * 0.92, seatR * 1.8, seatR * 1.84, 4);
      bctx.fill();
      bctx.stroke();
      // Bench substitute silhouette
      bctx.fillStyle = kit;
      bctx.beginPath();
      bctx.arc(sx, seatY, seatR * 0.85, 0, Math.PI * 2);
      bctx.fill();
      bctx.strokeStyle = 'rgba(255,255,255,0.72)';
      bctx.lineWidth = 1.4;
      bctx.stroke();
    }
    bctx.restore();
  };
  drawHlDugout(15.5, 36.2, homeKit, homeTrim);
  drawHlDugout(63.8, 84.5, awayKit, awayTrim);

  const drawHlWarmup = (x0Pct: number, x1Pct: number) => {
    const zx = pxW(x0Pct);
    const zw = pxW(x1Pct) - zx;
    bctx.save();
    bctx.fillStyle = 'rgba(22, 163, 74, 0.2)';
    bctx.beginPath();
    bctx.roundRect(zx, zoneTop, zw, zoneH, 9);
    bctx.fill();
    bctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    bctx.lineWidth = 1.8;
    bctx.setLineDash([6, 5]);
    bctx.beginPath();
    bctx.roundRect(zx + 1, zoneTop + 1, zw - 2, zoneH - 2, 9);
    bctx.stroke();
    bctx.setLineDash([]);
    const coneY = zoneTop + zoneH * 0.52;
    [zx + 9, zx + zw - 9].forEach((cxCone) => {
      bctx.fillStyle = '#fb923c';
      bctx.strokeStyle = '#ffffff';
      bctx.lineWidth = 1.2;
      bctx.beginPath();
      bctx.moveTo(cxCone, coneY - 4.8);
      bctx.lineTo(cxCone + 4.2, coneY + 3.2);
      bctx.lineTo(cxCone - 4.2, coneY + 3.2);
      bctx.closePath();
      bctx.fill();
      bctx.stroke();
    });
    bctx.restore();
  };
  drawHlWarmup(4.0, 13.5);
  drawHlWarmup(86.5, 96.0);

  hlPitchBgCache = { key, canvas: bgCanvas };
  return { canvas: bgCanvas, apronFill };
};

const interpolateAngle = (a0: number, a1: number, t: number): number => {
  let diff = a1 - a0;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a0 + diff * t;
};

const sampleBallOnlyAt = (frames: MatchHighlightFrame[], t: number, out: { x: number; y: number; z: number }) => {
  const n = frames.length;
  if (!n) {
    out.x = 50;
    out.y = 50;
    out.z = 0;
    return;
  }
  const ct = clamp(t, 0, 1);
  let i0 = 0;
  for (let i = 0; i < n - 1; i++) {
    if (ct >= frames[i].t) i0 = i;
    else break;
  }
  const i1 = Math.min(n - 1, i0 + 1);
  const f0 = frames[i0];
  const f1 = frames[i1];
  const span = Math.max(0.0001, f1.t - f0.t);
  const alpha = i0 === i1 ? 0 : clamp((ct - f0.t) / span, 0, 1);
  out.x = f0.bx + (f1.bx - f0.bx) * alpha;
  out.y = f0.by + (f1.by - f0.by) * alpha;
  out.z = f0.bz + (f1.bz - f0.bz) * alpha;
};

const hlP1RowBuf: ([number, number, number, number, number?, number?, number?] | undefined)[] = new Array(64);
const hlP0SeenBuf: boolean[] = new Array(64);
const hlAgentsBuf: HlSampledAgent[] = [];
const hlSortedAgentsBuf: HlSampledAgent[] = [];
const hlTrailPts: { x: number; y: number; z: number }[] = Array.from({ length: 11 }, () => ({ x: 50, y: 50, z: 0 }));
const hlShotAheadPt: { x: number; y: number; z: number } = { x: 50, y: 50, z: 0 };

const sampleHighlightFrameAt = (frames: MatchHighlightFrame[], t: number) => {
  hlAgentsBuf.length = 0;
  if (!frames.length) {
    return { bx: 50, by: 50, bz: 0, shot: false, style: undefined as string | undefined, ripL: 0, ripR: 0, car: undefined as number | undefined };
  }
  const ct = clamp(t, 0, 1);
  let i0 = 0;
  for (let i = 0; i < frames.length - 1; i++) {
    if (ct >= frames[i].t) i0 = i;
    else break;
  }
  const i1 = Math.min(frames.length - 1, i0 + 1);
  const f0 = frames[i0];
  const f1 = frames[i1];
  const span = Math.max(0.0001, f1.t - f0.t);
  const alpha = i0 === i1 ? 0 : clamp((ct - f0.t) / span, 0, 1);

  const bx = f0.bx + (f1.bx - f0.bx) * alpha;
  const by = f0.by + (f1.by - f0.by) * alpha;
  const bz = f0.bz + (f1.bz - f0.bz) * alpha;
  const ripL = (f0.ripL || 0) + ((f1.ripL || 0) - (f0.ripL || 0)) * alpha;
  const ripR = (f0.ripR || 0) + ((f1.ripR || 0) - (f0.ripR || 0)) * alpha;
  const shot = Boolean(f0.shot || f1.shot);
  const style = f1.style || f0.style;
  const car = alpha < 0.5 ? f0.car : f1.car ?? f0.car;

  // Approximate real-time sec span (~4.8s clip) for authentic stride & dust speed
  const dtSec = Math.max(0.08, span * 4.8);

  hlP1RowBuf.fill(undefined);
  hlP0SeenBuf.fill(false);
  for (let k = 0; k < f1.p.length; k++) {
    const r = f1.p[k];
    if (r[0] >= 0 && r[0] < 64) hlP1RowBuf[r[0]] = r;
  }

  for (let k = 0; k < f0.p.length; k++) {
    const r0 = f0.p[k];
    const idx = r0[0];
    if (idx >= 0 && idx < 64) hlP0SeenBuf[idx] = true;
    const r1 = idx >= 0 && idx < 64 ? hlP1RowBuf[idx] : undefined;
    if (!r1) {
      hlAgentsBuf.push({
        idx,
        x: r0[1],
        y: r0[2],
        facing: r0[3],
        vx: 0,
        vy: 0,
        act: r0[4] || 0,
        dd: r0[5] ?? 1,
        ap: r0[6] !== undefined ? clamp(r0[6] / 100, 0, 1) : 0.45
      });
    } else {
      const act0 = r0[4] || 0;
      const act1 = r1[4] || 0;
      const hasAp0 = r0[6] !== undefined;
      const hasAp1 = r1[6] !== undefined;
      const ap0 = hasAp0 ? clamp(r0[6]! / 100, 0, 1) : 0.25;
      const ap1 = hasAp1 ? clamp(r1[6]! / 100, 0, 1) : 0.85;

      let act = 0;
      let ap = 0.5;
      let dd = r1[5] ?? r0[5] ?? 1;

      if (act0 && act1 && act0 === act1) {
        act = act0;
        const endAp = ap1 >= ap0 ? ap1 : 1;
        ap = clamp(ap0 + (endAp - ap0) * alpha, 0, 1);
      } else if (act0 && !act1) {
        if (alpha < 0.65) {
          act = act0;
          dd = r0[5] ?? r1[5] ?? 1;
          ap = clamp(ap0 + (1 - ap0) * (alpha / 0.65), 0, 1);
        } else {
          act = 0;
          ap = 1;
        }
      } else if (!act0 && act1) {
        const thresh = act1 === HL_ACT.CELEBRATE ? 0.78 : 0.3;
        if (alpha >= thresh) {
          act = act1;
          dd = r1[5] ?? r0[5] ?? 1;
          ap = clamp(((alpha - thresh) / (1 - thresh)) * ap1, 0, 1);
        } else {
          act = 0;
          ap = 0;
        }
      } else if (act0 && act1) {
        const split = act1 === HL_ACT.CELEBRATE && act0 !== HL_ACT.CELEBRATE ? 0.78 : 0.5;
        if (alpha < split) {
          act = act0;
          dd = r0[5] ?? 1;
          ap = clamp(ap0 + (1 - ap0) * (alpha / split), 0, 1);
        } else {
          act = act1;
          dd = r1[5] ?? 1;
          ap = clamp(ap1 * ((alpha - split) / (1 - split)), 0, 1);
        }
      }

      hlAgentsBuf.push({
        idx,
        x: r0[1] + (r1[1] - r0[1]) * alpha,
        y: r0[2] + (r1[2] - r0[2]) * alpha,
        facing: interpolateAngle(r0[3], r1[3], alpha),
        vx: (r1[1] - r0[1]) / dtSec,
        vy: (r1[2] - r0[2]) / dtSec,
        act,
        dd,
        ap
      });
    }
  }

  if (alpha >= 0.5) {
    for (let k = 0; k < f1.p.length; k++) {
      const r1 = f1.p[k];
      const idx = r1[0];
      if (idx >= 0 && idx < 64 && !hlP0SeenBuf[idx]) {
        hlAgentsBuf.push({
          idx,
          x: r1[1],
          y: r1[2],
          facing: r1[3],
          vx: 0,
          vy: 0,
          act: r1[4] || 0,
          dd: r1[5] ?? 1,
          ap: r1[6] !== undefined ? clamp(r1[6] / 100, 0, 1) : 0.45
        });
      }
    }
  }

  return { bx, by, bz, shot, style, ripL, ripR, car };
};

export const resolveHighlightGoalImpactT = (clip: MatchHighlightClip): number => {
  const frames = clip.frames;
  if (!clip.kind.startsWith('goal_') || frames.length < 2) return clip.peakT;

  const attRight = clip.attRight;
  let maxInGoalX = attRight ? -Infinity : Infinity;
  for (let i = 0; i < frames.length; i++) {
    if (attRight) maxInGoalX = Math.max(maxInGoalX, frames[i].bx);
    else maxInGoalX = Math.min(maxInGoalX, frames[i].bx);
  }
  const netTargetX = attRight
    ? clamp(Math.min(100.35, maxInGoalX), 99.85, 100.35)
    : clamp(Math.max(-0.35, maxInGoalX), -0.35, 0.15);

  let crossT: number | null = null;
  for (let i = 1; i < frames.length; i++) {
    const f0 = frames[i - 1];
    const f1 = frames[i];
    const reached1 = attRight ? f1.bx >= netTargetX : f1.bx <= netTargetX;
    const reached0 = attRight ? f0.bx >= netTargetX : f0.bx <= netTargetX;
    if (reached1 && !reached0) {
      const denom = f1.bx - f0.bx;
      const frac = Math.abs(denom) > 0.001 ? clamp((netTargetX - f0.bx) / denom, 0, 1) : 1;
      crossT = f0.t + (f1.t - f0.t) * frac;
      break;
    }
  }

  let firstRipT: number | null = null;
  for (let i = 0; i < frames.length; i++) {
    if ((frames[i].ripL || 0) > 0.04 || (frames[i].ripR || 0) > 0.04) {
      firstRipT = frames[i].t;
      break;
    }
  }

  if (crossT !== null) {
    return clamp(firstRipT !== null ? Math.max(crossT, Math.min(firstRipT, crossT + 0.02)) : crossT, 0.1, 0.96);
  }
  if (firstRipT !== null) return clamp(firstRipT, 0.1, 0.96);
  return clamp(Math.max(clip.peakT, 0.55), 0.1, 0.96);
};

export const drawHighlightClipToCanvas = (
  canvas: HTMLCanvasElement,
  clip: MatchHighlightClip,
  pct: number,
  opts: {
    homeTeamName?: string;
    awayTeamName?: string;
    homeKit: string;
    awayKit: string;
    homeGkKit?: string;
    awayGkKit?: string;
    homeTrim?: string;
    awayTrim?: string;
    cameraMode?: HighlightCameraMode;
    isSlowMo?: boolean;
    showNames?: boolean;
  }
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const rect = cw > 0 && ch > 0 ? null : canvas.getBoundingClientRect();
  const cssW = Math.max(300, Math.round((cw > 0 ? cw : rect?.width) || 560));
  const cssH = Math.max(180, Math.round((ch > 0 ? ch : rect?.height) || 320));
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cPct = clamp(pct, 0, 1);
  const homeKit = opts.homeKit;
  const awayKit = opts.awayKit;
  const homeGkKit = opts.homeGkKit || '#16a34a';
  const awayGkKit = opts.awayGkKit || '#ea580c';
  const homeTrim = opts.homeTrim || '#ffffff';
  const awayTrim = opts.awayTrim || '#ffffff';
  const cameraMode: HighlightCameraMode = opts.cameraMode || 'broadcast';

  const cur = sampleHighlightFrameAt(clip.frames, cPct);

  // Zero-alloc ball trail sampling
  const hasTrail = clip.frames.length >= 2;
  if (hasTrail) {
    const trailSteps = hlTrailPts.length - 1;
    const lookback = cur.shot ? 0.14 : 0.08;
    for (let s = trailSteps; s >= 0; s--) {
      const tp = Math.max(0, cPct - (s / trailSteps) * lookback);
      sampleBallOnlyAt(clip.frames, tp, hlTrailPts[trailSteps - s]);
    }
  }

  // Camera framing
  const basePadX = Math.max(20, cssW * 0.042);
  const basePadY = Math.max(30, cssH * 0.102);
  const basePadTop = basePadY;
  const basePadBottom = basePadY;
  const basePw = cssW - basePadX * 2;
  const basePh = cssH - basePadTop - basePadBottom;

  let zoom = 1;
  let camX = 50;
  let camY = 50;

  if (cameraMode === 'broadcast') {
    const goalFocusX = clip.attRight ? 90 : 10;
    const climaxProx = 1 - clamp(Math.abs(cPct - clip.peakT) / 0.34, 0, 1);
    zoom = 1.48 + climaxProx * 0.34;
    const rawCamX = cur.bx * (0.76 - climaxProx * 0.16) + goalFocusX * (0.24 + climaxProx * 0.16);
    const rawCamY = cur.by * 0.72 + 50 * 0.28;
    const halfViewX = 50 / zoom;
    const halfViewY = 50 / zoom;
    camX = clamp(rawCamX, halfViewX - 4, 100 - halfViewX + 4);
    camY = clamp(rawCamY, halfViewY - 5, 100 - halfViewY + 5);
  }

  const pw = basePw * zoom;
  const ph = basePh * zoom;
  const centerScreenX = cssW * 0.5;
  const centerScreenY = basePadTop + basePh * 0.5;
  const px = (x: number) => centerScreenX + ((x - camX) / 100) * pw;
  const py = (y: number) => centerScreenY + ((y - camY) / 100) * ph;

  const pLeft = px(0);
  const pTop = py(0);
  const pRight = px(100);
  const pBot = py(100);
  const pitchW = pRight - pLeft;
  const pitchH = pBot - pTop;

  // 1. Blit Cached Live-Match Stadium, Turf, Soil, Puddles, Floodlights, Chalk & Sidelines in 1 call
  const env = clip.matchEnv;
  const isRainy = env?.season === 'rainy';
  const bg = getHighlightWorldBgCache(env, homeKit, awayKit, homeTrim, awayTrim);
  ctx.fillStyle = bg?.apronFill || '#0b2218';
  ctx.fillRect(0, 0, cssW, cssH);

  if (bg) {
    const scaleX = pitchW / HL_PW;
    const scaleY = pitchH / HL_PH;
    const destX = pLeft - HL_PAD_X * scaleX;
    const destY = pTop - HL_PAD_TOP * scaleY;
    const destW = HL_BG_W * scaleX;
    const destH = HL_BG_H * scaleY;
    ctx.drawImage(bg.canvas, destX, destY, destW, destH);
  }

  // Animated Sideline Coaches in technical areas when bottom apron is visible
  if (pBot < cssH + 22) {
    const coachY = pBot + (HL_PAD_BOT * 0.5) * (pitchH / HL_PH);
    if (coachY > 0 && coachY < cssH + 14) {
      const cr = clamp(Math.min(cssW * 0.015, pitchH * 0.028) * Math.sqrt(zoom), 5.6, 8.6);
      const drawHlCoach = (pctX: number, kit: string, trim: string, phaseOff: number) => {
        const cx = px(pctX + Math.sin(cPct * Math.PI * 3 + phaseOff) * 1.4);
        if (cx < -20 || cx > cssW + 20) return;
        ctx.save();
        ctx.translate(cx, coachY);
        ctx.fillStyle = 'rgba(0,0,0,0.36)';
        ctx.beginPath();
        ctx.ellipse(0, cr * 0.85, cr * 0.9, cr * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, 0, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1c27d';
        ctx.beginPath();
        ctx.arc(0, -cr * 0.14, cr * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = trim || kit;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(0, 0, cr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };
      drawHlCoach(43.4, homeKit, homeTrim, 0);
      drawHlCoach(56.6, awayKit, awayTrim, 1.8);
    }
  }

  // Dynamic splash ripple when ball skids over rainy-season puddles
  if (isRainy && env?.puddles?.length && cur.bz < 3) {
    env.puddles.forEach((pd, idx) => {
      const distToBall = Math.hypot((cur.bx - pd.x) / Math.max(1, pd.rx), (cur.by - pd.y) / Math.max(1, pd.ry));
      if (distToBall < 1.25) {
        const cxP = px(pd.x);
        const cyP = py(pd.y);
        const rX = Math.max(8, (pd.rx / 100) * pitchW);
        const rY = Math.max(5, (pd.ry / 100) * pitchH);
        const ripPhase = (cPct * 6 + idx * 0.3) % 1;
        ctx.save();
        ctx.translate(cxP, cyP);
        ctx.rotate(pd.rot);
        ctx.strokeStyle = `rgba(224, 242, 254, ${0.46 * (1 - ripPhase)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, rX * (0.45 + ripPhase * 0.6), rY * (0.45 + ripPhase * 0.6), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // 2. Goal Frames with Climax Net Ripple (strictly after ball crosses goal line into net)
  const isGoalClip = clip.kind.startsWith('goal_');
  const isNetGoalShot =
    isGoalClip ||
    (clip.kind === 'shootout_kick' && clip.shootoutScored !== false) ||
    (clip.kind === 'var_overturn' && (!clip.varVerdict || clip.varVerdict === 'no_goal'));
  const goalImpactT = isNetGoalShot ? resolveHighlightGoalImpactT(clip) : clip.peakT;
  const ballInGoalNow = !isNetGoalShot || (clip.attRight ? cur.bx >= 99.5 : cur.bx <= 0.5);
  const netImpactReached = !isNetGoalShot || (cPct >= goalImpactT && ballInGoalNow);

  const goalTop = py(42);
  const goalBot = py(58);
  const goalD = Math.max(9, pitchW * 0.021);
  const drawHlGoal = (isLeft: boolean, ripple: number) => {
    const gx = isLeft ? pLeft - goalD : pRight;
    const bulge = ripple > 0 ? Math.sin(ripple * 24) * 4.2 * ripple : 0;
    ctx.save();
    ctx.fillStyle = ripple > 0 ? 'rgba(245, 194, 66, 0.28)' : 'rgba(255, 255, 255, 0.14)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.8, 1.9 * Math.sqrt(zoom));
    ctx.beginPath();
    if (isLeft) {
      ctx.moveTo(pLeft, goalTop);
      ctx.lineTo(gx - bulge, goalTop + 2);
      ctx.lineTo(gx - bulge, goalBot - 2);
      ctx.lineTo(pLeft, goalBot);
    } else {
      ctx.moveTo(pRight, goalTop);
      ctx.lineTo(gx + goalD + bulge, goalTop + 2);
      ctx.lineTo(gx + goalD + bulge, goalBot - 2);
      ctx.lineTo(pRight, goalBot);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  drawHlGoal(true, netImpactReached ? cur.ripL : 0);
  drawHlGoal(false, netImpactReached ? cur.ripR : 0);

  // 3. Ball Flight Trajectory Line & Motion Trail (live-match palette)
  const zScale = 0.78 * zoom;
  if (hasTrail && cur.shot && cur.car === undefined && cPct < Math.min(0.95, goalImpactT + 0.02)) {
    sampleBallOnlyAt(clip.frames, Math.min(1, cPct + 0.085), hlShotAheadPt);
    const tailPt = hlTrailPts[0];
    const aDx = hlShotAheadPt.x - cur.bx;
    const aDy = hlShotAheadPt.y - cur.by;
    if (Math.hypot(aDx, aDy) > 0.6) {
      const isSpecialShot =
        cur.style === 'bicycle' ||
        cur.style === 'volley' ||
        cur.style === 'curler' ||
        cur.style === 'trivela' ||
        cur.style === 'knuckle' ||
        cur.style === 'diving_header' ||
        cur.style === 'deflected' ||
        cur.style === 'screamer';
      ctx.save();
      ctx.strokeStyle =
        cur.style === 'deflected'
          ? 'rgba(251, 146, 60, 0.72)'
          : cur.style === 'curler'
            ? 'rgba(56, 189, 248, 0.68)'
            : cur.style === 'trivela'
              ? 'rgba(249, 115, 22, 0.7)'
              : cur.style === 'knuckle'
                ? 'rgba(192, 132, 252, 0.7)'
                : cur.style === 'header' || cur.style === 'diving_header'
                  ? 'rgba(253, 224, 71, 0.66)'
                  : isSpecialShot
                    ? 'rgba(251, 191, 36, 0.7)'
                    : 'rgba(248, 113, 113, 0.52)';
      ctx.lineWidth = (isSpecialShot ? 2.2 : 1.7) * Math.sqrt(zoom);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px(tailPt.x), py(tailPt.y));
      ctx.quadraticCurveTo(px(cur.bx), py(cur.by), px(hlShotAheadPt.x), py(hlShotAheadPt.y));
      ctx.stroke();
      ctx.restore();
    }
  }
  if (hasTrail) {
    ctx.save();
    ctx.lineCap = 'round';
    const isCurlTrail = cur.style === 'curler' || cur.style === 'knuckle';
    const isSpecialTrail =
      cur.style === 'trivela' ||
      cur.style === 'bicycle' ||
      cur.style === 'volley' ||
      cur.style === 'screamer' ||
      cur.style === 'diving_header' ||
      cur.style === 'deflected';
    for (let i = 1; i < hlTrailPts.length; i++) {
      const p0 = hlTrailPts[i - 1];
      const p1 = hlTrailPts[i];
      const ratio = i / hlTrailPts.length;
      const a = ratio * (cur.shot ? 0.76 : 0.44);
      ctx.strokeStyle =
        cur.style === 'curler'
          ? `rgba(56, 189, 248, ${a})`
          : cur.style === 'knuckle'
            ? `rgba(216, 180, 254, ${a})`
            : isSpecialTrail
              ? `rgba(251, 146, 60, ${a})`
              : cur.shot
                ? `rgba(250, 204, 21, ${a})`
                : `rgba(255, 255, 255, ${a * 0.7})`;
      ctx.lineWidth = Math.max(1.5, (cur.shot || isCurlTrail || isSpecialTrail ? 3.8 : 2.1) * ratio * Math.sqrt(zoom));
      ctx.beginPath();
      ctx.moveTo(px(p0.x), py(p0.y) - p0.z * zScale);
      ctx.lineTo(px(p1.x), py(p1.y) - p1.z * zScale);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3b. Climax Shockwave Ring & Kick Burst (before players/ball so ball sits crisply on top)
  const peakRel = cPct - clip.peakT;
  if (peakRel >= -0.02 && peakRel <= 0.24) {
    const burstProg = clamp((peakRel + 0.02) / 0.14, 0, 1);
    const burstAlpha = clamp(1 - burstProg, 0, 1);
    if (burstAlpha > 0.05) {
      const bSpot = hlTrailPts[Math.max(0, hlTrailPts.length - 3)] || { x: cur.bx, y: cur.by, z: cur.bz };
      const kx = px(bSpot.x);
      const ky = py(bSpot.y) - bSpot.z * zScale;
      const goalDir = clip.attRight ? 0 : Math.PI;
      ctx.save();
      ctx.globalAlpha = burstAlpha * 0.85;
      ctx.strokeStyle =
        clip.kind === 'super_save' || clip.kind === 'var_overturn'
          ? '#38bdf8'
          : clip.kind === 'red_card' || clip.kind === 'injury'
            ? '#ef4444'
            : clip.kind === 'woodwork' || clip.kind === 'penalty_miss'
              ? '#fb923c'
              : clip.kind === 'shootout_kick'
                ? clip.shootoutScored !== false
                  ? '#4ade80'
                  : '#f59e0b'
                : '#fde047';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(kx, ky, (6 + burstProg * 18) * Math.sqrt(zoom), goalDir - 0.95, goalDir + 0.95);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 4. Render 22 Players (Y-sorted, zero-alloc buffer, full 1:1 live-match animations)
  const playerRadius = clamp(cssW * 0.0172 * (zoom > 1 ? 1 + (zoom - 1) * 0.45 : 1), 9, 15.5);
  hlSortedAgentsBuf.length = 0;
  for (let i = 0; i < hlAgentsBuf.length; i++) hlSortedAgentsBuf.push(hlAgentsBuf[i]);
  hlSortedAgentsBuf.sort((a, b) => a.y - b.y);

  const showNames = opts.showNames !== false;
  const isCelebratingPhase = isGoalClip && netImpactReached;
  const cElapsed = cPct * 4.8;
  const cPose = clip.celebratePose || 'group_huddle';

  for (let ai = 0; ai < hlSortedAgentsBuf.length; ai++) {
    const agPos = hlSortedAgentsBuf[ai];
    const meta = clip.actors[agPos.idx];
    if (!meta) continue;
    const cx = px(agPos.x);
    const cy = py(agPos.y);
    if (cx < -38 || cx > cssW + 38 || cy < -38 || cy > cssH + 38) continue;

    const speed = Math.hypot(agPos.vx, agPos.vy);
    const stridePhase = cPct * 26 + agPos.idx * 1.35;
    const strideSin = Math.sin(stridePhase) * clamp(speed / 12, 0, 1);

    const isStarActor = meta.id === clip.actorName;
    const isAssister = Boolean(clip.assisterName && meta.id === clip.assisterName);
    const isVictim = Boolean(clip.victimName && meta.id === clip.victimName);
    const isCarrier = cur.car !== undefined && cur.car === agPos.idx;
    const isMe = Boolean(meta.me);
    const kit = meta.gk ? (meta.s === 'H' ? homeGkKit : awayGkKit) : meta.s === 'H' ? homeKit : awayKit;
    const trim = meta.gk ? '#ffffff' : meta.s === 'H' ? homeTrim : awayTrim;

    const act = isGoalClip && !isCelebratingPhase && agPos.act === HL_ACT.CELEBRATE ? 0 : agPos.act;
    const prog = clamp(agPos.ap, 0, 1);
    const acAlpha = clamp(1 - prog * 0.72, 0.22, 1);
    const arcEnv = Math.sin(prog * Math.PI);
    const dirSign = agPos.dd === -1 ? -1 : 1;

    // Resolve celebration role & phase matching live match — strictly gated until ball hits the net & ONLY scoring team celebrates
    const isScoringTeam = meta.s === clip.side;
    const isOgCulpritActor =
      !isScoringTeam && (agPos.dd === -1 || (clip.kind === 'goal_og' && isStarActor));
    const cRole: 'scorer' | 'assister' | 'teammate' | 'og_culprit' | null = isCelebratingPhase
      ? isOgCulpritActor
        ? 'og_culprit'
        : isScoringTeam && !meta.gk
          ? agPos.dd === 1
            ? 'scorer'
            : agPos.dd === 2
              ? 'assister'
              : agPos.dd === 3
                ? 'teammate'
                : isStarActor && clip.kind !== 'goal_og'
                  ? 'scorer'
                  : isAssister
                    ? 'assister'
                    : 'teammate'
          : null
      : null;
    const fallbackCelebPh = isCelebratingPhase ? clamp((cPct - goalImpactT) / Math.max(0.08, 1 - goalImpactT), 0, 1) : 0;
    const cPh = isCelebratingPhase ? (act === HL_ACT.CELEBRATE && agPos.ap > 0.02 ? prog : fallbackCelebPh) : 0;

    ctx.save();
    ctx.translate(cx, cy);

    // Highlight rings matching Live Match (isMe gold, star spotlight aura, carrier white, PRESS pulsing rose)
    if (isMe) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 4.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isStarActor || isAssister) {
      const pulse = 0.72 + 0.28 * Math.sin(cPct * Math.PI * 10);
      ctx.strokeStyle = isStarActor
        ? `rgba(250, 204, 21, ${(0.95 * pulse).toFixed(2)})`
        : `rgba(52, 211, 153, ${(0.82 * pulse).toFixed(2)})`;
      ctx.lineWidth = isStarActor ? 2.3 : 1.7;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + (isStarActor ? 5.6 : 4.2), 0, Math.PI * 2);
      ctx.stroke();
    } else if (isCarrier) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 3.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (act === HL_ACT.PRESS) {
      const pressPulse = 0.55 + Math.sin(cElapsed * 14 + agPos.idx) * 0.25;
      ctx.strokeStyle = `rgba(244, 63, 94, ${pressPulse})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 5.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ground shadow (exact live match dynamic scaling on aerial leaps & celebration jumps)
    const isJumpAcrobat =
      act === HL_ACT.HEADER ||
      act === HL_ACT.BICYCLE ||
      act === HL_ACT.DIVING_HEADER ||
      act === HL_ACT.VOLLEY;
    const isScorerAerialCeleb =
      cRole === 'scorer' &&
      ((cPose === 'siu_jump' && cPh >= 0.34 && cPh <= 0.76) ||
        (cPose === 'backflip' && cPh >= 0.28 && cPh <= 0.84));
    const celebAirProg = isScorerAerialCeleb
      ? cPose === 'siu_jump'
        ? clamp((cPh - 0.34) / 0.42, 0, 1)
        : clamp((cPh - 0.28) / 0.56, 0, 1)
      : 0;
    const celebHopArc =
      (cRole === 'teammate' || cRole === 'assister') && cPose !== 'calm_shush'
        ? Math.abs(Math.sin(cElapsed * 10 + agPos.idx * 1.1)) * 0.38
        : 0;
    const jumpArc = Math.max(isJumpAcrobat ? arcEnv : 0, Math.sin(celebAirProg * Math.PI), celebHopArc);
    const shScale = 1 - 0.24 * jumpArc;
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.32 - 0.11 * jumpArc).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(0, playerRadius * (0.82 + 0.12 * jumpArc), playerRadius * 0.92 * shScale, playerRadius * 0.36 * shScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sprint turf wake dust behind fast runners (suppressed during GK dive or turf slip)
    const cosF = Math.cos(agPos.facing);
    const sinF = Math.sin(agPos.facing);
    if (speed > 13.5 && act !== HL_ACT.GK_DIVE && act !== HL_ACT.SLIP) {
      const dustPhase = (stridePhase * 0.22) % 1;
      const d1 = playerRadius * (0.88 + dustPhase * 0.62);
      const d2 = playerRadius * (1.2 + ((dustPhase + 0.5) % 1) * 0.5);
      ctx.fillStyle = 'rgba(220, 252, 231, 0.36)';
      ctx.beginPath();
      ctx.arc(-cosF * d1 + sinF * 2.2, -sinF * d1 - cosF * 2.2 + playerRadius * 0.38, 1.65, 0, Math.PI * 2);
      ctx.arc(-cosF * d2 - sinF * 2.4, -sinF * d2 + cosF * 2.4 + playerRadius * 0.38, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // GK diving stretch offset & extended glove (exact match to drawLivePitchToCanvas)
    if (act === HL_ACT.GK_DIVE) {
      const diveSin = Math.max(0.25, arcEnv);
      ctx.translate(0, dirSign * diveSin * playerRadius * 0.65);
      ctx.rotate(dirSign * diveSin * 0.72);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, dirSign * (playerRadius * 1.15), playerRadius * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Wall defenders brace ring
    if (act === HL_ACT.WALL) {
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // All 25 live-match Acrobatics / Skill move / Duel / Slide / Shoot / Save visual flairs
    if (act === HL_ACT.BICYCLE) {
      ctx.translate(0, -playerRadius * 0.95 * arcEnv);
      ctx.rotate(-1.35 * arcEnv);
      ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 6, -Math.PI * 0.9, Math.PI * 0.3);
      ctx.stroke();
      ctx.strokeStyle = `rgba(251, 146, 60, ${acAlpha * 0.85})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 9.5, -Math.PI * 0.7, Math.PI * 0.2);
      ctx.stroke();
    } else if (act === HL_ACT.VOLLEY) {
      ctx.translate(0, -playerRadius * 0.35 * arcEnv);
      ctx.rotate(0.58 * arcEnv);
      ctx.strokeStyle = `rgba(251, 146, 60, ${acAlpha * 0.92})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 5, -Math.PI * 0.35, Math.PI * 0.45);
      ctx.stroke();
    } else if (act === HL_ACT.HEADER) {
      const leapY = -playerRadius * 0.76 * arcEnv;
      const lungeX = cosF * playerRadius * 0.38 * arcEnv;
      const lungeY = sinF * playerRadius * 0.38 * arcEnv;
      const jumpScale = 1 + 0.16 * arcEnv;
      ctx.translate(lungeX, leapY + lungeY);
      ctx.scale(jumpScale, jumpScale);
      ctx.strokeStyle = `rgba(253, 224, 71, ${acAlpha * 0.92})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 4.5 + prog * 4, agPos.facing - 0.9, agPos.facing + 0.9);
      ctx.stroke();
    } else if (act === HL_ACT.DIVING_HEADER) {
      const divePush = playerRadius * 0.95 * arcEnv;
      ctx.translate(cosF * divePush, sinF * divePush - playerRadius * 0.36 * arcEnv);
      ctx.rotate(cosF * 0.42 * arcEnv);
      ctx.strokeStyle = `rgba(56, 189, 248, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-cosF * playerRadius * 1.5, -sinF * playerRadius * 1.5 - 3);
      ctx.lineTo(0, -3);
      ctx.moveTo(-cosF * playerRadius * 1.5, -sinF * playerRadius * 1.5 + 3);
      ctx.lineTo(0, 3);
      ctx.stroke();
      ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.9})`;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 5, agPos.facing - 0.85, agPos.facing + 0.85);
      ctx.stroke();
    } else if (act === HL_ACT.BURST) {
      const bx1 = -cosF * playerRadius * 0.85;
      const by1 = -sinF * playerRadius * 0.85;
      ctx.fillStyle = `rgba(56, 189, 248, ${acAlpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(bx1, by1, playerRadius * 0.88, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx1 * 1.7, by1 * 1.7, playerRadius * 0.66, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(125, 211, 252, ${acAlpha * 0.95})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(bx1 * 1.9, by1 * 1.9 - 4);
      ctx.lineTo(0, -4);
      ctx.moveTo(bx1 * 1.9, by1 * 1.9 + 4);
      ctx.lineTo(0, 4);
      ctx.stroke();
    } else if (act === HL_ACT.STEPOVER) {
      const sway = Math.sin(prog * Math.PI * 4) * (playerRadius * 0.42);
      ctx.translate(-sinF * sway, cosF * sway);
      ctx.strokeStyle = `rgba(244, 114, 182, ${acAlpha * 0.92})`;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.arc(-3, 0, playerRadius + 3.5, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3, 0, playerRadius + 3.5, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
    } else if (act === HL_ACT.SHIELD) {
      ctx.scale(1.08, 1.08);
      ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 5.2, agPos.facing - 1.1, agPos.facing + 1.1);
      ctx.stroke();
    } else if (act === HL_ACT.SPIN) {
      ctx.rotate(dirSign * prog * Math.PI * 2);
      ctx.strokeStyle = `rgba(192, 132, 252, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (act === HL_ACT.SKILL_PASS) {
      ctx.rotate(dirSign * 0.9 * arcEnv);
      ctx.strokeStyle = `rgba(232, 121, 249, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 5, agPos.facing + Math.PI * 0.5, agPos.facing + Math.PI * 1.5);
      ctx.stroke();
    } else if (act === HL_ACT.DRAGBACK) {
      const rock = Math.sin(prog * Math.PI * 3) * (playerRadius * 0.28);
      ctx.translate(-cosF * rock, -sinF * rock);
      ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 4.8, 0, Math.PI * 1.65);
      ctx.stroke();
    } else if (act === HL_ACT.CUTINSIDE) {
      ctx.rotate(dirSign * 0.42 * arcEnv);
      ctx.strokeStyle = `rgba(232, 121, 249, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 5.8, agPos.facing - 0.85, agPos.facing + 0.85);
      ctx.stroke();
    } else if (act === HL_ACT.SLIDE) {
      const slidePush = arcEnv * playerRadius * 0.72;
      ctx.translate(cosF * slidePush, sinF * slidePush);
      ctx.rotate(sinF >= 0 ? 0.52 * arcEnv : -0.52 * arcEnv);
      ctx.strokeStyle = `rgba(56, 189, 248, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-cosF * playerRadius * 1.4, -sinF * playerRadius * 1.4);
      ctx.lineTo(cosF * playerRadius * 1.1, sinF * playerRadius * 1.1);
      ctx.stroke();
    } else if (act === HL_ACT.TACKLE) {
      ctx.translate(cosF * arcEnv * 4, sinF * arcEnv * 4);
      ctx.strokeStyle = `rgba(52, 211, 153, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 5.5, agPos.facing - 0.95, agPos.facing + 0.95);
      ctx.stroke();
    } else if (act === HL_ACT.CLASH) {
      const recoil = Math.sin(prog * Math.PI * 2) * 2.5;
      ctx.translate(dirSign * recoil, 0);
      ctx.strokeStyle = `rgba(251, 146, 60, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 4.8 + prog * 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (act === HL_ACT.SUPERSAVE) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${acAlpha * 0.98})`;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 6 + prog * 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(250, 204, 21, ${acAlpha * 0.9})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 10 + prog * 9, 0, Math.PI * 2);
      ctx.stroke();
    } else if (act === HL_ACT.SLIP) {
      const skidDist = arcEnv * playerRadius * 0.62;
      ctx.translate(-cosF * skidDist * 0.45, arcEnv * playerRadius * 0.42);
      ctx.rotate(dirSign * 1.18 * arcEnv);
      ctx.strokeStyle = `rgba(56, 189, 248, ${acAlpha * 0.95})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, playerRadius * 0.35, playerRadius + 5.5 + prog * 5, playerRadius * 0.55 + prog * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(187, 247, 208, ${acAlpha * 0.78})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-playerRadius * 1.2, playerRadius * 0.2);
      ctx.lineTo(playerRadius * 0.9, -playerRadius * 0.15);
      ctx.stroke();
    } else if (act === HL_ACT.WHIFF) {
      const stagger = Math.sin(prog * Math.PI * 2) * 0.65;
      ctx.rotate(stagger);
      ctx.scale(1 + 0.08 * arcEnv, 1 + 0.08 * arcEnv);
      ctx.strokeStyle = `rgba(251, 146, 60, ${acAlpha * 0.96})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 6.5, agPos.facing - 1.15, agPos.facing + 1.15);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${acAlpha * 0.85})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 10.5, agPos.facing - 0.75, agPos.facing + 0.85);
      ctx.stroke();
    } else if (
      act === HL_ACT.KICK ||
      act === HL_ACT.SHOOT_POWER ||
      act === HL_ACT.SHOOT_FINESSE ||
      act === HL_ACT.SHOOT_CHIP
    ) {
      const dir = agPos.facing;
      const kickPhase = prog < 0.25 ? -(prog / 0.25) : Math.sin(((prog - 0.25) / 0.75) * Math.PI);
      const isPower = act === HL_ACT.SHOOT_POWER;
      const isFinesse = act === HL_ACT.SHOOT_FINESSE;
      const isChip = act === HL_ACT.SHOOT_CHIP;
      const pushDist = kickPhase * playerRadius * (isPower ? 0.56 : 0.42);
      const liftY = isChip ? -Math.max(0, kickPhase) * playerRadius * 0.28 : isPower ? -Math.max(0, kickPhase) * playerRadius * 0.14 : 0;
      const lean = isPower ? 0.26 * kickPhase : isFinesse ? -0.3 * kickPhase : 0.16 * kickPhase;
      ctx.translate(cosF * pushDist, sinF * pushDist + liftY);
      ctx.rotate(lean);
      ctx.strokeStyle = isPower
        ? `rgba(251, 146, 60, ${acAlpha * 0.96})`
        : isFinesse
          ? `rgba(56, 189, 248, ${acAlpha * 0.96})`
          : isChip
            ? `rgba(250, 204, 21, ${acAlpha * 0.96})`
            : `rgba(253, 224, 71, ${acAlpha * 0.92})`;
      ctx.lineWidth = isPower ? 2.8 : 2.3;
      const ringRad = playerRadius + 4.5 + Math.max(0, kickPhase) * (isPower ? 6.5 : 4.5);
      ctx.beginPath();
      ctx.arc(0, 0, ringRad, dir - 0.85, dir + 0.85);
      ctx.stroke();
      if (isPower && prog >= 0.2) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${acAlpha * 0.85})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, ringRad + 3.5, dir - 0.55, dir + 0.55);
        ctx.stroke();
      }
    }

    // Animated directional cleated boots (exact match to drawLivePitchToCanvas incl. wind-up -> strike leg swing)
    const perpX = -sinF;
    const perpY = cosF;
    const isKickingNow =
      act === HL_ACT.KICK ||
      act === HL_ACT.SHOOT_POWER ||
      act === HL_ACT.SHOOT_FINESSE ||
      act === HL_ACT.SHOOT_CHIP ||
      act === HL_ACT.VOLLEY;
    const kickSwing = isKickingNow ? (prog < 0.25 ? -0.45 : Math.sin(((prog - 0.25) / 0.75) * Math.PI) * 1.15) : 0;
    const legSwing = isKickingNow ? kickSwing * (playerRadius * 0.9) : strideSin * (playerRadius * 0.58);
    const backSwing = isKickingNow ? -playerRadius * 0.28 : -legSwing;
    const bootLen = playerRadius * (isKickingNow ? 0.36 : 0.32);
    const bootWid = playerRadius * 0.2;
    const foot1X = perpX * (playerRadius * 0.4) + cosF * legSwing;
    const foot1Y = perpY * (playerRadius * 0.4) + sinF * legSwing + playerRadius * 0.36;
    const foot2X = -perpX * (playerRadius * 0.4) + cosF * backSwing;
    const foot2Y = -perpY * (playerRadius * 0.4) + sinF * backSwing + playerRadius * 0.36;

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(foot1X, foot1Y, bootLen, bootWid, agPos.facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(foot2X, foot2Y, bootLen * 0.94, bootWid, agPos.facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Subtle body bob & running shoulder sway
    const celebHopOffset =
      cRole !== null && cRole !== 'og_culprit'
        ? cRole === 'scorer' && (cPose === 'siu_jump' || cPose === 'backflip')
          ? 0
          : -celebHopArc * playerRadius * 0.65
        : 0;
    const bobY = -Math.abs(strideSin) * 1.65 + celebHopOffset;
    ctx.translate(0, bobY);
    if (speed > 2.5 && act !== HL_ACT.GK_DIVE && cRole === null) {
      ctx.rotate(strideSin * 0.075);
    }

    // All 8 Distinct Choreographed Goal Celebration Animations & Postures (1:1 live match parity)
    if (cRole !== null && cRole !== 'og_culprit') {
      const sleeveC = kit;
      const skinC = '#f1c27d';

      if (cRole === 'scorer') {
        if (cPose === 'knee_slide') {
          const sliding = cPh >= 0.28 && cPh <= 0.78;
          const slideEnv = sliding ? Math.sin(((cPh - 0.28) / 0.5) * Math.PI) : 0;
          if (sliding) {
            ctx.rotate(-0.24 * slideEnv);
            ctx.translate(0, playerRadius * 0.14 * slideEnv);
            ctx.save();
            ctx.strokeStyle = 'rgba(220, 252, 231, 0.78)';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-cosF * playerRadius * 2.5 + perpX * 2.8, -sinF * playerRadius * 2.5 + perpY * 2.8 + playerRadius * 0.45);
            ctx.lineTo(-cosF * playerRadius * 0.5 + perpX * 2.8, -sinF * playerRadius * 0.5 + perpY * 2.8 + playerRadius * 0.45);
            ctx.moveTo(-cosF * playerRadius * 2.5 - perpX * 2.8, -sinF * playerRadius * 2.5 - perpY * 2.8 + playerRadius * 0.45);
            ctx.lineTo(-cosF * playerRadius * 0.5 - perpX * 2.8, -sinF * playerRadius * 0.5 - perpY * 2.8 + playerRadius * 0.45);
            ctx.stroke();
            ctx.restore();
          }
          const armW = 0.2 + 0.3 * Math.sin(cElapsed * 12);
          ctx.strokeStyle = sleeveC;
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-playerRadius * 0.55, 0);
          ctx.lineTo(-playerRadius * 1.15, -playerRadius * (0.95 + armW * 0.25));
          ctx.moveTo(playerRadius * 0.55, 0);
          ctx.lineTo(playerRadius * 1.15, -playerRadius * (0.95 + armW * 0.25));
          ctx.stroke();
          ctx.fillStyle = skinC;
          ctx.beginPath();
          ctx.arc(-playerRadius * 1.15, -playerRadius * (0.95 + armW * 0.25), 1.9, 0, Math.PI * 2);
          ctx.arc(playerRadius * 1.15, -playerRadius * (0.95 + armW * 0.25), 1.9, 0, Math.PI * 2);
          ctx.fill();
        } else if (cPose === 'siu_jump') {
          if (cPh >= 0.34 && cPh <= 0.76) {
            const jT = (cPh - 0.34) / 0.42;
            const jArc = Math.sin(jT * Math.PI);
            ctx.translate(0, -playerRadius * 1.08 * jArc);
            ctx.rotate(jT * Math.PI * 2);
            ctx.strokeStyle = `rgba(250, 204, 21, ${(0.9 * jArc).toFixed(2)})`;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(0, 0, playerRadius + 5.5, 0, Math.PI * 1.6);
            ctx.stroke();
          } else if (cPh > 0.76) {
            const landT = clamp((cPh - 0.76) / 0.24, 0, 1);
            ctx.strokeStyle = `rgba(250, 204, 21, ${(0.95 * (1 - landT)).toFixed(2)})`;
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.arc(0, 0, playerRadius + 4 + landT * 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = sleeveC;
            ctx.lineWidth = 2.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-playerRadius * 0.6, 0);
            ctx.lineTo(-playerRadius * 1.55, playerRadius * 0.35);
            ctx.moveTo(playerRadius * 0.6, 0);
            ctx.lineTo(playerRadius * 1.55, playerRadius * 0.35);
            ctx.stroke();
            ctx.fillStyle = skinC;
            ctx.beginPath();
            ctx.arc(-playerRadius * 1.55, playerRadius * 0.35, 1.9, 0, Math.PI * 2);
            ctx.arc(playerRadius * 1.55, playerRadius * 0.35, 1.9, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (cPose === 'backflip') {
          if (cPh >= 0.28 && cPh <= 0.84) {
            const fT = (cPh - 0.28) / 0.56;
            const fArc = Math.sin(fT * Math.PI);
            ctx.translate(0, -playerRadius * 1.15 * fArc);
            ctx.rotate(-fT * Math.PI * 4);
            ctx.strokeStyle = `rgba(251, 146, 60, ${(0.95 * fArc).toFixed(2)})`;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(0, 0, playerRadius + 6, -Math.PI * 0.9, Math.PI * 0.4);
            ctx.stroke();
            ctx.strokeStyle = `rgba(254, 240, 138, ${(0.85 * fArc).toFixed(2)})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(0, 0, playerRadius + 9.5, Math.PI * 0.1, Math.PI * 1.35);
            ctx.stroke();
          } else {
            ctx.strokeStyle = sleeveC;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-playerRadius * 0.6, 0);
            ctx.lineTo(-playerRadius * 1.2, -playerRadius * 1.05);
            ctx.moveTo(playerRadius * 0.6, 0);
            ctx.lineTo(playerRadius * 1.2, -playerRadius * 1.05);
            ctx.stroke();
          }
        } else if (cPose === 'airplane') {
          const bank = Math.sin(cElapsed * 6.5) * 0.24;
          ctx.rotate(bank);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(perpX * playerRadius * 1.65, perpY * playerRadius * 1.65);
          ctx.lineTo(perpX * playerRadius * 1.65 - cosF * playerRadius * 1.9, perpY * playerRadius * 1.65 - sinF * playerRadius * 1.9);
          ctx.moveTo(-perpX * playerRadius * 1.65, -perpY * playerRadius * 1.65);
          ctx.lineTo(-perpX * playerRadius * 1.65 - cosF * playerRadius * 1.9, -perpY * playerRadius * 1.65 - sinF * playerRadius * 1.9);
          ctx.stroke();

          ctx.strokeStyle = sleeveC;
          ctx.lineWidth = 2.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-perpX * playerRadius * 1.65, -perpY * playerRadius * 1.65);
          ctx.lineTo(perpX * playerRadius * 1.65, perpY * playerRadius * 1.65);
          ctx.stroke();
          ctx.fillStyle = skinC;
          ctx.beginPath();
          ctx.arc(perpX * playerRadius * 1.65, perpY * playerRadius * 1.65, 2, 0, Math.PI * 2);
          ctx.arc(-perpX * playerRadius * 1.65, -perpY * playerRadius * 1.65, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (cPose === 'bow_crowd') {
          const bowEnv = cPh > 0.32 ? Math.sin(clamp((cPh - 0.32) / 0.68, 0, 1) * Math.PI) : 0;
          ctx.scale(1 + 0.04 * bowEnv, 1 - 0.14 * bowEnv);
          ctx.strokeStyle = `rgba(250, 204, 21, ${(0.45 + 0.45 * bowEnv).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 4.5 + bowEnv * 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = skinC;
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cosF * playerRadius * 0.92, sinF * playerRadius * 0.92, 2.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (cPose === 'calm_shush') {
          const pulseR = ((cElapsed * 1.6) % 1) * 13;
          const pulseA = 1 - ((cElapsed * 1.6) % 1);
          ctx.strokeStyle = `rgba(56, 189, 248, ${(pulseA * 0.9).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 3 + pulseR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 4.5, 0, Math.PI * 2);
          ctx.stroke();
        } else if (cPose === 'finger_point') {
          const pointLen = playerRadius * (1.35 + Math.sin(cElapsed * 11) * 0.14);
          ctx.strokeStyle = sleeveC;
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(cosF * pointLen, sinF * pointLen);
          ctx.stroke();
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(cosF * pointLen, sinF * pointLen, 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // group_huddle / own_goal_modest
          const wave = Math.sin(cElapsed * 13) * 0.25;
          ctx.strokeStyle = sleeveC;
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-playerRadius * 0.55, 0);
          ctx.lineTo(-playerRadius * 1.1, -playerRadius * (0.9 + wave));
          ctx.moveTo(playerRadius * 0.55, 0);
          ctx.lineTo(playerRadius * 1.1, -playerRadius * (0.9 - wave));
          ctx.stroke();
          ctx.strokeStyle = 'rgba(74, 222, 128, 0.78)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 4.5 + Math.sin(cElapsed * 8) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        const wave = Math.sin(cElapsed * 12 + agPos.idx) * 0.28;
        ctx.strokeStyle = sleeveC;
        ctx.lineWidth = 2.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-playerRadius * 0.5, 0);
        ctx.lineTo(-playerRadius * 1.05, -playerRadius * (0.85 + wave));
        ctx.moveTo(playerRadius * 0.5, 0);
        ctx.lineTo(playerRadius * 1.05, -playerRadius * (0.85 - wave));
        ctx.stroke();
        ctx.fillStyle = skinC;
        ctx.beginPath();
        ctx.arc(-playerRadius * 1.05, -playerRadius * (0.85 + wave), 1.6, 0, Math.PI * 2);
        ctx.arc(playerRadius * 1.05, -playerRadius * (0.85 - wave), 1.6, 0, Math.PI * 2);
        ctx.fill();
        if (cRole === 'assister') {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (cRole === 'og_culprit') {
      const shake = Math.sin(cElapsed * 18) * 0.14;
      ctx.rotate(shake);
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // GK ready gloves
    if (meta.gk && act !== HL_ACT.GK_DIVE) {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 0.95;
      const gFwd = playerRadius * 0.72;
      const gSpread = playerRadius * 0.68;
      ctx.beginPath();
      ctx.arc(cosF * gFwd + perpX * gSpread, sinF * gFwd + perpY * gSpread, playerRadius * 0.25, 0, Math.PI * 2);
      ctx.arc(cosF * gFwd - perpX * gSpread, sinF * gFwd - perpY * gSpread, playerRadius * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Direction dot
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cosF * playerRadius * 0.82, sinF * playerRadius * 0.82, 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Jersey circle
    ctx.fillStyle = kit;
    ctx.beginPath();
    ctx.arc(0, 0, playerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Clipped player portrait
    const faceCanvas = meta.vis ? getPitchFaceCanvas(meta.vis, kit, trim) : null;
    if (faceCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, playerRadius - 0.8), 0, Math.PI * 2);
      ctx.clip();
      const fw = playerRadius * 2.06;
      const fh = (fw * 68) / 64;
      ctx.drawImage(faceCanvas, -fw / 2, -fh * 0.47, fw, fh);
      ctx.restore();
    }

    // Crisp outer ring
    ctx.strokeStyle = isMe || isStarActor ? '#fde047' : '#ffffff';
    ctx.lineWidth = isMe || isStarActor ? 2.2 : 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, playerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Shirt number pill or centered fallback
    let noBadgeRightX = 0;
    if (!faceCanvas) {
      ctx.fillStyle = colDist(kit, '#ffffff') < 110 ? '#111827' : '#ffffff';
      ctx.font = `800 ${Math.round(playerRadius * 0.88)}px Sarabun, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(meta.no), 0, 0.5);
    } else {
      const noStr = String(meta.no);
      const badgeW = Math.max(9.5, noStr.length * 4.5 + 3.2);
      const badgeH = 9.5;
      const bx0 = -playerRadius * 1.18;
      const by0 = playerRadius * 0.25;
      noBadgeRightX = bx0 + badgeW;
      ctx.fillStyle = 'rgba(11, 32, 24, 0.92)';
      ctx.strokeStyle = kit;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx0, by0, badgeW, badgeH, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd75e';
      ctx.font = '800 7px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(noStr, bx0 + badgeW / 2, by0 + badgeH / 2 + 0.3);
    }

    // Bottom-right OVR pill (matches drawLivePitchToCanvas)
    if (meta.ov) {
      const ovVal = Math.round(meta.ov);
      const pillStr = String(ovVal);
      const pillBg = ovVal >= 84 ? '#facc15' : ovVal >= 73 ? '#10b981' : ovVal >= 62 ? '#0284c7' : '#334155';
      const pillFg = ovVal >= 84 ? '#1c1300' : '#ffffff';
      const pillStroke = ovVal >= 84 ? '#fef08a' : ovVal >= 73 ? '#a7f3d0' : ovVal >= 62 ? '#bae6fd' : '#cbd5e1';
      const pillW = 14.5;
      const pillH = 9.5;
      const rx0 = faceCanvas ? Math.max(0.8, noBadgeRightX + 1.2) : playerRadius * 0.05;
      const ry0 = playerRadius * 0.25;
      ctx.fillStyle = pillBg;
      ctx.strokeStyle = pillStroke;
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.roundRect(rx0, ry0, pillW, pillH, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pillFg;
      ctx.font = '800 7px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillStr, rx0 + pillW / 2, ry0 + pillH / 2 + 0.3);
    }

    // Position role micro-badge on ALL 22 players (exact live match look!)
    if (meta.ro) {
      const roleStr = String(meta.ro);
      const posPal = getPositionCanvasPalette(meta.ro);
      const roleFont = Math.max(6.4, Math.round(playerRadius * 0.56));
      ctx.font = `800 ${roleFont}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const rw = Math.max(17, measureTextCached(ctx, roleStr) + 5.5);
      const rh = Math.max(9.5, roleFont + 3.2);
      const ry = -playerRadius - rh * 0.72;
      ctx.fillStyle = posPal.bg;
      ctx.strokeStyle = posPal.stroke;
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.roundRect(-rw / 2, ry, rw, rh, 2.8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = posPal.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(roleStr, 0, ry + rh / 2);
    }

    // Yellow / Red card & Injury mini indicators
    if (meta.rc) {
      if (clip.kind === 'red_card' && clip.cardType === 'Y2R' && isStarActor) {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.85;
        ctx.fillRect(playerRadius * 0.62, -playerRadius * 0.72, 3.8, 5.2);
        ctx.strokeRect(playerRadius * 0.62, -playerRadius * 0.72, 3.8, 5.2);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(playerRadius * 0.84, -playerRadius * 0.56, 4.0, 5.4);
        ctx.strokeRect(playerRadius * 0.84, -playerRadius * 0.56, 4.0, 5.4);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.95;
        ctx.fillRect(playerRadius * 0.78, -playerRadius * 0.62, 4.2, 5.8);
        ctx.strokeRect(playerRadius * 0.78, -playerRadius * 0.62, 4.2, 5.8);
      }
    } else if (meta.yc) {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.95;
      ctx.fillRect(playerRadius * 0.78, -playerRadius * 0.62, 4.2, 5.8);
      ctx.strokeRect(playerRadius * 0.78, -playerRadius * 0.62, 4.2, 5.8);
    }
    if (meta.inj) {
      const ix = playerRadius * 0.92;
      const iy = -playerRadius * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.arc(ix, iy, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ix - 2.3, iy - 0.85, 4.6, 1.7);
      ctx.fillRect(ix - 0.85, iy - 2.3, 1.7, 4.6);
    }

    // Sub-in upward emerald arrow (clear of captain & top position badge)
    if (meta.sub) {
      const subX = meta.cap ? -playerRadius * 1.22 : -playerRadius * 1.12;
      const subY = meta.cap ? playerRadius * 0.12 : -playerRadius * 0.18;
      const srBadge = 4.1;
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(subX, subY, srBadge, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(subX, subY - srBadge * 0.54);
      ctx.lineTo(subX + srBadge * 0.48, subY + srBadge * 0.05);
      ctx.lineTo(subX + srBadge * 0.19, subY + srBadge * 0.05);
      ctx.lineTo(subX + srBadge * 0.19, subY + srBadge * 0.55);
      ctx.lineTo(subX - srBadge * 0.19, subY + srBadge * 0.55);
      ctx.lineTo(subX - srBadge * 0.19, subY + srBadge * 0.05);
      ctx.lineTo(subX - srBadge * 0.48, subY + srBadge * 0.05);
      ctx.closePath();
      ctx.fill();
    }

    // Captain 'C' badge drawn last on left outer shoulder so position badge never covers it
    if (meta.cap) {
      const capPal = getClubCaptainPalette(kit, trim);
      const capX = -playerRadius * 1.06;
      const capY = meta.sub ? -playerRadius * 0.44 : -playerRadius * 0.24;
      ctx.fillStyle = capPal.bg;
      ctx.strokeStyle = capPal.border;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.arc(capX, capY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = capPal.text;
      ctx.font = '900 5.9px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', capX, capY + 0.35);
    }

    // Stamina micro-bar under every player (exact live match look!)
    const fitVal = meta.fit ?? 88;
    const stamPct = clamp(fitVal, 0, 100) / 100;
    const barW = playerRadius * 1.9;
    const barH = 2.8;
    const barY = playerRadius + 1.5;
    ctx.fillStyle = 'rgba(7, 20, 14, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-barW / 2 - 0.6, barY - 0.6, barW + 1.2, barH + 1.2, 2);
    ctx.fill();
    ctx.strokeStyle = fitVal < 65 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    if (stamPct > 0) {
      const fillW = Math.max(2, barW * stamPct);
      ctx.fillStyle = fitVal >= 75 ? '#22c55e' : fitVal >= 65 ? '#f59e0b' : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, fillW, barH, 1.4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, fillW, 0.9, 0.45);
      ctx.fill();
    }

    const hlKindIcon =
      clip.kind === 'goal_acrobat'
        ? '🤸'
        : clip.kind === 'goal_curler' || clip.kind === 'goal_freekick'
          ? '🌀'
          : clip.kind === 'goal_screamer'
            ? '🚀'
            : clip.kind === 'goal_penalty'
              ? '🎯'
              : clip.kind === 'goal_woodwork_in' || clip.kind === 'woodwork'
                ? '🥅'
                : clip.kind === 'goal_deflect'
                  ? '💫'
                  : clip.kind === 'goal_og'
                    ? '🤦'
                    : clip.kind === 'super_save'
                      ? '🧤'
                      : clip.kind === 'red_card'
                        ? '🟥'
                        : clip.kind === 'penalty_miss'
                          ? '❌'
                          : clip.kind === 'var_overturn'
                            ? '🖥'
                            : clip.kind === 'injury'
                              ? '✚'
                              : clip.kind === 'shootout_kick'
                                ? clip.shootoutOutcome === 'save'
                                  ? '🧤'
                                  : clip.shootoutOutcome === 'woodwork'
                                    ? '🥅'
                                    : clip.shootoutOutcome === 'miss'
                                      ? '❌'
                                      : '🎯'
                                : '⚽';

    // Name label (live match rules: star/actor, assister, carrier, user player, victim in key duels)
    const showVictimLabel =
      isVictim &&
      (clip.kind === 'super_save' ||
        clip.kind === 'red_card' ||
        clip.kind === 'injury' ||
        clip.kind === 'penalty_miss' ||
        clip.kind === 'shootout_kick' ||
        clip.kind === 'var_overturn');
    if (showNames && (isStarActor || isAssister || isMe || isCarrier || showVictimLabel)) {
      const lbl = isStarActor
        ? `${isCelebratingPhase ? (clip.kind === 'goal_og' ? '🤦 ' : '⚽ ') : `${hlKindIcon} `}${meta.sn}`
        : isMe
          ? `★ ${meta.sn}`
          : meta.sn;
      ctx.font = `700 ${Math.max(9.5, Math.round(playerRadius * 0.82))}px "Noto Sans Thai", sans-serif`;
      const tw = measureTextCached(ctx, lbl);
      const bw = tw + 10;
      const bh = 13.5;
      const byLbl = playerRadius + 13;
      const lxOff = clamp(cx, bw / 2 + 4, cssW - bw / 2 - 4) - cx;
      ctx.fillStyle =
        isMe || (isStarActor && !isCelebratingPhase)
          ? 'rgba(250, 204, 21, 0.94)'
          : isStarActor && isCelebratingPhase
            ? 'rgba(16, 185, 129, 0.94)'
            : 'rgba(6, 18, 12, 0.86)';
      ctx.strokeStyle =
        isMe || (isStarActor && !isCelebratingPhase)
          ? 'rgba(254, 240, 138, 0.92)'
          : isStarActor && isCelebratingPhase
            ? 'rgba(167, 243, 208, 0.78)'
            : 'rgba(255, 255, 255, 0.24)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.roundRect(lxOff - bw / 2, byLbl - bh / 2, bw, bh, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isMe || (isStarActor && !isCelebratingPhase) ? '#1a1200' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, lxOff, byLbl + 0.3);
    }

    ctx.restore();
  }

  // 5. 3D Match Ball (exact 5-panel seam & specular highlight match to drawLivePitchToCanvas)
  const bx = px(cur.bx);
  const by = py(cur.by);
  const ballScale = 1 + clamp(cur.bz / 24, 0, 0.72);
  const ballR = clamp(cssW * 0.009 * (zoom > 1 ? 1 + (zoom - 1) * 0.42 : 1), 4.8, 7.6) * ballScale;
  const drawBy = by - cur.bz * zScale;

  // Ball shadow
  ctx.fillStyle = `rgba(0, 0, 0, ${clamp(0.42 - cur.bz * 0.012, 0.12, 0.42)})`;
  ctx.beginPath();
  ctx.ellipse(bx + cur.bz * 0.22, by + 3.2 + cur.bz * 0.28, ballR * 0.94, ballR * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(bx, drawBy);
  if (cur.shot) {
    ctx.fillStyle =
      cur.style === 'curler' || cur.style === 'knuckle'
        ? 'rgba(56, 189, 248, 0.34)'
        : cur.style === 'bicycle' || cur.style === 'volley' || cur.style === 'screamer' || cur.style === 'trivela'
          ? 'rgba(251, 191, 36, 0.38)'
          : 'rgba(254, 240, 138, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, ballR * 1.54, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, ballR, 0, Math.PI * 2);
  ctx.clip();
  const ballSprite = getBallSphereSprite(ballR);
  if (ballSprite) {
    const spriteHalf = Math.max(4, Math.round(ballR * 4)) / 4 + 1;
    ctx.drawImage(ballSprite, -spriteHalf, -spriteHalf, spriteHalf * 2, spriteHalf * 2);
  } else {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-ballR - 1, -ballR - 1, ballR * 2 + 2, ballR * 2 + 2);
  }

  const isCurlSpin = cur.style === 'curler' || cur.style === 'knuckle';
  const spinAng = (cur.bx * 0.38 + cur.by * 0.27 + cPct * 11) * (isCurlSpin ? 1.6 : 1);
  const coreOffX = Math.cos(spinAng * 0.65) * ballR * 0.14;
  const coreOffY = Math.sin(spinAng * 0.55) * ballR * 0.14;
  const pentR = ballR * 0.37;

  ctx.save();
  ctx.translate(coreOffX, coreOffY);
  ctx.rotate(spinAng);
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.65)';
  ctx.lineWidth = Math.max(0.7, ballR * 0.11);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const vx = Math.cos(a) * pentR;
    const vy = Math.sin(a) * pentR;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(Math.cos(a) * (ballR * 1.05), Math.sin(a) * (ballR * 1.05));
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (ballR * 0.96), Math.sin(a) * (ballR * 0.96), ballR * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const vx = Math.cos(a) * pentR;
    const vy = Math.sin(a) * pentR;
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Top-left glossy specular highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.ellipse(-ballR * 0.34, -ballR * 0.36, ballR * 0.24, ballR * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, ballR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 6. Climax Goal Sparkles, Event Callout Pills & Live-Match Style Broadcast Strips
  if ((isGoalClip || (clip.kind === 'shootout_kick' && clip.shootoutScored !== false)) && cPct >= goalImpactT && cPct <= Math.min(0.98, goalImpactT + 0.28)) {
    const spProg = clamp((cPct - goalImpactT) / 0.28, 0, 1);
    const spAlpha = clamp(1 - spProg, 0, 1);
    const gxAnchor = px(clip.attRight ? 99 : 1);
    const gyAnchor = py(50);
    const sparkColors = ['#facc15', '#4ade80', '#38bdf8', '#fb923c', '#ffffff'];

    ctx.save();
    // Goal impact shockwave ring
    ctx.globalAlpha = spAlpha * 0.85;
    ctx.strokeStyle = clip.kind === 'goal_og' ? '#fb7185' : '#4ade80';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(gxAnchor, gyAnchor, (8 + spProg * 34) * Math.sqrt(zoom), 0, Math.PI * 2);
    ctx.stroke();

    // Deterministic celebration confetti sparkles
    for (let si = 0; si < 14; si++) {
      const ang = (si * 2.39996) + clip.minute * 0.7;
      const dist = (10 + (si % 4) * 9) * (0.25 + spProg * 1.35) * Math.sqrt(zoom);
      const sx = gxAnchor + Math.cos(ang) * dist;
      const sy = gyAnchor + Math.sin(ang) * dist - spProg * 14;
      ctx.globalAlpha = spAlpha * 0.92;
      ctx.fillStyle = sparkColors[si % sparkColors.length];
      ctx.beginPath();
      ctx.arc(sx, sy, (2.2 + (si % 3) * 0.8) * (1 - spProg * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (
    (clip.kind === 'super_save' ||
      clip.kind === 'woodwork' ||
      clip.kind === 'penalty_miss' ||
      clip.kind === 'red_card' ||
      clip.kind === 'injury' ||
      (clip.kind === 'shootout_kick' && clip.shootoutScored === false)) &&
    cPct >= clip.peakT &&
    cPct <= Math.min(0.96, clip.peakT + 0.26)
  ) {
    const spProg = clamp((cPct - clip.peakT) / 0.26, 0, 1);
    const spAlpha = Math.min(clamp(spProg * 5, 0, 1), clamp((1 - spProg) * 1.4, 0, 1));
    const fxLabel =
      clip.kind === 'super_save'
        ? '🧤 ซูเปอร์เซฟ!'
        : clip.kind === 'woodwork'
          ? '🥅 ชนเสา/คาน!'
          : clip.kind === 'penalty_miss'
            ? '❌ จุดโทษหลุดกรอบ!'
            : clip.kind === 'red_card'
              ? clip.cardType === 'Y2R'
                ? '🟨➡🟥 เหลืองแดงไล่ออก!'
                : '🟥 ใบแดงโดยตรง!'
              : clip.kind === 'injury'
                ? `✚ บาดเจ็บ!${clip.injuryGames ? ` (${clip.injuryGames} นัด)` : ''}`
                : clip.shootoutOutcome === 'save'
                  ? '🧤 เซฟจุดโทษ!'
                  : clip.shootoutOutcome === 'woodwork'
                    ? '🥅 จุดโทษชนเสา/คาน!'
                    : '❌ จุดโทษพลาดเป้า!';
    const fxCol =
      clip.kind === 'super_save' || (clip.kind === 'shootout_kick' && clip.shootoutOutcome === 'save')
        ? '#38bdf8'
        : clip.kind === 'red_card' || clip.kind === 'injury'
          ? '#ef4444'
          : '#fb923c';
    ctx.save();
    ctx.globalAlpha = spAlpha;
    ctx.font = '700 10.5px "Noto Sans Thai", sans-serif';
    const tw = measureTextCached(ctx, fxLabel);
    const bw = tw + 18;
    const bh = 20;
    const fxX = clamp(bx, bw / 2 + 8, cssW - bw / 2 - 8);
    const fxY = clamp(drawBy - 24 - spProg * 8, 38, cssH - 54);
    ctx.fillStyle = 'rgba(7, 19, 13, 0.92)';
    ctx.strokeStyle = fxCol;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(fxX - bw / 2, fxY - bh / 2, bw, bh, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fxCol;
    ctx.beginPath();
    ctx.roundRect(fxX - bw / 2 + 4, fxY - 5, 2.5, 10, 1.25);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fxLabel, fxX + 2.5, fxY + 0.3);
    ctx.restore();
  }

  // Dashed VAR spotlight ring on pitch around ball/incident during VAR drama
  if (clip.kind === 'var_overturn' && cPct >= Math.max(0.15, clip.peakT - 0.15)) {
    const varRingR = 13 + Math.sin(cPct * Math.PI * 10) * 2.5;
    const varRingCol = clip.varVerdict === 'no_pen' ? '#facc15' : clip.varVerdict === 'pen' ? '#ef4444' : '#38bdf8';
    ctx.save();
    ctx.strokeStyle = varRingCol;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(bx, by, varRingR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 7. Broadcast Studio HUD Overlay (Top Bug + Event-Matched Broadcast Strip + Bottom Lower-Third)
  const clipKindIcon =
    clip.kind === 'goal_acrobat'
      ? '🤸'
      : clip.kind === 'goal_curler' || clip.kind === 'goal_freekick'
        ? '🌀'
        : clip.kind === 'goal_screamer'
          ? '🚀'
          : clip.kind === 'goal_penalty'
            ? '🎯'
            : clip.kind === 'goal_woodwork_in' || clip.kind === 'woodwork'
              ? '🥅'
              : clip.kind === 'goal_deflect'
                ? '💫'
                : clip.kind === 'goal_og'
                  ? '🤦'
                  : clip.kind === 'super_save'
                    ? '🧤'
                    : clip.kind === 'red_card'
                      ? '🟥'
                      : clip.kind === 'penalty_miss'
                        ? '❌'
                        : clip.kind === 'var_overturn'
                          ? '🖥'
                          : clip.kind === 'injury'
                            ? '✚'
                            : clip.kind === 'shootout_kick'
                              ? clip.shootoutOutcome === 'save'
                                ? '🧤'
                                : clip.shootoutOutcome === 'woodwork'
                                  ? '🥅'
                                  : clip.shootoutOutcome === 'miss'
                                    ? '❌'
                                    : '🎯'
                              : '⚽';
  const activeScoreStr = isGoalClip
    ? cPct >= goalImpactT
      ? clip.scoreAfter
      : clip.scoreBefore
    : clip.scoreAfter;
  const bugText =
    clip.kind === 'shootout_kick'
      ? `${clipKindIcon} ดวลจุดโทษ${clip.shootoutRound ? ` รอบ ${clip.shootoutRound}` : ''}${clip.shootoutScoreText ? ` · ${clip.shootoutScoreText}` : ''}`
      : `${clipKindIcon} ไฮไลท์ · น.${clip.minute}' · สกอร์ ${activeScoreStr}`;
  ctx.save();
  ctx.font = '800 10px "Noto Sans Thai", sans-serif';
  const bugW = Math.min(cssW * 0.56, measureTextCached(ctx, bugText) + 28);
  const bugH = 22;
  ctx.fillStyle = 'rgba(7, 13, 24, 0.88)';
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.roundRect(10, 8, bugW, bugH, 6);
  ctx.fill();
  ctx.stroke();

  const blink = 0.55 + 0.45 * Math.sin(cPct * Math.PI * 16);
  ctx.fillStyle = `rgba(239, 68, 68, ${blink.toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(21, 8 + bugH / 2, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fef08a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitCanvasText(ctx, bugText, bugW - 24), 29, 8 + bugH / 2 + 0.5);

  const camBadgeText = opts.isSlowMo
    ? '⏱️ ภาพช้า SLOW-MO'
    : cameraMode === 'broadcast'
      ? '🎥 กล้องตามบอล'
      : '🏟️ มุมกว้างทั้งสนาม';
  const camW = measureTextCached(ctx, camBadgeText) + 16;
  ctx.fillStyle = opts.isSlowMo ? 'rgba(217, 119, 6, 0.92)' : 'rgba(7, 13, 24, 0.84)';
  ctx.strokeStyle = opts.isSlowMo ? '#fde047' : 'rgba(255, 255, 255, 0.26)';
  ctx.beginPath();
  ctx.roundRect(cssW - camW - 10, 8, camW, bugH, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(camBadgeText, cssW - camW / 2 - 10, 8 + bugH / 2 + 0.5);
  ctx.restore();

  // Live-match style Goal Celebration Broadcast Strip after goal hits net
  if (isGoalClip && cPct >= goalImpactT && cPct <= 0.98) {
    const gSpan = Math.max(0.08, 0.98 - goalImpactT);
    const gProg = clamp((cPct - goalImpactT) / gSpan, 0, 1);
    const gAlpha = Math.min(clamp(gProg * 5.5, 0, 1), clamp((1 - gProg) * 4.5, 0, 1));
    const accentTeamName = (clip.side === 'H' ? opts.homeTeamName : opts.awayTeamName) || '';
    const isOwn = clip.kind === 'goal_og';
    const goalTagPrefix = clipKindIcon === '⚽' ? '⚽' : `${clipKindIcon}⚽`;
    const rawTitle = isOwn
      ? `🤦 เข้าประตูตัวเอง!! (OG) · ${clip.actorName.split(' ')[0]}`
      : `${goalTagPrefix} GOAL!! ${clip.actorName.split(' ')[0]}${accentTeamName ? ` (${accentTeamName})` : ''}`;
    const goalMoodLine =
      clip.kind === 'goal_acrobat'
        ? '🤸 ลูกยิงกลางอากาศสุดมหัศจรรย์!'
        : clip.kind === 'goal_curler'
          ? '🌀 ปั่นโค้งเสียบมุมสุดคม!'
          : clip.kind === 'goal_freekick'
            ? '🌀 ฟรีคิกโค้งมุดเสียบมุม!'
            : clip.kind === 'goal_screamer'
              ? '🚀 ซัดไกลเต็มข้อสะท้านตาข่าย!'
              : clip.kind === 'goal_penalty'
                ? '🎯 สังหารจุดโทษเฉียบขาด!'
                : clip.kind === 'goal_woodwork_in'
                  ? '🥅 ชนเสา/คานกระดอนข้ามเส้น!'
                  : clip.kind === 'goal_deflect'
                    ? '💫 บอลแฉลบเปลี่ยนทางเข้าประตู!'
                    : '⚽ ตุงตาข่าย!';
    const rawSub = isOwn
      ? `${accentTeamName || 'คู่แข่ง'} ได้ประตูส้มหล่น!`
      : clip.assisterName
        ? `👟 ${clip.assisterName.split(' ')[0]}`
        : goalMoodLine;
    const maxBW = cssW - 24;
    ctx.save();
    ctx.globalAlpha = gAlpha;
    ctx.font = '800 12px "Noto Sans Thai", sans-serif';
    const tStr = fitCanvasText(ctx, rawTitle, maxBW - 36);
    const w1 = measureTextCached(ctx, tStr);
    ctx.font = '600 10px "Noto Sans Thai", sans-serif';
    const sStr = fitCanvasText(ctx, rawSub, maxBW - 36);
    const w2 = measureTextCached(ctx, sStr);
    const cardW = clamp(Math.max(w1, w2) + 38, 176, maxBW);
    const cardH = 38;
    const gx = cssW * 0.5;
    const slideIn = 1 - Math.pow(1 - clamp(gProg / 0.25, 0, 1), 3);
    const gy = 35 - (1 - slideIn) * 14;
    const accentKit = clip.side === 'H' ? homeKit : awayKit;

    ctx.fillStyle = isOwn ? 'rgba(28, 10, 16, 0.94)' : 'rgba(8, 22, 15, 0.93)';
    ctx.strokeStyle = isOwn ? '#fb7185' : '#4ade80';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(gx - cardW / 2, gy, cardW, cardH, 9);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accentKit;
    ctx.beginPath();
    ctx.roundRect(gx - cardW / 2 + 5, gy + 5, 4.5, cardH - 10, 2.2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isOwn ? '#fda4af' : '#ffffff';
    ctx.font = '800 12px "Noto Sans Thai", sans-serif';
    ctx.fillText(tStr, gx + 3, gy + 13.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.font = '600 10px "Noto Sans Thai", sans-serif';
    ctx.fillText(sStr, gx + 3, gy + 27.5);
    ctx.restore();
  } else if (clip.kind === 'red_card' && cPct >= clip.peakT && cPct <= 0.98) {
    const rSpan = Math.max(0.08, 0.98 - clip.peakT);
    const rProg = clamp((cPct - clip.peakT) / rSpan, 0, 1);
    const rAlpha = Math.min(clamp(rProg * 5, 0, 1), clamp((1 - rProg) * 4, 0, 1));
    const actorTeamName = (clip.side === 'H' ? opts.homeTeamName : opts.awayTeamName) || '';
    const isY2R = clip.cardType === 'Y2R';
    const rawTitle = clip.varVerdict === 'red'
      ? `🖥 VAR ใบแดงไล่ออก!! ${clip.actorName.split(' ')[0]}`
      : isY2R
        ? `เหลืองที่สอง (ใบแดง)!! ${clip.actorName.split(' ')[0]}`
        : `ใบแดงโดยตรง!! ${clip.actorName.split(' ')[0]}`;
    const rawSub = `${actorTeamName ? `${actorTeamName} · ` : ''}${clip.varReasonText || 'เหลือผู้เล่นน้อยกว่า'}`;
    const maxBW = cssW - 24;
    ctx.save();
    ctx.globalAlpha = rAlpha;
    ctx.font = '800 11.5px "Noto Sans Thai", sans-serif';
    const tStr = fitCanvasText(ctx, rawTitle, maxBW - 44);
    const w1 = measureTextCached(ctx, tStr);
    ctx.font = '600 9.5px "Noto Sans Thai", sans-serif';
    const sStr = fitCanvasText(ctx, rawSub, maxBW - 44);
    const w2 = measureTextCached(ctx, sStr);
    const cardW = clamp(Math.max(w1, w2) + 46, 178, maxBW);
    const cardH = 38;
    const cx = cssW * 0.5;
    const slideIn = 1 - Math.pow(1 - clamp(rProg / 0.22, 0, 1), 3);
    const cy = 35 - (1 - slideIn) * 14;
    ctx.fillStyle = 'rgba(11, 18, 28, 0.94)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    if (isY2R) {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2 + 8, cy + 8, 9, 14, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2 + 13, cy + 12, 9, 14, 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2 + 10, cy + 9, 12, 18, 2.5);
      ctx.fill();
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ef4444';
    ctx.font = '800 11.5px "Noto Sans Thai", sans-serif';
    ctx.fillText(tStr, cx - cardW / 2 + 29, cy + 13.5);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '600 9.5px "Noto Sans Thai", sans-serif';
    ctx.fillText(sStr, cx - cardW / 2 + 29, cy + 27.5);
    ctx.restore();
  } else if (clip.kind === 'var_overturn' && cPct >= Math.max(0.2, clip.peakT - 0.1) && cPct <= 0.98) {
    const vStart = Math.max(0.2, clip.peakT - 0.1);
    const vProg = clamp((cPct - vStart) / Math.max(0.08, 0.98 - vStart), 0, 1);
    const vAlpha = Math.min(clamp(vProg * 5, 0, 1), clamp((1 - vProg) * 4, 0, 1));
    const vAccent = clip.varVerdict === 'no_pen' ? '#facc15' : clip.varVerdict === 'pen' ? '#ef4444' : '#38bdf8';
    const vLabel =
      clip.varVerdict === 'no_pen'
        ? '🖥🟡 VAR ยกเลิกจุดโทษ'
        : clip.varVerdict === 'pen'
          ? '🖥🚨 VAR ชี้จุดโทษ!'
          : '🖥❌ VAR ริบประตู!';
    const vSub = clip.varReasonText || 'ผู้ตัดสินเช็กภาพช้าและกลับคำตัดสิน';
    const boxW = Math.min(390, cssW - 24);
    const boxH = 26;
    const cx = cssW / 2;
    const cy = 35;
    ctx.save();
    ctx.globalAlpha = vAlpha;
    ctx.fillStyle = 'rgba(11, 25, 44, 0.95)';
    ctx.strokeStyle = vAccent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2, cy, boxW, boxH, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = vAccent;
    ctx.beginPath();
    ctx.arc(cx - boxW / 2 + 12, cy + 13, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 10.5px "Noto Sans Thai", sans-serif';
    const pStr = `${vLabel} · `;
    const pW = measureTextCached(ctx, pStr);
    ctx.fillText(pStr, cx - boxW / 2 + 20, cy + 13);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
    ctx.font = '600 10px "Noto Sans Thai", sans-serif';
    ctx.fillText(fitCanvasText(ctx, vSub, Math.max(48, boxW - 28 - pW)), cx - boxW / 2 + 20 + pW, cy + 13);
    ctx.restore();
  } else if (clip.kind === 'shootout_kick' && cPct >= goalImpactT && cPct <= 0.98) {
    const sSpan = Math.max(0.08, 0.98 - goalImpactT);
    const sProg = clamp((cPct - goalImpactT) / sSpan, 0, 1);
    const sAlpha = Math.min(clamp(sProg * 5.5, 0, 1), clamp((1 - sProg) * 4, 0, 1));
    const kickerTeam = (clip.side === 'H' ? opts.homeTeamName : opts.awayTeamName) || '';
    const out = clip.shootoutOutcome || (clip.shootoutScored !== false ? 'goal' : 'save');
    const scLabel = clip.shootoutScoreText ? ` (${clip.shootoutScoreText})` : '';
    const rawTitle = clip.shootoutDecisive
      ? out === 'goal'
        ? `🏆🎯 ปิดกล่อง! ${clip.actorName.split(' ')[0]} พา ${kickerTeam} ชนะ!${scLabel}`
        : `🏆 ชี้ขาดดวลจุดโทษ! ${clip.actorName.split(' ')[0]}${scLabel}`
      : out === 'goal'
        ? `🎯 ยิงเข้า! ${clip.actorName.split(' ')[0]} (${kickerTeam})${scLabel}`
        : out === 'save'
          ? `🧤 เซฟ! ${clip.victimName ? clip.victimName.split(' ')[0] : 'ผู้รักษาประตู'}${scLabel}`
          : out === 'woodwork'
            ? `🥅 ชนเสา/คาน! ${clip.actorName.split(' ')[0]}${scLabel}`
            : `❌ หลุดกรอบ! ${clip.actorName.split(' ')[0]}${scLabel}`;
    const sAccent = out === 'goal' ? '#4ade80' : out === 'save' ? '#38bdf8' : '#f59e0b';
    const maxBW = cssW - 24;
    ctx.save();
    ctx.globalAlpha = sAlpha;
    ctx.font = '800 11.5px "Noto Sans Thai", sans-serif';
    const tStr = fitCanvasText(ctx, rawTitle, maxBW - 32);
    const tw = measureTextCached(ctx, tStr);
    const cardW = clamp(tw + 32, 168, maxBW);
    const cardH = 28;
    const gx = cssW * 0.5;
    const gy = 35;
    ctx.fillStyle = out === 'goal' ? 'rgba(8, 24, 16, 0.94)' : 'rgba(11, 20, 34, 0.94)';
    ctx.strokeStyle = sAccent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(gx - cardW / 2, gy, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = sAccent;
    ctx.fillText(tStr, gx, gy + cardH / 2 + 0.5);
    ctx.restore();
  }

  // Bottom Lower-Third Broadcast Graphic
  ctx.save();
  const l3H = 38;
  const l3W = Math.min(cssW - 20, 560);
  const l3X = 10;
  const l3Y = cssH - l3H - 8;
  const accentKit = clip.side === 'H' ? homeKit : awayKit;

  ctx.fillStyle = 'rgba(7, 14, 24, 0.9)';
  ctx.strokeStyle =
    clip.kind === 'red_card' || clip.kind === 'injury'
      ? 'rgba(239, 68, 68, 0.65)'
      : clip.kind === 'super_save' || clip.kind === 'var_overturn'
        ? 'rgba(56, 189, 248, 0.58)'
        : clip.kind === 'shootout_kick'
          ? 'rgba(167, 139, 250, 0.62)'
          : clip.kind === 'penalty_miss' || clip.kind === 'woodwork'
            ? 'rgba(251, 146, 60, 0.60)'
            : 'rgba(250, 204, 21, 0.52)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(l3X, l3Y, l3W, l3H, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = accentKit;
  ctx.beginPath();
  ctx.roundRect(l3X + 4, l3Y + 5, 4, l3H - 10, 2);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fde047';
  ctx.font = '800 11.5px "Noto Sans Thai", sans-serif';
  ctx.fillText(fitCanvasText(ctx, clip.title, l3W - 22), l3X + 14, l3Y + 13);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.font = '600 9.5px "Noto Sans Thai", sans-serif';
  ctx.fillText(fitCanvasText(ctx, `${clip.subtitle} · ${clip.crewTag}`, l3W - 22), l3X + 14, l3Y + 27.5);
  ctx.restore();
};



