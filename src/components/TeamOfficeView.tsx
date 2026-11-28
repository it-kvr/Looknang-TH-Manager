import React, { useMemo, useState } from 'react';
import { MessageSquare, Search, Shield, Sparkles, Star, Users } from 'lucide-react';
import type {
  CoachOutfitId,
  CoachStyleId,
  GameState,
  Player,
  Position,
  TalkTopicId,
  Team
} from '../types/game';
import {
  AR_T,
  COACH_OUTFITS,
  COACH_STYLES,
  FN,
  FOREIGN_NAME_POOLS,
  PLAYER_PERSONALITIES,
  POS,
  SN,
  TN,
  getCountryMetaByCode,
  getForeignTeamCountryMeta
} from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { fmtMoney } from '../utils/math';
import {
  ef,
  getDefaultCoachVis,
  getShirtNo,
  pushFeed,
  vlu,
  xi
} from '../engine/playerCore';
import {
  getStaffState,
  isPlayerShortlisted,
  toggleShortlistPlayer
} from '../engine/simulation';
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
  resolvePersonalityId
} from '../engine/wellbeing';
import { ClubCrest, PlayerFace } from './SvgVisuals';
import { PositionBadge } from './PositionBadge';
import { CaptainBadge } from './CaptainBadge';
import { EffectText } from './DeltaText';
import { NavFocusBadge } from './NavFocusBanner';
import { getStaminaMeta } from './StaminaBar';

type RoomGroupMode = 'league' | 'type';
type RoomFilterKey = 'all' | 'mine' | 'domestic' | 'foreign' | 't2' | 't1' | 't0';
type SquadMemberFilter = 'ALL' | 'XI' | Position;
type SelectedParticipant = { kind: 'coach' } | { kind: 'player'; playerName: string };

interface TeamCoachProfile {
  name: string;
  vis: number[];
  style: (typeof COACH_STYLES)[number];
  outfit: CoachOutfitId;
  countryFlag: string;
  countryName: string;
  isOwnCoach: boolean;
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

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function inferCoachStyleFromTeam(team: Team): CoachStyleId {
  const phil = team.philosophy || '';
  if (phil.includes('บุก') || phil.includes('เพรส') || team.tac === 'X' || team.tac === 'A') {
    return 'attack';
  }
  if (phil.includes('รับ') || phil.includes('โต้') || team.tac === 'D' || team.tac === 'Z') {
    return 'defense';
  }
  if (phil.includes('ปั้น') || phil.includes('ดาวรุ่ง')) {
    return 'youth';
  }
  if (phil.includes('พลัง') || phil.includes('สปิริต') || phil.includes('ปลุก')) {
    return 'motivator';
  }
  return 'balanced';
}

function buildTeamCoachProfile(team: Team, state: GameState): TeamCoachProfile {
  const isOwn = team.id === state.me;
  const isForeign = team.tier >= 3 || team.foreign === 1;
  const foreignMeta = isForeign ? getForeignTeamCountryMeta(team.name) : null;
  const countryFlag = foreignMeta?.flag || '🇹🇭';
  const countryName = foreignMeta?.country || 'ไทย';

  if (isOwn) {
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
      outfit: state.club?.managerOutfit || 'suit_navy',
      countryFlag: '🇹🇭',
      countryName: 'ไทย',
      isOwnCoach: true
    };
  }

  const h = hashSeed(`${team.id}:${team.name}`);
  let coachName = '';
  if (foreignMeta && FOREIGN_NAME_POOLS[foreignMeta.region]) {
    const pool = FOREIGN_NAME_POOLS[foreignMeta.region];
    const f = pool.first[(h + 7) % pool.first.length];
    const l = pool.last[((h >>> 5) + 13) % pool.last.length];
    coachName = `${f} ${l}`;
  } else {
    const f = FN[(h + 11) % FN.length];
    const l = SN[((h >>> 6) + 5) % SN.length];
    coachName = `โค้ช${f} ${l}`;
  }

  const styleId = inferCoachStyleFromTeam(team);
  const style = COACH_STYLES.find((s) => s.id === styleId) || COACH_STYLES[0];
  const outfit = COACH_OUTFITS[h % COACH_OUTFITS.length]?.id || 'suit_navy';
  const vis = getDefaultCoachVis(`${team.id}-${coachName}`);

  return {
    name: coachName,
    vis,
    style,
    outfit,
    countryFlag,
    countryName,
    isOwnCoach: false
  };
}

function getTeamCategoryKind(team: Team, myTeamId: number): 'mine' | 'domestic' | 'foreign' {
  if (team.id === myTeamId) return 'mine';
  if (team.tier >= 3 || team.foreign === 1) return 'foreign';
  return 'domestic';
}

function getRoomTypeBadgeText(team: Team, myTeamId: number): string {
  const kind = getTeamCategoryKind(team, myTeamId);
  if (kind === 'mine') return 'ทีมของเรา';
  if (kind === 'foreign') {
    const meta = getForeignTeamCountryMeta(team.name);
    return meta ? `นานาชาติ · ${meta.country}` : 'ทีมต่างประเทศ';
  }
  return 'ทีมในประเทศ';
}

