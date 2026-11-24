import React, { useMemo, useState } from 'react';
import type { Position, Player, Team, GameState } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { TN, ATT, SPN, SIGL, AR_T } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, xi, dtInfo, vlu, wagOf, ensureCon, logFin } from '../engine/playerCore';
import { ovColor, statBarColor, countReadyMissions } from '../engine/missions';
import { sortTable, teamStats } from '../engine/simulation';
import { ClubCrest, PlayerFace, FormationPitch } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { PlayerBlessingEditor } from '../components/PlayerBlessingEditor';

export const PlayerInspectorModal: React.FC<{
  player: Player;
  team: Team | null;
  state: GameState;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
  godBlessingEnabled?: boolean;
}> = ({ player, team, state, onClose, onUpdateState, onToast, godBlessingEnabled = true }) => {
  const liveTeam = team ? state.teams[team.id] || team : null;
  const livePlayer = liveTeam
    ? liveTeam.sq.find((q) => q.n === player.n) || player
    : state.mk.find((q) => q.n === player.n) || state.yth.find((q) => q.n === player.n) || player;
  const isMyTeam = !!liveTeam && liveTeam.id === state.me;
  const isMePlayer = !!livePlayer.me || (state.mode === 'p' && state.p?.name === livePlayer.n);
  const currentNo = liveTeam ? getShirtNo(liveTeam, livePlayer) : livePlayer.no || 10;
  const info = dtInfo(livePlayer, isMePlayer ? state.p : null);
  const [shirtNo, setShirtNo] = useState(String(currentNo));
  const [inspectMode, setInspectMode] = useState<'info' | 'missions' | 'blessing'>('info');
  const effectiveMode = inspectMode === 'blessing' && !godBlessingEnabled ? 'info' : inspectMode;
  const canDoMissions = isMyTeam || isMePlayer;
  const readyMissionCnt = canDoMissions ? countReadyMissions(livePlayer, isMePlayer ? state.p : null) : 0;
  const isCap = !!liveTeam && liveTeam.cap === livePlayer.n;
  const con = liveTeam ? ensureCon(livePlayer) : null;
  const sigLabel = SIGL[info.D0.sig] || info.D0.sig;
  const fitVal = Math.round(livePlayer.fit ?? 100);
  const fitCol = livePlayer.inj > 0 || (livePlayer.sus || 0) > 0 ? 'var(--red)' : fitVal >= 75 ? 'var(--g)' : fitVal >= 55 ? '#c98a00' : 'var(--red)';
  const topCoreVal = Math.max(...ATT.map(([k]) => info.a[k]));
  const statusBadgeText =
    (livePlayer.sus || 0) > 0
      ? `ติดโทษแบน ${livePlayer.sus} นัด`
      : livePlayer.inj > 0
        ? `บาดเจ็บพัก ${livePlayer.inj} นัด`
        : fitVal < 60
          ? 'ร่างกายอ่อนล้า'
          : 'พร้อมลงสนาม';

  return (
    <div className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-3xl mland:max-w-[96vw] max-h-[92dvh] mland:h-[96dvh] mland:max-h-[96dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Hero Identity Header */}
        <div
          className="shrink-0 px-4 py-3.5 sm:px-5 sm:py-4 mland:px-3 mland:py-2 text-white flex items-center justify-between gap-3 mland:gap-2"
          style={{ background: `linear-gradient(135deg, ${ovColor(livePlayer.ov)}, #0b1f15 80%)` }}
        >
          <div className="flex items-center gap-3 mland:gap-2.5 min-w-0">
            <div className="relative shrink-0 p-1 rounded-2xl mland:rounded-xl bg-black/20 border border-white/15 mland:[&_svg]:w-11 mland:[&_svg]:h-11">
              <PlayerFace
                player={{ ...livePlayer, no: currentNo }}
                team={liveTeam}
                state={state}
                careerProfile={isMePlayer ? state.p : null}
                size={60}
                bare
              />
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-md bg-black/75 border border-white/25 text-[10px] mland:text-[8.5px] font-extrabold tabular leading-tight">
                #{currentNo}
              </span>
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <h3 className="font-bold text-base sm:text-xl mland:text-sm font-display truncate leading-tight">
                  {livePlayer.n}
                </h3>
                {isMePlayer && (
                  <span className="px-1.5 py-0.5 rounded bg-[var(--lamp)] text-[#261900] text-[10px] mland:text-[8.5px] font-extrabold shrink-0">
                    ฉัน
                  </span>
                )}
                {livePlayer.blessed && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-300 text-[#261900] text-[10px] mland:text-[8.5px] font-extrabold shrink-0">
                    ✨ พร
                  </span>
                )}
                {isCap && (
                  <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] mland:text-[8.5px] font-bold shrink-0">
                    © กัปตัน
                  </span>
                )}
              </div>

              <div className="text-xs mland:text-[10px] text-white/90 flex items-center gap-1.5 flex-wrap">
                {liveTeam && (
                  <ClubCrest
                    name={liveTeam.name}
                    size={15}
                    team={liveTeam}
                    club={state.club}
                    isMyClub={isMyTeam && state.mode === 'm'}
                  />
                )}
                <span className="font-semibold truncate max-w-[160px] sm:max-w-none">
                  {liveTeam ? liveTeam.name : livePlayer.free ? 'ฟรีเอเยนต์' : 'ตลาดซื้อขาย'}
                </span>
                <span className="opacity-55" aria-hidden="true">·</span>
                <span className="font-bold text-[var(--lamp)]">{livePlayer.ro}</span>
                <span className="text-white/80">({SPN[livePlayer.ro] || livePlayer.pos})</span>
              </div>

              <div className="text-[11px] mland:text-[9px] text-white/80 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="tabular">อายุ {livePlayer.age} ปี ({info.gro})</span>
                <span className="opacity-50" aria-hidden="true">·</span>
                <span>{info.TR[0]}</span>
                {((livePlayer.yc || 0) > 0 || (livePlayer.rc || 0) > 0) && (
                  <>
                    <span className="opacity-50" aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular">
                      {(livePlayer.yc || 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <StatIconBadge kind="yellow" count={livePlayer.yc || 1} size="xs" />
                          <span>{livePlayer.yc}/3</span>
                        </span>
                      )}
                      {(livePlayer.rc || 0) > 0 && (
                        <StatIconBadge kind="red" count={livePlayer.rc || 1} size="xs" />
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 mland:gap-2 shrink-0">
            <div className="px-3 py-1.5 mland:px-2 mland:py-1 rounded-2xl mland:rounded-xl bg-black/25 border border-white/20 text-center min-w-[60px] mland:min-w-[46px]">
              <div className="text-2xl sm:text-3xl mland:text-lg font-extrabold font-display leading-none tabular">
                {livePlayer.ov}
              </div>
              <div className="text-[9.5px] mland:text-[8px] font-bold tracking-wide text-white/75 mt-0.5 tabular">
                OVR · POT {livePlayer.pot}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="w-9 h-9 mland:w-7 mland:h-7 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-sm mland:text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Clean Segmented Sub-navigation */}
        {(canDoMissions || godBlessingEnabled) && (
          <div className="shrink-0 px-4 py-2 mland:px-3 mland:py-1 bg-[var(--surface-2)]/70 border-b border-[var(--line)] flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { SFX.tap(); setInspectMode('info'); }}
              className={`flex-1 sm:flex-initial px-3.5 mland:px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                effectiveMode === 'info'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs border border-[var(--line)]'
                  : 'text-[var(--mut)] hover:text-[var(--ink)]'
              }`}
            >
              📊 ข้อมูล &amp; ค่าพลัง
            </button>
            {canDoMissions && (
              <button
                type="button"
                onClick={() => { SFX.tap(); setInspectMode('missions'); }}
                className={`flex-1 sm:flex-initial px-3.5 mland:px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  effectiveMode === 'missions'
                    ? 'bg-[var(--g)] text-white shadow-xs'
                    : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                🎯 ภารกิจ{readyMissionCnt ? ` (${readyMissionCnt})` : ''}
              </button>
            )}
            {godBlessingEnabled && (
              <button
                type="button"
                onClick={() => { SFX.tap(); setInspectMode('blessing'); }}
                className={`flex-1 sm:flex-initial px-3.5 mland:px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                  effectiveMode === 'blessing'
                    ? 'bg-gradient-to-b from-[#fad05a] to-[#eab308] text-[#261900] shadow-xs'
                    : 'text-[#8a5b00] dark:text-[var(--lamp)] hover:bg-[var(--lamp-soft)]'
                }`}
              >
                ✨ พรของพระเจ้า
              </button>
            )}
          </div>
        )}

        {effectiveMode === 'blessing' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2">
            <PlayerBlessingEditor
              player={livePlayer}
              team={liveTeam}
              state={state}
              onUpdateState={onUpdateState}
              onToast={onToast}
              onSaved={() => setInspectMode('info')}
            />
          </div>
        ) : effectiveMode === 'missions' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2">
            <PlayerMissionsPanel
              player={livePlayer}
              team={liveTeam}
              state={state}
              onUpdateState={onUpdateState}
              onToast={onToast}
            />
          </div>
        ) : (
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden mland:overflow-hidden p-3.5 sm:p-4 mland:p-2 space-y-3 md:space-y-0 mland:space-y-0 md:grid md:grid-cols-[0.95fr_1.05fr] mland:grid mland:grid-cols-[0.95fr_1.05fr] md:gap-4 mland:gap-2">
          {/* Left Column: Core 5, Contract/Status, Season Stats, Rehab & Number */}
          <div className="space-y-3 mland:space-y-1.5 md:h-full md:overflow-y-auto mland:h-full mland:overflow-y-auto md:pr-1 mland:pr-1">
            {/* 5 Core Attributes Showcase */}
            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/80 space-y-2 mland:space-y-1">
              <div className="flex items-center justify-between text-[11px] mland:text-[9.5px]">
                <span className="font-bold text-[var(--ink)]">ค่าพลังหลัก 5 ด้าน</span>
                <span className="font-bold text-[var(--g)] truncate">⭐ จุดเด่น: {sigLabel}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 mland:gap-1">
                {ATT.map(([k, l]) => {
                  const val = info.a[k];
                  const isTop = val === topCoreVal;
                  return (
                    <div
                      key={k}
                      className={`p-2 mland:p-1 rounded-xl mland:rounded-lg text-center border ${
                        isTop
                          ? 'bg-[var(--surface)] border-[var(--g)]/45 shadow-2xs'
                          : 'bg-[var(--surface)]/80 border-[var(--line)]/60'
                      }`}
                    >
                      <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] font-medium truncate">{l}</div>
                      <div className="text-lg mland:text-xs font-extrabold tabular leading-tight my-0.5" style={{ color: statBarColor(val) }}>
                        {val}
                      </div>
                      <div className="h-1.5 mland:h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(8, Math.min(100, val))}%`, background: statBarColor(val) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Profile, Contract & Readiness Card */}
            <div className="rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)]/80 divide-y divide-[var(--line)]/60">
              <div className="grid grid-cols-2 divide-x divide-[var(--line)]/60">
                <div className="p-2.5 sm:p-3 mland:p-1.5">
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">ค่าตัวประเมิน</div>
                  <div className="font-extrabold text-sm mland:text-xs text-[var(--g)] tabular mt-0.5">{fmtMoney(vlu(livePlayer))}</div>
                </div>
                <div className="p-2.5 sm:p-3 mland:p-1.5">
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">สัญญา &amp; ค่าเหนื่อย</div>
                  <div className="font-bold text-xs sm:text-sm mland:text-[10.5px] text-[var(--ink)] tabular mt-0.5 truncate">
                    {con ? `${con.yr} ปี · ${fmtMoneyNum(con.wg)}/นัด` : `${fmtMoneyNum(wagOf(livePlayer))}/นัด`}
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 mland:p-1.5 space-y-1.5 mland:space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs mland:text-[10px]">
                  <span className="text-[var(--mut)] font-medium">สภาพร่างกาย · <b className="text-[var(--ink)]">{statusBadgeText}</b></span>
                  <span className="font-extrabold tabular" style={{ color: fitCol }}>⚡ {fitVal}%</span>
                </div>
                <div className="h-2 mland:h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${clamp(fitVal, 4, 100)}%`, background: fitCol }} />
                </div>
              </div>

              <div className="px-3 py-2 mland:px-2 mland:py-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] mland:text-[9.5px]">
                <span className="text-[var(--mut)]">นิสัย/สไตล์: <b className="text-[var(--ink)] font-semibold">{info.TR[0]} · {info.TR[1]}</b></span>
              </div>
            </div>

            {/* Season Performance Strip */}
            <div className="rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)]/80 grid grid-cols-4 divide-x divide-[var(--line)]/60 text-center">
              <div className="p-2.5 mland:p-1.5">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">ลงเล่น</div>
                <div className="font-extrabold text-sm mland:text-xs tabular mt-0.5">{livePlayer.sp || 0} <span className="text-[10px] font-normal text-[var(--mut)]">นัด</span></div>
              </div>
              <div className="p-2.5 mland:p-1.5">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">ประตู</div>
                <div className="font-extrabold text-sm mland:text-xs tabular mt-0.5 inline-flex items-center justify-center gap-1">
                  <span>{livePlayer.sg || 0}</span>
                  {(livePlayer.sg || 0) > 0 && <StatIconBadge kind="goal" count={1} size="xs" />}
                </div>
              </div>
              <div className="p-2.5 mland:p-1.5">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">แอสซิสต์</div>
                <div className="font-extrabold text-sm mland:text-xs tabular mt-0.5 inline-flex items-center justify-center gap-1">
                  <span>{livePlayer.sa || 0}</span>
                  {(livePlayer.sa || 0) > 0 && <StatIconBadge kind="assist" count={1} size="xs" />}
                </div>
              </div>
              <div className="p-2.5 mland:p-1.5">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">{livePlayer.pos === 'GK' ? 'คลีนชีต' : 'เหลือง/แดง'}</div>
                {livePlayer.pos === 'GK' ? (
                  <div className="font-extrabold text-sm mland:text-xs tabular mt-0.5 inline-flex items-center justify-center gap-1">
                    <span>{livePlayer.cs || 0}</span>
                    {(livePlayer.cs || 0) > 0 && <StatIconBadge kind="save" count={1} size="xs" />}
                  </div>
                ) : (
                  <div className="font-bold text-xs mland:text-[10px] tabular mt-1 mland:mt-0.5 inline-flex items-center justify-center gap-1.5">
                    <span className={(livePlayer.yc || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--mut)]'}>🟨{livePlayer.yc || 0}</span>
                    <span className={(livePlayer.rc || 0) > 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}>🟥{livePlayer.rc || 0}</span>
                  </div>
                )}
              </div>
            </div>

            {livePlayer.inj > 0 && (() => {
              const curTurn = state.season * 40 + state.md;
              const medLv = state.med ?? 1;
              const physioLv = state.staff?.physio ?? 0;
              const treatCost = Math.max(6, 14 - medLv * 2 - physioLv * 2);
              const alreadyTreated = livePlayer.treatedMd === curTurn;
              return (
                <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/40 space-y-2 mland:space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">
                      🩹 ศูนย์ฟื้นฟูอาการบาดเจ็บ (พักอีก {livePlayer.inj} นัด)
                    </span>
                    <span className="text-[10px] mland:text-[9px] font-bold text-[var(--mut)]">
                      🏥 Lv.{medLv}
                    </span>
                  </div>
                  <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] leading-snug">
                    พักฟื้นอัตโนมัติ -1 นัดหลังจบเกม (-2 นัดหากศูนย์แพทย์ Lv.3+ หรือมีนักกายภาพ Lv.2+)
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
                      className="w-full py-2 mland:py-1 rounded-xl bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer disabled:opacity-45"
                    >
                      {alreadyTreated
                        ? '✅ ทำกายภาพรอบนี้ไปแล้ว (รอหลังจบนัดถัดไป)'
                        : `💉 ทำกายภาพบำบัดเร่งด่วน (-1 นัด · +10% ฟิต · ${fmtMoney(treatCost)})`}
                    </button>
                  )}
                </div>
              );
            })()}

            {isMyTeam && state.mode === 'm' && (
              <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs mland:text-[10px] font-semibold text-[var(--mut)]">เบอร์เสื้อ</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={shirtNo}
                    onChange={(e) => setShirtNo(e.target.value)}
                    className="w-14 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold text-center tabular"
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
                    className="px-3 py-1 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer"
                  >
                    บันทึก
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateState((d) => {
                      d.teams[d.me].cap = livePlayer.n;
                    });
                    onToast(`แต่งตั้ง ${livePlayer.n} เป็นกัปตันทีม`);
                  }}
                  className={`px-3 py-1.5 mland:py-1 rounded-xl text-xs mland:text-[10px] font-bold cursor-pointer ${
                    isCap ? 'bg-[var(--lamp)] text-[#261900]' : 'bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)]'
                  }`}
                >
                  {isCap ? '© กัปตันทีมปัจจุบัน' : 'ตั้งเป็นกัปตัน'}
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Detailed Sub-Attributes Breakdown */}
          <div className="md:h-full md:overflow-y-auto mland:h-full mland:overflow-y-auto md:pr-1 mland:pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2.5 mland:gap-1.5">
              {info.G.map(([grp, rows]) => (
                <div key={grp} className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)]/75 space-y-1">
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)] pb-1.5 mland:pb-1 mb-1 border-b border-[var(--line)]/70">
                    {grp}
                  </div>
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
      <div className="w-full max-w-3xl mland:max-w-[96vw] max-h-[92dvh] mland:h-[96dvh] mland:max-h-[96dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 p-3.5 sm:p-4 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2.5 mland:gap-1.5">
          <div className="flex items-center gap-3 mland:gap-2 min-w-0">
            <div className="shrink-0 mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <ClubCrest name={team.name} size={40} team={team} club={state.club} isMyClub={isMeTeam && state.mode === 'm'} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-lg mland:text-xs truncate flex items-center gap-1.5">
                <span>{team.name}</span>
                {isMeTeam && <span className="px-1.5 py-0.5 rounded bg-[var(--lamp)] text-[#261900] text-[10px] mland:text-[8.5px] font-extrabold shrink-0">ทีมฉัน</span>}
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

        <div className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden p-3.5 sm:p-4 mland:p-2 space-y-3 mland:space-y-1 mland:flex mland:flex-col">
          {/* Team Power + Head-to-Head + Tactical Identity */}
          <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-4 gap-2 mland:gap-1 text-center text-xs mland:text-[10px] shrink-0">
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

          <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-4 gap-2 mland:gap-1 text-xs mland:text-[10px] shrink-0">
            <div className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">ระบบ &amp; แท็กติก</div>
              <div className="font-bold truncate mt-0.5">{team.form} · {AR_T[team.tac]}</div>
            </div>
            <div className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">⚽ ดาวซัลโว</div>
              <div className="font-bold truncate mt-0.5">{topScorer ? `${topScorer.n.split(' ')[0]} (${topScorer.sg || 0})` : '-'}</div>
            </div>
            <div className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">🎯 จอมแอสซิสต์</div>
              <div className="font-bold truncate mt-0.5">{topAssist ? `${topAssist.n.split(' ')[0]} (${topAssist.sa || 0})` : '-'}</div>
            </div>
            <div className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">💰 มูลค่ารวม</div>
              <div className="font-bold tabular mt-0.5">{fmtMoney(totalVal)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] mland:grid-cols-[1.15fr_0.85fr] gap-4 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
            <div className="space-y-1.5 mland:space-y-0.5 mland:h-full mland:flex mland:flex-col mland:items-center mland:min-h-0 mland:overflow-hidden">
              <div className="text-xs mland:text-[9px] font-bold text-[var(--mut)] text-center shrink-0">ผัง 11 ตัวจริง · แตะเพื่อส่องพลัง</div>
              <div className="max-w-[330px] mland:max-w-none mland:w-full mland:flex-1 mland:min-h-0 mland:h-full mland:flex mland:items-center mland:justify-center mx-auto">
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

            <div className="space-y-2 mland:space-y-1 mland:h-full mland:flex mland:flex-col mland:min-h-0 mland:overflow-hidden">
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
              <div className="divide-y divide-[var(--line)]/60 max-h-72 mland:max-h-none mland:flex-1 mland:min-h-0 overflow-y-auto rounded-xl border border-[var(--line)]">
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
                            {isMe && <span className="px-1 rounded bg-[var(--lamp)] text-[#261900] text-[9px] font-extrabold shrink-0">ฉัน</span>}
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

