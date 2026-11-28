import React, { useMemo, useState } from 'react';
import {
  Award,
  Crown,
  Flame,
  Gem,
  Search,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
  Zap
} from 'lucide-react';
import type { GameState, Player, Position, StatKey, Team } from '../types/game';
import { TN, CONFED_META, getCountryMetaByCode, getForeignTeamCountryMeta, type ForeignConfed } from '../data/thaiFootballData';
import { getT3ZoneLabel, getTeamBaseOvr, getTeamLeagueName, getWorldLeagueSpec } from '../data/leagueStructures';
import { SFX } from '../utils/audioTheme';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { DT, vlu, wagOf } from '../engine/playerCore';
import { getPlayerCupTotals } from '../engine/history';
import {
  fmtFansShort,
  getTeamStadiumCapacity,
  getTeamStadiumStyleSpec,
  teamStats
} from '../engine/simulation';
import { ClubCrest, PlayerFace } from './SvgVisuals';
import { DEFAULT_TIER_NAMES, getWorldLeagueDisplay } from '../engine/mods';
import { PositionBadge } from './PositionBadge';
import { MyTeamBadge } from './MyTeamBadge';
import { OvrBadge, getOvrTierStyle } from './OvrBadge';
import { WdlFormStrip } from './WdlBadge';

type EntityMode = 'clubs' | 'players';
type ScopeKey = 'all' | 'domestic' | 'my' | '0' | '1' | '2' | '3';

type ClubCategory = 'power' | 'value' | 'fans' | 'trophies' | 'season' | 'youth';
type ClubSubSort =
  | 'powerScore'
  | 'ovXi'
  | 'ovSq'
  | 'at'
  | 'df'
  | 'totalValue'
  | 'wage'
  | 'avgValue'
  | 'fans'
  | 'stadium'
  | 'prestige'
  | 'trophies'
  | 'ppg'
  | 'gd'
  | 'gf'
  | 'gaPerMatch'
  | 'avgPot'
  | 'youngest'
  | 'u21Count';

type PlayerCategory = 'ovr' | 'potential' | 'value' | 'attack' | 'rating' | 'defense' | 'attrs';
type PlayerSubSort =
  | 'ov'
  | 'pot'
  | 'gap'
  | 'value'
  | 'wage'
  | 'goals'
  | 'assists'
  | 'ga'
  | 'avgRating'
  | 'motm'
  | 'apps'
  | 'cleanSheets'
  | 'tkAttr'
  | 'gkSave'
  | 'sh'
  | 'ps'
  | 'dr'
  | 'tk'
  | 'ph';

const DEFAULT_CLUB_SUB: Record<ClubCategory, ClubSubSort> = {
  power: 'powerScore',
  value: 'totalValue',
  fans: 'fans',
  trophies: 'prestige',
  season: 'ppg',
  youth: 'avgPot'
};

const DEFAULT_PLAYER_SUB: Record<PlayerCategory, PlayerSubSort> = {
  ovr: 'ov',
  potential: 'pot',
  value: 'value',
  attack: 'ga',
  rating: 'avgRating',
  defense: 'cleanSheets',
  attrs: 'sh'
};

const readTeamFans = (t: Team): number => {
  if (typeof t.fans === 'number' && Number.isFinite(t.fans) && t.fans > 0) {
    return Math.round(t.fans);
  }
  const tierBase = [9500, 26000, 78000, 165000][t.tier ?? 0] ?? 24000;
  const ovAvg = t.sq?.length
    ? t.sq.slice(0, 11).reduce((sum, q) => sum + q.ov, 0) / Math.min(11, t.sq.length)
    : 60;
  const diffBonus = clamp((ovAvg - getTeamBaseOvr(t)) * 0.035, -0.32, 0.55);
  const seed = ((t.id + 1) * 7919) % 31;
  return Math.max(2500, Math.round(tierBase * (1 + diffBonus) + (seed - 15) * ((t.tier ?? 0) + 1) * 180));
};

const calcClubTrophyInfo = (t: Team) => {
  const list = t.trophies || [];
  let prestige = 0;
  let majorCount = 0;
  let latestSeason = 0;
  for (const tr of list) {
    if ((tr.season || 0) > latestSeason) latestSeason = tr.season || 0;
    if (tr.type === 'asia') {
      prestige += 12;
      majorCount++;
    } else if (tr.type === 'league') {
      if ((tr.tier ?? 0) >= 2) {
        prestige += 8;
        majorCount++;
      } else if ((tr.tier ?? 0) === 1) {
        prestige += 4;
      } else {
        prestige += 2;
      }
    } else if (tr.type === 'cup') {
      prestige += 6;
      majorCount++;
    } else if (tr.type === 'league_cup') {
      prestige += 4;
    } else if (tr.type === 'super_cup') {
      prestige += 3;
    } else if (tr.type === 'div_cup') {
      prestige += 2;
    } else {
      prestige += 1;
    }
  }
  return { total: list.length, prestige, majorCount, latestSeason };
};

const getTierShortLabel = (
  tier: number,
  teamName?: string,
  modLeagueName?: string,
  zone?: number,
  leagueCode?: string
): string => {
  if (modLeagueName) return modLeagueName;
  if (tier === 0 || tier === 1 || tier === 2) {
    const cur = TN[tier];
    if (cur && cur !== DEFAULT_TIER_NAMES[tier]) return cur;
    if (tier === 0) return `ไทยลีก 3 · ${zone === 1 ? 'กลาง-ใต้' : 'เหนือ-อีสาน'}`;
    return tier === 1 ? 'ไทยลีก 2' : 'ไทยลีก 1';
  }
  const spec = getWorldLeagueSpec(leagueCode);
  const meta = getForeignTeamCountryMeta(teamName, leagueCode);
  if (meta) {
    const moddedWorld = getWorldLeagueDisplay(meta.code, spec?.shortName || meta.country);
    return `${meta.flag} ${moddedWorld || spec?.shortName || meta.country}`;
  }
  return spec ? spec.shortName : '🌍 ต่างแดน';
};

interface ClubRowEntry {
  team: Team;
  st: ReturnType<typeof teamStats>;
  powerScore: number;
  totalValue: number;
  avgValue: number;
  wage: number;
  topPlayer: Player | null;
  fans: number;
  stadiumCap: number;
  stadiumName: string;
  trophyTotal: number;
  trophyPrestige: number;
  majorTrophies: number;
  latestTrophySeason: number;
  ppg: number;
  gd: number;
  winPct: number;
  gaPerMatch: number;
  avgPot: number;
  u21Count: number;
  topWonderkid: Player | null;
}

interface PlayerRowEntry {
  player: Player;
  team: Team;
  isMePlayer: boolean;
  isMyClub: boolean;
  pot: number;
  gap: number;
  value: number;
  wage: number;
  apps: number;
  goals: number;
  assists: number;
  ga: number;
  cleanSheets: number;
  motm: number;
  avgRating: number;
  leagueGoals: number;
  cupGoals: number;
  leagueAssists: number;
  cupAssists: number;
  attrs: Record<StatKey, number>;
  gkSave: number;
}

