import type { Position, SubRole, StatKey, GameMode, CoreAttrs, Player, Team, PlayerCareerProfile, MatchEvent, MatchCardEvent, MatchSubEvent, MatchDramaticEvent, MatchHighlightLine, MatchHighlightsSummary, PlayerPerfResult, MatchResult, TransferOffer, ScoutMission, GameState, DilemmaTemplate, FinishedMatchPayload } from '../types/game';
import { R, P, clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { AN, RN, TN, BASE, POS, ATT, LINE, PM, SPX, ALL_SUB_ROLES, SPN, SKIN_P, HAIR_P, PACT, TEAM_TRAINING_PROGRAMS, TRAINING_INTENSITY_META, getTeamTrainingPlan } from '../data/thaiFootballData';
import { clearNamePool, genClubNames, assignTeamShirtNumbers, mkPlayer, mkTeam, getFormationSlots, getFormationCounts, pen, ef, xi, DT, injD, ovMe, autoGrow, syncMe, vlu, wagOf, squadWage, logFin, pushFeed, ensureClubIdentity } from './playerCore';
import { countReadyMissions, applyTrainingMissionProgress } from './missions';

export function rate(
  t: Team,
  s?: GameState | null,
  big?: boolean,
  matchMin?: number,
  subsEntered?: string[],
  sentOffNames?: string[]
): { at: number; df: number; x: Player[] } {
  const x = xi(t).filter((q) => !sentOffNames?.includes(q.n));
  const f = getFormationCounts(t);
  const sl = getFormationSlots(t);
  const av = (p: Position) => {
    const idxs = x.map((q, i) => ((sl[i]?.pos || q.pos) === p ? i : -1)).filter((i) => i >= 0);
    return (
      idxs.reduce((sum, i) => sum + Math.max(0, ef(x[i])) * PM[pen(x[i].ro, (sl[i] || {}).sp)], 0) /
      (idxs.length || 1)
    );
  };
  let at = av('FW') * 0.55 + av('MF') * 0.45 + (f[3] - 2) * 2;
  let df = av('DF') * 0.6 + av('GK') * 0.4 + (f[1] - 4) * 2;

  const DL = x.map((q, i) => [q, DT(q, s?.p), sl[i]?.pos || q.pos] as const);
  const M = (ps: Position[], fn: (q: Player, d: Record<string, number>, a: CoreAttrs) => number) => {
    const l = DL.filter(([, , slotPos]) => ps.includes(slotPos));
    return l.length ? l.reduce((sum, [q, D]) => sum + fn(q, D.d, D.a), 0) / l.length : 0;
  };
  at += M(['FW', 'MF'], (q, d) => d.fin * 0.35 + d.pw * 0.15 + d.cur * 0.1 + d.run * 0.25 + d.crs * 0.15 - q.ov) * 0.35;
  at += M(['FW', 'MF'], (q, d, a) => d.spd * 0.65 + a.dr * 0.35 - q.ov) * 0.14;
  at += M(['FW'], (q, d) => d.str - q.ov) * 0.06;
  at += M(['GK'], (q, d) => d.dist - q.ov) * 0.08;
  df += M(['DF'], (q, d) => d.rd * 0.25 + d.pos * 0.25 + d.mrk * 0.2 + d.blk * 0.15 + d.hd * 0.15 - q.ov) * 0.4;
  df += M(['MF'], (q, d) => d.rd * 0.35 + d.pos * 0.35 + d.mrk * 0.3 - q.ov) * 0.14;
  df += M(['GK'], (q, d) => d.sv * 0.5 + d.cl * 0.3 + d.dist * 0.2 - q.ov) * 0.3;
  df += M(['DF', 'MF'], (q, d) => d.str * 0.65 + d.tol * 0.35 - q.ov) * 0.07;
  const sa = M(['FW', 'MF', 'DF', 'GK'], (q, d) => d.sta - q.ov) * 0.12;
  at += sa;
  df += sa;

  if (matchMin && matchMin > 60) {
    const pressLoad = 0.7 + ((t.press ?? 1) + (t.tempo ?? 1)) * 0.25;
    const minFactor = (matchMin - 60) / 30;
    const fatiguePenalty =
      DL.reduce((sum, [q, D]) => {
        if (subsEntered?.includes(q.n)) return sum;
        const resist = clamp((D.d.sta * 0.7 + (q.fit ?? 100) * 0.3) / 100, 0.35, 1.05);
        return sum + Math.max(0, 1.05 - resist) * 5.2 * pressLoad * minFactor;
      }, 0) / (DL.length || 1);
    at -= fatiguePenalty;
    df -= fatiguePenalty;
  }

  if (big || (matchMin && matchMin >= 70)) {
    const cmWeight = big ? 0.2 : 0.12;
    const cm = M(['FW', 'MF', 'DF', 'GK'], (q, d) => d.comp - q.ov) * cmWeight;
    at += cm;
    df += cm;
  }
  if (x.some((q) => DT(q, s?.p).tr === 0)) {
    at += 0.5;
    df += 0.5;
  }

  if (t.tac === 'A') { at += 4; df -= 4; }
  if (t.tac === 'D') { at -= 4; df += 4; }
  if (t.tac === 'X') { at += 7; df -= 7; }
  if (t.tac === 'Z') { at -= 7; df += 7; }

  const pr = (t.press ?? 1) - 1;
  at += pr * 2.5;
  df += pr * 1.5;
  const tm = (t.tempo ?? 1) - 1;
  at += tm * 2;
  df -= tm;
  const wd = (t.wid ?? 1) - 1;
  const ln = (t.line ?? 1) - 1;
  const pa = t.pass ?? 1;
  at += wd * 1.5 + ln * 1.5 + (pa === 0 ? (av('MF') - 60) / 10 : pa === 2 ? (av('FW') - 60) / 10 : pa === 3 ? 1 : 0);
  df += -wd - ln * 2.5 + (pa === 3 ? 1 : 0);

  const cp = t.cap && x.find((q) => q.n === t.cap);
  if (cp) {
    at += (cp.ov - 60) / 30;
    df += (cp.ov - 60) / 30;
  }
  const famBonus = (((t.tacFam ?? 65) - 50) / 50) * 2;
  at += famBonus;
  df += famBonus;

  if (s && t.id !== s.me) {
    const d = [-2.5, 0, 3][s.diff ?? 1];
    at += d;
    df += d;
  }
  if (s && s.mode === 'm' && t.id === s.me) {
    const mo = ((s.mor ?? 50) - 50) / 25 + (s.winBonus === 25 ? 1.5 : s.winBonus === 10 ? 0.8 : 0);
    at += mo;
    df += mo;
  }
  if (sentOffNames && sentOffNames.length) {
    at -= sentOffNames.length * 4.5;
    df -= sentOffNames.length * 4.5;
  }
  return { at, df, x };
}

export const pois = (l: number) => {
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
};

export function genMatchGoals(t: Team, x: Player[], n: number, careerP?: PlayerCareerProfile | null): MatchEvent[] {
  if (!x.length) return [];
  return Array.from({ length: n }, () => {
    const W = (q: Player, b: number, f: number) => Array(Math.max(1, Math.round(b * Math.pow(f / 70, 2)))).fill(q);
    const w = x.flatMap((q) => {
      const D = DT(q, careerP);
      const b = q.pos === 'FW' ? 5 : q.pos === 'MF' ? 3 : q.pos === 'DF' ? 1 : 0;
      const sc = q.pos === 'DF'
        ? D.d.hd * 0.7 + D.d.str * 0.3
        : D.d.fin * 0.45 + D.d.pw * 0.2 + D.d.run * 0.15 + D.d.cur * 0.1 + D.d.spd * 0.1;
      return b ? W(q, b, sc) : [];
    });
    const q = w.length ? P(w) : P(x);
    const o = x
      .filter((z) => z !== q && z.pos !== 'GK')
      .flatMap((z) => {
        const D = DT(z, careerP);
        return W(z, z.pos === 'MF' ? 4 : z.pos === 'FW' ? 3 : 1, D.d.crs * 0.4 + D.a.ps * 0.35 + D.d.cur * 0.1 + D.a.dr * 0.1 + D.d.rd * 0.05);
      });
    return { m: R(1, 90), t: t.id, who: q.n, as: Math.random() < 0.75 && o.length ? P(o).n : '' };
  });
}

export function simMatchCardsAndSubs(h: Team, a: Team, s?: GameState | null): {
  cards: MatchCardEvent[];
  subs: MatchSubEvent[];
  playedNames: Record<number, string[]>;
} {
  const cards: MatchCardEvent[] = [];
  const subs: MatchSubEvent[] = [];
  const playedNames: Record<number, string[]> = {};
  const big = !!(s && (s.pc || s.pa || (s.derby && (h.id === s.me || a.id === s.me))));

  [h, a].forEach((tm) => {
    const starters = xi(tm);
    const active = starters.map((q) => q.n);
    const bench = tm.sq.filter((q) => !active.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0).sort((x, y) => y.ov - x.ov);
    const subCount = Math.min(3, bench.length);
    const currentLineup = starters.slice();
    const played = new Set(active);

    // Simulate 1-3 substitutions between minutes 58-82
    for (let k = 0; k < subCount; k++) {
      if (Math.random() > 0.72) continue;
      const candidateOut = currentLineup
        .filter((q) => q.pos !== 'GK')
        .sort((x, y) => (x.fit ?? 100) - (y.fit ?? 100) || x.ov - y.ov)[0];
      if (!candidateOut) break;
      const candidateIn =
        bench.find((b) => !played.has(b.n) && b.pos === candidateOut.pos) ||
        bench.find((b) => !played.has(b.n) && b.pos !== 'GK');
      if (!candidateIn) break;
      const min = R(58, 83);
      const idx = currentLineup.indexOf(candidateOut);
      if (idx >= 0) currentLineup[idx] = candidateIn;
      played.add(candidateIn.n);
      subs.push({ m: min, t: tm.id, inPlayer: candidateIn.n, outPlayer: candidateOut.n });
    }
    playedNames[tm.id] = Array.from(played);

    // Simulate cards (0-3 yellows per team, ~3.5% direct or 2nd yellow red)
    const pool = currentLineup.filter((q) => q.pos !== 'GK');
    const cardRoll = (tm.press ?? 1) === 2 ? 0.65 : 0.48;
    const numYellows = (Math.random() < cardRoll ? 1 : 0) + (Math.random() < cardRoll * 0.55 ? 1 : 0) + (big && Math.random() < 0.3 ? 1 : 0);
    const matchY: Record<string, number> = {};
    for (let c = 0; c < numYellows && pool.length; c++) {
      const weighted = pool.flatMap((q) => {
        const D = DT(q, s?.p);
        const w = (D.tr === 1 ? 3 : 1) + (D.d.pos < 58 ? 1 : 0);
        return Array(w).fill(q);
      });
      const culprit = P(weighted);
      const min = R(12, 89);
      matchY[culprit.n] = (matchY[culprit.n] || 0) + 1;
      if (matchY[culprit.n] >= 2) {
        cards.push({ m: min, t: tm.id, who: culprit.n, type: 'Y2R' });
      } else {
        cards.push({ m: min, t: tm.id, who: culprit.n, type: 'Y' });
      }
    }
    if (pool.length && Math.random() < (big ? 0.045 : 0.025)) {
      const rough = pool.filter((q) => DT(q, s?.p).tr === 1);
      const culprit = rough.length ? P(rough) : P(pool);
      if (!cards.some((c) => c.t === tm.id && c.who === culprit.n && (c.type === 'R' || c.type === 'Y2R'))) {
        cards.push({ m: R(25, 86), t: tm.id, who: culprit.n, type: 'R' });
      }
    }
  });

  return { cards, subs, playedNames };
}

export function simMatch(h: Team, a: Team, s?: GameState | null): MatchResult {
  const bg = !!(s && (s.pc || s.pa || (s.derby && (h.id === s.me || a.id === s.me))));
  const H = rate(h, s, bg);
  const G = rate(a, s, bg);
  if (h.pass === 3 && G.at > H.at) H.at += 3;
  if (a.pass === 3 && H.at > G.at) G.at += 3;
  const lamH = Math.min(5, 1.35 * Math.exp((H.at - G.df) / 20 + 0.1));
  const lamA = Math.min(5, 1.35 * Math.exp((G.at - H.df) / 20 - 0.05));
  const gh = pois(lamH);
  const ga = pois(lamA);
  const evs = [...genMatchGoals(h, H.x, gh, s?.p), ...genMatchGoals(a, G.x, ga, s?.p)].sort((x, y) => x.m - y.m);
  const xgH = Math.max(0.1, Math.round((lamH * 0.85 + gh * 0.18 + R(-10, 15) / 100) * 100) / 100);
  const xgA = Math.max(0.1, Math.round((lamA * 0.85 + ga * 0.18 + R(-10, 15) / 100) * 100) / 100);
  const { cards, subs, playedNames } = simMatchCardsAndSubs(h, a, s);
  const incidents: MatchDramaticEvent[] = [];

  if (xgH - gh >= 0.9 || (ga === 0 && xgH >= 1.4)) {
    const gkA = a.sq.find((q) => q.pos === 'GK')?.n || 'ผู้รักษาประตู';
    incidents.push({
      m: R(35, 84),
      t: a.id,
      kind: 'save',
      text: `🧤 ซูเปอร์เซฟ! ${gkA} (${a.name}) ป้องกันลูกยิงจ่อๆ ช่วยทีมรอดเสียประตู`
    });
  } else if (xgA - ga >= 0.9 || (gh === 0 && xgA >= 1.4)) {
    const gkH = h.sq.find((q) => q.pos === 'GK')?.n || 'ผู้รักษาประตู';
    incidents.push({
      m: R(35, 84),
      t: h.id,
      kind: 'save',
      text: `🧤 ซูเปอร์เซฟ! ${gkH} (${h.name}) โชว์เซฟสำคัญรักษาสกอร์ให้ทีม`
    });
  }
  if (Math.random() < (bg ? 0.42 : 0.24)) {
    const hitTeam = Math.random() < 0.5 ? h : a;
    const hitPlayer = (hitTeam.id === h.id ? H.x : G.x).find((q) => q.pos === 'FW' || q.pos === 'MF') || hitTeam.sq[0];
    incidents.push({
      m: R(18, 87),
      t: hitTeam.id,
      kind: 'woodwork',
      text: `🧱 หวุดหวิด! ${hitPlayer?.n || 'แนวรุก'} (${hitTeam.name}) ซัดบอลชนเสา/คานอย่างจัง`
    });
  }
  if ((bg || Math.abs(gh - ga) <= 1) && Math.random() < 0.28) {
    const varSide = Math.random() < 0.5 ? h : a;
    incidents.push({
      m: R(40, 88),
      t: varSide.id,
      kind: 'var',
      text: `📺 ดราม่า VAR! ผู้ตัดสินเช็กจังหวะล้ำหน้า/ฟาวล์เขตโทษของ ${varSide.name} อย่างละเอียด`
    });
  }

  return { gh, ga, evs, xgH, xgA, cards, subs, playedNames, incidents };
}

export function extractMatchHighlights(
  h: Team,
  a: Team,
  r: MatchResult,
  opts?: {
    kind?: 'league' | 'cup' | 'asia';
    label?: string;
    isDerby?: boolean;
    penText?: string;
    rawLogs?: { m: number; text: string; tone?: 'goal' | 'card' | 'sys' | 'sub' }[];
  }
): MatchHighlightsSummary {
  const lines: MatchHighlightLine[] = [];
  const teamName = (tid?: number) => (tid === h.id ? h.name : tid === a.id ? a.name : '');
  const styleDesc = (style?: string): string => {
    switch (style) {
      case 'bicycle':
        return 'ตีลังกายิงสุดมหัศจรรย์';
      case 'curler':
        return 'ปั่นโค้งเสียบสามเหลี่ยม';
      case 'trivela':
        return 'ไซด์ก้อยทริเวล่าสุดสวย';
      case 'knuckle':
        return 'กดลูกส่ายคนัคเคิลฮุคเสียบมุม';
      case 'panenka':
        return 'ชิพจุดโทษปาเนนก้าเหนือชั้น';
      case 'chip':
        return 'ชิพข้ามหัวนายด่านสุดเยือกเย็น';
      case 'volley':
        return 'วอลเลย์กลางอากาศเต็มข้อ';
      case 'header':
        return 'ขึ้นโหม่งตุงตาข่าย';
      case 'freekick':
        return 'ซัดฟรีคิกสุดคม';
      case 'penalty':
        return 'สังหารจุดโทษไม่พลาด';
      default:
        return 'ยิงประตู';
    }
  };

  // 1. Extract Goals & Running Score Drama from MatchResult.evs
  const sortedGoals = (r.evs || []).slice().sort((u, v) => u.m - v.m);
  let runH = 0;
  let runA = 0;
  let homeLedFirst = false;
  let awayLedFirst = false;
  let homeEverTrailed = false;
  let awayEverTrailed = false;
  const goalTallies: Record<string, number> = {};

  sortedGoals.forEach((ev, idx) => {
    const isH = ev.t === h.id;
    if (isH) runH++;
    else runA++;
    if (idx === 0) {
      if (isH) homeLedFirst = true;
      else awayLedFirst = true;
    }
    if (runH < runA) homeEverTrailed = true;
    if (runA < runH) awayEverTrailed = true;

    goalTallies[ev.who] = (goalTallies[ev.who] || 0) + 1;
    const count = goalTallies[ev.who];
    const tags: string[] = [];
    if (ev.m >= 86 && (runH === runA || Math.abs(runH - runA) === 1)) {
      tags.push('ประตูนาทีบาป!');
    } else if (runH === runA) {
      tags.push('ตีเสมอ');
    } else if (idx === 0) {
      tags.push('เบิกร่อง');
    }
    if (count === 3) tags.push('แฮตทริก!!');
    else if (count === 2) tags.push('เบิ้ล');

    const tName = teamName(ev.t);
    const verb = styleDesc(ev.style);
    const asTxt = ev.as ? ` · แอสซิสต์ ${ev.as}` : '';
    const tagTxt = tags.length ? ` [${tags.join(' · ')}]` : '';
    lines.push({
      m: ev.m,
      kind: 'goal',
      teamId: ev.t,
      text: `⚽ ${ev.who} (${tName}) ${verb} (${runH}-${runA})${asTxt}${tagTxt}`
    });
  });

  // 2. Extract Cards from MatchResult.cards
  const sortedCards = (r.cards || []).slice().sort((u, v) => u.m - v.m);
  const redCount = sortedCards.filter((c) => c.type === 'R' || c.type === 'Y2R').length;
  const yellowCount = sortedCards.filter((c) => c.type === 'Y').length;
  sortedCards.forEach((c) => {
    const tName = teamName(c.t);
    if (c.type === 'R') {
      lines.push({
        m: c.m,
        kind: 'card',
        teamId: c.t,
        text: `🟥 ใบแดงโดยตรง! ${c.who} (${tName}) โดนไล่ออกจากสนาม`
      });
    } else if (c.type === 'Y2R') {
      lines.push({
        m: c.m,
        kind: 'card',
        teamId: c.t,
        text: `🟨🟥 ใบเหลืองที่สอง! ${c.who} (${tName}) โดนไล่ออก`
      });
    } else {
      lines.push({
        m: c.m,
        kind: 'card',
        teamId: c.t,
        text: `🟨 ใบเหลือง ${c.who} (${tName})`
      });
    }
  });

  // 3. Extract Dramatic Incidents from MatchResult.incidents + rawLogs + derived turning points
  const seenKeys = new Set<string>();
  const pushDrama = (m: number, text: string, teamId?: number) => {
    const normKey = `${m}:${text.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, '').slice(0, 22)}`;
    if (seenKeys.has(normKey)) return;
    seenKeys.add(normKey);
    lines.push({ m, kind: 'drama', teamId, text });
  };

  (r.incidents || []).forEach((inc) => {
    pushDrama(inc.m, inc.text, inc.t);
  });

  if (opts?.rawLogs?.length) {
    opts.rawLogs.forEach((lg) => {
      if (lg.tone === 'goal' || lg.tone === 'card' || lg.tone === 'sub') return;
      const isDramaLog =
        lg.text.includes('VAR') ||
        lg.text.includes('จุดโทษ') ||
        lg.text.includes('ชนเสา') ||
        lg.text.includes('ชนคาน') ||
        lg.text.includes('ซูเปอร์เซฟ') ||
        lg.text.includes('ตีลังกา') ||
        lg.text.includes('บาดเจ็บ') ||
        lg.text.includes('ปั่นโค้ง') ||
        lg.text.includes('ทริเวล่า') ||
        lg.text.includes('คนัคเคิล') ||
        lg.text.includes('ปาเนนก้า');
      if (isDramaLog && !(r.incidents || []).some((inc) => Math.abs(inc.m - lg.m) <= 1)) {
        pushDrama(lg.m, lg.text);
      }
    });
  }

  // Derived dramatic turning points from MatchResult
  const comebackWin =
    (r.gh > r.ga && (homeEverTrailed || awayLedFirst)) ||
    (r.ga > r.gh && (awayEverTrailed || homeLedFirst));
  if (comebackWin) {
    const winner = r.gh > r.ga ? h : a;
    pushDrama(88, `🔥 พลิกนรก! ${winner.name} ตกเป็นฝ่ายตามหลังก่อนฮึดแซงกลับมาชนะ ${r.gh}-${r.ga}`, winner.id);
  }

  const hReds = sortedCards.filter((c) => c.t === h.id && (c.type === 'R' || c.type === 'Y2R')).length;
  const aReds = sortedCards.filter((c) => c.t === a.id && (c.type === 'R' || c.type === 'Y2R')).length;
  if (hReds > 0 && r.gh >= r.ga) {
    pushDrama(90, `🛡️ หัวใจแกร่ง! ${h.name} เหลือผู้เล่นน้อยกว่าแต่ยังยันเก็บแต้มได้สำเร็จ`, h.id);
  } else if (aReds > 0 && r.ga >= r.gh) {
    pushDrama(90, `🛡️ หัวใจแกร่ง! ${a.name} เหลือผู้เล่นน้อยกว่าแต่ไม่ยอมแพ้จนจบเกม`, a.id);
  }

  if (opts?.penText || r.pen !== undefined) {
    pushDrama(90, `🎯 ดวลจุดโทษตัดสินสุดระทึก: ${opts?.penText || (r.pen ? `${h.name} ชนะจุดโทษ!` : `${a.name} ชนะจุดโทษ!`)}`);
  }

  // Sort chronologically
  const kindOrder: Record<MatchHighlightLine['kind'], number> = { goal: 0, drama: 1, card: 2, summary: 3 };
  lines.sort((u, v) => u.m - v.m || kindOrder[u.kind] - kindOrder[v.kind]);

  // Build Headline
  const diff = Math.abs(r.gh - r.ga);
  const totalGoals = r.gh + r.ga;
  const lateGoal = sortedGoals.some((g) => g.m >= 86);
  const hasHatTrick = Object.values(goalTallies).some((n) => n >= 3);
  const hasVar = lines.some((l) => l.kind === 'drama' && l.text.includes('VAR'));

  let headline = `${h.name} ${r.gh}-${r.ga} ${a.name}`;
  if (opts?.penText || r.pen !== undefined) {
    headline = `ดราม่าดวลจุดโทษ! ${r.pen ? h.name : a.name} เฉือนเข้าป้าย`;
  } else if (comebackWin) {
    headline = `พลิกเกมสุดมันส์! ${r.gh > r.ga ? h.name : a.name} แซงคว้าชัย ${r.gh}-${r.ga}`;
  } else if (hasHatTrick) {
    const hero = Object.entries(goalTallies).find(([, n]) => n >= 3)?.[0] || '';
    headline = `แฮตทริกฮีโร่! ${hero} นำทัพซัดกระหน่ำ`;
  } else if (lateGoal && diff <= 1) {
    headline = r.gh === r.ga ? `ตีเจ๊านาทีบาป! กินกันไม่ลง ${r.gh}-${r.ga}` : `ซัดชัยท้ายเกม! ${r.gh > r.ga ? h.name : a.name} เฉือนหวิว`;
  } else if (redCount >= 2 || (redCount >= 1 && yellowCount >= 4)) {
    headline = `เกมเดือดใบว่อน! ตัดสินด้วยความนิ่งจนจบ 90 นาที`;
  } else if (diff >= 3) {
    headline = `ฟอร์มโหดขาดลอย! ${r.gh > r.ga ? h.name : a.name} ไล่ถล่ม ${r.gh}-${r.ga}`;
  } else if (totalGoals >= 5) {
    headline = `ยิงกันสนั่น ${totalGoals} ประตู! เกมเปิดแลกสุดเร้าใจ`;
  } else if (hasVar) {
    headline = `เกมเข้มข้นมีประเด็น VAR ชี้ขาดจังหวะสำคัญ`;
  } else if (totalGoals === 0) {
    headline = `เกมรับเหนียวแน่น! เจ๊าไร้สกอร์ 0-0`;
  } else if (r.gh === r.ga) {
    headline = `แบ่งแต้มสุดสูสี ${h.name} เสมอ ${a.name} ${r.gh}-${r.ga}`;
  } else {
    headline = `${r.gh > r.ga ? h.name : a.name} เก็บชัยชนะได้ตามเป้า ${r.gh}-${r.ga}`;
  }

  const statsBits: string[] = [];
  if (r.motm) statsBits.push(`👑 MOTM: ${r.motm}`);
  if (r.xgH !== undefined && r.xgA !== undefined) statsBits.push(`xG ${r.xgH.toFixed(2)} - ${r.xgA.toFixed(2)}`);
  statsBits.push(`⚽ ${totalGoals} ประตู · 🟨 ${yellowCount}${redCount > 0 ? ` · 🟥 ${redCount}` : ''}`);
  if (r.subs?.length) statsBits.push(`🔄 เปลี่ยนตัว ${r.subs.length} ครั้ง`);

  lines.push({
    m: 90,
    kind: 'summary',
    text: statsBits.join(' · ')
  });

  const matchLabel = opts?.label || (opts?.kind === 'cup' ? '🏆 ถ้วยประชาชน' : opts?.kind === 'asia' ? '🌏 บอลถ้วยทวีป' : '⚽ ลีก');
  const scoreLine = `${h.name} ${r.gh}-${r.ga} ${a.name}${opts?.penText ? ` (${opts.penText})` : ''}`;
  const summaryBody = lines
    .filter((l) => l.kind !== 'summary')
    .map((l) => `${l.m}' · ${l.text}`)
    .join('\n');
  const summaryText = [
    `📌 ${headline}`,
    `${matchLabel} · ${scoreLine}`,
    '--------------------',
    summaryBody || 'ไม่มีเหตุการณ์ใหญ่ในเกม — เกมคุมจังหวะกันอย่างรัดกุมตลอด 90 นาที',
    '--------------------',
    statsBits.join(' | ')
  ].join('\n');

  return {
    id: `${Date.now()}-${h.id}-${a.id}-${r.gh}-${r.ga}`,
    matchLabel,
    scoreLine,
    headline,
    summaryText,
    lines
  };
}

export function computePlayerRatings(
  h: Team,
  a: Team,
  r: MatchResult,
  careerP?: PlayerCareerProfile | null,
  matchStats?: { savesH: number; savesA: number; blocksH: number; blocksA: number }
): { ratings: Record<string, number>; motm: string } {
  const ratings: Record<string, number> = {};
  let bestN = '';
  let bestR = 0;
  [
    [h, r.gh, r.ga, matchStats?.savesH || 0, matchStats?.blocksH || 0],
    [a, r.ga, r.gh, matchStats?.savesA || 0, matchStats?.blocksA || 0]
  ].forEach(([tm, gf, ga, saves, blocks]) => {
    const team = tm as Team;
    const starterSet = xi(team);
    const x = r.playedNames?.[team.id]?.length
      ? team.sq.filter((q) => r.playedNames![team.id].includes(q.n))
      : starterSet;
    const diff = (gf as number) - (ga as number);
    x.forEach((q) => {
      const D = DT(q, careerP);
      const gl = r.evs.filter((e) => e.t === team.id && e.who === q.n).length;
      const as = r.evs.filter((e) => e.t === team.id && e.as === q.n).length;
      const csBonus = (q.pos === 'GK' || q.pos === 'DF') && (ga as number) === 0 ? 0.65 : 0;
      const concedePenalty = (q.pos === 'GK' || q.pos === 'DF') && (ga as number) >= 3 ? -0.35 : 0;
      const roleScore =
        q.pos === 'FW'
          ? (D.d.fin * 0.35 + D.d.run * 0.25 + D.d.pw * 0.15 + D.d.cur * 0.15 + D.d.spd * 0.1)
          : q.pos === 'MF'
            ? (D.a.ps * 0.3 + D.a.dr * 0.2 + D.d.crs * 0.2 + D.d.rd * 0.15 + D.d.sta * 0.15)
            : q.pos === 'DF'
              ? (D.d.rd * 0.25 + D.d.pos * 0.25 + D.d.mrk * 0.2 + D.d.blk * 0.15 + D.d.hd * 0.15)
              : (D.d.sv * 0.45 + D.d.cl * 0.3 + D.d.dist * 0.15 + D.d.comp * 0.1);
      const statEdge = (roleScore - 60) / 85 + (D.d.comp - 60) / 240;
      const defWorkBonus =
        q.pos === 'GK'
          ? Math.min(0.6, (saves as number) * 0.08)
          : q.pos === 'DF'
            ? Math.min(0.45, (blocks as number) * 0.07)
            : 0;
      const raw =
        6.2 +
        (diff > 0 ? 0.45 : diff < 0 ? -0.35 : 0) +
        gl * 1.1 +
        as * 0.7 +
        csBonus +
        concedePenalty +
        statEdge +
        defWorkBonus +
        ((q.ov - 55) / 90) +
        (Math.random() - 0.5) * 0.7;
      const rt = clamp(Math.round(raw * 10) / 10, 4.8, 10.0);
      ratings[q.n] = rt;
      if (rt > bestR) {
        bestR = rt;
        bestN = q.n;
      }
    });
  });
  return { ratings, motm: bestN };
}

export function applyMatchResult(h: Team, gh: number, a: Team, ga: number) {
  h.fm = (h.fm || '') + (gh > ga ? 'W' : gh < ga ? 'L' : 'D');
  a.fm = (a.fm || '') + (gh < ga ? 'W' : gh > ga ? 'L' : 'D');
  h.p++;
  a.p++;
  h.gf += gh;
  h.ga += ga;
  a.gf += ga;
  a.ga += gh;
  if (gh > ga) {
    h.w++;
    h.pts += 3;
    a.l++;
  } else if (gh < ga) {
    a.w++;
    a.pts += 3;
    h.l++;
  } else {
    h.d++;
    a.d++;
    h.pts++;
    a.pts++;
  }
}

export const sortTable = (a: Team[]) =>
  [...a].sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf);

