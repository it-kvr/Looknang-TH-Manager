import type { Position, SubRole, StatKey, GameMode, CoreAttrs, Player, PlayerSeasonProgressPoint, PlayerSeasonHistoryRecord, Team, ClubIdentity, PlayerCareerProfile, GameState, FootballTraitDef, CreatedPlayerTemplate, PreferredFoot } from '../types/game';
import type { ClubPhilosophyDef } from '../data/thaiFootballData';
import { R, P, clamp, capMoney } from '../utils/math';
import { CREST_SHAPES, CREST_PATTERNS, CREST_IC, KIT_PATTERNS, getAiTeamStadiumStyleId } from '../data/crestAndKitData';
import { A1, A2, S1, S2, FN, SN, NG, TIER_STANDALONE_CLUBS, BASE, POS, ATT, SFX0, FSD, LINE, EQ, SIMP, PM, SKIN_P, HAIR_P, FS_N, KIT_P, SIGL, FOOTBALL_TRAITS, TRAIT_BY_ID, PLAYER_PERSONALITIES, TN, CLUB_PHILOSOPHIES, FOREIGN_NAME_POOLS, COUNTRY_META_BY_CODE, getForeignTeamCountryMeta, inferForeignTeamRegion, type ForeignNameRegion } from '../data/thaiFootballData';
import { ensureTeamWellbeing, getActiveFavBoost, getWellbeingOvrAdjustment, initPlayerWellbeing } from './wellbeing';

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

const THAI_FIRST_SET = new Set<string>([
  ...FN,
  ...A1.flatMap((a) => A2.map((b) => a + b))
]);
const THAI_LAST_SET = new Set<string>([
  ...SN,
  ...S1.flatMap((a) => S2.map((b) => a + b))
]);

export function isLikelyGeneratedThaiName(name?: string | null): boolean {
  if (!name) return false;
  const parts = name.trim().split(/\s+/);
  if (parts.length !== 2) return false;
  return THAI_FIRST_SET.has(parts[0]) && THAI_LAST_SET.has(parts[1]);
}

export function genForeignPlayerName(
  region: ForeignNameRegion = 'intl',
  opts?: { allowImport?: boolean; excludeNames?: Set<string> }
): string {
  const useImport = Boolean(opts?.allowImport && region !== 'intl' && Math.random() < 0.15);
  const pickedRegion: ForeignNameRegion = useImport ? 'intl' : region;
  const pool = FOREIGN_NAME_POOLS[pickedRegion] || FOREIGN_NAME_POOLS.intl;
  const familyFirst = pickedRegion === 'kr' || pickedRegion === 'cn' || pickedRegion === 'vn';
  let n = '';
  for (let i = 0; i < 60; i++) {
    const first = P(pool.first);
    const last = P(pool.last);
    n = familyFirst ? `${last} ${first}` : `${first} ${last}`;
    if (!NMU.has(n) && !opts?.excludeNames?.has(n)) break;
  }
  NMU.add(n);
  return n;
}

const COUNTRY_META_LIST = Object.values(COUNTRY_META_BY_CODE);

function pickImportCountryMeta(excludeCode?: string) {
  const pool = excludeCode
    ? COUNTRY_META_LIST.filter((c) => c.code !== excludeCode)
    : COUNTRY_META_LIST;
  return P(pool.length ? pool : COUNTRY_META_LIST);
}

export function localizeForeignTeams(teams?: Team[] | null): boolean {
  if (!Array.isArray(teams)) return false;
  let changed = false;
  const existingNames = new Set<string>();
  teams.forEach((tm) => tm.sq?.forEach((q) => existingNames.add(q.n)));

  teams.forEach((tm) => {
    if (!(tm.foreign === 1 || tm.tier >= 3) || !Array.isArray(tm.sq)) return;
    const meta = getForeignTeamCountryMeta(tm.name);
    const region = meta?.region || inferForeignTeamRegion(tm.name) || 'intl';
    const renameMap = new Map<string, string>();

    tm.sq.forEach((q) => {
      if (q.me || q.signedSeason || q.loan) return;
      if (isLikelyGeneratedThaiName(q.n)) {
        const oldName = q.n;
        const useImport = Math.random() < 0.16;
        const imp = useImport ? pickImportCountryMeta(meta?.code) : null;
        const newName = genForeignPlayerName(imp ? imp.region : region, {
          allowImport: false,
          excludeNames: existingNames
        });
        existingNames.add(newName);
        renameMap.set(oldName, newName);
        q.n = newName;
        if (imp?.code || meta?.code) {
          q.nat = imp?.code || meta?.code;
        }
        changed = true;
      } else if (!q.nat && meta?.code) {
        q.nat = meta.code;
        changed = true;
      }
    });

    if (renameMap.size > 0) {
      if (Array.isArray(tm.lu)) {
        tm.lu = tm.lu.map((name) => renameMap.get(name) || name);
      }
      if (tm.cap && renameMap.has(tm.cap)) {
        tm.cap = renameMap.get(tm.cap);
      }
      if (tm.setPieces) {
        if (tm.setPieces.corner && renameMap.has(tm.setPieces.corner)) {
          tm.setPieces.corner = renameMap.get(tm.setPieces.corner);
        }
        if (tm.setPieces.freekick && renameMap.has(tm.setPieces.freekick)) {
          tm.setPieces.freekick = renameMap.get(tm.setPieces.freekick);
        }
        if (tm.setPieces.penalty && renameMap.has(tm.setPieces.penalty)) {
          tm.setPieces.penalty = renameMap.get(tm.setPieces.penalty);
        }
      }
    }
  });

  return changed;
}

export function clearNamePool() {
  NMU.clear();
}

