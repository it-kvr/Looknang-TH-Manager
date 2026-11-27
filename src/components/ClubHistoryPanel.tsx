import React, { useMemo, useRef, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ClubAllTimePlayerRecord, GameState, Player, Team, TrophyRecord } from '../types/game';
import { TN } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getClubLegacySummary, resolveClubLegendProfile } from '../engine/history';
import { sortTable, ensureTeamFans, fmtFans } from '../engine/simulation';
import { PlayerFace } from './SvgVisuals';
import { StatIconBadge } from './StatIconBadge';

interface ClubHistoryPanelProps {
  team: Team;
  state: GameState;
  onOpenSeasonStats?: (season?: number) => void;
  onInspectPlayer?: (p: Player, t: Team | null) => void;
  compact?: boolean;
}

type LegendMetric = 'goals' | 'assists' | 'apps' | 'cleanSheets' | 'motm';

const METRIC_COLUMNS: {
  key: LegendMetric;
  label: string;
  icon: React.ReactNode;
  unit: string;
  accentCls: string;
  headerBgCls: string;
}[] = [
  {
    key: 'goals',
    label: 'ประตู',
    icon: <StatIconBadge kind="goal" size="xs" />,
    unit: 'ประตู',
    accentCls: 'text-emerald-700 dark:text-emerald-300',
    headerBgCls: 'bg-emerald-500/10'
  },
  {
    key: 'assists',
    label: '',
    icon: <StatIconBadge kind="assist" size="xs" />,
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
    icon: <StatIconBadge kind="cleansheet" size="xs" />,
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
  const isLeagueCup = type === 'league_cup';
  const isSuperCup = type === 'super_cup';
  const isDivCup = type === 'div_cup';
  const isAward = type === 'award' || type === 'nt';
  const isSilverLeague = type === 'league' && tier === 1;
  const isBronzeLeague = type === 'league' && (tier === 0 || tier == null);

  // Palette per trophy prestige
  const mainStops =
    isLeagueCup
      ? ['#e0f2fe', '#7dd3fc', '#0284c7', '#075985']
      : isDivCup
        ? ['#d1fae5', '#34d399', '#059669', '#065f46']
        : isSuperCup
          ? ['#fef3c7', '#fbbf24', '#d97706', '#92400e']
          : isCup || isSilverLeague
            ? ['#ffffff', '#cbd5e1', '#94a3b8', '#64748b']
            : isBronzeLeague
              ? ['#fde68a', '#f59e0b', '#b45309', '#78350f']
              : ['#fef9c3', '#facc15', '#eab308', '#a16207'];

  const trimCol = isAsia
    ? '#10b981'
    : isLeagueCup
      ? '#38bdf8'
      : isDivCup
        ? '#34d399'
        : isSuperCup
          ? '#fde047'
          : isCup
            ? '#eab308'
            : isSilverLeague
              ? '#facc15'
              : '#fef08a';
  const baseCol = isAsia || isDivCup ? '#064e3b' : isLeagueCup ? '#0c2438' : isCup ? '#1e293b' : '#291d09';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={muted ? 'opacity-30 grayscale' : ''}
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
      ) : isLeagueCup || isDivCup || isSuperCup ? (
        <>
          {isSuperCup ? (
            <>
              {/* Super Cup Royal Shield Plate */}
              <path
                d="M18 11h28l-2 15c0 10-5 15-12 18-7-3-12-8-12-18l-2-15z"
                fill={`url(#tg-${uid})`}
                stroke={mainStops[3]}
                strokeWidth="1.4"
              />
              <path d="M22 14h20l-1.4 11c0 7.2-3.8 11-8.6 13.5-4.8-2.5-8.6-6.3-8.6-13.5L22 14z" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1" />
              <path d="M32 18l2 4.1 4.5.7-3.2 3.1.8 4.4-4.1-2.1-4.1 2.1.8-4.4-3.2-3.1 4.5-.7L32 18z" fill="#ffffff" fillOpacity="0.92" />
            </>
          ) : (
            <>
              {/* Modern Angled Cup / Shield Chalice */}
              <path
                d="M18 15c-4.5.2-7 3-7 7 0 4 3 6.8 8 7.5M46 15c4.5.2 7 3 7 7 0 4-3 6.8-8 7.5"
                stroke={`url(#tg-${uid})`}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <path
                d="M19 12h26l-3.2 19c-.9 5.5-5 9.5-9.8 9.5s-8.9-4-9.8-9.5L19 12z"
                fill={`url(#tg-${uid})`}
                stroke={mainStops[3]}
                strokeWidth="1.2"
              />
              <path d="M22.5 15h3.5l1.3 15c.2 2.4 1 4.3 2.2 5.7-3.2-1-5.2-3.8-5.7-7.7L22.5 15z" fill="#ffffff" fillOpacity="0.42" />
              <circle cx="32" cy="24" r="5" fill={baseCol} stroke={trimCol} strokeWidth="1.2" />
              <circle cx="32" cy="24" r="2.2" fill={trimCol} />
            </>
          )}
          <rect x="29" y="40.5" width="6" height="7" rx="1.5" fill={`url(#tg-${uid})`} />
          <rect x="21.5" y="47.5" width="21" height="3.5" rx="1.2" fill={trimCol} />
          <rect x="17" y="51" width="30" height="7.8" rx="2" fill={`url(#tb-${uid})`} stroke={trimCol} strokeWidth="0.9" />
          <rect x="23" y="53.8" width="18" height="2" rx="1" fill={trimCol} opacity="0.9" />
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
  const [selectedTrophySeason, setSelectedTrophySeason] = useState<number | 'all'>('all');
  const trophyShelfRef = useRef<HTMLDivElement | null>(null);

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
    let domesticCup = 0;
    let asia = 0;
    let other = 0;
    legacy.trophies.forEach((tr) => {
      if (tr.type === 'league') league++;
      else if (tr.type === 'cup' || tr.type === 'league_cup' || tr.type === 'super_cup' || tr.type === 'div_cup') domesticCup++;
      else if (tr.type === 'asia') asia++;
      else other++;
    });
    return { league, domesticCup, asia, other };
  }, [legacy.trophies]);

  const trophySeasons = useMemo(() => {
    const set = new Set<number>();
    legacy.trophies.forEach((tr) => set.add(tr.season));
    return Array.from(set).sort((a, b) => a - b);
  }, [legacy.trophies]);

  const seasonTrophyGroups = useMemo(() => {
    const trophyOrder: Record<TrophyRecord['type'], number> = {
      asia: 0,
      league: 1,
      cup: 2,
      league_cup: 3,
      super_cup: 4,
      div_cup: 5,
      nt: 6,
      award: 7
    };
    const grouped = new Map<number, TrophyRecord[]>();
    legacy.trophies.forEach((tr) => {
      if (selectedTrophySeason !== 'all' && tr.season !== selectedTrophySeason) return;
      const arr = grouped.get(tr.season) || [];
      arr.push(tr);
      grouped.set(tr.season, arr);
    });
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([season, items]) => ({
        season,
        items: items.slice().sort((a, b) => (trophyOrder[a.type] ?? 9) - (trophyOrder[b.type] ?? 9))
      }));
  }, [legacy.trophies, selectedTrophySeason]);

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
            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">W-D-L</div>
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
        {/* Realistic Single-Row Museum Glass Trophy Cabinet with Season Browsing */}
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3.5 mland:p-2.5 flex flex-col gap-2.5 mland:gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mland:pb-1.5 border-b border-[var(--line)]/70">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">
                ตู้โชว์ถ้วยรางวัล ({legacy.trophies.length})
              </span>
              <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular truncate">
                ลีก {trophyCounts.league} · บอลถ้วยใน ปท. {trophyCounts.domesticCup} · ทวีป {trophyCounts.asia}
                {trophyCounts.other > 0 ? ` · อื่นๆ ${trophyCounts.other}` : ''}
              </span>
            </div>

            {legacy.trophies.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label="เลื่อนตู้ถ้วยไปทางซ้าย"
                  onClick={() => {
                    SFX.tap();
                    trophyShelfRef.current?.scrollBy({ left: -240, behavior: 'smooth' });
                  }}
                  className="w-7 h-7 mland:w-6 mland:h-6 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--g)] flex items-center justify-center text-[var(--ink)] cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="เลื่อนตู้ถ้วยไปทางขวา"
                  onClick={() => {
                    SFX.tap();
                    trophyShelfRef.current?.scrollBy({ left: 240, behavior: 'smooth' });
                  }}
                  className="w-7 h-7 mland:w-6 mland:h-6 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--g)] flex items-center justify-center text-[var(--ink)] cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {legacy.trophies.length > 0 && trophySeasons.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setSelectedTrophySeason('all');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] mland:text-[9px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                  selectedTrophySeason === 'all'
                    ? 'bg-[var(--g)] text-white border-[var(--g)]'
                    : 'bg-[var(--surface-2)]/75 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                }`}
              >
                ทุกฤดูกาล ({legacy.trophies.length})
              </button>
              {trophySeasons.map((sn) => {
                const countInS = legacy.trophies.filter((tr) => tr.season === sn).length;
                const active = selectedTrophySeason === sn;
                return (
                  <button
                    key={sn}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setSelectedTrophySeason((prev) => (prev === sn ? 'all' : sn));
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] mland:text-[9px] font-bold whitespace-nowrap shrink-0 border tabular cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#c58a14] text-white border-[#eab308]'
                        : 'bg-[var(--surface-2)]/75 text-[var(--ink)] border-[var(--line)] hover:border-[#eab308]/60'
                    }`}
                  >
                    ซีซั่น {sn} ({countInS})
                  </button>
                );
              })}
            </div>
          )}

          {legacy.trophies.length > 0 ? (
            <div className="relative rounded-2xl border-[3px] border-[#5f3b1e] dark:border-[#492c15] bg-gradient-to-b from-[#1a1310] via-[#130e0c] to-[#0b0807] shadow-[inset_0_10px_28px_rgba(0,0,0,0.75),0_6px_18px_rgba(0,0,0,0.22)] overflow-hidden">
              {/* Top Brass Lighting Canopy */}
              <div
                aria-hidden="true"
                className="h-2.5 w-full bg-gradient-to-b from-[#3d2512] to-[#1d1209] border-b border-[#d4a84f]/35 relative flex items-center justify-around px-6"
              >
                {[0, 1, 2, 3].map((dot) => (
                  <span key={dot} className="w-6 h-1 rounded-full bg-[#fef08a]/40" />
                ))}
              </div>

              {/* Glass Front Reflection Sheen */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(118deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.03)_26%,transparent_44%,rgba(255,255,255,0.03)_68%,transparent_84%)]"
              />

              {/* Season-Grouped Side-by-Side Scrollable Cabinet Shelf */}
              <div
                ref={trophyShelfRef}
                className="relative z-10 overflow-x-auto scroll-smooth snap-x snap-mandatory"
              >
                <div className="min-w-full w-max flex flex-col">
                  <div className="flex flex-nowrap items-end gap-5 sm:gap-6 px-5 pt-3.5 mland:pt-2.5 pb-0">
                    {seasonTrophyGroups.map((grp, gIdx) => {
                      const hasGold = grp.items.some(
                        (tr) => tr.type === 'asia' || tr.type === 'super_cup' || (tr.type === 'league' && tr.tier === 2) || tr.type === 'award' || tr.type === 'nt'
                      );
                      return (
                        <React.Fragment key={`grp-s-${grp.season}`}>
                          {gIdx > 0 && (
                            <div
                              aria-hidden="true"
                              className="self-stretch w-px my-2 bg-gradient-to-b from-transparent via-[#d4a84f]/35 to-[#d4a84f]/20 shrink-0"
                            />
                          )}
                          <div className="relative snap-start shrink-0 flex flex-col items-center pb-1.5 px-2.5 rounded-t-xl bg-white/[0.025] border-x border-t border-[#d4a84f]/20">
                            {/* Group Overhead Museum Spotlight Cone */}
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute -top-3 inset-x-0 h-28 opacity-65"
                              style={{
                                background: hasGold
                                  ? 'radial-gradient(ellipse at 50% 8%, rgba(253, 224, 71, 0.26) 0%, rgba(245, 158, 11, 0.08) 48%, transparent 78%)'
                                  : 'radial-gradient(ellipse at 50% 8%, rgba(226, 232, 240, 0.22) 0%, rgba(148, 163, 184, 0.07) 48%, transparent 78%)'
                              }}
                            />

                            {/* Season Showcase Header */}
                            <div className="relative z-10 flex items-center gap-1.5 mt-1 mb-1.5 px-2.5 py-0.5 rounded-md bg-[#2a1a0d]/85 border border-[#d4a84f]/40 text-[10px] mland:text-[8.5px] font-extrabold tracking-wide text-[#fde68a] tabular">
                              <span>ซีซั่น {grp.season}</span>
                              {grp.items.length > 1 && (
                                <span className="text-[#facc15]">· {grp.items.length} แชมป์</span>
                              )}
                            </div>

                            {/* Side-by-Side Trophies Inside This Season */}
                            <div className="relative z-10 flex flex-nowrap items-end gap-2.5 sm:gap-3.5">
                              {grp.items.map((tr, i) => (
                                <div
                                  key={`${tr.season}-${tr.type}-${i}`}
                                  className="w-[100px] sm:w-[112px] mland:w-[88px] flex flex-col items-center text-center group"
                                >
                                  <div className="relative flex flex-col items-center transition-transform duration-200 group-hover:-translate-y-0.5">
                                    <TrophySvg
                                      type={tr.type}
                                      tier={tr.tier}
                                      uid={`tr-${compact ? 'c' : 'f'}-${team.id}-${grp.season}-${i}`}
                                      size={compact ? 52 : 60}
                                    />
                                    <div className="w-11 h-1.5 rounded-full bg-black/50 -mt-1" />
                                    <div className="w-14 h-1.5 rounded-t-sm bg-gradient-to-b from-[#2f241d] to-[#1a130f] border-x border-t border-[#d4a84f]/35" />
                                  </div>
                                  <div className="w-full mt-0.5 px-1.5 py-1 rounded bg-gradient-to-b from-[#f3d47b] via-[#d7a83f] to-[#a3751a] border border-[#fef08a]/65 shadow-[0_2px_5px_rgba(0,0,0,0.55)]">
                                    <div className="text-[9.5px] mland:text-[8px] font-extrabold text-[#241603] leading-tight line-clamp-2 min-h-[24px] mland:min-h-[20px] flex items-center justify-center">
                                      {tr.title}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Continuous Wooden & Brass Display Shelf Ledge */}
                  <div className="w-full h-3.5 bg-gradient-to-b from-[#8b572a] via-[#653d1b] to-[#3a200c] border-t-2 border-[#e3b95c]/65 shadow-[inset_0_2px_4px_rgba(255,255,255,0.22)]" />
                </div>
              </div>
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
                        <span className={`font-extrabold text-[10.5px] mland:text-[9px] ${col.accentCls} inline-flex items-center gap-1 min-w-0 truncate`}>
                          <span className="shrink-0 inline-flex items-center">{col.icon}</span>
                          <span className="truncate">{col.label}</span>
                        </span>
                        <span className="text-[9px] mland:text-[7.5px] text-[var(--mut)] shrink-0">
                          {col.unit}
                        </span>
                      </div>

                      {list.length > 0 ? (
                        <div className="divide-y divide-[var(--line)]/50">
                          {list.map((leg, idx) => {
                            const status = resolveClubLegendProfile(leg, team, state);
                            const clickable = !!onInspectPlayer;
                            const facePlayer: Partial<Player> = status.inspectPlayer;
                            const faceTeam = status.inspectTeam ?? team;
                            const seasonText = formatSeasonSpan(leg);
                            const val = leg[col.key] || 0;
                            const statusColorCls =
                              status.kind === 'club'
                                ? 'text-[var(--g)] font-semibold'
                                : status.kind === 'transferred'
                                  ? 'text-sky-600 dark:text-sky-400 font-semibold'
                                  : status.kind === 'free'
                                    ? 'text-violet-600 dark:text-violet-400 font-semibold'
                                    : 'text-amber-600 dark:text-amber-400 font-semibold';
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
                                    team={faceTeam}
                                    state={state}
                                    club={state.club}
                                    isMyClub={status.kind === 'club' && isUserClub}
                                    size={24}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  {clickable ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        SFX.tap();
                                        onInspectPlayer!(status.inspectPlayer, status.inspectTeam);
                                      }}
                                      title={`ดูข้อมูลและสถานะของ ${leg.name} (${status.label})`}
                                      className="font-bold text-[10.5px] mland:text-[9px] text-[var(--ink)] hover:text-[var(--g)] truncate text-left cursor-pointer block w-full"
                                    >
                                      {leg.name}
                                    </button>
                                  ) : (
                                    <div className="font-bold text-[10.5px] mland:text-[9px] text-[var(--ink)] truncate">
                                      {leg.name}
                                    </div>
                                  )}
                                  <div className="text-[8.5px] mland:text-[7.5px] text-[var(--mut)] tabular truncate" title={`${leg.ro || leg.pos} · ${seasonText} · ${status.label}`}>
                                    {leg.ro || leg.pos} · {seasonText}{' '}
                                    <span className={statusColorCls}>· {status.shortLabel}</span>
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
              <span className="text-[var(--mut)] inline-flex items-center gap-1"><StatIconBadge kind="assist" size="xs" /><span>ซีซั่นเดียว</span></span>
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
                  <th className="py-1.5 px-1.5 text-center font-semibold whitespace-nowrap">แข่ง / W-D-L</th>
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
                    r.cupChampion ? 'แชมป์ถ้วยปชช.' : r.cupStatus && r.cupStatus !== '-' ? `ปชช.: ${r.cupStatus}` : null,
                    r.leagueCupChampion ? 'แชมป์ลีกคัพ' : r.leagueCupStatus && r.leagueCupStatus !== '-' ? `ลีกคัพ: ${r.leagueCupStatus}` : null,
                    r.superCupChampion ? 'แชมป์แชมเปี้ยนส์คัพ' : r.superCupStatus && r.superCupStatus !== '-' ? `แชมเปี้ยนส์คัพ: ${r.superCupStatus}` : null,
                    r.divCupChampion ? 'แชมป์ถ้วยดิวิชั่น' : r.divCupStatus && r.divCupStatus !== '-' ? `ดิวิชั่น: ${r.divCupStatus}` : null,
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