export function roundRobin(ids: number[]): [number, number][][] {
  const arr = [...ids].sort(() => Math.random() - 0.5);
  const n = arr.length;
  const o: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const m: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      m.push(r % 2 ? [b, a] : [a, b]);
    }
    o.push(m);
    arr.splice(1, 0, arr.pop()!);
  }
  return o;
}

export const doubleRoundRobin = (ids: number[]) => {
  const a = roundRobin(ids);
  return [...a, ...a.map((r) => r.map(([h, x]) => [x, h] as [number, number]))];
};

export function getTransferWindowInfo(s: Pick<GameState, 'md' | 'fx'>) {
  const total = s.fx?.length || 30;
  const md = s.md || 0;
  if (md >= total) {
    return {
      open: false,
      phase: 'closed2' as const,
      label: '🔒 จบฤดูกาล (รอรอบตลาดใหม่)',
      shortLabel: '🔒 จบฤดูกาล',
      subLabel: 'สรุปจบฤดูกาลเพื่อเข้าสู่ตลาดเปิดรอบต้นฤดูกาลหน้า (นัด 1–6)',
      remaining: 0,
      rangeText: 'หลังจบฤดูกาล'
    };
  }
  if (md < 6) {
    const rem = 6 - md;
    return {
      open: true,
      phase: 'open1' as const,
      label: '🟢 เปิดตลาดรอบแรก (ต้นฤดูกาล)',
      shortLabel: `🟢 ตลาดเปิด (${rem} นัด)`,
      subLabel: `ช่วงนัดที่ 1–6 · เหลืออีก ${rem} นัดก่อนปิดตลาดรอบแรก`,
      remaining: rem,
      rangeText: 'นัด 1–6'
    };
  }
  if (md < 14) {
    const wait = 14 - md;
    return {
      open: false,
      phase: 'closed1' as const,
      label: '🔒 ตลาดซื้อขายปิดชั่วคราว',
      shortLabel: `🔒 เปิดนัด 15 (อีก ${wait} นัด)`,
      subLabel: `ตลาดเลกสองจะเปิดช่วงนัดที่ 15–20 (อีก ${wait} นัด)`,
      remaining: wait,
      rangeText: 'นัด 15–20'
    };
  }
  if (md < 20) {
    const rem = 20 - md;
    return {
      open: true,
      phase: 'open2' as const,
      label: '🟢 เปิดตลาดรอบสอง (เลกสอง)',
      shortLabel: `🟢 ตลาดเปิด (${rem} นัด)`,
      subLabel: `ช่วงนัดที่ 15–20 · เหลืออีก ${rem} นัดก่อนปิดตลาดฤดูกาลนี้`,
      remaining: rem,
      rangeText: 'นัด 15–20'
    };
  }
  const toEnd = Math.max(0, total - md);
  return {
    open: false,
    phase: 'closed2' as const,
    label: '🔒 ตลาดซื้อขายปิดแล้วจนจบฤดูกาล',
    shortLabel: '🔒 ตลาดปิด (รอซีซั่นหน้า)',
    subLabel: `เปิดตลาดอีกครั้งต้นฤดูกาลหน้า (เหลืออีก ${toEnd} นัดจบฤดูกาล)`,
    remaining: toEnd,
    rangeText: 'ฤดูกาลหน้า'
  };
}

