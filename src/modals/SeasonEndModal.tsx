import React, { useEffect, useMemo, useState } from 'react';
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
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { TrophySvg } from '../components/ClubHistoryPanel';

export type SeasonSummaryData = ReturnType<typeof finishSeasonComputation>;

type CelebrationLevel = 'grand' | 'promotion' | 'elite' | 'steady' | 'relegated';

export const SeasonEndModal: React.FC<{
  state: GameState;
  summary: SeasonSummaryData;
  onOpenSeasonStats?: () => void;
  onStartNextSeason: (transferToTeamId?: number) => void;
}> = ({ state, summary, onOpenSeasonStats, onStartNextSeason }) => {
  const me = state.teams[state.me];
  const [fireworkPulse, setFireworkPulse] = useState(0);

  const arc = summary.archive;
  const trophiesWon: TrophyRecord[] = useMemo(() => {
    const fromSummary = summary.trophiesWon || [];
    if (fromSummary.length > 0) return fromSummary;
    return (state.trophies || []).filter((tr) => tr.season === state.season);
  }, [summary.trophiesWon, state.trophies, state.season]);

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
      triggerConfetti(3);
    } else if (celebrationLevel === 'elite') {
      SFX.win();
      SFX.cheer(0.75);
      triggerConfetti(2);
    } else {
      SFX.whistle();
    }
  }, [celebrationLevel, summary]);

  const replayCelebration = () => {
    setFireworkPulse((n) => n + 1);
    if (celebrationLevel === 'grand' || celebrationLevel === 'promotion') {
      SFX.celebrate();
      triggerConfetti(3);
    } else {
      SFX.win();
      SFX.cheer(0.8);
      triggerConfetti(2);
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
  }, [state.sack, majorTrophyCount, wonAsia, summary.ch, summary.mt, summary.nt, summary.pos, summary.stText, wonCup, wonLc, wonDc, wonSc, isPromoted, metBoardGoal, wonNtCallup, isSolidUpper, isRelegated]);

  const celebrationPlan = useMemo(() => {
    if (celebrationLevel === 'grand') {
      return {
        badge: 'ขบวนแห่แชมป์ & งานเลี้ยงฉลองยิ่งใหญ่',
        title: `จัดขบวนแห่ฉลองแชมป์รอบเมืองกับแฟนบอล ${me.name}!`,
        desc:
          majorTrophyCount >= 2
            ? `แฟนบอลหลายหมื่นคนหลั่งไหลสู่ถนนหน้าสนามเพื่อร่วมเฉลิมฉลองความสำเร็จอันยิ่งใหญ่ถึง ${majorTrophyCount} ถ้วยรางวัลในฤดูกาลเดียว`
            : `ค่ำคืนแห่งประวัติศาสตร์ของสโมสร จัดงานเลี้ยงฉลองถ้วยรางวัลและพลุไฟตระการตาที่สนามเหย้า ${state.club?.std || me.name}`,
        perks: [
          `🏆 คว้าเกียรติยศ ${trophiesWon.length} รายการ`,
          `👥 แฟนบอลสโมสร ${fmtFans(ensureTeamFans(me))} คน`,
          `👑 ชื่อเสียงสโมสรพุ่งทะยาน`
        ]
      };
    }
    if (celebrationLevel === 'promotion') {
      return {
        badge: 'งานฉลองเลื่อนชั้นสู่ดิวิชั่นใหม่',
        title: `เปิดสนามฉลองตั๋วเลื่อนชั้นสู่ ${TN[summary.nt]}!`,
        desc: `ค่ำคืนแห่งความภาคภูมิใจ หลังจบอันดับ ${summary.pos} (${me.pts} แต้ม) พาสโมสรก้าวขึ้นสู่เวทีที่สูงกว่า พร้อมงานเลี้ยงขอบคุณนักเตะและแฟนบอล`,
        perks: [
          `🚀 เลื่อนชั้น ${TN[summary.mt]} → ${TN[summary.nt]}`,
          `👏 แฟนบอลร่วมฉลองเต็มความจุ`,
          `💼 บอร์ดพร้อมหนุนงบฤดูกาลหน้า`
        ]
      };
    }
    if (celebrationLevel === 'elite') {
      return {
        badge: 'งานกาล่าฉลองความสำเร็จประจำฤดูกาล',
        title: `จัดงานเลี้ยงขอบคุณแฟนบอล & มอบรางวัลสโมสร ${me.name}!`,
        desc:
          wonNtCallup
            ? `ฟอร์มอันร้อนแรงพาคุณติดธงช้างศึกทีมชาติไทยชุดใหญ่ พร้อมเสียงปรบมือจากแฟนบอลทั้งสนาม`
            : `จบอันดับ ${summary.pos}/${summary.totalTeams} ด้วยผลงานอันน่าประทับใจ บอร์ดบริหารและแฟนบอลจัดงานเลี้ยงปิดซีซั่นอย่างอบอุ่น`,
        perks: [
          `⭐ อันดับ ${summary.pos}/${summary.totalTeams} (${me.pts} แต้ม)`,
          metBoardGoal ? `✅ ทำได้ตามเป้าบอร์ด (1-${state.obj})` : `📈 ผลงานเหนือความคาดหมาย`,
          `🎤 งานมอบรางวัลนักเตะยอดเยี่ยม`
        ]
      };
    }
    return null;
  }, [celebrationLevel, me, state.club?.std, majorTrophyCount, trophiesWon.length, state.obj, summary.nt, summary.mt, summary.pos, summary.totalTeams, wonNtCallup, metBoardGoal]);

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

  const scorerPlayer = findSquadPlayer(arc?.topScorer?.name);
  const assistPlayer = findSquadPlayer(arc?.topAssist?.name);
  const ratingPlayer = findSquadPlayer(arc?.topRating?.name);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
      <div
        className={`w-full max-w-3xl mland:max-w-[94vw] max-h-[calc(var(--app-dvh,1dvh)*92)] mland:h-[calc(var(--app-dvh,1dvh)*96)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border flex flex-col overflow-hidden shadow-2xl ${
          celebrationLevel === 'grand'
            ? 'border-amber-400/70 shadow-[0_0_50px_rgba(245,194,66,0.28)]'
            : celebrationLevel === 'promotion' || celebrationLevel === 'elite'
              ? 'border-emerald-400/60 shadow-[0_0_40px_rgba(37,184,108,0.22)]'
              : 'border-[var(--line)]'
        }`}
      >
        {/* HERO BANNER / CELEBRATION STAGE */}
        <div
          className={`shrink-0 relative overflow-hidden border-b px-4 py-4 sm:px-6 sm:py-5 mland:px-3 mland:py-2 ${
            celebrationLevel === 'grand'
              ? 'bg-gradient-to-br from-[#1b1404] via-[#13291e] to-[#081710] text-white border-amber-400/35'
              : celebrationLevel === 'promotion' || celebrationLevel === 'elite'
                ? 'bg-gradient-to-br from-[#072617] via-[#0e3924] to-[#091c14] text-white border-emerald-400/30'
                : celebrationLevel === 'relegated'
                  ? 'bg-gradient-to-br from-[#231012] via-[var(--surface-2)] to-[var(--surface)] border-[var(--red)]/30'
                  : 'bg-[var(--surface-2)] border-[var(--line)]'
          }`}
        >
          {/* Animated Fireworks & Spotlight layer for Celebration tiers */}
          {isCelebration && (
            <div key={fireworkPulse} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <div
                className="absolute -top-16 left-1/2 -translate-x-1/2 w-[380px] h-[190px] rounded-full blur-2xl opacity-35"
                style={{
                  background:
                    celebrationLevel === 'grand'
                      ? 'radial-gradient(circle, rgba(250,204,21,0.75) 0%, rgba(16,185,129,0.25) 55%, transparent 75%)'
                      : 'radial-gradient(circle, rgba(52,211,153,0.7) 0%, rgba(250,204,21,0.22) 55%, transparent 75%)'
                }}
              />
              {/* SVG Fireworks Bursts */}
              <svg className="absolute inset-0 w-full h-full opacity-80" viewBox="0 0 600 180" preserveAspectRatio="xMidYMid slice">
                <g className="celebrate-burst" style={{ transformOrigin: '85px 45px' }}>
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                    <line
                      key={deg}
                      x1="85"
                      y1="45"
                      x2={85 + Math.cos((deg * Math.PI) / 180) * 26}
                      y2={45 + Math.sin((deg * Math.PI) / 180) * 26}
                      stroke={celebrationLevel === 'grand' ? '#fde047' : '#6ee7b7'}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  ))}
                </g>
                <g className="celebrate-burst" style={{ transformOrigin: '515px 48px', animationDelay: '0.8s' }}>
                  {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((deg) => (
                    <line
                      key={deg}
                      x1="515"
                      y1="48"
                      x2={515 + Math.cos((deg * Math.PI) / 180) * 28}
                      y2={48 + Math.sin((deg * Math.PI) / 180) * 28}
                      stroke="#facc15"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  ))}
                </g>
                <g className="celebrate-sparkle" fill="#fef08a">
                  <circle cx="160" cy="30" r="2" />
                  <circle cx="215" cy="140" r="1.6" />
                  <circle cx="430" cy="28" r="2.2" />
                  <circle cx="385" cy="142" r="1.5" />
                  <circle cx="560" cy="122" r="1.8" />
                </g>
              </svg>
            </div>
          )}

          <div className="relative z-10 flex flex-col gap-2.5 mland:gap-1">
            {/* Top Status Row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] mland:text-[9.5px] font-bold border ${
                  celebrationLevel === 'grand'
                    ? 'bg-amber-400/20 border-amber-300/50 text-amber-200'
                    : isCelebration
                      ? 'bg-emerald-400/20 border-emerald-300/45 text-emerald-200'
                      : celebrationLevel === 'relegated'
                        ? 'bg-[var(--red-soft)] border-[var(--red)]/40 text-[var(--red)]'
                        : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)]'
                }`}
              >
                {celebrationLevel === 'grand' ? (
                  <Crown className="w-3.5 h-3.5 text-amber-300" />
                ) : isCelebration ? (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <Award className="w-3.5 h-3.5" />
                )}
                <span>สรุปปิดฤดูกาลที่ {state.season} · {TN[summary.mt]}</span>
              </span>

              {isCelebration && (
                <button
                  type="button"
                  onClick={replayCelebration}
                  className="inline-flex items-center gap-1 px-2.5 py-1 mland:py-0.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/25 text-white text-[11px] mland:text-[9.5px] font-bold cursor-pointer"
                >
                  <PartyPopper className="w-3.5 h-3.5 text-amber-300" />
                  <span>จุดพลุฉลองอีก!</span>
                </button>
              )}
            </div>

            {/* Club Crest + Main Headline + Trophy Showcase */}
            <div className="flex items-center justify-between gap-3 mland:gap-2">
              <div className="flex items-center gap-3 mland:gap-2 min-w-0">
                <div
                  className={`shrink-0 rounded-2xl p-1.5 mland:p-1 ${
                    isCelebration ? 'bg-white/10 border border-white/20 shadow-lg' : 'bg-[var(--surface)] border border-[var(--line)]'
                  } mland:[&>svg]:w-8 mland:[&>svg]:h-8`}
                >
                  <ClubCrest name={me.name} size={48} team={me} club={state.club} isMyClub={state.mode === 'm'} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-lg sm:text-xl mland:text-sm font-display truncate">{me.name}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[11px] mland:text-[9.5px] font-extrabold tabular ${
                        summary.pos === 1
                          ? 'bg-amber-400 text-[#261900]'
                          : isCelebration
                            ? 'bg-emerald-400/25 text-emerald-100 border border-emerald-300/40'
                            : 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)]'
                      }`}
                    >
                      อันดับ {summary.pos}/{summary.totalTeams} · {me.pts} แต้ม
                    </span>
                  </div>
                  <div
                    className={`text-base sm:text-lg mland:text-xs font-extrabold tracking-tight ${
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

              {/* Earned Trophies or Promotion Crest Podium */}
              {displayTrophies.length > 0 ? (
                <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 mland:py-1 rounded-2xl bg-black/25 border border-amber-300/35">
                  {displayTrophies.slice(0, 5).map((tr, i) => (
                    <div key={`${tr.type}-${i}`} className="flex flex-col items-center">
                      <TrophySvg
                        type={tr.type}
                        tier={tr.tier}
                        uid={`end-${state.season}-${i}`}
                        size={displayTrophies.length > 3 ? 34 : 42}
                      />
                    </div>
                  ))}
                </div>
              ) : isPromoted ? (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-300/40 shrink-0">
                  <TrendingUp className="w-6 h-6 text-amber-300" />
                  <div className="text-left leading-tight">
                    <div className="text-[10px] text-emerald-200 font-semibold">เลื่อนชั้นสู่</div>
                    <div className="text-xs font-extrabold text-white">{TN[summary.nt]}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2 space-y-3 mland:space-y-2">
          {/* GRAND CELEBRATION STAGE CARD (when ranked well or succeeded) */}
          {celebrationPlan && (
            <div
              className={`p-3.5 mland:p-2 rounded-2xl border relative overflow-hidden ${
                celebrationLevel === 'grand'
                  ? 'bg-gradient-to-r from-amber-500/14 via-amber-400/10 to-emerald-500/12 border-amber-400/50'
                  : 'bg-gradient-to-r from-emerald-500/12 via-[var(--g-soft)] to-amber-500/10 border-[var(--g)]/45'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mland:gap-1.5">
                <div className="space-y-1 mland:space-y-0.5 min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-[11px] mland:text-[9.5px] font-extrabold text-[#9a6700] dark:text-[var(--lamp)]">
                    <PartyPopper className="w-3.5 h-3.5" />
                    <span>{celebrationPlan.badge}</span>
                  </div>
                  <div className="font-bold text-sm mland:text-xs text-[var(--ink)]">{celebrationPlan.title}</div>
                  <p className="text-xs mland:text-[10px] text-[var(--mut)] leading-relaxed mland:leading-snug">
                    {celebrationPlan.desc}
                  </p>
                </div>
                <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0">
                  {celebrationPlan.perks.map((pk) => (
                    <div
                      key={pk}
                      className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/80 text-[11px] mland:text-[9.5px] font-bold whitespace-nowrap"
                    >
                      {pk}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4-TILE SEASON KPI SNAPSHOT */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mland:gap-1.5 text-xs mland:text-[10px]">
            <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70 space-y-0.5">
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">ผลงานลีก ({arc?.played ?? me.p} นัด)</div>
              <div className="font-extrabold text-sm mland:text-xs tabular">
                {arc?.won ?? me.w}W · {arc?.drawn ?? me.d}D · {arc?.lost ?? me.l}L
              </div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
                ยิง {arc?.gf ?? me.gf} เสีย {arc?.ga ?? me.ga} ({gd >= 0 ? `+${gd}` : gd}) · ชนะ {winRate}%
              </div>
            </div>

            <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70 space-y-0.5">
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">รายการบอลถ้วย &amp; ทวีป</div>
              <div className={`font-extrabold text-sm mland:text-xs truncate ${wonCup ? 'text-[#b47b00] dark:text-[var(--lamp)]' : ''}`}>
                {wonCup ? '🏆 ' : ''}{summary.cupStatus}
              </div>
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">
                {[
                  summary.leagueCupStatus ? `🥇 ${summary.leagueCupStatus}` : null,
                  summary.divCupStatus ? `🛡️ ${summary.divCupStatus}` : null,
                  summary.superCupStatus ? `🏅 ${summary.superCupStatus}` : null,
                  summary.asiaStatus ? `🌏 ${summary.asiaStatus}` : null
                ]
                  .filter(Boolean)
                  .join(' · ') || 'ถ้วยประชาชนรายการเดียว'}
              </div>
            </div>

            <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70 space-y-0.5">
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">ดิวิชั่นฤดูกาลหน้า</div>
              <div className="font-extrabold text-sm mland:text-xs flex items-center gap-1 truncate">
                {isPromoted && <TrendingUp className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />}
                {isRelegated && <TrendingDown className="w-3.5 h-3.5 text-[var(--red)] shrink-0" />}
                <span className="truncate">{TN[summary.nt]}</span>
              </div>
              <div className={`text-[10.5px] mland:text-[9px] font-bold ${isPromoted ? 'text-[var(--g)]' : isRelegated ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                {isPromoted ? 'เลื่อนชั้นสำเร็จ!' : isRelegated ? 'ตกชั้น 1 ระดับ' : summary.ch ? 'ป้องกันแชมป์ต่อ' : 'อยู่ลีกเดิม'}
              </div>
            </div>

            {state.mode === 'm' ? (
              <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70 space-y-0.5">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">ประเมินบอร์ดบริหาร</div>
                <div className="font-extrabold text-sm mland:text-xs tabular flex items-center gap-1">
                  <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${state.sack === 1 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`} />
                  <span>ความเชื่อมั่น {state.bd ?? 50}%</span>
                </div>
                <div className={`text-[10.5px] mland:text-[9px] font-semibold ${state.sack === 1 ? 'text-[var(--red)]' : metBoardGoal ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                  {state.sack === 1 ? 'มติปลดออกจากตำแหน่ง' : `เป้า 1-${state.obj || '-'} · จบ #${summary.pos}`}
                </div>
              </div>
            ) : (
              <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]/70 space-y-0.5">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold">เส้นทางอาชีพนักเตะ</div>
                <div className="font-extrabold text-sm mland:text-xs truncate">
                  {wonNtCallup ? '🇹🇭 ติดทีมชาติไทย!' : `${state.p?.name || 'คุณ'}`}
                </div>
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
                  {state.p ? `ลง ${state.p.ap || 0} · ${state.p.gl || 0}G ${state.p.as || 0}A` : 'ปิดฤดูกาล'}
                </div>
              </div>
            )}
          </div>

          {/* TEAM MVPs WITH PLAYER FACES */}
          {arc && (arc.topScorer || arc.topAssist || arc.topRating) && (
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2 mland:space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs mland:text-[10.5px] flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-[var(--lamp)]" />
                  <span>ดาวเด่นประจำทีม ({me.name})</span>
                </span>
                {arc.topCleanSheet && (
                  <span className="text-[11px] mland:text-[9px] text-[var(--mut)] font-semibold">
                    🧤 คลีนชีตสูงสุด: <b className="text-[var(--ink)]">{arc.topCleanSheet.name} ({arc.topCleanSheet.cs})</b>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-2 mland:gap-1.5">
                {[
                  {
                    label: '⚽ ดาวซัลโวทีม',
                    name: arc.topScorer?.name,
                    stat: arc.topScorer ? `${arc.topScorer.sg} ประตู (${arc.topScorer.sp} นัด)` : '-',
                    player: scorerPlayer,
                    accent: 'border-emerald-500/35'
                  },
                  {
                    label: '🎯 จอมแอสซิสต์ทีม',
                    name: arc.topAssist?.name,
                    stat: arc.topAssist ? `${arc.topAssist.sa} แอสซิสต์ (${arc.topAssist.sp} นัด)` : '-',
                    player: assistPlayer,
                    accent: 'border-sky-500/35'
                  },
                  {
                    label: '⭐ นักเตะยอดเยี่ยมทีม',
                    name: arc.topRating?.name,
                    stat: arc.topRating ? `เฉลี่ย ${arc.topRating.avgRating.toFixed(2)} (${arc.topRating.motm} MOTM)` : '-',
                    player: ratingPlayer,
                    accent: 'border-amber-500/40'
                  }
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border ${item.accent} flex items-center gap-2.5 mland:gap-1.5 min-w-0`}
                  >
                    {item.player ? (
                      <div className="shrink-0 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                        <PlayerFace player={item.player} team={me} state={state} size={38} />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs shrink-0">-</div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] truncate">{item.label}</div>
                      <div className="font-bold text-xs mland:text-[10px] truncate">{item.name || '-'}</div>
                      <div className="text-[10.5px] mland:text-[9px] font-semibold text-[var(--g)] tabular truncate">{item.stat}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEAGUE GOLDEN BOOT / PLAYMAKER + HONORS WON */}
          {(summary.bestScorer || summary.bestAssist || trophiesWon.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5 text-xs mland:text-[10px]">
              {(summary.bestScorer || summary.bestAssist) && (
                <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-1">
                  <div className="font-bold text-[11px] mland:text-[9.5px] text-[var(--mut)]">🏅 รางวัลดาวเด่นประจำลีก ({TN[summary.mt]})</div>
                  {summary.bestScorer && (
                    <div className="truncate">
                      ⚽ ดาวซัลโว: <b>{summary.bestScorer}</b>
                    </div>
                  )}
                  {summary.bestAssist && (
                    <div className="truncate">
                      🎯 จอมแอสซิสต์: <b>{summary.bestAssist}</b>
                    </div>
                  )}
                </div>
              )}

              {trophiesWon.length > 0 && (
                <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--lamp-soft)]/50 border border-[var(--lamp)]/45 space-y-1">
                  <div className="font-bold text-[11px] mland:text-[9.5px] text-[#8a5a00] dark:text-[var(--lamp)]">
                    🏆 เกียรติยศที่คว้าได้ในซีซั่นที่ {state.season}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {trophiesWon.map((tr, idx) => (
                      <span
                        key={`${tr.title}-${idx}`}
                        className="px-2 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--lamp)]/45 text-[11px] mland:text-[9.5px] font-bold"
                      >
                        {tr.type === 'asia'
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
                                    : '🏆'}{' '}
                        {tr.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOARD DISMISSAL NOTICE IF SACKED */}
          {state.mode === 'm' && state.sack === 1 && (
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--red-soft)] border border-[var(--red)]/45 text-xs mland:text-[10px] font-bold text-[var(--red)]">
              ❌ บอร์ดบริหารมีมติปลดคุณออกจากตำแหน่งหลังผลงานต่ำกว่าเป้าหมาย
            </div>
          )}

          {/* PLAYER CAREER TRANSFER OFFERS */}
          {state.mode === 'p' && summary.offers.length > 0 && (
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 space-y-2 mland:space-y-1">
              <div className="font-bold text-xs mland:text-[10px]">✉️ ข้อเสนอย้ายทีมจากลีกที่สูงกว่า!</div>
              <div className="grid grid-cols-2 gap-2 mland:gap-1.5">
                {summary.offers.map((club) => (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => onStartNextSeason(club.id)}
                    className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] flex items-center gap-2.5 mland:gap-1.5 text-left cursor-pointer"
                  >
                    <ClubCrest name={club.name} size={28} team={club} />
                    <div className="min-w-0">
                      <div className="font-bold text-xs mland:text-[10.5px] truncate">{club.name}</div>
                      <div className="text-[11px] mland:text-[9.5px] text-[var(--g)] font-semibold">ย้ายร่วมทีม ({TN[club.tier]}) ›</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER CTA BAR */}
        <div className="shrink-0 p-3.5 sm:p-4 mland:p-1.5 bg-[var(--surface-2)] border-t border-[var(--line)] flex items-center gap-2">
          {onOpenSeasonStats && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onOpenSeasonStats();
              }}
              className="btn btn-lg btn-surface whitespace-nowrap shrink-0"
            >
              <BarChart3 className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)]" />
              <span>สรุปสถิตินักเตะ &amp; สโมสร</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onStartNextSeason()}
            className={`btn btn-lg flex-1 ${
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
                <span>{isCelebration ? `ฉลองเสร็จแล้ว · ลุยฤดูกาลที่ ${state.season + 1}` : `เริ่มฤดูกาลที่ ${state.season + 1}`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
