import type {
  GameState,
  MatchCardEvent,
  MatchEnvironment,
  Player,
  PlayerCareerProfile,
  TalkDialogueLog,
  TalkTopicId,
  Team,
  TeamTalkId,
  WellbeingFactor
} from '../types/game';
import { PLAYER_PERSONALITIES, getTeamTrainingPlan } from '../data/thaiFootballData';
import { clamp, R } from '../utils/math';

export const GOOD_MENTAL_THRESHOLD = 72;
export const GOOD_PHYS_THRESHOLD = 72;
export const MAX_MGR_CARE_ACTIONS_PER_TURN = 3;
export const FAV_SWITCH_COOLDOWN_TURNS = 3;

export const WELLBEING_FACTOR_GUIDE = {
  mentalGood: [
    'ได้ลงเล่นตัวจริง / ลงสนามตรงบทบาทในสัญญา',
    'ทีมชนะต่อเนื่อง ฟอร์มส่วนตัวดี (เรตติ้ง ≥ 7.4 / MOTM)',
    'ได้รับความไว้วางใจ (เป็นลูกรัก / กัปตัน / โฟกัสซ้อม)',
    'ขวัญกำลังใจสโมสรสูง มีโบนัสอัดฉีด และได้พูดคุยดูแลจิตใจ',
    'บุคลิกใจเย็น มุ่งมั่น มืออาชีพ และข่าวดีจากชีวิตส่วนตัว/แฟนบอล'
  ],
  mentalBad: [
    'ตัวหลักถูกดองเป็นสำรอง ไม่ค่อยได้รับโอกาสลงสนาม',
    'ทีมแพ้ติดต่อกัน ฟอร์มตก โดนใบแดง หรือทำเข้าประตูตัวเอง',
    'ความกดดันของลูกรัก (ฟอร์ม < 6.4 / โดนดร็อป) หรือเพื่อนอิจฉา',
    'อาการบาดเจ็บเรื้อรัง ถูกขึ้นบัญชีขาย สัญญาใกล้หมด หรือถูกปลดลูกรัก',
    'ซ้อมหนักต่อเนื่องโดยไม่ได้พักผ่อน หรือมีเรื่องกังวลส่วนตัว/คิดถึงบ้าน'
  ],
  physGood: [
    'ความฟิตสะสมสูง (≥ 75%) และไม่บาดเจ็บ',
    'ใช้โปรแกรมซ้อมฟื้นฟู / สลับพักรายบุคคล / เปลี่ยนตัวออกพักทันเวลา',
    'ศูนย์การแพทย์ ทีมกายภาพ สนามหญ้า และระบบเดินทางระดับสูง',
    'อายุยังน้อยหรือช่วงพีค มีค่าฟื้นตัวเร็วและทนทานอาการบาดเจ็บสูง',
    'การนอนหลับ โภชนาการ และการนวดคลายกล้ามเนื้อหลังเกมสมบูรณ์'
  ],
  physBad: [
    'กำลังบาดเจ็บ หรือเพิ่งฟื้นตัวกลับมาลงสนาม',
    'ความฟิตต่ำ (< 65%) หรือกรำศึกเต็ม 90 นาทีติดกันหลายนัด',
    'ลูกรักปลุกพลังทุ่มเทเกินร้อยต่อเนื่องโดยไม่โรเตชั่นพัก',
    'ซ้อมหนักเกินไป (Heavy) หรือสภาพอากาศ/สนามหนัก (ฝน/แดดจัด)',
    'อายุมาก (32+ ปี) ร่างกายเปราะบาง หรือป่วยไข้/กล้ามเนื้อตึง'
  ]
} as const;

const POSITIVE_LIFE_EVENTS: { label: string; delta: number }[] = [
  { label: 'ได้รับเสียงเชียร์อบอุ่นจากแฟนบอล', delta: 5 },
  { label: 'บรรยากาศห้องแต่งตัวเฮฮาเป็นกันเอง', delta: 4 },
  { label: 'ครอบครัว/คนใกล้ชิดส่งกำลังใจให้เต็มที่', delta: 6 },
  { label: 'ซ้อมเข้าขาเพื่อนร่วมทีมอย่างมั่นใจ', delta: 4 },
  { label: 'หลับสบาย พักผ่อนทางใจเต็มอิ่ม', delta: 4 }
];

const NEGATIVE_LIFE_EVENTS: { label: string; delta: number }[] = [
  { label: 'นอนไม่ค่อยหลับ มีเรื่องกังวลเล็กน้อย', delta: -5 },
  { label: 'กดดันจากเสียงวิจารณ์บนโซเชียล', delta: -6 },
  { label: 'คิดถึงบ้าน / อารมณ์อ่อนไหวส่วนตัว', delta: -6 },
  { label: 'หงุดหงิดจังหวะการเล่นของตัวเอง', delta: -4 },
  { label: 'ความเครียดสะสมจากความคาดหวัง', delta: -5 }
];

const POSITIVE_BODY_EVENTS: { label: string; delta: number }[] = [
  { label: 'กล้ามเนื้อสดและยืดหยุ่นดีเป็นพิเศษ', delta: 5 },
  { label: 'โภชนาการและการฟื้นตัวหลังซ้อมลงตัว', delta: 4 },
  { label: 'หลับลึก ร่างกายตอบสนองการฟื้นฟูดีมาก', delta: 5 }
];

const NEGATIVE_BODY_EVENTS: { label: string; delta: number }[] = [
  { label: 'กล้ามเนื้อตึงเล็กน้อยหลังการซ้อม', delta: -6 },
  { label: 'เป็นหวัดเล็กน้อย / ภูมิคุ้มกันตกชั่วคราว', delta: -7 },
  { label: 'ปวดเมื่อยข้อเท้าจากการปะทะสะสม', delta: -5 },
  { label: 'พักผ่อนน้อย / ร่างกายขาดน้ำเล็กน้อย', delta: -5 }
];

export function resolvePersonalityId(q: Player, careerP?: PlayerCareerProfile | null): number {
  const custom = q.me ? careerP?.customPers ?? q.customPers : q.customPers;
  if (custom != null && custom >= 0 && custom < PLAYER_PERSONALITIES.length) {
    return custom;
  }
  const nm = q.n || 'นักเตะ';
  let h = 0;
  for (let i = 0; i < nm.length; i++) h += nm.charCodeAt(i);
  return h % PLAYER_PERSONALITIES.length;
}

const isResilientPersonality = (tr: number) =>
  tr === 0 || tr === 4 || tr === 6 || tr === 9 || tr === 14 || tr === 16 || tr === 17 || tr === 21 || tr === 23;

const isVolatilePersonality = (tr: number) =>
  tr === 1 || tr === 5 || tr === 7 || tr === 15 || tr === 19 || tr === 22;

const bellRoll = (min: number, max: number): number => {
  const span = max - min;
  const half = Math.floor(span / 2);
  const rem = span - half;
  return min + R(0, half) + R(0, rem);
};

export function rollFavoriteBoost(mental: number, phys: number): number {
  const avg = (mental + phys) / 2;
  if (avg >= 90) return PWeighted([7, 8, 8, 9, 9, 10]);
  if (avg >= 82) return PWeighted([6, 6, 7, 7, 8, 9]);
  return PWeighted([5, 5, 6, 6, 7]);
}

function PWeighted(arr: number[]): number {
  return arr[R(0, arr.length - 1)];
}

export function getPlayerMentalScore(q: Player, careerP?: PlayerCareerProfile | null): number {
  const val = q.me && careerP?.mental != null ? careerP.mental : q.mental;
  return clamp(Math.round(val ?? 68), 0, 100);
}

export function getPlayerPhysScore(q: Player, careerP?: PlayerCareerProfile | null): number {
  const raw = q.me && careerP?.phys != null ? careerP.phys : q.phys;
  if (raw != null) return clamp(Math.round(raw), 0, 100);
  return clamp(Math.round(q.inj > 0 ? 35 : (q.fit ?? 85)), 0, 100);
}

export function isPlayerMentalGood(q: Player, careerP?: PlayerCareerProfile | null): boolean {
  return getPlayerMentalScore(q, careerP) >= GOOD_MENTAL_THRESHOLD;
}

export function isPlayerPhysGood(q: Player, careerP?: PlayerCareerProfile | null): boolean {
  const inj = q.me && careerP?.inj != null ? careerP.inj : q.inj || 0;
  const sus = q.me && careerP?.sus != null ? careerP.sus : q.sus || 0;
  return inj === 0 && sus === 0 && getPlayerPhysScore(q, careerP) >= GOOD_PHYS_THRESHOLD;
}

export function getActiveFavBoost(
  q: Player,
  team?: Team | null,
  careerP?: PlayerCareerProfile | null
): number {
  if (team && team.favPlayer !== q.n) return 0;
  const rawBoost = q.me && careerP?.favBoost != null ? careerP.favBoost : q.favBoost || 0;
  if (rawBoost < 5) return 0;
  if (!isPlayerMentalGood(q, careerP) || !isPlayerPhysGood(q, careerP)) return 0;
  return clamp(Math.round(rawBoost), 5, 10);
}

export function getWellbeingOvrAdjustment(
  q: Player,
  careerP?: PlayerCareerProfile | null
): number {
  if (q.mental == null && q.phys == null && careerP?.mental == null && careerP?.phys == null) return 0;
  const m = getPlayerMentalScore(q, careerP);
  const p = getPlayerPhysScore(q, careerP);
  let adj = 0;
  if (m < 38) adj -= 2;
  else if (m < 50) adj -= 1;
  if (p < 38) adj -= 2;
  else if (p < 50) adj -= 1;
  return clamp(adj, -3, 0);
}

export function getTeamCareQuotaInfo(
  state: GameState,
  team?: Team | null
): { limit: number; used: number; remaining: number } {
  const t = team || state.teams[state.me];
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  if (state.mode === 'p') {
    const mePl = t?.sq?.find((q) => q.me);
    const tUsed = (state.p?.careTalkMd ?? mePl?.careTalkMd) === curTurn ? 1 : 0;
    const pUsed = (state.p?.carePhysMd ?? mePl?.carePhysMd) === curTurn ? 1 : 0;
    const used = tUsed + pUsed;
    return { limit: 2, used, remaining: Math.max(0, 2 - used) };
  }
  const used = (t?.sq || []).reduce(
    (sum, q) => sum + (q.careTalkMd === curTurn ? 1 : 0) + (q.carePhysMd === curTurn ? 1 : 0),
    0
  );
  return {
    limit: MAX_MGR_CARE_ACTIONS_PER_TURN,
    used,
    remaining: Math.max(0, MAX_MGR_CARE_ACTIONS_PER_TURN - used)
  };
}

