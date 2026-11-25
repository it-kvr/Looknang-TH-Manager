import type { Position, SubRole, StatKey, GameMode, CoreAttrs, Player, PlayerSeasonProgressPoint, Team, ClubIdentity, PlayerCareerProfile, GameState, FootballTraitDef, CreatedPlayerTemplate, PreferredFoot } from '../types/game';
import type { ClubPhilosophyDef } from '../data/thaiFootballData';
import { R, P, clamp } from '../utils/math';
import { CREST_SHAPES, CREST_PATTERNS, CREST_IC, KIT_PATTERNS } from '../data/crestAndKitData';
import { A1, A2, S1, S2, FN, SN, NG, BASE, POS, ATT, SFX0, FSD, LINE, EQ, SIMP, PM, SKIN_P, HAIR_P, HS_N, FH_N, FS_N, EY_N, ACC_N, KIT_P, SIGL, FOOTBALL_TRAITS, TRAIT_BY_ID, PLAYER_PERSONALITIES, TN, CLUB_PHILOSOPHIES } from '../data/thaiFootballData';

export const NMU = new Set<string>();
export function genPlayerName(): string {
  let n = '';
  for (let i = 0; i < 40; i++) {
    const first = Math.random() < 0.5 ? P(A1) + P(A2) : P(FN);
    const last = Math.random() < 0.5 ? P(S1) + P(S2) : P(SN);
    n = `${first} ${last}`;
    if (!NMU.has(n)) break;
  }
  NMU.add(n);
  return n;
}

export function clearNamePool() {
  NMU.clear();
}

export function genClubNames(): string[][] {
  const u = new Set<string>();
  const tg = [
    ['เอฟซี', 'เอสซี', 'สปอร์ตคลับ', 'ยูธ', 'ซิตี้', ''],
    ['เอฟซี', 'ยูไนเต็ด', 'ซิตี้', 'แอธเลติก', 'เรนเจอร์ส', 'ทาวน์', ''],
    ['', 'ยูไนเต็ด', 'ซิตี้', 'เอฟซี', 'สตาร์', 'โรเวอร์ส', '']
  ];
  return [0, 1, 2].map((t) => {
    const pool = NG[t].slice().sort(() => Math.random() - 0.5);
    const out: string[] = [];
    for (const base of pool) {
      if (out.length >= 16) break;
      const sx = P(tg[t]);
      const n = base + (sx ? ' ' + sx : '');
      if (!u.has(n)) {
        u.add(n);
        out.push(n);
      }
    }
    return out;
  });
}

export const NSL = 5;
export const slotKey = (m: GameMode, k = 1) => (m === 'p' ? 'lk_p' : 'lk_m') + (k > 1 ? `_${k}` : '');

export function saveGameToSlot(s: GameState, slot: number) {
  try {
    localStorage.setItem(slotKey(s.mode, slot), JSON.stringify(s));
  } catch {
    // ignore quota errors
  }
}

export function loadGameFromSlot(m: GameMode, slot: number): GameState | null {
  try {
    const raw = localStorage.getItem(slotKey(m, slot));
    if (!raw) return null;
    const d = JSON.parse(raw) as GameState;
    if (Array.isArray(d?.teams)) {
      d.teams.forEach((tm) => {
        tm.sq?.forEach((q) => {
          if ((q.ro as string) === 'SS') q.ro = 'CF';
        });
        if (Array.isArray(tm.cf)) {
          tm.cf = tm.cf.map(([sp, x, y]) => [((sp as string) === 'SS' ? 'CF' : sp) as SubRole, x, y]);
        }
        assignTeamShirtNumbers(tm);
      });
      if (d.mode === 'p' && d.p) {
        if ((d.p.sp as string) === 'SS') d.p.sp = 'CF';
        const mePl = d.teams[d.me]?.sq.find((q) => q.me);
        if (mePl?.no) d.p.no = mePl.no;
      }
      ensureAiTeamPhilosophies(d, false);
    }
    return d;
  } catch {
    return null;
  }
}

export function deleteSlot(m: GameMode, slot: number) {
  try {
    localStorage.removeItem(slotKey(m, slot));
  } catch {
    // ignore
  }
}

export function firstEmptySlot(m: GameMode): number {
  for (let k = 1; k <= NSL; k++) {
    if (!loadGameFromSlot(m, k)) return k;
  }
  return 0;
}

export const SPW = (p: Position): SubRole =>
  p === 'DF'
    ? P(['CB', 'CB', 'CB', 'LB', 'RB', 'LWB', 'RWB'])
    : p === 'MF'
      ? P(['CM', 'CM', 'CDM', 'CAM', 'LM', 'RM'])
      : p === 'FW'
        ? P(['ST', 'ST', 'CF', 'LW', 'RW'])
        : 'GK';

export const NOP: Record<string, number[]> = {
  GK: [1, 12, 13, 23, 30, 31],
  DF: [2, 3, 4, 5, 15, 16, 22, 24, 25, 26],
  MF: [6, 8, 10, 7, 14, 17, 18, 20, 21, 27, 28],
  FW: [9, 11, 19, 29, 32, 33, 34]
};

export function getShirtNo(team: Team | null | undefined, q: Partial<Player>): number {
  if (q.no && q.no >= 1 && q.no <= 99) return q.no;
  if (!team) return Array.isArray(q.vis) && q.vis[5] ? q.vis[5] : q.pos === 'GK' ? 1 : 10;
  const used = new Set(team.sq.map((z) => z.no).filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 99));
  let n = (NOP[q.pos || 'MF'] || []).find((v) => !used.has(v));
  if (!n) {
    for (let i = 35; i <= 99; i++) {
      if (!used.has(i)) { n = i; break; }
    }
  }
  if (!n) {
    for (let i = 1; i <= 34; i++) {
      if (!used.has(i)) { n = i; break; }
    }
  }
  return n || 10;
}

const ROLE_PREFERRED_NOS: Record<SubRole, number[]> = {
  GK: [1, 13, 23, 30, 31, 12],
  RB: [2, 12, 15, 22, 24],
  RWB: [2, 12, 22, 15, 24],
  LB: [3, 12, 16, 21, 26],
  LWB: [3, 12, 16, 21, 26],
  CB: [4, 5, 6, 15, 16, 22, 24, 25],
  CDM: [6, 4, 16, 14, 18, 21],
  LDM: [6, 16, 14, 4, 18],
  RDM: [6, 14, 16, 4, 18],
  CM: [8, 6, 14, 18, 20, 21],
  LCM: [8, 14, 18, 20, 6],
  RCM: [8, 18, 14, 20, 6],
  CAM: [10, 7, 20, 14, 21],
  RM: [7, 11, 17, 14, 27],
  LM: [11, 7, 17, 20, 28],
  RW: [7, 11, 17, 19, 27],
  LW: [11, 7, 17, 19, 28],
  ST: [9, 10, 19, 11, 29],
  CF: [9, 10, 11, 19, 29]
};

export function autoAssignAllTeamShirtNumbers(
  team: Team,
  careerP?: PlayerCareerProfile | null
): number {
  const starters = xi(team);
  const starterSlotMap = new Map<string, SubRole>();
  const slots = getFormationSlots(team);
  starters.forEach((q, idx) => {
    starterSlotMap.set(q.n, slots[idx]?.sp || q.ro);
  });

  const starterSet = new Set(starters.map((q) => q.n));
  const sortedStarters = starters
    .slice()
    .sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov);
  const sortedReserves = team.sq
    .filter((q) => !starterSet.has(q.n))
    .slice()
    .sort((a, b) => b.ov - a.ov || POS.indexOf(a.pos) - POS.indexOf(b.pos));

  const prevNos = new Map<string, number | undefined>();
  team.sq.forEach((q) => prevNos.set(q.n, q.no));

  const used = new Set<number>();
  const pickNextNo = (q: Player, isStarter: boolean): number => {
    const slotRole = starterSlotMap.get(q.n) || q.ro;
    const rolePool = ROLE_PREFERRED_NOS[slotRole] || [];
    const posPool = NOP[q.pos] || [];
    const candidates = isStarter
      ? [...rolePool, ...posPool]
      : [
          ...(q.pos === 'GK' ? [13, 23, 30, 31, 12] : []),
          ...posPool.filter((n) => n >= 12),
          ...rolePool.filter((n) => n >= 12)
        ];

    for (const n of candidates) {
      if (!used.has(n)) return n;
    }
    for (let i = 12; i <= 99; i++) {
      if (!used.has(i)) return i;
    }
    for (let i = 1; i <= 11; i++) {
      if (!used.has(i)) return i;
    }
    return 10;
  };

  let changed = 0;
  [...sortedStarters.map((q) => [q, true] as const), ...sortedReserves.map((q) => [q, false] as const)].forEach(
    ([q, isStarter]) => {
      const nextNo = pickNextNo(q, isStarter);
      used.add(nextNo);
      if (prevNos.get(q.n) !== nextNo) changed++;
      q.no = nextNo;
      if (Array.isArray(q.vis) && q.vis.length >= 6) {
        q.vis[5] = nextNo;
      }
      if (q.me && careerP) {
        careerP.no = nextNo;
      }
    }
  );
  return changed;
}

export function assignTeamShirtNumbers(team: Team) {
  const used = new Set<number>();
  const ordered = [
    ...team.sq.filter((q) => q.me),
    ...team.sq.filter((q) => !q.me)
  ];
  ordered.forEach((q) => {
    if (q.no && q.no >= 1 && q.no <= 99 && !used.has(q.no)) {
      used.add(q.no);
    } else {
      q.no = undefined;
    }
  });
  ordered.forEach((q) => {
    if (!q.no) {
      let n = (NOP[q.pos] || []).find((v) => !used.has(v));
      if (!n) {
        for (let i = 35; i <= 99; i++) {
          if (!used.has(i)) { n = i; break; }
        }
      }
      if (!n) {
        for (let i = 1; i <= 34; i++) {
          if (!used.has(i)) { n = i; break; }
        }
      }
      q.no = n || 10;
      used.add(q.no);
    }
    if (Array.isArray(q.vis) && q.vis.length >= 6) {
      q.vis[5] = q.no;
    }
  });
}

const HANDSOME_HAIR_POOL = [14, 15, 16, 17, 18, 19, 9, 7, 5, 2, 0, 1, 6, 10];
const HANDSOME_EYE_POOL = [0, 2, 5, 8, 9, 3, 6, 7];
const HANDSOME_SHAPE_POOL = [0, 2, 3, 5, 4];

