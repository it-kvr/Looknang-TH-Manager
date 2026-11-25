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
import { OVF, xi, DT, ovMe, syncMe, recordPlayerSeasonProgress, getOvGrowthScale, getPlayerDevProfile } from './playerCore';

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
    category: 'attack',
    metric: 'setpieces',
    unit: 'ครั้ง',
    targets: [14, 34, 65, 110, 175, 260, 370, 500],
    subRewards: [
      { fk: 1, cur: 1 },
      { fk: 1, cur: 1, comp: 1 },
      { fk: 2, cur: 1, comp: 1 },
      { fk: 2, cur: 2, comp: 1 },
      { fk: 2, cur: 2, lsh: 1 },
      { fk: 2, cur: 2, comp: 1, lsh: 1 },
      { fk: 3, cur: 2, comp: 2 },
      { fk: 3, cur: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'passing',
    icon: '📐',
    name: 'จอมทัพส่งบอลแม่นยำ',
    desc: 'จ่ายบอลสำเร็จในสนามแข่งขันอย่างต่อเนื่องเพื่อปลดล็อกวิสัยทัศน์เกม',
    category: 'playmaking',
    metric: 'passes',
    unit: 'ครั้ง',
    targets: [240, 620, 1250, 2200, 3500, 5200, 7400, 10200],
    subRewards: [
      { spass: 1, lpass: 1 },
      { spass: 1, lpass: 1, rd: 1 },
      { spass: 2, lpass: 1, crs: 1 },
      { spass: 2, lpass: 2, rd: 1 },
      { spass: 2, lpass: 2, crs: 1, rd: 1 },
      { spass: 2, lpass: 2, vis: 2 },
      { spass: 3, lpass: 2, crs: 2 },
      { spass: 3, lpass: 3, vis: 2, comp: 1 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'finishing',
    icon: '🔥',
    name: 'เพชฌฆาตสับไก',
    desc: 'หาจังหวะยิงประตูและลุ้นจบสกอร์ในเกมจริงอย่างต่อเนื่อง',
    category: 'attack',
    metric: 'shots',
    unit: 'ครั้ง',
    targets: [38, 95, 185, 320, 500, 740, 1040, 1400],
    subRewards: [
      { fin: 1, pw: 1 },
      { fin: 1, pw: 1, run: 1 },
      { fin: 2, pw: 1, cur: 1 },
      { fin: 2, pw: 2, run: 1 },
      { fin: 2, pw: 2, comp: 1 },
      { fin: 2, pw: 2, run: 2 },
      { fin: 3, pw: 2, comp: 2 },
      { fin: 3, pw: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'long_shot_df',
    icon: '💣',
    name: 'แนวรับเติมเกมสับไก',
    desc: 'กองหลังและวิงแบ็กเติมเกมรุกหรือหวดลูกยิงไกลลุ้นประตู',
    category: 'attack',
    metric: 'shots',
    unit: 'ครั้ง',
    targets: [10, 26, 54, 96, 155, 230, 330, 455],
    subRewards: [
      { pw: 1, lsh: 1 },
      { lsh: 1, fin: 1, run: 1 },
      { pw: 2, lsh: 1, cur: 1 },
      { lsh: 2, pw: 1, run: 1 },
      { fin: 2, pw: 2, comp: 1 },
      { lsh: 2, pw: 2, run: 2 },
      { pw: 3, lsh: 2, comp: 1 },
      { fin: 3, pw: 2, lsh: 2, comp: 1 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['DF']
  },
  {
    id: 'sharpshooter',
    icon: '🏹',
    name: 'ยิงตรงกรอบเฉียบคม',
    desc: 'ส่งบอลพุ่งตรงกรอบบังคับผู้รักษาประตูต้องออกแรงเซฟ',
    category: 'attack',
    metric: 'onTarget',
    unit: 'ครั้ง',
    targets: [18, 46, 92, 160, 255, 380, 540, 730],
    subRewards: [
      { fin: 1, cur: 1 },
      { fin: 1, cur: 1, pw: 1 },
      { fin: 2, cur: 1, comp: 1 },
      { fin: 2, cur: 2, pw: 1 },
      { fin: 2, cur: 2, run: 1 },
      { fin: 2, cur: 2, comp: 2 },
      { fin: 3, cur: 2, run: 2 },
      { fin: 3, cur: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'goalscorer',
    icon: '⚽',
    name: 'เครื่องจักรถล่มประตู',
    desc: 'ยิงประตูสำคัญพาทีมไล่ล่าแต้มในเกมจริง',
    category: 'attack',
    metric: 'goals',
    unit: 'ประตู',
    targets: [8, 22, 46, 82, 130, 195, 280, 385],
    subRewards: [
      { fin: 1, run: 1 },
      { fin: 1, run: 1, comp: 1 },
      { fin: 2, pw: 1, comp: 1 },
      { fin: 2, run: 2, comp: 1 },
      { fin: 2, pw: 2, comp: 1 },
      { fin: 2, run: 2, comp: 2 },
      { fin: 3, pw: 2, comp: 2 },
      { fin: 3, pw: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'playmaker',
    icon: '🎁',
    name: 'จอมเปิดบอล & แทงช่อง',
    desc: 'เปิดบอลเข้ากรอบ แทงทะลุช่อง หรือจ่ายให้เพื่อนยิงประตู',
    category: 'playmaking',
    metric: 'crossAssists',
    unit: 'ครั้ง',
    targets: [28, 72, 145, 250, 390, 570, 790, 1060],
    subRewards: [
      { crs: 1, cur: 1 },
      { crs: 1, cur: 1, run: 1 },
      { crs: 2, cur: 1, fk: 1 },
      { crs: 2, cur: 2, rd: 1 },
      { crs: 2, cur: 2, run: 2 },
      { crs: 2, cur: 2, vis: 2 },
      { crs: 3, cur: 2, rd: 2 },
      { crs: 3, cur: 3, vis: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'assist_king',
    icon: '🪄',
    name: 'แอสซิสต์ปลิดวิญญาณ',
    desc: 'ส่งบอลจังหวะสุดท้ายให้เพื่อนร่วมทีมซัดตุงตาข่ายโดยตรง',
    category: 'playmaking',
    metric: 'assists',
    unit: 'ครั้ง',
    targets: [4, 11, 24, 44, 72, 110, 158, 220],
    subRewards: [
      { vis: 1, spass: 1 },
      { vis: 1, crs: 1, cur: 1 },
      { vis: 2, lpass: 1, cur: 1 },
      { vis: 2, crs: 2, comp: 1 },
      { vis: 2, spass: 2, lpass: 1 },
      { vis: 2, crs: 2, cur: 2 },
      { vis: 3, lpass: 2, comp: 2 },
      { vis: 3, spass: 2, crs: 2, comp: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'key_creator',
    icon: '🔑',
    name: 'จอมปั้นโอกาสทอง',
    desc: 'สร้างจังหวะคีย์พาสพาทีมหลุดเข้าพื้นที่อันตรายหน้าปากประตู',
    category: 'playmaking',
    metric: 'keyPasses',
    unit: 'ครั้ง',
    targets: [12, 32, 66, 115, 185, 275, 390, 530],
    subRewards: [
      { vis: 1, rd: 1 },
      { vis: 1, lpass: 1, ctrl: 1 },
      { vis: 2, lpass: 1, rd: 1 },
      { vis: 2, crs: 1, cur: 2 },
      { vis: 2, spass: 2, ctrl: 1 },
      { vis: 2, lpass: 2, comp: 1 },
      { vis: 3, rd: 2, ctrl: 2 },
      { vis: 3, lpass: 2, crs: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'dribbler',
    icon: '⚡',
    name: 'สปีด & เลี้ยงกินตัว',
    desc: 'พาบอลแหวกแนวรับหรือโชว์สกิลเลี้ยงหลบคู่แข่งในเกม',
    category: 'playmaking',
    metric: 'dribbles',
    unit: 'ครั้ง',
    targets: [52, 135, 270, 470, 740, 1090, 1540, 2100],
    subRewards: [
      { drb: 1, spd: 1 },
      { drb: 1, acc: 1, agi: 1 },
      { drb: 2, spd: 1, run: 1 },
      { drb: 2, ctrl: 2, agi: 1 },
      { drb: 2, spd: 2, bal: 1 },
      { drb: 2, acc: 2, ctrl: 2 },
      { drb: 3, spd: 2, run: 2 },
      { drb: 3, ctrl: 2, acc: 2, agi: 1 }
    ],
    coreReward: 'dr',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'defender',
    icon: '🛡️',
    name: 'ปราการเหล็กเข้าสกัด',
    desc: 'เข้าสกัดแย่งบอลและดักตัดจังหวะรุกของคู่แข่งอย่างแม่นยำ',
    category: 'defense',
    metric: 'tackles',
    unit: 'ครั้ง',
    targets: [42, 108, 215, 370, 580, 860, 1210, 1650],
    subRewards: [
      { tkl: 1, mrk: 1 },
      { tkl: 1, mrk: 1, rd: 1 },
      { tkl: 2, mrk: 1, str: 1 },
      { tkl: 2, mrk: 2, rd: 1 },
      { tkl: 2, mrk: 2, blk: 1 },
      { tkl: 2, mrk: 2, comp: 2 },
      { tkl: 3, mrk: 2, rd: 2 },
      { tkl: 3, mrk: 3, comp: 2 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['DF', 'MF']
  },
  {
    id: 'intercept_master',
    icon: '🦅',
    name: 'จอมดักอ่านทางบอล',
    desc: 'อ่านทางจ่ายคู่แข่งล่วงหน้าและพุ่งดักตัดบอลกลางทาง',
    category: 'defense',
    metric: 'interceptions',
    unit: 'ครั้ง',
    targets: [20, 54, 110, 190, 300, 445, 630, 860],
    subRewards: [
      { rd: 1, pos: 1 },
      { rd: 1, tkl: 1, foc: 1 },
      { rd: 2, pos: 1, mrk: 1 },
      { rd: 2, pos: 2, acc: 1 },
      { rd: 2, mrk: 2, foc: 1 },
      { rd: 2, pos: 2, tkl: 2 },
      { rd: 3, pos: 2, comp: 2 },
      { rd: 3, mrk: 2, tkl: 2, foc: 1 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['DF', 'MF']
  },
  {
    id: 'shotblocker',
    icon: '🧱',
    name: 'กำแพงบล็อกลูกยิง',
    desc: 'อ่านจังหวะพุ่งบล็อกลูกยิงอันตรายช่วยแนวรับและผู้รักษาประตู',
    category: 'defense',
    metric: 'blocks',
    unit: 'ครั้ง',
    targets: [15, 40, 82, 145, 230, 345, 490, 670],
    subRewards: [
      { blk: 1, pos: 1 },
      { blk: 1, pos: 1, tol: 1 },
      { blk: 2, pos: 1, str: 1 },
      { blk: 2, mrk: 1, tol: 1 },
      { blk: 2, pos: 2, str: 1 },
      { blk: 2, mrk: 2, comp: 1 },
      { blk: 3, pos: 2, str: 2 },
      { blk: 3, mrk: 2, tol: 2, comp: 1 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['DF', 'MF']
  },
  {
    id: 'aerial',
    icon: '🗣️',
    name: 'จ้าวเวหาลูกโหม่ง',
    desc: 'ดวลลูกกลางอากาศและเทกตัวโหม่งทั้งเกมรุกและเกมรับ',
    category: 'physical',
    metric: 'headers',
    unit: 'ครั้ง',
    targets: [26, 68, 135, 235, 370, 540, 760, 1030],
    subRewards: [
      { hd: 1, jmp: 1 },
      { hd: 1, str: 1, jmp: 1 },
      { hd: 2, str: 1, pos: 1 },
      { hd: 2, jmp: 2, str: 1 },
      { hd: 2, str: 2, comp: 1 },
      { hd: 2, jmp: 2, pos: 2 },
      { hd: 3, str: 2, jmp: 2 },
      { hd: 3, str: 3, comp: 2 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'goalkeeper',
    icon: '🧤',
    name: 'มือกาวจอมเซฟ',
    desc: 'เซฟลูกยิงตรงกรอบและออกมาชก/คว้าบอลกลางอากาศ',
    category: 'gk',
    metric: 'saves',
    unit: 'ครั้ง',
    targets: [36, 92, 185, 320, 500, 740, 1040, 1420],
    subRewards: [
      { sv: 1, rfx: 1 },
      { sv: 1, cl: 1, hnd: 1 },
      { sv: 2, rfx: 1, cl: 1 },
      { sv: 2, hnd: 2, pos: 1 },
      { sv: 2, cl: 2, comp: 1 },
      { sv: 2, rfx: 2, dist: 2 },
      { sv: 3, cl: 2, hnd: 2 },
      { sv: 3, rfx: 3, cl: 2, comp: 1 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['GK']
  },
  {
    id: 'gk_clean',
    icon: '🔒',
    name: 'เสาหลักเก็บคลีนชีต',
    desc: 'คุมแนวรับให้ทีมไม่เสียประตูจนจบเกม',
    category: 'gk',
    metric: 'cleanSheets',
    unit: 'นัด',
    targets: [5, 14, 28, 48, 76, 112, 158, 215],
    subRewards: [
      { pos: 1, comp: 1 },
      { pos: 1, comp: 1, rec: 1 },
      { pos: 2, comp: 1, mrk: 1 },
      { cl: 2, pos: 1, foc: 1 },
      { sv: 2, mrk: 2, comp: 1 },
      { pos: 2, cl: 2, foc: 2 },
      { sv: 2, mrk: 2, comp: 2 },
      { pos: 3, cl: 2, comp: 3 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['GK', 'DF']
  },
  {
    id: 'gk_sweeper',
    icon: '📡',
    name: 'โกลสายเปิดเกมคุมพื้นที่',
    desc: 'ออกบอลจากแดนหลังและเปิดเกมโต้กลับแม่นยำต่อเนื่อง',
    category: 'gk',
    metric: 'passes',
    unit: 'ครั้ง',
    targets: [140, 360, 720, 1250, 1980, 2950, 4200, 5800],
    subRewards: [
      { dist: 1, spass: 1 },
      { dist: 1, lpass: 1, comp: 1 },
      { dist: 2, spass: 1, rd: 1 },
      { dist: 2, lpass: 2, comp: 1 },
      { dist: 2, vis: 2, rd: 1 },
      { dist: 2, lpass: 2, ctrl: 2 },
      { dist: 3, spass: 2, rd: 2 },
      { dist: 3, lpass: 2, comp: 2, vis: 1 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['GK']
  },
  {
    id: 'winner',
    icon: '🏆',
    name: 'จิตวิญญาณผู้ชนะ',
    desc: 'มีส่วนร่วมพาทีมคว้าชัยชนะในเกมการแข่งขันจริง',
    category: 'physical',
    metric: 'wins',
    unit: 'นัด',
    targets: [10, 26, 52, 90, 142, 210, 295, 400],
    subRewards: [
      { comp: 1, sta: 1 },
      { comp: 1, det: 1, ldr: 1 },
      { comp: 2, sta: 1, rd: 1 },
      { comp: 2, str: 1, ldr: 2 },
      { comp: 2, sta: 2, foc: 1 },
      { comp: 2, det: 2, rec: 2 },
      { comp: 3, sta: 2, ldr: 2 },
      { comp: 3, sta: 3, rec: 2, det: 1 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'mvp_form',
    icon: '⭐',
    name: 'ฟอร์มเทพสม่ำเสมอ',
    desc: 'โชว์ฟอร์มเด่นคว้าเรตติ้งหลังเกม 7.2 ขึ้นไปอย่างต่อเนื่อง',
    category: 'playmaking',
    metric: 'highRatings',
    unit: 'นัด',
    targets: [8, 20, 42, 74, 118, 176, 250, 345],
    subRewards: [
      { con: 1, comp: 1 },
      { con: 1, rd: 1, foc: 1 },
      { comp: 2, con: 1, rd: 1 },
      { con: 2, cur: 1, foc: 2 },
      { con: 2, comp: 2, rd: 1 },
      { con: 2, rd: 2, ctrl: 2 },
      { comp: 3, con: 2, foc: 2 },
      { comp: 3, con: 2, rd: 2, ctrl: 1 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'motm_star',
    icon: '🌟',
    name: 'ซูเปอร์สตาร์แมนออฟเดอะแมตช์',
    desc: 'ระเบิดฟอร์มคว้ารางวัลนักเตะยอดเยี่ยมประจำนัด (MOTM)',
    category: 'attack',
    metric: 'motm',
    unit: 'ครั้ง',
    targets: [3, 8, 17, 30, 48, 72, 102, 140],
    subRewards: [
      { comp: 1, det: 1 },
      { comp: 1, agi: 1, ctrl: 1 },
      { comp: 2, ldr: 1, det: 1 },
      { comp: 2, cur: 2, agi: 1 },
      { comp: 2, spd: 1, ctrl: 2 },
      { comp: 2, drb: 2, foc: 2 },
      { comp: 3, agi: 2, ldr: 2 },
      { comp: 3, ctrl: 2, spd: 2, det: 1 }
    ],
    coreReward: 'dr',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'fairplay_pro',
    icon: '🕊️',
    name: 'วินัยเหล็กไร้ใบเตือน',
    desc: 'ลงเล่นครบเกมอย่างใสสะอาดโดยไม่โดนใบเหลืองหรือใบแดง',
    category: 'physical',
    metric: 'cleanGames',
    unit: 'นัด',
    targets: [12, 30, 60, 105, 165, 245, 345, 470],
    subRewards: [
      { foc: 1, con: 1 },
      { foc: 1, comp: 1, bal: 1 },
      { foc: 2, con: 1, rd: 1 },
      { foc: 2, tol: 1, rec: 1 },
      { foc: 2, comp: 2, bal: 1 },
      { foc: 2, con: 2, end: 2 },
      { foc: 3, comp: 2, tol: 2 },
      { foc: 3, con: 2, rec: 2, end: 1 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'ironman',
    icon: '💪',
    name: 'ปอดเหล็กความฟิต & ยืนระยะ',
    desc: 'ลงสนามแข่งขันและรักษาวินัยฝึกซ้อมอย่างสม่ำเสมอ',
    category: 'physical',
    metric: 'matches',
    unit: 'นัด',
    targets: [14, 36, 72, 124, 195, 290, 410, 560],
    subRewards: [
      { sta: 1, tol: 1 },
      { sta: 1, rec: 1, end: 1 },
      { sta: 2, tol: 1, rec: 1 },
      { sta: 2, end: 2, str: 1 },
      { sta: 2, tol: 2, rec: 1 },
      { sta: 2, str: 2, end: 2 },
      { sta: 3, tol: 2, rec: 2 },
      { sta: 3, tol: 2, rec: 2, str: 2 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 1]
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
  const devProf = getPlayerDevProfile(q, careerP);
  const age = devProf.age;
  const curOv = q.me && careerP ? ovMe(careerP) : (q.ov || 65);

  // Harder progression curve across 8 stages, uncapped until declining phase
  let chance = 16 + talent * 0.36 - stage * 5.0;
  if (age <= 21) chance += 3;
  if (devProf.phase === 'peak') chance -= 3;
  else if (devProf.phase === 'declining') chance -= 16;
  if (devProf.strongSeason) chance += 4;

  if (curOv >= 76) {
    chance -= Math.max(0, curOv - 76) * 1.15;
  }

  if (isProdigy) chance += 5;
  if (state?.tr) chance += Math.max(0, state.tr - 1) * 0.45;
  if (state?.staff?.asst) chance += state.staff.asst * 0.5;
  if (state?.analyticsLv && state.analyticsLv > 1) chance += (state.analyticsLv - 1) * 0.35;

  return clamp(Math.round(chance), 5, 68);
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
  const passedStages = items.reduce((sum, x) => sum + x.stage, 0);
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
  const devProf = getPlayerDevProfile(q, careerP);

  const scaleSub = (delta: number) =>
    curOv >= 88
      ? Math.max(1, Math.round(delta * 0.45))
      : curOv >= 76
        ? Math.max(1, Math.round(delta * 0.72))
        : delta;

  q.sb = { ...(q.sb || {}) };
  Object.entries(rewards).forEach(([sk, delta]) => {
    const scaledDelta = scaleSub(delta);
    q.sb![sk] = (q.sb![sk] || 0) + scaledDelta;
    if (q.customD && q.customD[sk] != null) {
      q.customD[sk] = clamp(q.customD[sk] + scaledDelta, 1, 199);
    }
  });

  if (careerP) {
    careerP.sb = { ...(careerP.sb || {}) };
    Object.entries(rewards).forEach(([sk, delta]) => {
      const scaledDelta = scaleSub(delta);
      careerP.sb![sk] = (careerP.sb![sk] || 0) + scaledDelta;
      if (careerP.customD && careerP.customD[sk] != null) {
        careerP.customD[sk] = clamp(careerP.customD[sk] + scaledDelta, 1, 199);
      }
    });
    const curCoreVal = careerP.a[def.coreReward] || 60;
    const coreChance =
      curCoreVal >= 95
        ? 0.08
        : curCoreVal >= 84
          ? 0.16
          : curCoreVal < 72
            ? 0.62
            : 0.14 + ovScale * 0.55;
    if (coreAmt > 0 && devProf.phase !== 'declining' && Math.random() < coreChance) {
      careerP.a[def.coreReward] = clamp(careerP.a[def.coreReward] + coreAmt, 1, 199);
    }
    careerP.rep = (careerP.rep || 10) + (stage >= 4 ? 2 : 1);
    const nextOv = clamp(ovMe(careerP), 1, 199);
    q.ov = Math.max(q.ov, nextOv);
    q.pot = clamp(Math.max(q.pot || q.ov, q.ov + 2), q.ov, 199);
    if (q.blessed && q.customA) q.customA = { ...careerP.a };
    if (s) syncMe(s);
  } else {
    const coreChance = curOv >= 95 ? 0.35 : curOv >= 86 ? 0.6 : 1;
    if (coreAmt > 0 && devProf.phase !== 'declining' && Math.random() < coreChance) {
      q.coreSb = { ...(q.coreSb || {}) };
      q.coreSb[def.coreReward] = (q.coreSb[def.coreReward] || 0) + coreAmt;
      if (q.customA) {
        q.customA[def.coreReward] = clamp(q.customA[def.coreReward] + coreAmt, 1, 199);
      }
    }
    const afterDt = DT(q, null);
    const calcOv = clamp(OVF(q.pos, afterDt.a), 1, 199);
    if (calcOv > q.ov) {
      q.ov = calcOv;
    }
    q.pot = clamp(Math.max(q.pot || q.ov, q.ov + 2), q.ov, 199);
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

    while (stage < def.targets.length && (mState.stats[def.metric] || 0) >= def.targets[stage]) {
      changed = true;
      const target = def.targets[stage];
      const chance = calcMissionSuccessChance(q, careerP, def, stage, s);
      const success = Math.random() * 100 < chance;
      const arr: MissionStageOutcome[] = outcomes[def.id] ? [...outcomes[def.id]] : Array(stage).fill('ok');
      arr[stage] = success ? 'ok' : 'fail';
      outcomes[def.id] = arr;

      if (success) {
        mState.claimed[def.id] = stage + 1;
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
        stage++;
      } else {
        // Setback on failure: keep stage retryable and step metric progress back to ~72%
        mState.claimed[def.id] = stage;
        mState.stats[def.metric] = Math.floor(target * 0.72);
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
        break;
      }
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

  const recentLogs = [...(mState.recentLogs || [])];
  let msg: string;
  if (success) {
    mState.claimed[def.id] = stage + 1;
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
    mState.claimed[def.id] = stage;
    const resetVal = Math.floor(target * 0.72);
    mState.stats[def.metric] = resetVal;
    recentLogs.unshift({
      missionId: def.id,
      missionName: def.name,
      icon: def.icon,
      stage: stage + 1,
      success: false,
      chance,
      md: (s.md ?? 0) + 1
    });
    msg = `💨 ${q.n} พลาดการอัพพลัง "${def.name} (ขั้น ${stage + 1}/${def.targets.length})" (โอกาสติด ${chance}%) · ความคืบหน้าลดเหลือ ${resetVal}/${target} เพื่อลองใหม่`;
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
    state?: Pick<GameState, 'tr' | 'staff' | 'analyticsLv'> | null;
  }
): { notes: string[]; summary: MissionResolveSummary } => {
  const notes: string[] = [];
  const mState = ensurePlayerMissions(q, opts.careerP);
  const mult = opts.isTeamFocus ? 1.4 : 1;

  // Measured training drill contributions so missions scale cleanly across 8 stages
  const addSimultaneous = (metric: PersonalMissionMetric, base: number, label?: string) => {
    if (base <= 0) return;
    const total = Math.max(1, Math.round(base * mult));
    mState.stats[metric] = (mState.stats[metric] || 0) + total;
    if (label && opts.isTeamFocus) notes.push(`${label} +${total}`);
  };

  if (q.pos === 'GK') {
    addSimultaneous('saves', opts.teamProgram === 'defense' ? 2 : 1, 'เซฟประตู');
    addSimultaneous('passes', opts.teamProgram === 'tactics' ? 3 : 2);
  } else {
    addSimultaneous('passes', opts.teamProgram === 'tactics' ? 3 : 2, 'จ่ายบอล');
    addSimultaneous('dribbles', opts.teamProgram === 'fitness' || opts.teamProgram === 'setpiece' ? 2 : 1);

    if (q.pos === 'FW' || q.pos === 'MF') {
      const isAtt = opts.teamProgram === 'attack';
      addSimultaneous('shots', isAtt ? 2 : 1, 'ยิงประตู');
      if (isAtt || Math.random() < 0.4) addSimultaneous('onTarget', 1);
      addSimultaneous('crossAssists', isAtt ? 2 : 1);
      if (opts.teamProgram === 'tactics' && Math.random() < 0.5) addSimultaneous('keyPasses', 1);
      if (opts.teamProgram === 'setpiece') addSimultaneous('setpieces', 1);
    } else if (q.pos === 'DF') {
      if (opts.teamProgram === 'attack' || opts.teamProgram === 'setpiece' || Math.random() < 0.35) {
        addSimultaneous('shots', 1);
      }
      addSimultaneous('crossAssists', 1);
      if (opts.teamProgram === 'setpiece') addSimultaneous('setpieces', 1);
    }
    if (q.pos === 'DF' || q.pos === 'MF') {
      const isDef = opts.teamProgram === 'defense';
      addSimultaneous('tackles', isDef ? 2 : 1, 'เข้าสกัด');
      if (isDef || Math.random() < 0.5) addSimultaneous('interceptions', 1);
      if (isDef || (q.pos === 'DF' && Math.random() < 0.4)) addSimultaneous('blocks', 1);
      addSimultaneous('headers', isDef ? 2 : 1);
    } else if (q.pos === 'FW') {
      addSimultaneous('headers', 1);
    }
  }

  // Career personal weekly plan drills (measured pace alongside teammates)
  if (opts.careerPlan === 0 && q.pos !== 'GK') {
    if (Math.random() < 0.45) addSimultaneous('shots', 1);
    if (Math.random() < 0.25) addSimultaneous('onTarget', 1);
  } else if (opts.careerPlan === 1) {
    addSimultaneous('passes', 1);
    if (Math.random() < 0.4) addSimultaneous('dribbles', 1);
  } else if (opts.careerPlan === 4 && q.pos !== 'GK') {
    if (Math.random() < 0.45) addSimultaneous('setpieces', 1);
  }

  q.missions = mState;
  if (opts.careerP) opts.careerP.missions = mState;
  const summary = resolvePlayerMissions(q, opts.careerP || null, (opts.state as GameState | null) || null);
  return { notes, summary };
};

type MatchMissionPayload = Pick<FinishedMatchPayload, 'gh' | 'ga' | 'evs' | 'pen' | 'pf' | 'playerActions'> & {
  ratings?: Record<string, number>;
  playedNames?: Record<number, string[]>;
  motm?: string;
  cards?: FinishedMatchPayload['cards'];
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
  const cardSet = new Set((payload.cards || []).map((c) => c.who));

  team.sq.forEach((q) => {
    const careerP = q.me && s.p ? s.p : null;
    if (q.me && payload.pf && payload.pf.played === false) return;
    if (!playedList.has(q.n) && !actionsMap[q.n]) return;

    addMissionStat(q, 'matches', 1, careerP);
    if (isWin) addMissionStat(q, 'wins', 1, careerP);
    if (isCleanSheet && (q.pos === 'GK' || q.pos === 'DF')) {
      addMissionStat(q, 'cleanSheets', 1, careerP);
    }
    if (!cardSet.has(q.n)) {
      addMissionStat(q, 'cleanGames', 1, careerP);
    }

    const rt = q.me && payload.pf?.rt ? payload.pf.rt : payload.ratings?.[q.n] || 0;
    if (rt >= 7.2) addMissionStat(q, 'highRatings', 1, careerP);
    if (payload.motm && payload.motm === q.n) {
      addMissionStat(q, 'motm', 1, careerP);
    }

    const goals = payload.evs.filter((e) => !e.og && e.t === team.id && e.who === q.n).length;
    const assists = payload.evs.filter((e) => !e.og && e.t === team.id && e.as === q.n).length;
    if (goals > 0) addMissionStat(q, 'goals', goals, careerP);
    if (assists > 0) addMissionStat(q, 'assists', assists, careerP);

    const acts = actionsMap[q.n];
    if (acts) {
      (Object.entries(acts) as [PersonalMissionMetric, number][]).forEach(([metric, val]) => {
        if (
          val > 0 &&
          metric !== 'matches' &&
          metric !== 'wins' &&
          metric !== 'cleanSheets' &&
          metric !== 'highRatings' &&
          metric !== 'goals' &&
          metric !== 'assists' &&
          metric !== 'motm' &&
          metric !== 'cleanGames'
        ) {
          addMissionStat(q, metric, val, careerP);
        }
      });
      if (acts.keyPasses == null && assists > 0) {
        addMissionStat(q, 'keyPasses', assists, careerP);
      }
    } else {
      // Estimation fallback for AI & instant matches (balanced parity with user match actions)
      if (q.pos === 'GK') {
        addMissionStat(q, 'saves', R(2, 6), careerP);
        addMissionStat(q, 'passes', R(12, 22), careerP);
      } else {
        addMissionStat(q, 'passes', q.pos === 'MF' ? R(20, 38) : q.pos === 'DF' ? R(15, 28) : R(10, 20), careerP);
        addMissionStat(q, 'dribbles', q.pos === 'FW' || q.pos === 'MF' ? R(2, 5) : R(1, 3), careerP);
        if (q.pos === 'FW' || q.pos === 'MF') {
          const sh = Math.max(goals * 2 + (q.pos === 'FW' ? R(1, 3) : R(0, 3)), 0);
          if (sh > 0) {
            addMissionStat(q, 'shots', sh, careerP);
            addMissionStat(q, 'onTarget', Math.max(goals, Math.round(sh * 0.5)), careerP);
          }
        } else if (q.pos === 'DF') {
          const dfSh = goals > 0 ? Math.max(1, goals) : Math.random() < 0.38 ? 1 : 0;
          if (dfSh > 0) addMissionStat(q, 'shots', dfSh, careerP);
        }
        if (assists > 0) addMissionStat(q, 'crossAssists', assists * 2 + 1, careerP);
        else if (q.pos === 'MF' || q.pos === 'DF') addMissionStat(q, 'crossAssists', R(1, 3), careerP);

        const kp =
          (q.pos === 'MF' ? R(1, 3) : q.pos === 'FW' ? R(0, 2) : R(0, 1)) + assists;
        if (kp > 0) addMissionStat(q, 'keyPasses', kp, careerP);

        if (q.pos === 'DF' || q.pos === 'MF') {
          addMissionStat(q, 'tackles', q.pos === 'DF' ? R(3, 6) : R(2, 4), careerP);
          addMissionStat(q, 'interceptions', q.pos === 'DF' ? R(1, 4) : R(1, 3), careerP);
          addMissionStat(q, 'blocks', q.pos === 'DF' ? R(0, 2) : R(0, 1), careerP);
        }
        addMissionStat(q, 'headers', q.pos === 'DF' || q.pos === 'FW' ? R(1, 3) : R(0, 2), careerP);
        if (q.pos === 'MF' || q.pos === 'FW' || q.pos === 'DF') {
          addMissionStat(q, 'setpieces', q.pos === 'DF' ? R(0, 1) : R(0, 2), careerP);
        }
      }
    }

    const aiVirtualState: GameState | null = trackForUser
      ? s
      : ({
          ...s,
          tr: [3, 5, 8, 9][team.tier] ?? 5,
          analyticsLv: [2, 4, 6, 8][team.tier] ?? 4,
          staff: {
            fit: 0,
            scout: 0,
            physio: 0,
            ...(s.staff || {}),
            asst: [1, 2, 3, 4][team.tier] ?? 2
          }
        } as GameState);
    const res = resolvePlayerMissions(q, careerP, aiVirtualState);
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
  res: {
    gh: number;
    ga: number;
    evs: FinishedMatchPayload['evs'];
    pen?: boolean;
    ratings?: Record<string, number>;
    playedNames?: Record<number, string[]>;
    motm?: string;
    cards?: FinishedMatchPayload['cards'];
  }
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
