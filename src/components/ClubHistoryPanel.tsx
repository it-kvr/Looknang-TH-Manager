import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { ClubAllTimePlayerRecord, GameState, Player, Team, TrophyRecord } from '../types/game';
import { TN } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getClubLegacySummary } from '../engine/history';
import { sortTable, ensureTeamFans, fmtFans } from '../engine/simulation';
import { PlayerFace } from './SvgVisuals';

interface ClubHistoryPanelProps {
  team: Team;
  state: GameState;
  onOpenSeasonStats?: (season?: number) => void;
  onInspectPlayer?: (p: Player, t: Team) => void;
  compact?: boolean;
}

type LegendMetric = 'goals' | 'assists' | 'apps' | 'cleanSheets' | 'motm';

const METRIC_COLUMNS: {
  key: LegendMetric;
  label: string;
  icon: string;
  unit: string;
  accentCls: string;
  headerBgCls: string;
}[] = [
  {
    key: 'goals',
    label: 'ประตู',
    icon: '⚽',
    unit: 'ประตู',
    accentCls: 'text-emerald-700 dark:text-emerald-300',
    headerBgCls: 'bg-emerald-500/10'
  },
  {
    key: 'assists',
    label: 'แอสซิสต์',
    icon: '🎯',
    unit: 'ครั้ง',
    accentCls: 'text-sky-700 dark:text-sky-300',
    headerBgCls: 'bg-sky-500/10'
  },
  {
    key: 'apps',
    label: 'ลงเล่น',
    icon: '👕',
    unit: 'นัด',
    accentCls: 'text-violet-700 dark:text-violet-300',
    headerBgCls: 'bg-violet-500/10'
  },
  {
    key: 'cleanSheets',
    label: 'คลีนชีต',
    icon: '🧤',
    unit: 'นัด',
    accentCls: 'text-teal-700 dark:text-teal-300',
    headerBgCls: 'bg-teal-500/10'
  },
  {
    key: 'motm',
    label: 'MOTM',
    icon: '👑',
    unit: 'ครั้ง',
    accentCls: 'text-amber-700 dark:text-amber-300',
    headerBgCls: 'bg-amber-500/10'
  }
];

function formatSeasonSpan(leg: ClubAllTimePlayerRecord): string {
  const arr = (leg.playedSeasons || []).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (arr.length > 0) {
    const parts: string[] = [];
    let start = arr[0];
    let prev = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === prev + 1) {
        prev = arr[i];
      } else {
        parts.push(start === prev ? `${start}` : `${start}–${prev}`);
        start = arr[i];
        prev = arr[i];
      }
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    return `S${parts.join(', ')}`;
  }
  const first = leg.firstSeason ? Math.floor(leg.firstSeason) : 0;
  const last = Math.max(1, Math.floor(leg.lastSeason || 1));
  if (first > 0 && first < last) return `S${first}–${last}`;
  return `S${last}`;
}

