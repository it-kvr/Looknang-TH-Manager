import type {
  Position,
  StatKey,
  TrainingProgramId,
  Player,
  PersonalMissionMetric,
  PlayerMissionsState,
  MissionSeasonRecord,
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

export interface TalentTierMeta {
  tierKey: 'legend' | 'high' | 'pro' | 'grind';
  label: string;
  shortLabel: string;
  emoji: string;
  badgeCls: string;
  darkCardCls: string;
  textCls: string;
  barHex: string;
  bg: string;
  color: string;
}

export function talentTierMeta(tl: number): TalentTierMeta {
  if (tl >= 85) {
    return {
      tierKey: 'legend',
      label: 'อัจฉริยะลูกหนัง',
      shortLabel: 'อัจฉริยะ',
      emoji: '💎',
      badgeCls:
        'bg-gradient-to-r from-amber-500/18 via-yellow-400/12 to-amber-500/18 border-amber-500/45 text-amber-900 dark:from-amber-400/20 dark:via-yellow-400/10 dark:to-amber-500/15 dark:border-amber-400/45 dark:text-amber-200',
      darkCardCls:
        'bg-gradient-to-r from-amber-500/28 via-yellow-400/18 to-amber-500/24 border-amber-300/60 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.22)]',
      textCls: 'text-amber-700 dark:text-amber-300',
      barHex: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.22)',
      color: '#d97706'
    };
  }
  if (tl >= 70) {
    return {
      tierKey: 'high',
      label: 'พรสวรรค์สูง',
      shortLabel: 'พรสวรรค์สูง',
      emoji: '🌟',
      badgeCls:
        'bg-gradient-to-r from-emerald-500/16 to-teal-500/12 border-emerald-600/40 text-emerald-900 dark:from-emerald-500/20 dark:to-teal-500/12 dark:border-emerald-400/45 dark:text-emerald-200',
      darkCardCls:
        'bg-gradient-to-r from-emerald-500/26 to-teal-400/18 border-emerald-300/50 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.16)]',
      textCls: 'text-emerald-700 dark:text-emerald-300',
      barHex: '#10b981',
      bg: 'rgba(16, 185, 129, 0.2)',
      color: '#059669'
    };
  }
  if (tl >= 50) {
    return {
      tierKey: 'pro',
      label: 'มาตรฐานอาชีพ',
      shortLabel: 'มาตรฐาน',
      emoji: '⚡',
      badgeCls:
        'bg-gradient-to-r from-sky-500/15 to-cyan-500/10 border-sky-600/40 text-sky-900 dark:from-sky-500/20 dark:to-cyan-500/12 dark:border-sky-400/45 dark:text-sky-200',
      darkCardCls:
        'bg-gradient-to-r from-sky-500/25 to-cyan-400/16 border-sky-300/45 text-sky-200',
      textCls: 'text-sky-700 dark:text-sky-300',
      barHex: '#0ea5e9',
      bg: 'rgba(14, 165, 233, 0.2)',
      color: '#0284c7'
    };
  }
  return {
    tierKey: 'grind',
    label: 'ต้องฝึกหนักเป็นพิเศษ',
    shortLabel: 'ฝึกหนัก',
    emoji: '🧱',
    badgeCls:
      'bg-slate-500/12 border-slate-500/35 text-slate-700 dark:bg-slate-400/14 dark:border-slate-400/35 dark:text-slate-200',
    darkCardCls:
      'bg-slate-400/15 border-slate-300/35 text-slate-200',
    textCls: 'text-slate-600 dark:text-slate-300',
    barHex: '#64748b',
    bg: tl >= 40 ? 'rgba(71, 85, 105, 0.22)' : 'rgba(148, 163, 184, 0.16)',
    color: '#475569'
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
    targets: [16, 40, 78, 132, 210, 315, 450, 620, 840, 1120],
    subRewards: [
      { fk: 1, cur: 1 },
      { fk: 1, cur: 1, comp: 1 },
      { fk: 2, cur: 1, comp: 1 },
      { fk: 2, cur: 2, comp: 1 },
      { fk: 2, cur: 2, lsh: 1 },
      { fk: 2, cur: 2, comp: 1, lsh: 1 },
      { fk: 3, cur: 2, comp: 2 },
      { fk: 3, cur: 3, comp: 2 },
      { fk: 3, cur: 3, lsh: 2, comp: 2 },
      { fk: 4, cur: 3, lsh: 2, comp: 3 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [280, 720, 1480, 2600, 4150, 6200, 8800, 12100, 16200, 21500],
    subRewards: [
      { spass: 1, lpass: 1 },
      { spass: 1, lpass: 1, rd: 1 },
      { spass: 2, lpass: 1, crs: 1 },
      { spass: 2, lpass: 2, rd: 1 },
      { spass: 2, lpass: 2, crs: 1, rd: 1 },
      { spass: 2, lpass: 2, vis: 2 },
      { spass: 3, lpass: 2, crs: 2 },
      { spass: 3, lpass: 3, vis: 2, comp: 1 },
      { spass: 3, lpass: 3, vis: 3, rd: 2 },
      { spass: 4, lpass: 3, vis: 3, comp: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'finishing',
    icon: '🔥',
    name: 'เพชฌฆาตสับไก',
    desc: 'หาจังหวะยิงประตูและลุ้นจบสกอร์ในเกมจริงอย่างต่อเนื่อง',
    category: 'attack',
    metric: 'shots',
    unit: 'ครั้ง',
    targets: [44, 112, 220, 380, 600, 890, 1260, 1720, 2300, 3050],
    subRewards: [
      { fin: 1, pw: 1 },
      { fin: 1, pw: 1, run: 1 },
      { fin: 2, pw: 1, cur: 1 },
      { fin: 2, pw: 2, run: 1 },
      { fin: 2, pw: 2, comp: 1 },
      { fin: 2, pw: 2, run: 2 },
      { fin: 3, pw: 2, comp: 2 },
      { fin: 3, pw: 3, comp: 2 },
      { fin: 3, pw: 3, run: 2, cur: 2 },
      { fin: 4, pw: 3, comp: 3, run: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [12, 32, 66, 118, 190, 285, 410, 565, 760, 1020],
    subRewards: [
      { pw: 1, lsh: 1 },
      { lsh: 1, fin: 1, run: 1 },
      { pw: 2, lsh: 1, cur: 1 },
      { lsh: 2, pw: 1, run: 1 },
      { fin: 2, pw: 2, comp: 1 },
      { lsh: 2, pw: 2, run: 2 },
      { pw: 3, lsh: 2, comp: 1 },
      { fin: 3, pw: 2, lsh: 2, comp: 1 },
      { pw: 3, lsh: 3, run: 2, comp: 2 },
      { fin: 3, pw: 3, lsh: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [22, 56, 112, 195, 310, 465, 660, 910, 1220, 1620],
    subRewards: [
      { fin: 1, cur: 1 },
      { fin: 1, cur: 1, pw: 1 },
      { fin: 2, cur: 1, comp: 1 },
      { fin: 2, cur: 2, pw: 1 },
      { fin: 2, cur: 2, run: 1 },
      { fin: 2, cur: 2, comp: 2 },
      { fin: 3, cur: 2, run: 2 },
      { fin: 3, cur: 3, comp: 2 },
      { fin: 3, cur: 3, pw: 2, run: 2 },
      { fin: 4, cur: 3, comp: 3, pw: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [10, 26, 55, 98, 158, 238, 340, 470, 635, 850],
    subRewards: [
      { fin: 1, run: 1 },
      { fin: 1, run: 1, comp: 1 },
      { fin: 2, pw: 1, comp: 1 },
      { fin: 2, run: 2, comp: 1 },
      { fin: 2, pw: 2, comp: 1 },
      { fin: 2, run: 2, comp: 2 },
      { fin: 3, pw: 2, comp: 2 },
      { fin: 3, pw: 3, comp: 2 },
      { fin: 3, run: 3, pw: 2, comp: 2 },
      { fin: 4, pw: 3, run: 3, comp: 3 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [34, 88, 175, 305, 480, 710, 1000, 1360, 1820, 2420],
    subRewards: [
      { crs: 1, cur: 1 },
      { crs: 1, cur: 1, run: 1 },
      { crs: 2, cur: 1, fk: 1 },
      { crs: 2, cur: 2, rd: 1 },
      { crs: 2, cur: 2, run: 2 },
      { crs: 2, cur: 2, vis: 2 },
      { crs: 3, cur: 2, rd: 2 },
      { crs: 3, cur: 3, vis: 2 },
      { crs: 3, cur: 3, vis: 3, rd: 2 },
      { crs: 4, cur: 3, vis: 3, fk: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [5, 14, 30, 55, 90, 138, 198, 275, 375, 500],
    subRewards: [
      { vis: 1, spass: 1 },
      { vis: 1, crs: 1, cur: 1 },
      { vis: 2, lpass: 1, cur: 1 },
      { vis: 2, crs: 2, comp: 1 },
      { vis: 2, spass: 2, lpass: 1 },
      { vis: 2, crs: 2, cur: 2 },
      { vis: 3, lpass: 2, comp: 2 },
      { vis: 3, spass: 2, crs: 2, comp: 2 },
      { vis: 3, lpass: 3, crs: 2, cur: 2 },
      { vis: 4, spass: 3, crs: 3, comp: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [15, 38, 78, 138, 220, 330, 470, 645, 870, 1160],
    subRewards: [
      { vis: 1, rd: 1 },
      { vis: 1, lpass: 1, ctrl: 1 },
      { vis: 2, lpass: 1, rd: 1 },
      { vis: 2, crs: 1, cur: 2 },
      { vis: 2, spass: 2, ctrl: 1 },
      { vis: 2, lpass: 2, comp: 1 },
      { vis: 3, rd: 2, ctrl: 2 },
      { vis: 3, lpass: 2, crs: 2 },
      { vis: 3, crs: 2, rd: 2, ctrl: 2 },
      { vis: 4, lpass: 3, crs: 2, comp: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [60, 155, 315, 550, 875, 1300, 1850, 2550, 3420, 4550],
    subRewards: [
      { drb: 1, spd: 1 },
      { drb: 1, acc: 1, agi: 1 },
      { drb: 2, spd: 1, run: 1 },
      { drb: 2, ctrl: 2, agi: 1 },
      { drb: 2, spd: 2, bal: 1 },
      { drb: 2, acc: 2, ctrl: 2 },
      { drb: 3, spd: 2, run: 2 },
      { drb: 3, ctrl: 2, acc: 2, agi: 1 },
      { drb: 3, spd: 3, agi: 2, bal: 2 },
      { drb: 4, ctrl: 3, spd: 3, acc: 2 }
    ],
    coreReward: 'dr',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [48, 125, 255, 440, 700, 1040, 1480, 2040, 2750, 3650],
    subRewards: [
      { tkl: 1, mrk: 1 },
      { tkl: 1, mrk: 1, rd: 1 },
      { tkl: 2, mrk: 1, str: 1 },
      { tkl: 2, mrk: 2, rd: 1 },
      { tkl: 2, mrk: 2, blk: 1 },
      { tkl: 2, mrk: 2, comp: 2 },
      { tkl: 3, mrk: 2, rd: 2 },
      { tkl: 3, mrk: 3, comp: 2 },
      { tkl: 3, mrk: 3, str: 2, rd: 2 },
      { tkl: 4, mrk: 3, blk: 2, comp: 2 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [24, 64, 132, 230, 365, 545, 780, 1070, 1440, 1920],
    subRewards: [
      { rd: 1, pos: 1 },
      { rd: 1, tkl: 1, foc: 1 },
      { rd: 2, pos: 1, mrk: 1 },
      { rd: 2, pos: 2, acc: 1 },
      { rd: 2, mrk: 2, foc: 1 },
      { rd: 2, pos: 2, tkl: 2 },
      { rd: 3, pos: 2, comp: 2 },
      { rd: 3, mrk: 2, tkl: 2, foc: 1 },
      { rd: 3, pos: 3, acc: 2, foc: 2 },
      { rd: 4, pos: 3, tkl: 2, comp: 2 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [18, 48, 98, 175, 280, 420, 600, 825, 1110, 1480],
    subRewards: [
      { blk: 1, pos: 1 },
      { blk: 1, pos: 1, tol: 1 },
      { blk: 2, pos: 1, str: 1 },
      { blk: 2, mrk: 1, tol: 1 },
      { blk: 2, pos: 2, str: 1 },
      { blk: 2, mrk: 2, comp: 1 },
      { blk: 3, pos: 2, str: 2 },
      { blk: 3, mrk: 2, tol: 2, comp: 1 },
      { blk: 3, pos: 3, str: 2, tol: 2 },
      { blk: 4, pos: 3, mrk: 3, comp: 2 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [32, 82, 165, 285, 450, 665, 940, 1290, 1740, 2320],
    subRewards: [
      { hd: 1, jmp: 1 },
      { hd: 1, str: 1, jmp: 1 },
      { hd: 2, str: 1, pos: 1 },
      { hd: 2, jmp: 2, str: 1 },
      { hd: 2, str: 2, comp: 1 },
      { hd: 2, jmp: 2, pos: 2 },
      { hd: 3, str: 2, jmp: 2 },
      { hd: 3, str: 3, comp: 2 },
      { hd: 3, jmp: 3, pos: 2, str: 2 },
      { hd: 4, jmp: 3, str: 3, comp: 2 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [42, 110, 220, 385, 610, 905, 1280, 1760, 2380, 3180],
    subRewards: [
      { sv: 1, rfx: 1 },
      { sv: 1, cl: 1, hnd: 1 },
      { sv: 2, rfx: 1, cl: 1 },
      { sv: 2, hnd: 2, pos: 1 },
      { sv: 2, cl: 2, comp: 1 },
      { sv: 2, rfx: 2, dist: 2 },
      { sv: 3, cl: 2, hnd: 2 },
      { sv: 3, rfx: 3, cl: 2, comp: 1 },
      { sv: 3, rfx: 3, hnd: 3, cl: 2 },
      { sv: 4, rfx: 3, cl: 3, comp: 2 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [6, 16, 33, 58, 92, 138, 198, 272, 365, 485],
    subRewards: [
      { pos: 1, comp: 1 },
      { pos: 1, comp: 1, rec: 1 },
      { pos: 2, comp: 1, mrk: 1 },
      { cl: 2, pos: 1, foc: 1 },
      { sv: 2, mrk: 2, comp: 1 },
      { pos: 2, cl: 2, foc: 2 },
      { sv: 2, mrk: 2, comp: 2 },
      { pos: 3, cl: 2, comp: 3 },
      { pos: 3, foc: 3, cl: 2, comp: 2 },
      { pos: 4, cl: 3, comp: 3, foc: 2 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [165, 425, 860, 1510, 2400, 3580, 5120, 7100, 9600, 12800],
    subRewards: [
      { dist: 1, spass: 1 },
      { dist: 1, lpass: 1, comp: 1 },
      { dist: 2, spass: 1, rd: 1 },
      { dist: 2, lpass: 2, comp: 1 },
      { dist: 2, vis: 2, rd: 1 },
      { dist: 2, lpass: 2, ctrl: 2 },
      { dist: 3, spass: 2, rd: 2 },
      { dist: 3, lpass: 2, comp: 2, vis: 1 },
      { dist: 3, lpass: 3, vis: 2, ctrl: 2 },
      { dist: 4, lpass: 3, vis: 3, comp: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
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
    targets: [12, 31, 62, 108, 172, 256, 365, 500, 675, 900],
    subRewards: [
      { comp: 1, sta: 1 },
      { comp: 1, det: 1, ldr: 1 },
      { comp: 2, sta: 1, rd: 1 },
      { comp: 2, str: 1, ldr: 2 },
      { comp: 2, sta: 2, foc: 1 },
      { comp: 2, det: 2, rec: 2 },
      { comp: 3, sta: 2, ldr: 2 },
      { comp: 3, sta: 3, rec: 2, det: 1 },
      { comp: 3, ldr: 3, det: 2, sta: 2 },
      { comp: 4, sta: 3, ldr: 3, rec: 2 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'mvp_form',
    icon: '⭐',
    name: 'ฟอร์มเทพสม่ำเสมอ',
    desc: 'โชว์ฟอร์มเด่นคว้าเรตติ้งหลังเกม 7.2 ขึ้นไปอย่างต่อเนื่อง',
    category: 'playmaking',
    metric: 'highRatings',
    unit: 'นัด',
    targets: [10, 25, 52, 92, 148, 222, 318, 440, 595, 790],
    subRewards: [
      { con: 1, comp: 1 },
      { con: 1, rd: 1, foc: 1 },
      { comp: 2, con: 1, rd: 1 },
      { con: 2, cur: 1, foc: 2 },
      { con: 2, comp: 2, rd: 1 },
      { con: 2, rd: 2, ctrl: 2 },
      { comp: 3, con: 2, foc: 2 },
      { comp: 3, con: 2, rd: 2, ctrl: 1 },
      { comp: 3, con: 3, foc: 2, ctrl: 2 },
      { con: 4, comp: 3, rd: 3, foc: 2 }
    ],
    coreReward: 'ps',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'motm_star',
    icon: '🌟',
    name: 'ซูเปอร์สตาร์แมนออฟเดอะแมตช์',
    desc: 'ระเบิดฟอร์มคว้ารางวัลนักเตะยอดเยี่ยมประจำนัด (MOTM)',
    category: 'attack',
    metric: 'motm',
    unit: 'ครั้ง',
    targets: [4, 10, 21, 38, 62, 94, 136, 190, 260, 350],
    subRewards: [
      { comp: 1, det: 1 },
      { comp: 1, agi: 1, ctrl: 1 },
      { comp: 2, ldr: 1, det: 1 },
      { comp: 2, cur: 2, agi: 1 },
      { comp: 2, spd: 1, ctrl: 2 },
      { comp: 2, drb: 2, foc: 2 },
      { comp: 3, agi: 2, ldr: 2 },
      { comp: 3, ctrl: 2, spd: 2, det: 1 },
      { comp: 3, drb: 3, ldr: 2, det: 2 },
      { comp: 4, ctrl: 3, spd: 2, ldr: 3 }
    ],
    coreReward: 'dr',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'fairplay_pro',
    icon: '🕊️',
    name: 'วินัยเหล็กไร้ใบเตือน',
    desc: 'ลงเล่นครบเกมอย่างใสสะอาดโดยไม่โดนใบเหลืองหรือใบแดง',
    category: 'physical',
    metric: 'cleanGames',
    unit: 'นัด',
    targets: [14, 36, 72, 126, 200, 298, 425, 585, 790, 1050],
    subRewards: [
      { foc: 1, con: 1 },
      { foc: 1, comp: 1, bal: 1 },
      { foc: 2, con: 1, rd: 1 },
      { foc: 2, tol: 1, rec: 1 },
      { foc: 2, comp: 2, bal: 1 },
      { foc: 2, con: 2, end: 2 },
      { foc: 3, comp: 2, tol: 2 },
      { foc: 3, con: 2, rec: 2, end: 1 },
      { foc: 3, comp: 3, bal: 2, tol: 2 },
      { foc: 4, con: 3, rec: 2, end: 2 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'ironman',
    icon: '💪',
    name: 'ปอดเหล็กความฟิต & ยืนระยะ',
    desc: 'ลงสนามแข่งขันและรักษาวินัยฝึกซ้อมอย่างสม่ำเสมอ',
    category: 'physical',
    metric: 'matches',
    unit: 'นัด',
    targets: [16, 42, 85, 148, 235, 350, 500, 690, 930, 1240],
    subRewards: [
      { sta: 1, tol: 1 },
      { sta: 1, rec: 1, end: 1 },
      { sta: 2, tol: 1, rec: 1 },
      { sta: 2, end: 2, str: 1 },
      { sta: 2, tol: 2, rec: 1 },
      { sta: 2, str: 2, end: 2 },
      { sta: 3, tol: 2, rec: 2 },
      { sta: 3, tol: 2, rec: 2, str: 2 },
      { sta: 3, end: 3, tol: 2, rec: 2 },
      { sta: 4, tol: 3, rec: 3, str: 2 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'brace_hero',
    icon: '💥',
    name: 'ยิงเบิ้ลสะท้านลีก',
    desc: 'ระเบิดฟอร์มยิงได้อย่างน้อย 2 ประตูขึ้นไปภายในเกมเดียว',
    category: 'attack',
    metric: 'braces',
    unit: 'นัด',
    targets: [2, 6, 13, 24, 39, 58, 84, 118, 162, 220],
    subRewards: [
      { fin: 1, comp: 1 },
      { fin: 1, pw: 1, run: 1 },
      { fin: 2, cur: 1, comp: 1 },
      { fin: 2, pw: 2, run: 1 },
      { fin: 2, cur: 2, comp: 2 },
      { fin: 3, pw: 2, run: 2 },
      { fin: 3, cur: 2, comp: 2 },
      { fin: 3, pw: 3, run: 2, comp: 2 },
      { fin: 4, pw: 3, cur: 2, comp: 2 },
      { fin: 4, pw: 3, run: 3, comp: 3 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF']
  },
  {
    id: 'clutch_finisher',
    icon: '⏱️',
    name: 'มัจจุราชท้ายเกม (75\'+)',
    desc: 'มีส่วนร่วมยิงประตูหรือแอสซิสต์ตัดสินเกมในช่วง 15 นาทีสุดท้าย (นาทีที่ 75 ขึ้นไป)',
    category: 'attack',
    metric: 'clutchActions',
    unit: 'ครั้ง',
    targets: [3, 8, 17, 30, 48, 72, 104, 145, 198, 265],
    subRewards: [
      { comp: 1, det: 1 },
      { comp: 1, run: 1, end: 1 },
      { comp: 2, fin: 1, foc: 1 },
      { comp: 2, end: 2, det: 1 },
      { comp: 2, fin: 2, foc: 2 },
      { comp: 3, det: 2, run: 2 },
      { comp: 3, fin: 2, end: 2 },
      { comp: 3, foc: 3, det: 2, run: 2 },
      { comp: 4, fin: 3, end: 2, det: 2 },
      { comp: 4, fin: 3, foc: 3, det: 3 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'df_goal_threat',
    icon: '🌋',
    name: 'กองหลังจอมพังประตู',
    desc: 'แนวรับขึ้นมาโขกลูกตั้งเตะหรือซัดไกลใส่สกอร์ช่วยทีม',
    category: 'attack',
    metric: 'goals',
    unit: 'ประตู',
    targets: [2, 6, 13, 24, 38, 56, 80, 112, 152, 205],
    subRewards: [
      { hd: 1, fin: 1 },
      { hd: 1, pw: 1, jmp: 1 },
      { fin: 2, lsh: 1, jmp: 1 },
      { hd: 2, pw: 2, comp: 1 },
      { fin: 2, lsh: 2, run: 1 },
      { hd: 3, pw: 2, jmp: 2 },
      { fin: 3, lsh: 2, comp: 2 },
      { hd: 3, pw: 3, jmp: 2, comp: 2 },
      { fin: 3, lsh: 3, hd: 3, run: 2 },
      { fin: 4, pw: 3, hd: 3, comp: 2 }
    ],
    coreReward: 'sh',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['DF']
  },
  {
    id: 'pressing_forward',
    icon: '🐺',
    name: 'กองหน้าสายเพรสซิ่ง',
    desc: 'ไล่บีบเพรสซิ่งตั้งแต่แดนหน้าและแย่งบอลกลับมาครองให้ทีม',
    category: 'defense',
    metric: 'tackles',
    unit: 'ครั้ง',
    targets: [16, 42, 86, 152, 242, 360, 515, 710, 960, 1280],
    subRewards: [
      { tkl: 1, sta: 1 },
      { tkl: 1, acc: 1, det: 1 },
      { tkl: 2, sta: 1, mrk: 1 },
      { tkl: 2, acc: 2, rd: 1 },
      { tkl: 2, sta: 2, det: 2 },
      { tkl: 3, rd: 2, acc: 2 },
      { tkl: 3, sta: 2, mrk: 2 },
      { tkl: 3, acc: 3, det: 2, rd: 2 },
      { tkl: 3, sta: 3, mrk: 3, det: 2 },
      { tkl: 4, sta: 3, acc: 3, det: 3 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['FW']
  },
  {
    id: 'clean_win_wall',
    icon: '🏰',
    name: 'กำแพงแกร่งชนะไร้เสีย',
    desc: 'ลงเล่นคุมจังหวะเกมรับพาทีมคว้าชัยชนะโดยไม่เสียประตูแม้แต่ลูกเดียว',
    category: 'defense',
    metric: 'cleanWins',
    unit: 'นัด',
    targets: [5, 14, 29, 50, 80, 120, 172, 238, 320, 425],
    subRewards: [
      { pos: 1, mrk: 1 },
      { pos: 1, tkl: 1, comp: 1 },
      { pos: 2, mrk: 1, foc: 1 },
      { pos: 2, tkl: 2, rd: 1 },
      { pos: 2, mrk: 2, comp: 2 },
      { pos: 3, tkl: 2, foc: 2 },
      { pos: 3, mrk: 2, blk: 2 },
      { pos: 3, tkl: 3, comp: 2, foc: 2 },
      { pos: 3, mrk: 3, rd: 2, comp: 2 },
      { pos: 4, mrk: 3, tkl: 3, comp: 3 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['DF', 'MF', 'GK']
  },
  {
    id: 'road_warrior',
    icon: '✈️',
    name: 'นักรบผู้พิชิตเกมเยือน',
    desc: 'บุกเก็บชัยชนะนอกรังในสภาพแวดล้อมที่กดดันได้อย่างยอดเยี่ยม',
    category: 'physical',
    metric: 'awayWins',
    unit: 'นัด',
    targets: [6, 16, 33, 58, 92, 138, 198, 274, 370, 495],
    subRewards: [
      { det: 1, end: 1 },
      { det: 1, comp: 1, sta: 1 },
      { comp: 2, end: 1, foc: 1 },
      { det: 2, sta: 2, tol: 1 },
      { comp: 2, end: 2, ldr: 1 },
      { det: 3, foc: 2, rec: 2 },
      { comp: 3, sta: 2, ldr: 2 },
      { det: 3, end: 3, foc: 2, tol: 2 },
      { comp: 3, ldr: 3, rec: 2, det: 2 },
      { comp: 4, end: 3, ldr: 3, det: 3 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1]
  },
  {
    id: 'gk_guardian',
    icon: '🦁',
    name: 'นายด่านผู้พิทักษ์ชัยชนะ',
    desc: 'ยืนเฝ้าเสาเป็นด่านสุดท้ายช่วยทีมคว้า 3 แต้มและชนะในเกมสำคัญ',
    category: 'gk',
    metric: 'wins',
    unit: 'นัด',
    targets: [12, 31, 62, 108, 172, 256, 365, 500, 675, 900],
    subRewards: [
      { cl: 1, comp: 1 },
      { cl: 1, sv: 1, ldr: 1 },
      { cl: 2, rfx: 1, comp: 1 },
      { sv: 2, hnd: 2, ldr: 1 },
      { cl: 2, comp: 2, foc: 1 },
      { sv: 2, rfx: 2, ldr: 2 },
      { cl: 3, hnd: 2, foc: 2 },
      { sv: 3, rfx: 2, comp: 2, ldr: 2 },
      { cl: 3, hnd: 3, foc: 2, comp: 2 },
      { sv: 4, cl: 3, rfx: 3, ldr: 3 }
    ],
    coreReward: 'tk',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['GK']
  },
  {
    id: 'gk_consistency',
    icon: '💎',
    name: 'มือกาวฟอร์มเทพคงเส้นคงวา',
    desc: 'รักษามาตรฐานการเฝ้าเสาคว้าเรตติ้ง 7.2 ขึ้นไปอย่างต่อเนื่องทุกฤดูกาล',
    category: 'gk',
    metric: 'highRatings',
    unit: 'นัด',
    targets: [10, 25, 52, 92, 148, 222, 318, 440, 595, 790],
    subRewards: [
      { con: 1, rfx: 1 },
      { con: 1, hnd: 1, foc: 1 },
      { con: 2, sv: 1, comp: 1 },
      { con: 2, rfx: 2, foc: 1 },
      { con: 2, hnd: 2, dist: 1 },
      { con: 3, sv: 2, comp: 2 },
      { con: 3, rfx: 2, foc: 2 },
      { con: 3, hnd: 3, dist: 2, comp: 2 },
      { con: 4, sv: 3, rfx: 2, foc: 2 },
      { con: 4, hnd: 3, comp: 3, dist: 3 }
    ],
    coreReward: 'ph',
    coreRewards: [0, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    posFilter: ['GK']
  }
];

export const ensurePlayerMissions = (q: Player, careerP?: PlayerCareerProfile | null): PlayerMissionsState => {
  const src = (q.me && careerP?.missions) || q.missions;
  let seasonLog: Record<number, MissionSeasonRecord> | undefined;
  if (src?.seasonLog) {
    seasonLog = {};
    Object.entries(src.seasonLog).forEach(([k, rec]) => {
      if (!rec) return;
      const sNum = Number(k);
      seasonLog![sNum] = {
        season: rec.season ?? sNum,
        ...(rec.teamName ? { teamName: rec.teamName } : {}),
        metrics: { ...(rec.metrics || {}) },
        passed: { ...(rec.passed || {}) },
        failed: { ...(rec.failed || {}) },
        endStage: { ...(rec.endStage || {}) }
      };
    });
  }
  let seasonPlans: Record<number, string[]> | undefined;
  if (src?.seasonPlans) {
    seasonPlans = {};
    Object.entries(src.seasonPlans).forEach(([k, arr]) => {
      if (Array.isArray(arr)) seasonPlans![Number(k)] = [...arr];
    });
  }
  return {
    stats: { ...(src?.stats || {}) },
    claimed: { ...(src?.claimed || {}) },
    outcomes: src?.outcomes ? { ...src.outcomes } : {},
    recentLogs: src?.recentLogs ? [...src.recentLogs] : [],
    ...(src?.focusId ? { focusId: src.focusId } : {}),
    ...(seasonLog ? { seasonLog } : {}),
    ...(seasonPlans ? { seasonPlans } : {})
  };
};

const ensureSeasonRec = (
  mState: PlayerMissionsState,
  season: number,
  teamName?: string,
  maxSeasonsToKeep = 25
): MissionSeasonRecord => {
  const sInt = Math.max(1, Math.floor(season || 1));
  if (!mState.seasonLog) mState.seasonLog = {};
  let rec = mState.seasonLog[sInt];
  if (!rec) {
    rec = {
      season: sInt,
      ...(teamName ? { teamName } : {}),
      metrics: {},
      passed: {},
      failed: {},
      endStage: {}
    };
    mState.seasonLog[sInt] = rec;
    const keys = Object.keys(mState.seasonLog).map(Number).sort((a, b) => a - b);
    while (keys.length > maxSeasonsToKeep) {
      const oldest = keys.shift();
      if (oldest != null && oldest !== sInt) delete mState.seasonLog[oldest];
    }
  } else if (teamName && !rec.teamName) {
    rec.teamName = teamName;
  }
  return rec;
};

const recordSeasonMetric = (
  mState: PlayerMissionsState,
  season: number | undefined,
  metric: PersonalMissionMetric,
  delta: number,
  teamName?: string,
  maxSeasonsToKeep = 25
) => {
  if (!season || delta <= 0) return;
  const rec = ensureSeasonRec(mState, season, teamName, maxSeasonsToKeep);
  rec.metrics[metric] = (rec.metrics[metric] || 0) + delta;
};

const recordSeasonStageAttempt = (
  mState: PlayerMissionsState,
  season: number | undefined,
  missionId: string,
  passed: boolean,
  newStage: number,
  teamName?: string,
  maxSeasonsToKeep = 25
) => {
  if (!season) return;
  const rec = ensureSeasonRec(mState, season, teamName, maxSeasonsToKeep);
  if (passed) {
    rec.passed[missionId] = (rec.passed[missionId] || 0) + 1;
  } else {
    rec.failed[missionId] = (rec.failed[missionId] || 0) + 1;
  }
  rec.endStage[missionId] = Math.max(rec.endStage[missionId] || 0, newStage);
};

export const initPlayerSeasonMissions = (
  q: Player,
  season: number,
  teamName?: string,
  careerP?: PlayerCareerProfile | null,
  state?: Pick<GameState, 'tr' | 'staff' | 'analyticsLv'> | null
) => {
  const sInt = Math.max(1, Math.floor(season || 1));
  const mState = ensurePlayerMissions(q, careerP);
  const rec = ensureSeasonRec(mState, sInt, teamName, q.me ? 30 : 10);
  PERSONAL_MISSIONS.forEach((def) => {
    const st = mState.claimed[def.id] || 0;
    if (st > 0) rec.endStage[def.id] = Math.max(rec.endStage[def.id] || 0, st);
  });
  if (!mState.seasonPlans || !Object.prototype.hasOwnProperty.call(mState.seasonPlans, sInt)) {
    const autoPicks = computeRecommendedMissionIds(q, careerP, state, 3);
    if (autoPicks.length > 0) {
      mState.seasonPlans = { ...(mState.seasonPlans || {}), [sInt]: autoPicks };
    }
  }
  q.missions = mState;
  if (careerP) careerP.missions = mState;
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

  // Harder progression curve across 10 stages, uncapped until declining phase
  let chance = 14 + talent * 0.32 - stage * 4.4;
  if (stage >= 7) chance -= (stage - 6) * 2.0;
  if (age <= 21) chance += 3;
  if (devProf.phase === 'peak') chance -= 3;
  else if (devProf.phase === 'declining') chance -= 18;
  if (devProf.strongSeason) chance += 4;

  if (curOv >= 75) {
    chance -= Math.max(0, curOv - 75) * 1.2;
  }

  if (isProdigy) chance += 5;
  if (state?.tr) chance += Math.max(0, state.tr - 1) * 0.45;
  if (state?.staff?.asst) chance += state.staff.asst * 0.5;
  if (state?.analyticsLv && state.analyticsLv > 1) chance += (state.analyticsLv - 1) * 0.35;

  return clamp(Math.round(chance), 4, 60);
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
  s?: GameState | null,
  teamName?: string
): MissionResolveSummary => {
  const summary: MissionResolveSummary = { upgraded: [], failed: [] };
  const mState = ensurePlayerMissions(q, careerP);
  const outcomes = { ...(mState.outcomes || {}) };
  const recentLogs = [...(mState.recentLogs || [])];
  const curSeason = s?.season ?? 1;
  const maxSeasonsKeep = q.me || teamName ? 25 : 6;
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
        recordSeasonStageAttempt(mState, curSeason, def.id, true, stage + 1, teamName, maxSeasonsKeep);
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
          md: s ? (s.md ?? 0) + 1 : undefined,
          season: curSeason
        });
        stage++;
      } else {
        // Setback on failure: keep stage retryable and step metric progress back to 70%
        mState.claimed[def.id] = stage;
        mState.stats[def.metric] = Math.floor(target * 0.70);
        recordSeasonStageAttempt(mState, curSeason, def.id, false, stage, teamName, maxSeasonsKeep);
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
          md: s ? (s.md ?? 0) + 1 : undefined,
          season: curSeason
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
    recordSeasonStageAttempt(mState, s.season ?? 1, def.id, true, stage + 1, targetTeam?.name, 25);
    const rewardStr = applyStageRewardToPlayer(q, careerP, def, stage, s);
    recentLogs.unshift({
      missionId: def.id,
      missionName: def.name,
      icon: def.icon,
      stage: stage + 1,
      success: true,
      chance,
      rewardText: rewardStr,
      md: (s.md ?? 0) + 1,
      season: s.season ?? 1
    });
    msg = `${def.icon} ${q.n} ผ่าน "${def.name} (ขั้น ${stage + 1}/${def.targets.length})"! (โอกาส ${chance}%) · ${rewardStr}`;
  } else {
    mState.claimed[def.id] = stage;
    const resetVal = Math.floor(target * 0.70);
    mState.stats[def.metric] = resetVal;
    recordSeasonStageAttempt(mState, s.season ?? 1, def.id, false, stage, targetTeam?.name, 25);
    recentLogs.unshift({
      missionId: def.id,
      missionName: def.name,
      icon: def.icon,
      stage: stage + 1,
      success: false,
      chance,
      md: (s.md ?? 0) + 1,
      season: s.season ?? 1
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
  careerP?: PlayerCareerProfile | null,
  season?: number,
  teamName?: string,
  maxSeasonsToKeep = 25
) => {
  if (rawDelta <= 0) return;
  const mState = ensurePlayerMissions(q, careerP);
  mState.stats[metric] = (mState.stats[metric] || 0) + rawDelta;
  recordSeasonMetric(mState, season, metric, rawDelta, teamName, maxSeasonsToKeep);
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
    state?: Pick<GameState, 'tr' | 'staff' | 'analyticsLv' | 'season'> | null;
    teamName?: string;
    isUserSide?: boolean;
  }
): { notes: string[]; summary: MissionResolveSummary } => {
  const notes: string[] = [];
  const mState = ensurePlayerMissions(q, opts.careerP);
  const mult = opts.isTeamFocus ? 1.4 : 1;
  const season = opts.state?.season;
  const maxSeasonsKeep = opts.isUserSide || q.me ? 25 : 6;

  // Measured training drill contributions so missions scale cleanly across 10 stages
  const addSimultaneous = (metric: PersonalMissionMetric, base: number, label?: string) => {
    if (base <= 0) return;
    const total = Math.max(1, Math.round(base * mult));
    mState.stats[metric] = (mState.stats[metric] || 0) + total;
    recordSeasonMetric(mState, season, metric, total, opts.teamName, maxSeasonsKeep);
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
      if (opts.teamProgram === 'defense' || Math.random() < 0.35) addSimultaneous('tackles', 1);
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
  const summary = resolvePlayerMissions(
    q,
    opts.careerP || null,
    (opts.state as GameState | null) || null,
    opts.teamName
  );
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
  isAwayTeam: boolean,
  payload: MatchMissionPayload,
  trackForUser: boolean,
  combined: MissionResolveSummary
) => {
  const isCleanSheet = oppGoals === 0;
  const playedList = new Set(payload.playedNames?.[team.id] || xi(team).map((q) => q.n));
  const actionsMap = payload.playerActions || {};
  const cardSet = new Set((payload.cards || []).map((c) => c.who));

  const curSeason = s.season ?? 1;
  const maxSeasonsKeep = team.id === s.me ? 25 : 6;

  team.sq.forEach((q) => {
    const careerP = q.me && s.p ? s.p : null;
    if (q.me && payload.pf && payload.pf.played === false) return;
    if (!playedList.has(q.n) && !actionsMap[q.n]) return;

    const keepN = q.me ? 30 : maxSeasonsKeep;
    addMissionStat(q, 'matches', 1, careerP, curSeason, team.name, keepN);
    if (isWin) addMissionStat(q, 'wins', 1, careerP, curSeason, team.name, keepN);
    if (isWin && isCleanSheet) addMissionStat(q, 'cleanWins', 1, careerP, curSeason, team.name, keepN);
    if (isWin && isAwayTeam) addMissionStat(q, 'awayWins', 1, careerP, curSeason, team.name, keepN);
    if (isCleanSheet && (q.pos === 'GK' || q.pos === 'DF')) {
      addMissionStat(q, 'cleanSheets', 1, careerP, curSeason, team.name, keepN);
    }
    if (!cardSet.has(q.n)) {
      addMissionStat(q, 'cleanGames', 1, careerP, curSeason, team.name, keepN);
    }

    const rt = q.me && payload.pf?.rt ? payload.pf.rt : payload.ratings?.[q.n] || 0;
    if (rt >= 7.2) addMissionStat(q, 'highRatings', 1, careerP, curSeason, team.name, keepN);
    if (payload.motm && payload.motm === q.n) {
      addMissionStat(q, 'motm', 1, careerP, curSeason, team.name, keepN);
    }

    const goals = payload.evs.filter((e) => !e.og && e.t === team.id && e.who === q.n).length;
    const assists = payload.evs.filter((e) => !e.og && e.t === team.id && e.as === q.n).length;
    if (goals > 0) addMissionStat(q, 'goals', goals, careerP, curSeason, team.name, keepN);
    if (goals >= 2) addMissionStat(q, 'braces', 1, careerP, curSeason, team.name, keepN);
    if (assists > 0) addMissionStat(q, 'assists', assists, careerP, curSeason, team.name, keepN);

    const clutchCount = payload.evs.filter(
      (e) => !e.og && e.t === team.id && e.m >= 75 && (e.who === q.n || e.as === q.n)
    ).length;
    if (clutchCount > 0) addMissionStat(q, 'clutchActions', clutchCount, careerP, curSeason, team.name, keepN);

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
          metric !== 'cleanGames' &&
          metric !== 'braces' &&
          metric !== 'clutchActions' &&
          metric !== 'cleanWins' &&
          metric !== 'awayWins'
        ) {
          addMissionStat(q, metric, val, careerP, curSeason, team.name, keepN);
        }
      });
      if (acts.keyPasses == null && assists > 0) {
        addMissionStat(q, 'keyPasses', assists, careerP, curSeason, team.name, keepN);
      }
    } else {
      // Estimation fallback for AI & instant matches (balanced parity with user match actions)
      if (q.pos === 'GK') {
        addMissionStat(q, 'saves', R(2, 6), careerP, curSeason, team.name, keepN);
        addMissionStat(q, 'passes', R(12, 22), careerP, curSeason, team.name, keepN);
      } else {
        addMissionStat(q, 'passes', q.pos === 'MF' ? R(20, 38) : q.pos === 'DF' ? R(15, 28) : R(10, 20), careerP, curSeason, team.name, keepN);
        addMissionStat(q, 'dribbles', q.pos === 'FW' || q.pos === 'MF' ? R(2, 5) : R(1, 3), careerP, curSeason, team.name, keepN);
        if (q.pos === 'FW' || q.pos === 'MF') {
          const sh = Math.max(goals * 2 + (q.pos === 'FW' ? R(1, 3) : R(0, 3)), 0);
          if (sh > 0) {
            addMissionStat(q, 'shots', sh, careerP, curSeason, team.name, keepN);
            addMissionStat(q, 'onTarget', Math.max(goals, Math.round(sh * 0.5)), careerP, curSeason, team.name, keepN);
          }
        } else if (q.pos === 'DF') {
          const dfSh = goals > 0 ? Math.max(1, goals) : Math.random() < 0.38 ? 1 : 0;
          if (dfSh > 0) addMissionStat(q, 'shots', dfSh, careerP, curSeason, team.name, keepN);
        }
        if (assists > 0) addMissionStat(q, 'crossAssists', assists * 2 + 1, careerP, curSeason, team.name, keepN);
        else if (q.pos === 'MF' || q.pos === 'DF') addMissionStat(q, 'crossAssists', R(1, 3), careerP, curSeason, team.name, keepN);

        const kp =
          (q.pos === 'MF' ? R(1, 3) : q.pos === 'FW' ? R(0, 2) : R(0, 1)) + assists;
        if (kp > 0) addMissionStat(q, 'keyPasses', kp, careerP, curSeason, team.name, keepN);

        if (q.pos === 'DF' || q.pos === 'MF') {
          addMissionStat(q, 'tackles', q.pos === 'DF' ? R(3, 6) : R(2, 4), careerP, curSeason, team.name, keepN);
          addMissionStat(q, 'interceptions', q.pos === 'DF' ? R(1, 4) : R(1, 3), careerP, curSeason, team.name, keepN);
          addMissionStat(q, 'blocks', q.pos === 'DF' ? R(0, 2) : R(0, 1), careerP, curSeason, team.name, keepN);
        } else if (q.pos === 'FW') {
          addMissionStat(q, 'tackles', R(0, 2), careerP, curSeason, team.name, keepN);
        }
        addMissionStat(q, 'headers', q.pos === 'DF' || q.pos === 'FW' ? R(1, 3) : R(0, 2), careerP, curSeason, team.name, keepN);
        if (q.pos === 'MF' || q.pos === 'FW' || q.pos === 'DF') {
          addMissionStat(q, 'setpieces', q.pos === 'DF' ? R(0, 1) : R(0, 2), careerP, curSeason, team.name, keepN);
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
    const res = resolvePlayerMissions(q, careerP, aiVirtualState, team.name);
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
  if (H.id !== s.me) applyTeamMatchMissions(s, H, res.gh, res.ga, hWin, false, res, false, dummyCombined);
  if (A.id !== s.me) applyTeamMatchMissions(s, A, res.ga, res.gh, aWin, true, res, false, dummyCombined);
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

  applyTeamMatchMissions(s, H, payload.gh, payload.ga, hWin, false, payload, H.id === s.me, combined);
  applyTeamMatchMissions(s, A, payload.ga, payload.gh, aWin, true, payload, A.id === s.me, combined);

  if (s.mode === 'p' && s.p) syncMe(s);
  return combined;
};

export const getMissionTrainingHint = (def: PersonalMissionDef): string => {
  switch (def.metric) {
    case 'setpieces':
      return 'ซ้อมโปรแกรมลูกตั้งเตะ และตั้งให้เป็นมือสังหารฟรีคิก/เตะมุม';
    case 'passes':
      return 'ซ้อมโปรแกรมแท็กติก · เน้นครองบอลและส่งสั้น';
    case 'shots':
    case 'onTarget':
    case 'goals':
    case 'braces':
      return 'ซ้อมโปรแกรมเกมรุก · ดันแผนบุก/เพรสซิ่งสูง';
    case 'clutchActions':
      return 'ลงเล่นครบ 90 นาทีในเกมสูสี · เก็บพลังกายให้พร้อมช่วงท้ายเกม';
    case 'crossAssists':
    case 'assists':
    case 'keyPasses':
      return 'ซ้อมแท็กติกหรือเกมรุก · เล่นเกมกว้างเปิดป้อนจากริมเส้น';
    case 'dribbles':
      return 'ซ้อมฟิตเนส/ลูกตั้งเตะ · เพิ่มความคล่องตัวและพื้นที่พาบอล';
    case 'tackles':
    case 'interceptions':
    case 'blocks':
    case 'cleanWins':
      return 'ซ้อมโปรแกรมเกมรับ · ตั้งรับแน่นหรือเพรสซิ่งตัดบอล';
    case 'headers':
      return 'ซ้อมเกมรับ/ลูกตั้งเตะ · มีส่วนร่วมจังหวะเตะมุมทั้งรุกและรับ';
    case 'saves':
    case 'cleanSheets':
      return 'ซ้อมเกมรับ (ผู้รักษาประตู) · รักษาความฟิตลงเฝ้าเสาสม่ำเสมอ';
    case 'awayWins':
      return 'วางแผนโรเตชั่นเก็บความฟิตให้เต็มก่อนบุกเยือน';
    case 'highRatings':
    case 'motm':
      return 'รักษาความฟิต 85%+ · โหมดอาชีพแนะนำดูวิดีโอเพิ่มเรตติ้งก่อนแข่ง';
    case 'cleanGames':
      return 'ลดจังหวะเข้าปะทะรุนแรงเมื่อมีใบเหลืองติดตัว';
    case 'wins':
    case 'matches':
    default:
      return 'ลงสนามสม่ำเสมอทุกถ้วยทั้งลีก บอลถ้วย และถ้วยเอเชีย';
  }
};

const ROLE_MISSION_PRIORITY: Record<Position, string[]> = {
  FW: ['goalscorer', 'finishing', 'assist_king', 'dribbler', 'sharpshooter', 'pressing_forward', 'motm_star'],
  MF: ['passing', 'playmaker', 'key_creator', 'dribbler', 'intercept_master', 'assist_king', 'mvp_form'],
  DF: ['defender', 'intercept_master', 'aerial', 'clean_win_wall', 'shotblocker', 'df_goal_threat', 'gk_clean'],
  GK: ['goalkeeper', 'gk_clean', 'gk_guardian', 'gk_sweeper', 'gk_consistency', 'ironman', 'winner']
};

export const computeRecommendedMissionIds = (
  q: Player,
  careerP?: PlayerCareerProfile | null,
  state?: Pick<GameState, 'tr' | 'staff' | 'analyticsLv'> | null,
  count = 3
): string[] => {
  const { items } = getPlayerMissionView(q, careerP, state);
  const roleOrder = ROLE_MISSION_PRIORITY[q.pos] || ROLE_MISSION_PRIORITY.MF;
  const scored = items
    .filter((x) => !x.completedAll)
    .map((x) => {
      const roleIdx = roleOrder.indexOf(x.def.id);
      const roleBonus = roleIdx >= 0 ? (roleOrder.length - roleIdx) * 4 : x.def.posFilter ? 6 : 0;
      const score =
        x.pct * 1.4 +
        roleBonus +
        (x.maxStage - x.stage) * 1.2 +
        x.successChance * 0.2;
      return { item: x, score };
    })
    .sort((a, b) => b.score - a.score);

  const picks: string[] = [];
  const usedCats = new Set<string>();
  // First pass: encourage distinct categories across the 3 slots
  for (const { item } of scored) {
    if (picks.length >= count) break;
    const cat = item.def.category || 'physical';
    if (!usedCats.has(cat)) {
      picks.push(item.def.id);
      usedCats.add(cat);
    }
  }
  // Fill any remaining slots in priority score order
  for (const { item } of scored) {
    if (picks.length >= count) break;
    if (!picks.includes(item.def.id)) picks.push(item.def.id);
  }
  return picks;
};

export const toggleMissionSeasonPlan = (
  q: Player,
  season: number,
  missionId: string,
  careerP?: PlayerCareerProfile | null,
  state?: Pick<GameState, 'tr' | 'staff' | 'analyticsLv'> | null
): { pinned: boolean; count: number; maxReached?: boolean } => {
  const sInt = Math.max(1, Math.floor(season || 1));
  const mState = ensurePlayerMissions(q, careerP);
  const plans = { ...(mState.seasonPlans || {}) };
  const hasExplicit = Object.prototype.hasOwnProperty.call(plans, sInt);
  const curList = hasExplicit
    ? [...(plans[sInt] || [])]
    : computeRecommendedMissionIds(q, careerP, state, 3);
  const idx = curList.indexOf(missionId);
  let pinned = false;
  if (idx >= 0) {
    curList.splice(idx, 1);
  } else {
    if (curList.length >= 6) {
      return { pinned: false, count: curList.length, maxReached: true };
    }
    curList.push(missionId);
    pinned = true;
  }
  plans[sInt] = curList;
  mState.seasonPlans = plans;
  q.missions = mState;
  if (careerP) careerP.missions = mState;
  return { pinned, count: curList.length };
};

export const autoPlanSeasonMissions = (
  q: Player,
  season: number,
  careerP?: PlayerCareerProfile | null,
  state?: Pick<GameState, 'tr' | 'staff' | 'analyticsLv'> | null
): string[] => {
  const sInt = Math.max(1, Math.floor(season || 1));
  const mState = ensurePlayerMissions(q, careerP);
  const picks = computeRecommendedMissionIds(q, careerP, state, 3);
  mState.seasonPlans = { ...(mState.seasonPlans || {}), [sInt]: picks };
  q.missions = mState;
  if (careerP) careerP.missions = mState;
  return picks;
};

export interface SeasonMissionEntry {
  def: PersonalMissionDef;
  isEligible: boolean;
  stage: number;
  maxStage: number;
  completedAll: boolean;
  target: number;
  curVal: number;
  pct: number;
  neededForNext: number;
  seasonEarned: number;
  seasonPassed: number;
  seasonFailed: number;
  seasonEndStage: number;
  pacePerMatch: number;
  estMatchesLeft: number | null;
  onTrackThisSeason: boolean;
  isPlanned: boolean;
  successChance: number;
  trainingHint: string;
}

export interface SeasonOfMissionsView {
  curSeason: number;
  selectedSeason: number;
  availableSeasons: number[];
  remainingMatches: number;
  playedInSelectedSeason: number;
  plannedIds: string[];
  isAutoPlanned: boolean;
  entries: SeasonMissionEntry[];
  seasonSummary: {
    totalPassed: number;
    totalFailed: number;
    totalEarnedActions: number;
    eligibleCount: number;
    totalCount: number;
    plannedCount: number;
    plannedOnTrackCount: number;
    teamName?: string;
  };
  getCellForSeason: (
    missionId: string,
    metric: PersonalMissionMetric,
    seasonNum: number
  ) => { earned: number; passed: number; failed: number; endStage: number };
}

export const getSeasonOfMissionsView = (
  q: Player,
  careerP?: PlayerCareerProfile | null,
  state?: GameState | null,
  requestedSeason?: number
): SeasonOfMissionsView => {
  const mState = ensurePlayerMissions(q, careerP);
  const curSeason = state?.season ?? 1;
  const seasonSet = new Set<number>([curSeason]);
  for (let i = 1; i <= curSeason; i++) seasonSet.add(i);
  if (mState.seasonLog) {
    Object.keys(mState.seasonLog).forEach((k) => {
      const n = Number(k);
      if (n >= 1) seasonSet.add(n);
    });
  }
  if (mState.seasonPlans) {
    Object.keys(mState.seasonPlans).forEach((k) => {
      const n = Number(k);
      if (n >= 1) seasonSet.add(n);
    });
  }
  const histSrc = (q.me && careerP?.history) || q.history || [];
  histSrc.forEach((h) => {
    if (h.season >= 1) seasonSet.add(h.season);
  });

  const availableSeasons = Array.from(seasonSet).sort((a, b) => a - b);
  const selectedSeason =
    requestedSeason != null && seasonSet.has(requestedSeason) ? requestedSeason : curSeason;

  const hasAnySeasonLog = Boolean(mState.seasonLog && Object.keys(mState.seasonLog).length > 0);
  const legacyFallbackSeason = !hasAnySeasonLog && selectedSeason === 1;
  const selRec = mState.seasonLog?.[selectedSeason];

  const totalLeagueMd = state?.fx?.length || 30;
  const curMd = state?.md || 0;
  const remainingMatches = selectedSeason === curSeason ? Math.max(0, totalLeagueMd - curMd) : 0;

  const histRow = histSrc.find((h) => h.season === selectedSeason);
  const playedInSelectedSeason =
    selectedSeason === curSeason
      ? Math.max(q.sp || 0, curMd > 0 ? curMd : 0)
      : histRow?.sp ?? selRec?.metrics.matches ?? 0;

  const hasExplicitPlan = Boolean(
    mState.seasonPlans && Object.prototype.hasOwnProperty.call(mState.seasonPlans, selectedSeason)
  );
  const shouldAutoPick = !hasExplicitPlan && selectedSeason >= curSeason;
  const isAutoPlanned = shouldAutoPick;
  const plannedIds = hasExplicitPlan
    ? mState.seasonPlans![selectedSeason] || []
    : shouldAutoPick
      ? computeRecommendedMissionIds(q, careerP, state, 3)
      : [];

  const entries: SeasonMissionEntry[] = PERSONAL_MISSIONS.map((def) => {
    const isEligible = !def.posFilter || def.posFilter.includes(q.pos);
    const stage = clamp(mState.claimed[def.id] || 0, 0, def.targets.length);
    const maxStage = def.targets.length;
    const completedAll = stage >= maxStage;
    const target = def.targets[Math.min(stage, maxStage - 1)];
    const curVal = mState.stats[def.metric] || 0;
    const pct = completedAll ? 100 : clamp(Math.round((curVal / Math.max(1, target)) * 100), 0, 100);
    const neededForNext = completedAll ? 0 : Math.max(0, target - curVal);

    const seasonEarned = selRec
      ? selRec.metrics[def.metric] || 0
      : legacyFallbackSeason
        ? curVal
        : 0;
    const seasonPassed = selRec
      ? selRec.passed[def.id] || 0
      : legacyFallbackSeason
        ? stage
        : 0;
    const seasonFailed = selRec
      ? selRec.failed[def.id] || 0
      : legacyFallbackSeason
        ? (mState.outcomes?.[def.id] || []).filter((o) => o === 'fail').length
        : 0;
    const seasonEndStage = selRec?.endStage[def.id] ?? (legacyFallbackSeason ? stage : 0);

    const pacePerMatch =
      playedInSelectedSeason > 0 ? Math.round((seasonEarned / playedInSelectedSeason) * 100) / 100 : 0;
    const estMatchesLeft =
      !completedAll && neededForNext > 0 && pacePerMatch > 0
        ? Math.ceil(neededForNext / pacePerMatch)
        : null;
    const onTrackThisSeason =
      selectedSeason === curSeason &&
      !completedAll &&
      (neededForNext === 0 || (estMatchesLeft != null && estMatchesLeft <= remainingMatches));

    const isPlanned = plannedIds.includes(def.id);
    const successChance = completedAll ? 0 : calcMissionSuccessChance(q, careerP, def, stage, state);

    return {
      def,
      isEligible,
      stage,
      maxStage,
      completedAll,
      target,
      curVal,
      pct,
      neededForNext,
      seasonEarned,
      seasonPassed,
      seasonFailed,
      seasonEndStage,
      pacePerMatch,
      estMatchesLeft,
      onTrackThisSeason,
      isPlanned,
      successChance,
      trainingHint: getMissionTrainingHint(def)
    };
  });

  const totalPassed = entries.reduce((sum, e) => sum + e.seasonPassed, 0);
  const totalFailed = entries.reduce((sum, e) => sum + e.seasonFailed, 0);
  const totalEarnedActions = entries.reduce((sum, e) => sum + (e.isEligible ? e.seasonEarned : 0), 0);
  const eligibleCount = entries.filter((e) => e.isEligible).length;
  const plannedEntries = entries.filter((e) => e.isPlanned);

  const getCellForSeason = (missionId: string, metric: PersonalMissionMetric, seasonNum: number) => {
    const rec = mState.seasonLog?.[seasonNum];
    if (rec) {
      return {
        earned: rec.metrics[metric] || 0,
        passed: rec.passed[missionId] || 0,
        failed: rec.failed[missionId] || 0,
        endStage: rec.endStage[missionId] || 0
      };
    }
    if (!hasAnySeasonLog && seasonNum === 1) {
      return {
        earned: mState.stats[metric] || 0,
        passed: mState.claimed[missionId] || 0,
        failed: (mState.outcomes?.[missionId] || []).filter((o) => o === 'fail').length,
        endStage: mState.claimed[missionId] || 0
      };
    }
    return { earned: 0, passed: 0, failed: 0, endStage: 0 };
  };

  return {
    curSeason,
    selectedSeason,
    availableSeasons,
    remainingMatches,
    playedInSelectedSeason,
    plannedIds,
    isAutoPlanned,
    entries,
    seasonSummary: {
      totalPassed,
      totalFailed,
      totalEarnedActions,
      eligibleCount,
      totalCount: PERSONAL_MISSIONS.length,
      plannedCount: plannedEntries.length,
      plannedOnTrackCount: plannedEntries.filter((e) => e.onTrackThisSeason || e.completedAll).length,
      teamName: selRec?.teamName || histRow?.teamName
    },
    getCellForSeason
  };
};
