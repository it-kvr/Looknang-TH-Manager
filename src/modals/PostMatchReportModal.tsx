import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type {
  ArchivedMatchReport,
  ArchivedStreamComment,
  GameState,
  MatchEnvironment,
  MatchTimelineItem,
  Player,
  Team,
  VarReplayRecord
} from '../types/game';
import { clamp } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import { getAiTeamStadiumStyleId, getTurfGradeForLevel, computeTurfMatchModifiers } from '../data/crestAndKitData';
import { matchKits, pickBestCaptain, pickGK, xi } from '../engine/playerCore';
import {
  EXTRA_CUP_META,
  computeMatchAttendance,
  computeMatchStreamProjection,
  computePlayerRatings,
  computeTeamFacilityMatchModifiers
} from '../engine/simulation';
import { generateLiveStreamComment, getMatchBroadcastChannel } from '../engine/liveStreamChat';
import {
  FullTimeMatchStage,
  MatchBroadcastHeader,
  buildMatchVisualIndex,
  type FullTimeAnalysisSummary,
  type MatchLogItem,
  type MatchStatsSummary,
  type ShootoutSummary
} from './MatchSharedComponents';

interface PostMatchReportModalProps {
  report: ArchivedMatchReport;
  title?: string;
  state: GameState;
  onClose: () => void;
  onOpenVarReplay: (homeId: number, awayId: number, records: VarReplayRecord[], activeId?: string) => void;
  onInspectTeam?: (teamId: number) => void;
  onInspectPlayer?: (player: Player, team: Team) => void;
}

