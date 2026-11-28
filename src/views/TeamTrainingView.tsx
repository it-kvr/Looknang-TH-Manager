import React, { useEffect, useMemo, useState } from 'react';
import type {
  TrainingIntensity,
  NavIntent,
  Player,
  Team,
  GameState,
  TrainingProgramMeta
} from '../types/game';
import { NavFocusBadge, useNavFocus } from '../components/NavFocusBanner';
import { EffectText } from '../components/DeltaText';
import { clamp, fmtMoney } from '../utils/math';
import {
  TEAM_TRAINING_PROGRAMS,
  TRAINING_INTENSITY_META,
  getTeamTrainingPlan
} from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { xi, logFin, getPlayerDevProfile } from '../engine/playerCore';
import { getPlayerMissionView, getPlayerTalent } from '../engine/missions';
import { getStaffState } from '../engine/simulation';
import { PlayerFace } from '../components/SvgVisuals';
import { PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { ClubTalkRoomsPanel } from '../components/ClubTalkRoomsPanel';
import { TalentBadge } from '../components/TalentBadge';
import { StaminaBar, getStaminaMeta } from '../components/StaminaBar';
import { PositionBadge } from '../components/PositionBadge';
import { CaptainBadge } from '../components/CaptainBadge';
import { StatIconBadge } from '../components/StatIconBadge';
import { OvrBadge } from '../components/OvrBadge';
import {
  getActiveFavBoost,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getTeamFavoritePlayers,
  getWellbeingTierMeta,
  isTeamFavoritePlayer
} from '../engine/wellbeing';

type RosterFilter = 'all' | 'need_care' | 'starters' | 'youth';
type RosterSort = 'care' | 'fit_asc' | 'ov_desc' | 'pot_desc' | 'mental_asc' | 'age_asc';

const DRILL_PROGRAM_ORDER: Array<TrainingProgramMeta['id']> = [
  'balanced',
  'attack',
  'defense',
  'tactics',
  'setpiece',
  'fitness'
];

export const TeamTrainingView = React.memo<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team | null) => void;
  onToast: (msg: string) => void;
  navIntent?: NavIntent | null;
}>(({ state, onUpdateState, onInspectPlayer, onToast, navIntent }) => {
  const [trainingMode, setTrainingMode] = useState<'program' | 'missions' | 'rooms'>('program');
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all');
  const [rosterSort, setRosterSort] = useState<RosterSort>('care');
  const [rosterQuery, setRosterQuery] = useState('');
  const { clearFocus, isFocused } = useNavFocus(navIntent, 'r');

  const me = state.teams[state.me];
  const [selectedMissionPlayer, setSelectedMissionPlayer] = useState<string>(() => me.sq[0]?.n || '');

  useEffect(() => {
    if (navIntent?.tab !== 'r') return;
    if (navIntent.sub === 'missions') {
      setTrainingMode('missions');
    } else if (
      navIntent.sub === 'rooms' ||
      navIntent.focus === 'team-talk' ||
      navIntent.focus?.startsWith('talk:')
    ) {
      setTrainingMode('rooms');
    } else if (navIntent.sub === 'program' || navIntent.focus === 'rehab') {
      setTrainingMode('program');
      if (navIntent.focus === 'rehab') setRosterFilter('need_care');
    }
  }, [navIntent]);

  const starters = useMemo(() => xi(me), [me]);
  const starterNames = useMemo(() => new Set(starters.map((s) => s.n)), [starters]);
  const avgFit = Math.round(starters.reduce((s, q) => s + (q.fit ?? 100), 0) / (starters.length || 1));
  const plan = getTeamTrainingPlan(state);
  const curProg = TEAM_TRAINING_PROGRAMS[plan.program];
  const curInt = TRAINING_INTENSITY_META[plan.intensity];
  const recoveryProg = TEAM_TRAINING_PROGRAMS.recovery;
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  const sessionUsed = plan.doubleSessionMd === curTurn;

  const avgAllFit = me.sq.length ? Math.round(me.sq.reduce((s, q) => s + (q.fit ?? 100), 0) / me.sq.length) : 100;
  const avgMental = me.sq.length
    ? Math.round(me.sq.reduce((s, q) => s + getPlayerMentalScore(q, null), 0) / me.sq.length)
    : 70;
  const avgPhys = me.sq.length
    ? Math.round(me.sq.reduce((s, q) => s + getPlayerPhysScore(q, null), 0) / me.sq.length)
    : 75;
  const tiredCount = me.sq.filter((q) => (q.fit ?? 100) < 72 && q.inj === 0).length;
  const lowMentalCount = me.sq.filter((q) => getPlayerMentalScore(q, null) < 60).length;
  const injuredSq = me.sq.filter((q) => q.inj > 0);
  const stf = useMemo(() => getStaffState(state), [state]);
  const medLv = state.med ?? 1;
  const trLv = state.tr ?? 1;
  const indMap = plan.individualFocus || {};
  const restedIndivCount = Object.values(indMap).filter((v) => v === 'REST').length;

  const needCarePlayers = useMemo(
    () => me.sq.filter((q) => q.inj > 0 || (q.fit ?? 100) < 76 || getPlayerMentalScore(q, null) < 60),
    [me.sq]
  );
  const youthCount = useMemo(() => me.sq.filter((q) => (q.age || 24) <= 23).length, [me.sq]);
  const needRestEligibleCount = useMemo(
    () => me.sq.filter((q) => ((q.fit ?? 100) < 72 || q.inj > 0) && indMap[q.n] !== 'REST').length,
    [me.sq, indMap]
  );

  const favPlayersList = useMemo(() => getTeamFavoritePlayers(me), [me]);
  const favBoostedList = useMemo(
    () => favPlayersList.filter((q) => getActiveFavBoost(q, me, null) > 0),
    [favPlayersList, me]
  );

  const focusedPlayerObj = useMemo(
    () => (state.focusPlayer ? me.sq.find((q) => q.n === state.focusPlayer) || null : null),
    [me.sq, state.focusPlayer]
  );

  const recommendedFocusPlayer = useMemo(() => {
    const candidates = me.sq.filter(
      (q) =>
        q.inj === 0 &&
        indMap[q.n] !== 'REST' &&
        getPlayerDevProfile(q, null).phase !== 'declining'
    );
    if (!candidates.length) return null;
    return candidates
      .slice()
      .sort((a, b) => {
        const aUpside = (a.pot || a.ov) - a.ov;
        const bUpside = (b.pot || b.ov) - b.ov;
        const aScore = aUpside * 3 + getPlayerTalent(a, null) * 0.4 + Math.max(0, 25 - (a.age || 24)) * 1.5;
        const bScore = bUpside * 3 + getPlayerTalent(b, null) * 0.4 + Math.max(0, 25 - (b.age || 24)) * 1.5;
        return bScore - aScore || b.ov - a.ov;
      })[0];
  }, [me.sq, indMap]);

  const sortedTrainingPlayers = useMemo(() => {
    const qText = rosterQuery.trim().toLowerCase();
    const base = me.sq.filter((q) => {
      if (rosterFilter === 'need_care') {
        if (!(q.inj > 0 || (q.fit ?? 100) < 76 || getPlayerMentalScore(q, null) < 60)) return false;
      } else if (rosterFilter === 'starters') {
        if (!starterNames.has(q.n)) return false;
      } else if (rosterFilter === 'youth') {
        if ((q.age || 24) > 23) return false;
      }
      if (qText) {
        const hay = `${q.n} ${q.ro} ${q.pos}`.toLowerCase();
        if (!hay.includes(qText)) return false;
      }
      return true;
    });

    return base.sort((a, b) => {
      if (rosterSort === 'fit_asc') {
        return (a.fit ?? 100) - (b.fit ?? 100) || b.ov - a.ov;
      }
      if (rosterSort === 'ov_desc') {
        return b.ov - a.ov || (b.pot || b.ov) - (a.pot || a.ov);
      }
      if (rosterSort === 'pot_desc') {
        return (b.pot || b.ov) - (a.pot || a.ov) || b.ov - a.ov;
      }
      if (rosterSort === 'mental_asc') {
        return getPlayerMentalScore(a, null) - getPlayerMentalScore(b, null) || (a.fit ?? 100) - (b.fit ?? 100);
      }
      if (rosterSort === 'age_asc') {
        return (a.age || 24) - (b.age || 24) || (b.pot || b.ov) - (a.pot || a.ov);
      }
      // Default 'care': injured / resting / fatigued first, then OVR
      const aUrg = a.inj > 0 ? -120 : (indMap[a.n] === 'REST' ? -30 : 0) + (a.fit ?? 100);
      const bUrg = b.inj > 0 ? -120 : (indMap[b.n] === 'REST' ? -30 : 0) + (b.fit ?? 100);
      return aUrg - bUrg || b.ov - a.ov;
    });
  }, [me.sq, indMap, rosterFilter, rosterSort, rosterQuery, starterNames]);

  const missionTargetPlayer = me.sq.find((q) => q.n === selectedMissionPlayer) || me.sq[0];
  const sortedMissionSquad = useMemo(
    () =>
      me.sq
        .slice()
        .sort((a, b) => getPlayerTalent(b, null) - getPlayerTalent(a, null) || b.ov - a.ov),
    [me.sq]
  );

  const selectTeamProgram = (prog: TrainingProgramMeta) => {
    SFX.tap();
    onUpdateState((d) => {
      const cur = getTeamTrainingPlan(d);
      d.tf = prog.tf;
      d.trainingPlan = { ...cur, program: prog.id };
    });
    onToast(`ตั้งโปรแกรมซ้อมเป็น "${prog.icon} ${prog.name}"`);
  };

  return (
    <div className="space-y-2 mland:space-y-1.5 flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Unified Top Bar: Sub-Navigation + Inline Readiness Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="seg-bar shrink-0">
          <button
            type="button"
            onClick={() => { SFX.tap(); setTrainingMode('program'); }}
            className={`seg-btn whitespace-nowrap ${trainingMode === 'program' ? 'seg-btn-active' : ''}`}
          >
            📅 โปรแกรมซ้อม
          </button>
          <button
            type="button"
            onClick={() => { SFX.tap(); setTrainingMode('missions'); }}
            className={`seg-btn whitespace-nowrap ${trainingMode === 'missions' ? 'seg-btn-active' : ''}`}
          >
            🎯 ภารกิจรายคน
          </button>
          <button
            type="button"
            onClick={() => { SFX.tap(); setTrainingMode('rooms'); }}
            className={`seg-btn whitespace-nowrap ${trainingMode === 'rooms' ? 'seg-btn-active' : ''}`}
          >
            🚪 ห้องคุย
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">
          {trainingMode === 'missions' ? (
            <span>สะสมทุกภารกิจพร้อมกัน · อัปขั้นอัตโนมัติตามค่าพรสวรรค์</span>
          ) : trainingMode === 'rooms' ? (
            <span>พูดคุยเฉพาะภายในทีม · ห้องออฟฟิศส่วนตัว &amp; ประชุมรวม</span>
          ) : (
            <>
              <span>
                ศูนย์ฝึก Lv.{trLv} (<b className="text-[var(--g)]">+{trLv * 2 + stf.fit * 2}%</b> ฟิต)
              </span>
              <span aria-hidden="true" className="opacity-35">·</span>
              <span>
                ฟิตตัวจริง <b className={getStaminaMeta(avgFit).txtCls}>{avgFit}%</b>
                <span className="hidden sm:inline"> (ทีม {avgAllFit}%)</span>
              </span>
              <span aria-hidden="true" className="opacity-35">·</span>
              <span>
                เข้าใจแผน <b className="text-[var(--g)]">{me.tacFam ?? 65}%</b>
              </span>
              <span aria-hidden="true" className="opacity-35 hidden md:inline">·</span>
              <span className="hidden md:inline">
                ใจ <b className={getWellbeingTierMeta(avgMental, 'mental', false).txtCls}>{avgMental}</b>
                {' · '}
                กาย <b className={getWellbeingTierMeta(avgPhys, 'phys', false).txtCls}>{avgPhys}</b>
              </span>
              {favPlayersList.length > 0 && (
                <>
                  <span aria-hidden="true" className="opacity-35">·</span>
                  <span className={favBoostedList.length > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-rose-500/85 dark:text-rose-400/85 font-semibold'}>
                    💖 {favBoostedList.length}/{favPlayersList.length}
                  </span>
                </>
              )}
              {(tiredCount > 0 || lowMentalCount > 0 || injuredSq.length > 0) && (
                <>
                  <span aria-hidden="true" className="opacity-35">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setRosterFilter('need_care');
                      setRosterSort('care');
                    }}
                    title="กรองเฉพาะนักเตะที่ต้องดูแล"
                    className="font-bold text-amber-700 dark:text-[var(--lamp)] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    ต้องดูแล {needCarePlayers.length} คน
                    {injuredSq.length > 0 ? ` (เจ็บ ${injuredSq.length})` : ''}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ==================== TAB 3: TALK ROOMS ==================== */}
      {trainingMode === 'rooms' ? (
        <ClubTalkRoomsPanel
          state={state}
          onUpdateState={onUpdateState}
          onInspectPlayer={onInspectPlayer}
          onToast={onToast}
          navIntent={navIntent}
          isFocused={isFocused}
        />
      ) : trainingMode === 'missions' && missionTargetPlayer ? (
        /* ==================== TAB 2: PERSONAL MISSIONS ==================== */
        <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr] mland:grid-cols-[205px_1fr] sm:grid-rows-[minmax(0,1fr)] mland:grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-y-auto sm:overflow-hidden mland:overflow-hidden">
          <div className="p-2.5 mland:p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-1.5 h-full flex flex-col min-h-0">
            <div className="text-xs mland:text-[10.5px] font-bold px-1 shrink-0">👥 เลือกนักเตะ ({me.sq.length} คน)</div>
            <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-y-auto flex-1 min-h-0">
              {sortedMissionSquad.map((q) => {
                const selected = q.n === missionTargetPlayer.n;
                const { talent, passedStages } = getPlayerMissionView(q, null, state);
                const isFav = isTeamFavoritePlayer(me, q.n);
                const mFavBoost = getActiveFavBoost(q, me, null);
                return (
                  <button
                    key={q.n}
                    type="button"
                    onClick={() => { SFX.tap(); setSelectedMissionPlayer(q.n); }}
                    className={`w-full px-2.5 py-2 mland:py-1 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                      selected ? 'bg-[var(--g-soft)]' : 'hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PlayerFace player={q} team={me} state={state} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs mland:text-[10px] font-bold flex items-center gap-1 min-w-0">
                          <PositionBadge role={q.ro} size="2xs" />
                          <span className="truncate">{q.n}</span>
                          {me.cap === q.n && <CaptainBadge team={me} state={state} size="xs" className="shrink-0" />}
                          {isFav && (
                            <span
                              title={mFavBoost > 0 ? `ลูกรักประจำทีม (+${mFavBoost} OVR ชั่วคราว)` : 'ลูกรักประจำทีม (รอใจ/กาย ≥ 72)'}
                              className={`inline-flex items-center text-[9.5px] mland:text-[8px] font-extrabold leading-none tabular shrink-0 ${
                                mFavBoost > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-rose-500/80 dark:text-rose-400/80'
                              }`}
                            >
                              {mFavBoost > 0 ? `💖+${mFavBoost}` : '💖'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate mt-0.5 flex items-center gap-1 tabular">
                          <OvrBadge
                            ov={q.ov + mFavBoost}
                            boost={mFavBoost}
                            size="xs"
                            title={mFavBoost > 0 ? `OVR ${q.ov} + ลูกรัก ${mFavBoost} = ${q.ov + mFavBoost}` : undefined}
                          />
                          {passedStages > 0 ? <span>· ✓{passedStages}</span> : null}
                        </div>
                      </div>
                    </div>
                    <TalentBadge talent={talent} variant="default" size="xs" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] h-full overflow-y-auto">
            <PlayerMissionsPanel
              player={missionTargetPlayer}
              team={me}
              state={state}
              onUpdateState={onUpdateState}
              onToast={onToast}
            />
          </div>
        </div>
      ) : (
        /* ==================== TAB 1: COMPACT TRAINING & ERGONOMIC INDIVIDUAL MANAGEMENT ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-[0.82fr_1.32fr] mland:grid-cols-[0.82fr_1.28fr] lg:grid-rows-[minmax(0,1fr)] mland:grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-y-auto lg:overflow-hidden mland:overflow-hidden">
          {/* LEFT PANE: Compact Weekly Training Setup, Special Sessions & Last Report */}
          <div className="space-y-2 mland:space-y-1.5 lg:h-full lg:overflow-y-auto lg:pr-0.5 mland:h-full mland:overflow-y-auto mland:pr-0.5 shrink-0">
            {/* Program & Intensity Unified Card */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
              {/* Programs Header */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">📅 โปรแกรมซ้อมประจำสัปดาห์</h3>
                <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] whitespace-nowrap">
                  ใช้: <b className="text-[var(--ink)]">{curProg.icon} {curProg.short}</b>
                </span>
              </div>

              {/* 6 Active Drills in Symmetric 2x3 Grid + Full-Width Recovery Strip */}
              <div className="space-y-1.5 mland:space-y-1">
                <div className="grid grid-cols-2 gap-1.5 mland:gap-1">
                  {DRILL_PROGRAM_ORDER.map((pid) => {
                    const prog = TEAM_TRAINING_PROGRAMS[pid];
                    const active = plan.program === prog.id;
                    return (
                      <button
                        key={prog.id}
                        type="button"
                        title={prog.desc}
                        onClick={() => selectTeamProgram(prog)}
                        className={`px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl border text-left cursor-pointer transition-colors ${
                          active
                            ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-inset ring-[var(--g)]/35'
                            : 'bg-[var(--surface-2)]/55 border-[var(--line)] hover:border-[var(--g)]/65 hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[11.5px] mland:text-[9.5px] text-[var(--ink)] truncate">
                            {prog.icon} {prog.name}
                          </span>
                          {active && (
                            <span className="text-[10px] mland:text-[8px] font-black text-[var(--g)] shrink-0">✓</span>
                          )}
                        </div>
                        <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular truncate mt-0.5">
                          <EffectText text={prog.effectTag} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 7th Program: Full-width Team Recovery Option (zero orphan card) */}
                {(() => {
                  const active = plan.program === recoveryProg.id;
                  return (
                    <button
                      type="button"
                      title={recoveryProg.desc}
                      onClick={() => selectTeamProgram(recoveryProg)}
                      className={`w-full px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                        active
                          ? 'bg-emerald-500/12 border-emerald-500 ring-1 ring-inset ring-emerald-500/35'
                          : 'bg-[var(--surface-2)]/45 border-[var(--line)] hover:border-emerald-500/70 hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <span className="font-bold text-[11.5px] mland:text-[9.5px] text-[var(--ink)] truncate">
                        {recoveryProg.icon} {recoveryProg.name}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[9.5px] mland:text-[8px] tabular shrink-0">
                        <EffectText text={recoveryProg.effectTag} />
                        {active && <span className="font-black text-emerald-600 dark:text-emerald-400">✓</span>}
                      </span>
                    </button>
                  );
                })()}
              </div>

              {/* Active Program Full Description (1 crisp line) */}
              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug px-0.5">
                {curProg.desc}
              </div>

              {/* Divider -> Intensity & Starter Cooldown */}
              <div className="pt-2 mland:pt-1.5 border-t border-[var(--line)] space-y-1.5 mland:space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs mland:text-[10px]">⚡ ความเข้มข้นการซ้อม</span>
                  <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular truncate">
                    {curInt.icon} {curInt.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                  {(['light', 'normal', 'heavy'] as TrainingIntensity[]).map((intKey) => {
                    const im = TRAINING_INTENSITY_META[intKey];
                    const active = plan.intensity === intKey;
                    const shortMeta =
                      intKey === 'light'
                        ? '+4% ฟิต · 0.75x'
                        : intKey === 'normal'
                          ? 'สมดุล · 1.0x'
                          : '1.45x · ฟิต -5%';
                    return (
                      <button
                        key={intKey}
                        type="button"
                        title={im.desc}
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            const cur = getTeamTrainingPlan(d);
                            d.trainingPlan = { ...cur, intensity: intKey };
                          });
                          onToast(`ปรับความหนักเป็น "${im.icon} ${im.label}"`);
                        }}
                        className={`px-2 py-1.5 mland:px-1.5 mland:py-1 rounded-xl border text-left cursor-pointer transition-colors ${
                          active
                            ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-inset ring-[var(--g)]/35'
                            : 'bg-[var(--surface-2)]/55 border-[var(--line)] hover:border-[var(--g)]/60'
                        }`}
                      >
                        <div className="font-bold text-[11px] mland:text-[9.5px] truncate">{im.icon} {im.label.split(' / ')[0]}</div>
                        <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular truncate mt-0.5">
                          <EffectText text={shortMeta} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Compact Starter Cooldown Toggle Row */}
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    const nextVal = !plan.restStarters;
                    onUpdateState((d) => {
                      const cur = getTeamTrainingPlan(d);
                      d.trainingPlan = { ...cur, restStarters: nextVal };
                    });
                    onToast(nextVal ? 'เปิดพักตัวจริงแยกหลังแข่ง (+5% ฟิตตัวจริง · ตัวสำรองซ้อมเข้ม 1.15x)' : 'ปิดโหมดพักตัวจริงแยกแล้ว');
                  }}
                  className={`w-full px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                    plan.restStarters
                      ? 'bg-[var(--g-soft)] border-[var(--g)]/60'
                      : 'bg-[var(--surface-2)]/45 border-[var(--line)] hover:border-[var(--g)]/50'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[11px] mland:text-[9.5px]">🧊 คูลดาวน์ตัวจริงหลังเกม</span>
                    <span className="text-[10px] mland:text-[8px] text-[var(--mut)] tabular">
                      <EffectText text="ตัวจริง +5% ฟิต · สำรองโต 1.15x" />
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] mland:text-[8.5px] font-extrabold shrink-0 whitespace-nowrap ${
                      plan.restStarters
                        ? 'bg-[var(--g)] text-white'
                        : 'bg-[var(--surface)] text-[var(--mut)] border border-[var(--line)]'
                    }`}
                  >
                    {plan.restStarters ? 'เปิดอยู่' : 'ปิด'}
                  </span>
                </button>
              </div>
            </div>

            {/* Special Weekly Session + Last Training Report */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">🏟️ เซสชันพิเศษระหว่างสัปดาห์</h3>
                <span className={`text-[10.5px] mland:text-[8.5px] font-bold whitespace-nowrap ${sessionUsed ? 'text-[var(--mut)]' : 'text-[var(--g)]'}`}>
                  {sessionUsed ? '✓ ใช้สิทธิ์นัดนี้แล้ว' : 'พร้อมสั่ง 1 ครั้ง/นัด'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                <button
                  type="button"
                  disabled={sessionUsed}
                  onClick={() => {
                    SFX.win();
                    let healedCnt = 0;
                    const gain = 6 + Math.floor(medLv / 2) + stf.physio;
                    onUpdateState((d) => {
                      const cur = getTeamTrainingPlan(d);
                      d.teams[d.me].sq.forEach((q) => {
                        if ((q.fit ?? 100) < 92) {
                          q.fit = clamp((q.fit ?? 100) + gain, 35, 100);
                          healedCnt++;
                        }
                      });
                      d.mor = clamp((d.mor ?? 50) + 2, 0, 100);
                      d.trainingPlan = { ...cur, doubleSessionMd: curTurn };
                    });
                    onToast(`🧘 เซสชันนวดฟื้นฟูสำเร็จ! ฟื้นฟิตให้ ${healedCnt} คน (+${gain}%) · ขวัญ +2%`);
                  }}
                  className="px-2 py-1.5 mland:px-1.5 mland:py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-left cursor-pointer disabled:opacity-45 hover:border-emerald-500 space-y-0.5"
                >
                  <div className="font-bold text-[11px] mland:text-[9.5px] text-emerald-700 dark:text-emerald-300 truncate">🧘 ฟื้นฟู</div>
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                    <EffectText text={`ฟรี · +${6 + Math.floor(medLv / 2) + stf.physio}% ฟิต`} />
                  </div>
                </button>

                <button
                  type="button"
                  disabled={sessionUsed || avgAllFit < 60}
                  onClick={() => {
                    SFX.tap();
                    const famAdd = 4 + stf.asst;
                    onUpdateState((d) => {
                      const cur = getTeamTrainingPlan(d);
                      const t = d.teams[d.me];
                      t.tacFam = clamp((t.tacFam ?? 65) + famAdd, 30, 100);
                      d.mor = clamp((d.mor ?? 50) + 2, 0, 100);
                      t.sq.forEach((q) => {
                        if (q.inj === 0) q.fit = clamp((q.fit ?? 100) - 3, 30, 100);
                      });
                      d.trainingPlan = { ...cur, doubleSessionMd: curTurn };
                    });
                    onToast(`⚽ ลงทีมซ้อมแท็กติกสำเร็จ! ความเข้าใจแผน +${famAdd}% · ขวัญ +2% (ฟิต -3%)`);
                  }}
                  className="px-2 py-1.5 mland:px-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] text-left cursor-pointer disabled:opacity-45 hover:border-[var(--g)] space-y-0.5"
                >
                  <div className="font-bold text-[11px] mland:text-[9.5px] truncate">⚽ จำลองแผน</div>
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                    {avgAllFit < 60 ? 'ต้องฟิต ≥60%' : <EffectText text={`ฟรี · แผน +${4 + stf.asst}%`} />}
                  </div>
                </button>

                <button
                  type="button"
                  data-focus-id="rehab"
                  disabled={sessionUsed || injuredSq.length === 0 || state.money < 15}
                  onClick={() => {
                    SFX.win();
                    let reduced = 0;
                    onUpdateState((d) => {
                      const cur = getTeamTrainingPlan(d);
                      d.money -= 15;
                      logFin(d, 'กายภาพบำบัดกลุ่มนักเตะบาดเจ็บ', -15);
                      d.teams[d.me].sq.forEach((q) => {
                        if (q.inj > 0) {
                          q.inj = Math.max(0, q.inj - 1);
                          q.fit = clamp((q.fit ?? 75) + 8, 40, 100);
                          reduced++;
                        }
                      });
                      d.trainingPlan = { ...cur, doubleSessionMd: curTurn };
                    });
                    clearFocus();
                    onToast(`✚ กายภาพกลุ่มสำเร็จ! ลดวันเจ็บ ${reduced} คน (หายเร็วขึ้น -1 นัด) · ฟิต +8%`);
                  }}
                  className={`px-2 py-1.5 mland:px-1.5 mland:py-1 rounded-xl bg-sky-500/10 border border-sky-500/35 text-left cursor-pointer disabled:opacity-45 hover:border-sky-500 space-y-0.5 ${
                    isFocused('rehab') ? 'task-focus-spotlight task-focus-spotlight-sky' : ''
                  }`}
                >
                  <div className="font-bold text-[11px] mland:text-[9.5px] text-sky-700 dark:text-sky-300 flex items-center gap-1 min-w-0">
                    <StatIconBadge kind="injury" size="xs" />
                    <span className="truncate">กายภาพ ({injuredSq.length})</span>
                    {isFocused('rehab') && <NavFocusBadge tone="sky" />}
                  </div>
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                    {injuredSq.length === 0 ? (
                      'ไม่มีคนเจ็บ'
                    ) : (
                      <>
                        <span className="text-[var(--red)] font-bold">-{fmtMoney(15)}</span> ·{' '}
                        <span className="text-[var(--g)] font-bold">-1 นัด</span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {plan.lastReport && (
                <div className="pt-2 mland:pt-1.5 border-t border-[var(--line)] space-y-1 text-[11px] mland:text-[9px]">
                  <div className="flex items-center justify-between gap-2 tabular">
                    <span className="font-bold text-[var(--ink)]">
                      📋 ผลซ้อมนัดที่ {plan.lastReport.md} · <span className="font-medium text-[var(--mut)]">{plan.lastReport.programName}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 shrink-0">
                      <span>
                        ฟิต{' '}
                        <b className={plan.lastReport.fitDeltaAvg >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
                          {plan.lastReport.fitDeltaAvg >= 0 ? `+${plan.lastReport.fitDeltaAvg}` : plan.lastReport.fitDeltaAvg}%
                        </b>
                      </span>
                      <span>
                        แผน <b className="text-[var(--g)]">+{plan.lastReport.tacFamDelta}%</b>
                      </span>
                      {plan.lastReport.morDelta !== 0 && (
                        <span>
                          ขวัญ{' '}
                          <b className={plan.lastReport.morDelta > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
                            {plan.lastReport.morDelta > 0 ? `+${plan.lastReport.morDelta}` : plan.lastReport.morDelta}%
                          </b>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug">
                    {plan.lastReport.improved.length > 0 ? (
                      <>🌟 พัฒนา OVR ขึ้น: <b className="text-[var(--g)]">{plan.lastReport.improved.join(', ')}</b></>
                    ) : (
                      'รอบล่าสุดยังไม่มีนักเตะอัป OVR (ลองตั้ง ⭐ ปั้นพิเศษ หรือเพิ่มความหนัก)'
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Ergonomic Individual Player Training Table */}
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-[380px] lg:min-h-0 lg:h-full mland:min-h-0 mland:h-full overflow-hidden">
            {/* 1. Header + Batch Actions */}
            <div className="px-3 pt-2.5 pb-2 mland:px-2 mland:pt-1.5 mland:pb-1.5 space-y-2 mland:space-y-1.5 border-b border-[var(--line)] shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
                  <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] text-[var(--ink)]">
                    👥 จัดการรายบุคคล
                  </h3>
                  <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular">
                    {sortedTrainingPlayers.length}/{me.sq.length} คน
                    {restedIndivCount > 0 && (
                      <> · พักเดี่ยว <b className="text-emerald-600 dark:text-emerald-400">{restedIndivCount}</b></>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      let cnt = 0;
                      onUpdateState((d) => {
                        const cur = getTeamTrainingPlan(d);
                        const nextInd: Record<string, 'REST' | 'FOCUS'> = { ...(cur.individualFocus || {}) };
                        d.teams[d.me].sq.forEach((q) => {
                          if ((q.fit ?? 100) < 72 || q.inj > 0) {
                            if (nextInd[q.n] !== 'REST') cnt++;
                            nextInd[q.n] = 'REST';
                            if (d.focusPlayer === q.n) d.focusPlayer = null;
                          } else if (nextInd[q.n] === 'REST' && (q.fit ?? 100) >= 88 && q.inj === 0) {
                            delete nextInd[q.n];
                          }
                        });
                        d.trainingPlan = { ...cur, individualFocus: nextInd };
                      });
                      onToast(cnt > 0 ? `😴 สั่งพักเดี่ยวนักเตะล้า/เจ็บ ${cnt} คนแล้ว` : 'ทุกคนฟิตพร้อมซ้อมดีอยู่แล้ว');
                    }}
                    className={`btn btn-xs whitespace-nowrap ${
                      needRestEligibleCount > 0 ? 'btn-secondary border-amber-500/45 text-amber-800 dark:text-amber-300' : 'btn-secondary'
                    }`}
                  >
                    😴 พักคนล้า{needRestEligibleCount > 0 ? ` (${needRestEligibleCount})` : ' <72%'}
                  </button>
                  {restedIndivCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onUpdateState((d) => {
                          const cur = getTeamTrainingPlan(d);
                          d.trainingPlan = { ...cur, individualFocus: {} };
                        });
                        onToast('ยกเลิกคำสั่งพักเดี่ยวทั้งหมดแล้ว');
                      }}
                      className="btn btn-xs btn-ghost whitespace-nowrap"
                    >
                      ล้างพัก ({restedIndivCount})
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Pinned Active Focus Spotlight (Always visible) */}
              <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)]/80 flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                {focusedPlayerObj ? (
                  <>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-extrabold text-amber-700 dark:text-[var(--lamp)] shrink-0 whitespace-nowrap">
                        🌟 ปั้นพิเศษ 1.45x
                      </span>
                      <span aria-hidden="true" className="opacity-35">·</span>
                      <PositionBadge role={focusedPlayerObj.ro} size="2xs" />
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(focusedPlayerObj, me)}
                        className="font-bold text-[var(--ink)] hover:underline truncate cursor-pointer text-left"
                      >
                        {focusedPlayerObj.n}
                      </button>
                      {(() => {
                        const spotBoost = getActiveFavBoost(focusedPlayerObj, me, null);
                        return (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] mland:text-[8px] text-[var(--mut)] tabular shrink-0">
                            <OvrBadge
                              ov={focusedPlayerObj.ov + spotBoost}
                              boost={spotBoost}
                              size="xs"
                              title={spotBoost > 0 ? `OVR ${focusedPlayerObj.ov} + ลูกรัก ${spotBoost} = ${focusedPlayerObj.ov + spotBoost}` : undefined}
                            />
                            <span>→ POT {focusedPlayerObj.pot || focusedPlayerObj.ov}</span>
                          </span>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onUpdateState((d) => { d.focusPlayer = null; });
                      }}
                      className="px-1.5 py-0.5 rounded-md text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] hover:text-[var(--red)] hover:bg-[var(--surface)] cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      ✕ ยกเลิก
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--mut)] truncate">
                      🌟 <b className="text-[var(--ink)]">ปั้นพิเศษ (1.45x)</b> · เลือกได้ 1 คนในตาราง
                    </span>
                    {recommendedFocusPlayer && (
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            const cur = getTeamTrainingPlan(d);
                            const nextInd = { ...(cur.individualFocus || {}) };
                            if (nextInd[recommendedFocusPlayer.n] === 'REST') delete nextInd[recommendedFocusPlayer.n];
                            d.trainingPlan = { ...cur, individualFocus: nextInd };
                            d.focusPlayer = recommendedFocusPlayer.n;
                          });
                          onToast(`ตั้ง "${recommendedFocusPlayer.n}" เป็นดาวรุ่งปั้นพิเศษแล้ว`);
                        }}
                        className="px-2 py-0.5 rounded-md bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 text-amber-800 dark:text-[var(--lamp)] text-[10px] mland:text-[8.5px] font-bold cursor-pointer hover:brightness-105 shrink-0 whitespace-nowrap"
                      >
                        ⭐ แนะนำ: {recommendedFocusPlayer.n.split(' ')[0]} (POT {recommendedFocusPlayer.pot || recommendedFocusPlayer.ov})
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 3. Filter Tabs + Search & Sort Controls */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="grid grid-cols-4 gap-1 flex-1 min-w-[230px]">
                  {([
                    ['all', `ทั้งหมด (${me.sq.length})`],
                    ['need_care', `ดูแล (${needCarePlayers.length})`],
                    ['starters', `ตัวจริง (${starters.length})`],
                    ['youth', `≤23 ปี (${youthCount})`]
                  ] as [RosterFilter, string][]).map(([fk, fl]) => {
                    const active = rosterFilter === fk;
                    const alertStyle = fk === 'need_care' && needCarePlayers.length > 0 && !active;
                    return (
                      <button
                        key={fk}
                        type="button"
                        onClick={() => { SFX.tap(); setRosterFilter(fk); }}
                        className={`py-1 px-1.5 rounded-lg text-[10px] mland:text-[8.5px] font-bold border cursor-pointer truncate transition-colors tabular whitespace-nowrap ${
                          active
                            ? 'bg-[var(--g)] text-white border-[var(--g)]'
                            : alertStyle
                              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/35 hover:border-amber-500'
                              : 'bg-[var(--surface-2)]/70 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {fl}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-[116px] mland:w-[100px]">
                    <input
                      type="text"
                      value={rosterQuery}
                      onChange={(e) => setRosterQuery(e.target.value)}
                      placeholder="ค้นหาชื่อ/ตำแหน่ง"
                      aria-label="ค้นหานักเตะ"
                      className="w-full h-[26px] mland:h-[22px] pl-2 pr-5 rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] mland:text-[8.5px] text-[var(--ink)] placeholder:text-[var(--mut)]/75 focus:outline-none focus:border-[var(--g)]"
                    />
                    {rosterQuery && (
                      <button
                        type="button"
                        onClick={() => setRosterQuery('')}
                        aria-label="ล้างคำค้นหา"
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-[var(--mut)] hover:text-[var(--ink)] px-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select
                    value={rosterSort}
                    onChange={(e) => {
                      SFX.tap();
                      setRosterSort(e.target.value as RosterSort);
                    }}
                    aria-label="เรียงลำดับนักเตะ"
                    className="h-[26px] mland:h-[22px] px-1.5 rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[var(--g)]"
                  >
                    <option value="care">เรียง: ควรดูแล</option>
                    <option value="fit_asc">ฟิตน้อยสุด</option>
                    <option value="ov_desc">OVR สูงสุด</option>
                    <option value="pot_desc">POT สูงสุด</option>
                    <option value="mental_asc">จิตใจต่ำสุด</option>
                    <option value="age_asc">อายุน้อยสุด</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Aligned Column Headers */}
            <div className="grid grid-cols-[minmax(0,1fr)_52px_54px_82px] sm:grid-cols-[minmax(0,1fr)_62px_66px_92px] mland:grid-cols-[minmax(0,1fr)_54px_58px_82px] items-center gap-1.5 px-2.5 mland:px-2 py-1 bg-[var(--surface-2)]/65 border-b border-[var(--line)] text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] shrink-0">
              <span>นักเตะ</span>
              <span className="text-center">ความฟิต</span>
              <span className="text-center">OVR/POT</span>
              <span className="text-right">คำสั่ง</span>
            </div>

            {/* 5. High-Density Tabular Roster Rows */}
            <div className="divide-y divide-[var(--line)]/80 overflow-y-auto flex-1 min-h-0">
              {sortedTrainingPlayers.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <div className="text-xs text-[var(--mut)]">ไม่พบนักเตะในเงื่อนไขที่เลือก</div>
                  {(rosterFilter !== 'all' || rosterQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setRosterFilter('all');
                        setRosterQuery('');
                      }}
                      className="btn btn-xs btn-secondary"
                    >
                      แสดงนักเตะทั้งหมด
                    </button>
                  )}
                </div>
              ) : (
                sortedTrainingPlayers.map((q) => {
                  const f = Math.round(q.fit ?? 100);
                  const isRest = indMap[q.n] === 'REST';
                  const isFocus = state.focusPlayer === q.n;
                  const isStarter = starterNames.has(q.n);
                  const unavailable = q.inj > 0 || (q.sus || 0) > 0;
                  const isFav = isTeamFavoritePlayer(me, q.n);
                  const favBoost = getActiveFavBoost(q, me, null);
                  const mScore = getPlayerMentalScore(q, null);
                  const pScore = getPlayerPhysScore(q, null);
                  const mMeta = getWellbeingTierMeta(mScore, 'mental', false);
                  const pMeta = getWellbeingTierMeta(pScore, 'phys', q.inj > 0);
                  const potVal = q.pot || q.ov;
                  const highUpside = potVal - q.ov >= 6;
                  const canFocus = getPlayerDevProfile(q, null).phase !== 'declining';

                  return (
                    <div
                      key={q.n}
                      className={`grid grid-cols-[minmax(0,1fr)_52px_54px_82px] sm:grid-cols-[minmax(0,1fr)_62px_66px_92px] mland:grid-cols-[minmax(0,1fr)_54px_58px_82px] items-center gap-1.5 px-2.5 mland:px-2 py-1.5 mland:py-1 transition-colors ${
                        isRest
                          ? 'bg-emerald-500/[0.08]'
                          : isFocus
                            ? 'bg-[var(--lamp-soft)]/35'
                            : unavailable
                              ? 'bg-rose-500/[0.04]'
                              : 'hover:bg-[var(--surface-2)]/45'
                      }`}
                    >
                      {/* Col 1: Player Identity (Click to inspect — spacious single-line name) */}
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(q, me)}
                        className="flex items-center gap-1.5 mland:gap-1 min-w-0 text-left cursor-pointer group"
                      >
                        <div className="hidden sm:block mland:block shrink-0 [&>svg]:block">
                          <PlayerFace player={q} team={me} state={state} size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <PositionBadge role={q.ro} size="2xs" />
                            <span className="text-[12px] mland:text-[10px] font-bold text-[var(--ink)] group-hover:text-[var(--g)] truncate leading-tight">
                              {q.n}
                            </span>
                            {me.cap === q.n && <CaptainBadge team={me} state={state} size="xs" className="shrink-0" />}
                            {isFav && (
                              <span
                                title={favBoost > 0 ? `ลูกรักประจำทีม (+${favBoost} OVR ชั่วคราว)` : 'ลูกรักประจำทีม'}
                                className={`inline-flex items-center text-[9.5px] mland:text-[8px] font-extrabold leading-none tabular shrink-0 ${
                                  favBoost > 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-rose-500/80 dark:text-rose-400/80'
                                }`}
                              >
                                {favBoost > 0 ? `💖+${favBoost}` : '💖'}
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular truncate mt-0.5 flex items-center gap-1">
                            <span>{q.age}ปี</span>
                            {isStarter && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[var(--g)] font-semibold">ตัวจริง</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span
                              className="inline-flex items-center gap-1 font-bold"
                              title={`จิตใจ ${mScore}/100 · ร่างกาย ${pScore}/100`}
                            >
                              <span className={mMeta.txtCls}>🧠{mScore}</span>
                              <span className={pMeta.txtCls}>💪{pScore}</span>
                            </span>
                            {q.inj > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[var(--red)] font-bold">เจ็บ {q.inj}น</span>
                              </>
                            )}
                            {(q.sus || 0) > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-700 dark:text-amber-300 font-bold">แบน {q.sus}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Col 2: Stamina Bar + % */}
                      <div className="flex justify-center">
                        <StaminaBar value={f} variant="compact" className="w-[50px] sm:w-[58px] mland:w-[50px]" />
                      </div>

                      {/* Col 3: Standard OVR Badge + POT */}
                      <div className="flex items-center justify-center gap-0.5 tabular">
                        <OvrBadge
                          ov={q.ov + favBoost}
                          boost={favBoost}
                          size="sm"
                          title={favBoost > 0 ? `OVR พื้นฐาน ${q.ov} + ลูกรัก ${favBoost} = ${q.ov + favBoost}` : undefined}
                        />
                        <span
                          title={`ศักยภาพสูงสุด ${potVal}`}
                          className={`text-[9.5px] mland:text-[8px] font-bold hidden sm:inline mland:inline ${
                            highUpside ? 'text-[var(--g)]' : 'text-[var(--mut)]'
                          }`}
                        >
                          /{potVal}
                        </span>
                      </div>

                      {/* Col 4: Compact 2-Action Toggle (Rest | Star Focus) */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={isRest ? 'คลิกเพื่อกลับมาซ้อมปกติ' : 'สั่งพักเดี่ยว: ฟิต +10% · ลดเสี่ยงเจ็บ 50% (งดพัฒนาช่วงพัก)'}
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              const cur = getTeamTrainingPlan(d);
                              const nextInd = { ...(cur.individualFocus || {}) };
                              if (nextInd[q.n] === 'REST') delete nextInd[q.n];
                              else nextInd[q.n] = 'REST';
                              if (d.focusPlayer === q.n) d.focusPlayer = null;
                              d.trainingPlan = { ...cur, individualFocus: nextInd };
                            });
                          }}
                          className={`inline-flex items-center justify-center w-[39px] sm:w-[44px] mland:w-[39px] h-[25px] mland:h-[21px] rounded-lg border text-[10px] mland:text-[8.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                            isRest
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-[var(--surface-2)]/75 text-[var(--ink)] border-[var(--line)] hover:border-emerald-500/70'
                          }`}
                        >
                          😴พัก
                        </button>

                        {canFocus ? (
                          <button
                            type="button"
                            title={isFocus ? 'กำลังปั้นพิเศษ 1.45x (คลิกเพื่อยกเลิก)' : 'ตั้งเป็นนักเตะปั้นพิเศษ (โตไว 1.45x · เลือกได้ 1 คน)'}
                            onClick={() => {
                              SFX.tap();
                              onUpdateState((d) => {
                                const cur = getTeamTrainingPlan(d);
                                const nextInd = { ...(cur.individualFocus || {}) };
                                if (d.focusPlayer === q.n) {
                                  d.focusPlayer = null;
                                } else {
                                  d.focusPlayer = q.n;
                                  if (nextInd[q.n] === 'REST') delete nextInd[q.n];
                                  d.trainingPlan = { ...cur, individualFocus: nextInd };
                                }
                              });
                            }}
                            className={`inline-flex items-center justify-center w-[39px] sm:w-[44px] mland:w-[39px] h-[25px] mland:h-[21px] rounded-lg border text-[10px] mland:text-[8.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                              isFocus
                                ? 'bg-[var(--lamp)] text-[#261900] border-amber-500'
                                : 'bg-[var(--surface-2)]/75 text-[var(--ink)] border-[var(--line)] hover:border-[var(--lamp)]'
                            }`}
                          >
                            {isFocus ? '🌟ปั้น' : '⭐ปั้น'}
                          </button>
                        ) : (
                          <span
                            title="นักเตะเลยจุดพีคแล้ว (ไม่เข้าเกณฑ์ปั้นพิเศษ)"
                            className="h-[25px] mland:h-[21px] w-[39px] sm:w-[44px] mland:w-[39px] inline-flex items-center justify-center text-[10px] text-[var(--mut)]/45 select-none"
                          >
                            —
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
