import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { Position, Player, Team, GameState, StatKey } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { TN, ATT, SPN, AR_T } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, xi, dtInfo, vlu, wagOf, ensureCon, logFin, tc, getPlayerSeasonProgression } from '../engine/playerCore';
import { ovColor, statBarColor, statTierMeta, getPlayerTalent, talentTierMeta } from '../engine/missions';
import { sortTable, teamStats } from '../engine/simulation';
import { ClubCrest, PlayerFace, FormationPitch } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { PlayerHistoryPanel } from '../components/PlayerHistoryPanel';
import { ClubHistoryPanel } from '../components/ClubHistoryPanel';

type ChartMetricKey = 'ov' | StatKey;

const CHART_SERIES_META: Record<ChartMetricKey, { label: string; color: string; width: number }> = {
  ov: { label: 'OVR', color: '#10b981', width: 2.4 },
  sh: { label: 'ยิง', color: '#ef4444', width: 1.6 },
  ps: { label: 'ส่ง', color: '#3b82f6', width: 1.6 },
  dr: { label: 'เลี้ยง', color: '#f59e0b', width: 1.6 },
  tk: { label: 'รับ', color: '#8b5cf6', width: 1.6 },
  ph: { label: 'กาย', color: '#06b6d4', width: 1.6 }
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

export const PlayerInspectorModal: React.FC<{
  player: Player;
  team: Team | null;
  state: GameState;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ player, team, state, onClose, onUpdateState, onToast }) => {
  const liveTeam = team ? state.teams[team.id] || team : null;
  const livePlayer = liveTeam
    ? liveTeam.sq.find((q) => q.n === player.n) || player
    : state.mk.find((q) => q.n === player.n) || state.yth.find((q) => q.n === player.n) || player;
  const isMyTeam = !!liveTeam && liveTeam.id === state.me;
  const isMePlayer = !!livePlayer.me || (state.mode === 'p' && state.p?.name === livePlayer.n);
  const currentNo = liveTeam ? getShirtNo(liveTeam, livePlayer) : livePlayer.no || 10;
  const info = dtInfo(livePlayer, isMePlayer ? state.p : null);
  const [shirtNo, setShirtNo] = useState(String(currentNo));
  const [inspectMode, setInspectMode] = useState<'info' | 'history' | 'missions'>('info');
  const [showProgChart, setShowProgChart] = useState(false);
  const [chartScope, setChartScope] = useState<'key' | 'all'>('key');
  const [hiddenMetrics, setHiddenMetrics] = useState<Partial<Record<ChartMetricKey, boolean>>>({});
  const effectiveMode = inspectMode === 'missions' && !(isMyTeam || isMePlayer) ? 'info' : inspectMode;
  const canDoMissions = isMyTeam || isMePlayer;
  const playerTalent = getPlayerTalent(livePlayer, isMePlayer ? state.p : null);
  const seasonSeries = useMemo(
    () => getPlayerSeasonProgression(livePlayer, state, isMePlayer ? state.p : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [livePlayer.n, livePlayer.ov, livePlayer.seasonProg, state.season, state.md, isMePlayer ? state.p?.a : null]
  );
  const chartKeys: ChartMetricKey[] = useMemo(
    () =>
      chartScope === 'all'
        ? ['ov', 'sh', 'ps', 'dr', 'tk', 'ph']
        : ['ov', ...(KEY_STATS_BY_POS[livePlayer.pos] || ['sh', 'ps', 'dr'])],
    [chartScope, livePlayer.pos]
  );
  const startOv = seasonSeries[0]?.ov ?? livePlayer.ov;
  const endOv = seasonSeries[seasonSeries.length - 1]?.ov ?? livePlayer.ov;
  const ovDiff = endOv - startOv;
  const tlMeta = talentTierMeta(playerTalent);
  const isCap = !!liveTeam && liveTeam.cap === livePlayer.n;
  const con = liveTeam ? ensureCon(livePlayer) : null;
  const fitVal = Math.round(livePlayer.fit ?? 100);
  const fitCol = livePlayer.inj > 0 || (livePlayer.sus || 0) > 0 ? 'var(--red)' : fitVal >= 75 ? 'var(--g)' : fitVal >= 55 ? '#c98a00' : 'var(--red)';
  const kit1 = liveTeam ? tc(liveTeam, state, false) : isMePlayer && state.p ? state.p.c : ovColor(livePlayer.ov);
  const kit2 = liveTeam ? tc(liveTeam, state, true) : '#f5c242';
  const statusBadgeText =
    (livePlayer.sus || 0) > 0
      ? `ติดโทษแบน ${livePlayer.sus} นัด`
      : livePlayer.inj > 0
        ? `บาดเจ็บพัก ${livePlayer.inj} นัด`
        : fitVal < 60
          ? 'ร่างกายอ่อนล้า'
          : 'พร้อมลงสนาม';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/68 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 mland:p-2 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl mland:max-w-[96vw] h-[min(94dvh,740px)] mland:h-[95dvh] mland:max-h-[calc(100dvh-14px)] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Compact Modal Header */}
        <header className="shrink-0 px-4 py-2 mland:px-3 mland:py-1 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {liveTeam && (
              <div className="shrink-0 w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/70 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                <ClubCrest
                  name={liveTeam.name}
                  size={20}
                  team={liveTeam}
                  club={state.club}
                  isMyClub={isMyTeam && state.mode === 'm'}
                />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs sm:text-sm mland:text-xs font-extrabold font-display truncate flex items-center gap-1.5 text-[var(--ink)]">
                <span className="truncate">{livePlayer.n}</span>
                <span className="text-[var(--mut)] font-semibold text-[11px] mland:text-[10px] shrink-0">
                  · {liveTeam ? liveTeam.name : livePlayer.free ? 'ฟรีเอเยนต์' : 'ตลาดซื้อขาย'}
                </span>
              </div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate flex items-center gap-1.5">
                <span>{SPN[livePlayer.ro] || livePlayer.pos}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold" style={{ color: fitCol }}>{statusBadgeText}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mland:gap-1.5 shrink-0">
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
              <button
                type="button"
                onClick={() => { SFX.tap(); setInspectMode('info'); }}
                className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg mland:rounded-md text-[11px] mland:text-[9.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  effectiveMode === 'info'
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                    : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                📊 การ์ด &amp; ค่าพลัง
              </button>
              <button
                type="button"
                onClick={() => { SFX.tap(); setInspectMode('history'); }}
                className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg mland:rounded-md text-[11px] mland:text-[9.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  effectiveMode === 'history'
                    ? 'bg-[var(--g)] text-white shadow-xs'
                    : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                📜 ประวัติผลงาน
              </button>
              {canDoMissions && (
                <button
                  type="button"
                  onClick={() => { SFX.tap(); setInspectMode('missions'); }}
                  className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg mland:rounded-md text-[11px] mland:text-[9.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    effectiveMode === 'missions'
                      ? 'bg-[var(--g)] text-white shadow-xs'
                      : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  🎯 ภารกิจ
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="w-8 h-8 mland:w-7 mland:h-7 rounded-full bg-[var(--surface-2)] hover:bg-[var(--line)]/60 border border-[var(--line)] text-xs font-bold flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              ✕
            </button>
          </div>
        </header>

        {effectiveMode === 'missions' && canDoMissions ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2.5">
            <PlayerMissionsPanel
              player={livePlayer}
              team={liveTeam}
              state={state}
              onUpdateState={onUpdateState}
              onToast={onToast}
            />
          </div>
        ) : effectiveMode === 'history' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2.5">
            <PlayerHistoryPanel
              player={livePlayer}
              team={liveTeam}
              state={state}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden mland:overflow-hidden p-3 sm:p-3.5 mland:p-2 grid grid-cols-1 md:grid-cols-[248px_1fr] mland:grid-cols-[202px_1fr] gap-2.5 mland:gap-2">
            {/* Left Column: Collectible Athlete Card + Quick Squad Controls */}
            <div className="flex flex-col gap-2 mland:gap-1.5 min-h-0 md:overflow-hidden mland:overflow-hidden">
              {/* Signature Athlete Card */}
              <div className="relative rounded-2xl mland:rounded-xl border border-white/15 bg-gradient-to-b from-[#16231d] via-[#0e1713] to-[#080e0b] text-white shadow-lg overflow-hidden shrink-0 flex flex-col">
                {/* Club Accent Top Bar */}
                <div
                  aria-hidden="true"
                  className="h-1 w-full shrink-0"
                  style={{ background: `linear-gradient(90deg, ${kit1}, ${kit2})` }}
                />

                {/* Top Corner: OVR / POS + POT / Badges */}
                <div className="px-3 pt-2 mland:px-2 mland:pt-1.5 flex items-start justify-between gap-2">
                  <div className="leading-none">
                    <div className={`text-2xl sm:text-[26px] mland:text-base font-extrabold font-display tabular ${statTierMeta(livePlayer.ov).darkTextClass}`}>
                      {livePlayer.ov}
                    </div>
                    <div className="text-[10px] mland:text-[8px] font-bold text-white/80 tracking-wide mt-0.5">
                      {livePlayer.ro} · #{currentNo}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`text-[10px] mland:text-[8.5px] font-bold tabular ${statTierMeta(livePlayer.pot).darkTextClass}`}>
                      POT {livePlayer.pot}
                    </span>
                    <span
                      className="px-1.5 py-[1px] rounded text-[9px] mland:text-[7.5px] font-extrabold tabular leading-tight border border-white/15"
                      style={{ background: tlMeta.bg, color: tlMeta.color }}
                      title={`พรสวรรค์ ${playerTalent}/99 (${tlMeta.label})`}
                    >
                      TL {playerTalent}
                    </span>
                    <div className="flex items-center gap-1">
                      {isMePlayer && (
                        <span
                          title="ตัวคุณ"
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--lamp)] text-[#261900] text-[9.5px] font-black"
                        >
                          ★
                        </span>
                      )}
                      {livePlayer.blessed && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-300 text-[#261900] text-[9px] font-extrabold leading-none">
                          ✨ พร
                        </span>
                      )}
                      {(livePlayer.hg || livePlayer.customCreated) && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-400/20 border border-emerald-300/45 text-emerald-200 text-[9px] font-extrabold leading-none">
                          🌱 เด็กปั้น
                        </span>
                      )}
                      {isCap && (
                        <span className="px-1.5 py-0.5 rounded bg-white/18 text-white text-[9px] font-bold leading-none">
                          © กัปตัน
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Neutral Studio Spotlight Portrait Stage */}
                <div className="relative mx-2.5 my-1.5 mland:mx-2 mland:my-1 rounded-xl border border-white/10 bg-gradient-to-b from-[#23322c] via-[#18231e] to-[#111915] pt-1.5 mland:pt-1 flex items-end justify-center overflow-hidden shadow-inner">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 50% 48%, rgba(241, 248, 244, 0.24) 0%, rgba(212, 228, 220, 0.08) 46%, transparent 74%)'
                    }}
                  />
                  <div className="relative z-10 [&>svg]:w-[78px] [&>svg]:h-[84px] mland:[&>svg]:w-[54px] mland:[&>svg]:h-[58px] drop-shadow-[0_10px_16px_rgba(0,0,0,0.72)]">
                    <PlayerFace
                      player={{ ...livePlayer, no: currentNo }}
                      team={liveTeam}
                      state={state}
                      careerProfile={isMePlayer ? state.p : null}
                      kitColor={kit1}
                      trimColor={kit2}
                      size={80}
                      bare
                    />
                  </div>
                </div>

                {/* Athlete Identity & Trait */}
                <div className="px-2.5 pb-1.5 mland:px-2 mland:pb-1 text-center space-y-0.5">
                  <div className="font-display font-extrabold text-sm mland:text-[11px] text-white truncate leading-tight">
                    {livePlayer.n}
                  </div>
                  <div className="text-[10px] mland:text-[8px] text-emerald-100/80 truncate tabular">
                    อายุ {livePlayer.age} ปี · {info.gro} · {info.TR[1]}
                  </div>
                  {info.traits.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 pt-0.5">
                      {info.traits.map((t) => (
                        <span
                          key={t.id}
                          title={t.desc}
                          className={`px-1.5 py-[1px] rounded text-[8.5px] mland:text-[7px] font-bold border leading-tight ${
                            ['hot_headed', 'selfish_shooter', 'glass_cannon', 'slide_tackler'].includes(t.id)
                              ? 'bg-amber-400/15 border-amber-300/35 text-amber-200'
                              : 'bg-emerald-400/15 border-emerald-300/30 text-emerald-100'
                          }`}
                        >
                          {t.icon} {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom 5 Core Stats Strip with Color Bars */}
                <div className="bg-[#060c09]/92 border-t border-white/10 px-2 py-2 mland:px-1.5 mland:py-1 grid grid-cols-5 gap-1 text-center">
                  {ATT.map(([k, l]) => {
                    const val = info.a[k];
                    const tier = statTierMeta(val);
                    return (
                      <div key={k} className="rounded-lg bg-white/[0.04] py-1 mland:py-0.5 px-0.5 space-y-0.5">
                        <div className="text-[8.5px] mland:text-[7px] text-white/60 leading-tight truncate">{l}</div>
                        <div className={`text-xs sm:text-[13px] mland:text-[10px] font-extrabold font-display tabular leading-tight ${tier.darkTextClass}`}>
                          {val}
                        </div>
                        <div className="h-2 sm:h-2.5 mland:h-1.5 rounded-full bg-white/15 overflow-hidden mx-0.5">
                          <div className="h-full rounded-full transition-all" style={{ width: `${clamp(val, 8, 100)}%`, background: statBarColor(val) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Team Controls Card (Shirt # & Captain) */}
              {isMyTeam && state.mode === 'm' && (
                <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 mland:p-1.5 shadow-xs space-y-1.5 mland:space-y-1 shrink-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">เบอร์เสื้อ</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={shirtNo}
                        onChange={(e) => setShirtNo(e.target.value)}
                        className="w-12 px-1.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10.5px] font-bold text-center tabular"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const n = clamp(parseInt(shirtNo, 10) || currentNo, 1, 99);
                          onUpdateState((d) => {
                            const sq = d.teams[d.me].sq;
                            const pl = sq.find((q) => q.n === livePlayer.n);
                            if (!pl) return;
                            const oldNo = getShirtNo(d.teams[d.me], pl);
                            const holder = sq.find((q) => q !== pl && q.no === n);
                            if (holder) {
                              holder.no = oldNo;
                              if (Array.isArray(holder.vis) && holder.vis.length >= 6) holder.vis[5] = oldNo;
                            }
                            pl.no = n;
                            if (Array.isArray(pl.vis) && pl.vis.length >= 6) pl.vis[5] = n;
                            if (pl.me && d.p) d.p.no = n;
                          });
                          setShirtNo(String(n));
                          onToast(`เปลี่ยนเบอร์เสื้อ ${livePlayer.n} เป็น #${n}`);
                        }}
                        className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-[11px] mland:text-[9.5px] font-bold cursor-pointer"
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateState((d) => {
                        d.teams[d.me].cap = livePlayer.n;
                      });
                      onToast(`แต่งตั้ง ${livePlayer.n} เป็นกัปตันทีม`);
                    }}
                    className={`w-full py-1.5 mland:py-1 rounded-xl mland:rounded-lg text-[11px] mland:text-[9.5px] font-bold cursor-pointer transition-colors ${
                      isCap
                        ? 'bg-[var(--lamp)] text-[#261900]'
                        : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                    }`}
                  >
                    {isCap ? '© กัปตันทีมปัจจุบัน' : 'แต่งตั้งเป็นกัปตันทีม'}
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Modular Status Cards, Compact Season Bar & Attribute Breakdown Cards */}
            <div className="min-h-0 flex flex-col gap-1.5 mland:gap-1 md:overflow-y-auto mland:overflow-y-auto pr-0.5">
              {/* Row 1: 3 Modular Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-1.5 mland:gap-1 shrink-0">
                {/* Card 1: Fitness & Discipline */}
                <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 mland:p-1 shadow-xs flex flex-col justify-between gap-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] mland:text-[8.5px] font-bold text-[var(--mut)]">⚡ สภาพร่างกาย</span>
                    <span className="tabular text-[10px] mland:text-[8px] text-[var(--mut)] shrink-0">
                      🟨{livePlayer.yc || 0}/3 · 🟥{livePlayer.rc || 0}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-1.5">
                    <span className={`font-extrabold text-base sm:text-lg mland:text-xs font-display tabular leading-tight ${statTierMeta(fitVal).textClass}`}>
                      {fitVal}
                    </span>
                    <span className="text-[10.5px] mland:text-[8px] font-bold truncate" style={{ color: fitCol }}>
                      {statusBadgeText}
                    </span>
                  </div>
                  <div className="h-2.5 mland:h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${clamp(fitVal, 6, 100)}%`, background: fitCol }} />
                  </div>
                </div>

                {/* Card 2: Market Value & Contract */}
                <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 mland:p-1 shadow-xs flex flex-col justify-between gap-0.5">
                  <div className="text-[11px] mland:text-[8.5px] font-bold text-[var(--mut)]">💎 ค่าตัว &amp; สัญญา</div>
                  <div className="font-extrabold text-base sm:text-lg mland:text-xs font-display text-[var(--g)] tabular leading-tight">
                    {fmtMoney(vlu(livePlayer))}
                  </div>
                  <div className="text-[10.5px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                    {con ? `สัญญา ${con.yr} ปี · ${fmtMoneyNum(con.wg)}/นัด` : `ค่าเหนื่อย ${fmtMoneyNum(wagOf(livePlayer))}/นัด`}
                  </div>
                </div>

                {/* Card 3: Season Performance */}
                <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 mland:p-1 shadow-xs flex flex-col justify-between gap-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] mland:text-[8.5px] font-bold text-[var(--mut)]">📈 ผลงานซีซั่นนี้</span>
                    <span className="text-[10px] mland:text-[8px] font-semibold text-[var(--mut)] tabular">
                      👕 {livePlayer.sp || 0} นัด
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-center">
                    <div className="rounded-lg bg-[var(--surface-2)]/80 px-1.5 py-0.5 flex items-center justify-center gap-1 leading-none">
                      <span className="text-[11px] mland:text-[9px] leading-none" aria-hidden="true">⚽</span>
                      <span className="text-[10px] mland:text-[8px] text-[var(--mut)]">ประตู</span>
                      <span className="font-extrabold text-xs sm:text-sm mland:text-[10.5px] tabular">{livePlayer.sg || 0}</span>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-2)]/80 px-1.5 py-0.5 flex items-center justify-center gap-1 leading-none">
                      <span className="text-[11px] mland:text-[9px] leading-none" aria-hidden="true">
                        {livePlayer.pos === 'GK' ? '🧤' : '🎯'}
                      </span>
                      <span className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                        {livePlayer.pos === 'GK' ? 'คลีนชีต' : 'แอสซิสต์'}
                      </span>
                      <span className="font-extrabold text-xs sm:text-sm mland:text-[10.5px] tabular">
                        {livePlayer.pos === 'GK' ? livePlayer.cs || 0 : livePlayer.sa || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Injury Rehab Card (compact bar when injured) */}
              {livePlayer.inj > 0 && (() => {
                const curTurn = state.season * 40 + state.md;
                const medLv = state.med ?? 1;
                const physioLv = state.staff?.physio ?? 0;
                const treatCost = Math.max(6, 14 - medLv * 2 - physioLv * 2);
                const alreadyTreated = livePlayer.treatedMd === curTurn;
                return (
                  <div className="shrink-0 px-3 py-2 mland:px-2 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/40 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-xs mland:text-[9.5px] text-[var(--red)] truncate">
                        🩹 บาดเจ็บ (พักอีก {livePlayer.inj} นัด · 🏥 Lv.{medLv})
                      </div>
                      <div className="text-[10px] mland:text-[8px] text-[var(--mut)] truncate">
                        ฟื้นตัวอัตโนมัติหลังจบเกม -1 นัด (ศูนย์แพทย์ Lv.3+ ลด -2 นัด)
                      </div>
                    </div>
                    {isMyTeam && state.mode === 'm' && (
                      <button
                        type="button"
                        disabled={alreadyTreated || state.money < treatCost}
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            const sq = d.teams[d.me].sq;
                            const pl = sq.find((q) => q.n === livePlayer.n);
                            if (!pl || pl.inj <= 0 || pl.treatedMd === curTurn || d.money < treatCost) return;
                            d.money -= treatCost;
                            logFin(d, `กายภาพบำบัด ${pl.n}`, -treatCost);
                            pl.inj = Math.max(0, pl.inj - 1);
                            pl.fit = clamp((pl.fit ?? 70) + 10, 40, 100);
                            pl.treatedMd = curTurn;
                          });
                          onToast(livePlayer.inj - 1 <= 0 ? `💉 รักษา ${livePlayer.n} หายเจ็บพร้อมลงสนามแล้ว!` : `💉 ทำกายภาพ ${livePlayer.n} ลดวันพักเหลือ ${livePlayer.inj - 1} นัด (+10% ฟิต)`);
                        }}
                        className="shrink-0 px-3 py-1.5 mland:px-2 mland:py-0.5 rounded-xl bg-[var(--g)] text-white text-[11px] mland:text-[9px] font-bold cursor-pointer disabled:opacity-45"
                      >
                        {alreadyTreated
                          ? '✅ ทำกายภาพรอบนี้แล้ว'
                          : `💉 กายภาพด่วน (-1 นัด · ${fmtMoney(treatCost)})`}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Compact Collapsible Season Progression Bar (No Layout Shift) */}
              <div className="relative shrink-0">
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 mland:px-2 mland:py-1 shadow-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 mland:gap-1.5 min-w-0 flex-1 text-[10.5px] mland:text-[8.5px] tabular">
                    <span className="font-bold text-[var(--ink)] shrink-0">
                      📈 พัฒนาการซ.{state.season}
                    </span>
                    <span className="font-bold text-[var(--mut)] shrink-0">
                      OVR {startOv}→{endOv}
                      {ovDiff !== 0 && (
                        <span className={`ml-0.5 font-extrabold ${ovDiff > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                          ({ovDiff > 0 ? `+${ovDiff}` : ovDiff})
                        </span>
                      )}
                    </span>
                    <span className="hidden sm:inline text-[var(--mut)] truncate">
                      {(KEY_STATS_BY_POS[livePlayer.pos] || ['sh', 'ps', 'dr']).map((k, idx) => {
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
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setShowProgChart((v) => !v);
                    }}
                    className={`px-2 mland:px-1.5 py-0.5 rounded-lg border text-[10px] mland:text-[8px] font-bold cursor-pointer transition-colors shrink-0 ${
                      showProgChart
                        ? 'bg-[var(--g)] border-[var(--g)] text-white'
                        : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                    }`}
                  >
                    {showProgChart ? 'ย่อกราฟ ▴' : 'ดูกราฟ ▾'}
                  </button>
                </div>

                {showProgChart && (
                  <div className="absolute inset-x-0 top-full mt-1.5 z-30 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--g)]/55 px-3 py-2.5 mland:px-2.5 mland:py-2 shadow-2xl space-y-1.5 mland:space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate">
                          📈 กราฟพัฒนาการซีซั่น {state.season}
                        </span>
                        <span className="text-[10.5px] mland:text-[8.5px] font-bold tabular text-[var(--mut)] shrink-0">
                          OVR {startOv} → {endOv}
                          {ovDiff !== 0 && (
                            <span className={`ml-1 ${ovDiff > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                              ({ovDiff > 0 ? `+${ovDiff}` : ovDiff})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
                          <button
                            type="button"
                            onClick={() => { SFX.tap(); setChartScope('key'); }}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] mland:text-[8px] font-bold cursor-pointer transition-colors ${
                              chartScope === 'key'
                                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                                : 'text-[var(--mut)] hover:text-[var(--ink)]'
                            }`}
                          >
                            จุดเด่น
                          </button>
                          <button
                            type="button"
                            onClick={() => { SFX.tap(); setChartScope('all'); }}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] mland:text-[8px] font-bold cursor-pointer transition-colors ${
                              chartScope === 'all'
                                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                                : 'text-[var(--mut)] hover:text-[var(--ink)]'
                            }`}
                          >
                            ครบ 5 ค่า
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { SFX.tap(); setShowProgChart(false); }}
                          className="px-1.5 py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10px] mland:text-[8px] font-bold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          ✕ ย่อ
                        </button>
                      </div>
                    </div>

                    <div className="h-[132px] mland:h-[105px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={seasonSeries} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
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
                            domain={[(min: number) => Math.max(1, min - 2), (max: number) => Math.min(99, max + 2)]}
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
                                type="monotone"
                                dataKey={k}
                                name={meta.label}
                                stroke={meta.color}
                                strokeWidth={meta.width}
                                dot={seasonSeries.length <= 2 ? { r: 3, strokeWidth: 1.5 } : { r: 1.5, strokeWidth: 1 }}
                                activeDot={{ r: 4 }}
                                animationDuration={250}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2 mland:gap-1.5">
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
                                isHidden ? 'opacity-35 line-through' : 'opacity-100'
                              }`}
                            >
                              <span className="w-2.5 h-[2.5px] rounded-full shrink-0" style={{ background: meta.color }} />
                              <span className="text-[var(--ink)]">{meta.label}</span>
                              <span className="text-[var(--mut)]">{curVal}</span>
                              {diff !== 0 && (
                                <span className={diff > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {state.md === 0 && (
                        <span className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">
                          เริ่มต้นซีซั่น · กราฟจะอัปเดตทุกนัด
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Balanced Fit-to-Screen Attribute Card Grid (No duplicate traits header) */}
              {info.G.length === 5 ? (
                <div className="flex flex-col gap-1.5 mland:gap-1 flex-1 min-h-0 justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-1.5 mland:gap-1">
                    {info.G.slice(0, 2).map(([grp, rows]) => (
                      <div
                        key={grp}
                        className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                      >
                        <div className="font-bold text-[11.5px] mland:text-[9px] text-[var(--ink)] pb-0.5 mb-1 border-b border-[var(--line)]/70">
                          {grp}
                        </div>
                        <div className="space-y-0.5">
                          {rows.map(([lbl, val]) => (
                            <StatBarRow
                              key={lbl}
                              label={lbl}
                              value={val}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-1.5 mland:gap-1">
                    {info.G.slice(2).map(([grp, rows]) => (
                      <div
                        key={grp}
                        className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                      >
                        <div className="font-bold text-[11.5px] mland:text-[9px] text-[var(--ink)] pb-0.5 mb-1 border-b border-[var(--line)]/70">
                          {grp}
                        </div>
                        <div className="space-y-0.5">
                          {rows.map(([lbl, val]) => (
                            <StatBarRow
                              key={lbl}
                              label={lbl}
                              value={val}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-1.5 mland:gap-1">
                  {info.G.map(([grp, rows]) => (
                    <div
                      key={grp}
                      className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                    >
                      <div className="font-bold text-[11.5px] mland:text-[9px] text-[var(--ink)] pb-0.5 mb-1 border-b border-[var(--line)]/70">
                        {grp}
                      </div>
                      <div className="space-y-0.5">
                        {rows.map(([lbl, val]) => (
                          <StatBarRow
                            key={lbl}
                            label={lbl}
                            value={val}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const TeamInspectorModal: React.FC<{
  team: Team;
  state: GameState;
  onClose: () => void;
  onInspectPlayer: (p: Player, t: Team) => void;
}> = ({ team, state, onClose, onInspectPlayer }) => {
  const [teamTab, setTeamTab] = useState<'squad' | 'history'>('squad');
  const [posFilter, setPosFilter] = useState<'ALL' | 'XI' | Position>('ALL');
  const st = teamStats(team, state);
  const myTeam = state.teams[state.me];
  const mySt = teamStats(myTeam, state);
  const isMeTeam = team.id === state.me;
  const tierTable = sortTable(state.teams.filter((t) => t.tier === team.tier));
  const rank = team.tier < 3 ? tierTable.findIndex((t) => t.id === team.id) + 1 : null;
  const starters = xi(team);
  const starterNames = new Set(starters.map((q) => q.n));
  const topScorer = team.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0) || b.ov - a.ov)[0];
  const topAssist = team.sq.slice().sort((a, b) => (b.sa || 0) - (a.sa || 0) || b.ov - a.ov)[0];
  const totalVal = team.sq.reduce((s, q) => s + vlu(q), 0);
  const formChars = (team.fm || '').slice(-5).split('');
  const gd = team.gf - team.ga;

  const filteredSquad = useMemo(() => {
    const base = team.sq.slice().sort((a, b) => {
      const aIn = starterNames.has(a.n) ? 1 : 0;
      const bIn = starterNames.has(b.n) ? 1 : 0;
      return bIn - aIn || b.ov - a.ov;
    });
    if (posFilter === 'XI') return base.filter((q) => starterNames.has(q.n));
    if (posFilter === 'ALL') return base;
    return base.filter((q) => q.pos === posFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.sq, posFilter]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 mland:p-2 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl mland:max-w-[96vw] h-[min(92dvh,720px)] mland:h-[95dvh] mland:max-h-[calc(100dvh-14px)] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Modal Header */}
        <header className="shrink-0 px-4 py-2 mland:px-3 mland:py-1 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
            <div className="shrink-0 w-9 h-9 mland:w-7 mland:h-7 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]/70 flex items-center justify-center [&>svg]:w-7 [&>svg]:h-7 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
              <ClubCrest name={team.name} size={28} team={team} club={state.club} isMyClub={isMeTeam && state.mode === 'm'} />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base mland:text-xs font-extrabold font-display truncate flex items-center gap-1.5 text-[var(--ink)]">
                <span className="truncate">{team.name}</span>
                {isMeTeam && (
                  <span
                    title="ทีมของคุณ"
                    aria-label="ทีมของคุณ"
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--lamp)] text-[#261900] text-[9.5px] font-black shrink-0"
                  >
                    ★
                  </span>
                )}
              </div>
              <div className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate tabular">
                <span>{TN[team.tier] || 'สโมสรทวีป'}</span>
                {rank ? <span> · อันดับ <b className="text-[var(--ink)]">{rank}</b> ({team.pts} แต้ม)</span> : null}
                <span> · ชนะ {team.w} เสมอ {team.d} แพ้ {team.l} ({gd >= 0 ? `+${gd}` : gd})</span>
                <span className="hidden sm:inline mland:inline"> · อายุเฉลี่ย {st.age} ปี</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mland:gap-1.5 shrink-0">
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
              <button
                type="button"
                onClick={() => { SFX.tap(); setTeamTab('squad'); }}
                className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg mland:rounded-md text-[11px] mland:text-[9.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  teamTab === 'squad'
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                    : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                👥 ผัง &amp; ขุมกำลัง
              </button>
              <button
                type="button"
                onClick={() => { SFX.tap(); setTeamTab('history'); }}
                className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg mland:rounded-md text-[11px] mland:text-[9.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  teamTab === 'history'
                    ? 'bg-[var(--g)] text-white shadow-xs'
                    : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                📜 ประวัติศาสตร์ทีม
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="w-8 h-8 mland:w-7 mland:h-7 rounded-full bg-[var(--surface-2)] hover:bg-[var(--line)]/60 border border-[var(--line)] text-xs font-bold flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              ✕
            </button>
          </div>
        </header>

        {teamTab === 'history' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2">
            <ClubHistoryPanel
              team={team}
              state={state}
              onInspectPlayer={onInspectPlayer}
              compact
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden mland:overflow-hidden p-3 sm:p-3.5 mland:p-2 grid grid-cols-1 md:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] mland:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 mland:gap-2 items-stretch">
            {/* Left Column: Full-Height Formation Pitch */}
            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 mland:p-1.5 flex flex-col min-h-[340px] md:min-h-0 mland:min-h-0 overflow-hidden shadow-xs">
              <div className="shrink-0 flex items-center justify-between gap-2 px-1 pb-1.5 mland:pb-1">
                <div className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate">
                  <b className="text-[var(--ink)]">ผัง 11 ตัวจริง</b> · แตะนักเตะเพื่อดูพลัง
                </div>
                <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--g)] tabular whitespace-nowrap shrink-0">
                  {team.form} · {AR_T[team.tac]}
                </span>
              </div>
              <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                <FormationPitch
                  team={team}
                  state={state}
                  className="aspect-[300/340] h-full max-h-full w-auto max-w-full mx-auto rounded-xl block select-none"
                  onPlayerPointerDown={(e, q) => {
                    e.stopPropagation();
                    SFX.tap();
                    onInspectPlayer(q, team);
                  }}
                />
              </div>
            </section>

            {/* Right Column: Compact Team Summary + Squad List */}
            <div className="flex flex-col min-h-0 gap-2.5 mland:gap-1.5 md:overflow-hidden mland:overflow-hidden">
              {/* Compact Team Overview Card */}
              <section className="shrink-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2 mland:px-2.5 mland:py-1.5 shadow-xs space-y-1.5 mland:space-y-1">
                <div className="grid grid-cols-4 divide-x divide-[var(--line)]/70 text-center">
                  {(
                    [
                      ['ตัวจริง XI', st.ovXi, mySt.ovXi],
                      ['เฉลี่ยทีม', st.ovSq, mySt.ovSq],
                      ['เกมรุก', st.at, mySt.at],
                      ['เกมรับ', st.df, mySt.df]
                    ] as const
                  ).map(([lbl, val, myVal]) => {
                    const diff = val - myVal;
                    return (
                      <div key={lbl} className="px-1">
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)] leading-tight">{lbl}</div>
                        <div className="font-extrabold text-sm sm:text-base mland:text-xs font-display tabular leading-tight mt-0.5">
                          {val}
                          {!isMeTeam && diff !== 0 && (
                            <span className={`ml-0.5 text-[10px] mland:text-[8px] font-bold ${diff > 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                              ({diff > 0 ? `+${diff}` : diff})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-[var(--line)]/70 pt-1.5 mland:pt-1 space-y-1 mland:space-y-0.5 text-[11px] mland:text-[9px]">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="truncate text-[var(--mut)]">
                      ปรัชญา: <b className="text-[var(--ink)]">{team.philosophy || `${team.form} · ${AR_T[team.tac]}`}</b>
                    </div>
                    <div className="shrink-0 tabular text-[var(--mut)]">
                      มูลค่ารวม <b className="text-[var(--ink)]">{fmtMoney(totalVal)}</b>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="truncate text-[var(--mut)] tabular">
                      ⚽ <b className="text-[var(--ink)]">{topScorer ? `${topScorer.n.split(' ')[0]} (${topScorer.sg || 0})` : '-'}</b>
                      <span className="mx-1.5">·</span>
                      🎯 <b className="text-[var(--ink)]">{topAssist ? `${topAssist.n.split(' ')[0]} (${topAssist.sa || 0})` : '-'}</b>
                    </div>
                    {formChars.length > 0 && (
                      <div className="flex items-center gap-0.5 shrink-0" title="ฟอร์ม 5 นัดล่าสุด">
                        {formChars.map((c, idx) => (
                          <span
                            key={idx}
                            className={`w-4 h-4 mland:w-3.5 mland:h-3.5 rounded text-[9px] mland:text-[7.5px] font-bold flex items-center justify-center text-white ${
                              c === 'W' ? 'bg-[var(--g)]' : c === 'L' ? 'bg-[var(--red)]' : 'bg-amber-500'
                            }`}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Squad Roster List */}
              <section className="flex-1 min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-xs">
                <div className="shrink-0 px-3 py-2 mland:px-2.5 mland:py-1 bg-[var(--surface-2)]/50 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-1.5">
                  <div className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)] tabular">
                    ขุมกำลัง ({filteredSquad.length}/{team.sq.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(['ALL', 'XI', 'FW', 'MF', 'DF', 'GK'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPosFilter(f)}
                        className={`px-2 mland:px-1.5 py-0.5 rounded-lg text-[10.5px] mland:text-[8.5px] font-semibold cursor-pointer transition-colors ${
                          posFilter === f
                            ? 'bg-[var(--g)] text-white'
                            : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {f === 'ALL' ? 'ทั้งหมด' : f === 'XI' ? 'ตัวจริง' : f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-[var(--line)]/60 flex-1 min-h-0 overflow-y-auto">
                  {filteredSquad.map((q) => {
                    const isStarter = starterNames.has(q.n);
                    const isMe = !!q.me || (state.mode === 'p' && state.p?.name === q.n);
                    const f = Math.round(q.fit ?? 100);
                    const fCol = q.inj > 0 || (q.sus || 0) > 0 ? 'var(--red)' : f >= 85 ? 'var(--g)' : f >= 65 ? '#c98a00' : 'var(--red)';
                    return (
                      <button
                        key={q.n}
                        type="button"
                        onClick={() => onInspectPlayer(q, team)}
                        className={`w-full flex items-center justify-between gap-2 px-3 mland:px-2 py-1.5 mland:py-1 hover:bg-[var(--surface-2)]/65 text-left text-xs mland:text-[10px] cursor-pointer transition-colors ${
                          isMe ? 'bg-[var(--lamp-soft)]/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                          <div className="shrink-0 mland:[&_svg]:w-6 mland:[&_svg]:h-6">
                            <PlayerFace player={q} team={team} state={state} careerProfile={isMe ? state.p : null} size={28} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate flex items-center gap-1 leading-tight">
                              {isMe && (
                                <span
                                  title="ตัวคุณ"
                                  aria-label="ตัวคุณ"
                                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8.5px] font-black shrink-0"
                                >
                                  ★
                                </span>
                              )}
                              <span className="text-[var(--mut)] tabular shrink-0">#{getShirtNo(team, q)}</span>
                              {isStarter && <span className="text-[var(--g)] shrink-0" title="ตัวจริง">★</span>}
                              {team.cap === q.n && <span className="text-[var(--lamp)] font-bold shrink-0">©</span>}
                              <span className="truncate">{q.n}</span>
                            </div>
                            <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1 mt-0.5">
                              <span>{q.ro} · อายุ {q.age} ·</span>
                              <span className="inline-flex items-center gap-0.5 tabular">
                                {(q.sg || 0) <= 1 && <span>{q.sg || 0}</span>}
                                <StatIconBadge kind="goal" count={Math.max(1, q.sg || 0)} size="xs" />
                              </span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5 tabular">
                                {(q.sa || 0) <= 1 && <span>{q.sa || 0}</span>}
                                <StatIconBadge kind="assist" count={Math.max(1, q.sa || 0)} size="xs" />
                              </span>
                              {(q.sus || 0) > 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-[var(--red)] font-bold">
                                  · <StatIconBadge kind="red" count={q.sus} size="xs" /> แบน
                                </span>
                              ) : q.inj > 0 ? (
                                <span>· 🩹{q.inj}</span>
                              ) : (q.yc || 0) > 0 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  · <StatIconBadge kind="yellow" count={q.yc || 1} size="xs" /> {q.yc}/3
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex flex-col items-end gap-0.5 w-10 mland:w-8" title={`พลังงาน ${f}%`}>
                            <span className="text-[9.5px] mland:text-[8px] font-extrabold tabular leading-none" style={{ color: fCol }}>
                              ⚡{f}%
                            </span>
                            <div className="w-full h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${clamp(f, 4, 100)}%`, background: fCol }} />
                            </div>
                          </div>
                          <span
                            className="w-7 text-center py-0.5 rounded-lg text-white font-bold tabular shrink-0 text-[11px] mland:text-[9.5px]"
                            style={{ background: ovColor(q.ov) }}
                          >
                            {q.ov}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

