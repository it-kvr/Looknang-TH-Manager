import type { MatchEnvironment, StadiumStyleId, TurfMatchModifiers } from '../types/game';

export const CREST_SHAPES: { label: string; d: string }[] = [
  { label: 'โล่คลาสสิก', d: 'M3 2h18v11c0 5-4 8-9 10-5-2-9-5-9-10z' },
  { label: 'วงกลม', d: 'M12 1.2a10.8 10.8 0 100 21.6 10.8 10.8 0 000-21.6z' },
  { label: 'หกเหลี่ยม', d: 'M12 1.2l9.2 5v11.3L12 23l-9.2-5.5V6.2z' },
  { label: 'โล่โค้งยุโรป', d: 'M3.5 3q8.5 2 17 0v9.5c0 5.2-3.7 8.4-8.5 10.5C7.2 20.9 3.5 17.7 3.5 12.5z' },
  { label: 'เพชร', d: 'M12 1.2L22.2 12 12 22.8 1.8 12z' },
  { label: 'โล่มงกุฎ', d: 'M4 5.2l4-3.2 4 2.2 4-2.2 4 3.2v8c0 4.8-3.5 7.9-8 9.9-4.5-2-8-5.1-8-9.9z' },
  { label: 'วงรี', d: 'M12 1.3c5.3 0 8.7 4.8 8.7 10.7S17.3 22.7 12 22.7 3.3 17.9 3.3 12 6.7 1.3 12 1.3z' },
  { label: 'แปดเหลี่ยม', d: 'M8 1.8h8l5.8 5.8v8.8L16 22.2H8l-5.8-5.8V7.6z' },
  { label: 'โล่แหลม', d: 'M12 1.4l8.5 2.8v8.6c0 4.5-3.6 8-8.5 10-4.9-2-8.5-5.5-8.5-10V4.2z' },
  { label: 'โล่หัวใจ', d: 'M12 4.4C9.2 1.9 4.2 2.3 3.2 5.5c-.7 2.2-.2 5.8.8 8.3 1.3 3.5 4.2 6.8 8 9 3.8-2.2 6.7-5.5 8-9 1-2.5 1.5-6.1.8-8.3-1-3.2-6-3.6-8.8-1.1z' },
  { label: 'โล่ปีกเหยี่ยว', d: 'M2.2 4.6l4.2-.8L8.5 2h7l2.1 1.8 4.2.8-1.4 4.1v4.3c0 4.6-3.6 7.8-8.4 9.8-4.8-2-8.4-5.2-8.4-9.8V8.7z' },
  { label: 'ห้าเหลี่ยม', d: 'M12 1.4l9.6 7-3.7 12.8H6.1L2.4 8.4z' },
  { label: 'โล่คัมภีร์', d: 'M2.8 3.6c2.6-1.4 5.8-1.4 9.2 0 3.4-1.4 6.6-1.4 9.2 0l-1.3 9c-.6 4.4-3.7 7.8-7.9 9.8-4.2-2-7.3-5.4-7.9-9.8z' },
  { label: 'ตราแฉก', d: 'M12 1.4L15.2 4.2L19.5 4.5L19.8 8.8L22.6 12L19.8 15.2L19.5 19.5L15.2 19.8L12 22.6L8.8 19.8L4.5 19.5L4.2 15.2L1.4 12L4.2 8.8L4.5 4.5L8.8 4.2Z' },
  { label: 'โล่ปราสาท', d: 'M3.5 2.5h4.2v2.2h2.4V2.5h3.8v2.2h2.4V2.5h4.2v10.5c0 4.8-3.8 8.2-8.5 10-4.7-1.8-8.5-5.2-8.5-10z' },
  { label: 'ธงปลายแฉก', d: 'M3 2.2h18v11.5l-4.5 3.8L12 23l-4.5-5.5L3 13.7z' }
];

