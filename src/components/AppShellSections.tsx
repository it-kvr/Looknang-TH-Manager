import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { OfflineIndicator, PWAInstallButton, PWAUpdateBanner } from '../pwa.tsx';
import type { GameMode, GameState, MainTab, Player, Team } from '../types/game';
import { TN } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { ovMe } from '../engine/playerCore';
import { getActiveFavBoost } from '../engine/wellbeing';
import { fmtFans, fmtFansShort } from '../engine/simulation';
import { ClubCrest, PlayerFace } from './SvgVisuals';
import { StaminaBar } from './StaminaBar';
import { TransferMarketIcon } from './TransferMarketIcon';
import { OvrBadge } from './OvrBadge';
import { AnimatedMoney, MoneyDeltaPill, NumericDeltaPill, useNumericDelta, type MoneyDeltaState } from './AnimatedMoney';
import { EffectText } from './DeltaText';
import { TeamReadinessBadge } from './TeamReadinessBadge';
import stadiumHeroBg from '../assets/images/thai_stadium_hero_1795511663761.jpg';

export type NextMatchDescriptor = {
  kind: 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc';
  homeId: number;
  awayId: number;
  isDerby: boolean;
};

export const AppEntrySplash = React.memo<{
  onEnterGame: () => void;
}>(({ onEnterGame }) => {
  return (
    <div className="relative h-full w-full flex items-center justify-center overflow-hidden bg-[#040c08] stage-viewport">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#040c08]">
        <img
          src={stadiumHeroBg}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center brightness-[0.52] saturate-95"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020805]/86 via-[#05140c]/62 to-[#020805]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(22,124,72,0.22),rgba(2,8,5,0.68)_75%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto rounded-3xl mland:rounded-2xl border border-white/15 bg-[#07130d]/88 shadow-[0_24px_64px_rgba(0,0,0,0.75)] px-6 py-7 mland:px-6 mland:py-4 flex flex-col items-center text-center gap-4 mland:gap-2.5">
        <div className="w-16 h-16 mland:w-12 mland:h-12 rounded-2xl bg-white/10 border border-white/18 flex items-center justify-center shadow-xl">
          <svg viewBox="0 0 40 40" className="w-11 h-11 mland:w-8 mland:h-8" aria-hidden="true">
            <defs>
              <linearGradient id="enter_pitch_crest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#123a26" />
                <stop offset="1" stopColor="#22794b" />
              </linearGradient>
              <radialGradient id="enter_flood_crest" cx="0.5" cy="0.15" r="0.65">
                <stop offset="0" stopColor="#fde68a" stopOpacity="0.72" />
                <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect x="2" y="2" width="36" height="36" rx="8" fill="url(#enter_pitch_crest)" />
            <rect x="2" y="2" width="36" height="36" rx="8" fill="url(#enter_flood_crest)" />
            <g fill="none" stroke="#e6f7ed" strokeWidth="1.2" opacity="0.88">
              <path d="M5 24h30" />
              <ellipse cx="20" cy="27" rx="7.5" ry="3.2" />
            </g>
            <circle cx="20" cy="22" r="3.4" fill="#ffffff" stroke="#0d2619" strokeWidth="1" />
          </svg>
        </div>

        <div className="space-y-1 mland:space-y-0.5">
          <h1 className="text-3xl sm:text-4xl mland:text-2xl font-extrabold font-display tracking-wide leading-none text-white">
            ลูกหนัง<span className="text-[#fad05a]">ไทย</span>
          </h1>
          <p className="text-xs sm:text-sm mland:text-[11px] font-medium text-emerald-100/80">
            เกมจำลองคุมสโมสร &amp; นักเตะอาชีพไทย
          </p>
        </div>

        <button
          type="button"
          data-no-auto-fs="1"
          onClick={onEnterGame}
          className="w-full py-3.5 mland:py-2.5 px-6 rounded-2xl mland:rounded-xl bg-gradient-to-r from-[#f7cb51] via-[#f5c242] to-[#e0a214] text-[#211500] font-extrabold text-base mland:text-sm font-display shadow-[0_10px_28px_rgba(245,194,66,0.35)] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>⚽</span>
          <span>กดเพื่อเข้าเกม</span>
        </button>

        <p className="text-[11px] mland:text-[9.5px] text-emerald-100/60">
          แตะเพื่อเปิดเสียงเกมและเข้าสู่โหมดเต็มจอแนวนอนอัตโนมัติ
        </p>
      </div>

      <OfflineIndicator />
      <PWAUpdateBanner />
    </div>
  );
});

