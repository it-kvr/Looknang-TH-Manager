import type { Position, SubRole, Mentality, CoreAttrs, CupCompKey, PlayerCupStatRecord, Player, PlayerMissionsState, PlayerSeasonHistoryRecord, CustomSlot, Team, TeamSeasonHistoryRecord, TrophyRecord, GameState, ClubIdentity, PlayerCareerProfile } from '../types/game';
import { ALL_SUB_ROLES } from '../data/thaiFootballData';
import { ensureAiTeamPhilosophies, assignTeamShirtNumbers, OVF } from './playerCore';

export const SAVE_B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const SAVE_POS: Position[] = ['GK', 'DF', 'MF', 'FW'];
export const SAVE_CON_ROLE: ('key' | 'rot' | 'pro')[] = ['key', 'rot', 'pro'];
export const SAVE_CUP_KEYS: CupCompKey[] = ['cup', 'lc', 'dc', 'sc', 'asia'];

export const packSavePlayer = (q: Player): unknown[] => {
  const posVal = SAVE_POS.indexOf(q.pos);
  const roVal = ALL_SUB_ROLES.indexOf(q.ro);
  const ex: Record<string, unknown> = {};
  if (q.id !== undefined) ex.id = q.id;
  if (q.no) ex.no = q.no;
  if (q.sp) ex.sp = q.sp;
  if (q.sg) ex.sg = q.sg;
  if (q.sa) ex.sa = q.sa;
  if (q.cs) ex.cs = q.cs;
  if (q.sus) ex.su = q.sus;
  if (q.yc) ex.yc = q.yc;
  if (q.rc) ex.rc = q.rc;
  if (q.me) ex.me = q.me;
  if (q.vis) ex.v = q.vis;
  if (q.con) ex.c = [q.con.yr, q.con.wg, Math.max(0, SAVE_CON_ROLE.indexOf(q.con.role))];
  if (q.loan) ex.ln = q.loan;
  if (q.loanOpt) ex.lo = q.loanOpt;
  if (q.price !== undefined) ex.pr = q.price;
  if (q.free) ex.fr = q.free;
  if (q.askWg !== undefined) ex.aw = q.askWg;
  if (q.tries) ex.tr = q.tries;
  if (q.locked) ex.lk = q.locked;
  if (q.ap) ex.ap = q.ap;
  if (q.g) ex.g = q.g;
  if (q.scouted) ex.sc = 1;
  if (q.formStreak) ex.fs = q.formStreak;
  if (q.listed) ex.ls = q.listed;
  if (q.askPrice !== undefined) ex.ak = q.askPrice;
  if (q.offerCoolMd !== undefined) ex.oc = q.offerCoolMd;
  if (q.signedSeason !== undefined) ex.ss = q.signedSeason;
  if (q.signedMd !== undefined) ex.sm = q.signedMd;
  if (q.treatedMd !== undefined) ex.tm = q.treatedMd;
  if (q.customA) ex.ca = q.customA;
  if (q.customD) ex.cd = q.customD;
  if (q.customSig) ex.csg = q.customSig;
  if (q.blessed) ex.bl = 1;
  if (q.hg) ex.hg = 1;
  if (q.customCreated) ex.cc = 1;
  if (q.sb && Object.keys(q.sb).length) ex.sb = q.sb;
  if (q.coreSb && Object.keys(q.coreSb).length) ex.cb = q.coreSb;
  if (q.missions) ex.ms = q.missions;
  if (q.srs) ex.srs = Math.round(q.srs * 10) / 10;
  if (q.sra) ex.sra = q.sra;
  if (q.motm) ex.mt = q.motm;
  if (q.tyc) ex.tyc = q.tyc;
  if (q.cupStats) {
    const packedCst: Record<string, number[]> = {};
    SAVE_CUP_KEYS.forEach((ck) => {
      const rec = q.cupStats?.[ck];
      if (!rec) return;
      if (rec.sp || rec.sg || rec.sa || rec.cs || rec.sra || rec.motm || rec.yc || rec.rc) {
        packedCst[ck] = [
          rec.sp || 0,
          rec.sg || 0,
          rec.sa || 0,
          rec.cs || 0,
          Math.round((rec.srs || 0) * 10) / 10,
          rec.sra || 0,
          rec.motm || 0,
          rec.yc || 0,
          rec.rc || 0
        ];
      }
    });
    if (Object.keys(packedCst).length) ex.cst = packedCst;
  }
  if (q.talent !== undefined) ex.tl = q.talent;
  if (q.traits && q.traits.length) ex.ts = q.traits;
  if (q.altRoles && q.altRoles.length) ex.ar = q.altRoles;
  if (q.roleExp && Object.keys(q.roleExp).length) ex.re = q.roleExp;
  if (q.customPers !== undefined) ex.cp = q.customPers;
  if (q.history && q.history.length) {
    ex.hi = q.history.map((h) => {
      const hasCupHist = Boolean(h.cupSp || h.cupSg || h.cupSa || h.cupCs || h.cupMotm || h.cupAvgRating);
      const row: unknown[] = [
        h.season,
        h.teamId,
        h.teamName,
        h.tier,
        h.ov,
        h.sp,
        h.sg,
        h.sa,
        h.cs,
        h.motm,
        h.yc,
        h.rc,
        h.avgRating
      ];
      if (hasCupHist) {
        row.push(h.honor || '');
        row.push([h.cupSp || 0, h.cupSg || 0, h.cupSa || 0, h.cupCs || 0, h.cupMotm || 0, h.cupAvgRating || 0]);
      } else if (h.honor) {
        row.push(h.honor);
      }
      return row;
    });
  }
  if (q.careerLog && q.careerLog.length) ex.cl = q.careerLog;
  if (q.seasonProg && q.seasonProg.pts.length) {
    ex.spg = [
      q.seasonProg.s,
      q.seasonProg.pts.map((pt) => [pt.md, pt.ov, pt.a.sh, pt.a.ps, pt.a.dr, pt.a.tk, pt.a.ph])
    ];
  }

  const base: unknown[] = [
    q.n,
    posVal >= 0 ? posVal : q.pos,
    roVal >= 0 ? roVal : q.ro,
    q.ov,
    q.age,
    q.pot,
    Math.round((q.fit ?? 100) * 100) / 100,
    q.inj || 0
  ];
  if (Object.keys(ex).length) base.push(ex);
  return base;
};

