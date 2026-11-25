import React, { useState } from 'react';
import type { GameState } from '../types/game';
import { fmtMoney } from '../utils/math';
import { SFX, vibrate } from '../utils/audioTheme';
import { ovMe } from '../engine/playerCore';
import {
  applySecretBoost,
  applySecretMoneyAdjust,
  applySecretPlayerBoost,
  applySecretRepAdjust
} from '../engine/blessings';

export const SecretBoostModal: React.FC<{
  state: GameState;
  onClose: () => void;
  onOpenGodBlessing?: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ state, onClose, onOpenGodBlessing, onUpdateState, onToast }) => {
  const isPlayerMode = state.mode === 'p' && !!state.p;
  const me = state.teams[state.me];
  const avgOv = me?.sq.length ? Math.round(me.sq.reduce((s, q) => s + q.ov, 0) / me.sq.length) : 60;
  const [customVal, setCustomVal] = useState('1000');
  const [unit, setUnit] = useState<'k' | 'm'>('k');
  const [customRep, setCustomRep] = useState('25');

  const runBoost = (
    kind: 'money500' | 'money2500' | 'money10000' | 'sub500' | 'sub2500' | 'sub10000' | 'stat5' | 'stat10' | 'healAll'
  ) => {
    if (kind === 'sub500' || kind === 'sub2500' || kind === 'sub10000') {
      SFX.tap();
      vibrate(20);
    } else {
      SFX.win();
      vibrate(35);
    }
    let msg = '';
    onUpdateState((d) => {
      msg = applySecretBoost(d, kind);
    });
    if (msg) onToast(msg);
  };

  const runPlayerBoost = (
    kind: 'rep15' | 'rep50' | 'repSub10' | 'talent10' | 'ageSub2' | 'unlockPerks'
  ) => {
    if (kind === 'repSub10') {
      SFX.tap();
      vibrate(20);
    } else {
      SFX.win();
      vibrate(35);
    }
    let msg = '';
    onUpdateState((d) => {
      msg = applySecretPlayerBoost(d, kind);
    });
    if (msg) onToast(msg);
  };

  const parsedAmountK = (() => {
    const raw = Number(customVal);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.round(unit === 'm' ? raw * 1000 : raw);
  })();

  const runCustomMoney = (mode: 'add' | 'sub' | 'set', overrideK?: number) => {
    const amtK = overrideK !== undefined ? overrideK : parsedAmountK;
    if (mode !== 'set' && amtK <= 0) {
      onToast('กรุณากรอกจำนวนเงินที่ต้องการ');
      return;
    }
    if (mode === 'add') {
      SFX.win();
      vibrate(30);
    } else {
      SFX.tap();
      vibrate(20);
    }
    let msg = '';
    onUpdateState((d) => {
      msg = applySecretMoneyAdjust(d, mode, amtK);
    });
    if (msg) onToast(msg);
  };

  const parsedRep = (() => {
    const raw = Number(customRep);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.round(raw);
  })();

  const runCustomRep = (mode: 'add' | 'sub' | 'set', overrideAmt?: number) => {
    const amt = overrideAmt !== undefined ? overrideAmt : parsedRep;
    if (mode !== 'set' && amt <= 0) {
      onToast('กรุณากรอกจำนวนชื่อเสียงที่ต้องการ');
      return;
    }
    if (mode === 'add') {
      SFX.win();
      vibrate(30);
    } else {
      SFX.tap();
      vibrate(20);
    }
    let msg = '';
    onUpdateState((d) => {
      msg = applySecretRepAdjust(d, mode, amt);
    });
    if (msg) onToast(msg);
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-2xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--lamp)]/50 flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 px-5 py-3 mland:px-3 mland:py-1.5 bg-[var(--lamp-soft)]/50 border-b border-[var(--lamp)]/30 flex items-center justify-between">
          <h3 className="font-bold text-base mland:text-xs font-display flex items-center gap-1.5">
            <span>👑</span>
            <span>{isPlayerMode ? 'โหมดลับนักเตะอาชีพ (VIP Boost)' : 'โหมดลับผู้สนับสนุน (VIP Boost)'}</span>
          </h3>
          <button type="button" onClick={onClose} className="w-8 h-8 mland:w-6 mland:h-6 rounded-full bg-[var(--surface)] border border-[var(--line)] mland:text-xs font-bold cursor-pointer">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-2.5 space-y-2.5 mland:space-y-1.5">
          {isPlayerMode && state.p ? (
            <>
              <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10.5px] tabular">
                <span>
                  นักเตะ: <b className="text-[var(--ink)]">{state.p.name}</b> · อายุ <b>{state.p.age}</b> ปี
                </span>
                <div className="flex items-center gap-3">
                  <span>ชื่อเสียง: <b className="text-[#9a6700] dark:text-[var(--lamp)]">★ {state.p.rep ?? 10}</b></span>
                  <span>พรสวรรค์: <b className="text-[var(--g)]">TL {state.p.talent ?? 78}</b></span>
                  <span>OVR: <b className="text-[var(--lamp)]">{ovMe(state.p)}</b></span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
                <button
                  type="button"
                  onClick={() => runPlayerBoost('rep15')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/45 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-[var(--lamp)]">⭐ ชื่อเสียง +15 ★</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ใช้ปลดสกิล & กายภาพ</div>
                </button>
                <button
                  type="button"
                  onClick={() => runPlayerBoost('rep50')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/45 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-amber-300">👑 ชื่อเสียง +50 ★</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ระดับซุปตาร์มหาชน</div>
                </button>
                <button
                  type="button"
                  onClick={() => runPlayerBoost('repSub10')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--red-soft)]/75 border border-[var(--red)]/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">📉 ลดชื่อเสียง -10 ★</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ปรับลดชื่อเสียงลง</div>
                </button>

                <button
                  type="button"
                  onClick={() => runPlayerBoost('talent10')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--g)]">🌟 พรสวรรค์ +10</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">เพิ่มโอกาสภารกิจ (ตัน 99)</div>
                </button>
                <button
                  type="button"
                  onClick={() => runPlayerBoost('ageSub2')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-teal-500/12 border border-teal-500/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-teal-700 dark:text-teal-300">⏳ ย้อนวัย -2 ปี</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ขยายช่วงพีค (ขั้นต่ำ 16)</div>
                </button>
                <button
                  type="button"
                  onClick={() => runPlayerBoost('unlockPerks')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-purple-500/12 border border-purple-500/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-purple-700 dark:text-purple-300">🔓 ปลดสกิลครบ</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ได้ Career Perks ทั้งหมด</div>
                </button>

                <button
                  type="button"
                  onClick={() => runBoost('healAll')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-sky-500/12 border border-sky-500/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-sky-700 dark:text-sky-300">🩺 ฟื้นฟูฟิต 100%</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ฟิตเต็ม · หายเจ็บ · ล้างแบน</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('stat5')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px]">⚡ เพิ่มพลัง +5</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ทุกค่าพลัง +5 & ฟิต 100%</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('stat10')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-orange-500/12 border border-orange-500/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-orange-700 dark:text-orange-300">🔥 เพิ่มพลัง +10</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ซูเปอร์สตาร์ +10 & ฟิตเต็ม</div>
                </button>
              </div>

              <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 mland:gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] whitespace-nowrap">กำหนดชื่อเสียง (★):</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    aria-label="จำนวนชื่อเสียงที่ต้องการปรับ"
                    value={customRep}
                    onChange={(e) => setCustomRep(e.target.value)}
                    className="w-20 mland:w-16 px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px] font-bold tabular text-right focus:outline-none focus:border-[var(--g)]"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => runCustomRep('sub')}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--red-soft)] border border-[var(--red)]/45 text-[var(--red)] text-xs mland:text-[10px] font-bold cursor-pointer hover:brightness-95"
                  >
                    − ลด {parsedRep > 0 ? `${parsedRep} ★` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomRep('add')}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer hover:brightness-105"
                  >
                    + เพิ่ม
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomRep('set', 10)}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--red)]/50 text-xs mland:text-[10px] font-bold cursor-pointer"
                  >
                    รีเซ็ต 10 ★
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between text-xs mland:text-[10.5px] tabular">
                <span>
                  งบสโมสรปัจจุบัน:{' '}
                  <b className={state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}>
                    {fmtMoney(state.money)}
                  </b>
                  {state.money < 0 && <span className="ml-1.5 text-[10px] text-[var(--red)] font-bold">(ติดลบ)</span>}
                </span>
                <span>OVR เฉลี่ยทีม: <b className="text-[var(--lamp)]">{avgOv}</b></span>
              </div>

              <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
                <button
                  type="button"
                  onClick={() => runBoost('money500')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--g)]">💰 เติมเงิน +500k ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">งบเสริมทัพ &amp; บริหารทีม</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('money2500')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-[var(--lamp)]">💎 เติมเงิน +2.5m ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">งบมหาเศรษฐีทุ่มตลาด</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('money10000')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/45 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-amber-300">🏦 เติมเงิน +10m ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">เทคโอเวอร์ระดับลีกสูงสุด</div>
                </button>

                <button
                  type="button"
                  onClick={() => runBoost('sub500')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--red-soft)]/70 border border-[var(--red)]/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">💸 ลดเงิน -500k ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">หักงบสโมสรลง 500k</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('sub2500')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--red-soft)]/85 border border-[var(--red)]/45 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">📉 ลดเงิน -2.5m ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ปรับงบลดลง 2.5 ล้าน</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('sub10000')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/55 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">🔻 ลดเงิน -10m ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ดึงงบออก 10 ล้าน</div>
                </button>

                <button
                  type="button"
                  onClick={() => runBoost('healAll')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-sky-500/12 border border-sky-500/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-sky-700 dark:text-sky-300">🩺 ฟื้นฟูทีม 100%</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ฟิตเต็ม · หายเจ็บ · ล้างโทษแบน</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('stat5')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px]">⚡ เพิ่มพลัง +5</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ทั้งทีม +5 OVR &amp; ฟิต 100%</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('stat10')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-orange-500/12 border border-orange-500/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-orange-700 dark:text-orange-300">🔥 เพิ่มพลัง +10</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ระดับแชมป์ +10 OVR &amp; หายเจ็บ</div>
                </button>
              </div>

              {/* Custom Money Adjust Bar */}
              <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 mland:gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] whitespace-nowrap">กำหนดยอดเอง:</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    aria-label="จำนวนเงินที่ต้องการปรับ"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)}
                    className="w-24 mland:w-20 px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px] font-bold tabular text-right focus:outline-none focus:border-[var(--g)]"
                  />
                  <div className="flex items-center p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setUnit('k');
                      }}
                      className={`px-2 py-0.5 rounded text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer ${unit === 'k' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}
                    >
                      พัน (k)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setUnit('m');
                      }}
                      className={`px-2 py-0.5 rounded text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer ${unit === 'm' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}
                    >
                      ล้าน (m)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => runCustomMoney('sub')}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--red-soft)] border border-[var(--red)]/45 text-[var(--red)] text-xs mland:text-[10px] font-bold cursor-pointer hover:brightness-95"
                  >
                    − ลด {parsedAmountK > 0 ? fmtMoney(parsedAmountK) : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomMoney('add')}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer hover:brightness-105"
                  >
                    + เพิ่ม
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomMoney('set', 0)}
                    title="ตั้งงบสโมสรกลับเป็น 0 ฿"
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--red)]/50 text-xs mland:text-[10px] font-bold cursor-pointer"
                  >
                    รีเซ็ต 0 ฿
                  </button>
                </div>
              </div>
            </>
          )}

          {onOpenGodBlessing && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
                onOpenGodBlessing();
              }}
              className="w-full p-2.5 mland:p-1.5 rounded-xl bg-gradient-to-r from-[#fad05a] to-[#eab308] text-[#261900] border border-[#ca8a04]/40 text-xs mland:text-[10.5px] font-extrabold text-center cursor-pointer shadow-sm hover:brightness-105"
            >
              ✨ พรของพระเจ้า · ปรับแต่งค่าพลังนักเตะแต่ละคนได้เอง
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

