import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  GameState,
  LiveMatchWorld,
  MatchCardEvent,
  MatchEvent,
  MatchSubEvent,
  Mentality,
  Player,
  SubRole,
  Team
} from '../types/game';
import { clamp } from '../utils/math';
import { AR_T, LINE } from '../data/thaiFootballData';
import { SFX, vibrate } from '../utils/audioTheme';
import { getFormationSlots, getShirtNo, playerPen } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import { FormationPitch, PlayerFace, type PitchPlayerMeta } from '../components/SvgVisuals';

export interface LivePlayerMatchStats {
  shots: number;
  onTarget: number;
  passes: number;
  tackles: number;
  saves: number;
  blocks: number;
  setpieces?: number;
  crossAssists?: number;
  keyPasses?: number;
  interceptions?: number;
  dribbles?: number;
  headers?: number;
}

interface LiveTacticsStudioProps {
  state: GameState;
  meTeamOrig: Team;
  oppTeamOrig: Team;
  liveHome: Team;
  liveAway: Team;
  meIsHome: boolean;
  homeKit: string;
  awayKit: string;
  homeGkKit: string;
  awayGkKit: string;
  homeTrim: string;
  awayTrim: string;
  liveLu: string[];
  liveOppLu: string[];
  benchList: Player[];
  subsUsed: string[];
  subLog: MatchSubEvent[];
  evs: MatchEvent[];
  matchCards: MatchCardEvent[];
  matchYellows: Record<string, number>;
  sentOff: string[];
  injuredNames: string[];
  liveFitMap: Record<string, number>;
  liveFormMap: Record<string, number>;
  livePlayerStats?: Record<string, LivePlayerMatchStats>;
  liveTac: Mentality;
  livePress: number;
  liveTempo: number;
  liveLine: number;
  liveWid: number;
  livePass: number;
  minute: number;
  matchPhaseUi: LiveMatchWorld['phase'];
  subAlertFitTh: number;
  subAlertFormTh: number;
  subPickOut: string | null;
  setSubPickOut: (name: string | null) => void;
  onSetTac: (tac: Mentality) => void;
  onSetPress: (v: number) => void;
  onSetTempo: (v: number) => void;
  onSetLine: (v: number) => void;
  onSetWid: (v: number) => void;
  onSetPass: (v: number) => void;
  onSubstitute: (outName: string, benchPlayer: Player) => void;
  onAutoSubstitute: (outName: string) => Player | null;
  onSwapStarters: (nameA: string, nameB: string) => void;
  findBestSubFor: (outName: string) => Player | null;
  onCloseAndResume: () => void;
  onCloseToStats: () => void;
  autoSubEnabled?: boolean;
  onToggleAutoSub?: () => void;
}

interface DragRuntime {
  source: 'bench' | 'pitch';
  player: Player;
  role?: SubRole;
  pitchIdx?: number;
  pointerId: number;
  isTouch: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  immediate: boolean;
  holdTimer?: number;
}

interface DropTargetState {
  kind: 'pitch' | 'bench';
  name: string;
  role?: SubRole;
  pitchIdx?: number;
}

const TOUCH_LIFT_PX = 36;