export const unpackSavePlayer = (raw: unknown): Player => {
  if (!Array.isArray(raw)) return raw as Player;
  const [n, pv, rv, ov, age, pot, fit, inj, exRaw] = raw;
  const ex = (exRaw && typeof exRaw === 'object' ? exRaw : {}) as Record<string, unknown>;
  const pos: Position = typeof pv === 'number' ? SAVE_POS[pv] || 'MF' : (pv as Position);
  const ro: SubRole = typeof rv === 'number' ? ALL_SUB_ROLES[rv] || 'CM' : (rv as SubRole);
  const p: Player = {
    n: String(n || ''),
    pos,
    ro,
    ov: Number(ov || 60),
    age: Number(age || 24),
    pot: Number(pot || ov || 65),
    fit: Number(fit ?? 100),
    inj: Number(inj || 0)
  };
  if (ex.id !== undefined) p.id = String(ex.id);
  if (ex.no !== undefined) p.no = Number(ex.no);
  if (ex.sp !== undefined) p.sp = Number(ex.sp);
  if (ex.sg !== undefined) p.sg = Number(ex.sg);
  if (ex.sa !== undefined) p.sa = Number(ex.sa);
  if (ex.cs !== undefined) p.cs = Number(ex.cs);
  if (ex.su !== undefined) p.sus = Number(ex.su);
  if (ex.yc !== undefined) p.yc = Number(ex.yc);
  if (ex.rc !== undefined) p.rc = Number(ex.rc);
  if (ex.me !== undefined) p.me = Number(ex.me);
  if (Array.isArray(ex.v)) p.vis = ex.v as number[];
  if (Array.isArray(ex.c)) {
    p.con = {
      yr: Number(ex.c[0] || 1),
      wg: Number(ex.c[1] || 1),
      role: SAVE_CON_ROLE[Number(ex.c[2] || 1)] || 'rot'
    };
  }
  if (ex.ln !== undefined) p.loan = Number(ex.ln);
  if (ex.lo !== undefined) p.loanOpt = Number(ex.lo);
  if (ex.pr !== undefined) p.price = Number(ex.pr);
  if (ex.fr !== undefined) p.free = Number(ex.fr);
  if (ex.aw !== undefined) p.askWg = Number(ex.aw);
  if (ex.tr !== undefined) p.tries = Number(ex.tr);
  if (ex.lk !== undefined) p.locked = Number(ex.lk);
  if (ex.ap !== undefined) p.ap = Number(ex.ap);
  if (ex.g !== undefined) p.g = Number(ex.g);
  if (ex.sc) p.scouted = true;
  if (ex.fs !== undefined) p.formStreak = Number(ex.fs);
  if (ex.ls !== undefined) p.listed = Number(ex.ls);
  if (ex.ak !== undefined) p.askPrice = Number(ex.ak);
  if (ex.oc !== undefined) p.offerCoolMd = Number(ex.oc);
  if (ex.ss !== undefined) p.signedSeason = Number(ex.ss);
  if (ex.sm !== undefined) p.signedMd = Number(ex.sm);
  if (ex.tm !== undefined) p.treatedMd = Number(ex.tm);
  if (ex.ca) p.customA = ex.ca as CoreAttrs;
  if (ex.cd) p.customD = ex.cd as Record<string, number>;
  if (ex.csg) p.customSig = String(ex.csg);
  if (ex.bl) p.blessed = true;
  if (ex.hg) p.hg = 1;
  if (ex.cc) p.customCreated = 1;
  if (ex.sb) p.sb = ex.sb as Record<string, number>;
  if (ex.cb) p.coreSb = ex.cb as Partial<CoreAttrs>;
  if (ex.ms) p.missions = ex.ms as PlayerMissionsState;
  if (ex.srs !== undefined) p.srs = Number(ex.srs);
  if (ex.sra !== undefined) p.sra = Number(ex.sra);
  if (ex.mt !== undefined) p.motm = Number(ex.mt);
  if (ex.tyc !== undefined) p.tyc = Number(ex.tyc);
  if (ex.cst && typeof ex.cst === 'object') {
    const rawCst = ex.cst as Record<string, unknown>;
    const unpacked: Partial<Record<CupCompKey, PlayerCupStatRecord>> = {};
    SAVE_CUP_KEYS.forEach((ck) => {
      const entry = rawCst[ck];
      if (Array.isArray(entry)) {
        unpacked[ck] = {
          sp: Number(entry[0] || 0),
          sg: Number(entry[1] || 0),
          sa: Number(entry[2] || 0),
          cs: Number(entry[3] || 0),
          srs: Number(entry[4] || 0),
          sra: Number(entry[5] || 0),
          motm: Number(entry[6] || 0),
          ...(entry[7] ? { yc: Number(entry[7]) } : {}),
          ...(entry[8] ? { rc: Number(entry[8]) } : {})
        };
      } else if (entry && typeof entry === 'object') {
        const obj = entry as Partial<PlayerCupStatRecord>;
        unpacked[ck] = {
          sp: Number(obj.sp || 0),
          sg: Number(obj.sg || 0),
          sa: Number(obj.sa || 0),
          cs: Number(obj.cs || 0),
          srs: Number(obj.srs || 0),
          sra: Number(obj.sra || 0),
          motm: Number(obj.motm || 0),
          ...(obj.yc ? { yc: Number(obj.yc) } : {}),
          ...(obj.rc ? { rc: Number(obj.rc) } : {})
        };
      }
    });
    if (Object.keys(unpacked).length) p.cupStats = unpacked;
  }
  if (ex.tl !== undefined) p.talent = Number(ex.tl);
  if (Array.isArray(ex.ts)) p.traits = ex.ts.map((x) => String(x));
  if (Array.isArray(ex.ar)) p.altRoles = ex.ar.map((x) => String(x) as SubRole);
  if (ex.re && typeof ex.re === 'object') p.roleExp = ex.re as Record<string, number>;
  if (ex.cp !== undefined) p.customPers = Number(ex.cp);
  if (Array.isArray(ex.hi)) {
    p.history = (ex.hi as unknown[]).map((item): PlayerSeasonHistoryRecord => {
      if (!Array.isArray(item)) return item as PlayerSeasonHistoryRecord;
      const cupArr = Array.isArray(item[14]) ? (item[14] as unknown[]) : null;
      return {
        season: Number(item[0] || 1),
        teamId: Number(item[1] ?? -1),
        teamName: String(item[2] || ''),
        tier: Number(item[3] || 0),
        ov: Number(item[4] || 60),
        sp: Number(item[5] || 0),
        sg: Number(item[6] || 0),
        sa: Number(item[7] || 0),
        cs: Number(item[8] || 0),
        motm: Number(item[9] || 0),
        yc: Number(item[10] || 0),
        rc: Number(item[11] || 0),
        avgRating: Number(item[12] || 0),
        ...(item[13] ? { honor: String(item[13]) } : {}),
        ...(cupArr
          ? {
              cupSp: Number(cupArr[0] || 0),
              cupSg: Number(cupArr[1] || 0),
              cupSa: Number(cupArr[2] || 0),
              cupCs: Number(cupArr[3] || 0),
              cupMotm: Number(cupArr[4] || 0),
              cupAvgRating: Number(cupArr[5] || 0)
            }
          : {})
      };
    });
  }
  if (Array.isArray(ex.cl)) p.careerLog = ex.cl.map((x) => String(x));
  if (Array.isArray(ex.spg) && Array.isArray(ex.spg[1])) {
    p.seasonProg = {
      s: Number(ex.spg[0] || 1),
      pts: (ex.spg[1] as unknown[]).map((row) => {
        const r = Array.isArray(row) ? row : [];
        return {
          md: Number(r[0] || 0),
          ov: Number(r[1] || p.ov),
          a: {
            sh: Number(r[2] || 50),
            ps: Number(r[3] || 50),
            dr: Number(r[4] || 50),
            tk: Number(r[5] || 50),
            ph: Number(r[6] || 50)
          }
        };
      })
    };
  }
  return p;
};