export const CREST_PATTERNS = [
  'แถบขวาง', 'ครึ่งตั้ง', 'คาดทแยง', 'สองแถบ', 'ริ้วตั้ง',
  'ผ่าสี่ส่วน', 'เชฟรอน V', 'กากบาท', 'วงแหวน', 'ไล่เฉด',
  'ครึ่งนอน', 'หมากรุก', 'ข้าวหลามตัด', 'กากบาท X', 'รัศมีแฉก',
  'สามเหลี่ยม', 'ทแยงคู่', 'เสาหลัก', 'ริ้วทแยง', 'รัศมีวง'
];

export const CREST_IC: Record<string, string> = {
  '⚽': '<circle cx="12" cy="12" r="8"/><path d="M12 8l3.2 2.4-1.2 3.8H10l-1.2-3.8zM12 4v4M15.2 10.4L19 9M14 14.2l2.3 3.4M10 14.2l-2.3 3.4M8.8 10.4L5 9"/>',
  '🦅': '<path d="M3 9c4-3 7-2 9 2 2-4 5-5 9-2-2 3-4 4-6 4l-3 6-3-6c-2 0-4-1-6-4zM12 6l1.5 2.5h-3z"/>',
  '🐘': '<path d="M6 17V9a5 5 0 0110 0v3c0 2 1 3 2.5 3 .8 0 1.5-.6 1.5-1.5V12M8 10c-2 0-3 1.5-3 3.5S6 17 8 17M10 17v2M14 17v2M12.5 9.5h.01"/>',
  '🐯': '<path d="M5 8l1.5-3.5L10 6.5h4L17.5 4.5 19 8a7 7 0 01-7 11A7 7 0 015 8zM9 11h.01M15 11h.01M10.5 14h3l-1.5 1.5z"/>',
  '🦁': '<path d="M12 4l2.5 2 3-.5 1 2.8 2 1.7-1.2 2.5.7 2.5-2.5 1.5-.5 2.5-2.5-.8L12 20l-2.5-1.8-2.5.8-.5-2.5L4 15l.7-2.5L3.5 10l2-1.7 1-2.8 3 .5zM9.5 11.5h.01M14.5 11.5h.01M10.5 14.5h3"/>',
  '🐉': '<path d="M5 17c1-6 4-10 9-11l3-2-1 4 3 1-2 3c2 2 1 6-2 7-3 1-6-1-7-4M8 9l2 1"/>',
  '🦈': '<path d="M4 14c3-5 8-7 16-6-3 3-4 5-4 8-3-1-5-1-8 1l1-2c-2 0-3.5 0-5-1zM13 8l1.5-4 2.5 3.5"/>',
  '🐂': '<path d="M5 6c0 3 2 4 4 4h6c2 0 4-1 4-4M7 10l1 6 4 3 4-3 1-6M10 13h.01M14 13h.01"/>',
  '🦢': '<path d="M6 17c2-2 5-2 8-1 2.5.8 4.5-.5 4.5-3 0-3-3-5-2-8 1-2 3-1 2.5 1M8 14l-3-2"/>',
  '🐺': '<path d="M5 8l2.5-4.5L10 6.5h4l2.5-3L19 8l-1.5 5L12 20l-5.5-7zM9.5 11.5h.01M14.5 11.5h.01M10.5 15l1.5 1.2 1.5-1.2"/>',
  '🦉': '<path d="M7 5l2.5 2h5L17 5v5a6 6 0 01-5 9 6 6 0 01-5-9zM9.5 10.5a1 1 0 100 .01M14.5 10.5a1 1 0 100 .01M11 13l1 1.8 1-1.8"/>',
  '🐴': '<path d="M7 19c0-4 1-7 3-10l2-5 4 2 2 4-3 2v3c0 2-1.5 4-4 4zM13.5 8.5h.01M15 11l3 1"/>',
  '🐗': '<path d="M6 13a6 5 0 0112 0c0 3-2.5 5-6 5s-6-2-6-5zM5 12c-1.5-1-2-2.5-1.5-4M19 12c1.5-1 2-2.5 1.5-4M10 13.5h4M9.5 10h.01M14.5 10h.01"/>',
  '🐊': '<path d="M3 14c3-2 7-2 11 0l6-2-2 4-5 2c-4 1-7 0-10-4zM8 11l2-2 2 2 2-2"/>',
  '🐍': '<path d="M6 18c4 0 6-2 6-4.5S9 11 9 8.5C9 6 11 4.5 14 5c2.5.4 4 2 4 4M15.5 8.5h.01M18 9l2-1"/>',
  '🦚': '<path d="M12 19v-7M12 12c-3-1-5-3.5-5-6.5M12 12c3-1 5-3.5 5-6.5M12 12V4.5M8.5 16.5c1.5-1 5.5-1 7 0"/>',
  '🐝': '<ellipse cx="12" cy="13" rx="4" ry="5"/><path d="M9 12h6M9.5 15h5M9 9C6 6 4 8 6.5 10.5M15 9c3-3 5-1 2.5 1.5M10.5 7L9 4.5M13.5 7L15 4.5"/>',
  '🦂': '<path d="M12 10v7M9 12h6M9 15h6M8 10C6 8 6 5 9 4M16 10c2-2 2-5-1-6M12 17c3 0 5-2 5-5s-2-4-4-4"/>',
  '🦀': '<path d="M7 13c0-2.5 2.2-4 5-4s5 1.5 5 4-2.2 4-5 4-5-1.5-5-4zM6 9C4 7 4 4.5 7 4M18 9c2-2 2-4.5-1-5M5 13l-2 2M5.5 16l-2 2M19 13l2 2M18.5 16l2 2"/>',
  '🔥': '<path d="M12 3c1.5 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-.5-5 1-8.5z"/>',
  '⚡': '<path d="M13 2L5 13h6l-1 9 9-12h-6z"/>',
  '⭐': '<path d="M12 3l2.6 5.4 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9z"/>',
  '👑': '<path d="M3 18h18l-1.5-9-4.5 4-3-6-3 6-4.5-4zM5 20h14"/>',
  '⚔️': '<path d="M5 19L19 5M14 5h5v5M5 5l14 14M10 5H5v5"/>',
  '🔱': '<path d="M12 3v18M7 5v5c0 2.8 2.2 4.5 5 4.5s5-1.7 5-4.5V5M10 18h4"/>',
  '🛡️': '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM12 7v10"/>',
  '🏹': '<path d="M5 19L19 5M14 5h5v5M6 10c2 2.5 5.5 6 8 8M6 10l4-4 8 8-4 4"/>',
  '🪓': '<path d="M8 20L17 5M13 7c3 0 5.5 1.5 6 4.5-2.5 1-5 1-7-1z"/>',
  '🌙': '<path d="M16 4.5A8 8 0 1019.5 16 6.5 6.5 0 0116 4.5z"/>',
  '☀️': '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  '🏔️': '<path d="M3 18l6-10 4 6 3-4 5 8zM9 8l2 2"/>',
  '🌊': '<path d="M3 11c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0c1-.9 2-1.4 3-1.4M3 16c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0c1-.9 2-1.4 3-1.4"/>',
  '💎': '<path d="M6 5h12l3 5-9 10L3 10zM3 10h18M9 5l3 5 3-5"/>',
  '⚓': '<circle cx="12" cy="6" r="2"/><path d="M12 8v12M8 11h8M5 14a7 7 0 0014 0"/>',
  '🏆': '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5v2a3 3 0 003 3M16 6h3v2a3 3 0 01-3 3M12 13v5M8 20h8"/>',
  '🏯': '<path d="M6 19v-7h12v7M4 12l8-4 8 4M7 8l5-4 5 4M10 19v-4h4v4"/>'
};

