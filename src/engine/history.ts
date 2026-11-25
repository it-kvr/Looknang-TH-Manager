import type {
  ClubAllTimePlayerRecord,
  CupCompKey,
  GameState,
  Player,
  PlayerCareerProfile,
  PlayerSeasonHistoryRecord,
  Team,
  TeamSeasonHistoryRecord,
  TrophyRecord
} from '../types/game';
import { TN } from '../data/thaiFootballData';
import { clamp } from '../utils/math';
import { ovMe, DT } from './playerCore';

export function appendPlayerCareerLog(
  q: Player | null | undefined,
  entry: string,
  careerP?: PlayerCareerProfile | null
) {
  if (!entry) return;
  if (q) {
    const prev = q.careerLog || [];
    if (prev[prev.length - 1] !== entry) {
      q.careerLog = [...prev, entry].slice(-30);
    }
  }
  if (careerP) {
    const prevP = careerP.careerLog || [];
    if (prevP[prevP.length - 1] !== entry) {
      careerP.careerLog = [...prevP, entry].slice(-30);
    }
  }
}

export function calcSeasonAvgRating(q: Partial<Player>, sp: number, sg: number, sa: number, cs: number): number {
  if ((q.sra || 0) > 0) {
    return Math.round(((q.srs || 0) / q.sra!) * 100) / 100;
  }
  if (sp <= 0) return 0;
  return clamp(
    Math.round((6.2 + (sg * 1.05 + sa * 0.65 + cs * 0.5) / Math.max(1, sp) + ((q.ov || 60) - 60) / 90) * 100) / 100,
    5.0,
    9.5
  );
}

export function getPlayerCupTotals(
  q: Partial<Player> | null | undefined,
  comp: CupCompKey | 'all' = 'all'
): { sp: number; sg: number; sa: number; cs: number; srs: number; sra: number; motm: number; yc: number; rc: number; avgRating: number } {
  const cs = q?.cupStats;
  if (!cs) {
    return { sp: 0, sg: 0, sa: 0, cs: 0, srs: 0, sra: 0, motm: 0, yc: 0, rc: 0, avgRating: 0 };
  }
  const keys: CupCompKey[] = comp === 'all' ? ['cup', 'lc', 'dc', 'sc', 'asia'] : [comp];
  let sp = 0;
  let sg = 0;
  let sa = 0;
  let cleanSheets = 0;
  let srs = 0;
  let sra = 0;
  let motm = 0;
  let yc = 0;
  let rc = 0;
  keys.forEach((k) => {
    const rec = cs[k];
    if (!rec) return;
    sp += rec.sp || 0;
    sg += rec.sg || 0;
    sa += rec.sa || 0;
    cleanSheets += rec.cs || 0;
    srs += rec.srs || 0;
    sra += rec.sra || 0;
    motm += rec.motm || 0;
    yc += rec.yc || 0;
    rc += rec.rc || 0;
  });
  const avgRating = sra > 0 ? Math.round((srs / sra) * 100) / 100 : 0;
  return { sp, sg, sa, cs: cleanSheets, srs, sra, motm, yc, rc, avgRating };
}

