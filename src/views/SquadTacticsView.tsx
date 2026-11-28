import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MainTab, NavIntent, Position, SubRole, Mentality, Player, CustomSlot, Team, GameState, PitchDragPreview } from '../types/game';
import { NavFocusBadge, useNavFocus } from '../components/NavFocusBanner';
import { clamp, fmtMoneyNum } from '../utils/math';
import { POS, FSD, LINE, AR_T } from '../data/thaiFootballData';
import { SFX, vibrate } from '../utils/audioTheme';
import { getLocalViewportSize, isVirtualLandscapeActive, liftScreenPoint, toVirtualLocalPoint } from '../utils/fullscreen';
import { getShirtNo, getFormationSlots, getFormationCounts, playerPen, xi, vlu, ensureCon, tc, getPlayerBio, teamKits, pickGK } from '../engine/playerCore';
import { rate, getLeagueTransferContext, getIncomingOffers, validateBatchSquadRemoval } from '../engine/simulation';
import { PlayerFace, ClubCrest, getPitchZoneAt, FormationPitch } from '../components/SvgVisuals';
import { MatchPlayerThumb } from '../modals/MatchSharedComponents';
import { StatIconBadge } from '../components/StatIconBadge';
import { LockerRoomPanel } from '../components/LockerRoomPanel';
import { TacticsBoardPanel } from '../components/TacticsBoardPanel';
import { FootPairIcon, getFootColorMeta } from '../components/PlayerBioStrip';
import { CustomFormationModal } from '../modals/TacticsModals';
import { SquadRenewModal, SquadSellModal, SquadReleaseModal } from '../modals/SquadActionModals';
import { StaminaBar, getStaminaMeta } from '../components/StaminaBar';
import { PlayerStatusBadge } from '../components/PlayerStatusBadge';
import { CaptainBadge } from '../components/CaptainBadge';
import { PositionBadge } from '../components/PositionBadge';
import { OvrBadge } from '../components/OvrBadge';
import { SquadListHeaderBar } from '../components/SquadListHeaderBar';
import { SortableColHeader } from '../components/SortableColHeader';
import { comparePlayerFitnessStatus, type SortDir } from '../utils/playerSort';
import { FormTrendBadge, buildRecentRatingsMap, getPlayerFormTrend, type PlayerFormTrend } from '../components/FormTrendBadge';
import {
  getActiveFavBoost,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getTeamCareQuotaInfo,
  getTeamFavoritePlayers,
  getWellbeingTierMeta,
  isTeamFavoritePlayer
} from '../engine/wellbeing';

type SquadSortKey = 'pos' | 'ov' | 'age' | 'fit' | 'form' | 'val' | 'goals';

