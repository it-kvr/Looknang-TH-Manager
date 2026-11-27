import React, { useState } from 'react';
import type { GameState, Player, TalkTopicId, Team } from '../types/game';
import { SFX } from '../utils/audioTheme';
import {
  CAREER_TALK_TOPICS,
  GOOD_MENTAL_THRESHOLD,
  GOOD_PHYS_THRESHOLD,
  MANAGER_TALK_TOPICS,
  WELLBEING_FACTOR_GUIDE,
  applyPlayerCareAction,
  getActiveFavBoost,
  getFavSwitchCooldownRemaining,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getTeamCareQuotaInfo,
  getWellbeingTierMeta,
  isPlayerMentalGood,
  isPlayerPhysGood,
  setTeamFavoritePlayer
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
}> = ({
  player,
  team,
  state,
  isMyTeam,
  isMePlayer,
  isRetired = false,
  onUpdateState,
  onToast,
  compact = false
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
  const mGood = isPlayerMentalGood(player, careerP);
  const pGood = isPlayerPhysGood(player, careerP);
  const mMeta = getWellbeingTierMeta(mental, 'mental', false);
  const pMeta = getWellbeingTierMeta(phys, 'phys', injured);

  const isFav = Boolean(team && team.favPlayer === player.n);
  const favBoost = getActiveFavBoost(player, team, careerP);
  const mFactors = (isMePlayer && careerP?.mentalFactors?.length ? careerP.mentalFactors : player.mentalFactors) || [];
  const pFactors = (isMePlayer && careerP?.physFactors?.length ? careerP.physFactors : player.physFactors) || [];

  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  const talkUsed = (isMePlayer && careerP?.careTalkMd != null ? careerP.careTalkMd : player.careTalkMd) === curTurn;
  const physUsed = (isMePlayer && careerP?.carePhysMd != null ? careerP.carePhysMd : player.carePhysMd) === curTurn;
  const careQuota = getTeamCareQuotaInfo(state, team);
  const favCooldown = getFavSwitchCooldownRemaining(state, team);
  const canManageFav = state.mode === 'm' && isMyTeam && Boolean(team) && !isRetired;
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

  return (
    <div
      className={`rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5 ${
        compact ? 'p-2.5 mland:p-2' : 'p-3 mland:p-2'
      }`}
    >
      {/* Header & Factor Guide Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)] truncate">
            💖 สภาพจิตใจ·ร่างกาย &amp; ลูกรัก
          </span>
          {favBoost > 0 && (
            <span className="px-1.5 py-[1px] rounded-md bg-rose-600 text-white text-[10px] mland:text-[8.5px] font-black tabular shrink-0">
              +{favBoost} OVR ชั่วคราว
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            SFX.tap();
            setShowGuide((prev) => !prev);
          }}
          className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)] hover:text-[var(--ink)] underline decoration-dotted underline-offset-4 cursor-pointer shrink-0 transition-colors"
        >
          {showGuide ? 'ซ่อนเกณฑ์ ▲' : 'ดูปัจจัยใจ/กาย ▼'}
        </button>
      </div>

      {/* Collapsible Factor Guide */}
      {showGuide && (
        <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10px] mland:text-[8.5px] leading-snug">
          <div className="space-y-1">
            <div className="font-bold text-emerald-600 dark:text-emerald-400">🧠 ปัจจัยช่วยให้จิตใจดี (≥ {GOOD_MENTAL_THRESHOLD})</div>
            <ul className="space-y-0.5 text-[var(--mut)] list-disc pl-3.5">
              {WELLBEING_FACTOR_GUIDE.mentalGood.map((txt) => (
                <li key={txt}>{txt}</li>
              ))}
            </ul>
            <div className="font-bold text-[var(--red)] pt-1">🧠 สิ่งที่ทำให้จิตใจตก</div>
            <ul className="space-y-0.5 text-[var(--mut)] list-disc pl-3.5">
              {WELLBEING_FACTOR_GUIDE.mentalBad.map((txt) => (
                <li key={txt}>{txt}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-1">
            <div className="font-bold text-emerald-600 dark:text-emerald-400">💪 ปัจจัยช่วยให้ร่างกายดี (≥ {GOOD_PHYS_THRESHOLD})</div>
            <ul className="space-y-0.5 text-[var(--mut)] list-disc pl-3.5">
              {WELLBEING_FACTOR_GUIDE.physGood.map((txt) => (
                <li key={txt}>{txt}</li>
              ))}
            </ul>
            <div className="font-bold text-[var(--red)] pt-1">💪 สิ่งที่ทำให้ร่างกายแย่</div>
            <ul className="space-y-0.5 text-[var(--mut)] list-disc pl-3.5">
              {WELLBEING_FACTOR_GUIDE.physBad.map((txt) => (
                <li key={txt}>{txt}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Favorite Player Banner */}
      <div
        className={`px-2.5 py-2 mland:px-2 mland:py-1.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
          isFav && favBoost > 0
            ? 'bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-emerald-500/10 border-rose-500/40'
            : isFav
              ? 'bg-[var(--lamp-soft)]/60 border-[var(--lamp)]/50'
              : 'bg-[var(--surface-2)]/55 border-[var(--line)]'
        }`}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-[11px] mland:text-[9.5px] font-bold flex items-center gap-1.5 flex-wrap text-[var(--ink)]">
            {isFav ? (
              favBoost > 0 ? (
                <>
                  <span className="text-rose-600 dark:text-rose-400">💖 ลูกรักประจำทีม · ปลุกพลังทำงาน</span>
                  <span className="text-[10px] mland:text-[8.5px] font-black text-rose-600 dark:text-rose-400 tabular">
                    (+{favBoost} OVR ชั่วคราว)
                  </span>
                </>
              ) : (
                <span className="text-amber-800 dark:text-[var(--lamp)]">
                  💖 ลูกรักประจำทีม · รอเงื่อนไขใจ/กาย ≥ {GOOD_MENTAL_THRESHOLD}
                </span>
              )
            ) : (
              <span className="text-[var(--mut)]">
                {team?.favPlayer ? `ลูกรักปัจจุบัน: ${team.favPlayer}` : 'ยังไม่มีลูกรักประจำทีม (เลือกได้ทีมละ 1 คน)'}
              </span>
            )}
          </div>
          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug">
            {isFav ? (
              favBoost > 0 ? (
                <span>จิตใจ {mental} และ กาย {phys} ผ่านเกณฑ์ทั้งคู่ · มีผลในการแข่งจริง</span>
              ) : (
                <span className="text-amber-800 dark:text-[var(--lamp)] font-medium">
                  ขาด:{' '}
                  {[
                    !mGood ? `จิตใจ ≥ ${GOOD_MENTAL_THRESHOLD} (ตอนนี้ ${mental})` : null,
                    injured ? 'กำลังบาดเจ็บ' : suspended ? 'ติดโทษแบน' : !pGood ? `กาย ≥ ${GOOD_PHYS_THRESHOLD} (ตอนนี้ ${phys})` : null
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )
            ) : (
              <span>ลูกรักที่สุขภาพใจ &amp; กาย ≥ {GOOD_MENTAL_THRESHOLD} จะสุ่มรับพลัง +5 ถึง +10 OVR ชั่วคราว</span>
            )}
          </div>
        </div>

        {canManageFav && team && (
          <button
            type="button"
            disabled={!isFav && favCooldown > 0}
            title={!isFav && favCooldown > 0 ? `ติดคูลดาวน์เปลี่ยนลูกรัก รออีก ${favCooldown} นัด` : undefined}
            onClick={() => {
              let res = { changed: false, favName: null as string | null, boost: 0, mentalGood: false, physGood: false, cooldownRemaining: 0 };
              onUpdateState((d) => {
                const t = d.teams[team.id];
                if (!t) return;
                res = setTeamFavoritePlayer(d, t, isFav ? null : player.n);
              });
              if (!res.changed && !isFav && res.cooldownRemaining > 0) {
                SFX.tap();
                onToast(`⏳ เพิ่งเปลี่ยนลูกรักไป รออีก ${res.cooldownRemaining} นัดจึงจะตั้งคนใหม่ได้`);
                return;
              }
              if (isFav) {
                SFX.tap();
                onToast(`💔 ยกเลิก ${player.n} จากลูกรักแล้ว (รอ 3 นัดก่อนตั้งใหม่)`);
              } else {
                if (res.boost > 0) SFX.win();
                else SFX.confirm();
                onToast(
                  res.boost > 0
                    ? `💖 ตั้ง ${player.n} เป็นลูกรัก! รับพลังชั่วคราว +${res.boost} OVR`
                    : `💖 ตั้ง ${player.n} เป็นลูกรักแล้ว (ดูแลใจ/กาย ≥72 เพื่อปลุกพลัง +5..+10)`
                );
              }
            }}
            className={`btn btn-xs shrink-0 whitespace-nowrap disabled:opacity-50 ${
              isFav
                ? 'bg-rose-500/15 border border-rose-500/45 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25'
                : 'btn-gold'
            }`}
          >
            {isFav ? '💔 ปลดลูกรัก' : favCooldown > 0 ? `⏳ รอ ${favCooldown} นัด` : '💖 ตั้งเป็นลูกรัก'}
          </button>
        )}
      </div>

      {/* 2-Column Mental & Physical Health Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5">
        {/* Mental Health */}
        <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/45 border border-[var(--line)] space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)]">🧠 สุขภาพจิตใจ</span>
            <div className="flex items-center gap-1.5 shrink-0 tabular">
              <span className={`text-[10px] mland:text-[8.5px] font-bold ${mMeta.txtCls}`}>{mMeta.label}</span>
              <span className="text-[10px] opacity-30">·</span>
              <span className={`text-xs mland:text-[10.5px] font-black ${mMeta.txtCls}`}>{mental}/100</span>
            </div>
          </div>
          <div className="relative h-2 rounded-full bg-[var(--surface)] border border-[var(--line)]/60 overflow-hidden">
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
          <div className="space-y-0.5">
            {mFactors.length > 0 ? (
              mFactors.slice(0, 3).map((f, idx) => (
                <div key={`${f.label}-${idx}`} className="flex items-center justify-between gap-1 text-[10px] mland:text-[8.5px]">
                  <span className="text-[var(--mut)] truncate">{f.label}</span>
                  <span className={`font-bold tabular shrink-0 ${f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                    {f.delta >= 0 ? `+${f.delta}` : f.delta}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">
                {player.mentalNote || 'ประเมินสภาพจิตใจตามโอกาสลงสนามและผลงานล่าสุด'}
              </div>
            )}
          </div>
        </div>

        {/* Physical Health */}
        <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/45 border border-[var(--line)] space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)]">💪 สุขภาพกาย</span>
            <div className="flex items-center gap-1.5 shrink-0 tabular">
              <span className={`text-[10px] mland:text-[8.5px] font-bold ${pMeta.txtCls}`}>{pMeta.label}</span>
              <span className="text-[10px] opacity-30">·</span>
              <span className={`text-xs mland:text-[10.5px] font-black ${pMeta.txtCls}`}>{phys}/100</span>
            </div>
          </div>
          <div className="relative h-2 rounded-full bg-[var(--surface)] border border-[var(--line)]/60 overflow-hidden">
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
          <div className="space-y-0.5">
            {pFactors.length > 0 ? (
              pFactors.slice(0, 3).map((f, idx) => (
                <div key={`${f.label}-${idx}`} className="flex items-center justify-between gap-1 text-[10px] mland:text-[8.5px]">
                  <span className="text-[var(--mut)] truncate">{f.label}</span>
                  <span className={`font-bold tabular shrink-0 ${f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                    {f.delta >= 0 ? `+${f.delta}` : f.delta}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">
                {player.physNote || 'ประเมินความฟิต การฟื้นตัว และสภาพร่างกายล่าสุด'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Talk & Recovery Actions */}
      {canCare && (
        <div className="space-y-1.5 pt-1 border-t border-[var(--line)]/70">
          <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[8.5px]">
            <span className="font-bold text-[var(--ink)]">💬 เลือกแนวทางพูดคุย &amp; ฟื้นฟู</span>
            {state.mode === 'm' && (
              <span className={`font-bold tabular ${careQuota.remaining > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                โควตาดูแลทีม {careQuota.remaining}/{careQuota.limit}
              </span>
            )}
          </div>

          {/* Topic Selector Pills (Interactive choices) */}
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
            {activeTopicMeta.effectHint} · {activeTopicMeta.desc}
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
                <span className="tabular text-[var(--ink)]">
                  {visibleReply.deltaMental !== 0
                    ? `ใจ ${visibleReply.deltaMental > 0 ? `+${visibleReply.deltaMental}` : visibleReply.deltaMental}`
                    : ''}
                  {visibleReply.deltaMental !== 0 && visibleReply.deltaPhys > 0 ? ' · ' : ''}
                  {visibleReply.deltaPhys > 0 ? `กาย +${visibleReply.deltaPhys}` : ''}
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
