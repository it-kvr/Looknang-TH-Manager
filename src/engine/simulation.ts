import type { Position, SubRole, StatKey, GameMode, CoreAttrs, Player, Team, PlayerCareerProfile, MatchEvent, MatchCardEvent, MatchSubEvent, MatchDramaticEvent, MatchHighlightLine, MatchHighlightsSummary, PlayerPerfResult, MatchResult, TransferOffer, ScoutMission, GameState, DilemmaTemplate, FinishedMatchPayload, PersonalMissionMetric, SeasonPlayerStatRecord, SeasonArchiveRecord, PlayerSeasonHistoryRecord, BoardDirective, BoardDirectiveKind, BoardTempEffect, BoardFeedbackEntry, FinanceHistoryPoint, FacilityKey, TrainingProgramId } from '../types/game';
import { R, P, clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { AN, RN, TN, BASE, POS, ATT, LINE, PM, SPX, ALL_SUB_ROLES, SPN, SKIN_P, HAIR_P, PACT, TEAM_TRAINING_PROGRAMS, TRAINING_INTENSITY_META, getTeamTrainingPlan, CLUB_PHILOSOPHIES, FSD, SIGL } from '../data/thaiFootballData';
import { clearNamePool, genClubNames, assignTeamShirtNumbers, mkPlayer, mkTeam, getFormationSlots, getFormationCounts, pen, playerPen, ef, xi, DT, injD, ovMe, getOvGrowthScale, getPlayerDevProfile, trySuperstarBreakthrough, autoGrow, syncMe, vlu, wagOf, ensureCon, squadWage, logFin, pushFeed, ensureClubIdentity, ensureAiTeamPhilosophies, applyClubPhilosophy, hasTrait, rollPlayerTraits, rollPlayerBio, recordPlayerSeasonProgress, OVF } from './playerCore';
import { applyTrainingMissionProgress } from './missions';
import { appendPlayerCareerLog, calcSeasonAvgRating, mergeClubAllTimePlayers, snapshotPlayerForRecord } from './history';

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
      idxs.reduce((sum, i) => sum + Math.max(0, ef(x[i])) * PM[playerPen(x[i], (sl[i] || {}).sp)], 0) /
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
  at += M(['FW', 'MF'], (q, d) => d.fin * 0.32 + d.pw * 0.14 + d.cur * 0.1 + d.run * 0.22 + d.crs * 0.1 + d.spass * 0.06 + d.lpass * 0.06 - q.ov) * 0.35;
  at += M(['FW', 'MF'], (q, d, a) => d.spd * 0.65 + a.dr * 0.35 - q.ov) * 0.14;
  at += M(['FW'], (q, d) => d.str - q.ov) * 0.06;
  at += M(['GK'], (q, d) => d.dist * 0.65 + d.lpass * 0.35 - q.ov) * 0.08;
  df += M(['DF'], (q, d) => d.rd * 0.25 + d.pos * 0.25 + d.mrk * 0.2 + d.blk * 0.15 + d.hd * 0.15 - q.ov) * 0.4;
  df += M(['MF'], (q, d) => d.rd * 0.35 + d.pos * 0.35 + d.mrk * 0.3 - q.ov) * 0.14;
  df += M(['GK'], (q, d) => d.sv * 0.35 + (d.rfx ?? d.sv) * 0.18 + (d.hnd ?? d.sv) * 0.17 + d.cl * 0.18 + d.pos * 0.12 - q.ov) * 0.3;
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
  if (x.some((q) => { const tr = DT(q, s?.p).tr; return tr === 0 || tr === 21; })) {
    at += 0.5;
    df += 0.5;
  }

  // Football Traits & Personalities match impact
  const cpForTrait = s?.p;
  let traitAt = 0;
  let traitDf = 0;
  x.forEach((q, idx) => {
    const Dq = DL[idx]?.[1] || DT(q, cpForTrait);
    const isClutchMoment = Boolean(big || (matchMin && matchMin >= 70));
    const slotSp = sl[idx]?.sp;

    // Personality effects (0..23)
    if (Dq.tr === 4 && isClutchMoment) {
      traitAt += 0.45;
      traitDf += 0.35;
    } else if (Dq.tr === 5) {
      traitAt += 0.32;
      traitDf -= 0.1;
    } else if (Dq.tr === 8) {
      traitAt += 0.25;
      traitDf += 0.25;
    } else if (Dq.tr === 9 && (isClutchMoment || (matchMin && matchMin >= 65))) {
      traitAt += 0.35;
      traitDf += 0.35;
    } else if (Dq.tr === 11 && (q.fit ?? 100) >= 75) {
      traitAt += 0.28;
    } else if (Dq.tr === 12) {
      traitAt += 0.26;
      traitDf += 0.18;
    } else if (Dq.tr === 13) {
      traitAt += 0.34;
      traitDf -= 0.12;
    } else if (Dq.tr === 14) {
      traitDf += 0.42;
    } else if (Dq.tr === 16 && (big || (s && t.id === s.me))) {
      traitAt += 0.35;
      traitDf += 0.22;
    } else if (Dq.tr === 17 && isClutchMoment) {
      traitAt += 0.4;
      traitDf += 0.35;
    } else if (Dq.tr === 18 && (!matchMin || matchMin >= 60)) {
      traitAt += 0.22;
      traitDf += 0.28;
    } else if (Dq.tr === 19 && (q.fit ?? 100) < 72) {
      traitAt -= 0.22;
      traitDf -= 0.22;
    } else if (Dq.tr === 20) {
      traitAt += 0.42;
    } else if (Dq.tr === 21) {
      traitAt += 0.16;
      traitDf += 0.24;
    } else if (Dq.tr === 22) {
      traitAt += 0.45;
      traitDf -= 0.25;
    } else if (Dq.tr === 23) {
      traitAt += 0.25;
      traitDf += 0.25;
    }

    if (hasTrait(q, 'clutch_player', cpForTrait) && isClutchMoment) {
      traitAt += 0.55;
      traitDf += 0.45;
    }
    if (hasTrait(q, 'super_sub', cpForTrait) && subsEntered?.includes(q.n)) {
      traitAt += 0.9;
      traitDf += 0.4;
    }
    if (hasTrait(q, 'consistency_pro', cpForTrait)) {
      traitAt += 0.28;
      traitDf += 0.28;
    }
    if (hasTrait(q, 'calm_leader', cpForTrait)) {
      traitAt += 0.22;
      traitDf += 0.35;
    }
    if (hasTrait(q, 'tempo_controller', cpForTrait) && (q.pos === 'MF' || q.pos === 'DF')) {
      traitAt += 0.42;
      traitDf += 0.22;
    }
    if (hasTrait(q, 'pressing_machine', cpForTrait)) {
      traitAt += 0.28;
      traitDf += 0.42;
    }
    if (hasTrait(q, 'man_marker', cpForTrait) && (q.pos === 'DF' || q.pos === 'MF')) {
      traitDf += 0.55;
    }
    if (hasTrait(q, 'interception_hawk', cpForTrait) && (q.pos === 'DF' || q.pos === 'MF')) {
      traitDf += 0.52;
    }
    if (hasTrait(q, 'poacher_instinct', cpForTrait) && (q.pos === 'FW' || q.pos === 'MF')) {
      traitAt += 0.58;
    }
    if (hasTrait(q, 'killer_passer', cpForTrait) && (q.pos === 'MF' || q.pos === 'FW')) {
      traitAt += 0.52;
    }
    if (hasTrait(q, 'sweeper_keeper', cpForTrait) && q.pos === 'GK') {
      traitDf += 0.65;
    }
    if (hasTrait(q, 'reflex_cat', cpForTrait) && q.pos === 'GK') {
      traitDf += 0.72;
    }
    if (hasTrait(q, 'finesse_shot', cpForTrait) && (q.pos === 'FW' || q.pos === 'MF')) {
      traitAt += 0.42;
    }
    if (hasTrait(q, 'hold_up_play', cpForTrait) && (q.pos === 'FW' || q.pos === 'MF')) {
      traitAt += 0.38;
      traitDf += 0.16;
    }
    if (hasTrait(q, 'trivela_cross', cpForTrait)) {
      traitAt += 0.35;
    }
    if (hasTrait(q, 'through_ball_vision', cpForTrait) && (q.pos === 'MF' || q.pos === 'FW')) {
      traitAt += 0.46;
    }
    if (hasTrait(q, 'one_touch_wizard', cpForTrait) && (q.pos === 'MF' || q.pos === 'FW')) {
      traitAt += 0.38;
      traitDf += 0.18;
    }
    if (hasTrait(q, 'late_box_crasher', cpForTrait) && (q.pos === 'MF' || q.pos === 'DF')) {
      traitAt += 0.44;
    }
    if (hasTrait(q, 'last_ditch_hero', cpForTrait) && (q.pos === 'DF' || q.pos === 'MF')) {
      traitDf += 0.52;
    }
    if (hasTrait(q, 'aerial_wall', cpForTrait) && q.pos === 'DF') {
      traitDf += 0.54;
    }
    if (hasTrait(q, 'command_area', cpForTrait) && q.pos === 'GK') {
      traitDf += 0.62;
    }
    if (hasTrait(q, 'one_on_one_wall', cpForTrait) && q.pos === 'GK') {
      traitDf += 0.64;
    }
    if (hasTrait(q, 'comeback_king', cpForTrait) && isClutchMoment) {
      traitAt += 0.48;
      traitDf += 0.32;
    }
    if (hasTrait(q, 'versatile_utility', cpForTrait)) {
      const hasRawPen = slotSp ? pen(q.ro, slotSp) > 0 : false;
      traitAt += hasRawPen ? 0.38 : 0.2;
      traitDf += hasRawPen ? 0.38 : 0.2;
    }
    // New 45..64 traits
    if (hasTrait(q, 'fox_in_box', cpForTrait) && q.pos === 'FW') traitAt += 0.56;
    if (hasTrait(q, 'knuckleball_king', cpForTrait) && (q.pos === 'FW' || q.pos === 'MF')) traitAt += 0.45;
    if (hasTrait(q, 'inverted_winger', cpForTrait) && (q.pos === 'FW' || q.pos === 'MF')) traitAt += 0.5;
    if (hasTrait(q, 'target_man', cpForTrait) && q.pos === 'FW') {
      traitAt += 0.44;
      traitDf += 0.12;
    }
    if (hasTrait(q, 'shadow_striker', cpForTrait) && (q.pos === 'MF' || q.pos === 'FW')) traitAt += 0.52;
    if (hasTrait(q, 'deep_lying_playmaker', cpForTrait) && (q.pos === 'MF' || q.pos === 'DF')) {
      traitAt += 0.44;
      traitDf += 0.25;
    }
    if (hasTrait(q, 'nutmeg_master', cpForTrait) && (q.pos === 'FW' || q.pos === 'MF')) traitAt += 0.38;
    if (hasTrait(q, 'deadball_curler', cpForTrait)) traitAt += 0.42;
    if (hasTrait(q, 'giant_thrower', cpForTrait) && (q.pos === 'DF' || q.pos === 'MF')) traitAt += 0.32;
    if (hasTrait(q, 'sweeper_cb', cpForTrait) && q.pos === 'DF') traitDf += 0.56;
    if (hasTrait(q, 'wing_lockdown', cpForTrait) && (q.pos === 'DF' || q.pos === 'MF')) traitDf += 0.5;
    if (hasTrait(q, 'ball_winner_dm', cpForTrait) && (q.pos === 'MF' || q.pos === 'DF')) traitDf += 0.54;
    if (hasTrait(q, 'acrobat_clearance', cpForTrait) && (q.pos === 'DF' || q.pos === 'MF')) traitDf += 0.52;
    if (hasTrait(q, 'cross_claimer', cpForTrait) && q.pos === 'GK') traitDf += 0.62;
    if (hasTrait(q, 'distribution_master', cpForTrait) && q.pos === 'GK') {
      traitAt += 0.35;
      traitDf += 0.3;
    }
    if (hasTrait(q, 'penalty_box_boss', cpForTrait) && q.pos === 'GK') traitDf += 0.68;
    if (hasTrait(q, 'box_to_box_engine', cpForTrait) && (q.pos === 'MF' || q.pos === 'DF')) {
      traitAt += 0.38;
      traitDf += 0.38;
    }
    if (hasTrait(q, 'speed_demon', cpForTrait)) {
      traitAt += 0.44;
      traitDf += 0.16;
    }
    if (hasTrait(q, 'tireless_mentor', cpForTrait)) {
      traitAt += 0.26;
      traitDf += 0.3;
    }
    if (hasTrait(q, 'risk_taker', cpForTrait)) {
      traitAt += 0.46;
      traitDf -= 0.22;
    }
    if (q.me && cpForTrait?.perks?.includes('adaptable') && slotSp && playerPen(q, slotSp) > 0) {
      traitAt += 0.55;
      traitDf += 0.55;
    }
    if (hasTrait(q, 'glass_cannon', cpForTrait)) {
      if ((q.fit ?? 100) > 75) {
        traitAt += 0.42;
        traitDf += 0.18;
      } else {
        traitAt -= 0.3;
        traitDf -= 0.3;
      }
    }
  });
  at += clamp(traitAt, -3.5, 6.2);
  df += clamp(traitDf, -3.5, 6.2);

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
    const bMods = getActiveBoardModifiers(s);
    const effMor = clamp((s.mor ?? 50) + bMods.mor, 0, 100);
    const mo = (effMor - 50) / 25 + (s.winBonus === 25 ? 1.5 : s.winBonus === 10 ? 0.8 : 0);
    const coachStyle = s.club?.managerStyle || 'balanced';
    if (coachStyle === 'attack') at += 1.5;
    if (coachStyle === 'defense') df += 1.5;
    if (coachStyle === 'motivator' && matchMin && matchMin >= 65) {
      at += 0.9;
      df += 0.9;
    }
    at += mo + bMods.att;
    df += mo + bMods.df;
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
      let traitBoost = 1;
      if (hasTrait(q, 'poacher_instinct', careerP)) traitBoost += 0.32;
      if (hasTrait(q, 'finesse_shot', careerP)) traitBoost += 0.24;
      if (hasTrait(q, 'late_box_crasher', careerP)) traitBoost += 0.22;
      if (hasTrait(q, 'aerial_menace', careerP)) traitBoost += 0.22;
      if (hasTrait(q, 'outside_curler', careerP)) traitBoost += 0.18;
      if (hasTrait(q, 'long_shot_lover', careerP)) traitBoost += 0.16;
      if (hasTrait(q, 'selfish_shooter', careerP)) traitBoost += 0.24;
      if (hasTrait(q, 'acrobatic_finisher', careerP)) traitBoost += 0.2;
      if (hasTrait(q, 'comeback_king', careerP)) traitBoost += 0.14;
      return b ? W(q, b * traitBoost, sc) : [];
    });
    const q = w.length ? P(w) : P(x);
    const o = x
      .filter((z) => z !== q && z.pos !== 'GK')
      .flatMap((z) => {
        const D = DT(z, careerP);
        let assistBoost = 1;
        if (hasTrait(z, 'killer_passer', careerP)) assistBoost += 0.35;
        if (hasTrait(z, 'through_ball_vision', careerP)) assistBoost += 0.32;
        if (hasTrait(z, 'trivela_cross', careerP)) assistBoost += 0.26;
        if (hasTrait(z, 'early_crosser', careerP)) assistBoost += 0.26;
        if (hasTrait(z, 'one_touch_wizard', careerP)) assistBoost += 0.24;
        if (hasTrait(z, 'hold_up_play', careerP)) assistBoost += 0.22;
        if (hasTrait(z, 'long_diagonal', careerP)) assistBoost += 0.2;
        if (hasTrait(z, 'one_two_lover', careerP)) assistBoost += 0.22;
        if (hasTrait(z, 'setpiece_specialist', careerP)) assistBoost += 0.24;
        if (hasTrait(z, 'team_first', careerP)) assistBoost += 0.26;
        if (hasTrait(z, 'selfish_shooter', careerP)) assistBoost *= 0.68;
        return W(z, (z.pos === 'MF' ? 4 : z.pos === 'FW' ? 3 : 1) * assistBoost, D.d.crs * 0.28 + D.d.spass * 0.18 + D.d.lpass * 0.16 + D.a.ps * 0.20 + D.d.cur * 0.08 + D.a.dr * 0.05 + D.d.rd * 0.05);
      });
    return { m: R(1, 90), t: t.id, who: q.n, as: Math.random() < 0.75 && o.length ? P(o).n : '' };
  });
}

export function simMatchCardsAndSubs(h: Team, a: Team, s?: GameState | null): {
  cards: MatchCardEvent[];
  subs: MatchSubEvent[];
  playedNames: Record<number, string[]>;
  playedSlots: Record<number, Record<string, SubRole>>;
} {
  const cards: MatchCardEvent[] = [];
  const subs: MatchSubEvent[] = [];
  const playedNames: Record<number, string[]> = {};
  const playedSlots: Record<number, Record<string, SubRole>> = {};
  const big = !!(s && (s.pc || s.pa || (s.derby && (h.id === s.me || a.id === s.me))));

  [h, a].forEach((tm) => {
    const slots = getFormationSlots(tm);
    const starters = xi(tm);
    const active = starters.map((q) => q.n);
    const bench = tm.sq
      .filter((q) => !active.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0)
      .sort((x, y) => ef(y) - ef(x));
    const subCount = Math.min(4, bench.length);
    const currentLineup = starters.slice();
    const played = new Set(active);
    const slotMap: Record<string, SubRole> = {};
    starters.forEach((pl, idx) => {
      slotMap[pl.n] = slots[idx]?.sp || pl.ro;
    });

    // Simulate 2-4 substitutions between minutes 55-84, prioritizing fatigued starters
    for (let k = 0; k < subCount; k++) {
      const candidateOut = currentLineup
        .filter((q) => q.pos !== 'GK')
        .sort((x, y) => (x.fit ?? 100) - (y.fit ?? 100) || x.ov - y.ov)[0];
      if (!candidateOut) break;
      const needRest = (candidateOut.fit ?? 100) < 76;
      if (Math.random() > (needRest ? 0.88 : 0.7)) continue;
      const samePosPool = bench.filter((b) => !played.has(b.n) && b.pos === candidateOut.pos && (b.fit ?? 100) >= 64);
      const anyPool = bench.filter((b) => !played.has(b.n) && b.pos !== 'GK' && (b.fit ?? 100) >= 64);
      const fallbackPool = bench.filter((b) => !played.has(b.n) && b.pos !== 'GK');
      const candidateIn =
        samePosPool.find((b) => hasTrait(b, 'super_sub', s?.p)) ||
        samePosPool[0] ||
        anyPool.find((b) => hasTrait(b, 'super_sub', s?.p)) ||
        anyPool[0] ||
        fallbackPool[0];
      if (!candidateIn) break;
      const min = needRest ? R(54, 72) : R(62, 84);
      const idx = currentLineup.indexOf(candidateOut);
      if (idx >= 0) {
        currentLineup[idx] = candidateIn;
        slotMap[candidateIn.n] = slots[idx]?.sp || slotMap[candidateOut.n] || candidateOut.ro;
      }
      played.add(candidateIn.n);
      subs.push({ m: min, t: tm.id, inPlayer: candidateIn.n, outPlayer: candidateOut.n });
    }
    playedNames[tm.id] = Array.from(played);
    playedSlots[tm.id] = slotMap;

    // Simulate cards (realistic ~1-2 yellows per team, rare red card)
    const pool = currentLineup.filter((q) => q.pos !== 'GK');
    const cardRoll = (tm.press ?? 1) === 2 ? 0.54 : 0.40;
    const numYellows = (Math.random() < cardRoll ? 1 : 0) + (Math.random() < cardRoll * 0.45 ? 1 : 0) + (big && Math.random() < 0.2 ? 1 : 0);
    const matchY: Record<string, number> = {};
    for (let c = 0; c < numYellows && pool.length; c++) {
      const weighted = pool.flatMap((q) => {
        const D = DT(q, s?.p);
        let w = (D.tr === 1 || D.tr === 7 || D.tr === 15 || D.tr === 22 ? 3 : 1) + (D.d.pos < 58 ? 1 : 0);
        if (D.tr === 6 || D.tr === 17 || D.tr === 23) w = Math.max(1, w - 1);
        if (hasTrait(q, 'hot_headed', s?.p)) w += 3;
        if (hasTrait(q, 'slide_tackler', s?.p) || hasTrait(q, 'risk_taker', s?.p)) w += 2;
        if (hasTrait(q, 'calm_leader', s?.p) || hasTrait(q, 'tireless_mentor', s?.p)) w = Math.max(1, w - 1);
        if (q.me && s?.p?.perks?.includes('discipline_pro')) w = Math.max(1, w - 1);
        return Array(w).fill(q);
      });
      const culprit = P(weighted);
      const min = R(12, 89);
      matchY[culprit.n] = (matchY[culprit.n] || 0) + 1;
      if (matchY[culprit.n] >= 2) {
        if (Math.random() < 0.55) {
          cards.push({ m: min, t: tm.id, who: culprit.n, type: 'Y2R' });
        }
      } else {
        cards.push({ m: min, t: tm.id, who: culprit.n, type: 'Y' });
      }
    }
    if (pool.length && Math.random() < (big ? 0.032 : 0.018)) {
      const rough = pool.filter((q) => {
        const tr = DT(q, s?.p).tr;
        return tr === 1 || tr === 7 || tr === 15 || tr === 22 || hasTrait(q, 'hot_headed', s?.p);
      });
      const culprit = rough.length ? P(rough) : P(pool);
      if (!cards.some((c) => c.t === tm.id && c.who === culprit.n && (c.type === 'R' || c.type === 'Y2R'))) {
        cards.push({ m: R(25, 86), t: tm.id, who: culprit.n, type: 'R' });
      }
    }
  });

  return { cards, subs, playedNames, playedSlots };
}

