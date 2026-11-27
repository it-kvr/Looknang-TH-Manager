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
import { AR_T } from '../data/thaiFootballData';
import { SFX, vibrate } from '../utils/audioTheme';
import { getFormationSlots, getShirtNo, playerPen } from '../engine/playerCore';
import { fmtFansShort } from '../engine/simulation';
import { Check } from 'lucide-react';
import { FormationPitch, PlayerFace, ClubCrest, type PitchPlayerMeta } from '../components/SvgVisuals';
import { MatchPlayerThumb } from './MatchSharedComponents';
import { PlayerStatusBadge } from '../components/PlayerStatusBadge';
import { PositionBadge } from '../components/PositionBadge';
import { CaptainBadge } from '../components/CaptainBadge';
import { StatIconBadge } from '../components/StatIconBadge';
import { MyTeamBadge } from '../components/MyTeamBadge';
import { OvrBadge } from '../components/OvrBadge';

export type ManagerHalftimeTalk = 'attack' | 'press' | 'balanced' | 'counter' | 'defend';

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
  onCloseToStats: () => void;
  onCloseToChat?: () => void;
  liveViewers?: number;
  autoSubEnabled?: boolean;
  onToggleAutoSub?: () => void;
  selectedHalftimeTalk?: ManagerHalftimeTalk;
  onSetHalftimeTalk?: (tone: ManagerHalftimeTalk) => void;
  pitchMode?: 'all' | 'H' | 'A';
  onChangePitchMode?: (mode: 'all' | 'H' | 'A') => void;
  statMode?: 'rating' | 'ovr';
  onToggleStatMode?: () => void;
  matchStats?: {
    possH: number;
    shotsH: number;
    shotsA: number;
    onTargetH: number;
    onTargetA: number;
    xgH: number;
    xgA: number;
  };
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
  onCloseToStats,
  onCloseToChat,
  liveViewers,
  autoSubEnabled,
  onToggleAutoSub,
  selectedHalftimeTalk = 'balanced',
  onSetHalftimeTalk,
  pitchMode,
  onChangePitchMode,
  statMode,
  onToggleStatMode,
  matchStats
}) => {
  const [localPitchMode, setLocalPitchMode] = useState<'all' | 'H' | 'A'>(() => (meIsHome ? 'H' : 'A'));
  const effectivePitchMode = pitchMode ?? localPitchMode;
  const setEffectivePitchMode = (mode: 'all' | 'H' | 'A') => {
    if (onChangePitchMode) onChangePitchMode(mode);
    else setLocalPitchMode(mode);
  };
  const effectiveStatMode = statMode ?? 'rating';
  const mySubsCountNow = subLog.filter((s) => s.t === meTeamOrig.id).length;
  const prevMySubsCountRef = useRef<number>(mySubsCountNow);
  const [recentSubAnim, setRecentSubAnim] = useState<{
    inName: string;
    outName: string;
    minute: number;
    key: number;
  } | null>(null);
  const subAnimTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mySubs = subLog.filter((s) => s.t === meTeamOrig.id);
    if (mySubs.length > prevMySubsCountRef.current) {
      const latest = mySubs[mySubs.length - 1];
      if (latest) {
        if (subAnimTimerRef.current) window.clearTimeout(subAnimTimerRef.current);
        setRecentSubAnim({
          inName: latest.inPlayer,
          outName: latest.outPlayer,
          minute: latest.m,
          key: Date.now()
        });
        subAnimTimerRef.current = window.setTimeout(() => {
          setRecentSubAnim(null);
        }, 2500);
      }
    }
    prevMySubsCountRef.current = mySubs.length;
  }, [subLog, meTeamOrig.id]);

  useEffect(() => () => {
    if (subAnimTimerRef.current) window.clearTimeout(subAnimTimerRef.current);
  }, []);

  const [dragUi, setDragUi] = useState<{
    source: 'bench' | 'pitch';
    player: Player;
    role?: SubRole;
  } | null>(null);
  const dragUiRef = useRef<{
    source: 'bench' | 'pitch';
    player: Player;
    role?: SubRole;
  } | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragGhostPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null);

  const pitchRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragRuntime | null>(null);

  const updateDragGhostPos = (rawX: number, rawY: number) => {
    const gx = typeof window !== 'undefined' ? clamp(rawX - 95, 8, window.innerWidth - 230) : rawX - 95;
    const gy = typeof window !== 'undefined' ? clamp(rawY - 54, 8, window.innerHeight - 66) : rawY - 54;
    dragGhostPosRef.current = { x: gx, y: gy };
    if (dragGhostRef.current) {
      dragGhostRef.current.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    }
  };

  const setDragUiIfChanged = (
    next: { source: 'bench' | 'pitch'; player: Player; role?: SubRole } | null
  ) => {
    const prev = dragUiRef.current;
    if (
      (prev?.source ?? null) === (next?.source ?? null) &&
      (prev?.player.n ?? null) === (next?.player.n ?? null) &&
      (prev?.role ?? null) === (next?.role ?? null)
    ) {
      return;
    }
    dragUiRef.current = next;
    setDragUi(next);
  };

  const setDropTargetIfChanged = (next: DropTargetState | null) => {
    setDropTarget((prev) => {
      if (!prev && !next) return prev;
      if (
        prev &&
        next &&
        prev.kind === next.kind &&
        prev.name === next.name &&
        (prev.role ?? null) === (next.role ?? null) &&
        (prev.pitchIdx ?? null) === (next.pitchIdx ?? null)
      ) {
        return prev;
      }
      return next;
    });
  };

  const homeOrig = meIsHome ? meTeamOrig : oppTeamOrig;
  const awayOrig = meIsHome ? oppTeamOrig : meTeamOrig;
  const curHomeLu = meIsHome ? liveLu : liveOppLu;
  const curAwayLu = meIsHome ? liveOppLu : liveLu;

  const myLiveTeam = meIsHome ? liveHome : liveAway;
  const myTeamSide: 'H' | 'A' = meIsHome ? 'H' : 'A';
  const canInteractWithMyPitch = effectivePitchMode === 'all' || effectivePitchMode === myTeamSide;

  const buildTeamPitchMeta = (teamOrig: Team, xiNames: string[]): Record<string, PitchPlayerMeta> => {
    const out: Record<string, PitchPlayerMeta> = {};
    const slots = getFormationSlots(teamOrig.id === liveHome.id ? liveHome : liveAway);
    xiNames.forEach((name, i) => {
      const pl = teamOrig.sq.find((q) => q.n === name) || teamOrig.sq[i];
      const slot = slots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
      const fitVal = Math.round(liveFitMap[name] ?? pl?.fit ?? 100);
      const rt = Number((liveFormMap[name] ?? 6.5).toFixed(1));
      const goals = evs.filter((e) => !e.og && e.t === teamOrig.id && e.who === name).length;
      const assists = evs.filter((e) => !e.og && e.t === teamOrig.id && e.as === name).length;
      const cards = matchCards.filter((c) => c.t === teamOrig.id && c.who === name);
      const isRed = sentOff.includes(name) || cards.some((c) => c.type === 'R' || c.type === 'Y2R');
      const yellowCards = isRed ? 0 : (matchYellows[name] || (cards.some((c) => c.type === 'Y') ? 1 : 0));
      const isInjured = injuredNames.includes(name);
      const subInEv = subLog.find((s) => s.t === teamOrig.id && s.inPlayer === name);
      const offPosPen = pl ? playerPen(pl, slot.sp) : 0;
      out[name] = {
        rating: rt,
        goals,
        assists,
        yellowCards,
        isRed,
        isInjured,
        subInMin: subInEv?.m,
        fitVal,
        offPosPen
      };
    });
    return out;
  };

  const homePitchMeta = useMemo(
    () => buildTeamPitchMeta(homeOrig, curHomeLu),
    [homeOrig, liveHome, liveAway, curHomeLu, liveFitMap, liveFormMap, evs, matchCards, sentOff, matchYellows, injuredNames, subLog]
  );

  const awayPitchMeta = useMemo(
    () => buildTeamPitchMeta(awayOrig, curAwayLu),
    [awayOrig, liveHome, liveAway, curAwayLu, liveFitMap, liveFormMap, evs, matchCards, sentOff, matchYellows, injuredNames, subLog]
  );

  const mySlots = useMemo(() => getFormationSlots(myLiveTeam), [myLiveTeam]);

  const myPitchNodes = useMemo(() => {
    return liveLu.map((name, i) => {
      const pl = meTeamOrig.sq.find((q) => q.n === name) || meTeamOrig.sq[i];
      const slot = mySlots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
      const fitVal = Math.round(liveFitMap[name] ?? pl?.fit ?? 100);
      return {
        idx: i,
        name,
        shortName: name.split(' ')[0] || name,
        player: pl,
        slot,
        fitVal
      };
    });
  }, [liveLu, meTeamOrig, mySlots, liveFitMap]);

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
    canInteractWithMyPitch,
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
    canInteractWithMyPitch,
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
      setDragUiIfChanged(null);
      setDropTargetIfChanged(null);
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
      updateDragGhostPos(e.clientX, e.clientY - (d.isTouch ? 24 : 0));
      setDragUiIfChanged({
        source: d.source,
        player: d.player,
        role: d.role
      });
      const hit = actionsRef.current.findDropTarget(e.clientX, e.clientY, d.source, d.player.n, liftPx);
      setDropTargetIfChanged(hit);
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
        if (d.source === 'pitch' && actionsRef.current.canInteractWithMyPitch && !actionsRef.current.sentOff.includes(d.player.n)) {
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
    if (source === 'pitch' && (!canInteractWithMyPitch || sentOff.includes(player.n))) return;
    if (source === 'bench' && !canInteractWithMyPitch) {
      setEffectivePitchMode(myTeamSide);
    }
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
        updateDragGhostPos(cur.x, cur.y - 24);
        setDragUiIfChanged({
          source: cur.source,
          player: cur.player,
          role: cur.role
        });
        const hit = actionsRef.current.findDropTarget(cur.x, cur.y, cur.source, cur.player.n, TOUCH_LIFT_PX);
        setDropTargetIfChanged(hit);
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
      const outNode = myPitchNodes.find((n) => n.name === dropTarget.name);
      if (!outNode) return null;
      const inFit = Math.round(dragUi.player.fit ?? 100);
      const fitDiff = inFit - outNode.fitVal;
      const slotSp = dropTarget.role || outNode.slot.sp;
      const pn = playerPen(dragUi.player, slotSp);
      const fitLabel = pn === 0 ? '✅ ตรงตำแหน่ง' : pn === 1 ? '🟡 เล่นแทนได้' : '⚠️ ต่างตำแหน่ง';
      return {
        tone: pn === 0 ? 'emerald' : pn === 1 ? 'amber' : 'rose',
        text: `🔼 เข้า ${dragUi.player.n.split(' ')[0]} (${dragUi.player.ro} · ${dragUi.player.ov}) · 🔽 ออก ${outNode.shortName} (${slotSp}) · ${fitLabel} · ⚡${fitDiff >= 0 ? `+${fitDiff}` : fitDiff}%`
      };
    }
    if (dragUi.source === 'pitch' && dropTarget.kind === 'bench') {
      const benchObj = benchList.find((b) => b.n === dropTarget.name);
      const outNode = myPitchNodes.find((n) => n.name === dragUi.player.n);
      if (!benchObj || !outNode) return null;
      const pn = playerPen(benchObj, outNode.slot.sp);
      const fitLabel = pn === 0 ? '✅ ตรงตำแหน่ง' : pn === 1 ? '🟡 เล่นแทนได้' : '⚠️ ต่างตำแหน่ง';
      return {
        tone: pn === 0 ? 'emerald' : pn === 1 ? 'amber' : 'rose',
        text: `🔼 เข้า ${benchObj.n.split(' ')[0]} (${benchObj.ro} · ${benchObj.ov}) · 🔽 ออก ${outNode.shortName} (${outNode.slot.sp}) · ${fitLabel}`
      };
    }
    if (dragUi.source === 'pitch' && dropTarget.kind === 'pitch') {
      return {
        tone: 'sky',
        text: `🔀 สลับตำแหน่ง ${dragUi.player.n.split(' ')[0]} (${dragUi.role || dragUi.player.ro}) ↔ ${dropTarget.name.split(' ')[0]} (${dropTarget.role || ''})`
      };
    }
    return null;
  }, [dragUi, dropTarget, myPitchNodes, benchList]);

  const mySubsList = subLog.filter((s) => s.t === meTeamOrig.id);
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

  const renderInteractiveFormationPitch = (side: 'H' | 'A', singleView: boolean) => {
    const isMySide = side === myTeamSide;
    const teamModel = side === 'H' ? liveHome : liveAway;
    const xiNames = side === 'H' ? curHomeLu : curAwayLu;
    const kit = side === 'H' ? homeKit : awayKit;
    const gkKit = side === 'H' ? homeGkKit : awayGkKit;
    const trim = side === 'H' ? homeTrim : awayTrim;
    const meta = side === 'H' ? homePitchMeta : awayPitchMeta;
    return (
      <FormationPitch
        team={teamModel}
        state={state}
        lineupNames={xiNames}
        kitOverride={kit}
        gkKitOverride={gkKit}
        trimOverride={trim}
        matchMeta={meta}
        statMode={effectiveStatMode}
        showFitBar={true}
        showPitchCrest={true}
        subAlertFitTh={subAlertFitTh}
        dragSourceName={isMySide && dragUi?.source === 'pitch' ? dragUi.player.n : null}
        dropTargetName={isMySide && dropTarget?.kind === 'pitch' ? dropTarget.name : null}
        selectedPlayerName={isMySide ? subPickOut : null}
        validDropHighlight={isMySide && dragUi?.source === 'bench' && subsUsed.length < 5}
        disableRedPlayers={isMySide}
        dropAttrPrefix={isMySide ? 'tactics' : 'default'}
        recentSubInNames={isMySide && recentSubAnim ? [recentSubAnim.inName] : undefined}
        onPlayerPointerDown={
          isMySide
            ? (e, player, slotSp, slotIdx) => {
                startPointerDrag(e, 'pitch', player, slotSp, slotIdx);
              }
            : undefined
        }
        className={
          singleView
            ? 'aspect-[300/380] h-full w-auto max-w-full mx-auto rounded-xl block select-none'
            : 'aspect-[300/380] h-full w-auto max-w-full mx-auto rounded-xl block select-none'
        }
      />
    );
  };

  return (
    <div className="grid grid-cols-[1.68fr_1fr] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden relative">
      {/* Floating Drag Ghost Badge */}
      {dragUi && (
        <div
          ref={dragGhostRef}
          className="fixed left-0 top-0 z-[120] pointer-events-none flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-[var(--surface)]/95 border-2 border-[var(--lamp)] shadow-2xl max-w-[225px] will-change-transform"
          style={{
            transform: `translate3d(${dragGhostPosRef.current.x}px, ${dragGhostPosRef.current.y}px, 0)`
          }}
        >
          <div className="shrink-0 [&_svg]:w-7 [&_svg]:h-7">
            <PlayerFace player={dragUi.player} team={meTeamOrig} state={state} careerProfile={state.p} size={28} />
          </div>
          <div className="min-w-0 text-[11px]">
            <div className="font-bold truncate flex items-center gap-1">
              <span>{dragUi.player.n.split(' ')[0]}</span>
              <PositionBadge role={dragUi.role || dragUi.player.ro} size="xs" />
              <OvrBadge ov={dragUi.player.ov} size="2xs" />
            </div>
            <div className="text-[10px] font-semibold text-[var(--mut)] truncate">
              {dropTarget
                ? dropTarget.kind === 'pitch'
                  ? dragUi.source === 'bench'
                    ? `🔼 เข้าแทน ${dropTarget.name.split(' ')[0]}`
                    : `🔀 สลับกับ ${dropTarget.name.split(' ')[0]}`
                  : `🔽 ออก · 🔼 ${dropTarget.name.split(' ')[0]} เข้า`
                : dragUi.source === 'bench'
                  ? 'ลากไปวางบนนักเตะในแผนผัง'
                  : 'ลากสลับตำแหน่ง หรือวางบนสำรอง'}
            </div>
          </div>
        </div>
      )}

      {/* LEFT COLUMN: Same Unified #092818 Full-Height Formation Pitch Stage as Halftime / Match View */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 rounded-2xl mland:rounded-xl overflow-hidden border border-[var(--line)] bg-[#092818] shadow-inner flex flex-col">
          {/* Unified Interactive SVG Formation Pitch Container with Inside Logo Switcher */}
          <div
            ref={pitchRef}
            onContextMenu={(e) => e.preventDefault()}
            className="relative flex-1 min-h-0 w-full p-1.5 sm:p-2 mland:p-1 bg-[#092818] select-none overflow-hidden flex items-center justify-center"
          >
            {/* Compact Logo-Only Team Switcher Inside Pitch (matching Halftime & Post-Match) */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1 p-1 rounded-xl bg-[#05180e]/88 border border-white/25 shadow-lg">
              <button
                type="button"
                title="แสดงแผนทั้งสองทีม"
                aria-label="แสดงแผนทั้งสองทีม"
                onClick={() => {
                  SFX.tap();
                  setEffectivePitchMode('all');
                }}
                className={`h-9 sm:h-10 mland:h-8 px-2 sm:px-2.5 mland:px-1.5 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                  effectivePitchMode === 'all'
                    ? 'bg-emerald-500 shadow-xs ring-1 ring-white/50'
                    : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                }`}
              >
                <span className="inline-flex items-center -space-x-2 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6 mland:[&>svg]:w-4.5 mland:[&>svg]:h-4.5">
                  <ClubCrest name={homeOrig.name} size={24} team={homeOrig} club={state.club} isMyClub={meIsHome} />
                  <ClubCrest name={awayOrig.name} size={24} team={awayOrig} club={state.club} isMyClub={!meIsHome} />
                </span>
              </button>
              <button
                type="button"
                title={homeOrig.name}
                aria-label={homeOrig.name}
                onClick={() => {
                  SFX.tap();
                  setEffectivePitchMode('H');
                }}
                className={`relative h-9 w-9 sm:h-10 sm:w-10 mland:h-8 mland:w-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors [&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-8 sm:[&>svg]:h-8 mland:[&>svg]:w-6 mland:[&>svg]:h-6 ${
                  effectivePitchMode === 'H'
                    ? 'bg-emerald-500 shadow-xs ring-1 ring-white/50'
                    : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                }`}
              >
                <ClubCrest name={homeOrig.name} size={32} team={homeOrig} club={state.club} isMyClub={meIsHome} />
                {meIsHome && <MyTeamBadge size="2xs" className="absolute -top-0.5 -right-0.5 ring-1 ring-[#05180e]" />}
              </button>
              <button
                type="button"
                title={awayOrig.name}
                aria-label={awayOrig.name}
                onClick={() => {
                  SFX.tap();
                  setEffectivePitchMode('A');
                }}
                className={`relative h-9 w-9 sm:h-10 sm:w-10 mland:h-8 mland:w-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors [&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-8 sm:[&>svg]:h-8 mland:[&>svg]:w-6 mland:[&>svg]:h-6 ${
                  effectivePitchMode === 'A'
                    ? 'bg-emerald-500 shadow-xs ring-1 ring-white/50'
                    : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                }`}
              >
                <ClubCrest name={awayOrig.name} size={32} team={awayOrig} club={state.club} isMyClub={!meIsHome} />
                {!meIsHome && <MyTeamBadge size="2xs" className="absolute -top-0.5 -right-0.5 ring-1 ring-[#05180e]" />}
              </button>
            </div>

            {/* Drag Compatibility Live Banner (Floats cleanly during drag) */}
            {dragCompatibilityBanner && (
              <div
                className={`pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-30 max-w-[92%] px-3 py-1 rounded-xl text-[10.5px] mland:text-[9px] font-bold text-center truncate border border-white/25 shadow-xl ${
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

            {/* Substitution Animated Toast Banner on Pitch */}
            {!dragCompatibilityBanner && recentSubAnim && (
              <div
                key={recentSubAnim.key}
                className="sub-banner-in pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-30 max-w-[92%] px-3 py-1 mland:px-2.5 mland:py-0.5 rounded-full bg-[#071f13]/95 border border-emerald-400/75 text-white shadow-xl flex items-center gap-1.5 text-[10.5px] mland:text-[9px] font-bold whitespace-nowrap"
              >
                <span className="px-1.5 py-[1px] rounded-full bg-emerald-500/25 text-emerald-300 font-black tabular">
                  🔄 {recentSubAnim.minute}&apos;
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-300 font-extrabold">
                  <StatIconBadge kind="subIn" size="xs" />
                  <span className="truncate max-w-[95px]">{recentSubAnim.inName.split(' ')[0]}</span>
                </span>
                <span className="text-white/50">⇄</span>
                <span className="inline-flex items-center gap-1 text-rose-300 font-bold">
                  <StatIconBadge kind="subOut" size="xs" />
                  <span className="truncate max-w-[95px]">{recentSubAnim.outName.split(' ')[0]}</span>
                </span>
              </div>
            )}

            <div className="h-full min-h-0 w-full flex items-center justify-center overflow-hidden">
              {effectivePitchMode === 'all' ? (
                <div className="w-full h-full grid grid-cols-2 gap-2 mland:gap-1 items-stretch">
                  <div className="h-full min-h-0 w-full flex items-center justify-center">
                    {renderInteractiveFormationPitch('H', false)}
                  </div>
                  <div className="h-full min-h-0 w-full flex items-center justify-center">
                    {renderInteractiveFormationPitch('A', false)}
                  </div>
                </div>
              ) : (
                renderInteractiveFormationPitch(effectivePitchMode, true)
              )}
            </div>
          </div>

          {/* Compact 1st-Half Stats Summary Strip at Halftime (matching Halftime Pitch Stage) */}
          {matchPhaseUi === 'halftime' && matchStats && (
            <div className="shrink-0 bg-[#082414]/95 border-t border-white/12 px-2.5 py-1.5 mland:px-2 mland:py-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] mland:text-[8.5px] text-white/85 tabular">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#fde047]">📊 สรุปครึ่งแรก (45&apos;)</span>
                {onToggleStatMode && (
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      onToggleStatMode();
                    }}
                    className="px-1.5 py-[1px] rounded bg-white/10 hover:bg-white/20 text-[9.5px] mland:text-[8px] font-bold text-white cursor-pointer"
                  >
                    {effectiveStatMode === 'rating' ? '⭐ เรตติ้ง' : '⚡ พลัง'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span>ครองบอล <b className="text-white">{matchStats.possH}% - {100 - matchStats.possH}%</b></span>
                <span>ยิง <b className="text-white">{matchStats.shotsH} - {matchStats.shotsA}</b></span>
                <span>เข้ากรอบ <b className="text-white">{matchStats.onTargetH} - {matchStats.onTargetA}</b></span>
                <span>xG <b className="text-white">{matchStats.xgH.toFixed(2)} - {matchStats.xgA.toFixed(2)}</b></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Consistent Top Tab Switcher + Sub Quota/Resume Bar + Substitutes Bench + Tactical Orders */}
      <div className="flex flex-col min-h-0 gap-1.5 mland:gap-1 overflow-hidden">
        {/* Same 3-Tab Switcher as Match Stats / Live Stream View */}
        <div className="seg-bar grid grid-cols-3 w-full shrink-0">
          <button
            type="button"
            onClick={onCloseToStats}
            className="seg-btn w-full whitespace-nowrap"
          >
            <span>📊 สถิติ</span>
          </button>
          <button
            type="button"
            onClick={() => (onCloseToChat ? onCloseToChat() : onCloseToStats())}
            className="seg-btn w-full whitespace-nowrap"
          >
            <span>🎥</span>
            <span>ออนไลน์</span>
            {liveViewers != null && (
              <span className="tabular font-extrabold text-[9.5px] mland:text-[8.5px] opacity-85">
                {fmtFansShort(liveViewers)}
              </span>
            )}
          </button>
          <button
            type="button"
            className="seg-btn seg-btn-active w-full whitespace-nowrap px-1.5 mland:px-1 gap-1 mland:gap-0.5"
          >
            <span>📋 แผน</span>
            {autoSubEnabled !== undefined && (
              <span
                title={autoSubEnabled ? 'ระบบ AI เปิดอยู่' : 'ระบบ AI ปิดอยู่'}
                className={`px-1.5 py-[2px] rounded text-[8.5px] mland:text-[7.5px] font-black tracking-wide leading-none shrink-0 ${
                  autoSubEnabled
                    ? 'bg-white text-[var(--g)] shadow-2xs'
                    : 'bg-black/25 text-white/60'
                }`}
              >
                AI
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Halftime Talk (at Halftime) + Bench + Tactical Orders */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-2 mland:space-y-1.5">
          {matchPhaseUi === 'halftime' && onSetHalftimeTalk && (() => {
            const htTalkOptions: { id: ManagerHalftimeTalk; icon: string; title: string; desc: string }[] = [
              { id: 'attack', icon: '🔥', title: 'เปิดเกมรุกบุกแหลก', desc: 'ดันไลน์สูง ปลุกเกมบุก & กองหน้า' },
              { id: 'press', icon: '⚡', title: 'เพรสซิ่งสูงบีบพื้นที่', desc: 'เร่งจังหวะ ไล่บีบแย่งบอลทันที' },
              { id: 'balanced', icon: '⚖️', title: 'รักษาทรงคุมจังหวะ', desc: 'นิ่งและสม่ำเสมอ รอจังหวะเจาะ' },
              { id: 'counter', icon: '🚀', title: 'ตั้งรับรอโต้กลับเร็ว', desc: 'รัดกุมหลังแล้ววางบอลสวนฉับพลัน' },
              { id: 'defend', icon: '🛡️', title: 'ขันเกมรับให้แน่น', desc: 'ปิดพื้นที่คุมโซน ลดความเสี่ยงเสียประตู' }
            ];
            return (
              <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-amber-500/8 border border-amber-500/40 space-y-1.5 mland:space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold text-[11.5px] mland:text-[9.5px] text-[#b45309] dark:text-[#fde047] flex items-center gap-1.5">
                      <span>🗣️ สั่งการครึ่งหลัง</span>
                    </div>
                    <p className="text-[9.5px] mland:text-[8px] text-[var(--mut)] leading-snug">
                      เลือกคำสั่งปลุกใจ/แท็กติกทีม แล้วกดเริ่มครึ่งหลังด้านบน
                    </p>
                  </div>
                  <div className="shrink-0">
                    <ClubCrest
                      name={meTeamOrig.name}
                      size={20}
                      team={meTeamOrig}
                      club={state.club}
                      isMyClub={true}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {htTalkOptions.map((opt) => {
                    const active = selectedHalftimeTalk === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onSetHalftimeTalk(opt.id);
                        }}
                        className={`w-full text-left px-2 py-1.5 mland:px-1.5 mland:py-1 rounded-xl mland:rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          active
                            ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-xs'
                            : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[10.5px] mland:text-[9px] flex items-center gap-1.5 leading-tight">
                            <span>{opt.icon}</span>
                            <span className="truncate">{opt.title}</span>
                          </div>
                          <div className={`text-[9px] mland:text-[7.5px] truncate mt-0.5 ${active ? 'text-white/85' : 'text-[var(--mut)]'}`}>
                            {opt.desc}
                          </div>
                        </div>
                        {active && (
                          <span className="w-4 h-4 rounded-full bg-white text-[var(--g)] flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Substitutes Bench (Compact Header + Smart Sub + Bench List) */}
          <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden">
            {/* Merged Single Header: Title + Used Quota + AI Toggle */}
            <div className="px-2.5 py-1 mland:px-2 mland:py-[3px] bg-[var(--surface-2)]/85 border-b border-[var(--line)] flex items-center justify-between gap-1.5 text-[10.5px] mland:text-[9px]">
              <span className="font-extrabold text-[var(--ink)] flex items-center gap-1.5 min-w-0 truncate">
                <span>👥 ตัวสำรอง ({benchList.length})</span>
                <span className="text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] tabular">
                  · เปลี่ยนแล้ว {mySubsList.length}/5
                </span>
              </span>
              {onToggleAutoSub && (
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onToggleAutoSub();
                  }}
                  title="ระบบ AI ปรับตำแหน่งระหว่างเกม & เปลี่ยนตัวอัตโนมัติ"
                  className={`inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[9.5px] mland:text-[8px] font-extrabold border cursor-pointer transition-colors whitespace-nowrap shrink-0 leading-tight ${
                    autoSubEnabled
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs'
                      : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span className="font-black tracking-wide">AI</span>
                  <span>{autoSubEnabled ? 'เปิด' : 'ปิด'}</span>
                </button>
              )}
            </div>

            {/* Interactive Fitness / Substitution Recommendation Button (Single-Row Compact) */}
            {subsUsed.length < 5 && smartAutoSub ? (
              <div className="px-2 py-1 mland:px-1.5 mland:py-[3px] bg-[var(--surface-2)]/40 border-b border-[var(--line)] flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const rep = onAutoSubstitute(smartAutoSub.outName);
                    if (rep) setSubPickOut(null);
                  }}
                  title={`${smartAutoSub.isExplicitPick ? 'เปลี่ยนตัวที่เลือก' : smartAutoSub.isInjured ? 'แนะนำเปลี่ยนตัวบาดเจ็บ' : 'แนะนำเปลี่ยนตัวตามความฟิต'}: ส่ง ${smartAutoSub.inPlayer.n} (${smartAutoSub.inPlayer.ro} · ${smartAutoSub.inPlayer.ov}) ลงแทน ${smartAutoSub.outName} (${smartAutoSub.outFit}%)`}
                  className="flex-1 min-w-0 px-2 py-1 mland:px-1.5 mland:py-[3px] rounded-lg bg-[var(--g)] hover:brightness-110 active:scale-[0.99] text-white shadow-xs transition-all cursor-pointer flex items-center justify-between gap-1.5 text-[10px] mland:text-[8.5px] overflow-hidden whitespace-nowrap"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden whitespace-nowrap text-left">
                    <span className="shrink-0 px-1.5 py-[1px] rounded bg-black/20 font-black text-[9px] mland:text-[7.5px]">
                      {smartAutoSub.isExplicitPick ? '⚡ เลือก' : smartAutoSub.isInjured ? '🩺 เจ็บ' : '⚡ ฟิต'}
                    </span>
                    <span className="min-w-0 inline-flex items-center gap-1 px-1.5 py-[1px] rounded bg-black/25 font-bold overflow-hidden">
                      <StatIconBadge kind="subOut" size="xs" />
                      <span className="truncate">{smartAutoSub.outShort}</span>
                      <span className="opacity-85 tabular shrink-0">{smartAutoSub.outFit}%</span>
                    </span>
                    <span className="opacity-80 font-bold shrink-0">→</span>
                    <span className="min-w-0 inline-flex items-center gap-1 px-1.5 py-[1px] rounded bg-white/20 font-extrabold overflow-hidden">
                      <StatIconBadge kind="subIn" size="xs" />
                      <span className="truncate">{smartAutoSub.inPlayer.n.split(' ')[0]}</span>
                      <span className="opacity-90 tabular shrink-0">{smartAutoSub.inPlayer.ov}</span>
                    </span>
                  </div>
                  <span className="px-1.5 py-[1px] rounded bg-white text-[var(--g)] font-black text-[9px] mland:text-[7.5px] shrink-0 whitespace-nowrap shadow-2xs">
                    เปลี่ยน
                  </span>
                </button>
                {smartAutoSub.isExplicitPick && (
                  <button
                    type="button"
                    onClick={() => setSubPickOut(null)}
                    title="ยกเลิกการเลือกตัวผู้เล่น"
                    aria-label="ยกเลิกการเลือก"
                    className="px-1.5 py-1 mland:py-[3px] rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer shrink-0 leading-none"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              <div className="px-2.5 py-0.5 mland:px-2 bg-[var(--surface-2)]/35 border-b border-[var(--line)] text-[9.5px] mland:text-[8px] text-[var(--mut)] font-semibold">
                {subsUsed.length >= 5 ? 'ใช้โควต้าเปลี่ยนตัวครบ 5 คนแล้ว' : 'ไม่มีตัวสำรองที่พร้อมลงสนาม'}
              </div>
            )}

            {benchList.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-[var(--mut)]">ไม่มีตัวสำรองที่พร้อมลงสนาม</div>
            ) : (
              <div className="divide-y divide-[var(--line)]/50">
                {benchList.map((pl) => {
                  const f = Math.round(pl.fit ?? 100);
                  const no = getShirtNo(meTeamOrig, pl);
                  const isDraggingThis = dragUi?.source === 'bench' && dragUi.player.n === pl.n;
                  const isBenchDropTarget = dropTarget?.kind === 'bench' && dropTarget.name === pl.n;
                  const isAutoRecommended = subsUsed.length < 5 && smartAutoSub?.inPlayer.n === pl.n;
                  const compatPen = selectedPitchOutSlot ? playerPen(pl, selectedPitchOutSlot) : selectedPitchOutObj ? playerPen(pl, selectedPitchOutObj.ro) : null;
                  const canQuickSub = subsUsed.length < 5 && Boolean(selectedPitchOut);
                  const meKitColor = pl.pos === 'GK' ? (meIsHome ? homeGkKit : awayGkKit) : (meIsHome ? homeKit : awayKit);
                  const meTrimColor = pl.pos === 'GK' ? undefined : (meIsHome ? homeTrim : awayTrim);
                  const isMePlayer = Boolean(pl.me || (state.mode === 'p' && state.p?.name === pl.n));
                  const rowCols = canQuickSub
                    ? 'grid-cols-[16px_22px_34px_26px_minmax(0,1fr)_74px_28px_auto] mland:grid-cols-[14px_19px_30px_24px_minmax(0,1fr)_64px_24px_auto]'
                    : 'grid-cols-[16px_22px_34px_26px_minmax(0,1fr)_74px_30px] mland:grid-cols-[14px_19px_30px_24px_minmax(0,1fr)_64px_26px]';

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
                      className={`w-full grid ${rowCols} items-center gap-1 mland:gap-0.5 px-2 py-[3px] mland:px-1.5 mland:py-[2px] text-left select-none transition-colors ${
                        isBenchDropTarget
                          ? 'bg-[var(--lamp-soft)] ring-1 ring-inset ring-[var(--lamp)]'
                          : isDraggingThis
                            ? 'opacity-40 bg-[var(--surface-2)]'
                            : isAutoRecommended
                              ? 'bg-[var(--g-soft)]/55 hover:bg-[var(--g-soft)]/75'
                              : isMePlayer
                                ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/70'
                                : compatPen === 0
                                  ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.09]'
                                  : 'hover:bg-[var(--surface-2)]/65'
                      } ${subsUsed.length < 5 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer opacity-75'}`}
                    >
                      {/* 1. โลโก้ */}
                      <div
                        data-drag-grip={subsUsed.length < 5 ? '1' : undefined}
                        style={subsUsed.length < 5 ? { touchAction: 'none' } : undefined}
                        className="flex items-center justify-center shrink-0 [&>svg]:w-[15px] [&>svg]:h-[15px] mland:[&>svg]:w-[13px] mland:[&>svg]:h-[13px]"
                      >
                        <ClubCrest
                          name={meTeamOrig.name}
                          size={15}
                          team={meTeamOrig}
                          club={state.club}
                          isMyClub={meTeamOrig.id === state.me && state.mode === 'm'}
                        />
                      </div>

                      {/* 2. รูป */}
                      <div
                        data-drag-grip={subsUsed.length < 5 ? '1' : undefined}
                        style={
                          subsUsed.length < 5
                            ? { touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }
                            : undefined
                        }
                        title={subsUsed.length < 5 ? 'ลากลงสนามเพื่อเปลี่ยนตัว' : 'ใช้โควต้าครบแล้ว'}
                        className="flex items-center justify-start"
                      >
                        <MatchPlayerThumb
                          player={pl}
                          team={meTeamOrig}
                          state={state}
                          kitColor={meKitColor}
                          trimColor={meTrimColor}
                          size="xs"
                        />
                      </div>

                      {/* 3. ตำแหน่ง */}
                      <div
                        data-drag-grip={subsUsed.length < 5 ? '1' : undefined}
                        style={subsUsed.length < 5 ? { touchAction: 'none' } : undefined}
                        className="flex items-center justify-start"
                      >
                        <PositionBadge role={pl.ro} size="2xs" />
                      </div>

                      {/* 4. เบอร์ */}
                      <div
                        data-drag-grip={subsUsed.length < 5 ? '1' : undefined}
                        style={subsUsed.length < 5 ? { touchAction: 'none' } : undefined}
                        className="text-left text-[10px] mland:text-[8.5px] font-extrabold text-[#b45309] dark:text-[var(--lamp)] tabular whitespace-nowrap"
                      >
                        #{no}
                      </div>

                      {/* 5. ชื่อ */}
                      <div className="flex items-center justify-start gap-1 min-w-0">
                        <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate">{pl.n}</span>
                        {meTeamOrig.cap === pl.n && (
                          <CaptainBadge team={meTeamOrig} state={state} size="xs" className="shrink-0" />
                        )}
                        {isMePlayer && (
                          <span
                            title="ตัวคุณ"
                            aria-label="ตัวคุณ"
                            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8px] font-black shrink-0"
                          >
                            ★
                          </span>
                        )}
                        {(pl.hg || pl.customCreated) && (
                          <span title="เด็กปั้นสโมสร" className="text-[10px] mland:text-[8.5px] shrink-0">🌱</span>
                        )}
                        {compatPen === 0 && (
                          <span className="px-1 py-[1px] rounded bg-[var(--g-soft)] text-[var(--g)] text-[8px] font-extrabold shrink-0 whitespace-nowrap" title="ตรงตำแหน่ง">
                            ✓ตรง
                          </span>
                        )}
                      </div>

                      {/* 6. ความฟิต / สถานะ */}
                      <div className="flex items-center justify-start min-w-0">
                        <PlayerStatusBadge sus={pl.sus} inj={pl.inj} fit={f} restThreshold={subAlertFitTh} variant="cell" />
                      </div>

                      {/* 7. พลัง */}
                      <div className="flex items-center justify-start">
                        <OvrBadge ov={pl.ov} size="2xs" />
                      </div>

                      {canQuickSub && (
                        <button
                          type="button"
                          data-no-drag="1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSubstitute(selectedPitchOut!, pl);
                          }}
                          title={`ส่ง ${pl.n} ลงแทน ${selectedPitchOut!.split(' ')[0]}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--g)] text-white text-[9px] font-extrabold cursor-pointer hover:brightness-110 shrink-0 whitespace-nowrap"
                        >
                          <StatIconBadge kind="subIn" size="xs" />
                          <span>ส่งลง</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {mySubsList.length > 0 && (
              <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 bg-[var(--surface-2)]/40 border-t border-[var(--line)] space-y-1 text-[10px] mland:text-[8.5px]">
                <div className="font-bold text-[var(--mut)] flex items-center justify-between">
                  <span>🔄 เปลี่ยนตัวแล้ว</span>
                  <span className="tabular font-extrabold">{mySubsList.length}/5</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {mySubsList.map((sb, i) => {
                    const isNewestSub =
                      recentSubAnim &&
                      i === mySubsList.length - 1 &&
                      sb.inPlayer === recentSubAnim.inName &&
                      sb.outPlayer === recentSubAnim.outName;
                    return (
                      <span
                        key={`${sb.m}-${sb.inPlayer}-${sb.outPlayer}-${i}`}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--surface)] border tabular ${
                          isNewestSub
                            ? 'sub-chip-in border-emerald-500/75 bg-emerald-500/10'
                            : 'border-[var(--line)]'
                        }`}
                      >
                        <span className="px-1 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-extrabold text-[9px] mland:text-[8px]">
                          {sb.m}&apos;
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[var(--g)] font-bold">
                          <StatIconBadge kind="subIn" size="xs" />
                          <span>{sb.inPlayer.split(' ')[0]}</span>
                        </span>
                        <span className="text-[var(--mut)]/50">/</span>
                        <span className="inline-flex items-center gap-0.5 text-[var(--red)] font-semibold">
                          <StatIconBadge kind="subOut" size="xs" />
                          <span>{sb.outPlayer.split(' ')[0]}</span>
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Compact Live Tactical Controls */}
          <div className="p-2 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-1.5 mland:space-y-1">
            <div className="text-[10.5px] mland:text-[9px] font-extrabold text-[var(--ink)] flex items-center justify-between">
              <span>📋 คำสั่งแท็กติกสด</span>
              <span className="text-[9px] mland:text-[7.5px] font-semibold text-[var(--mut)]">มีผลทันทีในสนาม</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)]">
                <span>🎯 สไตล์คุมทีม</span>
                <span className="text-[var(--ink)]">{AR_T[liveTac]}</span>
              </div>
              <div className="seg-bar grid grid-cols-5 w-full">
                {([
                  { m: 'X' as Mentality, short: 'บุกแหลก', icon: '🔥' },
                  { m: 'A' as Mentality, short: 'เปิดบุก', icon: '⚔️' },
                  { m: 'B' as Mentality, short: 'สมดุล', icon: '⚖️' },
                  { m: 'D' as Mentality, short: 'ตั้งรับ', icon: '🛡️' },
                  { m: 'Z' as Mentality, short: 'อุด', icon: '🧱' }
                ]).map(({ m, short, icon }) => (
                  <button
                    key={m}
                    type="button"
                    title={AR_T[m]}
                    onClick={() => onSetTac(m)}
                    className={`seg-btn w-full min-w-0 px-0.5 py-1 mland:py-0.5 text-[9.5px] mland:text-[8px] gap-0.5 whitespace-nowrap overflow-hidden ${
                      liveTac === m ? 'seg-btn-active' : ''
                    }`}
                  >
                    <span className="shrink-0">{icon}</span>
                    <span className="truncate">{short}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)]">
                <span>⚽ สไตล์จ่ายบอล</span>
              </div>
              <div className="seg-bar grid grid-cols-4 w-full">
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
                    className={`seg-btn w-full min-w-0 px-0.5 py-1 mland:py-0.5 text-[9.5px] mland:text-[8px] gap-0.5 whitespace-nowrap overflow-hidden ${
                      livePass === idx ? 'seg-btn-active' : ''
                    }`}
                  >
                    <span className="shrink-0">{icon}</span>
                    <span className="truncate">{lbl}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mland:gap-1">
              <div>
                <div className="text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] mb-0.5">🏃 เพรสซิ่ง</div>
                <div className="seg-bar grid grid-cols-3 w-full">
                  {['ต่ำ', 'กลาง', 'สูง'].map((lbl, k) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => onSetPress(k)}
                      className={`seg-btn w-full min-w-0 px-0.5 py-0.5 text-[9.5px] mland:text-[8px] whitespace-nowrap ${
                        livePress === k ? 'seg-btn-active' : ''
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] mb-0.5">⏱️ จังหวะเกม</div>
                <div className="seg-bar grid grid-cols-3 w-full">
                  {['ช้า', 'กลาง', 'เร็ว'].map((lbl, k) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => onSetTempo(k)}
                      className={`seg-btn w-full min-w-0 px-0.5 py-0.5 text-[9.5px] mland:text-[8px] whitespace-nowrap ${
                        liveTempo === k ? 'seg-btn-active' : ''
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] mb-0.5">🚧 แนวรับ</div>
                <div className="seg-bar grid grid-cols-3 w-full">
                  {['ลึก', 'กลาง', 'สูง'].map((lbl, k) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => onSetLine(k)}
                      className={`seg-btn w-full min-w-0 px-0.5 py-0.5 text-[9.5px] mland:text-[8px] whitespace-nowrap ${
                        liveLine === k ? 'seg-btn-active' : ''
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] mb-0.5">↔️ ความกว้าง</div>
                <div className="seg-bar grid grid-cols-3 w-full">
                  {['แคบ', 'กลาง', 'กว้าง'].map((lbl, k) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => onSetWid(k)}
                      className={`seg-btn w-full min-w-0 px-0.5 py-0.5 text-[9.5px] mland:text-[8px] whitespace-nowrap ${
                        liveWid === k ? 'seg-btn-active' : ''
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