export const AppToast = React.memo<{
  message: string | null;
  variant?: 'menu' | 'game';
}>(({ message, variant = 'game' }) => {
  if (!message) return null;
  if (variant === 'menu') {
    return (
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] max-w-[90vw] px-4 py-2.5 rounded-xl bg-[var(--ink)]/95 text-[var(--bg)] border border-white/10 text-xs font-bold shadow-xl text-center pointer-events-none">
        <EffectText text={message} variant="inverted" />
      </div>
    );
  }
  return (
    <div className="fixed bottom-16 sm:bottom-20 mland:bottom-2.5 left-1/2 mland:left-[calc(50%+35px)] -translate-x-1/2 z-[70] max-w-[92vw] mland:max-w-[76vw] px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--ink)]/95 text-[var(--bg)] border border-white/10 text-xs mland:text-[10.5px] font-bold shadow-xl text-center pointer-events-none">
      <EffectText text={message} variant="inverted" />
    </div>
  );
});

export const AppTopHud = React.memo<{
  state: GameState;
  me: Team;
  mePlayer: Player | null;
  saveEpoch: number;
  myLeagueRank: number;
  myFansCount: number;
  nextMatchInfo: NextMatchDescriptor | null;
  nextOppTeam: Team | null;
  nextIsHome: boolean;
  autoSkipMatch: boolean;
  onNavigateToTab: (tab: MainTab, sub?: string, focus?: string, hint?: string) => void;
  onUpdateState?: (updater: (draft: GameState) => void) => void;
  onTriggerNextStep: () => void;
  onOpenNtModal: () => void;
  onOpenSettings: () => void;
  onToast: (msg: string) => void;
}>(({
  state,
  me,
  mePlayer,
  saveEpoch,
  myLeagueRank,
  myFansCount,
  nextMatchInfo,
  nextOppTeam,
  nextIsHome,
  autoSkipMatch,
  onNavigateToTab,
  onUpdateState,
  onTriggerNextStep,
  onOpenNtModal,
  onOpenSettings,
  onToast
}) => {
  const [hudMoneyDelta, setHudMoneyDelta] = useState<MoneyDeltaState | null>(null);

  useEffect(() => {
    setHudMoneyDelta(null);
  }, [saveEpoch]);

  const boardVal = state.bd ?? 55;
  const boardToneCls =
    boardVal >= 65
      ? 'text-[var(--g)]'
      : boardVal >= 40
        ? 'text-[#b47b00] dark:text-[var(--lamp)]'
        : 'text-[var(--red)]';
  const myStaminaVal = Math.round(state.p?.en ?? 100);
  const myRepVal = state.p?.rep ?? 0;
  const boardDelta = useNumericDelta(state.mode === 'm' ? boardVal : 0, `${saveEpoch}-${state.mode}`, 0.5);
  const fansDelta = useNumericDelta(state.mode === 'm' ? myFansCount : 0, `${saveEpoch}-${state.mode}`, 1);
  const staminaDelta = useNumericDelta(state.mode === 'p' ? myStaminaVal : 0, `${saveEpoch}-${state.mode}`, 0.5);
  const repDelta = useNumericDelta(state.mode === 'p' ? myRepVal : 0, `${saveEpoch}-${state.mode}`, 0.5);
  const myCareerBaseOv = state.mode === 'p' && state.p ? ovMe(state.p) : 60;
  const myCareerFavBoost =
    state.mode === 'p' && state.p && mePlayer
      ? getActiveFavBoost(mePlayer, me, state.p)
      : 0;
  const myCareerDispOv = myCareerBaseOv + myCareerFavBoost;
  const nextNt = state.mode === 'm' && state.natTeam?.active
    ? state.natTeam.fixtures.find((f) => !f.played) ?? null
    : null;

  return (
    <header className="shrink-0 z-30 bg-[var(--surface)]/98 border-t-2 border-t-[var(--g)] border-b border-[var(--line)] shadow-[0_1px_6px_rgba(12,31,21,0.05)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.28)]">
      <div className="w-full mx-auto px-3 sm:px-4 mland:px-2.5 py-1.5 sm:py-2 mland:py-1 flex items-center justify-between gap-2 sm:gap-4 mland:gap-2">
        {/* Zone 1: Club / Player Identity */}
        <div className="flex items-center gap-2 sm:gap-2.5 mland:gap-1.5 min-w-0 flex-1 lg:flex-none lg:max-w-[29%]">
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              onNavigateToTab(state.mode === 'm' ? 'u' : 'k');
            }}
            aria-label="สโมสร"
            title="ข้อมูลสโมสร"
            className="shrink-0 w-10 h-10 mland:w-8 mland:h-8 p-1 mland:p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/90 border border-[var(--line)]/85 flex items-center justify-center [&>svg]:w-[30px] [&>svg]:h-[30px] mland:[&>svg]:w-6 mland:[&>svg]:h-6 cursor-pointer active:scale-95 transition-transform shadow-2xs"
          >
            <ClubCrest name={me.name} size={30} team={me} club={state.club} isMyClub={state.mode === 'm'} />
          </button>
          {state.mode === 'p' && state.p && mePlayer && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onNavigateToTab('p');
              }}
              aria-label="ข้อมูลนักเตะ"
              title={state.p.name}
              className="shrink-0 w-10 h-10 mland:w-8 mland:h-8 p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/90 border border-[var(--line)]/85 flex items-center justify-center [&>svg]:w-[32px] [&>svg]:h-[32px] mland:[&>svg]:w-6 mland:[&>svg]:h-6 cursor-pointer active:scale-95 transition-transform overflow-hidden shadow-2xs"
            >
              <PlayerFace player={mePlayer} team={me} state={state} careerProfile={state.p} size={32} bare />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-xs sm:text-[15px] mland:text-xs truncate font-display leading-tight tracking-tight text-[var(--ink)]">
                {state.mode === 'p' && state.p ? state.p.name : me.name}
              </span>
              {state.mode === 'm' ? (
                <span className={`sm:hidden inline-flex items-center w-[76px] shrink-0 whitespace-nowrap text-[11px] font-extrabold tabular ${state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                  <AnimatedMoney value={state.money} resetKey={saveEpoch} deltaPlacement="below" />
                </span>
              ) : (
                <OvrBadge
                  ov={myCareerDispOv}
                  boost={myCareerFavBoost}
                  size="2xs"
                  prefix="OVR"
                  title={myCareerFavBoost > 0 ? `OVR ${myCareerBaseOv} + ลูกรัก ${myCareerFavBoost} = ${myCareerDispOv}` : undefined}
                  className="sm:hidden"
                />
              )}
            </div>
            <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] flex items-center gap-x-1.5 truncate tabular leading-tight mt-0.5 mland:mt-0">
              {state.mode === 'p' && (
                <>
                  <span className="truncate font-semibold text-[var(--ink)]/80">{me.name}</span>
                  <span aria-hidden="true" className="opacity-40 shrink-0">·</span>
                </>
              )}
              <span className="truncate font-medium">{TN[me.tier]}</span>
              <span aria-hidden="true" className="opacity-40 shrink-0">·</span>
              <span className="shrink-0">ซีซั่น {state.season}</span>
              <span aria-hidden="true" className="opacity-40 shrink-0">·</span>
              <span className="shrink-0">นัด {Math.min(state.md, state.fx.length)}/{state.fx.length}</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Center Club / Player Telemetry Strip */}
        <div className="hidden sm:flex items-center justify-center shrink-0 relative">
          <div className="flex items-stretch h-10 mland:h-8 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/65 border border-[var(--line)]/85 divide-x divide-[var(--line)]/80 overflow-hidden">
            {state.mode === 'm' ? (
              <>
                <button
                  type="button"
                  onClick={() => { SFX.tap(); onNavigateToTab('f'); }}
                  title="ไปหน้าการเงิน"
                  className="w-[104px] mland:w-[86px] shrink-0 overflow-hidden flex flex-col justify-center px-2.5 mland:px-2 py-1 mland:py-0.5 text-left hover:bg-[var(--surface)]/80 transition-colors cursor-pointer"
                >
                  <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] leading-none whitespace-nowrap">งบสโมสร</div>
                  <div className={`text-xs mland:text-[10px] font-extrabold tabular leading-tight mt-0.5 whitespace-nowrap ${state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                    <AnimatedMoney
                      value={state.money}
                      resetKey={saveEpoch}
                      deltaPlacement="none"
                      onDeltaChange={setHudMoneyDelta}
                    />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { SFX.tap(); onNavigateToTab('t'); }}
                  title="ดูตารางคะแนน"
                  className="flex flex-col justify-center items-center px-3 mland:px-2 py-1 mland:py-0.5 text-center hover:bg-[var(--surface)]/80 transition-colors cursor-pointer"
                >
                  <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] leading-none">อันดับ</div>
                  <div className="text-xs mland:text-[10px] font-extrabold tabular text-[var(--ink)] leading-tight mt-0.5">
                    #{myLeagueRank}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { SFX.tap(); onNavigateToTab('u'); }}
                  title="ความเชื่อมั่นบอร์ดบริหาร"
                  className="flex flex-col justify-center items-center px-3 mland:px-2 py-1 mland:py-0.5 text-center hover:bg-[var(--surface)]/80 transition-colors cursor-pointer"
                >
                  <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] leading-none">บอร์ด</div>
                  <div className={`text-xs mland:text-[10px] font-extrabold tabular leading-tight mt-0.5 ${boardToneCls}`}>
                    {boardVal}%
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { SFX.tap(); onNavigateToTab('u'); }}
                  title={`แฟนบอลสโมสร ${fmtFans(myFansCount)} คน`}
                  className="flex flex-col justify-center items-center px-3 mland:px-2 py-1 mland:py-0.5 text-center hover:bg-[var(--surface)]/80 transition-colors cursor-pointer"
                >
                  <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] leading-none">แฟนบอล</div>
                  <div className="text-xs mland:text-[10px] font-extrabold tabular text-[var(--ink)] leading-tight mt-0.5">
                    {fmtFansShort(myFansCount)}
                  </div>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { SFX.tap(); onNavigateToTab('p'); }}
                  title={myCareerFavBoost > 0 ? `OVR ${myCareerBaseOv} + ลูกรัก ${myCareerFavBoost} = ${myCareerDispOv}` : 'ข้อมูลนักเตะ'}
                  className="flex flex-col justify-center items-center px-3 mland:px-2 py-1 mland:py-0.5 text-center hover:bg-[var(--surface)]/80 transition-colors cursor-pointer"
                >
                  <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] leading-none">OVR</div>
                  <OvrBadge
                    ov={myCareerDispOv}
                    boost={myCareerFavBoost}
                    variant="inline"
                    size="xs"
                    title={myCareerFavBoost > 0 ? `OVR ${myCareerBaseOv} + ลูกรัก ${myCareerFavBoost} = ${myCareerDispOv}` : undefined}
                    className="mt-0.5"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => { SFX.tap(); onNavigateToTab('t'); }}
                  title="ดูตารางคะแนนทีม"
                  className="flex flex-col justify-center items-center px-3 mland:px-2 py-1 mland:py-0.5 text-center hover:bg-[var(--surface)]/80 transition-colors cursor-pointer"
                >
                  <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] leading-none">อันดับทีม</div>
                  <div className="text-xs mland:text-[10px] font-extrabold tabular text-[var(--ink)] leading-tight mt-0.5">
                    #{myLeagueRank}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { SFX.tap(); onNavigateToTab('p'); }}
                  title={`ความฟิต ${myStaminaVal}%`}
                  className="flex flex-col justify-center px-3 mland:px-2 py-1 mland:py-0.5 text-left hover:bg-[var(--surface)]/80 transition-colors cursor-pointer"
                >
                  <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] leading-none">ความฟิต</div>
                  <div className="mt-0.5">
                    <StaminaBar
                      value={myStaminaVal}
                      variant="inline"
                      label=""
                      barWidthClass="w-8 sm:w-10 mland:w-7"
                    />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { SFX.tap(); onNavigateToTab('p'); }}
                  title={`แฟนบอลสโมสร ${fmtFans(myFansCount)} คน`}
                  className="flex flex-col justify-center items-center px-3 mland:px-2 py-1 mland:py-0.5 text-center hover:bg-[var(--surface)]/80 transition-colors cursor-pointer"
                >
                  <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] leading-none">ชื่อเสียง</div>
                  <div className="text-xs mland:text-[10px] font-extrabold tabular text-[#b47b00] dark:text-[var(--lamp)] leading-tight mt-0.5">
                    ★ {state.p?.rep ?? 0}
                  </div>
                </button>
              </>
            )}
          </div>
          <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 flex items-center justify-center gap-1.5 whitespace-nowrap">
            {state.mode === 'm' ? (
              <>
                <MoneyDeltaPill delta={hudMoneyDelta} placement="static" />
                <NumericDeltaPill
                  delta={boardDelta}
                  labelPrefix="บอร์ด"
                  format={(n) => `${n > 0 ? `+${Math.round(n)}` : Math.round(n)}%`}
                  placement="static"
                />
                <NumericDeltaPill
                  delta={fansDelta}
                  labelPrefix="แฟน"
                  format={(n) => `${n > 0 ? `+${fmtFansShort(Math.round(n))}` : `-${fmtFansShort(Math.abs(Math.round(n)))}`}`}
                  placement="static"
                />
              </>
            ) : (
              <>
                <NumericDeltaPill
                  delta={staminaDelta}
                  labelPrefix="ฟิต"
                  format={(n) => `${n > 0 ? `+${Math.round(n)}` : Math.round(n)}%`}
                  placement="static"
                />
                <NumericDeltaPill
                  delta={repDelta}
                  labelPrefix="★"
                  format={(n) => `${n > 0 ? `+${Math.round(n)}` : Math.round(n)}`}
                  placement="static"
                />
              </>
            )}
          </div>
        </div>

        {/* Zone 3: Matchday CTA & Settings */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 mland:gap-1 shrink-0 lg:flex-1">
          <PWAInstallButton variant="compact" onToast={onToast} />
          {nextNt && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onOpenNtModal();
              }}
              title={`ทีมชาติไทย: พบ ${nextNt.opponentName} (${nextNt.roundLabel})`}
              className="btn btn-surface h-10 mland:h-8 px-2.5 sm:px-3 mland:px-2 text-xs mland:text-[10px] border-blue-500/45 text-blue-700 dark:text-sky-300 font-extrabold whitespace-nowrap"
            >
              <span>🇹🇭</span>
              <span className="hidden md:inline">ทีมชาติ</span>
            </button>
          )}
          <div className="inline-flex items-stretch shrink-0">
            {nextMatchInfo && (
              <TeamReadinessBadge
                state={state}
                onNavigateToTab={onNavigateToTab}
                onUpdateState={onUpdateState}
                onToast={onToast}
              />
            )}
            <button
              type="button"
              onClick={onTriggerNextStep}
              title={
                nextMatchInfo && nextOppTeam
                  ? `นัดถัดไป: พบ ${nextOppTeam.name} (${nextIsHome ? 'เหย้า' : 'เยือน'})`
                  : 'สรุปผลฤดูกาล'
              }
              className={`btn btn-gold h-10 mland:h-8 px-3 sm:px-4 mland:px-2.5 text-xs sm:text-sm mland:text-[10.5px] ${
                nextMatchInfo ? '!rounded-l-none' : ''
              }`}
            >
            {nextMatchInfo
              ? autoSkipMatch
                ? nextMatchInfo.kind === 'asia'
                  ? '⏭️ ข้ามถ้วยทวีป'
                  : nextMatchInfo.kind === 'sc'
                    ? '⏭️ ข้ามแชมเปี้ยนส์คัพ'
                    : nextMatchInfo.kind === 'lc'
                      ? '⏭️ ข้ามลีกคัพ'
                      : nextMatchInfo.kind === 'dc'
                        ? '⏭️ ข้ามถ้วยดิวิชั่น'
                        : nextMatchInfo.kind === 'cup'
                          ? '⏭️ ข้ามถ้วยปชช.'
                          : `⏭️ ข้ามนัดที่ ${state.md + 1}`
                : nextMatchInfo.kind === 'asia'
                  ? '🌏 แข่งถ้วยทวีป'
                  : nextMatchInfo.kind === 'sc'
                    ? '🏅 แข่งแชมเปี้ยนส์คัพ'
                    : nextMatchInfo.kind === 'lc'
                      ? '🥇 แข่งลีกคัพ'
                      : nextMatchInfo.kind === 'dc'
                        ? '🛡️ แข่งถ้วยดิวิชั่น'
                        : nextMatchInfo.kind === 'cup'
                          ? '🏆 แข่งถ้วยปชช.'
                          : `▶ แข่งนัดที่ ${state.md + 1}`
              : '🏁 สรุปจบฤดูกาล'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              onOpenSettings();
            }}
            aria-label="ตั้งค่า"
            title="ตั้งค่าเกม"
            className="btn-icon w-10 h-10 mland:w-8 mland:h-8"
          >
            <Settings className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
});

