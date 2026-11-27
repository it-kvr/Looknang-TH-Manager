import React, { useState } from 'react';
import type { GameState, Player, Team } from '../types/game';
import { TN } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getPlayerCareerSummary } from '../engine/history';
import { StatIconBadge } from './StatIconBadge';
import { OvrBadge } from './OvrBadge';

interface PlayerHistoryPanelProps {
  player: Player;
  team: Team | null;
  state: GameState;
  onOpenSeasonStats?: (season?: number) => void;
}

export const PlayerHistoryPanel: React.FC<PlayerHistoryPanelProps> = ({
  player,
  team,
  state,
  onOpenSeasonStats
}) => {
  const [compScope, setCompScope] = useState<'all' | 'league' | 'cup'>('all');
  const isMe = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
  const careerP = isMe ? state.p : null;
  const summary = getPlayerCareerSummary(player, team, state, careerP);

  const archivedSeasonSet = new Set((state.seasonArchives || []).map((a) => a.season));
  const isUserClubId = (tid: number) => tid === state.me;
  const rows = [
    ...(summary.currentRow ? [{ ...summary.currentRow, isCurrent: true }] : []),
    ...summary.seasons.map((r) => ({ ...r, isCurrent: false }))
  ];

  const isGk = player.pos === 'GK';

  const topApps =
    compScope === 'league'
      ? summary.leagueTotals.apps
      : compScope === 'cup'
        ? summary.cupTotals.apps
        : summary.totalApps;
  const topGoals =
    compScope === 'league'
      ? summary.leagueTotals.goals
      : compScope === 'cup'
        ? summary.cupTotals.goals
        : summary.totalGoals;
  const topAssists =
    compScope === 'league'
      ? summary.leagueTotals.assists
      : compScope === 'cup'
        ? summary.cupTotals.assists
        : summary.totalAssists;
  const topCs =
    compScope === 'league'
      ? summary.leagueTotals.cleanSheets
      : compScope === 'cup'
        ? summary.cupTotals.cleanSheets
        : summary.totalCleanSheets;
  const topMotm =
    compScope === 'league'
      ? summary.leagueTotals.motm
      : compScope === 'cup'
        ? summary.cupTotals.motm
        : summary.totalMotm;
  const topAvg =
    compScope === 'league'
      ? summary.leagueTotals.avgRating
      : compScope === 'cup'
        ? summary.cupTotals.avgRating
        : summary.avgRating;

  return (
    <div className="space-y-3 mland:space-y-2">
      {/* Career Totals Strip */}
      <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 space-y-2 mland:space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">
              สถิติอาชีพตลอดกาล · {player.n}
            </h3>
            <p className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular">
              {player.ro} · อายุ {player.age} ปี
              {careerP ? ` · ทีมชาติไทย ${careerP.ntCaps || 0} นัด (${careerP.ntGoals || 0} ประตู)` : ''}
              {(summary.totalYellow > 0 || summary.totalRed > 0)
                ? ` · วินัย 🟨 ${summary.totalYellow} / 🟥 ${summary.totalRed}`
                : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {summary.honors.length > 0 && (
              <div className="text-[11px] mland:text-[9.5px] font-bold text-[#9a6700] dark:text-[var(--lamp)] tabular">
                🏆 เกียรติยศ {summary.honors.length} รายการ
              </div>
            )}
            <div className="seg-bar bg-[var(--surface-2)]">
              {(
                [
                  ['all', '📊 รวมทั้งหมด'],
                  ['league', '⚽ บอลลีก'],
                  ['cup', `🏆 บอลถ้วย${summary.cupTotals.apps > 0 ? ` (${summary.cupTotals.apps})` : ''}`]
                ] as const
              ).map(([id, lbl]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setCompScope(id);
                  }}
                  className={`seg-btn py-0.5 px-2 text-[10.5px] mland:text-[8.5px] ${
                    compScope === id ? 'seg-btn-active' : ''
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mland:gap-1 pt-1 border-t border-[var(--line)]/70 text-center">
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ซีซั่น</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular">{summary.totalSeasons}</div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ลงเล่น</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular">{topApps}</div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)] flex items-center justify-center gap-1">
              <StatIconBadge kind="goal" size="xs" /> ประตู
            </div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular">{topGoals}</div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)] flex items-center justify-center gap-1">
              {isGk ? <StatIconBadge kind="cleansheet" size="xs" /> : <StatIconBadge kind="assist" size="xs" />} {isGk ? 'คลีนชีต' : 'แอสซิสต์'}
            </div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular">
              {isGk ? topCs : topAssists}
            </div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">MOTM</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular">{topMotm}</div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">เรตติ้งเฉลี่ย</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular text-[var(--g)]">
              {topAvg > 0 ? topAvg.toFixed(2) : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Honors Section */}
      {summary.honors.length > 0 && (
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 space-y-1.5">
          <div className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)]">
            เกียรติยศและแชมป์ในอาชีพ
          </div>
          <div className="divide-y divide-[var(--line)]/60 text-xs mland:text-[10px]">
            {summary.honors.map((h, idx) => (
              <div key={`${h.season}-${idx}`} className="py-1.5 mland:py-1 flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--ink)] truncate">
                  🏆 {h.honor} <span className="text-[var(--mut)] font-normal">· {h.teamName}</span>
                </span>
                <span className="text-[var(--mut)] tabular shrink-0">ซีซั่น {h.season}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season-by-Season Performance Table */}
      <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden">
        <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] flex items-center justify-between gap-2 bg-[var(--surface-2)]/60">
          <span className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)]">
            ประวัติผลงานรายฤดูกาล ·{' '}
            <span className="text-[var(--mut)] font-normal">
              {compScope === 'all' ? 'รวมลีก + บอลถ้วย' : compScope === 'league' ? 'เฉพาะบอลลีก' : 'เฉพาะบอลถ้วย'}
            </span>
          </span>
          <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
            เรียงจากซีซั่นล่าสุด
          </span>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs mland:text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] text-[10.5px] mland:text-[9px] text-[var(--mut)] bg-[var(--surface-2)]/35">
                  <th className="py-1.5 px-2.5 font-semibold whitespace-nowrap">ซีซั่น</th>
                  <th className="py-1.5 px-2 font-semibold">สโมสร / ลีก</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">OVR</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">ลง</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">ยิง</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">จ่าย</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">CS</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">MOTM</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">ใบ</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">เรตติ้ง</th>
                  <th className="py-1.5 px-2.5 font-semibold text-right whitespace-nowrap">เกียรติยศ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]/60">
                {rows.map((r) => {
                  const canDrill = !r.isCurrent && onOpenSeasonStats && isUserClubId(r.teamId) && archivedSeasonSet.has(r.season);
                  const cSp = r.cupSp || 0;
                  const cSg = r.cupSg || 0;
                  const cSa = r.cupSa || 0;
                  const cCs = r.cupCs || 0;
                  const cMotm = r.cupMotm || 0;
                  const cRt = r.cupAvgRating || 0;

                  const rowSp = compScope === 'cup' ? cSp : compScope === 'league' ? r.sp : r.sp + cSp;
                  const rowSg = compScope === 'cup' ? cSg : compScope === 'league' ? r.sg : r.sg + cSg;
                  const rowSa = compScope === 'cup' ? cSa : compScope === 'league' ? r.sa : r.sa + cSa;
                  const rowCs = compScope === 'cup' ? cCs : compScope === 'league' ? r.cs : r.cs + cCs;
                  const rowMotm = compScope === 'cup' ? cMotm : compScope === 'league' ? r.motm : r.motm + cMotm;
                  const rowRt =
                    compScope === 'cup'
                      ? cRt
                      : compScope === 'league'
                        ? r.avgRating
                        : r.sp + cSp > 0
                          ? (r.avgRating * r.sp + cRt * cSp) / Math.max(1, (r.avgRating > 0 ? r.sp : 0) + (cRt > 0 ? cSp : 0))
                          : 0;

                  return (
                    <tr
                      key={`${r.season}-${r.teamName}-${r.isCurrent ? 'cur' : 'past'}`}
                      className={r.isCurrent ? 'bg-[var(--g-soft)]/45 font-medium' : 'hover:bg-[var(--surface-2)]/45'}
                    >
                      <td className="py-1.5 px-2.5 tabular whitespace-nowrap font-bold">
                        S{r.season}
                        {r.isCurrent && (
                          <span className="ml-1 text-[10px] mland:text-[8.5px] font-semibold text-[var(--g)]">
                            (กำลังแข่ง)
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 min-w-[125px] max-w-[200px]">
                        <div className="font-semibold truncate text-[var(--ink)]">{r.teamName}</div>
                        <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">
                          {r.teamId >= 0 ? TN[r.tier] || 'สโมสรทวีป' : 'นอกสโมสร'}
                        </div>
                      </td>
                      <td className="py-1.5 px-1.5 text-center tabular">
                        <OvrBadge ov={r.ov} size="xs" />
                      </td>
                      <td className="py-1.5 px-1.5 text-center tabular font-semibold">{rowSp}</td>
                      <td className="py-1.5 px-1.5 text-center tabular font-bold">{rowSg}</td>
                      <td className="py-1.5 px-1.5 text-center tabular">{rowSa}</td>
                      <td className="py-1.5 px-1.5 text-center tabular text-[var(--mut)]">{rowCs}</td>
                      <td className="py-1.5 px-1.5 text-center tabular text-[var(--mut)]">{rowMotm}</td>
                      <td className="py-1.5 px-1.5 text-center tabular whitespace-nowrap text-[10.5px] mland:text-[9px]">
                        {r.yc > 0 || r.rc > 0 ? `${r.yc}/${r.rc}` : '-'}
                      </td>
                      <td className="py-1.5 px-1.5 text-center tabular font-bold text-[var(--g)]">
                        {rowSp > 0 && rowRt > 0 ? rowRt.toFixed(2) : '-'}
                      </td>
                      <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span className={r.honor ? 'font-bold text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--mut)]'}>
                            {r.honor || '-'}
                          </span>
                          {canDrill && (
                            <button
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                onOpenSeasonStats!(r.season);
                              }}
                              className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] hover:border-[var(--g)] border border-[var(--line)] text-[10px] font-bold cursor-pointer"
                            >
                              สถิติทีม ›
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-[var(--mut)]">
            ยังไม่มีบันทึกสถิติรายฤดูกาล — ลงสนามแข่งขันเพื่อเริ่มสะสมประวัติ
          </div>
        )}
      </div>

      {/* Career Milestones Timeline */}
      <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)]">
            เหตุการณ์สำคัญในเส้นทางค้าแข้ง
          </span>
          <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
            {summary.careerLog.length} บันทึก
          </span>
        </div>
        {summary.careerLog.length > 0 ? (
          <div className="divide-y divide-[var(--line)]/60 text-xs mland:text-[10px]">
            {summary.careerLog.map((line, i) => (
              <div key={i} className="py-1.5 mland:py-1 text-[var(--ink)] leading-relaxed">
                {line}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs mland:text-[10px] text-[var(--mut)] py-2">
            ยังไม่มีเหตุการณ์สำคัญบันทึกไว้ — การย้ายทีม สถิติประตูครบหลักสิบ แฮตทริก และแชมป์จะถูกจดจำที่นี่
          </p>
        )}
      </div>
    </div>
  );
};
