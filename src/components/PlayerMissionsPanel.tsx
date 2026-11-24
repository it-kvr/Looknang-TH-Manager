import React from 'react';
import type { Player, Team, GameState } from '../types/game';
import { SFX } from '../utils/audioTheme';
import { statTierMeta, ensurePlayerMissions, getPlayerMissionView, formatMissionRewardText, talentTierMeta } from '../engine/missions';

export const StatBarRow: React.FC<{ label: string; value: number; compact?: boolean }> = ({
  label,
  value,
  compact
}) => {
  const tier = statTierMeta(value);
  return (
    <div className={`flex items-center justify-between gap-2 ${compact ? 'py-[2px] mland:py-[1px]' : 'py-0.5'}`}>
      <span className="min-w-0 flex items-center gap-1.5 truncate text-[11.5px] mland:text-[9.5px] text-[var(--ink)]/85 font-medium">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tier.dotClass}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`shrink-0 px-1.5 py-[1px] mland:px-1 mland:py-0 rounded-md border text-[11px] mland:text-[9px] tabular leading-tight ${tier.badgeClass}`}
      >
        <b className="font-extrabold">{value}</b>
        <span className="opacity-65 font-semibold text-[9.5px] mland:text-[7.5px]">/100</span>
      </span>
    </div>
  );
};

export const PlayerMissionsPanel: React.FC<{
  player: Player;
  team: Team | null;
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ player, team, state, onUpdateState, onToast }) => {
  const isMe = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
  const careerP = isMe ? state.p : null;
  const { mState, items, talent, passedStages, failedStages } = getPlayerMissionView(player, careerP, state);
  const tlMeta = talentTierMeta(talent);
  const maxTotal = items.length * 5;
  const subBonusSum = Object.values((isMe ? state.p?.sb : player.sb) || {}).reduce((a, b) => a + b, 0);
  const recentLogs = mState.recentLogs || [];

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
            สะสมทุกภารกิจพร้อมกัน และ <b className="text-[var(--ink)]">ลุ้นอัปพลังอัตโนมัติทันที</b> เมื่อครบเป้า (สำเร็จ/พลาดขึ้นอยู่กับพรสวรรค์ &amp; วัย)
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-xs mland:text-[10px] tabular shrink-0">
          <span className="text-[var(--g)] font-bold">ผ่าน {passedStages}/{maxTotal}</span>
          {failedStages > 0 && <span className="text-[var(--red)] font-bold">พลาด {failedStages}</span>}
          <span className="font-bold text-[var(--ink)]">โบนัส +{subBonusSum}</span>
        </div>
      </div>

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
                {lg.success ? '✓' : '✕'} {lg.icon} {lg.missionName} ขั้น {lg.stage} ({lg.chance}%){lg.success && lg.rewardText ? ` · ${lg.rewardText}` : ' · พลาดรอบนี้'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mland:gap-1.5">
        {items.map(({ def, stage, maxStage, completedAll, target, curVal, pct, isFocused, nextRewards, nextCoreAmt, successChance, stageOutcomes }) => (
          <div
            key={def.id}
            className={`p-3 mland:p-2 rounded-2xl mland:rounded-xl border flex flex-col justify-between gap-2 mland:gap-1.5 transition-colors ${
              isFocused
                ? 'bg-[var(--g-soft)]/50 border-[var(--g)]/60'
                : 'bg-[var(--surface-2)]/70 border-[var(--line)]'
            }`}
          >
            <div className="space-y-1.5 mland:space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-xs mland:text-[10.5px] truncate flex items-center gap-1.5">
                    <span>{def.icon} {def.name}</span>
                  </div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug">{def.desc}</div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 pt-0.5" title="ประวัติ 5 ขั้น">
                  {Array.from({ length: maxStage }, (_, idx) => {
                    const out = stageOutcomes[idx] || (idx < stage ? 'ok' : undefined);
                    const isCur = !completedAll && idx === stage;
                    return (
                      <span
                        key={idx}
                        className={`w-4 h-4 rounded text-[9px] font-extrabold flex items-center justify-center tabular border ${
                          out === 'ok'
                            ? 'bg-[var(--g)] text-white border-[var(--g)]'
                            : out === 'fail'
                              ? 'bg-[var(--red-soft)] text-[var(--red)] border-[var(--red)]/50'
                              : isCur
                                ? 'bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] border-[var(--lamp)]'
                                : 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)]'
                        }`}
                      >
                        {out === 'ok' ? '✓' : out === 'fail' ? '✕' : idx + 1}
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
                <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
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

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              {!completedAll ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      onUpdateState((d) => {
                        const t = team ? d.teams[team.id] : d.teams[d.me];
                        const pl = t?.sq.find((x) => x.n === player.n);
                        if (!pl) return;
                        const cp = pl.me && d.p ? d.p : null;
                        const ms = ensurePlayerMissions(pl, cp);
                        ms.focusId = def.id;
                        pl.missions = ms;
                        if (cp) cp.missions = ms;
                      });
                      onToast(`🎯 ตั้ง "${def.name}" เป็นภารกิจโฟกัส (+50% ความคืบหน้า & +6% โอกาสผ่าน)`);
                    }}
                    className={`px-2.5 py-1 mland:py-0.5 rounded-lg text-[10.5px] mland:text-[9px] font-bold border cursor-pointer shrink-0 ${
                      isFocused
                        ? 'bg-[var(--g)] text-white border-[var(--g)]'
                        : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {isFocused ? '🎯 โฟกัสอยู่' : 'ตั้งโฟกัส'}
                  </button>
                  <span className="text-[10px] mland:text-[8.5px] font-bold tabular text-[var(--mut)]">
                    โอกาสสำเร็จ: <b className="text-[var(--ink)]">{successChance}%</b>
                  </span>
                </>
              ) : (
                <span className="ml-auto text-[10px] mland:text-[8.5px] font-bold text-[var(--g)]">
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

