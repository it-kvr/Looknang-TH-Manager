import React from 'react';
import {
  Briefcase,
  ChevronRight,
  Handshake,
  Mic,
  Newspaper,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import type { ActiveDilemma } from '../types/game';
import { SFX } from '../utils/audioTheme';
import { EffectText } from '../components/DeltaText';

function resolveHeaderIcon(dilemma: ActiveDilemma) {
  const isPress =
    dilemma.isPress || dilemma.id === 'media_interview' || dilemma.id.startsWith('press_');
  if (isPress) {
    return {
      icon: <Mic className="w-4 h-4 mland:w-3.5 mland:h-3.5" aria-hidden="true" />,
      boxCls: 'bg-sky-500/12 border-sky-500/35 text-sky-600 dark:text-sky-300',
      kickerCls: 'text-sky-700 dark:text-sky-300'
    };
  }
  if (dilemma.category.includes('ห้องแต่งตัว')) {
    return {
      icon: <Users className="w-4 h-4 mland:w-3.5 mland:h-3.5" aria-hidden="true" />,
      boxCls: 'bg-amber-500/12 border-amber-500/35 text-amber-600 dark:text-amber-300',
      kickerCls: 'text-amber-700 dark:text-amber-300'
    };
  }
  if (dilemma.category.includes('ธุรกิจ')) {
    return {
      icon: <Briefcase className="w-4 h-4 mland:w-3.5 mland:h-3.5" aria-hidden="true" />,
      boxCls: 'bg-emerald-500/12 border-emerald-500/35 text-[var(--g)]',
      kickerCls: 'text-[var(--g)]'
    };
  }
  if (dilemma.category.includes('อะคาเดมี่')) {
    return {
      icon: <Sparkles className="w-4 h-4 mland:w-3.5 mland:h-3.5" aria-hidden="true" />,
      boxCls: 'bg-emerald-500/12 border-emerald-500/35 text-[var(--g)]',
      kickerCls: 'text-[var(--g)]'
    };
  }
  if (dilemma.category.includes('นอกสนาม')) {
    return {
      icon: <Handshake className="w-4 h-4 mland:w-3.5 mland:h-3.5" aria-hidden="true" />,
      boxCls: 'bg-sky-500/12 border-sky-500/35 text-sky-600 dark:text-sky-300',
      kickerCls: 'text-sky-700 dark:text-sky-300'
    };
  }
  return {
    icon: <Newspaper className="w-4 h-4 mland:w-3.5 mland:h-3.5" aria-hidden="true" />,
    boxCls: 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)]',
    kickerCls: 'text-[var(--mut)]'
  };
}

export const DilemmaModal: React.FC<{
  dilemma: ActiveDilemma;
  onChoose: (idx: number) => void;
  onClose?: () => void;
}> = ({ dilemma, onChoose, onClose }) => {
  const isPress =
    dilemma.isPress || dilemma.id === 'media_interview' || dilemma.id.startsWith('press_');
  const meta = resolveHeaderIcon(dilemma);
  const cleanTitle = dilemma.title.replace(/^[^\p{L}\p{N}]+/u, '').trim() || dilemma.title;
  const outletLabel = dilemma.outlet || (isPress ? 'ห้องแถลงข่าวสโมสร' : 'สำนักงานสโมสร');
  const speakerLabel = dilemma.speaker || (isPress ? 'ผู้สื่อข่าวกีฬา' : dilemma.category);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/72 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 mland:p-2 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          SFX.tap();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dilemma-modal-title"
        className="w-full max-w-xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-3.5 mland:px-3.5 mland:py-2 border-b border-[var(--line)]/70 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 mland:gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 mland:w-7 mland:h-7 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${meta.boxCls}`}
            >
              {meta.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)] truncate">
                <span className={meta.kickerCls}>{outletLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{dilemma.category}</span>
              </div>
              <h3
                id="dilemma-modal-title"
                className="font-bold text-base sm:text-lg mland:text-xs font-display text-[var(--ink)] leading-snug mt-0.5"
              >
                {cleanTitle}
              </h3>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              aria-label="ปิดหน้าต่าง"
              title="ไว้ตอบภายหลัง"
              className="w-8 h-8 mland:w-7 mland:h-7 rounded-xl flex items-center justify-center text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 mland:px-3.5 mland:py-2.5 space-y-3.5 mland:space-y-2">
          {/* Speaker Question / Briefing Context */}
          <div className="rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/80 px-4 py-3 mland:px-3 mland:py-2 space-y-1.5 mland:space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">
              <span>{speakerLabel}</span>
              {isPress && <span className="tabular">คำถามสื่อมวลชน</span>}
            </div>
            {dilemma.quote ? (
              <>
                <p className="text-[13px] sm:text-sm mland:text-[11px] font-semibold text-[var(--ink)] leading-relaxed">
                  “{dilemma.quote}”
                </p>
                <p className="text-[11.5px] mland:text-[9.5px] text-[var(--mut)] leading-relaxed">
                  {dilemma.desc}
                </p>
              </>
            ) : (
              <p className="text-[13px] sm:text-sm mland:text-[11px] text-[var(--ink)]/92 leading-relaxed">
                {dilemma.desc}
              </p>
            )}
          </div>

          {/* Choice List */}
          <div className="space-y-2 mland:space-y-1.5">
            <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)] px-0.5">
              {isPress ? 'เลือกคำตอบต่อหน้าสื่อ' : 'เลือกแนวทางจัดการ'}
            </div>
            <div className="grid grid-cols-1 gap-2 mland:gap-1.5">
              {dilemma.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onChoose(idx);
                  }}
                  className="group w-full px-3.5 py-2.5 mland:px-3 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/45 hover:bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)]/65 text-left transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 mland:gap-2 min-w-0">
                    <span className="w-5 h-5 mland:w-4 mland:h-4 rounded-lg bg-[var(--surface)] border border-[var(--line)] group-hover:border-[var(--g)]/55 group-hover:text-[var(--g)] text-[11px] mland:text-[9.5px] font-bold tabular flex items-center justify-center shrink-0 mt-0.5 text-[var(--mut)] transition-colors">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-[13px] mland:text-[10.5px] text-[var(--ink)] leading-snug">
                        {opt.label}
                      </div>
                      <div className="text-[11px] mland:text-[9px] text-[var(--mut)] mt-0.5 font-semibold leading-snug">
                        <EffectText text={opt.hint} />
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--mut)] group-hover:text-[var(--g)] group-hover:translate-x-0.5 transition-all shrink-0"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        {onClose && (
          <div className="shrink-0 px-5 py-2.5 mland:px-3.5 mland:py-1.5 border-t border-[var(--line)]/65 flex items-center justify-between gap-2 bg-[var(--surface-2)]/30">
            <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate">
              คำตอบมีผลต่อขวัญทีม บอร์ด และแฟนบอลทันที
            </span>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              className="px-3 py-1.5 mland:py-1 rounded-lg text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer shrink-0"
            >
              ไว้ตอบภายหลัง
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
