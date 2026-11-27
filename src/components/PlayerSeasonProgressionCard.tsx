import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { Position, Player, GameState, PlayerCareerProfile } from '../types/game';
import { SFX } from '../utils/audioTheme';
import { getPlayerSeasonProgression, getPlayerMultiSeasonProgression, type StatGroupKey } from '../engine/playerCore';

type ChartMetricKey = 'ov' | StatGroupKey;
type ChartMode = 'multi' | 'season';

const CHART_SERIES_META: Record<ChartMetricKey, { label: string; color: string; width: number }> = {
  ov: { label: 'พลังรวม', color: '#10b981', width: 2.4 },
  atk: { label: 'โจมตี', color: '#ef4444', width: 1.65 },
  ply: { label: 'การเล่น', color: '#3b82f6', width: 1.65 },
  def: { label: 'ป้องกัน', color: '#8b5cf6', width: 1.65 },
  gk: { label: 'ประตู', color: '#f97316', width: 1.65 },
  phy: { label: 'ร่างกาย', color: '#06b6d4', width: 1.65 },
  fit: { label: 'พลังงาน', color: '#ec4899', width: 1.65 },
  tal: { label: 'พรสวรรค์', color: '#f59e0b', width: 1.65 }
};

const KEY_STATS_BY_POS: Record<Position, StatGroupKey[]> = {
  FW: ['atk', 'ply', 'phy'],
  MF: ['ply', 'atk', 'def'],
  DF: ['def', 'phy', 'fit'],
  GK: ['gk', 'phy', 'fit']
};

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
  payload?: { md?: number; season?: number; teamName?: string; label?: string; isCurrent?: boolean };
}

const SeasonProgressTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipEntry[];
  mode: ChartMode;
}> = ({ active, payload, mode }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload;
  const heading =
    mode === 'multi'
      ? p?.season === 0
        ? `${p.label || 'เริ่มต้น'}${p.teamName ? ` · ${p.teamName}` : ''}`
        : `ซีซั่น ${p?.season}${p?.isCurrent ? ' (ปัจจุบัน)' : ''}${p?.teamName ? ` · ${p.teamName}` : ''}`
      : (p?.md ?? 0) === 0
        ? 'เปิดซีซั่น (ก่อนนัดแรก)'
        : `หลังจบแมตช์ที่ ${p?.md}`;
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 shadow-lg text-[10.5px] space-y-1">
      <div className="font-bold text-[var(--ink)] border-b border-[var(--line)]/60 pb-0.5 tabular">
        {heading}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-1.5">
            <span className="flex items-center gap-1 text-[var(--mut)] font-medium">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <b className="text-[var(--ink)] font-extrabold">{entry.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PlayerSeasonProgressionCard: React.FC<{
  player: Player;
  state: Pick<GameState, 'season' | 'md'> & Partial<Pick<GameState, 'teams' | 'seasonArchives' | 'mode' | 'p'>>;
  careerProfile?: PlayerCareerProfile | null;
  variant?: 'overlay' | 'inline';
}> = ({
  player,
  state,
  careerProfile = null,
  variant = 'inline'
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('multi');
  const [chartScope, setChartScope] = useState<'key' | 'all'>('all');
  const [hiddenMetrics, setHiddenMetrics] = useState<Partial<Record<ChartMetricKey, boolean>>>({});

  const seasonSeries = useMemo(
    () => getPlayerSeasonProgression(player, state, careerProfile),
    [player, state, careerProfile]
  );

  const multiSeries = useMemo(
    () =>
      getPlayerMultiSeasonProgression(
        player,
        {
          season: state.season,
          md: state.md,
          teams: state.teams || [],
          seasonArchives: state.seasonArchives,
          mode: state.mode || 'm',
          p: state.p ?? careerProfile ?? undefined
        },
        careerProfile
      ),
    [player, state, careerProfile]
  );

  const activeSeries: Array<
    {
      label: string;
      ov: number;
      md?: number;
      season?: number;
      teamName?: string;
    } & Partial<Record<StatGroupKey, number>>
  > = chartMode === 'multi' ? multiSeries : seasonSeries;

  const chartKeys: ChartMetricKey[] = useMemo(
    () =>
      chartScope === 'all'
        ? player.pos === 'GK'
          ? ['ov', 'gk', 'phy', 'fit', 'tal']
          : ['ov', 'atk', 'ply', 'def', 'phy', 'fit', 'tal']
        : ['ov', ...(KEY_STATS_BY_POS[player.pos] || ['atk', 'ply', 'phy'])],
    [chartScope, player.pos]
  );

  const startOv = activeSeries[0]?.ov ?? player.ov;
  const endOv = activeSeries[activeSeries.length - 1]?.ov ?? player.ov;
  const ovDiff = endOv - startOv;

  const isOverlay = variant === 'overlay';

  const chartBody = (
    <div
      className={
        isOverlay
          ? 'border-t border-[var(--line)]/70 px-3 py-2 mland:px-2.5 mland:py-1.5 space-y-1.5 mland:space-y-1'
          : 'border-t border-[var(--line)]/70 px-3 py-2 mland:px-2 mland:py-1.5 space-y-1.5 mland:space-y-1'
      }
    >
      <div className="h-[132px] sm:h-[142px] mland:h-[104px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={activeSeries} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.45} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: 'var(--mut)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={12}
            />
            <YAxis
              width={30}
              domain={[(min: number) => Math.max(1, Math.floor(min) - 2), (max: number) => Math.min(199, Math.ceil(max) + 2)]}
              allowDecimals={false}
              tick={{ fontSize: 9, fill: 'var(--mut)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<SeasonProgressTooltip mode={chartMode} />} />
            {chartKeys.map((k) => {
              if (hiddenMetrics[k]) return null;
              const meta = CHART_SERIES_META[k];
              return (
                <Line
                  key={k}
                  type="linear"
                  dataKey={k}
                  name={meta.label}
                  stroke={meta.color}
                  strokeWidth={meta.width}
                  dot={activeSeries.length <= 4 ? { r: 3, strokeWidth: 1.5 } : { r: 1.8, strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                  animationDuration={220}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[var(--line)]/50">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mland:gap-x-1.5">
          {chartKeys.map((k) => {
            const meta = CHART_SERIES_META[k];
            const isHidden = !!hiddenMetrics[k];
            const curVal = activeSeries[activeSeries.length - 1]?.[k] ?? 0;
            const initVal = activeSeries[0]?.[k] ?? curVal;
            const diff = curVal - initVal;
            return (
              <button
                key={k}
                type="button"
                onClick={() =>
                  setHiddenMetrics((prev) => ({
                    ...prev,
                    [k]: !prev[k]
                  }))
                }
                title={`คลิกเพื่อ${isHidden ? 'แสดง' : 'ซ่อน'}เส้น ${meta.label}`}
                className={`inline-flex items-center gap-1 text-[10px] mland:text-[8px] font-bold tabular cursor-pointer transition-opacity ${
                  isHidden ? 'opacity-35 line-through' : 'opacity-100 hover:opacity-80'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                <span className="text-[var(--ink)]">{meta.label}</span>
                <span className="text-[var(--mut)]">{curVal}</span>
                {diff !== 0 && (
                  <span className={diff > 0 ? 'text-[var(--g)] font-extrabold' : 'text-[var(--red)] font-extrabold'}>
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)]">
          {chartMode === 'multi'
            ? `เทียบตั้งแต่${activeSeries[0]?.label || 'เริ่มต้น'} → ${activeSeries[activeSeries.length - 1]?.label || `S${state.season}`}`
            : state.md === 0
              ? 'เปิดซีซั่น · อัปเดตหลังจบแต่ละนัด'
              : `เฉพาะในซีซั่น ${state.season}`}
        </span>
      </div>
    </div>
  );

  return (
    <div className="shrink-0 bg-[var(--surface)] border border-[var(--line)] shadow-xs rounded-2xl mland:rounded-xl overflow-hidden">
      {/* Compact Static Header Row */}
      <div className="px-3 py-2 mland:px-2.5 mland:py-1 flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-2)]/35">
        <div className="flex items-center gap-2 mland:gap-1.5 min-w-0 flex-1 text-[11px] mland:text-[8.5px] tabular">
          <span className="font-bold text-[var(--ink)] shrink-0 flex items-center gap-1">
            <span>📈</span>
            <span>{chartMode === 'multi' ? `พัฒนาการรายซีซั่น (${activeSeries.length} ช่วง)` : `พัฒนาการ · ซีซั่น ${state.season}`}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mland:px-1 mland:py-0 rounded-md bg-[var(--surface-2)] border border-[var(--line)]/80 font-bold shrink-0">
            <span className="text-[var(--mut)] font-semibold">พลังรวม</span>
            <span className="text-[var(--ink)] font-extrabold">
              {ovDiff !== 0 ? `${startOv}→${endOv}` : endOv}
            </span>
            {ovDiff !== 0 && (
              <span
                className={`px-1 rounded text-[9.5px] mland:text-[7.5px] font-extrabold leading-tight ${
                  ovDiff > 0
                    ? 'bg-[var(--g-soft)] text-[var(--g)]'
                    : 'bg-[var(--red-soft)] text-[var(--red)]'
                }`}
              >
                {ovDiff > 0 ? `+${ovDiff}` : ovDiff}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mland:gap-1 shrink-0">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
            <button
              type="button"
              onClick={() => { SFX.tap(); setChartMode('multi'); }}
              className={`px-1.5 py-0.5 rounded text-[9.5px] mland:text-[7.5px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                chartMode === 'multi'
                  ? 'bg-[var(--g)] text-white shadow-xs'
                  : 'text-[var(--mut)] hover:text-[var(--ink)]'
              }`}
            >
              เทียบรายซีซั่น
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setChartMode('season'); }}
              className={`px-1.5 py-0.5 rounded text-[9.5px] mland:text-[7.5px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                chartMode === 'season'
                  ? 'bg-[var(--g)] text-white shadow-xs'
                  : 'text-[var(--mut)] hover:text-[var(--ink)]'
              }`}
            >
              ในซีซั่นนี้
            </button>
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
            <button
              type="button"
              onClick={() => { SFX.tap(); setChartScope('key'); }}
              className={`px-1.5 py-0.5 rounded text-[9.5px] mland:text-[7.5px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                chartScope === 'key'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--mut)] hover:text-[var(--ink)]'
              }`}
            >
              จุดเด่น (4)
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setChartScope('all'); }}
              className={`px-1.5 py-0.5 rounded text-[9.5px] mland:text-[7.5px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                chartScope === 'all'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--mut)] hover:text-[var(--ink)]'
              }`}
            >
              {player.pos === 'GK' ? 'ครบ 4 หมวด' : 'ครบ 6 หมวด'}
            </button>
          </div>
        </div>
      </div>

      {chartBody}
    </div>
  );
};