export const packSaveTeam = (t: Team): unknown[] => {
  const tex: Record<string, unknown> = {};
  if (t.cf !== undefined) tex.cf = t.cf;
  if (t.lu !== undefined) tex.lu = t.lu;
  if (t.cap !== undefined) tex.cap = t.cap;
  if (t.press !== undefined) tex.pr = t.press;
  if (t.tempo !== undefined) tex.tp = t.tempo;
  if (t.wid !== undefined) tex.wd = t.wid;
  if (t.line !== undefined) tex.ln = t.line;
  if (t.pass !== undefined) tex.ps = t.pass;
  if (t.fm) tex.fm = t.fm;
  if (t.foreign !== undefined) tex.fg = t.foreign;
  if (t.tacFam !== undefined) tex.tf = t.tacFam;
  if (t.philosophy) tex.ph = t.philosophy;
  if (t.tacticTrialMd !== undefined) tex.ttm = t.tacticTrialMd;
  if (t.tacticTrialLabel) tex.ttl = t.tacticTrialLabel;
  if (t.history && t.history.length) {
    tex.hi = t.history.map((h) => {
      const flags = (h.champion ? 1 : 0) | (h.cupChampion ? 2 : 0) | (h.asiaChampion ? 4 : 0);
      return [
        h.season,
        h.tier,
        h.nextTier,
        h.rank,
        h.totalTeams,
        h.played,
        h.won,
        h.drawn,
        h.lost,
        h.gf,
        h.ga,
        h.pts,
        flags,
        h.cupStatus || '',
        h.asiaStatus || '',
        h.topScorer || ''
      ];
    });
  }
  if (t.trophies && t.trophies.length) tex.tr = t.trophies;
  if (t.fans != null) tex.fn = t.fans;
  const arr: unknown[] = [
    t.id, t.name, t.tier, t.kc, t.sq.map(packSavePlayer),
    t.form, t.tac, t.pts, t.gf, t.ga, t.w, t.d, t.l, t.p
  ];
  if (Object.keys(tex).length) arr.push(tex);
  return arr;
};