export function snapshotPlayerForRecord(
  q: Player,
  retiredInfo?: { season: number; age: number }
): Player {
  const { missions: _omitMissions, ...rest } = q;
  const copy: Player = {
    ...rest,
    traits: q.traits ? [...q.traits] : undefined,
    altRoles: q.altRoles ? [...q.altRoles] : undefined,
    roleExp: q.roleExp ? { ...q.roleExp } : undefined,
    vis: q.vis ? [...q.vis] : undefined,
    customA: q.customA ? { ...q.customA } : undefined,
    customD: q.customD ? { ...q.customD } : undefined,
    sb: q.sb ? { ...q.sb } : undefined,
    coreSb: q.coreSb ? { ...q.coreSb } : undefined,
    cupStats: q.cupStats
      ? (Object.fromEntries(
          Object.entries(q.cupStats).map(([k, v]) => [k, v ? { ...v } : v])
        ) as Player['cupStats'])
      : undefined,
    history: q.history
      ? q.history.map((h) => ({
          ...h,
          a: h.a ? { ...h.a } : undefined,
          startA: h.startA ? { ...h.startA } : undefined
        }))
      : undefined,
    careerLog: q.careerLog ? [...q.careerLog] : undefined,
    seasonProg: q.seasonProg
      ? {
          s: q.seasonProg.s,
          pts: q.seasonProg.pts ? q.seasonProg.pts.map((pt) => ({ ...pt, a: { ...pt.a } })) : []
        }
      : undefined
  };
  if (retiredInfo) {
    copy.retired = true;
    copy.retiredSeason = retiredInfo.season;
    copy.age = retiredInfo.age;
    copy.fit = 100;
    copy.inj = 0;
    copy.sus = 0;
    const retireNote = `👋 อำลาสนามหลังจบซีซั่น ${retiredInfo.season} (อายุ ${retiredInfo.age} ปี)`;
    if (!copy.careerLog?.includes(retireNote)) {
      copy.careerLog = [...(copy.careerLog || []), retireNote].slice(-30);
    }
  }
  return copy;
}

export function mergeClubAllTimePlayers(
  existing: ClubAllTimePlayerRecord[] | undefined,
  team: Team,
  season: number,
  getAvgRating: (q: Player) => number
): ClubAllTimePlayerRecord[] {
  const sInt = Math.floor(season);
  const map = new Map<string, ClubAllTimePlayerRecord>();
  (existing || []).forEach((rec) => {
    map.set(rec.name, {
      ...rec,
      playedSeasons: rec.playedSeasons ? [...rec.playedSeasons] : undefined,
      vis: rec.vis ? [...rec.vis] : undefined,
      stillAtClub: false
    });
  });

  team.sq.forEach((q) => {
    const sp = q.sp || 0;
    const sg = q.sg || 0;
    const sa = q.sa || 0;
    const cs = q.cs || 0;
    const motm = q.motm || 0;
    const cup = getPlayerCupTotals(q, 'all');
    const seasonApps = sp + cup.sp;
    const seasonGoals = sg + cup.sg;
    const seasonAssists = sa + cup.sa;
    const seasonCs = cs + cup.cs;
    const seasonMotm = motm + cup.motm;
    const avg = Math.max(getAvgRating(q), cup.avgRating);
    const cur = map.get(q.n);
    if (cur) {
      if (cur.lastSeason < season) {
        cur.apps += seasonApps;
        cur.goals += seasonGoals;
        cur.assists += seasonAssists;
        cur.cleanSheets += seasonCs;
        cur.motm += seasonMotm;
        cur.cupApps = (cur.cupApps || 0) + cup.sp;
        cur.cupGoals = (cur.cupGoals || 0) + cup.sg;
        cur.cupAssists = (cur.cupAssists || 0) + cup.sa;
        cur.cupCleanSheets = (cur.cupCleanSheets || 0) + cup.cs;
        cur.cupMotm = (cur.cupMotm || 0) + cup.motm;
        if (seasonApps > 0) {
          cur.seasons += 1;
          const prevList = cur.playedSeasons || (cur.lastSeason > 0 ? [Math.floor(cur.lastSeason)] : []);
          if (!prevList.includes(sInt)) {
            cur.playedSeasons = [...prevList, sInt].sort((a, b) => a - b);
          }
          const inferredFirst = cur.firstSeason ?? (cur.playedSeasons?.[0] || Math.floor(cur.lastSeason) || sInt);
          cur.firstSeason = Math.min(inferredFirst, sInt);
        }
        cur.lastSeason = sInt;
      }
      cur.pos = q.pos;
      cur.ro = q.ro;
      if (q.no != null) cur.no = q.no;
      if (q.vis?.length) cur.vis = [...q.vis];
      cur.bestAvgRating = Math.max(cur.bestAvgRating, avg);
      cur.stillAtClub = true;
      cur.retired = false;
      cur.snapshot = snapshotPlayerForRecord(q);
    } else if (seasonApps > 0 || seasonGoals > 0 || seasonAssists > 0 || seasonCs > 0 || seasonMotm > 0) {
      map.set(q.n, {
        name: q.n,
        pos: q.pos,
        ro: q.ro,
        no: q.no,
        vis: q.vis ? [...q.vis] : undefined,
        apps: seasonApps,
        goals: seasonGoals,
        assists: seasonAssists,
        cleanSheets: seasonCs,
        motm: seasonMotm,
        ...(cup.sp > 0
          ? {
              cupApps: cup.sp,
              cupGoals: cup.sg,
              cupAssists: cup.sa,
              cupCleanSheets: cup.cs,
              cupMotm: cup.motm
            }
          : {}),
        seasons: seasonApps > 0 ? 1 : 0,
        firstSeason: sInt,
        lastSeason: sInt,
        playedSeasons: seasonApps > 0 ? [sInt] : undefined,
        bestAvgRating: avg,
        stillAtClub: true,
        snapshot: snapshotPlayerForRecord(q)
      });
    }
  });

  const allRecords = Array.from(map.values()).filter(
    (r) => r.apps > 0 || r.goals > 0 || r.assists > 0 || r.cleanSheets > 0 || r.motm > 0
  );
  const keepNames = new Set<string>();
  const metrics: Array<keyof Pick<ClubAllTimePlayerRecord, 'goals' | 'assists' | 'apps' | 'cleanSheets' | 'motm'>> = [
    'goals',
    'assists',
    'apps',
    'cleanSheets',
    'motm'
  ];
  metrics.forEach((m) => {
    allRecords
      .filter((r) => (r[m] || 0) > 0)
      .sort((a, b) => (b[m] || 0) - (a[m] || 0) || b.apps - a.apps)
      .slice(0, 20)
      .forEach((r) => keepNames.add(r.name));
  });
  allRecords
    .slice()
    .sort((a, b) => b.apps + b.goals * 2 + b.assists - (a.apps + a.goals * 2 + a.assists))
    .slice(0, 60)
    .forEach((r) => keepNames.add(r.name));

  return allRecords
    .filter((r) => keepNames.has(r.name))
    .sort((a, b) => b.apps + b.goals * 2 + b.assists - (a.apps + a.goals * 2 + a.assists))
    .slice(0, 100);
}