export function getFavSwitchCooldownRemaining(
  state: GameState,
  team?: Team | null
): number {
  if (state.mode !== 'm') return 0;
  const t = team || state.teams[state.me];
  if (!t || t.favChangedTurn == null) return 0;
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  if (curTurn < t.favChangedTurn) return 0; // new season resets relative matchday counter cleanly
  const elapsed = curTurn - t.favChangedTurn;
  return Math.max(0, FAV_SWITCH_COOLDOWN_TURNS - elapsed);
}

export function getWellbeingTierMeta(score: number, kind: 'mental' | 'phys', injured = false): {
  label: string;
  short: string;
  good: boolean;
  tone: 'great' | 'good' | 'mid' | 'warn' | 'bad';
  txtCls: string;
  badgeCls: string;
  barColor: string;
} {
  const v = clamp(Math.round(score), 0, 100);
  if (kind === 'phys' && injured) {
    return {
      label: 'บาดเจ็บ',
      short: 'เจ็บ',
      good: false,
      tone: 'bad',
      txtCls: 'text-[var(--red)]',
      badgeCls: 'bg-[var(--red-soft)] border-[var(--red)]/40 text-[var(--red)]',
      barColor: '#ef4444'
    };
  }
  if (v >= 85) {
    return {
      label: kind === 'mental' ? 'จิตใจดีเยี่ยม' : 'ร่างกายสมบูรณ์',
      short: kind === 'mental' ? 'ดีเยี่ยม' : 'สมบูรณ์',
      good: true,
      tone: 'great',
      txtCls: 'text-emerald-600 dark:text-emerald-400',
      badgeCls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
      barColor: '#10b981'
    };
  }
  if (v >= GOOD_MENTAL_THRESHOLD) {
    return {
      label: kind === 'mental' ? 'จิตใจดี' : 'ร่างกายดี',
      short: 'ดี',
      good: true,
      tone: 'good',
      txtCls: 'text-[var(--g)]',
      badgeCls: 'bg-[var(--g-soft)] border-[var(--g)]/35 text-[var(--g)]',
      barColor: '#22c55e'
    };
  }
  if (v >= 55) {
    return {
      label: kind === 'mental' ? 'ทรงตัว' : 'ล้าเล็กน้อย',
      short: kind === 'mental' ? 'ปกติ' : 'ล้าเบาๆ',
      good: false,
      tone: 'mid',
      txtCls: 'text-sky-600 dark:text-sky-400',
      badgeCls: 'bg-sky-500/12 border-sky-500/35 text-sky-700 dark:text-sky-300',
      barColor: '#0ea5e9'
    };
  }
  if (v >= 40) {
    return {
      label: kind === 'mental' ? 'เครียด/นอยด์' : 'อ่อนล้า',
      short: kind === 'mental' ? 'เครียด' : 'อ่อนล้า',
      good: false,
      tone: 'warn',
      txtCls: 'text-amber-700 dark:text-[var(--lamp)]',
      badgeCls: 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45 text-amber-800 dark:text-[var(--lamp)]',
      barColor: '#f59e0b'
    };
  }
  return {
    label: kind === 'mental' ? 'จิตใจย่ำแย่' : 'ทรุดโทรม',
    short: 'แย่',
    good: false,
    tone: 'bad',
    txtCls: 'text-[var(--red)]',
    badgeCls: 'bg-[var(--red-soft)] border-[var(--red)]/40 text-[var(--red)]',
    barColor: '#ef4444'
  };
}

export function initPlayerWellbeing(
  q: Player,
  opts?: { team?: Team | null; careerP?: PlayerCareerProfile | null; force?: boolean }
) {
  if (!opts?.force && q.mental != null && q.phys != null) return;
  const tr = resolvePersonalityId(q, opts?.careerP);
  const age = q.age || 24;
  const fit = clamp(Math.round(q.fit ?? 100), 15, 100);
  const inj = q.inj || 0;

  // Realistic initial mental health distribution (typically 48..92, not uniform 100)
  const mFactors: WellbeingFactor[] = [];
  let mental = bellRoll(54, 84);
  if (isResilientPersonality(tr)) {
    const b = R(5, 9);
    mental += b;
    mFactors.push({ label: `บุคลิก${PLAYER_PERSONALITIES[tr]?.name || 'นิ่ง'}`, delta: b });
  } else if (isVolatilePersonality(tr)) {
    const d = -R(4, 8);
    mental += d;
    mFactors.push({ label: `บุคลิก${PLAYER_PERSONALITIES[tr]?.name || 'อ่อนไหว'}`, delta: d });
  }
  if (age >= 24 && age <= 30) {
    mental += 3;
    mFactors.push({ label: 'วัยวุฒิช่วงพีก คุมอารมณ์ได้ดี', delta: 3 });
  } else if (age <= 18) {
    const youngMood = R(-5, 4);
    mental += youngMood;
    if (youngMood !== 0) {
      mFactors.push({
        label: youngMood > 0 ? 'ดาวรุ่งไฟแรงกระหายลงเล่น' : 'ดาวรุ่งยังปรับตัวกับความกดดัน',
        delta: youngMood
      });
    }
  }
  if (q.con?.role === 'key' && q.ov >= 68) {
    mental += 4;
    mFactors.push({ label: 'มั่นใจในบทบาทตัวหลัก', delta: 4 });
  }
  if (q.listed) {
    mental -= 10;
    mFactors.push({ label: 'ถูกขึ้นบัญชีขาย', delta: -10 });
  }
  if (inj > 0) {
    mental -= 10;
    mFactors.push({ label: 'กังวลอาการบาดเจ็บ', delta: -10 });
  }
  if (opts?.team?.favPlayer === q.n) {
    mental += 5;
    mFactors.push({ label: 'ได้รับความไว้วางใจเป็นลูกรัก', delta: 5 });
  }

  // Realistic initial physical health distribution (typically 52..95)
  const pFactors: WellbeingFactor[] = [];
  let phys = bellRoll(62, 90);
  const fitShift = Math.round((fit - 85) * 0.45);
  if (fitShift !== 0) {
    phys += fitShift;
    pFactors.push({ label: fit >= 85 ? 'ความฟิตพื้นฐานดี' : 'ความฟิตยังไม่เต็มร้อย', delta: fitShift });
  }
  if (tr === 18 || tr === 23) {
    phys += 6;
    pFactors.push({ label: 'พื้นฐานร่างกายอึดทนทาน', delta: 6 });
  } else if (tr === 19) {
    phys -= 7;
    pFactors.push({ label: 'สภาพร่างกายค่อนข้างเปราะบาง', delta: -7 });
  }
  if (age <= 22) {
    phys += 4;
    pFactors.push({ label: 'วัยหนุ่มฟื้นตัวไว', delta: 4 });
  } else if (age >= 32) {
    const ageDrop = -clamp(age - 30, 2, 7);
    phys += ageDrop;
    pFactors.push({ label: 'อายุมากขึ้น ร่างกายล้าเร็ว', delta: ageDrop });
  }
  const lifeRoll = R(-5, 5);
  if (lifeRoll >= 4) {
    const ev = POSITIVE_BODY_EVENTS[R(0, POSITIVE_BODY_EVENTS.length - 1)];
    phys += ev.delta;
    pFactors.push(ev);
  } else if (lifeRoll <= -4) {
    const ev = NEGATIVE_BODY_EVENTS[R(0, NEGATIVE_BODY_EVENTS.length - 1)];
    phys += ev.delta;
    pFactors.push(ev);
  }
  if (inj > 0) {
    phys = Math.min(phys - 25, R(22, 42));
    pFactors.push({ label: `บาดเจ็บพัก ${inj} นัด`, delta: -25 });
  }

  q.mental = clamp(Math.round(mental), 25, 96);
  q.phys = clamp(Math.round(phys), 18, 97);
  q.mentalFactors = mFactors.slice(0, 5);
  q.physFactors = pFactors.slice(0, 5);
  q.mentalNote = mFactors[0]?.label || 'สภาพจิตใจตามรอบประเมินล่าสุด';
  q.physNote = pFactors[0]?.label || 'สภาพร่างกายตามรอบประเมินล่าสุด';

  if (q.me && opts?.careerP) {
    opts.careerP.mental = q.mental;
    opts.careerP.phys = q.phys;
    opts.careerP.mentalFactors = q.mentalFactors;
    opts.careerP.physFactors = q.physFactors;
    opts.careerP.mentalNote = q.mentalNote;
    opts.careerP.physNote = q.physNote;
  }
}

export function ensurePlayerWellbeing(
  q: Player,
  opts?: { team?: Team | null; state?: GameState | null }
) {
  const careerP = q.me ? opts?.state?.p : null;
  if (q.mental == null || q.phys == null) {
    initPlayerWellbeing(q, { team: opts?.team, careerP });
  }
  if (q.me && careerP) {
    if (careerP.mental == null) careerP.mental = q.mental;
    else q.mental = careerP.mental;
    if (careerP.phys == null) careerP.phys = q.phys;
    else q.phys = careerP.phys;
    if (careerP.favBoost != null) q.favBoost = careerP.favBoost;
    else if (q.favBoost != null) careerP.favBoost = q.favBoost;
  }
  if (opts?.team) {
    if (opts.team.favPlayer === q.n) {
      if (isPlayerMentalGood(q, careerP) && isPlayerPhysGood(q, careerP)) {
        if (!q.favBoost || q.favBoost < 5 || q.favBoost > 10) {
          q.favBoost = rollFavoriteBoost(getPlayerMentalScore(q, careerP), getPlayerPhysScore(q, careerP));
        }
      } else {
        q.favBoost = 0;
      }
    } else if (q.favBoost) {
      q.favBoost = 0;
    }
    if (q.me && careerP) careerP.favBoost = q.favBoost || 0;
  }
}

