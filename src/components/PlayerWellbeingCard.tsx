import React, { useState } from 'react';
import type { GameState, Player, TalkTopicId, Team } from '../types/game';
import { SFX } from '../utils/audioTheme';
import { DeltaValue, EffectText } from './DeltaText';
import {
  CAREER_TALK_TOPICS,
  GOOD_MENTAL_THRESHOLD,
  GOOD_PHYS_THRESHOLD,
  MANAGER_TALK_TOPICS,
  WELLBEING_FACTOR_GUIDE,
  applyPlayerCareAction,
  getActiveFavBoost,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getTeamCareQuotaInfo,
  getTeamFavoritePlayers,
  getWellbeingTierMeta,
  isTeamFavoritePlayer
} from '../engine/wellbeing';

interface LocalReplySnapshot {
  playerName: string;
  topicLabel: string;
  coachLine: string;
  playerReply: string;
  deltaMental: number;
  deltaPhys: number;
}

export const PlayerWellbeingCard: React.FC<{
  player: Player;
  team?: Team | null;
  state: GameState;
  isMyTeam: boolean;
  isMePlayer: boolean;
  isRetired?: boolean;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
  compact?: boolean;
  showCareActions?: boolean;
}> = ({
  player,
  team,
  state,
  isMyTeam,
  isMePlayer,
  isRetired = false,
  onUpdateState,
  onToast,
  compact = false,
  showCareActions = true
}) => {
  const [showGuide, setShowGuide] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TalkTopicId>(
    state.mode === 'p' ? 'coach_chat' : 'encourage'
  );
  const [replyBox, setReplyBox] = useState<LocalReplySnapshot | null>(null);

  const careerP = isMePlayer ? state.p : null;
  const mental = getPlayerMentalScore(player, careerP);
  const phys = getPlayerPhysScore(player, careerP);
  const injured = (isMePlayer && careerP?.inj != null ? careerP.inj : player.inj || 0) > 0;
  const suspended = (isMePlayer && careerP?.sus != null ? careerP.sus : player.sus || 0) > 0;
  const mMeta = getWellbeingTierMeta(mental, 'mental', false);
  const pMeta = getWellbeingTierMeta(phys, 'phys', injured);

  const favPlayersList = getTeamFavoritePlayers(team);
  const isFav = isTeamFavoritePlayer(team, player.n);
  const favBoost = getActiveFavBoost(player, team, careerP);
  const mFactors = (isMePlayer && careerP?.mentalFactors?.length ? careerP.mentalFactors : player.mentalFactors) || [];
  const pFactors = (isMePlayer && careerP?.physFactors?.length ? careerP.physFactors : player.physFactors) || [];

  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  const talkUsed = (isMePlayer && careerP?.careTalkMd != null ? careerP.careTalkMd : player.careTalkMd) === curTurn;
  const physUsed = (isMePlayer && careerP?.carePhysMd != null ? careerP.carePhysMd : player.carePhysMd) === curTurn;
  const careQuota = getTeamCareQuotaInfo(state, team);
  const canCare = (isMyTeam || isMePlayer) && !isRetired;
  const topics = state.mode === 'p' ? CAREER_TALK_TOPICS : MANAGER_TALK_TOPICS;
  const activeTopicMeta = topics.find((t) => t.id === selectedTopic) || topics[0];

  const savedMgrLog =
    state.mode === 'm' && state.trainingPlan?.lastTalkLog?.playerName === player.n
      ? state.trainingPlan.lastTalkLog
      : null;
  const visibleReply =
    replyBox && replyBox.playerName === player.n
      ? replyBox
      : savedMgrLog
        ? {
            playerName: savedMgrLog.playerName,
            topicLabel: savedMgrLog.topicLabel,
            coachLine: savedMgrLog.coachLine,
            playerReply: savedMgrLog.playerReply,
            deltaMental: savedMgrLog.deltaMental,
            deltaPhys: savedMgrLog.deltaPhys
          }
        : null;

  const topMFactor = mFactors[0] || null;
  const topPFactor = pFactors[0] || null;

  return (
    <div
      className={`rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1 ${
        compact ? 'px-2.5 py-1.5 mland:px-2 mland:py-1' : 'px-3 py-2 mland:px-2 mland:py-1.5'
      }`}
    >
      {/* Row 1: Mental Health + Top Factor + Favorite Pill + Guide Toggle */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-nowrap">
        <span className="w-[52px] mland:w-[44px] text-[10.5px] mland:text-[9px] font-bold text-[var(--ink)] shrink-0 whitespace-nowrap">
          🧠 จิตใจ
        </span>

        <div
          className="relative w-12 sm:w-20 mland:w-16 h-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/70 overflow-hidden shrink-0"
          title={`จิตใจ ${mental}/100 (${mMeta.label})`}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${mental}%`, backgroundColor: mMeta.barColor }}
          />
          <div
            title={`เกณฑ์จิตใจดี (${GOOD_MENTAL_THRESHOLD})`}
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink)]/55"
            style={{ left: `${GOOD_MENTAL_THRESHOLD}%` }}
          />
        </div>

        <div className="flex items-baseline gap-1 shrink-0 tabular whitespace-nowrap">
          <span className={`text-[11px] mland:text-[9.5px] font-black ${mMeta.txtCls}`}>
            {mental}
            <span className="hidden sm:inline text-[9px] font-semibold opacity-65">/100</span>
          </span>
          <span className={`text-[9.5px] mland:text-[8px] font-bold ${mMeta.txtCls}`}>· {mMeta.label}</span>
        </div>

        <span
          title={topMFactor ? `${topMFactor.label} (${topMFactor.delta >= 0 ? `+${topMFactor.delta}` : topMFactor.delta})` : player.mentalNote || ''}
          className="hidden sm:inline-flex mland:inline-flex items-center gap-1 min-w-0 flex-1 text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate"
        >
          {topMFactor ? (
            <>
              <span className="truncate">{topMFactor.label}</span>
              <span className={`font-bold tabular shrink-0 ${topMFactor.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                {topMFactor.delta >= 0 ? `+${topMFactor.delta}` : topMFactor.delta}
              </span>
            </>
          ) : (
            <span className="truncate">{player.mentalNote || 'ประเมินจากโอกาสลงสนามล่าสุด'}</span>
          )}
        </span>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {isFav && (
            <span
              title={
                favBoost > 0
                  ? `ลูกรักประจำทีม (${favPlayersList.length} คน) · ปลุกพลัง +${favBoost} OVR ชั่วคราว`
                  : `ลูกรักประจำทีม (${favPlayersList.length} คน) · ต้องการใจ/กาย ≥${GOOD_MENTAL_THRESHOLD} (ตอนนี้ 🧠${mental} / ${injured ? 'บาดเจ็บ' : suspended ? 'แบน' : `💪${phys}`})`
              }
              className={`inline-flex items-center gap-0.5 text-[9.5px] mland:text-[8px] font-extrabold tabular shrink-0 whitespace-nowrap leading-none ${
                favBoost > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-rose-500/80 dark:text-rose-400/80'
              }`}
            >
              {favBoost > 0 ? `💖 ลูกรัก +${favBoost}` : '💖 ลูกรัก'}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              setShowGuide((prev) => !prev);
            }}
            className="text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] hover:text-[var(--ink)] underline decoration-dotted underline-offset-2 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
          >
            {showGuide ? 'ซ่อน ▲' : 'เกณฑ์ ▼'}
          </button>
        </div>
      </div>

      {/* Row 2: Physical Health + Top Factor */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-nowrap">
        <span className="w-[52px] mland:w-[44px] text-[10.5px] mland:text-[9px] font-bold text-[var(--ink)] shrink-0 whitespace-nowrap">
          💪 ร่างกาย
        </span>

        <div
          className="relative w-12 sm:w-20 mland:w-16 h-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/70 overflow-hidden shrink-0"
          title={`ร่างกาย ${phys}/100 (${pMeta.label})`}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${phys}%`, backgroundColor: pMeta.barColor }}
          />
          <div
            title={`เกณฑ์ร่างกายดี (${GOOD_PHYS_THRESHOLD})`}
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink)]/55"
            style={{ left: `${GOOD_PHYS_THRESHOLD}%` }}
          />
        </div>

        <div className="flex items-baseline gap-1 shrink-0 tabular whitespace-nowrap">
          <span className={`text-[11px] mland:text-[9.5px] font-black ${pMeta.txtCls}`}>
            {phys}
            <span className="hidden sm:inline text-[9px] font-semibold opacity-65">/100</span>
          </span>
          <span className={`text-[9.5px] mland:text-[8px] font-bold ${pMeta.txtCls}`}>· {pMeta.label}</span>
        </div>

        <span
          title={topPFactor ? `${topPFactor.label} (${topPFactor.delta >= 0 ? `+${topPFactor.delta}` : topPFactor.delta})` : player.physNote || ''}
          className="inline-flex items-center gap-1 min-w-0 flex-1 text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate"
        >
          {topPFactor ? (
            <>
              <span className="truncate">{topPFactor.label}</span>
              <span className={`font-bold tabular shrink-0 ${topPFactor.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                {topPFactor.delta >= 0 ? `+${topPFactor.delta}` : topPFactor.delta}
              </span>
            </>
          ) : (
            <span className="truncate">{player.physNote || 'ประเมินจากความฟิตและการฟื้นตัวล่าสุด'}</span>
          )}
        </span>
      </div>

      {/* Collapsible Factor Guide & Full Factor Log */}
      {showGuide && (
        <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9.5px] mland:text-[8px] leading-snug">
          <div className="space-y-1">
            {mFactors.length > 0 && (
              <div className="pb-1 border-b border-[var(--line)]/60 space-y-0.5">
                <div className="font-bold text-[var(--ink)]">ปัจจัยจิตใจล่าสุด</div>
                {mFactors.slice(0, 5).map((f, idx) => (
                  <div key={`${f.label}-${idx}`} className="flex items-center justify-between gap-1">
                    <span className="text-[var(--mut)] truncate">{f.label}</span>
                    <span className={`font-bold tabular shrink-0 ${f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                      {f.delta >= 0 ? `+${f.delta}` : f.delta}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="font-bold text-emerald-600 dark:text-emerald-400">🧠 ช่วยให้จิตใจดี (≥ {GOOD_MENTAL_THRESHOLD})</div>
            <ul className="space-y-0.5 text-[var(--mut)] list-disc pl-3.5">
              {WELLBEING_FACTOR_GUIDE.mentalGood.map((txt) => (
                <li key={txt}>{txt}</li>
              ))}
            </ul>
            <div className="font-bold text-[var(--red)] pt-0.5">🧠 ทำให้จิตใจตก</div>
            <ul className="space-y-0.5 text-[var(--mut)] list-disc pl-3.5">
              {WELLBEING_FACTOR_GUIDE.mentalBad.map((txt) => (
                <li key={txt}>{txt}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-1">
            {pFactors.length > 0 && (
              <div className="pb-1 border-b border-[var(--line)]/60 space-y-0.5">
                <div className="font-bold text-[var(--ink)]">ปัจจัยร่างกายล่าสุด</div>
                {pFactors.slice(0, 5).map((f, idx) => (
                  <div key={`${f.label}-${idx}`} className="flex items-center justify-between gap-1">
                    <span className="text-[var(--mut)] truncate">{f.label}</span>
                    <span className={`font-bold tabular shrink-0 ${f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                      {f.delta >= 0 ? `+${f.delta}` : f.delta}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="font-bold text-emerald-600 dark:text-emerald-400">💪 ช่วยให้ร่างกายดี (≥ {GOOD_PHYS_THRESHOLD})</div>
            <ul className="space-y-0.5 text-[var(--mut)] list-disc pl-3.5">
              {WELLBEING_FACTOR_GUIDE.physGood.map((txt) => (
                <li key={txt}>{txt}</li>
              ))}
            </ul>
            <div className="font-bold text-[var(--red)] pt-0.5">💪 ทำให้ร่างกายแย่</div>
            <ul className="space-y-0.5 text-[var(--mut)] list-disc pl-3.5">
              {WELLBEING_FACTOR_GUIDE.physBad.map((txt) => (
                <li key={txt}>{txt}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Interactive Talk & Recovery Actions (for Player Career mode) */}
      {canCare && showCareActions && (
        <div className="space-y-1.5 pt-1 border-t border-[var(--line)]/70">
          <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[8.5px]">
            <span className="font-bold text-[var(--ink)]">💬 เลือกแนวทางพูดคุย &amp; ฟื้นฟู</span>
            {state.mode === 'm' && (
              <span className={`font-bold tabular ${careQuota.remaining > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                โควตาดูแลทีม {careQuota.remaining}/{careQuota.limit}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {topics.map((tp) => {
              const active = activeTopicMeta.id === tp.id;
              return (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setSelectedTopic(tp.id);
                  }}
                  title={tp.desc}
                  className={`px-2 py-1 mland:py-0.5 rounded-lg text-[10.5px] mland:text-[8.5px] font-bold border cursor-pointer transition-colors ${
                    active
                      ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--g)]'
                      : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  {tp.icon} {tp.short}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] px-0.5">
            <EffectText text={`${activeTopicMeta.effectHint} · ${activeTopicMeta.desc}`} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={talkUsed || (state.mode === 'm' && careQuota.remaining <= 0)}
              onClick={() => {
                let out: ReturnType<typeof applyPlayerCareAction> = {
                  ok: false,
                  msg: '',
                  boostNow: 0,
                  deltaMental: 0,
                  deltaPhys: 0
                };
                onUpdateState((d) => {
                  out = applyPlayerCareAction(d, player.n, 'talk', activeTopicMeta.id);
                });
                if (out.ok) {
                  if (out.boostNow > 0 && favBoost === 0) SFX.win();
                  else SFX.confirm();
                  if (out.coachLine && out.playerReply) {
                    setReplyBox({
                      playerName: player.n,
                      topicLabel: out.topicLabel || activeTopicMeta.label,
                      coachLine: out.coachLine,
                      playerReply: out.playerReply,
                      deltaMental: out.deltaMental,
                      deltaPhys: out.deltaPhys
                    });
                  }
                } else SFX.tap();
                if (out.msg) onToast(out.msg);
              }}
              className="btn btn-xs btn-primary flex-1 min-w-[140px] disabled:opacity-45"
            >
              {talkUsed
                ? '✓ พูดคุยรอบนี้แล้ว'
                : state.mode === 'm' && careQuota.remaining <= 0
                  ? 'โควตาดูแลนัดนี้หมด'
                  : `${activeTopicMeta.icon} ${activeTopicMeta.label}`}
            </button>
            <button
              type="button"
              disabled={physUsed || (state.mode === 'm' && careQuota.remaining <= 0)}
              onClick={() => {
                let out: ReturnType<typeof applyPlayerCareAction> = {
                  ok: false,
                  msg: '',
                  boostNow: 0,
                  deltaMental: 0,
                  deltaPhys: 0
                };
                onUpdateState((d) => {
                  out = applyPlayerCareAction(d, player.n, 'physio_care');
                });
                if (out.ok) {
                  if (out.boostNow > 0 && favBoost === 0) SFX.win();
                  else SFX.confirm();
                  if (out.coachLine && out.playerReply) {
                    setReplyBox({
                      playerName: player.n,
                      topicLabel: out.topicLabel || 'ฟื้นฟูกล้ามเนื้อ',
                      coachLine: out.coachLine,
                      playerReply: out.playerReply,
                      deltaMental: out.deltaMental,
                      deltaPhys: out.deltaPhys
                    });
                  }
                } else SFX.tap();
                if (out.msg) onToast(out.msg);
              }}
              className="btn btn-xs btn-secondary flex-1 min-w-[130px] disabled:opacity-45"
            >
              {physUsed
                ? '✓ ฟื้นฟูรอบนี้แล้ว'
                : state.mode === 'm' && careQuota.remaining <= 0
                  ? 'โควตาดูแลนัดนี้หมด'
                  : '🧊 ฟื้นฟูกล้ามเนื้อ (+กาย)'}
            </button>
          </div>

          {visibleReply && (
            <div className="p-2 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)] space-y-1 text-[10.5px] mland:text-[8.5px]">
              <div className="flex items-center justify-between gap-2 font-bold">
                <span className="text-[var(--g)]">🗣️ บทสนทนาล่าสุด · {visibleReply.topicLabel}</span>
                <span className="tabular font-bold">
                  {visibleReply.deltaMental !== 0 && (
                    <span>
                      ใจ <DeltaValue value={visibleReply.deltaMental} />
                    </span>
                  )}
                  {visibleReply.deltaMental !== 0 && visibleReply.deltaPhys !== 0 ? ' · ' : ''}
                  {visibleReply.deltaPhys !== 0 && (
                    <span>
                      กาย <DeltaValue value={visibleReply.deltaPhys} />
                    </span>
                  )}
                </span>
              </div>
              <div className="text-[var(--mut)]">{visibleReply.coachLine}</div>
              <div className="text-[var(--ink)] font-semibold">{visibleReply.playerReply}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