export function rndVis(pos: Position, yo?: boolean): number[] {
  return [
    P([0, 0, 1, 1, 2, 2, 5, 5, 6, 3]),
    P([0, 0, 0, 1, 1, 2, 4, 5]),
    P(HANDSOME_HAIR_POOL),
    yo || R(0, 9) < 7 ? 0 : P([4, 4, 1, 5, 3]),
    P(HANDSOME_EYE_POOL),
    pos === 'GK' ? 1 : 10,
    P(HANDSOME_SHAPE_POOL),
    R(0, 9) < 8 ? 0 : P([1, 4, 2])
  ];
}

export function visOf(q: Partial<Player>, careerP?: PlayerCareerProfile | null): number[] {
  if (q.me && careerP) {
    const ki = SKIN_P.indexOf(careerP.k);
    const hi = HAIR_P.indexOf(careerP.h);
    const no = q.no || careerP.no || 10;
    return [
      ki >= 0 ? ki : 2,
      hi >= 0 ? hi : 0,
      careerP.hs ?? 0,
      careerP.fh ?? 0,
      careerP.ey ?? 0,
      no,
      careerP.fs ?? 0,
      careerP.acc ?? 0
    ];
  }
  if (Array.isArray(q.vis) && q.vis.length >= 5) {
    const v = q.vis;
    const no = q.no || v[5] || 10;
    return [
      v[0],
      v[1],
      v[2],
      v[3],
      v[4],
      no,
      v.length >= 7 ? v[6] : (v[0] + v[1] + v[2] + no) % FS_N.length,
      v.length >= 8 ? v[7] : 0
    ];
  }
  const s = q.n || 'นักเตะ';
  const h = [...s].reduce((a, c, i) => ((a * 33) ^ (c.charCodeAt(0) * (i + 1))) >>> 0, 5381);
  const no = q.no || (q.pos === 'GK' ? [1, 13, 22, 25, 30][h % 5] : 2 + (h % 98));
  return [
    h % Math.min(7, SKIN_P.length),
    (h >> 3) % Math.min(6, HAIR_P.length),
    HANDSOME_HAIR_POOL[(h >> 6) % HANDSOME_HAIR_POOL.length],
    (q.age && q.age < 20) || ((h >> 9) % 10 < 7) ? 0 : [4, 1, 5, 3, 2][(h >> 11) % 5],
    HANDSOME_EYE_POOL[(h >> 13) % HANDSOME_EYE_POOL.length],
    no,
    HANDSOME_SHAPE_POOL[(h >> 16) % HANDSOME_SHAPE_POOL.length],
    ((h >> 19) % 10 < 8) ? 0 : [1, 4, 2][(h >> 22) % 3]
  ];
}