export const TeamOfficeView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer?: (player: Player, team: Team | null) => void;
  onToast: (msg: string) => void;
  isFocused?: (id: string) => boolean;
}> = ({ state, onUpdateState, onInspectPlayer, onToast, isFocused }) => {
  const me = state.teams[state.me];
  const curTurn = (state.season ?? 1) * 100 + (state.md ?? 0);

  const [groupMode, setGroupMode] = useState<RoomGroupMode>('league');
  const [roomFilter, setRoomFilter] = useState<RoomFilterKey>('all');
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number>(() => state.me);
  const [memberFilter, setMemberFilter] = useState<SquadMemberFilter>('ALL');
  const [selectedParticipant, setSelectedParticipant] = useState<SelectedParticipant>({
    kind: 'coach'
  });
  const [roomLogs, setRoomLogs] = useState<Record<string, OfficeTalkEntry[]>>({});
  const [actedCoachTurns, setActedCoachTurns] = useState<Record<string, number>>({});

  const coachByTeamId = useMemo(() => {
    const map = new Map<number, TeamCoachProfile>();
    for (const t of state.teams) {
      map.set(t.id, buildTeamCoachProfile(t, state));
    }
    return map;
  }, [state]);

  const filteredTeams = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    return state.teams
      .filter((t) => {
        const kind = getTeamCategoryKind(t, state.me);
        if (roomFilter === 'mine' && kind !== 'mine') return false;
        if (roomFilter === 'domestic' && kind !== 'domestic') return false;
        if (roomFilter === 'foreign' && kind !== 'foreign') return false;
        if (roomFilter === 't2' && (t.tier !== 2 || t.foreign === 1)) return false;
        if (roomFilter === 't1' && (t.tier !== 1 || t.foreign === 1)) return false;
        if (roomFilter === 't0' && (t.tier !== 0 || t.foreign === 1)) return false;

        if (!q) return true;
        const coach = coachByTeamId.get(t.id);
        const tierName = (TN[t.tier] || '').toLowerCase();
        const country = (coach?.countryName || '').toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (coach?.name.toLowerCase().includes(q) ?? false) ||
          tierName.includes(q) ||
          country.includes(q) ||
          t.sq.some((pl) => pl.n.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.id === state.me) return -1;
        if (b.id === state.me) return 1;
        if (a.tier !== b.tier) {
          // Order domestic top -> mid -> low, then foreign
          const rankTier = (tm: Team) =>
            tm.tier >= 3 || tm.foreign === 1 ? 9 : 3 - tm.tier;
          return rankTier(a) - rankTier(b);
        }
        return (b.pts ?? 0) - (a.pts ?? 0) || a.name.localeCompare(b.name, 'th');
      });
  }, [state.teams, state.me, roomFilter, roomSearch, coachByTeamId]);

  const groupedRooms = useMemo(() => {
    if (groupMode === 'type') {
      const buckets: Array<{ id: string; title: string; subtitle: string; teams: Team[] }> = [
        {
          id: 'type-mine',
          title: '🏠 ห้องประชุมสโมสรของเรา',
          subtitle: 'ผู้เล่นและสตาฟฟ์ของสโมสรคุณ',
          teams: []
        },
        {
          id: 'type-domestic',
          title: '🇹🇭 ห้องประชุมทีมในประเทศ (ไทย)',
          subtitle: 'คู่แข่งระดับจังหวัด ดิวิชั่น 2 และดิวิชั่น 1',
          teams: []
        },
        {
          id: 'type-foreign',
          title: '🌏 ห้องประชุมทีมต่างประเทศ (นานาชาติ)',
          subtitle: 'สโมสรต่างแดนและกุนซือนานาชาติ',
          teams: []
        }
      ];
      for (const t of filteredTeams) {
        const k = getTeamCategoryKind(t, state.me);
        if (k === 'mine') buckets[0].teams.push(t);
        else if (k === 'foreign') buckets[2].teams.push(t);
        else buckets[1].teams.push(t);
      }
      return buckets.filter((b) => b.teams.length > 0);
    }

    const buckets: Array<{ id: string; title: string; subtitle: string; teams: Team[] }> = [
      {
        id: 'tier-mine',
        title: `⭐ ห้องประชุมทีมหลักของเรา (${TN[me.tier] || 'ลีก'})`,
        subtitle: 'เข้าถึงนักเตะและโค้ชในสโมสรของคุณได้ทันที',
        teams: []
      },
      {
        id: 'tier-2',
        title: `🏆 ห้องประชุมระดับ${TN[2]}`,
        subtitle: 'สโมสรชั้นนำและคู่แข่งในลีกสูงสุดของไทย',
        teams: []
      },
      {
        id: 'tier-1',
        title: `⚽ ห้องประชุมระดับ${TN[1]}`,
        subtitle: 'สโมสรระดับดิวิชั่น 2 ในประเทศ',
        teams: []
      },
      {
        id: 'tier-0',
        title: `🌱 ห้องประชุมระดับ${TN[0]}`,
        subtitle: 'สโมสรภูธรและลีกระดับจังหวัด',
        teams: []
      },
      {
        id: 'tier-3',
        title: `🌍 ห้องประชุมระดับ${TN[3]}`,
        subtitle: 'สโมสรชั้นนำจากเอเชีย ยุโรป อเมริกา และแอฟริกา',
        teams: []
      }
    ];
    for (const t of filteredTeams) {
      if (t.id === state.me) buckets[0].teams.push(t);
      else if (t.tier >= 3 || t.foreign === 1) buckets[4].teams.push(t);
      else if (t.tier === 2) buckets[1].teams.push(t);
      else if (t.tier === 1) buckets[2].teams.push(t);
      else buckets[3].teams.push(t);
    }
    return buckets.filter((b) => b.teams.length > 0);
  }, [filteredTeams, groupMode, state.me, me.tier]);

  const activeTeam =
    state.teams.find((t) => t.id === selectedTeamId) ||
    filteredTeams[0] ||
    me;
  const activeCoach = coachByTeamId.get(activeTeam.id) || buildTeamCoachProfile(activeTeam, state);
  const isMyClubRoom = activeTeam.id === state.me;
  const activeStarters = useMemo(() => xi(activeTeam), [activeTeam]);
  const activeStarterNames = useMemo(
    () => new Set(activeStarters.map((q) => q.n)),
    [activeStarters]
  );
  const favNamesSet = useMemo(
    () => new Set(isMyClubRoom ? getTeamFavoriteNames(activeTeam) : []),
    [isMyClubRoom, activeTeam]
  );

  const sortedRoomPlayers = useMemo(() => {
    const base = activeTeam.sq.filter((q) => {
      if (memberFilter === 'ALL') return true;
      if (memberFilter === 'XI') return activeStarterNames.has(q.n);
      return q.pos === memberFilter;
    });
    return base.sort((a, b) => {
      const aStarter = activeStarterNames.has(a.n) ? 0 : 1;
      const bStarter = activeStarterNames.has(b.n) ? 0 : 1;
      if (aStarter !== bStarter) return aStarter - bStarter;
      const pDiff = POS.indexOf(a.pos) - POS.indexOf(b.pos);
      if (pDiff !== 0) return pDiff;
      return b.ov - a.ov;
    });
  }, [activeTeam.sq, memberFilter, activeStarterNames]);

  const activePlayer = useMemo(() => {
    if (selectedParticipant.kind !== 'player') return null;
    return (
      activeTeam.sq.find((q) => q.n === selectedParticipant.playerName) ||
      sortedRoomPlayers[0] ||
      activeTeam.sq[0] ||
      null
    );
  }, [selectedParticipant, activeTeam.sq, sortedRoomPlayers]);

  const careQuota = useMemo(() => getTeamCareQuotaInfo(state, me), [state, me]);

  const appendRoomLog = (key: string, entry: Omit<OfficeTalkEntry, 'id' | 'turn'>) => {
    const full: OfficeTalkEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      turn: curTurn
    };
    setRoomLogs((prev) => ({
      ...prev,
      [key]: [full, ...(prev[key] || [])].slice(0, 8)
    }));
  };

  const handleSelectRoom = (team: Team) => {
    SFX.tap();
    setSelectedTeamId(team.id);
    setMemberFilter('ALL');
    setSelectedParticipant({ kind: 'coach' });
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
      appendRoomLog(`player:${activeTeam.id}:${player.n}`, {
        speaker: player.n,
        topicLabel: out.topicLabel || 'คุยรายบุคคล',
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
      appendRoomLog(`player:${activeTeam.id}:${player.n}`, {
        speaker: player.n,
        topicLabel: out.topicLabel || 'ฟื้นฟูร่างกาย',
        myLine: out.coachLine || '',
        replyLine: out.playerReply || '',
        effectText: `กาย +${out.deltaPhys} · ฟิต +3%`
      });
    } else SFX.tap();
    if (out.msg) onToast(out.msg);
  };

  const handleRivalCoachTalk = (
    topic: 'respect' | 'scout' | 'tactical' | 'mindgame'
  ) => {
    const key = `coach:${activeTeam.id}`;
    const alreadyThisTurn = actedCoachTurns[key] === curTurn;
    const myCoachName = state.club?.managerName?.trim() || 'กุนซือทีมเรา';
    const topPlayer = activeTeam.sq.slice().sort((a, b) => b.ov - a.ov)[0];
    const listedPlayers = activeTeam.sq.filter((q) => q.listed || (q.age <= 22 && q.pot >= 75));

    if (topic === 'respect') {
      let repAdded = false;
      if (!alreadyThisTurn) {
        onUpdateState((d) => {
          d.mgrRep = (d.mgrRep ?? 50) + 1;
          repAdded = true;
        });
        setActedCoachTurns((prev) => ({ ...prev, [key]: curTurn }));
      }
      SFX.confirm();
      const myLine = `${myCoachName}: “ยินดีที่ได้แลกเปลี่ยนมุมมองครับโค้ช ${activeCoach.name} ทีม ${activeTeam.name} มีวินัยในสไตล์ ${activeCoach.style.name} ที่น่าชื่นชมมาก”`;
      const replyLine = `${activeCoach.name}: “ขอบคุณครับ! แนวทางของ ${me.name} ก็น่าจับตามองเช่นกัน หวังว่าเราจะได้ดวลเกมคุณภาพในสนามนะครับ”`;
      appendRoomLog(key, {
        speaker: activeCoach.name,
        topicLabel: 'จับมือแลกเปลี่ยนมุมมอง',
        myLine,
        replyLine,
        effectText: repAdded ? 'ชื่อเสียงผู้จัดการทีม +1' : 'บันทึกบทสนทนาแล้ว'
      });
      onToast(
        repAdded
          ? `🤝 พูดคุยแลกเปลี่ยนกับโค้ช ${activeCoach.name} เรียบร้อย (ชื่อเสียง +1)`
          : `🤝 สนทนากับโค้ช ${activeCoach.name} เพิ่มเติม`
      );
      return;
    }

    if (topic === 'scout') {
      SFX.tap();
      const highlightNames = (listedPlayers.length ? listedPlayers : activeTeam.sq.slice(0, 3))
        .slice(0, 3)
        .map((q) => `${q.n} (${q.ro}, OVR ${q.ov})`)
        .join(', ');
      onUpdateState((d) => {
        const targetT = d.teams[activeTeam.id];
        if (targetT) {
          targetT.sq.slice(0, 5).forEach((pl) => {
            pl.scouted = true;
          });
        }
      });
      const myLine = `${myCoachName}: “ช่วงนี้ขุมกำลังของ ${activeTeam.name} ดูลงตัวดี มีนักเตะคนไหนที่กำลังฟอร์มแรงหรือเปิดรับโอกาสใหม่ๆ บ้างครับ?”`;
      const replyLine = `${activeCoach.name}: “แกนหลักของเราอย่าง ${topPlayer?.n || 'ตัวหลัก'} กำลังมั่นใจมาก ส่วนกลุ่มที่น่าจับตาในทีมก็มี ${highlightNames} ครับ”`;
      appendRoomLog(key, {
        speaker: activeCoach.name,
        topicLabel: 'สอบถามขุมกำลัง & แมวมอง',
        myLine,
        replyLine,
        effectText: 'อัปเดตข้อมูลแมวมองนักเตะในห้อง'
      });
      onToast(`🔎 เก็บข้อมูลขุมกำลังจากโค้ช ${activeCoach.name} แล้ว`);
      return;
    }

    if (topic === 'tactical') {
      SFX.tap();
      const counterTip =
        activeTeam.tac === 'X' || activeTeam.tac === 'A'
          ? 'เน้นรับรัดกุมและสวนกลับพื้นที่ว่างด้านหลังแบ็กคู่แข่ง'
          : activeTeam.tac === 'D' || activeTeam.tac === 'Z'
            ? 'เร่งจังหวะถ่ายบอลซ้าย-ขวาเพื่อเจาะเกมรับโซนลึก'
            : 'ครองบอลคุมจังหวะแดนกลางและชิงความได้เปรียบลูกตั้งเตะ';
      const myLine = `${myCoachName}: “ระบบ ${activeTeam.form} แบบ${AR_T[activeTeam.tac]}ของทีมคุณจัดระเบียบได้ดีมาก เจอกันนัดหน้าคงวัดกันที่แท็กติกแน่นอน”`;
      const replyLine = `${activeCoach.name}: “แน่นอนครับ! เราซ้อม${activeTeam.philosophy || activeCoach.style.shortDesc}มาตลอด — ไม่มีทางเปิดพื้นที่ให้ง่ายๆ แน่”`;
      appendRoomLog(key, {
        speaker: activeCoach.name,
        topicLabel: 'วิเคราะห์แท็กติกตัวต่อตัว',
        myLine,
        replyLine,
        effectText: `คำแนะนำ: ${counterTip}`
      });
      onToast(`⚔️ วิเคราะห์แท็กติกคู่แข่ง: ${counterTip}`);
      return;
    }

    // mindgame
    SFX.confirm();
    onUpdateState((d) => {
      const targetT = d.teams[activeTeam.id];
      if (targetT) {
        targetT.aiTalkNote = `🔥 โค้ชโต้กลับหลังพูดคุยจิตวิทยากับ ${me.name}`;
      }
      if (!alreadyThisTurn) {
        d.mor = Math.min(100, (d.mor ?? 55) + 1);
        pushFeed(
          d,
          'จิตวิทยากุนซือ',
          `🔥 ${myCoachName} เปิดฉากพูดคุยจิตวิทยาตัวต่อตัวกับโค้ช ${activeCoach.name} แห่ง ${activeTeam.name}`,
          ''
        );
      }
    });
    if (!alreadyThisTurn) {
      setActedCoachTurns((prev) => ({ ...prev, [key]: curTurn }));
    }
    const myLine = `${myCoachName}: “แรงกดดันนัดหน้าอยู่ที่ ${activeTeam.name} เต็มๆ นะโค้ช ${activeCoach.name} มาดูกันว่าแผนของคุณจะรับมือความเร็วทีมเราได้ไหม”`;
    const replyLine = `${activeCoach.name}: “คำพูดนอกสนามไม่ได้ช่วยให้ชนะใน 90 นาทีหรอกครับ เดี๋ยวเราไปตัดสินกันในสนาม!”`;
    appendRoomLog(key, {
      speaker: activeCoach.name,
      topicLabel: 'สงครามจิตวิทยา',
      myLine,
      replyLine,
      effectText: !alreadyThisTurn ? 'ขวัญทีมเรา +1% · ส่งสารท้าทายถึงคู่แข่ง' : 'โต้ตอบจิตวิทยาแล้ว'
    });
    onToast(`🔥 เปิดฉากพูดคุยจิตวิทยากับโค้ช ${activeCoach.name} แล้ว`);
  };

  const handleRivalPlayerTalk = (
    player: Player,
    topic: 'praise' | 'transfer' | 'tactics' | 'banter'
  ) => {
    const key = `player:${activeTeam.id}:${player.n}`;
    const myCoachName = state.club?.managerName?.trim() || 'กุนซือทีมเรา';
    const persId = resolvePersonalityId(player, null);
    const persDef = PLAYER_PERSONALITIES[persId] || PLAYER_PERSONALITIES[3];
    const mScore = getPlayerMentalScore(player, null);
    const estFee = fmtMoney(vlu(player));

    if (topic === 'praise') {
      const turnKey = `rp:${activeTeam.id}:${player.n}`;
      let repUp = false;
      if (actedCoachTurns[turnKey] !== curTurn) {
        onUpdateState((d) => {
          d.mgrRep = (d.mgrRep ?? 50) + 1;
          repUp = true;
        });
        setActedCoachTurns((prev) => ({ ...prev, [turnKey]: curTurn }));
      }
      SFX.confirm();
      appendRoomLog(key, {
        speaker: player.n,
        topicLabel: 'ทักทาย & ชื่นชมฝีเท้า',
        myLine: `${myCoachName}: “จังหวะการเล่นในตำแหน่ง ${player.ro} ของคุณดูเฉียบขาดมาก ${player.n} รักษาฟอร์มแบบนี้ไว้นะ”`,
        replyLine: `“ขอบคุณมากครับโค้ช! ผมได้ติดตามสไตล์การทำทีมของ ${me.name} อยู่เหมือนกัน ชื่นชมมากครับ”`,
        effectText: `บุคลิก: ${persDef.icon} ${persDef.name}${repUp ? ' · ชื่อเสียง +1' : ''}`
      });
      onToast(`🤝 ทักทายพูดคุยกับ ${player.n} แล้ว (${persDef.name})`);
      return;
    }

    if (topic === 'transfer') {
      SFX.tap();
      const openToMove =
        mScore < 62 ||
        Boolean(player.listed) ||
        (player.con?.yr ?? 2) <= 1 ||
        activeTeam.tier < me.tier;
      onUpdateState((d) => {
        const targetPl = d.teams[activeTeam.id]?.sq.find((q) => q.n === player.n);
        if (targetPl) targetPl.scouted = true;
      });
      appendRoomLog(key, {
        speaker: player.n,
        topicLabel: 'สอบถามโอกาสย้ายร่วมทีม',
        myLine: `${myCoachName}: “ถ้าในอนาคต ${me.name} เปิดโอกาสให้คุณมาร่วมโปรเจกต์ของเรา คุณมองความท้าทายนี้ยังไง?”`,
        replyLine: openToMove
          ? `“พูดตามตรงผมพร้อมเปิดรับข้อเสนอใหม่นะครับ ถ้า ${me.name} ยื่นเจรจาจริงจังผมยินดีรับฟังเลย”`
          : `“ตอนนี้ผมยังโฟกัสกับ ${activeTeam.name} อยู่ครับ แต่ในวงการฟุตบอลอะไรก็เกิดขึ้นได้ในอนาคต”`,
        effectText: `${openToMove ? '✓ มีแนวโน้มสนใจย้ายทีม' : '● ยังภักดีต่อต้นสังกัด'} · ประเมินค่าตัว ~${estFee}`
      });
      onToast(
        openToMove
          ? `📋 ${player.n} เปิดใจรับฟังข้อเสนอ (ประเมิน ${estFee})`
          : `📋 ${player.n} ยังโฟกัสกับ ${activeTeam.name} (ประเมิน ${estFee})`
      );
      return;
    }

    if (topic === 'tactics') {
      SFX.tap();
      onUpdateState((d) => {
        const targetPl = d.teams[activeTeam.id]?.sq.find((q) => q.n === player.n);
        if (targetPl) targetPl.scouted = true;
      });
      const altTxt = player.altRoles?.length
        ? `ถนัดรอง: ${player.altRoles.slice(0, 3).join(', ')}`
        : `ถนัดเฉพาะตำแหน่ง ${player.ro}`;
      appendRoomLog(key, {
        speaker: player.n,
        topicLabel: 'แลกเปลี่ยนมุมมองแท็กติก',
        myLine: `${myCoachName}: “เวลาทีมของคุณเล่นระบบ ${activeTeam.form} คุณชอบรับบอลหรือโจมตีพื้นที่จุดไหนมากที่สุด?”`,
        replyLine: `“ผมชอบอ่านจังหวะเคลื่อนที่ในพื้นที่ ${player.ro} แล้วปรับตามสถานการณ์เกมครับ (${altTxt})”`,
        effectText: `ปลดล็อกข้อมูลแมวมอง · ${altTxt}`
      });
      onToast(`🧭 แลกเปลี่ยนมุมมองแท็กติกกับ ${player.n} แล้ว`);
      return;
    }

    // banter
    SFX.confirm();
    const isResilient = persId === 0 || persId === 1 || persId === 4;
    appendRoomLog(key, {
      speaker: player.n,
      topicLabel: 'จิตวิทยาหยั่งเชิงก่อนเกม',
      myLine: `${myCoachName}: “เจอกันในสนามนัดหน้า แนวรับและแผนของ ${me.name} เตรียมแผนรับมือการเล่นของคุณไว้หมดแล้วนะ ${player.n}”`,
      replyLine: isResilient
        ? `“ดีเลยครับโค้ช! ผมชอบเกมที่คู่แข่งเตรียมตัวมาดีแบบนั้น ยิ่งทำให้อยากลงไปพิสูจน์ฝีเท้าในสนาม”`
        : `“หืม... งั้นผมคงต้องกลับไปซ้อมเพิ่มจังหวะพิเศษไว้รับมือแผนของ ${me.name} บ้างแล้วล่ะครับ”`,
      effectText: `ใจปัจจุบันของคู่แข่ง: ${mScore}/100 (${persDef.name})`
    });
    onToast(`🔥 หยั่งเชิงพูดคุยกับ ${player.n} แล้ว`);
  };

  const handleOwnCoachBriefing = (mode: 'staff' | 'morale') => {
    SFX.confirm();
    const stf = getStaffState(state);
    const key = `coach:${activeTeam.id}`;
    if (mode === 'staff') {
      appendRoomLog(key, {
        speaker: activeCoach.name,
        topicLabel: 'ประชุมสรุปงานสตาฟฟ์โค้ช',
        myLine: `คุณเรียกประชุมย่อยกับทีมงาน (ผู้ช่วย Lv.${stf.asst} · ฟิตเนส Lv.${stf.fit} · แพทย์ Lv.${stf.physio})`,
        replyLine: `“ขุมกำลังพร้อมลุย! เข้าใจแผน ${me.tacFam ?? 65}% · โควตาดูแลรายบุคคลเหลือ ${careQuota.remaining}/${careQuota.limit} ครั้งในรอบนี้”`,
        effectText: `สไตล์คุมทีม: ${activeCoach.style.icon} ${activeCoach.style.name}`
      });
      onToast('👔 สรุปรายงานทีมงานสตาฟฟ์เรียบร้อย');
    } else {
      const lowM = me.sq.filter((q) => getPlayerMentalScore(q, null) < 60).length;
      appendRoomLog(key, {
        speaker: activeCoach.name,
        topicLabel: 'เช็กขวัญกำลังใจในห้องประชุม',
        myLine: `คุณประเมินบรรยากาศห้องแต่งตัวและสภาพจิตใจลูกทีม ${me.sq.length} คน`,
        replyLine:
          lowM > 0
            ? `“มีนักเตะที่จิตใจต่ำกว่า 60 อยู่ ${lowM} คน แนะนำให้คลิกเลือกชื่อนักเตะด้านซ้ายเพื่อคุยรายบุคคลต่อได้เลยครับ”`
            : `“บรรยากาศในทีมยอดเยี่ยมมากครับ ทุกคนมีสมาธิและกำลังใจพร้อมสำหรับเกมถัดไป!”`,
        effectText: `ขวัญทีม ${state.mor ?? 55}% · จิตใจต่ำ ${lowM} คน`
      });
      onToast(
        lowM > 0
          ? `📋 พบนักเตะควรคุยดูแลเพิ่ม ${lowM} คนในห้องนี้`
          : '✅ สภาพจิตใจลูกทีมทุกคนอยู่ในเกณฑ์ดี'
      );
    }
  };

  const activeParticipantKey =
    selectedParticipant.kind === 'coach'
      ? `coach:${activeTeam.id}`
      : `player:${activeTeam.id}:${activePlayer?.n || ''}`;
  const activeTranscript = roomLogs[activeParticipantKey] || [];
  const activeCountry =
    activeTeam.tier >= 3 || activeTeam.foreign === 1
      ? getForeignTeamCountryMeta(activeTeam.name)
      : getCountryMetaByCode('TH');

  return (
    <div
      data-focus-id="team-office-view"
      className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[210px_minmax(0,1fr)] md:grid-cols-[270px_1fr] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[305px_1fr] mland:grid-cols-[235px_1fr] mland:grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-1.5 overflow-hidden"
    >
      {/* ==================== LEFT: CATEGORIZED MEETING ROOMS DIRECTORY ==================== */}
      <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 mland:p-1.5 flex flex-col gap-1.5 mland:gap-1 min-h-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Users className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
            <h3 className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] truncate">
              รายการห้องประชุม
            </h3>
          </div>
          <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular shrink-0">
            {filteredTeams.length}/{state.teams.length} ห้อง
          </span>
        </div>

        {/* Group By Toggle: League Tier vs Team Type */}
        <div className="seg-bar grid grid-cols-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              setGroupMode('league');
              setRoomFilter('all');
            }}
            className={`seg-btn whitespace-nowrap px-1.5! py-1! mland:py-0.5! ${
              groupMode === 'league' ? 'seg-btn-active' : ''
            }`}
          >
            แยกระดับลีก
          </button>
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              setGroupMode('type');
              setRoomFilter('all');
            }}
            className={`seg-btn whitespace-nowrap px-1.5! py-1! mland:py-0.5! ${
              groupMode === 'type' ? 'seg-btn-active' : ''
            }`}
          >
            แยกประเภททีม
          </button>
        </div>

        {/* Quick Sub-Filter Strip matching active grouping mode */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          {(groupMode === 'league'
            ? ([
                ['all', 'ทั้งหมด'],
                ['t2', 'D1'],
                ['t1', 'D2'],
                ['t0', 'จังหวัด'],
                ['foreign', 'นานาชาติ']
              ] as [RoomFilterKey, string][])
            : ([
                ['all', 'ทั้งหมด'],
                ['mine', 'ทีมเรา'],
                ['domestic', 'ในประเทศ'],
                ['foreign', 'ต่างประเทศ']
              ] as [RoomFilterKey, string][])
          ).map(([fk, lbl]) => (
            <button
              key={fk}
              type="button"
              onClick={() => {
                SFX.tap();
                setRoomFilter(fk);
              }}
              className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg text-[10px] mland:text-[8px] font-bold border cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                roomFilter === fk
                  ? 'bg-[var(--g)] text-white border-[var(--g)]'
                  : 'bg-[var(--surface-2)]/70 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Search Room / Team / Coach */}
        <label className="relative block shrink-0">
          <Search className="w-3.5 h-3.5 text-[var(--mut)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={roomSearch}
            onChange={(e) => setRoomSearch(e.target.value)}
            placeholder="ค้นหาห้องประชุม, ชื่อทีม, โค้ช..."
            className="w-full pl-7 pr-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)]/65 border border-[var(--line)] text-[11px] mland:text-[9px] text-[var(--ink)] placeholder:text-[var(--mut)] focus:outline-none focus:border-[var(--g)]"
          />
        </label>

        {/* Scrollable Grouped Meeting Rooms List */}
        <div className="flex-1 min-h-0 overflow-y-auto border border-[var(--line)] rounded-xl divide-y divide-[var(--line)]">
          {groupedRooms.length === 0 ? (
            <div className="p-4 text-center space-y-2">
              <div className="text-[11px] text-[var(--mut)]">ไม่พบห้องประชุมที่ตรงกับตัวกรองนี้</div>
              <button
                type="button"
                onClick={() => {
                  setRoomFilter('all');
                  setRoomSearch('');
                }}
                className="btn btn-xs btn-secondary"
              >
                ล้างตัวกรอง
              </button>
            </div>
          ) : (
            groupedRooms.map((group) => (
              <div key={group.id}>
                <div className="sticky top-0 z-10 px-2.5 py-1.5 mland:px-2 mland:py-1 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-2">
                  <span className="text-[10.5px] mland:text-[8.5px] font-extrabold text-[var(--ink)] truncate">
                    {group.title}
                  </span>
                  <span className="text-[9.5px] mland:text-[8px] font-bold text-[var(--mut)] tabular shrink-0">
                    {group.teams.length} ห้อง
                  </span>
                </div>
                <div className="divide-y divide-[var(--line)]/60">
                  {group.teams.map((tm) => {
                    const isSelected = tm.id === activeTeam.id;
                    const isMine = tm.id === state.me;
                    const coach = coachByTeamId.get(tm.id);
                    const cMeta =
                      tm.tier >= 3 || tm.foreign === 1
                        ? getForeignTeamCountryMeta(tm.name)
                        : getCountryMetaByCode('TH');

                    return (
                      <button
                        key={tm.id}
                        type="button"
                        onClick={() => handleSelectRoom(tm)}
                        className={`w-full px-2.5 py-1.5 mland:px-2 mland:py-1 flex items-center gap-2 text-left cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[var(--g-soft)]'
                            : 'hover:bg-[var(--surface-2)]/75'
                        }`}
                      >
                        <div className="shrink-0 w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/70 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                          <ClubCrest
                            name={tm.name}
                            size={20}
                            team={tm}
                            club={state.club}
                            isMyClub={isMine && state.mode === 'm'}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 min-w-0 text-[11.5px] mland:text-[9.5px] font-bold text-[var(--ink)]">
                            {cMeta && (
                              <span className="text-[10.5px] mland:text-[8.5px] shrink-0" title={cMeta.country}>
                                {cMeta.flag}
                              </span>
                            )}
                            <span className="truncate">{tm.name}</span>
                            {isMine && (
                              <span className="text-[9.5px] mland:text-[8px] font-extrabold text-[var(--g)] shrink-0">
                                (ทีมเรา)
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate tabular">
                            {TN[tm.tier] || 'ลีก'} · {tm.sq.length} คน · 👔 {coach?.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ==================== RIGHT: ACTIVE MEETING ROOM & INDIVIDUAL TALK DESK ==================== */}
      <div className="min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden">
        {/* Active Room Header */}
        <div className="shrink-0 px-3 py-2 mland:px-2.5 mland:py-1 border-b border-[var(--line)] bg-[var(--surface-2)]/35 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="shrink-0 w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
              <ClubCrest
                name={activeTeam.name}
                size={20}
                team={activeTeam}
                club={state.club}
                isMyClub={isMyClubRoom && state.mode === 'm'}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 text-xs sm:text-sm mland:text-[10.5px] font-extrabold text-[var(--ink)]">
                {activeCountry && <span className="shrink-0">{activeCountry.flag}</span>}
                <span className="truncate">ห้องประชุม · {activeTeam.name}</span>
                {isFocused?.(`room:${activeTeam.id}`) && <NavFocusBadge />}
              </div>
              <div className="text-[10px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                {TN[activeTeam.tier]} · {getRoomTypeBadgeText(activeTeam, state.me)} · แผน {activeTeam.form} ({AR_T[activeTeam.tac]}) · {activeTeam.sq.length} ผู้เล่น
              </div>
            </div>
          </div>

          <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular shrink-0">
            {isMyClubRoom ? (
              <span>
                โควตาคุยทีมเรา{' '}
                <b className={careQuota.remaining > 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>
                  {careQuota.remaining}/{careQuota.limit}
                </b>
              </span>
            ) : (
              <span>คลิกเลือกผู้เล่นในทีมหรือโค้ชคู่แข่งเพื่อคุยรายบุคคล</span>
            )}
          </div>
        </div>

        {/* Room Split: Left Participants (Coach + Squad) | Right Individual Conversation */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[248px_1fr] mland:grid-cols-[205px_1fr] divide-y lg:divide-y-0 lg:divide-x mland:divide-y-0 mland:divide-x divide-[var(--line)] overflow-hidden">
          {/* Sub-Column 1: Clickable Coach & Squad Members in this Room */}
          <div className="min-h-[150px] lg:min-h-0 flex flex-col overflow-hidden bg-[var(--surface-2)]/15">
            {/* Coach Button (Own Coach or Rival Coach) */}
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setSelectedParticipant({ kind: 'coach' });
              }}
              className={`shrink-0 px-2.5 py-2 mland:px-2 mland:py-1.5 border-b border-[var(--line)] flex items-center gap-2 text-left cursor-pointer transition-colors ${
                selectedParticipant.kind === 'coach'
                  ? 'bg-[var(--g-soft)]'
                  : 'hover:bg-[var(--surface-2)]/80'
              }`}
            >
              <PlayerFace
                player={{
                  n: activeCoach.name,
                  pos: 'MF',
                  ro: 'CM',
                  ov: 70,
                  age: 45,
                  pot: 70,
                  fit: 100,
                  inj: 0,
                  vis: activeCoach.vis
                }}
                team={activeTeam}
                state={state}
                size={32}
                coachOutfit={activeCoach.outfit}
                coachClubKit={activeTeam.kc[0]}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0 text-[11px] mland:text-[9px] font-extrabold text-[var(--ink)]">
                  <span>{activeCoach.countryFlag}</span>
                  <span className="truncate">{activeCoach.name}</span>
                </div>
                <div className="text-[9.5px] mland:text-[8px] font-semibold text-[var(--g)] truncate">
                  {activeCoach.isOwnCoach ? '👔 กุนซือสโมสรเรา' : '👔 โค้ชคู่แข่ง'} · {activeCoach.style.name}
                </div>
              </div>
            </button>

            {/* Squad Filter Bar inside Room */}
            <div className="shrink-0 px-2 py-1.5 mland:px-1.5 mland:py-1 border-b border-[var(--line)]/70 flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(['ALL', 'XI', 'GK', 'DF', 'MF', 'FW'] as const).map((mk) => (
                <button
                  key={mk}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setMemberFilter(mk);
                  }}
                  className={`px-1.5 py-0.5 rounded-md text-[9.5px] mland:text-[7.5px] font-bold border cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    memberFilter === mk
                      ? 'bg-[var(--g)] text-white border-[var(--g)]'
                      : 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]'
                  }`}
                >
                  {mk === 'ALL' ? `ทั้งหมด (${activeTeam.sq.length})` : mk === 'XI' ? 'ตัวจริง' : mk}
                </button>
              ))}
            </div>

            {/* Clickable Squad Players List */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/60">
              {sortedRoomPlayers.map((q) => {
                const selected =
                  selectedParticipant.kind === 'player' && activePlayer?.n === q.n;
                const isStarter = activeStarterNames.has(q.n);
                const m = getPlayerMentalScore(q, null);
                const p = getPlayerPhysScore(q, null);
                const natMeta =
                  getCountryMetaByCode(q.nat) ||
                  (activeTeam.tier >= 3 || activeTeam.foreign === 1
                    ? getForeignTeamCountryMeta(activeTeam.name)
                    : getCountryMetaByCode('TH'));
                const isFav = favNamesSet.has(q.n);

                return (
                  <button
                    key={q.n}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setSelectedParticipant({ kind: 'player', playerName: q.n });
                    }}
                    className={`w-full px-2 py-1.5 mland:px-1.5 mland:py-1 flex items-center gap-2 mland:gap-1.5 text-left cursor-pointer transition-colors ${
                      selected ? 'bg-[var(--g-soft)]' : 'hover:bg-[var(--surface-2)]/75'
                    }`}
                  >
                    <PlayerFace player={q} team={activeTeam} state={state} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] mland:text-[9px] font-bold flex items-center gap-1 min-w-0">
                        <PositionBadge role={q.ro} size="2xs" />
                        {natMeta && (
                          <span className="text-[10px] mland:text-[8px] shrink-0" title={natMeta.country}>
                            {natMeta.flag}
                          </span>
                        )}
                        <span className="truncate">{q.n}</span>
                        {activeTeam.cap === q.n && (
                          <CaptainBadge team={activeTeam} state={state} size="xs" className="shrink-0" />
                        )}
                        {isFav && <span className="text-[9.5px] shrink-0">💖</span>}
                      </div>
                      <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] tabular flex items-center justify-between gap-1">
                        <span>
                          {isStarter ? 'ตัวจริง' : 'สำรอง'} · OVR <b className="text-[var(--ink)]">{q.ov}</b>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className={getWellbeingTierMeta(m, 'mental', false).txtCls}>🧠{m}</span>
                          <span className={getWellbeingTierMeta(p, 'phys', q.inj > 0).txtCls}>💪{p}</span>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-Column 2: Individual Talk Desk for Selected Coach or Player */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 mland:p-2 space-y-2.5 mland:space-y-1.5">
            {selectedParticipant.kind === 'coach' ? (
              /* ---------- COACH INDIVIDUAL TALK DESK (OWN OR RIVAL COACH) ---------- */
              <div className="space-y-2.5 mland:space-y-1.5">
                <div className="pb-2.5 mland:pb-1.5 border-b border-[var(--line)] flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlayerFace
                      player={{
                        n: activeCoach.name,
                        pos: 'MF',
                        ro: 'CM',
                        ov: 70,
                        age: 45,
                        pot: 70,
                        fit: 100,
                        inj: 0,
                        vis: activeCoach.vis
                      }}
                      team={activeTeam}
                      state={state}
                      size={44}
                      coachOutfit={activeCoach.outfit}
                      coachClubKit={activeTeam.kc[0]}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap text-sm mland:text-xs font-extrabold text-[var(--ink)]">
                        <span>{activeCoach.countryFlag}</span>
                        <span className="truncate">{activeCoach.name}</span>
                        <span className="text-[11px] mland:text-[9px] font-bold text-[var(--g)]">
                          · {activeCoach.isOwnCoach ? 'หัวหน้าผู้ฝึกสอนของเรา' : 'โค้ชคู่แข่ง'}
                        </span>
                      </div>
                      <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] tabular flex flex-wrap items-center gap-x-1.5">
                        <span>{activeTeam.name}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          สไตล์: <b className="text-[var(--ink)]">{activeCoach.style.icon} {activeCoach.style.name}</b>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          ระบบ <b className="text-[var(--ink)]">{activeTeam.form}</b> ({AR_T[activeTeam.tac]})
                        </span>
                      </div>
                      <div className="text-[10.5px] mland:text-[8px] text-[var(--mut)] tabular">
                        ปรัชญา: <b className="text-[var(--ink)]">{activeTeam.philosophy || activeCoach.style.shortDesc}</b>
                        {activeTeam.fm ? ` · ฟอร์มล่าสุด: ${activeTeam.fm.slice(-5)}` : ''}
                      </div>
                    </div>
                  </div>
                </div>

                {activeTeam.aiTalkNote && !activeCoach.isOwnCoach && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] text-[11px] mland:text-[8.5px] text-[var(--ink)]">
                    💬 ความเคลื่อนไหวล่าสุด: {activeTeam.aiTalkNote}
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                    <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[var(--g)]" />
                      <span>
                        {activeCoach.isOwnCoach
                          ? 'หัวข้อประชุมส่วนตัวกับโค้ชทีมเรา'
                          : `เลือกหัวข้อพูดคุยรายบุคคลกับโค้ชคู่แข่ง (${activeCoach.name})`}
                      </span>
                    </span>
                    <span className="text-[var(--mut)] tabular">
                      {activeCoach.isOwnCoach ? 'ทีมงานสโมสร' : activeCoach.countryName}
                    </span>
                  </div>

                  {activeCoach.isOwnCoach ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOwnCoachBriefing('staff')}
                        className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                      >
                        <div className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                          📋 เช็กความพร้อมทีมงานสตาฟฟ์
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                          ตรวจสรุปความเข้าใจแผน โควตาดูแล และระดับผู้ช่วยโค้ช
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOwnCoachBriefing('morale')}
                        className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                      >
                        <div className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                          🧠 สำรวจจิตใจลูกทีมในห้องประชุม
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                          เช็กว่ามีนักเตะคนไหนใจต่ำหรือควรเรียกคุยรายบุคคลต่อ
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRivalCoachTalk('respect')}
                        className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                            🤝 แลกเปลี่ยนมุมมองฟุตบอล
                          </span>
                          <span className="text-[10px] mland:text-[8px] font-semibold text-[var(--g)] tabular">
                            ชื่อเสียง +1
                          </span>
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                          สร้างมิตรภาพระหว่างกุนซือและแลกเปลี่ยนแนวทางทำทีม
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRivalCoachTalk('scout')}
                        className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                            🔎 สอบถามสถานะนักเตะในทีม
                          </span>
                          <span className="text-[10px] mland:text-[8px] font-semibold text-[var(--g)]">
                            ปลดล็อกข้อมูล
                          </span>
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                          สอบถามตัวหลักและนักเตะน่าจับตามองในห้องประชุมนี้
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRivalCoachTalk('tactical')}
                        className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                            ⚔️ วิเคราะห์แผน &amp; แท็กติก
                          </span>
                          <span className="text-[10px] mland:text-[8px] font-semibold text-[var(--mut)]">
                            คำแนะนำแก้เกม
                          </span>
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                          พูดคุยเชิงแท็กติกเพื่อหาจุดรับมือระบบ {activeTeam.form}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRivalCoachTalk('mindgame')}
                        className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-amber-500/70 hover:bg-amber-500/10 text-left cursor-pointer transition-all space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                            🔥 สงครามจิตวิทยาก่อนดวล
                          </span>
                          <span className="text-[10px] mland:text-[8px] font-semibold text-amber-600 dark:text-[var(--lamp)] tabular">
                            ขวัญทีม +1%
                          </span>
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                          ส่งสารกดดันโค้ชคู่แข่งและปลุกความมั่นใจให้ทีมของเรา
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : activePlayer ? (
              /* ---------- PLAYER INDIVIDUAL TALK DESK (OWN OR RIVAL PLAYER) ---------- */
              (() => {
                const q = activePlayer;
                const m = getPlayerMentalScore(q, null);
                const p = getPlayerPhysScore(q, null);
                const mMeta = getWellbeingTierMeta(m, 'mental', false);
                const pMeta = getWellbeingTierMeta(p, 'phys', q.inj > 0);
                const persId = resolvePersonalityId(q, null);
                const persDef = PLAYER_PERSONALITIES[persId] || PLAYER_PERSONALITIES[3];
                const persHint = getPersonalityCareHint(persId);
                const isFav = favNamesSet.has(q.n);
                const favBoost = isMyClubRoom ? getActiveFavBoost(q, me, null) : 0;
                const isCap = activeTeam.cap === q.n;
                const shirtNo = getShirtNo(activeTeam, q);
                const fitPct = Math.round(q.fit ?? 100);
                const natMeta =
                  getCountryMetaByCode(q.nat) ||
                  (activeTeam.tier >= 3 || activeTeam.foreign === 1
                    ? getForeignTeamCountryMeta(activeTeam.name)
                    : getCountryMetaByCode('TH'));
                const talkDone = q.careTalkMd === curTurn;
                const physDone = q.carePhysMd === curTurn;
                const stf = getStaffState(state);
                const medLv = state.med ?? 1;
                const physMin = 5 + Math.floor(medLv / 4) + (stf.physio ? 1 : 0);
                const physMax = physMin + 2;
                const shortlisted = !isMyClubRoom && isPlayerShortlisted(state, q.n, activeTeam.id);

                return (
                  <div className="space-y-2.5 mland:space-y-1.5">
                    {/* Player Header */}
                    <div className="pb-2.5 mland:pb-1.5 border-b border-[var(--line)] flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="shrink-0">
                          <PlayerFace player={q} team={activeTeam} state={state} size={40} />
                          <span className="block text-center text-[9px] font-extrabold text-[var(--mut)] tabular mt-0.5">
                            #{shirtNo}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap text-sm mland:text-xs font-extrabold">
                            <PositionBadge role={q.ro} size="xs" />
                            {natMeta && <span title={natMeta.country}>{natMeta.flag}</span>}
                            <span className="truncate">{q.n}</span>
                            {isCap && <CaptainBadge team={activeTeam} state={state} size="xs" />}
                            {isFav && (
                              <span className="text-[10.5px] font-extrabold text-rose-600 dark:text-rose-400">
                                · 💖 ลูกรัก{favBoost > 0 ? ` (+${favBoost})` : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular flex flex-wrap items-center gap-x-1.5">
                            <span>{activeTeam.name}</span>
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
                          <div className="text-[10.5px] mland:text-[8.5px] tabular flex items-center gap-3 pt-0.5">
                            <span>
                              🧠 จิตใจ <b className={mMeta.txtCls}>{m}/100</b>
                            </span>
                            <span>
                              💪 กาย <b className={pMeta.txtCls}>{p}/100</b>
                            </span>
                            {!isMyClubRoom && (
                              <span className="text-[var(--mut)]">
                                ค่าตัวประเมิน <b className="text-[var(--ink)]">{fmtMoney(vlu(q))}</b>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isMyClubRoom && (
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              let added = false;
                              onUpdateState((d) => {
                                added = toggleShortlistPlayer(d, q, {
                                  source: 'club',
                                  clubTeamId: activeTeam.id,
                                  clubName: activeTeam.name
                                });
                              });
                              onToast(
                                added
                                  ? `⭐ เพิ่ม ${q.n} เข้ารายชื่อที่สนใจแล้ว`
                                  : `นำ ${q.n} ออกจากรายชื่อที่สนใจแล้ว`
                              );
                            }}
                            className={`btn btn-xs whitespace-nowrap ${
                              shortlisted
                                ? 'bg-amber-400/20 border-amber-500/70 text-amber-600 dark:text-amber-300'
                                : 'btn-secondary'
                            }`}
                          >
                            <Star className={`w-3 h-3 ${shortlisted ? 'fill-amber-400' : ''}`} />
                            <span>{shortlisted ? 'ติดตามอยู่' : 'สนใจ'}</span>
                          </button>
                        )}
                        {onInspectPlayer && (
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              onInspectPlayer(q, activeTeam);
                            }}
                            className="btn btn-xs btn-secondary whitespace-nowrap"
                          >
                            โปรไฟล์ ↗
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Individual Talk Options */}
                    {isMyClubRoom ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                          <span className="font-bold text-[var(--ink)]">
                            💬 พูดคุยรายบุคคลกับนักเตะทีมเรา
                          </span>
                          <span className="text-[var(--mut)] tabular">
                            {talkDone
                              ? '✓ คุยรอบนี้แล้ว'
                              : careQuota.remaining <= 0
                                ? 'โควตาหมด'
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
                          className="w-full px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/35 hover:border-sky-500 flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-45 disabled:cursor-default transition-all"
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
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                          <span className="font-bold text-[var(--ink)]">
                            💬 พูดคุยรายบุคคลกับนักเตะทีมคู่แข่ง ({q.n})
                          </span>
                          <span className="text-[var(--mut)]">ไม่หักโควตาทีมเรา</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRivalPlayerTalk(q, 'praise')}
                            className="px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                                🤝 ทักทายชื่นชมฝีเท้า
                              </span>
                              <span className="text-[10px] mland:text-[8px] font-semibold text-[var(--g)]">
                                เผยบุคลิก
                              </span>
                            </div>
                            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                              สานสัมพันธ์และเรียนรู้ทัศนคติของนักเตะคนนี้
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRivalPlayerTalk(q, 'transfer')}
                            className="px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                                📋 สอบถามโอกาสย้ายทีม
                              </span>
                              <span className="text-[10px] mland:text-[8px] font-semibold text-[var(--g)]">
                                เช็กความสนใจ
                              </span>
                            </div>
                            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                              หยั่งเชิงว่าพร้อมย้ายมาเล่นให้ {me.name} หรือไม่
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRivalPlayerTalk(q, 'tactics')}
                            className="px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/35 text-left cursor-pointer transition-all space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                                🧭 แลกเปลี่ยนมุมมองแท็กติก
                              </span>
                              <span className="text-[10px] mland:text-[8px] font-semibold text-[var(--mut)]">
                                สเกาท์บทบาท
                              </span>
                            </div>
                            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                              พูดคุยสไตล์การยืนตำแหน่งและบทบาทถนัดในสนาม
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRivalPlayerTalk(q, 'banter')}
                            className="px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] hover:border-amber-500/70 hover:bg-amber-500/10 text-left cursor-pointer transition-all space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-bold text-xs mland:text-[9.5px] text-[var(--ink)]">
                                🔥 หยั่งเชิงจิตวิทยาก่อนเกม
                              </span>
                              <span className="text-[10px] mland:text-[8px] font-semibold text-amber-600 dark:text-[var(--lamp)]">
                                เช็กความนิ่ง
                              </span>
                            </div>
                            <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                              ทดสอบปฏิกิริยาและสภาพความมั่นใจของคู่แข่ง
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="p-6 text-center text-xs text-[var(--mut)]">
                คลิกเลือกผู้เล่นหรือโค้ชจากรายการในห้องนี้เพื่อเริ่มพูดคุยรายบุคคล
              </div>
            )}

            {/* Room Individual Conversation Transcript */}
            {activeTranscript.length > 0 ? (
              <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                <div className="text-[10.5px] mland:text-[8.5px] font-extrabold text-[var(--g)] flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>บันทึกการพูดคุยรายบุคคลในห้องประชุม</span>
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
                  เลือกหัวข้อด้านบนเพื่อเริ่มพูดคุยรายบุคคลกับ{' '}
                  <b className="text-[var(--ink)]">
                    {selectedParticipant.kind === 'coach'
                      ? activeCoach.name
                      : activePlayer?.n || 'สมาชิกในห้อง'}
                  </b>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