export function simMatch(h: Team, a: Team, s?: GameState | null): MatchResult {
  const bg = !!(s && (s.pc || s.pa || (s.derby && (h.id === s.me || a.id === s.me))));
  const H = rate(h, s, bg);
  const G = rate(a, s, bg);
  if (h.pass === 3 && G.at > H.at) H.at += 3;
  if (a.pass === 3 && H.at > G.at) G.at += 3;

  // Divine fortune / hot-streak spark ("พรสิ่งศักดิ์สิทธิ์") — underdogs/disadvantaged clubs receive blessings significantly more often
  const incidents: MatchDramaticEvent[] = [];
  let luckH = 0;
  let luckA = 0;
  let blessedHomeHero: Player | null = null;
  let blessedAwayHero: Player | null = null;
  const powH = H.at + H.df;
  const powA = G.at + G.df;
  const diffH = powA - powH;
  const blessChanceH = clamp((bg ? 0.27 : 0.20) + clamp(diffH / 16, -0.11, 0.28), 0.08, 0.50);
  const blessChanceA = clamp((bg ? 0.27 : 0.20) + clamp(-diffH / 16, -0.11, 0.28), 0.08, 0.50);
  if (Math.random() < blessChanceH) {
    const gap = Math.max(0, diffH);
    luckH = R(4, 7) + (gap > 8 ? 3 : 0);
    H.at += luckH;
    H.df += Math.round(luckH * 0.7);
    blessedHomeHero = H.x.length ? P(H.x) : null;
  }
  if (Math.random() < blessChanceA) {
    const gap = Math.max(0, -diffH);
    luckA = R(4, 7) + (gap > 8 ? 3 : 0);
    G.at += luckA;
    G.df += Math.round(luckA * 0.7);
    blessedAwayHero = G.x.length ? P(G.x) : null;
  }

  const lamH = Math.min(5, 1.35 * Math.exp((H.at - G.df) / 20 + 0.1));
  const lamA = Math.min(5, 1.35 * Math.exp((G.at - H.df) / 20 - 0.05));
  let gh = pois(lamH);
  let ga = pois(lamA);
  let evs = [...genMatchGoals(h, H.x, gh, s?.p), ...genMatchGoals(a, G.x, ga, s?.p)].sort((x, y) => x.m - y.m);

  // Realistic Own Goal ("ทำเข้าประตูตัวเอง") conversion on deflected/chaotic moments
  if (evs.length > 0 && Math.random() < (bg ? 0.075 : 0.055)) {
    const ogIdx = R(0, evs.length - 1);
    const targetEv = evs[ogIdx];
    const concPool = targetEv.t === h.id ? G.x : H.x;
    const concTeam = targetEv.t === h.id ? a : h;
    const ogCandidates = concPool.filter((q) => q.pos === 'DF' || q.pos === 'MF' || q.pos === 'GK');
    const ogCulprit = ogCandidates.length ? P(ogCandidates) : concPool[0];
    if (ogCulprit) {
      evs[ogIdx] = {
        ...targetEv,
        who: ogCulprit.n,
        as: '',
        style: 'own_goal',
        og: true
      };
      incidents.push({
        m: targetEv.m,
        t: targetEv.t,
        kind: 'own_goal',
        text: `🤦 เข้าประตูตัวเอง! ${ogCulprit.n} (${concTeam.name}) สกัดบอลพลาดแฉลบเข้าประตูตัวเอง`
      });
    }
  }

  // Miracle rapid comeback ("ปาฏิหาริย์พลิกนรก") when trailing by 2+ goals
  const deficitAbs = Math.abs(gh - ga);
  if (deficitAbs >= 2) {
    const miracleChance = deficitAbs >= 3 ? (bg ? 0.13 : 0.095) : (bg ? 0.09 : 0.065);
    if (Math.random() < miracleChance) {
      const trailingHome = gh < ga;
      const rallyTeam = trailingHome ? h : a;
      const rallyPool = trailingHome ? H.x : G.x;
      // Push early/mid goals earlier so the final surge feels like a rapid comeback!
      evs.forEach((ev) => {
        if (ev.m > 68) ev.m = R(12, 66);
      });
      const rallyGoals = deficitAbs + (Math.random() < 0.65 ? 1 : 0);
      const startBurstMin = R(70, 77);
      const addedEvs = genMatchGoals(rallyTeam, rallyPool, rallyGoals, s?.p).map((ev, idx) => ({
        ...ev,
        m: clamp(startBurstMin + idx * R(2, 4) + R(0, 2), 70, 90)
      }));
      evs = [...evs, ...addedEvs].sort((x, y) => x.m - y.m);
      if (trailingHome) gh += rallyGoals;
      else ga += rallyGoals;
      incidents.push({
        m: startBurstMin,
        t: rallyTeam.id,
        kind: 'miracle',
        text: `⚡ ปาฏิหาริย์พลิกนรก! ${rallyTeam.name} โดนนำห่างแต่ฮึดรัว ${rallyGoals} ประตูติดในช่วงท้ายเกม!`
      });
    }
  }

  if (blessedHomeHero && gh > 0) {
    incidents.push({
      m: R(22, 78),
      t: h.id,
      kind: 'blessed',
      text: `✨ ${blessedHomeHero.n} (${h.name}) เหมือนได้รับพรสิ่งศักดิ์สิทธิ์ ฟอร์มเข้าฝักทำอะไรก็ดีไปหมด!`
    });
  } else if (blessedAwayHero && ga > 0) {
    incidents.push({
      m: R(22, 78),
      t: a.id,
      kind: 'blessed',
      text: `✨ ${blessedAwayHero.n} (${a.name}) เหมือนได้รับพรสิ่งศักดิ์สิทธิ์ ฟอร์มเข้าฝักทำอะไรก็ดีไปหมด!`
    });
  }

  const xgH = Math.max(0.1, Math.round((lamH * 0.85 + gh * 0.18 + R(-10, 15) / 100) * 100) / 100);
  const xgA = Math.max(0.1, Math.round((lamA * 0.85 + ga * 0.18 + R(-10, 15) / 100) * 100) / 100);
  const { cards, subs, playedNames, playedSlots } = simMatchCardsAndSubs(h, a, s);

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
  if (Math.random() < (bg ? 0.14 : 0.09)) {
    const slipTeam = Math.random() < 0.5 ? h : a;
    const slipPool = (slipTeam.id === h.id ? H.x : G.x).filter((q) => q.pos !== 'GK');
    const slipPlayer = slipPool.length ? P(slipPool) : slipTeam.sq[0];
    if (slipPlayer) {
      incidents.push({
        m: R(14, 86),
        t: slipTeam.id,
        kind: 'slip',
        text: `💦 จังหวะเสียว! ${slipPlayer.n} (${slipTeam.name}) ลื่นล้มเสียหลักบนพื้นหญ้ากลางจังหวะสำคัญ`
      });
    }
  }
  if (Math.random() < (bg ? 0.14 : 0.10)) {
    const whiffTeam = Math.random() < 0.5 ? h : a;
    const whiffPool = (whiffTeam.id === h.id ? H.x : G.x).filter((q) => q.pos === 'FW' || q.pos === 'MF');
    const whiffPlayer = whiffPool.length ? P(whiffPool) : whiffTeam.sq[0];
    if (whiffPlayer) {
      incidents.push({
        m: R(16, 88),
        t: whiffTeam.id,
        kind: 'whiff',
        text: `💨 พลาดโอกาสทอง! ${whiffPlayer.n} (${whiffTeam.name}) ง้างเท้ายิงจ่อๆ แต่เตะวืดลมอย่างน่าเสียดาย`
      });
    }
  }

  const baseRes: MatchResult = { gh, ga, evs, xgH, xgA, cards, subs, playedNames, playedSlots, incidents };
  const { ratings, motm } = computePlayerRatings(h, a, baseRes, s?.p);
  return { ...baseRes, ratings, motm };
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
      case 'own_goal':
        return 'ทำเข้าประตูตัวเอง (OG)';
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

    const tags: string[] = [];
    if (ev.m >= 86 && (runH === runA || Math.abs(runH - runA) === 1)) {
      tags.push('ประตูนาทีบาป!');
    } else if (runH === runA) {
      tags.push('ตีเสมอ');
    } else if (idx === 0) {
      tags.push('เบิกร่อง');
    }
    if (!ev.og) {
      goalTallies[ev.who] = (goalTallies[ev.who] || 0) + 1;
      const count = goalTallies[ev.who];
      if (count === 3) tags.push('แฮตทริก!!');
      else if (count === 2) tags.push('เบิ้ล');
    } else {
      tags.push('OG');
    }

    const tName = teamName(ev.t);
    const verb = styleDesc(ev.style);
    const asTxt = !ev.og && ev.as ? ` · แอสซิสต์ ${ev.as}` : '';
    const tagTxt = tags.length ? ` [${tags.join(' · ')}]` : '';
    lines.push({
      m: ev.m,
      kind: 'goal',
      teamId: ev.t,
      text: ev.og
        ? `🤦 ${ev.who} ทำเข้าประตูตัวเอง! (${tName} ได้ประตู ${runH}-${runA})${tagTxt}`
        : `⚽ ${ev.who} (${tName}) ${verb} (${runH}-${runA})${asTxt}${tagTxt}`
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
        lg.text.includes('ปาเนนก้า') ||
        lg.text.includes('ปาฏิหาริย์') ||
        lg.text.includes('สิ่งศักดิ์สิทธิ์') ||
        lg.text.includes('ลื่นล้ม') ||
        lg.text.includes('เตะวืด') ||
        lg.text.includes('เข้าประตูตัวเอง');
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
      const gl = r.evs.filter((e) => !e.og && e.t === team.id && e.who === q.n).length;
      const ogCount = r.evs.filter((e) => e.og && e.t !== team.id && e.who === q.n).length;
      const as = r.evs.filter((e) => !e.og && e.t === team.id && e.as === q.n).length;
      const csBonus = (q.pos === 'GK' || q.pos === 'DF') && (ga as number) === 0 ? 0.65 : 0;
      const concedePenalty = (q.pos === 'GK' || q.pos === 'DF') && (ga as number) >= 3 ? -0.35 : 0;
      const roleScore =
        q.pos === 'FW'
          ? (D.d.fin * 0.35 + D.d.run * 0.25 + D.d.pw * 0.15 + D.d.cur * 0.15 + D.d.spd * 0.1)
          : q.pos === 'MF'
            ? (D.a.ps * 0.22 + D.d.spass * 0.14 + D.d.lpass * 0.12 + D.a.dr * 0.16 + D.d.crs * 0.12 + D.d.rd * 0.12 + D.d.sta * 0.12)
            : q.pos === 'DF'
              ? (D.d.rd * 0.25 + D.d.pos * 0.25 + D.d.mrk * 0.2 + D.d.blk * 0.15 + D.d.hd * 0.15)
              : (D.d.sv * 0.32 + (D.d.rfx ?? D.d.sv) * 0.18 + (D.d.hnd ?? D.d.sv) * 0.16 + D.d.cl * 0.14 + (D.d.pos ?? D.d.sv) * 0.1 + D.d.dist * 0.1);
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
        gl * 1.1 -
        ogCount * 1.15 +
        as * 0.7 +
        csBonus +
        concedePenalty +
        statEdge +
        defWorkBonus +
        ((q.ov - 55) / 90) +
        (Math.random() - 0.5) * 0.7;
      const rt = clamp(Math.round(raw * 10) / 10, 4.2, 10.0);
      ratings[q.n] = rt;
      if (rt > bestR) {
        bestR = rt;
        bestN = q.n;
      }
    });
  });
  return { ratings, motm: bestN };
}

export function ensureTeamFans(t?: Team | null): number {
  if (!t) return 10000;
  if (typeof t.fans === 'number' && Number.isFinite(t.fans) && t.fans > 0) {
    return Math.round(t.fans);
  }
  const tierBase = [9500, 26000, 78000, 165000][t.tier ?? 0] ?? 24000;
  const ovAvg = t.sq?.length ? t.sq.slice(0, 11).reduce((sum, q) => sum + q.ov, 0) / Math.min(11, t.sq.length) : 60;
  const diffBonus = clamp((ovAvg - (BASE[t.tier ?? 0] ?? 60)) * 0.035, -0.32, 0.55);
  const seed = ((t.id + 1) * 7919) % 31;
  const est = Math.max(2500, Math.round(tierBase * (1 + diffBonus) + (seed - 15) * (t.tier + 1) * 180));
  t.fans = est;
  return est;
}

export function fmtFans(n: number): string {
  return Math.max(0, Math.round(n || 0)).toLocaleString('en-US');
}

export function fmtFansShort(n: number): string {
  const v = Math.max(0, Math.round(n || 0));
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 100_000) return `${Math.round(v / 1_000)}K`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString('en-US');
}

export function adjustTeamFans(t: Team | undefined | null, delta: number): number {
  if (!t) return 0;
  const cur = ensureTeamFans(t);
  const next = Math.max(500, Math.round(cur + delta));
  t.fans = next;
  return next;
}