export const RankingHubView = React.memo<{
  state: GameState;
  onInspectTeam: (teamId: number) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
}>(({ state, onInspectTeam, onInspectPlayer }) => {
  const me = state.teams[state.me];
  const hasAsiaTeams = useMemo(() => state.teams.some((t) => t.tier === 3), [state.teams]);

  const [entity, setEntity] = useState<EntityMode>('clubs');
  const [scope, setScope] = useState<ScopeKey>('domestic');
  const [confedFilter, setConfedFilter] = useState<'all' | ForeignConfed>('all');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  const [clubCat, setClubCat] = useState<ClubCategory>('power');
  const [clubSub, setClubSub] = useState<ClubSubSort>('powerScore');

  const [playerCat, setPlayerCat] = useState<PlayerCategory>('ovr');
  const [playerSub, setPlayerSub] = useState<PlayerSubSort>('ov');
  const [posFilter, setPosFilter] = useState<'ALL' | Position>('ALL');
  const [u21Only, setU21Only] = useState(false);
  const [myClubOnly, setMyClubOnly] = useState(false);
  const [playerLimit, setPlayerLimit] = useState(60);

  const worldCountries = useMemo(() => {
    const map = new Map<string, { code: string; flag: string; country: string; confed: ForeignConfed; count: number }>();
    state.teams.forEach((t) => {
      if (t.tier < 3) return;
      const meta = getForeignTeamCountryMeta(t.name, t.leagueCode);
      if (!meta) return;
      const prev = map.get(meta.code);
      if (prev) prev.count += 1;
      else map.set(meta.code, { code: meta.code, flag: meta.flag, country: meta.country, confed: meta.confed, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => a.country.localeCompare(b.country, 'th'));
  }, [state.teams]);

  const scopedTeams = useMemo(() => {
    const myZone = me.tier === 0 ? (me.zone ?? 0) : undefined;
    return state.teams.filter((t) => {
      if (scope === 'domestic' && t.tier >= 3) return false;
      if (scope === 'my') {
        if (me.tier >= 3) {
          if (t.tier < 3) return false;
          if (me.leagueCode && t.leagueCode !== me.leagueCode) return false;
          return true;
        }
        if (t.tier !== me.tier || (me.tier === 0 && (t.zone ?? 0) !== myZone)) return false;
      }
      if (scope !== 'all' && scope !== 'domestic' && scope !== 'my' && t.tier !== Number(scope)) return false;
      if (scope === '3' || scope === 'all') {
        if (confedFilter !== 'all' || countryFilter !== 'ALL') {
          if (t.tier < 3) return false;
          const meta = getForeignTeamCountryMeta(t.name, t.leagueCode);
          if (confedFilter !== 'all' && (meta?.confed || 'asia') !== confedFilter) return false;
          if (countryFilter !== 'ALL' && meta?.code !== countryFilter) return false;
        }
      }
      return true;
    });
  }, [state.teams, scope, me.tier, me.zone, me.leagueCode, confedFilter, countryFilter]);

  const clubRows = useMemo<ClubRowEntry[]>(() => {
    return scopedTeams.map((team) => {
      const st = teamStats(team, state);
      const powerScore = Math.round((st.ovXi * 0.45 + st.at * 0.25 + st.df * 0.2 + st.ovSq * 0.1) * 10) / 10;
      let totalValue = 0;
      let wageSum = 0;
      let potSum = 0;
      let u21Count = 0;
      let topPlayer: Player | null = null;
      let topWonderkid: Player | null = null;

      for (const q of team.sq) {
        const val = Math.max(vlu(q), q.price || 0);
        totalValue += val;
        const w = q.con?.wg ?? wagOf(q);
        wageSum += w * (q.con && q.con.yr <= 0 ? 1.25 : 1);
        const pPot = Math.max(q.ov, q.pot || q.ov);
        potSum += pPot;
        if (!topPlayer || q.ov > topPlayer.ov) topPlayer = q;
        if ((q.age || 24) <= 21) {
          u21Count++;
          if (!topWonderkid || pPot > (topWonderkid.pot || topWonderkid.ov) || (pPot === (topWonderkid.pot || topWonderkid.ov) && q.ov > topWonderkid.ov)) {
            topWonderkid = q;
          }
        }
      }

      const sqLen = Math.max(1, team.sq.length);
      const avgValue = Math.round(totalValue / sqLen);
      const wage = Math.round(wageSum);
      const fans = readTeamFans(team);
      const stadiumCap = getTeamStadiumCapacity(team, state);
      const stSpec = getTeamStadiumStyleSpec(team, state);
      const trInfo = calcClubTrophyInfo(team);
      const ppg = team.p > 0 ? Math.round((team.pts / team.p) * 100) / 100 : 0;
      const gd = team.gf - team.ga;
      const winPct = team.p > 0 ? Math.round((team.w / team.p) * 100) : 0;
      const gaPerMatch = team.p > 0 ? Math.round((team.ga / team.p) * 100) / 100 : 999;
      const avgPot = Math.round((potSum / sqLen) * 10) / 10;

      return {
        team,
        st,
        powerScore,
        totalValue,
        avgValue,
        wage,
        topPlayer,
        fans,
        stadiumCap,
        stadiumName: stSpec.shortName || stSpec.name,
        trophyTotal: trInfo.total,
        trophyPrestige: trInfo.prestige,
        majorTrophies: trInfo.majorCount,
        latestTrophySeason: trInfo.latestSeason,
        ppg,
        gd,
        winPct,
        gaPerMatch,
        avgPot,
        u21Count,
        topWonderkid
      };
    });
  }, [scopedTeams, state]);

  const clubSortedAll = useMemo(() => {
    const arr = [...clubRows];
    arr.sort((a, b) => {
      switch (clubSub) {
        case 'powerScore':
          return b.powerScore - a.powerScore || b.st.ovXi - a.st.ovXi;
        case 'ovXi':
          return b.st.ovXi - a.st.ovXi || b.powerScore - a.powerScore;
        case 'ovSq':
          return b.st.ovSq - a.st.ovSq || b.st.ovXi - a.st.ovXi;
        case 'at':
          return b.st.at - a.st.at || b.st.ovXi - a.st.ovXi;
        case 'df':
          return b.st.df - a.st.df || b.st.ovXi - a.st.ovXi;
        case 'totalValue':
          return b.totalValue - a.totalValue || b.st.ovXi - a.st.ovXi;
        case 'wage':
          return b.wage - a.wage || b.totalValue - a.totalValue;
        case 'avgValue':
          return b.avgValue - a.avgValue || b.totalValue - a.totalValue;
        case 'fans':
          return b.fans - a.fans || b.stadiumCap - a.stadiumCap;
        case 'stadium':
          return b.stadiumCap - a.stadiumCap || b.fans - a.fans;
        case 'prestige':
          return b.trophyPrestige - a.trophyPrestige || b.trophyTotal - a.trophyTotal || b.team.tier - a.team.tier || b.powerScore - a.powerScore;
        case 'trophies':
          return b.trophyTotal - a.trophyTotal || b.trophyPrestige - a.trophyPrestige || b.powerScore - a.powerScore;
        case 'ppg':
          return b.ppg - a.ppg || b.gd - a.gd || b.team.pts - a.team.pts || b.powerScore - a.powerScore;
        case 'gd':
          return b.gd - a.gd || b.team.gf - a.team.gf || b.ppg - a.ppg;
        case 'gf':
          return b.team.gf - a.team.gf || b.gd - a.gd || b.st.at - a.st.at;
        case 'gaPerMatch':
          if ((a.team.p > 0) !== (b.team.p > 0)) return a.team.p > 0 ? -1 : 1;
          return a.gaPerMatch - b.gaPerMatch || a.team.ga - b.team.ga || b.st.df - a.st.df;
        case 'avgPot':
          return b.avgPot - a.avgPot || b.u21Count - a.u21Count || b.powerScore - a.powerScore;
        case 'youngest':
          return a.st.age - b.st.age || b.avgPot - a.avgPot;
        case 'u21Count':
          return b.u21Count - a.u21Count || b.avgPot - a.avgPot;
      }
    });
    return arr;
  }, [clubRows, clubSub]);

  const clubFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubSortedAll
      .map((entry, idx) => ({ entry, rank: idx + 1 }))
      .filter(({ entry }) => {
        if (!q) return true;
        const meta = entry.team.tier >= 3 ? getForeignTeamCountryMeta(entry.team.name, entry.team.leagueCode) : null;
        const wlSpec = entry.team.tier >= 3 ? getWorldLeagueSpec(entry.team.leagueCode) : null;
        return (
          entry.team.name.toLowerCase().includes(q) ||
          getTeamLeagueName(entry.team, { includeZone: true }).toLowerCase().includes(q) ||
          (meta?.country || '').toLowerCase().includes(q) ||
          (wlSpec?.name || '').toLowerCase().includes(q)
        );
      });
  }, [clubSortedAll, query]);

  const playerRows = useMemo<PlayerRowEntry[]>(() => {
    if (entity !== 'players') return [];
    const list: PlayerRowEntry[] = [];
    const cp = state.p;
    for (const team of scopedTeams) {
      const isMyClub = team.id === state.me;
      for (const player of team.sq) {
        const cupTot = getPlayerCupTotals(player);
        const apps = (player.sp || 0) + cupTot.sp;
        const leagueGoals = player.sg || 0;
        const cupGoals = cupTot.sg;
        const goals = leagueGoals + cupGoals;
        const leagueAssists = player.sa || 0;
        const cupAssists = cupTot.sa;
        const assists = leagueAssists + cupAssists;
        const ga = goals + assists;
        const cleanSheets = (player.cs || 0) + cupTot.cs;
        const motm = (player.motm || 0) + cupTot.motm;
        const totalSrs = (player.srs || 0) + cupTot.srs;
        const totalSra = (player.sra || 0) + cupTot.sra;
        const avgRating = totalSra > 0 ? Math.round((totalSrs / totalSra) * 100) / 100 : 0;
        const pot = Math.max(player.ov, player.pot || player.ov);
        const gap = Math.max(0, pot - player.ov);
        const value = Math.max(vlu(player), player.price || 0);
        const wage = player.con?.wg ?? wagOf(player);
        const dt = DT(player, cp);
        const gkSave = player.pos === 'GK' ? Math.round((dt.d.sv * 0.5 + (dt.d.rfx ?? dt.d.sv) * 0.25 + (dt.d.hnd ?? dt.d.sv) * 0.25)) : 0;
        list.push({
          player,
          team,
          isMePlayer: Boolean(player.me),
          isMyClub,
          pot,
          gap,
          value,
          wage,
          apps,
          goals,
          assists,
          ga,
          cleanSheets,
          motm,
          avgRating,
          leagueGoals,
          cupGoals,
          leagueAssists,
          cupAssists,
          attrs: dt.a,
          gkSave
        });
      }
    }
    return list;
  }, [entity, scopedTeams, state.me, state.p]);

  const playerRankedFiltered = useMemo(() => {
    if (entity !== 'players') return [];
    const q = query.trim().toLowerCase();
    const base = playerRows.filter((row) => {
      if (posFilter !== 'ALL' && row.player.pos !== posFilter) return false;
      if (u21Only && (row.player.age || 24) > 21) return false;
      if (myClubOnly && !row.isMyClub) return false;
      if (playerSub === 'gkSave' && row.player.pos !== 'GK') return false;
      if (playerSub === 'cleanSheets' && row.player.pos !== 'GK' && row.player.pos !== 'DF') return false;
      return true;
    });

    base.sort((a, b) => {
      switch (playerSub) {
        case 'ov':
          return b.player.ov - a.player.ov || b.pot - a.pot || a.player.age - b.player.age;
        case 'pot':
          return b.pot - a.pot || b.gap - a.gap || b.player.ov - a.player.ov || a.player.age - b.player.age;
        case 'gap':
          return b.gap - a.gap || b.pot - a.pot || a.player.age - b.player.age;
        case 'value':
          return b.value - a.value || b.player.ov - a.player.ov || b.pot - a.pot;
        case 'wage':
          return b.wage - a.wage || b.value - a.value;
        case 'goals':
          return b.goals - a.goals || b.ga - a.ga || b.player.ov - a.player.ov;
        case 'assists':
          return b.assists - a.assists || b.ga - a.ga || b.player.ov - a.player.ov;
        case 'ga':
          return b.ga - a.ga || b.goals - a.goals || b.player.ov - a.player.ov;
        case 'avgRating':
          if ((a.apps > 0) !== (b.apps > 0)) return a.apps > 0 ? -1 : 1;
          return b.avgRating - a.avgRating || b.motm - a.motm || b.apps - a.apps || b.player.ov - a.player.ov;
        case 'motm':
          return b.motm - a.motm || b.avgRating - a.avgRating || b.ga - a.ga || b.player.ov - a.player.ov;
        case 'apps':
          return b.apps - a.apps || b.avgRating - a.avgRating || b.player.ov - a.player.ov;
        case 'cleanSheets':
          return b.cleanSheets - a.cleanSheets || b.apps - a.apps || b.player.ov - a.player.ov;
        case 'tkAttr':
          return b.attrs.tk - a.attrs.tk || b.player.ov - a.player.ov;
        case 'gkSave':
          return b.gkSave - a.gkSave || b.cleanSheets - a.cleanSheets || b.player.ov - a.player.ov;
        case 'sh':
          return b.attrs.sh - a.attrs.sh || b.player.ov - a.player.ov;
        case 'ps':
          return b.attrs.ps - a.attrs.ps || b.player.ov - a.player.ov;
        case 'dr':
          return b.attrs.dr - a.attrs.dr || b.player.ov - a.player.ov;
        case 'tk':
          return b.attrs.tk - a.attrs.tk || b.player.ov - a.player.ov;
        case 'ph':
          return b.attrs.ph - a.attrs.ph || b.player.ov - a.player.ov;
      }
    });

    return base
      .map((entry, idx) => ({ entry, rank: idx + 1 }))
      .filter(({ entry }) => {
        if (!q) return true;
        const natMeta = getCountryMetaByCode(entry.player.nat);
        const clubMeta = entry.team.tier >= 3 ? getForeignTeamCountryMeta(entry.team.name) : null;
        return (
          entry.player.n.toLowerCase().includes(q) ||
          entry.team.name.toLowerCase().includes(q) ||
          (entry.player.ro || '').toLowerCase().includes(q) ||
          (natMeta?.country || '').toLowerCase().includes(q) ||
          (clubMeta?.country || '').toLowerCase().includes(q)
        );
      });
  }, [entity, playerRows, posFilter, u21Only, myClubOnly, playerSub, query]);

  const getClubPrimaryMetric = (e: ClubRowEntry): { raw: number; display: string; unit: string } => {
    switch (clubSub) {
      case 'powerScore':
        return { raw: e.powerScore, display: e.powerScore.toFixed(1), unit: 'คะแนนพลัง' };
      case 'ovXi':
        return { raw: e.st.ovXi, display: String(e.st.ovXi), unit: 'OVR ตัวจริง' };
      case 'ovSq':
        return { raw: e.st.ovSq, display: String(e.st.ovSq), unit: 'OVR เฉลี่ย' };
      case 'at':
        return { raw: e.st.at, display: String(e.st.at), unit: 'พลังเกมรุก' };
      case 'df':
        return { raw: e.st.df, display: String(e.st.df), unit: 'พลังเกมรับ' };
      case 'totalValue':
        return { raw: e.totalValue, display: fmtMoneyNum(e.totalValue), unit: 'มูลค่าทีม' };
      case 'wage':
        return { raw: e.wage, display: fmtMoneyNum(e.wage), unit: 'ค่าเหนื่อย/นัด' };
      case 'avgValue':
        return { raw: e.avgValue, display: fmtMoneyNum(e.avgValue), unit: 'เฉลี่ย/คน' };
      case 'fans':
        return { raw: e.fans, display: fmtFansShort(e.fans), unit: 'แฟนบอล' };
      case 'stadium':
        return { raw: e.stadiumCap, display: e.stadiumCap.toLocaleString('en-US'), unit: 'ความจุที่นั่ง' };
      case 'prestige':
        return { raw: e.trophyPrestige, display: `${e.trophyPrestige} แต้ม`, unit: 'เกียรติยศ' };
      case 'trophies':
        return { raw: e.trophyTotal, display: `${e.trophyTotal} ถ้วย`, unit: 'แชมป์รวม' };
      case 'ppg':
        return { raw: e.ppg, display: e.team.p > 0 ? e.ppg.toFixed(2) : '—', unit: 'แต้ม/นัด' };
      case 'gd':
        return { raw: e.gd, display: e.gd > 0 ? `+${e.gd}` : String(e.gd), unit: 'ผลต่างประตู' };
      case 'gf':
        return { raw: e.team.gf, display: String(e.team.gf), unit: 'ประตูที่ยิง' };
      case 'gaPerMatch':
        return {
          raw: e.team.p > 0 ? e.gaPerMatch : 0,
          display: e.team.p > 0 ? `${e.gaPerMatch.toFixed(2)}` : '—',
          unit: 'เสีย/นัด'
        };
      case 'avgPot':
        return { raw: e.avgPot, display: e.avgPot.toFixed(1), unit: 'POT เฉลี่ย' };
      case 'youngest':
        return { raw: e.st.age, display: `${e.st.age.toFixed(1)} ปี`, unit: 'อายุเฉลี่ย' };
      case 'u21Count':
        return { raw: e.u21Count, display: `${e.u21Count} คน`, unit: 'แข้ง ≤21 ปี' };
    }
  };

  const getPlayerPrimaryMetric = (e: PlayerRowEntry): { raw: number; display: string; unit: string } => {
    switch (playerSub) {
      case 'ov':
        return { raw: e.player.ov, display: String(e.player.ov), unit: 'OVR' };
      case 'pot':
        return { raw: e.pot, display: String(e.pot), unit: 'POT' };
      case 'gap':
        return { raw: e.gap, display: `+${e.gap}`, unit: 'พัฒนาได้อีก' };
      case 'value':
        return { raw: e.value, display: fmtMoneyNum(e.value), unit: 'มูลค่าตลาด' };
      case 'wage':
        return { raw: e.wage, display: fmtMoneyNum(e.wage), unit: 'ค่าเหนื่อย/นัด' };
      case 'goals':
        return { raw: e.goals, display: `${e.goals}`, unit: 'ประตู' };
      case 'assists':
        return { raw: e.assists, display: `${e.assists}`, unit: 'แอสซิสต์' };
      case 'ga':
        return { raw: e.ga, display: `${e.ga}`, unit: 'G+A' };
      case 'avgRating':
        return { raw: e.avgRating, display: e.avgRating > 0 ? e.avgRating.toFixed(2) : '—', unit: 'เรตติ้ง' };
      case 'motm':
        return { raw: e.motm, display: `${e.motm}`, unit: 'MOTM' };
      case 'apps':
        return { raw: e.apps, display: `${e.apps}`, unit: 'นัด' };
      case 'cleanSheets':
        return { raw: e.cleanSheets, display: `${e.cleanSheets}`, unit: 'คลีนชีต' };
      case 'tkAttr':
        return { raw: e.attrs.tk, display: `${e.attrs.tk}`, unit: 'แย่งบอล' };
      case 'gkSave':
        return { raw: e.gkSave, display: `${e.gkSave}`, unit: 'คะแนนเซฟ' };
      case 'sh':
        return { raw: e.attrs.sh, display: `${e.attrs.sh}`, unit: 'ยิงประตู' };
      case 'ps':
        return { raw: e.attrs.ps, display: `${e.attrs.ps}`, unit: 'จ่ายบอล' };
      case 'dr':
        return { raw: e.attrs.dr, display: `${e.attrs.dr}`, unit: 'เลี้ยงบอล' };
      case 'tk':
        return { raw: e.attrs.tk, display: `${e.attrs.tk}`, unit: 'แย่งบอล' };
      case 'ph':
        return { raw: e.attrs.ph, display: `${e.attrs.ph}`, unit: 'กายภาพ' };
    }
  };

  const clubCats: { id: ClubCategory; icon: React.ReactNode; label: string }[] = [
    { id: 'power', icon: <Zap className="w-3.5 h-3.5" />, label: 'พลังทีม' },
    { id: 'value', icon: <Gem className="w-3.5 h-3.5" />, label: 'มูลค่า & งบ' },
    { id: 'fans', icon: <Users className="w-3.5 h-3.5" />, label: 'แฟนบอล & สนาม' },
    { id: 'trophies', icon: <Trophy className="w-3.5 h-3.5" />, label: 'เกียรติยศ' },
    { id: 'season', icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'ผลงานซีซั่นนี้' },
    { id: 'youth', icon: <Sparkles className="w-3.5 h-3.5" />, label: 'เยาวชน & แฝง' }
  ];

  const clubSubOptions: Record<ClubCategory, { id: ClubSubSort; label: string }[]> = {
    power: [
      { id: 'powerScore', label: 'ดัชนีพลังรวม' },
      { id: 'ovXi', label: '11 ตัวจริง' },
      { id: 'ovSq', label: 'เฉลี่ยทั้งทีม' },
      { id: 'at', label: 'พลังเกมรุก' },
      { id: 'df', label: 'พลังเกมรับ' }
    ],
    value: [
      { id: 'totalValue', label: 'มูลค่ารวมสโมสร' },
      { id: 'wage', label: 'ค่าเหนื่อยรวม' },
      { id: 'avgValue', label: 'มูลค่าเฉลี่ย/คน' }
    ],
    fans: [
      { id: 'fans', label: 'ฐานแฟนบอล' },
      { id: 'stadium', label: 'ความจุสนามเหย้า' }
    ],
    trophies: [
      { id: 'prestige', label: 'คะแนนเกียรติยศ' },
      { id: 'trophies', label: 'จำนวนถ้วยรวม' }
    ],
    season: [
      { id: 'ppg', label: 'แต้มเฉลี่ย/นัด' },
      { id: 'gd', label: 'ผลต่างประตู (+/-)' },
      { id: 'gf', label: 'ยิงประตูสูงสุด' },
      { id: 'gaPerMatch', label: 'เสียประตูน้อยสุด' }
    ],
    youth: [
      { id: 'avgPot', label: 'พลังแฝงเฉลี่ย (POT)' },
      { id: 'youngest', label: 'ทีมอายุน้อยสุด' },
      { id: 'u21Count', label: 'จำนวนดาวรุ่ง (≤21)' }
    ]
  };

  const playerCats: { id: PlayerCategory; icon: React.ReactNode; label: string }[] = [
    { id: 'ovr', icon: <Crown className="w-3.5 h-3.5" />, label: 'พลังรวม OVR' },
    { id: 'potential', icon: <Sparkles className="w-3.5 h-3.5" />, label: 'ดาวรุ่ง & POT' },
    { id: 'value', icon: <Gem className="w-3.5 h-3.5" />, label: 'มูลค่าตลาด' },
    { id: 'attack', icon: <Flame className="w-3.5 h-3.5" />, label: 'ยิง & จ่าย' },
    { id: 'rating', icon: <Award className="w-3.5 h-3.5" />, label: 'เรตติ้ง & ฟอร์ม' },
    { id: 'defense', icon: <Shield className="w-3.5 h-3.5" />, label: 'คลีนชีต & รับ' },
    { id: 'attrs', icon: <Target className="w-3.5 h-3.5" />, label: 'ทักษะเฉพาะทาง' }
  ];

  const playerSubOptions: Record<PlayerCategory, { id: PlayerSubSort; label: string }[]> = {
    ovr: [{ id: 'ov', label: 'พลังรวม (OVR)' }],
    potential: [
      { id: 'pot', label: 'พลังแฝงสูงสุด (POT)' },
      { id: 'gap', label: 'ช่องว่างพัฒนา (+POT)' }
    ],
    value: [
      { id: 'value', label: 'ค่าตัวประเมินสูงสุด' },
      { id: 'wage', label: 'ค่าเหนื่อยสูงสุด' }
    ],
    attack: [
      { id: 'ga', label: 'มีส่วนร่วมประตู (G+A)' },
      { id: 'goals', label: 'ยิงประตูรวม' },
      { id: 'assists', label: 'แอสซิสต์รวม' }
    ],
    rating: [
      { id: 'avgRating', label: 'เรตติ้งเฉลี่ยสูงสุด' },
      { id: 'motm', label: 'แมนออฟเดอะแมตช์' },
      { id: 'apps', label: 'ลงสนามมากสุด' }
    ],
    defense: [
      { id: 'cleanSheets', label: 'คลีนชีตรวม' },
      { id: 'tkAttr', label: 'พลังแย่งบอล (TK)' },
      { id: 'gkSave', label: 'ฝีมือเซฟประตู (GK)' }
    ],
    attrs: [
      { id: 'sh', label: 'ยิง (SH)' },
      { id: 'ps', label: 'จ่าย (PS)' },
      { id: 'dr', label: 'เลี้ยง (DR)' },
      { id: 'tk', label: 'แย่ง (TK)' },
      { id: 'ph', label: 'กายภาพ (PH)' }
    ]
  };

  const myClubBench = useMemo(() => {
    const idx = clubSortedAll.findIndex((x) => x.team.id === state.me);
    if (idx < 0) return null;
    const entry = clubSortedAll[idx];
    return { rank: idx + 1, total: clubSortedAll.length, entry, metric: getClubPrimaryMetric(entry) };
  }, [clubSortedAll, state.me, clubSub]);

  const topClubEntry = clubSortedAll[0] || null;
  const clubGroupAvg = useMemo(() => {
    if (!clubSortedAll.length) return '—';
    const valid = clubSortedAll.filter((e) => !(clubSub === 'gaPerMatch' && e.team.p === 0));
    if (!valid.length) return '—';
    const sum = valid.reduce((acc, e) => acc + getClubPrimaryMetric(e).raw, 0);
    const avg = sum / valid.length;
    if (clubSub === 'totalValue' || clubSub === 'wage' || clubSub === 'avgValue') return fmtMoneyNum(Math.round(avg));
    if (clubSub === 'fans') return fmtFansShort(avg);
    if (clubSub === 'stadium') return Math.round(avg).toLocaleString('en-US');
    if (clubSub === 'powerScore' || clubSub === 'ppg' || clubSub === 'gaPerMatch' || clubSub === 'avgPot' || clubSub === 'youngest') {
      return avg.toFixed(1);
    }
    return String(Math.round(avg));
  }, [clubSortedAll, clubSub]);

  const myPlayerBench = useMemo(() => {
    if (entity !== 'players') return null;
    // In Player mode highlight the user's career player; in Manager mode highlight the best player in my club in this ranking
    const idx =
      state.mode === 'p'
        ? playerRankedFiltered.findIndex((x) => x.entry.isMePlayer)
        : playerRankedFiltered.findIndex((x) => x.entry.isMyClub);
    if (idx < 0) return null;
    const item = playerRankedFiltered[idx];
    return { rank: item.rank, total: playerRankedFiltered.length, entry: item.entry, metric: getPlayerPrimaryMetric(item.entry) };
  }, [entity, playerRankedFiltered, state.mode, playerSub]);

  const topPlayerItem = playerRankedFiltered[0] || null;
  const playerGroupAvg = useMemo(() => {
    if (entity !== 'players' || !playerRankedFiltered.length) return '—';
    const valid = playerRankedFiltered.filter(({ entry }) => !(playerSub === 'avgRating' && entry.apps === 0));
    if (!valid.length) return '—';
    const sum = valid.reduce((acc, { entry }) => acc + getPlayerPrimaryMetric(entry).raw, 0);
    const avg = sum / valid.length;
    if (playerSub === 'value' || playerSub === 'wage') return fmtMoneyNum(Math.round(avg));
    if (playerSub === 'avgRating') return avg.toFixed(2);
    return avg.toFixed(1);
  }, [entity, playerRankedFiltered, playerSub]);

  const scopeLabel = useMemo(() => {
    if (scope === 'all') return `ทั้งหมด (${scopedTeams.length} ทีม)`;
    if (scope === 'domestic') return `ไทยลีก 1-3 (${scopedTeams.length} ทีม)`;
    if (scope === 'my') return `${getTeamLeagueName(me, { includeZone: true, withFlag: true })} (${scopedTeams.length} ทีม)`;
    if (scope === '3') return `สโมสรนานาชาติ (${scopedTeams.length} ทีม)`;
    return `${TN[Number(scope)] || 'ลีก'} (${scopedTeams.length} ทีม)`;
  }, [scope, scopedTeams.length, me]);

  const clubMinMax = useMemo(() => {
    if (!clubSortedAll.length) return { min: 0, max: 1 };
    const vals = clubSortedAll.map((e) => getClubPrimaryMetric(e).raw).filter((v) => Number.isFinite(v) && v < 990);
    if (!vals.length) return { min: 0, max: 1 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [clubSortedAll, clubSub]);

  const visiblePlayers = useMemo(
    () => playerRankedFiltered.slice(0, playerLimit),
    [playerRankedFiltered, playerLimit]
  );

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-5 mland:w-5 mland:h-4 rounded-md bg-amber-500/20 text-[#9a6700] dark:text-[var(--lamp)] border border-amber-500/45 font-display font-black text-[11px] mland:text-[9.5px] tabular shrink-0">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-5 mland:w-5 mland:h-4 rounded-md bg-slate-400/20 text-slate-600 dark:text-slate-300 border border-slate-400/40 font-display font-black text-[11px] mland:text-[9.5px] tabular shrink-0">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-5 mland:w-5 mland:h-4 rounded-md bg-orange-500/18 text-orange-700 dark:text-orange-300 border border-orange-500/35 font-display font-black text-[11px] mland:text-[9.5px] tabular shrink-0">
          3
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-6 mland:w-5 text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] tabular shrink-0">
        {rank}
      </span>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Unified Ranking Control Toolbar */}
      <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs shrink-0 space-y-2 mland:space-y-1">
        {/* Row 1: Entity Mode + Scope + Search */}
        <div className="flex flex-wrap items-center justify-between gap-2 mland:gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <div className="seg-bar shrink-0">
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setEntity('clubs');
                }}
                className={`seg-btn ${entity === 'clubs' ? 'seg-btn-active' : ''}`}
              >
                <span>🏟️</span>
                <span>อันดับสโมสร</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setEntity('players');
                  setPlayerLimit(60);
                }}
                className={`seg-btn ${entity === 'players' ? 'seg-btn-active' : ''}`}
              >
                <span>⚽</span>
                <span>อันดับนักเตะ</span>
              </button>
            </div>

            <div className="seg-bar shrink-0 overflow-x-auto max-w-full">
              {(
                [
                  ['domestic', `ในประเทศ (${state.teams.filter((t) => t.tier < 3).length})`],
                  ['my', `ลีกฉัน`],
                  ['2', 'ไทยลีก 1'],
                  ['1', 'ไทยลีก 2'],
                  ['0', 'ไทยลีก 3'],
                  ...(hasAsiaTeams ? ([['3', '33 ลีกโลก'], ['all', 'ทั้งหมด']] as const) : [])
                ] as readonly [ScopeKey, string][]
              ).map(([sk, lbl]) => (
                <button
                  key={sk}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setScope(sk);
                    if (sk !== '3' && sk !== 'all') {
                      setConfedFilter('all');
                      setCountryFilter('ALL');
                    }
                    setPlayerLimit(60);
                  }}
                  className={`seg-btn ${scope === sk ? 'bg-[var(--ink)] text-[var(--bg)] hover:text-[var(--bg)] shadow-xs' : ''}`}
                >
                  <span>{lbl}</span>
                  {sk === 'my' && <MyTeamBadge size="2xs" />}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex items-center min-w-[165px] sm:min-w-[205px] flex-1 sm:flex-initial max-w-xs">
            <Search className="w-3.5 h-3.5 text-[var(--mut)] absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={entity === 'clubs' ? 'ค้นหาชื่อสโมสร หรือ ประเทศ...' : 'ค้นหานักเตะ, สโมสร, สัญชาติ...'}
              className="w-full h-7.5 mland:h-6.5 pl-8 pr-7 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)] focus:border-[var(--g)] focus:outline-none text-[11px] mland:text-[9.5px] text-[var(--ink)] placeholder:text-[var(--mut)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="ล้างคำค้นหา"
                className="absolute right-1.5 p-0.5 rounded-md text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* World Region & Country Filters when viewing Foreign or All clubs */}
        {hasAsiaTeams && (scope === '3' || scope === 'all') && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 border-t border-[var(--line)]/50">
            <div className="seg-bar overflow-x-auto max-w-full">
              {(
                [
                  ['all', '🌐 ทุกทวีป'],
                  ['asia', `${CONFED_META.asia.icon} ${CONFED_META.asia.short}`],
                  ['europe', `${CONFED_META.europe.icon} ${CONFED_META.europe.short}`],
                  ['americas', `${CONFED_META.americas.icon} ${CONFED_META.americas.short}`],
                  ['africa', `${CONFED_META.africa.icon} ${CONFED_META.africa.short}`]
                ] as const
              ).map(([cid, clbl]) => (
                <button
                  key={cid}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setConfedFilter(cid);
                    setCountryFilter('ALL');
                    setPlayerLimit(60);
                  }}
                  className={`seg-btn py-1 mland:py-0.5 px-2 text-[10.5px] mland:text-[8.5px] whitespace-nowrap ${
                    confedFilter === cid ? 'seg-btn-active' : ''
                  }`}
                >
                  {clbl}
                </button>
              ))}
            </div>

            <select
              aria-label="กรองตามประเทศ"
              value={countryFilter}
              onChange={(e) => {
                SFX.tap();
                setCountryFilter(e.target.value);
                setPlayerLimit(60);
              }}
              className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)] text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[var(--g)]"
            >
              <option value="ALL">ทุกประเทศต่างแดน ({worldCountries.length})</option>
              {worldCountries
                .filter((c) => confedFilter === 'all' || c.confed === confedFilter)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.country} ({c.count})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Row 2: Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 mland:gap-1.5">
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
            {entity === 'clubs'
              ? clubCats.map((cat) => {
                  const active = clubCat === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setClubCat(cat.id);
                        setClubSub(DEFAULT_CLUB_SUB[cat.id]);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-xl mland:rounded-lg border text-[11px] mland:text-[9.5px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-2xs'
                          : 'bg-[var(--surface-2)]/65 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--g)]/50'
                      }`}
                    >
                      {cat.icon}
                      <span>{cat.label}</span>
                    </button>
                  );
                })
              : playerCats.map((cat) => {
                  const active = playerCat === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setPlayerCat(cat.id);
                        setPlayerSub(DEFAULT_PLAYER_SUB[cat.id]);
                        setPlayerLimit(60);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-xl mland:rounded-lg border text-[11px] mland:text-[9.5px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-2xs'
                          : 'bg-[var(--surface-2)]/65 text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--g)]/50'
                      }`}
                    >
                      {cat.icon}
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
          </div>

          {/* Sub-Sort + Player Position / Age Filters */}
          <div className="flex flex-wrap items-center gap-1.5 mland:gap-1">
            {entity === 'clubs' && clubSubOptions[clubCat].length > 1 && (
              <div className="seg-bar">
                {clubSubOptions[clubCat].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setClubSub(opt.id);
                    }}
                    className={`seg-btn ${clubSub === opt.id ? 'seg-btn-active' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {entity === 'players' && (
              <>
                {playerSubOptions[playerCat].length > 1 && (
                  <div className="seg-bar">
                    {playerSubOptions[playerCat].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setPlayerSub(opt.id);
                          setPlayerLimit(60);
                        }}
                        className={`seg-btn ${playerSub === opt.id ? 'seg-btn-active' : ''}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="seg-bar">
                  {(['ALL', 'GK', 'DF', 'MF', 'FW'] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setPosFilter(pos);
                        setPlayerLimit(60);
                      }}
                      className={`seg-btn ${posFilter === pos ? 'seg-btn-active' : ''}`}
                    >
                      {pos === 'ALL' ? 'ทุกตำแหน่ง' : pos}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setU21Only((v) => !v);
                    setPlayerLimit(60);
                  }}
                  className={`px-2 py-1 mland:py-0.5 rounded-lg border text-[10.5px] mland:text-[9px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    u21Only
                      ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] text-[#7a4f00] dark:text-[var(--lamp)]'
                      : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  🌱 ดาวรุ่ง ≤21
                </button>

                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setMyClubOnly((v) => !v);
                    setPlayerLimit(60);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 mland:py-0.5 rounded-lg border text-[10.5px] mland:text-[9px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    myClubOnly
                      ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] text-[#7a4f00] dark:text-[var(--lamp)]'
                      : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  <MyTeamBadge size="2xs" />
                  <span>เฉพาะทีมฉัน</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* My Benchmark Spotlight Strip (3-Column Quick Summary) */}
      <div className="grid grid-cols-1 md:grid-cols-3 mland:grid-cols-3 gap-2 mland:gap-1.5 shrink-0">
        {entity === 'clubs' ? (
          <>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onInspectTeam(me.id);
              }}
              className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--lamp-soft)]/55 border border-[var(--lamp)]/50 hover:border-[var(--lamp)] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ClubCrest name={me.name} size={24} team={me} club={state.club} isMyClub={state.mode === 'm'} />
                <div className="min-w-0">
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold flex items-center gap-1">
                    <span>อันดับทีมของคุณ</span>
                    <MyTeamBadge size="2xs" />
                  </div>
                  <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)] truncate">
                    {myClubBench ? `อันดับ #${myClubBench.rank} จาก ${myClubBench.total} ทีม` : `${me.name} (อยู่นอกขอบเขตที่เลือก)`}
                  </div>
                </div>
              </div>
              {myClubBench && (
                <div className="text-right shrink-0">
                  <div className="font-display font-extrabold text-sm mland:text-xs text-[#9a6700] dark:text-[var(--lamp)] tabular leading-tight">
                    {myClubBench.metric.display}
                  </div>
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">{myClubBench.metric.unit}</div>
                </div>
              )}
            </button>

            {topClubEntry ? (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onInspectTeam(topClubEntry.team.id);
                }}
                className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ClubCrest
                    name={topClubEntry.team.name}
                    size={24}
                    team={topClubEntry.team}
                    club={state.club}
                    isMyClub={topClubEntry.team.id === state.me && state.mode === 'm'}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">
                      อันดับ #1 หมวดนี้ · {getTierShortLabel(topClubEntry.team.tier, topClubEntry.team.origName || topClubEntry.team.name, topClubEntry.team.modLeagueName, topClubEntry.team.zone, topClubEntry.team.leagueCode)}
                    </div>
                    <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)] truncate">
                      {topClubEntry.team.name}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-extrabold text-sm mland:text-xs text-[var(--g)] tabular leading-tight">
                    {getClubPrimaryMetric(topClubEntry).display}
                  </div>
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">
                    {getClubPrimaryMetric(topClubEntry).unit}
                  </div>
                </div>
              </button>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs text-[var(--mut)]">
                ไม่มีข้อมูลสโมสร
              </div>
            )}

            <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">ขอบเขต &amp; ค่าเฉลี่ย</div>
                <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)] truncate">{scopeLabel}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display font-extrabold text-sm mland:text-xs text-[var(--ink)] tabular leading-tight">
                  {clubGroupAvg}
                </div>
                <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">ค่าเฉลี่ยกลุ่ม</div>
              </div>
            </div>
          </>
        ) : (
          <>
            {myPlayerBench ? (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onInspectPlayer(myPlayerBench.entry.player, myPlayerBench.entry.team);
                }}
                className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--lamp-soft)]/55 border border-[var(--lamp)]/50 hover:border-[var(--lamp)] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerFace
                    player={myPlayerBench.entry.player}
                    team={myPlayerBench.entry.team}
                    state={state}
                    club={state.club}
                    isMyClub={state.mode === 'm'}
                    size={28}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold flex items-center gap-1">
                      <span>{state.mode === 'p' ? 'อันดับของคุณ' : 'ตัวท็อปทีมของคุณ'}</span>
                      <MyTeamBadge size="2xs" />
                    </div>
                    <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)] truncate">
                      #{myPlayerBench.rank} · {myPlayerBench.entry.player.n}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-extrabold text-sm mland:text-xs text-[#9a6700] dark:text-[var(--lamp)] tabular leading-tight">
                    {myPlayerBench.metric.display}
                  </div>
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">{myPlayerBench.metric.unit}</div>
                </div>
              </button>
            ) : (
              <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">นักเตะทีมคุณ</div>
                  <div className="font-bold text-xs mland:text-[10px] text-[var(--mut)] truncate">
                    ไม่อยู่ในตัวกรองที่เลือก
                  </div>
                </div>
              </div>
            )}

            {topPlayerItem ? (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onInspectPlayer(topPlayerItem.entry.player, topPlayerItem.entry.team);
                }}
                className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerFace
                    player={topPlayerItem.entry.player}
                    team={topPlayerItem.entry.team}
                    state={state}
                    club={state.club}
                    isMyClub={topPlayerItem.entry.isMyClub && state.mode === 'm'}
                    size={28}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold truncate">
                      อันดับ #1 · {topPlayerItem.entry.team.name}
                    </div>
                    <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)] truncate flex items-center gap-1">
                      <PositionBadge role={topPlayerItem.entry.player.ro || topPlayerItem.entry.player.pos} size="2xs" />
                      <span className="truncate">{topPlayerItem.entry.player.n}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-extrabold text-sm mland:text-xs text-[var(--g)] tabular leading-tight">
                    {getPlayerPrimaryMetric(topPlayerItem.entry).display}
                  </div>
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">
                    {getPlayerPrimaryMetric(topPlayerItem.entry).unit}
                  </div>
                </div>
              </button>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs text-[var(--mut)]">
                ไม่พบนักเตะในเงื่อนไข
              </div>
            )}

            <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">ขอบเขต &amp; จำนวนที่พบ</div>
                <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)] truncate tabular">
                  {scopeLabel} · {playerRankedFiltered.length.toLocaleString('en-US')} คน
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display font-extrabold text-sm mland:text-xs text-[var(--ink)] tabular leading-tight">
                  {playerGroupAvg}
                </div>
                <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">ค่าเฉลี่ยกลุ่ม</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main High-Density Ranking Table */}
      <div className="flex-1 min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-col overflow-hidden">
        {entity === 'clubs' ? (
          <>
            {/* Club Table Header */}
            <div className="shrink-0 grid grid-cols-[28px_24px_minmax(0,1.5fr)_minmax(110px,1fr)_88px] sm:grid-cols-[34px_26px_minmax(0,1.5fr)_minmax(180px,1.25fr)_110px_86px] items-center gap-2 mland:gap-1.5 px-3 py-2 mland:px-2.5 mland:py-1 bg-[var(--surface-2)]/85 border-b border-[var(--line)] text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)]">
              <span className="text-center">#</span>
              <span />
              <span>สโมสร / ลีก</span>
              <span className="hidden sm:block">ข้อมูลเทียบประกอบ</span>
              <span className="text-right sm:text-left">รายละเอียดหลัก</span>
              <span className="text-right text-[var(--ink)]">
                {clubSubOptions[clubCat].find((o) => o.id === clubSub)?.label || 'คะแนน'}
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/50">
              {clubFiltered.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-2">
                  <div className="text-xs font-bold text-[var(--ink)]">ไม่พบสโมสรที่ตรงกับคำค้นหา</div>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="btn btn-xs btn-secondary"
                  >
                    ล้างคำค้นหา
                  </button>
                </div>
              ) : (
                clubFiltered.map(({ entry, rank }) => {
                  const isMe = entry.team.id === state.me;
                  const metric = getClubPrimaryMetric(entry);
                  const span = Math.max(1, clubMinMax.max - clubMinMax.min);
                  const barPct =
                    clubSub === 'gaPerMatch' || clubSub === 'youngest'
                      ? clamp(Math.round(((clubMinMax.max - metric.raw) / span) * 85 + 15), 12, 100)
                      : clamp(Math.round(((metric.raw - clubMinMax.min) / span) * 85 + 15), 12, 100);

                  let middleSummary = '';
                  let rightSummary = '';
                  if (clubCat === 'power') {
                    middleSummary = `ตัวจริง ${entry.st.ovXi} · เฉลี่ย ${entry.st.ovSq} · รุก ${entry.st.at} · รับ ${entry.st.df}`;
                    rightSummary = `หน้า ${entry.st.f} / กลาง ${entry.st.m} / หลัง ${entry.st.d}`;
                  } else if (clubCat === 'value') {
                    middleSummary = `ค่าตัวรวม ${fmtMoneyNum(entry.totalValue)} · ค่าเหนื่อย ${fmtMoneyNum(entry.wage)}/นัด`;
                    rightSummary = entry.topPlayer ? `แพงสุด ${entry.topPlayer.n.split(' ')[0]} (${entry.topPlayer.ov})` : `${entry.team.sq.length} คน`;
                  } else if (clubCat === 'fans') {
                    middleSummary = `🏟️ ${entry.stadiumName} · จุ ${entry.stadiumCap.toLocaleString('en-US')}`;
                    rightSummary = `แฟน ${fmtFansShort(entry.fans)} คน`;
                  } else if (clubCat === 'trophies') {
                    middleSummary = entry.trophyTotal > 0
                      ? `รวม ${entry.trophyTotal} ถ้วย · รายการใหญ่ ${entry.majorTrophies} ถ้วย`
                      : 'ยังไม่มีถ้วยแชมป์ในประวัติศาสตร์';
                    rightSummary = entry.latestTrophySeason > 0 ? `ล่าสุดซีซั่น ${entry.latestTrophySeason}` : `พลังทีม ${entry.powerScore}`;
                  } else if (clubCat === 'season') {
                    middleSummary = entry.team.p > 0
                      ? `แข่ง ${entry.team.p} · ชนะ ${entry.team.w} เสมอ ${entry.team.d} แพ้ ${entry.team.l} · ชนะ ${entry.winPct}%`
                      : 'ยังไม่ลงสนามลีกในฤดูกาลนี้';
                    rightSummary = `ได้ ${entry.team.gf} / เสีย ${entry.team.ga}`;
                  } else {
                    middleSummary = `อายุเฉลี่ย ${entry.st.age.toFixed(1)} ปี · POT ${entry.avgPot.toFixed(1)} · ดาวรุ่ง ${entry.u21Count} คน`;
                    rightSummary = entry.topWonderkid
                      ? `เพชรเม็ดงาม: ${entry.topWonderkid.n.split(' ')[0]} (${entry.topWonderkid.ov}→${Math.max(entry.topWonderkid.ov, entry.topWonderkid.pot)})`
                      : 'เน้นแข้งประสบการณ์';
                  }

                  return (
                    <button
                      key={entry.team.id}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onInspectTeam(entry.team.id);
                      }}
                      className={`w-full grid grid-cols-[28px_24px_minmax(0,1.5fr)_minmax(110px,1fr)_88px] sm:grid-cols-[34px_26px_minmax(0,1.5fr)_minmax(180px,1.25fr)_110px_86px] items-center gap-2 mland:gap-1.5 px-3 py-2 mland:px-2.5 mland:py-1 text-left cursor-pointer transition-colors ${
                        isMe ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/80' : 'hover:bg-[var(--surface-2)]/60'
                      }`}
                    >
                      <div className="flex justify-center">{renderRankBadge(rank)}</div>

                      <div className="flex items-center justify-center shrink-0 [&>svg]:w-[22px] [&>svg]:h-[22px] mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                        <ClubCrest name={entry.team.name} size={22} team={entry.team} club={state.club} isMyClub={isMe && state.mode === 'm'} />
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)] flex items-center gap-1 min-w-0 leading-tight">
                          <span className="truncate">{entry.team.name}</span>
                          {isMe && <MyTeamBadge size="2xs" />}
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)] truncate mt-0.5 flex items-center gap-1">
                          <span>{getTierShortLabel(entry.team.tier, entry.team.origName || entry.team.name, entry.team.modLeagueName, entry.team.zone, entry.team.leagueCode)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular">{entry.team.sq.length} คน</span>
                          {entry.team.fm && (
                            <>
                              <span aria-hidden="true" className="hidden sm:inline">·</span>
                              <span className="hidden sm:inline-flex">
                                <WdlFormStrip fm={entry.team.fm} size="2xs" />
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="hidden sm:block min-w-0">
                        <div className="text-[10.5px] mland:text-[8.5px] text-[var(--ink)]/90 truncate tabular">
                          {middleSummary}
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barPct}%`,
                              background: isMe ? '#d97706' : 'var(--g)'
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-right sm:text-left min-w-0">
                        <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate tabular">
                          {rightSummary}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {clubSub === 'ovXi' || clubSub === 'ovSq' ? (
                          <OvrBadge ov={metric.raw} variant="inline" size="md" />
                        ) : (
                          <div className="font-display font-extrabold text-xs sm:text-[13px] mland:text-[10.5px] text-[var(--ink)] tabular leading-tight">
                            {metric.display}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            {/* Player Table Header */}
            <div className="shrink-0 grid grid-cols-[28px_28px_minmax(0,1.4fr)_86px_74px] sm:grid-cols-[34px_30px_minmax(0,1.45fr)_minmax(150px,1fr)_96px_78px] items-center gap-2 mland:gap-1.5 px-3 py-2 mland:px-2.5 mland:py-1 bg-[var(--surface-2)]/85 border-b border-[var(--line)] text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)]">
              <span className="text-center">#</span>
              <span />
              <span>นักเตะ / สโมสร</span>
              <span className="hidden sm:block">สถิติ &amp; พลังสำคัญ</span>
              <span className="text-right sm:text-left">OVR · มูลค่า</span>
              <span className="text-right text-[var(--ink)]">
                {playerSubOptions[playerCat].find((o) => o.id === playerSub)?.label || 'คะแนน'}
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--line)]/50">
              {visiblePlayers.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-2">
                  <div className="text-xs font-bold text-[var(--ink)]">ไม่พบนักเตะที่ตรงกับเงื่อนไข</div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setPosFilter('ALL');
                      setU21Only(false);
                      setMyClubOnly(false);
                    }}
                    className="btn btn-xs btn-secondary"
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                </div>
              ) : (
                <>
                  {visiblePlayers.map(({ entry, rank }) => {
                    const metric = getPlayerPrimaryMetric(entry);
                    const highlightRow = entry.isMePlayer || entry.isMyClub;
                    const ovStyle = getOvrTierStyle(entry.player.ov);

                    let statLine = '';
                    if (playerCat === 'ovr' || playerCat === 'potential') {
                      statLine = `อายุ ${entry.player.age} ปี · POT ${entry.pot} (+${entry.gap}) · ${ovStyle.label}`;
                    } else if (playerCat === 'value') {
                      statLine = `ค่าเหนื่อย ${fmtMoneyNum(entry.wage)}/นัด · อายุ ${entry.player.age} ปี · สัญญา ${entry.player.con?.yr ?? 1} ปี`;
                    } else if (playerCat === 'attack') {
                      statLine = `ลง ${entry.apps} นัด · ${entry.goals} ประตู${entry.cupGoals > 0 ? ` (ถ้วย ${entry.cupGoals})` : ''} · ${entry.assists} จ่าย`;
                    } else if (playerCat === 'rating') {
                      statLine = entry.apps > 0
                        ? `ลง ${entry.apps} นัด · MOTM ${entry.motm} · G+A ${entry.ga}`
                        : `ยังไม่ลงสนาม · พลังรวม ${entry.player.ov}`;
                    } else if (playerCat === 'defense') {
                      statLine = entry.player.pos === 'GK'
                        ? `คลีนชีต ${entry.cleanSheets} · เซฟ ${entry.gkSave} · ลง ${entry.apps} นัด`
                        : `คลีนชีต ${entry.cleanSheets} · แย่งบอล ${entry.attrs.tk} · กาย ${entry.attrs.ph}`;
                    } else {
                      statLine = `ยิง ${entry.attrs.sh} · จ่าย ${entry.attrs.ps} · เลี้ยง ${entry.attrs.dr} · แย่ง ${entry.attrs.tk} · กาย ${entry.attrs.ph}`;
                    }

                    return (
                      <button
                        key={`${entry.team.id}-${entry.player.n}-${entry.player.no ?? ''}`}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onInspectPlayer(entry.player, entry.team);
                        }}
                        className={`w-full grid grid-cols-[28px_28px_minmax(0,1.4fr)_86px_74px] sm:grid-cols-[34px_30px_minmax(0,1.45fr)_minmax(150px,1fr)_96px_78px] items-center gap-2 mland:gap-1.5 px-3 py-1.5 mland:px-2.5 mland:py-1 text-left cursor-pointer transition-colors ${
                          entry.isMePlayer
                            ? 'bg-emerald-500/12 hover:bg-emerald-500/20'
                            : highlightRow
                              ? 'bg-[var(--lamp-soft)]/45 hover:bg-[var(--lamp-soft)]/75'
                              : 'hover:bg-[var(--surface-2)]/60'
                        }`}
                      >
                        <div className="flex justify-center">{renderRankBadge(rank)}</div>

                        <div className="shrink-0 flex justify-center mland:[&_svg]:w-5 mland:[&_svg]:h-5">
                          <PlayerFace
                            player={entry.player}
                            team={entry.team}
                            state={state}
                            club={state.club}
                            isMyClub={entry.isMyClub && state.mode === 'm'}
                            size={28}
                          />
                        </div>

                        <div className="min-w-0">
                          {(() => {
                            const natMeta =
                              getCountryMetaByCode(entry.player.nat) ||
                              (entry.team.tier >= 3 ? getForeignTeamCountryMeta(entry.team.name, entry.team.leagueCode) : null);
                            return (
                              <div className="font-bold text-xs mland:text-[10px] text-[var(--ink)] flex items-center gap-1 min-w-0 leading-tight">
                                <PositionBadge role={entry.player.ro || entry.player.pos} size="2xs" />
                                {natMeta && (
                                  <span title={`สัญชาติ${natMeta.country}`} className="text-[11px] mland:text-[9px] leading-none shrink-0">
                                    {natMeta.flag}
                                  </span>
                                )}
                                <span className="truncate">{entry.player.n}</span>
                                {entry.isMePlayer && (
                                  <span className="text-[9.5px] font-extrabold text-[var(--g)] shrink-0">คุณ</span>
                                )}
                              </div>
                            );
                          })()}
                          <div className="text-[10px] mland:text-[8px] text-[var(--mut)] truncate flex items-center gap-1 mt-0.5 leading-tight">
                            <ClubCrest
                              name={entry.team.name}
                              size={11}
                              team={entry.team}
                              club={state.club}
                              isMyClub={entry.isMyClub && state.mode === 'm'}
                            />
                            <span className="truncate">{entry.team.name}</span>
                            {entry.isMyClub && <MyTeamBadge size="2xs" />}
                            <span aria-hidden="true" className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline">{getTierShortLabel(entry.team.tier, entry.team.origName || entry.team.name, entry.team.modLeagueName, entry.team.zone, entry.team.leagueCode)}</span>
                          </div>
                        </div>

                        <div className="hidden sm:block min-w-0">
                          <div className="text-[10.5px] mland:text-[8.5px] text-[var(--ink)]/90 truncate tabular">
                            {statLine}
                          </div>
                        </div>

                        <div className="flex items-center justify-end sm:justify-start gap-1.5 min-w-0">
                          <OvrBadge ov={entry.player.ov} size="2xs" />
                          <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular truncate">
                            {fmtMoney(entry.value)}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          {playerSub === 'ov' || playerSub === 'pot' ? (
                            <OvrBadge ov={metric.raw} size="xs" />
                          ) : (
                            <div className="font-display font-extrabold text-xs sm:text-[13px] mland:text-[10.5px] text-[var(--ink)] tabular leading-tight">
                              {metric.display}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {playerRankedFiltered.length > visiblePlayers.length && (
                    <div className="p-2.5 flex items-center justify-center gap-2 bg-[var(--surface-2)]/35">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setPlayerLimit((n) => n + 60);
                        }}
                        className="btn btn-xs btn-secondary"
                      >
                        แสดงเพิ่มอีก 60 คน ({visiblePlayers.length}/{playerRankedFiltered.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setPlayerLimit(playerRankedFiltered.length);
                        }}
                        className="btn btn-xs btn-surface"
                      >
                        แสดงทั้งหมด
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});
