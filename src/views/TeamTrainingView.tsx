import React, { useMemo, useState } from 'react';
import type {
  TrainingIntensity,
  Player,
  Team,
  GameState,
  TrainingProgramMeta,
  TalkTopicId,
  TeamTalkId
} from '../types/game';
import { clamp, fmtMoney } from '../utils/math';
import {
  PLAYER_PERSONALITIES,
  TEAM_TRAINING_PROGRAMS,
  TRAINING_INTENSITY_META,
  getTeamTrainingPlan
} from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { xi, logFin, getPlayerDevProfile, ef } from '../engine/playerCore';
import { getPlayerMissionView, getPlayerTalent } from '../engine/missions';
import { getStaffState } from '../engine/simulation';
import { PlayerFace } from '../components/SvgVisuals';
import { PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { TalentBadge } from '../components/TalentBadge';
import { PotentialBadge } from '../components/PotentialBadge';
import { StaminaBar, getStaminaMeta } from '../components/StaminaBar';
import { PlayerStatusBadge } from '../components/PlayerStatusBadge';
import { PositionBadge } from '../components/PositionBadge';
import { CaptainBadge } from '../components/CaptainBadge';
import { StatIconBadge } from '../components/StatIconBadge';
import { OvrBadge } from '../components/OvrBadge';
import {
  GOOD_MENTAL_THRESHOLD,
  GOOD_PHYS_THRESHOLD,
  MANAGER_TALK_TOPICS,
  TEAM_TALK_OPTIONS,
  applyPlayerCareAction,
  applyTeamTalkAction,
  getActiveFavBoost,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getTeamCareQuotaInfo,
  getWellbeingTierMeta,
  isPlayerMentalGood,
  isPlayerPhysGood,
  resolvePersonalityId
} from '../engine/wellbeing';

type RosterFilter = 'all' | 'need_care' | 'starters' | 'youth';
type TalkFilter = 'all' | 'stressed' | 'tired' | 'fav';

export const TeamTrainingView = React.memo<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onToast: (msg: string) => void;
}>(({ state, onUpdateState, onInspectPlayer, onToast }) => {
  const [trainingMode, setTrainingMode] = useState<'program' | 'talk' | 'missions'>('program');
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all');
  const [talkFilter, setTalkFilter] = useState<TalkFilter>('all');

  const me = state.teams[state.me];
  const [selectedMissionPlayer, setSelectedMissionPlayer] = useState<string>(() => me.sq[0]?.n || '');
  const [selectedTalkPlayer, setSelectedTalkPlayer] = useState<string>(
    () => me.favPlayer || me.sq[0]?.n || ''
  );

  const starters = useMemo(() => xi(me), [me]);
  const starterNames = useMemo(() => new Set(starters.map((s) => s.n)), [starters]);
  const avgFit = Math.round(starters.reduce((s, q) => s + (q.fit ?? 100), 0) / (starters.length || 1));
  const plan = getTeamTrainingPlan(state);
  const curProg = TEAM_TRAINING_PROGRAMS[plan.program];
  const curInt = TRAINING_INTENSITY_META[plan.intensity];
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  const sessionUsed = plan.doubleSessionMd === curTurn;
  const teamTalkUsed = plan.teamTalkMd === curTurn;

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

  const careQuota = useMemo(() => getTeamCareQuotaInfo(state, me), [state, me]);
  const favPlayerObj = me.favPlayer ? me.sq.find((q) => q.n === me.favPlayer) || null : null;
  const favActiveBoost = favPlayerObj ? getActiveFavBoost(favPlayerObj, me, null) : 0;

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

  const sortedTalkPlayers = useMemo(() => {
    const base = me.sq.filter((q) => {
      if (talkFilter === 'stressed') return getPlayerMentalScore(q, null) < GOOD_MENTAL_THRESHOLD;
      if (talkFilter === 'tired') return q.inj > 0 || getPlayerPhysScore(q, null) < GOOD_PHYS_THRESHOLD || (q.fit ?? 100) < 74;
      if (talkFilter === 'fav') return me.favPlayer === q.n || starterNames.has(q.n);
      return true;
    });
    return base.sort((a, b) => {
      const aFav = me.favPlayer === a.n ? 1 : 0;
      const bFav = me.favPlayer === b.n ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      const aNeed = (getPlayerMentalScore(a, null) < 60 ? 2 : 0) + (a.inj > 0 || getPlayerPhysScore(a, null) < 62 ? 2 : 0);
      const bNeed = (getPlayerMentalScore(b, null) < 60 ? 2 : 0) + (b.inj > 0 || getPlayerPhysScore(b, null) < 62 ? 2 : 0);
      if (aNeed !== bNeed) return bNeed - aNeed;
      return b.ov - a.ov;
    });
  }, [me.sq, me.favPlayer, talkFilter, starterNames]);

  const talkTargetPlayer =
    me.sq.find((q) => q.n === selectedTalkPlayer) || sortedTalkPlayers[0] || me.sq[0];

  const missionTargetPlayer = me.sq.find((q) => q.n === selectedMissionPlayer) || me.sq[0];
  const sortedMissionSquad = useMemo(
    () =>
      me.sq
        .slice()
        .sort((a, b) => getPlayerTalent(b, null) - getPlayerTalent(a, null) || b.ov - a.ov),
    [me.sq]
  );

  const jumpToPlayerTalk = (playerName: string) => {
    SFX.tap();
    setTalkFilter('all');
    setSelectedTalkPlayer(playerName);
    setTrainingMode('talk');
  };

  const handleOneOnOneTalk = (player: Player, topicId: TalkTopicId) => {
    let out: ReturnType<typeof applyPlayerCareAction> = {
      ok: false,
      msg: '',
      boostNow: 0,
      deltaMental: 0,
      deltaPhys: 0
    };
    const prevBoost = getActiveFavBoost(player, me, null);
    onUpdateState((d) => {
      out = applyPlayerCareAction(d, player.n, 'talk', topicId);
    });
    if (out.ok) {
      if (out.boostNow > 0 && prevBoost === 0) SFX.win();
      else SFX.confirm();
    } else SFX.tap();
    if (out.msg) onToast(out.msg);
  };

  const handlePhysioCare = (player: Player) => {
    let out: ReturnType<typeof applyPlayerCareAction> = {
      ok: false,
      msg: '',
      boostNow: 0,
      deltaMental: 0,
      deltaPhys: 0
    };
    const prevBoost = getActiveFavBoost(player, me, null);
    onUpdateState((d) => {
      out = applyPlayerCareAction(d, player.n, 'physio_care');
    });
    if (out.ok) {
      if (out.boostNow > 0 && prevBoost === 0) SFX.win();
      else SFX.confirm();
    } else SFX.tap();
    if (out.msg) onToast(out.msg);
  };

  const handleTeamTalk = (talkId: TeamTalkId) => {
    let res: ReturnType<typeof applyTeamTalkAction> = {
      ok: false,
      msg: '',
      opt: TEAM_TALK_OPTIONS[0],
      avgMentalDelta: 0
    };
    onUpdateState((d) => {
      res = applyTeamTalkAction(d, talkId);
    });
    if (res.ok) SFX.win();
    else SFX.tap();
    if (res.msg) onToast(res.msg);
  };

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
            onClick={() => { SFX.tap(); setTrainingMode('talk'); }}
            className={`seg-btn ${trainingMode === 'talk' ? 'seg-btn-active' : ''}`}
          >
            💬 พูดคุย &amp; ดูแลทีม{careQuota.remaining > 0 ? ` (${careQuota.remaining})` : ''}
          </button>
          <button
            type="button"
            onClick={() => { SFX.tap(); setTrainingMode('missions'); }}
            className={`seg-btn ${trainingMode === 'missions' ? 'seg-btn-active' : ''}`}
          >
            🎯 ภารกิจส่วนบุคคล
          </button>
        </div>
        <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular">
          {trainingMode === 'missions' ? (
            <span>สะสมทุกภารกิจพร้อมกัน · อัปขั้นอัตโนมัติตามค่าพรสวรรค์</span>
          ) : trainingMode === 'talk' ? (
            <span>
              ทีมทอล์ก <b className={teamTalkUsed ? 'text-[var(--mut)]' : 'text-[var(--g)]'}>{teamTalkUsed ? 'คุยแล้ว' : 'พร้อม 1 ครั้ง'}</b>
              {' · '}
              ดูแลใกล้ชิด <b className={careQuota.remaining > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>{careQuota.remaining}/{careQuota.limit}</b>
            </span>
          ) : (
            <span>
              ศูนย์ฝึก Lv.{trLv} · สตาฟฟ์ฟิต +{stf.fit * 2}% · ใจเฉลี่ย <b className={getWellbeingTierMeta(avgMental, 'mental', false).txtCls}>{avgMental}</b> · กายเฉลี่ย <b className={getWellbeingTierMeta(avgPhys, 'phys', false).txtCls}>{avgPhys}</b>
            </span>
          )}
        </div>
      </div>

      {/* Compact Shared Camp HUD Strip */}
      {trainingMode !== 'missions' && (
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
            {favPlayerObj && (
              <>
                <span className="opacity-30">·</span>
                <span className={favActiveBoost > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-amber-700 dark:text-[var(--lamp)] font-semibold'}>
                  💖 {favPlayerObj.n}{favActiveBoost > 0 ? ` (+${favActiveBoost} OVR)` : ' (รอใจ/กาย ≥72)'}
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

      {/* ==================== TAB 3: INDIVIDUAL MISSIONS ==================== */}
      {trainingMode === 'missions' && missionTargetPlayer ? (
        <div className="grid grid-cols-[240px_1fr] mland:grid-cols-[205px_1fr] grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
          <div className="p-2.5 mland:p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-1.5 h-full flex flex-col min-h-0">
            <div className="text-xs mland:text-[10.5px] font-bold px-1 shrink-0">👥 เลือกนักเตะ ({me.sq.length} คน)</div>
            <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-y-auto flex-1 min-h-0">
              {sortedMissionSquad.map((q) => {
                const selected = q.n === missionTargetPlayer.n;
                const { talent, passedStages } = getPlayerMissionView(q, null, state);
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
                        </div>
                        <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate mt-0.5 flex items-center gap-1 tabular">
                          <OvrBadge ov={q.ov} variant="inline" size="xs" prefix="OVR" />
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
      ) : trainingMode === 'talk' && talkTargetPlayer ? (
        /* ==================== TAB 2: TALK & WELLBEING ROOM ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.35fr] mland:grid-cols-[0.88fr_1.42fr] grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Squad Team Talk (Once per matchday) */}
          <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col gap-2.5 mland:gap-1.5 h-full overflow-y-auto">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--line)]/70">
              <div>
                <h3 className="font-bold text-sm mland:text-xs">📣 ประชุมทีมทอล์ก (ทั้งสโมสร)</h3>
                <p className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                  เรียกประชุมห้องแต่งตัว 1 ครั้งต่อแมตช์เดย์ — ไม่หักโควตาคุยรายคน
                </p>
              </div>
              <span className={`text-[10.5px] mland:text-[9px] font-bold shrink-0 ${teamTalkUsed ? 'text-[var(--mut)]' : 'text-[var(--g)]'}`}>
                {teamTalkUsed ? '✓ คุยแล้วรอบนี้' : 'พร้อม 1/1'}
              </span>
            </div>

            {teamTalkUsed && plan.lastTeamTalkNote && (
              <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--g-soft)]/70 border border-[var(--g)]/35 space-y-1 text-[11px] mland:text-[9px]">
                <div className="font-bold text-[var(--g)]">✓ ผลทีมทอล์กประจำนัด</div>
                <div className="text-[var(--ink)] font-medium">{plan.lastTeamTalkNote}</div>
                {plan.lastTeamTalkId && (
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] italic">
                    {TEAM_TALK_OPTIONS.find((x) => x.id === plan.lastTeamTalkId)?.coachSpeech}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 mland:gap-1.5">
              {TEAM_TALK_OPTIONS.map((opt) => {
                const isLast = teamTalkUsed && plan.lastTeamTalkId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={teamTalkUsed}
                    onClick={() => handleTeamTalk(opt.id)}
                    className={`p-2.5 mland:p-1.5 rounded-xl border text-left transition-all cursor-pointer disabled:cursor-default space-y-1 ${
                      isLast
                        ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/35'
                        : teamTalkUsed
                          ? 'bg-[var(--surface-2)]/40 border-[var(--line)] opacity-55'
                          : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)]">
                        {opt.icon} {opt.label}
                      </span>
                      <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] tabular shrink-0">
                        {isLast ? '✓ ใช้รอบนี้' : opt.effectHint.split('·')[0].trim()}
                      </span>
                    </div>
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug">
                      {opt.effectHint} · {opt.whenToUse}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-2 border-t border-[var(--line)]/70 text-[10.5px] mland:text-[8.5px] text-[var(--mut)] space-y-0.5 tabular">
              <div className="flex items-center justify-between">
                <span>ขวัญกำลังใจสโมสร</span>
                <b className="text-[var(--ink)]">{state.mor ?? 55}%</b>
              </div>
              <div className="flex items-center justify-between">
                <span>สุขภาพจิตใจเฉลี่ยทั้งทีม</span>
                <b className={getWellbeingTierMeta(avgMental, 'mental', false).txtCls}>{avgMental}/100</b>
              </div>
              <div className="flex items-center justify-between">
                <span>นักเตะเครียด/ใจต่ำ (&lt; 60)</span>
                <b className={lowMentalCount > 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}>{lowMentalCount} คน</b>
              </div>
            </div>
          </div>

          {/* Right Column: 1-on-1 Talk & Recovery Studio */}
          <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col gap-2 mland:gap-1.5 h-full min-h-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 pb-1.5 border-b border-[var(--line)]/70">
              <div>
                <h3 className="font-bold text-sm mland:text-xs">🗣️ ห้องพูดคุย &amp; ดูแลรายบุคคล</h3>
                <p className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                  เลือกนักเตะเพื่อคุยตัวต่อตัวหรือฟื้นฟูกล้ามเนื้อ (ลูกรักประจำทีมคัดเลือกอัตโนมัติจากฟอร์ม)
                </p>
              </div>
              <div className="text-[11px] mland:text-[9px] font-bold tabular">
                โควตาดูแลใกล้ชิด:{' '}
                <span className={careQuota.remaining > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
                  {careQuota.remaining}/{careQuota.limit} ครั้ง
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[215px_1fr] mland:grid-cols-[185px_1fr] grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-2 flex-1 min-h-0 overflow-hidden">
              {/* Sub-list: Select Player to Talk */}
              <div className="flex flex-col gap-1.5 min-h-0 overflow-hidden">
                <div className="grid grid-cols-4 gap-1 shrink-0">
                  {([
                    ['all', 'ทั้งหมด'],
                    ['stressed', 'ใจต่ำ'],
                    ['tired', 'ล้า/เจ็บ'],
                    ['fav', 'หลัก/รัก']
                  ] as [TalkFilter, string][]).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { SFX.tap(); setTalkFilter(k); }}
                      className={`py-1 px-1 rounded-lg text-[10px] mland:text-[8.5px] font-bold border cursor-pointer truncate ${
                        talkFilter === k
                          ? 'bg-[var(--g)] text-white border-[var(--g)]'
                          : 'bg-[var(--surface-2)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-y-auto flex-1 min-h-0">
                  {sortedTalkPlayers.length === 0 ? (
                    <div className="p-3 text-center text-[11px] text-[var(--mut)]">ไม่มีนักเตะในกลุ่มนี้</div>
                  ) : (
                    sortedTalkPlayers.map((q) => {
                      const active = q.n === talkTargetPlayer.n;
                      const m = getPlayerMentalScore(q, null);
                      const p = getPlayerPhysScore(q, null);
                      const mMeta = getWellbeingTierMeta(m, 'mental', false);
                      const pMeta = getWellbeingTierMeta(p, 'phys', q.inj > 0);
                      const isFav = me.favPlayer === q.n;
                      const talkDone = q.careTalkMd === curTurn;
                      const physDone = q.carePhysMd === curTurn;
                      return (
                        <button
                          key={q.n}
                          type="button"
                          onClick={() => { SFX.tap(); setSelectedTalkPlayer(q.n); }}
                          className={`w-full px-2 py-1.5 mland:py-1 flex items-center gap-2 text-left cursor-pointer transition-colors ${
                            active ? 'bg-[var(--g-soft)]' : 'hover:bg-[var(--surface-2)]'
                          }`}
                        >
                          <PlayerFace player={q} team={me} state={state} size={26} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11.5px] mland:text-[9.5px] font-bold flex items-center gap-1 min-w-0">
                              <PositionBadge role={q.ro} size="2xs" />
                              <span className="truncate">{q.n}</span>
                              {isFav && <span className="shrink-0">💖</span>}
                            </div>
                            <div className="text-[10px] mland:text-[8.5px] tabular flex items-center gap-1.5 text-[var(--mut)] mt-0.5">
                              <span className={`font-bold ${mMeta.txtCls}`}>🧠{m}</span>
                              <span className={`font-bold ${pMeta.txtCls}`}>💪{p}</span>
                              {q.inj > 0 && <span className="text-[var(--red)] font-bold">เจ็บ{q.inj}</span>}
                              {(talkDone || physDone) && <span className="text-[var(--g)]">✓</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Focused Player Conversation Card */}
              {(() => {
                const q = talkTargetPlayer;
                const m = getPlayerMentalScore(q, null);
                const p = getPlayerPhysScore(q, null);
                const mMeta = getWellbeingTierMeta(m, 'mental', false);
                const pMeta = getWellbeingTierMeta(p, 'phys', q.inj > 0);
                const isFav = me.favPlayer === q.n;
                const favBoost = getActiveFavBoost(q, me, null);
                const talkDone = q.careTalkMd === curTurn;
                const physDone = q.carePhysMd === curTurn;
                const persId = resolvePersonalityId(q, null);
                const persName = PLAYER_PERSONALITIES[persId]?.name || 'สมดุล';
                const effOv = ef(q);
                const mGood = isPlayerMentalGood(q, null);
                const pGood = isPlayerPhysGood(q, null);
                const activeLog = plan.lastTalkLog?.playerName === q.n ? plan.lastTalkLog : null;

                return (
                  <div className="overflow-y-auto pr-1 space-y-2.5 mland:space-y-1.5 min-h-0">
                    {/* Player Identity + Compact Favorite Bar */}
                    <div className="rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] overflow-hidden">
                      <div className="p-2.5 mland:p-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(q, me)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
                        >
                          <PlayerFace player={q} team={me} state={state} size={38} />
                          <div className="min-w-0">
                            <div className="text-sm mland:text-xs font-extrabold flex items-center gap-1.5 flex-wrap">
                              <PositionBadge role={q.ro} size="xs" />
                              <span className="group-hover:text-[var(--g)] transition-colors truncate">{q.n}</span>
                              {me.cap === q.n && <CaptainBadge team={me} state={state} size="xs" />}
                              {isFav && (
                                <span
                                  className={`px-1.5 py-[1px] rounded text-[9.5px] mland:text-[8px] font-black tabular ${
                                    favBoost > 0
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-[var(--lamp)]'
                                  }`}
                                >
                                  {favBoost > 0 ? `💖 +${favBoost} OVR` : '💖 ลูกรัก'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span>
                                พลังรวม <b className="text-[var(--ink)]">{effOv}</b>
                                {effOv !== q.ov ? ` (ฐาน ${q.ov})` : ''}
                              </span>
                              <span>·</span>
                              <span>บุคลิก: <b className="text-[var(--ink)]">{persName}</b></span>
                              <span>·</span>
                              <span>ฟิต <b className={getStaminaMeta(Math.round(q.fit ?? 100)).txtCls}>{Math.round(q.fit ?? 100)}%</b></span>
                            </div>
                          </div>
                        </button>

                        <span className="px-2 py-0.5 rounded-md bg-[var(--surface)]/75 border border-[var(--line)] text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] shrink-0 whitespace-nowrap">
                          {isFav ? '💖 ลูกรักอัตโนมัติ' : 'ลูกรักเลือกอัตโนมัติ'}
                        </span>
                      </div>

                      {/* Sleek Integrated Favorite Status Strip */}
                      <div
                        className={`px-2.5 py-1 mland:px-2 mland:py-0.5 border-t flex flex-wrap items-center justify-between gap-2 text-[10px] mland:text-[8.5px] ${
                          isFav && favBoost > 0
                            ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold'
                            : isFav
                              ? 'bg-[var(--lamp-soft)]/50 border-[var(--lamp)]/35 text-amber-800 dark:text-[var(--lamp)]'
                              : 'bg-[var(--surface)]/55 border-[var(--line)]/70 text-[var(--mut)]'
                        }`}
                      >
                        {isFav ? (
                          <>
                            <span className="font-bold">
                              {favBoost > 0
                                ? `✨ ปลุกพลังทำงาน (+${favBoost} OVR ในสนามจริง)`
                                : '⏳ รอเงื่อนไขปลุกพลัง (+5~10 OVR)'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular font-bold">
                              <span className={mGood ? 'text-[var(--g)]' : ''}>
                                🧠 {m}/{GOOD_MENTAL_THRESHOLD}{mGood ? '✓' : ''}
                              </span>
                              <span className="opacity-35">·</span>
                              <span className={!q.inj && pGood ? 'text-[var(--g)]' : ''}>
                                {q.inj > 0 ? `🏥 เจ็บ ${q.inj} นัด` : `💪 ${p}/${GOOD_PHYS_THRESHOLD}${pGood ? '✓' : ''}`}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="truncate">
                              💖 ลูกรักทีม:{' '}
                              <b className="text-[var(--ink)]">{me.favPlayer || 'เลือกอัตโนมัติจากฟอร์ม'}</b>
                            </span>
                            <span className="tabular shrink-0">
                              เงื่อนไข: ใจ/กาย ≥{GOOD_MENTAL_THRESHOLD} รับ +5~10 OVR
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mental & Physical Meters + Top Factors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5">
                      <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/45 border border-[var(--line)] space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] mland:text-[9px]">
                          <span className="font-bold">🧠 สุขภาพจิตใจ</span>
                          <span className={`font-black tabular ${mMeta.txtCls}`}>{mMeta.short} · {m}/100</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-[var(--surface)] border border-[var(--line)]/60 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${m}%`, backgroundColor: mMeta.barColor }} />
                          <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink)]/55" style={{ left: `${GOOD_MENTAL_THRESHOLD}%` }} />
                        </div>
                        <div className="space-y-0.5">
                          {(q.mentalFactors || []).slice(0, 3).map((f, idx) => (
                            <div key={`${f.label}-${idx}`} className="flex items-center justify-between gap-1 text-[10px] mland:text-[8.5px]">
                              <span className="text-[var(--mut)] truncate">{f.label}</span>
                              <span className={`font-bold tabular shrink-0 ${f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                                {f.delta >= 0 ? `+${f.delta}` : f.delta}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/45 border border-[var(--line)] space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] mland:text-[9px]">
                          <span className="font-bold">💪 สุขภาพกาย</span>
                          <span className={`font-black tabular ${pMeta.txtCls}`}>{pMeta.short} · {p}/100</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-[var(--surface)] border border-[var(--line)]/60 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: pMeta.barColor }} />
                          <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink)]/55" style={{ left: `${GOOD_PHYS_THRESHOLD}%` }} />
                        </div>
                        <div className="space-y-0.5">
                          {(q.physFactors || []).slice(0, 3).map((f, idx) => (
                            <div key={`${f.label}-${idx}`} className="flex items-center justify-between gap-1 text-[10px] mland:text-[8.5px]">
                              <span className="text-[var(--mut)] truncate">{f.label}</span>
                              <span className={`font-bold tabular shrink-0 ${f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                                {f.delta >= 0 ? `+${f.delta}` : f.delta}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 4 Interactive Talk Topics + Physio Recovery */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] mland:text-[9px] font-bold">
                        <span>เลือกหัวข้อพูดคุยตัวต่อตัว ({talkDone ? '✓ คุยแล้วนัดนี้' : 'พร้อมคุย'})</span>
                        <span className="text-[var(--mut)] font-normal">ใช้ 1 โควตาดูแล</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {MANAGER_TALK_TOPICS.map((tp) => (
                          <button
                            key={tp.id}
                            type="button"
                            disabled={talkDone || careQuota.remaining <= 0}
                            onClick={() => handleOneOnOneTalk(q, tp.id)}
                            className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer disabled:opacity-45 disabled:cursor-default transition-all space-y-0.5"
                          >
                            <div className="font-bold text-[11.5px] mland:text-[9.5px] text-[var(--ink)]">
                              {tp.icon} {tp.label}
                            </div>
                            <div className="text-[10px] mland:text-[8px] text-[var(--g)] font-semibold">{tp.effectHint}</div>
                            <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] leading-tight line-clamp-2">{tp.desc}</div>
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={physDone || careQuota.remaining <= 0}
                        onClick={() => handlePhysioCare(q)}
                        className="w-full p-2 mland:p-1.5 rounded-xl bg-sky-500/10 border border-sky-500/35 hover:border-sky-500 flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-45 disabled:cursor-default transition-all"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[11.5px] mland:text-[9.5px] text-sky-700 dark:text-sky-300">
                            {physDone ? '✓ ฟื้นฟูกล้ามเนื้อรอบนี้แล้ว' : '🧊 ส่งกายภาพนวดคลายกล้ามเนื้อตัวต่อตัว'}
                          </div>
                          <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                            เพิ่มสุขภาพกาย +{5 + Math.floor(medLv / 4) + (state.staff?.physio ? 1 : 0)}..{7 + Math.floor(medLv / 4) + (state.staff?.physio ? 1 : 0)} · ความฟิต +3%
                          </div>
                        </div>
                        <span className="text-[10.5px] mland:text-[8.5px] font-bold text-sky-700 dark:text-sky-300 shrink-0">
                          {physDone ? 'เรียบร้อย' : '+กาย & ฟิต'}
                        </span>
                      </button>
                    </div>

                    {/* Live Dialogue Log Bubble */}
                    {activeLog && (
                      <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--g-soft)]/50 border border-[var(--g)]/35 space-y-1 text-[11px] mland:text-[9px]">
                        <div className="flex items-center justify-between gap-2 font-bold">
                          <span className="text-[var(--g)]">🗣️ บทสนทนากับ {activeLog.playerName} · {activeLog.topicLabel}</span>
                          <span className="tabular text-[var(--ink)]">
                            {activeLog.deltaMental !== 0
                              ? `จิตใจ ${activeLog.deltaMental > 0 ? `+${activeLog.deltaMental}` : activeLog.deltaMental}`
                              : ''}
                            {activeLog.deltaMental !== 0 && activeLog.deltaPhys > 0 ? ' · ' : ''}
                            {activeLog.deltaPhys > 0 ? `กาย +${activeLog.deltaPhys}` : ''}
                          </span>
                        </div>
                        <div className="text-[var(--mut)]">{activeLog.coachLine}</div>
                        <div className="text-[var(--ink)] font-semibold">{activeLog.playerReply}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
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
                      <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] tabular">{prog.effectTag}</div>
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
                      <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">{im.desc}</div>
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
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">ตัวจริง 11 คนฟื้นฟิต +5% · ตัวสำรองพัฒนาไวขึ้น 1.15x</div>
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
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">ฟรี · คนล้า +{6 + Math.floor(medLv / 2) + stf.physio}% · ขวัญ +2%</div>
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
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">{avgAllFit < 60 ? 'ต้องฟิต ≥60%' : `ฟรี · เข้าใจแผน +${4 + stf.asst}% · ฟิต -3%`}</div>
                </button>

                <button
                  type="button"
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
                    onToast(`✚ กายภาพกลุ่มสำเร็จ! ลดวันเจ็บ ${reduced} คน (-1 นัด) · ฟิต +8%`);
                  }}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-sky-500/10 border border-sky-500/35 text-left cursor-pointer disabled:opacity-45 hover:border-sky-500 space-y-0.5"
                >
                  <div className="font-bold text-xs mland:text-[10px] text-sky-700 dark:text-sky-300 flex items-center gap-1">
                    <StatIconBadge kind="injury" size="xs" />
                    <span>กายภาพกลุ่ม ({injuredSq.length})</span>
                  </div>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">{injuredSq.length === 0 ? 'ไม่มีคนเจ็บ' : `${fmtMoney(15)} · หายเร็วขึ้น -1 นัด`}</div>
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
                  <span>เข้าใจแผน: <b className="text-[var(--g)]">+{plan.lastReport.tacFamDelta}%</b></span>
                  {plan.lastReport.morDelta !== 0 && <span>ขวัญทีม: <b>{plan.lastReport.morDelta > 0 ? `+${plan.lastReport.morDelta}` : plan.lastReport.morDelta}%</b></span>}
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
                  พักเดี่ยว: ฟิต +10% &amp; ลดเจ็บ 50% · ปั้นพิเศษ: โตไว 1.45x ({restedIndivCount} พักอยู่)
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
                  const isFav = me.favPlayer === q.n;
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
                                className={`px-1 rounded text-[9px] mland:text-[7.5px] font-black shrink-0 ${
                                  favBoost > 0 ? 'bg-rose-600 text-white' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
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
                              <OvrBadge ov={q.ov} variant="inline" size="xs" prefix="OVR" />
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
                          title={`เปิดห้องพูดคุยกับ ${q.n}`}
                          onClick={() => jumpToPlayerTalk(q.n)}
                          className="btn btn-xs btn-ghost px-1.5"
                        >
                          💬
                        </button>
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