export const LEAGUE_TRANSFER_RULES = {
  minSquad: 18,
  maxSquad: 28,
  maxLoans: 4,
  minPos: { GK: 2, DF: 4, MF: 4, FW: 2 } as Record<Position, number>
};

export function getStaffState(s: Pick<GameState, 'staff'>) {
  return {
    asst: s.staff?.asst ?? 0,
    fit: s.staff?.fit ?? 0,
    scout: s.staff?.scout ?? 0,
    physio: s.staff?.physio ?? 0
  };
}

export function getStaffWage(s: Pick<GameState, 'staff'>) {
  const st = getStaffState(s);
  return (st.asst + st.fit + st.scout + st.physio) * 1.5;
}

export function getLeagueTransferContext(s: GameState, me: Team) {
  const tw = getTransferWindowInfo(s);
  const loansCount = me.sq.filter((q) => !!q.loan).length;
  const curWage = squadWage(me);
  const baseCap = [26, 44, 70, 95][me.tier] ?? 44;
  const infraMult = 1 + ((s.st ?? 1) - 1) * 0.1 + ((s.merchLv ?? 1) - 1) * 0.05;
  const wageCap = Math.round(baseCap * infraMult);
  const wagePct = Math.round((curWage / Math.max(1, wageCap)) * 100);
  const posCounts: Record<Position, number> = {
    GK: me.sq.filter((q) => q.pos === 'GK').length,
    DF: me.sq.filter((q) => q.pos === 'DF').length,
    MF: me.sq.filter((q) => q.pos === 'MF').length,
    FW: me.sq.filter((q) => q.pos === 'FW').length
  };
  return {
    tw,
    loansCount,
    maxLoans: LEAGUE_TRANSFER_RULES.maxLoans,
    minSquad: LEAGUE_TRANSFER_RULES.minSquad,
    maxSquad: LEAGUE_TRANSFER_RULES.maxSquad,
    minPos: LEAGUE_TRANSFER_RULES.minPos,
    posCounts,
    curWage,
    wageCap,
    wagePct,
    ffpLocked: s.money < 0
  };
}

export function calcMatchdayFinanceEstimate(s: GameState, me: Team) {
  const stLv = s.st ?? 1;
  const merchLv = s.merchLv ?? 1;
  const cap = [3500, 8000, 15000, 26000, 42000][stLv - 1] || 3500;
  const tpIdx = s.tp ?? 1;
  const spIdx = s.sp ?? 0;
  const fanVal = s.fan ?? 55;
  const attRate = clamp((0.36 + (fanVal / 100) * 0.56) * [1.15, 1.0, 0.8][tpIdx] * (s.promo === 1 ? 1.15 : 1), 0.2, 0.98);
  const estAtt = Math.round(cap * attRate);
  const ticketPriceMult = [0.82, 1.0, 1.24][tpIdx];
  const estTicket = Math.round((8 + stLv * 7) * (fanVal / 60) * ticketPriceMult * (s.promo === 1 ? 1.35 : 1));
  const estMerch = Math.round((2 + merchLv * 3) * (fanVal / 55));
  const baseSponsor = spIdx === 0 ? 8 + me.tier * 6 : spIdx === 1 ? 4 + me.tier * 4 : 5 + me.tier * 5;
  const estSponsor = Math.round(baseSponsor * (s.promo === 2 ? 1.35 : 1));
  const dealIncome = s.sponsorDeal ? s.sponsorDeal.perMatch : 0;
  const wageCost = squadWage(me);
  const staffCost = Math.round(getStaffWage(s));
  const loanCost = s.bankLoan ? s.bankLoan.per : 0;
  const totalOut = wageCost + staffCost + loanCost;
  const homeIn = estTicket + estMerch + estSponsor + dealIncome;
  const awayIn = estSponsor + dealIncome;
  return {
    cap,
    estAtt,
    attPct: Math.round(attRate * 100),
    estTicket,
    estMerch,
    estSponsor,
    dealIncome,
    wageCost,
    staffCost,
    loanCost,
    totalOut,
    homeIn,
    awayIn,
    homeNet: homeIn - totalOut,
    awayNet: awayIn - totalOut
  };
}

export function mkMarket(s: GameState) {
  const b0 = BASE[s.teams[s.me].tier];
  const rolePool: Player[] = ALL_SUB_ROLES.map((role, i) => {
    const pos = LINE[role] || 'MF';
    const yo = role !== 'GK' && i % 5 === 3;
    const p = mkPlayer(pos, b0 + R(-1, 12), yo, role);
    p.price = Math.round((p.ov * p.ov) / 40);
    if (i === 0 || (i % 6 === 2 && Math.random() < 0.45)) {
      p.free = 1;
      p.price = 0;
    }
    p.askWg = +((p.ov * p.ov) / 3000).toFixed(1);
    p.tries = 0;
    p.locked = 0;
    return p;
  });

  // Guarantee free agents across all 4 core lines so every position is signable even when transfer window closes
  const extraFreeAgents: Player[] = POS.map((pos) => {
    const p = mkPlayer(pos, b0 + R(-2, 9), false, P(SPX[pos]));
    p.free = 1;
    p.price = 0;
    p.askWg = +((p.ov * p.ov) / 3000).toFixed(1);
    p.tries = 0;
    p.locked = 0;
    return p;
  });

  const posRank: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };
  s.mk = [...rolePool, ...extraFreeAgents].sort(
    (a, b) => posRank[a.pos] - posRank[b.pos] || b.ov - a.ov
  );
}

export function teamStats(t: Team, s?: GameState | null) {
  const x = xi(t);
  const r = rate(t, s);
  const avg = (a: Player[]) => (a.length ? a.reduce((sum, q) => sum + q.ov, 0) / a.length : 0);
  const ovSq = Math.round(avg(t.sq));
  const ovXi = Math.round(avg(x));
  const pos = (p: Position) => {
    const l = x.filter((q) => q.pos === p);
    const src = l.length ? l : t.sq.filter((q) => q.pos === p);
    return Math.round(avg(src));
  };
  const age = Math.round((t.sq.reduce((sum, q) => sum + (q.age || 24), 0) / (t.sq.length || 1)) * 10) / 10;
  return { ovSq, ovXi, at: Math.round(r.at), df: Math.round(r.df), gk: pos('GK'), d: pos('DF'), m: pos('MF'), f: pos('FW'), age };
}

export function setBoardObjective(s: GameState) {
  const t = s.teams[s.me];
  const ts = s.teams
    .filter((x) => x.tier === t.tier)
    .map((x) => {
      const r = rate(x, s);
      return [x.id, r.at + r.df] as const;
    })
    .sort((a, b) => b[1] - a[1]);
  const rank = ts.findIndex((a) => a[0] === s.me) + 1;
  s.obj = clamp(Math.ceil(rank * 0.8), 1, ts.length - 1);
  s.bd = s.bd ?? 55;
}

export function ensureAsia(s: GameState) {
  if (s.asia) return;
  s.asia = AN.map((n) => {
    const t = mkTeam(n, 2, s.teams.length, R(0, 8));
    t.tier = 3;
    t.foreign = 1;
    s.teams.push(t);
    return t.id;
  });
}