export const unpackSaveTeam = (raw: unknown): Team => {
  if (!Array.isArray(raw)) return raw as Team;
  const [id, name, tier, kc, sq, form, tac, pts, gf, ga, w, d, l, p, texRaw] = raw;
  const tex = (texRaw && typeof texRaw === 'object' ? texRaw : {}) as Record<string, unknown>;
  const tm: Team = {
    id: Number(id),
    name: String(name || ''),
    tier: Number(tier || 0),
    kc: (Array.isArray(kc) ? kc : ['#c0392b', '#ffffff']) as [string, string],
    sq: Array.isArray(sq) ? sq.map(unpackSavePlayer) : [],
    form: String(form || '4-4-2'),
    tac: (tac as Mentality) || 'B',
    pts: Number(pts || 0),
    gf: Number(gf || 0),
    ga: Number(ga || 0),
    w: Number(w || 0),
    d: Number(d || 0),
    l: Number(l || 0),
    p: Number(p || 0)
  };
  if (tex.cf !== undefined) tm.cf = tex.cf as CustomSlot[];
  if (tex.lu !== undefined) tm.lu = tex.lu as string[] | null;
  if (tex.cap !== undefined) tm.cap = String(tex.cap);
  if (tex.pr !== undefined) tm.press = Number(tex.pr);
  if (tex.tp !== undefined) tm.tempo = Number(tex.tp);
  if (tex.wd !== undefined) tm.wid = Number(tex.wd);
  if (tex.ln !== undefined) tm.line = Number(tex.ln);
  if (tex.ps !== undefined) tm.pass = Number(tex.ps);
  if (tex.fm !== undefined) tm.fm = String(tex.fm);
  if (tex.fg !== undefined) tm.foreign = Number(tex.fg);
  if (tex.tf !== undefined) tm.tacFam = Number(tex.tf);
  if (tex.ph !== undefined) tm.philosophy = String(tex.ph);
  if (tex.ttm !== undefined) tm.tacticTrialMd = Number(tex.ttm);
  if (tex.ttl !== undefined) tm.tacticTrialLabel = String(tex.ttl);
  if (Array.isArray(tex.hi)) {
    tm.history = (tex.hi as unknown[]).map((item): TeamSeasonHistoryRecord => {
      if (!Array.isArray(item)) return item as TeamSeasonHistoryRecord;
      const flags = Number(item[12] || 0);
      return {
        season: Number(item[0] || 1),
        tier: Number(item[1] || 0),
        nextTier: Number(item[2] || 0),
        rank: Number(item[3] || 1),
        totalTeams: Number(item[4] || 16),
        played: Number(item[5] || 0),
        won: Number(item[6] || 0),
        drawn: Number(item[7] || 0),
        lost: Number(item[8] || 0),
        gf: Number(item[9] || 0),
        ga: Number(item[10] || 0),
        pts: Number(item[11] || 0),
        champion: !!(flags & 1),
        cupChampion: !!(flags & 2),
        asiaChampion: !!(flags & 4),
        ...(item[13] ? { cupStatus: String(item[13]) } : {}),
        ...(item[14] ? { asiaStatus: String(item[14]) } : {}),
        ...(item[15] ? { topScorer: String(item[15]) } : {})
      };
    });
  }
  if (Array.isArray(tex.tr)) tm.trophies = tex.tr as TrophyRecord[];
  if (tex.fn !== undefined) tm.fans = Number(tex.fn);
  return tm;
};

