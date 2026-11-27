import React, { useMemo, useState } from 'react';
import { Scissors, Star } from 'lucide-react';
import type { Position, Player, Team, GameState } from '../types/game';
import { fmtMoney } from '../utils/math';
import { TN, SPN, AR_T } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, xi, getFormationSlots, dtInfo, summarizeStatGroups, getPlayerBio, vlu, tc, teamKits, pickGK } from '../engine/playerCore';
import { ovColor, getPlayerTalent, getPlayerMissionView } from '../engine/missions';
import { sortTable, teamStats, getTeamSeasonObjectiveInfo, ensureTeamFans, fmtFans, isPlayerShortlisted, toggleShortlistPlayer } from '../engine/simulation';
import { ClubCrest, PlayerFace, FormationPitch } from '../components/SvgVisuals';
import { MatchPlayerThumb } from './MatchSharedComponents';
import { StatIconBadge } from '../components/StatIconBadge';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { PlayerHistoryPanel } from '../components/PlayerHistoryPanel';
import { ClubHistoryPanel } from '../components/ClubHistoryPanel';
import { PlayerSeasonProgressionCard } from '../components/PlayerSeasonProgressionCard';
import { PlayerTraitsStrip } from '../components/PlayerTraitsStrip';
import { PlayerBioStrip } from '../components/PlayerBioStrip';
import { PlayerCardOverviewBox } from '../components/PlayerCardOverviewBox';
import { ShirtNumberLockerModal } from '../components/ShirtNumberLockerModal';
import { PlayerAppearanceModal } from './PlayerAppearanceModal';
import { AthleteCard } from '../components/AthleteCard';
import { TalentBadge } from '../components/TalentBadge';
import { getStaminaMeta } from '../components/StaminaBar';
import { PlayerStatusBadge } from '../components/PlayerStatusBadge';
import { CaptainBadge } from '../components/CaptainBadge';
import { PositionBadge } from '../components/PositionBadge';
import { MyTeamBadge } from '../components/MyTeamBadge';
import { OvrBadge } from '../components/OvrBadge';
import { WdlFormStrip, WdlRecordBadges } from '../components/WdlBadge';
import { getActiveFavBoost } from '../engine/wellbeing';
import { PlayerWellbeingCard } from '../components/PlayerWellbeingCard';