export function genClubNames(): string[][] {
  const u = new Set<string>();
  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = R(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const suffixDecks: string[][] = [
    // Tier 0: 5 standalone Thai monikers + 11 varied provincial suffixed names (capped per suffix)
    ['', '', '', '', '', 'เอฟซี', 'เอฟซี', 'เอฟซี', 'ซิตี้', 'ซิตี้', 'เอสซี', 'เอสซี', 'ยูไนเต็ด', 'ทาวน์', 'ยูธ', 'คลับ'],
    // Tier 1: 6 standalone regional monikers + 10 varied regional suffixed names
    ['', '', '', '', '', '', 'เอฟซี', 'เอฟซี', 'เอฟซี', 'ยูไนเต็ด', 'ยูไนเต็ด', 'ซิตี้', 'ซิตี้', 'เอสซี', 'แอธเลติก', 'คลับ'],
    // Tier 2: 7 standalone powerhouse monikers + 9 sleek top-flight club names
    ['', '', '', '', '', '', '', 'เอฟซี', 'เอฟซี', 'เอฟซี', 'ยูไนเต็ด', 'ยูไนเต็ด', 'ซิตี้', 'ซิตี้', 'เอสซี', 'คลับ']
  ];
  return [0, 1, 2].map((t) => {
    const basePool = shuffle(NG[t]);
    const monikerPool = shuffle(TIER_STANDALONE_CLUBS[t] || []);
    const slots = shuffle(suffixDecks[t]);
    const out: string[] = [];
    let baseIdx = 0;
    let monikerIdx = 0;

    for (const sx of slots) {
      if (out.length >= 16) break;
      if (!sx && monikerIdx < monikerPool.length) {
        const cand = monikerPool[monikerIdx++];
        if (!u.has(cand)) {
          u.add(cand);
          out.push(cand);
          continue;
        }
      }
      while (baseIdx < basePool.length) {
        const base = basePool[baseIdx++];
        const useSx = sx || P(SFX0[t].filter(Boolean));
        const cand = `${base} ${useSx}`.trim();
        if (!u.has(cand)) {
          u.add(cand);
          out.push(cand);
          break;
        }
      }
    }

    while (out.length < 16 && baseIdx < basePool.length) {
      const base = basePool[baseIdx++];
      const cand = `${base} ${P(SFX0[t].filter(Boolean))}`.trim();
      if (!u.has(cand)) {
        u.add(cand);
        out.push(cand);
      }
    }
    return out;
  });
}

export const NSL = 5;
export const MIN_SLOTS = 1;
export const MAX_SLOTS = 30;
export const slotKey = (m: GameMode, k = 1) => (m === 'p' ? 'lk_p' : 'lk_m') + (k > 1 ? `_${k}` : '');
const slotCountKey = (m: GameMode) => (m === 'p' ? 'lk_slots_cnt_p' : 'lk_slots_cnt_m');
const PINNED_SLOTS_KEY = 'lk_pinned_slots_v1';
const PINNED_FOLDER_KEY = 'lk_pinned_folder_saves_v1';

export function getPinnedSlotIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_SLOTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function isSlotPinned(m: GameMode, slot: number): boolean {
  return getPinnedSlotIds().includes(`${m}_${slot}`);
}

export function setSlotPinned(m: GameMode, slot: number, pinned: boolean): string[] {
  const id = `${m}_${slot}`;
  const cur = getPinnedSlotIds().filter((x) => x !== id);
  const next = pinned ? [id, ...cur] : cur;
  try {
    localStorage.setItem(PINNED_SLOTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function toggleSlotPin(m: GameMode, slot: number): { pinned: boolean; list: string[] } {
  const nextPinned = !isSlotPinned(m, slot);
  return { pinned: nextPinned, list: setSlotPinned(m, slot, nextPinned) };
}

export function getPinnedFolderKeys(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_FOLDER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function togglePinnedFolderKey(key: string): { pinned: boolean; list: string[] } {
  const cur = getPinnedFolderKeys();
  const isPinned = cur.includes(key);
  const next = isPinned ? cur.filter((k) => k !== key) : [key, ...cur];
  try {
    localStorage.setItem(PINNED_FOLDER_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return { pinned: !isPinned, list: next };
}

export function hasSlotData(m: GameMode, slot: number): boolean {
  try {
    return !!localStorage.getItem(slotKey(m, slot));
  } catch {
    return false;
  }
}

export function getHighestOccupiedSlot(m: GameMode): number {
  for (let k = MAX_SLOTS; k >= 1; k--) {
    if (loadGameFromSlot(m, k)) return k;
  }
  return 0;
}

export function getSlotCount(m: GameMode): number {
  let stored = NSL;
  try {
    const raw = Number(localStorage.getItem(slotCountKey(m)));
    if (Number.isFinite(raw) && raw >= MIN_SLOTS) {
      stored = clamp(Math.round(raw), MIN_SLOTS, MAX_SLOTS);
    }
  } catch {
    stored = NSL;
  }
  const highest = getHighestOccupiedSlot(m);
  return Math.max(stored, highest, MIN_SLOTS);
}

export function setSlotCount(m: GameMode, nextCount: number): number {
  const highest = getHighestOccupiedSlot(m);
  const finalCount = clamp(Math.round(nextCount), Math.max(MIN_SLOTS, highest), MAX_SLOTS);
  try {
    localStorage.setItem(slotCountKey(m), String(finalCount));
  } catch {
    // ignore
  }
  return finalCount;
}

export function saveGameToSlot(s: GameState, slot: number) {
  try {
    localStorage.setItem(slotKey(s.mode, slot), JSON.stringify(s));
    if (slot > getSlotCount(s.mode)) {
      setSlotCount(s.mode, slot);
    }
  } catch {
    // ignore quota errors
  }
  void import('./saveFolder')
    .then((mod) => mod.syncSlotToAutoFolder(s, slot))
    .catch(() => undefined);
}

export function loadGameFromSlot(m: GameMode, slot: number): GameState | null {
  try {
    const raw = localStorage.getItem(slotKey(m, slot));
    if (!raw) return null;
    const d = JSON.parse(raw) as GameState;
    if (!Array.isArray(d?.teams) || typeof d.me !== 'number' || d.me < 0 || d.me >= d.teams.length || !d.teams[d.me]) {
      return null;
    }
    d.teams.forEach((tm) => {
      tm.sq?.forEach((q) => {
        if ((q.ro as string) === 'SS') q.ro = 'CF';
        if (Array.isArray(q.traits) && q.traits.length > 0) {
          const valid = q.traits.filter((id) => Boolean(TRAIT_BY_ID[id]));
          if (valid.length !== q.traits.length) {
            q.traits = valid.length > 0
              ? valid
              : rollPlayerTraits(q.pos || 'MF', q.ro || 'CM', q.ov || 60, q.talent || 60, `${q.n}:${q.pos}:${q.ro}`);
          }
        }
      });
      if (Array.isArray(tm.cf)) {
        tm.cf = tm.cf.map(([sp, x, y]) => [((sp as string) === 'SS' ? 'CF' : sp) as SubRole, x, y]);
      }
      assignTeamShirtNumbers(tm);
    });
    if (d.mode === 'p' && d.p) {
      if ((d.p.sp as string) === 'SS') d.p.sp = 'CF';
      const mePl = d.teams[d.me]?.sq.find((q) => q.me);
      if (Array.isArray(d.p.traits) && d.p.traits.length > 0) {
        const validP = d.p.traits.filter((id) => Boolean(TRAIT_BY_ID[id]));
        if (validP.length !== d.p.traits.length) {
          d.p.traits = validP.length > 0
            ? validP
            : rollPlayerTraits(d.p.pos || 'MF', d.p.sp || 'CM', mePl?.ov || 60, d.p.talent || 60, `${d.p.name}:${d.p.pos}:${d.p.sp}`);
        }
      }
      if (mePl?.no) d.p.no = mePl.no;
    }
    localizeForeignTeams(d.teams);
    ensureAiTeamPhilosophies(d, false);
    d.teams.forEach((tm) => ensureTeamWellbeing(tm, d));
    d.money = capMoney(d.money);
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
  setSlotPinned(m, slot, false);
}

export function firstEmptySlot(m: GameMode): number {
  const total = getSlotCount(m);
  for (let k = 1; k <= total; k++) {
    if (!loadGameFromSlot(m, k)) return k;
  }
  return 0;
}

const pickWeightedRole = (pool: readonly [SubRole, number][]): SubRole => {
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i][1];
    if (r <= 0) return pool[i][0];
  }
  return pool[0][0];
};

export const normalizeSubRole = (ro?: string | null): SubRole => {
  if (!ro) return 'CM';
  if (ro === 'SS') return 'CF';
  if (ro === 'LST') return 'LS';
  if (ro === 'RST') return 'RS';
  return ro as SubRole;
};

export const SPW = (p: Position): SubRole => {
  if (p === 'DF') {
    return pickWeightedRole([
      ['LCB', 28],
      ['RCB', 28],
      ['LB', 16],
      ['RB', 16],
      ['LWB', 4],
      ['RWB', 4],
      ['CB', 4]
    ]);
  }
  if (p === 'MF') {
    return pickWeightedRole([
      ['CM', 18],
      ['CDM', 16],
      ['CAM', 14],
      ['LCM', 12],
      ['RCM', 12],
      ['LM', 9],
      ['RM', 9],
      ['LDM', 5],
      ['RDM', 5]
    ]);
  }
  if (p === 'FW') {
    return pickWeightedRole([
      ['ST', 36],
      ['LW', 20],
      ['RW', 20],
      ['CF', 14],
      ['LS', 5],
      ['RS', 5]
    ]);
  }
  return 'GK';
};

export interface PositionShirtGuide {
  label: string;
  primary: number[];
  alt: number[];
  reason: string;
}

const ROLE_SHIRT_POOLS: Record<SubRole, PositionShirtGuide> = {
  GK: {
    label: 'ผู้รักษาประตู (GK)',
    primary: [1],
    alt: [12, 13, 16, 22, 25, 31, 33, 99],
    reason: 'เบอร์ 1 คือมือหนึ่ง ส่วน 12, 13 มักเป็นมือสอง และเบอร์สูงอย่าง 31, 99 มักเลือกตามปีเกิดหรือความชอบ'
  },
  RB: {
    label: 'แบ็กขวา (RB)',
    primary: [2],
    alt: [12, 15, 22, 23, 27, 66],
    reason: 'แบ็กขวาใช้เบอร์ 2 เป็นหลัก ฟูลแบ็กตัวสำรองหรือสายบุกยุคใหม่มักใช้เบอร์คู่หรือเบอร์เบิ้ล เช่น 22, 27, 66'
  },
  RWB: {
    label: 'วิงแบ็กขวา (RWB)',
    primary: [2],
    alt: [12, 15, 22, 23, 27, 66],
    reason: 'วิงแบ็กขวาใช้เบอร์ 2 เป็นหลัก ฟูลแบ็กตัวสำรองหรือสายบุกยุคใหม่มักใช้เบอร์คู่หรือเบอร์เบิ้ล เช่น 22, 27, 66'
  },
  LB: {
    label: 'แบ็กซ้าย (LB)',
    primary: [3],
    alt: [12, 15, 22, 23, 27, 66],
    reason: 'แบ็กซ้ายใช้เบอร์ 3 เป็นหลัก ฟูลแบ็กตัวสำรองหรือสายบุกยุคใหม่มักใช้เบอร์คู่หรือเบอร์เบิ้ล เช่น 22, 27, 66'
  },
  LWB: {
    label: 'วิงแบ็กซ้าย (LWB)',
    primary: [3],
    alt: [12, 15, 22, 23, 27, 66],
    reason: 'วิงแบ็กซ้ายใช้เบอร์ 3 เป็นหลัก ฟูลแบ็กตัวสำรองหรือสายบุกยุคใหม่มักใช้เบอร์คู่หรือเบอร์เบิ้ล เช่น 22, 27, 66'
  },
  CB: {
    label: 'เซ็นเตอร์แบ็ก (CB)',
    primary: [4, 5],
    alt: [3, 6, 14, 15, 24, 26, 33],
    reason: 'กองหลังตัวกลางที่ออกบอลดีมักชอบเบอร์ 4, 5, 6 ส่วนเบอร์ 24, 26 เป็นเบอร์ยอดนิยมของกองหลังตัวหลักยุคใหม่'
  },
  LCB: {
    label: 'เซ็นเตอร์แบ็กซ้าย (LCB)',
    primary: [4, 5],
    alt: [3, 6, 14, 15, 24, 26, 33],
    reason: 'กองหลังตัวกลางที่ออกบอลดีมักชอบเบอร์ 4, 5, 6 ส่วนเบอร์ 24, 26 เป็นเบอร์ยอดนิยมของกองหลังตัวหลักยุคใหม่'
  },
  RCB: {
    label: 'เซ็นเตอร์แบ็กขวา (RCB)',
    primary: [4, 5],
    alt: [3, 6, 14, 15, 24, 26, 33],
    reason: 'กองหลังตัวกลางที่ออกบอลดีมักชอบเบอร์ 4, 5, 6 ส่วนเบอร์ 24, 26 เป็นเบอร์ยอดนิยมของกองหลังตัวหลักยุคใหม่'
  },
  CDM: {
    label: 'กองกลางตัวรับ (CDM)',
    primary: [6, 4, 5],
    alt: [8, 14, 16, 18, 25, 42],
    reason: 'เบอร์ 6 คือตัวคุมจังหวะเกมรับ (หรือ 4, 5) ส่วนเบอร์ 14, 16, 18 เป็นเบอร์คลาสสิกของมิดฟิลด์ตัวตัดเกม'
  },
  LDM: {
    label: 'กองกลางตัวรับซ้าย (LDM)',
    primary: [6, 4, 5],
    alt: [8, 14, 16, 18, 25, 42],
    reason: 'เบอร์ 6 คือตัวคุมจังหวะเกมรับ (หรือ 4, 5) ส่วนเบอร์ 14, 16, 18 เป็นเบอร์คลาสสิกของมิดฟิลด์ตัวตัดเกม'
  },
  RDM: {
    label: 'กองกลางตัวรับขวา (RDM)',
    primary: [6, 4, 5],
    alt: [8, 14, 16, 18, 25, 42],
    reason: 'เบอร์ 6 คือตัวคุมจังหวะเกมรับ (หรือ 4, 5) ส่วนเบอร์ 14, 16, 18 เป็นเบอร์คลาสสิกของมิดฟิลด์ตัวตัดเกม'
  },
  CM: {
    label: 'กองกลางสนาม (CM)',
    primary: [8, 10],
    alt: [7, 14, 19, 20, 21, 23, 47],
    reason: 'เบอร์ 8 คือตัวเชื่อมเกมขึ้นลง ส่วนเบอร์ 10 และ 21, 23 มักเป็นเพลย์เมกเกอร์จอมสร้างสรรค์เกม'
  },
  LCM: {
    label: 'กองกลางซ้าย (LCM)',
    primary: [8, 10],
    alt: [7, 14, 19, 20, 21, 23, 47],
    reason: 'เบอร์ 8 คือตัวเชื่อมเกมขึ้นลง ส่วนเบอร์ 10 และ 21, 23 มักเป็นเพลย์เมกเกอร์จอมสร้างสรรค์เกม'
  },
  RCM: {
    label: 'กองกลางขวา (RCM)',
    primary: [8, 10],
    alt: [7, 14, 19, 20, 21, 23, 47],
    reason: 'เบอร์ 8 คือตัวเชื่อมเกมขึ้นลง ส่วนเบอร์ 10 และ 21, 23 มักเป็นเพลย์เมกเกอร์จอมสร้างสรรค์เกม'
  },
  CAM: {
    label: 'กองกลางตัวรุก (CAM)',
    primary: [10, 8],
    alt: [7, 14, 19, 20, 21, 23, 47],
    reason: 'เบอร์ 8 คือตัวเชื่อมเกมขึ้นลง ส่วนเบอร์ 10 และ 21, 23 มักเป็นเพลย์เมกเกอร์จอมสร้างสรรค์เกม'
  },
  LW: {
    label: 'ปีกซ้าย (LW)',
    primary: [7, 11],
    alt: [10, 17, 19, 20, 22, 77],
    reason: 'นักเตะริมเส้นสายความเร็วและเลี้ยงบอลมักเลือกเบอร์ 7, 11, 17 เพื่อสื่อถึงความคล่องตัวและเกมรุก'
  },
  RW: {
    label: 'ปีกขวา (RW)',
    primary: [7, 11],
    alt: [10, 17, 19, 20, 22, 77],
    reason: 'นักเตะริมเส้นสายความเร็วและเลี้ยงบอลมักเลือกเบอร์ 7, 11, 17 เพื่อสื่อถึงความคล่องตัวและเกมรุก'
  },
  LM: {
    label: 'มิดฟิลด์ริมเส้นซ้าย (LM)',
    primary: [11, 7],
    alt: [10, 17, 19, 20, 22, 77],
    reason: 'นักเตะริมเส้นสายความเร็วและเลี้ยงบอลมักเลือกเบอร์ 7, 11, 17 เพื่อสื่อถึงความคล่องตัวและเกมรุก'
  },
  RM: {
    label: 'มิดฟิลด์ริมเส้นขวา (RM)',
    primary: [7, 11],
    alt: [10, 17, 19, 20, 22, 77],
    reason: 'นักเตะริมเส้นสายความเร็วและเลี้ยงบอลมักเลือกเบอร์ 7, 11, 17 เพื่อสื่อถึงความคล่องตัวและเกมรุก'
  },
  ST: {
    label: 'กองหน้าตัวเป้า (ST)',
    primary: [9],
    alt: [7, 10, 11, 14, 18, 19, 20, 99],
    reason: 'กองหน้าจอมถล่มประตูมักยึดเบอร์ 9 เป็นหลัก หากเบอร์หลักไม่ว่างมักขยับไปใช้ 14, 18, 19 หรือ 99'
  },
  LS: {
    label: 'หน้าคู่ซ้าย (LS)',
    primary: [9],
    alt: [7, 10, 11, 14, 18, 19, 20, 99],
    reason: 'กองหน้าจอมถล่มประตูมักยึดเบอร์ 9 เป็นหลัก หากเบอร์หลักไม่ว่างมักขยับไปใช้ 10, 11, 14, 18, 19 หรือ 99'
  },
  RS: {
    label: 'หน้าคู่ขวา (RS)',
    primary: [9],
    alt: [7, 10, 11, 14, 18, 19, 20, 99],
    reason: 'กองหน้าจอมถล่มประตูมักยึดเบอร์ 9 เป็นหลัก หากเบอร์หลักไม่ว่างมักขยับไปใช้ 10, 11, 14, 18, 19 หรือ 99'
  },
  CF: {
    label: 'กองหน้าตัวต่ำ (CF)',
    primary: [9],
    alt: [7, 10, 11, 14, 18, 19, 20, 99],
    reason: 'กองหน้าจอมถล่มประตูมักยึดเบอร์ 9 เป็นหลัก หากเบอร์หลักไม่ว่างมักขยับไปใช้ 14, 18, 19 หรือ 99'
  }
};

export function getPositionShirtGuide(ro?: SubRole | string, pos?: Position): PositionShirtGuide {
  const norm = normalizeSubRole(ro);
  if (ro && ROLE_SHIRT_POOLS[norm]) return ROLE_SHIRT_POOLS[norm];
  if (pos === 'GK') return ROLE_SHIRT_POOLS.GK;
  if (pos === 'DF') return ROLE_SHIRT_POOLS.LCB;
  if (pos === 'FW') return ROLE_SHIRT_POOLS.ST;
  return ROLE_SHIRT_POOLS.CM;
}

export const NOP: Record<string, number[]> = {
  GK: [1, 12, 13, 16, 22, 25, 31, 33, 99],
  DF: [2, 3, 4, 5, 12, 14, 15, 22, 23, 24, 26, 27, 33, 66],
  MF: [6, 8, 10, 7, 14, 16, 17, 18, 19, 20, 21, 23, 25, 42, 47],
  FW: [9, 7, 10, 11, 14, 17, 18, 19, 20, 22, 77, 99]
};

const shuffleArr = <T,>(arr: T[]): T[] => {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export function getShirtNo(team: Team | null | undefined, q: Partial<Player>): number {
  if (q.no && q.no >= 1 && q.no <= 99) return q.no;
  const guide = getPositionShirtGuide(q.ro, q.pos);
  if (!team) return Array.isArray(q.vis) && q.vis[5] ? q.vis[5] : guide.primary[0] || 10;
  const used = new Set(team.sq.map((z) => z.no).filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 99));
  const pool = [...guide.primary, ...guide.alt, ...(NOP[q.pos || 'MF'] || [])];
  let n = pool.find((v) => !used.has(v));
  if (!n) {
    for (let i = 12; i <= 99; i++) {
      if (!used.has(i)) { n = i; break; }
    }
  }
  if (!n) {
    for (let i = 1; i <= 11; i++) {
      if (!used.has(i)) { n = i; break; }
    }
  }
  return n || 10;
}

export function autoAssignAllTeamShirtNumbers(
  team: Team,
  careerP?: PlayerCareerProfile | null,
  randomize = false
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
    const guide = getPositionShirtGuide(slotRole, q.pos);
    const posPool = NOP[q.pos] || [];
    const primaryPool = randomize ? shuffleArr(guide.primary) : guide.primary;
    const altPool = randomize ? shuffleArr(guide.alt) : guide.alt;

    let candidates: number[];
    if (isStarter) {
      // Starters occasionally adopt popular alt numbers (e.g. 66 RB, 23 CM, 99 ST) when randomizing per season
      candidates = randomize && Math.random() < 0.28
        ? [...altPool.slice(0, 3), ...primaryPool, ...altPool, ...posPool]
        : [...primaryPool, ...altPool, ...posPool];
    } else {
      const altReserve = altPool.filter((n) => n >= 12);
      const posReserve = posPool.filter((n) => n >= 12);
      candidates = randomize
        ? [...shuffleArr(altReserve), ...shuffleArr(posReserve), ...primaryPool, ...altPool]
        : [...altReserve, ...posReserve, ...altPool];
    }

    for (const n of candidates) {
      if (!used.has(n)) return n;
    }
    const fallbackRange = randomize ? shuffleArr(Array.from({ length: 88 }, (_, i) => i + 12)) : Array.from({ length: 88 }, (_, i) => i + 12);
    for (const i of fallbackRange) {
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

export function assignTeamShirtNumbers(
  team: Team,
  opts?: { randomize?: boolean; careerP?: PlayerCareerProfile | null; keepMeNo?: boolean }
) {
  if (opts?.randomize) {
    const used = new Set<number>();
    const preservedMe = opts.keepMeNo ? team.sq.find((q) => q.me && q.no && q.no >= 1 && q.no <= 99) : undefined;
    if (preservedMe?.no) {
      used.add(preservedMe.no);
    }
    const starters = xi(team);
    const starterSlotMap = new Map<string, SubRole>();
    const slots = getFormationSlots(team);
    starters.forEach((q, idx) => {
      starterSlotMap.set(q.n, slots[idx]?.sp || q.ro);
    });
    const starterSet = new Set(starters.map((q) => q.n));
    const ordered = [
      ...shuffleArr(starters).map((q) => [q, true] as const),
      ...shuffleArr(team.sq.filter((q) => !starterSet.has(q.n))).map((q) => [q, false] as const)
    ];

    ordered.forEach(([q, isStarter]) => {
      if (preservedMe && q === preservedMe && q.no) {
        if (Array.isArray(q.vis) && q.vis.length >= 6) q.vis[5] = q.no;
        if (opts.careerP) opts.careerP.no = q.no;
        return;
      }
      const role = starterSlotMap.get(q.n) || q.ro;
      const guide = getPositionShirtGuide(role, q.pos);
      const posPool = NOP[q.pos] || [];
      const primaryPool = shuffleArr(guide.primary);
      const altPool = shuffleArr(guide.alt);
      const candidates = isStarter
        ? Math.random() < 0.28
          ? [...altPool.slice(0, 3), ...primaryPool, ...altPool, ...posPool]
          : [...primaryPool, ...altPool, ...posPool]
        : [...altPool.filter((n) => n >= 12), ...shuffleArr(posPool.filter((n) => n >= 12)), ...primaryPool, ...altPool];

      let chosen = candidates.find((n) => !used.has(n));
      if (!chosen) {
        const rest = shuffleArr(Array.from({ length: 88 }, (_, i) => i + 12));
        chosen = rest.find((n) => !used.has(n));
      }
      if (!chosen) {
        for (let i = 1; i <= 11; i++) {
          if (!used.has(i)) { chosen = i; break; }
        }
      }
      q.no = chosen || 10;
      used.add(q.no);
      if (Array.isArray(q.vis) && q.vis.length >= 6) {
        q.vis[5] = q.no;
      }
      if (q.me && opts.careerP) {
        opts.careerP.no = q.no;
      }
    });
    return;
  }

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
      const guide = getPositionShirtGuide(q.ro, q.pos);
      const pool = [...guide.primary, ...guide.alt, ...(NOP[q.pos] || [])];
      let n = pool.find((v) => !used.has(v));
      if (!n) {
        for (let i = 12; i <= 99; i++) {
          if (!used.has(i)) { n = i; break; }
        }
      }
      if (!n) {
        for (let i = 1; i <= 11; i++) {
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

const HANDSOME_HAIR_POOL = [20, 21, 22, 23, 24, 25, 14, 15, 16, 17, 18, 19, 9, 7, 5, 2, 0, 1, 6, 10];
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
      const eqRo = (EQ[ro] || ro) as SubRole;
      if (t.roles?.includes(ro) || t.roles?.includes(eqRo)) w += 4;
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
  const validRaw = raw ? raw.map((id) => TRAIT_BY_ID[id]).filter((t): t is FootballTraitDef => Boolean(t)) : [];
  if (validRaw.length > 0) return validRaw;
  const fallbackIds = rollPlayerTraits(
    q.pos || 'MF',
    q.ro || 'CM',
    q.ov || 60,
    q.talent || 60,
    `${q.n || 'นักเตะ'}:${q.pos || 'MF'}:${q.ro || 'CM'}`
  );
  return fallbackIds.map((id) => TRAIT_BY_ID[id]).filter((t): t is FootballTraitDef => Boolean(t));
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
  } else if (ro === 'CB' || ro === 'LCB' || ro === 'RCB') {
    minH = 179;
    maxH = 192;
    bmiBase = 23.1;
  } else if (ro === 'ST' || ro === 'LS' || ro === 'RS' || ro === 'CF') {
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

export function mkPlayer(
  pos: Position,
  baseOv: number,
  yo?: boolean,
  forceRo?: SubRole,
  nameOpts?: { foreignRegion?: ForeignNameRegion; natCode?: string; allowImport?: boolean; excludeNames?: Set<string> }
): Player {
  const age = yo ? R(16, 18) : R(17, 34);
  const ov = yo ? clamp(baseOv + R(-6, 4), 20, 82) : clamp(baseOv + R(-9, 9), 25, 92);
  const talent = yo
    ? clamp(Math.round(48 + (ov - 45) * 0.45 + R(8, 36)), 40, 96)
    : clamp(Math.round(38 + (ov - 50) * 0.55 + R(-10, 30)), 28, 95);
  const potBoost = talent >= 80 ? R(4, 10) : 0;
  const ro = forceRo || SPW(pos);
  const bio = rollPlayerBio(pos, ro);

  let resolvedRegion = nameOpts?.foreignRegion;
  let resolvedNat = nameOpts?.natCode;
  if (!resolvedRegion && resolvedNat && COUNTRY_META_BY_CODE[resolvedNat]) {
    resolvedRegion = COUNTRY_META_BY_CODE[resolvedNat].region;
  }
  if (resolvedRegion && nameOpts?.allowImport && Math.random() < 0.16) {
    const imp = pickImportCountryMeta(resolvedNat);
    resolvedRegion = imp.region;
    resolvedNat = imp.code;
  }

  const playerName = resolvedRegion
    ? genForeignPlayerName(resolvedRegion, {
        allowImport: false,
        excludeNames: nameOpts?.excludeNames
      })
    : genPlayerName();
  const pl: Player = {
    n: playerName,
    ...(resolvedNat ? { nat: resolvedNat } : {}),
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
  initPlayerWellbeing(pl);
  return pl;
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
    const isUserMgr = s.mode === 'm' && t.id === s.me;
    if (!isUserMgr) {
      const isLegacyUniform =
        !t.philosophy &&
        t.form === '4-4-2' &&
        t.tac === 'B' &&
        (t.press ?? 1) === 1 &&
        (t.tempo ?? 1) === 1 &&
        (t.wid ?? 1) === 1 &&
        (t.line ?? 1) === 1 &&
        (t.pass ?? 1) === 1;
      if (isLegacyUniform || (allowSeasonRefresh && Math.random() < 0.55)) {
        const avgOv = t.sq.length ? t.sq.reduce((sum, q) => sum + q.ov, 0) / t.sq.length : BASE[t.tier] || 55;
        const relDiff = Math.round(avgOv - (BASE[Math.min(t.tier, BASE.length - 1)] || 55));
        const ph = pickClubPhilosophy(t.id, t.tier, relDiff, true);
        applyClubPhilosophy(t, ph);
      } else if (!t.philosophy) {
        const matched = CLUB_PHILOSOPHIES.find((p) => p.form === t.form && p.tac === t.tac) || CLUB_PHILOSOPHIES.find((p) => p.form === t.form);
        if (matched) t.philosophy = matched.name;
      }
    }
    autoAssignTeamRoles(t, {
      careerP: t.id === s.me ? s.p : null,
      forceAll: !isUserMgr && allowSeasonRefresh
    });
  });
}

export function scoreCaptainCandidate(q: Player, careerP?: PlayerCareerProfile | null): number {
  const D = DT(q, careerP);
  const ageScore = q.age >= 24 ? (q.age <= 32 ? 9 : 6) : q.age >= 21 ? 1 : -6;
  const traitBonus = hasTrait(q, 'team_first', careerP) ? 5 : 0;
  const persBonus =
    (D.tr === 0 ? 18 : 0) +
    (D.tr === 21 ? 16 : 0) +
    (D.tr === 6 || D.tr === 23 ? 10 : 0) +
    (D.tr === 4 || D.tr === 17 ? 8 : 0) +
    (D.tr === 14 ? 5 : 0) +
    (D.tr === 1 || D.tr === 7 || D.tr === 15 ? -14 : 0);
  const posBias = q.pos === 'GK' ? -4 : q.pos === 'DF' || q.pos === 'MF' ? 2 : 0;
  return q.ov * 1.15 + ageScore + (D.d.comp + D.d.det) * 0.14 + traitBonus + persBonus + posBias;
}

export function pickBestCaptain(
  team: Team,
  eligibleNames?: string[],
  excludeNames?: string[],
  careerP?: PlayerCareerProfile | null
): string | undefined {
  const excl = new Set(excludeNames || []);
  const eligSet = eligibleNames && eligibleNames.length ? new Set(eligibleNames) : null;
  let pool = team.sq.filter((q) => !excl.has(q.n) && (!eligSet || eligSet.has(q.n)) && q.inj === 0 && (q.sus || 0) === 0);
  if (!pool.length) {
    pool = team.sq.filter((q) => !excl.has(q.n) && (!eligSet || eligSet.has(q.n)));
  }
  if (!pool.length) {
    pool = team.sq.filter((q) => !excl.has(q.n));
  }
  if (!pool.length) return undefined;
  return pool.slice().sort((a, b) => scoreCaptainCandidate(b, careerP) - scoreCaptainCandidate(a, careerP))[0]?.n;
}

export function scoreSetPieceCandidate(
  q: Player,
  kind: 'corner' | 'freekick' | 'penalty',
  careerP?: PlayerCareerProfile | null
): number {
  if (q.pos === 'GK') return -500 + q.ov * 0.1;
  const D = DT(q, careerP);
  const specBonus = hasTrait(q, 'setpiece_specialist', careerP) ? 22 : 0;
  if (kind === 'corner') {
    return (
      D.d.crs * 1.15 +
      D.d.cur * 0.95 +
      (D.sig === 'crs' ? 12 : 0) +
      specBonus +
      (hasTrait(q, 'early_crosser', careerP) || hasTrait(q, 'trivela_cross', careerP) ? 10 : 0) +
      q.ov * 0.25
    );
  }
  if (kind === 'freekick') {
    return (
      D.d.cur * 1.1 +
      D.d.pw * 0.85 +
      D.d.fin * 0.35 +
      (D.sig === 'cur' ? 12 : 0) +
      specBonus +
      (hasTrait(q, 'outside_curler', careerP) || hasTrait(q, 'long_shot_lover', careerP) ? 9 : 0) +
      q.ov * 0.25
    );
  }
  return (
    D.d.fin * 1.15 +
    (D.d.comp || 60) * 0.95 +
    D.d.pw * 0.25 +
    (D.sig === 'fin' ? 10 : 0) +
    (D.tr === 17 || D.tr === 4 ? 14 : D.tr === 6 || D.tr === 23 ? 8 : D.tr === 7 || D.tr === 22 ? -6 : 0) +
    (hasTrait(q, 'setpiece_specialist', careerP) ? 12 : 0) +
    q.ov * 0.25
  );
}

export function autoAssignTeamRoles(
  team: Team,
  opts?: { careerP?: PlayerCareerProfile | null; forceAll?: boolean }
) {
  if (!team.sq.length) return;
  const careerP = opts?.careerP;
  const forceAll = Boolean(opts?.forceAll);
  const starters = xi(team);
  const starterNames = starters.map((q) => q.n);
  const outfieldStarters = starters.filter((q) => q.pos !== 'GK');
  const outfieldPool = outfieldStarters.length ? outfieldStarters : team.sq.filter((q) => q.pos !== 'GK');
  const fallbackPool = outfieldPool.length ? outfieldPool : team.sq;

  const hasCap = Boolean(team.cap && team.sq.some((q) => q.n === team.cap));
  if (forceAll || !hasCap) {
    const capPick = pickBestCaptain(team, starterNames, undefined, careerP) || pickBestCaptain(team, undefined, undefined, careerP);
    if (capPick) team.cap = capPick;
  }

  const sp = team.setPieces || {};
  const validInSq = (name?: string) => Boolean(name && team.sq.some((q) => q.n === name && q.pos !== 'GK'));
  const pickSp = (kind: 'corner' | 'freekick' | 'penalty') =>
    fallbackPool
      .slice()
      .sort((a, b) => scoreSetPieceCandidate(b, kind, careerP) - scoreSetPieceCandidate(a, kind, careerP))[0]?.n;

  team.setPieces = {
    corner: forceAll || !validInSq(sp.corner) ? pickSp('corner') : sp.corner,
    freekick: forceAll || !validInSq(sp.freekick) ? pickSp('freekick') : sp.freekick,
    penalty: forceAll || !validInSq(sp.penalty) ? pickSp('penalty') : sp.penalty
  };
}

export function mkTeam(
  name: string,
  tier: number,
  id: number,
  diff = R(-7, 7),
  opts?: { foreign?: boolean; nameRegion?: ForeignNameRegion; natCode?: string; kcOverride?: [string, string]; allowImport?: boolean; keepName?: boolean }
): Team {
  const kp = KIT_P[(id + tier * 5) % KIT_P.length];
  const hasSpace = name.includes(' ');
  const sx = opts?.keepName || hasSpace ? '' : P(SFX0[tier] || ['']);
  const ph = pickClubPhilosophy(id, tier, diff, true);
  const fsdSlots = FSD[ph.form] || FSD['4-4-2'];
  const slotRolesByPos: Record<Position, SubRole[]> = { GK: [], DF: [], MF: [], FW: [] };
  fsdSlots.forEach(([sp]) => {
    const normSp = normalizeSubRole(sp);
    const naturalRo: SubRole =
      normSp === 'CB'
        ? Math.random() < 0.78
          ? P(['LCB', 'RCB'])
          : 'CB'
        : normSp === 'LS' || normSp === 'RS'
          ? Math.random() < 0.7
            ? 'ST'
            : normSp
          : normSp;
    const pos = LINE[normSp] || 'MF';
    slotRolesByPos[pos].push(naturalRo);
  });

  const meta = opts?.foreign ? getForeignTeamCountryMeta(name) : null;
  const foreignRegion = opts?.nameRegion || (opts?.foreign ? meta?.region || inferForeignTeamRegion(name) || 'intl' : undefined);
  const natCode = opts?.natCode || (opts?.foreign ? meta?.code : undefined);
  const allowImport = opts?.allowImport ?? Boolean(opts?.foreign);

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
      return mkPlayer(
        p,
        baseOv + R(-4, 4),
        false,
        forceRo,
        foreignRegion ? { foreignRegion, natCode, allowImport } : undefined
      );
    });
  });

  const team: Team = {
    id,
    name: name + (sx ? ' ' + sx : ''),
    tier,
    kc: opts?.kcOverride ? [opts.kcOverride[0], opts.kcOverride[1]] : [kp[0], kp[1]],
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
  autoAssignTeamRoles(team, { forceAll: true });
  return team;
}

export const getFormationSlots = (t?: Team): { sp: SubRole; x: number; y: number; pos: Position }[] => {
  const raw = t?.form === 'custom' && t.cf && t.cf.length === 11 ? t.cf : FSD[t?.form || '4-4-2'] || FSD['4-4-2'];
  return raw.map(([sp, x, y]) => {
    const normSp = normalizeSubRole(sp);
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
  if (q.ro) q.ro = normalizeSubRole(q.ro);
  if (!q.ro) {
    q.ro = typeof q.sp === 'string' && LINE[q.sp] === q.pos ? normalizeSubRole(q.sp) : SPW(q.pos);
  }
  if (q.altRoles?.length) {
    q.altRoles = Array.from(new Set(q.altRoles.map((r) => normalizeSubRole(r)))).filter((r) => r !== q.ro);
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
      a[k] = clamp(a[k] + d, 10, 199);
    });
  }
  return a;
}

export const ef = (q: Player) => {
  const fitVal = q.fit ?? 100;
  const tiredPenalty = fitVal < 58 ? (58 - fitVal) * 0.45 : 0;
  const favBonus = getActiveFavBoost(q);
  const wellbeingAdj = getWellbeingOvrAdjustment(q);
  return (q.ov + favBonus + wellbeingAdj) * (0.75 + (0.25 * fitVal) / 100) - tiredPenalty - (q.inj > 0 || (q.sus || 0) > 0 ? 60 : 0);
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
    // Fallback: if injuries/formation changes leave any slot empty, assign best fit available player
    sl.forEach((slot, i) => {
      if (o[i]) return;
      const cand = t.sq
        .filter(
          (q) =>
            !uq.has(q) &&
            (slot.pos === 'GK'
              ? true
              : q.pos !== 'GK' || (q.altRoles?.some((r) => LINE[r] !== 'GK') ?? false))
        )
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
    const slotSp = sl[i]?.sp || q.ro;
    const slotPos = sl[i]?.pos || q.pos;
    const avail = t.sq.filter((z) => !used.has(z) && !(z.inj > 0 || (z.sus || 0) > 0));
    const s =
      avail.filter((z) => playerPen(z, slotSp) === 0).sort((a, b) => ef(b) - ef(a))[0] ||
      avail.filter((z) => z.pos === slotPos).sort((a, b) => ef(b) - ef(a))[0] ||
      avail.sort((a, b) => ef(b) - ef(a))[0];
    if (s) {
      used.add(s);
      return s;
    }
    return q;
  });
}

type DtResult = {
  a: CoreAttrs;
  h: number;
  d: Record<string, number>;
  sig: string;
  tlVal: number;
  tr: number;
  pk: number;
};

const DT_CACHE = new WeakMap<Player, { key: string; res: DtResult }>();

const objSig = (rec?: Record<string, number> | CoreAttrs | null): string => {
  if (!rec) return '';
  let out = '';
  for (const k in rec) {
    out += `${k}:${(rec as Record<string, number>)[k]},`;
  }
  return out;
};

export function DT(q: Player, careerP?: PlayerCareerProfile | null): DtResult {
  const po = q.me ? careerP : null;
  let cacheKey = '';
  if (!po) {
    cacheKey = `${q.n || ''}|${q.pos}|${q.ro}|${q.ov}|${q.age}|${q.pot ?? ''}|${q.talent ?? ''}|${q.customSig ?? ''}|${q.customPers ?? ''}|${objSig(q.sb)}|${objSig(q.coreSb)}|${objSig(q.customA)}|${objSig(q.customD)}`;
    const cached = DT_CACHE.get(q);
    if (cached && cached.key === cacheKey) return cached.res;
  }
  const aSrc = po?.a;
  const sb = po?.sb || q.sb;
  const nm = q.n || 'นักเตะ';
  let h = 0;
  for (let i = 0; i < nm.length; i++) h += nm.charCodeAt(i);
  const o: Record<string, Partial<CoreAttrs>> = {
    FW: { sh: 8, dr: 4, tk: -12 },
    MF: { ps: 8, dr: 2, tk: 2 },
    DF: { tk: 8, ph: 4, sh: -12 },
    GK: { ph: 6, tk: 6, sh: -20, dr: -15 }
  };
  const roleMod: Partial<Record<SubRole, Partial<CoreAttrs>>> = {
    CF: { ps: 5, dr: 2, sh: -2 },
    ST: { sh: 4, ph: 2, ps: -4 },
    LS: { sh: 4, ph: 2, ps: -4 },
    RS: { sh: 4, ph: 2, ps: -4 }
  };
  const baseRo = EQ[q.ro] || q.ro;
  const rawBaseA: CoreAttrs = aSrc
    ? { ...aSrc }
    : q.customA
      ? {
          sh: clamp(Math.round(q.customA.sh), 1, 199),
          ps: clamp(Math.round(q.customA.ps), 1, 199),
          dr: clamp(Math.round(q.customA.dr), 1, 199),
          tk: clamp(Math.round(q.customA.tk), 1, 199),
          ph: clamp(Math.round(q.customA.ph), 1, 199)
        }
      : fitA(
          q,
          Object.fromEntries(
            ATT.map(([kk], i) => [kk, clamp(q.ov + (o[q.pos][kk] || 0) + (roleMod[q.ro]?.[kk] || 0) + ((h * (i + 3)) % 11) - 5, 10, 199)])
          ) as unknown as CoreAttrs
        );
  const baseA: CoreAttrs =
    !po && q.coreSb
      ? {
          sh: clamp(Math.round(rawBaseA.sh + (q.coreSb.sh || 0)), 1, 199),
          ps: clamp(Math.round(rawBaseA.ps + (q.coreSb.ps || 0)), 1, 199),
          dr: clamp(Math.round(rawBaseA.dr + (q.coreSb.dr || 0)), 1, 199),
          tk: clamp(Math.round(rawBaseA.tk + (q.coreSb.tk || 0)), 1, 199),
          ph: clamp(Math.round(rawBaseA.ph + (q.coreSb.ph || 0)), 1, 199)
        }
      : rawBaseA;
  const hv = (n: number) => {
    const raw = (((h * (n * 7 + 3)) ^ (h >> (n % 5))) % 21) - 10;
    return po || q.customA ? Math.round(raw * 0.2) : raw;
  };
  const cl = (v: number) => clamp(Math.round(v), 1, 199);
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
    fin: cl(baseA.sh + hv(2) + (q.pos === 'FW' ? 4 : 0) + (baseRo === 'ST' ? 2 : 0)),
    cur: cl(baseA.sh * 0.5 + baseA.ps * 0.5 + hv(3) + (q.ro === 'CAM' || q.ro === 'CF' ? 2 : 0)),
    lsh: cl(baseA.sh * 0.55 + baseA.ph * 0.35 + baseA.ps * 0.1 + hv(32) + (q.ro === 'CAM' || baseRo === 'CM' || q.ro === 'LW' || q.ro === 'RW' ? 3 : 0)),
    fk: cl(baseA.sh * 0.4 + baseA.ps * 0.45 + baseA.dr * 0.15 + hv(20) + (q.pos === 'MF' ? 3 : 0)),
    run: cl(baseA.sh * 0.5 + baseA.dr * 0.3 + baseA.ph * 0.2 + hv(5) + (baseRo === 'ST' || q.ro === 'LW' || q.ro === 'RW' ? 3 : 0)),
    drb: cl(baseA.dr * 0.78 + baseA.ph * 0.12 + tlVal * 0.1 + hv(30) + (q.ro === 'LW' || q.ro === 'RW' || q.ro === 'CAM' || q.ro === 'CF' ? 3 : 0)),
    ctrl: cl(baseA.dr * 0.55 + baseA.ps * 0.35 + tlVal * 0.1 + hv(31) + (q.pos === 'MF' || q.ro === 'CF' ? 3 : 0)),
    spass: cl(baseA.ps * 0.72 + baseA.dr * 0.16 + tlVal * 0.08 + hv(28) + (q.pos === 'MF' ? 4 : q.ro === 'CF' || q.ro === 'CAM' ? 3 : 0)),
    lpass: cl(baseA.ps * 0.65 + baseA.sh * 0.18 + tlVal * 0.10 + hv(29) + (baseRo === 'CM' || baseRo === 'CDM' || baseRo === 'CB' || q.ro === 'LB' || q.ro === 'RB' ? 3 : 0)),
    crs: cl(baseA.ps * 0.7 + baseA.dr * 0.3 + hv(4) + (wing ? 6 : 0) + (q.ro === 'CF' ? 4 : 0)),
    vis: cl(baseA.ps * 0.55 + q.ov * 0.3 + tlVal * 0.15 + hv(26)),
    rd: cl(baseA.tk * 0.6 + baseA.ps * 0.4 + hv(6)),
    tkl: cl(baseA.tk * 0.72 + baseA.ph * 0.18 + baseA.dr * 0.10 + hv(7)),
    pos: cl(
      q.pos === 'GK'
        ? q.ov * 0.25 + baseA.tk * 0.55 + baseA.ps * 0.1 + baseA.ph * 0.1 + hv(21)
        : baseA.tk * 0.55 + baseA.ps * 0.35 + baseA.ph * 0.10 + hv(21) + (q.pos === 'DF' || baseRo === 'CDM' ? 3 : 0)
    ),
    mrk: cl(baseA.tk * 0.65 + baseA.ph * 0.2 + baseA.ps * 0.15 + hv(18) + (q.pos === 'DF' ? 4 : 0)),
    blk: cl(baseA.tk * 0.55 + baseA.ph * 0.35 + baseA.ps * 0.1 + hv(19) + (baseRo === 'CB' ? 4 : 0)),
    hd: cl(baseA.ph * 0.7 + baseA.tk * 0.3 + hv(8)),
    spd: cl(baseA.dr * 0.5 + baseA.ph * 0.5 + hv(9) - Math.max(0, ag - 31) * 2),
    acc: cl(baseA.dr * 0.55 + baseA.ph * 0.45 + hv(33) - Math.max(0, ag - 30) * 2 + (wing ? 2 : 0)),
    str: cl(baseA.ph + hv(10)),
    sta: cl(baseA.ph * 0.8 + hv(11) + (ag < 30 ? 3 : -3)),
    agi: cl(baseA.dr * 0.65 + baseA.ph * 0.25 + (100 - Math.max(0, ag - 28) * 2) * 0.1 + hv(22)),
    jmp: cl(baseA.ph * 0.65 + baseA.tk * 0.2 + (q.pos === 'GK' || baseRo === 'CB' || baseRo === 'ST' ? 5 : 0) + hv(23)),
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
  const res: DtResult = { a: baseA, h, d, sig, tlVal, tr, pk: 26 + ((h >> 2) % 4) };
  if (!po) DT_CACHE.set(q, { key: cacheKey, res });
  return res;
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
        ['กระโดดสูง', d.jmp, 'jmp']
      ]
    ],
    [
      '🔋 พลังงาน',
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
        ? `✚ บาดเจ็บ ${q.inj} นัด`
        : f < 60
          ? `⚠️ เหนื่อยล้า (${f}%)`
          : `✅ พร้อมลง (${f}%)`;
  return { D0, a, f, d, gk, G, top, TR, traits, bio, ag, gro, stCls, stTxt };
}

export type StatGroupKey = 'atk' | 'ply' | 'def' | 'gk' | 'phy' | 'fit' | 'tal';

export interface StatCategorySummary {
  key: StatGroupKey;
  shortLabel: string;
  fullLabel: string;
  value: number;
}

const STAT_GROUP_META_BY_TITLE: Record<string, { key: StatGroupKey; shortLabel: string }> = {
  '⚔️ โจมตี': { key: 'atk', shortLabel: 'โจมตี' },
  '⚽ การเล่น': { key: 'ply', shortLabel: 'การเล่น' },
  '🛡️ ป้องกัน': { key: 'def', shortLabel: 'ป้องกัน' },
  '🧤 ผู้รักษาประตู': { key: 'gk', shortLabel: 'ประตู' },
  '💪 ร่างกาย': { key: 'phy', shortLabel: 'ร่างกาย' },
  '🔋 พลังงาน': { key: 'fit', shortLabel: 'พลังงาน' },
  '🌟 พรสวรรค์': { key: 'tal', shortLabel: 'พรสวรรค์' }
};

export function summarizeStatGroups(
  groups: [string, [string, number, string?][]][]
): StatCategorySummary[] {
  return groups.map(([title, rows]) => {
    const meta = STAT_GROUP_META_BY_TITLE[title] || {
      key: 'phy' as StatGroupKey,
      shortLabel: title.replace(/^\S+\s*/, '').trim() || title
    };
    const total = rows.reduce((sum, r) => sum + (Number(r[1]) || 0), 0);
    const value = rows.length ? Math.round(total / rows.length) : 0;
    return {
      key: meta.key,
      shortLabel: meta.shortLabel,
      fullLabel: title,
      value
    };
  });
}

export function getPlayerCategoryStats(
  q: Player,
  careerP?: PlayerCareerProfile | null
): StatCategorySummary[] {
  return summarizeStatGroups(dtInfo(q, q.me ? careerP : null).G);
}

export function injD(q: Player, n: number, careerP?: PlayerCareerProfile | null): number {
  const r = DT(q, careerP).d.rec;
  return Math.max(1, n + (r >= 80 ? -1 : r < 55 ? 1 : 0));
}

export const ovMe = (p: PlayerCareerProfile) => OVF(p.pos, p.a);

export function getOvGrowthScale(curOv: number, _pot?: number): number {
  // Uncapped continuous growth until declining/retirement, with realistic tapering at elite tiers
  if (curOv >= 106) return 0.025;
  if (curOv >= 99) return 0.035;
  if (curOv >= 93) return 0.05;
  if (curOv >= 89) return 0.09;
  if (curOv >= 84) return 0.18;
  if (curOv >= 78) return 0.32;
  if (curOv >= 72) return 0.50;
  if (curOv >= 64) return 0.72;
  return 1.0;
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
    ageMult = avgRating >= 7.05 ? 0.75 : 0.58;
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
  if (prof.phase === 'declining' || !prof.strongSeason || q.ov < curPot - 4 || curPot >= 195) {
    return { brokeThrough: false, newPot: curPot, becameSuperstar: false };
  }
  const tlVal = prof.D.tlVal;
  const talentFactor = 0.52 + (tlVal / 100) * 0.88;
  const formBoost = prof.avgRating >= 7.55 ? 1.55 : prof.avgRating >= 7.25 ? 1.25 : 0.95;
  const ageFactor = prof.phase === 'growing' ? 1.15 : 0.85;
  const chance = clamp(baseChance * talentFactor * formBoost * ageFactor, 0.006, 0.42);
  if (Math.random() >= chance) {
    return { brokeThrough: false, newPot: curPot, becameSuperstar: false };
  }
  const gain = (prof.avgRating >= 7.5 || tlVal >= 78) && Math.random() < 0.45 ? 2 : 1;
  const newPot = clamp(Math.max(curPot + gain, q.ov + 2), q.ov + 1, 199);
  const wasSuperstar = curPot >= 86;
  q.pot = newPot;
  q.talent = clamp((q.talent ?? tlVal) + R(1, 2), 30, 99);
  if (q.me && careerP) {
    careerP.talent = q.talent;
  }
  return { brokeThrough: true, newPot, becameSuperstar: !wasSuperstar && newPot >= 86 };
}

export function autoGrow(p: PlayerCareerProfile, n = 1, _potCap?: number): string {
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
    const av = w.filter((k) => p.a[k] < 199);
    if (!av.length) break;
    // Prefer attributes that haven't hit extreme levels yet for realistic multi-season balance
    const lowAv = av.filter((k) => p.a[k] < 80);
    const k = lowAv.length && Math.random() < 0.78 ? P(lowAv) : P(av);
    if (p.a[k] >= 102 && Math.random() > 0.10) continue;
    if (p.a[k] >= 95 && Math.random() > 0.16) continue;
    if (p.a[k] >= 88 && Math.random() > 0.28) continue;
    if (p.a[k] >= 82 && Math.random() > 0.48) continue;
    if (p.a[k] >= 75 && Math.random() > 0.72) continue;
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
  const q = s.teams[s.me]?.sq.find((x) => x.me);
  if (s.p.pts > 0) {
    autoGrow(s.p, s.p.pts);
    s.p.pts = 0;
  }
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
    if (!q.pot || q.pot < q.ov + 4) q.pot = clamp(Math.max(92, q.ov + 6), q.ov + 4, 199);
    if (q.blessed) {
      q.customA = { ...s.p.a };
      if (s.p.sig) q.customSig = s.p.sig;
      if (s.p.customD) q.customD = { ...s.p.customD };
      if (s.p.age) q.age = s.p.age;
    } else {
      if (q.age && (!s.p.age || s.p.age < q.age)) s.p.age = q.age;
      else if (s.p.age) q.age = s.p.age;
    }
    if (s.p.mental != null) q.mental = s.p.mental;
    else if (q.mental != null) s.p.mental = q.mental;
    if (s.p.phys != null) q.phys = s.p.phys;
    else if (q.phys != null) s.p.phys = q.phys;
    if (s.p.mentalNote != null) q.mentalNote = s.p.mentalNote;
    else if (q.mentalNote != null) s.p.mentalNote = q.mentalNote;
    if (s.p.physNote != null) q.physNote = s.p.physNote;
    else if (q.physNote != null) s.p.physNote = q.physNote;
    if (s.p.mentalFactors) q.mentalFactors = s.p.mentalFactors;
    else if (q.mentalFactors) s.p.mentalFactors = q.mentalFactors;
    if (s.p.physFactors) q.physFactors = s.p.physFactors;
    else if (q.physFactors) s.p.physFactors = q.physFactors;
    if (s.p.favBoost != null) q.favBoost = s.p.favBoost;
    else if (q.favBoost != null) s.p.favBoost = q.favBoost;
    if (s.p.careTalkMd != null) q.careTalkMd = s.p.careTalkMd;
    else if (q.careTalkMd != null) s.p.careTalkMd = q.careTalkMd;
    if (s.p.carePhysMd != null) q.carePhysMd = s.p.carePhysMd;
    else if (q.carePhysMd != null) s.p.carePhysMd = q.carePhysMd;
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
  atk?: number;
  ply?: number;
  def?: number;
  gk?: number;
  phy?: number;
  fit?: number;
  tal?: number;
}

const snapshotCategoryFields = (
  q: Player,
  snapOv: number,
  snapAttrs: CoreAttrs,
  careerP: PlayerCareerProfile | null | undefined,
  useExactLive: boolean
): Partial<Record<StatGroupKey, number>> => {
  const groups = useExactLive
    ? dtInfo(q, q.me ? careerP : null).G
    : dtInfo(
        {
          ...q,
          ov: snapOv,
          fit: 100,
          customA: snapAttrs,
          coreSb: undefined,
          customD: undefined
        },
        q.me && careerP ? { ...careerP, a: snapAttrs } : null
      ).G;
  const out: Partial<Record<StatGroupKey, number>> = {};
  summarizeStatGroups(groups).forEach((cat) => {
    out[cat.key] = cat.value;
  });
  return out;
};

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

  return expanded.map((pt, idx) => {
    const isLatest = idx === expanded.length - 1;
    const snapOv = isLatest ? liveSnap.ov : pt.ov;
    const snapA = isLatest ? liveSnap.a : pt.a;
    return {
      md: pt.md,
      label: pt.md === 0 ? 'เริ่ม' : `น.${pt.md}`,
      ov: snapOv,
      sh: snapA.sh,
      ps: snapA.ps,
      dr: snapA.dr,
      tk: snapA.tk,
      ph: snapA.ph,
      ...snapshotCategoryFields(q, snapOv, snapA, careerP, isLatest)
    };
  });
}

export interface PlayerMultiSeasonChartPoint {
  season: number;
  label: string;
  teamName: string;
  ov: number;
  sh: number;
  ps: number;
  dr: number;
  tk: number;
  ph: number;
  atk?: number;
  ply?: number;
  def?: number;
  gk?: number;
  phy?: number;
  fit?: number;
  tal?: number;
  isCurrent?: boolean;
}

export function getPlayerMultiSeasonProgression(
  q: Player,
  state: Pick<GameState, 'season' | 'md' | 'teams' | 'seasonArchives' | 'mode' | 'p'>,
  careerP?: PlayerCareerProfile | null
): PlayerMultiSeasonChartPoint[] {
  const isMe = !!q.me || (state.mode === 'p' && state.p?.name === q.n);
  const pProf = isMe ? careerP || state.p : null;
  const curSeason = state.season ?? 1;
  const curOv = isMe && pProf ? ovMe(pProf) : q.ov;
  const curDt = DT(q, pProf);
  const curA = curDt.a;

  const map = new Map<number, PlayerSeasonHistoryRecord>();
  const rawHist = (pProf?.history && pProf.history.length ? pProf.history : q.history) || [];
  rawHist.forEach((h) => {
    if (h && typeof h.season === 'number') map.set(h.season, { ...h });
  });

  if (state.seasonArchives?.length) {
    state.seasonArchives.forEach((arc) => {
      if (map.has(arc.season)) return;
      const found = arc.players.find((pl) => pl.name === q.n || (isMe && pl.isMe));
      if (found) {
        map.set(arc.season, {
          season: arc.season,
          teamId: arc.teamId,
          teamName: arc.teamName,
          tier: arc.tier,
          ov: found.ov,
          sp: found.sp,
          sg: found.sg,
          sa: found.sa,
          cs: found.cs,
          motm: found.motm,
          yc: found.yc,
          rc: found.rc,
          avgRating: found.avgRating
        });
      }
    });
  }

  const synthA = (ovTarget: number, refA: CoreAttrs): CoreAttrs => {
    const scale = ovTarget / Math.max(1, curOv);
    const seedA: CoreAttrs = {
      sh: clamp(Math.round(refA.sh * scale), 10, 199),
      ps: clamp(Math.round(refA.ps * scale), 10, 199),
      dr: clamp(Math.round(refA.dr * scale), 10, 199),
      tk: clamp(Math.round(refA.tk * scale), 10, 199),
      ph: clamp(Math.round(refA.ph * scale), 10, 199)
    };
    return fitA({ ...q, ov: ovTarget }, seedA);
  };

  const pastRows = Array.from(map.values()).sort((a, b) => a.season - b.season);
  const points: PlayerMultiSeasonChartPoint[] = [];

  // Optional initial entry anchor (from careerP.b or Season 1 startA/seasonProg)
  const firstPast = pastRows[0];
  if (isMe && pProf?.b) {
    const bOv = OVF(pProf.pos, pProf.b);
    points.push({
      season: 0,
      label: 'เริ่มต้น',
      teamName: firstPast?.teamName || state.teams.find((t) => t.sq.some((x) => x.n === q.n))?.name || '',
      ov: bOv,
      sh: pProf.b.sh,
      ps: pProf.b.ps,
      dr: pProf.b.dr,
      tk: pProf.b.tk,
      ph: pProf.b.ph,
      ...snapshotCategoryFields(q, bOv, pProf.b, pProf, false)
    });
  } else if (firstPast?.startA && firstPast?.startOv) {
    points.push({
      season: 0,
      label: 'เริ่มต้น',
      teamName: firstPast.teamName,
      ov: firstPast.startOv,
      sh: firstPast.startA.sh,
      ps: firstPast.startA.ps,
      dr: firstPast.startA.dr,
      tk: firstPast.startA.tk,
      ph: firstPast.startA.ph,
      ...snapshotCategoryFields(q, firstPast.startOv, firstPast.startA, pProf, false)
    });
  } else if (!pastRows.length && q.seasonProg?.pts?.length && q.seasonProg.pts[0]) {
    const s0 = q.seasonProg.pts[0];
    if (s0.ov !== curOv || !sameCoreAttrs(s0.a, curA)) {
      points.push({
        season: 0,
        label: `ต้น S${curSeason}`,
        teamName: state.teams.find((t) => t.sq.some((x) => x.n === q.n))?.name || '',
        ov: s0.ov,
        sh: s0.a.sh,
        ps: s0.a.ps,
        dr: s0.a.dr,
        tk: s0.a.tk,
        ph: s0.a.ph,
        ...snapshotCategoryFields(q, s0.ov, s0.a, pProf, false)
      });
    }
  }

  pastRows.forEach((r) => {
    const attr = r.a ? { ...r.a } : synthA(r.ov, curA);
    points.push({
      season: r.season,
      label: `S${r.season}`,
      teamName: r.teamName,
      ov: r.ov,
      sh: attr.sh,
      ps: attr.ps,
      dr: attr.dr,
      tk: attr.tk,
      ph: attr.ph,
      ...snapshotCategoryFields(q, r.ov, attr, pProf, false)
    });
  });

  if (!map.has(curSeason) && !q.retired) {
    const curClubName = state.teams.find((t) => t.sq.some((x) => x.n === q.n))?.name || '';
    points.push({
      season: curSeason,
      label: `S${curSeason} (ปัจจุบัน)`,
      teamName: curClubName,
      ov: curOv,
      sh: curA.sh,
      ps: curA.ps,
      dr: curA.dr,
      tk: curA.tk,
      ph: curA.ph,
      ...snapshotCategoryFields(q, curOv, curA, pProf, true),
      isCurrent: true
    });
  } else if (points.length) {
    const lastIdx = points.length - 1;
    const isLiveLatest = !q.retired && points[lastIdx].season === curSeason;
    points[lastIdx] = {
      ...points[lastIdx],
      ...(isLiveLatest
        ? {
            ov: curOv,
            sh: curA.sh,
            ps: curA.ps,
            dr: curA.dr,
            tk: curA.tk,
            ph: curA.ph,
            ...snapshotCategoryFields(q, curOv, curA, pProf, true)
          }
        : {}),
      isCurrent: true
    };
  }

  return points;
}

export const ROLE_ADAPT_THRESHOLD_ADJ = 12;
export const ROLE_ADAPT_THRESHOLD_CROSS = 20;

export const ROLE_ADAPT_TARGETS: Record<string, { cores: StatKey[]; subs: string[] }> = {
  ST: { cores: ['sh', 'ph'], subs: ['fin', 'pw', 'run', 'hd'] },
  LS: { cores: ['sh', 'ph'], subs: ['fin', 'pw', 'run', 'hd'] },
  RS: { cores: ['sh', 'ph'], subs: ['fin', 'pw', 'run', 'hd'] },
  CF: { cores: ['sh', 'ps', 'dr'], subs: ['fin', 'vis', 'spass', 'ctrl'] },
  LW: { cores: ['dr', 'sh', 'ps'], subs: ['spd', 'drb', 'crs', 'cur'] },
  RW: { cores: ['dr', 'sh', 'ps'], subs: ['spd', 'drb', 'crs', 'cur'] },
  CAM: { cores: ['ps', 'dr', 'sh'], subs: ['vis', 'spass', 'lsh', 'cur'] },
  LM: { cores: ['ps', 'dr', 'ph'], subs: ['crs', 'spd', 'drb', 'sta'] },
  RM: { cores: ['ps', 'dr', 'ph'], subs: ['crs', 'spd', 'drb', 'sta'] },
  CM: { cores: ['ps', 'tk', 'ph'], subs: ['spass', 'lpass', 'rd', 'sta'] },
  LCM: { cores: ['ps', 'tk', 'ph'], subs: ['spass', 'lpass', 'rd', 'sta'] },
  RCM: { cores: ['ps', 'tk', 'ph'], subs: ['spass', 'lpass', 'rd', 'sta'] },
  CDM: { cores: ['tk', 'ps', 'ph'], subs: ['tkl', 'rd', 'pos', 'spass'] },
  LDM: { cores: ['tk', 'ps', 'ph'], subs: ['tkl', 'rd', 'pos', 'spass'] },
  RDM: { cores: ['tk', 'ps', 'ph'], subs: ['tkl', 'rd', 'pos', 'spass'] },
  LWB: { cores: ['tk', 'dr', 'ps'], subs: ['crs', 'spd', 'tkl', 'sta'] },
  RWB: { cores: ['tk', 'dr', 'ps'], subs: ['crs', 'spd', 'tkl', 'sta'] },
  LB: { cores: ['tk', 'ps', 'ph'], subs: ['tkl', 'mrk', 'spd', 'crs'] },
  RB: { cores: ['tk', 'ps', 'ph'], subs: ['tkl', 'mrk', 'spd', 'crs'] },
  CB: { cores: ['tk', 'ph'], subs: ['tkl', 'mrk', 'hd', 'blk', 'str'] },
  LCB: { cores: ['tk', 'ph'], subs: ['tkl', 'mrk', 'hd', 'blk', 'str'] },
  RCB: { cores: ['tk', 'ph'], subs: ['tkl', 'mrk', 'hd', 'blk', 'str'] },
  GK: { cores: ['ph', 'tk'], subs: ['sv', 'rfx', 'hnd', 'cl', 'pos', 'dist'] }
};

export function applyRoleMasteryBonus(
  q: Player | null | undefined,
  role: SubRole,
  careerP?: PlayerCareerProfile | null
): string[] {
  const target = ROLE_ADAPT_TARGETS[role] || ROLE_ADAPT_TARGETS.CM;
  const gains: string[] = [];

  // +1 Core Attribute suited to the unlocked role
  const primaryCore = target.cores.find((ck) => (careerP ? (careerP.a[ck] || 0) < 199 : (DT(q!, null).a[ck] || 0) < 199)) || target.cores[0];
  if (primaryCore) {
    if (careerP) {
      if ((careerP.a[primaryCore] || 0) < 199) {
        careerP.a[primaryCore] = clamp((careerP.a[primaryCore] || 1) + 1, 1, 199);
        const newOv = ovMe(careerP);
        if (q) {
          q.ov = newOv;
          q.pot = clamp(Math.max(q.pot || newOv, newOv + 1), newOv, 199);
          if (q.blessed && q.customA) q.customA = { ...careerP.a };
        }
        gains.push(`${ATT.find((x) => x[0] === primaryCore)?.[1] || primaryCore} +1`);
      }
    } else if (q) {
      q.coreSb = { ...(q.coreSb || {}) };
      q.coreSb[primaryCore] = (q.coreSb[primaryCore] || 0) + 1;
      if (q.customA) q.customA[primaryCore] = clamp((q.customA[primaryCore] || 1) + 1, 1, 199);
      const dtAfter = DT(q, null);
      const newOv = clamp(OVF(q.pos, dtAfter.a), 1, 199);
      if (newOv > q.ov) {
        q.ov = newOv;
        q.pot = clamp(Math.max(q.pot || newOv, newOv + 1), newOv, 199);
      }
      gains.push(`${ATT.find((x) => x[0] === primaryCore)?.[1] || primaryCore} +1`);
    }
  }

  // +2 Primary Role Sub-skill & +1 Secondary Role Sub-skill
  const sub1 = target.subs[0];
  const sub2 = target.subs[1];
  if (sub1) {
    if (q) {
      q.sb = { ...(q.sb || {}) };
      q.sb[sub1] = (q.sb[sub1] || 0) + 2;
    }
    if (careerP) {
      careerP.sb = { ...(careerP.sb || {}) };
      careerP.sb[sub1] = (careerP.sb[sub1] || 0) + 2;
      if (careerP.customD && careerP.customD[sub1] != null) {
        careerP.customD[sub1] = clamp(careerP.customD[sub1] + 2, 1, 199);
      }
    }
    gains.push(`${SIGL[sub1] || sub1} +2`);
  }
  if (sub2) {
    if (q) {
      q.sb = { ...(q.sb || {}) };
      q.sb[sub2] = (q.sb[sub2] || 0) + 1;
    }
    if (careerP) {
      careerP.sb = { ...(careerP.sb || {}) };
      careerP.sb[sub2] = (careerP.sb[sub2] || 0) + 1;
      if (careerP.customD && careerP.customD[sub2] != null) {
        careerP.customD[sub2] = clamp(careerP.customD[sub2] + 1, 1, 199);
      }
    }
    gains.push(`${SIGL[sub2] || sub2} +1`);
  }

  return gains;
}

export function learnCareerTrait(d: GameState, traitId: string): { ok: boolean; msg: string } {
  if (d.mode !== 'p' || !d.p) return { ok: false, msg: 'ใช้ได้เฉพาะโหมดนักเตะอาชีพ' };
  const def = TRAIT_BY_ID[traitId];
  if (!def) return { ok: false, msg: 'ไม่พบสไตล์การเล่นนี้' };
  if (!def.pos.includes(d.p.pos)) return { ok: false, msg: `สไตล์ "${def.name}" ไม่เหมาะกับตำแหน่ง ${d.p.pos}` };
  const cur = d.p.traits ? [...d.p.traits] : [];
  if (cur.includes(traitId)) return { ok: false, msg: `มีสไตล์ "${def.name}" อยู่แล้ว` };
  if (cur.length >= 6) return { ok: false, msg: 'มีสไตล์การเล่นครบสูงสุด 6 สไตล์แล้ว (ถอดสไตล์เดิมออกก่อน)' };
  const conflict = cur.find((cid) => def.conflicts?.includes(cid) || TRAIT_BY_ID[cid]?.conflicts?.includes(def.id));
  if (conflict) {
    return { ok: false, msg: `ขัดแย้งกับสไตล์ "${TRAIT_BY_ID[conflict]?.name || conflict}"` };
  }
  const cost = 6;
  if ((d.p.rep ?? 10) < cost) return { ok: false, msg: `ต้องใช้ชื่อเสียง ${cost} ★` };
  d.p.rep = (d.p.rep ?? 10) - cost;
  d.p.traits = [...cur, traitId];
  syncMe(d);
  return { ok: true, msg: `${def.icon} เรียนรู้สไตล์ "${def.name}" สำเร็จ! (-${cost} ★)` };
}

export function forgetCareerTrait(d: GameState, traitId: string): { ok: boolean; msg: string } {
  if (d.mode !== 'p' || !d.p) return { ok: false, msg: 'ใช้ได้เฉพาะโหมดนักเตะอาชีพ' };
  const cur = d.p.traits ? [...d.p.traits] : [];
  if (!cur.includes(traitId)) return { ok: false, msg: 'ไม่พบสไตล์นี้' };
  if (cur.length <= 1) return { ok: false, msg: 'ต้องมีสไตล์การเล่นติดตัวอย่างน้อย 1 สไตล์' };
  const cost = 3;
  if ((d.p.rep ?? 10) < cost) return { ok: false, msg: `ต้องใช้ชื่อเสียง ${cost} ★` };
  d.p.rep = (d.p.rep ?? 10) - cost;
  d.p.traits = cur.filter((id) => id !== traitId);
  syncMe(d);
  return { ok: true, msg: `ปรับเปลี่ยนถอดสไตล์ "${TRAIT_BY_ID[traitId]?.name || traitId}" แล้ว (-${cost} ★)` };
}

export function setCareerRoleTrainTarget(d: GameState, role: SubRole | null): { ok: boolean; msg: string } {
  if (d.mode !== 'p' || !d.p) return { ok: false, msg: 'ใช้ได้เฉพาะโหมดนักเตะอาชีพ' };
  if (!role) {
    d.p.roleTrain = null;
    syncMe(d);
    return { ok: true, msg: 'ยกเลิกเป้าหมายฝึกตำแหน่งรองแล้ว' };
  }
  if (role === d.p.sp) return { ok: false, msg: `${role} เป็นตำแหน่งหลักของคุณอยู่แล้ว` };
  if (d.p.altRoles?.includes(role)) return { ok: false, msg: `คุณปลดล็อกตำแหน่ง ${role} แล้ว` };
  d.p.roleTrain = role;
  syncMe(d);
  return { ok: true, msg: `🎯 ตั้งเป้าหมายฝึกเล่นตำแหน่ง "${role}" รายสัปดาห์แล้ว!` };
}

export function switchCareerSignature(d: GameState, sigKey: string): { ok: boolean; msg: string } {
  if (d.mode !== 'p' || !d.p) return { ok: false, msg: 'ใช้ได้เฉพาะโหมดนักเตะอาชีพ' };
  if (!SIGL[sigKey]) return { ok: false, msg: 'ไม่พบอาวุธประจำตัวนี้' };
  if (d.p.sig === sigKey) return { ok: false, msg: `ใช้อาวุธประจำตัว "${SIGL[sigKey]}" อยู่แล้ว` };
  const cost = 5;
  if ((d.p.rep ?? 10) < cost) return { ok: false, msg: `ต้องใช้ชื่อเสียง ${cost} ★` };
  d.p.rep = (d.p.rep ?? 10) - cost;
  d.p.sig = sigKey;
  const meSq = d.teams[d.me]?.sq.find((q) => q.me);
  if (meSq && meSq.blessed) meSq.customSig = sigKey;
  syncMe(d);
  return { ok: true, msg: `⚡ เปลี่ยนอาวุธประจำตัวเป็น "${SIGL[sigKey]}" (+8 โบนัสค่าพลังย่อย) สำเร็จ! (-${cost} ★)` };
}

export function trainCareerSignatureDrill(d: GameState): { ok: boolean; msg: string } {
  if (d.mode !== 'p' || !d.p) return { ok: false, msg: 'ใช้ได้เฉพาะโหมดนักเตะอาชีพ' };
  const sigKey = d.p.sig || (d.p.pos === 'GK' ? 'sv' : 'fin');
  const curBonus = d.p.sb?.[sigKey] || 0;
  if (curBonus >= 12) return { ok: false, msg: `ติวอาวุธ "${SIGL[sigKey] || sigKey}" เต็มขีดจำกัดการซ้อมพิเศษ (+12) แล้ว` };
  const cost = 4;
  if ((d.p.rep ?? 10) < cost) return { ok: false, msg: `ต้องใช้ชื่อเสียง ${cost} ★` };
  if ((d.p.en ?? 100) < 25) return { ok: false, msg: 'ความฟิตต่ำเกินไป พักฟื้นก่อนติวอาวุธพิเศษ' };
  d.p.rep = (d.p.rep ?? 10) - cost;
  d.p.en = Math.max(15, (d.p.en ?? 100) - 6);
  d.p.sb = { ...(d.p.sb || {}), [sigKey]: curBonus + 1 };
  d.p.sigDrills = (d.p.sigDrills || 0) + 1;
  syncMe(d);
  return { ok: true, msg: `🔥 ติวเข้มอาวุธประจำตัว "${SIGL[sigKey] || sigKey}" +1 (โบนัสรวม +${curBonus + 1})! (-${cost} ★)` };
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
    kit: (h >> 3) % KIT_PATTERNS.length,
    stadiumStyle: getAiTeamStadiumStyleId(t.id, t.name, t.tier)
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
      stadiumStyle: 'open_track',
      builtStadiumStyles: ['open_track'],
      managerName: 'หัวหน้าผู้ฝึกสอน',
      managerStyle: 'balanced',
      managerOutfit: 'suit_navy',
      managerRandomOutfitPerMatch: false,
      managerVis: getDefaultCoachVis(t.name || 'coach')
    };
  }
  if (!s.club.stadiumStyle) {
    s.club.stadiumStyle = 'open_track';
  }
  if (!Array.isArray(s.club.builtStadiumStyles) || s.club.builtStadiumStyles.length === 0) {
    s.club.builtStadiumStyles = [s.club.stadiumStyle];
  } else if (!s.club.builtStadiumStyles.includes(s.club.stadiumStyle)) {
    s.club.builtStadiumStyles = [...s.club.builtStadiumStyles, s.club.stadiumStyle];
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
  if (typeof s.club.managerRandomOutfitPerMatch !== 'boolean') {
    s.club.managerRandomOutfitPerMatch = false;
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
    sh: clamp(Math.round(srcA?.sh ?? 55), 1, 199),
    ps: clamp(Math.round(srcA?.ps ?? 55), 1, 199),
    dr: clamp(Math.round(srcA?.dr ?? 55), 1, 199),
    tk: clamp(Math.round(srcA?.tk ?? 55), 1, 199),
    ph: clamp(Math.round(srcA?.ph ?? 55), 1, 199)
  };
  const ov = clamp(Math.round(opts?.ovOverride ?? lp?.ov ?? OVF(p.pos, attrs)), 30, 199);
  const talent = clamp(Math.round(p.talent ?? lp?.talent ?? 78), 25, 99);
  const pot = clamp(Math.round(opts?.potOverride ?? lp?.pot ?? Math.max(ov + 14, Math.min(96, talent + 6))), ov, 199);
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

  // 1) From saved Player Career slots (lk_p .. lk_p_N)
  const pSlots = getSlotCount('p');
  for (let k = 1; k <= pSlots; k++) {
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
  const mSlots = getSlotCount('m');
  for (let k = 1; k <= mSlots; k++) {
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