export interface CareerTotalsSplit {
  apps: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  motm: number;
  avgRating: number;
}

export interface PlayerCareerSummary {
  seasons: PlayerSeasonHistoryRecord[];
  currentRow: PlayerSeasonHistoryRecord | null;
  totalSeasons: number;
  totalApps: number;
  totalGoals: number;
  totalAssists: number;
  totalCleanSheets: number;
  totalMotm: number;
  totalYellow: number;
  totalRed: number;
  avgRating: number;
  leagueTotals: CareerTotalsSplit;
  cupTotals: CareerTotalsSplit;
  honors: { season: number; honor: string; teamName: string }[];
  careerLog: string[];
}

export function getPlayerCareerSummary(
  player: Player,
  team: Team | null,
  state: GameState,
  careerP?: PlayerCareerProfile | null
): PlayerCareerSummary {
  const isMe = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
  const pProf = isMe ? careerP || state.p : null;

  const baseMap = new Map<number, PlayerSeasonHistoryRecord>();
  const rawHistory = (pProf?.history && pProf.history.length ? pProf.history : player.history) || [];
  rawHistory.forEach((h) => {
    baseMap.set(h.season, { ...h });
  });

  // Fallback backfill from user's SeasonArchives if player played there before history tracking existed
  if (state.seasonArchives?.length) {
    state.seasonArchives.forEach((arc) => {
      if (baseMap.has(arc.season)) return;
      const found = arc.players.find((pl) => pl.name === player.n || (isMe && pl.isMe));
      if (found && (found.sp > 0 || (found.cupSp || 0) > 0 || found.sg > 0 || (found.cupSg || 0) > 0 || found.sa > 0 || (found.cupSa || 0) > 0)) {
        const honor = arc.champion
          ? `แชมป์ ${TN[arc.tier]}`
          : arc.nextTier > arc.tier
            ? 'เลื่อนชั้น'
            : arc.cupStatus === 'แชมป์ถ้วย'
              ? 'แชมป์ถ้วย'
              : arc.leagueCupStatus === 'แชมป์ไทยลีก คัพ'
                ? 'แชมป์ไทยลีก คัพ'
                : arc.superCupStatus === 'แชมป์แชมเปี้ยนส์ คัพ'
                  ? 'แชมป์แชมเปี้ยนส์ คัพ'
                  : arc.divCupStatus === 'แชมป์ถ้วยดิวิชั่น'
                    ? 'แชมป์ถ้วยดิวิชั่น'
                    : arc.asiaStatus === 'แชมป์ถ้วยทวีป'
                      ? 'แชมป์ทวีป'
                      : undefined;
        baseMap.set(arc.season, {
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
          avgRating: found.avgRating,
          ...(found.cupSp
            ? {
                cupSp: found.cupSp,
                cupSg: found.cupSg || 0,
                cupSa: found.cupSa || 0,
                cupCs: found.cupCs || 0,
                cupMotm: found.cupMotm || 0,
                cupAvgRating: found.cupAvgRating || 0
              }
            : {}),
          honor
        });
      }
    });
  }

  const pastSeasons = Array.from(baseMap.values()).sort((a, b) => b.season - a.season);
  const hasCurrentArchived = baseMap.has(state.season);

  const curSp = player.sp || 0;
  const curSg = player.sg || 0;
  const curSa = player.sa || 0;
  const curCs = player.cs || 0;
  const curMotm = player.motm || 0;
  const curYc = player.tyc ?? player.yc ?? 0;
  const curRc = player.rc || 0;
  const curOv = isMe && pProf ? ovMe(pProf) : player.ov;
  const curA = { ...DT(player, pProf).a };
  const curAvg = calcSeasonAvgRating({ ...player, ov: curOv }, curSp, curSg, curSa, curCs);
  const curCup = getPlayerCupTotals(player, 'all');

  const currentRow: PlayerSeasonHistoryRecord | null =
    !hasCurrentArchived && !player.retired
      ? {
          season: state.season,
          teamId: team?.id ?? -1,
          teamName: team?.name || (player.free ? 'ฟรีเอเยนต์' : 'ตลาดซื้อขาย'),
          tier: team?.tier ?? 0,
          ov: curOv,
          a: curA,
          sp: curSp,
          sg: curSg,
          sa: curSa,
          cs: curCs,
          motm: curMotm,
          yc: curYc,
          rc: curRc,
          avgRating: curAvg,
          ...(curCup.sp > 0
            ? {
                cupSp: curCup.sp,
                cupSg: curCup.sg,
                cupSa: curCup.sa,
                cupCs: curCup.cs,
                cupMotm: curCup.motm,
                cupAvgRating: curCup.avgRating
              }
            : {})
        }
      : null;

  const allRows = currentRow ? [currentRow, ...pastSeasons] : pastSeasons;
  const lgApps = allRows.reduce((s, r) => s + r.sp, 0);
  const lgGoals = allRows.reduce((s, r) => s + r.sg, 0);
  const lgAssists = allRows.reduce((s, r) => s + r.sa, 0);
  const lgCs = allRows.reduce((s, r) => s + r.cs, 0);
  const lgMotm = allRows.reduce((s, r) => s + r.motm, 0);

  const cupApps = allRows.reduce((s, r) => s + (r.cupSp || 0), 0);
  const cupGoals = allRows.reduce((s, r) => s + (r.cupSg || 0), 0);
  const cupAssists = allRows.reduce((s, r) => s + (r.cupSa || 0), 0);
  const cupCs = allRows.reduce((s, r) => s + (r.cupCs || 0), 0);
  const cupMotm = allRows.reduce((s, r) => s + (r.cupMotm || 0), 0);

  const sumApps = lgApps + cupApps;
  const sumGoals = lgGoals + cupGoals;
  const sumAssists = lgAssists + cupAssists;

  // Career profile can hold pre-history match tallies from earlier saves
  const totalApps = isMe && pProf ? Math.max(sumApps, pProf.ap || 0) : sumApps;
  const totalGoals = isMe && pProf ? Math.max(sumGoals, pProf.gl || 0) : sumGoals;
  const totalAssists = isMe && pProf ? Math.max(sumAssists, pProf.as || 0) : sumAssists;
  const totalCleanSheets = lgCs + cupCs;
  const totalMotm = lgMotm + cupMotm;
  const totalYellow = allRows.reduce((s, r) => s + r.yc, 0);
  const totalRed = allRows.reduce((s, r) => s + r.rc, 0);

  let lgWeightedSum = 0;
  let lgWeightedApps = 0;
  let cupWeightedSum = 0;
  let cupWeightedApps = 0;
  allRows.forEach((r) => {
    if (r.avgRating > 0 && r.sp > 0) {
      lgWeightedSum += r.avgRating * r.sp;
      lgWeightedApps += r.sp;
    }
    if ((r.cupAvgRating || 0) > 0 && (r.cupSp || 0) > 0) {
      cupWeightedSum += (r.cupAvgRating || 0) * (r.cupSp || 0);
      cupWeightedApps += r.cupSp || 0;
    }
  });
  const lgAvg = lgWeightedApps > 0 ? Math.round((lgWeightedSum / lgWeightedApps) * 100) / 100 : 0;
  const cupAvg = cupWeightedApps > 0 ? Math.round((cupWeightedSum / cupWeightedApps) * 100) / 100 : 0;
  const totalWeightedApps = lgWeightedApps + cupWeightedApps;
  const avgRating =
    totalWeightedApps > 0
      ? Math.round(((lgWeightedSum + cupWeightedSum) / totalWeightedApps) * 100) / 100
      : isMe && pProf && (pProf.ap || 0) > 0
        ? Math.round(((pProf.rs || 0) / pProf.ap) * 100) / 100
        : 0;

  const honors = pastSeasons
    .filter((r) => !!r.honor)
    .map((r) => ({ season: r.season, honor: r.honor!, teamName: r.teamName }));

  const mergedLog: string[] = [];
  const rawLogs = [...(pProf?.careerLog || []), ...(player.careerLog || [])];
  rawLogs.forEach((line) => {
    if (line && !mergedLog.includes(line)) mergedLog.push(line);
  });
  if (player.signedSeason != null && team) {
    const signNote = `✍️ ย้ายร่วมทัพ ${team.name} ในซีซั่น ${player.signedSeason}${player.loan ? ' (ยืมตัว)' : ''}`;
    if (!mergedLog.some((x) => x.includes(`ซีซั่น ${player.signedSeason}`) && x.includes(team.name))) {
      mergedLog.unshift(signNote);
    }
  }

  return {
    seasons: pastSeasons,
    currentRow,
    totalSeasons: pastSeasons.length + (currentRow && (currentRow.sp > 0 || (currentRow.cupSp || 0) > 0 || state.md > 0) ? 1 : 0),
    totalApps,
    totalGoals,
    totalAssists,
    totalCleanSheets,
    totalMotm,
    totalYellow,
    totalRed,
    avgRating,
    leagueTotals: {
      apps: lgApps,
      goals: lgGoals,
      assists: lgAssists,
      cleanSheets: lgCs,
      motm: lgMotm,
      avgRating: lgAvg
    },
    cupTotals: {
      apps: cupApps,
      goals: cupGoals,
      assists: cupAssists,
      cleanSheets: cupCs,
      motm: cupMotm,
      avgRating: cupAvg
    },
    honors,
    careerLog: mergedLog.slice().reverse()
  };
}

