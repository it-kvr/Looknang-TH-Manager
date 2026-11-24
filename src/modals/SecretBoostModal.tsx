import React from 'react';
import type { GameState } from '../types/game';
import { fmtMoney } from '../utils/math';
import { SFX, vibrate } from '../utils/audioTheme';
import { ovMe } from '../engine/playerCore';
import { applySecretBoost } from '../engine/blessings';

export const SecretBoostModal: React.FC<{
  state: GameState;
  onClose: () => void;
  onOpenGodBlessing?: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ state, onClose, onOpenGodBlessing, onUpdateState, onToast }) => {
  const me = state.teams[state.me];
  const avgOv = me?.sq.length ? Math.round(me.sq.reduce((s, q) => s + q.ov, 0) / me.sq.length) : 60;
  const runBoost = (kind: 'money500' | 'money2500' | 'money10000' | 'stat5' | 'stat10' | 'healAll') => {
    SFX.win();
    vibrate(35);
    let msg = '';
    onUpdateState((d) => {
      msg = applySecretBoost(d, kind);
    });
    if (msg) onToast(msg);
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-2xl max-h-[92dvh] mland:max-h-[95dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--lamp)]/50 flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 px-5 py-3 mland:px-3 mland:py-1.5 bg-[var(--lamp-soft)]/50 border-b border-[var(--lamp)]/30 flex items-center justify-between">
          <h3 className="font-bold text-base mland:text-xs font-display flex items-center gap-1.5">
            <span>👑</span>
            <span>โหมดลับผู้สนับสนุน (VIP Boost)</span>
          </h3>
          <button type="button" onClick={onClose} className="w-8 h-8 mland:w-6 mland:h-6 rounded-full bg-[var(--surface)] border border-[var(--line)] mland:text-xs font-bold cursor-pointer">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-2.5 space-y-3 mland:space-y-2">
          <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between text-xs mland:text-[10.5px] tabular">
            <span>งบสโมสรปัจจุบัน: <b className="text-[var(--g)]">{fmtMoney(state.money)}</b></span>
            {state.mode === 'p' && state.p ? (
              <span>OVR คุณ: <b className="text-[var(--lamp)]">{ovMe(state.p)}</b> · ฟิต {state.p.en}%</span>
            ) : (
              <span>OVR เฉลี่ยทีม: <b className="text-[var(--lamp)]">{avgOv}</b></span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
            <button
              type="button"
              onClick={() => runBoost('money500')}
              className="p-3 mland:p-2 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 hover:brightness-105 text-left cursor-pointer"
            >
              <div className="font-bold text-xs mland:text-[10.5px] text-[var(--g)]">💰 เติมเงิน +500k ฿</div>
              <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">งบเสริมทัพ &amp; บริหารทีม</div>
            </button>
            <button
              type="button"
              onClick={() => runBoost('money2500')}
              className="p-3 mland:p-2 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 hover:brightness-105 text-left cursor-pointer"
            >
              <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-[var(--lamp)]">💎 เติมเงิน +2.5m ฿</div>
              <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">งบมหาเศรษฐีทุ่มตลาด</div>
            </button>
            <button
              type="button"
              onClick={() => runBoost('money10000')}
              className="p-3 mland:p-2 rounded-xl bg-amber-500/15 border border-amber-500/45 hover:brightness-105 text-left cursor-pointer"
            >
              <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-amber-300">🏦 เติมเงิน +10m ฿</div>
              <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">เทคโอเวอร์ระดับลีกสูงสุด</div>
            </button>
            <button
              type="button"
              onClick={() => runBoost('healAll')}
              className="p-3 mland:p-2 rounded-xl bg-sky-500/12 border border-sky-500/35 hover:brightness-105 text-left cursor-pointer"
            >
              <div className="font-bold text-xs mland:text-[10.5px] text-sky-700 dark:text-sky-300">🩺 ฟื้นฟูทีม 100%</div>
              <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ฟิตเต็ม · หายเจ็บ · ล้างโทษแบน</div>
            </button>
            <button
              type="button"
              onClick={() => runBoost('stat5')}
              className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-left cursor-pointer"
            >
              <div className="font-bold text-xs mland:text-[10.5px]">⚡ เพิ่มพลัง +5</div>
              <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">{state.mode === 'p' ? 'ทุกค่าพลัง +5 & ฟิต 100%' : 'ทั้งทีม +5 OVR & ฟิต 100%'}</div>
            </button>
            <button
              type="button"
              onClick={() => runBoost('stat10')}
              className="p-3 mland:p-2 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/40 hover:brightness-105 text-left cursor-pointer"
            >
              <div className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">🔥 เพิ่มพลัง +10</div>
              <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">{state.mode === 'p' ? 'ซูเปอร์สตาร์ +10 & ฟิตเต็ม' : 'ระดับแชมป์ +10 OVR & หายเจ็บ'}</div>
            </button>
          </div>

          {onOpenGodBlessing && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
                onOpenGodBlessing();
              }}
              className="w-full p-3 mland:p-2 rounded-xl bg-gradient-to-r from-[#fad05a] to-[#eab308] text-[#261900] border border-[#ca8a04]/40 text-xs mland:text-[10.5px] font-extrabold text-center cursor-pointer shadow-sm hover:brightness-105"
            >
              ✨ พรของพระเจ้า · ปรับแต่งค่าพลังนักเตะแต่ละคนได้เอง
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

