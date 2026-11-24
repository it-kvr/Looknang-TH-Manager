import React, { useState } from 'react';
import type { TrainingIntensity, Player, Team, GameState, TrainingProgramMeta } from '../types/game';
import { clamp, fmtMoney } from '../utils/math';
import { TEAM_TRAINING_PROGRAMS, TRAINING_INTENSITY_META, getTeamTrainingPlan } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { xi, logFin } from '../engine/playerCore';
import { getPlayerMissionView, getPlayerTalent, talentTierMeta } from '../engine/missions';
import { getStaffState } from '../engine/simulation';
import { PlayerFace } from '../components/SvgVisuals';
import { PlayerMissionsPanel } from '../components/PlayerMissionsPanel';

export const TeamTrainingView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onToast: (msg: string) => void;
}> = ({ state, onUpdateState, onInspectPlayer, onToast }) => {
  const [trainingMode, setTrainingMode] = useState<'program' | 'missions'>('program');
  const me = state.teams[state.me];
  const [selectedMissionPlayer, setSelectedMissionPlayer] = useState<string>(() => me.sq[0]?.n || '');
  const starters = xi(me);
  const avgFit = Math.round(starters.reduce((s, q) => s + (q.fit ?? 100), 0) / (starters.length || 1));
  const plan = getTeamTrainingPlan(state);
  const curProg = TEAM_TRAINING_PROGRAMS[plan.program];
  const curInt = TRAINING_INTENSITY_META[plan.intensity];
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  const sessionUsed = plan.doubleSessionMd === curTurn;
  const avgAllFit = me.sq.length ? Math.round(me.sq.reduce((s, q) => s + (q.fit ?? 100), 0) / me.sq.length) : 100;
  const tiredCount = me.sq.filter((q) => (q.fit ?? 100) < 72 && q.inj === 0).length;
  const injuredSq = me.sq.filter((q) => q.inj > 0);
  const stf = getStaffState(state);
  const medLv = state.med ?? 1;
  const trLv = state.tr ?? 1;
  const indMap = plan.individualFocus || {};
  const restedIndivCount = Object.values(indMap).filter((v) => v === 'REST').length;
  const sortedTrainingPlayers = me.sq
    .slice()
    .sort((a, b) => {
      const aUrg = a.inj > 0 ? -100 : (indMap[a.n] === 'REST' ? -30 : 0) + (a.fit ?? 100);
      const bUrg = b.inj > 0 ? -100 : (indMap[b.n] === 'REST' ? -30 : 0) + (b.fit ?? 100);
      return aUrg - bUrg || b.ov - a.ov;
    });
  const missionTargetPlayer = me.sq.find((q) => q.n === selectedMissionPlayer) || me.sq[0];
  const sortedMissionSquad = me.sq
    .slice()
    .sort((a, b) => getPlayerTalent(b, null) - getPlayerTalent(a, null) || b.ov - a.ov);

  return (
    <div className="space-y-2 mland:space-y-1.5 flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Mode Sub-Navigation */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="inline-flex p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] gap-1">
          <button
            type="button"
            onClick={() => { SFX.tap(); setTrainingMode('program'); }}
            className={`px-3 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-bold cursor-pointer transition-colors ${
              trainingMode === 'program' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)] hover:text-[var(--ink)]'
            }`}
          >
            📅 โปรแกรมซ้อมทีม
          </button>
          <button
            type="button"
            onClick={() => { SFX.tap(); setTrainingMode('missions'); }}
            className={`px-3 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-bold cursor-pointer transition-colors flex items-center gap-1.5 ${
              trainingMode === 'missions' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)] hover:text-[var(--ink)]'
            }`}
          >
            <span>🎯 ภารกิจส่วนบุคคล</span>
          </button>
        </div>
        <span className="text-[11px] mland:text-[9px] text-[var(--mut)]">
          {trainingMode === 'missions' ? 'สะสมทุกภารกิจพร้อมกัน อัปขั้นอัตโนมัติตามค่าพรสวรรค์' : `ศูนย์ฝึก Lv.${trLv} · สตาฟฟ์ฟิต +${stf.fit * 2}%`}
        </span>
      </div>

      {trainingMode === 'missions' && missionTargetPlayer ? (
        <div className="grid grid-cols-[240px_1fr] mland:grid-cols-[205px_1fr] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
          <div className="p-2.5 mland:p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-1.5 h-full flex flex-col min-h-0">
            <div className="text-xs mland:text-[10.5px] font-bold px-1 shrink-0">👥 เลือกนักเตะ ({me.sq.length} คน)</div>
            <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-y-auto flex-1 min-h-0">
              {sortedMissionSquad.map((q) => {
                const selected = q.n === missionTargetPlayer.n;
                const { talent, passedStages } = getPlayerMissionView(q, null, state);
                const tlMeta = talentTierMeta(talent);
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
                      <div className="min-w-0">
                        <div className="text-xs mland:text-[10px] font-bold truncate">{q.n}</div>
                        <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">
                          {q.ro} · OVR {q.ov} {passedStages > 0 ? `· ✓${passedStages}` : ''}
                        </div>
                      </div>
                    </div>
                    <span
                      className="px-1.5 py-0.5 rounded text-[9.5px] mland:text-[8px] font-extrabold tabular shrink-0"
                      style={{ background: tlMeta.bg, color: tlMeta.color }}
                      title={`พรสวรรค์ ${talent}/99 (${tlMeta.label})`}
                    >
                      TL {talent}
                    </span>
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
      <>
      {/* Compact Training Camp HUD Strip */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-[11px] mland:text-[9.5px] shrink-0 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-2 shrink-0">
          <span>
            ฟิต 11 ตัวจริง{' '}
            <b className={`tabular ${avgFit < 72 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>{avgFit}%</b>
            <span className="text-[var(--mut)] tabular"> (ทั้งทีม {avgAllFit}%)</span>
          </span>
          <span className="opacity-30">·</span>
          <span>
            เข้าใจแผน <b className="text-[var(--g)] tabular">{me.tacFam ?? 65}%</b>
          </span>
          <span className="opacity-30">·</span>
          <span>
            โปรแกรม <b className="text-[var(--ink)]">{curProg.icon} {curProg.short}</b> · <b>{curInt.icon}</b>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 tabular">
          <span>
            ล้า <b className={tiredCount > 0 ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--ink)]'}>{tiredCount}</b>
            {' · '}
            เจ็บ <b className={injuredSq.length > 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}>{injuredSq.length}</b>
          </span>
          <span className="opacity-30">·</span>
          <span className="text-[var(--mut)]">ฟื้นหลังเกม +{trLv * 2 + stf.fit * 2}%</span>
        </div>
      </div>

      {/* Two-Column Realistic Training Workspace */}
      <div className="grid grid-cols-[1.12fr_0.88fr] mland:grid-cols-[1.15fr_0.85fr] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
        {/* Left: Weekly Program, Intensity, Rest Options & Special Sessions */}
        <div className="space-y-2.5 mland:space-y-2 h-full overflow-y-auto pr-1">
          {/* 7 Training Programs */}
          <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-sm mland:text-xs">📅 โปรแกรมซ้อมประจำสัปดาห์</h3>
              <span className="text-[11px] mland:text-[9px] text-[var(--mut)]">มีผลหลังจบการแข่งแต่ละนัด</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mland:gap-1">
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
                          ? 'bg-emerald-500/12 border-emerald-500 ring-1 ring-emerald-500/40'
                          : 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/40'
                        : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-bold text-xs mland:text-[10.5px] truncate">{prog.icon} {prog.name}</span>
                      {active && <span className="px-1.5 py-0.2 rounded bg-[var(--g)] text-white text-[9px] font-bold shrink-0">ใช้งาน</span>}
                    </div>
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug">{prog.desc}</div>
                    <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)]">{prog.effectTag}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intensity & Starter Recovery Toggle */}
          <div className="p-3.5 sm:p-4 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm mland:text-xs">⚡ ความหนักในการซ้อม &amp; พักตัวจริง</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 mland:gap-1">
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
                      active ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/40' : 'bg-[var(--surface-2)] border-[var(--line)]'
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
                onToast(nextVal ? 'เปิดพักตัวจริงแยกหลังแข่ง (+5% ฟิตตัวจริง · ตัวสำรองซ้อมเข้ม 1.2x)' : 'ปิดโหมดพักตัวจริงแยกแล้ว');
              }}
              className={`w-full p-2.5 mland:p-1.5 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                plan.restStarters ? 'bg-[var(--g-soft)] border-[var(--g)]/60' : 'bg-[var(--surface-2)] border-[var(--line)]'
              }`}
            >
              <div className="min-w-0">
                <div className="font-bold text-xs mland:text-[10.5px]">🧊 พักฟื้นตัวจริงแยกหลังเกม (Cool-down &amp; Bench Scrimmage)</div>
                <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">11 ตัวจริงเข้าคูลดาวน์ฟื้นฟิต +5% · ตัวสำรองซ้อมลงทีมพัฒนาไวขึ้น 1.2x</div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] mland:text-[9.5px] font-bold shrink-0 ${plan.restStarters ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)]'}`}>
                {plan.restStarters ? 'เปิด' : 'ปิด'}
              </span>
            </button>
          </div>

          {/* Special Weekly Session (Once per matchday) */}
          <div className="p-3.5 sm:p-4 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm mland:text-xs">🏟️ เซสชันพิเศษระหว่างสัปดาห์</h3>
              <span className={`text-[11px] mland:text-[9px] font-bold ${sessionUsed ? 'text-[var(--mut)]' : 'text-[var(--g)]'}`}>
                {sessionUsed ? '⏳ ใช้สิทธิ์นัดนี้แล้ว (รอแข่งนัดถัดไป)' : '✅ พร้อมสั่งซ้อม 1 ครั้ง/นัด'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mland:gap-1">
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
                <div className="font-bold text-xs mland:text-[10px] text-emerald-700 dark:text-emerald-300">🧘 ฟื้นฟูกล้ามเนื้อ &amp; สปา</div>
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">ฟรี · ฟิตคนล้า +{6 + Math.floor(medLv / 2) + stf.physio}% · ขวัญ +2%</div>
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
                <div className="font-bold text-xs mland:text-[10px]">⚽ ลงทีมซ้อมจำลองแผน</div>
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">{avgAllFit < 60 ? 'ทีมล้าเกินไป (ต้องฟิต ≥60%)' : `ฟรี · เข้าใจแผน +${4 + stf.asst}% · ฟิต -3%`}</div>
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
                  onToast(`🩹 กายภาพกลุ่มสำเร็จ! ลดวันเจ็บ ${reduced} คน (-1 นัด) · ฟิต +8%`);
                }}
                className="p-2.5 mland:p-1.5 rounded-xl bg-sky-500/10 border border-sky-500/35 text-left cursor-pointer disabled:opacity-45 hover:border-sky-500 space-y-0.5"
              >
                <div className="font-bold text-xs mland:text-[10px] text-sky-700 dark:text-sky-300">🩹 กายภาพกลุ่ม ({injuredSq.length})</div>
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">{injuredSq.length === 0 ? 'ไม่มีคนเจ็บ' : `${fmtMoney(15)} · ลดวันเจ็บ -1 นัด · ฟิต +8%`}</div>
              </button>
            </div>
          </div>

          {/* Last Training Report */}
          {plan.lastReport && (
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface-2)]/80 border border-[var(--line)] space-y-1 text-xs mland:text-[10px]">
              <div className="flex items-center justify-between font-bold">
                <span>📋 รายงานผลซ้อมล่าสุด (นัดที่ {plan.lastReport.md})</span>
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

        {/* Right: Individual Conditioning & Rest Roster */}
        <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col space-y-2 mland:space-y-1.5 h-full min-h-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div>
              <h3 className="font-bold text-sm mland:text-xs">👥 จัดการรายบุคคล (พักเดี่ยว / ปั้นพิเศษ)</h3>
              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                พักเดี่ยว: ฟิต +10% &amp; ลดเสี่ยงเจ็บ 50% · ปั้นพิเศษ: พัฒนา 2.2x ({restedIndivCount} พักอยู่)
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
                className="px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-[10.5px] mland:text-[9px] font-bold cursor-pointer"
              >
                😴 พักคนที่ล้า &lt;72%
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
                  className="px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                >
                  รีเซ็ต
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-y-auto flex-1 min-h-0">
            {sortedTrainingPlayers.map((q) => {
              const f = Math.round(q.fit ?? 100);
              const isRest = indMap[q.n] === 'REST';
              const isFocus = state.focusPlayer === q.n;
              const isStarter = starters.some((s) => s.n === q.n);
              const fCol = f >= 75 ? 'var(--g)' : f >= 55 ? 'var(--lamp)' : 'var(--red)';
              const fTextCls = f >= 75 ? 'text-[var(--g)]' : f >= 55 ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--red)]';

              return (
                <div key={q.n} className={`px-2.5 py-2 mland:py-1 flex items-center justify-between gap-2 ${isRest ? 'bg-emerald-500/8' : isFocus ? 'bg-[var(--lamp-soft)]/35' : ''}`}>
                  <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer">
                    <PlayerFace player={q} team={me} state={state} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs mland:text-[10px] font-bold truncate flex items-center gap-1">
                        <span className="px-1 rounded bg-[var(--surface-2)] text-[9.5px] font-extrabold shrink-0">{q.ro}</span>
                        <span className="truncate">{q.n}</span>
                        {isStarter && <span className="text-[9px] shrink-0" title="ตัวจริง">⭐</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="w-16 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden shrink-0">
                          <div className="h-full rounded-full" style={{ width: `${f}%`, background: fCol }} />
                        </div>
                        <span className={`text-[10px] mland:text-[8.5px] font-bold tabular ${fTextCls}`}>{f}%</span>
                        <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                          {q.inj > 0 ? `🩹${q.inj}นัด` : `OVR ${q.ov}/${q.pot} · TL ${getPlayerTalent(q, null)}`}
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
                      className={`px-2 py-1 mland:py-0.5 rounded-lg text-[10px] mland:text-[8.5px] font-bold cursor-pointer border ${
                        isRest
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {isRest ? '😴 พักอยู่' : '😴 พัก'}
                    </button>
                    {q.age < 31 && (
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
                        className={`px-2 py-1 mland:py-0.5 rounded-lg text-[10px] mland:text-[8.5px] font-bold cursor-pointer border ${
                          isFocus
                            ? 'bg-[var(--lamp)] text-[#261900] border-[#ca8a04]/40'
                            : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {isFocus ? '🌟 ปั้น' : '⭐ ปั้น'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};