export const packFixturesCompact = (rounds: [number, number][][]): unknown => {
  const canCompact = rounds.every((rd) =>
    rd.every(([h, a]) => h >= 0 && h < 64 && a >= 0 && a < 64)
  );
  if (!canCompact) return rounds;
  return 'F:' + rounds.map((rd) => rd.map(([h, a]) => SAVE_B64U[h] + SAVE_B64U[a]).join('')).join('|');
};

export const unpackFixturesCompact = (raw: unknown): [number, number][][] => {
  if (typeof raw === 'string' && raw.startsWith('F:')) {
    const body = raw.slice(2);
    if (!body) return [];
    return body.split('|').map((seg) => {
      const pairs: [number, number][] = [];
      for (let i = 0; i + 1 < seg.length; i += 2) {
        const h = SAVE_B64U.indexOf(seg[i]);
        const a = SAVE_B64U.indexOf(seg[i + 1]);
        if (h >= 0 && a >= 0) pairs.push([h, a]);
      }
      return pairs;
    });
  }
  return Array.isArray(raw) ? (raw as [number, number][][]) : [];
};

export const packSaveState = (s: GameState): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...s, _lk: 2 };
  out.teams = s.teams.map(packSaveTeam);
  out.mk = (s.mk || []).map(packSavePlayer);
  out.yth = (s.yth || []).map(packSavePlayer);
  out.fx = packFixturesCompact(s.fx || []);
  if (s.fxo) {
    out.fxo = Object.fromEntries(Object.entries(s.fxo).map(([k, v]) => [k, packFixturesCompact(v)]));
  }
  return out;
};

export const unpackSaveState = (raw: Record<string, unknown>): GameState => {
  if (raw._lk !== 2) return raw as unknown as GameState;
  const copy: Record<string, unknown> = { ...raw };
  delete copy._lk;
  copy.teams = Array.isArray(raw.teams) ? raw.teams.map(unpackSaveTeam) : [];
  copy.mk = Array.isArray(raw.mk) ? raw.mk.map(unpackSavePlayer) : [];
  copy.yth = Array.isArray(raw.yth) ? raw.yth.map(unpackSavePlayer) : [];
  copy.fx = unpackFixturesCompact(raw.fx);
  if (raw.fxo && typeof raw.fxo === 'object') {
    copy.fxo = Object.fromEntries(
      Object.entries(raw.fxo as Record<string, unknown>).map(([k, v]) => [k, unpackFixturesCompact(v)])
    );
  }
  const result = copy as unknown as GameState;
  if (Array.isArray(result.teams)) ensureAiTeamPhilosophies(result, false);
  return result;
};

export const strToCompactBytes = (str: string): Uint8Array => {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x7f) {
      out.push(c);
    } else if (c >= 0x0e00 && c <= 0x0e7f) {
      out.push(0x80 | (c - 0x0e00));
    } else {
      out.push(0x7f, (c >> 8) & 0xff, c & 0xff);
    }
  }
  return new Uint8Array(out);
};

export const compactBytesToStr = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  let chunk: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x7f) {
      chunk.push(b);
    } else if (b === 0x7f) {
      if (i + 2 >= bytes.length) break;
      chunk.push((bytes[i + 1] << 8) | bytes[i + 2]);
      i += 2;
    } else {
      chunk.push(0x0e00 + (b - 0x80));
    }
    if (chunk.length >= 4096) {
      parts.push(String.fromCharCode(...chunk));
      chunk = [];
    }
  }
  if (chunk.length) parts.push(String.fromCharCode(...chunk));
  return parts.join('');
};

