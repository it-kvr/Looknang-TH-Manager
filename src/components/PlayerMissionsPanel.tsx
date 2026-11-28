import React, { useMemo, useState } from 'react';
import { Calendar, Pin, Sparkles, Table2, LayoutGrid, CheckCircle2 } from 'lucide-react';
import type { Player, Team, GameState, PersonalMissionDef } from '../types/game';
import { clamp } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import {
  statTierMeta,
  statBarColor,
  getPlayerMissionView,
  getSeasonOfMissionsView,
  formatMissionRewardText,
  toggleMissionSeasonPlan,
  autoPlanSeasonMissions
} from '../engine/missions';
import { TalentBadge } from './TalentBadge';

export const StatBarRow: React.FC<{
  label: string;
  value: number;
  boost?: number;
  compact?: boolean;
}> = ({ label, value, boost = 0, compact }) => {
  const activeBoost = Math.max(0, Math.round(boost || 0));
  const baseVal = Math.max(1, Math.round(value) - activeBoost);
  const tier = statTierMeta(value);
  const scaleMax = Math.max(100, value);
  const basePct = clamp(Math.round((baseVal / scaleMax) * 100), 6, 100);
  const totalPct = clamp(Math.round((value / scaleMax) * 100), basePct, 100);
  const boostPct = activeBoost > 0 ? Math.max(3, totalPct - basePct) : 0;
  const adjustedBasePct = boostPct > 0 ? Math.max(4, totalPct - boostPct) : basePct;

  return (
    <div
      title={activeBoost > 0 ? `${label}: พื้นฐาน ${baseVal} + ลูกรัก ${activeBoost} = ${value}` : `${label}: ${value}`}
      className={`flex items-center gap-1.5 sm:gap-2 ${compact ? 'py-[2px] mland:py-[1px]' : 'py-0.5'}`}
    >
      <span className="w-[78px] sm:w-[88px] mland:w-[64px] shrink-0 flex items-center gap-1 truncate text-[11px] mland:text-[9px] text-[var(--ink)]/90 font-medium">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tier.hex }} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <div className="flex-1 min-w-[38px] h-3 sm:h-3.5 mland:h-2.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/75 overflow-hidden flex items-stretch">
        <div
          className="h-full transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
          style={{
            width: `${adjustedBasePct}%`,
            background: statBarColor(baseVal),
            borderRadius: boostPct > 0 ? '9999px 0 0 9999px' : '9999px'
          }}
        />
        {boostPct > 0 && (
          <div
            className="h-full rounded-r-full transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
            style={{
              width: `${boostPct}%`,
              background: 'linear-gradient(90deg, #f43f5e, #fb7185)'
            }}
          />
        )}
      </div>
      <span className="min-w-[26px] mland:min-w-[22px] text-right shrink-0 inline-flex items-baseline justify-end gap-0.5 tabular leading-tight">
        <b className={`text-[11px] mland:text-[9px] font-extrabold ${tier.textClass}`}>
          {value}
        </b>
        {activeBoost > 0 && (
          <span className="text-[9px] mland:text-[7.5px] font-extrabold text-rose-600 dark:text-rose-400">
            +{activeBoost}
          </span>
        )}
      </span>
    </div>
  );
};

type MissionCategoryFilter = 'all' | NonNullable<PersonalMissionDef['category']>;

const CATEGORY_TABS: { key: MissionCategoryFilter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'attack', label: '⚔️ เกมรุก' },
  { key: 'playmaking', label: '🎯 สร้างสรรค์' },
  { key: 'defense', label: '🛡️ เกมรับ' },
  { key: 'gk', label: '🧤 ผู้รักษาประตู' },
  { key: 'physical', label: '🔥 ฟอร์ม & วินัย' }
];