export const TrophySvg: React.FC<{
  type: TrophyRecord['type'];
  tier?: number;
  uid: string;
  size?: number;
  muted?: boolean;
}> = ({ type, tier, uid, size = 54, muted = false }) => {
  const isAsia = type === 'asia';
  const isCup = type === 'cup';
  const isAward = type === 'award' || type === 'nt';
  const isSilverLeague = type === 'league' && tier === 1;
  const isBronzeLeague = type === 'league' && (tier === 0 || tier == null);

  // Palette per trophy prestige
  const mainStops = isCup || isSilverLeague
    ? ['#ffffff', '#cbd5e1', '#94a3b8', '#64748b']
    : isBronzeLeague
      ? ['#fde68a', '#f59e0b', '#b45309', '#78350f']
      : ['#fef9c3', '#facc15', '#eab308', '#a16207'];

  const trimCol = isAsia ? '#10b981' : isCup ? '#eab308' : isSilverLeague ? '#facc15' : '#fef08a';
  const baseCol = isAsia ? '#064e3b' : isCup ? '#1e293b' : '#291d09';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={muted ? 'opacity-30 grayscale' : 'drop-shadow-[0_4px_8px_rgba(0,0,0,0.22)]'}
    >
      <defs>
        <linearGradient id={`tg-${uid}`} x1="14" y1="8" x2="50" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mainStops[0]} />
          <stop offset="0.32" stopColor={mainStops[1]} />
          <stop offset="0.72" stopColor={mainStops[2]} />
          <stop offset="1" stopColor={mainStops[3]} />
        </linearGradient>
        <linearGradient id={`tb-${uid}`} x1="18" y1="48" x2="46" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={baseCol} />
          <stop offset="1" stopColor="#090d0b" />
        </linearGradient>
      </defs>

      {isAward ? (
        <>
          {/* Laurel / Star Plaque */}
          <circle cx="32" cy="27" r="17" fill={`url(#tg-${uid})`} stroke={mainStops[3]} strokeWidth="1.4" />
          <circle cx="32" cy="27" r="13" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1" />
          <path
            d="M32 16l3.1 6.3 6.9 1-5 4.9 1.2 6.8L32 31.8 25.8 35l1.2-6.8-5-4.9 6.9-1L32 16z"
            fill="#ffffff"
            fillOpacity="0.92"
          />
          <rect x="20" y="47" width="24" height="5" rx="1.5" fill={`url(#tb-${uid})`} />
          <rect x="16" y="52" width="32" height="6" rx="2" fill={`url(#tb-${uid})`} stroke={trimCol} strokeWidth="0.9" />
          <rect x="23" y="54" width="18" height="2" rx="1" fill={trimCol} opacity="0.85" />
        </>
      ) : isAsia ? (
        <>
          {/* Ornate Continental Globe Chalice */}
          <path
            d="M17 19c-5.5 0-8.5 3.5-8.5 8 0 4.5 3.8 7.5 9.5 7.5M47 19c5.5 0 8.5 3.5 8.5 8 0 4.5-3.8 7.5-9.5 7.5"
            stroke={`url(#tg-${uid})`}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Crown Tips */}
          <path d="M23 11l3-4 6 3 6-3 3 4" fill={trimCol} />
          {/* Bowl */}
          <path
            d="M18 12h28l-2.2 17.5c-.8 6.5-5.8 11-11.8 11s-11-4.5-11.8-11L18 12z"
            fill={`url(#tg-${uid})`}
            stroke={mainStops[3]}
            strokeWidth="1.2"
          />
          <path d="M21 15h4l1 15c.2 3 1.4 5.8 3 7.5-4.2-1.2-7-4.8-7.5-9.2L21 15z" fill="#ffffff" fillOpacity="0.32" />
          {/* Continental Star Medallion */}
          <circle cx="32" cy="24" r="6.5" fill={baseCol} stroke={trimCol} strokeWidth="1.4" />
          <path d="M32 19.2l1.4 2.9 3.2.5-2.3 2.2.6 3.2L32 26.5l-2.9 1.5.6-3.2-2.3-2.2 3.2-.5L32 19.2z" fill="#fde047" />
          {/* Stem & Pedestal */}
          <rect x="29" y="40.5" width="6" height="7" rx="1.5" fill={`url(#tg-${uid})`} />
          <path d="M22 47.5h20l2 4.5H20l2-4.5z" fill={trimCol} />
          <rect x="17" y="52" width="30" height="7" rx="2" fill={`url(#tb-${uid})`} stroke={trimCol} strokeWidth="0.9" />
          <rect x="23" y="54.5" width="18" height="2" rx="1" fill="#fde047" opacity="0.9" />
        </>
      ) : isCup ? (
        <>
          {/* Classic Two-Handled Cup */}
          <path
            d="M19 16c-5 0-8 2.8-8 7.5 0 4.8 3.6 8 9.2 8M45 16c5 0 8 2.8 8 7.5 0 4.8-3.6 8-9.2 8"
            stroke={`url(#tg-${uid})`}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse cx="32" cy="13" rx="14" ry="3.2" fill={trimCol} />
          <path
            d="M18 13h28l-2 16c-.8 7-5.6 11.5-12 11.5S20.8 36 20 29L18 13z"
            fill={`url(#tg-${uid})`}
            stroke={mainStops[3]}
            strokeWidth="1.2"
          />
          <path d="M21.5 16h3.8l1.2 15c.3 3.2 1.4 5.5 2.8 7-3.8-1-6.5-4.3-7-8.7L21.5 16z" fill="#ffffff" fillOpacity="0.45" />
          {/* Gold Collar Ring */}
          <rect x="27.5" y="40.2" width="9" height="3" rx="1.5" fill={trimCol} />
          <path d="M28.5 43h7l1.5 5h-10l1.5-5z" fill={`url(#tg-${uid})`} />
          <rect x="21" y="48" width="22" height="3.5" rx="1.2" fill={trimCol} />
          <rect x="17" y="51.5" width="30" height="7.5" rx="2" fill={`url(#tb-${uid})`} stroke={trimCol} strokeWidth="0.9" />
          <rect x="24" y="54.2" width="16" height="2" rx="1" fill={trimCol} opacity="0.9" />
        </>
      ) : (
        <>
          {/* League Championship Trophy */}
          <path
            d="M19.5 14.5c-4.8-.5-8 2.2-8 6.8 0 4.4 3.4 7.7 8.8 8.2M44.5 14.5c4.8-.5 8 2.2 8 6.8 0 4.4-3.4 7.7-8.8 8.2"
            stroke={`url(#tg-${uid})`}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M19 11.5h26l-1.8 17c-.7 6.8-5.3 11.5-11.2 11.5S21.5 35.3 20.8 28.5L19 11.5z"
            fill={`url(#tg-${uid})`}
            stroke={mainStops[3]}
            strokeWidth="1.2"
          />
          {/* Rim highlight & specular shine */}
          <ellipse cx="32" cy="11.5" rx="13" ry="2.4" fill={mainStops[0]} stroke={mainStops[3]} strokeWidth="0.8" />
          <path d="M22 15h3.5l1.1 14.5c.3 3 1.2 5.2 2.4 6.7-3.4-1-5.8-4.2-6.2-8.2L22 15z" fill="#ffffff" fillOpacity="0.38" />
          {/* League Emblem */}
          <path
            d="M32 18.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L32 26.7l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5 1.6-3.3z"
            fill="#ffffff"
            fillOpacity="0.88"
          />
          {/* Stem & Pedestal */}
          <rect x="28.5" y="40" width="7" height="7.5" rx="1.5" fill={`url(#tg-${uid})`} />
          <rect x="22" y="47.5" width="20" height="3.5" rx="1.2" fill={mainStops[1]} />
          <rect x="17" y="51" width="30" height="8" rx="2" fill={`url(#tb-${uid})`} stroke={trimCol} strokeWidth="0.9" />
          <rect x="23.5" y="54" width="17" height="2.2" rx="1" fill={trimCol} opacity="0.92" />
        </>
      )}
    </svg>
  );
};

