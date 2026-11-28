import React, { useMemo, useState } from 'react';
import { MessageSquare, Search, Shield, Sparkles, Users } from 'lucide-react';
import type {
  CoachOutfitId,
  GameState,
  Player,
  Position,
  TalkTopicId,
  Team
} from '../types/game';
import {
  AR_T,
  COACH_STYLES,
  PLAYER_PERSONALITIES,
  POS,
  getCountryMetaByCode
} from '../data/thaiFootballData';
import { getTeamLeagueName } from '../data/leagueStructures';
import { SFX } from '../utils/audioTheme';
import { ef, getDefaultCoachVis, getShirtNo, xi } from '../engine/playerCore';
import { getStaffState } from '../engine/simulation';
import {
  GOOD_MENTAL_THRESHOLD,
  GOOD_PHYS_THRESHOLD,
  MANAGER_TALK_TOPICS,
  applyPlayerCareAction,
  getActiveFavBoost,
  getPersonalityCareHint,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getTeamCareQuotaInfo,
  getTeamFavoriteNames,
  getWellbeingTierMeta,
  isPlayerMentalGood,
  isPlayerPhysGood,
  resolvePersonalityId
} from '../engine/wellbeing';
import { ClubCrest, PlayerFace } from './SvgVisuals';
import { PositionBadge } from './PositionBadge';
import { CaptainBadge } from './CaptainBadge';
import { EffectText } from './DeltaText';
import { NavFocusBadge } from './NavFocusBanner';
import { getStaminaMeta } from './StaminaBar';

type SquadMemberFilter = 'ALL' | 'XI' | 'NEED' | Position;
type SelectedParticipant = { kind: 'coach' } | { kind: 'player'; playerName: string };

interface OwnCoachProfile {
  name: string;
  vis: number[];
  style: (typeof COACH_STYLES)[number];
  outfit: CoachOutfitId;
}

interface OfficeTalkEntry {
  id: string;
  speaker: string;
  topicLabel: string;
  myLine: string;
  replyLine: string;
  effectText?: string;
  turn: number;
}

function buildOwnCoachProfile(team: Team, state: GameState): OwnCoachProfile {
  const ownName = state.club?.managerName?.trim() || 'หัวหน้าผู้ฝึกสอน';
  const ownStyleId = state.club?.managerStyle || 'balanced';
  const style = COACH_STYLES.find((s) => s.id === ownStyleId) || COACH_STYLES[0];
  const vis =
    state.club?.managerVis && state.club.managerVis.length >= 8
      ? state.club.managerVis
      : getDefaultCoachVis(ownName || team.name);
  return {
    name: ownName,
    vis,
    style,
    outfit: state.club?.managerOutfit || 'suit_navy'
  };
}

