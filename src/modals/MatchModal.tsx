import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Position, SubRole, Mentality, Player, Team, MatchEvent, MatchCardEvent, MatchSubEvent, PlayerPerfResult, MatchResult, GameState, FinishedMatchPayload, BallFlightType, LivePitchAgent, LiveBallState, LivePitchFx, ShootoutState, LiveMatchWorld } from '../types/game';
import { R, P, clamp } from '../utils/math';
import { RN, TN, SIGL, AR_T } from '../data/thaiFootballData';
import { getSettings, saveSettings, getDefaultMatchSpeed, SFX, setCrowdAudio, vibrate, triggerConfetti } from '../utils/audioTheme';
import { getShirtNo, getFormationSlots, pen, xi, DT, injD, matchKits, pickGK } from '../engine/playerCore';
import { rate, computePlayerRatings, calcPlayerPerf } from '../engine/simulation';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { buildAgentsForTeam, drawLivePitchToCanvas } from './MatchPitchCanvas';

export const MatchModal: React.FC<{
  state: GameState;
  kind: 'league' | 'cup' | 'asia';
  homeId: number;
  awayId: number;
  isDerby: boolean;
  isFullscreen?: boolean;
  onExitFullscreen?: () => void;
  onFinish: (payload: FinishedMatchPayload) => void;
}> = ({ state, kind, homeId, awayId, isDerby, isFullscreen, onExitFullscreen, onFinish }) => {
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

  const initialHomeXi = useMemo(() => xi(homeOrig).map((q) => q.n), [homeOrig]);
  const initialAwayXi = useMemo(() => xi(awayOrig).map((q) => q.n), [awayOrig]);
  const initialMeXi = meIsHome ? initialHomeXi : initialAwayXi;
  const myInitialStarted = isPlayerMode && !myInitialBanned && initialMeXi.includes(myPlayerName);

  const [minute, setMinute] = useState(0);
  const [clockLabel, setClockLabel] = useState("0'");
  const [stoppageBadge, setStoppageBadge] = useState<number>(0);
  const [matchPhaseUi, setMatchPhaseUi] = useState<LiveMatchWorld['phase']>('play1');
  const [halftimeTalkUsed, setHalftimeTalkUsed] = useState(false);
  const [shootoutUi, setShootoutUi] = useState<ShootoutState | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<0.25 | 0.5 | 1 | 2 | 4>(() => getDefaultMatchSpeed(settings));
  const [cineSlowMo, setCineSlowMo] = useState(true);
  const [showRunVectors, setShowRunVectors] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  const [injuryAlert, setInjuryAlert] = useState<{ name: string; role: SubRole; no: number; games: number; minute: number } | null>(null);
  const [gh, setGh] = useState(0);
  const [ga, setGa] = useState(0);
  const [goalFlashSide, setGoalFlashSide] = useState<'H' | 'A' | null>(null);
  const goalFlashTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (goalFlashTimerRef.current) window.clearTimeout(goalFlashTimerRef.current);
  }, []);
  const [evs, setEvs] = useState<MatchEvent[]>([]);
  const [actionBanner, setActionBanner] = useState<{ label: string; tone: LiveMatchWorld['phaseTone'] }>({
    label: '⚽ เขี่ยบอลเริ่มเกม',
    tone: 'normal'
  });
  const [logs, setLogs] = useState<{ m: number; text: string; tone?: 'goal' | 'card' | 'sys' | 'sub' }[]>(() => {
    const base: { m: number; text: string; tone?: 'goal' | 'card' | 'sys' | 'sub' }[] = [
      { m: 0, text: `📣 กรรมการเป่านกหวีดเริ่มเกม! ${homeOrig.name} พบ ${awayOrig.name}`, tone: 'sys' }
    ];
    if (isPlayerMode) {
      if (myInitialBanned) {
        base.unshift({ m: 0, text: `🟥 คุณติดโทษแบนนัดนี้ (เหลือ ${myPlayerSquadObj?.sus || state.p?.sus} นัด) — ชมการแข่งขันจากอัฒจันทร์`, tone: 'card' });
      } else if (myInitialStarted) {
        base.unshift({ m: 0, text: `⭐ คุณได้ลงสนามเป็น 11 ตัวจริงของ ${meTeamOrig.name}`, tone: 'sys' });
      } else {
        base.unshift({ m: 0, text: `🪑 นัดนี้คุณเริ่มต้นที่ม้านั่งสำรอง รอโอกาสโค้ชส่งลงสนาม`, tone: 'sys' });
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
  const [subAlertEnabled, setSubAlertEnabled] = useState<boolean>(() => settings.subAlertEnabled ?? true);
  const [subAlertFitTh, setSubAlertFitTh] = useState<number>(() => clamp(settings.subAlertFitThreshold ?? 58, 45, 75));
  const [subAlertFormTh, setSubAlertFormTh] = useState<number>(() => clamp(settings.subAlertFormThreshold ?? 5.8, 5.0, 6.4));
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, string>>({});
  const [matchYellows, setMatchYellows] = useState<Record<string, number>>({});
  const [matchCards, setMatchCards] = useState<MatchCardEvent[]>([]);
  const [sentOff, setSentOff] = useState<string[]>([]);
  const [subPickOut, setSubPickOut] = useState<string | null>(null);
  const [showTacticsDrawer, setShowTacticsDrawer] = useState(false);
  const [mlandMatchTab, setMlandMatchTab] = useState<'stats' | 'events' | 'tactics'>('stats');
  const [eventFilter, setEventFilter] = useState<'all' | 'goal' | 'card' | 'sub'>('all');
  const [htPitchMode, setHtPitchMode] = useState<'all' | 'H' | 'A'>(() => (meIsHome ? 'H' : 'A'));
  const [htPickedPlayer, setHtPickedPlayer] = useState<string | null>(null);
  const [ftPitchMode, setFtPitchMode] = useState<'all' | 'H' | 'A'>('all');
  const [ftPickedPlayer, setFtPickedPlayer] = useState<string | null>(null);

  const [penResult, setPenResult] = useState<{ winnerHome: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const triggeredRulesRef = useRef<number[]>([]);
  const lastSoundMinRef = useRef(-1);
  const alertLoggedRef = useRef<Set<string>>(new Set());

  const simRef = useRef({
    homeLu: initialHomeXi.slice(),
    awayLu: initialAwayXi.slice(),
    homePlayed: initialHomeXi.slice(),
    awayPlayed: initialAwayXi.slice(),
    homeSubsCount: 0,
    awaySubsCount: 0,
    yellows: {} as Record<string, number>,
    sentOff: [] as string[],
    cards: [] as MatchCardEvent[],
    subs: [] as MatchSubEvent[],
    injuries: [] as { teamId: number; name: string; games: number }[],
    injuredNames: [] as string[],
    liveFit: Object.fromEntries([...homeOrig.sq, ...awayOrig.sq].map((q) => [q.n, Math.round(q.fit ?? 100)])) as Record<string, number>,
    liveForm: Object.fromEntries([...homeOrig.sq, ...awayOrig.sq].map((q) => [q.n, 6.5])) as Record<string, number>,
    userStarted: myInitialStarted,
    userSubInMin: null as number | null,
    userSubOutMin: null as number | null,
    userSentOffMin: null as number | null,
    aiSubMinH: [R(56, 64), R(68, 76), R(78, 86)],
    aiSubMinA: [R(56, 64), R(68, 76), R(78, 86)],
    gh: 0,
    ga: 0,
    evs: [] as MatchEvent[],
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

  const subAlertCfgRef = useRef({ enabled: subAlertEnabled, fitTh: subAlertFitTh, formTh: subAlertFormTh });
  subAlertCfgRef.current = { enabled: subAlertEnabled, fitTh: subAlertFitTh, formTh: subAlertFormTh };

  const buildInitialWorld = (): LiveMatchWorld => {
    const sr = simRef.current;
    const hAgents = buildAgentsForTeam(homeOrig, 'H', sr.homeLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName);
    const aAgents = buildAgentsForTeam(awayOrig, 'A', sr.awayLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName);
    const firstCarrier = hAgents.find((a) => a.pos === 'FW') || hAgents.find((a) => a.pos === 'MF') || hAgents[9];
    if (firstCarrier) {
      firstCarrier.x = 49;
      firstCarrier.y = 50;
      firstCarrier.intent = 'CARRY';
    }
    return {
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
      inMatchInjuryCount: 0
    };
  };

  const worldRef = useRef<LiveMatchWorld | null>(null);
  if (!worldRef.current) {
    worldRef.current = buildInitialWorld();
  }

  const getEffectiveTeamCfg = (side: 'H' | 'A', curMin: number) => {
    const isUserSide = (side === 'H' && meIsHome) || (side === 'A' && !meIsHome);
    const orig = side === 'H' ? homeOrig : awayOrig;
    const base = isUserSide && state.mode === 'm'
      ? liveTacticsRef.current
      : {
          tac: orig.tac,
          press: orig.press ?? 1,
          tempo: orig.tempo ?? 1,
          line: orig.line ?? 1,
          wid: orig.wid ?? 1,
          pass: orig.pass ?? 1
        };

    const myScore = side === 'H' ? simRef.current.gh : simRef.current.ga;
    const oppScore = side === 'H' ? simRef.current.ga : simRef.current.gh;
    let pushShift = base.tac === 'X' ? 12 : base.tac === 'A' ? 6 : base.tac === 'D' ? -7 : base.tac === 'Z' ? -13 : 0;
    let pressLvl = base.press;
    let lineLvl = base.line;

    // Adaptive AI response to scoreline & match clock
    if (!isUserSide || state.mode === 'p') {
      if (myScore < oppScore && curMin >= 64) {
        pushShift += 7;
        pressLvl = Math.min(2, pressLvl + 1);
        lineLvl = Math.min(2, lineLvl + 1);
      } else if (myScore > oppScore && curMin >= 74) {
        pushShift -= 6;
        lineLvl = Math.max(0, lineLvl - 1);
      }
    }
    const downMen = worldRef.current
      ? worldRef.current.agents.filter((a) => a.side === side && a.sentOff).length
      : 0;
    if (downMen > 0) pushShift -= downMen * 5;

    return {
      tac: base.tac,
      press: pressLvl,
      tempo: base.tempo,
      line: lineLvl,
      wid: base.wid,
      pass: base.pass,
      pushShift
    };
  };

  const getLiveHomeTeam = (): Team => ({
    ...homeOrig,
    tac: meIsHome ? liveTacticsRef.current.tac : homeOrig.tac,
    press: meIsHome ? liveTacticsRef.current.press : homeOrig.press,
    tempo: meIsHome ? liveTacticsRef.current.tempo : homeOrig.tempo,
    line: meIsHome ? liveTacticsRef.current.line : homeOrig.line,
    wid: meIsHome ? liveTacticsRef.current.wid : homeOrig.wid,
    pass: meIsHome ? liveTacticsRef.current.pass : homeOrig.pass,
    lu: simRef.current.homeLu
  });

  const getLiveAwayTeam = (): Team => ({
    ...awayOrig,
    tac: !meIsHome ? liveTacticsRef.current.tac : awayOrig.tac,
    press: !meIsHome ? liveTacticsRef.current.press : awayOrig.press,
    tempo: !meIsHome ? liveTacticsRef.current.tempo : awayOrig.tempo,
    line: !meIsHome ? liveTacticsRef.current.line : awayOrig.line,
    wid: !meIsHome ? liveTacticsRef.current.wid : awayOrig.wid,
    pass: !meIsHome ? liveTacticsRef.current.pass : awayOrig.pass,
    lu: simRef.current.awayLu
  });

  const liveHome = useMemo<Team>(
    () => ({
      ...homeOrig,
      tac: meIsHome ? liveTac : homeOrig.tac,
      press: meIsHome ? livePress : homeOrig.press,
      tempo: meIsHome ? liveTempo : homeOrig.tempo,
      line: meIsHome ? liveLine : homeOrig.line,
      wid: meIsHome ? liveWid : homeOrig.wid,
      pass: meIsHome ? livePass : homeOrig.pass,
      lu: simRef.current.homeLu
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homeOrig, meIsHome, liveTac, livePress, liveTempo, liveLine, liveWid, livePass, liveLu, subLog.length]
  );

  const liveAway = useMemo<Team>(
    () => ({
      ...awayOrig,
      tac: !meIsHome ? liveTac : awayOrig.tac,
      press: !meIsHome ? livePress : awayOrig.press,
      tempo: !meIsHome ? liveTempo : awayOrig.tempo,
      line: !meIsHome ? liveLine : awayOrig.line,
      wid: !meIsHome ? liveWid : awayOrig.wid,
      pass: !meIsHome ? livePass : awayOrig.pass,
      lu: simRef.current.awayLu
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [awayOrig, meIsHome, liveTac, livePress, liveTempo, liveLine, liveWid, livePass, liveLu, subLog.length]
  );

  useEffect(() => {
    SFX.whistle();
    setCrowdAudio(true);
    return () => setCrowdAudio(false);
  }, []);

  const pushLog = (m: number, text: string, tone?: 'goal' | 'card' | 'sys' | 'sub') => {
    setLogs((prev) => [{ m, text, tone }, ...prev].slice(0, 160));
  };

  const addWorldFx = (w: LiveMatchWorld, fx: Omit<LivePitchFx, 'id'>) => {
    w.fx.push({ ...fx, id: w.nextFxId++ });
    if (w.fx.length > 8) w.fx.shift();
  };

  const adjustLiveForm = (playerName: string | null | undefined, delta: number) => {
    if (!playerName) return;
    const sr = simRef.current;
    const cur = sr.liveForm[playerName] ?? 6.5;
    sr.liveForm[playerName] = clamp(Math.round((cur + delta) * 10) / 10, 4.5, 10.0);
  };

  const persistSubAlertPrefs = (enabled: boolean, fitTh: number, formTh: number) => {
    const cur = getSettings();
    saveSettings({
      ...cur,
      subAlertEnabled: enabled,
      subAlertFitThreshold: fitTh,
      subAlertFormThreshold: formTh
    });
  };

  const triggerDramaSlow = (w: LiveMatchWorld, sec: number, label: string) => {
    w.dramaSlowSec = Math.max(w.dramaSlowSec, sec);
    w.dramaLabel = label;
  };

  const issueCard = (culprit: LivePitchAgent, curMin: number, directRedBias = 0.04, forceType?: 'Y' | 'R') => {
    const sr = simRef.current;
    const w = worldRef.current;
    const team = culprit.side === 'H' ? homeOrig : awayOrig;
    const kit = culprit.side === 'H' ? homeKit : awayKit;
    const directRed = forceType === 'R' ? true : forceType === 'Y' ? false : Math.random() < (culprit.tr === 1 ? 0.09 : directRedBias);
    if (directRed) {
      culprit.sentOff = true;
      sr.sentOff.push(culprit.id);
      adjustLiveForm(culprit.id, -0.7);
      sr.cards.push({ m: curMin, t: team.id, who: culprit.id, type: 'R' });
      setMatchCards(sr.cards.slice());
      if (isPlayerMode && culprit.id === myPlayerName) sr.userSentOffMin = curMin;
      pushLog(curMin, `🟥 ใบแดงโดยตรง!! ${culprit.id} (${team.name}) เสียบสกัดอันตราย โดนไล่ออก (แบน 2 นัด)`, 'card');
      setSentOff(sr.sentOff.slice());
      if (w) {
        w.cardBanner = { who: culprit.id, shortName: culprit.shortName, teamName: team.name, type: 'R', kit, ttl: 3.4, maxTtl: 3.4 };
        triggerDramaSlow(w, 2.5, `🟥 ใบแดง!! ${culprit.shortName}`);
      }
      return 'R' as const;
    }
    sr.yellows[culprit.id] = (sr.yellows[culprit.id] || 0) + 1;
    culprit.hasYellow = true;
    setMatchYellows({ ...sr.yellows });
    if (sr.yellows[culprit.id] >= 2) {
      culprit.sentOff = true;
      sr.sentOff.push(culprit.id);
      adjustLiveForm(culprit.id, -0.65);
      sr.cards.push({ m: curMin, t: team.id, who: culprit.id, type: 'Y2R' });
      setMatchCards(sr.cards.slice());
      if (isPlayerMode && culprit.id === myPlayerName) sr.userSentOffMin = curMin;
      pushLog(curMin, `🟨🟨➡🟥 ใบแดง! ${culprit.id} (${team.name}) โดนเหลืองที่สองไล่ออก (แบน 1 นัด)`, 'card');
      setSentOff(sr.sentOff.slice());
      if (w) {
        w.cardBanner = { who: culprit.id, shortName: culprit.shortName, teamName: team.name, type: 'Y2R', kit, ttl: 3.4, maxTtl: 3.4 };
        triggerDramaSlow(w, 2.5, `🟨🟥 เหลืองที่สอง!! ${culprit.shortName}`);
      }
      return 'Y2R' as const;
    }
    adjustLiveForm(culprit.id, -0.35);
    const origPl = team.sq.find((q) => q.n === culprit.id);
    const totalSeasonY = (origPl?.yc || 0) + 1;
    sr.cards.push({ m: curMin, t: team.id, who: culprit.id, type: 'Y' });
    setMatchCards(sr.cards.slice());
    pushLog(
      curMin,
      `🟨 ใบเหลือง! ${culprit.id} (${team.name}) เข้าสกัดหนัก${totalSeasonY >= 3 ? ' (ครบ 3 ใบ แบนนัดหน้า!)' : ` (สะสม ${totalSeasonY}/3)`}`,
      'card'
    );
    if (w) {
      w.cardBanner = { who: culprit.id, shortName: culprit.shortName, teamName: team.name, type: 'Y', kit, ttl: 2.6, maxTtl: 2.6 };
      triggerDramaSlow(w, 1.5, `🟨 ใบเหลือง · ${culprit.shortName}`);
    }
    return 'Y' as const;
  };

  const isAttackRight = (w: LiveMatchWorld, side: 'H' | 'A') => (side === 'H') !== w.secondHalf;
  const attackDirOf = (w: LiveMatchWorld, side: 'H' | 'A') => (isAttackRight(w, side) ? 1 : -1);

  const tryTriggerInMatchInjury = (
    w: LiveMatchWorld,
    victim: LivePitchAgent,
    curMin: number,
    severity: 'foul' | 'slide' | 'clash' | 'fatigue',
    isInstantStep = false
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
    const medLv = isMySide ? (state.med ?? 1) : 1;
    const physioLv = isMySide ? (state.staff?.physio ?? 0) : 0;
    const medMult = Math.max(0.45, 1 - (medLv - 1) * 0.08 - physioLv * 0.08) * (isMySide && state.tf === 'F' ? 0.55 : 1);
    const tolMult = clamp((132 - (D.d.tol || 65)) / 65, 0.55, 1.45);
    const fitMult = curFit < 54 ? 1.8 : curFit < 65 ? 1.25 : 0.85;
    const baseProb = severity === 'foul' ? 0.055 : severity === 'slide' ? 0.038 : severity === 'clash' ? 0.028 : 0.0055;
    if (Math.random() >= baseProb * medMult * tolMult * fitMult) return false;

    const rawGames = severity === 'foul' ? R(2, 4) : R(1, 3);
    const games = injD(pl, rawGames, state.p);
    w.inMatchInjuryCount++;
    sr.injuredNames.push(victim.id);
    sr.injuries.push({ teamId: sideOrig.id, name: victim.id, games });
    victim.injuredOut = true;

    addWorldFx(w, {
      type: 'injury',
      x: victim.x,
      y: victim.y,
      label: `🩹 ${victim.shortName} เจ็บ! (${games} นัด)`,
      color: '#ef4444',
      ttl: 2.8,
      maxTtl: 2.8
    });
    pushLog(curMin, `🩹 บาดเจ็บในสนาม!! ${victim.id} (${sideOrig.name}) เจ็บระหว่างเล่น · คาดพัก ${games} นัด`, 'card');

    const isHomeSide = victim.side === 'H';
    const curLu = isHomeSide ? sr.homeLu : sr.awayLu;
    const curPlayed = isHomeSide ? sr.homePlayed : sr.awayPlayed;
    const subsCount = isHomeSide ? sr.homeSubsCount : sr.awaySubsCount;

    if (isPlayerMode && victim.id === myPlayerName) {
      sr.userSubOutMin = curMin;
    }

    if (state.mode === 'm' && isMySide) {
      if (subsCount < 5 && !isInstantStep) {
        w.phaseLabel = `🩹 ด่วน! ${victim.shortName} บาดเจ็บ ต้องเปลี่ยนตัวออก!`;
        w.phaseTone = 'danger';
        triggerDramaSlow(w, 1.8, `🩹 ${victim.shortName} บาดเจ็บ!`);
        setInjuryAlert({
          name: victim.id,
          role: pl.ro,
          no: getShirtNo(sideOrig, pl),
          games,
          minute: curMin
        });
        setSubPickOut(victim.id);
        setShowTacticsDrawer(true);
        setMlandMatchTab('tactics');
        setPaused(true);
        vibrate(55);
      } else if (subsCount < 5) {
        // Instant skip mode auto-sub
        const bench = sideOrig.sq
          .filter((q) => !curPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n) && q.pos !== 'GK')
          .sort((a, b) => (a.pos === pl.pos ? 1 : 0) - (b.pos === pl.pos ? 1 : 0) || b.ov - a.ov);
        const subIn = bench.find((b) => b.pos === pl.pos) || bench[0];
        const idx = curLu.indexOf(victim.id);
        if (subIn && idx >= 0) {
          curLu[idx] = subIn.n;
          if (!curPlayed.includes(subIn.n)) curPlayed.push(subIn.n);
          if (isHomeSide) sr.homeSubsCount++;
          else sr.awaySubsCount++;
          sr.subs.push({ m: curMin, t: sideOrig.id, inPlayer: subIn.n, outPlayer: victim.id });
          pushLog(curMin, `🔄 เปลี่ยนตัวด่วนแทนผู้เจ็บ: 🟢 ${subIn.n} เข้าแทน 🩹 ${victim.id}`, 'sub');
        }
      } else {
        victim.sentOff = true;
        sr.sentOff.push(victim.id);
        setSentOff(sr.sentOff.slice());
        pushLog(curMin, `⚠️ เปลี่ยนตัวครบโควต้าแล้ว! ${sideOrig.name} จำใจเล่นด้วยผู้เล่นน้อยกว่า`, 'card');
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
      if (isHomeSide) sr.homeSubsCount++;
      else sr.awaySubsCount++;
      sr.subs.push({ m: curMin, t: sideOrig.id, inPlayer: subIn.n, outPlayer: victim.id });
      const rep = buildAgentsForTeam(sideOrig, victim.side, curLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName, w.secondHalf);
      const agIdx = w.agents.findIndex((a) => a.id === victim.id);
      if (agIdx >= 0 && rep[idx]) {
        rep[idx].x = w.agents[agIdx].x;
        rep[idx].y = w.agents[agIdx].y;
        w.agents[agIdx] = rep[idx];
        if (w.ball.carrierId === victim.id) w.ball.carrierId = subIn.n;
        if (w.ball.targetId === victim.id) w.ball.targetId = subIn.n;
      }
      if (isMySide) {
        setLiveLu(curLu.slice());
        setSubsUsed(sr.subs.filter((s) => s.t === sideOrig.id).map((s) => s.inPlayer));
      } else {
        setLiveOppLu(curLu.slice());
      }
      setSubLog(sr.subs.slice());
      pushLog(curMin, `🔄 เปลี่ยนตัวฉุกเฉิน (${sideOrig.name}): 🟢 ${subIn.n} เข้าแทน 🩹 ${victim.id}`, 'sub');
    } else {
      victim.sentOff = true;
      sr.sentOff.push(victim.id);
      setSentOff(sr.sentOff.slice());
      pushLog(curMin, `⚠️ ${sideOrig.name} เปลี่ยนตัวไม่ได้แล้ว ต้องฝืนเล่นต่อด้วยผู้เล่น ${11 - sr.sentOff.length} คน`, 'card');
    }
    return true;
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
        const uPenalty = u.role === 'CB' && defBallNormX >= 42 ? 22 : 0;
        const vPenalty = v.role === 'CB' && defBallNormX >= 42 ? 22 : 0;
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
      .slice(0, 2);

    const setPiece = w.pendingSetPiece;
    const lockedTargetIds = new Set<string>();

    // Track corner role assignment indices so players fan out instead of stacking
    const cornerAttList =
      setPiece && setPiece.type === 'corner'
        ? activeAgents.filter(
            (z) => z.side === setPiece.side && z.pos !== 'GK' && (z.pos === 'FW' || z.role === 'CB' || z.pos === 'MF')
          )
        : [];
    const cornerDefList =
      setPiece && setPiece.type === 'corner'
        ? activeAgents.filter((z) => z.side !== setPiece.side && z.pos !== 'GK')
        : [];

    activeAgents.forEach((ag) => {
      if (w.celebrateTimer <= 0 && ag.intent === 'CELEBRATE') {
        ag.intent = 'SUPPORT';
        ag.intentTimer = 0;
      }
      if (ag.intentTimer > 0) {
        if (ag.intent === 'CELEBRATE' || ag.intent === 'DIVE') {
          lockedTargetIds.add(ag.id);
          return;
        }
        ag.intentTimer = Math.max(0, ag.intentTimer - 0.016);
        if (ag.intent === 'MAKE_RUN' && ag.runToX != null && ag.runToY != null) {
          ag.tx = clamp(ag.runToX, 5, 95);
          ag.ty = clamp(ag.runToY, 6, 94);
          return;
        }
      }

      const isH = ag.side === 'H';
      const attRight = isAttackRight(w, ag.side);
      const cfg = isH ? hCfg : aCfg;
      const inPoss = b.possessionSide === ag.side;
      const dir = attRight ? 1 : -1;

      // Celebration run!
      if (w.celebrateTimer > 0 && inPoss && ag.pos !== 'GK') {
        ag.intent = 'CELEBRATE';
        const cornerY = b.y < 50 ? 12 : 88;
        const cornerX = attRight ? 92 : 8;
        ag.tx = clamp(cornerX + (((ag.slotIndex % 3) - 1) * 4), 6, 94);
        ag.ty = clamp(cornerY + (((ag.slotIndex % 4) - 1.5) * 4), 8, 92);
        ag.runToX = undefined;
        ag.runToY = undefined;
        lockedTargetIds.add(ag.id);
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
          ag.intent = 'SUPPORT';
          return;
        }
        const teamActive = activeAgents.filter((z) => z.side === ag.side && z.pos !== 'GK');
        const kicker = teamActive.find((z) => z.pos === 'FW') || teamActive.find((z) => z.pos === 'MF') || teamActive[0];
        const partner = teamActive.find((z) => z.id !== kicker?.id && (z.pos === 'MF' || z.pos === 'FW')) || teamActive[1];
        const isKickSide = ag.side === setPiece.side;
        if (isKickSide && kicker && ag.id === kicker.id) {
          ag.tx = 50 - dir * 0.6;
          ag.ty = 50;
          ag.intent = 'SUPPORT';
          return;
        }
        if (isKickSide && partner && ag.id === partner.id) {
          ag.tx = 50 - dir * 5.2;
          ag.ty = 45;
          ag.intent = 'SUPPORT';
          return;
        }
        const ownHalfNormX = clamp(8 + (100 - ag.slotY) * 0.43, 10, 47.2);
        const rawSlotY = attRight ? ag.slotX : 100 - ag.slotX;
        let kickTx = attRight ? ownHalfNormX : 100 - ownHalfNormX;
        const kickTy = clamp(50 + (rawSlotY - 50) * 0.92, 9, 91);
        if (!isKickSide && Math.hypot(kickTx - 50, kickTy - 50) < 9.5) {
          kickTx = attRight ? Math.min(kickTx, 40.5) : Math.max(kickTx, 59.5);
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

      // In-match Penalty Kick positioning
      if (setPiece && setPiece.type === 'penalty') {
        const isAtt = ag.side === setPiece.side;
        const penRight = isAttackRight(w, setPiece.side);
        const spotX = penRight ? 88.5 : 11.5;
        lockedTargetIds.add(ag.id);
        if (!isAtt && ag.pos === 'GK') {
          ag.tx = penRight ? 98.2 : 1.8;
          ag.ty = 50;
          ag.intent = 'SUPPORT';
          return;
        }
        if (ag.pos !== 'GK') {
          const lineBackX = penRight ? 80.5 : 19.5;
          ag.tx = penRight
            ? Math.min(spotX - 7.5, lineBackX - (ag.slotIndex % 3) * 2.8)
            : Math.max(spotX + 7.5, lineBackX + (ag.slotIndex % 3) * 2.8);
          ag.ty = clamp(22 + ((ag.slotIndex * 5.6) % 56), 18, 82);
          ag.intent = 'SUPPORT';
          return;
        }
      }

      // Free-kick defensive wall & set piece positioning
      if (setPiece && setPiece.type === 'freekick') {
        if (ag.side !== setPiece.side && setPiece.wallPlayers) {
          const wallIdx = activeAgents
            .filter((z) => z.side === ag.side && (z.pos === 'DF' || z.pos === 'MF'))
            .sort((u, v) => Math.hypot(u.x - setPiece.x, u.y - setPiece.y) - Math.hypot(v.x - setPiece.x, v.y - setPiece.y))
            .slice(0, setPiece.wallPlayers.length)
            .findIndex((z) => z.id === ag.id);
          if (wallIdx >= 0 && setPiece.wallPlayers[wallIdx]) {
            ag.intent = 'WALL';
            ag.tx = setPiece.wallPlayers[wallIdx].x;
            ag.ty = setPiece.wallPlayers[wallIdx].y;
            lockedTargetIds.add(ag.id);
            return;
          }
        }
      }

      // Corner kick structured box zoning (near post, penalty spot, far post, D-arc edge, rest defense)
      if (setPiece && setPiece.type === 'corner' && ag.pos !== 'GK') {
        const isAtt = ag.side === setPiece.side;
        const cornerRight = isAttackRight(w, setPiece.side);
        const toCornerX = (normX: number) => (cornerRight ? normX : 100 - normX);
        if (isAtt) {
          const idx = cornerAttList.findIndex((z) => z.id === ag.id);
          if (idx >= 0) {
            const boxZones: [number, number][] = [
              [91.2, 41],  // Near post flick
              [88.6, 50],  // Penalty spot
              [91.0, 59],  // Far post
              [85.2, 45],  // Central box runner
              [78.5, 43],  // Edge of box D-arc (cutback/rebound)
              [78.5, 57],  // Edge of box far side
              [60.0, 36],  // Rest defense
              [58.0, 64]   // Rest defense
            ];
            const [znX, znY] = boxZones[idx] || [55, 50];
            ag.intent = idx < 4 ? 'MAKE_RUN' : 'SUPPORT';
            ag.tx = clamp(toCornerX(znX), 6, 94);
            ag.ty = clamp(setPiece.y > 50 ? 100 - znY : znY, 10, 90);
            if (idx < 4) {
              ag.runToX = ag.tx;
              ag.runToY = ag.ty;
            }
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
            // Defending team attacks opposite of cornerRight unless cfg.tac === 'Z'
            const defNormX = 100 - znX;
            const outShift = cfg.tac === 'Z' && defIdx >= 7 ? -10 : 0;
            ag.intent = defIdx < 7 ? 'MARK' : 'SUPPORT';
            ag.tx = clamp(toCornerX(clamp(100 - (defNormX + outShift), 46, 94.5)), 5, 95);
            ag.ty = clamp(setPiece.y > 50 ? 100 - znY : znY, 10, 90);
            return;
          }
        }
      }

      // Goalkeeper AI (signature 'cl' rushes further to close angles; preserve active DIVE!)
      if (ag.pos === 'GK') {
        if (ag.intent === 'DIVE' && ag.intentTimer > 0 && ag.diveTargetY != null) {
          ag.ty = ag.diveTargetY;
          ag.runToX = undefined;
          ag.runToY = undefined;
          lockedTargetIds.add(ag.id);
          return;
        }
        const goalX = attRight ? 2.4 : 97.6;
        const ballThreat = attRight ? clamp((30 - b.x) / 30, 0, 1) : clamp((b.x - 70) / 30, 0, 1);
        const sweepBonus = ag.sig === 'cl' ? 1.1 : 0;
        const sweepPush = (ag.d.cl > 68 ? 2.2 : 1.1 + sweepBonus) * (inPoss ? 1.35 : ballThreat);
        ag.tx = clamp(goalX + dir * (0.8 + sweepPush), 2.0, 98.0);
        ag.ty = clamp(50 + (b.y - 50) * 0.24, 42.5, 57.5);
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

      if (b.carrierId === ag.id) {
        ag.intent = 'CARRY';
        const curNormX = attRight ? ag.x : 100 - ag.x;
        // Near the byline/6-yard box, look to cut inside at an angle rather than running onto the goal line
        const nextNormX = curNormX > 88 ? curNormX + 1.5 : curNormX + (cfg.tempo === 2 ? 5.0 : cfg.tempo === 0 ? 2.5 : 4.0);
        normX = clamp(nextNormX, 6, 92.5);
        ty = clamp(ag.y + (50 - ag.y) * (curNormX > 85 ? 0.22 : cfg.wid === 0 ? 0.14 : 0.07), 7, 93);
      } else if (b.targetId === ag.id) {
        ag.intent = 'PASS_TARGET';
        normX = attRight ? b.toX : 100 - b.toX;
        ty = clamp(b.toY, 6, 94);
        if (b.flightType === 'cross' || b.flightType === 'corner') {
          lockedTargetIds.add(ag.id);
        }
      } else if (inPoss) {
        const oppDefRaw = isH ? aDefLineX : hDefLineX;
        const oppDefNorm = clamp(attRight ? oppDefRaw : 100 - oppDefRaw, 53, 90.5);
        const carrierNormX = carrier ? (attRight ? carrier.x : 100 - carrier.x) : ballNormX;
        const sigRunBoost = ag.sig === 'run' || ag.sig === 'spd' ? 2.0 : 0;
        const attPushBias = cfg.tac === 'X' ? 3.5 : cfg.tac === 'A' ? 2.0 : cfg.tac === 'Z' ? -5.0 : cfg.tac === 'D' ? -2.5 : 0;

        // ROLE-DISTINCT OFF-BALL INTELLIGENCE (anchored faithfully to each player's formation lane & line)
        if (ag.role === 'ST' || (ag.sig === 'run' && ag.pos === 'FW' && ag.role !== 'LW' && ag.role !== 'RW' && ag.role !== 'CF')) {
          const shoulderNorm = Math.min(88.5, oppDefNorm - 1.2);
          const readyToSprint = ballNormX > 52 && carrier && carrier.side === ag.side && (cfg.pass >= 2 || cfg.tempo === 2 || cfg.tac === 'A' || cfg.tac === 'X');
          const stLaneY = clamp(widenedY * 0.78 + 50 * 0.22 + (b.y - 50) * 0.14 + Math.sin(w.minuteFloat * 0.9 + ag.slotIndex) * 4.5, 16, 84);
          if (readyToSprint && normX < 89.2) {
            normX = clamp(Math.min(oppDefNorm - 0.4, Math.max(normX, shoulderNorm)), 18, 90.2);
            ty = stLaneY;
            ag.intent = 'MAKE_RUN';
            const runNorm = clamp(Math.min(oppDefNorm + 1.3, normX + 3.2 + sigRunBoost * 0.5), 18, 91.2);
            ag.runToX = attRight ? runNorm : 100 - runNorm;
            ag.runToY = clamp(ty + (50 - ty) * 0.14, 24, 76);
          } else {
            // Hold striker shoulder cleanly onside within assigned left/center/right lane
            normX = clamp(Math.min(shoulderNorm, Math.max(normX, carrierNormX + 9)), 20, 88.5);
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
          const deepBoxTarget = ballNormX > 74 ? 82.0 : Math.min(oppDefNorm - 1.2, 85.0 + attPushBias * 0.3);
          if (ballNormX > 52 && cfg.tac !== 'Z') {
            normX = clamp(Math.min(deepBoxTarget, Math.max(homeBaseX + 5, carrierNormX + 11)), 26, 85.5);
            ty = camLaneY;
            ag.intent = 'MAKE_RUN';
            const runNorm = clamp(Math.min(oppDefNorm + 0.8, normX + 3.0), 26, 86.8);
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
            normX = clamp(Math.min(oppDefNorm - 0.7, 88.0), 24, 88.8);
            ty = clamp(attRight ? (isLeftWing ? 28 : 72) : isLeftWing ? 72 : 28, 22, 78);
            ag.intent = 'MAKE_RUN';
            const runNorm = clamp(Math.min(oppDefNorm + 1.0, normX + 3.0), 24, 89.2);
            ag.runToX = attRight ? runNorm : 100 - runNorm;
            ag.runToY = ty;
          } else if (ballNormX > 46 && cfg.tac !== 'Z') {
            normX = clamp(Math.min(oppDefNorm - 0.6, Math.max(homeBaseX, normX + 6 + sigRunBoost + attPushBias * 0.5)), 24, 88.2);
            ty = wingLaneY;
            ag.intent = 'MAKE_RUN';
            const runNorm = clamp(Math.min(oppDefNorm + 0.9, normX + 3.2), 24, 89.0);
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
            const fbCap = cfg.tac === 'X' ? 66 : cfg.tac === 'A' ? 60 : cfg.tac === 'D' ? 46 : cfg.tac === 'Z' ? 38 : 54;
            normX = clamp(normX, 16, fbCap);
            ty = anchoredFbY;
          }
        } else if (ag.pos === 'DF') {
          // Center backs hold rest defense line and clear left-center-right spacing
          const cbCap = cfg.tac === 'X' ? 62 : cfg.tac === 'A' ? 56 : cfg.tac === 'D' ? 43 : cfg.tac === 'Z' ? 35 : 50;
          normX = clamp(normX, 13, cbCap);
          ty = clamp(50 + (widenedY - 50) * (cfg.wid === 0 ? 0.65 : 0.84) + (b.y - 50) * 0.12, 22, 78);
        } else if (ag.role === 'CDM' || ag.role === 'LDM' || ag.role === 'RDM') {
          // Holding pivot screens behind the ball and preserves double-pivot lateral spacing
          const dmCap = cfg.tac === 'Z' ? 46 : cfg.tac === 'D' ? 54 : cfg.tac === 'X' ? 68 : 62;
          normX = clamp(Math.min(normX, Math.max(homeBaseX - 3, carrierNormX - 4)), 19, dmCap);
          ty = clamp(widenedY * 0.78 + (50 + (b.y - 50) * 0.2) * 0.22, 18, 82);
        } else if (attMids.some((m) => m.id === ag.id) && carrier) {
          const idxM = attMids.findIndex((m) => m.id === ag.id);
          if (carrierNormX >= 80 && cfg.tac !== 'Z') {
            normX = clamp(idxM === 0 ? 76 : 71, 22, 79);
            ty = clamp(widenedY * 0.58 + (50 + (idxM === 0 ? -12 : 12)) * 0.42, 16, 84);
          } else {
            const triDist = cfg.pass === 0 ? 10 : cfg.pass >= 2 ? 16 : 13;
            normX = clamp(homeBaseX * 0.38 + (carrierNormX + triDist * 0.45) * 0.62 + attPushBias * 0.35, 22, cfg.tac === 'Z' ? 60 : 78);
            ty = clamp(widenedY * 0.65 + (carrier.y + (idxM === 0 ? -8 : 8)) * 0.35, 14, 86);
          }
          ag.intent = 'SUPPORT';
        } else {
          // Supporting central midfield holds formation slot depth & width
          normX = clamp(normX, 20, cfg.tac === 'Z' ? 56 : cfg.tac === 'D' ? 64 : 74);
          ty = clamp(widenedY * 0.78 + (b.y - 50) * 0.18 + 50 * 0.04, 14, 86);
        }
      } else {
        // OUT OF POSSESSION: Strictly reflects Mentality (tac), Defensive Line (line), Pressing (press), Width (wid), and slot structure
        const tacBackDrop = cfg.tac === 'Z' ? -5.0 : cfg.tac === 'D' ? -2.5 : cfg.tac === 'X' ? 5.5 : cfg.tac === 'A' ? 3.0 : 0;
        const lineHeightFloor = (cfg.line === 2 ? 20.5 : cfg.line === 0 ? 10.5 : 14.5) + tacBackDrop;
        const lineCeiling = cfg.line === 2 ? 48 : cfg.line === 0 ? 32 : 41;
        const backLineNorm = clamp(
          Math.min(ballNormX - 7.5, 31 + (cfg.line - 1) * 8.5 + tacBackDrop),
          Math.max(9.8, lineHeightFloor),
          lineCeiling
        );
        const pressTriggerLimit = cfg.press === 2 ? 95 : cfg.press === 1 ? 68 : 49;
        const shouldEngagePress = ballNormX <= pressTriggerLimit;

        if (ag.id === primaryPresserId) {
          if (shouldEngagePress) {
            ag.intent = 'PRESS';
            const stepX = cfg.press === 2 ? ballNormX - 0.8 : ballNormX - 2.2;
            normX = clamp(stepX, 8.2, 92);
            ty = clamp(b.y, 7, 93);
          } else {
            ag.intent = 'MARK';
            normX = clamp(Math.min(ballNormX - 6.5, backLineNorm + 14), 14, 62);
            ty = clamp(widenedY * 0.4 + (b.y + (50 - b.y) * 0.25) * 0.6, 12, 88);
          }
        } else if (ag.id === secondaryCoverId) {
          ag.intent = cfg.press === 2 && shouldEngagePress ? 'PRESS' : 'MARK';
          const coverGap = cfg.press === 2 ? 3.5 : cfg.press === 0 ? 8.5 : 6.0;
          normX = clamp(Math.max(backLineNorm + 2.5, ballNormX - coverGap), 11.2, 88);
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
            normX = clamp(normX * 0.26 + (backLineNorm + (ballOnFlank && cfg.tac !== 'Z' ? 2.2 : 0.6)) * 0.74, Math.max(10.5, backLineNorm), lineCeiling + 3);
            ty = ballOnFlank
              ? clamp(targetFbY * 0.72 + b.y * 0.28, 10, 90)
              : clamp(50 + (targetFbY - 50) * (cfg.wid === 0 ? 0.62 : 0.78), 12, 88);
          } else {
            normX = clamp(normX * 0.18 + backLineNorm * 0.82, Math.max(9.8, backLineNorm - 0.5), lineCeiling + 1);
            ty = clamp(50 + (widenedY - 50) * (cfg.wid === 0 ? 0.62 : 0.78) + (b.y - 50) * 0.14, 24, 76);
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
    }
  ) => {
    const b = w.ball;
    const sr = simRef.current;
    const { flightType, side, fromX, fromY, shooter, shotStyle, curveAmt, maxZAmt, durAmt, isPanenka } = opts;
    const defSide: 'H' | 'A' = side === 'H' ? 'A' : 'H';
    const attRightNow = isAttackRight(w, side);
    const active = w.agents.filter((a) => !a.sentOff);
    const defPool = active.filter((a) => a.side === defSide);
    const gk = defPool.find((a) => a.pos === 'GK') || defPool[0];
    const defenders = defPool.filter((a) => a.pos === 'DF' || a.pos === 'MF');

    const goalLineX = attRightNow ? 100 : 0;
    const dist = Math.hypot(goalLineX - fromX, 50 - fromY);

    b.fromX = fromX;
    b.fromY = fromY;
    b.curve = curveAmt;
    b.maxZ = maxZAmt;
    b.progress = 0;
    b.duration = durAmt;
    b.flightType = flightType;
    b.shotStyle = shotStyle;
    b.carrierId = null;
    b.targetId = null;
    b.shooterId = shooter?.id || null;
    b.possessionSide = side;
    b.bounceNext = undefined;

    // 1. Check defender block / free-kick wall deflection / shot deflection ("ยิงแฉลบ") first (except penalty)
    if (flightType !== 'penalty') {
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
        .filter((x) => x.perpDist < (flightType === 'freekick' ? 8.5 : x.d.sig === 'blk' ? 9.5 : 7.8))
        .sort((u, v) => u.perpDist - v.perpDist || u.tProj - v.tProj);

      const wallDef = flightType === 'freekick' ? defenders.find((d) => d.intent === 'WALL') || corridorCands[0]?.d : undefined;
      const nearDef = wallDef || corridorCands[0]?.d;

      if (nearDef) {
        const blockChance =
          flightType === 'freekick'
            ? clamp(0.18 - ((shooter?.d.cur || 60) - 60) * 0.002, 0.09, 0.24)
            : clamp(0.09 + ((nearDef.sig === 'blk' ? nearDef.d.blk + 12 : nearDef.d.blk) - 60) * 0.0035, 0.05, 0.22);
        const deflectChance =
          flightType === 'freekick'
            ? 0.14
            : clamp(0.11 + (corridorCands.length >= 2 ? 0.05 : 0) + (shotStyle === 'header' || shotStyle === 'diving_header' ? 0.03 : 0), 0.10, 0.19);
        const contactRoll = Math.random();

        if (contactRoll < blockChance) {
          b.toX = nearDef.x;
          b.toY = nearDef.y;
          b.curve = curveAmt * 0.25;
          b.maxZ = Math.min(maxZAmt, 2.4);
          b.duration = clamp(Math.hypot(nearDef.x - fromX, nearDef.y - fromY) / 40, 0.16, 0.38);
          b.shotPlan = { outcome: 'block', blockerId: nearDef.id };
          return;
        }
        if (contactRoll < blockChance + deflectChance) {
          b.toX = clamp(nearDef.x + (Math.random() - 0.5) * 1.1, 3.5, 96.5);
          b.toY = clamp(nearDef.y + (Math.random() - 0.5) * 1.4, 8, 92);
          b.curve = curveAmt * 0.28;
          b.maxZ = clamp(maxZAmt * 0.52, 1.8, 5.2);
          b.duration = clamp(Math.hypot(b.toX - fromX, b.toY - fromY) / 42, 0.15, 0.38);
          b.shotPlan = { outcome: 'deflect', blockerId: nearDef.id, deflectorId: nearDef.id };
          if (gk) {
            const leanY = clamp(b.toY, 44, 56);
            gk.ty = leanY;
            gk.intent = 'DIVE';
            gk.intentTimer = Math.max(b.duration + 0.45, 0.85);
            gk.diveDir = leanY >= gk.y ? 1 : -1;
            gk.diveTargetY = leanY;
            gk.diveProgress = 0.02;
          }
          return;
        }
      }
    }

    // 2. Accuracy roll: On-Target vs Woodwork vs Off-Target
    const sigFinBoost = shooter?.sig === 'fin' ? 0.06 : shooter?.sig === 'comp' && (curMin >= 70 || isDerby || kind !== 'league') ? 0.05 : 0;
    const accuracy =
      flightType === 'penalty'
        ? isPanenka
          ? 0.89
          : 0.92
        : clamp(0.46 + ((shooter?.d.fin || 60) - 60) * 0.004 + sigFinBoost - Math.max(0, dist - 22) * 0.007, 0.26, 0.72);

    if (Math.random() > accuracy) {
      const hitWoodwork = Math.random() < (flightType === 'penalty' ? 0.35 : 0.16);
      if (hitWoodwork) {
        const postSide = Math.random() < 0.5 ? -1 : 1;
        const hitCrossbar = Math.random() < 0.45;
        b.toX = attRightNow ? 99.8 : 0.2;
        b.toY = hitCrossbar ? 44 + Math.random() * 12 : postSide < 0 ? 42.0 : 58.0;
        if (hitCrossbar) b.maxZ = Math.max(maxZAmt, 6.2);
        b.shotPlan = { outcome: 'woodwork' };
      } else {
        const missSide = fromY < 50 ? (Math.random() < 0.62 ? -1 : 1) : Math.random() < 0.62 ? 1 : -1;
        b.toX = attRightNow ? 101.2 : -1.2;
        b.toY = missSide < 0 ? 33.5 + Math.random() * 6.8 : 59.7 + Math.random() * 6.8;
        b.shotPlan = { outcome: 'miss' };
      }
      if (gk) {
        const diveY = clamp(b.toY, 41.2, 58.8);
        gk.intent = 'DIVE';
        gk.intentTimer = Math.max(durAmt + 0.25, 0.88);
        gk.diveDir = diveY >= gk.y ? 1 : -1;
        gk.diveTargetY = diveY;
        gk.diveProgress = 0.02;
      }
      return;
    }

    // 3. On-Target: Goal vs GK Save!
    const onTargetY = isPanenka ? 50 + (Math.random() - 0.5) * 3 : 42.8 + Math.random() * 14.4;
    const hR = rate(getLiveHomeTeam(), state, kind !== 'league' || isDerby, curMin, sr.subs.map((s) => s.inPlayer), sr.sentOff);
    const aR = rate(getLiveAwayTeam(), state, kind !== 'league' || isDerby, curMin, sr.subs.map((s) => s.inPlayer), sr.sentOff);
    const edge = side === 'H' ? hR.at - aR.df : aR.at - hR.df;
    const gkSaveScore = gk ? (gk.d.sv + (gk.sig === 'sv' ? 9 : 0)) * 0.56 + (gk.d.cl + (gk.sig === 'cl' ? 8 : 0)) * 0.44 : 58;
    const shooterScore = shooter
      ? (shooter.d.fin + (shooter.sig === 'fin' ? 8 : 0)) * 0.5 +
        (shooter.d.cur + (shooter.sig === 'cur' ? 8 : 0)) * 0.25 +
        (shooter.d.pw + (shooter.sig === 'pw' ? 8 : 0)) * 0.25
      : 60;
    const goalProb =
      flightType === 'penalty'
        ? clamp(0.79 + (shooterScore - gkSaveScore) * 0.004, 0.65, 0.9)
        : clamp(0.27 + edge * 0.0065 + (shooterScore - gkSaveScore) * 0.004 + (flightType === 'freekick' ? 0.03 : 0), 0.14, 0.54);

    if (Math.random() < goalProb) {
      b.toX = attRightNow ? 101.3 : -1.3;
      b.toY = onTargetY;
      b.shotPlan = { outcome: 'goal' };
      if (gk) {
        const wrongWay = isPanenka || (shotStyle === 'curler' && Math.random() < 0.35);
        const diveY = wrongWay ? clamp(50 - (onTargetY - 50), 42.5, 57.5) : clamp(onTargetY, 42.0, 58.0);
        gk.intent = 'DIVE';
        gk.intentTimer = Math.max(durAmt + 0.25, 0.88);
        gk.diveDir = diveY >= gk.y ? 1 : -1;
        gk.diveTargetY = diveY;
        gk.diveProgress = 0.02;
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
      b.shotPlan = { outcome: 'save', parryCorner };
      if (gk) {
        gk.tx = gkSaveX;
        gk.ty = clamp(onTargetY, 42.2, 57.8);
        gk.intent = 'DIVE';
        gk.intentTimer = Math.max(b.duration + 0.32, 0.88);
        gk.diveDir = onTargetY >= gk.y ? 1 : -1;
        gk.diveTargetY = clamp(onTargetY, 42.2, 57.8);
        gk.diveProgress = 0.02;
      }
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
    const isOffside = attRight ? receiver.x > offsideLineX + 0.5 : receiver.x < offsideLineX - 0.5;
    return { isOffside, oppLineX: offsideLineX };
  };

  const triggerOffsideCall = (
    w: LiveMatchWorld,
    curMin: number,
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
    b.fromX = passer.x;
    b.fromY = passer.y;
    b.toX = clamp(flagX, 6, 94);
    b.toY = receiver.y;
    b.curve = (Math.random() - 0.5) * 3;
    b.maxZ = flightType === 'lofted' || flightType === 'cross' ? 11 : 4;
    b.progress = 0;
    b.duration = 0.44;
    b.flightType = flightType;
    b.shotStyle = undefined;
    b.carrierId = null;
    b.targetId = receiver.id;
    b.lastPasserId = passer.id;
    addWorldFx(w, {
      type: 'offside',
      x: clamp(flagX, 8, 92),
      y: receiver.y,
      offsideX: oppLineX,
      label: `🚩 ล้ำหน้า (${receiver.shortName})`,
      color: '#facc15',
      ttl: 2.3,
      maxTtl: 2.3
    });
    w.pendingSetPiece = {
      type: 'offside',
      side: defSide,
      x: clamp(oppLineX, 8, 92),
      y: receiver.y,
      waitSec: 1.45
    };
    w.phaseLabel = `🚩 ล้ำหน้า! ${receiver.shortName} ${reasonText}`;
    w.phaseTone = 'offside';
    SFX.foul();
    pushLog(curMin, `🚩 ล้ำหน้า! ${receiver.id} (${attTeam.name}) ${reasonText}`);
  };

  // Start next micro-play when ball finishes current movement/segment
  const scheduleNextPlay = (w: LiveMatchWorld, curMin: number) => {
    if (simRef.current.done) return;
    const b = w.ball;
    const active = w.agents.filter((a) => !a.sentOff);
    const getTeamPool = (side: 'H' | 'A') => active.filter((a) => a.side === side);

    // 1. Pending Set Piece Execution (Kickoff, Free Kick, Corner, Offside Restart, Goal Kick, Penalty)
    if (w.pendingSetPiece) {
      const sp = w.pendingSetPiece;
      if (sp.waitSec > 0) return;
      w.pendingSetPiece = null;
      const attPool = getTeamPool(sp.side);
      const defSide = sp.side === 'H' ? 'A' : 'H';
      const attRight = isAttackRight(w, sp.side);
      const dir = attRight ? 1 : -1;
      const attTeam = sp.side === 'H' ? homeOrig : awayOrig;
      const attCfg = getEffectiveTeamCfg(sp.side, curMin);

      if (sp.type === 'kickoff') {
        const kicker = attPool.find((a) => a.pos === 'FW') || attPool.find((a) => a.pos === 'MF') || attPool[0];
        const midTarget = attPool.find((a) => a.pos === 'MF' && a.id !== kicker?.id) || attPool[1] || kicker;
        if (kicker && midTarget) {
          kicker.x = 50;
          kicker.y = 50;
          b.x = 50;
          b.y = 50;
          b.fromX = 50;
          b.fromY = 50;
          b.toX = midTarget.x;
          b.toY = midTarget.y;
          b.curve = 0;
          b.maxZ = 0;
          b.progress = 0;
          b.duration = 0.44;
          b.flightType = 'pass';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = midTarget.id;
          b.lastPasserId = kicker.id;
          b.possessionSide = sp.side;
          w.phaseLabel = `⚽ ${attTeam.name} ครองบอลขึ้นเกม`;
          w.phaseTone = 'normal';
        }
        return;
      }

      if (sp.type === 'goalkick' || sp.type === 'offside') {
        const kicker = sp.type === 'goalkick' ? attPool.find((a) => a.pos === 'GK') || attPool[0] : attPool.find((a) => a.pos === 'DF') || attPool[0];
        const longDistBias = attCfg.pass >= 2 || kicker?.sig === 'dist';
        const receiver =
          longDistBias
            ? attPool.find((a) => a.pos === 'FW') || attPool.find((a) => a.pos === 'MF')
            : attPool.find((a) => (a.pos === 'DF' || a.pos === 'MF') && a.id !== kicker?.id);
        if (kicker && receiver) {
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = receiver.x;
          b.toY = receiver.y;
          b.curve = (Math.random() - 0.5) * 3.5;
          b.maxZ = longDistBias ? 16 : 4;
          b.progress = 0;
          b.duration = longDistBias ? 0.78 : 0.48;
          b.flightType = longDistBias ? 'lofted' : 'goalkick';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = receiver.id;
          b.lastPasserId = kicker.id;
          b.possessionSide = sp.side;
          w.phaseLabel =
            sp.type === 'offside'
              ? `⚽ เตะฟรีคิกล้ำหน้า (${attTeam.name})`
              : kicker.sig === 'dist'
                ? `🚀 ${kicker.shortName} [จุดเด่น: จ่ายแนวหลัง] เปิดบอลโด่งสวนกลับ!`
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
          attPool
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => (v.d.cur + v.d.pw + (v.sig === 'cur' ? 12 : 0)) - (u.d.cur + u.d.pw + (u.sig === 'cur' ? 12 : 0)))[0] || attPool[0];
        if (!taker) return;
        taker.x = clamp(sp.x - dir * 1.5, 4, 96);
        taker.y = sp.y;
        const canShootDirect = distToGoal < 36;
        if (canShootDirect) {
          const isCurlerFk = taker.sig === 'cur' || taker.d.cur >= taker.d.pw;
          b.lastPasserId = null;
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
            ? `🎯 ${taker.shortName}${taker.sig === 'cur' ? ' [ยิงโค้ง]' : ''} ปั่นฟรีคิกโค้งข้ามกำแพง!`
            : `🎯 ${taker.shortName} ตะบันฟรีคิกเต็มข้อ!`;
          w.phaseTone = 'danger';
          triggerDramaSlow(w, 1.15, `🎯 ฟรีคิกลุ้นประตู · ${taker.shortName}`);
          SFX.kick();
          pushLog(curMin, `🎯 ${taker.id} (${attTeam.name}) วิ่งเข้ามา${isCurlerFk ? 'ปั่นฟรีคิกโค้งๆ' : 'ซัดฟรีคิก'}ข้ามกำแพง!`);
        } else {
          const boxTarget =
            attPool.filter((a) => a.pos === 'FW' || a.role === 'CB').sort((u, v) => (v.d.hd + (v.sig === 'hd' ? 12 : 0)) - (u.d.hd + (u.sig === 'hd' ? 12 : 0)))[0] ||
            attPool[1] ||
            taker;
          const destX = clamp(attRight ? 88 + Math.random() * 6 : 6 + Math.random() * 6, 6, 94);
          const destY = clamp(38 + Math.random() * 24, 30, 70);
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = destX;
          b.toY = destY;
          b.curve = (sp.y < 50 ? 1 : -1) * 7.5;
          b.maxZ = 16.5;
          b.progress = 0;
          b.duration = 0.76;
          b.flightType = 'cross';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = boxTarget.id;
          b.lastPasserId = taker.id;
          b.possessionSide = sp.side;
          w.phaseLabel = `⚠️ ${taker.shortName} เปิดบอลโด่งเข้ากรอบเขตโทษ`;
          w.phaseTone = 'setpiece';
          SFX.kick();
        }
        return;
      }

      if (sp.type === 'corner') {
        const taker =
          attPool
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => (v.d.crs + v.d.cur + (v.sig === 'crs' ? 12 : 0)) - (u.d.crs + u.d.cur + (u.sig === 'crs' ? 12 : 0)))[0] || attPool[0];
        const headerTarget =
          attPool
            .filter((a) => a.id !== taker?.id && a.pos !== 'GK')
            .sort((u, v) => (v.d.hd + v.d.str + (v.sig === 'hd' ? 14 : 0)) - (u.d.hd + u.d.str + (u.sig === 'hd' ? 14 : 0)))[0] || attPool[1];
        if (taker && headerTarget) {
          taker.x = sp.x;
          taker.y = sp.y;
          const destX = attRight ? 89.5 + Math.random() * 4.2 : 6.3 + Math.random() * 4.2;
          const destY = 42 + Math.random() * 16;
          headerTarget.tx = destX;
          headerTarget.ty = destY;
          headerTarget.intent = 'PASS_TARGET';
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = destX;
          b.toY = destY;
          b.curve = (sp.y < 50 ? 1 : -1) * (taker.sig === 'cur' || taker.sig === 'crs' ? 9.5 : 7.5);
          b.maxZ = 16;
          b.progress = 0;
          b.duration = 0.78;
          b.flightType = 'corner';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = headerTarget.id;
          b.lastPasserId = taker.id;
          b.possessionSide = sp.side;
          w.phaseLabel = `🚩 ${taker.shortName}${taker.sig === 'crs' ? ' [เปิดบอลแม่น]' : ''} โยนเตะมุมโค้งเข้ากลาง!`;
          w.phaseTone = 'setpiece';
          SFX.kick();
        }
        return;
      }

      if (sp.type === 'penalty') {
        const taker =
          attPool
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => (v.d.fin + (v.d.comp || 60) + (v.sig === 'comp' || v.sig === 'fin' ? 10 : 0)) - (u.d.fin + (u.d.comp || 60) + (u.sig === 'comp' || u.sig === 'fin' ? 10 : 0)))[0] || attPool[0];
        if (!taker) return;
        const spotX = attRight ? 88.5 : 11.5;
        const isPanenka = (taker.sig === 'comp' || (taker.d.comp || 60) >= 74) && Math.random() < 0.18;
        taker.x = spotX - dir * 1.8;
        taker.y = 50;
        b.lastPasserId = null;
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
        SFX.kick();
        pushLog(curMin, `🎯 ${taker.id} (${attTeam.name}) รับหน้าที่สังหารจุดโทษ${isPanenka ? ' — วางเท้าเหนือชั้น!' : '!'}`);
        return;
      }
    }

    // 2. Open Play Decision from Carrier
    let side = b.possessionSide;
    let attPool = getTeamPool(side);
    const defSide = side === 'H' ? 'A' : 'H';
    let defPool = getTeamPool(defSide);
    let carrier = (b.carrierId ? attPool.find((a) => a.id === b.carrierId) : null) || attPool.find((a) => a.pos !== 'GK') || attPool[0];
    if (!carrier) return;

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

    const inBoxNow = (attRight ? carrier.x >= 83.5 : carrier.x <= 16.5) && Math.abs(carrier.y - 50) <= 21.5;
    const onBoxEdgeNow = !inBoxNow && (attRight ? carrier.x >= 80.5 : carrier.x <= 19.5) && Math.abs(carrier.y - 50) <= 23;

    // Clean Goalkeeper Distribution based on team Passing Style (Short build-up vs Long counter/target)
    if (carrier.pos === 'GK') {
      const preferLongGk = attCfg.pass >= 2 || (carrier.sig === 'dist' && Math.random() < 0.65) || nearestDefDist < 9;
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
        b.progress = 0;
        b.duration = useLofted ? clamp(distGk / 42, 0.56, 0.82) : clamp(distGk / 52, 0.32, 0.54);
        b.flightType = useLofted ? 'lofted' : 'pass';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = target.id;
        b.lastPasserId = carrier.id;
        w.phaseLabel = useLofted ? `🧤 ${carrier.shortName} เตะสาดยาวขึ้นหน้าให้ ${target.shortName}` : `🧤 ${carrier.shortName} จ่ายสั้นต่อบอลจากแดนหลัง`;
        w.phaseTone = 'normal';
        if (useLofted) SFX.kick();
        else SFX.pass();
        return;
      }
    }

    // 2a. Signature Skill Move / Flair Dribble to beat the presser! (Avoids risky dribbles inside own 18y box)
    const carrierNormXEarly = attRight ? carrier.x : 100 - carrier.x;
    const dribbleSkill =
      carrier.d.spd * 0.42 +
      carrier.d.run * 0.34 +
      carrier.d.cur * 0.24 +
      (carrier.sig === 'spd' || carrier.sig === 'cur' || carrier.sig === 'str' || carrier.sig === 'run' ? 8 : 0);
    if (nearestDef && nearestDefDist < 9.5 && carrier.pos !== 'GK' && carrierNormXEarly > 24) {
      const tempoDribMod = attCfg.tempo === 2 ? -0.04 : attCfg.tempo === 0 ? 0.03 : 0;
      const skillProb = clamp(
        0.18 +
          (dribbleSkill - (nearestDef.d.rd * 0.5 + nearestDef.d.pos * 0.5)) * 0.0045 +
          (inBoxNow ? 0.08 : 0) +
          (carrier.sig === 'spd' || carrier.sig === 'cur' ? 0.07 : 0) +
          tempoDribMod,
        0.10,
        0.46
      );
      if (Math.random() < skillProb) {
        const rollSk = Math.random();
        let skType: NonNullable<LivePitchAgent['acrobatType']> = 'spin';
        let skillLabel = `🌀 ${carrier.shortName} หมุนตัว 360°`;
        let fxColor = '#c084fc';
        let advDist = 6.8;

        if (carrier.sig === 'spd' || (carrier.d.spd >= 70 && rollSk < 0.34)) {
          skType = 'burst';
          skillLabel = `⚡ ${carrier.shortName} กระชากหนี!`;
          fxColor = '#38bdf8';
          advDist = 10.2;
        } else if (carrier.sig === 'str' || (carrier.d.str >= 70 && rollSk < 0.28)) {
          skType = 'shield';
          skillLabel = `💪 ${carrier.shortName} บังบอลพลิกหนี`;
          fxColor = '#facc15';
          advDist = 6.2;
        } else if (rollSk < 0.62) {
          skType = 'stepover';
          skillLabel = nearestDefDist < 5.5 && Math.random() < 0.4 ? `🔥 ${carrier.shortName} ลอดขาเอลาสติโก้!` : `🪄 ${carrier.shortName} สับขาหลอก!`;
          fxColor = '#f472b6';
          advDist = 7.8;
        }

        carrier.acrobatType = skType;
        carrier.acrobatMax = 0.78;
        carrier.acrobatTimer = 0.78;
        carrier.skillSpinDir = Math.random() < 0.5 ? 1 : -1;
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
        b.duration = skType === 'burst' ? 0.42 : 0.48;
        b.flightType = 'carry';
        b.shotStyle = undefined;
        b.carrierId = carrier.id;
        b.targetId = null;
        addWorldFx(w, {
          type: 'skill',
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
        w.phaseLabel = `${skillLabel}${carrier.sig === 'spd' || carrier.sig === 'str' || carrier.sig === 'cur' ? ` [จุดเด่น: ${SIGL[carrier.sig]}]` : ''}`;
        w.phaseTone = 'attack';
        if (inBoxNow || carrier.isMe || Math.random() < 0.36) {
          pushLog(curMin, `🪄 โชว์ทักษะ! ${skillLabel} (${attTeam.name}) ฉีกหนี ${nearestDef.shortName} ได้สำเร็จ!`);
        }
        return;
      }
    }

    if (nearestDef && nearestDefDist < (defCfg.press === 2 ? 9.0 : inBoxNow ? 8.2 : 6.8) && carrier.pos !== 'GK') {
      const foulProb = clamp(
        0.075 +
          (defCfg.press === 2 ? 0.04 : 0) +
          (nearestDef.tr === 1 ? 0.045 : 0) +
          (isDerby ? 0.025 : 0) +
          (inBoxNow ? 0.065 : 0) -
          ((nearestDef.sig === 'pos' ? nearestDef.d.pos + 8 : nearestDef.d.pos) - 60) * 0.001,
        0.045,
        0.26
      );
      if (Math.random() < foulProb && curMin >= 2) {
        // FOUL + FREE KICK OR PENALTY (+ VAR Check & In-Match Injury Check)!
        if (defSide === 'H') w.foulsH++;
        else w.foulsA++;
        SFX.foul();
        nearestDef.acrobatType = 'slide';
        nearestDef.acrobatMax = 0.65;
        nearestDef.acrobatTimer = 0.65;
        tryTriggerInMatchInjury(w, carrier, curMin, 'foul');

        const shouldVarPen = (inBoxNow && Math.random() < 0.38) || (onBoxEdgeNow && Math.random() < 0.36);
        const isHardFoul = nearestDef.tr === 1 || distToGoal < 30 || Math.random() < 0.25;
        const shouldVarFoulCard = !shouldVarPen && w.varChecks < 2 && isHardFoul && Math.random() < 0.24;

        if (shouldVarPen && w.varChecks < 2) {
          w.varChecks++;
          const spotX = attRight ? 88.5 : 11.5;
          const overturn = inBoxNow ? Math.random() < 0.22 : Math.random() < 0.45;
          const willAwardPen = !overturn;
          w.varReview = {
            kind: 'penalty',
            side,
            waitSec: 3.4,
            totalSec: 3.4,
            x: willAwardPen ? spotX : carrier.x,
            y: willAwardPen ? 50 : carrier.y,
            culpritId: nearestDef.id,
            culpritShort: nearestDef.shortName,
            culpritSide: defSide,
            overturn: !willAwardPen,
            distToGoal,
            reasonText: `เช็กจุดโทษ & ใบเหลือง/แดงของ ${nearestDef.shortName}`
          };
          addWorldFx(w, {
            type: 'var',
            x: carrier.x,
            y: carrier.y,
            label: '📺 VAR เช็กจุดโทษ!',
            color: '#38bdf8',
            ttl: 3.4,
            maxTtl: 3.4
          });
          triggerDramaSlow(w, 3.4, '📺 VAR เช็กจุดโทษ');
          b.carrierId = null;
          b.targetId = null;
          b.progress = 1;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.phaseLabel = `📺 VAR กำลังเช็กจังหวะฟาวล์ในเขตโทษ!`;
          w.phaseTone = 'setpiece';
          pushLog(curMin, `📺 ผู้ตัดสินขอเช็ก VAR จังหวะ ${nearestDef.id} (${defTeam.name}) สกัดใส่ ${carrier.id} ในกรอบเขตโทษ!`, 'sys');
          return;
        }

        if (shouldVarFoulCard) {
          w.varChecks++;
          const upgradeRed = Math.random() < (nearestDef.tr === 1 ? 0.48 : 0.36);
          w.varReview = {
            kind: 'foul_card',
            side,
            waitSec: 3.3,
            totalSec: 3.3,
            x: carrier.x,
            y: carrier.y,
            culpritId: nearestDef.id,
            culpritShort: nearestDef.shortName,
            culpritSide: defSide,
            overturn: upgradeRed,
            pendingCardUpgrade: upgradeRed ? 'R' : 'Y',
            distToGoal,
            reasonText: `เช็กจังหวะฟาวล์รุนแรงของ ${nearestDef.shortName} (ลุ้นใบแดง)`
          };
          addWorldFx(w, {
            type: 'var',
            x: carrier.x,
            y: carrier.y,
            label: '📺 VAR เช็กฟาวล์/ใบแดง!',
            color: '#f59e0b',
            ttl: 3.3,
            maxTtl: 3.3
          });
          triggerDramaSlow(w, 3.3, '📺 VAR เช็กใบแดง');
          b.carrierId = null;
          b.targetId = null;
          b.progress = 1;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.phaseLabel = `📺 VAR กำลังเช็กจังหวะฟาวล์รุนแรงของ ${nearestDef.shortName}!`;
          w.phaseTone = 'danger';
          pushLog(curMin, `📺 ผู้ตัดสินเดินไปดูจอ VAR เช็กจังหวะฟาวล์อันตรายของ ${nearestDef.id} (${defTeam.name})!`, 'sys');
          return;
        }

        const cardChance = clamp(0.18 + (nearestDef.tr === 1 ? 0.16 : 0) + (distToGoal < 30 ? 0.12 : 0) + (isDerby ? 0.06 : 0), 0.14, 0.5);
        let cardLbl = '⚠️ ฟาวล์!';
        let cardCol = '#f59e0b';
        let cardRes: 'Y' | 'R' | null = null;
        if (Math.random() < cardChance && simRef.current.cards.length < 7) {
          const r = issueCard(nearestDef, curMin);
          cardRes = r === 'Y' ? 'Y' : 'R';
          cardLbl = r === 'Y' ? `🟨 ใบเหลือง ${nearestDef.shortName}` : `🟥 ใบแดง ${nearestDef.shortName}!`;
          cardCol = r === 'Y' ? '#facc15' : '#ef4444';
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
          pushLog(curMin, `🚨 จุดโทษ!! ${nearestDef.id} ทำฟาวล์ใส่ ${carrier.id} ในกรอบเขตโทษ · ${attTeam.name} ได้จุดโทษ!`, 'card');
          return;
        }

        if (side === 'H') w.freeKicksH++;
        else w.freeKicksA++;
        if (!cardRes) {
          pushLog(curMin, `⚠️ ${nearestDef.id} (${defTeam.name}) ทำฟาวล์ใส่ ${carrier.id} · ${attTeam.name} ได้ฟรีคิก`);
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
        return;
      }

      // Defensive Duel Variety: Slide Tackle ("สไลด์"), Shoulder Clash ("เข้าประทะ"), or Clean Interception ("เข้าสกัด")
      const carrierDribble = carrier.d.spd * 0.55 + carrier.d.run * 0.45 + (carrier.sig === 'str' || carrier.sig === 'spd' ? 6 : 0);
      const defTackleEdge = (nearestDef.sig === 'mrk' || nearestDef.sig === 'pos' ? 8 : 0) + (nearestDef.d.rd + nearestDef.d.pos);
      const tackleProb = clamp(
        0.18 + (defTackleEdge - carrierDribble - 60) * 0.002 + (defCfg.press === 2 ? 0.05 : -0.02),
        0.10,
        0.38
      );
      if (Math.random() < tackleProb) {
        const duelRoll = Math.random();
        const isSlideTackle = duelRoll < (defCfg.press === 2 ? 0.42 : 0.30);
        const isPhysicalClash = !isSlideTackle && duelRoll < 0.68;

        if (isPhysicalClash) {
          const carPhys = carrier.d.str + (carrier.sig === 'str' ? 12 : 0) + (carrier.fit < 55 ? -8 : 0);
          const defPhys = nearestDef.d.str + nearestDef.d.pos * 0.35 + (nearestDef.sig === 'str' || nearestDef.sig === 'mrk' ? 10 : 0);
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
            // Attacker wins the shoulder clash and keeps going!
            w.phaseLabel = `💪 ${carrier.shortName} แข็งแกร่งเบียดชนะ ${nearestDef.shortName}!`;
            w.phaseTone = 'attack';
            tryTriggerInMatchInjury(w, nearestDef, curMin, 'clash');
          } else {
            // Defender wins the clash cleanly!
            tryTriggerInMatchInjury(w, carrier, curMin, 'clash');
            b.possessionSide = defSide;
            b.carrierId = nearestDef.id;
            b.lastPasserId = null;
            b.targetId = null;
            b.x = nearestDef.x;
            b.y = nearestDef.y;
            b.flightType = 'carry';
            b.shotStyle = undefined;
            w.phaseLabel = `💥 ${nearestDef.shortName} เข้าปะทะเบียดแย่งบอลสำเร็จ!`;
            w.phaseTone = 'normal';
            SFX.foul();
            if (Math.random() < 0.35) {
              pushLog(curMin, `💥 จังหวะปะทะหนัก! ${nearestDef.id} เบียดชนะ ${carrier.id} ตัดบอลคืนให้ ${defTeam.name}`);
            }
            return;
          }
        } else {
          // Clean Sliding Tackle OR Standing Tackle/Interception
          const startX = nearestDef.x;
          const startY = nearestDef.y;
          nearestDef.x = clamp((nearestDef.x + carrier.x) * 0.52, 4, 96);
          nearestDef.y = clamp((nearestDef.y + carrier.y) * 0.52, 5, 95);
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
            tryTriggerInMatchInjury(w, carrier, curMin, 'slide');
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
            ? `⚡ ${nearestDef.shortName} พุ่งสไลด์กวาดบอลสะอาด!`
            : `🛡️ ${nearestDef.shortName}${nearestDef.sig === 'rd' || nearestDef.sig === 'mrk' ? ` [${SIGL[nearestDef.sig]}]` : ''} เข้าสกัดแย่งบอลสำเร็จ!`;
          w.phaseTone = 'normal';
          SFX.pass();
          if (isSlideTackle && Math.random() < 0.48) {
            pushLog(curMin, `⚡ สไลด์สุดคม! ${nearestDef.id} (${defTeam.name}) กวาดบอลจากเท้า ${carrier.id} ได้อย่างแม่นยำ`);
          }
          side = defSide;
          attPool = getTeamPool(side);
          defPool = getTeamPool(side === 'H' ? 'A' : 'H');
          carrier = nearestDef;
          const newlyWonCfg = getEffectiveTeamCfg(side, curMin);
          if ((newlyWonCfg.pass === 3 || carrier.sig === 'dist' || (newlyWonCfg.tempo === 2 && (newlyWonCfg.tac === 'D' || newlyWonCfg.tac === 'Z'))) && Math.random() < (newlyWonCfg.pass === 3 ? 0.84 : 0.65)) {
            const counterTarget = attPool.find((a) => a.pos === 'FW') || attPool.find((a) => a.role === 'CAM');
            if (counterTarget) {
              const offChk = checkPassOffside(w, side, carrier, counterTarget, defPool);
              if (offChk.isOffside) {
                triggerOffsideCall(w, curMin, side, carrier, counterTarget, offChk.oppLineX, 'lofted', 'ยืนล้ำแนวรับจังหวะสวนกลับ');
                return;
              }
              const cAttRight = isAttackRight(w, side);
              const cDir = cAttRight ? 1 : -1;
              const cDist = Math.hypot(counterTarget.x - carrier.x, counterTarget.y - carrier.y);
              b.fromX = carrier.x;
              b.fromY = carrier.y;
              b.toX = clamp(counterTarget.x + cDir * 6, 8, 92);
              b.toY = counterTarget.y;
              b.curve = (Math.random() - 0.5) * 4.5;
              b.maxZ = cDist > 22 ? 15 : 8;
              b.progress = 0;
              b.duration = cDist > 22 ? 0.64 : 0.48;
              b.flightType = cDist > 22 ? 'lofted' : 'through';
              b.shotStyle = undefined;
              b.carrierId = null;
              b.targetId = counterTarget.id;
              b.lastPasserId = carrier.id;
              w.phaseLabel = cDist > 22 ? `🚀 ${carrier.shortName} เปิดบอลโด่งสวนกลับเร็ว!` : `⚡ ${defTeam.name} สวนกลับเร็ว!`;
              w.phaseTone = 'attack';
              SFX.kick();
              return;
            }
          }
        }
      }
    }

    // 3. Should Carrier Shoot? (Tactics-driven: X/A shoots more eagerly; D/Z waits for clear chance)
    const tacShootRange = attCfg.tac === 'X' ? 36 : attCfg.tac === 'A' ? 32 : attCfg.tac === 'Z' ? 24 : 27;
    const tacShootBias = attCfg.tac === 'X' ? 0.08 : attCfg.tac === 'A' ? 0.04 : attCfg.tac === 'Z' ? -0.08 : attCfg.tac === 'D' ? -0.04 : 0;
    const inShootZone = distToGoal < tacShootRange || (distToGoal < 35 && (carrier.d.pw > 68 || carrier.sig === 'pw'));
    const shootChance = inShootZone
      ? clamp(0.27 + tacShootBias + (33 - distToGoal) * 0.025 + (carrier.pos === 'FW' ? 0.14 : 0) + (carrier.sig === 'fin' || carrier.sig === 'pw' || carrier.sig === 'cur' ? 0.08 : 0), 0.20, 0.78)
      : 0;
    if (carrier.pos !== 'GK' && Math.random() < shootChance) {
      let shotStyle: LiveBallState['shotStyle'] = 'normal';
      let shotLabel = `🔥 ${carrier.shortName} ซัดเต็มข้อ!`;
      let curveAmt = (carrier.d.cur > 65 ? 1 : 0.4) * (carrier.y < 50 ? 1 : -1) * (3 + Math.random() * 4);
      let maxZAmt = 6 + Math.random() * 3.5;
      let durAmt = clamp(distToGoal / 36, 0.54, 0.82);

      if (inBoxNow && (carrier.sig === 'fin' || carrier.d.fin >= 67) && Math.random() < 0.16) {
        shotStyle = 'bicycle';
        carrier.acrobatType = 'bicycle';
        carrier.acrobatMax = 0.85;
        carrier.acrobatTimer = 0.85;
        curveAmt = (Math.random() - 0.5) * 4;
        maxZAmt = 6.8;
        durAmt = 0.56;
        shotLabel = `🤸 ${carrier.shortName} ตีลังกายิงกลางอากาศ!!`;
      } else if (distToGoal < 14.5 && (carrier.sig === 'fin' || carrier.sig === 'comp' || carrier.d.fin >= 68) && Math.random() < 0.24) {
        shotStyle = 'chip';
        curveAmt = 0;
        maxZAmt = 10.5;
        durAmt = 0.76;
        shotLabel = `🪶 ${carrier.shortName} ชิพข้ามหัวอย่างเหนือชั้น!`;
      } else if (distToGoal >= 19 && (carrier.sig === 'pw' || carrier.d.pw >= 67) && Math.random() < 0.34) {
        shotStyle = 'knuckle';
        curveAmt = (Math.random() - 0.5) * 3.2;
        maxZAmt = 6.2;
        durAmt = 0.58;
        shotLabel = `🌪️ ${carrier.shortName} กดลูกส่ายคนัคเคิลบอล!`;
      } else if ((carrier.sig === 'cur' || carrier.d.cur >= 66) && Math.random() < 0.36) {
        shotStyle = 'trivela';
        curveAmt = (carrier.y < 50 ? -1 : 1) * (6.8 + Math.random() * 4.5);
        maxZAmt = 7.4;
        durAmt = 0.62;
        shotLabel = `🍌 ${carrier.shortName} ดีดไซด์ก้อยโค้งหักศอก!`;
      } else if (carrier.sig === 'cur' || (carrier.d.cur >= carrier.d.pw && Math.random() < 0.58)) {
        shotStyle = 'curler';
        curveAmt = (carrier.y < 50 ? 1 : -1) * (7.2 + Math.random() * 5.2);
        maxZAmt = 7.5;
        shotLabel = `🌀 ${carrier.shortName}${carrier.sig === 'cur' ? ' [ยิงโค้ง]' : ''} ปั่นโค้งๆ เสียบเสา!`;
      } else if (distToGoal >= 21 && (carrier.sig === 'pw' || carrier.d.pw >= 68)) {
        shotStyle = 'screamer';
        curveAmt = (Math.random() - 0.5) * 2.2;
        maxZAmt = 4.6;
        durAmt = 0.50;
        shotLabel = `💥 ${carrier.shortName}${carrier.sig === 'pw' ? ' [พลังยิง]' : ''} ตะบันไกลพุ่งเป็นจรวด!`;
      } else if (inBoxNow && Math.random() < 0.28) {
        shotStyle = 'volley';
        carrier.acrobatType = 'volley';
        carrier.acrobatMax = 0.65;
        carrier.acrobatTimer = 0.65;
        maxZAmt = 4.2;
        durAmt = 0.50;
        shotLabel = `⚡ ${carrier.shortName} ฮาล์ฟวอลเลย์กลางอากาศ!`;
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
      triggerDramaSlow(w, shotStyle === 'bicycle' || shotStyle === 'curler' || shotStyle === 'trivela' ? 1.45 : 1.15, shotLabel);
      SFX.kick();
      if (shotStyle === 'bicycle' || shotStyle === 'knuckle' || shotStyle === 'trivela') {
        pushLog(curMin, `🔥 ${shotLabel} (${attTeam.name})`);
      }
      return;
    }

    // 4. Wing Cross (Boosted by Wide width & Long Ball; reduced in Narrow/Tiki-Taka)
    const inWingZone = (carrier.y < 24 || carrier.y > 76) && (attRight ? carrier.x > 62 : carrier.x < 38);
    const crossProb = clamp(
      0.58 +
        (carrier.sig === 'crs' ? 0.14 : 0) +
        (attCfg.wid === 2 ? 0.15 : attCfg.wid === 0 ? -0.22 : 0) +
        (attCfg.pass === 2 ? 0.12 : attCfg.pass === 0 ? -0.14 : 0),
      0.24,
      0.86
    );
    if (inWingZone && Math.random() < crossProb) {
      const boxRunners = attPool
        .filter((a) => a.id !== carrier.id && (a.pos === 'FW' || a.role === 'CAM' || a.role === 'CM'))
        .sort((u, v) => (attRight ? v.x - u.x : u.x - v.x) + (v.d.hd + v.d.run + (v.sig === 'hd' ? 10 : 0)) * 0.15);
      const target = boxRunners[0];
      if (target) {
        const offChk = checkPassOffside(w, side, carrier, target, defPool);
        if (offChk.isOffside) {
          triggerOffsideCall(w, curMin, side, carrier, target, offChk.oppLineX, 'cross', 'ยืนล้ำหน้าจังหวะเปิดบอลเข้ากรอบ');
          return;
        }
        const boxX = clamp(attRight ? 87 + Math.random() * 6.2 : 6.8 + Math.random() * 6.2, 6, 94);
        const boxY = clamp(40 + Math.random() * 20, 34, 66);
        target.tx = boxX;
        target.ty = boxY;
        target.intent = 'PASS_TARGET';
        b.fromX = carrier.x;
        b.fromY = carrier.y;
        b.toX = boxX;
        b.toY = boxY;
        b.curve = (carrier.y < 50 ? 1 : -1) * (carrier.sig === 'crs' || carrier.sig === 'cur' ? 8.8 : 7.5);
        b.maxZ = 16.5;
        b.progress = 0;
        b.duration = 0.68;
        b.flightType = 'cross';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = target.id;
        b.lastPasserId = carrier.id;
        w.phaseLabel = `🪽 ${carrier.shortName}${carrier.sig === 'crs' ? ' [เปิดบอล]' : ''} เปิดบอลโด่งเข้ากรอบ!`;
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
        0.20 + (attCfg.pass === 0 ? 0.16 : attCfg.pass === 2 ? -0.10 : 0) + (attCfg.wid === 0 ? 0.08 : 0) + (attCfg.tempo === 2 ? 0.06 : 0),
        0.08,
        0.44
      );
      if (partner && Math.random() < oneTwoProb) {
        const runDestX = clamp(carrier.x + dir * (10 + Math.random() * 5), 6, 94);
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
        b.progress = 0;
        b.duration = attCfg.tempo === 2 ? 0.28 : 0.34;
        b.flightType = 'onetwo';
        b.shotStyle = undefined;
        b.carrierId = null;
        b.targetId = partner.id;
        b.lastPasserId = carrier.id;
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
      .filter((a) => a.id !== carrier.id && (a.role === 'ST' || a.role === 'CF' || a.role === 'LW' || a.role === 'RW' || a.intent === 'MAKE_RUN' || a.intent === 'OVERLAP'))
      .filter((a) => (attRight ? a.x > carrier.x - 4 : a.x < carrier.x + 4));

    const throughWeight = clamp(
      (attCfg.pass === 3 ? 0.45 : attCfg.pass === 2 ? 0.34 : attCfg.pass === 1 ? 0.28 : 0.20) +
        (attCfg.tempo === 2 ? 0.08 : attCfg.tempo === 0 ? -0.05 : 0) +
        (attCfg.tac === 'X' || attCfg.tac === 'A' ? 0.05 : 0),
      0.14,
      0.56
    );
    if (forwardRunners.length && (attRight ? carrier.x > 34 : carrier.x < 66) && Math.random() < throughWeight) {
      const runner =
        forwardRunners.sort((u, v) => (v.d.run + v.d.spd + (v.sig === 'run' ? 12 : 0)) - (u.d.run + u.d.spd + (u.sig === 'run' ? 12 : 0)))[0] || P(forwardRunners);
      const offChk = checkPassOffside(w, side, carrier, runner, defPool);
      const trapEdge = defCfg.line === 2 ? 0.18 : defCfg.line === 1 ? 0.1 : 0.04;
      const trapChance = clamp(trapEdge - ((runner.sig === 'run' ? runner.d.run + 8 : runner.d.run) - 60) * 0.003, 0.02, 0.2);

      if (offChk.isOffside) {
        triggerOffsideCall(w, curMin, side, carrier, runner, offChk.oppLineX, 'through', 'ยืนล้ำแนวรับจังหวะแทงทะลุช่อง');
        return;
      }
      if ((attRight ? offChk.oppLineX > 50.5 : offChk.oppLineX < 49.5) && (attRight ? runner.x > carrier.x + 0.35 : runner.x < carrier.x - 0.35) && Math.random() < trapChance) {
        runner.x = clamp(offChk.oppLineX + dir * 1.1, 6, 94);
        triggerOffsideCall(w, curMin, side, carrier, runner, offChk.oppLineX, 'through', 'วิ่งออกตัวเร็วเกินจังหวะ');
        return;
      }

      const leadX = clamp(runner.x + dir * (9 + Math.random() * 6), 7, 93);
      const leadY = clamp(runner.y + (50 - runner.y) * 0.25, 10, 90);
      runner.tx = leadX;
      runner.ty = leadY;
      runner.intent = 'PASS_TARGET';
      const isLoftedThrough = Math.hypot(leadX - carrier.x, leadY - carrier.y) > 25 && (attCfg.pass >= 2 || carrier.sig === 'dist' || Math.random() < 0.42);
      b.fromX = carrier.x;
      b.fromY = carrier.y;
      b.toX = leadX;
      b.toY = leadY;
      b.curve = (Math.random() - 0.5) * 4.5;
      b.maxZ = isLoftedThrough ? 14.5 : 3.5;
      b.progress = 0;
      b.duration = isLoftedThrough ? 0.62 : attCfg.tempo === 2 ? 0.40 : 0.48;
      b.flightType = isLoftedThrough ? 'lofted' : 'through';
      b.shotStyle = undefined;
      b.carrierId = null;
      b.targetId = runner.id;
      b.lastPasserId = carrier.id;
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
        ? `↗️ ${carrier.shortName} ตักบอลโด่งข้ามไลน์ให้ ${runner.shortName}!`
        : `👟 ${carrier.shortName} แทงทะลุช่องให้ ${runner.shortName}${runner.sig === 'run' ? ' [วิ่งหาช่อง]' : ''}!`;
      w.phaseTone = 'attack';
      SFX.pass();
      return;
    }

    // 6. Dribble forward / cut inside (Fast Tempo passes instead of carrying; Own-box clears/passes instead of dribbling!)
    const carrierNormX = attRight ? carrier.x : 100 - carrier.x;
    const baseDrib = carrierNormX < 22 ? 0.06 : carrierNormX > 87 ? 0.15 : carrier.pos === 'FW' || carrier.role === 'CAM' || carrier.role === 'CF' ? 0.31 : 0.21;
    const tempoDribAdj = attCfg.tempo === 2 ? -0.10 : attCfg.tempo === 0 ? 0.07 : 0;
    const passDribAdj = attCfg.pass === 0 ? -0.05 : 0;
    const dribbleBias = clamp(baseDrib + tempoDribAdj + passDribAdj, 0.04, 0.40);
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
      b.progress = 0;
      b.duration = attCfg.tempo === 2 ? 0.36 : attCfg.tempo === 0 ? 0.58 : 0.47;
      b.flightType = 'carry';
      b.shotStyle = undefined;
      b.carrierId = carrier.id;
      b.targetId = null;
      w.phaseLabel = carrierNormX > 82 ? `⚡ ${carrier.shortName} แหวกตัดเข้ากลางหาจังหวะ` : `⚡ ${carrier.shortName} พาบอลลุยขึ้นหน้า`;
      w.phaseTone = attRight ? (carrier.x > 65 ? 'attack' : 'normal') : carrier.x < 35 ? 'attack' : 'normal';
      return;
    }

    // 7. Ground Pass / Cutback / Flair Pass / Lofted Diagonal Switch (Guided strictly by Passing Style, Width, Tempo & Mentality)
    const passCandidates = attPool.filter((a) => a.id !== carrier.id && (a.pos !== 'GK' || (attRight ? carrier.x < 32 : carrier.x > 68)));
    if (passCandidates.length) {
      const nearByline = carrierNormX >= 83;
      const scored = passCandidates.map((cand) => {
        const dist = Math.hypot(cand.x - carrier.x, cand.y - carrier.y);
        const prog = (cand.x - carrier.x) * dir;
        const candNormX = attRight ? cand.x : 100 - cand.x;
        let wgt = 10;
        if (attCfg.pass === 0) {
          // Short Passing: reward close triangles (< 22) and quick safe support
          wgt += dist < 22 ? 30 : -dist * 0.65;
          if (cand.role === 'CF' || cand.role === 'CM' || cand.role === 'CAM' || cand.role === 'CDM') wgt += 11;
        } else if (attCfg.pass === 2 || carrier.sig === 'dist') {
          // Long Ball: reward forward verticality & wide switches
          wgt += prog > 12 ? 28 : prog < 0 ? -6 : 2;
          if (Math.abs(cand.y - carrier.y) > 25) wgt += 16;
          if (cand.pos === 'FW') wgt += 12;
        } else if (attCfg.pass === 3) {
          // Counter-Attack: aggressively find forward outlets
          wgt += prog > 10 ? 32 : -12;
          if (cand.pos === 'FW' || cand.role === 'LW' || cand.role === 'RW') wgt += 14;
        } else {
          wgt += prog > 0 ? 15 : 4;
          wgt -= Math.abs(dist - 20) * 0.4;
        }

        // Width preference: Wide favors wingers/FBs on flanks; Narrow favors central spine
        const candWide = cand.y < 24 || cand.y > 76;
        if (attCfg.wid === 2 && candWide) wgt += 14;
        if (attCfg.wid === 0 && !candWide) wgt += 12;

        // Tempo preference: Slow retains safe ball; Fast looks forward
        if (attCfg.tempo === 0 && prog > -8 && prog <= 10) wgt += 10;
        if (attCfg.tempo === 2 && prog > 6) wgt += 10;

        // Smart cutback option: when carrier is deep near goal, reward pulling back to edge of box (Zone 14)
        if (nearByline && candNormX >= 72 && candNormX <= 85 && prog >= -16 && prog <= 2 && Math.abs(cand.y - 50) <= 26) {
          wgt += 24;
        }
        const blocked = defPool.some((d) => Math.hypot(d.x - cand.x, d.y - cand.y) < 4.5);
        if (blocked) wgt -= 12;
        if (checkPassOffside(w, side, carrier, cand, defPool).isOffside) wgt *= 0.22;
        return { cand, wgt: Math.max(1, wgt) };
      });
      const pool = scored.flatMap((s) => Array(Math.round(s.wgt)).fill(s.cand));
      const receiver = P(pool) || passCandidates[0];
      const dist = Math.hypot(receiver.x - carrier.x, receiver.y - carrier.y);
      const isLofted =
        (attCfg.pass !== 0 && dist > 26) ||
        ((attCfg.pass === 2 || carrier.sig === 'dist' || carrier.sig === 'crs') && dist > 20 && Math.random() < (attCfg.pass === 2 ? 0.78 : 0.62));
      const passOffChk = checkPassOffside(w, side, carrier, receiver, defPool);
      if (passOffChk.isOffside) {
        triggerOffsideCall(w, curMin, side, carrier, receiver, passOffChk.oppLineX, isLofted ? 'lofted' : 'pass', 'ยืนอยู่ในตำแหน่งล้ำหน้าตอนเพื่อนส่งบอล');
        return;
      }
      const isFlairPass = !isLofted && carrierNormX > 26 && dist < 18 && carrier.pos !== 'GK' && (carrier.d.cur >= 66 || carrier.sig === 'cur') && Math.random() < 0.14;
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
      b.curve = isLofted ? (Math.random() - 0.5) * 6 : dist > 22 ? (Math.random() - 0.5) * 3.5 : 0;
      b.maxZ = isLofted ? clamp(13.5 + dist * 0.14, 14, 19.5) : 0;
      b.progress = 0;
      b.duration = isLofted ? clamp(dist / 44, 0.54, 0.82) : clamp(dist / (attCfg.tempo === 2 ? 78 : attCfg.tempo === 0 ? 48 : 58), 0.26, 0.60);
      b.flightType = isLofted ? 'lofted' : 'pass';
      b.shotStyle = undefined;
      b.carrierId = null;
      b.targetId = receiver.id;
      b.lastPasserId = carrier.id;
      w.phaseLabel = isLofted
        ? `↗️ ${carrier.shortName}${carrier.sig === 'dist' ? ' [จ่ายแนวหลัง]' : ''} เปิดบอลโด่งเปลี่ยนแกนให้ ${receiver.shortName}`
        : isFlairPass
          ? `✨ ${carrier.shortName} ตอกส้น/ไขว้หลังสุดพริ้วให้ ${receiver.shortName}`
          : `⚽ ${carrier.shortName} เคาะบอลให้ ${receiver.shortName}`;
      w.phaseTone = isLofted || isFlairPass ? 'attack' : 'normal';
      if (isLofted) SFX.kick();
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
    goalY: number
  ) => {
    const sr = simRef.current;
    const defSide = side === 'H' ? 'A' : 'H';
    const attTeam = side === 'H' ? homeOrig : awayOrig;
    if (side === 'H') {
      sr.gh++;
      setGh(sr.gh);
    } else {
      sr.ga++;
      setGa(sr.ga);
    }
    if (goalX > 50) w.goalNetRippleRight = 1.0;
    else w.goalNetRippleLeft = 1.0;
    const newEv: MatchEvent = { m: curMin, t: attTeam.id, who: scorerName, as: assisterName };
    sr.evs.push(newEv);
    setEvs(sr.evs.slice());

    adjustLiveForm(scorerName, 0.95);
    if (assisterName) adjustLiveForm(assisterName, 0.55);
    const concLu = defSide === 'H' ? sr.homeLu : sr.awayLu;
    const concTeam = defSide === 'H' ? homeOrig : awayOrig;
    concLu.forEach((dn) => {
      if (sr.sentOff.includes(dn)) return;
      const dPl = concTeam.sq.find((q) => q.n === dn);
      if (dPl?.pos === 'GK') adjustLiveForm(dn, -0.22);
      else if (dPl?.pos === 'DF') adjustLiveForm(dn, -0.12);
    });

    pushLog(
      curMin,
      `⚽ ประตู!! ${scorerName} (${attTeam.name}) ${finishVerb}${assisterName ? ` · แอสซิสต์ ${assisterName}` : ''}`,
      'goal'
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
    if (lastSoundMinRef.current !== curMin) {
      lastSoundMinRef.current = curMin;
      SFX.goal();
      vibrate([50, 40, 80]);
    }
    const isMyTeamGoal = (side === 'H') === meIsHome;
    const isMeScorer = isPlayerMode && scorerName === myPlayerName;
    const scoringKit = side === 'H' ? homeKit : awayKit;
    const sparkCols = [scoringKit, '#facc15', '#ffffff', '#4ade80'];
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
      scorer: scorerShort,
      teamName: attTeam.name,
      assister: assisterName || undefined,
      side,
      kit: scoringKit,
      isMyGoal: isMyTeamGoal,
      isMeScorer,
      ttl: 4.2,
      maxTtl: 4.2
    };
    setGoalFlashSide(side);
    if (goalFlashTimerRef.current) window.clearTimeout(goalFlashTimerRef.current);
    goalFlashTimerRef.current = window.setTimeout(() => setGoalFlashSide(null), 3200);
    if (isMeScorer) {
      triggerConfetti();
    }
    w.celebrateTimer = 1.65;
    w.ball.carrierId = null;
    w.ball.targetId = null;
    w.ball.lastPasserId = null;
    triggerDramaSlow(w, 2.1, `⚽ GOAL!! ${scorerShort} (${attTeam.name})`);
    w.pendingSetPiece = { type: 'kickoff', side: defSide, x: 50, y: 50, waitSec: 3.15 };
    w.phaseLabel = `⚽ ประตู!! ${scorerName} ยิงให้ ${attTeam.name}!`;
    w.phaseTone = 'goal';
  };

  const resolveVarReview = (w: LiveMatchWorld, curMin: number) => {
    const vr = w.varReview;
    if (!vr) return;
    w.varReview = null;
    const attTeam = vr.side === 'H' ? homeOrig : awayOrig;
    const defSide = vr.side === 'H' ? 'A' : 'H';

    if (vr.kind === 'goal') {
      if (vr.overturn) {
        // Disallowed by VAR!
        SFX.foul();
        if (vr.side === 'H') w.offsidesH++;
        else w.offsidesA++;
        const offX = isAttackRight(w, vr.side) ? 84 : 16;
        addWorldFx(w, {
          type: 'offside',
          x: offX,
          y: vr.y,
          offsideX: offX,
          label: `📺❌ VAR ริบประตู!`,
          color: '#ef4444',
          ttl: 3.4,
          maxTtl: 3.4
        });
        triggerDramaSlow(w, 2.2, `📺❌ VAR ริบประตู!`);
        w.pendingSetPiece = { type: 'offside', side: defSide, x: offX, y: 50, waitSec: 2.1 };
        w.phaseLabel = `📺❌ VAR ริบประตูของ ${vr.shooterShort || attTeam.name}!`;
        w.phaseTone = 'offside';
        pushLog(curMin, `📺❌ VAR ริบประตู!! พบจังหวะล้ำหน้าก่อนยิงของ ${vr.shooterId || attTeam.name} สกอร์ยังคงเดิม`, 'card');
      } else {
        // Goal stands!
        addWorldFx(w, {
          type: 'var',
          x: 50,
          y: 22,
          label: '📺✅ VAR ยืนยันให้ประตู!',
          color: '#22c55e',
          ttl: 3.0,
          maxTtl: 3.0
        });
        pushLog(curMin, `📺✅ VAR ยืนยัน: ไม่มีการล้ำหน้า — ให้เป็นประตูของ ${attTeam.name}!`, 'goal');
        awardGoalToTeam(
          w,
          vr.side,
          curMin,
          vr.shooterId || 'นักเตะ',
          vr.shooterShort || 'นักเตะ',
          vr.assisterName || '',
          vr.finishVerb || 'ส่งบอลตุงตาข่าย!',
          vr.x,
          vr.y
        );
      }
      return;
    }

    // Foul / Red Card VAR Check
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
        SFX.whistle();
        issueCard(culprit, curMin, 1, 'R');
        addWorldFx(w, {
          type: 'foul',
          x: vr.x,
          y: vr.y,
          label: `📺🟥 VAR ใบแดง! ${vr.culpritShort || ''}`,
          color: '#ef4444',
          ttl: 3.4,
          maxTtl: 3.4,
          wallPlayers
        });
        triggerDramaSlow(w, 2.5, `📺🟥 VAR ใบแดง!! ${vr.culpritShort || ''}`);
        w.phaseLabel = `📺🟥 VAR ยกระดับเป็นใบแดง! ${vr.culpritShort || ''} โดนไล่ออก`;
        w.phaseTone = 'danger';
        pushLog(curMin, `📺🟥 VAR ยกระดับเป็นใบแดงโดยตรง!! ${culprit.id} (${defTeam.name}) เสียบสกัดอันตราย โดนไล่ออก!`, 'card');
      } else {
        SFX.foul();
        const issued = culprit ? issueCard(culprit, curMin, 0, 'Y') : 'Y';
        const isSecondRed = issued === 'Y2R' || issued === 'R';
        addWorldFx(w, {
          type: 'foul',
          x: vr.x,
          y: vr.y,
          label: isSecondRed ? `📺🟨🟥 เหลืองแดง! ${vr.culpritShort || ''}` : `📺🟨 VAR ใบเหลือง ${vr.culpritShort || ''}`,
          color: isSecondRed ? '#ef4444' : '#facc15',
          ttl: 3.0,
          maxTtl: 3.0,
          wallPlayers
        });
        triggerDramaSlow(w, isSecondRed ? 2.4 : 1.7, isSecondRed ? `📺🟨🟥 เหลืองแดง!!` : `📺🟨 VAR ใบเหลือง`);
        w.phaseLabel = isSecondRed
          ? `📺🟨🟥 VAR เหลืองที่สอง! ${vr.culpritShort || ''} โดนไล่ออก`
          : `📺🟨 VAR ให้ใบเหลือง ${vr.culpritShort || ''} · ฟรีคิก`;
        w.phaseTone = isSecondRed ? 'danger' : 'setpiece';
        pushLog(
          curMin,
          isSecondRed
            ? `📺🟨🟥 VAR ให้ใบเหลืองที่สองไล่ออก ${vr.culpritId || ''} (${defTeam.name})!`
            : `📺🟨 VAR ให้ใบเหลืองแก่ ${vr.culpritId || ''} (${defTeam.name}) รอดพ้นใบแดงหวุดหวิด`,
          'card'
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
      SFX.pass();
      if (vr.side === 'H') w.freeKicksH++;
      else w.freeKicksA++;
      const edgeX = penRightVar ? 80.5 : 19.5;
      let fkCardTxt = '';
      if (culprit && Math.random() < 0.45 && simRef.current.cards.length < 7) {
        const res = issueCard(culprit, curMin, 0, 'Y');
        fkCardTxt = res === 'Y' ? ' + 🟨 ใบเหลือง' : ' + 🟥 ใบแดง';
      }
      addWorldFx(w, {
        type: 'var',
        x: edgeX,
        y: vr.y,
        label: `📺 VAR: ฟาวล์นอกเขต${fkCardTxt}`,
        color: '#38bdf8',
        ttl: 3.0,
        maxTtl: 3.0
      });
      triggerDramaSlow(w, 1.8, `📺 VAR ฟาวล์นอกเขต${fkCardTxt}`);
      w.pendingSetPiece = { type: 'freekick', side: vr.side, x: edgeX, y: vr.y, waitSec: 1.65 };
      w.phaseLabel = `📺 VAR ชี้ฟาวล์นอกเขต${fkCardTxt} (${attTeam.name})`;
      w.phaseTone = 'setpiece';
      pushLog(curMin, `📺 VAR ยืนยัน: จุดปะทะอยู่นอกกรอบเขตโทษ — ${attTeam.name} ได้ฟรีคิก${fkCardTxt}`, fkCardTxt ? 'card' : 'sys');
    } else {
      SFX.foul();
      const spotX = penRightVar ? 88.5 : 11.5;
      let penCardTxt = '';
      if (culprit && simRef.current.cards.length < 7) {
        const roll = Math.random();
        if (roll < (culprit.tr === 1 ? 0.24 : 0.14)) {
          issueCard(culprit, curMin, 1, 'R');
          penCardTxt = ' + 🟥 ใบแดง!';
        } else if (roll < 0.68) {
          const res = issueCard(culprit, curMin, 0, 'Y');
          penCardTxt = res === 'Y' ? ' + 🟨 ใบเหลือง' : ' + 🟥 เหลืองแดง!';
        }
      }
      addWorldFx(w, {
        type: 'penalty',
        x: spotX,
        y: 50,
        label: `📺✅ VAR จุดโทษ!${penCardTxt}`,
        color: '#ef4444',
        ttl: 3.2,
        maxTtl: 3.2
      });
      triggerDramaSlow(w, 2.2, `📺🚨 VAR จุดโทษ!!${penCardTxt}`);
      w.pendingSetPiece = { type: 'penalty', side: vr.side, x: spotX, y: 50, waitSec: 2.0 };
      w.phaseLabel = `📺🚨 VAR ให้จุดโทษ${penCardTxt} (${attTeam.name})!`;
      w.phaseTone = 'danger';
      pushLog(curMin, `📺🚨 VAR ชี้จุดโทษ!! ${attTeam.name} ได้ลูกจุดโทษหลังเช็กภาพช้า${penCardTxt}!`, 'card');
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

    // 0. Resolve Parry / Woodwork / Block Bounce Deflection
    if (b.flightType === 'bounce') {
      b.shotPlan = undefined;
      const bn = b.bounceNext;
      b.bounceNext = undefined;
      if (bn?.setPiece) {
        w.pendingSetPiece = bn.setPiece;
        b.carrierId = null;
        b.shotStyle = undefined;
        if (bn.phaseLabel) w.phaseLabel = bn.phaseLabel;
        if (bn.phaseTone) w.phaseTone = bn.phaseTone;
      } else if (bn?.carrierId) {
        b.possessionSide = bn.possessionSide || defSide;
        b.carrierId = bn.carrierId;
        b.flightType = 'carry';
        b.shotStyle = undefined;
        if (bn.phaseLabel) w.phaseLabel = bn.phaseLabel;
        if (bn.phaseTone) w.phaseTone = bn.phaseTone;
      } else {
        const gatherer = defPool[0] || active[0];
        if (gatherer) {
          b.possessionSide = gatherer.side;
          b.carrierId = gatherer.id;
          b.x = gatherer.x;
          b.y = gatherer.y;
        }
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
        SFX.goal();
        sh.lastMsg = `⚽ ${kicker?.shortName || sh.kickerName} ยิงเข้า! (${sh.hScore}-${sh.aScore})`;
        addWorldFx(w, { type: 'goal', x: 99, y: b.toY, label: `⚽ เข้า! ${kicker?.shortName || ''}`, color: '#22c55e', ttl: 2.2, maxTtl: 2.2 });
        triggerDramaSlow(w, 1.4, `⚽ ยิงเข้า! ${kicker?.shortName || ''}`);
      } else {
        if (sh.turn === 'H') sh.hKicks.push('M');
        else sh.aKicks.push('M');
        SFX.whistle();
        const wasSave = plan?.outcome === 'save';
        if (wasSave && gk) {
          gk.acrobatType = 'supersave';
          gk.acrobatMax = 0.85;
          gk.acrobatTimer = 0.85;
          sh.lastMsg = `🧤 ${gk.shortName} พุ่งปัดเซฟได้!! (${sh.hScore}-${sh.aScore})`;
          addWorldFx(w, { type: 'save', x: b.toX, y: b.toY, label: `🧤 เซฟ! ${gk.shortName}`, color: '#38bdf8', ttl: 2.2, maxTtl: 2.2 });
          triggerDramaSlow(w, 1.4, `🧤 ซูเปอร์เซฟ! ${gk.shortName}`);
        } else {
          sh.lastMsg = `😮 ${kicker?.shortName || sh.kickerName} ยิงหลุดกรอบ! (${sh.hScore}-${sh.aScore})`;
          addWorldFx(w, { type: 'woodwork', x: b.toX, y: b.toY, label: `😮 หลุดกรอบ!`, color: '#f59e0b', ttl: 2.2, maxTtl: 2.2 });
          triggerDramaSlow(w, 1.4, `😮 ยิงพลาดเป้า!`);
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

      if (clinchedEarly || suddenDeathWin) {
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
        SFX.pass();

        const deflectRoll = Math.random();
        const defDist = Math.hypot((attRightNow ? 100 : 0) - b.toX, 50 - b.toY);
        const deflectedGoalProb = clamp(0.28 + (24 - defDist) * 0.008, 0.18, 0.36);

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

        if (deflectRoll < deflectedGoalProb) {
          // Deflected Goal! Wrong-foots the GK cleanly!
          const goalY = swingSide < 0 ? 42.9 + Math.random() * 4.4 : 52.7 + Math.random() * 4.4;
          b.toX = attRightNow ? 101.3 : -1.3;
          b.toY = goalY;
          b.curve = swingSide * (3.2 + Math.random() * 3.8);
          b.maxZ = 3.0 + Math.random() * 4.2;
          b.duration = clamp(Math.hypot(b.toX - b.fromX, b.toY - b.fromY) / 28, 0.28, 0.56);
          b.shotPlan = { outcome: 'goal', deflectedFrom: defShort };
          if (gk) {
            const wrongY = clamp(50 - (goalY - 50) * 0.85, 42.2, 57.8);
            gk.intent = 'DIVE';
            gk.intentTimer = Math.max(b.duration + 0.25, 0.85);
            gk.diveDir = wrongY >= gk.y ? 1 : -1;
            gk.diveTargetY = wrongY;
            gk.diveProgress = 0.05;
          }
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
          b.duration = clamp(Math.hypot(b.toX - b.fromX, b.toY - b.fromY) / 26, 0.26, 0.50);
          b.shotPlan = { outcome: 'save', parryCorner: Math.random() < 0.62, deflectedFrom: defShort };
          if (gk) {
            gk.tx = gkSaveX;
            gk.ty = clamp(saveY, 42.2, 57.8);
            gk.intent = 'DIVE';
            gk.intentTimer = Math.max(b.duration + 0.30, 0.88);
            gk.diveDir = saveY >= gk.y ? 1 : -1;
            gk.diveTargetY = clamp(saveY, 42.2, 57.8);
            gk.diveProgress = 0.02;
          }
        } else if (deflectRoll < deflectedGoalProb + 0.37) {
          // Deflected onto the woodwork!
          const postSide = Math.random() < 0.5 ? -1 : 1;
          const hitBar = Math.random() < 0.42;
          b.toX = attRightNow ? 99.8 : 0.2;
          b.toY = hitBar ? 44 + Math.random() * 12 : postSide < 0 ? 42.0 : 58.0;
          b.curve = swingSide * 2.5;
          b.maxZ = hitBar ? 6.4 : 4.0;
          b.duration = clamp(Math.hypot(b.toX - b.fromX, b.toY - b.fromY) / 28, 0.26, 0.52);
          b.shotPlan = { outcome: 'woodwork', deflectedFrom: defShort };
        } else {
          // Deflected wide past goal -> Corner Kick!
          b.toX = attRightNow ? 101.0 : -1.0;
          b.toY = swingSide < 0 ? 31.5 + Math.random() * 8.0 : 60.5 + Math.random() * 8.0;
          b.curve = swingSide * (3.5 + Math.random() * 3.5);
          b.maxZ = 4.2 + Math.random() * 3.8;
          b.duration = clamp(Math.hypot(b.toX - b.fromX, b.toY - b.fromY) / 28, 0.28, 0.54);
          b.shotPlan = { outcome: 'miss', deflectedFrom: defShort };
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
            b.flightType = 'carry';
            b.shotStyle = undefined;
            w.phaseLabel = `🛡️ ${nearDef.shortName} บล็อกและเก็บบอลได้`;
            w.phaseTone = 'normal';
          }
          return;
        }
      }

      // Shot registered!
      const shotXg =
        b.flightType === 'penalty'
          ? 0.78
          : clamp(0.05 + (32 - dist) * 0.011 + ((shooter?.d.fin || 60) - 60) * 0.002 + (b.shotStyle === 'bicycle' || b.shotStyle === 'volley' || b.shotStyle === 'diving_header' ? 0.04 : 0), 0.04, 0.45);
      if (side === 'H') {
        w.shotsH++;
        w.xgH = Math.round((w.xgH + shotXg) * 100) / 100;
      } else {
        w.shotsA++;
        w.xgA = Math.round((w.xgA + shotXg) * 100) / 100;
      }

      // Woodwork or Off-target resolution
      if (plan?.outcome === 'woodwork' || plan?.outcome === 'miss') {
        adjustLiveForm(shooter?.id, -0.12);
        const hitWoodwork = plan.outcome === 'woodwork';
        if (hitWoodwork) {
          addWorldFx(w, {
            type: 'woodwork',
            x: b.toX,
            y: b.toY,
            label: plan.deflectedFrom ? `🧱 แฉลบชนเสา/คาน!` : '🧱 ชนเสา/คาน!',
            color: '#f59e0b',
            ttl: 2.6,
            maxTtl: 2.6
          });
          triggerDramaSlow(w, 1.5, `🧱 ${plan.deflectedFrom ? 'แฉลบ' : ''}ชนเสา/คาน! · ${shooter?.shortName || ''}`);
          pushLog(
            curMin,
            plan.deflectedFrom
              ? `🧱 โอ้โห! ลูกยิงของ ${shooter?.id || 'กองหน้า'} แฉลบ ${plan.deflectedFrom} พุ่งชนเสา/คานอย่างจัง!`
              : `🧱 โอ้โห! ${shooter?.id || 'กองหน้า'} (${attTeam.name}) ซัดบอลพุ่งชนเสา/คานอย่างจัง!`
          );
          b.fromX = b.toX;
          b.fromY = b.toY;
          b.toX = attRightNow ? 91 + Math.random() * 5 : 4 + Math.random() * 5;
          b.toY = b.toY < 50 ? 31 + Math.random() * 5 : 64 + Math.random() * 5;
          b.curve = 0;
          b.maxZ = 5.4;
          b.progress = 0;
          b.duration = 0.40;
          b.flightType = 'bounce';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = null;
          b.bounceNext = {
            setPiece: {
              type: 'goalkick',
              side: defSide,
              x: defRightNow ? 5.5 : 94.5,
              y: 50,
              waitSec: 1.1
            },
            phaseLabel: `🧱 ชนเสา/คานอย่างจัง! ตั้งเตะจากประตู`,
            phaseTone: 'danger'
          };
          w.phaseLabel = `🧱 ชนเสา/คานอย่างจัง!`;
          w.phaseTone = 'danger';
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
          b.shotStyle = undefined;
          w.phaseLabel = `🚩 บอลแฉลบ ${plan.deflectedFrom} ออกหลัง · ได้เตะมุม!`;
          w.phaseTone = 'setpiece';
          return;
        }
        if (b.flightType === 'penalty' || Math.random() < 0.45) {
          pushLog(curMin, `😮 ${shooter?.id || 'กองหน้า'} (${attTeam.name}) ยิงหลุดกรอบออกหลังไปอย่างน่าเสียดาย`);
        }
        w.pendingSetPiece = {
          type: 'goalkick',
          side: defSide,
          x: defRightNow ? 5.5 : 94.5,
          y: 50,
          waitSec: b.flightType === 'penalty' ? 1.3 : 0.75
        };
        b.shotStyle = undefined;
        w.phaseLabel = `😮 ยิงหลุดกรอบ · ตั้งเตะจากประตู`;
        w.phaseTone = 'normal';
        return;
      }

      // On target!
      if (side === 'H') w.onTargetH++;
      else w.onTargetA++;

      let isGoal = plan?.outcome === 'goal';
      if (!plan) {
        const hR = rate(getLiveHomeTeam(), state, kind !== 'league' || isDerby, curMin, sr.subs.map((s) => s.inPlayer), sr.sentOff);
        const aR = rate(getLiveAwayTeam(), state, kind !== 'league' || isDerby, curMin, sr.subs.map((s) => s.inPlayer), sr.sentOff);
        const edge = side === 'H' ? hR.at - aR.df : aR.at - hR.df;
        const gkSaveScore = gk ? (gk.d.sv + (gk.sig === 'sv' ? 9 : 0)) * 0.56 + (gk.d.cl + (gk.sig === 'cl' ? 8 : 0)) * 0.44 : 58;
        const shooterScore = shooter
          ? (shooter.d.fin + (shooter.sig === 'fin' ? 8 : 0)) * 0.5 +
            (shooter.d.cur + (shooter.sig === 'cur' ? 8 : 0)) * 0.25 +
            (shooter.d.pw + (shooter.sig === 'pw' ? 8 : 0)) * 0.25
          : 60;
        const goalProb =
          b.flightType === 'penalty'
            ? clamp(0.79 + (shooterScore - gkSaveScore) * 0.004, 0.65, 0.9)
            : clamp(0.27 + edge * 0.0065 + (shooterScore - gkSaveScore) * 0.004 + (b.flightType === 'freekick' ? 0.03 : 0), 0.14, 0.54);
        isGoal = Math.random() < goalProb;
      }

      if (isGoal) {
        const scorerName = shooter?.id || attPool[0]?.id || 'นักเตะ';
        const scorerShort = shooter?.shortName || scorerName;
        const assisterName =
          b.flightType !== 'penalty' && b.lastPasserId && b.lastPasserId !== scorerName && Math.random() < 0.85 ? b.lastPasserId : '';
        const finishVerb =
          plan?.deflectedFrom
            ? `ยิงแฉลบ ${plan.deflectedFrom} เปลี่ยนทางเข้าประตู!!`
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

        // Tight-call VAR Goal Check (~15% chance on open-play goals)
        if (b.flightType === 'shot' && w.varChecks < 2 && Math.random() < 0.15) {
          w.varChecks++;
          const overturn = Math.random() < 0.34;
          w.varReview = {
            kind: 'goal',
            side,
            waitSec: 3.5,
            totalSec: 3.5,
            shooterId: scorerName,
            shooterShort: scorerShort,
            assisterName,
            finishVerb,
            x: b.toX,
            y: b.toY,
            overturn,
            reasonText: `กำลังตีเส้นเช็กจังหวะล้ำหน้าของ ${scorerShort}`
          };
          addWorldFx(w, {
            type: 'var',
            x: b.toX,
            y: b.toY,
            label: '📺 VAR เช็กประตู!',
            color: '#38bdf8',
            ttl: 3.5,
            maxTtl: 3.5
          });
          triggerDramaSlow(w, 3.5, `📺 VAR เช็กประตู · ${scorerShort}`);
          b.shotStyle = undefined;
          w.phaseLabel = `📺 VAR กำลังตรวจสอบประตูของ ${attTeam.name}!`;
          w.phaseTone = 'setpiece';
          pushLog(curMin, `📺 บอลตุงตาข่ายแล้ว แต่ VAR เรียกเช็กจังหวะล้ำหน้าของ ${scorerName}!`, 'sys');
          return;
        }

        b.shotStyle = undefined;
        awardGoalToTeam(w, side, curMin, scorerName, scorerShort, assisterName, finishVerb, b.toX, b.toY);
      } else {
        // ACCURATE & SYNCHRONIZED SUPER SAVE RIGHT AT GK'S POSITION!
        if (defSide === 'H') w.savesH++;
        else w.savesA++;
        adjustLiveForm(gk?.id, 0.26);
        adjustLiveForm(shooter?.id, -0.06);
        if (gk) {
          gk.x = b.toX;
          gk.y = clamp(b.toY, 42.2, 57.8);
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
          label: `🧤 ซูเปอร์เซฟ! ${gk?.shortName || 'ผู้รักษาประตู'}${gk?.sig === 'sv' ? ' [เซฟเด่น]' : ''}`,
          color: '#38bdf8',
          ttl: 2.5,
          maxTtl: 2.5
        });
        triggerDramaSlow(w, b.flightType === 'penalty' ? 2.0 : 1.5, `🧤 ซูเปอร์เซฟ! · ${gk?.shortName || 'ผู้รักษาประตู'}`);
        if (b.flightType === 'penalty' || Math.random() < 0.68) {
          pushLog(
            curMin,
            b.flightType === 'penalty'
              ? `🧤 ซูเปอร์เซฟ!! ${gk?.id || 'ผู้รักษาประตู'} (${defTeam.name}) อ่านทางพุ่งปัดจุดโทษของ ${shooter?.id || 'คู่แข่ง'} ไว้ได้!`
              : `🧤 ${gk?.id || 'ผู้รักษาประตู'} (${defTeam.name}) ${saveTypeText} จากลูกยิงของ ${shooter?.id || 'คู่แข่ง'}`
          );
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
          w.phaseLabel = `🧤 ${gk?.shortName || 'ผู้รักษาประตู'} ปัดปลายมือออกหลัง!`;
          w.phaseTone = 'danger';
        } else {
          b.shotStyle = undefined;
          b.possessionSide = defSide;
          b.carrierId = gk?.id || null;
          b.x = gk?.x ?? b.toX;
          b.y = gk?.y ?? b.toY;
          b.flightType = 'carry';
          w.phaseLabel = `🧤 ${gk?.shortName || 'ผู้รักษาประตู'} ${saveTypeText}`;
          w.phaseTone = 'normal';
        }
      }
      return;
    }

    // 2. Resolve Cross or Corner Delivery in the Box (Header / Diving Header / Volley / Bicycle Kick / Clearing Header!)
    if (b.flightType === 'cross' || b.flightType === 'corner') {
      const target = active.find((a) => a.id === b.targetId) || attPool.find((a) => a.pos === 'FW') || attPool[0];
      const topDef = defPool
        .filter((d) => d.pos === 'DF' || d.pos === 'GK')
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];
      const attRightNow = isAttackRight(w, side);
      const goalTargetX = attRightNow ? 100 : 0;

      const attAir = target ? (target.d.hd + (target.sig === 'hd' ? 14 : 0)) * 0.68 + target.d.run * 0.32 : 58;
      const defAir = topDef
        ? topDef.pos === 'GK'
          ? (topDef.d.cl + (topDef.sig === 'cl' ? 10 : 0)) * 0.7 + topDef.d.sv * 0.3
          : (topDef.d.hd + (topDef.sig === 'hd' ? 10 : 0)) * 0.6 + topDef.d.pos * 0.4
        : 60;
      const winHeaderProb = clamp(0.48 + (attAir - defAir) * 0.007, 0.26, 0.76);

      if (target && Math.random() < winHeaderProb) {
        // Align jumper smoothly onto impact zone and face goal
        if (Math.hypot(target.x - b.toX, target.y - b.toY) < 9) {
          target.x = b.toX * 0.65 + target.x * 0.35;
          target.y = b.toY * 0.65 + target.y * 0.35;
        }
        target.facing = Math.atan2(50 - target.y, goalTargetX - target.x);

        const acroRoll = Math.random();
        const hdPriority = target.sig === 'hd' || target.d.hd >= 68;
        const isBicycle = acroRoll < (hdPriority ? 0.08 : target.sig === 'fin' || target.d.fin >= 70 ? 0.14 : 0.09);
        const isVolley = !isBicycle && acroRoll < (hdPriority ? 0.24 : 0.34);
        const isDivingHeader = !isBicycle && !isVolley && (target.sig === 'hd' || target.d.hd >= 64) && Math.random() < 0.26;
        const chosenStyle: LiveBallState['shotStyle'] = isBicycle
          ? 'bicycle'
          : isVolley
            ? 'volley'
            : isDivingHeader
              ? 'diving_header'
              : 'header';

        prepareShotFlight(w, curMin, {
          flightType: 'shot',
          side,
          fromX: b.toX,
          fromY: b.toY,
          shooter: target,
          shotStyle: chosenStyle,
          curveAmt: isVolley || isBicycle ? (Math.random() - 0.5) * 4.5 : (Math.random() - 0.5) * 1.4,
          maxZAmt: isBicycle ? 6.4 : isVolley ? 4.2 : isDivingHeader ? 2.6 : 4.5,
          durAmt: isDivingHeader ? 0.40 : isVolley ? 0.44 : 0.48
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
          w.phaseLabel = `🗣️ ${target.shortName}${target.sig === 'hd' ? ' [โหม่งเด่น]' : ''} เทกตัวโหม่งเต็มๆ!`;
          triggerDramaSlow(w, 1.05, `🗣️ โหม่งลุ้นประตู · ${target.shortName}`);
        }
        w.phaseTone = 'danger';
        SFX.kick();
      } else if (topDef) {
        if (Math.hypot(topDef.x - b.toX, topDef.y - b.toY) < 9) {
          topDef.x = b.toX * 0.55 + topDef.x * 0.45;
          topDef.y = b.toY * 0.55 + topDef.y * 0.45;
        }
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
            SFX.kick();
          } else {
            b.possessionSide = defSide;
            b.carrierId = topDef.id;
            b.lastPasserId = null;
            b.targetId = null;
            b.x = topDef.x;
            b.y = topDef.y;
            b.flightType = 'carry';
            b.shotStyle = undefined;
            w.phaseLabel = `🧤 ${topDef.shortName} ออกมาคว้าบอลกลางอากาศไว้ได้`;
            w.phaseTone = 'normal';
          }
        } else {
          // Defender wins aerial duel and heads ball clear!
          topDef.acrobatType = 'header';
          topDef.acrobatMax = 0.64;
          topDef.acrobatTimer = 0.64;
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
            phaseLabel: `🗣️ ${topDef.shortName} โหม่งสกัดบอลพ้นอันตราย!`,
            phaseTone: 'normal'
          };
          w.phaseLabel = `🗣️ ${topDef.shortName} เทกตัวโหม่งสกัดบอลทิ้ง!`;
          w.phaseTone = 'normal';
          SFX.pass();
        }
      }
      return;
    }

    // 3. Resolve Ground Pass / Lofted Ball / Through-Ball / Give-and-Go (1-2) / Carry
    if (b.flightType === 'pass' || b.flightType === 'through' || b.flightType === 'lofted' || b.flightType === 'goalkick' || b.flightType === 'onetwo') {
      if (side === 'H') w.passesH++;
      else w.passesA++;
      const receiver = active.find((a) => a.id === b.targetId);
      const nearestOpp = defPool
        .filter((d) => d.pos !== 'GK')
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];

      const oppDist = nearestOpp ? Math.hypot(nearestOpp.x - b.toX, nearestOpp.y - b.toY) : 99;
      const isAerialBall = b.flightType === 'lofted' || b.flightType === 'goalkick';

      // Aerial header duel on long lofted balls & goalkicks!
      if (isAerialBall && receiver && nearestOpp && oppDist < 7.5 && Math.random() < 0.55) {
        const attAir = (receiver.d.hd + (receiver.sig === 'hd' ? 12 : 0)) * 0.65 + receiver.d.run * 0.35;
        const defAir = (nearestOpp.d.hd + (nearestOpp.sig === 'hd' ? 12 : 0)) * 0.65 + nearestOpp.d.pos * 0.35;
        const winProb = clamp(0.5 + (attAir - defAir) * 0.008, 0.25, 0.78);
        const attRightNow = isAttackRight(w, side);
        const dir = attRightNow ? 1 : -1;

        if (Math.random() < winProb) {
          receiver.acrobatType = 'header';
          receiver.acrobatMax = 0.58;
          receiver.acrobatTimer = 0.58;
          receiver.facing = Math.atan2(0, dir);
          // Flick-on header to a forward partner ahead if in attacking half!
          const partner = attPool.find(
            (a) => a.id !== receiver.id && a.pos !== 'GK' && (attRightNow ? a.x > receiver.x + 4 : a.x < receiver.x - 4) && Math.hypot(a.x - receiver.x, a.y - receiver.y) < 24
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
            w.phaseLabel = `🗣️ ${receiver.shortName} โหม่งเช็ดตั้งให้ ${partner.shortName}!`;
            w.phaseTone = 'attack';
            SFX.pass();
            return;
          }
          b.carrierId = receiver.id;
          b.targetId = null;
          b.x = receiver.x;
          b.y = receiver.y;
          b.flightType = 'carry';
          b.shotStyle = undefined;
          w.phaseLabel = `🗣️ ${receiver.shortName} เทกตัวโหม่งคุมจังหวะได้`;
          w.phaseTone = 'normal';
          SFX.pass();
          return;
        } else {
          nearestOpp.acrobatType = 'header';
          nearestOpp.acrobatMax = 0.58;
          nearestOpp.acrobatTimer = 0.58;
          nearestOpp.facing = Math.atan2(0, -dir);
          adjustLiveForm(nearestOpp.id, 0.14);
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
            phaseLabel: `🗣️ ${nearestOpp.shortName} เทกตัวโหม่งแย่งได้!`,
            phaseTone: 'normal'
          };
          w.phaseLabel = `🗣️ ${nearestOpp.shortName} โหม่งสกัดบอลโด่ง!`;
          w.phaseTone = 'normal';
          SFX.pass();
          return;
        }
      }

      const interceptProb =
        oppDist < 6.8
          ? clamp(
              0.16 +
                (((nearestOpp?.sig === 'rd' ? (nearestOpp?.d.rd || 60) + 10 : nearestOpp?.d.rd || 60) - 60) * 0.004) +
                (b.flightType === 'through' ? 0.14 : b.flightType === 'lofted' ? -0.05 : b.flightType === 'onetwo' ? -0.04 : 0),
              0.07,
              0.45
            )
          : 0;
      if (nearestOpp && Math.random() < interceptProb) {
        b.possessionSide = defSide;
        b.carrierId = nearestOpp.id;
        adjustLiveForm(nearestOpp.id, 0.14);
        adjustLiveForm(b.lastPasserId, -0.07);
        b.lastPasserId = null;
        b.targetId = null;
        b.x = nearestOpp.x;
        b.y = nearestOpp.y;
        b.flightType = 'carry';
        b.shotStyle = undefined;
        w.phaseLabel = `🔀 ${nearestOpp.shortName}${nearestOpp.sig === 'rd' ? ' [อ่านเกม]' : ''} อ่านทางบอลดักตัดไว้ได้!`;
        w.phaseTone = 'normal';
        SFX.pass();
        return;
      }

      if (b.flightType === 'onetwo' && receiver) {
        const passer = active.find((a) => a.id === b.lastPasserId && a.id !== receiver.id);
        if (passer) {
          const defPool = active.filter((a) => a.side === defSide);
          const offChk = checkPassOffside(w, side, receiver, passer, defPool);
          if (offChk.isOffside) {
            triggerOffsideCall(w, curMin, side, receiver, passer, offChk.oppLineX, 'through', 'วิ่งล้ำหน้าจังหวะชิ่งคืน 1-2');
            return;
          }
          const destX = clamp(passer.runToX ?? passer.tx, 6, 94);
          const destY = clamp(passer.runToY ?? passer.ty, 8, 92);
          b.fromX = receiver.x;
          b.fromY = receiver.y;
          b.toX = destX;
          b.toY = destY;
          b.curve = 0;
          b.maxZ = 0;
          b.progress = 0;
          b.duration = 0.34;
          b.flightType = 'through';
          b.shotStyle = undefined;
          b.carrierId = null;
          b.targetId = passer.id;
          b.lastPasserId = receiver.id;
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

      if (receiver) {
        b.carrierId = receiver.id;
        b.targetId = null;
        b.x = receiver.x;
        b.y = receiver.y;
        b.flightType = 'carry';
        b.shotStyle = undefined;
      }
    } else if (b.flightType === 'carry') {
      // Carry ended cleanly, keep carrier ready for next decision
      b.progress = 1;
    }
  };

  // Synchronous instant minute resolver (used when clicking "ข้ามจบเกม")
  const stepInstantMinute = (curMin: number, curTac: Mentality) => {
    const sr = simRef.current;
    const w = worldRef.current!;

    // Drain stamina & update live match form (scaled by tactical pressing & tempo)
    const hCfgMin = getEffectiveTeamCfg('H', curMin);
    const aCfgMin = getEffectiveTeamCfg('A', curMin);
    [...sr.homeLu, ...sr.awayLu].forEach((n) => {
      if (sr.sentOff.includes(n)) return;
      const isH = sr.homeLu.includes(n);
      const sideCfg = isH ? hCfgMin : aCfgMin;
      const pl = homeOrig.sq.find((q) => q.n === n) || awayOrig.sq.find((q) => q.n === n);
      if (!pl) return;
      const D = DT(pl, state.p);
      const staBonus = D.sig === 'sta' ? 0.8 : 1;
      const pressLoad = pl.pos === 'GK' ? 1 : 0.82 + (sideCfg.press + sideCfg.tempo) * 0.11 + (sideCfg.tac === 'X' ? 0.06 : sideCfg.tac === 'Z' ? -0.05 : 0);
      const drain = (0.34 - (D.d.sta - 65) * 0.0022) * staBonus * pressLoad * (pl.pos === 'GK' ? 0.25 : 1);
      sr.liveFit[n] = clamp((sr.liveFit[n] ?? 100) - Math.max(0.1, drain), 18, 100);
      const curFit = sr.liveFit[n];
      const gd = isH ? sr.gh - sr.ga : sr.ga - sr.gh;
      let formDelta = gd > 0 ? 0.01 : gd < 0 ? -0.015 : 0;
      if (curFit < 48) formDelta -= 0.055;
      else if (curFit < 58) formDelta -= 0.025;
      if (Math.random() < 0.22) formDelta += (Math.random() - 0.52) * 0.12;
      if (formDelta !== 0) adjustLiveForm(n, formDelta);
      if (curFit < 56 && pl.pos !== 'GK' && Math.random() < 0.08) {
        const ag = w.agents.find((a) => a.id === n);
        if (ag) tryTriggerInMatchInjury(w, ag, curMin, 'fatigue', true);
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
        .sort((a, b) => b.ov - a.ov);
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
      // Sync live pitch agent
      const agIdx = w.agents.findIndex((a) => a.id === outPlayer!.n);
      if (agIdx >= 0) {
        const rep = buildAgentsForTeam(sideOrig, isHomeSide ? 'H' : 'A', curLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName, w.secondHalf);
        if (rep[idx]) {
          rep[idx].x = w.agents[agIdx].x;
          rep[idx].y = w.agents[agIdx].y;
          w.agents[agIdx] = rep[idx];
        }
      }
      const isMeIn = isPlayerMode && inPlayer.n === myPlayerName;
      const isMeOut = isPlayerMode && outPlayer.n === myPlayerName;
      pushLog(curMin, `🔄 เปลี่ยนตัว (${sideOrig.name}): 🟢 ${inPlayer.n}${isMeIn ? ' (คุณ!)' : ''} เข้าแทน 🔴 ${outPlayer.n}${isMeOut ? ' (คุณ)' : ''}`, 'sub');
    };

    runAiSubForSide(true);
    runAiSubForSide(false);

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
            setLiveTac(rule.tac);
            pushLog(curMin, `⚙️ แผนอัตโนมัติทำงาน: ปรับแท็กติกเป็น "${AR_T[rule.tac]}"`, 'sys');
          }
        }
      });
    }

    // Fast-forward 4 tactical plays for this minute inside world
    w.pendingSetPiece = null;
    for (let k = 0; k < 4; k++) {
      updateAgentTargets(w, curMin);
      w.agents.forEach((a) => {
        if (!a.sentOff) {
          a.x = a.x * 0.4 + a.tx * 0.6;
          a.y = a.y * 0.4 + a.ty * 0.6;
        }
      });
      scheduleNextPlay(w, curMin);
      if (w.varReview) resolveVarReview(w, curMin);
      w.ball.x = w.ball.toX;
      w.ball.y = w.ball.toY;
      w.ball.progress = 1;
      resolveSegmentArrival(w, curMin);
      let chainGuard = 0;
      while ((w.ball.flightType === 'bounce' || (w.ball.flightType === 'shot' && w.ball.progress === 0)) && chainGuard < 3) {
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

    const hCfgMin = getEffectiveTeamCfg('H', curMin);
    const aCfgMin = getEffectiveTeamCfg('A', curMin);
    [...sr.homeLu, ...sr.awayLu].forEach((n) => {
      if (sr.sentOff.includes(n)) return;
      const isH = sr.homeLu.includes(n);
      const sideCfg = isH ? hCfgMin : aCfgMin;
      const pl = homeOrig.sq.find((q) => q.n === n) || awayOrig.sq.find((q) => q.n === n);
      if (!pl) return;
      const D = DT(pl, state.p);
      const staBonus = D.sig === 'sta' ? 0.8 : 1;
      const pressLoad = pl.pos === 'GK' ? 1 : 0.82 + (sideCfg.press + sideCfg.tempo) * 0.11 + (sideCfg.tac === 'X' ? 0.06 : sideCfg.tac === 'Z' ? -0.05 : 0);
      const drain = (0.34 - (D.d.sta - 65) * 0.0022) * staBonus * pressLoad * (pl.pos === 'GK' ? 0.25 : 1);
      sr.liveFit[n] = clamp((sr.liveFit[n] ?? 100) - Math.max(0.1, drain), 18, 100);
      const curFit = sr.liveFit[n];
      const gd = isH ? sr.gh - sr.ga : sr.ga - sr.gh;
      let formDelta = gd > 0 ? 0.01 : gd < 0 ? -0.015 : 0;
      if (curFit < 48) formDelta -= 0.055;
      else if (curFit < 58) formDelta -= 0.025;
      if (Math.random() < 0.22) formDelta += (Math.random() - 0.52) * 0.12;
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
        .sort((a, b) => b.ov - a.ov);
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
      if (agIdx >= 0) {
        const rep = buildAgentsForTeam(sideOrig, isHomeSide ? 'H' : 'A', curLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName, w.secondHalf);
        if (rep[idx]) {
          rep[idx].x = w.agents[agIdx].x;
          rep[idx].y = w.agents[agIdx].y;
          rep[idx].facing = w.agents[agIdx].facing;
          w.agents[agIdx] = rep[idx];
        }
      }
      const isMeIn = isPlayerMode && inPlayer.n === myPlayerName;
      const isMeOut = isPlayerMode && outPlayer.n === myPlayerName;
      pushLog(curMin, `🔄 เปลี่ยนตัว (${sideOrig.name}): 🟢 ${inPlayer.n}${isMeIn ? ' (คุณ!)' : ''} เข้าแทน 🔴 ${outPlayer.n}${isMeOut ? ' (คุณ)' : ''}`, 'sub');
      setLiveLu((meIsHome ? sr.homeLu : sr.awayLu).slice());
      setLiveOppLu((meIsHome ? sr.awayLu : sr.homeLu).slice());
      setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
      setSubLog(sr.subs.slice());
    };

    runAiSubForSide(true);
    runAiSubForSide(false);

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
            pushLog(curMin, `⚙️ แผนอัตโนมัติทำงาน: ปรับแท็กติกเป็น "${AR_T[rule.tac]}"`, 'sys');
          }
        }
      });
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
          if (lowFit) reasons.push(`พลังงานเหลือ ${fVal}% (เสี่ยงบาดเจ็บ)`);
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
          pushLog(curMin, `🩺 คำเตือนร่างกาย: พลังงานคุณเหลือ ${myF}% เสี่ยงบาดเจ็บหากฝืนเร่งสปีดต่อเนื่อง`, 'sys');
        } else if (myFm <= alertCfg.formTh && !alertLoggedRef.current.has(`${myPlayerName}:pform`)) {
          alertLoggedRef.current.add(`${myPlayerName}:pform`);
          pushLog(curMin, `📉 ฟอร์มการเล่นของคุณตกลงมาที่ ${myFm.toFixed(1)} ต้องรีบเรียกจังหวะเกมกลับมา!`, 'sys');
        }
      }
    }

    setLiveFitMap({ ...sr.liveFit });
    setLiveFormMap({ ...sr.liveForm });
  };

  const syncUiStatsFromWorld = (w: LiveMatchWorld, nextMin: number) => {
    setMinute(nextMin);
    setMatchPhaseUi(w.phase);
    if (w.phase === 'stop1') {
      const sMin = Math.max(1, Math.min(w.added1, Math.ceil(w.stoppageFloat)));
      setClockLabel(`45+${sMin}'`);
      setStoppageBadge(w.added1);
    } else if (w.phase === 'halftime') {
      setClockLabel('HT');
      setStoppageBadge(0);
    } else if (w.phase === 'stop2') {
      const sMin = Math.max(1, Math.min(w.added2, Math.ceil(w.stoppageFloat)));
      setClockLabel(`90+${sMin}'`);
      setStoppageBadge(w.added2);
    } else if (w.phase === 'shootout') {
      setClockLabel('PEN');
      setStoppageBadge(0);
    } else if (w.phase === 'ft') {
      setClockLabel('FT');
      setStoppageBadge(0);
    } else {
      setClockLabel(`${nextMin}'`);
      setStoppageBadge(0);
    }
    setActionBanner({ label: w.phaseLabel, tone: w.phaseTone });
    setMatchStats({
      possH: clamp(Math.round((w.possTicksH / Math.max(1, w.possTicksTotal)) * 100), 28, 72),
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
      xgH: Math.max(0.05, Math.round(w.xgH * 100) / 100),
      xgA: Math.max(0.05, Math.round(w.xgA * 100) / 100)
    });
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
    return { winnerHome, text };
  };

  const startLiveShootout = (w: LiveMatchWorld) => {
    const active = w.agents.filter((a) => !a.sentOff);
    const firstKicker = active.filter((a) => a.side === 'H' && a.pos !== 'GK').sort((u, v) => v.d.fin - u.d.fin)[0];
    const firstGk = active.find((a) => a.side === 'A' && a.pos === 'GK');
    w.phase = 'shootout';
    w.varReview = null;
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
  };

  const handleStartSecondHalf = (talkTone?: 'attack' | 'balanced' | 'defend' | 'fit') => {
    const w = worldRef.current;
    if (!w || w.phase !== 'halftime') return;
    SFX.whistle();
    const sr = simRef.current;
    w.secondHalf = true;
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
      ag.facing = attR ? 0 : Math.PI;
    });
    if (state.mode === 'm' && talkTone) {
      if (talkTone === 'attack') {
        setLiveTac('A');
        pushLog(45, `📣 ปลุกใจพักครึ่ง: "ลุยเต็มที่! เปิดเกมบุกครึ่งหลัง"`, 'sys');
      } else if (talkTone === 'defend') {
        setLiveTac('D');
        pushLog(45, `📣 ปลุกใจพักครึ่ง: "คุมโซนให้แน่น รัดกุมครึ่งหลัง"`, 'sys');
      } else {
        pushLog(45, `📣 ปลุกใจพักครึ่ง: "รักษาฟอร์มและจังหวะการเล่นต่อไป!"`, 'sys');
      }
    } else if (state.mode === 'p' && talkTone === 'fit' && myPlayerName) {
      const meAg = w.agents.find((a) => a.id === myPlayerName);
      if (meAg) {
        meAg.fit = clamp(meAg.fit + 6, 25, 100);
        sr.liveFit[meAg.id] = meAg.fit;
      }
      pushLog(45, `💪 คุณวอร์มอัพเรียกความฟิตช่วงพักครึ่งพร้อมลุย 45 นาทีหลัง!`, 'sys');
    }
    w.phase = 'play2';
    w.stoppageFloat = 0;
    w.pendingSetPiece = { type: 'kickoff', side: 'A', x: 50, y: 50, waitSec: 0.45 };
    w.phaseLabel = `⚽ เริ่มครึ่งหลัง! (${awayOrig.name} เขี่ยบอล)`;
    w.phaseTone = 'normal';
    setHalftimeTalkUsed(false);
    setHtPickedPlayer(null);
    setPaused(false);
    setMatchPhaseUi('play2');
    setClockLabel("46'");
    setStoppageBadge(0);
    setLiveFitMap({ ...sr.liveFit });
    pushLog(46, `▶️ กรรมการเป่าเริ่มครึ่งหลัง!`, 'sys');
  };

  const finalizeMatch = (precomputedWinnerHome?: boolean, precomputedPenText?: string) => {
    const sr = simRef.current;
    if (sr.done) return;
    sr.done = true;
    setInjuryAlert(null);
    const w = worldRef.current!;

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
          if (isHomeSide) sr.homeSubsCount++;
          else sr.awaySubsCount++;
          sr.subs.push({ m: 90, t: sideOrig.id, inPlayer: subIn.n, outPlayer: injName });
        }
      });
    });

    w.phase = 'ft';
    w.varReview = null;
    w.pendingSetPiece = null;
    syncUiStatsFromWorld(w, 90);
    setDone(true);
    setMatchPhaseUi('ft');
    setClockLabel('FT');
    setStoppageBadge(0);
    SFX.whistle();
    setCrowdAudio(false);

    setLiveLu((meIsHome ? sr.homeLu : sr.awayLu).slice());
    setLiveOppLu((meIsHome ? sr.awayLu : sr.homeLu).slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    setMatchYellows({ ...sr.yellows });
    setMatchCards(sr.cards.slice());
    setSentOff(sr.sentOff.slice());
    setLiveFitMap({ ...sr.liveFit });
    setLiveFormMap({ ...sr.liveForm });

    const finalGh = sr.gh;
    const finalGa = sr.ga;
    if (kind !== 'league' && finalGh === finalGa) {
      if (precomputedWinnerHome !== undefined && precomputedPenText) {
        setPenResult({ winnerHome: precomputedWinnerHome, text: precomputedPenText });
      } else {
        const pen = computePenWinnerInstant();
        setPenResult(pen);
        pushLog(90, `🎯 ${pen.text}`, 'sys');
      }
    } else {
      pushLog(90, `🏁 จบเกม! ${homeOrig.name} ${finalGh}-${finalGa} ${awayOrig.name}`, 'sys');
    }
    setActionBanner({ label: `🏁 จบเกม ${finalGh} - ${finalGa}`, tone: 'normal' });
  };

  // High-FPS 60fps Animation + Simulation Loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let uiSyncAccum = 0;

    const frame = (now: number) => {
      const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const w = worldRef.current;
      const canvas = canvasRef.current;
      if (!w) return;

      if (!paused && !done && !simRef.current.done && w.phase !== 'halftime') {
        const speedMul = speed === 4 ? 2.45 : speed === 2 ? 1.25 : speed === 0.5 ? 0.34 : speed === 0.25 ? 0.15 : 0.65;

        // Decay FX, banners & dramatic slow-mo timers in real time for key moments
        const isSlowShot =
          w.ball.flightType === 'shot' ||
          w.ball.flightType === 'freekick' ||
          w.ball.flightType === 'penalty' ||
          w.ball.flightType === 'shootout_kick';
        const slowActive = cineSlowMo && (w.dramaSlowSec > 0 || isSlowShot);
        const isBigFx = (t: LivePitchFx['type']) =>
          t === 'goal' || t === 'var' || t === 'foul' || t === 'penalty' || t === 'save' || t === 'woodwork' || t === 'offside';

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
        w.celebrateTimer = Math.max(0, w.celebrateTimer - rawDt);
        w.dramaSlowSec = Math.max(0, w.dramaSlowSec - rawDt);
        if (w.dramaSlowSec <= 0 && !isSlowShot) {
          w.dramaLabel = null;
        }

        // Penalty Shootout Phase
        if (w.phase === 'shootout' && w.shootout && !w.shootout.finished) {
          const sh = w.shootout;
          updateAgentTargets(w, 90);
          w.agents.forEach((ag) => {
            if (ag.sentOff) return;
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
            sh.waitSec -= rawDt * (speedMul > 2 ? 1.15 : 1.0);
            w.ball.x = 88.5;
            w.ball.y = 50;
            w.ball.z = 0;
            if (sh.waitSec <= 0) {
              sh.activeShot = true;
              const b = w.ball;
              const kicker = w.agents.find((a) => !a.sentOff && a.id === sh.kickerName);
              const gk = w.agents.find((a) => !a.sentOff && a.side !== sh.turn && a.pos === 'GK');
              const kickScore = kicker ? kicker.d.fin * 0.5 + (kicker.d.comp || 62) * 0.5 : 64;
              const gkScore = gk ? gk.d.sv * 0.58 + gk.d.cl * 0.42 : 60;
              const scored = Math.random() < clamp(0.75 + (kickScore - gkScore) * 0.0045, 0.56, 0.88);
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
                b.shotPlan = { outcome: 'goal', shootoutScored: true };
                if (gk) {
                  const wrongWay = Math.random() < 0.45;
                  const diveY = wrongWay ? clamp(50 - (shotY - 50), 42.5, 57.5) : shotY;
                  gk.intent = 'DIVE';
                  gk.intentTimer = 0.95;
                  gk.diveDir = diveY >= gk.y ? 1 : -1;
                  gk.diveTargetY = diveY;
                  gk.diveProgress = 0.02;
                }
              } else if (Math.random() < 0.22) {
                b.toX = 101.2;
                b.toY = Math.random() < 0.5 ? 36.8 + Math.random() * 4.0 : 59.2 + Math.random() * 4.0;
                b.shotPlan = { outcome: 'miss', shootoutScored: false };
                if (gk) {
                  gk.intent = 'DIVE';
                  gk.intentTimer = 0.95;
                  gk.diveDir = b.toY >= gk.y ? 1 : -1;
                  gk.diveTargetY = clamp(b.toY, 42.0, 58.0);
                  gk.diveProgress = 0.02;
                }
              } else {
                const gkSaveX = gk ? clamp(gk.x, 95.8, 98.4) : 97.8;
                b.toX = gkSaveX;
                b.toY = shotY;
                b.shotPlan = { outcome: 'save', shootoutScored: false };
                if (gk) {
                  gk.tx = gkSaveX;
                  gk.ty = shotY;
                  gk.intent = 'DIVE';
                  gk.intentTimer = 0.95;
                  gk.diveDir = shotY >= gk.y ? 1 : -1;
                  gk.diveTargetY = shotY;
                  gk.diveProgress = 0.02;
                }
              }
              SFX.kick();
              setShootoutUi({ ...sh, hKicks: sh.hKicks.slice(), aKicks: sh.aKicks.slice() });
            }
          } else {
            const b = w.ball;
            b.progress = Math.min(1, b.progress + (rawDt * 0.58) / Math.max(0.24, b.duration));
            const t = b.progress;
            const omt = 1 - t;
            b.x = omt * omt * b.fromX + 2 * omt * t * ((b.fromX + b.toX) * 0.5) + t * t * b.toX;
            b.y = omt * omt * b.fromY + 2 * omt * t * ((b.fromY + b.toY) * 0.5 + b.curve) + t * t * b.toY;
            b.z = Math.sin(t * Math.PI) * b.maxZ;
            b.trail.push({ x: b.x, y: b.y, z: b.z });
            if (b.trail.length > 12) b.trail.shift();
            if (b.progress >= 1) {
              resolveSegmentArrival(w, 90);
            }
          }
          if (canvas) {
            drawLivePitchToCanvas(canvas, w, homeKit, awayKit, homeGkKit, awayGkKit, showRunVectors, homeTrim, awayTrim, showPositions);
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

        // Synchronized fallback GK dive during live shots if not already diving
        if (
          isSlowShot &&
          w.ball.progress >= 0.16 &&
          w.ball.progress <= 0.9 &&
          w.ball.shotPlan?.outcome !== 'block' &&
          w.ball.shotPlan?.outcome !== 'deflect'
        ) {
          const defSide: 'H' | 'A' = w.ball.possessionSide === 'H' ? 'A' : 'H';
          const defGk = w.agents.find((a) => !a.sentOff && a.side === defSide && a.pos === 'GK');
          if (defGk && defGk.intent !== 'DIVE') {
            const diveY = clamp(w.ball.toY, 41.5, 58.5);
            defGk.intent = 'DIVE';
            defGk.intentTimer = 0.88;
            defGk.diveDir = diveY >= defGk.y ? 1 : -1;
            defGk.diveTargetY = diveY;
            defGk.diveProgress = 0.02;
          }
        }

        // Smooth physical player movement + running stride + GK dive (slow-mo dampened during dramatic events)
        const isKickoffResetting = w.pendingSetPiece?.type === 'kickoff' && w.celebrateTimer <= 0;
        const baseMoveScale = speedMul > 2.0 ? 1.55 : speedMul > 1.0 ? 1.05 : speedMul < 0.22 ? 0.24 : speedMul < 0.5 ? 0.44 : 0.74;
        const moveScale = isKickoffResetting
          ? Math.max(1.9, baseMoveScale * 1.9)
          : slowActive
            ? (speedMul < 0.22 ? 0.16 : speedMul < 0.5 ? 0.22 : 0.34)
            : baseMoveScale;
        w.agents.forEach((ag) => {
          if (ag.sentOff) return;
          if (ag.acrobatTimer && ag.acrobatTimer > 0) {
            ag.acrobatTimer = Math.max(0, ag.acrobatTimer - rawDt * (slowActive ? 0.55 : speedMul < 0.25 ? 0.5 : 1));
          }
          if (ag.intent === 'DIVE' && ag.intentTimer > 0) {
            ag.intentTimer -= rawDt;
            ag.diveProgress = clamp(1 - ag.intentTimer / 0.88, 0, 1);
            if (ag.diveTargetY != null) {
              ag.y = clamp(ag.y + (ag.diveTargetY - ag.y) * Math.min(1, rawDt * 8.0), 39, 61);
              ag.ty = ag.y;
            }
            if (ag.intentTimer <= 0) {
              ag.intent = 'SUPPORT';
              ag.diveProgress = 0;
              ag.diveTargetY = undefined;
            }
          }
          const dx = ag.tx - ag.x;
          const dy = ag.ty - ag.y;
          const dist = Math.hypot(dx, dy);
          const maxSpd =
            (18 + ((ag.d.spd || 60) - 55) * 0.22) *
            (ag.intent === 'MAKE_RUN' || ag.intent === 'OVERLAP' || ag.intent === 'PRESS' || ag.intent === 'RESET' ? 1.38 : 1.0) *
            (ag.fit < 50 ? 0.82 : 1.0) *
            moveScale;
          const stepSpd = Math.min(dist * 6.5 * moveScale, maxSpd);
          if (dist > 0.15) {
            ag.vx = (dx / dist) * stepSpd;
            ag.vy = (dy / dist) * stepSpd;
            const minX = ag.pos === 'GK' ? 1.6 : 3;
            const maxX = ag.pos === 'GK' ? 98.4 : 97;
            ag.x = clamp(ag.x + ag.vx * rawDt, minX, maxX);
            ag.y = clamp(ag.y + ag.vy * rawDt, 4, 96);
            const targetAngle = Math.atan2(ag.vy, ag.vx);
            let angleDiff = targetAngle - ag.facing;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            ag.facing += angleDiff * Math.min(1, rawDt * 10);
            ag.stride += stepSpd * rawDt * 0.85;
          } else {
            ag.vx *= 0.8;
            ag.vy *= 0.8;
            const bAngle = Math.atan2(w.ball.y - ag.y, w.ball.x - ag.x);
            let angleDiff = bAngle - ag.facing;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            ag.facing += angleDiff * Math.min(1, rawDt * 6);
          }
        });

        // VAR Review countdown, Set-piece wait countdown, or Ball physics progression
        if (w.varReview) {
          w.varReview.waitSec = Math.max(0, w.varReview.waitSec - rawDt * (speedMul > 2 ? 1.1 : 1));
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
            ? speedMul > 2.0 ? 0.95 : speedMul < 0.5 ? 0.65 : 0.85
            : speedMul > 2.0 ? 1.3 : speedMul < 0.5 ? 0.65 : 0.85;
          w.pendingSetPiece.waitSec -= rawDt * spRate;
          if (spType !== 'kickoff') {
            w.pendingSetPiece.waitSec = Math.max(0, w.pendingSetPiece.waitSec);
          } else if (w.celebrateTimer <= 0) {
            const kickTeam = w.pendingSetPiece.side === 'H' ? homeOrig : awayOrig;
            w.phaseLabel = `⚽ กลับเข้าตำแหน่งเตรียมเขี่ยบอล (${kickTeam.name})`;
            w.phaseTone = 'normal';
          }
          w.ball.x = w.pendingSetPiece.x;
          w.ball.y = w.pendingSetPiece.y;
          w.ball.z = 0;
          const kickoffFormationReady =
            spType !== 'kickoff' ||
            (w.celebrateTimer <= 0 &&
              w.agents.every((ag) => ag.sentOff || Math.hypot(ag.tx - ag.x, ag.ty - ag.y) <= 2.6));
          if (w.pendingSetPiece.waitSec <= 0 && (kickoffFormationReady || (spType === 'kickoff' && w.pendingSetPiece.waitSec <= -2.5))) {
            if (spType === 'kickoff' && !kickoffFormationReady) {
              w.agents.forEach((ag) => {
                if (!ag.sentOff) {
                  ag.x = ag.tx;
                  ag.y = ag.ty;
                }
              });
            }
            w.pendingSetPiece.waitSec = 0;
            scheduleNextPlay(w, Math.max(1, curIntMin));
          }
        } else {
          const b = w.ball;
          const ballRate = slowActive
            ? speedMul < 0.22 ? 0.13 : speedMul < 0.5 ? 0.19 : 0.24
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
              b.x = clamp(car.x + Math.cos(car.facing) * 1.4, 2, 98);
              b.y = clamp(car.y + Math.sin(car.facing) * 1.4, 3, 97);
              b.z = 0;
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
            b.z = Math.sin(t * Math.PI) * b.maxZ;
          }

          b.trail.push({ x: b.x, y: b.y, z: b.z });
          if (b.trail.length > (slowActive || isSlowShot ? 18 : 9)) b.trail.shift();

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
          SFX.whistle();
          pushLog(45, `☕ พักครึ่งเวลา: ${homeOrig.name} ${simRef.current.gh}-${simRef.current.ga} ${awayOrig.name}`, 'sys');
          w.phaseLabel = `☕ พักครึ่งเวลา (${simRef.current.gh} - ${simRef.current.ga})`;
          w.phaseTone = 'normal';
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
          if (kind !== 'league' && simRef.current.gh === simRef.current.ga) {
            startLiveShootout(w);
          } else {
            finalizeMatch();
          }
        }

        uiSyncAccum += rawDt;
        if (uiSyncAccum >= 0.16) {
          uiSyncAccum = 0;
          syncUiStatsFromWorld(w, curIntMin);
        }
      }

      if (canvas) {
        drawLivePitchToCanvas(canvas, w, homeKit, awayKit, homeGkKit, awayGkKit, showRunVectors, homeTrim, awayTrim, showPositions);
      }
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, done, speed, cineSlowMo, showRunVectors, showPositions, homeKit, awayKit, homeGkKit, awayGkKit, homeTrim, awayTrim]);

  const skipToEnd = () => {
    if (done || simRef.current.done) return;
    SFX.tap();
    const w = worldRef.current!;
    w.dramaSlowSec = 0;
    w.dramaLabel = null;
    w.celebrateTimer = 0;
    w.cardBanner = null;
    if (w.varReview) {
      resolveVarReview(w, Math.max(1, Math.floor(w.minuteFloat)));
    }
    if (w.phase === 'shootout' && w.shootout && !w.shootout.finished) {
      const pen = computePenWinnerInstant();
      w.shootout = null;
      setShootoutUi(null);
      pushLog(90, `🎯 ${pen.text}`, 'sys');
      finalizeMatch(pen.winnerHome, pen.text);
      return;
    }
    const startMin = Math.floor(w.minuteFloat);
    for (let m = startMin + 1; m <= 90; m++) {
      if (m === 46) w.secondHalf = true;
      stepInstantMinute(m, liveTacticsRef.current.tac);
      if (m === 45) pushLog(45, `⏱️ จบครึ่งแรก: ${homeOrig.name} ${simRef.current.gh}-${simRef.current.ga} ${awayOrig.name}`, 'sys');
    }
    w.minuteFloat = 90;
    w.lastTickedMin = 90;
    w.dramaSlowSec = 0;
    w.dramaLabel = null;
    w.celebrateTimer = 0;
    w.cardBanner = null;
    setLiveFitMap({ ...simRef.current.liveFit });
    if (canvasRef.current) {
      drawLivePitchToCanvas(canvasRef.current, w, homeKit, awayKit, homeGkKit, awayGkKit, showRunVectors, homeTrim, awayTrim, showPositions);
    }
    finalizeMatch();
  };

  const handleSubstitute = (benchPlayer: Player) => {
    if (!subPickOut) return;
    const sr = simRef.current;
    const w = worldRef.current!;
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    const myPlayed = meIsHome ? sr.homePlayed : sr.awayPlayed;
    const mySubsCount = meIsHome ? sr.homeSubsCount : sr.awaySubsCount;
    if (mySubsCount >= 5) return;
    if (sr.sentOff.includes(subPickOut)) return;
    const idx = myLu.indexOf(subPickOut);
    if (idx < 0) return;

    SFX.tap();
    myLu[idx] = benchPlayer.n;
    if (!myPlayed.includes(benchPlayer.n)) myPlayed.push(benchPlayer.n);
    if (meIsHome) sr.homeSubsCount++;
    else sr.awaySubsCount++;
    const subEv: MatchSubEvent = { m: minute, t: meTeamOrig.id, inPlayer: benchPlayer.n, outPlayer: subPickOut };
    sr.subs.push(subEv);

    // Swap live pitch agent immediately so the sub enters right on the pitch!
    const agIdx = w.agents.findIndex((a) => a.id === subPickOut);
    if (agIdx >= 0) {
      const updated = buildAgentsForTeam(meTeamOrig, meIsHome ? 'H' : 'A', myLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName, w.secondHalf);
      if (updated[idx]) {
        updated[idx].x = w.agents[agIdx].x;
        updated[idx].y = w.agents[agIdx].y;
        updated[idx].facing = w.agents[agIdx].facing;
        w.agents[agIdx] = updated[idx];
      }
      if (w.ball.carrierId === subPickOut) w.ball.carrierId = benchPlayer.n;
      if (w.ball.targetId === subPickOut) w.ball.targetId = benchPlayer.n;
    }

    const replacedName = subPickOut;
    setLiveLu(myLu.slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    pushLog(minute, `🔄 เปลี่ยนตัว (${meTeamOrig.name}): 🟢 ${benchPlayer.n} เข้าแทน 🔴 ${replacedName}`, 'sub');
    if (injuryAlert && injuryAlert.name === replacedName) {
      setInjuryAlert(null);
    }
    setSubPickOut(null);
  };

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

    SFX.tap();
    myLu[idx] = bestSub.n;
    if (!myPlayed.includes(bestSub.n)) myPlayed.push(bestSub.n);
    if (meIsHome) sr.homeSubsCount++;
    else sr.awaySubsCount++;
    sr.subs.push({ m: minute, t: meTeamOrig.id, inPlayer: bestSub.n, outPlayer: injuryAlert.name });

    const agIdx = w.agents.findIndex((a) => a.id === injuryAlert.name);
    if (agIdx >= 0) {
      const updated = buildAgentsForTeam(meTeamOrig, meIsHome ? 'H' : 'A', myLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName, w.secondHalf);
      if (updated[idx]) {
        updated[idx].x = w.agents[agIdx].x;
        updated[idx].y = w.agents[agIdx].y;
        updated[idx].facing = w.agents[agIdx].facing;
        w.agents[agIdx] = updated[idx];
      }
      if (w.ball.carrierId === injuryAlert.name) w.ball.carrierId = bestSub.n;
      if (w.ball.targetId === injuryAlert.name) w.ball.targetId = bestSub.n;
    }

    setLiveLu(myLu.slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    pushLog(minute, `🔄 เปลี่ยนตัวด่วนแทนผู้เจ็บ (${meTeamOrig.name}): 🟢 ${bestSub.n} เข้าแทน 🩹 ${injuryAlert.name}`, 'sub');
    setInjuryAlert(null);
    setSubPickOut(null);
    setPaused(false);
  };

  const findBestSubFor = (outName: string): Player | null => {
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
  };

  const handleAutoSubstitute = (outName: string): Player | null => {
    const sr = simRef.current;
    const w = worldRef.current!;
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
    if (meIsHome) sr.homeSubsCount++;
    else sr.awaySubsCount++;
    const subEv: MatchSubEvent = { m: minute, t: meTeamOrig.id, inPlayer: bestSub.n, outPlayer: outName };
    sr.subs.push(subEv);

    const agIdx = w.agents.findIndex((a) => a.id === outName);
    if (agIdx >= 0) {
      const updated = buildAgentsForTeam(meTeamOrig, meIsHome ? 'H' : 'A', myLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName, w.secondHalf);
      if (updated[idx]) {
        updated[idx].x = w.agents[agIdx].x;
        updated[idx].y = w.agents[agIdx].y;
        updated[idx].facing = w.agents[agIdx].facing;
        w.agents[agIdx] = updated[idx];
      }
      if (w.ball.carrierId === outName) w.ball.carrierId = bestSub.n;
      if (w.ball.targetId === outName) w.ball.targetId = bestSub.n;
    }

    setLiveLu(myLu.slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    pushLog(minute, `🔄 เปลี่ยนตัวด่วน (${meTeamOrig.name}): 🟢 ${bestSub.n} เข้าแทน 🔴 ${outName}`, 'sub');
    if (injuryAlert && injuryAlert.name === outName) {
      setInjuryAlert(null);
    }
    setSubPickOut(null);
    return bestSub;
  };

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
        rc
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

  const subAlertItems = useMemo(() => {
    if (state.mode !== 'm' || done || !subAlertEnabled || subsUsed.length >= 5) return [];
    const items: {
      name: string;
      role: SubRole;
      no: number;
      fitVal: number;
      formVal: number;
      lowFit: boolean;
      lowForm: boolean;
      urgent: boolean;
      reasonSig: string;
      suggestedSub: Player | null;
    }[] = [];

    liveLu.forEach((name) => {
      if (sentOff.includes(name)) return;
      const pl = meTeamOrig.sq.find((q) => q.n === name);
      if (!pl) return;
      const fitVal = Math.round(liveFitMap[name] ?? pl.fit ?? 100);
      const formVal = Number((liveFormMap[name] ?? 6.5).toFixed(1));
      const lowFit = fitVal <= subAlertFitTh;
      const lowForm = formVal <= subAlertFormTh;
      if (!lowFit && !lowForm) return;
      const reasonSig = `${lowFit ? 'F' : ''}${lowForm ? 'R' : ''}`;
      if (dismissedAlerts[name] === reasonSig) return;
      const urgent = fitVal <= Math.max(35, subAlertFitTh - 8) || (lowFit && lowForm);
      const suggestedSub =
        benchList.find((b) => b.pos === pl.pos) ||
        (pl.pos !== 'GK' ? benchList.find((b) => b.pos !== 'GK') || null : null);
      items.push({
        name,
        role: pl.ro,
        no: getShirtNo(meTeamOrig, pl),
        fitVal,
        formVal,
        lowFit,
        lowForm,
        urgent,
        reasonSig,
        suggestedSub
      });
    });

    return items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.fitVal - b.fitVal || a.formVal - b.formVal);
  }, [
    state.mode,
    done,
    subAlertEnabled,
    subsUsed.length,
    liveLu,
    sentOff,
    meTeamOrig,
    liveFitMap,
    liveFormMap,
    subAlertFitTh,
    subAlertFormTh,
    dismissedAlerts,
    benchList
  ]);

  const compTitle =
    kind === 'asia'
      ? `🌏 บอลถ้วยทวีป · ${RN[state.ac?.r ?? 0] || 'รอบคัดเลือก'}`
      : kind === 'cup'
        ? `🏆 ถ้วยประชาชน · ${RN[state.cup.r] || `รอบ ${state.cup.r + 1}`}`
        : `⚽ ${TN[homeOrig.tier]} · นัดที่ ${state.md + 1}${isDerby ? ' 🔥 ดาร์บี้แมตช์' : ''}`;


  const mySubsList = subLog.filter((s) => s.t === meTeamOrig.id);

  const bannerCls =
    actionBanner.tone === 'goal'
      ? 'bg-emerald-500 text-white border-emerald-300/80 shadow-sm'
      : actionBanner.tone === 'danger'
        ? 'bg-rose-500/25 text-rose-200 border-rose-400/50'
        : actionBanner.tone === 'offside' || actionBanner.tone === 'setpiece'
          ? 'bg-amber-400/20 text-amber-200 border-amber-400/50'
          : actionBanner.tone === 'attack'
            ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/45'
            : 'bg-white/10 text-white border-white/20';

  const handleConfirmFinish = () => {
    if (!fullTimeAnalysis) return;
    const srDone = simRef.current;
    SFX.tap();
    onFinish({
      gh: srDone.gh,
      ga: srDone.ga,
      evs: srDone.evs,
      xgH: fullTimeAnalysis.xgH,
      xgA: fullTimeAnalysis.xgA,
      pen: penResult ? penResult.winnerHome : undefined,
      penText: penResult?.text,
      ratings: fullTimeAnalysis.ratings,
      motm: fullTimeAnalysis.motm,
      pf: fullTimeAnalysis.pf,
      finalTac: liveTac,
      finalLu: liveLu,
      cards: fullTimeAnalysis.cards,
      subs: fullTimeAnalysis.subs,
      playedNames: fullTimeAnalysis.playedNames,
      injuries: srDone.injuries.slice()
    });
  };

  const renderMatchStatsPanel = () => {
    const yH = matchCards.filter((c) => c.t === homeOrig.id && c.type === 'Y').length;
    const yA = matchCards.filter((c) => c.t === awayOrig.id && c.type === 'Y').length;
    const rH = matchCards.filter((c) => c.t === homeOrig.id && (c.type === 'R' || c.type === 'Y2R')).length;
    const rA = matchCards.filter((c) => c.t === awayOrig.id && (c.type === 'R' || c.type === 'Y2R')).length;
    const statRows: { label: string; hVal: number; aVal: number; hNode: React.ReactNode; aNode: React.ReactNode }[] = [
      { label: 'ครองบอล', hVal: matchStats.possH, aVal: 100 - matchStats.possH, hNode: `${matchStats.possH}%`, aNode: `${100 - matchStats.possH}%` },
      { label: 'โอกาสยิง (เข้ากรอบ)', hVal: matchStats.shotsH, aVal: matchStats.shotsA, hNode: `${matchStats.shotsH} (${matchStats.onTargetH})`, aNode: `${matchStats.shotsA} (${matchStats.onTargetA})` },
      { label: 'ความแม่นยำประตู (xG)', hVal: matchStats.xgH, aVal: matchStats.xgA, hNode: matchStats.xgH.toFixed(2), aNode: matchStats.xgA.toFixed(2) },
      { label: 'จ่ายบอล · เตะมุม', hVal: matchStats.passesH, aVal: matchStats.passesA, hNode: `${matchStats.passesH} · 🚩${matchStats.cornersH}`, aNode: `🚩${matchStats.cornersA} · ${matchStats.passesA}` },
      {
        label: 'ฟาวล์ · ล้ำหน้า · ใบ',
        hVal: matchStats.foulsH + yH * 2 + rH * 4,
        aVal: matchStats.foulsA + yA * 2 + rA * 4,
        hNode: (
          <span className="inline-flex items-center gap-1 flex-wrap">
            <span>{matchStats.foulsH} · {matchStats.offsidesH} ·</span>
            <span className={`inline-flex items-center gap-0.5 ${yH === 0 ? 'opacity-55' : ''}`}>
              <StatIconBadge kind="yellow" count={Math.max(1, yH)} size="xs" title={`ใบเหลือง ${yH}`} />
              {yH === 0 && <span>0</span>}
            </span>
            {rH > 0 && <StatIconBadge kind="red" count={rH} size="xs" title={`ใบแดง ${rH}`} />}
          </span>
        ),
        aNode: (
          <span className="inline-flex items-center justify-end gap-1 flex-wrap">
            {rA > 0 && <StatIconBadge kind="red" count={rA} size="xs" title={`ใบแดง ${rA}`} />}
            <span className={`inline-flex items-center gap-0.5 ${yA === 0 ? 'opacity-55' : ''}`}>
              <StatIconBadge kind="yellow" count={Math.max(1, yA)} size="xs" title={`ใบเหลือง ${yA}`} />
              {yA === 0 && <span>0</span>}
            </span>
            <span>· {matchStats.offsidesA} · {matchStats.foulsA}</span>
          </span>
        )
      }
    ];
    return (
      <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold pb-1 border-b border-[var(--line)]/60">
          <span className="flex items-center gap-1.5 truncate max-w-[38%]">
            <span className="w-2.5 h-2.5 rounded-full border border-white/70 shrink-0" style={{ background: homeKit }} />
            <span className="truncate">{homeOrig.name}</span>
          </span>
          <span className="text-[10px] text-[var(--mut)] shrink-0">📊 สถิติในสนาม</span>
          <span className="flex items-center justify-end gap-1.5 truncate max-w-[38%]">
            <span className="truncate">{awayOrig.name}</span>
            <span className="w-2.5 h-2.5 rounded-full border border-white/70 shrink-0" style={{ background: awayKit }} />
          </span>
        </div>
        <div className="space-y-1.5 mland:space-y-1">
          {statRows.map((row) => {
            const tot = Math.max(0.01, row.hVal + row.aVal);
            const hPct = row.hVal === 0 && row.aVal === 0 ? 50 : clamp((row.hVal / tot) * 100, 8, 92);
            return (
              <div key={row.label} className="space-y-0.5 text-[11px] mland:text-[10px]">
                <div className="flex items-center justify-between gap-2 tabular">
                  <span className="font-bold text-[var(--ink)]">{row.hNode}</span>
                  <span className="text-[10px] text-[var(--mut)] font-semibold">{row.label}</span>
                  <span className="font-bold text-[var(--ink)] text-right">{row.aNode}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-[var(--surface)] flex">
                  <div className="h-full transition-all duration-300" style={{ width: `${hPct}%`, backgroundColor: 'var(--g)' }} />
                  <div className="h-full transition-all duration-300 bg-amber-500/80" style={{ width: `${100 - hPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLiveEnergyPanel = () => {
    if (done && fullTimeAnalysis) return null;
    const hNames = (meIsHome ? liveLu : liveOppLu).filter((n) => !sentOff.includes(n));
    const aNames = (meIsHome ? liveOppLu : liveLu).filter((n) => !sentOff.includes(n));
    const hAvg = Math.round(hNames.reduce((a, n) => a + (liveFitMap[n] ?? 100), 0) / Math.max(1, hNames.length));
    const aAvg = Math.round(aNames.reduce((a, n) => a + (liveFitMap[n] ?? 100), 0) / Math.max(1, aNames.length));
    const tiredCount = liveLu.filter((n) => !sentOff.includes(n) && (liveFitMap[n] ?? 100) <= subAlertFitTh).length;
    const lowFormCount = liveLu.filter((n) => !sentOff.includes(n) && (liveFormMap[n] ?? 6.5) <= subAlertFormTh).length;
    const fitColor = (v: number) => (v >= 70 ? 'var(--g)' : v >= subAlertFitTh ? '#f59e0b' : 'var(--red)');
    const fitTextCls = (v: number) => (v >= 70 ? 'text-[var(--g)]' : v >= subAlertFitTh ? 'text-[#c98a00] dark:text-[var(--lamp)]' : 'text-[var(--red)]');

    if (isPlayerMode && myPlayerName) {
      const myFit = Math.round(liveFitMap[myPlayerName] ?? myPlayerSquadObj?.fit ?? 100);
      const myForm = Number((liveFormMap[myPlayerName] ?? 6.5).toFixed(1));
      const onPitchNow = liveLu.includes(myPlayerName) && !sentOff.includes(myPlayerName);
      const subOutEv = subLog.find((s) => s.t === meTeamOrig.id && s.outPlayer === myPlayerName);
      const statusTxt = myInitialBanned
        ? 'ติดโทษแบน (ชมข้างสนาม)'
        : sentOff.includes(myPlayerName)
          ? 'โดนใบแดงไล่ออก'
          : onPitchNow
            ? 'กำลังลงสนาม'
            : subOutEv
              ? `ถูกเปลี่ยนออก น.${subOutEv.m}'`
              : 'รอโอกาสที่ม้านั่งสำรอง';
      const myWarnFit = onPitchNow && subAlertEnabled && myFit <= subAlertFitTh;
      const myWarnForm = onPitchNow && subAlertEnabled && myForm <= subAlertFormTh;
      return (
        <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[10px]">
            <span className="font-bold flex items-center gap-1.5">
              <span>⚡ พลังงานในสนาม</span>
              <span className="text-[var(--mut)] font-semibold">· {statusTxt}</span>
            </span>
            <span className="text-[var(--mut)] tabular">
              เฉลี่ยทีม: <b className={fitTextCls(meIsHome ? hAvg : aAvg)}>{meIsHome ? hAvg : aAvg}%</b> vs คู่แข่ง <b className={fitTextCls(meIsHome ? aAvg : hAvg)}>{meIsHome ? aAvg : hAvg}%</b>
            </span>
          </div>
          {(myWarnFit || myWarnForm) && (
            <div className="px-2.5 py-2 mland:py-1 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/50 text-[11px] mland:text-[10px] flex flex-wrap items-center justify-between gap-1.5">
              <span className="font-bold text-[var(--red)]">
                🩺 {myWarnFit ? `พลังงานต่ำ ${myFit}% เสี่ยงบาดเจ็บ!` : ''}
                {myWarnFit && myWarnForm ? ' · ' : ''}
                {myWarnForm ? `ฟอร์มตกเหลือ ${myForm.toFixed(1)}` : ''}
              </span>
              <span className="text-[10px] text-[var(--mut)]">ระวังจังหวะปะทะหนัก</span>
            </div>
          )}
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="font-bold truncate">★ {myPlayerName} ({myPlayerSquadObj?.ro || state.p?.sp})</span>
              <span className="flex items-center gap-2 shrink-0 tabular">
                <span className={`font-bold text-[11px] ${myForm <= subAlertFormTh ? 'text-[var(--red)]' : myForm >= 7.2 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                  ฟอร์ม {myForm.toFixed(1)}
                </span>
                <span className={`font-extrabold ${fitTextCls(myFit)}`}>
                  {myFit}% · {myFit >= 70 ? 'ฟิตสมบูรณ์' : myFit >= subAlertFitTh ? 'เริ่มล้า' : 'เสี่ยงเจ็บ'}
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${clamp(myFit, 0, 100)}%`, background: fitColor(myFit) }} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 mland:space-y-1.5">
        {subAlertItems.length > 0 && (
          <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--red-soft)]/80 border border-[var(--red)]/55 space-y-2 mland:space-y-1.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[10px]">
              <div className="flex items-center gap-1.5 font-extrabold text-[var(--red)]">
                <span className="animate-pulse">🩺</span>
                <span>แจ้งเตือนเปลี่ยนตัว ({subAlertItems.length} คน) · ป้องกันบาดเจ็บ &amp; ฟอร์มตก</span>
              </div>
              <span className="text-[10px] text-[var(--mut)] font-semibold">
                เกณฑ์: ฟิต ≤ {subAlertFitTh}% หรือ ฟอร์ม ≤ {subAlertFormTh.toFixed(1)}
              </span>
            </div>
            <div className="space-y-1.5 mland:space-y-1">
              {subAlertItems.slice(0, 3).map((al) => (
                <div
                  key={al.name}
                  className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--red)]/35 flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[10px]"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[10px] font-bold text-[var(--mut)]">
                        #{al.no} {al.role}
                      </span>
                      <span className="font-bold text-[var(--ink)] truncate">{al.name}</span>
                      {al.lowFit && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[var(--red-soft)] text-[var(--red)] text-[10px] font-extrabold tabular">
                          ⚡ ฟิต {al.fitVal}% (เสี่ยงเจ็บ)
                        </span>
                      )}
                      {al.lowForm && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] text-[10px] font-extrabold tabular">
                          📉 ฟอร์ม {al.formVal.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {al.suggestedSub && (
                      <div className="text-[10px] text-[var(--mut)] truncate">
                        แนะนำสำรอง: <b className="text-[var(--g)]">🟢 {al.suggestedSub.n}</b> ({al.suggestedSub.ro} · OVR {al.suggestedSub.ov} · ฟิต {Math.round(al.suggestedSub.fit ?? 100)}%)
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={benchList.length === 0 || subsUsed.length >= 5}
                      onClick={() => {
                        const rep = handleAutoSubstitute(al.name);
                        if (!rep) {
                          setSubPickOut(al.name);
                          setShowTacticsDrawer(true);
                          setMlandMatchTab('tactics');
                          setPaused(true);
                        }
                      }}
                      title={al.suggestedSub ? `เปลี่ยนตัวทันที: ส่ง ${al.suggestedSub.n} แทน` : 'เปลี่ยนตัวอัตโนมัติ'}
                      className="px-2.5 py-1 rounded-lg bg-[var(--g)] text-white text-[10px] font-bold cursor-pointer hover:brightness-105 disabled:opacity-45 whitespace-nowrap"
                    >
                      🔄 เปลี่ยนเลย
                    </button>
                    <button
                      type="button"
                      title="ปิดการเตือนนักเตะคนนี้ชั่วคราว"
                      onClick={() => setDismissedAlerts((prev) => ({ ...prev, [al.name]: al.reasonSig }))}
                      className="w-6 h-6 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10px] font-bold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {subAlertItems.length > 3 && (
                <div className="text-[10px] text-[var(--mut)] text-right font-semibold">
                  และอีก {subAlertItems.length - 3} คนในแผงพลังงานด้านล่าง
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[10px]">
            <span className="font-bold">⚡ พลังงาน &amp; ฟอร์ม 11 คนในสนาม ({meTeamOrig.name})</span>
            <div className="flex flex-wrap items-center gap-2 tabular text-[var(--mut)]">
              <span>
                เหย้า <b className={fitTextCls(hAvg)}>{hAvg}%</b> · เยือน <b className={fitTextCls(aAvg)}>{aAvg}%</b>
              </span>
              {(tiredCount > 0 || lowFormCount > 0) && (
                <span className="font-bold text-[var(--red)]">
                  · เตือน {tiredCount > 0 ? `ล้า ${tiredCount}` : ''}{tiredCount > 0 && lowFormCount > 0 ? '/' : ''}{lowFormCount > 0 ? `ฟอร์มตก ${lowFormCount}` : ''}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowAlertConfig((v) => !v)}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                  showAlertConfig || !subAlertEnabled
                    ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] text-[#8a5b00] dark:text-[var(--lamp)]'
                    : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                }`}
              >
                ⚙️ เกณฑ์เตือน
              </button>
            </div>
          </div>

          {showAlertConfig && (
            <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[var(--ink)]">🩺 ระบบแจ้งเตือนเปลี่ยนตัว (ป้องกันบาดเจ็บ/ฟอร์มตก)</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !subAlertEnabled;
                    setSubAlertEnabled(next);
                    persistSubAlertPrefs(next, subAlertFitTh, subAlertFormTh);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                    subAlertEnabled ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'
                  }`}
                >
                  {subAlertEnabled ? 'เปิดเตือน' : 'ปิดเตือน'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between gap-2 bg-[var(--surface-2)] px-2.5 py-1.5 rounded-lg">
                  <span className="text-[10px] font-semibold text-[var(--mut)]">เตือนเมื่อพลังงาน ≤</span>
                  <div className="flex items-center gap-1">
                    {[50, 55, 58, 65].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setSubAlertFitTh(v);
                          setDismissedAlerts({});
                          persistSubAlertPrefs(subAlertEnabled, v, subAlertFormTh);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular cursor-pointer ${
                          subAlertFitTh === v ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)]'
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 bg-[var(--surface-2)] px-2.5 py-1.5 rounded-lg">
                  <span className="text-[10px] font-semibold text-[var(--mut)]">เตือนเมื่อฟอร์ม ≤</span>
                  <div className="flex items-center gap-1">
                    {[5.4, 5.8, 6.0].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setSubAlertFormTh(v);
                          setDismissedAlerts({});
                          persistSubAlertPrefs(subAlertEnabled, subAlertFitTh, v);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular cursor-pointer ${
                          subAlertFormTh === v ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)]'
                        }`}
                      >
                        {v.toFixed(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 mland:grid-cols-3 gap-1.5 mland:gap-1">
            {liveLu.map((name) => {
              const pl = meTeamOrig.sq.find((q) => q.n === name);
              if (!pl) return null;
              const isRed = sentOff.includes(name);
              const fitVal = Math.round(liveFitMap[name] ?? pl.fit ?? 100);
              const formVal = Number((liveFormMap[name] ?? 6.5).toFixed(1));
              const warnFit = !isRed && subAlertEnabled && fitVal <= subAlertFitTh;
              const warnForm = !isRed && subAlertEnabled && formVal <= subAlertFormTh;
              const canSubClick = !isRed && subsUsed.length < 5 && benchList.length > 0;
              const nextSub = canSubClick ? findBestSubFor(name) : null;
              return (
                <button
                  key={name}
                  type="button"
                  disabled={!canSubClick}
                  onClick={() => {
                    handleAutoSubstitute(name);
                  }}
                  title={canSubClick ? `กดเพื่อเปลี่ยนตัวทันที${nextSub ? ` (${nextSub.n.split(' ')[0]} เข้าแทน)` : ''}` : undefined}
                  className={`p-1.5 mland:p-1 rounded-xl bg-[var(--surface)] border text-left transition-colors ${
                    isRed
                      ? 'opacity-45 border-[var(--red)]/40 cursor-not-allowed'
                      : warnFit
                        ? 'border-[var(--red)]/80 bg-[var(--red-soft)]/30 hover:bg-[var(--red-soft)]/50 cursor-pointer'
                        : warnForm
                          ? 'border-[var(--lamp)]/80 bg-[var(--lamp-soft)]/30 hover:bg-[var(--lamp-soft)]/50 cursor-pointer'
                          : 'border-[var(--line)] hover:border-[var(--g)] cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="font-bold truncate">
                      <span className="text-[var(--mut)]">{pl.ro}</span> {pl.n.split(' ')[0]}
                    </span>
                    <span className={`font-extrabold tabular shrink-0 flex items-center gap-0.5 ${isRed ? 'text-[var(--red)]' : fitTextCls(fitVal)}`}>
                      {isRed ? <StatIconBadge kind="red" size="xs" /> : `${fitVal}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${isRed ? 0 : clamp(fitVal, 0, 100)}%`, background: fitColor(fitVal) }}
                    />
                  </div>
                  {!isRed && (
                    <div className="mt-1 flex items-center justify-between gap-1 text-[9px] tabular">
                      <span className={warnForm ? 'font-extrabold text-[#b45309] dark:text-[var(--lamp)]' : formVal >= 7.2 ? 'font-bold text-[var(--g)]' : 'text-[var(--mut)]'}>
                        {warnForm ? `📉 ${formVal.toFixed(1)}` : `★ ${formVal.toFixed(1)}`}
                      </span>
                      {warnFit ? (
                        <span className="font-extrabold text-[var(--red)]">🔄 เปลี่ยน</span>
                      ) : warnForm ? (
                        <span className="font-bold text-[#b45309] dark:text-[var(--lamp)]">🔄 เปลี่ยน</span>
                      ) : canSubClick ? (
                        <span className="text-[var(--mut)] opacity-75">🔄</span>
                      ) : null}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderLiveTacticsPanel = () => (
    <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--g)]/40 space-y-3 mland:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-xs mland:text-[11px]">⚡ ปรับแผนสด &amp; เปลี่ยนตัว ({meTeamOrig.name}) · เหลือโควต้า {5 - subsUsed.length} คน</span>
        <button
          type="button"
          onClick={() => {
            setShowTacticsDrawer(false);
            setMlandMatchTab('events');
            setPaused(false);
          }}
          className="px-3 py-1 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[11px] font-bold cursor-pointer"
        >
          ใช้แผน &amp; เล่นต่อ ▶
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5 text-xs mland:text-[10px]">
        <div>
          <div className="text-[11px] mland:text-[10px] font-bold text-[var(--mut)] mb-1">สไตล์ (Mentality)</div>
          <div className="flex flex-wrap gap-1">
            {(['X', 'A', 'B', 'D', 'Z'] as Mentality[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setLiveTac(m);
                  pushLog(minute, `📣 สั่งการข้างสนาม: ปรับแผนเป็น "${AR_T[m]}"`, 'sys');
                }}
                className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg font-semibold cursor-pointer ${liveTac === m ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}
              >
                {AR_T[m]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] mland:text-[10px] font-bold text-[var(--mut)] mb-1">สไตล์จ่ายบอล</div>
          <div className="flex flex-wrap gap-1">
            {['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'].map((lbl, idx) => (
              <button
                key={lbl}
                type="button"
                onClick={() => {
                  setLivePass(idx);
                  pushLog(minute, `📣 สั่งการข้างสนาม: เน้นจ่ายแบบ "${lbl}"`, 'sys');
                }}
                className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg font-semibold cursor-pointer ${livePass === idx ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-2 gap-2 mland:gap-1.5 text-[11px] mland:text-[10px]">
        <div>
          <div className="font-bold text-[var(--mut)] mb-1">เพรสซิ่ง</div>
          <div className="flex gap-1">
            {['ต่ำ', 'กลาง', 'สูง'].map((lbl, k) => (
              <button key={lbl} type="button" onClick={() => setLivePress(k)} className={`flex-1 py-1 mland:py-0.5 rounded-md font-semibold cursor-pointer ${livePress === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-bold text-[var(--mut)] mb-1">จังหวะ</div>
          <div className="flex gap-1">
            {['ช้า', 'กลาง', 'เร็ว'].map((lbl, k) => (
              <button key={lbl} type="button" onClick={() => setLiveTempo(k)} className={`flex-1 py-1 mland:py-0.5 rounded-md font-semibold cursor-pointer ${liveTempo === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-bold text-[var(--mut)] mb-1">แนวรับ</div>
          <div className="flex gap-1">
            {['ลึก', 'กลาง', 'สูง'].map((lbl, k) => (
              <button key={lbl} type="button" onClick={() => setLiveLine(k)} className={`flex-1 py-1 mland:py-0.5 rounded-md font-semibold cursor-pointer ${liveLine === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-bold text-[var(--mut)] mb-1">ความกว้าง</div>
          <div className="flex gap-1">
            {['แคบ', 'กลาง', 'กว้าง'].map((lbl, k) => (
              <button key={lbl} type="button" onClick={() => setLiveWid(k)} className={`flex-1 py-1 mland:py-0.5 rounded-md font-semibold cursor-pointer ${liveWid === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {subsUsed.length < 5 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2.5 mland:gap-1.5">
          <div>
            <div className="text-[11px] mland:text-[10px] font-bold text-[var(--red)] mb-1">1. 🔴 เลือกนักเตะในสนามที่ต้องการ &ldquo;เปลี่ยนออก&rdquo;</div>
            <div className="max-h-36 mland:max-h-28 overflow-y-auto space-y-1 pr-0.5">
              {liveLu.map((name) => {
                const pl = meTeamOrig.sq.find((q) => q.n === name);
                if (!pl) return null;
                const isRed = sentOff.includes(name);
                const hasY = (matchYellows[name] || 0) > 0;
                const curF = Math.round(liveFitMap[name] ?? pl.fit ?? 100);
                const curForm = Number((liveFormMap[name] ?? 6.5).toFixed(1));
                const flagFit = !isRed && subAlertEnabled && curF <= subAlertFitTh;
                const flagForm = !isRed && subAlertEnabled && curForm <= subAlertFormTh;
                const activePick = subPickOut === name;
                return (
                  <div
                    key={name}
                    className={`w-full flex items-center justify-between gap-1.5 px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] ${
                      isRed
                        ? 'bg-[var(--surface)] opacity-45'
                        : activePick
                          ? 'bg-[var(--lamp)] text-[#261900] font-bold'
                          : flagFit
                            ? 'bg-[var(--red-soft)]/50 border border-[var(--red)]/50'
                            : flagForm
                              ? 'bg-[var(--lamp-soft)]/50 border border-[var(--lamp)]/50'
                              : 'bg-[var(--surface)]'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isRed}
                      onClick={() => setSubPickOut(activePick ? null : name)}
                      className="flex-1 min-w-0 flex items-center justify-between gap-1.5 text-left cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span className="truncate flex items-center gap-1">
                        <span className="text-[10px] font-bold text-[var(--mut)]">#{getShirtNo(meTeamOrig, pl)}</span>
                        <span className="font-bold">{pl.ro}</span>
                        <span className="truncate">{pl.n}</span>
                        {isRed && <StatIconBadge kind="red" size="xs" />}
                        {!isRed && hasY && <StatIconBadge kind="yellow" count={matchYellows[name] || 1} size="xs" />}
                        {flagFit && <span className="text-[9px] font-extrabold text-[var(--red)]">🩺</span>}
                        {!flagFit && flagForm && <span className="text-[9px] font-extrabold text-[#b45309] dark:text-[var(--lamp)]">📉</span>}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 tabular text-[11px] mland:text-[10px]">
                        <span className={flagForm ? 'text-[#b45309] dark:text-[var(--lamp)] font-bold' : 'text-[var(--mut)]'}>
                          ★{curForm.toFixed(1)}
                        </span>
                        <span className={curF <= subAlertFitTh ? 'text-[var(--red)] font-bold' : curF < 75 ? 'text-[#c98a00]' : 'text-[var(--g)]'}>
                          {curF}%
                        </span>
                        <span className="font-bold">{pl.ov}</span>
                      </span>
                    </button>
                    {!isRed && benchList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAutoSubstitute(name)}
                        title="เปลี่ยนตัวอัตโนมัติทันที"
                        className="px-1.5 py-0.5 rounded bg-[var(--g)] text-white text-[9.5px] font-bold cursor-pointer hover:brightness-110 shrink-0"
                      >
                        ⚡เปลี่ยน
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[11px] mland:text-[10px] font-bold text-[var(--g)] mb-1">
              2. 🟢 เลือกตัวสำรอง &ldquo;ส่งเข้าแทน&rdquo; {subPickOut ? `(${subPickOut.split(' ')[0]})` : ''}
            </div>
            <div className="max-h-36 mland:max-h-28 overflow-y-auto space-y-1 pr-0.5">
              {(() => {
                const outObj = subPickOut ? meTeamOrig.sq.find((q) => q.n === subPickOut) : null;
                return benchList.map((pl) => {
                  const fitMatch = outObj && pl.pos === outObj.pos;
                  const curF = Math.round(pl.fit ?? 100);
                  return (
                    <button
                      key={pl.n}
                      type="button"
                      disabled={!subPickOut}
                      onClick={() => handleSubstitute(pl)}
                      className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 mland:py-1 rounded-lg bg-[var(--surface)] border text-xs mland:text-[10px] cursor-pointer disabled:opacity-45 ${fitMatch ? 'border-[var(--g)]/60' : 'border-transparent hover:border-[var(--g)]'}`}
                    >
                      <span className="truncate flex items-center gap-1">
                        <span className="text-[10px] font-bold text-[var(--mut)]">#{getShirtNo(meTeamOrig, pl)}</span>
                        <span className="font-bold">{pl.ro}</span>
                        <span className="truncate">{pl.n}</span>
                        {fitMatch && <span className="text-[10px] text-[var(--g)] font-bold">ตรงตำแหน่ง</span>}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 tabular text-[11px] mland:text-[10px]">
                        <span className="text-[var(--mut)]">{curF}%</span>
                        <span className="font-bold text-[var(--g)]">{pl.ov}</span>
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs font-semibold text-[var(--mut)]">ใช้โควต้าเปลี่ยนตัวครบ 5 คนแล้ว</div>
      )}
      {mySubsList.length > 0 && (
        <div className="pt-2 mland:pt-1 border-t border-[var(--line)] flex flex-wrap gap-1.5 text-[11px] mland:text-[10px]">
          <span className="font-bold text-[var(--mut)]">เปลี่ยนตัวแล้ว:</span>
          {mySubsList.map((sb, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] tabular">
              {sb.m}&apos; 🟢{sb.inPlayer.split(' ')[0]} ↔ 🔴{sb.outPlayer.split(' ')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-3 mland:p-1 safe-all overflow-hidden">
      <div className="w-full max-w-5xl mland:max-w-[98vw] max-h-[95dvh] mland:h-[97dvh] mland:max-h-[97dvh] rounded-2xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Pinned Top Scoreboard Header */}
        <div className="shrink-0 px-3 sm:px-4 py-2 mland:px-2.5 mland:py-1 bg-[var(--surface-2)]/90 border-b border-[var(--line)]">
          <div className="flex items-center justify-between text-xs mland:text-[9.5px] text-[var(--mut)] mb-1 mland:mb-0.5 gap-2">
            <span className="font-semibold truncate">{compTitle}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {isFullscreen && onExitFullscreen && (
                <button
                  type="button"
                  onClick={onExitFullscreen}
                  className="px-2 mland:px-1.5 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] font-bold text-[10.5px] mland:text-[9px] cursor-pointer hover:border-[var(--g)]"
                >
                  ✕ ย่อจอ
                </button>
              )}
              {done && (
                <span className="px-2 mland:px-1.5 py-0.5 rounded-lg bg-[var(--g)] text-white font-bold tabular text-[11px] mland:text-[9.5px] shrink-0">
                  FT
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 mland:gap-2">
            <div className="flex items-center justify-end gap-2 mland:gap-1.5 min-w-0">
              <div className="text-right min-w-0">
                <div className={`font-bold text-xs sm:text-base mland:text-xs truncate flex items-center justify-end gap-1 ${homeId === state.me ? 'text-[var(--g)]' : ''}`}>
                  {goalFlashSide === 'H' && <span className="px-1.5 py-0.2 rounded bg-[var(--lamp)] text-[#261900] text-[10px] font-extrabold shrink-0">⚽ +1</span>}
                  <span className="truncate">{homeOrig.name}</span>
                </div>
                <div className="text-[10px] sm:text-[11px] mland:text-[9px] text-[var(--mut)] flex items-center justify-end gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full border border-white/80 shrink-0" style={{ background: homeKit }} />
                  <span>เหย้า {homeId === state.me ? '★' : ''}</span>
                </div>
              </div>
              <div className="shrink-0 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
                <ClubCrest name={homeOrig.name} size={30} team={homeOrig} club={state.club} isMyClub={homeId === state.me && state.mode === 'm'} />
              </div>
            </div>
            <div className={`px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-2xl mland:rounded-xl border text-center min-w-[74px] sm:min-w-[88px] mland:min-w-[62px] transition-all duration-300 ${goalFlashSide ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] ring-2 ring-[var(--lamp)] scale-105' : 'bg-[var(--surface)] border-[var(--line)]'}`}>
              <div className="text-xl sm:text-3xl mland:text-lg font-bold font-display tabular leading-none">{gh} - {ga}</div>
              {penResult && <div className="text-[10px] font-bold text-[var(--lamp)] mt-0.5">{penResult.text}</div>}
            </div>
            <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
              <div className="shrink-0 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
                <ClubCrest name={awayOrig.name} size={30} team={awayOrig} club={state.club} isMyClub={awayId === state.me && state.mode === 'm'} />
              </div>
              <div className="min-w-0">
                <div className={`font-bold text-xs sm:text-base mland:text-xs truncate flex items-center gap-1 ${awayId === state.me ? 'text-[var(--g)]' : ''}`}>
                  <span className="truncate">{awayOrig.name}</span>
                  {goalFlashSide === 'A' && <span className="px-1.5 py-0.2 rounded bg-[var(--lamp)] text-[#261900] text-[10px] font-extrabold shrink-0">⚽ +1</span>}
                </div>
                <div className="text-[10px] sm:text-[11px] mland:text-[9px] text-[var(--mut)] flex items-center gap-1">
                  <span>เยือน {awayId === state.me ? '★' : ''}</span>
                  <span className="inline-block w-2.5 h-2.5 rounded-full border border-white/80 shrink-0" style={{ background: awayKit }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Game Broadcast Stage */}
        <div className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden p-2.5 sm:p-3.5 mland:p-1.5 space-y-2.5 mland:space-y-0 mland:flex mland:flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] mland:grid-cols-[1.32fr_1fr] gap-3 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
            {/* Left Stage: Live 2D Pitch / Full-Time Pitch Ratings + MOTM + Match Stats */}
            <div className="space-y-2.5 mland:space-y-1.5 min-w-0 mland:h-full mland:flex mland:flex-col mland:min-h-0 mland:justify-center">
              {!(done && fullTimeAnalysis) ? (
                <div className="rounded-2xl mland:rounded-xl overflow-hidden border border-[var(--line)] bg-[#0c351f] shadow-inner mland:mx-auto mland:w-full flex flex-col">
                  {/* Live Match Event & Clock Bar Mounted Directly on Pitch */}
                  <div className="px-2.5 sm:px-3 py-1.5 mland:px-2.5 mland:py-1 bg-[#072113]/95 border-b border-white/15 flex items-center justify-between gap-2 text-white shrink-0">
                    <span className={`px-2.5 mland:px-2 py-0.5 rounded-lg border text-[11px] sm:text-xs mland:text-[10.5px] font-bold truncate min-w-0 ${bannerCls}`}>
                      {actionBanner.label}
                    </span>
                    <div className="flex items-center gap-1.5 mland:gap-1 shrink-0">
                      {stoppageBadge > 0 && (
                        <span className="px-2 mland:px-1.5 py-0.5 rounded-lg bg-[var(--lamp)] text-[#261900] font-extrabold tabular text-[11px] mland:text-[10px]">
                          +{stoppageBadge}&apos;
                        </span>
                      )}
                      <span className="px-2.5 mland:px-2 py-0.5 rounded-lg bg-[var(--g)] text-white font-extrabold tabular text-xs sm:text-sm mland:text-[11px] shadow-xs">
                        {done ? 'FT' : clockLabel}
                      </span>
                    </div>
                  </div>
                  {injuryAlert && !done && (
                    <div className="px-2.5 sm:px-3 py-1.5 mland:px-2 mland:py-1 bg-rose-950/95 border-b border-rose-400/50 flex flex-wrap items-center justify-between gap-2 text-white shrink-0">
                      <span className="text-[11px] sm:text-xs mland:text-[10px] font-bold text-rose-200 flex items-center gap-1.5 min-w-0">
                        <span className="animate-pulse shrink-0">🩹</span>
                        <span className="truncate">
                          ด่วน น.{injuryAlert.minute}&apos;: #{injuryAlert.no} {injuryAlert.role} {injuryAlert.name} บาดเจ็บ (พัก {injuryAlert.games} นัด)
                        </span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {benchList.length > 0 && subsUsed.length < 5 && (
                          <button
                            type="button"
                            onClick={handleQuickSubInjured}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-extrabold cursor-pointer hover:brightness-110 whitespace-nowrap"
                          >
                            ⚡ เปลี่ยนตัวด่วนแทนผู้เจ็บ
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSubPickOut(injuryAlert.name);
                            setShowTacticsDrawer(true);
                            setMlandMatchTab('tactics');
                            setPaused(true);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-white/15 border border-white/25 text-white text-[10px] font-bold cursor-pointer hover:bg-white/25 whitespace-nowrap"
                        >
                          🔄 เลือกเอง
                        </button>
                        <button
                          type="button"
                          onClick={() => setInjuryAlert(null)}
                          className="w-5 h-5 rounded-md bg-white/10 text-white/80 text-[10px] font-bold cursor-pointer hover:bg-white/20"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="relative bg-[#144d2e]">
                    <canvas
                      ref={canvasRef}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
                      className={`${matchPhaseUi === 'halftime' && !done ? 'hidden ' : ''}w-full aspect-[16/8.2] mland:max-h-[calc(97dvh-132px)] mland:w-auto mland:max-w-full mland:mx-auto block select-none`}
                      aria-label="สนามแข่งขัน 2 มิติแบบเรียลไทม์ 11 ต่อ 11"
                    />

                    {/* Halftime Tactical Pitch Stage: Live Formation, Player Ratings & Energy */}
                    {matchPhaseUi === 'halftime' && !done && (() => {
                      const hSlots = getFormationSlots(homeOrig);
                      const aSlots = getFormationSlots(awayOrig);
                      const curHomeLu = meIsHome ? liveLu : liveOppLu;
                      const curAwayLu = meIsHome ? liveOppLu : liveLu;

                      const buildHtNodes = (
                        team: Team,
                        xiNames: string[],
                        slots: ReturnType<typeof getFormationSlots>,
                        side: 'H' | 'A',
                        kit: string,
                        gkKit: string
                      ) =>
                        xiNames.map((name, i) => {
                          const pl = team.sq.find((q) => q.n === name) || team.sq[i];
                          const slot = slots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
                          const no = pl ? getShirtNo(team, pl) : i + 1;
                          const rt = liveFormMap[name] ?? 6.5;
                          const fitVal = Math.round(liveFitMap[name] ?? pl?.fit ?? 100);
                          const goals = evs.filter((e) => e.t === team.id && e.who === name).length;
                          const assists = evs.filter((e) => e.t === team.id && e.as === name).length;
                          const pCards = matchCards.filter((c) => c.t === team.id && c.who === name);
                          const hasRed = sentOff.includes(name) || pCards.some((c) => c.type === 'R' || c.type === 'Y2R');
                          const hasYellow = !hasRed && pCards.some((c) => c.type === 'Y');
                          const subInEv = subLog.find((s) => s.t === team.id && s.inPlayer === name);
                          const isMe = Boolean(pl?.me || (isPlayerMode && name === myPlayerName));
                          let xPct = 50;
                          let yPct = 50;
                          if (htPitchMode === 'all') {
                            xPct = side === 'H' ? clamp(7.5 + ((92 - slot.y) / 78) * 36.5, 7.5, 44) : clamp(92.5 - ((92 - slot.y) / 78) * 36.5, 56, 92.5);
                            yPct = side === 'H' ? clamp(14 + (slot.x / 100) * 72, 14, 86) : clamp(86 - (slot.x / 100) * 72, 14, 86);
                          } else {
                            xPct = clamp(10 + ((92 - slot.y) / 78) * 80, 10, 90);
                            yPct = clamp(15 + (slot.x / 100) * 70, 15, 85);
                          }
                          return {
                            name,
                            shortName: name.split(' ')[0] || name,
                            player: pl,
                            team,
                            side,
                            no,
                            role: slot.sp,
                            rt,
                            fitVal,
                            goals,
                            assists,
                            hasRed,
                            hasYellow,
                            subInEv,
                            isMe,
                            xPct,
                            yPct,
                            kit: slot.pos === 'GK' ? gkKit : kit,
                            trim: slot.pos === 'GK' ? '#ffffff' : side === 'H' ? homeTrim : awayTrim
                          };
                        });

                      const hNodes = buildHtNodes(homeOrig, curHomeLu, hSlots, 'H', homeKit, homeGkKit);
                      const aNodes = buildHtNodes(awayOrig, curAwayLu, aSlots, 'A', awayKit, awayGkKit);
                      const visibleNodes = htPitchMode === 'H' ? hNodes : htPitchMode === 'A' ? aNodes : [...hNodes, ...aNodes];
                      const activeTeam = htPitchMode === 'A' ? awayOrig : homeOrig;
                      const formLabel = activeTeam.cf ? 'กำหนดเอง' : activeTeam.form;
                      const htPickedInfo = htPickedPlayer
                        ? (() => {
                            const t = homeOrig.sq.find((q) => q.n === htPickedPlayer) ? homeOrig : awayOrig;
                            const p = t.sq.find((q) => q.n === htPickedPlayer);
                            const no = p ? getShirtNo(t, p) : 0;
                            const rt = liveFormMap[htPickedPlayer] ?? 6.5;
                            const fitVal = Math.round(liveFitMap[htPickedPlayer] ?? p?.fit ?? 100);
                            const gl = evs.filter((e) => e.t === t.id && e.who === htPickedPlayer).length;
                            const as = evs.filter((e) => e.t === t.id && e.as === htPickedPlayer).length;
                            const cards = matchCards.filter((c) => c.t === t.id && c.who === htPickedPlayer);
                            const hasRed = sentOff.includes(htPickedPlayer) || cards.some((c) => c.type === 'R' || c.type === 'Y2R');
                            return { name: htPickedPlayer, team: t, role: p?.ro || 'CM', no, rt, fitVal, gl, as, cards, hasRed };
                          })()
                        : null;
                      const htRatingCls = (rt: number) =>
                        rt >= 7.8
                          ? 'bg-[#facc15] text-[#1c1300] border-[#fef08a]'
                          : rt >= 7.0
                            ? 'bg-emerald-500 text-white border-emerald-200/80'
                            : rt >= 6.2
                              ? 'bg-slate-900/95 text-white border-slate-400/50'
                              : 'bg-rose-600 text-white border-rose-200/80';

                      return (
                        <div className="flex flex-col bg-[#0b2e1b]">
                          {/* Top Team & Formation Header */}
                          <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 bg-[#072113] border-b border-white/15 flex flex-wrap items-center justify-between gap-1.5 text-white">
                            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs mland:text-[9.5px] font-bold min-w-0">
                              <span className="px-1.5 py-0.5 rounded bg-[var(--lamp)] text-[#261900] text-[9.5px] mland:text-[8px] font-extrabold shrink-0">☕ พักครึ่ง</span>
                              <span className="truncate">แผน {htPitchMode === 'all' ? `${homeOrig.cf ? 'กำหนดเอง' : homeOrig.form} vs ${awayOrig.cf ? 'กำหนดเอง' : awayOrig.form}` : `${formLabel}${activeTeam.id === meTeamOrig.id ? ` · ${AR_T[liveTac]}` : ''}`}</span>
                            </div>
                            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/10 text-[10px] mland:text-[8.5px]">
                              <button
                                type="button"
                                onClick={() => setHtPitchMode('all')}
                                className={`px-2 mland:px-1.5 py-0.5 rounded-md font-bold cursor-pointer whitespace-nowrap ${htPitchMode === 'all' ? 'bg-emerald-500 text-white' : 'text-white/75 hover:text-white'}`}
                              >
                                ทั้งหมด
                              </button>
                              <button
                                type="button"
                                onClick={() => setHtPitchMode('H')}
                                className={`px-2 mland:px-1.5 py-0.5 rounded-md font-bold cursor-pointer whitespace-nowrap max-w-[88px] truncate ${htPitchMode === 'H' ? 'bg-white text-slate-900' : 'text-white/75 hover:text-white'}`}
                              >
                                {homeOrig.name}
                              </button>
                              <button
                                type="button"
                                onClick={() => setHtPitchMode('A')}
                                className={`px-2 mland:px-1.5 py-0.5 rounded-md font-bold cursor-pointer whitespace-nowrap max-w-[88px] truncate ${htPitchMode === 'A' ? 'bg-white text-slate-900' : 'text-white/75 hover:text-white'}`}
                              >
                                {awayOrig.name}
                              </button>
                            </div>
                          </div>

                          {/* Live Halftime Turf Pitch */}
                          <div
                            className="relative w-full aspect-[16/9.2] sm:aspect-[16/8.6] min-h-[240px] sm:min-h-[290px] mland:min-h-[165px] mland:max-h-[calc(97dvh-215px)] select-none overflow-hidden"
                            style={{
                              backgroundImage:
                                'repeating-linear-gradient(90deg, #175c36 0%, #175c36 8.333%, #1d6b40 8.333%, #1d6b40 16.666%)'
                            }}
                          >
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.3) 100%)' }}
                            />
                            <svg viewBox="0 0 1000 560" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                              <g stroke="rgba(240,253,244,0.55)" strokeWidth="2.2" fill="none">
                                <rect x="26" y="20" width="948" height="520" />
                                <line x1="500" y1="20" x2="500" y2="540" />
                                <circle cx="500" cy="280" r="76" />
                                <circle cx="500" cy="280" r="3.5" fill="rgba(240,253,244,0.8)" />
                                <rect x="26" y="130" width="145" height="300" />
                                <rect x="26" y="205" width="52" height="150" />
                                <rect x="829" y="130" width="145" height="300" />
                                <rect x="922" y="205" width="52" height="150" />
                              </g>
                            </svg>

                            {/* Selected Halftime Player Popover */}
                            {htPickedInfo && (
                              <div className="absolute top-2 left-2 right-2 sm:right-auto z-30 sm:max-w-[300px] px-2.5 py-1.5 rounded-xl bg-slate-950/92 backdrop-blur-md border border-white/25 text-white text-[11px] shadow-xl flex items-center justify-between gap-2">
                                <div className="min-w-0 space-y-0.5">
                                  <div className="font-bold truncate flex items-center gap-1.5">
                                    <span className="text-[#facc15] tabular">#{htPickedInfo.no}</span>
                                    <span className="px-1 rounded bg-white/15 text-[9.5px] font-extrabold">{htPickedInfo.role}</span>
                                    <span className="truncate">{htPickedInfo.name}</span>
                                  </div>
                                  <div className="text-[10px] text-white/80 flex flex-wrap items-center gap-1.5 tabular">
                                    <span>{htPickedInfo.team.name}</span>
                                    <span className="px-1.5 rounded bg-[#facc15]/20 text-[#facc15] font-extrabold">⭐ {htPickedInfo.rt.toFixed(1)}</span>
                                    <span className={`font-extrabold ${htPickedInfo.fitVal >= 70 ? 'text-emerald-300' : htPickedInfo.fitVal >= subAlertFitTh ? 'text-amber-300' : 'text-rose-300'}`}>
                                      ⚡ {htPickedInfo.fitVal}%
                                    </span>
                                    {htPickedInfo.gl > 0 && <StatIconBadge kind="goal" count={htPickedInfo.gl} size="xs" />}
                                    {htPickedInfo.as > 0 && <StatIconBadge kind="assist" count={htPickedInfo.as} size="xs" />}
                                    {htPickedInfo.cards.map((c, idx) => (
                                      <StatIconBadge key={idx} kind={c.type === 'Y' ? 'yellow' : 'red'} size="xs" />
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {state.mode === 'm' && htPickedInfo.team.id === meTeamOrig.id && !htPickedInfo.hasRed && subsUsed.length < 5 && benchList.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const rep = handleAutoSubstitute(htPickedInfo.name);
                                        if (rep) setHtPickedPlayer(rep.n);
                                      }}
                                      className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-extrabold cursor-pointer hover:brightness-110 whitespace-nowrap"
                                    >
                                      🔄 เปลี่ยนตัวด่วน
                                    </button>
                                  )}
                                  <button type="button" onClick={() => setHtPickedPlayer(null)} className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 font-bold cursor-pointer">
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Halftime Player Nodes with Rating + Energy Bar */}
                            {visibleNodes.map((n) => {
                              const isAll = htPitchMode === 'all';
                              const sizeCls = isAll ? 'w-7 h-7 sm:w-8 sm:h-8 mland:w-5 mland:h-5' : 'w-9 h-9 sm:w-10.5 sm:h-10.5 mland:w-6.5 mland:h-6.5';
                              const faceSize = isAll ? 32 : 42;
                              const isPicked = htPickedPlayer === n.name;
                              const fitCol = n.fitVal >= 70 ? '#34d399' : n.fitVal >= subAlertFitTh ? '#fbbf24' : '#f87171';
                              const hasEvent = n.goals > 0 || n.assists > 0 || n.hasRed || n.hasYellow || n.subInEv;
                              return (
                                <button
                                  key={`ht-${n.side}-${n.name}`}
                                  type="button"
                                  onClick={() => setHtPickedPlayer((prev) => (prev === n.name ? null : n.name))}
                                  style={{ left: `${n.xPct}%`, top: `${n.yPct}%` }}
                                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer focus:outline-none ${isPicked ? 'z-20' : 'z-10 hover:z-20'}`}
                                >
                                  <div className="relative">
                                    <div
                                      className={`${sizeCls} rounded-full overflow-hidden flex items-center justify-center transition-transform group-hover:scale-110 mland:[&_svg]:w-full mland:[&_svg]:h-full ${
                                        n.hasRed
                                          ? 'opacity-45 grayscale border border-rose-400'
                                          : isPicked
                                            ? 'ring-2 ring-sky-300 border-2 border-white shadow-lg scale-105'
                                            : n.isMe
                                              ? 'ring-2 ring-amber-300 border-2 border-white shadow-md'
                                              : 'border-[1.5px] border-white/90 shadow-md'
                                      }`}
                                      style={{ backgroundColor: n.kit }}
                                    >
                                      <PlayerFace
                                        player={n.player || { n: n.name, no: n.no, pos: n.role === 'GK' ? 'GK' : 'MF' }}
                                        team={n.team}
                                        state={state}
                                        careerProfile={state.p}
                                        size={faceSize}
                                        kitColor={n.kit}
                                        trimColor={n.trim}
                                        bare
                                      />
                                    </div>
                                    <span className="absolute -top-1 -left-2 mland:-left-1.5 px-1 py-0.2 rounded bg-slate-950/90 border border-white/25 text-white text-[7px] sm:text-[7.5px] mland:text-[6px] font-extrabold leading-none">
                                      {n.role}
                                    </span>
                                    <span className={`absolute -top-1 -right-2 mland:-right-1.5 px-1 mland:px-0.5 py-0.2 rounded-md border text-[7.5px] sm:text-[8.5px] mland:text-[6px] font-black tabular leading-none shadow-sm ${htRatingCls(n.rt)}`}>
                                      {n.rt.toFixed(1)}
                                    </span>
                                    {!isAll && (
                                      <span className="absolute -bottom-1 -left-1.5 px-1 py-0.2 rounded bg-[#0b2018]/95 border border-white/25 text-[#ffd75e] text-[7px] sm:text-[7.5px] mland:text-[6px] font-extrabold tabular leading-none">
                                        {n.no}
                                      </span>
                                    )}
                                    {hasEvent && (
                                      <div className="absolute -bottom-1 -right-2 mland:-right-1.5 px-0.5 rounded-full bg-slate-950/85 border border-white/20 flex items-center gap-0.5 leading-none shadow-xs">
                                        {n.goals > 0 && <StatIconBadge kind="goal" count={n.goals} size="xs" />}
                                        {n.assists > 0 && <StatIconBadge kind="assist" count={n.assists} size="xs" />}
                                        {n.hasRed && <StatIconBadge kind="red" size="xs" />}
                                        {n.hasYellow && <StatIconBadge kind="yellow" size="xs" />}
                                        {n.subInEv && <StatIconBadge kind="subIn" size="xs" />}
                                      </div>
                                    )}
                                  </div>

                                  {/* Name + Stamina Bar */}
                                  <div className={`mt-0.5 px-1.5 py-0.2 rounded-md text-[7.5px] sm:text-[9px] mland:text-[6.5px] font-bold leading-tight truncate max-w-[60px] sm:max-w-[82px] mland:max-w-[50px] ${n.isMe ? 'bg-amber-300 text-[#1c1300]' : 'bg-[#05120b]/85 text-white/95'}`}>
                                    {isAll ? n.shortName : n.name}
                                  </div>
                                  {!n.hasRed && (
                                    <div className="mt-0.5 flex items-center gap-0.5 px-1 py-0.2 rounded bg-[#05120b]/85">
                                      <div className="w-6 sm:w-8 mland:w-5 h-1 rounded-full bg-white/20 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${clamp(n.fitVal, 0, 100)}%`, backgroundColor: fitCol }} />
                                      </div>
                                      <span className="text-[7px] sm:text-[7.5px] mland:text-[5.5px] font-extrabold tabular leading-none" style={{ color: fitCol }}>
                                        {n.fitVal}%
                                      </span>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Compact Halftime Team Talk & Start 2nd Half Bar */}
                          <div className="px-2.5 py-2 mland:px-2 mland:py-1 bg-[#082414] border-t border-white/15 space-y-1.5 mland:space-y-1 text-white">
                            <div className="flex flex-wrap items-center justify-between gap-1 text-[10.5px] mland:text-[9px] text-white/80">
                              <span className="font-bold text-white">
                                {homeOrig.name} {gh} - {ga} {awayOrig.name}
                              </span>
                              <span className="tabular">
                                ครองบอล {matchStats.possH}% · ยิง {matchStats.shotsH}-{matchStats.shotsA} · xG {matchStats.xgH.toFixed(2)}-{matchStats.xgA.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mland:gap-1">
                              {!halftimeTalkUsed && (
                                state.mode === 'm' ? (
                                  <>
                                    <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('attack'); }} className="px-2 py-1 mland:py-0.5 rounded-lg bg-rose-500/25 border border-rose-400/50 text-rose-200 text-[10.5px] mland:text-[9px] font-bold cursor-pointer hover:brightness-110">
                                      🔥 บุกแหลก
                                    </button>
                                    <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('balanced'); }} className="px-2 py-1 mland:py-0.5 rounded-lg bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-[10.5px] mland:text-[9px] font-bold cursor-pointer hover:brightness-110">
                                      ⚖️ คงทรงเกม
                                    </button>
                                    <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('defend'); }} className="px-2 py-1 mland:py-0.5 rounded-lg bg-white/10 border border-white/25 text-white text-[10.5px] mland:text-[9px] font-bold cursor-pointer hover:bg-white/20">
                                      🛡️ แน่นไว้
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('fit'); }} className="px-2 py-1 mland:py-0.5 rounded-lg bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-[10.5px] mland:text-[9px] font-bold cursor-pointer">
                                      💪 วอร์มเติมฟิต (+6%)
                                    </button>
                                    <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('balanced'); }} className="px-2 py-1 mland:py-0.5 rounded-lg bg-white/10 border border-white/25 text-white text-[10.5px] mland:text-[9px] font-bold cursor-pointer">
                                      🎯 ลุยครึ่งหลังเลย
                                    </button>
                                  </>
                                )
                              )}
                              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                {state.mode === 'm' && (
                                  <button
                                    type="button"
                                    onClick={() => { setShowTacticsDrawer(true); setMlandMatchTab('tactics'); }}
                                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-white/10 border border-white/25 text-white text-[10.5px] mland:text-[9px] font-bold cursor-pointer hover:bg-white/20"
                                  >
                                    ⚙️ ปรับแท็กติก
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleStartSecondHalf()}
                                  className="px-3 py-1 mland:py-0.5 rounded-lg bg-[var(--lamp)] text-[#261900] text-[11px] mland:text-[9.5px] font-extrabold cursor-pointer hover:brightness-105"
                                >
                                  ▶ เริ่มครึ่งหลัง
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (() => {
                const hSlots = getFormationSlots(homeOrig);
                const aSlots = getFormationSlots(awayOrig);
                const buildPitchNodes = (team: Team, xiNames: string[], slots: ReturnType<typeof getFormationSlots>, side: 'H' | 'A', kit: string, gkKit: string) =>
                  xiNames.map((name, i) => {
                    const pl = team.sq.find((q) => q.n === name) || team.sq[i];
                    const slot = slots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
                    const no = pl ? getShirtNo(team, pl) : i + 1;
                    const rt = fullTimeAnalysis.ratings[name] ?? 6.5;
                    const goals = evs.filter((e) => e.t === team.id && e.who === name).length;
                    const assists = evs.filter((e) => e.t === team.id && e.as === name).length;
                    const pCards = fullTimeAnalysis.cards.filter((c) => c.t === team.id && c.who === name);
                    const hasRed = pCards.some((c) => c.type === 'R' || c.type === 'Y2R');
                    const hasYellow = !hasRed && pCards.some((c) => c.type === 'Y');
                    const subOutEv = fullTimeAnalysis.subs.find((s) => s.t === team.id && s.outPlayer === name);
                    const isMotm = fullTimeAnalysis.motm === name;
                    const isMe = Boolean(pl?.me || (isPlayerMode && name === myPlayerName));
                    let xPct = 50;
                    let yPct = 50;
                    if (ftPitchMode === 'all') {
                      xPct = side === 'H' ? clamp(7.5 + ((92 - slot.y) / 78) * 36.5, 7.5, 44) : clamp(92.5 - ((92 - slot.y) / 78) * 36.5, 56, 92.5);
                      yPct = side === 'H' ? clamp(14 + (slot.x / 100) * 72, 14, 86) : clamp(86 - (slot.x / 100) * 72, 14, 86);
                    } else {
                      xPct = clamp(10 + ((92 - slot.y) / 78) * 80, 10, 90);
                      yPct = clamp(15 + (slot.x / 100) * 70, 15, 85);
                    }
                    const nodeKit = slot.pos === 'GK' ? gkKit : kit;
                    const nodeTrim = slot.pos === 'GK' ? '#ffffff' : side === 'H' ? homeTrim : awayTrim;
                    return {
                      name,
                      shortName: name.split(' ')[0] || name,
                      player: pl,
                      team,
                      side,
                      no,
                      role: slot.sp,
                      rt,
                      goals,
                      assists,
                      hasRed,
                      hasYellow,
                      subOutEv,
                      isMotm,
                      isMe,
                      xPct,
                      yPct,
                      kit: nodeKit,
                      trim: nodeTrim
                    };
                  });

                const homeNodes = buildPitchNodes(homeOrig, initialHomeXi, hSlots, 'H', homeKit, homeGkKit);
                const awayNodes = buildPitchNodes(awayOrig, initialAwayXi, aSlots, 'A', awayKit, awayGkKit);
                const visibleNodes = ftPitchMode === 'H' ? homeNodes : ftPitchMode === 'A' ? awayNodes : [...homeNodes, ...awayNodes];

                const motmHome = homeOrig.sq.find((q) => q.n === fullTimeAnalysis.motm);
                const motmAway = awayOrig.sq.find((q) => q.n === fullTimeAnalysis.motm);
                const motmPlayer = motmHome || motmAway;
                const motmTeam = motmHome ? homeOrig : awayOrig;
                const motmNo = motmPlayer ? getShirtNo(motmTeam, motmPlayer) : 10;
                const motmRt = fullTimeAnalysis.ratings[fullTimeAnalysis.motm] ?? 8.2;
                const motmGoals = evs.filter((e) => e.t === motmTeam.id && e.who === fullTimeAnalysis.motm).length;
                const motmAssists = evs.filter((e) => e.t === motmTeam.id && e.as === fullTimeAnalysis.motm).length;

                const pickedInfo = ftPickedPlayer
                  ? (() => {
                      const t = homeOrig.sq.find((q) => q.n === ftPickedPlayer) ? homeOrig : awayOrig;
                      const p = t.sq.find((q) => q.n === ftPickedPlayer);
                      const no = p ? getShirtNo(t, p) : 0;
                      const rt = fullTimeAnalysis.ratings[ftPickedPlayer] ?? 6.5;
                      const gl = evs.filter((e) => e.t === t.id && e.who === ftPickedPlayer).length;
                      const as = evs.filter((e) => e.t === t.id && e.as === ftPickedPlayer).length;
                      const subIn = fullTimeAnalysis.subs.find((s) => s.t === t.id && s.inPlayer === ftPickedPlayer);
                      const subOut = fullTimeAnalysis.subs.find((s) => s.t === t.id && s.outPlayer === ftPickedPlayer);
                      const cards = fullTimeAnalysis.cards.filter((c) => c.t === t.id && c.who === ftPickedPlayer);
                      return { name: ftPickedPlayer, team: t, role: p?.ro || 'CM', no, rt, gl, as, subIn, subOut, cards };
                    })()
                  : null;

                const ratingBadgeCls = (rt: number, isMotm: boolean) =>
                  isMotm || rt >= 8.5
                    ? 'bg-[#facc15] text-[#1c1300] border-[#fef08a]'
                    : rt >= 7.4
                      ? 'bg-emerald-500 text-white border-emerald-200/80'
                      : rt >= 6.4
                        ? 'bg-slate-900/95 text-white border-slate-400/50'
                        : 'bg-rose-600 text-white border-rose-200/80';

                return (
                  <div className="rounded-2xl mland:rounded-xl overflow-hidden border border-[var(--line)] bg-[#0b2e1b] shadow-lg mland:flex-1 mland:min-h-0 mland:flex mland:flex-col">
                    {/* Compact Pitch Top Bar */}
                    <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 bg-[#072113] border-b border-white/15 flex items-center justify-between gap-2 text-white shrink-0">
                      <span className="text-[11px] sm:text-xs mland:text-[9.5px] font-bold flex items-center gap-1 whitespace-nowrap">
                        <span>🏟️ เรตติ้งในสนาม</span>
                      </span>
                      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/10 text-[10px] mland:text-[8.5px] min-w-0">
                        <button
                          type="button"
                          onClick={() => setFtPitchMode('all')}
                          className={`px-2 mland:px-1.5 py-0.5 rounded-md font-bold cursor-pointer transition-colors whitespace-nowrap ${ftPitchMode === 'all' ? 'bg-emerald-500 text-white shadow-xs' : 'text-white/75 hover:text-white'}`}
                        >
                          ทั้งหมด
                        </button>
                        <button
                          type="button"
                          onClick={() => setFtPitchMode('H')}
                          className={`px-2 mland:px-1.5 py-0.5 rounded-md font-bold cursor-pointer transition-colors whitespace-nowrap max-w-[92px] truncate ${ftPitchMode === 'H' ? 'bg-white text-slate-900 shadow-xs' : 'text-white/75 hover:text-white'}`}
                        >
                          {homeOrig.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFtPitchMode('A')}
                          className={`px-2 mland:px-1.5 py-0.5 rounded-md font-bold cursor-pointer transition-colors whitespace-nowrap max-w-[92px] truncate ${ftPitchMode === 'A' ? 'bg-white text-slate-900 shadow-xs' : 'text-white/75 hover:text-white'}`}
                        >
                          {awayOrig.name}
                        </button>
                      </div>
                    </div>

                    {/* Full-Time Turf Stage */}
                    <div
                      className="relative w-full aspect-[16/9.6] sm:aspect-[16/9] min-h-[265px] sm:min-h-[320px] mland:min-h-0 mland:aspect-auto mland:flex-1 select-none overflow-hidden"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(90deg, #175c36 0%, #175c36 8.333%, #1d6b40 8.333%, #1d6b40 16.666%)'
                      }}
                    >
                      {/* Subtle Stadium Vignette */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.32) 100%)' }}
                      />

                      {/* Pitch Line Markings SVG */}
                      <svg viewBox="0 0 1000 560" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                        <g stroke="rgba(240,253,244,0.58)" strokeWidth="2.2" fill="none">
                          <rect x="26" y="20" width="948" height="520" />
                          <line x1="500" y1="20" x2="500" y2="540" />
                          <circle cx="500" cy="280" r="76" />
                          <circle cx="500" cy="280" r="3.5" fill="rgba(240,253,244,0.8)" />
                          <rect x="26" y="130" width="145" height="300" />
                          <rect x="26" y="205" width="52" height="150" />
                          <circle cx="122" cy="280" r="3" fill="rgba(240,253,244,0.8)" />
                          <path d="M 171 214 A 72 72 0 0 1 171 346" />
                          <rect x="829" y="130" width="145" height="300" />
                          <rect x="922" y="205" width="52" height="150" />
                          <circle cx="878" cy="280" r="3" fill="rgba(240,253,244,0.8)" />
                          <path d="M 829 214 A 72 72 0 0 0 829 346" />
                          <rect x="10" y="232" width="16" height="96" strokeWidth="2" />
                          <rect x="974" y="232" width="16" height="96" strokeWidth="2" />
                        </g>
                      </svg>

                      {/* Selected Player Detail Inspector Popover */}
                      {pickedInfo && (
                        <div className="absolute top-2 left-2 right-2 sm:right-auto z-30 sm:max-w-[290px] px-2.5 py-1.5 rounded-xl bg-slate-950/92 backdrop-blur-md border border-white/25 text-white text-[11px] shadow-xl flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold truncate flex items-center gap-1.5">
                              <span className="text-[#facc15] tabular">#{pickedInfo.no}</span>
                              <span className="px-1 rounded bg-white/15 text-[9.5px] font-extrabold">{pickedInfo.role}</span>
                              <span className="truncate">{pickedInfo.name}</span>
                            </div>
                            <div className="text-[10px] text-white/75 flex flex-wrap items-center gap-1.5 tabular mt-0.5">
                              <span>{pickedInfo.team.name}</span>
                              <span className="px-1.5 rounded bg-[#facc15]/20 text-[#facc15] font-extrabold">⭐ {pickedInfo.rt.toFixed(1)}</span>
                              {pickedInfo.gl > 0 && <StatIconBadge kind="goal" count={pickedInfo.gl} size="sm" />}
                              {pickedInfo.as > 0 && <StatIconBadge kind="assist" count={pickedInfo.as} size="sm" />}
                              {pickedInfo.cards.map((c, idx) => (
                                <StatIconBadge key={idx} kind={c.type === 'Y' ? 'yellow' : 'red'} size="xs" />
                              ))}
                              {pickedInfo.subOut && <span className="inline-flex items-center gap-0.5"><StatIconBadge kind="subOut" size="xs" />{pickedInfo.subOut.m}&apos;</span>}
                              {pickedInfo.subIn && <span className="inline-flex items-center gap-0.5"><StatIconBadge kind="subIn" size="xs" />{pickedInfo.subIn.m}&apos;</span>}
                            </div>
                          </div>
                          <button type="button" onClick={() => setFtPickedPlayer(null)} className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 font-bold cursor-pointer shrink-0">
                            ✕
                          </button>
                        </div>
                      )}

                      {/* 22 (or 11) Clean Player Nodes on Pitch */}
                      {visibleNodes.map((n) => {
                        const isAll = ftPitchMode === 'all';
                        const sizeCls = isAll ? 'w-7 h-7 sm:w-8 sm:h-8 mland:w-5.5 mland:h-5.5' : 'w-10 h-10 sm:w-11 sm:h-11 mland:w-7 mland:h-7';
                        const faceSize = isAll ? 32 : 43;
                        const isPicked = ftPickedPlayer === n.name;
                        const hasEvent = n.goals > 0 || n.assists > 0 || n.hasRed || n.hasYellow || n.subOutEv;
                        return (
                          <button
                            key={`${n.side}-${n.name}`}
                            type="button"
                            onClick={() => setFtPickedPlayer((prev) => (prev === n.name ? null : n.name))}
                            style={{ left: `${n.xPct}%`, top: `${n.yPct}%` }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer focus:outline-none ${
                              n.isMotm || isPicked ? 'z-20' : 'z-10 hover:z-20'
                            }`}
                          >
                            <div className="relative">
                              <div
                                className={`${sizeCls} rounded-full overflow-hidden flex items-center justify-center transition-transform group-hover:scale-110 mland:[&_svg]:w-full mland:[&_svg]:h-full ${
                                  isPicked
                                    ? 'ring-2 ring-sky-300 border-2 border-white shadow-lg scale-105'
                                    : n.isMotm
                                      ? 'ring-2 ring-[#facc15] shadow-[0_0_14px_rgba(250,204,21,0.85)] border-2 border-white'
                                      : n.isMe
                                        ? 'ring-2 ring-amber-300 border-2 border-white shadow-md'
                                        : 'border-[1.5px] mland:border border-white/90 shadow-md'
                                }`}
                                style={{ backgroundColor: n.kit }}
                              >
                                <PlayerFace
                                  player={n.player || { n: n.name, no: n.no, pos: n.role === 'GK' ? 'GK' : 'MF' }}
                                  team={n.team}
                                  state={state}
                                  careerProfile={state.p}
                                  size={faceSize}
                                  kitColor={n.kit}
                                  trimColor={n.trim}
                                  bare
                                />
                              </div>

                              {/* MOTM Crown (Clean Top-Left Corner) */}
                              {n.isMotm && (
                                <span
                                  title="Man of the Match"
                                  className="absolute -top-1.5 -left-1.5 mland:-top-1 mland:-left-1 w-4 h-4 mland:w-3 mland:h-3 rounded-full bg-[#facc15] border border-white flex items-center justify-center text-[9px] mland:text-[7px] leading-none shadow-sm"
                                >
                                  👑
                                </span>
                              )}

                              {/* Position Tag (Always visible cleanly across 11v11, single-team & MOTM) */}
                              {!isAll && !n.isMotm && (
                                <span className="absolute -top-1 -left-2 mland:-left-1.5 px-1 py-0.2 rounded bg-slate-950/90 border border-white/30 text-white text-[7.5px] sm:text-[8px] mland:text-[6.5px] font-extrabold leading-none">
                                  {n.role}
                                </span>
                              )}

                              {/* Rating Badge (Top-Right) */}
                              <span
                                className={`absolute -top-1 -right-2 mland:-right-1.5 px-1 mland:px-0.5 py-0.2 rounded-md border text-[8px] sm:text-[9px] mland:text-[6.5px] font-black tabular leading-none shadow-sm ${ratingBadgeCls(
                                  n.rt,
                                  n.isMotm
                                )}`}
                              >
                                {n.rt.toFixed(1)}
                              </span>

                              {/* Bottom-Left: Position tag in 11v11 (or Shirt No + Role on MOTM in single-team) */}
                              {isAll ? (
                                <span
                                  className={`absolute -bottom-1 -left-2 mland:-left-1.5 px-1 py-0.2 rounded bg-slate-950/92 border border-white/25 text-[6.5px] sm:text-[7.5px] mland:text-[5.5px] font-extrabold leading-none ${
                                    n.role === 'GK'
                                      ? 'text-amber-300'
                                      : ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(n.role)
                                        ? 'text-sky-300'
                                        : ['ST', 'CF', 'LW', 'RW'].includes(n.role)
                                          ? 'text-rose-300'
                                          : 'text-emerald-300'
                                  }`}
                                >
                                  {n.role}
                                </span>
                              ) : (
                                <span className="absolute -bottom-1 -left-1.5 px-1 py-0.2 rounded bg-[#0b2018]/95 border border-white/25 text-[#ffd75e] text-[7.5px] sm:text-[8px] mland:text-[6.5px] font-extrabold tabular leading-none whitespace-nowrap">
                                  {n.isMotm ? `#${n.no} ${n.role}` : n.no}
                                </span>
                              )}

                              {/* Compact Event Badges (Bottom-Right) */}
                              {hasEvent && (
                                <div className="absolute -bottom-1 -right-2 mland:-right-1.5 px-0.5 rounded-full bg-slate-950/85 border border-white/20 flex items-center gap-0.5 leading-none shadow-xs">
                                  {n.goals > 0 && <StatIconBadge kind="goal" count={n.goals} size="xs" />}
                                  {n.assists > 0 && <StatIconBadge kind="assist" count={n.assists} size="xs" />}
                                  {n.hasRed && <StatIconBadge kind="red" size="xs" />}
                                  {n.hasYellow && <StatIconBadge kind="yellow" size="xs" />}
                                  {n.subOutEv && <StatIconBadge kind="subOut" size="xs" />}
                                </div>
                              )}
                            </div>

                            {/* Clean Unified Nameplate */}
                            <div
                              className={`mt-0.5 mland:mt-0 px-1.5 mland:px-1 py-0.2 rounded-md text-[8px] sm:text-[9.5px] mland:text-[7px] font-bold leading-tight truncate max-w-[64px] sm:max-w-[88px] mland:max-w-[52px] shadow-xs ${
                                n.isMotm
                                  ? 'bg-gradient-to-r from-[#fde047] to-[#eab308] text-[#1c1300] font-extrabold'
                                  : n.isMe
                                    ? 'bg-amber-300 text-[#1c1300]'
                                    : 'bg-[#05120b]/85 text-white/95'
                              }`}
                            >
                              {isAll ? n.shortName : n.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Substitutes Touchline Strip (Compact Single-Row Scroll) */}
                    {fullTimeAnalysis.subs.length > 0 && (
                      <div className="px-2.5 py-1 mland:px-2 mland:py-0.5 bg-[#082414] border-t border-white/10 flex items-center gap-1.5 overflow-x-auto text-[10px] mland:text-[8.5px] text-white/90 shrink-0">
                        <span className="font-bold text-white/65 shrink-0">🔄 สำรอง:</span>
                        {fullTimeAnalysis.subs.map((sb, idx) => {
                          const subTeam = sb.t === homeOrig.id ? homeOrig : awayOrig;
                          const subSideKit = sb.t === homeOrig.id ? homeKit : awayKit;
                          const subPl = subTeam.sq.find((q) => q.n === sb.inPlayer);
                          const subNo = subPl ? getShirtNo(subTeam, subPl) : 0;
                          const subRt = fullTimeAnalysis.ratings[sb.inPlayer] ?? 6.5;
                          const isSubMotm = fullTimeAnalysis.motm === sb.inPlayer;
                          const subGl = evs.filter((e) => e.t === subTeam.id && e.who === sb.inPlayer).length;
                          const subAs = evs.filter((e) => e.t === subTeam.id && e.as === sb.inPlayer).length;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setFtPickedPlayer(sb.inPlayer)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 mland:py-0 rounded-md border text-[10px] mland:text-[8.5px] tabular cursor-pointer shrink-0 ${
                                isSubMotm ? 'bg-[#facc15] text-[#1c1300] border-white font-extrabold' : 'bg-white/10 border-white/15 hover:bg-white/20'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: subSideKit }} />
                              <span className="opacity-75">#{subNo}</span>
                              {subPl?.ro && <span className="text-[8.5px] mland:text-[7.5px] font-extrabold opacity-80">{subPl.ro}</span>}
                              <span>{sb.inPlayer.split(' ')[0]}</span>
                              <span className={`px-1 rounded font-black ${isSubMotm ? 'bg-[#1c1300] text-[#facc15]' : 'bg-black/40 text-emerald-300'}`}>
                                {subRt.toFixed(1)}
                              </span>
                              {subGl > 0 && <StatIconBadge kind="goal" count={subGl} size="xs" />}
                              {subAs > 0 && <StatIconBadge kind="assist" count={subAs} size="xs" />}
                              {isSubMotm && <span>👑</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Sleek Compact MOTM Broadcast Card */}
                    <div
                      className="px-3 py-1.5 mland:px-2.5 mland:py-1 border-t border-[#facc15]/40 flex items-center justify-between gap-2 text-white shrink-0"
                      style={{ background: 'linear-gradient(90deg, rgba(250,204,21,0.18) 0%, rgba(10,33,20,0.96) 50%, rgba(7,22,14,0.98) 100%)' }}
                    >
                      <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                        <div className="shrink-0 mland:[&_svg]:w-6 mland:[&_svg]:h-6">
                          <PlayerFace
                            player={motmPlayer || { n: fullTimeAnalysis.motm }}
                            team={motmTeam}
                            state={state}
                            careerProfile={motmPlayer?.me ? state.p : null}
                            size={34}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9.5px] mland:text-[8px] font-extrabold text-[#facc15] tracking-wide flex items-center gap-1 leading-tight">
                            <span>👑 MAN OF THE MATCH</span>
                            <span className="text-white/65 font-semibold truncate">· {motmTeam.name}</span>
                          </div>
                          <div className="text-xs sm:text-sm mland:text-[10px] font-bold truncate flex items-center gap-1 leading-tight mt-0.5 mland:mt-0">
                            <span className="px-1 py-0.2 rounded bg-white/15 text-[9.5px] mland:text-[8px] font-extrabold tabular shrink-0">
                              #{motmNo} {motmPlayer?.ro || ''}
                            </span>
                            <span className="truncate">{fullTimeAnalysis.motm}</span>
                            {motmGoals > 0 && <StatIconBadge kind="goal" count={motmGoals} size="sm" />}
                            {motmAssists > 0 && <StatIconBadge kind="assist" count={motmAssists} size="sm" />}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-xl mland:rounded-lg bg-[#facc15]/15 border border-[#facc15]/45 text-center">
                        <div className="text-[8px] mland:text-[7px] text-[#fde047] font-bold leading-none tracking-wider">RATING</div>
                        <div className="text-base sm:text-lg mland:text-xs font-black tabular text-[#facc15] leading-tight">{motmRt.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Live Penalty Shootout Strip */}
              {shootoutUi && (
                <div className="p-2.5 sm:p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--lamp)]/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#8a5b00] dark:text-[var(--lamp)]">
                      🎯 ดวลจุดโทษตัดสิน (รอบที่ {shootoutUi.round})
                    </span>
                    <span className="font-bold tabular text-sm">
                      {shootoutUi.hScore} - {shootoutUi.aScore}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                      <span className="font-bold truncate max-w-[110px]">{homeOrig.name}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.max(5, shootoutUi.hKicks.length) }).map((_, i) => {
                          const res = shootoutUi.hKicks[i];
                          return (
                            <span
                              key={i}
                              className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                res === 'G' ? 'bg-[var(--g)] text-white' : res === 'M' ? 'bg-[var(--red)] text-white' : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--mut)]'
                              }`}
                            >
                              {res === 'G' ? '✓' : res === 'M' ? '✕' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                      <span className="font-bold truncate max-w-[110px]">{awayOrig.name}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.max(5, shootoutUi.aKicks.length) }).map((_, i) => {
                          const res = shootoutUi.aKicks[i];
                          return (
                            <span
                              key={i}
                              className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                res === 'G' ? 'bg-[var(--g)] text-white' : res === 'M' ? 'bg-[var(--red)] text-white' : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--mut)]'
                              }`}
                            >
                              {res === 'G' ? '✓' : res === 'M' ? '✕' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--mut)] flex items-center justify-between gap-2">
                    <span className="truncate">{shootoutUi.lastMsg}</span>
                    {!shootoutUi.finished && (
                      <span className="shrink-0 font-semibold text-[var(--ink)]">
                        คนยิง: {shootoutUi.kickerName.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Portrait Match Stats (shown before Events on < lg) + Live Pitch Energy & Alerts (hide energy panel after FT) */}
              <div className="space-y-2.5 mland:hidden">
                <div className="lg:hidden">{renderMatchStatsPanel()}</div>
                {!done && renderLiveEnergyPanel()}
              </div>
            </div>

            {/* Right Stage: Stats First on Desktop + Unified Match Events Feed & Mobile Landscape Tabbed Pane */}
            <div className="space-y-2.5 mland:space-y-1.5 min-w-0 mland:h-full mland:flex mland:flex-col mland:min-h-0">
              {/* Mobile Landscape Only Tab Bar (Stats First) */}
              <div className={`hidden mland:grid shrink-0 gap-1 p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[10px] ${state.mode === 'm' && !done ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={() => setMlandMatchTab('stats')}
                  className={`min-h-[26px] py-0.5 px-1 rounded-lg font-bold cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap truncate ${mlandMatchTab === 'stats' ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
                >
                  <span>📊 สถิติ</span>
                  {subAlertItems.length > 0 && (
                    <span className="px-1 rounded-full bg-[var(--red)] text-white text-[8.5px] font-black leading-tight tabular">
                      {subAlertItems.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMlandMatchTab('events')}
                  className={`min-h-[26px] py-0.5 px-1 rounded-lg font-bold cursor-pointer whitespace-nowrap truncate ${mlandMatchTab === 'events' ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
                >
                  🎙️ เหตุการณ์
                </button>
                {state.mode === 'm' && !done && (
                  <button
                    type="button"
                    onClick={() => {
                      setMlandMatchTab('tactics');
                      setShowTacticsDrawer(true);
                      setPaused(true);
                    }}
                    className={`min-h-[26px] py-0.5 px-1 rounded-lg font-bold cursor-pointer whitespace-nowrap truncate ${mlandMatchTab === 'tactics' ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
                  >
                    ⚡ แผน ({5 - subsUsed.length})
                  </button>
                )}
              </div>

              <div className="mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:overflow-hidden space-y-2.5 mland:space-y-1">
                <div className="hidden lg:block mland:hidden shrink-0">
                  {renderMatchStatsPanel()}
                </div>
                <div className={`p-2.5 sm:p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] space-y-2 mland:space-y-1 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col ${mlandMatchTab === 'events' ? '' : 'mland:hidden'}`}>
                  <div className="flex items-center justify-between gap-1 pb-1.5 mland:pb-1 border-b border-[var(--line)]/60 shrink-0 overflow-x-auto">
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] uppercase tracking-wide whitespace-nowrap shrink-0">
                      🎙️ เหตุการณ์
                    </span>
                    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10px] mland:text-[8.5px] shrink-0">
                      {(
                        [
                          ['all', 'ทั้งหมด'],
                          ['goal', '⚽ ประตู'],
                          ['card', '🟨🟥 VAR'],
                          ['sub', `🔄 เปลี่ยน${subLog.length ? ` (${subLog.length})` : ''}`]
                        ] as const
                      ).map(([k, lbl]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setEventFilter(k)}
                          className={`px-1.5 py-0.5 rounded-md font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                            eventFilter === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="max-h-56 lg:max-h-[340px] mland:max-h-none mland:flex-1 mland:min-h-0 overflow-y-auto space-y-1 pr-0.5">
                    {eventFilter === 'sub' ? (
                      subLog.length === 0 ? (
                        <div className="text-xs text-[var(--mut)] py-6 text-center">ยังไม่มีการเปลี่ยนตัวในแมตช์นี้</div>
                      ) : (
                        subLog
                          .slice()
                          .reverse()
                          .map((sb, i) => {
                            const tObj = sb.t === homeOrig.id ? homeOrig : awayOrig;
                            return (
                              <div key={i} className="text-xs mland:text-[10.5px] flex items-start gap-2 py-1 px-1.5 rounded-lg bg-blue-500/8">
                                <span className="w-7 shrink-0 tabular font-bold text-blue-600 dark:text-blue-400">{sb.m}&apos;</span>
                                <div className="min-w-0">
                                  <span className="font-bold text-[var(--ink)]">{tObj.name}: </span>
                                  <span className="font-semibold text-[var(--g)]">🟢 {sb.inPlayer}</span>
                                  <span className="text-[var(--mut)]"> แทน </span>
                                  <span className="text-[var(--red)]">🔴 {sb.outPlayer}</span>
                                </div>
                              </div>
                            );
                          })
                      )
                    ) : (() => {
                      const filteredLogs = logs.filter((l) => {
                        if (eventFilter === 'goal') return l.tone === 'goal';
                        if (eventFilter === 'card') return l.tone === 'card' || l.text.includes('VAR') || l.text.includes('จุดโทษ');
                        return true;
                      });
                      if (!filteredLogs.length) {
                        return <div className="text-xs text-[var(--mut)] py-6 text-center">ยังไม่มีเหตุการณ์ในหมวดนี้</div>;
                      }
                      return filteredLogs.map((l, i) => (
                        <div
                          key={i}
                          className={`text-xs mland:text-[10.5px] flex items-start gap-2 rounded-lg transition-colors ${
                            l.tone === 'goal'
                              ? 'px-2 py-1 bg-[var(--g-soft)] border border-[var(--g)]/25 font-bold text-[var(--g)]'
                              : l.tone === 'card'
                                ? 'px-2 py-1 bg-[var(--red-soft)] border border-[var(--red)]/20 font-semibold text-[var(--red)]'
                                : l.tone === 'sub'
                                  ? 'px-2 py-0.5 bg-blue-500/8 font-semibold text-blue-600 dark:text-blue-400'
                                  : l.tone === 'sys'
                                    ? 'px-1 py-0.5 font-semibold text-[var(--ink)]'
                                    : 'px-1 py-0.5 text-[var(--mut)]'
                          }`}
                        >
                          <span className="w-7 shrink-0 tabular font-bold">{l.m}&apos;</span>
                          <span>{l.text}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Mobile Landscape Stats & Energy / Tactics Tab Content */}
                {mlandMatchTab !== 'events' && (
                  <div className="hidden mland:block mland:flex-1 mland:min-h-0 mland:overflow-y-auto pr-0.5 space-y-2">
                    {mlandMatchTab === 'stats' && (
                      <div className="space-y-2">
                        {renderMatchStatsPanel()}
                        {!done && renderLiveEnergyPanel()}
                      </div>
                    )}
                    {mlandMatchTab === 'tactics' && state.mode === 'm' && !done && renderLiveTacticsPanel()}
                  </div>
                )}

                {done && fullTimeAnalysis?.pf && (
                  <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[11px] shrink-0">
                    {fullTimeAnalysis.pf.played === false ? (
                      <span className="font-semibold text-[var(--mut)]">
                        {myInitialBanned ? '🟥 ไม่ได้ลงสนาม (ติดโทษแบน)' : '🪑 ตัวสำรองไม่ได้ถูกส่งลงสนาม (0 นาที)'}
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <span>ฟอร์มคุณ ({fullTimeAnalysis.pf.mins} น.): <b>⭐ {fullTimeAnalysis.pf.rt.toFixed(1)}</b> ·</span>
                          <span className="inline-flex items-center gap-0.5 tabular">
                            <StatIconBadge kind="goal" count={Math.max(1, fullTimeAnalysis.pf.gl)} size="sm" />
                            {fullTimeAnalysis.pf.gl <= 1 && <span>{fullTimeAnalysis.pf.gl}</span>}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5 tabular">
                            <StatIconBadge kind="assist" count={Math.max(1, fullTimeAnalysis.pf.as)} size="sm" />
                            {fullTimeAnalysis.pf.as <= 1 && <span>{fullTimeAnalysis.pf.as}</span>}
                          </span>
                          {fullTimeAnalysis.pf.subIn && <span className="inline-flex items-center gap-0.5">· <StatIconBadge kind="subIn" size="xs" /> สำรอง</span>}
                          {fullTimeAnalysis.pf.subOut && <span className="inline-flex items-center gap-0.5">· <StatIconBadge kind="subOut" size="xs" /> เปลี่ยนออก</span>}
                          {(fullTimeAnalysis.pf.yc || 0) > 0 && <StatIconBadge kind="yellow" count={fullTimeAnalysis.pf.yc} size="xs" />}
                          {(fullTimeAnalysis.pf.rc || 0) > 0 && <StatIconBadge kind="red" count={fullTimeAnalysis.pf.rc} size="xs" />}
                        </span>
                        {fullTimeAnalysis.pf.pts > 0 && (
                          <span className="font-bold text-[var(--g)]">+{fullTimeAnalysis.pf.pts} แต้มพัฒนา!</span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Manager Live Tactics & Substitutions Drawer (Desktop / Mobile Portrait) */}
          {state.mode === 'm' && showTacticsDrawer && !done && (
            <div className="mland:hidden">{renderLiveTacticsPanel()}</div>
          )}
        </div>

        {/* Pinned Bottom Match Action Dock */}
        <div className="shrink-0 px-3 sm:px-4 py-2 mland:px-2.5 mland:py-1 bg-[var(--surface-2)] border-t border-[var(--line)]">
          {!done ? (
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 mland:gap-1.5 flex-nowrap overflow-x-auto">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="min-h-[34px] mland:min-h-[30px] px-2.5 sm:px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0"
                >
                  {paused ? '▶ เล่นต่อ' : '⏸ พักเกม'}
                </button>
                <div className="inline-flex items-center p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)] shrink-0">
                  {([0.25, 0.5, 1, 2, 4] as const).map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => setSpeed(sp)}
                      className={`min-h-[28px] mland:min-h-[24px] px-1.5 sm:px-2 mland:px-1.5 py-0.5 rounded-lg mland:rounded-md text-xs mland:text-[10px] font-bold cursor-pointer tabular transition-colors whitespace-nowrap ${speed === sp ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRunVectors((v) => !v)}
                  className={`min-h-[34px] mland:min-h-[30px] px-2 sm:px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 ${showRunVectors ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/50 text-[#8a5b00] dark:text-[var(--lamp)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)]'}`}
                >
                  {showRunVectors ? '↗️ เส้น: เปิด' : '↗️ เส้น: ปิด'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPositions((v) => !v)}
                  className={`min-h-[34px] mland:min-h-[30px] px-2 sm:px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 ${showPositions ? 'bg-[var(--g-soft)] border-[var(--g)]/50 text-[var(--g)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)]'}`}
                >
                  {showPositions ? '🏷️ ตำแหน่ง: เปิด' : '🏷️ ตำแหน่ง: ปิด'}
                </button>
                <button
                  type="button"
                  onClick={() => setCineSlowMo((v) => !v)}
                  className={`min-h-[34px] mland:min-h-[30px] px-2 sm:px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 ${cineSlowMo ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/50 text-[#8a5b00] dark:text-[var(--lamp)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)]'}`}
                >
                  {cineSlowMo ? '🎬 สโลว์: เปิด' : '🎬 สโลว์: ปิด'}
                </button>
              </div>

              <div className="flex items-center gap-1.5 mland:gap-1 ml-auto shrink-0">
                {state.mode === 'm' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTacticsDrawer((v) => !v);
                      setMlandMatchTab((prev) => (prev === 'tactics' ? 'events' : 'tactics'));
                      setPaused(true);
                    }}
                    className="min-h-[34px] mland:min-h-[30px] px-2.5 sm:px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--g-soft)] border border-[var(--g)] text-[var(--g)] text-xs mland:text-[10px] font-bold cursor-pointer whitespace-nowrap"
                  >
                    🔄 แก้เกม ({subsUsed.length}/5)
                  </button>
                )}
                {matchPhaseUi === 'halftime' ? (
                  <button
                    type="button"
                    onClick={() => handleStartSecondHalf()}
                    className="min-h-[34px] mland:min-h-[30px] px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    ▶ เริ่มครึ่งหลัง
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={skipToEnd}
                    className="min-h-[34px] mland:min-h-[30px] px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--lamp)] text-[#261900] text-xs mland:text-[10px] font-bold cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    {matchPhaseUi === 'shootout' ? '⏩ ข้ามดวลจุดโทษ' : '⏩ ข้ามจบเกม'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConfirmFinish}
              className="w-full py-2.5 sm:py-3 mland:py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-sm mland:text-xs hover:brightness-105 cursor-pointer shadow-sm"
            >
              ✅ ดำเนินการต่อ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

