import type { GameState } from '../types/game';

export interface ShirtSponsorBrand {
  id: string;
  code: string;
  thName: string;
  accent: string;
  badgeBg: string;
  motif: number;
}

export const SHIRT_SPONSOR_BRANDS: readonly ShirtSponsorBrand[] = [
  { id: 'tli', code: 'THAILIFE', thName: 'ไทยลีก อินชัวรันซ์', accent: '#2dd4bf', badgeBg: '#0f766e', motif: 0 },
  { id: 'ktg', code: 'KRATING', thName: 'กระทิงทอง เอเนอร์จี', accent: '#fde047', badgeBg: '#b91c1c', motif: 1 },
  { id: 'sam', code: 'SIAMAUTO', thName: 'สยาม ออโต้ โมบิล', accent: '#38bdf8', badgeBg: '#1e293b', motif: 2 },
  { id: 'stv', code: 'STADIUM+', thName: 'สเตเดียม ทีวี พลัส', accent: '#22d3ee', badgeBg: '#6d28d9', motif: 3 },
  { id: 'agd', code: 'AEROGD', thName: 'แอโร่การ์ด คอร์ป', accent: '#93c5fd', badgeBg: '#1d4ed8', motif: 4 },
  { id: 'sky', code: 'SIAMSKY', thName: 'สยามสกาย แอร์เวย์ส', accent: '#fde047', badgeBg: '#0284c7', motif: 5 },
  { id: 'bbp', code: 'BKKBANK', thName: 'บางกอก แบงก์ พรีเมียร์', accent: '#fbbf24', badgeBg: '#1e3a8a', motif: 6 },
  { id: 'u5g', code: 'ULTRA 5G', thName: 'อัลตร้า 5G ไทยแลนด์', accent: '#34d399', badgeBg: '#064e3b', motif: 7 },
  { id: 'apx', code: 'APEX OIL', thName: 'เอเพ็กซ์ ฟูเอล กรุ๊ป', accent: '#fb923c', badgeBg: '#9a3412', motif: 8 },
  { id: 'nvp', code: 'NOVAPAY', thName: 'โนวา เพย์ ดิจิทัล', accent: '#a7f3d0', badgeBg: '#7c3aed', motif: 9 },
  { id: 'zap', code: 'ZAP! CAFE', thName: 'แซป คอฟฟี่ โรสเตอร์', accent: '#fde68a', badgeBg: '#78350f', motif: 10 },
  { id: 'vtx', code: 'VERTEX', thName: 'เวอร์เท็กซ์ มอเตอร์สปอร์ต', accent: '#fb7185', badgeBg: '#18181b', motif: 11 },
  { id: 'orb', code: 'ORBIT', thName: 'ออร์บิท เทเลคอม', accent: '#67e8f9', badgeBg: '#0369a1', motif: 12 },
  { id: 'crw', code: 'CROWN', thName: 'คราวน์ รีสอร์ท & โฮเทล', accent: '#fcd34d', badgeBg: '#4c1d95', motif: 13 },
  { id: 'pls', code: 'PULSE', thName: 'พัลส์ สปอร์ต แวร์', accent: '#bef264', badgeBg: '#14532d', motif: 14 },
  { id: 'ttn', code: 'TITAN', thName: 'ไททัน สตีล เวิร์คส์', accent: '#e2e8f0', badgeBg: '#334155', motif: 15 },
  { id: 'slr', code: 'SOLAR', thName: 'โซลาร์ พาวเวอร์ ไทย', accent: '#fde047', badgeBg: '#c2410c', motif: 16 },
  { id: 'drf', code: 'DRIFT', thName: 'ดริฟต์ โปร ไทร์ส', accent: '#fb923c', badgeBg: '#27272a', motif: 17 },
  { id: 'vlt', code: 'VOLT EV', thName: 'โวลต์ อีวี โมบิลิตี้', accent: '#5eead4', badgeBg: '#0e7490', motif: 18 },
  { id: 'fnx', code: 'FINIX', thName: 'ฟินิกซ์ แคปปิตอล', accent: '#fda4af', badgeBg: '#9f1239', motif: 19 },
  { id: 'znt', code: 'ZENITH', thName: 'เซนิธ เมดิคอล แคร์', accent: '#7dd3fc', badgeBg: '#075985', motif: 20 },
  { id: 'knt', code: 'KINETIC', thName: 'คิเนติก ไฮเดรต', accent: '#a3e635', badgeBg: '#166534', motif: 21 },
  { id: 'mtr', code: 'METRO', thName: 'เมโทร เอ็กซ์เพรส', accent: '#fcd34d', badgeBg: '#4338ca', motif: 22 },
  { id: 'sgl', code: 'SIAMGOLD', thName: 'สยาม โกลด์ บูลเลียน', accent: '#fde047', badgeBg: '#854d0e', motif: 23 },
  { id: 'thb', code: 'THAIJET', thName: 'ไทยเจ็ต คาร์โก้', accent: '#7dd3fc', badgeBg: '#0f172a', motif: 24 },
  { id: 'blw', code: 'BLUEWAVE', thName: 'บลูเวฟ มารีน', accent: '#67e8f9', badgeBg: '#0e7490', motif: 25 },
  { id: 'drg', code: 'DRAGO', thName: 'ดราโก้ แบตเตอรี่', accent: '#fde047', badgeBg: '#991b1b', motif: 26 },
  { id: 'egl', code: 'EAGLE X', thName: 'อีเกิล เอ็กซ์ โลจิสติกส์', accent: '#fca5a5', badgeBg: '#3f3f46', motif: 27 },
  { id: 'nxs', code: 'NEXUS', thName: 'เน็กซัส คลาวด์ ไทย', accent: '#c4b5fd', badgeBg: '#312e81', motif: 28 },
  { id: 'phx', code: 'PHOENIX', thName: 'ฟีนิกซ์ สปอร์ต ดริงก์', accent: '#fdba74', badgeBg: '#7c2d12', motif: 29 },
  { id: 'snt', code: 'SKYNET', thName: 'สกายเน็ต ไฟเบอร์', accent: '#5eead4', badgeBg: '#134e4a', motif: 30 },
  { id: 'roy', code: 'ROYAL88', thName: 'รอยัล เฮอริเทจ ที', accent: '#fef08a', badgeBg: '#713f12', motif: 31 }
];