export function initAsia(s: GameState) {
  ensureAsia(s);
  const th = (s.aq || []).filter((i) => s.teams[i] && s.teams[i].tier < 3).slice(0, 3);
  if (th.length < 3) {
    const rs = s.teams
      .filter((t) => t.tier === 2 && !th.includes(t.id))
      .map((t) => {
        const r = rate(t, s);
        return [t.id, r.at + r.df] as const;
      })
      .sort((a, b) => b[1] - a[1]);
    while (th.length < 3 && rs.length) th.push(rs.shift()![0]);
  }
  const fo = s.asia!.slice().sort(() => Math.random() - 0.5).slice(0, 13);
  const ids = [...th, ...fo].sort(() => Math.random() - 0.5);
  s.ac = { r: 0, p: ids.slice(), ids, alive: ids.includes(s.me), done: false, log: [] };
  s.pa = false;
}

export function createNewGame(
  mode: GameMode,
  opts: {
    names?: string[][];
    t0?: Team[];
    pick?: number;
    player?: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'>;
  }
): GameState {
  clearNamePool();
  const teams: Team[] = [];
  let id = 0;
  const pv = mode === 'm' && opts.names && opts.t0;
  (pv ? opts.names! : genClubNames()).forEach((arr, ti) => {
    arr.forEach((n) => {
      teams.push(pv && ti === 0 ? opts.t0![id] : mkTeam(n, ti, id));
      id++;
    });
  });

  const meId = pv && opts.pick != null && opts.pick >= 0 && opts.pick < 16 ? opts.pick : R(0, 15);
  const s: GameState = {
    ver: 2,
    mode,
    season: 1,
    md: 0,
    teams,
    me: meId,
    money: 450,
    v: 't',
    hist: [],
    mk: [],
    st: 1,
    tr: 1,
    ya: 1,
    tf: 'MF',
    yth: [],
    fx: [],
    pc: false,
    cup: { alive: true, r: 0, done: false, log: [], ids: [] },
    mgrRep: 50,
    trophies: [],
    records: {},
    fan: 55,
    mor: 55,
    bd: 55
  };

  if (mode === 'm') {
    ensureClubIdentity(s);
    setBoardObjective(s);
  } else if (opts.player) {
    const p = opts.player;
    const chosenNo = clamp(p.no || (p.pos === 'GK' ? 1 : p.pos === 'DF' ? 4 : p.pos === 'MF' ? 8 : 10), 1, 99);
    s.p = {
      ...p,
      no: chosenNo,
      b: { ...p.a },
      sb: p.sb ? { ...p.sb } : {},
      age: 17,
      pts: p.pts || 0,
      gl: 0,
      as: 0,
      ap: 0,
      rs: 0,
      en: 100,
      plan: 1,
      rep: 10,
      ntCaps: 0,
      ntGoals: 0,
      perks: [],
      careerLog: []
    };
    const t = teams[meId];
    const i = t.sq.findIndex((q) => q.pos === p.pos);
    const ov = ovMe(s.p);
    const ki = SKIN_P.indexOf(p.k);
    const hi = HAIR_P.indexOf(p.h);
    t.sq.splice(i >= 0 ? i : 0, 1, {
      n: p.name,
      pos: p.pos,
      ro: p.sp,
      sp: 0,
      ov,
      age: 17,
      pot: clamp(R(87, 95), ov + 18, 95),
      fit: 100,
      inj: 0,
      no: chosenNo,
      me: 1,
      vis: [ki >= 0 ? ki : 2, hi >= 0 ? hi : 0, p.hs ?? 0, p.fh ?? 0, p.ey ?? 0, chosenNo, p.fs ?? 0]
    });
    assignTeamShirtNumbers(t);
  }

  startSeason(s);
  return s;
}

export function startSeason(s: GameState) {
  s.teams.forEach((t) => {
    t.sq = t.sq.filter((q) => !q.loan);
    Object.assign(t, { pts: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, p: 0, fm: '' });
    t.sq.forEach((q) => {
      q.fit = 100;
      q.inj = 0;
      q.sus = 0;
      q.yc = 0;
      q.rc = 0;
      q.sg = 0;
      q.sa = 0;
      q.sp = 0;
      q.cs = 0;
    });
    assignTeamShirtNumbers(t);
  });

  if (s.p) {
    s.p.en = 100;
    s.p.gd = 0;
    s.p.yc = 0;
    s.p.rc = 0;
    s.p.sus = 0;
    s.p.s0 = { gl: s.p.gl, as: s.p.as, ap: s.p.ap };
  }

  const mt = s.teams[s.me].tier;
  s.fx = doubleRoundRobin(s.teams.filter((t) => t.tier === mt).map((t) => t.id));
  s.fxo = {};
  [0, 1, 2]
    .filter((i) => i !== mt)
    .forEach((i) => {
      s.fxo![i] = doubleRoundRobin(s.teams.filter((t) => t.tier === i).map((t) => t.id));
    });
  s.md = 0;
  s.pc = false;
  s.cup = {
    alive: true,
    r: 0,
    done: false,
    log: [],
    ids: [
      s.me,
      ...s.teams
        .filter((t) => t.id !== s.me && t.tier < 3)
        .map((t) => t.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 15)
    ].sort(() => Math.random() - 0.5)
  };
  initAsia(s);
  mkMarket(s);
  s.schedRes = {};
  s.cupLog = [];
  if (s.mode === 'm') setBoardObjective(s);
}

export function sTeamSafe(h: Team, a: Team, id: number): Team | null {
  if (h.id === id) return h;
  if (a.id === id) return a;
  return null;
}

export function tallyMatchPlayers(h: Team, a: Team, r: MatchResult) {
  [
    [h, r.ga],
    [a, r.gh]
  ].forEach(([tm, ga]) => {
    const team = tm as Team;
    const starterSet = xi(team);
    const playedList = r.playedNames?.[team.id]?.length
      ? team.sq.filter((q) => r.playedNames![team.id].includes(q.n))
      : starterSet;
    playedList.forEach((q) => {
      q.sp = (q.sp || 0) + 1;
      if (q.pos === 'GK' && (ga as number) === 0 && starterSet.includes(q)) q.cs = (q.cs || 0) + 1;
    });
  });
  r.evs.forEach((e) => {
    const t = sTeamSafe(h, a, e.t);
    if (!t) return;
    const q = t.sq.find((z) => z.n === e.who);
    if (q) q.sg = (q.sg || 0) + 1;
    const w = e.as && t.sq.find((z) => z.n === e.as);
    if (w) w.sa = (w.sa || 0) + 1;
  });
}

export function applyMatchCards(s: GameState, h: Team, a: Team, cards?: MatchCardEvent[]) {
  if (!cards || !cards.length) return;
  cards.forEach((c) => {
    const tm = sTeamSafe(h, a, c.t);
    if (!tm) return;
    const q = tm.sq.find((z) => z.n === c.who);
    if (!q) return;
    const isMyTeam = tm.id === s.me;
    if (c.type === 'R') {
      q.rc = (q.rc || 0) + 1;
      q.sus = (q.sus || 0) + 2;
      if (isMyTeam) {
        pushFeed(s, 'โดนแบน', `🟥 ${q.n} โดนใบแดงโดยตรง! ติดโทษแบน 2 นัด`, 'urg');
      }
    } else if (c.type === 'Y2R') {
      q.rc = (q.rc || 0) + 1;
      q.sus = (q.sus || 0) + 1;
      if (isMyTeam) {
        pushFeed(s, 'โดนแบน', `🟨🟨➡🟥 ${q.n} โดนใบเหลือง-แดง! ติดโทษแบน 1 นัด`, 'urg');
      }
    } else {
      q.yc = (q.yc || 0) + 1;
      if (q.yc >= 3) {
        q.yc -= 3;
        q.sus = (q.sus || 0) + 1;
        if (isMyTeam) {
          pushFeed(s, 'โดนแบน', `🟨 ${q.n} สะสมครบ 3 ใบเหลือง! ติดโทษแบนนัดหน้า 1 นัด`, 'urg');
        }
      }
    }
    if (q.me && s.p) {
      s.p.yc = q.yc || 0;
      s.p.rc = q.rc || 0;
      s.p.sus = q.sus || 0;
    }
  });
}

export function calcPlayerPerf(
  s: GameState,
  r: MatchResult,
  H: Team,
  _A: Team,
  matchRatings?: Record<string, number>,
  meta?: { played: boolean; mins: number; subIn: boolean; subOut: boolean; yc: number; rc: number }
): PlayerPerfResult {
  const p = s.p!;
  const home = H.id === s.me;
  const my = home ? r.gh : r.ga;
  const op = home ? r.ga : r.gh;
  const played = meta ? meta.played : true;
  const mins = meta ? meta.mins : 90;
  const gl = r.evs.filter((e) => e.t === s.me && e.who === p.name).length;
  const as = r.evs.filter((e) => e.t === s.me && e.as === p.name).length;
  const en = p.en ?? 100;
  const vid = p.vid || 0;

  if (!played || mins <= 0) {
    return {
      rt: 0,
      gl: 0,
      as: 0,
      my,
      op,
      vid: 0,
      en,
      pts: 0,
      played: false,
      mins: 0,
      subIn: false,
      subOut: false,
      yc: 0,
      rc: 0
    };
  }

  const bk = p.pos === 'GK' || p.pos === 'DF';
  const perks = p.perks || [];
  const bigBonus = perks.includes('clutch') && (s.pc || s.pa || s.derby) ? 0.5 : 0;
  const fanBonus = perks.includes('captain') ? ((s.fan ?? 50) - 50) / 140 : ((s.fan ?? 50) - 50) / 250;
  const mePlayer: Player = s.teams[s.me]?.sq.find((q) => q.me) || {
    n: p.name, pos: p.pos, ro: p.sp, ov: ovMe(p), age: p.age, pot: 95, fit: en, inj: 0, me: 1
  };
  const D = DT(mePlayer, p);
  const subEdge =
    p.pos === 'FW'
      ? (D.d.fin * 0.35 + D.d.run * 0.25 + D.d.pw * 0.15 + D.d.cur * 0.15 + D.d.spd * 0.1 - 60) / 90
      : p.pos === 'MF'
        ? (D.a.ps * 0.3 + D.a.dr * 0.2 + D.d.crs * 0.2 + D.d.rd * 0.15 + D.d.sta * 0.15 - 60) / 90
        : p.pos === 'DF'
          ? (D.d.rd * 0.25 + D.d.pos * 0.25 + D.d.mrk * 0.2 + D.d.blk * 0.15 + D.d.hd * 0.15 - 60) / 90
          : (D.d.sv * 0.45 + D.d.cl * 0.3 + D.d.dist * 0.15 + D.d.comp * 0.1 - 60) / 90;

  const baseRt =
    matchRatings?.[p.name] != null
      ? matchRatings[p.name]
      : 6.2 +
        (my > op ? 0.5 : my < op ? -0.4 : 0) +
        gl * 0.9 +
        as * 0.6 +
        (bk ? (op === 0 ? 0.6 : op >= 3 ? -0.5 : 0) : 0) +
        clamp((ovMe(p) - 60) / 70, -0.4, 0.5) +
        subEdge +
        (Math.random() - 0.5) * 0.8;

  const minAdj = mins < 35 ? -0.2 : 0;
  const cardPenalty = (meta?.yc || 0) * 0.25 + (meta?.rc || 0) * 1.4;
  let rt =
    baseRt +
    (en - 70) / 140 +
    (D.d.tol - 65) / 350 +
    vid +
    bigBonus +
    fanBonus +
    minAdj -
    cardPenalty;

  rt = clamp(Math.round(rt * 10) / 10, 3.8, 10);
  const b = () => (Math.random() < (mins >= 60 ? 0.42 : 0.28) ? 1 : 0);
  return {
    rt,
    gl,
    as,
    my,
    op,
    vid,
    en,
    pts: b() + (rt >= 7 ? b() : 0) + (rt >= 8.5 ? b() : 0),
    played: true,
    mins,
    subIn: meta?.subIn,
    subOut: meta?.subOut,
    yc: meta?.yc || 0,
    rc: meta?.rc || 0
  };
}

export function creditPlayerPerf(s: GameState, f: PlayerPerfResult) {
  const p = s.p!;
  if (f.played === false) {
    p.vid = 0;
    p.sat = 1;
    syncMe(s);
    return;
  }
  p.sat = 0;
  p.ap++;
  p.fm = [...(p.fm || []), f.rt].slice(-5);
  p.rs += f.rt;
  p.gl += f.gl;
  p.as += f.as;
  p.rep = (p.rep || 0) + (f.rt >= 7.5 ? 3 : f.rt >= 6.8 ? 1 : 0) + f.gl * 2 + f.as;
  if (f.pts > 0) f.grew = autoGrow(p, f.pts);
  p.vid = 0;
  const fanGain = (p.perks || []).includes('captain') ? 3 : 2;
  s.fan = clamp((s.fan ?? 50) + (f.my > f.op ? fanGain : f.my < f.op ? -2 : 0) + (f.gl ? 1 : 0), 5, 100);
  syncMe(s);
}