export function updateTeamsFanbaseOnMatch(
  h: Team,
  gh: number,
  a: Team,
  ga: number,
  opts?: { kind?: 'league' | 'cup' | 'asia'; big?: boolean }
) {
  const curH = ensureTeamFans(h);
  const curA = ensureTeamFans(a);
  const kindMul = opts?.kind === 'asia' ? 1.55 : opts?.kind === 'cup' ? 1.25 : 1.0;
  const bigMul = opts?.big ? 1.25 : 1.0;
  const margin = Math.abs(gh - ga);
  const upsetForH = a.tier > h.tier || curA > curH * 1.4;
  const upsetForA = h.tier > a.tier || curH > curA * 1.4;

  let dH = 0;
  let dA = 0;
  const scaleH = Math.max(120, Math.round(Math.sqrt(curH) * 2.2));
  const scaleA = Math.max(120, Math.round(Math.sqrt(curA) * 2.2));

  if (gh > ga) {
    dH = Math.round(scaleH * (0.95 + Math.min(3, margin - 1) * 0.28 + (upsetForH ? 0.65 : 0)) * kindMul * bigMul);
    dA = -Math.round(scaleA * (upsetForH ? 0.42 : 0.22) * (1 + Math.min(2, margin - 1) * 0.15));
  } else if (gh < ga) {
    dA = Math.round(scaleA * (1.05 + Math.min(3, margin - 1) * 0.3 + (upsetForA ? 0.72 : 0)) * kindMul * bigMul);
    dH = -Math.round(scaleH * (upsetForA ? 0.5 : 0.32) * (1 + Math.min(2, margin - 1) * 0.16));
  } else {
    dH = upsetForH ? Math.round(scaleH * 0.35 * kindMul) : -Math.round(scaleH * 0.06);
    dA = Math.round(scaleA * (upsetForA ? 0.48 : 0.18) * kindMul);
  }
  if (gh >= 3) dH += Math.round(scaleH * 0.18);
  if (ga >= 3) dA += Math.round(scaleA * 0.18);

  adjustTeamFans(h, dH);
  adjustTeamFans(a, dA);
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
  updateTeamsFanbaseOnMatch(h, gh, a, ga, { kind: 'league' });
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

export const MAX_FACILITY_LV = 10;
export const MAX_STAFF_LV = 6;
export const STADIUM_CAPACITIES = [3500, 7500, 13000, 20000, 28000, 36000, 44000, 52000, 60000, 68000] as const;
export const STAFF_HIRE_COSTS = [45, 75, 115, 165, 225, 300] as const;
export const ALL_FACILITY_KEYS: readonly FacilityKey[] = ['st', 'tr', 'ya', 'med', 'merchLv', 'turfLv', 'analyticsLv'];

export function getFacilityUpgradeCost(baseCost: number, currentLv: number): number {
  if (currentLv <= 0) return Math.round(baseCost * 0.75);
  return Math.round(baseCost * currentLv * (1 + (currentLv - 1) * 0.25));
}

export function getFacilityDemolishRefund(baseCost: number, fromLv: number): number {
  if (fromLv <= 0) return 0;
  if (fromLv === 1) return Math.max(10, Math.round(baseCost * 0.35));
  return Math.max(12, Math.round(getFacilityUpgradeCost(baseCost, fromLv - 1) * 0.38));
}

export function getFacilityCondition(s: Pick<GameState, 'facCond'>, key: FacilityKey): number {
  return clamp(Math.round(s.facCond?.[key] ?? 100), 40, 100);
}

export function getFacilityRenovateCost(baseCost: number, currentLv: number, cond: number): number {
  if (cond >= 100 || currentLv <= 0) return 0;
  return Math.max(6, Math.round(baseCost * (0.2 + currentLv * 0.08) * ((100 - cond) / 100) * 1.4));
}

export function getStaffState(s: Pick<GameState, 'staff'>) {
  return {
    asst: s.staff?.asst ?? 0,
    fit: s.staff?.fit ?? 0,
    scout: s.staff?.scout ?? 0,
    physio: s.staff?.physio ?? 0,
    gkCoach: s.staff?.gkCoach ?? 0,
    setPieceCoach: s.staff?.setPieceCoach ?? 0
  };
}

export function getStaffWage(s: Pick<GameState, 'staff'>) {
  const st = getStaffState(s);
  return (st.asst + st.fit + st.scout + st.physio + st.gkCoach + st.setPieceCoach) * 1.2;
}

export function getLeagueTransferContext(s: GameState, me: Team) {
  const tw = getTransferWindowInfo(s);
  const loansCount = me.sq.filter((q) => !!q.loan).length;
  const curWage = squadWage(me);
  const baseCap = [26, 44, 70, 95][me.tier] ?? 44;
  const infraMult = 1 + Math.max(0, (s.st ?? 1) - 1) * 0.08 + Math.max(0, (s.merchLv ?? 1) - 1) * 0.04;
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

export function getTeamStadiumCapacity(t: Team, s?: GameState | null): number {
  if (s && t.id === s.me) {
    const stLv = clamp(s.st ?? 1, 1, MAX_FACILITY_LV);
    return STADIUM_CAPACITIES[stLv - 1] || 3500;
  }
  const fans = ensureTeamFans(t);
  const tierFloor = [4500, 9500, 18000, 32000][t.tier ?? 0] ?? 9000;
  const estLvIdx = clamp(
    Math.floor((fans / 18000) + (t.tier ?? 0) * 1.6),
    t.tier >= 3 ? 4 : t.tier >= 2 ? 2 : 0,
    STADIUM_CAPACITIES.length - 1
  );
  return Math.max(tierFloor, STADIUM_CAPACITIES[estLvIdx] || 13000);
}

export function computeMatchAttendance(
  h: Team,
  a: Team,
  s?: GameState | null,
  opts?: { kind?: 'league' | 'cup' | 'asia'; derby?: boolean }
): { att: number; cap: number; pct: number } {
  const cap = getTeamStadiumCapacity(h, s);
  const homeFans = ensureTeamFans(h);
  const awayFans = ensureTeamFans(a);
  const isUserHome = !!(s && h.id === s.me);
  const tpIdx = isUserHome ? clamp(s?.tp ?? 1, 0, 2) : 1;
  const priceMult = [1.14, 1.0, 0.82][tpIdx];
  const promoMult = isUserHome && s?.promo === 1 ? 1.15 : 1.0;
  const moodRatio = isUserHome && s ? clamp(((s.fan ?? 55) + getActiveBoardModifiers(s).fan) / 100, 0.15, 1.0) : 0.62;
  const recentWins = (h.fm || '').slice(-4).split('').filter((c) => c === 'W').length;
  const formBoost = recentWins * 0.03;
  const bigMatchBoost = opts?.kind === 'asia' ? 0.18 : opts?.kind === 'cup' ? 0.11 : opts?.derby ? 0.15 : 0;
  const fanbaseDraw = clamp(0.28 + (homeFans / Math.max(10000, cap * 1.85)) * 0.52, 0.28, 0.86);
  const awayTravel = clamp(awayFans / Math.max(60000, cap * 4), 0.02, 0.12);
  const fillRate = clamp(
    (fanbaseDraw * 0.65 + moodRatio * 0.35 + awayTravel + formBoost + bigMatchBoost) * priceMult * promoMult,
    0.22,
    0.99
  );
  const att = clamp(Math.round(cap * fillRate), Math.min(cap, 450), cap);
  return { att, cap, pct: Math.round((att / Math.max(1, cap)) * 100) };
}

export function calcMatchdayFinanceEstimate(s: GameState, me: Team) {
  const stLv = clamp(s.st ?? 1, 1, MAX_FACILITY_LV);
  const merchLv = clamp(s.merchLv ?? 1, 0, MAX_FACILITY_LV);
  const stCondMul = 0.85 + 0.15 * (getFacilityCondition(s, 'st') / 100);
  const merchCondMul = 0.85 + 0.15 * (getFacilityCondition(s, 'merchLv') / 100);
  const cap = STADIUM_CAPACITIES[stLv - 1] || 3500;
  const tpIdx = s.tp ?? 1;
  const spIdx = s.sp ?? 0;
  const bMods = getActiveBoardModifiers(s);
  const fanVal = clamp((s.fan ?? 55) + bMods.fan, 5, 100);
  const myFans = ensureTeamFans(me);
  const fanScale = clamp(0.65 + Math.log10(Math.max(1000, myFans) / 4000) * 0.42, 0.65, 1.55);
  const nxtRound = s.fx?.[s.md];
  const nxtPair = nxtRound?.find(([x]) => x === s.me);
  const oppTeam = nxtPair ? s.teams[nxtPair[1]] : me;
  const attEst = computeMatchAttendance(me, oppTeam || me, s, { kind: 'league', derby: !!s.derby });
  const estAtt = attEst.att;
  const attRate = attEst.pct / 100;
  const ticketPriceMult = [0.82, 1.0, 1.24][tpIdx];
  const estTicket = Math.round((8 + stLv * 6) * (fanVal / 60) * fanScale * ticketPriceMult * (s.promo === 1 ? 1.35 : 1) * stCondMul);
  const estMerch = merchLv <= 0 ? 0 : Math.round((2 + merchLv * 2.5) * (fanVal / 55) * fanScale * merchCondMul);
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
    diff?: number;
    player?: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'> & { age?: number };
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
    bd: 55,
    ...(opts.diff !== undefined ? { diff: opts.diff } : {})
  };

  if (mode === 'm') {
    ensureClubIdentity(s);
    setBoardObjective(s);
  } else if (opts.player) {
    const p = opts.player;
    const chosenNo = clamp(p.no || (p.pos === 'GK' ? 1 : p.pos === 'DF' ? 4 : p.pos === 'MF' ? 8 : 10), 1, 99);
    const startAge = clamp(Math.round(p.age ?? 17), 16, 22);
    const careerTalent = clamp(Math.round(p.talent ?? R(60, 92)), 40, 96);
    const careerTraits = p.traits && p.traits.length ? p.traits.slice(0, 5) : rollPlayerTraits(p.pos, p.sp, R(45, 58), careerTalent);
    const startLog = `🌱 เริ่มเส้นทางอาชีพกับ ${teams[meId].name} (${TN[teams[meId].tier]}) ในซีซั่น 1`;
    const fallbackBio = rollPlayerBio(p.pos, p.sp, p.name);
    const startHt = clamp(Math.round(p.ht ?? fallbackBio.ht), 155, 205);
    const startWt = clamp(Math.round(p.wt ?? fallbackBio.wt), 50, 110);
    const startFoot = p.foot === 'L' || p.foot === 'R' || p.foot === 'B' ? p.foot : fallbackBio.foot;
    s.p = {
      ...p,
      ht: startHt,
      wt: startWt,
      foot: startFoot,
      talent: careerTalent,
      traits: careerTraits,
      no: chosenNo,
      b: { ...p.a },
      sb: p.sb ? { ...p.sb } : {},
      age: startAge,
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
      careerLog: [startLog],
      history: []
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
      age: startAge,
      ht: startHt,
      wt: startWt,
      foot: startFoot,
      pot: clamp(Math.max(R(87, 95), careerTalent + 6), ov + 18, 96),
      talent: careerTalent,
      traits: careerTraits,
      fit: 100,
      inj: 0,
      no: chosenNo,
      me: 1,
      hg: 1,
      customCreated: 1,
      signedSeason: 1,
      careerLog: [startLog],
      history: [],
      vis: [ki >= 0 ? ki : 2, hi >= 0 ? hi : 0, p.hs ?? 0, p.fh ?? 0, p.ey ?? 0, chosenNo, p.fs ?? 0, p.acc ?? 0]
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
      q.srs = 0;
      q.sra = 0;
      q.motm = 0;
      q.tyc = 0;
    });
    assignTeamShirtNumbers(t);
    t.sq.forEach((q) => {
      recordPlayerSeasonProgress(q, s.season ?? 1, 0, q.me ? s.p : null, true);
    });
  });

  ensureAiTeamPhilosophies(s, true);

  if (s.p) {
    s.p.en = 100;
    s.p.gd = 0;
    s.p.yc = 0;
    s.p.rc = 0;
    s.p.sus = 0;
    s.p.s0 = { gl: s.p.gl, as: s.p.as, ap: s.p.ap };
  }

  const mt = s.teams[s.me].tier;
  s.lg = mt;
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
  if (s.mode === 'm') {
    setBoardObjective(s);
    s.boardDirective = null;
    s.boardDirectiveCd = 1;
    s.boardEffects = [];
    s.boardFeedbackLog = s.boardFeedbackLog || [];
    const targetRank = s.obj || 8;
    s.boardFeedbackLog.unshift({
      season: s.season ?? 1,
      md: 0,
      tone: 'warn',
      msg: `บอร์ดบริหารตั้งเป้าหมายฤดูกาลที่ ${s.season}: จบอย่างน้อยอันดับ ${targetRank} พร้อมรักษาเสถียรภาพการเงิน`
    });
    if (s.boardFeedbackLog.length > 8) s.boardFeedbackLog.length = 8;
  }
  s.finPendIn = 0;
  s.finPendOut = 0;
  recordFinanceSnapshot(s);
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
      const matchRt = r.ratings?.[q.n];
      if (typeof matchRt === 'number' && matchRt > 0) {
        q.srs = (q.srs || 0) + matchRt;
        q.sra = (q.sra || 0) + 1;
      }
      if (r.motm && r.motm === q.n) {
        q.motm = (q.motm || 0) + 1;
      }
    });
  });
  r.evs.forEach((e) => {
    const t = sTeamSafe(h, a, e.t);
    if (!t) return;
    if (e.og) return;
    const q = t.sq.find((z) => z.n === e.who);
    if (q) q.sg = (q.sg || 0) + 1;
    const w = e.as && t.sq.find((z) => z.n === e.as);
    if (w) w.sa = (w.sa || 0) + 1;
  });
}

const ROLE_ADAPT_TARGETS: Record<string, { cores: StatKey[]; subs: string[] }> = {
  ST: { cores: ['sh', 'ph'], subs: ['fin', 'pw', 'run', 'hd'] },
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
  GK: { cores: ['ph', 'tk'], subs: ['sv', 'rfx', 'hnd', 'cl', 'pos', 'dist'] }
};

export const ROLE_ADAPT_THRESHOLD_ADJ = 4;
export const ROLE_ADAPT_THRESHOLD_CROSS = 6;

export function applyPositionAdaptation(
  s: GameState | null,
  h: Team,
  a: Team,
  r: MatchResult
) {
  [h, a].forEach((tm) => {
    const slots = getFormationSlots(tm);
    const starterList = xi(tm);
    const explicitSlots = r.playedSlots?.[tm.id];
    const playedSet = r.playedNames?.[tm.id]?.length
      ? new Set(r.playedNames[tm.id])
      : new Set(starterList.map((q) => q.n));

    tm.sq.forEach((q) => {
      if (!playedSet.has(q.n)) return;
      let rawSlotSp: SubRole | undefined = explicitSlots?.[q.n];
      if (!rawSlotSp) {
        const sIdx = starterList.findIndex((st) => st.n === q.n);
        if (sIdx >= 0) rawSlotSp = slots[sIdx]?.sp;
      }
      if (!rawSlotSp) return;
      const normSlot = (rawSlotSp === 'LCM' || rawSlotSp === 'RCM'
        ? 'CM'
        : rawSlotSp === 'LDM' || rawSlotSp === 'RDM'
          ? 'CDM'
          : rawSlotSp) as SubRole;

      // Never convert outfielders to GK unless genuinely played there, or GK to outfield trivially
      if (q.pos === 'GK' && normSlot !== 'GK') return;
      if (q.pos !== 'GK' && normSlot === 'GK') return;

      const curPen = playerPen(q, normSlot);
      if (curPen <= 0) return;

      const isMyTeam = !!s && tm.id === s.me;
      const isMePlayer = !!q.me && !!s?.p;
      const threshold = curPen === 1 ? ROLE_ADAPT_THRESHOLD_ADJ : ROLE_ADAPT_THRESHOLD_CROSS;
      const age = q.age || 24;
      const tl = q.talent ?? 55;
      const persTr = DT(q, isMePlayer ? s?.p : null).tr;
      const hasAdaptTrait = hasTrait(q, 'versatile_utility', isMePlayer ? s?.p : null);
      const hasAdaptPerk = isMePlayer && Boolean(s?.p?.perks?.includes('adaptable'));
      const fastAdapt = persTr === 10 || persTr === 12 || persTr === 23 || hasAdaptTrait || hasAdaptPerk;
      let bonusExp = (age <= 22 || tl >= 76) && Math.random() < 0.35 ? 2 : 1;
      if (hasAdaptPerk) bonusExp += 1;
      else if (fastAdapt && Math.random() < 0.65) bonusExp += 1;

      q.roleExp = { ...(q.roleExp || {}) };
      q.roleExp[normSlot] = (q.roleExp[normSlot] || 0) + bonusExp;

      // Gradually develop attributes toward the unfamiliar position's demands (diminishing returns at higher OVR)
      const target = ROLE_ADAPT_TARGETS[normSlot] || ROLE_ADAPT_TARGETS.CM;
      const devNotes: string[] = [];
      const curOv = isMePlayer && s?.p ? ovMe(s.p) : q.ov;
      const devProf = getPlayerDevProfile(q, isMePlayer ? s?.p : null);
      const ovScale = getOvGrowthScale(curOv, q.pot);
      if (devProf.phase !== 'declining') {
        const subChance = ((age <= 24 ? 0.22 : 0.14) + (fastAdapt ? 0.06 : 0)) * (0.45 + 0.55 * ovScale) * devProf.ageMult;
        if (Math.random() < subChance) {
          const sk = P(target.subs);
          q.sb = { ...(q.sb || {}) };
          q.sb[sk] = (q.sb[sk] || 0) + 1;
          if (isMePlayer && s?.p) {
            s.p.sb = { ...(s.p.sb || {}) };
            s.p.sb[sk] = (s.p.sb[sk] || 0) + 1;
            if (s.p.customD && s.p.customD[sk] != null) s.p.customD[sk] = clamp(s.p.customD[sk] + 1, 1, 99);
          }
          devNotes.push(`${SIGL[sk] || sk} +1`);
        }

        const coreChance = ((age <= 24 ? 0.055 : 0.03) + (tl >= 75 ? 0.025 : 0) + (fastAdapt ? 0.025 : 0)) * ovScale * devProf.ageMult;
        const softCap = clamp(q.pot || 86, 50, 96);
        if (curOv < softCap && Math.random() < coreChance) {
          const ck = P(target.cores);
          if (isMePlayer && s?.p) {
            if (s.p.a[ck] < 96) {
              s.p.a[ck] = clamp(s.p.a[ck] + 1, 1, 99);
              q.ov = ovMe(s.p);
              if (q.blessed && q.customA) q.customA = { ...s.p.a };
              devNotes.push(`${ATT.find((x) => x[0] === ck)?.[1] || ck} +1`);
            }
          } else {
            q.coreSb = { ...(q.coreSb || {}) };
            q.coreSb[ck] = (q.coreSb[ck] || 0) + 1;
            if (q.customA) q.customA[ck] = clamp(q.customA[ck] + 1, 1, 99);
            const dtAfter = DT(q, null);
            const newOv = clamp(OVF(q.pos, dtAfter.a), 1, softCap);
            if (newOv > q.ov) q.ov = newOv;
            devNotes.push(`${ATT.find((x) => x[0] === ck)?.[1] || ck} +1`);
          }
        }
      }

      // Unlock new playable position once adapted
      if (q.roleExp[normSlot] >= threshold) {
        const nextAlt = Array.from(new Set([...(q.altRoles || []), normSlot])).filter((r) => r !== q.ro);
        q.altRoles = nextAlt;
        delete q.roleExp[normSlot];

        // Mastery bonus on unlock
        const masterSub = target.subs[0];
        q.sb = { ...(q.sb || {}) };
        q.sb[masterSub] = (q.sb[masterSub] || 0) + 1;
        if (isMePlayer && s?.p) {
          s.p.altRoles = [...nextAlt];
          s.p.roleExp = { ...q.roleExp };
          s.p.sb = { ...(s.p.sb || {}) };
          s.p.sb[masterSub] = (s.p.sb[masterSub] || 0) + 1;
        }
        if (s && (isMyTeam || isMePlayer)) {
          const roleLabel = SPN[normSlot] || normSlot;
          pushFeed(
            s,
            'ตำแหน่งใหม่',
            `🧩 ${q.n} เล่นตำแหน่ง ${normSlot} (${roleLabel}) จนชำนาญและปลดล็อกเป็นตำแหน่งถนัดเพิ่มแล้ว!`,
            'ok'
          );
          appendPlayerCareerLog(
            q,
            `🧩 ซีซั่น ${s.season}: ปลดล็อกตำแหน่งถนัดใหม่ ${normSlot} (${roleLabel})`,
            isMePlayer ? s.p : null
          );
        }
      } else {
        if (isMePlayer && s?.p) {
          s.p.roleExp = { ...q.roleExp };
        }
        if (devNotes.length && s && (isMePlayer || (isMyTeam && devNotes.some((n) => !n.includes('เซฟ')) && Math.random() < 0.45))) {
          pushFeed(
            s,
            'ปรับตัวตำแหน่ง',
            `🔄 ${q.n} ซึมซับบทบาท ${normSlot} พัฒนา ${devNotes.join(', ')} (${q.roleExp[normSlot]}/${threshold})`,
            'ok'
          );
        }
      }
    });
  });
}

