import type { StatKey, TrainingProgramId, Player, PersonalMissionMetric, PlayerMissionsState, Team, PlayerCareerProfile, GameState, PersonalMissionDef, FinishedMatchPayload } from '../types/game';
import { R, clamp } from '../utils/math';
import { ATT, SIGL } from '../data/thaiFootballData';
import { OVF, xi, DT, ovMe, syncMe } from './playerCore';

export const ovColor = (v: number) =>
  v >= 90 ? '#d97706' : v >= 80 ? '#059669' : v >= 70 ? '#0284c7' : v >= 60 ? '#7c3aed' : v >= 50 ? '#ea580c' : '#e11d48';

export const statBarColor = (v: number) =>
  v >= 90 ? '#f59e0b' : v >= 80 ? '#10b981' : v >= 70 ? '#0ea5e9' : v >= 60 ? '#8b5cf6' : v >= 50 ? '#f97316' : '#f43f5e';

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
      textClass: 'text-emerald-700 dark:text-emerald-300',
      darkTextClass: 'text-emerald-300',
      badgeClass: 'bg-emerald-500/14 border-emerald-500/35 text-emerald-800 dark:text-emerald-200',
      dotClass: 'bg-emerald-500',
      hex: '#10b981'
    };
  }
  if (v >= 70) {
    return {
      textClass: 'text-sky-700 dark:text-sky-300',
      darkTextClass: 'text-sky-300',
      badgeClass: 'bg-sky-500/14 border-sky-500/35 text-sky-800 dark:text-sky-200',
      dotClass: 'bg-sky-500',
      hex: '#0ea5e9'
    };
  }
  if (v >= 60) {
    return {
      textClass: 'text-violet-700 dark:text-violet-300',
      darkTextClass: 'text-violet-300',
      badgeClass: 'bg-violet-500/14 border-violet-500/35 text-violet-800 dark:text-violet-200',
      dotClass: 'bg-violet-500',
      hex: '#8b5cf6'
    };
  }
  if (v >= 50) {
    return {
      textClass: 'text-orange-700 dark:text-orange-300',
      darkTextClass: 'text-orange-300',
      badgeClass: 'bg-orange-500/14 border-orange-500/35 text-orange-800 dark:text-orange-200',
      dotClass: 'bg-orange-500',
      hex: '#f97316'
    };
  }
  return {
    textClass: 'text-rose-700 dark:text-rose-300',
    darkTextClass: 'text-rose-300',
    badgeClass: 'bg-rose-500/14 border-rose-500/35 text-rose-800 dark:text-rose-200',
    dotClass: 'bg-rose-500',
    hex: '#f43f5e'
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
    targets: [5, 12, 25],
    subRewards: [
      { fk: 5, cur: 2 },
      { fk: 5, cur: 3 },
      { fk: 6, cur: 3, comp: 2 }
    ],
    coreReward: 'sh',
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'passing',
    icon: '📐',
    name: 'จอมทัพส่งบอลแม่นยำ',
    desc: 'ส่งบอลสำเร็จในสนามแข่งขันครบ 100 ครั้งเพื่อปลดล็อกพัฒนาทักษะจ่ายบอล',
    metric: 'passes',
    unit: 'ครั้ง',
    targets: [100, 280, 600],
    subRewards: [
      { crs: 4, rd: 3, dist: 3 },
      { crs: 4, rd: 4, dist: 3 },
      { crs: 5, rd: 4, dist: 4 }
    ],
    coreReward: 'ps'
  },
  {
    id: 'finishing',
    icon: '🔥',
    name: 'เพชฌฆาตจบสกอร์',
    desc: 'หาจังหวะยิงประตูและลุ้นสับไกในเกมจริงต่อเนื่อง',
    metric: 'shots',
    unit: 'ครั้ง',
    targets: [15, 38, 75],
    subRewards: [
      { fin: 5, pw: 3, run: 2 },
      { fin: 5, pw: 4, cur: 2 },
      { fin: 6, pw: 4, comp: 2 }
    ],
    coreReward: 'sh',
    posFilter: ['FW', 'MF']
  },
  {
    id: 'playmaker',
    icon: '🎁',
    name: 'จอมเปิดบอล & แอสซิสต์',
    desc: 'เปิดบอลเข้ากรอบ แทงทะลุช่อง หรือทำแอสซิสต์ให้เพื่อนร่วมทีม',
    metric: 'crossAssists',
    unit: 'ครั้ง',
    targets: [12, 30, 60],
    subRewards: [
      { crs: 5, cur: 3, run: 2 },
      { crs: 5, cur: 3, fk: 2 },
      { crs: 6, cur: 4, run: 3 }
    ],
    coreReward: 'ps',
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'dribbler',
    icon: '⚡',
    name: 'สปีด & เลี้ยงกินตัว',
    desc: 'พาบอลแหวกแนวรับหรือโชว์สกิลเลี้ยงหลบคู่แข่งในเกม',
    metric: 'dribbles',
    unit: 'ครั้ง',
    targets: [25, 65, 130],
    subRewards: [
      { spd: 4, run: 4, cur: 2 },
      { spd: 4, run: 4, str: 2 },
      { spd: 5, run: 5, cur: 3 }
    ],
    coreReward: 'dr',
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'defender',
    icon: '🛡️',
    name: 'ปราการเหล็กเข้าสกัด',
    desc: 'เข้าสกัดแย่งบอล ดักตัดทางบอล หรือพุ่งบล็อกลูกยิงคู่แข่ง',
    metric: 'tackles',
    unit: 'ครั้ง',
    targets: [20, 50, 100],
    subRewards: [
      { pos: 4, mrk: 4, blk: 3, rd: 2 },
      { pos: 4, mrk: 4, blk: 4, rd: 3 },
      { pos: 5, mrk: 5, blk: 4, comp: 2 }
    ],
    coreReward: 'tk',
    posFilter: ['DF', 'MF']
  },
  {
    id: 'aerial',
    icon: '🗣️',
    name: 'จ้าวเวหาลูกโหม่ง',
    desc: 'ดวลลูกกลางอากาศและเทกตัวโหม่งทั้งเกมรุกและเกมรับ',
    metric: 'headers',
    unit: 'ครั้ง',
    targets: [12, 30, 60],
    subRewards: [
      { hd: 5, str: 3 },
      { hd: 5, str: 4, pos: 2 },
      { hd: 6, str: 4, comp: 2 }
    ],
    coreReward: 'ph',
    posFilter: ['FW', 'MF', 'DF']
  },
  {
    id: 'goalkeeper',
    icon: '🧤',
    name: 'มือกาวจอมเซฟ',
    desc: 'เซฟลูกยิงตรงกรอบและออกมาชก/คว้าบอลกลางอากาศ',
    metric: 'saves',
    unit: 'ครั้ง',
    targets: [18, 45, 90],
    subRewards: [
      { sv: 5, cl: 4, dist: 2 },
      { sv: 5, cl: 4, comp: 3 },
      { sv: 6, cl: 5, dist: 3 }
    ],
    coreReward: 'tk',
    posFilter: ['GK']
  },
  {
    id: 'ironman',
    icon: '💪',
    name: 'ปอดเหล็กความฟิต & นิ่งในนัดใหญ่',
    desc: 'ลงสนามแข่งขันและรักษาวินัยฝึกซ้อมอย่างสม่ำเสมอ',
    metric: 'matches',
    unit: 'นัด',
    targets: [6, 15, 30],
    subRewards: [
      { sta: 4, tol: 3, rec: 3, comp: 2 },
      { sta: 4, tol: 4, rec: 3, comp: 3 },
      { sta: 5, tol: 4, rec: 4, comp: 4 }
    ],
    coreReward: 'ph'
  }
];