export function runPlayerWeek(s: GameState) {
  const p = s.p!;
  const ac = PACT[p.plan ?? 1] || PACT[1];
  const perks = p.perks || [];
  const mePlayer: Player = s.teams[s.me]?.sq.find((q) => q.me) || {
    n: p.name, pos: p.pos, ro: p.sp, ov: ovMe(p), age: p.age, pot: 95, fit: p.en ?? 100, inj: 0, me: 1
  };
  const D = DT(mePlayer, p);
  const staBonus = Math.round((D.d.sta - 65) / 7);
  const recBonus = Math.round((D.d.rec - 65) / 8);
  const tolBonus = Math.round((D.d.tol - 65) / 14);
  const baseFatigue = p.sat ? -8 : perks.includes('engine') ? -16 : -22;
  const fatigueCost = Math.min(-4, baseFatigue + staBonus + tolBonus);
  p.en = clamp((p.en ?? 100) + fatigueCost + ac.en + recBonus + R(0, 7), 20, 100);
  let m = `${ac.i} ${ac.n}`;
  const focus = ({ FW: 'sh', MF: 'ps', DF: 'tk', GK: 'ph' } as Record<Position, StatKey>)[p.pos] || 'sh';
  const prodigyBonus = perks.includes('prodigy') ? 0.1 : 0;

  if (ac.gr) {
    const k = ac.k || P([focus, focus, p.tr || 'sh', P(['sh', 'ps', 'dr', 'tk', 'ph'] as StatKey[])]);
    const kn = ATT.find((z) => z[0] === k)?.[1] || k;
    if (p.a[k] < 99 && Math.random() < ac.gr + prodigyBonus + (p.tr === k || (p.tr === 'tk' && k === 'ph') ? 0.06 : 0)) {
      p.a[k]++;
      p.trn = (p.trn || 0) + 1;
      m += ` · ${kn} เพิ่มเป็น ${p.a[k]}`;
    } else {
      m += ' · ยังไม่ก้าวหน้าในรอบนี้';
    }
  }
  if (ac.vid) {
    p.vid = ac.vid;
    m += ' · นัดหน้าได้เปรียบ';
  }
  if (ac.fan) {
    s.fan = clamp((s.fan ?? 50) + ac.fan, 5, 100);
    m += ` · ขวัญแฟนบอล ${s.fan}%`;
  }
  if (ac.pt && Math.random() < ac.pt + prodigyBonus) {
    const g = autoGrow(p, 1);
    if (g) m += ` · พัฒนาอัตโนมัติ (${g})`;
  }
  if ((p.inj || 0) > 0) {
    const healStep = p.plan === 2 ? 2 : 1;
    p.inj = Math.max(0, (p.inj || 0) - healStep);
    m += p.inj === 0 ? ' · 🩹 หายเจ็บพร้อมลงสนาม!' : ` · 🩹 พักฟื้นเหลือ ${p.inj} นัด`;
  }
  const meSq = s.teams[s.me]?.sq.find((q) => q.me);
  if (meSq) {
    const trainMissionNotes = applyTrainingMissionProgress(meSq, {
      careerPlan: p.plan ?? 1,
      careerP: p
    });
    if (trainMissionNotes.length) m += ` · 🎯 ${trainMissionNotes[0]}`;
  }
  p.last = m;
  s.news = (s.news ? s.news + ' · ' : '') + m;
  syncMe(s);
}

export function createScoutMission(focus: ScoutMission['focus'], targetRole?: SubRole | ''): ScoutMission {
  const labels: Record<ScoutMission['focus'], string> = {
    wonderkid: 'ส่องดาวรุ่งพรสวรรค์สูง (U20)',
    free: 'ค้นหานักเตะฟรีเอเยนต์ฝีเท้าดี',
    gk: 'เฟ้นหาผู้รักษาประตู (GK)',
    striker: 'เฟ้นหากองหน้าตัวจบสกอร์',
    midfielder: 'เฟ้นหากองกลางจอมคุมเกม',
    defender: 'เฟ้นหากองหลังครบทุกตำแหน่ง'
  };
  const roleLabel = targetRole ? `ส่องตำแหน่ง ${targetRole} (${SPN[targetRole] || targetRole})` : labels[focus];
  return {
    id: `${focus}_${targetRole || 'any'}_${Date.now()}`,
    focus,
    targetRole: targetRole || '',
    label: roleLabel,
    turnsLeft: 2
  };
}

export function resolveScoutResults(s: GameState, m: ScoutMission): Player[] {
  const scoutStaff = getStaffState(s).scout;
  const b0 = BASE[s.teams[s.me].tier] + (s.ya ?? 1) * 2 + scoutStaff * 2;
  return Array.from({ length: 3 }, (_, idx) => {
    let pos: Position = P(POS);
    let forceRo: SubRole | undefined;
    let yo = false;
    let boost = R(2, 9);

    if (m.targetRole) {
      forceRo = m.targetRole;
      pos = LINE[m.targetRole] || 'MF';
    } else if (m.focus === 'wonderkid') {
      yo = true;
      boost = R(4, 10 + scoutStaff);
      forceRo = P(ALL_SUB_ROLES.filter((r) => r !== 'GK'));
      pos = LINE[forceRo] || 'MF';
    } else if (m.focus === 'gk') {
      pos = 'GK';
      forceRo = 'GK';
    } else if (m.focus === 'striker') {
      pos = 'FW';
      forceRo = SPX.FW[(idx + R(0, 4)) % SPX.FW.length];
    } else if (m.focus === 'midfielder') {
      pos = 'MF';
      forceRo = SPX.MF[(idx + R(0, 4)) % SPX.MF.length];
    } else if (m.focus === 'defender') {
      pos = 'DF';
      forceRo = SPX.DF[(idx + R(0, 4)) % SPX.DF.length];
    }

    const p = mkPlayer(pos, b0 + boost, yo, forceRo);
    if (m.focus === 'wonderkid') p.pot = clamp(Math.max(p.pot, p.ov + R(12, 24)), p.ov, 96);
    if (m.focus === 'free') {
      p.free = 1;
      p.price = 0;
    } else {
      p.price = Math.round((p.ov * p.ov) / 40);
    }
    p.askWg = +((p.ov * p.ov) / 3000).toFixed(1);
    p.scouted = true;
    p.tries = 0;
    p.locked = 0;
    return p;
  });
}

export const DILEMMAS: DilemmaTemplate[] = [
  {
    id: 'bench_unhappy',
    mode: 'm',
    category: 'ห้องแต่งตัว',
    title: '🗣️ นักเตะสำรองขอลงตัวจริง',
    desc: (s) => {
      const me = s.teams[s.me];
      const bn = me.sq.filter((q) => !xi(me).includes(q)).sort((a, b) => b.ov - a.ov)[0];
      return `${bn ? bn.n : 'นักเตะสำรอง'} เข้ามาคุยกับคุณว่าอยากได้โอกาสลงสนามมากขึ้นในสัปดาห์นี้`;
    },
    options: [
      {
        label: 'ให้คำมั่นว่าจะโรเตชั่นนัดหน้า',
        hint: 'ขวัญทีม +6%',
        apply: (s) => {
          s.mor = clamp((s.mor ?? 50) + 6, 0, 100);
          return 'ทีมมีกำลังใจดีขึ้น (ขวัญทีม +6%)';
        }
      },
      {
        label: 'บอกให้พิสูจน์ตัวเองในการซ้อม',
        hint: 'นักเตะสำรองพลัง +1',
        apply: (s) => {
          const me = s.teams[s.me];
          const bn = me.sq.filter((q) => !xi(me).includes(q)).sort((a, b) => b.ov - a.ov)[0];
          if (bn && bn.ov < (bn.pot || 90)) bn.ov++;
          return bn ? `${bn.n} ตั้งใจซ้อมหนักจนพัฒนาพลัง +1` : 'นักเตะตั้งใจซ้อมมากขึ้น';
        }
      },
      {
        label: 'จัดซ้อมพิเศษปรับความเข้าใจ',
        hint: 'งบ -10k · ความคุ้นเคยแผน +8%',
        apply: (s) => {
          s.money -= 10;
          logFin(s, 'กิจกรรมปรับความเข้าใจในทีม', -10);
          s.teams[s.me].tacFam = clamp((s.teams[s.me].tacFam ?? 65) + 8, 20, 100);
          return 'ความเข้าใจแผนการเล่นเพิ่มขึ้น (+8%)';
        }
      }
    ]
  },
  {
    id: 'local_sponsor',
    mode: 'm',
    category: 'ธุรกิจสโมสร',
    title: '🏪 ธุรกิจท้องถิ่นชวนออกงาน',
    desc: () => 'ห้างร้านในจังหวัดติดต่อขอให้นักเตะไปร่วมกิจกรรมเปิดสาขา แลกค่าตอบแทนพิเศษ',
    options: [
      {
        label: 'ส่งนักเตะไปร่วมงานรับเงินก้อน',
        hint: 'งบ +40k · ฟิตตัวจริง -5%',
        apply: (s) => {
          s.money += 40;
          logFin(s, 'ค่าตัวออกงานสปอนเซอร์', 40);
          xi(s.teams[s.me]).forEach((q) => {
            q.fit = clamp((q.fit ?? 100) - 5, 30, 100);
          });
          return 'รับเงินสนับสนุน +40k ฿ (นักเตะล้าลงเล็กน้อย)';
        }
      },
      {
        label: 'ปฏิเสธเพื่อโฟกัสการฝึกซ้อม',
        hint: 'ฟิต +4% · บอร์ด +3%',
        apply: (s) => {
          s.teams[s.me].sq.forEach((q) => {
            q.fit = clamp((q.fit ?? 100) + 4, 30, 100);
          });
          s.bd = clamp((s.bd ?? 50) + 3, 0, 100);
          return 'นักเตะได้พักซ้อมเต็มที่ (ฟิต +4%, บอร์ด +3%)';
        }
      }
    ]
  },
  {
    id: 'youth_trial',
    mode: 'm',
    category: 'อะคาเดมี่',
    title: '🌟 พบเพชรเม็ดงามจากบอลนักเรียน',
    desc: () => 'แมวมองท้องถิ่นแจ้งว่ามีเด็กหนุ่มฝีเท้าจัดจ้านอยากมาทดสอบฝีเท้ากับสโมสร (ค่าดำเนินการ 25k)',
    options: [
      {
        label: 'รับเข้าสู่ชุดสำรองทันที (-25k)',
        hint: 'ได้ดาวรุ่งศักยภาพสูงเข้าทีม',
        apply: (s) => {
          const me = s.teams[s.me];
          if (s.money < 25 || me.sq.length >= 28) return 'งบไม่พอหรือทีมเต็ม 28 คนแล้ว';
          s.money -= 25;
          logFin(s, 'ค่าธรรมเนียมเซ็นดาวรุ่งบอลนักเรียน', -25);
          const y = mkPlayer(P(POS), BASE[me.tier] + 3, true);
          y.pot = clamp(R(84, 94), y.ov + 10, 95);
          y.con = { yr: 4, wg: wagOf(y), role: 'pro' };
          me.sq.push(y);
          return `เซ็น ${y.n} (${y.pos} ${y.ov}) ดาวรุ่งเข้าทีมแล้ว!`;
        }
      },
      {
        label: 'ส่งเข้าลิสต์เยาวชนรอเซ็นฟรี',
        hint: 'เพิ่มในรายชื่อเยาวชนอะคาเดมี่',
        apply: (s) => {
          const me = s.teams[s.me];
          const y = mkPlayer(P(POS), BASE[me.tier] - 2, true);
          s.yth.push(y);
          return `เพิ่ม ${y.n} ในรายชื่อเยาวชนอะคาเดมี่แล้ว`;
        }
      }
    ]
  },
  {
    id: 'media_interview',
    mode: 'both',
    category: 'สื่อมวลชน',
    title: '🎙️ นักข่าวขอสัมภาษณ์ก่อนเกม',
    desc: () => 'สื่อกีฬาเจ้าใหญ่ถามถึงเป้าหมายของทีมในฤดูกาลนี้ คุณจะตอบอย่างไร?',
    options: [
      {
        label: 'ประกาศกร้าวว่าพร้อมลุ้นแชมป์!',
        hint: 'แฟน +5% · ขวัญ +4%',
        apply: (s) => {
          s.fan = clamp((s.fan ?? 50) + 5, 5, 100);
          s.mor = clamp((s.mor ?? 50) + 4, 0, 100);
          return 'แฟนบอลคึกคักสุดขีด! (แฟน +5%, ขวัญ +4%)';
        }
      },
      {
        label: 'ถ่อมตัว เน้นทำผลงานทีละนัด',
        hint: 'บอร์ด +3% · ลดความกดดันทีม',
        apply: (s) => {
          s.bd = clamp((s.bd ?? 50) + 3, 0, 100);
          if (s.p) s.p.en = clamp((s.p.en ?? 100) + 4, 20, 100);
          return 'คำตอบสุขุมได้รับคำชม (ความเชื่อมั่น +3%)';
        }
      }
    ]
  },
  {
    id: 'player_charity',
    mode: 'p',
    category: 'นอกสนาม',
    title: '🤝 คลินิกฟุตบอลเยาวชนท้องถิ่น',
    desc: () => 'โรงเรียนใกล้สนามชวนคุณไปสอนทักษะฟุตบอลให้น้องๆ ในวันหยุด',
    options: [
      {
        label: 'ไปร่วมกิจกรรมอย่างเต็มใจ',
        hint: 'ชื่อเสียง +5 · แฟน +6% · พลังกาย -6%',
        apply: (s) => {
          if (s.p) {
            s.p.rep = (s.p.rep || 0) + 5;
            s.p.en = clamp((s.p.en ?? 100) - 6, 20, 100);
          }
          s.fan = clamp((s.fan ?? 50) + 6, 5, 100);
          return 'คุณกลายเป็นขวัญใจเยาวชน! (ชื่อเสียง +5, แฟน +6%)';
        }
      },
      {
        label: 'ขอตัวฝึกซ้อมเสริมคนเดียว',
        hint: 'พัฒนาค่าพลัง +1',
        apply: (s) => {
          const g = s.p ? autoGrow(s.p, 1) : '';
          syncMe(s);
          return g ? `ซ้อมเดี่ยวได้ผล! (${g})` : 'ได้ฝึกซ้อมรักษาฟอร์มเต็มที่';
        }
      }
    ]
  }
];

