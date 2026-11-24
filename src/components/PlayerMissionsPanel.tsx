import React from 'react';
import type { Player, Team, GameState } from '../types/game';
import { SFX, vibrate } from '../utils/audioTheme';
import { statBarColor, ensurePlayerMissions, getPlayerMissionView, formatMissionRewardText, claimPlayerMission } from '../engine/missions';

export const StatBarRow: React.FC<{ label: string; value: number; isSig?: boolean; compact?: boolean }> = ({
  label,
  value,
  isSig,
  compact
}) => {
  const pct = Math.max(6, Math.min(100, Math.round(value)));
  const col = isSig ? 'var(--g)' : statBarColor(value);
  return (
    <div className={compact ? 'py-0.5' : 'py-1'}>
      <div className="flex items-center justify-between gap-2 text-xs mland:text-[10.5px] mb-1 mland:mb-0.5">
        <span className={`truncate ${isSig ? 'font-bold text-[var(--g)]' : 'text-[var(--ink)]/85 font-medium'}`}>
          {isSig ? '⭐ ' : ''}{label}
        </span>
        <span
          className="font-extrabold tabular text-xs mland:text-[10.5px] shrink-0"
          style={{ color: value >= 75 || isSig ? col : 'var(--ink)' }}
        >
          {value}
        </span>
      </div>
      <div className="h-1.5 mland:h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: col }}
        />
      </div>
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
  const { mState, items } = getPlayerMissionView(player, careerP);
  const readyCount = items.filter((x) => x.canClaim).length;
  const claimedTotal = items.reduce((sum, x) => sum + x.stage, 0);
  const maxTotal = items.length * 3;
  const subBonusSum = Object.values((isMe ? state.p?.sb : player.sb) || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3 mland:space-y-2">
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm mland:text-xs font-bold flex items-center gap-1.5">
            <span>🎯 ภารกิจส่วนบุคคลของ {player.n}</span>
            {readyCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--lamp)] text-[#261900] text-[10px] font-extrabold tabular">
                พร้อมรับ {readyCount}
              </span>
            )}
          </div>
          <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">
            เลือก <b className="text-[var(--ink)]">โฟกัส (+50% ความคืบหน้า)</b> เพื่อปั้นค่าพลังเฉพาะทางจากการแข่งและซ้อม
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs mland:text-[10px] tabular shrink-0">
          <span className="text-[var(--mut)]">สำเร็จ <b className="text-[var(--ink)]">{claimedTotal}/{maxTotal}</b> ขั้น</span>
          <span className="font-bold text-[var(--g)]">โบนัสสะสม +{subBonusSum}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mland:gap-1.5">
        {items.map(({ def, stage, maxStage, completedAll, target, curVal, pct, canClaim, isFocused, nextRewards }) => (
          <div
            key={def.id}
            className={`p-3 mland:p-2 rounded-2xl mland:rounded-xl border flex flex-col justify-between gap-2 mland:gap-1.5 transition-colors ${
              canClaim
                ? 'bg-[var(--lamp-soft)]/70 border-[var(--lamp)]'
                : isFocused
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
                <span className="text-[10px] mland:text-[8.5px] font-bold tabular text-[var(--mut)] shrink-0">
                  {completedAll ? '✅ เต็มขั้น' : `ขั้น ${stage + 1}/${maxStage}`}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] mland:text-[9px] tabular">
                  <span className="text-[var(--mut)]">
                    ความคืบหน้า: <b className="text-[var(--ink)]">{curVal.toLocaleString()} / {target.toLocaleString()}</b> {def.unit}
                  </span>
                  <b className={canClaim ? 'text-[#8a5b00] dark:text-[var(--lamp)]' : 'text-[var(--g)]'}>{pct}%</b>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: canClaim ? 'var(--lamp)' : 'var(--g)' }}
                  />
                </div>
              </div>

              <div className="text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--g)]">
                รางวัลขั้นนี้: {formatMissionRewardText(nextRewards, def.coreReward)}
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5">
              {!completedAll && (
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
                    onToast(`🎯 ตั้ง "${def.name}" เป็นภารกิจโฟกัส (+50% ความคืบหน้า)`);
                  }}
                  className={`px-2.5 py-1 mland:py-0.5 rounded-lg text-[10.5px] mland:text-[9px] font-bold border cursor-pointer shrink-0 ${
                    isFocused
                      ? 'bg-[var(--g)] text-white border-[var(--g)]'
                      : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isFocused ? '🎯 โฟกัสอยู่' : 'ตั้งโฟกัส'}
                </button>
              )}
              {canClaim ? (
                <button
                  type="button"
                  onClick={() => {
                    let resultMsg = '';
                    onUpdateState((d) => {
                      const res = claimPlayerMission(d, player.n, def.id, team?.id);
                      resultMsg = res.msg;
                    });
                    SFX.win();
                    vibrate(30);
                    onToast(resultMsg || `✨ รับรางวัล "${def.name}" แล้ว!`);
                  }}
                  className="flex-1 py-1 mland:py-0.5 px-2.5 rounded-lg bg-gradient-to-b from-[#fad05a] to-[#eab308] text-[#261900] border border-[#ca8a04]/40 text-[11px] mland:text-[9.5px] font-extrabold cursor-pointer hover:brightness-105"
                >
                  ✨ รับรางวัลอัพพลัง
                </button>
              ) : (
                <span className="ml-auto text-[10px] mland:text-[8.5px] font-semibold text-[var(--mut)]">
                  {completedAll ? '🏆 สำเร็จครบทุกขั้น' : mState.focusId === def.id ? '🔥 เร่งพัฒนา +50%' : 'สะสมจากการแข่ง/ซ้อม'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