export function ensureTeamWellbeing(team: Team, state?: GameState | null) {
  if (!team?.sq?.length) return;
  if (team.favPlayer && !team.sq.some((q) => q.n === team.favPlayer)) {
    delete team.favPlayer;
  }
  team.sq.forEach((q) => ensurePlayerWellbeing(q, { team, state }));
  if (!team.favPlayer) {
    refreshAiTeamFavoritePlayer(team, state);
  }
}

export function syncFavoritePlayerBoost(
  team: Team,
  state?: GameState | null,
  forceReroll = false
): number {
  if (!team?.sq?.length) return 0;
  let activeBoost = 0;
  team.sq.forEach((q) => {
    ensurePlayerWellbeing(q, { team, state });
    const careerP = q.me ? state?.p : null;
    if (team.favPlayer && q.n === team.favPlayer) {
      const mGood = isPlayerMentalGood(q, careerP);
      const pGood = isPlayerPhysGood(q, careerP);
      if (mGood && pGood) {
        if (forceReroll || !q.favBoost || q.favBoost < 5 || q.favBoost > 10) {
          q.favBoost = rollFavoriteBoost(
            getPlayerMentalScore(q, careerP),
            getPlayerPhysScore(q, careerP)
          );
        }
        activeBoost = q.favBoost;
      } else {
        q.favBoost = 0;
      }
    } else {
      q.favBoost = 0;
    }
    if (q.me && careerP) {
      careerP.favBoost = q.favBoost || 0;
    }
  });
  return activeBoost;
}

export function setTeamFavoritePlayer(
  state: GameState,
  team: Team,
  playerName: string | null
): {
  changed: boolean;
  favName: string | null;
  boost: number;
  mentalGood: boolean;
  physGood: boolean;
  cooldownRemaining: number;
} {
  ensureTeamWellbeing(team, state);
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  const prevFavName = team.favPlayer || null;
  if (prevFavName === playerName) {
    const curPl = playerName ? team.sq.find((q) => q.n === playerName) : null;
    const cp = curPl?.me ? state.p : null;
    const boost = curPl ? getActiveFavBoost(curPl, team, cp) : 0;
    return {
      changed: false,
      favName: prevFavName,
      boost,
      mentalGood: curPl ? isPlayerMentalGood(curPl, cp) : false,
      physGood: curPl ? isPlayerPhysGood(curPl, cp) : false,
      cooldownRemaining: getFavSwitchCooldownRemaining(state, team)
    };
  }

  // Enforce switch cooldown when appointing a favorite in Manager mode
  const cdLeft = playerName ? getFavSwitchCooldownRemaining(state, team) : 0;
  if (playerName && cdLeft > 0) {
    const curPl = prevFavName ? team.sq.find((q) => q.n === prevFavName) : null;
    const cp = curPl?.me ? state.p : null;
    return {
      changed: false,
      favName: prevFavName,
      boost: curPl ? getActiveFavBoost(curPl, team, cp) : 0,
      mentalGood: curPl ? isPlayerMentalGood(curPl, cp) : false,
      physGood: curPl ? isPlayerPhysGood(curPl, cp) : false,
      cooldownRemaining: cdLeft
    };
  }

  if (prevFavName) {
    const oldPl = team.sq.find((q) => q.n === prevFavName);
    if (oldPl) {
      oldPl.favBoost = 0;
      const drop = -R(6, 10);
      oldPl.mental = clamp((oldPl.mental ?? 68) + drop, 15, 100);
      oldPl.mentalFactors = [{ label: 'ถูกปลดจากตำแหน่งลูกรักโค้ช', delta: drop }, ...(oldPl.mentalFactors || [])].slice(0, 5);
      oldPl.mentalNote = 'ถูกปลดจากตำแหน่งลูกรักโค้ช';
      if (oldPl.me && state.p) {
        state.p.mental = oldPl.mental;
        state.p.mentalFactors = oldPl.mentalFactors;
        state.p.mentalNote = oldPl.mentalNote;
        state.p.favBoost = 0;
      }
    }
  }

  if (!playerName) {
    delete team.favPlayer;
    team.favChangedTurn = curTurn;
    syncFavoritePlayerBoost(team, state, false);
    return {
      changed: true,
      favName: null,
      boost: 0,
      mentalGood: false,
      physGood: false,
      cooldownRemaining: FAV_SWITCH_COOLDOWN_TURNS
    };
  }

  const nextPl = team.sq.find((q) => q.n === playerName);
  if (!nextPl) {
    delete team.favPlayer;
    syncFavoritePlayerBoost(team, state, false);
    return { changed: true, favName: null, boost: 0, mentalGood: false, physGood: false, cooldownRemaining: 0 };
  }

  team.favPlayer = nextPl.n;
  team.favChangedTurn = curTurn;
  const gain = 4;
  nextPl.mental = clamp((nextPl.mental ?? 68) + gain, 15, 100);
  nextPl.mentalFactors = [{ label: 'โค้ชแต่งตั้งเป็นลูกรักประจำทีม', delta: gain }, ...(nextPl.mentalFactors || [])].slice(0, 5);
  nextPl.mentalNote = 'โค้ชแต่งตั้งเป็นลูกรักประจำทีม';
  if (nextPl.me && state.p) {
    state.p.mental = nextPl.mental;
    state.p.mentalFactors = nextPl.mentalFactors;
    state.p.mentalNote = nextPl.mentalNote;
  }

  const boost = syncFavoritePlayerBoost(team, state, true);
  const cp = nextPl.me ? state.p : null;
  return {
    changed: true,
    favName: nextPl.n,
    boost,
    mentalGood: isPlayerMentalGood(nextPl, cp),
    physGood: isPlayerPhysGood(nextPl, cp),
    cooldownRemaining: FAV_SWITCH_COOLDOWN_TURNS
  };
}

export function refreshAiTeamFavoritePlayer(team: Team, state?: GameState | null) {
  if (!team?.sq?.length) return;
  const curTurn = state ? (state.season ?? 1) * 100 + (state.md ?? 0) : 0;
  const curFav = team.favPlayer ? team.sq.find((q) => q.n === team.favPlayer) : null;
  // Keep current favorite unless missing, severely injured, or performing poorly (and respect cooldown)
  const onCooldown =
    curFav &&
    team.favChangedTurn != null &&
    curTurn >= team.favChangedTurn &&
    curTurn - team.favChangedTurn < FAV_SWITCH_COOLDOWN_TURNS;
  if (
    curFav &&
    (onCooldown || (curFav.inj < 3 && ((curFav.sra || 0) < 3 || curFav.srs! / Math.max(1, curFav.sra!) >= 6.45)))
  ) {
    syncFavoritePlayerBoost(team, state, false);
    return;
  }
  const available = team.sq.filter((q) => q.inj === 0 && (q.sus || 0) === 0);
  const pool = available.length > 0 ? available : team.sq;
  const candidates = pool
    .slice()
    .sort((a, b) => {
      const aAvg = (a.sra || 0) > 0 ? (a.srs || 0) / Math.max(1, a.sra!) : 6.6;
      const bAvg = (b.sra || 0) > 0 ? (b.srs || 0) / Math.max(1, b.sra!) : 6.6;
      const aWellbeing = ((a.mental ?? 70) + (a.phys ?? 75)) * 0.05;
      const bWellbeing = ((b.mental ?? 70) + (b.phys ?? 75)) * 0.05;
      const aScore = a.ov + aAvg * 4 + aWellbeing + (a.me ? 2 : 0) + (a.hg ? 2 : 0) + (team.cap === a.n ? 2 : 0);
      const bScore = b.ov + bAvg * 4 + bWellbeing + (b.me ? 2 : 0) + (b.hg ? 2 : 0) + (team.cap === b.n ? 2 : 0);
      return bScore - aScore;
    });
  if (candidates[0]) {
    const prevFavName = team.favPlayer;
    if (prevFavName !== candidates[0].n && state) {
      team.favChangedTurn = curTurn;
      if (prevFavName && curTurn > 0) {
        candidates[0].mental = clamp((candidates[0].mental ?? 68) + 4, 18, 99);
        candidates[0].mentalFactors = [
          { label: 'ฟอร์มเข้าตา ระบบยกเป็นลูกรักประจำทีม', delta: 4 },
          ...(candidates[0].mentalFactors || [])
        ].slice(0, 5);
        candidates[0].mentalNote = 'ฟอร์มเข้าตา ระบบยกเป็นลูกรักประจำทีม';
        if (candidates[0].me && state.p) {
          state.p.mental = candidates[0].mental;
          state.p.mentalFactors = candidates[0].mentalFactors;
          state.p.mentalNote = candidates[0].mentalNote;
        }
      }
    }
    team.favPlayer = candidates[0].n;
    syncFavoritePlayerBoost(team, state, true);
  }
}

export interface MatchdayWellbeingCtx {
  matchPlayed?: boolean;
  matchResult?: 'W' | 'D' | 'L';
  goalDiff?: number;
  isBigMatch?: boolean;
  matchEnv?: MatchEnvironment;
  ratings?: Record<string, number>;
  playedNames?: string[];
  motm?: string;
  cards?: MatchCardEvent[];
  ownGoalNames?: string[];
  subbedOut?: Record<string, number>;
  isUserClub?: boolean;
}