export const lzssCompress = (input: Uint8Array): Uint8Array => {
  const n = input.length;
  const WIN = 4096;
  const MASK = WIN - 1;
  const HASH_SIZE = 32768;
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const prev = new Int32Array(WIN).fill(-1);
  const out: number[] = [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff
  ];

  const insertAt = (pos: number) => {
    if (pos + 2 >= n) return;
    const h = ((input[pos] << 10) ^ (input[pos + 1] << 5) ^ input[pos + 2]) & (HASH_SIZE - 1);
    prev[pos & MASK] = head[h];
    head[h] = pos;
  };

  let i = 0;
  while (i < n) {
    const flagPos = out.length;
    out.push(0);
    let flags = 0;
    for (let bit = 0; bit < 8 && i < n; bit++) {
      let bestLen = 0;
      let bestDist = 0;
      if (i + 2 < n) {
        const h = ((input[i] << 10) ^ (input[i + 1] << 5) ^ input[i + 2]) & (HASH_SIZE - 1);
        let cand = head[h];
        let steps = 0;
        const maxLen = Math.min(18, n - i);
        while (cand >= 0 && i - cand <= WIN && steps < 32) {
          steps++;
          if (
            input[cand] === input[i] &&
            input[cand + 1] === input[i + 1] &&
            input[cand + 2] === input[i + 2]
          ) {
            let l = 3;
            while (l < maxLen && input[cand + l] === input[i + l]) l++;
            if (l > bestLen) {
              bestLen = l;
              bestDist = i - cand;
              if (l === maxLen) break;
            }
          }
          const nxt = prev[cand & MASK];
          if (nxt >= cand) break;
          cand = nxt;
        }
      }
      if (bestLen >= 3) {
        const d1 = bestDist - 1;
        const l3 = bestLen - 3;
        out.push((d1 >> 4) & 0xff, ((d1 & 0x0f) << 4) | (l3 & 0x0f));
        flags |= 1 << bit;
        for (let k = 0; k < bestLen; k++) insertAt(i + k);
        i += bestLen;
      } else {
        out.push(input[i]);
        insertAt(i);
        i++;
      }
    }
    out[flagPos] = flags;
  }
  return new Uint8Array(out);
};

export const lzssDecompress = (buf: Uint8Array): Uint8Array => {
  if (buf.length < 4) throw new Error('Invalid compressed save');
  const origLen = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
  if (origLen <= 0 || origLen > 20_000_000) throw new Error('Invalid compressed size');
  const out = new Uint8Array(origLen);
  let p = 4;
  let outIdx = 0;
  while (p < buf.length && outIdx < origLen) {
    const flags = buf[p++];
    for (let bit = 0; bit < 8 && p < buf.length && outIdx < origLen; bit++) {
      if ((flags & (1 << bit)) === 0) {
        out[outIdx++] = buf[p++];
      } else {
        if (p + 1 >= buf.length) break;
        const hi = buf[p++];
        const lo = buf[p++];
        const dist = ((hi << 4) | (lo >> 4)) + 1;
        const len = (lo & 0x0f) + 3;
        const srcStart = outIdx - dist;
        if (srcStart < 0) throw new Error('Corrupt back-reference');
        for (let k = 0; k < len && outIdx < origLen; k++) {
          out[outIdx] = out[srcStart + k];
          outIdx++;
        }
      }
    }
  }
  return out.subarray(0, outIdx);
};

