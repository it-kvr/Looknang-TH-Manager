import React, { useState } from 'react';
import type { SubRole, Player, CustomSlot, Team, GameState } from '../types/game';
import { FSD, LINE, SPN, ROLE_HINT, POSL } from '../data/thaiFootballData';
import { fmtMoney, fmtMoneyNum } from '../utils/math';
import { vlu, ensureCon } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import { PlayerFace, PITCH_SVG_BASE } from '../components/SvgVisuals';

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
  const [dragIsTouch, setDragIsTouch] = useState(false);
  const [fingerSvgPt, setFingerSvgPt] = useState<{ px: number; py: number } | null>(null);

  const autoRole = (x: number, y: number): SubRole => {
    const L = x < 22;
    const R_ = x > 78;
    if (y >= 70) return L ? 'LB' : R_ ? 'RB' : 'CB';
    if (y >= 58) return L ? 'LWB' : R_ ? 'RWB' : x < 45 ? 'LDM' : x > 55 ? 'RDM' : 'CDM';
    if (y >= 42) return L ? 'LM' : R_ ? 'RM' : x < 45 ? 'LCM' : x > 55 ? 'RCM' : 'CM';
    if (y >= 30) return L ? 'LM' : R_ ? 'RM' : 'CAM';
    return x < 26 ? 'LW' : x > 74 ? 'RW' : y > 20 ? 'CF' : 'ST';
  };

  const countPos = (p: string) => slots.filter((z) => LINE[z[0]] === p).length;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragIdx < 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isTouch = e.pointerType !== 'mouse' || dragIsTouch;
    const rawPx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 300;
    const rawPy = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 340;
    const liftClientY = isTouch ? e.clientY - 38 : e.clientY;
    const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 300;
    const py = ((liftClientY - rect.top) / Math.max(1, rect.height)) * 340;
    const nx = Math.max(3, Math.min(97, Math.round((px - 18) / 2.64)));
    const ny = Math.max(8, Math.min(86, Math.round((py - 24) / 2.9)));
    if (isTouch) setFingerSvgPt({ px: Math.max(8, Math.min(292, rawPx)), py: Math.max(8, Math.min(332, rawPy)) });
    setSlots((prev) => prev.map((z, idx) => (idx === dragIdx ? [autoRole(nx, ny), nx, ny] : z)));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-3xl h-[90dvh] max-h-[92dvh] mland:max-w-[96vw] mland:h-[96dvh] mland:max-h-[96dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
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
              viewBox="0 0 300 340"
              className="h-full max-h-[300px] mland:max-h-[210px] w-auto max-w-full mx-auto rounded-xl select-none touch-none border border-[var(--line)]"
              onPointerMove={handlePointerMove}
              onPointerUp={() => { setDragIdx(-1); setDragIsTouch(false); setFingerSvgPt(null); }}
              onPointerCancel={() => { setDragIdx(-1); setDragIsTouch(false); setFingerSvgPt(null); }}
            >
              <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />
              {dragIdx > 0 && fingerSvgPt && slots[dragIdx] && (() => {
                const tx = 18 + slots[dragIdx][1] * 2.64;
                const ty = 24 + slots[dragIdx][2] * 2.9;
                return (
                  <g className="pointer-events-none">
                    <line x1={fingerSvgPt.px} y1={fingerSvgPt.py} x2={tx} y2={ty} stroke="#fde047" strokeWidth="1.6" strokeDasharray="3.5 2.5" />
                    <circle cx={fingerSvgPt.px} cy={fingerSvgPt.py} r="6" fill="rgba(255,255,255,0.2)" stroke="#fff" strokeWidth="1.2" />
                  </g>
                );
              })()}
              {slots.map((z, i) => {
                const cx = 18 + z[1] * 2.64;
                const cy = 24 + z[2] * 2.9;
                return (
                  <g
                    key={i}
                    transform={`translate(${cx},${cy})`}
                    onPointerDown={(e) => {
                      if (i === 0) return;
                      e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                      setDragIdx(i);
                      setDragIsTouch(e.pointerType !== 'mouse');
                      setSelIdx(i);
                    }}
                    className={i ? 'cursor-grab' : 'cursor-default'}
                  >
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
              <div className="text-xs font-bold mb-1">บทบาทของตำแหน่งที่เลือก: <span className="text-[var(--g)]">{slots[selIdx]?.[0]} · {SPN[slots[selIdx]?.[0]] || ''}</span></div>
              {ROLE_HINT[slots[selIdx]?.[0]] && (
                <p className="text-[11px] text-[var(--mut)] mb-1.5">💡 {ROLE_HINT[slots[selIdx]?.[0]]}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {POSL.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      if (selIdx <= 0) return;
                      setSlots((prev) => prev.map((z, idx) => (idx === selIdx ? [p, z[1], z[2]] : z)));
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer ${slots[selIdx]?.[0] === p ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                  >
                    {p}
                  </button>
                ))}
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

export const PitchPlayerModal: React.FC<{
  state: GameState;
  player: Player;
  onClose: () => void;
  onConfirm: (askPct: number) => void;
}> = ({ state, player, onClose, onConfirm }) => {
  const me = state.teams[state.me];
  const baseVal = Math.max(5, vlu(player));
  const [askPct, setAskPct] = useState<85 | 100 | 118>(100);
  const askAmt = Math.max(5, Math.round((baseVal * askPct) / 100));
  const options: { pct: 85 | 100 | 118; title: string; hint: string }[] = [
    { pct: 85, title: 'ขายด่วน (85%)', hint: 'โอกาสมีสโมสรยื่นข้อเสนอสูง รีบปล่อยตัว' },
    { pct: 100, title: 'ราคาตลาด (100%)', hint: 'สมดุลระหว่างค่าตัวกับความสนใจของสโมสรอื่น' },
    { pct: 118, title: 'ตั้งราคาสูง (118%)', hint: 'ได้ราคาดีหากมีทีมต้องการ แต่บางทีมอาจไม่ยื่น' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-2xl max-h-[94dvh] flex flex-col rounded-2xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden shadow-2xl">
        <div className="shrink-0 flex items-center gap-3 p-3 mland:p-2.5 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <PlayerFace player={player} team={me} state={state} size={44} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm mland:text-xs truncate">
              เสนอขาย {player.n} <span className="text-xs text-[var(--g)]">({player.ro})</span>
            </div>
            <div className="text-[11px] text-[var(--mut)]">
              อายุ {player.age} ปี · ประเมินตลาด {fmtMoney(baseVal)} · ค่าเหนื่อย {fmtMoneyNum(ensureCon(player).wg)}/นัด
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-white font-bold text-sm tabular shrink-0" style={{ background: ovColor(player.ov) }}>
            {player.ov}
          </span>
        </div>

        <div className="p-3.5 mland:p-2.5 flex-1 min-h-0 overflow-y-auto grid grid-cols-[0.85fr_1.15fr] gap-3.5 mland:gap-2.5 items-start">
          <div className="space-y-2.5">
            <p className="text-xs mland:text-[11px] text-[var(--mut)] leading-relaxed mland:leading-snug">
              ระบบจะขึ้นบัญชีขาย <b>{player.n}</b> ในตลาดและส่งโปรไฟล์ให้สโมสรในระดับใกล้เคียงพิจารณา สโมสรที่สนใจจะยื่นข้อเสนอเข้ามาให้คุณกดตอบรับหรือโก่งราคา
            </p>
            <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between text-xs tabular">
              <span className="text-[var(--mut)]">ราคาเสนอขาย</span>
              <b className="text-sm text-[var(--g)]">~{fmtMoney(askAmt)}</b>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => onConfirm(askPct)}
                className="flex-1 py-2 mland:py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold cursor-pointer"
              >
                📨 เสนอขาย
              </button>
            </div>
          </div>

          <div className="space-y-2 mland:space-y-1.5">
            {options.map((opt) => {
              const price = Math.max(5, Math.round((baseVal * opt.pct) / 100));
              const active = askPct === opt.pct;
              return (
                <button
                  key={opt.pct}
                  type="button"
                  onClick={() => setAskPct(opt.pct)}
                  className={`w-full text-left p-2.5 mland:p-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    active ? 'border-[var(--g)] bg-[var(--g-soft)]' : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--mut)]'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">{opt.title}</div>
                    <div className="text-[11px] text-[var(--mut)]">{opt.hint}</div>
                  </div>
                  <div className="font-bold text-sm tabular shrink-0 text-[var(--g)]">{fmtMoney(price)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