export function maybeTriggerDilemma(s: GameState) {
  if (s.dilemma) return;
  if ((s.dilemmaCd ?? 0) > 0) {
    s.dilemmaCd = (s.dilemmaCd || 1) - 1;
    return;
  }
  if (Math.random() < 0.22) {
    const pool = DILEMMAS.filter((d) => d.mode === 'both' || d.mode === s.mode);
    const pick = P(pool);
    s.dilemma = {
      id: pick.id,
      title: pick.title,
      desc: pick.desc(s),
      category: pick.category,
      options: pick.options.map((o) => ({ label: o.label, hint: o.hint }))
    };
    s.dilemmaCd = 4;
  }
}

export function applyDilemmaChoice(s: GameState, optIndex: number): string {
  if (!s.dilemma) return '';
  const tmpl = DILEMMAS.find((d) => d.id === s.dilemma!.id);
  const opt = tmpl?.options[optIndex];
  const msg = opt ? opt.apply(s) : '';
  s.dilemma = null;
  if (msg) pushFeed(s, 'เหตุการณ์', msg, 'ok');
  return msg;
}

export const pickWinner = (h: Team, a: Team, r: MatchResult, s?: GameState | null) =>
  r.gh !== r.ga
    ? r.gh > r.ga
      ? h
      : a
    : r.pen != null
      ? r.pen
        ? h
        : a
      : Math.random() < 0.5 + (rate(h, s).at - rate(a, s).at) / 200
        ? h
        : a;

export function simulateCpuAsiaRound(s: GameState) {
  const c = s.ac;
  if (!c || c.done) return;
  const nx: number[] = [];
  for (let i = 0; i < c.ids.length; i += 2) {
    const H = s.teams[c.ids[i]];
    const A = s.teams[c.ids[i + 1]];
    const r = simMatch(H, A, s);
    const w = pickWinner(H, A, r, s);
    nx[i / 2] = w.id;
    c.log.push(`${RN[c.r]}: ${H.name} ${r.gh}-${r.ga} ${A.name}`);
  }
  c.ids = nx;
  c.r++;
  s.pa = false;
  if (c.alive && !nx.includes(s.me)) c.alive = false;
  if (nx.length === 1) {
    c.done = true;
    const w = nx[0];
    if (c.p.includes(s.me)) {
      s.hist.push(`🌏 ซีซั่น ${s.season}: บอลถ้วยในทวีป ${w === s.me ? 'แชมป์!' : `ตกรอบ (${s.teams[w].name} แชมป์)`}`);
    }
    if (w === s.me && s.mode === 'm') {
      s.money += 500;
      logFin(s, 'รางวัลแชมป์ทวีป', 500);
      s.trophies = [...(s.trophies || []), { season: s.season, title: 'แชมป์สโมสรทวีป', type: 'asia' }];
      s.mgrRep = (s.mgrRep || 50) + 120;
    }
  }
}

export function simulateCpuCupRound(s: GameState) {
  const c = s.cup;
  if (!c || c.done) return;
  const nx: number[] = [];
  for (let i = 0; i < c.ids.length; i += 2) {
    const H = s.teams[c.ids[i]];
    const A = s.teams[c.ids[i + 1]];
    const r = simMatch(H, A, s);
    const w = pickWinner(H, A, r, s);
    nx[i / 2] = w.id;
    c.log.push(`${RN[c.r]}: ${H.name} ${r.gh}-${r.ga} ${A.name}`);
  }
  c.ids = nx;
  c.r++;
  s.pc = false;
  if (c.alive && !nx.includes(s.me)) c.alive = false;
  if (nx.length === 1) {
    c.done = true;
    const w = nx[0];
    if (w === s.me && s.mode === 'm') {
      s.money += 250;
      logFin(s, 'รางวัลแชมป์ถ้วยประชาชน', 250);
      s.trophies = [...(s.trophies || []), { season: s.season, title: 'แชมป์ถ้วยประชาชน', type: 'cup' }];
      s.mgrRep = (s.mgrRep || 50) + 75;
    }
  }
}

export function getIncomingOffers(s: GameState): TransferOffer[] {
  const me = s.teams[s.me];
  if (!me) return [];
  const raw: TransferOffer[] = [];
  if (Array.isArray(s.offers)) raw.push(...s.offers);
  if (s.off) raw.push(s.off);
  const seen = new Set<string>();
  const valid: TransferOffer[] = [];
  raw.forEach((o) => {
    if (!o || !o.n || !o.t) return;
    if (!me.sq.some((q) => q.n === o.n)) return;
    const key = `${o.n}__${o.teamId ?? o.t}`;
    if (seen.has(key)) return;
    seen.add(key);
    valid.push(o);
  });
  return valid;
}

export function syncOffersField(s: GameState, list: TransferOffer[]) {
  s.offers = list;
  s.off = list[0] || null;
}

export function addIncomingOffer(s: GameState, off: TransferOffer) {
  const list = getIncomingOffers(s).filter(
    (x) => !(x.n === off.n && (x.teamId != null && off.teamId != null ? x.teamId === off.teamId : x.t === off.t))
  );
  list.unshift(off);
  syncOffersField(s, list.slice(0, 4));
}

export function removeIncomingOffer(s: GameState, playerName: string, clubName?: string) {
  const list = getIncomingOffers(s).filter((x) => {
    if (x.n !== playerName) return true;
    if (!clubName) return false;
    return x.t !== clubName;
  });
  syncOffersField(s, list);
}

export function getPlayerSellCheck(s: GameState, me: Team, q: Player) {
  const tx = getLeagueTransferContext(s, me);
  const sameDayLock = q.signedSeason === s.season && q.signedMd === s.md;
  const minRequired = tx.minPos[q.pos];
  const samePosCount = tx.posCounts[q.pos];
  const turnKey = s.season * 40 + s.md;
  const pitchedThisTurn = q.offerCoolMd === turnKey;
  let reason = '';
  if (!tx.tw.open) reason = `ตลาดปิดอยู่! ขายได้เฉพาะช่วง ${tx.tw.rangeText} (กด 🏷️ ขึ้นบัญชีขายรอไว้ได้)`;
  else if (q.loan) reason = 'นักเตะยืมตัวไม่สามารถขายได้';
  else if (q.inj > 0) reason = 'นักเตะบาดเจ็บอยู่ ยังปล่อยตัวไม่ได้จนกว่าจะหาย';
  else if (sameDayLock) reason = 'เพิ่งเซ็นสัญญานัดนี้ ขายต่อทันทีไม่ได้ตามกฎลีก';
  else if (me.sq.length <= tx.minSquad) reason = `ขนาดทีมต้องมีอย่างน้อย ${tx.minSquad} คนตามกฎลีก`;
  else if (samePosCount <= minRequired) reason = `ต้องเหลือนักเตะ ${q.pos} อย่างน้อย ${minRequired} คน`;
  return {
    twOpen: tx.tw.open,
    sameDayLock,
    minRequired,
    samePosCount,
    pitchedThisTurn,
    canList: !q.loan,
    canPitch:
      tx.tw.open &&
      !q.loan &&
      q.inj === 0 &&
      !sameDayLock &&
      me.sq.length > tx.minSquad &&
      samePosCount > minRequired,
    reason
  };
}

export function canAcceptTransferOffer(s: GameState, off: TransferOffer): { ok: boolean; err?: string; buyerName?: string } {
  const me = s.teams[s.me];
  const tx = getLeagueTransferContext(s, me);
  if (!tx.tw.open) return { ok: false, err: `ตลาดซื้อขายปิดแล้ว (${tx.tw.rangeText})` };
  const q = me.sq.find((x) => x.n === off.n);
  if (!q) return { ok: false, err: 'ไม่พบนักเตะคนนี้ในทีมแล้ว' };
  if (q.loan) return { ok: false, err: 'นักเตะยืมตัวขายไม่ได้' };
  if (me.sq.length <= tx.minSquad || tx.posCounts[q.pos] <= tx.minPos[q.pos]) {
    return { ok: false, err: `ขายไม่ได้ ต้องเหลือขนาดทีม ≥ ${tx.minSquad} และ ${q.pos} ≥ ${tx.minPos[q.pos]}` };
  }
  const buyer =
    (off.teamId != null ? s.teams.find((tm) => tm.id === off.teamId) : undefined) ||
    s.teams.find((tm) => tm.name === off.t);
  return { ok: true, buyerName: buyer?.name || off.t };
}

export function acceptTransferOffer(d: GameState, off: TransferOffer): { ok: boolean; err?: string; buyerName?: string } {
  const chk = canAcceptTransferOffer(d, off);
  if (!chk.ok) return chk;
  const me = d.teams[d.me];
  const idx = me.sq.findIndex((q) => q.n === off.n);
  if (idx < 0) return { ok: false, err: 'ไม่พบนักเตะคนนี้ในทีมแล้ว' };
  const sold = me.sq.splice(idx, 1)[0];
  me.lu = null;
  if (me.cap === sold.n) me.cap = '';
  if (d.focusPlayer === sold.n) d.focusPlayer = null;
  delete sold.listed;
  delete sold.askPrice;
  delete sold.offerCoolMd;
  sold.no = undefined;
  sold.signedSeason = d.season;
  sold.signedMd = d.md;

  const buyer =
    (off.teamId != null ? d.teams.find((tm) => tm.id === off.teamId) : undefined) ||
    d.teams.find((tm) => tm.name === off.t);
  if (buyer && buyer.id !== d.me && buyer.sq.length < LEAGUE_TRANSFER_RULES.maxSquad) {
    buyer.sq.push(sold);
    buyer.lu = null;
    assignTeamShirtNumbers(buyer);
  }

  const buyerName = buyer?.name || off.t;
  d.money += off.p;
  logFin(d, `ขาย ${off.n} ให้ ${buyerName}`, off.p);
  pushFeed(d, 'ตลาดซื้อขาย', `✅ ขาย ${off.n} ให้ ${buyerName} รับค่าตัว +${fmtMoney(off.p)}`, 'ok');
  removeIncomingOffer(d, off.n);
  return { ok: true, buyerName };
}

export function resolveCounterOfferOutcome(s: GameState, off: TransferOffer): { accepted: boolean; newPrice?: number } {
  const me = s.teams[s.me];
  const q = me.sq.find((x) => x.n === off.n);
  const fairVal = q ? vlu(q) : off.p;
  const acceptProb = off.p < fairVal ? 0.68 : 0.56;
  if (Math.random() < acceptProb) {
    return { accepted: true, newPrice: Math.max(off.p + 2, Math.round(off.p * 1.15)) };
  }
  return { accepted: false };
}

export function applyCounterOfferOutcome(d: GameState, off: TransferOffer, out: { accepted: boolean; newPrice?: number }) {
  if (out.accepted && out.newPrice != null) {
    const list = getIncomingOffers(d).map((item) =>
      item.n === off.n && item.t === off.t ? { ...item, p: out.newPrice!, cnt: 1 } : item
    );
    syncOffersField(d, list);
  } else {
    removeIncomingOffer(d, off.n, off.t);
  }
}

export function resolvePitchPlayerOutcome(
  s: GameState,
  playerName: string,
  askPct: number
): { ok: boolean; askPrice: number; turnKey: number; offers: TransferOffer[]; err?: string } {
  const me = s.teams[s.me];
  const q = me.sq.find((x) => x.n === playerName);
  if (!q) return { ok: false, askPrice: 0, turnKey: 0, offers: [], err: 'ไม่พบนักเตะในทีม' };
  const chk = getPlayerSellCheck(s, me, q);
  if (!chk.canPitch) return { ok: false, askPrice: 0, turnKey: 0, offers: [], err: chk.reason || 'ยังไม่สามารถเสนอขายได้ในตอนนี้' };
  const turnKey = s.season * 40 + s.md;
  if (q.offerCoolMd === turnKey) {
    return { ok: false, askPrice: 0, turnKey, offers: [], err: 'เสนอนักเตะคนนี้ให้สโมสรอื่นไปแล้วในนัดนี้ ลองใหม่หลังจบแมตช์หน้าหรือรอข้อเสนออัตโนมัติ' };
  }

  const marketVal = Math.max(5, vlu(q));
  const askPrice = Math.max(5, Math.round((marketVal * askPct) / 100));

  const existingBuyerNames = new Set(
    getIncomingOffers(s)
      .filter((o) => o.n === q.n)
      .map((o) => o.t)
  );
  const candidates = s.teams
    .filter(
      (tm) =>
        tm.id !== s.me &&
        tm.sq.length < LEAGUE_TRANSFER_RULES.maxSquad &&
        !existingBuyerNames.has(tm.name) &&
        Math.abs(tm.tier - me.tier) <= 1
    )
    .sort((a, b) => Math.abs(a.tier - me.tier) - Math.abs(b.tier - me.tier) || Math.random() - 0.5)
    .slice(0, 6);

  const created: TransferOffer[] = [];
  const baseInterest = askPct <= 90 ? 0.62 : askPct <= 105 ? 0.42 : 0.24;
  const ageBonus = q.age <= 24 ? 0.12 : q.age >= 32 ? -0.1 : 0;
  const ovBonus = q.ov >= 70 ? 0.1 : 0;

  for (const opp of candidates) {
    if (created.length >= 2) break;
    const posNeed = opp.sq.filter((z) => z.pos === q.pos).length <= (LEAGUE_TRANSFER_RULES.minPos[q.pos] + 2) ? 0.12 : 0;
    const prob = clamp(baseInterest + ageBonus + ovBonus + posNeed, 0.14, 0.85);
    if (Math.random() < prob) {
      const bidMult =
        askPct <= 90
          ? 0.94 + Math.random() * 0.12
          : askPct <= 105
            ? 0.9 + Math.random() * 0.15
            : 0.86 + Math.random() * 0.16;
      const bidPrice = Math.max(5, Math.round(askPrice * bidMult));
      created.push({ n: q.n, p: bidPrice, t: opp.name, teamId: opp.id });
    }
  }

  return { ok: true, askPrice, turnKey, offers: created };
}