export const ensurePlayerMissions = (q: Player, careerP?: PlayerCareerProfile | null): PlayerMissionsState => {
  const src = (q.me && careerP?.missions) || q.missions;
  const normalized: PlayerMissionsState = {
    stats: { ...(src?.stats || {}) },
    claimed: { ...(src?.claimed || {}) },
    focusId: src?.focusId
  };
  if (!normalized.focusId) {
    normalized.focusId = q.pos === 'GK' ? 'goalkeeper' : q.pos === 'DF' ? 'defender' : q.pos === 'FW' ? 'finishing' : 'passing';
  }
  return normalized;
};

export const getPlayerMissionView = (q: Player, careerP?: PlayerCareerProfile | null) => {
  const mState = ensurePlayerMissions(q, careerP);
  const items = PERSONAL_MISSIONS.filter((m) => !m.posFilter || m.posFilter.includes(q.pos)).map((def) => {
    const stage = clamp(mState.claimed[def.id] || 0, 0, def.targets.length);
    const completedAll = stage >= def.targets.length;
    const target = def.targets[Math.min(stage, def.targets.length - 1)];
    const curVal = mState.stats[def.metric] || 0;
    const pct = completedAll ? 100 : clamp(Math.round((curVal / Math.max(1, target)) * 100), 0, 100);
    const canClaim = !completedAll && curVal >= target;
    const nextRewards = def.subRewards[Math.min(stage, def.subRewards.length - 1)];
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
      nextRewards
    };
  });
  return { mState, items };
};

