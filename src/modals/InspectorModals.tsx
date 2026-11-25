import React, { useMemo, useState } from 'react';
import type { Position, Player, Team, GameState } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { TN, SPN, AR_T } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, xi, getFormationSlots, dtInfo, summarizeStatGroups, getPlayerBio, vlu, wagOf, ensureCon, logFin, tc } from '../engine/playerCore';
import { ovColor, statBarColor, statTierMeta, getPlayerTalent } from '../engine/missions';
import { sortTable, teamStats, ensureTeamFans, fmtFans } from '../engine/simulation';
import { ClubCrest, PlayerFace, FormationPitch } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { PlayerHistoryPanel } from '../components/PlayerHistoryPanel';
import { ClubHistoryPanel } from '../components/ClubHistoryPanel';
import { PlayerSeasonProgressionCard } from '../components/PlayerSeasonProgressionCard';
import { PlayerTraitsStrip } from '../components/PlayerTraitsStrip';
import { PlayerBioStrip } from '../components/PlayerBioStrip';
import { ShirtNumberLockerModal } from '../components/ShirtNumberLockerModal';
import { AthleteCard } from '../components/AthleteCard';

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
  const [showLockerPicker, setShowLockerPicker] = useState(false);
  const [inspectMode, setInspectMode] = useState<'info' | 'history' | 'missions'>('info');
  const isRetired = Boolean(livePlayer.retired);
  const effectiveMode = inspectMode === 'missions' && (isRetired || !(isMyTeam || isMePlayer)) ? 'info' : inspectMode;
  const canDoMissions = !isRetired && (isMyTeam || isMePlayer);
  const canEditShirtNo = !isRetired && Boolean(liveTeam && isMyTeam && (state.mode === 'm' || isMePlayer));
  const playerTalent = getPlayerTalent(livePlayer, isMePlayer ? state.p : null);
  const isCap = !isRetired && !!liveTeam && liveTeam.cap === livePlayer.n;
  const con = !isRetired && liveTeam ? ensureCon(livePlayer) : null;
  const fitVal = Math.round(livePlayer.fit ?? 100);
  const fitCol = isRetired
    ? '#d97706'
    : livePlayer.inj > 0 || (livePlayer.sus || 0) > 0
      ? 'var(--red)'
      : fitVal >= 75
        ? 'var(--g)'
        : fitVal >= 55
          ? '#c98a00'
          : 'var(--red)';
  const kit1 = liveTeam ? tc(liveTeam, state, false) : isMePlayer && state.p ? state.p.c : ovColor(livePlayer.ov);
  const kit2 = liveTeam ? tc(liveTeam, state, true) : '#f5c242';
  const pitchStarters = liveTeam ? xi(liveTeam) : [];
  const pitchStarterIdx = liveTeam ? pitchStarters.findIndex((q) => q.n === livePlayer.n) : -1;
  const pitchSlotSp = pitchStarterIdx >= 0 && liveTeam ? getFormationSlots(liveTeam)[pitchStarterIdx]?.sp : null;
  const isPitchOrNaturalGK = pitchSlotSp ? pitchSlotSp === 'GK' : (livePlayer.pos === 'GK' || livePlayer.ro === 'GK');
  const statusBadgeText = isRetired
    ? livePlayer.retiredSeason
      ? `แขวนสตั๊ดแล้ว (จบ S${livePlayer.retiredSeason})`
      : 'แขวนสตั๊ดแล้ว'
    : (livePlayer.sus || 0) > 0
      ? `ติดโทษแบน ${livePlayer.sus} นัด`
      : livePlayer.inj > 0
        ? `บาดเจ็บพัก ${livePlayer.inj} นัด`
        : fitVal < 60
          ? 'ร่างกายอ่อนล้า'
          : 'พร้อมลงสนาม';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/72 flex items-center justify-center p-2 sm:p-4 mland:p-2 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl mland:max-w-[96vw] h-[min(calc(var(--app-dvh,1dvh)*94),740px)] mland:h-[calc(var(--app-dvh,1dvh)*95)] mland:max-h-[calc(var(--app-dvh,1dvh)*100-14px)] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
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
                  · {liveTeam ? liveTeam.name : isRetired ? 'ตำนานที่แขวนสตั๊ดแล้ว' : livePlayer.free ? 'ฟรีเอเยนต์' : livePlayer.customCreated ? 'นักเตะสร้างเอง' : 'ตลาดซื้อขาย'}
                </span>
              </div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate flex items-center gap-1.5">
                <span>
                  {SPN[livePlayer.ro] || livePlayer.pos}
                  {livePlayer.altRoles?.length ? ` (+${livePlayer.altRoles.join(', ')})` : ''}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold" style={{ color: fitCol }}>{statusBadgeText}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mland:gap-1.5 shrink-0">
            <div className="seg-bar">
              <button
                type="button"
                onClick={() => { SFX.tap(); setInspectMode('info'); }}
                className={`seg-btn ${
                  effectiveMode === 'info'
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                    : ''
                }`}
              >
                📊 การ์ด &amp; ค่าพลัง
              </button>
              <button
                type="button"
                onClick={() => { SFX.tap(); setInspectMode('history'); }}
                className={`seg-btn ${
                  effectiveMode === 'history'
                    ? 'seg-btn-active'
                    : ''
                }`}
              >
                📜 ประวัติผลงาน
              </button>
              {canDoMissions && (
                <button
                  type="button"
                  onClick={() => { SFX.tap(); setInspectMode('missions'); }}
                  className={`seg-btn ${
                    effectiveMode === 'missions'
                      ? 'seg-btn-active'
                      : ''
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
              className="btn-icon rounded-full"
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
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden mland:overflow-hidden p-3 sm:p-3.5 mland:p-2 grid grid-cols-1 md:grid-cols-[240px_1fr] md:grid-rows-[minmax(0,1fr)] mland:grid-cols-[214px_1fr] mland:grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-1.5">
            {/* Left Column: Athlete Portrait Card + Personal Info Box + Traits/Insights Below */}
            <div className="flex flex-col gap-1.5 mland:gap-1 min-h-0 md:h-full mland:h-full md:overflow-y-auto mland:overflow-y-auto pr-0.5 pb-2">
              {/* Signature Athlete Card */}
              <AthleteCard
                ov={livePlayer.ov}
                pot={livePlayer.pot}
                talent={playerTalent}
                roleLabel={livePlayer.ro}
                shirtNo={currentNo}
                kit1={kit1}
                kit2={kit2}
                faceProps={{
                  player: { ...livePlayer, no: currentNo },
                  team: liveTeam,
                  state,
                  isGK: isPitchOrNaturalGK,
                  careerProfile: isMePlayer ? state.p : null
                }}
                name={livePlayer.n}
                subtitle={`${
                  liveTeam
                    ? liveTeam.name
                    : isRetired
                      ? 'แขวนสตั๊ดแล้ว'
                      : livePlayer.free
                        ? 'ฟรีเอเยนต์'
                        : livePlayer.customCreated
                          ? 'นักเตะสร้างเอง'
                          : 'ตลาดซื้อขาย'
                } · อายุ ${livePlayer.age} ปี`}
                bio={info.bio}
                categories={summarizeStatGroups(info.G)}
                renderBadges={(palette) =>
                  isMePlayer || livePlayer.blessed || livePlayer.hg || livePlayer.customCreated || isCap ? (
                    <>
                      {isMePlayer && (
                        <span
                          title="ตัวคุณ"
                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8.5px] font-black"
                        >
                          ★
                        </span>
                      )}
                      {livePlayer.blessed && (
                        <span className="px-1 py-[1px] rounded bg-amber-300 text-[#261900] text-[8px] mland:text-[6.5px] font-extrabold leading-none">
                          ✨ พร
                        </span>
                      )}
                      {(livePlayer.hg || livePlayer.customCreated) && (
                        <span
                          className={`px-1 py-[1px] rounded text-[8px] mland:text-[6.5px] font-extrabold leading-none ${palette.hgBadge}`}
                        >
                          🌱 เด็กปั้น
                        </span>
                      )}
                      {isCap && (
                        <span
                          className={`px-1 py-[1px] rounded text-[8px] mland:text-[6.5px] font-bold leading-none ${palette.capBadge}`}
                        >
                          © กัปตัน
                        </span>
                      )}
                    </>
                  ) : null
                }
              />

              {/* Personal Info Box below Portrait Card (Unified with Career Mode) */}
              <div className="shrink-0 p-2 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-col gap-1.5 mland:gap-1">

                <div className="space-y-1 mland:space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] mland:text-[9px] font-bold">
                    <span>⚡ พลังกาย</span>
                    <span className={`tabular font-extrabold ${statTierMeta(fitVal).textClass}`}>
                      {fitVal}%
                    </span>
                  </div>
                  <div className="h-2 mland:h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div className="h-full rounded-full transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]" style={{ width: `${clamp(fitVal, 6, 100)}%`, background: statBarColor(fitVal) }} />
                  </div>
                </div>

                {(() => {
                  const curTurn = state.season * 40 + state.md;
                  const medLv = state.med ?? 1;
                  const physioLv = state.staff?.physio ?? 0;
                  const treatCost = Math.max(4, 14 - Math.floor(medLv * 1.1) - physioLv);
                  const alreadyTreated = livePlayer.treatedMd === curTurn;
                  return (
                    <div className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg border text-[10.5px] mland:text-[8.5px] space-y-1 ${isRetired ? 'bg-amber-500/10 border-amber-500/35' : livePlayer.inj > 0 || (livePlayer.sus || 0) > 0 ? 'bg-[var(--red-soft)] border-[var(--red)]/40' : fitVal < 60 ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45' : 'bg-[var(--g-soft)] border-[var(--g)]/35'}`}>
                      <div className="flex items-center justify-between font-bold gap-1">
                        <span className="truncate" style={{ color: fitCol }}>
                          {isRetired ? `👋 ${statusBadgeText}` : statusBadgeText}
                        </span>
                        <span className="tabular text-[9.5px] mland:text-[8px] text-[var(--mut)] shrink-0">
                          🟨{livePlayer.yc || 0}/3 · 🟥{livePlayer.rc || 0}
                        </span>
                      </div>
                      {!isRetired && livePlayer.inj > 0 && isMyTeam && state.mode === 'm' && (
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
                          className="w-full py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-[10px] mland:text-[8px] font-bold cursor-pointer disabled:opacity-45"
                        >
                          {alreadyTreated
                            ? '✅ ทำกายภาพรอบนี้แล้ว'
                            : `💉 กายภาพด่วน (-1 นัด · ${fmtMoney(treatCost)})`}
                        </button>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-4 gap-1 text-center">
                  <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
                    <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">👕 ลง</div>
                    <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none">{livePlayer.sp || 0}</div>
                  </div>
                  <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
                    <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">⚽ ยิง</div>
                    <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none">{livePlayer.sg || 0}</div>
                  </div>
                  <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
                    <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">{livePlayer.pos === 'GK' ? '🧤 คลีน' : '🎯 จ่าย'}</div>
                    <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none">{livePlayer.pos === 'GK' ? livePlayer.cs || 0 : livePlayer.sa || 0}</div>
                  </div>
                  <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
                    <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">⭐ เรต</div>
                    <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none text-[#8a5b00] dark:text-[#fde047]">
                      {(livePlayer.sra || 0) > 0
                        ? ((livePlayer.srs || 0) / Math.max(1, livePlayer.sra || 1)).toFixed(1)
                        : '-'}
                    </div>
                  </div>
                </div>

                <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)] flex items-center justify-between gap-1.5 text-[10px] mland:text-[8px]">
                  <span className="font-bold text-[var(--g)] tabular truncate">💎 {fmtMoney(vlu(livePlayer))}</span>
                  <span className="text-[var(--mut)] tabular shrink-0">
                    {con ? `${con.yr} ปี · ` : livePlayer.free ? 'ฟรี · ' : ''}
                    <b className="text-[var(--ink)]">{fmtMoneyNum(con ? con.wg : wagOf(livePlayer))}</b>/นัด
                  </span>
                </div>

                {canEditShirtNo && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--line)]/60">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setShowLockerPicker(true);
                      }}
                      className="btn btn-xs btn-secondary flex-1 justify-between gap-1"
                    >
                      <span>👕 เบอร์ #{currentNo}</span>
                      <span className="text-[var(--g)] font-extrabold">ล็อกเกอร์ ▾</span>
                    </button>
                    {state.mode === 'm' && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateState((d) => {
                            d.teams[d.me].cap = livePlayer.n;
                          });
                          onToast(`แต่งตั้ง ${livePlayer.n} เป็นกัปตันทีม`);
                        }}
                        className={`btn btn-xs shrink-0 ${
                          isCap
                            ? 'btn-gold'
                            : 'btn-secondary'
                        }`}
                      >
                        {isCap ? '© กัปตัน' : 'ตั้งกัปตัน'}
                      </button>
                    )}
                  </div>
                )}
                </div>

              {/* Personality, Style & Insights Strip below Athlete Card */}
              <PlayerTraitsStrip
                player={livePlayer}
                careerProfile={isMePlayer ? state.p : null}
                trPair={info.TR}
                traits={info.traits}
                talent={playerTalent}
                growthStage={info.gro}
                peakAge={info.D0.pk}
                sigKey={info.D0.sig}
                archName={isMePlayer ? state.p?.archName : undefined}
              />
            </div>

            {/* Right Column: Season Progression Graph -> Attribute Breakdown */}
            <div className="min-h-0 flex flex-col gap-1.5 mland:gap-1 md:h-full mland:h-full md:overflow-y-auto mland:overflow-y-auto pr-0.5 pb-2">
              <PlayerSeasonProgressionCard
                player={livePlayer}
                state={state}
                careerProfile={isMePlayer ? state.p : null}
                variant="inline"
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
                    <div className="font-bold text-[11px] mland:text-[9px] text-[var(--ink)] pb-0.5 mb-1 border-b border-[var(--line)]/70">
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
      {showLockerPicker && liveTeam && canEditShirtNo && (
        <ShirtNumberLockerModal
          player={livePlayer}
          team={liveTeam}
          state={state}
          onClose={() => setShowLockerPicker(false)}
          onUpdateState={onUpdateState}
          onToast={onToast}
        />
      )}
    </div>
  );
};