export const LiveTacticsStudio: React.FC<LiveTacticsStudioProps> = ({
  state,
  meTeamOrig,
  oppTeamOrig,
  liveHome,
  liveAway,
  meIsHome,
  homeKit,
  awayKit,
  homeGkKit,
  awayGkKit,
  homeTrim,
  awayTrim,
  liveLu,
  liveOppLu,
  benchList,
  subsUsed,
  subLog,
  evs,
  matchCards,
  matchYellows,
  sentOff,
  injuredNames,
  liveFitMap,
  liveFormMap,
  liveTac,
  livePress,
  liveTempo,
  liveLine,
  liveWid,
  livePass,
  matchPhaseUi,
  subAlertFitTh,
  subAlertFormTh,
  subPickOut,
  setSubPickOut,
  onSetTac,
  onSetPress,
  onSetTempo,
  onSetLine,
  onSetWid,
  onSetPass,
  onSubstitute,
  onAutoSubstitute,
  onSwapStarters,
  findBestSubFor,
  onCloseAndResume,
  onCloseToStats,
  autoSubEnabled,
  onToggleAutoSub
}) => {
  const [pitchTeamView, setPitchTeamView] = useState<'me' | 'opp'>('me');
  const [dragUi, setDragUi] = useState<{
    source: 'bench' | 'pitch';
    player: Player;
    role?: SubRole;
    x: number;
    y: number;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null);

  const pitchRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragRuntime | null>(null);

  const myLiveTeam = meIsHome ? liveHome : liveAway;
  const oppLiveTeam = meIsHome ? liveAway : liveHome;
  const isMeView = pitchTeamView === 'me';

  const activeTeam = isMeView ? meTeamOrig : oppTeamOrig;
  const activeLiveTeam = isMeView ? myLiveTeam : oppLiveTeam;
  const activeLu = isMeView ? liveLu : liveOppLu;
  const activeKit = isMeView ? (meIsHome ? homeKit : awayKit) : (meIsHome ? awayKit : homeKit);
  const activeGkKit = isMeView ? (meIsHome ? homeGkKit : awayGkKit) : (meIsHome ? awayGkKit : homeGkKit);
  const activeTrim = isMeView ? (meIsHome ? homeTrim : awayTrim) : (meIsHome ? awayTrim : homeTrim);

  const activeSlots = useMemo(() => getFormationSlots(activeLiveTeam), [activeLiveTeam]);

  const pitchNodes = useMemo(() => {
    return activeLu.map((name, i) => {
      const pl = activeTeam.sq.find((q) => q.n === name) || activeTeam.sq[i];
      const slot = activeSlots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
      const no = pl ? getShirtNo(activeTeam, pl) : i + 1;
      const fitVal = Math.round(liveFitMap[name] ?? pl?.fit ?? 100);
      const rt = Number((liveFormMap[name] ?? 6.5).toFixed(1));
      const goals = evs.filter((e) => !e.og && e.t === activeTeam.id && e.who === name).length;
      const assists = evs.filter((e) => e.t === activeTeam.id && e.as === name).length;
      const cards = matchCards.filter((c) => c.t === activeTeam.id && c.who === name);
      const isRed = sentOff.includes(name) || cards.some((c) => c.type === 'R' || c.type === 'Y2R');
      const yellowCnt = isRed ? 0 : (matchYellows[name] || (cards.some((c) => c.type === 'Y') ? 1 : 0));
      const isInjured = injuredNames.includes(name);
      const subInEv = subLog.find((s) => s.t === activeTeam.id && s.inPlayer === name);
      const offPosPen = pl ? playerPen(pl, slot.sp) : 0;
      const xPct = clamp(10 + (slot.x / 100) * 80, 10, 90);
      const yPct = clamp(12 + ((slot.y - 12) / 80) * 74, 12, 86);
      const nodeKit = slot.pos === 'GK' ? activeGkKit : activeKit;
      const nodeTrim = slot.pos === 'GK' ? '#ffffff' : activeTrim;
      return {
        idx: i,
        name,
        shortName: name.split(' ')[0] || name,
        player: pl,
        slot,
        no,
        fitVal,
        rt,
        goals,
        assists,
        isRed,
        yellowCnt,
        isInjured,
        subInEv,
        offPosPen,
        xPct,
        yPct,
        kit: nodeKit,
        trim: nodeTrim,
        isMe: Boolean(pl?.me)
      };
    });
  }, [
    activeLu,
    activeTeam,
    activeSlots,
    liveFitMap,
    liveFormMap,
    evs,
    matchCards,
    sentOff,
    matchYellows,
    injuredNames,
    subLog,
    activeGkKit,
    activeKit,
    activeTrim
  ]);

  const teamPitchStats = useMemo(() => {
    const alive = pitchNodes.filter((n) => !n.isRed);
    const avgFit = Math.round(alive.reduce((s, n) => s + n.fitVal, 0) / Math.max(1, alive.length));
    const avgRt = alive.reduce((s, n) => s + n.rt, 0) / Math.max(1, alive.length);
    const offPosCount = pitchNodes.filter((n) => n.offPosPen > 0).length;
    const lowFitCount = alive.filter((n) => n.fitVal <= subAlertFitTh).length;
    return { avgFit, avgRt, offPosCount, lowFitCount };
  }, [pitchNodes, subAlertFitTh]);

  const findNearestPitchTarget = (clientX: number, clientY: number, excludeName: string, liftPx: number): DropTargetState | null => {
    const host = pitchRef.current;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    const ty = clientY - liftPx;
    if (clientX < rect.left - 14 || clientX > rect.right + 14 || ty < rect.top - 14 || ty > rect.bottom + 14) {
      return null;
    }
    const nodes = host.querySelectorAll<Element>('[data-tactics-drop-player]');
    let best: { state: DropTargetState; dist: number } | null = null;
    nodes.forEach((el) => {
      const name = el.getAttribute('data-tactics-drop-player');
      if (!name || name === excludeName) return;
      if (el.getAttribute('data-tactics-disabled') === '1') return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.5;
      const d = Math.hypot(clientX - cx, ty - cy);
      if (d <= 54 && (!best || d < best.dist)) {
        best = {
          state: {
            kind: 'pitch',
            name,
            role: (el.getAttribute('data-tactics-drop-slot') as SubRole) || undefined,
            pitchIdx: Number(el.getAttribute('data-tactics-drop-idx') || '-1')
          },
          dist: d
        };
      }
    });
    return best ? (best as { state: DropTargetState }).state : null;
  };

  const findDropTarget = (
    clientX: number,
    clientY: number,
    source: 'bench' | 'pitch',
    excludeName: string,
    liftPx: number
  ): DropTargetState | null => {
    const ty = clientY - liftPx;
    const els = document.elementsFromPoint(clientX, ty);
    for (const el of els) {
      const pitchEl = (el as Element).closest?.('[data-tactics-drop-player]');
      if (pitchEl && pitchEl.getAttribute('data-tactics-disabled') !== '1') {
        const name = pitchEl.getAttribute('data-tactics-drop-player');
        if (name && name !== excludeName) {
          return {
            kind: 'pitch',
            name,
            role: (pitchEl.getAttribute('data-tactics-drop-slot') as SubRole) || undefined,
            pitchIdx: Number(pitchEl.getAttribute('data-tactics-drop-idx') || '-1')
          };
        }
      }
      if (source === 'pitch') {
        const benchEl = (el as Element).closest?.('[data-tactics-drop-bench]');
        if (benchEl) {
          const name = benchEl.getAttribute('data-tactics-drop-bench');
          if (name && name !== excludeName) {
            return {
              kind: 'bench',
              name,
              role: (benchEl.getAttribute('data-tactics-drop-slot') as SubRole) || undefined
            };
          }
        }
      }
    }
    return findNearestPitchTarget(clientX, clientY, excludeName, liftPx);
  };

  const actionsRef = useRef({
    benchList,
    subsUsed,
    sentOff,
    isMeView,
    onSubstitute,
    onSwapStarters,
    setSubPickOut,
    subPickOut,
    findDropTarget
  });
  actionsRef.current = {
    benchList,
    subsUsed,
    sentOff,
    isMeView,
    onSubstitute,
    onSwapStarters,
    setSubPickOut,
    subPickOut,
    findDropTarget
  };

  useEffect(() => {
    const clearDrag = () => {
      if (dragRef.current?.holdTimer) {
        window.clearTimeout(dragRef.current.holdTimer);
      }
      dragRef.current = null;
      setDragUi(null);
      setDropTarget(null);
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const dist = Math.hypot(dx, dy);

      if (!d.active) {
        if (!d.immediate) {
          if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx) * 1.15) {
            clearDrag();
            return;
          }
          if (dist > 8 && Math.abs(dx) >= Math.abs(dy)) {
            if (d.holdTimer) window.clearTimeout(d.holdTimer);
            d.active = true;
            d.immediate = true;
          }
        } else if (dist > 5) {
          d.active = true;
        }
      }
      if (!d.active) return;

      d.x = e.clientX;
      d.y = e.clientY;
      const liftPx = d.isTouch ? TOUCH_LIFT_PX : 0;
      setDragUi({
        source: d.source,
        player: d.player,
        role: d.role,
        x: e.clientX,
        y: e.clientY - (d.isTouch ? 24 : 0)
      });
      const hit = actionsRef.current.findDropTarget(e.clientX, e.clientY, d.source, d.player.n, liftPx);
      setDropTarget(hit);
    };

    const onTouchMove = (e: TouchEvent) => {
      const d = dragRef.current;
      if (d && (d.active || d.immediate)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const wasActive = d.active;
      const liftPx = d.isTouch ? TOUCH_LIFT_PX : 0;
      clearDrag();

      if (!wasActive) {
        if (d.source === 'pitch' && actionsRef.current.isMeView && !actionsRef.current.sentOff.includes(d.player.n)) {
          SFX.tap();
          actionsRef.current.setSubPickOut(actionsRef.current.subPickOut === d.player.n ? null : d.player.n);
        }
        return;
      }

      const hit = actionsRef.current.findDropTarget(e.clientX, e.clientY, d.source, d.player.n, liftPx);
      if (!hit) return;

      if (d.source === 'bench' && hit.kind === 'pitch') {
        if (actionsRef.current.subsUsed.length >= 5) return;
        actionsRef.current.onSubstitute(hit.name, d.player);
        return;
      }
      if (d.source === 'pitch' && hit.kind === 'bench') {
        if (actionsRef.current.subsUsed.length >= 5) return;
        const bObj = actionsRef.current.benchList.find((b) => b.n === hit.name);
        if (bObj) actionsRef.current.onSubstitute(d.player.n, bObj);
        return;
      }
      if (d.source === 'pitch' && hit.kind === 'pitch' && hit.name !== d.player.n) {
        actionsRef.current.onSwapStarters(d.player.n, hit.name);
      }
    };

    const onCancel = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      clearDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, []);

  const startPointerDrag = (
    e: React.PointerEvent,
    source: 'bench' | 'pitch',
    player: Player,
    role?: SubRole,
    pitchIdx?: number
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (source === 'bench' && subsUsed.length >= 5) return;
    if (source === 'pitch' && (!isMeView || sentOff.includes(player.n))) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest?.('button[data-no-drag="1"]')) return;

    if (dragRef.current?.holdTimer) {
      window.clearTimeout(dragRef.current.holdTimer);
    }

    const isTouch = e.pointerType !== 'mouse';
    const immediate = source === 'pitch' || !isTouch || Boolean(targetEl?.closest?.('[data-drag-grip="1"]'));
    if (immediate) {
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        // Ignore synthetic pointer errors
      }
    }

    let holdTimer: number | undefined;
    if (!immediate) {
      holdTimer = window.setTimeout(() => {
        const cur = dragRef.current;
        if (!cur || cur.pointerId !== e.pointerId || cur.active) return;
        cur.active = true;
        cur.immediate = true;
        vibrate(14);
        setDragUi({
          source: cur.source,
          player: cur.player,
          role: cur.role,
          x: cur.x,
          y: cur.y - 24
        });
        const hit = actionsRef.current.findDropTarget(cur.x, cur.y, cur.source, cur.player.n, TOUCH_LIFT_PX);
        setDropTarget(hit);
      }, 150);
    }

    dragRef.current = {
      source,
      player,
      role,
      pitchIdx,
      pointerId: e.pointerId,
      isTouch,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      immediate,
      holdTimer
    };
  };

  // Drag compatibility preview banner
  const dragCompatibilityBanner = useMemo(() => {
    if (!dragUi || !dropTarget) return null;
    if (dragUi.source === 'bench' && dropTarget.kind === 'pitch') {
      const outNode = pitchNodes.find((n) => n.name === dropTarget.name);
      if (!outNode) return null;
      const inFit = Math.round(dragUi.player.fit ?? 100);
      const fitDiff = inFit - outNode.fitVal;
      const slotSp = dropTarget.role || outNode.slot.sp;
      const pn = playerPen(dragUi.player, slotSp);
      const fitLabel = pn === 0 ? '✅ ตรงตำแหน่ง' : pn === 1 ? '🟡 เล่นแทนได้' : '⚠️ ต่างตำแหน่ง';
      return {
        tone: pn === 0 ? 'emerald' : pn === 1 ? 'amber' : 'rose',
        text: `🟢 ${dragUi.player.n.split(' ')[0]} (${dragUi.player.ro} · ${dragUi.player.ov}) แทน 🔴 ${outNode.shortName} (${slotSp}) · ${fitLabel} · ⚡${fitDiff >= 0 ? `+${fitDiff}` : fitDiff}%`
      };
    }
    if (dragUi.source === 'pitch' && dropTarget.kind === 'bench') {
      const benchObj = benchList.find((b) => b.n === dropTarget.name);
      const outNode = pitchNodes.find((n) => n.name === dragUi.player.n);
      if (!benchObj || !outNode) return null;
      const pn = playerPen(benchObj, outNode.slot.sp);
      const fitLabel = pn === 0 ? '✅ ตรงตำแหน่ง' : pn === 1 ? '🟡 เล่นแทนได้' : '⚠️ ต่างตำแหน่ง';
      return {
        tone: pn === 0 ? 'emerald' : pn === 1 ? 'amber' : 'rose',
        text: `🟢 ${benchObj.n.split(' ')[0]} (${benchObj.ro} · ${benchObj.ov}) แทน 🔴 ${outNode.shortName} (${outNode.slot.sp}) · ${fitLabel}`
      };
    }
    if (dragUi.source === 'pitch' && dropTarget.kind === 'pitch') {
      return {
        tone: 'sky',
        text: `🔀 สลับตำแหน่ง ${dragUi.player.n.split(' ')[0]} (${dragUi.role || dragUi.player.ro}) ↔ ${dropTarget.name.split(' ')[0]} (${dropTarget.role || ''})`
      };
    }
    return null;
  }, [dragUi, dropTarget, pitchNodes, benchList]);

  const pitchMatchMeta = useMemo(() => {
    const out: Record<string, PitchPlayerMeta> = {};
    pitchNodes.forEach((n) => {
      out[n.name] = {
        rating: n.rt,
        goals: n.goals,
        assists: n.assists,
        yellowCards: n.yellowCnt,
        isRed: n.isRed,
        isInjured: n.isInjured,
        subInMin: n.subInEv?.m,
        fitVal: n.fitVal,
        offPosPen: n.offPosPen
      };
    });
    return out;
  }, [pitchNodes]);

  const roleBadgeBg = (posOrSp: string) => {
    const line = LINE[posOrSp] || posOrSp;
    if (line === 'GK') return 'bg-purple-600';
    if (line === 'DF') return 'bg-blue-600';
    if (line === 'MF') return 'bg-amber-600';
    return 'bg-[var(--g)]';
  };

  const mySubsList = subLog.filter((s) => s.t === meTeamOrig.id);
  const mySlots = useMemo(() => getFormationSlots(myLiveTeam), [myLiveTeam]);
  const selectedPitchOut = useMemo(() => {
    if (subPickOut && liveLu.includes(subPickOut) && !sentOff.includes(subPickOut)) return subPickOut;
    return null;
  }, [subPickOut, liveLu, sentOff]);

  const selectedPitchOutObj = selectedPitchOut ? meTeamOrig.sq.find((q) => q.n === selectedPitchOut) : null;
  const selectedPitchOutIdx = selectedPitchOut ? liveLu.indexOf(selectedPitchOut) : -1;
  const selectedPitchOutSlot = selectedPitchOutIdx >= 0 ? mySlots[selectedPitchOutIdx]?.sp : undefined;

  const smartAutoSub = useMemo(() => {
    if (subsUsed.length >= 5 || benchList.length === 0) return null;

    if (selectedPitchOut) {
      const cand = findBestSubFor(selectedPitchOut);
      if (cand) {
        const fitVal = Math.round(liveFitMap[selectedPitchOut] ?? selectedPitchOutObj?.fit ?? 100);
        return {
          outName: selectedPitchOut,
          outShort: selectedPitchOut.split(' ')[0] || selectedPitchOut,
          outFit: fitVal,
          isInjured: injuredNames.includes(selectedPitchOut),
          inPlayer: cand,
          isExplicitPick: true
        };
      }
    }

    const candidates = liveLu
      .map((name, idx) => {
        const pl = meTeamOrig.sq.find((q) => q.n === name);
        const slot = mySlots[idx] || { sp: pl?.ro || 'CM', pos: pl?.pos || 'MF' };
        const cards = matchCards.filter((c) => c.t === meTeamOrig.id && c.who === name);
        const isRed = sentOff.includes(name) || cards.some((c) => c.type === 'R' || c.type === 'Y2R');
        if (isRed) return null;
        const fitVal = Math.round(liveFitMap[name] ?? pl?.fit ?? 100);
        const rt = Number((liveFormMap[name] ?? 6.5).toFixed(1));
        const isInj = injuredNames.includes(name);
        const yellowCnt = matchYellows[name] || (cards.some((c) => c.type === 'Y') ? 1 : 0);
        const offPen = pl ? playerPen(pl, slot.sp) : 0;
        const urgencyScore =
          (isInj ? -1000 : 0) +
          (slot.pos === 'GK' && !isInj && fitVal >= 45 ? 120 : 0) +
          fitVal -
          (rt < 5.9 ? 10 : 0) -
          (yellowCnt > 0 ? 5 : 0) -
          (offPen > 0 ? 4 : 0);
        return { name, fitVal, isInj, urgencyScore };
      })
      .filter((x): x is { name: string; fitVal: number; isInj: boolean; urgencyScore: number } => Boolean(x))
      .sort((a, b) => a.urgencyScore - b.urgencyScore);

    for (const target of candidates) {
      const cand = findBestSubFor(target.name);
      if (cand) {
        return {
          outName: target.name,
          outShort: target.name.split(' ')[0] || target.name,
          outFit: target.fitVal,
          isInjured: target.isInj,
          inPlayer: cand,
          isExplicitPick: false
        };
      }
    }
    return null;
  }, [
    subsUsed.length,
    benchList.length,
    selectedPitchOut,
    selectedPitchOutObj,
    findBestSubFor,
    liveFitMap,
    injuredNames,
    liveLu,
    meTeamOrig,
    mySlots,
    matchCards,
    sentOff,
    liveFormMap,
    matchYellows
  ]);

  return (
    <div className="grid grid-cols-[1.28fr_1fr] mland:grid-cols-[1.22fr_1fr] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden relative">
      {/* Floating Drag Ghost Badge */}
      {dragUi && (
        <div
          className="fixed z-[120] pointer-events-none flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-[var(--surface)]/95 border-2 border-[var(--lamp)] shadow-2xl max-w-[225px]"
          style={{
            left: typeof window !== 'undefined' ? clamp(dragUi.x - 95, 8, window.innerWidth - 230) : dragUi.x - 95,
            top: typeof window !== 'undefined' ? clamp(dragUi.y - 54, 8, window.innerHeight - 66) : dragUi.y - 54
          }}
        >
          <div className="shrink-0 [&_svg]:w-7 [&_svg]:h-7">
            <PlayerFace player={dragUi.player} team={meTeamOrig} state={state} careerProfile={state.p} size={28} />
          </div>
          <div className="min-w-0 text-[11px]">
            <div className="font-bold truncate flex items-center gap-1">
              <span>{dragUi.player.n.split(' ')[0]}</span>
              <span className="px-1 rounded bg-[var(--surface-2)] text-[9.5px] font-extrabold">{dragUi.role || dragUi.player.ro}</span>
              <span className="text-[var(--g)] font-extrabold tabular">{dragUi.player.ov}</span>
            </div>
            <div className="text-[10px] font-semibold text-[var(--mut)] truncate">
              {dropTarget
                ? dropTarget.kind === 'pitch'
                  ? dragUi.source === 'bench'
                    ? `🟢 ลงแทน ${dropTarget.name.split(' ')[0]}`
                    : `🔀 สลับกับ ${dropTarget.name.split(' ')[0]}`
                  : `🔴 ออกแทนด้วย ${dropTarget.name.split(' ')[0]}`
                : dragUi.source === 'bench'
                  ? 'ลากไปวางบนนักเตะในแผนผัง'
                  : 'ลากสลับตำแหน่ง หรือวางบนสำรอง'}
            </div>
          </div>
        </div>
      )}

      {/* LEFT COLUMN: Unified SVG Formation Pitch + Detailed Player Stats Strip */}
      <div className="flex flex-col min-h-0 gap-2 mland:gap-1.5 overflow-hidden">
        <div className="flex-1 min-h-0 rounded-2xl mland:rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--surface)] shadow-xs flex flex-col">
          {/* Pitch Top Bar */}
          <div className="shrink-0 px-2.5 py-1.5 mland:px-2 mland:py-1 bg-[var(--surface-2)]/85 border-b border-[var(--line)] flex items-center justify-between gap-2 text-[var(--ink)]">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] mland:text-[9.5px] font-bold">
              <span className="truncate">
                📋 แผน {activeLiveTeam.cf ? 'กำหนดเอง' : activeLiveTeam.form}
                {isMeView ? ` · ${AR_T[liveTac]}` : ''}
              </span>
              <span className="text-[var(--mut)]/50">·</span>
              <span className="tabular text-[var(--g)] shrink-0">{teamPitchStats.avgFit}% ⚡</span>
              <span className="text-[var(--mut)]/50">·</span>
              <span className="tabular text-[#b45309] dark:text-[var(--lamp)] shrink-0">{teamPitchStats.avgRt.toFixed(1)} ⭐</span>
              {teamPitchStats.offPosCount > 0 && (
                <span className="text-[10px] mland:text-[8.5px] text-amber-600 dark:text-amber-300 font-bold tabular shrink-0">
                  · {teamPitchStats.offPosCount} ⚠️
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10px] mland:text-[8.5px] shrink-0">
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setPitchTeamView('me');
                }}
                className={`px-2 mland:px-1.5 py-0.5 rounded-md font-bold cursor-pointer whitespace-nowrap max-w-[96px] truncate ${
                  isMeView ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                {meTeamOrig.name}
              </button>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setPitchTeamView('opp');
                }}
                className={`px-2 mland:px-1.5 py-0.5 rounded-md font-bold cursor-pointer whitespace-nowrap max-w-[96px] truncate ${
                  !isMeView ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                {oppTeamOrig.name}
              </button>
            </div>
          </div>

          {/* Drag Compatibility Live Banner (Appears cleanly during drag) */}
          {dragCompatibilityBanner && (
            <div
              className={`shrink-0 px-2.5 py-1 text-[10.5px] mland:text-[9px] font-bold text-center truncate border-b border-[var(--line)] ${
                dragCompatibilityBanner.tone === 'emerald'
                  ? 'bg-emerald-600/95 text-white'
                  : dragCompatibilityBanner.tone === 'amber'
                    ? 'bg-amber-500/95 text-[#1c1300]'
                    : dragCompatibilityBanner.tone === 'rose'
                      ? 'bg-rose-600/95 text-white'
                      : 'bg-sky-600/95 text-white'
              }`}
            >
              {dragCompatibilityBanner.text}
            </div>
          )}

          {/* Unified Interactive SVG Formation Pitch */}
          <div
            ref={pitchRef}
            onContextMenu={(e) => e.preventDefault()}
            className="relative flex-1 min-h-0 w-full p-2 mland:p-1.5 select-none overflow-hidden flex items-center justify-center"
          >
            <FormationPitch
              team={activeLiveTeam}
              state={state}
              lineupNames={activeLu}
              kitOverride={activeKit}
              gkKitOverride={activeGkKit}
              trimOverride={activeTrim}
              matchMeta={pitchMatchMeta}
              statMode="rating"
              showFitBar={true}
              dragSourceName={isMeView && dragUi?.source === 'pitch' ? dragUi.player.n : null}
              dropTargetName={isMeView && dropTarget?.kind === 'pitch' ? dropTarget.name : null}
              selectedPlayerName={isMeView ? subPickOut : null}
              validDropHighlight={isMeView && dragUi?.source === 'bench' && subsUsed.length < 5}
              subAlertFitTh={subAlertFitTh}
              disableRedPlayers={true}
              dropAttrPrefix={isMeView ? 'tactics' : 'default'}
              onPlayerPointerDown={
                isMeView
                  ? (e, player, slotSp, slotIdx) => {
                      startPointerDrag(e, 'pitch', player, slotSp, slotIdx);
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Consistent Top Tab Switcher + Sub Quota/Resume Bar + Substitutes Bench + Tactical Orders */}
      <div className="flex flex-col min-h-0 gap-1.5 mland:gap-1 overflow-hidden">
        {/* Same 2-Tab Switcher as Match Stats View */}
        <div className="grid grid-cols-2 shrink-0 gap-1 p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] mland:text-[10px]">
          <button
            type="button"
            onClick={onCloseToStats}
            className="min-h-[28px] mland:min-h-[26px] py-0.5 px-1.5 rounded-lg font-bold cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap truncate text-[var(--mut)] hover:text-[var(--ink)]"
          >
            <span>📊 สถิติ &amp; ไทม์ไลน์</span>
          </button>
          <button
            type="button"
            className="min-h-[28px] mland:min-h-[26px] py-0.5 px-1.5 rounded-lg font-bold cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap truncate bg-[var(--g)] text-white shadow-xs"
          >
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded bg-black/15 dark:bg-white/20 tabular font-extrabold text-[9.5px] mland:text-[8.5px]">
              {5 - subsUsed.length}
            </span>
            <span>📋 แผน</span>
          </button>
        </div>

        {/* Sub Quota & Resume Match Action Bar */}
        <div className="shrink-0 px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-1.5">
          <div className="min-w-0 flex items-center gap-1.5 text-[11px] mland:text-[9.5px] font-bold">
            <span className="px-1.5 py-0.2 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[10px] mland:text-[8.5px] font-extrabold tabular shrink-0">
              {5 - subsUsed.length}/5
            </span>
            <span className="truncate">📋 แก้เกม &amp; 🔄 เปลี่ยนตัว</span>
          </div>
          <button
            type="button"
            onClick={onCloseAndResume}
            className="px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-[10.5px] mland:text-[9px] font-extrabold cursor-pointer shadow-xs hover:brightness-110 whitespace-nowrap shrink-0"
          >
            {matchPhaseUi === 'halftime' ? '✅ บันทึก & กลับพักครึ่ง' : '✅ ใช้แผน & เล่นต่อ ▶'}
          </button>
        </div>

        {/* Scrollable Bench + Tactical Orders */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-2 mland:space-y-1.5">
          {/* Draggable Substitutes Bench */}
          <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-1.5 mland:space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] mland:text-[9.5px]">
              <span className="font-bold text-[var(--g)] flex items-center gap-1 shrink-0">
                <span className="tabular font-extrabold">{benchList.length}</span>
                <span>🪑 ตัวสำรอง</span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {onToggleAutoSub && (
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      onToggleAutoSub();
                    }}
                    title="ออโต้ปรับตำแหน่งระหว่างเกม & เปลี่ยนตัวอัตโนมัติ (สลับตำแหน่งให้ตรงบทบาทและส่งตัวฟิต/ดาวรุ่งลง)"
                    className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg text-[10px] mland:text-[8.5px] font-extrabold border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      autoSubEnabled
                        ? 'bg-emerald-500/18 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {autoSubEnabled ? '🤖 ออโต้: เปิด' : '🤖 ออโต้: ปิด'}
                  </button>
                )}
                {subsUsed.length < 5 && smartAutoSub ? (
                  <button
                    type="button"
                    onClick={() => {
                      const rep = onAutoSubstitute(smartAutoSub.outName);
                      if (rep) setSubPickOut(null);
                    }}
                    title={`เปลี่ยนตัวอัตโนมัติ: ส่ง ${smartAutoSub.inPlayer.n} (${smartAutoSub.inPlayer.ro} · ${smartAutoSub.inPlayer.ov}) ลงแทน ${smartAutoSub.outName}`}
                    className="px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-[10.5px] mland:text-[9px] font-extrabold cursor-pointer hover:brightness-110 shadow-xs whitespace-nowrap shrink-0"
                  >
                    ⚡ เปลี่ยนทันที
                  </button>
                ) : (
                  <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold truncate">
                    {subsUsed.length >= 5 ? 'ใช้โควต้าเปลี่ยนตัวครบ 5 คนแล้ว' : 'ไม่มีตัวสำรองที่พร้อมลงสนาม'}
                  </span>
                )}
              </div>
            </div>

            {subsUsed.length < 5 && smartAutoSub && (
              <div className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 flex items-center justify-between gap-2 text-[10px] mland:text-[8.5px]">
                <span className="truncate text-[var(--mut)]">
                  <b className="text-[var(--ink)]">
                    {smartAutoSub.isExplicitPick ? 'ที่เลือก:' : smartAutoSub.isInjured ? 'บาดเจ็บ:' : 'แนะนำ:'}
                  </b>{' '}
                  <span className="text-[var(--red)] font-bold">
                    {smartAutoSub.outShort} ({smartAutoSub.outFit}%{smartAutoSub.isInjured ? ' 🩹' : ''})
                  </span>{' '}
                  ⇄{' '}
                  <span className="text-[var(--g)] font-bold">
                    {smartAutoSub.inPlayer.n.split(' ')[0]} ({smartAutoSub.inPlayer.ro} · {smartAutoSub.inPlayer.ov})
                  </span>
                </span>
                {smartAutoSub.isExplicitPick ? (
                  <button
                    type="button"
                    onClick={() => setSubPickOut(null)}
                    className="text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer shrink-0"
                  >
                    ✕ ยกเลิกเลือก
                  </button>
                ) : (
                  <span className="text-[9px] mland:text-[8px] text-[var(--mut)] shrink-0 hidden sm:inline">หรือลากเปลี่ยนเอง</span>
                )}
              </div>
            )}

            {benchList.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-[var(--mut)]">ไม่มีตัวสำรองที่พร้อมลงสนาม</div>
            ) : (
              <div className="space-y-1">
                {benchList.map((pl) => {
                  const f = Math.round(pl.fit ?? 100);
                  const fCol = f >= 85 ? 'var(--g)' : f >= 65 ? '#c98a00' : 'var(--red)';
                  const no = getShirtNo(meTeamOrig, pl);
                  const isDraggingThis = dragUi?.source === 'bench' && dragUi.player.n === pl.n;
                  const isBenchDropTarget = dropTarget?.kind === 'bench' && dropTarget.name === pl.n;
                  const isAutoRecommended = subsUsed.length < 5 && smartAutoSub?.inPlayer.n === pl.n;
                  const compatPen = selectedPitchOutSlot ? playerPen(pl, selectedPitchOutSlot) : selectedPitchOutObj ? playerPen(pl, selectedPitchOutObj.ro) : null;
                  const canQuickSub = subsUsed.length < 5 && Boolean(selectedPitchOut);

                  return (
                    <div
                      key={pl.n}
                      role="button"
                      tabIndex={0}
                      data-tactics-drop-bench={pl.n}
                      data-tactics-drop-slot={pl.ro}
                      onPointerDown={(e) => startPointerDrag(e, 'bench', pl, pl.ro)}
                      onContextMenu={(e) => e.preventDefault()}
                      onKeyDown={(e) => {
                        if (canQuickSub && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onSubstitute(selectedPitchOut!, pl);
                        }
                      }}
                      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                      className={`w-full flex items-center gap-1.5 px-1.5 py-1 mland:py-0.5 rounded-lg border text-left select-none transition-all ${
                        isBenchDropTarget
                          ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] ring-2 ring-[var(--lamp)]/50 scale-[1.01]'
                          : isDraggingThis
                            ? 'opacity-40 border-dashed border-[var(--lamp)] bg-[var(--surface)]'
                            : isAutoRecommended
                              ? 'bg-[var(--g-soft)]/45 border-[var(--g)]/70'
                              : compatPen === 0
                                ? 'bg-[var(--surface)] border-[var(--g)]/55'
                                : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--g)]'
                      } ${subsUsed.length < 5 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer opacity-75'}`}
                    >
                      <span
                        data-drag-grip={subsUsed.length < 5 ? '1' : undefined}
                        style={
                          subsUsed.length < 5
                            ? { touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }
                            : undefined
                        }
                        title={subsUsed.length < 5 ? 'ลากลงสนามเพื่อเปลี่ยนตัว' : 'ใช้โควต้าครบแล้ว'}
                        className="flex items-center gap-1 shrink-0 py-0.5 pr-0.5 [&_svg]:w-4 [&_svg]:h-4"
                      >
                        <PlayerFace player={pl} team={meTeamOrig} state={state} careerProfile={state.p} size={20} />
                        <span className="text-[9.5px] font-bold tabular text-[var(--mut)] min-w-[20px] text-center">#{no}</span>
                        <span className={`px-1 py-0.2 rounded text-[8.5px] font-extrabold text-white ${roleBadgeBg(pl.ro)}`}>{pl.ro}</span>
                      </span>

                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <span className="text-[10.5px] mland:text-[9.5px] font-semibold truncate">{pl.n}</span>
                        {(pl.hg || pl.customCreated) && (
                          <span title="เด็กปั้นสโมสร" className="text-[9.5px] shrink-0">🌱</span>
                        )}
                        {compatPen === 0 && (
                          <span className="px-1 py-0.2 rounded bg-[var(--g-soft)] text-[var(--g)] text-[8.5px] font-extrabold shrink-0 whitespace-nowrap">
                            ตรงตำแหน่ง
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 tabular">
                        <div className="flex flex-col items-end gap-0.5 w-9 mland:w-8" title={`พลังงาน ${f}%`}>
                          <span className="text-[9px] mland:text-[8px] font-extrabold leading-none" style={{ color: fCol }}>
                            {f}% ⚡
                          </span>
                          <div className="w-full h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${clamp(f, 4, 100)}%`, backgroundColor: fCol }} />
                          </div>
                        </div>
                        <span className="px-1.5 py-0.2 rounded-md text-white text-[10px] mland:text-[9px] font-bold" style={{ background: ovColor(pl.ov) }}>
                          {pl.ov}
                        </span>
                        {canQuickSub && (
                          <button
                            type="button"
                            data-no-drag="1"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSubstitute(selectedPitchOut!, pl);
                            }}
                            title={`ส่ง ${pl.n} ลงแทน ${selectedPitchOut!.split(' ')[0]}`}
                            className="px-1.5 py-0.5 rounded bg-[var(--g)] text-white text-[9px] font-extrabold cursor-pointer hover:brightness-110 shrink-0"
                          >
                            ส่งลง
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mySubsList.length > 0 && (
              <div className="pt-1 border-t border-[var(--line)] flex flex-wrap items-center gap-1 text-[10px] mland:text-[8.5px]">
                <span className="font-bold text-[var(--mut)]">เปลี่ยนแล้ว:</span>
                {mySubsList.map((sb, i) => (
                  <span key={i} className="px-1.5 py-0.2 rounded bg-[var(--surface)] border border-[var(--line)] tabular">
                    {sb.m}&apos; 🟢{sb.inPlayer.split(' ')[0]} ↔ 🔴{sb.outPlayer.split(' ')[0]}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Live Tactical Controls */}
          <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-2 mland:space-y-1">
            <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] flex items-center justify-between">
              <span>📋 คำสั่งแท็กติกสด</span>
              <span className="text-[9.5px] mland:text-[8px] font-semibold text-[var(--mut)]">มีผลทันทีในสนาม</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-1.5 text-[10.5px] mland:text-[9px]">
              <div>
                <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] mb-0.5">🎯 สไตล์ (Mentality)</div>
                <div className="flex flex-wrap gap-1">
                  {([
                    { m: 'X' as Mentality, icon: '🔥' },
                    { m: 'A' as Mentality, icon: '⚔️' },
                    { m: 'B' as Mentality, icon: '⚖️' },
                    { m: 'D' as Mentality, icon: '🛡️' },
                    { m: 'Z' as Mentality, icon: '🧱' }
                  ]).map(({ m, icon }) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onSetTac(m)}
                      className={`px-2 py-0.5 rounded-md font-bold cursor-pointer border inline-flex items-center gap-1 ${
                        liveTac === m
                          ? 'bg-[var(--g)] border-[var(--g)] text-white'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
                      }`}
                    >
                      <span>{icon}</span>
                      <span>{AR_T[m]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] mb-0.5">⚽ สไตล์จ่ายบอล</div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { lbl: 'บอลสั้น', icon: '🎯' },
                    { lbl: 'ผสม', icon: '🔀' },
                    { lbl: 'บอลยาว', icon: '↗️' },
                    { lbl: 'เกมสวน', icon: '💨' }
                  ].map(({ lbl, icon }, idx) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => onSetPass(idx)}
                      className={`px-2 py-0.5 rounded-md font-bold cursor-pointer border inline-flex items-center gap-1 ${
                        livePass === idx
                          ? 'bg-[var(--g)] border-[var(--g)] text-white'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
                      }`}
                    >
                      <span>{icon}</span>
                      <span>{lbl}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10px] mland:text-[8.5px]">
              <div>
                <div className="font-bold text-[var(--mut)] mb-0.5">🏃 เพรสซิ่ง</div>
                <div className="flex gap-1">
                  {['ต่ำ', 'กลาง', 'สูง'].map((lbl, k) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => onSetPress(k)}
                      className={`flex-1 py-0.5 rounded-md font-bold cursor-pointer border ${
                        livePress === k
                          ? 'bg-[var(--g)] border-[var(--g)] text-white'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-bold text-[var(--mut)] mb-0.5">⏱️ จังหวะเกม</div>
                <div className="flex gap-1">
                  {['ช้า', 'กลาง', 'เร็ว'].map((lbl, k) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => onSetTempo(k)}
                      className={`flex-1 py-0.5 rounded-md font-bold cursor-pointer border ${
                        liveTempo === k
                          ? 'bg-[var(--g)] border-[var(--g)] text-white'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-bold text-[var(--mut)] mb-0.5">🚧 แนวรับ</div>
                <div className="flex gap-1">
                  {['ลึก', 'กลาง', 'สูง'].map((lbl, k) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => onSetLine(k)}
                      className={`flex-1 py-0.5 rounded-md font-bold cursor-pointer border ${
                        liveLine === k
                          ? 'bg-[var(--g)] border-[var(--g)] text-white'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-bold text-[var(--mut)] mb-0.5">↔️ ความกว้าง</div>
                <div className="flex gap-1">
                  {['แคบ', 'กลาง', 'กว้าง'].map((lbl, k) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => onSetWid(k)}
                      className={`flex-1 py-0.5 rounded-md font-bold cursor-pointer border ${
                        liveWid === k
                          ? 'bg-[var(--g)] border-[var(--g)] text-white'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