export function updateTeamWellbeingAfterMatchday(
  team: Team,
  state: GameState,
  ctx?: MatchdayWellbeingCtx
) {
  if (!team?.sq?.length) return;
  ensureTeamWellbeing(team, state);
  const isUserClub = Boolean(ctx?.isUserClub ?? team.id === state.me);
  const isMgrUser = isUserClub && state.mode === 'm';
  const plan = isMgrUser ? state.trainingPlan : undefined;
  const indFocus = plan?.individualFocus || {};
  const playedSet = new Set(ctx?.playedNames || []);
  const ogSet = new Set(ctx?.ownGoalNames || []);
  const cardByPlayer = new Map<string, ('Y' | 'Y2R' | 'R')[]>();
  (ctx?.cards || []).forEach((c) => {
    if (c.t !== team.id) return;
    const arr = cardByPlayer.get(c.who) || [];
    arr.push(c.type);
    cardByPlayer.set(c.who, arr);
  });

  const medLv = isMgrUser ? clamp(state.med ?? 1, 0, 10) : [2, 4, 6][team.tier] ?? 3;
  const physioLv = isMgrUser ? clamp(state.staff?.physio ?? 0, 0, 5) : [1, 2, 3][team.tier] ?? 1;
  const travelLv = isMgrUser ? clamp(state.travelLv ?? 1, 0, 10) : [2, 3, 5][team.tier] ?? 2;
  const medCond = isMgrUser ? (state.facCond?.med ?? 100) : 85;
  const turfCond = isMgrUser ? (state.facCond?.turfLv ?? 100) : 85;
  const clubMor = isUserClub ? (state.mor ?? 55) : 55;

  const curFavPlayer = team.favPlayer ? team.sq.find((q) => q.n === team.favPlayer) : null;
  const favAvgRt = curFavPlayer && (curFavPlayer.sra || 0) > 0 ? (curFavPlayer.srs || 0) / Math.max(1, curFavPlayer.sra!) : 6.8;
  const teamTopOv = team.sq.reduce((mx, x) => Math.max(mx, x.ov), 0);
  const favUndeserving = Boolean(
    curFavPlayer &&
    ((curFavPlayer.sra || 0) >= 2 && favAvgRt < 6.45 || curFavPlayer.ov < teamTopOv - 6)
  );
  let jealousyTriggeredCount = 0;

  team.sq.forEach((q) => {
    const careerP = q.me ? state.p : null;
    const tr = resolvePersonalityId(q, careerP);
    const resilient = isResilientPersonality(tr);
    const volatile = isVolatilePersonality(tr);
    const curMental = getPlayerMentalScore(q, careerP);
    const curPhys = getPlayerPhysScore(q, careerP);
    const mFactors: WellbeingFactor[] = [];
    const pFactors: WellbeingFactor[] = [];
    let mDelta = 0;
    let pDelta = 0;

    const addM = (label: string, delta: number) => {
      if (!delta) return;
      mDelta += delta;
      mFactors.push({ label, delta });
    };
    const addP = (label: string, delta: number) => {
      if (!delta) return;
      pDelta += delta;
      pFactors.push({ label, delta });
    };

    const played = playedSet.has(q.n);
    const role = q.con?.role || (q.ov >= 72 ? 'key' : 'rot');
    const rt = ctx?.ratings?.[q.n];
    const subOutMin = ctx?.subbedOut?.[q.n];
    const pCards = cardByPlayer.get(q.n) || [];

    // --- 1. Playing time & Role expectation ---
    if (ctx?.matchPlayed) {
      if (played) {
        addM('ได้ลงสนามช่วยทีม', role === 'key' ? 3 : 4);
      } else if ((q.inj || 0) === 0 && (q.sus || 0) === 0) {
        if (role === 'key') addM('ตัวหลักไม่ได้ลงสนาม (อึดอัด)', -5);
        else if (role === 'rot') addM('นั่งสำรองไม่ได้ลงเล่น', -2);
        else addM('รอโอกาสลงสนาม', -1);
      }
    }

    // --- 2. Match Result & Club Morale ---
    if (ctx?.matchResult === 'W') {
      const gd = ctx.goalDiff ?? 1;
      addM(gd >= 2 ? 'ทีมชนะขาด บรรยากาศคึกคัก' : 'ทีมคว้าชัยชนะได้สำเร็จ', gd >= 2 ? 5 : 4);
    } else if (ctx?.matchResult === 'D') {
      addM('ทีมแบ่งแต้มเสมอ', 1);
    } else if (ctx?.matchResult === 'L') {
      const gd = Math.abs(ctx.goalDiff ?? 1);
      addM(gd >= 2 ? 'ทีมพ่ายแพ้ขาด เสียความมั่นใจ' : 'ผิดหวังจากความพ่ายแพ้', gd >= 2 ? -6 : -4);
    }

    if (isUserClub) {
      if (clubMor >= 76) addM('ขวัญกำลังใจสโมสรยอดเยี่ยม', 2);
      else if (clubMor <= 36) addM('บรรยากาศทีมตึงเครียด', -3);
      if ((state.winBonus ?? 0) >= 10 && ctx?.matchResult === 'W') {
        addM('ได้โบนัสอัดฉีดชัยชนะ', 2);
      }
    }

    // --- 3. Individual Match Rating / MOTM / Cards / Own Goal ---
    if (ctx?.motm && ctx.motm === q.n) {
      addM('คว้าแมนออฟเดอะแมตช์ (MOTM)', 6);
    } else if (rt != null) {
      if (rt >= 7.6) addM(`ฟอร์มเด่นเรตติ้ง ${rt.toFixed(1)}`, 4);
      else if (rt >= 7.0) addM(`เล่นได้ตามมาตรฐาน (${rt.toFixed(1)})`, 1);
      else if (rt < 6.0) addM(`ฟอร์มตกเรตติ้ง ${rt.toFixed(1)}`, -4);
    }
    if (pCards.includes('R') || pCards.includes('Y2R')) {
      addM('โดนใบแดงไล่ออกจากสนาม', -7);
    }
    if (ogSet.has(q.n)) {
      addM('ทำเข้าประตูตัวเอง เสียความมั่นใจ', -6);
    }

    // --- 4. Status / Trust / Pressure / Jealousy / Contract ---
    if (team.favPlayer === q.n) {
      if (ctx?.matchPlayed && played && rt != null && rt < 6.4) {
        addM('ความกดดันในฐานะลูกรัก (ฟอร์มต่ำกว่าคาด)', -5);
      } else if (ctx?.matchPlayed && !played && (q.inj || 0) === 0 && (q.sus || 0) === 0) {
        addM('ลูกรักถูกดร็อปสำรอง สื่อเริ่มตั้งคำถาม', -4);
      } else {
        addM('ได้รับความไว้ใจในฐานะลูกรัก', 2);
      }
    } else if (
      curFavPlayer &&
      favUndeserving &&
      jealousyTriggeredCount < 2 &&
      q.ov >= curFavPlayer.ov &&
      (volatile || !played) &&
      Math.random() < 0.45
    ) {
      jealousyTriggeredCount++;
      addM('น้อยใจโค้ชที่โอ๋ลูกรักเกินไป', -3);
    }

    if (team.cap === q.n) {
      addM('ความภาคภูมิใจกัปตันทีม', 1);
    }
    if (isMgrUser && state.focusPlayer === q.n) {
      addM('โค้ชติวเข้มดูแลใกล้ชิด', 2);
    }
    if ((q.inj || 0) > 0) {
      addM('เครียดจากอาการบาดเจ็บ', -4);
    }
    if (q.listed) {
      addM('ถูกสโมสรขึ้นบัญชีขาย', -6);
    }
    if (!q.loan && (q.con?.yr ?? 2) <= 1) {
      addM('กังวลอนาคต (สัญญาใกล้หมด)', -2);
    }

    // --- 5. Training Program & Rest ---
    if (isMgrUser && plan) {
      if (indFocus[q.n] === 'REST' || plan.program === 'recovery') {
        addM('ได้พักผ่อนคลายความตึงเครียด', 3);
      } else if (plan.intensity === 'heavy' && (q.fit ?? 100) < 66) {
        addM('ซ้อมหนักจนเครียดสะสม', -3);
      }
    }

    // --- 6. Realistic Random Psychological / Life Events ---
    const lifeChance = volatile ? 0.34 : 0.22;
    if (Math.random() < lifeChance) {
      const posProb =
        (ctx?.matchResult === 'W' ? 0.64 : ctx?.matchResult === 'L' ? 0.34 : 0.48) +
        (resilient ? 0.12 : volatile ? -0.1 : 0);
      if (Math.random() < posProb) {
        const ev = POSITIVE_LIFE_EVENTS[R(0, POSITIVE_LIFE_EVENTS.length - 1)];
        addM(ev.label, ev.delta);
      } else {
        const ev = NEGATIVE_LIFE_EVENTS[R(0, NEGATIVE_LIFE_EVENTS.length - 1)];
        const scaled = resilient ? Math.ceil(ev.delta * 0.5) : volatile ? Math.round(ev.delta * 1.25) : ev.delta;
        addM(ev.label, scaled);
      }
    }

    // Natural mean-reversion & peak cool-off
    if (curMental < 62 && resilient) {
      addM('คุมสติและฟื้นกำลังใจตัวเองได้เร็ว', 3);
    } else if (curMental >= 88 && mDelta <= 1) {
      mDelta -= 2;
    } else if (curMental >= 80 && mDelta <= 0) {
      mDelta -= 1;
    }

    // ==================== PHYSICAL HEALTH ====================
    const fit = clamp(Math.round(q.fit ?? 100), 15, 100);
    if ((q.inj || 0) > 0) {
      addP(`บาดเจ็บพักฟื้น (${q.inj} นัด)`, -10);
    } else {
      if (fit >= 86) addP('ความฟิตสะสมเต็มถัง', 4);
      else if (fit >= 74) addP('ความฟิตอยู่ในเกณฑ์ดี', 2);
      else if (fit < 60) addP('ร่างกายอ่อนล้าสะสม', -6);
      else if (fit < 70) addP('ความฟิตค่อนข้างตึง', -2);

      if (ctx?.matchPlayed && played) {
        if (typeof subOutMin === 'number' && subOutMin < 78) {
          addP('ถูกเปลี่ยนออกพัก ลดภาระกล้ามเนื้อ', 3);
        } else if (q.pos !== 'GK') {
          addP('ลงสนามกรำศึกเต็มเกม', -3);
        }
        // Boosted favorite exerts extra effort when playing
        if (team.favPlayer === q.n && getActiveFavBoost(q, team, careerP) > 0 && q.pos !== 'GK') {
          addP('ลูกรักปลุกพลังทุ่มเทเกินร้อย', -2);
          q.fit = clamp((q.fit ?? 100) - 2, 20, 100);
        }
      } else if (ctx?.matchPlayed && !played) {
        addP('ได้พักเกมการแข่งขัน ร่างกายสดขึ้น', 4);
      }
    }

    if (isMgrUser && plan) {
      if (indFocus[q.n] === 'REST' || plan.program === 'recovery') {
        addP('โปรแกรมพักฟื้นช่วยคลายกล้ามเนื้อ', 5);
      } else if (plan.intensity === 'heavy') {
        addP('ความเข้มข้นซ้อมระดับหนัก', -3);
      }
    }

    if (medLv >= 4 || physioLv >= 2) {
      addP('ทีมแพทย์และกายภาพดูแลฟื้นตัวดี', 2);
    }
    if (isMgrUser && (medCond < 60 || turfCond < 60)) {
      addP('สนามซ้อม/ศูนย์แพทย์ทรุดโทรม', -3);
    }
    if (travelLv >= 4) {
      addP('เดินทางสะดวก ลดอาการล้า', 1);
    }

    if (ctx?.matchEnv && played) {
      if (ctx.matchEnv.season === 'rainy' || (ctx.matchEnv.season === 'summer' && ctx.matchEnv.timeOfDay === 'day')) {
        addP('สภาพอากาศ/สนามหนักระหว่างแข่ง', -2);
      }
    }

    if ((q.age || 24) <= 22) addP('วัยหนุ่มฟื้นตัวไว', 2);
    else if ((q.age || 24) >= 32) addP('อายุมาก ฟื้นฟูร่างกายช้าลง', -3);

    if (tr === 18 || tr === 23) addP('พื้นฐานร่างกายอึดทนทาน', 2);
    else if (tr === 19) addP('ร่างกายอ่อนล้าง่ายกว่าปกติ', -3);

    // Realistic Random Physical / Body Events
    const bodyChance = tr === 19 ? 0.28 : tr === 18 || tr === 23 ? 0.14 : 0.2;
    if (Math.random() < bodyChance) {
      const posBodyProb = (fit >= 76 ? 0.52 : 0.28) + (medLv >= 4 ? 0.1 : 0) - ((q.age || 24) >= 32 ? 0.12 : 0);
      if (Math.random() < posBodyProb) {
        const ev = POSITIVE_BODY_EVENTS[R(0, POSITIVE_BODY_EVENTS.length - 1)];
        addP(ev.label, ev.delta);
      } else {
        const ev = NEGATIVE_BODY_EVENTS[R(0, NEGATIVE_BODY_EVENTS.length - 1)];
        addP(ev.label, ev.delta);
      }
    }

    if (curPhys >= 89 && pDelta <= 1) {
      pDelta -= 1;
    }

    // Clamp final mental & physical health realistically
    const nextMental = clamp(Math.round(curMental + mDelta), 18, 99);
    const physCap = (q.inj || 0) > 0 ? 48 : 99;
    const nextPhys = clamp(Math.round(curPhys + pDelta), 15, physCap);

    q.mental = nextMental;
    q.phys = nextPhys;
    q.mentalFactors = mFactors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
    q.physFactors = pFactors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
    q.mentalNote = q.mentalFactors[0]?.label || (nextMental >= GOOD_MENTAL_THRESHOLD ? 'สุขภาพจิตใจดี' : 'สุขภาพจิตใจปกติ');
    q.physNote = q.physFactors[0]?.label || (nextPhys >= GOOD_PHYS_THRESHOLD ? 'สุขภาพกายพร้อมสมบูรณ์' : 'สุขภาพกายปานกลาง');

    if (q.me && state.p) {
      state.p.mental = q.mental;
      state.p.phys = q.phys;
      state.p.mentalFactors = q.mentalFactors;
      state.p.physFactors = q.physFactors;
      state.p.mentalNote = q.mentalNote;
      state.p.physNote = q.physNote;
    }
  });

  if (state.mode === 'p' && team.id === state.me && state.p) {
    // AI manager evaluates if the career player earned/kept favorite ("ลูกรักโค้ช") status
    const meSq = team.sq.find((q) => q.me);
    if (meSq) {
      const recent = (state.p.fm || []).slice(-4);
      const recentAvg = recent.length ? recent.reduce((s, x) => s + x, 0) / recent.length : 6.6;
      const isFavNow = team.favPlayer === meSq.n;
      if (!isFavNow && recent.length >= 2 && recentAvg >= 7.3 && (state.p.sat ?? 0) === 0 && (state.p.inj || 0) === 0) {
        team.favPlayer = meSq.n;
        meSq.mental = clamp((meSq.mental ?? 70) + 5, 18, 99);
        state.p.mental = meSq.mental;
        meSq.mentalFactors = [{ label: 'ฟอร์มเด่นจนโค้ชยกเป็นลูกรัก!', delta: 5 }, ...(meSq.mentalFactors || [])].slice(0, 5);
        state.p.mentalFactors = meSq.mentalFactors;
      } else if (isFavNow && recent.length >= 3 && recentAvg < 6.2) {
        refreshAiTeamFavoritePlayer(team, state);
      }
    }
  } else {
    refreshAiTeamFavoritePlayer(team, state);
  }

  // Re-roll temporary +5..+10 boost for the favorite player when both mental & phys are good
  syncFavoritePlayerBoost(team, state, true);
}

