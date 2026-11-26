import React, { useEffect, useRef, useState } from 'react';
import { SFX } from '../utils/audioTheme';
import { MyTeamBadge } from './MyTeamBadge';

interface SquadListHeaderBarProps {
  luTab: 0 | 1 | 2;
  onChangeTab: (tab: 0 | 1 | 2) => void;
  totalCount: number;
  startersCount: number;
  benchCount: number;
  showMyTeamBadge?: boolean;
  canEdit?: boolean;
  tiredCount?: number;
  isRestCritical?: boolean;
  onRestTired?: () => void;
  isAutoLineup?: boolean;
  onAutoLineup?: () => void;
}

export const SquadListHeaderBar: React.FC<SquadListHeaderBarProps> = ({
  luTab,
  onChangeTab,
  totalCount,
  startersCount,
  benchCount,
  showMyTeamBadge = false,
  canEdit = false,
  tiredCount = 0,
  isRestCritical = false,
  onRestTired,
  isAutoLineup = false,
  onAutoLineup
}) => {
  const [showStaminaGuide, setShowStaminaGuide] = useState(false);
  const staminaGuideRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showStaminaGuide) return;
    const handleOutsidePointer = (e: PointerEvent) => {
      if (!staminaGuideRef.current?.contains(e.target as Node)) {
        setShowStaminaGuide(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowStaminaGuide(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showStaminaGuide]);

  return (
    <div className="relative z-20 shrink-0 px-2.5 py-1.5 mland:px-2 mland:py-1 bg-[var(--surface-2)]/65 border-b border-[var(--line)] space-y-1.5 mland:space-y-1">
      {/* Row 1: Compact Title + MyTeam / Fitness Popover (Left) | Quick Lineup Actions (Right) */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-bold text-[11.5px] mland:text-[10px] text-[var(--ink)] whitespace-nowrap truncate">
            👥 รายชื่อทีม
          </span>
          {showMyTeamBadge && <MyTeamBadge size="2xs" />}
          <div ref={staminaGuideRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setShowStaminaGuide((v) => !v);
              }}
              aria-expanded={showStaminaGuide}
              aria-label="คำอธิบายเกณฑ์ความฟิต"
              title="คำอธิบายเกณฑ์ความฟิต"
              className={`h-[20px] w-[20px] mland:h-[17px] mland:w-[17px] rounded-md border text-[10px] mland:text-[8px] font-bold inline-flex items-center justify-center cursor-pointer transition-colors ${
                showStaminaGuide
                  ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-2xs'
                  : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] hover:border-[var(--g)]/55'
              }`}
            >
              ⓘ
            </button>

            {showStaminaGuide && (
              <div className="absolute left-0 top-full mt-1.5 z-30 w-[232px] sm:w-[248px] mland:w-[216px] p-2.5 mland:p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xl space-y-1.5 text-[10.5px] mland:text-[9px]">
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-[var(--line)]/70">
                  <span className="font-extrabold text-[var(--ink)]">⚡ เกณฑ์ความฟิตนักเตะ</span>
                  <button
                    type="button"
                    onClick={() => setShowStaminaGuide(false)}
                    className="w-5 h-5 inline-flex items-center justify-center rounded-md text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1 tabular-nums">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-[#ef4444] shrink-0" /> &lt;65% ควรพัก
                    </span>
                    <span className="text-[var(--mut)] text-[9.5px] mland:text-[8px]">เสี่ยงล้าสะสม/เจ็บ</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" /> 65–74% เริ่มล้า
                    </span>
                    <span className="text-[var(--mut)] text-[9.5px] mland:text-[8px]">ฟอร์มลดช่วงท้ายเกม</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" /> ≥75% พร้อม
                    </span>
                    <span className="text-[var(--mut)] text-[9.5px] mland:text-[8px]">ลงสนามเต็มร้อย</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            {tiredCount > 0 && onRestTired && (
              <button
                type="button"
                onClick={onRestTired}
                title="สลับตัวจริงที่อ่อนล้าไปพักที่ม้านั่งสำรองและส่งตัวฟิตลงแทน"
                className={`h-[22px] mland:h-[19px] px-1.5 rounded-md border text-[10px] mland:text-[8.5px] font-bold tabular-nums inline-flex items-center gap-0.5 whitespace-nowrap cursor-pointer transition-colors ${
                  isRestCritical
                    ? 'bg-[var(--red)] border-[var(--red)] text-white hover:brightness-110'
                    : 'bg-amber-500/15 border-amber-500/45 text-[#b45309] dark:text-[#fcd34d] hover:bg-amber-500 hover:text-white'
                }`}
              >
                🛌 พักล้า ({tiredCount})
              </button>
            )}
            {onAutoLineup && (
              <button
                type="button"
                title={isAutoLineup ? 'กำลังใช้ระบบจัดตัวจริงอัตโนมัติ' : 'รีเซ็ตเป็นจัด 11 ตัวจริงอัตโนมัติ'}
                onClick={onAutoLineup}
                className={`h-[22px] mland:h-[19px] px-1.5 rounded-md border text-[10px] mland:text-[8.5px] font-bold inline-flex items-center gap-0.5 whitespace-nowrap cursor-pointer transition-colors ${
                  isAutoLineup
                    ? 'bg-[var(--g-soft)] border-[var(--g)]/45 text-[var(--g)]'
                    : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--g)] hover:text-white hover:border-[var(--g)]'
                }`}
              >
                {isAutoLineup ? '✓ อัตโนมัติ' : '⚡ อัตโนมัติ'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Balanced 3-Column Filter Segment (All / Starters / Bench) */}
      <div className="grid grid-cols-3 p-[2px] rounded-lg mland:rounded-md bg-[var(--surface)] border border-[var(--line)] gap-0.5">
        {([
          [`ทั้งหมด (${totalCount})`, 0],
          [`ตัวจริง (${startersCount})`, 1],
          [`สำรอง (${benchCount})`, 2]
        ] as const).map(([label, tab]) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              SFX.tap();
              onChangeTab(tab);
            }}
            className={`h-[22px] mland:h-[18px] px-1 rounded-[6px] mland:rounded-[4px] text-[10px] sm:text-[10.5px] mland:text-[8.5px] font-bold tabular-nums whitespace-nowrap inline-flex items-center justify-center cursor-pointer transition-colors ${
              luTab === tab
                ? 'bg-[var(--g)] text-white shadow-2xs'
                : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