export const TeamInspectorModal: React.FC<{
  team: Team;
  state: GameState;
  onClose: () => void;
  onInspectPlayer: (p: Player, t: Team | null) => void;
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
      className="fixed inset-0 z-50 bg-black/72 flex items-center justify-center p-2 sm:p-4 mland:p-2 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl mland:max-w-[96vw] h-[min(calc(var(--app-dvh,1dvh)*92),720px)] mland:h-[calc(var(--app-dvh,1dvh)*95)] mland:max-h-[calc(var(--app-dvh,1dvh)*100-14px)] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
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
                <span className="hidden sm:inline mland:inline"> · แฟน {fmtFans(ensureTeamFans(team))} คน</span>
                <span className="hidden md:inline"> · อายุเฉลี่ย {st.age} ปี</span>
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
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden mland:overflow-hidden p-3 sm:p-3.5 mland:p-2 grid grid-cols-1 md:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] md:grid-rows-[minmax(0,1fr)] mland:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] mland:grid-rows-[minmax(0,1fr)] gap-3 mland:gap-2 items-stretch">
            {/* Left Column: Full-Height Formation Pitch */}
            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 mland:p-1.5 flex flex-col min-h-[340px] md:min-h-0 md:h-full mland:min-h-0 mland:h-full overflow-hidden shadow-xs">
              <div className="shrink-0 flex items-center justify-between gap-2 px-1 pb-1.5 mland:pb-1">
                <div className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate">
                  <b className="text-[var(--ink)]">ผัง 11 ตัวจริง</b> · แตะนักเตะเพื่อดูพลัง
                </div>
                <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--g)] tabular whitespace-nowrap shrink-0">
                  {team.form} · {AR_T[team.tac]}
                  {team.tacticTrialLabel && (state.md ?? 0) - (team.tacticTrialMd ?? -99) <= 4 ? ` · 🧪 ลองแผนใหม่` : ''}
                </span>
              </div>
              <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                <FormationPitch
                  team={team}
                  state={state}
                  className="aspect-[300/380] h-full max-h-full w-auto max-w-full mx-auto rounded-xl block select-none"
                  onPlayerPointerDown={(e, q) => {
                    e.stopPropagation();
                    SFX.tap();
                    onInspectPlayer(q, team);
                  }}
                />
              </div>
            </section>

            {/* Right Column: Compact Team Summary + Squad List */}
            <div className="flex flex-col min-h-0 md:h-full mland:h-full gap-2.5 mland:gap-1.5 md:overflow-hidden mland:overflow-hidden">
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
                    const qBio = getPlayerBio(q, isMe ? state.p : null);
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
                            <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1 mt-0.5 flex-wrap">
                              <span>{q.ro} · อายุ {q.age}</span>
                              <PlayerBioStrip bio={qBio} variant="inline" className="hidden sm:inline-flex" />
                              <span>·</span>
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