export const ClubHistoryPanel: React.FC<ClubHistoryPanelProps> = ({
  team,
  state,
  onOpenSeasonStats,
  onInspectPlayer,
  compact
}) => {
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

  const columnLeaders = useMemo(() => {
    const out: Record<LegendMetric, ClubAllTimePlayerRecord[]> = {
      goals: [],
      assists: [],
      apps: [],
      cleanSheets: [],
      motm: []
    };
    METRIC_COLUMNS.forEach((col) => {
      out[col.key] = legacy.legends
        .filter((r) => (r[col.key] || 0) > 0)
        .slice()
        .sort(
          (a: ClubAllTimePlayerRecord, b: ClubAllTimePlayerRecord) =>
            (b[col.key] || 0) - (a[col.key] || 0) ||
            b.bestAvgRating - a.bestAvgRating ||
            b.apps - a.apps ||
            b.goals - a.goals
        )
        .slice(0, 10);
    });
    return out;
  }, [legacy.legends]);

  const hasAnyLegend = useMemo(
    () => METRIC_COLUMNS.some((col) => columnLeaders[col.key].length > 0),
    [columnLeaders]
  );

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
    <div className="space-y-3 mland:space-y-2 pb-3">
      {/* All-Time Overview Strip */}
      <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3.5 mland:p-2.5 space-y-2.5 mland:space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)] truncate">
              เกียรติประวัติตลอดกาล · {team.name}
            </h3>
            <p className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular truncate">
              {TN[team.tier] || 'สโมสรทวีป'} · แฟนบอล {fmtFans(ensureTeamFans(team))} คน
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
              className="btn btn-sm btn-primary shrink-0"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>สรุปสถิติซีซั่นที่จบแล้ว</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mland:gap-1 pt-2 mland:pt-1.5 border-t border-[var(--line)]/70 text-center">
          <div className="py-1.5 mland:py-1 px-1 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/50">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ซีซั่นรวม</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular text-[var(--ink)]">{legacy.totalSeasons}</div>
          </div>
          <div className="py-1.5 mland:py-1 px-1 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/50">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">แข่งรวม</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular text-[var(--ink)]">{legacy.totalPlayed}</div>
          </div>
          <div className="py-1.5 mland:py-1 px-1 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/50">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ชนะ-เสมอ-แพ้</div>
            <div className="font-extrabold text-xs mland:text-[10px] font-display tabular text-[var(--ink)]">
              {legacy.totalWon}-{legacy.totalDrawn}-{legacy.totalLost}
            </div>
          </div>
          <div className="py-1.5 mland:py-1 px-1 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/50">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">อัตราชนะ</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular text-[var(--g)]">
              {legacy.winPct.toFixed(1)}%
            </div>
          </div>
          <div className="py-1.5 mland:py-1 px-1 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/50">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ได้ / เสีย</div>
            <div className="font-extrabold text-xs mland:text-[10px] font-display tabular text-[var(--ink)]">
              {legacy.totalGf}/{legacy.totalGa} ({goalDiff >= 0 ? `+${goalDiff}` : goalDiff})
            </div>
          </div>
          <div className="py-1.5 mland:py-1 px-1 rounded-xl bg-[var(--lamp-soft)]/70 border border-[var(--lamp)]/35">
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ถ้วยรางวัล</div>
            <div className="font-extrabold text-sm mland:text-xs font-display tabular text-[#8f5d00] dark:text-[var(--lamp)]">
              {legacy.trophies.length} ใบ
            </div>
          </div>
        </div>
      </div>

      {/* Trophy Cabinet Showcase + Independent-Column Club Hall of Fame */}
      <div className="space-y-3 mland:space-y-2">
        {/* Trophy Cabinet */}
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3.5 mland:p-2.5 flex flex-col gap-2.5 mland:gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mland:pb-1.5 border-b border-[var(--line)]/70">
            <span className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">
              ตู้โชว์ถ้วยรางวัล ({legacy.trophies.length})
            </span>
            <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
              ลีก {trophyCounts.league} · ปชช. {trophyCounts.cup} · ทวีป {trophyCounts.asia}
              {trophyCounts.other > 0 ? ` · อื่นๆ ${trophyCounts.other}` : ''}
            </span>
          </div>

          {legacy.trophies.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mland:gap-1.5 content-start">
              {legacy.trophies.map((tr, i) => {
                const isGoldGlow = tr.type === 'asia' || (tr.type === 'league' && tr.tier === 2) || tr.type === 'award' || tr.type === 'nt';
                const shelfBarClass =
                  tr.type === 'cup' || (tr.type === 'league' && tr.tier === 1)
                    ? 'from-slate-400/20 via-slate-300/75 to-slate-400/20'
                    : 'from-amber-500/20 via-amber-400/80 to-amber-500/20';

                return (
                  <div
                    key={`${tr.season}-${tr.type}-${i}`}
                    className="relative rounded-xl border border-[var(--line)]/85 bg-gradient-to-b from-[var(--surface-2)]/35 via-[var(--surface)] to-[var(--surface-2)]/80 p-2.5 mland:p-1.5 flex flex-col items-center text-center overflow-hidden"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full blur-md opacity-45"
                      style={{
                        background: isGoldGlow
                          ? 'radial-gradient(circle, rgba(245, 194, 66, 0.35), transparent 72%)'
                          : 'radial-gradient(circle, rgba(148, 163, 184, 0.32), transparent 72%)'
                      }}
                    />
                    <div className="relative z-10 flex flex-col items-center">
                      <TrophySvg type={tr.type} tier={tr.tier} uid={`tr-${compact ? 'c' : 'f'}-${team.id}-${i}`} size={50} />
                      <div className={`w-12 h-1 rounded-full bg-gradient-to-r ${shelfBarClass} mt-0.5`} />
                    </div>
                    <div className="relative z-10 text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] leading-snug line-clamp-2 mt-1.5 min-h-[28px] mland:min-h-[24px] flex items-center">
                      {tr.title}
                    </div>
                    <div className="relative z-10 text-[10px] mland:text-[8.5px] font-semibold text-[#9a6700] dark:text-[var(--lamp)] tabular mt-0.5">
                      ซีซั่น {tr.season}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-5 mland:py-3 px-4 text-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-2)]/30">
              <TrophySvg type="league" tier={2} uid={`empty-${compact ? 'c' : 'f'}-${team.id}`} size={44} muted />
              <div className="text-xs mland:text-[10.5px] font-semibold text-[var(--ink)] mt-1.5">
                ยังไม่มีถ้วยรางวัลในตู้โชว์
              </div>
              <p className="text-[11px] mland:text-[9px] text-[var(--mut)] mt-0.5">
                คว้าแชมป์ลีก บอลถ้วย หรือทัวร์นาเมนต์ทวีปเพื่อนำถ้วยมาจัดแสดงที่นี่
              </p>
            </div>
          )}
        </div>

        {/* All-Time Legends Hall of Fame — 5 Independent Stat Columns */}
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)]/70 flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-2)]/40">
            <span className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">
              ทำเนียบตำนานสโมสร
            </span>
            <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
              แยกอันดับอิสระในแต่ละหมวด (สูงสุด 10 อันดับ/หมวด)
            </span>
          </div>

          {hasAnyLegend ? (
            <div className="p-2 mland:p-1.5 bg-[var(--surface-2)]/20 overflow-x-auto">
              <div className="grid grid-cols-5 gap-1.5 mland:gap-1 min-w-[600px] sm:min-w-0 mland:min-w-0 w-full">
                {METRIC_COLUMNS.map((col) => {
                  const list = columnLeaders[col.key];

                  return (
                    <div
                      key={col.key}
                      className="flex flex-col min-w-0 rounded-xl mland:rounded-lg border border-[var(--line)]/85 bg-[var(--surface)] overflow-hidden"
                    >
                      <div
                        className={`px-2 py-1.5 mland:px-1.5 mland:py-1 border-b border-[var(--line)] bg-[var(--surface)] ${col.headerBgCls} flex items-center justify-between gap-1`}
                      >
                        <span className={`font-extrabold text-[10.5px] mland:text-[9px] ${col.accentCls} truncate`}>
                          {col.icon} {col.label}
                        </span>
                        <span className="text-[9px] mland:text-[7.5px] text-[var(--mut)] shrink-0">
                          {col.unit}
                        </span>
                      </div>

                      {list.length > 0 ? (
                        <div className="divide-y divide-[var(--line)]/50">
                          {list.map((leg, idx) => {
                            const liveSqPlayer = team.sq.find((q) => q.n === leg.name);
                            const clickable = !!liveSqPlayer && !!onInspectPlayer;
                            const facePlayer: Partial<Player> = liveSqPlayer || {
                              n: leg.name,
                              pos: leg.pos,
                              ro: leg.ro,
                              no: leg.no,
                              vis: leg.vis
                            };
                            const seasonText = formatSeasonSpan(leg);
                            const val = leg[col.key] || 0;
                            const rankCls =
                              idx === 0
                                ? 'bg-amber-400/20 text-[#9a6700] dark:text-[var(--lamp)] border-amber-400/45'
                                : idx === 1
                                  ? 'bg-slate-400/20 text-slate-600 dark:text-slate-200 border-slate-400/40'
                                  : idx === 2
                                    ? 'bg-amber-700/20 text-amber-700 dark:text-amber-300 border-amber-600/40'
                                    : 'text-[var(--mut)] border-transparent';

                            return (
                              <div
                                key={`${col.key}-${leg.name}`}
                                className="px-1.5 py-1.5 mland:px-1 mland:py-1 flex items-center gap-1 hover:bg-[var(--surface-2)]/35 transition-colors"
                              >
                                <span
                                  className={`inline-flex items-center justify-center w-4 h-4 mland:w-3.5 mland:h-3.5 rounded border text-[9px] mland:text-[8px] font-extrabold tabular shrink-0 ${rankCls}`}
                                >
                                  {idx + 1}
                                </span>
                                <div className="w-6 h-6 mland:w-5 mland:h-5 rounded-lg mland:rounded-md bg-[var(--surface-2)] border border-[var(--line)]/70 flex items-center justify-center overflow-hidden shrink-0 [&>svg]:w-6 [&>svg]:h-6 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                                  <PlayerFace
                                    player={facePlayer}
                                    team={team}
                                    state={state}
                                    club={state.club}
                                    isMyClub={isUserClub}
                                    size={24}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  {clickable ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        SFX.tap();
                                        onInspectPlayer!(liveSqPlayer!, team);
                                      }}
                                      className="font-bold text-[10.5px] mland:text-[9px] text-[var(--ink)] hover:text-[var(--g)] truncate text-left cursor-pointer block w-full"
                                    >
                                      {leg.name}
                                    </button>
                                  ) : (
                                    <div className="font-bold text-[10.5px] mland:text-[9px] text-[var(--ink)] truncate">
                                      {leg.name}
                                    </div>
                                  )}
                                  <div className="text-[8.5px] mland:text-[7.5px] text-[var(--mut)] tabular truncate">
                                    {leg.ro || leg.pos} · {seasonText}
                                    {leg.stillAtClub && (
                                      <span className="text-[var(--g)] font-semibold"> · ทีมนี้</span>
                                    )}
                                  </div>
                                </div>
                                <span
                                  className={`font-extrabold text-[11px] mland:text-[9.5px] tabular shrink-0 pl-0.5 ${
                                    idx === 0 ? col.accentCls : 'text-[var(--ink)]'
                                  }`}
                                >
                                  {val}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center py-6 px-2 text-[10px] mland:text-[8.5px] text-[var(--mut)]/75 text-center">
                          ยังไม่มีสถิติ
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-6 text-xs mland:text-[10px] text-[var(--mut)] text-center">
              ยังไม่มีข้อมูลตำนานสโมสร — ลงแข่งเพื่อเริ่มบันทึกสถิตินักเตะ
            </div>
          )}
        </div>
      </div>

      {/* User Club All-Time Records */}
      {isUserClub && (
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3.5 mland:p-2.5 space-y-2">
          <div className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">
            สถิติสโมสรตลอดกาล
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 divide-y sm:divide-y-0 text-xs mland:text-[10px]">
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
            <div className="py-1.5 border-b border-[var(--line)]/60 flex justify-between gap-2">
              <span className="text-[var(--mut)]">ผู้ชมเกมเหย้าสูงสุด</span>
              <b className="truncate text-right tabular">
                {rec?.highestAttendance
                  ? `${rec.highestAttendance.att.toLocaleString()} คน (พบ ${rec.highestAttendance.opp} · S${rec.highestAttendance.s})`
                  : '-'}
              </b>
            </div>
            <div className="py-1.5 border-b border-[var(--line)]/60 flex justify-between gap-2">
              <span className="text-[var(--mut)]">แต้มสูงสุด/ซีซั่น</span>
              <b className="tabular">{rec?.mostPoints ? `${rec.mostPoints.pts} แต้ม (S${rec.mostPoints.s})` : '-'}</b>
            </div>
            <div className="py-1.5 border-b border-[var(--line)]/60 lg:border-b-0 flex justify-between gap-2">
              <span className="text-[var(--mut)]">ยิงสูงสุด/ซีซั่น</span>
              <b className="tabular">{rec?.mostGoalsSeason ? `${rec.mostGoalsSeason.gf} ลูก (S${rec.mostGoalsSeason.s})` : '-'}</b>
            </div>
            <div className="py-1.5 border-b border-[var(--line)]/60 sm:border-b-0 flex justify-between gap-2">
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
        <div className="px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-2)]/60">
          <span className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">
            ประวัติศาสตร์สโมสรรายฤดูกาล
          </span>
          {isUserClub && state.hist && state.hist.length > 0 && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setShowClubLog((v) => !v);
              }}
              className="btn btn-xs btn-secondary"
            >
              {showClubLog ? 'ดูตารางรายซีซั่น' : `ดูบันทึกเหตุการณ์สโมสร (${state.hist.length})`}
            </button>
          )}
        </div>

        {showClubLog && isUserClub && state.hist && state.hist.length > 0 ? (
          <div className="p-3.5 mland:p-2 divide-y divide-[var(--line)]/60 text-xs mland:text-[10px]">
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
                    r.champion ? 'แชมป์ลีก' : r.nextTier > r.tier ? 'เลื่อนชั้น' : r.nextTier < r.tier ? 'ตกชั้น' : null,
                    r.cupChampion ? 'แชมป์ถ้วยปชช.' : r.cupStatus && r.cupStatus !== '-' ? r.cupStatus : null,
                    r.asiaChampion ? 'แชมป์ถ้วยทวีป' : r.asiaStatus && r.asiaStatus !== '-' && r.asiaStatus !== 'ไม่ได้เข้าร่วม' ? r.asiaStatus : null
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
                              className="btn btn-xs btn-secondary"
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
