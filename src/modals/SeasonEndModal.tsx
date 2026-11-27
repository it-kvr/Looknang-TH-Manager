import React, { useEffect, useMemo } from 'react';
import {
  Award,
  BarChart3,
  Crown,
  PartyPopper,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy
} from 'lucide-react';
import type { GameState, Player, TrophyRecord } from '../types/game';
import { TN } from '../data/thaiFootballData';
import { SFX, triggerConfetti } from '../utils/audioTheme';
import { finishSeasonComputation, ensureTeamFans, fmtFans } from '../engine/simulation';
import { xi } from '../engine/playerCore';
import { generateManagerJobOffers } from '../engine/managerCareer';
import { fmtMoney } from '../utils/math';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { TrophySvg } from '../components/ClubHistoryPanel';
import { StatIconBadge } from '../components/StatIconBadge';

export type SeasonSummaryData = ReturnType<typeof finishSeasonComputation>;

type CelebrationLevel = 'grand' | 'promotion' | 'elite' | 'steady' | 'relegated';

export const SeasonEndModal: React.FC<{
  state: GameState;
  summary: SeasonSummaryData;
  onOpenSeasonStats?: () => void;
  onStartNextSeason: (transferToTeamId?: number) => void;
}> = ({ state, summary, onOpenSeasonStats, onStartNextSeason }) => {
  const me = state.teams[state.me];

  const arc = summary.archive;
  const trophiesWon: TrophyRecord[] = useMemo(() => {
    const fromSummary = summary.trophiesWon || [];
    if (fromSummary.length > 0) return fromSummary;
    return (state.trophies || []).filter((tr) => tr.season === state.season);
  }, [summary.trophiesWon, state.trophies, state.season]);

  const managerOffers = useMemo(
    () => (state.mode === 'm' ? generateManagerJobOffers(state, { mode: state.sack === 1 ? 'sacked' : 'season_end' }) : []),
    [state]
  );

  const wonCup = summary.cupStatus === 'แชมป์ถ้วย';
  const wonAsia = summary.asiaStatus === 'แชมป์ถ้วยทวีป';
  const wonLc = summary.leagueCupStatus === 'แชมป์ไทยลีก คัพ';
  const wonSc = summary.superCupStatus === 'แชมป์แชมเปี้ยนส์ คัพ';
  const wonDc = summary.divCupStatus === 'แชมป์ถ้วยดิวิชั่น';
  const majorTrophyCount =
    (summary.ch ? 1 : 0) + (wonCup ? 1 : 0) + (wonAsia ? 1 : 0) + (wonLc ? 1 : 0) + (wonSc ? 1 : 0) + (wonDc ? 1 : 0);
  const isPromoted = summary.nt > summary.mt;
  const isRelegated = summary.nt < summary.mt;
  const metBoardGoal = state.mode === 'm' && state.obj != null && summary.pos <= state.obj;
  const isTopFinish = summary.pos <= 3 || (summary.totalTeams >= 12 && summary.pos <= 4);
  const isSolidUpper = summary.pos <= Math.max(4, Math.ceil(summary.totalTeams * 0.3));
  const wonNtCallup = trophiesWon.some((tr) => tr.type === 'nt');
  const playerSuccess = state.mode === 'p' && (wonNtCallup || isTopFinish || isPromoted);

  const celebrationLevel: CelebrationLevel =
    state.sack === 1 || isRelegated
      ? 'relegated'
      : majorTrophyCount >= 1
        ? 'grand'
        : isPromoted
          ? 'promotion'
          : isTopFinish || metBoardGoal || playerSuccess || isSolidUpper
            ? 'elite'
            : 'steady';

  const isCelebration =
    celebrationLevel === 'grand' || celebrationLevel === 'promotion' || celebrationLevel === 'elite';

  useEffect(() => {
    if (celebrationLevel === 'grand' || celebrationLevel === 'promotion') {
      SFX.celebrate();
      triggerConfetti(1);
    } else if (celebrationLevel === 'elite') {
      SFX.win();
      SFX.cheer(0.75);
      triggerConfetti(1);
    } else {
      SFX.whistle();
    }
  }, [celebrationLevel, summary]);

  const replayCelebration = () => {
    if (celebrationLevel === 'grand' || celebrationLevel === 'promotion') {
      SFX.celebrate();
      triggerConfetti(1);
    } else {
      SFX.win();
      SFX.cheer(0.8);
      triggerConfetti(1);
    }
  };

  const findSquadPlayer = (name?: string | null): Player | null => {
    if (!name) return null;
    return me.sq.find((q) => q.n === name) || null;
  };

  const headlineTitle = useMemo(() => {
    if (state.sack === 1) return 'สิ้นสุดภารกิจคุมทีม';
    if (majorTrophyCount >= 4) return 'กวาดแชมป์ถล่มทลายประวัติศาสตร์!';
    if (majorTrophyCount === 3) return 'ทริปเปิลแชมป์ประวัติศาสตร์!';
    if (majorTrophyCount === 2) return 'ดับเบิลแชมป์สุดยิ่งใหญ่!';
    if (wonAsia) return 'เจ้ายุทธจักรลูกหนังทวีป!';
    if (summary.ch && isPromoted) return `แชมป์ ${TN[summary.mt]} & เลื่อนชั้น!`;
    if (summary.ch) return `แชมป์ ${TN[summary.mt]} อย่างยิ่งใหญ่!`;
    if (wonCup) return 'คว้าแชมป์ถ้วยประชาชน!';
    if (wonLc) return 'คว้าแชมป์ไทยลีก คัพ!';
    if (wonDc) return 'คว้าแชมป์ถ้วยดิวิชั่น & ภูมิภาค!';
    if (wonSc) return 'คว้าแชมป์ไทยแลนด์ แชมเปี้ยนส์ คัพ!';
    if (isPromoted) return `เลื่อนชั้นสู่ ${TN[summary.nt]} สำเร็จ!`;
    if (summary.pos <= 3) return `จบอันดับ ${summary.pos} บนโพเดียมลีก!`;
    if (metBoardGoal) return 'บรรลุเป้าหมายบอร์ดบริหาร!';
    if (wonNtCallup) return 'ก้าวสู่ทัพช้างศึกทีมชาติไทย!';
    if (isSolidUpper) return 'ผลงานยอดเยี่ยมระดับหัวตาราง!';
    if (isRelegated) return 'ตกชั้น — ลุกขึ้นสู้ใหม่ฤดูกาลหน้า';
    return summary.stText || 'สรุปผลงานประจำฤดูกาล';
  }, [
    state.sack,
    majorTrophyCount,
    wonAsia,
    summary.ch,
    summary.mt,
    summary.nt,
    summary.pos,
    summary.stText,
    wonCup,
    wonLc,
    wonDc,
    wonSc,
    isPromoted,
    metBoardGoal,
    wonNtCallup,
    isSolidUpper,
    isRelegated
  ]);

  const celebrationPlan = useMemo(() => {
    const prizeLine =
      state.mode === 'm' && summary.leaguePrize > 0
        ? `เงินรางวัลบอลลีก +${fmtMoney(summary.leaguePrize)}`
        : null;
    if (celebrationLevel === 'grand') {
      return {
        kicker: 'ขบวนแห่แชมป์ & งานเลี้ยงฉลองยิ่งใหญ่',
        title: `ฉลองแชมป์รอบเมืองกับแฟนบอล ${me.name}`,
        desc:
          majorTrophyCount >= 2
            ? `แฟนบอลร่วมฉลองความสำเร็จอันยิ่งใหญ่ถึง ${majorTrophyCount} ถ้วยรางวัลในฤดูกาลเดียว`
            : `ค่ำคืนแห่งประวัติศาสตร์ของสโมสร จัดงานเลี้ยงฉลองถ้วยรางวัลที่สนาม ${state.club?.std || me.name}`,
        highlights: [
          `🏆 เกียรติยศ ${trophiesWon.length} รายการ`,
          ...(prizeLine ? [`💰 ${prizeLine}`] : [`👥 แฟนบอล ${fmtFans(ensureTeamFans(me))} คน`]),
          `👑 ชื่อเสียงสโมสรพุ่งทะยาน`
        ]
      };
    }
    if (celebrationLevel === 'promotion') {
      return {
        kicker: 'งานฉลองเลื่อนชั้นสู่ดิวิชั่นใหม่',
        title: `คว้าตั๋วเลื่อนชั้นสู่ ${TN[summary.nt]} สำเร็จ`,
        desc: `จบอันดับ ${summary.pos} (${me.pts} แต้ม) พาสโมสรก้าวขึ้นสู่เวทีที่สูงกว่าในฤดูกาลหน้า`,
        highlights: [
          `🚀 ${TN[summary.mt]} → ${TN[summary.nt]}`,
          ...(prizeLine ? [`💰 ${prizeLine}`] : [`👏 แฟนบอลร่วมฉลองเต็มสนาม`]),
          `💼 บอร์ดพร้อมหนุนงบฤดูกาลหน้า`
        ]
      };
    }
    if (celebrationLevel === 'elite') {
      return {
        kicker: 'งานกาล่าปิดฤดูกาลสโมสร',
        title: `สรุปความสำเร็จ & มอบรางวัลสโมสร ${me.name}`,
        desc: wonNtCallup
          ? `ฟอร์มอันร้อนแรงพาคุณติดธงช้างศึกทีมชาติไทยชุดใหญ่ พร้อมเสียงปรบมือจากแฟนบอล`
          : `จบอันดับ ${summary.pos}/${summary.totalTeams} ด้วยผลงานน่าประทับใจตลอดฤดูกาล`,
        highlights: [
          `⭐ อันดับ ${summary.pos}/${summary.totalTeams} (${me.pts} แต้ม)`,
          ...(prizeLine
            ? [`💰 ${prizeLine}`]
            : [metBoardGoal ? `✅ ตามเป้าบอร์ด (1-${state.obj})` : `📈 ผลงานเหนือความคาดหมาย`]),
          `🎤 งานประกาศรางวัลประจำปี`
        ]
      };
    }
    return null;
  }, [
    celebrationLevel,
    me,
    state.mode,
    state.club?.std,
    majorTrophyCount,
    trophiesWon.length,
    state.obj,
    summary.nt,
    summary.mt,
    summary.pos,
    summary.totalTeams,
    summary.leaguePrize,
    wonNtCallup,
    metBoardGoal
  ]);

  const winRate = arc && arc.played > 0 ? Math.round((arc.won / arc.played) * 100) : 0;
  const gd = arc ? arc.gf - arc.ga : me.gf - me.ga;

  const displayTrophies = useMemo(() => {
    const list = trophiesWon.filter(
      (t) =>
        t.type === 'league' ||
        t.type === 'cup' ||
        t.type === 'asia' ||
        t.type === 'league_cup' ||
        t.type === 'super_cup' ||
        t.type === 'div_cup'
    );
    if (list.length > 0) return list;
    return trophiesWon;
  }, [trophiesWon]);

  const scorerPlayer = useMemo(() => findSquadPlayer(arc?.topScorer?.name), [arc?.topScorer?.name, me.sq]);
  const assistPlayer = useMemo(() => findSquadPlayer(arc?.topAssist?.name), [arc?.topAssist?.name, me.sq]);
  const ratingPlayer = useMemo(() => findSquadPlayer(arc?.topRating?.name), [arc?.topRating?.name, me.sq]);

  const cupSubLine = useMemo(() => {
    const items = [
      summary.leagueCupStatus ? `ลีกคัพ: ${summary.leagueCupStatus}` : null,
      summary.divCupStatus ? `ถ้วยดิวิชั่น: ${summary.divCupStatus}` : null,
      summary.superCupStatus ? `แชมเปี้ยนส์คัพ: ${summary.superCupStatus}` : null,
      summary.asiaStatus ? `ทวีป: ${summary.asiaStatus}` : null
    ].filter(Boolean);
    return items.join(' · ') || 'ถ้วยประชาชนรายการเดียว';
  }, [summary.leagueCupStatus, summary.divCupStatus, summary.superCupStatus, summary.asiaStatus]);

  return (
    <div className="fixed inset-0 z-50 bg-black/82 flex items-center justify-center p-2 sm:p-4 mland:p-1.5 safe-all overflow-hidden">
      <div
        className={`w-full max-w-4xl mland:max-w-[95vw] max-h-[calc(var(--app-dvh,1dvh)*93)] mland:h-[calc(var(--app-dvh,1dvh)*96)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-2xl bg-[var(--surface)] border flex flex-col overflow-hidden shadow-2xl ${
          celebrationLevel === 'grand'
            ? 'border-amber-400/75'
            : celebrationLevel === 'promotion' || celebrationLevel === 'elite'
              ? 'border-[var(--g)]/65'
              : celebrationLevel === 'relegated'
                ? 'border-[var(--red)]/55'
                : 'border-[var(--line)]'
        }`}
      >
        {/* HERO SUMMARY STAGE (Zero blur / Zero infinite animations for instant open & smooth scroll) */}
        <div
          className={`shrink-0 relative border-b px-4 py-3.5 sm:px-6 sm:py-4 mland:px-3.5 mland:py-2 ${
            celebrationLevel === 'grand'
              ? 'bg-gradient-to-br from-[#211704] via-[#13291e] to-[#0a1811] text-white border-amber-400/35'
              : celebrationLevel === 'promotion' || celebrationLevel === 'elite'
                ? 'bg-gradient-to-br from-[#082919] via-[#103824] to-[#0a1c13] text-white border-emerald-400/30'
                : celebrationLevel === 'relegated'
                  ? 'bg-gradient-to-br from-[#281012] via-[var(--surface-2)] to-[var(--surface)] border-[var(--red)]/35'
                  : 'bg-[var(--surface-2)] border-[var(--line)]'
          }`}
        >
          <div className="flex flex-col gap-2 mland:gap-1">
            {/* Top Kicker & Replay */}
            <div className="flex items-center justify-between gap-2">
              <div
                className={`inline-flex items-center gap-1.5 text-[11px] mland:text-[9.5px] font-bold tracking-wide ${
                  celebrationLevel === 'grand'
                    ? 'text-amber-300'
                    : isCelebration
                      ? 'text-emerald-300'
                      : celebrationLevel === 'relegated'
                        ? 'text-[var(--red)]'
                        : 'text-[var(--mut)]'
                }`}
              >
                {celebrationLevel === 'grand' ? (
                  <Crown className="w-3.5 h-3.5 shrink-0" />
                ) : isCelebration ? (
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Award className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>สรุปปิดฤดูกาลที่ {state.season} · {TN[summary.mt]}</span>
              </div>

              {isCelebration && (
                <button
                  type="button"
                  onClick={replayCelebration}
                  className="inline-flex items-center gap-1 px-2.5 py-1 mland:py-0.5 rounded-lg bg-white/12 hover:bg-white/20 border border-white/20 text-white text-[11px] mland:text-[9.5px] font-bold cursor-pointer shrink-0"
                >
                  <PartyPopper className="w-3.5 h-3.5 text-amber-300" />
                  <span>จุดพลุฉลอง</span>
                </button>
              )}
            </div>

            {/* Club Crest + Headline + Trophies */}
            <div className="flex items-center justify-between gap-3 mland:gap-2">
              <div className="flex items-center gap-3 mland:gap-2 min-w-0">
                <div
                  className={`shrink-0 rounded-xl p-1.5 mland:p-1 ${
                    isCelebration
                      ? 'bg-white/10 border border-white/20'
                      : 'bg-[var(--surface)] border border-[var(--line)]'
                  } mland:[&>svg]:w-8 mland:[&>svg]:h-8`}
                >
                  <ClubCrest name={me.name} size={46} team={me} club={state.club} isMyClub={state.mode === 'm'} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h2 className="font-bold text-base sm:text-xl mland:text-sm font-display truncate inline-flex items-center gap-1.5">
                      <span className="truncate">{me.name}</span>
                      <span
                        title="ทีมของคุณ"
                        aria-label="ทีมของคุณ"
                        className="inline-flex items-center justify-center w-4 h-4 mland:w-3 mland:h-3 rounded-full bg-[var(--lamp)] text-[#261900] text-[9.5px] mland:text-[7.5px] font-black leading-none shrink-0"
                      >
                        ★
                      </span>
                    </h2>
                    <span
                      className={`text-xs mland:text-[10px] font-bold tabular ${
                        isCelebration ? 'text-white/80' : 'text-[var(--mut)]'
                      }`}
                    >
                      อันดับ {summary.pos}/{summary.totalTeams} · {me.pts} แต้ม · ชนะ {winRate}%
                    </span>
                  </div>
                  <div
                    className={`text-base sm:text-xl mland:text-xs font-extrabold tracking-tight text-balance leading-snug ${
                      celebrationLevel === 'grand'
                        ? 'text-amber-300'
                        : isCelebration
                          ? 'text-emerald-300'
                          : celebrationLevel === 'relegated'
                            ? 'text-[var(--red)]'
                            : 'text-[var(--g)]'
                    }`}
                  >
                    {headlineTitle}
                  </div>
                </div>
              </div>

              {displayTrophies.length > 0 ? (
                <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 mland:py-1 rounded-xl bg-black/25 border border-amber-300/30">
                  {displayTrophies.slice(0, 5).map((tr, i) => (
                    <div key={`${tr.type}-${i}`} className="flex flex-col items-center">
                      <TrophySvg
                        type={tr.type}
                        tier={tr.tier}
                        uid={`end-${state.season}-${i}`}
                        size={displayTrophies.length > 3 ? 32 : 40}
                      />
                    </div>
                  ))}
                </div>
              ) : isPromoted ? (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-300/35 shrink-0">
                  <TrendingUp className="w-5 h-5 text-amber-300" />
                  <div className="leading-tight">
                    <div className="text-[10px] text-emerald-200 font-semibold">เลื่อนชั้นสู่</div>
                    <div className="text-xs font-extrabold text-white">{TN[summary.nt]}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 mland:p-2.5 space-y-3 mland:space-y-2">
          {/* CELEBRATION SUMMARY STRIP */}
          {celebrationPlan && (
            <div
              className={`p-3 mland:p-2 rounded-xl border ${
                celebrationLevel === 'grand'
                  ? 'bg-amber-500/10 border-amber-400/45'
                  : 'bg-[var(--g-soft)] border-[var(--g)]/40'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mland:gap-1.5">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[10.5px] mland:text-[9px] font-extrabold text-[#9a6700] dark:text-[var(--lamp)] flex items-center gap-1">
                    <PartyPopper className="w-3.5 h-3.5 shrink-0" />
                    <span>{celebrationPlan.kicker}</span>
                  </div>
                  <div className="font-bold text-sm mland:text-xs text-[var(--ink)]">{celebrationPlan.title}</div>
                  <p className="text-xs mland:text-[10px] text-[var(--mut)] leading-snug">{celebrationPlan.desc}</p>
                </div>
                <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-x-3 gap-y-0.5 shrink-0 text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] tabular">
                  {celebrationPlan.highlights.map((item) => (
                    <span key={item} className="whitespace-nowrap">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4-COLUMN SEASON KPI SNAPSHOT */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mland:gap-1.5 text-xs mland:text-[10px]">
            <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/70 space-y-0.5">
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">
                ผลงานลีก ({arc?.played ?? me.p} นัด)
              </div>
              <div className="font-extrabold text-sm mland:text-xs tabular text-[var(--ink)]">
                {arc?.won ?? me.w}W · {arc?.drawn ?? me.d}D · {arc?.lost ?? me.l}L
              </div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
                ยิง {arc?.gf ?? me.gf} เสีย {arc?.ga ?? me.ga} ({gd >= 0 ? `+${gd}` : gd})
              </div>
            </div>

            <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/70 space-y-0.5">
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">บอลถ้วย &amp; ทวีป</div>
              <div className={`font-extrabold text-sm mland:text-xs truncate ${wonCup ? 'text-[#b47b00] dark:text-[var(--lamp)]' : 'text-[var(--ink)]'}`}>
                {wonCup ? '🏆 ' : ''}{summary.cupStatus}
              </div>
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate" title={cupSubLine}>
                {cupSubLine}
              </div>
            </div>

            <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/70 space-y-0.5">
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">ดิวิชั่นฤดูกาลหน้า</div>
              <div className="font-extrabold text-sm mland:text-xs flex items-center gap-1 truncate text-[var(--ink)]">
                {isPromoted && <TrendingUp className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />}
                {isRelegated && <TrendingDown className="w-3.5 h-3.5 text-[var(--red)] shrink-0" />}
                <span className="truncate">{TN[summary.nt]}</span>
              </div>
              <div className={`text-[10.5px] mland:text-[9px] font-bold ${isPromoted ? 'text-[var(--g)]' : isRelegated ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                {isPromoted ? 'เลื่อนชั้นสำเร็จ!' : isRelegated ? 'ตกชั้น 1 ระดับ' : summary.ch ? 'ป้องกันแชมป์ต่อ' : 'อยู่ลีกเดิม'}
              </div>
            </div>

            {state.mode === 'm' ? (
              <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/70 space-y-0.5">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">บอร์ด &amp; เงินรางวัล</div>
                <div className="font-extrabold text-sm mland:text-xs tabular flex items-center gap-1 text-[var(--ink)]">
                  <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${state.sack === 1 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`} />
                  <span>บอร์ด {state.bd ?? 50}%</span>
                  {summary.leaguePrize > 0 && (
                    <span className="ml-auto text-[#9a6700] dark:text-[var(--lamp)] text-xs mland:text-[10px]">
                      +{fmtMoney(summary.leaguePrize)}
                    </span>
                  )}
                </div>
                <div className={`text-[10.5px] mland:text-[9px] font-semibold truncate ${state.sack === 1 ? 'text-[var(--red)]' : metBoardGoal ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                  {state.sack === 1
                    ? 'มติปลดออกจากตำแหน่ง'
                    : metBoardGoal
                      ? `✓ ผ่านเป้า 1–${state.obj} · รับโล่บอร์ด & เครดิต`
                      : `เป้า 1–${state.obj || '-'} · จบ #${summary.pos}`}
                </div>
              </div>
            ) : (
              <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]/70 space-y-0.5">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">เส้นทางอาชีพนักเตะ</div>
                <div className="font-extrabold text-sm mland:text-xs truncate text-[var(--ink)]">
                  {wonNtCallup ? '🇹🇭 ติดทีมชาติไทย!' : state.p?.name || 'คุณ'}
                </div>
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
                  {state.p ? `ลง ${state.p.ap || 0} · ${state.p.gl || 0}G ${state.p.as || 0}A` : 'ปิดฤดูกาล'}
                </div>
              </div>
            )}
          </div>

          {/* TEAM MVPs */}
          {arc && (arc.topScorer || arc.topAssist || arc.topRating) && (
            <div className="space-y-2 mland:space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs mland:text-[10.5px] flex items-center gap-1.5 text-[var(--ink)]">
                  <Trophy className="w-3.5 h-3.5 text-[var(--lamp)]" />
                  <span>ดาวเด่นประจำทีม ({me.name})</span>
                </span>
                {arc.topCleanSheet && (
                  <span className="text-[11px] mland:text-[9px] text-[var(--mut)] font-semibold inline-flex items-center gap-1">
                    <StatIconBadge kind="cleansheet" size="xs" />
                    <span>คลีนชีตสูงสุด: <b className="text-[var(--ink)]">{arc.topCleanSheet.name} ({arc.topCleanSheet.cs})</b></span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-2 mland:gap-1.5">
                {[
                  {
                    id: 'scorer',
                    label: (
                      <span className="inline-flex items-center gap-1">
                        <StatIconBadge kind="goal" size="xs" />
                        <span>ดาวซัลโวทีม</span>
                      </span>
                    ),
                    name: arc.topScorer?.name,
                    stat: arc.topScorer ? `${arc.topScorer.sg} ประตู (${arc.topScorer.sp} นัด)` : '-',
                    player: scorerPlayer,
                    accent: 'border-[var(--g)]/35'
                  },
                  {
                    id: 'assist',
                    label: (
                      <span className="inline-flex items-center gap-1">
                        <StatIconBadge kind="assist" size="xs" />
                        <span>จอมแอสซิสต์ทีม</span>
                      </span>
                    ),
                    name: arc.topAssist?.name,
                    stat: arc.topAssist ? `${arc.topAssist.sa} แอสซิสต์ (${arc.topAssist.sp} นัด)` : '-',
                    player: assistPlayer,
                    accent: 'border-sky-500/35'
                  },
                  {
                    id: 'rating',
                    label: '⭐ นักเตะยอดเยี่ยมทีม',
                    name: arc.topRating?.name,
                    stat: arc.topRating ? `เฉลี่ย ${arc.topRating.avgRating.toFixed(2)} (${arc.topRating.motm} MOTM)` : '-',
                    player: ratingPlayer,
                    accent: 'border-[var(--lamp)]/45'
                  }
                ].map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/55 border ${item.accent} flex items-center gap-2.5 mland:gap-1.5 min-w-0`}
                  >
                    {item.player ? (
                      <div className="shrink-0 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                        <PlayerFace player={item.player} team={me} state={state} size={36} />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-xs shrink-0">
                        -
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] truncate">{item.label}</div>
                      <div className="font-bold text-xs mland:text-[10px] truncate text-[var(--ink)]">{item.name || '-'}</div>
                      <div className="text-[10.5px] mland:text-[9px] font-semibold text-[var(--g)] tabular truncate">{item.stat}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEAGUE AWARDS & HONORS */}
          {(summary.bestScorer || summary.bestAssist || trophiesWon.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mland:gap-1.5 text-xs mland:text-[10px] pt-1 border-t border-[var(--line)]/70">
              {(summary.bestScorer || summary.bestAssist) && (
                <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-1">
                  <div className="font-bold text-[11px] mland:text-[9.5px] text-[var(--mut)]">
                    🏅 รางวัลดาวเด่นประจำลีก ({TN[summary.mt]})
                  </div>
                  {summary.bestScorer && (
                    <div className="truncate text-[var(--ink)] flex items-center gap-1">
                      <StatIconBadge kind="goal" size="xs" />
                      <span className="truncate">ดาวซัลโว: <b>{summary.bestScorer}</b></span>
                    </div>
                  )}
                  {summary.bestAssist && (
                    <div className="truncate text-[var(--ink)] flex items-center gap-1">
                      <StatIconBadge kind="assist" size="xs" />
                      <span className="truncate">จอมแอสซิสต์: <b>{summary.bestAssist}</b></span>
                    </div>
                  )}
                </div>
              )}

              {trophiesWon.length > 0 && (
                <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--lamp-soft)]/55 border border-[var(--lamp)]/40 space-y-1">
                  <div className="font-bold text-[11px] mland:text-[9.5px] text-[#8a5a00] dark:text-[var(--lamp)]">
                    🏆 เกียรติยศในซีซั่นที่ {state.season}
                  </div>
                  <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] leading-relaxed">
                    {trophiesWon
                      .map((tr) => {
                        const ico =
                          tr.type === 'asia'
                            ? '👑'
                            : tr.type === 'cup'
                              ? '🏆'
                              : tr.type === 'league_cup'
                                ? '🥇'
                                : tr.type === 'super_cup'
                                  ? '🏅'
                                  : tr.type === 'div_cup'
                                    ? '🛡️'
                                    : tr.type === 'nt'
                                      ? '🇹🇭'
                                      : '🏆';
                        return `${ico} ${tr.title}`;
                      })
                      .join(' · ')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOARD DISMISSAL NOTICE */}
          {state.mode === 'm' && state.sack === 1 && (
            <div className="p-3 mland:p-2 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/45 text-xs mland:text-[10px] font-bold text-[var(--red)]">
              ❌ บอร์ดบริหารมีมติปลดคุณออกจากตำแหน่งหลังผลงานต่ำกว่าเป้าหมาย
            </div>
          )}

          {/* MANAGER CAREER OFFERS (POACHING OR SACKED RESCUE) */}
          {state.mode === 'm' && managerOffers.length > 0 && (
            <div
              className={`p-3 mland:p-2 rounded-xl border space-y-2 mland:space-y-1 ${
                state.sack === 1
                  ? 'bg-[var(--g-soft)] border-[var(--g)]/55'
                  : 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)]">
                  {state.sack === 1
                    ? '💼 ข้อเสนอกอบกู้ทีมใหม่ (เลือกทีมเพื่อคุมทัพต่อในฤดูกาลหน้า!)'
                    : '💼 ข้อเสนอทาบทามจากสโมสรอื่น (ย้ายไปคุมทัพฤดูกาลหน้า)'}
                </div>
                <span className="text-[10px] text-[var(--mut)] tabular">{managerOffers.length} ทีม</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
                {managerOffers.map((offer) => {
                  const club = state.teams[offer.teamId];
                  const starters = club ? xi(club) : [];
                  const avgOvr = starters.length
                    ? Math.round(starters.reduce((sum, p) => sum + p.ov, 0) / starters.length)
                    : 60;
                  const badgeText =
                    offer.reason === 'rescue'
                      ? 'กอบกู้ทีม'
                      : offer.reason === 'poach'
                        ? 'ดึงตัว'
                        : 'ข้อเสนอใหม่';
                  return (
                    <button
                      key={offer.teamId}
                      type="button"
                      onClick={() => onStartNextSeason(offer.teamId)}
                      className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] flex items-center justify-between gap-2 mland:gap-1.5 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 mland:gap-1.5 min-w-0">
                        <ClubCrest name={offer.teamName} size={28} team={club} />
                        <div className="min-w-0">
                          <div className="font-bold text-xs mland:text-[10.5px] truncate text-[var(--ink)]">
                            {offer.teamName}
                          </div>
                          <div className="text-[10.5px] mland:text-[9px] text-[var(--g)] font-semibold truncate">
                            {TN[offer.tier]} · OVR {avgOvr} · งบ {fmtMoney(offer.budgetK)}
                          </div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--g-soft)] text-[var(--g)] text-[10px] font-bold shrink-0">
                        {badgeText} ›
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PLAYER CAREER TRANSFER OFFERS */}
          {state.mode === 'p' && summary.offers.length > 0 && (
            <div className="p-3 mland:p-2 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/45 space-y-2 mland:space-y-1">
              <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)]">
                ✉️ ข้อเสนอย้ายทีมจากสโมสรใหม่!
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
                {summary.offers.map((club) => (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => onStartNextSeason(club.id)}
                    className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] flex items-center gap-2.5 mland:gap-1.5 text-left cursor-pointer"
                  >
                    <ClubCrest name={club.name} size={28} team={club} />
                    <div className="min-w-0">
                      <div className="font-bold text-xs mland:text-[10.5px] truncate text-[var(--ink)]">{club.name}</div>
                      <div className="text-[11px] mland:text-[9.5px] text-[var(--g)] font-semibold">
                        ย้ายร่วมทีม ({TN[club.tier]}) ›
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STICKY ACTION FOOTER */}
        <div className="shrink-0 p-3.5 sm:px-5 sm:py-3 mland:p-2 bg-[var(--surface-2)] border-t border-[var(--line)] flex items-center gap-2">
          {onOpenSeasonStats && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onOpenSeasonStats();
              }}
              className="btn btn-lg mland:btn-md btn-surface whitespace-nowrap shrink-0"
            >
              <BarChart3 className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)]" />
              <span>สรุปสถิตินักเตะ &amp; สโมสร</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onStartNextSeason()}
            className={`btn btn-lg mland:btn-md flex-1 ${
              celebrationLevel === 'grand' ? 'btn-gold' : state.sack === 1 ? 'btn-secondary' : 'btn-primary'
            }`}
          >
            {state.sack === 1 ? (
              <>
                <RotateCcw className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
                <span>กลับสู่หน้าหลัก</span>
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
                <span>
                  {isCelebration ? `ฉลองเสร็จแล้ว · ลุยฤดูกาลที่ ${state.season + 1}` : `เริ่มฤดูกาลที่ ${state.season + 1}`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