function seededNext(state: number): number {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function getDefaultSponsorSeed(season = 1, teamId = 0): number {
  return Math.max(1, (season * 131 + teamId * 19 + 7) >>> 0);
}

/**
 * Deterministically produces a full permutation of SHIRT_SPONSOR_BRANDS indices
 * so assigned sponsors never repeat across slots.
 */
export function getShuffledSponsorIndices(seed = 1): number[] {
  const arr = SHIRT_SPONSOR_BRANDS.map((_, i) => i);
  let s = (Math.abs(Math.floor(seed)) || 1) >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s + 0x9e3779b9) >>> 0;
    const j = Math.floor(seededNext(s) * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Produces a unique, non-repeating list of brand IDs for all main sponsor package slots.
 * Optionally locks `keepAtIndex` so a currently signed jersey sponsor stays intact while
 * all other available offer slots receive distinct, non-repeating brands.
 */
export function pickUniqueSponsorBrandIds(
  seed = 1,
  count = 8,
  keepAtIndex?: { idx: number; brandId: string }
): string[] {
  const order = getShuffledSponsorIndices(seed).map((i) => SHIRT_SPONSOR_BRANDS[i].id);
  const keepValid = keepAtIndex && SHIRT_SPONSOR_BRANDS.some((b) => b.id === keepAtIndex.brandId);
  if (!keepValid) {
    return order.slice(0, count);
  }
  const keptId = keepAtIndex!.brandId;
  const remaining = order.filter((id) => id !== keptId);
  const out: string[] = [];
  let ptr = 0;
  for (let i = 0; i < count; i++) {
    if (i === keepAtIndex!.idx) {
      out.push(keptId);
    } else {
      out.push(remaining[ptr++] || order[i]);
    }
  }
  return out;
}

export function ensureStateSponsorBrands(
  s: Pick<GameState, 'sponsorSeed' | 'sponsorBrands' | 'season' | 'me' | 'sp'>,
  count = 8
): string[] {
  const existing = Array.isArray(s.sponsorBrands) ? s.sponsorBrands : [];
  const validSet = new Set(SHIRT_SPONSOR_BRANDS.map((b) => b.id));
  const uniqueExisting = Array.from(new Set(existing.filter((id) => validSet.has(id))));
  if (uniqueExisting.length >= count && existing.length === uniqueExisting.length) {
    return existing.slice(0, count);
  }
  const seed = s.sponsorSeed || getDefaultSponsorSeed(s.season ?? 1, s.me ?? 0);
  return pickUniqueSponsorBrandIds(seed, count);
}

export function resolveMainSponsorBrand(pkgIdx: number, sponsorSeed = 1): ShirtSponsorBrand {
  const order = getShuffledSponsorIndices(sponsorSeed);
  const safeIdx = ((pkgIdx % order.length) + order.length) % order.length;
  return SHIRT_SPONSOR_BRANDS[order[safeIdx]] || SHIRT_SPONSOR_BRANDS[0];
}

export function resolveStateSponsorBrand(
  s: Pick<GameState, 'sp' | 'sponsorSeed' | 'sponsorBrands' | 'season' | 'me'> | null | undefined,
  pkgIdx?: number
): ShirtSponsorBrand {
  const idx = Math.max(0, pkgIdx ?? s?.sp ?? 0);
  if (!s) {
    return resolveMainSponsorBrand(idx, 1);
  }
  const ids = ensureStateSponsorBrands(s);
  const id = ids[idx];
  return getSponsorBrandById(id) || resolveMainSponsorBrand(idx, s.sponsorSeed || getDefaultSponsorSeed(s.season ?? 1, s.me ?? 0));
}

export function getSponsorBrandById(id?: string | null): ShirtSponsorBrand | null {
  if (!id) return null;
  return SHIRT_SPONSOR_BRANDS.find((b) => b.id === id) || null;
}

export interface PartnerBrandBoardSpec {
  id: string;
  label: string;
  shortLabel: string;
  bg: string;
  accent: string;
}

export const PARTNER_DEAL_BRAND_SPECS: readonly PartnerBrandBoardSpec[] = [
  { id: 'drink', label: 'น้ำแร่ สปอร์ตไทย', shortLabel: 'H2O SPORT', bg: '#0284c7', accent: '#bae6fd' },
  { id: 'snack', label: 'ทาโร่ สแน็ค', shortLabel: 'TARO', bg: '#ea580c', accent: '#fde047' },
  { id: 'apparel', label: 'ลูกหนัง สปอร์ต', shortLabel: 'LNT PRO', bg: '#15803d', accent: '#bbf7d0' },
  { id: 'tyre', label: 'ยางสยามไดร์ฟ', shortLabel: 'SIAMDRIVE', bg: '#27272a', accent: '#fb923c' },
  { id: 'convenience', label: 'มาร์ท 24 ชม.', shortLabel: 'MART 24H', bg: '#be123c', accent: '#fef08a' },
  { id: 'ecom', label: 'ไทยมอลล์', shortLabel: 'THAIMALL', bg: '#d97706', accent: '#fef3c7' },
  { id: 'telecom', label: 'สยาม 5G+', shortLabel: '5G LIVE', bg: '#2563eb', accent: '#67e8f9' },
  { id: 'fintech', label: 'ดิจิทัลเพย์', shortLabel: 'DPAY', bg: '#7c3aed', accent: '#a7f3d0' },
  { id: 'airline', label: 'ไทยวิงส์', shortLabel: 'THAIWINGS', bg: '#0369a1', accent: '#fcd34d' },
  { id: 'asia_tech', label: 'เอเชีย โปร-เทค', shortLabel: 'ASIAPRO', bg: '#0f172a', accent: '#10b981' }
];

export function getPartnerDealBoardSpec(id: string, fallbackName?: string): PartnerBrandBoardSpec {
  const hit = PARTNER_DEAL_BRAND_SPECS.find((p) => p.id === id);
  if (hit) return hit;
  return {
    id,
    label: fallbackName || id.toUpperCase(),
    shortLabel: (fallbackName || id).slice(0, 8).toUpperCase(),
    bg: '#334155',
    accent: '#cbd5e1'
  };
}

export function getAiTeamSponsorBrand(
  teamId: number,
  season = 1,
  excludeBrandId?: string | null
): ShirtSponsorBrand {
  const order = getShuffledSponsorIndices(getDefaultSponsorSeed(season, 777));
  const pool = excludeBrandId
    ? order.filter((idx) => SHIRT_SPONSOR_BRANDS[idx]?.id !== excludeBrandId)
    : order;
  const pickIdx = pool[Math.abs(teamId) % Math.max(1, pool.length)] ?? 0;
  return SHIRT_SPONSOR_BRANDS[pickIdx] || SHIRT_SPONSOR_BRANDS[0];
}

/**
 * Pure SVG emblem paths inside a 16x16 viewbox (0..16),
 * designed with bold, crisp geometry to stay legible when printed on football jerseys.
 */
export function buildSponsorEmblemSvg(motif: number, ink: string, accent: string): string {
  const m = ((motif % 32) + 32) % 32;
  switch (m) {
    case 0: // Shield + check
      return `<path d="M8 1.5L13.5 3.8V8C13.5 11.4 11 13.7 8 15C5 13.7 2.5 11.4 2.5 8V3.8Z" fill="none" stroke="${accent}" stroke-width="1.7"/><path d="M5.4 8.2L7.3 10.2L10.9 6" fill="none" stroke="${ink}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 1: // Horns + bolt
      return `<path d="M2.2 5C4 2.4 6.5 2.7 8 4.6C9.5 2.7 12 2.4 13.8 5C11.9 4.8 10.2 5.6 8 5.6C5.8 5.6 4.1 4.8 2.2 5Z" fill="${accent}"/><path d="M9.1 5.9L5.4 10.6H8.5L7.1 14.9L11.6 9.5H8.5Z" fill="${ink}"/>`;
    case 2: // Wheel delta
      return `<circle cx="8" cy="8" r="6" fill="none" stroke="${accent}" stroke-width="1.7"/><path d="M4.5 11.2L8 4.1L11.5 11.2Z" fill="${ink}"/>`;
    case 3: // Play screen
      return `<rect x="1.8" y="2.8" width="12.4" height="9.2" rx="2.2" fill="none" stroke="${accent}" stroke-width="1.7"/><path d="M6.3 5.2L10.8 7.4L6.3 9.6Z" fill="${ink}"/><path d="M5 13.8H11" stroke="${accent}" stroke-width="1.7" stroke-linecap="round"/>`;
    case 4: // Hex A
      return `<polygon points="8,1.5 14,4.8 14,11.2 8,14.5 2,11.2 2,4.8" fill="none" stroke="${accent}" stroke-width="1.6"/><path d="M5.2 11.5L8 4.5L10.8 11.5M6.3 9.2H9.7" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 5: // Air wing
      return `<path d="M1.6 10.6C5.4 6.7 10 4.5 14.6 3.9C11.6 7 8.5 9.5 4.2 11.8Z" fill="${ink}"/><path d="M3.4 13.1C7 12.5 10.8 11.3 14.1 9" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round"/>`;
    case 6: // Pillars
      return `<polygon points="8,1.6 13.8,4.7 2.2,4.7" fill="${accent}"/><path d="M3.5 6.1H12.5M4.5 6.1V12.2M8 6.1V12.2M11.5 6.1V12.2M2.6 13.7H13.4" stroke="${ink}" stroke-width="1.7" stroke-linecap="round"/>`;
    case 7: // 5G rings
      return `<circle cx="8" cy="8" r="5.8" fill="none" stroke="${accent}" stroke-width="1.7" stroke-dasharray="3.6 1.8"/><circle cx="8" cy="8" r="2.7" fill="${ink}"/>`;
    case 8: // Flame drop
      return `<path d="M8 1.4C8 1.4 13.1 6.2 13.1 10A5.1 5.1 0 0 1 2.9 10C2.9 6.2 8 1.4 8 1.4Z" fill="none" stroke="${ink}" stroke-width="1.8"/><path d="M8 6.4C8 6.4 10.4 8.8 10.4 10.5A2.4 2.4 0 0 1 5.6 10.5C5.6 8.8 8 6.4 8 6.4Z" fill="${accent}"/>`;
    case 9: // Nova diamond wave
      return `<polygon points="8,1.5 14.3,8 8,14.5 1.7,8" fill="none" stroke="${accent}" stroke-width="1.7"/><path d="M4.3 8H11.7" stroke="${ink}" stroke-width="2.1" stroke-linecap="round"/><circle cx="8" cy="8" r="1.9" fill="${accent}"/>`;
    case 10: // Lightning cup
      return `<path d="M9.1 1.8L4.4 8.5H8L6.8 14.2L11.9 7H8.3Z" fill="${accent}" stroke="${ink}" stroke-width="1" stroke-linejoin="round"/>`;
    case 11: // Twin V
      return `<path d="M2.4 3.4L8 13.2L13.6 3.4" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 3.4L8 9L11 3.4" fill="none" stroke="${accent}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 12: // Orbit ring
      return `<circle cx="8" cy="8" r="3.1" fill="${ink}"/><ellipse cx="8" cy="8" rx="6.8" ry="2.8" transform="rotate(-25 8 8)" fill="none" stroke="${accent}" stroke-width="1.6"/>`;
    case 13: // Crown
      return `<path d="M2.1 12L3.5 4.6L6.4 8.2L8 3L9.6 8.2L12.5 4.6L13.9 12Z" fill="none" stroke="${accent}" stroke-width="1.7" stroke-linejoin="round"/><path d="M2.8 13.8H13.2" stroke="${ink}" stroke-width="1.9" stroke-linecap="round"/>`;
    case 14: // Pulse EKG
      return `<path d="M1.4 8.5H4.2L6 3.8L8.2 12.6L10.3 6.3L11.8 8.5H14.6" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 15: // Titan T block
      return `<path d="M2.4 2.8H13.6V6H9.7V13.6H6.3V6H2.4Z" fill="${ink}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>`;
    case 16: // Solar sun
      return `<circle cx="8" cy="8" r="3.3" fill="${accent}"/><path d="M8 1.4V3.4M8 12.6V14.6M1.4 8H3.4M12.6 8H14.6M3.3 3.3L4.7 4.7M11.3 11.3L12.7 12.7M12.7 3.3L11.3 4.7M4.7 11.3L3.3 12.7" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
    case 17: // Speed stripes
      return `<path d="M1.8 4.8H12.6L10.8 7.5H1.8ZM3.4 9H14.2L12.4 11.7H3.4Z" fill="${accent}"/><circle cx="12.6" cy="4.8" r="1.3" fill="${ink}"/>`;
    case 18: // Volt EV ring + spark
      return `<rect x="2.1" y="2.1" width="11.8" height="11.8" rx="3" fill="none" stroke="${ink}" stroke-width="1.7"/><path d="M9.1 4.4L5.7 8.3H8.3L7.1 11.9L10.6 7.8H8Z" fill="${accent}"/>`;
    case 19: // Finix wing
      return `<path d="M1.9 11.5L7.5 3.3L9.5 7.5L14.1 4.4L10.5 12.5Z" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linejoin="round"/><path d="M4.2 13H13.6" stroke="${accent}" stroke-width="1.9" stroke-linecap="round"/>`;
    case 20: // Zenith cross
      return `<rect x="6.1" y="1.8" width="3.8" height="12.4" rx="1" fill="${ink}"/><rect x="1.8" y="6.1" width="12.4" height="3.8" rx="1" fill="${accent}"/>`;
    case 21: // Kinetic twin chevrons
      return `<path d="M2.8 4.4L8 8.5L13.2 4.4M2.8 8.8L8 12.9L13.2 8.8" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 22: // Metro arrow box
      return `<path d="M1.8 4.4H10.6L14.2 8L10.6 11.6H1.8L5 8Z" fill="${accent}"/><path d="M4.5 8H10.5" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
    case 23: // Gold diamond bar
      return `<polygon points="4.5,2.8 11.5,2.8 14.5,7 8,13.9 1.5,7" fill="none" stroke="${accent}" stroke-width="1.7" stroke-linejoin="round"/><path d="M2 7H14" stroke="${ink}" stroke-width="1.6"/>`;
    case 24: // Jet delta
      return `<path d="M2 12L14 3.5L10 13.5L7.5 10L4.5 12.5Z" fill="${ink}"/><path d="M3 13.6H13" stroke="${accent}" stroke-width="1.8" stroke-linecap="round"/>`;
    case 25: // Bluewave double wave
      return `<path d="M1.5 6.5Q4.8 3.5 8 6.5T14.5 6.5" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/><path d="M1.5 10.5Q4.8 7.5 8 10.5T14.5 10.5" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
    case 26: // Drago claw slash
      return `<path d="M3 3L11.5 13M6.2 2.2L13.5 10.8M2.5 6.5L8.2 13.6" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>`;
    case 27: // Eagle X emblem
      return `<path d="M2.5 4L8 9.2L13.5 4M3.5 12.5L8 8L12.5 12.5" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="4.2" r="1.5" fill="${accent}"/>`;
    case 28: // Nexus node triangle
      return `<polygon points="8,2.5 13.2,12 2.8,12" fill="none" stroke="${accent}" stroke-width="1.6"/><circle cx="8" cy="2.5" r="1.7" fill="${ink}"/><circle cx="13.2" cy="12" r="1.7" fill="${ink}"/><circle cx="2.8" cy="12" r="1.7" fill="${ink}"/>`;
    case 29: // Phoenix crest star
      return `<polygon points="8,1.5 9.9,5.8 14.5,6.2 11,9.3 12.1,13.9 8,11.5 3.9,13.9 5,9.3 1.5,6.2 6.1,5.8" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8" cy="8.2" r="1.8" fill="${ink}"/>`;
    case 30: // Skynet signal arcs
      return `<path d="M2.8 6.5A7.2 7.2 0 0 1 13.2 6.5M5 9.2A4.2 4.2 0 0 1 11 9.2" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="12.2" r="1.8" fill="${ink}"/>`;
    case 31: // Royal laurel gem
    default:
      return `<polygon points="8,2 13.2,6.5 8,14 2.8,6.5" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linejoin="round"/><polygon points="8,4.8 10.6,7.2 8,11 5.4,7.2" fill="${accent}"/>`;
  }
}