export const TeamOfficeView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer?: (player: Player, team: Team | null) => void;
  onOpenPrivateTalk?: (playerName: string) => void;
  onToast: (msg: string) => void;
  isFocused?: (id: string) => boolean;
}> = ({ state, onUpdateState, onInspectPlayer, onOpenPrivateTalk, onToast, isFocused }) => {
  const me = state.teams[state.me];
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);

  const [memberFilter, setMemberFilter] = useState<SquadMemberFilter>('ALL');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<SelectedParticipant>({
    kind: 'coach'
  });
  const [roomLogs, setRoomLogs] = useState<Record<string, OfficeTalkEntry[]>>({});

  const ownCoach = useMemo(() => buildOwnCoachProfile(me, state), [me, state]);
  const starters = useMemo(() => xi(me), [me]);
  const starterNames = useMemo(() => new Set(starters.map((q) => q.n)), [starters]);
  const favNamesSet = useMemo(() => new Set(getTeamFavoriteNames(me)), [me]);
  const careQuota = useMemo(() => getTeamCareQuotaInfo(state, me), [state, me]);
  const stf = useMemo(() => getStaffState(state), [state]);

  const squadMetrics = useMemo(() => {
    const total = me.sq.length || 1;
    let mSum = 0;
    let pSum = 0;
    let lowMentalCount = 0;
    let tiredOrInjCount = 0;

    const attentionList: Array<{ player: Player; m: number; p: number; score: number; reason: string }> = [];

    for (const q of me.sq) {
      const m = getPlayerMentalScore(q, null);
      const p = getPlayerPhysScore(q, null);
      mSum += m;
      pSum += p;
      if (m < 60) lowMentalCount++;
      if (q.inj > 0 || p < 62 || (q.fit ?? 100) < 72) tiredOrInjCount++;

      const needsM = m < GOOD_MENTAL_THRESHOLD;
      const needsP = q.inj > 0 || p < GOOD_PHYS_THRESHOLD;
      if (needsM || needsP) {
        const isFav = favNamesSet.has(q.n);
        const priority =
          (isFav ? 18 : 0) +
          (starterNames.has(q.n) ? 10 : 0) +
          (m < 60 ? 22 : needsM ? 8 : 0) +
          (q.inj > 0 ? 15 : p < 62 ? 12 : needsP ? 6 : 0) +
          Math.max(0, 80 - Math.min(m, p));
        const reason =
          q.inj > 0
            ? `เจ็บ ${q.inj} นัด`
            : m < p
              ? `จิตใจ ${m}`
              : `ร่างกาย ${p}`;
        attentionList.push({ player: q, m, p, score: priority, reason });
      }
    }

    attentionList.sort((a, b) => b.score - a.score || b.player.ov - a.player.ov);

    return {
      avgMental: Math.round(mSum / total),
      avgPhys: Math.round(pSum / total),
      lowMentalCount,
      tiredOrInjCount,
      needCareCount: attentionList.length,
      attentionTop: attentionList.slice(0, 4)
    };
  }, [me.sq, favNamesSet, starterNames]);

  const sortedRoomPlayers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const base = me.sq.filter((q) => {
      if (memberFilter === 'XI' && !starterNames.has(q.n)) return false;
      if (memberFilter === 'NEED') {
        const m = getPlayerMentalScore(q, null);
        const p = getPlayerPhysScore(q, null);
        if (m >= GOOD_MENTAL_THRESHOLD && p >= GOOD_PHYS_THRESHOLD && q.inj === 0) return false;
      } else if (memberFilter !== 'ALL' && memberFilter !== 'XI' && q.pos !== memberFilter) {
        return false;
      }
      if (!query) return true;
      return q.n.toLowerCase().includes(query) || q.ro.toLowerCase().includes(query);
    });

    return base.sort((a, b) => {
      const aStarter = starterNames.has(a.n) ? 0 : 1;
      const bStarter = starterNames.has(b.n) ? 0 : 1;
      if (aStarter !== bStarter) return aStarter - bStarter;
      const pDiff = POS.indexOf(a.pos) - POS.indexOf(b.pos);
      if (pDiff !== 0) return pDiff;
      return b.ov - a.ov;
    });
  }, [me.sq, memberFilter, memberSearch, starterNames]);

  const activePlayer = useMemo(() => {
    if (selectedParticipant.kind !== 'player') return null;
    return (
      me.sq.find((q) => q.n === selectedParticipant.playerName) ||
      sortedRoomPlayers[0] ||
      me.sq[0] ||
      null
    );
  }, [selectedParticipant, me.sq, sortedRoomPlayers]);

  const appendRoomLog = (key: string, entry: Omit<OfficeTalkEntry, 'id' | 'turn'>) => {
    const full: OfficeTalkEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      turn: curTurn
    };
    setRoomLogs((prev) => ({
      ...prev,
      [key]: [full, ...(prev[key] || [])].slice(0, 6)
    }));
  };

  const handleOwnPlayerTalk = (player: Player, topicId: TalkTopicId) => {
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
      appendRoomLog(`player:${me.id}:${player.n}`, {
        speaker: player.n,
        topicLabel: out.topicLabel || 'คุยในห้องประชุม',
        myLine: out.coachLine || '',
        replyLine: out.playerReply || '',
        effectText: `ใจ ${out.deltaMental >= 0 ? `+${out.deltaMental}` : out.deltaMental}${
          out.deltaPhys > 0 ? ` · กาย +${out.deltaPhys}` : ''
        }`
      });
    } else SFX.tap();
    if (out.msg) onToast(out.msg);
  };

  const handleOwnPlayerPhysio = (player: Player) => {
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
      appendRoomLog(`player:${me.id}:${player.n}`, {
        speaker: player.n,
        topicLabel: out.topicLabel || 'ฟื้นฟูร่างกาย',
        myLine: out.coachLine || '',
        replyLine: out.playerReply || '',
        effectText: `กาย +${out.deltaPhys} · ฟิต +3%`
      });
    } else SFX.tap();
    if (out.msg) onToast(out.msg);
  };

  const handleOwnCoachBriefing = (mode: 'staff' | 'morale') => {
    SFX.confirm();
    const key = `coach:${me.id}`;
    if (mode === 'staff') {
      appendRoomLog(key, {
        speaker: ownCoach.name,
        topicLabel: 'สรุปงานสตาฟฟ์โค้ช',
        myLine: `คุณเรียกประชุมทีมงาน (ผู้ช่วย Lv.${stf.asst} · ฟิตเนส Lv.${stf.fit} · แพทย์ Lv.${stf.physio})`,
        replyLine: `“แผน ${me.form} (${AR_T[me.tac]}) เข้าใจแผน ${me.tacFam ?? 65}% · โควตาดูแลรายบุคคลเหลือ ${careQuota.remaining}/${careQuota.limit} ครั้งครับ”`,
        effectText: `สไตล์: ${ownCoach.style.icon} ${ownCoach.style.name}`
      });
      onToast('👔 สรุปความพร้อมทีมงานสตาฟฟ์เรียบร้อย');
    } else {
      const lowM = squadMetrics.lowMentalCount;
      appendRoomLog(key, {
        speaker: ownCoach.name,
        topicLabel: 'เช็กบรรยากาศห้องแต่งตัว',
        myLine: `คุณตรวจสอบสภาพจิตใจและขวัญกำลังใจของนักเตะ ${me.sq.length} คนในทีม`,
        replyLine:
          lowM > 0
            ? `“มีนักเตะใจต่ำกว่า 60 อยู่ ${lowM} คน แนะนำให้คลิกเลือกชื่อด้านซ้ายเพื่อพูดคุยประคองขวัญต่อได้เลยครับ”`
            : `“บรรยากาศในห้องแต่งตัว ${me.name} ยอดเยี่ยมครับ ทุกคนพร้อมสู้เต็มที่!”`,
        effectText: `ขวัญทีม ${state.mor ?? 55}% · ใจเฉลี่ย ${squadMetrics.avgMental}/100`
      });
      onToast(
        lowM > 0
          ? `📋 พบนักเตะควรคุยดูแลเพิ่ม ${lowM} คนในทีม`
          : '✅ สภาพจิตใจลูกทีมทุกคนอยู่ในเกณฑ์ดี'
      );
    }
  };

  const activeParticipantKey =
    selectedParticipant.kind === 'coach'
      ? `coach:${me.id}`
      : `player:${me.id}:${activePlayer?.n || ''}`;
  const activeTranscript = roomLogs[activeParticipantKey] || [];
  const avgMentalMeta = getWellbeingTierMeta(squadMetrics.avgMental, 'mental', false);
  const avgPhysMeta = getWellbeingTierMeta(squadMetrics.avgPhys, 'phys', false);
  const recentForm = (me.fm || '').slice(-5).split('');

  return (
    <div
      data-focus-id="team-office-view"
      className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[200px_minmax(0,1fr)] md:grid-cols-[260px_1fr] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[292px_1fr] mland:grid-cols-[225px_1fr] mland:grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-1.5 overflow-hidden"
    >
      {/* ==================== LEFT: OWN CLUB PARTICIPANTS (COACH + SQUAD) ==================== */}
      <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 mland:p-1.5 flex flex-col gap-1.5 mland:gap-1 min-h-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Users className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
            <h3 className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] truncate">
              สมาชิกในห้องประชุม
            </h3>
          </div>
          <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular shrink-0">
            {me.sq.length + 1} คน · ลูกรัก {favNamesSet.size} คน
          </span>
        </div>

        {/* Own Head Coach Entry (Pinned) */}
        <button
          type="button"
          onClick={() => {
            SFX.tap();
            setSelectedParticipant({ kind: 'coach' });
          }}
          className={`shrink-0 px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border flex items-center gap-2 text-left cursor-pointer transition-colors ${
            selectedParticipant.kind === 'coach'
              ? 'bg-[var(--g-soft)] border-[var(--g)]/60'
              : 'bg-[var(--surface-2)]/55 border-[var(--line)] hover:border-[var(--g)]/45 hover:bg-[var(--surface-2)]'
          }`}
        >
          <PlayerFace
            player={{
              n: ownCoach.name,
              pos: 'MF',
              ro: 'CM',
              ov: 70,
              age: 45,
              pot: 70,
              fit: 100,
              inj: 0,
              vis: ownCoach.vis
            }}
            team={me}
            state={state}
            size={30}
            coachOutfit={ownCoach.outfit}
            coachClubKit={me.kc[0]}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 min-w-0 text-[11px] mland:text-[9px] font-extrabold text-[var(--ink)]">
              <span className="truncate">🇹🇭 {ownCoach.name}</span>
              <span className="text-[9.5px] mland:text-[7.5px] font-bold text-[var(--g)] shrink-0">
                โค้ชทีมเรา
              </span>
            </div>
            <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] truncate">
              {ownCoach.style.icon} {ownCoach.style.name} · สรุปภาพรวมทีม
            </div>
          </div>
        </button>

        {/* Search & Filter inside Own Squad */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          {([
            ['ALL', `ทั้งหมด (${me.sq.length})`],
            ['XI', 'ตัวจริง'],
            ...(squadMetrics.needCareCount > 0
              ? ([['NEED', `ควรดูแล (${squadMetrics.needCareCount})`]] as [SquadMemberFilter, string][])
              : []),
            ['GK', 'GK'],
            ['DF', 'DF'],
            ['MF', 'MF'],
            ['FW', 'FW']
          ] as [SquadMemberFilter, string][]).map(([mk, lbl]) => (
            <button
              key={mk}
              type="button"
              onClick={() => {
                SFX.tap();
                setMemberFilter(mk);
              }}
              className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg text-[9.5px] mland:text-[7.5px] font-bold border cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                memberFilter === mk
                  ? 'bg-[var(--g)] text-white border-[var(--g)]'
                  : mk === 'NEED'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-[var(--lamp)] border-amber-500/35 hover:border-amber-500'
                    : 'bg-[var(--surface-2)]/70 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <label className="relative block shrink-0">
          <Search className="w-3.5 h-3.5 text-[var(--mut)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="ค้นหาชื่อนักเตะหรือตำแหน่ง..."
            className="w-full pl-7 pr-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)]/65 border border-[var(--line)] text-[11px] mland:text-[9px] text-[var(--ink)] placeholder:text-[var(--mut)] focus:outline-none focus:border-[var(--g)]"
          />
        </label>

        {/* Scrollable Own Squad List */}
        <div className="flex-1 min-h-0 overflow-y-auto border border-[var(--line)] rounded-xl divide-y divide-[var(--line)]/60">
          {sortedRoomPlayers.length === 0 ? (
            <div className="p-4 text-center space-y-1.5">
              <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">
                ไม่พบนักเตะในกลุ่มที่เลือก
              </div>
              <button
                type="button"
                onClick={() => {
                  setMemberFilter('ALL');
                  setMemberSearch('');
                }}
                className="btn btn-xs btn-secondary"
              >
                แสดงทั้งหมด
              </button>
            </div>
          ) : (
            sortedRoomPlayers.map((q) => {
              const selected =
                selectedParticipant.kind === 'player' && activePlayer?.n === q.n;
              const isStarter = starterNames.has(q.n);
              const m = getPlayerMentalScore(q, null);
              const p = getPlayerPhysScore(q, null);
              const natMeta = q.nat && q.nat !== 'TH' ? getCountryMetaByCode(q.nat) : null;
              const isFav = favNamesSet.has(q.n);
              const favBoost = isFav ? getActiveFavBoost(q, me, null) : 0;
              const talkDone = q.careTalkMd === curTurn;
              const physDone = q.carePhysMd === curTurn;
              const fitPct = Math.round(q.fit ?? 100);

              return (
                <button
                  key={q.n}
                  type="button"
                  onClick={() => {
                    if (onOpenPrivateTalk) {
                      onOpenPrivateTalk(q.n);
                      return;
                    }
                    SFX.tap();
                    setSelectedParticipant({ kind: 'player', playerName: q.n });
                  }}
                  className={`w-full px-2 py-1.5 mland:px-1.5 mland:py-1 flex items-center gap-2 mland:gap-1.5 text-left cursor-pointer transition-colors ${
                    selected ? 'bg-[var(--g-soft)]' : 'hover:bg-[var(--surface-2)]/75'
                  }`}
                >
                  <PlayerFace player={q} team={me} state={state} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] mland:text-[9px] font-bold flex items-center gap-1 min-w-0">
                      <PositionBadge role={q.ro} size="2xs" />
                      {natMeta && (
                        <span className="text-[10px] mland:text-[8px] shrink-0" title={natMeta.country}>
                          {natMeta.flag}
                        </span>
                      )}
                      <span className="truncate">{q.n}</span>
                      {me.cap === q.n && (
                        <CaptainBadge team={me} state={state} size="xs" className="shrink-0" />
                      )}
                      {isFav && (
                        <span
                          className={`text-[9.5px] mland:text-[8px] font-black shrink-0 ${
                            favBoost > 0 ? 'text-rose-600 dark:text-rose-400' : ''
                          }`}
                        >
                          💖{favBoost > 0 ? `+${favBoost}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] tabular flex items-center justify-between gap-1 mt-0.5">
                      <span className="truncate">
                        <span className={isStarter ? 'text-[var(--g)] font-semibold' : ''}>
                          {isStarter ? 'ตัวจริง' : 'สำรอง'}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>OVR <b className="text-[var(--ink)]">{ef(q)}</b></span>
                      </span>
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <span className={getWellbeingTierMeta(m, 'mental', false).txtCls}>🧠{m}</span>
                        <span className={getWellbeingTierMeta(p, 'phys', q.inj > 0).txtCls}>💪{p}</span>
                        <span className={getStaminaMeta(fitPct).txtCls}>{fitPct}%</span>
                        {(talkDone || physDone) && (
                          <span className="text-[var(--g)] font-bold">✓</span>
                        )}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ==================== RIGHT: OWN CLUB BRIEFING & CARE DESK ==================== */}
      <div className="min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden">
        {/* Room Header */}
        <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1 border-b border-[var(--line)] bg-[var(--surface-2)]/35 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="shrink-0 w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
              <ClubCrest
                name={me.name}
                size={20}
                team={me}
                club={state.club}
                isMyClub={state.mode === 'm'}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 text-xs sm:text-sm mland:text-[10.5px] font-extrabold text-[var(--ink)]">
                <span className="truncate">
                  {selectedParticipant.kind === 'coach'
                    ? `ห้องประชุมสโมสร · ${me.name}`
                    : `พูดคุยรายบุคคล · ${activePlayer?.n || me.name}`}
                </span>
                {isFocused?.(`room:${me.id}`) && <NavFocusBadge />}
              </div>
              <div className="text-[10px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                {getTeamLeagueName(me, { includeZone: true, withFlag: true })} · แผน {me.form} ({AR_T[me.tac]}) · {me.sq.length} นักเตะในทีม
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular shrink-0">
            <span>
              โควตาดูแล{' '}
              <b className={careQuota.remaining > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
                {careQuota.remaining}/{careQuota.limit}
              </b>
            </span>
          </div>
        </div>

        {/* Desk Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2 space-y-3 mland:space-y-2">
          {selectedParticipant.kind === 'coach' ? (
            /* ---------- OWN CLUB BRIEFING OVERVIEW ---------- */
            <div className="space-y-3 mland:space-y-2">
              {/* Manager & Tactical Identity Header */}
              <div className="pb-3 mland:pb-2 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <PlayerFace
                    player={{
                      n: ownCoach.name,
                      pos: 'MF',
                      ro: 'CM',
                      ov: 70,
                      age: 45,
                      pot: 70,
                      fit: 100,
                      inj: 0,
                      vis: ownCoach.vis
                    }}
                    team={me}
                    state={state}
                    size={48}
                    coachOutfit={ownCoach.outfit}
                    coachClubKit={me.kc[0]}
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap text-sm mland:text-xs font-extrabold text-[var(--ink)]">
                      <span>🇹🇭</span>
                      <span className="truncate">{ownCoach.name}</span>
                      <span className="text-[11px] mland:text-[8.5px] font-bold text-[var(--g)]">
                        · หัวหน้าผู้ฝึกสอน
                      </span>
                    </div>
                    <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] tabular flex flex-wrap items-center gap-x-1.5">
                      <span>
                        สไตล์ <b className="text-[var(--ink)]">{ownCoach.style.icon} {ownCoach.style.name}</b>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        ปรัชญา <b className="text-[var(--ink)]">{me.philosophy || ownCoach.style.shortDesc}</b>
                      </span>
                    </div>
                  </div>
                </div>

                {recentForm.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] mland:text-[8px] text-[var(--mut)]">ฟอร์มล่าสุด</span>
                    <div className="flex items-center gap-1 tabular text-[10px] mland:text-[8px] font-black">
                      {recentForm.map((res, idx) => (
                        <span
                          key={`${res}-${idx}`}
                          className={`w-5 h-5 mland:w-4 mland:h-4 rounded-md flex items-center justify-center ${
                            res === 'W'
                              ? 'bg-[var(--g-soft)] text-[var(--g)]'
                              : res === 'D'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-[var(--lamp)]'
                                : 'bg-[var(--red-soft)] text-[var(--red)]'
                          }`}
                        >
                          {res}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3-Column Own Squad Readiness Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mland:gap-2 pb-3 mland:pb-2 border-b border-[var(--line)]">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] mland:text-[9px]">
                    <span className="font-bold text-[var(--ink)]">🧠 จิตใจเฉลี่ยทีม</span>
                    <span className={`font-black tabular ${avgMentalMeta.txtCls}`}>
                      {squadMetrics.avgMental}/100
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/70 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${squadMetrics.avgMental}%`, backgroundColor: avgMentalMeta.barColor }}
                    />
                  </div>
                  <div className="text-[10px] mland:text-[8px] text-[var(--mut)] tabular">
                    {squadMetrics.lowMentalCount > 0 ? (
                      <span className="text-amber-700 dark:text-[var(--lamp)] font-semibold">
                        ใจต่ำกว่า 60: {squadMetrics.lowMentalCount} คน
                      </span>
                    ) : (
                      <span className="text-[var(--g)] font-semibold">สภาพจิตใจดีทั้งสโมสร</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 sm:pl-3 sm:border-l sm:border-[var(--line)]/70">
                  <div className="flex items-center justify-between text-[11px] mland:text-[9px]">
                    <span className="font-bold text-[var(--ink)]">💪 ร่างกายเฉลี่ยทีม</span>
                    <span className={`font-black tabular ${avgPhysMeta.txtCls}`}>
                      {squadMetrics.avgPhys}/100
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/70 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${squadMetrics.avgPhys}%`, backgroundColor: avgPhysMeta.barColor }}
                    />
                  </div>
                  <div className="text-[10px] mland:text-[8px] text-[var(--mut)] tabular">
                    {squadMetrics.tiredOrInjCount > 0 ? (
                      <span className="text-[var(--red)] font-semibold">
                        ล้า/บาดเจ็บ: {squadMetrics.tiredOrInjCount} คน
                      </span>
                    ) : (
                      <span className="text-[var(--g)] font-semibold">ความฟิตพร้อมลงสนาม</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 sm:pl-3 sm:border-l sm:border-[var(--line)]/70">
                  <div className="flex items-center justify-between text-[11px] mland:text-[9px]">
                    <span className="font-bold text-[var(--ink)]">🧭 แผน &amp; ทีมงาน</span>
                    <span className="font-black tabular text-[var(--g)]">{me.tacFam ?? 65}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-2)] border border-[var(--line)]/70 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--g)] transition-all"
                      style={{ width: `${me.tacFam ?? 65}%` }}
                    />
                  </div>
                  <div className="text-[10px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                    ผู้ช่วย Lv.{stf.asst} · ฟิตเนส Lv.{stf.fit} · แพทย์ Lv.{stf.physio}
                  </div>
                </div>
              </div>

              {/* Staff Briefing Actions */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                  <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[var(--g)]" />
                    <span>วาระประชุมย่อยกับทีมงานสโมสร</span>
                  </span>
                  <span className="text-[var(--mut)]">ไม่หักโควตาดูแลนักเตะ</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOwnCoachBriefing('staff')}
                    className="px-3 py-2.5 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                  >
                    <div className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                      📋 เช็กความพร้อมทีมงานสตาฟฟ์
                    </div>
                    <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                      สรุปความเข้าใจแผน {me.form} โควตาดูแล และระดับผู้ช่วยโค้ช
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOwnCoachBriefing('morale')}
                    className="px-3 py-2.5 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                  >
                    <div className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                      🧠 สำรวจจิตใจลูกทีมในห้องประชุม
                    </div>
                    <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                      ตรวจสอบขวัญห้องแต่งตัวและนักเตะที่ควรพูดคุยเสริมกำลังใจ
                    </div>
                  </button>
                </div>
              </div>

              {/* Players Needing Care Quick-Jump Strip */}
              <div className="pt-2 border-t border-[var(--line)]/70 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                  <span className="font-bold text-[var(--ink)]">
                    ⚡ นักเตะในทีมที่ควรเรียกคุยรอบนี้
                  </span>
                  <span className="text-[var(--mut)] tabular">
                    {squadMetrics.attentionTop.length > 0
                      ? `คลิกชื่อเพื่อพูดคุยดูแลทันที`
                      : 'พร้อมลงสนามทุกคน'}
                  </span>
                </div>

                {squadMetrics.attentionTop.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {squadMetrics.attentionTop.map(({ player, m, p, reason }) => (
                      <button
                        key={player.n}
                        type="button"
                        onClick={() => {
                          if (onOpenPrivateTalk) {
                            onOpenPrivateTalk(player.n);
                            return;
                          }
                          SFX.tap();
                          setSelectedParticipant({ kind: 'player', playerName: player.n });
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/30 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerFace player={player} team={me} state={state} size={26} />
                          <div className="min-w-0">
                            <div className="text-[11px] mland:text-[9px] font-bold text-[var(--ink)] flex items-center gap-1 truncate">
                              <PositionBadge role={player.ro} size="2xs" />
                              <span className="truncate">{player.n}</span>
                            </div>
                            <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] tabular">
                              🧠{m} · 💪{p} · {reason}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] mland:text-[8px] font-bold text-[var(--g)] shrink-0 whitespace-nowrap">
                          คุยเลย →
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] mland:text-[8.5px] text-[var(--g)] font-semibold">
                    ✓ นักเตะในสโมสร {me.name} ทุกคนมีสภาพจิตใจและร่างกายอยู่ในเกณฑ์ดี
                  </div>
                )}
              </div>
            </div>
          ) : activePlayer ? (
            /* ---------- OWN PLAYER INDIVIDUAL CARE DESK ---------- */
            (() => {
              const q = activePlayer;
              const m = getPlayerMentalScore(q, null);
              const p = getPlayerPhysScore(q, null);
              const mMeta = getWellbeingTierMeta(m, 'mental', false);
              const pMeta = getWellbeingTierMeta(p, 'phys', q.inj > 0);
              const mGood = isPlayerMentalGood(q, null);
              const pGood = isPlayerPhysGood(q, null);
              const persId = resolvePersonalityId(q, null);
              const persDef = PLAYER_PERSONALITIES[persId] || PLAYER_PERSONALITIES[3];
              const persHint = getPersonalityCareHint(persId);
              const isFav = favNamesSet.has(q.n);
              const favBoost = getActiveFavBoost(q, me, null);
              const isCap = me.cap === q.n;
              const isStarter = starterNames.has(q.n);
              const shirtNo = getShirtNo(me, q);
              const fitPct = Math.round(q.fit ?? 100);
              const natMeta = getCountryMetaByCode(q.nat || 'TH') || getCountryMetaByCode('TH');
              const talkDone = q.careTalkMd === curTurn;
              const physDone = q.carePhysMd === curTurn;
              const medLv = state.med ?? 1;
              const physMin = 5 + Math.floor(medLv / 4) + (stf.physio ? 1 : 0);
              const physMax = physMin + 2;
              const mFactors = q.mentalFactors || [];
              const pFactors = q.physFactors || [];

              return (
                <div className="space-y-2.5 mland:space-y-1.5">
                  {/* Player Header */}
                  <div className="pb-2.5 mland:pb-1.5 border-b border-[var(--line)] flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="shrink-0">
                        <PlayerFace player={q} team={me} state={state} size={42} />
                        <span className="block text-center text-[9px] font-extrabold text-[var(--mut)] tabular mt-0.5">
                          #{shirtNo}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap text-sm mland:text-xs font-extrabold">
                          <PositionBadge role={q.ro} size="xs" />
                          {natMeta && <span title={natMeta.country}>{natMeta.flag}</span>}
                          <span className="truncate">{q.n}</span>
                          {isCap && <CaptainBadge team={me} state={state} size="xs" />}
                          {isFav && (
                            <span className="text-[10.5px] font-extrabold text-rose-600 dark:text-rose-400">
                              · 💖 ลูกรัก{favBoost > 0 ? ` (+${favBoost})` : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular flex flex-wrap items-center gap-x-1.5">
                          <span className={isStarter ? 'text-[var(--g)] font-semibold' : ''}>
                            {isStarter ? 'ตัวจริง' : 'สำรอง'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            พลัง <b className="text-[var(--ink)]">{ef(q)}</b>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>อายุ {q.age} ปี</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            ฟิต <b className={getStaminaMeta(fitPct).txtCls}>{fitPct}%</b>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {persDef.icon} {persDef.name}
                          </span>
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                          {persHint.hint}
                        </div>
                      </div>
                    </div>

                    {onInspectPlayer && (
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onInspectPlayer(q, me);
                        }}
                        className="btn btn-xs btn-secondary whitespace-nowrap shrink-0"
                      >
                        โปรไฟล์ ↗
                      </button>
                    )}
                  </div>

                  {/* Mental & Physical Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mland:gap-2 pb-2.5 mland:pb-1.5 border-b border-[var(--line)]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                        <span className="font-bold text-[var(--ink)]">🧠 จิตใจ</span>
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
                          title={`เกณฑ์ดี (${GOOD_MENTAL_THRESHOLD})`}
                          className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink)]/55"
                          style={{ left: `${GOOD_MENTAL_THRESHOLD}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] mland:text-[7.5px] text-[var(--mut)] tabular">
                        <span>เกณฑ์ดี {GOOD_MENTAL_THRESHOLD}</span>
                        <span className={mGood ? 'text-[var(--g)] font-bold' : ''}>
                          {mGood ? 'ถึงเกณฑ์แล้ว ✓' : `ขาดอีก ${GOOD_MENTAL_THRESHOLD - m}`}
                        </span>
                      </div>
                      {mFactors.length > 0 && (
                        <div className="space-y-0.5 pt-0.5">
                          {mFactors.slice(0, 3).map((f, idx) => (
                            <div
                              key={`${f.label}-${idx}`}
                              className="flex items-center justify-between gap-2 text-[10px] mland:text-[8px]"
                            >
                              <span className="text-[var(--mut)] truncate">{f.label}</span>
                              <span
                                className={`font-bold tabular shrink-0 ${
                                  f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'
                                }`}
                              >
                                {f.delta >= 0 ? `+${f.delta}` : f.delta}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 sm:pl-3 sm:border-l sm:border-[var(--line)]/70">
                      <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                        <span className="font-bold text-[var(--ink)]">💪 ร่างกาย</span>
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
                          title={`เกณฑ์ดี (${GOOD_PHYS_THRESHOLD})`}
                          className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink)]/55"
                          style={{ left: `${GOOD_PHYS_THRESHOLD}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] mland:text-[7.5px] text-[var(--mut)] tabular">
                        <span>ศูนย์แพทย์ Lv.{medLv}</span>
                        <span
                          className={
                            q.inj > 0
                              ? 'text-[var(--red)] font-bold'
                              : pGood
                                ? 'text-[var(--g)] font-bold'
                                : ''
                          }
                        >
                          {q.inj > 0
                            ? `บาดเจ็บ ${q.inj} นัด (เพดาน 52)`
                            : pGood
                              ? 'ถึงเกณฑ์แล้ว ✓'
                              : `ขาดอีก ${GOOD_PHYS_THRESHOLD - p}`}
                        </span>
                      </div>
                      {pFactors.length > 0 && (
                        <div className="space-y-0.5 pt-0.5">
                          {pFactors.slice(0, 3).map((f, idx) => (
                            <div
                              key={`${f.label}-${idx}`}
                              className="flex items-center justify-between gap-2 text-[10px] mland:text-[8px]"
                            >
                              <span className="text-[var(--mut)] truncate">{f.label}</span>
                              <span
                                className={`font-bold tabular shrink-0 ${
                                  f.delta >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'
                                }`}
                              >
                                {f.delta >= 0 ? `+${f.delta}` : f.delta}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Individual Talk Options */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                      <span className="font-bold text-[var(--ink)]">
                        💬 พูดคุยรายบุคคลกับนักเตะทีมเรา
                      </span>
                      <span className="text-[var(--mut)] tabular">
                        {talkDone
                          ? '✓ คุยรอบนี้แล้ว'
                          : careQuota.remaining <= 0
                            ? 'โควตาดูแลหมด'
                            : `เหลือโควตา ${careQuota.remaining}/${careQuota.limit}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {MANAGER_TALK_TOPICS.map((tp) => {
                        let hintNote: string | null = null;
                        if (tp.id === 'challenge' && persHint.tone === 'volatile' && m < 50) {
                          hintNote = '⚠ บุคลิกอ่อนไหว เสี่ยงเครียด';
                        } else if (tp.id === 'encourage' && (m < GOOD_MENTAL_THRESHOLD || q.inj > 0)) {
                          hintNote = '✓ แนะนำ: กำลังใจดีขึ้น';
                        } else if (tp.id === 'personal' && (m < 60 || p < GOOD_PHYS_THRESHOLD)) {
                          hintNote = '✓ แนะนำ: ผ่อนคลาย + กาย +2';
                        }
                        return (
                          <button
                            key={tp.id}
                            type="button"
                            disabled={talkDone || careQuota.remaining <= 0}
                            onClick={() => handleOwnPlayerTalk(q, tp.id)}
                            className="px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer disabled:opacity-45 disabled:cursor-default transition-all space-y-0.5"
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
                              {hintNote || tp.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={physDone || careQuota.remaining <= 0}
                      onClick={() => handleOwnPlayerPhysio(q)}
                      className="w-full px-3 py-2 mland:py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/35 hover:border-sky-500 flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-45 disabled:cursor-default transition-all"
                    >
                      <span className="font-bold text-xs mland:text-[9px] text-sky-700 dark:text-sky-300 truncate">
                        {physDone
                          ? '✓ ฟื้นฟูกล้ามเนื้อรอบนี้แล้ว'
                          : `🧊 ส่งกายภาพคลายกล้ามเนื้อ (+${physMin}..+${physMax} กาย · ฟิต +3%)`}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--g)] shrink-0">
                        {physDone ? 'เรียบร้อย' : 'ฟื้นฟู'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="p-6 text-center text-xs text-[var(--mut)]">
              คลิกเลือกหัวหน้าผู้ฝึกสอนหรือนักเตะของสโมสร {me.name} เพื่อเริ่มพูดคุย
            </div>
          )}

          {/* Room Conversation Transcript */}
          {activeTranscript.length > 0 ? (
            <div className="pt-2.5 border-t border-[var(--line)] space-y-1.5">
              <div className="text-[10.5px] mland:text-[8.5px] font-extrabold text-[var(--g)] flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>บันทึกการพูดคุยในห้องประชุม ({me.name})</span>
              </div>
              <div className="space-y-1.5">
                {activeTranscript.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 mland:p-2 rounded-xl bg-[var(--g-soft)]/45 border border-[var(--g)]/30 space-y-1 text-[11px] mland:text-[8.5px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                      <span className="text-[var(--ink)]">
                        {item.speaker} · {item.topicLabel}
                      </span>
                      {item.effectText && (
                        <span className="text-[var(--g)] tabular">{item.effectText}</span>
                      )}
                    </div>
                    {item.myLine && (
                      <div className="text-[var(--mut)] leading-snug">{item.myLine}</div>
                    )}
                    {item.replyLine && (
                      <div className="text-[var(--ink)] font-medium leading-snug">
                        {item.replyLine}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-[var(--line)]/60 flex items-center gap-2 text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
              <Shield className="w-3.5 h-3.5 shrink-0 text-[var(--mut)]" />
              <span>
                เลือกหัวข้อด้านบนเพื่อพูดคุยกับ{' '}
                <b className="text-[var(--ink)]">
                  {selectedParticipant.kind === 'coach'
                    ? ownCoach.name
                    : activePlayer?.n || 'นักเตะในทีม'}
                </b>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