export const PlayerMissionsPanel: React.FC<{
  player: Player;
  team: Team | null;
  state: GameState;
  readOnly?: boolean;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ player, team, state, readOnly = false, onUpdateState, onToast }) => {
  const [panelTab, setPanelTab] = useState<'active' | 'season'>('active');
  const [seasonSubView, setSeasonSubView] = useState<'season' | 'matrix'>('season');
  const [selectedSeason, setSelectedSeason] = useState<number>(() => state.season ?? 1);
  const [showAllPositions, setShowAllPositions] = useState<boolean>(true);
  const [catFilter, setCatFilter] = useState<MissionCategoryFilter>('all');

  const isMe = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
  const careerP = isMe ? state.p : null;
  const { mState, items, talent, passedStages, failedStages } = getPlayerMissionView(player, careerP, state);
  const seasonView = useMemo(
    () => getSeasonOfMissionsView(player, careerP, state, selectedSeason),
    [player, careerP, state, selectedSeason]
  );

  const maxTotal = items.reduce((sum, x) => sum + x.maxStage, 0);
  const subBonusSum = Object.values((isMe ? state.p?.sb : player.sb) || {}).reduce((a, b) => a + b, 0);
  const recentLogs = mState.recentLogs || [];

  const applyMissionStateMutation = (fn: (targetQ: Player, targetCareer: typeof state.p | null) => void) => {
    onUpdateState((draft) => {
      const t = team ? draft.teams[team.id] : draft.teams[draft.me];
      const targetQ = t?.sq.find((x) => x.n === player.n);
      const targetCareer = isMe && draft.p ? draft.p : null;
      if (targetQ) {
        fn(targetQ, targetCareer);
      } else if (targetCareer) {
        const proxyPlayer: Player = { ...player, missions: targetCareer.missions };
        fn(proxyPlayer, targetCareer);
      }
    });
  };

  const handleTogglePin = (missionId: string, missionName: string, targetSeason: number) => {
    SFX.tap();
    let feedback = '';
    applyMissionStateMutation((q, cp) => {
      const res = toggleMissionSeasonPlan(q, targetSeason, missionId, cp, state);
      if (res.maxReached) {
        feedback = `วางแผนได้สูงสุด 6 ภารกิจต่อซีซั่น (ถอดรายการเดิมออกก่อนได้)`;
      } else if (res.pinned) {
        feedback = `ปักหมุด "${missionName}" ลงแผนซีซั่น ${targetSeason} แล้ว (${res.count}/6)`;
      } else {
        feedback = `นำ "${missionName}" ออกจากแผนซีซั่น ${targetSeason} แล้ว`;
      }
    });
    if (feedback) onToast(feedback);
  };

  const handleAutoPlan = (targetSeason: number) => {
    SFX.confirm();
    applyMissionStateMutation((q, cp) => {
      autoPlanSeasonMissions(q, targetSeason, cp, state);
    });
    onToast(`จัดแผนภารกิจแนะนำ 3 รายการสำหรับซีซั่น ${targetSeason} แล้ว`);
  };

  const availableTabs = useMemo(
    () =>
      CATEGORY_TABS.filter(
        (t) => t.key === 'all' || items.some((x) => (x.def.category || 'physical') === t.key)
      ),
    [items]
  );

  const filteredItems = useMemo(
    () =>
      catFilter === 'all'
        ? items
        : items.filter((x) => (x.def.category || 'physical') === catFilter),
    [items, catFilter]
  );

  const filteredSeasonEntries = useMemo(() => {
    return seasonView.entries.filter((e) => {
      if (!showAllPositions && !e.isEligible) return false;
      if (catFilter !== 'all' && (e.def.category || 'physical') !== catFilter) return false;
      return true;
    });
  }, [seasonView.entries, showAllPositions, catFilter]);

  const plannedEntries = useMemo(
    () => seasonView.entries.filter((e) => e.isPlanned),
    [seasonView.entries]
  );

  const curSeasonPlannedIds = seasonView.plannedIds;

  return (
    <div className="space-y-3 mland:space-y-2">
      {/* Header Summary Bar + Top Mode Switch */}
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs sm:text-sm mland:text-xs font-bold flex flex-wrap items-center gap-1.5">
              <span>🎯 ภารกิจสะสมของ {player.n}</span>
              <TalentBadge
                talent={talent}
                variant="default"
                showLabel
                size="xs"
                title="ค่าพรสวรรค์ส่งผลต่อโอกาสอัปพลังสำเร็จเมื่อทำเป้าภารกิจครบ"
              />
            </div>
            <div className="text-[11px] mland:text-[9px] text-[var(--mut)] mt-0.5">
              สะสมได้สูงสุด <b className="text-[var(--ink)]">10 ขั้น</b> · หากสุ่มพลาดความคืบหน้าลดเหลือ <b className="text-[var(--ink)]">70%</b> เพื่อลองใหม่
              {readOnly && (
                <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)] text-[9.5px] font-semibold text-[var(--ink)]">
                  👁️ ทีมอื่น · AI อัปพลังอัตโนมัติหลังแข่ง
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs mland:text-[10px] tabular shrink-0">
            <span className="text-[var(--g)] font-bold">ผ่าน {passedStages}/{maxTotal}</span>
            {failedStages > 0 && <span className="text-[var(--red)] font-bold">เคยพลาด {failedStages}</span>}
            <span className="font-bold text-[var(--ink)]">โบนัส +{subBonusSum}</span>
          </div>
        </div>

        {/* Workspace Mode Segmented Switch */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--line)]/60">
          <div className="seg-bar">
            <button
              type="button"
              onClick={() => { SFX.tap(); setPanelTab('active'); }}
              className={`seg-btn whitespace-nowrap ${panelTab === 'active' ? 'seg-btn-active' : ''}`}
            >
              🎯 ภารกิจเฉพาะสาย ({items.length})
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setPanelTab('season'); }}
              className={`seg-btn whitespace-nowrap flex items-center gap-1 ${panelTab === 'season' ? 'seg-btn-active' : ''}`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>ฤดูกาลแห่งภารกิจ (30)</span>
            </button>
          </div>

          <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular">
            {panelTab === 'season'
              ? `ซีซั่นปัจจุบัน S${seasonView.curSeason} · เหลือเกมลีก ${seasonView.remainingMatches} นัด`
              : `ซีซั่น S${seasonView.curSeason} · ปักหมุดแผน ${curSeasonPlannedIds.length}/6`}
          </div>
        </div>
      </div>

      {panelTab === 'season' ? (
        <div className="space-y-3 mland:space-y-2">
          {/* Season Selector + Sub-view Switch */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {seasonView.availableSeasons.map((sNum) => {
                const active = sNum === seasonView.selectedSeason;
                const isCur = sNum === seasonView.curSeason;
                return (
                  <button
                    key={sNum}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setSelectedSeason(sNum);
                    }}
                    className={`px-2.5 py-1.5 mland:py-1 rounded-lg text-[11px] mland:text-[9px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors tabular ${
                      active
                        ? 'bg-[var(--g)] text-white border-[var(--g)]'
                        : 'bg-[var(--surface-2)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                    }`}
                  >
                    ซีซั่น {sNum}{isCur ? ' · ปัจจุบัน' : ''}
                  </button>
                );
              })}
            </div>

            <div className="seg-bar shrink-0">
              <button
                type="button"
                onClick={() => { SFX.tap(); setSeasonSubView('season'); }}
                className={`seg-btn flex items-center gap-1 whitespace-nowrap ${seasonSubView === 'season' ? 'seg-btn-active' : ''}`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>รายซีซั่น (30)</span>
              </button>
              <button
                type="button"
                onClick={() => { SFX.tap(); setSeasonSubView('matrix'); }}
                className={`seg-btn flex items-center gap-1 whitespace-nowrap ${seasonSubView === 'matrix' ? 'seg-btn-active' : ''}`}
              >
                <Table2 className="w-3 h-3" />
                <span>เทียบข้ามซีซั่น</span>
              </button>
            </div>
          </div>

          {/* Selected Season Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mland:gap-1.5 p-2.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]">
            <div className="space-y-0.5">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">ผ่านขั้นในซีซั่น {seasonView.selectedSeason}</div>
              <div className="text-sm mland:text-xs font-extrabold tabular text-[var(--g)]">
                +{seasonView.seasonSummary.totalPassed} ขั้น
                {seasonView.seasonSummary.totalFailed > 0 && (
                  <span className="ml-1.5 text-[10.5px] font-bold text-[var(--red)]">
                    (พลาด {seasonView.seasonSummary.totalFailed})
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">ผลงานสะสมในซีซั่น</div>
              <div className="text-sm mland:text-xs font-extrabold tabular text-[var(--ink)]">
                {seasonView.seasonSummary.totalEarnedActions.toLocaleString()}
                <span className="ml-1 text-[10px] font-medium text-[var(--mut)]">
                  ({seasonView.playedInSelectedSeason} นัด)
                </span>
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">แผนที่ปักหมุด</div>
              <div className="text-sm mland:text-xs font-extrabold tabular text-[var(--ink)]">
                {seasonView.seasonSummary.plannedCount}/6 รายการ
                {seasonView.selectedSeason === seasonView.curSeason && seasonView.seasonSummary.plannedCount > 0 && (
                  <span className="ml-1 text-[10px] font-semibold text-[var(--g)]">
                    (ทัน {seasonView.seasonSummary.plannedOnTrackCount})
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">สถานการณ์ซีซั่น</div>
              <div className="text-sm mland:text-xs font-extrabold tabular text-[var(--ink)]">
                {seasonView.selectedSeason === seasonView.curSeason
                  ? seasonView.remainingMatches > 0
                    ? `เหลือ ${seasonView.remainingMatches} นัด`
                    : 'ครบโปรแกรมลีก'
                  : seasonView.seasonSummary.teamName || `จบซีซั่น ${seasonView.selectedSeason}`}
              </div>
            </div>
          </div>

          {/* Season Long-Term Planner Focus Box */}
          <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/50 border border-[var(--line)] space-y-2 mland:space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs mland:text-[10.5px] font-bold flex flex-wrap items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                  <span>แผนทำภารกิจซีซั่น {seasonView.selectedSeason} (ปักหมุดได้สูงสุด 6 รายการ)</span>
                  {seasonView.isAutoPlanned && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[var(--g-soft)] border border-[var(--g)]/35 text-[var(--g)] text-[9.5px] mland:text-[8px] font-bold">
                      ✨ เลือกให้อัตโนมัติ
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                  ระบบเลือก 3 ภารกิจที่เหมาะกับตำแหน่งให้เองเมื่อยังไม่ได้ปักหมุด · ปรับ/ปักหมุดเพิ่มหรือนำออกได้อิสระ
                </div>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleAutoPlan(seasonView.selectedSeason)}
                  className="px-2.5 py-1.5 mland:py-1 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/40 text-[var(--g)] text-[10.5px] mland:text-[8.5px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer hover:bg-[var(--g)] hover:text-white transition-colors"
                >
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>จัด 3 เป้าหมายอัตโนมัติใหม่</span>
                </button>
              )}
            </div>

            {plannedEntries.length === 0 ? (
              <div className="text-[11px] mland:text-[9px] text-[var(--mut)] py-1 flex flex-wrap items-center gap-2">
                <span>
                  {readOnly
                    ? `ยังไม่มีภารกิจที่ปักหมุดในซีซั่น ${seasonView.selectedSeason}`
                    : <>ยังไม่ได้เลือกภารกิจในแผนซีซั่น {seasonView.selectedSeason} — กด <b className="text-[var(--ink)]">"☆ ปักหมุด"</b> ด้านล่าง</>}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleAutoPlan(seasonView.selectedSeason)}
                    className="px-2 py-0.5 rounded-md bg-[var(--g)] text-white font-bold text-[10px] cursor-pointer hover:brightness-110"
                  >
                    ✨ ให้ระบบเลือกให้เลย (3 รายการ)
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mland:gap-1.5">
                {plannedEntries.map((e) => (
                  <div
                    key={e.def.id}
                    className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col justify-between gap-1.5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <div className="text-[11.5px] mland:text-[9.5px] font-bold truncate">
                            {e.def.icon} {e.def.name}
                          </div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                            ขั้น {e.completedAll ? `${e.maxStage}/${e.maxStage}` : `${e.stage + 1}/${e.maxStage}`} · ซีซั่นนี้ +{e.seasonEarned.toLocaleString()} {e.def.unit}
                          </div>
                        </div>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleTogglePin(e.def.id, e.def.name, seasonView.selectedSeason)}
                            className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] hover:text-[var(--red)] whitespace-nowrap shrink-0 cursor-pointer px-1.5 py-0.5 rounded hover:bg-[var(--red-soft)]"
                          >
                            นำออก
                          </button>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] mland:text-[8.5px] tabular">
                          <span className="text-[var(--mut)]">
                            {e.completedAll
                              ? 'ครบทั้ง 10 ขั้นแล้ว'
                              : `สะสม ${e.curVal.toLocaleString()} / ${e.target.toLocaleString()}`}
                          </span>
                          <b className="text-[var(--g)]">{e.pct}%</b>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                          <div className="h-full rounded-full bg-[var(--g)]" style={{ width: `${e.pct}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="text-[9.5px] mland:text-[8px] leading-snug space-y-0.5">
                      <div className={`font-bold tabular ${e.completedAll || e.onTrackThisSeason ? 'text-[var(--g)]' : 'text-[#9a6700] dark:text-[var(--lamp)]'}`}>
                        {e.completedAll
                          ? '🏆 ปลดล็อกครบทุกขั้นแล้ว'
                          : e.neededForNext === 0
                            ? `✨ ครบเป้าแล้ว (รอลุ้นสุ่ม ${e.successChance}%)`
                            : e.estMatchesLeft != null
                              ? `${e.onTrackThisSeason ? '✓ ทันในซีซั่นนี้' : '⏳ แผนข้ามซีซั่น'} · อัตรา ${e.pacePerMatch}/นัด (~${e.estMatchesLeft} นัด)`
                              : `ยังต้องการอีก ${e.neededForNext.toLocaleString()} ${e.def.unit}`}
                      </div>
                      <div className="text-[var(--mut)] truncate" title={e.trainingHint}>
                        💡 {e.trainingHint}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filter Row for 30 Missions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {CATEGORY_TABS.map((t) => {
                const cnt = seasonView.entries.filter(
                  (e) => (showAllPositions || e.isEligible) && (t.key === 'all' || (e.def.category || 'physical') === t.key)
                ).length;
                const active = catFilter === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setCatFilter(t.key);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] mland:text-[8.5px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                      active
                        ? 'bg-[var(--g)] text-white border-[var(--g)]'
                        : 'bg-[var(--surface-2)]/70 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {t.label} ({cnt})
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setShowAllPositions((v) => !v);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] mland:text-[8.5px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                showAllPositions
                  ? 'bg-[var(--g-soft)] border-[var(--g)]/50 text-[var(--g)]'
                  : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]'
              }`}
            >
              {showAllPositions ? '✓ แสดงครบทั้ง 30 ภารกิจ' : `เฉพาะตำแหน่ง ${player.pos} (${seasonView.seasonSummary.eligibleCount})`}
            </button>
          </div>

          {seasonSubView === 'season' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mland:gap-1.5">
              {filteredSeasonEntries.map((entry) => {
                const {
                  def,
                  isEligible,
                  stage,
                  maxStage,
                  completedAll,
                  target,
                  curVal,
                  pct,
                  neededForNext,
                  seasonEarned,
                  seasonPassed,
                  seasonFailed,
                  pacePerMatch,
                  estMatchesLeft,
                  onTrackThisSeason,
                  isPlanned,
                  successChance
                } = entry;

                return (
                  <div
                    key={def.id}
                    className={`p-2.5 mland:p-2 rounded-xl border flex flex-col justify-between gap-2 transition-colors ${
                      isPlanned
                        ? 'bg-[var(--g-soft)]/35 border-[var(--g)]/55'
                        : isEligible
                          ? 'bg-[var(--surface-2)]/70 border-[var(--line)]'
                          : 'bg-[var(--surface-2)]/35 border-[var(--line)]/60 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs mland:text-[10.5px] font-bold flex items-center gap-1.5 truncate">
                          <span>{def.icon} {def.name}</span>
                        </div>
                        <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] flex flex-wrap items-center gap-1 mt-0.5">
                          <span className={isEligible ? 'text-[var(--g)] font-semibold' : ''}>
                            {isEligible
                              ? `สายตรง ${player.pos}`
                              : `เฉพาะ ${def.posFilter?.join('/') || 'ทุกตำแหน่ง'}`}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular">
                            {completedAll ? `ครบ ${maxStage}/${maxStage} ขั้น` : `ขั้น ${stage + 1}/${maxStage}`}
                          </span>
                          {seasonPassed > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[var(--g)] font-bold tabular">ซีซั่นนี้ +{seasonPassed} ขั้น</span>
                            </>
                          )}
                          {seasonFailed > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[var(--red)] font-bold tabular">พลาด {seasonFailed}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePin(def.id, def.name, seasonView.selectedSeason)}
                          className={`px-2 py-1 rounded-lg text-[10px] mland:text-[8.5px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                            isPlanned
                              ? 'bg-[var(--g)] text-white border-[var(--g)]'
                              : 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--g)]'
                          }`}
                        >
                          {isPlanned ? '★ ในแผน' : '☆ ปักหมุด'}
                        </button>
                      ) : isPlanned ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] mland:text-[8.5px] font-bold bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/35 shrink-0">
                          ★ ในแผน
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[8.5px] tabular">
                        <span className="text-[var(--mut)]">
                          ซีซั่น {seasonView.selectedSeason}:{' '}
                          <b className="text-[var(--ink)]">+{seasonEarned.toLocaleString()} {def.unit}</b>
                          {pacePerMatch > 0 && (
                            <span className="ml-1 text-[9.5px] opacity-80">({pacePerMatch}/นัด)</span>
                          )}
                        </span>
                        <span className="text-[var(--mut)]">
                          สะสม <b className="text-[var(--ink)]">{curVal.toLocaleString()}</b>/{target.toLocaleString()}{' '}
                          <b className="text-[var(--g)]">({pct}%)</b>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            background: isEligible ? 'var(--g)' : 'var(--mut)'
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1 text-[9.5px] mland:text-[8px] tabular text-[var(--mut)]">
                      {!isEligible ? (
                        <span>ภารกิจเฉพาะตำแหน่ง {def.posFilter?.join('/')}</span>
                      ) : completedAll ? (
                        <span className="text-[var(--g)] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> ปลดล็อกครบ 10 ขั้นแล้ว
                        </span>
                      ) : neededForNext === 0 ? (
                        <span className="text-[var(--g)] font-bold">
                          ครบเป้าแล้ว · รอลุ้นอัปพลัง ({successChance}%)
                        </span>
                      ) : estMatchesLeft != null ? (
                        <span className={onTrackThisSeason ? 'text-[var(--g)] font-semibold' : ''}>
                          {onTrackThisSeason ? 'ทันเป้าซีซั่นนี้' : 'สะสมข้ามซีซั่น'} · คาดจบขั้น {stage + 1} ใน ~{estMatchesLeft} นัด
                        </span>
                      ) : (
                        <span>ต้องการอีก {neededForNext.toLocaleString()} {def.unit} เพื่อลุ้นขั้น {stage + 1}</span>
                      )}
                      {!completedAll && isEligible && (
                        <span>โอกาส {successChance}%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Cross-Season Matrix View (All 30 Missions x Every Season) */
            <div className="border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] mland:text-[9px] tabular">
                  <thead>
                    <tr className="bg-[var(--surface-2)] border-b border-[var(--line)] text-[var(--mut)]">
                      <th className="sticky left-0 z-10 bg-[var(--surface-2)] px-2.5 py-2 font-bold min-w-[170px] border-r border-[var(--line)]/60">
                        ภารกิจ (30 รายการ)
                      </th>
                      {seasonView.availableSeasons.map((sNum) => (
                        <th
                          key={sNum}
                          className={`px-2 py-2 text-center font-bold whitespace-nowrap min-w-[66px] ${
                            sNum === seasonView.selectedSeason ? 'text-[var(--g)] bg-[var(--g-soft)]/60' : ''
                          }`}
                        >
                          S{sNum}
                        </th>
                      ))}
                      <th className="px-2.5 py-2 text-right font-bold whitespace-nowrap min-w-[92px] border-l border-[var(--line)]/60">
                        ขั้น / สะสม
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]/60">
                    {filteredSeasonEntries.map((entry) => {
                      const { def, isEligible, stage, maxStage, completedAll, curVal, target, isPlanned } = entry;
                      return (
                        <tr
                          key={def.id}
                          className={`${
                            isPlanned
                              ? 'bg-[var(--g-soft)]/25'
                              : isEligible
                                ? 'hover:bg-[var(--surface-2)]/50'
                                : 'opacity-65 bg-[var(--surface-2)]/20'
                          }`}
                        >
                          <td className="sticky left-0 z-10 bg-[var(--surface)] px-2.5 py-1.5 border-r border-[var(--line)]/60">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="min-w-0">
                                <div className="font-bold truncate max-w-[145px]" title={def.name}>
                                  {def.icon} {def.name}
                                </div>
                                <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">
                                  {isEligible ? def.unit : `เฉพาะ ${def.posFilter?.join('/')}`}
                                </div>
                              </div>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePin(def.id, def.name, seasonView.selectedSeason)}
                                  title={isPlanned ? 'นำออกจากแผนซีซั่น' : 'ปักหมุดเข้าแผนซีซั่น'}
                                  className={`text-[11px] px-1 py-0.5 rounded cursor-pointer shrink-0 ${
                                    isPlanned ? 'text-[var(--g)] font-bold' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                                  }`}
                                >
                                  {isPlanned ? '★' : '☆'}
                                </button>
                              )}
                            </div>
                          </td>
                          {seasonView.availableSeasons.map((sNum) => {
                            const cell = seasonView.getCellForSeason(def.id, def.metric, sNum);
                            return (
                              <td
                                key={sNum}
                                className={`px-2 py-1.5 text-center whitespace-nowrap ${
                                  sNum === seasonView.selectedSeason ? 'bg-[var(--g-soft)]/20' : ''
                                }`}
                              >
                                {cell.earned > 0 || cell.passed > 0 || cell.failed > 0 ? (
                                  <div className="leading-tight">
                                    <div className="font-bold text-[var(--ink)]">+{cell.earned.toLocaleString()}</div>
                                    {cell.passed > 0 && (
                                      <div className="text-[9px] text-[var(--g)] font-extrabold">▲+{cell.passed}</div>
                                    )}
                                    {cell.failed > 0 && (
                                      <div className="text-[9px] text-[var(--red)] font-bold">✕{cell.failed}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[var(--mut)]/50">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap border-l border-[var(--line)]/60">
                            <div className={`font-extrabold ${completedAll ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                              {completedAll ? `🏆 ${maxStage}/${maxStage}` : `ขั้น ${stage}/${maxStage}`}
                            </div>
                            <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">
                              {curVal.toLocaleString()}/{target.toLocaleString()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {availableTabs.length > 2 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {availableTabs.map((t) => {
                const cnt = t.key === 'all' ? items.length : items.filter((x) => (x.def.category || 'physical') === t.key).length;
                const active = catFilter === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setCatFilter(t.key);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] mland:text-[8.5px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                      active
                        ? 'bg-[var(--g)] text-white border-[var(--g)]'
                        : 'bg-[var(--surface-2)]/70 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {t.label} ({cnt})
                  </button>
                );
              })}
            </div>
          )}

          {recentLogs.length > 0 && (
            <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)]/80 space-y-1">
              <div className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)]">📜 ผลการอัปพลังล่าสุด</div>
              <div className="flex flex-wrap gap-1.5">
                {recentLogs.slice(0, 4).map((lg, idx) => (
                  <span
                    key={`${lg.missionId}-${lg.stage}-${idx}`}
                    className={`px-2 py-0.5 rounded-md text-[10px] mland:text-[8.5px] font-semibold border ${
                      lg.success
                        ? 'bg-[var(--g-soft)] border-[var(--g)]/40 text-[var(--g)]'
                        : 'bg-[var(--red-soft)] border-[var(--red)]/35 text-[var(--red)]'
                    }`}
                  >
                    {lg.season ? `[S${lg.season}] ` : ''}
                    {lg.success ? '✓' : '✕'} {lg.icon} {lg.missionName} ขั้น {lg.stage} ({lg.chance}%)
                    {lg.success && lg.rewardText ? ` · ${lg.rewardText}` : ' · ถอยเหลือ 70% ลองใหม่ได้'}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mland:gap-1.5">
            {filteredItems.map(({ def, stage, maxStage, completedAll, target, curVal, pct, nextRewards, nextCoreAmt, successChance, stageOutcomes }) => {
              const isPlannedThisSeason = curSeasonPlannedIds.includes(def.id);
              const curSeasonEntry = seasonView.entries.find((x) => x.def.id === def.id);
              const seasonEarnedCur = seasonView.selectedSeason === seasonView.curSeason ? (curSeasonEntry?.seasonEarned || 0) : seasonView.getCellForSeason(def.id, def.metric, seasonView.curSeason).earned;

              return (
                <div
                  key={def.id}
                  className={`p-3 mland:p-2 rounded-2xl mland:rounded-xl border flex flex-col justify-between gap-2 mland:gap-1.5 transition-colors ${
                    isPlannedThisSeason
                      ? 'bg-[var(--g-soft)]/30 border-[var(--g)]/55'
                      : 'border-[var(--line)] bg-[var(--surface-2)]/70'
                  }`}
                >
                  <div className="space-y-1.5 mland:space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-xs mland:text-[10.5px] truncate flex items-center gap-1.5">
                          <span>{def.icon} {def.name}</span>
                        </div>
                        <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug">{def.desc}</div>
                      </div>
                      <div className="flex items-start gap-1.5 shrink-0">
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleTogglePin(def.id, def.name, seasonView.curSeason)}
                            title={isPlannedThisSeason ? `อยู่ในแผนซีซั่น ${seasonView.curSeason}` : `ปักหมุดเข้าแผนซีซั่น ${seasonView.curSeason}`}
                            className={`px-1.5 py-0.5 rounded text-[10px] mland:text-[8.5px] font-bold border cursor-pointer transition-colors ${
                              isPlannedThisSeason
                                ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                : 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {isPlannedThisSeason ? '★' : '☆'}
                          </button>
                        )}
                        <div className="grid grid-cols-5 gap-0.5 pt-0.5" title={`ประวัติ ${maxStage} ขั้น`}>
                          {Array.from({ length: maxStage }, (_, idx) => {
                            const out = stageOutcomes[idx] || (idx < stage ? 'ok' : undefined);
                            const isCur = !completedAll && idx === stage;
                            return (
                              <span
                                key={idx}
                                className={`w-3.5 h-3.5 rounded text-[8.5px] font-extrabold flex items-center justify-center tabular border ${
                                  out === 'ok'
                                    ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                    : out === 'fail'
                                      ? 'bg-[var(--red-soft)] text-[var(--red)] border-[var(--red)]/50'
                                      : isCur
                                        ? 'bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] border-[var(--lamp)]'
                                        : 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)]'
                                }`}
                              >
                                {out === 'ok' ? '✓' : out === 'fail' ? '↻' : idx + 1}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] mland:text-[9px] tabular">
                        <span className="text-[var(--mut)]">
                          {completedAll ? (
                            <b className="text-[var(--g)]">สะสมครบ {curVal.toLocaleString()} {def.unit} แล้ว</b>
                          ) : (
                            <>ความคืบหน้า: <b className="text-[var(--ink)]">{curVal.toLocaleString()} / {target.toLocaleString()}</b> {def.unit}</>
                          )}
                        </span>
                        <b className="text-[var(--g)]">{pct}%</b>
                      </div>
                      <div className="h-2 mland:h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, background: 'var(--g)' }}
                        />
                      </div>
                    </div>

                    {!completedAll && (
                      <div className="text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--g)] leading-snug">
                        ลุ้นรับขั้น {stage + 1}: {formatMissionRewardText(nextRewards, def.coreReward, nextCoreAmt)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-0.5 text-[10px] mland:text-[8.5px] font-bold tabular text-[var(--mut)]">
                    {!completedAll ? (
                      <>
                        <span>
                          ขั้น {stage + 1}/{maxStage} · S{seasonView.curSeason} +{seasonEarnedCur.toLocaleString()}
                        </span>
                        <span>
                          โอกาสสำเร็จ: <b className="text-[var(--ink)]">{successChance}%</b>
                        </span>
                      </>
                    ) : (
                      <span className="ml-auto text-[var(--g)]">
                        🏆 จบครบทั้ง {maxStage} ขั้นแล้ว
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
