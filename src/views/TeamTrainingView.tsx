import React, { useEffect, useMemo, useState } from 'react';
import type {
  TrainingIntensity,
  NavIntent,
  Player,
  Team,
  GameState,
  TrainingProgramMeta
} from '../types/game';
import { NavFocusBanner, NavFocusBadge, useNavFocus } from '../components/NavFocusBanner';
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
import { PotentialBadge } from '../components/PotentialBadge';
import { StaminaBar, getStaminaMeta } from '../components/StaminaBar';
import { PlayerStatusBadge } from '../components/PlayerStatusBadge';
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

export const TeamTrainingView = React.memo<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team | null) => void;
  onToast: (msg: string) => void;
  navIntent?: NavIntent | null;
}>(({ state, onUpdateState, onInspectPlayer, onToast, navIntent }) => {
  const [trainingMode, setTrainingMode] = useState<'program' | 'missions' | 'rooms'>('program');
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all');
  const { activeHint, clearFocus, isFocused, scrollToFocused } = useNavFocus(navIntent, 'r');

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

  const favPlayersList = useMemo(() => getTeamFavoritePlayers(me), [me]);
  const favBoostedList = useMemo(
    () => favPlayersList.filter((q) => getActiveFavBoost(q, me, null) > 0),
    [favPlayersList, me]
  );

  const sortedTrainingPlayers = useMemo(() => {
    const base = me.sq.filter((q) => {
      if (rosterFilter === 'need_care') return q.inj > 0 || (q.fit ?? 100) < 76 || getPlayerMentalScore(q, null) < 60;
      if (rosterFilter === 'starters') return starterNames.has(q.n);
      if (rosterFilter === 'youth') return (q.age || 24) <= 23;
      return true;
    });
    return base.sort((a, b) => {
      const aUrg = a.inj > 0 ? -100 : (indMap[a.n] === 'REST' ? -30 : 0) + (a.fit ?? 100);
      const bUrg = b.inj > 0 ? -100 : (indMap[b.n] === 'REST' ? -30 : 0) + (b.fit ?? 100);
      return aUrg - bUrg || b.ov - a.ov;
    });
  }, [me.sq, indMap, rosterFilter, starterNames]);

  const missionTargetPlayer = me.sq.find((q) => q.n === selectedMissionPlayer) || me.sq[0];
  const sortedMissionSquad = useMemo(
    () =>
      me.sq
        .slice()
        .sort((a, b) => getPlayerTalent(b, null) - getPlayerTalent(a, null) || b.ov - a.ov),
    [me.sq]
  );

  return (
    <div className="space-y-2 mland:space-y-1.5 flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Mode Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="seg-bar">
          <button
            type="button"
            onClick={() => { SFX.tap(); setTrainingMode('program'); }}
            className={`seg-btn ${trainingMode === 'program' ? 'seg-btn-active' : ''}`}
          >
            📅 โปรแกรมซ้อมทีม
          </button>
          <button
            type="button"
            onClick={() => { SFX.tap(); setTrainingMode('missions'); }}
            className={`seg-btn ${trainingMode === 'missions' ? 'seg-btn-active' : ''}`}
          >
            🎯 ภารกิจส่วนบุคคล
          </button>
          <button
            type="button"
            onClick={() => { SFX.tap(); setTrainingMode('rooms'); }}
            className={`seg-btn ${trainingMode === 'rooms' ? 'seg-btn-active' : ''}`}
          >
            🚪 ห้องคุย
          </button>
        </div>
        <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular">
          {trainingMode === 'missions' ? (
            <span>สะสมทุกภารกิจพร้อมกัน · อัปขั้นอัตโนมัติตามค่าพรสวรรค์</span>
          ) : trainingMode === 'rooms' ? (
            <span>พูดคุยเฉพาะภายในทีม · คุยส่วนตัวในห้องออฟฟิศ &amp; ประชุมรวม</span>
          ) : (
            <span>
              ศูนย์ฝึก Lv.{trLv} · สตาฟฟ์ฟิต +{stf.fit * 2}% · ใจเฉลี่ย <b className={getWellbeingTierMeta(avgMental, 'mental', false).txtCls}>{avgMental}</b> · กายเฉลี่ย <b className={getWellbeingTierMeta(avgPhys, 'phys', false).txtCls}>{avgPhys}</b>
            </span>
          )}
        </div>
      </div>

      <NavFocusBanner hint={activeHint} onJumpToTarget={scrollToFocused} onDismiss={clearFocus} />

      {/* Compact Shared Camp HUD Strip */}
      {trainingMode === 'program' && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-[11px] mland:text-[9.5px] shrink-0 overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-2 shrink-0 tabular">
            <span>
              ฟิตตัวจริง <b className={getStaminaMeta(avgFit).txtCls}>{avgFit}%</b>
              <span className="text-[var(--mut)]"> (ทีม {avgAllFit}%)</span>
            </span>
            <span className="opacity-30">·</span>
            <span>
              เข้าใจแผน <b className="text-[var(--g)]">{me.tacFam ?? 65}%</b>
            </span>
            <span className="opacity-30">·</span>
            <span>
              แผนซ้อม <b className="text-[var(--ink)]">{curProg.icon} {curProg.short}</b> · {curInt.icon}
            </span>
            {favPlayersList.length > 0 && (
              <>
                <span className="opacity-30">·</span>
                <span className={favBoostedList.length > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-amber-700 dark:text-[var(--lamp)] font-semibold'}>
                  💖 ลูกรัก {favPlayersList.length} คน
                  {favBoostedList.length > 0
                    ? ` (ปลุกพลัง ${favBoostedList.length}/${favPlayersList.length})`
                    : ' (รอใจ/กาย ≥72)'}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 tabular">
            <span>
              ล้า <b className={tiredCount > 0 ? 'text-amber-700 dark:text-[var(--lamp)]' : 'text-[var(--ink)]'}>{tiredCount}</b>
              {' · '}
              เครียด <b className={lowMentalCount > 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>{lowMentalCount}</b>
              {' · '}
              เจ็บ <b className={injuredSq.length > 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>{injuredSq.length}</b>
            </span>
            <span className="opacity-30">·</span>
            <span className="text-[var(--mut)]">ฟื้นหลังเกม +{trLv * 2 + stf.fit * 2}%</span>
          </div>
        </div>
      )}

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
        <div className="grid grid-cols-[240px_1fr] mland:grid-cols-[205px_1fr] grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
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
                            variant="inline"
                            size="xs"
                            prefix="OVR"
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
        /* ==================== TAB 1: WEEKLY TRAINING PROGRAM ==================== */
        <div className="grid grid-cols-[1.1fr_0.9fr] mland:grid-cols-[1.12fr_0.88fr] grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
          {/* Left: Weekly Program, Intensity, Rest Options & Special Sessions */}
          <div className="space-y-2.5 mland:space-y-2 h-full overflow-y-auto pr-1">
            {/* 7 Training Programs */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-sm mland:text-xs">📅 โปรแกรมซ้อมประจำสัปดาห์</h3>
                <span className="text-[11px] mland:text-[9px] text-[var(--mut)]">มีผลหลังจบการแข่งแต่ละนัด</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mland:gap-1.5">
                {(Object.values(TEAM_TRAINING_PROGRAMS) as TrainingProgramMeta[]).map((prog) => {
                  const active = plan.program === prog.id;
                  return (
                    <button
                      key={prog.id}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onUpdateState((d) => {
                          const cur = getTeamTrainingPlan(d);
                          d.tf = prog.tf;
                          d.trainingPlan = { ...cur, program: prog.id };
                        });
                        onToast(`ตั้งโปรแกรมซ้อมเป็น "${prog.icon} ${prog.name}"`);
                      }}
                      className={`p-2.5 mland:p-1.5 rounded-xl border text-left cursor-pointer transition-all space-y-1 mland:space-y-0.5 ${
                        active
                          ? prog.id === 'recovery'
                            ? 'bg-emerald-500/12 border-emerald-500 ring-1 ring-emerald-500/35'
                            : 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/35'
                          : 'bg-[var(--surface-2)]/65 border-[var(--line)] hover:border-[var(--g)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-xs mland:text-[10.5px] truncate">{prog.icon} {prog.name}</span>
                        {active && (
                          <span className="text-[10px] mland:text-[8px] font-extrabold text-[var(--g)] shrink-0">✓ ใช้งาน</span>
                        )}
                      </div>
                      <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug">{prog.desc}</div>
                      <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] tabular">
                        <EffectText text={prog.effectTag} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intensity & Starter Recovery Toggle */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm mland:text-xs">⚡ ความหนักในการซ้อม &amp; คูลดาวน์ตัวจริง</h3>
                <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular">
                  ความเข้มข้น: {curInt.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
                {(['light', 'normal', 'heavy'] as TrainingIntensity[]).map((intKey) => {
                  const im = TRAINING_INTENSITY_META[intKey];
                  const active = plan.intensity === intKey;
                  return (
                    <button
                      key={intKey}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onUpdateState((d) => {
                          const cur = getTeamTrainingPlan(d);
                          d.trainingPlan = { ...cur, intensity: intKey };
                        });
                        onToast(`ปรับความหนักเป็น "${im.icon} ${im.label}"`);
                      }}
                      className={`p-2 mland:p-1.5 rounded-xl border text-left cursor-pointer transition-all space-y-0.5 ${
                        active ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/35' : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]/60'
                      }`}
                    >
                      <div className="font-bold text-xs mland:text-[10px]">{im.icon} {im.label}</div>
                      <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">
                        <EffectText text={im.desc} />
                      </div>
                    </button>
                  );
                })}
              </div>

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
                className={`w-full p-2.5 mland:p-1.5 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                  plan.restStarters ? 'bg-[var(--g-soft)] border-[var(--g)]/60' : 'bg-[var(--surface-2)]/70 border-[var(--line)]'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs mland:text-[10.5px]">🧊 แยกคูลดาวน์ตัวจริงหลังเกม &amp; ซ้อมทีมสำรอง</div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                    <EffectText text="ตัวจริง 11 คนฟื้นฟิต +5% · ตัวสำรองพัฒนาไวขึ้น 1.15x" />
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] mland:text-[9.5px] font-bold shrink-0 ${plan.restStarters ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)] border border-[var(--line)]'}`}>
                  {plan.restStarters ? 'เปิดอยู่' : 'ปิดอยู่'}
                </span>
              </button>
            </div>

            {/* Special Weekly Session (Once per matchday) */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm mland:text-xs">🏟️ เซสชันพิเศษระหว่างสัปดาห์</h3>
                <span className={`text-[11px] mland:text-[9px] font-bold ${sessionUsed ? 'text-[var(--mut)]' : 'text-[var(--g)]'}`}>
                  {sessionUsed ? '✓ ใช้สิทธิ์นัดนี้แล้ว' : 'พร้อมสั่งซ้อม 1 ครั้ง/นัด'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
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
                  className="p-2.5 mland:p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-left cursor-pointer disabled:opacity-45 hover:border-emerald-500 space-y-0.5"
                >
                  <div className="font-bold text-xs mland:text-[10px] text-emerald-700 dark:text-emerald-300">🧘 ฟื้นฟูกล้ามเนื้อ</div>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                    <EffectText text={`ฟรี · คนล้า +${6 + Math.floor(medLv / 2) + stf.physio}% · ขวัญ +2%`} />
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
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left cursor-pointer disabled:opacity-45 hover:border-[var(--g)] space-y-0.5"
                >
                  <div className="font-bold text-xs mland:text-[10px]">⚽ ซ้อมจำลองแผน</div>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                    {avgAllFit < 60 ? (
                      'ต้องฟิต ≥60%'
                    ) : (
                      <EffectText text={`ฟรี · เข้าใจแผน +${4 + stf.asst}% · ฟิต -3%`} />
                    )}
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
                  className={`p-2.5 mland:p-1.5 rounded-xl bg-sky-500/10 border border-sky-500/35 text-left cursor-pointer disabled:opacity-45 hover:border-sky-500 space-y-0.5 ${
                    isFocused('rehab') ? 'task-focus-spotlight' : ''
                  }`}
                >
                  <div className="font-bold text-xs mland:text-[10px] text-sky-700 dark:text-sky-300 flex items-center gap-1 flex-wrap">
                    <StatIconBadge kind="injury" size="xs" />
                    <span>กายภาพกลุ่ม ({injuredSq.length})</span>
                    {isFocused('rehab') && <NavFocusBadge />}
                  </div>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                    {injuredSq.length === 0 ? (
                      'ไม่มีคนเจ็บ'
                    ) : (
                      <>
                        <span className="text-[var(--red)] font-bold">-{fmtMoney(15)}</span> ·{' '}
                        <span className="text-[var(--g)] font-bold">หายเร็วขึ้น -1 นัด</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Last Training Report */}
            {plan.lastReport && (
              <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface-2)]/70 border border-[var(--line)] space-y-1 text-xs mland:text-[10px]">
                <div className="flex items-center justify-between font-bold">
                  <span>📋 สรุปผลซ้อมล่าสุด (นัดที่ {plan.lastReport.md})</span>
                  <span className="text-[var(--mut)] font-normal">{plan.lastReport.programName}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] mland:text-[9.5px] tabular">
                  <span>ฟิตเฉลี่ย: <b className={plan.lastReport.fitDeltaAvg >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>{plan.lastReport.fitDeltaAvg >= 0 ? `+${plan.lastReport.fitDeltaAvg}` : plan.lastReport.fitDeltaAvg}%</b></span>
                  <span>เข้าใจแผน: <b className={plan.lastReport.tacFamDelta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>{plan.lastReport.tacFamDelta >= 0 ? `+${plan.lastReport.tacFamDelta}` : plan.lastReport.tacFamDelta}%</b></span>
                  {plan.lastReport.morDelta !== 0 && <span>ขวัญทีม: <b className={plan.lastReport.morDelta > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>{plan.lastReport.morDelta > 0 ? `+${plan.lastReport.morDelta}` : plan.lastReport.morDelta}%</b></span>}
                  {plan.lastReport.restedCount > 0 && <span>พักเดี่ยว: <b>{plan.lastReport.restedCount} คน</b></span>}
                </div>
                <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">
                  {plan.lastReport.improved.length > 0
                    ? <>🌟 พัฒนา OVR ขึ้น: <b className="text-[var(--g)]">{plan.lastReport.improved.join(', ')}</b></>
                    : 'รอบล่าสุดยังไม่มีนักเตะอัป OVR (ลองเพิ่มความหนักหรือตั้งดาวรุ่งปั้นพิเศษ)'}
                </div>
              </div>
            )}
          </div>

          {/* Right: Individual Conditioning, Focus & Quick Talk Shortcut */}
          <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col space-y-2 mland:space-y-1.5 h-full min-h-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div>
                <h3 className="font-bold text-sm mland:text-xs">👥 จัดการรายบุคคล ({sortedTrainingPlayers.length} คน)</h3>
                <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                  <EffectText text={`พักเดี่ยว: ฟิต +10% & ลดเจ็บ 50% · ปั้นพิเศษ: โตไว 1.45x (${restedIndivCount} พักอยู่)`} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
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
                          nextInd[q.n] = 'REST';
                          cnt++;
                        } else if (nextInd[q.n] === 'REST' && (q.fit ?? 100) >= 88 && q.inj === 0) {
                          delete nextInd[q.n];
                        }
                      });
                      d.trainingPlan = { ...cur, individualFocus: nextInd };
                    });
                    onToast(cnt > 0 ? `😴 สั่งพักเดี่ยวนักเตะล้า/เจ็บ ${cnt} คนแล้ว` : 'ทุกคนฟิตพร้อมซ้อมดีอยู่แล้ว');
                  }}
                  className="btn btn-xs btn-secondary"
                >
                  😴 พักคนล้า &lt;72%
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
                      onToast('ให้ทุกคนกลับมาซ้อมตามโปรแกรมทีมแล้ว');
                    }}
                    className="btn btn-xs btn-ghost"
                  >
                    รีเซ็ต
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-4 gap-1 shrink-0">
              {([
                ['all', 'ทั้งหมด'],
                ['need_care', 'ต้องดูแล'],
                ['starters', 'ตัวจริง'],
                ['youth', 'ดาวรุ่ง ≤23']
              ] as [RosterFilter, string][]).map(([fk, fl]) => (
                <button
                  key={fk}
                  type="button"
                  onClick={() => { SFX.tap(); setRosterFilter(fk); }}
                  className={`py-1 px-1.5 rounded-lg text-[10.5px] mland:text-[8.5px] font-bold border cursor-pointer truncate transition-colors ${
                    rosterFilter === fk
                      ? 'bg-[var(--g)] text-white border-[var(--g)]'
                      : 'bg-[var(--surface-2)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                  }`}
                >
                  {fl}
                </button>
              ))}
            </div>

            <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-y-auto flex-1 min-h-0">
              {sortedTrainingPlayers.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--mut)]">ไม่พบนักเตะในตัวกรองนี้</div>
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

                  return (
                    <div
                      key={q.n}
                      className={`px-2.5 py-2 mland:py-1 flex items-center justify-between gap-2 ${
                        isRest ? 'bg-emerald-500/8' : unavailable ? 'bg-rose-500/[0.04]' : isFocus ? 'bg-[var(--lamp-soft)]/30' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(q, me)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <PlayerFace player={q} team={me} state={state} size={26} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs mland:text-[10px] font-bold flex items-center gap-1 min-w-0">
                            <PositionBadge role={q.ro} size="xs" />
                            <span className="truncate">{q.n}</span>
                            {me.cap === q.n && <CaptainBadge team={me} state={state} size="xs" className="shrink-0" />}
                            {isFav && (
                              <span
                                title={favBoost > 0 ? `ลูกรักประจำทีม (+${favBoost} OVR ชั่วคราว)` : 'ลูกรักประจำทีม'}
                                className={`inline-flex items-center text-[10px] mland:text-[8.5px] font-extrabold leading-none tabular shrink-0 ${
                                  favBoost > 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-rose-500/80 dark:text-rose-400/80'
                                }`}
                              >
                                {favBoost > 0 ? `💖+${favBoost}` : '💖'}
                              </span>
                            )}
                            {isStarter && <span className="text-[9px] shrink-0" title="ตัวจริง">⭐</span>}
                            <PlayerStatusBadge sus={q.sus} inj={q.inj} variant="pill" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <StaminaBar value={f} variant="inline" barWidthClass="w-12 sm:w-14 mland:w-10" />
                            <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular inline-flex items-center gap-1 flex-wrap">
                              <OvrBadge
                                ov={q.ov + favBoost}
                                variant="inline"
                                size="xs"
                                prefix="OVR"
                                title={favBoost > 0 ? `OVR ${q.ov} + ลูกรัก ${favBoost} = ${q.ov + favBoost}` : undefined}
                              />
                              <span aria-hidden="true">·</span>
                              <span className={`font-bold ${mMeta.txtCls}`} title={`สุขภาพจิตใจ ${mScore}/100`}>
                                🧠{mScore}
                              </span>
                              <span className={`font-bold ${pMeta.txtCls}`} title={`สุขภาพกาย ${pScore}/100`}>
                                💪{pScore}
                              </span>
                              <span aria-hidden="true">·</span>
                              <PotentialBadge pot={q.pot || q.ov} variant="inline" size="xs" />
                              <span aria-hidden="true">·</span>
                              <TalentBadge talent={getPlayerTalent(q, null)} variant="inline" size="xs" />
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
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
                          className={`btn btn-xs ${
                            isRest ? 'bg-emerald-600 text-white border border-emerald-600' : 'btn-secondary'
                          }`}
                        >
                          {isRest ? '😴 พักอยู่' : '😴 พัก'}
                        </button>
                        {getPlayerDevProfile(q, null).phase !== 'declining' && (
                          <button
                            type="button"
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
                            className={`btn btn-xs ${isFocus ? 'btn-gold' : 'btn-secondary'}`}
                          >
                            {isFocus ? '🌟 ปั้น' : '⭐ ปั้น'}
                          </button>
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
