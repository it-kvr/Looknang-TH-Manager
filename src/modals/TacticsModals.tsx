import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SubRole, CustomSlot, Team } from '../types/game';
import { FSD, LINE, SPN, ROLE_HINT, POSL } from '../data/thaiFootballData';
import { PITCH_SVG_BASE } from '../components/SvgVisuals';
import { PositionBadge, getPositionBadgeClass } from '../components/PositionBadge';
import { clamp } from '../utils/math';

export const CustomFormationModal: React.FC<{
  team: Team;
  kitColor: string;
  onClose: () => void;
  onSave: (cf: CustomSlot[]) => void;
}> = ({ team, kitColor, onClose, onSave }) => {
  const initial = (team.form === 'custom' && team.cf ? team.cf : FSD[team.form] || FSD['4-4-2']).map(
    (z) => [z[0], z[1], z[2]] as CustomSlot
  );
  const [slots, setSlots] = useState<CustomSlot[]>(initial);
  const [selIdx, setSelIdx] = useState(1);
  const [dragIdx, setDragIdx] = useState(-1);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const dragStateRef = useRef<{
    idx: number;
    pointerId: number;
    isTouch: boolean;
    startX: number;
    startY: number;
    grabDxSvg: number;
    grabDySvg: number;
    cachedRect: DOMRect | null;
    cachedInvCtm: DOMMatrix | null;
    curRole: SubRole;
    curNx: number;
    curNy: number;
    curGx: number;
    curGy: number;
    fpx: number;
    fpy: number;
    showTether: boolean;
    rafId: number | null;
    latestX: number;
    latestY: number;
  } | null>(null);

  const autoRole = (x: number, y: number): SubRole => {
    const L = x < 22;
    const R_ = x > 78;
    if (y >= 70) return L ? 'LB' : R_ ? 'RB' : x < 47 ? 'LCB' : x > 53 ? 'RCB' : 'CB';
    if (y >= 58) return L ? 'LWB' : R_ ? 'RWB' : x < 45 ? 'LDM' : x > 55 ? 'RDM' : 'CDM';
    if (y >= 42) return L ? 'LM' : R_ ? 'RM' : x < 45 ? 'LCM' : x > 55 ? 'RCM' : 'CM';
    if (y >= 30) return L ? 'LM' : R_ ? 'RM' : 'CAM';
    return x < 26 ? 'LW' : x > 74 ? 'RW' : y > 20 ? 'CF' : x < 46 ? 'LS' : x > 54 ? 'RS' : 'ST';
  };

  const countPos = (p: string) => slots.filter((z) => LINE[z[0]] === p).length;

  const clientToSvg = (
    clientX: number,
    clientY: number,
    cachedRect?: DOMRect | null,
    cachedInvCtm?: DOMMatrix | null
  ): { px: number; py: number; rect: DOMRect } | null => {
    const svg = svgRef.current;
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
    if (invCtm) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const inv = pt.matrixTransform(invCtm);
      return { px: inv.x, py: inv.y, rect };
    }
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    return {
      px: ((clientX - rect.left) / w) * 300,
      py: ((clientY - rect.top) / h) * 380,
      rect
    };
  };

  const syncCustomDragDom = () => {
    const svg = svgRef.current;
    const ds = dragStateRef.current;
    if (!svg || !ds) return;
    const grp = svg.querySelector<SVGGElement>(`[data-custom-slot="${ds.idx}"]`);
    if (grp) {
      grp.setAttribute('transform', `translate(${ds.curGx.toFixed(2)},${ds.curGy.toFixed(2)})`);
      const lbl = grp.querySelector<SVGTextElement>('text');
      if (lbl && lbl.textContent !== ds.curRole) {
        lbl.textContent = ds.curRole;
      }
    }
    const tether = svg.querySelector<SVGLineElement>('[data-custom-tether="1"]');
    if (tether) {
      tether.setAttribute('x1', ds.fpx.toFixed(2));
      tether.setAttribute('y1', ds.fpy.toFixed(2));
      tether.setAttribute('x2', ds.curGx.toFixed(2));
      tether.setAttribute('y2', ds.curGy.toFixed(2));
      tether.setAttribute('opacity', ds.showTether ? '0.9' : '0');
    }
    const finger = svg.querySelector<SVGCircleElement>('[data-custom-finger="1"]');
    if (finger) {
      finger.setAttribute('cx', ds.fpx.toFixed(2));
      finger.setAttribute('cy', ds.fpy.toFixed(2));
      finger.setAttribute('opacity', ds.showTether ? '1' : '0');
    }
  };

  useLayoutEffect(() => {
    if (dragIdx > 0) syncCustomDragDom();
  }, [dragIdx, slots]);

  useEffect(() => () => {
    if (dragStateRef.current?.rafId != null) {
      window.cancelAnimationFrame(dragStateRef.current.rafId);
    }
  }, []);

  const processDragFrame = (clientX: number, clientY: number) => {
    const ds = dragStateRef.current;
    if (!ds) return;
    const dist = Math.hypot(clientX - ds.startX, clientY - ds.startY);
    const pitchH = ds.cachedRect?.height || svgRef.current?.getBoundingClientRect().height || 260;
    const targetLift = ds.isTouch ? clamp(pitchH * 0.085, 16, 26) : 0;
    const liftRamp = ds.isTouch ? clamp(dist / 24, 0, 1) : 1;
    const liftPx = targetLift * liftRamp;

    const rawPt = clientToSvg(clientX, clientY, ds.cachedRect, ds.cachedInvCtm);
    const liftPt = clientToSvg(clientX, clientY - liftPx, ds.cachedRect, ds.cachedInvCtm);
    if (!rawPt || !liftPt) return;

    const grabFade = 1 - liftRamp * 0.55;
    const adjPx = liftPt.px + ds.grabDxSvg * grabFade;
    const adjPy = liftPt.py + ds.grabDySvg * grabFade;

    const rawNx = clamp((adjPx - 18) / 2.64, 3, 97);
    const rawNy = clamp((adjPy - 16) / 3.48, 8, 86);
    const gx = 18 + rawNx * 2.64;
    const gy = 16 + rawNy * 3.48;
    const nx = Math.round(rawNx);
    const ny = Math.round(rawNy);
    const nextRole = autoRole(nx, ny);
    const fpx = clamp(rawPt.px, 8, 292);
    const fpy = clamp(rawPt.py, 8, 372);
    const roleChanged = nextRole !== ds.curRole;

    ds.curNx = nx;
    ds.curNy = ny;
    ds.curGx = gx;
    ds.curGy = gy;
    ds.curRole = nextRole;
    ds.fpx = fpx;
    ds.fpy = fpy;
    ds.showTether = ds.isTouch && Math.hypot(fpx - gx, fpy - gy) > 8;

    syncCustomDragDom();
    if (roleChanged) {
      setSlots((prev) => prev.map((z, idx) => (idx === ds.idx ? [nextRole, nx, ny] : z)));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const ds = dragStateRef.current;
    if (!ds || e.pointerId !== ds.pointerId) return;
    ds.latestX = e.clientX;
    ds.latestY = e.clientY;
    if (ds.rafId === null) {
      ds.rafId = window.requestAnimationFrame(() => {
        if (!dragStateRef.current) return;
        dragStateRef.current.rafId = null;
        processDragFrame(dragStateRef.current.latestX, dragStateRef.current.latestY);
      });
    }
  };

  const finishDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const ds = dragStateRef.current;
    if (!ds || e.pointerId !== ds.pointerId) return;
    if (ds.rafId !== null) {
      window.cancelAnimationFrame(ds.rafId);
      ds.rafId = null;
      processDragFrame(e.clientX, e.clientY);
    }
    const { idx, curRole, curNx, curNy } = ds;
    dragStateRef.current = null;
    setDragIdx(-1);
    setSlots((prev) => prev.map((z, i) => (i === idx ? [curRole, curNx, curNy] : z)));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-3xl h-[calc(var(--app-dvh,1dvh)*90)] max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-w-[96vw] mland:h-[calc(var(--app-dvh,1dvh)*96)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 mland:px-3 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <div>
            <h3 className="font-bold text-sm sm:text-base mland:text-xs">✏️ ปรับผังแผนเอง ({countPos('DF')}-{countPos('MF')}-{countPos('FW')})</h3>
            <p className="text-[11px] mland:text-[10px] text-[var(--mut)]">ลากวงกลมในสนามเพื่อวางตำแหน่ง หรือแตะเลือกตำแหน่งด้านข้าง</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 mland:w-7 mland:h-7 rounded-full bg-[var(--surface)] font-bold cursor-pointer shrink-0">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-3 mland:p-2 grid grid-cols-[245px_1fr] mland:grid-cols-[205px_1fr] gap-3.5 mland:gap-2.5 items-stretch">
          <div className="flex flex-col items-center justify-center h-full min-h-0">
            <svg
              ref={svgRef}
              viewBox="0 0 300 380"
              style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
              className="h-full max-h-[300px] mland:max-h-[210px] w-auto max-w-full mx-auto rounded-xl select-none touch-none border border-[var(--line)]"
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onContextMenu={(e) => e.preventDefault()}
            >
              <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />
              {dragIdx > 0 && (
                <g className="pointer-events-none">
                  <line
                    data-custom-tether="1"
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={0}
                    stroke="#fde047"
                    strokeWidth="1.6"
                    strokeDasharray="3.5 2.5"
                    opacity="0"
                  />
                  <circle
                    data-custom-finger="1"
                    cx={0}
                    cy={0}
                    r="6"
                    fill="rgba(255,255,255,0.2)"
                    stroke="#fff"
                    strokeWidth="1.2"
                    opacity="0"
                  />
                </g>
              )}
              {slots.map((z, i) => {
                const cx = 18 + z[1] * 2.64;
                const cy = 16 + z[2] * 3.48;
                return (
                  <g
                    key={i}
                    data-custom-slot={i}
                    transform={`translate(${cx},${cy})`}
                    onPointerDown={(e) => {
                      if (i === 0) return;
                      e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                      const svg = svgRef.current;
                      const cachedRect = svg?.getBoundingClientRect() ?? null;
                      let cachedInvCtm: DOMMatrix | null = null;
                      try {
                        const ctm = svg?.getScreenCTM?.();
                        if (ctm) cachedInvCtm = ctm.inverse();
                      } catch {
                        cachedInvCtm = null;
                      }
                      const startPt = clientToSvg(e.clientX, e.clientY, cachedRect, cachedInvCtm);
                      const grabDxSvg = startPt ? clamp(cx - startPt.px, -16, 16) : 0;
                      const grabDySvg = startPt ? clamp(cy - startPt.py, -16, 16) : 0;
                      dragStateRef.current = {
                        idx: i,
                        pointerId: e.pointerId,
                        isTouch: e.pointerType !== 'mouse',
                        startX: e.clientX,
                        startY: e.clientY,
                        grabDxSvg,
                        grabDySvg,
                        cachedRect,
                        cachedInvCtm,
                        curRole: z[0],
                        curNx: z[1],
                        curNy: z[2],
                        curGx: cx,
                        curGy: cy,
                        fpx: startPt ? clamp(startPt.px, 8, 292) : cx,
                        fpy: startPt ? clamp(startPt.py, 8, 372) : cy,
                        showTether: false,
                        rafId: null,
                        latestX: e.clientX,
                        latestY: e.clientY
                      };
                      setDragIdx(i);
                      setSelIdx(i);
                    }}
                    className={i ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
                  >
                    <circle r={22} fill="transparent" />
                    <circle r={i === selIdx ? 18 : 15} fill={kitColor} stroke={i === selIdx ? '#f5c242' : '#fff'} strokeWidth={3} />
                    <text y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" className="pointer-events-none">{z[0]}</text>
                  </g>
                );
              })}
            </svg>
            {countPos('DF') < 3 && <p className="text-xs text-[var(--red)] mt-1 text-center">⚠️ กองหลังน้อยกว่า 3 คน เกมรับจะเปราะบาง</p>}
            {countPos('FW') < 1 && <p className="text-xs text-[var(--red)] mt-1 text-center">⚠️ ไม่มีกองหน้าตัวเป้าเลย</p>}
          </div>

          <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-1">
            <div>
              <div className="text-xs font-bold mb-1 flex items-center gap-1.5 flex-wrap">
                <span>บทบาทของตำแหน่งที่เลือก:</span>
                {slots[selIdx]?.[0] && <PositionBadge role={slots[selIdx][0]} size="sm" />}
                <span className="text-[var(--mut)] font-semibold">{SPN[slots[selIdx]?.[0]] || ''}</span>
              </div>
              {ROLE_HINT[slots[selIdx]?.[0]] && (
                <p className="text-[11px] text-[var(--mut)] mb-1.5">💡 {ROLE_HINT[slots[selIdx]?.[0]]}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {POSL.map((p) => {
                  const isSel = slots[selIdx]?.[0] === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        if (selIdx <= 0) return;
                        setSlots((prev) => prev.map((z, idx) => (idx === selIdx ? [p, z[1], z[2]] : z)));
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        isSel
                          ? `${getPositionBadgeClass(p)} ring-2 ring-[#f5c242]`
                          : 'bg-[var(--surface-2)] hover:brightness-95 inline-flex items-center gap-1'
                      }`}
                    >
                      {!isSel && <span className={`w-2 h-2 rounded-full border border-black ${getPositionBadgeClass(p).split(' ')[0]}`} />}
                      <span>{p}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold mb-1.5">เริ่มจากเทมเพลตมาตรฐาน</div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(FSD).map((f) => (
                  <button key={f} type="button" onClick={() => { setSlots(FSD[f].map((z) => [z[0], z[1], z[2]])); setSelIdx(1); }} className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-xs font-semibold cursor-pointer">
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 py-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] font-semibold text-sm mland:text-xs cursor-pointer">ยกเลิก</button>
          <button type="button" onClick={() => onSave(slots)} className="flex-1 py-2 mland:py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-sm mland:text-xs cursor-pointer">✅ ใช้แผนนี้</button>
        </div>
      </div>
    </div>
  );
};