export interface ClubLegacySummary {
  seasons: TeamSeasonHistoryRecord[];
  currentSeasonRow: TeamSeasonHistoryRecord | null;
  trophies: TrophyRecord[];
  totalSeasons: number;
  totalPlayed: number;
  totalWon: number;
  totalDrawn: number;
  totalLost: number;
  totalGf: number;
  totalGa: number;
  winPct: number;
  bestLeagueFinish: { tier: number; rank: number; season: number } | null;
  legends: ClubAllTimePlayerRecord[];
}

export function getClubLegacySummary(team: Team, state: GameState, curRank?: number, curTotalTeams?: number): ClubLegacySummary {
  const isUserClub = team.id === state.me;
  const seasonMap = new Map<number, TeamSeasonHistoryRecord>();

  (team.history || []).forEach((h) => seasonMap.set(h.season, { ...h }));
  if (isUserClub && state.seasonArchives?.length) {
    state.seasonArchives.forEach((arc) => {
      if (seasonMap.has(arc.season)) return;
      seasonMap.set(arc.season, {
        season: arc.season,
        tier: arc.tier,
        nextTier: arc.nextTier,
        rank: arc.rank,
        totalTeams: arc.totalTeams,
        played: arc.played,
        won: arc.won,
        drawn: arc.drawn,
        lost: arc.lost,
        gf: arc.gf,
        ga: arc.ga,
        pts: arc.pts,
        champion: arc.champion,
        cupChampion: arc.cupStatus === 'แชมป์ถ้วย',
        asiaChampion: arc.asiaStatus === 'แชมป์ถ้วยทวีป',
        leagueCupChampion: arc.leagueCupStatus === 'แชมป์ไทยลีก คัพ',
        superCupChampion: arc.superCupStatus === 'แชมป์แชมเปี้ยนส์ คัพ',
        divCupChampion: arc.divCupStatus === 'แชมป์ถ้วยดิวิชั่น',
        cupStatus: arc.cupStatus,
        asiaStatus: arc.asiaStatus,
        leagueCupStatus: arc.leagueCupStatus,
        superCupStatus: arc.superCupStatus,
        divCupStatus: arc.divCupStatus,
        topScorer: arc.topScorer ? `${arc.topScorer.name} (${arc.topScorer.sg})` : undefined
      });
    });
  }

  const pastSeasons = Array.from(seasonMap.values()).sort((a, b) => b.season - a.season);
  const hasCur = seasonMap.has(state.season);
  const topSq = team.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0))[0];
  const currentSeasonRow: TeamSeasonHistoryRecord | null = !hasCur
    ? {
        season: state.season,
        tier: team.tier,
        nextTier: team.tier,
        rank: curRank || 1,
        totalTeams: curTotalTeams || 16,
        played: team.p || 0,
        won: team.w || 0,
        drawn: team.d || 0,
        lost: team.l || 0,
        gf: team.gf || 0,
        ga: team.ga || 0,
        pts: team.pts || 0,
        topScorer: topSq && (topSq.sg || 0) > 0 ? `${topSq.n} (${topSq.sg})` : undefined
      }
    : null;

  const allSeasons = currentSeasonRow && team.p > 0 ? [currentSeasonRow, ...pastSeasons] : pastSeasons;
  const totalPlayed = allSeasons.reduce((s, r) => s + r.played, 0);
  const totalWon = allSeasons.reduce((s, r) => s + r.won, 0);
  const totalDrawn = allSeasons.reduce((s, r) => s + r.drawn, 0);
  const totalLost = allSeasons.reduce((s, r) => s + r.lost, 0);
  const totalGf = allSeasons.reduce((s, r) => s + r.gf, 0);
  const totalGa = allSeasons.reduce((s, r) => s + r.ga, 0);
  const winPct = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 1000) / 10 : 0;

  let bestLeagueFinish: { tier: number; rank: number; season: number } | null = null;
  pastSeasons.forEach((r) => {
    if (
      !bestLeagueFinish ||
      r.tier > bestLeagueFinish.tier ||
      (r.tier === bestLeagueFinish.tier && r.rank < bestLeagueFinish.rank)
    ) {
      bestLeagueFinish = { tier: r.tier, rank: r.rank, season: r.season };
    }
  });

  const trophies: TrophyRecord[] = [];
  const seenTrophy = new Set<string>();
  const addTrophy = (t: TrophyRecord) => {
    const key = `${t.season}_${t.type}_${t.title}`;
    if (!seenTrophy.has(key)) {
      seenTrophy.add(key);
      trophies.push(t);
    }
  };
  (team.trophies || []).forEach(addTrophy);
  if (isUserClub && state.trophies?.length) {
    state.trophies.forEach(addTrophy);
  }
  trophies.sort((a, b) => b.season - a.season);

  // Merge stored all-time legends with live squad stats for current season
  const rawLegends = isUserClub
    ? mergeClubAllTimePlayers(
        state.records?.allTimePlayers,
        team,
        state.season + (hasCur ? 0 : 0.01),
        (q) => calcSeasonAvgRating(q, q.sp || 0, q.sg || 0, q.sa || 0, q.cs || 0)
      )
    : mergeClubAllTimePlayers(
        undefined,
        team,
        state.season,
        (q) => calcSeasonAvgRating(q, q.sp || 0, q.sg || 0, q.sa || 0, q.cs || 0)
      );

  // Backfill exact played seasons & shirt number from archived seasons for historical legends
  const archiveSeasonByPlayer = new Map<string, { seasons: Set<number>; no?: number }>();
  if (isUserClub && state.seasonArchives?.length) {
    state.seasonArchives.forEach((arc) => {
      arc.players.forEach((pl) => {
        if (pl.sp > 0 || (pl.cupSp || 0) > 0 || pl.sg > 0 || (pl.cupSg || 0) > 0 || pl.sa > 0 || (pl.cupSa || 0) > 0 || pl.cs > 0 || (pl.cupCs || 0) > 0 || pl.motm > 0 || (pl.cupMotm || 0) > 0) {
          let entry = archiveSeasonByPlayer.get(pl.name);
          if (!entry) {
            entry = { seasons: new Set<number>(), no: pl.no };
            archiveSeasonByPlayer.set(pl.name, entry);
          }
          entry.seasons.add(arc.season);
          if (pl.no != null) entry.no = pl.no;
        }
      });
    });
  }

  const legends = rawLegends.map((leg) => {
    const arcInfo = archiveSeasonByPlayer.get(leg.name);
    const mergedSet = new Set<number>(leg.playedSeasons || []);
    if (arcInfo) {
      arcInfo.seasons.forEach((s) => mergedSet.add(s));
    }
    if (leg.lastSeason > 0 && mergedSet.size === 0) {
      mergedSet.add(Math.floor(leg.lastSeason));
    }
    const sortedSeasons = Array.from(mergedSet).sort((a, b) => a - b);
    const firstSeason = sortedSeasons[0] ?? leg.firstSeason ?? Math.floor(leg.lastSeason);
    const lastSeason = sortedSeasons[sortedSeasons.length - 1] ?? Math.floor(leg.lastSeason);
    return {
      ...leg,
      no: leg.no ?? arcInfo?.no,
      firstSeason,
      lastSeason,
      playedSeasons: sortedSeasons
    };
  });

  return {
    seasons: pastSeasons,
    currentSeasonRow,
    trophies,
    totalSeasons: pastSeasons.length + (currentSeasonRow && (team.p > 0 || state.md > 0) ? 1 : 0),
    totalPlayed,
    totalWon,
    totalDrawn,
    totalLost,
    totalGf,
    totalGa,
    winPct,
    bestLeagueFinish,
    legends
  };
}

