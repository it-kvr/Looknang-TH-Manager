import type {
  StatKey,
  TrainingProgramId,
  Player,
  PersonalMissionMetric,
  PlayerMissionsState,
  MissionStageOutcome,
  MissionAttemptLog,
  Team,
  PlayerCareerProfile,
  GameState,
  PersonalMissionDef,
  FinishedMatchPayload
} from '../types/game';
import { R, clamp } from '../utils/math';
import { ATT, SIGL } from '../data/thaiFootballData';
import { OVF, xi, DT, ovMe, syncMe } from './playerCore';

const grayShadeHex = (v: number, minRgb: [number, number, number], maxRgb: [number, number, number]): string => {
  const t = clamp((v - 10) / 39, 0, 1);
  const r = Math.round(minRgb[0] + (maxRgb[0] - minRgb[0]) * t);
  const g = Math.round(minRgb[1] + (maxRgb[1] - minRgb[1]) * t);
  const b = Math.round(minRgb[2] + (maxRgb[2] - minRgb[2]) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

export const ovColor = (v: number) => {
  if (v < 50) return grayShadeHex(v, [128, 137, 150], [59, 68, 82]);
  return v >= 90
    ? '#d97706'
    : v >= 80
      ? '#7c3aed'
      : v >= 70
        ? '#059669'
        : v >= 60
          ? '#0d9488'
          : '#0284c7';
};

export const statBarColor = (v: number) => {
  if (v < 50) return grayShadeHex(v, [155, 164, 178], [71, 85, 105]);
  return v >= 90
    ? '#f59e0b'
    : v >= 80
      ? '#8b5cf6'
      : v >= 70
        ? '#10b981'
        : v >= 60
          ? '#14b8a6'
          : '#0ea5e9';
};

export interface StatTierMeta {
  textClass: string;
  darkTextClass: string;
  badgeClass: string;
  dotClass: string;
  hex: string;
}

export function statTierMeta(v: number): StatTierMeta {
  if (v >= 90) {
    return {
      textClass: 'text-amber-700 dark:text-amber-300',
      darkTextClass: 'text-amber-300',
      badgeClass: 'bg-amber-500/14 border-amber-500/35 text-amber-800 dark:text-amber-200',
      dotClass: 'bg-amber-500',
      hex: '#f59e0b'
    };
  }
  if (v >= 80) {
    return {
      textClass: 'text-violet-700 dark:text-violet-300',
      darkTextClass: 'text-violet-300',
      badgeClass: 'bg-violet-500/14 border-violet-500/35 text-violet-800 dark:text-violet-200',
      dotClass: 'bg-violet-500',
      hex: '#8b5cf6'
    };
  }
  if (v >= 70) {
    return {
      textClass: 'text-emerald-700 dark:text-emerald-300',
      darkTextClass: 'text-emerald-300',
      badgeClass: 'bg-emerald-500/14 border-emerald-500/35 text-emerald-800 dark:text-emerald-200',
      dotClass: 'bg-emerald-500',
      hex: '#10b981'
    };
  }
  if (v >= 60) {
    return {
      textClass: 'text-teal-700 dark:text-teal-300',
      darkTextClass: 'text-teal-300',
      badgeClass: 'bg-teal-500/14 border-teal-500/35 text-teal-800 dark:text-teal-200',
      dotClass: 'bg-teal-500',
      hex: '#14b8a6'
    };
  }
  if (v >= 50) {
    return {
      textClass: 'text-sky-700 dark:text-sky-300',
      darkTextClass: 'text-sky-300',
      badgeClass: 'bg-sky-500/14 border-sky-500/35 text-sky-800 dark:text-sky-200',
      dotClass: 'bg-sky-500',
      hex: '#0ea5e9'
    };
  }
  if (v >= 42) {
    return {
      textClass: 'text-slate-700 dark:text-slate-200',
      darkTextClass: 'text-slate-200',
      badgeClass: 'bg-slate-700/22 border-slate-600/50 text-slate-800 dark:bg-slate-400/25 dark:border-slate-400/45 dark:text-slate-100',
      dotClass: 'bg-slate-700 dark:bg-slate-300',
      hex: statBarColor(v)
    };
  }
  if (v >= 32) {
    return {
      textClass: 'text-slate-600 dark:text-slate-300',
      darkTextClass: 'text-slate-300',
      badgeClass: 'bg-slate-600/18 border-slate-500/42 text-slate-700 dark:text-slate-200',
      dotClass: 'bg-slate-500',
      hex: statBarColor(v)
    };
  }
  if (v >= 20) {
    return {
      textClass: 'text-slate-500 dark:text-slate-400',
      darkTextClass: 'text-slate-400',
      badgeClass: 'bg-slate-500/14 border-slate-500/32 text-slate-600 dark:text-slate-300',
      dotClass: 'bg-slate-400',
      hex: statBarColor(v)
    };
  }
  return {
    textClass: 'text-slate-400 dark:text-slate-500',
    darkTextClass: 'text-slate-500',
    badgeClass: 'bg-slate-400/10 border-slate-400/25 text-slate-500 dark:text-slate-400',
    dotClass: 'bg-slate-400/65',
    hex: statBarColor(v)
  };
}

export function getPlayerTalent(q: Player, careerP?: PlayerCareerProfile | null): number {
  const explicit = q.me && careerP?.talent != null ? careerP.talent : q.talent;
  if (explicit != null && !Number.isNaN(explicit)) {
    return clamp(Math.round(explicit), 25, 99);
  }
  const h = [...(q.n || 'นักเตะ')].reduce((s, ch, i) => s + ch.charCodeAt(0) * (i + 1), 0);
  return clamp(Math.round(40 + ((q.pot || q.ov || 65) - 55) * 0.5 + ((h % 25) - 10)), 30, 92);
}

export function talentTierMeta(tl: number): { label: string; emoji: string; badgeCls: string; bg: string; color: string } {
  if (tl >= 85) {
    return {
      label: 'อัจฉริยะลูกหนัง',
      emoji: '💎',
      badgeCls: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300',
      bg: 'rgba(245, 158, 11, 0.22)',
      color: '#f59e0b'
    };
  }
  if (tl >= 70) {
    return {
      label: 'พรสวรรค์สูง',
      emoji: '🌟',
      badgeCls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
      bg: 'rgba(16, 185, 129, 0.2)',
      color: '#10b981'
    };
  }
  if (tl >= 50) {
    return {
      label: 'มาตรฐานอาชีพ',
      emoji: '⚡',
      badgeCls: 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300',
      bg: 'rgba(14, 165, 233, 0.2)',
      color: '#0ea5e9'
    };
  }
  return {
    label: 'ต้องฝึกหนักเป็นพิเศษ',
    emoji: '🧱',
    badgeCls: 'bg-slate-500/18 border-slate-500/40 text-slate-600 dark:text-slate-300',
    bg: tl >= 40 ? 'rgba(71, 85, 105, 0.28)' : 'rgba(148, 163, 184, 0.16)',
    color: tl >= 40 ? '#cbd5e1' : '#94a3b8'
  };
}

export const PERSONAL_MISSIONS: PersonalMissionDef[] = [
  {
    id: 'setpiece',
    icon: '🎯',
    name: 'เจ้าพ่อลูกตั้งเตะ',
    desc: 'รับหน้าที่เล่นลูกตั้งเตะ (ฟรีคิก / เตะมุม / จุดโทษ) หรือซ้อมเตะนิ่ง',
    metric: 'setpieces',
    unit: 'ครั้ง',
    targets: [4, 10, 20, 35, 55],
    subRewards: [
      { fk: 4, cur: 2 },
      { fk: 5, cur: 3 },
      { fk: 5, cur: 3, comp: 2 },
      { fk: 6, cur: 4, comp: 2 },
      { fk: 7, cur: 5, comp: 3 }
    ],
    coreReward: 'sh',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'passing',
    icon: '📐',
    name: 'จอมทัพส่งบอลแม่นยำ',
    desc: 'จ่ายบอลสำเร็จในสนามแข่งขันอย่างต่อเนื่องเพื่อปลดล็อกวิสัยทัศน์เกม',
    metric: 'passes',
    unit: 'ครั้ง',
    targets: [80, 220, 460, 820, 1300],
    subRewards: [
      { crs: 3, rd: 3, dist: 2 },
      { crs: 4, rd: 3, dist: 3 },
      { crs: 4, rd: 4, dist: 3 },
      { crs: 5, rd: 4, dist: 4 },
      { crs: 6, rd: 5, dist: 5, comp: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [1, 1, 1, 1, 2]
  },
  {
    id: 'finishing',
    icon: '🔥',
    name: 'เพชฌฆาตสับไก',
    desc: 'หาจังหวะยิงประตูและลุ้นจบสกอร์ในเกมจริงอย่างต่อเนื่อง',
    metric: 'shots',
    unit: 'ครั้ง',
    targets: [12, 30, 60, 105, 165],
    subRewards: [
      { fin: 4, pw: 3, run: 2 },
      { fin: 5, pw: 3, cur: 2 },
      { fin: 5, pw: 4, comp: 2 },
      { fin: 6, pw: 4, run: 3 },
      { fin: 7, pw: 5, comp: 3 }
    ],
    coreReward: 'sh',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'sharpshooter',
    icon: '🏹',
    name: 'ยิงตรงกรอบเฉียบคม',
    desc: 'ส่งบอลพุ่งตรงกรอบบังคับผู้รักษาประตูต้องออกแรงเซฟ',
    metric: 'onTarget',
    unit: 'ครั้ง',
    targets: [6, 16, 32, 56, 90],
    subRewards: [
      { fin: 4, cur: 3 },
      { fin: 5, cur: 3, pw: 2 },
      { fin: 5, cur: 4, comp: 2 },
      { fin: 6, cur: 4, run: 3 },
      { fin: 7, cur: 5, comp: 3 }
    ],
    coreReward: 'sh',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'goalscorer',
    icon: '⚽',
    name: 'เครื่องจักรถล่มประตู',
    desc: 'ยิงประตูสำคัญพาทีมไล่ล่าแต้มในเกมจริง',
    metric: 'goals',
    unit: 'ประตู',
    targets: [3, 8, 16, 28, 45],
    subRewards: [
      { fin: 4, run: 3, comp: 2 },
      { fin: 5, run: 3, comp: 2 },
      { fin: 5, pw: 4, comp: 3 },
      { fin: 6, run: 4, comp: 3 },
      { fin: 7, pw: 5, comp: 4 }
    ],
    coreReward: 'sh',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'playmaker',
    icon: '🎁',
    name: 'จอมเปิดบอล & แอสซิสต์',
    desc: 'เปิดบอลเข้ากรอบ แทงทะลุช่อง หรือจ่ายให้เพื่อนยิงประตู',
    metric: 'crossAssists',
    unit: 'ครั้ง',
    targets: [10, 24, 48, 82, 125],
    subRewards: [
      { crs: 4, cur: 3, run: 2 },
      { crs: 5, cur: 3, fk: 2 },
      { crs: 5, cur: 4, run: 3 },
      { crs: 6, cur: 4, rd: 3 },
      { crs: 7, cur: 5, run: 4 }
    ],
    coreReward: 'ps',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'dribbler',
    icon: '⚡',
    name: 'สปีด & เลี้ยงกินตัว',
    desc: 'พาบอลแหวกแนวรับหรือโชว์สกิลเลี้ยงหลบคู่แข่งในเกม',
    metric: 'dribbles',
    unit: 'ครั้ง',
    targets: [20, 50, 100, 175, 275],
    subRewards: [
      { spd: 4, run: 3, cur: 2 },
      { spd: 4, run: 4, str: 2 },
      { spd: 5, run: 4, cur: 3 },
      { spd: 6, run: 5, str: 3 },
      { spd: 7, run: 6, cur: 4 }
    ],
    coreReward: 'dr',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'defender',
    icon: '🛡️',
    name: 'ปราการเหล็กเข้าสกัด',
    desc: 'เข้าสกัดแย่งบอลและดักตัดทางบอลคู่แข่งอย่างแม่นยำ',
    metric: 'tackles',
    unit: 'ครั้ง',
    targets: [16, 40, 80, 140, 220],
    subRewards: [
      { pos: 4, mrk: 3, rd: 2 },
      { pos: 4, mrk: 4, rd: 3 },
      { pos: 5, mrk: 4, blk: 3, comp: 2 },
      { pos: 6, mrk: 5, rd: 4 },
      { pos: 7, mrk: 6, comp: 3 }
    ],
    coreReward: 'tk',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['DF', 'MF']
  },
  {
    id: 'shotblocker',
    icon: '🧱',
    name: 'กำแพงบล็อกลูกยิง',
    desc: 'อ่านจังหวะพุ่งบล็อกลูกยิงอันตรายช่วยแนวรับและผู้รักษาประตู',
    metric: 'blocks',
    unit: 'ครั้ง',
    targets: [5, 13, 26, 45, 72],
    subRewards: [
      { blk: 4, pos: 3, tol: 2 },
      { blk: 5, pos: 3, str: 2 },
      { blk: 5, mrk: 4, tol: 3 },
      { blk: 6, pos: 4, comp: 3 },
      { blk: 7, mrk: 5, str: 4 }
    ],
    coreReward: 'tk',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['DF', 'MF']
  },
  {
    id: 'aerial',
    icon: '🗣️',
    name: 'จ้าวเวหาลูกโหม่ง',
    desc: 'ดวลลูกกลางอากาศและเทกตัวโหม่งทั้งเกมรุกและเกมรับ',
    metric: 'headers',
    unit: 'ครั้ง',
    targets: [10, 24, 48, 82, 130],
    subRewards: [
      { hd: 4, str: 3 },
      { hd: 5, str: 3, pos: 2 },
      { hd: 5, str: 4, comp: 2 },
      { hd: 6, str: 5, pos: 3 },
      { hd: 7, str: 5, comp: 3 }
    ],
    coreReward: 'ph',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'goalkeeper',
    icon: '🧤',
    name: 'มือกาวจอมเซฟ',
    desc: 'เซฟลูกยิงตรงกรอบและออกมาชก/คว้าบอลกลางอากาศ',
    metric: 'saves',
    unit: 'ครั้ง',
    targets: [15, 36, 70, 120, 185],
    subRewards: [
      { sv: 4, cl: 3, dist: 2 },
      { sv: 5, cl: 4, comp: 2 },
      { sv: 5, cl: 4, dist: 3 },
      { sv: 6, cl: 5, comp: 3 },
      { sv: 7, cl: 6, dist: 4 }
    ],
    coreReward: 'tk',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['GK']
  },
  {
    id: 'gk_clean',
    icon: '🔒',
    name: 'เสาหลักเก็บคลีนชีต',
    desc: 'คุมแนวรับให้ทีมไม่เสียประตูจนจบเกม',
    metric: 'cleanSheets',
    unit: 'นัด',
    targets: [2, 5, 10, 17, 26],
    subRewards: [
      { pos: 4, comp: 3, rec: 2 },
      { mrk: 4, comp: 3, sv: 3 },
      { cl: 4, pos: 4, comp: 3 },
      { sv: 5, mrk: 5, comp: 4 },
      { pos: 6, cl: 5, comp: 5 }
    ],
    coreReward: 'tk',
    coreRewards: [1, 1, 1, 1, 2],
    posFilter: ['GK', 'DF']
  },
  {
    id: 'winner',
    icon: '🏆',
    name: 'จิตวิญญาณผู้ชนะ',
    desc: 'มีส่วนร่วมพาทีมคว้าชัยชนะในเกมการแข่งขันจริง',
    metric: 'wins',
    unit: 'นัด',
    targets: [4, 10, 18, 30, 46],
    subRewards: [
      { comp: 4, sta: 3, rd: 2 },
      { comp: 4, str: 3, run: 3 },
      { comp: 5, sta: 4, rd: 3 },
      { comp: 6, tol: 4, rec: 4 },
      { comp: 7, sta: 5, rec: 5 }
    ],
    coreReward: 'ph',
    coreRewards: [1, 1, 1, 1, 2]
  },
  {
    id: 'mvp_form',
    icon: '⭐',
    name: 'ฟอร์มเทพสม่ำเสมอ',
    desc: 'โชว์ฟอร์มเด่นคว้าเรตติ้งหลังเกม 7.2 ขึ้นไปอย่างต่อเนื่อง',
    metric: 'highRatings',
    unit: 'นัด',
    targets: [3, 8, 16, 28, 44],
    subRewards: [
      { comp: 4, rd: 3, cur: 2 },
      { comp: 5, rd: 3, fin: 3 },
      { comp: 5, rd: 4, spd: 3 },
      { comp: 6, rd: 5, rec: 3 },
      { comp: 7, rd: 6, sta: 4 }
    ],
    coreReward: 'ps',
    coreRewards: [1, 1, 1, 1, 2]
  },
  {
    id: 'ironman',
    icon: '💪',
    name: 'ปอดเหล็กความฟิต & วินัยสนาม',
    desc: 'ลงสนามแข่งขันและรักษาวินัยฝึกซ้อมอย่างสม่ำเสมอ',
    metric: 'matches',
    unit: 'นัด',
    targets: [5, 12, 24, 40, 62],
    subRewards: [
      { sta: 4, tol: 3, rec: 3 },
      { sta: 4, tol: 4, rec: 3, comp: 2 },
      { sta: 5, tol: 4, rec: 4, comp: 2 },
      { sta: 6, tol: 5, rec: 4, str: 3 },
      { sta: 7, tol: 6, rec: 5, comp: 3 }
    ],
    coreReward: 'ph',
    coreRewards: [1, 1, 1, 1, 2]
  }
];

export const ensurePlayerMissions = (q: Player, careerP?: PlayerCareerProfile | null): PlayerMissionsState => {
  const src = (q.me && careerP?.missions) || q.missions;
  const normalized: PlayerMissionsState = {
    stats: { ...(src?.stats || {}) },
    claimed: { ...(src?.claimed || {}) },
    outcomes: src?.outcomes ? { ...src.outcomes } : {},
    recentLogs: src?.recentLogs ? [...src.recentLogs] : [],
    focusId: src?.focusId
  };
  if (!normalized.focusId) {
    normalized.focusId = q.pos === 'GK' ? 'goalkeeper' : q.pos === 'DF' ? 'defender' : q.pos === 'FW' ? 'finishing' : 'passing';
  }
  return normalized;
};

export function calcMissionSuccessChance(
  q: Player,
  careerP: PlayerCareerProfile | null | undefined,
  def: PersonalMissionDef,
  stage: number,
  state?: Pick<GameState, 'tr' | 'staff'> | null
): number {
  const talent = getPlayerTalent(q, careerP);
  const mState = ensurePlayerMissions(q, careerP);
  const isFocused = mState.focusId === def.id;
  const isProdigy = Boolean(q.me && careerP?.perks?.includes('prodigy'));
  const age = q.age || 24;
  const pot = q.pot || q.ov;

  // Base success probability scales strongly with talent (25-99)
  // Stage difficulty increases each tier (0..4)
  let chance = 26 + talent * 0.62 - stage * 7.5;
  if (age <= 21) chance += 5;
  else if (age >= 30) chance -= (age - 29) * 3.5;

  // Reaching or exceeding potential makes breakthroughs harder (requires higher talent)
  if (q.ov >= pot) chance -= 10;
  else if (pot - q.ov >= 15) chance += 4;

  if (isFocused) chance += 6;
  if (isProdigy) chance += 8;
  if (state?.tr) chance += (state.tr - 1) * 1.5;
  if (state?.staff?.asst) chance += state.staff.asst * 1.5;

  // Never 100% guaranteed and never 0% impossible
  return clamp(Math.round(chance), 15, 94);
}

export const getPlayerMissionView = (
  q: Player,
  careerP?: PlayerCareerProfile | null,
  state?: Pick<GameState, 'tr' | 'staff'> | null
) => {
  const mState = ensurePlayerMissions(q, careerP);
  const talent = getPlayerTalent(q, careerP);
  const items = PERSONAL_MISSIONS.filter((m) => !m.posFilter || m.posFilter.includes(q.pos)).map((def) => {
    const stage = clamp(mState.claimed[def.id] || 0, 0, def.targets.length);
    const completedAll = stage >= def.targets.length;
    const target = def.targets[Math.min(stage, def.targets.length - 1)];
    const curVal = mState.stats[def.metric] || 0;
    const pct = completedAll ? 100 : clamp(Math.round((curVal / Math.max(1, target)) * 100), 0, 100);
    const canClaim = !completedAll && curVal >= target;
    const nextRewards = def.subRewards[Math.min(stage, def.subRewards.length - 1)];
    const nextCoreAmt = def.coreRewards?.[Math.min(stage, (def.coreRewards?.length || 1) - 1)] ?? 1;
    const successChance = completedAll ? 0 : calcMissionSuccessChance(q, careerP, def, stage, state);
    const stageOutcomes: MissionStageOutcome[] = mState.outcomes?.[def.id] || [];
    return {
      def,
      stage,
      maxStage: def.targets.length,
      completedAll,
      target,
      curVal,
      pct,
      canClaim,
      isFocused: mState.focusId === def.id,
      nextRewards,
      nextCoreAmt,
      successChance,
      stageOutcomes
    };
  });
  const passedStages = items.reduce((sum, x) => {
    if (x.stageOutcomes.length) return sum + x.stageOutcomes.filter((o) => o === 'ok').length;
    return sum + x.stage;
  }, 0);
  const failedStages = items.reduce((sum, x) => sum + x.stageOutcomes.filter((o) => o === 'fail').length, 0);
  return { mState, items, talent, passedStages, failedStages };
};

export const countReadyMissions = (q: Player, careerP?: PlayerCareerProfile | null): number =>
  getPlayerMissionView(q, careerP).items.filter((x) => x.canClaim).length;

export const formatMissionRewardText = (
  subRewards: Record<string, number>,
  coreReward: StatKey,
  coreAmt = 1
) => {
  const subTxt = Object.entries(subRewards)
    .map(([k, v]) => `${SIGL[k] || k} +${v}`)
    .join(' · ');
  const coreLbl = ATT.find((x) => x[0] === coreReward)?.[1] || coreReward;
  return `${subTxt} · ${coreLbl} +${coreAmt}`;
};

const applyStageRewardToPlayer = (
  q: Player,
  careerP: PlayerCareerProfile | null,
  def: PersonalMissionDef,
  stage: number,
  s?: GameState | null
) => {
  const rewards = def.subRewards[Math.min(stage, def.subRewards.length - 1)];
  const coreAmt = def.coreRewards?.[Math.min(stage, (def.coreRewards?.length || 1) - 1)] ?? 1;

  q.sb = { ...(q.sb || {}) };
  Object.entries(rewards).forEach(([sk, delta]) => {
    q.sb![sk] = (q.sb![sk] || 0) + delta;
    if (q.customD && q.customD[sk] != null) {
      q.customD[sk] = clamp(q.customD[sk] + delta, 1, 99);
    }
  });

  if (careerP) {
    careerP.sb = { ...(careerP.sb || {}) };
    Object.entries(rewards).forEach(([sk, delta]) => {
      careerP.sb![sk] = (careerP.sb![sk] || 0) + delta;
      if (careerP.customD && careerP.customD[sk] != null) {
        careerP.customD[sk] = clamp(careerP.customD[sk] + delta, 1, 99);
      }
    });
    careerP.a[def.coreReward] = clamp(careerP.a[def.coreReward] + coreAmt, 1, 99);
    careerP.rep = (careerP.rep || 10) + (stage >= 3 ? 3 : 2);
    q.ov = ovMe(careerP);
    if (q.blessed && q.customA) q.customA = { ...careerP.a };
    if (s) syncMe(s);
  } else {
    q.coreSb = { ...(q.coreSb || {}) };
    q.coreSb[def.coreReward] = (q.coreSb[def.coreReward] || 0) + coreAmt;
    if (q.customA) {
      q.customA[def.coreReward] = clamp(q.customA[def.coreReward] + coreAmt, 1, 99);
    }
    const afterDt = DT(q, null);
    const calcOv = clamp(OVF(q.pos, afterDt.a), 1, 99);
    if (calcOv > q.ov) {
      q.ov = calcOv;
    } else if ((stage === 1 || stage === 4) && q.ov < 99) {
      q.ov = clamp(q.ov + 1, 1, 99);
    }
    if (q.ov > (q.pot || q.ov)) q.pot = q.ov;
  }

  return formatMissionRewardText(rewards, def.coreReward, coreAmt);
};

export interface MissionResolveSummary {
  upgraded: { player: string; mission: string; icon: string; stage: number; maxStage: number; rewardText: string; chance: number }[];
  failed: { player: string; mission: string; icon: string; stage: number; maxStage: number; chance: number }[];
}

export const resolvePlayerMissions = (
  q: Player,
  careerP?: PlayerCareerProfile | null,
  s?: GameState | null
): MissionResolveSummary => {
  const summary: MissionResolveSummary = { upgraded: [], failed: [] };
  const mState = ensurePlayerMissions(q, careerP);
  const outcomes = { ...(mState.outcomes || {}) };
  const recentLogs = [...(mState.recentLogs || [])];
  let changed = false;

  PERSONAL_MISSIONS.forEach((def) => {
    if (def.posFilter && !def.posFilter.includes(q.pos)) return;
    let stage = clamp(mState.claimed[def.id] || 0, 0, def.targets.length);
    const curVal = mState.stats[def.metric] || 0;

    while (stage < def.targets.length && curVal >= def.targets[stage]) {
      changed = true;
      const chance = calcMissionSuccessChance(q, careerP, def, stage, s);
      const success = Math.random() * 100 < chance;
      const arr: MissionStageOutcome[] = outcomes[def.id] ? [...outcomes[def.id]] : Array(stage).fill('ok');
      arr[stage] = success ? 'ok' : 'fail';
      outcomes[def.id] = arr;
      mState.claimed[def.id] = stage + 1;

      if (success) {
        const rewardText = applyStageRewardToPlayer(q, careerP || null, def, stage, s);
        summary.upgraded.push({
          player: q.n,
          mission: def.name,
          icon: def.icon,
          stage: stage + 1,
          maxStage: def.targets.length,
          rewardText,
          chance
        });
        recentLogs.unshift({
          missionId: def.id,
          missionName: def.name,
          icon: def.icon,
          stage: stage + 1,
          success: true,
          chance,
          rewardText,
          md: s ? (s.md ?? 0) + 1 : undefined
        });
      } else {
        summary.failed.push({
          player: q.n,
          mission: def.name,
          icon: def.icon,
          stage: stage + 1,
          maxStage: def.targets.length,
          chance
        });
        recentLogs.unshift({
          missionId: def.id,
          missionName: def.name,
          icon: def.icon,
          stage: stage + 1,
          success: false,
          chance,
          md: s ? (s.md ?? 0) + 1 : undefined
        });
      }
      stage++;
    }
  });

  if (changed) {
    mState.outcomes = outcomes;
    mState.recentLogs = recentLogs.slice(0, 18);
    q.missions = mState;
    if (careerP) careerP.missions = mState;
  }
  return summary;
};

export const claimPlayerMission = (
  s: GameState,
  playerName: string,
  missionId: string,
  teamId?: number | null
): { ok: boolean; msg: string } => {
  const def = PERSONAL_MISSIONS.find((m) => m.id === missionId);
  if (!def) return { ok: false, msg: 'ไม่พบภารกิจ' };

  const targetTeam = teamId != null ? s.teams[teamId] : s.teams[s.me];
  const q = targetTeam?.sq.find((x) => x.n === playerName);
  if (!q) return { ok: false, msg: 'ไม่พบข้อมูลนักเตะ' };

  const isMe = !!q.me || (s.mode === 'p' && s.p?.name === q.n);
  const careerP = isMe && s.p ? s.p : null;
  const mState = ensurePlayerMissions(q, careerP);
  const stage = clamp(mState.claimed[def.id] || 0, 0, def.targets.length);
  if (stage >= def.targets.length) return { ok: false, msg: 'ภารกิจนี้ประเมินครบทุกขั้นแล้ว' };
  const target = def.targets[stage];
  const curVal = mState.stats[def.metric] || 0;
  if (curVal < target) return { ok: false, msg: `ยังทำไม่ครบ (${curVal}/${target} ${def.unit})` };

  const chance = calcMissionSuccessChance(q, careerP, def, stage, s);
  const success = Math.random() * 100 < chance;
  const outcomes = { ...(mState.outcomes || {}) };
  const arr: MissionStageOutcome[] = outcomes[def.id] ? [...outcomes[def.id]] : Array(stage).fill('ok');
  arr[stage] = success ? 'ok' : 'fail';
  outcomes[def.id] = arr;
  mState.claimed[def.id] = stage + 1;

  const recentLogs = [...(mState.recentLogs || [])];
  let msg: string;
  if (success) {
    const rewardStr = applyStageRewardToPlayer(q, careerP, def, stage, s);
    recentLogs.unshift({
      missionId: def.id,
      missionName: def.name,
      icon: def.icon,
      stage: stage + 1,
      success: true,
      chance,
      rewardText: rewardStr,
      md: (s.md ?? 0) + 1
    });
    msg = `${def.icon} ${q.n} ผ่าน "${def.name} (ขั้น ${stage + 1}/${def.targets.length})"! (โอกาส ${chance}%) · ${rewardStr}`;
  } else {
    recentLogs.unshift({
      missionId: def.id,
      missionName: def.name,
      icon: def.icon,
      stage: stage + 1,
      success: false,
      chance,
      md: (s.md ?? 0) + 1
    });
    msg = `💨 ${q.n} พลาดการอัพพลัง "${def.name} (ขั้น ${stage + 1}/${def.targets.length})" (โอกาสติด ${chance}%)`;
  }

  mState.outcomes = outcomes;
  mState.recentLogs = recentLogs.slice(0, 18);
  q.missions = mState;
  if (careerP) careerP.missions = mState;
  return { ok: success, msg };
};

export const addMissionStat = (
  q: Player,
  metric: PersonalMissionMetric,
  rawDelta: number,
  careerP?: PlayerCareerProfile | null
) => {
  if (rawDelta <= 0) return;
  const mState = ensurePlayerMissions(q, careerP);
  const focusedDef = PERSONAL_MISSIONS.find((m) => m.id === mState.focusId);
  const isFocusedMetric = focusedDef?.metric === metric;
  const delta = isFocusedMetric ? Math.max(rawDelta + 1, Math.round(rawDelta * 1.4)) : rawDelta;
  mState.stats[metric] = (mState.stats[metric] || 0) + delta;
  q.missions = mState;
  if (careerP) careerP.missions = mState;
};

export const applyTrainingMissionProgress = (
  q: Player,
  opts: {
    teamProgram?: TrainingProgramId;
    isTeamFocus?: boolean;
    careerPlan?: number;
    careerP?: PlayerCareerProfile | null;
    state?: GameState | null;
  }
): { notes: string[]; summary: MissionResolveSummary } => {
  const notes: string[] = [];
  const mState = ensurePlayerMissions(q, opts.careerP);
  const focusDef = PERSONAL_MISSIONS.find((m) => m.id === mState.focusId);
  const mult = opts.isTeamFocus ? 2 : 1;

  // Simultaneous multi-mission progress from training drills
  const addSimultaneous = (metric: PersonalMissionMetric, base: number, label?: string) => {
    if (base <= 0) return;
    const bonus = focusDef?.metric === metric ? Math.max(1, Math.round(base * 0.4)) : 0;
    const total = (base + bonus) * mult;
    mState.stats[metric] = (mState.stats[metric] || 0) + total;
    if (label && bonus > 0) notes.push(`${label} +${total}`);
  };

  if (q.pos === 'GK') {
    addSimultaneous('saves', opts.teamProgram === 'defense' ? 3 : 1);
    addSimultaneous('passes', opts.teamProgram === 'tactics' ? 10 : 4);
  } else {
    // Baseline simultaneous training drills for outfielders
    addSimultaneous('passes', opts.teamProgram === 'tactics' ? 14 : 6);
    addSimultaneous('dribbles', opts.teamProgram === 'fitness' || opts.teamProgram === 'setpiece' ? 3 : 1);

    if (q.pos === 'FW' || q.pos === 'MF') {
      const attMult = opts.teamProgram === 'attack' ? 2 : 1;
      addSimultaneous('shots', 2 * attMult);
      addSimultaneous('onTarget', 1 * attMult);
      addSimultaneous('crossAssists', 1 * attMult);
      addSimultaneous('setpieces', opts.teamProgram === 'attack' || focusDef?.id === 'setpiece' ? 1 : 0);
    }
    if (q.pos === 'DF' || q.pos === 'MF') {
      const defMult = opts.teamProgram === 'defense' ? 2 : 1;
      addSimultaneous('tackles', 2 * defMult);
      addSimultaneous('blocks', opts.teamProgram === 'defense' ? 1 : 0);
      addSimultaneous('headers', 1 * defMult);
    } else if (q.pos === 'FW') {
      addSimultaneous('headers', 1);
    }
  }

  // Extra focus drill boost
  if (focusDef) {
    const drillAmt: Record<PersonalMissionMetric, number> = {
      setpieces: 1,
      passes: 8,
      shots: 2,
      onTarget: 1,
      goals: 0,
      crossAssists: 2,
      dribbles: 3,
      tackles: 2,
      blocks: 1,
      headers: 2,
      saves: 2,
      cleanSheets: 0,
      wins: 0,
      highRatings: 0,
      matches: 0
    };
    const addAmt = (drillAmt[focusDef.metric] || 0) * mult;
    if (addAmt > 0) {
      mState.stats[focusDef.metric] = (mState.stats[focusDef.metric] || 0) + addAmt;
      notes.unshift(`${focusDef.name} +${addAmt}`);
    }
  }

  // Career personal weekly plan drills
  if (opts.careerPlan === 0 && q.pos !== 'GK') {
    addSimultaneous('shots', 2);
    addSimultaneous('onTarget', 1);
  } else if (opts.careerPlan === 1) {
    addSimultaneous('passes', 10);
    addSimultaneous('dribbles', 2);
  } else if (opts.careerPlan === 4 && q.pos !== 'GK') {
    addSimultaneous('setpieces', 1);
    addSimultaneous('crossAssists', 1);
  }

  q.missions = mState;
  if (opts.careerP) opts.careerP.missions = mState;
  const summary = resolvePlayerMissions(q, opts.careerP || null, opts.state || null);
  return { notes, summary };
};

export const applyMatchMissionProgress = (
  s: GameState,
  H: Team,
  A: Team,
  payload: FinishedMatchPayload
): MissionResolveSummary => {
  const combined: MissionResolveSummary = { upgraded: [], failed: [] };
  const meTeam = s.teams[s.me];
  if (!meTeam) return combined;

  const isHomeMe = H.id === meTeam.id;
  const myGoals = isHomeMe ? payload.gh : payload.ga;
  const oppGoals = isHomeMe ? payload.ga : payload.gh;
  const isWin = myGoals > oppGoals || Boolean(payload.pen && ((isHomeMe && payload.pen) || (!isHomeMe && !payload.pen)));
  const isCleanSheet = oppGoals === 0;

  const playedList = new Set(payload.playedNames?.[meTeam.id] || xi(meTeam).map((q) => q.n));
  const actionsMap = payload.playerActions || {};

  meTeam.sq.forEach((q) => {
    const careerP = q.me && s.p ? s.p : null;
    if (q.me && payload.pf && payload.pf.played === false) return;
    if (!playedList.has(q.n) && !actionsMap[q.n]) return;

    // Accumulate all eligible match milestones simultaneously
    addMissionStat(q, 'matches', 1, careerP);
    if (isWin) addMissionStat(q, 'wins', 1, careerP);
    if (isCleanSheet && (q.pos === 'GK' || q.pos === 'DF')) {
      addMissionStat(q, 'cleanSheets', 1, careerP);
    }

    const rt = q.me && payload.pf?.rt ? payload.pf.rt : payload.ratings?.[q.n] || 0;
    if (rt >= 7.2) addMissionStat(q, 'highRatings', 1, careerP);

    const goals = payload.evs.filter((e) => e.t === meTeam.id && e.who === q.n).length;
    const assists = payload.evs.filter((e) => e.t === meTeam.id && e.as === q.n).length;
    if (goals > 0) addMissionStat(q, 'goals', goals, careerP);

    const acts = actionsMap[q.n];
    if (acts) {
      (Object.entries(acts) as [PersonalMissionMetric, number][]).forEach(([metric, val]) => {
        if (val > 0 && metric !== 'matches' && metric !== 'wins' && metric !== 'cleanSheets' && metric !== 'highRatings' && metric !== 'goals') {
          addMissionStat(q, metric, val, careerP);
        }
      });
    } else {
      // Estimation fallback for instant-simmed matches
      if (q.pos === 'GK') {
        addMissionStat(q, 'saves', R(2, 5), careerP);
        addMissionStat(q, 'passes', R(10, 18), careerP);
      } else {
        addMissionStat(q, 'passes', q.pos === 'MF' ? R(18, 32) : R(10, 22), careerP);
        addMissionStat(q, 'dribbles', q.pos === 'FW' || q.pos === 'MF' ? R(2, 5) : R(0, 2), careerP);
        if (q.pos === 'FW' || q.pos === 'MF') {
          const sh = Math.max(goals * 2 + (q.pos === 'FW' ? R(1, 3) : R(0, 2)), 0);
          if (sh > 0) {
            addMissionStat(q, 'shots', sh, careerP);
            addMissionStat(q, 'onTarget', Math.max(goals, Math.round(sh * 0.5)), careerP);
          }
        }
        if (assists > 0) addMissionStat(q, 'crossAssists', assists * 2 + 1, careerP);
        else if (q.pos === 'MF' || q.pos === 'DF') addMissionStat(q, 'crossAssists', R(0, 2), careerP);
        if (q.pos === 'DF' || q.pos === 'MF') {
          addMissionStat(q, 'tackles', R(2, 5), careerP);
          addMissionStat(q, 'blocks', R(0, 2), careerP);
        }
        addMissionStat(q, 'headers', R(0, 3), careerP);
      }
    }

    const res = resolvePlayerMissions(q, careerP, s);
    combined.upgraded.push(...res.upgraded);
    combined.failed.push(...res.failed);
  });

  void A;
  if (s.mode === 'p' && s.p) syncMe(s);
  return combined;
};