export const PlayerInspectorModal: React.FC<{
  player: Player;
  team: Team | null;
  state: GameState;
  initialTab?: 'info' | 'history' | 'missions';
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ player, team, state, initialTab = 'info', onClose, onUpdateState, onToast }) => {
  const liveTeam = team ? state.teams[team.id] || team : null;
  const livePlayer = liveTeam
    ? liveTeam.sq.find((q) => q.n === player.n) || player
    : state.mk.find((q) => q.n === player.n) || state.yth.find((q) => q.n === player.n) || player;
  const isMyTeam = !!liveTeam && liveTeam.id === state.me;
  const isMePlayer = !!livePlayer.me || (state.mode === 'p' && state.p?.name === livePlayer.n);
  const currentNo = liveTeam ? getShirtNo(liveTeam, livePlayer) : livePlayer.no || 10;
  const info = dtInfo(livePlayer, isMePlayer ? state.p : null);
  const [showLockerPicker, setShowLockerPicker] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [inspectMode, setInspectMode] = useState<'info' | 'history' | 'missions'>(initialTab);
  const isRetired = Boolean(livePlayer.retired);
  const effectiveMode = inspectMode === 'missions' && isRetired ? 'info' : inspectMode;
  const canDoMissions = !isRetired;
  const canEditShirtNo = !isRetired && Boolean(liveTeam && isMyTeam && (state.mode === 'm' || isMePlayer));
  const playerTalent = getPlayerTalent(livePlayer, isMePlayer ? state.p : null);
  const isCap = !isRetired && !!liveTeam && liveTeam.cap === livePlayer.n;
  const isFav = !isRetired && !!liveTeam && liveTeam.favPlayer === livePlayer.n;
  const favBoost = !isRetired ? getActiveFavBoost(livePlayer, liveTeam, isMePlayer ? state.p : null) : 0;
  const staminaMeta = getStaminaMeta(livePlayer.fit);
  const fitVal = staminaMeta.f;
  const fitCol = isRetired
    ? '#d97706'
    : livePlayer.inj > 0 || (livePlayer.sus || 0) > 0
      ? 'var(--red)'
      : staminaMeta.barColor;
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
        : fitVal < 65
          ? 'ร่างกายอ่อนล้า'
          : 'พร้อมลงสนาม';

  return (
    <div className="fixed inset-0 z-[60] bg-black/72 flex items-center justify-center p-2 sm:p-4 mland:p-2 overflow-hidden">
      <div className="w-full max-w-5xl mland:max-w-[96vw] h-[min(calc(var(--app-dvh,1dvh)*94),740px)] mland:h-[calc(var(--app-dvh,1dvh)*95)] mland:max-h-[calc(var(--app-dvh,1dvh)*100-14px)] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
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
                <span title={livePlayer.altRoles?.length ? `ถนัดเพิ่ม: ${livePlayer.altRoles.join(', ')}` : undefined}>
                  {SPN[livePlayer.ro] || livePlayer.pos}
                  {livePlayer.altRoles?.length
                    ? livePlayer.altRoles.length > 4
                      ? ` (+${livePlayer.altRoles.slice(0, 4).join(', ')} +${livePlayer.altRoles.length - 4})`
                      : ` (+${livePlayer.altRoles.join(', ')})`
                    : ''}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold tabular" style={{ color: fitCol }}>
                  {statusBadgeText}
                  {!isRetired && ` · ⚡${fitVal}%`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 mland:gap-1 shrink-0">
            {state.mode === 'm' && !isMyTeam && !isRetired && (
              (() => {
                const shortlisted = isPlayerShortlisted(state, livePlayer.n, liveTeam?.id);
                const inferredSource: 'mk' | 'club' | 'scout' | 'created' = liveTeam
                  ? 'club'
                  : livePlayer.customCreated
                    ? 'created'
                    : state.scout?.results?.some((r) => r.n === livePlayer.n)
                      ? 'scout'
                      : 'mk';
                return (
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      let added = false;
                      onUpdateState((d) => {
                        added = toggleShortlistPlayer(d, livePlayer, {
                          source: inferredSource,
                          clubTeamId: liveTeam?.id,
                          clubName: liveTeam?.name
                        });
                      });
                      onToast(added ? `⭐ เพิ่ม ${livePlayer.n} เข้ารายชื่อที่สนใจแล้ว` : `นำ ${livePlayer.n} ออกจากรายชื่อที่สนใจแล้ว`);
                    }}
                    title={shortlisted ? 'นำออกจากรายชื่อที่สนใจ' : 'เพิ่มเข้ารายชื่อที่สนใจ'}
                    className={`h-8 mland:h-6.5 px-2.5 mland:px-2 inline-flex items-center gap-1 rounded-xl mland:rounded-lg border text-[11px] mland:text-[9.5px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      shortlisted
                        ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/55 text-[#8a5b00] dark:text-[var(--lamp)]'
                        : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 mland:w-3 mland:h-3 ${shortlisted ? 'fill-current' : ''}`} />
                    <span className="hidden sm:inline">{shortlisted ? 'สนใจอยู่' : 'ที่สนใจ'}</span>
                  </button>
                );
              })()
            )}
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
              readOnly={!isMyTeam && !isMePlayer}
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
                altRolesCount={livePlayer.altRoles?.length || 0}
                shirtNo={currentNo}
                onShirtClick={canEditShirtNo ? () => { SFX.tap(); setShowLockerPicker(true); } : undefined}
                shirtButtonTitle="เปิดล็อกเกอร์เปลี่ยน/สลับเบอร์เสื้อ"
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
                clubCrest={
                  liveTeam ? (
                    <ClubCrest
                      name={liveTeam.name}
                      size={14}
                      team={liveTeam}
                      club={state.club}
                      isMyClub={isMyTeam && state.mode === 'm'}
                    />
                  ) : undefined
                }
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
                renderStageTopLeft={(palette) =>
                  isMePlayer || livePlayer.blessed || livePlayer.hg || livePlayer.customCreated || isCap || isFav ? (
                    <div className="flex items-center gap-1 min-w-0">
                      {isMePlayer && (
                        <span
                          title="ตัวคุณ"
                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8.5px] font-black shrink-0"
                        >
                          ★
                        </span>
                      )}
                      {isFav && (
                        <span
                          title={favBoost > 0 ? `ลูกรัก (+${favBoost} OVR ชั่วคราว)` : 'ลูกรักประจำทีม'}
                          className={`px-1 py-[1px] rounded text-[8px] mland:text-[6.5px] font-black leading-none shrink-0 ${
                            favBoost > 0
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-rose-500/25 border border-rose-400/60 text-rose-100'
                          }`}
                        >
                          {favBoost > 0 ? `💖+${favBoost}` : '💖'}
                        </span>
                      )}
                      {livePlayer.blessed && (
                        <span
                          title="ผู้เล่นได้รับพร"
                          className="px-1 py-[1px] rounded bg-amber-300 text-[#261900] text-[8px] mland:text-[6.5px] font-extrabold leading-none shrink-0"
                        >
                          ✨
                        </span>
                      )}
                      {(livePlayer.hg || livePlayer.customCreated) && (
                        <span
                          title="เด็กปั้นสโมสร"
                          className={`px-1 py-[1px] rounded text-[8px] mland:text-[6.5px] font-extrabold leading-none shrink-0 ${palette.hgBadge}`}
                        >
                          🌱
                        </span>
                      )}
                      {isCap && (
                        <CaptainBadge team={liveTeam} state={state} size="sm" />
                      )}
                    </div>
                  ) : null
                }
                renderStageTopRight={
                  isMePlayer && state.mode === 'p' && !isRetired
                    ? (_palette, tone) => (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            SFX.tap();
                            setShowAppearanceModal(true);
                          }}
                          title="ปรับแต่งทรงผมและหน้าตา"
                          aria-label="ปรับแต่งทรงผมและหน้าตา"
                          className={`w-6 h-6 mland:w-5 mland:h-5 rounded-lg border flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                            tone === 'light'
                              ? 'bg-white/85 hover:bg-white border-slate-300/85 text-slate-700 hover:text-[var(--g)] shadow-2xs'
                              : 'bg-black/35 hover:bg-black/55 border-white/18 text-emerald-200 hover:text-white'
                          }`}
                        >
                          <Scissors className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
                        </button>
                      )
                    : undefined
                }
              />

              {/* Unified Personal Info Box below Portrait Card */}
              <PlayerCardOverviewBox
                player={livePlayer}
                state={state}
                team={liveTeam}
                careerProfile={isMePlayer ? state.p : null}
                isMePlayer={isMePlayer}
                isMyTeam={isMyTeam}
                isRetired={isRetired}
                onUpdateState={onUpdateState}
                onToast={onToast}
              />

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

            {/* Right Column: Wellbeing & Favorite Boost -> Season Progression Graph -> Attribute Breakdown */}
            <div className="min-h-0 flex flex-col gap-1.5 mland:gap-1 md:h-full mland:h-full md:overflow-y-auto mland:overflow-y-auto pr-0.5 pb-2">
              <PlayerWellbeingCard
                player={livePlayer}
                team={liveTeam}
                state={state}
                isMyTeam={isMyTeam}
                isMePlayer={isMePlayer}
                isRetired={isRetired}
                onUpdateState={onUpdateState}
                onToast={onToast}
                compact
              />

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
      {showAppearanceModal && isMePlayer && state.mode === 'p' && !isRetired && (
        <PlayerAppearanceModal
          state={state}
          onClose={() => setShowAppearanceModal(false)}
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
  onInspectPlayer: (p: Player, t: Team | null, initialTab?: 'info' | 'history' | 'missions') => void;
}> = ({ team, state, onClose, onInspectPlayer }) => {
  const [teamTab, setTeamTab] = useState<'squad' | 'missions' | 'history'>('squad');
  const [posFilter, setPosFilter] = useState<'ALL' | 'XI' | Position>('ALL');
  const st = teamStats(team, state);
  const myTeam = state.teams[state.me];
  const mySt = teamStats(myTeam, state);
  const isMeTeam = team.id === state.me;
  const isClubMeManager = isMeTeam && state.mode === 'm';
  const tierTable = sortTable(state.teams.filter((t) => t.tier === team.tier));
  const rank = team.tier < 3 ? tierTable.findIndex((t) => t.id === team.id) + 1 : null;
  const objInfo = team.tier < 3 ? getTeamSeasonObjectiveInfo(team, state) : null;
  const starters = xi(team);
  const starterNames = new Set(starters.map((q) => q.n));
  const topScorer = team.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0) || b.ov - a.ov)[0];
  const topAssist = team.sq.slice().sort((a, b) => (b.sa || 0) - (a.sa || 0) || b.ov - a.ov)[0];
  const totalVal = team.sq.reduce((s, q) => s + vlu(q), 0);
  const formChars = (team.fm || '').slice(-5).split('');
  const gd = team.gf - team.ga;
  const favPl = team.favPlayer ? team.sq.find((q) => q.n === team.favPlayer) || null : null;
  const favBoostNow = favPl ? getActiveFavBoost(favPl, team, favPl.me ? state.p : null) : 0;
  const displayBudget = isClubMeManager ? state.money : team.budget;
  const displayBoard = isClubMeManager ? state.bd : team.bd;
  const displayTacFam = Math.round(team.tacFam ?? 65);

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
    <div className="fixed inset-0 z-[55] bg-black/72 flex items-center justify-center p-2 sm:p-4 mland:p-2 overflow-hidden">
      <div className="w-full max-w-5xl mland:max-w-[96vw] h-[min(calc(var(--app-dvh,1dvh)*92),720px)] mland:h-[calc(var(--app-dvh,1dvh)*95)] mland:max-h-[calc(var(--app-dvh,1dvh)*100-14px)] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Compact Modal Header */}
        <header className="shrink-0 px-4 py-2 mland:px-3 mland:py-1 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
            <div className="shrink-0 w-9 h-9 mland:w-7 mland:h-7 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]/70 flex items-center justify-center [&>svg]:w-7 [&>svg]:h-7 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
              <ClubCrest name={team.name} size={28} team={team} club={state.club} isMyClub={isMeTeam && state.mode === 'm'} />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base mland:text-xs font-extrabold font-display truncate flex items-center gap-1.5 text-[var(--ink)]">
                <span className="truncate">{team.name}</span>
                {isMeTeam && <MyTeamBadge size="md" />}
              </div>
              <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap">
                <span>{TN[team.tier] || 'สโมสรทวีป'}</span>
                {rank ? <span>· อันดับ <b className="text-[var(--ink)]">{rank}</b> ({team.pts} แต้ม)</span> : null}
                <span>·</span>
                <WdlRecordBadges w={team.w} d={team.d} l={team.l} size="2xs" />
                <span>({gd >= 0 ? `+${gd}` : gd})</span>
                <span className="hidden sm:inline mland:inline">· แฟน {fmtFans(ensureTeamFans(team))} คน</span>
                <span className="hidden md:inline">· อายุเฉลี่ย {st.age} ปี</span>
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
                onClick={() => { SFX.tap(); setTeamTab('missions'); }}
                className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg mland:rounded-md text-[11px] mland:text-[9.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  teamTab === 'missions'
                    ? 'bg-[var(--g)] text-white shadow-xs'
                    : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                🎯 ภารกิจเพิ่มพลัง
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
        ) : teamTab === 'missions' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2 space-y-2.5 mland:space-y-2">
            {(() => {
              const rows = team.sq
                .map((q) => {
                  const isMe = !!q.me || (state.mode === 'p' && state.p?.name === q.n);
                  const mv = getPlayerMissionView(q, isMe ? state.p : null, state);
                  const sbSum = Object.values((isMe ? state.p?.sb : q.sb) || {}).reduce((a, b) => a + b, 0);
                  const maxTotal = mv.items.reduce((s, it) => s + it.maxStage, 0);
                  const topItem = mv.items
                    .slice()
                    .sort((a, b) => b.stage - a.stage || b.pct - a.pct)[0];
                  return { q, isMe, mv, sbSum, maxTotal, topItem };
                })
                .sort((a, b) => b.mv.passedStages - a.mv.passedStages || b.sbSum - a.sbSum || b.q.ov - a.q.ov);
              const totalPassed = rows.reduce((s, r) => s + r.mv.passedStages, 0);
              const totalBonus = rows.reduce((s, r) => s + r.sbSum, 0);
              return (
                <>
                  <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm mland:text-xs font-bold text-[var(--ink)]">
                        🎯 ภารกิจสะสมเพิ่มค่าพลังของนักเตะทีม {team.name}
                      </div>
                      <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">
                        {isMeTeam
                          ? 'แตะนักเตะเพื่อดูและปักหมุดแผนภารกิจรายคน'
                          : 'นักเตะทีมนี้ดำเนินภารกิจอัตโนมัติหลังจบการแข่งขันทุกนัด · แตะนักเตะเพื่อดูภารกิจทั้งหมด'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs mland:text-[10px] font-bold tabular shrink-0">
                      <span className="px-2 py-1 rounded-lg bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/35">
                        ผ่านรวม {totalPassed} ขั้น
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-[var(--lamp-soft)] text-[#9a6700] dark:text-[var(--lamp)] border border-[var(--lamp)]/40">
                        โบนัสพลัง +{totalBonus}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5">
                    {rows.map(({ q, isMe, mv, sbSum, maxTotal, topItem }) => (
                      <button
                        key={q.n}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onInspectPlayer(q, team, 'missions');
                        }}
                        className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-left cursor-pointer transition-colors flex items-center gap-2.5"
                      >
                        <div className="shrink-0">
                          <PlayerFace
                            player={q}
                            team={team}
                            state={state}
                            club={state.club}
                            isMyClub={isMeTeam && state.mode === 'm'}
                            careerProfile={isMe ? state.p : null}
                            size={34}
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-xs mland:text-[10.5px] truncate text-[var(--ink)]">
                              {q.n}
                            </span>
                            <TalentBadge talent={mv.talent} size="xs" />
                          </div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate tabular">
                            {q.ro} · OVR {q.ov} · ผ่าน <b className="text-[var(--g)]">{mv.passedStages}/{maxTotal}</b> · โบนัส <b className="text-[var(--ink)]">+{sbSum}</b>
                          </div>
                          {topItem && (
                            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">
                              {topItem.def.icon} {topItem.def.name}: ขั้น {topItem.completedAll ? `${topItem.maxStage}/${topItem.maxStage}` : `${topItem.stage + 1}/${topItem.maxStage}`} ({topItem.pct}%)
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-bold text-[var(--g)] shrink-0">ดู ›</span>
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}
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
                  {objInfo && (
                    <div className="flex items-center justify-between gap-2 min-w-0 tabular">
                      <div className="truncate text-[var(--mut)]">
                        เป้าหมายซีซั่น:{' '}
                        <b className={rank && rank <= objInfo.targetRank ? 'text-[var(--g)]' : 'text-[var(--ink)]'}>
                          เป้า 1–{objInfo.targetRank}
                        </b>
                        {rank ? (
                          <span className="ml-1 text-[10px] mland:text-[8px]">
                            ({rank <= objInfo.targetRank ? 'ตามเป้า' : 'ต่ำกว่าเป้า'})
                          </span>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-[var(--mut)]">
                        พลังลีก <b className="text-[var(--ink)]">#{objInfo.powerRank}/{objInfo.totalTeams}</b>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 min-w-0 tabular">
                    <div className="truncate text-[var(--mut)]">
                      {displayBudget != null && (
                        <>
                          งบ <b className="text-[var(--ink)]">{fmtMoney(displayBudget)}</b>
                          <span className="mx-1">·</span>
                        </>
                      )}
                      {displayBoard != null && (
                        <>
                          บอร์ด <b className={displayBoard >= 60 ? 'text-[var(--g)]' : displayBoard < 40 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>{Math.round(displayBoard)}%</b>
                          <span className="mx-1">·</span>
                        </>
                      )}
                      เข้าใจแผน <b className="text-[var(--ink)]">{displayTacFam}%</b>
                    </div>
                    {favPl && (
                      <div className="shrink-0 text-[var(--mut)]">
                        💖{' '}
                        <b className="text-[var(--ink)]">{favPl.n.split(' ')[0]}</b>
                        {favBoostNow > 0 ? (
                          <span className="ml-0.5 font-extrabold text-[var(--g)]">+{favBoostNow}</span>
                        ) : (
                          <span className="ml-0.5 text-[10px] mland:text-[8px]">(รอพร้อม)</span>
                        )}
                      </div>
                    )}
                  </div>
                  {!isClubMeManager && (team.aiTraining || team.aiTalkNote) && (
                    <div className="flex items-center justify-between gap-2 min-w-0 text-[var(--mut)]">
                      <div className="truncate">
                        {team.aiTraining?.label && (
                          <>
                            ซ้อม: <b className="text-[var(--ink)]">{team.aiTraining.label}</b>
                          </>
                        )}
                        {team.aiTraining?.focusPlayer && (
                          <span className="text-[10px] mland:text-[8px]"> · ปั้น {team.aiTraining.focusPlayer.split(' ')[0]}</span>
                        )}
                      </div>
                      {team.aiTalkNote && (
                        <div className="shrink-0 truncate max-w-[48%] text-[10px] mland:text-[8px]">
                          💬 {team.aiTalkNote}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="truncate text-[var(--mut)] tabular flex items-center gap-1 min-w-0">
                      <span className="inline-flex items-center gap-0.5 shrink-0">
                        <StatIconBadge kind="goal" size="xs" />
                        <b className="text-[var(--ink)]">{topScorer ? `${topScorer.n.split(' ')[0]} (${topScorer.sg || 0})` : '-'}</b>
                      </span>
                      <span className="mx-0.5">·</span>
                      <span className="inline-flex items-center gap-0.5 truncate">
                        <StatIconBadge kind="assist" size="xs" />
                        <b className="text-[var(--ink)] truncate">{topAssist ? `${topAssist.n.split(' ')[0]} (${topAssist.sa || 0})` : '-'}</b>
                      </span>
                    </div>
                    {formChars.length > 0 && (
                      <WdlFormStrip fm={team.fm} size="xs" />
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

                <div className="flex-1 min-h-0 overflow-y-auto">
                  {(() => {
                    const [teamKit, teamTrim] = teamKits(team, state);
                    const teamGkKit = pickGK(teamKit, '#111827');
                    const teamSlots = getFormationSlots(team);
                    const starterSlotByName = new Map<string, string>();
                    starters.forEach((sqPl, i) => {
                      starterSlotByName.set(sqPl.n, teamSlots[i]?.sp || sqPl.ro);
                    });
                    const starterRows = filteredSquad.filter((q) => starterNames.has(q.n));
                    const benchRows = filteredSquad.filter((q) => !starterNames.has(q.n));

                    const renderTeamSquadRow = (q: Player) => {
                      const isStarter = starterNames.has(q.n);
                      const slotRole = isStarter ? starterSlotByName.get(q.n) || q.ro : q.ro;
                      const isMe = !!q.me || (state.mode === 'p' && state.p?.name === q.n);
                      const f = Math.round(q.fit ?? 100);
                      const unavailable = (q.sus || 0) > 0 || q.inj > 0;
                      const hasCardOrStat =
                        (q.sg || 0) > 0 ||
                        (q.sa || 0) > 0 ||
                        (q.yc || 0) > 0 ||
                        (q.rc || 0) > 0;

                      return (
                        <button
                          key={q.n}
                          type="button"
                          onClick={() => onInspectPlayer(q, team)}
                          className={`w-full text-left grid grid-cols-[16px_22px_34px_26px_minmax(0,1fr)_52px_74px_28px] mland:grid-cols-[14px_19px_30px_24px_minmax(0,1fr)_42px_64px_24px] items-center gap-1 mland:gap-0.5 px-2 py-[3.5px] mland:px-1.5 mland:py-[2.5px] transition-colors cursor-pointer ${
                            unavailable
                              ? 'bg-rose-500/[0.05] hover:bg-rose-500/[0.09] opacity-85'
                              : isMe
                                ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/70'
                                : 'hover:bg-[var(--surface-2)]/65'
                          }`}
                        >
                          <div className="flex items-center justify-center shrink-0 [&>svg]:w-[15px] [&>svg]:h-[15px] mland:[&>svg]:w-[13px] mland:[&>svg]:h-[13px]">
                            <ClubCrest
                              name={team.name}
                              size={15}
                              team={team}
                              club={state.club}
                              isMyClub={team.id === state.me && state.mode === 'm'}
                            />
                          </div>

                          <div className="flex items-center justify-start">
                            <MatchPlayerThumb
                              player={q}
                              team={team}
                              state={state}
                              kitColor={q.pos === 'GK' ? teamGkKit : teamKit}
                              trimColor={q.pos === 'GK' ? undefined : teamTrim}
                              size="xs"
                            />
                          </div>

                          <div className="flex items-center justify-center">
                            <PositionBadge role={slotRole as any} size="2xs" />
                          </div>

                          <div className="text-left text-[10px] mland:text-[8.5px] font-extrabold text-[#b45309] dark:text-[var(--lamp)] tabular whitespace-nowrap">
                            #{getShirtNo(team, q)}
                          </div>

                          <div className="flex items-center justify-start gap-1 min-w-0">
                            <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate">
                              {q.n}
                            </span>
                            {team.cap === q.n && <CaptainBadge team={team} state={state} size="xs" className="shrink-0" />}
                            {team.favPlayer === q.n && (() => {
                              const rBoost = getActiveFavBoost(q, team, isMe ? state.p : null);
                              return (
                                <span
                                  title={rBoost > 0 ? `ลูกรักประจำทีม (ปลุกพลัง +${rBoost})` : 'ลูกรักประจำทีม'}
                                  className="text-[10px] mland:text-[8.5px] font-bold text-rose-500 shrink-0 tabular"
                                >
                                  💖{rBoost > 0 ? `+${rBoost}` : ''}
                                </span>
                              );
                            })()}
                            {isMe && (
                              <span
                                title="ตัวคุณ"
                                aria-label="ตัวคุณ"
                                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8px] font-black shrink-0"
                              >
                                ★
                              </span>
                            )}
                            {(q.hg || q.customCreated) ? <span title="เด็กปั้นสโมสร" className="text-[10px] mland:text-[8.5px] shrink-0">🌱</span> : null}
                            <span className="hidden sm:inline text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular shrink-0">
                              · {q.age} ปี
                            </span>
                          </div>

                          <div className="flex items-center justify-start flex-wrap gap-0.5 text-[10px] mland:text-[8.5px] tabular">
                            {hasCardOrStat ? (
                              <>
                                {(q.sg || 0) > 0 && <StatIconBadge kind="goal" count={q.sg} size="xs" />}
                                {(q.sa || 0) > 0 && <StatIconBadge kind="assist" count={q.sa} size="xs" />}
                                {(q.yc || 0) > 0 && <StatIconBadge kind="yellow" count={q.yc || 1} size="xs" />}
                                {(q.rc || 0) > 0 && <StatIconBadge kind="red" count={q.rc || 1} size="xs" />}
                              </>
                            ) : (
                              <span className="text-[var(--mut)]/55">—</span>
                            )}
                          </div>

                          <div className="flex items-center justify-start min-w-0">
                            <PlayerStatusBadge sus={q.sus} inj={q.inj} fit={f} variant="cell" />
                          </div>

                          <div className="flex items-center justify-start">
                            <OvrBadge ov={q.ov} size="2xs" />
                          </div>
                        </button>
                      );
                    };

                    return (
                      <>
                        {starterRows.length > 0 && (
                          <>
                            <div
                              className="sticky top-0 z-10 px-2.5 py-0.5 mland:px-2 border-b border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--g)]"
                              style={{ backgroundColor: 'color-mix(in srgb, var(--g) 15%, var(--surface))' }}
                            >
                              <span>ตัวจริง</span>
                              <span className="tabular">{starterRows.length} คน</span>
                            </div>
                            <div className="divide-y divide-[var(--line)]/50">
                              {starterRows.map(renderTeamSquadRow)}
                            </div>
                          </>
                        )}
                        {benchRows.length > 0 && (
                          <>
                            <div className="sticky top-0 z-10 px-2.5 py-0.5 mland:px-2 bg-[var(--surface-2)] border-y border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--ink)]">
                              <span>ตัวสำรอง</span>
                              <span className="tabular text-[var(--mut)]">{benchRows.length} คน</span>
                            </div>
                            <div className="divide-y divide-[var(--line)]/50">
                              {benchRows.map(renderTeamSquadRow)}
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

