import React, { useEffect, useMemo, useState } from 'react';
import type {
  GameState,
  NavIntent,
  Player,
  TalkTopicId,
  Team,
  TeamTalkId
} from '../types/game';
import {
  PLAYER_PERSONALITIES,
  getCountryMetaByCode,
  getTeamTrainingPlan
} from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { ef, getShirtNo, xi } from '../engine/playerCore';
import { getStaffState } from '../engine/simulation';
import {
  GOOD_MENTAL_THRESHOLD,
  GOOD_PHYS_THRESHOLD,
  MANAGER_TALK_TOPICS,
  TEAM_TALK_OPTIONS,
  applyPlayerCareAction,
  applyTeamTalkAction,
  getActiveFavBoost,
  getPersonalityCareHint,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getTeamCareQuotaInfo,
  getTeamFavoriteNames,
  getTeamFavoritePlayers,
  getWellbeingTierMeta,
  isPlayerMentalGood,
  isPlayerPhysGood,
  resolvePersonalityId
} from '../engine/wellbeing';
import { DeltaValue, EffectText } from './DeltaText';
import { NavFocusBadge } from './NavFocusBanner';
import { PlayerFace } from './SvgVisuals';
import { PositionBadge } from './PositionBadge';
import { CaptainBadge } from './CaptainBadge';
import { getStaminaMeta } from './StaminaBar';
import { TeamOfficeView } from './TeamOfficeView';

type TalkFilter = 'all' | 'stressed' | 'tired' | 'fav';
type TalkRoomId = 'office' | 'meeting';