export const countReadyMissions = (q: Player, careerP?: PlayerCareerProfile | null): number =>
  getPlayerMissionView(q, careerP).items.filter((x) => x.canClaim).length;

export const formatMissionRewardText = (subRewards: Record<string, number>, coreReward: StatKey) => {
  const subTxt = Object.entries(subRewards)
    .map(([k, v]) => `${SIGL[k] || k} +${v}`)
    .join(' · ');
  const coreLbl = ATT.find((x) => x[0] === coreReward)?.[1] || coreReward;
  return `${subTxt} · ${coreLbl} +1`;
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
  if (stage >= def.targets.length) return { ok: false, msg: 'ภารกิจนี้สำเร็จครบทุกขั้นแล้ว' };
  const target = def.targets[stage];
  const curVal = mState.stats[def.metric] || 0;
  if (curVal < target) return { ok: false, msg: `ยังทำไม่ครบ (${curVal}/${target} ${def.unit})` };

  const rewards = def.subRewards[stage];
  mState.claimed[def.id] = stage + 1;
  q.missions = mState;
  q.sb = { ...(q.sb || {}) };
  Object.entries(rewards).forEach(([sk, delta]) => {
    q.sb![sk] = (q.sb![sk] || 0) + delta;
    if (q.customD && q.customD[sk] != null) {
      q.customD[sk] = clamp(q.customD[sk] + delta, 1, 99);
    }
  });

  if (careerP) {
    careerP.missions = mState;
    careerP.sb = { ...(careerP.sb || {}) };
    Object.entries(rewards).forEach(([sk, delta]) => {
      careerP.sb![sk] = (careerP.sb![sk] || 0) + delta;
      if (careerP.customD && careerP.customD[sk] != null) {
        careerP.customD[sk] = clamp(careerP.customD[sk] + delta, 1, 99);
      }
    });
    careerP.a[def.coreReward] = clamp(careerP.a[def.coreReward] + 1, 1, 99);
    careerP.rep = (careerP.rep || 10) + 2;
    q.ov = ovMe(careerP);
    if (q.blessed && q.customA) q.customA = { ...careerP.a };
    syncMe(s);
  } else {
    q.coreSb = { ...(q.coreSb || {}) };
    q.coreSb[def.coreReward] = (q.coreSb[def.coreReward] || 0) + 1;
    if (q.customA) {
      q.customA[def.coreReward] = clamp(q.customA[def.coreReward] + 1, 1, 99);
    }
    const afterDt = DT(q, null);
    const calcOv = clamp(OVF(q.pos, afterDt.a), 1, 99);
    if (calcOv > q.ov) {
      q.ov = calcOv;
    } else if ((stage === 0 || stage === 2) && q.ov < 99) {
      q.ov = clamp(q.ov + 1, 1, 99);
    }
    if (q.ov > (q.pot || q.ov)) q.pot = q.ov;
  }

  const rewardStr = formatMissionRewardText(rewards, def.coreReward);
  return { ok: true, msg: `${def.icon} ${q.n} สำเร็จ "${def.name} (ขั้น ${stage + 1}/3)"! ${rewardStr}` };
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
  const delta = isFocusedMetric ? Math.max(rawDelta + 1, Math.round(rawDelta * 1.5)) : rawDelta;
  mState.stats[metric] = (mState.stats[metric] || 0) + delta;
  q.missions = mState;
  if (careerP) careerP.missions = mState;
};

