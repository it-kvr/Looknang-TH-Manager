import React, { useEffect, useRef, useState } from 'react';
import type { MainTab, Position, SubRole, Mentality, Player, CustomSlot, Team, AutoRule, GameState, PitchDragPreview } from '../types/game';
import { clamp, fmtMoneyNum } from '../utils/math';
import { POS, FSD, LINE, AR_C, AR_T, PRE } from '../data/thaiFootballData';
import { SFX, vibrate } from '../utils/audioTheme';
import { getShirtNo, getFormationSlots, getFormationCounts, playerPen, xi, vlu, ensureCon, tc, getPlayerBio } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import { rate, getLeagueTransferContext, getIncomingOffers, validateBatchSquadRemoval } from '../engine/simulation';
import { PlayerFace, TacticsMiniPitch, getPitchZoneAt, FormationPitch } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { LockerRoomPanel } from '../components/LockerRoomPanel';
import { getFootColorMeta } from '../components/PlayerBioStrip';
import { CustomFormationModal } from '../modals/TacticsModals';
import { SquadRenewModal, SquadSellModal, SquadReleaseModal } from '../modals/SquadActionModals';

export const SquadTacticsView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onNavigate?: (tab: MainTab, sub?: string) => void;
  onToast: (msg: string) => void;
}> = ({ state, onUpdateState, onInspectPlayer, onNavigate, onToast }) => {
  const me = state.teams[state.me];
  const isMgr = state.mode === 'm';
  const sub = (state.sub ?? 0) > 3 ? 0 : (state.sub ?? 0);
  const [luTab, setLuTab] = useState<0 | 1 | 2>(0);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [showFormationSheet, setShowFormationSheet] = useState(false);
  const [squadPosFilter, setSquadPosFilter] = useState<'ALL' | Position>('ALL');
  const [squadSort, setSquadSort] = useState<'pos' | 'ov' | 'fit' | 'age' | 'val' | 'goals'>('pos');
  const [selectedSquadNames, setSelectedSquadNames] = useState<string[]>([]);
  const [renewTargetName, setRenewTargetName] = useState<string | null>(null);
  const [sellModalNames, setSellModalNames] = useState<string[] | null>(null);
  const [releaseModalNames, setReleaseModalNames] = useState<string[] | null>(null);
  const pitchSvgRef = useRef<SVGSVGElement | null>(null);

  const starters = xi(me);
  const slots = getFormationSlots(me);
  const r = rate(me, state);
  const bench = me.sq
    .filter((q) => !starters.includes(q))
    .sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov);
  const avgFit = Math.round(starters.reduce((s, q) => s + (q.fit ?? 100), 0) / (starters.length || 1));
  const restNeededStarters = starters.filter((q) => q.inj === 0 && (q.sus || 0) === 0 && Math.round(q.fit ?? 100) < 65);
  const tiredWarningStarters = starters.filter((q) => q.inj === 0 && (q.sus || 0) === 0 && Math.round(q.fit ?? 100) >= 65 && Math.round(q.fit ?? 100) < 75);

  const getStaminaMeta = (fitRaw: number | undefined) => {
    const f = clamp(Math.round(fitRaw ?? 100), 0, 100);
    if (f < 65) {
      return {
        f,
        label: 'ควรพัก',
        shortLabel: 'ควรพัก',
        txtCls: 'text-[#dc2626] dark:text-[#f87171]',
        pillCls: 'bg-rose-500/15 text-[#dc2626] dark:text-[#fca5a5] border-rose-500/35',
        rowTint: 'bg-rose-500/[0.08] border-rose-500/45 hover:border-rose-500/75',
        needRest: true
      };
    }
    if (f < 75) {
      return {
        f,
        label: 'เริ่มล้า',
        shortLabel: 'ล้า',
        txtCls: 'text-[#b45309] dark:text-[#fbbf24]',
        pillCls: 'bg-amber-500/15 text-[#b45309] dark:text-[#fcd34d] border-amber-500/35',
        rowTint: 'bg-amber-500/[0.06] border-amber-500/35 hover:border-amber-500/70',
        needRest: false
      };
    }
    if (f < 86) {
      return {
        f,
        label: 'พร้อม',
        shortLabel: 'พร้อม',
        txtCls: 'text-[#15803d] dark:text-[#4ade80]',
        pillCls: 'bg-emerald-500/12 text-[#15803d] dark:text-[#4ade80] border-emerald-500/30',
        rowTint: '',
        needRest: false
      };
    }
    return {
      f,
      label: 'ฟิตเต็ม',
      shortLabel: 'ฟิต',
      txtCls: 'text-[var(--g)]',
      pillCls: 'bg-emerald-500/15 text-[var(--g)] border-emerald-500/35',
      rowTint: '',
      needRest: false
    };
  };

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
  const [dragUi, setDragUi] = useState<{ player: Player; fromSlot?: SubRole; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ name: string; slot?: string } | null>(null);
  const [pitchDragPreview, setPitchDragPreview] = useState<PitchDragPreview | null>(null);
  const pitchDragPreviewRef = useRef<PitchDragPreview | null>(null);
  const [touchAnchorPt, setTouchAnchorPt] = useState<{ px: number; py: number } | null>(null);

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
      py: ((effectiveY - rect.top) / h) * 340,
      rawPx: ((clientX - rect.left) / w) * 300,
      rawPy: ((clientY - rect.top) / h) * 340,
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
      const oy = 24 + oz.y * 2.9;
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
        setDragUi({ player: cur.player, fromSlot: cur.fromSlot, x: cur.x, y: cur.y });
        const hit = findDropAt(cur.x, cur.y, cur.player.n);
        setDropTarget(hit);
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
      setDragUi(null);
      setDropTarget(null);
      setPitchDragPreview(null);
      setTouchAnchorPt(null);
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
          setTouchAnchorPt({
            px: clamp(pitchPt.rawPx, 8, 292),
            py: clamp(pitchPt.rawPy, 8, 332)
          });
        } else {
          setTouchAnchorPt(null);
        }

        const { starters: curStarters, slots: curSlots } = dragActionsRef.current;
        let closestSwap: { name: string; slot?: string; dist: number } | null = null;
        curStarters.forEach((other, idx) => {
          if (idx === d.fromPitchIdx) return;
          const oz = curSlots[idx];
          if (!oz) return;
          const ox = 18 + oz.x * 2.64;
          const oy = 24 + oz.y * 2.9;
          const sDist = Math.hypot(pitchPt.px - ox, pitchPt.py - oy);
          if (sDist < 15.5 && (!closestSwap || sDist < closestSwap.dist)) {
            closestSwap = { name: other.n, slot: oz.sp, dist: sDist };
          }
        });
        if (closestSwap) {
          const swapObj = closestSwap as { name: string; slot?: string };
          pitchDragPreviewRef.current = null;
          setPitchDragPreview(null);
          setDropTarget({ name: swapObj.name, slot: swapObj.slot });
          setDragUi({ player: d.player, fromSlot: d.fromSlot, x: e.clientX, y: e.clientY - (d.isTouch ? 36 : 0) });
          return;
        }

        const nx = clamp(Math.round((pitchPt.px - 18) / 2.64), 4, 96);
        const ny = clamp(Math.round((pitchPt.py - 24) / 2.9), 8, 84);
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
        setPitchDragPreview(preview);
        setDropTarget(null);
        setDragUi(null);
        return;
      }

      pitchDragPreviewRef.current = null;
      setPitchDragPreview(null);
      setTouchAnchorPt(null);
      setDragUi({ player: d.player, fromSlot: d.fromSlot, x: e.clientX, y: e.clientY });
      const hit = findDropAt(e.clientX, e.clientY, d.player.n, d.fromPitchIdx === undefined && d.isTouch ? 34 : 0);
      setDropTarget(hit);
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
    const starterWarnCls = slotSp && !unavailable ? stMeta.rowTint : '';

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
        className={`w-full flex items-center gap-1 px-1.5 py-1 mland:py-0.5 rounded-lg border text-left select-none transition-all ${
          isTarget
            ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] ring-2 ring-[var(--lamp)]/40 scale-[1.01]'
            : isSource
              ? 'opacity-45 border-dashed border-[var(--lamp)] bg-[var(--surface-2)]'
              : isMe
                ? 'bg-[var(--lamp-soft)]/75 border-[var(--lamp)] ring-1 ring-[var(--lamp)]/45'
                : starterWarnCls || 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
        } ${dragUi ? 'cursor-grabbing' : 'cursor-pointer'}`}
      >
        <span
          data-drag-grip={isMgr ? '1' : undefined}
          onContextMenu={(e) => e.preventDefault()}
          style={
            isMgr
              ? { touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }
              : { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }
          }
          title={isMgr ? 'ลากเพื่อเปลี่ยนหรือสลับตำแหน่ง' : 'กด 1 ครั้งเพื่อดูข้อมูล'}
          className={`flex items-center gap-1 shrink-0 py-0.5 pr-0.5 rounded [&_svg]:w-4 [&_svg]:h-4 ${isMgr ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        >
          <PlayerFace player={q} team={me} state={state} size={20} />
          <span className="text-[9.5px] font-bold tabular text-[var(--mut)] min-w-[21px] text-center shrink-0 whitespace-nowrap">#{no}</span>
          <span className={`px-1 py-0.2 rounded text-[9px] font-bold text-white shrink-0 ${(slotSp ? LINE[slotSp] : q.pos) === 'DF' ? 'bg-blue-600' : (slotSp ? LINE[slotSp] : q.pos) === 'MF' ? 'bg-amber-600' : (slotSp ? LINE[slotSp] : q.pos) === 'GK' ? 'bg-purple-600' : 'bg-[var(--g)]'}`}>
            {slotSp || q.ro}
          </span>
        </span>
        <span className="flex-1 min-w-0 text-[10.5px] mland:text-[9.5px] leading-tight font-semibold truncate">
          {isMe && (
            <span
              title="ตัวคุณ"
              aria-label="ตัวคุณ"
              className="inline-flex items-center justify-center w-3.5 h-3.5 mr-1 rounded-full bg-[var(--lamp)] text-[#261900] text-[8.5px] font-black align-middle"
            >
              ★
            </span>
          )}
          {me.cap === q.n && <span className="inline-block px-1 mr-0.5 rounded bg-[var(--lamp)] text-[#261900] text-[8.5px] font-bold">C</span>}
          {(q.hg || q.customCreated) ? <span title="เด็กปั้นสโมสร" className="mr-0.5">🌱</span> : null}
          {q.n}
          {slotSp && slotSp !== q.ro && (
            <span className="ml-1 text-[8.5px] text-[var(--mut)]">({q.ro}{pn === 2 ? ' ⚠️' : ''})</span>
          )}
        </span>
        {/* Clear Red-to-Green Stamina Gauge & Rotation Status */}
        <div
          className="flex flex-col items-stretch justify-center gap-0.5 shrink-0 w-[64px] sm:w-[74px] mland:w-[56px]"
          title={`ความฟิต ${f}% (${stMeta.label})`}
        >
          {(q.sus || 0) > 0 ? (
            <span className="inline-flex items-center justify-end gap-0.5 text-[9.5px] mland:text-[8px] font-bold text-[var(--red)] tabular">
              <StatIconBadge kind="red" count={q.sus} size="xs" />
              {(q.sus || 0) <= 1 && <span>แบน</span>}
            </span>
          ) : q.inj > 0 ? (
            <span className="text-[9.5px] mland:text-[8px] font-bold text-[var(--red)] tabular text-right">🩹พัก {q.inj}น</span>
          ) : (
            <>
              <div className="flex items-center justify-between gap-0.5 leading-none tabular">
                <span className={`text-[8.5px] mland:text-[7.5px] font-extrabold truncate ${stMeta.txtCls}`}>
                  {stMeta.shortLabel}
                </span>
                <span className={`text-[9.5px] mland:text-[8px] font-extrabold ${stMeta.txtCls}`}>
                  {f}%
                </span>
              </div>
              <div className="w-full h-1.5 mland:h-1 rounded-full bg-gradient-to-r from-rose-500/20 via-amber-400/20 to-emerald-500/20 border border-[var(--line)]/55 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${clamp(f, 6, 100)}%`,
                    background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 52%, #10b981 100%)',
                    backgroundSize: `${10000 / Math.max(f, 8)}% 100%`
                  }}
                />
              </div>
            </>
          )}
        </div>
        <span className="px-1.5 py-0.2 rounded-md text-white text-[10px] mland:text-[9px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
          {q.ov}
        </span>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {dragUi && (
        <div
          className="fixed z-[100] pointer-events-none flex items-center gap-2 px-3 py-2 rounded-2xl bg-[var(--surface)] border-2 border-[var(--lamp)] shadow-2xl max-w-[210px]"
          style={{
            left: typeof window !== 'undefined' ? clamp(dragUi.x - 95, 8, window.innerWidth - 216) : dragUi.x - 95,
            top: typeof window !== 'undefined' ? clamp(dragUi.y - 76, 8, window.innerHeight - 68) : dragUi.y - 76
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

      <div className="flex items-center justify-between gap-1.5 flex-nowrap overflow-x-auto shrink-0">
        <div className="seg-bar shrink-0">
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 0; })} className={`seg-btn ${sub === 0 ? 'seg-btn-active' : ''}`}>
            ⚽ ตัวจริง
          </button>
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 1; })} className={`seg-btn ${sub === 1 ? 'seg-btn-active' : ''}`}>
            🧭 แผนเกม
          </button>
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 2; })} className={`seg-btn ${sub === 2 ? 'seg-btn-active' : ''}`}>
            📋 ทั้งทีม ({me.sq.length})
          </button>
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 3; })} className={`seg-btn ${sub === 3 ? 'seg-btn-active' : ''}`}>
            👕 ล็อกเกอร์
          </button>
        </div>

        <div className="inline-flex items-center gap-1 text-[11px] mland:text-[9.5px] font-semibold tabular whitespace-nowrap shrink-0 px-2 py-1 mland:py-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
          <span className="font-bold text-[var(--ink)]">แผน {formName(me, pitchDragPreview)}</span>
          <span className="opacity-35">·</span>
          <span>{AR_T[me.tac]}</span>
          <span className="opacity-35">·</span>
          <span>⚔️{Math.round(r.at)}</span>
          <span>🛡️{Math.round(r.df)}</span>
          <span className="opacity-35">·</span>
          <span className={`font-bold ${avgFit >= 76 ? 'text-[var(--g)]' : avgFit >= 65 ? 'text-[#b45309] dark:text-[#fbbf24]' : 'text-[var(--red)]'}`}>
            ⚡{avgFit}%
          </span>
          {restNeededStarters.length > 0 && (
            <>
              <span className="opacity-35">·</span>
              <span className="text-[var(--red)] font-bold" title="จำนวนตัวจริงที่ความฟิตต่ำกว่า 65% แนะนำให้พักนัดถัดไป">
                🔴ควรพัก {restNeededStarters.length}
              </span>
            </>
          )}
          {offPosCount > 0 && (
            <>
              <span className="opacity-35">·</span>
              <span className="text-[var(--red)] font-bold" title="จำนวนนักเตะที่ลงเล่นนอกตำแหน่งถนัด">⚠️นอก {offPosCount}</span>
            </>
          )}
        </div>
      </div>

      {sub === 0 ? (
        isMgr ? (
          <div className="grid grid-cols-[1.18fr_0.82fr] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
            {/* CENTER STAGE: Full-Size Pitch Only + Collapsed 🧭 เปลี่ยนแผน Bar at Bottom */}
            <div className="relative p-2 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col justify-between gap-1.5 mland:gap-1 h-full min-h-0 overflow-hidden">
              {pitchDragPreview && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-2.5 py-0.5 rounded-lg bg-[var(--surface)]/95 border border-[var(--g)]/60 text-[var(--g)] text-[10.5px] mland:text-[9px] font-bold whitespace-nowrap shadow-md">
                  📍 {pitchDragPreview.player.n.split(' ')[0]} → {pitchDragPreview.sp} ({pitchDragPreview.zoneLabel}) · {formName(me, pitchDragPreview)}
                </div>
              )}

              <div className="w-full mx-auto flex-1 min-h-0 h-full flex items-center justify-center">
                <FormationPitch
                  team={me}
                  state={state}
                  svgRef={pitchSvgRef}
                  showPositionZones={Boolean(pitchDragPreview)}
                  subAlertFitTh={65}
                  dragSourceName={dragUi?.player.n || null}
                  dropTargetName={dropTarget?.name || null}
                  dragPreview={pitchDragPreview}
                  touchPointerPitchPt={touchAnchorPt}
                  onPlayerPointerDown={handlePlayerPointerDown}
                />
              </div>

              {showFormationSheet && (
                <div className="absolute inset-x-2 bottom-11 mland:inset-x-1.5 mland:bottom-8 z-20 p-2.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)]/98 backdrop-blur-md border border-[var(--g)]/50 shadow-2xl space-y-2 mland:space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs mland:text-[10px]">
                    <span className="font-bold text-[var(--ink)]">🧭 เปลี่ยนแผน & สไตล์การเล่น</span>
                    <button
                      type="button"
                      onClick={() => setShowFormationSheet(false)}
                      className="btn btn-xs btn-secondary"
                    >
                      ✕ ปิด
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
                        className={`btn btn-xs truncate ${
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
                        onClick={() => onUpdateState((d) => { d.teams[d.me].tac = k; })}
                        className={`btn btn-xs truncate ${
                          me.tac === k ? 'btn-gold' : 'btn-secondary text-[var(--mut)]'
                        }`}
                      >
                        {AR_T[k]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsed Slim Trigger Bar at Bottom */}
              <div className="pt-1 mland:pt-0.5 border-t border-[var(--line)]/60 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setShowFormationSheet((v) => !v);
                  }}
                  className="btn btn-sm btn-secondary w-full justify-between"
                >
                  <span className="truncate">
                    🧭 เปลี่ยนแผน · <span className="text-[var(--g)]">{formName(me, pitchDragPreview)}</span> · <span className="text-[var(--mut)]">{AR_T[me.tac]}</span>
                  </span>
                  <span className="text-[10.5px] mland:text-[9px] text-[var(--g)] shrink-0">
                    {showFormationSheet ? 'ซ่อน ▾' : 'เลือกแผน ▲'}
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT: Squad & Bench List */}
            <div className="p-2 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 h-full overflow-hidden">
              <div className="flex items-center justify-between gap-1 mb-1.5 mland:mb-1 shrink-0">
                <div className="seg-bar min-w-0">
                  {([['ทั้งหมด', 0], ['ตัวจริง 11', 1], [`สำรอง ${bench.length}`, 2]] as const).map(([l, k]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setLuTab(k)}
                      className={`seg-btn ${luTab === k ? 'seg-btn-active' : ''}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(restNeededStarters.length > 0 || tiredWarningStarters.length > 0) && (
                    <button
                      type="button"
                      onClick={restTiredStarters}
                      title="สลับตัวจริงที่อ่อนล้าไปพักที่ม้านั่งสำรองและส่งตัวฟิตลงแทน"
                      className={`btn btn-xs ${
                        restNeededStarters.length > 0
                          ? 'btn-danger'
                          : 'bg-amber-500/15 border border-amber-500/45 text-[#b45309] dark:text-[#fcd34d] hover:bg-amber-500 hover:text-white'
                      }`}
                    >
                      🛌 พักตัวล้า ({restNeededStarters.length > 0 ? restNeededStarters.length : tiredWarningStarters.length})
                    </button>
                  )}
                  <button
                    type="button"
                    title={me.lu ? 'รีเซ็ตเป็นจัด 11 ตัวจริงอัตโนมัติ' : 'กำลังใช้ระบบจัดตัวจริงอัตโนมัติ'}
                    onClick={() => {
                      SFX.tap();
                      onUpdateState((d) => { d.teams[d.me].lu = null; });
                      onToast('จัด 11 ตัวจริงอัตโนมัติแล้ว');
                    }}
                    className={`btn btn-xs shrink-0 ${
                      !me.lu
                        ? 'bg-[var(--g-soft)] border border-[var(--g)]/40 text-[var(--g)]'
                        : 'btn-secondary hover:bg-[var(--g)] hover:text-white hover:border-[var(--g)]'
                    }`}
                  >
                    {me.lu ? '⚡ จัดอัตโนมัติ' : '✓ อัตโนมัติ'}
                  </button>
                </div>
              </div>
              {/* Compact Stamina Spectrum Legend */}
              <div className="flex items-center justify-between gap-2 px-1.5 py-0.5 mb-1 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)]/60 text-[9.5px] mland:text-[7.5px] shrink-0">
                <span className="font-semibold text-[var(--mut)] shrink-0">ความฟิต:</span>
                <div className="flex items-center gap-2 mland:gap-1.5 tabular truncate">
                  <span className="inline-flex items-center gap-1 text-[#dc2626] dark:text-[#f87171] font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#ef4444]" /> &lt;65% ควรพัก
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#b45309] dark:text-[#fbbf24] font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> 65-74% เริ่มล้า
                  </span>
                  <span className="inline-flex items-center gap-1 text-[var(--g)] font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#10b981]" /> ≥75% พร้อม
                  </span>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mland:space-y-0.5 pr-0.5">
                {luTab !== 2 && (
                  <>
                    {luTab === 0 && (
                      <div className="flex items-center justify-between px-0.5 text-[10.5px] mland:text-[8.5px] font-bold text-[var(--g)] pt-0.5">
                        <span>ตัวจริง (11 คน)</span>
                      </div>
                    )}
                    {starters.map((q, i) => renderPlayerRow(q, slots[i]?.sp))}
                  </>
                )}
                {luTab !== 1 && (
                  <>
                    {luTab === 0 && (
                      <div className="flex items-center justify-between px-0.5 text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)] pt-1.5 mland:pt-1">
                        <span>ตัวสำรอง ({bench.length} คน)</span>
                      </div>
                    )}
                    {bench.map((q) => renderPlayerRow(q))}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1.18fr_0.82fr] flex-1 min-h-0 gap-2.5 mland:gap-2 items-stretch overflow-hidden">
            <div className="p-2 mland:p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col justify-between gap-1.5 mland:gap-1 h-full min-h-0 overflow-hidden">
              <div className="w-full mx-auto flex-1 min-h-0 h-full flex items-center justify-center">
                <FormationPitch
                  team={me}
                  state={state}
                  showPositionZones={false}
                  subAlertFitTh={65}
                  onPlayerPointerDown={handlePlayerPointerDown}
                />
              </div>

              {(() => {
                const myIdx = starters.findIndex((q) => q.me || q.n === state.p?.name);
                const mySlot = myIdx >= 0 ? slots[myIdx]?.sp : null;
                const mySq = me.sq.find((q) => q.me || q.n === state.p?.name);
                const isBanned = (mySq?.sus || state.p?.sus || 0) > 0;
                return (
                  <div className="pt-1.5 mland:pt-1 border-t border-[var(--line)] text-center space-y-0.5 shrink-0">
                    <div className="text-[11px] mland:text-[10px]">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold ${isBanned ? 'bg-[var(--red-soft)] text-[var(--red)]' : mySlot ? 'bg-[var(--lamp-soft)] text-[#9a6700] dark:text-[var(--lamp)]' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                        {isBanned ? `🟥 ติดโทษแบน (เหลือ ${mySq?.sus || state.p?.sus} นัด)` : mySlot ? `★ ตัวจริง (${mySlot})` : '🪑 ตัวสำรอง (มีโอกาสลงสำรองครึ่งหลัง)'}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-2 mland:p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 h-full overflow-hidden">
              <div className="font-bold text-xs mland:text-[10.5px] mb-1.5 mland:mb-1 shrink-0">👥 รายชื่อทีม</div>
              <div className="seg-bar grid grid-cols-3 w-full mb-1.5 mland:mb-1 shrink-0">
                {([['ทั้งหมด', 0], ['ตัวจริง (11)', 1], [`สำรอง (${bench.length})`, 2]] as const).map(([l, k]) => (
                  <button key={k} type="button" onClick={() => setLuTab(k)} className={`seg-btn truncate ${luTab === k ? 'seg-btn-active' : ''}`}>{l}</button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mland:space-y-0.5 pr-0.5">
                {luTab !== 2 && (<><div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--g)] pt-0.5">ตัวจริง (11 คน)</div>{starters.map((q, i) => renderPlayerRow(q, slots[i]?.sp))}</>)}
                {luTab !== 1 && (<><div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] pt-1.5 mland:pt-1">ตัวสำรอง ({bench.length} คน)</div>{bench.map((q) => renderPlayerRow(q))}</>)}
              </div>
            </div>
          </div>
        )
      ) : sub === 1 ? (
        <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mland:pb-1.5 border-b border-[var(--line)] shrink-0">
            <div>
              <h3 className="font-bold text-sm mland:text-xs">🧭 แผนเกม & ยุทธวิธี · {formName(me)}</h3>
              <p className="text-[11px] mland:text-[10px] text-[var(--mut)]">ความเข้าใจแผน: <b className="text-[var(--g)]">{me.tacFam ?? 65}%</b> · ยิ่งใช้แผนเดิมนาน ยิ่งได้โบนัสพลังทีม</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] mland:text-[10px]">
              <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] font-semibold">สไตล์: {AR_T[me.tac]}</span>
              <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] font-semibold">เพรส: {['ต่ำ', 'กลาง', 'สูง'][me.press ?? 1]}</span>
              <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] font-semibold">จังหวะ: {['ช้า', 'กลาง', 'เร็ว'][me.tempo ?? 1]}</span>
            </div>
          </div>

          {isMgr ? (
            <div className="grid grid-cols-2 gap-3 mland:gap-2.5 flex-1 min-h-0 overflow-hidden">
              <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-1">
                <div className="grid grid-cols-[130px_1fr] mland:grid-cols-[115px_1fr] gap-2.5 mland:gap-2 items-center">
                  <TacticsMiniPitch team={me} state={state} />
                  <div>
                    <div className="text-xs font-bold mb-1.5">เลือกระบบการเล่น</div>
                    <div className="flex flex-wrap gap-1.5">
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
                          className={`btn btn-sm ${me.form === f ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          {f}
                        </button>
                      ))}
                      <button type="button" onClick={() => setShowCustomEditor(true)} className={`btn btn-sm ${me.form === 'custom' ? 'btn-primary' : 'btn-secondary'}`}>
                        ✏️ ปรับแผนเอง
                      </button>
                    </div>
                    <p className="text-xs text-[var(--mut)] mt-2">{coachAdvice()}</p>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold mb-1.5">⚡ ชุดยุทธวิธีสำเร็จรูป</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {PRE.map(([lbl, cfg]) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => { Object.assign(d.teams[d.me], cfg); d.teams[d.me].lu = null; });
                          onToast(`ใช้ยุทธวิธี "${lbl}"`);
                        }}
                        className="btn btn-sm btn-secondary hover:bg-[var(--g)] hover:text-white hover:border-[var(--g)]"
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs font-bold mb-1.5">💾 บันทึก / โหลดแผนด่วน</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1].map((idx) => (
                      <React.Fragment key={idx}>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateState((d) => {
                              const t = d.teams[d.me];
                              d.slots = d.slots || [null, null];
                              d.slots[idx] = { form: t.form, cf: t.cf, tac: t.tac, press: t.press, tempo: t.tempo, wid: t.wid, line: t.line, pass: t.pass };
                            });
                            onToast(`บันทึกแผน ${idx + 1} แล้ว`);
                          }}
                          className="btn btn-sm btn-secondary"
                        >
                          บันทึก {idx + 1}
                        </button>
                        <button
                          type="button"
                          disabled={!state.slots?.[idx]}
                          onClick={() => {
                            onUpdateState((d) => {
                              const s = d.slots?.[idx];
                              if (s) { Object.assign(d.teams[d.me], s); d.teams[d.me].lu = null; }
                            });
                            onToast(`โหลดแผน ${idx + 1} แล้ว`);
                          }}
                          className="btn btn-sm btn-surface"
                        >
                          โหลด {idx + 1}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 mland:space-y-2 h-full overflow-y-auto pr-1">
                <div>
                  <div className="text-xs font-bold mb-1">สไตล์การเล่น (Mentality)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['X', 'A', 'B', 'D', 'Z'] as Mentality[]).map((k) => (
                      <button key={k} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].tac = k; })} className={`btn btn-sm ${me.tac === k ? 'btn-primary' : 'btn-secondary'}`}>
                        {AR_T[k]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-bold mb-1">เพรสซิ่ง</div>
                    <div className="seg-bar grid grid-cols-3 w-full">
                      {['ต่ำ', 'กลาง', 'สูง'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].press = k; })} className={`seg-btn ${(me.press ?? 1) === k ? 'seg-btn-active' : ''}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold mb-1">จังหวะเกม</div>
                    <div className="seg-bar grid grid-cols-3 w-full">
                      {['ช้า', 'กลาง', 'เร็ว'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].tempo = k; })} className={`seg-btn ${(me.tempo ?? 1) === k ? 'seg-btn-active' : ''}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-bold mb-1">ความกว้าง</div>
                    <div className="seg-bar grid grid-cols-3 w-full">
                      {['แคบ', 'กลาง', 'กว้าง'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].wid = k; })} className={`seg-btn ${(me.wid ?? 1) === k ? 'seg-btn-active' : ''}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold mb-1">แนวรับ</div>
                    <div className="seg-bar grid grid-cols-3 w-full">
                      {['ลึก', 'กลาง', 'สูง'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].line = k; })} className={`seg-btn ${(me.line ?? 1) === k ? 'seg-btn-active' : ''}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold mb-1">สไตล์การจ่ายบอล</div>
                  <div className="flex flex-wrap gap-1.5">
                    {['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'].map((l, k) => (
                      <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].pass = k; })} className={`btn btn-sm ${(me.pass ?? 1) === k ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>
                    ))}
                  </div>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-xs font-bold">👑 กัปตันทีม</label>
                    <span className="text-[10.5px] text-[var(--mut)]">ช่วยประคองขวัญทีมในเกมสำคัญ</span>
                  </div>
                  <select
                    value={me.cap || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateState((d) => { d.teams[d.me].cap = val; });
                      onToast('อัปเดตกัปตันทีมแล้ว');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                  >
                    <option value="">ไม่ระบุ</option>
                    {me.sq.slice().sort((a, b) => b.ov - a.ov).slice(0, 10).map((q) => (
                      <option key={q.n} value={q.n}>{q.n} (OVR {q.ov})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-[var(--line)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold">🤖 กฎปรับแผนอัตโนมัติในแมตช์</span>
                    {(state.rules || []).length < 3 && (
                      <button
                        type="button"
                        onClick={() => onUpdateState((d) => {
                          d.rules = [...(d.rules || []), { c: 'tr', min: 65, tac: 'A' }];
                        })}
                        className="btn btn-xs btn-secondary"
                      >
                        ＋ เพิ่มกฎ
                      </button>
                    )}
                  </div>
                  {(state.rules || []).length === 0 ? (
                    <p className="text-[11px] text-[var(--mut)]">ยังไม่มีกฎอัตโนมัติ (เช่น ถ้าตามอยู่ หลังนาที 65 ให้เปลี่ยนเป็นบุกหนัก)</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(state.rules || []).map((rl, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-[var(--surface-2)] text-xs">
                          <select
                            value={rl.c}
                            onChange={(e) => onUpdateState((d) => { if (d.rules?.[idx]) d.rules[idx].c = e.target.value as AutoRule['c']; })}
                            className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                          >
                            {Object.entries(AR_C).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                          <span>หลังนาที</span>
                          <select
                            value={rl.min}
                            onChange={(e) => onUpdateState((d) => { if (d.rules?.[idx]) d.rules[idx].min = Number(e.target.value); })}
                            className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                          >
                            {[45, 60, 70, 75, 80].map((m) => <option key={m} value={m}>{m}&apos;</option>)}
                          </select>
                          <span>→</span>
                          <select
                            value={rl.tac}
                            onChange={(e) => onUpdateState((d) => { if (d.rules?.[idx]) d.rules[idx].tac = e.target.value as Mentality; })}
                            className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                          >
                            {Object.entries(AR_T).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => onUpdateState((d) => { d.rules = (d.rules || []).filter((_, j) => j !== idx); })}
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
            <div className="grid grid-cols-[150px_1fr] gap-4 items-center">
              <TacticsMiniPitch team={me} state={state} />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[11px] text-[var(--mut)]">ระบบการเล่น</div>
                  <div className="font-bold mt-0.5">{formName(me)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[11px] text-[var(--mut)]">สไตล์ & การจ่าย</div>
                  <div className="font-bold mt-0.5">{AR_T[me.tac]} · {['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'][me.pass ?? 1]}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[11px] text-[var(--mut)]">แนวรับ & ความกว้าง</div>
                  <div className="font-bold mt-0.5">{['ลึก', 'กลาง', 'สูง'][me.line ?? 1]} · {['แคบ', 'กลาง', 'กว้าง'][me.wid ?? 1]}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[11px] text-[var(--mut)]">กัปตันทีม</div>
                  <div className="font-bold mt-0.5 truncate">{me.cap || '-'}</div>
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
                {isMgr && (() => {
                  const incomingOffers = getIncomingOffers(state);
                  if (!incomingOffers.length) return null;
                  return (
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
                  );
                })()}

                {/* Responsive 100%-Width Squad Roster Table (Zero Horizontal Overflow) */}
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
                  <div
                    className={
                      isMgr
                        ? 'grid grid-cols-[24px_26px_minmax(0,1.5fr)_38px_46px_108px] sm:grid-cols-[26px_30px_minmax(0,1.6fr)_44px_32px_54px_56px_78px_132px] lg:grid-cols-[28px_32px_minmax(0,1.65fr)_48px_36px_60px_64px_62px_86px_146px] mland:grid-cols-[24px_26px_minmax(0,1.5fr)_40px_28px_48px_50px_70px_116px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2 sm:px-2.5 mland:px-2 py-1.5 mland:py-1 text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 border-b border-[var(--line)]'
                        : 'grid grid-cols-[34px_minmax(0,1.7fr)_52px_36px_68px_72px_72px_94px] mland:grid-cols-[28px_minmax(0,1.7fr)_44px_30px_58px_62px_60px_80px] items-center gap-1.5 mland:gap-1 px-2.5 mland:px-2 py-1.5 mland:py-1 text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 border-b border-[var(--line)]'
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
                    <div className="text-center">#</div>
                    <div>นักเตะ</div>
                    <div>ตำแหน่ง</div>
                    <div className={`text-center ${isMgr ? 'hidden sm:block mland:block' : ''}`}>อายุ</div>
                    <div className="text-center">OVR</div>
                    <div className={`text-center ${isMgr ? 'hidden sm:block mland:block' : ''}`}>ฟิต</div>
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
                      const offerCount = isMgr ? getIncomingOffers(state).filter((o) => o.n === q.n).length : 0;
                      const con = ensureCon(q);
                      const wg = con.wg;
                      const fitTxtCls = stMeta.txtCls;
                      const isSelected = selectedSet.has(q.n);
                      const expiringSoon = !q.loan && con.yr <= 1;
                      const bio = getPlayerBio(q);
                      const footMeta = getFootColorMeta(bio.foot);

                      return (
                        <div
                          key={q.n}
                          className={`px-2 sm:px-2.5 mland:px-2 py-1.5 mland:py-1 items-center gap-1 sm:gap-1.5 mland:gap-1 transition-colors hover:bg-[var(--surface-2)]/45 ${
                            isMgr
                              ? 'grid grid-cols-[24px_26px_minmax(0,1.5fr)_38px_46px_108px] sm:grid-cols-[26px_30px_minmax(0,1.6fr)_44px_32px_54px_56px_78px_132px] lg:grid-cols-[28px_32px_minmax(0,1.65fr)_48px_36px_60px_64px_62px_86px_146px] mland:grid-cols-[24px_26px_minmax(0,1.5fr)_40px_28px_48px_50px_70px_116px]'
                              : 'grid grid-cols-[34px_minmax(0,1.7fr)_52px_36px_68px_72px_72px_94px] mland:grid-cols-[28px_minmax(0,1.7fr)_44px_30px_58px_62px_60px_80px]'
                          } ${
                            isSelected
                              ? 'bg-[var(--g-soft)]/55'
                              : isMe
                                ? 'bg-[var(--lamp-soft)]/50'
                                : q.listed
                                  ? 'bg-[var(--lamp-soft)]/20'
                                  : ''
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

                          <div className="flex items-center justify-center text-xs mland:text-[10px] font-bold text-[var(--mut)] tabular">
                            #{no}
                          </div>

                          <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                            <PlayerFace player={q} team={me} state={state} size={26} />
                            <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                              <div className="font-bold text-xs mland:text-[10px] truncate flex items-center gap-1">
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
                                {me.cap === q.n && <span className="text-[#9a6700] dark:text-[var(--lamp)] shrink-0">[C]</span>}
                                <span className="truncate">{q.n}</span>
                                {(q.hg || q.customCreated) ? (
                                  <span className="px-1 rounded bg-[var(--g-soft)] border border-[var(--g)]/35 text-[var(--g)] text-[9.5px] mland:text-[8px] font-bold shrink-0" title="เด็กปั้นสโมสร">
                                    🌱 เด็กปั้น
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
                              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1 tabular">
                                {(q.sus || 0) > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[var(--red)] font-bold">
                                    <StatIconBadge kind="red" count={q.sus} size="xs" />
                                    <span>แบน {q.sus} นัด</span>
                                  </span>
                                ) : q.inj > 0 ? (
                                  <span>🩹 เจ็บ {q.inj} นัด</span>
                                ) : (q.yc || 0) > 0 ? (
                                  <span className="inline-flex items-center gap-1">
                                    <StatIconBadge kind="yellow" count={q.yc || 1} size="xs" />
                                    <span>เหลือง {q.yc}/3</span>
                                  </span>
                                ) : isStarter ? (
                                  'ตัวจริง'
                                ) : (
                                  'สำรอง'
                                )}
                                {!q.loan && (
                                  <span className={expiringSoon ? 'text-[var(--red)] font-bold' : ''}>
                                    · {con.yr <= 0 ? 'หมดสัญญา!' : `สัญญา ${con.yr} ปี`}
                                  </span>
                                )}
                                <span
                                  className={`hidden sm:inline-flex mland:inline-flex items-center gap-1 px-1 rounded border text-[9.5px] mland:text-[8px] font-bold leading-tight shrink-0 ${footMeta.badgeCls}`}
                                  title={`สูง ${bio.heightCm} ซม. · หนัก ${bio.weightKg} กก. · ${footMeta.titleText}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: footMeta.dotColor }} />
                                  <span>{bio.heightCm}/{bio.weightKg} · {footMeta.shortLabel}</span>
                                </span>
                                {f < 75 && q.inj === 0 && (q.sus || 0) === 0 && (
                                  <span className={`sm:hidden mland:hidden px-1 rounded text-[9px] font-bold ${stMeta.pillCls}`}>
                                    {stMeta.label} {f}%
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>

                          <div className="flex items-center">
                            <span className="px-1.5 mland:px-1 py-0.5 rounded-md bg-[var(--surface-2)] font-bold text-[10.5px] mland:text-[9px]">{q.ro}</span>
                          </div>

                          <div className={`text-center text-xs mland:text-[10px] tabular font-semibold ${isMgr ? 'hidden sm:block mland:block' : ''}`}>
                            {q.age}
                          </div>

                          <div className="flex items-center justify-center gap-0.5">
                            <span className="px-1.5 mland:px-1 py-0.5 rounded-lg text-white text-[11px] mland:text-[9.5px] font-bold tabular" style={{ background: ovColor(q.ov) }}>
                              {q.ov}
                            </span>
                            <span className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular hidden sm:inline mland:inline">/{q.pot || q.ov}</span>
                          </div>

                          <div className={`flex-col justify-center gap-0.5 ${isMgr ? 'hidden sm:flex mland:flex' : 'flex'}`} title={`ความฟิต ${f}% (${stMeta.label})`}>
                            <div className="flex items-center justify-between gap-1 text-[9.5px] mland:text-[8px] leading-none tabular">
                              <span className={`font-bold truncate ${fitTxtCls}`}>{stMeta.shortLabel}</span>
                              <span className={`font-extrabold ${fitTxtCls}`}>{f}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-gradient-to-r from-rose-500/20 via-amber-400/20 to-emerald-500/20 border border-[var(--line)]/50 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${clamp(f, 6, 100)}%`,
                                  background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 52%, #10b981 100%)',
                                  backgroundSize: `${10000 / Math.max(f, 8)}% 100%`
                                }}
                              />
                            </div>
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
                                      <StatIconBadge kind="save" count={1} size="xs" />
                                      <span>{q.cs}</span>
                                    </span>
                                  ) : null
                                ) : q.sa ? (
                                  <span className="inline-flex items-center gap-0.5 font-bold text-[var(--ink)]" title={`แอสซิสต์ ${q.sa} ครั้ง`}>
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
};

