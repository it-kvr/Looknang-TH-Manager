import React, { useMemo } from 'react';
import {
  Bookmark,
  Compass,
  Plus,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Trash2,
  Wand2,
  Zap
} from 'lucide-react';
import type { AutoRule, GameState, Mentality, Player, Team } from '../types/game';
import { AR_C, AR_T, FSD, PRE } from '../data/thaiFootballData';
import { clamp } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import {
  autoAssignTeamRoles,
  getFormationCounts,
  getFormationSlots,
  playerPen,
  scoreCaptainCandidate,
  scoreSetPieceCandidate,
  xi
} from '../engine/playerCore';
import { rate } from '../engine/simulation';
import { TacticsMiniPitch } from './SvgVisuals';
import { CaptainBadge } from './CaptainBadge';
import { getStaminaMeta } from './StaminaBar';

interface TacticsBoardPanelProps {
  state: GameState;
  team: Team;
  isMgr: boolean;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onOpenCustomEditor: () => void;
  onGoToLineup?: () => void;
  onToast: (msg: string) => void;
}

const MENTALITY_ORDER: Mentality[] = ['X', 'A', 'B', 'D', 'Z'];
const MENTALITY_HINTS: Record<Mentality, string> = {
  X: 'ดันเกมบุกเต็มสูบ เพิ่มโอกาสยิงประตูแต่เปิดพื้นที่ด้านหลัง',
  A: 'เปิดเกมรุกกดดันต่อเนื่อง สมดุลเอียงไปทางบุก',
  B: 'เล่นตามจังหวะเกมอย่างสมดุลทั้งรุกและรับ',
  D: 'เน้นวินัยเกมรับ รอจังหวะโต้กลับเฉียบคม',
  Z: 'เน้นรัดกุมปิดพื้นที่หน้าประตู รักษาสกอร์เป็นหลัก'
};

const PASS_LABELS = ['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'] as const;
const PRESS_LABELS = ['ต่ำ', 'กลาง', 'สูง'] as const;
const TEMPO_LABELS = ['ช้า', 'กลาง', 'เร็ว'] as const;
const WIDTH_LABELS = ['แคบ', 'กลาง', 'กว้าง'] as const;
const LINE_LABELS = ['ลึก', 'กลาง', 'สูง'] as const;

const FORMATION_STYLE_HINT: Record<string, string> = {
  '4-4-2': 'สมดุลคู่หน้า',
  '4-3-3': 'ปีกบุก 3 ประสาน',
  '4-3-3 (F9)': 'ฟอลส์ไนน์เชื่อมเกม',
  '3-5-2': 'คุมกลางแน่น',
  '4-2-3-1': 'มิดฟิลด์คู่รับ',
  '5-3-2': 'หลัง 5 โต้กลับ',
  '3-4-3': 'เกมรุกกว้าง',
  '5-4-1': 'อุดเกมรับเหนียว',
  '4-4-1-1': 'หน้าต่ำซัพพอร์ต',
  '4-1-2-1-2': 'ไดมอนด์เจาะกลาง'
};

const PRESET_SUBTITLE: Record<string, string> = {
  ติกิตาก้า: 'ครองบอลสั้น · เพรสสูง',
  เพรสซิ่งสูง: 'บีบเร็ว · เร่งจังหวะ',
  เกมสวน: 'หลัง 5 · สวนกลับไว',
  ปิดเกมรับ: 'รับลึก · ปิดพื้นที่',
  บอลยาวปีก: 'เปิดกว้าง · บอลยาว'
};

