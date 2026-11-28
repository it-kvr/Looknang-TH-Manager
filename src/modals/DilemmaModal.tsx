import React from 'react';
import { X } from 'lucide-react';
import type { ActiveDilemma } from '../types/game';
import { SFX } from '../utils/audioTheme';
import { EffectText } from '../components/DeltaText';

export const DilemmaModal: React.FC<{
  dilemma: ActiveDilemma;
  onChoose: (idx: number) => void;
  onClose?: () => void;
}> = ({ dilemma, onChoose, onClose }) => (
  <div
    className="fixed inset-0 z-50 bg-black/72 flex items-center justify-center p-3 sm:p-4 mland:p-1.5 overflow-hidden"
    onClick={(e) => {
      if (e.target === e.currentTarget && onClose) {
        SFX.tap();
        onClose();
      }
    }}
  >
    <div className="w-full max-w-2xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
      <div className="shrink-0 px-5 pt-4 pb-2 mland:px-3 mland:pt-1.5 mland:pb-1 border-b border-[var(--line)]/60 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs mland:text-[9.5px] font-bold text-[var(--lamp)]">📌 เหตุการณ์ · {dilemma.category}</div>
          <h3 className="font-bold text-lg mland:text-xs font-display mt-0.5">{dilemma.title}</h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              onClose();
            }}
            aria-label="ปิดหน้าต่างเหตุการณ์"
            title="ไว้ตัดสินใจภายหลัง"
            className="w-8 h-8 mland:w-6 mland:h-6 rounded-xl flex items-center justify-center text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-5 mland:p-2.5 space-y-3 mland:space-y-1.5">
        <p className="text-xs mland:text-[10.5px] text-[var(--mut)] leading-relaxed">{dilemma.desc}</p>
        <div className="grid grid-cols-2 gap-2.5 mland:gap-1.5 pt-1 mland:pt-0">
          {dilemma.options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                SFX.tap();
                onChoose(idx);
              }}
              className="w-full p-3 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-left transition-colors cursor-pointer"
            >
              <div className="font-bold text-xs mland:text-[10.5px]">{opt.label}</div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] mt-0.5 font-semibold">
                <EffectText text={opt.hint} />
              </div>
            </button>
          ))}
        </div>
        {onClose && (
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              className="btn btn-xs btn-surface text-[var(--mut)]"
            >
              ไว้ตัดสินใจภายหลัง
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);