export const bytesToB64Url = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    parts.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length))));
  }
  return btoa(parts.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const b64UrlToBytes = (str: string): Uint8Array => {
  const norm = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = norm + '==='.slice((norm.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const isValidImportedState = (d: GameState | null | undefined): d is GameState =>
  Boolean(
    d &&
      Array.isArray(d.teams) &&
      Array.isArray(d.fx) &&
      ['m', 'p'].includes(d.mode) &&
      typeof d.me === 'number' &&
      d.me >= 0 &&
      d.me < d.teams.length &&
      Boolean(d.teams[d.me])
  );

const normalizeImportedSave = (d: GameState): GameState => {
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
  return d;
};

export const cleanImportJson = (raw: string): GameState | null => {
  const cleanRaw = raw.replace(/^\uFEFF/, '').trim();
  if (!cleanRaw) return null;

  if (cleanRaw.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleanRaw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && typeof parsed.code === 'string') {
        return cleanImportJson(parsed.code);
      }
      const d = parsed as unknown as GameState;
      if (isValidImportedState(d)) return normalizeImportedSave(d);
    } catch {
      return null;
    }
  }

  const trimmed = cleanRaw.replace(/\s+/g, (m) => (m.includes('\n') || m.includes('\r') ? '' : m));
  if (trimmed.startsWith('LK2:')) {
    try {
      const payload = trimmed.slice(4).replace(/\s+/g, '');
      const compressed = b64UrlToBytes(payload);
      const rawBytes = lzssDecompress(compressed);
      const jsonStr = compactBytesToStr(rawBytes);
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      const d = unpackSaveState(parsed);
      if (!isValidImportedState(d)) return null;
      return normalizeImportedSave(d);
    } catch {
      return null;
    }
  }
  try {
    const json = decodeURIComponent(escape(atob(cleanRaw)));
    const d = JSON.parse(json) as GameState;
    if (!isValidImportedState(d)) return null;
    return normalizeImportedSave(d);
  } catch {
    return null;
  }
};

export const exportSaveCode = (s: GameState): string => {
  try {
    const packed = packSaveState(s);
    const jsonStr = JSON.stringify(packed);
    const bytes = strToCompactBytes(jsonStr);
    const compressed = lzssCompress(bytes);
    return 'LK2:' + bytesToB64Url(compressed);
  } catch {
    return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  }
};

export const SAVE_FILE_FORMAT = 'LOOKNANG_TH_SAVE';

export interface SaveVisualPlayerPreview {
  n: string;
  pos: Position;
  ro: SubRole;
  ov: number;
  pot?: number;
  no?: number;
  me?: number;
  vis?: number[];
}

export interface SaveVisualTeamPreview {
  id: number;
  name: string;
  tier: number;
  kc: [string, string];
}

export interface SaveVisualPreview {
  teamName: string;
  tier: number;
  maxOvr: number;
  peakOvr?: number;
  squadAvg?: number;
  team?: SaveVisualTeamPreview | null;
  club?: ClubIdentity | null;
  player?: SaveVisualPlayerPreview | null;
  careerProfile?: Pick<
    PlayerCareerProfile,
    'name' | 'pos' | 'sp' | 'c' | 'k' | 'h' | 'hs' | 'fh' | 'fs' | 'ey' | 'acc' | 'no'
  > | null;
}

export const extractSaveVisualPreview = (s: GameState): SaveVisualPreview => {
  const meTeam = Array.isArray(s.teams) && typeof s.me === 'number' ? s.teams[s.me] || null : null;
  const teamStub: SaveVisualTeamPreview | null = meTeam
    ? {
        id: meTeam.id,
        name: meTeam.name,
        tier: meTeam.tier ?? 0,
        kc: Array.isArray(meTeam.kc) ? [meTeam.kc[0], meTeam.kc[1]] : ['#158049', '#ffffff']
      }
    : null;

  if (s.mode === 'm') {
    const teamName = s.club?.name || meTeam?.name || 'สโมสร';
    const sq = Array.isArray(meTeam?.sq) ? meTeam.sq : [];
    const sorted = sq.slice().sort((a, b) => (b.ov || 0) - (a.ov || 0));
    const top = sorted[0] || null;
    const maxOvr = top ? Number(top.ov || 0) : 0;
    const squadAvg = sq.length
      ? Math.round(sq.reduce((sum, q) => sum + Number(q.ov || 0), 0) / sq.length)
      : 0;
    return {
      teamName,
      tier: meTeam?.tier ?? 0,
      maxOvr,
      peakOvr: top?.pot ? Number(top.pot) : maxOvr,
      squadAvg,
      team: teamStub,
      club: s.club ? { ...s.club } : null,
      player: top
        ? {
            n: top.n,
            pos: top.pos,
            ro: top.ro,
            ov: Number(top.ov || 0),
            ...(top.pot ? { pot: Number(top.pot) } : {}),
            ...(top.no ? { no: Number(top.no) } : {}),
            ...(top.me ? { me: top.me } : {}),
            ...(Array.isArray(top.vis) ? { vis: top.vis.slice(0, 8) } : {})
          }
        : null,
      careerProfile: null
    };
  }

  const p = s.p;
  const mePl = meTeam?.sq?.find((q) => q.me) || null;
  const ov = mePl?.ov ? Number(mePl.ov) : p?.a ? OVF(p.pos, p.a) : 60;
  const histMax = Math.max(
    0,
    ...(mePl?.history || []).map((h) => Number(h.ov || 0)),
    ...(p?.history || []).map((h) => Number(h.ov || 0))
  );
  const peakOvr = Math.max(ov, Number(mePl?.pot || 0), Number(p?.talent || 0), histMax);
  const teamName = meTeam?.name || 'ไร้สังกัด / ทีมชาติ';

  return {
    teamName,
    tier: meTeam?.tier ?? 0,
    maxOvr: Math.max(ov, histMax),
    peakOvr,
    team: teamStub,
    club: null,
    player: mePl
      ? {
          n: mePl.n || p?.name || 'นักเตะ',
          pos: mePl.pos || p?.pos || 'FW',
          ro: mePl.ro || p?.sp || 'ST',
          ov,
          pot: peakOvr,
          no: mePl.no ?? p?.no,
          me: 1,
          ...(Array.isArray(mePl.vis) ? { vis: mePl.vis.slice(0, 8) } : {})
        }
      : p
        ? {
            n: p.name,
            pos: p.pos,
            ro: p.sp,
            ov,
            pot: peakOvr,
            no: p.no,
            me: 1
          }
        : null,
    careerProfile: p
      ? {
          name: p.name,
          pos: p.pos,
          sp: p.sp,
          c: p.c,
          k: p.k,
          h: p.h,
          hs: p.hs,
          fh: p.fh,
          fs: p.fs,
          ey: p.ey,
          ...(p.acc !== undefined ? { acc: p.acc } : {}),
          ...(p.no !== undefined ? { no: p.no } : {})
        }
      : null
  };
};

export interface SaveFileEnvelope {
  format: typeof SAVE_FILE_FORMAT;
  version: 2;
  exportedAt: string;
  mode: 'm' | 'p';
  name: string;
  season: number;
  md: number;
  label?: string;
  preview?: SaveVisualPreview;
  code: string;
}

export const buildSaveFileName = (s: GameState, customTag?: string, includeTime = false): string => {
  const rawName = s.mode === 'm' ? (s.club?.name || s.teams[s.me]?.name || 'club') : (s.p?.name || 'player');
  const sanitize = (v: string) =>
    v
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 28);
  const safeName = sanitize(rawName) || 'save';
  const safeTag = customTag ? `-${sanitize(customTag)}` : '';
  let timeSuffix = '';
  if (includeTime) {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    timeSuffix = `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
  const modeTag = s.mode === 'm' ? 'manager' : 'player';
  return `looknang-${modeTag}-${safeName}-s${s.season}-md${s.md}${safeTag}${timeSuffix}.json`;
};

export const buildSaveFilePayload = (s: GameState, label?: string): string => {
  const name = s.mode === 'm' ? (s.club?.name || s.teams[s.me]?.name || 'สโมสร') : (s.p?.name || 'นักเตะ');
  const envelope: SaveFileEnvelope = {
    format: SAVE_FILE_FORMAT,
    version: 2,
    exportedAt: new Date().toISOString(),
    mode: s.mode,
    name,
    season: s.season,
    md: s.md,
    ...(label?.trim() ? { label: label.trim() } : {}),
    preview: extractSaveVisualPreview(s),
    code: exportSaveCode(s)
  };
  return JSON.stringify(envelope, null, 2);
};

export interface SavePreviewMeta {
  mode: 'm' | 'p';
  name: string;
  season: number;
  md: number;
  exportedAt?: string;
  label?: string;
  preview?: SaveVisualPreview;
}

const isValidSaveVisualPreview = (v: unknown): v is SaveVisualPreview =>
  Boolean(v && typeof v === 'object' && typeof (v as SaveVisualPreview).maxOvr === 'number');

export const inspectSavePreview = (raw: string): SavePreviewMeta | null => {
  const cleanRaw = raw.replace(/^\uFEFF/, '').trim();
  if (!cleanRaw) return null;
  if (cleanRaw.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleanRaw) as Record<string, unknown>;
      if (
        parsed &&
        parsed.format === SAVE_FILE_FORMAT &&
        (parsed.mode === 'm' || parsed.mode === 'p') &&
        typeof parsed.code === 'string' &&
        typeof parsed.name === 'string'
      ) {
        let preview = isValidSaveVisualPreview(parsed.preview) ? parsed.preview : undefined;
        if (!preview) {
          try {
            const decoded = cleanImportJson(parsed.code);
            if (decoded) preview = extractSaveVisualPreview(decoded);
          } catch {
            // ignore decode fallback failure
          }
        }
        return {
          mode: parsed.mode,
          name: parsed.name,
          season: Number(parsed.season || 1),
          md: Number(parsed.md || 0),
          exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
          label: typeof parsed.label === 'string' ? parsed.label : undefined,
          ...(preview ? { preview } : {})
        };
      }
    } catch {
      // fallback below
    }
  }
  const state = cleanImportJson(cleanRaw);
  if (!state) return null;
  return {
    mode: state.mode,
    name: state.mode === 'm' ? (state.club?.name || state.teams[state.me]?.name || 'สโมสร') : (state.p?.name || 'นักเตะ'),
    season: state.season,
    md: state.md,
    preview: extractSaveVisualPreview(state)
  };
};

export const downloadSaveFile = (s: GameState, label?: string): { filename: string; bytes: number } => {
  const filename = buildSaveFileName(s, label);
  const payload = buildSaveFilePayload(s, label);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { filename, bytes: blob.size };
};

export const downloadRawSaveFile = (filename: string, rawText: string) => {
  const blob = new Blob([rawText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export const readSaveFileText = async (file: File): Promise<string> => {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('File read error'));
    reader.readAsText(file, 'utf-8');
  });
};