export function maybeAiCoachExperimentTactics(s: GameState) {
  const curMd = s.md ?? 0;
  if (curMd < 2) return;

  s.teams.forEach((t) => {
    if (s.mode === 'm' && t.id === s.me) return;
    const recent = (t.fm || '').slice(-5);
    if (recent.length < 2) return;
    const last2 = recent.slice(-2);
    const last3 = recent.slice(-3);
    const losses5 = recent.split('').filter((ch) => ch === 'L').length;
    const winless4 = recent.length >= 4 && !recent.includes('W');

    if (last2 !== 'LL' && last3 !== 'LLL' && losses5 < 3 && !winless4) return;
    if (t.tacticTrialMd != null && curMd - t.tacticTrialMd < 2) return;

    const tryChance = last3 === 'LLL' ? 0.65 : losses5 >= 4 ? 0.75 : last2 === 'LL' ? 0.34 : 0.42;
    if (Math.random() >= tryChance) return;

    const fitSquad = t.sq.filter((q) => q.inj <= 0 && (q.sus || 0) <= 0);
    const availCounts: Record<Position, number> = {
      GK: fitSquad.filter((q) => q.pos === 'GK').length,
      DF: fitSquad.filter((q) => q.pos === 'DF').length,
      MF: fitSquad.filter((q) => q.pos === 'MF').length,
      FW: fitSquad.filter((q) => q.pos === 'FW').length
    };
    const concedingLots = t.ga > t.gf + 3;
    const lowScoring = t.gf < Math.max(1, t.p) * 0.9;

    const diffFormCandidates = CLUB_PHILOSOPHIES.filter((ph) => ph.form !== t.form);
    const candidates = diffFormCandidates.length ? diffFormCandidates : CLUB_PHILOSOPHIES.filter((ph) => ph.name !== t.philosophy);
    if (!candidates.length) return;

    const scored = candidates
      .map((ph) => {
        const slots = FSD[ph.form] || FSD['4-4-2'];
        const needDF = slots.filter(([sp]) => LINE[sp] === 'DF').length;
        const needMF = slots.filter(([sp]) => LINE[sp] === 'MF').length;
        const needFW = slots.filter(([sp]) => LINE[sp] === 'FW').length;

        let score = 10;
        score -= Math.max(0, needDF - availCounts.DF) * 4;
        score -= Math.max(0, needMF - availCounts.MF) * 4;
        score -= Math.max(0, needFW - availCounts.FW) * 4;
        if (concedingLots && (ph.styleGroup === 'counter' || ph.styleGroup === 'balanced' || needDF >= 4)) score += 3.5;
        if (lowScoring && (ph.styleGroup === 'attack' || ph.styleGroup === 'control' || needFW >= 2)) score += 3.5;
        score += Math.random() * 4.5;
        return { ph, score };
      })
      .sort((a, b) => b.score - a.score);

    const pickPool = scored.slice(0, Math.min(3, scored.length));
    const chosen = pickPool[Math.floor(Math.random() * pickPool.length)]?.ph;
    if (!chosen) return;

    applyClubPhilosophy(t, chosen);
    t.tacticTrialMd = curMd;
    t.tacticTrialLabel = `ทดลองแผน ${chosen.form} (${chosen.name})`;
    t.tacFam = clamp(R(60, 74), 48, 86);

    if (s.mode === 'p' && t.id === s.me) {
      pushFeed(
        s,
        'โค้ชลองแผนใหม่',
        `🧭 โค้ชทดลองเปลี่ยนแผนใหม่เป็น ${chosen.form} (${chosen.name}) เพื่อแก้เกมหลังผลงานทีมสะดุด!`,
        'urg'
      );
    } else if (t.tier === s.teams[s.me]?.tier && Math.random() < 0.3) {
      pushFeed(
        s,
        'ข่าวลีก',
        `🧭 โค้ช ${t.name} ทดลองปรับแผนใหม่เป็น ${chosen.form} (${chosen.name}) หลังแพ้ต่อเนื่อง`,
        ''
      );
    }
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
      q.tyc = (q.tyc || 0) + 1;
      q.rc = (q.rc || 0) + 1;
      q.sus = (q.sus || 0) + 1;
      if (isMyTeam) {
        pushFeed(s, 'โดนแบน', `🟨🟨➡🟥 ${q.n} โดนใบเหลือง-แดง! ติดโทษแบน 1 นัด`, 'urg');
      }
    } else {
      q.tyc = (q.tyc || 0) + 1;
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
  const gl = r.evs.filter((e) => !e.og && e.t === s.me && e.who === p.name).length;
  const as = r.evs.filter((e) => !e.og && e.t === s.me && e.as === p.name).length;
  const ogPenalty = r.evs.filter((e) => e.og && e.t !== s.me && e.who === p.name).length * 1.1;
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
        ? (D.a.ps * 0.22 + D.d.spass * 0.14 + D.d.lpass * 0.12 + D.a.dr * 0.16 + D.d.crs * 0.12 + D.d.rd * 0.12 + D.d.sta * 0.12 - 60) / 90
        : p.pos === 'DF'
          ? (D.d.rd * 0.25 + D.d.pos * 0.25 + D.d.mrk * 0.2 + D.d.blk * 0.15 + D.d.hd * 0.15 - 60) / 90
          : (D.d.sv * 0.32 + (D.d.rfx ?? D.d.sv) * 0.18 + (D.d.hnd ?? D.d.sv) * 0.16 + D.d.cl * 0.14 + (D.d.pos ?? D.d.sv) * 0.1 + D.d.dist * 0.1 - 60) / 90;

  const baseRt =
    matchRatings?.[p.name] != null
      ? matchRatings[p.name]
      : 6.2 +
        (my > op ? 0.5 : my < op ? -0.4 : 0) +
        gl * 0.9 -
        ogPenalty +
        as * 0.6 +
        (bk ? (op === 0 ? 0.6 : op >= 3 ? -0.5 : 0) : 0) +
        clamp((ovMe(p) - 60) / 70, -0.4, 0.5) +
        subEdge +
        (Math.random() - 0.5) * 0.8;

  const minAdj = mins < 35 ? -0.2 : 0;
  const ycPenaltyUnit = perks.includes('discipline_pro') ? 0.1 : 0.25;
  const cardPenalty = (meta?.yc || 0) * ycPenaltyUnit + (meta?.rc || 0) * 1.4;
  const perkBonus =
    (perks.includes('sharp_shooter') && (gl > 0 || as > 0) ? 0.35 : 0) +
    (perks.includes('media_darling') ? 0.25 : 0) +
    (perks.includes('tactical_mind') && my >= op ? 0.25 : 0) +
    (perks.includes('playmaker_eye') && as > 0 ? 0.3 * Math.min(2, as) : 0) +
    (perks.includes('wall_defender') && op <= 1 ? (op === 0 ? 0.45 : 0.2) : 0) +
    (perks.includes('adaptable') ? 0.15 : 0);
  const persBonus =
    ((D.tr === 4 || D.tr === 16) && (s.pc || s.pa || s.derby) ? 0.28 : 0) +
    (D.tr === 5 || D.tr === 22 ? (Math.random() < 0.65 ? 0.35 : -0.25) : 0) +
    ((D.tr === 9 || D.tr === 17) && my <= op ? 0.22 : 0) +
    ((D.tr === 11 || D.tr === 12 || D.tr === 20) && my > op ? 0.22 : 0) +
    (D.tr === 14 && op <= 1 ? 0.2 : 0) +
    (D.tr === 23 ? 0.16 : 0) -
    (D.tr === 19 && my < op ? 0.18 : 0);
  const fatigueRatingAdj = perks.includes('iron_will') && en < 65 ? 0.22 : (en - 70) / 140;

  let rt =
    baseRt +
    fatigueRatingAdj +
    (D.d.tol - 65) / 350 +
    vid +
    bigBonus +
    fanBonus +
    perkBonus +
    persBonus +
    minAdj -
    cardPenalty;

  rt = clamp(Math.round(rt * 10) / 10, 3.8, 10);
  const meSqRef = s.teams[s.me]?.sq.find((q) => q.me);
  const ovScale = getOvGrowthScale(ovMe(p), meSqRef?.pot);
  const devMult = meSqRef ? getPlayerDevProfile(meSqRef, p).ageMult : 1;
  const b = () => (Math.random() < (mins >= 60 ? 0.14 : 0.08) * ovScale * devMult ? 1 : 0);
  return {
    rt,
    gl,
    as,
    my,
    op,
    vid,
    en,
    pts: b() + (rt >= 7.2 ? b() : 0) + (rt >= 8.6 ? b() : 0),
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
  const prevGl = p.gl;
  const prevAp = p.ap;
  p.sat = 0;
  p.ap++;
  p.fm = [...(p.fm || []), f.rt].slice(-5);
  p.rs += f.rt;
  p.gl += f.gl;
  p.as += f.as;
  const fameBonus = (p.perks || []).includes('fame_magnet') ? 2 : 0;
  p.rep = (p.rep || 0) + (f.rt >= 7.5 ? 3 : f.rt >= 6.8 ? 1 : 0) + f.gl * 2 + f.as + fameBonus;
  if (f.pts > 0) f.grew = autoGrow(p, f.pts);
  p.vid = 0;
  const fanGain = (p.perks || []).includes('captain') ? 3 : 2;
  s.fan = clamp((s.fan ?? 50) + (f.my > f.op ? fanGain : f.my < f.op ? -2 : 0) + (f.gl ? 1 : 0), 5, 100);
  if (f.gl > 0 || f.as > 0 || f.rt >= 7.6) {
    adjustTeamFans(s.teams[s.me], (f.gl * 180 + f.as * 90 + (f.rt >= 7.6 ? 160 : 0)) * ((p.perks || []).includes('fame_magnet') ? 1.5 : 1));
  }

  const meSq = s.teams[s.me]?.sq.find((q) => q.me);
  if (f.gl >= 3) {
    appendPlayerCareerLog(meSq, `🎩 ซัดแฮตทริก ${f.gl} ประตูในซีซั่น ${s.season} นัด ${Math.max(1, s.md)}`, p);
  }
  const goalMilestone = [10, 25, 50, 100, 150, 200].find((m) => prevGl < m && p.gl >= m);
  if (goalMilestone) {
    appendPlayerCareerLog(meSq, `⚽ ยิงครบ ${goalMilestone} ประตูในอาชีพ (ซีซั่น ${s.season})`, p);
  }
  const appMilestone = [50, 100, 150, 200, 300].find((m) => prevAp < m && p.ap >= m);
  if (appMilestone) {
    appendPlayerCareerLog(meSq, `👕 ลงเล่นครบ ${appMilestone} นัดในอาชีพ (ซีซั่น ${s.season})`, p);
  }
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
  const persFitBonus = D.tr === 2 || D.tr === 6 || D.tr === 18 || D.tr === 23 ? 3 : D.tr === 7 || D.tr === 19 ? -3 : 0;
  const healEnBonus = perks.includes('quick_healer') ? 6 : 0;
  const fatigueCost = Math.min(-4, baseFatigue + staBonus + tolBonus + persFitBonus);
  p.en = clamp((p.en ?? 100) + fatigueCost + ac.en + recBonus + healEnBonus + R(0, 7), 20, 100);
  let m = `${ac.i} ${ac.n}`;
  const focus = ({ FW: 'sh', MF: 'ps', DF: 'tk', GK: 'ph' } as Record<Position, StatKey>)[p.pos] || 'sh';
  const curOv = ovMe(p);
  const devProf = getPlayerDevProfile(mePlayer, p);
  const ovScale = getOvGrowthScale(curOv, mePlayer.pot);
  const prodigyBonus = (perks.includes('prodigy') ? 0.05 : 0) + (D.tr === 2 || D.tr === 10 || D.tr === 12 || D.tr === 23 ? 0.03 : 0);

  if (ac.gr) {
    const k = ac.k || P([focus, focus, p.tr || 'sh', P(['sh', 'ps', 'dr', 'tk', 'ph'] as StatKey[])]);
    const kn = ATT.find((z) => z[0] === k)?.[1] || k;
    const attrResistance = p.a[k] >= 90 ? 0.28 : p.a[k] >= 84 ? 0.52 : p.a[k] >= 78 ? 0.78 : 1;
    const grChance =
      (ac.gr * 0.75 + prodigyBonus + (p.tr === k || (p.tr === 'tk' && k === 'ph') ? 0.03 : 0)) *
      ovScale *
      attrResistance *
      devProf.ageMult *
      devProf.formMult;
    if (p.a[k] < 99 && devProf.phase !== 'declining' && Math.random() < grChance) {
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
    const fanAdded = Math.round(ac.fan * (140 + (s.teams[s.me]?.tier ?? 0) * 180));
    const totalFans = adjustTeamFans(s.teams[s.me], fanAdded);
    m += ` · แฟนบอล +${fmtFans(fanAdded)} (รวม ${fmtFansShort(totalFans)})`;
  }
  if (ac.pt && devProf.phase !== 'declining' && Math.random() < (ac.pt * 0.75 + prodigyBonus) * ovScale * devProf.ageMult) {
    const g = autoGrow(p, 1);
    if (g) m += ` · พัฒนาอัตโนมัติ (${g})`;
  }
  if (mePlayer.me && devProf.strongSeason) {
    const bt = trySuperstarBreakthrough(mePlayer, p, 0.03);
    if (bt.brokeThrough) {
      m += ` · 🌟 ทะลุขีดจำกัดศักยภาพสู่ ${bt.newPot}!`;
    }
  }
  if ((p.inj || 0) > 0) {
    const healStep = (p.plan === 2 ? 2 : 1) + (perks.includes('quick_healer') ? 1 : 0);
    p.inj = Math.max(0, (p.inj || 0) - healStep);
    m += p.inj === 0 ? ' · 🩹 หายเจ็บพร้อมลงสนาม!' : ` · 🩹 พักฟื้นเหลือ ${p.inj} นัด`;
  }
  const meSq = s.teams[s.me]?.sq.find((q) => q.me);
  if (meSq) {
    const { notes: trainMissionNotes, summary } = applyTrainingMissionProgress(meSq, {
      careerPlan: p.plan ?? 1,
      careerP: p,
      state: s
    });
    if (summary.upgraded.length) {
      const up = summary.upgraded[0];
      m += ` · 🎯 อัปพลัง "${up.mission}" ขั้น ${up.stage}! (${up.rewardText})`;
      pushFeed(s, 'ภารกิจอัปพลัง', `✨ ${p.name} ผ่านภารกิจ "${up.mission} ขั้น ${up.stage}" (โอกาส ${up.chance}%) → ${up.rewardText}`, 'ok');
    } else if (summary.failed.length) {
      const fl = summary.failed[0];
      m += ` · 💨 พลาด "${fl.mission}" ขั้น ${fl.stage} (${fl.chance}%)`;
      pushFeed(s, 'ภารกิจส่วนบุคคล', `💨 ${p.name} พลาดอัปพลัง "${fl.mission} ขั้น ${fl.stage}" (โอกาสติด ${fl.chance}%)`, '');
    } else if (trainMissionNotes.length) {
      m += ` · 🎯 ${trainMissionNotes[0]}`;
    }
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
  const analyticsLv = clamp(s.analyticsLv ?? 1, 0, MAX_FACILITY_LV);
  const yaLv = clamp(s.ya ?? 1, 0, MAX_FACILITY_LV);
  const b0 = BASE[s.teams[s.me].tier] + Math.round(yaLv * 1.2) + Math.round(scoutStaff * 1.4) + Math.floor(Math.max(0, analyticsLv - 1) / 3);
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
    if (m.focus === 'wonderkid') {
      p.pot = clamp(Math.max(p.pot, p.ov + R(12, 24)), p.ov, 96);
      p.talent = clamp(R(72, 95) + scoutStaff, 68, 98);
    }
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
        hint: 'ผู้ติดตามเพิ่มขึ้น · ขวัญ +4%',
        apply: (s) => {
          s.fan = clamp((s.fan ?? 50) + 5, 5, 100);
          s.mor = clamp((s.mor ?? 50) + 4, 0, 100);
          const meTm = s.teams[s.me];
          const fAdd = Math.max(400, Math.round(ensureTeamFans(meTm) * 0.025));
          adjustTeamFans(meTm, fAdd);
          return `แฟนบอลคึกคักสุดขีด! (ผู้ติดตาม +${fmtFans(fAdd)}, ขวัญ +4%)`;
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
        hint: 'ชื่อเสียง +5 · แฟนบอลเพิ่มขึ้น · พลังกาย -6%',
        apply: (s) => {
          if (s.p) {
            s.p.rep = (s.p.rep || 0) + 5;
            s.p.en = clamp((s.p.en ?? 100) - 6, 20, 100);
          }
          s.fan = clamp((s.fan ?? 50) + 6, 5, 100);
          const meTm = s.teams[s.me];
          const fAdd = Math.max(550, Math.round(ensureTeamFans(meTm) * 0.03));
          adjustTeamFans(meTm, fAdd);
          return `คุณกลายเป็นขวัญใจเยาวชน! (ชื่อเสียง +5, แฟนสโมสร +${fmtFans(fAdd)})`;
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
  s.teams[s.me]?.sq.forEach((q) => {
    recordPlayerSeasonProgress(q, s.season ?? 1, s.md ?? 0, q.me ? s.p : null);
  });
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
    const winTeam = s.teams[w];
    if (winTeam) {
      winTeam.trophies = winTeam.trophies || [];
      if (!winTeam.trophies.some((t) => t.season === s.season && t.type === 'asia')) {
        winTeam.trophies.push({ season: s.season, title: 'แชมป์สโมสรทวีป', type: 'asia' });
      }
    }
    if (c.p.includes(s.me)) {
      s.hist.push(`🌏 ซีซั่น ${s.season}: บอลถ้วยในทวีป ${w === s.me ? 'แชมป์!' : `ตกรอบ (${s.teams[w].name} แชมป์)`}`);
    }
    if (w === s.me) {
      s.trophies = s.trophies || [];
      if (!s.trophies.some((t) => t.season === s.season && t.type === 'asia')) {
        s.trophies.push({ season: s.season, title: 'แชมป์สโมสรทวีป', type: 'asia' });
      }
      if (s.mode === 'm') {
        s.money += 500;
        logFin(s, 'รางวัลแชมป์ทวีป', 500);
        s.mgrRep = (s.mgrRep || 50) + 120;
      }
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
    const winTeam = s.teams[w];
    if (winTeam) {
      winTeam.trophies = winTeam.trophies || [];
      if (!winTeam.trophies.some((t) => t.season === s.season && t.type === 'cup')) {
        winTeam.trophies.push({ season: s.season, title: 'แชมป์ถ้วยประชาชน', type: 'cup' });
      }
    }
    if (w === s.me) {
      s.trophies = s.trophies || [];
      if (!s.trophies.some((t) => t.season === s.season && t.type === 'cup')) {
        s.trophies.push({ season: s.season, title: 'แชมป์ถ้วยประชาชน', type: 'cup' });
      }
      if (s.mode === 'm') {
        s.money += 250;
        logFin(s, 'รางวัลแชมป์ถ้วยประชาชน', 250);
        s.mgrRep = (s.mgrRep || 50) + 75;
      }
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

export function getPlayerReleaseCheck(s: GameState, me: Team, q: Player) {
  const tx = getLeagueTransferContext(s, me);
  const con = ensureCon(q);
  const isLoan = !!q.loan;
  const savedWage = Number((con.wg || wagOf(q)).toFixed(1));
  const releaseCost = isLoan || con.yr <= 0 ? 0 : Math.max(1, Math.round(savedWage * con.yr * 1.5));
  let reason = '';
  if (q.me) reason = 'ไม่สามารถปลดนักเตะตัวหลักของคุณได้';
  else if (me.sq.length <= tx.minSquad) reason = `ขนาดทีมต้องมีอย่างน้อย ${tx.minSquad} คนตามกฎลีก`;
  else if (tx.posCounts[q.pos] <= tx.minPos[q.pos]) reason = `ต้องเหลือนักเตะ ${q.pos} อย่างน้อย ${tx.minPos[q.pos]} คน`;
  else if (s.money < releaseCost) reason = `งบสโมสรไม่พอจ่ายค่าชดเชย (${fmtMoney(releaseCost)})`;
  return {
    canRelease: !reason,
    reason,
    releaseCost,
    isLoan,
    savedWage
  };
}

export interface BatchRemovalValidation {
  eligiblePlayers: Player[];
  blockedPlayers: { player: Player; reason: string }[];
  squadErrors: string[];
  afterSquadCount: number;
  afterPosCounts: Record<Position, number>;
  totalMarketValue: number;
  totalQuickSellValue: number;
  totalReleaseCost: number;
  totalSavedWage: number;
  twOpen: boolean;
  canConfirm: boolean;
}

export function validateBatchSquadRemoval(
  s: GameState,
  me: Team,
  playerNames: string[],
  mode: 'sell' | 'release',
  quickPricePct = 85
): BatchRemovalValidation {
  const tx = getLeagueTransferContext(s, me);
  const uniqueNames = Array.from(new Set(playerNames));
  const eligiblePlayers: Player[] = [];
  const blockedPlayers: { player: Player; reason: string }[] = [];
  const offers = getIncomingOffers(s);

  uniqueNames.forEach((name) => {
    const q = me.sq.find((p) => p.n === name);
    if (!q) return;
    if (q.me) {
      blockedPlayers.push({ player: q, reason: 'ตัวละครหลักของโหมดนี้' });
      return;
    }
    if (mode === 'sell') {
      const sameDayLock = q.signedSeason === s.season && q.signedMd === s.md;
      if (q.loan) {
        blockedPlayers.push({ player: q, reason: 'นักเตะยืมตัวขายไม่ได้ (ปลด/คืนยืมได้)' });
        return;
      }
      if (q.inj > 0) {
        blockedPlayers.push({ player: q, reason: `บาดเจ็บอีก ${q.inj} นัด` });
        return;
      }
      if (sameDayLock) {
        blockedPlayers.push({ player: q, reason: 'เพิ่งเซ็นนัดนี้ ขายต่อทันทีไม่ได้' });
        return;
      }
    }
    eligiblePlayers.push(q);
  });

  const posRemoved: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  let totalMarketValue = 0;
  let totalQuickSellValue = 0;
  let totalReleaseCost = 0;
  let totalSavedWage = 0;

  eligiblePlayers.forEach((q) => {
    posRemoved[q.pos] += 1;
    const val = Math.max(5, vlu(q));
    const baseQuick = Math.max(4, Math.round((val * quickPricePct) / 100));
    const bestBid = offers.filter((o) => o.n === q.n).sort((a, b) => b.p - a.p)[0];
    const effQuick = bestBid && bestBid.p > baseQuick ? bestBid.p : baseQuick;
    const con = ensureCon(q);
    const wg = con.wg || wagOf(q);
    const relCost = q.loan || con.yr <= 0 ? 0 : Math.max(1, Math.round(wg * con.yr * 1.5));

    totalMarketValue += val;
    totalQuickSellValue += effQuick;
    totalReleaseCost += relCost;
    totalSavedWage += wg * (con.yr <= 0 ? 1.25 : 1);
  });

  const afterSquadCount = me.sq.length - eligiblePlayers.length;
  const afterPosCounts: Record<Position, number> = {
    GK: tx.posCounts.GK - posRemoved.GK,
    DF: tx.posCounts.DF - posRemoved.DF,
    MF: tx.posCounts.MF - posRemoved.MF,
    FW: tx.posCounts.FW - posRemoved.FW
  };

  const squadErrors: string[] = [];
  if (afterSquadCount < tx.minSquad) {
    squadErrors.push(`ต้องเหลือนักเตะในทีมอย่างน้อย ${tx.minSquad} คน (หลังปล่อยจะเหลือ ${afterSquadCount} คน)`);
  }
  (['GK', 'DF', 'MF', 'FW'] as Position[]).forEach((pos) => {
    if (afterPosCounts[pos] < tx.minPos[pos]) {
      squadErrors.push(`ตำแหน่ง ${pos} ต้องเหลืออย่างน้อย ${tx.minPos[pos]} คน (จะเหลือ ${afterPosCounts[pos]} คน)`);
    }
  });
  if (mode === 'release' && s.money < totalReleaseCost) {
    squadErrors.push(`งบสโมสรไม่พอจ่ายค่าชดเชยรวม ${fmtMoney(totalReleaseCost)}`);
  }

  return {
    eligiblePlayers,
    blockedPlayers,
    squadErrors,
    afterSquadCount,
    afterPosCounts,
    totalMarketValue,
    totalQuickSellValue,
    totalReleaseCost,
    totalSavedWage: Number(totalSavedWage.toFixed(1)),
    twOpen: tx.tw.open,
    canConfirm:
      eligiblePlayers.length > 0 &&
      squadErrors.length === 0 &&
      (mode === 'release' || tx.tw.open)
  };
}

export function releaseSquadPlayers(
  d: GameState,
  playerNames: string[]
): { ok: boolean; count: number; cost: number; err?: string; releasedNames: string[] } {
  const me = d.teams[d.me];
  if (!me) return { ok: false, count: 0, cost: 0, err: 'ไม่พบข้อมูลทีม', releasedNames: [] };
  const check = validateBatchSquadRemoval(d, me, playerNames, 'release');
  if (!check.canConfirm) {
    return {
      ok: false,
      count: 0,
      cost: check.totalReleaseCost,
      err: check.squadErrors[0] || check.blockedPlayers[0]?.reason || 'ไม่สามารถปลดนักเตะที่เลือกได้',
      releasedNames: []
    };
  }

  const targetNames = new Set(check.eligiblePlayers.map((q) => q.n));
  const removedList: Player[] = [];
  me.sq = me.sq.filter((q) => {
    if (targetNames.has(q.n)) {
      removedList.push(q);
      return false;
    }
    return true;
  });

  me.lu = null;
  if (me.cap && targetNames.has(me.cap)) me.cap = '';
  if (d.focusPlayer && targetNames.has(d.focusPlayer)) d.focusPlayer = null;

  let loanReturnedCount = 0;
  removedList.forEach((pl) => {
    removeIncomingOffer(d, pl.n);
    if (pl.loan) {
      loanReturnedCount += 1;
      return;
    }
    delete pl.listed;
    delete pl.askPrice;
    delete pl.offerCoolMd;
    pl.no = undefined;
    pl.free = 1;
    pl.price = 0;
    pl.askWg = wagOf(pl);
    pl.tries = 0;
    pl.locked = 0;
    pl.con = undefined;
    appendPlayerCareerLog(pl, `🔓 ถูกปล่อยตัวเป็นฟรีเอเยนต์จาก ${me.name} ซีซั่น ${d.season}`);
    d.mk = d.mk || [];
    if (d.mk.length < 75) {
      d.mk.unshift(pl);
    }
  });

  if (check.totalReleaseCost > 0) {
    d.money -= check.totalReleaseCost;
    const finLabel =
      removedList.length === 1
        ? `ปลดสัญญา ${removedList[0].n}`
        : `ค่าชดเชยปลดนักเตะ ${removedList.length} ราย`;
    logFin(d, finLabel, -check.totalReleaseCost);
  }

  const releasedNames = removedList.map((q) => q.n);
  if (removedList.length === 1) {
    const one = removedList[0];
    pushFeed(
      d,
      'บริหารทีม',
      one.loan
        ? `↩️ ยกเลิกสัญญายืมตัว ${one.n} ส่งกลับต้นสังกัดแล้ว`
        : `🔓 ปลด ${one.n} (${one.ro}) ออกจากสโมสร${check.totalReleaseCost > 0 ? ` (ค่าชดเชย ${fmtMoney(check.totalReleaseCost)})` : ''}`,
      ''
    );
  } else {
    pushFeed(
      d,
      'บริหารทีม',
      `🔓 ปล่อยตัวนักเตะ ${removedList.length} ราย${loanReturnedCount > 0 ? ` (คืนยืม ${loanReturnedCount})` : ''}${check.totalReleaseCost > 0 ? ` · ค่าชดเชยรวม ${fmtMoney(check.totalReleaseCost)}` : ''}`,
      ''
    );
  }

  return { ok: true, count: removedList.length, cost: check.totalReleaseCost, releasedNames };
}

export function quickSellSquadPlayers(
  d: GameState,
  playerNames: string[],
  pricePct = 85
): { ok: boolean; count: number; totalGain: number; err?: string; soldNames: string[] } {
  const me = d.teams[d.me];
  if (!me) return { ok: false, count: 0, totalGain: 0, err: 'ไม่พบข้อมูลทีม', soldNames: [] };
  const check = validateBatchSquadRemoval(d, me, playerNames, 'sell', pricePct);
  if (!check.twOpen) {
    const tx = getLeagueTransferContext(d, me);
    return { ok: false, count: 0, totalGain: 0, err: `ตลาดซื้อขายปิดอยู่ (${tx.tw.rangeText})`, soldNames: [] };
  }
  if (!check.canConfirm) {
    return {
      ok: false,
      count: 0,
      totalGain: 0,
      err: check.squadErrors[0] || check.blockedPlayers[0]?.reason || 'ไม่สามารถขายนักเตะที่เลือกได้',
      soldNames: []
    };
  }

  const offers = getIncomingOffers(d);
  const targetNames = new Set(check.eligiblePlayers.map((q) => q.n));
  const soldPlayers: Player[] = [];
  me.sq = me.sq.filter((q) => {
    if (targetNames.has(q.n)) {
      soldPlayers.push(q);
      return false;
    }
    return true;
  });

  me.lu = null;
  if (me.cap && targetNames.has(me.cap)) me.cap = '';
  if (d.focusPlayer && targetNames.has(d.focusPlayer)) d.focusPlayer = null;

  let totalGain = 0;
  const soldDetails: { name: string; buyerName: string; price: number }[] = [];

  soldPlayers.forEach((sold) => {
    const baseQuick = Math.max(4, Math.round((Math.max(5, vlu(sold)) * pricePct) / 100));
    const bestBid = offers.filter((o) => o.n === sold.n).sort((a, b) => b.p - a.p)[0];
    const useBid = !!(bestBid && bestBid.p >= baseQuick);
    const salePrice = useBid ? bestBid.p : baseQuick;

    let buyer: Team | undefined = useBid
      ? (bestBid.teamId != null ? d.teams.find((tm) => tm.id === bestBid.teamId) : undefined) ||
        d.teams.find((tm) => tm.name === bestBid.t)
      : undefined;

    if (!buyer || buyer.id === d.me || buyer.sq.length >= LEAGUE_TRANSFER_RULES.maxSquad) {
      buyer = d.teams
        .filter((tm) => tm.id !== d.me && tm.sq.length < LEAGUE_TRANSFER_RULES.maxSquad)
        .sort((a, b) => Math.abs(a.tier - me.tier) - Math.abs(b.tier - me.tier) || a.sq.length - b.sq.length)[0];
    }

    delete sold.listed;
    delete sold.askPrice;
    delete sold.offerCoolMd;
    sold.no = undefined;
    sold.signedSeason = d.season;
    sold.signedMd = d.md;
    removeIncomingOffer(d, sold.n);

    const buyerName = buyer ? buyer.name : useBid ? bestBid.t : 'ตลาดซื้อขายกลาง';
    appendPlayerCareerLog(sold, `🤝 ย้ายซบ ${buyerName} ค่าตัว ${fmtMoney(salePrice)} (ซีซั่น ${d.season})`);

    if (buyer) {
      buyer.sq.push(sold);
      buyer.lu = null;
      assignTeamShirtNumbers(buyer);
    } else {
      d.mk = d.mk || [];
      if (d.mk.length < 75) {
        sold.free = 0;
        sold.price = Math.max(5, vlu(sold));
        sold.askWg = wagOf(sold);
        d.mk.unshift(sold);
      }
    }

    totalGain += salePrice;
    soldDetails.push({ name: sold.n, buyerName, price: salePrice });
  });

  d.money += totalGain;
  if (soldDetails.length === 1) {
    const one = soldDetails[0];
    logFin(d, `ขาย ${one.name} ให้ ${one.buyerName}`, one.price);
    pushFeed(d, 'ตลาดซื้อขาย', `✅ ขาย ${one.name} ให้ ${one.buyerName} รับค่าตัว +${fmtMoney(one.price)}`, 'ok');
  } else {
    logFin(d, `ขายนักเตะแบบกลุ่ม ${soldDetails.length} ราย`, totalGain);
    pushFeed(
      d,
      'ตลาดซื้อขาย',
      `✅ ขายนักเตะ ${soldDetails.length} ราย (${soldDetails.slice(0, 2).map((x) => x.name.split(' ')[0]).join(', ')}${soldDetails.length > 2 ? '…' : ''}) รับรวม +${fmtMoney(totalGain)}`,
      'ok'
    );
  }

  return {
    ok: true,
    count: soldDetails.length,
    totalGain,
    soldNames: soldDetails.map((x) => x.name)
  };
}

export function batchListOrPitchPlayers(
  d: GameState,
  playerNames: string[],
  askPct: number,
  pitchNow: boolean
): { listedCount: number; pitchedCount: number; offerCount: number } {
  const me = d.teams[d.me];
  if (!me) return { listedCount: 0, pitchedCount: 0, offerCount: 0 };
  const tx = getLeagueTransferContext(d, me);
  let listedCount = 0;
  let pitchedCount = 0;
  let offerCount = 0;

  Array.from(new Set(playerNames)).forEach((name) => {
    const q = me.sq.find((p) => p.n === name);
    if (!q || q.loan || q.me) return;
    const baseVal = Math.max(5, vlu(q));
    q.listed = 1;
    q.askPrice = Math.max(5, Math.round((baseVal * askPct) / 100));
    listedCount += 1;

    if (pitchNow && tx.tw.open) {
      const outcome = resolvePitchPlayerOutcome(d, q.n, askPct);
      if (outcome.ok) {
        applyPitchPlayerOutcome(d, q.n, outcome);
        pitchedCount += 1;
        offerCount += outcome.offers.length;
      }
    }
  });

  if (listedCount > 0 && (!pitchNow || !tx.tw.open)) {
    pushFeed(d, 'ตลาดซื้อขาย', `🏷️ ขึ้นบัญชีขายนักเตะ ${listedCount} รายในตลาดสโมสรแล้ว`, '');
  }

  return { listedCount, pitchedCount, offerCount };
}

export function afterMatchDay(
  s: GameState,
  liveInjMeta?: {
    teamIds?: number[];
    playerNames?: string[];
    subbedOutByTeam?: Record<number, Record<string, number>>;
  }
) {
  const me = s.teams[s.me];
  const mg = s.mode === 'm';
  const lv = clamp(s.tr ?? 1, 0, MAX_FACILITY_LV);
  const medLv = clamp(s.med ?? 1, 0, MAX_FACILITY_LV);
  const turfLv = clamp(s.turfLv ?? 1, 0, MAX_FACILITY_LV);
  const analyticsLv = clamp(s.analyticsLv ?? 1, 0, MAX_FACILITY_LV);
  const stf = getStaffState(s);

  // Gradual facility wear & tear each matchday in Manager mode (40%..100%)
  if (mg) {
    const nextCond: Partial<Record<FacilityKey, number>> = { ...(s.facCond || {}) };
    ALL_FACILITY_KEYS.forEach((fk) => {
      if ((s[fk] ?? 1) <= 0) return;
      const curCond = getFacilityCondition(s, fk);
      const wear = fk === 'st' || fk === 'turfLv' || fk === 'tr' ? R(1, 3) : R(1, 2);
      nextCond[fk] = clamp(curCond - wear, 40, 100);
    });
    s.facCond = nextCond;
  }

  const trCondFactor = mg ? 0.65 + 0.35 * (getFacilityCondition(s, 'tr') / 100) : 1;
  const medCondFactor = mg ? 0.65 + 0.35 * (getFacilityCondition(s, 'med') / 100) : 1;
  const turfCondFactor = mg ? 0.65 + 0.35 * (getFacilityCondition(s, 'turfLv') / 100) : 1;
  const skipInjTeams = new Set(liveInjMeta?.teamIds || []);
  const justInjuredNames = new Set(liveInjMeta?.playerNames || []);
  const subbedOutByTeam = liveInjMeta?.subbedOutByTeam || {};
  const plan = getTeamTrainingPlan(s);
  const progMeta = TEAM_TRAINING_PROGRAMS[plan.program];
  const intMeta = TRAINING_INTENSITY_META[plan.intensity];

  const coachStyle = mg ? s.club?.managerStyle || 'balanced' : 'balanced';
  const tacFamDelta = mg
    ? Math.max(
        0,
        (plan.program === 'recovery' ? 1 : 2) +
          progMeta.tacFamBonus +
          intMeta.tacAdd +
          Math.ceil(stf.asst * 0.75) +
          Math.floor(Math.max(0, analyticsLv - 1) / 2) +
          Math.ceil(stf.setPieceCoach * 0.5) +
          (coachStyle === 'balanced' ? 2 : 0)
      )
    : 2 + stf.asst;
  me.tacFam = clamp((me.tacFam ?? 65) + tacFamDelta, 30, 100);

  let myFitBeforeSum = 0;
  let myFitAfterSum = 0;
  let myFitCount = 0;
  let restedCount = 0;

  s.teams.forEach((t) => {
    const pl = xi(t);
    const mine = t.id === s.me;
    const isAiManaged = !mine || !mg;
    const ps = mine && mg ? (t.press ?? 1) + (t.tempo ?? 1) - 1 : 1;
    const teamSubsOut = subbedOutByTeam[t.id] || {};
    const avgStarterFit = isAiManaged && pl.length
      ? pl.reduce((sum, x) => sum + (x.fit ?? 100), 0) / pl.length
      : 100;
    const tiredStarterCount = isAiManaged
      ? pl.filter((x) => (x.fit ?? 100) < 74).length
      : 0;
    const aiRecoveryWeek = isAiManaged
      ? (avgStarterFit < 74 || tiredStarterCount >= 4 ? 5 : avgStarterFit < 81 || tiredStarterCount >= 2 ? 3 : 0)
      : 0;
    const aiFacilityBonus = isAiManaged ? ([4, 6, 8][t.tier] ?? 5) : 0;
    const aiPhysioChance = isAiManaged ? ([0.18, 0.28, 0.38][t.tier] ?? 0.25) : 0;

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
      const subOutMin = teamSubsOut[q.n];
      const earlySubRest = pi && typeof subOutMin === 'number' && subOutMin < 85
        ? Math.round(clamp((90 - subOutMin) / 8, 2, 7))
        : 0;
      const trainFitBonus = mine && mg
        ? Math.round(lv * 1.4 * trCondFactor) +
          Math.floor(Math.max(0, turfLv - 1) * 0.7 * turfCondFactor) +
          Math.round(stf.fit * 1.6) +
          progMeta.fitMod +
          intMeta.fitDelta +
          (coachStyle === 'motivator' ? 2 : 0) +
          (plan.restStarters && pi ? 5 : 0) +
          (isIndivRest ? 10 : 0)
        : (pi ? Math.round(aiFacilityBonus * 0.72) : aiFacilityBonus + (prevFit < 78 ? 5 : prevFit < 88 ? 2 : 0)) + aiRecoveryWeek;
      const ironLungsMult = hasTrait(q, 'iron_lungs', s.p) || hasTrait(q, 'box_to_box_engine', s.p) ? 0.72 : hasTrait(q, 'glass_cannon', s.p) ? 1.18 : 1;
      const consRec = (hasTrait(q, 'consistency_pro', s.p) || hasTrait(q, 'tireless_mentor', s.p) ? 2 : 0) + (Dq.tr === 6 || Dq.tr === 18 || Dq.tr === 21 || Dq.tr === 23 ? 2 : 0);
      const persStamMult = Dq.tr === 2 || Dq.tr === 18 ? 0.78 : Dq.tr === 7 || Dq.tr === 19 ? 1.15 : 1;
      const matchOrRestDelta = pi
        ? -Math.round(R(7, 12) * persStamMult * ironLungsMult) - ps * (mine && mg ? 3 : 2) + Math.round((Dq.d.sta - 68) / 8) + earlySubRest
        : R(10, 17) + Math.round((Dq.d.rec - 68) / 7) + consRec;
      q.fit = clamp(prevFit + matchOrRestDelta + trainFitBonus, hasTrait(q, 'consistency_pro', s.p) ? 55 : 35, 100);
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
            (Dq.d.rec >= 82 || isIndivRest || (!mine && t.tier >= 1) || (mine && (medLv >= 3 || stf.physio >= 2))) &&
            Math.random() < (mine ? ((medLv > 0 ? 0.28 : 0.16) + Math.max(0, medLv - 1) * 0.05 * medCondFactor + stf.physio * 0.055 + (isIndivRest ? 0.25 : 0)) : aiPhysioChance)
          ) {
            q.inj--;
          }
        }
      } else if (
        pi &&
        !skipInjTeams.has(t.id) &&
        Math.random() <
          (q.fit < 60 ? 0.068 : 0.022) *
            (mine ? progMeta.injMult * (mg ? intMeta.injMult : 1) * (isIndivRest ? 0.5 : 1) : 1) *
            (mine ? Math.max(0.4, 1 - Math.max(0, medLv - 1) * 0.045 * medCondFactor - stf.physio * 0.05 - Math.max(0, turfLv - 1) * 0.02 * turfCondFactor) : Math.max(0.65, 1 - t.tier * 0.12)) *
            (hasTrait(q, 'glass_cannon', s.p) ? 1.38 : hasTrait(q, 'iron_lungs', s.p) ? 0.8 : 1) *
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
    const breakthroughs: string[] = [];
    const xiSet = new Set(xi(me).map((z) => z.n));
    if (progMeta.devMult > 0) {
      me.sq.forEach((q) => {
        if (q.inj > 0 || plan.individualFocus?.[q.n] === 'REST') return;
        const isFocus = s.focusPlayer && q.n === s.focusPlayer;
        const matchesPos =
          progMeta.positions === 'YOUNG'
            ? q.age <= 25
            : Array.isArray(progMeta.positions) && progMeta.positions.includes(q.pos);
        if (!matchesPos && !isFocus) return;
        const devProf = getPlayerDevProfile(q, s.p);
        if (devProf.phase === 'declining') return;
        const benchSharpBonus = plan.restStarters && !xiSet.has(q.n) ? 1.15 : 1;
        const tlFactor = 0.72 + ((q.talent ?? 55) / 100) * 0.55;
        const youthCoachMul = coachStyle === 'youth' && q.age <= 23 ? 1.18 : 1;
        const persTr = devProf.D.tr;
        const persDevMul = persTr === 2 || persTr === 10 || persTr === 12 || persTr === 23 ? 1.12 : 1;
        const roleCoachBonus = q.pos === 'GK' ? stf.gkCoach * 0.004 : stf.setPieceCoach * 0.0018;
        const ovScale = getOvGrowthScale(q.ov, q.pot);
        const chance =
          (0.0055 + 0.0022 * lv * trCondFactor + stf.asst * 0.0018 + Math.max(0, analyticsLv - 1) * 0.001 + roleCoachBonus) *
          progMeta.devMult *
          intMeta.devMult *
          benchSharpBonus *
          tlFactor *
          youthCoachMul *
          persDevMul *
          ovScale *
          devProf.ageMult *
          devProf.formMult *
          (isFocus ? 1.45 : 1);

        if (q.ov < (q.pot || 86)) {
          if (Math.random() < chance) {
            q.ov++;
            gr.push(`${q.n} (${q.ov})`);
          }
        } else if (devProf.strongSeason && Math.random() < 0.25) {
          const bt = trySuperstarBreakthrough(q, null, 0.06);
          if (bt.brokeThrough) {
            q.ov++;
            gr.push(`${q.n} (${q.ov})`);
            breakthroughs.push(`${q.n} → ศักยภาพ ${bt.newPot}${bt.becameSuperstar ? ' 🌟ซุปตาร์!' : ''}`);
          }
        }
      });
    }
    if (breakthroughs.length) {
      pushFeed(s, 'แววซุปตาร์', `🌟 ทะลุขีดจำกัดระหว่างซีซั่น: ${breakthroughs.join(', ')}`, 'ok');
    }
    const avgFitAfter = myFitCount ? myFitAfterSum / myFitCount : 80;
    const fitDeltaAvg = myFitCount ? Math.round((myFitAfterSum - myFitBeforeSum) / myFitCount) : 0;
    const morDelta = progMeta.morBonus + (coachStyle === 'motivator' ? 1 : 0) + (plan.intensity === 'heavy' && avgFitAfter < 68 ? -1 : 0);
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
    const upgradedEntries: { player: string; mission: string; stage: number; rewardText: string }[] = [];
    const failedEntries: { player: string; mission: string; stage: number }[] = [];
    me.sq.forEach((q) => {
      if (q.inj > 0 || plan.individualFocus?.[q.n] === 'REST') return;
      const { summary } = applyTrainingMissionProgress(q, {
        teamProgram: plan.program,
        isTeamFocus: s.focusPlayer === q.n,
        careerP: q.me ? s.p : null,
        state: s
      });
      summary.upgraded.forEach((u) => upgradedEntries.push({ player: u.player, mission: u.mission, stage: u.stage, rewardText: u.rewardText }));
      summary.failed.forEach((f) => failedEntries.push({ player: f.player, mission: f.mission, stage: f.stage }));
    });
    if (upgradedEntries.length > 0) {
      const sample = upgradedEntries[0];
      pushFeed(
        s,
        'ภารกิจอัปพลัง',
        upgradedEntries.length === 1
          ? `🎯 ${sample.player} อัปพลัง "${sample.mission} ขั้น ${sample.stage}" อัตโนมัติ! (${sample.rewardText})`
          : `🎯 ภารกิจซ้อมอัปพลังสำเร็จ ${upgradedEntries.length} รายการ (เช่น ${sample.player}: ${sample.mission} ขั้น ${sample.stage})`,
        'ok'
      );
    }
    if (failedEntries.length > 0) {
      const sampleF = failedEntries[0];
      pushFeed(
        s,
        'ภารกิจส่วนบุคคล',
        failedEntries.length === 1
          ? `💨 ${sampleF.player} พลาดอัปพลัง "${sampleF.mission} ขั้น ${sampleF.stage}" (ไม่ผ่านเกณฑ์พรสวรรค์รอบนี้)`
          : `💨 มีนักเตะ ${failedEntries.length} รายการพลาดลุ้นอัปขั้นภารกิจจากการซ้อม`,
        ''
      );
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

  // Active in-season training & mission progression for AI bot clubs using symmetric progression rules
  s.teams.forEach((t) => {
    if (mg && t.id === s.me) return;
    const aiXi = new Set(xi(t).map((z) => z.n));
    const aiProg: TrainingProgramId = t.tac === 'X' || t.tac === 'A' ? 'attack' : t.tac === 'D' || t.tac === 'Z' ? 'defense' : 'balanced';
    const aiLv = clamp(([2.5, 5.0, 7.5, 8.8][t.tier] ?? 4.5) + ((t.id % 3) - 1) * 0.4, 1, 10);
    const aiAsst = clamp(([0.6, 1.8, 3.2, 4.0][t.tier] ?? 1.5) + (t.id % 2) * 0.3, 0, 5);
    const aiAnalytics = clamp(([1.5, 3.5, 6.0, 7.5][t.tier] ?? 3) + ((t.id % 3) - 1) * 0.5, 1, 10);
    const aiVirtualState = {
      tr: Math.round(aiLv),
      staff: { asst: Math.round(aiAsst), fit: 0, scout: 0, physio: 0 },
      analyticsLv: Math.round(aiAnalytics)
    };
    const aiFocusCandidate = t.sq
      .filter((q) => !q.me && q.inj === 0 && getPlayerDevProfile(q, null).phase !== 'declining')
      .slice()
      .sort((a, b) => ((b.pot || b.ov) - b.ov) * 2 + (b.talent ?? 55) - (((a.pot || a.ov) - a.ov) * 2 + (a.talent ?? 55)))[0];

    t.sq.forEach((q) => {
      if (q.me || q.inj > 0) return;
      const isStarter = aiXi.has(q.n);
      const isAiFocus = aiFocusCandidate?.n === q.n;
      const devProf = getPlayerDevProfile(q, null);
      if (devProf.phase !== 'declining') {
        const tlFactor = 0.72 + ((q.talent ?? 55) / 100) * 0.55;
        const persTr = devProf.D.tr;
        const persDevMul = persTr === 2 || persTr === 10 || persTr === 12 || persTr === 23 ? 1.12 : 1;
        const ovScale = getOvGrowthScale(q.ov, q.pot);
        const aiTrainChance =
          (0.0055 + 0.0022 * aiLv + aiAsst * 0.0018 + Math.max(0, aiAnalytics - 1) * 0.001) *
          (isStarter ? 1.05 : 0.92) *
          tlFactor *
          persDevMul *
          ovScale *
          devProf.ageMult *
          devProf.formMult *
          (isAiFocus ? 1.35 : 1);

        if (q.ov < (q.pot || 86)) {
          if (Math.random() < aiTrainChance) {
            q.ov++;
          }
        } else if (devProf.strongSeason && Math.random() < 0.25) {
          const bt = trySuperstarBreakthrough(q, null, 0.06);
          if (bt.brokeThrough) {
            q.ov++;
          }
        }
      }
      applyTrainingMissionProgress(q, {
        teamProgram: aiProg,
        isTeamFocus: isAiFocus,
        state: aiVirtualState
      });
    });
  });

  me.sq.forEach((q) => {
    recordPlayerSeasonProgress(q, s.season ?? 1, s.md ?? 0, q.me ? s.p : null);
  });
  maybeAiCoachExperimentTactics(s);

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
  if (mg) evaluateAndIssueBoardDirectives(s);
}

export function getActiveBoardEffects(s: Pick<GameState, 'boardEffects' | 'season' | 'md'>): BoardTempEffect[] {
  const curSeason = s.season ?? 1;
  const curMd = s.md ?? 0;
  return (s.boardEffects || []).filter((e) => e.season === curSeason && curMd < e.expiresMd);
}

export function getActiveBoardModifiers(s: Pick<GameState, 'boardEffects' | 'season' | 'md'>) {
  const out = { att: 0, df: 0, mor: 0, fan: 0, tacFam: 0 };
  getActiveBoardEffects(s).forEach((e) => {
    if (e.stat === 'att') out.att += e.delta;
    else if (e.stat === 'def') out.df += e.delta;
    else if (e.stat === 'mor') out.mor += e.delta;
    else if (e.stat === 'fan') out.fan += e.delta;
    else if (e.stat === 'tacFam') out.tacFam += e.delta;
  });
  return out;
}

const getYouthDevMetric = (s: GameState, me: Team) => {
  const u22Apps = me.sq.filter((q) => q.age <= 22).reduce((sum, q) => sum + (q.sp || 0), 0);
  const youthSigned = me.sq.filter((q) => q.age <= 20 && q.signedSeason === s.season).length;
  return u22Apps + (s.ya ?? 1) * 3 + youthSigned * 2;
};

export function getBoardDirectiveProgress(s: GameState, dir: BoardDirective) {
  const me = s.teams[s.me];
  if (!me) {
    return { current: 0, target: 1, ratio: 0, isComplete: false, progressText: '0/1' };
  }
  const tx = getLeagueTransferContext(s, me);

  if (dir.kind === 'reduce_wages') {
    const curWage = tx.curWage;
    const target = dir.targetValue;
    const isComplete = curWage <= target;
    const startGap = Math.max(1, dir.startValue - target);
    const ratio = isComplete ? 1 : clamp((dir.startValue - curWage) / startGap, 0, 0.99);
    return {
      current: curWage,
      target,
      ratio,
      isComplete,
      progressText: `ค่าเหนื่อย ${fmtMoneyNum(curWage)} / เป้า ≤ ${fmtMoneyNum(target)}`
    };
  }

  if (dir.kind === 'youth_focus') {
    const curMetric = getYouthDevMetric(s, me);
    const gained = Math.max(0, curMetric - dir.startValue);
    const targetGain = Math.max(1, dir.targetValue - dir.startValue);
    const isComplete = gained >= targetGain;
    return {
      current: gained,
      target: targetGain,
      ratio: clamp(gained / targetGain, 0, 1),
      isComplete,
      progressText: `แต้มปั้นดาวรุ่ง ${gained}/${targetGain} (ส่ง U22 ลง/เซ็นเยาวชน/อัปอะคาเดมี่)`
    };
  }

  if (dir.kind === 'tighten_defense') {
    const conceded = Math.max(0, me.ga - dir.startValue);
    const maxAllowed = dir.targetValue;
    const matchesElapsed = Math.max(0, (s.md ?? 0) - dir.issuedMd);
    const totalWindow = Math.max(1, dir.dueMd - dir.issuedMd);
    const isComplete = conceded <= maxAllowed && (s.md ?? 0) >= dir.dueMd;
    const ratio = conceded > maxAllowed ? 0 : clamp(matchesElapsed / totalWindow, 0.15, 1);
    return {
      current: conceded,
      target: maxAllowed,
      ratio,
      isComplete,
      progressText: `เสียไปแล้ว ${conceded} ประตู (ต้องไม่เกิน ${maxAllowed} ลูก)`
    };
  }

  if (dir.kind === 'attack_spark') {
    const scored = Math.max(0, me.gf - dir.startValue);
    const target = Math.max(1, dir.targetValue);
    return {
      current: scored,
      target,
      ratio: clamp(scored / target, 0, 1),
      isComplete: scored >= target,
      progressText: `ยิงได้ ${scored}/${target} ประตู`
    };
  }

  if (dir.kind === 'boost_finances') {
    const curMoney = Math.round(s.money);
    const target = dir.targetValue;
    const isComplete = curMoney >= target;
    const span = Math.max(1, target - dir.startValue);
    const ratio = isComplete ? 1 : clamp((curMoney - dir.startValue) / span, 0, 0.99);
    return {
      current: curMoney,
      target,
      ratio,
      isComplete,
      progressText: `งบปัจจุบัน ${fmtMoney(curMoney)} / เป้า ${fmtMoney(target)}`
    };
  }

  // win_form
  const gainedPts = Math.max(0, me.pts - dir.startValue);
  const targetPts = Math.max(1, dir.targetValue);
  return {
    current: gainedPts,
    target: targetPts,
    ratio: clamp(gainedPts / targetPts, 0, 1),
    isComplete: gainedPts >= targetPts,
    progressText: `เก็บได้ ${gainedPts}/${targetPts} แต้ม`
  };
}

function pushBoardFeedback(s: GameState, tone: BoardFeedbackEntry['tone'], msg: string) {
  s.boardFeedbackLog = s.boardFeedbackLog || [];
  if (s.boardFeedbackLog[0]?.msg === msg) return;
  s.boardFeedbackLog.unshift({
    season: s.season ?? 1,
    md: s.md ?? 0,
    tone,
    msg
  });
  if (s.boardFeedbackLog.length > 8) s.boardFeedbackLog.length = 8;
}

function addBoardTempEffect(
  s: GameState,
  label: string,
  tone: 'bonus' | 'penalty',
  stat: BoardTempEffect['stat'],
  delta: number,
  durationMatches: number
) {
  s.boardEffects = (s.boardEffects || []).filter((e) => e.season === (s.season ?? 1) && (s.md ?? 0) < e.expiresMd);
  s.boardEffects.push({
    id: `${stat}-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    label,
    tone,
    stat,
    delta,
    expiresMd: (s.md ?? 0) + durationMatches,
    season: s.season ?? 1
  });
  if (s.boardEffects.length > 4) {
    s.boardEffects = s.boardEffects.slice(-4);
  }
}

export function issueBoardDirective(s: GameState, preferredKind?: BoardDirectiveKind): BoardDirective | null {
  if (s.mode !== 'm') return null;
  const me = s.teams[s.me];
  if (!me) return null;
  const curMd = s.md ?? 0;
  const totalMd = s.fx?.length || 30;
  if (curMd >= totalMd - 1) return null;

  const tx = getLeagueTransferContext(s, me);
  const windowLen = Math.min(4, Math.max(2, totalMd - curMd));
  const dueMd = curMd + windowLen;

  let kind: BoardDirectiveKind = preferredKind || 'win_form';
  if (!preferredKind) {
    if (tx.wagePct >= 82) kind = 'reduce_wages';
    else if (s.money < 20) kind = 'boost_finances';
    else if ((s.ya ?? 1) <= 2 && Math.random() < 0.45) kind = 'youth_focus';
    else if (me.p >= 3 && me.ga > me.p * 1.35) kind = 'tighten_defense';
    else if (me.p >= 3 && me.gf < me.p * 1.1) kind = 'attack_spark';
    else {
      const pool: BoardDirectiveKind[] = ['youth_focus', 'win_form', 'tighten_defense', 'attack_spark'];
      if (tx.wagePct >= 65) pool.push('reduce_wages');
      kind = P(pool);
    }
  }

  let dir: BoardDirective;
  if (kind === 'reduce_wages') {
    const cutTarget = Math.max(8, Math.min(Math.round(tx.wageCap * 0.85), Math.max(8, tx.curWage - Math.max(3, Math.round(tx.curWage * 0.1)))));
    dir = {
      id: `dir-${s.season}-${curMd}-wages`,
      kind,
      title: 'ลดภาระค่าเหนื่อยในทีม',
      feedback: `บอร์ดเห็นว่าค่าเหนื่อยใช้ไป ${tx.wagePct}% ของเพดานแล้ว ควรปล่อย/ขายตัวสำรองที่ไม่ใช้งานเพื่อลดรายจ่าย`,
      targetLabel: `ลดค่าเหนื่อยรวมลงเหลือ ≤ ${fmtMoneyNum(cutTarget)}/นัด ภายใน ${windowLen} นัด`,
      rewardText: 'ขวัญทีม +6 · พลังทีม +2 (5 นัด) · เชื่อมั่น +6%',
      penaltyText: 'ขวัญทีม -4 · พลังทีม -2 (4 นัด) · เชื่อมั่น -6%',
      issuedSeason: s.season,
      issuedMd: curMd,
      dueMd,
      startValue: tx.curWage,
      targetValue: cutTarget,
      status: 'active'
    };
  } else if (kind === 'youth_focus') {
    const curMetric = getYouthDevMetric(s, me);
    const needGain = 4;
    dir = {
      id: `dir-${s.season}-${curMd}-youth`,
      kind,
      title: 'ยกระดับการปั้นนักเตะเยาวชน',
      feedback: 'บอร์ดต้องการเห็นอนาคตของสโมสร จงให้โอกาสนักเตะ U22 ลงสนาม เซ็นเด็กอะคาเดมี่ หรืออัปเกรดศูนย์เยาวชน',
      targetLabel: `สะสมแต้มพัฒนาดาวรุ่ง +${needGain} แต้ม ภายใน ${windowLen} นัด`,
      rewardText: 'พลังบุก & รับ +2 · ขวัญทีม +5 (5 นัด) · เชื่อมั่น +6%',
      penaltyText: 'แฟนบอล -4% · พลังทีม -1 (4 นัด) · เชื่อมั่น -6%',
      issuedSeason: s.season,
      issuedMd: curMd,
      dueMd,
      startValue: curMetric,
      targetValue: curMetric + needGain,
      status: 'active'
    };
  } else if (kind === 'tighten_defense') {
    const maxConcede = Math.max(2, windowLen);
    dir = {
      id: `dir-${s.season}-${curMd}-def`,
      kind,
      title: 'ขันเกมรับให้เหนียวแน่น',
      feedback: 'บอร์ดกังวลสถิติการเสียประตูช่วงที่ผ่านมา ต้องปรับวินัยแนวรับให้รัดกุมขึ้นทันที',
      targetLabel: `เสียประตูไม่เกิน ${maxConcede} ลูก ตลอด ${windowLen} นัดข้างหน้า`,
      rewardText: 'พลังเกมรับ +3 · ขวัญทีม +4 (5 นัด) · เชื่อมั่น +6%',
      penaltyText: 'พลังเกมรับ -3 (4 นัด) · เชื่อมั่น -6%',
      issuedSeason: s.season,
      issuedMd: curMd,
      dueMd,
      startValue: me.ga,
      targetValue: maxConcede,
      status: 'active'
    };
  } else if (kind === 'attack_spark') {
    const goalTarget = Math.max(4, Math.round(windowLen * 1.4));
    dir = {
      id: `dir-${s.season}-${curMd}-att`,
      kind,
      title: 'ปลุกเกมรุกให้ดุดันขึ้น',
      feedback: 'แฟนบอลและบอร์ดอยากเห็นเกมรุกที่เร้าใจและจบสกอร์เด็ดขาดกว่านี้ในสัปดาห์ต่อๆ ไป',
      targetLabel: `ยิงประตูรวมให้ได้ ≥ ${goalTarget} ลูก ภายใน ${windowLen} นัด`,
      rewardText: 'พลังเกมรุก +3 · แฟนบอล +4% (5 นัด) · เชื่อมั่น +6%',
      penaltyText: 'พลังเกมรุก -3 (4 นัด) · เชื่อมั่น -6%',
      issuedSeason: s.season,
      issuedMd: curMd,
      dueMd,
      startValue: me.gf,
      targetValue: goalTarget,
      status: 'active'
    };
  } else if (kind === 'boost_finances') {
    const moneyTarget = s.money < 0 ? 15 : Math.round(s.money + 25);
    dir = {
      id: `dir-${s.season}-${curMd}-fin`,
      kind,
      title: 'ฟื้นฟูสภาพคล่องสโมสร',
      feedback: 'บอร์ดกังวลกระแสเงินสดของสโมสร ควรเพิ่มรายได้แมตช์เหย้า เซ็นสปอนเซอร์ หรือขายนักเตะเพื่อพยุงงบ',
      targetLabel: `ทำงบสโมสรให้ถึง ≥ ${fmtMoney(moneyTarget)} ภายใน ${windowLen} นัด`,
      rewardText: 'ขวัญทีม +5 · แฟนบอล +5% (5 นัด) · เชื่อมั่น +6%',
      penaltyText: 'ขวัญทีม -5 · แฟนบอล -4% (4 นัด) · เชื่อมั่น -6%',
      issuedSeason: s.season,
      issuedMd: curMd,
      dueMd,
      startValue: Math.round(s.money),
      targetValue: moneyTarget,
      status: 'active'
    };
  } else {
    const ptTarget = Math.max(4, windowLen * 2 - 1);
    dir = {
      id: `dir-${s.season}-${curMd}-form`,
      kind: 'win_form',
      title: 'เร่งเก็บแต้มตามเป้าหมายลีก',
      feedback: 'บอร์ดคาดหวังผลงานที่สม่ำเสมอในช่วงโปรแกรมถัดไปเพื่อรักษาโมเมนตัมของสโมสร',
      targetLabel: `เก็บอย่างน้อย ${ptTarget} แต้ม ภายใน ${windowLen} นัด`,
      rewardText: 'พลังทีม +2 · ขวัญทีม +5 (5 นัด) · เชื่อมั่น +6%',
      penaltyText: 'ขวัญทีม -5 (4 นัด) · เชื่อมั่น -6%',
      issuedSeason: s.season,
      issuedMd: curMd,
      dueMd,
      startValue: me.pts,
      targetValue: ptTarget,
      status: 'active'
    };
  }

  s.boardDirective = dir;
  pushBoardFeedback(s, 'warn', `คำสั่งบอร์ด: ${dir.title} — ${dir.targetLabel}`);
  pushFeed(s, 'บอร์ดบริหาร', `📋 คำสั่งบอร์ดใหม่: ${dir.title} (${dir.targetLabel})`, 'offer');
  return dir;
}

export function evaluateAndIssueBoardDirectives(s: GameState) {
  if (s.mode !== 'm') return;
  const me = s.teams[s.me];
  if (!me) return;

  // Prune expired temporary board effects
  s.boardEffects = getActiveBoardEffects(s);

  const curMd = s.md ?? 0;
  const activeDir = s.boardDirective;

  if (activeDir && activeDir.status === 'active') {
    const prog = getBoardDirectiveProgress(s, activeDir);
    const earlyFailDefense = activeDir.kind === 'tighten_defense' && prog.current > activeDir.targetValue;
    const deadlineHit = curMd >= activeDir.dueMd;

    if (prog.isComplete && !earlyFailDefense) {
      activeDir.status = 'passed';
      activeDir.evaluatedMd = curMd;
      s.bd = clamp((s.bd ?? 50) + 6, 0, 100);
      s.mgrRep = (s.mgrRep ?? 50) + 5;
      s.boardDirectiveCd = curMd + 3;

      if (activeDir.kind === 'reduce_wages') {
        addBoardTempEffect(s, 'โบนัสบอร์ด: วินัยการเงินเยี่ยม (+6 ขวัญทีม)', 'bonus', 'mor', 6, 5);
        addBoardTempEffect(s, 'โบนัสบอร์ด: ทีมลงตัว (+2 เกมรุก)', 'bonus', 'att', 2, 5);
      } else if (activeDir.kind === 'youth_focus') {
        addBoardTempEffect(s, 'โบนัสบอร์ด: พลังหนุ่มคึกคัก (+2 เกมรุก)', 'bonus', 'att', 2, 5);
        addBoardTempEffect(s, 'โบนัสบอร์ด: พลังหนุ่มช่วยรับ (+2 เกมรับ)', 'bonus', 'def', 2, 5);
      } else if (activeDir.kind === 'tighten_defense') {
        addBoardTempEffect(s, 'โบนัสบอร์ด: วินัยเกมรับแน่น (+3 เกมรับ)', 'bonus', 'def', 3, 5);
      } else if (activeDir.kind === 'attack_spark') {
        addBoardTempEffect(s, 'โบนัสบอร์ด: เกมรุกมั่นใจ (+3 เกมรุก)', 'bonus', 'att', 3, 5);
        addBoardTempEffect(s, 'โบนัสบอร์ด: แฟนบอลคึกคัก (+4% แฟนบอล)', 'bonus', 'fan', 4, 5);
      } else if (activeDir.kind === 'boost_finances') {
        addBoardTempEffect(s, 'โบนัสบอร์ด: การเงินมั่นคง (+5 ขวัญทีม)', 'bonus', 'mor', 5, 5);
        addBoardTempEffect(s, 'โบนัสบอร์ด: ศรัทธาแฟนบอล (+5% แฟนบอล)', 'bonus', 'fan', 5, 5);
      } else {
        addBoardTempEffect(s, 'โบนัสบอร์ด: ฟอร์มร้อนแรง (+2 เกมรุก)', 'bonus', 'att', 2, 5);
        addBoardTempEffect(s, 'โบนัสบอร์ด: ห้องแต่งตัวคึกคัก (+5 ขวัญทีม)', 'bonus', 'mor', 5, 5);
      }

      pushBoardFeedback(s, 'ok', `✅ บอร์ดพอใจภารกิจ "${activeDir.title}" สำเร็จ! รับโบนัสชั่วคราว 5 นัด`);
      pushFeed(s, 'บอร์ดบริหาร', `✅ ผ่านคำสั่งบอร์ด "${activeDir.title}"! (${activeDir.rewardText})`, 'ok');
    } else if (earlyFailDefense || deadlineHit) {
      activeDir.status = 'failed';
      activeDir.evaluatedMd = curMd;
      s.bd = clamp((s.bd ?? 50) - 6, 0, 100);
      s.boardDirectiveCd = curMd + 3;

      if (activeDir.kind === 'reduce_wages') {
        addBoardTempEffect(s, 'แรงกดดันบอร์ด: งบค่าเหนื่อยตึง (-4 ขวัญทีม)', 'penalty', 'mor', -4, 4);
        addBoardTempEffect(s, 'แรงกดดันบอร์ด: สมาธิลดลง (-2 เกมรุก)', 'penalty', 'att', -2, 4);
      } else if (activeDir.kind === 'youth_focus') {
        addBoardTempEffect(s, 'แรงกดดันบอร์ด: แฟนบอลผิดหวัง (-4% แฟนบอล)', 'penalty', 'fan', -4, 4);
        addBoardTempEffect(s, 'แรงกดดันบอร์ด: พลังทีมแผ่ว (-1 เกมรุก)', 'penalty', 'att', -1, 4);
      } else if (activeDir.kind === 'tighten_defense') {
        addBoardTempEffect(s, 'แรงกดดันบอร์ด: แนวรับขาดความมั่นใจ (-3 เกมรับ)', 'penalty', 'def', -3, 4);
      } else if (activeDir.kind === 'attack_spark') {
        addBoardTempEffect(s, 'แรงกดดันบอร์ด: กองหน้ากดดัน (-3 เกมรุก)', 'penalty', 'att', -3, 4);
      } else if (activeDir.kind === 'boost_finances') {
        addBoardTempEffect(s, 'แรงกดดันบอร์ด: วิกฤติการเงิน (-5 ขวัญทีม)', 'penalty', 'mor', -5, 4);
      } else {
        addBoardTempEffect(s, 'แรงกดดันบอร์ด: ฟอร์มต่ำกว่าเป้า (-5 ขวัญทีม)', 'penalty', 'mor', -5, 4);
      }

      pushBoardFeedback(s, 'urg', `⚠️ ไม่ผ่านคำสั่ง "${activeDir.title}" — บอร์ดคาดโทษชั่วคราว 4 นัด`);
      pushFeed(s, 'บอร์ดบริหาร', `⚠️ ไม่ผ่านคำสั่งบอร์ด "${activeDir.title}" (${activeDir.penaltyText})`, 'urg');
    }
  } else if (activeDir && curMd >= (activeDir.evaluatedMd ?? curMd) + 2) {
    s.boardDirective = null;
  }

  // Clear finished directive before issuing a fresh one if cooldown passed
  if (!s.boardDirective && curMd >= 2 && curMd <= (s.fx?.length || 30) - 3 && curMd >= (s.boardDirectiveCd ?? 0)) {
    const shouldIssue = curMd === 2 || Math.random() < 0.42;
    if (shouldIssue) {
      issueBoardDirective(s);
      return;
    }
  }

  // Occasional ambient board feedback on streaks / finances
  const fm = me.fm || '';
  if (curMd >= 3 && curMd % 3 === 0) {
    if (fm.endsWith('WWW')) {
      addBoardTempEffect(s, 'คำชมจากบอร์ด: ชนะรวด 3 นัด (+4 ขวัญทีม)', 'bonus', 'mor', 4, 3);
      pushBoardFeedback(s, 'ok', '👏 บอร์ดชื่นชมผลงานชนะ 3 นัดติด มอบขวัญทีมชั่วคราว +4 เป็นเวลา 3 นัด');
    } else if (fm.endsWith('LLL')) {
      addBoardTempEffect(s, 'คำเตือนบอร์ด: แพ้ 3 นัดติด (-4 ขวัญทีม)', 'penalty', 'mor', -4, 3);
      pushBoardFeedback(s, 'urg', '📢 บอร์ดเรียกเตือนหลังแพ้ 3 นัดรวด กระทบขวัญทีมชั่วคราว -4 เป็นเวลา 3 นัด');
    }
  }
}

export function recordFinanceSnapshot(s: GameState) {
  if (s.mode !== 'm') return;
  const curSeason = s.season ?? 1;
  const curMd = Math.max(0, Math.round(s.md ?? 0));
  const inc = curMd === 0 ? 0 : Math.round(s.finPendIn || 0);
  const exp = curMd === 0 ? 0 : Math.round(s.finPendOut || 0);

  const list = (s.finHist || []).filter((pt) => pt.s === curSeason);
  const existingIdx = list.findIndex((pt) => pt.md === curMd);
  const snap: FinanceHistoryPoint = {
    s: curSeason,
    md: curMd,
    bal: Math.round(s.money),
    inc,
    exp
  };
  if (existingIdx >= 0) {
    list[existingIdx] = snap;
  } else {
    list.push(snap);
  }
  list.sort((a, b) => a.md - b.md);
  s.finHist = list.slice(-34);
  if (curMd > 0) {
    s.finPendIn = 0;
    s.finPendOut = 0;
  }
}

export interface ClubFinanceChartPoint {
  label: string;
  md: number;
  bal: number | null;
  projBal: number | null;
  inc: number;
  exp: number;
  net: number;
  isProjection: boolean;
}

export function getClubFinanceChartData(
  s: GameState,
  est: ReturnType<typeof calcMatchdayFinanceEstimate>,
  includeProjection = true
): ClubFinanceChartPoint[] {
  const curSeason = s.season ?? 1;
  const curMd = Math.max(0, Math.round(s.md ?? 0));
  const recorded = (s.finHist || [])
    .filter((pt) => pt.s === curSeason)
    .slice()
    .sort((a, b) => a.md - b.md);

  const byMd = new Map<number, FinanceHistoryPoint>();
  recorded.forEach((pt) => byMd.set(pt.md, { ...pt }));

  // Backfill from finLog if loaded from an older save before finHist existed
  if (byMd.size === 0 && curMd > 0 && (s.finLog || []).length > 0) {
    let runningBal = Math.round(s.money);
    byMd.set(curMd, { s: curSeason, md: curMd, bal: runningBal, inc: 0, exp: 0 });
    for (let m = curMd; m >= 1; m--) {
      const mLogs = (s.finLog || []).filter((e) => e.s === curSeason && (e.m === m || (m === curMd && e.m === curMd + 1)));
      const inc = Math.round(mLogs.filter((e) => e.amt > 0).reduce((a, e) => a + e.amt, 0));
      const exp = Math.round(mLogs.filter((e) => e.amt < 0).reduce((a, e) => a + Math.abs(e.amt), 0));
      const curPt = byMd.get(m);
      if (curPt) {
        curPt.inc = inc;
        curPt.exp = exp;
      }
      runningBal -= inc - exp;
      if (!byMd.has(m - 1)) {
        byMd.set(m - 1, { s: curSeason, md: m - 1, bal: runningBal, inc: 0, exp: 0 });
      }
    }
  }

  if (byMd.size === 0) {
    byMd.set(curMd, { s: curSeason, md: curMd, bal: Math.round(s.money), inc: 0, exp: 0 });
  }

  const actualPts: ClubFinanceChartPoint[] = Array.from(byMd.values())
    .sort((a, b) => a.md - b.md)
    .map((pt) => ({
      label: pt.md === 0 ? 'เริ่ม' : `น.${pt.md}`,
      md: pt.md,
      bal: pt.bal,
      projBal: null,
      inc: pt.inc,
      exp: pt.exp,
      net: pt.inc - pt.exp,
      isProjection: false
    }));

  const pendIn = Math.round(s.finPendIn || 0);
  const pendOut = Math.round(s.finPendOut || 0);
  const lastSaved = actualPts[actualPts.length - 1];
  const curMoneyRound = Math.round(s.money);
  if (lastSaved && (pendIn > 0 || pendOut > 0 || lastSaved.bal !== curMoneyRound)) {
    actualPts.push({
      label: 'ตอนนี้',
      md: curMd,
      bal: curMoneyRound,
      projBal: null,
      inc: pendIn,
      exp: pendOut,
      net: pendIn - pendOut,
      isProjection: false
    });
  }

  if (!includeProjection || !actualPts.length) return actualPts;

  const totalMd = s.fx?.length || 30;
  const horizon = Math.min(5, Math.max(0, totalMd - curMd));
  if (horizon <= 0) return actualPts;

  const lastActual = actualPts[actualPts.length - 1];
  lastActual.projBal = lastActual.bal;

  let simBal = curMoneyRound;
  for (let i = 1; i <= horizon; i++) {
    const mIdx = curMd + i - 1;
    const pair = s.fx?.[mIdx]?.find((p) => p.includes(s.me));
    const isHome = pair ? pair[0] === s.me : i % 2 === 1;
    const mInc = Math.round(isHome ? est.homeIn : est.awayIn);
    const mExp = Math.round(est.totalOut);
    simBal += mInc - mExp;
    actualPts.push({
      label: `คาด น.${curMd + i}`,
      md: curMd + i,
      bal: null,
      projBal: simBal,
      inc: mInc,
      exp: mExp,
      net: mInc - mExp,
      isProjection: true
    });
  }

  return actualPts;
}

export function growPlayers(s: GameState) {
  s.teams.forEach((t) =>
    t.sq.forEach((q) => {
      q.age++;
      if (q.me) {
        if (s.p) {
          s.p.age = q.age;
          const myProf = getPlayerDevProfile(q, s.p);
          if (myProf.strongSeason && myProf.phase !== 'declining') {
            const bt = trySuperstarBreakthrough(q, s.p, 0.14);
            if (bt.brokeThrough) {
              pushFeed(s, 'แววซุปตาร์', `🌟 ฟอร์มยอดเยี่ยมตลอดซีซั่น! ศักยภาพของ ${q.n} ขยับสู่ ${bt.newPot}`, 'ok');
            }
          }
        }
        return;
      }
      if (q.con && !q.loan) q.con.yr = Math.max(0, (q.con.yr ?? 2) - 1);

      const devProf = getPlayerDevProfile(q, s.p);
      const D = devProf.D;
      const tlVal = D.tlVal;
      const ovScale = getOvGrowthScale(q.ov, q.pot);

      // Performance-driven Superstar Potential Breakthrough (shared equally by User & AI bots)
      if (devProf.phase !== 'declining' && devProf.strongSeason) {
        const bt = trySuperstarBreakthrough(q, null, 0.14);
        if (bt.brokeThrough && t.id === s.me) {
          pushFeed(
            s,
            'แววซุปตาร์',
            `🌟 ${q.n} โชว์ฟอร์มเด่นตลอดซีซั่น ทะลุขีดจำกัดศักยภาพสู่ ${bt.newPot}${bt.becameSuperstar ? ' (ก้าวสู่ระดับซุปตาร์!)' : ''}`,
            'ok'
          );
        }
      }

      // Gradual, steady offseason progression — hard to jump fast, steady while in growing/peak phase
      let delta = 0;
      const potCap = Math.max(q.ov, q.pot || 88);
      if (devProf.phase === 'growing') {
        const growChance = clamp((0.26 + (tlVal - 50) * 0.0055) * ovScale * devProf.formMult, 0.06, 0.72);
        if (q.ov < potCap && Math.random() < growChance) {
          delta = 1;
          if (q.age <= 20 && q.ov < 70 && tlVal >= 80 && devProf.sp >= 12 && Math.random() < 0.25) {
            delta = 2;
          }
        }
      } else if (devProf.phase === 'peak') {
        // Still develops steadily if performing well until peak ends; never drops randomly in peak
        if (q.ov < potCap && devProf.sp >= 10 && devProf.avgRating >= 6.8) {
          const peakChance = clamp(0.20 * ovScale * devProf.formMult, 0.03, 0.35);
          if (Math.random() < peakChance) delta = 1;
        }
      } else {
        // Past peak ("หมดช่วงพีคแล้ว"): gradual decline softened by fitness/professionalism/form
        const staySharp =
          (devProf.avgRating >= 7.35 && devProf.sp >= 15 && q.age <= devProf.effPkEnd + 2 && Math.random() < 0.45) ||
          (D.tr === 23 && Math.random() < 0.3);
        if (!staySharp) {
          const heavyDropAge = q.pos === 'GK' ? 36 : 34;
          delta = q.age >= heavyDropAge && Math.random() < (q.age >= heavyDropAge + 2 ? 0.55 : 0.28) ? -2 : -1;
        }
      }

      if (delta !== 0) {
        q.ov = clamp(q.ov + delta, 25, potCap);
      }

      // Natural Retirement ("จนกว่าจะแขวนสตั้ด"): age 33-39 (GK +2 yrs), stars in good form last longer
      const effAge = q.pos === 'GK' ? q.age - 2 : q.age;
      let retireProb = 0;
      if (effAge === 33) retireProb = 0.06;
      else if (effAge === 34) retireProb = 0.14;
      else if (effAge === 35) retireProb = 0.26;
      else if (effAge === 36) retireProb = 0.42;
      else if (effAge === 37) retireProb = 0.62;
      else if (effAge === 38) retireProb = 0.82;
      else if (effAge >= 39) retireProb = 1.0;

      if (retireProb > 0 && retireProb < 1) {
        if (q.ov >= 76 || devProf.avgRating >= 7.1) retireProb = Math.max(0.02, retireProb - 0.14);
        if (q.ov < BASE[t.tier] - 8 || devProf.sp <= 3) retireProb = Math.min(0.95, retireProb + 0.18);
      }

      if (retireProb > 0 && Math.random() < retireProb) {
        const retiredName = q.n;
        const retiredAge = q.age;
        if (t.id === s.me) {
          s.records = s.records || {};
          s.records.allTimePlayers = s.records.allTimePlayers || [];
          const retiredSnapshot = snapshotPlayerForRecord(q, { season: s.season, age: retiredAge });
          const existingRec = s.records.allTimePlayers.find((r) => r.name === retiredName);
          if (existingRec) {
            existingRec.retired = true;
            existingRec.retiredSeason = s.season;
            existingRec.retiredAge = retiredAge;
            existingRec.stillAtClub = false;
            existingRec.snapshot = retiredSnapshot;
          } else if ((q.sp || 0) > 0 || (q.sg || 0) > 0 || (q.sa || 0) > 0 || (q.cs || 0) > 0 || (q.motm || 0) > 0) {
            const avg = calcSeasonAvgRating(q, q.sp || 0, q.sg || 0, q.sa || 0, q.cs || 0);
            s.records.allTimePlayers.push({
              name: retiredName,
              pos: q.pos,
              ro: q.ro,
              no: q.no,
              vis: q.vis ? [...q.vis] : undefined,
              apps: q.sp || 0,
              goals: q.sg || 0,
              assists: q.sa || 0,
              cleanSheets: q.cs || 0,
              motm: q.motm || 0,
              seasons: (q.sp || 0) > 0 ? 1 : 0,
              firstSeason: s.season,
              lastSeason: s.season,
              playedSeasons: (q.sp || 0) > 0 ? [s.season] : undefined,
              bestAvgRating: avg,
              stillAtClub: false,
              retired: true,
              retiredSeason: s.season,
              retiredAge,
              snapshot: retiredSnapshot
            });
          }
        }
        const repOv = BASE[t.tier] + R(-1, 5) + (Math.random() < (t.tier >= 2 ? 0.25 : 0.14) ? R(3, 6) : 0);
        const fresh = mkPlayer(q.pos, repOv, true);
        if (fresh.age <= 21) {
          fresh.pot = clamp(repOv + R(10, 22), 68, 95);
        }
        Object.assign(q, fresh);
        delete q.con;
        delete q.loan;
        delete q.loanOpt;
        delete q.history;
        delete q.careerLog;
        delete q.signedSeason;
        delete q.signedMd;
        delete q.missions;
        delete q.sb;
        delete q.coreSb;
        if (t.id === s.me) {
          const msg = `👋 อำลาสนาม: ${retiredName} (อายุ ${retiredAge} ปี) ประกาศแขวนสตั๊ด · ดาวรุ่ง ${fresh.n} ขึ้นชุดใหญ่`;
          s.hist.push(msg);
          pushFeed(s, 'แขวนสตั๊ด', msg, '');
        }
      }
    })
  );
}

export function buildMatchExtraEvents(h: Team, a: Team, s?: GameState | null) {
  const X = [h, a].map((t) => rate(t, s).x.filter((q) => q.pos !== 'GK'));
  const N = [h.name, a.name];
  const templates: ((q: Player, t: string) => string)[] = [
    (q, t) => `⚠️ ${q.n} (${t}) เข้าสกัดหนักโดนผู้ตัดสินเรียกเตือน`,
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
        ? pickWeighted((z) => {
            const tr = DT(z, s?.p).tr;
            return tr === 1 || tr === 7 || tr === 15 || tr === 22 ? 3 : 1;
          })
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
          applyPositionAdaptation(s, s.teams[h], s.teams[a], r);
        })
      );
    });

  const tb = [0, 1, 2].map((i) => sortTable(s.teams.filter((t) => t.tier === i)));
  const preTierByTeam = new Map<number, number>();
  const rankByTeam = new Map<number, { rank: number; total: number }>();
  tb.forEach((tierList, tierIdx) => {
    tierList.forEach((tm, rIdx) => {
      preTierByTeam.set(tm.id, tierIdx);
      rankByTeam.set(tm.id, { rank: rIdx + 1, total: tierList.length });
    });
  });

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
  s.lg = nt;

  s.trophies = s.trophies || [];
  s.records = s.records || {};
  if (ch && !s.trophies.some((tr) => tr.season === s.season && tr.type === 'league')) {
    s.trophies.push({ season: s.season, title: `แชมป์ ${TN[mt]}`, tier: mt, type: 'league' });
    s.mgrRep = (s.mgrRep || 50) + (mt === 2 ? 100 : mt === 1 ? 60 : 40);
  } else if (nt > mt) {
    s.mgrRep = (s.mgrRep || 50) + 30;
  }

  const meTopScorer = meTeam.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0))[0];
  if (meTopScorer && (meTopScorer.sg || 0) > (s.records.topSeasonScorer?.g || 0)) {
    s.records.topSeasonScorer = { n: meTopScorer.n, g: meTopScorer.sg || 0, s: s.season };
  }
  const meTopAssist = meTeam.sq.slice().sort((a, b) => (b.sa || 0) - (a.sa || 0))[0];
  if (meTopAssist && (meTopAssist.sa || 0) > (s.records.topSeasonAssist?.a || 0)) {
    s.records.topSeasonAssist = { n: meTopAssist.n, a: meTopAssist.sa || 0, s: s.season };
  }
  if (meTeam.pts > (s.records.mostPoints?.pts || 0)) {
    s.records.mostPoints = { pts: meTeam.pts, s: s.season, tier: mt };
  }
  if (meTeam.gf > (s.records.mostGoalsSeason?.gf || 0)) {
    s.records.mostGoalsSeason = { gf: meTeam.gf, s: s.season, tier: mt };
  }
  if (meTeam.p > 0 && (s.records.bestDefenseSeason == null || meTeam.ga < s.records.bestDefenseSeason.ga)) {
    s.records.bestDefenseSeason = { ga: meTeam.ga, s: s.season, tier: mt };
  }
  s.records.allTimePlayers = mergeClubAllTimePlayers(
    s.records.allTimePlayers,
    meTeam,
    s.season,
    (q) => calcSeasonAvgRating(q, q.sp || 0, q.sg || 0, q.sa || 0, q.cs || 0)
  );

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
      const ntNote = `🇹🇭 ซีซั่น ${s.season}: ติดทีมชาติไทย${ntG ? ` (ยิง ${ntG} ประตู)` : ''}${gw ? ` · ${gw}` : ''}`;
      s.hist.push(ntNote);
      const meSqRef = meTeam.sq.find((q) => q.me);
      appendPlayerCareerLog(meSqRef, ntNote, p);
    }
  }

  const cupStatus = s.cup.done && s.cup.ids[0] === s.me ? 'แชมป์ถ้วย' : s.cup.alive ? 'ถึงรอบสุดท้าย' : 'ตกรอบ';
  const asiaStatus =
    s.ac && s.ac.p.includes(s.me)
      ? s.ac.done && s.ac.ids[0] === s.me
        ? 'แชมป์ถ้วยทวีป'
        : s.ac.alive
          ? 'ถึงรอบสุดท้าย'
          : 'ตกรอบถ้วยทวีป'
      : undefined;
  s.hist.push(`ซีซั่น ${s.season}: ${TN[mt]} อันดับ ${pos} · ${cupStatus}${asiaStatus ? ` · ${asiaStatus}` : ''}`);

  // Archive Team & Player Season Histories across all clubs in the pyramid
  const cupWinnerId = s.cup.done ? s.cup.ids[0] : -1;
  const asiaWinnerId = s.ac?.done ? s.ac.ids[0] : -1;
  s.teams.forEach((tm) => {
    const preTier = preTierByTeam.get(tm.id);
    const rk = rankByTeam.get(tm.id);
    const isChamp = rk ? rk.rank === 1 : false;
    const isCupChamp = tm.id === cupWinnerId;
    const isAsiaChamp = tm.id === asiaWinnerId;

    if (preTier != null && rk) {
      tm.trophies = tm.trophies || [];
      if (isChamp && !tm.trophies.some((tr) => tr.season === s.season && tr.type === 'league')) {
        tm.trophies.push({ season: s.season, title: `แชมป์ ${TN[preTier]}`, tier: preTier, type: 'league' });
      }
      // Season-end fanbase growth/churn for every club based on trophies, promotion, and relegation
      let fanEndMul = 0.015;
      if (isAsiaChamp) fanEndMul += 0.22;
      else if (isCupChamp) fanEndMul += 0.14;
      if (isChamp) fanEndMul += preTier === 2 ? 0.16 : 0.12;
      else if (tm.tier > preTier) fanEndMul += 0.10;
      else if (tm.tier < preTier) fanEndMul -= 0.06;
      else if (rk.rank <= 4) fanEndMul += 0.04;
      else if (rk.rank >= Math.max(5, rk.total - 2)) fanEndMul -= 0.02;
      adjustTeamFans(tm, Math.round(ensureTeamFans(tm) * fanEndMul));
      const tmScorer = tm.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0))[0];
      const teamHistEntry = {
        season: s.season,
        tier: preTier,
        nextTier: tm.tier,
        rank: rk.rank,
        totalTeams: rk.total,
        played: tm.p,
        won: tm.w,
        drawn: tm.d,
        lost: tm.l,
        gf: tm.gf,
        ga: tm.ga,
        pts: tm.pts,
        champion: isChamp,
        cupChampion: isCupChamp,
        asiaChampion: isAsiaChamp,
        cupStatus: tm.id === s.me ? cupStatus : isCupChamp ? 'แชมป์ถ้วย' : undefined,
        asiaStatus: tm.id === s.me ? asiaStatus : isAsiaChamp ? 'แชมป์ถ้วยทวีป' : undefined,
        topScorer: tmScorer && (tmScorer.sg || 0) > 0 ? `${tmScorer.n} (${tmScorer.sg})` : undefined
      };
      tm.history = [...(tm.history || []).filter((h) => h.season !== s.season), teamHistEntry];
    }

    const honor = isAsiaChamp
      ? 'แชมป์ทวีป'
      : isCupChamp
        ? 'แชมป์ถ้วย'
        : isChamp && preTier != null
          ? `แชมป์ ${TN[preTier]}`
          : preTier != null && tm.tier > preTier
            ? 'เลื่อนชั้น'
            : undefined;

    tm.sq.forEach((q) => {
      const sp = q.sp || 0;
      const sg = q.sg || 0;
      const sa = q.sa || 0;
      const cs = q.cs || 0;
      if (sp <= 0 && !q.me && tm.id !== s.me) return;
      const avgRating = calcSeasonAvgRating(q, sp, sg, sa, cs);
      const pEntry: PlayerSeasonHistoryRecord = {
        season: s.season,
        teamId: tm.id,
        teamName: tm.name,
        tier: preTier ?? tm.tier,
        ov: q.me && s.p ? ovMe(s.p) : q.ov,
        sp,
        sg,
        sa,
        cs,
        motm: q.motm || 0,
        yc: q.tyc ?? q.yc ?? 0,
        rc: q.rc || 0,
        avgRating,
        ...(honor ? { honor } : {})
      };
      q.history = [...(q.history || []).filter((h) => h.season !== s.season), pEntry].slice(-20);
      if (q.me && s.p) {
        s.p.history = [...q.history];
        const summaryLine = `📅 จบซีซั่น ${s.season} (${tm.name}): ลง ${sp} นัด · ${sg} ประตู · ${sa} แอสซิสต์${avgRating > 0 ? ` · เฉลี่ย ${avgRating.toFixed(2)}` : ''}${honor ? ` · 🏆 ${honor}` : ''}`;
        appendPlayerCareerLog(q, summaryLine, s.p);
      } else if (honor && sp > 0) {
        appendPlayerCareerLog(q, `🏆 ซีซั่น ${s.season}: คว้า${honor}กับ ${tm.name}`);
      }
    });
  });

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

  const stText = nt > mt ? 'เลื่อนชั้น! 🎉' : nt < mt ? 'ตกชั้น' : ch ? 'แชมป์ลีก!' : 'อยู่ชั้นเดิม';
  const leagueBestScorer = bs && bs.q.sg ? `${bs.q.n} (${bs.t.name}) ${bs.q.sg} ประตู` : '';
  const leagueBestAssist = ba && ba.q.sa ? `${ba.q.n} (${ba.t.name}) ${ba.q.sa} ครั้ง` : '';

  const playerStats: SeasonPlayerStatRecord[] = meTeam.sq
    .map((q) => {
      const sp = q.sp || 0;
      const sg = q.sg || 0;
      const sa = q.sa || 0;
      const cs = q.cs || 0;
      const motm = q.motm || 0;
      const yc = q.tyc ?? q.yc ?? 0;
      const rc = q.rc || 0;
      const avgRating = calcSeasonAvgRating(q, sp, sg, sa, cs);
      return {
        name: q.n,
        pos: q.pos,
        ro: q.ro,
        no: q.no,
        age: q.age,
        ov: q.ov,
        isMe: !!q.me,
        sp,
        sg,
        sa,
        cs,
        yc,
        rc,
        motm,
        avgRating
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating || b.sg + b.sa - (a.sg + a.sa) || b.sp - a.sp || b.ov - a.ov);

  const bestTeamScorer = playerStats
    .filter((x) => x.sg > 0)
    .sort((a, b) => b.sg - a.sg || b.sa - a.sa || a.sp - a.sp || b.avgRating - a.avgRating)[0];
  const bestTeamAssist = playerStats
    .filter((x) => x.sa > 0)
    .sort((a, b) => b.sa - a.sa || b.sg - a.sg || a.sp - a.sp || b.avgRating - a.avgRating)[0];
  const minAppsForRating = Math.max(1, Math.floor((meTeam.p || 1) * 0.25));
  const ratingPool = playerStats.filter((x) => x.avgRating > 0 && x.sp >= minAppsForRating);
  const ratingFallbackPool = playerStats.filter((x) => x.avgRating > 0 && x.sp > 0);
  const bestTeamRating = (ratingPool.length ? ratingPool : ratingFallbackPool)
    .slice()
    .sort((a, b) => b.avgRating - a.avgRating || b.sp - a.sp || b.sg + b.sa - (a.sg + a.sa))[0];
  const bestTeamCleanSheet = playerStats
    .filter((x) => x.pos === 'GK' && x.cs > 0)
    .sort((a, b) => b.cs - a.cs || b.sp - a.sp || b.avgRating - a.avgRating)[0];

  const archive: SeasonArchiveRecord = {
    season: s.season,
    teamId: meTeam.id,
    teamName: meTeam.name,
    tier: mt,
    nextTier: nt,
    rank: pos,
    totalTeams: tb[mt].length,
    played: meTeam.p,
    won: meTeam.w,
    drawn: meTeam.d,
    lost: meTeam.l,
    gf: meTeam.gf,
    ga: meTeam.ga,
    pts: meTeam.pts,
    champion: ch,
    statusText: stText,
    cupStatus,
    asiaStatus,
    leagueBestScorer,
    leagueBestAssist,
    topScorer: bestTeamScorer
      ? { name: bestTeamScorer.name, pos: bestTeamScorer.pos, sg: bestTeamScorer.sg, sp: bestTeamScorer.sp }
      : null,
    topAssist: bestTeamAssist
      ? { name: bestTeamAssist.name, pos: bestTeamAssist.pos, sa: bestTeamAssist.sa, sp: bestTeamAssist.sp }
      : null,
    topRating: bestTeamRating
      ? {
          name: bestTeamRating.name,
          pos: bestTeamRating.pos,
          avgRating: bestTeamRating.avgRating,
          sp: bestTeamRating.sp,
          motm: bestTeamRating.motm
        }
      : null,
    topCleanSheet: bestTeamCleanSheet
      ? { name: bestTeamCleanSheet.name, pos: bestTeamCleanSheet.pos, cs: bestTeamCleanSheet.cs, sp: bestTeamCleanSheet.sp }
      : null,
    players: playerStats
  };

  const existingArchives = (s.seasonArchives || []).filter((rec) => rec.season !== s.season);
  s.seasonArchives = [...existingArchives, archive].sort((a, b) => b.season - a.season);

  const trophiesWon = (s.trophies || []).filter((tr) => tr.season === s.season);

  return {
    mt,
    nt,
    pos,
    totalTeams: tb[mt].length,
    ch,
    cupStatus,
    asiaStatus,
    bestScorer: leagueBestScorer,
    bestAssist: leagueBestAssist,
    offers,
    stText,
    trophiesWon,
    archive
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

  const playerActions: Record<string, Partial<Record<PersonalMissionMetric, number>>> = {};
  const myPlayedList = r.playedNames?.[s.me] || xi(meTeam).map((q) => q.n);
  const myGoalsCount = homeId === s.me ? r.gh : r.ga;
  const oppGoalsCount = homeId === s.me ? r.ga : r.gh;
  meTeam.sq.forEach((q) => {
    if (!myPlayedList.includes(q.n)) return;
    if (s.mode === 'p' && q.me && pf && pf.played === false) return;
    const qGoals = r.evs.filter((e) => !e.og && e.t === s.me && e.who === q.n).length;
    const qAssists = r.evs.filter((e) => !e.og && e.t === s.me && e.as === q.n).length;
    const qRt = ratings[q.n] || 6.5;
    const act: Partial<Record<PersonalMissionMetric, number>> = {
      matches: 1,
      wins: myGoalsCount > oppGoalsCount ? 1 : 0,
      cleanSheets: oppGoalsCount === 0 && (q.pos === 'GK' || q.pos === 'DF') ? 1 : 0,
      highRatings: qRt >= 7.2 ? 1 : 0,
      goals: qGoals
    };
    if (q.pos === 'GK') {
      act.saves = R(2, 6) + (hasTrait(q, 'reflex_cat', s.p) ? R(1, 2) : 0);
      act.passes = R(12, 22) + (hasTrait(q, 'sweeper_keeper', s.p) || hasTrait(q, 'long_throw_counter', s.p) ? R(3, 6) : 0);
    } else {
      const sh = Math.max(
        qGoals * 2 +
          (q.pos === 'FW' ? R(1, 4) : q.pos === 'MF' ? R(0, 3) : R(0, 1)) +
          (hasTrait(q, 'long_shot_lover', s.p) || hasTrait(q, 'selfish_shooter', s.p) ? R(1, 2) : 0),
        0
      );
      act.shots = sh;
      act.onTarget = sh > 0 ? Math.max(qGoals, R(0, sh)) : 0;
      act.passes =
        (q.pos === 'MF' ? R(22, 40) : q.pos === 'DF' ? R(16, 30) : R(10, 22)) +
        (hasTrait(q, 'tempo_controller', s.p) || hasTrait(q, 'ball_playing_cb', s.p) ? R(4, 8) : 0);
      act.crossAssists =
        qAssists * 2 +
        (q.pos === 'MF' || q.pos === 'DF' ? R(1, 3) : R(0, 2)) +
        (hasTrait(q, 'early_crosser', s.p) || hasTrait(q, 'killer_passer', s.p) ? R(1, 2) : 0);
      act.dribbles =
        (q.pos === 'FW' || q.pos === 'MF' ? R(2, 6) : R(1, 3)) +
        (hasTrait(q, 'flair_dribbler', s.p) ? R(1, 3) : 0);
      act.tackles =
        (q.pos === 'DF' ? R(3, 6) : q.pos === 'MF' ? R(2, 4) : R(0, 2)) +
        (hasTrait(q, 'slide_tackler', s.p) || hasTrait(q, 'interception_hawk', s.p) ? R(1, 2) : 0);
      act.blocks = (q.pos === 'DF' ? R(0, 2) : R(0, 1)) + (hasTrait(q, 'body_blocker', s.p) ? 1 : 0);
      act.headers =
        (q.pos === 'DF' || q.pos === 'FW' ? R(1, 3) : R(0, 2)) +
        (hasTrait(q, 'aerial_menace', s.p) ? R(1, 2) : 0);
      if (q.pos === 'MF' || q.pos === 'FW' || hasTrait(q, 'setpiece_specialist', s.p)) {
        act.setpieces = R(0, 2) + (hasTrait(q, 'setpiece_specialist', s.p) ? 2 : 0);
      }
    }
    playerActions[q.n] = act;
  });

  const attInfo = computeMatchAttendance(H, A, s, { kind, derby: !!s.derby });
  return {
    gh: r.gh,
    ga: r.ga,
    evs: r.evs,
    xgH: r.xgH || 1.1,
    xgA: r.xgA || 1.0,
    att: attInfo.att,
    cap: attInfo.cap,
    pen,
    penText,
    ratings,
    motm,
    pf,
    finalTac: meTeam.tac,
    finalLu: xi(meTeam).map((q) => q.n),
    cards: r.cards || [],
    subs: r.subs || [],
    playedNames: r.playedNames || {},
    playedSlots: r.playedSlots || {},
    playerActions
  };
}