export const CREST_IC_NAMES: Record<string, string> = {
  '⚽': 'ฟุตบอล',
  '🦅': 'อินทรี',
  '🐘': 'ช้างศึก',
  '🐯': 'พยัคฆ์',
  '🦁': 'สิงโต',
  '🐉': 'มังกร',
  '🦈': 'ฉลาม',
  '🐂': 'กระทิง',
  '🦢': 'หงส์',
  '🐺': 'หมาป่า',
  '🦉': 'นกฮูก',
  '🐴': 'อาชา',
  '🐗': 'หมูป่า',
  '🐊': 'จระเข้',
  '🐍': 'พญานาค',
  '🦚': 'ไก่ฟ้า',
  '🐝': 'ต่อแตน',
  '🦂': 'แมงป่อง',
  '🦀': 'ปูนักรบ',
  '🔥': 'เปลวไฟ',
  '⚡': 'สายฟ้า',
  '⭐': 'ดาวทอง',
  '👑': 'มงกุฎ',
  '⚔️': 'ดาบไขว้',
  '🔱': 'ตรีศูล',
  '🛡️': 'โล่แกร่ง',
  '🏹': 'ธนูศึก',
  '🪓': 'ขวานศึก',
  '🌙': 'จันทร์เสี้ยว',
  '☀️': 'สุริยัน',
  '🏔️': 'ขุนเขา',
  '🌊': 'คลื่นสมุทร',
  '💎': 'เพชร',
  '⚓': 'สมอเรือ',
  '🏆': 'ถ้วยแชมป์',
  '🏯': 'ปราสาท'
};