export interface TalkTopicMeta {
  id: TalkTopicId;
  icon: string;
  label: string;
  short: string;
  effectHint: string;
  desc: string;
  mode: 'm' | 'p';
}

export const MANAGER_TALK_TOPICS: TalkTopicMeta[] = [
  {
    id: 'encourage',
    icon: '💬',
    label: 'คุยให้กำลังใจ',
    short: 'ให้กำลังใจ',
    effectHint: 'จิตใจ +5..+8 · ปลอดภัยเสมอ',
    desc: 'รับฟังและให้ความเชื่อมั่น เหมาะกับคนที่กำลังเครียด เจ็บ หรือเสียความมั่นใจ',
    mode: 'm'
  },
  {
    id: 'challenge',
    icon: '🔥',
    label: 'กระตุ้นปลุกฟอร์ม',
    short: 'กระตุ้นฟอร์ม',
    effectHint: 'จิตใจ +7..+11 (เสี่ยง -2 ถ้าใจอ่อนไหว)',
    desc: 'ตั้งความคาดหวังให้เค้นศักยภาพเต็มที่ ได้ผลดีมากกับนักเตะใจสู้หรือฟอร์มตก',
    mode: 'm'
  },
  {
    id: 'personal',
    icon: '☕',
    label: 'ถามไถ่ผ่อนคลาย',
    short: 'ผ่อนคลาย',
    effectHint: 'จิตใจ +4..+7 · กาย +2',
    desc: 'คุยเรื่องนอกสนามแบบเป็นกันเอง ช่วยคลายความล้าทางใจและนอนหลับดีขึ้น',
    mode: 'm'
  },
  {
    id: 'tactical',
    icon: '🧭',
    label: 'คุยบทบาทแท็กติก',
    short: 'บทบาททีม',
    effectHint: 'จิตใจ +5..+7 · ชัดเจนตำแหน่ง',
    desc: 'อธิบายบทบาทในแผนการเล่น ช่วยให้ตัวจริง ดาวรุ่ง หรือตัวสำรองเข้าใจหน้าที่',
    mode: 'm'
  }
];

export const CAREER_TALK_TOPICS: TalkTopicMeta[] = [
  {
    id: 'coach_chat',
    icon: '🗣️',
    label: 'คุยกับโค้ช',
    short: 'คุยกับโค้ช',
    effectHint: 'จิตใจ +5..+8 · เพิ่มความมั่นใจ',
    desc: 'ขอคำแนะนำแท็กติกและบทบาทในทีมโดยตรงจากหัวหน้าผู้ฝึกสอน',
    mode: 'p'
  },
  {
    id: 'teammate_bond',
    icon: '🤝',
    label: 'เฮฮากับเพื่อนทีม',
    short: 'คุยเพื่อนทีม',
    effectHint: 'จิตใจ +5..+8 · ผ่อนคลาย',
    desc: 'ร่วมพูดคุยผ่อนคลายในห้องแต่งตัว ลดความตึงเครียดก่อนเกม',
    mode: 'p'
  },
  {
    id: 'mindfulness',
    icon: '🧘',
    label: 'ทำสมาธิผ่อนคลาย',
    short: 'ทำสมาธิ',
    effectHint: 'จิตใจ +4..+6 · กาย +2',
    desc: 'ฝึกหายใจและโฟกัสสมาธิ พักผ่อนจิตใจให้พร้อมสำหรับเกมถัดไป',
    mode: 'p'
  }
];

export interface TeamTalkOption {
  id: TeamTalkId;
  icon: string;
  label: string;
  effectHint: string;
  whenToUse: string;
  coachSpeech: string;
}

export const TEAM_TALK_OPTIONS: TeamTalkOption[] = [
  {
    id: 'inspire',
    icon: '🔥',
    label: 'ปลุกใจนักสู้เต็มร้อย',
    effectHint: 'ขวัญทีม +4% · จิตใจทั้งทีม +2..+4',
    whenToUse: 'เหมาะก่อนเกมสำคัญ หรือช่วงต้องการความฮึกเหิม',
    coachSpeech: '“เราซ้อมหนักมาด้วยกันตลอดสัปดาห์ ลงสนามนัดนี้เล่นให้แฟนบอลภูมิใจ สู้ให้สุดทุกจังหวะ!”'
  },
  {
    id: 'calm',
    icon: '🧘',
    label: 'ลดความกดดัน ผ่อนคลายทีม',
    effectHint: 'คนเครียดใจ +5..+7 · ทั้งทีม +2 · ขวัญ +2%',
    whenToUse: 'เหมาะหลังแพ้ติดกัน หรือมีนักเตะใจตกหลายคน',
    coachSpeech: '“ไม่ต้องแบกความกดดันไว้คนเดียว เล่นตามจังหวะที่ซ้อมไว้ เชื่อใจเพื่อนร่วมทีมก็พอ”'
  },
  {
    id: 'tactics',
    icon: '🧭',
    label: 'ย้ำวินัยแท็กติก & แผนเล่น',
    effectHint: 'เข้าใจแผน +3% · ตัวจริง/กัปตัน ใจ +3',
    whenToUse: 'เหมาะเมื่อเปลี่ยนแผนใหม่ หรืออยากเร่งค่าเข้าใจแผน',
    coachSpeech: '“โฟกัสตำแหน่ง การเพรสซิ่ง และการเปลี่ยนรับเป็นรุก ทำตามแบบฝึกที่เราเตรียมไว้ให้เป๊ะ”'
  },
  {
    id: 'praise',
    icon: '👏',
    label: 'ชื่นชมความทุ่มเททั้งทีม',
    effectHint: 'จิตใจ +2..+4 · กาย +2 · ฟิต +1%',
    whenToUse: 'เหมาะช่วงโปรแกรมถี่ ให้ทีมบรรยากาศดีและสดชื่น',
    coachSpeech: '“ผมเห็นความตั้งใจของทุกคนในสนามซ้อม รักษาสปิริตแบบนี้ไว้ เราเดินไปด้วยกันทั้งทีม”'
  }
];

