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
  { id: 'agd', code: 'AEROGUARD', thName: 'แอโร่การ์ด คอร์ป', accent: '#93c5fd', badgeBg: '#1d4ed8', motif: 4 },
  { id: 'sky', code: 'SIAMSKY', thName: 'สยามสกาย แอร์เวย์ส', accent: '#fde047', badgeBg: '#0284c7', motif: 5 },
  { id: 'bbp', code: 'BANGKOK', thName: 'บางกอก แบงก์ พรีเมียร์', accent: '#fbbf24', badgeBg: '#1e3a8a', motif: 6 },
  { id: 'u5g', code: 'ULTRA 5G', thName: 'อัลตร้า 5G ไทยแลนด์', accent: '#34d399', badgeBg: '#064e3b', motif: 7 },
  { id: 'apx', code: 'APEX OIL', thName: 'เอเพ็กซ์ ฟูเอล กรุ๊ป', accent: '#fb923c', badgeBg: '#9a3412', motif: 8 },
  { id: 'nvp', code: 'NOVAPAY', thName: 'โนวา เพย์ ดิจิทัล', accent: '#a7f3d0', badgeBg: '#7c3aed', motif: 9 },
  { id: 'zap', code: 'ZAP! CAFE', thName: 'แซป คอฟฟี่ โรสเตอร์', accent: '#fde68a', badgeBg: '#78350f', motif: 10 },
  { id: 'vtx', code: 'VERTEX', thName: 'เวอร์เท็กซ์ มอเตอร์สปอร์ต', accent: '#f43f5e', badgeBg: '#18181b', motif: 11 },
  { id: 'orb', code: 'ORBIT', thName: 'ออร์บิท เทเลคอม', accent: '#67e8f9', badgeBg: '#0369a1', motif: 12 },
  { id: 'crw', code: 'CROWN', thName: 'คราวน์ รีสอร์ท & โฮเทล', accent: '#fcd34d', badgeBg: '#4c1d95', motif: 13 },
  { id: 'pls', code: 'PULSE', thName: 'พัลส์ สปอร์ต แวร์', accent: '#bef264', badgeBg: '#14532d', motif: 14 },
  { id: 'ttn', code: 'TITAN', thName: 'ไททัน สตีล เวิร์คส์', accent: '#cbd5e1', badgeBg: '#334155', motif: 15 },
  { id: 'slr', code: 'SOLAR', thName: 'โซลาร์ พาวเวอร์ ไทย', accent: '#fde047', badgeBg: '#c2410c', motif: 16 },
  { id: 'drf', code: 'DRIFT', thName: 'ดริฟต์ โปร ไทร์ส', accent: '#fb923c', badgeBg: '#27272a', motif: 17 },
  { id: 'vlt', code: 'VOLT EV', thName: 'โวลต์ อีวี โมบิลิตี้', accent: '#5eead4', badgeBg: '#0e7490', motif: 18 },
  { id: 'fnx', code: 'FINIX', thName: 'ฟินิกซ์ แคปปิตอล', accent: '#fda4af', badgeBg: '#9f1239', motif: 19 },
  { id: 'znt', code: 'ZENITH', thName: 'เซนิธ เมดิคอล แคร์', accent: '#7dd3fc', badgeBg: '#075985', motif: 20 },
  { id: 'knt', code: 'KINETIC', thName: 'คิเนติก ไฮเดรต', accent: '#a3e635', badgeBg: '#166534', motif: 21 },
  { id: 'mtr', code: 'METRO', thName: 'เมโทร เอ็กซ์เพรส', accent: '#fcd34d', badgeBg: '#4338ca', motif: 22 },
  { id: 'sgl', code: 'SIAMGOLD', thName: 'สยาม โกลด์ บูลเลียน', accent: '#fde047', badgeBg: '#854d0e', motif: 23 }
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