export const KIT_PATTERNS = [
  'เรียบ', 'ริ้วตั้ง', 'ริ้วขวาง', 'ครึ่งตัว', 'คาดทแยง',
  'แถบอก', 'เชฟรอน V', 'หมากรุก', 'ผ่าสี่ส่วน', 'กากบาท',
  'แขนทูโทน', 'ไล่เฉด', 'ลายเส้นตั้ง', 'ลายสายฟ้า'
];

export const KIT_COLLARS = ['คอกลม', 'คอวี', 'คอปก', 'คอทูโทน'];

/** Smart complementary away kit pattern suggestions keyed by home kit pattern index */
export const AWAY_KIT_PAIRINGS: Record<number, readonly number[]> = {
  0: [5, 4, 12, 6],
  1: [0, 5, 10, 4],
  2: [0, 4, 12, 6],
  3: [0, 5, 11, 10],
  4: [0, 12, 5, 10],
  5: [0, 4, 1, 12],
  6: [0, 12, 2, 10],
  7: [0, 5, 10, 12],
  8: [0, 4, 12, 11],
  9: [0, 12, 5, 10],
  10: [5, 4, 1, 0],
  11: [0, 12, 6, 10],
  12: [4, 5, 10, 0],
  13: [0, 5, 12, 6]
};

export interface TurfGradeSpec {
  id: 'local' | 'regional' | 'pro' | 'elite' | 'fifa_hybrid';
  grade: 'D' | 'C' | 'B' | 'A' | 'S';
  name: string;
  shortName: string;
  desc: string;
  cutStyle: 'patchy' | 'bands' | 'pro_bands' | 'checker' | 'hybrid_pro';
  maxPuddles: number;
  /** [stripeEven, stripeOdd, apron] */
  palette: {
    day: readonly [string, string, string];
    rainy: readonly [string, string, string];
    night: readonly [string, string, string];
    nightRainy: readonly [string, string, string];
  };
  fatigueMult: number;
  injuryMult: number;
  passPaceBonus: number;
}

