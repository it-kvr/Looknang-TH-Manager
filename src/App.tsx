import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OfflineIndicator, PWAUpdateBanner } from './pwa.tsx';
import {
  bindAutoLandscapeFullscreen,
  canLockLandscapeOrientation,
  enterAutoMobileFullscreen,
  enterLandscapeFullscreen,
  isMobileDevice,
  isPortraitViewport,
  restoreAutoFullscreenMigration
} from './utils/fullscreen';
import type { GameMode, MainTab, NavIntent, Player, Team, PlayerCareerProfile, MatchCardEvent, MatchResult, GameState, AppSettings, FinishedMatchPayload, MatchEnvironment, VarReplayRecord, ArchivedMatchReport, MatchHighlightClip, NationalTeamMatchRecord } from './types/game';
import { P, clamp, capMoney, fmtMoney } from './utils/math';
import { RN, TN, BASE, POS } from './data/thaiFootballData';
import { getSettings, saveSettings, applyTheme, SFX, triggerConfetti, unlockAudio } from './utils/audioTheme';
import { saveGameToSlot, assignTeamShirtNumbers, mkPlayer, ovMe, logFin, pushFeed, matchKits, pickGK, localizeForeignTeams, localizeDomesticThaiTeams } from './engine/playerCore';
import { simMatch, applyMatchResult, createNewGame, startSeason, tallyMatchPlayers, tallyCupMatchPlayers, applyPositionAdaptation, applyMatchCards, creditPlayerPerf, applyDilemmaChoice, pickWinner, afterMatchDay, growPlayers, finishSeasonComputation, simulateInstantMatchPayload, getIncomingOffers, recordFinanceSnapshot, getActiveBoardModifiers, getFacilityCondition, ensureTeamFans, adjustTeamFans, updateTeamsFanbaseOnMatch, FA_CUP_PRIZE, ASIA_CUP_PRIZE, EXTRA_CUP_META, ensureSeasonExtraCups, ensureAsia, ensureMarketTopForeigners, resolveTicketPlan, calcHomeTicketRevenue, calcMainSponsorPayout, getActivePartnerDeals, simulateHomeMegastoreMatchSales, applyLiveStreamMatchSettlement, sortTable } from './engine/simulation';
import { resolveStateSponsorBrand } from './data/sponsorBrands';
import { applyNationalMatchOutcomeToDraft, buildNationalVirtualMatchState, ensureManagerHistoryInitialized, recordManagerClubMatchResult, refreshNationalCampaignOnNewSeason, switchManagerClub, syncActiveStintTrophy } from './engine/managerCareer';
import { applyMatchMissionProgress, applyAiClubMatchMissions } from './engine/missions';
import { appendPlayerCareerLog } from './engine/history';
import { formatPersonalityShiftFeed, getActiveFavBoost, getTeamFavoritePlayers, updateTeamWellbeingAfterMatchday, type MatchdayWellbeingCtx } from './engine/wellbeing';
import { AppEntrySplash, AppToast, AppTopHud, AppNavDock, PortraitRotateNotice, type NextMatchDescriptor } from './components/AppShellSections';
import { MainMenu } from './views/MainMenuView';
import { LeagueView } from './views/LeagueView';
import { SquadTacticsView } from './views/SquadTacticsView';
import { TeamTrainingView } from './views/TeamTrainingView';
import { MarketView } from './views/MarketView';
import { FinanceClubView } from './views/FinanceClubView';
import { PlayerCareerView } from './views/PlayerCareerView';
import { PlayerClubTransferView } from './views/PlayerClubTransferView';
import { MatchModal } from './modals/MatchModal';
import { PreMatchModal } from './modals/PreMatchModal';
import { PlayerInspectorModal, TeamInspectorModal } from './modals/InspectorModals';
import type { SeasonSummaryData } from './modals/SeasonEndModal';
import { SeasonEndModal } from './modals/SeasonEndModal';
import { SeasonStatsModal } from './modals/SeasonStatsModal';
import { DilemmaModal } from './modals/DilemmaModal';
import { SecretBoostModal } from './modals/SecretBoostModal';
import { GodBlessingModal } from './modals/GodBlessingModal';
import { SettingsModal } from './modals/SettingsModal';
import { VarReplayModal } from './modals/VarReplayModal';
import { MatchHighlightModal } from './modals/MatchHighlightModal';
import { PostMatchReportModal } from './modals/PostMatchReportModal';
import { ManagerCareerModal } from './modals/ManagerCareerModal';

