import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OfflineIndicator, PWAInstallButton, PWAUpdateBanner } from './pwa.tsx';
import { exitFullscreenSafe, getFullscreenElement, onFullscreenChange } from './utils/fullscreen';
import type { GameMode, MainTab, Player, Team, PlayerCareerProfile, MatchCardEvent, MatchResult, GameState, AppSettings, FinishedMatchPayload } from './types/game';
import { P, clamp, fmtMoney } from './utils/math';
import { RN, TN, BASE, POS } from './data/thaiFootballData';
import { getSettings, applyTheme, SFX, triggerConfetti } from './utils/audioTheme';
import { saveGameToSlot, assignTeamShirtNumbers, mkPlayer, pen, ovMe, logFin, pushFeed } from './engine/playerCore';
import { simMatch, applyMatchResult, createNewGame, startSeason, tallyMatchPlayers, applyMatchCards, creditPlayerPerf, applyDilemmaChoice, pickWinner, afterMatchDay, growPlayers, finishSeasonComputation, simulateInstantMatchPayload } from './engine/simulation';
import { ClubCrest } from './components/SvgVisuals';
import { MainMenu } from './views/MainMenuView';
import { LeagueView } from './views/LeagueView';
import { SquadTacticsView } from './views/SquadTacticsView';
import { TeamTrainingView } from './views/TeamTrainingView';
import { MarketView } from './views/MarketView';
import { FinanceClubView } from './views/FinanceClubView';
import { PlayerCareerView } from './views/PlayerCareerView';
import { MatchModal } from './modals/MatchModal';
import { GodBlessingModal } from './modals/GodBlessingModal';
import { PlayerInspectorModal, TeamInspectorModal } from './modals/InspectorModals';
import type { SeasonSummaryData } from './modals/SeasonEndModal';
import { SeasonEndModal } from './modals/SeasonEndModal';
import { DilemmaModal } from './modals/DilemmaModal';
import { SecretBoostModal } from './modals/SecretBoostModal';
import { SettingsModal } from './modals/SettingsModal';

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [slot, setSlot] = useState<number>(1);
  const [toast, setToast] = useState<string | null>(null);
  const [inspectPlayer, setInspectPlayer] = useState<{ player: Player; team: Team | null } | null>(null);
  const [inspectTeamId, setInspectTeamId] = useState<number | null>(null);
  const [activeMatch, setActiveMatch] = useState<{ kind: 'league' | 'cup' | 'asia'; homeId: number; awayId: number; isDerby: boolean } | null>(null);
  const [seasonSummary, setSeasonSummary] = useState<SeasonSummaryData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSecretBoost, setShowSecretBoost] = useState(false);
  const [showGodBlessing, setShowGodBlessing] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getSettings());
  const godBlessingEnabled = appSettings.godBlessingEnabled !== false;
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(getFullscreenElement()));
  const [navResetSeq, setNavResetSeq] = useState(0);
  const [navIntent, setNavIntent] = useState<{ tab: MainTab; sub?: string; ts: number } | null>(null);

  useEffect(() => onFullscreenChange(setIsFullscreen), []);

  const exitFullscreenQuick = () => {
    SFX.tap();
    exitFullscreenSafe().catch(() => undefined);
  };

  const mainRef = useRef<HTMLElement | null>(null);
  const crestTapRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  const navigateToTab = (tab: MainTab, sub?: string) => {
    setNavIntent({ tab, sub, ts: Date.now() });
    setNavResetSeq((n) => n + 1);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    updateState((d) => {
      if (tab === 'c') {
        d.v = 't';
        d.tv = 4;
        d.sub = 0;
        return;
      }
      if (tab === 'q' && sub === 'training') {
        d.v = 'r';
        d.tv = 0;
        d.sub = 0;
        return;
      }
      d.v = tab;
      d.tv = tab === 't' ? (sub === 'cup' ? 4 : sub === 'awards' ? 5 : 0) : 0;
      d.sub = tab === 'q' ? (sub === 'tactics' ? 1 : sub === 'squad' ? 2 : 0) : 0;
      if (tab === 't') d.lg = d.teams[d.me].tier;
    });
  };

  useEffect(() => {
    const st = getSettings();
    applyTheme(st.theme);
  }, []);

  useEffect(() => {
    if (state) saveGameToSlot(state, slot);
  }, [state, slot]);

  const updateState = (updater: (draft: GameState) => void) => {
    setState((prev) => {
      if (!prev) return prev;
      const clone: GameState = JSON.parse(JSON.stringify(prev));
      updater(clone);
      return clone;
    });
  };

  const handleStartManager = (targetSlot: number, names: string[][], t0: Team[], pick: number, diff: number) => {
    const fresh = createNewGame('m', { names, t0, pick });
    fresh.diff = diff;
    setSlot(targetSlot);
    setState(fresh);
    saveGameToSlot(fresh, targetSlot);
    showToast(`รับตำแหน่งผู้จัดการทีม ${fresh.teams[fresh.me].name} แล้ว!`);
  };

  const handleStartPlayer = (
    targetSlot: number,
    profile: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'>
  ) => {
    const fresh = createNewGame('p', { player: profile });
    fresh.v = 'p';
    setSlot(targetSlot);
    setState(fresh);
    saveGameToSlot(fresh, targetSlot);
    showToast(`เซ็นสัญญาเริ่มต้นกับ ${fresh.teams[fresh.me].name} แล้ว!`);
  };

  const handleLoadSave = (_mode: GameMode, targetSlot: number, loaded: GameState) => {
    setSlot(targetSlot);
    setState(loaded);
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

  const commitFinishedMatch = (
    matchInfo: { kind: 'league' | 'cup' | 'asia'; homeId: number; awayId: number; isDerby: boolean },
    payload: FinishedMatchPayload
  ) => {
    const { kind, homeId, awayId, isDerby } = matchInfo;

    updateState((d) => {
      const me = d.teams[d.me];
      if (d.mode === 'm') {
        me.tac = payload.finalTac;
      }

      const H = d.teams[homeId];
      const A = d.teams[awayId];
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
        playedNames: payload.playedNames
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

      if (kind === 'cup') {
        const c = d.cup;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        for (let i = 0; i < c.ids.length; i += 2) {
          const ch = d.teams[c.ids[i]];
          const ca = d.teams[c.ids[i + 1]];
          if (ch.id === homeId && ca.id === awayId) {
            nx[i / 2] = userWin.id;
            c.log.push(`${RN[c.r]}: ${ch.name} ${payload.gh}-${payload.ga} ${ca.name}${payload.penText ? ` (${payload.penText})` : ''}`);
          } else {
            const cr = simMatch(ch, ca, d);
            const cw = pickWinner(ch, ca, cr, d);
            nx[i / 2] = cw.id;
            c.log.push(`${RN[c.r]}: ${ch.name} ${cr.gh}-${cr.ga} ${ca.name}`);
          }
        }
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
          if (nx[0] === d.me && d.mode === 'm') {
            d.money += 250;
            logFin(d, 'รางวัลแชมป์ถ้วยประชาชน', 250);
            d.trophies = [...(d.trophies || []), { season: d.season, title: 'แชมป์ถ้วยประชาชน', type: 'cup' }];
            d.mgrRep = (d.mgrRep || 50) + 75;
            triggerConfetti();
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
        if (d.mode === 'p' && payload.pf) creditPlayerPerf(d, payload.pf);
        return;
      }

      if (kind === 'asia' && d.ac) {
        const c = d.ac;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        for (let i = 0; i < c.ids.length; i += 2) {
          const ah = d.teams[c.ids[i]];
          const aa = d.teams[c.ids[i + 1]];
          if (ah.id === homeId && aa.id === awayId) {
            nx[i / 2] = userWin.id;
            c.log.push(`${RN[c.r]}: ${ah.name} ${payload.gh}-${payload.ga} ${aa.name}${payload.penText ? ` (${payload.penText})` : ''}`);
          } else {
            const ar = simMatch(ah, aa, d);
            const aw = pickWinner(ah, aa, ar, d);
            nx[i / 2] = aw.id;
            c.log.push(`${RN[c.r]}: ${ah.name} ${ar.gh}-${ar.ga} ${aa.name}`);
          }
        }
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
          if (nx[0] === d.me && d.mode === 'm') {
            d.money += 500;
            logFin(d, 'รางวัลแชมป์ทวีป', 500);
            d.trophies = [...(d.trophies || []), { season: d.season, title: 'แชมป์สโมสรทวีป', type: 'asia' }];
            d.mgrRep = (d.mgrRep || 50) + 120;
            triggerConfetti();
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
        if (d.mode === 'p' && payload.pf) creditPlayerPerf(d, payload.pf);
        return;
      }

      // League Matchday
      if (isDerby) d.derby = 1;
      applyMatchResult(H, payload.gh, A, payload.ga);
      tallyMatchPlayers(H, A, resObj);

      const roundCards: { h: Team; a: Team; cards?: MatchCardEvent[] }[] = [
        { h: H, a: A, cards: payload.cards }
      ];

      // Simulate remaining fixtures in user's league & other tiers
      d.fx[d.md].forEach(([fidH, fidA]) => {
        if ((fidH === homeId && fidA === awayId) || (fidH === awayId && fidA === homeId)) return;
        const th = d.teams[fidH];
        const ta = d.teams[fidA];
        const r = simMatch(th, ta, d);
        applyMatchResult(th, r.gh, ta, r.ga);
        tallyMatchPlayers(th, ta, r);
        roundCards.push({ h: th, a: ta, cards: r.cards });
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
            roundCards.push({ h: th, a: ta, cards: r.cards });
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
      if (diff > (d.records.bestWin?.diff || 0)) {
        d.records.bestWin = { txt: line, diff };
      }
      if (diff > 0) {
        d.records.curStreak = (d.records.curStreak || 0) + 1;
        if (d.records.curStreak > (d.records.winStreak || 0)) d.records.winStreak = d.records.curStreak;
      } else {
        d.records.curStreak = 0;
      }

      if (d.mode === 'm') {
        const isHomeMatch = homeId === d.me;
        const tpIdx = d.tp ?? 1;
        const spIdx = d.sp ?? 0;
        const ticketMult = [0.82, 1.0, 1.24][tpIdx];
        const ticket = isHomeMatch
          ? Math.round((8 + (d.st ?? 1) * 7) * ((d.fan ?? 55) / 60) * ticketMult * (d.promo === 1 ? 1.35 : 1))
          : 0;
        const merch = isHomeMatch
          ? Math.round((2 + (d.merchLv ?? 1) * 3) * ((d.fan ?? 55) / 55))
          : 0;
        const baseSp = spIdx === 0 ? 8 + me.tier * 6 : spIdx === 1 ? 4 + me.tier * 4 : 5 + me.tier * 5;
        const winSpBonus = spIdx === 1 && diff > 0 ? 10 + me.tier * 6 : 0;
        const derbySpBonus = spIdx === 2 && isDerby ? 18 + me.tier * 8 : 0;
        const sponsor = Math.round((baseSp + winSpBonus + derbySpBonus) * (d.promo === 2 ? 1.35 : 1));
        if (ticket) {
          d.money += ticket;
          logFin(d, `ค่าตั๋วเข้าชมเกมเหย้า (${d.promo === 1 ? 'โปรโมชั่น' : ['ราคาถูก', 'ราคากลาง', 'ราคาแพง'][tpIdx]})`, ticket);
        }
        if (merch) {
          d.money += merch;
          logFin(d, 'ขายของที่ระลึกวันแข่งเหย้า', merch);
        }
        d.money += sponsor;
        logFin(d, `สปอนเซอร์หลัก${winSpBonus ? ' + โบนัสชนะ' : derbySpBonus ? ' + โบนัสดาร์บี้' : ''}`, sponsor);
        if (d.winBonus && diff > 0) {
          d.money -= d.winBonus;
          logFin(d, 'จ่ายโบนัสอัดฉีดชัยชนะ', -d.winBonus);
        }
        const ticketFanAdj = isHomeMatch ? (tpIdx === 0 ? 1 : tpIdx === 2 && diff <= 0 ? -1 : 0) : 0;
        d.promo = 0;
        d.winBonus = 0;
        d.fan = clamp((d.fan ?? 55) + (diff > 0 ? 3 : diff < 0 ? -3 : 0) + ticketFanAdj, 5, 100);
        d.mor = clamp((d.mor ?? 55) + (diff > 0 ? 5 : diff < 0 ? -5 : 1), 0, 100);
      } else if (payload.pf) {
        creditPlayerPerf(d, payload.pf);
      }

      d.md++;
      applyLiveInjuries();
      afterMatchDay(d, { teamIds: liveInjTeamIds, playerNames: liveInjNames });
      if (d.mode === 'm' && payload.subs.length > 0) {
        payload.subs.forEach((sb) => {
          if (sb.t !== d.me) return;
          const outPl = me.sq.find((q) => q.n === sb.outPlayer);
          if (outPl && sb.m < 85) {
            const restBonus = Math.round(clamp((90 - sb.m) / 8, 2, 7));
            outPl.fit = clamp((outPl.fit ?? 100) + restBonus, 30, 100);
          }
        });
      }
      roundCards.forEach((rc) => applyMatchCards(d, rc.h, rc.a, rc.cards));
    });
  };

  const handleMatchFinish = (payload: FinishedMatchPayload) => {
    if (!state || !activeMatch) return;
    const finished = activeMatch;
    setActiveMatch(null);
    commitFinishedMatch(finished, payload);
  };

  const handleTriggerNextStep = () => {
    if (!state) return;
    SFX.tap();
    if (nextMatchInfo) {
      if (appSettings.autoSkipMatch) {
        const simState: GameState = JSON.parse(JSON.stringify(state));
        if (nextMatchInfo.isDerby) simState.derby = 1;
        const payload = simulateInstantMatchPayload(simState, nextMatchInfo.kind, nextMatchInfo.homeId, nextMatchInfo.awayId);
        commitFinishedMatch(nextMatchInfo, payload);
        const H = state.teams[nextMatchInfo.homeId];
        const A = state.teams[nextMatchInfo.awayId];
        const myGf = nextMatchInfo.homeId === state.me ? payload.gh : payload.ga;
        const myGa = nextMatchInfo.homeId === state.me ? payload.ga : payload.gh;
        if (myGf > myGa) SFX.win();
        showToast(`⏭️ จบเกม: ${H.name} ${payload.gh}-${payload.ga} ${A.name}${payload.penText ? ` (${payload.penText})` : ''}`);
        return;
      }
      if (nextMatchInfo.isDerby) {
        updateState((d) => { d.derby = 1; });
      }
      setActiveMatch(nextMatchInfo);
      return;
    }
    if (state.md >= state.fx.length) {
      const clone: GameState = JSON.parse(JSON.stringify(state));
      const summary = finishSeasonComputation(clone);
      setState(clone);
      setSeasonSummary(summary);
    }
  };

  const handleStartNextSeason = (transferToTeamId?: number) => {
    if (!state) return;
    if (state.sack === 1) {
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
          const newT = d.teams[transferToTeamId];
          const repIdx = newT.sq.findIndex((q) => q.pos === mePlayer.pos);
          newT.sq.splice(repIdx >= 0 ? repIdx : 0, 1, mePlayer);
          assignTeamShirtNumbers(newT);
          d.p.no = mePlayer.no;
          d.me = transferToTeamId;
          d.hist.push(`✍️ ย้ายซบ ${newT.name} (${TN[newT.tier]}) ในซีซั่น ${d.season + 1}`);
        }
      }
      d.season++;
      d.yth = Array.from({ length: 4 }, () => mkPlayer(P(POS), BASE[d.teams[d.me].tier] - 2 + (d.ya ?? 1) * 2, true));
      startSeason(d);
      pushFeed(d, 'ฤดูกาลใหม่', `🚀 เปิดฉากฤดูกาลที่ ${d.season} · ${TN[d.teams[d.me].tier]}`, 'ok');
    });
    showToast(`เริ่มต้นฤดูกาลที่ ${state.season + 1} แล้ว!`);
  };

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
          <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-xs font-bold shadow-lg">
            {toast}
          </div>
        )}
        <OfflineIndicator />
        <PWAUpdateBanner />
      </>
    );
  }

  const me = state.teams[state.me];
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
          ['p', '🌟', 'อาชีพ'],
          ['t', '🏆', 'การแข่งขัน'],
          ['q', '⚽', 'ทีม & แผน']
        ];

  const resolvedView: MainTab =
    state.v === 'c'
      ? 't'
      : state.v === 'q' && state.mode === 'm' && state.sub === 3
        ? 'r'
        : state.v;
  const curTab: MainTab = tabs.some(([k]) => k === resolvedView) ? resolvedView : tabs[0][0];

  return (
    <div className="h-full min-h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      {/* Pinned Top Game HUD Bar */}
      <header className="shrink-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--line)] shadow-[0_1px_4px_rgba(0,0,0,0.04)] safe-top safe-x">
        <div className="max-w-6xl mland:max-w-none mx-auto px-3 sm:px-5 mland:px-2.5 py-2 mland:py-1 flex items-center justify-between gap-2 mland:gap-1.5">
          <div className="flex items-center gap-2 mland:gap-1.5 min-w-0 shrink lg:max-w-[34%] mland:max-w-[33%]">
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
              <ClubCrest name={me.name} size={32} team={me} club={state.club} isMyClub={state.mode === 'm'} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-xs sm:text-sm mland:text-[11.5px] truncate font-display leading-tight tracking-tight">
                  {state.mode === 'p' && state.p ? `${state.p.name} · ` : ''}
                  {me.name}
                </span>
                <span className="hidden mland:inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--g-soft)] text-[var(--g)] font-bold text-[9px] tabular shrink-0">
                  {state.mode === 'm' ? fmtMoney(state.money) : `OVR ${state.p ? ovMe(state.p) : 60}`}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] mland:text-[8.5px] text-[var(--mut)] flex items-center gap-x-1 truncate tabular leading-tight">
                <span className="truncate font-medium">{TN[me.tier]}</span>
                <span className="opacity-40 shrink-0">·</span>
                <span className="shrink-0">ซ.{state.season}</span>
                <span className="opacity-40 shrink-0">·</span>
                <span className="shrink-0">นัด {Math.min(state.md, state.fx.length)}/{state.fx.length}</span>
                <span className="opacity-40 shrink-0 mland:hidden">·</span>
                {state.mode === 'm' ? (
                  <>
                    <span className="font-bold text-[var(--g)] tabular shrink-0 mland:hidden">{fmtMoney(state.money)}</span>
                    <span className="hidden sm:inline mland:inline opacity-40 shrink-0">·</span>
                    <span className="hidden sm:inline mland:inline shrink-0">❤️{state.fan ?? 55}%</span>
                    <span className="hidden lg:inline mland:inline shrink-0">👔{state.bd ?? 55}%</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-[var(--g)] tabular shrink-0 mland:hidden">OVR {state.p ? ovMe(state.p) : 60}</span>
                    <span className="font-semibold text-[var(--mut)] tabular shrink-0">· ฟิต {state.p?.en ?? 100}%</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Center Next Match Pill (Tablet / Desktop / Mobile Landscape) */}
          <div className="hidden md:flex mland:flex items-center justify-center min-w-0 flex-1 max-w-[430px] mland:max-w-[310px]">
            {nextMatchInfo ? (
              <div className="w-full flex items-center justify-between gap-1.5 mland:gap-1 px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/85 border border-[var(--line)] min-w-0">
                <div className="flex items-center gap-1.5 mland:gap-1 min-w-0 flex-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)]/70 text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] shrink-0 whitespace-nowrap">
                    {nextMatchInfo.kind === 'asia' ? '🌏 ทวีป' : nextMatchInfo.kind === 'cup' ? '🏆 ถ้วย' : '⚽ นัดหน้า'}
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
                  className="px-2 mland:px-1.5 py-0.5 rounded-lg mland:rounded-md bg-[var(--surface)] hover:bg-[var(--g)] hover:text-white border border-[var(--line)]/80 text-[10px] mland:text-[8.5px] font-bold shrink-0 cursor-pointer transition-colors"
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
            {isFullscreen && (
              <button
                type="button"
                onClick={exitFullscreenQuick}
                aria-label="ออกจากโหมดเต็มจอ"
                title="ออกจากโหมดเต็มจอ"
                className="min-h-[34px] mland:min-h-[28px] px-2 mland:px-1.5 py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] hover:bg-[var(--line)]/50 border border-[var(--line)] text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] cursor-pointer shrink-0 whitespace-nowrap"
              >
                ✕ ย่อจอ
              </button>
            )}
            <button
              type="button"
              onClick={handleTriggerNextStep}
              className="min-h-[34px] mland:min-h-[28px] px-2.5 sm:px-3.5 mland:px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-gradient-to-b from-[#fad05a] to-[#eab308] text-[#261900] font-bold text-xs sm:text-sm mland:text-[10.5px] hover:brightness-105 transition-all cursor-pointer shadow-[0_2px_8px_rgba(234,179,8,0.28)] whitespace-nowrap border border-[#ca8a04]/30"
            >
              {nextMatchInfo
                ? appSettings.autoSkipMatch
                  ? nextMatchInfo.kind === 'asia'
                    ? '⏭️ ข้ามถ้วยทวีป'
                    : nextMatchInfo.kind === 'cup'
                      ? '⏭️ ข้ามถ้วยปชช.'
                      : `⏭️ ข้ามนัดที่ ${state.md + 1}`
                  : nextMatchInfo.kind === 'asia'
                    ? '🌏 แข่งถ้วยทวีป'
                    : nextMatchInfo.kind === 'cup'
                      ? '🏆 แข่งถ้วยปชช.'
                      : `▶ แข่งนัดที่ ${state.md + 1}`
                : '🏁 สรุปจบฤดูกาล'}
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setShowSettings(true); }}
              aria-label="ตั้งค่า"
              className="w-8 h-8 sm:w-9 sm:h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg bg-[var(--surface-2)] hover:bg-[var(--line)]/50 border border-[var(--line)] flex items-center justify-center text-sm mland:text-xs cursor-pointer shrink-0"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Mobile Portrait Ultra-Compact Next Match Strip inside Top Header */}
        <div className="flex md:hidden mland:hidden items-center justify-between gap-2 px-3 py-1 border-t border-[var(--line)]/55 bg-[var(--surface-2)]/45">
          {nextMatchInfo ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)]/70 text-[9px] font-bold text-[var(--mut)] shrink-0 whitespace-nowrap">
                {nextMatchInfo.kind === 'asia' ? '🌏 ทวีป' : nextMatchInfo.kind === 'cup' ? '🏆 ถ้วย' : '⚽ นัดหน้า'}
                {nextMatchInfo.isDerby && <span className="ml-0.5 text-[var(--red)]">🔥</span>}
              </span>
              <div className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">
                <ClubCrest
                  name={state.teams[nextMatchInfo.homeId].name}
                  size={16}
                  team={state.teams[nextMatchInfo.homeId]}
                  club={state.club}
                  isMyClub={nextMatchInfo.homeId === state.me && state.mode === 'm'}
                />
              </div>
              <span className="font-bold text-[11px] truncate min-w-0 flex-1 leading-tight">
                {state.teams[nextMatchInfo.homeId].name} <span className="text-[var(--mut)] font-normal">vs</span> {state.teams[nextMatchInfo.awayId].name}
              </span>
              <div className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">
                <ClubCrest
                  name={state.teams[nextMatchInfo.awayId].name}
                  size={16}
                  team={state.teams[nextMatchInfo.awayId]}
                  club={state.club}
                  isMyClub={nextMatchInfo.awayId === state.me && state.mode === 'm'}
                />
              </div>
            </div>
          ) : (
            <span className="text-[10.5px] font-bold truncate text-[var(--ink)]">🏁 ครบโปรแกรมลีกแล้ว</span>
          )}
          <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-[var(--mut)] tabular">
            <span>❤️<b>{state.fan ?? 55}%</b></span>
            {state.mode === 'm' && <span>👔<b>{state.bd ?? 55}%</b></span>}
            {nextMatchInfo && (
              <button
                type="button"
                onClick={() => setInspectTeamId(nextMatchInfo.homeId === state.me ? nextMatchInfo.awayId : nextMatchInfo.homeId)}
                className="px-2 py-0.5 rounded-md bg-[var(--surface)] hover:bg-[var(--g)] hover:text-white border border-[var(--line)] text-[10px] font-bold text-[var(--ink)] cursor-pointer"
              >
                ส่อง
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col mland:flex-row overflow-hidden">
        {/* Center Scrollable Game Stage */}
        <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden mland:flex mland:flex-col overflow-x-hidden mland:pr-[env(safe-area-inset-right,0px)]">
          <div className="max-w-6xl mland:max-w-none mland:w-full mx-auto px-3 sm:px-5 mland:px-2.5 py-2.5 sm:py-3 mland:py-1.5 space-y-2.5 sm:space-y-3 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">

          {curTab === 't' && (
            <LeagueView
              key={`t-${navResetSeq}`}
              state={state}
              onInspectTeam={(tid) => setInspectTeamId(tid)}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onUpdateState={updateState}
              onNavigate={navigateToTab}
              onToast={showToast}
            />
          )}
          {curTab === 'q' && (
            <SquadTacticsView
              key={`q-${navResetSeq}`}
              state={state}
              onUpdateState={updateState}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onOpenGodBlessing={godBlessingEnabled ? () => setShowGodBlessing(true) : undefined}
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
              onToast={showToast}
              navIntent={navIntent}
            />
          )}
          {curTab === 'p' && state.mode === 'p' && (
            <PlayerCareerView key={`p-${navResetSeq}`} state={state} onUpdateState={updateState} onToast={showToast} />
          )}
          </div>
        </main>

        {/* Pinned Bottom / Mobile-Landscape Left-Rail Navigation Dock */}
        <nav aria-label="เมนูหลักในเกม" className="shrink-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--line)] safe-bottom mland:pl-[env(safe-area-inset-left,0px)] mland:order-first mland:w-[calc(62px+env(safe-area-inset-left,0px))] mland:h-full mland:border-t-0 mland:border-r mland:px-1 mland:py-1.5 mland:overflow-y-auto">
          <div
            className="max-w-6xl mx-auto px-1.5 sm:px-5 py-1.5 grid gap-1 mland:!flex mland:flex-col mland:gap-1 mland:h-full mland:justify-center mland:px-0 mland:py-0"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map(([key, icon, label]) => {
              const active = curTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setNavIntent(null);
                    setNavResetSeq((n) => n + 1);
                    if (mainRef.current) mainRef.current.scrollTop = 0;
                    updateState((d) => {
                      d.v = key;
                      d.tv = 0;
                      d.sub = 0;
                      d.lg = d.teams[d.me].tier;
                    });
                  }}
                  className={`relative py-1.5 px-1 sm:px-2 mland:!flex-col mland:py-1 mland:px-0.5 mland:text-[8.5px] mland:flex-1 mland:min-h-[36px] mland:max-h-[48px] rounded-xl mland:rounded-lg flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs font-bold cursor-pointer transition-all min-w-0 ${
                    active
                      ? 'bg-gradient-to-b from-[#1a9657] to-[#147845] text-white shadow-[0_2px_8px_rgba(21,128,73,0.3)]'
                      : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]/85'
                  }`}
                >
                  <span className="text-sm sm:text-base mland:text-[13px] leading-none">{icon}</span>
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
          isFullscreen={isFullscreen}
          onExitFullscreen={exitFullscreenQuick}
          onFinish={handleMatchFinish}
        />
      )}

      {inspectTeamId !== null && state.teams[inspectTeamId] && (
        <TeamInspectorModal
          team={state.teams[inspectTeamId]}
          state={state}
          onClose={() => setInspectTeamId(null)}
          onInspectPlayer={(p, t) => {
            setInspectPlayer({ player: p, team: t });
          }}
        />
      )}

      {inspectPlayer && (
        <PlayerInspectorModal
          player={inspectPlayer.player}
          team={inspectPlayer.team}
          state={state}
          onClose={() => setInspectPlayer(null)}
          onUpdateState={updateState}
          onToast={showToast}
          godBlessingEnabled={godBlessingEnabled}
        />
      )}

      {seasonSummary && (
        <SeasonEndModal
          state={state}
          summary={seasonSummary}
          onStartNextSeason={handleStartNextSeason}
        />
      )}

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
          onClose={() => setShowSettings(false)}
          onExitToMenu={() => setState(null)}
          onOpenGodBlessing={() => setShowGodBlessing(true)}
          onOpenSecretBoost={() => setShowSecretBoost(true)}
          onToast={showToast}
          onSettingsChange={(next) => {
            setAppSettings(next);
            if (next.godBlessingEnabled === false) setShowGodBlessing(false);
          }}
        />
      )}

      {showSecretBoost && (
        <SecretBoostModal
          state={state}
          onClose={() => setShowSecretBoost(false)}
          onOpenGodBlessing={godBlessingEnabled ? () => setShowGodBlessing(true) : undefined}
          onUpdateState={updateState}
          onToast={showToast}
        />
      )}

      {showGodBlessing && godBlessingEnabled && (
        <GodBlessingModal
          state={state}
          onClose={() => setShowGodBlessing(false)}
          onUpdateState={updateState}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className="fixed bottom-16 sm:bottom-20 mland:bottom-2.5 left-1/2 mland:left-[calc(50%+35px)] -translate-x-1/2 z-[70] max-w-[92vw] mland:max-w-[76vw] px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--ink)]/92 backdrop-blur-md text-[var(--bg)] border border-white/10 text-xs mland:text-[10.5px] font-bold shadow-xl text-center pointer-events-none">
          {toast}
        </div>
      )}
      <OfflineIndicator />
      <PWAUpdateBanner />
    </div>
  );
}