export const AppNavDock = React.memo<{
  curTab: MainTab;
  mode: GameMode;
  incomingBadgeCount: number;
  onSelectTab: (key: MainTab) => void;
}>(({ curTab, mode, incomingBadgeCount, onSelectTab }) => {
  const tabs = useMemo<[MainTab, ReactNode, string][]>(
    () =>
      mode === 'm'
        ? [
            ['t', '🏆', 'การแข่งขัน'],
            ['q', '⚽', 'ทีม & แผน'],
            ['r', '🏋️', 'ฝึกซ้อม'],
            ['k', <TransferMarketIcon size={18} className="w-[18px] h-[18px] mland:w-[15px] mland:h-[15px] mland:!text-[13px]" />, 'ตลาด'],
            ['f', '💰', 'การเงิน'],
            ['u', '🏟️', 'สโมสร']
          ]
        : [
            ['t', '🏆', 'การแข่งขัน'],
            ['p', '🌟', 'นักเตะ'],
            ['q', '⚽', 'ทีม & แผน'],
            ['k', '🧭', 'สโมสร']
          ],
    [mode]
  );

  return (
    <nav aria-label="เมนูหลักในเกม" className="shrink-0 z-30 bg-[var(--surface)]/98 border-r border-[var(--line)] order-first w-[74px] mland:w-[64px] h-full px-1.5 mland:px-1 py-2 mland:py-1.5 overflow-y-auto">
      <div className="flex flex-col gap-1.5 mland:gap-1 h-full justify-center">
        {tabs.map(([key, icon, label]) => {
          const active = curTab === key;
          const badgeCount = mode === 'm' && key === 'k' ? incomingBadgeCount : 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectTab(key)}
              className={`relative flex-col py-1.5 px-1 mland:py-1 mland:px-0.5 text-[9.5px] mland:text-[8.5px] flex-1 min-h-[40px] max-h-[60px] mland:min-h-[36px] mland:max-h-[48px] rounded-xl mland:rounded-lg flex items-center justify-center gap-0.5 font-bold cursor-pointer transition-all min-w-0 ${
                active
                  ? 'bg-gradient-to-b from-[#1a9657] to-[#147845] text-white shadow-[0_2px_8px_rgba(21,128,73,0.3)]'
                  : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]/85'
              }`}
            >
              {badgeCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--lamp)] text-[#261900] text-[8.5px] font-black leading-[15px] text-center tabular shadow-2xs">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              )}
              <span className="text-base mland:text-[13px] leading-none inline-flex items-center justify-center">{icon}</span>
              <span className="truncate max-w-full leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});