export default function App() {
  const [enteredGame, setEnteredGame] = useState(false);
  const [isPortrait, setIsPortrait] = useState(() => isPortraitViewport());
  const [portraitSwitchFailed, setPortraitSwitchFailed] = useState(false);
  const enteringLandscapeRef = useRef(false);
  const canAutoSwitchLandscape = useMemo(() => canLockLandscapeOrientation(), []);
  const [state, setState] = useState<GameState | null>(null);
  const [slot, setSlot] = useState<number>(1);
  const [saveEpoch, setSaveEpoch] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const [inspectPlayer, setInspectPlayer] = useState<{ player: Player; team: Team | null; initialTab?: 'info' | 'history' | 'missions' } | null>(null);
  const [inspectTeamId, setInspectTeamId] = useState<number | null>(null);
  const [preMatch, setPreMatch] = useState<{ kind: 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc'; homeId: number; awayId: number; isDerby: boolean } | null>(null);
  const [activeMatch, setActiveMatch] = useState<{ kind: 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc'; homeId: number; awayId: number; isDerby: boolean; matchEnv?: MatchEnvironment } | null>(null);
  const [seasonSummary, setSeasonSummary] = useState<SeasonSummaryData | null>(null);
  const [seasonStatsTarget, setSeasonStatsTarget] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSecretBoost, setShowSecretBoost] = useState(false);
  const [showGodBlessing, setShowGodBlessing] = useState(false);
  const [showDilemmaModal, setShowDilemmaModal] = useState(false);
  const [vipAuthorized, setVipAuthorized] = useState(false);
  const [managerCareerModal, setManagerCareerModal] = useState<'career' | 'nt' | null>(null);
  const [ntPreMatchFixture, setNtPreMatchFixture] = useState<NationalTeamMatchRecord | null>(null);
  const [ntActiveMatch, setNtActiveMatch] = useState<{
    fixture: NationalTeamMatchRecord;
    virtual: ReturnType<typeof buildNationalVirtualMatchState>;
    matchEnv?: MatchEnvironment;
  } | null>(null);
  const [ntReportModal, setNtReportModal] = useState<{
    report: ArchivedMatchReport;
    title: string;
    virtualState: GameState;
  } | null>(null);
  const [historyVarModal, setHistoryVarModal] = useState<{
    homeId: number;
    awayId: number;
    records: VarReplayRecord[];
    activeId: string;
    virtualState?: GameState;
  } | null>(null);
  const [historyHighlightModal, setHistoryHighlightModal] = useState<{
    homeId: number;
    awayId: number;
    clips: MatchHighlightClip[];
    activeId?: string;
    title?: string;
    scoreSummary?: string;
    virtualState?: GameState;
  } | null>(null);
  const [matchReportModal, setMatchReportModal] = useState<{
    report: ArchivedMatchReport;
    title?: string;
  } | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    restoreAutoFullscreenMigration();
    return getSettings();
  });
  const [navResetSeq, setNavResetSeq] = useState(0);
  const [navIntent, setNavIntent] = useState<NavIntent | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const appSettingsRef = useRef(appSettings);
  appSettingsRef.current = appSettings;
  const vipAuthorizedRef = useRef(vipAuthorized);
  vipAuthorizedRef.current = vipAuthorized;
  const activeMatchRef = useRef(activeMatch);
  activeMatchRef.current = activeMatch;
  const ntActiveMatchRef = useRef(ntActiveMatch);
  ntActiveMatchRef.current = ntActiveMatch;

  const updateAppSettings = useCallback((patch: Partial<AppSettings>) => {
    setAppSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const unbindFs = bindAutoLandscapeFullscreen();
    const syncOrientationState = () => {
      const portrait = isPortraitViewport();
      setIsPortrait(portrait);
      if (!portrait) {
        setPortraitSwitchFailed(false);
      }
    };
    const scrOri = (screen as Screen & { orientation?: EventTarget }).orientation;
    window.addEventListener('resize', syncOrientationState, { passive: true });
    window.addEventListener('orientationchange', syncOrientationState, { passive: true });
    scrOri?.addEventListener?.('change', syncOrientationState);
    syncOrientationState();
    return () => {
      window.removeEventListener('resize', syncOrientationState);
      window.removeEventListener('orientationchange', syncOrientationState);
      scrOri?.removeEventListener?.('change', syncOrientationState);
      unbindFs();
    };
  }, []);

  const mainRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const cloneGameState = (prev: GameState): GameState => {
    try {
      if (typeof structuredClone === 'function') return structuredClone(prev);
    } catch {
      // fallback to JSON clone
    }
    return JSON.parse(JSON.stringify(prev)) as GameState;
  };

  useEffect(() => {
    const st = getSettings();
    applyTheme(st.theme);
  }, []);

  const pendingSaveRef = useRef<{ state: GameState; slot: number } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const skipNextSaveRef = useRef(false);

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending) {
      pendingSaveRef.current = null;
      saveGameToSlot(pending.state, pending.slot);
    }
  }, []);

  const navigateShallow = useCallback((patcher: (prev: GameState) => Partial<GameState>) => {
    skipNextSaveRef.current = true;
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, ...patcher(prev) };
    });
  }, []);

  const navigateToTab = useCallback((tab: MainTab, sub?: string, focus?: string, hint?: string) => {
    const isTalkRedirect =
      (tab === 'u' && sub === 'rooms') ||
      focus === 'team-talk' ||
      Boolean(focus?.startsWith('talk:'));
    const resolvedTab: MainTab = isTalkRedirect ? 'r' : tab === 'f' && sub === 'infra' ? 'u' : tab;
    const resolvedSub = isTalkRedirect ? 'rooms' : sub;
    setNavIntent({ tab: resolvedTab, sub: resolvedSub, focus, hint, ts: Date.now() });
    setNavResetSeq((n) => n + 1);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    navigateShallow((d) => {
      if (resolvedTab === 'c') {
        return { v: 't', tv: 4, sub: 0 };
      }
      if (resolvedTab === 'q' && resolvedSub === 'training') {
        return { v: 'r', tv: 0, sub: 0 };
      }
      if (resolvedTab === 'f' && resolvedSub === 'infra') {
        return { v: 'u', tv: 0, sub: 0 };
      }
      return {
        v: resolvedTab,
        tv: resolvedTab === 't' ? (resolvedSub === 'cup' ? 4 : resolvedSub === 'awards' ? 2 : 0) : 0,
        sub: resolvedTab === 'q' ? (resolvedSub === 'tactics' ? 1 : resolvedSub === 'squad' ? 2 : resolvedSub === 'locker' ? 3 : 0) : 0,
        ...(resolvedTab === 't' ? { lg: d.teams[d.me].tier } : {})
      };
    });
  }, [navigateShallow]);

  useEffect(() => {
    if (!state) {
      pendingSaveRef.current = null;
      skipNextSaveRef.current = false;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    pendingSaveRef.current = { state, slot };
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const runSave = () => {
        const pending = pendingSaveRef.current;
        if (pending) {
          pendingSaveRef.current = null;
          saveGameToSlot(pending.state, pending.slot);
        }
      };
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      if (typeof ric === 'function') ric(runSave, { timeout: 1200 });
      else runSave();
    }, 650);
  }, [state, slot]);

  useEffect(() => {
    const onHide = () => flushPendingSave();
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      flushPendingSave();
    };
  }, []);

  const updateState = useCallback((updater: (draft: GameState) => void) => {
    skipNextSaveRef.current = false;
    setState((prev) => {
      if (!prev) return prev;
      const clone = cloneGameState(prev);
      updater(clone);
      clone.money = capMoney(clone.money);
      return clone;
    });
  }, []);

  const handleStartManager = useCallback((targetSlot: number, names: string[][], t0: Team[], pick: number, diff: number) => {
    unlockAudio();
    enterAutoMobileFullscreen().catch(() => undefined);
    const fresh = createNewGame('m', { names, t0, pick });
    fresh.diff = diff;
    fresh.v = 't';
    fresh.tv = 0;
    fresh.sub = 0;
    fresh.lg = fresh.teams[fresh.me]?.tier ?? 0;
    setNavIntent(null);
    setNavResetSeq((n) => n + 1);
    setShowDilemmaModal(false);
    setSaveEpoch((n) => n + 1);
    setSlot(targetSlot);
    setState(fresh);
    saveGameToSlot(fresh, targetSlot);
    const grant = fresh.initialBoardGrant;
    showToast(
      grant
        ? `รับตำแหน่งผู้จัดการ ${fresh.teams[fresh.me].name}! บอร์ดมอบโบนัสแรกเข้า +${fmtMoney(grant.amount)} (ระดับ${grant.levelLabel}) · งบรวม ${fmtMoney(fresh.money)}`
        : `รับตำแหน่งผู้จัดการทีม ${fresh.teams[fresh.me].name} แล้ว!`
    );
  }, [showToast]);

  const handleStartPlayer = useCallback((
    targetSlot: number,
    profile: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'> & { age?: number; diff?: number }
  ) => {
    unlockAudio();
    enterAutoMobileFullscreen().catch(() => undefined);
    const { diff: playerDiff, ...playerProfile } = profile;
    const fresh = createNewGame('p', { player: playerProfile, diff: playerDiff });
    fresh.v = 't';
    fresh.tv = 0;
    fresh.sub = 0;
    fresh.lg = fresh.teams[fresh.me]?.tier ?? 0;
    setNavIntent(null);
    setNavResetSeq((n) => n + 1);
    setShowDilemmaModal(false);
    setSaveEpoch((n) => n + 1);
    setSlot(targetSlot);
    setState(fresh);
    saveGameToSlot(fresh, targetSlot);
    showToast(`เซ็นสัญญาเริ่มต้นกับ ${fresh.teams[fresh.me].name} แล้ว!`);
  }, [showToast]);

  const handleLoadSave = useCallback((_mode: GameMode, targetSlot: number, loaded: GameState) => {
    unlockAudio();
    enterAutoMobileFullscreen().catch(() => undefined);
    flushPendingSave();
    const currentTier = loaded.teams?.[loaded.me]?.tier ?? 0;
    const normalized: GameState = { ...loaded, v: 't', tv: 0, sub: 0, lg: currentTier, money: capMoney(loaded.money) };
    ensureAsia(normalized);
    localizeForeignTeams(normalized.teams);
    localizeDomesticThaiTeams(normalized.teams, normalized);
    ensureSeasonExtraCups(normalized);
    if (normalized.mode === 'm') {
      ensureMarketTopForeigners(normalized);
    }
    setPreMatch(null);
    setActiveMatch(null);
    setShowDilemmaModal(false);
    setNavIntent(null);
    setNavResetSeq((n) => n + 1);
    setSaveEpoch((n) => n + 1);
    setSlot(targetSlot);
    setState(normalized);
    saveGameToSlot(normalized, targetSlot);
    showToast('โหลดเซฟเรียบร้อย');
  }, [flushPendingSave, showToast]);

  const nextMatchInfo = useMemo<NextMatchDescriptor | null>(() => {
    if (!state) return null;
    if (state.pa && state.ac && state.ac.alive && !state.ac.done) {
      const idx = state.ac.ids.indexOf(state.me);
      if (idx >= 0) {
        const pairIdx = Math.floor(idx / 2) * 2;
        return { kind: 'asia' as const, homeId: state.ac.ids[pairIdx], awayId: state.ac.ids[pairIdx + 1], isDerby: false };
      }
    }
    if (state.psc && state.sc && state.sc.alive && !state.sc.done) {
      const idx = state.sc.ids.indexOf(state.me);
      if (idx >= 0) {
        const pairIdx = Math.floor(idx / 2) * 2;
        return { kind: 'sc' as const, homeId: state.sc.ids[pairIdx], awayId: state.sc.ids[pairIdx + 1], isDerby: false };
      }
    }
    if (state.plc && state.lc && state.lc.alive && !state.lc.done) {
      const idx = state.lc.ids.indexOf(state.me);
      if (idx >= 0) {
        const pairIdx = Math.floor(idx / 2) * 2;
        return { kind: 'lc' as const, homeId: state.lc.ids[pairIdx], awayId: state.lc.ids[pairIdx + 1], isDerby: false };
      }
    }
    if (state.pdc && state.dc && state.dc.alive && !state.dc.done) {
      const idx = state.dc.ids.indexOf(state.me);
      if (idx >= 0) {
        const pairIdx = Math.floor(idx / 2) * 2;
        return { kind: 'dc' as const, homeId: state.dc.ids[pairIdx], awayId: state.dc.ids[pairIdx + 1], isDerby: false };
      }
    }
    if (state.pc && state.cup && state.cup.alive && !state.cup.done) {
      const idx = state.cup.ids.indexOf(state.me);
      if (idx >= 0) {
        const pairIdx = Math.floor(idx / 2) * 2;
        return { kind: 'cup' as const, homeId: state.cup.ids[pairIdx], awayId: state.cup.ids[pairIdx + 1], isDerby: false };
      }
    }
    if (state.md < state.fx.length) {
      const pair = state.fx[state.md].find((p) => p.includes(state.me));
      if (pair) {
        return { kind: 'league' as const, homeId: pair[0], awayId: pair[1], isDerby: (pair[0] ^ 1) === pair[1] };
      }
    }
    return null;
  }, [state?.pa, state?.ac, state?.psc, state?.sc, state?.plc, state?.lc, state?.pdc, state?.dc, state?.pc, state?.cup, state?.md, state?.fx, state?.me]);
  const nextMatchInfoRef = useRef(nextMatchInfo);
  nextMatchInfoRef.current = nextMatchInfo;

  const myLeagueRank = useMemo(() => {
    if (!state) return 1;
    const myTier = state.teams[state.me]?.tier ?? 0;
    const sorted = sortTable(state.teams.filter((t) => t.tier === myTier));
    const idx = sorted.findIndex((t) => t.id === state.me);
    return idx >= 0 ? idx + 1 : 1;
  }, [state?.teams, state?.me]);

  const incomingMarketBadgeCount = useMemo(() => {
    if (!state || state.mode !== 'm') return 0;
    return getIncomingOffers(state).length + (state.scout?.results ? 1 : 0);
  }, [state?.mode, state?.teams, state?.me, state?.offers, state?.off, state?.scout]);

  const ntPreMatchVirtual = useMemo(() => {
    if (!state || !ntPreMatchFixture || !state.natTeam?.active) return null;
    return buildNationalVirtualMatchState(state, ntPreMatchFixture);
  }, [state, ntPreMatchFixture]);

  const applyFinishedMatchToDraft = (
    d: GameState,
    matchInfo: { kind: 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc'; homeId: number; awayId: number; isDerby: boolean },
    payload: FinishedMatchPayload
  ): { shouldConfetti: boolean; missionToast: string | null; talentToast: string | null; personalityToast: string | null } => {
    const { kind, homeId, awayId, isDerby } = matchInfo;
    let shouldConfetti = false;
    let missionToast: string | null = null;
    let talentToast: string | null = null;
    let personalityToast: string | null = null;

    const me = d.teams[d.me];
    if (d.mode === 'm') {
      me.tac = payload.finalTac;
    }

    const H = d.teams[homeId];
    const A = d.teams[awayId];
    const opp = homeId === d.me ? A : H;
    const resObj: MatchResult = {
      gh: payload.gh,
      ga: payload.ga,
      evs: payload.evs,
      pen: payload.pen,
      xgH: payload.xgH,
      xgA: payload.xgA,
      ratings: payload.ratings,
      motm: payload.motm,
      pf: payload.pf,
      cards: payload.cards,
      subs: payload.subs,
      playedNames: payload.playedNames,
      playedSlots: payload.playedSlots
    };
    if (d.mode === 'p' && d.p && payload.pf?.played && payload.pf.rt > 0) {
      resObj.ratings = { ...(resObj.ratings || {}), [d.p.name]: payload.pf.rt };
    }

    const subbedOutByTeam: Record<number, Record<string, number>> = {};
    const recordSubOut = (teamId: number, outName: string, min: number) => {
      if (!subbedOutByTeam[teamId]) subbedOutByTeam[teamId] = {};
      if (subbedOutByTeam[teamId][outName] == null || min < subbedOutByTeam[teamId][outName]) {
        subbedOutByTeam[teamId][outName] = min;
      }
    };
    payload.subs.forEach((sb) => recordSubOut(sb.t, sb.outPlayer, sb.m));

    const ownGoalsByTeam = new Map<number, string[]>();
    (payload.evs || []).forEach((ev) => {
      if (ev.og && ev.who) {
        const arr = ownGoalsByTeam.get(ev.t) || [];
        arr.push(ev.who);
        ownGoalsByTeam.set(ev.t, arr);
      }
    });

    const buildUserSideWellbeingCtx = (
      team: Team,
      gf: number,
      ga: number,
      isBigMatch = false
    ): MatchdayWellbeingCtx => ({
      matchPlayed: true,
      matchResult: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
      goalDiff: gf - ga,
      isBigMatch,
      matchEnv: payload.matchEnv,
      ratings: resObj.ratings || payload.ratings,
      playedNames: payload.playedNames?.[team.id],
      motm: payload.motm,
      cards: payload.cards,
      ownGoalNames: ownGoalsByTeam.get(team.id),
      subbedOut: subbedOutByTeam[team.id],
      isUserClub: team.id === d.me
    });

    const buildSimWellbeingCtx = (
      team: Team,
      gf: number,
      ga: number,
      r: MatchResult,
      isBigMatch = false
    ): MatchdayWellbeingCtx => ({
      matchPlayed: true,
      matchResult: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
      goalDiff: gf - ga,
      isBigMatch,
      ratings: r.ratings,
      playedNames: r.playedNames?.[team.id],
      motm: r.motm,
      cards: r.cards,
      ownGoalNames: (r.evs || []).filter((e) => e.og && e.t === team.id).map((e) => e.who),
      subbedOut: subbedOutByTeam[team.id],
      isUserClub: team.id === d.me
    });

    const syncCupParticipantWellbeing = (participants: { team: Team; ctx: MatchdayWellbeingCtx }[]) => {
      const prevFavBoostMap = new Map(
        getTeamFavoritePlayers(me).map((fp) => [fp.n, getActiveFavBoost(fp, me, fp.me ? d.p : null)])
      );
      participants.forEach(({ team, ctx }) => {
        const shifts = updateTeamWellbeingAfterMatchday(team, d, ctx);
        shifts.forEach((ev) => {
          if (ev.isUserClub || ev.isMe) {
            const msg = formatPersonalityShiftFeed(ev);
            pushFeed(d, 'พัฒนาบุคลิก', msg, ev.isPositive ? 'ok' : 'urg');
            if (!personalityToast) personalityToast = msg;
          }
        });
      });
      const curFavs = getTeamFavoritePlayers(me);
      if (curFavs.length > 0) {
        const boostedNow: { name: string; boost: number }[] = [];
        const droppedNow: string[] = [];
        curFavs.forEach((favPl) => {
          const nextBoost = getActiveFavBoost(favPl, me, favPl.me ? d.p : null);
          if (nextBoost > 0) {
            boostedNow.push({ name: favPl.n, boost: nextBoost });
          } else if ((prevFavBoostMap.get(favPl.n) || 0) > 0) {
            droppedNow.push(favPl.n);
          }
        });
        if (boostedNow.length === 1) {
          pushFeed(
            d,
            'ลูกรักโค้ช',
            `💖 ${boostedNow[0].name} สุขภาพใจ/กายดีเยี่ยม! รับพลังเสริมชั่วคราว +${boostedNow[0].boost} OVR นัดถัดไป`,
            'ok'
          );
        } else if (boostedNow.length > 1) {
          const summary = boostedNow.map((x) => `${x.name.split(' ')[0]} +${x.boost}`).join(', ');
          pushFeed(
            d,
            'ลูกรักโค้ช',
            `💖 ลูกรัก ${boostedNow.length} คนพร้อมปลุกพลัง! (${summary} OVR นัดถัดไป)`,
            'ok'
          );
        }
        if (droppedNow.length === 1) {
          pushFeed(
            d,
            'ลูกรักโค้ช',
            `⚠️ ${droppedNow[0]} สุขภาพจิตใจหรือร่างกายยังไม่ถึงเกณฑ์ โบนัสลูกรักชั่วคราวหมดลงแล้ว`,
            'urg'
          );
        } else if (droppedNow.length > 1) {
          const dropNames = droppedNow.map((n) => n.split(' ')[0]).join(', ');
          pushFeed(
            d,
            'ลูกรักโค้ช',
            `⚠️ ลูกรัก ${droppedNow.length} คน (${dropNames}) สุขภาพยังไม่ถึงเกณฑ์ โบนัสชั่วคราวหมดลงแล้ว`,
            'urg'
          );
        }
      }
    };

    const liveInjs = payload.injuries || [];
    const liveInjTeamIds = Array.from(new Set(liveInjs.map((x) => x.teamId)));
    const liveInjNames = liveInjs.map((x) => x.name);
    const applyLiveInjuries = () => {
      liveInjs.forEach((inj) => {
        const teamObj = d.teams[inj.teamId];
        const pl = teamObj?.sq.find((q) => q.n === inj.name);
        if (!teamObj || !pl) return;
        pl.inj = Math.max(pl.inj || 0, inj.games);
        if (pl.me && d.p) d.p.inj = pl.inj;
        if (teamObj.id === d.me || d.p?.name === pl.n) {
          pushFeed(d, 'บาดเจ็บในสนาม', `✚ ${pl.n} (${teamObj.name}) บาดเจ็บระหว่างแข่ง คาดพัก ${inj.games} นัด`, 'urg');
        }
      });
    };

    const recordMatchMissions = () => {
      const mSum = applyMatchMissionProgress(d, H, A, payload);
      if (mSum.upgraded.length > 0) {
        const first = mSum.upgraded[0];
        const msg =
          mSum.upgraded.length === 1
            ? `🎯 ${first.player} ผ่านภารกิจ "${first.mission} ขั้น ${first.stage}" อัปพลังอัตโนมัติ! (${first.rewardText})`
            : `🎯 ภารกิจหลังเกมอัปพลังสำเร็จ ${mSum.upgraded.length} รายการ (เช่น ${first.player}: ${first.mission} ขั้น ${first.stage})`;
        pushFeed(d, 'ภารกิจอัปพลัง', msg, 'ok');
        missionToast = msg;
      }
      if (mSum.failed.length > 0) {
        const firstF = mSum.failed[0];
        pushFeed(
          d,
          'ภารกิจส่วนบุคคล',
          mSum.failed.length === 1
            ? `💨 ${firstF.player} พลาดอัปพลัง "${firstF.mission} ขั้น ${firstF.stage}" (โอกาส ${firstF.chance}% รอบนี้ไม่สำเร็จ)`
            : `💨 มี ${mSum.failed.length} รายการพลาดลุ้นอัปขั้นภารกิจหลังจบเกม (ติดเกณฑ์พรสวรรค์)`,
          ''
        );
      }
    };

      const recordHomeAttendance = () => {
        if (homeId !== d.me || !payload.att || payload.att <= 0) return;
        d.records = d.records || {};
        if (payload.att > (d.records.highestAttendance?.att || 0)) {
          d.records.highestAttendance = {
            att: payload.att,
            cap: payload.cap || payload.att,
            txt: `ซ.${d.season} พบ ${A.name}`,
            opp: A.name,
            s: d.season,
            kind
          };
        }
      };
      recordHomeAttendance();

      const buildArchivedReport = (
        reportKind: ArchivedMatchReport['kind'],
        roundLabel?: string
      ): ArchivedMatchReport => ({
        kind: reportKind,
        ...(roundLabel ? { roundLabel } : {}),
        h: homeId,
        a: awayId,
        gh: payload.gh,
        ga: payload.ga,
        ...(payload.pen !== undefined ? { pen: payload.pen } : {}),
        ...(payload.penText ? { penText: payload.penText } : {}),
        ...(payload.shootout ? { shootout: payload.shootout } : {}),
        xgH: payload.xgH,
        xgA: payload.xgA,
        ...(payload.possH !== undefined ? { possH: payload.possH } : {}),
        ...(payload.shotsH !== undefined ? { shotsH: payload.shotsH } : {}),
        ...(payload.shotsA !== undefined ? { shotsA: payload.shotsA } : {}),
        ...(payload.onTargetH !== undefined ? { onTargetH: payload.onTargetH } : {}),
        ...(payload.onTargetA !== undefined ? { onTargetA: payload.onTargetA } : {}),
        ...(payload.passesH !== undefined ? { passesH: payload.passesH } : {}),
        ...(payload.passesA !== undefined ? { passesA: payload.passesA } : {}),
        ...(payload.cornersH !== undefined ? { cornersH: payload.cornersH } : {}),
        ...(payload.cornersA !== undefined ? { cornersA: payload.cornersA } : {}),
        ...(payload.foulsH !== undefined ? { foulsH: payload.foulsH } : {}),
        ...(payload.foulsA !== undefined ? { foulsA: payload.foulsA } : {}),
        ...(payload.offsidesH !== undefined ? { offsidesH: payload.offsidesH } : {}),
        ...(payload.offsidesA !== undefined ? { offsidesA: payload.offsidesA } : {}),
        ...(payload.savesH !== undefined ? { savesH: payload.savesH } : {}),
        ...(payload.savesA !== undefined ? { savesA: payload.savesA } : {}),
        ...(payload.playerSaves ? { playerSaves: payload.playerSaves } : {}),
        ...(payload.att !== undefined ? { att: payload.att } : {}),
        ...(payload.cap !== undefined ? { cap: payload.cap } : {}),
        ...(payload.streamViewers !== undefined ? { streamViewers: payload.streamViewers } : {}),
        ...(payload.streamPeakViewers !== undefined ? { streamPeakViewers: payload.streamPeakViewers } : {}),
        ...(payload.streamComments?.length ? { streamComments: payload.streamComments } : {}),
        motm: payload.motm,
        ratings: resObj.ratings || payload.ratings,
        ...(payload.pf ? { pf: payload.pf } : {}),
        evs: payload.evs,
        cards: payload.cards,
        subs: payload.subs,
        playedNames: payload.playedNames,
        ...(payload.xiNames ? { xiNames: payload.xiNames } : {}),
        ...(payload.playedSlots ? { playedSlots: payload.playedSlots } : {}),
        ...(payload.injuries?.length ? { injuries: payload.injuries } : {}),
        ...(payload.captains ? { captains: payload.captains } : {}),
        ...(payload.formations ? { formations: payload.formations } : {}),
        ...(payload.matchEnv ? { matchEnv: payload.matchEnv } : {}),
        ...(payload.timeline?.length ? { timeline: payload.timeline } : {}),
        ...(payload.logs?.length ? { logs: payload.logs } : {}),
        ...(payload.varReplays?.length ? { varReplays: payload.varReplays } : {}),
        ...(payload.highlightClips?.length ? { highlightClips: payload.highlightClips } : {})
      });

      if (kind === 'cup') {
        const c = d.cup;
        const roundBefore = c.r;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        const cupWellbeing: { team: Team; ctx: MatchdayWellbeingCtx }[] = [];
        for (let i = 0; i < c.ids.length; i += 2) {
          const ch = d.teams[c.ids[i]];
          const ca = d.teams[c.ids[i + 1]];
          const big = c.ids.length <= 4;
          if (ch.id === homeId && ca.id === awayId) {
            nx[i / 2] = userWin.id;
            tallyCupMatchPlayers('cup', ch, ca, resObj);
            updateTeamsFanbaseOnMatch(ch, payload.gh, ca, payload.ga, { kind: 'cup', big });
            c.log.push(`${RN[c.r]}: ${ch.name} ${payload.gh}-${payload.ga} ${ca.name}${payload.penText ? ` (${payload.penText})` : ''}`);
            cupWellbeing.push({ team: ch, ctx: buildUserSideWellbeingCtx(ch, payload.gh, payload.ga, big) });
            cupWellbeing.push({ team: ca, ctx: buildUserSideWellbeingCtx(ca, payload.ga, payload.gh, big) });
          } else {
            const cr = simMatch(ch, ca, d);
            const cw = pickWinner(ch, ca, cr, d);
            nx[i / 2] = cw.id;
            tallyCupMatchPlayers('cup', ch, ca, cr);
            updateTeamsFanbaseOnMatch(ch, cr.gh, ca, cr.ga, { kind: 'cup', big });
            c.log.push(`${RN[c.r]}: ${ch.name} ${cr.gh}-${cr.ga} ${ca.name}`);
            applyPositionAdaptation(d, ch, ca, cr);
            applyAiClubMatchMissions(d, ch, ca, cr);
            cr.subs?.forEach((sb) => recordSubOut(sb.t, sb.outPlayer, sb.m));
            cupWellbeing.push({ team: ch, ctx: buildSimWellbeingCtx(ch, cr.gh, cr.ga, cr, big) });
            cupWellbeing.push({ team: ca, ctx: buildSimWellbeingCtx(ca, cr.ga, cr.gh, cr, big) });
          }
        }
        d.cupLog = d.cupLog || [];
        d.cupLog.push({
          md: d.md,
          comp: 'cup',
          r: roundBefore,
          ...buildArchivedReport('cup', RN[roundBefore] || `รอบ ${roundBefore + 1}`)
        });
        c.ids = nx;
        c.r++;
        d.pc = false;
        if (!nx.includes(d.me)) {
          c.alive = false;
          d.news = `🏆 ตกรอบถ้วยประชาชน (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, 'บอลถ้วย', d.news, 'urg');
        } else {
          d.news = `🏆 ผ่านเข้ารอบถ้วยประชาชน! (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, 'บอลถ้วย', d.news, 'ok');
        }
        if (nx.length === 1) {
          c.done = true;
          const winTeam = d.teams[nx[0]];
          if (winTeam) {
            winTeam.trophies = winTeam.trophies || [];
            if (!winTeam.trophies.some((tr) => tr.season === d.season && tr.type === 'cup')) {
              winTeam.trophies.push({ season: d.season, title: 'แชมป์ถ้วยประชาชน', type: 'cup' });
            }
            adjustTeamFans(winTeam, Math.round(ensureTeamFans(winTeam) * 0.1));
          }
          if (nx[0] === d.me) {
            d.trophies = d.trophies || [];
            if (!d.trophies.some((tr) => tr.season === d.season && tr.type === 'cup')) {
              d.trophies.push({ season: d.season, title: 'แชมป์ถ้วยประชาชน', type: 'cup' });
            }
            if (d.mode === 'm') {
              d.money += FA_CUP_PRIZE;
              logFin(d, 'รางวัลแชมป์ถ้วยประชาชน', FA_CUP_PRIZE);
              d.mgrRep = (d.mgrRep || 50) + 75;
            } else if (d.p) {
              const meSq = me.sq.find((q) => q.me);
              appendPlayerCareerLog(meSq, `🏆 ซีซั่น ${d.season}: คว้าแชมป์ถ้วยประชาชนกับ ${me.name}`, d.p);
            }
            shouldConfetti = true;
          }
        }
        applyLiveInjuries();
        me.sq.forEach((q) => {
          if ((q.sus || 0) > 0) q.sus = q.sus! - 1;
          if ((q.inj || 0) > 0 && !liveInjNames.includes(q.n)) q.inj = Math.max(0, q.inj - 1);
          if (q.me && d.p) {
            d.p.sus = q.sus || 0;
            d.p.inj = q.inj || 0;
          }
        });
        applyMatchCards(d, H, A, payload.cards);
        applyPositionAdaptation(d, H, A, resObj);
        if (d.mode === 'm') {
          if (homeId === d.me) {
            const cupTicket = calcHomeTicketRevenue(d, me, { ignorePromo: true });
            if (cupTicket > 0) {
              d.money += cupTicket;
              logFin(d, `ค่าตั๋วเข้าชมเกมเหย้าบอลถ้วย (${resolveTicketPlan(d).label})`, cupTicket);
            }
          }
          applyLiveStreamMatchSettlement(d, me, opp, {
            kind: 'cup',
            isHome: homeId === d.me,
            isDerby,
            myGoals: homeId === d.me ? payload.gh : payload.ga,
            oppGoals: homeId === d.me ? payload.ga : payload.gh,
            viewers: payload.streamViewers,
            peakViewers: payload.streamPeakViewers
          });
        }
        if (d.mode === 'p' && payload.pf) {
          const perfOut = creditPlayerPerf(d, payload.pf);
          if (perfOut?.talentToast) talentToast = perfOut.talentToast;
        }
        syncCupParticipantWellbeing(cupWellbeing);
        recordMatchMissions();
        return { shouldConfetti, missionToast, talentToast, personalityToast };
      }

      if (kind === 'lc' || kind === 'sc' || kind === 'dc') {
        ensureSeasonExtraCups(d);
        const c = kind === 'lc' ? d.lc! : kind === 'sc' ? d.sc! : d.dc!;
        const meta = EXTRA_CUP_META[kind];
        const roundBefore = c.r;
        const roundLabel = kind === 'sc' ? 'ชิงชนะเลิศ' : RN[c.r] || `รอบ ${c.r + 1}`;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        const extraWellbeing: { team: Team; ctx: MatchdayWellbeingCtx }[] = [];
        for (let i = 0; i < c.ids.length; i += 2) {
          const ch = d.teams[c.ids[i]];
          const ca = d.teams[c.ids[i + 1]];
          if (!ch || !ca) {
            if (ch) nx.push(ch.id);
            else if (ca) nx.push(ca.id);
            continue;
          }
          const big = c.ids.length <= 4;
          if (ch.id === homeId && ca.id === awayId) {
            nx.push(userWin.id);
            tallyCupMatchPlayers(kind, ch, ca, resObj);
            updateTeamsFanbaseOnMatch(ch, payload.gh, ca, payload.ga, { kind, big });
            c.log.push(`${roundLabel}: ${ch.name} ${payload.gh}-${payload.ga} ${ca.name}${payload.penText ? ` (${payload.penText})` : ''}`);
            extraWellbeing.push({ team: ch, ctx: buildUserSideWellbeingCtx(ch, payload.gh, payload.ga, big) });
            extraWellbeing.push({ team: ca, ctx: buildUserSideWellbeingCtx(ca, payload.ga, payload.gh, big) });
          } else {
            const cr = simMatch(ch, ca, d);
            const cw = pickWinner(ch, ca, cr, d);
            nx.push(cw.id);
            tallyCupMatchPlayers(kind, ch, ca, cr);
            updateTeamsFanbaseOnMatch(ch, cr.gh, ca, cr.ga, { kind, big });
            c.log.push(`${roundLabel}: ${ch.name} ${cr.gh}-${cr.ga} ${ca.name}`);
            applyPositionAdaptation(d, ch, ca, cr);
            applyAiClubMatchMissions(d, ch, ca, cr);
            cr.subs?.forEach((sb) => recordSubOut(sb.t, sb.outPlayer, sb.m));
            extraWellbeing.push({ team: ch, ctx: buildSimWellbeingCtx(ch, cr.gh, cr.ga, cr, big) });
            extraWellbeing.push({ team: ca, ctx: buildSimWellbeingCtx(ca, cr.ga, cr.gh, cr, big) });
          }
        }
        d.cupLog = d.cupLog || [];
        d.cupLog.push({
          md: d.md,
          comp: kind,
          r: roundBefore,
          ...buildArchivedReport(kind, roundLabel)
        });
        c.ids = nx;
        c.r++;
        if (kind === 'lc') d.plc = false;
        else if (kind === 'sc') d.psc = false;
        else d.pdc = false;

        if (!nx.includes(d.me)) {
          c.alive = false;
          d.news = `${meta.icon} ตกรอบ${meta.name} (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, meta.short, d.news, 'urg');
        } else {
          d.news = `${meta.icon} ${nx.length === 1 ? `คว้า${meta.trophyTitle}!` : `ผ่านเข้ารอบ${meta.name}!`} (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, meta.short, d.news, 'ok');
        }
        if (nx.length === 1) {
          c.done = true;
          const winTeam = d.teams[nx[0]];
          if (winTeam) {
            winTeam.trophies = winTeam.trophies || [];
            if (!winTeam.trophies.some((tr) => tr.season === d.season && tr.type === meta.trophyType)) {
              winTeam.trophies.push({ season: d.season, title: meta.trophyTitle, type: meta.trophyType });
            }
            adjustTeamFans(winTeam, Math.round(ensureTeamFans(winTeam) * 0.09));
          }
          if (nx[0] === d.me) {
            d.trophies = d.trophies || [];
            if (!d.trophies.some((tr) => tr.season === d.season && tr.type === meta.trophyType)) {
              d.trophies.push({ season: d.season, title: meta.trophyTitle, type: meta.trophyType });
            }
            if (d.mode === 'm') {
              d.money += meta.prize;
              logFin(d, `รางวัล${meta.trophyTitle}`, meta.prize);
              d.mgrRep = (d.mgrRep || 50) + meta.rep;
            } else if (d.p) {
              const meSq = me.sq.find((q) => q.me);
              appendPlayerCareerLog(meSq, `${meta.icon} ซีซั่น ${d.season}: คว้า${meta.trophyTitle}กับ ${me.name}`, d.p);
            }
            shouldConfetti = true;
          }
        }
        applyLiveInjuries();
        me.sq.forEach((q) => {
          if ((q.sus || 0) > 0) q.sus = q.sus! - 1;
          if ((q.inj || 0) > 0 && !liveInjNames.includes(q.n)) q.inj = Math.max(0, q.inj - 1);
          if (q.me && d.p) {
            d.p.sus = q.sus || 0;
            d.p.inj = q.inj || 0;
          }
        });
        applyMatchCards(d, H, A, payload.cards);
        applyPositionAdaptation(d, H, A, resObj);
        if (d.mode === 'm') {
          if (homeId === d.me && kind !== 'sc') {
            const cupTicket = calcHomeTicketRevenue(d, me, { ignorePromo: true });
            if (cupTicket > 0) {
              d.money += cupTicket;
              logFin(d, `ค่าตั๋วเข้าชมเกมเหย้า${meta.short} (${resolveTicketPlan(d).label})`, cupTicket);
            }
          }
          applyLiveStreamMatchSettlement(d, me, opp, {
            kind,
            isHome: homeId === d.me,
            isDerby,
            myGoals: homeId === d.me ? payload.gh : payload.ga,
            oppGoals: homeId === d.me ? payload.ga : payload.gh,
            viewers: payload.streamViewers,
            peakViewers: payload.streamPeakViewers
          });
        }
        if (d.mode === 'p' && payload.pf) {
          const perfOut = creditPlayerPerf(d, payload.pf);
          if (perfOut?.talentToast) talentToast = perfOut.talentToast;
        }
        syncCupParticipantWellbeing(extraWellbeing);
        recordMatchMissions();
        return { shouldConfetti, missionToast, talentToast, personalityToast };
      }

      if (kind === 'asia' && d.ac) {
        const c = d.ac;
        const roundBefore = c.r;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        const asiaWellbeing: { team: Team; ctx: MatchdayWellbeingCtx }[] = [];
        for (let i = 0; i < c.ids.length; i += 2) {
          const ah = d.teams[c.ids[i]];
          const aa = d.teams[c.ids[i + 1]];
          const big = c.ids.length <= 4;
          if (ah.id === homeId && aa.id === awayId) {
            nx[i / 2] = userWin.id;
            tallyCupMatchPlayers('asia', ah, aa, resObj);
            updateTeamsFanbaseOnMatch(ah, payload.gh, aa, payload.ga, { kind: 'asia', big });
            c.log.push(`${RN[c.r]}: ${ah.name} ${payload.gh}-${payload.ga} ${aa.name}${payload.penText ? ` (${payload.penText})` : ''}`);
            asiaWellbeing.push({ team: ah, ctx: buildUserSideWellbeingCtx(ah, payload.gh, payload.ga, big) });
            asiaWellbeing.push({ team: aa, ctx: buildUserSideWellbeingCtx(aa, payload.ga, payload.gh, big) });
          } else {
            const ar = simMatch(ah, aa, d);
            const aw = pickWinner(ah, aa, ar, d);
            nx[i / 2] = aw.id;
            tallyCupMatchPlayers('asia', ah, aa, ar);
            updateTeamsFanbaseOnMatch(ah, ar.gh, aa, ar.ga, { kind: 'asia', big });
            c.log.push(`${RN[c.r]}: ${ah.name} ${ar.gh}-${ar.ga} ${aa.name}`);
            applyPositionAdaptation(d, ah, aa, ar);
            applyAiClubMatchMissions(d, ah, aa, ar);
            ar.subs?.forEach((sb) => recordSubOut(sb.t, sb.outPlayer, sb.m));
            asiaWellbeing.push({ team: ah, ctx: buildSimWellbeingCtx(ah, ar.gh, ar.ga, ar, big) });
            asiaWellbeing.push({ team: aa, ctx: buildSimWellbeingCtx(aa, ar.ga, ar.gh, ar, big) });
          }
        }
        d.cupLog = d.cupLog || [];
        d.cupLog.push({
          md: d.md,
          comp: 'asia',
          r: roundBefore,
          ...buildArchivedReport('asia', RN[roundBefore] || `รอบ ${roundBefore + 1}`)
        });
        c.ids = nx;
        c.r++;
        d.pa = false;
        const isWorldCupClub = (d.season ?? 1) % 2 === 0;
        const cupLabel = isWorldCupClub ? 'ชิงแชมป์สโมสรโลก' : 'บอลถ้วยทวีป';
        const cupShortTag = isWorldCupClub ? 'สโมสรโลก' : 'ถ้วยทวีป';
        const cupTrophyTitle = isWorldCupClub ? 'แชมป์สโมสรโลก' : 'แชมป์สโมสรทวีป';
        if (!nx.includes(d.me)) {
          c.alive = false;
          d.news = `${isWorldCupClub ? '🌐' : '🌏'} ตกรอบ${cupLabel} (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, cupShortTag, d.news, 'urg');
        } else {
          d.news = `${isWorldCupClub ? '🌐' : '🌏'} เข้ารอบ${cupLabel}! (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, cupShortTag, d.news, 'ok');
        }
        if (nx.length === 1) {
          c.done = true;
          const winTeam = d.teams[nx[0]];
          if (winTeam) {
            winTeam.trophies = winTeam.trophies || [];
            if (!winTeam.trophies.some((tr) => tr.season === d.season && tr.type === 'asia')) {
              winTeam.trophies.push({ season: d.season, title: cupTrophyTitle, type: 'asia' });
            }
            adjustTeamFans(winTeam, Math.round(ensureTeamFans(winTeam) * 0.16));
          }
          if (nx[0] === d.me) {
            d.trophies = d.trophies || [];
            if (!d.trophies.some((tr) => tr.season === d.season && tr.type === 'asia')) {
              d.trophies.push({ season: d.season, title: cupTrophyTitle, type: 'asia' });
            }
            if (d.mode === 'm') {
              d.money += ASIA_CUP_PRIZE;
              logFin(d, `รางวัล${cupTrophyTitle}`, ASIA_CUP_PRIZE);
              d.mgrRep = (d.mgrRep || 50) + 120;
            } else if (d.p) {
              const meSq = me.sq.find((q) => q.me);
              appendPlayerCareerLog(meSq, `${isWorldCupClub ? '🌐' : '🌏'} ซีซั่น ${d.season}: คว้า${cupTrophyTitle}กับ ${me.name}`, d.p);
            }
            shouldConfetti = true;
          }
        }
        applyLiveInjuries();
        me.sq.forEach((q) => {
          if ((q.sus || 0) > 0) q.sus = q.sus! - 1;
          if ((q.inj || 0) > 0 && !liveInjNames.includes(q.n)) q.inj = Math.max(0, q.inj - 1);
          if (q.me && d.p) {
            d.p.sus = q.sus || 0;
            d.p.inj = q.inj || 0;
          }
        });
        applyMatchCards(d, H, A, payload.cards);
        applyPositionAdaptation(d, H, A, resObj);
        if (d.mode === 'm') {
          if (homeId === d.me) {
            const cupTicket = calcHomeTicketRevenue(d, me, { ignorePromo: true });
            if (cupTicket > 0) {
              d.money += cupTicket;
              logFin(d, `ค่าตั๋วเข้าชมเกมเหย้าถ้วยทวีป (${resolveTicketPlan(d).label})`, cupTicket);
            }
          }
          applyLiveStreamMatchSettlement(d, me, opp, {
            kind: 'asia',
            isHome: homeId === d.me,
            isDerby,
            myGoals: homeId === d.me ? payload.gh : payload.ga,
            oppGoals: homeId === d.me ? payload.ga : payload.gh,
            viewers: payload.streamViewers,
            peakViewers: payload.streamPeakViewers
          });
        }
        if (d.mode === 'p' && payload.pf) {
          const perfOut = creditPlayerPerf(d, payload.pf);
          if (perfOut?.talentToast) talentToast = perfOut.talentToast;
        }
        syncCupParticipantWellbeing(asiaWellbeing);
        recordMatchMissions();
        return { shouldConfetti, missionToast, talentToast, personalityToast };
      }

      // League Matchday
      if (isDerby) d.derby = 1;
      applyMatchResult(H, payload.gh, A, payload.ga);
      tallyMatchPlayers(H, A, resObj);
      applyPositionAdaptation(d, H, A, resObj);

      const roundCards: { h: Team; a: Team; cards?: MatchCardEvent[] }[] = [
        { h: H, a: A, cards: payload.cards }
      ];
      const wellbeingByTeam: Record<number, MatchdayWellbeingCtx> = {
        [H.id]: buildUserSideWellbeingCtx(H, payload.gh, payload.ga, isDerby),
        [A.id]: buildUserSideWellbeingCtx(A, payload.ga, payload.gh, isDerby)
      };

      // Simulate remaining fixtures in user's league & other tiers
      d.fx[d.md].forEach(([fidH, fidA]) => {
        if ((fidH === homeId && fidA === awayId) || (fidH === awayId && fidA === homeId)) return;
        const th = d.teams[fidH];
        const ta = d.teams[fidA];
        const r = simMatch(th, ta, d);
        applyMatchResult(th, r.gh, ta, r.ga);
        tallyMatchPlayers(th, ta, r);
        applyPositionAdaptation(d, th, ta, r);
        applyAiClubMatchMissions(d, th, ta, r);
        roundCards.push({ h: th, a: ta, cards: r.cards });
        r.subs?.forEach((sb) => recordSubOut(sb.t, sb.outPlayer, sb.m));
        wellbeingByTeam[th.id] = buildSimWellbeingCtx(th, r.gh, r.ga, r);
        wellbeingByTeam[ta.id] = buildSimWellbeingCtx(ta, r.ga, r.gh, r);
      });

      if (d.fxo) {
        Object.values(d.fxo).forEach((rounds) => {
          const rd = rounds[d.md];
          if (!rd) return;
          rd.forEach(([fidH, fidA]) => {
            const th = d.teams[fidH];
            const ta = d.teams[fidA];
            const r = simMatch(th, ta, d);
            applyMatchResult(th, r.gh, ta, r.ga);
            tallyMatchPlayers(th, ta, r);
            applyPositionAdaptation(d, th, ta, r);
            applyAiClubMatchMissions(d, th, ta, r);
            roundCards.push({ h: th, a: ta, cards: r.cards });
            r.subs?.forEach((sb) => recordSubOut(sb.t, sb.outPlayer, sb.m));
            wellbeingByTeam[th.id] = buildSimWellbeingCtx(th, r.gh, r.ga, r);
            wellbeingByTeam[ta.id] = buildSimWellbeingCtx(ta, r.ga, r.gh, r);
          });
        });
      }

      const myGoals = homeId === d.me ? payload.gh : payload.ga;
      const oppGoals = homeId === d.me ? payload.ga : payload.gh;
      const line = `นัด ${d.md + 1}: ${H.name} ${payload.gh}-${payload.ga} ${A.name}`;
      d.res = [line, ...(d.res || [])].slice(0, 5);
      d.news = line;

      d.records = d.records || {};
      const diff = myGoals - oppGoals;
      const matchTag = `ซ.${d.season} ${line}`;
      if (diff > (d.records.bestWin?.diff || 0)) {
        d.records.bestWin = { txt: matchTag, diff };
      }
      if (-diff > (d.records.worstLoss?.diff || 0)) {
        d.records.worstLoss = { txt: matchTag, diff: -diff };
      }
      if (diff > 0) {
        d.records.curStreak = (d.records.curStreak || 0) + 1;
        if (d.records.curStreak > (d.records.winStreak || 0)) d.records.winStreak = d.records.curStreak;
      } else {
        d.records.curStreak = 0;
      }
      if (diff >= 0) {
        d.records.curUnbeatenStreak = (d.records.curUnbeatenStreak || 0) + 1;
        if (d.records.curUnbeatenStreak > (d.records.unbeatenStreak || 0)) {
          d.records.unbeatenStreak = d.records.curUnbeatenStreak;
        }
      } else {
        d.records.curUnbeatenStreak = 0;
      }

      if (d.mode === 'm') {
        const isHomeMatch = homeId === d.me;
        const tPlan = resolveTicketPlan(d);
        const fanEff = clamp((d.fan ?? 55) + getActiveBoardModifiers(d).fan, 5, 100);
        const merchCondMul = 0.85 + 0.15 * (getFacilityCondition(d, 'merchLv') / 100);
        const ticket = isHomeMatch ? calcHomeTicketRevenue(d, me) : 0;
        const merchLv = clamp(d.merchLv ?? 1, 0, 10);
        const partnerMerchBoost = getActivePartnerDeals(d).reduce((sum, x) => sum + (x.merchBoost || 0), 0);
        const attPct = isHomeMatch && payload.cap ? Math.round(((payload.att || 0) / Math.max(1, payload.cap)) * 100) : 0;
        const mainSp = calcMainSponsorPayout(d, me, {
          diff,
          isDerby,
          myGoals,
          oppGoals,
          isHome: isHomeMatch,
          attPct
        });
        const merchBatch =
          isHomeMatch && merchLv > 0
            ? simulateHomeMegastoreMatchSales(d, me, fanEff, merchCondMul, tPlan.merchMult * (1 + mainSp.merchBoost + partnerMerchBoost))
            : null;
        const merch = merchBatch ? merchBatch.netClubCashK : 0;
        const sponsor = mainSp.total;
        if (ticket) {
          d.money += ticket;
          logFin(d, `ค่าตั๋วเข้าชมเกมเหย้า (${d.promo === 1 ? 'โปรโมชั่น' : tPlan.label})`, ticket);
        }
        if (merch) {
          d.money += merch;
          logFin(d, 'เมกะสโตร์ (เสื้อ & ของชำร่วยเหย้า)', merch);
        }
        d.money += sponsor;
        logFin(d, `สปอนเซอร์หลัก (${resolveStateSponsorBrand(d).thName})${mainSp.bonusLabel ? ` + ${mainSp.bonusLabel}` : ''}`, sponsor);
        applyLiveStreamMatchSettlement(d, me, opp, {
          kind: 'league',
          isHome: isHomeMatch,
          isDerby,
          myGoals,
          oppGoals,
          viewers: payload.streamViewers,
          peakViewers: payload.streamPeakViewers
        });
        if (d.winBonus && diff > 0) {
          d.money -= d.winBonus;
          logFin(d, 'จ่ายโบนัสอัดฉีดชัยชนะ', -d.winBonus);
        }
        const ticketFanAdj = isHomeMatch
          ? tPlan.fanMoodDelta > 0
            ? tPlan.fanMoodDelta
            : tPlan.fanMoodDelta < 0 && diff <= 0
              ? tPlan.fanMoodDelta
              : 0
          : 0;
        if (d.promo === 1 || ticketFanAdj !== 0) {
          adjustTeamFans(me, (d.promo === 1 ? 350 : 0) + ticketFanAdj * 130);
        }
        d.promo = 0;
        d.winBonus = 0;
        d.fan = clamp((d.fan ?? 55) + (diff > 0 ? 3 : diff < 0 ? -3 : 0) + ticketFanAdj, 5, 100);
        d.mor = clamp((d.mor ?? 55) + (diff > 0 ? 5 : diff < 0 ? -5 : 1), 0, 100);
      }
      d.schedRes = d.schedRes || {};
      d.schedRes[d.md] = buildArchivedReport('league', `นัดที่ ${d.md + 1}`);
      d.md++;
      if (d.mode !== 'm' && payload.pf) {
        const perfOut = creditPlayerPerf(d, payload.pf);
        if (perfOut?.talentToast) talentToast = perfOut.talentToast;
      }

      applyLiveInjuries();
      const afterOut = afterMatchDay(d, { teamIds: liveInjTeamIds, playerNames: liveInjNames, subbedOutByTeam, wellbeingByTeam });
      const userPersShift = afterOut?.personalityShifts.find((ev) => ev.isUserClub || ev.isMe);
      if (userPersShift && !personalityToast) {
        personalityToast = formatPersonalityShiftFeed(userPersShift);
      }
      roundCards.forEach((rc) => applyMatchCards(d, rc.h, rc.a, rc.cards));
      recordMatchMissions();
      d.money = capMoney(d.money);
      recordFinanceSnapshot(d);
      return { shouldConfetti, missionToast, talentToast, personalityToast };
  };

  const navigateDraftToLeague = (d: GameState) => {
    d.v = 't';
    d.tv = 0;
    d.sub = 0;
    d.lg = d.teams[d.me].tier;
  };

  const syncManagerMatchStintStats = (
    d: GameState,
    homeId: number,
    payload: FinishedMatchPayload
  ) => {
    if (d.mode !== 'm') return;
    ensureManagerHistoryInitialized(d);
    const myG = homeId === d.me ? payload.gh : payload.ga;
    const oppG = homeId === d.me ? payload.ga : payload.gh;
    recordManagerClubMatchResult(d, myG, oppG);
    (d.trophies || [])
      .filter((tr) => tr.season === d.season && tr.type !== 'nt' && tr.type !== 'award')
      .forEach((tr) => syncActiveStintTrophy(d, tr.title));
  };

  const handleMatchFinish = useCallback((payload: FinishedMatchPayload) => {
    const curState = stateRef.current;
    const finished = activeMatchRef.current;
    if (!curState || !finished) return;
    const wasOnLeagueHome = curState.v === 't' && (curState.tv ?? 0) === 0;
    const hadDilemmaBefore = Boolean(curState.dilemma);
    const clone = cloneGameState(curState);
    const outcome = applyFinishedMatchToDraft(clone, finished, payload);
    syncManagerMatchStintStats(clone, finished.homeId, payload);
    navigateDraftToLeague(clone);
    setActiveMatch(null);
    setNavIntent(null);
    if (!wasOnLeagueHome) setNavResetSeq((n) => n + 1);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    skipNextSaveRef.current = false;
    setState(clone);
    if (outcome.shouldConfetti) triggerConfetti();
    const newDilemmaIsPress = Boolean(
      clone.dilemma &&
        (clone.dilemma.isPress || clone.dilemma.id === 'media_interview' || clone.dilemma.id.startsWith('press_'))
    );
    const newDilemmaNote = !hadDilemmaBefore && clone.dilemma
      ? newDilemmaIsPress
        ? `🎙️ มีคำขอสัมภาษณ์ใหม่: ${clone.dilemma.title} (ตอบได้ที่กล่องข้อความหน้าหลัก)`
        : `📌 มีผู้ติดต่อใหม่: ${clone.dilemma.title} (กดดูได้ที่กล่องข้อความหน้าหลัก)`
      : null;
    const parts = [outcome.talentToast, outcome.missionToast, outcome.personalityToast, newDilemmaNote].filter(Boolean);
    if (parts.length > 0) {
      showToast(parts.join(' · '));
    }
  }, [showToast]);

  const runInstantNextMatch = useCallback((fixture: { kind: 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc'; homeId: number; awayId: number; isDerby: boolean }) => {
    const curState = stateRef.current;
    if (!curState) return;
    const wasOnLeagueHome = curState.v === 't' && (curState.tv ?? 0) === 0;
    const hadDilemmaBefore = Boolean(curState.dilemma);
    const clone = cloneGameState(curState);
    if (fixture.isDerby) clone.derby = 1;
    const payload = simulateInstantMatchPayload(clone, fixture.kind, fixture.homeId, fixture.awayId);
    const outcome = applyFinishedMatchToDraft(clone, fixture, payload);
    syncManagerMatchStintStats(clone, fixture.homeId, payload);
    navigateDraftToLeague(clone);
    const H = clone.teams[fixture.homeId];
    const A = clone.teams[fixture.awayId];
    const myGf = fixture.homeId === clone.me ? payload.gh : payload.ga;
    const myGa = fixture.homeId === clone.me ? payload.ga : payload.gh;
    setNavIntent(null);
    if (!wasOnLeagueHome) setNavResetSeq((n) => n + 1);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    skipNextSaveRef.current = false;
    setState(clone);
    if (outcome.shouldConfetti) triggerConfetti();
    if (myGf > myGa) SFX.win();
    else SFX.confirm();
    const scoreMsg = `⏭️ จบเกม: ${H.name} ${payload.gh}-${payload.ga} ${A.name}${payload.penText ? ` (${payload.penText})` : ''}`;
    const newDilemmaIsPress = Boolean(
      clone.dilemma &&
        (clone.dilemma.isPress || clone.dilemma.id === 'media_interview' || clone.dilemma.id.startsWith('press_'))
    );
    const newDilemmaNote = !hadDilemmaBefore && clone.dilemma
      ? newDilemmaIsPress
        ? `🎙️ มีคำขอสัมภาษณ์ใหม่: ${clone.dilemma.title}`
        : `📌 เหตุการณ์ใหม่: ${clone.dilemma.title}`
      : null;
    const parts = [scoreMsg, outcome.talentToast, outcome.missionToast, outcome.personalityToast, newDilemmaNote].filter(Boolean);
    showToast(parts.join(' · '));
  }, [showToast]);

  const launchNationalPreMatch = useCallback((fixture: NationalTeamMatchRecord) => {
    if (!stateRef.current?.natTeam?.active) return;
    setManagerCareerModal(null);
    setNtPreMatchFixture(fixture);
  }, []);

  const handleQuickSimNationalMatch = useCallback((fixture: NationalTeamMatchRecord) => {
    const curState = stateRef.current;
    if (!curState?.natTeam?.active) return;
    const virtual = buildNationalVirtualMatchState(curState, fixture);
    const payload = simulateInstantMatchPayload(
      virtual.matchState,
      'nt',
      virtual.homeId,
      virtual.awayId,
      { allowDraw: !fixture.isKnockout }
    );
    let ntRes: { trophyWon?: string; wonMatch: boolean } = { wonMatch: false };
    updateState((d) => {
      ntRes = applyNationalMatchOutcomeToDraft(d, fixture.id, payload, fixture.home);
    });
    if (ntRes.trophyWon) {
      SFX.celebrate();
      triggerConfetti(1);
      showToast(`🏆🇹🇭 ทีมชาติไทยคว้า ${ntRes.trophyWon}!`);
    } else {
      if (ntRes.wonMatch) SFX.win();
      else SFX.confirm();
      showToast(
        `🇹🇭 จบเกม: ${fixture.home ? 'ทีมชาติไทย' : fixture.opponentName} ${payload.gh}-${payload.ga} ${fixture.home ? fixture.opponentName : 'ทีมชาติไทย'}${payload.penText ? ` (${payload.penText})` : ''}`
      );
    }
  }, [showToast, updateState]);

  const handleNationalMatchFinish = useCallback((payload: FinishedMatchPayload) => {
    const curState = stateRef.current;
    const finishedNt = ntActiveMatchRef.current;
    if (!curState || !finishedNt) return;
    let ntRes: { trophyWon?: string; wonMatch: boolean } = { wonMatch: false };
    updateState((d) => {
      ntRes = applyNationalMatchOutcomeToDraft(d, finishedNt.fixture.id, payload, finishedNt.fixture.home);
    });
    setNtActiveMatch(null);
    setManagerCareerModal('nt');
    if (ntRes.trophyWon) {
      SFX.celebrate();
      triggerConfetti(1);
      showToast(`🏆🇹🇭 ทีมชาติไทยคว้า ${ntRes.trophyWon}!`);
    } else if (ntRes.wonMatch) {
      showToast('🇹🇭 ช้างศึกคว้าชัยชนะได้สำเร็จ!');
    }
  }, [showToast, updateState]);

  const handleTriggerNextStep = useCallback(() => {
    const curState = stateRef.current;
    if (!curState) return;
    if (curState.mode === 'm' && curState.sack === 1 && curState.md < curState.fx.length) {
      SFX.tap();
      showToast('⚠️ คุณถูกปลดจากสโมสรเดิมแล้ว กรุณาเลือกสโมสรใหม่เพื่อคุมทัพต่อ');
      return;
    }
    unlockAudio();
    enterAutoMobileFullscreen().catch(() => undefined);
    const curNextMatch = nextMatchInfoRef.current;
    if (curNextMatch) {
      if (vipAuthorizedRef.current && appSettingsRef.current.autoSkipMatch) {
        runInstantNextMatch(curNextMatch);
        return;
      }
      SFX.tap();
      setPreMatch(curNextMatch);
      return;
    }
    SFX.tap();
    if (curState.md >= curState.fx.length) {
      const clone = cloneGameState(curState);
      const summary = finishSeasonComputation(clone);
      clone.money = capMoney(clone.money);
      if (clone.mode === 'm') {
        ensureManagerHistoryInitialized(clone);
        (clone.trophies || [])
          .filter((tr) => tr.season === clone.season && tr.type !== 'nt' && tr.type !== 'award')
          .forEach((tr) => syncActiveStintTrophy(clone, tr.title));
      }
      setState(clone);
      setSeasonSummary(summary);
    }
  }, [runInstantNextMatch, showToast]);

  const handleStartNextSeason = useCallback((transferToTeamId?: number) => {
    const curState = stateRef.current;
    if (!curState) return;
    setSeasonStatsTarget(null);
    if (curState.sack === 1 && transferToTeamId == null) {
      flushPendingSave();
      setSeasonSummary(null);
      setState(null);
      return;
    }
    const targetTeamName = transferToTeamId != null ? curState.teams[transferToTeamId]?.name : undefined;
    const nextSeasonNum = curState.season + 1;
    setSeasonSummary(null);
    updateState((d) => {
      growPlayers(d);
      if (d.mode === 'm' && transferToTeamId != null && d.teams[transferToTeamId]) {
        switchManagerClub(d, transferToTeamId, {
          reason: d.sack === 1 ? 'sacked' : 'transfer',
          timing: 'offseason'
        });
      } else if (d.mode === 'p' && d.p && transferToTeamId != null && d.teams[transferToTeamId]) {
        const oldT = d.teams[d.me];
        const idx = oldT.sq.findIndex((q) => q.me);
        const mePlayer = idx >= 0 ? oldT.sq.splice(idx, 1)[0] : null;
        if (mePlayer) {
          oldT.lu = null;
          const newT = d.teams[transferToTeamId];
          const repIdx = newT.sq.findIndex((q) => q.pos === mePlayer.pos);
          newT.sq.splice(repIdx >= 0 ? repIdx : 0, 1, mePlayer);
          newT.lu = null;
          assignTeamShirtNumbers(newT);
          d.p.no = mePlayer.no;
          d.me = transferToTeamId;
          const trLog = `✍️ ย้ายซบ ${newT.name} (${TN[newT.tier]}) ในซีซั่น ${d.season + 1}`;
          d.hist.push(trLog);
          appendPlayerCareerLog(mePlayer, trLog, d.p);
        }
      }
      d.season++;
      d.yth = Array.from({ length: 4 }, () => mkPlayer(P(POS), BASE[d.teams[d.me].tier] - 2 + Math.round((d.ya ?? 1) * 1.2), true));
      startSeason(d);
      refreshNationalCampaignOnNewSeason(d);
      d.lg = d.teams[d.me].tier;
      pushFeed(d, 'ฤดูกาลใหม่', `🚀 เปิดฉากฤดูกาลที่ ${d.season} · ${TN[d.teams[d.me].tier]}`, 'ok');
    });
    showToast(
      targetTeamName
        ? `✍️ รับตำแหน่งคุมทัพ ${targetTeamName} ลุยฤดูกาลที่ ${nextSeasonNum} แล้ว!`
        : `เริ่มต้นฤดูกาลที่ ${nextSeasonNum} แล้ว!`
    );
  }, [flushPendingSave, showToast, updateState]);

  const handleEnterGame = useCallback(() => {
    if (enteringLandscapeRef.current) return;
    const cur = getSettings();
    const currentlyPortrait = isPortraitViewport();
    const shouldLandscape = cur.preferFullscreen !== false || (isMobileDevice() && currentlyPortrait);
    unlockAudio();
    SFX.tap();

    const finishEnter = () => {
      enteringLandscapeRef.current = false;
      setIsPortrait(isPortraitViewport());
      setEnteredGame(true);
    };

    if (shouldLandscape && currentlyPortrait) {
      enteringLandscapeRef.current = true;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        finishEnter();
      };
      const safetyTimer = window.setTimeout(done, 420);
      enterLandscapeFullscreen(true)
        .catch(() => ({ fullscreen: false, landscape: false }))
        .finally(() => {
          window.clearTimeout(safetyTimer);
          window.requestAnimationFrame(done);
        });
      return;
    }

    if (shouldLandscape) {
      void enterLandscapeFullscreen(true).catch(() => undefined);
    }
    finishEnter();
  }, []);

  const handleRetryLandscapeFromNotice = useCallback(() => {
    enterLandscapeFullscreen(true)
      .then((res) => {
        window.setTimeout(() => {
          const stillPortrait = isPortraitViewport();
          setIsPortrait(stillPortrait);
          if (!stillPortrait) {
            setPortraitSwitchFailed(false);
          } else if (!res.landscape) {
            setPortraitSwitchFailed(true);
          }
        }, 260);
      })
      .catch(() => {
        setPortraitSwitchFailed(true);
      });
  }, []);

  const handleSelectDockTab = useCallback((key: MainTab) => {
    SFX.tap();
    setNavIntent(null);
    setNavResetSeq((n) => n + 1);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    navigateShallow((d) => ({
      v: key,
      tv: 0,
      sub: 0,
      lg: d.teams[d.me].tier
    }));
  }, [navigateShallow]);

  const handleOpenNtModal = useCallback(() => setManagerCareerModal('nt'), []);
  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleOpenDilemma = useCallback(() => setShowDilemmaModal(true), []);
  const handleInspectTeam = useCallback((tid: number) => setInspectTeamId(tid), []);
  const handleInspectPlayer = useCallback(
    (p: Player, t: Team | null, initialTab?: 'info' | 'history' | 'missions') =>
      setInspectPlayer({ player: p, team: t, initialTab }),
    []
  );
  const handleOpenSeasonStats = useCallback((seasonNum?: number) => {
    const curState = stateRef.current;
    if (!curState) return;
    setSeasonStatsTarget(seasonNum ?? curState.seasonArchives?.[0]?.season ?? curState.season);
  }, []);
  const handleOpenVarReplay = useCallback((homeId: number, awayId: number, records: VarReplayRecord[]) => {
    if (!records.length) return;
    SFX.tap();
    setHistoryVarModal({ homeId, awayId, records, activeId: records[0].id });
  }, []);
  const handleOpenHighlights = useCallback(
    (homeId: number, awayId: number, clips: MatchHighlightClip[], title?: string, scoreSummary?: string) => {
      if (!clips.length) return;
      SFX.tap();
      setHistoryHighlightModal({ homeId, awayId, clips, title, scoreSummary });
    },
    []
  );
  const handleOpenMatchReport = useCallback((report: ArchivedMatchReport, title?: string) => {
    SFX.tap();
    setMatchReportModal({ report, title });
  }, []);
  const handleOpenManagerCareer = useCallback((initialTab?: 'career' | 'nt') => {
    SFX.tap();
    setManagerCareerModal(initialTab || 'career');
  }, []);
  const handleCloseManagerCareer = useCallback(() => setManagerCareerModal(null), []);
  const handleRetireToMenu = useCallback(() => {
    flushPendingSave();
    setManagerCareerModal(null);
    setState(null);
  }, [flushPendingSave]);
  const handleInspectNationalReport = useCallback((fx: NationalTeamMatchRecord) => {
    const curState = stateRef.current;
    if (!curState || !fx.report) return;
    const v = buildNationalVirtualMatchState(curState, fx);
    const hTm = v.matchState.teams[v.homeId];
    const aTm = v.matchState.teams[v.awayId];
    const reportState: GameState = {
      ...v.matchState,
      me: v.homeId === v.thailandId ? 0 : 1,
      teams: [hTm, aTm]
    };
    const fixedReport: ArchivedMatchReport = {
      ...fx.report,
      h: 0,
      a: 1
    };
    setNtReportModal({
      report: fixedReport,
      title: `🇹🇭 ${fx.compName} · ${fx.roundLabel}`,
      virtualState: reportState
    });
  }, []);

  if (!enteredGame && !state) {
    return <AppEntrySplash onEnterGame={handleEnterGame} />;
  }

  if (!state) {
    if (isPortrait) {
      return (
        <>
          <PortraitRotateNotice
            open
            canAutoSwitch={canAutoSwitchLandscape}
            switchFailed={portraitSwitchFailed}
            onSwitchLandscape={handleRetryLandscapeFromNotice}
          />
          <AppToast message={toast} variant="menu" />
          <OfflineIndicator />
          <PWAUpdateBanner />
        </>
      );
    }
    return (
      <>
        <MainMenu
          onStartManager={handleStartManager}
          onStartPlayer={handleStartPlayer}
          onLoadSave={handleLoadSave}
          onToast={showToast}
        />
        <AppToast message={toast} variant="menu" />
        <OfflineIndicator />
        <PWAUpdateBanner />
      </>
    );
  }

  const me = state.teams[state.me];
  const mePlayer = state.mode === 'p' && state.p
    ? me.sq.find((q) => q.me || q.n === state.p?.name) || {
        n: state.p.name,
        pos: state.p.pos,
        ro: state.p.sp,
        no: state.p.no,
        ov: ovMe(state.p),
        age: state.p.age,
        pot: 90,
        fit: state.p.en ?? 100,
        inj: 0,
        me: 1 as const,
        sb: state.p.sb
      }
    : null;

  const validTabKeys: MainTab[] = state.mode === 'm' ? ['t', 'q', 'r', 'k', 'f', 'u'] : ['t', 'p', 'q', 'k'];
  const resolvedView: MainTab = state.v === 'c' ? 't' : state.v;
  const curTab: MainTab = validTabKeys.includes(resolvedView) ? resolvedView : validTabKeys[0];

  const myFansCount = ensureTeamFans(me);
  const nextOppTeam = nextMatchInfo
    ? state.teams[nextMatchInfo.homeId === state.me ? nextMatchInfo.awayId : nextMatchInfo.homeId]
    : null;
  const nextIsHome = nextMatchInfo ? nextMatchInfo.homeId === state.me : false;
  const effectiveAutoSkip = vipAuthorized && Boolean(appSettings.autoSkipMatch);
  const effectiveAllowMatchSkip = vipAuthorized && appSettings.vipMatchSkipEnabled !== false;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[var(--bg)] text-[var(--ink)] safe-all">
      {/* Pinned Single-Row 3-Zone Top HUD Bar */}
      <AppTopHud
        state={state}
        me={me}
        mePlayer={mePlayer}
        saveEpoch={saveEpoch}
        myLeagueRank={myLeagueRank}
        myFansCount={myFansCount}
        nextMatchInfo={nextMatchInfo}
        nextOppTeam={nextOppTeam}
        nextIsHome={nextIsHome}
        autoSkipMatch={effectiveAutoSkip}
        onNavigateToTab={navigateToTab}
        onUpdateState={updateState}
        onOpenDilemma={handleOpenDilemma}
        onTriggerNextStep={handleTriggerNextStep}
        onOpenNtModal={handleOpenNtModal}
        onOpenSettings={handleOpenSettings}
        onToast={showToast}
      />

      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {/* Center Game Stage */}
        <main ref={mainRef} className="flex-1 min-h-0 overflow-hidden flex flex-col overflow-x-hidden">
          <div className="w-full mx-auto px-3 sm:px-4 mland:px-2.5 py-2 sm:py-2.5 mland:py-1.5 flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5">

          {curTab === 't' && (
            <LeagueView
              key={`t-${navResetSeq}`}
              state={state}
              onInspectTeam={handleInspectTeam}
              onInspectPlayer={handleInspectPlayer}
              onUpdateState={updateState}
              onShallowPatch={navigateShallow}
              onNavigate={navigateToTab}
              onOpenSeasonStats={handleOpenSeasonStats}
              onOpenVarReplay={handleOpenVarReplay}
              onOpenHighlights={handleOpenHighlights}
              onOpenMatchReport={handleOpenMatchReport}
              onOpenDilemma={handleOpenDilemma}
              onToast={showToast}
            />
          )}
          {curTab === 'q' && (
            <SquadTacticsView
              key={`q-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onShallowPatch={navigateShallow}
              onInspectPlayer={handleInspectPlayer}
              onNavigate={navigateToTab}
              onToast={showToast}
              navIntent={navIntent}
            />
          )}
          {curTab === 'r' && state.mode === 'm' && (
            <TeamTrainingView
              key={`r-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onInspectPlayer={handleInspectPlayer}
              onToast={showToast}
              navIntent={navIntent}
            />
          )}
          {curTab === 'k' && state.mode === 'm' && (
            <MarketView
              key={`k-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onInspectPlayer={handleInspectPlayer}
              onToast={showToast}
              navIntent={navIntent}
            />
          )}
          {(curTab === 'f' || curTab === 'u') && state.mode === 'm' && (
            <FinanceClubView
              key={`${curTab}-${navResetSeq}`}
              state={state}
              tab={curTab}
              onUpdateState={updateState}
              onNavigate={navigateToTab}
              onToast={showToast}
              onInspectPlayer={handleInspectPlayer}
              onOpenSeasonStats={handleOpenSeasonStats}
              onOpenManagerCareer={handleOpenManagerCareer}
              navIntent={navIntent}
            />
          )}
          {curTab === 'p' && state.mode === 'p' && (
            <PlayerCareerView
              key={`p-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onToast={showToast}
              onOpenSeasonStats={handleOpenSeasonStats}
              navIntent={navIntent}
            />
          )}
          {curTab === 'k' && state.mode === 'p' && (
            <PlayerClubTransferView
              key={`pk-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onInspectTeam={handleInspectTeam}
              onInspectPlayer={handleInspectPlayer}
              onToast={showToast}
            />
          )}
          </div>
        </main>

        {/* Pinned Left-Rail Game Console Dock */}
        <AppNavDock
          curTab={curTab}
          mode={state.mode}
          incomingBadgeCount={incomingMarketBadgeCount}
          onSelectTab={handleSelectDockTab}
        />
      </div>

      {/* Modals */}
      {preMatch && !activeMatch && (
        <PreMatchModal
          state={state}
          kind={preMatch.kind}
          homeId={preMatch.homeId}
          awayId={preMatch.awayId}
          isDerby={preMatch.isDerby}
          onUpdateState={updateState}
          onKickOff={(env) => {
            const target = preMatch;
            setPreMatch(null);
            enterAutoMobileFullscreen().catch(() => undefined);
            if (target.isDerby) {
              updateState((d) => { d.derby = 1; });
            }
            setActiveMatch({ ...target, matchEnv: env });
          }}
          onQuickSim={() => {
            if (!effectiveAllowMatchSkip) return;
            const target = preMatch;
            setPreMatch(null);
            runInstantNextMatch(target);
          }}
          allowSkip={effectiveAllowMatchSkip}
          onOpenFullTactics={() => {
            setPreMatch(null);
            navigateToTab('q');
          }}
          onClose={() => setPreMatch(null)}
          onToast={showToast}
        />
      )}

      {activeMatch && (
        <MatchModal
          state={state}
          kind={activeMatch.kind}
          homeId={activeMatch.homeId}
          awayId={activeMatch.awayId}
          isDerby={activeMatch.isDerby}
          initialMatchEnv={activeMatch.matchEnv}
          allowSkip={effectiveAllowMatchSkip}
          onFinish={handleMatchFinish}
        />
      )}

      {matchReportModal && (
        <PostMatchReportModal
          report={matchReportModal.report}
          title={matchReportModal.title}
          state={state}
          onClose={() => setMatchReportModal(null)}
          onOpenVarReplay={(homeId, awayId, records, activeId) => {
            if (!records.length) return;
            setHistoryVarModal({
              homeId,
              awayId,
              records,
              activeId: activeId || records[0].id
            });
          }}
          onOpenHighlights={(homeId, awayId, clips, activeId, title, scoreSummary) => {
            if (!clips.length) return;
            setHistoryHighlightModal({ homeId, awayId, clips, activeId, title, scoreSummary });
          }}
          onInspectTeam={(tid) => setInspectTeamId(tid)}
          onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
        />
      )}

      {inspectTeamId !== null && state.teams[inspectTeamId] && (
        <TeamInspectorModal
          team={state.teams[inspectTeamId]}
          state={state}
          onClose={() => setInspectTeamId(null)}
          onInspectPlayer={(p, t, initialTab) => {
            setInspectPlayer({ player: p, team: t, initialTab });
          }}
        />
      )}

      {inspectPlayer && (
        <PlayerInspectorModal
          player={inspectPlayer.player}
          team={inspectPlayer.team}
          state={state}
          initialTab={inspectPlayer.initialTab}
          onClose={() => setInspectPlayer(null)}
          onUpdateState={updateState}
          onToast={showToast}
        />
      )}

      {seasonSummary && (
        <SeasonEndModal
          state={state}
          summary={seasonSummary}
          onOpenSeasonStats={() =>
            setSeasonStatsTarget(seasonSummary.archive?.season ?? state.seasonArchives?.[0]?.season ?? state.season)
          }
          onStartNextSeason={handleStartNextSeason}
        />
      )}

      {seasonStatsTarget !== null && (() => {
        const archiveList =
          state.seasonArchives && state.seasonArchives.length > 0
            ? state.seasonArchives
            : seasonSummary?.archive
              ? [seasonSummary.archive]
              : [];
        if (!archiveList.length) return null;
        return (
          <SeasonStatsModal
            state={state}
            archives={archiveList}
            initialSeason={seasonStatsTarget}
            onClose={() => setSeasonStatsTarget(null)}
          />
        );
      })()}

      {showDilemmaModal && state.dilemma && !preMatch && !activeMatch && !seasonSummary && (
        <DilemmaModal
          dilemma={state.dilemma}
          onClose={() => setShowDilemmaModal(false)}
          onChoose={(idx) => {
            let msg = '';
            updateState((d) => {
              msg = applyDilemmaChoice(d, idx);
            });
            setShowDilemmaModal(false);
            if (msg) showToast(msg);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          state={state}
          slot={slot}
          vipAuthorized={vipAuthorized}
          onClose={() => setShowSettings(false)}
          onExitToMenu={() => {
            flushPendingSave();
            setPreMatch(null);
            setActiveMatch(null);
            setShowDilemmaModal(false);
            setHistoryVarModal(null);
            setHistoryHighlightModal(null);
            setMatchReportModal(null);
            setShowSettings(false);
            setSeasonStatsTarget(null);
            setState(null);
          }}
          onSaveNow={() => {
            flushPendingSave();
            saveGameToSlot(state, slot);
          }}
          onLoadSaveFile={(loaded, targetSlot) => {
            handleLoadSave(loaded.mode, targetSlot, loaded);
            setShowSettings(false);
          }}
          onOpenSecretBoost={() => setShowSecretBoost(true)}
          onToast={showToast}
          onSettingsChange={(next) => {
            setAppSettings(next);
          }}
        />
      )}

      {showSecretBoost && (
        <SecretBoostModal
          state={state}
          vipAuthorized={vipAuthorized}
          onUnlockVip={() => setVipAuthorized(true)}
          onLockVip={() => {
            setVipAuthorized(false);
            setShowGodBlessing(false);
          }}
          appSettings={appSettings}
          onUpdateSettings={updateAppSettings}
          nextMatchLabel={
            nextMatchInfo && nextOppTeam
              ? `พบ ${nextOppTeam.name}`
              : null
          }
          onSkipNextMatch={
            nextMatchInfo
              ? () => {
                  const target = nextMatchInfo;
                  setShowSettings(false);
                  setPreMatch(null);
                  runInstantNextMatch(target);
                }
              : undefined
          }
          onClose={() => setShowSecretBoost(false)}
          onOpenGodBlessing={() => {
            if (vipAuthorized) setShowGodBlessing(true);
            else setShowSecretBoost(true);
          }}
          onUpdateState={updateState}
          onToast={showToast}
        />
      )}

      {showGodBlessing && (
        <GodBlessingModal
          state={state}
          vipAuthorized={vipAuthorized}
          onClose={() => setShowGodBlessing(false)}
          onRequireAuth={() => setShowSecretBoost(true)}
          onUpdateState={updateState}
          onToast={showToast}
        />
      )}

      {historyVarModal && (() => {
        const targetState = historyVarModal.virtualState || state;
        const hTeam = targetState.teams[historyVarModal.homeId];
        const aTeam = targetState.teams[historyVarModal.awayId];
        const activeRec =
          historyVarModal.records.find((r) => r.id === historyVarModal.activeId) || historyVarModal.records[0];
        if (!hTeam || !aTeam || !activeRec) return null;
        const [homeKit, awayKit, homeTrim, awayTrim] = matchKits(hTeam, aTeam, targetState);
        const homeGkKit = pickGK(homeKit, awayKit, homeTrim);
        const awayGkKit = pickGK(awayKit, homeKit, homeGkKit);
        return (
          <VarReplayModal
            records={historyVarModal.records}
            activeRecord={activeRec}
            liveMode={false}
            onSelectRecord={(id) =>
              setHistoryVarModal((prev) => (prev ? { ...prev, activeId: id } : null))
            }
            onClose={() => setHistoryVarModal(null)}
            homeOrig={hTeam}
            awayOrig={aTeam}
            state={targetState}
            homeKit={homeKit}
            awayKit={awayKit}
            homeGkKit={homeGkKit}
            awayGkKit={awayGkKit}
            homeTrim={homeTrim}
            awayTrim={awayTrim}
          />
        );
      })()}

      {historyHighlightModal && (() => {
        const targetState = historyHighlightModal.virtualState || state;
        const hTeam = targetState.teams[historyHighlightModal.homeId];
        const aTeam = targetState.teams[historyHighlightModal.awayId];
        if (!hTeam || !aTeam || !historyHighlightModal.clips.length) return null;
        const [homeKit, awayKit, homeTrim, awayTrim] = matchKits(hTeam, aTeam, targetState);
        const homeGkKit = pickGK(homeKit, awayKit, homeTrim);
        const awayGkKit = pickGK(awayKit, homeKit, homeGkKit);
        return (
          <MatchHighlightModal
            clips={historyHighlightModal.clips}
            initialClipId={historyHighlightModal.activeId}
            homeOrig={hTeam}
            awayOrig={aTeam}
            state={targetState}
            homeKit={homeKit}
            awayKit={awayKit}
            homeGkKit={homeGkKit}
            awayGkKit={awayGkKit}
            homeTrim={homeTrim}
            awayTrim={awayTrim}
            compTitle={historyHighlightModal.title}
            scoreSummary={historyHighlightModal.scoreSummary}
            onClose={() => setHistoryHighlightModal(null)}
          />
        );
      })()}

      {ntPreMatchFixture && ntPreMatchVirtual && !ntActiveMatch && (
        <PreMatchModal
          state={ntPreMatchVirtual.matchState}
          kind="nt"
          homeId={ntPreMatchVirtual.homeId}
          awayId={ntPreMatchVirtual.awayId}
          isDerby={ntPreMatchVirtual.matchState.derby === 1}
          compSubtitle={`🇹🇭 ${ntPreMatchFixture.compName} · ${ntPreMatchFixture.roundLabel}`}
          onUpdateState={(updater) => {
            const activeFix = ntPreMatchFixture;
            updateState((d) => {
              if (!d.natTeam) return;
              const tmp = buildNationalVirtualMatchState(d, activeFix);
              updater(tmp.matchState);
              const thUpdated = tmp.matchState.teams[tmp.thailandId];
              if (thUpdated) {
                d.natTeam.formCode = thUpdated.form;
                d.natTeam.tac = thUpdated.tac;
                d.natTeam.press = thUpdated.press;
                d.natTeam.tempo = thUpdated.tempo;
                d.natTeam.wid = thUpdated.wid;
                d.natTeam.line = thUpdated.line;
                d.natTeam.pass = thUpdated.pass;
                d.natTeam.cap = thUpdated.cap;
                if (thUpdated.lu) {
                  d.natTeam.lu = [...thUpdated.lu];
                }
                const byName = new Map(d.natTeam.squad.map((m) => [m.playerName, m]));
                d.natTeam.squad = thUpdated.sq
                  .map((q) => byName.get(q.n))
                  .filter((x): x is NonNullable<typeof x> => Boolean(x));
              }
            });
          }}
          onKickOff={(env) => {
            const targetFixture = ntPreMatchFixture;
            const targetVirtual = ntPreMatchVirtual;
            setNtPreMatchFixture(null);
            enterAutoMobileFullscreen().catch(() => undefined);
            setNtActiveMatch({
              fixture: targetFixture,
              virtual: targetVirtual,
              matchEnv: env
            });
          }}
          onQuickSim={() => {
            if (!effectiveAllowMatchSkip) return;
            const target = ntPreMatchFixture;
            setNtPreMatchFixture(null);
            handleQuickSimNationalMatch(target);
          }}
          allowSkip={effectiveAllowMatchSkip}
          onOpenFullTactics={() => {
            setNtPreMatchFixture(null);
            setManagerCareerModal('nt');
          }}
          onClose={() => setNtPreMatchFixture(null)}
          onToast={showToast}
        />
      )}

      {ntActiveMatch && (
        <MatchModal
          state={ntActiveMatch.virtual.matchState}
          kind="nt"
          homeId={ntActiveMatch.virtual.homeId}
          awayId={ntActiveMatch.virtual.awayId}
          isDerby={ntActiveMatch.virtual.matchState.derby === 1}
          allowDraw={!ntActiveMatch.fixture.isKnockout}
          compTitleOverride={`🇹🇭 ${ntActiveMatch.fixture.compName} · ${ntActiveMatch.fixture.roundLabel}`}
          initialMatchEnv={ntActiveMatch.matchEnv}
          allowSkip={effectiveAllowMatchSkip}
          onFinish={handleNationalMatchFinish}
        />
      )}

      {ntReportModal && (
        <PostMatchReportModal
          report={ntReportModal.report}
          title={ntReportModal.title}
          state={ntReportModal.virtualState}
          onClose={() => setNtReportModal(null)}
          onOpenVarReplay={(homeId, awayId, records, activeId) => {
            if (!records.length) return;
            setHistoryVarModal({
              homeId,
              awayId,
              records,
              activeId: activeId || records[0].id,
              virtualState: ntReportModal.virtualState
            });
          }}
          onOpenHighlights={(homeId, awayId, clips, activeId, hlTitle, scoreSummary) => {
            if (!clips.length) return;
            setHistoryHighlightModal({
              homeId,
              awayId,
              clips,
              activeId: activeId || clips[0].id,
              title: hlTitle,
              scoreSummary,
              virtualState: ntReportModal.virtualState
            });
          }}
        />
      )}

      {state.mode === 'm' && state.sack === 1 && !seasonSummary && !activeMatch && !preMatch && (
        <ManagerCareerModal
          state={state}
          mode="sacked"
          onUpdateState={updateState}
          onPlayNationalMatch={launchNationalPreMatch}
          onQuickSimNationalMatch={handleQuickSimNationalMatch}
          allowQuickSim={effectiveAllowMatchSkip}
          onRetireToMenu={handleRetireToMenu}
          onClose={handleCloseManagerCareer}
          onToast={showToast}
        />
      )}

      {state.mode === 'm' && state.sack !== 1 && managerCareerModal && (
        <ManagerCareerModal
          state={state}
          mode={managerCareerModal}
          onUpdateState={updateState}
          onPlayNationalMatch={launchNationalPreMatch}
          onQuickSimNationalMatch={handleQuickSimNationalMatch}
          allowQuickSim={effectiveAllowMatchSkip}
          onInspectNationalReport={handleInspectNationalReport}
          onRetireToMenu={handleRetireToMenu}
          onClose={handleCloseManagerCareer}
          onToast={showToast}
        />
      )}

      <PortraitRotateNotice
        open={isPortrait}
        canAutoSwitch={canAutoSwitchLandscape}
        switchFailed={portraitSwitchFailed}
        onSwitchLandscape={handleRetryLandscapeFromNotice}
      />
      <AppToast message={toast} variant="game" />
      <OfflineIndicator />
      <PWAUpdateBanner />
    </div>
  );
}

