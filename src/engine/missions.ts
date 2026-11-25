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
import { OVF, xi, DT, ovMe, syncMe, recordPlayerSeasonProgress, getOvGrowthScale } from './playerCore';

export const ovColor = (v: number): string => {
  if (v >= 100) return '#db2777';
  if (v >= 90) return '#d97706';
  if (v >= 80) return '#7c3aed';
  if (v >= 70) return '#059669';
  if (v >= 60) return '#0d9488';
  if (v >= 50) return '#0284c7';
  if (v >= 40) return '#475569';
  return '#64748b';
};

export const statBarColor = (v: number): string => {
  if (v >= 100) return '#ec4899';
  if (v >= 90) return '#f59e0b';
  if (v >= 80) return '#8b5cf6';
  if (v >= 70) return '#10b981';
  if (v >= 60) return '#14b8a6';
  if (v >= 50) return '#0ea5e9';
  if (v >= 40) return '#64748b';
  return '#94a3b8';
};

export interface StatTierMeta {
  textClass: string;
  darkTextClass: string;
  badgeClass: string;
  dotClass: string;
  hex: string;
}

export function statTierMeta(v: number): StatTierMeta {
  const hex = statBarColor(v);
  if (v >= 100) {
    return {
      textClass: 'text-pink-600 dark:text-pink-300',
      darkTextClass: 'text-pink-300',
      badgeClass: 'bg-pink-500/14 border-pink-500/35 text-pink-700 dark:text-pink-200',
      dotClass: 'bg-pink-500',
      hex
    };
  }
  if (v >= 90) {
    return {
      textClass: 'text-amber-700 dark:text-amber-300',
      darkTextClass: 'text-amber-300',
      badgeClass: 'bg-amber-500/14 border-amber-500/35 text-amber-800 dark:text-amber-200',
      dotClass: 'bg-amber-500',
      hex
    };
  }
  if (v >= 80) {
    return {
      textClass: 'text-violet-700 dark:text-violet-300',
      darkTextClass: 'text-violet-300',
      badgeClass: 'bg-violet-500/14 border-violet-500/35 text-violet-800 dark:text-violet-200',
      dotClass: 'bg-violet-500',
      hex
    };
  }
  if (v >= 70) {
    return {
      textClass: 'text-emerald-700 dark:text-emerald-300',
      darkTextClass: 'text-emerald-300',
      badgeClass: 'bg-emerald-500/14 border-emerald-500/35 text-emerald-800 dark:text-emerald-200',
      dotClass: 'bg-emerald-500',
      hex
    };
  }
  if (v >= 60) {
    return {
      textClass: 'text-teal-700 dark:text-teal-300',
      darkTextClass: 'text-teal-300',
      badgeClass: 'bg-teal-500/14 border-teal-500/35 text-teal-800 dark:text-teal-200',
      dotClass: 'bg-teal-500',
      hex
    };
  }
  if (v >= 50) {
    return {
      textClass: 'text-sky-700 dark:text-sky-300',
      darkTextClass: 'text-sky-300',
      badgeClass: 'bg-sky-500/14 border-sky-500/35 text-sky-800 dark:text-sky-200',
      dotClass: 'bg-sky-500',
      hex
    };
  }
  if (v >= 40) {
    return {
      textClass: 'text-slate-600 dark:text-slate-300',
      darkTextClass: 'text-slate-300',
      badgeClass: 'bg-slate-600/18 border-slate-500/42 text-slate-700 dark:text-slate-200',
      dotClass: 'bg-slate-500',
      hex
    };
  }
  return {
    textClass: 'text-slate-500 dark:text-slate-400',
    darkTextClass: 'text-slate-400',
    badgeClass: 'bg-slate-400/12 border-slate-400/30 text-slate-600 dark:text-slate-300',
    dotClass: 'bg-slate-400',
    hex
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
    targets: [6, 16, 34, 60, 96],
    subRewards: [
      { fk: 2, cur: 1 },
      { fk: 2, cur: 2 },
      { fk: 3, cur: 2, comp: 1 },
      { fk: 3, cur: 2, comp: 2 },
      { fk: 4, cur: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'passing',
    icon: '📐',
    name: 'จอมทัพส่งบอลแม่นยำ',
    desc: 'จ่ายบอลสำเร็จในสนามแข่งขันอย่างต่อเนื่องเพื่อปลดล็อกวิสัยทัศน์เกม',
    metric: 'passes',
    unit: 'ครั้ง',
    targets: [120, 360, 780, 1450, 2400],
    subRewards: [
      { spass: 2, lpass: 1, rd: 1 },
      { spass: 2, lpass: 2, crs: 1, rd: 1 },
      { spass: 2, lpass: 2, crs: 2, rd: 2 },
      { spass: 3, lpass: 2, crs: 2, rd: 2 },
      { spass: 3, lpass: 3, crs: 2, rd: 2, comp: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 1, 1, 1, 1]
  },
  {
    id: 'finishing',
    icon: '🔥',
    name: 'เพชฌฆาตสับไก',
    desc: 'หาจังหวะยิงประตูและลุ้นจบสกอร์ในเกมจริงอย่างต่อเนื่อง',
    metric: 'shots',
    unit: 'ครั้ง',
    targets: [18, 48, 100, 180, 290],
    subRewards: [
      { fin: 2, pw: 2, run: 1 },
      { fin: 2, pw: 2, cur: 1 },
      { fin: 3, pw: 2, comp: 1 },
      { fin: 3, pw: 2, run: 2 },
      { fin: 4, pw: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'sharpshooter',
    icon: '🏹',
    name: 'ยิงตรงกรอบเฉียบคม',
    desc: 'ส่งบอลพุ่งตรงกรอบบังคับผู้รักษาประตูต้องออกแรงเซฟ',
    metric: 'onTarget',
    unit: 'ครั้ง',
    targets: [9, 25, 52, 95, 155],
    subRewards: [
      { fin: 2, cur: 2 },
      { fin: 2, cur: 2, pw: 1 },
      { fin: 3, cur: 2, comp: 1 },
      { fin: 3, cur: 2, run: 2 },
      { fin: 4, cur: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'goalscorer',
    icon: '⚽',
    name: 'เครื่องจักรถล่มประตู',
    desc: 'ยิงประตูสำคัญพาทีมไล่ล่าแต้มในเกมจริง',
    metric: 'goals',
    unit: 'ประตู',
    targets: [4, 12, 26, 48, 80],
    subRewards: [
      { fin: 2, run: 2, comp: 1 },
      { fin: 2, run: 2, comp: 1 },
      { fin: 3, pw: 2, comp: 2 },
      { fin: 3, run: 2, comp: 2 },
      { fin: 4, pw: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'playmaker',
    icon: '🎁',
    name: 'จอมเปิดบอล & แอสซิสต์',
    desc: 'เปิดบอลเข้ากรอบ แทงทะลุช่อง หรือจ่ายให้เพื่อนยิงประตู',
    metric: 'crossAssists',
    unit: 'ครั้ง',
    targets: [14, 38, 80, 145, 230],
    subRewards: [
      { crs: 2, cur: 2, run: 1 },
      { crs: 2, cur: 2, fk: 1 },
      { crs: 3, cur: 2, run: 2 },
      { crs: 3, cur: 2, rd: 2 },
      { crs: 4, cur: 3, run: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'dribbler',
    icon: '⚡',
    name: 'สปีด & เลี้ยงกินตัว',
    desc: 'พาบอลแหวกแนวรับหรือโชว์สกิลเลี้ยงหลบคู่แข่งในเกม',
    metric: 'dribbles',
    unit: 'ครั้ง',
    targets: [28, 75, 160, 290, 460],
    subRewards: [
      { spd: 2, run: 2, cur: 1 },
      { spd: 2, run: 2, str: 1 },
      { spd: 3, run: 2, cur: 2 },
      { spd: 3, run: 3, str: 2 },
      { spd: 4, run: 3, cur: 2 }
    ],
    coreReward: 'dr',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'defender',
    icon: '🛡️',
    name: 'ปราการเหล็กเข้าสกัด',
    desc: 'เข้าสกัดแย่งบอลและดักตัดทางบอลคู่แข่งอย่างแม่นยำ',
    metric: 'tackles',
    unit: 'ครั้ง',
    targets: [22, 60, 125, 225, 360],
    subRewards: [
      { tkl: 2, mrk: 2, rd: 1 },
      { tkl: 2, mrk: 2, rd: 2 },
      { tkl: 3, mrk: 2, blk: 2, comp: 1 },
      { tkl: 3, mrk: 3, rd: 2 },
      { tkl: 4, mrk: 3, comp: 2 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['DF', 'MF']
  },
  {
    id: 'shotblocker',
    icon: '🧱',
    name: 'กำแพงบล็อกลูกยิง',
    desc: 'อ่านจังหวะพุ่งบล็อกลูกยิงอันตรายช่วยแนวรับและผู้รักษาประตู',
    metric: 'blocks',
    unit: 'ครั้ง',
    targets: [8, 22, 46, 82, 130],
    subRewards: [
      { blk: 2, pos: 2, tol: 1 },
      { blk: 2, pos: 2, str: 1 },
      { blk: 3, mrk: 2, tol: 2 },
      { blk: 3, pos: 2, comp: 2 },
      { blk: 4, mrk: 3, str: 2 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['DF', 'MF']
  },
  {
    id: 'aerial',
    icon: '🗣️',
    name: 'จ้าวเวหาลูกโหม่ง',
    desc: 'ดวลลูกกลางอากาศและเทกตัวโหม่งทั้งเกมรุกและเกมรับ',
    metric: 'headers',
    unit: 'ครั้ง',
    targets: [14, 36, 75, 135, 215],
    subRewards: [
      { hd: 2, str: 2 },
      { hd: 2, str: 2, pos: 1 },
      { hd: 3, str: 2, comp: 1 },
      { hd: 3, str: 3, pos: 2 },
      { hd: 4, str: 3, comp: 2 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'goalkeeper',
    icon: '🧤',
    name: 'มือกาวจอมเซฟ',
    desc: 'เซฟลูกยิงตรงกรอบและออกมาชก/คว้าบอลกลางอากาศ',
    metric: 'saves',
    unit: 'ครั้ง',
    targets: [20, 52, 110, 195, 310],
    subRewards: [
      { sv: 2, cl: 2, dist: 1 },
      { sv: 2, cl: 2, comp: 1 },
      { sv: 3, cl: 2, dist: 2 },
      { sv: 3, cl: 3, comp: 2 },
      { sv: 4, cl: 3, dist: 2 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['GK']
  },
  {
    id: 'gk_clean',
    icon: '🔒',
    name: 'เสาหลักเก็บคลีนชีต',
    desc: 'คุมแนวรับให้ทีมไม่เสียประตูจนจบเกม',
    metric: 'cleanSheets',
    unit: 'นัด',
    targets: [3, 8, 17, 30, 46],
    subRewards: [
      { pos: 2, comp: 2, rec: 1 },
      { mrk: 2, comp: 2, sv: 2 },
      { cl: 2, pos: 2, comp: 2 },
      { sv: 3, mrk: 3, comp: 2 },
      { pos: 3, cl: 3, comp: 3 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 1, 1, 1, 1],
    posFilter: ['GK', 'DF']
  },
  {
    id: 'winner',
    icon: '🏆',
    name: 'จิตวิญญาณผู้ชนะ',
    desc: 'มีส่วนร่วมพาทีมคว้าชัยชนะในเกมการแข่งขันจริง',
    metric: 'wins',
    unit: 'นัด',
    targets: [6, 15, 30, 52, 82],
    subRewards: [
      { comp: 2, sta: 2, rd: 1 },
      { comp: 2, str: 2, run: 2 },
      { comp: 3, sta: 2, rd: 2 },
      { comp: 3, tol: 2, rec: 2 },
      { comp: 4, sta: 3, rec: 3 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 1, 1, 1, 1]
  },
  {
    id: 'mvp_form',
    icon: '⭐',
    name: 'ฟอร์มเทพสม่ำเสมอ',
    desc: 'โชว์ฟอร์มเด่นคว้าเรตติ้งหลังเกม 7.2 ขึ้นไปอย่างต่อเนื่อง',
    metric: 'highRatings',
    unit: 'นัด',
    targets: [4, 11, 24, 44, 72],
    subRewards: [
      { comp: 2, rd: 2, cur: 1 },
      { comp: 2, rd: 2, fin: 2 },
      { comp: 3, rd: 2, spd: 2 },
      { comp: 3, rd: 3, rec: 2 },
      { comp: 4, rd: 3, sta: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 1, 1, 1, 1]
  },
  {
    id: 'ironman',
    icon: '💪',
    name: 'ปอดเหล็กความฟิต & วินัยสนาม',
    desc: 'ลงสนามแข่งขันและรักษาวินัยฝึกซ้อมอย่างสม่ำเสมอ',
    metric: 'matches',
    unit: 'นัด',
    targets: [8, 20, 42, 74, 118],
    subRewards: [
      { sta: 2, tol: 2, rec: 2 },
      { sta: 2, tol: 2, rec: 2, comp: 1 },
      { sta: 3, tol: 2, rec: 2, comp: 1 },
      { sta: 3, tol: 3, rec: 2, str: 2 },
      { sta: 4, tol: 3, rec: 3, comp: 2 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 1, 1, 1, 1]
  }
];

export const ensurePlayerMissions = (q: Player, careerP?: PlayerCareerProfile | null): PlayerMissionsState => {
  const src = (q.me && careerP?.missions) || q.missions;
  return {
    stats: { ...(src?.stats || {}) },
    claimed: { ...(src?.claimed || {}) },
    outcomes: src?.outcomes ? { ...src.outcomes } : {},
    recentLogs: src?.recentLogs ? [...src.recentLogs] : []
  };
};

export function calcMissionSuccessChance(
  q: Player,
  careerP: PlayerCareerProfile | null | undefined,
  _def: PersonalMissionDef,
  stage: number,
  state?: Pick<GameState, 'tr' | 'staff' | 'analyticsLv'> | null
): number {
  const talent = getPlayerTalent(q, careerP);
  const isProdigy = Boolean(q.me && careerP?.perks?.includes('prodigy'));
  const age = q.age || 24;
  const curOv = q.me && careerP ? ovMe(careerP) : (q.ov || 65);
  const pot = q.pot || curOv;

  // Base success probability scales with talent (25-99) and diminishes at higher OVR
  let chance = 26 + talent * 0.56 - stage * 7.5;
  if (age <= 21) chance += 4;
  else if (age >= 30) chance -= (age - 29) * 3.5;

  // Diminishing returns for elite ratings so OVR doesn't cap early
  if (curOv >= 76) {
    chance -= Math.max(0, curOv - 76) * 1.45;
  }

  // Reaching or exceeding potential makes breakthroughs harder (requires higher talent)
  if (curOv >= pot) chance -= 12;
  else if (pot - curOv >= 15) chance += 3;

  if (isProdigy) chance += 6;
  if (state?.tr) chance += (state.tr - 1) * 0.65;
  if (state?.staff?.asst) chance += state.staff.asst * 0.75;
  if (state?.analyticsLv && state.analyticsLv > 1) chance += (state.analyticsLv - 1) * 0.5;

  // Never 100% guaranteed and never 0% impossible
  return clamp(Math.round(chance), 12, 86);
}

export const getPlayerMissionView = (
  q: Player,
  careerP?: PlayerCareerProfile | null,
  state?: Pick<GameState, 'tr' | 'staff' | 'analyticsLv'> | null
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
  if (coreAmt <= 0) return subTxt;
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
  const curOv = careerP ? ovMe(careerP) : q.ov;
  const ovScale = getOvGrowthScale(curOv, q.pot);

  q.sb = { ...(q.sb || {}) };
  Object.entries(rewards).forEach(([sk, delta]) => {
    const scaledDelta = curOv >= 88 ? Math.max(1, Math.round(delta * 0.65)) : delta;
    q.sb![sk] = (q.sb![sk] || 0) + scaledDelta;
    if (q.customD && q.customD[sk] != null) {
      q.customD[sk] = clamp(q.customD[sk] + scaledDelta, 1, 99);
    }
  });

  if (careerP) {
    careerP.sb = { ...(careerP.sb || {}) };
    Object.entries(rewards).forEach(([sk, delta]) => {
      const scaledDelta = curOv >= 88 ? Math.max(1, Math.round(delta * 0.65)) : delta;
      careerP.sb![sk] = (careerP.sb![sk] || 0) + scaledDelta;
      if (careerP.customD && careerP.customD[sk] != null) {
        careerP.customD[sk] = clamp(careerP.customD[sk] + scaledDelta, 1, 99);
      }
    });
    if (coreAmt > 0 && (careerP.a[def.coreReward] < 86 || Math.random() < 0.35 + ovScale * 0.8)) {
      careerP.a[def.coreReward] = clamp(careerP.a[def.coreReward] + coreAmt, 1, 99);
    }
    careerP.rep = (careerP.rep || 10) + (stage >= 3 ? 3 : 2);
    q.ov = ovMe(careerP);
    if (q.blessed && q.customA) q.customA = { ...careerP.a };
    if (s) syncMe(s);
  } else {
    if (coreAmt > 0) {
      q.coreSb = { ...(q.coreSb || {}) };
      q.coreSb[def.coreReward] = (q.coreSb[def.coreReward] || 0) + coreAmt;
      if (q.customA) {
        q.customA[def.coreReward] = clamp(q.customA[def.coreReward] + coreAmt, 1, 99);
      }
    }
    const afterDt = DT(q, null);
    const calcOv = clamp(OVF(q.pos, afterDt.a), 1, 99);
    const potCap = stage >= 3 ? 98 : (q.pot || 86);
    if (calcOv > q.ov && (q.ov < potCap || stage >= 3)) {
      q.ov = clamp(calcOv, 1, stage >= 3 ? 98 : potCap);
    }
    if (stage >= 3 && q.ov > (q.pot || q.ov)) q.pot = q.ov;
  }
  if (s) {
    recordPlayerSeasonProgress(q, s.season ?? 1, s.md ?? 0, careerP);
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
  mState.stats[metric] = (mState.stats[metric] || 0) + rawDelta;
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
  const mult = opts.isTeamFocus ? 2 : 1;

  // Measured training drill contributions so missions progress naturally alongside real matches
  const addSimultaneous = (metric: PersonalMissionMetric, base: number, label?: string) => {
    if (base <= 0) return;
    const total = base * mult;
    mState.stats[metric] = (mState.stats[metric] || 0) + total;
    if (label && opts.isTeamFocus) notes.push(`${label} +${total}`);
  };

  if (q.pos === 'GK') {
    addSimultaneous('saves', opts.teamProgram === 'defense' ? 2 : 1, 'เซฟประตู');
    addSimultaneous('passes', opts.teamProgram === 'tactics' ? 5 : 2);
  } else {
    addSimultaneous('passes', opts.teamProgram === 'tactics' ? 7 : 3, 'จ่ายบอล');
    addSimultaneous('dribbles', opts.teamProgram === 'fitness' || opts.teamProgram === 'setpiece' ? 2 : 1);

    if (q.pos === 'FW' || q.pos === 'MF') {
      const isAtt = opts.teamProgram === 'attack';
      addSimultaneous('shots', isAtt ? 2 : 1, 'ยิงประตู');
      if (isAtt || Math.random() < 0.55) addSimultaneous('onTarget', 1);
      addSimultaneous('crossAssists', isAtt ? 2 : 1);
      addSimultaneous('setpieces', opts.teamProgram === 'setpiece' ? 1 : 0);
    }
    if (q.pos === 'DF' || q.pos === 'MF') {
      const isDef = opts.teamProgram === 'defense';
      addSimultaneous('tackles', isDef ? 2 : 1, 'เข้าสกัด');
      addSimultaneous('blocks', isDef ? 1 : q.pos === 'DF' && Math.random() < 0.5 ? 1 : 0);
      addSimultaneous('headers', isDef ? 2 : 1);
      if (q.pos === 'DF' && opts.teamProgram === 'setpiece') {
        addSimultaneous('setpieces', 1);
      }
    } else if (q.pos === 'FW') {
      addSimultaneous('headers', 1);
    }
  }

  // Career personal weekly plan drills
  if (opts.careerPlan === 0 && q.pos !== 'GK') {
    addSimultaneous('shots', 1);
    if (Math.random() < 0.6) addSimultaneous('onTarget', 1);
  } else if (opts.careerPlan === 1) {
    addSimultaneous('passes', 4);
    addSimultaneous('dribbles', 1);
  } else if (opts.careerPlan === 4 && q.pos !== 'GK') {
    addSimultaneous('setpieces', 1);
  }

  q.missions = mState;
  if (opts.careerP) opts.careerP.missions = mState;
  const summary = resolvePlayerMissions(q, opts.careerP || null, opts.state || null);
  return { notes, summary };
};

type MatchMissionPayload = Pick<FinishedMatchPayload, 'gh' | 'ga' | 'evs' | 'pen' | 'pf' | 'playerActions'> & {
  ratings?: Record<string, number>;
  playedNames?: Record<number, string[]>;
};

const applyTeamMatchMissions = (
  s: GameState,
  team: Team,
  teamGoals: number,
  oppGoals: number,
  isWin: boolean,
  payload: MatchMissionPayload,
  trackForUser: boolean,
  combined: MissionResolveSummary
) => {
  const isCleanSheet = oppGoals === 0;
  const playedList = new Set(payload.playedNames?.[team.id] || xi(team).map((q) => q.n));
  const actionsMap = payload.playerActions || {};

  team.sq.forEach((q) => {
    const careerP = q.me && s.p ? s.p : null;
    if (q.me && payload.pf && payload.pf.played === false) return;
    if (!playedList.has(q.n) && !actionsMap[q.n]) return;

    addMissionStat(q, 'matches', 1, careerP);
    if (isWin) addMissionStat(q, 'wins', 1, careerP);
    if (isCleanSheet && (q.pos === 'GK' || q.pos === 'DF')) {
      addMissionStat(q, 'cleanSheets', 1, careerP);
    }

    const rt = q.me && payload.pf?.rt ? payload.pf.rt : payload.ratings?.[q.n] || 0;
    if (rt >= 7.2) addMissionStat(q, 'highRatings', 1, careerP);

    const goals = payload.evs.filter((e) => !e.og && e.t === team.id && e.who === q.n).length;
    const assists = payload.evs.filter((e) => !e.og && e.t === team.id && e.as === q.n).length;
    if (goals > 0) addMissionStat(q, 'goals', goals, careerP);

    const acts = actionsMap[q.n];
    if (acts) {
      (Object.entries(acts) as [PersonalMissionMetric, number][]).forEach(([metric, val]) => {
        if (val > 0 && metric !== 'matches' && metric !== 'wins' && metric !== 'cleanSheets' && metric !== 'highRatings' && metric !== 'goals') {
          addMissionStat(q, metric, val, careerP);
        }
      });
    } else {
      // Estimation fallback for instant-simmed & AI matches
      if (q.pos === 'GK') {
        addMissionStat(q, 'saves', R(2, 5), careerP);
        addMissionStat(q, 'passes', R(8, 16), careerP);
      } else {
        addMissionStat(q, 'passes', q.pos === 'MF' ? R(14, 28) : R(8, 18), careerP);
        addMissionStat(q, 'dribbles', q.pos === 'FW' || q.pos === 'MF' ? R(1, 4) : R(0, 2), careerP);
        if (q.pos === 'FW' || q.pos === 'MF') {
          const sh = Math.max(goals * 2 + (q.pos === 'FW' ? R(1, 2) : R(0, 2)), 0);
          if (sh > 0) {
            addMissionStat(q, 'shots', sh, careerP);
            addMissionStat(q, 'onTarget', Math.max(goals, Math.round(sh * 0.48)), careerP);
          }
        }
        if (assists > 0) addMissionStat(q, 'crossAssists', assists * 2 + 1, careerP);
        else if (q.pos === 'MF' || q.pos === 'DF') addMissionStat(q, 'crossAssists', R(0, 2), careerP);
        if (q.pos === 'DF' || q.pos === 'MF') {
          addMissionStat(q, 'tackles', R(2, 4), careerP);
          addMissionStat(q, 'blocks', R(0, 2), careerP);
        }
        addMissionStat(q, 'headers', R(0, 2), careerP);
      }
    }

    const res = resolvePlayerMissions(q, careerP, trackForUser ? s : null);
    if (trackForUser) {
      combined.upgraded.push(...res.upgraded);
      combined.failed.push(...res.failed);
    }
  });
  void teamGoals;
};

export const applyAiClubMatchMissions = (
  s: GameState,
  H: Team,
  A: Team,
  res: { gh: number; ga: number; evs: FinishedMatchPayload['evs']; pen?: boolean; ratings?: Record<string, number>; playedNames?: Record<number, string[]> }
) => {
  const dummyCombined: MissionResolveSummary = { upgraded: [], failed: [] };
  const hWin = res.gh > res.ga || Boolean(res.pen);
  const aWin = res.ga > res.gh || (res.gh === res.ga && res.pen === false);
  if (H.id !== s.me) applyTeamMatchMissions(s, H, res.gh, res.ga, hWin, res, false, dummyCombined);
  if (A.id !== s.me) applyTeamMatchMissions(s, A, res.ga, res.gh, aWin, res, false, dummyCombined);
};

export const applyMatchMissionProgress = (
  s: GameState,
  H: Team,
  A: Team,
  payload: FinishedMatchPayload
): MissionResolveSummary => {
  const combined: MissionResolveSummary = { upgraded: [], failed: [] };
  const hWin = payload.gh > payload.ga || Boolean(payload.pen === true);
  const aWin = payload.ga > payload.gh || Boolean(payload.gh === payload.ga && payload.pen === false);

  applyTeamMatchMissions(s, H, payload.gh, payload.ga, hWin, payload, H.id === s.me, combined);
  applyTeamMatchMissions(s, A, payload.ga, payload.gh, aWin, payload, A.id === s.me, combined);

  if (s.mode === 'p' && s.p) syncMe(s);
  return combined;
};
