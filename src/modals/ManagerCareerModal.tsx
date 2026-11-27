import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Award,
  Briefcase,
  Check,
  Crown,
  FastForward,
  Flag,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  Users,
  X
} from 'lucide-react';
import type {
  GameState,
  ManagerJobOffer,
  Mentality,
  NationalTeamMatchRecord,
  Position
} from '../types/game';
import { AR_T, FSD, TN } from '../data/thaiFootballData';
import { clamp, fmtMoney } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import { xi } from '../engine/playerCore';
import { sortTable } from '../engine/simulation';
import {
  appointThailandManager,
  autoPickThailandSquad,
  ensureManagerHistoryInitialized,
  generateManagerJobOffers,
  getManagerRepRankLabel,
  getNationalPlayerPool,
  getNationalTeamEligibility,
  hydrateThailandTeam,
  switchManagerClub
} from '../engine/managerCareer';
import { ClubCrest } from '../components/SvgVisuals';
import { PositionBadge } from '../components/PositionBadge';
import { OvrBadge } from '../components/OvrBadge';
import { WdlRecordBadges } from '../components/WdlBadge';

interface ManagerCareerModalProps {
  state: GameState;
  mode: 'sacked' | 'career' | 'nt';
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onPlayNationalMatch: (fixture: NationalTeamMatchRecord) => void;
  onQuickSimNationalMatch: (fixture: NationalTeamMatchRecord) => void;
  allowQuickSim?: boolean;
  onInspectNationalReport?: (fixture: NationalTeamMatchRecord) => void;
  onRetireToMenu: () => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

const NT_FORMATIONS = ['4-2-3-1', '4-3-3', '4-4-2', '3-5-2', '5-3-2'] as const;

export const ManagerCareerModal: React.FC<ManagerCareerModalProps> = ({
  state,
  mode,
  onUpdateState,
  onPlayNationalMatch,
  onQuickSimNationalMatch,
  allowQuickSim = false,
  onInspectNationalReport,
  onRetireToMenu,
  onClose,
  onToast
}) => {
  const [activeTab, setActiveTab] = useState<'career' | 'nt'>(() => (mode === 'nt' ? 'nt' : 'career'));
  const [confirmOfferTeamId, setConfirmOfferTeamId] = useState<number | null>(null);
  const [ntSubTab, setNtSubTab] = useState<'fixtures' | 'squad'>('fixtures');
  const [swapPickIdx, setSwapPickIdx] = useState<number | null>(null);
  const [replaceTargetIdx, setReplaceTargetIdx] = useState<number | null>(null);
  const [poolPosFilter, setPoolPosFilter] = useState<'ALL' | Position>('ALL');

  const isSacked = mode === 'sacked';
  const curTeam = state.teams[state.me];
  const rep = state.mgrRep ?? 50;
  const repRank = getManagerRepRankLabel(rep);

  const stints = useMemo(() => {
    const base = state.mgrHistory?.length
      ? state.mgrHistory.map((st) => ({ ...st }))
      : ensureManagerHistoryInitialized({ ...state, mgrHistory: [] } as GameState);
    // Sync active stint latest stats dynamically for display
    const active = base.find((st) => st.endReason === 'active');
    if (active && curTeam) {
      active.teamName = curTeam.name;
      active.tier = curTeam.tier;
    }
    return base.slice().reverse();
  }, [state, curTeam]);

  const careerTotals = useMemo(() => {
    return stints.reduce(
      (acc, st) => ({
        matches: acc.matches + st.matches,
        wins: acc.wins + st.wins,
        draws: acc.draws + st.draws,
        losses: acc.losses + st.losses,
        trophies: acc.trophies + st.trophies.length
      }),
      { matches: 0, wins: 0, draws: 0, losses: 0, trophies: 0 }
    );
  }, [stints]);

  const offers = useMemo<ManagerJobOffer[]>(() => {
    return generateManagerJobOffers(state, { mode: isSacked ? 'sacked' : 'market' });
  }, [state, isSacked]);

  const ntElig = useMemo(() => getNationalTeamEligibility(state), [state]);
  const ntState = state.natTeam;

  const ntHydrated = useMemo(() => {
    if (!ntState?.active) return null;
    return hydrateThailandTeam(state, ntState);
  }, [state, ntState]);

  const ntCandidatePool = useMemo(() => {
    if (!ntState?.active || ntSubTab !== 'squad') return [];
    const calledKeys = new Set(ntState.squad.map((m) => `${m.teamId}:${m.playerName}`));
    return getNationalPlayerPool(state)
      .filter((row) => !calledKeys.has(`${row.teamId}:${row.player.n}`))
      .filter((row) => poolPosFilter === 'ALL' || row.player.pos === poolPosFilter)
      .slice(0, 36);
  }, [state, ntState, ntSubTab, poolPosFilter]);

  const handleAcceptClubOffer = (offer: ManagerJobOffer) => {
    SFX.confirm();
    let msg = '';
    onUpdateState((d) => {
      msg = switchManagerClub(d, offer.teamId, {
        reason: isSacked ? 'sacked' : 'transfer',
        timing: 'midseason'
      });
    });
    setConfirmOfferTeamId(null);
    onToast(msg || `เข้ารับตำแหน่งที่ ${offer.teamName} แล้ว!`);
    onClose();
  };

  const handleAppointThailand = () => {
    SFX.celebrate();
    onUpdateState((d) => {
      appointThailandManager(d);
    });
    onToast('🇹🇭 รับตำแหน่งหัวหน้าผู้ฝึกสอนทีมชาติไทยอย่างเป็นทางการแล้ว!');
  };

  const handleSwapNtSlot = (idx: number) => {
    if (!ntState?.active) return;
    if (replaceTargetIdx != null) {
      setReplaceTargetIdx(idx);
      SFX.tap();
      return;
    }
    if (swapPickIdx == null) {
      SFX.tap();
      setSwapPickIdx(idx);
      return;
    }
    if (swapPickIdx === idx) {
      SFX.tap();
      setSwapPickIdx(null);
      return;
    }
    SFX.tap();
    const first = swapPickIdx;
    onUpdateState((d) => {
      if (!d.natTeam) return;
      const arr = d.natTeam.squad.slice();
      if (!arr[first] || !arr[idx]) return;
      const tmp = arr[first];
      arr[first] = arr[idx];
      arr[idx] = tmp;
      d.natTeam.squad = arr;
      d.natTeam.lu = arr.slice(0, 11).map((m) => m.playerName);
    });
    setSwapPickIdx(null);
  };

  const handleCallupReplace = (teamId: number, playerName: string) => {
    if (replaceTargetIdx == null || !ntState?.active) return;
    SFX.confirm();
    const targetIdx = replaceTargetIdx;
    onUpdateState((d) => {
      if (!d.natTeam) return;
      const arr = d.natTeam.squad.slice();
      if (!arr[targetIdx]) return;
      const oldName = arr[targetIdx].playerName;
      arr[targetIdx] = { playerName, teamId };
      d.natTeam.squad = arr;
      d.natTeam.lu = arr.slice(0, 11).map((m) => m.playerName);
      if (d.natTeam.cap === oldName) {
        d.natTeam.cap = arr[0]?.playerName || playerName;
      }
    });
    setReplaceTargetIdx(null);
    onToast(`🇹🇭 เรียก ${playerName.split(' ')[0]} ติดทัพช้างศึกแล้ว!`);
  };

  const nextNtFixture = useMemo(
    () => ntState?.fixtures?.find((f) => !f.played) || null,
    [ntState]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 mland:p-1.5 safe-all overflow-hidden">
      <div className="w-full max-w-4xl mland:max-w-[95vw] max-h-[calc(var(--app-dvh,1dvh)*93)] mland:h-[calc(var(--app-dvh,1dvh)*96)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div
          className={`shrink-0 px-4 py-3 sm:px-5 mland:px-3 mland:py-2 border-b flex items-center justify-between gap-2 ${
            isSacked
              ? 'bg-gradient-to-r from-[#2c0b0e] via-[var(--surface-2)] to-[var(--surface)] border-[var(--red)]/45'
              : activeTab === 'nt'
                ? 'bg-gradient-to-r from-[#112456] via-[#1c2b59] to-[#4f1620] text-white border-blue-400/35'
                : 'bg-[var(--surface-2)] border-[var(--line)]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 mland:w-8 mland:h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isSacked
                  ? 'bg-[var(--red-soft)] text-[var(--red)] border border-[var(--red)]/40'
                  : activeTab === 'nt'
                    ? 'bg-white/12 text-amber-300 border border-white/20'
                    : 'bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/35'
              }`}
            >
              {isSacked ? (
                <AlertTriangle className="w-5 h-5" />
              ) : activeTab === 'nt' ? (
                <Flag className="w-5 h-5" />
              ) : (
                <Briefcase className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm sm:text-base mland:text-xs truncate">
                {isSacked
                  ? 'บอร์ดบริหารมีมติปลดออกจากตำแหน่ง!'
                  : activeTab === 'nt'
                    ? '🇹🇭 ทีมชาติไทย (ทัพช้างศึก)'
                    : '💼 เส้นทางผู้จัดการทีม & ตลาดย้ายงาน'}
              </div>
              <div
                className={`text-[11px] mland:text-[9px] truncate ${
                  activeTab === 'nt' && !isSacked ? 'text-white/80' : 'text-[var(--mut)]'
                }`}
              >
                {state.club?.managerName || 'หัวหน้าผู้ฝึกสอน'} · {repRank} (เครดิต {rep})
                {curTeam ? ` · ${curTeam.name}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isSacked && (
              <div className="seg-bar p-0.5 bg-black/15 border border-white/15">
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setActiveTab('career');
                  }}
                  className={`seg-btn px-2.5 py-1 text-[11px] mland:text-[9.5px] ${
                    activeTab === 'career' ? 'seg-btn-active' : activeTab === 'nt' ? 'text-white/80 hover:text-white' : ''
                  }`}
                >
                  💼 เส้นทาง &amp; ย้ายทีม
                </button>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setActiveTab('nt');
                  }}
                  className={`seg-btn px-2.5 py-1 text-[11px] mland:text-[9.5px] ${
                    activeTab === 'nt' ? 'seg-btn-active' : ''
                  }`}
                >
                  🇹🇭 ทีมชาติไทย
                  {ntState?.active && nextNtFixture && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  )}
                </button>
              </div>
            )}

            {!isSacked && (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onClose();
                }}
                aria-label="ปิดหน้าต่าง"
                className={`btn-icon w-8 h-8 ${activeTab === 'nt' ? 'bg-white/15 text-white border-white/25 hover:bg-white/25' : ''}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 mland:p-2.5 space-y-3.5 mland:space-y-2.5">
          {/* ===================================================== */}
          {/* SACKED RESCUE MODE OR CAREER TAB                      */}
          {/* ===================================================== */}
          {(isSacked || activeTab === 'career') && (
            <>
              {isSacked && (
                <div className="p-3.5 rounded-2xl bg-[var(--red-soft)] border border-[var(--red)]/45 space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm text-[var(--red)]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>ถูกปลดจาก {curTeam?.name || 'สโมสรเดิม'}</span>
                  </div>
                  <p className="text-xs text-[var(--ink)]/90 leading-relaxed">
                    {state.sackReason || 'บอร์ดบริหารไม่พอใจผลงานและมีมติยุติสัญญา'} — แต่ชื่อเสียงโค้ชของคุณยังมีสโมสรอื่นจับตามอง เลือกทีมใหม่ด้านล่างเพื่อเดินหน้าคุมทัพต่อทันที หรือกลับสู่หน้าหลัก
                  </p>
                </div>
              )}

              {/* Career Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mland:gap-1.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--mut)] font-semibold">ระดับกุนซือ</div>
                  <div className="font-extrabold text-xs sm:text-sm text-[var(--g)] truncate">{repRank}</div>
                  <div className="text-[10px] text-[var(--mut)] tabular">เครดิต {rep} แต้ม</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--mut)] font-semibold">คุมทัพสะสม</div>
                  <div className="font-extrabold text-xs sm:text-sm tabular text-[var(--ink)]">
                    {careerTotals.matches} นัด
                  </div>
                  <div className="text-[10px] text-[var(--mut)] tabular pt-0.5 flex items-center">
                    <WdlRecordBadges w={careerTotals.wins} d={careerTotals.draws} l={careerTotals.losses} size="2xs" />
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--mut)] font-semibold">สโมสรที่เคยคุม</div>
                  <div className="font-extrabold text-xs sm:text-sm tabular text-[var(--ink)]">
                    {stints.length} สโมสร
                  </div>
                  <div className="text-[10px] text-[var(--mut)] truncate">
                    ปัจจุบัน: {curTeam?.name || '-'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--mut)] font-semibold">เกียรติยศรวม</div>
                  <div className="font-extrabold text-xs sm:text-sm tabular text-[#b47b00] dark:text-[var(--lamp)]">
                    🏆 {state.trophies?.length || careerTotals.trophies} รายการ
                  </div>
                  <div className="text-[10px] text-[var(--mut)]">
                    {ntState?.active ? '🇹🇭 โค้ชทีมชาติไทย' : 'ระดับสโมสรไทย'}
                  </div>
                </div>
              </div>

              {/* Job Market Offers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-[var(--ink)]">
                    <Briefcase className="w-4 h-4 text-[var(--g)]" />
                    <span>
                      {isSacked ? 'ข้อเสนอรับงานกู้วิกฤตสโมสรใหม่ (เลือกเพื่อคุมทีมต่อ)' : 'ข้อเสนอทาบทามจากสโมสรอื่น (ย้ายทีมได้ทันที)'}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-[var(--mut)] tabular">{offers.length} สโมสร</span>
                </div>

                {offers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] text-xs text-[var(--mut)] text-center">
                    ยังไม่มีข้อเสนอจากสโมสรอื่นในขณะนี้
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {offers.map((offer) => {
                      const targetTeam = state.teams[offer.teamId];
                      const isConfirming = confirmOfferTeamId === offer.teamId;
                      const tierRank =
                        sortTable(state.teams.filter((t) => t.tier === offer.tier)).findIndex(
                          (t) => t.id === offer.teamId
                        ) + 1;
                      const starters = targetTeam ? xi(targetTeam) : [];
                      const avgOvr = starters.length
                        ? Math.round(starters.reduce((sum, p) => sum + p.ov, 0) / starters.length)
                        : 60;
                      const offerBadge =
                        offer.reason === 'rescue'
                          ? 'กอบกู้ทีม'
                          : offer.reason === 'poach'
                            ? 'ดึงตัวข้ามทีม'
                            : 'เปิดรับโค้ช';
                      return (
                        <div
                          key={offer.teamId}
                          className={`p-3 rounded-xl border transition-colors space-y-2 ${
                            isConfirming
                              ? 'bg-[var(--g-soft)] border-[var(--g)]'
                              : 'bg-[var(--surface-2)]/55 border-[var(--line)] hover:border-[var(--g)]/55'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ClubCrest name={offer.teamName} size={36} team={targetTeam} />
                              <div className="min-w-0">
                                <div className="font-bold text-xs sm:text-sm text-[var(--ink)] truncate">
                                  {offer.teamName}
                                </div>
                                <div className="text-[10.5px] text-[var(--mut)] tabular">
                                  {TN[offer.tier]} · อันดับ #{tierRank || '-'} · OVR {avgOvr}
                                </div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-lg bg-[var(--lamp-soft)] border border-[var(--lamp)]/40 text-[10px] font-bold text-[#8a5b00] dark:text-[var(--lamp)] shrink-0">
                              {offerBadge}
                            </span>
                          </div>

                          <div className="text-[10.5px] text-[var(--mut)] leading-snug">
                            {offer.note} · เป้าอันดับ ≤ {offer.targetRank}
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-[var(--line)]/60">
                            <span className="text-[var(--mut)] tabular">
                              งบสโมสรเริ่มต้น: <b className="text-[var(--ink)]">{fmtMoney(offer.budgetK)}</b>
                            </span>
                            {isConfirming ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setConfirmOfferTeamId(null)}
                                  className="btn btn-xs btn-secondary"
                                >
                                  ยกเลิก
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAcceptClubOffer(offer)}
                                  className="btn btn-xs btn-primary"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>ยืนยันรับงาน</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  SFX.tap();
                                  if (isSacked) {
                                    handleAcceptClubOffer(offer);
                                  } else {
                                    setConfirmOfferTeamId(offer.teamId);
                                  }
                                }}
                                className="btn btn-xs btn-gold whitespace-nowrap"
                              >
                                {isSacked ? '✍️ รับงานทีมนี้' : '✍️ ย้ายไปคุมทัพ'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Managerial Stints History */}
              <div className="space-y-2 pt-1 border-t border-[var(--line)]/70">
                <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-[var(--ink)]">
                  <Award className="w-4 h-4 text-[var(--lamp)]" />
                  <span>ประวัติสโมสรที่เคยคุม</span>
                </div>
                <div className="space-y-1.5">
                  {stints.map((st, i) => {
                    const wr = st.matches > 0 ? Math.round((st.wins / st.matches) * 100) : 0;
                    const tmObj = state.teams[st.teamId];
                    const endBadge =
                      st.endReason === 'active'
                        ? 'กำลังคุมทัพ'
                        : st.endReason === 'sacked'
                          ? 'ถูกปลด'
                          : 'ย้ายสโมสร';
                    const endCls =
                      st.endReason === 'active'
                        ? 'bg-[var(--g-soft)] text-[var(--g)] border-[var(--g)]/40'
                        : st.endReason === 'sacked'
                          ? 'bg-[var(--red-soft)] text-[var(--red)] border-[var(--red)]/40'
                          : 'bg-[var(--surface-2)] text-[var(--mut)] border-[var(--line)]';
                    return (
                      <div
                        key={`${st.teamId}-${st.fromSeason}-${i}`}
                        className="p-2.5 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {tmObj ? (
                            <ClubCrest
                              name={st.teamName}
                              size={26}
                              team={tmObj}
                              club={st.teamId === state.me ? state.club : undefined}
                              isMyClub={st.teamId === state.me}
                            />
                          ) : null}
                          <div className="min-w-0">
                            <div className="font-bold text-[var(--ink)] truncate">{st.teamName}</div>
                            <div className="text-[10.5px] text-[var(--mut)] tabular flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <span>
                                {TN[st.tier]} · ซีซั่น {st.fromSeason}
                                {st.toSeason && st.toSeason !== st.fromSeason ? `–${st.toSeason}` : ''} · {st.matches} นัด
                              </span>
                              <WdlRecordBadges w={st.wins} d={st.draws} l={st.losses} size="2xs" />
                              <span>· ชนะ {wr}%</span>
                            </div>
                            {st.trophies.length > 0 && (
                              <div className="text-[10px] font-semibold text-[#b47b00] dark:text-[var(--lamp)] truncate">
                                🏆 {st.trophies.join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold shrink-0 ${endCls}`}>
                          {endBadge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ===================================================== */}
          {/* THAILAND NATIONAL TEAM TAB ('nt')                     */}
          {/* ===================================================== */}
          {!isSacked && activeTab === 'nt' && (
            <>
              {!ntState?.active ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0f1f48] via-[#172855] to-[#3a121b] text-white border border-blue-300/30 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/12 border border-white/25 flex items-center justify-center text-2xl shrink-0">
                      🇹🇭
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
                        สมาคมกีฬาฟุตบอลแห่งประเทศไทยฯ
                      </div>
                      <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                        ตำแหน่งหัวหน้าผู้ฝึกสอนทีมชาติไทยชุดใหญ่
                      </h3>
                      <p className="text-xs text-white/80 mt-0.5">
                        คุมทีมชาติไทยควบคู่กับการคุมสโมสร คัดเลือกนักเตะไทย 23 คน ลงสนามศึกอาเซียน &amp; เอเชียน คัพ แบบ 2D เต็มรูปแบบ!
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/25 border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {ntElig.eligible ? (
                          <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                        ) : (
                          <Shield className="w-4 h-4 text-amber-300 shrink-0" />
                        )}
                        <span>{ntElig.eligible ? 'ผ่านเกณฑ์รับตำแหน่งแล้ว!' : 'เกณฑ์ปลดล็อกทีมชาติไทย'}</span>
                      </div>
                      <div className="text-[11px] text-white/80">
                        {ntElig.reasonText} ({ntElig.progressText})
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!ntElig.eligible}
                      onClick={handleAppointThailand}
                      className={`btn btn-md shrink-0 whitespace-nowrap ${
                        ntElig.eligible
                          ? 'btn-gold'
                          : 'bg-white/10 text-white/45 border border-white/15 cursor-not-allowed'
                      }`}
                    >
                      🇹🇭 รับคุมทีมชาติไทย
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Active Thailand NT Header Summary */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#0e2050] via-[#1b2e64] to-[#4b141f] text-white border border-blue-400/30 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-white/12 border border-white/25 flex items-center justify-center text-2xl shrink-0">
                        🐘
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-sm sm:text-base flex items-center gap-1.5">
                          <span>ช้างศึก ทีมชาติไทย</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-300/40 text-[10px] font-bold text-amber-200">
                            {ntState.formCode || '4-2-3-1'}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/85 tabular flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span>{ntState.matches} นัด</span>
                          <WdlRecordBadges w={ntState.wins} d={ntState.draws} l={ntState.losses} size="2xs" countClassName="text-white" />
                          <span>· ยิง {ntState.gf} เสีย {ntState.ga} · แชมป์ {ntState.trophies.length} รายการ</span>
                        </div>
                      </div>
                    </div>

                    <div className="seg-bar p-0.5 bg-black/25 border border-white/20">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setNtSubTab('fixtures');
                        }}
                        className={`seg-btn px-2.5 py-1 text-[11px] ${
                          ntSubTab === 'fixtures' ? 'seg-btn-active' : 'text-white/80 hover:text-white'
                        }`}
                      >
                        📅 โปรแกรมแข่ง ({ntState.fixtures.filter((f) => !f.played).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setNtSubTab('squad');
                        }}
                        className={`seg-btn px-2.5 py-1 text-[11px] ${
                          ntSubTab === 'squad' ? 'seg-btn-active' : 'text-white/80 hover:text-white'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>ขุมกำลัง 23 แข้ง</span>
                      </button>
                    </div>
                  </div>

                  {/* NT Sub-Tab 1: Fixtures & Trophies */}
                  {ntSubTab === 'fixtures' && (
                    <div className="space-y-3">
                      {ntState.trophies.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-[var(--lamp-soft)]/55 border border-[var(--lamp)]/45 flex flex-wrap items-center gap-2 text-xs">
                          <Trophy className="w-4 h-4 text-[#b47b00] dark:text-[var(--lamp)] shrink-0" />
                          <span className="font-bold text-[var(--ink)]">เกียรติยศช้างศึก:</span>
                          {ntState.trophies.map((t, i) => (
                            <span
                              key={`${t.season}-${i}`}
                              className="px-2 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] font-bold"
                            >
                              ซ.{t.season} · {t.title}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        {ntState.fixtures.map((fx) => {
                          const isNext = nextNtFixture?.id === fx.id;
                          return (
                            <div
                              key={fx.id}
                              className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2.5 ${
                                fx.played
                                  ? 'bg-[var(--surface-2)]/45 border-[var(--line)]'
                                  : isNext
                                    ? 'bg-[var(--g-soft)] border-[var(--g)]/55'
                                    : 'bg-[var(--surface-2)]/70 border-[var(--line)] opacity-85'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-xl shrink-0">{fx.opponentFlag}</span>
                                <div className="min-w-0">
                                  <div className="text-[10.5px] font-bold text-[var(--mut)]">
                                    {fx.compName} · {fx.roundLabel} · {fx.home ? '🏟️ ราชมังคลา (เหย้า)' : '✈️ เยือน'} · ช่วงสัปดาห์ที่ {fx.md}
                                  </div>
                                  <div className="font-bold text-xs sm:text-sm text-[var(--ink)] truncate">
                                    {fx.home ? `🇹🇭 ทีมชาติไทย vs ${fx.opponentName}` : `${fx.opponentName} vs 🇹🇭 ทีมชาติไทย`}
                                    <span className="ml-1.5 text-[10.5px] font-semibold text-[var(--mut)]">
                                      (OVR {fx.opponentOvr})
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {fx.played ? (
                                  <>
                                    <span className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-extrabold text-xs tabular">
                                      {fx.home ? `${fx.gf} - ${fx.ga}` : `${fx.ga} - ${fx.gf}`}
                                      {fx.penText ? ` (${fx.penText})` : ''}
                                    </span>
                                    {fx.report && onInspectNationalReport && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          SFX.tap();
                                          onInspectNationalReport(fx);
                                        }}
                                        className="btn btn-xs btn-secondary"
                                      >
                                        📊 สรุปนัด
                                      </button>
                                    )}
                                  </>
                                ) : isNext ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        SFX.tap();
                                        onPlayNationalMatch(fx);
                                      }}
                                      className="btn btn-xs btn-gold whitespace-nowrap"
                                    >
                                      <Play className="w-3 h-3 fill-current" />
                                      <span>จัดทัพแข่ง 2D</span>
                                    </button>
                                    {allowQuickSim && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          SFX.tap();
                                          onQuickSimNationalMatch(fx);
                                        }}
                                        className="btn btn-xs btn-secondary whitespace-nowrap"
                                        title="จำลองผลการแข่งขันทันที"
                                      >
                                        <FastForward className="w-3 h-3" />
                                        <span>จำลอง</span>
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[10.5px] font-semibold text-[var(--mut)] px-2">
                                    รอแมตช์ก่อนหน้า
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* NT Sub-Tab 2: 23-Man Thai Squad & Tactics */}
                  {ntSubTab === 'squad' && ntHydrated && (
                    <div className="space-y-3">
                      {/* NT Formation & Tactical Mentality Strip */}
                      <div className="p-2.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-[var(--mut)]">ระบบ:</span>
                          {NT_FORMATIONS.map((fm) => (
                            <button
                              key={fm}
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                onUpdateState((d) => {
                                  if (!d.natTeam) return;
                                  d.natTeam.formCode = fm;
                                });
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                                (ntState.formCode || '4-2-3-1') === fm
                                  ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                  : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)]'
                              }`}
                            >
                              {fm}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {(['D', 'B', 'A'] as Mentality[]).map((tac) => (
                            <button
                              key={tac}
                              type="button"
                              onClick={() => {
                                SFX.tap();
                                onUpdateState((d) => {
                                  if (!d.natTeam) return;
                                  d.natTeam.tac = tac;
                                });
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                                (ntState.tac || 'B') === tac
                                  ? 'bg-sky-600 text-white border-sky-500'
                                  : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)]'
                              }`}
                            >
                              {AR_T[tac]}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              onUpdateState((d) => {
                                if (!d.natTeam) return;
                                const best = autoPickThailandSquad(d);
                                d.natTeam.squad = best;
                                d.natTeam.lu = best.slice(0, 11).map((m) => m.playerName);
                              });
                              onToast('🇹🇭 คัดเลือก 23 นักเตะไทยฟอร์มที่ดีที่สุดเรียบร้อย!');
                            }}
                            className="btn btn-xs btn-secondary"
                          >
                            ⚡ คัด 23 คนที่ดีสุด
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-[var(--mut)] flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {swapPickIdx != null
                            ? '👆 แตะนักเตะคนที่ 2 เพื่อสลับตำแหน่ง (11 ตัวจริง / สำรอง)'
                            : replaceTargetIdx != null
                              ? `📢 เลือกนักเตะจากรายชื่อด้านล่างเพื่อเรียกเข้ามาแทน #${replaceTargetIdx + 1}`
                              : 'แตะนักเตะ 2 คนเพื่อสลับตัวจริง-สำรอง หรือกด "เปลี่ยนเรียกตัว" เพื่อเรียกแข้งไทยลีกคนอื่นติดทัพ'}
                        </span>
                        {(swapPickIdx != null || replaceTargetIdx != null) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSwapPickIdx(null);
                              setReplaceTargetIdx(null);
                            }}
                            className="text-[11px] font-bold text-[var(--red)] underline cursor-pointer"
                          >
                            ยกเลิกการเลือก
                          </button>
                        )}
                      </div>

                      {/* 23-Man Roster */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {ntHydrated.sq.map((pl, idx) => {
                          const mem = ntState.squad[idx];
                          const clubName = (mem && state.teams[mem.teamId]?.name) || 'สโมสรไทยลีก';
                          const isStarter = idx < 11;
                          const isCap = ntHydrated.cap === pl.n;
                          const isPickedSwap = swapPickIdx === idx;
                          const isPickedReplace = replaceTargetIdx === idx;
                          const fmtSlots = FSD[ntState.formCode || '4-2-3-1'] || FSD['4-2-3-1'];
                          const slotRole = isStarter ? fmtSlots[idx]?.[0] : pl.ro;
                          return (
                            <div
                              key={`${mem?.teamId ?? idx}-${pl.n}-${idx}`}
                              className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                                isPickedSwap || isPickedReplace
                                  ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]'
                                  : isStarter
                                    ? 'bg-[var(--surface-2)]/75 border-[var(--g)]/35'
                                    : 'bg-[var(--surface-2)]/35 border-[var(--line)]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSwapNtSlot(idx)}
                                className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                              >
                                <span
                                  className={`w-6 text-center text-[10px] font-black tabular rounded px-1 py-0.5 shrink-0 ${
                                    isStarter ? 'bg-[var(--g)] text-white' : 'bg-black/15 text-[var(--mut)]'
                                  }`}
                                >
                                  {isStarter ? `XI` : `สำรอง`}
                                </span>
                                <PositionBadge role={slotRole || pl.ro} size="2xs" />
                                <OvrBadge ov={pl.ov} size="xs" />
                                <div className="min-w-0">
                                  <div className="font-bold text-[var(--ink)] truncate flex items-center gap-1">
                                    {isCap && (
                                      <span className="px-1 rounded bg-amber-400 text-[#261900] text-[9px] font-black">
                                        C
                                      </span>
                                    )}
                                    <span className="truncate">{pl.n}</span>
                                  </div>
                                  <div className="text-[10px] text-[var(--mut)] truncate">{clubName}</div>
                                </div>
                              </button>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  title="ตั้งเป็นกัปตันทีมชาติไทย"
                                  onClick={() => {
                                    SFX.tap();
                                    onUpdateState((d) => {
                                      if (d.natTeam) d.natTeam.cap = pl.n;
                                    });
                                    onToast(`© ตั้ง ${pl.n.split(' ')[0]} เป็นกัปตันทีมชาติไทย`);
                                  }}
                                  className={`p-1 rounded-lg border cursor-pointer ${
                                    isCap
                                      ? 'bg-amber-400 text-[#261900] border-amber-500'
                                      : 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                                  }`}
                                >
                                  <Crown className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  title="เรียกนักเตะคนอื่นเข้ามาแทน"
                                  onClick={() => {
                                    SFX.tap();
                                    setSwapPickIdx(null);
                                    setReplaceTargetIdx((cur) => (cur === idx ? null : idx));
                                  }}
                                  className={`p-1 rounded-lg border cursor-pointer ${
                                    isPickedReplace
                                      ? 'bg-sky-500 text-white border-sky-400'
                                      : 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                                  }`}
                                >
                                  <ArrowLeftRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* National Player Pool Callup Picker */}
                      <div className="p-3 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-xs text-[var(--ink)]">
                            🇹🇭 แข้งไทยลีกฟอร์มเด่น (เลือกเปลี่ยนเข้าแคมป์)
                          </span>
                          <div className="flex items-center gap-1">
                            {(['ALL', 'GK', 'DF', 'MF', 'FW'] as const).map((pos) => (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => setPoolPosFilter(pos)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                                  poolPosFilter === pos
                                    ? 'bg-[var(--g)] text-white border-[var(--g)]'
                                    : 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)]'
                                }`}
                              >
                                {pos === 'ALL' ? 'ทั้งหมด' : pos}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                          {ntCandidatePool.map((cand) => (
                            <div
                              key={`${cand.teamId}:${cand.player.n}`}
                              className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <PositionBadge role={cand.player.ro} size="2xs" />
                                <OvrBadge ov={cand.player.ov} size="xs" />
                                <div className="min-w-0">
                                  <div className="font-bold truncate text-[var(--ink)]">{cand.player.n}</div>
                                  <div className="text-[10px] text-[var(--mut)] truncate">
                                    {cand.teamName} ({TN[cand.tier]})
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={replaceTargetIdx == null}
                                onClick={() => handleCallupReplace(cand.teamId, cand.player.n)}
                                className={`btn btn-xs whitespace-nowrap shrink-0 ${
                                  replaceTargetIdx != null
                                    ? 'btn-primary'
                                    : 'btn-secondary opacity-45 cursor-not-allowed'
                                }`}
                              >
                                + เรียกติดทีม
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3 sm:px-5 bg-[var(--surface-2)] border-t border-[var(--line)] flex items-center justify-between gap-2">
          {isSacked ? (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onRetireToMenu();
              }}
              className="btn btn-md btn-secondary"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ยุติบทบาท · กลับหน้าหลัก</span>
            </button>
          ) : (
            <div className="text-[11px] text-[var(--mut)] truncate">
              คุณสามารถสลับคุมสโมสรใหม่หรือคุมทีมชาติไทยควบคู่ได้ตลอดอาชีพ
            </div>
          )}

          {!isSacked && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              className="btn btn-md btn-primary shrink-0"
            >
              เสร็จสิ้น
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