function buildConversationCopy(
  pl: Player,
  team: Team,
  topic: TalkTopicId,
  deltaMental: number,
  isFav: boolean,
  isCap: boolean,
  tr: number
): { topicLabel: string; coachLine: string; playerReply: string } {
  const resilient = isResilientPersonality(tr);
  const volatile = isVolatilePersonality(tr);
  const injured = (pl.inj || 0) > 0;
  const recentAvg = (pl.sra || 0) > 0 ? (pl.srs || 0) / Math.max(1, pl.sra!) : 6.7;

  if (topic === 'coach_chat') {
    return {
      topicLabel: 'คุยกับโค้ช',
      coachLine: 'คุณเข้าไปขอคำแนะนำจากหัวหน้าผู้ฝึกสอนเรื่องบทบาทในนัดถัดไป',
      playerReply: isFav
        ? 'โค้ชตบไหล่: “ผมเชื่อในตัวคุณเสมอ แค่รักษาใจให้นิ่งและสภาพร่างกายให้พร้อม คุณคือตัวเปลี่ยนเกมของเรา”'
        : recentAvg >= 7.0
          ? 'โค้ชยิ้มรับ: “ช่วงนี้ฟอร์มดีมาก รักษาจังหวะการวิ่งและการตัดสินใจแบบนี้ไว้ต่อไปนะ”'
          : 'โค้ชแนะนำ: “อย่าไปคิดมากกับจังหวะที่พลาด ซ้อมให้เต็มที่แล้วโอกาสของคุณจะมาแน่นอน”'
    };
  }
  if (topic === 'teammate_bond') {
    return {
      topicLabel: 'เฮฮากับเพื่อนร่วมทีม',
      coachLine: 'คุณร่วมวงพูดคุยและแลกเปลี่ยนมุกตลกกับเพื่อนร่วมทีมหลังซ้อมเสร็จ',
      playerReply: 'เพื่อนร่วมทีมหัวเราะกันครื้นเครง: “นัดหน้าลุยไปด้วยกัน! ไม่ว่าจะเจอทีมไหนพวกเราก็สู้เต็มที่อยู่แล้ว”'
    };
  }
  if (topic === 'mindfulness') {
    return {
      topicLabel: 'ทำสมาธิผ่อนคลาย',
      coachLine: 'คุณใช้เวลาเงียบๆ ทบทวนเกมและฝึกกำหนดลมหายใจก่อนพักผ่อน',
      playerReply: 'ความกังวลค่อยๆ จางลง สมองปลอดโปร่งและกล้ามเนื้อผ่อนคลายพร้อมสำหรับวันพรุ่งนี้'
    };
  }

  if (topic === 'challenge') {
    const coachLine = recentAvg < 6.5
      ? `โค้ชคุยตรงไปตรงมา: “${pl.n} ฟอร์มช่วงหลังยังไม่สุดเท่าที่ผมรู้ว่าคุณทำได้ นัดหน้าต้องแสดงให้เห็นมากกว่านี้”`
      : `โค้ชกระตุ้น: “${pl.n} คุณมีดีพอที่จะแบกเกมใหญ่ได้ อย่าหยุดแค่มาตรฐานเดิม ลุยให้สุดกว่านี้อีก!”`;
    let playerReply = '';
    if (deltaMental < 0) {
      playerReply = volatile
        ? `“โค้ชกดดันผมเกินไปหน่อยครับ ช่วงนี้ผมก็พยายามเต็มที่แล้ว…”`
        : `“ผมรู้ว่าผลงานยังไม่ดี แต่การเร่งกันตอนนี้ยิ่งทำให้ผมเครียดกว่าเดิมครับ”`;
    } else if (deltaMental <= 2) {
      playerReply = `“ครับโค้ช ผมเข้าใจ… ขอเวลาเรียกจังหวะตัวเองกลับมาหน่อยครับ”`;
    } else if (isFav) {
      playerReply = `“ไว้ใจได้เลยครับโค้ช! ผมจะตอบแทนความเชื่อมั่นด้วยฟอร์มที่ดีที่สุดในสนาม!”`;
    } else if (resilient) {
      playerReply = `“ขอบคุณที่พูดตรงๆ ครับโค้ช นัดหน้าผมจะวิ่งลืมตายและพิสูจน์ตัวเองให้เห็น!”`;
    } else {
      playerReply = `“รับทราบครับโค้ช! คำพูดนี้ช่วยปลุกไฟในตัวผมขึ้นมาเลย เดี๋ยวจัดให้เต็มที่ครับ!”`;
    }
    return { topicLabel: 'กระตุ้นปลุกฟอร์ม', coachLine, playerReply };
  }

  if (topic === 'personal') {
    const coachLine = `โค้ชถามไถ่อย่างเป็นกันเอง: “ช่วงนี้นอกสนามเป็นยังไงบ้าง ${pl.n} นอนหลับสบายดีไหม มีอะไรกังวลบอกผมได้นะ”`;
    let playerReply = '';
    if (injured) {
      playerReply = `“ได้คุยแล้วสบายใจขึ้นเยอะเลยครับโค้ช ช่วงเจ็บอยู่ก็พยายามทำตามแผนกายภาพทุกวันครับ”`;
    } else if ((pl.mental ?? 68) < 55) {
      playerReply = `“ขอบคุณโค้ชมากครับที่เป็นห่วง จริงๆ ผมแอบเครียดเรื่องความคาดหวังนิดหน่อย พอได้ระบายแล้วโล่งขึ้นมากครับ”`;
    } else if ((pl.age || 24) <= 21) {
      playerReply = `“สบายดีครับโค้ช! อยู่ทีมนี้เหมือนครอบครัวเลยครับ พี่ๆ ในทีมช่วยดูแลดีมาก”`;
    } else {
      playerReply = `“ชีวิตนอกสนามลงตัวดีครับโค้ช คืนนี้ได้พักเต็มที่ ร่างกายสดพร้อมซ้อมต่อแน่นอนครับ”`;
    }
    return { topicLabel: 'ถามไถ่ผ่อนคลาย', coachLine, playerReply };
  }

  if (topic === 'tactical') {
    const coachLine = `โค้ชชี้จุดบนกระดานแผน: “ในแท็กติกตอนนี้ ผมอยากให้คุณช่วยคุมพื้นที่และเชื่อมเกมตามจังหวะนี้เป็นพิเศษนะ ${pl.n}”`;
    let playerReply = '';
    if (isCap) {
      playerReply = `“ชัดเจนครับโค้ช เดี๋ยวผมช่วยสื่อสารจัดระเบียบเพื่อนร่วมทีมในสนามให้เล่นตรงตามแผนครับ”`;
    } else if (pl.pos === 'GK') {
      playerReply = `“เข้าใจครับโค้ช ผมจะคอยอ่านจังหวะและสั่งแนวรับจากด้านหลังให้รัดกุมที่สุด”`;
    } else if ((pl.con?.role || 'rot') === 'rot' || (pl.con?.role || 'rot') === 'pro') {
      playerReply = `“ดีใจมากครับที่โค้ชวางบทบาทไว้ให้ชัดเจน ต่อให้ลงเป็นตัวสำรองผมก็พร้อมเปลี่ยนเกมได้ทันที!”`;
    } else {
      playerReply = `“เห็นภาพชัดเจนเลยครับโค้ช การเคลื่อนที่แบบนี้เข้าทางสไตล์ผมมาก เดี๋ยวซ้อมจังหวะนี้ให้คล่องครับ”`;
    }
    return { topicLabel: 'คุยบทบาทแท็กติก', coachLine, playerReply };
  }

  // default: encourage
  const coachLine = injured
    ? `โค้ชให้กำลังใจ: “ไม่ต้องรีบร้อนนะ ${pl.n} รักษาตัวให้หายขาดก่อน ทีมยังรอคุณกลับมาเสมอ”`
    : `โค้ชตบไหล่ให้กำลังใจ: “ไม่ต้องกังวลเลย ${pl.n} ผมเชื่อในฝีเท้าของคุณ เล่นให้มั่นใจตามแบบของเรา”`;
  let playerReply = '';
  if (injured) {
    playerReply = `“ขอบคุณโค้ชมากครับ ผมจะตั้งใจฟื้นฟูร่างกายให้กลับมาช่วยทีมให้เร็วที่สุดครับ!”`;
  } else if (isFav) {
    playerReply = `“แค่โค้ชเชื่อใจผมก็มั่นใจขึ้นเป็นสิบเท่าแล้วครับ พร้อมทุ่มหมดหน้าตักเพื่อทีม!”`;
  } else if ((pl.mental ?? 68) < 55) {
    playerReply = `“คำพูดของโค้ชช่วยดึงความมั่นใจผมกลับมาได้เยอะเลยครับ นัดหน้าผมจะทำให้เต็มที่ครับ!”`;
  } else {
    playerReply = `“ขอบคุณครับโค้ช! บรรยากาศแบบนี้ทำให้ผมอยากลงสนามช่วยทีมคว้าชัยชนะมากครับ”`;
  }
  return { topicLabel: 'พูดคุยให้กำลังใจ', coachLine, playerReply };
}

