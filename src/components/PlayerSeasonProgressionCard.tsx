import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { Position, Player, GameState, StatKey, PlayerCareerProfile } from '../types/game';
import { SFX } from '../utils/audioTheme';
import { getPlayerSeasonProgression } from '../engine/playerCore';

type ChartMetricKey = 'ov' | StatKey;

const CHART_SERIES_META: Record<ChartMetricKey, { label: string; color: string; width: number }> = {
  ov: { label: 'OVR', color: '#10b981', width: 2.4 },
  sh: { label: 'ยิง', color: '#ef4444', width: 1.65 },
  ps: { label: 'ส่ง', color: '#3b82f6', width: 1.65 },
  dr: { label: 'เลี้ยง', color: '#f59e0b', width: 1.65 },
  tk: { label: 'รับ', color: '#8b5cf6', width: 1.65 },
  ph: { label: 'กาย', color: '#06b6d4', width: 1.65 }
};

const KEY_STATS_BY_POS: Record<Position, StatKey[]> = {
  FW: ['sh', 'dr', 'ps'],
  MF: ['ps', 'dr', 'sh'],
  DF: ['tk', 'ph', 'ps'],
  GK: ['ph', 'tk', 'ps']
};

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
  payload?: { md?: number; label?: string };
}

const SeasonProgressTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipEntry[];
}> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const md = payload[0]?.payload?.md ?? 0;
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 shadow-lg text-[10.5px] space-y-1">
      <div className="font-bold text-[var(--ink)] border-b border-[var(--line)]/60 pb-0.5 tabular">
        {md === 0 ? 'เปิดซีซั่น (ก่อนนัดแรก)' : `หลังจบแมตช์ที่ ${md}`}
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
  state: Pick<GameState, 'season' | 'md'>;
  careerProfile?: PlayerCareerProfile | null;
  variant?: 'overlay' | 'inline';
  defaultOpen?: boolean;
}> = ({
  player,
  state,
  careerProfile = null,
  variant = 'overlay',
  defaultOpen = false
}) => {
  const [showProgChart, setShowProgChart] = useState(defaultOpen);
  const [chartScope, setChartScope] = useState<'key' | 'all'>('all');
  const [hiddenMetrics, setHiddenMetrics] = useState<Partial<Record<ChartMetricKey, boolean>>>({});

  const seasonSeries = useMemo(
    () => getPlayerSeasonProgression(player, state, careerProfile),
    [player, state, careerProfile]
  );

  const chartKeys: ChartMetricKey[] = useMemo(
    () =>
      chartScope === 'all'
        ? ['ov', 'sh', 'ps', 'dr', 'tk', 'ph']
        : ['ov', ...(KEY_STATS_BY_POS[player.pos] || ['sh', 'ps', 'dr'])],
    [chartScope, player.pos]
  );

  const startOv = seasonSeries[0]?.ov ?? player.ov;
  const endOv = seasonSeries[seasonSeries.length - 1]?.ov ?? player.ov;
  const ovDiff = endOv - startOv;

  const isOverlay = variant === 'overlay';

  const chartBody = (
    <div
      className={
        isOverlay
          ? 'absolute inset-x-0 top-full -mt-px z-30 rounded-b-2xl mland:rounded-b-xl bg-[var(--surface)] border border-[var(--line)] border-t-[var(--line)]/70 px-3 py-2 mland:px-2.5 mland:py-1.5 shadow-2xl space-y-1.5 mland:space-y-1'
          : 'border-t border-[var(--line)]/70 px-3 py-2 mland:px-2 mland:py-1.5 space-y-1.5 mland:space-y-1'
      }
    >
      <div className="h-[118px] sm:h-[124px] mland:h-[88px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={seasonSeries} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.45} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: 'var(--mut)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={14}
            />
            <YAxis
              width={28}
              domain={[(min: number) => Math.max(1, Math.floor(min) - 2), (max: number) => Math.min(99, Math.ceil(max) + 2)]}
              allowDecimals={false}
              tick={{ fontSize: 9, fill: 'var(--mut)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<SeasonProgressTooltip />} />
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
                  dot={seasonSeries.length <= 2 ? { r: 2.8, strokeWidth: 1.5 } : { r: 1.6, strokeWidth: 1 }}
                  activeDot={{ r: 3.8 }}
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
            const curVal = seasonSeries[seasonSeries.length - 1]?.[k] ?? 0;
            const initVal = seasonSeries[0]?.[k] ?? curVal;
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
        {state.md === 0 && (
          <span className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)]">
            เปิดซีซั่น · อัปเดตหลังจบแต่ละนัด
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`shrink-0 bg-[var(--surface)] border border-[var(--line)] shadow-xs ${
        isOverlay ? 'relative' : ''
      } ${
        showProgChart && isOverlay
          ? 'rounded-t-2xl mland:rounded-t-xl z-30'
          : 'rounded-2xl mland:rounded-xl overflow-hidden'
      }`}
    >
      {/* Unified Compact Header Row */}
      <div className="px-3 py-1.5 mland:px-2 mland:py-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 mland:gap-1.5 min-w-0 flex-1 text-[10.5px] mland:text-[8.5px] tabular">
          <span className="font-bold text-[var(--ink)] shrink-0">
            📈 พัฒนาการซ.{state.season}
          </span>
          <span className="font-bold text-[var(--mut)] shrink-0">
            OVR <b className="text-[var(--ink)]">{startOv}→{endOv}</b>
            {ovDiff !== 0 && (
              <span className={`ml-0.5 font-extrabold ${ovDiff > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                ({ovDiff > 0 ? `+${ovDiff}` : ovDiff})
              </span>
            )}
          </span>
          {!showProgChart && (
            <span className="hidden sm:inline text-[var(--mut)] truncate">
              {(KEY_STATS_BY_POS[player.pos] || ['sh', 'ps', 'dr']).map((k, idx) => {
                const meta = CHART_SERIES_META[k];
                const curV = seasonSeries[seasonSeries.length - 1]?.[k] ?? 0;
                const initV = seasonSeries[0]?.[k] ?? curV;
                const d = curV - initV;
                return (
                  <span key={k}>
                    {idx > 0 ? ' · ' : ''}
                    {meta.label} {curV}
                    {d !== 0 && (
                      <span className={d > 0 ? 'text-[var(--g)] font-bold' : 'text-[var(--red)] font-bold'}>
                        {d > 0 ? `+${d}` : d}
                      </span>
                    )}
                  </span>
                );
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mland:gap-1 shrink-0">
          {showProgChart && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
              <button
                type="button"
                onClick={() => { SFX.tap(); setChartScope('key'); }}
                className={`px-1.5 py-0.5 rounded text-[9.5px] mland:text-[7.5px] font-bold cursor-pointer transition-colors ${
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
                className={`px-1.5 py-0.5 rounded text-[9.5px] mland:text-[7.5px] font-bold cursor-pointer transition-colors ${
                  chartScope === 'all'
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                    : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                ครบ 6 ค่า
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              SFX.tap();
              setShowProgChart((v) => !v);
            }}
            className={`px-2 mland:px-1.5 py-0.5 rounded-lg border text-[10px] mland:text-[8px] font-bold cursor-pointer transition-colors shrink-0 ${
              showProgChart
                ? 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
            }`}
          >
            {showProgChart ? 'ย่อกราฟ ▴' : 'ดูกราฟ ▾'}
          </button>
        </div>
      </div>

      {showProgChart && chartBody}
    </div>
  );
};