export const TURF_GRADE_SPECS: readonly TurfGradeSpec[] = [
  {
    id: 'local',
    grade: 'D',
    name: 'เกรด D · หญ้าพื้นบ้าน (ท้องถิ่น)',
    shortName: 'เกรด D พื้นบ้าน',
    desc: 'หญ้าพื้นบ้านสีอมเหลือง มีรอยสึกหน้าโกลและกลางสนาม ระบายน้ำช้า',
    cutStyle: 'patchy',
    maxPuddles: 7,
    palette: {
      day: ['#2f6f33', '#377d3a', '#1e4b21'],
      rainy: ['#255427', '#2b612e', '#173818'],
      night: ['#1d4f25', '#235c2c', '#0d2914'],
      nightRainy: ['#17401f', '#1c4b24', '#091e0f']
    },
    fatigueMult: 1.07,
    injuryMult: 1.12,
    passPaceBonus: -0.04
  },
  {
    id: 'regional',
    grade: 'C',
    name: 'เกรด C · หญ้าธรรมชาติมาตรฐาน',
    shortName: 'เกรด C มาตรฐาน',
    desc: 'หญ้าจริงตัดแถบกว้างเรียบร้อย สึกหรอบางจุดเวลาเจอฝน',
    cutStyle: 'bands',
    maxPuddles: 5,
    palette: {
      day: ['#24773e', '#2c8848', '#175229'],
      rainy: ['#1c5b31', '#236a3a', '#113c20'],
      night: ['#1a5c32', '#206b3b', '#0a2214'],
      nightRainy: ['#154a28', '#1a5730', '#081a10']
    },
    fatigueMult: 1.02,
    injuryMult: 1.04,
    passPaceBonus: -0.01
  },
  {
    id: 'pro',
    grade: 'B',
    name: 'เกรด B · หญ้านวลน้อยลีกอาชีพ',
    shortName: 'เกรด B ลีกอาชีพ',
    desc: 'หญ้าเขียวแน่นตัดลายแถบคมชัด พร้อมระบบระบายน้ำมาตรฐานลีก',
    cutStyle: 'pro_bands',
    maxPuddles: 3,
    palette: {
      day: ['#217846', '#298e53', '#165834'],
      rainy: ['#195836', '#1f6840', '#103b25'],
      night: ['#195e39', '#1f6e44', '#081d13'],
      nightRainy: ['#144b2e', '#195937', '#06160e']
    },
    fatigueMult: 1,
    injuryMult: 1,
    passPaceBonus: 0.01
  },
  {
    id: 'elite',
    grade: 'A',
    name: 'เกรด A · หญ้า Bermuda แข่งขัน',
    shortName: 'เกรด A เบอร์มิวดา',
    desc: 'หญ้าเบอร์มิวดาตัดลายตารางหมากรุกคมกริบ บอลไหลลื่น ระบายน้ำไว',
    cutStyle: 'checker',
    maxPuddles: 1,
    palette: {
      day: ['#1b7f49', '#259659', '#115430'],
      rainy: ['#166039', '#1d7345', '#0d3d24'],
      night: ['#15633b', '#1d7849', '#071f14'],
      nightRainy: ['#115030', '#17623b', '#061810']
    },
    fatigueMult: 0.96,
    injuryMult: 0.93,
    passPaceBonus: 0.03
  },
  {
    id: 'fifa_hybrid',
    grade: 'S',
    name: 'เกรด S · พื้นไฮบริด FIFA Pro',
    shortName: 'เกรด S FIFA Pro',
    desc: 'หญ้าไฮบริดตัดลายแชมเปียนส์ทูโทน พร้อมระบบดูดน้ำใต้ดิน ไร้แอ่งน้ำขัง',
    cutStyle: 'hybrid_pro',
    maxPuddles: 0,
    palette: {
      day: ['#147d4a', '#1f985b', '#0d5030'],
      rainy: ['#12673d', '#1a7d4b', '#0a3f25'],
      night: ['#11663c', '#1a7d4b', '#061c12'],
      nightRainy: ['#0f5634', '#166b41', '#05160e']
    },
    fatigueMult: 0.93,
    injuryMult: 0.88,
    passPaceBonus: 0.05
  }
];

export const getTurfGradeForLevel = (turfLv: number, turfCond = 100): TurfGradeSpec => {
  let idx = turfLv <= 1 ? 0 : turfLv <= 3 ? 1 : turfLv <= 6 ? 2 : turfLv <= 8 ? 3 : 4;
  if (turfCond < 55 && idx > 0) idx -= 1;
  return TURF_GRADE_SPECS[idx] || TURF_GRADE_SPECS[1];
};

export const getTurfGradeSpec = (id?: string): TurfGradeSpec =>
  TURF_GRADE_SPECS.find((t) => t.id === id) || TURF_GRADE_SPECS[2];

