import React, { useMemo, useState } from 'react';
import type { Position, Player, Team, GameState } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { TN, ATT, SPN, SIGL, AR_T } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, xi, dtInfo, vlu, wagOf, ensureCon, logFin, tc } from '../engine/playerCore';
import { ovColor, statTierMeta, countReadyMissions } from '../engine/missions';
import { sortTable, teamStats } from '../engine/simulation';
import { ClubCrest, PlayerFace, FormationPitch } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';

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
  const [inspectMode, setInspectMode] = useState<'info' | 'missions'>('info');
  const effectiveMode = inspectMode;
  const canDoMissions = isMyTeam || isMePlayer;
  const readyMissionCnt = canDoMissions ? countReadyMissions(livePlayer, isMePlayer ? state.p : null) : 0;
  const isCap = !!liveTeam && liveTeam.cap === livePlayer.n;
  const con = liveTeam ? ensureCon(livePlayer) : null;
  const sigLabel = SIGL[info.D0.sig] || info.D0.sig;
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
        className="w-full max-w-5xl mland:max-w-[96vw] h-[min(92dvh,690px)] mland:h-[95dvh] mland:max-h-[calc(100dvh-14px)] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
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
            {canDoMissions && (
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
                  onClick={() => { SFX.tap(); setInspectMode('missions'); }}
                  className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg mland:rounded-md text-[11px] mland:text-[9.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    effectiveMode === 'missions'
                      ? 'bg-[var(--g)] text-white shadow-xs'
                      : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  🎯 ภารกิจ{readyMissionCnt ? ` (${readyMissionCnt})` : ''}
                </button>
              </div>
            )}

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
                      <span className="text-[10px] mland:text-[8px] text-white/45 font-semibold ml-0.5">/100</span>
                    </div>
                    <div className="text-[10px] mland:text-[8px] font-bold text-white/80 tracking-wide mt-0.5">
                      {livePlayer.ro} · #{currentNo}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`text-[10px] mland:text-[8.5px] font-bold tabular ${statTierMeta(livePlayer.pot).darkTextClass}`}>
                      POT {livePlayer.pot}/100
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
                    อายุ {livePlayer.age} ปี · {info.gro} · {info.TR[0]}
                  </div>
                </div>

                {/* Bottom 5 Core Stats Strip (Bar-less, Tier-Colored, /100) */}
                <div className="bg-[#060c09]/92 border-t border-white/10 px-2 py-2 mland:px-1.5 mland:py-1 grid grid-cols-5 gap-1 text-center">
                  {ATT.map(([k, l]) => {
                    const val = info.a[k];
                    const tier = statTierMeta(val);
                    return (
                      <div key={k} className="rounded-lg bg-white/[0.04] py-1 mland:py-0.5 px-0.5">
                        <div className="text-[8.5px] mland:text-[7px] text-white/60 leading-tight truncate">{l}</div>
                        <div className={`text-xs sm:text-[13px] mland:text-[10px] font-extrabold font-display tabular leading-tight mt-0.5 ${tier.darkTextClass}`}>
                          {val}
                          <span className="text-[7.5px] mland:text-[6.5px] text-white/40 font-semibold">/100</span>
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

            {/* Right Column: Modular Status Cards & Attribute Breakdown Cards (Fit-to-Screen) */}
            <div className="min-h-0 flex flex-col gap-2 mland:gap-1.5 md:overflow-hidden mland:overflow-hidden">
              {/* Row 1: 3 Modular Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-2 mland:gap-1.5 shrink-0">
                {/* Card 1: Fitness & Discipline (Bar-less numeric /100) */}
                <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2 mland:p-1.5 shadow-xs flex flex-col justify-between gap-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] mland:text-[8.5px] font-bold text-[var(--mut)]">⚡ สภาพร่างกาย</span>
                    <span className="tabular text-[10px] mland:text-[8px] text-[var(--mut)] shrink-0">
                      🟨{livePlayer.yc || 0}/3 · 🟥{livePlayer.rc || 0}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-1.5">
                    <span className={`font-extrabold text-base sm:text-lg mland:text-xs font-display tabular leading-tight ${statTierMeta(fitVal).textClass}`}>
                      {fitVal}
                      <span className="text-[10px] mland:text-[8px] opacity-60 font-semibold">/100</span>
                    </span>
                    <span className="text-[10.5px] mland:text-[8px] font-bold truncate" style={{ color: fitCol }}>
                      {statusBadgeText}
                    </span>
                  </div>
                </div>

                {/* Card 2: Market Value & Contract */}
                <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2 mland:p-1.5 shadow-xs flex flex-col justify-between gap-0.5">
                  <div className="text-[11px] mland:text-[8.5px] font-bold text-[var(--mut)]">💎 ค่าตัว &amp; สัญญา</div>
                  <div className="font-extrabold text-base sm:text-lg mland:text-xs font-display text-[var(--g)] tabular leading-tight">
                    {fmtMoney(vlu(livePlayer))}
                  </div>
                  <div className="text-[10.5px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                    {con ? `สัญญา ${con.yr} ปี · ${fmtMoneyNum(con.wg)}/นัด` : `ค่าเหนื่อย ${fmtMoneyNum(wagOf(livePlayer))}/นัด`}
                  </div>
                </div>

                {/* Card 3: Season Performance */}
                <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2 mland:p-1.5 shadow-xs flex flex-col justify-between gap-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] mland:text-[8.5px] font-bold text-[var(--mut)]">📈 ผลงานซีซั่นนี้</span>
                    <span className="text-[10px] mland:text-[8px] font-semibold text-[var(--mut)] tabular">
                      {livePlayer.sp || 0} นัด
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-center">
                    <div className="rounded-lg bg-[var(--surface-2)]/80 px-1.5 py-0.5 flex items-center justify-center gap-1">
                      <span className="text-[10px] mland:text-[8px] text-[var(--mut)]">ประตู</span>
                      <span className="font-extrabold text-xs sm:text-sm mland:text-[10.5px] tabular">{livePlayer.sg || 0}</span>
                      {(livePlayer.sg || 0) > 0 && <StatIconBadge kind="goal" count={1} size="xs" />}
                    </div>
                    <div className="rounded-lg bg-[var(--surface-2)]/80 px-1.5 py-0.5 flex items-center justify-center gap-1">
                      <span className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                        {livePlayer.pos === 'GK' ? 'คลีนชีต' : 'แอสซิสต์'}
                      </span>
                      <span className="font-extrabold text-xs sm:text-sm mland:text-[10.5px] tabular">
                        {livePlayer.pos === 'GK' ? livePlayer.cs || 0 : livePlayer.sa || 0}
                      </span>
                      {(livePlayer.pos === 'GK' ? (livePlayer.cs || 0) > 0 : (livePlayer.sa || 0) > 0) && (
                        <StatIconBadge kind={livePlayer.pos === 'GK' ? 'save' : 'assist'} count={1} size="xs" />
                      )}
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

              {/* Section Header: Sub-Attributes Cards */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-0.5">
                <span className="text-xs mland:text-[10px] font-bold text-[var(--ink)]">
                  รายละเอียดค่าพลังเฉพาะทาง (เต็ม 100)
                </span>
                <span className="text-[11px] mland:text-[9px] font-bold text-[var(--g)] truncate">
                  ⭐ จุดเด่น: {sigLabel} · {info.TR[1]}
                </span>
              </div>

              {/* Balanced Fit-to-Screen Attribute Card Grid */}
              {info.G.length === 5 ? (
                <div className="flex flex-col gap-2 mland:gap-1.5 min-h-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
                    {info.G.slice(0, 2).map(([grp, rows]) => (
                      <div
                        key={grp}
                        className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                      >
                        <div className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)] pb-1 mb-1 border-b border-[var(--line)]/70">
                          {grp}
                        </div>
                        <div className="space-y-0.5">
                          {rows.map(([lbl, val, statKey]) => (
                            <StatBarRow
                              key={lbl}
                              label={lbl}
                              value={val}
                              isSig={!!(statKey && statKey === info.D0.sig)}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-2 mland:gap-1.5">
                    {info.G.slice(2).map(([grp, rows]) => (
                      <div
                        key={grp}
                        className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                      >
                        <div className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)] pb-1 mb-1 border-b border-[var(--line)]/70">
                          {grp}
                        </div>
                        <div className="space-y-0.5">
                          {rows.map(([lbl, val, statKey]) => (
                            <StatBarRow
                              key={lbl}
                              label={lbl}
                              value={val}
                              isSig={!!(statKey && statKey === info.D0.sig)}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
                  {info.G.map(([grp, rows]) => (
                    <div
                      key={grp}
                      className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                    >
                      <div className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)] pb-1 mb-1 border-b border-[var(--line)]/70">
                        {grp}
                      </div>
                      <div className="space-y-0.5">
                        {rows.map(([lbl, val, statKey]) => (
                          <StatBarRow
                            key={lbl}
                            label={lbl}
                            value={val}
                            isSig={!!(statKey && statKey === info.D0.sig)}
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
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-4xl mland:max-w-[96vw] h-[90dvh] mland:h-[96dvh] max-h-[94dvh] mland:max-h-[96dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 p-3.5 sm:p-4 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2.5 mland:gap-1.5">
          <div className="flex items-center gap-3 mland:gap-2 min-w-0">
            <div className="shrink-0 mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <ClubCrest name={team.name} size={40} team={team} club={state.club} isMyClub={isMeTeam && state.mode === 'm'} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-lg mland:text-xs truncate flex items-center gap-1.5">
                <span>{team.name}</span>
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
              <div className="text-xs mland:text-[9.5px] text-[var(--mut)] flex flex-wrap items-center gap-x-2">
                <span>{TN[team.tier] || 'สโมสรทวีป'}</span>
                {rank ? <span>· อันดับ <b className="text-[var(--ink)] tabular">{rank}</b> ({team.pts} แต้ม)</span> : null}
                <span className="tabular">· ช{team.w} ส{team.d} พ{team.l} ({gd >= 0 ? `+${gd}` : gd})</span>
                <span className="tabular">· อายุเฉลี่ย {st.age} ปี</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {formChars.length > 0 && (
              <div className="flex items-center gap-0.5">
                {formChars.map((c, idx) => (
                  <span
                    key={idx}
                    className={`w-5 h-5 mland:w-4 mland:h-4 rounded-md text-[10px] mland:text-[8.5px] font-bold flex items-center justify-center text-white ${
                      c === 'W' ? 'bg-[var(--g)]' : c === 'L' ? 'bg-[var(--red)]' : 'bg-amber-500'
                    }`}
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
            <button type="button" onClick={onClose} className="px-3 mland:px-2 py-1.5 mland:py-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] font-bold cursor-pointer">ปิด ✕</button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-3 mland:p-2 space-y-2.5 mland:space-y-1 flex flex-col">
          {/* Team Power + Head-to-Head + Tactical Identity */}
          <div className="grid grid-cols-4 gap-2 mland:gap-1 text-center text-xs mland:text-[10px] shrink-0">
            {(
              [
                ['ตัวจริง (XI)', st.ovXi, mySt.ovXi],
                ['เฉลี่ยทีม', st.ovSq, mySt.ovSq],
                ['เกมรุก', st.at, mySt.at],
                ['เกมรับ', st.df, mySt.df]
              ] as const
            ).map(([lbl, val, myVal]) => {
              const diff = val - myVal;
              return (
                <div key={lbl} className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]">
                  <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] leading-tight">{lbl}</div>
                  <div className="font-bold text-base mland:text-xs tabular leading-tight">
                    {val}
                    {!isMeTeam && (
                      <span className={`ml-1 text-[11px] mland:text-[9px] ${diff > 0 ? 'text-[var(--red)]' : diff < 0 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                        ({diff > 0 ? `+${diff}` : diff})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-4 gap-2 mland:gap-1 text-xs mland:text-[10px] shrink-0">
            <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">ระบบ &amp; แท็กติก</div>
              <div className="font-bold truncate mt-0.5">{team.form} · {AR_T[team.tac]}</div>
            </div>
            <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">⚽ ดาวซัลโว</div>
              <div className="font-bold truncate mt-0.5">{topScorer ? `${topScorer.n.split(' ')[0]} (${topScorer.sg || 0})` : '-'}</div>
            </div>
            <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">🎯 จอมแอสซิสต์</div>
              <div className="font-bold truncate mt-0.5">{topAssist ? `${topAssist.n.split(' ')[0]} (${topAssist.sa || 0})` : '-'}</div>
            </div>
            <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">💰 มูลค่ารวม</div>
              <div className="font-bold tabular mt-0.5">{fmtMoney(totalVal)}</div>
            </div>
          </div>

          <div className="grid grid-cols-[1.08fr_0.92fr] mland:grid-cols-[1.15fr_0.85fr] gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
            <div className="space-y-1 mland:space-y-0.5 h-full flex flex-col items-center min-h-0 overflow-hidden">
              <div className="text-xs mland:text-[9px] font-bold text-[var(--mut)] text-center shrink-0">ผัง 11 ตัวจริง · แตะเพื่อส่องพลัง</div>
              <div className="w-full flex-1 min-h-0 h-full flex items-center justify-center mx-auto">
                <FormationPitch
                  team={team}
                  state={state}
                  onPlayerPointerDown={(e, q) => {
                    e.stopPropagation();
                    SFX.tap();
                    onInspectPlayer(q, team);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 mland:space-y-1 h-full flex flex-col min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-1.5 shrink-0">
                <div className="font-bold text-xs mland:text-[10px] text-[var(--mut)]">ขุมกำลัง ({team.sq.length} คน)</div>
                <div className="flex flex-wrap gap-1">
                  {(['ALL', 'XI', 'FW', 'MF', 'DF', 'GK'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPosFilter(f)}
                      className={`px-2 mland:px-1.5 py-0.5 rounded-lg text-[11px] mland:text-[9px] font-semibold cursor-pointer ${posFilter === f ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}
                    >
                      {f === 'ALL' ? 'ทั้งหมด' : f === 'XI' ? 'ตัวจริง' : f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-[var(--line)]/60 flex-1 min-h-0 overflow-y-auto rounded-xl border border-[var(--line)]">
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
                      className={`w-full flex items-center justify-between gap-2 px-3 mland:px-2 py-2 mland:py-0.5 hover:bg-[var(--surface-2)] text-left text-xs mland:text-[10.5px] cursor-pointer ${isMe ? 'bg-[var(--lamp-soft)]/50' : ''}`}
                    >
                      <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                        <div className="shrink-0 mland:[&_svg]:w-5 mland:[&_svg]:h-5">
                          <PlayerFace player={q} team={team} state={state} careerProfile={isMe ? state.p : null} size={28} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate flex items-center gap-1">
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
                          <div className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate flex items-center gap-1">
                            <span>{q.ro} · อายุ {q.age} ·</span>
                            <span className="inline-flex items-center gap-0.5 tabular">
                              <StatIconBadge kind="goal" count={Math.max(1, q.sg || 0)} size="xs" />
                              {(q.sg || 0) <= 1 && <span>{q.sg || 0}</span>}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5 tabular">
                              <StatIconBadge kind="assist" count={Math.max(1, q.sa || 0)} size="xs" />
                              {(q.sa || 0) <= 1 && <span>{q.sa || 0}</span>}
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
                          <span className="text-[9.5px] mland:text-[8px] font-extrabold tabular leading-none" style={{ color: fCol }}>⚡{f}%</span>
                          <div className="w-full h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${clamp(f, 4, 100)}%`, background: fCol }} />
                          </div>
                        </div>
                        <span className="px-2 mland:px-1.5 py-0.5 rounded-lg text-white font-bold tabular shrink-0 mland:text-[10px]" style={{ background: ovColor(q.ov) }}>{q.ov}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-t border-[var(--line)] flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer">
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};