export const TacticsBoardPanel: React.FC<TacticsBoardPanelProps> = ({
  state,
  team,
  isMgr,
  onUpdateState,
  onOpenCustomEditor,
  onGoToLineup,
  onToast
}) => {
  const starters = useMemo(() => xi(team), [team]);
  const slots = useMemo(() => getFormationSlots(team), [team]);
  const r = useMemo(() => rate(team, state), [team, state]);

  const shapeCounts = useMemo(() => {
    if (team.form === 'custom') {
      const cnt = getFormationCounts(team);
      return { df: cnt[1], mf: cnt[2], fw: cnt[3], label: `${cnt[1]}-${cnt[2]}-${cnt[3]}` };
    }
    const df = slots.filter((z) => z.pos === 'DF').length;
    const mf = slots.filter((z) => z.pos === 'MF').length;
    const fw = slots.filter((z) => z.pos === 'FW').length;
    return { df, mf, fw, label: team.form };
  }, [team, slots]);

  const avgFit = useMemo(
    () => Math.round(starters.reduce((sum, q) => sum + (q.fit ?? 100), 0) / (starters.length || 1)),
    [starters]
  );

  const offPosCount = useMemo(
    () => starters.filter((q, i) => playerPen(q, slots[i]?.sp || '') > 0).length,
    [starters, slots]
  );

  const coachAdvice = useMemo(() => {
    const avgLine = (pos: 'MF' | 'FW' | 'DF') => {
      const idxList = starters
        .map((q, i) => ((slots[i]?.pos || q.pos) === pos ? i : -1))
        .filter((i) => i >= 0);
      return idxList.reduce((sum, i) => sum + starters[i].ov, 0) / (idxList.length || 1);
    };
    const m = avgLine('MF');
    const f = avgLine('FW');
    const d = avgLine('DF');
    const notes: string[] = [];
    if (m > f + 4) notes.push('กองกลางเด่น เหมาะเล่นบอลสั้นคุมจังหวะ');
    if (f > m + 4) notes.push('แนวรุกคม เหมาะเล่นบอลยาวหรือสวนกลับไว');
    if (d < m - 5) notes.push('แนวรับเป็นรอง ไม่ควรดันไลน์รับสูงเกินไป');
    if (starters.some((q) => (q.fit ?? 100) < 60)) notes.push('มีตัวจริงความฟิตต่ำ ควรลดเพรสซิ่งหรือโรเตชั่น');
    if (offPosCount > 0) notes.push(`มีผู้เล่นนอกตำแหน่ง ${offPosCount} คนในชุด 11 ตัวจริง`);
    return notes.join(' · ') || 'โครงสร้างทีมสมดุล สามารถปรับสไตล์บุก-รับได้ตามคู่แข่ง';
  }, [starters, slots, offPosCount]);

  const tacFam = Math.round(team.tacFam ?? 65);
  const famTierCls =
    tacFam >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : tacFam >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

  const captainCandidates = useMemo(
    () =>
      team.sq
        .slice()
        .sort((a, b) => scoreCaptainCandidate(b, state.p) - scoreCaptainCandidate(a, state.p))
        .slice(0, 14),
    [team.sq, state.p]
  );

  const cornerCandidates = useMemo(
    () =>
      team.sq
        .filter((q) => q.pos !== 'GK')
        .slice()
        .sort((a, b) => scoreSetPieceCandidate(b, 'corner', state.p) - scoreSetPieceCandidate(a, 'corner', state.p))
        .slice(0, 14),
    [team.sq, state.p]
  );

  const freekickCandidates = useMemo(
    () =>
      team.sq
        .filter((q) => q.pos !== 'GK')
        .slice()
        .sort((a, b) => scoreSetPieceCandidate(b, 'freekick', state.p) - scoreSetPieceCandidate(a, 'freekick', state.p))
        .slice(0, 14),
    [team.sq, state.p]
  );

  const penaltyCandidates = useMemo(
    () =>
      team.sq
        .filter((q) => q.pos !== 'GK')
        .slice()
        .sort((a, b) => scoreSetPieceCandidate(b, 'penalty', state.p) - scoreSetPieceCandidate(a, 'penalty', state.p))
        .slice(0, 14),
    [team.sq, state.p]
  );

  const activePassIdx = team.pass ?? 1;
  const activePressIdx = team.press ?? 1;
  const activeTempoIdx = team.tempo ?? 1;
  const activeWidIdx = team.wid ?? 1;
  const activeLineIdx = team.line ?? 1;
  const rules = state.rules || [];
  const fitMeta = getStaminaMeta(avgFit);

  return (
    <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Top Header Strip */}
      <div className="shrink-0 px-3.5 sm:px-4 py-2.5 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/35 flex flex-wrap items-center justify-between gap-3 mland:gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="font-extrabold font-display text-sm sm:text-[15px] mland:text-xs text-[var(--ink)] inline-flex items-center gap-1.5 whitespace-nowrap">
              <Compass className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)] shrink-0" />
              <span>แผนเกม &amp; ยุทธวิธี</span>
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs mland:text-[9.5px] text-[var(--mut)] font-semibold tabular-nums whitespace-nowrap">
              <span className="font-extrabold text-[var(--g)]">
                {team.form === 'custom' ? `ปรับเอง ${shapeCounts.label}` : shapeCounts.label}
              </span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="text-[var(--ink)] font-bold">{AR_T[team.tac]}</span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="inline-flex items-center gap-0.5 text-[var(--ink)]">
                <Swords className="w-3 h-3 text-rose-500" />
                {Math.round(r.at)}
              </span>
              <span aria-hidden="true" className="opacity-40">/</span>
              <span className="inline-flex items-center gap-0.5 text-[var(--ink)]">
                <Shield className="w-3 h-3 text-sky-500" />
                {Math.round(r.df)}
              </span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className={`font-bold ${fitMeta.txtCls}`}>ฟิต {avgFit}%</span>
            </div>
          </div>
          <p className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate mt-0.5">
            คำแนะนำโค้ช: {coachAdvice}
          </p>
        </div>

        {/* Familiarity Meter + Lineup Jump */}
        <div className="flex items-center gap-3 mland:gap-2 shrink-0">
          <div className="flex flex-col items-end gap-1 mland:gap-0.5">
            <div className="flex items-center gap-1.5 text-[11px] mland:text-[9px] tabular-nums whitespace-nowrap">
              <span className="text-[var(--mut)] font-semibold">ความเข้าใจแผน</span>
              <span className={`font-extrabold ${famTierCls}`}>{tacFam}%</span>
            </div>
            <div className="w-28 sm:w-32 mland:w-22 h-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--g)] transition-all duration-300"
                style={{ width: `${clamp(tacFam, 8, 100)}%` }}
              />
            </div>
          </div>
          {onGoToLineup && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onGoToLineup();
              }}
              className="btn btn-xs sm:btn-sm btn-secondary whitespace-nowrap shrink-0"
            >
              จัดตัวจริง →
            </button>
          )}
        </div>
      </div>

      {/* Main Content Split */}
      {isMgr ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[345px_1fr] xl:grid-cols-[370px_1fr] mland:grid-cols-[248px_1fr] divide-y md:divide-y-0 md:divide-x mland:divide-y-0 mland:divide-x divide-[var(--line)] overflow-hidden">
          {/* LEFT RAIL: Tactical Pitch, Formations & Quick Slots */}
          <div className="h-full overflow-y-auto p-3.5 sm:p-4 mland:p-2 space-y-4 mland:space-y-2.5 bg-[var(--surface-2)]/15">
            {/* Pitch Stage + Structural Shape */}
            <div className="grid grid-cols-[136px_1fr] sm:grid-cols-[152px_1fr] mland:grid-cols-[112px_1fr] gap-3 mland:gap-2 items-center">
              <div className="rounded-xl overflow-hidden border border-[var(--line)] shadow-xs bg-[#1e6d42]">
                <TacticsMiniPitch team={team} state={state} className="w-full h-auto block" />
              </div>
              <div className="min-w-0 divide-y divide-[var(--line)]/70 text-xs mland:text-[9.5px]">
                <div className="pb-2 mland:pb-1">
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] font-semibold">โครงสร้างผัง</div>
                  <div className="font-display font-extrabold text-base sm:text-lg mland:text-sm text-[var(--ink)] tabular-nums leading-tight mt-0.5">
                    {shapeCounts.label}
                  </div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--g)] font-semibold truncate">
                    {team.form === 'custom' ? 'ผังกำหนดเอง' : FORMATION_STYLE_HINT[team.form] || 'สมดุลทีม'}
                  </div>
                </div>
                <div className="py-2 mland:py-1 grid grid-cols-3 gap-1 text-center tabular-nums">
                  <div>
                    <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">หลัง</div>
                    <div className="font-extrabold text-[var(--ink)]">{shapeCounts.df}</div>
                  </div>
                  <div>
                    <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">กลาง</div>
                    <div className="font-extrabold text-[var(--ink)]">{shapeCounts.mf}</div>
                  </div>
                  <div>
                    <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">หน้า</div>
                    <div className="font-extrabold text-[var(--ink)]">{shapeCounts.fw}</div>
                  </div>
                </div>
                <div className="pt-2 mland:pt-1 flex items-center justify-between gap-1 text-[10.5px] mland:text-[8.5px] tabular-nums">
                  <span className="text-[var(--mut)]">ความตรงตำแหน่ง</span>
                  <span className={`font-bold ${offPosCount > 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                    {offPosCount > 0 ? `หลุด ${offPosCount} คน` : 'ครบ 100%'}
                  </span>
                </div>
              </div>
            </div>

            {/* Formation Picker */}
            <div className="pt-3.5 mland:pt-2 border-t border-[var(--line)] space-y-2 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">ระบบการเล่น</span>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onOpenCustomEditor();
                  }}
                  className={`btn btn-xs whitespace-nowrap shrink-0 ${
                    team.form === 'custom' ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  ✏️ ปรับผังเอง
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mland:gap-1">
                {Object.keys(FSD).map((f) => {
                  const active = team.form === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onUpdateState((d) => {
                          const t = d.teams[d.me];
                          if (t.form !== f) {
                            t.form = f;
                            t.lu = null;
                            t.tacFam = Math.max(40, (t.tacFam ?? 65) - 10);
                          }
                        });
                      }}
                      className={`px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between gap-1 min-w-0 ${
                        active
                          ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-xs'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]/60 hover:bg-[var(--surface-2)]/50'
                      }`}
                    >
                      <span className="text-[11px] mland:text-[9.5px] font-extrabold tabular-nums truncate">
                        {f}
                      </span>
                      <span
                        className={`text-[9px] mland:hidden truncate shrink-0 ${
                          active ? 'text-white/85 font-semibold' : 'text-[var(--mut)]'
                        }`}
                      >
                        {FORMATION_STYLE_HINT[f]?.split(' ')[0] || ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Save / Load Slots */}
            <div className="pt-3.5 mland:pt-2 border-t border-[var(--line)] space-y-2 mland:space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] inline-flex items-center gap-1">
                  <Bookmark className="w-3.5 h-3.5 text-[var(--lamp)]" />
                  <span>ช่องบันทึกแผนด่วน</span>
                </span>
                <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">สลับใช้ทันที</span>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--line)]/70 overflow-hidden">
                {[0, 1].map((idx) => {
                  const savedSlot = state.slots?.[idx];
                  const slotForm = typeof savedSlot?.form === 'string' ? savedSlot.form : '';
                  const slotTac =
                    typeof savedSlot?.tac === 'string' && savedSlot.tac in AR_T ? (savedSlot.tac as Mentality) : null;
                  const slotSummary = savedSlot
                    ? `${slotForm === 'custom' ? 'ปรับเอง' : slotForm || 'แผนบันทึก'}${slotTac ? ` · ${AR_T[slotTac]}` : ''}`
                    : 'ยังไม่มีข้อมูล';
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 mland:px-2 mland:py-1.5"
                    >
                      <div className="min-w-0 flex items-center gap-1.5 text-[11px] mland:text-[9.5px]">
                        <span className="font-extrabold text-[var(--ink)] shrink-0">แผน {idx + 1}</span>
                        <span aria-hidden="true" className="text-[var(--mut)] opacity-40">·</span>
                        <span
                          className={`truncate tabular-nums ${
                            savedSlot ? 'text-[var(--g)] font-bold' : 'text-[var(--mut)]'
                          }`}
                        >
                          {slotSummary}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              const t = d.teams[d.me];
                              d.slots = d.slots || [null, null];
                              d.slots[idx] = {
                                form: t.form,
                                cf: t.cf,
                                tac: t.tac,
                                press: t.press,
                                tempo: t.tempo,
                                wid: t.wid,
                                line: t.line,
                                pass: t.pass
                              };
                            });
                            onToast(`บันทึกแผน ${idx + 1} แล้ว`);
                          }}
                          className="btn btn-xs btn-secondary whitespace-nowrap"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          disabled={!savedSlot}
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              const sl = d.slots?.[idx];
                              if (sl) {
                                Object.assign(d.teams[d.me], sl);
                                d.teams[d.me].lu = null;
                              }
                            });
                            onToast(`โหลดแผน ${idx + 1} แล้ว`);
                          }}
                          className="btn btn-xs btn-primary whitespace-nowrap"
                        >
                          ใช้
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT WORKSPACE: Presets, Tactical Matrix, Roles & Auto Rules */}
          <div className="h-full overflow-y-auto p-3.5 sm:p-4 mland:p-2.5 space-y-4 mland:space-y-2.5">
            {/* Section 1: Tactical Presets */}
            <section className="space-y-2 mland:space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold text-[var(--ink)] inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[var(--lamp)] shrink-0" />
                  <span>ชุดยุทธวิธีสำเร็จรูป</span>
                </h4>
                <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                  เลือกเพื่อปรับทั้งผังและสไตล์การเล่นอัตโนมัติ
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 mland:grid-cols-5 gap-1.5 mland:gap-1">
                {PRE.map(([lbl, cfg]) => {
                  const isActivePreset =
                    team.form === cfg.form &&
                    team.tac === cfg.tac &&
                    activePressIdx === cfg.press &&
                    activeTempoIdx === cfg.tempo &&
                    activeWidIdx === cfg.wid &&
                    activeLineIdx === cfg.line &&
                    activePassIdx === cfg.pass;
                  return (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onUpdateState((d) => {
                          Object.assign(d.teams[d.me], cfg);
                          d.teams[d.me].lu = null;
                        });
                        onToast(`ใช้ยุทธวิธี "${lbl}"`);
                      }}
                      className={`px-2.5 py-2 mland:px-1.5 mland:py-1 rounded-xl mland:rounded-lg border text-left transition-colors cursor-pointer min-w-0 ${
                        isActivePreset
                          ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-xs'
                          : 'bg-[var(--surface-2)]/40 border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]/60 hover:bg-[var(--surface-2)]/75'
                      }`}
                    >
                      <div className="text-[11.5px] mland:text-[9.5px] font-extrabold truncate">{lbl}</div>
                      <div
                        className={`text-[10px] mland:text-[8px] tabular-nums truncate mt-0.5 ${
                          isActivePreset ? 'text-white/85 font-semibold' : 'text-[var(--mut)]'
                        }`}
                      >
                        {cfg.form} · {AR_T[cfg.tac]}
                      </div>
                      <div
                        className={`hidden xl:block text-[9.5px] truncate mt-0.5 ${
                          isActivePreset ? 'text-white/75' : 'text-[var(--mut)]/85'
                        }`}
                      >
                        {PRESET_SUBTITLE[lbl] || ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Section 2: Tactical Controls */}
            <section className="pt-3.5 mland:pt-2 border-t border-[var(--line)] space-y-3 mland:space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold text-[var(--ink)] inline-flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                  <span>จังหวะและมิติการเล่น</span>
                </h4>
                <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
                  {MENTALITY_HINTS[team.tac]}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-2.5 mland:gap-1.5">
                <div>
                  <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] mb-1">
                    สไตล์คุมทีม (Mentality)
                  </div>
                  <div className="seg-bar grid grid-cols-5 w-full">
                    {MENTALITY_ORDER.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            d.teams[d.me].tac = k;
                          });
                        }}
                        className={`seg-btn truncate !px-1 ${team.tac === k ? 'seg-btn-active' : ''}`}
                      >
                        {AR_T[k]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] mb-1">
                    สไตล์การจ่ายบอล
                  </div>
                  <div className="seg-bar grid grid-cols-4 w-full">
                    {PASS_LABELS.map((lbl, idx) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            d.teams[d.me].pass = idx;
                          });
                        }}
                        className={`seg-btn truncate !px-1 ${activePassIdx === idx ? 'seg-btn-active' : ''}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 mland:grid-cols-4 gap-2.5 mland:gap-1.5">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">เพรสซิ่ง</span>
                    {activePressIdx === 2 && (
                      <span className="text-[9.5px] mland:hidden font-semibold text-amber-600 dark:text-amber-400">
                        กินแรงมาก
                      </span>
                    )}
                  </div>
                  <div className="seg-bar grid grid-cols-3 w-full">
                    {PRESS_LABELS.map((lbl, idx) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            d.teams[d.me].press = idx;
                          });
                        }}
                        className={`seg-btn !px-1 ${activePressIdx === idx ? 'seg-btn-active' : ''}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] mb-1">จังหวะเกม</div>
                  <div className="seg-bar grid grid-cols-3 w-full">
                    {TEMPO_LABELS.map((lbl, idx) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            d.teams[d.me].tempo = idx;
                          });
                        }}
                        className={`seg-btn !px-1 ${activeTempoIdx === idx ? 'seg-btn-active' : ''}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] mb-1">ความกว้าง</div>
                  <div className="seg-bar grid grid-cols-3 w-full">
                    {WIDTH_LABELS.map((lbl, idx) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            d.teams[d.me].wid = idx;
                          });
                        }}
                        className={`seg-btn !px-1 ${activeWidIdx === idx ? 'seg-btn-active' : ''}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] mb-1">แนวรับ</div>
                  <div className="seg-bar grid grid-cols-3 w-full">
                    {LINE_LABELS.map((lbl, idx) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            d.teams[d.me].line = idx;
                          });
                        }}
                        className={`seg-btn !px-1 ${activeLineIdx === idx ? 'seg-btn-active' : ''}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Roles & Automatic Rules */}
            <section className="pt-3.5 mland:pt-2 border-t border-[var(--line)] grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr] gap-4 mland:gap-2.5">
              {/* Captain & Set-Pieces */}
              <div className="space-y-2 mland:space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                      <CaptainBadge team={team} state={state} size="sm" />
                      <span className="truncate">กัปตัน &amp; มือสังหารลูกนิ่ง</span>
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      onUpdateState((d) => {
                        autoAssignTeamRoles(d.teams[d.me], { careerP: d.p, forceAll: true });
                      });
                      onToast('AI คัดเลือกกัปตันและมือสังหารลูกนิ่งให้เหมาะสมที่สุดแล้ว');
                    }}
                    className="btn btn-xs btn-secondary whitespace-nowrap shrink-0"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>ตั้งให้อัตโนมัติ</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
                  <div>
                    <label className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] flex items-center gap-1 mb-1 mland:mb-0.5">
                      <CaptainBadge team={team} state={state} size="xs" />
                      <span>กัปตันทีม</span>
                    </label>
                    <select
                      value={team.cap || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateState((d) => {
                          d.teams[d.me].cap = val;
                        });
                        onToast('อัปเดตกัปตันทีมแล้ว');
                      }}
                      className="w-full h-8 mland:h-7 px-2.5 mland:px-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 text-xs mland:text-[10px] font-semibold text-[var(--ink)]"
                    >
                      <option value="">อัตโนมัติ (AI เลือกหน้างาน)</option>
                      {captainCandidates.map((q) => (
                        <option key={q.n} value={q.n}>
                          {q.n} ({q.ro} · OVR {q.ov})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] block mb-1 mland:mb-0.5">
                      🚩 คนเตะมุม
                    </label>
                    <select
                      value={team.setPieces?.corner || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateState((d) => {
                          const tm = d.teams[d.me];
                          tm.setPieces = { ...(tm.setPieces || {}), corner: val || undefined };
                        });
                        onToast('อัปเดตคนเตะมุมแล้ว');
                      }}
                      className="w-full h-8 mland:h-7 px-2.5 mland:px-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 text-xs mland:text-[10px] font-semibold text-[var(--ink)]"
                    >
                      <option value="">อัตโนมัติ (ตามค่าพลังในสนาม)</option>
                      {cornerCandidates.map((q) => (
                        <option key={q.n} value={q.n}>
                          {q.n} ({q.ro} · OVR {q.ov})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] block mb-1 mland:mb-0.5">
                      🎯 คนยิงฟรีคิก
                    </label>
                    <select
                      value={team.setPieces?.freekick || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateState((d) => {
                          const tm = d.teams[d.me];
                          tm.setPieces = { ...(tm.setPieces || {}), freekick: val || undefined };
                        });
                        onToast('อัปเดตคนยิงฟรีคิกแล้ว');
                      }}
                      className="w-full h-8 mland:h-7 px-2.5 mland:px-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 text-xs mland:text-[10px] font-semibold text-[var(--ink)]"
                    >
                      <option value="">อัตโนมัติ (ตามค่าพลังในสนาม)</option>
                      {freekickCandidates.map((q) => (
                        <option key={q.n} value={q.n}>
                          {q.n} ({q.ro} · OVR {q.ov})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] block mb-1 mland:mb-0.5">
                      🥅 เพชฌฆาตจุดโทษ
                    </label>
                    <select
                      value={team.setPieces?.penalty || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateState((d) => {
                          const tm = d.teams[d.me];
                          tm.setPieces = { ...(tm.setPieces || {}), penalty: val || undefined };
                        });
                        onToast('อัปเดตคนยิงจุดโทษแล้ว');
                      }}
                      className="w-full h-8 mland:h-7 px-2.5 mland:px-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 text-xs mland:text-[10px] font-semibold text-[var(--ink)]"
                    >
                      <option value="">อัตโนมัติ (ตามค่าพลังในสนาม)</option>
                      {penaltyCandidates.map((q) => (
                        <option key={q.n} value={q.n}>
                          {q.n} ({q.ro} · OVR {q.ov})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Auto In-Match Rules */}
              <div className="space-y-2 mland:space-y-1.5 min-w-0 xl:pl-4 xl:border-l xl:border-[var(--line)]/80">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold text-[var(--ink)] inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                    <span>กฎปรับแผนอัตโนมัติ</span>
                    <span className="text-[10.5px] font-semibold text-[var(--mut)] tabular-nums">
                      ({rules.length}/3)
                    </span>
                  </h4>
                  {rules.length < 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onUpdateState((d) => {
                          d.rules = [...(d.rules || []), { c: 'tr', min: 65, tac: 'A' }];
                        });
                      }}
                      className="btn btn-xs btn-secondary whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>เพิ่มกฎ</span>
                    </button>
                  )}
                </div>

                {rules.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--line)] px-3 py-3 mland:py-2 text-[11px] mland:text-[9px] text-[var(--mut)]">
                    ยังไม่ได้ตั้งกฎอัตโนมัติ (เช่น ถ้าตามหลัง หลังนาที 65 ให้ปรับเป็นบุกอัตโนมัติ)
                  </div>
                ) : (
                  <div className="rounded-xl border border-[var(--line)] divide-y divide-[var(--line)]/70 bg-[var(--surface-2)]/25 overflow-hidden">
                    {rules.map((rl, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 mland:px-2 mland:py-1 text-xs mland:text-[10px]"
                      >
                        <select
                          value={rl.c}
                          onChange={(e) =>
                            onUpdateState((d) => {
                              if (d.rules?.[idx]) d.rules[idx].c = e.target.value as AutoRule['c'];
                            })
                          }
                          className="h-7 mland:h-6 px-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                        >
                          {Object.entries(AR_C).map(([k, l]) => (
                            <option key={k} value={k}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <span className="text-[var(--mut)] text-[11px]">หลังนาที</span>
                        <select
                          value={rl.min}
                          onChange={(e) =>
                            onUpdateState((d) => {
                              if (d.rules?.[idx]) d.rules[idx].min = Number(e.target.value);
                            })
                          }
                          className="h-7 mland:h-6 px-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold tabular-nums"
                        >
                          {[45, 60, 65, 70, 75, 80].map((m) => (
                            <option key={m} value={m}>
                              {m}&apos;
                            </option>
                          ))}
                        </select>
                        <span className="text-[var(--mut)]">→</span>
                        <select
                          value={rl.tac}
                          onChange={(e) =>
                            onUpdateState((d) => {
                              if (d.rules?.[idx]) d.rules[idx].tac = e.target.value as Mentality;
                            })
                          }
                          className="h-7 mland:h-6 px-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                        >
                          {Object.entries(AR_T).map(([k, l]) => (
                            <option key={k} value={k}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              d.rules = (d.rules || []).filter((_, j) => j !== idx);
                            });
                          }}
                          aria-label="ลบกฎ"
                          title="ลบกฎ"
                          className="ml-auto h-7 w-7 mland:h-6 mland:w-6 inline-flex items-center justify-center rounded-lg text-[var(--red)] hover:bg-[var(--red-soft)] cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : (
        /* PLAYER CAREER READ-ONLY VIEW */
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[240px_1fr] mland:grid-cols-[185px_1fr] divide-y md:divide-y-0 md:divide-x mland:divide-y-0 mland:divide-x divide-[var(--line)] overflow-hidden">
          <div className="p-4 mland:p-2 flex flex-col items-center justify-center gap-2.5 bg-[var(--surface-2)]/15">
            <div className="w-full max-w-[200px] mland:max-w-[140px] rounded-xl overflow-hidden border border-[var(--line)] shadow-xs bg-[#1e6d42]">
              <TacticsMiniPitch team={team} state={state} className="w-full h-auto block" />
            </div>
            <div className="text-center text-xs mland:text-[9.5px] text-[var(--mut)] tabular-nums">
              ระบบทีมปัจจุบัน · <b className="text-[var(--ink)]">{shapeCounts.label}</b>
            </div>
          </div>

          <div className="h-full overflow-y-auto p-4 mland:p-2.5 grid grid-cols-1 lg:grid-cols-2 gap-5 mland:gap-3 content-start">
            <div>
              <h4 className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] pb-2 border-b border-[var(--line)]">
                แนวทางและยุทธวิธีของทีม
              </h4>
              <dl className="divide-y divide-[var(--line)]/65 text-xs mland:text-[10px]">
                {[
                  ['ระบบการเล่น', shapeCounts.label],
                  ['สไตล์คุมทีม', AR_T[team.tac]],
                  ['การจ่ายบอล', PASS_LABELS[activePassIdx]],
                  ['เพรสซิ่ง', PRESS_LABELS[activePressIdx]],
                  ['จังหวะเกม', TEMPO_LABELS[activeTempoIdx]],
                  ['ความกว้าง', WIDTH_LABELS[activeWidIdx]],
                  ['แนวรับ', LINE_LABELS[activeLineIdx]]
                ].map(([label, val]) => (
                  <div key={label} className="py-2 mland:py-1 flex items-center justify-between gap-2">
                    <dt className="text-[var(--mut)] font-medium">{label}</dt>
                    <dd className="font-extrabold text-[var(--ink)] tabular-nums">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h4 className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] pb-2 border-b border-[var(--line)] flex items-center gap-1.5">
                <CaptainBadge team={team} state={state} size="xs" />
                <span>ผู้นำทีมและมือสังหารลูกนิ่ง</span>
              </h4>
              <dl className="divide-y divide-[var(--line)]/65 text-xs mland:text-[10px]">
                {[
                  ['กัปตันทีม', team.cap || 'AI เลือกอัตโนมัติ', Boolean(team.cap && team.cap === state.p?.name)],
                  ['คนเตะมุม', team.setPieces?.corner || 'อัตโนมัติ', Boolean(team.setPieces?.corner && team.setPieces.corner === state.p?.name)],
                  ['คนยิงฟรีคิก', team.setPieces?.freekick || 'อัตโนมัติ', Boolean(team.setPieces?.freekick && team.setPieces.freekick === state.p?.name)],
                  ['เพชฌฆาตจุดโทษ', team.setPieces?.penalty || 'อัตโนมัติ', Boolean(team.setPieces?.penalty && team.setPieces.penalty === state.p?.name)]
                ].map(([label, val, isPlayer]) => (
                  <div key={String(label)} className="py-2 mland:py-1 flex items-center justify-between gap-2">
                    <dt className="text-[var(--mut)] font-medium shrink-0">{label}</dt>
                    <dd className={`font-extrabold truncate ${isPlayer ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                      {val}
                      {isPlayer ? ' (คุณ)' : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