export const computeTurfMatchModifiers = (
  env?: Partial<Pick<MatchEnvironment, 'turfGrade' | 'turfCond' | 'grassLength' | 'dirtMix' | 'season'>> | null
): TurfMatchModifiers => {
  const spec = getTurfGradeSpec(env?.turfGrade);
  const cond = Math.max(30, Math.min(100, Math.round(env?.turfCond ?? 90)));
  const grassLen =
    env?.grassLength ||
    (spec.cutStyle === 'patchy' ? 'long' : spec.cutStyle === 'checker' || spec.cutStyle === 'hybrid_pro' ? 'short' : 'medium');
  const dirtMix = Math.max(0, Math.min(0.92, env?.dirtMix ?? 0));
  const isRainy = env?.season === 'rainy';

  const grassPassAdj = grassLen === 'short' ? 0.03 : grassLen === 'long' ? -0.05 : 0;
  const dirtPassAdj = -dirtMix * 0.085;
  const rainDirtPassAdj = isRainy && dirtMix > 0.18 ? -0.03 : 0;
  const condPassAdj = cond < 65 ? -((65 - cond) * 0.0012) : cond >= 90 ? 0.01 : 0;
  const passPaceMult = Number(
    Math.max(0.84, Math.min(1.09, 1 + spec.passPaceBonus + grassPassAdj + dirtPassAdj + rainDirtPassAdj + condPassAdj)).toFixed(3)
  );

  const gradeIdx = spec.grade === 'S' ? 4 : spec.grade === 'A' ? 3 : spec.grade === 'B' ? 2 : spec.grade === 'C' ? 1 : 0;
  const basePassDelta = [-3, -1, 0, 2, 3][gradeIdx] ?? 0;
  const baseTouchDelta = [-2, -1, 0, 1, 2][gradeIdx] ?? 0;
  const baseSpeedDelta = [-2, -1, 0, 1, 2][gradeIdx] ?? 0;

  const grassCtrlAdj = grassLen === 'short' ? 1 : grassLen === 'long' ? -1 : 0;
  const dirtPenalty = dirtMix >= 0.45 ? -2 : dirtMix >= 0.2 ? -1 : 0;
  const condPenalty = cond < 55 ? -1 : 0;

  const passDelta = Math.max(-5, Math.min(4, basePassDelta + grassCtrlAdj + dirtPenalty + condPenalty));
  const touchDelta = Math.max(-5, Math.min(4, baseTouchDelta + grassCtrlAdj + dirtPenalty + condPenalty));
  const speedDelta = Math.max(-5, Math.min(4, baseSpeedDelta + (grassLen === 'long' ? -1 : 0) + dirtPenalty + condPenalty));
  const finDelta = Math.max(-3, Math.min(3, (gradeIdx >= 3 ? 1 : gradeIdx === 0 ? -1 : 0) + (dirtMix >= 0.45 ? -1 : 0)));
  const defReadDelta = Math.max(-3, Math.min(3, (gradeIdx >= 3 ? 1 : gradeIdx === 0 ? -1 : 0) + condPenalty));

  const sprintSpeedMult = Number(
    Math.max(0.92, Math.min(1.05, 1 + speedDelta * 0.012 - (isRainy && dirtMix > 0.25 ? 0.015 : 0))).toFixed(3)
  );
  const slipMult = Number(
    Math.max(0.68, Math.min(1.55, (gradeIdx === 4 ? 0.72 : gradeIdx === 3 ? 0.85 : gradeIdx === 2 ? 1 : gradeIdx === 1 ? 1.15 : 1.32) + dirtMix * 0.35 + (cond < 65 ? 0.1 : 0))).toFixed(2)
  );
  const whiffMult = Number(
    Math.max(0.75, Math.min(1.4, (gradeIdx === 4 ? 0.78 : gradeIdx === 3 ? 0.88 : gradeIdx === 2 ? 1 : gradeIdx === 1 ? 1.1 : 1.22) + dirtMix * 0.26)).toFixed(2)
  );
  const interceptChaosMult = Number(
    Math.max(0.92, Math.min(1.16, 1 + (grassLen === 'long' ? 0.04 : grassLen === 'short' ? -0.04 : 0) + dirtMix * 0.12 - (gradeIdx >= 3 ? 0.03 : 0))).toFixed(2)
  );
  const fatigueMult = Number(
    Math.max(0.9, Math.min(1.18, spec.fatigueMult + (grassLen === 'long' ? 0.03 : 0) + (cond < 65 ? 0.04 : 0) + dirtMix * 0.04)).toFixed(3)
  );
  const injuryMult = Number(
    Math.max(0.84, Math.min(1.36, spec.injuryMult + dirtMix * 0.15 + (cond < 60 ? 0.06 : 0))).toFixed(3)
  );

  const statDeltas: Record<string, number> = {
    spd: speedDelta,
    agi: speedDelta,
    bal: Math.max(-4, Math.min(3, touchDelta + (gradeIdx >= 3 ? 1 : 0))),
    spass: passDelta,
    lpass: passDelta,
    crs: passDelta,
    cur: touchDelta,
    run: Math.max(-4, Math.min(3, touchDelta)),
    fin: finDelta,
    rd: defReadDelta,
    pos: defReadDelta,
    sv: finDelta,
    rfx: gradeIdx >= 3 ? 1 : dirtMix >= 0.5 ? -1 : 0
  };

  const passPct = Math.round((passPaceMult - 1) * 100);
  const fatPct = Math.round((fatigueMult - 1) * 100);
  const slipPct = Math.round((slipMult - 1) * 100);

  return {
    grade: spec.grade,
    gradeName: spec.name,
    passPaceMult,
    sprintSpeedMult,
    slipMult,
    whiffMult,
    interceptChaosMult,
    fatigueMult,
    injuryMult,
    statDeltas,
    effectsSummary: [
      `ความเร็วบอลบนพื้น ${passPct >= 0 ? `+${passPct}` : passPct}%`,
      `สปีด/จ่าย/คุมบอล ${speedDelta >= 0 ? `+${speedDelta}` : speedDelta} / ${passDelta >= 0 ? `+${passDelta}` : passDelta} / ${touchDelta >= 0 ? `+${touchDelta}` : touchDelta}`,
      `การใช้แรง ${fatPct >= 0 ? `+${fatPct}` : fatPct}%`,
      `โอกาสลื่น ${slipPct >= 0 ? `+${slipPct}` : slipPct}%`
    ]
  };
};

