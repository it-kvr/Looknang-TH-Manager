import { useEffect, useMemo, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { OfflineIndicator, PWAInstallButton, PWAUpdateBanner } from './pwa.tsx';
import {
  bindAutoLandscapeFullscreen,
  enterAutoMobileFullscreen,
  enterLandscapeFullscreen,
  restoreAutoFullscreenMigration
} from './utils/fullscreen';
import type { GameMode, MainTab, Player, Team, PlayerCareerProfile, MatchCardEvent, MatchResult, GameState, AppSettings, FinishedMatchPayload } from './types/game';
import { P, clamp, fmtMoney } from './utils/math';
import { RN, TN, BASE, POS } from './data/thaiFootballData';
import { getSettings, applyTheme, SFX, triggerConfetti, unlockAudio } from './utils/audioTheme';
import { saveGameToSlot, assignTeamShirtNumbers, mkPlayer, ovMe, logFin, pushFeed } from './engine/playerCore';
import { simMatch, applyMatchResult, createNewGame, startSeason, tallyMatchPlayers, applyPositionAdaptation, applyMatchCards, creditPlayerPerf, applyDilemmaChoice, pickWinner, afterMatchDay, growPlayers, finishSeasonComputation, simulateInstantMatchPayload, getIncomingOffers, recordFinanceSnapshot, getActiveBoardModifiers, getFacilityCondition, ensureTeamFans, fmtFans, fmtFansShort, adjustTeamFans, updateTeamsFanbaseOnMatch, EXTRA_CUP_META, ensureSeasonExtraCups, resolveTicketPlan, calcMainSponsorPayout, getActivePartnerDeals, simulateHomeMegastoreMatchSales, applyLiveStreamMatchSettlement } from './engine/simulation';
import { applyMatchMissionProgress, applyAiClubMatchMissions } from './engine/missions';
import { appendPlayerCareerLog } from './engine/history';
import { ClubCrest, PlayerFace } from './components/SvgVisuals';
import stadiumHeroBg from './assets/images/thai_stadium_hero_1795511663761.jpg';
import { MainMenu } from './views/MainMenuView';
import { LeagueView } from './views/LeagueView';
import { SquadTacticsView } from './views/SquadTacticsView';
import { TeamTrainingView } from './views/TeamTrainingView';
import { MarketView } from './views/MarketView';
import { FinanceClubView } from './views/FinanceClubView';
import { PlayerCareerView } from './views/PlayerCareerView';
import { PlayerClubTransferView } from './views/PlayerClubTransferView';
import { MatchModal } from './modals/MatchModal';
import { GodBlessingModal } from './modals/GodBlessingModal';
import { PlayerInspectorModal, TeamInspectorModal } from './modals/InspectorModals';
import type { SeasonSummaryData } from './modals/SeasonEndModal';
import { SeasonEndModal } from './modals/SeasonEndModal';
import { SeasonStatsModal } from './modals/SeasonStatsModal';
import { DilemmaModal } from './modals/DilemmaModal';
import { SecretBoostModal } from './modals/SecretBoostModal';
import { SettingsModal } from './modals/SettingsModal';

export default function App() {
  const [enteredGame, setEnteredGame] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [slot, setSlot] = useState<number>(1);
  const [toast, setToast] = useState<string | null>(null);
  const [inspectPlayer, setInspectPlayer] = useState<{ player: Player; team: Team | null; initialTab?: 'info' | 'history' | 'missions' } | null>(null);
  const [inspectTeamId, setInspectTeamId] = useState<number | null>(null);
  const [activeMatch, setActiveMatch] = useState<{ kind: 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc'; homeId: number; awayId: number; isDerby: boolean } | null>(null);
  const [seasonSummary, setSeasonSummary] = useState<SeasonSummaryData | null>(null);
  const [seasonStatsTarget, setSeasonStatsTarget] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSecretBoost, setShowSecretBoost] = useState(false);
  const [showGodBlessing, setShowGodBlessing] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    restoreAutoFullscreenMigration();
    return getSettings();
  });
  const [navResetSeq, setNavResetSeq] = useState(0);
  const [navIntent, setNavIntent] = useState<{ tab: MainTab; sub?: string; ts: number } | null>(null);

  useEffect(() => {
    const unbindFs = bindAutoLandscapeFullscreen();
    return () => {
      unbindFs();
    };
  }, []);

  const mainRef = useRef<HTMLElement | null>(null);
  const crestTapRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  const navigateToTab = (tab: MainTab, sub?: string) => {
    const resolvedTab: MainTab = tab === 'f' && sub === 'infra' ? 'u' : tab;
    setNavIntent({ tab: resolvedTab, sub, ts: Date.now() });
    setNavResetSeq((n) => n + 1);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    navigateShallow((d) => {
      if (tab === 'c') {
        return { v: 't', tv: 4, sub: 0 };
      }
      if (tab === 'q' && sub === 'training') {
        return { v: 'r', tv: 0, sub: 0 };
      }
      if (tab === 'f' && sub === 'infra') {
        return { v: 'u', tv: 0, sub: 0 };
      }
      return {
        v: tab,
        tv: tab === 't' ? (sub === 'cup' ? 4 : sub === 'awards' ? 2 : 0) : 0,
        sub: tab === 'q' ? (sub === 'tactics' ? 1 : sub === 'squad' ? 2 : sub === 'locker' ? 3 : 0) : 0,
        ...(tab === 't' ? { lg: d.teams[d.me].tier } : {})
      };
    });
  };

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

  const flushPendingSave = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending) {
      pendingSaveRef.current = null;
      saveGameToSlot(pending.state, pending.slot);
    }
  };

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

  const navigateShallow = (patcher: (prev: GameState) => Partial<GameState>) => {
    skipNextSaveRef.current = true;
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, ...patcher(prev) };
    });
  };

  const updateState = (updater: (draft: GameState) => void) => {
    skipNextSaveRef.current = false;
    setState((prev) => {
      if (!prev) return prev;
      const clone = cloneGameState(prev);
      updater(clone);
      return clone;
    });
  };

  const handleStartManager = (targetSlot: number, names: string[][], t0: Team[], pick: number, diff: number) => {
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
    setSlot(targetSlot);
    setState(fresh);
    saveGameToSlot(fresh, targetSlot);
    showToast(`รับตำแหน่งผู้จัดการทีม ${fresh.teams[fresh.me].name} แล้ว!`);
  };

  const handleStartPlayer = (
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
    setSlot(targetSlot);
    setState(fresh);
    saveGameToSlot(fresh, targetSlot);
    showToast(`เซ็นสัญญาเริ่มต้นกับ ${fresh.teams[fresh.me].name} แล้ว!`);
  };

  const handleLoadSave = (_mode: GameMode, targetSlot: number, loaded: GameState) => {
    unlockAudio();
    enterAutoMobileFullscreen().catch(() => undefined);
    flushPendingSave();
    const currentTier = loaded.teams?.[loaded.me]?.tier ?? 0;
    const normalized: GameState = { ...loaded, v: 't', tv: 0, sub: 0, lg: currentTier };
    ensureSeasonExtraCups(normalized);
    setNavIntent(null);
    setNavResetSeq((n) => n + 1);
    setSlot(targetSlot);
    setState(normalized);
    saveGameToSlot(normalized, targetSlot);
    showToast('โหลดเซฟเรียบร้อย');
  };

  const nextMatchInfo = useMemo(() => {
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
  }, [state]);

  const applyFinishedMatchToDraft = (
    d: GameState,
    matchInfo: { kind: 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc'; homeId: number; awayId: number; isDerby: boolean },
    payload: FinishedMatchPayload
  ): { shouldConfetti: boolean; missionToast: string | null } => {
    const { kind, homeId, awayId, isDerby } = matchInfo;
    let shouldConfetti = false;
    let missionToast: string | null = null;

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
          pushFeed(d, 'บาดเจ็บในสนาม', `🩹 ${pl.n} (${teamObj.name}) บาดเจ็บระหว่างแข่ง คาดพัก ${inj.games} นัด`, 'urg');
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

      if (kind === 'cup') {
        const c = d.cup;
        const roundBefore = c.r;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        for (let i = 0; i < c.ids.length; i += 2) {
          const ch = d.teams[c.ids[i]];
          const ca = d.teams[c.ids[i + 1]];
          if (ch.id === homeId && ca.id === awayId) {
            nx[i / 2] = userWin.id;
            updateTeamsFanbaseOnMatch(ch, payload.gh, ca, payload.ga, { kind: 'cup', big: c.ids.length <= 4 });
            c.log.push(`${RN[c.r]}: ${ch.name} ${payload.gh}-${payload.ga} ${ca.name}${payload.penText ? ` (${payload.penText})` : ''}`);
          } else {
            const cr = simMatch(ch, ca, d);
            const cw = pickWinner(ch, ca, cr, d);
            nx[i / 2] = cw.id;
            updateTeamsFanbaseOnMatch(ch, cr.gh, ca, cr.ga, { kind: 'cup', big: c.ids.length <= 4 });
            c.log.push(`${RN[c.r]}: ${ch.name} ${cr.gh}-${cr.ga} ${ca.name}`);
            applyPositionAdaptation(d, ch, ca, cr);
            applyAiClubMatchMissions(d, ch, ca, cr);
          }
        }
        d.cupLog = d.cupLog || [];
        d.cupLog.push({ md: d.md, comp: 'cup', r: roundBefore, h: homeId, a: awayId, gh: payload.gh, ga: payload.ga, penText: payload.penText });
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
              d.money += 250;
              logFin(d, 'รางวัลแชมป์ถ้วยประชาชน', 250);
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
        if (d.mode === 'p' && payload.pf) creditPlayerPerf(d, payload.pf);
        recordMatchMissions();
        return { shouldConfetti, missionToast };
      }

      if (kind === 'lc' || kind === 'sc' || kind === 'dc') {
        ensureSeasonExtraCups(d);
        const c = kind === 'lc' ? d.lc! : kind === 'sc' ? d.sc! : d.dc!;
        const meta = EXTRA_CUP_META[kind];
        const roundBefore = c.r;
        const roundLabel = kind === 'sc' ? 'ชิงชนะเลิศ' : RN[c.r] || `รอบ ${c.r + 1}`;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        for (let i = 0; i < c.ids.length; i += 2) {
          const ch = d.teams[c.ids[i]];
          const ca = d.teams[c.ids[i + 1]];
          if (!ch || !ca) {
            if (ch) nx.push(ch.id);
            else if (ca) nx.push(ca.id);
            continue;
          }
          if (ch.id === homeId && ca.id === awayId) {
            nx.push(userWin.id);
            updateTeamsFanbaseOnMatch(ch, payload.gh, ca, payload.ga, { kind, big: c.ids.length <= 4 });
            c.log.push(`${roundLabel}: ${ch.name} ${payload.gh}-${payload.ga} ${ca.name}${payload.penText ? ` (${payload.penText})` : ''}`);
          } else {
            const cr = simMatch(ch, ca, d);
            const cw = pickWinner(ch, ca, cr, d);
            nx.push(cw.id);
            updateTeamsFanbaseOnMatch(ch, cr.gh, ca, cr.ga, { kind, big: c.ids.length <= 4 });
            c.log.push(`${roundLabel}: ${ch.name} ${cr.gh}-${cr.ga} ${ca.name}`);
            applyPositionAdaptation(d, ch, ca, cr);
            applyAiClubMatchMissions(d, ch, ca, cr);
          }
        }
        d.cupLog = d.cupLog || [];
        d.cupLog.push({ md: d.md, comp: kind, r: roundBefore, h: homeId, a: awayId, gh: payload.gh, ga: payload.ga, penText: payload.penText });
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
        if (d.mode === 'p' && payload.pf) creditPlayerPerf(d, payload.pf);
        recordMatchMissions();
        return { shouldConfetti, missionToast };
      }

      if (kind === 'asia' && d.ac) {
        const c = d.ac;
        const roundBefore = c.r;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        for (let i = 0; i < c.ids.length; i += 2) {
          const ah = d.teams[c.ids[i]];
          const aa = d.teams[c.ids[i + 1]];
          if (ah.id === homeId && aa.id === awayId) {
            nx[i / 2] = userWin.id;
            updateTeamsFanbaseOnMatch(ah, payload.gh, aa, payload.ga, { kind: 'asia', big: c.ids.length <= 4 });
            c.log.push(`${RN[c.r]}: ${ah.name} ${payload.gh}-${payload.ga} ${aa.name}${payload.penText ? ` (${payload.penText})` : ''}`);
          } else {
            const ar = simMatch(ah, aa, d);
            const aw = pickWinner(ah, aa, ar, d);
            nx[i / 2] = aw.id;
            updateTeamsFanbaseOnMatch(ah, ar.gh, aa, ar.ga, { kind: 'asia', big: c.ids.length <= 4 });
            c.log.push(`${RN[c.r]}: ${ah.name} ${ar.gh}-${ar.ga} ${aa.name}`);
            applyPositionAdaptation(d, ah, aa, ar);
            applyAiClubMatchMissions(d, ah, aa, ar);
          }
        }
        d.cupLog = d.cupLog || [];
        d.cupLog.push({ md: d.md, comp: 'asia', r: roundBefore, h: homeId, a: awayId, gh: payload.gh, ga: payload.ga, penText: payload.penText });
        c.ids = nx;
        c.r++;
        d.pa = false;
        if (!nx.includes(d.me)) {
          c.alive = false;
          d.news = `🌏 ตกรอบบอลถ้วยทวีป (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, 'ถ้วยทวีป', d.news, 'urg');
        } else {
          d.news = `🌏 เข้ารอบบอลถ้วยทวีป! (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, 'ถ้วยทวีป', d.news, 'ok');
        }
        if (nx.length === 1) {
          c.done = true;
          const winTeam = d.teams[nx[0]];
          if (winTeam) {
            winTeam.trophies = winTeam.trophies || [];
            if (!winTeam.trophies.some((tr) => tr.season === d.season && tr.type === 'asia')) {
              winTeam.trophies.push({ season: d.season, title: 'แชมป์สโมสรทวีป', type: 'asia' });
            }
            adjustTeamFans(winTeam, Math.round(ensureTeamFans(winTeam) * 0.16));
          }
          if (nx[0] === d.me) {
            d.trophies = d.trophies || [];
            if (!d.trophies.some((tr) => tr.season === d.season && tr.type === 'asia')) {
              d.trophies.push({ season: d.season, title: 'แชมป์สโมสรทวีป', type: 'asia' });
            }
            if (d.mode === 'm') {
              d.money += 500;
              logFin(d, 'รางวัลแชมป์ทวีป', 500);
              d.mgrRep = (d.mgrRep || 50) + 120;
            } else if (d.p) {
              const meSq = me.sq.find((q) => q.me);
              appendPlayerCareerLog(meSq, `🌏 ซีซั่น ${d.season}: คว้าแชมป์สโมสรทวีปกับ ${me.name}`, d.p);
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
        if (d.mode === 'p' && payload.pf) creditPlayerPerf(d, payload.pf);
        recordMatchMissions();
        return { shouldConfetti, missionToast };
      }

      // League Matchday
      if (isDerby) d.derby = 1;
      if (d.mode === 'p' && d.p && payload.pf?.played && payload.pf.rt > 0) {
        resObj.ratings = { ...(resObj.ratings || {}), [d.p.name]: payload.pf.rt };
      }
      applyMatchResult(H, payload.gh, A, payload.ga);
      tallyMatchPlayers(H, A, resObj);
      applyPositionAdaptation(d, H, A, resObj);

      const roundCards: { h: Team; a: Team; cards?: MatchCardEvent[] }[] = [
        { h: H, a: A, cards: payload.cards }
      ];
      const subbedOutByTeam: Record<number, Record<string, number>> = {};
      const recordSubOut = (teamId: number, outName: string, min: number) => {
        if (!subbedOutByTeam[teamId]) subbedOutByTeam[teamId] = {};
        if (subbedOutByTeam[teamId][outName] == null || min < subbedOutByTeam[teamId][outName]) {
          subbedOutByTeam[teamId][outName] = min;
        }
      };
      payload.subs.forEach((sb) => recordSubOut(sb.t, sb.outPlayer, sb.m));

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
        const myFans = ensureTeamFans(me);
        const fanScale = clamp(0.65 + Math.log10(Math.max(1000, myFans) / 4000) * 0.42, 0.65, 1.55);
        const stCondMul = 0.85 + 0.15 * (getFacilityCondition(d, 'st') / 100);
        const merchCondMul = 0.85 + 0.15 * (getFacilityCondition(d, 'merchLv') / 100);
        const ticket = isHomeMatch
          ? Math.round((8 + clamp(d.st ?? 1, 1, 10) * 6) * (fanEff / 60) * fanScale * tPlan.revMult * (d.promo === 1 ? 1.35 : 1) * stCondMul)
          : 0;
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
        logFin(d, `สปอนเซอร์หลัก${mainSp.bonusLabel ? ` + ${mainSp.bonusLabel}` : ''}`, sponsor);
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
      d.md++;
      if (d.mode !== 'm' && payload.pf) {
        creditPlayerPerf(d, payload.pf);
      }

      applyLiveInjuries();
      afterMatchDay(d, { teamIds: liveInjTeamIds, playerNames: liveInjNames, subbedOutByTeam });
      roundCards.forEach((rc) => applyMatchCards(d, rc.h, rc.a, rc.cards));
      recordMatchMissions();
      recordFinanceSnapshot(d);
      return { shouldConfetti, missionToast };
  };

  const navigateDraftToLeague = (d: GameState) => {
    d.v = 't';
    d.tv = 0;
    d.sub = 0;
    d.lg = d.teams[d.me].tier;
  };

  const handleMatchFinish = (payload: FinishedMatchPayload) => {
    if (!state || !activeMatch) return;
    const finished = activeMatch;
    const wasOnLeagueHome = state.v === 't' && (state.tv ?? 0) === 0;
    const clone = cloneGameState(state);
    const outcome = applyFinishedMatchToDraft(clone, finished, payload);
    navigateDraftToLeague(clone);
    setActiveMatch(null);
    setNavIntent(null);
    if (!wasOnLeagueHome) setNavResetSeq((n) => n + 1);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    setState(clone);
    if (outcome.shouldConfetti) triggerConfetti();
    if (outcome.missionToast) showToast(outcome.missionToast);
  };

  const handleTriggerNextStep = () => {
    if (!state) return;
    unlockAudio();
    enterAutoMobileFullscreen().catch(() => undefined);
    if (nextMatchInfo) {
      if (appSettings.autoSkipMatch) {
        const wasOnLeagueHome = state.v === 't' && (state.tv ?? 0) === 0;
        const clone = cloneGameState(state);
        if (nextMatchInfo.isDerby) clone.derby = 1;
        const payload = simulateInstantMatchPayload(clone, nextMatchInfo.kind, nextMatchInfo.homeId, nextMatchInfo.awayId);
        const outcome = applyFinishedMatchToDraft(clone, nextMatchInfo, payload);
        navigateDraftToLeague(clone);
        const H = clone.teams[nextMatchInfo.homeId];
        const A = clone.teams[nextMatchInfo.awayId];
        const myGf = nextMatchInfo.homeId === clone.me ? payload.gh : payload.ga;
        const myGa = nextMatchInfo.homeId === clone.me ? payload.ga : payload.gh;
        setNavIntent(null);
        if (!wasOnLeagueHome) setNavResetSeq((n) => n + 1);
        if (mainRef.current) mainRef.current.scrollTop = 0;
        setState(clone);
        if (outcome.shouldConfetti) triggerConfetti();
        if (myGf > myGa) SFX.win();
        else SFX.confirm();
        const scoreMsg = `⏭️ จบเกม: ${H.name} ${payload.gh}-${payload.ga} ${A.name}${payload.penText ? ` (${payload.penText})` : ''}`;
        showToast(outcome.missionToast ? `${scoreMsg} · ${outcome.missionToast}` : scoreMsg);
        return;
      }
      SFX.tap();
      enterAutoMobileFullscreen().catch(() => undefined);
      if (nextMatchInfo.isDerby) {
        updateState((d) => { d.derby = 1; });
      }
      setActiveMatch(nextMatchInfo);
      return;
    }
    SFX.tap();
    if (state.md >= state.fx.length) {
      const clone = cloneGameState(state);
      const summary = finishSeasonComputation(clone);
      setState(clone);
      setSeasonSummary(summary);
    }
  };

  const handleStartNextSeason = (transferToTeamId?: number) => {
    if (!state) return;
    setSeasonStatsTarget(null);
    if (state.sack === 1) {
      flushPendingSave();
      setSeasonSummary(null);
      setState(null);
      return;
    }
    setSeasonSummary(null);
    updateState((d) => {
      growPlayers(d);
      if (d.mode === 'p' && d.p && transferToTeamId != null && d.teams[transferToTeamId]) {
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
      d.lg = d.teams[d.me].tier;
      pushFeed(d, 'ฤดูกาลใหม่', `🚀 เปิดฉากฤดูกาลที่ ${d.season} · ${TN[d.teams[d.me].tier]}`, 'ok');
    });
    showToast(`เริ่มต้นฤดูกาลที่ ${state.season + 1} แล้ว!`);
  };

  const handleEnterGame = () => {
    unlockAudio();
    SFX.tap();
    const cur = getSettings();
    if (cur.preferFullscreen !== false) {
      enterLandscapeFullscreen(true).catch(() => undefined);
    }
    setEnteredGame(true);
  };

  if (!enteredGame && !state) {
    return (
      <div className="relative h-full w-full flex items-center justify-center overflow-hidden bg-[#040c08] stage-viewport">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#040c08]">
          <img
            src={stadiumHeroBg}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center brightness-[0.52] saturate-95"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020805]/86 via-[#05140c]/62 to-[#020805]/90" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(22,124,72,0.22),rgba(2,8,5,0.68)_75%)]" />
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto rounded-3xl mland:rounded-2xl border border-white/15 bg-[#07130d]/88 shadow-[0_24px_64px_rgba(0,0,0,0.75)] px-6 py-7 mland:px-6 mland:py-4 flex flex-col items-center text-center gap-4 mland:gap-2.5">
          <div className="w-16 h-16 mland:w-12 mland:h-12 rounded-2xl bg-white/10 border border-white/18 flex items-center justify-center shadow-xl">
            <svg viewBox="0 0 40 40" className="w-11 h-11 mland:w-8 mland:h-8" aria-hidden="true">
              <defs>
                <linearGradient id="enter_pitch_crest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#123a26" />
                  <stop offset="1" stopColor="#22794b" />
                </linearGradient>
                <radialGradient id="enter_flood_crest" cx="0.5" cy="0.15" r="0.65">
                  <stop offset="0" stopColor="#fde68a" stopOpacity="0.72" />
                  <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect x="2" y="2" width="36" height="36" rx="8" fill="url(#enter_pitch_crest)" />
              <rect x="2" y="2" width="36" height="36" rx="8" fill="url(#enter_flood_crest)" />
              <g fill="none" stroke="#e6f7ed" strokeWidth="1.2" opacity="0.88">
                <path d="M5 24h30" />
                <ellipse cx="20" cy="27" rx="7.5" ry="3.2" />
              </g>
              <circle cx="20" cy="22" r="3.4" fill="#ffffff" stroke="#0d2619" strokeWidth="1" />
            </svg>
          </div>

          <div className="space-y-1 mland:space-y-0.5">
            <h1 className="text-3xl sm:text-4xl mland:text-2xl font-extrabold font-display tracking-wide leading-none text-white">
              ลูกหนัง<span className="text-[#fad05a]">ไทย</span>
            </h1>
            <p className="text-xs sm:text-sm mland:text-[11px] font-medium text-emerald-100/80">
              เกมจำลองคุมสโมสร &amp; นักเตะอาชีพไทย
            </p>
          </div>

          <button
            type="button"
            data-no-auto-fs="1"
            onClick={handleEnterGame}
            className="w-full py-3.5 mland:py-2.5 px-6 rounded-2xl mland:rounded-xl bg-gradient-to-r from-[#f7cb51] via-[#f5c242] to-[#e0a214] text-[#211500] font-extrabold text-base mland:text-sm font-display shadow-[0_10px_28px_rgba(245,194,66,0.35)] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>⚽</span>
            <span>กดเพื่อเข้าเกม</span>
          </button>

          <p className="text-[11px] mland:text-[9.5px] text-emerald-100/60">
            แตะเพื่อเปิดเสียงเกมและเข้าสู่โหมดเต็มจอแนวนอนอัตโนมัติ
          </p>
        </div>

        <OfflineIndicator />
        <PWAUpdateBanner />
      </div>
    );
  }

  if (!state) {
    return (
      <>
        <MainMenu
          onStartManager={handleStartManager}
          onStartPlayer={handleStartPlayer}
          onLoadSave={handleLoadSave}
          onToast={showToast}
        />
        {toast && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] max-w-[90vw] px-4 py-2.5 rounded-xl bg-[var(--ink)]/95 text-[var(--bg)] border border-white/10 text-xs font-bold shadow-xl text-center pointer-events-none">
            {toast}
          </div>
        )}
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
  const tabs: [MainTab, string, string][] =
    state.mode === 'm'
      ? [
          ['t', '🏆', 'การแข่งขัน'],
          ['q', '⚽', 'ทีม & แผน'],
          ['r', '🏋️', 'ฝึกซ้อม'],
          ['k', '🤝', 'ตลาด'],
          ['f', '💰', 'การเงิน'],
          ['u', '🏟️', 'สโมสร']
        ]
      : [
          ['t', '🏆', 'การแข่งขัน'],
          ['p', '🌟', 'นักเตะ'],
          ['q', '⚽', 'ทีม & แผน'],
          ['k', '🧭', 'สโมสร']
        ];

  const resolvedView: MainTab = state.v === 'c' ? 't' : state.v;
  const curTab: MainTab = tabs.some(([k]) => k === resolvedView) ? resolvedView : tabs[0][0];

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[var(--bg)] text-[var(--ink)] safe-all">
        {/* Pinned Single-Row Horizontal Top HUD Bar */}
        <header className="shrink-0 z-30 bg-[var(--surface)]/98 border-b border-[var(--line)] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="w-full mx-auto px-3 sm:px-4 mland:px-2.5 py-1.5 mland:py-1 flex items-center justify-between gap-2 mland:gap-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2 mland:gap-1.5 min-w-0 shrink max-w-[40%]">
            <button
              type="button"
              onClick={() => {
                const now = Date.now();
                const ref = crestTapRef.current;
                ref.count = now - ref.lastTs > 1800 ? 1 : ref.count + 1;
                ref.lastTs = now;
                if (ref.count >= 5) {
                  ref.count = 0;
                  SFX.win();
                  try {
                    sessionStorage.setItem('lk_vip_unlocked', '1');
                  } catch {
                    // ignore
                  }
                  setShowSecretBoost(true);
                  showToast('🔓 ปลดล็อกโหมดลับผู้สนับสนุนแล้ว!');
                }
              }}
              aria-label="ตราสโมสร"
              className="shrink-0 p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/80 mland:[&>svg]:w-6 mland:[&>svg]:h-6 cursor-pointer active:scale-95 transition-transform"
            >
              <ClubCrest name={me.name} size={30} team={me} club={state.club} isMyClub={state.mode === 'm'} />
            </button>
            {state.mode === 'p' && state.p && mePlayer && (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  navigateToTab('p');
                }}
                aria-label="รูปนักเตะ"
                title={state.p.name}
                className="shrink-0 p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/80 [&>svg]:w-[30px] [&>svg]:h-[30px] mland:[&>svg]:w-6 mland:[&>svg]:h-6 cursor-pointer active:scale-95 transition-transform overflow-hidden"
              >
                <PlayerFace player={mePlayer} team={me} state={state} careerProfile={state.p} size={30} bare />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-xs sm:text-sm mland:text-[11.5px] truncate font-display leading-tight tracking-tight">
                  {state.mode === 'p' && state.p ? `${state.p.name} · ` : ''}
                  {me.name}
                </span>
                <span className="text-[11px] mland:text-[9.5px] font-extrabold text-[var(--g)] tabular shrink-0">
                  {state.mode === 'm' ? fmtMoney(state.money) : `OVR ${state.p ? ovMe(state.p) : 60}`}
                </span>
              </div>
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] flex items-center gap-x-1 truncate tabular leading-tight">
                <span className="truncate font-medium">{TN[me.tier]}</span>
                <span className="opacity-40 shrink-0">·</span>
                <span className="shrink-0">ซ.{state.season}</span>
                <span className="opacity-40 shrink-0">·</span>
                <span className="shrink-0">นัด {Math.min(state.md, state.fx.length)}/{state.fx.length}</span>
                {state.mode === 'm' ? (
                  <>
                    <span className="opacity-40 shrink-0">·</span>
                    <span className="shrink-0" title={`แฟนบอลสโมสร ${fmtFans(ensureTeamFans(me))} คน`}>
                      แฟน {fmtFansShort(ensureTeamFans(me))}
                    </span>
                    <span className="opacity-40 shrink-0">·</span>
                    <span className="shrink-0">บอร์ด {state.bd ?? 55}%</span>
                  </>
                ) : (
                  <>
                    <span className="opacity-40 shrink-0">·</span>
                    <span className="font-semibold text-[var(--mut)] tabular shrink-0">ฟิต {state.p?.en ?? 100}%</span>
                    <span className="opacity-40 shrink-0">·</span>
                    <span className="shrink-0" title={`แฟนบอลสโมสร ${fmtFans(ensureTeamFans(me))} คน`}>
                      แฟน {fmtFansShort(ensureTeamFans(me))}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Center Next Match Broadcast Strip */}
          <div className="flex items-center justify-center min-w-0 flex-1 max-w-[440px] mland:max-w-[340px]">
            {nextMatchInfo ? (
              <div className="w-full flex items-center justify-between gap-1.5 mland:gap-1 px-2.5 mland:px-1.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/90 border border-[var(--line)] min-w-0">
                <div className="flex items-center gap-1.5 mland:gap-1 min-w-0 flex-1">
                  <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] shrink-0 whitespace-nowrap">
                    {nextMatchInfo.kind === 'asia'
                      ? '🌏 ทวีป'
                      : nextMatchInfo.kind === 'sc'
                        ? '🏅 แชมเปี้ยนส์คัพ'
                        : nextMatchInfo.kind === 'lc'
                          ? '🥇 ลีกคัพ'
                          : nextMatchInfo.kind === 'dc'
                            ? '🛡️ ถ้วยดิวิชั่น'
                            : nextMatchInfo.kind === 'cup'
                              ? '🏆 ถ้วยปชช.'
                              : '⚽ นัดหน้า'}
                    {nextMatchInfo.isDerby && <span className="ml-0.5 text-[var(--red)]">🔥</span>}
                  </span>
                  <div className="shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px] mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                    <ClubCrest
                      name={state.teams[nextMatchInfo.homeId].name}
                      size={18}
                      team={state.teams[nextMatchInfo.homeId]}
                      club={state.club}
                      isMyClub={nextMatchInfo.homeId === state.me && state.mode === 'm'}
                    />
                  </div>
                  <div className="font-bold text-[11px] mland:text-[9.5px] truncate leading-tight min-w-0 flex-1 text-center">
                    {state.teams[nextMatchInfo.homeId].name} <span className="text-[var(--mut)] font-normal">vs</span> {state.teams[nextMatchInfo.awayId].name}
                  </div>
                  <div className="shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px] mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                    <ClubCrest
                      name={state.teams[nextMatchInfo.awayId].name}
                      size={18}
                      team={state.teams[nextMatchInfo.awayId]}
                      club={state.club}
                      isMyClub={nextMatchInfo.awayId === state.me && state.mode === 'm'}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectTeamId(nextMatchInfo.homeId === state.me ? nextMatchInfo.awayId : nextMatchInfo.homeId)}
                  className="btn btn-xs btn-surface hover:bg-[var(--g)] hover:text-white hover:border-[var(--g)] shrink-0"
                >
                  ส่อง
                </button>
              </div>
            ) : (
              <div className="w-full px-2.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 text-[11px] mland:text-[9.5px] font-bold truncate text-center text-[var(--ink)]">
                🏁 ครบโปรแกรมลีกแล้ว · กดสรุปจบฤดูกาล
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 mland:gap-1 shrink-0">
            <PWAInstallButton variant="compact" onToast={showToast} />
            <button
              type="button"
              onClick={handleTriggerNextStep}
              className="btn btn-md btn-gold sm:px-4 text-xs sm:text-sm mland:text-[10.5px]"
            >
              {nextMatchInfo
                ? appSettings.autoSkipMatch
                  ? nextMatchInfo.kind === 'asia'
                    ? '⏭️ ข้ามถ้วยทวีป'
                    : nextMatchInfo.kind === 'sc'
                      ? '⏭️ ข้ามแชมเปี้ยนส์คัพ'
                      : nextMatchInfo.kind === 'lc'
                        ? '⏭️ ข้ามลีกคัพ'
                        : nextMatchInfo.kind === 'dc'
                          ? '⏭️ ข้ามถ้วยดิวิชั่น'
                          : nextMatchInfo.kind === 'cup'
                            ? '⏭️ ข้ามถ้วยปชช.'
                            : `⏭️ ข้ามนัดที่ ${state.md + 1}`
                  : nextMatchInfo.kind === 'asia'
                    ? '🌏 แข่งถ้วยทวีป'
                    : nextMatchInfo.kind === 'sc'
                      ? '🏅 แข่งแชมเปี้ยนส์คัพ'
                      : nextMatchInfo.kind === 'lc'
                        ? '🥇 แข่งลีกคัพ'
                        : nextMatchInfo.kind === 'dc'
                          ? '🛡️ แข่งถ้วยดิวิชั่น'
                          : nextMatchInfo.kind === 'cup'
                            ? '🏆 แข่งถ้วยปชช.'
                            : `▶ แข่งนัดที่ ${state.md + 1}`
                : '🏁 สรุปจบฤดูกาล'}
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setShowSettings(true); }}
              aria-label="ตั้งค่า"
              title="ตั้งค่าเกม"
              className="btn-icon w-9 h-9 mland:w-7.5 mland:h-7.5"
            >
              <Settings className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {/* Center Game Stage */}
        <main ref={mainRef} className="flex-1 min-h-0 overflow-hidden flex flex-col overflow-x-hidden">
          <div className="w-full mx-auto px-3 sm:px-4 mland:px-2.5 py-2 sm:py-2.5 mland:py-1.5 flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5">

          {curTab === 't' && (
            <LeagueView
              key={`t-${navResetSeq}`}
              state={state}
              onInspectTeam={(tid) => setInspectTeamId(tid)}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onUpdateState={updateState}
              onShallowPatch={navigateShallow}
              onNavigate={navigateToTab}
              onOpenSeasonStats={(seasonNum) =>
                setSeasonStatsTarget(seasonNum ?? state.seasonArchives?.[0]?.season ?? state.season)
              }
              onToast={showToast}
            />
          )}
          {curTab === 'q' && (
            <SquadTacticsView
              key={`q-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onShallowPatch={navigateShallow}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onNavigate={navigateToTab}
              onToast={showToast}
            />
          )}
          {curTab === 'r' && state.mode === 'm' && (
            <TeamTrainingView
              key={`r-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onToast={showToast}
            />
          )}
          {curTab === 'k' && state.mode === 'm' && (
            <MarketView
              key={`k-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
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
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onOpenSeasonStats={(seasonNum) =>
                setSeasonStatsTarget(seasonNum ?? state.seasonArchives?.[0]?.season ?? state.season)
              }
              navIntent={navIntent}
            />
          )}
          {curTab === 'p' && state.mode === 'p' && (
            <PlayerCareerView
              key={`p-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onToast={showToast}
              onOpenSeasonStats={(seasonNum) =>
                setSeasonStatsTarget(seasonNum ?? state.seasonArchives?.[0]?.season ?? state.season)
              }
            />
          )}
          {curTab === 'k' && state.mode === 'p' && (
            <PlayerClubTransferView
              key={`pk-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onInspectTeam={(tid) => setInspectTeamId(tid)}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onToast={showToast}
            />
          )}
          </div>
        </main>

        {/* Pinned Left-Rail Game Console Dock */}
        <nav aria-label="เมนูหลักในเกม" className="shrink-0 z-30 bg-[var(--surface)]/98 border-r border-[var(--line)] order-first w-[74px] mland:w-[64px] h-full px-1.5 mland:px-1 py-2 mland:py-1.5 overflow-y-auto">
          <div className="flex flex-col gap-1.5 mland:gap-1 h-full justify-center">
            {tabs.map(([key, icon, label]) => {
              const active = curTab === key;
              let badgeCount = 0;
              if (state.mode === 'm' && key === 'k') {
                badgeCount = getIncomingOffers(state).length + (state.scout?.results ? 1 : 0);
              }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
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
                  }}
                  className={`relative flex-col py-1.5 px-1 mland:py-1 mland:px-0.5 text-[9.5px] mland:text-[8.5px] flex-1 min-h-[40px] max-h-[60px] mland:min-h-[36px] mland:max-h-[48px] rounded-xl mland:rounded-lg flex items-center justify-center gap-0.5 font-bold cursor-pointer transition-all min-w-0 ${
                    active
                      ? 'bg-gradient-to-b from-[#1a9657] to-[#147845] text-white shadow-[0_2px_8px_rgba(21,128,73,0.3)]'
                      : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]/85'
                  }`}
                >
                  {badgeCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--lamp)] text-[#261900] text-[8.5px] font-black leading-[15px] text-center tabular shadow-2xs">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                  <span className="text-base mland:text-[13px] leading-none">{icon}</span>
                  <span className="truncate max-w-full leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Modals */}
      {activeMatch && (
        <MatchModal
          state={state}
          kind={activeMatch.kind}
          homeId={activeMatch.homeId}
          awayId={activeMatch.awayId}
          isDerby={activeMatch.isDerby}
          onFinish={handleMatchFinish}
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

      {state.dilemma && !activeMatch && !seasonSummary && (
        <DilemmaModal
          dilemma={state.dilemma}
          onChoose={(idx) => {
            let msg = '';
            updateState((d) => {
              msg = applyDilemmaChoice(d, idx);
            });
            if (msg) showToast(msg);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          state={state}
          slot={slot}
          onClose={() => setShowSettings(false)}
          onExitToMenu={() => {
            flushPendingSave();
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
          onClose={() => setShowSecretBoost(false)}
          onOpenGodBlessing={() => setShowGodBlessing(true)}
          onUpdateState={updateState}
          onToast={showToast}
        />
      )}

      {showGodBlessing && (
        <GodBlessingModal
          state={state}
          onClose={() => setShowGodBlessing(false)}
          onUpdateState={updateState}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className="fixed bottom-16 sm:bottom-20 mland:bottom-2.5 left-1/2 mland:left-[calc(50%+35px)] -translate-x-1/2 z-[70] max-w-[92vw] mland:max-w-[76vw] px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--ink)]/95 text-[var(--bg)] border border-white/10 text-xs mland:text-[10.5px] font-bold shadow-xl text-center pointer-events-none">
          {toast}
        </div>
      )}
      <OfflineIndicator />
      <PWAUpdateBanner />
    </div>
  );
}

