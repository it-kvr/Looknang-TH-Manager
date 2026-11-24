import React, { useMemo, useState } from 'react';
import type { ClubAllTimePlayerRecord, GameState, Player, Team } from '../types/game';
import { TN } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getClubLegacySummary } from '../engine/history';
import { sortTable } from '../engine/simulation';

interface ClubHistoryPanelProps {
  team: Team;
  state: GameState;
  onOpenSeasonStats?: (season?: number) => void;
  onInspectPlayer?: (p: Player, t: Team) => void;
  compact?: boolean;
}

type LegendMetric = 'goals' | 'assists' | 'apps' | 'cleanSheets' | 'motm';

const METRIC_LABELS: [LegendMetric, string][] = [
  ['goals', 'ประตู'],
  ['assists', 'แอสซิสต์'],
  ['apps', 'ลงเล่น'],
  ['cleanSheets', 'คลีนชีต'],
  ['motm', 'MOTM']
];

export const ClubHistoryPanel: React.FC<ClubHistoryPanelProps> = ({
  team,
  state,
  onOpenSeasonStats,
  onInspectPlayer,
  compact
}) => {
  const [legendMetric, setLegendMetric] = useState<LegendMetric>('goals');
  const [showClubLog, setShowClubLog] = useState(false);

  const isUserClub = team.id === state.me;
  const tierTable = useMemo(
    () => (team.tier < 3 ? sortTable(state.teams.filter((t) => t.tier === team.tier)) : []),
    [state.teams, team.tier]
  );
  const curRank = team.tier < 3 ? Math.max(1, tierTable.findIndex((t) => t.id === team.id) + 1) : 1;
  const legacy = useMemo(
    () => getClubLegacySummary(team, state, curRank, tierTable.length || 16),
    [team, state, curRank, tierTable.length]
  );

  const archivedSeasonSet = useMemo(
    () => new Set((state.seasonArchives || []).map((a) => a.season)),
    [state.seasonArchives]
  );

  const trophyCounts = useMemo(() => {
    let league = 0;
    let cup = 0;
    let asia = 0;
    let other = 0;
    legacy.trophies.forEach((tr) => {
      if (tr.type === 'league') league++;
      else if (tr.type === 'cup') cup++;
      else if (tr.type === 'asia') asia++;
      else other++;
    });
    return { league, cup, asia, other };
  }, [legacy.trophies]);

  const sortedLegends = useMemo(() => {
    return legacy.legends
      .filter((r) => (r[legendMetric] || 0) > 0)
      .slice()
      .sort(
        (a: ClubAllTimePlayerRecord, b: ClubAllTimePlayerRecord) =>
          (b[legendMetric] || 0) - (a[legendMetric] || 0) || b.apps - a.apps
      )
      .slice(0, 8);
  }, [legacy.legends, legendMetric]);

  const chronicleRows = useMemo(() => {
    const past = legacy.seasons.map((r) => ({ ...r, isCurrent: false }));
    if (legacy.currentSeasonRow && (legacy.currentSeasonRow.played > 0 || past.length === 0)) {
      return [{ ...legacy.currentSeasonRow, isCurrent: true }, ...past];
    }
    return past;
  }, [legacy.seasons, legacy.currentSeasonRow]);

  const rec = isUserClub ? state.records : undefined;
  const goalDiff = legacy.totalGf - legacy.totalGa;

  return (
    <div className="space-y-3 mland:space-y-2">
      {/* All-Time Overview Strip */}
      <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 space-y-2 mland:space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">
              เกียรติประวัติตลอดกาล · {team.name}
            </h3>
            <p className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular">
              {TN[team.tier] || 'สโมสรทวีป'}
              {legacy.bestLeagueFinish
                ? ` · สถิติลีกดีสุด: อันดับ ${legacy.bestLeagueFinish.rank} ${TN[legacy.bestLeagueFinish.tier]} (S${legacy.bestLeagueFinish.season})`
                : ''}
            </p>
          </div>
          {isUserClub && onOpenSeasonStats && (state.seasonArchives?.length || 0) > 0 && !compact && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onOpenSeasonStats();
              }}
              className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-[11px] mland:text-[9.5px] font-bold cursor-pointer hover:brightness-105 whitespace-nowrap"
            >
              📊 สรุปสถิติซีซั่นที่จบแล้ว
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mland:gap-1 pt-1 border-t border-[var(--line)]/70 text-center">
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ซีซั่นรวม</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular">{legacy.totalSeasons}</div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">แข่งรวม</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular">{legacy.totalPlayed}</div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ชนะ-เสมอ-แพ้</div>
            <div className="font-extrabold text-xs mland:text-[10px] font-display tabular">
              {legacy.totalWon}-{legacy.totalDrawn}-{legacy.totalLost}
            </div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">อัตราชนะ</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular text-[var(--g)]">
              {legacy.winPct.toFixed(1)}%
            </div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ได้ / เสีย</div>
            <div className="font-extrabold text-xs mland:text-[10px] font-display tabular">
              {legacy.totalGf}/{legacy.totalGa} ({goalDiff >= 0 ? `+${goalDiff}` : goalDiff})
            </div>
          </div>
          <div className="py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/80">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ถ้วยรางวัล</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular text-[#9a6700] dark:text-[var(--lamp)]">
              🏆 {legacy.trophies.length}
            </div>
          </div>
        </div>
      </div>

      {/* Trophy Cabinet + Records / Legends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mland:gap-2 items-start">
        {/* Trophy Cabinet */}
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)]">
              ตู้โชว์ถ้วยรางวัล ({legacy.trophies.length})
            </span>
            <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
              ลีก {trophyCounts.league} · ปชช. {trophyCounts.cup} · ทวีป {trophyCounts.asia}
              {trophyCounts.other > 0 ? ` · อื่นๆ ${trophyCounts.other}` : ''}
            </span>
          </div>

          {legacy.trophies.length > 0 ? (
            <div className="divide-y divide-[var(--line)]/60 max-h-52 overflow-y-auto pr-1 text-xs mland:text-[10px]">
              {legacy.trophies.map((tr, i) => (
                <div key={`${tr.season}-${tr.type}-${i}`} className="py-1.5 flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--ink)] truncate">
                    {tr.type === 'asia' ? '🌏' : tr.type === 'cup' ? '🏆' : '🥇'} {tr.title}
                  </span>
                  <span className="text-[var(--mut)] tabular shrink-0">ซีซั่น {tr.season}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs mland:text-[10px] text-[var(--mut)] py-4 text-center">
              ยังไม่มีถ้วยรางวัลในตู้โชว์
            </p>
          )}
        </div>

        {/* All-Time Legends Leaderboard */}
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)]">
              ทำเนียบตำนานสโมสร
            </span>
            <div className="flex flex-wrap items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
              {METRIC_LABELS.map(([mKey, mLabel]) => (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setLegendMetric(mKey);
                  }}
                  className={`px-2 mland:px-1.5 py-0.5 rounded-md text-[10.5px] mland:text-[8.5px] font-bold cursor-pointer transition-colors ${
                    legendMetric === mKey
                      ? 'bg-[var(--g)] text-white'
                      : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  {mLabel}
                </button>
              ))}
            </div>
          </div>

          {sortedLegends.length > 0 ? (
            <div className="divide-y divide-[var(--line)]/60 max-h-52 overflow-y-auto pr-1 text-xs mland:text-[10px]">
              {sortedLegends.map((leg, idx) => {
                const liveSqPlayer = team.sq.find((q) => q.n === leg.name);
                const clickable = !!liveSqPlayer && !!onInspectPlayer;
                const val = leg[legendMetric] || 0;
                return (
                  <div
                    key={leg.name}
                    className="py-1.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="w-5 text-center font-extrabold tabular text-[var(--mut)] shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="min-w-0">
                        {clickable ? (
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              onInspectPlayer!(liveSqPlayer!, team);
                            }}
                            className="font-bold text-[var(--ink)] hover:text-[var(--g)] truncate text-left cursor-pointer block"
                          >
                            {leg.name}
                          </button>
                        ) : (
                          <div className="font-bold text-[var(--ink)] truncate">{leg.name}</div>
                        )}
                        <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular truncate">
                          {leg.ro || leg.pos} · {leg.apps} นัด · {leg.stillAtClub ? 'อยู่ในทีม' : `ล่าสุด S${leg.lastSeason}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right tabular shrink-0">
                      <span className="font-extrabold text-sm mland:text-xs text-[var(--g)]">{val}</span>
                      <span className="text-[10px] text-[var(--mut)] ml-1">
                        {METRIC_LABELS.find((x) => x[0] === legendMetric)?.[1]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs mland:text-[10px] text-[var(--mut)] py-4 text-center">
              ยังไม่มีข้อมูลตำนานสำหรับหมวดนี้ — ลงแข่งเพื่อสร้างสถิติสโมสร
            </p>
          )}
        </div>
      </div>

      {/* User Club All-Time Records */}
      {isUserClub && (
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 space-y-2">
          <div className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)]">
            สถิติสโมสรตลอดกาล
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 divide-y sm:divide-y-0 text-xs mland:text-[10px]">
            <div className="py-1.5 border-b border-[var(--line)]/60 flex justify-between gap-2">
              <span className="text-[var(--mut)]">ชนะขาดสุด</span>
              <b className="truncate text-right tabular">{rec?.bestWin?.txt || '-'}</b>
            </div>
            <div className="py-1.5 border-b border-[var(--line)]/60 flex justify-between gap-2">
              <span className="text-[var(--mut)]">แพ้ขาดสุด</span>
              <b className="truncate text-right tabular">{rec?.worstLoss?.txt || '-'}</b>
            </div>
            <div className="py-1.5 border-b border-[var(--line)]/60 flex justify-between gap-2">
              <span className="text-[var(--mut)]">ชนะรวดสูงสุด</span>
              <b className="tabular">{rec?.winStreak || 0} นัด</b>
            </div>
            <div className="py-1.5 border-b border-[var(--line)]/60 flex justify-between gap-2">
              <span className="text-[var(--mut)]">ไร้พ่ายรวดสูงสุด</span>
              <b className="tabular">{rec?.unbeatenStreak || 0} นัด</b>
            </div>
            <div className="py-1.5 border-b border-[var(--line)]/60 sm:border-b-0 flex justify-between gap-2">
              <span className="text-[var(--mut)]">แต้มสูงสุด/ซีซั่น</span>
              <b className="tabular">{rec?.mostPoints ? `${rec.mostPoints.pts} แต้ม (S${rec.mostPoints.s})` : '-'}</b>
            </div>
            <div className="py-1.5 border-b border-[var(--line)]/60 sm:border-b-0 flex justify-between gap-2">
              <span className="text-[var(--mut)]">ยิงสูงสุด/ซีซั่น</span>
              <b className="tabular">{rec?.mostGoalsSeason ? `${rec.mostGoalsSeason.gf} ลูก (S${rec.mostGoalsSeason.s})` : '-'}</b>
            </div>
            <div className="py-1.5 border-b border-[var(--line)]/60 lg:border-b-0 flex justify-between gap-2">
              <span className="text-[var(--mut)]">ดาวซัลโวซีซั่นเดียว</span>
              <b className="truncate tabular">
                {rec?.topSeasonScorer ? `${rec.topSeasonScorer.n} (${rec.topSeasonScorer.g} · S${rec.topSeasonScorer.s})` : '-'}
              </b>
            </div>
            <div className="py-1.5 flex justify-between gap-2">
              <span className="text-[var(--mut)]">แอสซิสต์ซีซั่นเดียว</span>
              <b className="truncate tabular">
                {rec?.topSeasonAssist ? `${rec.topSeasonAssist.n} (${rec.topSeasonAssist.a} · S${rec.topSeasonAssist.s})` : '-'}
              </b>
            </div>
          </div>
        </div>
      )}

      {/* Season-by-Season Club Chronicle */}
      <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden">
        <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-2)]/60">
          <span className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)]">
            พงศาวดารสโมสรรายฤดูกาล
          </span>
          {isUserClub && state.hist && state.hist.length > 0 && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setShowClubLog((v) => !v);
              }}
              className="text-[11px] mland:text-[9px] font-bold text-[var(--g)] hover:underline cursor-pointer"
            >
              {showClubLog ? 'ดูตารางรายซีซั่น' : `ดูบันทึกเหตุการณ์สโมสร (${state.hist.length})`}
            </button>
          )}
        </div>

        {showClubLog && isUserClub && state.hist && state.hist.length > 0 ? (
          <div className="p-3 mland:p-2 divide-y divide-[var(--line)]/60 max-h-60 overflow-y-auto text-xs mland:text-[10px]">
            {state.hist
              .slice()
              .reverse()
              .map((h, i) => (
                <div key={i} className="py-1.5 leading-relaxed text-[var(--ink)]">
                  {h}
                </div>
              ))}
          </div>
        ) : chronicleRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs mland:text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] text-[10.5px] mland:text-[9px] text-[var(--mut)] bg-[var(--surface-2)]/35">
                  <th className="py-1.5 px-2.5 font-semibold">ซีซั่น</th>
                  <th className="py-1.5 px-2 font-semibold">ลีก</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">อันดับ</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold whitespace-nowrap">แข่ง / ชนะ-เสมอ-แพ้</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">ได้-เสีย</th>
                  <th className="py-1.5 px-1.5 text-center font-semibold">แต้ม</th>
                  <th className="py-1.5 px-2 font-semibold">ถ้วย / ทวีป</th>
                  <th className="py-1.5 px-2 font-semibold">ดาวซัลโวทีม</th>
                  {isUserClub && onOpenSeasonStats && <th className="py-1.5 px-2.5 text-right font-semibold">สถิติ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]/60">
                {chronicleRows.map((r) => {
                  const canDrill = !r.isCurrent && isUserClub && onOpenSeasonStats && archivedSeasonSet.has(r.season);
                  const cupSummary = [
                    r.champion ? '🥇 แชมป์ลีก' : r.nextTier > r.tier ? '⬆ เลื่อนชั้น' : r.nextTier < r.tier ? '⬇ ตกชั้น' : null,
                    r.cupChampion ? '🏆 ถ้วยปชช.' : r.cupStatus && r.cupStatus !== '-' ? r.cupStatus : null,
                    r.asiaChampion ? '🌏 ถ้วยทวีป' : r.asiaStatus && r.asiaStatus !== '-' && r.asiaStatus !== 'ไม่ได้เข้าร่วม' ? r.asiaStatus : null
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <tr
                      key={`${r.season}-${r.isCurrent ? 'cur' : 'past'}`}
                      className={r.isCurrent ? 'bg-[var(--g-soft)]/45 font-medium' : 'hover:bg-[var(--surface-2)]/45'}
                    >
                      <td className="py-1.5 px-2.5 tabular font-bold whitespace-nowrap">
                        S{r.season}
                        {r.isCurrent && (
                          <span className="ml-1 text-[10px] mland:text-[8.5px] font-semibold text-[var(--g)]">
                            (ปัจจุบัน)
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap">{TN[r.tier] || 'สโมสรทวีป'}</td>
                      <td className="py-1.5 px-1.5 text-center tabular font-bold">
                        {r.rank}/{r.totalTeams}
                      </td>
                      <td className="py-1.5 px-1.5 text-center tabular whitespace-nowrap">
                        {r.played} ({r.won}-{r.drawn}-{r.lost})
                      </td>
                      <td className="py-1.5 px-1.5 text-center tabular whitespace-nowrap">
                        {r.gf}-{r.ga}
                      </td>
                      <td className="py-1.5 px-1.5 text-center tabular font-bold">{r.pts}</td>
                      <td className="py-1.5 px-2 max-w-[190px] truncate text-[11px] mland:text-[9px]">
                        {cupSummary || '-'}
                      </td>
                      <td className="py-1.5 px-2 max-w-[140px] truncate text-[var(--mut)]">
                        {r.topScorer || '-'}
                      </td>
                      {isUserClub && onOpenSeasonStats && (
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                          {canDrill ? (
                            <button
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                onOpenSeasonStats(r.season);
                              }}
                              className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-[10.5px] mland:text-[9px] font-bold cursor-pointer"
                            >
                              ดูสถิติทีม ›
                            </button>
                          ) : (
                            <span className="text-[var(--mut)]">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-[var(--mut)]">
            ยังไม่มีบันทึกประวัติศาสตร์ — จบฤดูกาลแรกเพื่อเริ่มบันทึกตำนานสโมสร
          </div>
        )}
      </div>
    </div>
  );
};