export interface StadiumStyleSpec {
  id: StadiumStyleId;
  name: string;
  shortName: string;
  archTag: string;
  desc: string;
  buildCost: number;
  capMult: number;
  crowdBonus: number;
  vipTicketMult: number;
  merchBoost: number;
  wearResist: number;
  rainShield: 'none' | 'partial' | 'full';
  highlights: readonly string[];
}

export const STADIUM_STYLE_SPECS: readonly StadiumStyleSpec[] = [
  {
    id: 'open_track',
    name: 'สเตเดียมกรีฑามาตรฐาน',
    shortName: 'ทรงกรีฑาเปิด',
    archTag: 'สนามเปิด 8 ลู่วิ่ง',
    desc: 'สนามกีฬาอเนกประสงค์แบบเปิดพร้อมลู่วิ่งรอบสนาม โครงสร้างโปร่ง ซ่อมบำรุงประหยัดและเสื่อมสภาพช้า',
    buildCost: 0,
    capMult: 1.0,
    crowdBonus: 0,
    vipTicketMult: 1.0,
    merchBoost: 0,
    wearResist: 0.78,
    rainShield: 'none',
    highlights: ['บำรุงรักษาง่าย เสื่อมสภาพช้า -22%', 'ความจุมาตรฐาน 100%']
  },
  {
    id: 'thai_heritage',
    name: 'เรือนไทยประยุกต์ อารีน่า',
    shortName: 'ทรงไทยประยุกต์',
    archTag: 'สถาปัตย์ไทยร่วมสมัย',
    desc: 'อัฒจันทร์หลังคาจั่วไทยประยุกต์อันเป็นเอกลักษณ์ ดึงดูดแฟนท้องถิ่นซื้อของที่ระลึกและส่งพลังใจเกมเหย้า',
    buildCost: 75,
    capMult: 1.04,
    crowdBonus: 1,
    vipTicketMult: 1.05,
    merchBoost: 0.14,
    wearResist: 0.92,
    rainShield: 'none',
    highlights: ['ยอดขายสโตร์เหย้า +14%', 'บรรยากาศเหย้า +1 · จุเพิ่ม +4%']
  },
  {
    id: 'fortress_kop',
    name: 'ป้อมปราการหลังโกล',
    shortName: 'ทรงป้อมปราการ',
    archTag: 'อัฒจันทร์ชันชิดขอบสนาม',
    desc: 'ไร้ลู่วิ่งคั่น อัฒจันทร์สูงชันติดขอบสนาม กดดันคู่แข่งทุกจังหวะและปลุกความนิ่ง/มุ่งมั่นทีมเหย้าสูงสุด',
    buildCost: 95,
    capMult: 1.06,
    crowdBonus: 2,
    vipTicketMult: 1.04,
    merchBoost: 0.06,
    wearResist: 1.0,
    rainShield: 'none',
    highlights: ['บรรยากาศเหย้า +2 (สูงสุด)', 'ความจุ +6% · กดดันคู่แข่งใกล้ชิด']
  },
  {
    id: 'modern_bowl',
    name: 'โถงชาม 360 องศา',
    shortName: 'ทรงโถงชาม 360°',
    archTag: 'โถงอัฒจันทร์ปิดรอบทิศ',
    desc: 'โครงสร้างโค้งปิดล้อมรอบด้าน ขยายความจุที่นั่งสูงสุดถึง 15% พร้อมกักเก็บเสียงเชียร์กระหึ่มทั่วสนาม',
    buildCost: 115,
    capMult: 1.15,
    crowdBonus: 1,
    vipTicketMult: 1.08,
    merchBoost: 0.08,
    wearResist: 0.96,
    rainShield: 'none',
    highlights: ['ความจุที่นั่ง +15%', 'บรรยากาศเหย้า +1 · รายได้ตั๋ว +8%']
  },
  {
    id: 'glass_pavilion',
    name: 'พาวิลเลียนกระจกพรีเมียม',
    shortName: 'ทรงกระจก VIP',
    archTag: 'บูติกพรีเมียม & บ็อกซ์ VIP',
    desc: 'หลังคากันสาดกระจกโปร่งแสงและเลานจ์รับรองหรูหรา ทำกำไรค่าตั๋วเกมเหย้าสูงและช่วยบังฝนบางส่วน',
    buildCost: 130,
    capMult: 0.96,
    crowdBonus: 0,
    vipTicketMult: 1.24,
    merchBoost: 0.12,
    wearResist: 1.02,
    rainShield: 'partial',
    highlights: ['รายได้ค่าตั๋ว +24% (สูงสุด)', 'หลังคาคลุมอัฒจันทร์กันฝนบางส่วน']
  },
  {
    id: 'cyber_dome',
    name: 'เมกะโดมหลังคาคลุม',
    shortName: 'ทรงเมกะโดม',
    archTag: 'อารีน่าหลังคาคลุมระดับทวีป',
    desc: 'สุดยอดอารีน่าหลังคาคลุมพร้อมจอ LED รอบทิศ ป้องกันแอ่งน้ำฝน 100% จุคนเยอะ และเสียงก้องกังวานระดับทวีป',
    buildCost: 175,
    capMult: 1.18,
    crowdBonus: 2,
    vipTicketMult: 1.16,
    merchBoost: 0.14,
    wearResist: 1.06,
    rainShield: 'full',
    highlights: ['ความจุ +18% · บรรยากาศ +2 · ตั๋ว +16%', 'หลังคาคลุมลดแอ่งน้ำฝนบนสนาม 100%']
  }
];

export const getStadiumStyleSpec = (id?: string | null): StadiumStyleSpec =>
  STADIUM_STYLE_SPECS.find((s) => s.id === id) || STADIUM_STYLE_SPECS[0];

export const getAiTeamStadiumStyleId = (teamId: number, teamName?: string, tier = 0): StadiumStyleId => {
  const hash =
    ([...(teamName || 'Club')].reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 5), 0) + (teamId + 1) * 29) >>> 0;
  if (tier >= 2) {
    const elitePool: StadiumStyleId[] = ['modern_bowl', 'fortress_kop', 'glass_pavilion', 'cyber_dome', 'thai_heritage'];
    return elitePool[hash % elitePool.length];
  }
  return STADIUM_STYLE_SPECS[hash % STADIUM_STYLE_SPECS.length].id;
};



