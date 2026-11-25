import React, { useMemo, useState } from 'react';
import type { Player, Team, GameState, PersonalMissionDef } from '../types/game';
import { clamp } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import { statTierMeta, statBarColor, getPlayerMissionView, formatMissionRewardText, talentTierMeta } from '../engine/missions';

export const StatBarRow: React.FC<{ label: string; value: number; compact?: boolean }> = ({
  label,
  value,
  compact
}) => {
  const tier = statTierMeta(value);
  const pct = clamp(Math.round(value), 6, 100);
  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${compact ? 'py-[2px] mland:py-[1px]' : 'py-0.5'}`}>
      <span className="w-[78px] sm:w-[88px] mland:w-[64px] shrink-0 flex items-center gap-1 truncate text-[11px] mland:text-[9px] text-[var(--ink)]/90 font-medium">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tier.hex }} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <div className="flex-1 min-w-[38px] h-3 sm:h-3.5 mland:h-2.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/75 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
          style={{ width: `${pct}%`, background: statBarColor(value) }}
        />
      </div>
      <b className={`w-6 mland:w-5 text-right shrink-0 text-[11px] mland:text-[9px] font-extrabold tabular leading-tight ${tier.textClass}`}>
        {value}
      </b>
    </div>
  );
};

type MissionCategoryFilter = 'all' | NonNullable<PersonalMissionDef['category']>;

const CATEGORY_TABS: { key: MissionCategoryFilter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'attack', label: '⚔️ เกมรุก' },
  { key: 'playmaking', label: '🎯 สร้างสรรค์' },
  { key: 'defense', label: '🛡️ เกมรับ' },
  { key: 'gk', label: '🧤 ผู้รักษาประตู' },
  { key: 'physical', label: '🔥 ฟอร์ม & วินัย' }
];

export const PlayerMissionsPanel: React.FC<{
  player: Player;
  team: Team | null;
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ player, state }) => {
  const [catFilter, setCatFilter] = useState<MissionCategoryFilter>('all');
  const isMe = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
  const careerP = isMe ? state.p : null;
  const { mState, items, talent, passedStages, failedStages } = getPlayerMissionView(player, careerP, state);
  const tlMeta = talentTierMeta(talent);
  const maxTotal = items.reduce((sum, x) => sum + x.maxStage, 0);
  const subBonusSum = Object.values((isMe ? state.p?.sb : player.sb) || {}).reduce((a, b) => a + b, 0);
  const recentLogs = mState.recentLogs || [];

  const availableTabs = useMemo(
    () =>
      CATEGORY_TABS.filter(
        (t) => t.key === 'all' || items.some((x) => (x.def.category || 'physical') === t.key)
      ),
    [items]
  );

  const filteredItems = useMemo(
    () =>
      catFilter === 'all'
        ? items
        : items.filter((x) => (x.def.category || 'physical') === catFilter),
    [items, catFilter]
  );

  return (
    <div className="space-y-3 mland:space-y-2">
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm mland:text-xs font-bold flex flex-wrap items-center gap-1.5">
            <span>🎯 ภารกิจสะสมของ {player.n}</span>
            <span
              className="px-1.5 py-0.5 rounded-md text-[10px] mland:text-[8.5px] font-extrabold tabular border border-white/10"
              style={{ background: tlMeta.bg, color: tlMeta.color }}
              title="ค่าพรสวรรค์ส่งผลต่อโอกาสอัปพลังสำเร็จเมื่อทำเป้าภารกิจครบ"
            >
              🌟 พรสวรรค์ {talent} · {tlMeta.label}
            </span>
          </div>
          <div className="text-[11px] mland:text-[9px] text-[var(--mut)] mt-0.5">
            สะสมทุกภารกิจพร้อมกันได้สูงสุด <b className="text-[var(--ink)]">8 ขั้น</b> · หากสุ่มพลาด ความคืบหน้าจะลดเหลือ <b className="text-[var(--ink)]">72%</b> เพื่อเก็บสะสมลองใหม่ได้จนกว่าจะเลยช่วงพีค
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-xs mland:text-[10px] tabular shrink-0">
          <span className="text-[var(--g)] font-bold">ผ่าน {passedStages}/{maxTotal}</span>
          {failedStages > 0 && <span className="text-[var(--red)] font-bold">เคยพลาด {failedStages}</span>}
          <span className="font-bold text-[var(--ink)]">โบนัส +{subBonusSum}</span>
        </div>
      </div>

      {availableTabs.length > 2 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {availableTabs.map((t) => {
            const cnt = t.key === 'all' ? items.length : items.filter((x) => (x.def.category || 'physical') === t.key).length;
            const active = catFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  SFX.tap();
                  setCatFilter(t.key);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] mland:text-[8.5px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[var(--g)] text-white border-[var(--g)]'
                    : 'bg-[var(--surface-2)]/70 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                }`}
              >
                {t.label} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {recentLogs.length > 0 && (
        <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)]/80 space-y-1">
          <div className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)]">📜 ผลการอัปพลังล่าสุด</div>
          <div className="flex flex-wrap gap-1.5">
            {recentLogs.slice(0, 4).map((lg, idx) => (
              <span
                key={`${lg.missionId}-${lg.stage}-${idx}`}
                className={`px-2 py-0.5 rounded-md text-[10px] mland:text-[8.5px] font-semibold border ${
                  lg.success
                    ? 'bg-[var(--g-soft)] border-[var(--g)]/40 text-[var(--g)]'
                    : 'bg-[var(--red-soft)] border-[var(--red)]/35 text-[var(--red)]'
                }`}
              >
                {lg.success ? '✓' : '✕'} {lg.icon} {lg.missionName} ขั้น {lg.stage} ({lg.chance}%){lg.success && lg.rewardText ? ` · ${lg.rewardText}` : ' · ถอยเหลือ 72% ลองใหม่ได้'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mland:gap-1.5">
        {filteredItems.map(({ def, stage, maxStage, completedAll, target, curVal, pct, nextRewards, nextCoreAmt, successChance, stageOutcomes }) => (
          <div
            key={def.id}
            className="p-3 mland:p-2 rounded-2xl mland:rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 flex flex-col justify-between gap-2 mland:gap-1.5 transition-colors"
          >
            <div className="space-y-1.5 mland:space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-xs mland:text-[10.5px] truncate flex items-center gap-1.5">
                    <span>{def.icon} {def.name}</span>
                  </div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug">{def.desc}</div>
                </div>
                <div className="flex items-center flex-wrap justify-end gap-0.5 shrink-0 max-w-[144px] pt-0.5" title={`ประวัติ ${maxStage} ขั้น`}>
                  {Array.from({ length: maxStage }, (_, idx) => {
                    const out = stageOutcomes[idx] || (idx < stage ? 'ok' : undefined);
                    const isCur = !completedAll && idx === stage;
                    return (
                      <span
                        key={idx}
                        className={`w-3.5 h-3.5 rounded text-[8.5px] font-extrabold flex items-center justify-center tabular border ${
                          out === 'ok'
                            ? 'bg-[var(--g)] text-white border-[var(--g)]'
                            : out === 'fail'
                              ? 'bg-[var(--red-soft)] text-[var(--red)] border-[var(--red)]/50'
                              : isCur
                                ? 'bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] border-[var(--lamp)]'
                                : 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)]'
                        }`}
                      >
                        {out === 'ok' ? '✓' : out === 'fail' ? '↻' : idx + 1}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] mland:text-[9px] tabular">
                  <span className="text-[var(--mut)]">
                    {completedAll ? (
                      <b className="text-[var(--g)]">สะสมครบ {curVal.toLocaleString()} {def.unit} แล้ว</b>
                    ) : (
                      <>ความคืบหน้า: <b className="text-[var(--ink)]">{curVal.toLocaleString()} / {target.toLocaleString()}</b> {def.unit}</>
                    )}
                  </span>
                  <b className="text-[var(--g)]">{pct}%</b>
                </div>
                <div className="h-2 mland:h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: 'var(--g)' }}
                  />
                </div>
              </div>

              {!completedAll && (
                <div className="text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--g)] leading-snug">
                  ลุ้นรับขั้น {stage + 1}: {formatMissionRewardText(nextRewards, def.coreReward, nextCoreAmt)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-0.5 text-[10px] mland:text-[8.5px] font-bold tabular text-[var(--mut)]">
              {!completedAll ? (
                <>
                  <span>
                    ขั้นที่ {stage + 1}/{maxStage} · อัปพลังอัตโนมัติ
                  </span>
                  <span>
                    โอกาสสำเร็จ: <b className="text-[var(--ink)]">{successChance}%</b>
                  </span>
                </>
              ) : (
                <span className="ml-auto text-[var(--g)]">
                  🏆 จบครบทั้ง {maxStage} ขั้นแล้ว
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

