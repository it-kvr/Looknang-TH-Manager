import type { Position, SubRole, StatKey, GameMode, CoreAttrs, Player, Team, ClubIdentity, PlayerCareerProfile, GameState, FootballTraitDef } from '../types/game';
import { R, P, clamp } from '../utils/math';
import { CREST_SHAPES, CREST_PATTERNS, CREST_IC, KIT_PATTERNS } from '../data/crestAndKitData';
import { A1, A2, S1, S2, FN, SN, NG, BASE, POS, ATT, SFX0, FSD, LINE, EQ, SIMP, PM, SKIN_P, HAIR_P, KIT_P, SIGL, FOOTBALL_TRAITS, TRAIT_BY_ID } from '../data/thaiFootballData';

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

export function rndVis(pos: Position, yo?: boolean): number[] {
  return [
    P([0, 1, 1, 2, 2, 2, 3, 4]),
    P([0, 0, 0, 1, 1, 2, 3, 4]),
    R(0, 7),
    yo || R(0, 9) < 6 ? 0 : R(1, 3),
    R(0, 3),
    pos === 'GK' ? 1 : 10,
    R(0, 2)
  ];
}

export function visOf(q: Partial<Player>, careerP?: PlayerCareerProfile | null): number[] {
  if (q.me && careerP) {
    const ki = SKIN_P.indexOf(careerP.k);
    const hi = HAIR_P.indexOf(careerP.h);
    const no = q.no || careerP.no || 10;
    return [ki >= 0 ? ki : 2, hi >= 0 ? hi : 0, careerP.hs ?? 0, careerP.fh ?? 0, careerP.ey ?? 0, no, careerP.fs ?? 0];
  }
  if (Array.isArray(q.vis) && q.vis.length >= 5) {
    const v = q.vis;
    const no = q.no || v[5] || 10;
    return [v[0], v[1], v[2], v[3], v[4], no, v.length >= 7 ? v[6] : (v[0] + v[1] + v[2] + no) % 3];
  }
  const s = q.n || 'นักเตะ';
  const h = [...s].reduce((a, c, i) => ((a * 33) ^ (c.charCodeAt(0) * (i + 1))) >>> 0, 5381);
  const no = q.no || (q.pos === 'GK' ? [1, 13, 22, 25, 30][h % 5] : 2 + (h % 98));
  return [
    h % 5,
    (h >> 3) % 5,
    (h >> 6) % 8,
    (q.age && q.age < 19) || ((h >> 9) % 10 < 6) ? 0 : 1 + ((h >> 11) % 3),
    (h >> 13) % 4,
    no,
    (h >> 16) % 3
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
  let count = rRoll < 0.28 ? 2 : rRoll < 0.84 ? 3 : 4;
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

export function mkPlayer(pos: Position, baseOv: number, yo?: boolean, forceRo?: SubRole): Player {
  const age = yo ? R(16, 18) : R(17, 34);
  const ov = yo ? clamp(baseOv + R(-6, 4), 20, 82) : clamp(baseOv + R(-9, 9), 25, 92);
  const talent = yo
    ? clamp(Math.round(48 + (ov - 45) * 0.45 + R(8, 36)), 40, 96)
    : clamp(Math.round(38 + (ov - 50) * 0.55 + R(-10, 30)), 28, 95);
  const potBoost = talent >= 80 ? R(4, 10) : 0;
  const ro = forceRo || SPW(pos);
  return {
    n: genPlayerName(),
    pos,
    ro,
    sp: 0,
    ov,
    age,
    pot: clamp(ov + (age < 24 ? R(4, 25) + Math.round(potBoost * 0.5) : R(0, 3)), ov, 95),
    talent,
    traits: rollPlayerTraits(pos, ro, ov, talent),
    fit: 100,
    inj: 0,
    vis: rndVis(pos, yo)
  };
}

export function mkTeam(name: string, tier: number, id: number, diff = R(-7, 7)): Team {
  const kp = KIT_P[(id + tier * 5) % KIT_P.length];
  const hasSpace = name.includes(' ');
  const sx = hasSpace ? '' : P(SFX0[tier] || ['']);
  const team: Team = {
    id,
    name: name + (sx ? ' ' + sx : ''),
    tier,
    kc: [kp[0], kp[1]],
    sq: (
      [
        ['GK', 3],
        ['DF', 8],
        ['MF', 7],
        ['FW', 5]
      ] as [Position, number][]
    ).flatMap(([p, c]) => Array.from({ length: c }, () => mkPlayer(p, BASE[tier] + diff + R(-4, 4)))),
    form: '4-4-2',
    tac: 'B',
    press: 1,
    tempo: 1,
    wid: 1,
    line: 1,
    pass: 1,
    pts: 0,
    gf: 0,
    ga: 0,
    w: 0,
    d: 0,
    l: 0,
    p: 0,
    fm: '',
    tacFam: 65
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
      if (f >= 82) return 1;
      if (f >= 72) return 0.92 + ((f - 72) / 10) * 0.08;
      if (f >= 58) return 0.76 + ((f - 58) / 14) * 0.16;
      return Math.max(0.54, 0.58 + (f - 30) * 0.0064);
    };
    POS.forEach((p) => {
      const ix = sl.map((z, i) => (z.pos === p ? i : -1)).filter((i) => i >= 0);
      const pr: [number, Player, number][] = [];
      t.sq
        .filter((q) => q.pos === p)
        .forEach((q) => ix.forEach((i) => pr.push([ef(q) * rotationReadiness(q) * PM[pen(q.ro, sl[i].sp)], q, i])));
      pr.sort((a, b) => b[0] - a[0]);
      const uq = new Set<Player>();
      const ui = new Set<number>();
      pr.forEach(([, q, i]) => {
        if (uq.has(q) || ui.has(i)) return;
        uq.add(q);
        ui.add(i);
        o[i] = q;
      });
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

  const d: Record<string, number> = {
    pw: cl(baseA.sh * 0.6 + baseA.ph * 0.4 + hv(1)),
    fin: cl(baseA.sh + hv(2) + (q.pos === 'FW' ? 4 : 0) + (q.ro === 'ST' ? 2 : 0)),
    cur: cl(baseA.sh * 0.5 + baseA.ps * 0.5 + hv(3) + (q.ro === 'CAM' || q.ro === 'CF' ? 2 : 0)),
    fk: cl(baseA.sh * 0.4 + baseA.ps * 0.45 + baseA.dr * 0.15 + hv(20) + (q.pos === 'MF' ? 3 : 0)),
    crs: cl(baseA.ps * 0.7 + baseA.dr * 0.3 + hv(4) + (wing ? 6 : 0) + (q.ro === 'CF' ? 4 : 0)),
    run: cl(baseA.sh * 0.5 + baseA.dr * 0.3 + baseA.ph * 0.2 + hv(5) + (q.ro === 'ST' || q.ro === 'LW' || q.ro === 'RW' ? 3 : 0)),
    rd: cl(baseA.tk * 0.6 + baseA.ps * 0.4 + hv(6)),
    pos: cl(baseA.tk * 0.7 + baseA.ps * 0.2 + baseA.ph * 0.1 + hv(7)),
    mrk: cl(baseA.tk * 0.65 + baseA.ph * 0.2 + baseA.ps * 0.15 + hv(18) + (q.pos === 'DF' ? 4 : 0)),
    blk: cl(baseA.tk * 0.55 + baseA.ph * 0.35 + baseA.ps * 0.1 + hv(19) + (q.ro === 'CB' ? 4 : 0)),
    hd: cl(baseA.ph * 0.7 + baseA.tk * 0.3 + hv(8)),
    spd: cl(baseA.dr * 0.5 + baseA.ph * 0.5 + hv(9) - Math.max(0, ag - 31) * 2),
    str: cl(baseA.ph + hv(10)),
    sta: cl(baseA.ph * 0.8 + hv(11) + (ag < 30 ? 3 : -3)),
    tol: cl(55 + baseA.ph * 0.3 + hv(12)),
    rec: cl(82 - Math.max(0, ag - 24) * 2 + hv(0)),
    comp: cl(q.ov * 0.7 + 22 + hv(14)),
    sv: cl(q.ov * 0.7 + baseA.ph * 0.3 + hv(15)),
    cl: cl(q.ov * 0.85 + hv(16)),
    dist: cl(baseA.ps * 0.8 + hv(17))
  };

  const sk = q.pos === 'GK' ? ['sv', 'cl', 'dist', 'sta', 'comp'] : ['fin', 'pw', 'cur', 'fk', 'run', 'crs', 'rd', 'pos', 'mrk', 'blk', 'hd', 'spd', 'str', 'sta', 'comp'];
  const sig = po?.sig
    ? po.sig
    : q.customSig
      ? q.customSig
      : po?.tr
        ? q.pos === 'GK'
          ? { sh: 'cl', ps: 'dist', dr: 'cl', tk: 'sv', ph: 'sv' }[po.tr] || 'sv'
          : { sh: 'fin', ps: 'crs', dr: 'spd', tk: 'pos', ph: 'str' }[po.tr] || sk[h % sk.length]
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
  return { a: baseA, h, d, sig, tr: h % 4, pk: 26 + ((h >> 2) % 4) };
}

export function dtInfo(q: Player, careerP?: PlayerCareerProfile | null) {
  const D0 = DT(q, careerP);
  const a = D0.a;
  const f = Math.round(q.fit ?? 100);
  const d = D0.d;
  const gk = q.pos === 'GK';
  const tlVal = clamp(
    Math.round(
      (q.me && careerP?.talent != null ? careerP.talent : q.talent) ??
        clamp(Math.round(40 + ((q.pot || q.ov) - 55) * 0.5 + ((D0.h % 25) - 10)), 30, 92)
    ),
    25,
    99
  );
  const G: [string, [string, number, string?][]][] = [
    ...((gk
      ? [['🧤 ผู้รักษาประตู', [['เซฟ', d.sv, 'sv'], ['ออกมาปิดมุม', d.cl, 'cl'], ['จ่ายจากแนวหลัง', d.dist, 'dist']]]]
      : [
          ['⚔️ โจมตี', [['พลังยิง', d.pw, 'pw'], ['จบสกอร์', d.fin, 'fin'], ['ยิงโค้ง', d.cur, 'cur'], ['ลูกตั้งเตะ', d.fk, 'fk'], ['เปิดบอล', d.crs, 'crs'], ['เข้าทำตำแหน่ง', d.run, 'run']]],
          ['🛡️ ป้องกัน', [['อ่านเกม', d.rd, 'rd'], ['สกัด/ยืนตำแหน่ง', d.pos, 'pos'], ['ประกบตัว', d.mrk, 'mrk'], ['บล็อกลูกยิง', d.blk, 'blk'], ['โหม่ง', d.hd, 'hd']]]
        ]) as [string, [string, number, string?][]][]),
    ['💪 ร่างกาย', [['ความเร็ว', d.spd, 'spd'], ['ความแข็งแรง', d.str, 'str'], ['ความอึด', d.sta, 'sta']]],
    ['❤️ ความฟิต', [['ฟิตปัจจุบัน', f], ['ทนต่อบาดเจ็บ', d.tol, 'tol'], ['ฟื้นตัวเร็ว', d.rec, 'rec']]],
    ['🌟 พรสวรรค์', [['ค่าพรสวรรค์', tlVal], ['ศักยภาพสูงสุด', q.pot || q.ov], ['นิ่งในนัดใหญ่', d.comp, 'comp']]]
  ];
  const allD = G.flatMap((g) => g[1]).filter((z) => !['ฟิตปัจจุบัน', 'ศักยภาพสูงสุด', 'ค่าพรสวรรค์'].includes(z[0]));
  const sg = allD.find((z) => z[2] === D0.sig) || allD.find((z) => z[0] === SIGL[D0.sig]);
  const ot = allD.filter((z) => z !== sg).sort((u, w) => w[1] - u[1])[0];
  const top = [sg, ot].filter((z): z is [string, number, string?] => Boolean(z));
  const TR = [
    ['👑 ผู้นำ', 'ช่วยเพิ่มโบนัสเล็กน้อยให้ทีมเมื่อลงตัวจริง'],
    ['😤 สายเกเร', 'โดนใบเหลือง/แดงบ่อยกว่าปกติ'],
    ['🏃 ขยัน', 'ฟิตลดช้าลงและพัฒนาไวขึ้นเล็กน้อย'],
    ['😐 ปกติ', 'ไม่มีลักษณะนิสัยพิเศษ']
  ][D0.tr];
  const ag = q.age || 24;
  const gro = ag < D0.pk - 2 ? 'กำลังเติบโต' : ag <= D0.pk + 4 ? 'ช่วงพีค' : 'เริ่มถดถอย';
  const stCls = (q.sus || 0) > 0 || q.inj > 0 ? 'bad' : f < 60 ? 'wrn' : 'ok';
  const traits = getPlayerTraits(q, careerP);
  const stTxt =
    (q.sus || 0) > 0
      ? `🟥 โดนแบน ${q.sus} นัด`
      : q.inj > 0
        ? `🩹 บาดเจ็บ ${q.inj} นัด`
        : f < 60
          ? `⚠️ เหนื่อยล้า (${f}%)`
          : `✅ พร้อมลง (${f}%)`;
  return { D0, a, f, d, gk, G, top, TR, traits, ag, gro, stCls, stTxt };
}

export function injD(q: Player, n: number, careerP?: PlayerCareerProfile | null): number {
  const r = DT(q, careerP).d.rec;
  return Math.max(1, n + (r >= 80 ? -1 : r < 55 ? 1 : 0));
}

export const ovMe = (p: PlayerCareerProfile) => OVF(p.pos, p.a);

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
    const k = av.length ? P(av) : ATT.map((z) => z[0]).find((z) => p.a[z] < 99);
    if (!k) break;
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
  }
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
  s.finLog = s.finLog || [];
  s.finLog.unshift({ t, amt: Math.round(amt), m: s.md + 1, s: s.season });
  if (s.finLog.length > 40) s.finLog.length = 40;
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
      kit: (h >> 3) % KIT_PATTERNS.length
    };
  }
  return s.club;
}