export const PostMatchReportModal: React.FC<PostMatchReportModalProps> = ({
  report,
  title,
  state,
  onClose,
  onOpenVarReplay,
  onInspectTeam,
  onInspectPlayer
}) => {
  const [rightTab, setRightTab] = useState<'players' | 'stats' | 'chat'>('players');

  const hTeam = state.teams[report.h];
  const aTeam = state.teams[report.a];

  const matchKind = report.kind || 'league';
  const meTeamOrig = state.teams[state.me] || hTeam;
  const isPlayerMode = state.mode === 'p' && !!state.p;
  const myPlayerName = state.p?.name || '';
  const myPlayerSquadObj = isPlayerMode && meTeamOrig
    ? meTeamOrig.sq.find((q) => q.me || q.n === myPlayerName)
    : undefined;
  const isDerby = Boolean(
    hTeam &&
      aTeam &&
      state.derby &&
      (hTeam.id === state.me || aTeam.id === state.me)
  );
  const isNeutralVenue = matchKind === 'sc';

  const [homeKit, awayKit, homeTrim, awayTrim] = useMemo(() => {
    if (!hTeam || !aTeam) return ['#15803d', '#2563eb', '#facc15', '#ffffff'];
    return matchKits(hTeam, aTeam, state);
  }, [hTeam, aTeam, state]);

  const homeGkKit = useMemo(() => pickGK(homeKit, awayKit), [homeKit, awayKit]);
  const awayGkKit = useMemo(() => pickGK(awayKit, homeKit, homeGkKit), [awayKit, homeKit, homeGkKit]);

  const evs = useMemo(() => report.evs || [], [report.evs]);
  const cards = useMemo(() => report.cards || [], [report.cards]);
  const subs = useMemo(() => report.subs || [], [report.subs]);
  const varReplays = useMemo(() => report.varReplays || [], [report.varReplays]);

  const { initialHomeXi, initialAwayXi } = useMemo(() => {
    const resolveTeamXi = (team: Team | undefined): string[] => {
      if (!team) return [];
      const subInNames = new Set(subs.filter((sb) => sb.t === team.id).map((sb) => sb.inPlayer));
      const storedXi = report.xiNames?.[team.id];
      if (storedXi && storedXi.length) return storedXi.slice(0, 11);

      const storedPlayed = report.playedNames?.[team.id];
      if (storedPlayed && storedPlayed.length) {
        const filtered = storedPlayed.filter((n) => !subInNames.has(n));
        if (filtered.length >= 11) return filtered.slice(0, 11);
        const fallbackXi = xi(team).map((q) => q.n);
        const set = new Set(filtered);
        fallbackXi.forEach((n) => {
          if (set.size < 11 && !subInNames.has(n) && !set.has(n)) {
            set.add(n);
            filtered.push(n);
          }
        });
        return filtered.slice(0, 11);
      }
      return xi(team).map((q) => q.n);
    };
    return {
      initialHomeXi: resolveTeamXi(hTeam),
      initialAwayXi: resolveTeamXi(aTeam)
    };
  }, [hTeam, aTeam, report.xiNames, report.playedNames, subs]);

  const captains = useMemo(() => {
    if (report.captains) return report.captains;
    return {
      H: hTeam ? (hTeam.cap && initialHomeXi.includes(hTeam.cap) ? hTeam.cap : pickBestCaptain(hTeam, initialHomeXi, undefined, state.p) || initialHomeXi[0] || '') : '',
      A: aTeam ? (aTeam.cap && initialAwayXi.includes(aTeam.cap) ? aTeam.cap : pickBestCaptain(aTeam, initialAwayXi, undefined, state.p) || initialAwayXi[0] || '') : ''
    };
  }, [report.captains, hTeam, aTeam, initialHomeXi, initialAwayXi, state.p]);

  const liveHome = useMemo<Team | null>(() => {
    if (!hTeam) return null;
    return {
      ...hTeam,
      cap: captains.H || hTeam.cap,
      form: report.formations?.H || hTeam.form,
      lu: initialHomeXi
    };
  }, [hTeam, captains.H, report.formations?.H, initialHomeXi]);

  const liveAway = useMemo<Team | null>(() => {
    if (!aTeam) return null;
    return {
      ...aTeam,
      cap: captains.A || aTeam.cap,
      form: report.formations?.A || aTeam.form,
      lu: initialAwayXi
    };
  }, [aTeam, captains.A, report.formations?.A, initialAwayXi]);

  const matchVisualIndex = useMemo(() => {
    if (!hTeam || !aTeam) {
      return { teamsSorted: [], entries: [], byFullLen: [], byShortLen: [] };
    }
    return buildMatchVisualIndex(hTeam, aTeam);
  }, [hTeam, aTeam]);

  const matchEnv = useMemo<MatchEnvironment>(() => {
    if (report.matchEnv) return report.matchEnv;
    const hId = hTeam?.id ?? report.h;
    const aId = aTeam?.id ?? report.a;
    const hTier = hTeam?.tier ?? 0;
    const seed = Math.abs((hId + 1) * 97 + (aId + 1) * 31 + report.gh * 7 + report.ga * 13);
    const turfLv = matchKind === 'asia' || matchKind === 'sc' ? (hTier >= 2 ? 9 : 8) : hTier === 2 ? 8 : hTier === 1 ? 5 : 2;
    const turfCond = clamp(72 + (seed % 26), 55, 98);
    const turfSpec = getTurfGradeForLevel(turfLv, turfCond);
    return {
      season: seed % 3 === 0 ? 'rainy' : 'summer',
      timeOfDay: seed % 2 === 0 ? 'night' : 'day',
      puddles: [],
      sunAngle: 0.35,
      turfGrade: turfSpec.id,
      turfCond,
      grassLength: turfLv >= 6 ? 'short' : 'medium',
      dirtMix: turfLv <= 2 ? 0.2 : 0,
      pitchSeed: seed,
      stadiumStyle:
        matchKind === 'sc'
          ? 'modern_bowl'
          : hId === state.me && state.mode === 'm'
            ? state.club?.stadiumStyle || 'open_track'
            : getAiTeamStadiumStyleId(hId, hTeam?.name, hTier)
    };
  }, [report.matchEnv, report.h, report.a, report.gh, report.ga, hTeam, aTeam, matchKind, state.me, state.mode, state.club?.stadiumStyle]);

  const turfMatchMods = useMemo(() => computeTurfMatchModifiers(matchEnv), [matchEnv]);

  const matchAttendance = useMemo(() => {
    if (report.att && report.att > 0) {
      const fallbackCap = hTeam ? computeMatchAttendance(hTeam, aTeam || hTeam, state, { kind: matchKind, derby: isDerby }).cap : report.att;
      const cap = Math.max(report.att, report.cap || fallbackCap);
      return {
        att: report.att,
        cap,
        pct: clamp(Math.round((report.att / Math.max(1, cap)) * 100), 1, 100)
      };
    }
    if (!hTeam || !aTeam) return { att: 1200, cap: 3000, pct: 40 };
    return computeMatchAttendance(hTeam, aTeam, state, { kind: matchKind, derby: isDerby });
  }, [report.att, report.cap, hTeam, aTeam, state, matchKind, isDerby]);

  const homeFacMods = useMemo(() => {
    if (!hTeam) return { atkDelta: 0, defDelta: 0, fitDelta: 0, injMod: 1, breakdown: [], statDeltas: {} } as unknown as ReturnType<typeof computeTeamFacilityMatchModifiers>;
    return computeTeamFacilityMatchModifiers(hTeam, state, {
      isHome: !isNeutralVenue,
      isNeutral: isNeutralVenue,
      attendancePct: matchAttendance.pct,
      turfCondOverride: matchEnv.turfCond
    });
  }, [hTeam, state, isNeutralVenue, matchAttendance.pct, matchEnv.turfCond]);

  const awayFacMods = useMemo(() => {
    if (!aTeam) return { atkDelta: 0, defDelta: 0, fitDelta: 0, injMod: 1, breakdown: [], statDeltas: {} } as unknown as ReturnType<typeof computeTeamFacilityMatchModifiers>;
    return computeTeamFacilityMatchModifiers(aTeam, state, {
      isHome: false,
      isNeutral: isNeutralVenue,
      attendancePct: matchAttendance.pct
    });
  }, [aTeam, state, isNeutralVenue, matchAttendance.pct]);

  const streamProj = useMemo(() => {
    if (!hTeam || !aTeam) {
      return computeMatchStreamProjection(meTeamOrig, meTeamOrig, state, { kind: matchKind, derby: isDerby });
    }
    return computeMatchStreamProjection(hTeam, aTeam, state, { kind: matchKind, derby: isDerby });
  }, [hTeam, aTeam, meTeamOrig, state, matchKind, isDerby]);

  const broadcastChannel = useMemo(
    () =>
      getMatchBroadcastChannel({
        tier: hTeam?.tier ?? 0,
        kind: matchKind,
        planId: streamProj.plan.id,
        homeId: hTeam?.id ?? report.h,
        season: state.season
      }),
    [hTeam?.tier, hTeam?.id, report.h, matchKind, streamProj.plan.id, state.season]
  );

  const liveViewers = report.streamViewers ?? streamProj.baseViewers;
  const peakViewers = report.streamPeakViewers ?? Math.max(liveViewers, streamProj.peakViewers);

  const matchStats = useMemo<MatchStatsSummary>(() => {
    const xgH = Number((report.xgH ?? Math.max(0.25, report.gh * 0.78 + 0.42)).toFixed(2));
    const xgA = Number((report.xgA ?? Math.max(0.25, report.ga * 0.78 + 0.38)).toFixed(2));
    const possH = clamp(report.possH ?? Math.round(50 + clamp((xgH - xgA) * 7, -14, 14)), 30, 70);
    const shotsH = report.shotsH ?? Math.max(report.gh + 1, Math.round(xgH * 5.6 + 2));
    const shotsA = report.shotsA ?? Math.max(report.ga + 1, Math.round(xgA * 5.6 + 2));
    const onTargetH = report.onTargetH ?? clamp(Math.max(report.gh, Math.round(shotsH * 0.45)), report.gh, shotsH);
    const onTargetA = report.onTargetA ?? clamp(Math.max(report.ga, Math.round(shotsA * 0.45)), report.ga, shotsA);
    const passesH = report.passesH ?? Math.round(possH * 6.8);
    const passesA = report.passesA ?? Math.round((100 - possH) * 6.8);
    const seed = Math.abs((report.h + 1) * 19 + (report.a + 1) * 11 + report.gh * 5 + report.ga * 7);
    const cornersH = report.cornersH ?? Math.max(1, Math.round(shotsH * 0.44 + (seed % 3)));
    const cornersA = report.cornersA ?? Math.max(1, Math.round(shotsA * 0.44 + ((seed + 1) % 3)));
    const cardsHCount = hTeam ? cards.filter((c) => c.t === hTeam.id).length : 0;
    const cardsACount = aTeam ? cards.filter((c) => c.t === aTeam.id).length : 0;
    const foulsH = report.foulsH ?? Math.max(cardsHCount * 2, 6 + (seed % 7));
    const foulsA = report.foulsA ?? Math.max(cardsACount * 2, 6 + ((seed + 3) % 7));
    const offsidesH = report.offsidesH ?? (seed % 4);
    const offsidesA = report.offsidesA ?? ((seed + 2) % 4);
    return {
      possH,
      shotsH,
      shotsA,
      onTargetH,
      onTargetA,
      xgH,
      xgA,
      passesH,
      passesA,
      cornersH,
      cornersA,
      foulsH,
      foulsA,
      offsidesH,
      offsidesA
    };
  }, [report, hTeam, aTeam, cards]);

  const fullTimeAnalysis = useMemo<FullTimeAnalysisSummary>(() => {
    const playedNames: Record<number, string[]> = { ...(report.playedNames || {}) };
    if (hTeam && (!playedNames[hTeam.id] || !playedNames[hTeam.id].length)) {
      const set = new Set<string>(initialHomeXi);
      subs.filter((s) => s.t === hTeam.id).forEach((s) => {
        if (s.inPlayer) set.add(s.inPlayer);
      });
      playedNames[hTeam.id] = Array.from(set);
    }
    if (aTeam && (!playedNames[aTeam.id] || !playedNames[aTeam.id].length)) {
      const set = new Set<string>(initialAwayXi);
      subs.filter((s) => s.t === aTeam.id).forEach((s) => {
        if (s.inPlayer) set.add(s.inPlayer);
      });
      playedNames[aTeam.id] = Array.from(set);
    }

    let ratings = report.ratings && Object.keys(report.ratings).length > 0 ? { ...report.ratings } : {};
    let motm = report.motm;

    if (hTeam && aTeam && Object.keys(ratings).length === 0) {
      const comp = computePlayerRatings(
        hTeam,
        aTeam,
        {
          gh: report.gh,
          ga: report.ga,
          evs,
          xgH: matchStats.xgH,
          xgA: matchStats.xgA,
          cards,
          subs,
          playedNames
        },
        state.p
      );
      ratings = comp.ratings;
      motm = motm || comp.motm;
    } else if (!motm && Object.keys(ratings).length > 0) {
      let bestN = '';
      let bestV = -1;
      Object.entries(ratings).forEach(([n, v]) => {
        if (v > bestV) {
          bestV = v;
          bestN = n;
        }
      });
      motm = bestN || undefined;
    }

    return {
      xgH: matchStats.xgH,
      xgA: matchStats.xgA,
      ratings,
      motm,
      pf: report.pf,
      playedNames,
      cards,
      subs
    };
  }, [report, hTeam, aTeam, initialHomeXi, initialAwayXi, evs, cards, subs, matchStats.xgH, matchStats.xgA, state.p]);

  const playerSavesMap = useMemo<Record<string, number>>(() => {
    if (report.playerSaves && Object.keys(report.playerSaves).length > 0) {
      return report.playerSaves;
    }
    const map: Record<string, number> = {};
    const hSaves = Math.max(0, report.savesH ?? (matchStats.onTargetA - report.ga));
    const aSaves = Math.max(0, report.savesA ?? (matchStats.onTargetH - report.gh));
    if (hTeam && hSaves > 0) {
      const hGk =
        initialHomeXi.find((n) => hTeam.sq.find((q) => q.n === n)?.pos === 'GK') ||
        initialHomeXi[0];
      if (hGk) map[hGk] = hSaves;
    }
    if (aTeam && aSaves > 0) {
      const aGk =
        initialAwayXi.find((n) => aTeam.sq.find((q) => q.n === n)?.pos === 'GK') ||
        initialAwayXi[0];
      if (aGk) map[aGk] = aSaves;
    }
    return map;
  }, [report.playerSaves, report.savesH, report.savesA, report.ga, report.gh, matchStats.onTargetH, matchStats.onTargetA, hTeam, aTeam, initialHomeXi, initialAwayXi]);

  const injuredNames = useMemo(
    () => (report.injuries || []).map((x) => x.name),
    [report.injuries]
  );

  const shootoutUi = useMemo<ShootoutSummary | null>(() => {
    if (report.shootout) {
      return {
        hKicks: report.shootout.hKicks,
        aKicks: report.shootout.aKicks,
        hScore: report.shootout.hScore,
        aScore: report.shootout.aScore,
        round: Math.max(report.shootout.hKicks.length, report.shootout.aKicks.length),
        lastMsg: report.penText,
        finished: true
      };
    }
    return null;
  }, [report.shootout, report.penText]);

  const resolvedLogs = useMemo<MatchLogItem[]>(() => {
    if (!hTeam || !aTeam) return [];
    if (report.logs && report.logs.length > 0) {
      return report.logs;
    }

    const items: MatchLogItem[] = [];
    const matchedVarIds = new Set<string>();

    items.push({
      id: 'rep-ft',
      m: 90,
      text: report.penText
        ? `🏁 จบเกม! ${hTeam.name} ${report.gh}-${report.ga} ${aTeam.name} (${report.penText})`
        : `🏁 จบเกม! ${hTeam.name} ${report.gh}-${report.ga} ${aTeam.name}`,
      tone: 'sys'
    });

    evs.forEach((ev, idx) => {
      const scTeam = ev.t === hTeam.id ? hTeam.name : aTeam.name;
      const linkedVar = varReplays.find(
        (v) =>
          !matchedVarIds.has(v.id) &&
          Math.abs(v.minute - ev.m) <= 1 &&
          v.verdictTone === 'goal' &&
          (!v.varState.shooterId || v.varState.shooterId === ev.who)
      );
      if (linkedVar) matchedVarIds.add(linkedVar.id);
      const txt = ev.og
        ? `🤦 นาที ${ev.m}': ${ev.who} สกัดเข้าประตูตัวเอง (${scTeam} ได้ประตู)`
        : ev.as
          ? `⚽ นาที ${ev.m}': โกล!! ${ev.who} (${scTeam}) ซัดประตู (👟 ${ev.as})`
          : `⚽ นาที ${ev.m}': โกล!! ${ev.who} (${scTeam}) ยิงประตู!`;
      items.push({
        id: `rep-g-${idx}-${ev.m}`,
        m: ev.m,
        text: txt,
        tone: 'goal',
        ...(linkedVar ? { varReplayId: linkedVar.id } : {})
      });
    });

    cards.forEach((c, idx) => {
      const tmName = c.t === hTeam.id ? hTeam.name : aTeam.name;
      const linkedVar = varReplays.find(
        (v) =>
          !matchedVarIds.has(v.id) &&
          Math.abs(v.minute - c.m) <= 1 &&
          (v.verdictTone === 'red' || v.verdictTone === 'yellow' || v.verdictTone === 'penalty')
      );
      if (linkedVar) matchedVarIds.add(linkedVar.id);
      const cardLbl = c.type === 'Y' ? '🟨 ใบเหลือง' : c.type === 'Y2R' ? '🟨➡🟥 เหลืองแดง' : '🟥 ใบแดง';
      items.push({
        id: `rep-c-${idx}-${c.m}`,
        m: c.m,
        text: `${cardLbl} นาที ${c.m}': ${c.who} (${tmName})${c.reason ? ` — ${c.reason}` : ''}`,
        tone: 'card',
        ...(linkedVar ? { varReplayId: linkedVar.id } : {})
      });
    });

    varReplays.forEach((vr, idx) => {
      if (matchedVarIds.has(vr.id)) return;
      items.push({
        id: `rep-v-${idx}-${vr.id}`,
        m: vr.minute,
        text: `🖥 ${vr.verdictLabel} — ${vr.varState.reasonText}`,
        tone: vr.verdictTone === 'goal' ? 'goal' : 'card',
        varReplayId: vr.id
      });
    });

    subs.forEach((sb, idx) => {
      const tmName = sb.t === hTeam.id ? hTeam.name : aTeam.name;
      items.push({
        id: `rep-s-${idx}-${sb.m}`,
        m: sb.m,
        text: `🔄 นาที ${sb.m}' เปลี่ยนตัว (${tmName}): 🔼 เข้า ${sb.inPlayer} · 🔽 ออก ${sb.outPlayer}`,
        tone: 'sub',
        subInfo: {
          teamId: sb.t,
          inName: sb.inPlayer,
          outName: sb.outPlayer
        }
      });
    });

    items.push({
      id: 'rep-ko',
      m: 0,
      text: `📣 กรรมการเป่านกหวีดเริ่มเกม! ${hTeam.name} พบ ${aTeam.name}`,
      tone: 'sys'
    });

    return items.sort((u, v) => v.m - u.m);
  }, [hTeam, aTeam, report.logs, report.penText, report.gh, report.ga, evs, cards, subs, varReplays]);

  const timelineEvents = useMemo<MatchTimelineItem[]>(() => {
    if (report.timeline && report.timeline.length > 0) return report.timeline;
    if (!hTeam || !aTeam) return [];
    let seq = 1;
    const list: MatchTimelineItem[] = [
      { id: 'tl-ko', seq: seq++, m: 0, side: 'N', kind: 'kickoff', who: 'เริ่มเกม', detail: 'เขี่ยบอลครึ่งแรก' },
      { id: 'tl-ht', seq: seq++, m: 45, side: 'N', kind: 'first_half', who: 'พักครึ่ง', detail: 'จบ 45 นาทีแรก' }
    ];

    evs.forEach((ev, idx) => {
      const isPen = !ev.og && (ev.style === 'penalty' || ev.style === 'panenka');
      list.push({
        id: `tl-g-${idx}`,
        seq: seq++,
        m: ev.m,
        side: ev.t === hTeam.id ? 'H' : 'A',
        kind: ev.og ? 'own_goal' : isPen ? 'pen_goal' : 'goal',
        who: ev.who,
        detail: ev.og ? 'เข้าประตูตัวเอง' : ev.as ? `👟 ${ev.as.split(' ')[0]}` : undefined
      });
    });

    cards.forEach((c, idx) => {
      list.push({
        id: `tl-c-${idx}`,
        seq: seq++,
        m: c.m,
        side: c.t === hTeam.id ? 'H' : 'A',
        kind: c.type === 'Y' ? 'yellow' : 'red',
        who: c.who,
        detail: c.reason
      });
    });

    subs.forEach((sb, idx) => {
      list.push({
        id: `tl-s-${idx}`,
        seq: seq++,
        m: sb.m,
        side: sb.t === hTeam.id ? 'H' : 'A',
        kind: 'sub',
        who: sb.inPlayer,
        detail: sb.outPlayer
      });
    });

    varReplays
      .filter((vr) => vr.verdictTone === 'no_goal')
      .forEach((vr, idx) => {
        list.push({
          id: `tl-var-${idx}`,
          seq: seq++,
          m: vr.minute,
          side: vr.side,
          kind: 'var_no_goal',
          who: vr.varState.shooterId || vr.varState.shooterShort || 'VAR',
          detail: vr.verdictLabel
        });
      });

    list.push({
      id: 'tl-ft',
      seq: seq++,
      m: 90,
      side: 'N',
      kind: 'full_time',
      who: 'จบเกม',
      detail: report.penText ? `${report.gh}-${report.ga} (${report.penText})` : `${report.gh}-${report.ga}`
    });

    return list;
  }, [report.timeline, report.gh, report.ga, report.penText, hTeam, aTeam, evs, cards, subs, varReplays]);

  const liveComments = useMemo<ArchivedStreamComment[]>(() => {
    if (report.streamComments && report.streamComments.length > 0) {
      return report.streamComments;
    }
    if (!hTeam || !aTeam) return [];
    const oppOrig = meTeamOrig.id === hTeam.id ? aTeam : hTeam;
    const usedTexts = new Set<string>();
    const out: ArchivedStreamComment[] = [];

    const pushSample = (m: number, kind: Parameters<typeof generateLiveStreamComment>[0]['kind'], actor?: string, assist?: string) => {
      const item = generateLiveStreamComment({
        m,
        viewers: liveViewers,
        kind,
        homeName: hTeam.name,
        awayName: aTeam.name,
        myTeamName: meTeamOrig.name,
        oppTeamName: oppOrig.name,
        channelName: broadcastChannel.name,
        actor,
        assist,
        gh: report.gh,
        ga: report.ga,
        usedTexts
      });
      if (item) {
        out.push({
          id: `rep-sc-${out.length}-${m}`,
          m: item.m,
          user: item.user,
          text: item.text,
          kind: item.kind,
          ...(item.donateBaht ? { donateBaht: item.donateBaht } : {})
        });
      }
    };

    pushSample(90, 'fulltime');
    evs
      .slice()
      .sort((a, b) => b.m - a.m)
      .slice(0, 5)
      .forEach((ev) => {
        pushSample(ev.m, ev.t === meTeamOrig.id || meTeamOrig.id !== hTeam.id && meTeamOrig.id !== aTeam.id ? 'goal' : 'concede', ev.who, ev.as);
      });
    cards.slice(0, 2).forEach((c) => pushSample(c.m, 'card', c.who));
    subs.slice(0, 2).forEach((sb) => pushSample(sb.m, 'sub', sb.inPlayer));
    pushSample(45, 'halftime');
    pushSample(15, 'ambient');
    pushSample(0, 'ambient');

    return out.sort((u, v) => v.m - u.m);
  }, [report.streamComments, report.gh, report.ga, hTeam, aTeam, meTeamOrig, liveViewers, broadcastChannel.name, evs, cards, subs]);

  if (!hTeam || !aTeam || !liveHome || !liveAway) return null;

  const compTitle =
    title ||
    (matchKind === 'asia'
      ? `🌏 บอลถ้วยทวีป · ${report.roundLabel || 'รอบน็อกเอาต์'}`
      : matchKind === 'sc' || matchKind === 'lc' || matchKind === 'dc'
        ? `${EXTRA_CUP_META[matchKind].icon} ${EXTRA_CUP_META[matchKind].name}${report.roundLabel ? ` · ${report.roundLabel}` : ''}`
        : matchKind === 'cup'
          ? `🏆 ถ้วยประชาชน${report.roundLabel ? ` · ${report.roundLabel}` : ''}`
          : '📊 สรุปผลการแข่งขัน');

  const compShortTitle =
    title
      ? title
      : matchKind === 'asia'
        ? `🌏 ทวีป${report.roundLabel ? ` · ${report.roundLabel}` : ''}`
        : matchKind === 'sc' || matchKind === 'lc' || matchKind === 'dc'
          ? `${EXTRA_CUP_META[matchKind].icon} ${EXTRA_CUP_META[matchKind].short}`
          : matchKind === 'cup'
            ? `🏆 ถ้วย${report.roundLabel ? ` · ${report.roundLabel}` : ''}`
            : '📊 หลังเกม';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/88 flex items-center justify-center p-1.5 sm:p-2.5 mland:p-1 safe-all overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="รายงานหลังเกม"
    >
      <div className="w-full max-w-6xl mland:max-w-[98vw] h-[calc(var(--app-dvh,1dvh)*96)] max-h-[calc(var(--app-dvh,1dvh)*96)] mland:h-[calc(var(--app-dvh,1dvh)*97)] mland:max-h-[calc(var(--app-dvh,1dvh)*97)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <MatchBroadcastHeader
          compTitle={compTitle}
          compShortTitle={compShortTitle}
          matchEnv={matchEnv}
          turfMatchMods={turfMatchMods}
          isNeutralVenue={isNeutralVenue}
          homeFacMods={homeFacMods}
          awayFacMods={awayFacMods}
          matchAttendance={matchAttendance}
          broadcastChannel={broadcastChannel}
          streamPlanId={streamProj.plan.id}
          liveViewers={liveViewers}
          peakViewers={peakViewers}
          homeOrig={hTeam}
          awayOrig={aTeam}
          state={state}
          gh={report.gh}
          ga={report.ga}
          done={true}
          clockLabel="FT"
          penText={report.penText}
          onInspectTeam={onInspectTeam}
          rightControls={
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              aria-label="ปิดหน้าต่าง"
              title="ปิดหน้าต่าง"
              className="btn h-10 sm:h-11 md:h-12 mland:h-[38px] px-3 sm:px-4 mland:px-3 rounded-xl mland:rounded-lg text-xs sm:text-[13px] mland:text-[11px] bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--ink)]/40 text-[var(--ink)] shadow-2xs shrink-0"
            >
              <X className="w-4 h-4 mland:w-3.5 mland:h-3.5 shrink-0" />
              <span className="hidden sm:inline mland:inline">ปิด</span>
            </button>
          }
        />

        <div className="flex-1 min-h-0 overflow-hidden p-2.5 mland:p-1.5 flex flex-col">
          <FullTimeMatchStage
            state={state}
            homeOrig={hTeam}
            awayOrig={aTeam}
            liveHome={liveHome}
            liveAway={liveAway}
            meTeamOrig={meTeamOrig}
            homeKit={homeKit}
            awayKit={awayKit}
            homeGkKit={homeGkKit}
            awayGkKit={awayGkKit}
            homeTrim={homeTrim}
            awayTrim={awayTrim}
            initialHomeXi={initialHomeXi}
            initialAwayXi={initialAwayXi}
            playedSlots={report.playedSlots}
            captains={captains}
            gh={report.gh}
            ga={report.ga}
            evs={evs}
            matchCards={cards}
            subLog={subs}
            matchStats={matchStats}
            fullTimeAnalysis={fullTimeAnalysis}
            playerSavesMap={playerSavesMap}
            injuredNames={injuredNames}
            shootoutUi={shootoutUi}
            logs={resolvedLogs}
            timelineEvents={timelineEvents}
            matchVisualIndex={matchVisualIndex}
            liveViewers={liveViewers}
            peakViewers={peakViewers}
            liveComments={liveComments}
            broadcastChannel={broadcastChannel}
            streamProj={streamProj}
            isDerby={isDerby}
            isPlayerMode={isPlayerMode}
            myPlayerName={myPlayerName}
            myPlayerSquadObj={myPlayerSquadObj}
            rightTab={rightTab}
            onChangeRightTab={setRightTab}
            onOpenVarReplay={(varId) => {
              if (!varReplays.length) return;
              SFX.tap();
              onOpenVarReplay(hTeam.id, aTeam.id, varReplays, varId);
            }}
            onInspectPlayer={onInspectPlayer}
          />
        </div>
      </div>
    </div>
  );
};
