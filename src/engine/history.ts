import type {
  ClubAllTimePlayerRecord,
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
import { ovMe } from './playerCore';

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

export function mergeClubAllTimePlayers(
  existing: ClubAllTimePlayerRecord[] | undefined,
  team: Team,
  season: number,
  getAvgRating: (q: Player) => number
): ClubAllTimePlayerRecord[] {
  const map = new Map<string, ClubAllTimePlayerRecord>();
  (existing || []).forEach((rec) => {
    map.set(rec.name, { ...rec, stillAtClub: false });
  });

  team.sq.forEach((q) => {
    const sp = q.sp || 0;
    const sg = q.sg || 0;
    const sa = q.sa || 0;
    const cs = q.cs || 0;
    const motm = q.motm || 0;
    const avg = getAvgRating(q);
    const cur = map.get(q.n);
    if (cur) {
      if (cur.lastSeason < season) {
        cur.apps += sp;
        cur.goals += sg;
        cur.assists += sa;
        cur.cleanSheets += cs;
        cur.motm += motm;
        if (sp > 0) cur.seasons += 1;
        cur.lastSeason = season;
      }
      cur.pos = q.pos;
      cur.ro = q.ro;
      cur.bestAvgRating = Math.max(cur.bestAvgRating, avg);
      cur.stillAtClub = true;
    } else if (sp > 0 || sg > 0 || sa > 0 || cs > 0) {
      map.set(q.n, {
        name: q.n,
        pos: q.pos,
        ro: q.ro,
        apps: sp,
        goals: sg,
        assists: sa,
        cleanSheets: cs,
        motm,
        seasons: sp > 0 ? 1 : 0,
        lastSeason: season,
        bestAvgRating: avg,
        stillAtClub: true
      });
    }
  });

  return Array.from(map.values())
    .filter((r) => r.apps > 0 || r.goals > 0 || r.assists > 0)
    .sort((a, b) => b.apps + b.goals * 2 + b.assists - (a.apps + a.goals * 2 + a.assists))
    .slice(0, 60);
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
      if (found && (found.sp > 0 || found.sg > 0 || found.sa > 0)) {
        const honor = arc.champion
          ? `แชมป์ ${TN[arc.tier]}`
          : arc.nextTier > arc.tier
            ? 'เลื่อนชั้น'
            : arc.cupStatus === 'แชมป์ถ้วย'
              ? 'แชมป์ถ้วย'
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
  const curAvg = calcSeasonAvgRating({ ...player, ov: curOv }, curSp, curSg, curSa, curCs);

  const currentRow: PlayerSeasonHistoryRecord | null = !hasCurrentArchived
    ? {
        season: state.season,
        teamId: team?.id ?? -1,
        teamName: team?.name || (player.free ? 'ฟรีเอเยนต์' : 'ตลาดซื้อขาย'),
        tier: team?.tier ?? 0,
        ov: curOv,
        sp: curSp,
        sg: curSg,
        sa: curSa,
        cs: curCs,
        motm: curMotm,
        yc: curYc,
        rc: curRc,
        avgRating: curAvg
      }
    : null;

  const allRows = currentRow ? [currentRow, ...pastSeasons] : pastSeasons;
  const sumApps = allRows.reduce((s, r) => s + r.sp, 0);
  const sumGoals = allRows.reduce((s, r) => s + r.sg, 0);
  const sumAssists = allRows.reduce((s, r) => s + r.sa, 0);

  // Career profile can hold pre-history match tallies from earlier saves
  const totalApps = isMe && pProf ? Math.max(sumApps, pProf.ap || 0) : sumApps;
  const totalGoals = isMe && pProf ? Math.max(sumGoals, pProf.gl || 0) : sumGoals;
  const totalAssists = isMe && pProf ? Math.max(sumAssists, pProf.as || 0) : sumAssists;
  const totalCleanSheets = allRows.reduce((s, r) => s + r.cs, 0);
  const totalMotm = allRows.reduce((s, r) => s + r.motm, 0);
  const totalYellow = allRows.reduce((s, r) => s + r.yc, 0);
  const totalRed = allRows.reduce((s, r) => s + r.rc, 0);

  let weightedSum = 0;
  let weightedApps = 0;
  allRows.forEach((r) => {
    if (r.avgRating > 0 && r.sp > 0) {
      weightedSum += r.avgRating * r.sp;
      weightedApps += r.sp;
    }
  });
  const avgRating =
    weightedApps > 0
      ? Math.round((weightedSum / weightedApps) * 100) / 100
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
    totalSeasons: pastSeasons.length + (currentRow && (currentRow.sp > 0 || state.md > 0) ? 1 : 0),
    totalApps,
    totalGoals,
    totalAssists,
    totalCleanSheets,
    totalMotm,
    totalYellow,
    totalRed,
    avgRating,
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
        cupStatus: arc.cupStatus,
        asiaStatus: arc.asiaStatus,
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
  const legends = isUserClub
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
