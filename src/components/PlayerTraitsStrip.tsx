import React, { useState } from 'react';
import type { FootballTraitDef, Player, PlayerCareerProfile } from '../types/game';
import { SIGL } from '../data/thaiFootballData';
import { talentTierMeta } from '../engine/missions';

interface TraitInfoItem {
  id: string;
  chipLabel: string;
  title: string;
  category: string;
  description: string;
  tone: 'pos' | 'warn' | 'gold' | 'neutral' | 'sig';
}

const RISKY_TRAIT_IDS = new Set(['hot_headed', 'selfish_shooter', 'glass_cannon', 'slide_tackler']);

export const PlayerTraitsStrip: React.FC<{
  player: Partial<Player>;
  careerProfile?: PlayerCareerProfile | null;
  trPair: readonly string[];
  traits: FootballTraitDef[];
  talent: number;
  growthStage: string;
  peakAge: number;
  sigKey: string;
  archName?: string;
}> = ({
  player,
  careerProfile,
  trPair,
  traits,
  talent,
  growthStage,
  peakAge,
  sigKey,
  archName
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tlMeta = talentTierMeta(talent);
  const sigLabel = SIGL[sigKey] || sigKey;
  const age = player.age || careerProfile?.age || 24;
  const trTitle = trPair[0] || 'ปกติ';
  const trDesc = trPair[1] || '';

  const items: TraitInfoItem[] = [
    {
      id: `personality_${trTitle}`,
      chipLabel: `นิสัย: ${trTitle}`,
      title: `นิสัยประจำตัว · ${trTitle}`,
      category: 'บุคลิกภาพ',
      description: trDesc,
      tone: trTitle.includes('เกเร') ? 'warn' : trTitle.includes('ปกติ') ? 'neutral' : 'pos'
    },
    ...traits.map((t): TraitInfoItem => ({
      id: `trait_${t.id}`,
      chipLabel: `${t.icon} ${t.name}`,
      title: `${t.icon} ${t.name}`,
      category: RISKY_TRAIT_IDS.has(t.id) ? 'สไตล์เสี่ยง / ข้อควรระวัง' : 'สไตล์การเล่นเฉพาะตัว',
      description: t.desc,
      tone: RISKY_TRAIT_IDS.has(t.id) ? 'warn' : 'pos'
    })),
    {
      id: 'talent_tier',
      chipLabel: `🌟 TL ${talent} (${tlMeta.label})`,
      title: `🌟 ค่าพรสวรรค์ ${talent}/99 · ${tlMeta.label}`,
      category: 'ศักยภาพพัฒนาการ',
      description:
        'ค่าพรสวรรค์ส่งผลโดยตรงต่ออัตราความสำเร็จในการอัปพลังเมื่อทำภารกิจส่วนบุคคลครบขั้น รวมถึงช่วยเพิ่มความเร็วในการพัฒนาค่าพลังหลัก',
      tone: 'gold'
    },
    {
      id: 'growth_phase',
      chipLabel: `📈 ${growthStage}`,
      title: `📈 ช่วงพัฒนาการ · ${growthStage} (อายุ ${age} ปี)`,
      category: 'กราฟช่วงวัย',
      description:
        growthStage === 'กำลังเติบโต'
          ? `ยังอยู่ในวัยพัฒนา ค่าพลังมีโอกาสพุ่งขึ้นไวจากการซ้อมและการลงสนาม (ช่วงพีคประมาณอายุ ${peakAge - 2}–${peakAge + 4} ปี)`
          : growthStage === 'ช่วงพีค'
            ? `กำลังอยู่ในช่วงพีคของอาชีพ (ประมาณ ${peakAge - 2}–${peakAge + 4} ปี) ฟอร์มและสภาพร่างกายสมดุลที่สุด`
            : `เข้าสู่ช่วงปลายอาชีพ (เลยช่วงพีค ${peakAge + 4} ปี) เน้นการคุมฟิตและประสบการณ์ช่วยทีม`,
      tone: growthStage === 'เริ่มถดถอย' ? 'warn' : 'neutral'
    },
    {
      id: `sig_${sigKey}`,
      chipLabel: `⭐ ทีเด็ด: ${sigLabel}`,
      title: `⭐ จุดเด่นประจำตัว · ${sigLabel} (+8)`,
      category: 'ความถนัดพิเศษ',
      description: `ทักษะ "${sigLabel}" ได้รับโบนัสพิเศษ +8 เหนือค่าพื้นฐาน ทำให้นักเตะโดดเด่นเป็นพิเศษในจังหวะสำคัญของเกม`,
      tone: 'sig'
    }
  ];

  if (archName) {
    items.splice(1, 0, {
      id: 'career_arch',
      chipLabel: `🎭 ${archName}`,
      title: `🎭 สายการเล่น · ${archName}`,
      category: 'แนวทางอาชีพ',
      description: 'สายการเล่นเริ่มต้นที่กำหนดจุดเด่นและสัดส่วนค่าพลังหลักของนักเตะในโหมดอาชีพ',
      tone: 'gold'
    });
  }

  const activeItem = items.find((x) => x.id === selectedId) || null;

  const chipStyle = (item: TraitInfoItem, isSelected: boolean) => {
    const ring = isSelected ? 'ring-2 ring-[var(--g)] shadow-xs scale-[1.01]' : '';
    if (item.tone === 'warn') {
      return `bg-amber-500/12 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 ${ring}`;
    }
    if (item.tone === 'gold') {
      return `bg-[var(--lamp-soft)] border-[var(--lamp)]/55 text-[#7a4f00] dark:text-[#fde047] hover:brightness-105 ${ring}`;
    }
    if (item.tone === 'sig') {
      return `bg-sky-500/12 border-sky-500/40 text-sky-800 dark:text-sky-200 hover:bg-sky-500/20 ${ring}`;
    }
    if (item.tone === 'pos') {
      return `bg-[var(--g-soft)] border-[var(--g)]/35 text-[var(--g)] hover:brightness-105 ${ring}`;
    }
    return `bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)] ${ring}`;
  };

  return (
    <div className="shrink-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2 mland:px-2 mland:py-1.5 shadow-xs space-y-1.5 mland:space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] mland:text-[9px] font-bold text-[var(--ink)]">
          🧠 นิสัย สไตล์ &amp; ข้อมูลเชิงลึก
        </span>
        <span className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)]">
          {activeItem ? 'แตะรายการเดิมเพื่อปิด' : 'แตะแต่ละหัวข้อเพื่ออ่านรายละเอียด'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mland:gap-0.5">
        {items.map((item) => {
          const isSelected = activeItem?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId((prev) => (prev === item.id ? null : item.id))}
              className={`px-2 mland:px-1.5 py-0.5 rounded-lg border text-[10px] mland:text-[8px] font-bold cursor-pointer transition-all inline-flex items-center gap-1 leading-tight ${chipStyle(item, isSelected)}`}
            >
              <span>{item.chipLabel}</span>
              <span className="opacity-60 text-[8.5px] mland:text-[7px]">{isSelected ? '▴' : '▾'}</span>
            </button>
          );
        })}
      </div>

      {activeItem && (
        <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)]/90 border border-[var(--line)] flex items-start justify-between gap-2 text-[10.5px] mland:text-[8.5px]">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5 font-extrabold text-[var(--ink)]">
              <span>{activeItem.title}</span>
              <span className="px-1.5 py-[1px] rounded bg-[var(--surface)] border border-[var(--line)] text-[9px] mland:text-[7px] font-bold text-[var(--mut)]">
                {activeItem.category}
              </span>
            </div>
            <div className="text-[var(--mut)] leading-snug">{activeItem.description}</div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="ปิดรายละเอียด"
            className="shrink-0 w-5 h-5 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[10px] font-bold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