export function applyPitchPlayerOutcome(
  d: GameState,
  playerName: string,
  outcome: { ok: boolean; askPrice: number; turnKey: number; offers: TransferOffer[] }
) {
  if (!outcome.ok) return;
  const q = d.teams[d.me]?.sq.find((x) => x.n === playerName);
  if (!q) return;
  q.listed = 1;
  q.askPrice = outcome.askPrice;
  q.offerCoolMd = outcome.turnKey;
  outcome.offers.forEach((off) => addIncomingOffer(d, off));

  if (outcome.offers.length > 0) {
    pushFeed(
      d,
      'ข้อเสนอ',
      `💼 เสนอขาย ${q.n} (${fmtMoneyNum(outcome.askPrice)}) — มี ${outcome.offers.length} ทีมยื่นซื้อเข้ามาแล้ว!`,
      'offer'
    );
  } else {
    pushFeed(
      d,
      'ตลาดซื้อขาย',
      `🏷️ ขึ้นบัญชีขาย ${q.n} (${fmtMoneyNum(outcome.askPrice)}) แล้ว ยังไม่มีทีมยื่นข้อเสนอในทันที`,
      ''
    );
  }
}

export function afterMatchDay(s: GameState, liveInjMeta?: { teamIds?: number[]; playerNames?: string[] }) {
  const me = s.teams[s.me];
  const mg = s.mode === 'm';
  const lv = s.tr ?? 1;
  const medLv = s.med ?? 1;
  const stf = getStaffState(s);
  const skipInjTeams = new Set(liveInjMeta?.teamIds || []);
  const justInjuredNames = new Set(liveInjMeta?.playerNames || []);
  const plan = getTeamTrainingPlan(s);
  const progMeta = TEAM_TRAINING_PROGRAMS[plan.program];
  const intMeta = TRAINING_INTENSITY_META[plan.intensity];

  const tacFamDelta = mg
    ? Math.max(0, (plan.program === 'recovery' ? 1 : 2) + progMeta.tacFamBonus + intMeta.tacAdd + stf.asst)
    : 2 + stf.asst;
  me.tacFam = clamp((me.tacFam ?? 65) + tacFamDelta, 30, 100);

  let myFitBeforeSum = 0;
  let myFitAfterSum = 0;
  let myFitCount = 0;
  let restedCount = 0;

  s.teams
    .filter((t) => t.tier === me.tier)
    .forEach((t) => {
      const pl = xi(t);
      const mine = t.id === s.me;
      const ps = mine ? (t.press ?? 1) + (t.tempo ?? 1) - 1 : 1;
      t.sq.forEach((q) => {
        if (q.me) {
          if ((q.sus || 0) > 0) {
            q.sus = (q.sus || 0) - 1;
            if (s.p) s.p.sus = q.sus;
          }
          if ((q.inj || 0) > 0 && !justInjuredNames.has(q.n)) {
            q.inj = Math.max(0, q.inj - 1);
            if (s.p) s.p.inj = q.inj;
          }
          return;
        }
        const pi = pl.includes(q);
        const Dq = DT(q, s.p);
        const isIndivRest = mine && mg && plan.individualFocus?.[q.n] === 'REST';
        if (isIndivRest) restedCount++;
        const prevFit = q.fit ?? 100;
        const trainFitBonus = mine
          ? lv * 2 +
            stf.fit * 2 +
            progMeta.fitMod +
            (mg ? intMeta.fitDelta : 0) +
            (mg && plan.restStarters && pi ? 5 : 0) +
            (isIndivRest ? 10 : 0)
          : 0;
        q.fit = clamp(
          prevFit +
            (pi
              ? -Math.round(R(7, 13) * (Dq.tr === 2 ? 0.8 : 1)) - ps * 3 + Math.round((Dq.d.sta - 70) / 8)
              : R(8, 16) + Math.round((Dq.d.rec - 70) / 8)) +
            trainFitBonus,
          30,
          100
        );
        if (mine) {
          myFitBeforeSum += prevFit;
          myFitAfterSum += q.fit;
          myFitCount++;
        }
        if ((q.sus || 0) > 0) q.sus = (q.sus || 0) - 1;
        if (q.inj > 0) {
          if (!justInjuredNames.has(q.n)) {
            q.inj--;
            if (
              q.inj > 0 &&
              (Dq.d.rec >= 85 || isIndivRest || (mine && (medLv >= 3 || stf.physio >= 2))) &&
              Math.random() < 0.3 + (mine ? (medLv - 1) * 0.08 + stf.physio * 0.08 + (isIndivRest ? 0.25 : 0) : 0)
            ) {
              q.inj--;
            }
          }
        } else if (
          pi &&
          !skipInjTeams.has(t.id) &&
          Math.random() <
            (q.fit < 60 ? 0.07 : 0.024) *
              (mine ? progMeta.injMult * (mg ? intMeta.injMult : 1) * (isIndivRest ? 0.5 : 1) : 1) *
              (mine ? Math.max(0.5, 1 - (medLv - 1) * 0.08 - stf.physio * 0.08) : 1) *
              ((130 - Dq.d.tol) / 60)
        ) {
          q.inj = injD(q, R(1, 5), s.p);
          if (mine) {
            s.news = `${q.n} บาดเจ็บ ${q.inj} นัด`;
            pushFeed(s, 'บาดเจ็บ', `🩹 ${q.n} บาดเจ็บพัก ${q.inj} นัด`, 'urg');
          }
        }
      });
    });

  if (mg) {
    const gr: string[] = [];
    const xiSet = new Set(xi(me).map((z) => z.n));
    if (progMeta.devMult > 0) {
      me.sq.forEach((q) => {
        if (q.inj > 0 || plan.individualFocus?.[q.n] === 'REST') return;
        const isFocus = s.focusPlayer && q.n === s.focusPlayer;
        const matchesPos =
          progMeta.positions === 'YOUNG'
            ? q.age <= 25
            : Array.isArray(progMeta.positions) && progMeta.positions.includes(q.pos);
        const benchSharpBonus = plan.restStarters && !xiSet.has(q.n) ? 1.2 : 1;
        const chance =
          (0.05 + 0.03 * lv + stf.asst * 0.02) *
          progMeta.devMult *
          intMeta.devMult *
          benchSharpBonus *
          (isFocus ? 2.2 : 1);
        if ((matchesPos || isFocus) && q.age < 31 && q.ov < (q.pot || 92) && Math.random() < chance) {
          q.ov++;
          gr.push(`${q.n} (${q.ov})`);
        }
      });
    }
    const avgFitAfter = myFitCount ? myFitAfterSum / myFitCount : 80;
    const fitDeltaAvg = myFitCount ? Math.round((myFitAfterSum - myFitBeforeSum) / myFitCount) : 0;
    const morDelta = progMeta.morBonus + (plan.intensity === 'heavy' && avgFitAfter < 68 ? -1 : 0);
    if (morDelta !== 0) s.mor = clamp((s.mor ?? 50) + morDelta, 0, 100);
    s.trainingPlan = {
      ...plan,
      lastReport: {
        md: (s.md ?? 0) + 1,
        programName: `${progMeta.icon} ${progMeta.name}`,
        intensity: plan.intensity,
        fitDeltaAvg,
        tacFamDelta,
        morDelta,
        improved: gr,
        restedCount
      }
    };
    if (gr.length) {
      pushFeed(s, 'ฝึกซ้อม', `🏋️ พัฒนาจากซ้อม (${progMeta.short}): ${gr.slice(0, 2).join(', ')}${gr.length > 2 ? ` +${gr.length - 2} คน` : ''}`, 'ok');
    }
    let missionReadyCount = 0;
    me.sq.forEach((q) => {
      if (q.inj > 0 || plan.individualFocus?.[q.n] === 'REST') return;
      const beforeReady = countReadyMissions(q, q.me ? s.p : null);
      applyTrainingMissionProgress(q, {
        teamProgram: plan.program,
        isTeamFocus: s.focusPlayer === q.n,
        careerP: q.me ? s.p : null
      });
      const afterReady = countReadyMissions(q, q.me ? s.p : null);
      if (afterReady > beforeReady) missionReadyCount += afterReady - beforeReady;
    });
    if (missionReadyCount > 0) {
      pushFeed(s, 'ภารกิจส่วนบุคคล', `🎯 มีนักเตะ ${missionReadyCount} ภารกิจสำเร็จจากการซ้อม พร้อมกดรับค่าพลังเพิ่ม!`, 'ok');
    }
    const wg = squadWage(me);
    const stfWg = Math.round(getStaffWage(s));
    s.money -= wg + stfWg;
    logFin(s, `ค่าเหนื่อยนักเตะ (${me.sq.length} คน)`, -wg);
    if (stfWg > 0) logFin(s, 'ค่าจ้างทีมงานสตาฟฟ์โค้ช', -stfWg);

    if (s.sponsorDeal && s.sponsorDeal.left > 0) {
      s.money += s.sponsorDeal.perMatch;
      logFin(s, `ดีลพาร์ทเนอร์: ${s.sponsorDeal.name}`, s.sponsorDeal.perMatch);
      s.sponsorDeal.left--;
      if (s.sponsorDeal.left <= 0) {
        pushFeed(s, 'การเงิน', `📄 สัญญาสปอนเซอร์ "${s.sponsorDeal.name}" ครบกำหนดแล้ว`, '');
        s.sponsorDeal = null;
      }
    }

    if (s.bankLoan && s.bankLoan.left > 0) {
      s.money -= s.bankLoan.per;
      s.bankLoan.left--;
      logFin(s, 'ผ่อนชำระเงินกู้ธนาคาร', -s.bankLoan.per);
      if (s.bankLoan.left <= 0) {
        s.bankLoan = null;
        pushFeed(s, 'ข่าวสาร', '🏦 ผ่อนชำระเงินกู้สโมสรครบทั้งหมดแล้ว', 'ok');
      }
    }

    if (s.scout && !s.scout.results) {
      s.scout.turnsLeft--;
      if (s.scout.turnsLeft <= 0) {
        s.scout.results = resolveScoutResults(s, s.scout);
        pushFeed(s, 'แมวมอง', `🔍 แมวมองส่งรายงาน "${s.scout.label}" แล้ว! ดูได้ที่แท็บตลาด`, 'ok');
      }
    }
  } else {
    runPlayerWeek(s);
    if (s.p?.last) pushFeed(s, 'ฝึกซ้อม', s.p.last, /เพิ่มเป็น|ได้ \+1|พัฒนา/.test(s.p.last) ? 'ok' : '');
  }

  if (mg) {
    const l = (me.fm || '').slice(-1);
    let d = l === 'W' ? 3 : l === 'L' ? -4 : 0;
    if (s.derby) {
      d *= 2;
      if (l === 'W') {
        s.money += 20;
        logFin(s, 'โบนัสชนะดาร์บี้แมตช์', 20);
      }
      s.news = '🔥 ดาร์บี้แมตช์! ' + (l === 'W' ? 'ชนะคู่ปรับ แฟนบอลคลั่ง' : l === 'L' ? 'แพ้คู่ปรับ แฟนบอลโกรธ' : 'เสมอกัน');
      pushFeed(s, 'ข่าวสาร', s.news, l === 'W' ? 'ok' : l === 'L' ? 'urg' : '');
      s.derby = 0;
    }
    if (s.money < 0) d--;
    s.bd = clamp((s.bd ?? 50) + d, 0, 100);
    if (s.bd <= 0 && s.md >= 3) s.sack = 1;

    const tw = getTransferWindowInfo(s);
    if (s.md === 6) {
      syncOffersField(s, []);
      pushFeed(s, 'ตลาดซื้อขาย', '🔒 ตลาดซื้อขายรอบแรกปิดแล้ว (จะเปิดรอบสองอีกครั้งนัดที่ 15–20)', '');
    } else if (s.md === 14) {
      mkMarket(s);
      pushFeed(s, 'ตลาดซื้อขาย', '🟢 ตลาดซื้อขายเลกสอง (นัดที่ 15–20) เปิดทำการแล้ว!', 'ok');
    } else if (s.md === 20) {
      syncOffersField(s, []);
      pushFeed(s, 'ตลาดซื้อขาย', '🔒 ตลาดซื้อขายเลกสองปิดแล้ว จนถึงต้นฤดูกาลหน้า', '');
    }

    const activeOffers = getIncomingOffers(s);
    const listedCands = me.sq.filter(
      (x) =>
        !!x.listed &&
        !x.loan &&
        x.inj === 0 &&
        me.sq.length > LEAGUE_TRANSFER_RULES.minSquad &&
        me.sq.filter((z) => z.pos === x.pos).length > LEAGUE_TRANSFER_RULES.minPos[x.pos] &&
        activeOffers.filter((o) => o.n === x.n).length < 2
    );
    const bidProb = listedCands.length ? 0.68 : 0.22;
    if (tw.open && activeOffers.length < 3 && Math.random() < bidProb) {
      const cands = listedCands.length
        ? listedCands
        : me.sq
            .slice()
            .sort((a, b) => b.ov - a.ov)
            .slice(0, 6)
            .filter(
              (x) =>
                !x.loan &&
                x.inj === 0 &&
                me.sq.length > LEAGUE_TRANSFER_RULES.minSquad &&
                me.sq.filter((z) => z.pos === x.pos).length > LEAGUE_TRANSFER_RULES.minPos[x.pos] &&
                !activeOffers.some((o) => o.n === x.n)
            );
      if (cands.length) {
        const q = P(cands);
        const existingClubs = new Set(activeOffers.filter((o) => o.n === q.n).map((o) => o.t));
        const oppPool = s.teams.filter(
          (x) => x.id !== s.me && x.sq.length < LEAGUE_TRANSFER_RULES.maxSquad && !existingClubs.has(x.name)
        );
        if (oppPool.length) {
          const opp = P(oppPool);
          const baseVal = q.askPrice || Math.max(5, vlu(q));
          const mult = q.listed ? 0.9 + Math.random() * 0.2 : 1.08 + Math.random() * 0.35;
          const newOff: TransferOffer = {
            n: q.n,
            p: Math.max(5, Math.round(baseVal * mult)),
            t: opp.name,
            teamId: opp.id
          };
          addIncomingOffer(s, newOff);
          pushFeed(s, 'ข้อเสนอ', `💼 ${newOff.t} ยื่นซื้อ ${newOff.n} (${fmtMoneyNum(newOff.p)})`, 'offer');
        }
      }
    }
  } else {
    s.derby = 0;
  }

  // Trigger Thai FA Cup every 7 matchdays starting md 6 (when not clashing with Asia cup)
  const cup = s.cup;
  const n = s.md + 1;
  if (cup && !cup.done && cup.r < 4 && n === 7 * cup.r + 6) {
    if (cup.alive && cup.ids.includes(s.me)) {
      s.pc = true;
      s.news = `🏆 ถึงคิวแข่งถ้วยประชาชน ${RN[cup.r]}`;
    } else {
      simulateCpuCupRound(s);
    }
  }

  // Trigger Asian Cup
  const c = s.ac;
  if (c && !c.done && c.r < 4 && n === 7 * c.r + 3) {
    if (c.alive && c.ids.includes(s.me)) {
      s.pa = true;
      s.news = `🌏 ถึงคิวแข่งบอลถ้วยในทวีป ${RN[c.r]}`;
    } else {
      simulateCpuAsiaRound(s);
    }
  }

  maybeTriggerDilemma(s);
}