export function applyTeamTalkAction(
  state: GameState,
  talkId: TeamTalkId
): { ok: boolean; msg: string; opt: TeamTalkOption; avgMentalDelta: number } {
  const opt = TEAM_TALK_OPTIONS.find((x) => x.id === talkId) || TEAM_TALK_OPTIONS[0];
  const team = state.teams[state.me];
  if (!team) {
    return { ok: false, msg: 'ไม่พบข้อมูลสโมสร', opt, avgMentalDelta: 0 };
  }
  ensureTeamWellbeing(team, state);
  const plan = getTeamTrainingPlan(state);
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  if (plan.teamTalkMd === curTurn) {
    return {
      ok: false,
      msg: 'พูดคุยทีมทอล์กในรอบนี้ไปแล้ว (รอแข่งนัดถัดไปเพื่อพูดคุยใหม่)',
      opt,
      avgMentalDelta: 0
    };
  }

  let totalMDelta = 0;
  let totalChanged = 0;
  const morGain = talkId === 'inspire' ? 4 : talkId === 'calm' ? 2 : talkId === 'praise' ? 2 : 1;
  state.mor = clamp((state.mor ?? 55) + morGain, 0, 100);

  if (talkId === 'tactics') {
    team.tacFam = clamp((team.tacFam ?? 65) + 3, 30, 100);
  }

  team.sq.forEach((q) => {
    const careerP = q.me ? state.p : null;
    const tr = resolvePersonalityId(q, careerP);
    const curM = getPlayerMentalScore(q, careerP);
    let dM = 0;
    let dP = 0;
    let note = opt.label;

    if (talkId === 'inspire') {
      dM = R(2, 4) + (isResilientPersonality(tr) || team.favPlayer === q.n ? 1 : 0);
      note = 'ทีมทอล์กปลุกใจนักสู้';
    } else if (talkId === 'calm') {
      dM = curM < 66 ? R(5, 7) : R(2, 3);
      note = curM < 66 ? 'ทีมทอล์กลดความกดดัน (คลายเครียด)' : 'ทีมทอล์กลดความกดดัน';
    } else if (talkId === 'tactics') {
      const keyRole = team.cap === q.n || q.con?.role === 'key';
      dM = keyRole || isResilientPersonality(tr) ? 3 : R(1, 2);
      note = 'ทีมทอล์กย้ำวินัยแท็กติก';
    } else {
      dM = R(2, 4);
      dP = 2;
      q.fit = clamp((q.fit ?? 100) + 1, 20, 100);
      note = 'ทีมทอล์กชื่นชมความทุ่มเท';
    }

    q.mental = clamp(curM + dM, 18, 99);
    q.mentalFactors = [{ label: note, delta: dM }, ...(q.mentalFactors || [])].slice(0, 5);
    q.mentalNote = note;
    if (dP > 0) {
      const cap = (q.inj || 0) > 0 ? 52 : 99;
      q.phys = clamp(getPlayerPhysScore(q, careerP) + dP, 15, cap);
      q.physFactors = [{ label: 'ผ่อนคลายหลังซ้อมร่วมกับทีม', delta: dP }, ...(q.physFactors || [])].slice(0, 5);
    }
    if (q.me && state.p) {
      state.p.mental = q.mental;
      state.p.mentalFactors = q.mentalFactors;
      state.p.mentalNote = q.mentalNote;
      if (dP > 0) {
        state.p.phys = q.phys;
        state.p.physFactors = q.physFactors;
      }
    }
    totalMDelta += dM;
    totalChanged++;
  });

  const boostNow = syncFavoritePlayerBoost(team, state, false);
  const avgDelta = totalChanged > 0 ? Math.round((totalMDelta / totalChanged) * 10) / 10 : 0;
  const noteSummary =
    talkId === 'tactics'
      ? `${opt.icon} ${opt.label} · เข้าใจแผน +3% · จิตใจเฉลี่ย +${avgDelta}`
      : talkId === 'praise'
        ? `${opt.icon} ${opt.label} · จิตใจเฉลี่ย +${avgDelta} · กาย +2`
        : `${opt.icon} ${opt.label} · ขวัญทีม +${morGain}% · จิตใจเฉลี่ย +${avgDelta}`;

  state.trainingPlan = {
    ...plan,
    teamTalkMd: curTurn,
    lastTeamTalkId: talkId,
    lastTeamTalkNote: noteSummary
  };

  return {
    ok: true,
    msg: `${noteSummary}${boostNow > 0 ? ` · 💖 ลูกรักปลุกพลัง +${boostNow}` : ''}`,
    opt,
    avgMentalDelta: avgDelta
  };
}

export function applyPlayerCareAction(
  state: GameState,
  playerName: string,
  action: 'talk' | 'physio_care',
  topic?: TalkTopicId
): {
  ok: boolean;
  msg: string;
  boostNow: number;
  coachLine?: string;
  playerReply?: string;
  topicLabel?: string;
  deltaMental: number;
  deltaPhys: number;
} {
  const team = state.teams[state.me];
  if (!team) {
    return { ok: false, msg: 'ไม่พบข้อมูลสโมสร', boostNow: 0, deltaMental: 0, deltaPhys: 0 };
  }
  const pl = team.sq.find((q) => q.n === playerName);
  if (!pl) {
    return { ok: false, msg: 'ไม่พบนักเตะในทีม', boostNow: 0, deltaMental: 0, deltaPhys: 0 };
  }
  ensurePlayerWellbeing(pl, { team, state });
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  const quota = getTeamCareQuotaInfo(state, team);

  if (state.mode === 'm' && quota.remaining <= 0) {
    return {
      ok: false,
      msg: `ใช้โควตาดูแลใกล้ชิดครบ ${quota.limit} ครั้งในรอบนี้แล้ว (รอแข่งนัดถัดไป)`,
      boostNow: getActiveFavBoost(pl, team, pl.me ? state.p : null),
      deltaMental: 0,
      deltaPhys: 0
    };
  }

  if (action === 'talk') {
    if (pl.careTalkMd === curTurn) {
      return {
        ok: false,
        msg: 'พูดคุยดูแลจิตใจนักเตะคนนี้ในรอบนี้ไปแล้ว',
        boostNow: getActiveFavBoost(pl, team, pl.me ? state.p : null),
        deltaMental: 0,
        deltaPhys: 0
      };
    }

    const chosenTopic: TalkTopicId =
      topic || (state.mode === 'p' ? 'mindfulness' : 'encourage');
    const isFav = team.favPlayer === pl.n;
    const isCap = team.cap === pl.n;
    const tr = resolvePersonalityId(pl, pl.me ? state.p : null);
    const resilient = isResilientPersonality(tr);
    const volatile = isVolatilePersonality(tr);
    const motivatorBonus = state.club?.managerStyle === 'motivator' ? 1 : 0;
    const curMental = getPlayerMentalScore(pl, pl.me ? state.p : null);

    let gainM = 0;
    let gainP = 0;
    let factorLabel = 'พูดคุยตัวต่อตัว';

    if (chosenTopic === 'challenge') {
      if (volatile && curMental < 50 && Math.random() < 0.45) {
        gainM = -2;
        factorLabel = 'ถูกโค้ชกระตุ้นหนักจนกดดัน';
      } else {
        gainM = R(7, 10) + (resilient ? 1 : 0) + (isFav ? 1 : 0) + motivatorBonus;
        pl.fit = clamp((pl.fit ?? 100) + 2, 20, 100);
        factorLabel = 'โค้ชกระตุ้นปลุกไฟนักสู้';
      }
    } else if (chosenTopic === 'personal') {
      gainM = R(4, 7) + (curMental < 60 ? 1 : 0);
      gainP = 2;
      factorLabel = 'ถามไถ่ผ่อนคลายนอกสนาม';
    } else if (chosenTopic === 'tactical') {
      gainM = R(5, 7) + (isCap || pl.con?.role === 'key' ? 1 : 0);
      factorLabel = 'พูดคุยชัดเจนบทบาทแท็กติก';
    } else if (chosenTopic === 'coach_chat') {
      gainM = R(5, 8) + (isFav ? 1 : 0);
      factorLabel = 'พูดคุยขอคำแนะนำจากโค้ช';
    } else if (chosenTopic === 'teammate_bond') {
      gainM = R(5, 8);
      factorLabel = 'สังสรรค์ผ่อนคลายกับเพื่อนร่วมทีม';
    } else if (chosenTopic === 'mindfulness') {
      gainM = R(4, 6);
      gainP = 2;
      factorLabel = 'ทำสมาธิผ่อนคลายจิตใจ';
    } else {
      gainM = R(5, 8) + (isFav ? 1 : 0) + (curMental < 62 ? 1 : 0) + motivatorBonus;
      factorLabel = 'โค้ชพูดคุยให้กำลังใจ';
    }

    pl.mental = clamp(curMental + gainM, 18, 99);
    pl.careTalkMd = curTurn;
    pl.mentalFactors = [{ label: factorLabel, delta: gainM }, ...(pl.mentalFactors || [])].slice(0, 5);
    pl.mentalNote = factorLabel;

    if (gainP > 0) {
      const cap = (pl.inj || 0) > 0 ? 52 : 99;
      pl.phys = clamp(getPlayerPhysScore(pl, pl.me ? state.p : null) + gainP, 15, cap);
      pl.physFactors = [{ label: 'ผ่อนคลายลดความตึงเครียด', delta: gainP }, ...(pl.physFactors || [])].slice(0, 5);
      pl.physNote = 'ผ่อนคลายลดความตึงเครียด';
    }

    if (pl.me && state.p) {
      state.p.mental = pl.mental;
      state.p.careTalkMd = curTurn;
      state.p.mentalFactors = pl.mentalFactors;
      state.p.mentalNote = pl.mentalNote;
      if (gainP > 0) {
        state.p.phys = pl.phys;
        state.p.physFactors = pl.physFactors;
        state.p.physNote = pl.physNote;
      }
    }

    const copy = buildConversationCopy(pl, team, chosenTopic, gainM, isFav, isCap, tr);
    if (state.mode === 'm') {
      const plan = getTeamTrainingPlan(state);
      const log: TalkDialogueLog = {
        turn: curTurn,
        playerName: pl.n,
        topicId: chosenTopic,
        topicLabel: copy.topicLabel,
        coachLine: copy.coachLine,
        playerReply: copy.playerReply,
        deltaMental: gainM,
        deltaPhys: gainP
      };
      state.trainingPlan = { ...plan, lastTalkLog: log };
    }

    const boostNow = syncFavoritePlayerBoost(team, state, false);
    const remTxt = state.mode === 'm' ? ` · โควตาเหลือ ${Math.max(0, quota.remaining - 1)}/${quota.limit}` : '';
    const dMTxt = gainM >= 0 ? `+${gainM}` : `${gainM}`;
    const physTxt = gainP > 0 ? ` · กาย +${gainP}` : '';
    return {
      ok: true,
      msg: `💬 ${copy.topicLabel} · ${pl.n} (ใจ ${dMTxt} → ${pl.mental}/100${physTxt})${boostNow > 0 ? ` · 💖 ลูกรักปลุกพลัง +${boostNow}!` : ''}${remTxt}`,
      boostNow,
      coachLine: copy.coachLine,
      playerReply: copy.playerReply,
      topicLabel: copy.topicLabel,
      deltaMental: gainM,
      deltaPhys: gainP
    };
  }

  // physio_care
  if (pl.carePhysMd === curTurn) {
    return {
      ok: false,
      msg: 'ฟื้นฟูร่างกายนักเตะคนนี้ในรอบนี้ไปแล้ว',
      boostNow: getActiveFavBoost(pl, team, pl.me ? state.p : null),
      deltaMental: 0,
      deltaPhys: 0
    };
  }
  const medBonus = state.mode === 'm' ? Math.floor((state.med ?? 1) / 4) + (state.staff?.physio ? 1 : 0) : 1;
  const gain = R(5, 7) + medBonus;
  const cap = (pl.inj || 0) > 0 ? 52 : 99;
  pl.phys = clamp((pl.phys ?? 70) + gain, 15, cap);
  pl.fit = clamp((pl.fit ?? 85) + 3, 20, 100);
  pl.carePhysMd = curTurn;
  const note = 'นวดคลายกล้ามเนื้อ & ฟื้นฟูร่างกาย';
  pl.physFactors = [{ label: note, delta: gain }, ...(pl.physFactors || [])].slice(0, 5);
  pl.physNote = note;
  if (pl.me && state.p) {
    state.p.phys = pl.phys;
    state.p.en = pl.fit;
    state.p.carePhysMd = curTurn;
    state.p.physFactors = pl.physFactors;
    state.p.physNote = pl.physNote;
  }
  const boostNow = syncFavoritePlayerBoost(team, state, false);
  const remTxt = state.mode === 'm' ? ` · โควตาเหลือ ${Math.max(0, quota.remaining - 1)}/${quota.limit}` : '';
  return {
    ok: true,
    msg: `🧊 ${note}ให้ ${pl.n} (+${gain} สุขภาพกาย → ${pl.phys}/100)${boostNow > 0 ? ` · 💖 ลูกรักปลุกพลัง +${boostNow}!` : ''}${remTxt}`,
    boostNow,
    coachLine: `ทีมกายภาพประคบเย็นและนวดคลายกล้ามเนื้อให้ ${pl.n} เป็นกรณีพิเศษ`,
    playerReply: (pl.inj || 0) > 0
      ? '“อาการตึงลดลงเยอะเลยครับโค้ช รู้สึกขยับตัวสบายขึ้นมาก”'
      : '“ขาสบายขึ้นเยอะเลยครับ พร้อมวิ่งซ้อมและลงช่วยทีมเต็มที่!”',
    topicLabel: 'ฟื้นฟูกล้ามเนื้อ',
    deltaMental: 0,
    deltaPhys: gain
  };
}

