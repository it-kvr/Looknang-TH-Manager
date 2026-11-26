import type { Team, PlayerCareerProfile, LivePitchAgent, LiveMatchWorld, LiveBenchSeat, LiveSidelineCoach, CoachOutfitId } from '../types/game';
import { COACH_OUTFITS } from '../data/thaiFootballData';
import { getTurfGradeSpec } from '../data/crestAndKitData';
import { clamp } from '../utils/math';
import { getShirtNo, visOf, getFormationSlots, DT, colDist, getPlayerTraits } from '../engine/playerCore';
import { faceBodySvg } from '../components/SvgVisuals';
import { getClubCaptainPalette } from '../components/CaptainBadge';
import { getPositionCanvasPalette } from '../components/PositionBadge';

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
  captainName?: string
): LivePitchAgent[] => {
  const slots = getFormationSlots(team);
  const attRight = (side === 'H') !== secondHalf;
  const activeCap = captainName || team.cap;
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

  const padX = Math.max(20, cssW * 0.042);
  const padTop = Math.max(22, cssH * 0.082);
  const padBottom = Math.max(32, cssH * 0.11);
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
  const bgKey = `${cssW}x${cssH}@${dpr}|${stadiumStyle}|${turfSpec.id}|${Math.round(turfCond / 5)}|${grassLength}|${Math.round(dirtMix * 20)}|${pitchSeed}|${isRainy ? 'r' : 's'}|${isNight ? 'n' : 'd'}|${(env?.sunAngle ?? 0.4).toFixed(3)}|${puddleSig}`;

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
          const trackPadTop = Math.max(4, padTop * 0.2);
          const trackPadBottom = Math.max(6, padBottom * 0.25);
          bctx.fillStyle = isNight ? 'rgba(138, 62, 46, 0.55)' : 'rgba(176, 82, 58, 0.58)';
          bctx.beginPath();
          bctx.roundRect(trackPadX, trackPadTop, cssW - trackPadX * 2, cssH - trackPadTop - trackPadBottom, 26);
          bctx.fill();
          bctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          bctx.lineWidth = 1;
          for (let lane = 1; lane <= 3; lane++) {
            const inset = lane * 4.5;
            bctx.beginPath();
            bctx.roundRect(
              trackPadX + inset,
              trackPadTop + inset,
              cssW - (trackPadX + inset) * 2,
              cssH - trackPadTop - trackPadBottom - inset * 2,
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
          bctx.fillStyle = 'rgba(125, 211, 252, 0.12)';
          bctx.fillRect(padX - 12, 3, pw + 24, Math.max(8, padY - 11));
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
    const mGrad = ctx.createLinearGradient(attRightMir ? padX + pw : padX, 0, px(50), 0);
    mGrad.addColorStop(0, `rgba(250, 204, 21, ${pulse})`);
    mGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = mGrad;
    ctx.fillRect(padX, padY, pw, ph);
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
  if (world.sideline) {
    const sl = world.sideline;
    const touchBot = padY + ph;
    const apronH = Math.max(26, cssH - touchBot);
    const zoneTop = touchBot + 3;
    const zoneH = clamp(apronH - 5, 22, 31);
    const techH = Math.max(10, zoneH * 0.5);

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
      const shellGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
      shellGrad.addColorStop(0, 'rgba(13, 35, 24, 0.96)');
      shellGrad.addColorStop(1, 'rgba(5, 16, 10, 0.94)');
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

        ctx.strokeStyle = seat.isMe ? '#facc15' : seat.subbedOut ? '#fb923c' : '#ffffff';
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
          ctx.strokeStyle = seat.subbedOut ? '#fb923c' : kit;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.roundRect(nx0, ny0, nW, nH, 1.8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = seat.subbedOut ? '#fdba74' : '#ffd75e';
          ctx.font = '800 5.2px Sarabun, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(noStr, nx0 + nW / 2, ny0 + nH / 2 + 0.2);
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
      const cx = px(c.x);
      const cy = zoneTop + techH * 0.5;
      const cr = clamp(Math.min(cssW * 0.0115, techH * 0.42), 4.4, 7.2);
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

      // Crisp suit ring
      ctx.strokeStyle = c.isUserCoach ? '#facc15' : trim;
      ctx.lineWidth = c.isUserCoach ? 1.7 : 1.3;
      ctx.beginPath();
      ctx.arc(0, 0, cr, 0, Math.PI * 2);
      ctx.stroke();

      // Tactical shout callout bubble or emotion emoji bubble with clean pointer tail
      if (c.shoutText && c.shoutTimer > 0) {
        const sAlpha = clamp(c.shoutTimer / 0.4, 0, 1);
        ctx.globalAlpha = sAlpha;
        ctx.font = '800 8px Sarabun, sans-serif';
        const sw = measureTextCached(ctx, c.shoutText) + 10;
        const bx0 = clamp(-sw / 2, -cx + 6, cssW - cx - sw - 6);
        const by0 = -cr - 17;
        ctx.fillStyle = 'rgba(7, 19, 13, 0.95)';
        ctx.strokeStyle = c.isUserCoach ? '#facc15' : kit;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.roundRect(bx0, by0, sw, 13.5, 5);
        ctx.fill();
        ctx.stroke();
        // Bubble pointer tail
        ctx.beginPath();
        ctx.moveTo(-2.5, by0 + 13);
        ctx.lineTo(0, by0 + 16.5);
        ctx.lineTo(2.5, by0 + 13);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = c.isUserCoach ? '#fde047' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.shoutText, bx0 + sw / 2, by0 + 7);
      } else if (c.moodEmoji && (c.moodTimer || 0) > 0) {
        const mTimer = c.moodTimer || 0;
        const mAlpha = Math.min(clamp(mTimer / 0.35, 0, 1), 1);
        const bob = Math.sin(sl.warmupPhase * 1.8 + (c.side === 'H' ? 0 : 1.5)) * 1.0;
        ctx.globalAlpha = mAlpha;
        const bw = 17;
        const bh = 14;
        const bx0 = clamp(-bw / 2, -cx + 6, cssW - cx - bw - 6);
        const by0 = -cr - 17 + bob;
        ctx.fillStyle = 'rgba(7, 19, 13, 0.92)';
        ctx.strokeStyle = c.isUserCoach ? '#facc15' : 'rgba(255, 255, 255, 0.36)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx0, by0, bw, bh, 7);
        ctx.fill();
        ctx.stroke();
        ctx.font = '10px Sarabun, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.moodEmoji, bx0 + bw / 2, by0 + bh / 2 + 0.4);
      }

      ctx.restore();
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
    ctx.font = '800 8.5px Sarabun, sans-serif';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(midWallX - 24, topWallY - 7, 48, 13, 5);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧱 กำแพง', midWallX, topWallY);
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
    ctx.font = '800 8.5px Sarabun, sans-serif';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(tx - 21, ty + (isTop ? 10 : -22), 42, 13, 5);
    ctx.fill();
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🤲 ทุ่ม', tx, ty + (isTop ? 16.5 : -15.5));
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
      const auraGrad = ctx.createRadialGradient(0, 0, playerRadius * 0.5, 0, 0, playerRadius + 10);
      auraGrad.addColorStop(0, `rgba(250, 204, 21, ${0.42 * bPulse})`);
      auraGrad.addColorStop(0.65, `rgba(52, 211, 153, ${0.22 * bPulse})`);
      auraGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 10, 0, Math.PI * 2);
      ctx.fill();

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
        pillStr = rtVal.toFixed(1);
        pillBg = rtVal >= 8.2 ? '#facc15' : rtVal >= 7.1 ? '#10b981' : rtVal >= 6.2 ? '#0f172a' : '#e11d48';
        pillFg = rtVal >= 8.2 ? '#1c1300' : '#ffffff';
        pillStroke = rtVal >= 8.2 ? '#fef08a' : rtVal >= 7.1 ? '#a7f3d0' : rtVal >= 6.2 ? '#94a3b8' : '#fecdd3';
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

    // Captain 'C' circular badge on left shoulder using clean flat club colors
    if (ag.isCaptain) {
      const capPal = getClubCaptainPalette(kit, trim);
      const capX = -playerRadius * 0.92;
      const capY = -playerRadius * 0.56;
      ctx.fillStyle = capPal.bg;
      ctx.strokeStyle = capPal.border;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(capX, capY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = capPal.text;
      ctx.font = '900 5.8px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', capX, capY + 0.35);
    }

    // Yellow card mini indicator on right shoulder (clear of top position badge)
    if (ag.hasYellow) {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 0.8;
      ctx.fillRect(playerRadius * 0.78, -playerRadius * 0.62, 4.2, 5.8);
      ctx.strokeRect(playerRadius * 0.78, -playerRadius * 0.62, 4.2, 5.8);
    }

    // Crisp position role micro-badge above each player during live play
    if (showPositions && ag.role) {
      const roleStr = String(ag.role);
      const posPal = getPositionCanvasPalette(ag.pos || ag.role);
      const roleFont = Math.max(6.5, Math.round(playerRadius * 0.58));
      ctx.font = `800 ${roleFont}px Sarabun, sans-serif`;
      const rw = Math.max(15, measureTextCached(ctx, roleStr) + 5.5);
      const rh = Math.max(8.5, roleFont + 2.5);
      const ry = -playerRadius - rh - 1.5;
      ctx.fillStyle = posPal.bg;
      ctx.strokeStyle = ag.isMe ? '#facc15' : 'rgba(6, 20, 13, 0.88)';
      ctx.lineWidth = ag.isMe ? 1.25 : 0.9;
      ctx.beginPath();
      ctx.roundRect(-rw / 2, ry, rw, rh, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = posPal.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(roleStr, 0, ry + rh / 2 + 0.3);
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
      ctx.font = `700 ${Math.max(9, Math.round(playerRadius * 0.86))}px Sarabun, sans-serif`;
      const tw = measureTextCached(ctx, label);
      const bw = tw + 8;
      const by = playerRadius + 11.5;
      ctx.fillStyle = isBlessed
        ? 'rgba(245, 158, 11, 0.94)'
        : ag.isMe
          ? 'rgba(250, 204, 21, 0.92)'
          : ag.intent === 'CELEBRATE' && ag.celebrateRole === 'scorer'
            ? 'rgba(16, 185, 129, 0.92)'
            : 'rgba(8, 22, 15, 0.78)';
      ctx.beginPath();
      ctx.roundRect(-bw / 2, by - 6.5, bw, 13, 4);
      ctx.fill();
      ctx.fillStyle = isBlessed || ag.isMe ? '#1a1200' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, by);
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

  const sphGrad = ctx.createRadialGradient(-ballR * 0.32, -ballR * 0.34, ballR * 0.1, 0, 0, ballR * 1.05);
  sphGrad.addColorStop(0, '#ffffff');
  sphGrad.addColorStop(0.55, '#f1f5f9');
  sphGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = sphGrad;
  ctx.fillRect(-ballR - 1, -ballR - 1, ballR * 2 + 2, ballR * 2 + 2);

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
    const fxX = clamp(px(fx.x), 58, cssW - 58);
    const fxY = clamp(py(fx.y) - 22 - (1 - alpha) * 10, 18, cssH - 18);
    const hasMedCross = fx.label.startsWith('✚ ');
    const textLabel = hasMedCross ? fx.label.slice(2) : fx.label;
    ctx.font = '800 11px Sarabun, sans-serif';
    const tw = measureTextCached(ctx, textLabel);
    const bw = tw + (hasMedCross ? 28 : 14);
    ctx.fillStyle = 'rgba(10, 24, 17, 0.9)';
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(fxX - bw / 2, fxY - 10, bw, 20, 999);
    ctx.fill();
    ctx.stroke();
    if (hasMedCross) {
      const cxIcon = fxX - bw / 2 + 11;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cxIcon, fxY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cxIcon - 3.1, fxY - 1.05, 6.2, 2.1);
      ctx.fillRect(cxIcon - 1.05, fxY - 3.1, 2.1, 6.2);
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(textLabel, hasMedCross ? fxX + 7 : fxX, fxY);
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
    const title = gb.isOwnGoal
      ? `🤦 เข้าประตูตัวเอง!! (OG) · ${gb.scorer}`
      : gb.isMeScorer
        ? `🌟 คุณยิงประตู!! ${gb.scorer}`
        : `⚽ GOAL!! ${gb.scorer} (${gb.teamName})`;
    const sub = gb.isOwnGoal
      ? `${gb.teamName} ได้ประตูส้มหล่น!`
      : gb.assister
        ? `👟 แอสซิสต์: ${gb.assister}`
        : gb.isMyGoal
          ? '🎉 เฮลั่นสนาม!'
          : '🔥 ตุงตาข่าย!';
    ctx.font = '800 13px Sarabun, sans-serif';
    const w1 = measureTextCached(ctx, title);
    ctx.font = '600 10px Sarabun, sans-serif';
    const w2 = measureTextCached(ctx, sub);
    const cardW = clamp(Math.max(w1, w2) + 38, 180, cssW - 24);
    const cardH = 40;
    const targetY = Math.round(padTop + 6);
    const startY = -(cardH + 12);
    const cy = enterT < 1 ? startY + (targetY - startY) * easeIn : targetY - 22 * easeExit;
    const cx = cssW / 2;

    ctx.save();
    ctx.fillStyle = gb.isOwnGoal ? 'rgba(28, 10, 16, 0.95)' : 'rgba(9, 23, 16, 0.94)';
    ctx.strokeStyle = gb.isOwnGoal ? '#fb7185' : gb.isMyGoal ? '#facc15' : '#4ade80';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Team color accent strip on left
    ctx.fillStyle = gb.kit;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2 + 5, cy + 5, 5, cardH - 10, 3);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = gb.isOwnGoal ? '#fda4af' : gb.isMyGoal ? '#fde047' : '#ffffff';
    ctx.font = '800 12.5px Sarabun, sans-serif';
    ctx.fillText(title, cx + 3, cy + 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.font = '600 10px Sarabun, sans-serif';
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
    const title =
      cb.type === 'R'
        ? `ใบแดงไล่ออก!! ${cb.shortName}`
        : cb.type === 'Y2R'
          ? `เหลืองที่สอง (ใบแดง)!! ${cb.shortName}`
          : `ใบเหลือง · ${cb.shortName}`;
    const sub = isRed ? `${cb.teamName} เหลือผู้เล่นน้อยกว่า` : `${cb.teamName} · เตือนจังหวะเข้าหนัก`;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '800 12px Sarabun, sans-serif';
    const w1 = measureTextCached(ctx, title);
    ctx.font = '600 10px Sarabun, sans-serif';
    const w2 = measureTextCached(ctx, sub);
    const cardW = clamp(Math.max(w1, w2) + 46, 178, cssW - 24);
    const cardH = 38;
    const cx = cssW / 2;
    const cy = Math.round(padTop + 6);
    ctx.fillStyle = 'rgba(11, 18, 28, 0.94)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    // Mini card icon badge on left (overlapping yellow+red for Y2R, single card for Y/R)
    if (cb.type === 'Y2R') {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2 + 8, cy + 8, 9, 14, 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = 'rgba(11, 18, 28, 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2 + 13, cy + 12, 9, 14, 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2 + 10, cy + 9, 12, 18, 2.5);
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = '800 11.5px Sarabun, sans-serif';
    ctx.fillText(title, cx - cardW / 2 + 29, cy + 13.5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 9.5px Sarabun, sans-serif';
    ctx.fillText(sub, cx - cardW / 2 + 29, cy + 27);
    ctx.restore();
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
    const showVerdict = pct >= 0.76;
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

    // 9b. Top-Center Broadcast Header Bar
    ctx.save();
    const boxW = Math.min(286, cssW - 24);
    const boxH = 44;
    const cx = cssW / 2;
    const cy = Math.round(padTop + 6);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = frameAccent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2, cy, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = frameAccent;
    ctx.beginPath();
    ctx.arc(cx - boxW / 2 + 16, cy + 15, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = frameAccent;
    ctx.font = '800 12px Sarabun, sans-serif';
    ctx.fillText(
      vr.kind === 'goal'
        ? '🖥 VAR CHECK · ตรวจสอบประตู'
        : vr.kind === 'foul_card'
          ? '🖥 VAR CHECK · ฟาวล์รุนแรง / ใบแดง'
          : '🖥 VAR CHECK · ตรวจสอบจุดโทษ & ใบ',
      cx - boxW / 2 + 26,
      cy + 15
    );
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '600 10px Sarabun, sans-serif';
    ctx.fillText(vr.reasonText, cx - boxW / 2 + 26, cy + 29);

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(cx - boxW / 2 + 10, cy + boxH - 6, boxW - 20, 2.5);
    ctx.fillStyle = frameAccent;
    ctx.fillRect(cx - boxW / 2 + 10, cy + boxH - 6, (boxW - 20) * pct, 2.5);
    ctx.restore();

    // 9c. Mini Picture-in-Picture VAR Replay Monitor Screen (placed opposite the incident side)
    ctx.save();
    const monW = clamp(pw * 0.335, 148, 242);
    const monH = clamp(ph * 0.49, 86, 134);
    const incidentOnRight = (rep?.incidentX ?? vr.x) >= 50;
    const monX = incidentOnRight ? Math.round(padX + 10) : Math.round(padX + pw - monW - 10);
    const monY = Math.round(padY + ph - monH - 8);

    // Monitor drop shadow + housing bezel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(monX + 2, monY + 3, monW, monH, 9);
    ctx.fill();

    ctx.fillStyle = 'rgba(8, 14, 26, 0.96)';
    ctx.strokeStyle = frameAccent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(monX, monY, monW, monH, 9);
    ctx.fill();
    ctx.stroke();

    // Top Monitor Chrome Strip
    const hdrH = cssW < 520 ? 15 : 17;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.98)';
    ctx.beginPath();
    ctx.roundRect(monX + 1.5, monY + 1.5, monW - 3, hdrH, [7.5, 7.5, 0, 0]);
    ctx.fill();

    // Live REC dot & label
    const recBlink = pct < 0.76 ? 0.55 + 0.45 * Math.sin(pct * Math.PI * 12) : 1;
    ctx.fillStyle = showVerdict ? frameAccent : `rgba(239, 68, 68, ${recBlink.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(monX + 9, monY + hdrH / 2 + 0.5, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.font = `800 ${cssW < 520 ? 7.5 : 8.5}px Sarabun, sans-serif`;
    ctx.fillText('จอภาพช้า VAR', monX + 15, monY + hdrH / 2 + 0.8);

    const statusTag = showVerdict
      ? verdictPositiveForCall && vr.kind === 'goal'
        ? 'ยืนยันประตู'
        : vr.kind === 'goal'
          ? 'ล้ำหน้า!'
          : vr.kind === 'penalty'
            ? vr.overturn
              ? 'นอกเขตโทษ'
              : 'จุดโทษ!'
            : vr.pendingCardUpgrade === 'R'
              ? 'ใบแดง!'
              : 'ใบเหลือง'
      : pct >= 0.4
        ? 'หยุดภาพ'
        : 'สโลว์โมชัน';
    ctx.textAlign = 'right';
    ctx.fillStyle = frameAccent;
    ctx.font = `800 ${cssW < 520 ? 7.2 : 8}px Sarabun, sans-serif`;
    ctx.fillText(statusTag, monX + monW - 7, monY + hdrH / 2 + 0.8);

    // Replay Viewport Area
    const scrPad = 3.5;
    const scrX = monX + scrPad;
    const scrY = monY + hdrH + 2;
    const scrW = monW - scrPad * 2;
    const scrH = monH - hdrH - scrPad - 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(scrX, scrY, scrW, scrH, 5.5);
    ctx.clip();

    // Determine Zoom Camera Window in 0..100 pitch coordinates
    const attRight = rep?.attRight ?? (vr.x >= 50);
    const attSide = vr.side;
    const defSide: 'H' | 'A' = attSide === 'H' ? 'A' : 'H';
    const attKit = attSide === 'H' ? homeKit : awayKit;
    const attTrim = attSide === 'H' ? homeTrim : awayTrim;
    const defKit = defSide === 'H' ? homeKit : awayKit;
    const defTrim = defSide === 'H' ? homeTrim : awayTrim;
    const defGkKit = defSide === 'H' ? homeGkKit : awayGkKit;

    let camCenterX = rep?.incidentX ?? vr.x;
    let camCenterY = rep?.incidentY ?? 50;
    let spanX = 28;
    if (vr.kind === 'goal') {
      camCenterX = attRight ? 88 : 12;
      camCenterY = clamp(rep?.incidentY ?? 50, 32, 68);
      spanX = 30;
    } else if (vr.kind === 'penalty') {
      const boxEdge = attRight ? 83 : 17;
      camCenterX = attRight ? clamp(boxEdge + 2, 78, 92) : clamp(boxEdge - 2, 8, 22);
      camCenterY = clamp(rep?.incidentY ?? 50, 26, 74);
      spanX = 24;
    } else {
      camCenterX = clamp(rep?.incidentX ?? vr.x, 12, 88);
      camCenterY = clamp(rep?.incidentY ?? vr.y, 16, 84);
      spanX = 21;
    }
    const spanY = spanX * (scrH / Math.max(1, scrW)) * (pw / Math.max(1, ph));
    const minFX = camCenterX - spanX / 2;
    const minFY = camCenterY - spanY / 2;
    const mx = (fx: number) => scrX + ((fx - minFX) / spanX) * scrW;
    const my = (fy: number) => scrY + ((fy - minFY) / spanY) * scrH;

    // Dark-broadcast turf stripes inside mini monitor
    ctx.fillStyle = '#0f3823';
    ctx.fillRect(scrX, scrY, scrW, scrH);
    const stripeStep = 5.5;
    const firstStripe = Math.floor(minFX / stripeStep) * stripeStep;
    for (let sx = firstStripe; sx < minFX + spanX + stripeStep; sx += stripeStep * 2) {
      const rx0 = mx(sx);
      const rx1 = mx(sx + stripeStep);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.fillRect(rx0, scrY, rx1 - rx0, scrH);
    }

    // Zoomed Pitch Markings inside Mini Monitor
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.25;
    // Outer pitch lines
    ctx.strokeRect(mx(0), my(0), mx(100) - mx(0), my(100) - my(0));
    // Halfway line
    ctx.beginPath();
    ctx.moveTo(mx(50), my(0));
    ctx.lineTo(mx(50), my(100));
    ctx.stroke();
    // Left & Right 18-yard & 6-yard boxes
    const boxLineHighlight = vr.kind === 'penalty' && pct >= 0.38;
    // Right Penalty Area (x=83..100, y=21..79)
    ctx.save();
    if (boxLineHighlight && attRight) {
      ctx.strokeStyle = showVerdict ? verdictColor : '#38bdf8';
      ctx.lineWidth = 2.2;
    }
    ctx.strokeRect(mx(83), my(21), mx(100) - mx(83), my(79) - my(21));
    ctx.restore();
    ctx.strokeRect(mx(94.5), my(36.5), mx(100) - mx(94.5), my(63.5) - my(36.5));
    // Left Penalty Area (x=0..17, y=21..79)
    ctx.save();
    if (boxLineHighlight && !attRight) {
      ctx.strokeStyle = showVerdict ? verdictColor : '#38bdf8';
      ctx.lineWidth = 2.2;
    }
    ctx.strokeRect(mx(0), my(21), mx(17) - mx(0), my(79) - my(21));
    ctx.restore();
    ctx.strokeRect(mx(0), my(36.5), mx(5.5) - mx(0), my(63.5) - my(36.5));

    // Penalty spots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(mx(88.5), my(50), 1.8, 0, Math.PI * 2);
    ctx.arc(mx(11.5), my(50), 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Goal frames inside monitor
    const mGoalD = Math.max(4, (mx(100) - mx(97.2)));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    if (attRight) {
      ctx.fillRect(mx(100), my(42), mGoalD, my(58) - my(42));
      ctx.strokeRect(mx(100), my(42), mGoalD, my(58) - my(42));
    } else {
      ctx.fillRect(mx(0) - mGoalD, my(42), mGoalD, my(58) - my(42));
      ctx.strokeRect(mx(0) - mGoalD, my(42), mGoalD, my(58) - my(42));
    }

    // Mini Player Renderer
    const drawMiniAgent = (
      fx: number,
      fy: number,
      kit: string,
      trim: string,
      no: number,
      shortName: string,
      vis?: number[],
      ringColor?: string,
      labelColor = '#f8fafc'
    ) => {
      const x = mx(fx);
      const y = my(fy);
      const r = clamp(scrH * 0.082, 5.8, 8.2);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.85, r * 0.88, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = kit;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      const faceC = vis ? getPitchFaceCanvas(vis, kit, trim) : null;
      if (faceC) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, r - 0.6), 0, Math.PI * 2);
        ctx.clip();
        const fw = r * 2.1;
        const fh = (fw * 68) / 64;
        ctx.drawImage(faceC, x - fw / 2, y - fh * 0.45, fw, fh);
        ctx.restore();
      } else {
        ctx.fillStyle = colDist(kit, '#ffffff') < 110 ? '#111827' : '#ffffff';
        ctx.font = `800 ${Math.round(r * 1.05)}px Sarabun, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(no), x, y + 0.3);
      }

      ctx.strokeStyle = ringColor || '#ffffff';
      ctx.lineWidth = ringColor ? 1.8 : 1.1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Compact shirt number + name tag below mini player
      if (shortName) {
        ctx.font = `700 ${cssW < 520 ? 6.5 : 7.2}px Sarabun, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(6, 12, 22, 0.8)';
        const lbl = `#${no} ${shortName}`;
        const lw = measureTextCached(ctx, lbl) + 5;
        ctx.beginPath();
        ctx.roundRect(x - lw / 2, y + r + 1.5, lw, 8.5, 2.5);
        ctx.fill();
        ctx.fillStyle = labelColor;
        ctx.fillText(lbl, x, y + r + 2.2);
      }
      ctx.restore();
    };

    // Slow-motion progress (0..1 up to freeze frame at pct=0.40)
    const rawPlayT = clamp(pct / 0.4, 0, 1);
    const playT = 1 - Math.pow(1 - rawPlayT, 2.1);

    if (vr.kind === 'goal') {
      const incX = rep?.incidentX ?? (attRight ? 86 : 14);
      const incY = rep?.incidentY ?? 48;
      const defLineX = rep?.defLineX ?? (attRight ? 84 : 16);
      const dirSign = attRight ? 1 : -1;
      // Attacker runs across line up to freeze moment
      const attXNow = incX - dirSign * (1 - playT) * 5.8;
      const attYNow = incY + (1 - playT) * 2.2;
      // Defender steps slightly back/across
      const defXNow = defLineX + dirSign * (1 - playT) * 1.6;
      const defYNow = clamp(incY + (incY < 50 ? 4.2 : -4.2), 26, 74);

      // Goalkeeper inside 6-yard area
      const gkX = attRight ? 97.2 : 2.8;
      const gkY = clamp(50 + (incY - 50) * 0.28, 43, 57);
      drawMiniAgent(gkX, gkY, defGkKit, '#ffffff', rep?.gkNo ?? 1, '', rep?.gkVis);

      // Animated pass + shot trajectory arrow
      const passStartX = rep?.passFromX ?? (incX - dirSign * 11);
      const passStartY = rep?.passFromY ?? clamp(incY + 7, 22, 78);
      const bxNow = passStartX + (attXNow - passStartX) * clamp(playT * 1.05, 0, 1);
      const byNow = passStartY + (attYNow - passStartY) * clamp(playT * 1.05, 0, 1);

      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.48)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([3, 2.5]);
      ctx.beginPath();
      ctx.moveTo(mx(passStartX), my(passStartY));
      ctx.lineTo(mx(incX), my(incY));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // VAR Offside Calibration Lines (appear right before freeze frame)
      if (pct >= 0.32) {
        const lineAlpha = clamp((pct - 0.32) / 0.14, 0, 1);
        const defScreenX = mx(defLineX);
        const attScreenX = mx(incX);
        const offsideClr = vr.overturn ? '#ef4444' : '#22c55e';

        ctx.save();
        ctx.globalAlpha = lineAlpha;
        // Shaded margin strip between defender & attacker lines
        ctx.fillStyle = vr.overturn ? 'rgba(239, 68, 68, 0.22)' : 'rgba(34, 197, 94, 0.2)';
        const bandX = Math.min(defScreenX, attScreenX);
        const bandW = Math.max(1.5, Math.abs(attScreenX - defScreenX));
        ctx.fillRect(bandX, scrY, bandW, scrH);

        // Blue defender offside line
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(defScreenX, scrY);
        ctx.lineTo(defScreenX, scrY + scrH);
        ctx.stroke();

        // Red or Green attacker line
        ctx.strokeStyle = offsideClr;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 2.5]);
        ctx.beginPath();
        ctx.moveTo(attScreenX, scrY);
        ctx.lineTo(attScreenX, scrY + scrH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Calibration tag at top of lines
        const cm = rep?.offsideMarginCm ?? 18;
        const calText = vr.overturn ? `ล้ำหน้า +${cm} ซม.` : `ไม่ล้ำหน้า (${cm} ซม.)`;
        ctx.font = `800 ${cssW < 520 ? 7 : 7.8}px Sarabun, sans-serif`;
        const calW = measureTextCached(ctx, calText) + 8;
        const calX = clamp((defScreenX + attScreenX) / 2, scrX + calW / 2 + 4, scrX + scrW - calW / 2 - 4);
        ctx.fillStyle = 'rgba(8, 15, 28, 0.92)';
        ctx.strokeStyle = offsideClr;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(calX - calW / 2, scrY + 4, calW, 12, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = offsideClr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(calText, calX, scrY + 10.2);
        ctx.restore();
      }

      // Draw Defender, Attacker & Mini Ball
      drawMiniAgent(
        defXNow,
        defYNow,
        defKit,
        defTrim,
        rep?.defNo ?? 4,
        rep?.defShort || 'กองหลัง',
        rep?.defVis,
        pct >= 0.34 ? '#3b82f6' : undefined,
        '#93c5fd'
      );
      drawMiniAgent(
        attXNow,
        attYNow,
        attKit,
        attTrim,
        rep?.attNo ?? 9,
        rep?.attShort || vr.shooterShort || 'ผู้ยิง',
        rep?.attVis,
        pct >= 0.34 ? (vr.overturn ? '#ef4444' : '#22c55e') : '#facc15',
        pct >= 0.34 ? (vr.overturn ? '#fca5a5' : '#86efac') : '#fde047'
      );

      // Ball dot
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx(bxNow), my(byNow), 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (vr.kind === 'penalty') {
      const incX = rep?.incidentX ?? (attRight ? 86 : 14);
      const incY = rep?.incidentY ?? 48;
      const boxLineX = rep?.defLineX ?? (attRight ? 83 : 17);
      const inBox = rep?.inBox ?? !vr.overturn;
      const dirSign = attRight ? 1 : -1;

      // Dribble & Defender slide-in up to impact frame
      const attXNow = incX - dirSign * (1 - playT) * 4.2;
      const attYNow = incY + (1 - playT) * (incY < 50 ? -1.4 : 1.4);
      const defXNow = incX + dirSign * (1.2 - playT * 0.4);
      const defYNow = incY + (1 - playT) * (incY < 50 ? 4.8 : -4.8) + (incY < 50 ? 1.0 : -1.0);

      // GK watching the incident
      drawMiniAgent(attRight ? 97 : 3, 50, defGkKit, '#ffffff', rep?.gkNo ?? 1, '', rep?.gkVis);

      // Box boundary label ("เส้นกรอบเขตโทษ")
      ctx.save();
      const bxScreen = mx(boxLineX);
      ctx.font = `700 ${cssW < 520 ? 6.5 : 7.2}px Sarabun, sans-serif`;
      const edgeLbl = 'เส้นเขตโทษ';
      const elw = measureTextCached(ctx, edgeLbl) + 6;
      ctx.fillStyle = 'rgba(8, 15, 28, 0.85)';
      ctx.beginPath();
      ctx.roundRect(clamp(bxScreen - elw / 2, scrX + 3, scrX + scrW - elw - 3), scrY + 4, elw, 11, 3);
      ctx.fill();
      ctx.fillStyle = '#bae6fd';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(edgeLbl, clamp(bxScreen, scrX + elw / 2 + 3, scrX + scrW - elw / 2 - 3), scrY + 9.8);
      ctx.restore();

      // Contact Halo & Drop Pin onto Pitch
      if (pct >= 0.34) {
        const contactClr = inBox ? '#ef4444' : '#38bdf8';
        const cX = mx(incX);
        const cY = my(incY);
        const ringR = 8 + Math.sin(pct * Math.PI * 10) * 1.8;
        ctx.save();
        ctx.strokeStyle = contactClr;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cX, cY, ringR, 0, Math.PI * 2);
        ctx.stroke();
        // Horizontal connector from contact dot to 18-yard box line
        ctx.setLineDash([2.5, 2]);
        ctx.beginPath();
        ctx.moveTo(cX, cY);
        ctx.lineTo(bxScreen, cY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = contactClr;
        ctx.beginPath();
        ctx.arc(cX, cY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      drawMiniAgent(
        attXNow,
        attYNow,
        attKit,
        attTrim,
        rep?.attNo ?? 10,
        rep?.attShort || 'ตัวรุก',
        rep?.attVis,
        '#facc15',
        '#fde047'
      );
      drawMiniAgent(
        defXNow,
        defYNow,
        defKit,
        defTrim,
        rep?.defNo ?? 4,
        rep?.defShort || vr.culpritShort || 'ตัวสกัด',
        rep?.defVis,
        pct >= 0.36 ? '#ef4444' : undefined,
        '#fca5a5'
      );

      // Loose ball near feet
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx(attXNow + dirSign * 1.3), my(attYNow - 0.5), 2.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Serious Foul / Red Card Replay
      const incX = rep?.incidentX ?? vr.x;
      const incY = rep?.incidentY ?? vr.y;
      const dirSign = attRight ? 1 : -1;

      const attXNow = incX - dirSign * (1 - playT) * 3.6;
      const attYNow = incY;
      const defXNow = incX + dirSign * (1.1 - playT * 0.25);
      const defYNow = incY + (1 - playT) * 5.2 + 0.9;

      // Slide skid trail
      if (playT > 0.25) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mx(incX + dirSign * 0.8), my(incY + 5.8));
        ctx.lineTo(mx(defXNow), my(defYNow));
        ctx.stroke();
        ctx.restore();
      }

      // Magnifying foul impact reticle
      if (pct >= 0.34) {
        const isRedVerdict = vr.pendingCardUpgrade === 'R';
        const spotClr = showVerdict ? (isRedVerdict ? '#ef4444' : '#facc15') : '#f59e0b';
        const cxSpot = mx((attXNow + defXNow) * 0.5);
        const cySpot = my((attYNow + defYNow) * 0.5);
        ctx.save();
        ctx.fillStyle = isRedVerdict && showVerdict ? 'rgba(239, 68, 68, 0.16)' : 'rgba(245, 158, 11, 0.15)';
        ctx.strokeStyle = spotClr;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cxSpot, cySpot, 14 + Math.sin(pct * Math.PI * 10) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      drawMiniAgent(
        attXNow,
        attYNow,
        attKit,
        attTrim,
        rep?.attNo ?? 10,
        rep?.attShort || 'ผู้ถูกสกัด',
        rep?.attVis,
        '#ffffff'
      );
      drawMiniAgent(
        defXNow,
        defYNow,
        defKit,
        defTrim,
        rep?.defNo ?? 5,
        rep?.defShort || vr.culpritShort || 'ผู้ทำฟาวล์',
        rep?.defVis,
        pct >= 0.34 ? '#f59e0b' : undefined,
        '#fde047'
      );

      // Loose ball near tackled attacker
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx(attXNow + dirSign * 1.4), my(attYNow - 0.6), 2.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Foul tag at top of mini screen
      if (pct >= 0.34) {
        const fTag = rep?.foulKind === 'dogso' ? 'เช็กตัวสุดท้าย (DOGSO)' : 'เช็กจังหวะเปิดปุ่ม / รุนแรง';
        ctx.font = `700 ${cssW < 520 ? 6.6 : 7.3}px Sarabun, sans-serif`;
        const fw = measureTextCached(ctx, fTag) + 8;
        ctx.fillStyle = 'rgba(8, 15, 28, 0.88)';
        ctx.beginPath();
        ctx.roundRect(scrX + scrW / 2 - fw / 2, scrY + 4, fw, 11.5, 3);
        ctx.fill();
        ctx.fillStyle = '#fcd34d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fTag, scrX + scrW / 2, scrY + 10);
      }
    }

    // Broadcast Scanlines + Viewfinder Corner Brackets
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let sy = scrY + 3; sy < scrY + scrH; sy += 4) {
      ctx.beginPath();
      ctx.moveTo(scrX, sy);
      ctx.lineTo(scrX + scrW, sy);
      ctx.stroke();
    }

    const br = 7;
    const bp = 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(scrX + bp, scrY + bp + br);
    ctx.lineTo(scrX + bp, scrY + bp);
    ctx.lineTo(scrX + bp + br, scrY + bp);
    // Top-right
    ctx.moveTo(scrX + scrW - bp - br, scrY + bp);
    ctx.lineTo(scrX + scrW - bp, scrY + bp);
    ctx.lineTo(scrX + scrW - bp, scrY + bp + br);
    // Bottom-left
    ctx.moveTo(scrX + bp, scrY + scrH - bp - br);
    ctx.lineTo(scrX + bp, scrY + scrH - bp);
    ctx.lineTo(scrX + bp + br, scrY + scrH - bp);
    // Bottom-right
    ctx.moveTo(scrX + scrW - bp - br, scrY + scrH - bp);
    ctx.lineTo(scrX + scrW - bp, scrY + scrH - bp);
    ctx.lineTo(scrX + scrW - bp, scrY + scrH - bp - br);
    ctx.stroke();

    // Bottom Verdict Banner inside Mini Monitor during Final Reveal Phase
    if (showVerdict) {
      const verdictBannerText =
        vr.kind === 'goal'
          ? vr.overturn
            ? '❌ ล้ำหน้า · ริบประตู!'
            : '✅ ไม่ล้ำหน้า · ให้ประตู!'
          : vr.kind === 'penalty'
            ? vr.overturn
              ? 'นอกกรอบ · ได้ฟรีคิก'
              : '🚨 ฟาวล์ในเขต · จุดโทษ!'
            : vr.pendingCardUpgrade === 'R'
              ? '🟥 ยกระดับเป็นใบแดง!'
              : '🟨 ให้แค่ใบเหลือง';
      const vbH = cssW < 520 ? 15 : 17;
      ctx.fillStyle = 'rgba(6, 12, 24, 0.92)';
      ctx.fillRect(scrX, scrY + scrH - vbH, scrW, vbH);
      ctx.fillStyle = verdictColor;
      ctx.fillRect(scrX, scrY + scrH - vbH, scrW, 1.5);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${cssW < 520 ? 7.8 : 8.8}px Sarabun, sans-serif`;
      ctx.fillText(verdictBannerText, scrX + scrW / 2, scrY + scrH - vbH / 2 + 0.5);
    }

    ctx.restore(); // end clip
    ctx.restore(); // end monitor
  }

};