export interface ResolvedLegendStatus {
  kind: 'club' | 'transferred' | 'free' | 'retired';
  label: string;
  shortLabel: string;
  inspectPlayer: Player;
  inspectTeam: Team | null;
}

export function resolveClubLegendProfile(
  leg: ClubAllTimePlayerRecord,
  clubTeam: Team,
  state: GameState
): ResolvedLegendStatus {
  const inClub = clubTeam.sq.find((q) => q.n === leg.name);
  if (inClub) {
    return {
      kind: 'club',
      label: 'ทีมนี้',
      shortLabel: 'ทีมนี้',
      inspectPlayer: inClub,
      inspectTeam: clubTeam
    };
  }

  for (const t of state.teams) {
    if (t.id === clubTeam.id) continue;
    const found = t.sq.find((q) => q.n === leg.name);
    if (found) {
      return {
        kind: 'transferred',
        label: `ย้ายไป ${t.name}`,
        shortLabel: `ย้ายไป ${t.name}`,
        inspectPlayer: found,
        inspectTeam: t
      };
    }
  }

  const inMarket = state.mk.find((q) => q.n === leg.name) || state.yth.find((q) => q.n === leg.name);
  if (inMarket) {
    return {
      kind: 'free',
      label: inMarket.free ? 'ฟรีเอเยนต์' : 'ตลาดนักเตะ',
      shortLabel: inMarket.free ? 'ฟรีเอเยนต์' : 'ตลาดนักเตะ',
      inspectPlayer: inMarket,
      inspectTeam: null
    };
  }

  // Retired or exited pyramid — build inspectable historical profile from snapshot or season archives
  let latestArcPl: { ov: number; age: number; sp: number; sg: number; sa: number; cs: number; motm: number; no?: number } | null = null;
  if (state.seasonArchives?.length) {
    const sortedArcs = state.seasonArchives.slice().sort((a, b) => b.season - a.season);
    for (const arc of sortedArcs) {
      const f = arc.players.find((pl) => pl.name === leg.name);
      if (f) {
        latestArcPl = f;
        break;
      }
    }
  }

  const retiredSeason = leg.retiredSeason ?? (leg.lastSeason ? Math.floor(leg.lastSeason) : undefined);
  const retiredAge = leg.retiredAge ?? latestArcPl?.age ?? 35;

  if (leg.snapshot) {
    return {
      kind: 'retired',
      label: retiredSeason ? `แขวนสตั๊ด (S${retiredSeason})` : 'แขวนสตั๊ด',
      shortLabel: 'แขวนสตั๊ด',
      inspectPlayer: {
        ...leg.snapshot,
        retired: true,
        retiredSeason: leg.snapshot.retiredSeason ?? retiredSeason,
        age: leg.snapshot.age || retiredAge,
        fit: 100,
        inj: 0,
        sus: 0
      },
      inspectTeam: null
    };
  }

  const fallbackRole = leg.ro || (leg.pos === 'GK' ? 'GK' : leg.pos === 'DF' ? 'CB' : leg.pos === 'MF' ? 'CM' : 'ST');
  const estOv = latestArcPl?.ov ?? clamp(Math.round(60 + (leg.bestAvgRating - 6.0) * 14), 54, 86);
  const fallbackPlayer: Player = {
    n: leg.name,
    pos: leg.pos,
    ro: fallbackRole,
    ov: estOv,
    age: retiredAge,
    pot: estOv,
    fit: 100,
    inj: 0,
    no: leg.no ?? latestArcPl?.no ?? 10,
    vis: leg.vis ? [...leg.vis] : undefined,
    sp: latestArcPl?.sp ?? leg.apps,
    sg: latestArcPl?.sg ?? leg.goals,
    sa: latestArcPl?.sa ?? leg.assists,
    cs: latestArcPl?.cs ?? leg.cleanSheets,
    motm: latestArcPl?.motm ?? leg.motm,
    ...(leg.cupApps
      ? {
          cupStats: {
            cup: {
              sp: leg.cupApps,
              sg: leg.cupGoals || 0,
              sa: leg.cupAssists || 0,
              cs: leg.cupCleanSheets || 0,
              srs: leg.bestAvgRating > 0 ? leg.bestAvgRating * leg.cupApps : 0,
              sra: leg.bestAvgRating > 0 ? leg.cupApps : 0,
              motm: leg.cupMotm || 0
            }
          }
        }
      : {}),
    retired: true,
    retiredSeason,
    careerLog: [
      `🏟️ ตำนานสโมสร ${clubTeam.name} · รวม ${leg.apps} นัด · ${leg.goals} ประตู · ${leg.assists} แอสซิสต์`,
      `👋 อำลาสนาม${retiredSeason ? `หลังจบซีซั่น ${retiredSeason}` : ''} (อายุ ${retiredAge} ปี)`
    ]
  };

  return {
    kind: 'retired',
    label: retiredSeason ? `แขวนสตั๊ด (S${retiredSeason})` : 'แขวนสตั๊ด',
    shortLabel: 'แขวนสตั๊ด',
    inspectPlayer: fallbackPlayer,
    inspectTeam: null
  };
}