export function growPlayers(s: GameState) {
  s.teams.forEach((t) =>
    t.sq.forEach((q) => {
      q.age++;
      if (q.me) {
        if (s.p) s.p.age = q.age;
        return;
      }
      if (q.con && !q.loan) q.con.yr = Math.max(0, (q.con.yr ?? 2) - 1);
      const D = DT(q, s.p);
      const delta =
        q.age < D.pk - 2
          ? R(0, 3) + (D.tr === 2 && Math.random() < 0.3 ? 1 : 0)
          : q.age > D.pk + 4
            ? -R(0, 3)
            : R(-1, 1);
      q.ov = clamp(q.ov + delta + (t.id === s.me && q.age < 24 && (s.tr ?? 1) > 2 ? 1 : 0), 25, q.pot || 92);
      if (q.age > 35) {
        Object.assign(q, mkPlayer(q.pos, BASE[t.tier], true));
        delete q.con;
        delete q.loan;
        delete q.loanOpt;
      }
    })
  );
}

export function buildMatchExtraEvents(h: Team, a: Team, s?: GameState | null) {
  const X = [h, a].map((t) => rate(t, s).x.filter((q) => q.pos !== 'GK'));
  const N = [h.name, a.name];
  const templates: ((q: Player, t: string) => string)[] = [
    (q, t) => `🟨 ${q.n} (${t}) เข้าสกัดหนักโดนใบเหลืองเตือน`,
    (q, t) => `😮 ${q.n} (${t}) ยิงเฉียดเสาไปนิดเดียว`,
    (q) => `🎯 ${q.n} ปั่นโค้งเกือบเสียบสามเหลี่ยม`,
    (q, t) => `🩹 ${q.n} (${t}) ปะทะหนักลงไปนอน แต่ลุกมาเล่นต่อได้`,
    (_, t) => `🚩 ${t} ได้ลูกเตะมุมกดดันหน้ากรอบ`,
    (q) => `🎙️ ${q.n} คุมจังหวะจ่ายบอลกลางสนามได้เนียนตา`,
    (_, t) => `👏 แฟนบอล${t}ร้องเชียร์สนั่นสนาม`,
    (q) => `🔥 ${q.n} ซัดไกลเต็มข้อแต่บอลลอยข้ามคานไป`,
    (_, t) => `⚠️ ลูกฟรีคิกอันตรายของ ${t}`,
    (q, t) => `⚡ ${q.n} (${t}) สปีดกระชากหนีตัวประกบสร้างโอกาส`,
    (q, t) => `🧱 ${q.n} (${t}) เทกตัวโหม่งชนคานอย่างจัง!`
  ];
  return Array.from({ length: R(4, 7) }, () => {
    const i = R(0, 1);
    const k = R(0, templates.length - 1);
    const pl = X[i].length ? X[i] : rate(i ? a : h, s).x;
    const pickWeighted = (fn: (z: Player) => number) =>
      pl.flatMap((z) => Array(Math.max(1, Math.round(fn(z)))).fill(z));
    const q = P(
      k === 0
        ? pickWeighted((z) => (DT(z, s?.p).tr === 1 ? 3 : 1))
        : k === 3
          ? pickWeighted((z) => (105 - DT(z, s?.p).d.tol) / 12)
          : k === 2 || k === 7
            ? pickWeighted((z) => DT(z, s?.p).d.cur + DT(z, s?.p).d.pw - 90)
            : k === 5
              ? pickWeighted((z) => DT(z, s?.p).a.ps - 35)
              : k === 9
                ? pickWeighted((z) => DT(z, s?.p).d.spd + DT(z, s?.p).a.dr - 90)
                : k === 10
                  ? pickWeighted((z) => DT(z, s?.p).d.hd - 40)
                  : pl
    );
    return { m: R(3, 89), t: templates[k](q, N[i]), i, k, q };
  });
}

export function finishSeasonComputation(s: GameState) {
  const mt = s.teams[s.me].tier;
  const lp = s.teams.filter((t) => t.tier === mt).flatMap((t) => t.sq.map((q) => ({ q, t })));
  const top = (k: 'sg' | 'sa') => lp.slice().sort((a, b) => (b.q[k] || 0) - (a.q[k] || 0))[0];
  const bs = top('sg');
  const ba = top('sa');

  [0, 1, 2]
    .filter((i) => i !== mt)
    .forEach((i) => {
      const rounds = s.fxo?.[i] ? s.fxo[i].slice(s.md) : roundRobin(s.teams.filter((t) => t.tier === i).map((t) => t.id));
      rounds.forEach((rd) =>
        rd.forEach(([h, a]) => {
          const r = simMatch(s.teams[h], s.teams[a], s);
          applyMatchResult(s.teams[h], r.gh, s.teams[a], r.ga);
          tallyMatchPlayers(s.teams[h], s.teams[a], r);
        })
      );
    });

  const tb = [0, 1, 2].map((i) => sortTable(s.teams.filter((t) => t.tier === i)));
  const meTeam = s.teams[s.me];
  const pos = tb[mt].indexOf(meTeam) + 1;
  const ch = tb[mt][0].id === s.me;
  const up: Team[] = [];
  const dn: Team[] = [];
  [0, 1].forEach((i) => {
    up.push(...tb[i].slice(0, 3));
    dn.push(...tb[i + 1].slice(-3));
  });

  if (s.aqs !== s.season) {
    s.aqs = s.season;
    s.aq = tb[2].slice(0, 3).map((t) => t.id);
  }

  up.forEach((t) => t.tier++);
  dn.forEach((t) => t.tier--);
  const nt = s.teams[s.me].tier;

  s.trophies = s.trophies || [];
  s.records = s.records || {};
  if (ch) {
    s.trophies.push({ season: s.season, title: `แชมป์ ${TN[mt]}`, tier: mt, type: 'league' });
    s.mgrRep = (s.mgrRep || 50) + (mt === 2 ? 100 : mt === 1 ? 60 : 40);
  } else if (nt > mt) {
    s.mgrRep = (s.mgrRep || 50) + 30;
  }

  const meTopScorer = meTeam.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0))[0];
  if (meTopScorer && (meTopScorer.sg || 0) > (s.records.topSeasonScorer?.g || 0)) {
    s.records.topSeasonScorer = { n: meTopScorer.n, g: meTopScorer.sg || 0, s: s.season };
  }
  if (meTeam.pts > (s.records.mostPoints?.pts || 0)) {
    s.records.mostPoints = { pts: meTeam.pts, s: s.season };
  }

  if (s.mode === 'm') {
    const pr = Math.max(0, 150 - pos * 10);
    if (pr) {
      s.money += pr;
      logFin(s, `เงินรางวัลจบอันดับ ${pos}`, pr);
    }
    if (s.payDue) {
      s.money -= s.payDue;
      logFin(s, 'ชำระค่าตัวผ่อนงวดปลายปี', -s.payDue);
      s.payDue = 0;
    }
    if (s.esd !== s.season) {
      s.esd = s.season;
      if (s.obj != null) {
        s.bd = clamp((s.bd ?? 50) + (pos <= s.obj ? 25 : pos <= s.obj + 3 ? -8 : -25), 0, 100);
        s.hist.push(`บอร์ด: เป้า อันดับ ${s.obj} · จบอันดับ ${pos}`);
        if (s.bd <= 0) s.sack = 1;
      }
    }
  } else if (s.p && s.esd !== s.season) {
    s.esd = s.season;
    const p = s.p;
    const av = p.ap ? p.rs / p.ap : 0;
    if (ovMe(p) >= 62 && av >= 6.8) {
      const gw = autoGrow(p, 3);
      p.ntCaps = (p.ntCaps || 0) + R(2, 4);
      const ntG = p.pos === 'FW' ? R(1, 3) : p.pos === 'MF' ? R(0, 2) : 0;
      p.ntGoals = (p.ntGoals || 0) + ntG;
      s.trophies.push({ season: s.season, title: 'ติดทีมชาติชุดใหญ่', type: 'nt' });
      s.hist.push(`🇹🇭 ซีซั่น ${s.season}: ติดทีมชาติลงเล่นให้ทัพทีมชาติไทย${ntG ? ` (ยิง ${ntG} ประตู)` : ''}${gw ? ` · ${gw}` : ''}`);
    }
  }

  const cupStatus = s.cup.done && s.cup.ids[0] === s.me ? 'แชมป์ถ้วย' : s.cup.alive ? 'ถึงรอบสุดท้าย' : 'ตกรอบ';
  s.hist.push(`ซีซั่น ${s.season}: ${TN[mt]} อันดับ ${pos} · ${cupStatus}`);

  let offers: Team[] = [];
  if (s.mode === 'p' && s.p) {
    const av = s.p.ap ? s.p.rs / s.p.ap : 0;
    if (av >= 6.6 || ovMe(s.p) >= BASE[nt] + 8) {
      const targetTier = nt < 2 ? nt + 1 : 2;
      offers = s.teams
        .filter((t) => t.tier === targetTier && t.id !== s.me)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
    }
  }

  return {
    mt,
    nt,
    pos,
    totalTeams: tb[mt].length,
    ch,
    cupStatus,
    bestScorer: bs && bs.q.sg ? `${bs.q.n} (${bs.t.name}) ${bs.q.sg} ประตู` : '',
    bestAssist: ba && ba.q.sa ? `${ba.q.n} (${ba.t.name}) ${ba.q.sa} ครั้ง` : '',
    offers,
    stText: nt > mt ? 'เลื่อนชั้น! 🎉' : nt < mt ? 'ตกชั้น' : ch ? 'แชมป์ลีก!' : 'อยู่ชั้นเดิม'
  };
}

export function simulateInstantMatchPayload(
  s: GameState,
  kind: 'league' | 'cup' | 'asia',
  homeId: number,
  awayId: number
): FinishedMatchPayload {
  const H = s.teams[homeId];
  const A = s.teams[awayId];
  const meTeam = s.teams[s.me];
  const r = simMatch(H, A, s);
  const { ratings, motm } = computePlayerRatings(H, A, r, s.p);

  let pen = false;
  let penText: string | undefined;
  if (kind !== 'league' && r.gh === r.ga) {
    pen = true;
    const hWin = Math.random() < 0.5;
    const wPen = R(4, 5);
    const lPen = R(2, wPen - 1);
    penText = `ดวลจุดโทษ ${hWin ? `${wPen}-${lPen}` : `${lPen}-${wPen}`}`;
  }

  let pf: PlayerPerfResult | undefined;
  if (s.mode === 'p' && s.p) {
    const pName = s.p.name;
    const mySquadObj = meTeam.sq.find((q) => q.me || q.n === pName);
    const isBanned = ((mySquadObj?.sus || s.p.sus || 0) > 0);
    const starterNames = xi(meTeam).map((q) => q.n);
    const started = !isBanned && starterNames.includes(pName);
    const subInEv = r.subs?.find((sb) => sb.t === s.me && sb.inPlayer === pName);
    const subOutEv = r.subs?.find((sb) => sb.t === s.me && sb.outPlayer === pName);
    const played = !isBanned && (started || !!subInEv);
    const mins = !played ? 0 : started ? (subOutEv ? subOutEv.m : 90) : (90 - (subInEv?.m || 72));
    const myCards = (r.cards || []).filter((c) => c.t === s.me && c.who === pName);
    const yc = myCards.filter((c) => c.type === 'Y' || c.type === 'Y2R').length;
    const rc = myCards.some((c) => c.type === 'R' || c.type === 'Y2R') ? 1 : 0;
    pf = calcPlayerPerf(s, r, H, A, ratings, {
      played,
      mins,
      subIn: !!subInEv,
      subOut: !!subOutEv,
      yc,
      rc
    });
  }

  return {
    gh: r.gh,
    ga: r.ga,
    evs: r.evs,
    xgH: r.xgH || 1.1,
    xgA: r.xgA || 1.0,
    pen,
    penText,
    ratings,
    motm,
    pf,
    finalTac: meTeam.tac,
    finalLu: xi(meTeam).map((q) => q.n),
    cards: r.cards || [],
    subs: r.subs || [],
    playedNames: r.playedNames || {}
  };
}