export function runAiTeamTalkAndCare(team: Team, state: GameState) {
  if (!team?.sq?.length) return;
  if (state.mode === 'm' && team.id === state.me) return;
  ensureTeamWellbeing(team, state);

  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  const avgMental =
    team.sq.reduce((sum, q) => sum + getPlayerMentalScore(q, null), 0) / Math.max(1, team.sq.length);
  const lowMentalCnt = team.sq.filter((q) => getPlayerMentalScore(q, null) < 62).length;
  const lastRes = (team.fm || '').slice(-1);

  // 1. AI Team Talk (1/turn, equivalent to Manager's applyTeamTalkAction)
  const talkId: TeamTalkId =
    lowMentalCnt >= 3 || avgMental < 63
      ? 'calm'
      : (team.tacFam ?? 65) < 75
        ? 'tactics'
        : lastRes === 'L'
          ? 'inspire'
          : 'praise';

  if (talkId === 'tactics') {
    team.tacFam = clamp((team.tacFam ?? 65) + 3, 30, 100);
  }
  const opt = TEAM_TALK_OPTIONS.find((x) => x.id === talkId) || TEAM_TALK_OPTIONS[0];
  team.sq.forEach((q) => {
    const careerP = q.me ? state.p : null;
    const tr = resolvePersonalityId(q, careerP);
    const curM = getPlayerMentalScore(q, careerP);
    let dM = 0;
    let dP = 0;
    let note = opt.label;
    if (talkId === 'inspire') {
      dM = R(2, 4) + (isResilientPersonality(tr) || team.favPlayer === q.n ? 1 : 0);
      note = 'ทีมทอล์กปลุกใจนักสู้';
    } else if (talkId === 'calm') {
      dM = curM < 66 ? R(4, 6) : R(1, 3);
      note = 'ทีมทอล์กลดความกดดัน';
    } else if (talkId === 'tactics') {
      dM = team.cap === q.n || q.con?.role === 'key' || isResilientPersonality(tr) ? 3 : R(1, 2);
      note = 'ทีมทอล์กย้ำวินัยแท็กติก';
    } else {
      dM = R(2, 3);
      dP = 2;
      q.fit = clamp((q.fit ?? 100) + 1, 20, 100);
      note = 'ทีมทอล์กชื่นชมความทุ่มเท';
    }
    q.mental = clamp(curM + dM, 18, 99);
    q.mentalFactors = [{ label: note, delta: dM }, ...(q.mentalFactors || [])].slice(0, 5);
    q.mentalNote = note;
    if (dP > 0) {
      const cap = (q.inj || 0) > 0 ? 52 : 99;
      q.phys = clamp(getPlayerPhysScore(q, careerP) + dP, 15, cap);
      q.physFactors = [{ label: 'ผ่อนคลายหลังซ้อมร่วมกับทีม', delta: dP }, ...(q.physFactors || [])].slice(0, 5);
    }
    if (q.me && state.p) {
      state.p.mental = q.mental;
      state.p.mentalFactors = q.mentalFactors;
      state.p.mentalNote = q.mentalNote;
      if (dP > 0) {
        state.p.phys = q.phys;
        state.p.physFactors = q.physFactors;
      }
    }
  });

  // 2. AI Close-Care Quota (up to 3 actions per matchday, matching user's MAX_MGR_CARE_ACTIONS_PER_TURN)
  let careUsed = 0;
  const medBonus = [0, 1, 2][clamp(team.tier ?? 0, 0, 2)] ?? 1;
  const priority = team.sq
    .slice()
    .sort((a, b) => {
      const aFav = team.favPlayer === a.n ? 100 : 0;
      const bFav = team.favPlayer === b.n ? 100 : 0;
      const aNeed =
        aFav +
        ((a.inj || 0) > 0 ? 25 : 0) +
        Math.max(0, GOOD_MENTAL_THRESHOLD - getPlayerMentalScore(a, null)) +
        Math.max(0, GOOD_PHYS_THRESHOLD - getPlayerPhysScore(a, null));
      const bNeed =
        bFav +
        ((b.inj || 0) > 0 ? 25 : 0) +
        Math.max(0, GOOD_MENTAL_THRESHOLD - getPlayerMentalScore(b, null)) +
        Math.max(0, GOOD_PHYS_THRESHOLD - getPlayerPhysScore(b, null));
      return bNeed - aNeed || b.ov - a.ov;
    });

  for (const pl of priority) {
    if (careUsed >= MAX_MGR_CARE_ACTIONS_PER_TURN) break;
    const careerP = pl.me ? state.p : null;
    const curM = getPlayerMentalScore(pl, careerP);
    const curP = getPlayerPhysScore(pl, careerP);
    const isFav = team.favPlayer === pl.n;
    const needTalk = curM < (isFav ? GOOD_MENTAL_THRESHOLD + 2 : 62);
    const needPhys = (pl.inj || 0) > 0 || curP < (isFav ? GOOD_PHYS_THRESHOLD + 2 : 66);

    if (needTalk && pl.careTalkMd !== curTurn) {
      const gainM = R(5, 8) + (isFav ? 1 : 0);
      pl.mental = clamp(curM + gainM, 18, 99);
      pl.careTalkMd = curTurn;
      const lbl = 'โค้ชทีมพูดคุยดูแลตัวต่อตัว';
      pl.mentalFactors = [{ label: lbl, delta: gainM }, ...(pl.mentalFactors || [])].slice(0, 5);
      pl.mentalNote = lbl;
      if (pl.me && state.p) {
        state.p.mental = pl.mental;
        state.p.careTalkMd = curTurn;
        state.p.mentalFactors = pl.mentalFactors;
        state.p.mentalNote = lbl;
      }
      careUsed++;
    }
    if (careUsed >= MAX_MGR_CARE_ACTIONS_PER_TURN) break;
    if (needPhys && pl.carePhysMd !== curTurn) {
      const gainP = R(5, 7) + medBonus;
      const cap = (pl.inj || 0) > 0 ? 52 : 99;
      pl.phys = clamp(curP + gainP, 15, cap);
      pl.fit = clamp((pl.fit ?? 85) + 3, 20, 100);
      pl.carePhysMd = curTurn;
      const lbl = 'กายภาพฟื้นฟูกล้ามเนื้อสโมสร';
      pl.physFactors = [{ label: lbl, delta: gainP }, ...(pl.physFactors || [])].slice(0, 5);
      pl.physNote = lbl;
      if (pl.me && state.p) {
        state.p.phys = pl.phys;
        state.p.en = pl.fit;
        state.p.carePhysMd = curTurn;
        state.p.physFactors = pl.physFactors;
        state.p.physNote = lbl;
      }
      careUsed++;
    }
  }

  team.aiTalkNote = `${opt.icon} ${opt.label}${careUsed > 0 ? ` · ดูแลใกล้ชิด ${careUsed}/${MAX_MGR_CARE_ACTIONS_PER_TURN}` : ''}`;
  syncFavoritePlayerBoost(team, state, false);
}