export function resolveMainSponsorBrand(pkgIdx: number, sponsorSeed = 1): ShirtSponsorBrand {
  const order = getShuffledSponsorIndices(sponsorSeed);
  const safeIdx = ((pkgIdx % order.length) + order.length) % order.length;
  return SHIRT_SPONSOR_BRANDS[order[safeIdx]] || SHIRT_SPONSOR_BRANDS[0];
}

export function getSponsorBrandById(id?: string | null): ShirtSponsorBrand | null {
  if (!id) return null;
  return SHIRT_SPONSOR_BRANDS.find((b) => b.id === id) || null;
}

export function getAiTeamSponsorBrand(teamId: number): ShirtSponsorBrand {
  const idx = Math.abs((teamId * 7 + 3) % SHIRT_SPONSOR_BRANDS.length);
  return SHIRT_SPONSOR_BRANDS[idx] || SHIRT_SPONSOR_BRANDS[0];
}

/**
 * Pure SVG emblem path centered inside a 16x16 viewbox (0..16),
 * designed specifically to stay legible when printed on a football jersey chest.
 */
export function buildSponsorEmblemSvg(motif: number, ink: string, accent: string): string {
  const m = ((motif % 24) + 24) % 24;
  switch (m) {
    case 0: // Shield + check
      return `<path d="M8 1.5L13.5 3.8V8C13.5 11.4 11 13.7 8 15C5 13.7 2.5 11.4 2.5 8V3.8Z" fill="none" stroke="${accent}" stroke-width="1.6"/><path d="M5.5 8.2L7.3 10.1L10.8 6" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 1: // Horns + bolt
      return `<path d="M2.5 5C4 2.5 6.5 2.8 8 4.6C9.5 2.8 12 2.5 13.5 5C11.8 4.8 10.2 5.6 8 5.6C5.8 5.6 4.2 4.8 2.5 5Z" fill="${accent}"/><path d="M9 6L5.5 10.5H8.5L7.2 14.8L11.5 9.5H8.5Z" fill="${ink}"/>`;
    case 2: // Wheel delta
      return `<circle cx="8" cy="8" r="6" fill="none" stroke="${accent}" stroke-width="1.6"/><path d="M4.6 11L8 4.2L11.4 11Z" fill="${ink}"/>`;
    case 3: // Play screen
      return `<rect x="1.8" y="3" width="12.4" height="9" rx="2.2" fill="none" stroke="${accent}" stroke-width="1.6"/><path d="M6.4 5.3L10.6 7.5L6.4 9.7Z" fill="${ink}"/><path d="M5 13.8H11" stroke="${accent}" stroke-width="1.6" stroke-linecap="round"/>`;
    case 4: // Hex A
      return `<polygon points="8,1.5 14,4.8 14,11.2 8,14.5 2,11.2 2,4.8" fill="none" stroke="${accent}" stroke-width="1.5"/><path d="M5.2 11.5L8 4.5L10.8 11.5M6.3 9.2H9.7" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 5: // Air wing
      return `<path d="M1.8 10.5C5.5 6.8 10 4.6 14.5 4C11.5 7 8.5 9.5 4.2 11.8Z" fill="${ink}"/><path d="M3.5 13C7 12.4 10.8 11.2 14 9" fill="none" stroke="${accent}" stroke-width="1.7" stroke-linecap="round"/>`;
    case 6: // Pillars
      return `<polygon points="8,1.8 13.5,4.6 2.5,4.6" fill="${accent}"/><path d="M3.5 6H12.5M4.5 6V12.2M8 6V12.2M11.5 6V12.2M2.8 13.6H13.2" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
    case 7: // 5G rings
      return `<circle cx="8" cy="8" r="5.8" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="3.5 1.8"/><circle cx="8" cy="8" r="2.6" fill="${ink}"/>`;
    case 8: // Flame drop
      return `<path d="M8 1.5C8 1.5 13 6.2 13 10A5 5 0 0 1 3 10C3 6.2 8 1.5 8 1.5Z" fill="none" stroke="${ink}" stroke-width="1.7"/><path d="M8 6.5C8 6.5 10.3 8.8 10.3 10.5A2.3 2.3 0 0 1 5.7 10.5C5.7 8.8 8 6.5 8 6.5Z" fill="${accent}"/>`;
    case 9: // Nova diamond wave
      return `<polygon points="8,1.6 14.2,8 8,14.4 1.8,8" fill="none" stroke="${accent}" stroke-width="1.5"/><path d="M4.5 8H11.5" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="8" r="1.8" fill="${accent}"/>`;
    case 10: // Lightning cup
      return `<path d="M9 2L4.5 8.5H8L6.8 14L11.8 7H8.3Z" fill="${accent}" stroke="${ink}" stroke-width="0.9" stroke-linejoin="round"/>`;
    case 11: // Twin V
      return `<path d="M2.5 3.5L8 13L13.5 3.5" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 3.5L8 9L11 3.5" fill="none" stroke="${accent}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 12: // Orbit ring
      return `<circle cx="8" cy="8" r="3" fill="${ink}"/><ellipse cx="8" cy="8" rx="6.8" ry="2.8" transform="rotate(-25 8 8)" fill="none" stroke="${accent}" stroke-width="1.5"/>`;
    case 13: // Crown
      return `<path d="M2.2 12L3.5 4.8L6.4 8.2L8 3.2L9.6 8.2L12.5 4.8L13.8 12Z" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 13.8H13" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
    case 14: // Pulse EKG
      return `<path d="M1.5 8.5H4.2L6 4L8.2 12.5L10.3 6.5L11.8 8.5H14.5" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 15: // Titan T block
      return `<path d="M2.5 3H13.5V6H9.6V13.5H6.4V6H2.5Z" fill="${ink}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>`;
    case 16: // Solar sun
      return `<circle cx="8" cy="8" r="3.2" fill="${accent}"/><path d="M8 1.5V3.3M8 12.7V14.5M1.5 8H3.3M12.7 8H14.5M3.4 3.4L4.7 4.7M11.3 11.3L12.6 12.6M12.6 3.4L11.3 4.7M4.7 11.3L3.4 12.6" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>`;
    case 17: // Speed stripes
      return `<path d="M2 5H12.5L10.8 7.5H2ZM3.5 9H14L12.3 11.5H3.5Z" fill="${accent}"/><circle cx="12.5" cy="5" r="1.2" fill="${ink}"/>`;
    case 18: // Volt EV ring + spark
      return `<rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M9 4.5L5.8 8.3H8.3L7.2 11.8L10.5 7.8H8Z" fill="${accent}"/>`;
    case 19: // Finix wing
      return `<path d="M2 11.5L7.5 3.5L9.5 7.5L14 4.5L10.5 12.5Z" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/><path d="M4.5 12.5H13.5" stroke="${accent}" stroke-width="1.8" stroke-linecap="round"/>`;
    case 20: // Zenith cross
      return `<rect x="6.2" y="2" width="3.6" height="12" rx="1" fill="${ink}"/><rect x="2" y="6.2" width="12" height="3.6" rx="1" fill="${accent}"/>`;
    case 21: // Kinetic twin chevrons
      return `<path d="M3 4.5L8 8.5L13 4.5M3 8.8L8 12.8L13 8.8" fill="none" stroke="${accent}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 22: // Metro arrow box
      return `<path d="M2 4.5H10.5L14 8L10.5 11.5H2L5 8Z" fill="${accent}"/><path d="M4.5 8H10.5" stroke="${ink}" stroke-width="1.7" stroke-linecap="round"/>`;
    case 23: // Gold diamond bar
    default:
      return `<polygon points="4.5,3 11.5,3 14.5,7 8,13.8 1.5,7" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 7H14" stroke="${ink}" stroke-width="1.5"/>`;
  }
}
