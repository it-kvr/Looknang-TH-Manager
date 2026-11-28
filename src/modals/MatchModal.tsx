import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SubRole, Mentality, Player, Team, MatchEvent, MatchCardEvent, MatchSubEvent, PlayerPerfResult, MatchResult, GameState, FinishedMatchPayload, ArchivedMatchLog, PersonalMissionMetric, BallFlightType, GoalCelebrationStyle, LivePitchAgent, LiveBallState, LivePitchFx, ShootoutState, LiveMatchWorld, LiveBenchSeat, LiveSidelineCoach, MatchEnvironment, CoachOutfitId, VarReviewState, TimelineKind, MatchTimelineItem, ArchivedStreamComment, MatchHighlightClip, MatchHighlightKind } from '../types/game';
import { R, P, clamp } from '../utils/math';
import { RN, AR_T, TRAIT_BY_ID, COACH_OUTFITS, CLUB_PHILOSOPHIES, FSD, LINE, baseRoleOf } from '../data/thaiFootballData';
import { getTeamLeagueName } from '../data/leagueStructures';
import { getTurfGradeSpec, computeTurfMatchModifiers } from '../data/crestAndKitData';
import { getSettings, saveSettings, getDefaultMatchSpeed, SFX, setCrowdAudio, setSfxSuppressed, vibrate, triggerConfetti, unlockAudio } from '../utils/audioTheme';
import { useScrollTopOnChange } from '../utils/scrollReset';

type HalftimeTalkTone = 'attack' | 'press' | 'balanced' | 'counter' | 'defend' | 'fit' | 'follow_coach' | 'ask_attack' | 'ask_defend';

import { getShirtNo, visOf, xi, DT, injD, matchKits, teamKits, pickGK, getDefaultCoachVis, getFormationSlots, playerPen, pickBestCaptain, scoreSetPieceCandidate } from '../engine/playerCore';
import { rate, computePlayerRatings, calcPlayerPerf, computeMatchAttendance, computeMatchStreamProjection, fmtFansShort, EXTRA_CUP_META, computeTeamFacilityMatchModifiers, combineMatchStatDeltas } from '../engine/simulation';
import { getModRealismSettings } from '../engine/mods';
import { buildMatchEnvironment } from '../engine/matchEnv';
import { generateLiveStreamComment, getMatchBroadcastChannel, getStreamViewerTier, type LiveCommentItem, type LiveCommentKind } from '../engine/liveStreamChat';
import { getPlayerTalent } from '../engine/missions';
import { ClubCrest } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { PositionBadge } from '../components/PositionBadge';
import { buildAgentsForTeam, drawLivePitchToCanvas } from './MatchPitchCanvas';
import {
  buildHighlightEditorial,
  captureWorldSample,
  curateMatchHighlights,
  detectGoalHighlightKind,
  finalizeHighlightClipFromSamples,
  simulateRealtimeHighlightClip,
  type FinalizeClipParams,
  type RollingHighlightSample
} from '../engine/matchHighlights';
import { LiveTacticsStudio, type LivePlayerMatchStats } from './LiveTacticsStudio';
import { VarReplayModal, type VarReplayRecord } from './VarReplayModal';
import { MatchHighlightModal } from './MatchHighlightModal';
import {
  buildMatchVisualIndex,
  FullTimeMatchStage,
  LiveStreamBadge,
  LiveStreamChatPanel,
  MatchBroadcastHeader,
  MatchEventsFeedPanel,
  MatchHalftimePitchPanel,
  MatchHeaderControls,
  MatchPitchOverlays,
  MatchPlayerCoachPanel,
  MatchPlayerThumb,
  MatchShootoutBanner,
  MatchStatsPanel,
  MatchTimelinePanel,
  type MatchLogItem,
  type MatchSubLogInfo
} from './MatchSharedComponents';



export const MatchModal = React.memo<{
  state: GameState;
  kind: 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc' | 'nt' | 'po';
  homeId: number;
  awayId: number;
  isDerby: boolean;
  allowDraw?: boolean;
  compTitleOverride?: string;
  initialMatchEnv?: MatchEnvironment;
  allowSkip?: boolean;
  onFinish: (payload: FinishedMatchPayload) => void;
}>(({ state, kind, homeId, awayId, isDerby, allowDraw = false, compTitleOverride, initialMatchEnv, allowSkip = false, onFinish }) => {
  const settings = useMemo(() => getSettings(), []);
  const homeOrig = state.teams[homeId];
  const awayOrig = state.teams[awayId];
  const meIsHome = homeId === state.me;
  const [homeKit, awayKit, homeTrim, awayTrim] = useMemo(() => matchKits(homeOrig, awayOrig, state), [homeOrig, awayOrig, state]);
  const homeGkKit = useMemo(() => pickGK(homeKit, awayKit), [homeKit, awayKit]);
  const awayGkKit = useMemo(() => pickGK(awayKit, homeKit, homeGkKit), [awayKit, homeKit, homeGkKit]);

  const meTeamOrig = meIsHome ? homeOrig : awayOrig;
  const oppTeamOrig = meIsHome ? awayOrig : homeOrig;
  const isPlayerMode = state.mode === 'p' && !!state.p;
  const myPlayerName = state.p?.name || '';
  const myPlayerSquadObj = isPlayerMode ? meTeamOrig.sq.find((q) => q.me || q.n === myPlayerName) : undefined;
  const myInitialBanned = isPlayerMode && ((myPlayerSquadObj?.sus || state.p?.sus || 0) > 0);

  const matchEnv = useMemo<MatchEnvironment>(
    () => initialMatchEnv ?? buildMatchEnvironment(homeOrig, kind, meIsHome, state),
    [initialMatchEnv, homeOrig, kind, meIsHome, state]
  );
  const turfSpec = useMemo(() => getTurfGradeSpec(matchEnv.turfGrade), [matchEnv.turfGrade]);
  const turfMatchMods = useMemo(() => computeTurfMatchModifiers(matchEnv), [matchEnv]);

  const initialHomeXi = useMemo(() => xi(homeOrig).map((q) => q.n), [homeOrig]);
  const initialAwayXi = useMemo(() => xi(awayOrig).map((q) => q.n), [awayOrig]);
  const initialHomeCap = useMemo(
    () =>
      homeOrig.cap && initialHomeXi.includes(homeOrig.cap)
        ? homeOrig.cap
        : pickBestCaptain(homeOrig, initialHomeXi, undefined, state.p) || initialHomeXi[0] || '',
    [homeOrig, initialHomeXi, state.p]
  );
  const initialAwayCap = useMemo(
    () =>
      awayOrig.cap && initialAwayXi.includes(awayOrig.cap)
        ? awayOrig.cap
        : pickBestCaptain(awayOrig, initialAwayXi, undefined, state.p) || initialAwayXi[0] || '',
    [awayOrig, initialAwayXi, state.p]
  );
  const initialMeXi = meIsHome ? initialHomeXi : initialAwayXi;
  const myInitialStarted = isPlayerMode && !myInitialBanned && initialMeXi.includes(myPlayerName);

  const matchVisualIndex = useMemo(() => buildMatchVisualIndex(homeOrig, awayOrig), [homeOrig, awayOrig]);

  const matchAttendance = useMemo(
    () => computeMatchAttendance(homeOrig, awayOrig, state, { kind, derby: isDerby }),
    [homeOrig, awayOrig, state, kind, isDerby]
  );

  const isNeutralVenue = kind === 'sc';
  const homeFacMods = useMemo(
    () =>
      computeTeamFacilityMatchModifiers(homeOrig, state, {
        isHome: !isNeutralVenue,
        isNeutral: isNeutralVenue,
        attendancePct: matchAttendance.pct,
        turfCondOverride: matchEnv.turfCond
      }),
    [homeOrig, state, isNeutralVenue, matchAttendance.pct, matchEnv.turfCond]
  );
  const awayFacMods = useMemo(
    () =>
      computeTeamFacilityMatchModifiers(awayOrig, state, {
        isHome: false,
        isNeutral: isNeutralVenue,
        attendancePct: matchAttendance.pct
      }),
    [awayOrig, state, isNeutralVenue, matchAttendance.pct]
  );
  const homeStatDeltas = useMemo(
    () => combineMatchStatDeltas(turfMatchMods.statDeltas, homeFacMods.statDeltas),
    [turfMatchMods.statDeltas, homeFacMods.statDeltas]
  );
  const awayStatDeltas = useMemo(
    () => combineMatchStatDeltas(turfMatchMods.statDeltas, awayFacMods.statDeltas),
    [turfMatchMods.statDeltas, awayFacMods.statDeltas]
  );
  const getSideFacMods = (side: 'H' | 'A') => (side === 'H' ? homeFacMods : awayFacMods);

  const [minute, setMinute] = useState(0);
  const [clockLabel, setClockLabel] = useState("0'");
  const [stoppageBadge, setStoppageBadge] = useState<number>(0);
  const [matchPhaseUi, setMatchPhaseUi] = useState<LiveMatchWorld['phase']>('play1');
  const [isSecondHalfUi, setIsSecondHalfUi] = useState(false);
  const [selectedHalftimeTalk, setSelectedHalftimeTalk] = useState<HalftimeTalkTone>(() =>
    state.mode === 'p' ? 'follow_coach' : 'balanced'
  );
  const [shootoutUi, setShootoutUi] = useState<ShootoutState | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<0.25 | 0.5 | 1 | 2 | 5>(() => getDefaultMatchSpeed(settings));
  const [cineSlowMo, setCineSlowMo] = useState(true);
  const [showRunVectors, setShowRunVectors] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  const [showRatings, setShowRatings] = useState(true);
  const [htStatMode, setHtStatMode] = useState<'rating' | 'ovr'>('rating');
  const [injuryAlert, setInjuryAlert] = useState<{ name: string; role: SubRole; no: number; games: number; minute: number } | null>(null);
  const [miracleBannerUi, setMiracleBannerUi] = useState<{ side: 'H' | 'A'; teamName: string; minsLeft: number; goalsDuring: number; maxDeficit: number } | null>(null);
  const [blessedListUi, setBlessedListUi] = useState<{ id: string; shortName: string; no: number; side: 'H' | 'A'; tag: string; minsLeft: number }[]>([]);
  const [gh, setGh] = useState(0);
  const [ga, setGa] = useState(0);
  const [goalFlashInfo, setGoalFlashInfo] = useState<{
    side: 'H' | 'A';
    scorer: string;
    assister?: string;
    minute: number;
    isOwnGoal: boolean;
    isMyGoal: boolean;
    isMeScorer: boolean;
    kit: string;
    teamName: string;
  } | null>(null);
  const goalFlashTimerRef = useRef<number | null>(null);
  const [subFlashInfo, setSubFlashInfo] = useState<{
    side: 'H' | 'A';
    teamName: string;
    inName: string;
    outName: string;
    minute: number;
    key: number;
  } | null>(null);
  const subFlashTimerRef = useRef<number | null>(null);
  const lastCoachSfxTsRef = useRef<number>(0);
  const lastBannerSigRef = useRef<string>('');
  const lastRawBannerKeyRef = useRef<string>('');
  const isSkippingRef = useRef(false);
  const skipLogsRef = useRef<MatchLogItem[] | null>(null);
  const skipCommentsRef = useRef<LiveCommentItem[] | null>(null);
  const skipRateCacheRef = useRef<Map<string, ReturnType<typeof rate>>>(new Map());
  const baseTeamRates = useMemo(() => ({ home: rate(homeOrig, state), away: rate(awayOrig, state) }), [homeOrig, awayOrig, state]);
  const playerByNameMap = useMemo(() => {
    const m = new Map<string, Player>();
    for (const q of homeOrig.sq) m.set(q.n, q);
    for (const q of awayOrig.sq) m.set(q.n, q);
    return m;
  }, [homeOrig.sq, awayOrig.sq]);
  useEffect(() => () => {
    if (goalFlashTimerRef.current) window.clearTimeout(goalFlashTimerRef.current);
    if (subFlashTimerRef.current) window.clearTimeout(subFlashTimerRef.current);
  }, []);
  const [evs, setEvs] = useState<MatchEvent[]>([]);
  const [actionBanner, setActionBanner] = useState<{
    label: string;
    tone: LiveMatchWorld['phaseTone'];
    actors: { id: string; shortName: string; side: 'H' | 'A' }[];
    teamSide?: 'H' | 'A';
  }>({
    label: '⚽ เขี่ยบอลเริ่มเกม',
    tone: 'normal',
    actors: [],
    teamSide: 'H'
  });
  const pitchOverlayBoxRef = useRef<HTMLDivElement | null>(null);
  const logSeqRef = useRef<number>(10);
  const [logs, setLogs] = useState<MatchLogItem[]>(() => {
    const envDesc =
      matchEnv.season === 'rainy'
        ? matchEnv.timeOfDay === 'night'
          ? '🌙💧 หน้าฝน · เตะกลางคืน'
          : '🌦️ หน้าฝน · กลางวัน'
        : matchEnv.timeOfDay === 'night'
          ? '🌙 หน้าร้อน · เตะกลางคืน'
          : '☀️ หน้าร้อน · แดดออก';
    const base: MatchLogItem[] = [
      { id: 1, m: 0, text: `📣 กรรมการเป่านกหวีดเริ่มเกม! ${homeOrig.name} พบ ${awayOrig.name}`, tone: 'sys' },
      { id: 2, m: 0, text: `🏟️ ยอดผู้ชมเข้าสนาม: ${matchAttendance.att.toLocaleString()} / ${matchAttendance.cap.toLocaleString()} คน (${matchAttendance.pct}%)`, tone: 'sys' },
      { id: 3, m: 0, text: envDesc, tone: 'sys' }
    ];
    if (isPlayerMode) {
      base.push({
        id: 5,
        m: 0,
        text: `กัปตันสนามวันนี้: ${homeOrig.name} (${initialHomeCap || '-'}) · ${awayOrig.name} (${initialAwayCap || '-'})`,
        tone: 'sys'
      });
      if (myInitialBanned) {
        base.unshift({ id: 4, m: 0, text: `🟥 คุณติดโทษแบนนัดนี้ (เหลือ ${myPlayerSquadObj?.sus || state.p?.sus} นัด) — ชมการแข่งขันจากอัฒจันทร์`, tone: 'card' });
      } else if (myInitialStarted) {
        base.unshift({ id: 4, m: 0, text: `⭐ คุณได้ลงสนามเป็น 11 ตัวจริงของ ${meTeamOrig.name}`, tone: 'sys' });
      } else {
        base.unshift({ id: 4, m: 0, text: `🪑 นัดนี้คุณเริ่มต้นที่ม้านั่งสำรอง รอโอกาสโค้ชส่งลงสนาม`, tone: 'sys' });
      }
    }
    return base;
  });

  const [matchStats, setMatchStats] = useState({
    possH: 50,
    shotsH: 0,
    shotsA: 0,
    onTargetH: 0,
    onTargetA: 0,
    savesH: 0,
    savesA: 0,
    blocksH: 0,
    blocksA: 0,
    cornersH: 0,
    cornersA: 0,
    foulsH: 0,
    foulsA: 0,
    offsidesH: 0,
    offsidesA: 0,
    freeKicksH: 0,
    freeKicksA: 0,
    passesH: 0,
    passesA: 0,
    xgH: 0,
    xgA: 0
  });

  const [liveTac, setLiveTac] = useState<Mentality>(meTeamOrig.tac);
  const [livePress, setLivePress] = useState<number>(meTeamOrig.press ?? 1);
  const [liveTempo, setLiveTempo] = useState<number>(meTeamOrig.tempo ?? 1);
  const [liveLine, setLiveLine] = useState<number>(meTeamOrig.line ?? 1);
  const [liveWid, setLiveWid] = useState<number>(meTeamOrig.wid ?? 1);
  const [livePass, setLivePass] = useState<number>(meTeamOrig.pass ?? 1);

  const [liveLu, setLiveLu] = useState<string[]>(() => initialMeXi);
  const [liveOppLu, setLiveOppLu] = useState<string[]>(() => (meIsHome ? initialAwayXi : initialHomeXi));
  const [subsUsed, setSubsUsed] = useState<string[]>([]);
  const [subLog, setSubLog] = useState<MatchSubEvent[]>([]);
  const [liveFitMap, setLiveFitMap] = useState<Record<string, number>>(() =>
    Object.fromEntries([...homeOrig.sq, ...awayOrig.sq].map((q) => [q.n, Math.round(q.fit ?? 100)]))
  );
  const [liveFormMap, setLiveFormMap] = useState<Record<string, number>>(() =>
    Object.fromEntries([...homeOrig.sq, ...awayOrig.sq].map((q) => [q.n, 6.5]))
  );
  const [autoSubEnabled, setAutoSubEnabled] = useState<boolean>(() => Boolean(getSettings().autoSubMatch));
  const subAlertEnabled = settings.subAlertEnabled ?? true;
  const subAlertFitTh = clamp(settings.subAlertFitThreshold ?? 58, 45, 75);
  const subAlertFormTh = clamp(settings.subAlertFormThreshold ?? 5.8, 5.0, 6.4);
  const [timelineEvents, setTimelineEvents] = useState<MatchTimelineItem[]>(() => [
    { id: 'phase-kickoff-0', seq: 1, m: 0, side: 'N', kind: 'kickoff', who: 'เริ่มเกม', detail: 'เขี่ยบอลครึ่งแรก' }
  ]);
  const [matchYellows, setMatchYellows] = useState<Record<string, number>>({});
  const [matchCards, setMatchCards] = useState<MatchCardEvent[]>([]);
  const [sentOff, setSentOff] = useState<string[]>([]);
  const [injuredNamesUi, setInjuredNamesUi] = useState<string[]>([]);
  const [livePlayerStatsUi, setLivePlayerStatsUi] = useState<Record<string, LivePlayerMatchStats>>({});
  const [subPickOut, setSubPickOut] = useState<string | null>(null);
  const [mlandMatchTab, setMlandMatchTab] = useState<'players' | 'stats' | 'chat' | 'tactics'>('stats');
  const [liveCaptains, setLiveCaptains] = useState<{ H: string; A: string }>(() => ({
    H: initialHomeCap,
    A: initialAwayCap
  }));
  const [liveSetPiecesUi, setLiveSetPiecesUi] = useState<{ corner?: string; freekick?: string; penalty?: string }>(() => ({
    corner: meTeamOrig.setPieces?.corner,
    freekick: meTeamOrig.setPieces?.freekick,
    penalty: meTeamOrig.setPieces?.penalty
  }));
  const liveSetPiecesRef = useRef<{ corner?: string; freekick?: string; penalty?: string }>({
    corner: meTeamOrig.setPieces?.corner,
    freekick: meTeamOrig.setPieces?.freekick,
    penalty: meTeamOrig.setPieces?.penalty
  });
  const [coachChatCooldownMin, setCoachChatCooldownMin] = useState<number>(-30);
  const coachChatCooldownRef = useRef<number>(-30);
  const [coachChatCount, setCoachChatCount] = useState<number>(0);
  const coachChatCountRef = useRef<number>(0);
  const coachDisagreeCountRef = useRef<number>(0);
  const [userPitchStatus, setUserPitchStatus] = useState<'on' | 'bench' | 'subbed_out' | 'sent_off'>(() => {
    if (state.mode !== 'p' || !myPlayerName) return 'on';
    if (myInitialBanned) return 'bench';
    const myXiNow = meIsHome ? initialHomeXi : initialAwayXi;
    return myXiNow.includes(myPlayerName) ? 'on' : 'bench';
  });
  const lastUserPitchStatusRef = useRef<'on' | 'bench' | 'subbed_out' | 'sent_off'>(userPitchStatus);
  const [coachChatReplies, setCoachChatReplies] = useState<{
    id: number;
    m: number;
    userMsg: string;
    coachMsg: string;
    accepted: boolean;
    effectSummary?: string;
  }[]>([]);
  const [halftimeCoachOrder, setHalftimeCoachOrder] = useState<{
    headline: string;
    detail: string;
    playerNote: string;
    form: string;
    tacLabel: string;
  } | null>(null);
  const streamProj = useMemo(
    () => computeMatchStreamProjection(homeOrig, awayOrig, state, { kind, derby: isDerby }),
    [homeOrig, awayOrig, state, kind, isDerby]
  );
  const broadcastChannel = useMemo(
    () =>
      getMatchBroadcastChannel({
        tier: homeOrig.tier,
        kind,
        planId: streamProj.plan.id,
        homeId: homeOrig.id,
        season: state.season
      }),
    [homeOrig.tier, homeOrig.id, kind, streamProj.plan.id, state.season]
  );
  const initialLiveViewers = Math.max(250, Math.round(streamProj.baseViewers * 0.72));
  const [liveViewers, setLiveViewers] = useState<number>(() => initialLiveViewers);
  const [peakViewers, setPeakViewers] = useState<number>(() => initialLiveViewers);
  const usedStreamTextsRef = useRef<Set<string>>(new Set());
  const [liveComments, setLiveComments] = useState<LiveCommentItem[]>(() => {
    const initial: LiveCommentItem[] = [];
    for (let i = 0; i < 2; i++) {
      const item = generateLiveStreamComment({
        m: 0,
        viewers: initialLiveViewers,
        kind: 'ambient',
        homeName: homeOrig.name,
        awayName: awayOrig.name,
        myTeamName: meTeamOrig.name,
        oppTeamName: oppTeamOrig.name,
        channelName: broadcastChannel.name,
        gh: 0,
        ga: 0,
        usedTexts: usedStreamTextsRef.current
      });
      if (item) initial.push(item);
    }
    return initial;
  });
  const [clubShoutMin, setClubShoutMin] = useState<number>(-10);
  const liveViewersRef = useRef<number>(initialLiveViewers);
  const peakViewersRef = useRef<number>(initialLiveViewers);
  const lastStreamMinRef = useRef<number>(0);
  const lastClockSigRef = useRef<string>('');
  const lastStatsSigRef = useRef<string>('');
  const lastMiracleSigRef = useRef<string>('');
  const lastBlessedSigRef = useRef<string>('');

  const prevMatchTabBeforeTacticsRef = useRef<'stats' | 'chat'>('stats');

  const openTacticsStudio = useCallback((pickOutName?: string) => {
    const curTab = mlandMatchTabRef.current;
    if (curTab === 'stats' || curTab === 'chat') {
      prevMatchTabBeforeTacticsRef.current = curTab;
    }
    if (pickOutName) setSubPickOut(pickOutName);
    setLivePlayerStatsUi({ ...simRef.current.playerStats });
    setInjuredNamesUi(simRef.current.injuredNames.slice());
    setMlandMatchTab('tactics');
    setPaused(true);
  }, []);
  const [eventFilter, setEventFilter] = useState<'all' | 'goal' | 'card' | 'var' | 'sub'>('all');
  const [htPitchMode, setHtPitchMode] = useState<'all' | 'H' | 'A'>(() => (meIsHome ? 'H' : 'A'));
  const [htPickedPlayer, setHtPickedPlayer] = useState<string | null>(null);

  const [varHistory, setVarHistory] = useState<VarReplayRecord[]>([]);
  const [liveVarActive, setLiveVarActive] = useState(false);
  const [varReplayModalState, setVarReplayModalState] = useState<{ record: VarReplayRecord; liveMode: boolean } | null>(null);
  const wasPausedBeforeVarRef = useRef(false);
  const lastLiveVarActiveRef = useRef(false);

  const [highlightClips, setHighlightClips] = useState<MatchHighlightClip[]>([]);
  const [highlightModalOpen, setHighlightModalOpen] = useState(false);
  const [highlightInitialId, setHighlightInitialId] = useState<string | undefined>(undefined);
  const rollingSamplesRef = useRef<RollingHighlightSample[]>([]);
  const lastHighlightSampleClockRef = useRef(-1);
  const highlightClockRef = useRef(0);
  const varBuildupSamplesRef = useRef<RollingHighlightSample[] | null>(null);
  const lastShotTelemetryRef = useRef<{ distM: number; speedKmh: number; style?: string; flightType?: string } | null>(null);
  const activePostCapturesRef = useRef<
    {
      remainingSamples: number;
      postSamples: RollingHighlightSample[];
      preSamples: RollingHighlightSample[];
      meta: Omit<FinalizeClipParams, 'preSamples' | 'postSamples'>;
    }[]
  >([]);

  const [penResult, setPenResult] = useState<{ winnerHome: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [broadcastFullscreen, setBroadcastFullscreen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftStageScrollRef = useRef<HTMLDivElement | null>(null);
  const rightStageScrollRef = useRef<HTMLDivElement | null>(null);
  const rightChatScrollRef = useRef<HTMLDivElement | null>(null);
  const rightTacticsScrollRef = useRef<HTMLDivElement | null>(null);
  useScrollTopOnChange(leftStageScrollRef, [done, matchPhaseUi === 'halftime'], { includeAncestors: false });
  useScrollTopOnChange(rightStageScrollRef, [mlandMatchTab, done, matchPhaseUi], { includeAncestors: false });
  useScrollTopOnChange(rightChatScrollRef, [mlandMatchTab, done], { includeAncestors: false });
  useScrollTopOnChange(rightTacticsScrollRef, [mlandMatchTab, matchPhaseUi], { includeAncestors: false });

  useEffect(() => {
    if (done) {
      setMlandMatchTab('players');
      setBroadcastFullscreen(false);
    }
  }, [done]);

  useEffect(() => {
    if (matchPhaseUi === 'halftime' || (state.mode === 'm' && mlandMatchTab === 'tactics')) {
      setBroadcastFullscreen(false);
    }
  }, [matchPhaseUi, state.mode, mlandMatchTab]);
  const triggeredRulesRef = useRef<number[]>([]);
  const lastGoalSoundMsRef = useRef(0);
  const alertLoggedRef = useRef<Set<string>>(new Set());

  const simRef = useRef({
    homeLu: initialHomeXi.slice(),
    awayLu: initialAwayXi.slice(),
    homePlayed: initialHomeXi.slice(),
    awayPlayed: initialAwayXi.slice(),
    captainH: initialHomeCap,
    captainA: initialAwayCap,
    homeSubsCount: 0,
    awaySubsCount: 0,
    yellows: {} as Record<string, number>,
    sentOff: [] as string[],
    cards: [] as MatchCardEvent[],
    subs: [] as MatchSubEvent[],
    injuries: [] as { teamId: number; name: string; games: number }[],
    injuredNames: [] as string[],
    liveFit: Object.fromEntries([...homeOrig.sq, ...awayOrig.sq].map((q) => [q.n, Math.round(q.fit ?? 100)])) as Record<string, number>,
    liveForm: Object.fromEntries([...initialHomeXi, ...initialAwayXi].map((n) => [n, 6.5])) as Record<string, number>,
    playerStats: {} as Record<string, LivePlayerMatchStats>,
    userStarted: myInitialStarted,
    userSubInMin: null as number | null,
    userSubOutMin: null as number | null,
    userSentOffMin: null as number | null,
    aiSubMinH: [R(54, 61), R(64, 71), R(73, 79), R(81, 86)],
    aiSubMinA: [R(54, 61), R(64, 71), R(73, 79), R(81, 86)],
    gh: 0,
    ga: 0,
    evs: [] as MatchEvent[],
    timeline: [
      { id: 'phase-kickoff-0', seq: 1, m: 0, side: 'N' as const, kind: 'kickoff' as const, who: 'เริ่มเกม', detail: 'เขี่ยบอลครึ่งแรก' }
    ] as MatchTimelineItem[],
    timelineSeq: 1,
    varHistory: [] as VarReplayRecord[],
    varSeq: 0,
    highlightClips: [] as MatchHighlightClip[],
    highlightSeq: 0,
    miracleUsedH: false,
    miracleUsedA: false,
    godPowerStrikes: 0,
    maxDeficitH: 0,
    maxDeficitA: 0,
    miracleCelebrated: false,
    done: false
  });

  const liveTacticsRef = useRef({
    tac: meTeamOrig.tac,
    press: meTeamOrig.press ?? 1,
    tempo: meTeamOrig.tempo ?? 1,
    line: meTeamOrig.line ?? 1,
    wid: meTeamOrig.wid ?? 1,
    pass: meTeamOrig.pass ?? 1
  });
  liveTacticsRef.current = {
    tac: liveTac,
    press: livePress,
    tempo: liveTempo,
    line: liveLine,
    wid: liveWid,
    pass: livePass
  };

  const aiCoachRef = useRef<{
    H: { form: string; cf?: Team['cf']; tac: Mentality; press: number; tempo: number; line: number; wid: number; pass: number };
    A: { form: string; cf?: Team['cf']; tac: Mentality; press: number; tempo: number; line: number; wid: number; pass: number };
    earlyDoneH: boolean;
    earlyDoneA: boolean;
    htDoneH: boolean;
    htDoneA: boolean;
    lateDoneH: boolean;
    lateDoneA: boolean;
  }>({
    H: {
      form: homeOrig.form,
      cf: homeOrig.cf,
      tac: homeOrig.tac,
      press: homeOrig.press ?? 1,
      tempo: homeOrig.tempo ?? 1,
      line: homeOrig.line ?? 1,
      wid: homeOrig.wid ?? 1,
      pass: homeOrig.pass ?? 1
    },
    A: {
      form: awayOrig.form,
      cf: awayOrig.cf,
      tac: awayOrig.tac,
      press: awayOrig.press ?? 1,
      tempo: awayOrig.tempo ?? 1,
      line: awayOrig.line ?? 1,
      wid: awayOrig.wid ?? 1,
      pass: awayOrig.pass ?? 1
    },
    earlyDoneH: false,
    earlyDoneA: false,
    htDoneH: false,
    htDoneA: false,
    lateDoneH: false,
    lateDoneA: false
  });
  const [aiFormDisplay, setAiFormDisplay] = useState<{ H: string; A: string }>({
    H: homeOrig.form,
    A: awayOrig.form
  });

  const subAlertCfgRef = useRef({ enabled: subAlertEnabled, fitTh: subAlertFitTh, formTh: subAlertFormTh });
  subAlertCfgRef.current = { enabled: subAlertEnabled, fitTh: subAlertFitTh, formTh: subAlertFormTh };
  const autoSubEnabledRef = useRef(autoSubEnabled);
  autoSubEnabledRef.current = autoSubEnabled;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const cineSlowMoRef = useRef(cineSlowMo);
  cineSlowMoRef.current = cineSlowMo;
  const showRunVectorsRef = useRef(showRunVectors);
  showRunVectorsRef.current = showRunVectors;
  const showPositionsRef = useRef(showPositions);
  showPositionsRef.current = showPositions;
  const showRatingsRef = useRef(showRatings);
  showRatingsRef.current = showRatings;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const doneRef = useRef(done);
  doneRef.current = done;
  const matchPhaseUiRef = useRef(matchPhaseUi);
  matchPhaseUiRef.current = matchPhaseUi;
  const mlandMatchTabRef = useRef(mlandMatchTab);
  mlandMatchTabRef.current = mlandMatchTab;
  const minuteRef = useRef(minute);
  minuteRef.current = minute;
  const selectedHalftimeTalkRef = useRef(selectedHalftimeTalk);
  selectedHalftimeTalkRef.current = selectedHalftimeTalk;
  const varHistoryRef = useRef(varHistory);
  varHistoryRef.current = varHistory;
  const highlightClipsRef = useRef(highlightClips);
  highlightClipsRef.current = highlightClips;
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const liveCommentsRef = useRef(liveComments);
  liveCommentsRef.current = liveComments;
  const injuryAlertRef = useRef(injuryAlert);
  injuryAlertRef.current = injuryAlert;
  const penResultRef = useRef(penResult);
  penResultRef.current = penResult;
  const shootoutUiRef = useRef(shootoutUi);
  shootoutUiRef.current = shootoutUi;
  const matchStatsRef = useRef(matchStats);
  matchStatsRef.current = matchStats;
  const liveCaptainsRef = useRef(liveCaptains);
  liveCaptainsRef.current = liveCaptains;
  const liveLuRef = useRef(liveLu);
  liveLuRef.current = liveLu;
  const liveTacRef = useRef(liveTac);
  liveTacRef.current = liveTac;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const buildBenchSeatsForTeam = (team: Team, curLu: string[]): LiveBenchSeat[] => {
    const sr = simRef.current;
    const subOutSet = new Set(sr.subs.filter((s) => s.t === team.id).map((s) => s.outPlayer));
    return team.sq
      .filter((q) => !curLu.includes(q.n) && !sr.sentOff.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0)
      .sort((a, b) => {
        const aMe = a.me || (myPlayerName && a.n === myPlayerName) ? 1 : 0;
        const bMe = b.me || (myPlayerName && b.n === myPlayerName) ? 1 : 0;
        if (aMe !== bMe) return bMe - aMe;
        const aOut = subOutSet.has(a.n) ? 1 : 0;
        const bOut = subOutSet.has(b.n) ? 1 : 0;
        if (aOut !== bOut) return aOut - bOut;
        return b.ov - a.ov;
      })
      .slice(0, 5)
      .map((q) => ({
        id: q.n,
        shortName: q.n.split(' ')[0] || q.n,
        no: getShirtNo(team, q),
        role: q.ro,
        vis: visOf(q, state.p),
        subbedOut: subOutSet.has(q.n),
        isMe: Boolean(q.me || (myPlayerName && q.n === myPlayerName))
      }));
  };

  const syncSidelineBenches = (w: LiveMatchWorld | null | undefined) => {
    if (isSkippingRef.current || !w?.sideline) return;
    const sr = simRef.current;
    w.sideline.benchH = buildBenchSeatsForTeam(homeOrig, sr.homeLu);
    w.sideline.benchA = buildBenchSeatsForTeam(awayOrig, sr.awayLu);
  };

  const triggerCoachShout = (w: LiveMatchWorld | null | undefined, side: 'H' | 'A', text: string, dur = 2.6) => {
    if (isSkippingRef.current || !w?.sideline) return;
    const c = side === 'H' ? w.sideline.coachH : w.sideline.coachA;
    c.shoutText = text;
    c.shoutTimer = dur;
    c.gestureTimer = Math.max(c.gestureTimer, dur * 0.8);
    if (!simRef.current.done && w.phase !== 'halftime') {
      const now = Date.now();
      if (now - lastCoachSfxTsRef.current >= 750) {
        lastCoachSfxTsRef.current = now;
        SFX.coach();
      }
    }
  };

  const triggerCoachMood = (w: LiveMatchWorld | null | undefined, side: 'H' | 'A', emoji: string, dur = 2.2) => {
    if (isSkippingRef.current || !w?.sideline) return;
    const c = side === 'H' ? w.sideline.coachH : w.sideline.coachA;
    c.moodEmoji = emoji;
    c.moodTimer = Math.max(c.moodTimer || 0, dur);
    c.moodCooldown = Math.max(c.moodCooldown || 0, 5.5 + Math.random() * 4.5);
  };

  function getLiveHomeTeam(): Team {
    const isUserMgr = state.mode === 'm' && meIsHome;
    const aiH = aiCoachRef.current.H;
    return {
      ...homeOrig,
      cap: simRef.current.captainH || homeOrig.cap,
      setPieces: meIsHome ? liveSetPiecesRef.current : homeOrig.setPieces,
      form: isUserMgr ? homeOrig.form : aiH.form,
      cf: isUserMgr ? homeOrig.cf : aiH.cf,
      tac: isUserMgr ? liveTacticsRef.current.tac : aiH.tac,
      press: isUserMgr ? liveTacticsRef.current.press : aiH.press,
      tempo: isUserMgr ? liveTacticsRef.current.tempo : aiH.tempo,
      line: isUserMgr ? liveTacticsRef.current.line : aiH.line,
      wid: isUserMgr ? liveTacticsRef.current.wid : aiH.wid,
      pass: isUserMgr ? liveTacticsRef.current.pass : aiH.pass,
      lu: simRef.current.homeLu
    };
  }

  function getLiveAwayTeam(): Team {
    const isUserMgr = state.mode === 'm' && !meIsHome;
    const aiA = aiCoachRef.current.A;
    return {
      ...awayOrig,
      cap: simRef.current.captainA || awayOrig.cap,
      setPieces: !meIsHome ? liveSetPiecesRef.current : awayOrig.setPieces,
      form: isUserMgr ? awayOrig.form : aiA.form,
      cf: isUserMgr ? awayOrig.cf : aiA.cf,
      tac: isUserMgr ? liveTacticsRef.current.tac : aiA.tac,
      press: isUserMgr ? liveTacticsRef.current.press : aiA.press,
      tempo: isUserMgr ? liveTacticsRef.current.tempo : aiA.tempo,
      line: isUserMgr ? liveTacticsRef.current.line : aiA.line,
      wid: isUserMgr ? liveTacticsRef.current.wid : aiA.wid,
      pass: isUserMgr ? liveTacticsRef.current.pass : aiA.pass,
      lu: simRef.current.awayLu
    };
  }

  const getCachedSideRate = (side: 'H' | 'A', curMin: number) => {
    const sr = simRef.current;
    const team = side === 'H' ? getLiveHomeTeam() : getLiveAwayTeam();
    if (!isSkippingRef.current) {
      return rate(team, state, kind !== 'league' || isDerby, curMin, sr.subs.map((s) => s.inPlayer), sr.sentOff, side === 'H');
    }
    const key = `${side}|${Math.floor(curMin / 5)}|${team.form}|${team.tac}|${team.press ?? 1}|${team.tempo ?? 1}|${team.line ?? 1}|${team.wid ?? 1}|${team.pass ?? 1}|${(team.lu || []).join(',')}|${sr.sentOff.length}`;
    const hit = skipRateCacheRef.current.get(key);
    if (hit) return hit;
    const computed = rate(team, state, kind !== 'league' || isDerby, curMin, sr.subs.map((s) => s.inPlayer), sr.sentOff, side === 'H');
    skipRateCacheRef.current.set(key, computed);
    return computed;
  };

  function buildTeamAgents(team: Team, side: 'H' | 'A', luNames: string[], secondHalf = false) {
    const sr = simRef.current;
    const activeCap = side === 'H' ? sr.captainH : sr.captainA;
    const subbedInNames = sr.subs.filter((s) => s.t === team.id).map((s) => s.inPlayer);
    return buildAgentsForTeam(
      team,
      side,
      luNames,
      sr.sentOff,
      sr.yellows,
      sr.liveFit,
      state.p,
      myPlayerName,
      secondHalf,
      side === 'H' ? homeStatDeltas : awayStatDeltas,
      activeCap,
      subbedInNames
    );
  }

  const ensureOnPitchCaptain = (
    w: LiveMatchWorld | null | undefined,
    side: 'H' | 'A',
    curMin: number,
    reason: 'sub' | 'red' | 'inj',
    silentLog = false
  ) => {
    const sr = simRef.current;
    const orig = side === 'H' ? homeOrig : awayOrig;
    const curLu = side === 'H' ? sr.homeLu : sr.awayLu;
    const curCap = side === 'H' ? sr.captainH : sr.captainA;
    const activeNames = curLu.filter((n) => {
      if (sr.sentOff.includes(n)) return false;
      const ag = w?.agents.find((a) => a.side === side && a.id === n);
      if (ag?.injuredOut && ag?.sentOff) return false;
      return true;
    });
    if (!activeNames.length) return;
    if (curCap && activeNames.includes(curCap)) {
      if (w) {
        w.agents.forEach((a) => {
          if (a.side === side) a.isCaptain = a.id === curCap;
        });
      }
      return;
    }
    const nextCap =
      pickBestCaptain(orig, activeNames, sr.sentOff, state.p) ||
      activeNames.find((n) => orig.sq.find((q) => q.n === n)?.pos !== 'GK') ||
      activeNames[0];
    if (!nextCap) return;
    if (side === 'H') sr.captainH = nextCap;
    else sr.captainA = nextCap;
    if (w) {
      w.agents.forEach((a) => {
        if (a.side === side) a.isCaptain = a.id === nextCap;
      });
    }
    if (!isSkippingRef.current) {
      setLiveCaptains({ H: sr.captainH, A: sr.captainA });
    }
    if (!silentLog && curCap && nextCap !== curCap) {
      const reasonTxt = reason === 'red' ? 'โดนใบแดง' : reason === 'inj' ? 'บาดเจ็บ' : 'ถูกเปลี่ยนออก';
      const isMeCap = isPlayerMode && nextCap === myPlayerName;
      pushLog(
        curMin,
        `กัปตันชั่วคราว (${orig.name}): มอบปลอกแขนให้ ${nextCap}${isMeCap ? ' (คุณ!)' : ''} แทน ${curCap} (${reasonTxt})`,
        'sys'
      );
    }
  };

  const resolveSetPieceTaker = (
    w: LiveMatchWorld,
    side: 'H' | 'A',
    kind: 'corner' | 'freekick' | 'penalty'
  ): LivePitchAgent | undefined => {
    const activePool = w.agents.filter((a) => a.side === side && !a.sentOff && a.pos !== 'GK');
    if (!activePool.length) {
      return w.agents.find((a) => a.side === side && !a.sentOff);
    }
    const team = side === 'H' ? homeOrig : awayOrig;
    const isMySide = (side === 'H' && meIsHome) || (side === 'A' && !meIsHome);
    const assignedName = isMySide ? liveSetPiecesRef.current[kind] : team.setPieces?.[kind];
    if (assignedName) {
      const assignedAg = activePool.find((a) => a.id === assignedName);
      if (assignedAg) return assignedAg;
    }
    if (kind === 'corner') {
      return activePool
        .slice()
        .sort(
          (u, v) =>
            v.d.crs + v.d.cur + (v.sig === 'crs' ? 10 : 0) + (agentHasTrait(v, 'setpiece_specialist') ? 18 : 0) -
            (u.d.crs + u.d.cur + (u.sig === 'crs' ? 10 : 0) + (agentHasTrait(u, 'setpiece_specialist') ? 18 : 0))
        )[0];
    }
    if (kind === 'freekick') {
      return activePool
        .slice()
        .sort(
          (u, v) =>
            v.d.cur + v.d.pw + (v.sig === 'cur' ? 10 : 0) + (agentHasTrait(v, 'setpiece_specialist') ? 18 : 0) -
            (u.d.cur + u.d.pw + (u.sig === 'cur' ? 10 : 0) + (agentHasTrait(u, 'setpiece_specialist') ? 18 : 0))
        )[0];
    }
    return activePool
      .slice()
      .sort(
        (u, v) =>
          v.d.fin + (v.d.comp || 60) + (v.tr === 4 || v.tr === 17 ? 14 : 0) + (agentHasTrait(v, 'setpiece_specialist') ? 10 : 0) -
          (u.d.fin + (u.d.comp || 60) + (u.tr === 4 || u.tr === 17 ? 14 : 0) + (agentHasTrait(u, 'setpiece_specialist') ? 10 : 0))
      )[0];
  };

  function buildInitialWorld(): LiveMatchWorld {
    const sr = simRef.current;
    const hAgents = buildTeamAgents(getLiveHomeTeam(), 'H', sr.homeLu, false);
    const aAgents = buildTeamAgents(getLiveAwayTeam(), 'A', sr.awayLu, false);
    const firstCarrier = hAgents.find((a) => a.pos === 'FW') || hAgents.find((a) => a.pos === 'MF') || hAgents[9];
    if (firstCarrier) {
      firstCarrier.x = 49;
      firstCarrier.y = 50;
      firstCarrier.intent = 'CARRY';
    }
    const mkCoach = (side: 'H' | 'A', startX: number): LiveSidelineCoach => {
      const orig = side === 'H' ? homeOrig : awayOrig;
      const isUser = state.mode === 'm' && ((side === 'H' && meIsHome) || (side === 'A' && !meIsHome));
      const seedName = isUser && state.club?.managerName ? state.club.managerName : `${orig.name} coach`;
      const coachVis =
        isUser && Array.isArray(state.club?.managerVis) && state.club.managerVis.length >= 6
          ? [...state.club.managerVis]
          : getDefaultCoachVis(seedName);
      const [, origTrim] = teamKits(orig, state);
      const tieColor = isUser ? (state.club?.c2 || origTrim || '#facc15') : (origTrim || '#facc15');
      const baseOutfit: CoachOutfitId = state.club?.managerOutfit || 'suit_navy';
      let matchOutfit: CoachOutfitId = 'suit_navy';
      if (isUser) {
        if (state.club?.managerRandomOutfitPerMatch && COACH_OUTFITS.length > 0) {
          const pool = COACH_OUTFITS.filter((o) => o.id !== baseOutfit);
          const src = pool.length ? pool : COACH_OUTFITS;
          matchOutfit = src[R(0, src.length - 1)]?.id || baseOutfit;
        } else {
          matchOutfit = baseOutfit;
        }
      }
      return {
        side,
        x: startX,
        y: 104,
        tx: startX,
        ty: 104,
        facing: -Math.PI / 2,
        pacePhase: side === 'H' ? 0 : 1.7,
        gestureTimer: 1.5,
        shoutText: side === 'H' ? '📣 ลุยเต็มที่!' : null,
        shoutTimer: side === 'H' ? 2.4 : 0,
        moodEmoji: null,
        moodTimer: 0,
        moodCooldown: side === 'H' ? 6.5 : 9.0,
        isUserCoach: isUser,
        vis: coachVis,
        tieColor,
        outfit: matchOutfit
      };
    };
    return {
      env: matchEnv,
      agents: [...hAgents, ...aAgents],
      ball: {
        x: 50,
        y: 50,
        z: 0,
        fromX: 50,
        fromY: 50,
        toX: 50,
        toY: 50,
        curve: 0,
        maxZ: 0,
        progress: 1,
        duration: 0.45,
        flightType: 'carry',
        carrierId: firstCarrier?.id || null,
        targetId: null,
        shooterId: null,
        lastPasserId: null,
        possessionSide: 'H',
        trail: []
      },
      fx: [],
      nextFxId: 1,
      pendingSetPiece: { type: 'kickoff', side: 'H', x: 50, y: 50, waitSec: 0.3 },
      secondHalf: false,
      phase: 'play1',
      added1: 0,
      added2: 0,
      stoppageFloat: 0,
      varChecks: 0,
      varReview: null,
      shootout: null,
      phaseLabel: '⚽ เขี่ยบอลเริ่มเกม',
      phaseTone: 'normal',
      minuteFloat: 0,
      lastTickedMin: 0,
      possTicksH: 5,
      possTicksTotal: 10,
      goalNetRippleLeft: 0,
      goalNetRippleRight: 0,
      celebrateTimer: 0,
      celebration: null,
      lastCelebrationStyle: undefined,
      kickoffReturnElapsed: 0,
      dramaSlowSec: 0,
      dramaLabel: null,
      sparkles: [],
      goalBanner: null,
      cardBanner: null,
      passesH: 0,
      passesA: 0,
      shotsH: 0,
      shotsA: 0,
      onTargetH: 0,
      onTargetA: 0,
      savesH: 0,
      savesA: 0,
      blocksH: 0,
      blocksA: 0,
      cornersH: 0,
      cornersA: 0,
      foulsH: 0,
      foulsA: 0,
      offsidesH: 0,
      offsidesA: 0,
      freeKicksH: 0,
      freeKicksA: 0,
      xgH: 0,
      xgA: 0,
      inMatchInjuryCount: 0,
      miracle: null,
      sideline: {
        benchH: buildBenchSeatsForTeam(homeOrig, sr.homeLu),
        benchA: buildBenchSeatsForTeam(awayOrig, sr.awayLu),
        coachH: mkCoach('H', 43.2),
        coachA: mkCoach('A', 56.8),
        warmupPhase: 0
      }
    };
  }

  const worldRef = useRef<LiveMatchWorld | null>(null);
  if (!worldRef.current) {
    worldRef.current = buildInitialWorld();
  }

  const getEffectiveTeamCfg = (side: 'H' | 'A', curMin: number) => {
    const isUserMgrSide = state.mode === 'm' && ((side === 'H' && meIsHome) || (side === 'A' && !meIsHome));
    const aiCfg = aiCoachRef.current[side];
    const base = isUserMgrSide
      ? liveTacticsRef.current
      : {
          tac: aiCfg.tac,
          press: aiCfg.press,
          tempo: aiCfg.tempo,
          line: aiCfg.line,
          wid: aiCfg.wid,
          pass: aiCfg.pass
        };

    const myScore = side === 'H' ? simRef.current.gh : simRef.current.ga;
    const oppScore = side === 'H' ? simRef.current.ga : simRef.current.gh;
    let pushShift = base.tac === 'X' ? 12 : base.tac === 'A' ? 6 : base.tac === 'D' ? -7 : base.tac === 'Z' ? -13 : 0;
    let pressLvl = base.press;
    let lineLvl = base.line;
    let tempoLvl = base.tempo;
    let tacMode = base.tac;

    // Adaptive AI response to scoreline & match clock
    if (!isUserMgrSide) {
      if (myScore < oppScore && curMin >= 64) {
        pushShift += 7;
        pressLvl = Math.min(2, pressLvl + 1);
        lineLvl = Math.min(2, lineLvl + 1);
      } else if (myScore > oppScore && curMin >= 74) {
        pushShift -= 6;
        lineLvl = Math.max(0, lineLvl - 1);
      }
    }

    // Active Miracle Comeback surge pushes the trailing team into relentless attack
    const activeMiracle = worldRef.current?.miracle;
    if (activeMiracle && activeMiracle.side === side && (activeMiracle.minsLeft ?? 0) > 0) {
      pushShift += 12;
      pressLvl = 2;
      lineLvl = 2;
      tempoLvl = 2;
      tacMode = 'X';
    }

    const downMen = worldRef.current
      ? worldRef.current.agents.filter((a) => a.side === side && a.sentOff).length
      : 0;
    if (downMen > 0) pushShift -= downMen * 5;

    return {
      tac: tacMode,
      press: pressLvl,
      tempo: tempoLvl,
      line: lineLvl,
      wid: base.wid,
      pass: base.pass,
      pushShift
    };
  };

  const curMeOnPitch = (w: LiveMatchWorld | null | undefined): boolean => {
    if (!isPlayerMode || !myPlayerName) return false;
    const sr = simRef.current;
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    if (!myLu.includes(myPlayerName) || sr.sentOff.includes(myPlayerName)) return false;
    const ag = w?.agents.find((a) => a.id === myPlayerName);
    if (ag?.injuredOut && ag?.sentOff) return false;
    return true;
  };

  const applyAiFormationSwitchForSide = (
    w: LiveMatchWorld,
    side: 'H' | 'A',
    bestPh: (typeof CLUB_PHILOSOPHIES)[number],
    nextCfg: {
      form: string;
      cf?: Team['cf'];
      tac: Mentality;
      press: number;
      tempo: number;
      line: number;
      wid: number;
      pass: number;
    },
    curMin: number,
    isInstant: boolean,
    reasonTxt: string
  ) => {
    const sr = simRef.current;
    const ac = aiCoachRef.current;
    const orig = side === 'H' ? homeOrig : awayOrig;
    const curLu = side === 'H' ? sr.homeLu : sr.awayLu;

    if (side === 'H') ac.H = nextCfg;
    else ac.A = nextCfg;

    if (curLu.length === 11) {
      const newSlots = FSD[bestPh.form] || FSD['4-4-2'];
      const gkName = curLu[0];
      const pool = curLu.slice(1);
      const reordered: string[] = [gkName];
      for (let i = 1; i < 11; i++) {
        const slotSp = newSlots[i]?.[0] || 'CM';
        const slotPos = LINE[slotSp] || 'MF';
        let bestIdx = 0;
        let bestFitScore = -1e9;
        for (let j = 0; j < pool.length; j++) {
          const pl = orig.sq.find((q) => q.n === pool[j]);
          const isOut = sr.sentOff.includes(pool[j]);
          let fScore = isOut ? -500 : 0;
          if (pl) {
            if (pl.ro === slotSp) fScore += 30;
            else if (pl.altRoles?.includes(slotSp)) fScore += 22;
            else if (pl.pos === slotPos) fScore += 14;
            else if (
              (pl.pos === 'DF' && slotPos === 'MF') ||
              (pl.pos === 'MF' && slotPos === 'FW') ||
              (pl.pos === 'MF' && slotPos === 'DF') ||
              (pl.pos === 'FW' && slotPos === 'MF')
            ) {
              fScore += 4;
            } else {
              fScore -= 8;
            }
            fScore += pl.ov * 0.05;
          }
          if (fScore > bestFitScore) {
            bestFitScore = fScore;
            bestIdx = j;
          }
        }
        reordered.push(pool.splice(bestIdx, 1)[0]);
      }
      if (side === 'H') sr.homeLu = reordered;
      else sr.awayLu = reordered;
    }

    const effTeam = side === 'H' ? getLiveHomeTeam() : getLiveAwayTeam();
    const updatedLu = side === 'H' ? sr.homeLu : sr.awayLu;
    const rebuilt = buildTeamAgents(effTeam, side, updatedLu, w.secondHalf);
    rebuilt.forEach((nextAg) => {
      const oldIdx = w.agents.findIndex((a) => a.side === side && a.id === nextAg.id);
      if (oldIdx >= 0) {
        const oldAg = w.agents[oldIdx];
        w.agents[oldIdx] = {
          ...nextAg,
          x: oldAg.x,
          y: oldAg.y,
          tx: nextAg.tx,
          ty: nextAg.ty,
          facing: oldAg.facing,
          stride: oldAg.stride,
          fit: oldAg.fit,
          injuredOut: oldAg.injuredOut,
          blessedMins: oldAg.blessedMins,
          blessedTag: oldAg.blessedTag,
          godPowerMins: oldAg.godPowerMins,
          godPowerOrigD: oldAg.godPowerOrigD,
          godPowerOrigOv: oldAg.godPowerOrigOv,
          d: oldAg.godPowerMins && oldAg.godPowerMins > 0 ? { ...oldAg.d } : nextAg.d,
          ov: oldAg.godPowerMins && oldAg.godPowerMins > 0 ? oldAg.ov : nextAg.ov
        };
      }
    });

    if (!isSkippingRef.current) {
      if (side === 'H') {
        if (meIsHome) setLiveLu(sr.homeLu.slice());
        else setLiveOppLu(sr.homeLu.slice());
      } else {
        if (!meIsHome) setLiveLu(sr.awayLu.slice());
        else setLiveOppLu(sr.awayLu.slice());
      }

      setAiFormDisplay((prev) => ({ ...prev, [side]: bestPh.form }));
    }

    if (!isInstant) {
      triggerCoachShout(w, side, `📋 ปรับระบบ ${bestPh.form}!`, 2.8);
      if (w.sideline) {
        const c = side === 'H' ? w.sideline.coachH : w.sideline.coachA;
        c.moodEmoji = '📋';
        c.moodTimer = Math.max(c.moodTimer || 0, 2.5);
      }
    }
    pushLog(curMin, `🧠 โค้ช ${orig.name} เปลี่ยนแผนกลางเกมเป็นระบบ ${bestPh.form} (${bestPh.name}) — ${reasonTxt}`, 'sys');
  };

  const buildPlayerHtCoachOrder = (
    w: LiveMatchWorld,
    side: 'H' | 'A',
    scoreDiff: number,
    myReds: number,
    behindXg: boolean,
    switchedForm: boolean
  ) => {
    const sr = simRef.current;
    const cfg = side === 'H' ? aiCoachRef.current.H : aiCoachRef.current.A;
    const orig = side === 'H' ? homeOrig : awayOrig;
    const myRt = sr.liveForm[myPlayerName] ?? 6.5;
    const myFit = Math.round(sr.liveFit[myPlayerName] ?? 100);
    const myYc = sr.yellows[myPlayerName] || 0;
    const onPitch = curMeOnPitch(w);

    const headline =
      scoreDiff < 0
        ? `เราตามหลังอยู่ ${Math.abs(scoreDiff)} ประตู — ครึ่งหลังต้องเดินเครื่องเอาคืน!`
        : scoreDiff > 0
          ? `นำอยู่ ${scoreDiff} ประตู แต่ห้ามประมาท รักษาวินัยเกมของเราให้แน่น`
          : myReds > 0
            ? 'เราตัวผู้เล่นน้อยกว่า ต้องช่วยกันบีบโซนและเล่นฉลาดทุกจังหวะ'
            : behindXg
              ? 'ครึ่งแรกเราโดนกดดันพอสมควร ครึ่งหลังต้องคุมจังหวะและเข้าบอลแม่นกว่านี้'
              : 'เกมยังสูสี รักษาความสม่ำเสมอแล้วหาช่องจบสกอร์ให้เด็ดขาด';

    const detail = switchedForm
      ? `โค้ช ${orig.name} ปรับระบบเป็น ${cfg.form} (${AR_T[cfg.tac]}) เพื่อแก้ทางคู่แข่งครึ่งหลัง`
      : `ยืนแผน ${cfg.form} · สั่งเล่นสไตล์ "${AR_T[cfg.tac]}" (${cfg.press >= 2 ? 'เพรสสูง' : cfg.press === 0 ? 'รับคุมโซน' : 'คุมจังหวะ'})`;

    let playerNote = '';
    if (!onPitch) {
      playerNote = myInitialBanned
        ? 'คุณติดโทษแบนนัดนี้ คอยส่งแรงใจให้เพื่อนร่วมทีม'
        : 'เตรียมร่างกายที่ม้านั่งสำรองไว้ให้พร้อม โค้ชอาจเรียกใช้คุณในครึ่งหลัง';
    } else if (myYc >= 1) {
      playerNote = `คุณมีใบเหลืองติดตัวแล้ว (เรตติ้ง ${myRt.toFixed(1)}) — เข้าบอลให้ระวัง อย่าเสียฟาวล์เสี่ยงใบแดง`;
    } else if (myFit < 62) {
      playerNote = `ความฟิตคุณเหลือ ${myFit}% — บริหารแรงในสนามดีๆ หรือเลือกวอร์มเติมฟิตก่อนลุยต่อ`;
    } else if (myRt >= 7.2) {
      playerNote = `ครึ่งแรกคุณเล่นได้ยอดเยี่ยมมาก (⭐ ${myRt.toFixed(1)})! รักษาความมั่นใจและนำจังหวะทีมต่อ`;
    } else if (myRt < 6.1) {
      playerNote = `ครึ่งแรกฟอร์มยังไม่เข้าฝัก (⭐ ${myRt.toFixed(1)}) — ขยับหาช่องและช่วยเชื่อมบอลมากขึ้นในครึ่งหลัง`;
    } else {
      playerNote = `ฟอร์มครึ่งแรกอยู่ในเกณฑ์ดี (⭐ ${myRt.toFixed(1)} · ฟิต ${myFit}%) — วิ่งประคองโซนและรอจังหวะสำคัญ`;
    }

    return {
      headline,
      detail,
      playerNote,
      form: cfg.form,
      tacLabel: AR_T[cfg.tac]
    };
  };

  const maybeAiLiveCoachAdjust = (
    w: LiveMatchWorld,
    side: 'H' | 'A',
    curMin: number,
    phase: 'early' | 'ht' | 'late',
    isInstant: boolean
  ) => {
    const isUserMgrSide = state.mode === 'm' && ((side === 'H' && meIsHome) || (side === 'A' && !meIsHome));
    if (isUserMgrSide) return;
    const ac = aiCoachRef.current;
    if (phase === 'early') {
      if (curMin < 25 || curMin > 38) return;
      if (side === 'H' ? ac.earlyDoneH : ac.earlyDoneA) return;
    } else if (phase === 'ht') {
      if (side === 'H' ? ac.htDoneH : ac.htDoneA) return;
      if (side === 'H') ac.htDoneH = true;
      else ac.htDoneA = true;
    } else {
      if (curMin < 62 || curMin > 78) return;
      if (side === 'H' ? ac.lateDoneH : ac.lateDoneA) return;
    }

    const sr = simRef.current;
    const curCfg = side === 'H' ? ac.H : ac.A;
    const oppCfg = side === 'H' ? ac.A : ac.H;
    const orig = side === 'H' ? homeOrig : awayOrig;
    const curLu = side === 'H' ? sr.homeLu : sr.awayLu;
    const myScore = side === 'H' ? sr.gh : sr.ga;
    const oppScore = side === 'H' ? sr.ga : sr.gh;
    const scoreDiff = myScore - oppScore;
    const myXg = side === 'H' ? w.xgH : w.xgA;
    const oppXg = side === 'H' ? w.xgA : w.xgH;
    const myShots = side === 'H' ? w.shotsH : w.shotsA;
    const oppShots = side === 'H' ? w.shotsA : w.shotsH;
    const myReds = w.agents.filter((a) => a.side === side && a.sentOff).length;
    const isMyPlayerTeam = isPlayerMode && ((side === 'H' && meIsHome) || (side === 'A' && !meIsHome));

    const behindXg = oppXg - myXg >= 0.42 || oppShots - myShots >= 4;
    const urgentTrigger = scoreDiff < 0 || myReds > 0 || behindXg || (scoreDiff >= 2 && phase === 'late');

    if (phase === 'early') {
      const earlyTriggered = scoreDiff <= -2 || (scoreDiff === -1 && curMin >= 30) || myReds > 0 || (behindXg && curMin >= 28);
      if (!earlyTriggered && curMin < 35) return;
      if (side === 'H') ac.earlyDoneH = true;
      else ac.earlyDoneA = true;
    } else if (phase === 'late') {
      if (!urgentTrigger && curMin < 70) return;
      if (side === 'H') ac.lateDoneH = true;
      else ac.lateDoneA = true;
    }

    const adjustChance =
      phase === 'early'
        ? scoreDiff <= -2 ? 0.72 : myReds > 0 ? 0.75 : scoreDiff === -1 ? 0.56 : behindXg ? 0.54 : 0.25
        : scoreDiff <= -2 ? 0.88
        : scoreDiff === -1 ? 0.78
        : myReds > 0 ? 0.82
        : behindXg ? 0.68
        : scoreDiff >= 2 ? (phase === 'late' ? 0.72 : 0.45)
        : scoreDiff === 1 && phase === 'late' ? 0.62
        : 0.42;

    const shouldSwitch = Math.random() <= adjustChance;
    let didSwitch = false;

    if (shouldSwitch) {
      const activePlayers = curLu
        .map((n) => orig.sq.find((q) => q.n === n))
        .filter((q): q is Player => Boolean(q))
        .filter((q) => q.pos !== 'GK' && !sr.sentOff.includes(q.n));
      const avDF = activePlayers.filter((p) => p.pos === 'DF').length;
      const avMF = activePlayers.filter((p) => p.pos === 'MF').length;
      const avFW = activePlayers.filter((p) => p.pos === 'FW').length;

      const oppSlots = FSD[oppCfg.form] || FSD['4-4-2'];
      const oppDF = oppSlots.filter(([sp]) => LINE[sp] === 'DF').length;
      const oppMF = oppSlots.filter(([sp]) => LINE[sp] === 'MF').length;
      const oppFW = oppSlots.filter(([sp]) => LINE[sp] === 'FW').length;

      const candidates = CLUB_PHILOSOPHIES.filter((ph) => ph.form !== curCfg.form);
      if (candidates.length) {
        let bestPh = candidates[0];
        let bestScore = -1e9;
        for (const ph of candidates) {
          const slots = FSD[ph.form] || FSD['4-4-2'];
          const needDF = slots.filter(([sp]) => LINE[sp] === 'DF').length;
          const needMF = slots.filter(([sp]) => LINE[sp] === 'MF').length;
          const needFW = slots.filter(([sp]) => LINE[sp] === 'FW').length;

          let score = 0;
          score -= Math.abs(needDF - avDF) * 2.2 + Math.abs(needMF - avMF) * 1.4 + Math.abs(needFW - avFW) * 2.1;

          // Match-up awareness vs opponent shape (e.g., pack midfield vs 3-MF/4-MF, wing width vs narrow back-3, anchor back-4/5 vs 2-3 FW)
          if (oppMF >= 4 && needMF >= 4) score += 1.6;
          if (oppFW >= 3 && needDF >= 4) score += 1.8;
          if (oppDF <= 3 && ph.wid >= 2) score += 1.5;

          if (scoreDiff < 0 || (scoreDiff === 0 && behindXg)) {
            if (ph.styleGroup === 'attack') score += 4.5;
            else if (ph.styleGroup === 'control') score += 2.6;
            else if (ph.styleGroup === 'counter') score -= 2.4;
            score += needFW * 1.6 - needDF * 0.9;
          } else if (scoreDiff >= 1 && (phase === 'late' || scoreDiff >= 2)) {
            if (ph.styleGroup === 'counter') score += 4.5;
            else if (ph.styleGroup === 'balanced') score += 2.4;
            else if (ph.styleGroup === 'attack') score -= 2.2;
            score += needDF * 1.5;
          } else {
            if (ph.styleGroup === 'control' || ph.styleGroup === 'balanced') score += 2.0;
          }

          if (myReds > 0) {
            if (needDF >= 4) score += 2.2;
            if (ph.styleGroup === 'counter' || ph.styleGroup === 'balanced') score += 2.4;
          }

          score += (Math.random() - 0.5) * 3.0;
          if (score > bestScore) {
            bestScore = score;
            bestPh = ph;
          }
        }

        let nextTac: Mentality = bestPh.tac;
        let nextPress = bestPh.press;
        let nextTempo = bestPh.tempo;
        let nextLine = bestPh.line;
        let nextPass = bestPh.pass;
        if (scoreDiff <= -2) {
          nextTac = 'X';
          nextPress = 2;
          nextTempo = 2;
          nextLine = 2;
        } else if (scoreDiff === -1 && phase !== 'early') {
          nextTac = bestPh.tac === 'D' || bestPh.tac === 'Z' ? 'A' : bestPh.tac === 'B' ? 'A' : bestPh.tac;
          nextPress = Math.max(nextPress, 1);
          nextLine = Math.max(nextLine, 1);
        } else if (scoreDiff >= 2 && phase === 'late') {
          nextTac = 'D';
          nextPress = 0;
          nextLine = 0;
          nextPass = Math.max(nextPass, 2);
        } else if (scoreDiff === 1 && phase === 'late') {
          nextTac = nextTac === 'X' || nextTac === 'A' ? 'B' : nextTac;
        }

        const nextCfg = {
          form: bestPh.form,
          cf: undefined,
          tac: nextTac,
          press: nextPress,
          tempo: nextTempo,
          line: nextLine,
          wid: bestPh.wid,
          pass: nextPass
        };
        const reasonTxt =
          scoreDiff < 0
            ? 'เปิดเกมรุกไล่ทวงประตูคืน'
            : myReds > 0
              ? 'จัดทรงใหม่หลังเหลือตัวผู้เล่นน้อยกว่า'
              : scoreDiff >= 1 && phase === 'late'
                ? 'เน้นรัดกุมรักษาสกอร์นำ'
                : behindXg
                  ? `ปรับทรงแก้เกมรับมือระบบ ${oppCfg.form}`
                  : 'ปรับสมดุลแก้เกมสู้แท็กติก';
        applyAiFormationSwitchForSide(w, side, bestPh, nextCfg, curMin, isInstant, reasonTxt);
        didSwitch = true;
      }
    }

    // Even without changing formation at halftime, tweak mentality if needed & send Player Mode HT coach order
    if (phase === 'ht' && !didSwitch) {
      if (scoreDiff <= -1) {
        curCfg.tac = curCfg.tac === 'D' || curCfg.tac === 'Z' ? 'B' : 'A';
        curCfg.press = Math.min(2, curCfg.press + 1);
        curCfg.line = Math.min(2, curCfg.line + 1);
      } else if (scoreDiff >= 2) {
        curCfg.tac = 'B';
        curCfg.press = Math.max(0, curCfg.press - 1);
      }
    }

    if (phase === 'ht' && isMyPlayerTeam && !isInstant) {
      const order = buildPlayerHtCoachOrder(w, side, scoreDiff, myReds, behindXg, didSwitch);
      setHalftimeCoachOrder(order);
      pushLog(45, `👔 คำสั่งโค้ชพักครึ่ง (${orig.name}): ${order.headline}`, 'sys');
    }
  };

  const handlePlayerVoiceToCoach = useCallback((topic: 'attack' | 'defend' | 'formation' | 'setpiece' | 'fitness') => {
    if (!isPlayerMode || doneRef.current) return;
    const w = worldRef.current;
    if (!w) return;
    const sr = simRef.current;
    const curMinVal = minuteRef.current;
    const curMin = Math.max(1, curMinVal);
    const meOnPitch = curMeOnPitch(w);
    if (!meOnPitch || sr.userSubOutMin != null || sr.sentOff.includes(myPlayerName)) {
      return;
    }
    if (coachChatCountRef.current >= 2) return;
    if (curMin < 10) return;
    if (curMinVal - coachChatCooldownRef.current < 20) return;

    const mySide: 'H' | 'A' = meIsHome ? 'H' : 'A';
    const oppSide: 'H' | 'A' = mySide === 'H' ? 'A' : 'H';
    const curCfg = aiCoachRef.current[mySide];
    const oppCfg = aiCoachRef.current[oppSide];
    const myScore = mySide === 'H' ? sr.gh : sr.ga;
    const oppScore = mySide === 'H' ? sr.ga : sr.gh;
    const scoreDiff = myScore - oppScore;
    const myXg = mySide === 'H' ? w.xgH : w.xgA;
    const oppXg = mySide === 'H' ? w.xgA : w.xgH;
    const myReds = w.agents.filter((a) => a.side === mySide && a.sentOff).length;
    const curLu = mySide === 'H' ? sr.homeLu : sr.awayLu;
    const meAg = w.agents.find((a) => a.id === myPlayerName && a.side === mySide);
    const myFit = Math.round(sr.liveFit[myPlayerName] ?? 100);
    const myRt = sr.liveForm[myPlayerName] ?? 6.5;
    const myYc = sr.yellows[myPlayerName] || 0;
    const isCap = (mySide === 'H' ? sr.captainH : sr.captainA) === myPlayerName;
    const teamAvgOv = meTeamOrig.sq.reduce((sum, q) => sum + q.ov, 0) / Math.max(1, meTeamOrig.sq.length);
    const trustMod =
      (isCap ? 0.18 : 0) +
      (myRt >= 7.5 ? 0.16 : myRt >= 7.0 ? 0.08 : myRt < 6.4 ? -0.25 : 0) +
      ((myPlayerSquadObj?.ov ?? 60) >= teamAvgOv + 4 ? 0.08 : -0.06) -
      coachDisagreeCountRef.current * 0.22;

    const adjustMeFit = (delta: number) => {
      if (!meAg) return;
      meAg.fit = clamp(meAg.fit + delta, 20, 100);
      sr.liveFit[meAg.id] = meAg.fit;
      setLiveFitMap({ ...sr.liveFit });
    };

    SFX.tap();
    coachChatCountRef.current += 1;
    setCoachChatCount(coachChatCountRef.current);
    coachChatCooldownRef.current = curMinVal;
    setCoachChatCooldownMin(curMinVal);

    let userMsg = '';
    let coachMsg = '';
    let effectSummary = '';
    let accepted = false;

    if (topic === 'attack') {
      userMsg = '🔥 เสนอโค้ชเปิดเกมรุกกดดันเพิ่ม';
      const baseChance =
        myReds > 0 && scoreDiff >= 0
          ? 0.12
          : scoreDiff >= 2
            ? 0.14
            : scoreDiff < 0
              ? 0.56
              : 0.36;
      const acceptProb = clamp(baseChance + trustMod, 0.05, 0.85);
      if (Math.random() < acceptProb) {
        accepted = true;
        curCfg.tac = curCfg.tac === 'Z' || curCfg.tac === 'D' ? 'B' : curCfg.tac === 'B' ? 'A' : 'X';
        curCfg.press = Math.min(2, curCfg.press + 1);
        curCfg.tempo = Math.min(2, curCfg.tempo + 1);
        curCfg.line = Math.min(2, curCfg.line + 1);
        if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, 0.14);
        adjustMeFit(-4);
        w.agents
          .filter((a) => a.side === mySide && !a.sentOff && a.id !== myPlayerName && a.pos !== 'GK')
          .forEach((a) => {
            a.fit = clamp(a.fit - 2, 20, 100);
            sr.liveFit[a.id] = a.fit;
          });
        setLiveFitMap({ ...sr.liveFit });
        coachMsg = `รับฟังข้อเสนอ! ขยับทีมบุกเป็น "${AR_T[curCfg.tac]}" ดันไลน์ไล่บีบ แต่ทุกคนต้องวิ่งหนักขึ้น!`;
        effectSummary = '✅ ข้อดี: เกมรุกดุดันขึ้น · ฟอร์ม +0.14 | ⚠️ ข้อเสีย: ฟิตคุณ -4% เพื่อนร่วมทีม -2% · เสี่ยงโดนสวนหลัง';
        triggerCoachShout(w, mySide, '🔥 ดันเกมรุกขึ้น!', 2.6);
        pushLog(curMin, `🗣️ คุณเสนอเปิดเกมรุก — โค้ชปรับเป็น "${AR_T[curCfg.tac]}" (เร่งเพรส/ใช้แรงหนักขึ้น)`, 'sys');
      } else {
        coachDisagreeCountRef.current += 1;
        if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, -0.12);
        coachMsg =
          myRt < 6.4
            ? 'โฟกัสฟอร์มตัวเองในสนามก่อน แท็กติกข้างสนามปล่อยให้โค้ชตัดสินใจเอง!'
            : scoreDiff >= 2
              ? 'เรานำห่างแล้ว ไม่จำเป็นต้องเสี่ยงเปิดหลัง รักษาวินัยตามแผนเดิม!'
              : myReds > 0
                ? 'ตัวผู้เล่นน้อยกว่า ขืนดันสูงมีหวังโดนสวนเละ เล่นตามแผนโค้ช!'
                : 'จังหวะยังไม่เหมาะจะเปิดหน้าแลก โค้ชขอคุมทรงตามแผนที่วางไว้!';
        effectSummary = '❌ โค้ชปฏิเสธ: ตำหนิวินัยแท็กติก (ฟอร์มคุณ -0.12)';
        triggerCoachShout(w, mySide, '✋ รักษาตำแหน่งไว้!', 2.2);
        pushLog(curMin, `🗣️ คุณขอเปิดเกมรุก — โค้ชปฏิเสธและสั่งให้ยึดแผนเดิม`, 'sys');
      }
    } else if (topic === 'defend') {
      userMsg = '🛡️ เสนอโค้ชเน้นรับคุมโซนรอโต้กลับ';
      const baseChance =
        scoreDiff < 0 && curMin >= 65
          ? 0.14
          : scoreDiff > 0 || myReds > 0 || oppXg - myXg >= 0.35
            ? 0.54
            : 0.34;
      const acceptProb = clamp(baseChance + trustMod, 0.05, 0.85);
      if (Math.random() < acceptProb) {
        accepted = true;
        curCfg.tac = curCfg.tac === 'X' || curCfg.tac === 'A' ? 'B' : 'D';
        curCfg.press = Math.max(0, curCfg.press - 1);
        curCfg.line = Math.max(0, curCfg.line - 1);
        curCfg.pass = 3;
        adjustMeFit(2);
        if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, -0.06);
        coachMsg = `โอเค! ถอยไลน์มาคุมโซน "${AR_T[curCfg.tac]}" ช่วยกันประหยัดแรงแล้วรอสวนกลับเร็ว!`;
        effectSummary = '✅ ข้อดี: เกมรับแน่นขึ้น · ฟิต +2% | ⚠️ ข้อเสีย: เกมรุกแผ่วลง บทบาทบุกลด (ฟอร์ม -0.06)';
        triggerCoachShout(w, mySide, '🛡️ คุมโซนแน่นๆ!', 2.6);
        pushLog(curMin, `🗣️ คุณเสนอเล่นรัดกุม — โค้ชถอยมาเน้น "${AR_T[curCfg.tac]}"`, 'sys');
      } else {
        coachDisagreeCountRef.current += 1;
        if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, -0.12);
        coachMsg =
          scoreDiff < 0
            ? 'เรายังตามหลังอยู่ จะถอยไปอุดไม่ได้ ต้องกล้าเล่นเกมรุกทวงประตูคืน!'
            : 'อย่าเพิ่งถอยรับลึกเกินจำเป็น รักษาจังหวะกดดันตามแผนโค้ชต่อ!';
        effectSummary = '❌ โค้ชปฏิเสธ: มองว่าใจไม่สู้ (ฟอร์มคุณ -0.12)';
        triggerCoachShout(w, mySide, '⚡ ห้ามถอยง่ายๆ!', 2.2);
        pushLog(curMin, `🗣️ คุณขอถอยคุมโซน — โค้ชไม่เห็นด้วยและสั่งลุยต่อ`, 'sys');
      }
    } else if (topic === 'formation') {
      userMsg = `🔀 เสนอโค้ชเปลี่ยนระบบแก้ทาง ${oppCfg.form}`;
      const activePlayers = curLu
        .map((n) => meTeamOrig.sq.find((q) => q.n === n))
        .filter((q): q is Player => Boolean(q))
        .filter((q) => q.pos !== 'GK' && !sr.sentOff.includes(q.n));
      const avDF = activePlayers.filter((p) => p.pos === 'DF').length;
      const avMF = activePlayers.filter((p) => p.pos === 'MF').length;
      const avFW = activePlayers.filter((p) => p.pos === 'FW').length;
      const cands = CLUB_PHILOSOPHIES.filter((ph) => ph.form !== curCfg.form);
      const baseChance =
        oppXg - myXg >= 0.45 || scoreDiff <= -2
          ? 0.42
          : scoreDiff < 0
            ? 0.30
            : 0.16;
      const acceptProb = clamp(baseChance + trustMod, 0.05, 0.72);

      if (cands.length && Math.random() < acceptProb) {
        let bestPh = cands[0];
        let bestSc = -1e9;
        for (const ph of cands) {
          const slots = FSD[ph.form] || FSD['4-4-2'];
          const nDF = slots.filter(([sp]) => LINE[sp] === 'DF').length;
          const nMF = slots.filter(([sp]) => LINE[sp] === 'MF').length;
          const nFW = slots.filter(([sp]) => LINE[sp] === 'FW').length;
          let sc = -(Math.abs(nDF - avDF) * 2.2 + Math.abs(nMF - avMF) * 1.4 + Math.abs(nFW - avFW) * 2.1);
          if (scoreDiff < 0) sc += nFW * 1.6 + (ph.styleGroup === 'attack' ? 3.5 : 0);
          else if (scoreDiff > 0) sc += nDF * 1.4 + (ph.styleGroup === 'counter' || ph.styleGroup === 'balanced' ? 2.5 : 0);
          else sc += ph.styleGroup === 'control' || ph.styleGroup === 'balanced' ? 2.2 : 1.0;
          sc += (Math.random() - 0.5) * 2.0;
          if (sc > bestSc) {
            bestSc = sc;
            bestPh = ph;
          }
        }
        accepted = true;
        const nextCfg = {
          form: bestPh.form,
          cf: undefined,
          tac: scoreDiff < 0 ? ('A' as Mentality) : scoreDiff > 0 && curMin >= 65 ? ('D' as Mentality) : bestPh.tac,
          press: bestPh.press,
          tempo: bestPh.tempo,
          line: bestPh.line,
          wid: bestPh.wid,
          pass: bestPh.pass
        };
        applyAiFormationSwitchForSide(w, mySide, bestPh, nextCfg, curMin, false, `ปรับแก้ทางแผน ${oppCfg.form} ตามความเห็นผู้เล่น`);
        if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, 0.16);
        adjustMeFit(-3);
        coachMsg = `ตกลง! ยอมเสี่ยงเปลี่ยนระบบเป็น ${bestPh.form} (${bestPh.name}) แก้ทาง ${oppCfg.form} ให้!`;
        effectSummary = `✅ ข้อดี: เปลี่ยนระบบเป็น ${bestPh.form} · ฟอร์ม +0.16 | ⚠️ ข้อเสีย: ปรับตัวกะทันหัน ฟิต -3%`;
      } else {
        coachDisagreeCountRef.current += 1;
        if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, -0.16);
        coachMsg = `การจัดระบบทีม ${curCfg.form} เป็นหน้าที่โค้ช อย่าก้าวก่ายแท็กติกกลางเกมแบบนี้!`;
        effectSummary = '❌ โค้ชไม่พอใจ: มองว่าก้าวก่ายการจัดแผน (ฟอร์มคุณ -0.16)';
        pushLog(curMin, `🗣️ คุณเสนอปรับระบบ — โค้ชปฏิเสธและตักเตือนเรื่องวินัยทีม`, 'sys');
      }
    } else if (topic === 'setpiece') {
      userMsg = '🎯 อาสายิงฟรีคิก / เตะมุม / จุดโทษ';
      if (!myPlayerSquadObj || myPlayerSquadObj.pos === 'GK') {
        coachDisagreeCountRef.current += 1;
        coachMsg = 'นายเป็นผู้รักษาประตู หน้าที่ลูกนิ่งปล่อยให้เพื่อนข้างหน้าจัดการ!';
        effectSummary = '❌ โค้ชปฏิเสธ: ผู้รักษาประตูไม่ได้รับมอบหมายลูกนิ่ง';
      } else {
        const spKinds: ('freekick' | 'corner' | 'penalty')[] = ['freekick', 'corner', 'penalty'];
        const granted: ('freekick' | 'corner' | 'penalty')[] = [];
        const onPitchObjs = curLu
          .filter((n) => !sr.sentOff.includes(n))
          .map((n) => meTeamOrig.sq.find((q) => q.n === n))
          .filter((q): q is Player => Boolean(q))
          .filter((q) => q.pos !== 'GK');
        spKinds.forEach((k) => {
          const mySpScore = scoreSetPieceCandidate(myPlayerSquadObj, k, state.p);
          const curName = liveSetPiecesRef.current[k];
          const curHolder = curName ? onPitchObjs.find((q) => q.n === curName) : undefined;
          const bestOtherScore = onPitchObjs
            .filter((q) => q.n !== myPlayerName)
            .reduce((mx, q) => Math.max(mx, scoreSetPieceCandidate(q, k, state.p)), 0);
          const curScore = curHolder ? scoreSetPieceCandidate(curHolder, k, state.p) : bestOtherScore;
          const formBonus = myRt >= 7.4 ? 8 : myRt >= 6.9 ? 3 : myRt < 6.5 ? -8 : 0;
          const capBonus = isCap ? 5 : 0;
          if (curName === myPlayerName || mySpScore + formBonus + capBonus >= curScore) {
            liveSetPiecesRef.current = { ...liveSetPiecesRef.current, [k]: myPlayerName };
            granted.push(k);
          }
        });
        if (granted.length > 0) {
          accepted = true;
          setLiveSetPiecesUi({ ...liveSetPiecesRef.current });
          adjustMeFit(-2);
          const thLabels = granted.map((k) => (k === 'corner' ? 'เตะมุม' : k === 'freekick' ? 'ฟรีคิก' : 'จุดโทษ')).join(', ');
          coachMsg = `ได้เลย! แต่นับจากนี้ ${thLabels} ต้องหวังผลให้ได้นะ ความรับผิดชอบอยู่ที่นายแล้ว!`;
          effectSummary = `✅ ข้อดี: ได้รับสิทธิ์ยิง ${thLabels} | ⚠️ ข้อเสีย: ความกดดันสูง ฟิต -2%`;
          triggerCoachShout(w, mySide, '🎯 ลูกนิ่งให้นายเลย!', 2.4);
          pushLog(curMin, `🎯 โค้ช ${meTeamOrig.name} มอบหน้าที่ลูกนิ่ง (${thLabels}) ให้ ${myPlayerName}`, 'sys');
        } else {
          coachDisagreeCountRef.current += 1;
          if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, -0.10);
          coachMsg = 'มือสังหารเดิมยังนิ่งและแม่นกว่า กลับไปทำหน้าที่ของตัวเองในสนามก่อน!';
          effectSummary = '❌ โค้ชปฏิเสธ: ยังเชื่อใจคนยิงเดิม (ฟอร์มคุณ -0.10)';
          pushLog(curMin, `🗣️ คุณอาสายิงลูกนิ่ง — โค้ชปฏิเสธและให้มือสังหารเดิมรับหน้าที่ต่อ`, 'sys');
        }
      }
    } else {
      userMsg = '💬 รายงานสภาพฟิต / เช็กจังหวะเกมกับโค้ช';
      accepted = true;
      if (myFit < 58) {
        const isHomeSide = mySide === 'H';
        const subsCount = isHomeSide ? sr.homeSubsCount : sr.awaySubsCount;
        const curPlayed = isHomeSide ? sr.homePlayed : sr.awayPlayed;
        const benchCands = meTeamOrig.sq
          .filter((q) => !curPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n) && q.pos !== 'GK')
          .sort((a, b) => b.ov - a.ov);
        const subReplace = subsCount < 5 ? (benchCands.find((b) => b.pos === myPlayerSquadObj?.pos) || benchCands[0]) : undefined;
        if (subReplace && Math.random() < 0.55) {
          const outIdx = curLu.indexOf(myPlayerName);
          if (outIdx >= 0) {
            curLu[outIdx] = subReplace.n;
            if (!curPlayed.includes(subReplace.n)) curPlayed.push(subReplace.n);
            if (sr.liveForm[subReplace.n] == null) sr.liveForm[subReplace.n] = 6.5;
            if (isHomeSide) sr.homeSubsCount++;
            else sr.awaySubsCount++;
            sr.userSubOutMin = curMin;
            const subEv: MatchSubEvent = { m: curMin, t: meTeamOrig.id, inPlayer: subReplace.n, outPlayer: myPlayerName };
            sr.subs.push(subEv);
            const agIdx = w.agents.findIndex((a) => a.id === myPlayerName);
            let subbedAg: LivePitchAgent | undefined;
            if (agIdx >= 0) {
              const effSideTeam = isHomeSide ? getLiveHomeTeam() : getLiveAwayTeam();
              const rep = buildTeamAgents(effSideTeam, mySide, curLu, w.secondHalf);
              if (rep[outIdx]) {
                rep[outIdx].x = w.agents[agIdx].x;
                rep[outIdx].y = w.agents[agIdx].y;
                rep[outIdx].facing = w.agents[agIdx].facing;
                w.agents[agIdx] = rep[outIdx];
                subbedAg = rep[outIdx];
              }
            }
            if (w.ball.carrierId === myPlayerName) w.ball.carrierId = subReplace.n;
            if (w.ball.targetId === myPlayerName) w.ball.targetId = subReplace.n;
            triggerSubPitchAnim(w, subbedAg, mySide, meTeamOrig.name, subReplace.n, myPlayerName, curMin);
            setLiveLu((meIsHome ? sr.homeLu : sr.awayLu).slice());
            setLiveOppLu((meIsHome ? sr.awayLu : sr.homeLu).slice());
            setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
            setSubLog(sr.subs.slice());
            syncSidelineBenches(w);
            ensureOnPitchCaptain(w, mySide, curMin, 'sub', false);
            lastUserPitchStatusRef.current = 'subbed_out';
            setUserPitchStatus('subbed_out');
            coachMsg = `แรงหมดแล้ว (${myFit}%) โค้ชตัดสินใจเปลี่ยน ${subReplace.n} ลงแทนเพื่อเซฟร่างกายคุณ!`;
            effectSummary = `⚠️ โค้ชถอดคุณออกพัก (น.${curMin}') และส่ง ${subReplace.n} ลงเล่นแทน`;
            triggerCoachShout(w, mySide, '🔄 เปลี่ยนพัก!', 2.4);
            pushTimeline(curMin, mySide, 'sub', subReplace.n, myPlayerName);
            pushLog(curMin, `🔄 เปลี่ยนตัว (${meTeamOrig.name}): 🔼 เข้า ${subReplace.n} · 🔽 ออก ${myPlayerName}`, 'sub', {
              subInfo: { teamId: meTeamOrig.id, inName: subReplace.n, outName: myPlayerName, badge: '💬 พักอาการล้า', isMeOut: true }
            });
          }
        } else {
          adjustMeFit(2);
          if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, -0.06);
          coachMsg = `รับทราบว่าแรงเริ่มตก (${myFit}%) ผ่อนจังหวะวิ่งลงหน่อย แต่ต้องประคองตำแหน่งให้ดี`;
          effectSummary = '✅ ข้อดี: ฟื้นแรง +2% | ⚠️ ข้อเสีย: ลดความดุดันเกมรับ-รุก (ฟอร์ม -0.06)';
          pushLog(curMin, `💬 คุณแจ้งโค้ชเรื่องสภาพฟิต — โค้ชสั่งผ่อนจังหวะการเล่น`, 'sys');
        }
      } else if (myYc >= 1) {
        if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, 0.06);
        adjustMeFit(-2);
        coachMsg = `นายมีใบเหลืองติดตัว (⭐ ${myRt.toFixed(1)}) เล่นให้ละเอียด อย่าเข้าสกัดพรวดพลาด`;
        effectSummary = '✅ ข้อดี: ตั้งสติคุมจังหวะ (ฟอร์ม +0.06) | ⚠️ ข้อเสีย: วิ่งข้างสนามเสียแรง -2%';
        pushLog(curMin, `💬 คุณปรึกษาโค้ชเรื่องจังหวะเข้าบอลหลังโดนใบเหลือง`, 'sys');
      } else {
        if (meAg && !meAg.sentOff) adjustLiveForm(meAg.id, 0.10);
        adjustMeFit(-2);
        coachMsg = `สภาพร่างกายยังดี (${myFit}%) รักษาความมุ่งมั่นและช่วยเพื่อนคุมพื้นที่ต่อไป!`;
        effectSummary = '✅ ข้อดี: กระตุ้นความมั่นใจ (ฟอร์ม +0.10) | ⚠️ ข้อเสีย: วิ่งมาคุยข้างสนามเสียแรง -2%';
        pushLog(curMin, `💬 คุณรายงานจังหวะเกมกับโค้ช — โค้ชให้กำลังใจลุยต่อ`, 'sys');
      }
    }

    setCoachChatReplies((prev) =>
      [{ id: Date.now() + Math.floor(Math.random() * 1000), m: curMin, userMsg, coachMsg, accepted, effectSummary }, ...prev].slice(0, 12)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayerMode, meIsHome, myPlayerName, meTeamOrig, myPlayerSquadObj, state.p]);

  const liveHome = useMemo<Team>(
    () => {
      const isUserMgr = state.mode === 'm' && meIsHome;
      const aiH = aiCoachRef.current.H;
      return {
        ...homeOrig,
        cap: liveCaptains.H || homeOrig.cap,
        setPieces: meIsHome ? liveSetPiecesUi : homeOrig.setPieces,
        form: isUserMgr ? homeOrig.form : aiFormDisplay.H,
        cf: isUserMgr ? homeOrig.cf : aiH.cf,
        tac: isUserMgr ? liveTac : aiH.tac,
        press: isUserMgr ? livePress : aiH.press,
        tempo: isUserMgr ? liveTempo : aiH.tempo,
        line: isUserMgr ? liveLine : aiH.line,
        wid: isUserMgr ? liveWid : aiH.wid,
        pass: isUserMgr ? livePass : aiH.pass,
        lu: simRef.current.homeLu
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homeOrig, meIsHome, state.mode, liveTac, livePress, liveTempo, liveLine, liveWid, livePass, liveLu, subLog.length, aiFormDisplay.H, liveCaptains.H, liveSetPiecesUi]
  );

  const liveAway = useMemo<Team>(
    () => {
      const isUserMgr = state.mode === 'm' && !meIsHome;
      const aiA = aiCoachRef.current.A;
      return {
        ...awayOrig,
        cap: liveCaptains.A || awayOrig.cap,
        setPieces: !meIsHome ? liveSetPiecesUi : awayOrig.setPieces,
        form: isUserMgr ? awayOrig.form : aiFormDisplay.A,
        cf: isUserMgr ? awayOrig.cf : aiA.cf,
        tac: isUserMgr ? liveTac : aiA.tac,
        press: isUserMgr ? livePress : aiA.press,
        tempo: isUserMgr ? liveTempo : aiA.tempo,
        line: isUserMgr ? liveLine : aiA.line,
        wid: isUserMgr ? liveWid : aiA.wid,
        pass: isUserMgr ? livePass : aiA.pass,
        lu: simRef.current.awayLu
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [awayOrig, meIsHome, state.mode, liveTac, livePress, liveTempo, liveLine, liveWid, livePass, liveLu, subLog.length, aiFormDisplay.A, liveCaptains.A, liveSetPiecesUi]
  );

  useEffect(() => {
    unlockAudio();
    SFX.whistle();
    setCrowdAudio(true);
    return () => setCrowdAudio(false);
  }, []);

  const findMatchPlayerMeta = (name?: string | null) => {
    if (!name) return undefined;
    const pObj = playerByNameMap.get(name.trim());
    return pObj ? { pos: pObj.pos, role: pObj.ro } : undefined;
  };

  const pushStreamComment = (
    m: number,
    cKind: LiveCommentKind,
    opts?: { actor?: string; assist?: string; gkName?: string; viewerBoost?: number; burst?: number }
  ) => {
    let nextV = liveViewersRef.current;
    if (opts?.viewerBoost) {
      nextV = Math.max(250, Math.round(nextV + opts.viewerBoost));
      liveViewersRef.current = nextV;
      if (!isSkippingRef.current) setLiveViewers(nextV);
      if (nextV > peakViewersRef.current) {
        peakViewersRef.current = nextV;
        if (!isSkippingRef.current) setPeakViewers(nextV);
      }
    }
    if (isSkippingRef.current && cKind !== 'goal' && cKind !== 'concede' && cKind !== 'card' && cKind !== 'var' && cKind !== 'fulltime') {
      return;
    }
    const actorMeta = findMatchPlayerMeta(opts?.actor);
    const count = isSkippingRef.current ? 1 : opts?.burst ?? (getStreamViewerTier(nextV) === 'viral' ? 2 : 1);
    const created: LiveCommentItem[] = [];
    for (let i = 0; i < count; i++) {
      const nextItem = generateLiveStreamComment({
        m,
        viewers: nextV,
        kind: cKind,
        homeName: homeOrig.name,
        awayName: awayOrig.name,
        myTeamName: meTeamOrig.name,
        oppTeamName: oppTeamOrig.name,
        channelName: broadcastChannel.name,
        actor: opts?.actor,
        actorPos: actorMeta?.pos,
        actorRole: actorMeta?.role,
        assist: opts?.assist,
        gkName: opts?.gkName,
        gh: simRef.current.gh,
        ga: simRef.current.ga,
        playerModeName: isPlayerMode ? myPlayerName : undefined,
        playerModeNo: isPlayerMode && myPlayerSquadObj ? getShirtNo(meTeamOrig, myPlayerSquadObj) : null,
        playerModePos: isPlayerMode ? myPlayerSquadObj?.pos || state.p?.pos : undefined,
        playerModeRole: isPlayerMode ? myPlayerSquadObj?.ro || state.p?.sp : undefined,
        usedTexts: usedStreamTextsRef.current
      });
      if (nextItem) created.push(nextItem);
    }
    if (created.length > 0) {
      if (isSkippingRef.current && skipCommentsRef.current) {
        skipCommentsRef.current.unshift(...created);
        if (skipCommentsRef.current.length > 50) skipCommentsRef.current.length = 50;
      } else {
        setLiveComments((prev) => [...created, ...prev].slice(0, 50));
      }
    }
  };

  const pushLog = (
    m: number,
    text: string,
    tone?: 'goal' | 'card' | 'sys' | 'sub',
    opts?: string | { varReplayId?: string; subInfo?: MatchSubLogInfo }
  ) => {
    const varReplayId = typeof opts === 'string' ? opts : opts?.varReplayId;
    const subInfo = typeof opts === 'object' ? opts?.subInfo : undefined;
    const logId = logSeqRef.current++;
    const logEntry: MatchLogItem = { id: logId, m, text, tone, varReplayId, subInfo };
    if (isSkippingRef.current && skipLogsRef.current) {
      skipLogsRef.current.unshift(logEntry);
      if (skipLogsRef.current.length > 65) skipLogsRef.current.length = 65;
      const baseSurge = Math.max(40, Math.round(streamProj.baseViewers * 0.05));
      if (tone === 'goal') {
        const isMyGoal = text.includes(meTeamOrig.name);
        const actorMatch = text.match(/([ก-ฮA-Za-z0-9._-]+)\s*(?:\(|!|ซัด|โหม่ง|ยิง|ปั่น)/);
        pushStreamComment(m, isMyGoal ? 'goal' : 'concede', {
          actor: actorMatch?.[1],
          viewerBoost: baseSurge * 1.6,
          burst: 1
        });
      } else if (tone === 'card') {
        if (text.includes('VAR')) {
          pushStreamComment(m, 'var', { viewerBoost: baseSurge });
        } else {
          const cardMatch = text.match(/!\s*([^\s(]+)/);
          pushStreamComment(m, 'card', { actor: cardMatch?.[1], viewerBoost: Math.round(baseSurge * 0.6) });
        }
      }
      return;
    }
    setLogs((prev) => [logEntry, ...prev].slice(0, 65));
    const vTier = getStreamViewerTier(liveViewersRef.current);
    const baseSurge = Math.max(40, Math.round(streamProj.baseViewers * 0.05));
    const findNamedInLog = (exclude?: string) =>
      matchVisualIndex.byFullLen.find((e) => e.player.n && e.player.n !== exclude && text.includes(e.player.n))?.player;
    if (tone === 'goal') {
      const isMyGoal = text.includes(meTeamOrig.name);
      const actorObj = findNamedInLog();
      const actorMatch = text.match(/([ก-ฮA-Za-z0-9._-]+)\s*(?:\(|!|ซัด|โหม่ง|ยิง|ปั่น)/);
      pushStreamComment(m, isMyGoal ? 'goal' : 'concede', {
        actor: actorObj?.n || actorMatch?.[1],
        viewerBoost: baseSurge * 1.6,
        burst: vTier === 'viral' ? 3 : vTier === 'high' ? 2 : Math.random() < 0.45 ? 2 : 1
      });
    } else if (tone === 'card') {
      if (text.includes('VAR')) {
        pushStreamComment(m, 'var', { viewerBoost: baseSurge });
      } else {
        const cardObj = findNamedInLog();
        const cardMatch = text.match(/!\s*([^\s(]+)/);
        pushStreamComment(m, 'card', { actor: cardObj?.n || cardMatch?.[1], viewerBoost: Math.round(baseSurge * 0.6) });
      }
    } else if (tone === 'sub') {
      const inMatch = text.match(/(?:🔼\s*เข้า|🔼|🟢)\s*([^\s(·]+)/);
      const subActorName = subInfo?.inName || inMatch?.[1];
      const subObj = subActorName
        ? playerByNameMap.get(subActorName) || [...homeOrig.sq, ...awayOrig.sq].find((q) => text.includes(q.n))
        : undefined;
      if (vTier !== 'low' || Math.random() < 0.6) {
        pushStreamComment(m, 'sub', { actor: subObj?.n || subActorName });
      }
    } else if (text.includes('เซฟ') || text.includes('ปัด')) {
      if (Math.random() < (vTier === 'low' ? 0.55 : 0.85)) {
        const gkObj =
          homeOrig.sq.find((q) => q.pos === 'GK' && text.includes(q.n)) ||
          awayOrig.sq.find((q) => q.pos === 'GK' && text.includes(q.n));
        pushStreamComment(m, 'save', {
          actor: gkObj?.n,
          gkName: gkObj?.n,
          viewerBoost: Math.round(baseSurge * 0.45),
          burst: vTier === 'viral' || (vTier === 'high' && Math.random() < 0.5) ? 2 : 1
        });
      }
    } else if (text.includes('VAR')) {
      pushStreamComment(m, 'var', { viewerBoost: Math.round(baseSurge * 0.8) });
    } else if (text.includes('หลุดกรอบ') || text.includes('เฉียดเสา') || text.includes('เตะวืด')) {
      if (Math.random() < (vTier === 'low' ? 0.35 : 0.7)) {
        const missObj =
          homeOrig.sq.find((q) => text.includes(q.n)) ||
          awayOrig.sq.find((q) => text.includes(q.n));
        pushStreamComment(m, 'miss', { actor: missObj?.n });
      }
    }
  };

  const addWorldFx = (w: LiveMatchWorld, fx: Omit<LivePitchFx, 'id'>) => {
    if (isSkippingRef.current) return;
    w.fx.push({ ...fx, id: w.nextFxId++ });
    if (w.fx.length > 8) w.fx.shift();
  };

  const triggerSubPitchAnim = (
    w: LiveMatchWorld,
    ag: LivePitchAgent | undefined,
    side: 'H' | 'A',
    teamName: string,
    inName: string,
    outName: string,
    curMin: number
  ) => {
    if (isSkippingRef.current) return;
    if (ag) {
      ag.subEnterTimer = 2.4;
      ag.subEnterMax = 2.4;
      addWorldFx(w, {
        type: 'sub',
        x: ag.x,
        y: ag.y,
        label: `🔄 ${inName.split(' ')[0]} ⇄ ${outName.split(' ')[0]}`,
        color: '#10b981',
        ttl: 2.3,
        maxTtl: 2.3
      });
    }
    if (subFlashTimerRef.current) window.clearTimeout(subFlashTimerRef.current);
    setSubFlashInfo({
      side,
      teamName,
      inName,
      outName,
      minute: curMin,
      key: Date.now() + Math.random()
    });
    subFlashTimerRef.current = window.setTimeout(() => {
      setSubFlashInfo(null);
    }, 2600);
  };

  const adjustLiveForm = (playerName: string | null | undefined, delta: number) => {
    if (!playerName) return;
    const sr = simRef.current;
    const cur = sr.liveForm[playerName] ?? 6.5;
    sr.liveForm[playerName] = clamp(Math.round((cur + delta) * 10) / 10, 4.5, 10.0);
  };

  const bumpPlayerStat = (
    playerName: string | null | undefined,
    key: keyof LivePlayerMatchStats,
    amt = 1
  ) => {
    if (!playerName) return;
    const ps = simRef.current.playerStats;
    const cur = ps[playerName] || { shots: 0, onTarget: 0, passes: 0, tackles: 0, saves: 0, blocks: 0 };
    cur[key] = (cur[key] || 0) + amt;
    ps[playerName] = cur;
  };

  const pushTimeline = (
    m: number,
    side: 'H' | 'A' | 'N',
    kind: TimelineKind,
    who: string,
    detail?: string,
    varReplayId?: string
  ) => {
    const sr = simRef.current;
    const tl = sr.timeline;
    if (
      (kind === 'kickoff' || kind === 'first_half' || kind === 'second_half' || kind === 'full_time') &&
      tl.some((t) => t.kind === kind)
    ) {
      return;
    }
    let inheritedVarId: string | undefined;
    if ((kind === 'pen_goal' || kind === 'pen_miss') && tl.length > 0) {
      for (let i = tl.length - 1; i >= 0; i--) {
        if (tl[i].side === side && tl[i].kind === 'pen_awarded' && Math.abs(m - tl[i].m) <= 2) {
          inheritedVarId = tl[i].varReplayId;
          tl.splice(i, 1);
          break;
        }
      }
    }
    sr.timelineSeq += 1;
    const item: MatchTimelineItem = {
      id: `${m}-${side}-${kind}-${sr.timelineSeq}-${Math.random().toString(36).slice(2, 6)}`,
      seq: sr.timelineSeq,
      m,
      side,
      kind,
      who,
      detail,
      varReplayId: varReplayId ?? inheritedVarId
    };
    tl.push(item);
    if (!isSkippingRef.current) setTimelineEvents(tl.slice());
  };

  const triggerDramaSlow = (w: LiveMatchWorld, sec: number, label: string) => {
    if (isSkippingRef.current) return;
    w.dramaSlowSec = Math.max(w.dramaSlowSec, sec);
    w.dramaLabel = label;
  };

  const agentHasTrait = (ag: LivePitchAgent | null | undefined, traitId: string) => Boolean(ag?.traits?.includes(traitId));

  const issueCard = (
    culprit: LivePitchAgent,
    curMin: number,
    directRedBias = 0.015,
    forceType?: 'Y' | 'R',
    silentLog = false,
    reasonLabel?: string,
    varReplayId?: string,
    hlMeta?: {
      victimName?: string;
      varVerdict?: 'red';
      varReasonText?: string;
      preOverride?: RollingHighlightSample[] | null;
    }
  ) => {
    const sr = simRef.current;
    const w = worldRef.current;
    const team = culprit.side === 'H' ? homeOrig : awayOrig;
    const kit = culprit.side === 'H' ? homeKit : awayKit;
    const isVolatilePers = culprit.tr === 1 || culprit.tr === 7 || culprit.tr === 15 || culprit.tr === 22;
    const persCardBias = isVolatilePers ? 0.025 : culprit.tr === 0 || culprit.tr === 6 || culprit.tr === 21 || culprit.tr === 23 ? -0.01 : 0;
    const teamRedCount = sr.cards.filter((c) => c.t === team.id && (c.type === 'R' || c.type === 'Y2R')).length;
    const effectiveRedProb = directRedBias <= 0
      ? 0
      : clamp(directRedBias + persCardBias, 0.004, 0.95);
    const directRed =
      forceType === 'R'
        ? true
        : forceType === 'Y' || teamRedCount >= 2 || directRedBias <= 0
          ? false
          : Math.random() < effectiveRedProb;
    const cardReason = reasonLabel || (directRed ? 'เข้าสกัดเปิดปุ่มอันตราย' : 'เข้าสกัดหนัก');
    SFX.card();
    SFX.boo(directRed || (sr.yellows[culprit.id] || 0) >= 1 ? 0.95 : 0.72);
    if (directRed) {
      culprit.sentOff = true;
      sr.sentOff.push(culprit.id);
      adjustLiveForm(culprit.id, -0.7);
      sr.cards.push({ m: curMin, t: team.id, who: culprit.id, type: 'R', ...(reasonLabel ? { reason: reasonLabel } : {}) });
      if (!isSkippingRef.current) setMatchCards(sr.cards.slice());
      if (isPlayerMode && culprit.id === myPlayerName) sr.userSentOffMin = curMin;
      if (!silentLog) {
        pushLog(curMin, `🟥 ใบแดงโดยตรง!! ${culprit.id} (${team.name}) ${cardReason} โดนไล่ออก (แบน 2 นัด)`, 'card');
      }
      pushTimeline(curMin, culprit.side, 'red', culprit.id, reasonLabel || 'ใบแดงโดยตรง', varReplayId);
      if (!isSkippingRef.current) setSentOff(sr.sentOff.slice());
      if (w && !isSkippingRef.current) {
        w.cardBanner = { who: culprit.id, shortName: culprit.shortName, teamName: team.name, type: 'R', kit, ttl: 3.4, maxTtl: 3.4 };
        triggerDramaSlow(w, 2.5, `🟥 ใบแดง!! ${culprit.shortName}`);
        triggerCoachMood(w, culprit.side, '🤬', 2.8);
        triggerCoachMood(w, culprit.side === 'H' ? 'A' : 'H', '😮', 2.4);
      }
      if (w) {
        recordEventHighlight(w, curMin, {
          kind: 'red_card',
          side: culprit.side,
          attRight: culprit.x >= 50,
          actorName: culprit.id,
          victimName: hlMeta?.victimName,
          finishVerb: cardReason,
          cardType: 'R',
          varVerdict: hlMeta?.varVerdict,
          varReasonText: hlMeta?.varReasonText,
          dramaFloor: hlMeta?.varVerdict === 'red' ? 94 : 90,
          preOverride: hlMeta?.preOverride
        });
      }
      ensureOnPitchCaptain(w, culprit.side, curMin, 'red', silentLog);
      return 'R' as const;
    }
    sr.yellows[culprit.id] = (sr.yellows[culprit.id] || 0) + 1;
    culprit.hasYellow = true;
    if (!isSkippingRef.current) setMatchYellows({ ...sr.yellows });
    if (sr.yellows[culprit.id] >= 2) {
      culprit.sentOff = true;
      sr.sentOff.push(culprit.id);
      adjustLiveForm(culprit.id, -0.65);
      sr.cards.push({ m: curMin, t: team.id, who: culprit.id, type: 'Y2R', ...(reasonLabel ? { reason: reasonLabel } : {}) });
      if (!isSkippingRef.current) setMatchCards(sr.cards.slice());
      if (isPlayerMode && culprit.id === myPlayerName) sr.userSentOffMin = curMin;
      if (!silentLog) {
        pushLog(curMin, `🟨➡🟥 ใบแดง! ${culprit.id} (${team.name}) ${cardReason} · โดนเหลืองที่สองไล่ออก (แบน 1 นัด)`, 'card');
      }
      pushTimeline(curMin, culprit.side, 'yellow2red', culprit.id, reasonLabel ? `เหลืองสอง (${reasonLabel})` : 'เหลืองที่สอง', varReplayId);
      if (!isSkippingRef.current) setSentOff(sr.sentOff.slice());
      if (w && !isSkippingRef.current) {
        w.cardBanner = { who: culprit.id, shortName: culprit.shortName, teamName: team.name, type: 'Y2R', kit, ttl: 3.4, maxTtl: 3.4 };
        triggerDramaSlow(w, 2.5, `🟨➡🟥 เหลืองที่สอง!! ${culprit.shortName}`);
        triggerCoachMood(w, culprit.side, '🤦', 2.7);
        triggerCoachMood(w, culprit.side === 'H' ? 'A' : 'H', '😤', 2.3);
      }
      if (w) {
        recordEventHighlight(w, curMin, {
          kind: 'red_card',
          side: culprit.side,
          attRight: culprit.x >= 50,
          actorName: culprit.id,
          victimName: hlMeta?.victimName,
          finishVerb: `${cardReason} · โดนใบเหลืองที่สองไล่ออก`,
          cardType: 'Y2R',
          varVerdict: hlMeta?.varVerdict,
          varReasonText: hlMeta?.varReasonText,
          dramaFloor: hlMeta?.varVerdict === 'red' ? 92 : 87,
          preOverride: hlMeta?.preOverride
        });
      }
      ensureOnPitchCaptain(w, culprit.side, curMin, 'red', silentLog);
      return 'Y2R' as const;
    }
    adjustLiveForm(culprit.id, -0.35);
    const origPl = playerByNameMap.get(culprit.id) || team.sq.find((q) => q.n === culprit.id);
    const totalSeasonY = (origPl?.yc || 0) + 1;
    sr.cards.push({ m: curMin, t: team.id, who: culprit.id, type: 'Y', ...(reasonLabel ? { reason: reasonLabel } : {}) });
    if (!isSkippingRef.current) setMatchCards(sr.cards.slice());
    if (!silentLog) {
      pushLog(
        curMin,
        `🟨 ใบเหลือง! ${culprit.id} (${team.name}) ${cardReason}${totalSeasonY >= 3 ? ' (ครบ 3 ใบ แบนนัดหน้า!)' : ` (สะสม ${totalSeasonY}/3)`}`,
        'card'
      );
    }
    pushTimeline(curMin, culprit.side, 'yellow', culprit.id, totalSeasonY >= 3 ? 'ครบ 3 ใบแบน' : reasonLabel, varReplayId);
    if (w && !isSkippingRef.current) {
      w.cardBanner = { who: culprit.id, shortName: culprit.shortName, teamName: team.name, type: 'Y', kit, ttl: 2.6, maxTtl: 2.6 };
      triggerDramaSlow(w, 1.5, `🟨 ใบเหลือง · ${culprit.shortName}`);
      triggerCoachMood(w, culprit.side, '😬', 2.1);
      triggerCoachMood(w, culprit.side === 'H' ? 'A' : 'H', '😡', 2.1);
    }
    return 'Y' as const;
  };

  const isAttackRight = (w: LiveMatchWorld, side: 'H' | 'A') => (side === 'H') !== w.secondHalf;

  const tryTriggerInMatchInjury = (
    w: LiveMatchWorld,
    victim: LivePitchAgent,
    curMin: number,
    severity: 'foul' | 'slide' | 'clash' | 'fatigue',
    isInstantStep = false,
    tacklerName?: string
  ) => {
    const sr = simRef.current;
    if (!victim || victim.sentOff || victim.pos === 'GK' || victim.injuredOut) return false;
    if (w.inMatchInjuryCount >= 2 || sr.injuredNames.includes(victim.id)) return false;

    const sideOrig = victim.side === 'H' ? homeOrig : awayOrig;
    const isMySide = sideOrig.id === state.me;
    const pl = sideOrig.sq.find((q) => q.n === victim.id);
    if (!pl) return false;
    const D = DT(pl, state.p);
    const curFit = sr.liveFit[victim.id] ?? victim.fit ?? 100;
    const victimFacMods = getSideFacMods(victim.side);
    const physioLv = isMySide ? (state.staff?.physio ?? 0) : 0;
    const medMult = clamp(
      victimFacMods.injuryRiskMult * turfMatchMods.injuryMult * (1 - physioLv * 0.05) * (isMySide && state.tf === 'F' ? 0.55 : 1),
      0.35,
      1.5
    );
    const tolMult = clamp((132 - (D.d.tol || 65)) / 65, 0.55, 1.45);
    const fitMult = curFit < 54 ? 1.8 : curFit < 65 ? 1.25 : 0.85;
    const persInjMult = victim.tr === 19 ? 1.38 : victim.tr === 18 || victim.tr === 23 ? 0.8 : 1;
    const baseProb = severity === 'foul' ? 0.055 : severity === 'slide' ? 0.038 : severity === 'clash' ? 0.028 : 0.0055;
    if (Math.random() >= baseProb * medMult * tolMult * fitMult * persInjMult) return false;

    const rawGames = severity === 'foul' ? R(2, 4) : R(1, 3);
    const games = injD(pl, rawGames, state.p);
    w.inMatchInjuryCount++;
    sr.injuredNames.push(victim.id);
    sr.injuries.push({ teamId: sideOrig.id, name: victim.id, games });
    if (!isSkippingRef.current) setInjuredNamesUi(sr.injuredNames.slice());
    victim.injuredOut = true;

    addWorldFx(w, {
      type: 'injury',
      x: victim.x,
      y: victim.y,
      label: `✚ ${victim.shortName} เจ็บ! (${games} นัด)`,
      color: '#ef4444',
      ttl: 2.8,
      maxTtl: 2.8
    });
    pushLog(curMin, `✚ บาดเจ็บในสนาม!! ${victim.id} (${sideOrig.name}) เจ็บระหว่างเล่น · คาดพัก ${games} นัด`, 'card');
    pushTimeline(curMin, victim.side, 'injury', victim.id, `พัก ${games} นัด`);
    recordEventHighlight(w, curMin, {
      kind: 'injury',
      side: victim.side,
      attRight: victim.x >= 50,
      actorName: victim.id,
      victimName: tacklerName,
      finishVerb: severity === 'fatigue' ? 'กล้ามเนื้อล้าจนเล่นต่อไม่ไหว' : 'ปะทะหนักจนบาดเจ็บต้องเปลี่ยนตัว',
      injuryGames: games,
      dramaFloor: 74
    });

    const isHomeSide = victim.side === 'H';
    const curLu = isHomeSide ? sr.homeLu : sr.awayLu;
    const curPlayed = isHomeSide ? sr.homePlayed : sr.awayPlayed;
    const subsCount = isHomeSide ? sr.homeSubsCount : sr.awaySubsCount;

    if (isPlayerMode && victim.id === myPlayerName) {
      sr.userSubOutMin = curMin;
    }

    if (state.mode === 'm' && isMySide) {
      if (subsCount < 5 && !isInstantStep) {
        w.phaseLabel = `✚ ด่วน! ${victim.shortName} บาดเจ็บ ต้องเปลี่ยนตัวออก!`;
        w.phaseTone = 'danger';
        triggerDramaSlow(w, 1.8, `✚ ${victim.shortName} บาดเจ็บ!`);
        setInjuryAlert({
          name: victim.id,
          role: pl.ro,
          no: getShirtNo(sideOrig, pl),
          games,
          minute: curMin
        });
        openTacticsStudio(victim.id);
        vibrate(55);
      } else if (subsCount < 5) {
        // Instant skip mode auto-sub
        const bench = sideOrig.sq
          .filter((q) => !curPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n) && q.pos !== 'GK')
          .sort((a, b) => (b.pos === pl.pos ? 1 : 0) - (a.pos === pl.pos ? 1 : 0) || b.ov - a.ov);
        const subIn = bench.find((b) => b.pos === pl.pos) || bench[0];
        const idx = curLu.indexOf(victim.id);
        if (subIn && idx >= 0) {
          curLu[idx] = subIn.n;
          if (!curPlayed.includes(subIn.n)) curPlayed.push(subIn.n);
          if (sr.liveForm[subIn.n] == null) sr.liveForm[subIn.n] = 6.5;
          if (isHomeSide) sr.homeSubsCount++;
          else sr.awaySubsCount++;
          sr.subs.push({ m: curMin, t: sideOrig.id, inPlayer: subIn.n, outPlayer: victim.id });
          const effSubTeam = victim.side === 'H' ? getLiveHomeTeam() : getLiveAwayTeam();
          const rep = buildTeamAgents(effSubTeam, victim.side, curLu, w.secondHalf);
          const agIdx = w.agents.findIndex((a) => a.id === victim.id);
          if (agIdx >= 0 && rep[idx]) {
            rep[idx].x = w.agents[agIdx].x;
            rep[idx].y = w.agents[agIdx].y;
            w.agents[agIdx] = rep[idx];
            if (w.ball.carrierId === victim.id) w.ball.carrierId = subIn.n;
            if (w.ball.targetId === victim.id) w.ball.targetId = subIn.n;
          }
          pushTimeline(curMin, victim.side, 'sub', subIn.n, victim.id);
          pushLog(curMin, `🔄 เปลี่ยนตัวด่วนแทนผู้เจ็บ: 🔼 เข้า ${subIn.n} · 🔽 ออก ${victim.id}`, 'sub', {
            subInfo: { teamId: sideOrig.id, inName: subIn.n, outName: victim.id, badge: '🩹 แทนผู้เจ็บ', isInjury: true }
          });
          ensureOnPitchCaptain(w, victim.side, curMin, 'inj', isInstantStep);
        } else {
          victim.sentOff = true;
          sr.sentOff.push(victim.id);
          if (w.ball.carrierId === victim.id) w.ball.carrierId = null;
          if (w.ball.targetId === victim.id) w.ball.targetId = null;
          if (!isSkippingRef.current) setSentOff(sr.sentOff.slice());
          const sideSentOffCount = w.agents.filter((a) => a.side === victim.side && a.sentOff).length;
          pushLog(curMin, `⚠️ ไม่มีตัวสำรองพร้อมเปลี่ยน! ${sideOrig.name} จำใจเล่นต่อด้วยผู้เล่น ${Math.max(1, 11 - sideSentOffCount)} คน`, 'card');
          ensureOnPitchCaptain(w, victim.side, curMin, 'inj', isInstantStep);
        }
      } else {
        victim.sentOff = true;
        sr.sentOff.push(victim.id);
        if (w.ball.carrierId === victim.id) w.ball.carrierId = null;
        if (w.ball.targetId === victim.id) w.ball.targetId = null;
        if (!isSkippingRef.current) setSentOff(sr.sentOff.slice());
        const sideSentOffCount = w.agents.filter((a) => a.side === victim.side && a.sentOff).length;
        pushLog(curMin, `⚠️ เปลี่ยนตัวครบโควต้าแล้ว! ${sideOrig.name} จำใจเล่นต่อด้วยผู้เล่น ${Math.max(1, 11 - sideSentOffCount)} คน`, 'card');
        ensureOnPitchCaptain(w, victim.side, curMin, 'inj', isInstantStep);
      }
      return true;
    }

    // AI / Career team auto-substitutes injured player immediately
    const bench = sideOrig.sq
      .filter((q) => !curPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n) && q.pos !== 'GK')
      .sort((a, b) => b.ov - a.ov);
    const subIn = subsCount < 5 ? (bench.find((b) => b.pos === pl.pos) || bench[0]) : undefined;
    const idx = curLu.indexOf(victim.id);
    if (subIn && idx >= 0) {
      curLu[idx] = subIn.n;
      if (!curPlayed.includes(subIn.n)) curPlayed.push(subIn.n);
      if (sr.liveForm[subIn.n] == null) sr.liveForm[subIn.n] = 6.5;
      if (isHomeSide) sr.homeSubsCount++;
      else sr.awaySubsCount++;
      sr.subs.push({ m: curMin, t: sideOrig.id, inPlayer: subIn.n, outPlayer: victim.id });
      const effSubTeam = victim.side === 'H' ? getLiveHomeTeam() : getLiveAwayTeam();
      const rep = buildTeamAgents(effSubTeam, victim.side, curLu, w.secondHalf);
      const agIdx = w.agents.findIndex((a) => a.id === victim.id);
      let subbedAg: LivePitchAgent | undefined;
      if (agIdx >= 0 && rep[idx]) {
        rep[idx].x = w.agents[agIdx].x;
        rep[idx].y = w.agents[agIdx].y;
        w.agents[agIdx] = rep[idx];
        subbedAg = rep[idx];
        if (w.ball.carrierId === victim.id) w.ball.carrierId = subIn.n;
        if (w.ball.targetId === victim.id) w.ball.targetId = subIn.n;
      }
      if (!isSkippingRef.current && !isInstantStep) {
        triggerSubPitchAnim(w, subbedAg, victim.side, sideOrig.name, subIn.n, victim.id, curMin);
      }
      if (!isSkippingRef.current) {
        if (isMySide) {
          setLiveLu(curLu.slice());
          setSubsUsed(sr.subs.filter((s) => s.t === sideOrig.id).map((s) => s.inPlayer));
        } else {
          setLiveOppLu(curLu.slice());
        }
        setSubLog(sr.subs.slice());
      }
      syncSidelineBenches(w);
      triggerCoachShout(w, isHomeSide ? 'H' : 'A', '🔄 เปลี่ยนแทนคนเจ็บ!', 2.3);
      pushTimeline(curMin, victim.side, 'sub', subIn.n, victim.id);
      pushLog(curMin, `🔄 เปลี่ยนตัวฉุกเฉิน (${sideOrig.name}): 🔼 เข้า ${subIn.n} · 🔽 ออก ${victim.id}`, 'sub', {
        subInfo: { teamId: sideOrig.id, inName: subIn.n, outName: victim.id, badge: '🩹 แทนผู้เจ็บ', isInjury: true }
      });
      ensureOnPitchCaptain(w, victim.side, curMin, 'inj', isInstantStep);
    } else {
      victim.sentOff = true;
      sr.sentOff.push(victim.id);
      if (w.ball.carrierId === victim.id) w.ball.carrierId = null;
      if (w.ball.targetId === victim.id) w.ball.targetId = null;
      if (!isSkippingRef.current) setSentOff(sr.sentOff.slice());
      const sideSentOffCount = w.agents.filter((a) => a.side === victim.side && a.sentOff).length;
      pushLog(curMin, `⚠️ ${sideOrig.name} เปลี่ยนตัวไม่ได้แล้ว ต้องฝืนเล่นต่อด้วยผู้เล่น ${Math.max(1, 11 - sideSentOffCount)} คน`, 'card');
      ensureOnPitchCaptain(w, victim.side, curMin, 'inj', isInstantStep);
    }
    return true;
  };

  const pickKickoffPair = (pool: LivePitchAgent[]) => {
    const activeOutfield = pool.filter((z) => !z.sentOff && z.pos !== 'GK');
    const kicker = activeOutfield.find((z) => z.pos === 'FW') || activeOutfield.find((z) => z.pos === 'MF') || activeOutfield[0];
    const partner = activeOutfield.find((z) => z.id !== kicker?.id && (z.pos === 'MF' || z.pos === 'FW')) || activeOutfield.find((z) => z.id !== kicker?.id);
    return { kicker, partner };
  };

  const clearWorldCelebration = (w: LiveMatchWorld, nextIntent: LivePitchAgent['intent'] = 'SUPPORT') => {
    w.celebrateTimer = 0;
    w.celebration = null;
    w.kickoffReturnElapsed = 0;
    w.agents.forEach((ag) => {
      ag.celebratePose = undefined;
      ag.celebrateRole = undefined;
      ag.celebratePhase = undefined;
      ag.isOgCulprit = undefined;
      if (ag.intent === 'CELEBRATE') {
        ag.intent = nextIntent;
      }
    });
  };

  const pickGoalCelebrationStyle = (
    w: LiveMatchWorld,
    side: 'H' | 'A',
    scorerAg: LivePitchAgent | undefined,
    isOwnGoal: boolean,
    isMyTeamGoal: boolean,
    isMeScorer: boolean,
    curMin: number,
    ghAfter: number,
    gaAfter: number,
    hasAssister: boolean,
    finishVerb: string
  ): { style: GoalCelebrationStyle; label: string } => {
    if (isOwnGoal) {
      return { style: 'own_goal_modest', label: '👏 ดีใจแบบสุภาพ (ได้ประตูจาก OG)' };
    }
    const isHomeSide = side === 'H';
    const sideDiff = side === 'H' ? ghAfter - gaAfter : gaAfter - ghAfter;
    const isClutch = curMin >= 78 && sideDiff >= 0 && sideDiff <= 1;
    const isEqualizer = sideDiff === 0;
    const isAcrobaticFinish = finishVerb.includes('จักรยานอากาศ') || finishVerb.includes('วอลเลย์') || finishVerb.includes('ไกล') || finishVerb.includes('โค้ง');
    const agi = scorerAg?.d.agi ?? 65;
    const spd = scorerAg?.d.spd ?? 65;
    const isFlair = Boolean(scorerAg && (scorerAg.sig === 'cur' || scorerAg.sig === 'fin' || agentHasTrait(scorerAg, 'flair_dribbler') || scorerAg.tr === 5 || scorerAg.tr === 16));
    const isWinger = Boolean(scorerAg && (scorerAg.role === 'LW' || scorerAg.role === 'RW' || scorerAg.role === 'LM' || scorerAg.role === 'RM' || spd >= 75));

    const candidates: { style: GoalCelebrationStyle; label: string; weight: number }[] = [
      {
        style: 'knee_slide',
        label: '🦵 สไลด์เข่าฉลองประตู!',
        weight: 22 + (isAcrobaticFinish ? 4 : 0) + (isClutch ? 6 : 0)
      },
      {
        style: 'siu_jump',
        label: '⚡ กระโดดหมุนตัว SIUUU!',
        weight: 18 + (isFlair ? 10 : 0) + (isClutch || isMeScorer ? 8 : 0) + (scorerAg?.pos === 'FW' ? 5 : 0)
      },
      {
        style: 'backflip',
        label: '🤸 ตีลังกาฉลองสุดเหวี่ยง!',
        weight: 11 + (agi >= 72 ? 12 : 0) + (isAcrobaticFinish ? 10 : 0) + (isMeScorer ? 5 : 0)
      },
      {
        style: 'group_huddle',
        label: '🫂 วิ่งกอดรวมพลังทั้งทีม!',
        weight: 16 + (hasAssister ? 8 : 0) + (isEqualizer || isClutch ? 12 : 0)
      },
      {
        style: 'finger_point',
        label: hasAssister ? '👉 ชี้ขอบคุณเพื่อนร่วมทีม!' : '👆 ชี้ฟ้าฉลองประตู!',
        weight: 15 + (hasAssister ? 16 : 0)
      },
      {
        style: 'airplane',
        label: '✈️ กางปีกเครื่องบินร่อนฉลอง!',
        weight: 14 + (isWinger ? 13 : 0)
      },
      {
        style: 'bow_crowd',
        label: '🙏 ไหว้ขอบคุณแฟนบอลรอบสนาม!',
        weight: 13 + (isHomeSide ? 11 : 0) + (isMyTeamGoal ? 10 : 0) + (isMeScorer ? 8 : 0)
      },
      {
        style: 'calm_shush',
        label: '🤫 จุ๊ปากเงียบกริบทั้งสนาม!',
        weight: (!isHomeSide ? 18 : 7) + (sideDiff > 0 && curMin >= 65 ? 10 : 0) + (w.goalBanner?.isMyGoal === false ? 4 : 0)
      }
    ];

    const filtered = candidates.filter((c) => c.style !== w.lastCelebrationStyle);
    const pool = filtered.length ? filtered : candidates;
    const totalW = pool.reduce((s, c) => s + Math.max(1, c.weight), 0);
    let r = Math.random() * totalW;
    for (const item of pool) {
      r -= Math.max(1, item.weight);
      if (r <= 0) return { style: item.style, label: item.label };
    }
    return { style: pool[0].style, label: pool[0].label };
  };

  // Update all 22 AI agents' tactical targets & off-ball runs ("ทำทาง") smoothly
  const updateAgentTargets = (w: LiveMatchWorld, curMin: number) => {
    const b = w.ball;
    const hCfg = getEffectiveTeamCfg('H', curMin);
    const aCfg = getEffectiveTeamCfg('A', curMin);

    const activeAgents = w.agents.filter((a) => !a.sentOff);

    const oppSecondLastX = (defSide: 'H' | 'A') => {
      const defAttRight = isAttackRight(w, defSide);
      const defs = activeAgents.filter((a) => a.side === defSide).map((a) => a.x);
      defs.sort((u, v) => (defAttRight ? u - v : v - u));
      return defs[1] ?? (defAttRight ? 18 : 82);
    };
    const hDefLineX = oppSecondLastX('H');
    const aDefLineX = oppSecondLastX('A');

    // Find closest defenders to ball for pressing/covering (keep CBs anchored in backline unless ball enters own defensive third)
    const defSide = b.possessionSide === 'H' ? 'A' : 'H';
    const defCfgGlobal = getEffectiveTeamCfg(defSide, curMin);
    const defAttRightGlobal = isAttackRight(w, defSide);
    const defBallNormX = defAttRightGlobal ? b.x : 100 - b.x;
    const defPressers = activeAgents
      .filter((a) => a.side === defSide && a.pos !== 'GK')
      .sort((u, v) => {
        const uPenalty = baseRoleOf(u.role) === 'CB' && defBallNormX >= 42 ? 22 : 0;
        const vPenalty = baseRoleOf(v.role) === 'CB' && defBallNormX >= 42 ? 22 : 0;
        return (Math.hypot(u.x - b.x, u.y - b.y) + uPenalty) - (Math.hypot(v.x - b.x, v.y - b.y) + vPenalty);
      });
    const primaryPresserId = defPressers[0]?.id;
    const secondaryCoverId = defPressers[1]?.id;
    const thirdTrapPresserId = defCfgGlobal.press === 2 ? defPressers[2]?.id : undefined;

    // Identify attacking central midfield triangle candidates (never drag CDM/LM/RM out of position unless no CM/CAM exists)
    const carrier = b.carrierId ? activeAgents.find((a) => a.id === b.carrierId) : null;
    const centralMids = activeAgents.filter(
      (a) =>
        a.side === b.possessionSide &&
        (a.role === 'CM' || a.role === 'LCM' || a.role === 'RCM' || a.role === 'CAM') &&
        a.id !== carrier?.id
    );
    const attMids = (centralMids.length ? centralMids : activeAgents.filter((a) => a.side === b.possessionSide && a.pos === 'MF' && a.id !== carrier?.id && a.role !== 'LM' && a.role !== 'RM'))
      .sort((u, v) => Math.hypot(u.x - b.x, u.y - b.y) - Math.hypot(v.x - b.x, v.y - b.y))
      .slice(0, 2)
      .sort((u, v) => {
        const uAttRight = isAttackRight(w, u.side);
        return uAttRight ? u.slotX - v.slotX : v.slotX - u.slotX;
      });

    const setPiece = w.pendingSetPiece;
    const lockedTargetIds = new Set<string>();

    // Cache deterministic set-piece taker & wall IDs so runners never swap mid-approach or teleport
    if (setPiece && setPiece.type !== 'kickoff') {
      const existingTaker = setPiece.takerId ? activeAgents.find((z) => z.id === setPiece.takerId) : undefined;
      if (!existingTaker) {
        let pickedTaker: LivePitchAgent | undefined;
        if (setPiece.type === 'penalty' || setPiece.type === 'freekick' || setPiece.type === 'corner') {
          pickedTaker =
            resolveSetPieceTaker(w, setPiece.side, setPiece.type) ||
            activeAgents.find((z) => z.side === setPiece.side && z.pos !== 'GK');
        } else if (setPiece.type === 'goalkick') {
          pickedTaker =
            activeAgents.find((z) => z.side === setPiece.side && z.pos === 'GK') ||
            activeAgents.find((z) => z.side === setPiece.side);
        } else if (setPiece.type === 'offside') {
          pickedTaker =
            activeAgents.find((z) => z.side === setPiece.side && z.pos === 'DF') ||
            activeAgents.find((z) => z.side === setPiece.side && z.pos !== 'GK');
        } else if (setPiece.type === 'throwin') {
          pickedTaker = activeAgents
            .filter((z) => z.side === setPiece.side && z.pos !== 'GK')
            .sort((u, v) => Math.hypot(u.x - setPiece.x, u.y - setPiece.y) - Math.hypot(v.x - setPiece.x, v.y - setPiece.y))[0];
        }
        if (pickedTaker) setPiece.takerId = pickedTaker.id;
      }
      if (setPiece.type === 'throwin') {
        if (!setPiece.throwSupportIds?.length) {
          setPiece.throwSupportIds = activeAgents
            .filter((z) => z.side === setPiece.side && z.pos !== 'GK' && z.id !== setPiece.takerId)
            .sort((u, v) => Math.hypot(u.x - setPiece.x, u.y - setPiece.y) - Math.hypot(v.x - setPiece.x, v.y - setPiece.y))
            .map((z) => z.id);
        }
        if (!setPiece.throwDefIds?.length) {
          setPiece.throwDefIds = activeAgents
            .filter((z) => z.side !== setPiece.side && z.pos !== 'GK')
            .sort((u, v) => Math.hypot(u.x - setPiece.x, u.y - setPiece.y) - Math.hypot(v.x - setPiece.x, v.y - setPiece.y))
            .slice(0, 3)
            .map((z) => z.id);
        }
      }
      if (setPiece.type === 'freekick' && setPiece.wallPlayers?.length && !setPiece.wallIds?.length) {
        setPiece.wallIds = activeAgents
          .filter((z) => z.side !== setPiece.side && (z.pos === 'DF' || z.pos === 'MF'))
          .sort((u, v) => Math.hypot(u.x - setPiece.x, u.y - setPiece.y) - Math.hypot(v.x - setPiece.x, v.y - setPiece.y))
          .slice(0, setPiece.wallPlayers.length)
          .map((z) => z.id);
      }
    }

    // Track corner role assignment indices so CBs & top aerial targets push into box zones and corner taker stays at flag
    const cornerTaker =
      setPiece && setPiece.type === 'corner'
        ? (setPiece.takerId ? activeAgents.find((z) => z.id === setPiece.takerId) : undefined) ||
          resolveSetPieceTaker(w, setPiece.side, 'corner')
        : undefined;
    const cornerScoreAtt = (z: LivePitchAgent) => {
      const zBase = baseRoleOf(z.role);
      return (
        (zBase === 'CB' ? 44 : z.pos === 'FW' ? 30 : zBase === 'CDM' || z.role === 'LB' || z.role === 'RB' || z.role === 'LWB' || z.role === 'RWB' ? -22 : 6) +
        z.d.hd +
        z.d.str +
        (z.sig === 'hd' ? 12 : 0) +
        (agentHasTrait(z, 'aerial_menace') ? 16 : 0) +
        (agentHasTrait(z, 'near_post_runner') ? 8 : 0)
      );
    };
    const cornerAttList =
      setPiece && setPiece.type === 'corner'
        ? activeAgents
            .filter((z) => z.side === setPiece.side && z.pos !== 'GK' && z.id !== cornerTaker?.id)
            .sort((u, v) => cornerScoreAtt(v) - cornerScoreAtt(u))
        : [];
    const cornerDefList =
      setPiece && setPiece.type === 'corner'
        ? activeAgents
            .filter((z) => z.side !== setPiece.side && z.pos !== 'GK')
            .sort((u, v) => {
              const uBase = baseRoleOf(u.role);
              const vBase = baseRoleOf(v.role);
              return (
                (vBase === 'CB' ? 36 : v.pos === 'DF' ? 20 : vBase === 'CDM' ? 10 : 0) +
                v.d.hd +
                v.d.str -
                ((uBase === 'CB' ? 36 : u.pos === 'DF' ? 20 : uBase === 'CDM' ? 10 : 0) + u.d.hd + u.d.str)
              );
            })
        : [];

    const celeb = w.celebration;
    const isCelebrating = w.celebrateTimer > 0 && Boolean(celeb);
    const celebProgress = isCelebrating && celeb ? clamp(celeb.elapsed / Math.max(0.4, celeb.duration), 0, 1) : 0;
    const celebRunners =
      isCelebrating && celeb
        ? activeAgents
            .filter(
              (z) =>
                z.side === celeb.side &&
                z.pos !== 'GK' &&
                (celeb.isOwnGoal || z.id !== celeb.scorerId) &&
                (!celeb.assisterId || z.id !== celeb.assisterId)
            )
            .sort(
              (u, v) =>
                ((u.pos === 'FW' ? 0 : u.pos === 'MF' ? 1 : 2) * 100 + u.slotIndex) -
                ((v.pos === 'FW' ? 0 : v.pos === 'MF' ? 1 : 2) * 100 + v.slotIndex)
            )
        : [];

    let aerialContestDefId: string | null = null;
    if (
      !isCelebrating &&
      !setPiece &&
      b.carrierId == null &&
      (b.flightType === 'cross' ||
        b.flightType === 'corner' ||
        b.flightType === 'cutback' ||
        b.flightType === 'lofted' ||
        b.flightType === 'goalkick')
    ) {
      const defSideNow: 'H' | 'A' = b.possessionSide === 'H' ? 'A' : 'H';
      const isBoxAerial = b.flightType === 'cross' || b.flightType === 'corner';
      const contestCand = activeAgents
        .filter((z) => {
          if (z.side !== defSideNow) return false;
          if (z.pos === 'GK') {
            return isBoxAerial && Math.hypot(z.x - b.toX, z.y - b.toY) <= 8.5;
          }
          return true;
        })
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];
      if (contestCand && Math.hypot(contestCand.x - b.toX, contestCand.y - b.toY) <= 18) {
        aerialContestDefId = contestCand.id;
      }
    }

    activeAgents.forEach((ag) => {
      if (!isCelebrating) {
        if (ag.celebratePose || ag.celebrateRole || ag.celebratePhase != null || ag.isOgCulprit) {
          ag.celebratePose = undefined;
          ag.celebrateRole = undefined;
          ag.celebratePhase = undefined;
          ag.isOgCulprit = undefined;
        }
        if (ag.intent === 'CELEBRATE') {
          ag.intent = setPiece?.type === 'kickoff' ? 'RESET' : 'SUPPORT';
          ag.intentTimer = 0;
        }
      }
      if (b.targetId === ag.id && !w.pendingSetPiece && ag.intent !== 'DIVE' && ag.intent !== 'CELEBRATE') {
        ag.intent = 'PASS_TARGET';
        ag.intentTimer = 0;
        ag.runToX = undefined;
        ag.runToY = undefined;
        ag.tx = clamp(b.toX, 4.5, 95.5);
        ag.ty = clamp(b.toY, 5.5, 94.5);
        lockedTargetIds.add(ag.id);
        return;
      }
      if (aerialContestDefId && ag.id === aerialContestDefId && !w.pendingSetPiece && ag.intent !== 'DIVE' && ag.intent !== 'CELEBRATE') {
        ag.intent = 'PRESS';
        ag.intentTimer = 0;
        ag.runToX = undefined;
        ag.runToY = undefined;
        ag.tx = clamp(b.toX, ag.pos === 'GK' ? 2.0 : 4.5, ag.pos === 'GK' ? 98.0 : 95.5);
        ag.ty = clamp(b.toY, 5.5, 94.5);
        lockedTargetIds.add(ag.id);
        return;
      }
      // Lock player cleanly at strike/header/acrobat contact point so they don't sprint away mid-animation
      if (
        !isCelebrating &&
        (ag.acrobatTimer ?? 0) > 0 &&
        !w.pendingSetPiece &&
        b.carrierId !== ag.id &&
        (ag.acrobatType === 'kick' ||
          ag.acrobatType === 'shoot_power' ||
          ag.acrobatType === 'shoot_finesse' ||
          ag.acrobatType === 'shoot_chip' ||
          ag.acrobatType === 'header' ||
          ag.acrobatType === 'diving_header' ||
          ag.acrobatType === 'volley' ||
          ag.acrobatType === 'bicycle' ||
          ag.acrobatType === 'whiff' ||
          ag.acrobatType === 'cutinside' ||
          ag.acrobatType === 'burst' ||
          ag.acrobatType === 'clash' ||
          ag.acrobatType === 'slide')
      ) {
        ag.tx = ag.x;
        ag.ty = ag.y;
        ag.runToX = undefined;
        ag.runToY = undefined;
        lockedTargetIds.add(ag.id);
        return;
      }
      if (!isCelebrating && ag.intentTimer > 0) {
        if (ag.intent === 'CELEBRATE' || ag.intent === 'DIVE') {
          lockedTargetIds.add(ag.id);
          return;
        }
        if (setPiece || w.phase === 'shootout') {
          ag.intentTimer = 0;
          ag.runToX = undefined;
          ag.runToY = undefined;
        } else {
          ag.intentTimer = Math.max(0, ag.intentTimer - 0.016);
          if (ag.intent === 'MAKE_RUN' && ag.runToX != null && ag.runToY != null) {
            ag.tx = clamp(ag.runToX, 5, 95);
            ag.ty = clamp(ag.runToY, 6, 94);
            return;
          }
        }
      }

      const isH = ag.side === 'H';
      const attRight = isAttackRight(w, ag.side);
      const cfg = isH ? hCfg : aCfg;
      const inPoss = b.possessionSide === ag.side;
      const dir = attRight ? 1 : -1;

      // Choreographed non-repetitive Goal Celebration!
      if (isCelebrating && celeb) {
        ag.intent = 'CELEBRATE';
        ag.celebratePose = celeb.style;
        ag.celebratePhase = celebProgress;
        ag.runToX = undefined;
        ag.runToY = undefined;
        lockedTargetIds.add(ag.id);

        if (ag.side === celeb.side) {
          ag.isOgCulprit = false;
          const ax = celeb.anchorX;
          const ay = celeb.anchorY;
          const crowdSideY = ay < 50 ? 9.5 : 90.5;
          const crowdSign = ay < 50 ? -1 : 1;

          if (!celeb.isOwnGoal && ag.id === celeb.scorerId) {
            ag.celebrateRole = 'scorer';
            if (celeb.style === 'knee_slide') {
              const slidePush = celebProgress < 0.28 ? 0 : Math.min(1, (celebProgress - 0.28) / 0.5) * 4.5;
              ag.tx = clamp(ax + dir * slidePush, 6, 94);
              ag.ty = clamp(ay + crowdSign * slidePush * 0.35, 7.5, 92.5);
            } else if (celeb.style === 'siu_jump') {
              ag.tx = clamp(ax, 8, 92);
              ag.ty = clamp(ay + crowdSign * 1.5, 8.5, 91.5);
            } else if (celeb.style === 'backflip') {
              ag.tx = clamp(ax - dir * 1.5, 10, 90);
              ag.ty = clamp(ay, 11, 89);
            } else if (celeb.style === 'airplane') {
              const arc = celebProgress * Math.PI * 1.1;
              ag.tx = clamp(ax - dir * 2 + Math.cos(arc) * dir * 5.2, 8, 92);
              ag.ty = clamp(ay + Math.sin(arc) * crowdSign * 6.5, 8.5, 91.5);
            } else if (celeb.style === 'bow_crowd') {
              ag.tx = clamp(ax, 14, 86);
              ag.ty = crowdSideY;
            } else if (celeb.style === 'calm_shush') {
              ag.tx = clamp(attRight ? 84 : 16, 12, 88);
              ag.ty = clamp(ay, 26, 74);
            } else if (celeb.style === 'finger_point') {
              const assisterAg = celeb.assisterId ? activeAgents.find((z) => z.id === celeb.assisterId) : undefined;
              ag.tx = clamp(assisterAg ? ax * 0.72 + assisterAg.x * 0.28 : ax, 10, 90);
              ag.ty = clamp(assisterAg ? ay * 0.72 + assisterAg.y * 0.28 : ay, 10, 90);
            } else {
              ag.tx = clamp(ax, 10, 90);
              ag.ty = clamp(ay, 10, 90);
            }
            return;
          }

          if (celeb.assisterId && ag.id === celeb.assisterId) {
            ag.celebrateRole = 'assister';
            if (celeb.style === 'bow_crowd') {
              ag.tx = clamp(ax - dir * 3.2, 10, 90);
              ag.ty = crowdSideY;
            } else if (celeb.style === 'group_huddle') {
              ag.tx = clamp(ax - dir * 2.6, 8, 92);
              ag.ty = clamp(ay - crowdSign * 2.1, 9, 91);
            } else if (celeb.style === 'finger_point') {
              ag.tx = clamp(ax - dir * 5.5, 10, 90);
              ag.ty = clamp(ay + (ay < 50 ? 5.5 : -5.5), 10, 90);
            } else {
              ag.tx = clamp(ax - dir * 3.4, 8, 92);
              ag.ty = clamp(ay - crowdSign * 3.0, 9, 91);
            }
            return;
          }

          if (ag.pos === 'GK') {
            ag.celebrateRole = 'gk';
            ag.tx = attRight ? 7.2 : 92.8;
            ag.ty = 50;
            return;
          }

          ag.celebrateRole = 'teammate';
          const runnerRank = celebRunners.findIndex((z) => z.id === ag.id);
          if (runnerRank >= 0 && runnerRank < 4) {
            if (celeb.style === 'group_huddle') {
              const ang = (Math.PI * 2 * (runnerRank + 0.5)) / 4.5 + (attRight ? 0 : Math.PI);
              ag.tx = clamp(ax + Math.cos(ang) * 3.6, 7, 93);
              ag.ty = clamp(ay + Math.sin(ang) * 3.6, 8.5, 91.5);
            } else if (celeb.style === 'bow_crowd') {
              const offsetSide = (runnerRank - 1.5) * 3.4;
              ag.tx = clamp(ax - dir * (4.2 + runnerRank * 1.4), 10, 90);
              ag.ty = clamp(crowdSideY - crowdSign * (1.2 + Math.abs(offsetSide) * 0.25), 9.5, 90.5);
            } else {
              const fanAng = (attRight ? Math.PI : 0) + ((runnerRank - 1.5) * 0.55);
              const rad = celeb.style === 'calm_shush' ? 6.8 : 4.8 + (runnerRank % 2) * 1.5;
              ag.tx = clamp(ax + Math.cos(fanAng) * rad, 7, 93);
              ag.ty = clamp(ay + Math.sin(fanAng) * rad, 8.5, 91.5);
            }
          } else {
            const ownForwardX = clamp(attRight ? 54 + (ag.slotIndex % 3) * 6 : 46 - (ag.slotIndex % 3) * 6, 18, 82);
            const rawSlotY = attRight ? ag.slotX : 100 - ag.slotX;
            ag.tx = ownForwardX;
            ag.ty = clamp(50 + (rawSlotY - 50) * 0.72, 12, 88);
          }
          return;
        }

        // Conceding team pauses briefly/dejectedly near current zones before walking back for kickoff
        ag.celebrateRole = 'conceded';
        ag.isOgCulprit = Boolean(celeb.isOwnGoal && ag.id === celeb.scorerId);
        if (ag.pos === 'GK') {
          ag.tx = attRight ? 3.5 : 96.5;
          ag.ty = 50;
        } else {
          ag.tx = ag.x;
          ag.ty = ag.y;
        }
        return;
      }

      // Kickoff formation reset: every player returns to their own half in formation before play resumes
      if (setPiece && setPiece.type === 'kickoff') {
        lockedTargetIds.add(ag.id);
        ag.runToX = undefined;
        ag.runToY = undefined;
        if (ag.pos === 'GK') {
          ag.tx = attRight ? 2.4 : 97.6;
          ag.ty = 50;
          ag.intent = 'RESET';
          return;
        }
        const teamActive = activeAgents.filter((z) => z.side === ag.side && z.pos !== 'GK');
        const { kicker, partner } = pickKickoffPair(teamActive);
        const isKickSide = ag.side === setPiece.side;
        if (isKickSide && kicker && ag.id === kicker.id) {
          ag.tx = 50 - dir * 0.6;
          ag.ty = 50;
          ag.intent = 'RESET';
          return;
        }
        if (isKickSide && partner && ag.id === partner.id) {
          ag.tx = 50 - dir * 5.2;
          ag.ty = 45;
          ag.intent = 'RESET';
          return;
        }
        const ownHalfNormX = clamp(8 + (100 - ag.slotY) * 0.43, 10, 47.2);
        const rawSlotY = attRight ? ag.slotX : 100 - ag.slotX;
        let kickTx = attRight ? ownHalfNormX : 100 - ownHalfNormX;
        const kickTy = clamp(50 + (rawSlotY - 50) * 0.92, 9, 91);
        if (!isKickSide && Math.hypot(kickTx - 50, kickTy - 50) < 10.2) {
          kickTx = attRight ? Math.min(kickTx, 39.8) : Math.max(kickTx, 60.2);
        }
        ag.tx = kickTx;
        ag.ty = kickTy;
        ag.intent = 'RESET';
        return;
      }

      // Penalty Shootout positioning
      if (w.phase === 'shootout' && w.shootout) {
        const sh = w.shootout;
        const kickSide = sh.turn;
        const gkSide = kickSide === 'H' ? 'A' : 'H';
        lockedTargetIds.add(ag.id);
        if (ag.side === gkSide && ag.pos === 'GK') {
          ag.tx = 98.2;
          ag.ty = 50;
          ag.intent = 'SUPPORT';
          return;
        }
        if (ag.id === sh.kickerName && ag.side === kickSide) {
          ag.tx = 86.2;
          ag.ty = 50;
          ag.intent = 'SUPPORT';
          return;
        }
        const angle = (ag.slotIndex / 11) * Math.PI * 2 + (isH ? 0 : Math.PI);
        ag.tx = clamp(47 + Math.cos(angle) * 6 + (isH ? -4 : 4), 35, 58);
        ag.ty = clamp(50 + Math.sin(angle) * 14, 24, 76);
        ag.intent = 'SUPPORT';
        return;
      }

      // In-match Penalty Kick positioning (taker walks onto penalty spot; others stay outside penalty box & D-arc)
      if (setPiece && setPiece.type === 'penalty') {
        const isAtt = ag.side === setPiece.side;
        const penRight = isAttackRight(w, setPiece.side);
        const penDir = penRight ? 1 : -1;
        const spotX = penRight ? 88.5 : 11.5;
        lockedTargetIds.add(ag.id);
        ag.runToX = undefined;
        ag.runToY = undefined;
        if (!isAtt && ag.pos === 'GK') {
          ag.tx = penRight ? 98.2 : 1.8;
          ag.ty = 50;
          ag.intent = 'RESET';
          return;
        }
        if (isAtt && setPiece.takerId === ag.id) {
          ag.tx = clamp(spotX - penDir * 2.1, 4, 96);
          ag.ty = 50;
          ag.intent = 'RESET';
          return;
        }
        if (ag.pos !== 'GK') {
          const lineBackX = penRight ? 77.2 : 22.8;
          ag.tx = penRight
            ? Math.min(lineBackX, lineBackX - (ag.slotIndex % 3) * 2.4)
            : Math.max(lineBackX, lineBackX + (ag.slotIndex % 3) * 2.4);
          ag.ty = clamp(22 + ((ag.slotIndex * 5.6) % 56), 18, 82);
          ag.intent = 'SUPPORT';
          return;
        }
      }

      // Goal Kick & Offside Free Kick structured reset (kicker runs behind ball; teammates spread into build-up)
      if (setPiece && (setPiece.type === 'goalkick' || setPiece.type === 'offside')) {
        const isAtt = ag.side === setPiece.side;
        const spAttRight = isAttackRight(w, setPiece.side);
        const spDir = spAttRight ? 1 : -1;
        lockedTargetIds.add(ag.id);
        ag.runToX = undefined;
        ag.runToY = undefined;
        if (ag.id === setPiece.takerId) {
          ag.tx = clamp(setPiece.x - spDir * 1.35, 2.2, 97.8);
          ag.ty = clamp(setPiece.y, 6, 94);
          ag.intent = 'RESET';
          return;
        }
        if (setPiece.type === 'goalkick') {
          if (ag.pos === 'GK') {
            ag.tx = attRight ? 2.6 : 97.4;
            ag.ty = 50;
            ag.intent = 'SUPPORT';
            return;
          }
          const rawSlotY = attRight ? ag.slotX : 100 - ag.slotX;
          if (isAtt) {
            const ownNorm = clamp(100 - ag.slotY, 16, 72);
            const spreadX = clamp(ownNorm * 0.85 + 10, 16, 72);
            ag.tx = spAttRight ? spreadX : 100 - spreadX;
            ag.ty = clamp(50 + (rawSlotY - 50) * 1.12, 8, 92);
            ag.intent = 'SUPPORT';
            return;
          } else {
            // Defending team must remain outside the kicker's penalty area in compact shape
            const ownNorm = clamp(100 - ag.slotY, 18, 74);
            const minSafeFromSpGoal = 24;
            let defX = attRight ? ownNorm : 100 - ownNorm;
            if (spAttRight) defX = Math.max(defX, minSafeFromSpGoal);
            else defX = Math.min(defX, 100 - minSafeFromSpGoal);
            ag.tx = clamp(defX, 14, 86);
            ag.ty = clamp(50 + (rawSlotY - 50) * 0.92, 12, 88);
            ag.intent = 'MARK';
            return;
          }
        } else {
          // Offside free kick: kicking side builds up around line; defending side retreats cleanly behind ball
          if (ag.pos === 'GK') {
            ag.tx = attRight ? 2.6 : 97.4;
            ag.ty = 50;
            ag.intent = 'SUPPORT';
            return;
          }
          const spNormX = spAttRight ? setPiece.x : 100 - setPiece.x;
          const rawSlotY = attRight ? ag.slotX : 100 - ag.slotX;
          if (isAtt) {
            const targetNorm = clamp(spNormX - 8 + (100 - ag.slotY) * 0.42, 14, 78);
            ag.tx = spAttRight ? targetNorm : 100 - targetNorm;
            ag.ty = clamp(50 + (rawSlotY - 50) * 1.02, 10, 90);
            ag.intent = 'SUPPORT';
            return;
          } else {
            const behindBallNorm = clamp((spAttRight ? 100 - setPiece.x : setPiece.x) - 10 + (100 - ag.slotY) * 0.35, 16, 72);
            ag.tx = attRight ? Math.min(behindBallNorm, spAttRight ? 100 - spNormX - 11 : spNormX - 11) : Math.max(100 - behindBallNorm, spAttRight ? spNormX + 11 : 100 - spNormX + 11);
            ag.tx = clamp(ag.tx, 14, 86);
            ag.ty = clamp(50 + (rawSlotY - 50) * 0.9, 14, 86);
            ag.intent = 'MARK';
            return;
          }
        }
      }

      // Free-kick taker, box targets, & defensive wall positioning
      if (setPiece && setPiece.type === 'freekick') {
        const fkAttRight = isAttackRight(w, setPiece.side);
        const fkDir = fkAttRight ? 1 : -1;
        const fkGoalX = fkAttRight ? 100 : 0;
        const fkDistToGoal = Math.hypot(fkGoalX - setPiece.x, 50 - setPiece.y);
        if (ag.side === setPiece.side && ag.pos !== 'GK') {
          const fkTakerId =
            setPiece.takerId ||
            resolveSetPieceTaker(w, setPiece.side, 'freekick')?.id;
          if (fkTakerId === ag.id) {
            ag.tx = clamp(setPiece.x - fkDir * 1.45, 3, 97);
            ag.ty = clamp(setPiece.y, 4.5, 95.5);
            ag.intent = 'RESET';
            lockedTargetIds.add(ag.id);
            return;
          }
          if (fkDistToGoal >= 36) {
            const boxCands = activeAgents
              .filter((z) => z.side === setPiece.side && z.id !== fkTakerId && (baseRoleOf(z.role) === 'CB' || z.pos === 'FW'))
              .sort(
                (u, v) =>
                  (baseRoleOf(v.role) === 'CB' ? 20 : 12) + v.d.hd + (v.sig === 'hd' ? 10 : 0) -
                  ((baseRoleOf(u.role) === 'CB' ? 20 : 12) + u.d.hd + (u.sig === 'hd' ? 10 : 0))
              );
            const bIdx = boxCands.findIndex((z) => z.id === ag.id);
            if (bIdx >= 0 && bIdx < 4) {
              ag.tx = clamp(fkAttRight ? 88.5 + (bIdx % 2) * 2.5 : 11.5 - (bIdx % 2) * 2.5, 6, 94);
              ag.ty = clamp(41 + bIdx * 6, 35, 65);
              ag.intent = 'RESET';
              ag.runToX = ag.tx;
              ag.runToY = ag.ty;
              lockedTargetIds.add(ag.id);
              return;
            }
          }
        }
        if (ag.side !== setPiece.side && setPiece.wallPlayers) {
          const wallIds =
            setPiece.wallIds && setPiece.wallIds.length
              ? setPiece.wallIds
              : activeAgents
                  .filter((z) => z.side === ag.side && (z.pos === 'DF' || z.pos === 'MF'))
                  .sort((u, v) => Math.hypot(u.x - setPiece.x, u.y - setPiece.y) - Math.hypot(v.x - setPiece.x, v.y - setPiece.y))
                  .slice(0, setPiece.wallPlayers.length)
                  .map((z) => z.id);
          const wallIdx = wallIds.indexOf(ag.id);
          if (wallIdx >= 0 && setPiece.wallPlayers[wallIdx]) {
            ag.intent = 'WALL';
            ag.tx = setPiece.wallPlayers[wallIdx].x;
            ag.ty = setPiece.wallPlayers[wallIdx].y;
            lockedTargetIds.add(ag.id);
            return;
          }
        }
        if (ag.side !== setPiece.side && ag.pos !== 'GK' && fkDistToGoal >= 36) {
          const defHoldX = fkAttRight ? 85.5 + (ag.slotIndex % 3) * 2.2 : 14.5 - (ag.slotIndex % 3) * 2.2;
          if (ag.pos === 'DF' || baseRoleOf(ag.role) === 'CDM') {
            ag.tx = clamp(defHoldX, 6, 94);
            ag.ty = clamp(32 + ((ag.slotIndex * 7.5) % 36), 28, 72);
            ag.intent = 'MARK';
            lockedTargetIds.add(ag.id);
            return;
          }
        }
      }

      // Throw-in positioning on touchline (cached taker & support order avoids swapping/flickering mid-run)
      if (setPiece && setPiece.type === 'throwin' && ag.pos !== 'GK') {
        const isAtt = ag.side === setPiece.side;
        const throwRight = isAttackRight(w, setPiece.side);
        const throwDir = throwRight ? 1 : -1;
        const throwTakerId = setPiece.takerId;
        if (isAtt) {
          if (throwTakerId === ag.id) {
            ag.tx = clamp(setPiece.x, 4, 96);
            ag.ty = setPiece.y < 50 ? 1.8 : 98.2;
            ag.intent = 'RESET';
            lockedTargetIds.add(ag.id);
            return;
          }
          const idxT = setPiece.throwSupportIds ? setPiece.throwSupportIds.indexOf(ag.id) : -1;
          const nearSideY = setPiece.y < 50 ? 12 : 88;
          const spNormX = throwRight ? setPiece.x : 100 - setPiece.x;
          if (idxT === 0) {
            // Short back option
            ag.tx = clamp(setPiece.x - throwDir * 8, 8, 92);
            ag.ty = clamp(nearSideY + (setPiece.y < 50 ? 9 : -9), 10, 90);
            ag.intent = 'RESET';
            lockedTargetIds.add(ag.id);
            return;
          } else if (idxT === 1) {
            // Forward down-the-line runner
            ag.tx = clamp(setPiece.x + throwDir * 14, 8, 92);
            ag.ty = clamp(nearSideY, 8, 92);
            ag.intent = 'MAKE_RUN';
            ag.runToX = ag.tx;
            ag.runToY = ag.ty;
            lockedTargetIds.add(ag.id);
            return;
          } else if (spNormX >= 68 && idxT >= 2 && idxT <= 4) {
            // Box targets for potential long throw-in!
            ag.tx = clamp(throwRight ? 88 + (idxT - 2) * 2 : 12 - (idxT - 2) * 2, 7, 93);
            ag.ty = clamp(44 + (idxT - 2) * 6, 36, 64);
            ag.intent = 'MAKE_RUN';
            ag.runToX = ag.tx;
            ag.runToY = ag.ty;
            lockedTargetIds.add(ag.id);
            return;
          }
        } else {
          // Defenders mark close around the throw-in zone
          const dIdx = setPiece.throwDefIds ? setPiece.throwDefIds.indexOf(ag.id) : -1;
          if (dIdx >= 0) {
            ag.tx = clamp(setPiece.x + (dIdx - 1) * 7, 7, 93);
            ag.ty = clamp(setPiece.y < 50 ? 12 + dIdx * 6 : 88 - dIdx * 6, 10, 90);
            ag.intent = 'MARK';
            lockedTargetIds.add(ag.id);
            return;
          }
        }
      }

      // Corner kick structured box zoning (CBs + FWs sprint into box zones; fullbacks stay on rest defense; taker sprints to corner flag)
      if (setPiece && setPiece.type === 'corner') {
        const isAtt = ag.side === setPiece.side;
        const cornerRight = isAttackRight(w, setPiece.side);
        const toCornerX = (normX: number) => (cornerRight ? normX : 100 - normX);
        if (ag.pos === 'GK') {
          if (isAtt) {
            ag.tx = cornerRight ? 8.5 : 91.5;
            ag.ty = 50;
          } else {
            ag.tx = cornerRight ? 97.4 : 2.6;
            ag.ty = setPiece.y < 50 ? 48.0 : 52.0;
          }
          ag.intent = 'RESET';
          lockedTargetIds.add(ag.id);
          return;
        }
        if (isAtt) {
          if (cornerTaker?.id === ag.id) {
            ag.tx = clamp(setPiece.x + (cornerRight ? -0.7 : 0.7), 1.8, 98.2);
            ag.ty = clamp(setPiece.y < 50 ? 2.5 : 97.5, 2.3, 97.7);
            ag.intent = 'RESET';
            lockedTargetIds.add(ag.id);
            return;
          }
          const idx = cornerAttList.findIndex((z) => z.id === ag.id);
          if (idx >= 0) {
            const boxZones: [number, number][] = [
              [91.4, 40.5], // Near post flick (Top CB / Aerial target)
              [88.4, 50.0], // Penalty spot (CB / Main Striker)
              [91.0, 59.5], // Far post (CB / Target)
              [85.6, 44.5], // Central 6-yard runner
              [85.2, 55.5], // Secondary box runner
              [78.2, 48.5], // Edge of box D-arc (rebound/cutback)
              [75.5, 34.0], // Rest defense / short-corner screen
              [60.0, 38.0], // Rest defense left
              [58.0, 62.0], // Rest defense right
              [50.0, 50.0]  // Deep sweep
            ];
            const [znX, znY] = boxZones[idx] || [54, 50];
            ag.intent = idx < 5 ? 'RESET' : 'SUPPORT';
            ag.tx = clamp(toCornerX(znX), 6, 94);
            ag.ty = clamp(setPiece.y > 50 ? 100 - znY : znY, 10, 90);
            ag.runToX = idx < 5 ? ag.tx : undefined;
            ag.runToY = idx < 5 ? ag.ty : undefined;
            lockedTargetIds.add(ag.id);
            return;
          }
        } else {
          const defIdx = cornerDefList.findIndex((z) => z.id === ag.id);
          if (defIdx >= 0) {
            const defZones: [number, number][] = [
              [93.2, 41],  // Near post zonal
              [92.8, 50],  // Central 6y guard
              [93.0, 59],  // Far post guard
              [88.8, 45],  // Penalty spot marker
              [88.4, 56],  // Penalty spot marker 2
              [82.8, 42],  // Short-corner / edge screen
              [82.2, 58],  // Edge of box clearance
              [74.0, 50],  // Counter link
              [58.0, 38],  // Outlet left
              [56.0, 62]   // Outlet right
            ];
            const [znX, znY] = defZones[defIdx] || [64, 50];
            // Defending team pushes counter outlets forward toward midfield on Counter ('Z')
            const outShift = cfg.tac === 'Z' && defIdx >= 7 ? -10 : 0;
            ag.intent = defIdx < 6 ? 'RESET' : 'SUPPORT';
            ag.tx = clamp(toCornerX(clamp(znX + outShift, 44, 94.5)), 5, 95);
            ag.ty = clamp(setPiece.y > 50 ? 100 - znY : znY, 10, 90);
            lockedTargetIds.add(ag.id);
            return;
          }
        }
      }

      // Goalkeeper AI (bisector angle-narrowing when defending; smart sweeper push when in possession; preserve active DIVE!)
      if (ag.pos === 'GK') {
        if (ag.intent === 'DIVE' && ag.intentTimer > 0 && ag.diveTargetY != null) {
          ag.ty = ag.diveTargetY;
          ag.runToX = undefined;
          ag.runToY = undefined;
          lockedTargetIds.add(ag.id);
          return;
        }
        if (b.flightType === 'bounce' && b.bounceNext?.looseRebound && !b.carrierId && ag.side !== b.possessionSide) {
          const ownGoalX = attRight ? 2.0 : 98.0;
          if (Math.hypot(ownGoalX - b.toX, 50 - b.toY) < 13.5) {
            ag.tx = clamp(b.toX, 1.8, 98.2);
            ag.ty = clamp(b.toY, 40.5, 59.5);
            ag.intent = 'PRESS';
            ag.runToX = undefined;
            ag.runToY = undefined;
            lockedTargetIds.add(ag.id);
            return;
          }
        }
        const goalX = attRight ? 2.2 : 97.8;
        const ballDistGoal = Math.hypot(b.x - goalX, b.y - 50);
        const ballThreat = attRight ? clamp((36 - b.x) / 34, 0, 1) : clamp((b.x - 64) / 34, 0, 1);
        const oppProgress = attRight ? b.x : 100 - b.x;
        const sweepBonus = ag.sig === 'cl' ? 1.5 : 0;
        const sweeperDrive = inPoss
          ? clamp((oppProgress - 35) / 55, 0.25, 1) * ((ag.d.cl > 68 ? 5.8 : 3.4) + sweepBonus + (cfg.line === 2 ? 2.0 : 0))
          : ballThreat * ((ag.d.cl > 68 ? 3.2 : 1.8) + sweepBonus) * (ballDistGoal < 14 ? 1.2 : 0.85);
        ag.tx = clamp(goalX + dir * (0.7 + sweeperDrive), 2.0, 98.0);
        const angleFactor = inPoss ? 0.18 : ballThreat > 0.35 ? 0.28 : 0.22;
        ag.ty = clamp(50 + (b.y - 50) * angleFactor, 43.2, 56.8);
        ag.intent = 'SUPPORT';
        ag.runToX = undefined;
        ag.runToY = undefined;
        lockedTargetIds.add(ag.id);
        return;
      }

      // Normalized longitudinal coordinates: 0 = own goal line, 100 = opponent goal line
      const homeBaseX = clamp(100 - ag.slotY, 10, 90);
      const rawSlotY = attRight ? ag.slotX : 100 - ag.slotX;
      const widthScale = cfg.wid === 2 ? 1.24 : cfg.wid === 0 ? 0.78 : 1.02;
      const widenedY = clamp(50 + (rawSlotY - 50) * widthScale, 5.5, 94.5);

      const ballNormX = attRight ? b.x : 100 - b.x;
      const lineOffset = cfg.line === 2 ? 7.0 : cfg.line === 0 ? -6.0 : 0;
      const tacOffset = cfg.pushShift * 0.52;
      const possBoost = inPoss ? (cfg.tac === 'X' ? 7.5 : cfg.tac === 'A' ? 6.5 : cfg.tac === 'Z' ? 1.5 : 5.0) : -3.4;
      const zoneFactor = ag.pos === 'DF' ? 0.36 : ag.pos === 'MF' ? 0.54 : 0.60;

      let normX = homeBaseX + (ballNormX - 50) * zoneFactor + tacOffset + lineOffset + possBoost;
      // Lateral ball-flank shift (narrow keeps compact center; wide maintains touchline stretch)
      const flankPull = inPoss ? (cfg.wid === 2 ? 0.08 : cfg.wid === 0 ? 0.17 : 0.11) : cfg.wid === 0 ? 0.24 : 0.18;
      let ty = widenedY + (b.y - 50) * flankPull;

      ag.intent = inPoss ? 'SUPPORT' : 'MARK';
      ag.runToX = undefined;
      ag.runToY = undefined;

      if (b.flightType === 'bounce' && b.bounceNext?.looseRebound && !b.carrierId) {
        const rb = b.bounceNext.looseRebound;
        const penaltyTakerLocked = Boolean(rb.fromPenalty && rb.prevShooterId === ag.id);
        if (!penaltyTakerLocked) {
          const sideOutfield = activeAgents
            .filter((z) => z.side === ag.side && z.pos !== 'GK' && !(rb.fromPenalty && rb.prevShooterId === z.id))
            .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY));
          const rankIdx = sideOutfield.findIndex((z) => z.id === ag.id);
          const distToLanding = Math.hypot(ag.x - b.toX, ag.y - b.toY);
          if (rankIdx >= 0 && rankIdx < 3 && distToLanding < 30) {
            ag.tx = clamp(b.toX + (rankIdx === 0 ? 0 : (rankIdx === 1 ? -1.4 : 1.4)), 3.5, 96.5);
            ag.ty = clamp(b.toY + (rankIdx === 0 ? 0 : (rankIdx === 1 ? -1.8 : 1.8)), 7, 93);
            ag.intent = ag.side === b.possessionSide ? 'PASS_TARGET' : 'PRESS';
            lockedTargetIds.add(ag.id);
            return;
          }
        }
      }

      if (b.carrierId === ag.id) {
        ag.intent = 'CARRY';
        const pendingCarryShot = w.ball.bounceNext?.pendingShot;
        if (pendingCarryShot && pendingCarryShot.shooterId === ag.id) {
          normX = attRight ? pendingCarryShot.destX : 100 - pendingCarryShot.destX;
          ty = clamp(pendingCarryShot.destY, 6, 94);
          ag.runToX = pendingCarryShot.destX;
          ag.runToY = pendingCarryShot.destY;
          lockedTargetIds.add(ag.id);
        } else {
          const curNormX = attRight ? ag.x : 100 - ag.x;
          // Near the byline/6-yard box, look to cut inside at an angle rather than running onto the goal line
          const nextNormX = curNormX > 88 ? curNormX + 1.5 : curNormX + (cfg.tempo === 2 ? 5.0 : cfg.tempo === 0 ? 2.5 : 4.0);
          normX = clamp(nextNormX, 6, 92.5);
          ty = clamp(ag.y + (50 - ag.y) * (curNormX > 85 ? 0.22 : cfg.wid === 0 ? 0.14 : 0.07), 7, 93);
        }
      } else if (b.targetId === ag.id) {
        ag.intent = 'PASS_TARGET';
        normX = attRight ? b.toX : 100 - b.toX;
        ty = clamp(b.toY, 6, 94);
        lockedTargetIds.add(ag.id);
      } else if (inPoss) {
        const oppDefRaw = isH ? aDefLineX : hDefLineX;
        const oppDefNorm = clamp(attRight ? oppDefRaw : 100 - oppDefRaw, 53, 90.5);
        const carrierNormX = carrier ? (attRight ? carrier.x : 100 - carrier.x) : ballNormX;
        const sigRunBoost = ag.sig === 'run' || ag.sig === 'spd' ? 2.0 : 0;
        const attPushBias = cfg.tac === 'X' ? 3.5 : cfg.tac === 'A' ? 2.0 : cfg.tac === 'Z' ? -5.0 : cfg.tac === 'D' ? -2.5 : 0;

        // ROLE-DISTINCT OFF-BALL INTELLIGENCE (anchored faithfully to each player's formation lane & line)
        if (baseRoleOf(ag.role) === 'ST' || (ag.sig === 'run' && ag.pos === 'FW' && ag.role !== 'LW' && ag.role !== 'RW' && ag.role !== 'CF')) {
          const shoulderNorm = Math.min(88.5, oppDefNorm - 1.8);
          const readyToSprint = ballNormX > 52 && carrier && carrier.side === ag.side && (cfg.pass >= 2 || cfg.tempo === 2 || cfg.tac === 'A' || cfg.tac === 'X');
          const wideCrossSituation = ballNormX > 66 && Math.abs(b.y - 50) > 20;
          let stLaneY = clamp(widenedY * 0.78 + 50 * 0.22 + (b.y - 50) * 0.14 + Math.sin(w.minuteFloat * 0.9 + ag.slotIndex) * 4.0, 18, 82);
          if (wideCrossSituation) {
            const boxStrikers = activeAgents
              .filter((z) => z.side === ag.side && z.id !== carrier?.id && (baseRoleOf(z.role) === 'ST' || z.role === 'CF'))
              .sort((u, v) => (attRight ? u.slotX - v.slotX : v.slotX - u.slotX));
            const sIdx = boxStrikers.findIndex((z) => z.id === ag.id);
            const ballTopSide = b.y < 50;
            if (boxStrikers.length >= 2 && sIdx >= 0) {
              const targetBoxY = sIdx === 0 ? (ballTopSide ? 43 : 57) : sIdx === 1 ? (ballTopSide ? 57 : 43) : 50;
              stLaneY = clamp(targetBoxY, 37, 63);
            } else {
              stLaneY = clamp(ballTopSide ? 46 : 54, 40, 60);
            }
          }
          if (readyToSprint && normX < 88.8) {
            normX = clamp(Math.min(oppDefNorm - 1.1, Math.max(normX, shoulderNorm)), 18, 89.2);
            ty = stLaneY;
            ag.intent = 'MAKE_RUN';
            const runNorm = clamp(Math.min(oppDefNorm + 0.15, normX + 2.5 + sigRunBoost * 0.35), 18, 89.6);
            ag.runToX = attRight ? runNorm : 100 - runNorm;
            ag.runToY = clamp(ty + (50 - ty) * 0.14, 24, 76);
          } else {
            // Hold striker shoulder cleanly onside within assigned left/center/right lane
            normX = clamp(Math.min(shoulderNorm, Math.max(normX, carrierNormX + 8)), 20, 88.0);
            ty = stLaneY;
          }
        } else if (ag.role === 'CF') {
          // Drops into Zone 14 / D-arc link-up pocket while respecting lateral formation slot
          const pocketNorm = Math.min(83.5, Math.min(oppDefNorm - 5.2, Math.max(homeBaseX * 0.45 + 36, carrierNormX + 10 + attPushBias * 0.4)));
          normX = clamp(pocketNorm, 22, 84.5);
          ty = clamp(widenedY * 0.74 + (50 + (b.y - 50) * 0.25) * 0.26, 20, 80);
          ag.intent = 'SUPPORT';
        } else if (ag.role === 'CAM' || (ag.sig === 'run' && ag.pos === 'MF' && ag.role !== 'CDM' && ag.role !== 'LDM' && ag.role !== 'RDM' && ag.role !== 'LM' && ag.role !== 'RM')) {
          // Attacking midfielder stays anchored to their slot lane and joins edge-of-box pocket
          const camLaneY = clamp(widenedY * 0.74 + b.y * 0.26, 18, 82);
          const deepBoxTarget = ballNormX > 74 ? 82.0 : Math.min(oppDefNorm - 2.0, 84.5 + attPushBias * 0.3);
          if (ballNormX > 52 && cfg.tac !== 'Z') {
            normX = clamp(Math.min(deepBoxTarget, Math.max(homeBaseX + 5, carrierNormX + 10)), 26, 85.0);
            ty = camLaneY;
            ag.intent = 'MAKE_RUN';
            const runNorm = clamp(Math.min(oppDefNorm - 0.35, normX + 2.6), 26, 86.0);
            ag.runToX = attRight ? runNorm : 100 - runNorm;
            ag.runToY = clamp(ty + (50 - ty) * 0.12, 22, 78);
          } else {
            normX = clamp(Math.max(homeBaseX, carrierNormX + 9), 24, 79);
            ty = camLaneY;
          }
        } else if (ag.role === 'LW' || ag.role === 'RW') {
          const isLeftWing = ag.role === 'LW';
          const touchlineOffset = cfg.wid === 2 ? 7 : cfg.wid === 0 ? 22 : 12;
          const sideY = attRight ? (isLeftWing ? touchlineOffset : 100 - touchlineOffset) : isLeftWing ? 100 - touchlineOffset : touchlineOffset;
          const wingLaneY = clamp(widenedY * 0.45 + sideY * 0.55, 6, 94);
          const ballOnSameFlank = Math.abs(b.y - wingLaneY) < 28;
          if (ballNormX > 64 && !ballOnSameFlank) {
            // Far-side winger attacks back-post half-space onside
            normX = clamp(Math.min(oppDefNorm - 1.5, 87.5), 24, 88.2);
            ty = clamp(attRight ? (isLeftWing ? 28 : 72) : isLeftWing ? 72 : 28, 22, 78);
            ag.intent = 'MAKE_RUN';
            const runNorm = clamp(Math.min(oppDefNorm + 0.05, normX + 2.6), 24, 88.6);
            ag.runToX = attRight ? runNorm : 100 - runNorm;
            ag.runToY = ty;
          } else if (ballNormX > 46 && cfg.tac !== 'Z') {
            normX = clamp(Math.min(oppDefNorm - 1.4, Math.max(homeBaseX, normX + 5 + sigRunBoost * 0.7 + attPushBias * 0.45)), 24, 87.8);
            ty = wingLaneY;
            ag.intent = 'MAKE_RUN';
            const runNorm = clamp(Math.min(oppDefNorm + 0.0, normX + 2.6), 24, 88.4);
            ag.runToX = attRight ? runNorm : 100 - runNorm;
            ag.runToY = ty;
          } else {
            ty = wingLaneY;
          }
        } else if (ag.role === 'LM' || ag.role === 'RM') {
          // Wide midfielders stay connected to the midfield bank on their touchline instead of pushing onto the goal line
          const isLeftMid = ag.role === 'LM';
          const touchlineOffset = cfg.wid === 2 ? 7 : cfg.wid === 0 ? 22 : 12;
          const sideY = attRight ? (isLeftMid ? touchlineOffset : 100 - touchlineOffset) : isLeftMid ? 100 - touchlineOffset : touchlineOffset;
          const wideMidY = clamp(widenedY * 0.55 + sideY * 0.45, 6, 94);
          const ballOnSameFlank = Math.abs(b.y - wideMidY) < 28;
          const midWingCap = cfg.tac === 'Z' ? 58 : cfg.tac === 'D' ? 66 : cfg.tac === 'X' ? 82 : 77;
          if (ballNormX > 72 && !ballOnSameFlank && cfg.tac !== 'Z') {
            normX = clamp(Math.min(oppDefNorm - 3.5, midWingCap + 2), 26, 82);
            ty = clamp(attRight ? (isLeftMid ? 28 : 72) : isLeftMid ? 72 : 28, 22, 78);
          } else {
            normX = clamp(Math.min(oppDefNorm - 5.5, normX + 4 + attPushBias * 0.4), 22, midWingCap);
            ty = wideMidY;
          }
        } else if (ag.role === 'LB' || ag.role === 'RB' || ag.role === 'LWB' || ag.role === 'RWB') {
          const isLeftFb = ag.role === 'LB' || ag.role === 'LWB';
          const fbOffset = cfg.wid === 2 ? 6.5 : cfg.wid === 0 ? 17 : 10;
          const fbY = attRight ? (isLeftFb ? fbOffset : 100 - fbOffset) : isLeftFb ? 100 - fbOffset : fbOffset;
          const anchoredFbY = clamp(widenedY * 0.55 + fbY * 0.45, 6, 94);
          const ballOnMySide = Math.abs(b.y - anchoredFbY) < 34;
          const canOverlap =
            cfg.tac !== 'Z' &&
            (cfg.tac === 'X' ||
              cfg.tac === 'A' ||
              ag.role === 'LWB' ||
              ag.role === 'RWB' ||
              (cfg.tac === 'B' && (cfg.wid === 2 || ag.sig === 'spd' || ag.sig === 'crs')));
          if (ballNormX > 50 && ballOnMySide && canOverlap) {
            normX = clamp(Math.min(oppDefNorm - 2.0, ballNormX + 8 + sigRunBoost * 0.8), 22, 82);
            ty = anchoredFbY;
            ag.intent = 'OVERLAP';
            const runNorm = clamp(Math.min(oppDefNorm + 0.4, normX + 4.0), 22, 84.5);
            ag.runToX = attRight ? runNorm : 100 - runNorm;
            ag.runToY = ty;
          } else {
            const fbCap = cfg.tac === 'X' ? 74 : cfg.tac === 'A' ? 62 : cfg.tac === 'D' ? 46 : cfg.tac === 'Z' ? 37 : 54;
            normX = clamp(normX, 16, fbCap);
            ty = anchoredFbY;
          }
        } else if (ag.pos === 'DF') {
          // Center backs hold rest defense line; in Siege (X) they push up to halfway, leaving space behind!
          const cbCap = cfg.tac === 'X' ? 67 : cfg.tac === 'A' ? 57 : cfg.tac === 'D' ? 42 : cfg.tac === 'Z' ? 33 : 50;
          normX = clamp(normX, 13, cbCap);
          ty = clamp(50 + (widenedY - 50) * (cfg.wid === 0 ? 0.65 : 0.84) + (b.y - 50) * 0.12, 22, 78);
        } else if (ag.role === 'CDM' || ag.role === 'LDM' || ag.role === 'RDM') {
          // Holding pivot screens behind the ball and preserves double-pivot lateral spacing
          const dmCap = cfg.tac === 'Z' ? 44 : cfg.tac === 'D' ? 54 : cfg.tac === 'X' ? 74 : 62;
          normX = clamp(Math.min(normX, Math.max(homeBaseX - 3, carrierNormX - 4)), 19, dmCap);
          ty = clamp(widenedY * 0.78 + (50 + (b.y - 50) * 0.2) * 0.22, 18, 82);
        } else if (attMids.some((m) => m.id === ag.id) && carrier) {
          const idxM = attMids.findIndex((m) => m.id === ag.id);
          if (carrierNormX >= (cfg.tac === 'X' ? 72 : 80) && cfg.tac !== 'Z') {
            normX = clamp(idxM === 0 ? (cfg.tac === 'X' ? 83 : 76) : cfg.tac === 'X' ? 78 : 71, 22, 86);
            ty = clamp(widenedY * 0.54 + (50 + (idxM === 0 ? -11 : 11)) * 0.46, 16, 84);
          } else {
            const triDist = cfg.pass === 0 ? 10 : cfg.pass >= 2 ? 16 : 13;
            normX = clamp(homeBaseX * 0.38 + (carrierNormX + triDist * 0.45) * 0.62 + attPushBias * 0.35, 22, cfg.tac === 'Z' ? 58 : cfg.tac === 'X' ? 84 : 78);
            ty = clamp(widenedY * 0.65 + (carrier.y + (idxM === 0 ? -8 : 8)) * 0.35, 14, 86);
          }
          ag.intent = 'SUPPORT';
        } else {
          // Supporting central midfield holds formation slot depth & width
          normX = clamp(normX, 20, cfg.tac === 'Z' ? 54 : cfg.tac === 'D' ? 64 : cfg.tac === 'X' ? 81 : 74);
          ty = clamp(widenedY * 0.78 + (b.y - 50) * 0.18 + 50 * 0.04, 14, 86);
        }
      } else {
        // OUT OF POSSESSION: Strictly reflects Mentality (tac), Defensive Line (line), Pressing (press), Width (wid), and slot structure
        const tacBackDrop = cfg.tac === 'Z' ? -6.5 : cfg.tac === 'D' ? -3.0 : cfg.tac === 'X' ? 7.5 : cfg.tac === 'A' ? 3.5 : 0;
        const baseLineFloor = (cfg.line === 2 ? 20.5 : cfg.line === 0 ? 10.0 : 14.5) + tacBackDrop;
        // Emergency box drop: when opponent penetrates own defensive third, even High Line drops into the box to defend goal!
        const lineHeightFloor = ballNormX < 34 ? Math.min(baseLineFloor, Math.max(6.8, ballNormX - 5.2)) : baseLineFloor;
        const lineCeiling = cfg.tac === 'X' ? 56 : cfg.tac === 'Z' ? 28 : cfg.line === 2 ? 48 : cfg.line === 0 ? 32 : 41;
        const backLineNorm = clamp(
          Math.min(ballNormX - 7.0, 31 + (cfg.line - 1) * 8.5 + tacBackDrop),
          Math.max(6.8, lineHeightFloor),
          lineCeiling
        );
        const pressTriggerLimit = cfg.tac === 'X' ? 98 : cfg.tac === 'Z' ? 42 : cfg.press === 2 ? 95 : cfg.press === 1 ? 68 : 49;
        const shouldEngagePress = ballNormX <= pressTriggerLimit;

        if (ag.id === primaryPresserId) {
          if (shouldEngagePress) {
            ag.intent = 'PRESS';
            const stepX = cfg.press === 2 ? ballNormX - 0.8 : ballNormX - 2.2;
            normX = clamp(stepX, 7.2, 92);
            ty = clamp(b.y, 7, 93);
          } else {
            ag.intent = 'MARK';
            normX = clamp(Math.min(ballNormX - 6.5, backLineNorm + 14), 14, 62);
            ty = clamp(widenedY * 0.4 + (b.y + (50 - b.y) * 0.25) * 0.6, 12, 88);
          }
        } else if (ag.id === secondaryCoverId) {
          ag.intent = cfg.press === 2 && shouldEngagePress ? 'PRESS' : 'MARK';
          const coverGap = cfg.press === 2 ? 3.5 : cfg.press === 0 ? 8.5 : 6.0;
          normX = clamp(Math.max(backLineNorm + 2.0, ballNormX - coverGap), 8.2, 88);
          ty = clamp(widenedY * 0.35 + (b.y + (50 - b.y) * (cfg.press === 2 ? 0.22 : 0.36)) * 0.65, 12, 88);
        } else if (ag.id === thirdTrapPresserId && shouldEngagePress && ballNormX > 36) {
          ag.intent = 'PRESS';
          normX = clamp(Math.max(backLineNorm + 8, ballNormX - 11), 22, 86);
          ty = clamp(widenedY * 0.45 + (50 + (b.y < 50 ? 12 : -12)) * 0.55, 16, 84);
        } else if (ag.pos === 'DF') {
          const isFb = ag.role === 'LB' || ag.role === 'RB' || ag.role === 'LWB' || ag.role === 'RWB';
          if (isFb) {
            const isLeftFb = ag.role === 'LB' || ag.role === 'LWB';
            const defFbSpread = cfg.wid === 0 ? 28 : cfg.wid === 2 ? 37 : 34;
            const fbSideY = attRight ? (isLeftFb ? 50 - defFbSpread : 50 + defFbSpread) : isLeftFb ? 50 + defFbSpread : 50 - defFbSpread;
            const targetFbY = widenedY * 0.5 + fbSideY * 0.5;
            const ballOnFlank = Math.abs(b.y - targetFbY) < 30;
            const farSideTuck = cfg.wid === 0 ? 0.44 : cfg.wid === 2 ? 0.64 : 0.54;
            normX = clamp(normX * 0.24 + (backLineNorm + (ballOnFlank && cfg.tac !== 'Z' ? 2.0 : 0.4)) * 0.76, Math.max(7.8, backLineNorm), lineCeiling + 3);
            ty = ballOnFlank
              ? clamp(targetFbY * 0.66 + b.y * 0.34, 9, 91)
              : clamp(50 + (targetFbY - 50) * farSideTuck + (b.y - 50) * 0.14, 16, 84);
          } else {
            normX = clamp(normX * 0.16 + backLineNorm * 0.84, Math.max(7.2, backLineNorm - 0.5), lineCeiling + 1);
            ty = clamp(50 + (widenedY - 50) * (cfg.wid === 0 ? 0.6 : 0.74) + (b.y - 50) * 0.18, 22, 78);
          }
        } else if (ag.role === 'CDM' || ag.role === 'LDM' || ag.role === 'RDM') {
          const dmGap = cfg.tac === 'Z' ? 6.5 : cfg.tac === 'D' ? 8.0 : 10.0;
          normX = clamp(Math.max(backLineNorm + dmGap, normX), 16.5, cfg.tac === 'Z' ? 46 : 58);
          ty = clamp(widenedY * 0.74 + (50 + (b.y - 50) * 0.35) * 0.26, 16, 84);
        } else if (ag.role === 'CM' || ag.role === 'LCM' || ag.role === 'RCM' || ag.role === 'LM' || ag.role === 'RM') {
          const cmGap = cfg.tac === 'Z' ? 11.0 : cfg.tac === 'D' ? 13.5 : 16.0;
          normX = clamp(Math.max(backLineNorm + cmGap, normX), 21, cfg.tac === 'Z' ? 52 : 66);
          ty = clamp(widenedY * 0.74 + (50 + (b.y - 50) * 0.32) * 0.26, 10, 90);
        } else if (ag.pos === 'MF') {
          const amGap = cfg.tac === 'Z' ? 14.5 : cfg.tac === 'D' ? 17.5 : 21.0;
          normX = clamp(Math.max(backLineNorm + amGap, normX), 24, cfg.tac === 'Z' ? 58 : 73);
          ty = clamp(widenedY * 0.72 + (50 + (b.y - 50) * 0.3) * 0.28, 16, 84);
        } else {
          const fwFloor =
            cfg.tac === 'Z'
              ? Math.max(26, backLineNorm + 18)
              : cfg.pass === 3
                ? Math.max(38, backLineNorm + 25)
                : Math.max(32, backLineNorm + 22);
          normX = clamp(Math.max(fwFloor, normX), 26, cfg.press === 2 ? 84 : 78);
          ty = clamp(widenedY * 0.72 + (50 + (b.y - 50) * 0.28) * 0.28, 14, 86);
        }
      }

      const tx = attRight ? normX : 100 - normX;
      ag.tx = clamp(tx, 4.5, 95.5);
      ag.ty = clamp(ty, 5.5, 94.5);
    });

    // Two-pass target-space separation + goalkeeper box clearance so players keep readable tactical spacing
    const outfield = activeAgents.filter((a) => a.pos !== 'GK' && !lockedTargetIds.has(a.id));
    const gks = activeAgents.filter((a) => a.pos === 'GK');

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < outfield.length; i++) {
        const a = outfield[i];
        const inGoalZone = a.tx < 20 || a.tx > 80;
        const minMateDist = inGoalZone ? 7.4 : 6.4;

        for (let j = i + 1; j < outfield.length; j++) {
          const o = outfield[j];
          const dx = a.tx - o.tx;
          const dy = a.ty - o.ty;
          const d = Math.hypot(dx, dy);

          if (a.side === o.side) {
            if (d < minMateDist) {
              const nx = d > 0.05 ? dx / d : (a.slotIndex % 2 === 0 ? 0.6 : -0.6);
              const ny = d > 0.05 ? dy / d : (a.slotIndex % 2 === 0 ? 0.8 : -0.8);
              const push = (minMateDist - d) * 0.48;
              a.tx = clamp(a.tx + nx * push, 4.5, 95.5);
              a.ty = clamp(a.ty + ny * push, 5.5, 94.5);
              o.tx = clamp(o.tx - nx * push, 4.5, 95.5);
              o.ty = clamp(o.ty - ny * push, 5.5, 94.5);
            }
          } else {
            const isDuel = a.intent === 'PRESS' || o.intent === 'PRESS' || a.id === b.carrierId || o.id === b.carrierId;
            const minOppDist = isDuel ? 2.2 : inGoalZone ? 3.8 : 3.2;
            if (d > 0.05 && d < minOppDist) {
              const push = (minOppDist - d) * 0.35;
              a.tx = clamp(a.tx + (dx / d) * push, 4.5, 95.5);
              a.ty = clamp(a.ty + (dy / d) * push, 5.5, 94.5);
              o.tx = clamp(o.tx - (dx / d) * push, 4.5, 95.5);
              o.ty = clamp(o.ty - (dy / d) * push, 5.5, 94.5);
            }
          }
        }

        // Keep outfield players from standing right on top of the goalkeeper
        for (let g = 0; g < gks.length; g++) {
          const gk = gks[g];
          const dx = a.tx - gk.tx;
          const dy = a.ty - gk.ty;
          const d = Math.hypot(dx, dy);
          const gkClear = a.id === b.carrierId ? 2.4 : 4.8;
          if (d < gkClear) {
            const nx = d > 0.05 ? dx / d : (gk.tx < 50 ? 1 : -1);
            const ny = d > 0.05 ? dy / d : (a.slotIndex % 2 === 0 ? 0.5 : -0.5);
            a.tx = clamp(gk.tx + nx * gkClear, 4.5, 95.5);
            a.ty = clamp(gk.ty + ny * gkClear, 5.5, 94.5);
          }
        }
      }
    }
  };

  const isOnRainyPuddle = (w: LiveMatchWorld, x: number, y: number): boolean => {
    if (w.env?.season !== 'rainy' || !w.env.puddles?.length) return false;
    return w.env.puddles.some((pd) => {
      const dx = (x - pd.x) / Math.max(0.8, pd.rx);
      const dy = (y - pd.y) / Math.max(0.8, pd.ry);
      return dx * dx + dy * dy <= 1.85;
    });
  };

  const triggerAgentSlipFx = (
    w: LiveMatchWorld,
    ag: LivePitchAgent,
    fxLabel: string,
    formPenalty = -0.15
  ) => {
    ag.acrobatType = 'slip';
    ag.acrobatMax = 0.88;
    ag.acrobatTimer = 0.88;
    ag.skillSpinDir = Math.random() < 0.5 ? 1 : -1;
    ag.intent = 'MARK';
    ag.intentTimer = 0.82;
    adjustLiveForm(ag.id, formPenalty);
    addWorldFx(w, {
      type: 'slip',
      x: ag.x,
      y: ag.y,
      label: fxLabel,
      color: '#38bdf8',
      ttl: 1.9,
      maxTtl: 1.9
    });
    SFX.slip();
    SFX.boo(0.45);
  };

  const shouldShooterWhiff = (
    w: LiveMatchWorld,
    shooter: LivePitchAgent | undefined,
    nearestDefDist: number,
    shotStyle: LiveBallState['shotStyle'],
    isFirstTime = false
  ): boolean => {
    if (!shooter || shooter.pos === 'GK') return false;
    const isAcro = shotStyle === 'bicycle' || shotStyle === 'volley' || shotStyle === 'diving_header';
    const isRainy = w.env?.season === 'rainy';
    const inPuddle = isOnRainyPuddle(w, shooter.x, shooter.y);
    const finComp = ((shooter.d.fin || 60) + (shooter.d.comp || 60)) * 0.5;
    let p = isFirstTime ? 0.044 : 0.028;
    if (isAcro) p += 0.028;
    if (isRainy) p += 0.012;
    if (inPuddle) p += 0.022;
    if (shooter.fit < 55) p += 0.022;
    if (nearestDefDist < 5.5) p += 0.015;
    p -= (finComp - 60) * 0.0006;
    if ((shooter.blessedMins ?? 0) > 0) p *= 0.22;
    if (agentHasTrait(shooter, 'poacher_instinct') || shooter.tr === 23) p *= 0.72;
    p *= turfMatchMods.whiffMult;
    return Math.random() < clamp(p, 0.01, 0.15);
  };

  const launchWhiffLooseBall = (
    w: LiveMatchWorld,
    curMin: number,
    side: 'H' | 'A',
    shooter: LivePitchAgent,
    attTeam: Team,
    defPool: LivePitchAgent[],
    attRightNow: boolean,
    contextText = 'ง้างเท้ายิงเต็มเหนี่ยวแต่เตะวืดลม!'
  ) => {
    const b = w.ball;
    const defSide: 'H' | 'A' = side === 'H' ? 'A' : 'H';
    const defRightNow = isAttackRight(w, defSide);
    const dir = attRightNow ? 1 : -1;
    shooter.acrobatType = 'whiff';
    shooter.acrobatMax = 0.78;
    shooter.acrobatTimer = 0.78;
    adjustLiveForm(shooter.id, -0.14);
    addWorldFx(w, {
      type: 'whiff',
      x: shooter.x,
      y: shooter.y,
      label: `💨 เตะวืด!! (${shooter.shortName})`,
      color: '#fb923c',
      ttl: 1.9,
      maxTtl: 1.9
    });
    SFX.whiff();
    SFX.boo(0.45);
    triggerCoachMood(w, side, '🤦', 2.0);
    const trickleDist = 4.5 + Math.random() * 4.5;
    const endX = clamp(shooter.x + dir * trickleDist, 1.5, 98.5);
    const endY = clamp(shooter.y + (Math.random() - 0.5) * 14, 14, 86);
    const nearDef = defPool
      .slice()
      .sort((u, v) => Math.hypot(u.x - endX, u.y - endY) - Math.hypot(v.x - endX, v.y - endY))[0];
    const rollOutGoalLine = (attRightNow && shooter.x > 91.5 && Math.random() < 0.45) || (!attRightNow && shooter.x < 8.5 && Math.random() < 0.45);
    b.fromX = shooter.x;
    b.fromY = shooter.y;
    b.toX = rollOutGoalLine ? (attRightNow ? 100.6 : -0.6) : endX;
    b.toY = endY;
    b.curve = 0;
    b.maxZ = 0.5;
    b.startZ = 0;
    b.endZ = 0;
    b.progress = 0;
    b.duration = 0.46;
    b.flightType = 'bounce';
    b.shotStyle = undefined;
    b.carrierId = null;
    b.targetId = rollOutGoalLine ? null : nearDef?.id || null;
    b.possessionSide = side;
    b.bounceNext = rollOutGoalLine
      ? {
          setPiece: {
            type: 'goalkick',
            side: defSide,
            x: defRightNow ? 5.5 : 94.5,
            y: 50,
            waitSec: 0.85
          },
          phaseLabel: `💨 ${shooter.shortName} เตะวืดบอลกลิ้งออกหลัง!`,
          phaseTone: 'normal'
        }
      : {
          carrierId: nearDef?.id,
          possessionSide: nearDef ? defSide : side,
          phaseLabel: nearDef
            ? `💨 ${shooter.shortName} เตะวืด! ${nearDef.shortName} เก็บบอลได้`
            : `💨 ${shooter.shortName} เตะวืด!`,
          phaseTone: 'normal'
        };
    w.phaseLabel = `💨 เตะวืด!! ${shooter.shortName} เตะลมอย่างน่าเสียดาย!`;
    w.phaseTone = 'normal';
    pushLog(curMin, `💨 เตะวืด! ${shooter.id} (${attTeam.name}) ${contextText}`);
  };

  const launchOwnGoalShot = (
    w: LiveMatchWorld,
    curMin: number,
    benefitingSide: 'H' | 'A',
    culprit: LivePitchAgent,
    culpritTeam: Team,
    reasonText: string
  ) => {
    const b = w.ball;
    const active = w.agents.filter((a) => !a.sentOff);
    const gk = active.find((a) => a.side === culprit.side && a.pos === 'GK');
    const oppAttRight = isAttackRight(w, benefitingSide);
    const ownGoalLineX = oppAttRight ? 101.3 : -1.3;
    const ownGoalY = clamp(50 + (Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 4.5), 42.8, 57.2);
    if (gk) {
      if (gk.intent === 'DIVE') gk.intent = 'SUPPORT';
      gk.diveProgress = 0;
      gk.diveTargetY = undefined;
    }
    const wrongY = clamp(50 - (ownGoalY - 50) * 0.9, 42.2, 57.8);
    const shotDist = Math.hypot(ownGoalLineX - culprit.x, ownGoalY - culprit.y);
    b.fromX = culprit.x;
    b.fromY = culprit.y;
    b.toX = ownGoalLineX;
    b.toY = ownGoalY;
    b.curve = (Math.random() - 0.5) * 3.5;
    b.maxZ = 4.6;
    b.startZ = 0;
    b.endZ = 0;
    b.progress = 0;
    b.duration = clamp(shotDist / 30, 0.34, 0.62);
    b.flightType = 'shot';
    b.shotStyle = 'deflected';
    b.carrierId = null;
    b.targetId = null;
    b.shooterId = culprit.id;
    b.lastPasserId = null;
    b.possessionSide = benefitingSide;
    b.bounceNext = undefined;
    b.shotPlan = {
      outcome: 'goal',
      ownGoalCulpritId: culprit.id,
      isPureOwnGoal: true,
      deflectedFrom: culprit.shortName,
      gkDiveTargetY: wrongY,
      gkDiveDir: gk ? (wrongY >= gk.y ? 1 : -1) : 1,
      gkDiveStartProg: clamp(1 - 7.8 / Math.max(7.2, shotDist), 0.28, 0.62)
    };
    culprit.acrobatType = 'clash';
    culprit.acrobatMax = 0.65;
    culprit.acrobatTimer = 0.65;
    w.phaseLabel = `😱 ระวัง!! ${culprit.shortName} สกัดผิดเหลี่ยมพุ่งเข้าประตูตัวเอง!!`;
    w.phaseTone = 'danger';
    triggerDramaSlow(w, 1.4, `😱 สกัดผิดเหลี่ยม!! ${culprit.shortName}`);
    SFX.kick();
    pushLog(curMin, `😱 จังหวะช็อก! ${culprit.id} (${culpritTeam.name}) ${reasonText}`);
  };

  const pickWoodworkTarget = (opts: {
    attRightNow: boolean;
    fromY: number;
    curveAmt: number;
    maxZAmt: number;
    shotStyle: LiveBallState['shotStyle'];
    flightType: 'shot' | 'freekick' | 'penalty' | 'shootout_kick';
  }): {
    woodworkPart: 'post' | 'crossbar' | 'corner_junction';
    postSide: -1 | 1;
    toX: number;
    toY: number;
    endZ: number;
    maxZ: number;
  } => {
    const { attRightNow, fromY, curveAmt, maxZAmt, shotStyle, flightType } = opts;
    const isFinesse =
      shotStyle === 'curler' ||
      shotStyle === 'trivela' ||
      flightType === 'freekick';
    const isAerialHigh =
      shotStyle === 'header' ||
      shotStyle === 'diving_header' ||
      shotStyle === 'volley' ||
      shotStyle === 'chip' ||
      shotStyle === 'panenka' ||
      shotStyle === 'screamer' ||
      shotStyle === 'knuckle' ||
      maxZAmt >= 3.6;

    const partRoll = Math.random();
    let woodworkPart: 'post' | 'crossbar' | 'corner_junction';
    if (isFinesse) {
      woodworkPart = partRoll < 0.36 ? 'corner_junction' : partRoll < 0.66 ? 'crossbar' : 'post';
    } else if (isAerialHigh) {
      woodworkPart = partRoll < 0.46 ? 'crossbar' : partRoll < 0.72 ? 'corner_junction' : 'post';
    } else {
      woodworkPart = partRoll < 0.56 ? 'post' : partRoll < 0.84 ? 'crossbar' : 'corner_junction';
    }

    // Choose realistic post side from shooting lane & curve direction
    let postSide: -1 | 1;
    if (Math.abs(curveAmt) > 1.8) {
      postSide = curveAmt > 0 ? (Math.random() < 0.72 ? 1 : -1) : Math.random() < 0.72 ? -1 : 1;
    } else if (Math.abs(fromY - 50) > 8) {
      // Wide-angle shots tend to clip the far post (~62%) or near post (~38%)
      const farSide: -1 | 1 = fromY < 50 ? 1 : -1;
      postSide = Math.random() < 0.62 ? farSide : (farSide === 1 ? -1 : 1);
    } else {
      postSide = Math.random() < 0.5 ? -1 : 1;
    }

    if (woodworkPart === 'corner_junction') {
      return {
        woodworkPart,
        postSide,
        toX: attRightNow ? 99.75 : 0.25,
        toY: postSide < 0 ? 42.2 : 57.8,
        endZ: 5.7,
        maxZ: clamp(maxZAmt * 0.36, 0.75, 1.85)
      };
    }
    if (woodworkPart === 'crossbar') {
      const barBiasY = clamp(50 + (fromY < 50 ? 2.5 : -2.5) + (Math.random() - 0.5) * 9.5, 44.0, 56.0);
      return {
        woodworkPart,
        postSide,
        toX: attRightNow ? 99.65 : 0.35,
        toY: barBiasY,
        endZ: 6.0,
        maxZ: clamp(maxZAmt * 0.36, 0.8, 1.95)
      };
    }
    return {
      woodworkPart,
      postSide,
      toX: attRightNow ? 99.75 : 0.25,
      toY: postSide < 0 ? 42.0 : 58.0,
      endZ: clamp(maxZAmt * 0.45, 0.4, 3.2),
      maxZ: clamp(maxZAmt * 0.58, 1.2, 3.0)
    };
  };

  const computeWoodworkBouncePhysics = (opts: {
    woodworkPart: 'post' | 'crossbar' | 'corner_junction';
    postSide: -1 | 1;
    hitX: number;
    hitY: number;
    hitZ: number;
    fromX: number;
    fromY: number;
    attRightNow: boolean;
    reboundChain: number;
  }): {
    inPlay: boolean;
    toX: number;
    toY: number;
    startZ: number;
    endZ: number;
    maxZ: number;
    duration: number;
  } => {
    const { woodworkPart, postSide, hitX, hitY, hitZ, fromX, fromY, attRightNow, reboundChain } = opts;
    const inDy = hitY - fromY;
    const wideAngle = Math.abs(fromY - 50) > 10;
    const farPost = postSide * (fromY - 50) < 0;
    const forceOut = reboundChain >= 2;

    if (woodworkPart === 'crossbar') {
      const goesOver = forceOut || Math.random() < 0.36;
      if (goesOver) {
        const toX = attRightNow ? 102.2 : -2.2;
        const toY = clamp(hitY + clamp(inDy * 0.2, -4.5, 4.5), 40.5, 59.5);
        return {
          inPlay: false,
          toX,
          toY,
          startZ: Math.max(5.4, hitZ),
          endZ: 0.4,
          maxZ: 3.9,
          duration: 0.38
        };
      }
      const toX = attRightNow ? 87.5 + Math.random() * 8.2 : 4.3 + Math.random() * 8.2;
      const toY = clamp(hitY + clamp(inDy * 0.22, -5.5, 5.5) + (Math.random() - 0.5) * 4.5, 38, 62);
      const d = Math.hypot(toX - hitX, toY - hitY);
      return {
        inPlay: true,
        toX,
        toY,
        startZ: Math.max(5.4, hitZ),
        endZ: 0,
        maxZ: 2.6,
        duration: clamp(d / 23, 0.40, 0.58)
      };
    }

    if (woodworkPart === 'corner_junction') {
      const goesWideHigh = forceOut || Math.random() < 0.38;
      if (goesWideHigh) {
        const toX = attRightNow ? 102.0 : -2.0;
        const toY = postSide < 0 ? 34.5 + Math.random() * 6.0 : 59.5 + Math.random() * 6.0;
        return {
          inPlay: false,
          toX,
          toY,
          startZ: Math.max(5.1, hitZ),
          endZ: 0.4,
          maxZ: 3.6,
          duration: 0.38
        };
      }
      const inwardShift = 4.2 + Math.random() * 8.5;
      const toX = attRightNow ? 85.8 + Math.random() * 8.0 : 6.2 + Math.random() * 8.0;
      const toY = clamp(hitY + (postSide < 0 ? inwardShift : -inwardShift), 39, 61);
      const d = Math.hypot(toX - hitX, toY - hitY);
      return {
        inPlay: true,
        toX,
        toY,
        startZ: Math.max(5.1, hitZ),
        endZ: 0,
        maxZ: 3.1,
        duration: clamp(d / 23, 0.42, 0.60)
      };
    }

    // Upright Goalpost ('post'): cylindrical surface reflection
    const glancesOut = forceOut || Math.random() < 0.28;
    if (glancesOut) {
      const toX = attRightNow ? 101.8 : -1.8;
      const toY = postSide < 0 ? 33.5 + Math.random() * 6.5 : 60.0 + Math.random() * 6.5;
      return {
        inPlay: false,
        toX,
        toY,
        startZ: clamp(hitZ, 0.4, 3.6),
        endZ: 0.2,
        maxZ: 1.9,
        duration: 0.34
      };
    }

    let toX: number;
    let toY: number;
    if (wideAngle && farPost) {
      // Far-post strike ricochets across the 6-yard face of goal
      toX = attRightNow ? 92.2 + Math.random() * 5.0 : 2.8 + Math.random() * 5.0;
      toY = clamp(hitY + (postSide < 0 ? 5.5 + Math.random() * 9.0 : -(5.5 + Math.random() * 9.0)), 41, 59);
    } else {
      // Near-post or central strike rebounds diagonally back into the penalty area
      toX = attRightNow ? 86.5 + Math.random() * 8.0 : 5.5 + Math.random() * 8.0;
      toY = clamp(hitY + (postSide < 0 ? -3.0 + Math.random() * 9.0 : 3.0 - Math.random() * 9.0), 36, 64);
    }
    const d = Math.hypot(toX - hitX, toY - hitY);
    return {
      inPlay: true,
      toX,
      toY,
      startZ: clamp(hitZ, 0.4, 3.6),
      endZ: 0,
      maxZ: clamp(hitZ * 0.45 + 1.0, 0.9, 2.9),
      duration: clamp(d / 24, 0.34, 0.54)
    };
  };

  // Pre-compute physically accurate shot trajectory (block, woodwork, off-target, GK save spot, or net goal)
  const prepareShotFlight = (
    w: LiveMatchWorld,
    curMin: number,
    opts: {
      flightType: 'shot' | 'freekick' | 'penalty';
      side: 'H' | 'A';
      fromX: number;
      fromY: number;
      shooter: LivePitchAgent | undefined;
      shotStyle: LiveBallState['shotStyle'];
      curveAmt: number;
      maxZAmt: number;
      durAmt: number;
      isPanenka?: boolean;
      startZAmt?: number;
      reboundChain?: number;
    }
  ) => {
    const b = w.ball;
    const sr = simRef.current;
    const { flightType, side, fromX, fromY, shooter, shotStyle, curveAmt, maxZAmt, durAmt, isPanenka, startZAmt, reboundChain = 0 } = opts;
    const defSide: 'H' | 'A' = side === 'H' ? 'A' : 'H';
    const attRightNow = isAttackRight(w, side);
    const active = w.agents.filter((a) => !a.sentOff);
    const defPool = active.filter((a) => a.side === defSide);
    const gk = defPool.find((a) => a.pos === 'GK') || defPool[0];
    const defenders = defPool.filter((a) => a.pos === 'DF' || a.pos === 'MF');

    const goalLineX = attRightNow ? 100 : 0;
    const normFromX = attRightNow ? fromX : 100 - fromX;
    const dist = Math.hypot(goalLineX - fromX, 50 - fromY);

    // Sanity Guard: NEVER allow an open-play shot from own half / in front of own goal!
    if (flightType === 'shot' && (normFromX < 49 || dist > 50)) {
      const attOutfield = active.filter((a) => a.side === side && a.pos !== 'GK' && a.id !== shooter?.id);
      const fwdTarget = attOutfield.sort((u, v) => (attRightNow ? v.x - u.x : u.x - v.x))[0] || shooter;
      if (fwdTarget) {
        b.fromX = fromX;
        b.fromY = fromY;
        b.toX = clamp(fwdTarget.x, 8, 92);
        b.toY = clamp(fwdTarget.y, 8, 92);
        b.curve = (Math.random() - 0.5) * 4;
        b.maxZ = 14;
        b.startZ = 0;
        b.endZ = 0;
        b.progress = 0;
        b.duration = 0.66;
        b.flightType = 'lofted';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = fwdTarget.id;
        b.lastPasserId = shooter?.id || null;
        b.possessionSide = side;
        b.shotPlan = undefined;
        b.bounceNext = undefined;
        w.phaseLabel = `🚀 ${shooter?.shortName || 'แนวรับ'} สาดยาวขึ้นหน้าให้ ${fwdTarget.shortName}`;
        w.phaseTone = 'normal';
        return;
      }
    }

    b.fromX = fromX;
    b.fromY = fromY;
    b.curve = curveAmt;
    b.maxZ = maxZAmt;
    b.startZ = startZAmt ?? 0;
    b.endZ = 0;
    b.progress = 0;
    b.duration = durAmt;
    b.flightType = flightType;
    b.shotStyle = shotStyle;
    b.carrierId = null;
    b.targetId = null;
    b.shooterId = shooter?.id || null;
    b.possessionSide = side;
    b.bounceNext = undefined;
    if (shooter) {
      shooter.facing = Math.atan2(50 - fromY, goalLineX - fromX);
      const keepAcro =
        (shooter.acrobatTimer ?? 0) > 0 &&
        (shooter.acrobatType === 'bicycle' ||
          shooter.acrobatType === 'volley' ||
          shooter.acrobatType === 'header' ||
          shooter.acrobatType === 'diving_header');
      const kickKind: LivePitchAgent['acrobatType'] =
        shotStyle === 'screamer' || shotStyle === 'knuckle' || shotStyle === 'trivela'
          ? 'shoot_power'
          : shotStyle === 'curler'
            ? 'shoot_finesse'
            : shotStyle === 'chip' || shotStyle === 'panenka'
              ? 'shoot_chip'
              : 'kick';
      if (!keepAcro) {
        shooter.acrobatType = kickKind;
        shooter.acrobatMax = 0.46;
        shooter.acrobatTimer = 0.46;
      }
      addWorldFx(w, {
        type: 'kick_burst',
        x: fromX,
        y: fromY,
        toX: goalLineX,
        toY: 50,
        label: '',
        color:
          kickKind === 'shoot_power'
            ? '#fb923c'
            : kickKind === 'shoot_finesse'
              ? '#38bdf8'
              : '#fde047',
        ttl: 0.34,
        maxTtl: 0.34
      });
    }
    if (gk) {
      if (gk.intent === 'DIVE') gk.intent = 'SUPPORT';
      gk.diveProgress = 0;
      gk.diveTargetY = undefined;
    }
    const calcGkDiveStartProg = (
      fType: 'shot' | 'freekick' | 'penalty' | 'shootout_kick',
      shotDist: number,
      isSave = false
    ) => {
      if (fType === 'penalty' || fType === 'shootout_kick') {
        return isSave ? 0.48 : 0.50;
      }
      const reactDist = isSave ? 5.6 : 4.4;
      return clamp(1 - reactDist / Math.max(7.2, shotDist), 0.52, 0.80);
    };
    const diveReactionProg = calcGkDiveStartProg(flightType, dist, false);

    // 1. Check defender block / free-kick wall deflection / shot deflection ("ยิงแฉลบ") first (except penalty)
    if (flightType !== 'penalty') {
      const defTeamCfg = getEffectiveTeamCfg(defSide, curMin);
      const lowBlockBonus = defTeamCfg.tac === 'Z' ? 0.08 : defTeamCfg.tac === 'D' ? 0.04 : defTeamCfg.tac === 'X' ? -0.03 : 0;
      const segDx = goalLineX - fromX;
      const segDy = 50 - fromY;
      const segLenSq = Math.max(1, segDx * segDx + segDy * segDy);
      const corridorCands = defenders
        .filter((d) => (attRightNow ? d.x > fromX + 0.4 && d.x < 97.8 : d.x < fromX - 0.4 && d.x > 2.2))
        .map((d) => {
          const tProj = clamp(((d.x - fromX) * segDx + (d.y - fromY) * segDy) / segLenSq, 0.08, 0.92);
          const projX = fromX + segDx * tProj;
          const projY = fromY + segDy * tProj;
          const perpDist = Math.hypot(d.x - projX, d.y - projY);
          return { d, perpDist, tProj };
        })
        .filter((x) => x.perpDist < (flightType === 'freekick' ? 6.8 : x.d.sig === 'blk' || agentHasTrait(x.d, 'body_blocker') || defTeamCfg.tac === 'Z' ? 6.6 : 5.2))
        .sort((u, v) => u.perpDist - v.perpDist || u.tProj - v.tProj);

      const wallDef = flightType === 'freekick' ? defenders.find((d) => d.intent === 'WALL') || corridorCands[0]?.d : undefined;
      const nearDef = wallDef || corridorCands[0]?.d;

      const attBlessed = (shooter?.blessedMins ?? 0) > 0;
      const miracleAtt = w.miracle?.side === side && w.miracle.minsLeft > 0;
      const miracleDef = w.miracle?.side === defSide && w.miracle.minsLeft > 0;

      if (nearDef) {
        const defAgentBlessed = (nearDef.blessedMins ?? 0) > 0;
        const blockerTrait = agentHasTrait(nearDef, 'body_blocker') ? 14 : 0;
        let blockChance =
          flightType === 'freekick'
            ? clamp(0.18 - ((shooter?.d.cur || 60) - 60) * 0.002 + (agentHasTrait(nearDef, 'body_blocker') ? 0.04 : 0), 0.09, 0.28)
            : clamp(0.09 + lowBlockBonus + ((nearDef.sig === 'blk' ? nearDef.d.blk + 12 : nearDef.d.blk) + blockerTrait - 60) * 0.0035, 0.05, 0.34);
        let deflectChance =
          flightType === 'freekick'
            ? 0.16
            : clamp(0.13 + (corridorCands.length >= 2 ? 0.06 : 0) + (shotStyle === 'header' || shotStyle === 'diving_header' ? 0.03 : 0), 0.12, 0.24);
        if (defAgentBlessed) blockChance = clamp(blockChance + 0.16, 0.08, 0.52);
        else if (miracleDef) blockChance = clamp(blockChance + 0.08, 0.06, 0.45);
        else if (attBlessed || miracleAtt) {
          blockChance *= 0.55;
          deflectChance *= 0.72;
        }
        const contactRoll = Math.random();

        if (contactRoll < blockChance) {
          b.toX = nearDef.x;
          b.toY = nearDef.y;
          b.curve = curveAmt * 0.25;
          b.maxZ = Math.min(maxZAmt, 2.4);
          b.duration = clamp(Math.hypot(nearDef.x - fromX, nearDef.y - fromY) / 40, 0.16, 0.38);
          b.shotPlan = { outcome: 'block', blockerId: nearDef.id, reboundChain };
          return;
        }
        if (contactRoll < blockChance + deflectChance) {
          b.toX = clamp(nearDef.x + (Math.random() - 0.5) * 1.1, 3.5, 96.5);
          b.toY = clamp(nearDef.y + (Math.random() - 0.5) * 1.4, 8, 92);
          b.curve = curveAmt * 0.28;
          b.maxZ = clamp(maxZAmt * 0.52, 1.8, 5.2);
          b.duration = clamp(Math.hypot(b.toX - fromX, b.toY - fromY) / 42, 0.15, 0.38);
          b.shotPlan = { outcome: 'deflect', blockerId: nearDef.id, deflectorId: nearDef.id, reboundChain };
          return;
        }
      }
    }

    // 2. Accuracy roll: On-Target vs Woodwork vs Off-Target
    const attBlessed = (shooter?.blessedMins ?? 0) > 0;
    const gkBlessed = (gk?.blessedMins ?? 0) > 0;
    const miracleAtt = w.miracle?.side === side && w.miracle.minsLeft > 0;
    const miracleDef = w.miracle?.side === defSide && w.miracle.minsLeft > 0;
    const sigFinBoost = shooter?.sig === 'fin' ? 0.05 : shooter?.sig === 'comp' && (curMin >= 70 || isDerby || kind !== 'league') ? 0.04 : 0;
    const isShooterSub = Boolean(shooter && sr.subs.some((s) => s.inPlayer === shooter.id));
    const isClutchShooter = Boolean(shooter && (shooter.tr === 4 || shooter.tr === 17));
    const traitAccBoost =
      (agentHasTrait(shooter, 'poacher_instinct') && dist < 17 ? 0.07 : 0) +
      (isClutchShooter && (curMin >= 70 || isDerby || kind !== 'league') ? 0.06 : 0) +
      (agentHasTrait(shooter, 'super_sub') && isShooterSub ? 0.07 : 0) +
      (agentHasTrait(shooter, 'long_shot_lover') && dist >= 20 ? 0.07 : 0) +
      (shooter?.tr === 23 ? 0.03 : 0) +
      (agentHasTrait(shooter, 'setpiece_specialist') && flightType === 'freekick' ? 0.08 : 0);
    const miracleAttScale = miracleAtt && (w.miracle?.maxDeficit ?? 2) >= 3 ? 0.19 : miracleAtt ? 0.15 : 0;
    const luckAccBoost = (attBlessed ? 0.17 : 0) + miracleAttScale - (gkBlessed ? 0.04 : 0);
    const accuracy =
      flightType === 'penalty'
        ? clamp((isPanenka ? 0.89 : 0.92) + (isClutchShooter ? 0.03 : 0) + (attBlessed ? 0.05 : 0), 0.85, 0.98)
        : clamp(0.46 + ((shooter?.d.fin || 60) - 60) * 0.004 + sigFinBoost + traitAccBoost + luckAccBoost - Math.max(0, dist - 22) * 0.007, 0.26, 0.93);

    if (Math.random() > accuracy) {
      const hitWoodwork = Math.random() < (flightType === 'penalty' ? 0.35 : 0.18);
      let woodworkPart: 'post' | 'crossbar' | 'corner_junction' | undefined;
      let woodworkPostSide: -1 | 1 | undefined;
      if (hitWoodwork) {
        const wTarget = pickWoodworkTarget({ attRightNow, fromY, curveAmt, maxZAmt, shotStyle, flightType });
        woodworkPart = wTarget.woodworkPart;
        woodworkPostSide = wTarget.postSide;
        b.toX = wTarget.toX;
        b.toY = wTarget.toY;
        b.endZ = wTarget.endZ;
        b.maxZ = wTarget.maxZ;
      } else {
        const missSide = fromY < 50 ? (Math.random() < 0.62 ? -1 : 1) : Math.random() < 0.62 ? 1 : -1;
        b.toX = attRightNow ? 101.2 : -1.2;
        b.toY = missSide < 0 ? 33.5 + Math.random() * 6.8 : 59.7 + Math.random() * 6.8;
      }
      const diveY = clamp(b.toY, 41.2, 58.8);
      b.shotPlan = {
        outcome: hitWoodwork ? 'woodwork' : 'miss',
        woodworkPart,
        woodworkPostSide,
        reboundChain,
        gkDiveTargetY: diveY,
        gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
        gkDiveStartProg: diveReactionProg
      };
      return;
    }

    // 3. On-Target: Goal vs GK Save!
    const onTargetY = isPanenka ? 50 + (Math.random() - 0.5) * 3 : 42.8 + Math.random() * 14.4;
    const hR = getCachedSideRate('H', curMin);
    const aR = getCachedSideRate('A', curMin);
    const edge = side === 'H' ? hR.at - aR.df : aR.at - hR.df;
    const gkSaveScore = gk
      ? (gk.d.sv + (gk.sig === 'sv' ? 7 : 0) + (agentHasTrait(gk, 'reflex_cat') ? 8 : 0) + (flightType === 'penalty' && agentHasTrait(gk, 'penalty_saver') ? 12 : 0)) * 0.34 +
        ((gk.d.rfx ?? gk.d.sv) + (gk.sig === 'rfx' ? 7 : 0)) * 0.22 +
        ((gk.d.hnd ?? gk.d.sv) + (gk.sig === 'hnd' ? 7 : 0)) * 0.16 +
        (gk.d.cl + (gk.sig === 'cl' ? 6 : 0) + (agentHasTrait(gk, 'sweeper_keeper') ? 5 : 0)) * 0.16 +
        (gk.d.pos + (gk.sig === 'pos' ? 6 : 0)) * 0.12 +
        (gkBlessed ? 18 : 0)
      : 58;
    const shooterScore = shooter
      ? (shooter.d.fin + (shooter.sig === 'fin' ? 6 : 0) + (agentHasTrait(shooter, 'poacher_instinct') && dist < 17 ? 8 : 0) + (agentHasTrait(shooter, 'acrobatic_finisher') && (shotStyle === 'bicycle' || shotStyle === 'volley' || shotStyle === 'diving_header') ? 9 : 0)) * 0.5 +
        (shooter.d.cur + (shooter.sig === 'cur' ? 6 : 0) + (agentHasTrait(shooter, 'outside_curler') && (shotStyle === 'trivela' || shotStyle === 'curler') ? 8 : 0)) * 0.25 +
        (shooter.d.pw + (shooter.sig === 'pw' ? 6 : 0) + (agentHasTrait(shooter, 'long_shot_lover') && dist >= 20 ? 8 : 0)) * 0.25 +
        (isClutchShooter && (curMin >= 70 || isDerby || kind !== 'league') ? 6 : 0) +
        (shooter.tr === 26 ? 7 : 0) +
        (agentHasTrait(shooter, 'super_sub') && isShooterSub ? 7 : 0) +
        (attBlessed ? 16 : 0)
      : 60;
    const miracleGoalScale = miracleAtt && (w.miracle?.maxDeficit ?? 2) >= 3 ? 0.24 : miracleAtt ? 0.20 : 0;
    const luckGoalBias = (attBlessed ? 0.14 : 0) + miracleGoalScale - (gkBlessed ? 0.14 : 0) - (miracleDef ? 0.10 : 0);
    const realisticScoring = getModRealismSettings().realisticScoring;
    const goalProb =
      flightType === 'penalty'
        ? clamp(0.79 + (shooterScore - gkSaveScore) * 0.0045 - (agentHasTrait(gk, 'penalty_saver') ? 0.06 : 0) + luckGoalBias * 0.45, 0.52, 0.94)
        : clamp(
            (realisticScoring ? 0.22 : 0.27) +
              edge * 0.0065 +
              (shooterScore - gkSaveScore) * 0.004 +
              (flightType === 'freekick' ? 0.03 + (agentHasTrait(shooter, 'setpiece_specialist') ? 0.05 : 0) : 0) +
              luckGoalBias,
            0.08,
            realisticScoring ? 0.62 : 0.78
          );

    if (Math.random() < goalProb) {
      const gkSaveX =
        flightType === 'penalty'
          ? attRightNow
            ? 97.6
            : 2.4
          : gk
            ? clamp(gk.x, attRightNow ? 94.2 : 2.6, attRightNow ? 97.6 : 5.8)
            : attRightNow
              ? 96.2
              : 3.8;
      let goalFinishKind: NonNullable<LiveBallState['shotPlan']>['goalFinishKind'] = 'normal';
      if (!isPanenka) {
        const finRoll = Math.random();
        const isPowerStyle = shotStyle === 'screamer' || shotStyle === 'volley' || shotStyle === 'knuckle' || dist < 15.5;
        const isFinesseStyle = shotStyle === 'curler' || shotStyle === 'trivela' || flightType === 'freekick';
        const isWetOrHard = w.env?.season === 'rainy' || shotStyle === 'screamer' || shotStyle === 'knuckle' || shotStyle === 'volley';
        if (finRoll < 0.10) {
          goalFinishKind = 'post_in';
        } else if (finRoll < 0.19) {
          goalFinishKind = 'bar_in';
        } else if (finRoll < (isFinesseStyle ? 0.41 : 0.34)) {
          goalFinishKind = 'top_corner';
        } else if (finRoll < (isPowerStyle ? 0.52 : 0.44)) {
          goalFinishKind = 'gk_face';
        } else if (finRoll < (isWetOrHard ? 0.65 : 0.56)) {
          goalFinishKind = 'gk_fumble_in';
        }
      }

      if (goalFinishKind === 'post_in') {
        const postSide = Math.random() < 0.5 ? -1 : 1;
        b.toX = attRightNow ? 99.65 : 0.35;
        b.toY = postSide < 0 ? 42.15 : 57.85;
        b.maxZ = clamp(maxZAmt * 0.7, 2.2, 3.6);
        b.endZ = 1.4;
        const diveY = clamp(b.toY + (postSide < 0 ? 1.4 : -1.4), 42.2, 57.8);
        b.shotPlan = {
          outcome: 'goal',
          goalFinishKind: 'post_in',
          gkDiveTargetY: diveY,
          gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
          gkDiveStartProg: diveReactionProg
        };
      } else if (goalFinishKind === 'bar_in') {
        b.toX = attRightNow ? 99.55 : 0.45;
        b.toY = 45.2 + Math.random() * 9.6;
        b.maxZ = Math.max(maxZAmt, 6.2);
        b.endZ = 4.6;
        const diveY = clamp(b.toY, 42.5, 57.5);
        b.shotPlan = {
          outcome: 'goal',
          goalFinishKind: 'bar_in',
          gkDiveTargetY: diveY,
          gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
          gkDiveStartProg: diveReactionProg
        };
      } else if (goalFinishKind === 'top_corner') {
        const cornerSide = Math.random() < 0.5 ? -1 : 1;
        b.toX = attRightNow ? 101.4 : -1.4;
        b.toY = cornerSide < 0 ? 42.35 + Math.random() * 0.85 : 56.8 + Math.random() * 0.85;
        b.maxZ = Math.max(maxZAmt, 5.4);
        b.endZ = 4.1;
        const diveY = clamp(b.toY + (cornerSide < 0 ? 2.1 : -2.1), 42.5, 57.5);
        b.shotPlan = {
          outcome: 'goal',
          goalFinishKind: 'top_corner',
          gkDiveTargetY: diveY,
          gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
          gkDiveStartProg: clamp(diveReactionProg + 0.08, 0.60, 0.85)
        };
      } else if (goalFinishKind === 'gk_face') {
        const gkCenterY = gk ? clamp(gk.y, 47.6, 52.4) : 50;
        b.toX = attRightNow ? 101.4 : -1.4;
        b.toY = clamp(gkCenterY + (Math.random() - 0.5) * 2.2, 48.0, 52.0);
        b.duration = Math.max(0.24, durAmt * 0.8);
        b.maxZ = clamp(maxZAmt * 0.75, 2.4, 3.6);
        b.endZ = 2.6;
        const flinchY = clamp(b.toY + (Math.random() < 0.5 ? -2.4 : 2.4), 45.0, 55.0);
        b.shotPlan = {
          outcome: 'goal',
          goalFinishKind: 'gk_face',
          gkDiveTargetY: flinchY,
          gkDiveDir: gk ? (flinchY >= gk.y ? 1 : -1) : 1,
          gkDiveStartProg: clamp(diveReactionProg + 0.12, 0.62, 0.86)
        };
      } else if (goalFinishKind === 'gk_fumble_in') {
        const fumbleY = clamp(43.2 + Math.random() * 13.6, 43.2, 56.8);
        const fumbleDistRatio = clamp(Math.hypot(gkSaveX - fromX, fumbleY - fromY) / Math.max(4, dist), 0.62, 1.0);
        b.toX = gkSaveX;
        b.toY = fumbleY;
        b.duration = Math.max(0.26, durAmt * fumbleDistRatio);
        b.maxZ = Math.min(maxZAmt, 4.6);
        b.endZ = 1.6;
        b.shotPlan = {
          outcome: 'goal',
          goalFinishKind: 'gk_fumble_in',
          gkDiveTargetY: fumbleY,
          gkDiveDir: gk ? (fumbleY >= gk.y ? 1 : -1) : 1,
          gkDiveStartProg: calcGkDiveStartProg(flightType, dist, true),
          gkSaveX
        };
      } else {
        b.toX = attRightNow ? 101.3 : -1.3;
        b.toY = onTargetY;
        const wrongWay = isPanenka || (shotStyle === 'curler' && Math.random() < 0.35);
        const diveY = wrongWay ? clamp(50 - (onTargetY - 50), 42.5, 57.5) : clamp(onTargetY, 42.0, 58.0);
        b.shotPlan = {
          outcome: 'goal',
          goalFinishKind: 'normal',
          gkDiveTargetY: diveY,
          gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
          gkDiveStartProg: diveReactionProg
        };
      }
    } else {
      // Save! Ball travels directly to the GK's actual interception spot in front of goal!
      const gkSaveX =
        flightType === 'penalty'
          ? attRightNow
            ? 97.6
            : 2.4
          : gk
            ? clamp(gk.x, attRightNow ? 94.2 : 2.6, attRightNow ? 97.6 : 5.8)
            : attRightNow
              ? 96.2
              : 3.8;
      const saveDistRatio = clamp(Math.hypot(gkSaveX - fromX, onTargetY - fromY) / Math.max(4, dist), 0.62, 1.0);
      b.toX = gkSaveX;
      b.toY = onTargetY;
      b.duration = Math.max(0.26, durAmt * saveDistRatio);
      b.maxZ = Math.min(maxZAmt, 5.2);
      const parryCorner = Math.random() < 0.48;
      const saveY = clamp(onTargetY, 42.2, 57.8);
      b.shotPlan = {
        outcome: 'save',
        parryCorner,
        gkDiveTargetY: saveY,
        gkDiveDir: gk ? (saveY >= gk.y ? 1 : -1) : 1,
        gkDiveStartProg: calcGkDiveStartProg(flightType, dist, true),
        gkSaveX
      };
    }
  };

  const nudgeAgentToward = (
    ag: LivePitchAgent,
    destX: number,
    destY: number,
    maxStep: number,
    minX = 4,
    maxX = 96
  ) => {
    const dx = destX - ag.x;
    const dy = destY - ag.y;
    const d = Math.hypot(dx, dy);
    if (d <= 0.05) return;
    const step = Math.min(d, maxStep);
    ag.x = clamp(ag.x + (dx / d) * step, minX, maxX);
    ag.y = clamp(ag.y + (dy / d) * step, 5, 95);
  };

  const resetGkDive = (gkAgent: LivePitchAgent | undefined) => {
    if (!gkAgent) return;
    if (gkAgent.intent === 'DIVE') gkAgent.intent = 'SUPPORT';
    gkAgent.diveProgress = 0;
    gkAgent.diveTargetY = undefined;
  };

  const syncShotGkDive = (gkAgent: LivePitchAgent | undefined, ball: LiveBallState) => {
    if (!gkAgent || gkAgent.sentOff) return;
    const plan = ball.shotPlan;
    if (!plan || plan.outcome === 'block' || plan.outcome === 'deflect' || plan.gkDiveTargetY == null) return;
    const startProg = plan.gkDiveStartProg ?? 0.45;
    if (ball.progress < startProg) {
      if (gkAgent.intent === 'DIVE') gkAgent.intent = 'SUPPORT';
      gkAgent.diveProgress = 0;
      gkAgent.facing = Math.atan2(ball.y - gkAgent.y, ball.x - gkAgent.x);
      return;
    }
    if (plan.gkDiveStartY == null) {
      plan.gkDiveStartY = gkAgent.y;
    }
    if (plan.gkDiveStartX == null) {
      plan.gkDiveStartX = gkAgent.x;
    }
    const startX = plan.gkDiveStartX;
    const startY = plan.gkDiveStartY;
    const targetY = plan.gkDiveTargetY;
    const diveT = clamp((ball.progress - startProg) / Math.max(0.12, 1 - startProg), 0, 1);
    const easeDive = diveT * 0.28 + (1 - Math.cos(diveT * Math.PI * 0.5)) * 0.72;
    gkAgent.intent = 'DIVE';
    gkAgent.intentTimer = 0.38;
    gkAgent.diveDir = plan.gkDiveDir ?? (targetY >= startY ? 1 : -1);
    gkAgent.diveTargetY = targetY;
    gkAgent.diveProgress = clamp(0.04 + diveT * 0.56, 0.04, 0.60);
    gkAgent.y = clamp(startY + (targetY - startY) * easeDive, 39, 61);
    gkAgent.ty = gkAgent.y;
    if (plan.gkSaveX != null) {
      gkAgent.x = clamp(startX + (plan.gkSaveX - startX) * easeDive, 1.6, 98.4);
      gkAgent.tx = gkAgent.x;
    }
  };

  const checkPassOffside = (
    w: LiveMatchWorld,
    side: 'H' | 'A',
    passer: LivePitchAgent,
    receiver: LivePitchAgent,
    defPool: LivePitchAgent[]
  ): { isOffside: boolean; oppLineX: number } => {
    if (receiver.id === passer.id || receiver.pos === 'GK') return { isOffside: false, oppLineX: 50 };
    const attRight = isAttackRight(w, side);
    const inOppHalf = attRight ? receiver.x > 50.2 : receiver.x < 49.8;
    if (!inOppHalf) return { isOffside: false, oppLineX: 50 };
    const aheadOfBall = attRight ? receiver.x > passer.x + 0.35 : receiver.x < passer.x - 0.35;
    if (!aheadOfBall) return { isOffside: false, oppLineX: 50 };
    const defXs = defPool.map((a) => a.x).sort((u, v) => (attRight ? v - u : u - v));
    const secondLastDefX = defXs[1] ?? (attRight ? 80 : 20);
    const offsideLineX = attRight ? Math.max(50, secondLastDefX) : Math.min(50, secondLastDefX);
    const isOffside = attRight ? receiver.x > offsideLineX + 1.45 : receiver.x < offsideLineX - 1.45;
    return { isOffside, oppLineX: offsideLineX };
  };

  const triggerOffsideCall = (
    w: LiveMatchWorld,
    _curMin: number,
    side: 'H' | 'A',
    passer: LivePitchAgent,
    receiver: LivePitchAgent,
    oppLineX: number,
    flightType: BallFlightType = 'through',
    reasonText = 'ยืนล้ำแนวรับในจังหวะเพื่อนส่งบอล'
  ) => {
    const b = w.ball;
    const defSide: 'H' | 'A' = side === 'H' ? 'A' : 'H';
    const attTeam = side === 'H' ? homeOrig : awayOrig;
    const attRight = isAttackRight(w, side);
    if (side === 'H') w.offsidesH++;
    else w.offsidesA++;
    const flagX = attRight ? Math.max(receiver.x, oppLineX + 1.2) : Math.min(receiver.x, oppLineX - 1.2);
    const clampedFlagX = clamp(flagX, 6, 94);
    receiver.tx = clampedFlagX;
    receiver.ty = receiver.y;
    receiver.intent = 'PASS_TARGET';
    b.fromX = passer.x;
    b.fromY = passer.y;
    b.toX = clampedFlagX;
    b.toY = receiver.y;
    b.curve = (Math.random() - 0.5) * 3;
    b.maxZ = flightType === 'lofted' || flightType === 'cross' ? 11 : 3.5;
    b.startZ = 0;
    b.endZ = flightType === 'cross' ? 3.2 : 0;
    b.progress = 0;
    b.duration = 0.42;
    b.flightType = flightType;
    b.shotStyle = undefined;
    b.carrierId = null;
    b.targetId = receiver.id;
    b.lastPasserId = passer.id;
    b.bounceNext = {
      isOffsideCall: true,
      setPiece: {
        type: 'offside',
        side: defSide,
        x: clamp(oppLineX, 8, 92),
        y: receiver.y,
        waitSec: 1.45
      },
      offsideFx: {
        type: 'offside',
        x: clamp(flagX, 8, 92),
        y: receiver.y,
        offsideX: oppLineX,
        label: `🚩 ล้ำหน้า (${receiver.shortName})`,
        color: '#facc15',
        ttl: 2.3,
        maxTtl: 2.3
      },
      offsideLog: `🚩 ล้ำหน้า! ${receiver.id} (${attTeam.name}) ${reasonText}`,
      phaseLabel: `🚩 ล้ำหน้า! ${receiver.shortName} ${reasonText}`,
      phaseTone: 'offside'
    };
    w.phaseLabel =
      flightType === 'cross'
        ? `👟 ${passer.shortName} เปิดบอลเข้าเขตโทษให้ ${receiver.shortName}`
        : `↗️ ${passer.shortName} จ่ายบอลขึ้นหน้าให้ ${receiver.shortName}`;
    w.phaseTone = 'attack';
    if (flightType === 'lofted' || flightType === 'cross') SFX.kick();
    else SFX.pass();
  };

  // Start next micro-play when ball finishes current movement/segment
  const scheduleNextPlay = (w: LiveMatchWorld, curMin: number) => {
    if (simRef.current.done) return;
    if (w.dramaLabel?.startsWith('🧤')) {
      w.dramaLabel = null;
      w.dramaSlowSec = 0;
    }
    const b = w.ball;
    const active = w.agents.filter((a) => !a.sentOff);
    const getTeamPool = (side: 'H' | 'A') => active.filter((a) => a.side === side);

    // 1. Pending Set Piece Execution (Kickoff, Free Kick, Corner, Offside Restart, Goal Kick, Penalty)
    if (w.pendingSetPiece) {
      const sp = w.pendingSetPiece;
      if (sp.waitSec > 0) return;
      w.pendingSetPiece = null;
      const attPool = getTeamPool(sp.side);
      const attRight = isAttackRight(w, sp.side);
      const dir = attRight ? 1 : -1;
      const attTeam = sp.side === 'H' ? homeOrig : awayOrig;
      const attCfg = getEffectiveTeamCfg(sp.side, curMin);

      if (sp.type === 'kickoff') {
        const { kicker, partner: midTarget } = pickKickoffPair(attPool);
        const passTo = midTarget || kicker;
        if (kicker && passTo) {
          if (Math.hypot(kicker.x - 50, kicker.y - 50) > 1.8) {
            kicker.x = 50 - dir * 0.6;
            kicker.y = 50;
          }
          kicker.facing = Math.atan2(passTo.y - kicker.y, passTo.x - kicker.x);
          b.x = 50;
          b.y = 50;
          b.z = 0;
          b.fromX = 50;
          b.fromY = 50;
          b.toX = passTo.x;
          b.toY = passTo.y;
          b.curve = 0;
          b.maxZ = 0;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = 0.42;
          b.flightType = 'pass';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = passTo.id;
          b.lastPasserId = kicker.id;
          b.possessionSide = sp.side;
          passTo.tx = b.toX;
          passTo.ty = b.toY;
          passTo.intent = 'PASS_TARGET';
          SFX.pass();
          w.phaseLabel = `⚽ ${attTeam.name} เขี่ยบอลเริ่มเล่น`;
          w.phaseTone = 'normal';
        }
        return;
      }

      if (sp.type === 'goalkick' || sp.type === 'offside') {
        const kicker =
          (sp.takerId ? attPool.find((a) => a.id === sp.takerId) : undefined) ||
          (sp.type === 'goalkick' ? attPool.find((a) => a.pos === 'GK') || attPool[0] : attPool.find((a) => a.pos === 'DF') || attPool[0]);
        const longDistBias = attCfg.pass >= 2 || kicker?.sig === 'dist' || agentHasTrait(kicker, 'long_throw_counter') || agentHasTrait(kicker, 'long_diagonal');
        const receiver =
          longDistBias
            ? attPool.find((a) => a.pos === 'FW') || attPool.find((a) => a.pos === 'MF')
            : attPool.find((a) => (a.pos === 'DF' || a.pos === 'MF') && a.id !== kicker?.id);
        if (kicker && receiver) {
          kicker.facing = Math.atan2(receiver.y - kicker.y, receiver.x - kicker.x);
          kicker.acrobatType = 'kick';
          kicker.acrobatMax = 0.42;
          kicker.acrobatTimer = 0.42;
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = receiver.x;
          b.toY = receiver.y;
          b.curve = (Math.random() - 0.5) * 3.5;
          b.maxZ = longDistBias ? 16 : 4;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = longDistBias ? 0.78 : 0.48;
          b.flightType = longDistBias ? 'lofted' : 'goalkick';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = receiver.id;
          b.lastPasserId = kicker.id;
          b.possessionSide = sp.side;
          receiver.tx = b.toX;
          receiver.ty = b.toY;
          receiver.intent = 'PASS_TARGET';
          w.phaseLabel =
            sp.type === 'offside'
              ? `⚽ เตะฟรีคิกล้ำหน้า (${attTeam.name})`
              : agentHasTrait(kicker, 'long_throw_counter') || kicker.sig === 'dist'
                ? `🚀 ${kicker.shortName} [บอลยาวสวนกลับ] เปิดเกมไวขึ้นหน้า!`
                : `🥅 เปิดเกมจากประตู (${attTeam.name})`;
          w.phaseTone = 'normal';
          SFX.kick();
        }
        return;
      }

      if (sp.type === 'freekick') {
        const goalX = attRight ? 100 : 0;
        const distToGoal = Math.hypot(goalX - sp.x, 50 - sp.y);
        const taker =
          (sp.takerId ? attPool.find((a) => a.id === sp.takerId) : undefined) ||
          resolveSetPieceTaker(w, sp.side, 'freekick') ||
          attPool[0];
        if (!taker) return;
        taker.acrobatType = 'kick';
        taker.acrobatMax = 0.44;
        taker.acrobatTimer = 0.44;
        const canShootDirect = distToGoal < 36;
        if (canShootDirect) {
          const isCurlerFk = agentHasTrait(taker, 'setpiece_specialist') || agentHasTrait(taker, 'outside_curler') || taker.sig === 'cur' || taker.d.cur >= taker.d.pw;
          taker.facing = Math.atan2(50 - taker.y, goalX - taker.x);
          b.lastPasserId = null;
          bumpPlayerStat(taker.id, 'setpieces');
          prepareShotFlight(w, curMin, {
            flightType: 'freekick',
            side: sp.side,
            fromX: sp.x,
            fromY: sp.y,
            shooter: taker,
            shotStyle: isCurlerFk ? 'curler' : 'screamer',
            curveAmt: (sp.y < 50 ? 1 : -1) * ((isCurlerFk ? 7.5 : 4.5) + Math.random() * 5),
            maxZAmt: isCurlerFk ? 11.2 : 8.5,
            durAmt: 0.88
          });
          w.phaseLabel = isCurlerFk
            ? `🎯 ${taker.shortName}${agentHasTrait(taker, 'setpiece_specialist') ? ' [เจ้าพ่อลูกนิ่ง]' : ''} ปั่นฟรีคิกโค้งข้ามกำแพง!`
            : `🎯 ${taker.shortName} ตะบันฟรีคิกเต็มข้อ!`;
          w.phaseTone = 'danger';
          triggerDramaSlow(w, 1.15, `🎯 ฟรีคิกลุ้นประตู · ${taker.shortName}`);
          SFX.shot();
          pushLog(curMin, `🎯 ${taker.id} (${attTeam.name}) วิ่งเข้ามา${isCurlerFk ? 'ปั่นฟรีคิกโค้งๆ' : 'ซัดฟรีคิก'}ข้ามกำแพง!`);
        } else {
          const boxTarget =
            attPool.filter((a) => a.pos === 'FW' || baseRoleOf(a.role) === 'CB').sort((u, v) => (v.d.hd + (v.sig === 'hd' ? 10 : 0) + (agentHasTrait(v, 'aerial_menace') ? 15 : 0)) - (u.d.hd + (u.sig === 'hd' ? 10 : 0) + (agentHasTrait(u, 'aerial_menace') ? 15 : 0)))[0] ||
            attPool[1] ||
            taker;
          const destX = clamp(attRight ? 88 + Math.random() * 6 : 6 + Math.random() * 6, 6, 94);
          const destY = clamp(38 + Math.random() * 24, 30, 70);
          taker.facing = Math.atan2(destY - taker.y, destX - taker.x);
          boxTarget.tx = destX;
          boxTarget.ty = destY;
          boxTarget.intent = 'PASS_TARGET';
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = destX;
          b.toY = destY;
          b.curve = (sp.y < 50 ? 1 : -1) * 7.5;
          b.maxZ = 16.5;
          b.startZ = 0;
          b.endZ = 3.2;
          b.progress = 0;
          const fkRunnerDist = Math.hypot(destX - boxTarget.x, destY - boxTarget.y);
          b.duration = Math.max(0.76, clamp(fkRunnerDist / 25, 0.76, 1.05));
          b.flightType = 'cross';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = boxTarget.id;
          b.lastPasserId = taker.id;
          b.possessionSide = sp.side;
          bumpPlayerStat(taker.id, 'setpieces');
          bumpPlayerStat(taker.id, 'crossAssists');
          w.phaseLabel = `⚠️ ${taker.shortName} เปิดบอลโด่งเข้ากรอบเขตโทษ`;
          w.phaseTone = 'setpiece';
          SFX.kick();
        }
        return;
      }

      if (sp.type === 'corner') {
        const taker =
          (sp.takerId ? attPool.find((a) => a.id === sp.takerId) : undefined) ||
          resolveSetPieceTaker(w, sp.side, 'corner') ||
          attPool[0];
        const headerTarget =
          attPool
            .filter((a) => a.id !== taker?.id && a.pos !== 'GK')
            .sort(
              (u, v) =>
                (baseRoleOf(v.role) === 'CB' ? 44 : v.pos === 'FW' ? 30 : 0) +
                v.d.hd +
                v.d.str +
                (v.sig === 'hd' ? 12 : 0) +
                (agentHasTrait(v, 'aerial_menace') ? 16 : 0) +
                (agentHasTrait(v, 'near_post_runner') ? 8 : 0) -
                ((baseRoleOf(u.role) === 'CB' ? 44 : u.pos === 'FW' ? 30 : 0) +
                  u.d.hd +
                  u.d.str +
                  (u.sig === 'hd' ? 12 : 0) +
                  (agentHasTrait(u, 'aerial_menace') ? 16 : 0) +
                  (agentHasTrait(u, 'near_post_runner') ? 8 : 0))
            )[0] || attPool[1];
        if (taker && headerTarget) {
          const nearPost = agentHasTrait(headerTarget, 'near_post_runner');
          const baseBoxX = clamp(headerTarget.tx, attRight ? 86 : 6, attRight ? 94 : 14);
          const baseBoxY = clamp(headerTarget.ty, 37, 63);
          const destX = clamp(
            attRight
              ? nearPost
                ? 91.5 + Math.random() * 2.2
                : Math.max(88.5, baseBoxX + (Math.random() - 0.3) * 2.5)
              : nearPost
                ? 6.3 + Math.random() * 2.2
                : Math.min(11.5, baseBoxX - (Math.random() - 0.3) * 2.5),
            5.5,
            94.5
          );
          const destY = clamp(
            nearPost ? (sp.y < 50 ? 40 + Math.random() * 5 : 55 + Math.random() * 5) : baseBoxY + (Math.random() - 0.5) * 6,
            37,
            63
          );
          taker.facing = Math.atan2(destY - taker.y, destX - taker.x);
          taker.acrobatType = 'kick';
          taker.acrobatMax = 0.44;
          taker.acrobatTimer = 0.44;
          headerTarget.tx = destX;
          headerTarget.ty = destY;
          headerTarget.intent = 'PASS_TARGET';
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = destX;
          b.toY = destY;
          b.curve = (sp.y < 50 ? 1 : -1) * (agentHasTrait(taker, 'setpiece_specialist') || taker.sig === 'cur' || taker.sig === 'crs' ? 9.5 : 7.5);
          b.maxZ = 16;
          b.startZ = 0;
          b.endZ = 3.2;
          b.progress = 0;
          const cornerRunnerDist = Math.hypot(destX - headerTarget.x, destY - headerTarget.y);
          b.duration = Math.max(0.78, clamp(cornerRunnerDist / 25, 0.78, 1.02));
          b.flightType = 'corner';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = headerTarget.id;
          b.lastPasserId = taker.id;
          b.possessionSide = sp.side;
          bumpPlayerStat(taker.id, 'setpieces');
          bumpPlayerStat(taker.id, 'crossAssists');
          w.phaseLabel = `🚩 ${taker.shortName}${agentHasTrait(taker, 'setpiece_specialist') ? ' [เจ้าพ่อลูกนิ่ง]' : ''} โยนเตะมุมโค้งเข้ากลาง!`;
          w.phaseTone = 'setpiece';
          SFX.kick();
        }
        return;
      }

      if (sp.type === 'penalty') {
        const taker =
          (sp.takerId ? attPool.find((a) => a.id === sp.takerId) : undefined) ||
          resolveSetPieceTaker(w, sp.side, 'penalty') ||
          attPool[0];
        if (!taker) return;
        const spotX = attRight ? 88.5 : 11.5;
        const goalX = attRight ? 100 : 0;
        const isPanenka = (agentHasTrait(taker, 'chip_artist') || taker.tr === 17 || (taker.d.comp || 60) >= 74) && Math.random() < (agentHasTrait(taker, 'chip_artist') ? 0.32 : 0.18);
        taker.facing = Math.atan2(50 - taker.y, goalX - taker.x);
        taker.acrobatType = 'kick';
        taker.acrobatMax = 0.45;
        taker.acrobatTimer = 0.45;
        b.lastPasserId = null;
        bumpPlayerStat(taker.id, 'setpieces');
        prepareShotFlight(w, curMin, {
          flightType: 'penalty',
          side: sp.side,
          fromX: spotX,
          fromY: 50,
          shooter: taker,
          shotStyle: isPanenka ? 'panenka' : 'normal',
          curveAmt: isPanenka ? 0 : (Math.random() - 0.5) * 2.2,
          maxZAmt: isPanenka ? 8.8 : 4.4,
          durAmt: isPanenka ? 0.84 : 0.72,
          isPanenka
        });
        w.phaseLabel = isPanenka ? `🪶 ${taker.shortName} ชิพปาเนนก้าจุดโทษ!!` : `🎯 ${taker.shortName} สังหารจุดโทษ!`;
        w.phaseTone = 'danger';
        triggerDramaSlow(w, 1.35, `🎯 ดวลจุดโทษ · ${taker.shortName}`);
        SFX.shot();
        pushLog(curMin, `🎯 ${taker.id} (${attTeam.name}) รับหน้าที่สังหารจุดโทษ${isPanenka ? ' — วางเท้าเหนือชั้น!' : '!'}`);
        return;
      }

      if (sp.type === 'throwin') {
        const taker =
          (sp.takerId ? attPool.find((a) => a.id === sp.takerId) : undefined) ||
          attPool
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => Math.hypot(u.x - sp.x, u.y - sp.y) - Math.hypot(v.x - sp.x, v.y - sp.y))[0] ||
          attPool[0];
        if (!taker) return;
        const releaseX = clamp(taker.x, 4, 96);
        const releaseY = clamp(taker.y, 1.2, 98.8);
        const spNormX = attRight ? releaseX : 100 - releaseX;
        const longThrowSpecialist = agentHasTrait(taker, 'long_throw_counter') || taker.d.str >= 70 || taker.sig === 'str';
        const doLongThrow = spNormX >= 68 && Math.random() < (longThrowSpecialist ? 0.56 : 0.30);

        if (doLongThrow) {
          const boxTargets = attPool
            .filter((a) => a.id !== taker.id && a.pos !== 'GK')
            .sort((u, v) => (v.d.hd + v.d.str + (attRight ? v.x : 100 - v.x) * 0.4) - (u.d.hd + u.d.str + (attRight ? u.x : 100 - u.x) * 0.4));
          const target = boxTargets[0] || attPool.find((a) => a.id !== taker.id);
          if (target) {
            const bx = clamp(attRight ? 88 + Math.random() * 5.5 : 6.5 + Math.random() * 5.5, 6, 94);
            const by = clamp(42 + Math.random() * 16, 36, 64);
            taker.facing = Math.atan2(by - taker.y, bx - taker.x);
            target.tx = bx;
            target.ty = by;
            target.intent = 'PASS_TARGET';
            b.x = releaseX;
            b.y = releaseY;
            b.z = 1.8;
            b.trail.length = 0;
            b.fromX = releaseX;
            b.fromY = releaseY;
            b.toX = bx;
            b.toY = by;
            b.curve = 0;
            b.maxZ = 13.5;
            b.startZ = 1.8;
            b.endZ = 3.2;
            b.progress = 0;
            b.duration = 0.68;
            b.flightType = 'cross';
            b.shotStyle = undefined;
            b.carrierId = null;
            b.targetId = target.id;
            b.lastPasserId = taker.id;
            b.possessionSide = sp.side;
            bumpPlayerStat(taker.id, 'setpieces');
            addWorldFx(w, {
              type: 'throwin',
              x: releaseX,
              y: releaseY,
              toX: bx,
              toY: by,
              label: `🚀 ทุ่มไกลลุ้นประตู! (${taker.shortName})`,
              color: '#a78bfa',
              ttl: 1.9,
              maxTtl: 1.9
            });
            w.phaseLabel = `🚀 ${taker.shortName} ทุ่มไกลเข้ากรอบเขตโทษลุ้นทำประตู!`;
            w.phaseTone = 'danger';
            triggerDramaSlow(w, 0.9, `🚀 ทุ่มไกลลุ้นประตู · ${taker.shortName}`);
            SFX.kick();
            if (Math.random() < 0.55) {
              pushLog(curMin, `🚀 ${taker.id} (${attTeam.name}) ทุ่มไกลยัดเข้ากลางกรอบเขตโทษให้เพื่อนโหม่งลุ้นประตู!`);
            }
            return;
          }
        }

        const cands = attPool.filter((a) => a.id !== taker.id && (a.pos !== 'GK' || spNormX < 42));
        const forwardCands = cands
          .filter((a) => (attRight ? a.x > releaseX + 3 : a.x < releaseX - 3) && Math.hypot(a.x - releaseX, a.y - releaseY) < 30)
          .sort((u, v) => Math.hypot(u.x - releaseX, u.y - releaseY) - Math.hypot(v.x - releaseX, v.y - releaseY));
        const backCands = cands
          .filter((a) => (attRight ? a.x <= releaseX + 3 : a.x >= releaseX - 3) && Math.hypot(a.x - releaseX, a.y - releaseY) < 28)
          .sort((u, v) => Math.hypot(u.x - releaseX, u.y - releaseY) - Math.hypot(v.x - releaseX, v.y - releaseY));

        const preferBack = spNormX < 40 ? Math.random() < 0.42 : Math.random() < 0.34;
        const target =
          (preferBack ? backCands[0] || forwardCands[0] || cands[0] : forwardCands[0] || backCands[0] || cands[0]) ||
          attPool.find((a) => a.id !== taker.id) ||
          taker;
        const isBackThrow = attRight ? target.x < releaseX - 1 : target.x > releaseX + 1;
        const destX = clamp(target.x + (isBackThrow ? -dir * 1.5 : dir * 3), 6, 94);
        const destY = clamp(target.y, 8, 92);
        taker.facing = Math.atan2(destY - taker.y, destX - taker.x);
        target.tx = destX;
        target.ty = destY;
        target.intent = 'PASS_TARGET';
        b.x = releaseX;
        b.y = releaseY;
        b.z = 1.8;
        b.trail.length = 0;
        b.fromX = releaseX;
        b.fromY = releaseY;
        b.toX = destX;
        b.toY = destY;
        b.curve = 0;
        b.maxZ = 3.2;
        b.startZ = 1.8;
        b.endZ = 0;
        b.progress = 0;
        b.duration = clamp(Math.hypot(destX - releaseX, destY - releaseY) / 40, 0.36, 0.60);
        b.flightType = 'throwin';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = target.id;
        b.lastPasserId = taker.id;
        b.possessionSide = sp.side;
        bumpPlayerStat(taker.id, 'setpieces');
        addWorldFx(w, {
          type: 'throwin',
          x: releaseX,
          y: releaseY,
          toX: destX,
          toY: destY,
          label: isBackThrow ? `↩️ ทุ่มกลับให้ ${target.shortName}` : `↗️ ทุ่มขึ้นหน้าให้ ${target.shortName}`,
          color: '#38bdf8',
          ttl: 1.4,
          maxTtl: 1.4
        });
        w.phaseLabel = isBackThrow
          ? `🤲 ${taker.shortName} ทุ่มกลับตั้งเกมให้ ${target.shortName}`
          : `🤲 ${taker.shortName} ทุ่มขึ้นหน้าให้ ${target.shortName}`;
        w.phaseTone = 'normal';
        SFX.pass();
        return;
      }
    }

    // 2. Open Play Decision from Carrier
    let side = b.possessionSide;
    let attPool = getTeamPool(side);
    const defSide = side === 'H' ? 'A' : 'H';
    let defPool = getTeamPool(defSide);
    const directCarrier = b.carrierId ? attPool.find((a) => a.id === b.carrierId) : null;
    let carrier =
      directCarrier ||
      attPool
        .filter((a) => a.pos !== 'GK')
        .sort((u, v) => Math.hypot(u.x - b.x, u.y - b.y) - Math.hypot(v.x - b.x, v.y - b.y))[0] ||
      attPool[0];
    if (!carrier) return;
    if (!directCarrier) {
      b.carrierId = carrier.id;
      b.x = carrier.x;
      b.y = carrier.y;
    }

    const attRight = isAttackRight(w, side);
    const attTeam = side === 'H' ? homeOrig : awayOrig;
    const defTeam = defSide === 'H' ? homeOrig : awayOrig;
    const attCfg = getEffectiveTeamCfg(side, curMin);
    const defCfg = getEffectiveTeamCfg(defSide, curMin);
    const dir = attRight ? 1 : -1;
    const goalX = attRight ? 100 : 0;
    const distToGoal = Math.hypot(goalX - carrier.x, 50 - carrier.y);

    // Check pressing duel / skill move / tackle / foul when defender is close!
    const nearestDef = defPool
      .filter((d) => d.pos !== 'GK')
      .sort((u, v) => Math.hypot(u.x - carrier.x, u.y - carrier.y) - Math.hypot(v.x - carrier.x, v.y - carrier.y))[0];
    const nearestDefDist = nearestDef ? Math.hypot(nearestDef.x - carrier.x, nearestDef.y - carrier.y) : 99;

    const inBoxNow = (attRight ? carrier.x >= 83.5 : carrier.x <= 16.5) && Math.abs(carrier.y - 50) <= 29;
    const onBoxEdgeNow = !inBoxNow && (attRight ? carrier.x >= 80.5 : carrier.x <= 19.5) && Math.abs(carrier.y - 50) <= 30.5;

    // Clean Goalkeeper Distribution based on team Passing Style (Short build-up vs Long counter/target)
    if (carrier.pos === 'GK') {
      const preferLongGk = attCfg.pass >= 2 || ((carrier.sig === 'dist' || agentHasTrait(carrier, 'long_throw_counter')) && Math.random() < 0.72) || nearestDefDist < 9;
      const gkReceivers = attPool.filter((a) => a.id !== carrier.id && a.pos !== 'GK');
      const shortPick = gkReceivers
        .filter((a) => a.pos === 'DF' || a.role === 'CDM' || a.role === 'LDM' || a.role === 'RDM')
        .sort((u, v) => Math.hypot(u.x - carrier.x, u.y - carrier.y) - Math.hypot(v.x - carrier.x, v.y - carrier.y))[0];
      const longPick = gkReceivers
        .filter((a) => a.pos === 'FW' || a.pos === 'MF')
        .sort((u, v) => (attRight ? v.x - u.x : u.x - v.x))[0];
      const target = preferLongGk ? (longPick || gkReceivers[0]) : (shortPick || gkReceivers[0]);
      if (target) {
        const distGk = Math.hypot(target.x - carrier.x, target.y - carrier.y);
        const useLofted = preferLongGk || distGk > 28;
        b.fromX = carrier.x;
        b.fromY = carrier.y;
        b.toX = clamp(target.x + dir * (useLofted ? 3 : 1.5), 6, 94);
        b.toY = target.y;
        b.curve = useLofted ? (Math.random() - 0.5) * 4 : 0;
        b.maxZ = useLofted ? 15.5 : 0;
        b.startZ = 0;
        b.endZ = 0;
        b.progress = 0;
        b.duration = useLofted ? clamp(distGk / 42, 0.56, 0.82) : clamp(distGk / 52, 0.32, 0.54) / turfMatchMods.passPaceMult;
        b.flightType = useLofted ? 'lofted' : 'pass';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = target.id;
        b.lastPasserId = carrier.id;
        target.tx = b.toX;
        target.ty = b.toY;
        target.intent = 'PASS_TARGET';
        w.phaseLabel = useLofted
          ? `🧤 ${carrier.shortName}${agentHasTrait(carrier, 'long_throw_counter') ? ' [เปิดเกมสวนกลับ]' : ''} เตะสาดยาวขึ้นหน้าให้ ${target.shortName}`
          : `🧤 ${carrier.shortName}${agentHasTrait(carrier, 'sweeper_keeper') ? ' [สวีปเปอร์]' : ''} จ่ายสั้นต่อบอลจากแดนหลัง`;
        w.phaseTone = 'normal';
        if (useLofted) SFX.kick();
        else SFX.pass();
        return;
      }
    }

    // 2a. Coordinated High Pressing ("การกดดัน") & Signature Skill Move / Dragback ("การคลึงบอล")
    const carrierNormXEarly = attRight ? carrier.x : 100 - carrier.x;
    const miraclePressDef = w.miracle?.side === defSide && w.miracle.minsLeft > 0;
    const pressRadius = (defCfg.press === 2 ? 10.5 : 8.2) + (miraclePressDef ? 2.5 : 0);
    const pressersNearby = defPool
      .filter((d) => d.pos !== 'GK' && Math.hypot(d.x - carrier.x, d.y - carrier.y) < pressRadius)
      .sort((u, v) => Math.hypot(u.x - carrier.x, u.y - carrier.y) - Math.hypot(v.x - carrier.x, v.y - carrier.y));
    const pressTriggerProb = (defCfg.press === 2 ? 0.24 : 0.14) + (miraclePressDef ? 0.14 : 0);
    if (nearestDef && pressersNearby.length >= 2 && (defCfg.press >= 1 || defCfg.tac === 'X' || miraclePressDef) && carrier.pos !== 'GK' && Math.random() < pressTriggerProb) {
      pressersNearby.slice(0, 2).forEach((pr) => {
        pr.intent = 'PRESS';
        pr.intentTimer = 1.1;
      });
      const winner = pressersNearby[0] || nearestDef;
      const winnerDist = Math.hypot(winner.x - carrier.x, winner.y - carrier.y);
      const pressStrength =
        pressersNearby.reduce((s, d) => s + d.d.rd * 0.5 + d.d.spd * 0.3 + (agentHasTrait(d, 'pressing_machine') ? 10 : 0), 0) /
          Math.max(1, pressersNearby.length) +
        (defCfg.press === 2 ? 9 : 3) +
        (defCfg.tac === 'X' ? 5 : 0) +
        (miraclePressDef ? 8 : 0);
      const escapeStrength = carrier.d.cur * 0.4 + carrier.d.spd * 0.3 + carrier.d.comp * 0.3 + (attCfg.tempo === 0 ? 5 : 0);
      const pressStealProb = clamp(0.32 + (pressStrength - escapeStrength) * 0.006 + (miraclePressDef ? 0.09 : 0), 0.15, 0.72);
      addWorldFx(w, {
        type: 'press',
        x: carrier.x,
        y: carrier.y,
        label: `🔥 กดดันเพรสซิ่ง!`,
        color: '#f97316',
        ttl: 1.4,
        maxTtl: 1.4
      });
      if (winnerDist <= 5.2 && Math.random() < pressStealProb) {
        bumpPlayerStat(winner.id, 'tackles');
        adjustLiveForm(winner.id, 0.14);
        b.possessionSide = defSide;
        b.lastPasserId = null;
        b.shotStyle = undefined;
        if (winnerDist <= 2.4) {
          b.carrierId = winner.id;
          b.targetId = null;
          b.x = winner.x;
          b.y = winner.y;
          b.fromX = winner.x;
          b.fromY = winner.y;
          b.toX = winner.x;
          b.toY = winner.y;
          b.progress = 0;
          b.duration = 0.16;
          b.flightType = 'carry';
        } else {
          const meetX = clamp((carrier.x + winner.x) * 0.5, 4, 96);
          const meetY = clamp((carrier.y + winner.y) * 0.5, 5, 95);
          winner.tx = meetX;
          winner.ty = meetY;
          winner.intent = 'PASS_TARGET';
          b.fromX = carrier.x;
          b.fromY = carrier.y;
          b.toX = meetX;
          b.toY = meetY;
          b.curve = 0;
          b.maxZ = 0.25;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = clamp(winnerDist / 22, 0.18, 0.30);
          b.flightType = 'bounce';
          b.carrierId = null;
          b.targetId = winner.id;
          b.bounceNext = {
            carrierId: winner.id,
            possessionSide: defSide,
            phaseLabel: `🔥 ${defTeam.name} รุมกดดันเพรสซิ่งแย่งบอลจาก ${carrier.shortName}!`,
            phaseTone: 'attack'
          };
        }
        w.phaseLabel = `🔥 ${defTeam.name} รุมกดดันเพรสซิ่งแย่งบอลจาก ${carrier.shortName}!`;
        w.phaseTone = 'attack';
        SFX.tackle(false);
        if (Math.random() < 0.35) {
          pushLog(curMin, `🔥 เพรสซิ่งหนัก! ${winner.id} และเพื่อนรุมกดดันแย่งบอลจาก ${carrier.id} (${attTeam.name}) สำเร็จ!`);
        }
        return;
      }
    }

    // 2a2. Turf Slip ("ลื่นล้ม") & Panicked Own-Box Mistake Own Goal ("ทำเข้าประตูตัวเอง")
    const inOwnPenaltyBox = carrier.pos !== 'GK' && carrierNormXEarly < 16.5 && Math.abs(carrier.y - 50) <= 29;
    if (carrier.pos !== 'GK' && curMin >= 2) {
      const onPuddle = isOnRainyPuddle(w, carrier.x, carrier.y);
      const isRainy = w.env?.season === 'rainy';
      const slipBase = 0.0085 + (isRainy ? 0.008 : 0) + (onPuddle ? 0.024 : 0) + (carrier.fit < 55 ? 0.014 : 0) + (nearestDefDist < 7.5 ? 0.007 : 0);
      const slipAgilAdj = ((carrier.d.spd || 60) + (carrier.d.comp || 60) - 120) * 0.00012;
      const carrierSlipProb = clamp(
        (slipBase - slipAgilAdj) *
          ((carrier.blessedMins ?? 0) > 0 ? 0.35 : 1) *
          turfMatchMods.slipMult *
          getSideFacMods(side).slipResistMult,
        0.004,
        0.08
      );
      if (Math.random() < carrierSlipProb) {
        triggerAgentSlipFx(w, carrier, `💦 ${carrier.shortName} ลื่นล้ม!`, inOwnPenaltyBox ? -0.22 : -0.15);
        triggerCoachMood(w, side, '🤦', 1.9);
        if (nearestDef && nearestDefDist <= 3.0) {
          bumpPlayerStat(nearestDef.id, 'tackles');
          b.possessionSide = defSide;
          b.carrierId = nearestDef.id;
          b.lastPasserId = null;
          b.targetId = null;
          b.x = nearestDef.x;
          b.y = nearestDef.y;
          b.fromX = nearestDef.x;
          b.fromY = nearestDef.y;
          b.toX = nearestDef.x;
          b.toY = nearestDef.y;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.phaseLabel = `💦 ${carrier.shortName} ลื่นล้ม${onPuddle ? 'บนแอ่งน้ำ' : ''}! ${nearestDef.shortName} ฉกบอลไปได้`;
          w.phaseTone = 'attack';
        } else if (nearestDef && nearestDefDist < 11.5) {
          bumpPlayerStat(nearestDef.id, 'tackles');
          const looseX = clamp((carrier.x + nearestDef.x) * 0.55, 5, 95);
          const looseY = clamp((carrier.y + nearestDef.y) * 0.55, 8, 92);
          nearestDef.tx = looseX;
          nearestDef.ty = looseY;
          nearestDef.intent = 'PASS_TARGET';
          b.fromX = carrier.x;
          b.fromY = carrier.y;
          b.toX = looseX;
          b.toY = looseY;
          b.curve = 0;
          b.maxZ = 0.22;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = clamp(nearestDefDist / 24, 0.22, 0.42);
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = nearestDef.id;
          b.bounceNext = {
            carrierId: nearestDef.id,
            possessionSide: defSide,
            phaseLabel: `💦 ${carrier.shortName} ลื่นล้ม${onPuddle ? 'บนแอ่งน้ำ' : ''}! ${nearestDef.shortName} ฉกบอลไปได้`,
            phaseTone: 'attack'
          };
          w.phaseLabel = `💦 ${carrier.shortName} ลื่นล้ม${onPuddle ? 'บนแอ่งน้ำ' : ''}! บอลหลุดไปทาง ${nearestDef.shortName}`;
          w.phaseTone = 'attack';
        } else {
          const nearCatcher = active
            .filter((a) => a.id !== carrier.id)
            .sort((u, v) => Math.hypot(u.x - carrier.x, u.y - carrier.y) - Math.hypot(v.x - carrier.x, v.y - carrier.y))[0];
          const looseX = clamp(carrier.x + dir * (3.5 + Math.random() * 3), 5, 95);
          const looseY = clamp(carrier.y + (Math.random() - 0.5) * 8, 8, 92);
          if (nearCatcher) {
            nearCatcher.tx = looseX;
            nearCatcher.ty = looseY;
            nearCatcher.intent = 'PASS_TARGET';
          }
          b.fromX = carrier.x;
          b.fromY = carrier.y;
          b.toX = looseX;
          b.toY = looseY;
          b.curve = 0;
          b.maxZ = 0.2;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = 0.38;
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = nearCatcher?.id || null;
          b.bounceNext = {
            carrierId: nearCatcher?.id,
            possessionSide: nearCatcher?.side || defSide,
            phaseLabel: `💦 ${carrier.shortName} ลื่นเสียหลัก! บอลหลุดเท้า`,
            phaseTone: 'normal'
          };
          w.phaseLabel = `💦 ${carrier.shortName} ลื่นล้มเสียหลักบนพื้นสนาม!`;
          w.phaseTone = 'normal';
        }
        pushLog(curMin, `💦 ลื่นล้ม! ${carrier.id} (${attTeam.name}) ลื่นไถล${onPuddle ? 'บนแอ่งน้ำ' : 'เสียจังหวะ'} ทำให้เสียการครองบอล!`);
        return;
      }

      // Panicked Own-Box Clearance / Backpass mistake into own net under heavy press
      if (inOwnPenaltyBox && nearestDefDist < 10.5 && curMin >= 4) {
        const panicProb = clamp(
          0.0055 +
            (isRainy ? 0.003 : 0) +
            (onPuddle ? 0.005 : 0) +
            (carrier.fit < 55 ? 0.004 : 0) -
            ((carrier.d.comp || 60) - 60) * 0.00012,
          0.0025,
          0.018
        ) * ((carrier.blessedMins ?? 0) > 0 ? 0.25 : 1);
        if (Math.random() < panicProb) {
          launchOwnGoalShot(w, curMin, defSide, carrier, attTeam, 'โดนกดดันหนัก สกัดคืนหลังผิดเหลี่ยมพุ่งเข้าประตูตัวเอง!');
          return;
        }
      }
    }

    const dribbleSkill =
      carrier.d.spd * 0.42 +
      carrier.d.run * 0.34 +
      carrier.d.cur * 0.24 +
      (agentHasTrait(carrier, 'flair_dribbler') ? 14 : 0) +
      (carrier.sig === 'spd' || carrier.sig === 'cur' || carrier.sig === 'str' || carrier.sig === 'run' ? 6 : 0);
    if (nearestDef && nearestDefDist < 9.5 && carrier.pos !== 'GK' && carrierNormXEarly > 24) {
      const tempoDribMod = attCfg.tempo === 2 ? -0.04 : attCfg.tempo === 0 ? 0.05 : 0;
      const skillProb = clamp(
        0.21 +
          (dribbleSkill - (nearestDef.d.rd * 0.5 + nearestDef.d.pos * 0.5)) * 0.0045 +
          (inBoxNow ? 0.08 : 0) +
          (agentHasTrait(carrier, 'flair_dribbler') ? 0.12 : carrier.sig === 'spd' || carrier.sig === 'cur' ? 0.06 : 0) +
          tempoDribMod,
        0.12,
        0.56
      );
      if (Math.random() < skillProb) {
        const rollSk = Math.random();
        let skType: NonNullable<LivePitchAgent['acrobatType']> = 'spin';
        let skillLabel = `🌀 ${carrier.shortName} หมุนตัว 360°`;
        let fxColor = '#c084fc';
        let advDist = 6.8;
        let isDragback = false;

        if ((attCfg.tempo === 0 || agentHasTrait(carrier, 'tempo_controller') || carrier.d.cur >= 64) && rollSk < 0.32) {
          skType = 'dragback';
          isDragback = true;
          skillLabel = `🧲 ${carrier.shortName} คลึงบอลดึงจังหวะหลบ!`;
          fxColor = '#2dd4bf';
          advDist = 4.6;
        } else if (carrier.sig === 'spd' || (carrier.d.spd >= 70 && rollSk < 0.54)) {
          skType = 'burst';
          skillLabel = `⚡ ${carrier.shortName} กระชากหนี!`;
          fxColor = '#38bdf8';
          advDist = 10.2;
        } else if (carrier.sig === 'str' || (carrier.d.str >= 70 && rollSk < 0.68)) {
          skType = 'shield';
          skillLabel = `💪 ${carrier.shortName} บังบอลพลิกหนี`;
          fxColor = '#facc15';
          advDist = 6.2;
        } else if (agentHasTrait(carrier, 'flair_dribbler') || rollSk < 0.88) {
          skType = 'stepover';
          skillLabel = nearestDefDist < 5.5 && Math.random() < 0.45 ? `🔥 ${carrier.shortName} ลอดขาเอลาสติโก้!` : `🪄 ${carrier.shortName} สับขาหลอก!`;
          fxColor = '#f472b6';
          advDist = 7.8;
        }

        carrier.acrobatType = skType;
        carrier.acrobatMax = 0.78;
        carrier.acrobatTimer = 0.78;
        carrier.skillSpinDir = Math.random() < 0.5 ? 1 : -1;
        bumpPlayerStat(carrier.id, 'dribbles');
        nearestDef.intent = 'MARK';
        nearestDef.intentTimer = 0.72;

        const advX = clamp(carrier.x + dir * advDist, 6, 94);
        const advY = clamp(carrier.y + (50 - carrier.y) * 0.25 + (Math.random() - 0.5) * 10, 7, 93);
        carrier.tx = advX;
        carrier.ty = advY;
        b.fromX = carrier.x;
        b.fromY = carrier.y;
        b.toX = advX;
        b.toY = advY;
        b.curve = 0;
        b.maxZ = 0;
        b.progress = 0;
        b.duration = skType === 'burst' ? 0.42 : isDragback ? 0.52 : 0.48;
        b.flightType = 'carry';
        b.shotStyle = undefined;
        b.carrierId = carrier.id;
        b.targetId = null;
        addWorldFx(w, {
          type: isDragback ? 'dragback' : 'skill',
          x: carrier.x,
          y: carrier.y,
          label: skillLabel,
          color: fxColor,
          ttl: 2.0,
          maxTtl: 2.0
        });
        if (inBoxNow || carrier.isMe || skType === 'burst') {
          triggerDramaSlow(w, 0.78, skillLabel);
        }
        const flairTag = agentHasTrait(carrier, 'flair_dribbler') ? ` [${TRAIT_BY_ID.flair_dribbler.name}]` : '';
        w.phaseLabel = `${skillLabel}${flairTag}`;
        w.phaseTone = 'attack';
        if (inBoxNow || carrier.isMe || Math.random() < 0.36) {
          pushLog(curMin, `🪄 โชว์ทักษะ! ${skillLabel} (${attTeam.name}) หลบ ${nearestDef.shortName} ได้สำเร็จ!`);
        }
        return;
      }
    }

    if (nearestDef && nearestDefDist < (defCfg.press === 2 ? 5.2 : inBoxNow ? 4.8 : 4.2) && carrier.pos !== 'GK') {
      // Defender Slip while pressing/chasing carrier!
      const defOnPuddle = isOnRainyPuddle(w, nearestDef.x, nearestDef.y);
      const defSlipProb = clamp(
        (0.0085 + (w.env?.season === 'rainy' ? 0.007 : 0) + (defOnPuddle ? 0.024 : 0) + (nearestDef.fit < 55 ? 0.013 : 0) - ((nearestDef.d.pos || 60) - 60) * 0.00015) *
          ((nearestDef.blessedMins ?? 0) > 0 ? 0.35 : 1) *
          turfMatchMods.slipMult *
          getSideFacMods(defSide).slipResistMult,
        0.004,
        0.07
      );
      if (curMin >= 2 && Math.random() < defSlipProb) {
        triggerAgentSlipFx(w, nearestDef, `💦 ${nearestDef.shortName} ลื่น!`, -0.18);
        triggerCoachMood(w, defSide, '😱', 2.0);
        carrier.acrobatType = 'burst';
        carrier.acrobatMax = 0.72;
        carrier.acrobatTimer = 0.72;
        const burstX = clamp(carrier.x + dir * (7.5 + Math.random() * 4.5), 6, 94);
        const burstY = clamp(carrier.y + (50 - carrier.y) * 0.3, 12, 88);
        carrier.tx = burstX;
        carrier.ty = burstY;
        b.fromX = carrier.x;
        b.fromY = carrier.y;
        b.toX = burstX;
        b.toY = burstY;
        b.curve = 0;
        b.maxZ = 0;
        b.startZ = 0;
        b.endZ = 0;
        b.progress = 0;
        b.duration = 0.42;
        b.flightType = 'carry';
        b.shotStyle = undefined;
        b.carrierId = carrier.id;
        b.targetId = null;
        bumpPlayerStat(carrier.id, 'dribbles');
        w.phaseLabel = `💦 ${nearestDef.shortName} ลื่นล้ม! ${carrier.shortName} ฉวยโอกาสกระชากหลุด!!`;
        w.phaseTone = 'attack';
        pushLog(curMin, `💦 จังหวะพลาด! ${nearestDef.id} (${defTeam.name}) ลื่นล้ม${defOnPuddle ? 'บนแอ่งน้ำ' : 'เสียหลัก'} ปล่อย ${carrier.id} หลุดเข้าพื้นที่อันตราย!`);
        return;
      }

      const defVolatile = nearestDef.tr === 1 || nearestDef.tr === 7 || nearestDef.tr === 15 || nearestDef.tr === 22 || nearestDef.tr === 26;
      const defBehindScore = defSide === 'H' ? simRef.current.gh < simRef.current.ga : simRef.current.ga < simRef.current.gh;
      const defHasDisciplinePerk = defTeam.id === state.me && Boolean(state.p?.perks?.includes('discipline_pro'));
      const defsBetweenCarrierAndGoal = defPool.filter(
        (d) => !d.sentOff && d.pos !== 'GK' && d.id !== nearestDef.id && (attRight ? d.x > carrier.x + 2 : d.x < carrier.x - 2)
      ).length;
      const isBreakawayCounter =
        defsBetweenCarrierAndGoal <= 1 && (carrierNormXEarly >= 52 || carrier.d.spd - nearestDef.d.spd >= 6);
      const foulProb = clamp(
        0.048 +
          (defCfg.press === 2 ? 0.028 : defCfg.press === 0 ? -0.014 : 0) +
          (defVolatile ? 0.034 : nearestDef.tr === 0 || nearestDef.tr === 6 || nearestDef.tr === 21 || nearestDef.tr === 23 ? -0.014 : 0) +
          (carrier.tr === 25 ? 0.026 : 0) +
          (agentHasTrait(nearestDef, 'slide_tackler') ? 0.012 : 0) +
          (defHasDisciplinePerk ? -0.012 : 0) +
          (nearestDef.fit < 58 ? 0.018 : nearestDef.fit < 68 ? 0.008 : 0) +
          (turfMatchMods.slipMult > 1.08 || defOnPuddle ? 0.012 : 0) +
          (isBreakawayCounter ? 0.018 : 0) +
          (curMin >= 72 && defBehindScore ? 0.014 : 0) +
          (isDerby ? 0.015 : 0) +
          (inBoxNow ? 0.024 : 0) -
          ((nearestDef.sig === 'pos' ? nearestDef.d.pos + 8 : nearestDef.d.pos) - 60) * 0.0008,
        0.028,
        0.19
      );

      const resolveCommittedFoul = (forcedKind?: 'late_slide' | 'push') => {
        if (defSide === 'H') w.foulsH++;
        else w.foulsA++;
        SFX.foul();
        SFX.boo(inBoxNow ? 0.85 : 0.62);

        const alreadyYellowed = (simRef.current.yellows[nearestDef.id] || 0) >= 1;
        const speedMismatch = carrier.d.spd - nearestDef.d.spd >= 7;
        let foulKind: 'tactical' | 'late_slide' | 'hard_tackle' | 'push' | 'dogso' = 'push';
        if (forcedKind === 'late_slide') {
          foulKind = isBreakawayCounter && distToGoal < 30 && !inBoxNow && Math.random() < 0.35 ? 'dogso' : 'late_slide';
        } else if (forcedKind === 'push') {
          foulKind = 'push';
        } else if (isBreakawayCounter && distToGoal < 30 && !inBoxNow && Math.random() < 0.32) {
          foulKind = 'dogso';
        } else if (!inBoxNow && (isBreakawayCounter || (speedMismatch && distToGoal < 58)) && Math.random() < 0.52) {
          foulKind = 'tactical';
        } else if ((defCfg.press === 2 || defVolatile || agentHasTrait(nearestDef, 'slide_tackler') || nearestDef.fit < 58 || defOnPuddle) && Math.random() < 0.36) {
          foulKind = 'late_slide';
        } else if (Math.random() < 0.28) {
          foulKind = 'hard_tackle';
        } else {
          foulKind = 'push';
        }

        if (foulKind === 'late_slide' || foulKind === 'dogso') {
          nearestDef.acrobatType = 'slide';
          nearestDef.acrobatMax = 0.65;
          nearestDef.acrobatTimer = 0.65;
        } else if (foulKind === 'hard_tackle' || foulKind === 'push') {
          nearestDef.acrobatType = 'clash';
          nearestDef.acrobatMax = 0.55;
          nearestDef.acrobatTimer = 0.55;
          carrier.acrobatType = 'clash';
          carrier.acrobatMax = 0.55;
          carrier.acrobatTimer = 0.55;
        } else {
          nearestDef.acrobatType = 'tackle';
          nearestDef.acrobatMax = 0.52;
          nearestDef.acrobatTimer = 0.52;
        }

        const injSev = foulKind === 'late_slide' || foulKind === 'hard_tackle' ? 'slide' : 'foul';
        tryTriggerInMatchInjury(w, carrier, curMin, injSev, false, nearestDef.id);

        const shouldVarPen = (inBoxNow && Math.random() < 0.32) || (onBoxEdgeNow && Math.random() < 0.26);
        const existingReds = simRef.current.cards.filter((c) => c.type === 'R' || c.type === 'Y2R').length;
        const isSevereFoul =
          foulKind === 'dogso' ||
          ((foulKind === 'late_slide' || foulKind === 'hard_tackle') &&
            (defVolatile || agentHasTrait(nearestDef, 'slide_tackler')));
        const shouldVarFoulCard =
          !shouldVarPen &&
          w.varChecks < 2 &&
          existingReds === 0 &&
          isSevereFoul &&
          Math.random() < (foulKind === 'dogso' ? 0.38 : 0.16);

        if (shouldVarPen && w.varChecks < 2) {
          w.varChecks++;
          const spotX = attRight ? 88.5 : 11.5;
          const overturn = inBoxNow ? Math.random() < 0.22 : Math.random() < 0.45;
          const willAwardPen = !overturn;
          const gkPen = defPool.find((d) => !d.sentOff && d.pos === 'GK');
          const boxLineX = attRight ? 83.5 : 16.5;
          const penRoll = Math.random();
          const penScenario: 'box_edge_foul' | 'handball_box' | 'gk_clash_box' =
            penRoll < 0.28 && distToGoal < 16
              ? 'gk_clash_box'
              : penRoll < 0.56
                ? 'handball_box'
                : 'box_edge_foul';
          const replayIncidentX =
            penScenario === 'gk_clash_box'
              ? attRight ? clamp(carrier.x, 89.5, 95.5) : clamp(carrier.x, 4.5, 10.5)
              : willAwardPen
                ? attRight ? clamp(carrier.x, 84.8, 94.0) : clamp(carrier.x, 6.0, 15.2)
                : attRight ? clamp(Math.min(carrier.x, 81.8), 76.5, 82.0) : clamp(Math.max(carrier.x, 18.2), 18.0, 23.5);
          const replayIncidentY = penScenario === 'gk_clash_box' ? clamp(carrier.y, 38, 62) : clamp(carrier.y, 23, 77);
          const penReason =
            penScenario === 'handball_box'
              ? `เช็กจังหวะแฮนด์บอลของ ${nearestDef.shortName} ในกรอบเขตโทษ`
              : penScenario === 'gk_clash_box'
                ? `เช็กจังหวะผู้รักษาประตูปะทะ ${carrier.shortName} ในกรอบ`
                : `เช็กจุดโทษ & ใบเหลือง/แดงของ ${nearestDef.shortName}`;
          const penLog =
            penScenario === 'handball_box'
              ? `🖥 ผู้ตัดสินเช็ก VAR จังหวะบอลพุ่งโดนแขน ${nearestDef.id} (${defTeam.name}) ในเขตโทษ!`
              : penScenario === 'gk_clash_box'
                ? `🖥 ผู้ตัดสินเช็ก VAR จังหวะผู้รักษาประตู ${defTeam.name} พุ่งปะทะ ${carrier.id} ในกรอบ!`
                : `🖥 ผู้ตัดสินขอเช็ก VAR จังหวะ ${nearestDef.id} (${defTeam.name}) สกัดใส่ ${carrier.id} ในกรอบเขตโทษ!`;
          varBuildupSamplesRef.current = rollingSamplesRef.current.slice();
          w.varReview = {
            kind: 'penalty',
            side,
            waitSec: 6.0,
            totalSec: 6.0,
            x: willAwardPen ? spotX : replayIncidentX,
            y: willAwardPen ? 50 : replayIncidentY,
            culpritId: nearestDef.id,
            culpritShort: nearestDef.shortName,
            culpritSide: defSide,
            overturn: !willAwardPen,
            distToGoal,
            reasonText: penReason,
            replay: {
              scenario: penScenario,
              attRight,
              attId: carrier.id,
              attShort: carrier.shortName,
              attNo: carrier.no,
              attRole: carrier.role,
              attVis: carrier.vis,
              defId: nearestDef.id,
              defShort: nearestDef.shortName,
              defNo: nearestDef.no,
              defRole: nearestDef.role,
              defVis: nearestDef.vis,
              defX: nearestDef.x,
              defY: nearestDef.y,
              gkNo: gkPen?.no,
              gkRole: gkPen?.role || 'GK',
              gkVis: gkPen?.vis,
              gkX: gkPen?.x,
              gkY: gkPen?.y,
              passFromX: clamp(replayIncidentX + (attRight ? -7.5 : 7.5), 4, 96),
              passFromY: clamp(replayIncidentY + (replayIncidentY < 50 ? 8.5 : -8.5), 14, 86),
              incidentX: replayIncidentX,
              incidentY: replayIncidentY,
              defLineX: boxLineX,
              foulKind,
              inBox: willAwardPen
            }
          };
          addWorldFx(w, {
            type: 'var',
            x: carrier.x,
            y: carrier.y,
            label: penScenario === 'handball_box' ? '🖥 VAR เช็กแฮนด์บอล!' : '🖥 VAR เช็กจุดโทษ!',
            color: '#38bdf8',
            ttl: 6.0,
            maxTtl: 6.0
          });
          triggerDramaSlow(w, 6.0, penScenario === 'handball_box' ? '🖥 VAR เช็กแฮนด์บอล' : '🖥 VAR เช็กจุดโทษ');
          SFX.var();
          b.carrierId = null;
          b.targetId = null;
          b.progress = 1;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.phaseLabel = penScenario === 'handball_box' ? '🖥 VAR กำลังเช็กแฮนด์บอลในเขตโทษ!' : '🖥 VAR กำลังเช็กจังหวะฟาวล์ในเขตโทษ!';
          w.phaseTone = 'setpiece';
          pushLog(curMin, penLog, 'sys');
          return;
        }

        if (shouldVarFoulCard) {
          w.varChecks++;
          const upgradeRed = Math.random() < (foulKind === 'dogso' ? 0.56 : defVolatile ? 0.28 : 0.18);
          const replayIncX = clamp(carrier.x, 12, 88);
          const replayIncY = clamp(carrier.y, 14, 86);
          const foulScenario: 'dogso' | 'late_slide' | 'reckless_duel' =
            foulKind === 'dogso' ? 'dogso' : foulKind === 'late_slide' ? 'late_slide' : 'reckless_duel';
          const gkFoul = defPool.find((d) => !d.sentOff && d.pos === 'GK');
          const supMfFoul =
            attPool.find((a) => !a.sentOff && a.id !== carrier.id && a.pos === 'MF') ||
            attPool.find((a) => !a.sentOff && a.id !== carrier.id);
          varBuildupSamplesRef.current = rollingSamplesRef.current.slice();
          w.varReview = {
            kind: 'foul_card',
            side,
            waitSec: 5.8,
            totalSec: 5.8,
            x: carrier.x,
            y: carrier.y,
            culpritId: nearestDef.id,
            culpritShort: nearestDef.shortName,
            culpritSide: defSide,
            overturn: upgradeRed,
            pendingCardUpgrade: upgradeRed ? 'R' : 'Y',
            distToGoal,
            reasonText:
              foulScenario === 'dogso'
                ? `เช็กจังหวะตัดเกมหลุดเดี่ยวของ ${nearestDef.shortName} (DOGSO)`
                : foulScenario === 'reckless_duel'
                  ? `เช็กจังหวะปะทะรุนแรง / นอกเกมของ ${nearestDef.shortName}`
                  : `เช็กจังหวะเสียบสกัดเปิดปุ่มของ ${nearestDef.shortName} (ลุ้นใบแดง)`,
            replay: {
              scenario: foulScenario,
              attRight,
              attId: carrier.id,
              attShort: carrier.shortName,
              attNo: carrier.no,
              attRole: carrier.role,
              attVis: carrier.vis,
              defId: nearestDef.id,
              defShort: nearestDef.shortName,
              defNo: nearestDef.no,
              defRole: nearestDef.role,
              defVis: nearestDef.vis,
              defX: nearestDef.x,
              defY: nearestDef.y,
              gkNo: gkFoul?.no,
              gkRole: gkFoul?.role || 'GK',
              gkVis: gkFoul?.vis,
              gkX: gkFoul?.x,
              gkY: gkFoul?.y,
              passerNo: supMfFoul?.no,
              passerRole: supMfFoul?.role,
              passerVis: supMfFoul?.vis,
              passFromX: supMfFoul ? supMfFoul.x : clamp(replayIncX + (attRight ? -5.0 : 5.0), 4, 96),
              passFromY: supMfFoul ? supMfFoul.y : clamp(replayIncY + (replayIncY < 50 ? -2.0 : 2.0), 10, 90),
              incidentX: replayIncX,
              incidentY: replayIncY,
              defLineX: nearestDef.x,
              foulKind
            }
          };
          addWorldFx(w, {
            type: 'var',
            x: carrier.x,
            y: carrier.y,
            label: '🖥 VAR เช็กฟาวล์/ใบแดง!',
            color: '#f59e0b',
            ttl: 5.8,
            maxTtl: 5.8
          });
          triggerDramaSlow(w, 5.8, '🖥 VAR เช็กใบแดง');
          SFX.var();
          b.carrierId = null;
          b.targetId = null;
          b.progress = 1;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.phaseLabel = `🖥 VAR กำลังเช็กจังหวะฟาวล์รุนแรงของ ${nearestDef.shortName}!`;
          w.phaseTone = 'danger';
          pushLog(curMin, `🖥 ผู้ตัดสินเดินไปดูจอ VAR เช็กจังหวะฟาวล์อันตรายของ ${nearestDef.id} (${defTeam.name})!`, 'sys');
          return;
        }

        const minuteLeniency = curMin <= 12 ? -0.10 : curMin >= 68 ? 0.08 : 0;
        const traitCardMod =
          (defVolatile ? 0.10 : nearestDef.tr === 0 || nearestDef.tr === 6 || nearestDef.tr === 21 || nearestDef.tr === 23 ? -0.04 : 0) +
          (isDerby ? 0.05 : 0) +
          (defHasDisciplinePerk ? -0.04 : 0);

        let baseCardProb = 0.10;
        let directRedBias = 0;
        let cardReason = 'เข้าสกัดหนัก';
        let foulDesc = `ทำฟาวล์ใส่ ${carrier.id}`;

        if (foulKind === 'dogso') {
          baseCardProb = inBoxNow ? 0.68 : 0.88;
          directRedBias = inBoxNow ? 0.14 : 0.44;
          cardReason = inBoxNow ? 'ขัดขวางจังหวะยิงในเขตโทษ' : 'ฟาวล์ตัวสุดท้ายหยุดโอกาสหลุดเดี่ยว';
          foulDesc = `สกัดตัดเกมหลุดเดี่ยวใส่ ${carrier.id}`;
        } else if (foulKind === 'tactical') {
          baseCardProb = 0.72;
          directRedBias = 0;
          cardReason = 'ดึงเสื้อ/ตัดเกมโต้กลับ';
          foulDesc = `ดึงเสื้อตัดจังหวะโต้กลับใส่ ${carrier.id}`;
        } else if (foulKind === 'late_slide') {
          baseCardProb = 0.48;
          directRedBias = 0.045;
          cardReason = 'สไลด์เปิดปุ่มช้าเกินจังหวะ';
          foulDesc = `สไลด์ดักช้าโดนข้อเท้า ${carrier.id}`;
        } else if (foulKind === 'hard_tackle') {
          baseCardProb = 0.32;
          directRedBias = 0.022;
          cardReason = 'เข้าปะทะหนักเกินเหตุ';
          foulDesc = `เข้าปะทะหนักใส่ ${carrier.id}`;
        } else {
          baseCardProb = inBoxNow ? 0.18 : 0.09;
          directRedBias = 0;
          cardReason = 'ทำฟาวล์ซ้ำ/ขัดจังหวะ';
          foulDesc = Math.random() < 0.5 ? `กระแทกด้านหลังใส่ ${carrier.id}` : `ขัดขาทำฟาวล์ใส่ ${carrier.id}`;
        }

        const secondYellowMult = alreadyYellowed
          ? foulKind === 'tactical' || foulKind === 'dogso'
            ? 0.90
            : foulKind === 'late_slide' || foulKind === 'hard_tackle'
              ? 0.70
              : 0.36
          : 1;
        const cardChance = clamp((baseCardProb + traitCardMod + minuteLeniency) * secondYellowMult, 0.03, 0.94);
        const maxTotalCards = isDerby ? 11 : 9;
        let cardLbl =
          foulKind === 'tactical'
            ? '⚠️ ดึงตัดเกม!'
            : foulKind === 'late_slide'
              ? '⚠️ สไลด์ฟาวล์!'
              : '⚠️ ฟาวล์!';
        let cardCol = '#f59e0b';
        let cardRes: 'Y' | 'R' | null = null;
        const cardRoll = Math.random();
        if (cardRoll < cardChance && simRef.current.cards.length < maxTotalCards) {
          const r = issueCard(nearestDef, curMin, directRedBias, undefined, false, cardReason, undefined, { victimName: carrier.id });
          cardRes = r === 'Y' ? 'Y' : 'R';
          cardLbl =
            r === 'Y'
              ? `🟨 ใบเหลือง ${nearestDef.shortName}`
              : r === 'Y2R'
                ? `🟨➡🟥 เหลืองแดง! ${nearestDef.shortName}`
                : `🟥 ใบแดง ${nearestDef.shortName}!`;
          cardCol = r === 'Y' ? '#facc15' : '#ef4444';
        } else if (alreadyYellowed && cardRoll < Math.min(0.9, cardChance * 1.45) && !inBoxNow) {
          cardLbl = `⚠️ ตักเตือน! ${nearestDef.shortName}`;
          pushLog(curMin, `⚠️ ผู้ตัดสินเรียก ${nearestDef.id} (${defTeam.name}) มาตักเตือนครั้งสุดท้าย (มีใบเหลืองติดตัวแล้ว)!`);
        }

        if (inBoxNow) {
          const spotX = attRight ? 88.5 : 11.5;
          addWorldFx(w, {
            type: 'penalty',
            x: spotX,
            y: 50,
            label: `🚨 จุดโทษ! (${attTeam.name})`,
            color: '#ef4444',
            ttl: 2.8,
            maxTtl: 2.8
          });
          triggerDramaSlow(w, 2.0, `🚨 จุดโทษ!! (${attTeam.name})`);
          b.carrierId = null;
          b.targetId = null;
          b.progress = 1;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.pendingSetPiece = { type: 'penalty', side, x: spotX, y: 50, waitSec: 1.9 };
          w.phaseLabel = `🚨 จุดโทษ!! ${carrier.shortName} ถูกทำฟาวล์ในเขตโทษ!`;
          w.phaseTone = 'danger';
          pushLog(curMin, `🚨 จุดโทษ!! ${nearestDef.id} ${foulDesc} ในกรอบเขตโทษ · ${attTeam.name} ได้จุดโทษ!`, 'card');
          pushTimeline(curMin, side, 'pen_awarded', carrier.id, 'ได้จุดโทษ (ฟาวล์ในเขต)');
          return;
        }

        if (side === 'H') w.freeKicksH++;
        else w.freeKicksA++;
        if (!cardRes) {
          pushLog(curMin, `⚠️ ${nearestDef.id} (${defTeam.name}) ${foulDesc} · ${attTeam.name} ได้ฟรีคิก`);
        }

        const wallCount = distToGoal < 38 ? (distToGoal < 24 ? 4 : 3) : 0;
        const wallPlayers: { x: number; y: number }[] = [];
        if (wallCount > 0) {
          const ang = Math.atan2(50 - carrier.y, goalX - carrier.x);
          const wx = clamp(carrier.x + Math.cos(ang) * 9.5, 5, 95);
          const wy = clamp(carrier.y + Math.sin(ang) * 9.5, 10, 90);
          for (let k = 0; k < wallCount; k++) {
            const off = (k - (wallCount - 1) / 2) * 2.3;
            wallPlayers.push({ x: wx - Math.sin(ang) * off, y: wy + Math.cos(ang) * off });
          }
        }

        const fxTtl = cardRes === 'R' ? 3.2 : cardRes === 'Y' ? 2.4 : 1.9;
        addWorldFx(w, {
          type: 'foul',
          x: carrier.x,
          y: carrier.y,
          label: cardLbl,
          color: cardCol,
          ttl: fxTtl,
          maxTtl: fxTtl,
          wallPlayers
        });

        b.carrierId = null;
        b.targetId = null;
        b.progress = 1;
        b.flightType = 'carry';
        b.shotStyle = undefined;
        w.pendingSetPiece = {
          type: 'freekick',
          side,
          x: carrier.x,
          y: carrier.y,
          waitSec: cardRes === 'R' ? 1.9 : cardRes === 'Y' ? 1.45 : distToGoal < 38 ? 1.65 : 0.85,
          wallPlayers
        };
        w.phaseLabel = distToGoal < 38 ? `🧱 ตั้งกำแพง! ฟรีคิกระยะ ${Math.round(distToGoal * 0.9)} หลา` : `⚠️ ฟาวล์ (${attTeam.name} ได้ฟรีคิก)`;
        w.phaseTone = cardRes === 'R' ? 'danger' : 'setpiece';
      };

      if (Math.random() < foulProb && curMin >= 2) {
        resolveCommittedFoul();
        return;
      }

      // Defensive Duel Variety: Slide Tackle ("สไลด์"), Shoulder Clash ("เข้าประทะ"), or Clean Interception ("เข้าสกัด")
      const carrierBlessed = (carrier.blessedMins ?? 0) > 0;
      const defBlessed = (nearestDef.blessedMins ?? 0) > 0;
      const miracleAtt = w.miracle?.side === side && w.miracle.minsLeft > 0;
      const carrierDribble =
        carrier.d.spd * 0.55 +
        carrier.d.run * 0.45 +
        (agentHasTrait(carrier, 'flair_dribbler') ? 7 : 0) +
        (carrier.sig === 'str' || carrier.sig === 'spd' ? 5 : 0) +
        (carrierBlessed ? 16 : 0);
      const defTackleEdge =
        (agentHasTrait(nearestDef, 'man_marker') ? 10 : 0) +
        (agentHasTrait(nearestDef, 'slide_tackler') ? 8 : 0) +
        (agentHasTrait(nearestDef, 'pressing_machine') ? 6 : 0) +
        (nearestDef.sig === 'mrk' || nearestDef.sig === 'tkl' ? 6 : 0) +
        (defBlessed ? 18 : 0) +
        (nearestDef.d.rd + (nearestDef.d.tkl ?? nearestDef.d.pos));
      const rawTackleProb = clamp(
        0.18 + (defTackleEdge - carrierDribble - 60) * 0.002 + (defCfg.press === 2 ? 0.05 : -0.02) + (defBlessed ? 0.14 : 0),
        0.10,
        0.48
      );
      const tackleProb = rawTackleProb * (carrierBlessed ? 0.42 : miracleAtt ? 0.65 : 1);
      if (Math.random() < tackleProb) {
        const duelRoll = Math.random();
        const isSlideTackle = duelRoll < ((defCfg.press === 2 ? 0.42 : 0.30) + (agentHasTrait(nearestDef, 'slide_tackler') ? 0.24 : 0));
        const isPhysicalClash = !isSlideTackle && duelRoll < 0.68;

        if (isPhysicalClash) {
          const carPhys = carrier.d.str + (carrier.sig === 'str' ? 12 : 0) + (carrier.fit < 55 ? -8 : 0) + (carrierBlessed ? 18 : 0) + (miracleAtt ? 10 : 0);
          const defPhys = nearestDef.d.str + (nearestDef.d.tkl ?? nearestDef.d.pos) * 0.35 + (nearestDef.sig === 'str' || nearestDef.sig === 'mrk' ? 10 : 0) + (defBlessed ? 18 : 0);
          const clashDx = carrier.x - nearestDef.x;
          const clashDy = carrier.y - nearestDef.y;
          nearestDef.acrobatType = 'clash';
          nearestDef.acrobatMax = 0.65;
          nearestDef.acrobatTimer = 0.65;
          nearestDef.actionDirX = clashDx >= 0 ? 1 : -1;
          nearestDef.actionDirY = clashDy >= 0 ? 1 : -1;
          carrier.acrobatType = 'clash';
          carrier.acrobatMax = 0.65;
          carrier.acrobatTimer = 0.65;
          carrier.actionDirX = clashDx >= 0 ? -1 : 1;
          carrier.actionDirY = clashDy >= 0 ? -1 : 1;

          addWorldFx(w, {
            type: 'clash',
            x: (carrier.x + nearestDef.x) * 0.5,
            y: (carrier.y + nearestDef.y) * 0.5,
            label: `💥 ${nearestDef.shortName} เบียดปะทะ ${carrier.shortName}!`,
            color: '#fb923c',
            ttl: 1.75,
            maxTtl: 1.75
          });

          if (carPhys > defPhys + R(-8, 10)) {
            if (curMin >= 2 && (defVolatile || defCfg.press === 2) && Math.random() < 0.14) {
              resolveCommittedFoul('push');
              return;
            }
            // Attacker wins the shoulder clash and keeps going!
            w.phaseLabel = `💪 ${carrier.shortName} แข็งแกร่งเบียดชนะ ${nearestDef.shortName}!`;
            w.phaseTone = 'attack';
            tryTriggerInMatchInjury(w, nearestDef, curMin, 'clash', false, carrier.id);
          } else {
            // Defender wins the clash cleanly!
            bumpPlayerStat(nearestDef.id, 'tackles');
            tryTriggerInMatchInjury(w, carrier, curMin, 'clash', false, nearestDef.id);
            nudgeAgentToward(nearestDef, carrier.x, carrier.y, 0.9);
            b.possessionSide = defSide;
            b.carrierId = nearestDef.id;
            b.lastPasserId = null;
            b.targetId = null;
            b.x = nearestDef.x;
            b.y = nearestDef.y;
            b.fromX = nearestDef.x;
            b.fromY = nearestDef.y;
            b.toX = nearestDef.x;
            b.toY = nearestDef.y;
            b.flightType = 'carry';
            b.shotStyle = undefined;
            w.phaseLabel = `💥 ${nearestDef.shortName} เข้าปะทะเบียดแย่งบอลสำเร็จ!`;
            w.phaseTone = 'normal';
            SFX.tackle(false);
            if (Math.random() < 0.35) {
              pushLog(curMin, `💥 จังหวะปะทะหนัก! ${nearestDef.id} เบียดชนะ ${carrier.id} ตัดบอลคืนให้ ${defTeam.name}`);
            }
            return;
          }
        } else {
          if (isSlideTackle && curMin >= 2) {
            const slideMistimeProb = clamp(
              0.14 +
                (nearestDef.fit < 58 ? 0.06 : 0) +
                (w.env?.season === 'rainy' || defOnPuddle ? 0.045 : 0) +
                (defVolatile ? 0.05 : 0) -
                ((nearestDef.d.tkl ?? nearestDef.d.pos) - 60) * 0.0025 -
                (agentHasTrait(nearestDef, 'slide_tackler') ? 0.05 : 0),
              0.06,
              0.26
            );
            if (Math.random() < slideMistimeProb) {
              resolveCommittedFoul('late_slide');
              return;
            }
          }
          // Clean Sliding Tackle OR Standing Tackle/Interception (bounded physical lunge, no teleport!)
          const startX = nearestDef.x;
          const startY = nearestDef.y;
          nudgeAgentToward(nearestDef, carrier.x, carrier.y, isSlideTackle ? 1.35 : 0.85);
          nearestDef.facing = Math.atan2(carrier.y - startY, carrier.x - startX);
          nearestDef.acrobatType = isSlideTackle ? 'slide' : 'tackle';
          nearestDef.acrobatMax = isSlideTackle ? 0.72 : 0.6;
          nearestDef.acrobatTimer = isSlideTackle ? 0.72 : 0.6;
          addWorldFx(w, {
            type: isSlideTackle ? 'slide' : 'tackle',
            x: startX,
            y: startY,
            toX: nearestDef.x,
            toY: nearestDef.y,
            label: isSlideTackle ? `⚡ ${nearestDef.shortName} สไลด์สวย!` : `🛡️ ${nearestDef.shortName} เข้าสกัด!`,
            color: isSlideTackle ? '#38bdf8' : '#34d399',
            ttl: 1.85,
            maxTtl: 1.85
          });
          if (isSlideTackle) {
            triggerDramaSlow(w, 0.75, `⚡ สไลด์สกัดบอล! · ${nearestDef.shortName}`);
            tryTriggerInMatchInjury(w, carrier, curMin, 'slide', false, nearestDef.id);
          }

          bumpPlayerStat(nearestDef.id, 'tackles');
          // Wide tackles near the touchline can deflect out for a Throw-in!
          if ((carrier.y < 18 || carrier.y > 82) && Math.random() < 0.26) {
            const outY = carrier.y < 50 ? 1.6 : 98.4;
            const outX = clamp(nearestDef.x, 8, 92);
            b.fromX = nearestDef.x;
            b.fromY = nearestDef.y;
            b.toX = outX;
            b.toY = outY < 50 ? -0.5 : 100.5;
            b.curve = 0;
            b.maxZ = 2.8;
            b.startZ = 0;
            b.endZ = 0;
            b.progress = 0;
            b.duration = 0.34;
            b.flightType = 'bounce';
            b.shotStyle = undefined;
            b.carrierId = null;
            b.targetId = null;
            b.bounceNext = {
              setPiece: { type: 'throwin', side: defSide, x: outX, y: outY, waitSec: 0.68 },
              phaseLabel: `🤲 บอลแฉลบออกข้าง! ${defTeam.name} ได้ทุ่ม`,
              phaseTone: 'setpiece'
            };
            w.phaseLabel = `⚡ ${nearestDef.shortName} สกัดบอลออกข้างสนาม!`;
            w.phaseTone = 'normal';
            SFX.tackle(isSlideTackle);
            return;
          }

          b.possessionSide = defSide;
          b.carrierId = nearestDef.id;
          b.lastPasserId = null;
          b.targetId = null;
          b.x = nearestDef.x;
          b.y = nearestDef.y;
          b.fromX = nearestDef.x;
          b.fromY = nearestDef.y;
          b.toX = nearestDef.x;
          b.toY = nearestDef.y;
          b.progress = 1;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.phaseLabel = isSlideTackle
            ? `⚡ ${nearestDef.shortName}${agentHasTrait(nearestDef, 'slide_tackler') ? ' [จอมสไลด์]' : ''} พุ่งสไลด์กวาดบอลสะอาด!`
            : `🛡️ ${nearestDef.shortName}${agentHasTrait(nearestDef, 'man_marker') ? ' [ตัวประกบติด]' : agentHasTrait(nearestDef, 'interception_hawk') ? ' [เหยี่ยวดักบอล]' : ''} เข้าสกัดแย่งบอลสำเร็จ!`;
          w.phaseTone = 'normal';
          SFX.tackle(isSlideTackle);
          if (isSlideTackle && Math.random() < 0.48) {
            pushLog(curMin, `⚡ สไลด์สุดคม! ${nearestDef.id} (${defTeam.name}) กวาดบอลจากเท้า ${carrier.id} ได้อย่างแม่นยำ`);
          }
          side = defSide;
          attPool = getTeamPool(side);
          defPool = getTeamPool(side === 'H' ? 'A' : 'H');
          carrier = nearestDef;
          const newlyWonCfg = getEffectiveTeamCfg(side, curMin);
          const oppWasHighSiege = attCfg.tac === 'X' || attCfg.line === 2;
          const isDeepCounterTeam = newlyWonCfg.tac === 'Z' || newlyWonCfg.tac === 'D';
          const counterTriggerProb = clamp(
            (newlyWonCfg.pass === 3 ? 0.72 : 0.45) +
              (isDeepCounterTeam ? 0.16 : 0) +
              (oppWasHighSiege ? 0.16 : 0) +
              (newlyWonCfg.tempo === 2 ? 0.08 : 0),
            0.25,
            0.90
          );
          if ((newlyWonCfg.pass === 3 || carrier.sig === 'dist' || agentHasTrait(carrier, 'ball_playing_cb') || agentHasTrait(carrier, 'long_diagonal') || isDeepCounterTeam || oppWasHighSiege) && Math.random() < counterTriggerProb) {
            const counterPool = attPool.filter((a) => a.pos === 'FW' || a.role === 'CAM' || a.role === 'LW' || a.role === 'RW');
            const counterTarget =
              counterPool.find((a) => !checkPassOffside(w, side, carrier, a, defPool).isOffside) ||
              counterPool[0];
            if (counterTarget) {
              const offChk = checkPassOffside(w, side, carrier, counterTarget, defPool);
              const cAttRight = isAttackRight(w, side);
              const cDir = cAttRight ? 1 : -1;
              if (offChk.isOffside) {
                if (Math.random() < 0.32) {
                  triggerOffsideCall(w, curMin, side, carrier, counterTarget, offChk.oppLineX, 'lofted', 'รีบออกตัวล้ำหน้าจังหวะสวนกลับ');
                  return;
                }
                // Keep buildup alive without warping an offside target backward
                return;
              }
              const cDist = Math.hypot(counterTarget.x - carrier.x, counterTarget.y - carrier.y);
              b.fromX = carrier.x;
              b.fromY = carrier.y;
              b.toX = clamp(counterTarget.x + cDir * (oppWasHighSiege ? 8 : 5), 8, 92);
              b.toY = counterTarget.y;
              b.curve = (Math.random() - 0.5) * 4.5;
              b.maxZ = cDist > 22 ? 15 : 6;
              b.startZ = 0;
              b.endZ = 0;
              b.progress = 0;
              b.duration = Math.max(cDist > 22 ? 0.62 : 0.46, clamp(cDist / 38, 0.44, 0.80));
              b.flightType = cDist > 22 ? 'lofted' : 'through';
              b.shotStyle = undefined;
              b.carrierId = null;
              b.targetId = counterTarget.id;
              b.lastPasserId = carrier.id;
              counterTarget.tx = b.toX;
              counterTarget.ty = b.toY;
              counterTarget.intent = 'PASS_TARGET';
              w.phaseLabel = oppWasHighSiege
                ? `🚨 ${defTeam.name} ฉวยจังหวะสวนกลับเร็วเจาะพื้นที่โล่งหลังไลน์สูง!!`
                : isDeepCounterTeam
                  ? `⚡ ${defTeam.name} ตั้งรับเหนียวแล้วดีดสวนกลับเร็ว!`
                  : `🚀 ${carrier.shortName} เปิดบอลสวนกลับเร็ว!`;
              w.phaseTone = 'attack';
              SFX.kick();
              return;
            }
          }
        }
      }
    }

    // 3. Should Carrier Shoot? (Realistic Opponent-Half Range + Cut Inside Curler + Solo Run Finish!)
    const carrierNormXNow = attRight ? carrier.x : 100 - carrier.x;

    // 3a. Cut Inside & Curler ("เลี้ยงตัดเข้าในแล้วยิงปั่นโค้ง") from Inside-Forward Flanks — real dribble-to-shoot!
    const inCutInsideZone = carrierNormXNow >= 62 && carrierNormXNow <= 88 && (carrier.y < 29 || carrier.y > 71);
    const curSkill = carrier.d.cur + (carrier.sig === 'cur' ? 10 : 0) + (agentHasTrait(carrier, 'outside_curler') || agentHasTrait(carrier, 'flair_dribbler') ? 10 : 0);
    if (carrier.pos !== 'GK' && inCutInsideZone && (curSkill >= 66 || carrier.pos === 'FW') && Math.random() < clamp(0.14 + (curSkill - 60) * 0.005 + (attCfg.tac === 'X' || attCfg.tac === 'A' ? 0.05 : 0), 0.08, 0.34)) {
      const destX = clamp(carrier.x + dir * 4.2, 6, 94);
      const destY = clamp(carrier.y + (carrier.y < 50 ? 7.5 : -7.5), 14, 86);
      carrier.acrobatType = 'cutinside';
      carrier.acrobatMax = 0.72;
      carrier.acrobatTimer = 0.72;
      carrier.tx = destX;
      carrier.ty = destY;
      carrier.runToX = destX;
      carrier.runToY = destY;
      carrier.intent = 'CARRY';
      carrier.facing = Math.atan2(destY - carrier.y, destX - carrier.x);
      bumpPlayerStat(carrier.id, 'dribbles');
      addWorldFx(w, {
        type: 'cutinside',
        x: carrier.x,
        y: carrier.y,
        toX: destX,
        toY: destY,
        label: `↪️ ตัดเข้าใน!`,
        color: '#f472b6',
        ttl: 1.5,
        maxTtl: 1.5
      });
      const cutCurve = (destY < 50 ? 1 : -1) * (8.6 + Math.random() * 5.2);
      b.fromX = carrier.x;
      b.fromY = carrier.y;
      b.toX = destX;
      b.toY = destY;
      b.curve = 0;
      b.maxZ = 0;
      b.startZ = 0;
      b.endZ = 0;
      b.progress = 0;
      b.duration = clamp(Math.hypot(destX - carrier.x, destY - carrier.y) / 22, 0.28, 0.44);
      b.flightType = 'carry';
      b.shotStyle = undefined;
      b.carrierId = carrier.id;
      b.targetId = null;
      b.bounceNext = {
        pendingShot: {
          side,
          shooterId: carrier.id,
          destX,
          destY,
          shotStyle: 'curler',
          curveAmt: cutCurve,
          maxZAmt: 8.2,
          shotLabel: `🌀 ${carrier.shortName} เลี้ยงตัดเข้าในแล้วปั่นโค้งเสียบเสา!!`,
          dramaLabel: `🌀 ตัดเข้าในปั่นโค้ง! · ${carrier.shortName}`,
          logLine: `🌀 ${carrier.id} (${attTeam.name}) เลี้ยงตัดจากริมเส้นเข้ากลางแล้วซัดปั่นโค้งอันตราย!`
        }
      };
      w.phaseLabel = `↪️ ${carrier.shortName} กำลังเลี้ยงตัดเข้าในหาช่องยิง!`;
      w.phaseTone = 'attack';
      return;
    }

    // 3b. Solo Dribble Run into Goal ("การโซโล่เดี่ยวเข้าไปยิง") — real sprint dribble then finish!
    const soloRating = carrier.d.spd * 0.42 + carrier.d.run * 0.38 + carrier.d.fin * 0.20 + (agentHasTrait(carrier, 'flair_dribbler') ? 10 : 0);
    if (carrier.pos !== 'GK' && carrierNormXNow >= 52 && carrierNormXNow <= 76 && soloRating >= 66 && Math.random() < clamp(0.05 + (soloRating - 64) * 0.004 + (carrier.isMe ? 0.03 : 0), 0.04, 0.16)) {
      const startX = carrier.x;
      const startY = carrier.y;
      const endX = clamp(carrier.x + dir * (5 + Math.random() * 3), 10, 90);
      const endY = clamp(carrier.y + (50 - carrier.y) * 0.38 + (Math.random() - 0.5) * 4, 24, 76);
      carrier.acrobatType = 'burst';
      carrier.acrobatMax = 0.85;
      carrier.acrobatTimer = 0.85;
      carrier.tx = endX;
      carrier.ty = endY;
      carrier.runToX = endX;
      carrier.runToY = endY;
      carrier.intent = 'CARRY';
      carrier.facing = Math.atan2(endY - startY, endX - startX);
      bumpPlayerStat(carrier.id, 'dribbles');
      addWorldFx(w, {
        type: 'solo',
        x: startX,
        y: startY,
        toX: endX,
        toY: endY,
        label: `🏃💨 กระชากโซโล่!`,
        color: '#facc15',
        ttl: 1.8,
        maxTtl: 1.8
      });
      b.fromX = startX;
      b.fromY = startY;
      b.toX = endX;
      b.toY = endY;
      b.curve = 0;
      b.maxZ = 0;
      b.startZ = 0;
      b.endZ = 0;
      b.progress = 0;
      b.duration = clamp(Math.hypot(endX - startX, endY - startY) / 23, 0.30, 0.48);
      b.flightType = 'carry';
      b.shotStyle = undefined;
      b.carrierId = carrier.id;
      b.targetId = null;
      b.bounceNext = {
        pendingShot: {
          side,
          shooterId: carrier.id,
          destX: endX,
          destY: endY,
          shotStyle: carrier.d.cur >= 66 ? 'curler' : 'normal',
          curveAmt: (endY < 50 ? 1 : -1) * (4.0 + Math.random() * 3.5),
          maxZAmt: 5.5,
          shotLabel: `🏃💨 ${carrier.shortName} โซโล่เดี่ยวแหวกแนวรับลากเข้าไปยิง!!`,
          dramaLabel: `🏃💨 โซโล่เดี่ยวเข้าไปยิง!! · ${carrier.shortName}`,
          logLine: `🏃💨 สุดยอด!! ${carrier.id} (${attTeam.name}) ควบโซโล่เดี่ยวแหวกผู้เล่นคู่แข่งเข้าไปซัดหน้าประตู!`
        }
      };
      w.phaseLabel = `🏃💨 ${carrier.shortName} กระชากบอลโซโล่เดี่ยวฝ่าแนวรับ!`;
      w.phaseTone = 'attack';
      return;
    }

    const carrierBlessedNow = (carrier.blessedMins ?? 0) > 0;
    const miracleAttNow = w.miracle?.side === side && w.miracle.minsLeft > 0;
    const tacShootRange = attCfg.tac === 'X' ? 33 : attCfg.tac === 'A' ? 29 : attCfg.tac === 'B' ? 26 : attCfg.tac === 'D' ? 23 : 20;
    const tacShootBias = attCfg.tac === 'X' ? 0.08 : attCfg.tac === 'A' ? 0.04 : attCfg.tac === 'Z' ? -0.09 : attCfg.tac === 'D' ? -0.04 : 0;
    const isLongShotSpecialist = agentHasTrait(carrier, 'long_shot_lover');
    const canRareHalfwayShot = carrierNormXNow >= 50.5 && distToGoal <= 45.5 && (isLongShotSpecialist || carrier.d.pw >= 74 || carrier.sig === 'pw' || carrierBlessedNow) && Math.random() < (carrierBlessedNow ? 0.18 : 0.09);
    const inOppHalfShootZone = carrierNormXNow >= 52 && distToGoal <= 45.5;
    const inShootZone = inOppHalfShootZone && (distToGoal < tacShootRange || canRareHalfwayShot);
    const shootTraitBias =
      (agentHasTrait(carrier, 'selfish_shooter') ? 0.14 : 0) +
      (agentHasTrait(carrier, 'poacher_instinct') && inBoxNow ? 0.12 : 0) +
      (isLongShotSpecialist && distToGoal >= 20 ? 0.10 : 0) +
      (agentHasTrait(carrier, 'team_first') && !inBoxNow ? -0.08 : 0) +
      (carrierBlessedNow ? 0.15 : 0) +
      (miracleAttNow ? ((w.miracle?.maxDeficit ?? 2) >= 3 ? 0.24 : 0.19) : 0);
    const shootChance = inShootZone
      ? clamp(0.27 + tacShootBias + shootTraitBias + (31 - distToGoal) * 0.025 + (carrier.pos === 'FW' ? 0.14 : 0) + (carrier.sig === 'fin' || carrier.sig === 'pw' || carrier.sig === 'cur' ? 0.07 : 0), 0.14, 0.92)
      : 0;
    if (carrier.pos !== 'GK' && Math.random() < shootChance) {
      let shotStyle: LiveBallState['shotStyle'] = 'normal';
      let shotLabel = distToGoal >= 34 ? `🚀 ${carrier.shortName} ซัดไกลครึ่งสนามลุ้นประตู!!` : `🔥 ${carrier.shortName} ซัดเต็มข้อ!`;
      let curveAmt = (carrier.d.cur > 65 ? 1 : 0.4) * (carrier.y < 50 ? 1 : -1) * (3 + Math.random() * 4);
      let maxZAmt = 6 + Math.random() * 3.5;
      let durAmt = clamp(distToGoal / 36, 0.54, 0.84) * (miracleAttNow ? 0.85 : 1);

      if (inBoxNow && (agentHasTrait(carrier, 'acrobatic_finisher') || carrier.sig === 'fin' || carrier.d.fin >= 67) && Math.random() < (agentHasTrait(carrier, 'acrobatic_finisher') ? 0.34 : 0.16)) {
        shotStyle = 'bicycle';
        carrier.acrobatType = 'bicycle';
        carrier.acrobatMax = 0.85;
        carrier.acrobatTimer = 0.85;
        curveAmt = (Math.random() - 0.5) * 4;
        maxZAmt = 6.8;
        durAmt = 0.56;
        shotLabel = `🤸 ${carrier.shortName} ตีลังกายิงกลางอากาศ!!`;
      } else if (distToGoal < 14.5 && (agentHasTrait(carrier, 'chip_artist') || carrier.sig === 'fin' || carrier.sig === 'comp' || carrier.d.fin >= 68) && Math.random() < (agentHasTrait(carrier, 'chip_artist') ? 0.48 : 0.24)) {
        shotStyle = 'chip';
        curveAmt = 0;
        maxZAmt = 10.5;
        durAmt = 0.76;
        shotLabel = `🪶 ${carrier.shortName} ชิพข้ามหัวอย่างเหนือชั้น!`;
      } else if (distToGoal >= 19 && (agentHasTrait(carrier, 'long_shot_lover') || carrier.sig === 'pw' || carrier.d.pw >= 67) && Math.random() < (agentHasTrait(carrier, 'long_shot_lover') ? 0.44 : 0.34)) {
        shotStyle = 'knuckle';
        curveAmt = (Math.random() - 0.5) * 3.2;
        maxZAmt = 6.2;
        durAmt = 0.60;
        shotLabel = `🌪️ ${carrier.shortName} กดลูกส่ายคนัคเคิลบอล!`;
      } else if ((agentHasTrait(carrier, 'outside_curler') || carrier.sig === 'cur' || carrier.d.cur >= 66) && Math.random() < (agentHasTrait(carrier, 'outside_curler') ? 0.58 : 0.36)) {
        shotStyle = 'trivela';
        curveAmt = (carrier.y < 50 ? -1 : 1) * (6.8 + Math.random() * 4.5);
        maxZAmt = 7.4;
        durAmt = 0.62;
        shotLabel = `🍌 ${carrier.shortName}${agentHasTrait(carrier, 'outside_curler') ? ' [จอมปั่นไซด์ก้อย]' : ''} ดีดไซด์ก้อยโค้งหักศอก!`;
      } else if (agentHasTrait(carrier, 'outside_curler') || carrier.sig === 'cur' || (carrier.d.cur >= carrier.d.pw && Math.random() < 0.58)) {
        shotStyle = 'curler';
        curveAmt = (carrier.y < 50 ? 1 : -1) * (7.2 + Math.random() * 5.2);
        maxZAmt = 7.5;
        shotLabel = `🌀 ${carrier.shortName} ปั่นโค้งๆ เสียบเสา!`;
      } else if (distToGoal >= 21 && (agentHasTrait(carrier, 'long_shot_lover') || carrier.sig === 'pw' || carrier.d.pw >= 68)) {
        shotStyle = 'screamer';
        curveAmt = (Math.random() - 0.5) * 2.2;
        maxZAmt = 5.0;
        durAmt = clamp(distToGoal / 44, 0.50, 0.76);
        shotLabel = distToGoal >= 34
          ? `🚀 ${carrier.shortName} ตะบันไกลครึ่งสนามลุ้นประตู!!`
          : `🚀 ${carrier.shortName}${agentHasTrait(carrier, 'long_shot_lover') ? ' [จอมซัดไกล]' : ''} ตะบันไกลพุ่งเป็นจรวด!`;
      } else if (inBoxNow && Math.random() < (agentHasTrait(carrier, 'acrobatic_finisher') ? 0.44 : 0.28)) {
        shotStyle = 'volley';
        carrier.acrobatType = 'volley';
        carrier.acrobatMax = 0.65;
        carrier.acrobatTimer = 0.65;
        maxZAmt = 4.2;
        durAmt = 0.50;
        shotLabel = `⚡ ${carrier.shortName} ฮาล์ฟวอลเลย์กลางอากาศ!`;
      }

      if (shouldShooterWhiff(w, carrier, nearestDefDist, shotStyle, false)) {
        launchWhiffLooseBall(w, curMin, side, carrier, attTeam, defPool, attRight, 'ง้างเท้ายิงเต็มแรงแต่เตะวืดลมไปอย่างเหลือเชื่อ!');
        return;
      }
      prepareShotFlight(w, curMin, {
        flightType: 'shot',
        side,
        fromX: carrier.x,
        fromY: carrier.y,
        shooter: carrier,
        shotStyle,
        curveAmt,
        maxZAmt,
        durAmt
      });
      w.phaseLabel = shotLabel;
      w.phaseTone = 'danger';
      triggerDramaSlow(w, shotStyle === 'bicycle' || shotStyle === 'curler' || shotStyle === 'trivela' || distToGoal >= 34 ? 1.45 : 1.15, shotLabel);
      SFX.shot();
      if (shotStyle === 'bicycle' || shotStyle === 'knuckle' || shotStyle === 'trivela' || distToGoal >= 34) {
        pushLog(curMin, `🔥 ${shotLabel} (${attTeam.name})`);
      }
      return;
    }

    // 4. Cutback ("เปิดตัดหลังสวยๆ") & Wing Cross
    const inCutbackZone = carrierNormXNow >= 80 && (carrier.y < 27 || carrier.y > 73);
    if (inCutbackZone && Math.random() < 0.44) {
      const cutbackTargets = attPool
        .filter((a) => a.id !== carrier.id && a.pos !== 'GK')
        .filter((a) => {
          const aNorm = attRight ? a.x : 100 - a.x;
          return aNorm >= 72 && aNorm <= 92 && Math.abs(a.y - 50) <= 22;
        })
        .sort((u, v) => (v.d.fin + v.d.run) - (u.d.fin + u.d.run));
      const cTarget = cutbackTargets[0];
      if (cTarget) {
        const destX = clamp(attRight ? 85 + Math.random() * 4 : 11 + Math.random() * 4, 8, 92);
        const destY = clamp(42 + Math.random() * 16, 36, 64);
        const runnerDistCut = Math.hypot(destX - cTarget.x, destY - cTarget.y);
        cTarget.tx = destX;
        cTarget.ty = destY;
        cTarget.intent = 'PASS_TARGET';
        b.fromX = carrier.x;
        b.fromY = carrier.y;
        b.toX = destX;
        b.toY = destY;
        b.curve = (carrier.y < 50 ? 1 : -1) * 2.4;
        b.maxZ = 0;
        b.startZ = 0;
        b.endZ = 0;
        b.progress = 0;
        b.duration = Math.max(0.42 / turfMatchMods.passPaceMult, clamp(runnerDistCut / 24, 0.42, 0.72));
        b.flightType = 'cutback';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = cTarget.id;
        b.lastPasserId = carrier.id;
        bumpPlayerStat(carrier.id, 'crossAssists');
        bumpPlayerStat(carrier.id, 'keyPasses');
        addWorldFx(w, {
          type: 'cutback',
          x: carrier.x,
          y: carrier.y,
          toX: destX,
          toY: destY,
          label: `👟 เปิดคัทแบ็คตัดหลัง!`,
          color: '#f472b6',
          ttl: 1.5,
          maxTtl: 1.5
        });
        w.phaseLabel = `👟 ${carrier.shortName} ลากสุดเส้นเปิดตัดหลังสวยๆ ให้ ${cTarget.shortName}!`;
        w.phaseTone = 'attack';
        SFX.pass();
        return;
      }
    }

    const inWingZone = (carrier.y < 24 || carrier.y > 76) && (attRight ? carrier.x > (agentHasTrait(carrier, 'early_crosser') ? 54 : 62) : carrier.x < (agentHasTrait(carrier, 'early_crosser') ? 46 : 38));
    const crossProb = clamp(
      0.58 +
        (agentHasTrait(carrier, 'early_crosser') ? 0.18 : carrier.sig === 'crs' ? 0.12 : 0) +
        (agentHasTrait(carrier, 'overlapping_runner') ? 0.08 : 0) +
        (attCfg.wid === 2 ? 0.15 : attCfg.wid === 0 ? -0.22 : 0) +
        (attCfg.pass === 2 ? 0.12 : attCfg.pass === 0 ? -0.14 : 0),
      0.24,
      0.88
    );
    if (inWingZone && Math.random() < crossProb) {
      const boxRunners = attPool
        .filter((a) => a.id !== carrier.id && (a.pos === 'FW' || a.role === 'CAM' || baseRoleOf(a.role) === 'CM'))
        .sort((u, v) => {
          const uOff = checkPassOffside(w, side, carrier, u, defPool).isOffside ? -30 : 0;
          const vOff = checkPassOffside(w, side, carrier, v, defPool).isOffside ? -30 : 0;
          return (attRight ? v.x - u.x : u.x - v.x) + (vOff - uOff) + (v.d.hd + v.d.run + (agentHasTrait(v, 'aerial_menace') ? 16 : 0) + (agentHasTrait(v, 'near_post_runner') ? 10 : 0)) * 0.15;
        });
      const target = boxRunners.find((a) => !checkPassOffside(w, side, carrier, a, defPool).isOffside) || boxRunners[0];
      if (target) {
        const offChk = checkPassOffside(w, side, carrier, target, defPool);
        if (offChk.isOffside) {
          triggerOffsideCall(w, curMin, side, carrier, target, offChk.oppLineX, 'cross', 'ยืนล้ำหน้าจังหวะเปิดบอลเข้ากรอบ');
          return;
        }
        const nearPostTarget = agentHasTrait(target, 'near_post_runner');
        const boxX = clamp(attRight ? (nearPostTarget ? 90 + Math.random() * 4 : 87 + Math.random() * 6.2) : (nearPostTarget ? 6 + Math.random() * 4 : 6.8 + Math.random() * 6.2), 6, 94);
        const boxY = clamp(nearPostTarget ? (carrier.y < 50 ? 41 + Math.random() * 6 : 53 + Math.random() * 6) : 40 + Math.random() * 20, 34, 66);
        const crossRunnerDist = Math.hypot(boxX - target.x, boxY - target.y);
        target.tx = boxX;
        target.ty = boxY;
        target.intent = 'PASS_TARGET';
        b.fromX = carrier.x;
        b.fromY = carrier.y;
        b.toX = boxX;
        b.toY = boxY;
        b.curve = (carrier.y < 50 ? 1 : -1) * (agentHasTrait(carrier, 'early_crosser') || carrier.sig === 'crs' || carrier.sig === 'cur' ? 8.8 : 7.5);
        b.maxZ = 16.5;
        b.startZ = 0;
        b.endZ = 3.2;
        b.progress = 0;
        const baseCrossDur = agentHasTrait(carrier, 'early_crosser') ? 0.60 : 0.68;
        b.duration = Math.max(baseCrossDur, clamp(crossRunnerDist / 25, baseCrossDur, 0.96));
        b.flightType = 'cross';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = target.id;
        b.lastPasserId = carrier.id;
        bumpPlayerStat(carrier.id, 'crossAssists');
        bumpPlayerStat(carrier.id, 'keyPasses');
        w.phaseLabel = `👟 ${carrier.shortName}${agentHasTrait(carrier, 'early_crosser') ? ' [ครอสไวข้าง]' : ''} เปิดบอลโด่งเข้ากรอบ!`;
        w.phaseTone = 'attack';
        SFX.kick();
        return;
      }
    }

    // 4b. Give-and-Go ("ทำชิง 1-2") — favored by Short Passing, Narrow Width, and Fast Tempo!
    if (carrier.pos !== 'GK' && (attRight ? carrier.x > 32 && carrier.x < 88 : carrier.x < 68 && carrier.x > 12)) {
      const partner = attPool
        .filter((a) => a.id !== carrier.id && a.pos !== 'GK')
        .map((cand) => ({ cand, d: Math.hypot(cand.x - carrier.x, cand.y - carrier.y) }))
        .filter((x) => x.d >= 6.0 && x.d <= 19.0)
        .sort((u, v) => u.d - v.d)[0]?.cand;
      const oneTwoProb = clamp(
        0.20 +
          (agentHasTrait(carrier, 'one_two_lover') ? 0.18 : 0) +
          (agentHasTrait(carrier, 'team_first') ? 0.08 : 0) +
          (agentHasTrait(carrier, 'selfish_shooter') ? -0.10 : 0) +
          (attCfg.pass === 0 ? 0.16 : attCfg.pass === 2 ? -0.10 : 0) +
          (attCfg.wid === 0 ? 0.08 : 0) +
          (attCfg.tempo === 2 ? 0.06 : 0),
        0.08,
        0.52
      );
      if (partner && Math.random() < oneTwoProb) {
        const defXsOneTwo = defPool.map((a) => a.x).sort((u, v) => (attRight ? v - u : u - v));
        const oneTwoLineX = attRight ? Math.max(50, defXsOneTwo[1] ?? 80) : Math.min(50, defXsOneTwo[1] ?? 20);
        const rawDestX = clamp(carrier.x + dir * (8.5 + Math.random() * 4.5), 6, 94);
        const runDestX = attRight ? Math.min(rawDestX, oneTwoLineX - 0.5) : Math.max(rawDestX, oneTwoLineX + 0.5);
        const runDestY = clamp(carrier.y + (50 - carrier.y) * 0.22 + (Math.random() - 0.5) * 6, 10, 90);
        carrier.intent = 'MAKE_RUN';
        carrier.intentTimer = 1.25;
        carrier.runToX = runDestX;
        carrier.runToY = runDestY;
        carrier.tx = runDestX;
        carrier.ty = runDestY;

        b.fromX = carrier.x;
        b.fromY = carrier.y;
        b.toX = partner.x;
        b.toY = partner.y;
        b.curve = 0;
        b.maxZ = 0;
        b.startZ = 0;
        b.endZ = 0;
        b.progress = 0;
        b.duration = (attCfg.tempo === 2 ? 0.28 : 0.34) / turfMatchMods.passPaceMult;
        b.flightType = 'onetwo';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = partner.id;
        b.lastPasserId = carrier.id;
        partner.tx = b.toX;
        partner.ty = b.toY;
        partner.intent = 'PASS_TARGET';
        bumpPlayerStat(carrier.id, 'crossAssists');
        bumpPlayerStat(carrier.id, 'keyPasses');
        addWorldFx(w, {
          type: 'onetwo',
          x: carrier.x,
          y: carrier.y,
          toX: partner.x,
          toY: partner.y,
          label: `⇄ ทำชิง 1-2! (${carrier.shortName}⇄${partner.shortName})`,
          color: '#34d399',
          ttl: 1.5,
          maxTtl: 1.5
        });
        w.phaseLabel = `⇄ ${carrier.shortName} ทำชิง 1-2 กับ ${partner.shortName}!`;
        w.phaseTone = 'attack';
        SFX.pass();
        return;
      }
    }

    // 5. Through-Ball onto an Off-Ball Run ("ทำทาง") with Real Offside Check!
    const forwardRunners = attPool
      .filter((a) => a.id !== carrier.id && (baseRoleOf(a.role) === 'ST' || a.role === 'CF' || a.role === 'LW' || a.role === 'RW' || a.intent === 'MAKE_RUN' || a.intent === 'OVERLAP'))
      .filter((a) => (attRight ? a.x > carrier.x - 4 : a.x < carrier.x + 4));

    const throughWeight = clamp(
      (attCfg.pass === 3 ? 0.45 : attCfg.pass === 2 ? 0.34 : attCfg.pass === 1 ? 0.28 : 0.20) +
        (agentHasTrait(carrier, 'killer_passer') ? 0.20 : 0) +
        (agentHasTrait(carrier, 'team_first') ? 0.06 : 0) +
        (attCfg.tempo === 2 ? 0.08 : attCfg.tempo === 0 ? -0.05 : 0) +
        (attCfg.tac === 'X' || attCfg.tac === 'A' ? 0.05 : 0),
      0.14,
      0.66
    );
    if (forwardRunners.length && (attRight ? carrier.x > 34 : carrier.x < 66) && Math.random() < throughWeight) {
      const sortedRunners = forwardRunners
        .slice()
        .sort((u, v) => {
          const uOffPen = checkPassOffside(w, side, carrier, u, defPool).isOffside ? -28 : 0;
          const vOffPen = checkPassOffside(w, side, carrier, v, defPool).isOffside ? -28 : 0;
          return (
            v.d.run + v.d.spd + (v.sig === 'run' ? 10 : 0) + (agentHasTrait(v, 'offside_trap_breaker') ? 16 : 0) + vOffPen -
            (u.d.run + u.d.spd + (u.sig === 'run' ? 10 : 0) + (agentHasTrait(u, 'offside_trap_breaker') ? 16 : 0) + uOffPen)
          );
        });
      const runner = sortedRunners.find((r) => !checkPassOffside(w, side, carrier, r, defPool).isOffside) || sortedRunners[0];
      const offChk = checkPassOffside(w, side, carrier, runner, defPool);

      if (offChk.isOffside) {
        triggerOffsideCall(w, curMin, side, carrier, runner, offChk.oppLineX, 'through', 'ยืนล้ำแนวรับจังหวะแทงทะลุช่อง');
        return;
      }

      const leadX = clamp(runner.x + dir * (7 + Math.random() * 5), 7, 93);
      const leadY = clamp(runner.y + (50 - runner.y) * 0.25, 10, 90);
      runner.tx = leadX;
      runner.ty = leadY;
      runner.intent = 'PASS_TARGET';
      const isLoftedThrough = Math.hypot(leadX - carrier.x, leadY - carrier.y) > 25 && (attCfg.pass >= 2 || carrier.sig === 'dist' || agentHasTrait(carrier, 'long_diagonal') || Math.random() < 0.42);
      b.fromX = carrier.x;
      b.fromY = carrier.y;
      b.toX = leadX;
      b.toY = leadY;
      b.curve = (Math.random() - 0.5) * 4.5;
      b.maxZ = isLoftedThrough ? 14.5 : 3.5;
      b.startZ = 0;
      b.endZ = 0;
      b.progress = 0;
      const passSkill = isLoftedThrough ? (carrier.d.lpass ?? 60) : (carrier.d.spass ?? 60);
      const passPaceFactor = clamp(1 - (passSkill - 60) * 0.0022, 0.88, 1.08);
      const throughRunDist = Math.hypot(leadX - runner.x, leadY - runner.y);
      const baseThroughDur = ((isLoftedThrough ? 0.62 : attCfg.tempo === 2 ? 0.40 : 0.48) * passPaceFactor) / (isLoftedThrough ? 1 : turfMatchMods.passPaceMult);
      b.duration = Math.max(baseThroughDur, clamp(throughRunDist / 26, baseThroughDur, 0.82));
      b.flightType = isLoftedThrough ? 'lofted' : 'through';
      b.shotStyle = undefined;
      b.carrierId = null;
      b.targetId = runner.id;
      b.lastPasserId = carrier.id;
      bumpPlayerStat(carrier.id, 'crossAssists');
      bumpPlayerStat(carrier.id, 'keyPasses');
      if (!isLoftedThrough) {
        addWorldFx(w, {
          type: 'through',
          x: carrier.x,
          y: carrier.y,
          toX: leadX,
          toY: leadY,
          label: `👟 แทงทะลุช่อง!`,
          color: '#facc15',
          ttl: 1.4,
          maxTtl: 1.4
        });
      }
      w.phaseLabel = isLoftedThrough
        ? `↗️ ${carrier.shortName}${agentHasTrait(carrier, 'long_diagonal') ? ' [วางบอลยาว]' : ''} ตักบอลโด่งข้ามไลน์ให้ ${runner.shortName}!`
        : `👟 ${carrier.shortName}${agentHasTrait(carrier, 'killer_passer') ? ' [คิลเลอร์พาส]' : ''} แทงทะลุช่องให้ ${runner.shortName}${agentHasTrait(runner, 'offside_trap_breaker') ? ' [ฉีกกับดักล้ำหน้า]' : ''}!`;
      w.phaseTone = 'attack';
      SFX.pass();
      return;
    }

    // 6. Dribble forward / cut inside (Fast Tempo passes instead of carrying; Own-box clears/passes instead of dribbling!)
    const carrierNormX = attRight ? carrier.x : 100 - carrier.x;
    const baseDrib = carrierNormX < 22 ? 0.06 : carrierNormX > 87 ? 0.15 : carrier.pos === 'FW' || carrier.role === 'CAM' || carrier.role === 'CF' ? 0.31 : 0.21;
    const tempoDribAdj = attCfg.tempo === 2 ? -0.10 : attCfg.tempo === 0 ? 0.07 : 0;
    const passDribAdj = attCfg.pass === 0 ? -0.05 : 0;
    const traitDribAdj = (agentHasTrait(carrier, 'flair_dribbler') ? 0.09 : 0) + (agentHasTrait(carrier, 'tempo_controller') ? -0.05 : 0) + ((carrier.blessedMins ?? 0) > 0 ? 0.14 : 0);
    const dribbleBias = clamp(baseDrib + tempoDribAdj + passDribAdj + traitDribAdj, 0.04, 0.56);
    if (carrier.pos !== 'GK' && Math.random() < dribbleBias) {
      const stepFwd = carrierNormX > 86 ? 1 + Math.random() * 2.8 : 6 + Math.random() * 7.5;
      const advX = clamp(carrier.x + dir * stepFwd, 7.5, 92.5);
      const advY = clamp(carrier.y + (50 - carrier.y) * (carrierNormX > 82 ? 0.34 : 0.22) + (Math.random() - 0.5) * 12, 8, 92);
      carrier.tx = advX;
      carrier.ty = advY;
      b.fromX = carrier.x;
      b.fromY = carrier.y;
      b.toX = advX;
      b.toY = advY;
      b.curve = 0;
      b.maxZ = 0;
      b.startZ = 0;
      b.endZ = 0;
      b.progress = 0;
      b.duration = attCfg.tempo === 2 ? 0.36 : attCfg.tempo === 0 ? 0.58 : 0.47;
      b.flightType = 'carry';
      b.shotStyle = undefined;
      b.carrierId = carrier.id;
      b.targetId = null;
      bumpPlayerStat(carrier.id, 'dribbles');
      w.phaseLabel = carrierNormX > 82 ? `⚡ ${carrier.shortName} แหวกตัดเข้ากลางหาจังหวะ` : `⚡ ${carrier.shortName} พาบอลลุยขึ้นหน้า`;
      w.phaseTone = attRight ? (carrier.x > 65 ? 'attack' : 'normal') : carrier.x < 35 ? 'attack' : 'normal';
      return;
    }

    // 7. Ground Pass / Cutback / Flair Pass / Lofted Diagonal Switch
    const passCandidates = attPool.filter((a) => a.id !== carrier.id && (a.pos !== 'GK' || (attRight ? carrier.x < 32 : carrier.x > 68)));
    if (passCandidates.length) {
      const nearByline = carrierNormX >= 83;
      const scored = passCandidates.map((cand) => {
        const dist = Math.hypot(cand.x - carrier.x, cand.y - carrier.y);
        const prog = (cand.x - carrier.x) * dir;
        const candNormX = attRight ? cand.x : 100 - cand.x;
        let wgt = 10;
        if (attCfg.pass === 0 || agentHasTrait(carrier, 'tempo_controller')) {
          wgt += dist < 22 ? 30 : -dist * 0.65;
          const candBase = baseRoleOf(cand.role);
          if (cand.role === 'CF' || candBase === 'CM' || cand.role === 'CAM' || candBase === 'CDM') wgt += 11;
        } else if (attCfg.pass === 2 || carrier.sig === 'dist' || agentHasTrait(carrier, 'long_diagonal') || agentHasTrait(carrier, 'ball_playing_cb')) {
          wgt += prog > 12 ? 28 : prog < 0 ? -6 : 2;
          if (Math.abs(cand.y - carrier.y) > 25) wgt += 16;
          if (cand.pos === 'FW') wgt += 12;
        } else if (attCfg.pass === 3) {
          wgt += prog > 10 ? 32 : -12;
          if (cand.pos === 'FW' || cand.role === 'LW' || cand.role === 'RW') wgt += 14;
        } else {
          wgt += prog > 0 ? 15 : 4;
          wgt -= Math.abs(dist - 20) * 0.4;
        }

        const candWide = cand.y < 24 || cand.y > 76;
        if (attCfg.wid === 2 && candWide) wgt += 14;
        if (attCfg.wid === 0 && !candWide) wgt += 12;

        if (attCfg.tempo === 0 && prog > -8 && prog <= 10) wgt += 10;
        if (attCfg.tempo === 2 && prog > 6) wgt += 10;

        if (nearByline && candNormX >= 72 && candNormX <= 85 && prog >= -16 && prog <= 2 && Math.abs(cand.y - 50) <= 26) {
          wgt += 24;
        }
        const blocked = defPool.some((d) => Math.hypot(d.x - cand.x, d.y - cand.y) < 4.5);
        if (blocked) wgt -= 12;
        if (checkPassOffside(w, side, carrier, cand, defPool).isOffside) wgt *= 0.02;
        return { cand, wgt: Math.max(0.2, wgt) };
      });
      const pool = scored.flatMap((s) => Array(Math.round(s.wgt)).fill(s.cand));
      const receiver = P(pool) || passCandidates[0];
      const dist = Math.hypot(receiver.x - carrier.x, receiver.y - carrier.y);
      const isLofted =
        (attCfg.pass !== 0 && dist > 26) ||
        ((attCfg.pass === 2 || carrier.sig === 'dist' || carrier.sig === 'crs' || agentHasTrait(carrier, 'long_diagonal') || agentHasTrait(carrier, 'ball_playing_cb')) && dist > 20 && Math.random() < (attCfg.pass === 2 ? 0.78 : 0.62));
      const passOffChk = checkPassOffside(w, side, carrier, receiver, defPool);
      if (passOffChk.isOffside) {
        triggerOffsideCall(w, curMin, side, carrier, receiver, passOffChk.oppLineX, isLofted ? 'lofted' : 'pass', 'ยืนอยู่ในตำแหน่งล้ำหน้าตอนเพื่อนส่งบอล');
        return;
      }
      const isTrivelaPass =
        !isLofted &&
        carrier.pos !== 'GK' &&
        dist >= 13 &&
        dist <= 35 &&
        (agentHasTrait(carrier, 'outside_curler') || carrier.sig === 'cur' || carrier.d.cur >= 64) &&
        Math.random() < (agentHasTrait(carrier, 'outside_curler') ? 0.42 : 0.22);
      const isFlairPass = !isLofted && !isTrivelaPass && carrierNormX > 26 && dist < 18 && carrier.pos !== 'GK' && (agentHasTrait(carrier, 'flair_dribbler') || carrier.d.cur >= 66 || carrier.sig === 'cur') && Math.random() < (agentHasTrait(carrier, 'flair_dribbler') ? 0.24 : 0.14);
      if (isFlairPass) {
        carrier.acrobatType = 'skill_pass';
        carrier.acrobatMax = 0.55;
        carrier.acrobatTimer = 0.55;
        carrier.skillSpinDir = Math.random() < 0.5 ? 1 : -1;
      }
      b.fromX = carrier.x;
      b.fromY = carrier.y;
      b.toX = clamp(receiver.x + dir * 2, 5, 95);
      b.toY = receiver.y;
      b.curve = isTrivelaPass
        ? (receiver.y >= carrier.y ? -1 : 1) * (6.2 + Math.random() * 3.4)
        : isLofted
          ? (Math.random() - 0.5) * 6
          : dist > 22
            ? (Math.random() - 0.5) * 3.5
            : 0;
      b.maxZ = isLofted ? clamp(13.5 + dist * 0.14, 14, 19.5) : isTrivelaPass ? 3.5 : 0;
      b.startZ = 0;
      b.endZ = 0;
      b.progress = 0;
      const basePassDur = isLofted ? clamp(dist / 44, 0.54, 0.82) : isTrivelaPass ? clamp(dist / 52, 0.36, 0.62) : clamp(dist / (attCfg.tempo === 2 ? 78 : attCfg.tempo === 0 ? 48 : 58), 0.26, 0.60);
      const passStat = isLofted ? (carrier.d.lpass ?? 60) : (carrier.d.spass ?? 60);
      b.duration = (basePassDur * clamp(1 - (passStat - 60) * 0.002, 0.88, 1.08)) / (isLofted ? 1 : turfMatchMods.passPaceMult);
      b.flightType = isLofted ? 'lofted' : isTrivelaPass ? 'trivela_pass' : 'pass';
      b.shotStyle = undefined;
      b.carrierId = null;
      b.targetId = receiver.id;
      b.lastPasserId = carrier.id;
      receiver.tx = b.toX;
      receiver.ty = b.toY;
      receiver.intent = 'PASS_TARGET';
      if (isTrivelaPass) {
        bumpPlayerStat(carrier.id, 'crossAssists');
        addWorldFx(w, {
          type: 'trivela',
          x: carrier.x,
          y: carrier.y,
          toX: b.toX,
          toY: b.toY,
          label: `🍌 ไซส์ก้อยโค้งๆ!`,
          color: '#fbbf24',
          ttl: 1.5,
          maxTtl: 1.5
        });
      }
      w.phaseLabel = isTrivelaPass
        ? `🍌 ${carrier.shortName} ดีดไซส์ก้อยโค้งๆ ให้ ${receiver.shortName}!`
        : isLofted
          ? `↗️ ${carrier.shortName}${agentHasTrait(carrier, 'long_diagonal') ? ' [เปิดทะแยงมุม]' : agentHasTrait(carrier, 'ball_playing_cb') ? ' [วางบอลจากแนวรับ]' : ''} เปิดบอลโด่งเปลี่ยนแกนให้ ${receiver.shortName}`
          : isFlairPass
            ? `✨ ${carrier.shortName} ตอกส้น/ไขว้หลังสุดพริ้วให้ ${receiver.shortName}`
            : attCfg.tempo === 0
              ? `🧭 ${carrier.shortName} ครองบอลเคาะคุมจังหวะให้ ${receiver.shortName}`
              : `⚽ ${carrier.shortName} เคาะบอลให้ ${receiver.shortName}`;
      w.phaseTone = isLofted || isFlairPass || isTrivelaPass ? 'attack' : 'normal';
      if (isLofted || isTrivelaPass) SFX.kick();
      else SFX.pass();
    }
  };

  const awardGoalToTeam = (
    w: LiveMatchWorld,
    side: 'H' | 'A',
    curMin: number,
    scorerName: string,
    scorerShort: string,
    assisterName: string,
    finishVerb: string,
    goalX: number,
    goalY: number,
    ogOpts?: { isOwnGoal?: boolean; culpritName?: string; culpritShort?: string; culpritTeam?: Team },
    varReplayId?: string
  ) => {
    const sr = simRef.current;
    const defSide = side === 'H' ? 'A' : 'H';
    const attTeam = side === 'H' ? homeOrig : awayOrig;
    const concTeam = defSide === 'H' ? homeOrig : awayOrig;
    const isOwnGoal = Boolean(ogOpts?.isOwnGoal);
    const ogCulpritName = ogOpts?.culpritName || scorerName;
    const ogCulpritShort = ogOpts?.culpritShort || scorerShort;
    const ogCulpritTeam = ogOpts?.culpritTeam || concTeam;

    if (side === 'H') {
      sr.gh++;
      if (!isSkippingRef.current) setGh(sr.gh);
    } else {
      sr.ga++;
      if (!isSkippingRef.current) setGa(sr.ga);
    }
    if (goalX > 50) w.goalNetRippleRight = 1.0;
    else w.goalNetRippleLeft = 1.0;
    const inferredStyle = isOwnGoal
      ? 'own_goal'
      : finishVerb.includes('ชนเสา')
        ? 'post_in'
        : finishVerb.includes('ชนคาน')
          ? 'bar_in'
          : finishVerb.includes('สามเหลี่ยม')
            ? 'top_corner'
            : finishVerb.includes('แสกหน้า')
              ? 'gk_face'
              : finishVerb.includes('ปัดไม่ออก')
                ? 'gk_fumble_in'
                : finishVerb.includes('แฉลบ')
                  ? 'deflected'
                  : finishVerb.includes('ปาเนนก้า')
                    ? 'panenka'
                    : finishVerb.includes('จุดโทษ')
                      ? 'penalty'
                      : finishVerb.includes('ฟรีคิก')
                        ? 'freekick'
                        : finishVerb.includes('ตีลังกา')
                          ? 'bicycle'
                          : finishVerb.includes('วอลเลย์')
                            ? 'volley'
                            : finishVerb.includes('โหม่ง')
                              ? 'header'
                              : finishVerb.includes('ชิพ')
                                ? 'chip'
                                : finishVerb.includes('ทริเวล่า')
                                  ? 'trivela'
                                  : finishVerb.includes('คนัคเคิล')
                                    ? 'knuckle'
                                    : finishVerb.includes('ปั่นโค้ง')
                                      ? 'curler'
                                      : undefined;
    const newEv: MatchEvent = isOwnGoal
      ? { m: curMin, t: attTeam.id, who: ogCulpritName, as: '', style: 'own_goal', og: true }
      : { m: curMin, t: attTeam.id, who: scorerName, as: assisterName, ...(inferredStyle ? { style: inferredStyle } : {}) };
    sr.evs.push(newEv);
    if (!isSkippingRef.current) setEvs(sr.evs.slice());

    if (isOwnGoal) {
      adjustLiveForm(ogCulpritName, -1.05);
    } else {
      adjustLiveForm(scorerName, 0.95);
      if (assisterName) adjustLiveForm(assisterName, 0.55);
    }
    const concLu = defSide === 'H' ? sr.homeLu : sr.awayLu;
    concLu.forEach((dn) => {
      if (sr.sentOff.includes(dn)) return;
      if (isOwnGoal && dn === ogCulpritName) return;
      const dPl = concTeam.sq.find((q) => q.n === dn);
      if (dPl?.pos === 'GK') adjustLiveForm(dn, -0.22);
      else if (dPl?.pos === 'DF') adjustLiveForm(dn, -0.12);
    });

    const isPenaltyGoal = !isOwnGoal && finishVerb.includes('จุดโทษ');
    if (isOwnGoal) {
      pushLog(
        curMin,
        `🤦 เข้าประตูตัวเอง!! ${ogCulpritName} (${ogCulpritTeam.name}) ${finishVerb} · ${attTeam.name} ได้ประตูส้มหล่น!`,
        'goal',
        varReplayId
      );
      pushTimeline(
        curMin,
        side,
        'own_goal',
        ogCulpritName,
        `เข้าประตูตัวเอง (${ogCulpritTeam.name})`,
        varReplayId
      );
      addWorldFx(w, {
        type: 'goal',
        x: goalX,
        y: goalY,
        label: `🤦 OG!! ${ogCulpritShort}`,
        color: '#fb7185',
        ttl: 3.4,
        maxTtl: 3.4,
        goalSide: side
      });
    } else {
      pushLog(
        curMin,
        `⚽ ประตู!! ${scorerName} (${attTeam.name}) ${finishVerb}${assisterName ? ` · 👟 ${assisterName}` : ''}`,
        'goal',
        varReplayId
      );
      const goalStyleTag =
        inferredStyle === 'post_in'
          ? 'ชนเสาเข้า'
          : inferredStyle === 'bar_in'
            ? 'ชนคานเข้า'
            : inferredStyle === 'top_corner'
              ? 'เข้าสามเหลี่ยม'
              : inferredStyle === 'gk_face'
                ? 'ยิงแสกหน้าโกล์'
                : inferredStyle === 'gk_fumble_in'
                  ? 'โกล์ปัดไม่ออก'
                  : inferredStyle === 'deflected'
                    ? 'ยิงแฉลบเข้า'
                    : '';
      const goalTlSub = isPenaltyGoal
        ? 'จุดโทษ'
        : [goalStyleTag, assisterName ? `👟 ${assisterName.split(' ')[0]}` : ''].filter(Boolean).join(' · ') || undefined;
      pushTimeline(
        curMin,
        side,
        isPenaltyGoal ? 'pen_goal' : 'goal',
        scorerName,
        goalTlSub,
        varReplayId
      );
      addWorldFx(w, {
        type: 'goal',
        x: goalX,
        y: goalY,
        label: `⚽ GOAL!! ${scorerShort}`,
        color: '#22c55e',
        ttl: 3.4,
        maxTtl: 3.4,
        goalSide: side
      });
    }
    const isMyTeamGoal = (side === 'H') === meIsHome;
    if (!isSkippingRef.current) {
      const nowSoundMs = Date.now();
      if (nowSoundMs - lastGoalSoundMsRef.current > 250) {
        lastGoalSoundMsRef.current = nowSoundMs;
        SFX.goal(!isOwnGoal && isMyTeamGoal);
        vibrate([50, 40, 80]);
      }
    }
    const isMeScorer = !isOwnGoal && isPlayerMode && scorerName === myPlayerName;
    const scoringKit = side === 'H' ? homeKit : awayKit;
    if (!isSkippingRef.current) {
      const sparkCols = isOwnGoal ? [scoringKit, '#fb7185', '#fde047', '#ffffff'] : [scoringKit, '#facc15', '#ffffff', '#4ade80'];
      for (let i = 0; i < 22; i++) {
        const ang = (Math.PI * 2 * i) / 22 + (Math.random() - 0.5) * 0.4;
        const spd = 8 + Math.random() * 18;
        w.sparkles.push({
          x: goalX,
          y: goalY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color: sparkCols[i % sparkCols.length],
          size: 1.8 + Math.random() * 2.2,
          ttl: 1.8 + Math.random() * 0.6,
          maxTtl: 2.4
        });
      }
      w.goalBanner = {
        scorer: isOwnGoal ? ogCulpritShort : scorerShort,
        teamName: attTeam.name,
        assister: isOwnGoal ? undefined : assisterName || undefined,
        side,
        kit: scoringKit,
        isMyGoal: isMyTeamGoal,
        isMeScorer,
        isOwnGoal,
        ttl: 4.2,
        maxTtl: 4.2
      };
      setGoalFlashInfo({
        side,
        scorer: isOwnGoal ? ogCulpritShort : scorerShort,
        assister: isOwnGoal ? undefined : assisterName || undefined,
        minute: curMin,
        isOwnGoal,
        isMyGoal: isMyTeamGoal,
        isMeScorer,
        kit: scoringKit,
        teamName: attTeam.name
      });
    }

    // Check Miracle Comeback progress & completion!
    const sideMaxDef = side === 'H' ? sr.maxDeficitH : sr.maxDeficitA;
    const sideLeadNow = side === 'H' ? sr.gh - sr.ga : sr.ga - sr.gh;
    if (w.miracle?.side === side && w.miracle.minsLeft > 0) {
      w.miracle.goalsDuring++;
      if (sideLeadNow <= 0) {
        // Momentum extension: every comeback goal fuels the surge longer so it never fizzles mid-rally!
        w.miracle.minsLeft = Math.min(42, w.miracle.minsLeft + 4);
      }
    }
    if (sideMaxDef >= 2) {
      if (sideLeadNow === 0) {
        pushLog(curMin, `🔥⚡ เหลือเชื่อ!! ${attTeam.name} ไล่ตีเสมอได้สำเร็จหลังเคยตามหลังถึง ${sideMaxDef} ประตู!!`, 'goal');
        triggerDramaSlow(w, 1.8, `🔥 ตีเสมอปาฏิหาริย์!! ${attTeam.name}`);
        if (!isSkippingRef.current) SFX.cheer(0.95);
      } else if (sideLeadNow > 0 && !sr.miracleCelebrated) {
        sr.miracleCelebrated = true;
        pushLog(curMin, `🏆🌋 ปาฏิหาริย์พลิกนรกสำเร็จ!! ${attTeam.name} โดนนำห่าง ${sideMaxDef} ลูก แต่กลับมาพลิกแซงขึ้นนำอย่างเหลือเชื่อ!!`, 'goal');
        pushTimeline(curMin, side, 'miracle', attTeam.name, `พลิกแซงจากตาม ${sideMaxDef} ลูก!`);
        triggerDramaSlow(w, 2.2, `🏆 ปาฏิหาริย์พลิกนรก!! ${attTeam.name}`);
        if (!isSkippingRef.current) {
          SFX.cheer(1.0);
          if (isMyTeamGoal) triggerConfetti();
        }
      }
    }
    if (!isSkippingRef.current) {
      if (goalFlashTimerRef.current) window.clearTimeout(goalFlashTimerRef.current);
      goalFlashTimerRef.current = window.setTimeout(() => setGoalFlashInfo(null), 3400);
      if (isMeScorer) {
        triggerConfetti();
      }
    }
    const attRight = isAttackRight(w, side);
    const scorerAg = !isOwnGoal ? w.agents.find((a) => !a.sentOff && a.side === side && a.id === scorerName) : undefined;
    const assisterAg = !isOwnGoal && assisterName ? w.agents.find((a) => !a.sentOff && a.side === side && a.id === assisterName) : undefined;
    const pickedCeleb = pickGoalCelebrationStyle(
      w,
      side,
      scorerAg,
      isOwnGoal,
      isMyTeamGoal,
      isMeScorer,
      curMin,
      sr.gh,
      sr.ga,
      Boolean(assisterAg),
      finishVerb
    );
    if (!isSkippingRef.current) {
      const celebDuration = isOwnGoal ? 1.45 : pickedCeleb.style === 'group_huddle' ? 2.55 : 2.35;
      const anchorX = clamp(
        pickedCeleb.style === 'calm_shush'
          ? attRight ? 83 : 17
          : pickedCeleb.style === 'bow_crowd'
            ? clamp((scorerAg?.x ?? goalX) * 0.4 + (attRight ? 82 : 18) * 0.6, 16, 84)
            : attRight ? 90.5 : 9.5,
        8,
        92
      );
      const preferTop = (scorerAg?.y ?? goalY) < 50;
      const anchorY = clamp(
        pickedCeleb.style === 'bow_crowd'
          ? preferTop ? 10.5 : 89.5
          : pickedCeleb.style === 'calm_shush'
            ? clamp(goalY, 26, 74)
            : pickedCeleb.style === 'group_huddle'
              ? preferTop ? 22 : 78
              : preferTop ? 12.5 : 87.5,
        8.5,
        91.5
      );
      w.lastCelebrationStyle = pickedCeleb.style;
      w.kickoffReturnElapsed = 0;
      w.celebrateTimer = celebDuration;
      w.celebration = {
        style: pickedCeleb.style,
        side,
        scorerId: isOwnGoal ? ogCulpritName : scorerName,
        assisterId: assisterAg?.id,
        anchorX,
        anchorY,
        duration: celebDuration,
        elapsed: 0,
        isOwnGoal,
        label: pickedCeleb.label
      };
      triggerCoachShout(w, side, '🔥 เยี่ยมมาก!', 2.8);
      triggerCoachShout(w, side === 'H' ? 'A' : 'H', '📣 ตั้งสติ! คุมเกม!', 2.6);
    }
    w.ball.carrierId = null;
    w.ball.targetId = null;
    w.ball.lastPasserId = null;
    w.ball.trail = [];
    if (!isSkippingRef.current) {
      triggerDramaSlow(
        w,
        Math.min(2.1, 2.35 * 0.85),
        isOwnGoal ? `🤦 เข้าประตูตัวเอง!! ${ogCulpritShort}` : `⚽ GOAL!! ${scorerShort} · ${pickedCeleb.label}`
      );
    }
    w.pendingSetPiece = { type: 'kickoff', side: defSide, x: 50, y: 50, waitSec: 0.42 };
    w.phaseLabel = isOwnGoal
      ? `🤦 เข้าประตูตัวเอง!! ${ogCulpritName} (${ogCulpritTeam.name})!`
      : `⚽ ประตู!! ${scorerName} (${attTeam.name}) · ${pickedCeleb.label}`;
    w.phaseTone = 'goal';

    // Record Match Highlight Clip (live post-event capture or instant skip synthesis)
    const preOverride = varBuildupSamplesRef.current;
    varBuildupSamplesRef.current = null;
    const scoreBeforeStr = side === 'H' ? `${Math.max(0, sr.gh - 1)}-${sr.ga}` : `${sr.gh}-${Math.max(0, sr.ga - 1)}`;
    const scoreAfterStr = `${sr.gh}-${sr.ga}`;
    sr.highlightSeq += 1;
    const hlId = `hl-${sr.highlightSeq}-${curMin}`;

    if (isSkippingRef.current) {
      const hCfgSkip = getEffectiveTeamCfg('H', curMin);
      const aCfgSkip = getEffectiveTeamCfg('A', curMin);
      const telSkip = lastShotTelemetryRef.current;
      const defGkSkip = w.agents.find((a) => !a.sentOff && a.side === defSide && a.pos === 'GK');
      const synth = simulateRealtimeHighlightClip({
        id: hlId,
        seq: sr.highlightSeq,
        minute: curMin,
        side,
        attRight,
        secondHalf: w.secondHalf,
        homeTeam: homeOrig,
        awayTeam: awayOrig,
        homeLu: sr.homeLu,
        awayLu: sr.awayLu,
        homeTactics: { tac: hCfgSkip.tac, press: hCfgSkip.press, pass: hCfgSkip.pass, tempo: hCfgSkip.tempo, width: hCfgSkip.wid },
        awayTactics: { tac: aCfgSkip.tac, press: aCfgSkip.press, pass: aCfgSkip.pass, tempo: aCfgSkip.tempo, width: aCfgSkip.wid },
        scorerName: isOwnGoal ? ogCulpritName : scorerName,
        assisterName: isOwnGoal ? undefined : assisterName || undefined,
        victimName: defGkSkip?.id,
        finishVerb,
        shotStyle: telSkip?.style || inferredStyle,
        shotDistM: telSkip?.distM,
        shotSpeedKmh: telSkip?.speedKmh,
        isOwnGoal,
        celebratePose: pickedCeleb.style,
        scoreBefore: scoreBeforeStr,
        scoreAfter: scoreAfterStr,
        scoreAfterGh: sr.gh,
        scoreAfterGa: sr.ga,
        isDerby,
        careerP: state.p,
        matchEnv
      });
      sr.highlightClips.push(synth);
    } else {
      const tel = lastShotTelemetryRef.current;
      const hlKind = detectGoalHighlightKind({
        finishVerb,
        shotStyle: tel?.style || inferredStyle,
        flightType: tel?.flightType,
        isOwnGoal,
        shotDistM: tel?.distM
      });
      const defGkAgent = w.agents.find((a) => !a.sentOff && a.side === defSide && a.pos === 'GK');
      const actorFullName = isOwnGoal ? ogCulpritName : scorerName;
      const ed = buildHighlightEditorial({
        kind: hlKind,
        minute: curMin,
        teamName: attTeam.name,
        oppTeamName: concTeam.name,
        actorName: actorFullName,
        assisterName: isOwnGoal ? undefined : assisterName || undefined,
        victimName: defGkAgent?.id,
        finishVerb,
        shotDistM: tel?.distM,
        shotSpeedKmh: tel?.speedKmh,
        scoreAfterGh: sr.gh,
        scoreAfterGa: sr.ga,
        side,
        isDerby
      });
      queueHighlightCapture(
        w,
        {
          id: hlId,
          seq: sr.highlightSeq,
          minute: curMin,
          kind: hlKind,
          side,
          attRight,
          title: ed.title,
          subtitle: ed.subtitle,
          crewTag: ed.crewTag,
          commentary: ed.commentary,
          actorName: actorFullName,
          assisterName: isOwnGoal ? undefined : assisterName || undefined,
          victimName: defGkAgent?.id,
          scoreBefore: scoreBeforeStr,
          scoreAfter: scoreAfterStr,
          dramaScore: ed.dramaScore,
          shotDistM: tel?.distM,
          shotSpeedKmh: tel?.speedKmh,
          secondHalf: w.secondHalf,
          celebratePose: pickedCeleb.style,
          matchEnv
        },
        preOverride || undefined
      );
    }
  };

  const buildVarRecord = (
    vr: VarReviewState,
    curMin: number,
    id: string,
    verdictShort: string,
    verdictLabel: string,
    verdictTone: VarReplayRecord['verdictTone']
  ): VarReplayRecord => {
    const attTeam = vr.side === 'H' ? homeOrig : awayOrig;
    const defTeam = vr.side === 'H' ? awayOrig : homeOrig;
    return {
      id,
      minute: curMin,
      kind: vr.kind,
      side: vr.side,
      attackTeamName: attTeam.name,
      defendTeamName: defTeam.name,
      verdictShort,
      verdictLabel,
      verdictTone,
      varState: {
        ...vr,
        waitSec: 0,
        replay: vr.replay ? { ...vr.replay } : undefined
      }
    };
  };

  const openVarReplayById = useCallback((varId: string) => {
    const found = simRef.current.varHistory.find((r) => r.id === varId) || varHistoryRef.current.find((r) => r.id === varId);
    if (!found) return;
    SFX.tap();
    wasPausedBeforeVarRef.current = pausedRef.current;
    if (!doneRef.current && matchPhaseUiRef.current !== 'halftime') setPaused(true);
    setVarReplayModalState({ record: found, liveMode: false });
  }, []);

  const openLiveVarReplay = useCallback(() => {
    const vr = worldRef.current?.varReview;
    if (!vr) return;
    SFX.tap();
    const curMin = Math.max(1, Math.floor(worldRef.current?.minuteFloat ?? minuteRef.current));
    const previewRec = buildVarRecord(
      vr,
      curMin,
      `live-var-${curMin}-${Date.now()}`,
      vr.kind === 'goal'
        ? vr.overturn
          ? '❌ ริบประตู'
          : '✅ ให้ประตู'
        : vr.kind === 'penalty'
          ? vr.overturn
            ? '🟡 นอกเขต'
            : '🚨 จุดโทษ!'
          : vr.pendingCardUpgrade === 'R'
            ? '🟥 ใบแดง!'
            : '🟨 ใบเหลือง',
      'กำลังตรวจ VAR',
      vr.kind === 'goal'
        ? vr.overturn
          ? 'no_goal'
          : 'goal'
        : vr.kind === 'penalty'
          ? vr.overturn
            ? 'freekick'
            : 'penalty'
          : vr.pendingCardUpgrade === 'R'
            ? 'red'
            : 'yellow'
    );
    wasPausedBeforeVarRef.current = pausedRef.current;
    if (!doneRef.current && matchPhaseUiRef.current !== 'halftime') setPaused(true);
    setVarReplayModalState({ record: previewRec, liveMode: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeVarReplayModal = useCallback(() => {
    setVarReplayModalState(null);
    if (!doneRef.current && matchPhaseUiRef.current !== 'halftime' && !wasPausedBeforeVarRef.current) {
      setPaused(false);
    }
  }, []);

  const openHighlightsModal = useCallback((clipId?: string) => {
    const list = simRef.current.highlightClips.length ? curateMatchHighlights(simRef.current.highlightClips) : highlightClipsRef.current;
    if (!list.length) return;
    SFX.tap();
    setHighlightClips(list);
    setHighlightInitialId(clipId);
    setHighlightModalOpen(true);
  }, []);

  const queueHighlightCapture = (
    w: LiveMatchWorld,
    meta: Omit<FinalizeClipParams, 'preSamples' | 'postSamples'>,
    preOverride?: RollingHighlightSample[]
  ) => {
    const basePre = (preOverride && preOverride.length ? preOverride : rollingSamplesRef.current).slice(-26);
    const lastPreTs = basePre.length ? basePre[basePre.length - 1].ts : highlightClockRef.current;
    const climaxTs = preOverride && preOverride.length ? lastPreTs + 0.08 : highlightClockRef.current;
    if (preOverride && preOverride.length) {
      highlightClockRef.current = climaxTs;
      lastHighlightSampleClockRef.current = climaxTs;
    }
    const keepIds = new Set<string>(activePostCapturesRef.current.map((e) => e.meta.actorName));
    keepIds.add(meta.actorName);
    const climaxNow = captureWorldSample(w, climaxTs, keepIds);
    const preSamples = [...basePre, climaxNow];
    activePostCapturesRef.current.push({
      remainingSamples: meta.kind.startsWith('goal_') ? 13 : meta.kind === 'shootout_kick' ? 6 : 8,
      postSamples: [],
      preSamples,
      meta
    });
  };

  const flushHighlightCaptures = (w?: LiveMatchWorld | null) => {
    if (!activePostCapturesRef.current.length) return;
    const keepIds = new Set<string>(activePostCapturesRef.current.map((e) => e.meta.actorName));
    const extraSample = w ? captureWorldSample(w, highlightClockRef.current + 0.14, keepIds) : null;
    const pending = activePostCapturesRef.current.splice(0);
    pending.forEach((entry) => {
      const postSamples = extraSample ? [...entry.postSamples, extraSample] : [...entry.postSamples];
      if (entry.meta.kind === 'shootout_kick' && postSamples.length < 3) {
        const tailBase = postSamples[postSamples.length - 1] || entry.preSamples[entry.preSamples.length - 1];
        if (tailBase) {
          postSamples.push({ ...tailBase, ts: tailBase.ts + 0.18 });
          postSamples.push({ ...tailBase, ts: tailBase.ts + 0.36 });
        }
      }
      const clip = finalizeHighlightClipFromSamples({
        ...entry.meta,
        preSamples: entry.preSamples,
        postSamples
      });
      simRef.current.highlightClips.push(clip);
    });
  };

  const recordEventHighlight = (
    w: LiveMatchWorld,
    curMin: number,
    opts: {
      kind: MatchHighlightKind;
      side: 'H' | 'A';
      attRight: boolean;
      actorName: string;
      victimName?: string;
      finishVerb: string;
      shotStyle?: string;
      shotDistM?: number;
      shotSpeedKmh?: number;
      dramaFloor?: number;
      cardType?: 'R' | 'Y2R';
      varVerdict?: 'no_goal' | 'no_pen' | 'pen' | 'red';
      varReasonText?: string;
      shootoutScored?: boolean;
      shootoutOutcome?: 'goal' | 'save' | 'woodwork' | 'miss';
      shootoutRound?: number;
      shootoutDecisive?: boolean;
      shootoutScoreText?: string;
      injuryGames?: number;
      preOverride?: RollingHighlightSample[] | null;
    }
  ) => {
    const sr = simRef.current;
    const nonGoalCount = sr.highlightClips.filter((c) => !c.kind.startsWith('goal_')).length;
    const skipMustKeep = opts.kind === 'red_card' || (opts.kind === 'shootout_kick' && opts.shootoutDecisive);
    if (isSkippingRef.current && !skipMustKeep && nonGoalCount >= 5) return;

    sr.highlightSeq += 1;
    const hlId = `hl-${sr.highlightSeq}-${curMin}`;
    const actorTeam = opts.side === 'H' ? homeOrig : awayOrig;
    const oppTeam = opts.side === 'H' ? awayOrig : homeOrig;
    const scoreStr = `${sr.gh}-${sr.ga}`;

    if (isSkippingRef.current) {
      const hCfgSkip = getEffectiveTeamCfg('H', curMin);
      const aCfgSkip = getEffectiveTeamCfg('A', curMin);
      sr.highlightClips.push(
        simulateRealtimeHighlightClip({
          id: hlId,
          seq: sr.highlightSeq,
          minute: curMin,
          kind: opts.kind,
          side: opts.side,
          attRight: opts.attRight,
          secondHalf: w.secondHalf,
          homeTeam: homeOrig,
          awayTeam: awayOrig,
          homeLu: sr.homeLu,
          awayLu: sr.awayLu,
          homeTactics: { tac: hCfgSkip.tac, press: hCfgSkip.press, pass: hCfgSkip.pass, tempo: hCfgSkip.tempo, width: hCfgSkip.wid },
          awayTactics: { tac: aCfgSkip.tac, press: aCfgSkip.press, pass: aCfgSkip.pass, tempo: aCfgSkip.tempo, width: aCfgSkip.wid },
          scorerName: opts.actorName,
          victimName: opts.victimName,
          finishVerb: opts.finishVerb,
          shotStyle: opts.shotStyle,
          shotDistM: opts.shotDistM,
          shotSpeedKmh: opts.shotSpeedKmh,
          cardType: opts.cardType,
          varVerdict: opts.varVerdict,
          varReasonText: opts.varReasonText,
          shootoutScored: opts.shootoutScored,
          shootoutOutcome: opts.shootoutOutcome,
          shootoutRound: opts.shootoutRound,
          shootoutDecisive: opts.shootoutDecisive,
          shootoutScoreText: opts.shootoutScoreText,
          injuryGames: opts.injuryGames,
          scoreBefore: scoreStr,
          scoreAfter: scoreStr,
          scoreAfterGh: sr.gh,
          scoreAfterGa: sr.ga,
          isDerby,
          careerP: state.p,
          matchEnv
        })
      );
    } else {
      const ed = buildHighlightEditorial({
        kind: opts.kind,
        minute: curMin,
        teamName: actorTeam.name,
        oppTeamName: oppTeam.name,
        actorName: opts.actorName,
        victimName: opts.victimName,
        finishVerb: opts.finishVerb,
        shotDistM: opts.shotDistM,
        shotSpeedKmh: opts.shotSpeedKmh,
        scoreAfterGh: sr.gh,
        scoreAfterGa: sr.ga,
        side: opts.side,
        isDerby,
        cardType: opts.cardType,
        varVerdict: opts.varVerdict,
        varReasonText: opts.varReasonText,
        shootoutScored: opts.shootoutScored,
        shootoutOutcome: opts.shootoutOutcome,
        shootoutRound: opts.shootoutRound,
        shootoutDecisive: opts.shootoutDecisive,
        shootoutScoreText: opts.shootoutScoreText,
        injuryGames: opts.injuryGames
      });
      queueHighlightCapture(
        w,
        {
          id: hlId,
          seq: sr.highlightSeq,
          minute: curMin,
          kind: opts.kind,
          side: opts.side,
          attRight: opts.attRight,
          title: ed.title,
          subtitle: ed.subtitle,
          crewTag: ed.crewTag,
          commentary: ed.commentary,
          actorName: opts.actorName,
          victimName: opts.victimName,
          scoreBefore: scoreStr,
          scoreAfter: scoreStr,
          dramaScore: opts.dramaFloor ? Math.max(ed.dramaScore, opts.dramaFloor) : ed.dramaScore,
          shotDistM: opts.shotDistM,
          shotSpeedKmh: opts.shotSpeedKmh,
          secondHalf: w.secondHalf,
          cardType: opts.cardType,
          varVerdict: opts.varVerdict,
          varReasonText: opts.varReasonText,
          shootoutScored: opts.shootoutScored,
          shootoutOutcome: opts.shootoutOutcome,
          shootoutRound: opts.shootoutRound,
          shootoutDecisive: opts.shootoutDecisive,
          shootoutScoreText: opts.shootoutScoreText,
          injuryGames: opts.injuryGames,
          matchEnv
        },
        opts.preOverride || undefined
      );
    }
  };

  const resolveVarReview = (w: LiveMatchWorld, curMin: number) => {
    const vr = w.varReview;
    if (!vr) return;
    w.varReview = null;
    if (lastLiveVarActiveRef.current) {
      lastLiveVarActiveRef.current = false;
      if (!isSkippingRef.current) setLiveVarActive(false);
    }
    const sr = simRef.current;
    sr.varSeq += 1;
    const varId = `var-${sr.varSeq}-${curMin}`;
    const preVarSamples = varBuildupSamplesRef.current;
    const recordVar = (
      verdictShort: string,
      verdictLabel: string,
      verdictTone: VarReplayRecord['verdictTone']
    ) => {
      const rec = buildVarRecord(vr, curMin, varId, verdictShort, verdictLabel, verdictTone);
      sr.varHistory.push(rec);
      if (!isSkippingRef.current) setVarHistory(sr.varHistory.slice());
    };

    const attTeam = vr.side === 'H' ? homeOrig : awayOrig;
    const defSide = vr.side === 'H' ? 'A' : 'H';

    const sc = vr.replay?.scenario;
    if (vr.kind === 'goal') {
      if (vr.overturn) {
        varBuildupSamplesRef.current = null;
        // Disallowed by VAR!
        const overturnShort =
          sc === 'goal_line_tech'
            ? '❌ ไม่ข้ามเส้น'
            : sc === 'foul_buildup'
              ? '❌ ฟาวล์ก่อนยิง'
              : '❌ ริบประตู';
        const overturnDetail =
          sc === 'goal_line_tech'
            ? 'โกล์ไลน์ชี้บอลยังไม่ข้ามเส้น'
            : sc === 'foul_buildup'
              ? 'VAR ริบประตู (ฟาวล์ก่อนยิง)'
              : 'VAR ริบประตู (ล้ำหน้า)';
        recordVar(overturnShort, `❌ ${overturnDetail}`, 'no_goal');
        SFX.foul();
        SFX.boo(0.92);
        if (sc === 'offside_line' || !sc) {
          if (vr.side === 'H') w.offsidesH++;
          else w.offsidesA++;
        }
        const offX = clamp(vr.replay?.incidentX ?? vr.replay?.defLineX ?? (isAttackRight(w, vr.side) ? 84 : 16), 8, 92);
        addWorldFx(w, {
          type: 'offside',
          x: offX,
          y: vr.y,
          offsideX: offX,
          label: sc === 'goal_line_tech' ? '🖥❌ บอลไม่ข้ามเส้น!' : sc === 'foul_buildup' ? '🖥❌ ฟาวล์ก่อนยิง!' : '🖥❌ VAR ริบประตู!',
          color: '#ef4444',
          ttl: 3.4,
          maxTtl: 3.4
        });
        triggerDramaSlow(w, 2.2, sc === 'goal_line_tech' ? '🖥❌ ยังไม่ข้ามเส้น!' : '🖥❌ VAR ริบประตู!');
        w.pendingSetPiece = { type: sc === 'goal_line_tech' ? 'goalkick' : sc === 'foul_buildup' ? 'freekick' : 'offside', side: defSide, x: offX, y: 50, waitSec: 2.1 };
        w.phaseLabel =
          sc === 'goal_line_tech'
            ? `🖥❌ โกล์ไลน์ชี้บอลยังไม่ข้ามเส้นเต็มใบ!`
            : `🖥❌ VAR ริบประตูของ ${vr.shooterShort || attTeam.name}!`;
        w.phaseTone = 'offside';
        const overturnLog =
          sc === 'goal_line_tech'
            ? `🖥❌ โกล์ไลน์!! บอลยังไม่ข้ามเส้นประตูเต็มใบของ ${vr.shooterId || attTeam.name} สกอร์ยังคงเดิม`
            : sc === 'foul_buildup'
              ? `🖥❌ VAR ริบประตู!! พบจังหวะฟาวล์ก่อนทำประตูของ ${vr.shooterId || attTeam.name} สกอร์ยังคงเดิม`
              : `🖥❌ VAR ริบประตู!! พบจังหวะล้ำหน้าก่อนยิงของ ${vr.shooterId || attTeam.name} สกอร์ยังคงเดิม`;
        pushLog(curMin, overturnLog, 'card', varId);
        pushTimeline(curMin, vr.side, 'var_no_goal', vr.shooterId || attTeam.name, overturnDetail, varId);
        recordEventHighlight(w, curMin, {
          kind: 'var_overturn',
          side: vr.side,
          attRight: isAttackRight(w, vr.side),
          actorName: vr.shooterId || vr.replay?.attId || attTeam.name,
          victimName: vr.replay?.defId,
          finishVerb: overturnDetail,
          varVerdict: 'no_goal',
          varReasonText: overturnDetail,
          dramaFloor: 93,
          preOverride: preVarSamples
        });
      } else {
        // Goal stands!
        const confirmShort = sc === 'goal_line_tech' ? '✅ ข้ามเส้น!' : '✅ ให้ประตู';
        const confirmLabel =
          sc === 'goal_line_tech'
            ? '✅ โกล์ไลน์ยืนยันบอลข้ามเส้น'
            : sc === 'foul_buildup'
              ? '✅ VAR ยืนยันปะทะปกติ ให้ประตู'
              : '✅ VAR ยืนยันให้ประตู';
        recordVar(confirmShort, confirmLabel, 'goal');
        addWorldFx(w, {
          type: 'var',
          x: 50,
          y: 22,
          label: sc === 'goal_line_tech' ? '🖥✅ ข้ามเส้นเต็มใบ! ประตู!' : '🖥✅ VAR ยืนยันให้ประตู!',
          color: '#22c55e',
          ttl: 3.0,
          maxTtl: 3.0
        });
        const confirmLog =
          sc === 'goal_line_tech'
            ? `🖥✅ โกล์ไลน์ยืนยัน: บอลข้ามเส้นเต็มใบแล้ว — ให้เป็นประตูของ ${attTeam.name}!`
            : sc === 'foul_buildup'
              ? `🖥✅ VAR ยืนยัน: ปะทะปกติก่อนยิง — ให้เป็นประตูของ ${attTeam.name}!`
              : `🖥✅ VAR ยืนยัน: ไม่มีการล้ำหน้า — ให้เป็นประตูของ ${attTeam.name}!`;
        pushLog(curMin, confirmLog, 'goal', varId);
        awardGoalToTeam(
          w,
          vr.side,
          curMin,
          vr.shooterId || 'นักเตะ',
          vr.shooterShort || 'นักเตะ',
          vr.assisterName || '',
          vr.finishVerb || 'ส่งบอลตุงตาข่าย!',
          vr.x,
          vr.y,
          undefined,
          varId
        );
      }
      return;
    }

    // Foul / Red Card VAR Check
    varBuildupSamplesRef.current = null;
    if (vr.kind === 'foul_card') {
      const defTeam = vr.culpritSide === 'H' ? homeOrig : awayOrig;
      const culprit = vr.culpritId ? w.agents.find((a) => a.id === vr.culpritId && !a.sentOff) : undefined;
      if (vr.side === 'H') w.freeKicksH++;
      else w.freeKicksA++;
      const dGoal = vr.distToGoal ?? 28;
      const wallCount = dGoal < 36 ? 3 : 0;
      const wallPlayers: { x: number; y: number }[] = [];
      if (wallCount > 0) {
        const gX = isAttackRight(w, vr.side) ? 100 : 0;
        const ang = Math.atan2(50 - vr.y, gX - vr.x);
        const wx = clamp(vr.x + Math.cos(ang) * 9.5, 5, 95);
        const wy = clamp(vr.y + Math.sin(ang) * 9.5, 10, 90);
        for (let k = 0; k < wallCount; k++) {
          const off = (k - (wallCount - 1) / 2) * 2.3;
          wallPlayers.push({ x: wx - Math.sin(ang) * off, y: wy + Math.cos(ang) * off });
        }
      }
      if (vr.pendingCardUpgrade === 'R' && culprit) {
        recordVar('🟥 ใบแดง!', `🟥 VAR ยกระดับเป็นใบแดง (${vr.culpritShort || ''})`, 'red');
        SFX.whistle();
        SFX.boo(0.9);
        issueCard(culprit, curMin, 1, 'R', true, undefined, varId, {
          victimName: vr.replay?.attId,
          varVerdict: 'red',
          varReasonText: vr.reasonText,
          preOverride: preVarSamples
        });
        addWorldFx(w, {
          type: 'foul',
          x: vr.x,
          y: vr.y,
          label: `🖥🟥 VAR ใบแดง! ${vr.culpritShort || ''}`,
          color: '#ef4444',
          ttl: 3.4,
          maxTtl: 3.4,
          wallPlayers
        });
        triggerDramaSlow(w, 2.5, `🖥🟥 VAR ใบแดง!! ${vr.culpritShort || ''}`);
        w.phaseLabel = `🖥🟥 VAR ยกระดับเป็นใบแดง! ${vr.culpritShort || ''} โดนไล่ออก`;
        w.phaseTone = 'danger';
        pushLog(curMin, `🖥🟥 VAR ยกระดับเป็นใบแดงโดยตรง!! ${culprit.id} (${defTeam.name}) เสียบสกัดอันตราย โดนไล่ออก!`, 'card', varId);
      } else {
        SFX.foul();
        SFX.boo(0.75);
        const issued = culprit
          ? issueCard(culprit, curMin, 0, 'Y', true, undefined, varId, {
              victimName: vr.replay?.attId,
              varVerdict: 'red',
              varReasonText: vr.reasonText,
              preOverride: preVarSamples
            })
          : 'Y';
        const isSecondRed = issued === 'Y2R' || issued === 'R';
        recordVar(
          isSecondRed ? '🟨➡🟥 เหลืองแดง' : '🟨 ใบเหลือง',
          isSecondRed ? `🟨➡🟥 VAR เหลืองที่สองไล่ออก (${vr.culpritShort || ''})` : `🟨 VAR ให้ใบเหลือง (${vr.culpritShort || ''})`,
          isSecondRed ? 'red' : 'yellow'
        );
        addWorldFx(w, {
          type: 'foul',
          x: vr.x,
          y: vr.y,
          label: isSecondRed ? `🖥🟨➡🟥 เหลืองแดง! ${vr.culpritShort || ''}` : `🖥🟨 VAR ใบเหลือง ${vr.culpritShort || ''}`,
          color: isSecondRed ? '#ef4444' : '#facc15',
          ttl: 3.0,
          maxTtl: 3.0,
          wallPlayers
        });
        triggerDramaSlow(w, isSecondRed ? 2.4 : 1.7, isSecondRed ? `🖥🟨➡🟥 เหลืองแดง!!` : `🖥🟨 VAR ใบเหลือง`);
        w.phaseLabel = isSecondRed
          ? `🖥🟨➡🟥 VAR เหลืองที่สอง! ${vr.culpritShort || ''} โดนไล่ออก`
          : `🖥🟨 VAR ให้ใบเหลือง ${vr.culpritShort || ''} · ฟรีคิก`;
        w.phaseTone = isSecondRed ? 'danger' : 'setpiece';
        pushLog(
          curMin,
          isSecondRed
            ? `🖥🟨➡🟥 VAR ให้ใบเหลืองที่สองไล่ออก ${vr.culpritId || ''} (${defTeam.name})!`
            : `🖥🟨 VAR ให้ใบเหลืองแก่ ${vr.culpritId || ''} (${defTeam.name}) รอดพ้นใบแดงหวุดหวิด`,
          'card',
          varId
        );
      }
      w.pendingSetPiece = {
        type: 'freekick',
        side: vr.side,
        x: vr.x,
        y: vr.y,
        waitSec: wallCount > 0 ? 1.8 : 1.4,
        wallPlayers
      };
      return;
    }

    // Penalty VAR Check (+ Card Verdict!)
    const culprit = vr.culpritId ? w.agents.find((a) => a.id === vr.culpritId && !a.sentOff) : undefined;
    const penRightVar = isAttackRight(w, vr.side);
    if (vr.overturn) {
      SFX.var();
      if (vr.side === 'H') w.freeKicksH++;
      else w.freeKicksA++;
      const edgeX = penRightVar ? 81.8 : 18.2;
      const edgeGoalX = penRightVar ? 100 : 0;
      const edgeAng = Math.atan2(50 - vr.y, edgeGoalX - edgeX);
      const edgeWall: { x: number; y: number }[] = [];
      const edgeWx = clamp(edgeX + Math.cos(edgeAng) * 9.5, 5, 95);
      const edgeWy = clamp(vr.y + Math.sin(edgeAng) * 9.5, 10, 90);
      for (let k = 0; k < 4; k++) {
        const off = (k - 1.5) * 2.3;
        edgeWall.push({ x: edgeWx - Math.sin(edgeAng) * off, y: edgeWy + Math.cos(edgeAng) * off });
      }
      let fkCardTxt = '';
      if (culprit && Math.random() < 0.28 && simRef.current.cards.length < 5) {
        const res = issueCard(culprit, curMin, 0, 'Y', true, undefined, varId, {
          victimName: vr.replay?.attId,
          preOverride: preVarSamples
        });
        fkCardTxt = res === 'Y' ? ' + 🟨 ใบเหลือง' : ' + 🟥 ใบแดง';
      }
      recordVar(
        sc === 'handball_box' ? '🟡 ไม่แฮนด์บอล' : sc === 'gk_clash_box' ? '🟡 ไม่ฟาวล์' : '🟡 นอกเขต',
        sc === 'handball_box' ? `🖥 VAR ชี้ไม่แฮนด์บอล / นอกเขต${fkCardTxt}` : `🖥 VAR ชี้ฟาวล์นอกเขต${fkCardTxt}`,
        'freekick'
      );
      addWorldFx(w, {
        type: 'var',
        x: edgeX,
        y: vr.y,
        label: sc === 'handball_box' ? `🖥 VAR: ไม่แฮนด์บอล${fkCardTxt}` : `🖥 VAR: ฟาวล์นอกเขต${fkCardTxt}`,
        color: '#38bdf8',
        ttl: 3.0,
        maxTtl: 3.0,
        wallPlayers: edgeWall
      });
      triggerDramaSlow(w, 1.8, `🖥 VAR ฟาวล์นอกเขต${fkCardTxt}`);
      w.pendingSetPiece = { type: 'freekick', side: vr.side, x: edgeX, y: vr.y, waitSec: 1.65, wallPlayers: edgeWall };
      w.phaseLabel = `🖥 VAR ชี้ฟาวล์นอกเขต${fkCardTxt} (${attTeam.name})`;
      w.phaseTone = 'setpiece';
      pushLog(
        curMin,
        sc === 'handball_box'
          ? `🖥 VAR ยืนยัน: แขนแนบลำตัว/อยู่นอกกรอบ — ${attTeam.name} ได้ฟรีคิก${fkCardTxt}`
          : `🖥 VAR ยืนยัน: จุดปะทะอยู่นอกกรอบเขตโทษ — ${attTeam.name} ได้ฟรีคิก${fkCardTxt}`,
        fkCardTxt ? 'card' : 'sys',
        varId
      );
      const noPenReason =
        sc === 'handball_box'
          ? 'VAR ชี้ไม่แฮนด์บอล / นอกเขต'
          : sc === 'gk_clash_box'
            ? 'VAR ชี้ปะทะนอกเขต / ไม่ฟาวล์จุดโทษ'
            : 'VAR ชี้จุดปะทะนอกกรอบเขตโทษ';
      recordEventHighlight(w, curMin, {
        kind: 'var_overturn',
        side: vr.side,
        attRight: penRightVar,
        actorName: vr.replay?.attId || attTeam.name,
        victimName: vr.culpritId,
        finishVerb: noPenReason,
        varVerdict: 'no_pen',
        varReasonText: noPenReason,
        dramaFloor: 85,
        preOverride: preVarSamples
      });
    } else {
      SFX.foul();
      SFX.boo(0.85);
      const spotX = penRightVar ? 88.5 : 11.5;
      let penCardTxt = '';
      if (culprit && simRef.current.cards.length < 5) {
        const roll = Math.random();
        const culpritVolatile = culprit.tr === 1 || culprit.tr === 7 || culprit.tr === 15 || culprit.tr === 22;
        if (roll < (culpritVolatile ? 0.08 : 0.04)) {
          issueCard(culprit, curMin, 1, 'R', true, undefined, varId, {
            victimName: vr.replay?.attId,
            preOverride: preVarSamples
          });
          penCardTxt = ' + 🟥 ใบแดง!';
        } else if (roll < 0.36) {
          const res = issueCard(culprit, curMin, 0, 'Y', true, undefined, varId, {
            victimName: vr.replay?.attId,
            preOverride: preVarSamples
          });
          penCardTxt = res === 'Y' ? ' + 🟨 ใบเหลือง' : ' + 🟥 เหลืองแดง!';
        }
      }
      recordVar(
        sc === 'handball_box' ? '🚨 แฮนด์บอล!' : '🚨 จุดโทษ!',
        sc === 'handball_box' ? `🚨 VAR แฮนด์บอลจุดโทษ!${penCardTxt}` : `🚨 VAR ชี้จุดโทษ!${penCardTxt}`,
        'penalty'
      );
      addWorldFx(w, {
        type: 'penalty',
        x: spotX,
        y: 50,
        label: sc === 'handball_box' ? `🖥🚨 แฮนด์บอล! จุดโทษ!${penCardTxt}` : `🖥✅ VAR จุดโทษ!${penCardTxt}`,
        color: '#ef4444',
        ttl: 3.2,
        maxTtl: 3.2
      });
      triggerDramaSlow(w, 2.2, `🖥🚨 VAR จุดโทษ!!${penCardTxt}`);
      w.pendingSetPiece = { type: 'penalty', side: vr.side, x: spotX, y: 50, waitSec: 2.0 };
      w.phaseLabel = `🖥🚨 VAR ให้จุดโทษ${penCardTxt} (${attTeam.name})!`;
      w.phaseTone = 'danger';
      pushLog(
        curMin,
        sc === 'handball_box'
          ? `🖥🚨 VAR ชี้แฮนด์บอลในเขตโทษ!! ${attTeam.name} ได้ลูกจุดโทษ${penCardTxt}!`
          : sc === 'gk_clash_box'
            ? `🖥🚨 VAR ชี้ผู้รักษาประตูกระแทกฟาวล์ในกรอบ!! ${attTeam.name} ได้ลูกจุดโทษ${penCardTxt}!`
            : `🖥🚨 VAR ชี้จุดโทษ!! ${attTeam.name} ได้ลูกจุดโทษหลังเช็กภาพช้า${penCardTxt}!`,
        'card',
        varId
      );
      pushTimeline(curMin, vr.side, 'pen_awarded', attTeam.name, sc === 'handball_box' ? 'VAR แฮนด์บอลจุดโทษ' : 'VAR ชี้จุดโทษ', varId);
      const awardPenReason =
        sc === 'handball_box'
          ? 'VAR ชี้แฮนด์บอลในเขตโทษ!'
          : sc === 'gk_clash_box'
            ? 'VAR ชี้ผู้รักษาประตูฟาวล์จุดโทษ!'
            : 'VAR ชี้ฟาวล์ในเขตโทษเป็นจุดโทษ!';
      recordEventHighlight(w, curMin, {
        kind: 'var_overturn',
        side: vr.side,
        attRight: penRightVar,
        actorName: vr.replay?.attId || attTeam.name,
        victimName: vr.culpritId,
        finishVerb: awardPenReason,
        varVerdict: 'pen',
        varReasonText: awardPenReason,
        dramaFloor: 89,
        preOverride: preVarSamples
      });
    }
  };

  // Resolve ball arrival at destination (pass, cross, through-ball, shot, corner, freekick, penalty, shootout)
  const resolveSegmentArrival = (w: LiveMatchWorld, curMin: number) => {
    const b = w.ball;
    const sr = simRef.current;
    const side = b.possessionSide;
    const defSide = side === 'H' ? 'A' : 'H';
    const attTeam = side === 'H' ? homeOrig : awayOrig;
    const defTeam = defSide === 'H' ? homeOrig : awayOrig;
    const active = w.agents.filter((a) => !a.sentOff);
    const attPool = active.filter((a) => a.side === side);
    const defPool = active.filter((a) => a.side === defSide);

    if (w.pendingSetPiece) return;

    // 00. Resolve Offside Call after ball visibly reaches the offside zone
    if (b.bounceNext?.isOffsideCall) {
      const bn = b.bounceNext;
      b.bounceNext = undefined;
      SFX.foul();
      SFX.boo(0.62);
      if (bn.offsideFx) addWorldFx(w, bn.offsideFx);
      if (bn.offsideLog) pushLog(curMin, bn.offsideLog);
      if (bn.setPiece) w.pendingSetPiece = bn.setPiece;
      b.carrierId = null;
      b.targetId = null;
      b.flightType = 'carry';
      b.trail.length = 0;
      b.shotStyle = undefined;
      b.startZ = 0;
      b.endZ = 0;
      if (bn.phaseLabel) w.phaseLabel = bn.phaseLabel;
      if (bn.phaseTone) w.phaseTone = bn.phaseTone;
      return;
    }

    // 0. Resolve Parry / Woodwork / Block Bounce Deflection / Bounce-in Goals
    if (b.flightType === 'bounce') {
      b.shotPlan = undefined;
      const bn = b.bounceNext;
      b.bounceNext = undefined;
      if (bn?.goalPayload) {
        const gp = bn.goalPayload;
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = null;
        b.startZ = 0;
        b.endZ = 0;
        b.z = 0;
        awardGoalToTeam(w, gp.side, curMin, gp.scorerName, gp.scorerShort, gp.assisterName, gp.finishVerb, b.toX, b.toY);
        return;
      }
      if (bn?.looseRebound) {
        const rb = bn.looseRebound;
        const attSide = side;
        const attRightNow = isAttackRight(w, attSide);
        const goalLineX = attRightNow ? 100 : 0;
        const boxCenterDistGoal = Math.hypot(goalLineX - b.toX, 50 - b.toY);
        const gkDef = defPool.find((a) => a.pos === 'GK');
        const ineligiblePenaltyTakerId = rb.fromPenalty ? rb.prevShooterId : undefined;

        // Evaluate all players racing for the rebound at (b.toX, b.toY)
        const cands = active
          .filter((a) => !(ineligiblePenaltyTakerId && a.id === ineligiblePenaltyTakerId))
          .map((a) => {
            const d = Math.hypot(a.x - b.toX, a.y - b.toY);
            let reactBonus = 0;
            if (a.pos === 'GK') {
              // GK can only realistically smother rebounds inside/right outside the 6-yard box
              if (a.side !== defSide || boxCenterDistGoal > 11.5) return { a, score: 999 };
              const divePenalty = a.intent === 'DIVE' ? 3.4 : 0;
              reactBonus = ((a.d.sv + (a.d.rfx ?? a.d.sv)) * 0.5 - 62) * 0.06 - divePenalty - (boxCenterDistGoal < 6.5 ? 1.4 : -1.2);
            } else if (a.side === attSide) {
              const poacherBonus = agentHasTrait(a, 'poacher_instinct') ? 2.4 : 0;
              reactBonus =
                ((a.d.fin + a.d.spd) * 0.5 - 60) * 0.055 +
                poacherBonus +
                (a.pos === 'FW' ? 1.6 : a.pos === 'MF' ? 0.6 : -0.8) +
                ((a.blessedMins ?? 0) > 0 ? 2.2 : 0);
            } else {
              reactBonus =
                ((a.d.blk + a.d.pos + a.d.spd) / 3 - 60) * 0.055 +
                (a.pos === 'DF' ? 1.4 : a.pos === 'MF' ? 0.5 : -0.9) +
                ((a.blessedMins ?? 0) > 0 ? 2.0 : 0);
            }
            const score = d - reactBonus + (Math.random() - 0.5) * 2.4;
            return { a, score };
          })
          .sort((u, v) => u.score - v.score);

        const winner = cands[0]?.a || gkDef || defPool[0] || attPool[0];
        if (winner && winner.pos === 'GK' && winner.side === defSide) {
          SFX.save();
          resetGkDive(winner);
          nudgeAgentToward(winner, b.toX, b.toY, 2.2, 1.6, 98.4);
          winner.acrobatType = 'supersave';
          winner.acrobatMax = 0.62;
          winner.acrobatTimer = 0.62;
          b.possessionSide = defSide;
          b.carrierId = winner.id;
          b.x = winner.x;
          b.y = winner.y;
          b.fromX = b.x;
          b.fromY = b.y;
          b.toX = b.x;
          b.toY = b.y;
          b.startZ = 0;
          b.endZ = 0;
          b.z = 0;
          b.progress = 0;
          b.duration = 0.72;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.phaseLabel = `🧤 ${winner.shortName} ตะครุบบอลกระดอนไว้ได้ทัน!`;
          w.phaseTone = 'normal';
          pushLog(curMin, `🧤 ${winner.id} (${defTeam.name}) รีบพุ่งตามตะครุบบอลเด้งไว้ได้ก่อนโดนซ้ำ!`);
          return;
        }

        if (winner && winner.side === attSide) {
          // Attacker wins the second ball -> IMMEDIATE REBOUND FOLLOW-UP SHOT!
          nudgeAgentToward(winner, b.toX, b.toY, 3.0, 2.5, 97.5);
          winner.facing = Math.atan2(50 - b.toY, goalLineX - b.toX);
          const isHighRebound = rb.woodworkPart === 'crossbar' || rb.woodworkPart === 'corner_junction';
          const rbStyle: LiveBallState['shotStyle'] = isHighRebound
            ? Math.random() < 0.45
              ? 'header'
              : 'volley'
            : Math.random() < 0.36
              ? 'screamer'
              : 'normal';
          if (rbStyle === 'header' || rbStyle === 'volley') {
            winner.acrobatType = rbStyle;
            winner.acrobatMax = 0.56;
            winner.acrobatTimer = 0.56;
          }
          const rbDist = Math.hypot(goalLineX - b.toX, 50 - b.toY);
          const rbDur = clamp(rbDist / 34, 0.22, 0.46);
          const rbMaxZ = rbStyle === 'header' ? 2.4 : rbStyle === 'volley' ? 2.8 : 1.9;
          SFX.pass();
          b.lastPasserId = null;
          addWorldFx(w, {
            type: 'skill',
            x: b.toX,
            y: b.toY,
            label: `⚡ ซ้ำดาบสอง!`,
            color: '#fde047',
            ttl: 1.5,
            maxTtl: 1.5
          });
          triggerDramaSlow(w, 1.3, `⚡ ${winner.shortName} วิ่งซ้ำดาบสอง!!`);
          pushLog(curMin, `⚡ จังหวะซ้ำ! ${winner.id} (${attTeam.name}) ปรี่เข้าซัดบอลเด้งดาบสองทันที!`);
          prepareShotFlight(w, curMin, {
            flightType: 'shot',
            side: attSide,
            fromX: clamp(b.toX, 3.2, 96.8),
            fromY: clamp(b.toY, 8, 92),
            shooter: winner,
            shotStyle: rbStyle,
            curveAmt: (Math.random() - 0.5) * 1.8,
            maxZAmt: rbMaxZ,
            durAmt: rbDur,
            startZAmt: isHighRebound ? 0.9 : 0.2,
            reboundChain: (rb.reboundChain ?? 0) + 1
          });
          w.phaseLabel = `⚡ ${winner.shortName} วิ่งเข้าซ้ำดาบสอง!!`;
          w.phaseTone = 'danger';
          return;
        }

        // Defender wins the second ball -> controls & clears danger!
        if (winner) {
          nudgeAgentToward(winner, b.toX, b.toY, 2.8, 2.5, 97.5);
          winner.acrobatType = 'kick';
          winner.acrobatMax = 0.4;
          winner.acrobatTimer = 0.4;
          const clearOut = boxCenterDistGoal < 12 && Math.random() < 0.72;
          if (clearOut) {
            const clearDir = attRightNow ? -1 : 1;
            const clearToX = clamp(winner.x + clearDir * (22 + Math.random() * 14), 16, 84);
            const clearToY = clamp(winner.y + (winner.y < 50 ? -12 - Math.random() * 12 : 12 + Math.random() * 12), 10, 90);
            const targetAlly = defPool
              .filter((a) => a.pos !== 'GK' && a.id !== winner.id)
              .sort((u, v) => Math.hypot(u.x - clearToX, u.y - clearToY) - Math.hypot(v.x - clearToX, v.y - clearToY))[0];
            SFX.pass();
            b.possessionSide = defSide;
            b.carrierId = null;
            b.targetId = targetAlly?.id || null;
            b.lastPasserId = winner.id;
            b.fromX = clamp(b.toX, 3, 97);
            b.fromY = clamp(b.toY, 6, 94);
            b.toX = targetAlly ? clamp(targetAlly.x, 8, 92) : clearToX;
            b.toY = targetAlly ? clamp(targetAlly.y, 8, 92) : clearToY;
            b.curve = (Math.random() - 0.5) * 3;
            b.startZ = 0.2;
            b.endZ = 0;
            b.maxZ = 7.2;
            b.progress = 0;
            b.duration = 0.62;
            b.flightType = 'lofted';
            b.shotStyle = undefined;
            w.phaseLabel = `🛡️ ${winner.shortName} สาดเคลียร์บอลซ้ำพ้นกรอบ!`;
            w.phaseTone = 'normal';
            pushLog(curMin, `🛡️ ${winner.id} (${defTeam.name}) ชิงจังหวะเตะเคลียร์บอลเด้งพ้นหน้าปากประตู!`);
            return;
          }
          b.possessionSide = winner.side;
          b.carrierId = winner.id;
          b.x = winner.x;
          b.y = winner.y;
          b.fromX = b.x;
          b.fromY = b.y;
          b.toX = b.x;
          b.toY = b.y;
          b.startZ = 0;
          b.endZ = 0;
          b.z = 0;
          b.progress = 0;
          b.duration = 0.24;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.phaseLabel = `🛡️ ${winner.shortName} เก็บบอลจังหวะสองได้`;
          w.phaseTone = 'normal';
          pushLog(curMin, `🛡️ ${winner.id} (${defTeam.name}) เก็บบอลจังหวะกระดอนคุมสถานการณ์ไว้ได้`);
          return;
        }
      }
      if (bn?.setPiece) {
        if (w.dramaLabel?.startsWith('🧤')) {
          w.dramaLabel = null;
          w.dramaSlowSec = 0;
        }
        w.pendingSetPiece = bn.setPiece;
        b.carrierId = null;
        b.targetId = null;
        b.flightType = 'carry';
        b.trail.length = 0;
        b.shotStyle = undefined;
        b.startZ = 0;
        b.endZ = 0;
        if (bn.phaseLabel) w.phaseLabel = bn.phaseLabel;
        if (bn.phaseTone) w.phaseTone = bn.phaseTone;
      } else if (bn?.carrierId) {
        const chosen = active.find((a) => a.id === bn.carrierId);
        const nearestAtSpot = active
          .slice()
          .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];
        const chosenDist = chosen ? Math.hypot(chosen.x - b.toX, chosen.y - b.toY) : 999;
        const nearDist = nearestAtSpot ? Math.hypot(nearestAtSpot.x - b.toX, nearestAtSpot.y - b.toY) : 999;
        const gatherer = chosen && (chosenDist <= 3.6 || (bn.bounceHops ?? 0) >= 1 || nearDist > 3.6) ? chosen : nearestAtSpot || chosen;
        if (gatherer) {
          const gDist = Math.hypot(gatherer.x - b.toX, gatherer.y - b.toY);
          if (gDist > 3.6 && (bn.bounceHops ?? 0) < 1) {
            gatherer.tx = b.toX;
            gatherer.ty = b.toY;
            gatherer.intent = 'PASS_TARGET';
            b.fromX = b.toX;
            b.fromY = b.toY;
            b.toX = clamp(gatherer.x + (b.toX - gatherer.x) * 0.35, 4, 96);
            b.toY = clamp(gatherer.y + (b.toY - gatherer.y) * 0.35, 5, 95);
            b.curve = 0;
            b.maxZ = 0.25;
            b.startZ = 0;
            b.endZ = 0;
            b.progress = 0;
            b.duration = clamp(gDist / 30, 0.16, 0.32);
            b.flightType = 'bounce';
            b.shotStyle = undefined;
            b.carrierId = null;
            b.targetId = gatherer.id;
            b.bounceNext = {
              carrierId: gatherer.id,
              possessionSide: gatherer.side,
              phaseLabel: bn.phaseLabel,
              phaseTone: bn.phaseTone,
              bounceHops: (bn.bounceHops ?? 0) + 1
            };
            return;
          }
          b.possessionSide = gatherer.side;
          b.carrierId = gatherer.id;
          b.x = gatherer.x;
          b.y = gatherer.y;
        } else {
          b.possessionSide = bn.possessionSide || defSide;
          b.carrierId = null;
        }
        b.fromX = b.x;
        b.fromY = b.y;
        b.toX = b.x;
        b.toY = b.y;
        b.startZ = 0;
        b.endZ = 0;
        b.progress = 0;
        b.duration = 0.16;
        b.flightType = 'carry';
        b.shotStyle = undefined;
        if (bn.phaseLabel) w.phaseLabel = bn.phaseLabel;
        if (bn.phaseTone) w.phaseTone = bn.phaseTone;
      } else {
        const gatherer =
          active
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0] || active[0];
        if (gatherer) {
          b.possessionSide = gatherer.side;
          b.carrierId = gatherer.id;
          b.x = gatherer.x;
          b.y = gatherer.y;
        }
        b.fromX = b.x;
        b.fromY = b.y;
        b.toX = b.x;
        b.toY = b.y;
        b.startZ = 0;
        b.endZ = 0;
        b.progress = 0;
        b.duration = 0.16;
        b.flightType = 'carry';
        b.shotStyle = undefined;
      }
      return;
    }

    // 0b. Resolve Live Cup/Asia Penalty Shootout Kick
    if (b.flightType === 'shootout_kick' && w.shootout) {
      const sh = w.shootout;
      const kicker = active.find((a) => a.id === sh.kickerName);
      const gk = active.find((a) => a.side !== sh.turn && a.pos === 'GK');
      const plan = b.shotPlan;
      b.shotPlan = undefined;
      resetGkDive(gk);
      const scored =
        plan?.shootoutScored ??
        Math.random() <
          clamp(
            0.75 + ((kicker ? kicker.d.fin * 0.5 + (kicker.d.comp || 62) * 0.5 : 64) - (gk ? gk.d.sv * 0.58 + gk.d.cl * 0.42 : 60)) * 0.0045,
            0.56,
            0.88
          );
      if (scored) {
        if (sh.turn === 'H') {
          sh.hKicks.push('G');
          sh.hScore++;
        } else {
          sh.aKicks.push('G');
          sh.aScore++;
        }
        w.goalNetRippleRight = 1.0;
        SFX.goal((sh.turn === 'H') === meIsHome);
        sh.lastMsg = `⚽ ${kicker?.shortName || sh.kickerName} ยิงเข้า! (${sh.hScore}-${sh.aScore})`;
        addWorldFx(w, { type: 'goal', x: 99, y: b.toY, label: `⚽ เข้า! ${kicker?.shortName || ''}`, color: '#22c55e', ttl: 2.2, maxTtl: 2.2 });
        triggerDramaSlow(w, 1.4, `⚽ ยิงเข้า! ${kicker?.shortName || ''}`);
      } else {
        if (sh.turn === 'H') sh.hKicks.push('M');
        else sh.aKicks.push('M');
        const wasSave = plan?.outcome === 'save';
        if (wasSave && gk) {
          SFX.save();
          SFX.cheer(0.55);
          gk.acrobatType = 'supersave';
          gk.acrobatMax = 0.85;
          gk.acrobatTimer = 0.85;
          sh.lastMsg = `🧤 ${gk.shortName} พุ่งปัดเซฟได้!! (${sh.hScore}-${sh.aScore})`;
          addWorldFx(w, { type: 'save', x: b.toX, y: b.toY, label: `🧤 เซฟ! ${gk.shortName}`, color: '#38bdf8', ttl: 2.2, maxTtl: 2.2 });
          triggerDramaSlow(w, 1.4, `🧤 ซูเปอร์เซฟ! ${gk.shortName}`);
        } else if (plan?.outcome === 'woodwork') {
          SFX.woodwork();
          SFX.boo(0.45);
          const partTxt =
            plan.woodworkPart === 'corner_junction'
              ? 'ชนสามเหลี่ยม'
              : plan.woodworkPart === 'crossbar'
                ? 'ชนคาน'
                : 'ชนเสา';
          const partIcon = plan.woodworkPart === 'corner_junction' ? '📐' : '🥅';
          sh.lastMsg = `${partIcon} ${kicker?.shortName || sh.kickerName} ยิง${partTxt}เต็มๆ!! (${sh.hScore}-${sh.aScore})`;
          addWorldFx(w, { type: 'woodwork', x: b.toX, y: b.toY, label: `${partIcon} ${partTxt}!`, color: '#f59e0b', ttl: 2.3, maxTtl: 2.3 });
          triggerDramaSlow(w, 1.5, `${partIcon} ${partTxt}!`);
        } else {
          SFX.foul();
          SFX.boo(0.55);
          sh.lastMsg = `❌ ${kicker?.shortName || sh.kickerName} ยิงหลุดกรอบ! (${sh.hScore}-${sh.aScore})`;
          addWorldFx(w, { type: 'woodwork', x: b.toX, y: b.toY, label: `❌ หลุดกรอบ!`, color: '#f59e0b', ttl: 2.2, maxTtl: 2.2 });
          triggerDramaSlow(w, 1.4, `❌ ยิงพลาดเป้า!`);
        }
      }
      sh.activeShot = false;

      // Check if shootout is mathematically decided
      const hRem = Math.max(0, 5 - sh.hKicks.length);
      const aRem = Math.max(0, 5 - sh.aKicks.length);
      const bothSameCount = sh.hKicks.length === sh.aKicks.length;
      const clinchedEarly =
        sh.hKicks.length <= 5 &&
        sh.aKicks.length <= 5 &&
        (sh.hScore > sh.aScore + aRem || sh.aScore > sh.hScore + hRem);
      const suddenDeathWin = sh.hKicks.length >= 5 && bothSameCount && sh.hScore !== sh.aScore;
      const isDecisive = clinchedEarly || suddenDeathWin;
      const shootoutOutcome: 'goal' | 'save' | 'woodwork' | 'miss' = scored
        ? 'goal'
        : plan?.outcome === 'save'
          ? 'save'
          : plan?.outcome === 'woodwork'
            ? 'woodwork'
            : 'miss';
      const shootoutScoreText = `${sh.hScore}-${sh.aScore}`;
      const kickSpeedKmh = Math.round(
        clamp((Math.hypot(b.toX - b.fromX, b.toY - b.fromY) / Math.max(0.24, b.duration || 0.68)) * 2.15, 78, 124)
      );
      const shootoutVerb = scored
        ? isDecisive
          ? 'ซัดจุดโทษลูกชี้ขาดพาทีมคว้าชัย!'
          : 'สังหารจุดโทษเข้าประตูไม่พลาด!'
        : shootoutOutcome === 'save'
          ? `ยิงติดเซฟปลายมือของ ${gk?.shortName || 'ผู้รักษาประตู'}!`
          : shootoutOutcome === 'woodwork'
            ? 'ซัดจุดโทษพุ่งชนเสา/คานอย่างจัง!'
            : 'ซัดจุดโทษหลุดกรอบออกไปอย่างน่าเสียดาย!';
      recordEventHighlight(w, 90, {
        kind: 'shootout_kick',
        side: sh.turn,
        attRight: true,
        actorName: kicker?.id || sh.kickerName,
        victimName: gk?.id || sh.gkName,
        finishVerb: shootoutVerb,
        shotStyle: 'penalty',
        shotDistM: 11,
        shotSpeedKmh: kickSpeedKmh,
        shootoutScored: scored,
        shootoutOutcome,
        shootoutRound: sh.round,
        shootoutDecisive: isDecisive,
        shootoutScoreText,
        dramaFloor: isDecisive ? 108 : scored ? 74 : 90
      });

      if (isDecisive) {
        sh.finished = true;
        const winnerHome = sh.hScore > sh.aScore;
        const text = `ดวลจุดโทษ: ${homeOrig.name} ${sh.hScore}-${sh.aScore} ${awayOrig.name}`;
        setPenResult({ winnerHome, text });
        setShootoutUi({ ...sh, hKicks: sh.hKicks.slice(), aKicks: sh.aKicks.slice() });
        pushLog(90, `🎯 ${text}`, 'sys');
        finalizeMatch(winnerHome, text);
        return;
      }

      // Advance turn to next kicker
      sh.turn = sh.turn === 'H' ? 'A' : 'H';
      if (sh.turn === 'H') sh.round++;
      const nextPool = active.filter((a) => a.side === sh.turn && a.pos !== 'GK').sort((u, v) => v.d.fin - u.d.fin);
      const nextIdx = (sh.turn === 'H' ? sh.hKicks.length : sh.aKicks.length) % Math.max(1, nextPool.length);
      const nextGk = active.find((a) => a.side !== sh.turn && a.pos === 'GK');
      sh.kickerName = nextPool[nextIdx]?.id || nextPool[0]?.id || 'นักเตะ';
      sh.gkName = nextGk?.id || 'ผู้รักษาประตู';
      sh.waitSec = 1.75;
      rollingSamplesRef.current = [];
      b.x = 88.5;
      b.y = 50;
      b.z = 0;
      b.trail = [];
      setShootoutUi({ ...sh, hKicks: sh.hKicks.slice(), aKicks: sh.aKicks.slice() });
      return;
    }

    // 1. Resolve Shot, Penalty Kick, or Direct Free Kick
    if (b.flightType === 'shot' || b.flightType === 'freekick' || b.flightType === 'penalty') {
      const shooter = active.find((a) => a.id === b.shooterId) || attPool.find((a) => a.pos === 'FW') || attPool[0];
      const gk = defPool.find((a) => a.pos === 'GK') || defPool[0];
      const defenders = defPool.filter((a) => a.pos === 'DF' || a.pos === 'MF');
      const attRightNow = isAttackRight(w, side);
      const defRightNow = isAttackRight(w, defSide);
      const dist = Math.hypot((attRightNow ? 100 : 0) - b.fromX, 50 - b.fromY);
      const plan = b.shotPlan;
      lastShotTelemetryRef.current = {
        distM: Math.round(clamp(dist * 0.95, 4, 38)),
        speedKmh: Math.round(clamp((dist / Math.max(0.22, b.duration || 0.45)) * 2.15, 72, 128)),
        style: b.shotStyle,
        flightType: b.flightType
      };
      // Shot Deflection ("ยิงแฉลบ") mid-flight!
      if (plan?.outcome === 'deflect') {
        const deflector = active.find((a) => a.id === (plan.deflectorId || plan.blockerId)) || defenders[0];
        const defShort = deflector?.shortName || 'กองหลัง';
        if (deflector) {
          deflector.acrobatType = 'clash';
          deflector.acrobatMax = 0.45;
          deflector.acrobatTimer = 0.45;
          deflector.actionDirX = b.fromX - deflector.x;
          deflector.actionDirY = b.fromY - deflector.y;
        }
        addWorldFx(w, {
          type: 'block',
          x: b.toX,
          y: b.toY,
          label: `💫 แฉลบ! (${defShort})`,
          color: '#fb923c',
          ttl: 1.85,
          maxTtl: 1.85
        });
        SFX.block();

        const deflectRoll = Math.random();
        const defDist = Math.hypot((attRightNow ? 100 : 0) - b.toX, 50 - b.toY);
        const deflectedGoalProb = clamp(0.28 + (24 - defDist) * 0.008, 0.22, 0.44);

        b.fromX = b.toX;
        b.fromY = b.toY;
        b.progress = 0;
        b.flightType = 'shot';
        b.shotStyle = 'deflected';
        b.carrierId = null;
        b.targetId = null;
        b.shooterId = shooter?.id || b.shooterId;
        b.possessionSide = side;

        // Swings away from initial target side
        const swingSide = b.fromY >= 50 ? -1 : 1;
        resetGkDive(gk);

        if (deflectRoll < deflectedGoalProb) {
          // Deflected Goal! Wrong-foots the GK cleanly (smaller chance of Own Goal on heavy mis-deflections)
          const isDeflectOwnGoal = Boolean(deflector && Math.random() < (defDist < 12 || w.env?.season === 'rainy' ? 0.22 : 0.16));
          const goalY = swingSide < 0 ? 42.9 + Math.random() * 4.4 : 52.7 + Math.random() * 4.4;
          b.toX = attRightNow ? 101.3 : -1.3;
          b.toY = goalY;
          b.curve = swingSide * (3.2 + Math.random() * 3.8);
          b.maxZ = 3.0 + Math.random() * 4.2;
          b.duration = clamp(Math.hypot(b.toX - b.fromX, b.toY - b.fromY) / 28, 0.28, 0.56);
          const defShotDist = Math.hypot(b.toX - b.fromX, b.toY - b.fromY);
          const wrongY = clamp(50 - (goalY - 50) * 0.85, 42.2, 57.8);
          b.shotPlan = {
            outcome: 'goal',
            reboundChain: plan.reboundChain,
            deflectedFrom: defShort,
            ownGoalCulpritId: isDeflectOwnGoal ? deflector?.id : undefined,
            gkDiveTargetY: wrongY,
            gkDiveDir: gk ? (wrongY >= gk.y ? 1 : -1) : 1,
            gkDiveStartProg: clamp(1 - 4.8 / Math.max(7.2, defShotDist), 0.52, 0.80)
          };
        } else if (deflectRoll < deflectedGoalProb + 0.27) {
          // Deflected onto target -> GK reflex save!
          const saveY = clamp(50 + swingSide * (1.8 + Math.random() * 5.5), 42.5, 57.5);
          const gkSaveX = gk
            ? clamp(gk.x, attRightNow ? 94.2 : 2.6, attRightNow ? 97.6 : 5.8)
            : attRightNow
              ? 96.2
              : 3.8;
          b.toX = gkSaveX;
          b.toY = saveY;
          b.curve = swingSide * 2.4;
          b.maxZ = 2.6 + Math.random() * 2.8;
          const defShotDist = Math.hypot(b.toX - b.fromX, b.toY - b.fromY);
          b.duration = clamp(defShotDist / 26, 0.26, 0.50);
          const clampedSaveY = clamp(saveY, 42.2, 57.8);
          b.shotPlan = {
            outcome: 'save',
            reboundChain: plan.reboundChain,
            parryCorner: Math.random() < 0.62,
            deflectedFrom: defShort,
            gkDiveTargetY: clampedSaveY,
            gkDiveDir: gk ? (clampedSaveY >= gk.y ? 1 : -1) : 1,
            gkDiveStartProg: clamp(1 - 5.6 / Math.max(7.2, defShotDist), 0.50, 0.78),
            gkSaveX
          };
        } else if (deflectRoll < deflectedGoalProb + 0.37) {
          // Deflected onto the woodwork!
          const wTarget = pickWoodworkTarget({
            attRightNow,
            fromY: b.fromY,
            curveAmt: swingSide * 2.5,
            maxZAmt: 4.5,
            shotStyle: 'deflected',
            flightType: 'shot'
          });
          b.toX = wTarget.toX;
          b.toY = wTarget.toY;
          b.curve = swingSide * 2.5;
          b.endZ = wTarget.endZ;
          b.maxZ = wTarget.maxZ;
          const defShotDist = Math.hypot(b.toX - b.fromX, b.toY - b.fromY);
          b.duration = clamp(defShotDist / 28, 0.26, 0.52);
          const diveY = clamp(b.toY, 41.2, 58.8);
          b.shotPlan = {
            outcome: 'woodwork',
            woodworkPart: wTarget.woodworkPart,
            woodworkPostSide: wTarget.postSide,
            reboundChain: plan.reboundChain,
            deflectedFrom: defShort,
            gkDiveTargetY: diveY,
            gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
            gkDiveStartProg: clamp(1 - 4.8 / Math.max(7.2, defShotDist), 0.52, 0.80)
          };
        } else {
          // Deflected wide past goal -> Corner Kick!
          b.toX = attRightNow ? 101.0 : -1.0;
          b.toY = swingSide < 0 ? 31.5 + Math.random() * 8.0 : 60.5 + Math.random() * 8.0;
          b.curve = swingSide * (3.5 + Math.random() * 3.5);
          b.maxZ = 4.2 + Math.random() * 3.8;
          const defShotDist = Math.hypot(b.toX - b.fromX, b.toY - b.fromY);
          b.duration = clamp(defShotDist / 28, 0.28, 0.54);
          const diveY = clamp(b.toY, 41.2, 58.8);
          b.shotPlan = {
            outcome: 'miss',
            reboundChain: plan.reboundChain,
            deflectedFrom: defShort,
            gkDiveTargetY: diveY,
            gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
            gkDiveStartProg: clamp(1 - 4.8 / Math.max(7.2, defShotDist), 0.52, 0.80)
          };
        }
        w.phaseLabel = `💫 ยิงแฉลบ ${defShort} เปลี่ยนทาง!`;
        w.phaseTone = 'danger';
        triggerDramaSlow(w, 1.25, `💫 บอลแฉลบ ${defShort}!`);
        return;
      }

      // Defender block / Free-kick wall deflection
      if (plan?.outcome === 'block') {
        const nearDef = active.find((a) => a.id === plan.blockerId) || defenders[0];
        if (nearDef) {
          if (defSide === 'H') w.blocksH++;
          else w.blocksA++;
          bumpPlayerStat(nearDef.id, 'blocks');
          adjustLiveForm(nearDef.id, 0.2);
          adjustLiveForm(shooter?.id, -0.08);
          if (b.flightType !== 'freekick') {
            nearDef.acrobatType = 'slide';
            nearDef.acrobatMax = 0.6;
            nearDef.acrobatTimer = 0.6;
            nearDef.actionDirX = b.fromX - nearDef.x;
            nearDef.actionDirY = b.fromY - nearDef.y;
            addWorldFx(w, {
              type: 'slide',
              x: nearDef.x,
              y: nearDef.y,
              label: '',
              color: '#38bdf8',
              ttl: 0.9,
              maxTtl: 0.9
            });
          }
          SFX.block();
          addWorldFx(w, {
            type: 'block',
            x: nearDef.x,
            y: nearDef.y,
            label: b.flightType === 'freekick' ? `🧱 ติดกำแพง (${nearDef.shortName})` : `🛡️ ${nearDef.shortName}${nearDef.sig === 'blk' ? ' [บล็อกเด่น]' : ''} บล็อก!`,
            color: '#60a5fa',
            ttl: 2.0,
            maxTtl: 2.0
          });
          if (Math.random() < 0.48) {
            pushLog(
              curMin,
              b.flightType === 'freekick'
                ? `🧱 ฟรีคิกของ ${shooter?.id || 'คู่แข่ง'} พุ่งไปติดกำแพงของ ${defTeam.name}!`
                : `🛡️ ${nearDef.id} พุ่งสไลด์บล็อกลูกยิงของ ${shooter?.id || 'คู่แข่ง'} ได้ทัน!`
            );
          }
          if (Math.random() < 0.48) {
            if (side === 'H') w.cornersH++;
            else w.cornersA++;
            const cy = b.toY < 50 ? 2 : 98;
            const cx = attRightNow ? 98.5 : 1.5;
            b.fromX = b.toX;
            b.fromY = b.toY;
            b.toX = attRightNow ? 100.8 : -0.8;
            b.toY = b.toY < 50 ? clamp(b.toY - 12, 16, 38) : clamp(b.toY + 12, 62, 84);
            b.curve = 0;
            b.maxZ = 3.2;
            b.progress = 0;
            b.duration = 0.34;
            b.flightType = 'bounce';
            b.shotStyle = undefined;
            b.carrierId = null;
            b.targetId = null;
            b.bounceNext = {
              setPiece: { type: 'corner', side, x: cx, y: cy, waitSec: 0.95 },
              phaseLabel: `🚩 บอลแฉลบออกหลัง · ${attTeam.name} ได้เตะมุม!`,
              phaseTone: 'setpiece'
            };
            w.phaseLabel = `🛡️ บล็อกแฉลบออกหลัง...`;
            w.phaseTone = 'setpiece';
          } else {
            b.possessionSide = defSide;
            b.carrierId = nearDef.id;
            b.x = nearDef.x;
            b.y = nearDef.y;
            b.fromX = b.x;
            b.fromY = b.y;
            b.toX = b.x;
            b.toY = b.y;
            b.startZ = 0;
            b.endZ = 0;
            b.progress = 0;
            b.duration = 0.16;
            b.flightType = 'carry';
            b.shotStyle = undefined;
            w.phaseLabel = `🛡️ ${nearDef.shortName} บล็อกและเก็บบอลได้`;
            w.phaseTone = 'normal';
          }
          return;
        }
      }

      // Shot registered! (skip attacking shot stats for panicked own-goal clearances)
      if (!plan?.isPureOwnGoal) {
        const shotXg =
          b.flightType === 'penalty'
            ? 0.78
            : clamp(0.05 + (32 - dist) * 0.011 + ((shooter?.d.fin || 60) - 60) * 0.002 + (b.shotStyle === 'bicycle' || b.shotStyle === 'volley' || b.shotStyle === 'diving_header' ? 0.04 : 0), 0.04, 0.45);
        bumpPlayerStat(shooter?.id, 'shots');
        if (side === 'H') {
          w.shotsH++;
          w.xgH = Math.round((w.xgH + shotXg) * 100) / 100;
        } else {
          w.shotsA++;
          w.xgA = Math.round((w.xgA + shotXg) * 100) / 100;
        }
      }

      // Woodwork or Off-target resolution
      if (plan?.outcome === 'woodwork' || plan?.outcome === 'miss') {
        if (gk && gk.intent === 'DIVE' && gk.diveProgress > 0) {
          gk.intentTimer = Math.max(gk.intentTimer, 0.36);
        } else {
          resetGkDive(gk);
        }
        adjustLiveForm(shooter?.id, -0.12);
        const hitWoodwork = plan.outcome === 'woodwork';
        if (hitWoodwork) {
          const woodPart = plan.woodworkPart || 'post';
          const postSide: -1 | 1 = plan.woodworkPostSide ?? (b.toY < 50 ? -1 : 1);
          const wasPenalty = b.flightType === 'penalty';
          const partNoun =
            woodPart === 'corner_junction' ? 'สามเหลี่ยม' : woodPart === 'crossbar' ? 'คาน' : 'เสา';
          const partIcon = woodPart === 'corner_junction' ? '📐' : '🥅';
          const isChainHit = (plan.reboundChain ?? 0) > 0;
          const hitX = b.toX;
          const hitY = b.toY;
          const hitZ = b.endZ ?? b.z;
          const origFromX = b.fromX;
          const origFromY = b.fromY;

          SFX.woodwork();
          addWorldFx(w, {
            type: 'woodwork',
            x: hitX,
            y: hitY,
            label: plan.deflectedFrom
              ? `${partIcon} แฉลบชน${partNoun}!`
              : isChainHit
                ? `${partIcon} ซ้ำชน${partNoun}อีก!!`
                : `${partIcon} ชน${partNoun}!`,
            color: woodPart === 'corner_junction' ? '#facc15' : '#f59e0b',
            ttl: 2.6,
            maxTtl: 2.6
          });
          triggerDramaSlow(
            w,
            1.5,
            `${partIcon} ${plan.deflectedFrom ? 'แฉลบ' : isChainHit ? 'ซ้ำ' : ''}ชน${partNoun}! · ${shooter?.shortName || ''}`
          );
          triggerCoachMood(w, side, '😩', 2.3);
          triggerCoachMood(w, defSide, '😮‍💨', 2.3);
          pushLog(
            curMin,
            plan.deflectedFrom
              ? `${partIcon} โอ้โห! ลูกยิงของ ${shooter?.id || 'กองหน้า'} แฉลบ ${plan.deflectedFrom} พุ่งชน${partNoun}อย่างจัง!`
              : isChainHit
                ? `${partIcon} เหลือเชื่อ!! ${shooter?.id || 'กองหน้า'} (${attTeam.name}) ตามซ้ำบอลพุ่งชน${partNoun}อีกหน!`
                : `${partIcon} โอ้โห! ${shooter?.id || 'กองหน้า'} (${attTeam.name}) ซัดบอลพุ่งชน${partNoun}อย่างจัง!`
          );
          pushTimeline(
            curMin,
            side,
            wasPenalty ? 'pen_miss' : 'miss',
            shooter?.id || attTeam.name,
            wasPenalty ? `จุดโทษชน${partNoun}` : `ชน${partNoun}`
          );

          const bouncePhys = computeWoodworkBouncePhysics({
            woodworkPart: woodPart,
            postSide,
            hitX,
            hitY,
            hitZ,
            fromX: origFromX,
            fromY: origFromY,
            attRightNow,
            reboundChain: plan.reboundChain ?? 0
          });

          b.fromX = hitX;
          b.fromY = hitY;
          b.toX = bouncePhys.toX;
          b.toY = bouncePhys.toY;
          b.curve = 0;
          b.startZ = bouncePhys.startZ;
          b.endZ = bouncePhys.endZ;
          b.maxZ = bouncePhys.maxZ;
          b.progress = 0;
          b.duration = bouncePhys.duration;
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = null;

          if (bouncePhys.inPlay) {
            b.bounceNext = {
              looseRebound: {
                fromPenalty: wasPenalty,
                prevShooterId: shooter?.id,
                reboundChain: plan.reboundChain ?? 0,
                source: 'woodwork',
                woodworkPart: woodPart
              },
              phaseLabel: `${partIcon}⚡ ชน${partNoun}กระดอนเข้าเขตโทษ! ลุ้นซ้ำดาบสอง!!`,
              phaseTone: 'danger'
            };
            w.phaseLabel = `${partIcon}⚡ บอลชน${partNoun}เด้งกลับเข้ากรอบ!!`;
            w.phaseTone = 'danger';
          } else if (plan.deflectedFrom) {
            if (side === 'H') w.cornersH++;
            else w.cornersA++;
            const cy = hitY < 50 ? 2 : 98;
            const cx = attRightNow ? 98.5 : 1.5;
            b.bounceNext = {
              setPiece: { type: 'corner', side, x: cx, y: cy, waitSec: 1.0 },
              phaseLabel: `${partIcon}🚩 แฉลบชน${partNoun}ออกหลัง · ${attTeam.name} ได้เตะมุม!`,
              phaseTone: 'setpiece'
            };
            w.phaseLabel = `${partIcon} บอลแฉลบชน${partNoun}ออกหลัง!`;
            w.phaseTone = 'setpiece';
          } else {
            b.bounceNext = {
              setPiece: {
                type: 'goalkick',
                side: defSide,
                x: defRightNow ? 5.5 : 94.5,
                y: 50,
                waitSec: 1.05
              },
              phaseLabel: `${partIcon} ชน${partNoun}ออกหลัง! ตั้งเตะจากประตู`,
              phaseTone: 'danger'
            };
            w.phaseLabel = `${partIcon} บอลชน${partNoun}กระดอนออกหลัง!`;
            w.phaseTone = 'danger';
          }

          const sr = simRef.current;
          const nonGoalCount = sr.highlightClips.filter((c) => !c.kind.startsWith('goal_')).length;
          if (!isSkippingRef.current || nonGoalCount < 3) {
            sr.highlightSeq += 1;
            const tel = lastShotTelemetryRef.current;
            const actorFullName = shooter?.id || attTeam.name;
            const woodVerb = plan.deflectedFrom
              ? `ยิงแฉลบ ${plan.deflectedFrom} พุ่งชน${partNoun}อย่างจัง`
              : `ซัดบอลพุ่งชน${partNoun}อย่างจัง`;
            if (isSkippingRef.current) {
              const hCfgSkip = getEffectiveTeamCfg('H', curMin);
              const aCfgSkip = getEffectiveTeamCfg('A', curMin);
              sr.highlightClips.push(
                simulateRealtimeHighlightClip({
                  id: `hl-${sr.highlightSeq}-${curMin}`,
                  seq: sr.highlightSeq,
                  minute: curMin,
                  kind: 'woodwork',
                  side,
                  attRight: attRightNow,
                  secondHalf: w.secondHalf,
                  homeTeam: homeOrig,
                  awayTeam: awayOrig,
                  homeLu: sr.homeLu,
                  awayLu: sr.awayLu,
                  homeTactics: { tac: hCfgSkip.tac, press: hCfgSkip.press, pass: hCfgSkip.pass, tempo: hCfgSkip.tempo, width: hCfgSkip.wid },
                  awayTactics: { tac: aCfgSkip.tac, press: aCfgSkip.press, pass: aCfgSkip.pass, tempo: aCfgSkip.tempo, width: aCfgSkip.wid },
                  scorerName: actorFullName,
                  victimName: gk?.id,
                  finishVerb: woodVerb,
                  shotStyle: tel?.style,
                  shotDistM: tel?.distM,
                  shotSpeedKmh: tel?.speedKmh,
                  scoreBefore: `${sr.gh}-${sr.ga}`,
                  scoreAfter: `${sr.gh}-${sr.ga}`,
                  scoreAfterGh: sr.gh,
                  scoreAfterGa: sr.ga,
                  isDerby,
                  careerP: state.p,
                  matchEnv
                })
              );
            } else {
              const ed = buildHighlightEditorial({
                kind: 'woodwork',
                minute: curMin,
                teamName: attTeam.name,
                oppTeamName: defTeam.name,
                actorName: actorFullName,
                victimName: gk?.id,
                finishVerb: woodVerb,
                shotDistM: tel?.distM,
                shotSpeedKmh: tel?.speedKmh,
                scoreAfterGh: sr.gh,
                scoreAfterGa: sr.ga,
                side,
                isDerby
              });
              queueHighlightCapture(w, {
                id: `hl-${sr.highlightSeq}-${curMin}`,
                seq: sr.highlightSeq,
                minute: curMin,
                kind: 'woodwork',
                side,
                attRight: attRightNow,
                title: ed.title,
                subtitle: ed.subtitle,
                crewTag: ed.crewTag,
                commentary: ed.commentary,
                actorName: actorFullName,
                victimName: gk?.id,
                scoreBefore: `${sr.gh}-${sr.ga}`,
                scoreAfter: `${sr.gh}-${sr.ga}`,
                dramaScore: ed.dramaScore,
                shotDistM: tel?.distM,
                shotSpeedKmh: tel?.speedKmh,
                secondHalf: w.secondHalf,
                matchEnv
              });
            }
          }
          return;
        }
        if (plan.deflectedFrom) {
          if (side === 'H') w.cornersH++;
          else w.cornersA++;
          const cy = b.toY < 50 ? 2 : 98;
          const cx = attRightNow ? 98.5 : 1.5;
          pushLog(curMin, `🚩 ลูกยิงของ ${shooter?.id || 'กองหน้า'} แฉลบ ${plan.deflectedFrom} เฉียดเสาออกหลัง! ${attTeam.name} ได้เตะมุม`);
          addWorldFx(w, {
            type: 'corner',
            x: cx,
            y: clamp(b.toY, 20, 80),
            label: `🚩 แฉลบออกหลัง · เตะมุม!`,
            color: '#fbbf24',
            ttl: 2.0,
            maxTtl: 2.0
          });
          w.pendingSetPiece = { type: 'corner', side, x: cx, y: cy, waitSec: 0.95 };
          b.carrierId = null;
          b.targetId = null;
          b.flightType = 'carry';
          b.trail.length = 0;
          b.shotStyle = undefined;
          w.phaseLabel = `🚩 บอลแฉลบ ${plan.deflectedFrom} ออกหลัง · ได้เตะมุม!`;
          w.phaseTone = 'setpiece';
          return;
        }
        if (b.flightType === 'penalty' || Math.random() < 0.45) {
          pushLog(curMin, `😮 ${shooter?.id || 'กองหน้า'} (${attTeam.name}) ยิงหลุดกรอบออกหลังไปอย่างน่าเสียดาย`);
          pushTimeline(
            curMin,
            side,
            b.flightType === 'penalty' ? 'pen_miss' : 'miss',
            shooter?.id || attTeam.name,
            b.flightType === 'penalty' ? 'ยิงจุดโทษพลาดกรอบ' : 'ยิงหลุดกรอบ'
          );
        }
        if (b.flightType === 'penalty') {
          const tel = lastShotTelemetryRef.current;
          recordEventHighlight(w, curMin, {
            kind: 'penalty_miss',
            side,
            attRight: attRightNow,
            actorName: shooter?.id || attTeam.name,
            victimName: gk?.id,
            finishVerb: 'รับหน้าที่สังหารจุดโทษแต่ซัดบอลหลุดกรอบออกไป',
            shotStyle: tel?.style || 'penalty',
            shotDistM: tel?.distM ?? 11,
            shotSpeedKmh: tel?.speedKmh,
            dramaFloor: 87
          });
        }
        w.pendingSetPiece = {
          type: 'goalkick',
          side: defSide,
          x: defRightNow ? 5.5 : 94.5,
          y: 50,
          waitSec: b.flightType === 'penalty' ? 1.3 : 0.75
        };
        b.carrierId = null;
        b.targetId = null;
        b.flightType = 'carry';
        b.trail.length = 0;
        b.shotStyle = undefined;
        w.phaseLabel = `😮 ยิงหลุดกรอบ · ตั้งเตะจากประตู`;
        w.phaseTone = 'normal';
        return;
      }

      // On target!
      if (!plan?.isPureOwnGoal) {
        bumpPlayerStat(shooter?.id, 'onTarget');
        if (side === 'H') w.onTargetH++;
        else w.onTargetA++;
      }

      let isGoal = plan?.outcome === 'goal';
      if (!plan) {
        const hR = getCachedSideRate('H', curMin);
        const aR = getCachedSideRate('A', curMin);
        const edge = side === 'H' ? hR.at - aR.df : aR.at - hR.df;
        const gkSaveScore = gk
          ? (gk.d.sv + (gk.sig === 'sv' ? 9 : 0)) * 0.36 +
            ((gk.d.rfx ?? gk.d.sv) + (gk.sig === 'rfx' ? 8 : 0)) * 0.24 +
            ((gk.d.hnd ?? gk.d.sv) + (gk.sig === 'hnd' ? 8 : 0)) * 0.16 +
            (gk.d.cl + (gk.sig === 'cl' ? 8 : 0)) * 0.14 +
            (gk.d.pos + (gk.sig === 'pos' ? 6 : 0)) * 0.10
          : 58;
        const shooterScore = shooter
          ? (shooter.d.fin + (shooter.sig === 'fin' ? 8 : 0)) * 0.5 +
            (shooter.d.cur + (shooter.sig === 'cur' ? 8 : 0)) * 0.25 +
            (shooter.d.pw + (shooter.sig === 'pw' ? 8 : 0)) * 0.25
          : 60;
        const realisticScoring = getModRealismSettings().realisticScoring;
        const goalProb =
          b.flightType === 'penalty'
            ? clamp(0.79 + (shooterScore - gkSaveScore) * 0.004, 0.65, 0.9)
            : clamp(
                (realisticScoring ? 0.22 : 0.27) +
                  edge * 0.0065 +
                  (shooterScore - gkSaveScore) * 0.004 +
                  (b.flightType === 'freekick' ? 0.03 : 0),
                0.11,
                realisticScoring ? 0.46 : 0.54
              );
        isGoal = Math.random() < goalProb;
      }

      if (isGoal) {
        if (gk && gk.intent === 'DIVE' && gk.diveProgress > 0) {
          gk.intentTimer = Math.max(gk.intentTimer, 0.38);
        } else {
          resetGkDive(gk);
        }
        const scorerName = shooter?.id || attPool[0]?.id || 'นักเตะ';
        const scorerShort = shooter?.shortName || scorerName;
        const assisterName =
          b.flightType !== 'penalty' && b.lastPasserId && b.lastPasserId !== scorerName && Math.random() < 0.85 ? b.lastPasserId : '';
        const gKind = plan?.goalFinishKind || 'normal';
        const finishVerb =
          plan?.deflectedFrom
            ? `ยิงแฉลบ ${plan.deflectedFrom} เปลี่ยนทางเข้าประตู!!`
            : gKind === 'post_in'
              ? 'ยิงชนเสาในกระดอนเข้าประตูสุดระทึก!!'
              : gKind === 'bar_in'
                ? 'ยิงชนคานล่างกระดอนข้ามเส้นเข้าประตู!!'
                : gKind === 'top_corner'
                  ? b.flightType === 'freekick'
                    ? 'ปั่นฟรีคิกเสียบสามเหลี่ยมบนสุดสวย!!'
                    : b.shotStyle === 'curler' || b.shotStyle === 'trivela'
                      ? 'ปั่นโค้งเสียบสามเหลี่ยมบนอย่างเหนือชั้น!!'
                      : 'ซัดบอลพุ่งเสียบสามเหลี่ยมบนอย่างเฉียบขาด!!'
                  : gKind === 'gk_face'
                    ? 'ตะบันเต็มข้อแสกหน้าผู้รักษาประตูตุงตาข่าย!!'
                    : gKind === 'gk_fumble_in'
                      ? 'ซัดแรงจนผู้รักษาประตูปัดไม่ออก บอลปลิ้นเข้าประตู!!'
                      : b.flightType === 'penalty'
                        ? b.shotStyle === 'panenka'
                          ? 'ชิพจุดโทษปาเนนก้าสุดเหนือชั้น!'
                          : 'สังหารจุดโทษไม่พลาดเป้า!'
                        : b.flightType === 'freekick'
                          ? 'ปั่นฟรีคิกเสียบสามเหลี่ยมสุดสวย!'
                          : b.shotStyle === 'bicycle'
                            ? 'ตีลังกาโอเวอร์เฮดคิกสุดมหัศจรรย์!!'
                            : b.shotStyle === 'volley'
                              ? 'ฟาดวอลเลย์กลางอากาศบอลพุ่งเสียบตาข่าย!'
                              : b.shotStyle === 'diving_header'
                                ? 'พุ่งโหม่งตอร์ปิโดเสียบมุมอย่างสุดสวย!!'
                                : b.shotStyle === 'header'
                                  ? 'เทกตัวโหม่งเต็มกบาลเสียบเสาอย่างเด็ดขาด!'
                                  : b.shotStyle === 'chip'
                                    ? 'ชิพข้ามหัวนายด่านเข้าประตูอย่างเยือกเย็น!'
                                    : b.shotStyle === 'curler'
                                      ? 'ปั่นโค้งเสียบสามเหลี่ยมอย่างเหนือชั้น!'
                                      : b.shotStyle === 'trivela'
                                        ? 'ตะบันไซด์ก้อยทริเวล่าบอลโค้งหนีมือสุดสวย!'
                                        : b.shotStyle === 'knuckle'
                                          ? 'กดลูกส่ายคนัคเคิลบอลฮุคเสียบตาข่ายสุดเหลือเชื่อ!'
                                          : b.shotStyle === 'screamer'
                                            ? 'ตะบันไกลสุดแรงบอลพุ่งเสียบตาข่าย!'
                                            : 'จบสกอร์ตุงตาข่ายอย่างเฉียบขาด!';

        // Stage-2 physical bounce-in animations: Post-In, Crossbar-In, or GK Fumble-In!
        if (!plan?.ownGoalCulpritId && (gKind === 'post_in' || gKind === 'bar_in' || gKind === 'gk_fumble_in')) {
          if (gKind === 'gk_fumble_in') {
            SFX.save();
            if (gk) {
              resetGkDive(gk);
              nudgeAgentToward(gk, b.toX, clamp(b.toY, 42.2, 57.8), 1.4, 1.6, 98.4);
              gk.acrobatType = 'clash';
              gk.acrobatMax = 0.72;
              gk.acrobatTimer = 0.72;
            }
            addWorldFx(w, {
              type: 'save',
              x: b.toX,
              y: b.toY,
              label: `🧤 ปัดไม่ออก!!`,
              color: '#fb923c',
              ttl: 2.0,
              maxTtl: 2.0
            });
            triggerDramaSlow(w, 1.35, `🧤 ปัดไม่พ้น!! · ${gk?.shortName || 'ผู้รักษาประตู'}`);
            b.fromX = b.toX;
            b.fromY = b.toY;
            b.toX = attRightNow ? 101.3 : -1.3;
            b.toY = clamp(b.toY + (b.toY >= 50 ? 1.5 : -1.5), 42.7, 57.3);
            b.curve = 0;
            b.startZ = Math.min(2.6, Math.max(0.8, b.z));
            b.endZ = 0.35;
            b.maxZ = 1.6;
            b.progress = 0;
            b.duration = 0.25;
            b.flightType = 'bounce';
            b.shotStyle = undefined;
            b.carrierId = null;
            b.targetId = null;
            b.bounceNext = {
              goalPayload: {
                side,
                scorerName,
                scorerShort,
                assisterName,
                finishVerb
              }
            };
            w.phaseLabel = `🧤💥 ${gk?.shortName || 'นายด่าน'} ปัดไม่ออก บอลปลิ้นเข้าประตู!!`;
            w.phaseTone = 'danger';
            return;
          }

          SFX.woodwork();
          addWorldFx(w, {
            type: 'woodwork',
            x: b.toX,
            y: b.toY,
            label: gKind === 'post_in' ? '🥅 ชนเสาใน!!' : '🥅 ชนคานล่าง!!',
            color: '#facc15',
            ttl: 2.0,
            maxTtl: 2.0
          });
          triggerDramaSlow(w, 1.35, gKind === 'post_in' ? '🥅 ชนเสาใน!' : '🥅 ชนคานล่าง!');
          b.fromX = b.toX;
          b.fromY = b.toY;
          b.toX = attRightNow ? 101.4 : -1.4;
          b.toY = gKind === 'post_in' ? (b.toY < 50 ? 45.8 : 54.2) : clamp(b.toY, 44.5, 55.5);
          b.curve = 0;
          b.startZ = gKind === 'bar_in' ? 4.4 : 1.4;
          b.endZ = 0.25;
          b.maxZ = gKind === 'bar_in' ? 0.5 : 2.1;
          b.progress = 0;
          b.duration = 0.22;
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = null;
          b.bounceNext = {
            goalPayload: {
              side,
              scorerName,
              scorerShort,
              assisterName,
              finishVerb
            }
          };
          w.phaseLabel = gKind === 'post_in' ? '🥅⚽ บอลชนเสากระดอนเข้าประตู!!' : '🥅⚽ บอลชนคานกระดอนข้ามเส้น!!';
          w.phaseTone = 'danger';
          return;
        }

        // Tight-call VAR Goal Check (~18% chance on open-play goals, skipped on Own Goals)
        if (b.flightType === 'shot' && !plan?.ownGoalCulpritId && w.varChecks < 2 && Math.random() < 0.18) {
          w.varChecks++;
          const goalVarRoll = Math.random();
          const goalScenario: 'offside_line' | 'goal_line_tech' | 'foul_buildup' =
            goalVarRoll < 0.27 ? 'goal_line_tech' : goalVarRoll < 0.48 ? 'foul_buildup' : 'offside_line';
          const overturn = Math.random() < (goalScenario === 'goal_line_tech' ? 0.30 : 0.34);
          const sortedOutfieldDefs = defPool
            .filter((d) => !d.sentOff && d.pos !== 'GK')
            .slice()
            .sort((a, d2) => (attRightNow ? d2.x - a.x : a.x - d2.x));
          const lastDef = sortedOutfieldDefs[0] || defPool[0];
          const baseShotY = goalScenario === 'goal_line_tech' ? clamp(b.toY, 43.2, 56.8) : (shooter?.y ?? b.fromY);
          const rawDefLineX = lastDef
            ? attRightNow
              ? clamp(lastDef.x, 73, 92.5)
              : clamp(lastDef.x, 7.5, 27)
            : attRightNow
              ? 84
              : 16;
          const marginCm = Math.round(12 + Math.random() * 44);
          const offsideGapFx = clamp(marginCm / 68, 0.42, 0.96);
          const goalLineMm = Math.round(10 + Math.random() * 48);
          const replayAttX =
            goalScenario === 'goal_line_tech'
              ? attRightNow ? clamp(b.fromX, 78, 95.5) : clamp(b.fromX, 4.5, 22)
              : goalScenario === 'foul_buildup'
                ? attRightNow ? clamp(rawDefLineX - 1.4, 72, 89) : clamp(rawDefLineX + 1.4, 11, 28)
                : overturn
                  ? attRightNow
                    ? clamp(rawDefLineX + offsideGapFx, 74, 94.5)
                    : clamp(rawDefLineX - offsideGapFx, 5.5, 26)
                  : attRightNow
                    ? clamp(rawDefLineX - offsideGapFx, 71, 91.5)
                    : clamp(rawDefLineX + offsideGapFx, 8.5, 29);
          const replayAttY =
            goalScenario === 'goal_line_tech'
              ? clamp(b.fromY, 32, 68)
              : clamp(baseShotY, 24, 76);
          const passerAg = assisterName
            ? attPool.find((a) => a.id === assisterName)
            : attPool.find((a) => !a.sentOff && a.id !== scorerName && a.pos === 'MF');
          const supDefAg = sortedOutfieldDefs[1];
          const passerX =
            goalScenario === 'goal_line_tech'
              ? replayAttX
              : goalScenario === 'offside_line' && passerAg
                ? attRightNow
                  ? clamp(passerAg.x, 28, Math.max(28, replayAttX - 6))
                  : clamp(passerAg.x, Math.min(72, replayAttX + 6), 72)
                : clamp(replayAttX + (attRightNow ? -11 : 11), 28, 72);
          const passerY =
            goalScenario === 'goal_line_tech'
              ? replayAttY
              : goalScenario === 'offside_line' && passerAg
                ? clamp(passerAg.y, 14, 86)
                : clamp(replayAttY + (replayAttY < 50 ? 9 : -9), 18, 82);

          const goalReason =
            goalScenario === 'goal_line_tech'
              ? `โกล์ไลน์กำลังเช็กจังหวะยิงของ ${scorerShort} ว่าข้ามเส้นเต็มใบหรือไม่`
              : goalScenario === 'foul_buildup'
                ? `กำลังเช็กจังหวะปะทะก่อนยิงของ ${scorerShort}`
                : `กำลังตีเส้นเช็กจังหวะล้ำหน้าของ ${scorerShort}`;
          const goalFxLabel =
            goalScenario === 'goal_line_tech'
              ? '🖥 โกล์ไลน์เช็กข้ามเส้น!'
              : goalScenario === 'foul_buildup'
                ? '🖥 VAR เช็กฟาวล์ก่อนยิง!'
                : '🖥 VAR เช็กประตู!';
          const goalLog =
            goalScenario === 'goal_line_tech'
              ? `🖥 จังหวะก้ำกึ่งบนเส้นประตู! โกล์ไลน์ & VAR กำลังเช็กลูกยิงของ ${scorerName}`
              : goalScenario === 'foul_buildup'
                ? `🖥 บอลเข้าประตูไปแล้ว แต่ VAR เรียกเช็กจังหวะปะทะก่อนยิงของ ${scorerName}!`
                : `🖥 บอลตุงตาข่ายแล้ว แต่ VAR เรียกเช็กจังหวะล้ำหน้าของ ${scorerName}!`;

          varBuildupSamplesRef.current = rollingSamplesRef.current.slice();
          w.varReview = {
            kind: 'goal',
            side,
            waitSec: 6.2,
            totalSec: 6.2,
            shooterId: scorerName,
            shooterShort: scorerShort,
            assisterName,
            finishVerb,
            x: b.toX,
            y: b.toY,
            overturn,
            reasonText: goalReason,
            replay: {
              scenario: goalScenario,
              attRight: attRightNow,
              attId: scorerName,
              attShort: scorerShort,
              attNo: shooter?.no ?? 9,
              attRole: shooter?.role,
              attVis: shooter?.vis,
              defId: lastDef?.id,
              defShort: lastDef?.shortName || 'กองหลัง',
              defNo: lastDef?.no ?? 4,
              defRole: lastDef?.role,
              defVis: lastDef?.vis,
              defX: lastDef?.x,
              defY: lastDef?.y,
              gkNo: gk?.no ?? 1,
              gkRole: gk?.role || 'GK',
              gkVis: gk?.vis,
              gkX: gk?.x,
              gkY: gk?.y,
              passerNo: passerAg?.no,
              passerRole: passerAg?.role,
              passerVis: passerAg?.vis,
              supportDefNo: supDefAg?.no,
              supportDefRole: supDefAg?.role,
              supportDefVis: supDefAg?.vis,
              passFromX: passerX,
              passFromY: passerY,
              incidentX: replayAttX,
              incidentY: replayAttY,
              shotTargetY: clamp(b.toY, 43.2, 56.8),
              defLineX: rawDefLineX,
              offsideMarginCm: marginCm,
              goalLineMm
            }
          };
          addWorldFx(w, {
            type: 'var',
            x: b.toX,
            y: b.toY,
            label: goalFxLabel,
            color: '#38bdf8',
            ttl: 6.2,
            maxTtl: 6.2
          });
          triggerDramaSlow(w, 6.2, `${goalFxLabel} · ${scorerShort}`);
          SFX.var();
          b.shotStyle = undefined;
          w.phaseLabel = `🖥 VAR กำลังตรวจสอบประตูของ ${attTeam.name}!`;
          w.phaseTone = 'setpiece';
          pushLog(curMin, goalLog, 'sys');
          return;
        }

        if (gKind === 'top_corner') {
          addWorldFx(w, {
            type: 'goal',
            x: b.toX,
            y: b.toY,
            label: '✨ สามเหลี่ยม!!',
            color: '#facc15',
            ttl: 2.2,
            maxTtl: 2.2
          });
        } else if (gKind === 'gk_face') {
          if (gk) {
            gk.acrobatType = 'clash';
            gk.acrobatMax = 0.55;
            gk.acrobatTimer = 0.55;
          }
          addWorldFx(w, {
            type: 'goal',
            x: gk?.x ?? b.toX,
            y: gk?.y ?? b.toY,
            label: '💥 แสกหน้า!!',
            color: '#fb923c',
            ttl: 2.2,
            maxTtl: 2.2
          });
        } else if (plan?.deflectedFrom && !plan?.ownGoalCulpritId) {
          addWorldFx(w, {
            type: 'goal',
            x: b.toX,
            y: b.toY,
            label: '💫 แฉลบเข้า!!',
            color: '#fb923c',
            ttl: 2.2,
            maxTtl: 2.2
          });
        }

        const ogCulprit = plan?.ownGoalCulpritId ? active.find((a) => a.id === plan.ownGoalCulpritId) : undefined;
        b.shotStyle = undefined;
        if (plan?.ownGoalCulpritId && ogCulprit) {
          awardGoalToTeam(
            w,
            side,
            curMin,
            ogCulprit.id,
            ogCulprit.shortName,
            '',
            plan.isPureOwnGoal ? 'สกัดบอลพลาดเข้าประตูตัวเอง!!' : `สกัดพลาดบอลแฉลบเข้าประตูตัวเอง!!`,
            b.toX,
            b.toY,
            {
              isOwnGoal: true,
              culpritName: ogCulprit.id,
              culpritShort: ogCulprit.shortName,
              culpritTeam: defTeam
            }
          );
        } else {
          awardGoalToTeam(w, side, curMin, scorerName, scorerShort, assisterName, finishVerb, b.toX, b.toY);
        }
      } else {
        // ACCURATE & SYNCHRONIZED SUPER SAVE RIGHT AT GK'S POSITION!
        SFX.save();
        if (defSide === 'H') w.savesH++;
        else w.savesA++;
        bumpPlayerStat(gk?.id, 'saves');
        adjustLiveForm(gk?.id, 0.26);
        adjustLiveForm(shooter?.id, -0.06);
        if (gk) {
          resetGkDive(gk);
          nudgeAgentToward(gk, b.toX, clamp(b.toY, 42.2, 57.8), 1.4, 1.6, 98.4);
          gk.acrobatType = 'supersave';
          gk.acrobatMax = 0.9;
          gk.acrobatTimer = 0.9;
        }
        const saveTypeText =
          plan?.deflectedFrom
            ? 'ปฏิกิริยาเทพปัดลูกแฉลบเปลี่ยนทางได้เหลือเชื่อ!'
            : b.shotStyle === 'bicycle'
              ? 'บินปัดลูกตีลังกายิงได้เหลือเชื่อ!'
              : b.shotStyle === 'diving_header' || b.shotStyle === 'header'
                ? 'ปฏิกิริยาไวบินปัดลูกโหม่งจ่อๆ พ้นเส้น!'
                : b.shotStyle === 'curler' || b.shotStyle === 'trivela'
                  ? 'เหินตัวปัดลูกปั่นโค้งปลายมือ!'
                  : b.shotStyle === 'knuckle'
                    ? 'ชกลูกส่ายอันตรายพ้นปากประตู!'
                    : b.shotStyle === 'chip'
                      ? 'ถอยหลังกระโดดคว้าลูกชิพไว้ได้!'
                      : b.shotStyle === 'volley' || b.shotStyle === 'screamer'
                        ? 'ปฏิกิริยาไวปัดลูกยิงสุดแรงพ้นกรอบ!'
                        : 'พุ่งปัดปลายมือสุดสวย!';
        addWorldFx(w, {
          type: 'save',
          x: b.toX,
          y: b.toY,
          label: `🧤 ซูเปอร์เซฟ! ${gk?.shortName || 'ผู้รักษาประตู'}${agentHasTrait(gk, 'reflex_cat') ? ' [ปฏิกิริยาแมวป่า]' : ''}`,
          color: '#38bdf8',
          ttl: 2.5,
          maxTtl: 2.5
        });
        triggerDramaSlow(w, b.flightType === 'penalty' ? 2.0 : 1.5, `🧤 ซูเปอร์เซฟ! · ${gk?.shortName || 'ผู้รักษาประตู'}`);
        triggerCoachMood(w, side, '😫', 2.1);
        triggerCoachMood(w, defSide, '👏', 2.2);
        if (b.flightType === 'penalty' || Math.random() < 0.68) {
          pushLog(
            curMin,
            b.flightType === 'penalty'
              ? `🧤 ซูเปอร์เซฟ!! ${gk?.id || 'ผู้รักษาประตู'} (${defTeam.name}) อ่านทางพุ่งปัดจุดโทษของ ${shooter?.id || 'คู่แข่ง'} ไว้ได้!`
              : `🧤 ${gk?.id || 'ผู้รักษาประตู'} (${defTeam.name}) ${saveTypeText} จากลูกยิงของ ${shooter?.id || 'คู่แข่ง'}`
          );
          if (b.flightType === 'penalty') {
            pushTimeline(curMin, side, 'pen_miss', shooter?.id || attTeam.name, `${gk?.shortName || 'ผู้รักษาประตู'} เซฟจุดโทษ`);
          }
        }
        const parryCorner = plan?.parryCorner ?? Math.random() < 0.48;
        if (parryCorner) {
          if (side === 'H') w.cornersH++;
          else w.cornersA++;
          const cy = b.toY < 50 ? 2 : 98;
          const cx = attRightNow ? 98.5 : 1.5;
          b.fromX = b.toX;
          b.fromY = b.toY;
          b.toX = attRightNow ? 100.9 : -0.9;
          b.toY = b.toY < 50 ? clamp(b.toY - (10 + Math.random() * 7), 22, 38) : clamp(b.toY + (10 + Math.random() * 7), 62, 78);
          b.curve = 0;
          b.maxZ = 4.2;
          b.startZ = b.z;
          b.endZ = 0;
          b.progress = 0;
          b.duration = 0.34;
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = null;
          b.bounceNext = {
            setPiece: { type: 'corner', side, x: cx, y: cy, waitSec: 1.0 },
            phaseLabel: `🧤 ปัดออกหลัง! ${attTeam.name} ได้เตะมุม`,
            phaseTone: 'setpiece'
          };
          w.dramaSlowSec = Math.max(w.dramaSlowSec, 0.95);
          w.phaseLabel = `🧤 ${gk?.shortName || 'ผู้รักษาประตู'} ปัดปลายมือออกหลัง!`;
          w.phaseTone = 'danger';
        } else {
          b.shotStyle = undefined;
          b.possessionSide = defSide;
          b.carrierId = gk?.id || null;
          b.x = gk?.x ?? b.toX;
          b.y = gk?.y ?? b.toY;
          b.fromX = b.x;
          b.fromY = b.y;
          b.toX = b.x;
          b.toY = b.y;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = 0.92;
          b.flightType = 'carry';
          w.dramaSlowSec = Math.max(w.dramaSlowSec, 0.95);
          w.phaseLabel = `🧤 ${gk?.shortName || 'ผู้รักษาประตู'} ${saveTypeText}`;
          w.phaseTone = 'normal';
        }
        const shotFlightType = lastShotTelemetryRef.current?.flightType;
        const srSave = simRef.current;
        const nonGoalSavesCount = srSave.highlightClips.filter((c) => !c.kind.startsWith('goal_')).length;
        const isNotableShot =
          shotFlightType === 'penalty' ||
          Boolean(plan?.deflectedFrom) ||
          ['bicycle', 'volley', 'diving_header', 'curler', 'trivela', 'knuckle', 'screamer'].includes(
            lastShotTelemetryRef.current?.style || ''
          ) ||
          Math.random() < 0.45;
        const highDramaSave = isNotableShot && (!isSkippingRef.current || nonGoalSavesCount < 3);
        if (highDramaSave) {
          srSave.highlightSeq += 1;
          const tel = lastShotTelemetryRef.current;
          const gkName = gk?.id || 'ผู้รักษาประตู';
          const saveVerb = shotFlightType === 'penalty' ? 'อ่านทางพุ่งปัดจุดโทษไว้ได้อย่างเหลือเชื่อ' : saveTypeText;
          if (isSkippingRef.current) {
            const hCfgSkip = getEffectiveTeamCfg('H', curMin);
            const aCfgSkip = getEffectiveTeamCfg('A', curMin);
            srSave.highlightClips.push(
              simulateRealtimeHighlightClip({
                id: `hl-${srSave.highlightSeq}-${curMin}`,
                seq: srSave.highlightSeq,
                minute: curMin,
                kind: 'super_save',
                side: defSide,
                attRight: attRightNow,
                secondHalf: w.secondHalf,
                homeTeam: homeOrig,
                awayTeam: awayOrig,
                homeLu: srSave.homeLu,
                awayLu: srSave.awayLu,
                homeTactics: { tac: hCfgSkip.tac, press: hCfgSkip.press, pass: hCfgSkip.pass, tempo: hCfgSkip.tempo, width: hCfgSkip.wid },
                awayTactics: { tac: aCfgSkip.tac, press: aCfgSkip.press, pass: aCfgSkip.pass, tempo: aCfgSkip.tempo, width: aCfgSkip.wid },
                scorerName: gkName,
                victimName: shooter?.id,
                finishVerb: saveVerb,
                shotStyle: tel?.style || (shotFlightType === 'penalty' ? 'penalty' : undefined),
                shotDistM: tel?.distM,
                shotSpeedKmh: tel?.speedKmh,
                scoreBefore: `${srSave.gh}-${srSave.ga}`,
                scoreAfter: `${srSave.gh}-${srSave.ga}`,
                scoreAfterGh: srSave.gh,
                scoreAfterGa: srSave.ga,
                isDerby,
                careerP: state.p,
                matchEnv
              })
            );
          } else {
            const ed = buildHighlightEditorial({
              kind: 'super_save',
              minute: curMin,
              teamName: defTeam.name,
              oppTeamName: attTeam.name,
              actorName: gkName,
              victimName: shooter?.id,
              finishVerb: saveVerb,
              shotDistM: tel?.distM,
              shotSpeedKmh: tel?.speedKmh,
              scoreAfterGh: srSave.gh,
              scoreAfterGa: srSave.ga,
              side: defSide,
              isDerby
            });
            queueHighlightCapture(w, {
              id: `hl-${srSave.highlightSeq}-${curMin}`,
              seq: srSave.highlightSeq,
              minute: curMin,
              kind: 'super_save',
              side: defSide,
              attRight: attRightNow,
              title: ed.title,
              subtitle: ed.subtitle,
              crewTag: ed.crewTag,
              commentary: ed.commentary,
              actorName: gkName,
              victimName: shooter?.id,
              scoreBefore: `${srSave.gh}-${srSave.ga}`,
              scoreAfter: `${srSave.gh}-${srSave.ga}`,
              dramaScore: shotFlightType === 'penalty' ? Math.max(ed.dramaScore, 89) : ed.dramaScore,
              shotDistM: tel?.distM,
              shotSpeedKmh: tel?.speedKmh,
              secondHalf: w.secondHalf,
              matchEnv
            });
          }
        }
      }
      return;
    }

    // 2. Resolve Cutback Delivery ("เปิดตัดหลัง") -> First-time Strike or Defender Clearance!
    if (b.flightType === 'cutback') {
      const designatedCut = b.targetId ? active.find((a) => a.id === b.targetId) : undefined;
      const closerCut = attPool
        .filter((a) => a.pos !== 'GK' && a.id !== b.lastPasserId)
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];
      const designatedCutDist = designatedCut ? Math.hypot(designatedCut.x - b.toX, designatedCut.y - b.toY) : 99;
      const closerCutDist = closerCut ? Math.hypot(closerCut.x - b.toX, closerCut.y - b.toY) : 99;
      const target =
        designatedCut && designatedCutDist <= 6.8
          ? designatedCut
          : closerCut && closerCutDist <= 6.8
            ? closerCut
            : undefined;
      const nearDef = defPool
        .filter((d) => d.pos !== 'GK')
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];
      const nearDefDist = nearDef ? Math.hypot(nearDef.x - b.toX, nearDef.y - b.toY) : 99;
      const defClose = nearDef && nearDefDist < 4.5;
      if (target && (!defClose || Math.random() < 0.66)) {
        nudgeAgentToward(target, b.toX, b.toY, 1.15);
        target.tx = target.x;
        target.ty = target.y;
        target.vx = 0;
        target.vy = 0;
        const style: LiveBallState['shotStyle'] = target.d.cur >= 66 ? 'curler' : Math.random() < 0.35 ? 'volley' : 'normal';
        if (shouldShooterWhiff(w, target, nearDefDist, style, true)) {
          launchWhiffLooseBall(w, curMin, side, target, attTeam, defPool, isAttackRight(w, side), 'วิ่งมาเข้าฮอสลูกคัทแบ็คแต่เตะวืดเต็มๆ!');
          return;
        }
        prepareShotFlight(w, curMin, {
          flightType: 'shot',
          side,
          fromX: target.x,
          fromY: target.y,
          shooter: target,
          shotStyle: style,
          curveAmt: (target.y < 50 ? 1 : -1) * 4.5,
          maxZAmt: 5.5,
          durAmt: 0.44
        });
        w.phaseLabel = `⚡ ${target.shortName} วิ่งมาซัดคัทแบ็คจังหวะเดียว!!`;
        w.phaseTone = 'danger';
        triggerDramaSlow(w, 1.15, `👟 คัทแบ็คจบสกอร์! · ${target.shortName}`);
        SFX.shot();
      } else if (nearDef && nearDefDist <= 6.8) {
        nudgeAgentToward(nearDef, b.toX, b.toY, 1.15);
        bumpPlayerStat(nearDef.id, 'tackles');
        b.possessionSide = defSide;
        b.carrierId = nearDef.id;
        b.x = nearDef.x;
        b.y = nearDef.y;
        b.fromX = nearDef.x;
        b.fromY = nearDef.y;
        b.toX = nearDef.x;
        b.toY = nearDef.y;
        b.flightType = 'carry';
        b.shotStyle = undefined;
        w.phaseLabel = `🛡️ ${nearDef.shortName} อ่านทางตัดลูกคัทแบ็คได้ทัน!`;
        w.phaseTone = 'normal';
        SFX.tackle(false);
      } else {
        const nearestLoose =
          active
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0] ||
          closerCut ||
          nearDef ||
          active[0];
        if (nearestLoose) {
          nearestLoose.tx = b.toX;
          nearestLoose.ty = b.toY;
          nearestLoose.intent = 'PASS_TARGET';
          b.fromX = b.toX;
          b.fromY = b.toY;
          b.toX = clamp((b.toX + nearestLoose.x) * 0.5, 4, 96);
          b.toY = clamp((b.toY + nearestLoose.y) * 0.5, 5, 95);
          b.curve = 0;
          b.maxZ = 0.25;
          b.progress = 0;
          b.duration = clamp(Math.hypot(b.toX - b.fromX, b.toY - b.fromY) / 26, 0.18, 0.34);
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = nearestLoose.id;
          b.bounceNext = {
            carrierId: nearestLoose.id,
            possessionSide: nearestLoose.side,
            phaseLabel: `⚽ ${nearestLoose.shortName} วิ่งเข้ามาเก็บบอลหน้ากรอบ!`,
            phaseTone: 'normal'
          };
        }
      }
      return;
    }

    // 2b. Resolve Cross or Corner Delivery in the Box (Header / Diving Header / Volley / Bicycle Kick / Clearing Header!)
    if (b.flightType === 'cross' || b.flightType === 'corner') {
      const designatedTarget = b.targetId ? active.find((a) => a.id === b.targetId) : undefined;
      const closerAtt = attPool
        .filter((a) => a.pos !== 'GK' && a.id !== b.lastPasserId)
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];
      const designatedDist = designatedTarget ? Math.hypot(designatedTarget.x - b.toX, designatedTarget.y - b.toY) : 99;
      const closerAttDist = closerAtt ? Math.hypot(closerAtt.x - b.toX, closerAtt.y - b.toY) : 99;
      const target =
        designatedTarget && designatedDist <= 7.2
          ? designatedTarget
          : closerAtt && closerAttDist <= 7.2
            ? closerAtt
            : undefined;
      const topDefCand = defPool
        .filter((d) => d.pos === 'DF' || d.pos === 'GK' || baseRoleOf(d.role) === 'CDM')
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];
      const topDefDist = topDefCand ? Math.hypot(topDefCand.x - b.toX, topDefCand.y - b.toY) : 99;
      const topDef = topDefCand && topDefDist <= (topDefCand.pos === 'GK' ? 8.2 : 7.2) ? topDefCand : undefined;
      const attRightNow = isAttackRight(w, side);
      const goalTargetX = attRightNow ? 100 : 0;

      if (!target && !topDef) {
        const nearestDrop =
          active
            .slice()
            .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];
        if (nearestDrop) {
          nearestDrop.tx = b.toX;
          nearestDrop.ty = b.toY;
          nearestDrop.intent = 'PASS_TARGET';
          b.fromX = b.toX;
          b.fromY = b.toY;
          b.toX = clamp((b.toX + nearestDrop.x) * 0.55, 4, 96);
          b.toY = clamp((b.toY + nearestDrop.y) * 0.55, 5, 95);
          b.curve = 0;
          b.maxZ = 1.6;
          b.startZ = 1.2;
          b.endZ = 0;
          b.progress = 0;
          b.duration = clamp(Math.hypot(b.toX - b.fromX, b.toY - b.fromY) / 26, 0.20, 0.36);
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = nearestDrop.id;
          b.bounceNext = {
            carrierId: nearestDrop.id,
            possessionSide: nearestDrop.side,
            phaseLabel: `⚽ ${nearestDrop.shortName} วิ่งเก็บลูกเปิดในกรอบ!`,
            phaseTone: 'normal'
          };
          w.phaseLabel = `⚽ บอลเปิดตกพื้นในกรอบเขตโทษ!`;
          w.phaseTone = 'normal';
        }
        return;
      }

      const attAir = target ? (target.d.hd + (target.sig === 'hd' ? 12 : 0) + (agentHasTrait(target, 'aerial_menace') ? 16 : 0) + (agentHasTrait(target, 'near_post_runner') ? 8 : 0)) * 0.68 + target.d.run * 0.32 + ((target.blessedMins ?? 0) > 0 ? 16 : 0) : 58;
      const defAir = topDef
        ? (topDef.pos === 'GK'
            ? (topDef.d.cl + (topDef.sig === 'cl' ? 8 : 0) + (agentHasTrait(topDef, 'sweeper_keeper') ? 8 : 0)) * 0.7 + topDef.d.sv * 0.3
            : (topDef.d.hd + (topDef.sig === 'hd' ? 8 : 0) + (agentHasTrait(topDef, 'aerial_menace') ? 12 : 0)) * 0.6 + topDef.d.pos * 0.4) +
          ((topDef.blessedMins ?? 0) > 0 ? 16 : 0)
        : 60;
      const winHeaderProb = !topDef ? 0.94 : clamp(0.48 + (attAir - defAir) * 0.007, 0.24, 0.84);

      if (target && Math.random() < winHeaderProb) {
        nudgeAgentToward(target, b.toX, b.toY, 1.35);
        target.tx = target.x;
        target.ty = target.y;
        target.vx = 0;
        target.vy = 0;
        target.facing = Math.atan2(50 - target.y, goalTargetX - target.x);

        const acroRoll = Math.random();
        const hdPriority = agentHasTrait(target, 'aerial_menace') || target.sig === 'hd' || target.d.hd >= 68;
        const isBicycle = acroRoll < (agentHasTrait(target, 'acrobatic_finisher') ? 0.22 : hdPriority ? 0.08 : target.sig === 'fin' || target.d.fin >= 70 ? 0.14 : 0.09);
        const isVolley = !isBicycle && acroRoll < (agentHasTrait(target, 'acrobatic_finisher') ? 0.46 : hdPriority ? 0.24 : 0.34);
        const isDivingHeader = !isBicycle && !isVolley && (agentHasTrait(target, 'aerial_menace') || target.sig === 'hd' || target.d.hd >= 64) && Math.random() < (agentHasTrait(target, 'aerial_menace') ? 0.38 : 0.26);
        const chosenStyle: LiveBallState['shotStyle'] = isBicycle
          ? 'bicycle'
          : isVolley
            ? 'volley'
            : isDivingHeader
              ? 'diving_header'
              : 'header';

        const nearDefDistBox = topDef ? Math.hypot(topDef.x - target.x, topDef.y - target.y) : 99;
        if ((isBicycle || isVolley) && shouldShooterWhiff(w, target, nearDefDistBox, chosenStyle, true)) {
          launchWhiffLooseBall(w, curMin, side, target, attTeam, defPool, attRightNow, 'ลอยตัวยิงจังหวะเปิดเข้ากรอบแต่เตะวืดอากาศ!');
          return;
        }

        prepareShotFlight(w, curMin, {
          flightType: 'shot',
          side,
          fromX: target.x,
          fromY: target.y,
          shooter: target,
          shotStyle: chosenStyle,
          curveAmt: isVolley || isBicycle ? (Math.random() - 0.5) * 4.5 : (Math.random() - 0.5) * 1.4,
          maxZAmt: isBicycle ? 6.4 : isVolley ? 4.2 : isDivingHeader ? 2.6 : 4.5,
          durAmt: isDivingHeader ? 0.40 : isVolley ? 0.44 : 0.48,
          startZAmt: 3.2
        });
        if (isBicycle) {
          target.acrobatType = 'bicycle';
          target.acrobatMax = 0.85;
          target.acrobatTimer = 0.85;
          w.phaseLabel = `🤸 ${target.shortName} ตีลังกายิงกลางอากาศ!!`;
          triggerDramaSlow(w, 1.5, `🤸 ตีลังกายิง!! · ${target.shortName}`);
          pushLog(curMin, `🤸 โอ้โห!! ${target.id} (${attTeam.name}) ลอยตัวตีลังกาโอเวอร์เฮดคิกอย่างสุดสวย!`);
        } else if (isVolley) {
          target.acrobatType = 'volley';
          target.acrobatMax = 0.58;
          target.acrobatTimer = 0.58;
          w.phaseLabel = `⚡ ${target.shortName} วอลเลย์ไม่ต้องจับ!`;
          triggerDramaSlow(w, 1.2, `⚡ วอลเลย์ · ${target.shortName}`);
        } else if (isDivingHeader) {
          target.acrobatType = 'diving_header';
          target.acrobatMax = 0.72;
          target.acrobatTimer = 0.72;
          w.phaseLabel = `💨 ${target.shortName} พุ่งโหม่งตอร์ปิโด!!`;
          triggerDramaSlow(w, 1.25, `💨 พุ่งโหม่ง! · ${target.shortName}`);
          pushLog(curMin, `💨 ${target.id} (${attTeam.name}) ทะยานพุ่งโหม่งบอลอย่างสุดอันตราย!`);
        } else {
          target.acrobatType = 'header';
          target.acrobatMax = 0.68;
          target.acrobatTimer = 0.68;
          bumpPlayerStat(target.id, 'headers');
          w.phaseLabel = `⚽ ${target.shortName}${agentHasTrait(target, 'aerial_menace') ? ' [ราชาลูกกลางอากาศ]' : ''} เทกตัวโหม่งเต็มๆ!`;
          triggerDramaSlow(w, 1.05, `⚽ โหม่งลุ้นประตู · ${target.shortName}`);
        }
        w.phaseTone = 'danger';
        SFX.shot();
        if (isBicycle || isDivingHeader) SFX.cheer(0.65);
      } else if (topDef) {
        nudgeAgentToward(topDef, b.toX, b.toY, 1.35, topDef.pos === 'GK' ? 2 : 4, topDef.pos === 'GK' ? 98 : 96);
        topDef.tx = topDef.x;
        topDef.ty = topDef.y;
        topDef.vx = 0;
        topDef.vy = 0;
        const clearDir = attRightNow ? -1 : 1;
        topDef.facing = Math.atan2(0, clearDir);
        if (topDef.pos === 'GK') {
          topDef.acrobatType = 'supersave';
          topDef.acrobatMax = 0.65;
          topDef.acrobatTimer = 0.65;
          const punchClear = Math.random() < 0.45;
          if (punchClear) {
            const clearX = clamp(topDef.x + clearDir * (18 + Math.random() * 10), 15, 85);
            const clearY = clamp(topDef.y + (topDef.y < 50 ? -18 : 18) + (Math.random() - 0.5) * 10, 12, 88);
            const outlet =
              defPool
                .filter((a) => a.pos !== 'GK')
                .sort((u, v) => Math.hypot(u.x - clearX, u.y - clearY) - Math.hypot(v.x - clearX, v.y - clearY))[0] || topDef;
            b.fromX = topDef.x;
            b.fromY = topDef.y;
            b.toX = clearX;
            b.toY = clearY;
            b.curve = 0;
            b.maxZ = 9.5;
            b.startZ = 3.2;
            b.endZ = 0;
            b.progress = 0;
            b.duration = 0.48;
            b.flightType = 'bounce';
            b.shotStyle = undefined;
            b.carrierId = null;
            b.targetId = outlet.id;
            b.bounceNext = {
              carrierId: outlet.id,
              possessionSide: defSide,
              phaseLabel: `🧤 ${topDef.shortName} ชกบอลเคลียร์พ้นเขตโทษ!`,
              phaseTone: 'normal'
            };
            w.phaseLabel = `🧤 ${topDef.shortName} กระโดดชกบอลพ้นกรอบ!`;
            w.phaseTone = 'normal';
            SFX.catch(true);
          } else {
            b.possessionSide = defSide;
            b.carrierId = topDef.id;
            b.lastPasserId = null;
            b.targetId = null;
            b.x = topDef.x;
            b.y = topDef.y;
            b.fromX = b.x;
            b.fromY = b.y;
            b.toX = b.x;
            b.toY = b.y;
            b.startZ = 0;
            b.endZ = 0;
            b.progress = 0;
            b.duration = 0.65;
            b.flightType = 'carry';
            b.shotStyle = undefined;
            w.phaseLabel = `🧤 ${topDef.shortName} ออกมาคว้าบอลกลางอากาศไว้ได้`;
            w.phaseTone = 'normal';
            SFX.catch(false);
          }
        } else {
          // Defender tries to clear cross/corner: small chance of OG slice or clearance whiff!
          const defInPuddle = isOnRainyPuddle(w, topDef.x, topDef.y);
          const defOgProb = clamp(
            (0.022 + (w.env?.season === 'rainy' ? 0.009 : 0) + (defInPuddle ? 0.012 : 0) + (topDef.fit < 55 ? 0.01 : 0) - ((topDef.d.hd || 60) - 60) * 0.0003) *
              ((topDef.blessedMins ?? 0) > 0 ? 0.25 : 1),
            0.01,
            0.055
          );
          const defWhiffProb = clamp(
            (0.048 + (w.env?.season === 'rainy' ? 0.016 : 0) + (defInPuddle ? 0.02 : 0) + (topDef.fit < 55 ? 0.02 : 0)) *
              ((topDef.blessedMins ?? 0) > 0 ? 0.3 : 1) *
              turfMatchMods.whiffMult,
            0.02,
            0.12
          );
          const defErrRoll = Math.random();
          if (defErrRoll < defOgProb) {
            launchOwnGoalShot(w, curMin, side, topDef, defTeam, 'โหม่งสกัดลูกเปิดพลาดเหลี่ยมลอยเข้าประตูตัวเอง!');
            return;
          }
          if (defErrRoll < defOgProb + defWhiffProb && target) {
            topDef.acrobatType = 'whiff';
            topDef.acrobatMax = 0.78;
            topDef.acrobatTimer = 0.78;
            adjustLiveForm(topDef.id, -0.14);
            addWorldFx(w, {
              type: 'whiff',
              x: topDef.x,
              y: topDef.y,
              label: `💨 สกัดวืด!! (${topDef.shortName})`,
              color: '#fb923c',
              ttl: 1.9,
              maxTtl: 1.9
            });
            SFX.whiff();
            SFX.boo(0.45);
            triggerCoachMood(w, defSide, '🤦', 2.0);
            const tWhiffDist = Math.hypot(target.x - b.toX, target.y - b.toY);
            if (tWhiffDist > 2.6) {
              target.tx = b.toX;
              target.ty = b.toY;
              target.intent = 'PASS_TARGET';
              b.fromX = b.toX;
              b.fromY = b.toY;
              b.toX = clamp((b.toX + target.x) * 0.5, 4, 96);
              b.toY = clamp((b.toY + target.y) * 0.5, 5, 95);
              b.curve = 0;
              b.maxZ = 0.3;
              b.startZ = 0.5;
              b.endZ = 0;
              b.progress = 0;
              b.duration = clamp(tWhiffDist / 26, 0.16, 0.28);
              b.flightType = 'bounce';
              b.shotStyle = undefined;
              b.carrierId = null;
              b.targetId = target.id;
              b.bounceNext = {
                carrierId: target.id,
                possessionSide: side,
                phaseLabel: `💨 ${topDef.shortName} สกัดวืด! บอลหลุดมาถึง ${target.shortName} หน้าประตู!!`,
                phaseTone: 'danger'
              };
            } else {
              b.possessionSide = side;
              b.carrierId = target.id;
              b.targetId = null;
              b.x = target.x;
              b.y = target.y;
              b.fromX = target.x;
              b.fromY = target.y;
              b.toX = target.x;
              b.toY = target.y;
              b.startZ = 0;
              b.endZ = 0;
              b.progress = 0;
              b.duration = 0.16;
              b.flightType = 'carry';
              b.shotStyle = undefined;
            }
            w.phaseLabel = `💨 ${topDef.shortName} สกัดวืด! บอลหลุดมาถึง ${target.shortName} หน้าประตู!!`;
            w.phaseTone = 'danger';
            pushLog(curMin, `💨 สกัดวืด! ${topDef.id} (${defTeam.name}) เตะสกัดพลาดบอลหลุดเข้าทาง ${target.id} หน้าเขตโทษ!`);
            return;
          }

          // Defender wins aerial duel and heads ball clear!
          topDef.acrobatType = 'header';
          topDef.acrobatMax = 0.64;
          topDef.acrobatTimer = 0.64;
          bumpPlayerStat(topDef.id, 'headers');
          bumpPlayerStat(topDef.id, 'tackles');
          const clearX = clamp(topDef.x + clearDir * (16 + Math.random() * 12), 14, 86);
          const clearY = clamp(topDef.y + (Math.random() - 0.5) * 28, 12, 88);
          const outlet =
            defPool
              .filter((a) => a.pos !== 'GK' && a.id !== topDef.id)
              .sort((u, v) => Math.hypot(u.x - clearX, u.y - clearY) - Math.hypot(v.x - clearX, v.y - clearY))[0] || topDef;
          b.fromX = topDef.x;
          b.fromY = topDef.y;
          b.toX = clearX;
          b.toY = clearY;
          b.curve = 0;
          b.maxZ = 8.8;
          b.progress = 0;
          b.duration = 0.46;
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = outlet.id;
          b.bounceNext = {
            carrierId: outlet.id,
            possessionSide: defSide,
            phaseLabel: `🛡️ ${topDef.shortName} โหม่งสกัดบอลพ้นอันตราย!`,
            phaseTone: 'normal'
          };
          w.phaseLabel = `🛡️ ${topDef.shortName} เทกตัวโหม่งสกัดบอลทิ้ง!`;
          w.phaseTone = 'normal';
          SFX.header();
        }
      }
      return;
    }

    // 3. Resolve Ground Pass / Trivela Curve / Throw-in / Lofted Ball / Through-Ball / Give-and-Go (1-2) / Carry
    if (b.flightType === 'pass' || b.flightType === 'through' || b.flightType === 'lofted' || b.flightType === 'goalkick' || b.flightType === 'onetwo' || b.flightType === 'trivela_pass' || b.flightType === 'throwin') {
      if (side === 'H') w.passesH++;
      else w.passesA++;
      bumpPlayerStat(b.lastPasserId, 'passes');
      const receiver = active.find((a) => a.id === b.targetId);
      const nearestOpp = defPool
        .filter((d) => d.pos !== 'GK')
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];

      // Pressured sideline passes bounce/roll visibly over the touchline -> Throw-in (no warp!)
      if ((b.flightType === 'pass' || b.flightType === 'lofted' || b.flightType === 'trivela_pass') && (b.toY < 13 || b.toY > 87) && nearestOpp && Math.hypot(nearestOpp.x - b.toX, nearestOpp.y - b.toY) < 6 && Math.random() < 0.24) {
        const outY = b.toY < 50 ? 1.6 : 98.4;
        const attDir = isAttackRight(w, side) ? 1 : -1;
        const outX = clamp(b.toX + attDir * 1.5, 8, 92);
        b.fromX = b.toX;
        b.fromY = b.toY;
        b.toX = outX;
        b.toY = outY < 50 ? -0.5 : 100.5;
        b.curve = 0;
        b.maxZ = b.flightType === 'lofted' ? 3.2 : 1.35;
        b.startZ = 0;
        b.endZ = 0;
        b.progress = 0;
        b.duration = clamp(Math.hypot(b.toX - b.fromX, b.toY - b.fromY) / 28, 0.26, 0.44);
        b.flightType = 'bounce';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = null;
        b.bounceNext = {
          setPiece: { type: 'throwin', side: defSide, x: outX, y: outY, waitSec: 0.68 },
          phaseLabel: `🤲 บอลหลุดเส้นข้าง! ${defTeam.name} ได้ทุ่ม`,
          phaseTone: 'setpiece'
        };
        w.phaseLabel = `🤲 บอลไหลออกเส้นข้าง!`;
        w.phaseTone = 'normal';
        SFX.pass();
        return;
      }

      const oppDist = nearestOpp ? Math.hypot(nearestOpp.x - b.toX, nearestOpp.y - b.toY) : 99;
      const recDist = receiver ? Math.hypot(receiver.x - b.toX, receiver.y - b.toY) : 99;
      const isAerialBall = b.flightType === 'lofted' || b.flightType === 'goalkick';

      // Aerial header duel on long lofted balls & goalkicks (strictly when both players are actually at the drop zone)!
      if (isAerialBall && receiver && nearestOpp && oppDist < 6.2 && recDist < 6.2 && Math.random() < 0.55) {
        const attAir = (receiver.d.hd + (receiver.sig === 'hd' ? 12 : 0)) * 0.65 + receiver.d.run * 0.35;
        const defAir = (nearestOpp.d.hd + (nearestOpp.sig === 'hd' ? 12 : 0)) * 0.65 + nearestOpp.d.pos * 0.35;
        const winProb = clamp(0.5 + (attAir - defAir) * 0.008, 0.25, 0.78);
        const attRightNow = isAttackRight(w, side);
        const dir = attRightNow ? 1 : -1;

        if (Math.random() < winProb) {
          nudgeAgentToward(receiver, b.toX, b.toY, 1.15);
          receiver.tx = receiver.x;
          receiver.ty = receiver.y;
          receiver.vx = 0;
          receiver.vy = 0;
          receiver.acrobatType = 'header';
          receiver.acrobatMax = 0.58;
          receiver.acrobatTimer = 0.58;
          bumpPlayerStat(receiver.id, 'headers');
          receiver.facing = Math.atan2(0, dir);
          // Flick-on header to an onside forward partner ahead if in attacking half!
          const partner = attPool.find(
            (a) =>
              a.id !== receiver.id &&
              a.pos !== 'GK' &&
              (attRightNow ? a.x > receiver.x + 4 : a.x < receiver.x - 4) &&
              Math.hypot(a.x - receiver.x, a.y - receiver.y) < 24 &&
              !checkPassOffside(w, side, receiver, a, defPool).isOffside
          );
          if (partner && Math.random() < 0.56) {
            const offChk = checkPassOffside(w, side, receiver, partner, defPool);
            if (offChk.isOffside) {
              triggerOffsideCall(w, curMin, side, receiver, partner, offChk.oppLineX, 'pass', 'ยืนล้ำหน้าจังหวะโหม่งเช็ดตั้งบอล');
              return;
            }
            b.fromX = receiver.x;
            b.fromY = receiver.y;
            b.toX = clamp(partner.x + dir * 2.5, 6, 94);
            b.toY = partner.y;
            b.curve = 0;
            b.maxZ = 4.2;
            b.progress = 0;
            b.duration = 0.38;
            b.flightType = 'pass';
            b.shotStyle = undefined;
            b.carrierId = null;
            b.targetId = partner.id;
            b.lastPasserId = receiver.id;
            w.phaseLabel = `⚽ ${receiver.shortName} โหม่งเช็ดตั้งให้ ${partner.shortName}!`;
            w.phaseTone = 'attack';
            SFX.header();
            return;
          }
          if (Math.hypot(receiver.x - b.toX, receiver.y - b.toY) > 2.4) {
            b.fromX = b.toX;
            b.fromY = b.toY;
            b.toX = receiver.x;
            b.toY = receiver.y;
            b.curve = 0;
            b.maxZ = 0.35;
            b.progress = 0;
            b.duration = 0.18;
            b.flightType = 'bounce';
            b.shotStyle = undefined;
            b.carrierId = null;
            b.targetId = receiver.id;
            b.bounceNext = {
              carrierId: receiver.id,
              possessionSide: side,
              phaseLabel: `⚽ ${receiver.shortName} เทกตัวโหม่งคุมจังหวะได้`,
              phaseTone: 'normal'
            };
          } else {
            b.carrierId = receiver.id;
            b.targetId = null;
            b.x = receiver.x;
            b.y = receiver.y;
            b.flightType = 'carry';
            b.shotStyle = undefined;
          }
          w.phaseLabel = `⚽ ${receiver.shortName} เทกตัวโหม่งคุมจังหวะได้`;
          w.phaseTone = 'normal';
          SFX.header();
          return;
        } else {
          nudgeAgentToward(nearestOpp, b.toX, b.toY, 1.15);
          nearestOpp.tx = nearestOpp.x;
          nearestOpp.ty = nearestOpp.y;
          nearestOpp.vx = 0;
          nearestOpp.vy = 0;
          nearestOpp.acrobatType = 'header';
          nearestOpp.acrobatMax = 0.58;
          nearestOpp.acrobatTimer = 0.58;
          nearestOpp.facing = Math.atan2(0, -dir);
          adjustLiveForm(nearestOpp.id, 0.14);
          bumpPlayerStat(nearestOpp.id, 'headers');
          bumpPlayerStat(nearestOpp.id, 'tackles');
          const clearX = clamp(nearestOpp.x - dir * (12 + Math.random() * 8), 8, 92);
          const clearY = clamp(nearestOpp.y + (Math.random() - 0.5) * 20, 10, 90);
          const outlet =
            defPool
              .filter((a) => a.pos !== 'GK' && a.id !== nearestOpp.id)
              .sort((u, v) => Math.hypot(u.x - clearX, u.y - clearY) - Math.hypot(v.x - clearX, v.y - clearY))[0] || nearestOpp;
          b.fromX = nearestOpp.x;
          b.fromY = nearestOpp.y;
          b.toX = clearX;
          b.toY = clearY;
          b.curve = 0;
          b.maxZ = 7.2;
          b.progress = 0;
          b.duration = 0.42;
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = outlet.id;
          b.lastPasserId = null;
          b.bounceNext = {
            carrierId: outlet.id,
            possessionSide: defSide,
            phaseLabel: `🛡️ ${nearestOpp.shortName} เทกตัวโหม่งแย่งได้!`,
            phaseTone: 'normal'
          };
          w.phaseLabel = `🛡️ ${nearestOpp.shortName} โหม่งสกัดบอลโด่ง!`;
          w.phaseTone = 'normal';
          SFX.header();
          return;
        }
      }

      const lastPasser = b.lastPasserId ? w.agents.find((a) => a.id === b.lastPasserId) : undefined;
      const passerSkill = b.flightType === 'lofted' ? (lastPasser?.d.lpass ?? 60) : (lastPasser?.d.spass ?? 60);
      const passerBlessed = (lastPasser?.blessedMins ?? 0) > 0;
      const oppBlessed = (nearestOpp?.blessedMins ?? 0) > 0;
      const interceptReach = agentHasTrait(nearestOpp, 'interception_hawk') || oppBlessed ? 5.0 : 4.2;
      const rawInterceptProb =
        oppDist < interceptReach
          ? clamp(
              0.16 +
                (((nearestOpp?.sig === 'rd' ? (nearestOpp?.d.rd || 60) + 8 : nearestOpp?.d.rd || 60) + (agentHasTrait(nearestOpp, 'interception_hawk') ? 14 : 0) + (oppBlessed ? 16 : 0) - 60) * 0.004) -
                ((passerSkill - 60) * 0.0018) +
                (agentHasTrait(nearestOpp, 'pressing_machine') ? 0.04 : 0) +
                (oppBlessed ? 0.14 : 0) +
                (b.flightType === 'through' ? 0.14 : b.flightType === 'lofted' ? -0.05 : b.flightType === 'onetwo' ? -0.04 : 0),
              0.06,
              0.58
            )
          : 0;
      const interceptProb = clamp(
        rawInterceptProb *
          (passerBlessed ? 0.35 : 1) *
          (b.flightType === 'lofted' ? 1 : turfMatchMods.interceptChaosMult) *
          getSideFacMods(defSide).interceptionMult,
        0.04,
        0.64
      );
      if (nearestOpp && oppDist < interceptReach && Math.random() < interceptProb) {
        adjustLiveForm(nearestOpp.id, 0.14);
        bumpPlayerStat(nearestOpp.id, 'tackles');
        bumpPlayerStat(nearestOpp.id, 'interceptions');
        adjustLiveForm(b.lastPasserId, -0.07);
        b.possessionSide = defSide;
        b.lastPasserId = null;
        b.shotStyle = undefined;
        if (oppDist > 2.4) {
          nearestOpp.tx = b.toX;
          nearestOpp.ty = b.toY;
          nearestOpp.intent = 'PASS_TARGET';
          b.fromX = b.toX;
          b.fromY = b.toY;
          b.toX = clamp((b.toX + nearestOpp.x) * 0.5, 4, 96);
          b.toY = clamp((b.toY + nearestOpp.y) * 0.5, 5, 95);
          b.curve = 0;
          b.maxZ = 0.25;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = clamp(oppDist / 24, 0.15, 0.24);
          b.flightType = 'bounce';
          b.carrierId = null;
          b.targetId = nearestOpp.id;
          b.bounceNext = {
            carrierId: nearestOpp.id,
            possessionSide: defSide,
            phaseLabel: `🔀 ${nearestOpp.shortName}${agentHasTrait(nearestOpp, 'interception_hawk') ? ' [เหยี่ยวดักบอล]' : ''} อ่านทางบอลดักตัดไว้ได้!`,
            phaseTone: 'normal'
          };
        } else {
          b.carrierId = nearestOpp.id;
          b.targetId = null;
          b.x = nearestOpp.x;
          b.y = nearestOpp.y;
          b.fromX = b.x;
          b.fromY = b.y;
          b.toX = b.x;
          b.toY = b.y;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = 0.16;
          b.flightType = 'carry';
        }
        w.phaseLabel = `🔀 ${nearestOpp.shortName}${agentHasTrait(nearestOpp, 'interception_hawk') ? ' [เหยี่ยวดักบอล]' : ''} อ่านทางบอลดักตัดไว้ได้!`;
        w.phaseTone = 'normal';
        SFX.tackle(false);
        return;
      }

      if (b.flightType === 'onetwo' && receiver) {
        const passer = active.find((a) => a.id === b.lastPasserId && a.id !== receiver.id);
        if (passer) {
          const defPoolNow = active.filter((a) => a.side === defSide);
          const offChk = checkPassOffside(w, side, receiver, passer, defPoolNow);
          if (offChk.isOffside) {
            if (Math.random() < 0.35) {
              triggerOffsideCall(w, curMin, side, receiver, passer, offChk.oppLineX, 'through', 'วิ่งล้ำหน้าจังหวะชิ่งคืน 1-2');
              return;
            }
            // Passer is offside: receiver controls cleanly instead of snapping passer back
          } else {
            const destX = clamp(passer.runToX ?? passer.tx, 6, 94);
            const destY = clamp(passer.runToY ?? passer.ty, 8, 92);
            b.fromX = receiver.x;
            b.fromY = receiver.y;
            b.toX = destX;
            b.toY = destY;
            b.curve = 0;
            b.maxZ = 0;
            b.startZ = 0;
            b.endZ = 0;
            b.progress = 0;
            b.duration = 0.34 / turfMatchMods.passPaceMult;
            b.flightType = 'through';
            b.shotStyle = undefined;
            b.carrierId = null;
            b.targetId = passer.id;
            b.lastPasserId = receiver.id;
            passer.tx = destX;
            passer.ty = destY;
            passer.intent = 'PASS_TARGET';
            bumpPlayerStat(receiver.id, 'crossAssists');
            addWorldFx(w, {
              type: 'through',
              x: receiver.x,
              y: receiver.y,
              toX: destX,
              toY: destY,
              label: `👟 ชิ่งคืนสวย!`,
              color: '#34d399',
              ttl: 1.35,
              maxTtl: 1.35
            });
            w.phaseLabel = `👟 ${receiver.shortName} ชิ่งคืนทะลุช่องให้ ${passer.shortName}!`;
            w.phaseTone = 'attack';
            SFX.pass();
            return;
          }
        }
      }

      if (receiver) {
        if (recDist > 2.8) {
          receiver.tx = b.toX;
          receiver.ty = b.toY;
          receiver.intent = 'PASS_TARGET';
          b.fromX = b.toX;
          b.fromY = b.toY;
          b.toX = clamp((b.toX + receiver.x) * 0.5, 4, 96);
          b.toY = clamp((b.toY + receiver.y) * 0.5, 5, 95);
          b.curve = 0;
          b.maxZ = 0.25;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = clamp(recDist / 28, 0.16, 0.32);
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = receiver.id;
          b.bounceNext = {
            carrierId: receiver.id,
            possessionSide: side
          };
        } else {
          b.carrierId = receiver.id;
          b.targetId = null;
          b.x = receiver.x;
          b.y = receiver.y;
          b.fromX = b.x;
          b.fromY = b.y;
          b.toX = b.x;
          b.toY = b.y;
          b.startZ = 0;
          b.endZ = 0;
          b.progress = 0;
          b.duration = 0.16;
          b.flightType = 'carry';
          b.shotStyle = undefined;
        }
      }
    } else if (b.flightType === 'carry') {
      const pendingShot = b.bounceNext?.pendingShot;
      if (pendingShot) {
        b.bounceNext = undefined;
        const shooter = active.find((a) => a.id === pendingShot.shooterId);
        if (shooter) {
          const attRightNow = isAttackRight(w, pendingShot.side);
          const sGoalX = attRightNow ? 100 : 0;
          const sDefPool = active.filter((a) => a.side !== pendingShot.side);
          const sNearestDef = sDefPool
            .filter((d) => d.pos !== 'GK')
            .sort((u, v) => Math.hypot(u.x - shooter.x, u.y - shooter.y) - Math.hypot(v.x - shooter.x, v.y - shooter.y))[0];
          const sNearestDefDist = sNearestDef ? Math.hypot(sNearestDef.x - shooter.x, sNearestDef.y - shooter.y) : 99;
          if (shouldShooterWhiff(w, shooter, sNearestDefDist, pendingShot.shotStyle || 'normal', false)) {
            launchWhiffLooseBall(
              w,
              curMin,
              pendingShot.side,
              shooter,
              pendingShot.side === 'H' ? homeOrig : awayOrig,
              sDefPool,
              attRightNow,
              'กระชากหาจังหวะยิงได้สวยแต่ดันเตะวืด!'
            );
            return;
          }
          prepareShotFlight(w, curMin, {
            flightType: 'shot',
            side: pendingShot.side,
            fromX: shooter.x,
            fromY: shooter.y,
            shooter,
            shotStyle: pendingShot.shotStyle,
            curveAmt: pendingShot.curveAmt,
            maxZAmt: pendingShot.maxZAmt,
            durAmt: clamp(Math.hypot(sGoalX - shooter.x, 50 - shooter.y) / 35, 0.48, 0.78)
          });
          w.phaseLabel = pendingShot.shotLabel;
          w.phaseTone = 'danger';
          triggerDramaSlow(w, 1.4, pendingShot.dramaLabel);
          SFX.shot();
          SFX.cheer(0.68);
          pushLog(curMin, pendingShot.logLine);
          return;
        }
      }
      // Carry ended cleanly, keep carrier ready for next decision
      b.progress = 1;
    }
  };

  const triggerFortuneAndMiraclesForMinute = (w: LiveMatchWorld, curMin: number, isInstant: boolean) => {
    const sr = simRef.current;
    sr.maxDeficitH = Math.max(sr.maxDeficitH, sr.ga - sr.gh);
    sr.maxDeficitA = Math.max(sr.maxDeficitA, sr.gh - sr.ga);

    // Tick down active divine blessings & temporary God Power (+50)
    w.agents.forEach((ag) => {
      if ((ag.godPowerMins ?? 0) > 0) {
        ag.godPowerMins = Math.max(0, (ag.godPowerMins ?? 0) - 1);
        if (ag.godPowerMins === 0) {
          if (ag.godPowerOrigD) {
            ag.d = { ...ag.godPowerOrigD };
            ag.godPowerOrigD = undefined;
          }
          if (ag.godPowerOrigOv != null) {
            ag.ov = ag.godPowerOrigOv;
            ag.godPowerOrigOv = undefined;
          }
          pushLog(curMin, `⚡ หมดเวลาพลังเทพ +50 ชั่วคราวของ ${ag.shortName}`, 'sys');
        }
      }
      if ((ag.blessedMins ?? 0) > 0) {
        ag.blessedMins = Math.max(0, (ag.blessedMins ?? 0) - 1);
        if (ag.blessedMins === 0) ag.blessedTag = undefined;
      }
    });

    // Tick down active miracle surge
    if (w.miracle && w.miracle.minsLeft > 0) {
      w.miracle.minsLeft = Math.max(0, w.miracle.minsLeft - 1);
      if (w.miracle.minsLeft === 0) {
        const mTeam = w.miracle.side === 'H' ? homeOrig : awayOrig;
        pushLog(curMin, `🔥 จบช่วงพายุโหมบุกปาฏิหาริย์ของ ${mTeam.name}`, 'sys');
        w.miracle = null;
      }
    }

    if (getModRealismSettings().disableSupernatural) {
      return;
    }

    // 1. Miracle Comeback Surge ("โหมดปาฏิหาริย์ / พลิกนรก") — sustained comeback storm when trailing by 2+ (or 3+ hell-flip!)
    if (!w.miracle && curMin >= 25 && curMin <= 89) {
      (['H', 'A'] as const).forEach((mSide) => {
        if (w.miracle) return;
        const alreadyUsed = mSide === 'H' ? sr.miracleUsedH : sr.miracleUsedA;
        if (alreadyUsed) return;
        const deficit = mSide === 'H' ? sr.ga - sr.gh : sr.gh - sr.ga;
        if (deficit < 2) return;
        const mPool = w.agents.filter((a) => !a.sentOff && a.side === mSide);
        const hasClutch = mPool.some((a) => a.tr === 4 || a.tr === 9 || a.tr === 17);
        const isHellFlip = deficit >= 3;
        const baseMirProb =
          deficit >= 4
            ? curMin >= 50
              ? 0.145
              : 0.105
            : isHellFlip
              ? curMin >= 55
                ? 0.115
                : 0.082
              : curMin >= 60
                ? 0.085
                : 0.052;
        if (Math.random() < baseMirProb + (hasClutch ? (isHellFlip ? 0.025 : 0.015) : 0)) {
          if (mSide === 'H') sr.miracleUsedH = true;
          else sr.miracleUsedA = true;
          // Long, sustained surge so comebacks actually have time to play out (runs all the way into stoppage time if triggered in 2nd half!)
          const rawDur = isHellFlip ? R(30, 42) : R(24, 34);
          const minToFinish = (isHellFlip && curMin >= 50) || (!isHellFlip && curMin >= 58) ? Math.max(18, 96 - curMin) : 0;
          const minsDur = Math.max(rawDur, minToFinish);
          w.miracle = { side: mSide, minsLeft: minsDur, maxDeficit: deficit, goalsDuring: 0 };
          const mTeam = mSide === 'H' ? homeOrig : awayOrig;

          // Deep adrenaline stamina lift + bless 2-3 key outfielders aligned with the miracle storm!
          const blessCount = isHellFlip ? 3 : 2;
          const blessDur = Math.min(minsDur, isHellFlip ? 26 : 20);
          const blessedPool = mPool
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => ((u.pos === 'FW' ? 1 : 0) - (v.pos === 'FW' ? 1 : 0)) * -1 || Math.random() - 0.5)
            .slice(0, blessCount);
          blessedPool.forEach((ag) => {
            ag.blessedMins = Math.max(ag.blessedMins || 0, blessDur);
            ag.blessedTag = ag.pos === 'FW' ? (isHellFlip ? 'พลิกนรก' : 'ยิงคม') : ag.pos === 'MF' ? 'กลางเทพ' : ag.pos === 'GK' ? 'เซฟเทพ' : 'ใจสู้';
            adjustLiveForm(ag.id, isHellFlip ? 0.5 : 0.38);
          });
          mPool.forEach((ag) => {
            sr.liveFit[ag.id] = clamp((sr.liveFit[ag.id] ?? ag.fit) + (isHellFlip ? 16 : 11), 35, 100);
            ag.fit = sr.liveFit[ag.id];
          });

          const hero = blessedPool[0] || mPool[0];
          if (hero && !isInstant) {
            for (let i = 0; i < (isHellFlip ? 22 : 16); i++) {
              const ang = (Math.PI * 2 * i) / (isHellFlip ? 22 : 16);
              const spd = 7 + Math.random() * 15;
              w.sparkles.push({
                x: hero.x,
                y: hero.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                color: isHellFlip ? (i % 2 === 0 ? '#ef4444' : '#facc15') : i % 2 === 0 ? '#facc15' : '#34d399',
                size: 2.2 + Math.random() * 2,
                ttl: 1.9,
                maxTtl: 1.9
              });
            }
            addWorldFx(w, {
              type: 'skill',
              x: hero.x,
              y: hero.y,
              label: isHellFlip ? `🌋 พลิกนรก!! ${mTeam.name}` : `⚡ ปาฏิหาริย์! ${mTeam.name}`,
              color: isHellFlip ? '#f97316' : '#facc15',
              ttl: 3.0,
              maxTtl: 3.0
            });
            triggerDramaSlow(
              w,
              isHellFlip ? 1.9 : 1.6,
              isHellFlip
                ? `🌋🔥 ปาฏิหาริย์พลิกนรก!! ${mTeam.name} ทุ่มสุดชีวิตโหมบุกต่อเนื่อง!`
                : `⚡🔥 โหมดปาฏิหาริย์!! ${mTeam.name} ฮึดสู้ลุ้นพลิกเกม!`
            );
            triggerCoachShout(w, mSide, isHellFlip ? '🌋 บุกเต็มสูบ! พลิกนรก!' : '⚡ สู้ตาย!! พลิกเกม!', 3.6);
            SFX.cheer(isHellFlip ? 1.0 : 0.95);
          }
          pushLog(
            curMin,
            isHellFlip
              ? `🌋🔥 ปาฏิหาริย์พลิกนรก!! ${mTeam.name} (ตามหลัง ${deficit} ประตู) ระเบิดพลังฮึดสู้เต็มพิกัด ลุ้นโกงความตายต่อเนื่องตลอด ${minsDur} นาที!`
              : `⚡🔥 โหมดปาฏิหาริย์!! ${mTeam.name} (ตามหลัง ${deficit} ประตู) ระเบิดพลังโหมบุกต่อเนื่องลุ้นพลิกเกมใน ${minsDur} นาทีนี้!`,
            'goal'
          );
          pushTimeline(curMin, mSide, 'miracle', mTeam.name, isHellFlip ? `พลิกนรก! (ตาม ${deficit} ลูก)` : `ฮึดปาฏิหาริย์ (ตาม ${deficit} ลูก)`);
        }
      });
    }

    // 2. Divine Fortune / Blessed Player ("พรสิ่งศักดิ์สิทธิ์") — favors underdogs / disadvantaged clubs more often
    const activeAgentsAll = w.agents.filter((a) => !a.sentOff);
    const blessedNowCount = activeAgentsAll.filter((a) => (a.blessedMins ?? 0) > 0).length;
    if (curMin >= 5 && blessedNowCount < 2) {
      const blessRollChance = blessedNowCount === 0 && curMin >= 16 ? 0.12 : 0.07;
      if (Math.random() < blessRollChance) {
        const hPowRate = baseTeamRates.home;
        const aPowRate = baseTeamRates.away;
        const powGap = aPowRate.at + aPowRate.df - (hPowRate.at + hPowRate.df);
        const redH = w.agents.filter((a) => a.sentOff && a.side === 'H').length;
        const redA = w.agents.filter((a) => a.sentOff && a.side === 'A').length;
        const disadvH = clamp(powGap * 0.016, -0.18, 0.18) + clamp((sr.ga - sr.gh) * 0.10, -0.18, 0.18) + clamp((redH - redA) * 0.14, -0.18, 0.18);
        const pickHProb = clamp(0.5 + disadvH, 0.15, 0.85);
        const bSide: 'H' | 'A' = Math.random() < pickHProb ? 'H' : 'A';
        const candidates = activeAgentsAll.filter((a) => a.side === bSide && (a.blessedMins ?? 0) === 0);
        if (candidates.length) {
          const picked = P(candidates);
          const minsDur = R(7, 12);
          const tagByPos =
            picked.pos === 'GK'
              ? 'เซฟเทพ'
              : picked.pos === 'DF'
                ? 'รับแกร่ง'
                : picked.pos === 'MF'
                  ? 'กลางเทพ'
                  : 'ยิงคม';
          picked.blessedMins = minsDur;
          picked.blessedTag = tagByPos;
          adjustLiveForm(picked.id, 0.35);
          const bTeam = bSide === 'H' ? homeOrig : awayOrig;
          if (!isInstant) {
            addWorldFx(w, {
              type: 'skill',
              x: picked.x,
              y: picked.y,
              label: `✨ ${picked.shortName} · ${tagByPos}`,
              color: '#fde047',
              ttl: 2.3,
              maxTtl: 2.3
            });
            triggerCoachShout(w, bSide, `✨ ${picked.shortName} เข้าฝัก!`, 2.4);
          }
          pushLog(
            curMin,
            `✨ พร: ${picked.id} (${bTeam.name}) [${tagByPos}] ${minsDur}'`,
            'sys'
          );
          if (picked.isMe || blessedNowCount === 0) {
            pushTimeline(curMin, bSide, 'blessed', picked.id, tagByPos);
          }
        }
      }
    }

    // 3. God Power Lightning Strike ("พลังเทพ +50") — sky lightning strikes a player on pitch for +50 temporary attributes!
    const godActiveNow = activeAgentsAll.some((a) => (a.godPowerMins ?? 0) > 0);
    if (curMin >= 10 && curMin <= 86 && !godActiveNow && sr.godPowerStrikes < 2) {
      const strikeChance = sr.godPowerStrikes === 0 && curMin >= 22 ? 0.045 : 0.025;
      if (Math.random() < strikeChance) {
        const candidates = activeAgentsAll.filter((a) => (a.godPowerMins ?? 0) === 0);
        if (candidates.length) {
          const picked = P(candidates);
          const minsDur = R(6, 10);
          sr.godPowerStrikes += 1;
          if (!picked.godPowerOrigD) picked.godPowerOrigD = { ...picked.d };
          if (picked.godPowerOrigOv == null) picked.godPowerOrigOv = picked.ov;
          const boostedD: Record<string, number> = {};
          Object.keys(picked.godPowerOrigD).forEach((k) => {
            boostedD[k] = clamp((picked.godPowerOrigD![k] || 50) + 50, 1, 199);
          });
          picked.d = boostedD;
          picked.ov = clamp((picked.godPowerOrigOv || picked.ov) + 50, 1, 199);
          picked.godPowerMins = minsDur;
          picked.blessedMins = Math.max(picked.blessedMins || 0, minsDur);
          picked.blessedTag = 'พลังเทพ +50';
          adjustLiveForm(picked.id, 0.75);
          const gTeam = picked.side === 'H' ? homeOrig : awayOrig;
          if (!isInstant) {
            for (let i = 0; i < 24; i++) {
              const ang = (Math.PI * 2 * i) / 24;
              const spd = 9 + Math.random() * 18;
              w.sparkles.push({
                x: picked.x,
                y: picked.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#38bdf8' : '#fde047',
                size: 2.4 + Math.random() * 2.2,
                ttl: 1.6,
                maxTtl: 1.6
              });
            }
            addWorldFx(w, {
              type: 'lightning',
              x: picked.x,
              y: picked.y,
              label: `⚡ ฟ้าผ่า! ${picked.shortName} พลังเทพ +50`,
              color: '#38bdf8',
              ttl: 2.5,
              maxTtl: 2.5
            });
            triggerDramaSlow(w, 1.85, `⚡🌩️ เปรี้ยง!! ฟ้าผ่าโดน ${picked.shortName} ได้รับพลังเทพชั่วคราว +50!`);
            triggerCoachShout(w, picked.side, `⚡ ${picked.shortName} ร่างเทพ +50!!`, 3.2);
            SFX.thunder();
            vibrate([40, 25, 65]);
          }
          pushLog(
            curMin,
            `⚡🌩️ เปรี้ยง!! ฟ้าผ่ากลางสนามโดน ${picked.id} (${gTeam.name}) ได้รับค่าพลังเทพชั่วคราว +50 นาน ${minsDur} นาที!`,
            'goal'
          );
          pushTimeline(curMin, picked.side, 'god_power', picked.id, `พลังเทพ +50 (${minsDur}')`);
        }
      }
    }
  };

  // Synchronous instant minute resolver (used when clicking "ข้ามจบเกม")
  const stepInstantMinute = (curMin: number, curTac: Mentality) => {
    const sr = simRef.current;
    const w = worldRef.current!;
    triggerFortuneAndMiraclesForMinute(w, curMin, true);

    // Drain stamina & update live match form (scaled by tactical pressing & tempo)
    const hCfgMin = getEffectiveTeamCfg('H', curMin);
    const aCfgMin = getEffectiveTeamCfg('A', curMin);
    const sentOffSet = new Set(sr.sentOff);
    const homeLuSet = new Set(sr.homeLu);
    const processFitForSide = (lu: string[], isH: boolean) => {
      const sideCfg = isH ? hCfgMin : aCfgMin;
      const sideFacMods = getSideFacMods(isH ? 'H' : 'A');
      const gd = isH ? sr.gh - sr.ga : sr.ga - sr.gh;
      for (const n of lu) {
        if (sentOffSet.has(n)) continue;
        const pl = playerByNameMap.get(n);
        if (!pl) continue;
        const D = DT(pl, state.p);
        const plTraits = pl.traits || [];
        const staBonus = (D.sig === 'sta' ? 0.82 : 1) * (D.tr === 2 || D.tr === 18 ? 0.72 : D.tr === 19 ? 1.18 : 1) * (plTraits.includes('box_to_box_engine') ? 0.86 : 1);
        const pressLoad = pl.pos === 'GK' ? 1 : 0.82 + (sideCfg.press + sideCfg.tempo) * 0.11 + (sideCfg.tac === 'X' ? 0.14 : sideCfg.tac === 'Z' ? -0.07 : 0);
        const drain =
          (0.34 - (D.d.sta - 65) * 0.0022) *
          staBonus *
          pressLoad *
          turfMatchMods.fatigueMult *
          sideFacMods.fatigueDrainMult *
          (pl.pos === 'GK' ? 0.25 : 1);
        sr.liveFit[n] = clamp((sr.liveFit[n] ?? 100) - Math.max(0.1, drain), 18, 100);
        const curFit = sr.liveFit[n];
        let formDelta = gd > 0 ? 0.01 : gd < 0 ? -0.015 : 0;
        if ((D.tr === 4 || D.tr === 9 || D.tr === 17) && curMin >= 70) formDelta += 0.015;
        if (curFit < 48) formDelta -= D.tr === 23 ? 0.03 : 0.055;
        else if (curFit < 58) formDelta -= D.tr === 23 ? 0.012 : 0.025;
        if (Math.random() < 0.22) formDelta += (Math.random() - 0.52) * (D.tr === 23 ? 0.07 : 0.12);
        if (formDelta !== 0) adjustLiveForm(n, formDelta);
        if (curFit < 56 && pl.pos !== 'GK' && Math.random() < 0.08) {
          const ag = w.agents.find((a) => a.id === n);
          if (ag) tryTriggerInMatchInjury(w, ag, curMin, 'fatigue', true);
        }
      }
    };
    void homeLuSet;
    processFitForSide(sr.homeLu, true);
    processFitForSide(sr.awayLu, false);

    const runAiSubForSide = (isHomeSide: boolean) => {
      const sideOrig = isHomeSide ? homeOrig : awayOrig;
      const isUserTeamInMgr = state.mode === 'm' && sideOrig.id === state.me;
      if (isUserTeamInMgr) return;
      const schedule = isHomeSide ? sr.aiSubMinH : sr.aiSubMinA;
      if (!schedule.includes(curMin)) return;
      const subsCount = isHomeSide ? sr.homeSubsCount : sr.awaySubsCount;
      if (subsCount >= 4) return;
      const curLu = isHomeSide ? sr.homeLu : sr.awayLu;
      const curPlayed = isHomeSide ? sr.homePlayed : sr.awayPlayed;
      const availableBench = sideOrig.sq
        .filter((q) => !curPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n))
        .sort((a, b) => {
          const sa = a.ov * ((a.fit ?? 100) >= 72 ? 1 : 0.68) * (0.8 + 0.2 * ((a.fit ?? 100) / 100));
          const sb = b.ov * ((b.fit ?? 100) >= 72 ? 1 : 0.68) * (0.8 + 0.2 * ((b.fit ?? 100) / 100));
          return sb - sa;
        });
      if (!availableBench.length) return;
      const onPitchPlayers = curLu
        .map((n) => sideOrig.sq.find((q) => q.n === n))
        .filter((q): q is Player => Boolean(q))
        .filter((q) => !sr.sentOff.includes(q.n) && q.pos !== 'GK');
      if (!onPitchPlayers.length) return;

      let outPlayer: Player | undefined;
      let inPlayer: Player | undefined;
      if (isPlayerMode && sideOrig.id === state.me && !myInitialBanned && myPlayerSquadObj) {
        const userCurrentlyOnPitch = curLu.includes(myPlayerName) && !sr.sentOff.includes(myPlayerName);
        if (!userCurrentlyOnPitch && !curPlayed.includes(myPlayerName) && myPlayerSquadObj.pos !== 'GK' && availableBench.some((b) => b.n === myPlayerName)) {
          inPlayer = myPlayerSquadObj;
          outPlayer =
            onPitchPlayers.filter((q) => q.pos === inPlayer!.pos).sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.liveFit[b.n] ?? 100))[0] ||
            onPitchPlayers.sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.liveFit[b.n] ?? 100))[0];
          if (outPlayer && inPlayer) sr.userSubInMin = curMin;
        } else if (userCurrentlyOnPitch && ((sr.liveFit[myPlayerName] ?? 100) < 52 || (curMin >= 74 && Math.random() < 0.25))) {
          const userObj = onPitchPlayers.find((q) => q.n === myPlayerName);
          if (userObj) {
            outPlayer = userObj;
            inPlayer = availableBench.find((b) => b.pos === userObj.pos) || availableBench.find((b) => b.pos !== 'GK');
            if (inPlayer) sr.userSubOutMin = curMin;
          }
        }
      }
      if (!outPlayer || !inPlayer) {
        outPlayer = onPitchPlayers.slice().sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.yellows[a.n] || 0) * 18 - ((sr.liveFit[b.n] ?? 100) - (sr.yellows[b.n] || 0) * 18))[0];
        if (!outPlayer) return;
        inPlayer = availableBench.find((b) => b.pos === outPlayer!.pos) || availableBench.find((b) => b.pos !== 'GK');
      }
      if (!outPlayer || !inPlayer) return;
      const idx = curLu.indexOf(outPlayer.n);
      if (idx < 0) return;
      curLu[idx] = inPlayer.n;
      if (!curPlayed.includes(inPlayer.n)) curPlayed.push(inPlayer.n);
      if (sr.liveForm[inPlayer.n] == null) sr.liveForm[inPlayer.n] = 6.5;
      if (isHomeSide) sr.homeSubsCount++;
      else sr.awaySubsCount++;
      const subEv: MatchSubEvent = { m: curMin, t: sideOrig.id, inPlayer: inPlayer.n, outPlayer: outPlayer.n };
      sr.subs.push(subEv);
      // Sync live pitch agent
      const agIdx = w.agents.findIndex((a) => a.id === outPlayer!.n);
      if (agIdx >= 0) {
        const effSideTeam = isHomeSide ? getLiveHomeTeam() : getLiveAwayTeam();
        const rep = buildTeamAgents(effSideTeam, isHomeSide ? 'H' : 'A', curLu, w.secondHalf);
        if (rep[idx]) {
          rep[idx].x = w.agents[agIdx].x;
          rep[idx].y = w.agents[agIdx].y;
          w.agents[agIdx] = rep[idx];
        }
      }
      const isMeIn = isPlayerMode && inPlayer.n === myPlayerName;
      const isMeOut = isPlayerMode && outPlayer.n === myPlayerName;
      syncSidelineBenches(w);
      pushTimeline(curMin, isHomeSide ? 'H' : 'A', 'sub', inPlayer.n, outPlayer.n);
      pushLog(curMin, `🔄 เปลี่ยนตัว (${sideOrig.name}): 🔼 เข้า ${inPlayer.n}${isMeIn ? ' (คุณ!)' : ''} · 🔽 ออก ${outPlayer.n}${isMeOut ? ' (คุณ)' : ''}`, 'sub', {
        subInfo: { teamId: sideOrig.id, inName: inPlayer.n, outName: outPlayer.n, isMeIn, isMeOut }
      });
      ensureOnPitchCaptain(w, isHomeSide ? 'H' : 'A', curMin, 'sub', true);
    };

    runAiSubForSide(true);
    runAiSubForSide(false);
    if (curMin >= 25 && curMin <= 38) {
      maybeAiLiveCoachAdjust(w, 'H', curMin, 'early', true);
      maybeAiLiveCoachAdjust(w, 'A', curMin, 'early', true);
    }
    if (curMin >= 62 && curMin <= 78) {
      maybeAiLiveCoachAdjust(w, 'H', curMin, 'late', true);
      maybeAiLiveCoachAdjust(w, 'A', curMin, 'late', true);
    }
    if (state.mode === 'm' && autoSubEnabledRef.current && !sr.done) {
      runAutoUserSubs(w, sr, curMin);
      runAutoOnPitchRebalance(w, sr, curMin);
    }

    // Auto-tactical rules
    if (state.mode === 'm' && state.rules && state.rules.length) {
      const myGoals = meIsHome ? sr.gh : sr.ga;
      const oppGoals = meIsHome ? sr.ga : sr.gh;
      state.rules.forEach((rule, idx) => {
        if (triggeredRulesRef.current.includes(idx) || curMin < rule.min) return;
        const condMet =
          (rule.c === 'tr' && myGoals < oppGoals) ||
          (rule.c === 'dr' && myGoals === oppGoals) ||
          (rule.c === 'ld' && myGoals > oppGoals) ||
          (rule.c === 'rc' && curMin >= rule.min);
        if (condMet) {
          triggeredRulesRef.current.push(idx);
          if (curTac !== rule.tac) {
            liveTacticsRef.current.tac = rule.tac;
            if (!isSkippingRef.current) setLiveTac(rule.tac);
            pushLog(curMin, `⚙️ แผนอัตโนมัติทำงาน: ปรับแท็กติกเป็น "${AR_T[rule.tac]}"`, 'sys');
          }
        }
      });
    }

    // Fast-forward 4 tactical plays for this minute inside world
    clearWorldCelebration(w, 'SUPPORT');
    w.pendingSetPiece = null;
    updateAgentTargets(w, curMin);
    w.agents.forEach((a) => {
      if (!a.sentOff) {
        a.x = a.x * 0.4 + a.tx * 0.6;
        a.y = a.y * 0.4 + a.ty * 0.6;
      }
    });
    for (let k = 0; k < 4; k++) {
      const curSp = (w as LiveMatchWorld).pendingSetPiece;
      if (curSp && curSp.waitSec > 0) {
        const rem = 4 - k;
        w.possTicksTotal += rem;
        if (w.ball.possessionSide === 'H') w.possTicksH += rem;
        break;
      }
      scheduleNextPlay(w, curMin);
      if (w.varReview) resolveVarReview(w, curMin);
      w.ball.x = w.ball.toX;
      w.ball.y = w.ball.toY;
      w.ball.progress = 1;
      resolveSegmentArrival(w, curMin);
      let chainGuard = 0;
      while ((w.ball.flightType === 'bounce' || Boolean(w.ball.bounceNext?.isOffsideCall) || Boolean(w.ball.bounceNext?.pendingShot) || (w.ball.flightType === 'shot' && w.ball.progress === 0)) && chainGuard < 6) {
        chainGuard++;
        w.ball.x = w.ball.toX;
        w.ball.y = w.ball.toY;
        w.ball.progress = 1;
        resolveSegmentArrival(w, curMin);
      }
      if (w.varReview) resolveVarReview(w, curMin);
      w.possTicksTotal++;
      if (w.ball.possessionSide === 'H') w.possTicksH++;
    }
  };

  // Run minute-level maintenance (stamina, AI subs, auto rules) during real-time animation
  const onMinuteTick = (curMin: number) => {
    const sr = simRef.current;
    const w = worldRef.current!;
    triggerFortuneAndMiraclesForMinute(w, curMin, false);

    const hCfgMin = getEffectiveTeamCfg('H', curMin);
    const aCfgMin = getEffectiveTeamCfg('A', curMin);
    [...sr.homeLu, ...sr.awayLu].forEach((n) => {
      if (sr.sentOff.includes(n)) return;
      const isH = sr.homeLu.includes(n);
      const sideCfg = isH ? hCfgMin : aCfgMin;
      const pl = homeOrig.sq.find((q) => q.n === n) || awayOrig.sq.find((q) => q.n === n);
      if (!pl) return;
      const D = DT(pl, state.p);
      const plTraits = pl.traits || [];
      const staBonus = (D.sig === 'sta' ? 0.82 : 1) * (D.tr === 2 || D.tr === 18 ? 0.72 : D.tr === 19 ? 1.18 : 1) * (plTraits.includes('box_to_box_engine') ? 0.86 : 1);
      const pressLoad = pl.pos === 'GK' ? 1 : 0.82 + (sideCfg.press + sideCfg.tempo) * 0.11 + (sideCfg.tac === 'X' ? 0.14 : sideCfg.tac === 'Z' ? -0.07 : 0);
      const sideFacMods = getSideFacMods(isH ? 'H' : 'A');
      const drain =
        (0.34 - (D.d.sta - 65) * 0.0022) *
        staBonus *
        pressLoad *
        turfMatchMods.fatigueMult *
        sideFacMods.fatigueDrainMult *
        (pl.pos === 'GK' ? 0.25 : 1);
      sr.liveFit[n] = clamp((sr.liveFit[n] ?? 100) - Math.max(0.1, drain), 18, 100);
      const curFit = sr.liveFit[n];
      const gd = isH ? sr.gh - sr.ga : sr.ga - sr.gh;
      let formDelta = gd > 0 ? 0.01 : gd < 0 ? -0.015 : 0;
      if ((D.tr === 4 || D.tr === 9 || D.tr === 17) && curMin >= 70) formDelta += 0.015;
      if (curFit < 48) formDelta -= D.tr === 23 ? 0.03 : 0.055;
      else if (curFit < 58) formDelta -= D.tr === 23 ? 0.012 : 0.025;
      if (Math.random() < 0.22) formDelta += (Math.random() - 0.52) * (D.tr === 23 ? 0.07 : 0.12);
      if (formDelta !== 0) adjustLiveForm(n, formDelta);
      const ag = w.agents.find((a) => a.id === n);
      if (ag) ag.fit = sr.liveFit[n];
      if (curFit < 56 && pl.pos !== 'GK' && Math.random() < 0.08 && ag) {
        tryTriggerInMatchInjury(w, ag, curMin, 'fatigue', false);
      }
    });

    const runAiSubForSide = (isHomeSide: boolean) => {
      const sideOrig = isHomeSide ? homeOrig : awayOrig;
      const isUserTeamInMgr = state.mode === 'm' && sideOrig.id === state.me;
      if (isUserTeamInMgr) return;
      const schedule = isHomeSide ? sr.aiSubMinH : sr.aiSubMinA;
      if (!schedule.includes(curMin)) return;
      const subsCount = isHomeSide ? sr.homeSubsCount : sr.awaySubsCount;
      if (subsCount >= 4) return;
      const curLu = isHomeSide ? sr.homeLu : sr.awayLu;
      const curPlayed = isHomeSide ? sr.homePlayed : sr.awayPlayed;
      const availableBench = sideOrig.sq
        .filter((q) => !curPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n))
        .sort((a, b) => {
          const sa = a.ov * ((a.fit ?? 100) >= 72 ? 1 : 0.68) * (0.8 + 0.2 * ((a.fit ?? 100) / 100));
          const sb = b.ov * ((b.fit ?? 100) >= 72 ? 1 : 0.68) * (0.8 + 0.2 * ((b.fit ?? 100) / 100));
          return sb - sa;
        });
      if (!availableBench.length) return;
      const onPitchPlayers = curLu
        .map((n) => sideOrig.sq.find((q) => q.n === n))
        .filter((q): q is Player => Boolean(q))
        .filter((q) => !sr.sentOff.includes(q.n) && q.pos !== 'GK');
      if (!onPitchPlayers.length) return;

      let outPlayer: Player | undefined;
      let inPlayer: Player | undefined;
      if (isPlayerMode && sideOrig.id === state.me && !myInitialBanned && myPlayerSquadObj) {
        const userCurrentlyOnPitch = curLu.includes(myPlayerName) && !sr.sentOff.includes(myPlayerName);
        if (!userCurrentlyOnPitch && !curPlayed.includes(myPlayerName) && myPlayerSquadObj.pos !== 'GK' && availableBench.some((b) => b.n === myPlayerName)) {
          inPlayer = myPlayerSquadObj;
          outPlayer =
            onPitchPlayers.filter((q) => q.pos === inPlayer!.pos).sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.liveFit[b.n] ?? 100))[0] ||
            onPitchPlayers.sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.liveFit[b.n] ?? 100))[0];
          if (outPlayer && inPlayer) sr.userSubInMin = curMin;
        } else if (userCurrentlyOnPitch && ((sr.liveFit[myPlayerName] ?? 100) < 52 || (curMin >= 74 && Math.random() < 0.25))) {
          const userObj = onPitchPlayers.find((q) => q.n === myPlayerName);
          if (userObj) {
            outPlayer = userObj;
            inPlayer = availableBench.find((b) => b.pos === userObj.pos) || availableBench.find((b) => b.pos !== 'GK');
            if (inPlayer) sr.userSubOutMin = curMin;
          }
        }
      }
      if (!outPlayer || !inPlayer) {
        outPlayer = onPitchPlayers.slice().sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.yellows[a.n] || 0) * 18 - ((sr.liveFit[b.n] ?? 100) - (sr.yellows[b.n] || 0) * 18))[0];
        if (!outPlayer) return;
        inPlayer = availableBench.find((b) => b.pos === outPlayer!.pos) || availableBench.find((b) => b.pos !== 'GK');
      }
      if (!outPlayer || !inPlayer) return;
      const idx = curLu.indexOf(outPlayer.n);
      if (idx < 0) return;
      curLu[idx] = inPlayer.n;
      curPlayed.push(inPlayer.n);
      if (isHomeSide) sr.homeSubsCount++;
      else sr.awaySubsCount++;
      const subEv: MatchSubEvent = { m: curMin, t: sideOrig.id, inPlayer: inPlayer.n, outPlayer: outPlayer.n };
      sr.subs.push(subEv);

      const agIdx = w.agents.findIndex((a) => a.id === outPlayer!.n);
      let subbedAg: LivePitchAgent | undefined;
      if (agIdx >= 0) {
        const effSideTeam = isHomeSide ? getLiveHomeTeam() : getLiveAwayTeam();
        const rep = buildTeamAgents(effSideTeam, isHomeSide ? 'H' : 'A', curLu, w.secondHalf);
        if (rep[idx]) {
          rep[idx].x = w.agents[agIdx].x;
          rep[idx].y = w.agents[agIdx].y;
          rep[idx].facing = w.agents[agIdx].facing;
          w.agents[agIdx] = rep[idx];
          subbedAg = rep[idx];
        }
      }
      triggerSubPitchAnim(w, subbedAg, isHomeSide ? 'H' : 'A', sideOrig.name, inPlayer.n, outPlayer.n, curMin);
      const isMeIn = isPlayerMode && inPlayer.n === myPlayerName;
      const isMeOut = isPlayerMode && outPlayer.n === myPlayerName;
      pushTimeline(curMin, isHomeSide ? 'H' : 'A', 'sub', inPlayer.n, outPlayer.n);
      pushLog(curMin, `🔄 เปลี่ยนตัว (${sideOrig.name}): 🔼 เข้า ${inPlayer.n}${isMeIn ? ' (คุณ!)' : ''} · 🔽 ออก ${outPlayer.n}${isMeOut ? ' (คุณ)' : ''}`, 'sub', {
        subInfo: { teamId: sideOrig.id, inName: inPlayer.n, outName: outPlayer.n, isMeIn, isMeOut }
      });
      setLiveLu((meIsHome ? sr.homeLu : sr.awayLu).slice());
      setLiveOppLu((meIsHome ? sr.awayLu : sr.homeLu).slice());
      setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
      setSubLog(sr.subs.slice());
      syncSidelineBenches(w);
      triggerCoachShout(w, isHomeSide ? 'H' : 'A', '🔄 เปลี่ยนตัว!', 2.3);
      if (!w.pendingSetPiece && !w.varReview && w.celebrateTimer <= 0 && w.ball.flightType !== 'shot' && w.ball.flightType !== 'freekick' && w.ball.flightType !== 'penalty') {
        w.phaseLabel = `🔄 ${sideOrig.name}: 🔼 เข้า ${inPlayer.n.split(' ')[0]} · 🔽 ออก ${outPlayer.n.split(' ')[0]}`;
        w.phaseTone = 'normal';
      }
      ensureOnPitchCaptain(w, isHomeSide ? 'H' : 'A', curMin, 'sub', false);
    };

    runAiSubForSide(true);
    runAiSubForSide(false);
    if (curMin >= 25 && curMin <= 38) {
      maybeAiLiveCoachAdjust(w, 'H', curMin, 'early', false);
      maybeAiLiveCoachAdjust(w, 'A', curMin, 'early', false);
    }
    if (curMin >= 62 && curMin <= 78) {
      maybeAiLiveCoachAdjust(w, 'H', curMin, 'late', false);
      maybeAiLiveCoachAdjust(w, 'A', curMin, 'late', false);
    }

    // Smart Position-Matched Auto-Substitution & On-Pitch Role Rebalance for Manager Mode
    if (state.mode === 'm' && autoSubEnabledRef.current && !sr.done) {
      runAutoUserSubs(w, sr, curMin);
      runAutoOnPitchRebalance(w, sr, curMin);
    }

    if (state.mode === 'm' && state.rules && state.rules.length) {
      const myGoals = meIsHome ? sr.gh : sr.ga;
      const oppGoals = meIsHome ? sr.ga : sr.gh;
      state.rules.forEach((rule, idx) => {
        if (triggeredRulesRef.current.includes(idx) || curMin < rule.min) return;
        const condMet =
          (rule.c === 'tr' && myGoals < oppGoals) ||
          (rule.c === 'dr' && myGoals === oppGoals) ||
          (rule.c === 'ld' && myGoals > oppGoals) ||
          (rule.c === 'rc' && curMin >= rule.min);
        if (condMet) {
          triggeredRulesRef.current.push(idx);
          if (liveTacticsRef.current.tac !== rule.tac) {
            setLiveTac(rule.tac);
            triggerCoachShout(w, meIsHome ? 'H' : 'A', `📣 ${AR_T[rule.tac]}!`, 2.6);
            pushLog(curMin, `⚙️ แผนอัตโนมัติทำงาน: ปรับแท็กติกเป็น "${AR_T[rule.tac]}"`, 'sys');
          }
        }
      });
    }

    if (curMin >= 5 && curMin % 11 === 4 && w.sideline && !w.goalBanner && !w.varReview) {
      const talkSide: 'H' | 'A' = curMin % 22 === 4 ? 'H' : 'A';
      const gdSide = talkSide === 'H' ? sr.gh - sr.ga : sr.ga - sr.gh;
      const callMsg =
        gdSide < 0
          ? '🔥 ดันสูงขึ้นอีก!'
          : gdSide > 0
            ? '🛡️ คุมโซนให้แน่น!'
            : '📣 ไล่บอลเร็ว!';
      triggerCoachShout(w, talkSide, callMsg, 2.4);
    }

    const alertCfg = subAlertCfgRef.current;
    if (alertCfg.enabled && !sr.done) {
      const myOnPitch = meIsHome ? sr.homeLu : sr.awayLu;
      const mySubsUsedNow = sr.subs.filter((s) => s.t === meTeamOrig.id).length;
      if (state.mode === 'm' && mySubsUsedNow < 5) {
        myOnPitch.forEach((name) => {
          if (sr.sentOff.includes(name)) return;
          const pl = meTeamOrig.sq.find((q) => q.n === name);
          if (!pl) return;
          const fVal = Math.round(sr.liveFit[name] ?? pl.fit ?? 100);
          const fmVal = Number((sr.liveForm[name] ?? 6.5).toFixed(1));
          const lowFit = fVal <= alertCfg.fitTh;
          const lowForm = fmVal <= alertCfg.formTh;
          if (!lowFit && !lowForm) return;
          const logKey = `${name}:${lowFit ? 'fit' : ''}:${lowForm ? 'form' : ''}`;
          if (alertLoggedRef.current.has(logKey)) return;
          alertLoggedRef.current.add(logKey);
          const reasons: string[] = [];
          if (lowFit) reasons.push(`ความฟิตเหลือ ${fVal}% (เสี่ยงบาดเจ็บ)`);
          if (lowForm) reasons.push(`ฟอร์มตก ${fmVal.toFixed(1)}`);
          pushLog(curMin, `🩺 แจ้งเตือนเปลี่ยนตัว (${pl.ro} ${pl.n}): ${reasons.join(' · ')} — แนะนำพักเพื่อป้องกันบาดเจ็บ`, 'sys');
          SFX.tap();
          vibrate(35);
        });
      } else if (state.mode === 'p' && myPlayerName && myOnPitch.includes(myPlayerName) && !sr.sentOff.includes(myPlayerName)) {
        const myF = Math.round(sr.liveFit[myPlayerName] ?? 100);
        const myFm = Number((sr.liveForm[myPlayerName] ?? 6.5).toFixed(1));
        if (myF <= alertCfg.fitTh && !alertLoggedRef.current.has(`${myPlayerName}:pfit`)) {
          alertLoggedRef.current.add(`${myPlayerName}:pfit`);
          pushLog(curMin, `🩺 คำเตือนร่างกาย: ความฟิตคุณเหลือ ${myF}% เสี่ยงบาดเจ็บหากฝืนเร่งสปีดต่อเนื่อง`, 'sys');
        } else if (myFm <= alertCfg.formTh && !alertLoggedRef.current.has(`${myPlayerName}:pform`)) {
          alertLoggedRef.current.add(`${myPlayerName}:pform`);
          pushLog(curMin, `📉 ฟอร์มการเล่นของคุณตกลงมาที่ ${myFm.toFixed(1)} ต้องรีบเรียกจังหวะเกมกลับมา!`, 'sys');
        }
      }
    }

    setLiveFitMap({ ...sr.liveFit });
    setLiveFormMap({ ...sr.liveForm });
  };

  const buildBannerPayload = (w: LiveMatchWorld, slowMoOn: boolean) => {
    const hasBlockingCanvasBanner = Boolean(
      (w.goalBanner && w.goalBanner.ttl > 0) ||
        (w.cardBanner && w.cardBanner.ttl > 0) ||
        w.varReview
    );
    if (hasBlockingCanvasBanner) {
      return {
        label: '',
        tone: w.phaseTone,
        actors: [] as { id: string; shortName: string; side: 'H' | 'A' }[],
        teamSide: w.ball.possessionSide,
        sig: `suppressed|${w.phaseTone}|${w.ball.possessionSide}`
      };
    }
    const isSlowShot =
      w.ball.flightType === 'shot' ||
      w.ball.flightType === 'freekick' ||
      w.ball.flightType === 'penalty' ||
      w.ball.flightType === 'shootout_kick' ||
      (w.ball.flightType === 'bounce' && (Boolean(w.ball.bounceNext?.goalPayload) || Boolean(w.ball.bounceNext?.looseRebound)));
    const hasDrama = w.dramaSlowSec > 0 || isSlowShot;
    const baseBannerLabel =
      w.dramaLabel && w.dramaSlowSec > 0
        ? w.dramaLabel
        : w.phaseLabel || (isSlowShot ? '🎬 จังหวะสำคัญ · สโลว์โมชัน' : '');
    const mergedBannerLabel =
      hasDrama && slowMoOn && baseBannerLabel && !baseBannerLabel.startsWith('🎬')
        ? `🎬 ${baseBannerLabel}`
        : baseBannerLabel;

    const candidateIds = [
      w.ball.carrierId,
      w.ball.shooterId,
      w.ball.targetId,
      w.ball.lastPasserId,
      w.ball.shotPlan?.blockerId,
      w.ball.shotPlan?.deflectorId,
      w.varReview?.shooterId,
      w.varReview?.culpritId,
      w.cardBanner?.who,
      w.goalBanner?.scorer
    ];
    const actors: { id: string; shortName: string; side: 'H' | 'A' }[] = [];
    const seenIds = new Set<string>();
    const addAgentActor = (ag: LivePitchAgent | undefined) => {
      if (!ag || seenIds.has(ag.id)) return;
      if (mergedBannerLabel.includes(ag.id) || (ag.shortName.length >= 2 && mergedBannerLabel.includes(ag.shortName))) {
        seenIds.add(ag.id);
        actors.push({ id: ag.id, shortName: ag.shortName, side: ag.side });
      }
    };
    candidateIds.forEach((cid) => {
      if (!cid) return;
      addAgentActor(w.agents.find((a) => a.id === cid || a.shortName === cid));
    });
    w.agents
      .slice()
      .sort((a, b) => b.shortName.length - a.shortName.length)
      .forEach((ag) => addAgentActor(ag));

    const teamSide: 'H' | 'A' =
      mergedBannerLabel.includes(homeOrig.name) && !mergedBannerLabel.includes(awayOrig.name)
        ? 'H'
        : mergedBannerLabel.includes(awayOrig.name) && !mergedBannerLabel.includes(homeOrig.name)
          ? 'A'
          : actors[0]?.side || w.ball.possessionSide;
    const sig = `${mergedBannerLabel}|${w.phaseTone}|${teamSide}|${actors.map((a) => `${a.side}:${a.id}`).join(',')}`;
    return { label: mergedBannerLabel, tone: w.phaseTone, actors, teamSide, sig };
  };

  const syncUiStatsFromWorld = (w: LiveMatchWorld, nextMin: number) => {
    let nextLabel = `${nextMin}'`;
    let nextStop = 0;
    if (w.phase === 'stop1') {
      const sMin = Math.max(1, Math.min(w.added1, Math.ceil(w.stoppageFloat)));
      nextLabel = `45+${sMin}'`;
      nextStop = w.added1;
    } else if (w.phase === 'halftime') {
      nextLabel = 'HT';
    } else if (w.phase === 'stop2') {
      const sMin = Math.max(1, Math.min(w.added2, Math.ceil(w.stoppageFloat)));
      nextLabel = `90+${sMin}'`;
      nextStop = w.added2;
    } else if (w.phase === 'shootout') {
      nextLabel = 'PEN';
    } else if (w.phase === 'ft') {
      nextLabel = 'FT';
    }

    const clockSig = `${nextMin}|${w.phase}|${nextLabel}|${nextStop}|${w.secondHalf ? 1 : 0}`;
    if (lastClockSigRef.current !== clockSig) {
      lastClockSigRef.current = clockSig;
      setMinute(nextMin);
      setMatchPhaseUi(w.phase);
      setIsSecondHalfUi(w.secondHalf);
      setClockLabel(nextLabel);
      setStoppageBadge(nextStop);
      if (w.phase === 'halftime' || w.phase === 'ft') {
        setLivePlayerStatsUi({ ...simRef.current.playerStats });
      }
    }

    const nextBanner = buildBannerPayload(w, cineSlowMo);
    if (lastBannerSigRef.current !== nextBanner.sig) {
      lastBannerSigRef.current = nextBanner.sig;
      setActionBanner({
        label: nextBanner.label,
        tone: nextBanner.tone,
        actors: nextBanner.actors,
        teamSide: nextBanner.teamSide
      });
    }

    const possH = clamp(Math.round((w.possTicksH / Math.max(1, w.possTicksTotal)) * 100), 28, 72);
    const xgH = Math.max(0.05, Math.round(w.xgH * 100) / 100);
    const xgA = Math.max(0.05, Math.round(w.xgA * 100) / 100);
    const statsSig = `${possH}|${w.shotsH}|${w.shotsA}|${w.onTargetH}|${w.onTargetA}|${w.savesH}|${w.savesA}|${w.blocksH}|${w.blocksA}|${w.cornersH}|${w.cornersA}|${w.foulsH}|${w.foulsA}|${w.offsidesH}|${w.offsidesA}|${w.passesH}|${w.passesA}|${xgH}|${xgA}`;
    if (lastStatsSigRef.current !== statsSig) {
      lastStatsSigRef.current = statsSig;
      setMatchStats({
        possH,
        shotsH: w.shotsH,
        shotsA: w.shotsA,
        onTargetH: w.onTargetH,
        onTargetA: w.onTargetA,
        savesH: w.savesH,
        savesA: w.savesA,
        blocksH: w.blocksH,
        blocksA: w.blocksA,
        cornersH: w.cornersH,
        cornersA: w.cornersA,
        foulsH: w.foulsH,
        foulsA: w.foulsA,
        offsidesH: w.offsidesH,
        offsidesA: w.offsidesA,
        freeKicksH: w.freeKicksH,
        freeKicksA: w.freeKicksA,
        passesH: w.passesH,
        passesA: w.passesA,
        xgH,
        xgA
      });
    }

    const miracleSig = w.miracle && w.miracle.minsLeft > 0 ? `${w.miracle.side}|${w.miracle.minsLeft}|${w.miracle.goalsDuring}|${w.miracle.maxDeficit}` : '';
    if (lastMiracleSigRef.current !== miracleSig) {
      lastMiracleSigRef.current = miracleSig;
      if (w.miracle && w.miracle.minsLeft > 0) {
        const mTeam = w.miracle.side === 'H' ? homeOrig : awayOrig;
        setMiracleBannerUi({ side: w.miracle.side, teamName: mTeam.name, minsLeft: w.miracle.minsLeft, goalsDuring: w.miracle.goalsDuring, maxDeficit: w.miracle.maxDeficit });
      } else {
        setMiracleBannerUi(null);
      }
    }

    const nextBlessed = w.agents
      .filter((a) => !a.sentOff && (a.blessedMins ?? 0) > 0)
      .map((a) => ({
        id: a.id,
        shortName: a.shortName,
        no: a.no,
        side: a.side,
        tag: a.blessedTag || 'เข้าฝัก',
        minsLeft: a.blessedMins ?? 0
      }));
    const blessedSig = nextBlessed.map((b) => `${b.id}:${b.no}:${b.minsLeft}`).join(',');
    if (lastBlessedSigRef.current !== blessedSig) {
      lastBlessedSigRef.current = blessedSig;
      setBlessedListUi(nextBlessed);
    }

    if (nextMin !== lastStreamMinRef.current) {
      lastStreamMinRef.current = nextMin;
      const sr = simRef.current;
      const totalGoalsNow = sr.gh + sr.ga;
      const closeLate = nextMin >= 72 && Math.abs(sr.gh - sr.ga) <= 1 ? 1.18 : 1.0;
      const phaseCurve =
        w.phase === 'halftime'
          ? 0.82
          : nextMin <= 15
            ? 0.72 + (nextMin / 15) * 0.23
            : nextMin <= 45
              ? 0.95 + ((nextMin - 15) / 30) * 0.1
              : 1.02 + ((nextMin - 45) / 45) * 0.14;
      const goalHype = 1 + Math.min(0.32, totalGoalsNow * 0.065);
      const jitter = 0.96 + Math.random() * 0.08;
      const targetViewers = Math.max(250, Math.round(streamProj.baseViewers * phaseCurve * goalHype * closeLate * jitter));
      const smoothed = Math.round(liveViewersRef.current * 0.55 + targetViewers * 0.45);
      liveViewersRef.current = smoothed;
      setLiveViewers(smoothed);
      if (smoothed > peakViewersRef.current) {
        peakViewersRef.current = smoothed;
        setPeakViewers(smoothed);
      }

      const vTier = getStreamViewerTier(smoothed);
      const interval = vTier === 'viral' ? 2 : vTier === 'high' ? 3 : vTier === 'mid' ? 5 : 8;
      if (w.phase === 'halftime') {
        pushStreamComment(45, 'halftime');
      } else if (nextMin >= 83 && nextMin % 6 === 0 && Math.abs(sr.gh - sr.ga) <= 1) {
        pushStreamComment(nextMin, 'late');
      } else if (isPlayerMode && myPlayerName && nextMin > 10 && nextMin % 17 === 8 && (sr.userStarted || sr.userSubInMin != null)) {
        pushStreamComment(nextMin, 'player');
      } else if (nextMin > 0 && nextMin % interval === 0) {
        const myOn = (meIsHome ? sr.homeLu : sr.awayLu).filter((n) => !sr.sentOff.includes(n));
        pushStreamComment(nextMin, 'ambient', {
          actor: myOn.length ? P(myOn) : undefined,
          burst: vTier === 'viral' ? (Math.random() < 0.5 ? 3 : 2) : vTier === 'high' && Math.random() < 0.45 ? 2 : 1
        });
      }

      if (isPlayerMode && !sr.done) {
        const nextPitchStatus: 'on' | 'bench' | 'subbed_out' | 'sent_off' = sr.sentOff.includes(myPlayerName)
          ? 'sent_off'
          : sr.userSubOutMin != null || sr.subs.some((s) => s.outPlayer === myPlayerName)
            ? 'subbed_out'
            : curMeOnPitch(w)
              ? 'on'
              : 'bench';
        if (lastUserPitchStatusRef.current !== nextPitchStatus) {
          lastUserPitchStatusRef.current = nextPitchStatus;
          setUserPitchStatus(nextPitchStatus);
        }
      }
    }
  };

  const computePenWinnerInstant = () => {
    const sr = simRef.current;
    const finalHomeTeam = { ...homeOrig, tac: meIsHome ? liveTacticsRef.current.tac : homeOrig.tac, lu: sr.homeLu };
    const finalAwayTeam = { ...awayOrig, tac: !meIsHome ? liveTacticsRef.current.tac : awayOrig.tac, lu: sr.awayLu };
    const H = rate(finalHomeTeam, state, true, 90, sr.subs.map((s) => s.inPlayer), sr.sentOff);
    const A = rate(finalAwayTeam, state, true, 90, sr.subs.map((s) => s.inPlayer), sr.sentOff);
    const penCompEdge = (teamXi: Player[]) => {
      const gk = teamXi.find((q) => q.pos === 'GK');
      const gkSv = gk ? DT(gk, state.p).d.sv : 60;
      const avgComp = teamXi.reduce((s, q) => s + DT(q, state.p).d.comp, 0) / (teamXi.length || 1);
      return avgComp * 0.6 + gkSv * 0.4;
    };
    const penDiff = penCompEdge(H.x) - penCompEdge(A.x);
    const winnerHome = Math.random() < clamp(0.5 + (H.at - A.at) / 260 + penDiff / 160, 0.25, 0.75);
    const sH = winnerHome ? R(4, 5) : R(2, 4);
    const sA = winnerHome ? Math.max(1, sH - R(1, 2)) : sH + R(1, 2);
    const text = `ดวลจุดโทษ: ${homeOrig.name} ${sH}-${sA} ${awayOrig.name}`;
    return { winnerHome, text, scoreText: `${sH}-${sA}` };
  };

  const startLiveShootout = (w: LiveMatchWorld) => {
    const active = w.agents.filter((a) => !a.sentOff);
    const firstKicker = resolveSetPieceTaker(w, 'H', 'penalty') || active.filter((a) => a.side === 'H' && a.pos !== 'GK')[0];
    const firstGk = active.find((a) => a.side === 'A' && a.pos === 'GK');
    w.phase = 'shootout';
    clearWorldCelebration(w, 'SUPPORT');
    w.varReview = null;
    if (lastLiveVarActiveRef.current) {
      lastLiveVarActiveRef.current = false;
      setLiveVarActive(false);
    }
    w.pendingSetPiece = null;
    w.ball.carrierId = null;
    w.ball.targetId = null;
    w.ball.flightType = 'carry';
    w.ball.x = 88.5;
    w.ball.y = 50;
    w.ball.z = 0;
    w.ball.trail = [];
    w.shootout = {
      round: 1,
      turn: 'H',
      hKicks: [],
      aKicks: [],
      hScore: 0,
      aScore: 0,
      waitSec: 1.65,
      lastMsg: `🎯 เสมอกัน ${simRef.current.gh}-${simRef.current.ga} ต้องตัดสินด้วยการดวลจุดโทษ!`,
      kickerName: firstKicker?.id || 'นักเตะ',
      gkName: firstGk?.id || 'ผู้รักษาประตู',
      activeShot: false,
      finished: false
    };
    triggerDramaSlow(w, 1.65, '🎯 ดวลจุดโทษตัดสิน!');
    w.phaseLabel = `🎯 ดวลจุดโทษตัดสิน! (${homeOrig.name} vs ${awayOrig.name})`;
    w.phaseTone = 'danger';
    SFX.whistle();
    pushLog(90, `🎯 เสมอหลังจบ 90 นาที (${simRef.current.gh}-${simRef.current.ga}) — เข้าสู่การดวลจุดโทษตัดสิน!`, 'sys');
    setMatchPhaseUi('shootout');
    setClockLabel('PEN');
    setStoppageBadge(0);
    setShootoutUi({ ...w.shootout });
    rollingSamplesRef.current = [];
    varBuildupSamplesRef.current = null;
  };

  const runAutoOnPitchRebalance = (
    w: LiveMatchWorld,
    sr: typeof simRef.current,
    curMin: number
  ) => {
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    const mySide: 'H' | 'A' = meIsHome ? 'H' : 'A';
    const slots = getFormationSlots(meTeamOrig);
    if (myLu.length !== 11 || slots.length !== 11) return false;

    const getPl = (name: string) => meTeamOrig.sq.find((q) => q.n === name);
    const activeDfs = myLu.filter((n, idx) => !sr.sentOff.includes(n) && slots[idx]?.pos === 'DF').length;
    const activeFws = myLu.filter((n, idx) => !sr.sentOff.includes(n) && slots[idx]?.pos === 'FW').length;

    const slotPenalty = (name: string, slotIdx: number): number => {
      const slot = slots[slotIdx];
      if (!slot) return 0;
      if (sr.sentOff.includes(name)) {
        if (slot.pos === 'GK') return 2500;
        if (slot.pos === 'DF' && activeDfs < 3 && activeFws >= 2) return 95;
        return 0;
      }
      const pl = getPl(name);
      if (!pl) return 0;
      const penVal = playerPen(pl, slot.sp);
      const gkMismatch =
        (slot.pos === 'GK' && pl.pos !== 'GK') || (slot.pos !== 'GK' && pl.pos === 'GK') ? 1000 : 0;
      return penVal * 12 + gkMismatch;
    };

    let bestI = -1;
    let bestJ = -1;
    let bestGain = 8;

    for (let i = 0; i < 11; i++) {
      for (let j = i + 1; j < 11; j++) {
        const nA = myLu[i];
        const nB = myLu[j];
        if (sr.sentOff.includes(nA) && sr.sentOff.includes(nB)) continue;
        const cNow = slotPenalty(nA, i) + slotPenalty(nB, j);
        const cSwap = slotPenalty(nA, j) + slotPenalty(nB, i);
        const gain = cNow - cSwap;
        if (gain > bestGain) {
          bestGain = gain;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestI < 0 || bestJ < 0) return false;

    const nameA = myLu[bestI];
    const nameB = myLu[bestJ];
    myLu[bestI] = nameB;
    myLu[bestJ] = nameA;

    const updated = buildTeamAgents(meTeamOrig, mySide, myLu, w.secondHalf);
    updated.forEach((nextAg) => {
      const oldIdx = w.agents.findIndex((a) => a.side === mySide && a.id === nextAg.id);
      if (oldIdx >= 0) {
        const oldAg = w.agents[oldIdx];
        nextAg.x = oldAg.x;
        nextAg.y = oldAg.y;
        nextAg.facing = oldAg.facing;
        nextAg.stride = oldAg.stride;
        nextAg.injuredOut = oldAg.injuredOut;
        nextAg.sentOff = oldAg.sentOff;
        w.agents[oldIdx] = nextAg;
      }
    });

    if (!isSkippingRef.current) setLiveLu(myLu.slice());
    triggerCoachShout(w, mySide, '🔀 ปรับตำแหน่ง!', 2.1);
    const sA = slots[bestI]?.sp || '';
    const sB = slots[bestJ]?.sp || '';
    pushLog(
      curMin,
      `🤖 ออโต้ปรับตำแหน่ง (${meTeamOrig.name}): 🔀 ${nameA.split(' ')[0]} (${sB}) ↔ ${nameB.split(' ')[0]} (${sA})`,
      'sys'
    );
    return true;
  };

  const runAutoUserSubs = (
    w: LiveMatchWorld,
    sr: typeof simRef.current,
    curMin: number
  ) => {
    const mySubsCount = meIsHome ? sr.homeSubsCount : sr.awaySubsCount;
    if (mySubsCount >= 5) return;
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    const myPlayed = meIsHome ? sr.homePlayed : sr.awayPlayed;
    const mySlots = getFormationSlots(meTeamOrig);
    const availBench = meTeamOrig.sq.filter(
      (q) => !myLu.includes(q.n) && !myPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n)
    );
    if (!availBench.length) return;

    const myGoals = meIsHome ? sr.gh : sr.ga;
    const oppGoals = meIsHome ? sr.ga : sr.gh;
    const isSafeLead = myGoals - oppGoals >= 2 || (curMin >= 74 && myGoals > oppGoals);
    const isChasing = myGoals < oppGoals && curMin >= 58;
    const scheduledMins = [56, 63, 70, 77, 84];
    const onPitch = myLu
      .map((n, idx) => ({ idx, n, pl: meTeamOrig.sq.find((q) => q.n === n), slot: mySlots[idx] }))
      .filter((x): x is { idx: number; n: string; pl: Player; slot: (typeof mySlots)[number] } => Boolean(x.pl) && !sr.sentOff.includes(x.n));

    let outPick =
      onPitch.find((x) => sr.injuredNames.includes(x.n)) ||
      onPitch
        .filter((x) => x.pl.pos !== 'GK' && (sr.liveFit[x.n] ?? x.pl.fit ?? 100) < 54)
        .sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.liveFit[b.n] ?? 100))[0];

    const isScheduledWindow = scheduledMins.includes(curMin) && mySubsCount < scheduledMins.indexOf(curMin) + 1;
    if (!outPick && curMin >= 55 && (isScheduledWindow || curMin % 4 === 0)) {
      outPick = onPitch
        .filter((x) => x.pl.pos !== 'GK')
        .map((x) => {
          const fitNow = sr.liveFit[x.n] ?? x.pl.fit ?? 100;
          const yCnt = sr.yellows[x.n] || 0;
          const rtNow = sr.liveForm[x.n] ?? 6.5;
          const offPos = x.slot ? playerPen(x.pl, x.slot.sp) * 14 : 0;
          const fatigueNeed = (100 - fitNow) * 1.15;
          const cardRisk = yCnt > 0 ? 18 : 0;
          const lowFormBonus = rtNow < 6.1 ? 11 : 0;
          const chaseNeed = isChasing && (x.pl.pos === 'DF' || baseRoleOf(x.pl.ro) === 'CDM') && rtNow < 6.7 ? 12 : 0;
          const protectVeteran = isSafeLead && x.pl.age >= 24 ? 16 : 0;
          const keepYoungster = x.pl.age <= 21 && fitNow >= 64 ? -22 : 0;
          return { ...x, outScore: fatigueNeed + cardRisk + lowFormBonus + offPos + chaseNeed + protectVeteran + keepYoungster };
        })
        .filter((x) => x.outScore >= (isSafeLead ? 18 : 24) || (sr.liveFit[x.n] ?? 100) <= 72)
        .sort((a, b) => b.outScore - a.outScore)[0];
    }

    if (!outPick) return;
    const outPl = outPick.pl;
    const slotSp = outPick.slot?.sp || outPl.ro;
    const slotPos = outPick.slot?.pos || outPl.pos;
    const posMatchedPool = availBench.filter((b) =>
      slotPos === 'GK'
        ? b.pos === 'GK' || playerPen(b, 'GK') === 0
        : b.pos === slotPos || playerPen(b, slotSp) <= 1
    );
    const candidatePool =
      posMatchedPool.length > 0
        ? posMatchedPool
        : slotPos === 'GK'
          ? []
          : availBench.filter((b) => b.pos !== 'GK' || playerPen(b, slotSp) <= 1);
    if (!candidatePool.length) return;

    const bestCand = candidatePool
      .map((cand) => {
        const fitCand = cand.fit ?? 100;
        const tl = getPlayerTalent(cand, null);
        const penCand = playerPen(cand, slotSp);
        const exactRoleBonus = penCand === 0 ? 48 : penCand === 1 ? 26 : -12;
        const isTalentedYouth = cand.age <= 22 && tl >= 65;
        const youthExpBonus = isTalentedYouth
          ? (isSafeLead ? 34 : 22) + (tl - 60) * 0.65 + (cand.age <= 19 ? 8 : 0)
          : cand.age <= 23
            ? 8
            : 0;
        const chaseAttBonus = isChasing && (cand.pos === 'FW' || cand.ro === 'CAM') ? 16 : 0;
        const readyFitBonus = fitCand >= 82 ? 18 + (fitCand - 82) * 0.4 : fitCand < 64 ? -35 : 0;
        const score = exactRoleBonus + youthExpBonus + chaseAttBonus + readyFitBonus + cand.ov * 0.45 + tl * 0.12;
        return { cand, tl, isTalentedYouth, fitCand, score };
      })
      .sort((a, b) => b.score - a.score)[0];

    if (
      bestCand &&
      (bestCand.cand.pos === slotPos ||
        playerPen(bestCand.cand, slotSp) <= 1 ||
        sr.injuredNames.includes(outPl.n) ||
        (sr.liveFit[outPl.n] ?? 100) < 55)
    ) {
      const { cand, tl, isTalentedYouth, fitCand } = bestCand;
      myLu[outPick.idx] = cand.n;
      if (!myPlayed.includes(cand.n)) myPlayed.push(cand.n);
      if (sr.liveForm[cand.n] == null) sr.liveForm[cand.n] = 6.5;
      if (meIsHome) sr.homeSubsCount++;
      else sr.awaySubsCount++;
      const subEv: MatchSubEvent = { m: curMin, t: meTeamOrig.id, inPlayer: cand.n, outPlayer: outPl.n };
      sr.subs.push(subEv);

      const agIdx = w.agents.findIndex((a) => a.id === outPl.n);
      let subbedAg: LivePitchAgent | undefined;
      if (agIdx >= 0) {
        const rep = buildTeamAgents(meTeamOrig, meIsHome ? 'H' : 'A', myLu, w.secondHalf);
        if (rep[outPick.idx]) {
          rep[outPick.idx].x = w.agents[agIdx].x;
          rep[outPick.idx].y = w.agents[agIdx].y;
          rep[outPick.idx].facing = w.agents[agIdx].facing;
          w.agents[agIdx] = rep[outPick.idx];
          subbedAg = rep[outPick.idx];
        }
        if (w.ball.carrierId === outPl.n) w.ball.carrierId = cand.n;
        if (w.ball.targetId === outPl.n) w.ball.targetId = cand.n;
      }

      if (!isSkippingRef.current) {
        triggerSubPitchAnim(w, subbedAg, meIsHome ? 'H' : 'A', meTeamOrig.name, cand.n, outPl.n, curMin);
        setLiveLu(myLu.slice());
        setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
        setSubLog(sr.subs.slice());
      }
      syncSidelineBenches(w);
      triggerCoachShout(w, meIsHome ? 'H' : 'A', '🔄 เปลี่ยนตัว!', 2.3);
      const isInjOut = sr.injuredNames.includes(outPl.n);
      const reasonTag = isInjOut
        ? `🩹 แทนผู้เจ็บ (${cand.ro})`
        : isTalentedYouth
          ? `🤖 ปั้นดาวรุ่ง (${cand.age}ปี)`
          : `🤖 ออโต้ (ฟิต ${Math.round(fitCand)}%)`;
      if (!w.pendingSetPiece && !w.varReview && w.celebrateTimer <= 0 && w.ball.flightType !== 'shot' && w.ball.flightType !== 'freekick' && w.ball.flightType !== 'penalty') {
        w.phaseLabel = `🔄 ${meTeamOrig.name}: 🔼 เข้า ${cand.n.split(' ')[0]} · 🔽 ออก ${outPl.n.split(' ')[0]}`;
        w.phaseTone = 'normal';
      }
      pushTimeline(curMin, meIsHome ? 'H' : 'A', 'sub', cand.n, outPl.n);
      pushLog(curMin, `🤖 ออโต้เปลี่ยนตัว (${reasonTag}): 🔼 เข้า ${cand.n} · 🔽 ออก ${outPl.n}`, 'sub', {
        subInfo: { teamId: meTeamOrig.id, inName: cand.n, outName: outPl.n, badge: reasonTag, isInjury: isInjOut }
      });
      ensureOnPitchCaptain(w, meIsHome ? 'H' : 'A', curMin, 'sub', false);
      if (injuryAlert && injuryAlert.name === outPl.n) setInjuryAlert(null);
    }
  };

  const handleStartSecondHalf = useCallback((talkToneOverride?: HalftimeTalkTone) => {
    const w = worldRef.current;
    if (!w || w.phase !== 'halftime') return;
    const talkTone = talkToneOverride ?? selectedHalftimeTalkRef.current;
    SFX.whistle();
    if (talkTone) SFX.coach();
    const sr = simRef.current;
    w.secondHalf = true;
    setIsSecondHalfUi(true);
    clearWorldCelebration(w, 'RESET');
    const mySide: 'H' | 'A' = meIsHome ? 'H' : 'A';
    // Halftime stamina recovery (+5%) & switch pitch sides for 2nd half
    w.agents.forEach((ag) => {
      if (!ag.sentOff) {
        ag.fit = clamp(ag.fit + 5, 25, 100);
        sr.liveFit[ag.id] = ag.fit;
      }
      // Reset to mirrored kickoff positions for 2nd half
      const attR = isAttackRight(w, ag.side);
      const homeBaseX = clamp(100 - ag.slotY, 4.5, 95.5);
      const baseX = attR ? homeBaseX : 100 - homeBaseX;
      const baseY = attR ? clamp(ag.slotX, 6, 94) : clamp(100 - ag.slotX, 6, 94);
      ag.x = attR ? Math.min(baseX, 47) : Math.max(baseX, 53);
      ag.y = baseY;
      ag.tx = ag.x;
      ag.ty = ag.y;
      ag.vx = 0;
      ag.vy = 0;
      ag.facing = attR ? 0 : Math.PI;
      ag.intent = 'RESET';
    });
    if (state.mode === 'm' && talkTone) {
      if (talkTone === 'attack') {
        setLiveTac('A');
        setLiveLine(2);
        w.agents.filter((a) => !a.sentOff && a.side === mySide && (a.pos === 'FW' || a.pos === 'MF')).forEach((a) => adjustLiveForm(a.id, 0.12));
        pushLog(45, `📣 สั่งการพักครึ่ง: "🔥 ลุยเปิดเกมบุก! ดันเกมรุกกดดันตั้งแต่ต้นครึ่งหลัง"`, 'sys');
      } else if (talkTone === 'press') {
        setLivePress(2);
        setLiveTempo(2);
        w.agents.filter((a) => !a.sentOff && a.side === mySide && (a.pos === 'MF' || a.pos === 'FW')).forEach((a) => adjustLiveForm(a.id, 0.10));
        pushLog(45, `📣 สั่งการพักครึ่ง: "⚡ เพรสซิ่งสูงบีบพื้นที่! ไล่บี้แย่งบอลเร็วครึ่งหลัง"`, 'sys');
      } else if (talkTone === 'counter') {
        setLivePass(3);
        w.agents.filter((a) => !a.sentOff && a.side === mySide && a.pos === 'FW').forEach((a) => adjustLiveForm(a.id, 0.14));
        w.agents.filter((a) => !a.sentOff && a.side === mySide && a.pos === 'DF').forEach((a) => {
          a.fit = clamp(a.fit + 3, 25, 100);
          sr.liveFit[a.id] = a.fit;
        });
        pushLog(45, `📣 สั่งการพักครึ่ง: "🚀 ตั้งรับรอสวนกลับเร็ว! เน้นวางบอลหลังไลน์"`, 'sys');
      } else if (talkTone === 'defend') {
        setLiveTac('D');
        setLivePress(0);
        w.agents.filter((a) => !a.sentOff && a.side === mySide && (a.pos === 'GK' || a.pos === 'DF')).forEach((a) => adjustLiveForm(a.id, 0.14));
        pushLog(45, `📣 สั่งการพักครึ่ง: "🛡️ ขันเกมรับให้รัดกุม! รักษาระยะคุมโซนให้แน่น"`, 'sys');
      } else {
        w.agents.filter((a) => !a.sentOff && a.side === mySide).forEach((a) => adjustLiveForm(a.id, 0.08));
        pushLog(45, `📣 สั่งการพักครึ่ง: "⚖️ รักษาทรงและความสมดุล เล่นตามจังหวะของทีม!"`, 'sys');
      }
    } else if (state.mode === 'p' && myPlayerName) {
      const meAg = w.agents.find((a) => a.id === myPlayerName);
      const mySideCfg = aiCoachRef.current[mySide];
      if (talkTone === 'fit') {
        if (meAg) {
          meAg.fit = clamp(meAg.fit + 6, 25, 100);
          sr.liveFit[meAg.id] = meAg.fit;
        }
        pushLog(45, `💪 คุณทำตามแผนโค้ชพร้อมวอร์มอัพเรียกความฟิต (+6%) ลุยครึ่งหลัง!`, 'sys');
      } else if (talkTone === 'ask_attack' || talkTone === 'attack') {
        mySideCfg.tac = mySideCfg.tac === 'Z' || mySideCfg.tac === 'D' ? 'B' : mySideCfg.tac === 'B' ? 'A' : 'X';
        mySideCfg.press = Math.min(2, mySideCfg.press + 1);
        mySideCfg.line = Math.min(2, mySideCfg.line + 1);
        if (meAg) adjustLiveForm(meAg.id, 0.18);
        pushLog(45, `🔥 คุณเสนอโค้ชเปิดเกมรุกเพิ่มในครึ่งหลัง — โค้ชปรับสไตล์ทีมเป็น ${AR_T[mySideCfg.tac]}!`, 'sys');
      } else if (talkTone === 'ask_defend') {
        mySideCfg.tac = mySideCfg.tac === 'X' || mySideCfg.tac === 'A' ? 'B' : 'D';
        mySideCfg.line = Math.max(0, mySideCfg.line - 1);
        mySideCfg.pass = 3;
        if (meAg) adjustLiveForm(meAg.id, 0.14);
        pushLog(45, `🛡️ คุณเสนอโค้ชเล่นรัดกุมรอสวนกลับ — โค้ชปรับสไตล์ทีมเป็น ${AR_T[mySideCfg.tac]}!`, 'sys');
      } else {
        if (meAg) adjustLiveForm(meAg.id, 0.16);
        pushLog(45, `🤝 คุณรับคำสั่งโค้ช ${meTeamOrig.name} เต็มร้อย (${mySideCfg.form} · ${AR_T[mySideCfg.tac]}) ลุยครึ่งหลัง!`, 'sys');
      }
    }
    w.phase = 'play2';
    w.stoppageFloat = 0;
    w.pendingSetPiece = { type: 'kickoff', side: 'A', x: 50, y: 50, waitSec: 0.45 };
    w.phaseLabel = `⚽ เริ่มครึ่งหลัง! (${awayOrig.name} เขี่ยบอล)`;
    w.phaseTone = 'normal';
    syncSidelineBenches(w);
    triggerCoachShout(w, 'H', '📣 ย้ายฝั่ง! สู้ต่อ!', 3.2);
    triggerCoachShout(w, 'A', '📣 สลับฝั่ง! ลุย!', 3.2);
    setHtPickedPlayer(null);
    setMlandMatchTab('stats');
    setPaused(false);
    setMatchPhaseUi('play2');
    setClockLabel("46'");
    setStoppageBadge(0);
    setLiveFitMap({ ...sr.liveFit });
    rollingSamplesRef.current = [];
    varBuildupSamplesRef.current = null;
    pushLog(46, `▶️ กรรมการเป่าเริ่มครึ่งหลัง!`, 'sys');
    pushTimeline(46, 'N', 'second_half', 'เริ่มครึ่งหลัง', 'ครึ่งหลัง');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awayOrig.name, meIsHome, meTeamOrig.name, myPlayerName, state.mode]);

  const finalizeMatch = (precomputedWinnerHome?: boolean, precomputedPenText?: string) => {
    const sr = simRef.current;
    if (sr.done) return;
    sr.done = true;
    setInjuryAlert(null);
    const w = worldRef.current!;
    flushHighlightCaptures(w);
    const curatedHl = curateMatchHighlights(sr.highlightClips);
    sr.highlightClips = curatedHl;
    setHighlightClips(curatedHl);

    // Ensure any injured players still on pitch without manual sub get auto-replaced if bench allows
    ([true, false] as const).forEach((isHomeSide) => {
      const sideOrig = isHomeSide ? homeOrig : awayOrig;
      const curLu = isHomeSide ? sr.homeLu : sr.awayLu;
      const curPlayed = isHomeSide ? sr.homePlayed : sr.awayPlayed;
      sr.injuredNames.forEach((injName) => {
        const idx = curLu.indexOf(injName);
        if (idx < 0) return;
        const subsCount = isHomeSide ? sr.homeSubsCount : sr.awaySubsCount;
        if (subsCount >= 5) return;
        const injPl = sideOrig.sq.find((q) => q.n === injName);
        const bench = sideOrig.sq
          .filter((q) => !curPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n) && q.pos !== 'GK')
          .sort((a, b) => b.ov - a.ov);
        const subIn = (injPl ? bench.find((b) => b.pos === injPl.pos) : undefined) || bench[0];
        if (subIn) {
          curLu[idx] = subIn.n;
          if (!curPlayed.includes(subIn.n)) curPlayed.push(subIn.n);
          if (sr.liveForm[subIn.n] == null) sr.liveForm[subIn.n] = 6.5;
          if (isHomeSide) sr.homeSubsCount++;
          else sr.awaySubsCount++;
          sr.subs.push({ m: 90, t: sideOrig.id, inPlayer: subIn.n, outPlayer: injName });
        }
      });
    });

    w.phase = 'ft';
    clearWorldCelebration(w, 'SUPPORT');
    w.varReview = null;
    if (lastLiveVarActiveRef.current) {
      lastLiveVarActiveRef.current = false;
      setLiveVarActive(false);
    }
    w.pendingSetPiece = null;
    const wasSkipping = isSkippingRef.current;
    isSkippingRef.current = false;
    syncUiStatsFromWorld(w, 90);
    setDone(true);
    setMatchPhaseUi('ft');
    setMlandMatchTab('players');
    setClockLabel('FT');
    setStoppageBadge(0);
    setLiveViewers(liveViewersRef.current);
    setPeakViewers(peakViewersRef.current);
    if (wasSkipping && skipCommentsRef.current) {
      if (skipCommentsRef.current.length > 0) {
        setLiveComments(skipCommentsRef.current.slice(0, 50));
      }
      skipCommentsRef.current = null;
    }
    pushStreamComment(90, 'fulltime');
    SFX.fullWhistle();
    setCrowdAudio(false);

    setGh(sr.gh);
    setGa(sr.ga);
    setEvs(sr.evs.slice());
    setGoalFlashInfo(null);
    setSubFlashInfo(null);
    setLiveCaptains({ H: sr.captainH, A: sr.captainA });
    setAiFormDisplay({ H: aiCoachRef.current.H.form, A: aiCoachRef.current.A.form });
    setLiveTac(liveTacticsRef.current.tac);
    setVarHistory(sr.varHistory.slice());
    setLiveLu((meIsHome ? sr.homeLu : sr.awayLu).slice());
    setLiveOppLu((meIsHome ? sr.awayLu : sr.homeLu).slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    setMatchYellows({ ...sr.yellows });
    setMatchCards(sr.cards.slice());
    setSentOff(sr.sentOff.slice());
    setLiveFitMap({ ...sr.liveFit });
    setLiveFormMap({ ...sr.liveForm });
    setInjuredNamesUi(sr.injuredNames.slice());
    setLivePlayerStatsUi({ ...sr.playerStats });

    const finalGh = sr.gh;
    const finalGa = sr.ga;
    let finalPenText: string | undefined = precomputedPenText;
    if (kind !== 'league' && !allowDraw && finalGh === finalGa) {
      if (precomputedWinnerHome !== undefined && precomputedPenText) {
        setPenResult({ winnerHome: precomputedWinnerHome, text: precomputedPenText });
      } else {
        const pen = computePenWinnerInstant();
        finalPenText = pen.text;
        setPenResult(pen);
        if (!sr.highlightClips.some((c) => c.kind === 'shootout_kick')) {
          const winSide: 'H' | 'A' = pen.winnerHome ? 'H' : 'A';
          const loseSide: 'H' | 'A' = pen.winnerHome ? 'A' : 'H';
          const winPool = w.agents.filter((a) => !a.sentOff && a.side === winSide && a.pos !== 'GK').sort((u, v) => v.d.fin - u.d.fin);
          const loseGk = w.agents.find((a) => !a.sentOff && a.side === loseSide && a.pos === 'GK');
          recordEventHighlight(w, 90, {
            kind: 'shootout_kick',
            side: winSide,
            attRight: true,
            actorName: winPool[0]?.id || (winSide === 'H' ? homeOrig.name : awayOrig.name),
            victimName: loseGk?.id,
            finishVerb: 'ซัดจุดโทษลูกชี้ขาดพาทีมคว้าชัย!',
            shotStyle: 'penalty',
            shotDistM: 11,
            shootoutScored: true,
            shootoutOutcome: 'goal',
            shootoutRound: 5,
            shootoutDecisive: true,
            shootoutScoreText: pen.scoreText,
            dramaFloor: 108
          });
          const updatedCurated = curateMatchHighlights(sr.highlightClips);
          sr.highlightClips = updatedCurated;
          setHighlightClips(updatedCurated);
        }
        if (wasSkipping && skipLogsRef.current) {
          skipLogsRef.current.unshift({ id: logSeqRef.current++, m: 90, text: `🎯 ${pen.text}`, tone: 'sys' });
          if (skipLogsRef.current.length > 65) skipLogsRef.current.length = 65;
        } else {
          pushLog(90, `🎯 ${pen.text}`, 'sys');
        }
      }
    } else {
      const ftText = `🏁 จบเกม! ${homeOrig.name} ${finalGh}-${finalGa} ${awayOrig.name}`;
      if (wasSkipping && skipLogsRef.current) {
        skipLogsRef.current.unshift({ id: logSeqRef.current++, m: 90, text: ftText, tone: 'sys' });
        if (skipLogsRef.current.length > 65) skipLogsRef.current.length = 65;
      } else {
        pushLog(90, ftText, 'sys');
      }
    }
    pushTimeline(90, 'N', 'full_time', 'จบเกม', finalPenText || `${finalGh} - ${finalGa}`);
    setTimelineEvents(sr.timeline.slice());
    if (wasSkipping && skipLogsRef.current) {
      setLogs(skipLogsRef.current.slice(0, 65));
      skipLogsRef.current = null;
    }
    setActionBanner({ label: `🏁 จบเกม ${finalGh} - ${finalGa}`, tone: 'normal', actors: [] });
  };

  // Static pitch redraw when paused and canvas overlay/colors change
  useEffect(() => {
    const isTacticsHidden = state.mode === 'm' && mlandMatchTab === 'tactics';
    const isStaticState =
      paused || done || simRef.current.done || matchPhaseUi === 'halftime' || isTacticsHidden;
    const w = worldRef.current;
    const canvas = canvasRef.current;
    if (!isStaticState || !w || !canvas || done || simRef.current.done || w.phase === 'halftime' || isTacticsHidden) {
      return;
    }
    const redrawStatic = () => {
      drawLivePitchToCanvas(
        canvas,
        w,
        homeKit,
        awayKit,
        homeGkKit,
        awayGkKit,
        showRunVectors,
        homeTrim,
        awayTrim,
        showPositions,
        showRatings,
        simRef.current.liveForm
      );
    };
    redrawStatic();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => redrawStatic()) : null;
    ro?.observe(canvas);
    return () => ro?.disconnect();
  }, [paused, done, showRatings, showRunVectors, showPositions, homeKit, awayKit, homeGkKit, awayGkKit, homeTrim, awayTrim, matchPhaseUi, state.mode, mlandMatchTab]);

  // High-FPS 60fps Animation + Simulation Loop
  useEffect(() => {
    const isTacticsHidden = state.mode === 'm' && mlandMatchTab === 'tactics';
    const isStaticState =
      paused || done || simRef.current.done || matchPhaseUi === 'halftime' || isTacticsHidden;
    if (isStaticState) {
      return;
    }

    let rafId = 0;
    let lastTs = performance.now();
    let uiSyncAccum = 0;

    const frame = (now: number) => {
      const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const w = worldRef.current;
      const canvas = canvasRef.current;
      if (!w) return;

      if (!pausedRef.current && !doneRef.current && !simRef.current.done && w.phase !== 'halftime') {
        const curSpeed = speedRef.current;
        const speedMul = curSpeed === 5 ? 3.1 : curSpeed === 2 ? 1.25 : curSpeed === 0.5 ? 0.34 : curSpeed === 0.25 ? 0.15 : 0.65;

        // Decay FX, banners & dramatic slow-mo timers in real time for key moments
        const isSlowShot =
          w.ball.flightType === 'shot' ||
          w.ball.flightType === 'freekick' ||
          w.ball.flightType === 'penalty' ||
          w.ball.flightType === 'shootout_kick' ||
          (w.ball.flightType === 'bounce' && (Boolean(w.ball.bounceNext?.goalPayload) || Boolean(w.ball.bounceNext?.looseRebound)));
        const slowActive = cineSlowMoRef.current && (w.dramaSlowSec > 0 || isSlowShot);
        const isBigFx = (t: LivePitchFx['type']) =>
          t === 'goal' || t === 'var' || t === 'foul' || t === 'penalty' || t === 'save' || t === 'woodwork' || t === 'offside' || t === 'sub' || t === 'lightning';

        w.fx.forEach((f) => {
          f.ttl -= rawDt * (isBigFx(f.type) ? 1 : speedMul > 2 ? 1.4 : 1);
        });
        w.fx = w.fx.filter((f) => f.ttl > 0);
        w.sparkles.forEach((sp) => {
          sp.x += sp.vx * rawDt;
          sp.y += sp.vy * rawDt;
          sp.vx *= 0.95;
          sp.vy *= 0.95;
          sp.ttl -= rawDt;
        });
        w.sparkles = w.sparkles.filter((sp) => sp.ttl > 0);
        if (w.goalBanner) {
          w.goalBanner.ttl -= rawDt;
          if (w.goalBanner.ttl <= 0) w.goalBanner = null;
        }
        if (w.cardBanner) {
          w.cardBanner.ttl -= rawDt;
          if (w.cardBanner.ttl <= 0) w.cardBanner = null;
        }
        w.goalNetRippleLeft = Math.max(0, w.goalNetRippleLeft - rawDt * 0.85);
        w.goalNetRippleRight = Math.max(0, w.goalNetRippleRight - rawDt * 0.85);
        if (w.celebrateTimer > 0) {
          const celebDt = rawDt * (speedMul > 2.6 ? 1.45 : speedMul > 2.0 ? 1.2 : 1.0);
          w.celebrateTimer = Math.max(0, w.celebrateTimer - celebDt);
          if (w.celebration) {
            w.celebration.elapsed = Math.min(w.celebration.duration, w.celebration.elapsed + celebDt);
          }
          if (w.celebrateTimer <= 0) {
            clearWorldCelebration(w, 'RESET');
            w.dramaSlowSec = 0;
            w.dramaLabel = null;
            w.ball.trail = [];
          }
        }
        w.dramaSlowSec = Math.max(0, w.dramaSlowSec - rawDt);
        if (w.dramaSlowSec <= 0 && !isSlowShot) {
          w.dramaLabel = null;
        }

        // Animate Sideline Coaches (walk across to swapped half in 2nd half, pace & gesture) + Warm-up Subs
        if (w.sideline) {
          const sl = w.sideline;
          sl.warmupPhase += rawDt * 4.2;
          ([sl.coachH, sl.coachA] as LiveSidelineCoach[]).forEach((c) => {
            const isLeftArea = c.side === 'H';
            const baseX = isLeftArea ? 43.3 : 56.7;
            const minX = isLeftArea ? 39.8 : 53.2;
            const maxX = isLeftArea ? 46.8 : 60.2;
            c.tx = clamp(
              baseX + (w.ball.x - 50) * 0.055 + Math.sin(now * 0.0011 + (c.side === 'H' ? 0 : 2.3)) * 1.05,
              minX,
              maxX
            );
            const dx = c.tx - c.x;
            if (Math.abs(dx) > 0.14) {
              const step = Math.min(Math.abs(dx), 18 * rawDt);
              c.x += Math.sign(dx) * step;
              c.pacePhase += rawDt * 11;
            }
            c.facing = Math.atan2(-18, w.ball.x - c.x);
            if (c.gestureTimer > 0) c.gestureTimer = Math.max(0, c.gestureTimer - rawDt);
            if (c.shoutTimer > 0) {
              c.shoutTimer = Math.max(0, c.shoutTimer - rawDt);
              if (c.shoutTimer <= 0) c.shoutText = null;
            }
            if ((c.moodTimer || 0) > 0) {
              c.moodTimer = Math.max(0, (c.moodTimer || 0) - rawDt);
              if (c.moodTimer <= 0) c.moodEmoji = null;
            }
            if ((c.moodCooldown || 0) > 0) {
              c.moodCooldown = Math.max(0, (c.moodCooldown || 0) - rawDt);
            } else if (!(c.shoutText && c.shoutTimer > 0) && !(c.moodEmoji && (c.moodTimer || 0) > 0)) {
              const cGoals = c.side === 'H' ? simRef.current.gh : simRef.current.ga;
              const oGoals = c.side === 'H' ? simRef.current.ga : simRef.current.gh;
              const uStyle = c.isUserCoach ? state.club?.managerStyle || 'balanced' : 'balanced';
              const pool = w.varReview
                ? ['🤔', '😬']
                : cGoals > oGoals
                  ? uStyle === 'attack'
                    ? ['🔥', '😎', '💪', '🙌']
                    : uStyle === 'defense'
                      ? ['🛡️', '😌', '👏', '🧐']
                      : ['😎', '😌', '👏', '💪']
                  : cGoals < oGoals
                    ? uStyle === 'motivator'
                      ? ['📣', '💪', '😤', '👏']
                      : ['😰', '😤', '🤨', '😬']
                    : uStyle === 'youth'
                      ? ['🌱', '👏', '👀', '💪']
                      : uStyle === 'attack'
                        ? ['🔥', '👀', '😤', '💪']
                        : ['🤔', '👀', '👏', '💪', '😮‍💨'];
              c.moodEmoji = pool[Math.floor(Math.random() * pool.length)];
              c.moodTimer = 2.1 + Math.random() * 0.7;
              c.moodCooldown = 7.5 + Math.random() * 8.0;
            }
          });
        }

        // Penalty Shootout Phase
        if (w.phase === 'shootout' && w.shootout && !w.shootout.finished) {
          const sh = w.shootout;
          updateAgentTargets(w, 90);
          w.agents.forEach((ag) => {
            if (ag.sentOff) return;
            if (ag.intent === 'DIVE') {
              if (sh.activeShot) return;
              if (ag.intentTimer > 0) {
                ag.intentTimer -= rawDt;
                ag.diveProgress = clamp(Math.max(ag.diveProgress, 1 - ag.intentTimer / 0.88), 0, 1);
                if (ag.intentTimer <= 0) {
                  ag.intent = 'SUPPORT';
                  ag.diveProgress = 0;
                  ag.diveTargetY = undefined;
                }
              } else {
                ag.intent = 'SUPPORT';
                ag.diveProgress = 0;
                ag.diveTargetY = undefined;
              }
              return;
            }
            const dx = ag.tx - ag.x;
            const dy = ag.ty - ag.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.15) {
              ag.x = clamp(ag.x + (dx / dist) * Math.min(dist * 6, 22) * rawDt, 3, 98.5);
              ag.y = clamp(ag.y + (dy / dist) * Math.min(dist * 6, 22) * rawDt, 4, 96);
              ag.facing = Math.atan2(dy, dx);
            } else {
              ag.facing = ag.side === sh.turn && ag.id === sh.kickerName ? 0 : Math.PI;
            }
          });

          if (!sh.activeShot) {
            sh.waitSec -= rawDt * (speedMul > 2.6 ? 1.35 : speedMul > 2 ? 1.15 : 1.0);
            w.ball.x = 88.5;
            w.ball.y = 50;
            w.ball.z = 0;
            if (sh.waitSec <= 0) {
              sh.activeShot = true;
              const b = w.ball;
              const kicker = w.agents.find((a) => !a.sentOff && a.id === sh.kickerName);
              const gk = w.agents.find((a) => !a.sentOff && a.side !== sh.turn && a.pos === 'GK');
              resetGkDive(gk);
              const kickScore = kicker
                ? kicker.d.fin * 0.5 +
                  (kicker.d.comp || 62) * 0.5 +
                  (kicker.tr === 4 || kicker.tr === 17 ? 8 : 0) +
                  (kicker.tr === 23 ? 5 : 0) +
                  (agentHasTrait(kicker, 'setpiece_specialist') ? 6 : 0)
                : 64;
              const gkScore = gk
                ? gk.d.sv * 0.38 +
                  (gk.d.rfx ?? gk.d.sv) * 0.24 +
                  gk.d.cl * 0.22 +
                  gk.d.pos * 0.16 +
                  (agentHasTrait(gk, 'penalty_saver') ? 11 : 0) +
                  (agentHasTrait(gk, 'reflex_cat') ? 5 : 0)
                : 60;
              const scored = Math.random() < clamp(0.75 + (kickScore - gkScore) * 0.0045, 0.54, 0.90);
              const shotY = 43.0 + Math.random() * 14.0;

              b.fromX = 88.5;
              b.fromY = 50;
              b.curve = (Math.random() - 0.5) * 2.4;
              b.maxZ = 4.5;
              b.progress = 0;
              b.duration = 0.68;
              b.flightType = 'shootout_kick';
              b.possessionSide = sh.turn;
              b.shooterId = sh.kickerName;

              if (scored) {
                b.toX = 101.3;
                b.toY = shotY;
                const wrongWay = Math.random() < 0.45;
                const diveY = wrongWay ? clamp(50 - (shotY - 50), 42.5, 57.5) : shotY;
                b.shotPlan = {
                  outcome: 'goal',
                  shootoutScored: true,
                  gkDiveTargetY: diveY,
                  gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
                  gkDiveStartProg: 0.50
                };
              } else if (Math.random() < 0.25) {
                const hitWood = Math.random() < 0.38;
                if (hitWood) {
                  const wTarget = pickWoodworkTarget({
                    attRightNow: true,
                    fromY: 50,
                    curveAmt: b.curve,
                    maxZAmt: 4.5,
                    shotStyle: 'normal',
                    flightType: 'shootout_kick'
                  });
                  b.toX = wTarget.toX;
                  b.toY = wTarget.toY;
                  b.endZ = wTarget.endZ;
                  b.maxZ = wTarget.maxZ;
                  const diveY = clamp(b.toY, 42.0, 58.0);
                  b.shotPlan = {
                    outcome: 'woodwork',
                    woodworkPart: wTarget.woodworkPart,
                    woodworkPostSide: wTarget.postSide,
                    shootoutScored: false,
                    gkDiveTargetY: diveY,
                    gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
                    gkDiveStartProg: 0.50
                  };
                } else {
                  b.toX = 101.2;
                  b.toY = Math.random() < 0.5 ? 36.8 + Math.random() * 4.0 : 59.2 + Math.random() * 4.0;
                  const diveY = clamp(b.toY, 42.0, 58.0);
                  b.shotPlan = {
                    outcome: 'miss',
                    shootoutScored: false,
                    gkDiveTargetY: diveY,
                    gkDiveDir: gk ? (diveY >= gk.y ? 1 : -1) : 1,
                    gkDiveStartProg: 0.50
                  };
                }
              } else {
                const gkSaveX = gk ? clamp(gk.x, 95.8, 98.4) : 97.8;
                b.toX = gkSaveX;
                b.toY = shotY;
                b.shotPlan = {
                  outcome: 'save',
                  shootoutScored: false,
                  gkDiveTargetY: shotY,
                  gkDiveDir: gk ? (shotY >= gk.y ? 1 : -1) : 1,
                  gkDiveStartProg: 0.48,
                  gkSaveX
                };
              }
              if (kicker) {
                kicker.facing = Math.atan2(shotY - 50, 100 - 88.5);
                kicker.acrobatType = 'shoot_power';
                kicker.acrobatMax = 0.48;
                kicker.acrobatTimer = 0.48;
                addWorldFx(w, {
                  type: 'kick_burst',
                  x: 88.5,
                  y: 50,
                  toX: 100,
                  toY: shotY,
                  label: '',
                  color: '#fb923c',
                  ttl: 0.35,
                  maxTtl: 0.35
                });
              }
              SFX.shot();
              setShootoutUi({ ...sh, hKicks: sh.hKicks.slice(), aKicks: sh.aKicks.slice() });
            }
          } else {
            const b = w.ball;
            b.progress = Math.min(1, b.progress + (rawDt * (slowActive ? 0.28 : 0.58)) / Math.max(0.24, b.duration));
            const t = b.progress;
            const omt = 1 - t;
            b.x = omt * omt * b.fromX + 2 * omt * t * ((b.fromX + b.toX) * 0.5) + t * t * b.toX;
            b.y = omt * omt * b.fromY + 2 * omt * t * ((b.fromY + b.toY) * 0.5 + b.curve) + t * t * b.toY;
            b.z = Math.sin(t * Math.PI) * b.maxZ;
            b.trail.push({ x: b.x, y: b.y, z: b.z });
            if (b.trail.length > 12) b.trail.shift();
            const defGk = w.agents.find((a) => !a.sentOff && a.side !== sh.turn && a.pos === 'GK');
            syncShotGkDive(defGk, b);
            if (b.progress >= 1) {
              resolveSegmentArrival(w, 90);
            }
          }
          if (canvas) {
            drawLivePitchToCanvas(canvas, w, homeKit, awayKit, homeGkKit, awayGkKit, showRunVectors, homeTrim, awayTrim, showPositions, showRatings, simRef.current.liveForm);
          }
          rafId = window.requestAnimationFrame(frame);
          return;
        }

        // Open play & Stoppage clock progression (pause during key slow-mo / VAR / goals / penalties)
        const minDelta = rawDt * 0.88 * speedMul;
        const pauseClock =
          Boolean(w.varReview) ||
          w.celebrateTimer > 0 ||
          w.dramaSlowSec > 0 ||
          w.pendingSetPiece?.type === 'penalty' ||
          isSlowShot;
        if (!pauseClock) {
          if (w.phase === 'play1') {
            w.minuteFloat = Math.min(45, w.minuteFloat + minDelta);
          } else if (w.phase === 'play2') {
            w.minuteFloat = Math.min(90, w.minuteFloat + minDelta);
          } else if (w.phase === 'stop1' || w.phase === 'stop2') {
            w.stoppageFloat += minDelta;
          }
        }
        const curIntMin = Math.floor(w.minuteFloat);

        // Process any crossed minute ticks cleanly
        while (w.lastTickedMin < curIntMin) {
          w.lastTickedMin++;
          onMinuteTick(w.lastTickedMin);
        }

        // Update tactical targets
        updateAgentTargets(w, Math.max(1, curIntMin));

        // Smooth physical player movement + running stride + GK dive (exempt celebrations, kickoff reset, & set-piece setup from slow-mo throttle)
        const isCelebratingNow = w.celebrateTimer > 0;
        const isKickoffResetting = w.pendingSetPiece?.type === 'kickoff' && !isCelebratingNow;
        const isSetPieceSettingUp = Boolean(w.pendingSetPiece) && w.pendingSetPiece?.type !== 'kickoff' && !isCelebratingNow;
        const baseMoveScale = speedMul > 2.6 ? 1.85 : speedMul > 2.0 ? 1.55 : speedMul > 1.0 ? 1.05 : speedMul < 0.22 ? 0.24 : speedMul < 0.5 ? 0.44 : 0.74;
        const moveScale = isCelebratingNow
          ? Math.max(1.22, Math.min(2.15, baseMoveScale * 1.25))
          : isKickoffResetting
            ? Math.max(2.7, baseMoveScale * 2.45)
            : isSetPieceSettingUp
              ? Math.max(2.15, baseMoveScale * 1.85)
              : slowActive
                ? (speedMul < 0.22 ? 0.16 : speedMul < 0.5 ? 0.22 : 0.34)
                : baseMoveScale;
        const hFrameCfg = getEffectiveTeamCfg('H', Math.max(1, curIntMin));
        const aFrameCfg = getEffectiveTeamCfg('A', Math.max(1, curIntMin));
        w.agents.forEach((ag) => {
          if (ag.sentOff) return;
          if (ag.subEnterTimer && ag.subEnterTimer > 0) {
            ag.subEnterTimer = Math.max(0, ag.subEnterTimer - rawDt);
          }
          if (ag.acrobatTimer && ag.acrobatTimer > 0) {
            ag.acrobatTimer = Math.max(0, ag.acrobatTimer - rawDt * (slowActive ? 0.55 : speedMul < 0.25 ? 0.5 : 1));
          }
          if (ag.intent === 'DIVE') {
            const ballInShotFlight =
              w.ball.progress < 1 &&
              (w.ball.flightType === 'shot' || w.ball.flightType === 'freekick' || w.ball.flightType === 'penalty');
            if (ballInShotFlight && !w.pendingSetPiece && !w.varReview) {
              return;
            }
            if (ag.intentTimer > 0) {
              const diveDt = rawDt * (slowActive ? 0.35 : baseMoveScale);
              ag.intentTimer -= diveDt;
              ag.diveProgress = clamp(Math.max(ag.diveProgress, 1 - ag.intentTimer / 0.88), 0, 1);
              if (ag.diveTargetY != null) {
                ag.y = clamp(ag.y + (ag.diveTargetY - ag.y) * Math.min(1, diveDt * 8.0), 39, 61);
                ag.ty = ag.y;
              }
              if (ag.intentTimer <= 0) {
                ag.intent = 'SUPPORT';
                ag.diveProgress = 0;
                ag.diveTargetY = undefined;
              }
            } else {
              ag.intent = 'SUPPORT';
              ag.diveProgress = 0;
              ag.diveTargetY = undefined;
            }
          }
          const dx = ag.tx - ag.x;
          const dy = ag.ty - ag.y;
          const dist = Math.hypot(dx, dy);
          const agCfg = ag.side === 'H' ? hFrameCfg : aFrameCfg;
          const agInPoss = w.ball.possessionSide === ag.side;
          const tempoMult = agCfg.tempo === 2 ? 1.13 : agCfg.tempo === 0 ? 0.88 : 1.0;
          const pressMult = !agInPoss && ag.intent === 'PRESS' && agCfg.press === 2 ? 1.11 : !agInPoss && agCfg.press === 0 ? 0.93 : 1.0;
          const counterOrSiegeMult =
            agInPoss && (agCfg.tac === 'Z' || agCfg.tac === 'D') && (ag.pos === 'FW' || ag.intent === 'MAKE_RUN')
              ? 1.11
              : agCfg.tac === 'X' && (ag.pos === 'FW' || ag.intent === 'OVERLAP' || ag.intent === 'MAKE_RUN')
                ? 1.08
                : 1.0;
          const agFacMods = getSideFacMods(ag.side);
          const lowFitSpd = ag.fit < 50 ? clamp(0.76 + (agFacMods.lowFitResilience - 0.7) * 0.45, 0.76, 0.94) : 1.0;
          const isCarrySprint = ag.intent === 'CARRY' && w.ball.bounceNext?.pendingShot?.shooterId === ag.id;
          const maxSpd =
            (18 + ((ag.d.spd || 60) - 55) * 0.22) *
            (ag.intent === 'PASS_TARGET' ? 1.65 : isCarrySprint ? 1.45 : ag.intent === 'MAKE_RUN' || ag.intent === 'OVERLAP' || ag.intent === 'PRESS' || ag.intent === 'RESET' || ag.intent === 'WALL' ? 1.42 : 1.0) *
            tempoMult *
            pressMult *
            counterOrSiegeMult *
            lowFitSpd *
            turfMatchMods.sprintSpeedMult *
            agFacMods.sprintBonusMult *
            ((ag.godPowerMins ?? 0) > 0 ? 1.24 : (ag.blessedMins ?? 0) > 0 ? 1.14 : 1.0) *
            (w.miracle?.side === ag.side && w.miracle.minsLeft > 0 ? (w.miracle.maxDeficit >= 3 ? 1.2 : 1.16) : 1.0) *
            moveScale;
          const isUrgent = ag.intent === 'PASS_TARGET' || ag.intent === 'PRESS' || ag.intent === 'RESET' || ag.intent === 'MAKE_RUN' || ag.intent === 'WALL';
          const tempoAccelMult = agCfg.tempo === 2 ? 1.18 : agCfg.tempo === 0 ? 0.85 : 1.0;
          const accelRate = Math.min(1, rawDt * (isUrgent ? 14.5 : 9.2) * tempoAccelMult);
          const stepSpd = Math.min(dist * 6.5 * moveScale, maxSpd);
          if (dist > 0.16) {
            const desiredVx = (dx / dist) * stepSpd;
            const desiredVy = (dy / dist) * stepSpd;
            ag.vx += (desiredVx - ag.vx) * accelRate;
            ag.vy += (desiredVy - ag.vy) * accelRate;
          } else {
            const damp = Math.pow(0.04, rawDt);
            ag.vx *= damp;
            ag.vy *= damp;
          }
          const curSpd = Math.hypot(ag.vx, ag.vy);
          if (curSpd > 0.12) {
            const isSpTaker = Boolean(w.pendingSetPiece && w.pendingSetPiece.type !== 'kickoff' && w.pendingSetPiece.takerId === ag.id);
            const minX = isSpTaker ? 1.5 : ag.pos === 'GK' ? 1.6 : 3;
            const maxX = isSpTaker ? 98.5 : ag.pos === 'GK' ? 98.4 : 97;
            const minY = isSpTaker ? 1.2 : 4;
            const maxY = isSpTaker ? 98.8 : 96;
            ag.x = clamp(ag.x + ag.vx * rawDt, minX, maxX);
            ag.y = clamp(ag.y + ag.vy * rawDt, minY, maxY);
            ag.stride += curSpd * rawDt * 0.85;
          }
          let targetAngle =
            dist > 0.38 && curSpd > 1.2
              ? Math.atan2(ag.vy, ag.vx)
              : Math.atan2(w.ball.y - ag.y, w.ball.x - ag.x);
          if (ag.intent === 'CELEBRATE' && w.celebration && dist <= 0.65) {
            const cel = w.celebration;
            if (ag.celebrateRole === 'scorer') {
              if (cel.style === 'bow_crowd' || cel.style === 'calm_shush') {
                targetAngle = cel.anchorY < 50 ? -Math.PI / 2 : Math.PI / 2;
              } else if (cel.style === 'finger_point' && cel.assisterId) {
                const asAg = w.agents.find((z) => z.id === cel.assisterId);
                targetAngle = asAg ? Math.atan2(asAg.y - ag.y, asAg.x - ag.x) : (cel.anchorY < 50 ? -Math.PI / 2 : Math.PI / 2);
              }
            } else if (ag.celebrateRole === 'teammate' || ag.celebrateRole === 'assister') {
              targetAngle = Math.atan2(cel.anchorY - ag.y, cel.anchorX - ag.x);
            } else if (ag.celebrateRole === 'conceded') {
              targetAngle = Math.atan2(50 - ag.y, 50 - ag.x);
            }
          } else if (isKickoffResetting && dist <= 0.45) {
            targetAngle = isAttackRight(w, ag.side) ? 0 : Math.PI;
          } else if (isSetPieceSettingUp && dist <= 0.65 && w.pendingSetPiece) {
            if (ag.intent === 'WALL' || w.pendingSetPiece.takerId === ag.id) {
              targetAngle = Math.atan2(w.pendingSetPiece.y - ag.y, w.pendingSetPiece.x - ag.x);
            } else if (w.pendingSetPiece.type === 'penalty' && ag.pos === 'GK' && ag.side !== w.pendingSetPiece.side) {
              targetAngle = Math.atan2(w.pendingSetPiece.y - ag.y, w.pendingSetPiece.x - ag.x);
            } else if (w.pendingSetPiece.type === 'corner' && w.pendingSetPiece.takerId === ag.id) {
              targetAngle = Math.atan2(50 - ag.y, (isAttackRight(w, w.pendingSetPiece.side) ? 90 : 10) - ag.x);
            }
          }
          let angleDiff = targetAngle - ag.facing;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          ag.facing += angleDiff * Math.min(1, rawDt * (dist > 0.38 && curSpd > 1.2 ? 10.5 : 6.5));
        });

        // Soft physical body separation so players never visually stack identically on top of each other
        const agLen = w.agents.length;
        const celebMinSep = w.celebration?.style === 'group_huddle' ? 1.15 : 1.45;
        const activeSpTakerId = w.pendingSetPiece && w.pendingSetPiece.type !== 'kickoff' ? w.pendingSetPiece.takerId : undefined;
        for (let i = 0; i < agLen; i++) {
          const a = w.agents[i];
          if (a.sentOff || a.intent === 'WALL' || a.intent === 'DIVE' || a.id === activeSpTakerId) continue;
          for (let j = i + 1; j < agLen; j++) {
            const o = w.agents[j];
            if (o.sentOff || o.intent === 'WALL' || o.intent === 'DIVE' || o.id === activeSpTakerId) continue;
            if ((a.intent === 'CELEBRATE') !== (o.intent === 'CELEBRATE')) continue;
            const minSep = a.intent === 'CELEBRATE' ? celebMinSep : 1.9;
            const sdx = a.x - o.x;
            const sdy = a.y - o.y;
            const sdSq = sdx * sdx + sdy * sdy;
            if (sdSq > 0.0004 && sdSq < minSep * minSep) {
              const sd = Math.sqrt(sdSq);
              const push = (minSep - sd) * 0.28;
              const nx = sdx / sd;
              const ny = sdy / sd;
              a.x = clamp(a.x + nx * push, 2.5, 97.5);
              a.y = clamp(a.y + ny * push, 4, 96);
              o.x = clamp(o.x - nx * push, 2.5, 97.5);
              o.y = clamp(o.y - ny * push, 4, 96);
            }
          }
        }

        // VAR Review countdown (steady 1x real-time so slow-mo & verdict are easy to follow), Set-piece wait countdown, or Ball physics
        if (w.varReview) {
          w.varReview.waitSec = Math.max(0, w.varReview.waitSec - rawDt);
          if (w.varReview.waitSec <= 0) {
            resolveVarReview(w, Math.max(1, curIntMin));
          }
        } else if (w.pendingSetPiece) {
          const spType = w.pendingSetPiece.type;
          const isImportantSetPiece =
            spType === 'penalty' ||
            spType === 'kickoff' ||
            spType === 'offside' ||
            spType === 'corner' ||
            (spType === 'freekick' && (w.pendingSetPiece.wallPlayers?.length || 0) > 0);
          const spRate = isImportantSetPiece
            ? speedMul > 2.6 ? 1.1 : speedMul > 2.0 ? 0.95 : speedMul < 0.5 ? 0.65 : 0.85
            : speedMul > 2.6 ? 1.55 : speedMul > 2.0 ? 1.3 : speedMul < 0.5 ? 0.65 : 0.85;

          if (spType === 'kickoff') {
            if (w.celebrateTimer <= 0) {
              const kickTeam = w.pendingSetPiece.side === 'H' ? homeOrig : awayOrig;
              w.phaseLabel = `⚽ กลับเข้าตำแหน่งเตรียมเขี่ยบอล (${kickTeam.name})`;
              w.phaseTone = 'normal';
              w.ball.x = w.pendingSetPiece.x;
              w.ball.y = w.pendingSetPiece.y;
              w.ball.z = 0;

              const kickoffFormationReady = w.agents.every(
                (ag) => ag.sentOff || Math.hypot(ag.tx - ag.x, ag.ty - ag.y) <= 1.9
              );
              if (!kickoffFormationReady) {
                w.kickoffReturnElapsed = (w.kickoffReturnElapsed || 0) + rawDt * (speedMul > 2.0 ? 1.35 : 1.0);
                if (w.kickoffReturnElapsed >= 4.5) {
                  w.agents.forEach((ag) => {
                    if (!ag.sentOff) {
                      ag.x = ag.tx;
                      ag.y = ag.ty;
                      ag.vx = 0;
                      ag.vy = 0;
                    }
                  });
                }
              } else {
                w.pendingSetPiece.waitSec = Math.max(0, w.pendingSetPiece.waitSec - rawDt * spRate);
                if (w.pendingSetPiece.waitSec <= 0) {
                  w.kickoffReturnElapsed = 0;
                  scheduleNextPlay(w, Math.max(1, curIntMin));
                }
              }
            }
          } else {
            const sp = w.pendingSetPiece;
            sp.setupElapsed = (sp.setupElapsed || 0) + rawDt * (speedMul > 2.0 ? 1.35 : 1.0);
            const spTaker = sp.takerId ? w.agents.find((a) => a.id === sp.takerId && !a.sentOff) : undefined;
            const takerReady = !spTaker || Math.hypot(spTaker.tx - spTaker.x, spTaker.ty - spTaker.y) <= 1.75;
            const penGk =
              spType === 'penalty'
                ? w.agents.find((a) => !a.sentOff && a.side !== sp.side && a.pos === 'GK')
                : undefined;
            const penGkReady = !penGk || Math.hypot(penGk.tx - penGk.x, penGk.ty - penGk.y) <= 1.8;
            const wallReady =
              spType !== 'freekick' ||
              !sp.wallIds?.length ||
              sp.wallIds.every((wid) => {
                const wag = w.agents.find((a) => a.id === wid && !a.sentOff);
                return !wag || Math.hypot(wag.tx - wag.x, wag.ty - wag.y) <= 2.4;
              });
            const spAttRight = isAttackRight(w, sp.side);
            let boxAttackersReady = true;
            if (spType === 'corner') {
              const cornerAttackers = w.agents.filter(
                (a) => !a.sentOff && a.side === sp.side && a.pos !== 'GK' && a.id !== sp.takerId && (baseRoleOf(a.role) === 'CB' || a.pos === 'FW')
              );
              const arrivedCount = cornerAttackers.filter(
                (a) => Math.hypot(a.tx - a.x, a.ty - a.y) <= 3.6 || (spAttRight ? a.x >= 82 : a.x <= 18)
              ).length;
              boxAttackersReady = arrivedCount >= Math.min(3, cornerAttackers.length);
            } else if (spType === 'freekick') {
              const fkGoalX = spAttRight ? 100 : 0;
              if (Math.hypot(fkGoalX - sp.x, 50 - sp.y) >= 36) {
                const fkBoxRunners = w.agents.filter(
                  (a) => !a.sentOff && a.side === sp.side && a.id !== sp.takerId && (baseRoleOf(a.role) === 'CB' || a.pos === 'FW')
                );
                const arrivedFk = fkBoxRunners.filter(
                  (a) => Math.hypot(a.tx - a.x, a.ty - a.y) <= 4.0 || (spAttRight ? a.x >= 80 : a.x <= 20)
                ).length;
                boxAttackersReady = arrivedFk >= Math.min(2, fkBoxRunners.length);
              }
            }
            const timedOut = sp.setupElapsed >= 6.8;
            if (timedOut && spTaker && !takerReady) {
              spTaker.x = spTaker.tx;
              spTaker.y = spTaker.ty;
              spTaker.vx = 0;
              spTaker.vy = 0;
            }
            const setPieceReady = (takerReady && penGkReady && wallReady && boxAttackersReady) || timedOut;
            sp.waitSec = Math.max(setPieceReady ? 0 : 0.36, sp.waitSec - rawDt * spRate);
            const keepBallOutForGoalKick = spType === 'goalkick' && sp.waitSec > 0.45;
            if (spType === 'throwin') {
              w.ball.trail.length = 0;
              const pickupDist = spTaker ? Math.hypot(spTaker.x - w.ball.x, spTaker.y - w.ball.y) : 0;
              if (takerReady || pickupDist <= 2.4) {
                const handX = spTaker ? spTaker.x : sp.x;
                const handY = spTaker ? spTaker.y : sp.y;
                const lerpA = Math.min(1, rawDt * 18);
                w.ball.x += (handX - w.ball.x) * lerpA;
                w.ball.y += (handY - w.ball.y) * lerpA;
                w.ball.z += (1.8 - w.ball.z) * lerpA;
              } else {
                w.ball.z = 0;
              }
            } else if (!keepBallOutForGoalKick) {
              w.ball.trail.length = 0;
              w.ball.x = sp.x;
              w.ball.y = sp.y;
              w.ball.z = 0;
            }
            if (setPieceReady && sp.waitSec <= 0) {
              scheduleNextPlay(w, Math.max(1, curIntMin));
            }
          }
        } else {
          const b = w.ball;
          const ballRate = slowActive
            ? speedMul < 0.22 ? 0.13 : speedMul < 0.5 ? 0.19 : 0.24
            : speedMul > 2.6
              ? 1.8
              : speedMul > 2.0
                ? 1.48
              : speedMul > 1.0
                ? 1.02
                : speedMul < 0.22
                  ? 0.22
                  : speedMul < 0.5
                    ? 0.42
                    : 0.72;
          const stepProg = (rawDt * ballRate) / Math.max(0.18, b.duration);
          b.progress = Math.min(1, b.progress + stepProg);

          if (b.carrierId && b.flightType === 'carry') {
            const car = w.agents.find((a) => a.id === b.carrierId && !a.sentOff);
            if (car) {
              const carSpd = Math.hypot(car.vx, car.vy);
              const movingScale = clamp(carSpd / 10, 0, 1);
              const tapFwd = 1.15 + Math.abs(Math.sin(car.stride * 0.52)) * 0.42 * movingScale;
              const tapLat = Math.sin(car.stride * 0.5) * 0.18 * movingScale;
              const cosC = Math.cos(car.facing);
              const sinC = Math.sin(car.facing);
              b.x = clamp(car.x + cosC * tapFwd - sinC * tapLat, 2, 98);
              b.y = clamp(car.y + sinC * tapFwd + cosC * tapLat, 3, 97);
              b.z = Math.abs(Math.sin(car.stride * 0.52)) * 0.35 * movingScale;
            }
          } else {
            const t = b.progress;
            const omt = 1 - t;
            const ctrlX = (b.fromX + b.toX) * 0.5;
            const ctrlY = (b.fromY + b.toY) * 0.5 + b.curve;
            b.x = omt * omt * b.fromX + 2 * omt * t * ctrlX + t * t * b.toX;
            b.y = omt * omt * b.fromY + 2 * omt * t * ctrlY + t * t * b.toY;
            if (b.shotStyle === 'knuckle') {
              const ang = Math.atan2(b.toY - b.fromY, b.toX - b.fromX) + Math.PI / 2;
              const wobble = Math.sin(t * Math.PI * 3.5) * Math.sin(t * Math.PI) * 2.1;
              b.x = clamp(b.x + Math.cos(ang) * wobble, -2, 102);
              b.y = clamp(b.y + Math.sin(ang) * wobble, 1, 99);
            }
            const sZ = b.startZ ?? 0;
            const eZ = b.endZ ?? 0;
            b.z = sZ + (eZ - sZ) * t + Math.sin(t * Math.PI) * b.maxZ;
          }

          b.trail.push({ x: b.x, y: b.y, z: b.z });
          if (b.trail.length > (slowActive || isSlowShot ? 18 : 9)) b.trail.shift();

          if (isSlowShot) {
            const defSide: 'H' | 'A' = b.possessionSide === 'H' ? 'A' : 'H';
            const defGk = w.agents.find((a) => !a.sentOff && a.side === defSide && a.pos === 'GK');
            syncShotGkDive(defGk, b);
          }

          if (b.progress >= 1) {
            resolveSegmentArrival(w, Math.max(1, curIntMin));
            if (!w.pendingSetPiece && !w.varReview && w.ball.progress >= 1) {
              scheduleNextPlay(w, Math.max(1, curIntMin));
            }
          }
        }

        // Possession accumulator
        w.possTicksTotal++;
        if (w.ball.possessionSide === 'H') w.possTicksH++;

        // Phase transitions: Added time & Halftime & Fulltime / Shootout
        const activePlayInFlight =
          Boolean(w.varReview) ||
          w.celebrateTimer > 0 ||
          w.dramaSlowSec > 0 ||
          w.ball.flightType === 'shot' ||
          w.ball.flightType === 'freekick' ||
          w.ball.flightType === 'penalty' ||
          Boolean(w.ball.bounceNext?.goalPayload) ||
          Boolean(w.ball.bounceNext?.looseRebound) ||
          w.ball.flightType === 'bounce' ||
          w.pendingSetPiece?.type === 'penalty';
        if (w.phase === 'play1' && w.minuteFloat >= 45) {
          w.phase = 'stop1';
          w.stoppageFloat = 0;
          const evCount1 = simRef.current.evs.filter((e) => e.m <= 45).length + simRef.current.cards.filter((c) => c.m <= 45).length;
          w.added1 = clamp(1 + Math.floor(evCount1 * 0.6) + (w.varChecks > 0 ? 1 : 0) + (Math.random() < 0.35 ? 1 : 0), 1, 4);
          pushLog(45, `⏱️ ทดเวลาบาดเจ็บครึ่งแรก +${w.added1} นาที`, 'sys');
          w.phaseLabel = `⏱️ ทดเวลาบาดเจ็บครึ่งแรก +${w.added1} น.`;
          w.phaseTone = 'setpiece';
        } else if (w.phase === 'stop1' && w.stoppageFloat >= w.added1 && !activePlayInFlight) {
          w.phase = 'halftime';
          SFX.halfWhistle();
          maybeAiLiveCoachAdjust(w, 'H', 45, 'ht', false);
          maybeAiLiveCoachAdjust(w, 'A', 45, 'ht', false);
          pushLog(45, `☕ พักครึ่งเวลา: ${homeOrig.name} ${simRef.current.gh}-${simRef.current.ga} ${awayOrig.name}`, 'sys');
          pushTimeline(45, 'N', 'first_half', 'จบครึ่งแรก', `${simRef.current.gh} - ${simRef.current.ga}`);
          w.phaseLabel = `☕ พักครึ่งเวลา (${simRef.current.gh} - ${simRef.current.ga})`;
          w.phaseTone = 'normal';
          if (mlandMatchTab === 'stats' || mlandMatchTab === 'chat') {
            prevMatchTabBeforeTacticsRef.current = mlandMatchTab;
          }
          setLivePlayerStatsUi({ ...simRef.current.playerStats });
          setInjuredNamesUi(simRef.current.injuredNames.slice());
          setMlandMatchTab('tactics');
          syncUiStatsFromWorld(w, 45);
        } else if (w.phase === 'play2' && w.minuteFloat >= 90) {
          w.phase = 'stop2';
          w.stoppageFloat = 0;
          const evCount2 = simRef.current.evs.filter((e) => e.m > 45).length + simRef.current.cards.filter((c) => c.m > 45).length + simRef.current.subs.length;
          w.added2 = clamp(2 + Math.floor(evCount2 * 0.45) + (w.varChecks > 0 ? 1 : 0), 2, 6);
          pushLog(90, `⏱️ ทดเวลาบาดเจ็บครึ่งหลัง +${w.added2} นาที`, 'sys');
          w.phaseLabel = `⏱️ ทดเวลาบาดเจ็บครึ่งหลัง +${w.added2} น.`;
          w.phaseTone = 'setpiece';
        } else if (w.phase === 'stop2' && w.stoppageFloat >= w.added2 && !activePlayInFlight) {
          if (kind !== 'league' && !allowDraw && simRef.current.gh === simRef.current.ga) {
            startLiveShootout(w);
          } else {
            finalizeMatch();
          }
        }

        const rawBannerKey = `${w.dramaSlowSec > 0 ? 1 : 0}|${w.dramaLabel || ''}|${w.phaseLabel || ''}|${w.phaseTone}|${w.ball.flightType}|${cineSlowMo ? 1 : 0}`;
        if (lastRawBannerKeyRef.current !== rawBannerKey) {
          lastRawBannerKeyRef.current = rawBannerKey;
          const liveBanner = buildBannerPayload(w, cineSlowMo);
          if (lastBannerSigRef.current !== liveBanner.sig) {
            lastBannerSigRef.current = liveBanner.sig;
            setActionBanner({
              label: liveBanner.label,
              tone: liveBanner.tone,
              actors: liveBanner.actors,
              teamSide: liveBanner.teamSide
            });
          }
        }

        const hasLiveVar = Boolean(w.varReview);
        if (lastLiveVarActiveRef.current !== hasLiveVar) {
          lastLiveVarActiveRef.current = hasLiveVar;
          setLiveVarActive(hasLiveVar);
        }

        uiSyncAccum += rawDt;
        if (uiSyncAccum >= 0.28) {
          uiSyncAccum = 0;
          syncUiStatsFromWorld(w, curIntMin);
        }

        // Capture live rolling buffer & active post-climax frames for Pro-Crew Highlight Editor
        if (!w.varReview && (w.phase !== 'shootout' || Boolean(w.shootout))) {
          highlightClockRef.current += rawDt;
          const hlSampleInterval = w.phase === 'shootout' ? 0.08 : speedMul > 1.8 ? 0.095 : 0.14;
          if (highlightClockRef.current - lastHighlightSampleClockRef.current >= hlSampleInterval) {
            lastHighlightSampleClockRef.current = highlightClockRef.current;
            const isIdleKickoff =
              (w.pendingSetPiece?.type === 'kickoff' && w.ball.x === 50 && w.ball.y === 50) ||
              (w.phase === 'shootout' && Boolean(w.shootout) && !w.shootout!.activeShot && w.shootout!.waitSec > 0.75 && activePostCapturesRef.current.length === 0);
            if (!isIdleKickoff) {
              const keepIds = activePostCapturesRef.current.length
                ? new Set(activePostCapturesRef.current.map((e) => e.meta.actorName))
                : undefined;
              const smp = captureWorldSample(w, highlightClockRef.current, keepIds);
              rollingSamplesRef.current.push(smp);
              if (rollingSamplesRef.current.length > 28) {
                rollingSamplesRef.current.shift();
              }
              if (activePostCapturesRef.current.length > 0) {
                const stillPending: typeof activePostCapturesRef.current = [];
                let completedAny = false;
                for (const entry of activePostCapturesRef.current) {
                  entry.postSamples.push(smp);
                  entry.remainingSamples -= 1;
                  if (entry.remainingSamples <= 0) {
                    const finalizedClip = finalizeHighlightClipFromSamples({
                      ...entry.meta,
                      preSamples: entry.preSamples,
                      postSamples: entry.postSamples
                    });
                    simRef.current.highlightClips.push(finalizedClip);
                    completedAny = true;
                  } else {
                    stillPending.push(entry);
                  }
                }
                activePostCapturesRef.current = stillPending;
                if (completedAny) {
                  setHighlightClips(curateMatchHighlights(simRef.current.highlightClips));
                }
              }
            }
          }
        }
      }

      if (canvas && w.phase !== 'halftime' && !simRef.current.done) {
        drawLivePitchToCanvas(canvas, w, homeKit, awayKit, homeGkKit, awayGkKit, showRunVectorsRef.current, homeTrim, awayTrim, showPositionsRef.current, showRatingsRef.current, simRef.current.liveForm);
      }
      if (!pausedRef.current && !doneRef.current && !simRef.current.done && w.phase !== 'halftime') {
        rafId = window.requestAnimationFrame(frame);
      }
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, done, homeKit, awayKit, homeGkKit, awayGkKit, homeTrim, awayTrim, matchPhaseUi, mlandMatchTab, broadcastFullscreen]);

  const skipToEnd = useCallback(() => {
    if (doneRef.current || simRef.current.done) return;
    const w = worldRef.current!;
    flushHighlightCaptures(w);
    w.dramaSlowSec = 0;
    w.dramaLabel = null;
    clearWorldCelebration(w, 'SUPPORT');
    w.cardBanner = null;
    let penOutcome: { winnerHome: boolean; text: string; scoreText?: string } | null = null;
    setSfxSuppressed(true);
    isSkippingRef.current = true;
    skipLogsRef.current = logsRef.current.slice(0, 65);
    skipCommentsRef.current = liveCommentsRef.current.slice(0, 50);
    skipRateCacheRef.current.clear();
    try {
      if (w.varReview) {
        resolveVarReview(w, Math.max(1, Math.floor(w.minuteFloat)));
      }
      if (w.ball.flightType === 'bounce' && w.ball.bounceNext?.goalPayload) {
        w.ball.x = w.ball.toX;
        w.ball.y = w.ball.toY;
        w.ball.progress = 1;
        resolveSegmentArrival(w, Math.max(1, Math.floor(w.minuteFloat)));
      }
      if (w.phase === 'shootout' && w.shootout && !w.shootout.finished) {
        penOutcome = computePenWinnerInstant();
        if (!simRef.current.highlightClips.some((c) => c.kind === 'shootout_kick')) {
          const winSide: 'H' | 'A' = penOutcome.winnerHome ? 'H' : 'A';
          const loseSide: 'H' | 'A' = penOutcome.winnerHome ? 'A' : 'H';
          const winPool = w.agents.filter((a) => !a.sentOff && a.side === winSide && a.pos !== 'GK').sort((u, v) => v.d.fin - u.d.fin);
          const loseGk = w.agents.find((a) => !a.sentOff && a.side === loseSide && a.pos === 'GK');
          recordEventHighlight(w, 90, {
            kind: 'shootout_kick',
            side: winSide,
            attRight: true,
            actorName: winPool[0]?.id || (winSide === 'H' ? homeOrig.name : awayOrig.name),
            victimName: loseGk?.id,
            finishVerb: 'ซัดจุดโทษลูกชี้ขาดพาทีมคว้าชัย!',
            shotStyle: 'penalty',
            shotDistM: 11,
            shootoutScored: true,
            shootoutOutcome: 'goal',
            shootoutRound: Math.max(w.shootout.round, 5),
            shootoutDecisive: true,
            shootoutScoreText: penOutcome.scoreText,
            dramaFloor: 108
          });
        }
        w.shootout = null;
        setShootoutUi(null);
        pushLog(90, `🎯 ${penOutcome.text}`, 'sys');
      } else {
        const startMin = Math.floor(w.minuteFloat);
        if (startMin >= 45) {
          pushTimeline(45, 'N', 'first_half', 'จบครึ่งแรก', `${simRef.current.gh} - ${simRef.current.ga}`);
        }
        for (let m = startMin + 1; m <= 90; m++) {
          if (m === 46) {
            w.secondHalf = true;
            setIsSecondHalfUi(true);
            w.pendingSetPiece = null;
            w.agents = buildTeamAgents(getLiveHomeTeam(), 'H', simRef.current.homeLu, true).concat(
              buildTeamAgents(getLiveAwayTeam(), 'A', simRef.current.awayLu, true)
            );
            const ko2 = w.agents.find((a) => a.side === 'A' && !a.sentOff && a.pos !== 'GK') || w.agents[0];
            w.ball.x = 50;
            w.ball.y = 50;
            w.ball.fromX = 50;
            w.ball.fromY = 50;
            w.ball.toX = 50;
            w.ball.toY = 50;
            w.ball.progress = 1;
            w.ball.flightType = 'carry';
            w.ball.shotStyle = undefined;
            w.ball.possessionSide = 'A';
            w.ball.carrierId = ko2?.id || null;
            w.ball.targetId = null;
            pushTimeline(46, 'N', 'second_half', 'เริ่มครึ่งหลัง', 'ครึ่งหลัง');
          }
          stepInstantMinute(m, liveTacticsRef.current.tac);
          if (m === 45) {
            maybeAiLiveCoachAdjust(w, 'H', 45, 'ht', true);
            maybeAiLiveCoachAdjust(w, 'A', 45, 'ht', true);
            pushLog(45, `⏱️ จบครึ่งแรก: ${homeOrig.name} ${simRef.current.gh}-${simRef.current.ga} ${awayOrig.name}`, 'sys');
            pushTimeline(45, 'N', 'first_half', 'จบครึ่งแรก', `${simRef.current.gh} - ${simRef.current.ga}`);
          }
        }
        w.minuteFloat = 90;
        w.lastTickedMin = 90;
        w.dramaSlowSec = 0;
        w.dramaLabel = null;
        clearWorldCelebration(w, 'SUPPORT');
        w.cardBanner = null;
        if (w.sideline) {
          w.sideline.coachH.x = 43.3;
          w.sideline.coachH.tx = 43.3;
          w.sideline.coachA.x = 56.7;
          w.sideline.coachA.tx = 56.7;
        }
        if (canvasRef.current) {
          drawLivePitchToCanvas(canvasRef.current, w, homeKit, awayKit, homeGkKit, awayGkKit, showRunVectorsRef.current, homeTrim, awayTrim, showPositionsRef.current, showRatingsRef.current, simRef.current.liveForm);
        }
      }
      if (penOutcome) {
        finalizeMatch(penOutcome.winnerHome, penOutcome.text);
      } else {
        finalizeMatch();
      }
      syncSidelineBenches(w);
    } finally {
      isSkippingRef.current = false;
      skipLogsRef.current = null;
      skipCommentsRef.current = null;
      skipRateCacheRef.current.clear();
      setSfxSuppressed(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeKit, awayKit, homeGkKit, awayGkKit, homeTrim, awayTrim, homeOrig.name, awayOrig.name]);

  const performSubstitution = useCallback((outName: string, benchPlayer: Player) => {
    const sr = simRef.current;
    const w = worldRef.current!;
    const curMin = minuteRef.current;
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    const myPlayed = meIsHome ? sr.homePlayed : sr.awayPlayed;
    const mySubsCount = meIsHome ? sr.homeSubsCount : sr.awaySubsCount;
    if (mySubsCount >= 5) return;
    if (sr.sentOff.includes(outName)) return;
    const idx = myLu.indexOf(outName);
    if (idx < 0) return;

    SFX.sub();
    myLu[idx] = benchPlayer.n;
    if (!myPlayed.includes(benchPlayer.n)) myPlayed.push(benchPlayer.n);
    if (sr.liveForm[benchPlayer.n] == null) sr.liveForm[benchPlayer.n] = 6.5;
    if (meIsHome) sr.homeSubsCount++;
    else sr.awaySubsCount++;
    const subEv: MatchSubEvent = { m: curMin, t: meTeamOrig.id, inPlayer: benchPlayer.n, outPlayer: outName };
    sr.subs.push(subEv);

    // Swap live pitch agent immediately so the sub enters right on the pitch!
    const agIdx = w.agents.findIndex((a) => a.id === outName);
    let subbedAg: LivePitchAgent | undefined;
    if (agIdx >= 0) {
      const updated = buildTeamAgents(meTeamOrig, meIsHome ? 'H' : 'A', myLu, w.secondHalf);
      if (updated[idx]) {
        updated[idx].x = w.agents[agIdx].x;
        updated[idx].y = w.agents[agIdx].y;
        updated[idx].facing = w.agents[agIdx].facing;
        w.agents[agIdx] = updated[idx];
        subbedAg = updated[idx];
      }
      if (w.ball.carrierId === outName) w.ball.carrierId = benchPlayer.n;
      if (w.ball.targetId === outName) w.ball.targetId = benchPlayer.n;
    }

    triggerSubPitchAnim(w, subbedAg, meIsHome ? 'H' : 'A', meTeamOrig.name, benchPlayer.n, outName, curMin);
    setLiveLu(myLu.slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    syncSidelineBenches(w);
    triggerCoachShout(w, meIsHome ? 'H' : 'A', '🔄 ลงไปช่วยทีม!', 2.4);
    if (!w.pendingSetPiece && !w.varReview && w.celebrateTimer <= 0 && w.ball.flightType !== 'shot' && w.ball.flightType !== 'freekick' && w.ball.flightType !== 'penalty') {
      w.phaseLabel = `🔄 ${meTeamOrig.name}: 🔼 เข้า ${benchPlayer.n.split(' ')[0]} · 🔽 ออก ${outName.split(' ')[0]}`;
      w.phaseTone = 'normal';
    }
    pushTimeline(curMin, meIsHome ? 'H' : 'A', 'sub', benchPlayer.n, outName);
    pushLog(curMin, `🔄 เปลี่ยนตัว (${meTeamOrig.name}): 🔼 เข้า ${benchPlayer.n} · 🔽 ออก ${outName}`, 'sub', {
      subInfo: { teamId: meTeamOrig.id, inName: benchPlayer.n, outName }
    });
    ensureOnPitchCaptain(w, meIsHome ? 'H' : 'A', curMin, 'sub', false);
    if (injuryAlertRef.current && injuryAlertRef.current.name === outName) {
      setInjuryAlert(null);
    }
    setSubPickOut(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meIsHome, meTeamOrig]);

  const performOnPitchSwap = useCallback((nameA: string, nameB: string) => {
    if (nameA === nameB) return;
    const sr = simRef.current;
    const w = worldRef.current!;
    const curMin = minuteRef.current;
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    const idxA = myLu.indexOf(nameA);
    const idxB = myLu.indexOf(nameB);
    if (idxA < 0 || idxB < 0) return;

    SFX.tap();
    const tmp = myLu[idxA];
    myLu[idxA] = myLu[idxB];
    myLu[idxB] = tmp;

    const mySide: 'H' | 'A' = meIsHome ? 'H' : 'A';
    const updated = buildTeamAgents(meTeamOrig, mySide, myLu, w.secondHalf);
    updated.forEach((nextAg) => {
      const oldIdx = w.agents.findIndex((a) => a.side === mySide && a.id === nextAg.id);
      if (oldIdx >= 0) {
        const oldAg = w.agents[oldIdx];
        nextAg.x = oldAg.x;
        nextAg.y = oldAg.y;
        nextAg.facing = oldAg.facing;
        nextAg.stride = oldAg.stride;
        nextAg.injuredOut = oldAg.injuredOut;
        w.agents[oldIdx] = nextAg;
      }
    });

    setLiveLu(myLu.slice());
    pushLog(curMin, `🔀 สลับตำแหน่ง (${meTeamOrig.name}): ${nameA.split(' ')[0]} ↔ ${nameB.split(' ')[0]}`, 'sys');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meIsHome, meTeamOrig]);

  const handleQuickSubInjured = () => {
    if (!injuryAlert) return;
    const sr = simRef.current;
    const w = worldRef.current!;
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    const myPlayed = meIsHome ? sr.homePlayed : sr.awayPlayed;
    const mySubsCount = meIsHome ? sr.homeSubsCount : sr.awaySubsCount;
    if (mySubsCount >= 5) return;
    const idx = myLu.indexOf(injuryAlert.name);
    if (idx < 0) {
      setInjuryAlert(null);
      return;
    }
    const injPl = meTeamOrig.sq.find((q) => q.n === injuryAlert.name);
    const bestSub =
      (injPl ? benchList.find((b) => b.pos === injPl.pos) : undefined) ||
      benchList.find((b) => b.pos !== 'GK') ||
      benchList[0];
    if (!bestSub) return;

    SFX.sub();
    myLu[idx] = bestSub.n;
    if (!myPlayed.includes(bestSub.n)) myPlayed.push(bestSub.n);
    if (sr.liveForm[bestSub.n] == null) sr.liveForm[bestSub.n] = 6.5;
    if (meIsHome) sr.homeSubsCount++;
    else sr.awaySubsCount++;
    sr.subs.push({ m: minute, t: meTeamOrig.id, inPlayer: bestSub.n, outPlayer: injuryAlert.name });

    const agIdx = w.agents.findIndex((a) => a.id === injuryAlert.name);
    let subbedAg: LivePitchAgent | undefined;
    if (agIdx >= 0) {
      const updated = buildTeamAgents(meTeamOrig, meIsHome ? 'H' : 'A', myLu, w.secondHalf);
      if (updated[idx]) {
        updated[idx].x = w.agents[agIdx].x;
        updated[idx].y = w.agents[agIdx].y;
        updated[idx].facing = w.agents[agIdx].facing;
        w.agents[agIdx] = updated[idx];
        subbedAg = updated[idx];
      }
      if (w.ball.carrierId === injuryAlert.name) w.ball.carrierId = bestSub.n;
      if (w.ball.targetId === injuryAlert.name) w.ball.targetId = bestSub.n;
    }

    triggerSubPitchAnim(w, subbedAg, meIsHome ? 'H' : 'A', meTeamOrig.name, bestSub.n, injuryAlert.name, minute);
    setLiveLu(myLu.slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    syncSidelineBenches(w);
    triggerCoachShout(w, meIsHome ? 'H' : 'A', '🔄 แทนคนเจ็บด่วน!', 2.4);
    if (!w.pendingSetPiece && !w.varReview && w.celebrateTimer <= 0 && w.ball.flightType !== 'shot' && w.ball.flightType !== 'freekick' && w.ball.flightType !== 'penalty') {
      w.phaseLabel = `🔄 ${meTeamOrig.name}: 🔼 เข้า ${bestSub.n.split(' ')[0]} · 🔽 ออก ${injuryAlert.name.split(' ')[0]}`;
      w.phaseTone = 'normal';
    }
    pushTimeline(minute, meIsHome ? 'H' : 'A', 'sub', bestSub.n, injuryAlert.name);
    pushLog(minute, `🔄 เปลี่ยนตัวด่วนแทนผู้เจ็บ (${meTeamOrig.name}): 🔼 เข้า ${bestSub.n} · 🔽 ออก ${injuryAlert.name}`, 'sub', {
      subInfo: { teamId: meTeamOrig.id, inName: bestSub.n, outName: injuryAlert.name, badge: '🩹 แทนผู้เจ็บ', isInjury: true }
    });
    ensureOnPitchCaptain(w, meIsHome ? 'H' : 'A', minute, 'inj', false);
    setInjuryAlert(null);
    setSubPickOut(null);
    setPaused(false);
  };

  const findBestSubFor = useCallback((outName: string): Player | null => {
    const sr = simRef.current;
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    const myPlayed = meIsHome ? sr.homePlayed : sr.awayPlayed;
    const outPl = meTeamOrig.sq.find((q) => q.n === outName);
    const available = meTeamOrig.sq.filter(
      (q) => !myLu.includes(q.n) && !myPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n)
    );
    if (!available.length) return null;
    const scored = available.slice().sort((a, b) => {
      const scoreOf = (cand: Player) => {
        if (outPl?.pos === 'GK') {
          return (cand.pos === 'GK' ? 200 : 0) + cand.ov;
        }
        return (
          (cand.pos === 'GK' ? -250 : 0) +
          (outPl && cand.ro === outPl.ro ? 45 : outPl && cand.pos === outPl.pos ? 26 : 0) +
          cand.ov +
          ((cand.fit ?? 100) - 70) * 0.25
        );
      };
      return scoreOf(b) - scoreOf(a);
    });
    return scored[0] || null;
  }, [meIsHome, meTeamOrig.sq]);

  const handleAutoSubstitute = useCallback((outName: string): Player | null => {
    const sr = simRef.current;
    const w = worldRef.current!;
    const curMin = minuteRef.current;
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    const myPlayed = meIsHome ? sr.homePlayed : sr.awayPlayed;
    const mySubsCount = meIsHome ? sr.homeSubsCount : sr.awaySubsCount;
    if (mySubsCount >= 5 || sr.sentOff.includes(outName)) return null;
    const idx = myLu.indexOf(outName);
    if (idx < 0) return null;

    const bestSub = findBestSubFor(outName);
    if (!bestSub) return null;

    SFX.tap();
    myLu[idx] = bestSub.n;
    if (!myPlayed.includes(bestSub.n)) myPlayed.push(bestSub.n);
    if (sr.liveForm[bestSub.n] == null) sr.liveForm[bestSub.n] = 6.5;
    if (meIsHome) sr.homeSubsCount++;
    else sr.awaySubsCount++;
    const subEv: MatchSubEvent = { m: curMin, t: meTeamOrig.id, inPlayer: bestSub.n, outPlayer: outName };
    sr.subs.push(subEv);

    const agIdx = w.agents.findIndex((a) => a.id === outName);
    let subbedAg: LivePitchAgent | undefined;
    if (agIdx >= 0) {
      const updated = buildTeamAgents(meTeamOrig, meIsHome ? 'H' : 'A', myLu, w.secondHalf);
      if (updated[idx]) {
        updated[idx].x = w.agents[agIdx].x;
        updated[idx].y = w.agents[agIdx].y;
        updated[idx].facing = w.agents[agIdx].facing;
        w.agents[agIdx] = updated[idx];
        subbedAg = updated[idx];
      }
      if (w.ball.carrierId === outName) w.ball.carrierId = bestSub.n;
      if (w.ball.targetId === outName) w.ball.targetId = bestSub.n;
    }

    triggerSubPitchAnim(w, subbedAg, meIsHome ? 'H' : 'A', meTeamOrig.name, bestSub.n, outName, curMin);
    setLiveLu(myLu.slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    syncSidelineBenches(w);
    triggerCoachShout(w, meIsHome ? 'H' : 'A', '🔄 เปลี่ยนตัว!', 2.2);
    if (!w.pendingSetPiece && !w.varReview && w.celebrateTimer <= 0 && w.ball.flightType !== 'shot' && w.ball.flightType !== 'freekick' && w.ball.flightType !== 'penalty') {
      w.phaseLabel = `🔄 ${meTeamOrig.name}: 🔼 เข้า ${bestSub.n.split(' ')[0]} · 🔽 ออก ${outName.split(' ')[0]}`;
      w.phaseTone = 'normal';
    }
    pushTimeline(curMin, meIsHome ? 'H' : 'A', 'sub', bestSub.n, outName);
    pushLog(curMin, `🔄 เปลี่ยนตัวด่วน (${meTeamOrig.name}): 🔼 เข้า ${bestSub.n} · 🔽 ออก ${outName}`, 'sub', {
      subInfo: { teamId: meTeamOrig.id, inName: bestSub.n, outName, badge: '⚡ เปลี่ยนด่วน' }
    });
    ensureOnPitchCaptain(w, meIsHome ? 'H' : 'A', curMin, 'sub', false);
    if (injuryAlertRef.current && injuryAlertRef.current.name === outName) {
      setInjuryAlert(null);
    }
    setSubPickOut(null);
    return bestSub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findBestSubFor, meIsHome, meTeamOrig]);

  const fullTimeAnalysis = useMemo(() => {
    if (!done) return null;
    const sr = simRef.current;
    const playedNames: Record<number, string[]> = {
      [homeId]: sr.homePlayed.slice(),
      [awayId]: sr.awayPlayed.slice()
    };
    const xgH = Math.max(0.12, Math.round((matchStats.xgH + sr.gh * 0.12) * 100) / 100);
    const xgA = Math.max(0.12, Math.round((matchStats.xgA + sr.ga * 0.12) * 100) / 100);
    const tmpRes: MatchResult = { gh: sr.gh, ga: sr.ga, evs: sr.evs, xgH, xgA, pen: penResult?.winnerHome, playedNames };
    const { ratings, motm } = computePlayerRatings(liveHome, liveAway, tmpRes, state.p, {
      savesH: matchStats.savesH,
      savesA: matchStats.savesA,
      blocksH: matchStats.blocksH,
      blocksA: matchStats.blocksA
    });

    let pf: PlayerPerfResult | undefined;
    if (isPlayerMode && state.p) {
      const userPlayed = sr.userStarted || sr.userSubInMin != null;
      const mins = !userPlayed
        ? 0
        : sr.userStarted
          ? (sr.userSentOffMin ?? sr.userSubOutMin ?? 90)
          : Math.max(1, (sr.userSentOffMin ?? 90) - (sr.userSubInMin ?? 90));
      const userCards = sr.cards.filter((c) => c.t === state.me && c.who === myPlayerName);
      const yc = userCards.filter((c) => c.type === 'Y').length;
      const rc = userCards.filter((c) => c.type === 'R' || c.type === 'Y2R').length;
      pf = calcPlayerPerf(state, tmpRes, liveHome, liveAway, ratings, {
        played: userPlayed,
        mins,
        subIn: sr.userSubInMin != null,
        subOut: sr.userSubOutMin != null,
        yc,
        rc,
        motm: motm === myPlayerName
      });
    }
    return { xgH, xgA, ratings, motm, pf, playedNames, cards: sr.cards.slice(), subs: sr.subs.slice() };
  }, [done, matchStats, penResult, liveHome, liveAway, state, homeId, awayId, isPlayerMode, myPlayerName]);

  const benchList = useMemo(() => {
    const sr = simRef.current;
    const myPlayed = meIsHome ? sr.homePlayed : sr.awayPlayed;
    return meTeamOrig.sq
      .filter((q) => !liveLu.includes(q.n) && !myPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sentOff.includes(q.n))
      .sort((a, b) => b.ov - a.ov);
  }, [meTeamOrig.sq, liveLu, sentOff, meIsHome]);

  const compTitle =
    kind === 'nt'
      ? compTitleOverride || '🇹🇭 ช้างศึกทีมชาติไทย · แมตช์นานาชาติ'
      : kind === 'po'
        ? `🔥 ${state.po?.userPair?.label || 'รอบเพลย์ออฟเลื่อนชั้น / ชิงแชมป์ T3'}`
        : kind === 'asia'
          ? `🌏 บอลถ้วยทวีป · ${RN[state.ac?.r ?? 0] || 'รอบคัดเลือก'}`
          : kind === 'sc'
            ? `${EXTRA_CUP_META.sc.icon} ${EXTRA_CUP_META.sc.name} · ชิงชนะเลิศ`
            : kind === 'lc'
              ? `${EXTRA_CUP_META.lc.icon} ${EXTRA_CUP_META.lc.name} · ${RN[state.lc?.r ?? 0] || `รอบ ${(state.lc?.r ?? 0) + 1}`}`
              : kind === 'dc'
                ? `${EXTRA_CUP_META.dc.icon} ${EXTRA_CUP_META.dc.name} · ${RN[state.dc?.r ?? 0] || `รอบ ${(state.dc?.r ?? 0) + 1}`}`
                : kind === 'cup'
                  ? `🏆 ถ้วยประชาชน · ${RN[state.cup.r] || `รอบ ${state.cup.r + 1}`}`
                  : `⚽ ${getTeamLeagueName(homeOrig, { short: true, withFlag: true })} · นัดที่ ${state.md + 1}${isDerby ? ' 🔥 ดาร์บี้แมตช์' : ''}`;

  const compShortTitle =
    kind === 'nt'
      ? compTitleOverride || '🇹🇭 ทีมชาติไทย'
      : kind === 'po'
        ? '🔥 เพลย์ออฟ'
        : kind === 'asia'
          ? `🌏 ทวีป · ${RN[state.ac?.r ?? 0] || 'คัดเลือก'}`
          : kind === 'sc'
            ? `${EXTRA_CUP_META.sc.icon} ${EXTRA_CUP_META.sc.short}`
            : kind === 'lc'
              ? `${EXTRA_CUP_META.lc.icon} ${EXTRA_CUP_META.lc.short} · ${RN[state.lc?.r ?? 0] || `ร.${(state.lc?.r ?? 0) + 1}`}`
              : kind === 'dc'
                ? `${EXTRA_CUP_META.dc.icon} ${EXTRA_CUP_META.dc.short} · ${RN[state.dc?.r ?? 0] || `ร.${(state.dc?.r ?? 0) + 1}`}`
                : kind === 'cup'
                  ? `🏆 ถ้วย · ${RN[state.cup.r] || `ร.${state.cup.r + 1}`}`
                  : `⚽ ${getTeamLeagueName(homeOrig, { short: true, withFlag: true })} · น.${state.md + 1}${isDerby ? ' 🔥' : ''}`;

  const cycleMatchSpeed = useCallback(() => {
    const order: readonly (0.25 | 0.5 | 1 | 2 | 5)[] = [0.25, 0.5, 1, 2, 5];
    SFX.tap();
    setSpeed((cur) => order[(order.indexOf(cur) + 1) % order.length]);
  }, []);

  const handleConfirmFinish = useCallback(() => {
    if (!fullTimeAnalysis) return;
    const srDone = simRef.current;
    const curPen = penResultRef.current;
    const curStats = matchStatsRef.current;
    const curShootout = shootoutUiRef.current;
    const curLogs = logsRef.current;
    const curComments = liveCommentsRef.current;
    const curCaptains = liveCaptainsRef.current;
    const curTac = liveTacRef.current;
    const curLu = liveLuRef.current;
    const myGoalsCount = meIsHome ? srDone.gh : srDone.ga;
    const oppGoalsCount = meIsHome ? srDone.ga : srDone.gh;
    const isWin =
      myGoalsCount > oppGoalsCount ||
      Boolean(curPen && ((meIsHome && curPen.winnerHome) || (!meIsHome && !curPen.winnerHome)));
    const isCleanSheet = oppGoalsCount === 0;
    const myPlayedList = fullTimeAnalysis.playedNames[meTeamOrig.id] || [];
    const playerActions: Record<string, Partial<Record<PersonalMissionMetric, number>>> = {};
    myPlayedList.forEach((plName) => {
      const sqObj = meTeamOrig.sq.find((q) => q.n === plName);
      if (!sqObj) return;
      const st = srDone.playerStats[plName] || { shots: 0, onTarget: 0, passes: 0, tackles: 0, saves: 0, blocks: 0 };
      const qGoals = srDone.evs.filter((e) => !e.og && e.t === meTeamOrig.id && e.who === plName).length;
      const qAssists = srDone.evs.filter((e) => !e.og && e.t === meTeamOrig.id && e.as === plName).length;
      const qRt = fullTimeAnalysis.ratings[plName] ?? 0;
      const qHadCard = srDone.cards.some((c) => c.who === plName);
      playerActions[plName] = {
        matches: 1,
        wins: isWin ? 1 : 0,
        cleanSheets: isCleanSheet && (sqObj.pos === 'GK' || sqObj.pos === 'DF') ? 1 : 0,
        highRatings: qRt >= 7.2 ? 1 : 0,
        goals: qGoals,
        assists: qAssists,
        motm: fullTimeAnalysis.motm === plName ? 1 : 0,
        cleanGames: qHadCard ? 0 : 1,
        shots: st.shots || 0,
        onTarget: st.onTarget || 0,
        passes: st.passes || 0,
        tackles: st.tackles || 0,
        interceptions: st.interceptions || 0,
        blocks: st.blocks || 0,
        saves: st.saves || 0,
        setpieces: st.setpieces || 0,
        crossAssists: (st.crossAssists || 0) + qAssists,
        keyPasses: Math.max(st.keyPasses || 0, qAssists),
        dribbles: st.dribbles || 0,
        headers: st.headers || 0
      };
    });
    const compactLogs: ArchivedMatchLog[] = curLogs.map((l, idx) => ({
      id: String(l.id ?? `log-${idx}-${l.m}`),
      m: l.m,
      text: l.text,
      tone: l.tone || 'norm',
      ...(l.varReplayId ? { varReplayId: l.varReplayId } : {}),
      ...(l.subInfo
        ? {
            subInfo: {
              teamId: l.subInfo.teamId,
              inName: l.subInfo.inName,
              outName: l.subInfo.outName,
              ...(l.subInfo.badge ? { badge: l.subInfo.badge } : {}),
              ...(l.subInfo.isInjury ? { isInjury: l.subInfo.isInjury } : {})
            }
          }
        : {})
    }));
    const playerSaves: Record<string, number> = {};
    Object.entries(srDone.playerStats).forEach(([name, st]) => {
      if ((st.saves || 0) > 0) playerSaves[name] = st.saves;
    });
    const buildPlayedSlots = (tm: Team, initXi: string[]) => {
      const slots = getFormationSlots(tm);
      const map: Record<string, SubRole> = {};
      initXi.forEach((n, idx) => {
        const pl = tm.sq.find((q) => q.n === n);
        if (slots[idx]?.sp) map[n] = slots[idx].sp;
        else if (pl?.ro) map[n] = pl.ro;
      });
      srDone.subs
        .filter((sb) => sb.t === tm.id)
        .forEach((sb) => {
          if (!map[sb.inPlayer]) {
            const plIn = tm.sq.find((q) => q.n === sb.inPlayer);
            map[sb.inPlayer] = map[sb.outPlayer] || plIn?.ro || 'CM';
          }
        });
      return map;
    };
    const archivedStreamComments: ArchivedStreamComment[] = curComments.slice(0, 80).map((cm) => ({
      id: cm.id,
      m: cm.m,
      user: cm.user,
      text: cm.text,
      kind: cm.kind,
      ...(cm.donateBaht ? { donateBaht: cm.donateBaht } : {})
    }));
    SFX.tap();
    onFinishRef.current({
      gh: srDone.gh,
      ga: srDone.ga,
      evs: srDone.evs,
      xgH: fullTimeAnalysis.xgH,
      xgA: fullTimeAnalysis.xgA,
      possH: curStats.possH,
      shotsH: curStats.shotsH,
      shotsA: curStats.shotsA,
      onTargetH: curStats.onTargetH,
      onTargetA: curStats.onTargetA,
      passesH: curStats.passesH,
      passesA: curStats.passesA,
      cornersH: curStats.cornersH,
      cornersA: curStats.cornersA,
      foulsH: curStats.foulsH,
      foulsA: curStats.foulsA,
      offsidesH: curStats.offsidesH,
      offsidesA: curStats.offsidesA,
      savesH: curStats.savesH,
      savesA: curStats.savesA,
      ...(Object.keys(playerSaves).length ? { playerSaves } : {}),
      att: matchAttendance.att,
      cap: matchAttendance.cap,
      streamViewers: liveViewersRef.current,
      streamPeakViewers: peakViewersRef.current,
      ...(archivedStreamComments.length ? { streamComments: archivedStreamComments } : {}),
      pen: curPen ? curPen.winnerHome : undefined,
      penText: curPen?.text,
      ...(curShootout
        ? {
            shootout: {
              hKicks: curShootout.hKicks.slice(),
              aKicks: curShootout.aKicks.slice(),
              hScore: curShootout.hScore,
              aScore: curShootout.aScore
            }
          }
        : {}),
      ratings: fullTimeAnalysis.ratings,
      motm: fullTimeAnalysis.motm,
      pf: fullTimeAnalysis.pf,
      finalTac: curTac,
      finalLu: curLu,
      cards: fullTimeAnalysis.cards,
      subs: fullTimeAnalysis.subs,
      playedNames: fullTimeAnalysis.playedNames,
      xiNames: {
        [homeId]: initialHomeXi.slice(),
        [awayId]: initialAwayXi.slice()
      },
      playedSlots: {
        [homeId]: buildPlayedSlots(liveHome, initialHomeXi),
        [awayId]: buildPlayedSlots(liveAway, initialAwayXi)
      },
      injuries: srDone.injuries.slice(),
      captains: {
        H: srDone.captainH || curCaptains.H,
        A: srDone.captainA || curCaptains.A
      },
      formations: {
        H: liveHome.form || homeOrig.form || '4-4-2',
        A: liveAway.form || awayOrig.form || '4-4-2'
      },
      matchEnv,
      timeline: srDone.timeline.slice(),
      playerActions,
      logs: compactLogs,
      ...(srDone.varHistory.length ? { varReplays: srDone.varHistory.slice() } : {}),
      ...(srDone.highlightClips.length ? { highlightClips: curateMatchHighlights(srDone.highlightClips) } : {})
    });
  }, [fullTimeAnalysis, meIsHome, meTeamOrig, homeId, awayId, initialHomeXi, initialAwayXi, liveHome, liveAway, homeOrig.form, awayOrig.form, matchAttendance.att, matchAttendance.cap, matchEnv]);

  const isLivePitchFullscreen =
    broadcastFullscreen &&
    !done &&
    matchPhaseUi !== 'halftime' &&
    mlandMatchTab === 'chat';

  const playerSavesMap = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(livePlayerStatsUi).map(([name, st]) => [name, st.saves || 0])
      ),
    [livePlayerStatsUi]
  );

  const handleTogglePause = useCallback(() => {
    if (state.mode === 'm' && !doneRef.current && mlandMatchTabRef.current === 'tactics') {
      setMlandMatchTab(prevMatchTabBeforeTacticsRef.current);
      setPaused(false);
      return;
    }
    setPaused((p) => !p);
  }, [state.mode]);

  const handleStartSecondHalfClick = useCallback(() => {
    handleStartSecondHalf();
  }, [handleStartSecondHalf]);

  const handleOpenHighlightsDefault = useCallback(() => {
    openHighlightsModal();
  }, [openHighlightsModal]);

  const handleSkipLiveVar = useCallback(() => {
    const w = worldRef.current;
    if (w?.varReview) {
      SFX.tap();
      resolveVarReview(w, Math.max(1, Math.floor(w.minuteFloat)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    SFX.tap();
    setBroadcastFullscreen((v) => !v);
  }, []);

  const handleClubShout = useCallback(() => {
    SFX.tap();
    const curMin = minuteRef.current;
    setClubShoutMin(curMin);
    pushStreamComment(curMin, 'club', {
      viewerBoost: Math.max(80, Math.round(streamProj.baseViewers * 0.08)),
      burst: 1
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamProj.baseViewers]);

  const handleToggleRunVectors = useCallback(() => {
    SFX.tap();
    setShowRunVectors((v) => !v);
  }, []);

  const handleToggleRatings = useCallback(() => {
    SFX.tap();
    setShowRatings((v) => !v);
  }, []);

  const handleTogglePositions = useCallback(() => {
    SFX.tap();
    setShowPositions((v) => !v);
  }, []);

  const handleToggleCineSlowMo = useCallback(() => {
    SFX.tap();
    setCineSlowMo((v) => !v);
  }, []);

  const handleToggleHtStatMode = useCallback(() => {
    SFX.tap();
    setHtStatMode((m) => (m === 'rating' ? 'ovr' : 'rating'));
  }, []);

  const handleOpenTacticsStudioDefault = useCallback(() => {
    openTacticsStudio();
  }, [openTacticsStudio]);

  const handleSetTac = useCallback((m: Mentality) => {
    setLiveTac(m);
    triggerCoachShout(
      worldRef.current,
      meIsHome ? 'H' : 'A',
      m === 'X' || m === 'A' ? '🔥 ดันเกมบุก!' : m === 'D' || m === 'Z' ? '🛡️ คุมโซนแน่น!' : '⚖️ เล่นตามแผน!',
      2.6
    );
    pushLog(minuteRef.current, `📣 สั่งการข้างสนาม: ปรับแผนเป็น "${AR_T[m]}"`, 'sys');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meIsHome]);

  const handleSetPress = useCallback((v: number) => {
    SFX.coach();
    setLivePress(v);
    triggerCoachShout(worldRef.current, meIsHome ? 'H' : 'A', v === 2 ? '⚡ บีบเพรสสูง!' : v === 0 ? '🛡️ ถอยคุมโซน!' : '⚖️ เพรสสมดุล', 2.2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meIsHome]);

  const handleSetTempo = useCallback((v: number) => {
    SFX.coach();
    setLiveTempo(v);
    triggerCoachShout(worldRef.current, meIsHome ? 'H' : 'A', v === 2 ? '⚡ เร่งสปีดบอล!' : v === 0 ? '🐢 ดึงจังหวะช้า!' : '⚖️ จังหวะปกติ', 2.2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meIsHome]);

  const handleSetLine = useCallback((v: number) => {
    SFX.coach();
    setLiveLine(v);
    triggerCoachShout(worldRef.current, meIsHome ? 'H' : 'A', v === 2 ? '⬆️ ดันไลน์สูง!' : v === 0 ? '⬇️ ยืนรับลึก!' : '↔️ ไลน์สมดุล', 2.2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meIsHome]);

  const handleSetWid = useCallback((v: number) => {
    SFX.coach();
    setLiveWid(v);
    triggerCoachShout(worldRef.current, meIsHome ? 'H' : 'A', v === 2 ? '↔️ ถ่างเกมริมเส้น!' : v === 0 ? '🎯 บีบเข้ากลาง!' : '⚖️ กว้างสมดุล', 2.2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meIsHome]);

  const handleSetPass = useCallback((idx: number) => {
    SFX.coach();
    setLivePass(idx);
    triggerCoachShout(
      worldRef.current,
      meIsHome ? 'H' : 'A',
      ['🤝 ต่อบอลสั้น!', '⚽ จ่ายผสม!', '↗️ วางบอลยาว!', '🚀 สวนกลับเร็ว!'][idx] || '⚽ ปรับการจ่าย',
      2.2
    );
    pushLog(minuteRef.current, `📣 สั่งการข้างสนาม: เน้นจ่ายแบบ "${['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'][idx]}"`, 'sys');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meIsHome]);

  const handleCloseToStats = useCallback(() => {
    SFX.tap();
    setMlandMatchTab('stats');
    if (!doneRef.current && matchPhaseUiRef.current !== 'halftime') {
      setPaused(false);
    }
  }, []);

  const handleCloseToChat = useCallback(() => {
    SFX.tap();
    setMlandMatchTab('chat');
    if (!doneRef.current && matchPhaseUiRef.current !== 'halftime') {
      setPaused(false);
    }
  }, []);

  const handleToggleAutoSub = useCallback(() => {
    setAutoSubEnabled((v) => {
      const next = !v;
      saveSettings({ ...getSettings(), autoSubMatch: next });
      if (next && worldRef.current && !simRef.current.done) {
        runAutoOnPitchRebalance(worldRef.current, simRef.current, minuteRef.current);
      }
      pushLog(
        minuteRef.current,
        next
          ? '🤖 เปิดระบบ AI (ปรับตำแหน่งในสนามให้ตรงบทบาท & เปลี่ยนตัวอัตโนมัติ)'
          : '🤖 ปิดระบบ AI (คุมจัดตำแหน่งและเปลี่ยนตัวด้วยตนเอง)',
        'sys'
      );
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectVarRecord = useCallback((id: string) => {
    const found = varHistoryRef.current.find((r) => r.id === id);
    if (found) setVarReplayModalState({ record: found, liveMode: false });
  }, []);

  const handleSkipLiveVarModal = useCallback(() => {
    const w = worldRef.current;
    setVarReplayModalState(null);
    if (w?.varReview) {
      resolveVarReview(w, Math.max(1, Math.floor(w.minuteFloat)));
    }
    if (!doneRef.current && matchPhaseUiRef.current !== 'halftime' && !wasPausedBeforeVarRef.current) {
      setPaused(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseHighlightModal = useCallback(() => {
    setHighlightModalOpen(false);
    setHighlightInitialId(undefined);
  }, []);

  const headerRightControls = useMemo(
    () => (
      <MatchHeaderControls
        done={done}
        matchPhaseUi={matchPhaseUi}
        paused={paused}
        speed={speed}
        highlightCount={highlightClips.length}
        allowSkip={allowSkip}
        onStartSecondHalf={handleStartSecondHalfClick}
        onSkipToEnd={skipToEnd}
        onTogglePause={handleTogglePause}
        onCycleSpeed={cycleMatchSpeed}
        onOpenHighlights={handleOpenHighlightsDefault}
        onConfirmFinish={handleConfirmFinish}
      />
    ),
    [
      done,
      matchPhaseUi,
      paused,
      speed,
      highlightClips.length,
      allowSkip,
      handleStartSecondHalfClick,
      skipToEnd,
      handleTogglePause,
      cycleMatchSpeed,
      handleOpenHighlightsDefault,
      handleConfirmFinish
    ]
  );

  const curHomeLu = meIsHome ? liveLu : liveOppLu;
  const curAwayLu = meIsHome ? liveOppLu : liveLu;

  return (
    <div
      className={`match-no-scrollbar fixed inset-0 z-50 bg-black/88 flex items-center justify-center safe-all overflow-hidden ${
        isLivePitchFullscreen ? 'p-0' : 'p-1.5 sm:p-2.5 mland:p-1'
      }`}
    >
      <div
        className={
          isLivePitchFullscreen
            ? 'w-full max-w-none h-[calc(var(--app-dvh,1dvh)*100)] max-h-[calc(var(--app-dvh,1dvh)*100)] rounded-none bg-[var(--surface)] border-0 flex flex-col overflow-hidden shadow-2xl'
            : 'w-full max-w-6xl mland:max-w-[98vw] h-[calc(var(--app-dvh,1dvh)*96)] max-h-[calc(var(--app-dvh,1dvh)*96)] mland:h-[calc(var(--app-dvh,1dvh)*97)] mland:max-h-[calc(var(--app-dvh,1dvh)*97)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl'
        }
      >
        {/* Pinned Top Broadcast Scoreboard */}
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
          homeOrig={homeOrig}
          awayOrig={awayOrig}
          state={state}
          gh={gh}
          ga={ga}
          done={done}
          matchPhaseUi={matchPhaseUi}
          paused={paused}
          clockLabel={clockLabel}
          stoppageBadge={stoppageBadge}
          penText={penResult?.text}
          goalFlashInfo={goalFlashInfo}
          rightControls={headerRightControls}
        />

        {/* Horizontal Landscape Broadcast Stage OR Live Tactical Formation & Drag-Drop Sub Studio */}
        <div
          className={`flex-1 min-h-0 overflow-hidden flex flex-col ${
            isLivePitchFullscreen ? 'p-1.5 sm:p-2 mland:p-1' : 'p-2.5 mland:p-1.5'
          }`}
        >
          {state.mode === 'm' && !done && mlandMatchTab === 'tactics' ? (
            <LiveTacticsStudio
              state={state}
              meTeamOrig={meTeamOrig}
              oppTeamOrig={oppTeamOrig}
              liveHome={liveHome}
              liveAway={liveAway}
              meIsHome={meIsHome}
              homeKit={homeKit}
              awayKit={awayKit}
              homeGkKit={homeGkKit}
              awayGkKit={awayGkKit}
              homeTrim={homeTrim}
              awayTrim={awayTrim}
              liveLu={liveLu}
              liveOppLu={liveOppLu}
              benchList={benchList}
              subsUsed={subsUsed}
              subLog={subLog}
              evs={evs}
              matchCards={matchCards}
              matchYellows={matchYellows}
              sentOff={sentOff}
              injuredNames={injuredNamesUi}
              liveFitMap={liveFitMap}
              liveFormMap={liveFormMap}
              livePlayerStats={livePlayerStatsUi}
              liveTac={liveTac}
              livePress={livePress}
              liveTempo={liveTempo}
              liveLine={liveLine}
              liveWid={liveWid}
              livePass={livePass}
              minute={minute}
              matchPhaseUi={matchPhaseUi}
              subAlertFitTh={subAlertFitTh}
              subAlertFormTh={subAlertFormTh}
              subPickOut={subPickOut}
              setSubPickOut={setSubPickOut}
              onSetTac={handleSetTac}
              onSetPress={handleSetPress}
              onSetTempo={handleSetTempo}
              onSetLine={handleSetLine}
              onSetWid={handleSetWid}
              onSetPass={handleSetPass}
              onSubstitute={performSubstitution}
              onAutoSubstitute={handleAutoSubstitute}
              onSwapStarters={performOnPitchSwap}
              findBestSubFor={findBestSubFor}
              onCloseToStats={handleCloseToStats}
              onCloseToChat={handleCloseToChat}
              liveViewers={liveViewers}
              autoSubEnabled={autoSubEnabled}
              onToggleAutoSub={handleToggleAutoSub}
              selectedHalftimeTalk={
                selectedHalftimeTalk === 'attack' ||
                selectedHalftimeTalk === 'press' ||
                selectedHalftimeTalk === 'balanced' ||
                selectedHalftimeTalk === 'counter' ||
                selectedHalftimeTalk === 'defend'
                  ? selectedHalftimeTalk
                  : 'balanced'
              }
              onSetHalftimeTalk={setSelectedHalftimeTalk}
              pitchMode={htPitchMode}
              onChangePitchMode={setHtPitchMode}
              statMode={htStatMode}
              onToggleStatMode={handleToggleHtStatMode}
              matchStats={matchStats}
            />
          ) : done && fullTimeAnalysis ? (
            <FullTimeMatchStage
              state={state}
              homeOrig={homeOrig}
              awayOrig={awayOrig}
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
              captains={liveCaptains}
              gh={gh}
              ga={ga}
              evs={evs}
              matchCards={matchCards}
              subLog={subLog}
              matchStats={matchStats}
              fullTimeAnalysis={fullTimeAnalysis}
              playerSavesMap={playerSavesMap}
              injuredNames={injuredNamesUi}
              shootoutUi={shootoutUi}
              logs={logs}
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
              myInitialBanned={myInitialBanned}
              rightTab={mlandMatchTab === 'tactics' ? 'stats' : mlandMatchTab}
              onChangeRightTab={setMlandMatchTab}
              onOpenVarReplay={openVarReplayById}
              highlightClips={highlightClips}
              onOpenHighlights={openHighlightsModal}
            />
          ) : (
            <div
              className={
                isLivePitchFullscreen
                  ? 'grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_225px] lg:grid-cols-[minmax(0,1fr)_245px] xl:grid-cols-[minmax(0,1fr)_265px] sm:grid-rows-[minmax(0,1fr)] mland:grid-cols-[minmax(0,1fr)_180px] mland:grid-rows-[minmax(0,1fr)] gap-1.5 mland:gap-1 items-stretch flex-1 min-h-0 overflow-hidden'
                  : 'grid grid-cols-[1.68fr_1fr] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden'
              }
            >
            {/* Left Stage: Live 2D Pitch + Events Feed Below */}
            <div
              ref={leftStageScrollRef}
              className={
                isLivePitchFullscreen
                  ? 'min-w-0 min-h-0 flex flex-col overflow-hidden'
                  : 'space-y-2.5 mland:space-y-2 min-w-0 h-full overflow-y-auto no-scrollbar pr-1'
              }
            >
              <div
                className={
                  isLivePitchFullscreen
                    ? 'rounded-xl overflow-hidden border border-[var(--line)] bg-[#06190f] shadow-inner w-full sm:flex-1 sm:min-h-0 mland:flex-1 mland:min-h-0 flex flex-col'
                    : 'rounded-2xl mland:rounded-xl overflow-hidden border border-[var(--line)] bg-[#0c351f] shadow-inner mx-auto w-full flex flex-col'
                }
              >
                  <div
                    ref={pitchOverlayBoxRef}
                    className={`relative ${
                      isLivePitchFullscreen
                        ? 'w-full flex items-center justify-center overflow-hidden sm:flex-1 sm:min-h-0 sm:[container-type:size] mland:flex-1 mland:min-h-0 mland:[container-type:size]'
                        : ''
                    }`}
                    style={{
                      backgroundColor:
                        matchEnv.timeOfDay === 'night'
                          ? matchEnv.season === 'rainy'
                            ? turfSpec.palette.nightRainy[2]
                            : turfSpec.palette.night[2]
                          : matchEnv.season === 'rainy'
                            ? turfSpec.palette.rainy[2]
                            : turfSpec.palette.day[2]
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
                      className={`${matchPhaseUi === 'halftime' && !done ? 'hidden ' : ''}${
                        isLivePitchFullscreen
                          ? 'aspect-[16/8.2] w-full max-h-[44dvh] sm:max-h-none mland:max-h-none sm:aspect-auto mland:aspect-auto sm:[width:min(100cqw,calc(100cqh_*_16_/_8.2))] sm:[height:min(100cqh,calc(100cqw_*_8.2_/_16))] mland:[width:min(100cqw,calc(100cqh_*_16_/_8.2))] mland:[height:min(100cqh,calc(100cqw_*_8.2_/_16))] mx-auto block select-none'
                          : 'aspect-[16/8.2] w-full max-h-[calc(var(--app-dvh,1dvh)*96-128px)] mland:max-h-[calc(var(--app-dvh,1dvh)*97-112px)] object-contain mx-auto block select-none'
                      }`}
                      aria-label="สนามแข่งขัน 2 มิติแบบเรียลไทม์ 11 ต่อ 11"
                    />

                    {/* Live In-Pitch Top Corners (Miracles & Blessings) + Center Commentary Strip + Sub Flash + VAR Controls */}
                    <MatchPitchOverlays
                      pitchOverlayBoxRef={pitchOverlayBoxRef}
                      isSecondHalfUi={isSecondHalfUi}
                      miracleBannerUi={miracleBannerUi}
                      blessedListUi={blessedListUi}
                      actionBanner={actionBanner}
                      subFlashInfo={subFlashInfo}
                      liveVarActive={liveVarActive}
                      matchPhaseUi={matchPhaseUi}
                      done={done}
                      isLivePitchFullscreen={isLivePitchFullscreen}
                      homeOrig={homeOrig}
                      awayOrig={awayOrig}
                      homeId={homeId}
                      awayId={awayId}
                      homeKit={homeKit}
                      awayKit={awayKit}
                      homeGkKit={homeGkKit}
                      awayGkKit={awayGkKit}
                      homeTrim={homeTrim}
                      awayTrim={awayTrim}
                      state={state}
                      matchVisualIndex={matchVisualIndex}
                      onOpenLiveVarReplay={openLiveVarReplay}
                      onSkipLiveVar={handleSkipLiveVar}
                    />

                    {/* Halftime Tactical Pitch Stage: Unified SVG Formation Pitch */}
                    {matchPhaseUi === 'halftime' && !done && (
                      <MatchHalftimePitchPanel
                        state={state}
                        homeOrig={homeOrig}
                        awayOrig={awayOrig}
                        liveHome={liveHome}
                        liveAway={liveAway}
                        meTeamOrig={meTeamOrig}
                        homeId={homeId}
                        homeKit={homeKit}
                        awayKit={awayKit}
                        homeGkKit={homeGkKit}
                        awayGkKit={awayGkKit}
                        homeTrim={homeTrim}
                        awayTrim={awayTrim}
                        curHomeLu={curHomeLu}
                        curAwayLu={curAwayLu}
                        htPitchMode={htPitchMode}
                        onChangeHtPitchMode={setHtPitchMode}
                        htPickedPlayer={htPickedPlayer}
                        onChangeHtPickedPlayer={setHtPickedPlayer}
                        htStatMode={htStatMode}
                        liveFitMap={liveFitMap}
                        liveFormMap={liveFormMap}
                        evs={evs}
                        matchCards={matchCards}
                        sentOff={sentOff}
                        subLog={subLog}
                        injuredNamesUi={injuredNamesUi}
                        subsUsedCount={subsUsed.length}
                        benchCount={benchList.length}
                        subAlertFitTh={subAlertFitTh}
                        matchStats={matchStats}
                        onAutoSubstitute={handleAutoSubstitute}
                      />
                    )}
                  </div>

              </div>

              {/* Live Penalty Shootout Strip */}
              {shootoutUi && (
                <MatchShootoutBanner
                  shootoutUi={shootoutUi}
                  homeOrig={homeOrig}
                  awayOrig={awayOrig}
                  homeId={homeId}
                  homeKit={homeKit}
                  awayKit={awayKit}
                  homeGkKit={homeGkKit}
                  awayGkKit={awayGkKit}
                  homeTrim={homeTrim}
                  awayTrim={awayTrim}
                  state={state}
                />
              )}

              {/* Live Commentary & Match Events Below the Pitch (Scroll Down to Read) */}
              {!isLivePitchFullscreen && (
                <MatchEventsFeedPanel
                  eventFilter={eventFilter}
                  onChangeFilter={setEventFilter}
                  done={done}
                  matchPhaseUi={matchPhaseUi}
                  cardCount={matchCards.length}
                  varCount={varHistory.length}
                  subLog={subLog}
                  logs={logs}
                  showRunVectors={showRunVectors}
                  onToggleRunVectors={handleToggleRunVectors}
                  showRatings={showRatings}
                  onToggleRatings={handleToggleRatings}
                  showPositions={showPositions}
                  onTogglePositions={handleTogglePositions}
                  cineSlowMo={cineSlowMo}
                  onToggleCineSlowMo={handleToggleCineSlowMo}
                  htStatMode={htStatMode}
                  onToggleHtStatMode={handleToggleHtStatMode}
                  subsRemaining={5 - subsUsed.length}
                  onOpenTacticsStudio={handleOpenTacticsStudioDefault}
                  matchVisualIndex={matchVisualIndex}
                  homeOrig={homeOrig}
                  awayOrig={awayOrig}
                  meTeamOrig={meTeamOrig}
                  homeId={homeId}
                  awayId={awayId}
                  homeKit={homeKit}
                  awayKit={awayKit}
                  homeGkKit={homeGkKit}
                  awayGkKit={awayGkKit}
                  homeTrim={homeTrim}
                  awayTrim={awayTrim}
                  state={state}
                  isPlayerMode={isPlayerMode}
                  myPlayerName={myPlayerName}
                  myPlayerSquadObj={myPlayerSquadObj}
                  captains={liveCaptains}
                  onOpenVarReplay={openVarReplayById}
                />
              )}
            </div>

            {/* Right Stage: Injury Alert + Stats + Live Stream Chat + Key Match Timeline (Plus Live Tactics Switch for Manager) */}
            <div className="space-y-1.5 min-w-0 h-full flex flex-col min-h-0">
              {injuryAlert && !done && (
                <div className="px-2.5 py-2 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-rose-950/95 border border-rose-400/55 shadow-sm flex flex-col gap-1.5 mland:gap-1 text-white shrink-0">
                  <div className="flex items-start justify-between gap-1.5">
                    {(() => {
                      const injPl = meTeamOrig.sq.find((q) => q.n === injuryAlert.name) || null;
                      const injKit = injPl?.pos === 'GK' ? (meIsHome ? homeGkKit : awayGkKit) : (meIsHome ? homeKit : awayKit);
                      const injTrim = injPl?.pos === 'GK' ? undefined : (meIsHome ? homeTrim : awayTrim);
                      return (
                        <span className="text-[11px] sm:text-xs mland:text-[9.5px] font-bold text-rose-200 flex flex-wrap items-center gap-1 min-w-0 leading-snug">
                          <span className="animate-pulse shrink-0 inline-flex"><StatIconBadge kind="injury" size="sm" /></span>
                          <span className="shrink-0">ด่วน น.{injuryAlert.minute}&apos;:</span>
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <span className="shrink-0 inline-flex">
                              <ClubCrest name={meTeamOrig.name} size={13} team={meTeamOrig} club={state.club} isMyClub={meTeamOrig.id === state.me && state.mode === 'm'} />
                            </span>
                            {injPl && (
                              <MatchPlayerThumb
                                player={injPl}
                                team={meTeamOrig}
                                state={state}
                                kitColor={injKit}
                                trimColor={injTrim}
                                size="xs"
                                dark
                              />
                            )}
                            <PositionBadge role={injPl?.ro || injuryAlert.role} size="2xs" />
                            <span className="text-[#fde047] font-extrabold tabular shrink-0">#{injuryAlert.no}</span>
                            <span className="font-extrabold text-white truncate">{injuryAlert.name}</span>
                          </span>
                          <span className="shrink-0">บาดเจ็บ (พัก {injuryAlert.games} นัด)</span>
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => setInjuryAlert(null)}
                      className="w-6 h-6 mland:w-5 mland:h-5 rounded-md bg-white/10 text-white/80 text-[10px] font-bold cursor-pointer hover:bg-white/20 shrink-0"
                      aria-label="ปิดแจ้งเตือนผู้บาดเจ็บ"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {benchList.length > 0 && subsUsed.length < 5 && (
                      <button
                        type="button"
                        onClick={handleQuickSubInjured}
                        className="btn btn-xs btn-primary flex-1 whitespace-nowrap"
                      >
                        ⚡ เปลี่ยนตัวด่วนแทนผู้เจ็บ
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openTacticsStudio(injuryAlert.name)}
                      className="btn btn-xs bg-white/15 border border-white/25 text-white hover:bg-white/25 whitespace-nowrap"
                    >
                      🔄 เลือกเอง
                    </button>
                  </div>
                </div>
              )}
              {isLivePitchFullscreen ? (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <LiveStreamChatPanel
                    liveViewers={liveViewers}
                    peakViewers={peakViewers}
                    gh={gh}
                    ga={ga}
                    meIsHome={meIsHome}
                    isDerby={isDerby}
                    mode={state.mode}
                    streamProj={streamProj}
                    broadcastChannel={broadcastChannel}
                    done={done}
                    minute={minute}
                    clubShoutMin={clubShoutMin}
                    matchPhaseUi={matchPhaseUi}
                    isLivePitchFullscreen={isLivePitchFullscreen}
                    liveComments={liveComments}
                    rightChatScrollRef={rightChatScrollRef}
                    onToggleFullscreen={handleToggleFullscreen}
                    onClubShout={handleClubShout}
                  />
                </div>
              ) : (
              <>
              <div className="seg-bar grid w-full shrink-0 grid-cols-3">
                <button
                  type="button"
                  onClick={() => setMlandMatchTab('stats')}
                  className={`seg-btn w-full min-w-0 overflow-hidden whitespace-nowrap px-1 mland:px-0.5 ${mlandMatchTab === 'stats' ? 'seg-btn-active' : ''}`}
                >
                  <span className="truncate">📊 สถิติ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMlandMatchTab('chat')}
                  className={`seg-btn w-full min-w-0 overflow-hidden whitespace-nowrap px-1 mland:px-0.5 ${mlandMatchTab === 'chat' ? 'seg-btn-active' : ''}`}
                >
                  <LiveStreamBadge animated={!done} active={mlandMatchTab === 'chat'} />
                  <span className="tabular font-extrabold text-[9.5px] mland:text-[8px] opacity-85 shrink-0">
                    {fmtFansShort(liveViewers)}
                  </span>
                </button>
                {state.mode === 'm' ? (
                  <button
                    type="button"
                    onClick={() => openTacticsStudio()}
                    title={
                      matchPhaseUi === 'halftime'
                        ? `พักครึ่ง · ปรับแผนและเปลี่ยนตัวได้ (เหลือ ${5 - subsUsed.length} คน · AI ${autoSubEnabled ? 'เปิด' : 'ปิด'})`
                        : `ปรับแผนและเปลี่ยนตัว (เหลือ ${5 - subsUsed.length} คน · AI ${autoSubEnabled ? 'เปิด' : 'ปิด'})`
                    }
                    className={`seg-btn w-full min-w-0 overflow-hidden whitespace-nowrap px-1 mland:px-0.5 gap-1 mland:gap-0.5 ${
                      mlandMatchTab === 'tactics'
                        ? 'seg-btn-active'
                        : matchPhaseUi === 'halftime'
                          ? 'bg-amber-500/12 border border-amber-500/55 text-amber-700 dark:text-amber-300 font-extrabold'
                          : ''
                    }`}
                  >
                    <span className="truncate">📋 แผน</span>
                    <span
                      aria-label={autoSubEnabled ? 'ระบบ AI เปิดอยู่' : 'ระบบ AI ปิดอยู่'}
                      className={`inline-flex items-center justify-center h-[15px] mland:h-[13px] px-1 rounded text-[8.5px] mland:text-[7.5px] font-black tracking-wide leading-none shrink-0 ${
                        autoSubEnabled
                          ? 'bg-emerald-500 text-white shadow-2xs'
                          : 'bg-black/10 dark:bg-white/10 text-[var(--mut)] border border-[var(--line)]/60'
                      }`}
                    >
                      AI
                    </span>
                  </button>
                ) : (
                  (() => {
                    const canSpeakTab =
                      userPitchStatus === 'on' &&
                      coachChatCount < 2 &&
                      minute >= 10 &&
                      minute - coachChatCooldownMin >= 20;
                    const waitTabMins =
                      minute < 10
                        ? Math.max(1, 10 - minute)
                        : Math.max(1, 20 - (minute - coachChatCooldownMin));
                    const activeTab = mlandMatchTab === 'tactics';
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setMlandMatchTab('tactics');
                        }}
                        className={`seg-btn w-full min-w-0 overflow-hidden whitespace-nowrap px-1 mland:px-0.5 gap-1 mland:gap-0.5 ${
                          activeTab
                            ? 'seg-btn-active'
                            : matchPhaseUi === 'halftime'
                              ? 'bg-amber-500/12 border border-amber-500/55 text-amber-700 dark:text-amber-300 font-extrabold'
                              : canSpeakTab
                                ? 'border border-[var(--g)]/55 text-[var(--g)] font-extrabold'
                                : ''
                        }`}
                      >
                        <span className="truncate">
                          🧠 <span className="hidden sm:inline mland:hidden">แผน</span>โค้ช
                        </span>
                        {matchPhaseUi === 'halftime' ? (
                          <span
                            className={`px-1 py-[1px] rounded text-[8.5px] mland:text-[7.5px] font-black leading-none shrink-0 ${
                              activeTab
                                ? 'bg-amber-400/25 text-amber-200'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            พัก
                          </span>
                        ) : userPitchStatus === 'subbed_out' ? (
                          <span className="text-[8.5px] mland:text-[7.5px] opacity-70 shrink-0">ออก</span>
                        ) : userPitchStatus === 'sent_off' ? (
                          <span className="text-[8.5px] mland:text-[7.5px] text-[var(--red)] shrink-0">แดง</span>
                        ) : userPitchStatus === 'bench' ? (
                          <span className="text-[8.5px] mland:text-[7.5px] opacity-70 shrink-0">สำรอง</span>
                        ) : coachChatCount >= 2 ? null : canSpeakTab ? (
                          <span
                            className={`px-1 py-[1px] rounded text-[8.5px] mland:text-[7.5px] font-black leading-none shrink-0 ${
                              activeTab
                                ? 'bg-white/20 text-white'
                                : 'bg-[var(--g)] text-white'
                            }`}
                          >
                            พร้อม
                          </span>
                        ) : (
                          <span className="tabular text-[9px] mland:text-[7.5px] opacity-75 shrink-0">
                            {waitTabMins}&apos;
                          </span>
                        )}
                      </button>
                    );
                  })()
                )}
              </div>

              <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-1.5">
                {mlandMatchTab === 'tactics' && state.mode === 'p' && !done ? (
                  <MatchPlayerCoachPanel
                    meIsHome={meIsHome}
                    liveHome={liveHome}
                    liveAway={liveAway}
                    meTeamOrig={meTeamOrig}
                    state={state}
                    homeKit={homeKit}
                    awayKit={awayKit}
                    homeGkKit={homeGkKit}
                    awayGkKit={awayGkKit}
                    homeTrim={homeTrim}
                    awayTrim={awayTrim}
                    liveCaptains={liveCaptains}
                    liveSetPiecesUi={liveSetPiecesUi}
                    matchPhaseUi={matchPhaseUi}
                    halftimeCoachOrder={halftimeCoachOrder}
                    userPitchStatus={userPitchStatus}
                    userSubOutMin={simRef.current.userSubOutMin ?? undefined}
                    coachChatCount={coachChatCount}
                    coachChatCooldownMin={coachChatCooldownMin}
                    minute={minute}
                    coachChatReplies={coachChatReplies}
                    rightTacticsScrollRef={rightTacticsScrollRef}
                    onPlayerVoiceToCoach={handlePlayerVoiceToCoach}
                  />
                ) : mlandMatchTab === 'chat' ? (
                  <LiveStreamChatPanel
                    liveViewers={liveViewers}
                    peakViewers={peakViewers}
                    gh={gh}
                    ga={ga}
                    meIsHome={meIsHome}
                    isDerby={isDerby}
                    mode={state.mode}
                    streamProj={streamProj}
                    broadcastChannel={broadcastChannel}
                    done={done}
                    minute={minute}
                    clubShoutMin={clubShoutMin}
                    matchPhaseUi={matchPhaseUi}
                    isLivePitchFullscreen={isLivePitchFullscreen}
                    liveComments={liveComments}
                    rightChatScrollRef={rightChatScrollRef}
                    onToggleFullscreen={handleToggleFullscreen}
                    onClubShout={handleClubShout}
                  />
                ) : (
                  <div ref={rightStageScrollRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-0.5 space-y-1.5">
                    <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden">
                      <MatchStatsPanel
                        homeOrig={homeOrig}
                        awayOrig={awayOrig}
                        state={state}
                        matchStats={matchStats}
                        matchCards={matchCards}
                      />
                      <MatchTimelinePanel
                        timelineEvents={timelineEvents}
                        homeOrig={homeOrig}
                        awayOrig={awayOrig}
                        state={state}
                        homeKit={homeKit}
                        awayKit={awayKit}
                        homeGkKit={homeGkKit}
                        awayGkKit={awayGkKit}
                        homeTrim={homeTrim}
                        awayTrim={awayTrim}
                        captains={liveCaptains}
                      />
                    </div>
                  </div>
                )}
              </div>
              </>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {varReplayModalState && (
        <VarReplayModal
          records={varReplayModalState.liveMode ? [varReplayModalState.record] : varHistory}
          activeRecord={varReplayModalState.record}
          liveMode={varReplayModalState.liveMode}
          onSelectRecord={handleSelectVarRecord}
          onSkipLiveVar={varReplayModalState.liveMode ? handleSkipLiveVarModal : undefined}
          onClose={closeVarReplayModal}
          homeOrig={homeOrig}
          awayOrig={awayOrig}
          state={state}
          homeKit={homeKit}
          awayKit={awayKit}
          homeGkKit={homeGkKit}
          awayGkKit={awayGkKit}
          homeTrim={homeTrim}
          awayTrim={awayTrim}
        />
      )}

      {highlightModalOpen && highlightClips.length > 0 && (
        <MatchHighlightModal
          clips={highlightClips}
          initialClipId={highlightInitialId}
          homeOrig={homeOrig}
          awayOrig={awayOrig}
          state={state}
          homeKit={homeKit}
          awayKit={awayKit}
          homeGkKit={homeGkKit}
          awayGkKit={awayGkKit}
          homeTrim={homeTrim}
          awayTrim={awayTrim}
          compTitle={compTitle}
          scoreSummary={`${homeOrig.name} ${gh} - ${ga} ${awayOrig.name}${penResult ? ` (${penResult.text})` : ''}`}
          onClose={handleCloseHighlightModal}
        />
      )}
    </div>
  );
});

