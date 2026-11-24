import React, { useEffect, useRef, useState } from 'react';
import type { MainTab, Position, SubRole, Mentality, Player, CustomSlot, Team, AutoRule, GameState, PitchDragPreview } from '../types/game';
import { clamp, fmtMoneyNum } from '../utils/math';
import { POS, FSD, LINE, AR_C, AR_T, PRE } from '../data/thaiFootballData';
import { SFX, vibrate } from '../utils/audioTheme';
import { getShirtNo, getFormationSlots, getFormationCounts, pen, xi, vlu, ensureCon, tc } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import { rate, getLeagueTransferContext, getIncomingOffers } from '../engine/simulation';
import { PlayerFace, TacticsMiniPitch, getPitchZoneAt, FormationPitch } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { CustomFormationModal } from '../modals/TacticsModals';

export const SquadTacticsView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onNavigate?: (tab: MainTab, sub?: string) => void;
  onToast: (msg: string) => void;
}> = ({ state, onUpdateState, onInspectPlayer, onNavigate, onToast }) => {
  const me = state.teams[state.me];
  const isMgr = state.mode === 'm';
  const sub = (state.sub ?? 0) > 2 ? 0 : (state.sub ?? 0);
  const [luTab, setLuTab] = useState<0 | 1 | 2>(0);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [showFormationSheet, setShowFormationSheet] = useState(false);
  const [squadPosFilter, setSquadPosFilter] = useState<'ALL' | Position>('ALL');
  const [squadSort, setSquadSort] = useState<'pos' | 'ov' | 'fit' | 'age' | 'val' | 'goals'>('pos');
  const pitchSvgRef = useRef<SVGSVGElement | null>(null);

  const starters = xi(me);
  const slots = getFormationSlots(me);
  const r = rate(me, state);
  const bench = me.sq
    .filter((q) => !starters.includes(q))
    .sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov);
  const avgFit = Math.round(starters.reduce((s, q) => s + (q.fit ?? 100), 0) / (starters.length || 1));

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
  const offPosCount = starters.filter((q, i) => pen(q.ro, liveSlots[i]?.sp || '') > 0).length;

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
    const f = Math.round(q.fit ?? 100);
    const fCol = q.inj > 0 || (q.sus || 0) > 0 ? 'var(--red)' : f >= 85 ? 'var(--g)' : f >= 65 ? '#c98a00' : 'var(--red)';
    const isSource = dragUi?.player.n === q.n;
    const isTarget = dropTarget?.name === q.n && dragUi?.player.n !== q.n;
    const isMe = !!q.me || (!isMgr && state.p?.name === q.n);
    const pn = slotSp ? pen(q.ro, slotSp) : 0;
    const no = getShirtNo(me, q);

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
                : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
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
          {q.n}
          {slotSp && slotSp !== q.ro && (
            <span className="ml-1 text-[8.5px] text-[var(--mut)]">({q.ro}{pn === 2 ? ' ⚠️' : ''})</span>
          )}
        </span>
        {/* Energy Bar + % (Always Visible on All Screens) */}
        <div className="flex flex-col items-end justify-center gap-0.5 shrink-0 w-10 sm:w-12 mland:w-9" title={`พลังงาน ${f}%`}>
          {(q.sus || 0) > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] mland:text-[8px] font-bold text-[var(--red)] tabular">
              <StatIconBadge kind="red" count={q.sus} size="xs" />
              {(q.sus || 0) <= 1 && <span>แบน</span>}
            </span>
          ) : q.inj > 0 ? (
            <span className="text-[9.5px] mland:text-[8px] font-bold text-[var(--red)] tabular">🩹{q.inj}น</span>
          ) : (
            <>
              <span className="text-[9.5px] mland:text-[8px] font-extrabold tabular leading-none" style={{ color: fCol }}>
                ⚡{f}%
              </span>
              <div className="w-full h-1.5 mland:h-1 rounded-full bg-[var(--surface)] border border-[var(--line)]/50 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${clamp(f, 4, 100)}%`, background: fCol }} />
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
        <div className="flex items-center p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 0; })} className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg text-[11px] mland:text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${sub === 0 ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
            ⚽ ตัวจริง
          </button>
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 1; })} className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg text-[11px] mland:text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${sub === 1 ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
            🧭 แผนเกม
          </button>
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 2; })} className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg text-[11px] mland:text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${sub === 2 ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
            📋 ทั้งทีม ({me.sq.length})
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
          <span>❤️{avgFit}%</span>
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
                      className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-[10.5px] mland:text-[9px] font-bold cursor-pointer"
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
                        className={`px-1 py-1.5 mland:py-1 rounded-lg text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer truncate transition-colors ${
                          me.form === f
                            ? 'bg-[var(--g)] text-white shadow-xs'
                            : 'bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--g)]'
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
                        className={`px-1 py-1.5 mland:py-1 rounded-lg text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer truncate transition-colors ${
                          me.tac === k ? 'bg-[var(--lamp)] text-[#261900] shadow-xs' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'
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
                  className="w-full flex items-center justify-between gap-2 px-2.5 mland:px-2 py-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] hover:border-[var(--g)] border border-[var(--line)] text-xs mland:text-[10px] font-bold cursor-pointer transition-colors"
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
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] min-w-0">
                  {([['ทั้งหมด', 0], ['ตัวจริง 11', 1], [`สำรอง ${bench.length}`, 2]] as const).map(([l, k]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setLuTab(k)}
                      className={`px-2 mland:px-1.5 py-0.5 rounded-md text-[10px] mland:text-[8.5px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
                        luTab === k ? 'bg-[var(--g)] text-white shadow-2xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  title={me.lu ? 'รีเซ็ตเป็นจัด 11 ตัวจริงอัตโนมัติ' : 'กำลังใช้ระบบจัดตัวจริงอัตโนมัติ'}
                  onClick={() => {
                    SFX.tap();
                    onUpdateState((d) => { d.teams[d.me].lu = null; });
                    onToast('จัด 11 ตัวจริงอัตโนมัติแล้ว');
                  }}
                  className={`px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-lg text-[10px] mland:text-[8.5px] font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 border ${
                    !me.lu
                      ? 'bg-[var(--g-soft)] border-[var(--g)]/35 text-[var(--g)]'
                      : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--g)] hover:text-white hover:border-[var(--g)]'
                  }`}
                >
                  {me.lu ? '⚡ จัดอัตโนมัติ' : '✓ อัตโนมัติ'}
                </button>
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
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-[var(--surface-2)] mb-1.5 mland:mb-1 shrink-0">
                {([['ทั้งหมด', 0], ['ตัวจริง (11)', 1], [`สำรอง (${bench.length})`, 2]] as const).map(([l, k]) => (
                  <button key={k} type="button" onClick={() => setLuTab(k)} className={`py-0.5 rounded-lg text-[11px] mland:text-[9.5px] font-semibold cursor-pointer truncate ${luTab === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}>{l}</button>
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${me.form === f ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--ink)]'}`}
                        >
                          {f}
                        </button>
                      ))}
                      <button type="button" onClick={() => setShowCustomEditor(true)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${me.form === 'custom' ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--ink)]'}`}>
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
                        className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--g)] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
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
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-xs font-semibold cursor-pointer"
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
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-xs font-semibold disabled:opacity-40 cursor-pointer"
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
                      <button key={k} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].tac = k; })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${me.tac === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>
                        {AR_T[k]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-bold mb-1">เพรสซิ่ง</div>
                    <div className="flex gap-1">
                      {['ต่ำ', 'กลาง', 'สูง'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].press = k; })} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.press ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold mb-1">จังหวะเกม</div>
                    <div className="flex gap-1">
                      {['ช้า', 'กลาง', 'เร็ว'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].tempo = k; })} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.tempo ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-bold mb-1">ความกว้าง</div>
                    <div className="flex gap-1">
                      {['แคบ', 'กลาง', 'กว้าง'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].wid = k; })} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.wid ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold mb-1">แนวรับ</div>
                    <div className="flex gap-1">
                      {['ลึก', 'กลาง', 'สูง'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].line = k; })} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.line ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold mb-1">สไตล์การจ่ายบอล</div>
                  <div className="flex flex-wrap gap-1.5">
                    {['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'].map((l, k) => (
                      <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].pass = k; })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.pass ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
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
                        className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-[11px] font-semibold cursor-pointer"
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
                            className="ml-auto px-2 py-1 text-[var(--red)] font-bold cursor-pointer"
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
                  <div className="flex flex-nowrap gap-1 shrink-0">
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
                        className={`px-2 py-0.5 rounded-lg text-[11px] mland:text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${squadPosFilter === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-nowrap items-center gap-1 text-[10.5px] mland:text-[9.5px] shrink-0">
                    <span className="text-[var(--mut)] font-semibold mr-0.5 shrink-0">เรียง:</span>
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
                        className={`px-2 mland:px-1.5 py-0.5 rounded-lg font-semibold whitespace-nowrap shrink-0 cursor-pointer ${squadSort === sKey ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'}`}
                      >
                        {sLbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 mland:space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
                {isMgr && (() => {
                  const incomingOffers = getIncomingOffers(state);
                  if (!incomingOffers.length) return null;
                  return (
                    <div className="px-3 py-2 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/60 flex items-center justify-between gap-2 text-xs">
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
                        className="px-2.5 py-1 rounded-lg bg-[var(--lamp)] text-[#261900] text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0"
                      >
                        เปิดหน้าตลาด →
                      </button>
                    </div>
                  );
                })()}

                {/* Responsive 100%-Width Squad Roster Table (Zero Horizontal Overflow) */}
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
                  <div className="grid grid-cols-[34px_minmax(0,1.7fr)_52px_36px_68px_72px_72px_94px] mland:grid-cols-[28px_minmax(0,1.7fr)_44px_30px_58px_62px_60px_80px] items-center gap-1.5 mland:gap-1 px-2.5 mland:px-2 py-1.5 mland:py-1 text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 border-b border-[var(--line)]">
                    <div className="text-center">#</div>
                    <div>นักเตะ</div>
                    <div>ตำแหน่ง</div>
                    <div className="text-center">อายุ</div>
                    <div className="text-center">OVR</div>
                    <div className="text-center">ฟิต</div>
                    <div className="text-center">ผลงาน</div>
                    <div className="text-right">ค่าเหนื่อย / ค่าตัว</div>
                  </div>

                  <div className="divide-y divide-[var(--line)]">
                    {listRows.map((q) => {
                      const f = Math.round(q.fit ?? 100);
                      const isStarter = starters.includes(q);
                      const isMe = !!q.me || (!isMgr && state.p?.name === q.n);
                      const no = getShirtNo(me, q);
                      const offerCount = isMgr ? getIncomingOffers(state).filter((o) => o.n === q.n).length : 0;
                      const wg = ensureCon(q).wg;
                      const fitBarCol = f >= 75 ? 'var(--g)' : f >= 50 ? 'var(--lamp)' : 'var(--red)';
                      const fitTxtCls = f >= 75 ? 'text-[var(--g)]' : f >= 50 ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--red)]';

                      return (
                        <div
                          key={q.n}
                          className={`px-2.5 mland:px-2 py-1.5 mland:py-1 grid grid-cols-[34px_minmax(0,1.7fr)_52px_36px_68px_72px_72px_94px] mland:grid-cols-[28px_minmax(0,1.7fr)_44px_30px_58px_62px_60px_80px] items-center gap-1.5 mland:gap-1 transition-colors hover:bg-[var(--surface-2)]/45 ${
                            isMe ? 'bg-[var(--lamp-soft)]/50' : q.listed ? 'bg-[var(--lamp-soft)]/20' : ''
                          }`}
                        >
                          <div className="flex items-center justify-center text-xs mland:text-[10px] font-bold text-[var(--mut)] tabular">
                            #{no}
                          </div>

                          <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                            <PlayerFace player={q} team={me} state={state} size={26} />
                            <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                              <div className="font-bold text-xs mland:text-[10.5px] truncate flex items-center gap-1">
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
                                {q.loan ? <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold shrink-0">[ยืม]</span> : null}
                                {q.listed ? <span className="text-[10px] text-[#9a6700] dark:text-[var(--lamp)] font-bold shrink-0">[ในตลาด {fmtMoneyNum(q.askPrice || vlu(q))}]</span> : null}
                                {offerCount > 0 ? <span className="px-1.5 rounded bg-[var(--g)] text-white text-[9px] font-bold shrink-0">{offerCount} บิด</span> : null}
                              </div>
                              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1">
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
                                  '11 ตัวจริง'
                                ) : (
                                  'ตัวสำรอง'
                                )}
                              </div>
                            </button>
                          </div>

                          <div className="flex items-center">
                            <span className="px-1.5 py-0.5 rounded-md bg-[var(--surface-2)] font-bold text-[10.5px] mland:text-[9px]">{q.ro}</span>
                          </div>

                          <div className="text-center text-xs mland:text-[10px] tabular font-semibold">
                            {q.age}
                          </div>

                          <div className="flex items-center justify-center gap-0.5">
                            <span className="px-1.5 py-0.5 rounded-lg text-white text-[11px] mland:text-[9.5px] font-bold tabular" style={{ background: ovColor(q.ov) }}>
                              {q.ov}
                            </span>
                            <span className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular">/{q.pot || q.ov}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${f}%`, background: fitBarCol }} />
                            </div>
                            <span className={`text-[10px] mland:text-[8.5px] font-bold tabular w-7 text-right ${fitTxtCls}`}>{f}%</span>
                          </div>

                          <div className="text-center text-[10.5px] mland:text-[9px] tabular text-[var(--mut)] flex items-center justify-center gap-1">
                            {q.sg || q.sa || q.cs || q.sp || q.ap ? (
                              <span className="inline-flex items-center gap-1.5">
                                {q.sp || q.ap ? <span className="font-semibold text-[var(--ink)]">{q.sp || q.ap}น</span> : null}
                                {q.sg ? (
                                  <span className="inline-flex items-center gap-0.5 font-bold text-[var(--ink)]" title={`ยิง ${q.sg} ประตู`}>
                                    <StatIconBadge kind="goal" count={1} size="xs" />
                                    <span>{q.sg}</span>
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
                                    <StatIconBadge kind="assist" count={1} size="xs" />
                                    <span>{q.sa}</span>
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </div>

                          <div className="text-right text-[10.5px] mland:text-[9px] tabular whitespace-nowrap">
                            <span className="font-bold text-[var(--ink)]">{fmtMoneyNum(wg)}</span>
                            <span className="text-[var(--mut)]"> · {fmtMoneyNum(vlu(q))}</span>
                          </div>
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
    </div>
  );
};

