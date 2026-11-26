import React, { useState } from 'react';
import type { CupCompKey, GameState, Player, PlayerCareerProfile, Team } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import { ensureCon, logFin, syncMe, vlu, wagOf } from '../engine/playerCore';
import { CUP_COMP_META, getPlayerCupTotals } from '../engine/simulation';
import { getStaminaMeta } from './StaminaBar';
import { StatIconBadge } from './StatIconBadge';

export interface PlayerCardOverviewBoxProps {
  player: Player;
  state: GameState;
  team?: Team | null;
  careerProfile?: PlayerCareerProfile | null;
  isMePlayer?: boolean;
  isMyTeam?: boolean;
  isRetired?: boolean;
  starterSlot?: string | null;
  onUpdateState?: (updater: (draft: GameState) => void) => void;
  onToast?: (msg: string) => void;
  onOpenSeasonStats?: (season?: number) => void;
}

export const PlayerCardOverviewBox: React.FC<PlayerCardOverviewBoxProps> = ({
  player,
  state,
  team,
  careerProfile,
  isMePlayer = false,
  isMyTeam = false,
  isRetired = false,
  starterSlot = null,
  onUpdateState,
  onToast,
  onOpenSeasonStats
}) => {
  const [statCompScope, setStatCompScope] = useState<'total' | 'league' | 'cup'>(
    careerProfile ? 'total' : 'league'
  );

  const fitMeta = getStaminaMeta(careerProfile ? careerProfile.en : player.fit);
  const fitVal = fitMeta.f;
  const injCount = player.inj ?? careerProfile?.inj ?? 0;
  const susCount = player.sus ?? careerProfile?.sus ?? 0;

  const isInjuredStatus = !isRetired && susCount === 0 && injCount > 0;
  const statusText = isRetired
    ? player.retiredSeason
      ? `👋 แขวนสตั๊ดแล้ว (จบ S${player.retiredSeason})`
      : '👋 แขวนสตั๊ดแล้ว'
    : susCount > 0
      ? `🟥 แบน ${susCount} นัด`
      : injCount > 0
        ? `เจ็บพัก ${injCount} นัด`
        : fitVal < 65
          ? '⚠️ ร่างกายอ่อนล้า'
          : starterSlot
            ? `⭐ ตัวจริง (${starterSlot})`
            : careerProfile
              ? '🪑 ตัวสำรอง'
              : '✅ พร้อมลงสนาม';

  const statusToneCls = isRetired
    ? 'bg-amber-500/10 border-amber-500/35'
    : injCount > 0 || susCount > 0
      ? 'bg-[var(--red-soft)] border-[var(--red)]/40'
      : fitVal < 65 || (careerProfile && !starterSlot)
        ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45'
        : 'bg-[var(--g-soft)] border-[var(--g)]/35';

  const fitCol = isRetired
    ? '#d97706'
    : injCount > 0 || susCount > 0
      ? 'var(--red)'
      : fitMeta.barColor;

  const con = !isRetired && team ? ensureCon(player) : null;

  const cupT = getPlayerCupTotals(player, 'all');
  const lgSp = player.sp || 0;
  const lgSg = player.sg || 0;
  const lgSa = player.sa || 0;
  const lgCs = player.cs || 0;
  const lgRt = (player.sra || 0) > 0 ? ((player.srs || 0) / Math.max(1, player.sra || 1)).toFixed(2) : '-';
  const cupRt = cupT.sra > 0 ? cupT.avgRating.toFixed(2) : '-';

  const totSp = careerProfile ? careerProfile.ap : lgSp + cupT.sp;
  const totSg = careerProfile ? careerProfile.gl : lgSg + cupT.sg;
  const totSa = careerProfile ? careerProfile.as : lgSa + cupT.sa;
  const totCs = lgCs + cupT.cs;
  const totRt = careerProfile
    ? careerProfile.ap
      ? (careerProfile.rs / careerProfile.ap).toFixed(2)
      : '-'
    : (player.sra || 0) + cupT.sra > 0
      ? (((player.srs || 0) + cupT.srs) / Math.max(1, (player.sra || 0) + cupT.sra)).toFixed(2)
      : '-';

  const dispSp = statCompScope === 'cup' ? cupT.sp : statCompScope === 'league' ? lgSp : totSp;
  const dispSg = statCompScope === 'cup' ? cupT.sg : statCompScope === 'league' ? lgSg : totSg;
  const disp3 =
    player.pos === 'GK'
      ? statCompScope === 'cup'
        ? cupT.cs
        : statCompScope === 'league'
          ? lgCs
          : totCs
      : statCompScope === 'cup'
        ? cupT.sa
        : statCompScope === 'league'
          ? lgSa
          : totSa;
  const dispRt = statCompScope === 'cup' ? cupRt : statCompScope === 'league' ? lgRt : totRt;

  const playedCups = (['cup', 'lc', 'dc', 'sc', 'asia'] as CupCompKey[]).filter(
    (k) => (player.cupStats?.[k]?.sp || 0) > 0
  );

  const curTurn = state.season * 40 + state.md;
  const medLv = state.med ?? 1;
  const physioLv = state.staff?.physio ?? 0;
  const treatCost = Math.max(4, 14 - Math.floor(medLv * 1.1) - physioLv);
  const alreadyTreated = player.treatedMd === curTurn;

  const canCareerPhysio =
    !isRetired && injCount > 0 && isMePlayer && state.mode === 'p' && !!careerProfile && !!onUpdateState;
  const canManagerPhysio =
    !isRetired && injCount > 0 && isMyTeam && state.mode === 'm' && !!onUpdateState;

  const recentFm = (careerProfile?.fm || []).slice(-5);
  const recentAvg = recentFm.length
    ? recentFm.reduce((sum, val) => sum + val, 0) / recentFm.length
    : 0;
  const lastRt = recentFm.length ? recentFm[recentFm.length - 1] : 0;
  const prevRt = recentFm.length >= 2 ? recentFm[recentFm.length - 2] : lastRt;
  const trendLabel =
    recentFm.length < 2
      ? recentFm.length === 1
        ? 'นัดแรก'
        : 'รอลงสนาม'
      : lastRt >= 7.8 || (lastRt - prevRt >= 0.45 && recentAvg >= 7.1)
        ? '🔥 ร้อนแรง'
        : lastRt - prevRt <= -0.55
          ? '↘ แผ่ว'
          : recentAvg >= 7.1
            ? '✨ คงเส้น'
            : '⚖️ ทรงตัว';
  const avgCls =
    recentAvg >= 8.0
      ? 'text-[#9a6700] dark:text-[#fde047]'
      : recentAvg >= 7.1
        ? 'text-[var(--g)]'
        : recentAvg >= 6.4
          ? 'text-sky-600 dark:text-sky-400'
          : 'text-[var(--red)]';

  return (
    <div className="shrink-0 p-2 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-col gap-1.5 mland:gap-1">
      {/* Status Row */}
      <div className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg border text-[10.5px] mland:text-[8.5px] space-y-1 ${statusToneCls}`}>
        <div className="flex items-center justify-between font-bold gap-1">
          <span className="truncate tabular inline-flex items-center gap-1" style={{ color: fitCol }}>
            {isInjuredStatus && <StatIconBadge kind="injury" size="xs" />}
            <span className="truncate">
              {statusText}
              {!isRetired && ` · ⚡${fitVal}%`}
            </span>
          </span>
        </div>

        {canCareerPhysio && (
          <button
            type="button"
            disabled={(careerProfile.rep ?? 10) < 4}
            onClick={() => {
              SFX.tap();
              onUpdateState((d) => {
                if (!d.p || (d.p.rep ?? 10) < 4) return;
                d.p.rep = (d.p.rep ?? 10) - 4;
                d.p.inj = Math.max(0, (d.p.inj ?? injCount) - 1);
                d.p.en = clamp((d.p.en ?? 80) + 12, 35, 100);
                syncMe(d);
              });
              onToast?.(
                injCount - 1 <= 0
                  ? '💆 กายภาพส่วนตัวสำเร็จ! คุณหายเจ็บพร้อมลงสนามแล้ว'
                  : `💆 กายภาพส่วนตัวสำเร็จ! ลดวันพักเหลือ ${injCount - 1} นัด (+12% พลังกาย)`
              );
            }}
            className="btn btn-xs btn-primary w-full"
          >
            💆 กายภาพ (-1 นัด · +12% ฟิต · 4 ★)
          </button>
        )}

        {canManagerPhysio && (
          <button
            type="button"
            disabled={alreadyTreated || state.money < treatCost}
            onClick={() => {
              SFX.tap();
              onUpdateState((d) => {
                const sq = d.teams[d.me].sq;
                const pl = sq.find((q) => q.n === player.n);
                if (!pl || pl.inj <= 0 || pl.treatedMd === curTurn || d.money < treatCost) return;
                d.money -= treatCost;
                logFin(d, `กายภาพบำบัด ${pl.n}`, -treatCost);
                pl.inj = Math.max(0, pl.inj - 1);
                pl.fit = clamp((pl.fit ?? 70) + 10, 40, 100);
                pl.treatedMd = curTurn;
              });
              onToast?.(
                injCount - 1 <= 0
                  ? `💉 รักษา ${player.n} หายเจ็บพร้อมลงสนามแล้ว!`
                  : `💉 ทำกายภาพ ${player.n} ลดวันพักเหลือ ${injCount - 1} นัด (+10% ฟิต)`
              );
            }}
            className="btn btn-xs btn-primary w-full"
          >
            {alreadyTreated
              ? '✅ ทำกายภาพรอบนี้แล้ว'
              : `💉 กายภาพด่วน (-1 นัด · ${fmtMoney(treatCost)})`}
          </button>
        )}
      </div>

      {/* Unified 3-Scope Stats Strip */}
      <div className="space-y-1">
        <div className="seg-bar w-full grid grid-cols-3">
          {(
            [
              ['total', careerProfile ? '🌟 อาชีพ' : '📊 รวม'],
              ['league', '⚽ บอลลีก'],
              ['cup', `🏆 บอลถ้วย${cupT.sp > 0 ? ` (${cupT.sp})` : ''}`]
            ] as const
          ).map(([id, lbl]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                SFX.tap();
                setStatCompScope(id);
              }}
              className={`seg-btn py-0.5 px-1 text-[9.5px] mland:text-[7.5px] justify-center ${
                statCompScope === id ? 'seg-btn-active' : ''
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
            <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">👕 ลง</div>
            <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none">{dispSp}</div>
          </div>
          <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
            <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">⚽ ยิง</div>
            <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none">{dispSg}</div>
          </div>
          <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
            <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none flex items-center justify-center gap-0.5">
              {player.pos === 'GK' ? (
                <>
                  <StatIconBadge kind="cleansheet" size="xs" />
                  <span>คลีน</span>
                </>
              ) : (
                '👟 จ่าย'
              )}
            </div>
            <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none">{disp3}</div>
          </div>
          <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
            <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">⭐ เรต</div>
            <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none text-[#8a5b00] dark:text-[#fde047]">
              {dispRt}
            </div>
          </div>
        </div>

        {statCompScope === 'cup' && playedCups.length > 0 && (
          <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]/70 text-[9px] mland:text-[7.5px] text-[var(--mut)] tabular leading-snug">
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              {playedCups.map((ck) => {
                const m = CUP_COMP_META[ck];
                const st = player.cupStats![ck]!;
                return (
                  <span key={ck} className="inline-flex items-center gap-0.5 whitespace-nowrap">
                    <span>{m.icon} <b className="text-[var(--ink)]">{m.short}</b> {st.sp}น{st.sg > 0 ? `·${st.sg}⚽` : ''}</span>
                    {player.pos === 'GK' ? (
                      st.cs > 0 ? (
                        <span className="inline-flex items-center gap-0.5">·{st.cs}<StatIconBadge kind="cleansheet" size="xs" /></span>
                      ) : null
                    ) : st.sa > 0 ? (
                      <span>·{st.sa}👟</span>
                    ) : null}
                    {st.motm > 0 ? <span>·{st.motm}👑</span> : null}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Market Value & Contract Strip (Always visible for active players) */}
      {!isRetired && (
        <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)] flex items-center justify-between gap-1.5 text-[10px] mland:text-[8px]">
          <span className="font-bold text-[var(--g)] tabular truncate">💎 {fmtMoney(vlu(player))}</span>
          <span className="text-[var(--mut)] tabular shrink-0">
            {con ? `${con.yr} ปี · ` : player.free ? 'ฟรี · ' : ''}
            <b className="text-[var(--ink)]">{fmtMoneyNum(con ? con.wg : wagOf(player))}</b>/นัด
          </span>
        </div>
      )}

      {/* National Team & Season Stats Shortcut (Career Profile) */}
      {careerProfile && (
        <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)] flex items-center justify-between gap-1.5">
          <span className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] font-semibold truncate">
            🇹🇭 ทีมชาติ <b className="text-[var(--ink)] tabular">{careerProfile.ntCaps || 0} นัด · {careerProfile.ntGoals || 0} ลูก</b>
          </span>
          {onOpenSeasonStats && (state.seasonArchives?.length || 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onOpenSeasonStats();
              }}
              className="btn btn-xs btn-surface shrink-0"
            >
              📊 ซีซั่น ({state.seasonArchives!.length})
            </button>
          )}
        </div>
      )}

      {/* Last 5 Matches Form Strip (Career Profile) */}
      {careerProfile && (
        <div className="p-1.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/70 space-y-1 mland:space-y-0.5 text-left">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[9.5px] mland:text-[7.5px] font-bold text-[var(--mut)] truncate">ฟอร์ม 5 นัด</span>
              <span className="text-[9px] mland:text-[7px] font-bold text-[var(--ink)]/80 truncate">· {trendLabel}</span>
            </div>
            {recentFm.length > 0 && (
              <span className={`text-[9.5px] mland:text-[7.5px] font-extrabold tabular shrink-0 ${avgCls}`}>
                {recentAvg.toFixed(1)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }).map((_, idx) => {
              const val = recentFm[idx];
              if (val == null) {
                return (
                  <div
                    key={idx}
                    className="rounded-md border border-dashed border-[var(--line)]/80 bg-[var(--surface)]/45 py-0.5 flex flex-col items-center justify-end gap-0.5 text-[var(--mut)]/55"
                  >
                    <div className="w-full px-1 h-2.5 mland:h-2 flex items-end justify-center">
                      <span className="w-1.5 h-[2px] rounded-full bg-current opacity-50" />
                    </div>
                    <span className="text-[8.5px] mland:text-[7px] font-bold tabular leading-none">-</span>
                  </div>
                );
              }
              const isLatest = idx === recentFm.length - 1;
              const tier =
                val >= 8.2
                  ? {
                      box: 'bg-amber-400/20 border-amber-400/65 text-[#8a5b00] dark:text-[#fde047]',
                      bar: '#f59e0b'
                    }
                  : val >= 7.2
                    ? {
                        box: 'bg-emerald-500/15 border-emerald-500/45 text-emerald-700 dark:text-emerald-300',
                        bar: '#10b981'
                      }
                    : val >= 6.4
                      ? {
                          box: 'bg-sky-500/12 border-sky-500/35 text-sky-700 dark:text-sky-300',
                          bar: '#38bdf8'
                        }
                      : {
                          box: 'bg-rose-500/14 border-rose-500/45 text-rose-700 dark:text-rose-300',
                          bar: '#f43f5e'
                        };
              const pct = clamp(Math.round(((val - 4.5) / 5.5) * 100), 18, 100);
              return (
                <div
                  key={idx}
                  title={`นัดที่ ${idx + 1}${isLatest ? ' (ล่าสุด)' : ''}: เรตติ้ง ${val.toFixed(1)}`}
                  className={`rounded-md border py-0.5 flex flex-col items-center justify-end gap-0.5 transition-all ${tier.box} ${
                    isLatest ? 'ring-1 ring-[var(--ink)]/25 shadow-2xs' : 'opacity-90'
                  }`}
                >
                  <div className="w-full px-1 h-2.5 mland:h-2 flex items-end justify-center">
                    <div className="w-2 mland:w-1.5 h-full rounded-sm bg-black/10 dark:bg-white/10 overflow-hidden flex items-end">
                      <div
                        className="w-full rounded-sm"
                        style={{ height: `${pct}%`, background: tier.bar }}
                      />
                    </div>
                  </div>
                  <span className={`text-[9px] mland:text-[7px] tabular leading-none ${isLatest ? 'font-black' : 'font-extrabold'}`}>
                    {val.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