export const SquadTacticsView = React.memo<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onShallowPatch?: (patcher: (prev: GameState) => Partial<GameState>) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onNavigate?: (tab: MainTab, sub?: string) => void;
  onToast: (msg: string) => void;
  navIntent?: NavIntent | null;
}>(({ state, onUpdateState, onShallowPatch, onInspectPlayer, onNavigate, onToast, navIntent }) => {
  const { clearFocus, isFocused } = useNavFocus(navIntent, 'q');
  const me = state.teams[state.me];
  const isMgr = state.mode === 'm';
  const sub = (state.sub ?? 0) > 3 ? 0 : (state.sub ?? 0);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [showFormationSheet, setShowFormationSheet] = useState(false);
  const [squadPosFilter, setSquadPosFilter] = useState<'ALL' | Position>('ALL');
  const [squadSort, setSquadSort] = useState<SquadSortKey>('pos');
  const [squadSortDir, setSquadSortDir] = useState<SortDir>('asc');
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
  const recentRatingsMap = useMemo(() => buildRecentRatingsMap(state), [state.schedRes]);
  const formTrendByName = useMemo(() => {
    const map = new Map<string, PlayerFormTrend>();
    me.sq.forEach((q) => {
      map.set(q.n, getPlayerFormTrend(q, me, state, recentRatingsMap));
    });
    return map;
  }, [me, state, recentRatingsMap]);
  const toggleSquadSort = (key: SquadSortKey) => {
    if (squadSort === key) {
      setSquadSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSquadSort(key);
    setSquadSortDir(key === 'age' || key === 'pos' ? 'asc' : 'desc');
  };
  const compareSquadPlayers = (a: Player, b: Player) => {
    if (squadSort === 'ov') {
      const cmp = (b.ov - a.ov) || ((b.pot || b.ov) - (a.pot || a.ov));
      return squadSortDir === 'asc' ? -cmp : cmp;
    }
    if (squadSort === 'form') {
      const cmp = ((formTrendByName.get(b.n)?.score ?? 0) - (formTrendByName.get(a.n)?.score ?? 0)) || (b.ov - a.ov);
      return squadSortDir === 'asc' ? -cmp : cmp;
    }
    if (squadSort === 'fit') return comparePlayerFitnessStatus(a, b, squadSortDir);
    if (squadSort === 'age') {
      const cmp = (a.age - b.age) || (b.ov - a.ov);
      return squadSortDir === 'desc' ? -cmp : cmp;
    }
    if (squadSort === 'val') {
      const cmp = (vlu(b) - vlu(a)) || (b.ov - a.ov);
      return squadSortDir === 'asc' ? -cmp : cmp;
    }
    if (squadSort === 'goals') {
      const cmp = ((b.sg || 0) - (a.sg || 0)) || ((b.sa || 0) - (a.sa || 0)) || (b.ov - a.ov);
      return squadSortDir === 'asc' ? -cmp : cmp;
    }
    const cmp = (POS.indexOf(a.pos) - POS.indexOf(b.pos)) || (b.ov - a.ov);
    return squadSortDir === 'desc' ? -cmp : cmp;
  };
  const bench = useMemo(
    () =>
      me.sq
        .filter((q) => !starters.includes(q))
        .sort(compareSquadPlayers),
    [me.sq, starters, squadSort, squadSortDir, formTrendByName]
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
        const starterSlotSp = slots[idx]?.sp || starter.ro;
        const subIdx = freshPool.findIndex((b) =>
          starter.pos === 'GK'
            ? b.pos === 'GK' || playerPen(b, 'GK') === 0
            : b.pos === starter.pos || playerPen(b, starterSlotSp) === 0
        );
        const fallbackIdx =
          subIdx >= 0
            ? subIdx
            : starter.pos === 'GK'
              ? -1
              : freshPool.findIndex((b) => b.pos !== 'GK' || playerPen(b, starterSlotSp) <= 1);
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

  const unreadyStarters = useMemo(
    () => starters.filter((q) => q.inj > 0 || (q.sus || 0) > 0),
    [starters]
  );

  const swapUnreadyStarters = () => {
    if (!isMgr || unreadyStarters.length === 0) return;
    const swappedPairs: string[] = [];
    SFX.tap();
    onUpdateState((draft) => {
      const t = draft.teams[draft.me];
      const curXi = xi(t);
      const nextLu = curXi.map((q) => q.n);
      const usedNames = new Set(nextLu);
      const readyPool = t.sq
        .filter((q) => !usedNames.has(q.n) && q.inj === 0 && (q.sus || 0) === 0)
        .sort((a, b) => (b.fit ?? 100) * 0.45 + b.ov - ((a.fit ?? 100) * 0.45 + a.ov));

      curXi.forEach((starter, idx) => {
        if (starter.inj === 0 && (starter.sus || 0) === 0) return;
        const starterSlotSp = slots[idx]?.sp || starter.ro;
        const subIdx = readyPool.findIndex((b) =>
          starter.pos === 'GK'
            ? b.pos === 'GK' || playerPen(b, 'GK') === 0
            : b.pos === starter.pos || playerPen(b, starterSlotSp) === 0
        );
        const fallbackIdx =
          subIdx >= 0
            ? subIdx
            : readyPool.findIndex((b) => (starter.pos === 'GK' ? true : b.pos !== 'GK'));
        const pickIdx = fallbackIdx >= 0 ? fallbackIdx : readyPool.length > 0 ? 0 : -1;
        if (pickIdx >= 0) {
          const replacement = readyPool.splice(pickIdx, 1)[0];
          nextLu[idx] = replacement.n;
          swappedPairs.push(`${starter.n.split(' ')[0]}→${replacement.n.split(' ')[0]}`);
        }
      });
      t.lu = nextLu;
    });
    if (swappedPairs.length > 0) {
      clearFocus();
      onToast(`⚡ สลับตัวพร้อมลง ${swappedPairs.length} ตำแหน่ง (${swappedPairs.slice(0, 2).join(', ')})`);
    } else {
      onToast('ยังไม่มีตัวสำรองที่พร้อมลงสนาม');
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
    grabDxSvg: number;
    grabDySvg: number;
    lockedSwapName: string | null;
    cachedRect: DOMRect | null;
    cachedInvCtm: DOMMatrix | null;
  } | null>(null);
  const [dragUi, setDragUi] = useState<{ player: Player; fromSlot?: SubRole } | null>(null);
  const dragUiRef = useRef<{ player: Player; fromSlot?: SubRole } | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragGhostPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<{ name: string; slot?: string } | null>(null);
  const [pitchDragPreview, setPitchDragPreview] = useState<PitchDragPreview | null>(null);
  const pitchDragPreviewRef = useRef<PitchDragPreview | null>(null);
  const [touchAnchorPt, setTouchAnchorPt] = useState<{ px: number; py: number } | null>(null);
  const pitchRenderCoordsRef = useRef<{
    gx: number;
    gy: number;
    fpx: number;
    fpy: number;
    showTether: boolean;
  } | null>(null);

  const syncPitchDragDom = () => {
    const svg = pitchSvgRef.current;
    const coords = pitchRenderCoordsRef.current;
    if (!svg || !coords) return;
    const { gx, gy, fpx, fpy, showTether } = coords;
    const grp = svg.querySelector<SVGGElement>('[data-pitch-drag-group="1"]');
    if (grp) {
      grp.setAttribute('transform', `translate(${gx.toFixed(2)},${gy.toFixed(2)})`);
      const pill = grp.querySelector<SVGGElement>('[data-pitch-drag-pill="1"]');
      if (pill) {
        const pillOffsetX = clamp(gx, 44, 256) - gx;
        pill.setAttribute('transform', `translate(${pillOffsetX.toFixed(2)},-37)`);
      }
      const nameEl = grp.querySelector<SVGTextElement>('[data-pitch-drag-name="1"]');
      if (nameEl) {
        const nameOffsetX = clamp(gx, 28, 272) - gx;
        nameEl.setAttribute('x', nameOffsetX.toFixed(2));
      }
    }
    const tether = svg.querySelector<SVGLineElement>('[data-pitch-drag-tether="1"]');
    if (tether) {
      tether.setAttribute('x1', fpx.toFixed(2));
      tether.setAttribute('y1', fpy.toFixed(2));
      tether.setAttribute('x2', gx.toFixed(2));
      tether.setAttribute('y2', gy.toFixed(2));
      tether.setAttribute('opacity', showTether ? '0.85' : '0');
    }
    const finger = svg.querySelector<SVGCircleElement>('[data-pitch-drag-finger="1"]');
    if (finger) {
      finger.setAttribute('cx', fpx.toFixed(2));
      finger.setAttribute('cy', fpy.toFixed(2));
      finger.setAttribute('opacity', showTether ? '1' : '0');
    }
  };

  useLayoutEffect(() => {
    if (pitchDragPreview) {
      syncPitchDragDom();
    }
  }, [pitchDragPreview, touchAnchorPt]);

  const updateDragGhostPos = (rawX: number, rawY: number, isTouch = false) => {
    const pt = toVirtualLocalPoint(rawX, rawY);
    const vp = getLocalViewportSize();
    const gx = typeof window !== 'undefined' ? clamp(pt.x - 95, 8, vp.width - 216) : pt.x - 95;
    const yOffset = isTouch ? 86 : 52;
    const gy = typeof window !== 'undefined' ? clamp(pt.y - yOffset, 8, vp.height - 68) : pt.y - yOffset;
    dragGhostPosRef.current = { x: gx, y: gy };
    if (dragGhostRef.current) {
      dragGhostRef.current.style.transform = `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0)`;
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
        prev.sp === next.sp &&
        prev.zoneId === next.zoneId &&
        prev.player.n === next.player.n
      ) {
        return prev;
      }
      return next;
    });
  };

  const setTouchAnchorPtIfChanged = (next: { px: number; py: number } | null) => {
    setTouchAnchorPt((prev) => {
      if (Boolean(prev) === Boolean(next)) return prev;
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

  const getSvgGeometry = (cachedRect?: DOMRect | null, cachedInvCtm?: DOMMatrix | null) => {
    const svg = pitchSvgRef.current;
    if (!svg) return null;
    const rect = cachedRect || svg.getBoundingClientRect();
    let invCtm = cachedInvCtm ?? null;
    if (!invCtm) {
      try {
        const ctm = svg.getScreenCTM?.();
        if (ctm) invCtm = ctm.inverse();
      } catch {
        invCtm = null;
      }
    }
    return { svg, rect, invCtm };
  };

  const clientToPitchCoords = (
    clientX: number,
    clientY: number,
    liftPx = 0,
    cachedRect?: DOMRect | null,
    cachedInvCtm?: DOMMatrix | null
  ): { px: number; py: number; rawPx: number; rawPy: number; inside: boolean; rect: DOMRect } | null => {
    const geom = getSvgGeometry(cachedRect, cachedInvCtm);
    if (!geom) return null;
    const { svg, rect, invCtm } = geom;
    const vLand = isVirtualLandscapeActive();
    const maxLiftPad = Math.max(20, liftPx + 18);
    const lifted = liftScreenPoint(clientX, clientY, liftPx);
    const effectiveX = vLand ? clamp(lifted.x, rect.left, rect.right) : clientX;
    const effectiveY = vLand ? clientY : liftPx > 0 ? clamp(lifted.y, rect.top, rect.bottom) : clientY;
    const rawInside = vLand
      ? clientX >= rect.left - maxLiftPad &&
        clientX <= rect.right + 12 &&
        clientY >= rect.top - 12 &&
        clientY <= rect.bottom + 12
      : clientX >= rect.left - 12 &&
        clientX <= rect.right + 12 &&
        clientY >= rect.top - 12 &&
        clientY <= rect.bottom + maxLiftPad;
    const inside =
      rawInside &&
      effectiveX >= rect.left - 6 &&
      effectiveX <= rect.right + 6 &&
      effectiveY >= rect.top - 6 &&
      effectiveY <= rect.bottom + 6;
    if (invCtm) {
      const pt = svg.createSVGPoint();
      pt.x = effectiveX;
      pt.y = effectiveY;
      const inv = pt.matrixTransform(invCtm);
      const rawPt = svg.createSVGPoint();
      rawPt.x = clientX;
      rawPt.y = clientY;
      const rawInv = rawPt.matrixTransform(invCtm);
      return { px: inv.x, py: inv.y, rawPx: rawInv.x, rawPy: rawInv.y, inside, rect };
    }
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    return {
      px: ((clientX - rect.left) / w) * 300,
      py: ((effectiveY - rect.top) / h) * 380,
      rawPx: ((clientX - rect.left) / w) * 300,
      rawPy: ((clientY - rect.top) / h) * 380,
      inside,
      rect
    };
  };

  const findNearestPitchStarter = (
    clientX: number,
    clientY: number,
    excludeName?: string,
    liftPx = 0,
    cachedRect?: DOMRect | null,
    cachedInvCtm?: DOMMatrix | null
  ): { name: string; slot?: string } | null => {
    const pitchPt = clientToPitchCoords(clientX, clientY, liftPx, cachedRect, cachedInvCtm);
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

  const findDropAt = (
    x: number,
    y: number,
    excludeName?: string,
    pitchLiftPx = 0,
    cachedRect?: DOMRect | null,
    cachedInvCtm?: DOMMatrix | null
  ): { name: string; slot?: string } | null => {
    // 1. Exact finger check for squad/bench list rows (no Y offset so finger hits exact row)
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const hit = (el as Element).closest?.('[data-drop-player]');
      if (hit && !pitchSvgRef.current?.contains(hit)) {
        const name = hit.getAttribute('data-drop-player');
        if (name && name !== excludeName) return { name, slot: hit.getAttribute('data-drop-slot') || undefined };
      }
    }
    // 2. Pitch check with progressive lift so thumb doesn't cover target node
    const pitchHit = findNearestPitchStarter(x, y, excludeName, pitchLiftPx, cachedRect, cachedInvCtm);
    if (pitchHit) return pitchHit;

    // 3. Fallback DOM pitch node hit if near boundary
    if (pitchLiftPx > 0) {
      const lifted = liftScreenPoint(x, y, pitchLiftPx);
      const liftedEls = document.elementsFromPoint(lifted.x, lifted.y);
      for (const el of liftedEls) {
        const hit = (el as Element).closest?.('[data-drop-player]');
        if (hit && pitchSvgRef.current?.contains(hit)) {
          const name = hit.getAttribute('data-drop-player');
          if (name && name !== excludeName) return { name, slot: hit.getAttribute('data-drop-slot') || undefined };
        }
      }
    }
    return null;
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

    let cachedRect: DOMRect | null = null;
    let cachedInvCtm: DOMMatrix | null = null;
    let grabDxSvg = 0;
    let grabDySvg = 0;
    const svg = pitchSvgRef.current;
    if (svg && isMgr) {
      cachedRect = svg.getBoundingClientRect();
      try {
        const ctm = svg.getScreenCTM?.();
        if (ctm) cachedInvCtm = ctm.inverse();
      } catch {
        cachedInvCtm = null;
      }
      if (slotIdx !== undefined && slots[slotIdx]) {
        const startPt = clientToPitchCoords(e.clientX, e.clientY, 0, cachedRect, cachedInvCtm);
        if (startPt) {
          const slotPx = 18 + slots[slotIdx].x * 2.64;
          const slotPy = 16 + slots[slotIdx].y * 3.48;
          grabDxSvg = clamp(slotPx - startPt.rawPx, -16, 16);
          grabDySvg = clamp(slotPy - startPt.rawPy, -16, 16);
        }
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
        updateDragGhostPos(cur.x, cur.y, cur.isTouch);
        setDragUiIfChanged({ player: cur.player, fromSlot: cur.fromSlot });
        const rectRef = cur.cachedRect;
        const pitchH = (isVirtualLandscapeActive() ? rectRef?.width : rectRef?.height) || 0;
        const targetLift = cur.isTouch && pitchH ? clamp(pitchH * 0.21, 46, 58) : 0;
        const hit = findDropAt(cur.x, cur.y, cur.player.n, targetLift, cur.cachedRect, cur.cachedInvCtm);
        setDropTargetIfChanged(hit);
      }, 155);
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
      holdTimer,
      grabDxSvg,
      grabDySvg,
      lockedSwapName: null,
      cachedRect,
      cachedInvCtm
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
    let rafId: number | null = null;
    let latestMove: { clientX: number; clientY: number; pointerId: number } | null = null;

    const clearDrag = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      latestMove = null;
      if (dragRef.current?.holdTimer) {
        window.clearTimeout(dragRef.current.holdTimer);
      }
      dragRef.current = null;
      pitchDragPreviewRef.current = null;
      pitchRenderCoordsRef.current = null;
      setDragUiIfChanged(null);
      setDropTargetIfChanged(null);
      setPitchDragPreviewIfChanged(null);
      setTouchAnchorPtIfChanged(null);
    };

    const computePitchLiftRamp = (dist: number) => {
      const t = clamp(dist / 18, 0, 1);
      return 1 - (1 - t) * (1 - t);
    };

    const computePitchLift = (d: NonNullable<typeof dragRef.current>, dist: number) => {
      if (!d.isTouch) return 0;
      const rectRef = d.cachedRect || pitchSvgRef.current?.getBoundingClientRect();
      const pitchH = (isVirtualLandscapeActive() ? rectRef?.width : rectRef?.height) || 260;
      const targetLift = clamp(pitchH * 0.21, 46, 58);
      return targetLift * computePitchLiftRamp(dist);
    };

    const processPointerFrame = (clientX: number, clientY: number, pointerId: number) => {
      const d = dragRef.current;
      if (!d || pointerId !== d.pointerId) return;
      if (!dragActionsRef.current.isMgr) return;
      const curLocal = toVirtualLocalPoint(clientX, clientY);
      const startLocal = toVirtualLocalPoint(d.startX, d.startY);
      const dx = curLocal.x - startLocal.x;
      const dy = curLocal.y - startLocal.y;
      const dist = Math.hypot(dx, dy);

      if (!d.active) {
        if (!d.immediate) {
          // If touching non-grip part of row and swiping vertically to scroll, cancel drag cleanly
          if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx) * 1.15) {
            clearDrag();
            return;
          }
          if (dist > 9 && Math.abs(dx) >= Math.abs(dy)) {
            if (d.holdTimer) window.clearTimeout(d.holdTimer);
            d.active = true;
            d.immediate = true;
            vibrate(10);
          }
        } else if (dist > 4) {
          d.active = true;
        }
      }
      if (!d.active) return;

      d.x = clientX;
      d.y = clientY;

      const liftPx = computePitchLift(d, dist);
      const liftRamp = d.isTouch ? computePitchLiftRamp(dist) : 1;
      const pitchPt = clientToPitchCoords(clientX, clientY, liftPx, d.cachedRect, d.cachedInvCtm);

      if (d.fromPitchIdx !== undefined && d.fromPitchIdx >= 1 && pitchPt?.inside) {
        // Fade initial grab offset out smoothly as player lifts clear above the thumb
        const grabFade = d.isTouch ? 1 - liftRamp : 1;
        const adjPx = pitchPt.px + d.grabDxSvg * grabFade;
        const adjPy = pitchPt.py + d.grabDySvg * grabFade;

        const fpx = clamp(pitchPt.rawPx, 8, 292);
        const fpy = clamp(pitchPt.rawPy, 8, 372);

        const { starters: curStarters, slots: curSlots } = dragActionsRef.current;
        const enterRadius = 18;
        const keepRadius = 21.5;
        let closestSwap: { name: string; slot?: string; dist: number } | null = null;
        let lockedMatch: { name: string; slot?: string; dist: number } | null = null;

        curStarters.forEach((other, idx) => {
          if (idx === d.fromPitchIdx) return;
          const oz = curSlots[idx];
          if (!oz) return;
          const ox = 18 + oz.x * 2.64;
          const oy = 16 + oz.y * 3.48;
          const sDist = Math.hypot(adjPx - ox, adjPy - oy);
          if (other.n === d.lockedSwapName && sDist <= keepRadius) {
            lockedMatch = { name: other.n, slot: oz.sp, dist: sDist };
          }
          if (sDist <= enterRadius && (!closestSwap || sDist < closestSwap.dist)) {
            closestSwap = { name: other.n, slot: oz.sp, dist: sDist };
          }
        });

        const resolvedSwap = closestSwap || lockedMatch;
        if (resolvedSwap) {
          const swapObj = resolvedSwap as { name: string; slot?: string };
          d.lockedSwapName = swapObj.name;
          pitchDragPreviewRef.current = null;
          pitchRenderCoordsRef.current = null;
          setPitchDragPreviewIfChanged(null);
          setTouchAnchorPtIfChanged(null);
          setDropTargetIfChanged({ name: swapObj.name, slot: swapObj.slot });
          setDragUiIfChanged(null);
          return;
        }

        d.lockedSwapName = null;
        const rawNx = clamp((adjPx - 18) / 2.64, 4, 96);
        const rawNy = clamp((adjPy - 16) / 3.48, 8, 84);
        const gx = 18 + rawNx * 2.64;
        const gy = 16 + rawNy * 3.48;
        const nx = clamp(Math.round(rawNx), 4, 96);
        const ny = clamp(Math.round(rawNy), 8, 84);
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
        pitchRenderCoordsRef.current = {
          gx,
          gy,
          fpx,
          fpy,
          showTether: d.isTouch && Math.hypot(fpx - gx, fpy - gy) > 8
        };
        if (d.isTouch) {
          setTouchAnchorPtIfChanged({ px: fpx, py: fpy });
        } else {
          setTouchAnchorPtIfChanged(null);
        }
        setPitchDragPreviewIfChanged(preview);
        setDropTargetIfChanged(null);
        setDragUiIfChanged(null);
        syncPitchDragDom();
        return;
      }

      d.lockedSwapName = null;
      pitchDragPreviewRef.current = null;
      pitchRenderCoordsRef.current = null;
      setPitchDragPreviewIfChanged(null);
      setTouchAnchorPtIfChanged(null);
      updateDragGhostPos(clientX, clientY, d.isTouch);
      setDragUiIfChanged({ player: d.player, fromSlot: d.fromSlot });
      const hit = findDropAt(clientX, clientY, d.player.n, liftPx, d.cachedRect, d.cachedInvCtm);
      setDropTargetIfChanged(hit);
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!dragActionsRef.current.isMgr) return;
      latestMove = { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId };
      if (rafId === null) {
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          if (latestMove) {
            processPointerFrame(latestMove.clientX, latestMove.clientY, latestMove.pointerId);
          }
        });
      }
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
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
        processPointerFrame(e.clientX, e.clientY, e.pointerId);
      }
      const cur = dragRef.current;
      if (!cur) return;
      const preview = pitchDragPreviewRef.current;
      const wasActive = cur.active;
      const dist = Math.hypot(e.clientX - cur.startX, e.clientY - cur.startY);
      const liftPx = computePitchLift(cur, dist);
      const lockedSwap = cur.lockedSwapName;
      const cachedRect = cur.cachedRect;
      const cachedInvCtm = cur.cachedInvCtm;
      clearDrag();

      if (!wasActive) {
        dragActionsRef.current.handleTapPlayerAction(cur.player);
        return;
      }
      if (lockedSwap && lockedSwap !== cur.player.n) {
        dragActionsRef.current.swapAnyPlayers(cur.player.n, lockedSwap);
        return;
      }
      if (preview) {
        dragActionsRef.current.moveStarterToZone(
          preview.slotIdx,
          preview.x,
          preview.y,
          preview.sp,
          preview.zoneLabel,
          cur.player.n
        );
        return;
      }
      const hit = findDropAt(e.clientX, e.clientY, cur.player.n, liftPx, cachedRect, cachedInvCtm);
      if (hit && hit.name !== cur.player.n) {
        dragActionsRef.current.swapAnyPlayers(cur.player.n, hit.name);
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
      if (rafId !== null) window.cancelAnimationFrame(rafId);
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

  const renderPlayerRow = (q: Player, slotSp?: SubRole) => {
    const stMeta = getStaminaMeta(q.fit);
    const f = stMeta.f;
    const isSource = dragUi?.player.n === q.n;
    const isTarget = dropTarget?.name === q.n && dragUi?.player.n !== q.n;
    const isMe = !!q.me || (!isMgr && state.p?.name === q.n);
    const pn = slotSp ? playerPen(q, slotSp) : 0;
    const no = getShirtNo(me, q);
    const unavailable = q.inj > 0 || (q.sus || 0) > 0;
    const formTrend = formTrendByName.get(q.n) || getPlayerFormTrend(q, me, state, recentRatingsMap);
    const rowStaminaTint =
      slotSp && !unavailable
        ? f < 65
          ? 'bg-rose-500/[0.08] hover:bg-rose-500/[0.13]'
          : f < 75
            ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.11]'
            : ''
        : '';

    const isUnreadyHighlight = Boolean(slotSp && unavailable && isFocused('xi-unready'));
    const isFav = isTeamFavoritePlayer(me, q.n);
    const rowFavBoost = getActiveFavBoost(q, me, isMe ? state.p : null);

    return (
      <div
        key={q.n}
        role="button"
        tabIndex={0}
        data-drop-player={q.n}
        data-drop-slot={slotSp || ''}
        data-focus-id={isUnreadyHighlight ? 'xi-unready-row' : undefined}
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
        className={`w-full grid grid-cols-[16px_22px_34px_26px_minmax(0,1fr)_72px_auto] mland:grid-cols-[14px_19px_30px_24px_minmax(0,1fr)_62px_auto] items-center gap-1 mland:gap-0.5 px-2 py-[3.5px] mland:px-1.5 mland:py-[2.5px] text-left select-none transition-colors ${
          isTarget
            ? 'bg-[var(--lamp-soft)] ring-1 ring-inset ring-[var(--lamp)]'
            : isSource
              ? 'opacity-45 bg-[var(--surface-2)]'
              : isUnreadyHighlight
                ? 'bg-rose-500/15 ring-1 ring-inset ring-amber-400'
                : unavailable
                  ? 'bg-rose-500/[0.06] hover:bg-rose-500/[0.1]'
                  : isMe
                    ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/70'
                    : rowStaminaTint || 'hover:bg-[var(--surface-2)]/65'
        } ${unavailable ? 'opacity-82' : ''} ${dragUi ? 'cursor-grabbing' : 'cursor-pointer'}`}
      >
        <div
          data-drag-grip={isMgr ? '1' : undefined}
          onContextMenu={(e) => e.preventDefault()}
          style={
            isMgr
              ? { touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }
              : { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }
          }
          title={isMgr ? 'ลากเพื่อเปลี่ยนหรือสลับตำแหน่ง' : 'กด 1 ครั้งเพื่อดูข้อมูล'}
          className={`col-span-4 grid grid-cols-[16px_22px_34px_26px] mland:grid-cols-[14px_19px_30px_24px] items-center gap-1 mland:gap-0.5 ${
            isMgr ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-center shrink-0 [&>svg]:w-[15px] [&>svg]:h-[15px] mland:[&>svg]:w-[13px] mland:[&>svg]:h-[13px]">
            <ClubCrest name={me.name} size={15} team={me} club={state.club} isMyClub={isMgr} />
          </div>

          <div className="flex items-center justify-start">
            <MatchPlayerThumb
              player={q}
              team={me}
              state={state}
              kitColor={q.pos === 'GK' ? meGkKit : meKit}
              trimColor={q.pos === 'GK' ? undefined : meTrim}
              size="xs"
            />
          </div>

          <div className="flex items-center justify-center">
            <PositionBadge role={slotSp || q.ro} size="2xs" />
          </div>

          <div className="text-left text-[10px] mland:text-[8.5px] font-extrabold text-[#b45309] dark:text-[var(--lamp)] tabular whitespace-nowrap">
            #{no}
          </div>
        </div>

        <div className="flex items-center justify-start gap-1 min-w-0">
          <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate">{q.n}</span>
          {me.cap === q.n && <CaptainBadge team={me} state={state} size="xs" className="shrink-0" />}
          {isFav && (
            <span
              title={rowFavBoost > 0 ? `ลูกรักประจำทีม (+${rowFavBoost} OVR ชั่วคราว)` : 'ลูกรักประจำทีม (รอใจ/กาย ≥ 72)'}
              className={`inline-flex items-center text-[9.5px] mland:text-[8px] font-extrabold leading-none tabular shrink-0 ${
                rowFavBoost > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-rose-500/80 dark:text-rose-400/80'
              }`}
            >
              {rowFavBoost > 0 ? `💖+${rowFavBoost}` : '💖'}
            </span>
          )}
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

        <div className="flex items-center justify-end gap-0.5">
          <FormTrendBadge trend={formTrend} size="xs" />
          <OvrBadge
            ov={q.ov + rowFavBoost}
            boost={rowFavBoost}
            size="2xs"
            title={rowFavBoost > 0 ? `OVR ${q.ov} + ลูกรัก ${rowFavBoost} = ${q.ov + rowFavBoost}` : undefined}
          />
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
              👕 ห้องแต่งตัว
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

                {isMgr && !pitchDragPreview && dropTarget && dragRef.current?.fromPitchIdx !== undefined && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-2.5 py-0.5 rounded-lg bg-[var(--lamp)] text-[#261900] border border-amber-300 text-[10.5px] mland:text-[9px] font-extrabold whitespace-nowrap shadow-md">
                    🔀 สลับ {dragRef.current.player.n.split(' ')[0]} ↔ {dropTarget.name.split(' ')[0]}{dropTarget.slot ? ` (${dropTarget.slot})` : ''}
                  </div>
                )}

                {/* Top-Right Inside Pitch: Compact Plan Pill (Tap to Expand, Tap Outside to Collapse) */}
                {!(isMgr && (pitchDragPreview || (dropTarget && dragRef.current?.fromPitchIdx !== undefined))) && (
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
                      <div className="mt-1.5 w-[290px] sm:w-[325px] mland:w-[265px] max-w-[calc(100%-4px)] p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xl space-y-2 mland:space-y-1.5">
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--line)]/80 text-[11px] mland:text-[9px]">
                          <span className="font-extrabold text-[var(--ink)]">🧭 เปลี่ยนแผน &amp; สไตล์ด่วน</span>
                          <button
                            type="button"
                            onClick={() => setShowFormationSheet(false)}
                            className="w-5 h-5 inline-flex items-center justify-center rounded-md text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer"
                            aria-label="ปิด"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)]">ระบบการเล่น</div>
                          <div className="grid grid-cols-3 gap-1">
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
                                className={`btn btn-xs truncate !px-1 tabular ${
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
                                setShowFormationSheet(false);
                                setShowCustomEditor(true);
                              }}
                              className={`btn btn-xs truncate !px-1 ${
                                me.form === 'custom' ? 'btn-primary' : 'btn-secondary'
                              }`}
                            >
                              ✏️ ปรับเอง
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                setShowFormationSheet(false);
                                setSquadSubTab(1);
                              }}
                              className="btn btn-xs btn-secondary truncate !px-1 text-[var(--g)]"
                            >
                              หน้าแผนเต็ม →
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 pt-1.5 border-t border-[var(--line)]/70">
                          <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)]">สไตล์คุมทีม</div>
                          <div className="seg-bar grid grid-cols-5 w-full">
                            {(['X', 'A', 'B', 'D', 'Z'] as Mentality[]).map((k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  SFX.tap();
                                  onUpdateState((d) => { d.teams[d.me].tac = k; });
                                }}
                                className={`seg-btn truncate !px-0.5 ${me.tac === k ? 'seg-btn-active' : ''}`}
                              >
                                {AR_T[k]}
                              </button>
                            ))}
                          </div>
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
                    dragSourceName={isMgr ? (dragUi?.player.n || (dropTarget && dragRef.current?.fromPitchIdx !== undefined ? dragRef.current.player.n : null)) : null}
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

                  {isMgr && unreadyStarters.length > 0 && (
                    <div
                      data-focus-id="xi-unready"
                      className={`shrink-0 px-2.5 py-1.5 mland:px-2 mland:py-1 border-b border-rose-500/40 bg-rose-500/10 flex items-center justify-between gap-2 ${
                        isFocused('xi-unready') ? 'task-focus-spotlight task-focus-spotlight-rose' : ''
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-1.5 text-[10.5px] mland:text-[9px]">
                        {isFocused('xi-unready') && <NavFocusBadge tone="rose" />}
                        <span className="font-bold text-rose-700 dark:text-rose-300 truncate">
                          ⚠️ ตัวจริงเจ็บ/แบน {unreadyStarters.length} คน: {unreadyStarters.map((q) => q.n.split(' ')[0]).join(', ')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={swapUnreadyStarters}
                        className="btn btn-xs bg-rose-600 hover:bg-rose-700 text-white border border-rose-500/40 shrink-0 whitespace-nowrap"
                      >
                        ⚡ สลับตัวพร้อมลง
                      </button>
                    </div>
                  )}

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
                    <div className="sticky top-0 z-10 px-2.5 py-0.5 mland:px-2 bg-[var(--surface-2)] border-y border-[var(--line)] flex items-center justify-between gap-1 text-[9.5px] mland:text-[8px] font-extrabold text-[var(--ink)]">
                      <span className="shrink-0">ตัวสำรอง ({bench.length})</span>
                      <div className="flex items-center gap-1.5 mland:gap-1 shrink-0 font-bold">
                        <SortableColHeader
                          label="ตำแหน่ง"
                          active={squadSort === 'pos'}
                          dir={squadSortDir}
                          onClick={() => toggleSquadSort('pos')}
                          className="text-[9.5px] mland:text-[8px]"
                        />
                        <SortableColHeader
                          label="อายุ"
                          active={squadSort === 'age'}
                          dir={squadSortDir}
                          onClick={() => toggleSquadSort('age')}
                          className="text-[9.5px] mland:text-[8px]"
                        />
                        <SortableColHeader
                          label="ฟิต"
                          active={squadSort === 'fit'}
                          dir={squadSortDir}
                          onClick={() => toggleSquadSort('fit')}
                          className="text-[9.5px] mland:text-[8px]"
                        />
                        <SortableColHeader
                          label="OVR"
                          active={squadSort === 'ov'}
                          dir={squadSortDir}
                          onClick={() => toggleSquadSort('ov')}
                          className="text-[9.5px] mland:text-[8px]"
                        />
                      </div>
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
        <TacticsBoardPanel
          state={state}
          team={me}
          isMgr={isMgr}
          onUpdateState={onUpdateState}
          onOpenCustomEditor={() => setShowCustomEditor(true)}
          onGoToLineup={() => {
            if (onShallowPatch) onShallowPatch(() => ({ sub: 0 }));
            else onUpdateState((d) => { d.sub = 0; });
          }}
          onToast={onToast}
        />
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
              .sort(compareSquadPlayers);

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
                <div className="grid grid-cols-3 sm:grid-cols-5 mland:grid-cols-5 gap-2 mland:gap-1 text-center shrink-0">
                  <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ขนาดทีม (18–28)</div><div className="font-bold text-sm mland:text-[11px] tabular">{me.sq.length}/28</div></div>
                  <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ค่าเหนื่อย/เพดาน</div><div className={`font-bold text-sm mland:text-[11px] tabular ${tx.wagePct > 95 ? 'text-[var(--red)]' : ''}`}>{tx.curWage}/{tx.wageCap}k</div></div>
                  <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">โควตาต่างชาติ</div><div className={`font-bold text-sm mland:text-[11px] tabular ${tx.foreignCount >= tx.maxForeign ? 'text-[var(--red)]' : ''}`}>{tx.foreignCount}/{tx.maxForeign}</div></div>
                  <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">โควตายืมตัว</div><div className="font-bold text-sm mland:text-[11px] tabular">{tx.loansCount}/{tx.maxLoans}</div></div>
                  <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ตลาดซื้อขาย</div><div className={`font-bold text-sm mland:text-[10px] mt-0.5 mland:mt-0 ${tx.tw.open ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>{tx.tw.shortLabel}</div></div>
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
                  <div className="hidden sm:flex mland:flex items-center gap-1.5 text-[10.5px] mland:text-[9px] text-[var(--mut)] shrink-0">
                    <span>กดหัวตารางเพื่อเรียงลำดับ</span>
                    {(squadSort !== 'pos' || squadSortDir !== 'asc') && (
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setSquadSort('pos');
                          setSquadSortDir('asc');
                        }}
                        className="text-[var(--g)] font-bold hover:underline cursor-pointer"
                      >
                        รีเซ็ต
                      </button>
                    )}
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
                {(() => {
                  const favList = getTeamFavoritePlayers(me);
                  const anyBoosted = favList.some((fp) => getActiveFavBoost(fp, me, fp.me ? state.p : null) > 0);
                  const quota = getTeamCareQuotaInfo(state, me);
                  return (
                    <div
                      className={`px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10px] ${
                        anyBoosted
                          ? 'bg-gradient-to-r from-rose-500/12 via-amber-500/10 to-emerald-500/10 border-rose-500/45'
                          : favList.length > 0
                            ? 'bg-[var(--lamp-soft)]/55 border-[var(--lamp)]/50'
                            : 'bg-[var(--surface-2)]/70 border-[var(--line)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                        <span className="font-extrabold text-[var(--ink)] shrink-0">
                          💖 ลูกรักประจำทีม ({favList.length} คน):
                        </span>
                        {favList.length > 0 ? (
                          favList.map((fp) => {
                            const fCp = fp.me ? state.p : null;
                            const fm = getPlayerMentalScore(fp, fCp);
                            const fph = getPlayerPhysScore(fp, fCp);
                            const fb = getActiveFavBoost(fp, me, fCp);
                            return (
                              <button
                                key={fp.n}
                                type="button"
                                onClick={() => {
                                  SFX.tap();
                                  onInspectPlayer(fp, me);
                                }}
                                title={`🧠 ใจ ${fm} · 💪 กาย ${fph} (${fb > 0 ? `ปลุกพลัง +${fb} OVR` : 'รอใจ/กาย ≥72'})`}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] mland:text-[9px] font-bold cursor-pointer transition-colors ${
                                  fb > 0
                                    ? 'bg-rose-600/15 border-rose-500/55 text-rose-700 dark:text-rose-200 hover:bg-rose-600/25'
                                    : 'bg-[var(--surface)]/80 border-[var(--line)] text-[var(--ink)] hover:border-amber-500/60'
                                }`}
                              >
                                <span className="truncate max-w-[110px]">{fp.n.split(' ')[0]}</span>
                                <span className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular">
                                  {fm}/{fph}
                                </span>
                                {fb > 0 && (
                                  <span className="text-[10px] mland:text-[8.5px] font-black text-rose-600 dark:text-rose-400 tabular">
                                    +{fb}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-[var(--mut)]">
                            ยังไม่มีรายชื่อ (ใจ/กาย ≥72 รับ +5..+10 OVR ชั่วคราว)
                          </span>
                        )}
                        {isMgr && (
                          <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                            · ดูแลทีม {quota.remaining}/{quota.limit}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {isMgr && incomingOffers.length > 0 && (
                  <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/60 flex items-center justify-between gap-2 text-xs mland:text-[10.5px]">
                    <span className="font-semibold truncate">
                      💼 มี <b className="tabular">{incomingOffers.length}</b> ข้อเสนอซื้อ/ขอยืมนักเตะรอเจรจาในตลาดซื้อขาย
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
                        ? 'grid grid-cols-[24px_minmax(0,1.45fr)_54px_62px_96px] sm:grid-cols-[26px_minmax(0,1.6fr)_32px_64px_74px_74px_124px] lg:grid-cols-[28px_minmax(0,1.65fr)_34px_68px_74px_72px_82px_136px] mland:grid-cols-[24px_minmax(0,1.5fr)_28px_56px_64px_66px_112px] items-center gap-1 sm:gap-1.5 mland:gap-1 px-2 sm:px-2.5 mland:px-2 py-1.5 mland:py-1 text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 border-b border-[var(--line)]'
                        : 'grid grid-cols-[minmax(0,1.7fr)_34px_66px_74px_72px_90px] mland:grid-cols-[minmax(0,1.7fr)_28px_56px_64px_60px_78px] items-center gap-1.5 mland:gap-1 px-2.5 mland:px-2 py-1.5 mland:py-1 text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 border-b border-[var(--line)]'
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
                    <div className="flex items-center justify-start min-w-0">
                      <SortableColHeader
                        label="นักเตะ"
                        active={squadSort === 'pos'}
                        dir={squadSortDir}
                        onClick={() => toggleSquadSort('pos')}
                        align="left"
                        title="เรียงตามตำแหน่ง (GK → DF → MF → FW)"
                      />
                    </div>
                    <div className={`flex items-center justify-center ${isMgr ? 'hidden sm:flex mland:flex' : ''}`}>
                      <SortableColHeader
                        label="อายุ"
                        active={squadSort === 'age'}
                        dir={squadSortDir}
                        onClick={() => toggleSquadSort('age')}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <SortableColHeader
                        label="ฟอร์ม"
                        active={squadSort === 'form'}
                        dir={squadSortDir}
                        onClick={() => toggleSquadSort('form')}
                        className="hidden sm:inline-flex mland:inline-flex"
                      />
                      <SortableColHeader
                        label="OVR"
                        active={squadSort === 'ov'}
                        dir={squadSortDir}
                        onClick={() => toggleSquadSort('ov')}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <SortableColHeader
                        label="สถานะ/ฟิต"
                        active={squadSort === 'fit'}
                        dir={squadSortDir}
                        onClick={() => toggleSquadSort('fit')}
                      />
                    </div>
                    <div className={`flex items-center justify-center ${isMgr ? 'hidden lg:flex mland:hidden' : ''}`}>
                      <SortableColHeader
                        label="ผลงาน"
                        active={squadSort === 'goals'}
                        dir={squadSortDir}
                        onClick={() => toggleSquadSort('goals')}
                      />
                    </div>
                    <div className={`flex items-center justify-end ${isMgr ? 'hidden sm:flex mland:flex' : ''}`}>
                      <SortableColHeader
                        label="ค่าเหนื่อย / ค่าตัว"
                        active={squadSort === 'val'}
                        dir={squadSortDir}
                        onClick={() => toggleSquadSort('val')}
                        align="right"
                      />
                    </div>
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
                      const isFav = isTeamFavoritePlayer(me, q.n);
                      const favCp = isMe ? state.p : null;
                      const favBoost = getActiveFavBoost(q, me, favCp);
                      const mScore = getPlayerMentalScore(q, favCp);
                      const pScore = getPlayerPhysScore(q, favCp);
                      const mMeta = getWellbeingTierMeta(mScore, 'mental', false);
                      const pMeta = getWellbeingTierMeta(pScore, 'phys', q.inj > 0);
                      const formTrend = formTrendByName.get(q.n) || getPlayerFormTrend(q, me, state, recentRatingsMap);

                      return (
                        <div
                          key={q.n}
                          className={`px-2 sm:px-2.5 mland:px-2 py-1.5 mland:py-1 items-center gap-1 sm:gap-1.5 mland:gap-1 transition-colors ${
                            isMgr
                              ? 'grid grid-cols-[24px_minmax(0,1.45fr)_54px_62px_96px] sm:grid-cols-[26px_minmax(0,1.6fr)_32px_64px_74px_74px_124px] lg:grid-cols-[28px_minmax(0,1.65fr)_34px_68px_74px_72px_82px_136px] mland:grid-cols-[24px_minmax(0,1.5fr)_28px_56px_64px_66px_112px]'
                              : 'grid grid-cols-[minmax(0,1.7fr)_34px_66px_74px_72px_90px] mland:grid-cols-[minmax(0,1.7fr)_28px_56px_64px_60px_78px]'
                          } ${
                            isSelected
                              ? 'bg-[var(--g-soft)]/55'
                              : unavailable
                                ? 'bg-rose-500/[0.05] hover:bg-rose-500/[0.09]'
                                : isFav && favBoost > 0
                                  ? 'bg-rose-500/[0.06] hover:bg-rose-500/[0.1]'
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
                                {isFav && (
                                  <span
                                    title={favBoost > 0 ? `ลูกรักประจำทีม (+${favBoost} OVR ชั่วคราว)` : 'ลูกรักประจำทีม (รอใจ/กาย ≥72)'}
                                    className={`inline-flex items-center text-[10px] mland:text-[8.5px] font-extrabold leading-none tabular shrink-0 ${
                                      favBoost > 0
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-rose-500/80 dark:text-rose-400/80'
                                    }`}
                                  >
                                    {favBoost > 0 ? `💖+${favBoost}` : '💖'}
                                  </span>
                                )}
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
                                <span className={`shrink-0 ${isStarter ? 'text-[var(--g)] font-bold' : ''}`}>
                                  {isStarter ? 'ตัวจริง' : 'สำรอง'}
                                </span>
                                <span
                                  className="inline-flex items-center gap-1 px-1 py-[0.5px] rounded bg-[var(--surface-2)]/80 border border-[var(--line)]/80 text-[9px] mland:text-[7.5px] font-bold shrink-0"
                                  title={`สุขภาพจิตใจ ${mScore}/100 (${mMeta.label}) · สุขภาพกาย ${pScore}/100 (${pMeta.label})`}
                                >
                                  <span className={mMeta.txtCls}>🧠{mScore}</span>
                                  <span className={pMeta.txtCls}>💪{pScore}</span>
                                </span>
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
                            <FormTrendBadge trend={formTrend} size="xs" />
                            <OvrBadge
                              ov={q.ov + favBoost}
                              boost={favBoost}
                              size="sm"
                              title={favBoost > 0 ? `OVR พื้นฐาน ${q.ov} + ลูกรัก ${favBoost} = ${q.ov + favBoost}` : undefined}
                            />
                            {favBoost > 0 ? (
                              <span
                                title={`รวมโบนัสลูกรัก +${favBoost} (จากพื้นฐาน ${q.ov})`}
                                className="text-[9.5px] mland:text-[8px] font-black text-rose-600 dark:text-rose-400 tabular"
                              >
                                (+{favBoost})
                              </span>
                            ) : (
                              <span className="text-[9px] mland:text-[8px] text-[var(--mut)] tabular hidden sm:inline mland:inline">/{q.pot || q.ov}</span>
                            )}
                          </div>

                          <div className="flex items-center justify-center min-w-0">
                            <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
                          </div>

                          <div className={`text-center text-[10.5px] mland:text-[9px] tabular text-[var(--mut)] items-center justify-center gap-1 ${isMgr ? 'hidden lg:flex mland:hidden' : 'flex'}`}>
                            {q.sg || q.sa || q.cs || q.sp || q.ap || formTrend.avgRt != null ? (
                              <span className="inline-flex items-center gap-1">
                                {formTrend.avgRt != null ? (
                                  <span
                                    className={`font-extrabold ${formTrend.avgRt >= 7.1 ? 'text-[var(--g)]' : formTrend.avgRt < 6.3 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}
                                    title={`เรตติ้งเฉลี่ย ${formTrend.avgRt.toFixed(2)}`}
                                  >
                                    {formTrend.avgRt.toFixed(1)}
                                  </span>
                                ) : q.sp || q.ap ? (
                                  <span className="font-semibold text-[var(--ink)]">{q.sp || q.ap}น</span>
                                ) : null}
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

