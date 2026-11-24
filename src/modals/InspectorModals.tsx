import React, { useMemo, useState } from 'react';
import type { Position, Player, Team, GameState } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { TN, ATT, SPN, AR_T } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, xi, dtInfo, vlu, wagOf, ensureCon, logFin, tc } from '../engine/playerCore';
import { ovColor, statBarColor, statTierMeta, getPlayerTalent, talentTierMeta } from '../engine/missions';
import { sortTable, teamStats } from '../engine/simulation';
import { ClubCrest, PlayerFace, FormationPitch } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { PlayerHistoryPanel } from '../components/PlayerHistoryPanel';
import { ClubHistoryPanel } from '../components/ClubHistoryPanel';
import { PlayerSeasonProgressionCard } from '../components/PlayerSeasonProgressionCard';

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
  const effectiveMode = inspectMode === 'missions' && !(isMyTeam || isMePlayer) ? 'info' : inspectMode;
  const canDoMissions = isMyTeam || isMePlayer;
  const playerTalent = getPlayerTalent(livePlayer, isMePlayer ? state.p : null);
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
                  · {liveTeam ? liveTeam.name : livePlayer.free ? 'ฟรีเอเยนต์' : livePlayer.customCreated ? 'นักเตะสร้างเอง' : 'ตลาดซื้อขาย'}
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
              {/* Row 1: Unified Compact Summary Strip (Fitness · Value & Contract · Season Stats) */}
              <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x mland:divide-y-0 mland:divide-x divide-[var(--line)]/70 shrink-0">
                {/* Section 1: Fitness & Discipline */}
                <div className="px-3 py-2 mland:px-2 mland:py-1 flex flex-col justify-between gap-1 mland:gap-0.5 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)] truncate">⚡ สภาพร่างกาย</span>
                    <span className="tabular text-[10px] mland:text-[8px] font-semibold text-[var(--mut)] shrink-0">
                      🟨{livePlayer.yc || 0}/3 · 🟥{livePlayer.rc || 0}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-1.5">
                    <span className={`font-extrabold text-base sm:text-[17px] mland:text-xs font-display tabular leading-none ${statTierMeta(fitVal).textClass}`}>
                      {fitVal}%
                    </span>
                    <span className="text-[10.5px] mland:text-[8px] font-bold truncate" style={{ color: fitCol }}>
                      {statusBadgeText}
                    </span>
                  </div>
                  <div className="h-1.5 mland:h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${clamp(fitVal, 6, 100)}%`, background: fitCol }} />
                  </div>
                </div>

                {/* Section 2: Market Value & Contract */}
                <div className="px-3 py-2 mland:px-2 mland:py-1 flex flex-col justify-between gap-1 mland:gap-0.5 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)] truncate">💎 ค่าตัว &amp; สัญญา</span>
                    <span className="text-[10px] mland:text-[8px] font-bold text-[var(--ink)]/75 tabular shrink-0">
                      {con ? `${con.yr} ปี` : livePlayer.free ? 'ฟรีเอเยนต์' : 'ประเมิน'}
                    </span>
                  </div>
                  <div className="font-extrabold text-base sm:text-[17px] mland:text-xs font-display text-[var(--g)] tabular leading-none truncate">
                    {fmtMoney(vlu(livePlayer))}
                  </div>
                  <div className="text-[10px] mland:text-[8px] text-[var(--mut)] tabular truncate leading-none">
                    ค่าเหนื่อย <b className="text-[var(--ink)]/85">{fmtMoneyNum(con ? con.wg : wagOf(livePlayer))}</b>/นัด
                  </div>
                </div>

                {/* Section 3: Season Performance */}
                <div className="px-3 py-2 mland:px-2 mland:py-1 flex flex-col justify-between gap-1 mland:gap-0.5 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)] truncate">📈 ผลงานซีซั่นนี้</span>
                    <span className="text-[10px] mland:text-[8px] font-bold text-[var(--ink)]/75 tabular shrink-0">
                      {livePlayer.sp || 0} นัด
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center items-end pt-0.5">
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm sm:text-[15px] mland:text-[11px] font-display tabular leading-none text-[var(--ink)]">
                        {livePlayer.sg || 0}
                      </div>
                      <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] truncate mt-0.5">⚽ ประตู</div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm sm:text-[15px] mland:text-[11px] font-display tabular leading-none text-[var(--ink)]">
                        {livePlayer.pos === 'GK' ? livePlayer.cs || 0 : livePlayer.sa || 0}
                      </div>
                      <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] truncate mt-0.5">
                        {livePlayer.pos === 'GK' ? '🧤 คลีนชีต' : '🎯 แอสซิสต์'}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm sm:text-[15px] mland:text-[11px] font-display tabular leading-none text-[#8a5b00] dark:text-[#fde047]">
                        {(livePlayer.sra || 0) > 0
                          ? ((livePlayer.srs || 0) / Math.max(1, livePlayer.sra || 1)).toFixed(1)
                          : '-'}
                      </div>
                      <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] truncate mt-0.5">⭐ เรตเฉลี่ย</div>
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
              <PlayerSeasonProgressionCard
                player={livePlayer}
                state={state}
                careerProfile={isMePlayer ? state.p : null}
                variant="overlay"
                defaultOpen={false}
              />

              {/* Balanced 3x2 Attribute Card Grid (Equal rows per box) */}
              <div
                className={`grid grid-cols-1 gap-1.5 mland:gap-1 ${
                  info.G.length === 6 ? 'sm:grid-cols-3 mland:grid-cols-3' : 'sm:grid-cols-2 mland:grid-cols-2'
                }`}
              >
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