export const applyTrainingMissionProgress = (
  q: Player,
  opts: { teamProgram?: TrainingProgramId; isTeamFocus?: boolean; careerPlan?: number; careerP?: PlayerCareerProfile | null }
): string[] => {
  const notes: string[] = [];
  const mState = ensurePlayerMissions(q, opts.careerP);
  const focusDef = PERSONAL_MISSIONS.find((m) => m.id === mState.focusId);
  const mult = opts.isTeamFocus ? 2 : 1;

  if (focusDef) {
    const drillAmt: Record<PersonalMissionMetric, number> = {
      setpieces: 1 * mult,
      passes: 10 * mult,
      shots: 2 * mult,
      crossAssists: 2 * mult,
      dribbles: 3 * mult,
      tackles: 2 * mult,
      headers: 2 * mult,
      saves: 2 * mult,
      matches: 0
    };
    const addAmt = drillAmt[focusDef.metric] || 0;
    if (addAmt > 0) {
      mState.stats[focusDef.metric] = (mState.stats[focusDef.metric] || 0) + addAmt;
      notes.push(`${focusDef.name} +${addAmt}`);
    }
  }

  if (opts.teamProgram === 'attack' && (q.pos === 'FW' || q.pos === 'MF')) {
    mState.stats.shots = (mState.stats.shots || 0) + 2;
    mState.stats.setpieces = (mState.stats.setpieces || 0) + (focusDef?.id === 'setpiece' ? 1 : 0);
  } else if (opts.teamProgram === 'tactics') {
    mState.stats.passes = (mState.stats.passes || 0) + 12;
  } else if (opts.teamProgram === 'defense' && (q.pos === 'DF' || q.pos === 'MF')) {
    mState.stats.tackles = (mState.stats.tackles || 0) + 2;
    mState.stats.headers = (mState.stats.headers || 0) + 1;
  } else if (opts.teamProgram === 'defense' && q.pos === 'GK') {
    mState.stats.saves = (mState.stats.saves || 0) + 3;
  }

  if (opts.careerPlan === 0 && q.pos !== 'GK') {
    mState.stats.shots = (mState.stats.shots || 0) + 2;
  } else if (opts.careerPlan === 1) {
    mState.stats.passes = (mState.stats.passes || 0) + 10;
  } else if (opts.careerPlan === 4 && q.pos !== 'GK') {
    mState.stats.setpieces = (mState.stats.setpieces || 0) + 1;
  }

  q.missions = mState;
  if (opts.careerP) opts.careerP.missions = mState;
  return notes;
};

export const applyMatchMissionProgress = (
  s: GameState,
  H: Team,
  A: Team,
  payload: FinishedMatchPayload
) => {
  const meTeam = s.teams[s.me];
  if (!meTeam) return;
  const playedList = new Set(payload.playedNames?.[meTeam.id] || xi(meTeam).map((q) => q.n));
  const actionsMap = payload.playerActions || {};

  meTeam.sq.forEach((q) => {
    const careerP = q.me && s.p ? s.p : null;
    if (q.me && payload.pf && payload.pf.played === false) return;
    if (!playedList.has(q.n) && !actionsMap[q.n]) return;

    addMissionStat(q, 'matches', 1, careerP);
    const acts = actionsMap[q.n];
    if (acts) {
      (Object.entries(acts) as [PersonalMissionMetric, number][]).forEach(([metric, val]) => {
        if (val > 0 && metric !== 'matches') addMissionStat(q, metric, val, careerP);
      });
    } else {
      // Fallback estimation if no per-player breakdown provided
      const goals = payload.evs.filter((e) => e.t === meTeam.id && e.who === q.n).length;
      const assists = payload.evs.filter((e) => e.t === meTeam.id && e.as === q.n).length;
      if (q.pos === 'GK') {
        addMissionStat(q, 'saves', R(2, 5), careerP);
        addMissionStat(q, 'passes', R(10, 18), careerP);
      } else {
        addMissionStat(q, 'passes', q.pos === 'MF' ? R(18, 30) : R(10, 20), careerP);
        if (goals > 0) addMissionStat(q, 'shots', goals * 2 + 1, careerP);
        if (assists > 0) addMissionStat(q, 'crossAssists', assists * 2 + 1, careerP);
        if (q.pos === 'DF') addMissionStat(q, 'tackles', R(2, 5), careerP);
      }
    }
  });
  void H;
  void A;
  if (s.mode === 'p' && s.p) syncMe(s);
};