export function rollPlayerTraits(
  pos: Position,
  ro: SubRole,
  ov = 60,
  talent = 60,
  seedStr?: string
): string[] {
  let seed = 0;
  if (seedStr) {
    seed = [...seedStr].reduce((a, c, i) => ((a * 33) ^ (c.charCodeAt(0) * (i + 1))) >>> 0, 5381);
  }
  const nextRand = () => {
    if (!seedStr) return Math.random();
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const rRoll = nextRand();
  let count = rRoll < 0.2 ? 2 : rRoll < 0.72 ? 3 : 4;
  if (ov >= 78 || talent >= 82) count = Math.max(count, rRoll < 0.5 ? 3 : 4);
  if (ov < 52 && talent < 60 && count > 2) count = 2;
  if (pos === 'GK' && count > 3) count = 3;

  const candidates = FOOTBALL_TRAITS.filter((t) => t.pos.includes(pos));
  const picked: FootballTraitDef[] = [];

  for (let step = 0; step < count && candidates.length > 0; step++) {
    const avail = candidates.filter(
      (t) =>
        !picked.some((x) => x.id === t.id) &&
        !picked.some((x) => t.conflicts?.includes(x.id) || x.conflicts?.includes(t.id))
    );
    if (!avail.length) break;
    const weighted: FootballTraitDef[] = [];
    avail.forEach((t) => {
      let w = 2;
      if (t.roles?.includes(ro)) w += 4;
      if (t.pos.length === 1) w += 2;
      if (step === 0 && (t.tone === 'gk' || (pos === 'FW' && t.tone === 'att') || (pos === 'DF' && t.tone === 'def') || (pos === 'MF' && t.tone === 'play'))) {
        w += 3;
      }
      for (let k = 0; k < w; k++) weighted.push(t);
    });
    const chosen = weighted[Math.floor(nextRand() * weighted.length)] || avail[0];
    picked.push(chosen);
  }

  return picked.map((t) => t.id);
}

export function getPlayerTraits(
  q: Partial<Player>,
  careerP?: PlayerCareerProfile | null
): FootballTraitDef[] {
  const raw = q.me && careerP?.traits?.length ? careerP.traits : q.traits;
  const ids =
    raw && raw.length > 0
      ? raw
      : rollPlayerTraits(q.pos || 'MF', q.ro || 'CM', q.ov || 60, q.talent || 60, `${q.n || 'นักเตะ'}:${q.pos || 'MF'}:${q.ro || 'CM'}`);
  return ids.map((id) => TRAIT_BY_ID[id]).filter((t): t is FootballTraitDef => Boolean(t));
}

export function hasTrait(
  q: Partial<Player> | string[] | undefined,
  traitId: string,
  careerP?: PlayerCareerProfile | null
): boolean {
  if (!q) return false;
  if (Array.isArray(q)) return q.includes(traitId);
  return getPlayerTraits(q, careerP).some((t) => t.id === traitId);
}

export interface PlayerBio {
  heightCm: number;
  weightKg: number;
  foot: PreferredFoot;
  footLabel: string;
  footShort: string;
  physiqueLabel: string;
}

const hashBioSeed = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export function rollPlayerBio(
  pos: Position,
  ro: SubRole,
  seedKey?: string
): { ht: number; wt: number; foot: PreferredFoot } {
  let s = seedKey ? hashBioSeed(`${seedKey}:${pos}:${ro}`) : 0;
  const nextRand = (): number => {
    if (!seedKey) return Math.random();
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const randInt = (lo: number, hi: number) => Math.floor(nextRand() * (hi - lo + 1)) + lo;

  let minH = 169;
  let maxH = 183;
  let bmiBase = 22.1;
  if (pos === 'GK') {
    minH = 182;
    maxH = 194;
    bmiBase = 23.0;
  } else if (ro === 'CB') {
    minH = 179;
    maxH = 192;
    bmiBase = 23.1;
  } else if (ro === 'ST' || ro === 'CF') {
    minH = 173;
    maxH = 189;
    bmiBase = 22.8;
  } else if (ro === 'CDM' || ro === 'LDM' || ro === 'RDM') {
    minH = 173;
    maxH = 186;
    bmiBase = 22.5;
  } else if (['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM', 'LW', 'RW'].includes(ro)) {
    minH = 166;
    maxH = 181;
    bmiBase = 21.5;
  } else if (pos === 'DF') {
    minH = 174;
    maxH = 187;
    bmiBase = 22.4;
  } else if (pos === 'FW') {
    minH = 170;
    maxH = 185;
    bmiBase = 22.0;
  }

  const ht = clamp(Math.round((randInt(minH, maxH) + randInt(minH, maxH)) / 2), 160, 200);
  const bmi = bmiBase + (nextRand() * 2.2 - 1.1);
  const wt = clamp(Math.round((ht / 100) ** 2 * bmi), 56, 98);

  const footRoll = nextRand();
  let foot: PreferredFoot;
  if (ro === 'LB' || ro === 'LWB' || ro === 'LM') {
    foot = footRoll < 0.72 ? 'L' : footRoll < 0.88 ? 'B' : 'R';
  } else if (ro === 'RB' || ro === 'RWB' || ro === 'RM') {
    foot = footRoll < 0.78 ? 'R' : footRoll < 0.91 ? 'B' : 'L';
  } else if (ro === 'LW' || ro === 'RW') {
    foot = footRoll < 0.56 ? 'R' : footRoll < 0.84 ? 'L' : 'B';
  } else {
    foot = footRoll < 0.68 ? 'R' : footRoll < 0.89 ? 'L' : 'B';
  }
  return { ht, wt, foot };
}

export function getPlayerBio(
  q: Pick<Player, 'n' | 'pos' | 'ro' | 'ht' | 'wt' | 'foot' | 'me'> | null | undefined,
  careerP?: Pick<PlayerCareerProfile, 'name' | 'pos' | 'sp' | 'ht' | 'wt' | 'foot'> | null
): PlayerBio {
  const po = q?.me ? careerP : careerP || null;
  const pos = (po?.pos || q?.pos || 'MF') as Position;
  const ro = (po?.sp || q?.ro || 'CM') as SubRole;
  const seed = q?.n || po?.name || 'player';
  const fallback = rollPlayerBio(pos, ro, seed);
  const heightCm = clamp(Math.round((q?.me ? po?.ht : undefined) ?? q?.ht ?? po?.ht ?? fallback.ht), 155, 205);
  const weightKg = clamp(Math.round((q?.me ? po?.wt : undefined) ?? q?.wt ?? po?.wt ?? fallback.wt), 50, 110);
  const rawFoot = (q?.me ? po?.foot : undefined) ?? q?.foot ?? po?.foot ?? fallback.foot;
  const foot: PreferredFoot = rawFoot === 'L' || rawFoot === 'R' || rawFoot === 'B' ? rawFoot : fallback.foot;
  const footLabel = foot === 'L' ? 'เท้าซ้าย' : foot === 'B' ? 'สองเท้า' : 'เท้าขวา';
  const footShort = foot === 'L' ? 'เท้าซ้าย' : foot === 'B' ? 'สองเท้า' : 'เท้าขวา';
  const bmi = weightKg / ((heightCm / 100) ** 2);
  const physiqueLabel =
    heightCm >= 186
      ? 'สูงใหญ่'
      : bmi >= 23.6
        ? 'กำยำ'
        : heightCm <= 171
          ? 'คล่องปราดเปรียว'
          : 'สมส่วน';
  return { heightCm, weightKg, foot, footLabel, footShort, physiqueLabel };
}

export function mkPlayer(pos: Position, baseOv: number, yo?: boolean, forceRo?: SubRole): Player {
  const age = yo ? R(16, 18) : R(17, 34);
  const ov = yo ? clamp(baseOv + R(-6, 4), 20, 82) : clamp(baseOv + R(-9, 9), 25, 92);
  const talent = yo
    ? clamp(Math.round(48 + (ov - 45) * 0.45 + R(8, 36)), 40, 96)
    : clamp(Math.round(38 + (ov - 50) * 0.55 + R(-10, 30)), 28, 95);
  const potBoost = talent >= 80 ? R(4, 10) : 0;
  const ro = forceRo || SPW(pos);
  const bio = rollPlayerBio(pos, ro);
  return {
    n: genPlayerName(),
    pos,
    ro,
    sp: 0,
    ov,
    age,
    ht: bio.ht,
    wt: bio.wt,
    foot: bio.foot,
    pot: clamp(ov + (age < 24 ? R(4, 25) + Math.round(potBoost * 0.5) : R(0, 3)), ov, 95),
    talent,
    traits: rollPlayerTraits(pos, ro, ov, talent),
    fit: 100,
    inj: 0,
    vis: rndVis(pos, yo)
  };
}

export function pickClubPhilosophy(id: number, tier: number, diff = 0, randomize = true): ClubPhilosophyDef {
  const pool = CLUB_PHILOSOPHIES.filter((ph) => {
    if (diff >= 3 || tier >= 2) return ph.styleGroup !== 'counter' || Math.random() < 0.35;
    if (diff <= -3) return ph.styleGroup !== 'attack' || Math.random() < 0.35;
    return true;
  });
  const candidates = pool.length ? pool : CLUB_PHILOSOPHIES;
  if (!randomize) {
    return candidates[Math.abs(id * 7 + tier * 3) % candidates.length];
  }
  const offset = R(0, candidates.length - 1);
  return candidates[(Math.abs(id) + offset) % candidates.length];
}

export function applyClubPhilosophy(team: Team, ph: ClubPhilosophyDef) {
  team.form = ph.form;
  team.tac = ph.tac;
  team.press = ph.press;
  team.tempo = ph.tempo;
  team.wid = ph.wid;
  team.line = ph.line;
  team.pass = ph.pass;
  team.philosophy = ph.name;
  team.lu = null;
}

export function ensureAiTeamPhilosophies(s: GameState, allowSeasonRefresh = false) {
  s.teams.forEach((t) => {
    if (s.mode === 'm' && t.id === s.me) return;
    const isLegacyUniform =
      !t.philosophy &&
      t.form === '4-4-2' &&
      t.tac === 'B' &&
      (t.press ?? 1) === 1 &&
      (t.tempo ?? 1) === 1 &&
      (t.wid ?? 1) === 1 &&
      (t.line ?? 1) === 1 &&
      (t.pass ?? 1) === 1;
    if (isLegacyUniform || (allowSeasonRefresh && Math.random() < 0.18)) {
      const avgOv = t.sq.length ? t.sq.reduce((sum, q) => sum + q.ov, 0) / t.sq.length : BASE[t.tier] || 55;
      const relDiff = Math.round(avgOv - (BASE[Math.min(t.tier, BASE.length - 1)] || 55));
      const ph = pickClubPhilosophy(t.id, t.tier, relDiff, true);
      applyClubPhilosophy(t, ph);
    } else if (!t.philosophy) {
      const matched = CLUB_PHILOSOPHIES.find((p) => p.form === t.form && p.tac === t.tac) || CLUB_PHILOSOPHIES.find((p) => p.form === t.form);
      if (matched) t.philosophy = matched.name;
    }
  });
}

export function mkTeam(name: string, tier: number, id: number, diff = R(-7, 7)): Team {
  const kp = KIT_P[(id + tier * 5) % KIT_P.length];
  const hasSpace = name.includes(' ');
  const sx = hasSpace ? '' : P(SFX0[tier] || ['']);
  const ph = pickClubPhilosophy(id, tier, diff, true);
  const fsdSlots = FSD[ph.form] || FSD['4-4-2'];
  const slotRolesByPos: Record<Position, SubRole[]> = { GK: [], DF: [], MF: [], FW: [] };
  fsdSlots.forEach(([sp]) => {
    const normSp = ((sp as string) === 'SS' ? 'CF' : sp) as SubRole;
    const pos = LINE[normSp] || 'MF';
    slotRolesByPos[pos].push(normSp);
  });

  const baseOv = BASE[tier] + diff;
  const sq: Player[] = (
    [
      ['GK', 3],
      ['DF', 8],
      ['MF', 7],
      ['FW', 5]
    ] as [Position, number][]
  ).flatMap(([p, c]) => {
    const preferredRoles = slotRolesByPos[p];
    return Array.from({ length: c }, (_, idx) => {
      const forceRo = idx < preferredRoles.length ? preferredRoles[idx] : undefined;
      return mkPlayer(p, baseOv + R(-4, 4), false, forceRo);
    });
  });

  const team: Team = {
    id,
    name: name + (sx ? ' ' + sx : ''),
    tier,
    kc: [kp[0], kp[1]],
    sq,
    form: ph.form,
    tac: ph.tac,
    press: ph.press,
    tempo: ph.tempo,
    wid: ph.wid,
    line: ph.line,
    pass: ph.pass,
    philosophy: ph.name,
    pts: 0,
    gf: 0,
    ga: 0,
    w: 0,
    d: 0,
    l: 0,
    p: 0,
    fm: '',
    tacFam: R(62, 76),
    fans: Math.max(
      2500,
      Math.round(
        ([9500, 26000, 78000, 165000][tier] ?? 24000) * (1 + diff * 0.045) +
          R(-1800, 3200) * (tier + 1)
      )
    )
  };
  assignTeamShirtNumbers(team);
  return team;
}

export const getFormationSlots = (t?: Team): { sp: SubRole; x: number; y: number; pos: Position }[] => {
  const raw = t?.form === 'custom' && t.cf && t.cf.length === 11 ? t.cf : FSD[t?.form || '4-4-2'] || FSD['4-4-2'];
  return raw.map(([sp, x, y]) => {
    const normSp = ((sp as string) === 'SS' ? 'CF' : sp) as SubRole;
    return { sp: normSp, x, y, pos: LINE[normSp] || 'MF' };
  });
};

export const getFormationCounts = (t?: Team): number[] => {
  const slots = getFormationSlots(t);
  return ['GK', 'DF', 'MF', 'FW'].map((p) => slots.filter((z) => z.pos === p).length);
};

export const pen = (r: string, sp: string) => {
  const r2 = EQ[r] || r;
  const s2 = EQ[sp] || sp;
  if (!s2 || r2 === s2) return 0;
  if (SIMP.includes(`${r2} ${s2}`) || SIMP.includes(`${s2} ${r2}`)) return 1;
  if (LINE[r] && LINE[sp] && LINE[r] === LINE[sp]) return 1;
  return 2;
};

export const playerPen = (
  q: Pick<Player, 'ro' | 'altRoles'> | null | undefined,
  sp: string
): number => {
  if (!q || !sp) return 0;
  let best = pen(q.ro, sp);
  if (best > 0 && q.altRoles?.length) {
    for (let i = 0; i < q.altRoles.length; i++) {
      const altP = pen(q.altRoles[i], sp);
      if (altP < best) {
        best = altP;
        if (best === 0) break;
      }
    }
  }
  return best;
};

export const fixRo = (q: Player) => {
  if ((q.ro as string) === 'SS') q.ro = 'CF';
  if (!q.ro) {
    q.ro = typeof q.sp === 'string' && LINE[q.sp] === q.pos ? (q.sp as SubRole) : SPW(q.pos);
  }
  if (typeof q.sp === 'string') q.sp = 0;
};

export const OVF = (p: Position, a: CoreAttrs) =>
  Math.round(
    p === 'FW'
      ? a.sh * 0.45 + a.dr * 0.25 + a.ps * 0.15 + a.ph * 0.15
      : p === 'MF'
        ? a.ps * 0.4 + a.dr * 0.2 + a.sh * 0.15 + a.tk * 0.15 + a.ph * 0.1
        : p === 'GK'
          ? a.ph * 0.5 + a.tk * 0.3 + a.ps * 0.15 + a.dr * 0.05
          : a.tk * 0.45 + a.ph * 0.3 + a.ps * 0.15 + a.dr * 0.1
  );

export function fitA(q: Player, a: CoreAttrs): CoreAttrs {
  for (let n = 0; n < 4; n++) {
    const d = q.ov - OVF(q.pos, a);
    if (!d) break;
    ATT.forEach(([k]) => {
      a[k] = clamp(a[k] + d, 10, 99);
    });
  }
  return a;
}

export const ef = (q: Player) => {
  const fitVal = q.fit ?? 100;
  const tiredPenalty = fitVal < 58 ? (58 - fitVal) * 0.45 : 0;
  return q.ov * (0.75 + (0.25 * fitVal) / 100) - tiredPenalty - (q.inj > 0 || (q.sus || 0) > 0 ? 60 : 0);
};

export function xi(t: Team): Player[] {
  const sl = getFormationSlots(t);
  t.sq.forEach(fixRo);
  const auto = () => {
    const o: Player[] = [];
    const rotationReadiness = (q: Player) => {
      const f = q.fit ?? 100;
      if (q.pos === 'GK') {
        if (f >= 72) return 1;
        if (f >= 60) return 0.92;
        return 0.72;
      }
      if (q.me) {
        // Career player isn't benched prematurely unless visibly tired
        if (f >= 70) return 1;
        if (f >= 60) return 0.84 + ((f - 60) / 10) * 0.14;
        return Math.max(0.55, 0.58 + (f - 40) * 0.012);
      }
      if (f >= 82) return 1;
      if (f >= 74) return 0.93 + ((f - 74) / 8) * 0.07;
      if (f >= 64) return 0.71 + ((f - 64) / 10) * 0.22;
      return Math.max(0.32, 0.42 + (f - 40) * 0.011);
    };
    const uq = new Set<Player>();
    const ui = new Set<number>();
    POS.forEach((p) => {
      const ix = sl.map((z, i) => (z.pos === p ? i : -1)).filter((i) => i >= 0);
      const pr: [number, Player, number][] = [];
      t.sq
        .filter((q) => !uq.has(q) && (q.pos === p || (q.altRoles?.some((r) => LINE[r] === p) ?? false)))
        .forEach((q) =>
          ix.forEach((i) => pr.push([ef(q) * rotationReadiness(q) * PM[playerPen(q, sl[i].sp)], q, i]))
        );
      pr.sort((a, b) => b[0] - a[0]);
      pr.forEach(([, q, i]) => {
        if (uq.has(q) || ui.has(i)) return;
        uq.add(q);
        ui.add(i);
        o[i] = q;
      });
    });
    // Fallback: if injuries/formation changes leave any slot empty, assign best fit available player out-of-position
    sl.forEach((slot, i) => {
      if (o[i]) return;
      const cand = t.sq
        .filter((q) => !uq.has(q) && (slot.pos === 'GK' ? true : q.pos !== 'GK'))
        .sort(
          (a, b) =>
            ef(b) * rotationReadiness(b) * PM[playerPen(b, slot.sp)] -
            ef(a) * rotationReadiness(a) * PM[playerPen(a, slot.sp)]
        )[0] || t.sq.find((q) => !uq.has(q));
      if (cand) {
        uq.add(cand);
        ui.add(i);
        o[i] = cand;
      }
    });
    return o.filter(Boolean);
  };
  if (!t.lu) return auto();
  const x = t.lu.map((n) => t.sq.find((q) => q.n === n)).filter((q): q is Player => Boolean(q));
  if (x.length !== 11 || new Set(x).size !== 11) {
    t.lu = null;
    return auto();
  }
  const used = new Set(x);
  return x.map((q, i) => {
    if (!(q.inj > 0 || (q.sus || 0) > 0)) return q;
    const slotPos = sl[i]?.pos || q.pos;
    const avail = t.sq.filter((z) => !used.has(z) && !(z.inj > 0 || (z.sus || 0) > 0));
    const s =
      avail.filter((z) => z.pos === slotPos).sort((a, b) => ef(b) - ef(a))[0] ||
      avail.sort((a, b) => ef(b) - ef(a))[0];
    if (s) {
      used.add(s);
      return s;
    }
    return q;
  });
}

export function DT(q: Player, careerP?: PlayerCareerProfile | null) {
  const po = q.me ? careerP : null;
  const aSrc = po?.a;
  const sb = po?.sb || q.sb;
  const h = [...(q.n || 'นักเตะ')].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const o: Record<string, Partial<CoreAttrs>> = {
    FW: { sh: 8, dr: 4, tk: -12 },
    MF: { ps: 8, dr: 2, tk: 2 },
    DF: { tk: 8, ph: 4, sh: -12 },
    GK: { ph: 6, tk: 6, sh: -20, dr: -15 }
  };
  const roleMod: Partial<Record<SubRole, Partial<CoreAttrs>>> = {
    CF: { ps: 5, dr: 2, sh: -2 },
    ST: { sh: 4, ph: 2, ps: -4 }
  };
  const rawBaseA: CoreAttrs = aSrc
    ? { ...aSrc }
    : q.customA
      ? {
          sh: clamp(Math.round(q.customA.sh), 1, 99),
          ps: clamp(Math.round(q.customA.ps), 1, 99),
          dr: clamp(Math.round(q.customA.dr), 1, 99),
          tk: clamp(Math.round(q.customA.tk), 1, 99),
          ph: clamp(Math.round(q.customA.ph), 1, 99)
        }
      : fitA(
          q,
          Object.fromEntries(
            ATT.map(([kk], i) => [kk, clamp(q.ov + (o[q.pos][kk] || 0) + (roleMod[q.ro]?.[kk] || 0) + ((h * (i + 3)) % 11) - 5, 10, 99)])
          ) as unknown as CoreAttrs
        );
  const baseA: CoreAttrs =
    !po && q.coreSb
      ? {
          sh: clamp(Math.round(rawBaseA.sh + (q.coreSb.sh || 0)), 1, 99),
          ps: clamp(Math.round(rawBaseA.ps + (q.coreSb.ps || 0)), 1, 99),
          dr: clamp(Math.round(rawBaseA.dr + (q.coreSb.dr || 0)), 1, 99),
          tk: clamp(Math.round(rawBaseA.tk + (q.coreSb.tk || 0)), 1, 99),
          ph: clamp(Math.round(rawBaseA.ph + (q.coreSb.ph || 0)), 1, 99)
        }
      : rawBaseA;
  const hv = (n: number) => {
    const raw = (((h * (n * 7 + 3)) ^ (h >> (n % 5))) % 21) - 10;
    return po || q.customA ? Math.round(raw * 0.2) : raw;
  };
  const cl = (v: number) => clamp(Math.round(v), 1, 99);
  const ag = q.age || 24;
  const wing = ['LB', 'RB', 'LM', 'RM', 'LW', 'RW', 'LWB', 'RWB'].includes(q.ro);

  const tlVal = clamp(
    Math.round(
      (q.me && careerP?.talent != null ? careerP.talent : q.talent) ??
        clamp(Math.round(40 + ((q.pot || q.ov) - 55) * 0.5 + ((h % 25) - 10)), 30, 92)
    ),
    25,
    99
  );

  const d: Record<string, number> = {
    pw: cl(baseA.sh * 0.6 + baseA.ph * 0.4 + hv(1)),
    fin: cl(baseA.sh + hv(2) + (q.pos === 'FW' ? 4 : 0) + (q.ro === 'ST' ? 2 : 0)),
    cur: cl(baseA.sh * 0.5 + baseA.ps * 0.5 + hv(3) + (q.ro === 'CAM' || q.ro === 'CF' ? 2 : 0)),
    lsh: cl(baseA.sh * 0.55 + baseA.ph * 0.35 + baseA.ps * 0.1 + hv(32) + (q.ro === 'CAM' || q.ro === 'CM' || q.ro === 'LW' || q.ro === 'RW' ? 3 : 0)),
    fk: cl(baseA.sh * 0.4 + baseA.ps * 0.45 + baseA.dr * 0.15 + hv(20) + (q.pos === 'MF' ? 3 : 0)),
    run: cl(baseA.sh * 0.5 + baseA.dr * 0.3 + baseA.ph * 0.2 + hv(5) + (q.ro === 'ST' || q.ro === 'LW' || q.ro === 'RW' ? 3 : 0)),
    drb: cl(baseA.dr * 0.78 + baseA.ph * 0.12 + tlVal * 0.1 + hv(30) + (q.ro === 'LW' || q.ro === 'RW' || q.ro === 'CAM' || q.ro === 'CF' ? 3 : 0)),
    ctrl: cl(baseA.dr * 0.55 + baseA.ps * 0.35 + tlVal * 0.1 + hv(31) + (q.pos === 'MF' || q.ro === 'CF' ? 3 : 0)),
    spass: cl(baseA.ps * 0.72 + baseA.dr * 0.16 + tlVal * 0.08 + hv(28) + (q.pos === 'MF' ? 4 : q.ro === 'CF' || q.ro === 'CAM' ? 3 : 0)),
    lpass: cl(baseA.ps * 0.65 + baseA.sh * 0.18 + tlVal * 0.10 + hv(29) + (q.ro === 'CM' || q.ro === 'CDM' || q.ro === 'CB' || q.ro === 'LB' || q.ro === 'RB' ? 3 : 0)),
    crs: cl(baseA.ps * 0.7 + baseA.dr * 0.3 + hv(4) + (wing ? 6 : 0) + (q.ro === 'CF' ? 4 : 0)),
    vis: cl(baseA.ps * 0.55 + q.ov * 0.3 + tlVal * 0.15 + hv(26)),
    rd: cl(baseA.tk * 0.6 + baseA.ps * 0.4 + hv(6)),
    tkl: cl(baseA.tk * 0.72 + baseA.ph * 0.18 + baseA.dr * 0.10 + hv(7)),
    pos: cl(
      q.pos === 'GK'
        ? q.ov * 0.25 + baseA.tk * 0.55 + baseA.ps * 0.1 + baseA.ph * 0.1 + hv(21)
        : baseA.tk * 0.55 + baseA.ps * 0.35 + baseA.ph * 0.10 + hv(21) + (q.pos === 'DF' || q.ro === 'CDM' ? 3 : 0)
    ),
    mrk: cl(baseA.tk * 0.65 + baseA.ph * 0.2 + baseA.ps * 0.15 + hv(18) + (q.pos === 'DF' ? 4 : 0)),
    blk: cl(baseA.tk * 0.55 + baseA.ph * 0.35 + baseA.ps * 0.1 + hv(19) + (q.ro === 'CB' ? 4 : 0)),
    hd: cl(baseA.ph * 0.7 + baseA.tk * 0.3 + hv(8)),
    spd: cl(baseA.dr * 0.5 + baseA.ph * 0.5 + hv(9) - Math.max(0, ag - 31) * 2),
    acc: cl(baseA.dr * 0.55 + baseA.ph * 0.45 + hv(33) - Math.max(0, ag - 30) * 2 + (wing ? 2 : 0)),
    str: cl(baseA.ph + hv(10)),
    sta: cl(baseA.ph * 0.8 + hv(11) + (ag < 30 ? 3 : -3)),
    agi: cl(baseA.dr * 0.65 + baseA.ph * 0.25 + (100 - Math.max(0, ag - 28) * 2) * 0.1 + hv(22)),
    jmp: cl(baseA.ph * 0.65 + baseA.tk * 0.2 + (q.pos === 'GK' || q.ro === 'CB' || q.ro === 'ST' ? 5 : 0) + hv(23)),
    tol: cl(55 + baseA.ph * 0.3 + hv(12)),
    rec: cl(82 - Math.max(0, ag - 24) * 2 + hv(0)),
    end: cl(baseA.ph * 0.55 + baseA.tk * 0.15 + 22 + (ag <= 29 ? 4 : -4) + hv(24)),
    bal: cl(baseA.ph * 0.45 + baseA.dr * 0.35 + 15 + hv(25)),
    con: cl(60 + q.ov * 0.25 + baseA.ph * 0.1 + (ag >= 24 && ag <= 31 ? 4 : 0) + hv(34)),
    comp: cl(q.ov * 0.7 + 22 + hv(14)),
    foc: cl(q.ov * 0.52 + baseA.tk * 0.2 + tlVal * 0.18 + 10 + hv(35)),
    ldr: cl(q.ov * 0.48 + (ag >= 27 ? 14 : ag >= 23 ? 8 : 2) + tlVal * 0.16 + 14 + hv(36)),
    det: cl(q.ov * 0.45 + baseA.ph * 0.25 + tlVal * 0.2 + 10 + hv(27)),
    sv: cl(q.ov * 0.7 + baseA.ph * 0.3 + hv(15)),
    rfx: cl(q.ov * 0.65 + baseA.dr * 0.25 + baseA.ph * 0.1 + hv(37)),
    hnd: cl(q.ov * 0.68 + baseA.tk * 0.22 + baseA.ph * 0.1 + hv(38)),
    cl: cl(q.ov * 0.85 + hv(16)),
    dist: cl(baseA.ps * 0.8 + hv(17))
  };

  const sk = q.pos === 'GK'
    ? ['sv', 'rfx', 'hnd', 'cl', 'pos', 'dist', 'sta', 'comp']
    : ['fin', 'pw', 'cur', 'lsh', 'fk', 'run', 'drb', 'ctrl', 'spass', 'lpass', 'crs', 'vis', 'rd', 'tkl', 'pos', 'mrk', 'blk', 'hd', 'spd', 'acc', 'str', 'sta', 'comp'];
  const sig = po?.sig
    ? po.sig
    : q.customSig
      ? q.customSig
      : po?.tr
        ? q.pos === 'GK'
          ? { sh: 'cl', ps: 'dist', dr: 'rfx', tk: 'sv', ph: 'sv' }[po.tr] || 'sv'
          : { sh: 'fin', ps: 'crs', dr: 'drb', tk: 'tkl', ph: 'str' }[po.tr] || sk[h % sk.length]
        : sk[h % sk.length];

  d[sig] = cl(d[sig] + 8);
  if (sb) {
    Object.keys(sb).forEach((z) => {
      if (d[z] != null) d[z] = cl(d[z] + sb[z]);
    });
  }
  const customD = po?.customD || q.customD;
  if (customD) {
    Object.keys(customD).forEach((z) => {
      if (d[z] != null) d[z] = cl(customD[z]);
    });
  }
  const rawPers = po?.customPers ?? q.customPers;
  const tr = rawPers != null && rawPers >= 0 && rawPers < PLAYER_PERSONALITIES.length
    ? rawPers
    : h % PLAYER_PERSONALITIES.length;
  return { a: baseA, h, d, sig, tlVal, tr, pk: 26 + ((h >> 2) % 4) };
}

export function dtInfo(q: Player, careerP?: PlayerCareerProfile | null) {
  const D0 = DT(q, careerP);
  const a = D0.a;
  const f = Math.round(q.fit ?? 100);
  const d = D0.d;
  const gk = q.pos === 'GK';
  const tlVal = D0.tlVal;
  const G: [string, [string, number, string?][]][] = [
    ...((gk
      ? [[
          '🧤 ผู้รักษาประตู',
          [
            ['พุ่งเซฟ', d.sv, 'sv'],
            ['ปฏิกิริยา', d.rfx, 'rfx'],
            ['รับบอล', d.hnd, 'hnd'],
            ['ปิดมุมยิง', d.cl, 'cl'],
            ['ยืนตำแหน่ง', d.pos, 'pos'],
            ['เปิดเกม', d.dist, 'dist']
          ]
        ]]
      : [
          [
            '⚔️ โจมตี',
            [
              ['จบสกอร์', d.fin, 'fin'],
              ['พลังยิง', d.pw, 'pw'],
              ['ยิงโค้ง', d.cur, 'cur'],
              ['ยิงไกล', d.lsh, 'lsh'],
              ['ลูกตั้งเตะ', d.fk, 'fk'],
              ['เข้าทำ', d.run, 'run']
            ]
          ],
          [
            '⚽ การเล่น',
            [
              ['เลี้ยงบอล', d.drb, 'drb'],
              ['จับบอล', d.ctrl, 'ctrl'],
              ['ส่งบอลสั้น', d.spass, 'spass'],
              ['ส่งบอลยาว', d.lpass, 'lpass'],
              ['เปิดบอล', d.crs, 'crs'],
              ['ไหวพริบ', d.vis, 'vis']
            ]
          ],
          [
            '🛡️ ป้องกัน',
            [
              ['อ่านเกม', d.rd, 'rd'],
              ['เข้าสกัด', d.tkl, 'tkl'],
              ['ยืนตำแหน่ง', d.pos, 'pos'],
              ['ประกบตัว', d.mrk, 'mrk'],
              ['บล็อกลูกยิง', d.blk, 'blk'],
              ['โหม่ง', d.hd, 'hd']
            ]
          ]
        ]) as [string, [string, number, string?][]][]),
    [
      '💪 ร่างกาย',
      [
        ['ความเร็ว', d.spd, 'spd'],
        ['สปีดต้น', d.acc, 'acc'],
        ['แข็งแกร่ง', d.str, 'str'],
        ['ความอึด', d.sta, 'sta'],
        ['ความคล่องตัว', d.agi, 'agi'],
        ['พลังกระโดด', d.jmp, 'jmp']
      ]
    ],
    [
      '❤️ ความฟิต',
      [
        ['ฟิตปัจจุบัน', f],
        ['ทนต่อบาดเจ็บ', d.tol, 'tol'],
        ['ฟื้นตัวเร็ว', d.rec, 'rec'],
        ['ยืนระยะเกม', d.end, 'end'],
        ['สมดุลร่างกาย', d.bal, 'bal'],
        ['ความสม่ำเสมอ', d.con, 'con']
      ]
    ],
    [
      '🌟 พรสวรรค์',
      [
        ['ค่าพรสวรรค์', tlVal],
        ['ศักยภาพสูงสุด', q.pot || q.ov],
        ['นิ่งในนัดใหญ่', d.comp, 'comp'],
        ['สมาธิในเกม', d.foc, 'foc'],
        ['ภาวะผู้นำ', d.ldr, 'ldr'],
        ['ความมุ่งมั่น', d.det, 'det']
      ]
    ]
  ];
  const allD = G.flatMap((g) => g[1]).filter((z) => !['ฟิตปัจจุบัน', 'ศักยภาพสูงสุด', 'ค่าพรสวรรค์'].includes(z[0]));
  const sg = allD.find((z) => z[2] === D0.sig) || allD.find((z) => z[0] === SIGL[D0.sig]);
  const ot = allD.filter((z) => z !== sg).sort((u, w) => w[1] - u[1])[0];
  const top = [sg, ot].filter((z): z is [string, number, string?] => Boolean(z));
  const persDef = PLAYER_PERSONALITIES[D0.tr] || PLAYER_PERSONALITIES[3];
  const TR: [string, string] = [persDef.label, persDef.desc];
  const ag = q.age || 24;
  const effPkEnd = D0.pk + (q.pos === 'GK' ? 6 : 4);
  const gro = ag < D0.pk - 2 ? 'กำลังเติบโต' : ag <= effPkEnd ? 'ช่วงพีค' : 'หมดช่วงพีค';
  const stCls = (q.sus || 0) > 0 || q.inj > 0 ? 'bad' : f < 60 ? 'wrn' : 'ok';
  const traits = getPlayerTraits(q, careerP);
  const bio = getPlayerBio(q, careerP);
  const stTxt =
    (q.sus || 0) > 0
      ? `🟥 โดนแบน ${q.sus} นัด`
      : q.inj > 0
        ? `🩹 บาดเจ็บ ${q.inj} นัด`
        : f < 60
          ? `⚠️ เหนื่อยล้า (${f}%)`
          : `✅ พร้อมลง (${f}%)`;
  return { D0, a, f, d, gk, G, top, TR, traits, bio, ag, gro, stCls, stTxt };
}

export function injD(q: Player, n: number, careerP?: PlayerCareerProfile | null): number {
  const r = DT(q, careerP).d.rec;
  return Math.max(1, n + (r >= 80 ? -1 : r < 55 ? 1 : 0));
}

export const ovMe = (p: PlayerCareerProfile) => OVF(p.pos, p.a);

export function getOvGrowthScale(curOv: number, pot?: number): number {
  let s = 1.0;
  if (curOv >= 93) s = 0.04;
  else if (curOv >= 89) s = 0.09;
  else if (curOv >= 84) s = 0.18;
  else if (curOv >= 78) s = 0.32;
  else if (curOv >= 72) s = 0.50;
  else if (curOv >= 64) s = 0.72;
  if (pot != null && curOv >= pot) s *= 0.12;
  return s;
}

export interface PlayerDevProfile {
  D: ReturnType<typeof DT>;
  age: number;
  effPkEnd: number;
  phase: 'growing' | 'peak' | 'declining';
  ageMult: number;
  avgRating: number;
  formMult: number;
  sp: number;
  strongSeason: boolean;
}

export function getPlayerDevProfile(q: Player, careerP?: PlayerCareerProfile | null): PlayerDevProfile {
  const D = DT(q, careerP);
  const age = q.age || 24;
  const effPkEnd = D.pk + (q.pos === 'GK' ? 6 : 4);
  const sp = q.sp || 0;
  const avgRating = (q.sra || 0) > 0 ? (q.srs || 0) / q.sra! : 0;
  const phase: PlayerDevProfile['phase'] =
    age < D.pk - 2 ? 'growing' : age <= effPkEnd ? 'peak' : 'declining';

  let ageMult = 1.0;
  if (phase === 'peak') {
    ageMult = avgRating >= 7.05 ? 0.72 : 0.55;
  } else if (phase === 'declining') {
    ageMult = avgRating >= 7.55 && age <= effPkEnd + 2 ? 0.12 : 0.04;
  }

  let formMult = 0.85;
  if (sp <= 0) {
    formMult = 0.55;
  } else if (avgRating >= 7.5) {
    formMult = 1.45;
  } else if (avgRating >= 7.15) {
    formMult = 1.25;
  } else if (avgRating >= 6.65) {
    formMult = 1.0;
  } else if (avgRating > 0 && avgRating < 6.2) {
    formMult = 0.72;
  }

  const contrib = (q.sg || 0) + (q.sa || 0);
  const strongSeason =
    sp >= 8 &&
    (avgRating >= 7.15 ||
      contrib >= 9 ||
      (q.pos === 'GK' && (q.cs || 0) >= 5) ||
      (q.motm || 0) >= 2);

  return { D, age, effPkEnd, phase, ageMult, avgRating, formMult, sp, strongSeason };
}

export function trySuperstarBreakthrough(
  q: Player,
  careerP?: PlayerCareerProfile | null,
  baseChance = 0.03
): { brokeThrough: boolean; newPot: number; becameSuperstar: boolean } {
  const prof = getPlayerDevProfile(q, careerP);
  const curPot = q.pot || Math.max(q.ov + 2, 78);
  if (prof.phase === 'declining' || !prof.strongSeason || q.ov < curPot - 3 || curPot >= 96) {
    return { brokeThrough: false, newPot: curPot, becameSuperstar: false };
  }
  const tlVal = prof.D.tlVal;
  const talentFactor = 0.52 + (tlVal / 100) * 0.88;
  const formBoost = prof.avgRating >= 7.55 ? 1.55 : prof.avgRating >= 7.25 ? 1.25 : 0.95;
  const ageFactor = prof.phase === 'growing' ? 1.15 : 0.82;
  const chance = clamp(baseChance * talentFactor * formBoost * ageFactor, 0.005, 0.42);
  if (Math.random() >= chance) {
    return { brokeThrough: false, newPot: curPot, becameSuperstar: false };
  }
  const gain = (prof.avgRating >= 7.5 || tlVal >= 78) && Math.random() < 0.4 ? 2 : 1;
  const newPot = clamp(curPot + gain, q.ov + 1, 96);
  const wasSuperstar = curPot >= 86;
  q.pot = newPot;
  q.talent = clamp((q.talent ?? tlVal) + R(1, 2), 30, 98);
  if (q.me && careerP) {
    careerP.talent = q.talent;
  }
  return { brokeThrough: true, newPot, becameSuperstar: !wasSuperstar && newPot >= 86 };
}

export function autoGrow(p: PlayerCareerProfile, n = 1): string {
  const map: Record<Position, StatKey[]> = {
    FW: ['sh', 'sh', 'sh', 'dr', 'dr', 'ps', 'ph'],
    MF: ['ps', 'ps', 'ps', 'dr', 'dr', 'sh', 'tk', 'ph'],
    DF: ['tk', 'tk', 'tk', 'ph', 'ph', 'ps', 'dr'],
    GK: ['ph', 'ph', 'ph', 'tk', 'tk', 'ps']
  };
  const w = (map[p.pos] || ['sh', 'ps', 'dr']).slice();
  if (p.tr) w.push(p.tr, p.tr);
  const add: Partial<Record<StatKey, number>> = {};
  for (let i = 0; i < n; i++) {
    const av = w.filter((k) => p.a[k] < 99);
    if (!av.length) break;
    // Prefer attributes that haven't hit extreme levels yet for realistic multi-season balance
    const lowAv = av.filter((k) => p.a[k] < 82);
    const k = lowAv.length && Math.random() < 0.8 ? P(lowAv) : P(av);
    if (p.a[k] >= 90 && Math.random() > 0.25) continue;
    if (p.a[k] >= 84 && Math.random() > 0.48) continue;
    if (p.a[k] >= 78 && Math.random() > 0.75) continue;
    p.a[k]++;
    p.trn = (p.trn || 0) + 1;
    add[k] = (add[k] || 0) + 1;
  }
  return Object.entries(add)
    .map(([k, v]) => `${ATT.find((z) => z[0] === k)?.[1] || k} +${v}`)
    .join(', ');
}

export function syncMe(s: GameState) {
  if (s.mode !== 'p' || !s.p) return;
  if (s.p.pts > 0) {
    autoGrow(s.p, s.p.pts);
    s.p.pts = 0;
  }
  const q = s.teams[s.me]?.sq.find((x) => x.me);
  if (q) {
    q.ov = ovMe(s.p);
    q.fit = s.p.en ?? 100;
    q.sp = s.p.ap ?? q.sp ?? 0;
    q.sg = s.p.gl ?? q.sg ?? 0;
    q.sa = s.p.as ?? q.sa ?? 0;
    q.yc = s.p.yc ?? q.yc ?? 0;
    q.rc = s.p.rc ?? q.rc ?? 0;
    q.sus = s.p.sus ?? q.sus ?? 0;
    q.inj = s.p.inj ?? q.inj ?? 0;
    if (s.p.no) q.no = s.p.no;
    else if (q.no) s.p.no = q.no;
    q.vis = visOf(q, s.p);
    if (s.p.sb) q.sb = { ...s.p.sb };
    else if (q.sb) s.p.sb = { ...q.sb };
    if (s.p.missions) q.missions = s.p.missions;
    else if (q.missions) s.p.missions = q.missions;
    if (s.p.talent != null) q.talent = s.p.talent;
    else if (q.talent != null) s.p.talent = q.talent;
    if (s.p.traits?.length) q.traits = [...s.p.traits];
    else if (q.traits?.length) s.p.traits = [...q.traits];
    if (s.p.altRoles?.length) q.altRoles = [...s.p.altRoles];
    else if (q.altRoles?.length) s.p.altRoles = [...q.altRoles];
    if (s.p.roleExp && Object.keys(s.p.roleExp).length) q.roleExp = { ...s.p.roleExp };
    else if (q.roleExp && Object.keys(q.roleExp).length) s.p.roleExp = { ...q.roleExp };
    if (s.p.customPers != null) q.customPers = s.p.customPers;
    else if (q.customPers != null) s.p.customPers = q.customPers;
    const syncedBio = getPlayerBio(q, s.p);
    q.ht = syncedBio.heightCm;
    q.wt = syncedBio.weightKg;
    q.foot = syncedBio.foot;
    s.p.ht = syncedBio.heightCm;
    s.p.wt = syncedBio.weightKg;
    s.p.foot = syncedBio.foot;
    if (!q.pot || q.pot < q.ov) q.pot = clamp(92, q.ov + 12, 95);
    if (q.blessed) {
      q.customA = { ...s.p.a };
      if (s.p.sig) q.customSig = s.p.sig;
      if (s.p.customD) q.customD = { ...s.p.customD };
      if (s.p.age) q.age = s.p.age;
    } else {
      if (q.age && (!s.p.age || s.p.age < q.age)) s.p.age = q.age;
      else if (s.p.age) q.age = s.p.age;
    }
    recordPlayerSeasonProgress(q, s.season ?? 1, s.md ?? 0, s.p);
  }
}

export interface PlayerSeasonChartPoint {
  md: number;
  label: string;
  ov: number;
  sh: number;
  ps: number;
  dr: number;
  tk: number;
  ph: number;
}

const sameCoreAttrs = (x: CoreAttrs, y: CoreAttrs) =>
  x.sh === y.sh && x.ps === y.ps && x.dr === y.dr && x.tk === y.tk && x.ph === y.ph;

export function recordPlayerSeasonProgress(
  q: Player,
  season: number,
  md: number,
  careerP?: PlayerCareerProfile | null,
  reset = false
) {
  const curMd = Math.max(0, Math.round(md || 0));
  const curOv = q.me && careerP ? ovMe(careerP) : q.ov;
  const curA = DT(q, q.me ? careerP : null).a;
  const snap: PlayerSeasonProgressPoint = {
    md: curMd,
    ov: curOv,
    a: { sh: curA.sh, ps: curA.ps, dr: curA.dr, tk: curA.tk, ph: curA.ph }
  };

  if (reset || !q.seasonProg || q.seasonProg.s !== season) {
    q.seasonProg = { s: season, pts: [snap] };
    return;
  }

  const pts = q.seasonProg.pts;
  if (!pts.length) {
    pts.push(snap);
    return;
  }

  const last = pts[pts.length - 1];
  if (curMd === 0 && pts.length === 1 && (q.sp || 0) > 0) {
    if (last.ov !== snap.ov || !sameCoreAttrs(last.a, snap.a)) {
      pts.push({ ...snap, md: 1 });
    }
    return;
  }

  if (curMd <= last.md) {
    if (last.md === curMd) {
      last.ov = snap.ov;
      last.a = snap.a;
    } else if (curMd === 0 && last.md === 1 && (q.sp || 0) > 0) {
      last.ov = snap.ov;
      last.a = snap.a;
    }
    return;
  }

  if (last.ov !== snap.ov || !sameCoreAttrs(last.a, snap.a)) {
    pts.push(snap);
    if (pts.length > 40) {
      q.seasonProg.pts = [pts[0], ...pts.slice(-39)];
    }
  }
}

export function getPlayerSeasonProgression(
  q: Player,
  state: Pick<GameState, 'season' | 'md'>,
  careerP?: PlayerCareerProfile | null
): PlayerSeasonChartPoint[] {
  const curSeason = state.season ?? 1;
  const curMd = Math.max(0, Math.round(state.md ?? 0));
  const curOv = q.me && careerP ? ovMe(careerP) : q.ov;
  const curA = DT(q, q.me ? careerP : null).a;
  const liveSnap: PlayerSeasonProgressPoint = {
    md: curMd,
    ov: curOv,
    a: { sh: curA.sh, ps: curA.ps, dr: curA.dr, tk: curA.tk, ph: curA.ph }
  };

  const rawPts =
    q.seasonProg && q.seasonProg.s === curSeason && q.seasonProg.pts.length > 0
      ? q.seasonProg.pts
          .slice()
          .sort((a, b) => a.md - b.md)
          .map((pt) => ({ md: pt.md, ov: pt.ov, a: { ...pt.a } }))
      : [{ md: 0, ov: liveSnap.ov, a: { ...liveSnap.a } }];

  if (
    curSeason === 1 &&
    careerP?.b &&
    !q.blessed &&
    rawPts.length === 1 &&
    rawPts[0].md === 0 &&
    sameCoreAttrs(rawPts[0].a, liveSnap.a) &&
    !sameCoreAttrs(careerP.b, liveSnap.a)
  ) {
    const baseB = { ...careerP.b };
    rawPts[0] = { md: 0, ov: OVF(careerP.pos, baseB), a: baseB };
    rawPts.push({ ...liveSnap, md: Math.max(1, curMd) });
  }

  if (rawPts[0].md > 0) {
    rawPts.unshift({ md: 0, ov: rawPts[0].ov, a: { ...rawPts[0].a } });
  }

  const last = rawPts[rawPts.length - 1];
  if (curMd > last.md) {
    rawPts.push(liveSnap);
  } else if (curMd === last.md) {
    rawPts[rawPts.length - 1] = liveSnap;
  } else {
    rawPts[rawPts.length - 1] = { ...liveSnap, md: last.md };
  }

  const expanded: PlayerSeasonProgressPoint[] = [];
  rawPts.forEach((pt) => {
    const prev = expanded[expanded.length - 1];
    if (prev && pt.md - prev.md > 1) {
      const changed = prev.ov !== pt.ov || !sameCoreAttrs(prev.a, pt.a);
      if (changed) {
        expanded.push({ md: pt.md - 1, ov: prev.ov, a: { ...prev.a } });
      } else if (pt.md - prev.md >= 6) {
        expanded.push({ md: Math.round((prev.md + pt.md) / 2), ov: prev.ov, a: { ...prev.a } });
      }
    }
    if (prev && prev.md === pt.md) {
      expanded[expanded.length - 1] = pt;
    } else {
      expanded.push(pt);
    }
  });

  return expanded.map((pt) => ({
    md: pt.md,
    label: pt.md === 0 ? 'เริ่ม' : `น.${pt.md}`,
    ov: pt.ov,
    sh: pt.a.sh,
    ps: pt.a.ps,
    dr: pt.a.dr,
    tk: pt.a.tk,
    ph: pt.a.ph
  }));
}

export const vlu = (q: Player) => Math.round((q.ov * q.ov) / 40);
export const wagOf = (q: Player) => +((q.ov * q.ov) / 3000).toFixed(1);

export function ensureCon(q: Player) {
  if (!q.con) {
    q.con = {
      yr: q.loan ? 1 : 1 + ((q.ov + (q.age || 24)) % 3),
      wg: wagOf(q),
      role: q.ov >= 72 ? 'key' : (q.age || 24) <= 20 ? 'pro' : 'rot'
    };
  } else if (!q.con.wg) {
    q.con.wg = wagOf(q);
  }
  return q.con;
}

export const squadWage = (t: Team) =>
  Math.round(
    t.sq.reduce((sum, q) => {
      const c = ensureCon(q);
      return sum + (c.wg || wagOf(q)) * (c.yr <= 0 ? 1.25 : 1);
    }, 0)
  );

export function logFin(s: GameState, t: string, amt: number) {
  if (!amt) return;
  const rounded = Math.round(amt);
  s.finLog = s.finLog || [];
  s.finLog.unshift({ t, amt: rounded, m: s.md + 1, s: s.season });
  if (s.finLog.length > 40) s.finLog.length = 40;
  if (s.mode === 'm') {
    if (rounded > 0) s.finPendIn = (s.finPendIn || 0) + rounded;
    else s.finPendOut = (s.finPendOut || 0) + Math.abs(rounded);
  }
}

export function pushFeed(s: GameState, cat: string, txt: string, tone: '' | 'urg' | 'offer' | 'ok' = '') {
  if (!txt) return;
  s.feed = s.feed || [];
  if (s.feed[0] && s.feed[0].txt === txt) return;
  s.feed.unshift({ cat, txt, tone, s: s.season, m: s.md + 1 });
  if (s.feed.length > 8) s.feed.length = 8;
}


export const colRgb = (c: string): [number, number, number] => {
  const s = (c || '').trim();
  if (s[0] === '#') {
    const hex = s.length === 4 ? s.slice(1).replace(/./g, (x) => x + x) : s.slice(1);
    return [parseInt(hex.slice(0, 2), 16) || 0, parseInt(hex.slice(2, 4), 16) || 0, parseInt(hex.slice(4, 6), 16) || 0];
  }
  const hslM = s.match(/hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (hslM) {
    const h = (parseFloat(hslM[1]) % 360) / 360;
    const sat = parseFloat(hslM[2]) / 100;
    const l = parseFloat(hslM[3]) / 100;
    if (sat === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const p = 2 * l - q;
    const hue2rgb = (t: number) => {
      const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    return [Math.round(hue2rgb(h + 1 / 3) * 255), Math.round(hue2rgb(h) * 255), Math.round(hue2rgb(h - 1 / 3) * 255)];
  }
  return [128, 128, 128];
};

export const colLum = (c: string) => {
  const [r, g, b] = colRgb(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

export const colDist = (a: string, b: string) => {
  const [r1, g1, b1] = colRgb(a);
  const [r2, g2, b2] = colRgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
};

export const awayOf = (c1: string) => {
  const pool = ['#ffffff', '#f4c63d', '#111827', '#2f6fd6', '#c0392b', '#38bdf8', '#7c3aed', '#e67e22'];
  return pool.slice().sort((x, y) => colDist(c1, y) - colDist(c1, x))[0];
};

export function teamKits(t: Team, s?: GameState | null): [string, string] {
  if (s?.mode === 'm' && s.club && t.id === s.me) {
    return [s.club.c1, colDist(s.club.c1, s.club.c2) >= 150 ? s.club.c2 : awayOf(s.club.c1)];
  }
  if (t.kc && t.kc.length >= 2 && colDist(t.kc[0], t.kc[1]) >= 180) return t.kc;
  const kp = KIT_P[t.id % KIT_P.length];
  return [kp[0], kp[1]];
}

export const tc = (t: Team, s?: GameState | null, aw = false) => teamKits(t, s)[aw ? 1 : 0];

export function matchKits(h: Team, a: Team, s?: GameState | null): [string, string, string, string] {
  const hk = tc(h, s, false);
  const ht = tc(h, s, true);
  const a2 = tc(a, s, true);
  const a1 = tc(a, s, false);
  let ak = a2;
  let at = a1;
  if (colDist(hk, ak) < 190) {
    ak = colDist(hk, a1) >= 190 ? a1 : awayOf(hk);
    at = colDist(ak, a1) >= 160 ? a1 : hk;
  }
  return [hk, ak, ht, at];
}

export function pickGK(c1: string, c2 = '', c3 = '') {
  const pool = ['#0d9488', '#f4c63d', '#7dd3fc', '#f472b6', '#fb923c', '#a3e635', '#6d28d9'];
  return pool
    .slice()
    .sort((a, b) => {
      const sa = Math.min(colDist(a, c1), c2 ? colDist(a, c2) : 999, c3 ? colDist(a, c3) : 999);
      const sb = Math.min(colDist(b, c1), c2 ? colDist(b, c2) : 999, c3 ? colDist(b, c3) : 999);
      return sb - sa;
    })[0];
}

export function getTeamClubIdentity(t: Team, s?: GameState | null): ClubIdentity {
  if (s?.mode === 'm' && t.id === s.me && s.club) {
    return s.club;
  }
  const h = ([...(t.name || 'T')].reduce((a, c, idx) => a + c.charCodeAt(0) * (idx + 3), 0) * 37) >>> 0;
  const icKeys = Object.keys(CREST_IC);
  const [c1, c2] = teamKits(t, s);
  return {
    name: t.name,
    nick: '',
    std: 'สนาม' + t.name,
    c1,
    c2,
    shape: h % CREST_SHAPES.length,
    pat: (h >> 4) % CREST_PATTERNS.length,
    icon: icKeys[h % icKeys.length] || '⚽',
    iconColor: '',
    crestBorder: (h >> 6) % 4,
    kit: (h >> 3) % KIT_PATTERNS.length
  };
}

export function getDefaultCoachVis(seedName: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seedName.length; i++) {
    h ^= seedName.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.abs(h);
  return [
    h % SKIN_P.length,
    [0, 1, 5, 6, 2][Math.floor(h / 7) % 5],
    [0, 2, 5, 7, 9, 13][Math.floor(h / 13) % 6],
    [0, 2, 3, 5, 6, 7][Math.floor(h / 23) % 6],
    [0, 1, 3, 4, 7][Math.floor(h / 31) % 5],
    0,
    Math.floor(h / 41) % FS_N.length,
    Math.floor(h / 59) % 5 === 0 ? 5 : 0
  ];
}

export function ensureClubIdentity(s: GameState): ClubIdentity {
  if (!s.club) {
    const t = s.teams[s.me];
    const h = ([...(t.name || 'T')].reduce((a, c, idx) => a + c.charCodeAt(0) * (idx + 3), 0) * 37) >>> 0;
    const icKeys = Object.keys(CREST_IC);
    s.club = {
      name: t.name,
      nick: '',
      std: 'สนาม' + t.name,
      c1: t.kc?.[0] || '#c0392b',
      c2: t.kc?.[1] || '#f4c63d',
      shape: h % CREST_SHAPES.length,
      pat: (h >> 4) % CREST_PATTERNS.length,
      icon: icKeys[h % icKeys.length] || '⚽',
      iconColor: '',
      crestBorder: (h >> 6) % 4,
      kit: (h >> 3) % KIT_PATTERNS.length,
      managerName: 'หัวหน้าผู้ฝึกสอน',
      managerStyle: 'balanced',
      managerOutfit: 'suit_navy',
      managerVis: getDefaultCoachVis(t.name || 'coach')
    };
  }
  if (!s.club.managerVis || s.club.managerVis.length < 8) {
    const baseVis = getDefaultCoachVis(s.club.managerName || s.club.name || 'coach');
    s.club.managerVis = Array.isArray(s.club.managerVis) && s.club.managerVis.length >= 6
      ? [...s.club.managerVis.slice(0, 6), s.club.managerVis[6] ?? baseVis[6], s.club.managerVis[7] ?? baseVis[7]]
      : baseVis;
  }
  if (!s.club.managerStyle) {
    s.club.managerStyle = 'balanced';
  }
  if (!s.club.managerOutfit) {
    s.club.managerOutfit = 'suit_navy';
  }
  return s.club;
}

const CUSTOM_PLAYERS_KEY = 'lk_custom_players';

export function loadCustomPlayers(): CreatedPlayerTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PLAYERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => x && x.profile && x.profile.name) : [];
  } catch {
    return [];
  }
}

export function saveCustomPlayer(tpl: CreatedPlayerTemplate) {
  try {
    const list = loadCustomPlayers().filter((x) => x.id !== tpl.id && x.profile.name !== tpl.profile.name);
    list.unshift(tpl);
    if (list.length > 24) list.length = 24;
    localStorage.setItem(CUSTOM_PLAYERS_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

export function deleteCustomPlayer(id: string) {
  try {
    const list = loadCustomPlayers().filter((x) => x.id !== id);
    localStorage.setItem(CUSTOM_PLAYERS_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

export interface CreatedPlayerCandidate {
  key: string;
  sourceType: 'career_save' | 'custom_pool';
  slot?: number;
  sourceSeason?: number;
  templateId?: string;
  sourceLabel: string;
  clubName: string;
  sourceTier?: number;
  archName?: string;
  ov: number;
  pot: number;
  price: number;
  player: Player;
  profile: Omit<PlayerCareerProfile, 'b' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'>;
  careerStats: {
    seasons: number;
    apps: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    motm: number;
    avgRating: number;
    ntCaps: number;
    ntGoals: number;
  };
}

export function buildPlayerFromCareerProfile(
  p: Omit<PlayerCareerProfile, 'b' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'> &
    Partial<Pick<PlayerCareerProfile, 'gl' | 'as' | 'ap' | 'rs' | 'yc' | 'rc' | 'history' | 'careerLog' | 'ntCaps' | 'ntGoals'>>,
  opts?: { livePlayer?: Player | null; ovOverride?: number; potOverride?: number; asHomegrown?: boolean }
): Player {
  const lp = opts?.livePlayer;
  const srcA = lp?.customA || p.a;
  const attrs: CoreAttrs = {
    sh: clamp(Math.round(srcA?.sh ?? 55), 1, 99),
    ps: clamp(Math.round(srcA?.ps ?? 55), 1, 99),
    dr: clamp(Math.round(srcA?.dr ?? 55), 1, 99),
    tk: clamp(Math.round(srcA?.tk ?? 55), 1, 99),
    ph: clamp(Math.round(srcA?.ph ?? 55), 1, 99)
  };
  const ov = clamp(Math.round(opts?.ovOverride ?? lp?.ov ?? OVF(p.pos, attrs)), 30, 99);
  const talent = clamp(Math.round(p.talent ?? lp?.talent ?? 78), 25, 99);
  const pot = clamp(Math.round(opts?.potOverride ?? lp?.pot ?? Math.max(ov + 14, Math.min(96, talent + 6))), ov, 99);
  const ki = SKIN_P.indexOf(p.k);
  const hi = HAIR_P.indexOf(p.h);
  const no = clamp(p.no || lp?.no || (p.pos === 'GK' ? 1 : p.pos === 'DF' ? 4 : p.pos === 'MF' ? 8 : 10), 1, 99);
  const vis = lp?.vis && lp.vis.length >= 5
    ? [...lp.vis]
    : [ki >= 0 ? ki : 2, hi >= 0 ? hi : 0, p.hs ?? 0, p.fh ?? 0, p.ey ?? 0, no, p.fs ?? 0, p.acc ?? 0];
  const traits = p.traits?.length ? [...p.traits] : lp?.traits?.length ? [...lp.traits] : [];
  const mergedSb = lp?.sb && Object.keys(lp.sb).length
    ? { ...lp.sb }
    : p.sb && Object.keys(p.sb).length
      ? { ...p.sb }
      : undefined;
  const mergedCoreSb = lp?.coreSb && Object.keys(lp.coreSb).length ? { ...lp.coreSb } : undefined;
  const histMap = new Map<number, NonNullable<Player['history']>[number]>();
  (p.history || []).forEach((h) => {
    if (h && typeof h.season === 'number') histMap.set(h.season, { ...h });
  });
  (lp?.history || []).forEach((h) => {
    if (h && typeof h.season === 'number') histMap.set(h.season, { ...h });
  });
  const mergedHistory = Array.from(histMap.values()).sort((a, b) => b.season - a.season);
  const hasHistory = mergedHistory.length > 0;
  const mergedCareerLog: string[] = [];
  [...(p.careerLog || []), ...(lp?.careerLog || [])].forEach((entry) => {
    if (entry && !mergedCareerLog.includes(entry)) mergedCareerLog.push(entry);
  });

  const sp = lp?.sp ?? (hasHistory ? 0 : p.ap ?? 0);
  const sg = lp?.sg ?? (hasHistory ? 0 : p.gl ?? 0);
  const sa = lp?.sa ?? (hasHistory ? 0 : p.as ?? 0);
  const cs = lp?.cs ?? 0;
  const motm = lp?.motm ?? 0;
  const yc = lp?.yc ?? p.yc ?? 0;
  const tyc = lp?.tyc ?? lp?.yc ?? p.yc ?? 0;
  const rc = lp?.rc ?? p.rc ?? 0;
  const srs = lp?.srs ?? (hasHistory ? 0 : p.rs ?? 0);
  const sra = lp?.sra ?? (hasHistory ? 0 : p.ap ?? 0);

  const resolvedBio = getPlayerBio(
    {
      n: p.name.trim() || 'นักเตะสร้างเอง',
      pos: p.pos,
      ro: p.sp,
      ht: lp?.ht ?? p.ht,
      wt: lp?.wt ?? p.wt,
      foot: lp?.foot ?? p.foot
    },
    p
  );

  const basePlayer: Player = {
    n: p.name.trim() || 'นักเตะสร้างเอง',
    pos: p.pos,
    ro: p.sp,
    sp,
    sg,
    sa,
    cs,
    motm,
    yc,
    tyc,
    rc,
    srs,
    sra,
    ov,
    age: clamp(Math.round(p.age ?? lp?.age ?? 17), 15, 42),
    ht: resolvedBio.heightCm,
    wt: resolvedBio.weightKg,
    foot: resolvedBio.foot,
    pot,
    talent,
    traits,
    fit: lp?.fit ?? 100,
    inj: lp?.inj ?? 0,
    no,
    vis,
    customA: attrs,
    ...(p.customD || lp?.customD ? { customD: { ...(p.customD || lp?.customD) } } : {}),
    ...(p.sig || lp?.customSig ? { customSig: p.sig || lp?.customSig } : {}),
    ...(mergedSb ? { sb: mergedSb } : {}),
    ...(mergedCoreSb ? { coreSb: mergedCoreSb } : {}),
    ...(lp?.blessed ? { blessed: true } : {}),
    ...(mergedHistory.length ? { history: mergedHistory } : {}),
    ...(mergedCareerLog.length ? { careerLog: mergedCareerLog } : {}),
    ...(p.altRoles?.length || lp?.altRoles?.length ? { altRoles: [...(p.altRoles || lp?.altRoles || [])] } : {}),
    ...(p.roleExp || lp?.roleExp ? { roleExp: { ...(p.roleExp || lp?.roleExp) } } : {}),
    ...(p.customPers != null || lp?.customPers != null ? { customPers: p.customPers ?? lp?.customPers } : {}),
    ...(lp?.seasonProg ? { seasonProg: { s: lp.seasonProg.s, pts: lp.seasonProg.pts.map((pt) => ({ ...pt, a: { ...pt.a } })) } } : {}),
    ...(opts?.asHomegrown !== false ? { hg: 1, customCreated: 1 } : {})
  };
  basePlayer.price = Math.max(8, vlu(basePlayer));
  return basePlayer;
}

export function listCreatedPlayersForManager(): CreatedPlayerCandidate[] {
  const out: CreatedPlayerCandidate[] = [];
  const seenNames = new Set<string>();

  // 1) From saved Player Career slots (lk_p .. lk_p_5)
  for (let k = 1; k <= NSL; k++) {
    const ps = loadGameFromSlot('p', k);
    if (!ps || !ps.p || !Array.isArray(ps.teams)) continue;
    const club = ps.teams[ps.me];
    const mePl = club?.sq?.find((q) => q.me) || null;
    const player = buildPlayerFromCareerProfile(ps.p, { livePlayer: mePl, ovOverride: mePl?.ov || ovMe(ps.p) });

    // If career save has progressed past season 1 and the current active season isn't in history yet,
    // append a clean snapshot row so PlayerHistoryPanel displays both past and current career seasons without collision.
    const curSp = player.sp || 0;
    const curSra = player.sra || 0;
    const curAvg = curSra > 0
      ? Math.round(((player.srs || 0) / curSra) * 100) / 100
      : curSp > 0
        ? clamp(Math.round((6.2 + ((player.sg || 0) * 1.05 + (player.sa || 0) * 0.65 + (player.cs || 0) * 0.5) / Math.max(1, curSp) + (player.ov - 60) / 90) * 100) / 100, 5, 9.5)
        : 0;
    if (ps.season > 1 && curSp > 0 && !(player.history || []).some((h) => h.season === ps.season)) {
      player.history = [
        {
          season: ps.season,
          teamId: club?.id ?? -1,
          teamName: club?.name || 'สโมสรอาชีพ',
          tier: club?.tier ?? 0,
          ov: player.ov,
          sp: curSp,
          sg: player.sg || 0,
          sa: player.sa || 0,
          cs: player.cs || 0,
          motm: player.motm || 0,
          yc: player.tyc ?? player.yc ?? 0,
          rc: player.rc || 0,
          avgRating: curAvg
        },
        ...(player.history || [])
      ];
    }

    const histRows = player.history || [];
    const curAlreadyCounted = histRows.some((h) => h.season === ps.season);
    const sumHistApps = histRows.reduce((s, r) => s + (r.sp || 0), 0) + (curAlreadyCounted ? 0 : curSp);
    const sumHistGoals = histRows.reduce((s, r) => s + (r.sg || 0), 0) + (curAlreadyCounted ? 0 : player.sg || 0);
    const sumHistAssists = histRows.reduce((s, r) => s + (r.sa || 0), 0) + (curAlreadyCounted ? 0 : player.sa || 0);
    const sumHistCs = histRows.reduce((s, r) => s + (r.cs || 0), 0) + (curAlreadyCounted ? 0 : player.cs || 0);
    const sumHistMotm = histRows.reduce((s, r) => s + (r.motm || 0), 0) + (curAlreadyCounted ? 0 : player.motm || 0);

    let wSum = 0;
    let wApps = 0;
    histRows.forEach((r) => {
      if (r.avgRating > 0 && r.sp > 0) {
        wSum += r.avgRating * r.sp;
        wApps += r.sp;
      }
    });
    if (!curAlreadyCounted && curAvg > 0 && curSp > 0) {
      wSum += curAvg * curSp;
      wApps += curSp;
    }

    const apps = Math.max(sumHistApps, ps.p.ap || 0);
    const goals = Math.max(sumHistGoals, ps.p.gl || 0);
    const assists = Math.max(sumHistAssists, ps.p.as || 0);
    const avgRating = wApps > 0
      ? Math.round((wSum / wApps) * 100) / 100
      : (ps.p.ap || 0) > 0 && (ps.p.rs || 0) > 0
        ? Math.round(((ps.p.rs || 0) / Math.max(1, ps.p.ap || 1)) * 100) / 100
        : 0;

    const price = Math.max(8, player.price || vlu(player));
    seenNames.add(player.n);
    out.push({
      key: `career_${k}_${player.n}`,
      sourceType: 'career_save',
      slot: k,
      sourceSeason: ps.season,
      sourceLabel: `เซฟนักเตะอาชีพ #${k} (ซีซั่น ${ps.season})`,
      clubName: club?.name || 'สโมสรอาชีพ',
      sourceTier: club?.tier ?? 0,
      archName: ps.p.archName,
      ov: player.ov,
      pot: player.pot,
      price,
      player,
      profile: ps.p,
      careerStats: {
        seasons: histRows.length + (!curAlreadyCounted && (curSp > 0 || ps.md > 0) ? 1 : 0),
        apps,
        goals,
        assists,
        cleanSheets: sumHistCs,
        motm: sumHistMotm,
        avgRating,
        ntCaps: ps.p.ntCaps || 0,
        ntGoals: ps.p.ntGoals || 0
      }
    });
  }

  // 2) From standalone custom created roster (lk_custom_players)
  for (const tpl of loadCustomPlayers()) {
    const player = buildPlayerFromCareerProfile(tpl.profile, {
      ovOverride: tpl.ov,
      potOverride: tpl.pot
    });
    if (seenNames.has(player.n)) continue;
    seenNames.add(player.n);
    const price = Math.max(8, player.price || vlu(player));
    out.push({
      key: `custom_${tpl.id}`,
      sourceType: 'custom_pool',
      templateId: tpl.id,
      sourceLabel: 'ทำเนียบนักเตะที่สร้างเอง',
      clubName: 'นักเตะสร้างอิสระ',
      archName: tpl.profile.archName,
      ov: player.ov,
      pot: player.pot,
      price,
      player,
      profile: tpl.profile,
      careerStats: {
        seasons: 0,
        apps: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        motm: 0,
        avgRating: 0,
        ntCaps: 0,
        ntGoals: 0
      }
    });
  }

  return out;
}

export interface ManagedClubCandidate {
  slot: number;
  teamId: number;
  name: string;
  tier: number;
  tierLabel: string;
  season: number;
  squadCount: number;
  kc: [string, string];
  team: Team;
  club?: ClubIdentity | null;
}

export function listManagedClubsFromSaves(): ManagedClubCandidate[] {
  const out: ManagedClubCandidate[] = [];
  for (let k = 1; k <= NSL; k++) {
    const ms = loadGameFromSlot('m', k);
    if (!ms || !Array.isArray(ms.teams)) continue;
    const meTeam = ms.teams[ms.me];
    if (!meTeam) continue;
    const clubName = ms.club?.name || meTeam.name;
    out.push({
      slot: k,
      teamId: meTeam.id,
      name: clubName,
      tier: meTeam.tier,
      tierLabel: TN[meTeam.tier] || `Tier ${meTeam.tier + 1}`,
      season: ms.season || 1,
      squadCount: meTeam.sq?.length || 0,
      kc: [ms.club?.c1 || meTeam.kc?.[0] || '#158049', ms.club?.c2 || meTeam.kc?.[1] || '#f5c242'],
      team: meTeam,
      club: ms.club || null
    });
  }
  return out;
}