export const ClubTalkRoomsPanel: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer?: (player: Player, team: Team | null) => void;
  onToast: (msg: string) => void;
  navIntent?: NavIntent | null;
  isFocused: (id: string) => boolean;
}> = ({ state, onUpdateState, onInspectPlayer, onToast, navIntent, isFocused }) => {
  const me = state.teams[state.me];
  const [activeRoom, setActiveRoom] = useState<TalkRoomId>('office');
  const [talkFilter, setTalkFilter] = useState<TalkFilter>('all');
  const [selectedTalkPlayer, setSelectedTalkPlayer] = useState<string>(
    () => getTeamFavoriteNames(me)[0] || me.sq[0]?.n || ''
  );

  useEffect(() => {
    if (!navIntent) return;
    if (navIntent.focus === 'team-talk') {
      setActiveRoom('meeting');
    } else if (navIntent.focus?.startsWith('talk:')) {
      const targetName = navIntent.focus.slice(5);
      setActiveRoom('office');
      setTalkFilter('all');
      if (targetName) setSelectedTalkPlayer(targetName);
    }
  }, [navIntent]);

  const starters = useMemo(() => xi(me), [me]);
  const starterNames = useMemo(() => new Set(starters.map((s) => s.n)), [starters]);
  const plan = getTeamTrainingPlan(state);
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);
  const teamTalkUsed = plan.teamTalkMd === curTurn;
  const medLv = state.med ?? 1;

  const avgMental = me.sq.length
    ? Math.round(me.sq.reduce((s, q) => s + getPlayerMentalScore(q, null), 0) / me.sq.length)
    : 70;
  const avgPhys = me.sq.length
    ? Math.round(me.sq.reduce((s, q) => s + getPlayerPhysScore(q, null), 0) / me.sq.length)
    : 75;
  const lowMentalPlayers = useMemo(
    () =>
      me.sq
        .filter((q) => getPlayerMentalScore(q, null) < 60)
        .sort((a, b) => getPlayerMentalScore(a, null) - getPlayerMentalScore(b, null)),
    [me.sq]
  );

  const careQuota = useMemo(() => getTeamCareQuotaInfo(state, me), [state, me]);
  const favPlayersList = useMemo(() => getTeamFavoritePlayers(me), [me]);
  const favNamesSet = useMemo(() => new Set(favPlayersList.map((q) => q.n)), [favPlayersList]);
  const favBoostedList = useMemo(
    () => favPlayersList.filter((q) => getActiveFavBoost(q, me, null) > 0),
    [favPlayersList, me]
  );

  const sortedTalkPlayers = useMemo(() => {
    const base = me.sq.filter((q) => {
      if (talkFilter === 'stressed') return getPlayerMentalScore(q, null) < GOOD_MENTAL_THRESHOLD;
      if (talkFilter === 'tired') {
        return q.inj > 0 || getPlayerPhysScore(q, null) < GOOD_PHYS_THRESHOLD || (q.fit ?? 100) < 74;
      }
      if (talkFilter === 'fav') return favNamesSet.has(q.n) || starterNames.has(q.n);
      return true;
    });
    return base.sort((a, b) => {
      const aFav = favNamesSet.has(a.n) ? 1 : 0;
      const bFav = favNamesSet.has(b.n) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      const aNeed =
        (getPlayerMentalScore(a, null) < 60 ? 2 : 0) +
        (a.inj > 0 || getPlayerPhysScore(a, null) < 62 ? 2 : 0);
      const bNeed =
        (getPlayerMentalScore(b, null) < 60 ? 2 : 0) +
        (b.inj > 0 || getPlayerPhysScore(b, null) < 62 ? 2 : 0);
      if (aNeed !== bNeed) return bNeed - aNeed;
      return b.ov - a.ov;
    });
  }, [me.sq, favNamesSet, talkFilter, starterNames]);

  const talkFilterCounts = useMemo(
    () => ({
      all: me.sq.length,
      stressed: me.sq.filter((q) => getPlayerMentalScore(q, null) < GOOD_MENTAL_THRESHOLD).length,
      tired: me.sq.filter(
        (q) => q.inj > 0 || getPlayerPhysScore(q, null) < GOOD_PHYS_THRESHOLD || (q.fit ?? 100) < 74
      ).length,
      fav: me.sq.filter((q) => favNamesSet.has(q.n) || starterNames.has(q.n)).length
    }),
    [me.sq, favNamesSet, starterNames]
  );

  const talkTargetPlayer =
    me.sq.find((q) => q.n === selectedTalkPlayer) || sortedTalkPlayers[0] || me.sq[0];

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

  const enterOfficeWithPlayer = (playerName: string) => {
    SFX.tap();
    setTalkFilter('all');
    setSelectedTalkPlayer(playerName);
    setActiveRoom('office');
  };

  const usedOpt = plan.lastTeamTalkId
    ? TEAM_TALK_OPTIONS.find((x) => x.id === plan.lastTeamTalkId)
    : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Room Selector Header: Private Office vs Team Meeting Room */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 mland:px-2.5 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
        <div className="seg-bar grid grid-cols-2 flex-1 sm:flex-none min-w-[260px]">
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              setActiveRoom('office');
            }}
            className={`seg-btn flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeRoom === 'office' ? 'seg-btn-active' : 'hover:bg-[var(--surface-2)]'
            }`}
          >
            <span>🚪 ห้องออฟฟิศ (คุยส่วนตัว)</span>
            <span
              className={`text-[10px] mland:text-[8.5px] font-black tabular ${
                activeRoom === 'office'
                  ? 'opacity-90'
                  : careQuota.remaining > 0
                    ? 'text-[var(--g)]'
                    : 'text-[var(--mut)]'
              }`}
            >
              {careQuota.remaining}/{careQuota.limit}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              setActiveRoom('meeting');
            }}
            className={`seg-btn flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeRoom === 'meeting' ? 'seg-btn-active' : 'hover:bg-[var(--surface-2)]'
            }`}
          >
            <span>🏛️ ห้องประชุมทีม (คุยรวม)</span>
            <span
              className={`text-[10px] mland:text-[8.5px] font-black tabular ${
                activeRoom === 'meeting'
                  ? 'opacity-90'
                  : !teamTalkUsed
                    ? 'text-[var(--g)]'
                    : 'text-[var(--mut)]'
              }`}
            >
              {teamTalkUsed ? '✓' : '1/1'}
            </span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] mland:text-[9px] text-[var(--mut)] tabular shrink-0">
          <span>
            ขวัญทีม <b className="text-[var(--ink)]">{state.mor ?? 55}%</b>
          </span>
          <span className="opacity-30">·</span>
          <span>
            ใจเฉลี่ย <b className={getWellbeingTierMeta(avgMental, 'mental', false).txtCls}>{avgMental}</b>
          </span>
          <span className="opacity-30">·</span>
          <span>
            กายเฉลี่ย <b className={getWellbeingTierMeta(avgPhys, 'phys', false).txtCls}>{avgPhys}</b>
          </span>
          {favPlayersList.length > 0 && (
            <>
              <span className="opacity-30">·</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                💖 ลูกรักปลุกพลัง {favBoostedList.length}/{favPlayersList.length}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ==================== ROOM 1: MANAGER'S PRIVATE OFFICE (1-ON-1) ==================== */}
      {activeRoom === 'office' && talkTargetPlayer ? (
        <div className="grid grid-cols-1 grid-rows-[168px_minmax(0,1fr)] md:grid-cols-[236px_1fr] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[264px_1fr] mland:grid-cols-[202px_1fr] mland:grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-1.5 items-stretch flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Squad Directory outside the Office Door */}
          <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col gap-1.5 mland:gap-1 h-full min-h-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
              <h3 className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] truncate">
                👥 เรียกนักเตะเข้าออฟฟิศ
              </h3>
              <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular shrink-0">
                {sortedTalkPlayers.length}/{me.sq.length} คน
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 shrink-0">
              {([
                ['all', 'ทั้งหมด'],
                ['stressed', `ใจต่ำ${talkFilterCounts.stressed > 0 ? ` (${talkFilterCounts.stressed})` : ''}`],
                ['tired', `ล้า/เจ็บ${talkFilterCounts.tired > 0 ? ` (${talkFilterCounts.tired})` : ''}`],
                ['fav', 'หลัก/รัก']
              ] as [TalkFilter, string][]).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setTalkFilter(k);
                  }}
                  className={`py-1 px-1 rounded-lg text-[10px] mland:text-[8px] font-bold border cursor-pointer truncate whitespace-nowrap transition-colors ${
                    talkFilter === k
                      ? 'bg-[var(--g)] text-white border-[var(--g)]'
                      : 'bg-[var(--surface-2)]/70 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-y-auto flex-1 min-h-0">
              {sortedTalkPlayers.length === 0 ? (
                <div className="p-4 text-center text-[11px] mland:text-[9px] text-[var(--mut)]">
                  ไม่มีนักเตะในกลุ่มนี้
                </div>
              ) : (
                sortedTalkPlayers.map((q) => {
                  const active = q.n === talkTargetPlayer.n;
                  const m = getPlayerMentalScore(q, null);
                  const p = getPlayerPhysScore(q, null);
                  const mMeta = getWellbeingTierMeta(m, 'mental', false);
                  const pMeta = getWellbeingTierMeta(p, 'phys', q.inj > 0);
                  const isFav = favNamesSet.has(q.n);
                  const favBoost = isFav ? getActiveFavBoost(q, me, null) : 0;
                  const isStarter = starterNames.has(q.n);
                  const talkDone = q.careTalkMd === curTurn;
                  const physDone = q.carePhysMd === curTurn;
                  const fitPct = Math.round(q.fit ?? 100);
                  const natMeta = q.nat && q.nat !== 'TH' ? getCountryMetaByCode(q.nat) : null;

                  return (
                    <button
                      key={q.n}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSelectedTalkPlayer(q.n);
                      }}
                      className={`w-full px-2 py-1.5 mland:px-1.5 mland:py-1 flex items-center gap-2 mland:gap-1.5 text-left cursor-pointer transition-colors ${
                        active ? 'bg-[var(--g-soft)]' : 'hover:bg-[var(--surface-2)]/75'
                      }`}
                    >
                      <PlayerFace player={q} team={me} state={state} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] mland:text-[9.5px] font-bold flex items-center gap-1 min-w-0">
                          <PositionBadge role={q.ro} size="2xs" />
                          {natMeta && (
                            <span className="text-[10.5px] mland:text-[8.5px] shrink-0" title={natMeta.country}>
                              {natMeta.flag}
                            </span>
                          )}
                          <span className="truncate">{q.n}</span>
                          {me.cap === q.n && <CaptainBadge team={me} state={state} size="xs" className="shrink-0" />}
                          {isFav && (
                            <span
                              className={`text-[10px] mland:text-[8px] font-black shrink-0 ${
                                favBoost > 0 ? 'text-rose-600 dark:text-rose-400' : ''
                              }`}
                              title={favBoost > 0 ? `ลูกรักปลุกพลัง +${favBoost} OVR` : 'ลูกรักประจำทีม'}
                            >
                              💖{favBoost > 0 ? `+${favBoost}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] mland:text-[8px] tabular flex items-center justify-between gap-1 text-[var(--mut)] mt-0.5">
                          <span className="inline-flex items-center gap-1 truncate">
                            <span className={isStarter ? 'text-[var(--g)] font-semibold' : ''}>
                              {isStarter ? 'ตัวจริง' : 'สำรอง'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className={`font-bold ${mMeta.txtCls}`}>🧠{m}</span>
                            <span className={`font-bold ${pMeta.txtCls}`}>💪{p}</span>
                            <span aria-hidden="true">·</span>
                            <span className={getStaminaMeta(fitPct).txtCls}>{fitPct}%</span>
                          </span>
                          <span className="shrink-0 font-bold">
                            {q.inj > 0 ? (
                              <span className="text-[var(--red)]">เจ็บ{q.inj}</span>
                            ) : (q.sus || 0) > 0 ? (
                              <span className="text-[var(--red)]">แบน</span>
                            ) : talkDone || physDone ? (
                              <span className="text-[var(--g)]">
                                ✓{talkDone ? 'คุย' : ''}
                                {physDone ? 'กาย' : ''}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Private Office Interior */}
          {(() => {
            const q = talkTargetPlayer;
            const m = getPlayerMentalScore(q, null);
            const p = getPlayerPhysScore(q, null);
            const mMeta = getWellbeingTierMeta(m, 'mental', false);
            const pMeta = getWellbeingTierMeta(p, 'phys', q.inj > 0);
            const isFav = favNamesSet.has(q.n);
            const favBoost = getActiveFavBoost(q, me, null);
            const talkDone = q.careTalkMd === curTurn;
            const physDone = q.carePhysMd === curTurn;
            const isCap = me.cap === q.n;
            const isStarter = starterNames.has(q.n);
            const persId = resolvePersonalityId(q, null);
            const persDef = PLAYER_PERSONALITIES[persId] || PLAYER_PERSONALITIES[3];
            const persHint = getPersonalityCareHint(persId);
            const effOv = ef(q);
            const shirtNo = getShirtNo(me, q);
            const fitPct = Math.round(q.fit ?? 100);
            const natMeta = getCountryMetaByCode(q.nat || 'TH') || getCountryMetaByCode('TH');
            const roleLabel =
              q.con?.role === 'key' ? 'ตัวหลัก' : q.con?.role === 'pro' ? 'ดาวรุ่ง' : 'หมุนเวียน';
            const avgRating = (q.sra || 0) > 0 ? ((q.srs || 0) / q.sra!).toFixed(1) : null;
            const mGood = isPlayerMentalGood(q, null);
            const pGood = isPlayerPhysGood(q, null);
            const mFactors = q.mentalFactors || [];
            const pFactors = q.physFactors || [];
            const activeLog = plan.lastTalkLog?.playerName === q.n ? plan.lastTalkLog : null;
            const otherRecentLog =
              !activeLog && plan.lastTalkLog && plan.lastTalkLog.playerName !== q.n ? plan.lastTalkLog : null;
            const stf = getStaffState(state);
            const physMin = 5 + Math.floor(medLv / 4) + (stf.physio ? 1 : 0);
            const physMax = physMin + 2;

            return (
              <div className="min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden">
                {/* Office Title Bar */}
                <div className="shrink-0 px-3 py-2 mland:px-2.5 mland:py-1 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-2)]/35">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-extrabold text-xs sm:text-sm mland:text-[11px] text-[var(--ink)] truncate">
                      🚪 ห้องออฟฟิศผู้จัดการทีม · คุยส่วนตัว 1-ต่อ-1
                    </h3>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 text-[10.5px] mland:text-[8.5px] tabular">
                    <span>
                      โควตาดูแล{' '}
                      <b className={careQuota.remaining > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
                        {careQuota.remaining}/{careQuota.limit}
                      </b>
                    </span>
                    {onInspectPlayer && (
                      <>
                        <span className="opacity-30">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onInspectPlayer(q, me);
                          }}
                          className="font-bold text-[var(--g)] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          โปรไฟล์นักเตะ ↗
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Scrollable Office Dossier & Actions Interior */}
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 mland:px-2.5 mland:py-1.5 space-y-2.5 mland:space-y-1.5">
                  {/* 1. Player Dossier Header */}
                  <div className="pb-2.5 mland:pb-1.5 border-b border-[var(--line)] space-y-1.5 mland:space-y-1">
                    <div className="flex items-start justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!onInspectPlayer) return;
                          SFX.tap();
                          onInspectPlayer(q, me);
                        }}
                        className="flex items-center gap-2.5 mland:gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                        title="เปิดการ์ดข้อมูลนักเตะ"
                      >
                        <div className="relative shrink-0">
                          <PlayerFace player={q} team={me} state={state} size={42} />
                          <span className="block text-center text-[9.5px] mland:text-[8px] font-extrabold text-[var(--mut)] tabular leading-none mt-0.5">
                            #{shirtNo}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap text-sm mland:text-xs font-extrabold leading-tight">
                            <PositionBadge role={q.ro} size="xs" />
                            {natMeta && (
                              <span className="text-xs mland:text-[10px] shrink-0" title={natMeta.country}>
                                {natMeta.flag}
                              </span>
                            )}
                            <span className="group-hover:text-[var(--g)] transition-colors truncate">{q.n}</span>
                            {isCap && <CaptainBadge team={me} state={state} size="xs" />}
                            {isFav && (
                              <span
                                className={`text-[10.5px] mland:text-[8.5px] font-extrabold tabular ${
                                  favBoost > 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-amber-700 dark:text-[var(--lamp)]'
                                }`}
                              >
                                · {favBoost > 0 ? `💖 ลูกรัก (+${favBoost} OVR)` : '💖 ลูกรัก'}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] tabular flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            {natMeta && (
                              <>
                                <span>{natMeta.country}</span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span>
                              พลัง <b className="text-[var(--ink)]">{effOv}</b>
                              {effOv !== q.ov ? ` (ฐาน ${q.ov})` : ''}
                              {q.pot > q.ov ? ` · ศักยภาพ ${q.pot}` : ''}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>อายุ {q.age} ปี</span>
                            <span aria-hidden="true">·</span>
                            <span className={isStarter ? 'text-[var(--g)] font-semibold' : ''}>
                              {isStarter ? 'ตัวจริง' : 'สำรอง'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              บทบาท: <b className="text-[var(--ink)]">{roleLabel}</b>
                            </span>
                            {q.con?.yr != null && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>สัญญา {q.con.yr} ปี</span>
                              </>
                            )}
                          </div>

                          <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span>
                              ฟิต <b className={getStaminaMeta(fitPct).txtCls}>{fitPct}%</b>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              ลงเล่น <b className="text-[var(--ink)]">{q.sp || 0}</b> นัด
                            </span>
                            {avgRating && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  เรตติ้ง <b className="text-[var(--ink)]">{avgRating}</b>
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            {q.pos === 'GK' ? (
                              <span>
                                คลีนชีต <b className="text-[var(--ink)]">{q.cs || 0}</b>
                              </span>
                            ) : (
                              <span>
                                ยิง <b className="text-[var(--ink)]">{q.sg || 0}</b> / จ่าย{' '}
                                <b className="text-[var(--ink)]">{q.sa || 0}</b>
                              </span>
                            )}
                            <span aria-hidden="true">·</span>
                            {q.inj > 0 ? (
                              <span className="text-[var(--red)] font-bold">🏥 เจ็บ {q.inj} นัด</span>
                            ) : (q.sus || 0) > 0 ? (
                              <span className="text-[var(--red)] font-bold">🟥 แบน {q.sus} นัด</span>
                            ) : (
                              <span className="text-[var(--g)] font-semibold">✓ พร้อมลงสนาม</span>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="hidden sm:flex flex-col items-end gap-0.5 text-[10px] mland:text-[8px] tabular shrink-0 text-right">
                        <span className={talkDone ? 'text-[var(--g)] font-bold' : 'text-[var(--ink)] font-semibold'}>
                          {talkDone ? '✓ คุยในออฟฟิศแล้ว' : '● พูดคุย: พร้อม'}
                        </span>
                        <span className={physDone ? 'text-[var(--g)] font-bold' : 'text-[var(--ink)] font-semibold'}>
                          {physDone ? '✓ กายภาพรอบนี้แล้ว' : '● กายภาพ: พร้อม'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1.5 mland:pt-1 border-t border-[var(--line)]/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[10.5px] mland:text-[8.5px]">
                      <span className="text-[var(--mut)] min-w-0">
                        {persDef.icon} บุคลิก <b className="text-[var(--ink)]">{persDef.name}</b>
                        {' — '}
                        <span
                          className={
                            persHint.tone === 'volatile'
                              ? 'text-amber-700 dark:text-[var(--lamp)]'
                              : persHint.tone === 'resilient'
                                ? 'text-[var(--g)]'
                                : ''
                          }
                        >
                          {persHint.hint}
                        </span>
                      </span>

                      {isFav ? (
                        <span className="tabular font-bold shrink-0">
                          <span className={favBoost > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-[var(--lamp)]'}>
                            {favBoost > 0 ? `✨ ปลุกพลัง +${favBoost} OVR` : '⏳ ปลุกพลัง (+5~10 OVR)'}
                          </span>
                          {' · '}
                          <span className={mGood ? 'text-[var(--g)]' : 'text-[var(--mut)]'}>
                            🧠 {m}/{GOOD_MENTAL_THRESHOLD}
                            {mGood ? '✓' : ''}
                          </span>
                          {' · '}
                          <span className={!q.inj && !(q.sus || 0) && pGood ? 'text-[var(--g)]' : 'text-[var(--mut)]'}>
                            {q.inj > 0 ? '🏥 เจ็บ' : `💪 ${p}/${GOOD_PHYS_THRESHOLD}${pGood ? '✓' : ''}`}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--mut)] tabular shrink-0">
                          💖 ลูกรัก ({favPlayersList.length}/5):{' '}
                          <b className="text-[var(--ink)]">
                            {favPlayersList.length > 0
                              ? favPlayersList.map((fp) => fp.n.split(' ')[0]).join(', ')
                              : 'ยังไม่มี'}
                          </b>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2. Mental & Physical Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mland:gap-2 pb-2.5 mland:pb-1.5 border-b border-[var(--line)]">
                    <div className="space-y-1.5 mland:space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11.5px] mland:text-[9.5px]">
                        <span className="font-bold text-[var(--ink)]">🧠 สุขภาพจิตใจ</span>
                        <span className={`font-black tabular ${mMeta.txtCls}`}>
                          {mMeta.label} · {m}/100
                        </span>
                      </div>
                      <div className="relative h-2 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/70 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${m}%`, backgroundColor: mMeta.barColor }}
                        />
                        <div
                          title={`เกณฑ์จิตใจดี (${GOOD_MENTAL_THRESHOLD})`}
                          className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink)]/55"
                          style={{ left: `${GOOD_MENTAL_THRESHOLD}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular">
                        <span>เกณฑ์ปลุกพลัง {GOOD_MENTAL_THRESHOLD}</span>
                        <span className={mGood ? 'text-[var(--g)] font-bold' : ''}>
                          {mGood ? 'ถึงเกณฑ์แล้ว ✓' : `ขาดอีก ${GOOD_MENTAL_THRESHOLD - m} แต้ม`}
                        </span>
                      </div>
                      <div className="space-y-0.5 pt-0.5">
                        {mFactors.length > 0 ? (
                          mFactors.slice(0, 5).map((f, idx) => (
                            <div key={`${f.label}-${idx}`} className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[8.5px]">
                              <span className="text-[var(--mut)] truncate">{f.label}</span>
                              <span className={`font-bold tabular shrink-0 ${f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                                {f.delta >= 0 ? `+${f.delta}` : f.delta}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                            {q.mentalNote || 'สภาพจิตใจปกติตามบทบาทและผลงานในทีม'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 mland:space-y-1 sm:pl-3 sm:border-l sm:border-[var(--line)]/70">
                      <div className="flex items-center justify-between gap-2 text-[11.5px] mland:text-[9.5px]">
                        <span className="font-bold text-[var(--ink)]">💪 สุขภาพกาย</span>
                        <span className={`font-black tabular ${pMeta.txtCls}`}>
                          {pMeta.label} · {p}/100
                        </span>
                      </div>
                      <div className="relative h-2 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/70 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${p}%`, backgroundColor: pMeta.barColor }}
                        />
                        <div
                          title={`เกณฑ์ร่างกายดี (${GOOD_PHYS_THRESHOLD})`}
                          className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink)]/55"
                          style={{ left: `${GOOD_PHYS_THRESHOLD}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular">
                        <span>ความฟิต {fitPct}% · ศูนย์แพทย์ Lv.{medLv}</span>
                        <span className={q.inj > 0 ? 'text-[var(--red)] font-bold' : pGood ? 'text-[var(--g)] font-bold' : ''}>
                          {q.inj > 0
                            ? 'บาดเจ็บ (เพดาน 52)'
                            : pGood
                              ? 'ถึงเกณฑ์แล้ว ✓'
                              : `ขาดอีก ${GOOD_PHYS_THRESHOLD - p} แต้ม`}
                        </span>
                      </div>
                      <div className="space-y-0.5 pt-0.5">
                        {pFactors.length > 0 ? (
                          pFactors.slice(0, 5).map((f, idx) => (
                            <div key={`${f.label}-${idx}`} className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[8.5px]">
                              <span className="text-[var(--mut)] truncate">{f.label}</span>
                              <span className={`font-bold tabular shrink-0 ${f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                                {f.delta >= 0 ? `+${f.delta}` : f.delta}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                            {q.physNote || 'สภาพร่างกายสมดุลตามความฟิตและการพักฟื้น'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. Office Private Talk Topics & Physio Action */}
                  <div
                    data-focus-id={`talk:${q.n}`}
                    className={`space-y-1.5 mland:space-y-1 rounded-xl ${
                      isFocused(`talk:${q.n}`)
                        ? 'p-2 border border-amber-500/70 bg-amber-500/[0.06] task-focus-spotlight'
                        : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                      <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                        {isFocused(`talk:${q.n}`) && <NavFocusBadge />}
                        <span>💬 เลือกหัวข้อคุยส่วนตัวในออฟฟิศ</span>
                      </span>
                      <span className="text-[var(--mut)] tabular">
                        {talkDone
                          ? '✓ คุยส่วนตัวกับคนนี้แล้วในรอบนี้'
                          : careQuota.remaining <= 0
                            ? 'โควตาดูแลรอบนี้หมดแล้ว'
                            : `พร้อมคุย · ใช้ 1 โควตา (เหลือ ${careQuota.remaining})`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mland:gap-1">
                      {MANAGER_TALK_TOPICS.map((tp) => {
                        let recText: string | null = null;
                        let recTone = 'text-[var(--g)]';
                        if (tp.id === 'challenge') {
                          if (persHint.tone === 'volatile' && m < 50) {
                            recText = '⚠ บุคลิกอ่อนไหว เสี่ยงเครียด (-2)';
                            recTone = 'text-amber-700 dark:text-[var(--lamp)]';
                          } else if (persHint.tone === 'resilient' || isFav) {
                            recText = '★ เหมาะมาก (+โบนัสนิสัย/ลูกรัก)';
                          }
                        } else if (tp.id === 'encourage' && (m < 62 || q.inj > 0)) {
                          recText = '✓ แนะนำ: กำลังเครียด/เจ็บ (+โบนัส)';
                        } else if (tp.id === 'tactical' && (isCap || q.con?.role === 'key')) {
                          recText = '✓ แนะนำ: กัปตัน/ตัวหลัก (+โบนัส)';
                        } else if (tp.id === 'personal' && (m < 60 || fitPct < 75)) {
                          recText = '✓ แนะนำ: คลายเครียด & ฟื้นกาย +2';
                        }

                        return (
                          <button
                            key={tp.id}
                            type="button"
                            disabled={talkDone || careQuota.remaining <= 0}
                            onClick={() => handleOneOnOneTalk(q, tp.id)}
                            className="px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer disabled:opacity-45 disabled:cursor-default transition-all space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)] truncate">
                                {tp.icon} {tp.label}
                              </span>
                              <span className="text-[10px] mland:text-[8px] font-semibold tabular shrink-0 text-[var(--mut)]">
                                <EffectText text={tp.effectHint.split('·')[0].trim()} />
                              </span>
                            </div>
                            <div className="text-[10px] mland:text-[8px] text-[var(--mut)] leading-snug">
                              <EffectText text={tp.desc} />
                            </div>
                            {recText && (
                              <div className={`text-[9.5px] mland:text-[7.5px] font-bold ${recTone}`}>
                                {recText}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={physDone || careQuota.remaining <= 0}
                      onClick={() => handlePhysioCare(q)}
                      className="w-full px-3 py-2 mland:px-2.5 mland:py-1 rounded-xl mland:rounded-lg bg-sky-500/10 border border-sky-500/35 hover:border-sky-500 flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-45 disabled:cursor-default transition-all"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs mland:text-[9.5px] text-sky-700 dark:text-sky-300 truncate">
                          {physDone ? '✓ ฟื้นฟูกล้ามเนื้อรอบนี้แล้ว' : '🧊 ส่งกายภาพนวดคลายกล้ามเนื้อตัวต่อตัว'}
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)] tabular">
                          <EffectText
                            text={`เพิ่มสุขภาพกาย +${physMin}..+${physMax} · ความฟิต +3%${q.inj > 0 ? ' (ช่วงเจ็บเพดานกาย 52)' : ''}`}
                          />
                        </div>
                      </div>
                      <span className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--g)] shrink-0 whitespace-nowrap">
                        {physDone ? 'เรียบร้อย' : 'ฟื้นฟู (+กาย & ฟิต)'}
                      </span>
                    </button>
                  </div>

                  {/* 4. Office Dialogue Transcript */}
                  {activeLog ? (
                    <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--g-soft)]/50 border border-[var(--g)]/35 space-y-1 text-[11px] mland:text-[9px]">
                      <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                        <span className="text-[var(--g)]">
                          🗣️ บันทึกการคุยในออฟฟิศ · {activeLog.topicLabel}
                        </span>
                        <span className="tabular font-bold">
                          {activeLog.deltaMental !== 0 && (
                            <span>
                              จิตใจ <DeltaValue value={activeLog.deltaMental} />
                            </span>
                          )}
                          {activeLog.deltaMental !== 0 && activeLog.deltaPhys !== 0 ? ' · ' : ''}
                          {activeLog.deltaPhys !== 0 && (
                            <span>
                              กาย <DeltaValue value={activeLog.deltaPhys} />
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-[var(--mut)]">{activeLog.coachLine}</div>
                      <div className="text-[var(--ink)] font-semibold">{activeLog.playerReply}</div>
                    </div>
                  ) : otherRecentLog ? (
                    <button
                      type="button"
                      onClick={() => enterOfficeWithPlayer(otherRecentLog.playerName)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)]/50 border border-[var(--line)]/70 hover:border-[var(--g)] text-left text-[10.5px] mland:text-[8.5px] text-[var(--mut)] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                    >
                      <span className="truncate">
                        🗣️ คนล่าสุดที่เข้าออฟฟิศ: <b className="text-[var(--ink)]">{otherRecentLog.playerName}</b> ({otherRecentLog.topicLabel})
                      </span>
                      <span className="text-[var(--g)] font-bold shrink-0 whitespace-nowrap">ดูบทสนทนา →</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* ==================== ROOM 2: TEAM MEETING ROOM + TEAM OFFICE VIEW ==================== */
        <div
          data-focus-id="team-talk"
          className={`flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden ${
            isFocused('team-talk') ? 'task-focus-spotlight' : ''
          }`}
        >
          {/* Compact Group Team Meeting Strip */}
          <div className="shrink-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2 mland:px-2.5 mland:py-1.5 space-y-1.5 mland:space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-extrabold text-xs sm:text-[13px] mland:text-[10.5px] text-[var(--ink)] flex items-center gap-1.5 truncate">
                  <span>🏛️ ประชุมรวมทั้งสโมสร</span>
                  {isFocused('team-talk') && <NavFocusBadge />}
                </h3>
                <span className="hidden sm:inline text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular">
                  · ขวัญ {state.mor ?? 55}% · ใจเฉลี่ย {avgMental}/100
                  {lowMentalPlayers.length > 0 ? ` · ใจต่ำ ${lowMentalPlayers.length} คน` : ''}
                </span>
              </div>
              <span
                className={`text-[10.5px] mland:text-[8.5px] font-bold tabular shrink-0 ${
                  teamTalkUsed ? 'text-[var(--mut)]' : 'text-[var(--g)]'
                }`}
              >
                {teamTalkUsed
                  ? `✓ ${plan.lastTeamTalkNote || usedOpt?.label || 'ประชุมรอบนี้ไปแล้ว'}`
                  : '● พร้อมประชุมรวม 1/1 (ไม่หักโควตาออฟฟิศ)'}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 mland:gap-1">
              {TEAM_TALK_OPTIONS.map((opt) => {
                const isLast = teamTalkUsed && plan.lastTeamTalkId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={teamTalkUsed}
                    onClick={() => handleTeamTalk(opt.id)}
                    title={opt.whenToUse}
                    className={`px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border text-left transition-all cursor-pointer disabled:cursor-default ${
                      isLast
                        ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/35'
                        : teamTalkUsed
                          ? 'bg-[var(--surface-2)]/40 border-[var(--line)] opacity-55'
                          : 'bg-[var(--surface-2)]/65 border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px] mland:text-[9px] font-extrabold text-[var(--ink)]">
                      <span className="truncate">
                        {opt.icon} {opt.label}
                      </span>
                      {isLast && <span className="text-[var(--g)] shrink-0">✓</span>}
                    </div>
                    <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] truncate tabular">
                      <EffectText text={opt.effectHint} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categorized Meeting Rooms & Individual Coach/Player Talk Workspace */}
          <TeamOfficeView
            state={state}
            onUpdateState={onUpdateState}
            onInspectPlayer={onInspectPlayer}
            onToast={onToast}
            isFocused={isFocused}
          />
        </div>
      )}
    </div>
  );
};
