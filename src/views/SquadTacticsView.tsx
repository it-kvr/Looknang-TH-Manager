import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MainTab, Position, SubRole, Mentality, Player, CustomSlot, Team, AutoRule, GameState, PitchDragPreview } from '../types/game';
import { clamp, fmtMoneyNum } from '../utils/math';
import { POS, FSD, LINE, AR_C, AR_T, PRE } from '../data/thaiFootballData';
import { SFX, vibrate } from '../utils/audioTheme';
import { getShirtNo, getFormationSlots, getFormationCounts, playerPen, xi, vlu, ensureCon, tc, getPlayerBio, autoAssignTeamRoles, scoreCaptainCandidate, scoreSetPieceCandidate, teamKits, pickGK } from '../engine/playerCore';
import { rate, getLeagueTransferContext, getIncomingOffers, validateBatchSquadRemoval } from '../engine/simulation';
import { PlayerFace, ClubCrest, TacticsMiniPitch, getPitchZoneAt, FormationPitch } from '../components/SvgVisuals';
import { MatchPlayerThumb } from '../modals/MatchSharedComponents';
import { StatIconBadge } from '../components/StatIconBadge';
import { LockerRoomPanel } from '../components/LockerRoomPanel';
import { FootPairIcon, getFootColorMeta } from '../components/PlayerBioStrip';
import { CustomFormationModal } from '../modals/TacticsModals';
import { SquadRenewModal, SquadSellModal, SquadReleaseModal } from '../modals/SquadActionModals';
import { StaminaBar, getStaminaMeta } from '../components/StaminaBar';
import { PlayerStatusBadge } from '../components/PlayerStatusBadge';
import { CaptainBadge } from '../components/CaptainBadge';
import { PositionBadge } from '../components/PositionBadge';
import { OvrBadge } from '../components/OvrBadge';
import { SquadListHeaderBar } from '../components/SquadListHeaderBar';

export const SquadTacticsView = React.memo<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onShallowPatch?: (patcher: (prev: GameState) => Partial<GameState>) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onNavigate?: (tab: MainTab, sub?: string) => void;
  onToast: (msg: string) => void;
}>(({ state, onUpdateState, onShallowPatch, onInspectPlayer, onNavigate, onToast }) => {
  const me = state.teams[state.me];
  const isMgr = state.mode === 'm';
  const sub = (state.sub ?? 0) > 3 ? 0 : (state.sub ?? 0);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [showFormationSheet, setShowFormationSheet] = useState(false);
  const [squadPosFilter, setSquadPosFilter] = useState<'ALL' | Position>('ALL');
  const [squadSort, setSquadSort] = useState<'pos' | 'ov' | 'fit' | 'age' | 'val' | 'goals'>('pos');
  const [selectedSquadNames, setSelectedSquadNames] = useState<string[]>([]);
  const [renewTargetName, setRenewTargetName] = useState<string | null>(null);
  const [sellModalNames, setSellModalNames] = useState<string[] | null>(null);
  const [releaseModalNames, setReleaseModalNames] = useState<string[] | null>(null);
  const pitchSvgRef = useRef<SVGSVGElement | null>(null);
  const formationPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showFormationSheet) return;
    const handleOutsidePointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!formationPopoverRef.current?.contains(target)) {
        setShowFormationSheet(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFormationSheet(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showFormationSheet]);

  const starters = useMemo(() => xi(me), [me]);
  const slots = useMemo(() => getFormationSlots(me), [me]);
  const r = useMemo(() => rate(me, state), [me, state]);
  const [meKit, meTrim] = useMemo(() => teamKits(me, state), [me, state]);
  const meGkKit = useMemo(() => pickGK(meKit, '#111827'), [meKit]);
  const bench = useMemo(
    () =>
      me.sq
        .filter((q) => !starters.includes(q))
        .sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov),
    [me.sq, starters]
  );
  const incomingOffers = useMemo(() => (isMgr ? getIncomingOffers(state) : []), [isMgr, state]);
  const incomingOfferCountsByName = useMemo(() => {
    const counts: Record<string, number> = {};
    incomingOffers.forEach((o) => {
      counts[o.n] = (counts[o.n] || 0) + 1;
    });
    return counts;
  }, [incomingOffers]);
  const avgFit = Math.round(starters.reduce((s, q) => s + (q.fit ?? 100), 0) / (starters.length || 1));
  const restNeededStarters = starters.filter((q) => q.inj === 0 && (q.sus || 0) === 0 && Math.round(q.fit ?? 100) < 65);
  const tiredWarningStarters = starters.filter((q) => q.inj === 0 && (q.sus || 0) === 0 && Math.round(q.fit ?? 100) >= 65 && Math.round(q.fit ?? 100) < 75);

  const restTiredStarters = () => {
    const threshold = restNeededStarters.length > 0 ? 65 : 75;
    const swappedPairs: string[] = [];
    SFX.tap();
    onUpdateState((draft) => {
      const t = draft.teams[draft.me];
      const curXi = xi(t);
      const nextLu = curXi.map((q) => q.n);
      const usedNames = new Set(nextLu);
      const freshPool = t.sq
        .filter((q) => !usedNames.has(q.n) && q.inj === 0 && (q.sus || 0) === 0 && (q.fit ?? 100) >= 75)
        .sort((a, b) => (b.fit ?? 100) * 0.55 + b.ov - ((a.fit ?? 100) * 0.55 + a.ov));

      curXi.forEach((starter, idx) => {
        if (starter.inj > 0 || (starter.sus || 0) > 0) return;
        const sf = Math.round(starter.fit ?? 100);
        if (sf >= threshold) return;
        const subIdx = freshPool.findIndex((b) =>
          starter.pos === 'GK' ? b.pos === 'GK' : b.pos === starter.pos
        );
        const fallbackIdx =
          subIdx >= 0
            ? subIdx
            : starter.pos === 'GK'
              ? -1
              : freshPool.findIndex((b) => b.pos !== 'GK');
        if (fallbackIdx >= 0) {
          const replacement = freshPool.splice(fallbackIdx, 1)[0];
          nextLu[idx] = replacement.n;
          swappedPairs.push(`${starter.n.split(' ')[0]}→${replacement.n.split(' ')[0]}`);
        }
      });
      t.lu = nextLu;
    });
    if (swappedPairs.length > 0) {
      onToast(`🛌 พักตัวล้า ${swappedPairs.length} ตำแหน่ง (${swappedPairs.slice(0, 2).join(', ')}${swappedPairs.length > 2 ? '…' : ''})`);
    } else {
      onToast('ยังไม่มีตัวสำรองที่ฟิตพอสลับในตำแหน่งที่ล้า');
    }
  };

  const dragRef = useRef<{
    player: Player;
    fromSlot?: SubRole;
    fromPitchIdx?: number;
    pointerId: number;
    isTouch: boolean;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
    immediate: boolean;
    holdTimer?: number;
  } | null>(null);
  const [dragUi, setDragUi] = useState<{ player: Player; fromSlot?: SubRole } | null>(null);
  const dragUiRef = useRef<{ player: Player; fromSlot?: SubRole } | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragGhostPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<{ name: string; slot?: string } | null>(null);
  const [pitchDragPreview, setPitchDragPreview] = useState<PitchDragPreview | null>(null);
  const pitchDragPreviewRef = useRef<PitchDragPreview | null>(null);
  const [touchAnchorPt, setTouchAnchorPt] = useState<{ px: number; py: number } | null>(null);

  const updateDragGhostPos = (rawX: number, rawY: number) => {
    const gx = typeof window !== 'undefined' ? clamp(rawX - 95, 8, window.innerWidth - 216) : rawX - 95;
    const gy = typeof window !== 'undefined' ? clamp(rawY - 76, 8, window.innerHeight - 68) : rawY - 76;
    dragGhostPosRef.current = { x: gx, y: gy };
    if (dragGhostRef.current) {
      dragGhostRef.current.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    }
  };

  const setDragUiIfChanged = (next: { player: Player; fromSlot?: SubRole } | null) => {
    const prev = dragUiRef.current;
    if ((prev?.player.n ?? null) === (next?.player.n ?? null) && (prev?.fromSlot ?? null) === (next?.fromSlot ?? null)) {
      return;
    }
    dragUiRef.current = next;
    setDragUi(next);
  };

  const setDropTargetIfChanged = (next: { name: string; slot?: string } | null) => {
    setDropTarget((prev) =>
      (prev?.name ?? null) === (next?.name ?? null) && (prev?.slot ?? null) === (next?.slot ?? null) ? prev : next
    );
  };

  const setPitchDragPreviewIfChanged = (next: PitchDragPreview | null) => {
    setPitchDragPreview((prev) => {
      if (!prev && !next) return prev;
      if (
        prev &&
        next &&
        prev.slotIdx === next.slotIdx &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.sp === next.sp &&
        prev.zoneId === next.zoneId
      ) {
        return prev;
      }
      return next;
    });
  };

  const setTouchAnchorPtIfChanged = (next: { px: number; py: number } | null) => {
    setTouchAnchorPt((prev) => {
      if (!prev && !next) return prev;
      if (prev && next && Math.round(prev.px) === Math.round(next.px) && Math.round(prev.py) === Math.round(next.py)) {
        return prev;
      }
      return next;
    });
  };

  const swapAnyPlayers = (nameA: string, nameB: string) => {
    const s = me.sq.find((q) => q.n === nameA);
    const p = me.sq.find((q) => q.n === nameB);
    if (!s || !p || s === p) return;
    const isS = starters.includes(s);
    const isP = starters.includes(p);
    SFX.tap();
    onUpdateState((draft) => {
      const t = draft.teams[draft.me];
      if (isS || isP) {
        const curXi = xi(t).map((q) => q.n);
        if (isS && isP) {
          const i1 = curXi.indexOf(s.n);
          const i2 = curXi.indexOf(p.n);
          if (i1 >= 0 && i2 >= 0) [curXi[i1], curXi[i2]] = [curXi[i2], curXi[i1]];
        } else {
          const starter = isS ? s : p;
          const subPlayer = isS ? p : s;
          const idx = curXi.indexOf(starter.n);
          if (idx >= 0) curXi[idx] = subPlayer.n;
        }
        t.lu = curXi;
      } else {
        const i1 = t.sq.findIndex((q) => q.n === s.n);
        const i2 = t.sq.findIndex((q) => q.n === p.n);
        if (i1 >= 0 && i2 >= 0) [t.sq[i1], t.sq[i2]] = [t.sq[i2], t.sq[i1]];
      }
    });
    onToast(`สลับ ${s.n.split(' ')[0]} ↔ ${p.n.split(' ')[0]} แล้ว`);
  };

  const moveStarterToZone = (slotIdx: number, nx: number, ny: number, newRole: SubRole, zoneLabel: string, playerName: string) => {
    if (slotIdx < 1 || slotIdx >= 11) return;
    SFX.tap();
    const curSlots = getFormationSlots(me);
    const previewSlots = curSlots.map((z, idx) =>
      idx === slotIdx ? { ...z, sp: newRole, pos: LINE[newRole] || z.pos } : z
    );
    const df = previewSlots.filter((z) => z.pos === 'DF').length;
    const mf = previewSlots.filter((z) => z.pos === 'MF').length;
    const fw = previewSlots.filter((z) => z.pos === 'FW').length;
    onUpdateState((draft) => {
      const t = draft.teams[draft.me];
      const curXi = xi(t).map((q) => q.n);
      const baseSlots = getFormationSlots(t);
      const nextCf: CustomSlot[] = baseSlots.map((z, idx) =>
        idx === slotIdx ? [newRole, nx, ny] : [z.sp, z.x, z.y]
      );
      t.lu = curXi;
      t.cf = nextCf;
      t.form = 'custom';
      t.tacFam = Math.max(45, t.tacFam ?? 65);
    });
    onToast(`📍 ${playerName.split(' ')[0]} → ${newRole} (${zoneLabel}) · แผน ${df}-${mf}-${fw}`);
  };

  const clientToPitchCoords = (
    clientX: number,
    clientY: number,
    liftPx = 0
  ): { px: number; py: number; rawPx: number; rawPy: number; inside: boolean } | null => {
    const svg = pitchSvgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const rawInside =
      clientX >= rect.left - 8 &&
      clientX <= rect.right + 8 &&
      clientY >= rect.top - 8 &&
      clientY <= rect.bottom + Math.max(8, liftPx + 8);
    const effectiveY = liftPx > 0 ? clamp(clientY - liftPx, rect.top + 6, rect.bottom - 6) : clientY;
    const inside =
      rawInside &&
      clientX >= rect.left - 4 &&
      clientX <= rect.right + 4 &&
      effectiveY >= rect.top - 4 &&
      effectiveY <= rect.bottom + 4;
    const ctm = svg.getScreenCTM?.();
    if (ctm) {
      const invCtm = ctm.inverse();
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = effectiveY;
      const inv = pt.matrixTransform(invCtm);
      const rawPt = svg.createSVGPoint();
      rawPt.x = clientX;
      rawPt.y = clientY;
      const rawInv = rawPt.matrixTransform(invCtm);
      return { px: inv.x, py: inv.y, rawPx: rawInv.x, rawPy: rawInv.y, inside };
    }
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    return {
      px: ((clientX - rect.left) / w) * 300,
      py: ((effectiveY - rect.top) / h) * 380,
      rawPx: ((clientX - rect.left) / w) * 300,
      rawPy: ((clientY - rect.top) / h) * 380,
      inside
    };
  };

  const findNearestPitchStarter = (clientX: number, clientY: number, excludeName?: string, liftPx = 0): { name: string; slot?: string } | null => {
    const pitchPt = clientToPitchCoords(clientX, clientY, liftPx);
    if (!pitchPt?.inside) return null;
    const { starters: curStarters, slots: curSlots } = dragActionsRef.current;
    let best: { name: string; slot?: string; dist: number } | null = null;
    curStarters.forEach((other, idx) => {
      if (other.n === excludeName) return;
      const oz = curSlots[idx];
      if (!oz) return;
      const ox = 18 + oz.x * 2.64;
      const oy = 16 + oz.y * 3.48;
      const d = Math.hypot(pitchPt.px - ox, pitchPt.py - oy);
      if (d <= 24 && (!best || d < best.dist)) {
        best = { name: other.n, slot: oz.sp, dist: d };
      }
    });
    return best ? { name: (best as { name: string }).name, slot: (best as { slot?: string }).slot } : null;
  };

  const findDropAt = (x: number, y: number, excludeName?: string, liftPx = 0): { name: string; slot?: string } | null => {
    const targetY = liftPx > 0 ? y - liftPx : y;
    const els = document.elementsFromPoint(x, targetY);
    for (const el of els) {
      const hit = (el as Element).closest?.('[data-drop-player]');
      if (hit) {
        const name = hit.getAttribute('data-drop-player');
        if (name && name !== excludeName) return { name, slot: hit.getAttribute('data-drop-slot') || undefined };
      }
    }
    return findNearestPitchStarter(x, y, excludeName, liftPx);
  };

  const handlePlayerPointerDown = (e: React.PointerEvent, q: Player, slotSp?: SubRole, slotIdx?: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (dragRef.current?.holdTimer) {
      window.clearTimeout(dragRef.current.holdTimer);
    }
    const isTouch = e.pointerType !== 'mouse';
    const targetEl = e.target as HTMLElement | null;
    const immediate = slotIdx !== undefined || Boolean(targetEl?.closest?.('[data-drag-grip="1"]'));
    if (immediate && isMgr) {
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        // Ignore capture errors on synthetic events
      }
    }
    let holdTimer: number | undefined;
    if (!immediate && isMgr) {
      holdTimer = window.setTimeout(() => {
        const cur = dragRef.current;
        if (!cur || cur.pointerId !== e.pointerId || cur.active) return;
        cur.active = true;
        cur.immediate = true;
        vibrate(14);
        updateDragGhostPos(cur.x, cur.y);
        setDragUiIfChanged({ player: cur.player, fromSlot: cur.fromSlot });
        const hit = findDropAt(cur.x, cur.y, cur.player.n);
        setDropTargetIfChanged(hit);
      }, 190);
    }
    dragRef.current = {
      player: q,
      fromSlot: slotSp,
      fromPitchIdx: slotIdx,
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

  const handleTapPlayerAction = (q: Player) => {
    SFX.tap();
    onInspectPlayer(q, me);
  };

  const dragActionsRef = useRef({
    handleTapPlayerAction,
    swapAnyPlayers,
    moveStarterToZone,
    me,
    isMgr,
    starters,
    slots
  });
  dragActionsRef.current = {
    handleTapPlayerAction,
    swapAnyPlayers,
    moveStarterToZone,
    me,
    isMgr,
    starters,
    slots
  };

  useEffect(() => {
    const TOUCH_LIFT_PX = 42;
    const clearDrag = () => {
      if (dragRef.current?.holdTimer) {
        window.clearTimeout(dragRef.current.holdTimer);
      }
      dragRef.current = null;
      pitchDragPreviewRef.current = null;
      setDragUiIfChanged(null);
      setDropTargetIfChanged(null);
      setPitchDragPreviewIfChanged(null);
      setTouchAnchorPtIfChanged(null);
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!dragActionsRef.current.isMgr) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const dist = Math.hypot(dx, dy);

      if (!d.active) {
        if (!d.immediate) {
          // If touching non-grip part of row and swiping vertically to scroll, cancel drag cleanly
          if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx) * 1.15) {
            clearDrag();
            return;
          }
          if (dist > 10 && Math.abs(dx) >= Math.abs(dy)) {
            if (d.holdTimer) window.clearTimeout(d.holdTimer);
            d.active = true;
            d.immediate = true;
          }
        } else if (dist > 6) {
          d.active = true;
        }
      }
      if (!d.active) return;

      d.x = e.clientX;
      d.y = e.clientY;

      const liftPx = d.isTouch ? TOUCH_LIFT_PX : 0;
      const pitchPt = clientToPitchCoords(e.clientX, e.clientY, liftPx);
      if (d.fromPitchIdx !== undefined && d.fromPitchIdx >= 1 && pitchPt?.inside) {
        if (d.isTouch) {
          setTouchAnchorPtIfChanged({
            px: clamp(pitchPt.rawPx, 8, 292),
            py: clamp(pitchPt.rawPy, 8, 372)
          });
        } else {
          setTouchAnchorPtIfChanged(null);
        }

        const { starters: curStarters, slots: curSlots } = dragActionsRef.current;
        let closestSwap: { name: string; slot?: string; dist: number } | null = null;
        curStarters.forEach((other, idx) => {
          if (idx === d.fromPitchIdx) return;
          const oz = curSlots[idx];
          if (!oz) return;
          const ox = 18 + oz.x * 2.64;
          const oy = 16 + oz.y * 3.48;
          const sDist = Math.hypot(pitchPt.px - ox, pitchPt.py - oy);
          if (sDist < 15.5 && (!closestSwap || sDist < closestSwap.dist)) {
            closestSwap = { name: other.n, slot: oz.sp, dist: sDist };
          }
        });
        if (closestSwap) {
          const swapObj = closestSwap as { name: string; slot?: string };
          pitchDragPreviewRef.current = null;
          setPitchDragPreviewIfChanged(null);
          setDropTargetIfChanged({ name: swapObj.name, slot: swapObj.slot });
          updateDragGhostPos(e.clientX, e.clientY - (d.isTouch ? 36 : 0));
          setDragUiIfChanged({ player: d.player, fromSlot: d.fromSlot });
          return;
        }

        const nx = clamp(Math.round((pitchPt.px - 18) / 2.64), 4, 96);
        const ny = clamp(Math.round((pitchPt.py - 16) / 3.48), 8, 84);
        const zone = getPitchZoneAt(nx, ny);
        const resolvedSp: SubRole = zone.sp;
        const preview: PitchDragPreview = {
          slotIdx: d.fromPitchIdx,
          player: d.player,
          x: nx,
          y: ny,
          sp: resolvedSp,
          zoneId: zone.id,
          zoneLabel: zone.label
        };
        pitchDragPreviewRef.current = preview;
        setPitchDragPreviewIfChanged(preview);
        setDropTargetIfChanged(null);
        setDragUiIfChanged(null);
        return;
      }

      pitchDragPreviewRef.current = null;
      setPitchDragPreviewIfChanged(null);
      setTouchAnchorPtIfChanged(null);
      updateDragGhostPos(e.clientX, e.clientY);
      setDragUiIfChanged({ player: d.player, fromSlot: d.fromSlot });
      const hit = findDropAt(e.clientX, e.clientY, d.player.n, d.fromPitchIdx === undefined && d.isTouch ? 34 : 0);
      setDropTargetIfChanged(hit);
    };

    const onTouchMove = (e: TouchEvent) => {
      const d = dragRef.current;
      if (d && (d.active || d.immediate) && dragActionsRef.current.isMgr) {
        if (e.cancelable) e.preventDefault();
      }
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const preview = pitchDragPreviewRef.current;
      const wasActive = d.active;
      const liftPx = d.isTouch ? (d.fromPitchIdx !== undefined ? TOUCH_LIFT_PX : 34) : 0;
      clearDrag();

      if (!wasActive) {
        dragActionsRef.current.handleTapPlayerAction(d.player);
        return;
      }
      if (preview) {
        dragActionsRef.current.moveStarterToZone(
          preview.slotIdx,
          preview.x,
          preview.y,
          preview.sp,
          preview.zoneLabel,
          d.player.n
        );
        return;
      }
      const hit = findDropAt(e.clientX, e.clientY, d.player.n, liftPx);
      if (hit && hit.name !== d.player.n) {
        dragActionsRef.current.swapAnyPlayers(d.player.n, hit.name);
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

  const liveSlots = pitchDragPreview
    ? slots.map((z, idx) =>
        idx === pitchDragPreview.slotIdx
          ? { ...z, sp: pitchDragPreview.sp, pos: LINE[pitchDragPreview.sp] || z.pos }
          : z
      )
    : slots;
  const offPosCount = starters.filter((q, i) => playerPen(q, liveSlots[i]?.sp || '') > 0).length;

  const formName = (t: Team, preview?: PitchDragPreview | null) => {
    if (preview) {
      const pSlots = getFormationSlots(t).map((z, idx) =>
        idx === preview.slotIdx ? { ...z, sp: preview.sp, pos: LINE[preview.sp] || z.pos } : z
      );
      const df = pSlots.filter((z) => z.pos === 'DF').length;
      const mf = pSlots.filter((z) => z.pos === 'MF').length;
      const fw = pSlots.filter((z) => z.pos === 'FW').length;
      return `${df}-${mf}-${fw}`;
    }
    if (t.form === 'custom') {
      const cnt = getFormationCounts(t);
      return `${cnt[1]}-${cnt[2]}-${cnt[3]}`;
    }
    return t.form;
  };

  const coachAdvice = () => {
    const av = (p: 'MF' | 'FW' | 'DF') => {
      const idxList = starters.map((q, i) => ((slots[i]?.pos || q.pos) === p ? i : -1)).filter((i) => i >= 0);
      return idxList.reduce((s, i) => s + starters[i].ov, 0) / (idxList.length || 1);
    };
    const m = av('MF');
    const f = av('FW');
    const out: string[] = [];
    if (m > f + 4) out.push('กองกลางเด่น เหมาะบอลสั้น');
    if (f > m + 4) out.push('กองหน้าเด่น เหมาะบอลยาวหรือเกมสวน');
    if (av('DF') < m - 5) out.push('แนวรับอ่อน อย่าตั้งแนวรับสูง');
    if (starters.some((q) => (q.fit ?? 100) < 60)) out.push('มีตัวจริงเหนื่อย ลดเพรสซิ่งหรือโรเตชั่น');
    return 'คำแนะนำโค้ช: ' + (out.join(' · ') || 'ทีมสมดุล เลือกแผนได้ตามต้องการ');
  };

  const renderPlayerRow = (q: Player, slotSp?: SubRole) => {
    const stMeta = getStaminaMeta(q.fit);
    const f = stMeta.f;
    const isSource = dragUi?.player.n === q.n;
    const isTarget = dropTarget?.name === q.n && dragUi?.player.n !== q.n;
    const isMe = !!q.me || (!isMgr && state.p?.name === q.n);
    const pn = slotSp ? playerPen(q, slotSp) : 0;
    const no = getShirtNo(me, q);
    const unavailable = q.inj > 0 || (q.sus || 0) > 0;
    const rowStaminaTint =
      slotSp && !unavailable
        ? f < 65
          ? 'bg-rose-500/[0.08] hover:bg-rose-500/[0.13]'
          : f < 75
            ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.11]'
            : ''
        : '';

    return (
      <div
        key={q.n}
        role="button"
        tabIndex={0}
        data-drop-player={q.n}
        data-drop-slot={slotSp || ''}
        onPointerDown={(e) => handlePlayerPointerDown(e, q, slotSp)}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            SFX.tap();
            onInspectPlayer(q, me);
          }
        }}
        className={`w-full grid grid-cols-[16px_22px_34px_26px_minmax(0,1fr)_74px_30px] mland:grid-cols-[14px_19px_30px_24px_minmax(0,1fr)_64px_26px] items-center gap-1 mland:gap-0.5 px-2 py-[3.5px] mland:px-1.5 mland:py-[2.5px] text-left select-none transition-colors ${
          isTarget
            ? 'bg-[var(--lamp-soft)] ring-1 ring-inset ring-[var(--lamp)]'
            : isSource
              ? 'opacity-45 bg-[var(--surface-2)]'
              : unavailable
                ? 'bg-rose-500/[0.06] hover:bg-rose-500/[0.1]'
                : isMe
                  ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/70'
                  : rowStaminaTint || 'hover:bg-[var(--surface-2)]/65'
        } ${unavailable ? 'opacity-82' : ''} ${dragUi ? 'cursor-grabbing' : 'cursor-pointer'}`}
      >
        <div
          data-drag-grip={isMgr ? '1' : undefined}
          style={isMgr ? { touchAction: 'none' } : undefined}
          className={`flex items-center justify-center shrink-0 [&>svg]:w-[15px] [&>svg]:h-[15px] mland:[&>svg]:w-[13px] mland:[&>svg]:h-[13px] ${
            isMgr ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          }`}
        >
          <ClubCrest name={me.name} size={15} team={me} club={state.club} isMyClub={isMgr} />
        </div>

        <div
          data-drag-grip={isMgr ? '1' : undefined}
          onContextMenu={(e) => e.preventDefault()}
          style={
            isMgr
              ? { touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }
              : { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }
          }
          title={isMgr ? 'ลากเพื่อเปลี่ยนหรือสลับตำแหน่ง' : 'กด 1 ครั้งเพื่อดูข้อมูล'}
          className={`flex items-center justify-start ${isMgr ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        >
          <MatchPlayerThumb
            player={q}
            team={me}
            state={state}
            kitColor={q.pos === 'GK' ? meGkKit : meKit}
            trimColor={q.pos === 'GK' ? undefined : meTrim}
            size="xs"
          />
        </div>

        <div
          data-drag-grip={isMgr ? '1' : undefined}
          style={isMgr ? { touchAction: 'none' } : undefined}
          className={`flex items-center justify-center ${isMgr ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        >
          <PositionBadge role={slotSp || q.ro} size="2xs" />
        </div>

        <div
          data-drag-grip={isMgr ? '1' : undefined}
          style={isMgr ? { touchAction: 'none' } : undefined}
          className={`text-left text-[10px] mland:text-[8.5px] font-extrabold text-[#b45309] dark:text-[var(--lamp)] tabular whitespace-nowrap ${
            isMgr ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          }`}
        >
          #{no}
        </div>

        <div className="flex items-center justify-start gap-1 min-w-0">
          <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate">{q.n}</span>
          {me.cap === q.n && <CaptainBadge team={me} state={state} size="xs" className="shrink-0" />}
          {isMe && (
            <span
              title="ตัวคุณ"
              aria-label="ตัวคุณ"
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8px] font-black shrink-0"
            >
              ★
            </span>
          )}
          {(q.hg || q.customCreated) ? <span title="เด็กปั้นสโมสร" className="text-[10px] mland:text-[8.5px] shrink-0">🌱</span> : null}
          {slotSp && slotSp !== q.ro && (
            <span className="text-[8.5px] mland:text-[7.5px] text-[var(--mut)] shrink-0">
              ({q.ro}{pn === 2 ? ' ⚠️' : ''})
            </span>
          )}
        </div>

        <div className="flex items-center justify-start min-w-0">
          <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
        </div>

        <div className="flex items-center justify-start">
          <OvrBadge ov={q.ov} size="2xs" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {dragUi && (
        <div
          ref={dragGhostRef}
          className="fixed left-0 top-0 z-[100] pointer-events-none flex items-center gap-2 px-3 py-2 rounded-2xl bg-[var(--surface)] border-2 border-[var(--lamp)] shadow-2xl max-w-[210px] will-change-transform"
          style={{
            transform: `translate3d(${dragGhostPosRef.current.x}px, ${dragGhostPosRef.current.y}px, 0)`
          }}
        >
          <PlayerFace player={dragUi.player} team={me} state={state} size={30} />
          <div className="text-xs min-w-0">
            <div className="font-bold truncate">{dragUi.player.n.split(' ')[0]} · {dragUi.fromSlot || dragUi.player.ro}</div>
            <div className="text-[11px] text-[var(--g)] font-semibold truncate">
              {dropTarget ? `↔ ${dropTarget.name.split(' ')[0]}${dropTarget.slot ? ` (${dropTarget.slot})` : ''}` : 'ลากไปวางเพื่อสลับ/ย้าย'}
            </div>
          </div>
        </div>
      )}

      {(() => {
        const setSquadSubTab = (nextSub: number) => {
          SFX.tap();
          if (onShallowPatch) onShallowPatch(() => ({ sub: nextSub }));
          else onUpdateState((d) => { d.sub = nextSub; });
        };
        const subTabBar = (
          <div className="seg-bar shrink-0">
            <button type="button" onClick={() => setSquadSubTab(0)} className={`seg-btn ${sub === 0 ? 'seg-btn-active' : ''}`}>
              ⚽ ตัวจริง
            </button>
            <button type="button" onClick={() => setSquadSubTab(1)} className={`seg-btn ${sub === 1 ? 'seg-btn-active' : ''}`}>
              🧭 แผนเกม
            </button>
            <button type="button" onClick={() => setSquadSubTab(2)} className={`seg-btn ${sub === 2 ? 'seg-btn-active' : ''}`}>
              📋 ทั้งทีม ({me.sq.length})
            </button>
            <button type="button" onClick={() => setSquadSubTab(3)} className={`seg-btn ${sub === 3 ? 'seg-btn-active' : ''}`}>
              👕 ล็อกเกอร์
            </button>
          </div>
        );

        const formationStatusSummary = (
          <>
            <span className="font-bold text-[var(--ink)]">แผน {formName(me, pitchDragPreview)}</span>
            <span className="opacity-35">·</span>
            <span>{AR_T[me.tac]}</span>
            <span className="opacity-35">·</span>
            <span>⚔️{Math.round(r.at)}</span>
            <span>🛡️{Math.round(r.df)}</span>
            <span className="opacity-35">·</span>
            <span className={`font-bold ${getStaminaMeta(avgFit).txtCls}`}>
              ⚡{avgFit}%
            </span>
            {restNeededStarters.length > 0 && (
              <>
                <span className="opacity-35">·</span>
                <span className="text-[var(--red)] font-bold" title="จำนวนตัวจริงที่ความฟิตต่ำกว่า 65% แนะนำให้พักนัดถัดไป">
                  🔴{restNeededStarters.length}
                </span>
              </>
            )}
            {offPosCount > 0 && (
              <>
                <span className="opacity-35">·</span>
                <span className="text-[var(--red)] font-bold" title="จำนวนนักเตะที่ลงเล่นนอกตำแหน่งถนัด">
                  ⚠️{offPosCount}
                </span>
              </>
            )}
          </>
        );

        if (sub === 0) {
          return (
            <div className="grid grid-cols-[1.04fr_0.96fr] mland:grid-cols-[1.02fr_0.98fr] grid-rows-[minmax(0,1fr)] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
              {/* LEFT: Full-Height Pitch with Top-Right Formation Switcher inside Pitch */}
              <div className="relative p-1 mland:p-0.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col h-full min-h-0 overflow-hidden">
                {isMgr && pitchDragPreview && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-2.5 py-0.5 rounded-lg bg-[var(--surface)]/95 border border-[var(--g)]/60 text-[var(--g)] text-[10.5px] mland:text-[9px] font-bold whitespace-nowrap shadow-md">
                    📍 {pitchDragPreview.player.n.split(' ')[0]} → {pitchDragPreview.sp} ({pitchDragPreview.zoneLabel}) · {formName(me, pitchDragPreview)}
                  </div>
                )}

                {/* Top-Right Inside Pitch: Compact Plan Pill (Tap to Expand, Tap Outside to Collapse) */}
                {!(isMgr && pitchDragPreview) && (
                  <div
                    ref={formationPopoverRef}
                    className="absolute top-2 right-2 mland:top-1.5 mland:right-1.5 z-20 flex flex-col items-end max-w-[calc(100%-16px)]"
                  >
                    {isMgr ? (
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setShowFormationSheet((v) => !v);
                        }}
                        title="กดเพื่อเปลี่ยนแผนและสไตล์คุมทีม"
                        className={`inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] mland:text-[8.5px] font-semibold tabular whitespace-nowrap px-2 mland:px-1.5 py-0.5 rounded-lg border shadow-md cursor-pointer transition-colors max-w-full overflow-x-auto no-scrollbar ${
                          showFormationSheet
                            ? 'bg-[var(--surface)] border-[var(--g)] ring-1 ring-[var(--g)]/40 text-[var(--ink)]'
                            : 'bg-[var(--surface)]/95 border-[var(--line)]/90 text-[var(--ink)] hover:border-[var(--g)]/70'
                        }`}
                      >
                        {formationStatusSummary}
                        <span className="text-[9px] text-[var(--g)] ml-0.5 shrink-0">{showFormationSheet ? '▴' : '▾'}</span>
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] mland:text-[8.5px] font-semibold tabular whitespace-nowrap px-2 mland:px-1.5 py-0.5 rounded-lg border border-[var(--line)]/90 bg-[var(--surface)]/95 shadow-md max-w-full overflow-x-auto no-scrollbar">
                        {formationStatusSummary}
                      </div>
                    )}

                    {isMgr && showFormationSheet && (
                      <div className="mt-1.5 w-[275px] sm:w-[310px] mland:w-[250px] max-w-[calc(100%-4px)] p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--g)]/55 shadow-xl space-y-1.5 mland:space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[9px]">
                          <span className="font-bold text-[var(--ink)]">🧭 เปลี่ยนแผน &amp; สไตล์คุมทีม</span>
                          <button
                            type="button"
                            onClick={() => setShowFormationSheet(false)}
                            className="btn btn-xs btn-secondary !py-0 !px-1.5"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {Object.keys(FSD).map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                onUpdateState((d) => {
                                  const t = d.teams[d.me];
                                  if (t.form !== f) {
                                    t.form = f;
                                    t.lu = null;
                                    t.tacFam = Math.max(40, (t.tacFam ?? 65) - 10);
                                  }
                                });
                              }}
                              className={`btn btn-xs truncate !px-1 ${
                                me.form === f ? 'btn-primary' : 'btn-secondary'
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {(['X', 'A', 'B', 'D', 'Z'] as Mentality[]).map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                onUpdateState((d) => { d.teams[d.me].tac = k; });
                              }}
                              className={`btn btn-xs truncate !px-1 ${
                                me.tac === k ? 'btn-gold' : 'btn-secondary text-[var(--mut)]'
                              }`}
                            >
                              {AR_T[k]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="w-full mx-auto flex-1 min-h-0 h-full flex items-center justify-center">
                  <FormationPitch
                    team={me}
                    state={state}
                    svgRef={isMgr ? pitchSvgRef : undefined}
                    showPositionZones={isMgr && Boolean(pitchDragPreview)}
                    subAlertFitTh={65}
                    dragSourceName={isMgr ? (dragUi?.player.n || null) : null}
                    dropTargetName={isMgr ? (dropTarget?.name || null) : null}
                    dragPreview={isMgr ? pitchDragPreview : null}
                    touchPointerPitchPt={isMgr ? touchAnchorPt : null}
                    onPlayerPointerDown={handlePlayerPointerDown}
                  />
                </div>
              </div>

              {/* RIGHT: Top-Right Navigation Tabs + Single-Row Squad Header & List */}
              <div className="flex flex-col gap-1.5 mland:gap-1 min-h-0 h-full overflow-hidden">
                {/* Top-Right Tabs Corner */}
                <div className="flex items-center justify-end shrink-0 overflow-x-auto no-scrollbar">
                  {subTabBar}
                </div>

                {/* Squad Panel */}
                <div className="flex-1 min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-col overflow-hidden">
                  <SquadListHeaderBar
                    totalCount={starters.length + bench.length}
                    canEdit={isMgr}
                    tiredCount={restNeededStarters.length > 0 ? restNeededStarters.length : tiredWarningStarters.length}
                    isRestCritical={restNeededStarters.length > 0}
                    onRestTired={restTiredStarters}
                    isAutoLineup={!me.lu}
                    onAutoLineup={() => {
                      SFX.tap();
                      onUpdateState((d) => { d.teams[d.me].lu = null; });
                      onToast('จัด 11 ตัวจริงอัตโนมัติแล้ว');
                    }}
                  />

                  {/* Player Rows (Scrollable Starters + Bench) */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <div
                      className="sticky top-0 z-10 px-2.5 py-0.5 mland:px-2 border-b border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--g)]"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--g) 15%, var(--surface))' }}
                    >
                      <span>ตัวจริง</span>
                      <span className="tabular">{starters.length} คน</span>
                    </div>
                    <div className="divide-y divide-[var(--line)]/50">
                      {starters.map((q, i) => renderPlayerRow(q, slots[i]?.sp))}
                    </div>
                    <div className="sticky top-0 z-10 px-2.5 py-0.5 mland:px-2 bg-[var(--surface-2)] border-y border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--ink)]">
                      <span>ตัวสำรอง</span>
                      <span className="tabular text-[var(--mut)]">{bench.length} คน</span>
                    </div>
                    <div className="divide-y divide-[var(--line)]/50">
                      {bench.map((q) => renderPlayerRow(q))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-between gap-1.5 flex-nowrap overflow-x-auto shrink-0">
            <div className="inline-flex items-center gap-1 text-[11px] mland:text-[9.5px] font-semibold tabular whitespace-nowrap shrink-0 px-2 py-1 mland:py-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
              {formationStatusSummary}
            </div>
            {subTabBar}
          </div>
        );
      })()}

      {sub === 0 ? null : sub === 1 ? (
        <div className="p-3 sm:p-3.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex-1 min-h-0 flex flex-col gap-2.5 mland:gap-1.5 overflow-hidden">
          {/* Top Summary Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mland:pb-1.5 border-b border-[var(--line)] shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold font-display text-sm mland:text-xs text-[var(--ink)]">
                  🧭 แผนเกม &amp; ยุทธวิธี
                </h3>
                <span className="text-xs mland:text-[10.5px] font-extrabold text-[var(--g)] tabular">
                  · {formName(me)}
                </span>
              </div>
              <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate mt-0.5">
                {coachAdvice()}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5 text-[11px] mland:text-[9.5px] tabular">
                  <span className="text-[var(--mut)] font-semibold">ความเข้าใจแผน</span>
                  <span className="font-extrabold text-[var(--g)]">{me.tacFam ?? 65}%</span>
                </div>
                <div className="w-24 sm:w-28 mland:w-20 h-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--g)] transition-all duration-300"
                    style={{ width: `${clamp(me.tacFam ?? 65, 8, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {isMgr ? (
            <div className="grid grid-cols-1 md:grid-cols-[0.94fr_1.06fr] mland:grid-cols-[0.92fr_1.08fr] grid-rows-[minmax(0,1fr)] gap-3.5 mland:gap-2.5 flex-1 min-h-0 overflow-hidden">
              {/* Left Column: Pitch + Formation Grid + Presets + Quick Save Slots */}
              <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-1">
                {/* Formation & Live Mini-Pitch */}
                <div className="grid grid-cols-[124px_1fr] sm:grid-cols-[142px_1fr] mland:grid-cols-[110px_1fr] gap-3 mland:gap-2 items-center">
                  <div className="shrink-0">
                    <TacticsMiniPitch team={me} state={state} />
                  </div>
                  <div className="min-w-0 space-y-1.5 mland:space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs mland:text-[10px] font-bold text-[var(--ink)]">ระบบการเล่น</span>
                      <span className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)] tabular">
                        {me.form === 'custom' ? `ปรับเอง ${formName(me)}` : me.form}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                      {Object.keys(FSD).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              const t = d.teams[d.me];
                              if (t.form !== f) {
                                t.form = f;
                                t.lu = null;
                                t.tacFam = Math.max(40, (t.tacFam ?? 65) - 10);
                              }
                            });
                          }}
                          className={`btn btn-xs sm:btn-sm !px-1 truncate tabular ${
                            me.form === f ? 'btn-primary' : 'btn-secondary'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setShowCustomEditor(true);
                        }}
                        className={`col-span-2 btn btn-xs sm:btn-sm !px-2 truncate ${
                          me.form === 'custom' ? 'btn-primary' : 'btn-secondary'
                        }`}
                      >
                        ✏️ ปรับแผนเอง
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tactical Presets */}
                <div className="pt-2.5 mland:pt-2 border-t border-[var(--line)]/70 space-y-1.5 mland:space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs mland:text-[10px] font-bold text-[var(--ink)]">⚡ ชุดยุทธวิธีสำเร็จรูป</span>
                    <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">เลือกใช้ทันที</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 mland:gap-1">
                    {PRE.map(([lbl, cfg], idx) => {
                      const isActivePreset =
                        me.form === cfg.form &&
                        me.tac === cfg.tac &&
                        (me.press ?? 1) === cfg.press &&
                        (me.tempo ?? 1) === cfg.tempo &&
                        (me.wid ?? 1) === cfg.wid &&
                        (me.line ?? 1) === cfg.line &&
                        (me.pass ?? 1) === cfg.pass;
                      return (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              Object.assign(d.teams[d.me], cfg);
                              d.teams[d.me].lu = null;
                            });
                            onToast(`ใช้ยุทธวิธี "${lbl}"`);
                          }}
                          className={`${idx < 3 ? 'col-span-2' : 'col-span-3'} btn btn-xs sm:btn-sm !px-1.5 truncate ${
                            isActivePreset
                              ? 'btn-primary'
                              : 'btn-secondary hover:border-[var(--g)]/70'
                          }`}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Save / Load Slots */}
                <div className="pt-2.5 mland:pt-2 border-t border-[var(--line)]/70 space-y-1.5 mland:space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs mland:text-[10px] font-bold text-[var(--ink)]">💾 ช่องบันทึกแผนด่วน</span>
                    <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">สลับแผนก่อนแข่ง</span>
                  </div>
                  <div className="space-y-1.5 mland:space-y-1">
                    {[0, 1].map((idx) => {
                      const savedSlot = state.slots?.[idx];
                      const slotForm = typeof savedSlot?.form === 'string' ? savedSlot.form : '';
                      const slotTac = typeof savedSlot?.tac === 'string' && savedSlot.tac in AR_T ? (savedSlot.tac as Mentality) : null;
                      const slotSummary = savedSlot
                        ? `${slotForm === 'custom' ? 'ปรับเอง' : slotForm || 'แผนบันทึก'}${slotTac ? ` · ${AR_T[slotTac]}` : ''}`
                        : 'ยังว่าง';
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)]/80"
                        >
                          <div className="min-w-0 flex items-center gap-1.5 text-[11px] mland:text-[9.5px]">
                            <span className="font-bold text-[var(--ink)] shrink-0">แผน {idx + 1}</span>
                            <span className="text-[var(--mut)] opacity-50">·</span>
                            <span className={`truncate tabular ${savedSlot ? 'text-[var(--g)] font-semibold' : 'text-[var(--mut)]'}`}>
                              {slotSummary}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                onUpdateState((d) => {
                                  const t = d.teams[d.me];
                                  d.slots = d.slots || [null, null];
                                  d.slots[idx] = { form: t.form, cf: t.cf, tac: t.tac, press: t.press, tempo: t.tempo, wid: t.wid, line: t.line, pass: t.pass };
                                });
                                onToast(`บันทึกแผน ${idx + 1} แล้ว`);
                              }}
                              className="btn btn-xs btn-secondary"
                            >
                              บันทึก
                            </button>
                            <button
                              type="button"
                              disabled={!savedSlot}
                              onClick={() => {
                                SFX.tap();
                                onUpdateState((d) => {
                                  const s = d.slots?.[idx];
                                  if (s) {
                                    Object.assign(d.teams[d.me], s);
                                    d.teams[d.me].lu = null;
                                  }
                                });
                                onToast(`โหลดแผน ${idx + 1} แล้ว`);
                              }}
                              className="btn btn-xs btn-primary"
                            >
                              โหลด
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Mentality, Passing, Intensity Controls, Captain & Set Pieces, Auto Rules */}
              <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-1">
                {/* Mentality & Passing Style */}
                <div className="space-y-2 mland:space-y-1.5">
                  <div>
                    <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] mb-1">สไตล์คุมทีม (Mentality)</div>
                    <div className="seg-bar grid grid-cols-5 w-full">
                      {(['X', 'A', 'B', 'D', 'Z'] as Mentality[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => { d.teams[d.me].tac = k; });
                          }}
                          className={`seg-btn truncate !px-1 ${me.tac === k ? 'seg-btn-active' : ''}`}
                        >
                          {AR_T[k]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] mb-1">สไตล์การจ่ายบอล</div>
                    <div className="seg-bar grid grid-cols-4 w-full">
                      {['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'].map((l, k) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => { d.teams[d.me].pass = k; });
                          }}
                          className={`seg-btn truncate !px-1 ${(me.pass ?? 1) === k ? 'seg-btn-active' : ''}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4 Tactical Sliders (2x2 Grid) */}
                <div className="grid grid-cols-2 gap-2.5 mland:gap-2">
                  <div>
                    <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] mb-1">เพรสซิ่ง</div>
                    <div className="seg-bar grid grid-cols-3 w-full">
                      {['ต่ำ', 'กลาง', 'สูง'].map((l, k) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => { d.teams[d.me].press = k; });
                          }}
                          className={`seg-btn !px-1 ${(me.press ?? 1) === k ? 'seg-btn-active' : ''}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] mb-1">จังหวะเกม</div>
                    <div className="seg-bar grid grid-cols-3 w-full">
                      {['ช้า', 'กลาง', 'เร็ว'].map((l, k) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => { d.teams[d.me].tempo = k; });
                          }}
                          className={`seg-btn !px-1 ${(me.tempo ?? 1) === k ? 'seg-btn-active' : ''}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] mb-1">ความกว้าง</div>
                    <div className="seg-bar grid grid-cols-3 w-full">
                      {['แคบ', 'กลาง', 'กว้าง'].map((l, k) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => { d.teams[d.me].wid = k; });
                          }}
                          className={`seg-btn !px-1 ${(me.wid ?? 1) === k ? 'seg-btn-active' : ''}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] mb-1">แนวรับ</div>
                    <div className="seg-bar grid grid-cols-3 w-full">
                      {['ลึก', 'กลาง', 'สูง'].map((l, k) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => { d.teams[d.me].line = k; });
                          }}
                          className={`seg-btn !px-1 ${(me.line ?? 1) === k ? 'seg-btn-active' : ''}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Captain & Set-Piece Takers */}
                <div className="pt-2.5 mland:pt-2 border-t border-[var(--line)]/70 space-y-2 mland:space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                        <CaptainBadge team={me} state={state} size="sm" />
                        <span>กัปตันทีม &amp; 🎯 มือสังหารลูกนิ่ง</span>
                      </div>
                      <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">สลับกัปตันชั่วคราวให้อัตโนมัติหากโดนเปลี่ยนออกหรือใบแดง</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onUpdateState((d) => {
                          autoAssignTeamRoles(d.teams[d.me], { careerP: d.p, forceAll: true });
                        });
                        onToast('🤖 AI คัดเลือกกัปตันและมือสังหารลูกนิ่งให้เหมาะสมที่สุดแล้ว');
                      }}
                      className="btn btn-xs btn-secondary whitespace-nowrap"
                    >
                      🤖 AI ตั้งให้อัตโนมัติ
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
                    <div>
                      <label className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] flex items-center gap-1 mb-1 mland:mb-0.5">
                        <CaptainBadge team={me} state={state} size="xs" />
                        <span>กัปตันทีม</span>
                      </label>
                      <select
                        value={me.cap || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateState((d) => { d.teams[d.me].cap = val; });
                          onToast('อัปเดตกัปตันทีมแล้ว');
                        }}
                        className="w-full px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs mland:text-[10px] font-semibold"
                      >
                        <option value="">ไม่ระบุ (ให้ AI เลือกหน้างาน)</option>
                        {me.sq
                          .slice()
                          .sort((a, b) => scoreCaptainCandidate(b, state.p) - scoreCaptainCandidate(a, state.p))
                          .slice(0, 14)
                          .map((q) => (
                            <option key={q.n} value={q.n}>
                              {q.n} ({q.ro} · OVR {q.ov})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] block mb-1 mland:mb-0.5">🚩 คนเตะมุม</label>
                      <select
                        value={me.setPieces?.corner || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateState((d) => {
                            const tm = d.teams[d.me];
                            tm.setPieces = { ...(tm.setPieces || {}), corner: val || undefined };
                          });
                          onToast('อัปเดตคนเตะมุมแล้ว');
                        }}
                        className="w-full px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs mland:text-[10px] font-semibold"
                      >
                        <option value="">อัตโนมัติ (ตามค่าพลังในสนาม)</option>
                        {me.sq
                          .filter((q) => q.pos !== 'GK')
                          .slice()
                          .sort((a, b) => scoreSetPieceCandidate(b, 'corner', state.p) - scoreSetPieceCandidate(a, 'corner', state.p))
                          .slice(0, 14)
                          .map((q) => (
                            <option key={q.n} value={q.n}>
                              {q.n} ({q.ro} · OVR {q.ov})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] block mb-1 mland:mb-0.5">🎯 คนยิงฟรีคิก</label>
                      <select
                        value={me.setPieces?.freekick || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateState((d) => {
                            const tm = d.teams[d.me];
                            tm.setPieces = { ...(tm.setPieces || {}), freekick: val || undefined };
                          });
                          onToast('อัปเดตคนยิงฟรีคิกแล้ว');
                        }}
                        className="w-full px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs mland:text-[10px] font-semibold"
                      >
                        <option value="">อัตโนมัติ (ตามค่าพลังในสนาม)</option>
                        {me.sq
                          .filter((q) => q.pos !== 'GK')
                          .slice()
                          .sort((a, b) => scoreSetPieceCandidate(b, 'freekick', state.p) - scoreSetPieceCandidate(a, 'freekick', state.p))
                          .slice(0, 14)
                          .map((q) => (
                            <option key={q.n} value={q.n}>
                              {q.n} ({q.ro} · OVR {q.ov})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] block mb-1 mland:mb-0.5">🥅 เพชฌฆาตจุดโทษ</label>
                      <select
                        value={me.setPieces?.penalty || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateState((d) => {
                            const tm = d.teams[d.me];
                            tm.setPieces = { ...(tm.setPieces || {}), penalty: val || undefined };
                          });
                          onToast('อัปเดตคนยิงจุดโทษแล้ว');
                        }}
                        className="w-full px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs mland:text-[10px] font-semibold"
                      >
                        <option value="">อัตโนมัติ (ตามค่าพลังในสนาม)</option>
                        {me.sq
                          .filter((q) => q.pos !== 'GK')
                          .slice()
                          .sort((a, b) => scoreSetPieceCandidate(b, 'penalty', state.p) - scoreSetPieceCandidate(a, 'penalty', state.p))
                          .slice(0, 14)
                          .map((q) => (
                            <option key={q.n} value={q.n}>
                              {q.n} ({q.ro} · OVR {q.ov})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Auto In-Match Rules */}
                <div className="pt-2.5 mland:pt-2 border-t border-[var(--line)]/70 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs mland:text-[10px] font-bold text-[var(--ink)]">
                      🤖 กฎปรับแผนอัตโนมัติในแมตช์
                      <span className="ml-1.5 text-[10px] font-semibold text-[var(--mut)] tabular">
                        ({(state.rules || []).length}/3)
                      </span>
                    </span>
                    {(state.rules || []).length < 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            d.rules = [...(d.rules || []), { c: 'tr', min: 65, tac: 'A' }];
                          });
                        }}
                        className="btn btn-xs btn-secondary"
                      >
                        ＋ เพิ่มกฎ
                      </button>
                    )}
                  </div>
                  {(state.rules || []).length === 0 ? (
                    <p className="text-[11px] mland:text-[9px] text-[var(--mut)]">
                      ยังไม่มีกฎอัตโนมัติ (เช่น ถ้าตามอยู่ หลังนาที 65 ให้เปลี่ยนเป็นบุกหนัก)
                    </p>
                  ) : (
                    <div className="space-y-1.5 mland:space-y-1">
                      {(state.rules || []).map((rl, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-1.5 p-2 mland:p-1.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/80 border border-[var(--line)]/70 text-xs mland:text-[10px]">
                          <select
                            value={rl.c}
                            onChange={(e) => onUpdateState((d) => { if (d.rules?.[idx]) d.rules[idx].c = e.target.value as AutoRule['c']; })}
                            className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                          >
                            {Object.entries(AR_C).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                          <span className="text-[var(--mut)]">หลังนาที</span>
                          <select
                            value={rl.min}
                            onChange={(e) => onUpdateState((d) => { if (d.rules?.[idx]) d.rules[idx].min = Number(e.target.value); })}
                            className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold tabular"
                          >
                            {[45, 60, 70, 75, 80].map((m) => <option key={m} value={m}>{m}&apos;</option>)}
                          </select>
                          <span className="text-[var(--mut)]">→</span>
                          <select
                            value={rl.tac}
                            onChange={(e) => onUpdateState((d) => { if (d.rules?.[idx]) d.rules[idx].tac = e.target.value as Mentality; })}
                            className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                          >
                            {Object.entries(AR_T).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              onUpdateState((d) => { d.rules = (d.rules || []).filter((_, j) => j !== idx); });
                            }}
                            aria-label="ลบกฎ"
                            className="ml-auto btn btn-xs btn-danger"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] mland:grid-cols-[150px_1fr] gap-3.5 mland:gap-2.5 flex-1 min-h-0 overflow-y-auto items-start">
              <div className="flex flex-col items-center gap-2">
                <TacticsMiniPitch team={me} state={state} />
                <div className="text-center text-[11px] mland:text-[9px] text-[var(--mut)]">
                  ระบบทีมปัจจุบัน: <b className="text-[var(--ink)]">{formName(me)}</b>
                </div>
              </div>

              <div className="space-y-3 mland:space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mland:gap-1.5 text-xs mland:text-[10px]">
                  <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70">
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">ระบบการเล่น</div>
                    <div className="font-bold mt-0.5">{formName(me)}</div>
                  </div>
                  <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70">
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">สไตล์คุมทีม</div>
                    <div className="font-bold mt-0.5">{AR_T[me.tac]}</div>
                  </div>
                  <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70">
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">การจ่ายบอล</div>
                    <div className="font-bold mt-0.5">{['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'][me.pass ?? 1]}</div>
                  </div>
                  <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70">
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">เพรสซิ่ง · จังหวะ</div>
                    <div className="font-bold mt-0.5">{['ต่ำ', 'กลาง', 'สูง'][me.press ?? 1]} · {['ช้า', 'กลาง', 'เร็ว'][me.tempo ?? 1]}</div>
                  </div>
                  <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70">
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">ความกว้าง · แนวรับ</div>
                    <div className="font-bold mt-0.5">{['แคบ', 'กลาง', 'กว้าง'][me.wid ?? 1]} · {['ลึก', 'กลาง', 'สูง'][me.line ?? 1]}</div>
                  </div>
                  <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70">
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] flex items-center gap-1">
                      <CaptainBadge team={me} state={state} size="xs" />
                      <span>กัปตันทีม</span>
                    </div>
                    <div className="font-bold mt-0.5 truncate">
                      {me.cap || 'AI เลือกอัตโนมัติ'}
                      {me.cap && me.cap === state.p?.name ? ' (คุณ)' : ''}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--line)]/70">
                  <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] mb-1.5">🎯 มือสังหารลูกนิ่งของทีม</div>
                  <div className="grid grid-cols-3 gap-2 mland:gap-1.5 text-xs mland:text-[10px]">
                    <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70 min-w-0">
                      <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">🚩 เตะมุม</div>
                      <div className="font-bold truncate mt-0.5">
                        {me.setPieces?.corner || 'อัตโนมัติ'}
                        {me.setPieces?.corner && me.setPieces.corner === state.p?.name ? ' (คุณ)' : ''}
                      </div>
                    </div>
                    <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70 min-w-0">
                      <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">🎯 ฟรีคิก</div>
                      <div className="font-bold truncate mt-0.5">
                        {me.setPieces?.freekick || 'อัตโนมัติ'}
                        {me.setPieces?.freekick && me.setPieces.freekick === state.p?.name ? ' (คุณ)' : ''}
                      </div>
                    </div>
                    <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70 min-w-0">
                      <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">🥅 จุดโทษ</div>
                      <div className="font-bold truncate mt-0.5">
                        {me.setPieces?.penalty || 'อัตโนมัติ'}
                        {me.setPieces?.penalty && me.setPieces.penalty === state.p?.name ? ' (คุณ)' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : sub === 3 ? (
        <LockerRoomPanel
          state={state}
          team={me}
          onUpdateState={onUpdateState}
          onInspectPlayer={onInspectPlayer}
          onToast={onToast}
        />
      ) : (
        <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5 flex-1 min-h-0 flex flex-col overflow-hidden">
          {(() => {
            const tx = getLeagueTransferContext(state, me);
            const posCounts: Record<Position, number> = {
              GK: me.sq.filter((q) => q.pos === 'GK').length,
              DF: me.sq.filter((q) => q.pos === 'DF').length,
              MF: me.sq.filter((q) => q.pos === 'MF').length,
              FW: me.sq.filter((q) => q.pos === 'FW').length
            };
            const listRows = me.sq
              .filter((q) => squadPosFilter === 'ALL' || q.pos === squadPosFilter)
              .slice()
              .sort((a, b) => {
                if (squadSort === 'ov') return b.ov - a.ov || (b.pot || b.ov) - (a.pot || a.ov);
                if (squadSort === 'fit') return (b.fit ?? 100) - (a.fit ?? 100) || b.ov - a.ov;
                if (squadSort === 'age') return a.age - b.age || b.ov - a.ov;
                if (squadSort === 'val') return vlu(b) - vlu(a) || b.ov - a.ov;
                if (squadSort === 'goals') return (b.sg || 0) - (a.sg || 0) || (b.sa || 0) - (a.sa || 0) || b.ov - a.ov;
                return POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov;
              });

            const activeSelected = isMgr
              ? selectedSquadNames.filter((name) => me.sq.some((q) => q.n === name && !q.me))
              : [];
            const selectedSet = new Set(activeSelected);
            const selectableRows = isMgr ? listRows.filter((q) => !q.me) : [];
            const allVisibleSelected =
              selectableRows.length > 0 && selectableRows.every((q) => selectedSet.has(q.n));
            const batchPreview =
              isMgr && activeSelected.length > 0
                ? validateBatchSquadRemoval(state, me, activeSelected, 'sell', 85)
                : null;

            const toggleSelectPlayer = (playerName: string) => {
              SFX.tap();
              setSelectedSquadNames((prev) => {
                const cleaned = prev.filter((n) => me.sq.some((q) => q.n === n && !q.me));
                return cleaned.includes(playerName)
                  ? cleaned.filter((n) => n !== playerName)
                  : [...cleaned, playerName];
              });
            };

            const toggleSelectAllVisible = () => {
              SFX.tap();
              const visibleNames = selectableRows.map((q) => q.n);
              if (allVisibleSelected) {
                setSelectedSquadNames((prev) => prev.filter((n) => !visibleNames.includes(n)));
              } else {
                setSelectedSquadNames((prev) => Array.from(new Set([...prev, ...visibleNames])));
              }
            };

            return (
              <>
                <div className="grid grid-cols-4 gap-2 mland:gap-1 text-center shrink-0">
                  <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ขนาดทีม (18–28)</div><div className="font-bold text-sm mland:text-[11px] tabular">{me.sq.length}/28</div></div>
                  <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ค่าเหนื่อย/เพดาน</div><div className={`font-bold text-sm mland:text-[11px] tabular ${tx.wagePct > 95 ? 'text-[var(--red)]' : ''}`}>{tx.curWage}/{tx.wageCap}k</div></div>
                  <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">โควตายืมตัว</div><div className="font-bold text-sm mland:text-[11px] tabular">{tx.loansCount}/{tx.maxLoans}</div></div>
                  <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ตลาดซื้อขาย</div><div className={`font-bold text-[11px] mland:text-[10px] mt-0.5 mland:mt-0 ${tx.tw.open ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>{tx.tw.shortLabel}</div></div>
                </div>

                {/* List Filter & Sort Bar */}
                <div className="flex items-center justify-between gap-2 mland:gap-1 pb-1.5 mland:pb-1 border-b border-[var(--line)] shrink-0 overflow-x-auto">
                  <div className="seg-bar shrink-0">
                    {([
                      ['ALL', `ทั้งหมด (${me.sq.length})`],
                      ['GK', `GK (${posCounts.GK})`],
                      ['DF', `DF (${posCounts.DF})`],
                      ['MF', `MF (${posCounts.MF})`],
                      ['FW', `FW (${posCounts.FW})`]
                    ] as const).map(([k, lbl]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSquadPosFilter(k)}
                        className={`seg-btn ${squadPosFilter === k ? 'seg-btn-active' : ''}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-nowrap items-center gap-1 shrink-0">
                    <span className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold mr-0.5 shrink-0">เรียง:</span>
                    <div className="seg-bar">
                      {([
                        ['pos', 'ตำแหน่ง'],
                        ['ov', 'OVR'],
                        ['fit', 'ความฟิต'],
                        ['age', 'อายุ'],
                        ['val', 'มูลค่า'],
                        ['goals', 'ฟอร์ม/ประตู']
                      ] as const).map(([sKey, sLbl]) => (
                        <button
                          key={sKey}
                          type="button"
                          onClick={() => setSquadSort(sKey)}
                          className={`seg-btn ${squadSort === sKey ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs' : ''}`}
                        >
                          {sLbl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Multi-select Bulk Action Bar */}
                {isMgr && activeSelected.length > 0 && batchPreview && (
                  <div className="shrink-0 px-3 py-2 mland:px-2.5 mland:py-1 rounded-xl bg-[var(--lamp-soft)]/80 border border-[var(--lamp)]/70 flex flex-wrap items-center justify-between gap-2 mland:gap-1.5">
                    <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mland:text-[10px] tabular">
                      <span className="font-extrabold text-[var(--ink)]">
                        ☑ เลือก {activeSelected.length} คน
                      </span>
                      <span className="text-[var(--mut)]">
                        · ขายด่วนรวม <b className="text-[var(--g)]">+{fmtMoneyNum(batchPreview.totalQuickSellValue)}</b>
                      </span>
                      <span className="text-[var(--mut)] hidden sm:inline mland:inline">
                        · ลดค่าเหนื่อย <b className="text-[var(--ink)]">-{fmtMoneyNum(batchPreview.totalSavedWage)}/นัด</b>
                      </span>
                      {batchPreview.squadErrors.length > 0 && (
                        <span className="text-[var(--red)] font-bold">
                          · ⚠️ {batchPreview.squadErrors[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setSellModalNames(activeSelected);
                        }}
                        className="btn btn-xs btn-primary"
                      >
                        💰 ขายที่เลือก ({activeSelected.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setReleaseModalNames(activeSelected);
                        }}
                        className="btn btn-xs btn-danger"
                      >
                        🔓 ปลด ({activeSelected.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setSelectedSquadNames([]);
                        }}
                        className="btn btn-xs btn-surface"
                      >
                        ล้าง
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 mland:space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
                {isMgr && incomingOffers.length > 0 && (
                  <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/60 flex items-center justify-between gap-2 text-xs mland:text-[10.5px]">
                    <span className="font-semibold truncate">
                      💼 มี <b className="tabular">{incomingOffers.length}</b> ข้อเสนอซื้อนักเตะรอเจรจาในตลาดซื้อขาย
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        if (onNavigate) onNavigate('k', 'sell');
                        else onUpdateState((d) => { d.v = 'k'; });
                      }}
                      className="btn btn-xs btn-gold shrink-0"
                    >
                      เปิดหน้าตลาด →
                    </button>
                  </div>
                )}

                {/* Responsive 100%-Width Squad Roster Table (Zero Horizontal Overflow) */}
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
                  <div
                    className={
                      isMgr
                        ? 'grid grid-cols-[24px_minmax(0,1.65fr)_38px_68px_104px] sm:grid-cols-[26px_minmax(0,1.75fr)_32px_46px_74px_78px_130px] lg:grid-cols-[28px_minmax(0,1.8fr)_36px_50px_76px_62px_86px_144px] mland:grid-cols-[24px_minmax(0,1.65fr)_28px_42px_66px_70px_114px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2 sm:px-2.5 mland:px-2 py-1.5 mland:py-1 text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 border-b border-[var(--line)]'
                        : 'grid grid-cols-[minmax(0,1.8fr)_36px_54px_76px_72px_94px] mland:grid-cols-[minmax(0,1.8fr)_30px_48px_66px_60px_80px] items-center gap-1.5 mland:gap-1 px-2.5 mland:px-2 py-1.5 mland:py-1 text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 border-b border-[var(--line)]'
                    }
                  >
                    {isMgr && (
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          aria-label="เลือกนักเตะทั้งหมดที่แสดง"
                          title={allVisibleSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมดเพื่อขาย/ปลด'}
                          className="w-3.5 h-3.5 accent-[var(--g)] cursor-pointer rounded"
                        />
                      </div>
                    )}
                    <div>นักเตะ</div>
                    <div className={`text-center ${isMgr ? 'hidden sm:block mland:block' : ''}`}>อายุ</div>
                    <div className="text-center">OVR</div>
                    <div className="text-center">สถานะ/ฟิต</div>
                    <div className={`text-center ${isMgr ? 'hidden lg:block mland:hidden' : ''}`}>ผลงาน</div>
                    <div className={`text-right ${isMgr ? 'hidden sm:block mland:block' : ''}`}>ค่าเหนื่อย / ค่าตัว</div>
                    {isMgr && <div className="text-right">จัดการ</div>}
                  </div>

                  <div className="divide-y divide-[var(--line)]">
                    {listRows.map((q) => {
                      const stMeta = getStaminaMeta(q.fit);
                      const f = stMeta.f;
                      const isStarter = starters.includes(q);
                      const isMe = !!q.me || (!isMgr && state.p?.name === q.n);
                      const no = getShirtNo(me, q);
                      const offerCount = isMgr ? incomingOfferCountsByName[q.n] || 0 : 0;
                      const con = ensureCon(q);
                      const wg = con.wg;
                      const isSelected = selectedSet.has(q.n);
                      const expiringSoon = !q.loan && con.yr <= 1;
                      const bio = getPlayerBio(q);
                      const footMeta = getFootColorMeta(bio.foot);
                      const unavailable = q.inj > 0 || (q.sus || 0) > 0;

                      return (
                        <div
                          key={q.n}
                          className={`px-2 sm:px-2.5 mland:px-2 py-1.5 mland:py-1 items-center gap-1 sm:gap-1.5 mland:gap-1 transition-colors ${
                            isMgr
                              ? 'grid grid-cols-[24px_minmax(0,1.65fr)_38px_68px_104px] sm:grid-cols-[26px_minmax(0,1.75fr)_32px_46px_74px_78px_130px] lg:grid-cols-[28px_minmax(0,1.8fr)_36px_50px_76px_62px_86px_144px] mland:grid-cols-[24px_minmax(0,1.65fr)_28px_42px_66px_70px_114px]'
                              : 'grid grid-cols-[minmax(0,1.8fr)_36px_54px_76px_72px_94px] mland:grid-cols-[minmax(0,1.8fr)_30px_48px_66px_60px_80px]'
                          } ${
                            isSelected
                              ? 'bg-[var(--g-soft)]/55'
                              : unavailable
                                ? 'bg-rose-500/[0.05] hover:bg-rose-500/[0.09]'
                                : isMe
                                  ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/70'
                                  : q.listed
                                    ? 'bg-[var(--lamp-soft)]/20 hover:bg-[var(--surface-2)]/45'
                                    : 'hover:bg-[var(--surface-2)]/45'
                          }`}
                        >
                          {isMgr && (
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!!q.me}
                                onChange={() => toggleSelectPlayer(q.n)}
                                aria-label={`เลือก ${q.n}`}
                                className="w-3.5 h-3.5 accent-[var(--g)] cursor-pointer rounded disabled:opacity-30"
                              />
                            </div>
                          )}

                          <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex items-center gap-1.5 mland:gap-1 min-w-0 text-left cursor-pointer">
                            <span className="shrink-0 inline-flex [&>svg]:w-4 [&>svg]:h-4 mland:[&>svg]:w-3.5 mland:[&>svg]:h-3.5">
                              <ClubCrest name={me.name} size={16} team={me} club={state.club} isMyClub={isMgr} />
                            </span>
                            <MatchPlayerThumb
                              player={q}
                              team={me}
                              state={state}
                              kitColor={q.pos === 'GK' ? meGkKit : meKit}
                              trimColor={q.pos === 'GK' ? undefined : meTrim}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-xs mland:text-[10px] truncate flex items-center gap-1">
                                <PositionBadge role={q.ro} size="2xs" />
                                <span className="text-[10.5px] mland:text-[9px] font-extrabold text-[#b45309] dark:text-[var(--lamp)] tabular shrink-0">
                                  #{no}
                                </span>
                                <span className="truncate">{q.n}</span>
                                {me.cap === q.n && <CaptainBadge team={me} state={state} size="xs" className="shrink-0" />}
                                {isMe && (
                                  <span
                                    title="ตัวคุณ"
                                    aria-label="ตัวคุณ"
                                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8.5px] font-black shrink-0"
                                  >
                                    ★
                                  </span>
                                )}
                                {isStarter && <span title="ตัวจริง" className="shrink-0">⭐</span>}
                                {(q.hg || q.customCreated) ? (
                                  <span className="px-1 rounded bg-[var(--g-soft)] border border-[var(--g)]/35 text-[var(--g)] text-[9.5px] mland:text-[8px] font-bold shrink-0" title="เด็กปั้นสโมสร">
                                    🌱
                                  </span>
                                ) : null}
                                {q.loan ? <span className="text-[10px] mland:text-[8.5px] text-blue-600 dark:text-blue-400 font-bold shrink-0">[ยืม]</span> : null}
                                {q.listed ? (
                                  <span className="px-1 rounded bg-[var(--lamp-soft)] border border-[var(--lamp)]/45 text-[#8a5b00] dark:text-[var(--lamp)] text-[9.5px] mland:text-[8px] font-bold shrink-0">
                                    ตั้งขาย {fmtMoneyNum(q.askPrice || vlu(q))}
                                  </span>
                                ) : null}
                                {offerCount > 0 ? <span className="px-1 rounded bg-[var(--g)] text-white text-[9px] font-bold shrink-0">{offerCount} บิด</span> : null}
                              </div>
                              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1 tabular mt-0.5">
                                {(q.yc || 0) > 0 && (
                                  <PlayerStatusBadge yc={q.yc} variant="pill" showYellow />
                                )}
                                <span className="shrink-0">{isStarter ? 'ตัวจริง' : 'สำรอง'}</span>
                                {!q.loan && (
                                  <span className={expiringSoon ? 'text-[var(--red)] font-bold' : ''}>
                                    · {con.yr <= 0 ? 'หมดสัญญา!' : `สัญญา ${con.yr} ปี`}
                                  </span>
                                )}
                                <span
                                  className="hidden sm:inline-flex mland:inline-flex items-center gap-1 px-1.5 py-[1px] rounded-md border bg-[var(--surface-2)]/75 border-[var(--line)] text-[9.5px] mland:text-[8px] font-bold tabular leading-tight shrink-0 whitespace-nowrap"
                                  title={`สูง ${bio.heightCm} ซม. · หนัก ${bio.weightKg} กก. · ${footMeta.titleText}`}
                                >
                                  <span className="text-[var(--ink)]/85">{bio.heightCm}/{bio.weightKg}</span>
                                  <FootPairIcon foot={bio.foot} size="xs" />
                                </span>
                              </div>
                            </div>
                          </button>

                          <div className={`text-center text-xs mland:text-[10px] tabular font-semibold ${isMgr ? 'hidden sm:block mland:block' : ''}`}>
                            {q.age}
                          </div>

                          <div className="flex items-center justify-center gap-0.5">
                            <OvrBadge ov={q.ov} size="sm" />
                            <span className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular hidden sm:inline mland:inline">/{q.pot || q.ov}</span>
                          </div>

                          <div className="flex items-center justify-center min-w-0">
                            <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
                          </div>

                          <div className={`text-center text-[10.5px] mland:text-[9px] tabular text-[var(--mut)] items-center justify-center gap-1 ${isMgr ? 'hidden lg:flex mland:hidden' : 'flex'}`}>
                            {q.sg || q.sa || q.cs || q.sp || q.ap ? (
                              <span className="inline-flex items-center gap-1.5">
                                {q.sp || q.ap ? <span className="font-semibold text-[var(--ink)]">{q.sp || q.ap}น</span> : null}
                                {q.sg ? (
                                  <span className="inline-flex items-center gap-0.5 font-bold text-[var(--ink)]" title={`ยิง ${q.sg} ประตู`}>
                                    <span>{q.sg}</span>
                                    <StatIconBadge kind="goal" count={1} size="xs" />
                                  </span>
                                ) : null}
                                {q.pos === 'GK' ? (
                                  q.cs ? (
                                    <span className="inline-flex items-center gap-0.5 font-bold text-[var(--g)]" title={`คลีนชีต ${q.cs} นัด`}>
                                      <StatIconBadge kind="cleansheet" count={1} size="xs" />
                                      <span>{q.cs}</span>
                                    </span>
                                  ) : null
                                ) : q.sa ? (
                                  <span className="inline-flex items-center gap-0.5 font-bold text-[var(--ink)]" title={`👟 ${q.sa}`}>
                                    <span>{q.sa}</span>
                                    <StatIconBadge kind="assist" count={1} size="xs" />
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </div>

                          <div className={`text-right text-[10.5px] mland:text-[9px] tabular whitespace-nowrap ${isMgr ? 'hidden sm:block mland:block' : ''}`}>
                            <span className="font-bold text-[var(--ink)]">{fmtMoneyNum(wg)}</span>
                            <span className="text-[var(--mut)]"> · {fmtMoneyNum(vlu(q))}</span>
                          </div>

                          {isMgr && (
                            <div className="flex items-center justify-end gap-1 mland:gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={!!q.loan}
                                title={q.loan ? 'นักเตะยืมตัวต่อสัญญาไม่ได้' : 'ต่อสัญญาฉบับใหม่'}
                                onClick={() => {
                                  SFX.tap();
                                  setRenewTargetName(q.n);
                                }}
                                className={`btn btn-xs ${
                                  expiringSoon ? 'btn-primary' : 'btn-secondary'
                                }`}
                              >
                                <span className="hidden lg:inline">ต่อสัญญา</span>
                                <span className="lg:hidden">ต่อ</span>
                              </button>
                              <button
                                type="button"
                                disabled={!!q.loan}
                                title={q.loan ? 'นักเตะยืมตัวขายไม่ได้' : 'ขายหรือขึ้นบัญชีขาย'}
                                onClick={() => {
                                  SFX.tap();
                                  setSellModalNames([q.n]);
                                }}
                                className="btn btn-xs bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 text-[#7c5300] dark:text-[var(--lamp)] hover:brightness-95"
                              >
                                ขาย
                              </button>
                              <button
                                type="button"
                                title={q.loan ? 'ยกเลิกยืมตัว (ส่งกลับต้นสังกัด)' : 'ปลดนักเตะออกจากสโมสร'}
                                onClick={() => {
                                  SFX.tap();
                                  setReleaseModalNames([q.n]);
                                }}
                                className="btn btn-xs btn-secondary text-[var(--mut)] hover:text-[var(--red)] hover:border-[var(--red)]/50"
                              >
                                {q.loan ? 'คืนยืม' : 'ปลด'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!listRows.length && (
                      <div className="p-6 text-center text-xs text-[var(--mut)]">ไม่มีนักเตะในตำแหน่งนี้</div>
                    )}
                  </div>
                </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {isMgr && showCustomEditor && (
        <CustomFormationModal
          team={me}
          kitColor={tc(me, state)}
          onClose={() => setShowCustomEditor(false)}
          onSave={(cf) => {
            onUpdateState((d) => {
              const t = d.teams[d.me];
              t.cf = cf;
              t.form = 'custom';
              t.lu = null;
            });
            setShowCustomEditor(false);
            onToast('บันทึกแผนที่ปรับเองแล้ว!');
          }}
        />
      )}

      {isMgr && renewTargetName && (() => {
        const target = me.sq.find((q) => q.n === renewTargetName);
        if (!target) return null;
        return (
          <SquadRenewModal
            state={state}
            team={me}
            player={target}
            onClose={() => setRenewTargetName(null)}
            onUpdateState={onUpdateState}
            onToast={onToast}
          />
        );
      })()}

      {isMgr && sellModalNames && sellModalNames.length > 0 && (
        <SquadSellModal
          state={state}
          team={me}
          playerNames={sellModalNames}
          onClose={() => setSellModalNames(null)}
          onUpdateState={onUpdateState}
          onClearSelection={(soldNames) =>
            setSelectedSquadNames((prev) => prev.filter((n) => !soldNames.includes(n)))
          }
          onToast={onToast}
        />
      )}

      {isMgr && releaseModalNames && releaseModalNames.length > 0 && (
        <SquadReleaseModal
          state={state}
          team={me}
          playerNames={releaseModalNames}
          onClose={() => setReleaseModalNames(null)}
          onUpdateState={onUpdateState}
          onClearSelection={(releasedNames) =>
            setSelectedSquadNames((prev) => prev.filter((n) => !releasedNames.includes(n)))
          }
          onToast={onToast}
        />
      )}
    </div>
  );
});

