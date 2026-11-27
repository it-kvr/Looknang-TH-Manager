import React, { useEffect, useRef, useState } from 'react';
import type {
  ArchivedStreamComment,
  GameState,
  MatchCardEvent,
  MatchEnvironment,
  MatchEvent,
  MatchSubEvent,
  MatchTimelineItem,
  Player,
  PlayerPerfResult,
  SubRole,
  Team,
  TeamFacilityMatchModifiers,
  TimelineKind
} from '../types/game';
import { LINE } from '../data/thaiFootballData';
import { clamp, fmtMoneyNum } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import { useScrollTopOnChange } from '../utils/scrollReset';
import { getShirtNo } from '../engine/playerCore';
import { computeMatchStreamProjection, fmtFansShort } from '../engine/simulation';
import {
  getStreamViewerTier,
  getViewerTierMeta,
  type BroadcastChannelInfo
} from '../engine/liveStreamChat';
import { ClubCrest, FormationPitch, PlayerFace, type PitchPlayerMeta } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { CaptainBadge } from '../components/CaptainBadge';
import { PositionBadge } from '../components/PositionBadge';
import { MyTeamBadge } from '../components/MyTeamBadge';

const ftRatingTextColor = (rt: number | null): string => {
  if (rt == null) return 'text-[var(--mut)]/55';
  if (rt >= 8.0) return 'text-[#b45309] dark:text-[#fde047]';
  if (rt >= 7.0) return 'text-emerald-600 dark:text-emerald-400';
  if (rt >= 6.0) return 'text-sky-600 dark:text-sky-400';
  return 'text-rose-600 dark:text-rose-400';
};

const ftRatingDarkTextColor = (rt: number): string => {
  if (rt >= 8.0) return 'text-[#fde047]';
  if (rt >= 7.0) return 'text-emerald-300';
  if (rt >= 6.0) return 'text-sky-300';
  return 'text-rose-300';
};

export interface MatchSubLogInfo {
  teamId: number;
  inName: string;
  outName: string;
  badge?: string;
  isInjury?: boolean;
  isMeIn?: boolean;
  isMeOut?: boolean;
}

export interface MatchLogItem {
  id: string | number;
  m: number;
  text: string;
  tone?: 'goal' | 'card' | 'sys' | 'sub' | 'norm';
  varReplayId?: string;
  subInfo?: MatchSubLogInfo;
}

export interface MatchVisualEntry {
  team: Team;
  player: Player;
  no: number;
  shortName: string;
}

export interface MatchVisualIndex {
  teamsSorted: Team[];
  entries: MatchVisualEntry[];
  byFullLen: MatchVisualEntry[];
  byShortLen: MatchVisualEntry[];
}

export function buildMatchVisualIndex(homeOrig: Team, awayOrig: Team): MatchVisualIndex {
  const teamsSorted = [homeOrig, awayOrig].sort((a, b) => b.name.length - a.name.length);
  const entries: MatchVisualEntry[] = [];
  [homeOrig, awayOrig].forEach((team) => {
    team.sq.forEach((player) => {
      entries.push({
        team,
        player,
        no: getShirtNo(team, player),
        shortName: player.n.split(' ')[0] || player.n
      });
    });
  });
  const byFullLen = entries.slice().sort((a, b) => b.player.n.length - a.player.n.length);
  const byShortLen = entries.slice().sort((a, b) => b.shortName.length - a.shortName.length);
  return { teamsSorted, entries, byFullLen, byShortLen };
}

export function resolveLogVisual(
  text: string,
  idxData: MatchVisualIndex,
  isPlayerMode: boolean,
  myPlayerSquadObj: Player | undefined,
  meTeamOrig: Team
) {
  let matchedTeam: Team | null = null;
  let isBothTeams = false;
  let rem = text;
  for (const t of idxData.teamsSorted) {
    if (t.name && rem.includes(t.name)) {
      if (matchedTeam && matchedTeam.id !== t.id) {
        isBothTeams = true;
        break;
      }
      matchedTeam = t;
      rem = rem.split(t.name).join(' ');
    }
  }

  let bestEntry: MatchVisualEntry | null = null;
  let bestIdx = Number.MAX_SAFE_INTEGER;
  const scanEntries = (pool: MatchVisualEntry[], useShort: boolean, teamFilter: Team | null) => {
    for (const e of pool) {
      if (teamFilter && e.team.id !== teamFilter.id) continue;
      const needle = useShort ? e.shortName : e.player.n;
      if (!needle || (useShort && needle.length < 3)) continue;
      const idx = text.indexOf(needle);
      if (idx >= 0 && idx < bestIdx) {
        bestIdx = idx;
        bestEntry = e;
      }
    }
  };

  if (matchedTeam) {
    scanEntries(idxData.byFullLen, false, matchedTeam);
    if (!bestEntry) scanEntries(idxData.byFullLen, false, null);
    if (!bestEntry) scanEntries(idxData.byShortLen, true, matchedTeam);
  } else if (!isBothTeams) {
    scanEntries(idxData.byFullLen, false, null);
    if (!bestEntry) scanEntries(idxData.byShortLen, true, null);
  }

  if (!bestEntry && !isBothTeams && isPlayerMode && myPlayerSquadObj && text.includes('คุณ')) {
    bestEntry = {
      team: meTeamOrig,
      player: myPlayerSquadObj,
      no: getShirtNo(meTeamOrig, myPlayerSquadObj),
      shortName: myPlayerSquadObj.n.split(' ')[0] || myPlayerSquadObj.n
    };
    if (!matchedTeam) matchedTeam = meTeamOrig;
  }

  const finalTeam = isBothTeams ? null : matchedTeam || bestEntry?.team || null;
  return { team: finalTeam, playerEntry: bestEntry, isBothTeams };
}

const MATCH_THUMB_SIZE_CLS: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'w-[20px] h-[21px] mland:w-[17px] mland:h-[18px]',
  sm: 'w-[24px] h-[25px] mland:w-[20px] mland:h-[21px]',
  md: 'w-[28px] h-[30px]'
};

const MATCH_THUMB_PX: Record<'xs' | 'sm' | 'md', number> = {
  xs: 20,
  sm: 24,
  md: 28
};

export const MatchPlayerThumb: React.FC<{
  player: Player;
  team: Team;
  state: GameState;
  kitColor: string;
  trimColor?: string;
  size?: 'xs' | 'sm' | 'md';
  dark?: boolean;
  ringClassName?: string;
  isMotm?: boolean;
}> = ({ player, team, state, kitColor, trimColor, size = 'sm', dark = false, ringClassName, isMotm = false }) => {
  const isMeClub = team.id === state.me && state.mode === 'm';
  const effKit = kitColor || '#15803d';
  const effTrim = player.pos === 'GK' ? undefined : trimColor;
  const bgStyle = dark
    ? `linear-gradient(155deg, color-mix(in srgb, ${effKit} 36%, #0f172a), color-mix(in srgb, ${effTrim || '#fad05a'} 16%, #1e293b))`
    : `linear-gradient(155deg, color-mix(in srgb, ${effKit} 28%, var(--surface-2)), color-mix(in srgb, ${effTrim || '#fad05a'} 14%, var(--surface)))`;
  const ringCls = ringClassName || (dark ? 'ring-white/30' : 'ring-black/14 dark:ring-white/22');

  const faceBox = (
    <span
      className={`shrink-0 ${MATCH_THUMB_SIZE_CLS[size]} rounded-lg overflow-hidden ring-1 ${ringCls} inline-flex items-end justify-center shadow-2xs [&>svg]:w-full [&>svg]:h-full [&>svg]:block`}
      style={{ background: bgStyle }}
    >
      <PlayerFace
        player={player}
        team={team}
        state={state}
        careerProfile={player.me ? state.p : null}
        club={isMeClub ? state.club : null}
        isMyClub={isMeClub}
        kitColor={effKit}
        trimColor={effTrim}
        size={MATCH_THUMB_PX[size]}
        bare
      />
    </span>
  );

  if (!isMotm) return faceBox;

  return (
    <span className="relative inline-flex shrink-0">
      {faceBox}
      <span
        title="Man of the Match"
        aria-label="Man of the Match"
        className="pointer-events-none absolute -top-1 -left-1 z-10 inline-flex items-center justify-center w-[13px] h-[13px] mland:w-[11px] mland:h-[11px] rounded-full bg-[#111418] border border-[#facc15] shadow-xs"
      >
        <svg viewBox="-5 -5 10 10" className="w-[8.5px] h-[8.5px] mland:w-[7px] mland:h-[7px]" aria-hidden="true">
          <path d="M-3.2 2.2 L-3.8 -1.8 L-1.4 0.3 L0 -2.6 L1.4 0.3 L3.8 -1.8 L3.2 2.2 Z" fill="#fde047" />
        </svg>
      </span>
    </span>
  );
};

export const SubEventCard: React.FC<{
  minute: number;
  team: Team;
  inName: string;
  outName: string;
  badge?: string;
  isInjury?: boolean;
  isMeIn?: boolean;
  isMeOut?: boolean;
  homeId: number;
  homeKit: string;
  awayKit: string;
  homeGkKit: string;
  awayGkKit: string;
  homeTrim: string;
  awayTrim: string;
  state: GameState;
}> = ({
  minute,
  team,
  inName,
  outName,
  badge,
  isInjury,
  isMeIn,
  isMeOut,
  homeId,
  homeKit,
  awayKit,
  homeGkKit,
  awayGkKit,
  homeTrim,
  awayTrim,
  state
}) => {
  const isTMe = team.id === state.me && state.mode === 'm';
  const isTeamHome = team.id === homeId;
  const tKit = isTeamHome ? homeKit : awayKit;
  const tGkKit = isTeamHome ? homeGkKit : awayGkKit;
  const tTrim = isTeamHome ? homeTrim : awayTrim;
  const inPl = team.sq.find((q) => q.n === inName);
  const outPl = team.sq.find((q) => q.n === outName);
  const inNo = inPl ? getShirtNo(team, inPl) : null;
  const outNo = outPl ? getShirtNo(team, outPl) : null;

  return (
    <div className="rounded-lg bg-sky-500/6 border border-sky-500/20 px-2 py-1.5 mland:px-1.5 mland:py-1 space-y-1">
      <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[9px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="min-w-[26px] text-center px-1 py-[1px] rounded-md bg-sky-500/18 text-sky-700 dark:text-sky-300 font-extrabold tabular shrink-0">
            {minute}&apos;
          </span>
          <span className="shrink-0 inline-flex">
            <ClubCrest name={team.name} size={13} team={team} club={state.club} isMyClub={isTMe} />
          </span>
          <span className="font-bold text-[var(--ink)] truncate">{team.name}</span>
          <span className="text-[var(--mut)] font-medium shrink-0 hidden sm:inline">· เปลี่ยนตัว</span>
        </div>
        {badge && (
          <span className="text-[9.5px] mland:text-[8px] font-semibold text-[var(--mut)] shrink-0 truncate max-w-[160px]">
            {badge}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-1">
        <div className="flex items-center gap-1 min-w-0 px-1.5 py-0.5 rounded-md bg-emerald-500/9">
          <StatIconBadge kind="subIn" size="xs" title="เปลี่ยนตัวลงสนาม" />
          <span className="text-[9.5px] mland:text-[8px] font-extrabold text-[var(--g)] shrink-0">เข้า</span>
          {inPl && (
            <MatchPlayerThumb
              player={inPl}
              team={team}
              state={state}
              kitColor={inPl.pos === 'GK' ? tGkKit : tKit}
              trimColor={inPl.pos === 'GK' ? undefined : tTrim}
              size="xs"
              ringClassName="ring-[var(--g)]/55"
            />
          )}
          {inNo != null && (
            <span className="text-[9.5px] mland:text-[8px] font-extrabold tabular text-[#b45309] dark:text-[var(--lamp)] shrink-0">
              #{inNo}
            </span>
          )}
          {inPl?.ro && <PositionBadge role={inPl.ro} size="2xs" />}
          <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate min-w-0 flex-1">
            {inName}
          </span>
          {isMeIn && (
            <span className="text-[8.5px] font-black text-[#b45309] dark:text-[var(--lamp)] shrink-0">
              ★ คุณ
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 min-w-0 px-1.5 py-0.5 rounded-md bg-rose-500/9">
          <StatIconBadge kind="subOut" size="xs" title="ถูกเปลี่ยนตัวออก" />
          <span className="text-[9.5px] mland:text-[8px] font-extrabold text-[var(--red)] shrink-0">ออก</span>
          {outPl && (
            <MatchPlayerThumb
              player={outPl}
              team={team}
              state={state}
              kitColor={outPl.pos === 'GK' ? tGkKit : tKit}
              trimColor={outPl.pos === 'GK' ? undefined : tTrim}
              size="xs"
              ringClassName="ring-[var(--red)]/50"
            />
          )}
          {outNo != null && (
            <span className="text-[9.5px] mland:text-[8px] font-bold tabular text-[var(--mut)] shrink-0">
              #{outNo}
            </span>
          )}
          {outPl?.ro && <PositionBadge role={outPl.ro} size="2xs" />}
          <span className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--ink)]/90 truncate min-w-0 flex-1">
            {outName}
          </span>
          {isInjury && <StatIconBadge kind="injury" size="xs" title="บาดเจ็บ" />}
          {isMeOut && (
            <span className="text-[8.5px] font-black text-[#b45309] dark:text-[var(--lamp)] shrink-0">
              ★ คุณ
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const MatchLogRow = React.memo<{
  l: MatchLogItem;
  matchVisualIndex: MatchVisualIndex;
  homeOrig: Team;
  awayOrig: Team;
  meTeamOrig: Team;
  homeId: number;
  awayId: number;
  homeKit: string;
  awayKit: string;
  homeGkKit: string;
  awayGkKit: string;
  homeTrim: string;
  awayTrim: string;
  state: GameState;
  isPlayerMode: boolean;
  myPlayerSquadObj: Player | undefined;
  onOpenVarReplay?: (varId: string) => void;
}>(({
  l,
  matchVisualIndex,
  homeOrig,
  awayOrig,
  meTeamOrig,
  homeId,
  awayId,
  homeKit,
  awayKit,
  homeGkKit,
  awayGkKit,
  homeTrim,
  awayTrim,
  state,
  isPlayerMode,
  myPlayerSquadObj,
  onOpenVarReplay
}) => {
  if (l.tone === 'sub' && l.subInfo) {
    const subTeam = l.subInfo.teamId === homeOrig.id ? homeOrig : awayOrig;
    return (
      <SubEventCard
        minute={l.m}
        team={subTeam}
        inName={l.subInfo.inName}
        outName={l.subInfo.outName}
        badge={l.subInfo.badge}
        isInjury={l.subInfo.isInjury}
        isMeIn={l.subInfo.isMeIn}
        isMeOut={l.subInfo.isMeOut}
        homeId={homeId}
        homeKit={homeKit}
        awayKit={awayKit}
        homeGkKit={homeGkKit}
        awayGkKit={awayGkKit}
        homeTrim={homeTrim}
        awayTrim={awayTrim}
        state={state}
      />
    );
  }
  const vis = resolveLogVisual(l.text, matchVisualIndex, isPlayerMode, myPlayerSquadObj, meTeamOrig);
  const vTeam = vis.team;
  const vPlayer = vis.playerEntry;
  const vIsHome = vTeam?.id === homeId;
  const vKit = vIsHome ? homeKit : awayKit;
  const vGkKit = vIsHome ? homeGkKit : awayGkKit;
  const vTrim = vIsHome ? homeTrim : awayTrim;
  const vIsMe = Boolean(vTeam && vTeam.id === state.me && state.mode === 'm');

  type Hit = { start: number; end: number; entry: MatchVisualEntry };
  const hits: Hit[] = [];
  for (const entry of matchVisualIndex.byFullLen) {
    const name = entry.player.n;
    if (!name) continue;
    let from = 0;
    while (from < l.text.length) {
      const idx = l.text.indexOf(name, from);
      if (idx < 0) break;
      const end = idx + name.length;
      const overlaps = hits.some((h) => !(end <= h.start || idx >= h.end));
      if (!overlaps) hits.push({ start: idx, end, entry });
      from = end;
    }
  }
  if (hits.length === 0 && vPlayer) {
    const short = vPlayer.shortName;
    const idx = short && short.length >= 2 ? l.text.indexOf(short) : -1;
    if (idx >= 0) {
      hits.push({ start: idx, end: idx + short.length, entry: vPlayer });
    }
  }

  const shownCrestTeamIds = new Set<number>();

  const renderTextSeg = (seg: string, keyPrefix: string) => {
    const tokens = seg.split(/(✚|🔼|🔽)/);
    if (tokens.length === 1) return seg;
    return tokens.map((tok, i) => {
      if (tok === '✚') return <StatIconBadge key={`${keyPrefix}-${i}`} kind="injury" size="xs" />;
      if (tok === '🔼') return <StatIconBadge key={`${keyPrefix}-${i}`} kind="subIn" size="xs" />;
      if (tok === '🔽') return <StatIconBadge key={`${keyPrefix}-${i}`} kind="subOut" size="xs" />;
      return <React.Fragment key={`${keyPrefix}-${i}`}>{tok}</React.Fragment>;
    });
  };

  const renderInlineEventText = () => {
    if (hits.length > 0) {
      hits.sort((a, b) => a.start - b.start);
      const nodes: React.ReactNode[] = [];
      let cursor = 0;
      hits.forEach((h, hIdx) => {
        if (h.start > cursor) {
          nodes.push(<span key={`t-${hIdx}`}>{renderTextSeg(l.text.slice(cursor, h.start), `t-${hIdx}`)}</span>);
        }
        const htTeam = h.entry.team;
        const htPlayer = h.entry.player;
        const htIsHome = htTeam.id === homeId;
        const htKit = htIsHome ? homeKit : awayKit;
        const htGkKit = htIsHome ? homeGkKit : awayGkKit;
        const htTrim = htIsHome ? homeTrim : awayTrim;
        const htIsMe = htTeam.id === state.me && state.mode === 'm';
        const showHitCrest = !shownCrestTeamIds.has(htTeam.id);
        if (showHitCrest) shownCrestTeamIds.add(htTeam.id);
        nodes.push(
          <span key={`p-${hIdx}`} className="inline-flex items-center gap-1 align-middle mx-0.5 text-[var(--ink)]">
            {showHitCrest && (
              <span className="shrink-0 inline-flex">
                <ClubCrest name={htTeam.name} size={12} team={htTeam} club={state.club} isMyClub={htIsMe} />
              </span>
            )}
            <MatchPlayerThumb
              player={htPlayer}
              team={htTeam}
              state={state}
              kitColor={htPlayer.pos === 'GK' ? htGkKit : htKit}
              trimColor={htPlayer.pos === 'GK' ? undefined : htTrim}
              size="xs"
            />
            <span className="text-[10px] mland:text-[8.5px] font-extrabold tabular text-[#b45309] dark:text-[var(--lamp)]">
              #{h.entry.no}
            </span>
            <span className="font-bold">{l.text.slice(h.start, h.end)}</span>
          </span>
        );
        cursor = h.end;
      });
      if (cursor < l.text.length) {
        nodes.push(<span key="tail">{renderTextSeg(l.text.slice(cursor), 'tail')}</span>);
      }
      return nodes;
    }

    if (vTeam) {
      const tIdx = l.text.indexOf(vTeam.name);
      if (tIdx >= 0) {
        return (
          <>
            <span>{renderTextSeg(l.text.slice(0, tIdx), 'team-pre')}</span>
            <span className="inline-flex items-center mr-1 align-middle">
              <ClubCrest name={vTeam.name} size={13} team={vTeam} club={state.club} isMyClub={vIsMe} />
            </span>
            <span className="font-semibold text-[var(--ink)]">{vTeam.name}</span>
            <span>{renderTextSeg(l.text.slice(tIdx + vTeam.name.length), 'team-post')}</span>
          </>
        );
      }
    }

    return renderTextSeg(l.text, 'plain');
  };

  const hasInlinePlayer = hits.length > 0;
  const hasInlineTeam = hasInlinePlayer || Boolean(vTeam && l.text.includes(vTeam.name));

  return (
    <div
      className={`text-[11.5px] mland:text-[10px] flex items-center gap-1.5 rounded-lg transition-colors leading-snug ${
        l.tone === 'goal'
          ? 'px-2 py-1 mland:px-1.5 mland:py-0.5 bg-[var(--g-soft)] border border-[var(--g)]/25 font-bold text-[var(--g)]'
          : l.tone === 'card'
            ? 'px-2 py-1 mland:px-1.5 mland:py-0.5 bg-[var(--red-soft)] border border-[var(--red)]/25 font-semibold text-[var(--red)]'
            : l.tone === 'sub'
              ? 'px-2 py-1 mland:px-1.5 mland:py-0.5 bg-sky-500/8 border border-sky-500/20 font-semibold text-sky-700 dark:text-sky-300'
              : l.tone === 'sys'
                ? 'px-2 py-1 mland:px-1.5 mland:py-0.5 bg-[var(--surface-2)]/65 font-medium text-[var(--ink)]'
                : 'px-2 py-1 mland:px-1.5 mland:py-0.5 text-[var(--mut)] hover:bg-[var(--surface-2)]/40'
      }`}
    >
      <span
        className={`min-w-[28px] text-center px-1 py-[1px] rounded-md tabular font-extrabold text-[10px] mland:text-[8.5px] shrink-0 ${
          l.tone === 'goal'
            ? 'bg-[var(--g)] text-white'
            : l.tone === 'card'
              ? 'bg-[var(--red)] text-white'
              : 'bg-black/8 dark:bg-white/10 text-[var(--ink)]/85'
        }`}
      >
        {l.m}&apos;
      </span>

      {vis.isBothTeams && !hasInlinePlayer ? (
        <span className="inline-flex items-center gap-0.5 shrink-0">
          <ClubCrest name={homeOrig.name} size={13} team={homeOrig} club={state.club} isMyClub={homeId === state.me && state.mode === 'm'} />
          <ClubCrest name={awayOrig.name} size={13} team={awayOrig} club={state.club} isMyClub={awayId === state.me && state.mode === 'm'} />
        </span>
      ) : !hasInlineTeam && vTeam ? (
        <span className="shrink-0 inline-flex">
          <ClubCrest name={vTeam.name} size={14} team={vTeam} club={state.club} isMyClub={vIsMe} />
        </span>
      ) : null}

      {vPlayer && !hasInlinePlayer && (
        <span className="inline-flex items-center gap-1 shrink-0">
          <MatchPlayerThumb
            player={vPlayer.player}
            team={vPlayer.team}
            state={state}
            kitColor={vPlayer.player.pos === 'GK' ? vGkKit : vKit}
            trimColor={vPlayer.player.pos === 'GK' ? undefined : vTrim}
            size="xs"
          />
          <span className="text-[10px] mland:text-[8.5px] font-extrabold tabular text-[#b45309] dark:text-[var(--lamp)]">
            #{vPlayer.no}
          </span>
        </span>
      )}

      <span className="min-w-0 flex-1">{renderInlineEventText()}</span>
      {l.varReplayId && onOpenVarReplay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenVarReplay(l.varReplayId!);
          }}
          className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/14 hover:bg-sky-500/25 border border-sky-400/45 text-sky-700 dark:text-sky-300 text-[10px] mland:text-[8.5px] font-bold cursor-pointer transition-colors whitespace-nowrap"
          title="เปิดจอดูภาพช้า VAR ย้อนหลัง"
        >
          <span>🖥</span>
          <span>ดูภาพช้า</span>
        </button>
      )}
    </div>
  );
});

export interface MatchStatsSummary {
  possH: number;
  shotsH: number;
  shotsA: number;
  onTargetH: number;
  onTargetA: number;
  xgH: number;
  xgA: number;
  passesH: number;
  passesA: number;
  cornersH: number;
  cornersA: number;
  foulsH: number;
  foulsA: number;
  offsidesH: number;
  offsidesA: number;
}

export const MatchStatsPanel: React.FC<{
  homeOrig: Team;
  awayOrig: Team;
  state: GameState;
  matchStats: MatchStatsSummary;
  matchCards: MatchCardEvent[];
}> = ({ homeOrig, awayOrig, state, matchStats, matchCards }) => {
  const homeId = homeOrig.id;
  const awayId = awayOrig.id;
  const yH = matchCards.filter((c) => c.t === homeId && c.type === 'Y').length;
  const yA = matchCards.filter((c) => c.t === awayId && c.type === 'Y').length;
  const rH = matchCards.filter((c) => c.t === homeId && (c.type === 'R' || c.type === 'Y2R')).length;
  const rA = matchCards.filter((c) => c.t === awayId && (c.type === 'R' || c.type === 'Y2R')).length;
  const statRows: { label: string; hVal: number; aVal: number; hText: string; aText: string }[] = [
    { label: 'ครองบอล', hVal: matchStats.possH, aVal: 100 - matchStats.possH, hText: `${matchStats.possH}%`, aText: `${100 - matchStats.possH}%` },
    { label: 'โอกาสยิง (เข้ากรอบ)', hVal: matchStats.shotsH, aVal: matchStats.shotsA, hText: `${matchStats.shotsH} (${matchStats.onTargetH})`, aText: `${matchStats.shotsA} (${matchStats.onTargetA})` },
    { label: 'ความแม่นยำประตู (xG)', hVal: matchStats.xgH, aVal: matchStats.xgA, hText: matchStats.xgH.toFixed(2), aText: matchStats.xgA.toFixed(2) },
    { label: 'จ่ายบอลสำเร็จ', hVal: matchStats.passesH, aVal: matchStats.passesA, hText: `${matchStats.passesH}`, aText: `${matchStats.passesA}` }
  ];

  return (
    <div>
      <div className="px-3 sm:px-3.5 mland:px-2.5 py-2 mland:py-1.5 bg-[var(--surface-2)]/65 border-b border-[var(--line)]/70 flex items-center justify-between gap-2 text-[11px] mland:text-[10px] font-bold">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="shrink-0 [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
            <ClubCrest name={homeOrig.name} size={20} team={homeOrig} club={state.club} isMyClub={homeId === state.me && state.mode === 'm'} />
          </div>
          <span className="leading-tight break-words text-[var(--ink)]">{homeOrig.name}</span>
          {homeId === state.me && <MyTeamBadge size="2xs" />}
        </div>
        <span className="text-[10px] mland:text-[9px] text-[var(--mut)] font-extrabold uppercase tracking-wider shrink-0">📊 สถิติ</span>
        <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1 text-right">
          {awayId === state.me && <MyTeamBadge size="2xs" />}
          <span className="leading-tight break-words text-[var(--ink)]">{awayOrig.name}</span>
          <div className="shrink-0 [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
            <ClubCrest name={awayOrig.name} size={20} team={awayOrig} club={state.club} isMyClub={awayId === state.me && state.mode === 'm'} />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-3.5 mland:p-2 space-y-2.5 mland:space-y-1.5">
        <div className="space-y-2 mland:space-y-1.5">
          {statRows.map((row) => {
            const tot = Math.max(0.01, row.hVal + row.aVal);
            const hPct = row.hVal === 0 && row.aVal === 0 ? 50 : clamp((row.hVal / tot) * 100, 6, 94);
            return (
              <div key={row.label} className="space-y-1 mland:space-y-0.5 text-[11px] mland:text-[10px]">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 tabular">
                  <span className={`font-extrabold ${row.hVal >= row.aVal ? 'text-[var(--ink)]' : 'text-[var(--mut)]'}`}>{row.hText}</span>
                  <span className="text-[10px] text-[var(--mut)] font-semibold text-center">{row.label}</span>
                  <span className={`font-extrabold text-right ${row.aVal >= row.hVal ? 'text-[var(--ink)]' : 'text-[var(--mut)]'}`}>{row.aText}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-[var(--surface-2)] flex gap-0.5">
                  <div className="h-full rounded-l-full transition-all duration-300" style={{ width: `${hPct}%`, backgroundColor: 'var(--g)' }} />
                  <div className="h-full rounded-r-full transition-all duration-300 bg-amber-500/85" style={{ width: `${100 - hPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-[var(--line)]/60 text-[10px] mland:text-[9px] tabular">
          <div className="px-2 py-1 rounded-lg bg-[var(--surface-2)] flex items-center justify-between gap-1">
            <span className="font-bold">{matchStats.cornersH}</span>
            <span className="text-[var(--mut)] font-semibold">เตะมุม</span>
            <span className="font-bold">{matchStats.cornersA}</span>
          </div>
          <div className="px-2 py-1 rounded-lg bg-[var(--surface-2)] flex items-center justify-between gap-1">
            <span className="font-bold">{matchStats.foulsH}/{matchStats.offsidesH}</span>
            <span className="text-[var(--mut)] font-semibold">ฟาวล์/ล้ำ</span>
            <span className="font-bold">{matchStats.foulsA}/{matchStats.offsidesA}</span>
          </div>
          <div className="px-2 py-1 rounded-lg bg-[var(--surface-2)] flex items-center justify-between gap-1">
            <span className="inline-flex items-center gap-0.5 font-bold">
              <span className={yH === 0 ? 'opacity-45' : ''}><StatIconBadge kind="yellow" count={Math.max(1, yH)} size="xs" /></span>
              {yH === 0 && <span>0</span>}
              {rH > 0 && <StatIconBadge kind="red" count={rH} size="xs" />}
            </span>
            <span className="text-[var(--mut)] font-semibold">ใบ</span>
            <span className="inline-flex items-center gap-0.5 font-bold">
              {rA > 0 && <StatIconBadge kind="red" count={rA} size="xs" />}
              <span className={yA === 0 ? 'opacity-45' : ''}><StatIconBadge kind="yellow" count={Math.max(1, yA)} size="xs" /></span>
              {yA === 0 && <span>0</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MatchTimelinePanel: React.FC<{
  timelineEvents: MatchTimelineItem[];
  homeOrig: Team;
  awayOrig: Team;
  state: GameState;
  homeKit: string;
  awayKit: string;
  homeGkKit: string;
  awayGkKit: string;
  homeTrim: string;
  awayTrim: string;
  standalone?: boolean;
}> = ({
  timelineEvents,
  homeOrig,
  awayOrig,
  state,
  homeKit,
  awayKit,
  homeGkKit,
  awayGkKit,
  homeTrim,
  awayTrim,
  standalone = false
}) => {
  const homeId = homeOrig.id;
  const awayId = awayOrig.id;

  const iconForKind = (kind: TimelineKind) => {
    switch (kind) {
      case 'kickoff':
        return <span className="text-[11px] leading-none shrink-0">🚩</span>;
      case 'first_half':
        return <span className="text-[11px] leading-none shrink-0">☕</span>;
      case 'second_half':
        return <span className="text-[11px] leading-none shrink-0">▶️</span>;
      case 'full_time':
        return <span className="text-[11px] leading-none shrink-0">🏁</span>;
      case 'goal':
        return <span className="inline-flex items-center justify-center w-4.5 h-4.5 text-[12.5px] leading-none shrink-0">⚽</span>;
      case 'own_goal':
        return <span className="inline-flex items-center justify-center w-4.5 h-4.5 text-[12px] leading-none shrink-0">🤦</span>;
      case 'pen_goal':
        return <span className="inline-flex items-center justify-center w-4.5 h-4.5 text-[12px] leading-none shrink-0">🎯</span>;
      case 'pen_awarded':
        return <span className="inline-flex items-center justify-center w-4.5 h-4.5 text-[12px] leading-none shrink-0">🎯</span>;
      case 'pen_miss':
        return <span className="inline-flex items-center justify-center w-4.5 h-4.5 text-[11.5px] leading-none shrink-0">❌</span>;
      case 'yellow':
        return <StatIconBadge kind="yellow" size="xs" />;
      case 'red':
        return <StatIconBadge kind="red" size="xs" />;
      case 'injury':
        return <StatIconBadge kind="injury" size="xs" />;
      case 'var_no_goal':
        return <span className="inline-flex items-center justify-center w-4.5 h-4.5 text-[11.5px] leading-none shrink-0">🖥</span>;
      case 'miracle':
        return <span className="inline-flex items-center justify-center w-4.5 h-4.5 text-[12px] leading-none shrink-0">⚡</span>;
      case 'blessed':
        return <span className="inline-flex items-center justify-center w-4.5 h-4.5 text-[12px] leading-none shrink-0">✨</span>;
      case 'sub':
        return <StatIconBadge kind="subIn" size="xs" title="เปลี่ยนตัว" />;
      case 'miss':
      default:
        return <span className="inline-flex items-center justify-center w-4.5 h-4.5 text-[11.5px] leading-none shrink-0">🥅</span>;
    }
  };

  const labelForKind = (kind: TimelineKind, detail?: string) => {
    if (kind === 'sub') {
      return detail ? `ออก ${detail.split(' ')[0]}` : 'เปลี่ยนตัว';
    }
    if (detail) return detail;
    switch (kind) {
      case 'kickoff':
        return 'เริ่มครึ่งแรก';
      case 'first_half':
        return 'จบครึ่งแรก';
      case 'second_half':
        return 'เริ่มครึ่งหลัง';
      case 'full_time':
        return 'จบเกม';
      case 'goal':
        return 'ประตู';
      case 'own_goal':
        return 'เข้าประตูตัวเอง (OG)';
      case 'pen_goal':
        return 'ประตูจุดโทษ';
      case 'pen_awarded':
        return 'ได้จุดโทษ';
      case 'pen_miss':
        return 'พลาดจุดโทษ';
      case 'yellow':
        return 'ใบเหลือง';
      case 'red':
        return 'ใบแดง';
      case 'injury':
        return 'บาดเจ็บ';
      case 'var_no_goal':
        return 'VAR ริบประตู';
      case 'miracle':
        return 'โหมดปาฏิหาริย์';
      case 'blessed':
        return 'พรเทพ';
      case 'miss':
        return 'ยิงพลาด';
    }
  };

  const sortedTimeline = timelineEvents.slice().sort((a, b) => (b.m - a.m) || (b.seq - a.seq));
  const keyEventCount = sortedTimeline.filter((t) => t.side !== 'N').length;

  return (
    <div className={standalone ? '' : 'border-t border-[var(--line)]'}>
      <div className="px-3 sm:px-3.5 mland:px-2.5 py-1.5 mland:py-1 bg-[var(--surface-2)]/50 border-b border-[var(--line)]/65 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <div className="flex items-center justify-end gap-1.5 min-w-0">
          {homeId === state.me && <MyTeamBadge size="2xs" />}
          <span className="text-[10px] mland:text-[9px] font-bold text-[var(--g)] truncate">เหย้า</span>
          <div className="shrink-0 [&>svg]:w-4 [&>svg]:h-4 mland:[&>svg]:w-3.5 mland:[&>svg]:h-3.5">
            <ClubCrest name={homeOrig.name} size={16} team={homeOrig} club={state.club} isMyClub={homeId === state.me && state.mode === 'm'} />
          </div>
        </div>
        <span className="text-[10px] mland:text-[9px] font-extrabold text-[var(--mut)] tabular whitespace-nowrap">
          ⏱️ ไทม์ไลน์{keyEventCount > 0 ? ` (${keyEventCount})` : ''}
        </span>
        <div className="flex items-center justify-start gap-1.5 min-w-0">
          <div className="shrink-0 [&>svg]:w-4 [&>svg]:h-4 mland:[&>svg]:w-3.5 mland:[&>svg]:h-3.5">
            <ClubCrest name={awayOrig.name} size={16} team={awayOrig} club={state.club} isMyClub={awayId === state.me && state.mode === 'm'} />
          </div>
          <span className="text-[10px] mland:text-[9px] font-bold text-amber-600 dark:text-amber-400 truncate">เยือน</span>
          {awayId === state.me && <MyTeamBadge size="2xs" />}
        </div>
      </div>

      <div className="p-3 sm:p-3.5 mland:p-2 relative">
        <div className="pointer-events-none absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-px bg-[var(--line)]" />

        <div className="space-y-1.5">
          {sortedTimeline.map((item) => {
            if (item.side === 'N') {
              const isFt = item.kind === 'full_time';
              const isHt = item.kind === 'first_half';
              return (
                <div key={item.id} className="relative flex justify-center py-0.5">
                  <div
                    className={`z-10 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] mland:text-[9px] font-extrabold tabular shadow-2xs ${
                      isFt
                        ? 'bg-[var(--g)] border-[var(--g)] text-white'
                        : isHt
                          ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/60 text-[#7a4f00] dark:text-[var(--lamp)]'
                          : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)]'
                    }`}
                  >
                    {iconForKind(item.kind)}
                    <span>{item.m}&apos;</span>
                    <span>·</span>
                    <span>{item.who}</span>
                    {item.detail && (
                      <>
                        <span className="opacity-60">·</span>
                        <span>{item.detail}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            }

            const isHomeSide = item.side === 'H';
            const shortWho = item.who.split(' ')[0] || item.who;
            const isGoal = item.kind === 'goal' || item.kind === 'pen_goal';
            const isNeg = item.kind === 'red' || item.kind === 'injury' || item.kind === 'var_no_goal' || item.kind === 'pen_miss' || item.kind === 'own_goal';
            const titleCls = isGoal
              ? isHomeSide
                ? 'text-[var(--g)] font-extrabold'
                : 'text-amber-600 dark:text-amber-400 font-extrabold'
              : isNeg
                ? 'text-[var(--red)] font-bold'
                : 'text-[var(--ink)] font-bold';
            const subText = labelForKind(item.kind, item.detail);
            const sideTeam = item.kind === 'own_goal' ? (isHomeSide ? awayOrig : homeOrig) : (isHomeSide ? homeOrig : awayOrig);
            const sideId = sideTeam.id;
            const tlPlayer = sideTeam.sq.find((q) => q.n === item.who || q.n.split(' ')[0] === item.who) || null;
            const tlNo = tlPlayer ? getShirtNo(sideTeam, tlPlayer) : null;
            const sideKit = sideId === homeOrig.id ? homeKit : awayKit;
            const sideTrim = sideId === homeOrig.id ? homeTrim : awayTrim;

            return (
              <div key={item.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 text-[10.5px] mland:text-[9.5px] relative">
                <div className={`min-w-0 ${isHomeSide ? 'flex items-center justify-end gap-1.5 text-right pr-1.5 border-r-2 border-[var(--g)]/55' : ''}`}>
                  {isHomeSide && (
                    <>
                      <div className="min-w-0 leading-tight">
                        <div className={`truncate flex items-center justify-end gap-1 ${titleCls}`}>
                          <span className="shrink-0 inline-flex">
                            <ClubCrest name={sideTeam.name} size={13} team={sideTeam} club={state.club} isMyClub={sideId === state.me && state.mode === 'm'} />
                          </span>
                          {tlPlayer && (
                            <MatchPlayerThumb
                              player={tlPlayer}
                              team={sideTeam}
                              state={state}
                              kitColor={tlPlayer.pos === 'GK' ? (sideId === homeOrig.id ? homeGkKit : awayGkKit) : sideKit}
                              trimColor={tlPlayer.pos === 'GK' ? undefined : sideTrim}
                              size="sm"
                            />
                          )}
                          {tlNo != null && (
                            <span className="text-[9.5px] mland:text-[8.5px] font-extrabold text-[#b45309] dark:text-[var(--lamp)] tabular shrink-0">
                              #{tlNo}
                            </span>
                          )}
                          <span className="truncate">{shortWho}</span>
                        </div>
                        <div className="text-[9px] mland:text-[8px] text-[var(--mut)] truncate flex items-center justify-end gap-1">
                          {item.kind === 'sub' && <StatIconBadge kind="subOut" size="xs" />}
                          <span className={`truncate ${item.kind === 'sub' ? 'text-[var(--red)] font-semibold' : ''}`}>{subText}</span>
                        </div>
                      </div>
                      {iconForKind(item.kind)}
                    </>
                  )}
                </div>

                <div
                  className={`z-10 min-w-[30px] h-5 px-1.5 rounded-full border text-[9.5px] mland:text-[8.5px] font-extrabold tabular flex items-center justify-center shadow-2xs ${
                    isGoal
                      ? isHomeSide
                        ? 'bg-[var(--g)] border-[var(--g)] text-white'
                        : 'bg-amber-500 border-amber-500 text-white'
                      : isNeg
                        ? 'bg-[var(--red)] border-[var(--red)] text-white'
                        : item.kind === 'yellow'
                          ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] text-[#8a5b00] dark:text-[var(--lamp)]'
                          : isHomeSide
                            ? 'bg-[var(--surface-2)] border-[var(--g)]/45 text-[var(--ink)]'
                            : 'bg-[var(--surface-2)] border-amber-500/45 text-[var(--ink)]'
                  }`}
                >
                  {item.m}&apos;
                </div>

                <div className={`min-w-0 ${!isHomeSide ? 'flex items-center justify-start gap-1.5 text-left pl-1.5 border-l-2 border-amber-500/55' : ''}`}>
                  {!isHomeSide && (
                    <>
                      {iconForKind(item.kind)}
                      <div className="min-w-0 leading-tight">
                        <div className={`truncate flex items-center gap-1 ${titleCls}`}>
                          <span className="shrink-0 inline-flex">
                            <ClubCrest name={sideTeam.name} size={13} team={sideTeam} club={state.club} isMyClub={sideId === state.me && state.mode === 'm'} />
                          </span>
                          {tlPlayer && (
                            <MatchPlayerThumb
                              player={tlPlayer}
                              team={sideTeam}
                              state={state}
                              kitColor={tlPlayer.pos === 'GK' ? (sideId === homeOrig.id ? homeGkKit : awayGkKit) : sideKit}
                              trimColor={tlPlayer.pos === 'GK' ? undefined : sideTrim}
                              size="sm"
                            />
                          )}
                          {tlNo != null && (
                            <span className="text-[9.5px] mland:text-[8.5px] font-extrabold text-[#b45309] dark:text-[var(--lamp)] tabular shrink-0">
                              #{tlNo}
                            </span>
                          )}
                          <span className="truncate">{shortWho}</span>
                        </div>
                        <div className="text-[9px] mland:text-[8px] text-[var(--mut)] truncate flex items-center gap-1">
                          {item.kind === 'sub' && <StatIconBadge kind="subOut" size="xs" />}
                          <span className={`truncate ${item.kind === 'sub' ? 'text-[var(--red)] font-semibold' : ''}`}>{subText}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface GoalFlashUiState {
  side: 'H' | 'A';
  scorer: string;
  assister?: string;
  minute: number;
  isOwnGoal: boolean;
  isMeScorer: boolean;
  kit: string;
}

export const MatchBroadcastHeader: React.FC<{
  compTitle: string;
  compShortTitle: string;
  matchEnv: MatchEnvironment;
  turfMatchMods: { gradeName: string; effectsSummary: string[] };
  isNeutralVenue: boolean;
  homeFacMods: TeamFacilityMatchModifiers;
  awayFacMods: TeamFacilityMatchModifiers;
  matchAttendance: { att: number; cap: number; pct: number };
  broadcastChannel: BroadcastChannelInfo;
  streamPlanId: string;
  liveViewers: number;
  peakViewers: number;
  homeOrig: Team;
  awayOrig: Team;
  state: GameState;
  gh: number;
  ga: number;
  done: boolean;
  matchPhaseUi?: string;
  paused?: boolean;
  clockLabel?: string;
  stoppageBadge?: number;
  penText?: string;
  goalFlashInfo?: GoalFlashUiState | null;
  onInspectTeam?: (teamId: number) => void;
  rightControls: React.ReactNode;
}> = ({
  compTitle,
  compShortTitle,
  matchEnv,
  turfMatchMods,
  isNeutralVenue,
  homeFacMods,
  awayFacMods,
  matchAttendance,
  broadcastChannel,
  streamPlanId,
  liveViewers,
  peakViewers,
  homeOrig,
  awayOrig,
  state,
  gh,
  ga,
  done,
  matchPhaseUi,
  paused,
  clockLabel = 'FT',
  stoppageBadge = 0,
  penText,
  goalFlashInfo,
  onInspectTeam,
  rightControls
}) => {
  const [showEnvModsPopover, setShowEnvModsPopover] = useState(false);
  const homeId = homeOrig.id;
  const awayId = awayOrig.id;

  return (
    <div className="relative z-20 shrink-0 px-2.5 py-2 sm:px-3.5 sm:py-2 mland:px-2 mland:py-1 bg-[var(--surface-2)] border-b border-[var(--line)]">
      <div className="flex flex-wrap sm:flex-nowrap mland:flex-nowrap items-center justify-between gap-x-2.5 gap-y-1.5">
        <div className="order-1 inline-flex flex-col items-start justify-center xl:flex-row xl:items-center gap-0.5 xl:gap-1.5 px-2 mland:px-1.5 py-1 xl:py-0 min-h-8 sm:min-h-9 mland:min-h-7 xl:h-9 rounded-lg bg-[var(--surface)] border border-[var(--line)] shadow-2xs min-w-0 shrink-0 max-w-[calc(100%-205px)] sm:max-w-[195px] md:max-w-[235px] lg:max-w-[285px] xl:max-w-none">
          <span
            className="text-[10.5px] mland:text-[8.5px] font-extrabold text-[var(--ink)] leading-tight whitespace-normal xl:whitespace-nowrap"
            title={compTitle}
          >
            <span className="md:hidden">{compShortTitle}</span>
            <span className="hidden md:inline">{compTitle}</span>
          </span>
          <span className="hidden xl:inline w-px h-3.5 bg-[var(--line)] shrink-0" />
          <div className="inline-flex items-center gap-1.5 flex-wrap xl:flex-nowrap">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowEnvModsPopover((v) => !v)}
                className={`inline-flex items-center gap-1 text-[10px] mland:text-[8px] font-bold shrink-0 cursor-pointer rounded px-0.5 py-0 transition-colors hover:bg-[var(--surface-2)] ${
                  matchEnv.timeOfDay === 'night'
                    ? matchEnv.season === 'rainy'
                      ? 'text-sky-600 dark:text-sky-300'
                      : 'text-amber-600 dark:text-amber-300'
                    : matchEnv.season === 'rainy'
                      ? 'text-sky-600 dark:text-sky-300'
                      : 'text-amber-700 dark:text-amber-300'
                }`}
                title="ดูผลกระทบสภาพสนามหญ้า & สิ่งอำนวยความสะดวกต่อนักเตะในนัดนี้"
              >
                <span>
                  {matchEnv.timeOfDay === 'night'
                    ? matchEnv.season === 'rainy'
                      ? '🌙💧'
                      : '🌙'
                    : matchEnv.season === 'rainy'
                      ? '💧'
                      : '☀️'}
                </span>
                <span className="hidden xl:inline">
                  {matchEnv.season === 'rainy' ? 'หน้าฝน' : 'หน้าร้อน'} · {matchEnv.timeOfDay === 'night' ? 'กลางคืน' : matchEnv.season === 'summer' ? 'แดดออก' : 'กลางวัน'}
                </span>
              </button>
              {showEnvModsPopover && (
                <div className="absolute left-0 top-full mt-1.5 z-50 w-[305px] sm:w-[360px] rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl p-2.5 text-[10.5px] space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-1">
                    <span className="font-extrabold text-[var(--ink)]">🌱 สภาพพื้นสนาม &amp; โบนัสสิ่งอำนวยความสะดวก</span>
                    <button
                      type="button"
                      onClick={() => setShowEnvModsPopover(false)}
                      className="text-[var(--mut)] hover:text-[var(--ink)] font-bold px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="rounded-lg bg-[var(--surface-2)]/80 border border-[var(--line)]/60 p-1.5 space-y-1">
                    <div className="font-bold text-[10px] text-[var(--ink)] flex items-center justify-between gap-1">
                      <span>{turfMatchMods.gradeName}</span>
                      <span className="text-[var(--mut)] tabular">
                        สภาพ {matchEnv.turfCond}% · หญ้า{matchEnv.grassLength === 'short' ? 'สั้น' : matchEnv.grassLength === 'long' ? 'ยาว' : 'กลาง'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[9.5px]">
                      {turfMatchMods.effectsSummary.map((line, idx) => (
                        <div key={idx} className="text-[var(--mut)] truncate">
                          • {line}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      {
                        title: isNeutralVenue ? `${homeOrig.name} (สนามกลาง)` : `${homeOrig.name} (เหย้า)`,
                        mods: homeFacMods
                      },
                      {
                        title: isNeutralVenue ? `${awayOrig.name} (สนามกลาง)` : `${awayOrig.name} (เยือน)`,
                        mods: awayFacMods
                      }
                    ].map((sideBox, sIdx) => (
                      <div key={sIdx} className="rounded-lg bg-[var(--surface-2)]/60 border border-[var(--line)]/60 p-1.5 space-y-1">
                        <div className="font-bold text-[9.5px] text-[var(--ink)] truncate">{sideBox.title}</div>
                        <div className="space-y-0.5 text-[9px]">
                          {sideBox.mods.breakdown.map((b) => (
                            <div key={b.key} className="flex items-center justify-between gap-1">
                              <span className="text-[var(--mut)] truncate">{b.label}</span>
                              <span
                                className={`font-bold shrink-0 tabular ${
                                  b.tone === 'pos'
                                    ? 'text-[var(--g)]'
                                    : b.tone === 'neg'
                                      ? 'text-[var(--red)]'
                                      : 'text-[var(--mut)]'
                                }`}
                              >
                                {b.deltaText}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="w-px h-3 bg-[var(--line)] shrink-0" />
            <span
              className="inline-flex items-center gap-1 text-[10px] mland:text-[8px] font-bold text-[var(--ink)] tabular shrink-0"
              title={`ผู้ชมเข้าสนามนัดนี้ ${matchAttendance.att.toLocaleString()} / ความจุสนาม ${matchAttendance.cap.toLocaleString()} ที่นั่ง (${matchAttendance.pct}%)`}
            >
              <span className="leading-none shrink-0">🏟</span>
              <span>{matchAttendance.att.toLocaleString()}</span>
              <span className="hidden md:inline mland:hidden text-[var(--mut)] font-normal">/ {matchAttendance.cap.toLocaleString()}</span>
              <span className="text-[var(--g)] font-extrabold">({matchAttendance.pct}%)</span>
            </span>
            <span className="w-px h-3 bg-[var(--line)] shrink-0" />
            <span
              className="inline-flex items-center gap-1 text-[10px] mland:text-[8px] font-bold tabular shrink-0"
              title={
                streamPlanId === 'off'
                  ? `ถ่ายทอดผ่าน ${broadcastChannel.name} (${broadcastChannel.badge}) · กำลังรับชมสด ${liveViewers.toLocaleString()} คน (สูงสุด ${peakViewers.toLocaleString()})`
                  : `ถ่ายทอดสดทาง ${broadcastChannel.name} (${broadcastChannel.badge}) · กำลังรับชมสด ${liveViewers.toLocaleString()} คน (สูงสุด ${peakViewers.toLocaleString()})`
              }
            >
              <span className={`leading-none shrink-0 text-[9px] mland:text-[7.5px] ${streamPlanId === 'off' ? 'opacity-50 grayscale' : ''}`}>🔴</span>
              <span className={streamPlanId === 'off' ? 'text-[var(--mut)]' : 'text-[var(--ink)]'}>
                {liveViewers.toLocaleString()}
              </span>
              <span className="hidden xl:inline text-[var(--mut)] font-medium truncate max-w-[110px]">
                {broadcastChannel.short}
              </span>
            </span>
          </div>
        </div>

        {/* Center Scoreboard */}
        <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1 mland:order-2 mland:w-auto mland:flex-1 min-w-0 flex items-center justify-center gap-2.5 sm:gap-3.5 md:gap-4 mland:gap-2">
          <div className="flex items-center justify-end gap-2 sm:gap-3 mland:gap-2 min-w-0 flex-1">
            <button
              type="button"
              disabled={!onInspectTeam}
              onClick={() => onInspectTeam?.(homeOrig.id)}
              className={`text-right min-w-0 flex-1 ${onInspectTeam ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
            >
              <div className={`font-extrabold text-[15px] sm:text-[17px] md:text-[19px] lg:text-[21px] mland:text-[14px] leading-[1.15] tracking-tight flex items-center justify-end gap-1.5 transition-colors duration-200 ${goalFlashInfo?.side === 'H' ? (goalFlashInfo.isOwnGoal ? 'text-rose-500 dark:text-rose-300' : 'text-[#8a5b00] dark:text-[var(--lamp)]') : homeId === state.me ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                {homeId === state.me && <MyTeamBadge size="md" />}
                <span className="break-words">{homeOrig.name}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-end gap-1 leading-none text-[10px] sm:text-[10.5px] mland:text-[8.5px] font-bold">
                {goalFlashInfo?.side === 'H' && (
                  <span className={`font-black tracking-wide goal-tag-blink ${goalFlashInfo.isOwnGoal ? 'text-rose-500' : 'text-[#a16207] dark:text-[var(--lamp)]'}`}>
                    {goalFlashInfo.isOwnGoal ? '🤦 OG' : '⚽ GOAL!'}
                  </span>
                )}
                {goalFlashInfo?.side === 'H' && <span className="text-[var(--mut)]/50">·</span>}
                <span className="text-[var(--mut)]">เหย้า</span>
              </div>
            </button>
            <button
              type="button"
              disabled={!onInspectTeam}
              onClick={() => onInspectTeam?.(homeOrig.id)}
              className={`shrink-0 rounded-full transition-transform duration-200 [&>svg]:w-10 [&>svg]:h-10 sm:[&>svg]:w-11 sm:[&>svg]:h-11 md:[&>svg]:w-[50px] md:[&>svg]:h-[50px] lg:[&>svg]:w-[54px] lg:[&>svg]:h-[54px] mland:[&>svg]:w-9 mland:[&>svg]:h-9 ${onInspectTeam ? 'cursor-pointer hover:scale-105' : 'cursor-default'} ${goalFlashInfo?.side === 'H' ? (goalFlashInfo.isOwnGoal ? 'ring-2 ring-rose-400 scale-105' : 'ring-2 ring-[var(--lamp)] scale-105') : ''}`}
            >
              <ClubCrest name={homeOrig.name} size={54} team={homeOrig} club={state.club} isMyClub={homeId === state.me && state.mode === 'm'} />
            </button>
          </div>

          <div className="relative flex flex-col items-center justify-center gap-1 mland:gap-0.5 shrink-0">
            <div className="flex items-center justify-center leading-none">
              {done ? (
                <span className="px-2.5 py-0.5 rounded-md bg-[var(--g)] text-white font-extrabold tabular text-[11px] sm:text-xs mland:text-[10px] tracking-wide shadow-2xs">
                  FT
                </span>
              ) : matchPhaseUi === 'halftime' ? (
                <span className="px-2.5 py-0.5 rounded-md bg-[var(--lamp)] text-[#261900] font-extrabold tabular text-[11px] sm:text-xs mland:text-[10px] shadow-2xs">
                  HT
                </span>
              ) : paused ? (
                <span className="px-2 sm:px-2.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[var(--mut)] font-extrabold tabular text-[11px] sm:text-xs mland:text-[10px] shadow-2xs">
                  ⏸ {clockLabel}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 rounded-md bg-[var(--g-soft)] border border-[var(--g)]/35 text-[var(--g)] font-extrabold tabular text-[11px] sm:text-xs mland:text-[10px] shadow-2xs">
                  <span className="w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-full bg-[var(--g)] animate-pulse" />
                  <span>{clockLabel}</span>
                  {stoppageBadge > 0 && <span className="opacity-75">(+{stoppageBadge}&apos;)</span>}
                </span>
              )}
            </div>
            <div
              className={`relative overflow-hidden px-2.5 sm:px-3.5 md:px-4 mland:px-2 py-1 sm:py-1.5 mland:py-0.5 rounded-xl mland:rounded-lg border text-center min-w-[84px] sm:min-w-[106px] md:min-w-[118px] mland:min-w-[74px] transition-colors duration-200 shadow-xs ${
                goalFlashInfo
                  ? goalFlashInfo.isOwnGoal
                    ? 'bg-gradient-to-b from-rose-50 to-rose-100/80 dark:from-[#2c0d17] dark:to-[#1b080e] border-rose-400 ring-2 ring-rose-400/55 goal-board-blink-og'
                    : 'bg-gradient-to-b from-amber-50 to-amber-100/80 dark:from-[#261d06] dark:to-[#181204] border-amber-400 dark:border-[var(--lamp)] ring-2 ring-amber-400/55 dark:ring-[var(--lamp)]/60 goal-board-blink'
                  : 'bg-[var(--surface)] border-[var(--line)]'
              }`}
            >
              {goalFlashInfo && (
                <div
                  key={`sheen-${gh}-${ga}-${goalFlashInfo.minute}`}
                  className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/50 dark:via-white/20 to-transparent goal-sheen-sweep"
                />
              )}
              {goalFlashInfo && (
                <div
                  className="absolute top-1.5 bottom-1.5 w-[3px] rounded-full"
                  style={{
                    backgroundColor: goalFlashInfo.kit || 'var(--lamp)',
                    left: goalFlashInfo.side === 'H' ? 4 : undefined,
                    right: goalFlashInfo.side === 'A' ? 4 : undefined
                  }}
                />
              )}
              <div className="relative z-10 flex items-center justify-center gap-1 sm:gap-1.5 mland:gap-0.5 px-1">
                <span
                  key={goalFlashInfo?.side === 'H' ? `h-${gh}-${goalFlashInfo.minute}` : 'h-static'}
                  className={`inline-flex items-center justify-center min-w-[1.65rem] sm:min-w-[2.1rem] md:min-w-[2.3rem] mland:min-w-[1.35rem] px-1 py-0.5 mland:py-0 rounded-lg mland:rounded-md font-display font-bold tabular text-[24px] sm:text-[29px] md:text-[32px] mland:text-[19px] leading-none transition-colors duration-200 ${
                    goalFlashInfo?.side === 'H'
                      ? goalFlashInfo.isOwnGoal
                        ? 'bg-rose-500 text-white shadow-xs goal-digit-blink'
                        : 'bg-amber-400 text-[#1d1400] shadow-xs ring-1 ring-amber-500/35 goal-digit-blink'
                      : goalFlashInfo
                        ? 'text-[var(--ink)]/75'
                        : 'text-[var(--ink)]'
                  }`}
                >
                  {gh}
                </span>
                <span className="inline-flex items-center justify-center -translate-y-[0.06em] font-display font-bold text-base sm:text-lg mland:text-xs text-[var(--mut)]/55 select-none">
                  :
                </span>
                <span
                  key={goalFlashInfo?.side === 'A' ? `a-${ga}-${goalFlashInfo.minute}` : 'a-static'}
                  className={`inline-flex items-center justify-center min-w-[1.65rem] sm:min-w-[2.1rem] md:min-w-[2.3rem] mland:min-w-[1.35rem] px-1 py-0.5 mland:py-0 rounded-lg mland:rounded-md font-display font-bold tabular text-[24px] sm:text-[29px] md:text-[32px] mland:text-[19px] leading-none transition-colors duration-200 ${
                    goalFlashInfo?.side === 'A'
                      ? goalFlashInfo.isOwnGoal
                        ? 'bg-rose-500 text-white shadow-xs goal-digit-blink'
                        : 'bg-amber-400 text-[#1d1400] shadow-xs ring-1 ring-amber-500/35 goal-digit-blink'
                      : goalFlashInfo
                        ? 'text-[var(--ink)]/75'
                        : 'text-[var(--ink)]'
                  }`}
                >
                  {ga}
                </span>
              </div>
              {penText && (
                <div className="relative z-10 text-[9.5px] sm:text-[10px] mland:text-[8.5px] font-bold text-amber-700 dark:text-[var(--lamp)] mt-0.5 truncate">
                  {penText}
                </div>
              )}
            </div>

            {goalFlashInfo && (
              <div
                key={`ribbon-${gh}-${ga}-${goalFlashInfo.minute}`}
                className={`goal-ribbon-in pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-30 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 mland:py-0.5 rounded-full border shadow-lg whitespace-nowrap ${
                  goalFlashInfo.isOwnGoal
                    ? 'bg-[#2b0e16] border-rose-400/80 text-rose-100'
                    : goalFlashInfo.isMeScorer
                      ? 'bg-[#1f1603] border-[var(--lamp)] text-amber-100'
                      : 'bg-[#0c1b13] border-[var(--lamp)]/75 text-white'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/50"
                  style={{ backgroundColor: goalFlashInfo.kit || '#facc15' }}
                />
                <span className={`text-[10px] sm:text-[11px] mland:text-[8.5px] font-black tracking-wide uppercase ${goalFlashInfo.isOwnGoal ? 'text-rose-300' : 'text-[var(--lamp)]'}`}>
                  {goalFlashInfo.isOwnGoal ? 'OG' : 'GOAL'} {goalFlashInfo.minute}&apos;
                </span>
                <span className="text-[11px] sm:text-xs mland:text-[9px] font-extrabold text-white max-w-[140px] sm:max-w-[190px] truncate">
                  {goalFlashInfo.scorer}
                </span>
                {goalFlashInfo.assister && !goalFlashInfo.isOwnGoal && (
                  <span className="hidden sm:inline mland:hidden text-[10px] text-white/70 font-semibold max-w-[115px] truncate">
                    (👟 {goalFlashInfo.assister.split(' ')[0]})
                  </span>
                )}
                {goalFlashInfo.isMeScorer && (
                  <span className="px-1.5 py-[1px] rounded-full bg-[var(--lamp)] text-[#261900] text-[9px] font-black shrink-0">
                    ★ คุณยิง!
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 mland:gap-2 min-w-0 flex-1">
            <button
              type="button"
              disabled={!onInspectTeam}
              onClick={() => onInspectTeam?.(awayOrig.id)}
              className={`shrink-0 rounded-full transition-transform duration-200 [&>svg]:w-10 [&>svg]:h-10 sm:[&>svg]:w-11 sm:[&>svg]:h-11 md:[&>svg]:w-[50px] md:[&>svg]:h-[50px] lg:[&>svg]:w-[54px] lg:[&>svg]:h-[54px] mland:[&>svg]:w-9 mland:[&>svg]:h-9 ${onInspectTeam ? 'cursor-pointer hover:scale-105' : 'cursor-default'} ${goalFlashInfo?.side === 'A' ? (goalFlashInfo.isOwnGoal ? 'ring-2 ring-rose-400 scale-105' : 'ring-2 ring-[var(--lamp)] scale-105') : ''}`}
            >
              <ClubCrest name={awayOrig.name} size={54} team={awayOrig} club={state.club} isMyClub={awayId === state.me && state.mode === 'm'} />
            </button>
            <button
              type="button"
              disabled={!onInspectTeam}
              onClick={() => onInspectTeam?.(awayOrig.id)}
              className={`text-left min-w-0 flex-1 ${onInspectTeam ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
            >
              <div className={`font-extrabold text-[15px] sm:text-[17px] md:text-[19px] lg:text-[21px] mland:text-[14px] leading-[1.15] tracking-tight flex items-center gap-1.5 transition-colors duration-200 ${goalFlashInfo?.side === 'A' ? (goalFlashInfo.isOwnGoal ? 'text-rose-500 dark:text-rose-300' : 'text-[#8a5b00] dark:text-[var(--lamp)]') : awayId === state.me ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                <span className="break-words">{awayOrig.name}</span>
                {awayId === state.me && <MyTeamBadge size="md" />}
              </div>
              <div className="mt-0.5 flex items-center gap-1 leading-none text-[10px] sm:text-[10.5px] mland:text-[8.5px] font-bold">
                <span className="text-[var(--mut)]">เยือน</span>
                {goalFlashInfo?.side === 'A' && <span className="text-[var(--mut)]/50">·</span>}
                {goalFlashInfo?.side === 'A' && (
                  <span className={`font-black tracking-wide goal-tag-blink ${goalFlashInfo.isOwnGoal ? 'text-rose-500' : 'text-[#a16207] dark:text-[var(--lamp)]'}`}>
                    {goalFlashInfo.isOwnGoal ? '🤦 OG' : '⚽ GOAL!'}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        <div className="order-2 sm:order-3 mland:order-3 flex items-center justify-end gap-1.5 mland:gap-1 shrink-0 ml-auto sm:ml-0 mland:ml-0">
          {rightControls}
        </div>
      </div>
    </div>
  );
};

export interface FullTimeAnalysisSummary {
  xgH: number;
  xgA: number;
  ratings: Record<string, number>;
  motm?: string;
  pf?: PlayerPerfResult;
  playedNames: Record<number, string[]>;
  cards: MatchCardEvent[];
  subs: MatchSubEvent[];
}

export interface ShootoutSummary {
  round?: number;
  hScore: number;
  aScore: number;
  hKicks: ('G' | 'M')[];
  aKicks: ('G' | 'M')[];
  lastMsg?: string;
  kickerName?: string;
  finished?: boolean;
}

export const FullTimeMatchStage: React.FC<{
  state: GameState;
  homeOrig: Team;
  awayOrig: Team;
  liveHome: Team;
  liveAway: Team;
  meTeamOrig: Team;
  homeKit: string;
  awayKit: string;
  homeGkKit: string;
  awayGkKit: string;
  homeTrim: string;
  awayTrim: string;
  initialHomeXi: string[];
  initialAwayXi: string[];
  playedSlots?: Record<number, Record<string, SubRole>>;
  captains: { H: string; A: string };
  gh: number;
  ga: number;
  evs: MatchEvent[];
  matchCards: MatchCardEvent[];
  subLog: MatchSubEvent[];
  matchStats: MatchStatsSummary;
  fullTimeAnalysis: FullTimeAnalysisSummary;
  playerSavesMap: Record<string, number>;
  injuredNames: string[];
  shootoutUi?: ShootoutSummary | null;
  logs: MatchLogItem[];
  timelineEvents: MatchTimelineItem[];
  matchVisualIndex: MatchVisualIndex;
  liveViewers: number;
  peakViewers: number;
  liveComments: ArchivedStreamComment[];
  broadcastChannel: BroadcastChannelInfo;
  streamProj: ReturnType<typeof computeMatchStreamProjection>;
  isDerby: boolean;
  isPlayerMode: boolean;
  myPlayerName: string;
  myPlayerSquadObj?: Player;
  myInitialBanned?: boolean;
  rightTab: 'players' | 'stats' | 'chat';
  onChangeRightTab: (tab: 'players' | 'stats' | 'chat') => void;
  onOpenVarReplay?: (varId: string) => void;
  onInspectPlayer?: (player: Player, team: Team) => void;
}> = ({
  state,
  homeOrig,
  awayOrig,
  liveHome,
  liveAway,
  meTeamOrig,
  homeKit,
  awayKit,
  homeGkKit,
  awayGkKit,
  homeTrim,
  awayTrim,
  initialHomeXi,
  initialAwayXi,
  playedSlots,
  captains,
  gh,
  ga,
  evs,
  matchCards,
  subLog,
  matchStats,
  fullTimeAnalysis,
  playerSavesMap,
  injuredNames,
  shootoutUi,
  logs,
  timelineEvents,
  matchVisualIndex,
  liveViewers,
  peakViewers,
  liveComments,
  broadcastChannel,
  streamProj,
  isDerby,
  isPlayerMode,
  myPlayerName,
  myPlayerSquadObj,
  myInitialBanned = false,
  rightTab,
  onChangeRightTab,
  onOpenVarReplay,
  onInspectPlayer
}) => {
  const [ftPitchMode, setFtPitchMode] = useState<'all' | 'H' | 'A'>(() =>
    homeOrig.id === state.me ? 'H' : awayOrig.id === state.me ? 'A' : 'all'
  );
  const [ftPickedPlayer, setFtPickedPlayer] = useState<string | null>(null);
  const [ftRosterTeam, setFtRosterTeam] = useState<'H' | 'A'>(() =>
    homeOrig.id === state.me ? 'H' : awayOrig.id === state.me ? 'A' : 'H'
  );
  const [eventFilter, setEventFilter] = useState<'all' | 'goal' | 'card' | 'sub'>('all');

  useEffect(() => {
    const myPitchSide: 'all' | 'H' | 'A' =
      homeOrig.id === state.me ? 'H' : awayOrig.id === state.me ? 'A' : 'all';
    const myRosterSide: 'H' | 'A' =
      homeOrig.id === state.me ? 'H' : awayOrig.id === state.me ? 'A' : 'H';
    setFtPitchMode(myPitchSide);
    setFtRosterTeam(myRosterSide);
    setFtPickedPlayer(null);
  }, [homeOrig.id, awayOrig.id, state.me]);

  const leftStageScrollRef = useRef<HTMLDivElement | null>(null);
  const rightStageScrollRef = useRef<HTMLDivElement | null>(null);
  const rightChatScrollRef = useRef<HTMLDivElement | null>(null);
  const ftPlayersScrollRef = useRef<HTMLDivElement | null>(null);

  useScrollTopOnChange(rightStageScrollRef, [rightTab], { includeAncestors: false });
  useScrollTopOnChange(ftPlayersScrollRef, [ftRosterTeam, rightTab], { includeAncestors: false });

  const homeId = homeOrig.id;
  const awayId = awayOrig.id;
  const meIsHome = homeId === state.me;

  const buildFtMeta = (team: Team, xiNames: string[]): Record<string, PitchPlayerMeta> => {
    const out: Record<string, PitchPlayerMeta> = {};
    xiNames.forEach((name) => {
      const rt = fullTimeAnalysis.ratings[name] ?? 6.5;
      const goals = evs.filter((e) => !e.og && e.t === team.id && e.who === name).length;
      const assists = evs.filter((e) => !e.og && e.t === team.id && e.as === name).length;
      const pCards = fullTimeAnalysis.cards.filter((c) => c.t === team.id && c.who === name);
      const isRed = pCards.some((c) => c.type === 'R' || c.type === 'Y2R');
      const yellowCards = !isRed && pCards.some((c) => c.type === 'Y') ? 1 : 0;
      const subOutEv = fullTimeAnalysis.subs.find((s) => s.t === team.id && s.outPlayer === name);
      const isMotm = fullTimeAnalysis.motm === name;
      out[name] = {
        rating: rt,
        goals,
        assists,
        isRed,
        yellowCards,
        isInjured: injuredNames.includes(name),
        subOutMin: subOutEv?.m,
        isMotm
      };
    });
    return out;
  };

  const homeFtMeta = buildFtMeta(liveHome, initialHomeXi);
  const awayFtMeta = buildFtMeta(liveAway, initialAwayXi);

  const pickedInfo = ftPickedPlayer
    ? (() => {
        const t = homeOrig.sq.find((q) => q.n === ftPickedPlayer)
          ? homeOrig
          : awayOrig.sq.find((q) => q.n === ftPickedPlayer)
            ? awayOrig
            : fullTimeAnalysis.playedNames[awayId]?.includes(ftPickedPlayer)
              ? awayOrig
              : homeOrig;
        const p = t.sq.find((q) => q.n === ftPickedPlayer) || null;
        const no = p ? getShirtNo(t, p) : 0;
        const rt = fullTimeAnalysis.ratings[ftPickedPlayer] ?? 6.5;
        const gl = evs.filter((e) => !e.og && e.t === t.id && e.who === ftPickedPlayer).length;
        const as = evs.filter((e) => !e.og && e.t === t.id && e.as === ftPickedPlayer).length;
        const slotRole = playedSlots?.[t.id]?.[ftPickedPlayer];
        const role = p?.ro || slotRole || ((t.id === homeId ? initialHomeXi : initialAwayXi)[0] === ftPickedPlayer ? 'GK' : 'CM');
        const linePos = p?.pos || LINE[role] || 'MF';
        const oppGoals = t.id === homeId ? ga : gh;
        const cleanSheet = oppGoals === 0 && (linePos === 'GK' || linePos === 'DF');
        const saves = playerSavesMap[ftPickedPlayer] || 0;
        const subIn = fullTimeAnalysis.subs.find((s) => s.t === t.id && s.inPlayer === ftPickedPlayer);
        const subOut = fullTimeAnalysis.subs.find((s) => s.t === t.id && s.outPlayer === ftPickedPlayer);
        const cards = fullTimeAnalysis.cards.filter((c) => c.t === t.id && c.who === ftPickedPlayer);
        const isMotm = fullTimeAnalysis.motm === ftPickedPlayer;
        return { name: ftPickedPlayer, team: t, pl: p, role, no, rt, gl, as, cleanSheet, saves, subIn, subOut, cards, isMotm };
      })()
    : null;

  const visibleFtSubs = fullTimeAnalysis.subs.filter(
    (sb) => ftPitchMode === 'all' || (ftPitchMode === 'H' ? sb.t === homeOrig.id : sb.t === awayOrig.id)
  );

  const renderFullTimePlayersPanel = () => {
    const posRank: Record<string, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };
    const sidesToBuild: {
      side: 'H' | 'A';
      team: Team;
      oppGoals: number;
      kit: string;
      gkKit: string;
      trim: string;
      xiList: string[];
      captainName: string;
    }[] = [
      {
        side: 'H',
        team: homeOrig,
        oppGoals: ga,
        kit: homeKit,
        gkKit: homeGkKit,
        trim: homeTrim,
        xiList: initialHomeXi,
        captainName: captains.H
      },
      {
        side: 'A',
        team: awayOrig,
        oppGoals: gh,
        kit: awayKit,
        gkKit: awayGkKit,
        trim: awayTrim,
        xiList: initialAwayXi,
        captainName: captains.A
      }
    ];

    type FtPlayerRow = {
      key: string;
      side: 'H' | 'A';
      team: Team;
      pl: Player | null;
      role: SubRole | null;
      name: string;
      no: number | null;
      rt: number | null;
      didPlay: boolean;
      isStarter: boolean;
      xiIndex: number;
      goals: number;
      ownGoals: number;
      assists: number;
      cleanSheet: boolean;
      saves: number;
      yellowCards: number;
      redCards: number;
      subIn?: MatchSubEvent;
      subOut?: MatchSubEvent;
      isMotm: boolean;
      isInjured: boolean;
      isCaptain: boolean;
      isMe: boolean;
      kit: string;
      gkKit: string;
      trim: string;
    };

    const starterRows: FtPlayerRow[] = [];
    const subRows: FtPlayerRow[] = [];

    sidesToBuild
      .filter((s) => ftRosterTeam === s.side)
      .forEach(({ side, team, oppGoals, kit, gkKit, trim, xiList, captainName }) => {
        const xiSet = new Set(xiList);
        const played = fullTimeAnalysis.playedNames[team.id] || xiList;
        const playedSet = new Set(played);

        const buildRow = (name: string, pl: Player | null, isStarter: boolean, didPlay: boolean, xiIndex: number): FtPlayerRow => {
          const no = pl ? getShirtNo(team, pl) : null;
          const slotRole = playedSlots?.[team.id]?.[name];
          const role = pl?.ro || slotRole || (isStarter && xiIndex === 0 ? 'GK' : null);
          const linePos = pl?.pos || (role ? LINE[role] : undefined);
          const rt = didPlay ? (fullTimeAnalysis.ratings[name] ?? 6.5) : null;
          const goals = didPlay ? evs.filter((e) => !e.og && e.t === team.id && e.who === name).length : 0;
          const ownGoals = didPlay ? evs.filter((e) => e.og && e.t !== team.id && e.who === name).length : 0;
          const assists = didPlay ? evs.filter((e) => !e.og && e.t === team.id && e.as === name).length : 0;
          const cleanSheet = didPlay && oppGoals === 0 && Boolean(linePos === 'GK' || linePos === 'DF');
          const saves = didPlay ? (playerSavesMap[name] || 0) : 0;
          const pCards = didPlay ? fullTimeAnalysis.cards.filter((c) => c.t === team.id && c.who === name) : [];
          const yellowCards = pCards.filter((c) => c.type === 'Y').length;
          const redCards = pCards.filter((c) => c.type === 'R' || c.type === 'Y2R').length;
          const subIn = fullTimeAnalysis.subs.find((s) => s.t === team.id && s.inPlayer === name);
          const subOut = fullTimeAnalysis.subs.find((s) => s.t === team.id && s.outPlayer === name);
          const isMotm = didPlay && fullTimeAnalysis.motm === name;
          const isInjured = didPlay && injuredNames.includes(name);
          const isCaptain = captainName === name;
          const isMe = Boolean(pl?.me || (isPlayerMode && myPlayerName === name));
          return {
            key: `${team.id}-${name}`,
            side,
            team,
            pl,
            role,
            name,
            no,
            rt,
            didPlay,
            isStarter,
            xiIndex,
            goals,
            ownGoals,
            assists,
            cleanSheet,
            saves,
            yellowCards,
            redCards,
            subIn,
            subOut,
            isMotm,
            isInjured,
            isCaptain,
            isMe,
            kit,
            gkKit,
            trim
          };
        };

        xiList.forEach((name, idx) => {
          const pl = team.sq.find((q) => q.n === name) || null;
          starterRows.push(buildRow(name, pl, true, true, idx));
        });

        const subPlayedNames = played.filter((name) => !xiSet.has(name));
        subPlayedNames.forEach((name) => {
          const pl = team.sq.find((q) => q.n === name) || null;
          subRows.push(buildRow(name, pl, false, true, 99));
        });

        const unusedBench = team.sq
          .filter(
            (q) =>
              !xiSet.has(q.n) &&
              !playedSet.has(q.n) &&
              ((q.inj === 0 && (q.sus || 0) === 0) || (isPlayerMode && (q.me || q.n === myPlayerName) && !myInitialBanned))
          )
          .slice()
          .sort((a, b) => (posRank[a.pos] ?? 4) - (posRank[b.pos] ?? 4) || b.ov - a.ov);

        unusedBench.forEach((q) => {
          subRows.push(buildRow(q.n, q, false, false, 199));
        });
      });

    starterRows.sort((a, b) => a.xiIndex - b.xiIndex);
    subRows.sort((a, b) => {
      if (a.didPlay !== b.didPlay) return a.didPlay ? -1 : 1;
      if (a.didPlay && b.didPlay) {
        return (a.subIn?.m ?? 99) - (b.subIn?.m ?? 99) || (b.rt ?? 0) - (a.rt ?? 0);
      }
      const posDiff = (posRank[a.pl?.pos || 'MF'] ?? 4) - (posRank[b.pl?.pos || 'MF'] ?? 4);
      return posDiff || (b.pl?.ov ?? 0) - (a.pl?.ov ?? 0);
    });

    const gridColsCls =
      'grid-cols-[22px_34px_26px_minmax(0,1fr)_64px_34px] mland:grid-cols-[19px_30px_24px_minmax(0,1fr)_56px_28px]';

    const renderPlayerRow = (item: FtPlayerRow) => {
      const isPicked = ftPickedPlayer === item.name;
      const rt = item.rt;
      const rtColorCls = ftRatingTextColor(rt);
      const hasAnyStat =
        item.goals > 0 ||
        item.assists > 0 ||
        item.cleanSheet ||
        item.saves > 0 ||
        item.ownGoals > 0 ||
        item.yellowCards > 0 ||
        item.redCards > 0 ||
        item.isInjured;

      return (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            SFX.tap();
            setFtPickedPlayer((prev) => (prev === item.name ? null : item.name));
            if (ftPitchMode !== 'all') {
              setFtPitchMode(item.side);
            }
          }}
          className={`w-full text-left grid ${gridColsCls} items-center gap-1 mland:gap-0.5 px-2 py-[3.5px] mland:px-1.5 mland:py-[2.5px] transition-colors cursor-pointer ${
            isPicked
              ? 'bg-[var(--g-soft)]/75'
              : item.isMotm
                ? 'bg-amber-400/12 hover:bg-amber-400/18'
                : item.isMe
                  ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/70'
                  : !item.didPlay
                    ? 'opacity-72 hover:opacity-95 hover:bg-[var(--surface-2)]/50'
                    : 'hover:bg-[var(--surface-2)]/65'
          }`}
        >
          {/* 1. รูป */}
          <div className="flex items-center justify-start">
            {item.pl ? (
              <MatchPlayerThumb
                player={item.pl}
                team={item.team}
                state={state}
                kitColor={item.pl.pos === 'GK' ? item.gkKit : item.kit}
                trimColor={item.pl.pos === 'GK' ? undefined : item.trim}
                size="xs"
                ringClassName={item.isMotm ? 'ring-2 ring-amber-400' : undefined}
                isMotm={item.isMotm}
              />
            ) : (
              <span className="w-[20px] h-[21px] rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/60 inline-block" />
            )}
          </div>

          {/* 2. ตำแหน่ง */}
          <div className="flex items-center justify-start">
            {item.role ? <PositionBadge role={item.role} size="2xs" /> : <span className="text-[10px] text-[var(--mut)]">—</span>}
          </div>

          {/* 3. เบอร์ */}
          <div className="text-left text-[10px] mland:text-[8.5px] font-extrabold text-[#b45309] dark:text-[var(--lamp)] tabular whitespace-nowrap">
            {item.no != null ? `#${item.no}` : '—'}
          </div>

          {/* 4. ชื่อ */}
          <div className="flex items-center justify-start gap-1 min-w-0">
            <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate">
              {item.name}
            </span>
            {item.isCaptain && <CaptainBadge team={item.team} state={state} size="xs" className="shrink-0" />}
            {item.isMe && (
              <span
                title="ตัวคุณ"
                aria-label="ตัวคุณ"
                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8px] font-black shrink-0"
              >
                ★
              </span>
            )}
            {item.subOut && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] mland:text-[7.5px] font-bold text-rose-600 dark:text-rose-300 tabular shrink-0"
                title={`ถูกเปลี่ยนตัวออก นาที ${item.subOut.m}'`}
              >
                <StatIconBadge kind="subOut" size="xs" />
                <span>{item.subOut.m}&apos;</span>
              </span>
            )}
            {item.subIn && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] mland:text-[7.5px] font-bold text-emerald-700 dark:text-emerald-300 tabular shrink-0"
                title={`เปลี่ยนตัวลง นาที ${item.subIn.m}'`}
              >
                <StatIconBadge kind="subIn" size="xs" />
                <span>{item.subIn.m}&apos;</span>
              </span>
            )}
            {!item.didPlay && (
              <span className="text-[8.5px] mland:text-[7.5px] text-[var(--mut)] shrink-0">ไม่ได้ลง</span>
            )}
          </div>

          {/* 5. ผลงาน */}
          <div className="flex items-center justify-start flex-wrap gap-0.5 text-[10px] mland:text-[8.5px] tabular">
            {hasAnyStat ? (
              <>
                {item.goals > 0 && <StatIconBadge kind="goal" count={item.goals} size="xs" />}
                {item.assists > 0 && <StatIconBadge kind="assist" count={item.assists} size="xs" />}
                {item.cleanSheet && (
                  <StatIconBadge
                    kind="cleansheet"
                    count={1}
                    size="xs"
                    title={item.saves > 0 ? `คลีนชีต · เซฟ ${item.saves} ครั้ง` : 'คลีนชีต'}
                  />
                )}
                {!item.cleanSheet && item.saves > 0 && (
                  <StatIconBadge kind="save" count={item.saves} size="xs" title={`เซฟ ${item.saves} ครั้ง`} />
                )}
                {item.ownGoals > 0 && (
                  <span className="font-black text-[var(--red)] text-[9.5px]" title={`ทำเข้าประตูตัวเอง ${item.ownGoals} ลูก`}>
                    OG{item.ownGoals > 1 ? item.ownGoals : ''}
                  </span>
                )}
                {item.yellowCards > 0 && <StatIconBadge kind="yellow" count={item.yellowCards} size="xs" />}
                {item.redCards > 0 && <StatIconBadge kind="red" count={item.redCards} size="xs" />}
                {item.isInjured && <StatIconBadge kind="injury" size="xs" />}
              </>
            ) : (
              <span className="text-[var(--mut)]/55">—</span>
            )}
          </div>

          {/* 6. เรตติ้ง */}
          <div className="flex items-center justify-start">
            <span className={`text-[11px] mland:text-[9.5px] font-extrabold tabular leading-none shrink-0 ${rtColorCls}`}>
              {rt != null ? rt.toFixed(1) : '—'}
            </span>
          </div>
        </button>
      );
    };

    const subPlayedCount = subRows.filter((r) => r.didPlay).length;

    return (
      <div className="flex-1 min-h-0 flex flex-col gap-1 mland:gap-0.5 overflow-hidden">
        <div className="flex-1 min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-col overflow-hidden">
          {/* Team Switcher (Separate Home vs Away) */}
          <div className="shrink-0 p-1 mland:p-0.5 bg-[var(--surface-2)]/85 border-b border-[var(--line)] grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setFtRosterTeam('H');
              }}
              className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-[10.5px] mland:text-[9px] font-bold cursor-pointer transition-all min-w-0 ${
                ftRosterTeam === 'H'
                  ? 'bg-[var(--g)] text-white shadow-xs'
                  : 'bg-[var(--surface)]/75 text-[var(--mut)] hover:text-[var(--ink)] border border-[var(--line)]/60'
              }`}
              title={`${homeOrig.name} (เหย้า)`}
            >
              <span className="shrink-0 inline-flex">
                <ClubCrest name={homeOrig.name} size={15} team={homeOrig} club={state.club} isMyClub={homeId === state.me && state.mode === 'm'} />
              </span>
              <span className="truncate">{homeOrig.name}</span>
              {homeId === state.me && <MyTeamBadge size="2xs" />}
              <span className={`text-[9px] mland:text-[7.5px] px-1 rounded tabular shrink-0 ${ftRosterTeam === 'H' ? 'bg-white/20 text-white' : 'bg-black/6 dark:bg-white/10 text-[var(--mut)]'}`}>
                เหย้า
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setFtRosterTeam('A');
              }}
              className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-[10.5px] mland:text-[9px] font-bold cursor-pointer transition-all min-w-0 ${
                ftRosterTeam === 'A'
                  ? 'bg-[var(--g)] text-white shadow-xs'
                  : 'bg-[var(--surface)]/75 text-[var(--mut)] hover:text-[var(--ink)] border border-[var(--line)]/60'
              }`}
              title={`${awayOrig.name} (เยือน)`}
            >
              <span className="shrink-0 inline-flex">
                <ClubCrest name={awayOrig.name} size={15} team={awayOrig} club={state.club} isMyClub={awayId === state.me && state.mode === 'm'} />
              </span>
              <span className="truncate">{awayOrig.name}</span>
              {awayId === state.me && <MyTeamBadge size="2xs" />}
              <span className={`text-[9px] mland:text-[7.5px] px-1 rounded tabular shrink-0 ${ftRosterTeam === 'A' ? 'bg-white/20 text-white' : 'bg-black/6 dark:bg-white/10 text-[var(--mut)]'}`}>
                เยือน
              </span>
            </button>
          </div>

          <div ref={ftPlayersScrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <div
              className="sticky top-0 z-10 px-2.5 py-0.5 mland:px-2 border-b border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--g)]"
              style={{ backgroundColor: 'color-mix(in srgb, var(--g) 15%, var(--surface))' }}
            >
              <span>ตัวจริง</span>
              <span className="tabular">{starterRows.length} คน</span>
            </div>
            <div className="divide-y divide-[var(--line)]/50">
              {starterRows.map(renderPlayerRow)}
            </div>

            {subRows.length > 0 && (
              <>
                <div className="sticky top-0 z-10 px-2.5 py-0.5 mland:px-2 bg-[var(--surface-2)] border-y border-[var(--line)] flex items-center justify-between text-[10px] mland:text-[8.5px] font-extrabold text-[var(--ink)]">
                  <span>ตัวสำรอง</span>
                  <span className="tabular text-[var(--mut)]">
                    ลงสนาม {subPlayedCount} · ทั้งหมด {subRows.length}
                  </span>
                </div>
                <div className="divide-y divide-[var(--line)]/50">
                  {subRows.map(renderPlayerRow)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-[1.68fr_1fr] gap-2.5 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
      {/* Left Stage: Full-Time Pitch Ratings + Penalty Shootout + Events Feed Below */}
      <div ref={leftStageScrollRef} className="space-y-2.5 mland:space-y-2 min-w-0 h-full overflow-y-auto pr-1">
        <div className="rounded-2xl mland:rounded-xl overflow-hidden border border-[var(--line)] bg-[#092818] shadow-xs w-full flex flex-col">
          {/* Full-Time Full-Height SVG Formation Pitch Stage with Inside Logo Switcher */}
          <div className="w-full h-[495px] sm:h-[575px] lg:h-[635px] mland:h-[calc(var(--app-dvh,1dvh)*97-95px)] mland:min-h-[215px] flex items-stretch overflow-hidden bg-[#092818]">
            <div className="relative flex-1 min-w-0 p-1.5 sm:p-2 mland:p-1 select-none overflow-hidden flex items-center justify-center">
              <div className="absolute top-2 left-2 z-20 flex items-center gap-1 p-1 rounded-xl bg-[#05180e]/88 border border-white/25 shadow-lg shrink-0">
                <button
                  type="button"
                  title="แสดงเรตติ้งทั้งสองทีม"
                  aria-label="แสดงเรตติ้งทั้งสองทีม"
                  onClick={() => setFtPitchMode('all')}
                  className={`h-9 sm:h-10 mland:h-8 px-2 sm:px-2.5 mland:px-1.5 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                    ftPitchMode === 'all'
                      ? 'bg-emerald-500 shadow-xs ring-1 ring-white/50'
                      : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                  }`}
                >
                  <span className="inline-flex items-center -space-x-2 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6 mland:[&>svg]:w-4.5 mland:[&>svg]:h-4.5">
                    <ClubCrest name={homeOrig.name} size={24} team={homeOrig} club={state.club} isMyClub={homeOrig.id === state.me && state.mode === 'm'} />
                    <ClubCrest name={awayOrig.name} size={24} team={awayOrig} club={state.club} isMyClub={awayOrig.id === state.me && state.mode === 'm'} />
                  </span>
                </button>
                <button
                  type="button"
                  title={homeOrig.name}
                  aria-label={homeOrig.name}
                  onClick={() => setFtPitchMode('H')}
                  className={`relative h-9 w-9 sm:h-10 sm:w-10 mland:h-8 mland:w-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors [&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-8 sm:[&>svg]:h-8 mland:[&>svg]:w-6 mland:[&>svg]:h-6 ${
                    ftPitchMode === 'H'
                      ? 'bg-emerald-500 shadow-xs ring-1 ring-white/50'
                      : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                  }`}
                >
                  <ClubCrest name={homeOrig.name} size={32} team={homeOrig} club={state.club} isMyClub={homeOrig.id === state.me && state.mode === 'm'} />
                  {homeOrig.id === state.me && <MyTeamBadge size="2xs" className="absolute -top-0.5 -right-0.5 ring-1 ring-[#05180e]" />}
                </button>
                <button
                  type="button"
                  title={awayOrig.name}
                  aria-label={awayOrig.name}
                  onClick={() => setFtPitchMode('A')}
                  className={`relative h-9 w-9 sm:h-10 sm:w-10 mland:h-8 mland:w-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors [&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-8 sm:[&>svg]:h-8 mland:[&>svg]:w-6 mland:[&>svg]:h-6 ${
                    ftPitchMode === 'A'
                      ? 'bg-emerald-500 shadow-xs ring-1 ring-white/50'
                      : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                  }`}
                >
                  <ClubCrest name={awayOrig.name} size={32} team={awayOrig} club={state.club} isMyClub={awayOrig.id === state.me && state.mode === 'm'} />
                  {awayOrig.id === state.me && <MyTeamBadge size="2xs" className="absolute -top-0.5 -right-0.5 ring-1 ring-[#05180e]" />}
                </button>
              </div>

              {pickedInfo && (() => {
                const pkPl = pickedInfo.pl;
                const pkIsHome = pickedInfo.team.id === homeId;
                return (
                  <div className="absolute bottom-2 left-2 right-2 sm:right-auto z-30 sm:max-w-[330px] px-2.5 py-1.5 rounded-xl bg-slate-950/95 border border-white/25 text-white text-[11px] shadow-xl flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold truncate flex items-center gap-1.5">
                        {pkPl && (
                          <MatchPlayerThumb
                            player={pkPl}
                            team={pickedInfo.team}
                            state={state}
                            kitColor={pkIsHome ? (pkPl.pos === 'GK' ? homeGkKit : homeKit) : (pkPl.pos === 'GK' ? awayGkKit : awayKit)}
                            trimColor={pkPl.pos === 'GK' ? undefined : (pkIsHome ? homeTrim : awayTrim)}
                            size="md"
                            dark
                            ringClassName={pickedInfo.isMotm ? 'ring-2 ring-amber-400' : undefined}
                            isMotm={pickedInfo.isMotm}
                          />
                        )}
                        <span className="text-[#facc15] tabular">#{pickedInfo.no}</span>
                        <PositionBadge role={pickedInfo.role} size="2xs" />
                        <span className="truncate">{pickedInfo.name}</span>
                      </div>
                      <div className="text-[10px] text-white/75 flex flex-wrap items-center gap-1.5 tabular mt-0.5">
                        <span>{pickedInfo.team.name}</span>
                        <span className={`font-extrabold ${ftRatingDarkTextColor(pickedInfo.rt)}`}>{pickedInfo.rt.toFixed(1)}</span>
                        {pickedInfo.gl > 0 && <StatIconBadge kind="goal" count={pickedInfo.gl} size="sm" />}
                        {pickedInfo.as > 0 && <StatIconBadge kind="assist" count={pickedInfo.as} size="sm" />}
                        {pickedInfo.cleanSheet && <StatIconBadge kind="cleansheet" count={1} size="xs" title={pickedInfo.saves > 0 ? `คลีนชีต · เซฟ ${pickedInfo.saves} ครั้ง` : 'คลีนชีต'} />}
                        {!pickedInfo.cleanSheet && pickedInfo.saves > 0 && <StatIconBadge kind="save" count={pickedInfo.saves} size="xs" title={`เซฟ ${pickedInfo.saves} ครั้ง`} />}
                        {pickedInfo.cards.map((c, idx) => (
                          <StatIconBadge key={idx} kind={c.type === 'Y' ? 'yellow' : 'red'} size="xs" />
                        ))}
                        {pickedInfo.subOut && <span className="inline-flex items-center gap-0.5 text-rose-300 font-bold"><StatIconBadge kind="subOut" size="xs" />ออก {pickedInfo.subOut.m}&apos;</span>}
                        {pickedInfo.subIn && <span className="inline-flex items-center gap-0.5 text-emerald-300 font-bold"><StatIconBadge kind="subIn" size="xs" />เข้า {pickedInfo.subIn.m}&apos;</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onInspectPlayer && pkPl && (
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onInspectPlayer(pkPl, pickedInfo.team);
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-200 text-[10px] font-bold cursor-pointer whitespace-nowrap"
                          title="ดูโปรไฟล์นักเตะ"
                        >
                          👤 ข้อมูล
                        </button>
                      )}
                      <button type="button" onClick={() => setFtPickedPlayer(null)} className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 font-bold cursor-pointer shrink-0">
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="h-full min-h-0 w-full flex items-center justify-center overflow-hidden">
                {ftPitchMode === 'all' ? (
                  <div className="w-full h-full grid grid-cols-2 gap-2 mland:gap-1.5 items-stretch">
                    <div className="h-full min-h-0 w-full flex items-center justify-center">
                      <FormationPitch
                        team={liveHome}
                        state={state}
                        lineupNames={initialHomeXi}
                        kitOverride={homeKit}
                        gkKitOverride={homeGkKit}
                        trimOverride={homeTrim}
                        matchMeta={homeFtMeta}
                        statMode="rating"
                        showFitBar={false}
                        showPitchCrest={true}
                        selectedPlayerName={ftPickedPlayer}
                        onPlayerClick={(pl) => setFtPickedPlayer((prev) => (prev === pl.n ? null : pl.n))}
                        className="aspect-[300/380] h-full w-auto max-w-full mx-auto rounded-xl block select-none"
                      />
                    </div>
                    <div className="h-full min-h-0 w-full flex items-center justify-center">
                      <FormationPitch
                        team={liveAway}
                        state={state}
                        lineupNames={initialAwayXi}
                        kitOverride={awayKit}
                        gkKitOverride={awayGkKit}
                        trimOverride={awayTrim}
                        matchMeta={awayFtMeta}
                        statMode="rating"
                        showFitBar={false}
                        showPitchCrest={true}
                        selectedPlayerName={ftPickedPlayer}
                        onPlayerClick={(pl) => setFtPickedPlayer((prev) => (prev === pl.n ? null : pl.n))}
                        className="aspect-[300/380] h-full w-auto max-w-full mx-auto rounded-xl block select-none"
                      />
                    </div>
                  </div>
                ) : (
                  <FormationPitch
                    team={ftPitchMode === 'H' ? liveHome : liveAway}
                    state={state}
                    lineupNames={ftPitchMode === 'H' ? initialHomeXi : initialAwayXi}
                    kitOverride={ftPitchMode === 'H' ? homeKit : awayKit}
                    gkKitOverride={ftPitchMode === 'H' ? homeGkKit : awayGkKit}
                    trimOverride={ftPitchMode === 'H' ? homeTrim : awayTrim}
                    matchMeta={ftPitchMode === 'H' ? homeFtMeta : awayFtMeta}
                    statMode="rating"
                    showFitBar={false}
                    showPitchCrest={true}
                    selectedPlayerName={ftPickedPlayer}
                    onPlayerClick={(pl) => setFtPickedPlayer((prev) => (prev === pl.n ? null : pl.n))}
                    className="aspect-[300/380] h-full w-auto max-w-full mx-auto rounded-xl block select-none"
                  />
                )}
              </div>
            </div>
          </div>

          {visibleFtSubs.length > 0 && (
            <div className="bg-[#05180e] border-t border-white/12 px-2.5 py-2 mland:px-2 mland:py-1 text-white">
              <div className="flex flex-nowrap items-stretch gap-2 mland:gap-1.5 overflow-x-auto pb-0.5">
                {visibleFtSubs.map((sb, idx) => {
                  const subTeam = sb.t === homeOrig.id ? homeOrig : awayOrig;
                  const subPl = subTeam.sq.find((q) => q.n === sb.inPlayer);
                  const subNo = subPl ? getShirtNo(subTeam, subPl) : 0;
                  const subRt = fullTimeAnalysis.ratings[sb.inPlayer] ?? 6.5;
                  const isSubMotm = fullTimeAnalysis.motm === sb.inPlayer;
                  const isPicked = ftPickedPlayer === sb.inPlayer;
                  const subGl = evs.filter((e) => !e.og && e.t === subTeam.id && e.who === sb.inPlayer).length;
                  const subAs = evs.filter((e) => !e.og && e.t === subTeam.id && e.as === sb.inPlayer).length;
                  const subCards = fullTimeAnalysis.cards.filter((c) => c.t === subTeam.id && c.who === sb.inPlayer);
                  const subTeamKit = subTeam.id === homeId ? homeKit : awayKit;
                  const subRtColorCls = ftRatingDarkTextColor(subRt);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFtPickedPlayer((prev) => (prev === sb.inPlayer ? null : sb.inPlayer))}
                      className={`shrink-0 inline-flex items-center gap-2 mland:gap-1.5 pl-1.5 pr-2 py-1.5 mland:pl-1 mland:pr-1.5 mland:py-1 rounded-xl border text-left tabular cursor-pointer transition-all whitespace-nowrap ${
                        isSubMotm
                          ? 'bg-[#111418] text-white border-amber-400/80 shadow-md font-extrabold'
                          : isPicked
                            ? 'bg-sky-500/24 border-sky-400 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.35)]'
                            : 'bg-white/7 border-white/14 hover:bg-white/13 hover:border-white/25 text-white/95'
                      }`}
                    >
                      <span
                        className="w-1 self-stretch rounded-full shrink-0"
                        style={{ backgroundColor: isSubMotm ? '#facc15' : subTeamKit }}
                      />
                      {subPl && (
                        <MatchPlayerThumb
                          player={subPl}
                          team={subTeam}
                          state={state}
                          kitColor={subTeam.id === homeId ? (subPl.pos === 'GK' ? homeGkKit : homeKit) : (subPl.pos === 'GK' ? awayGkKit : awayKit)}
                          trimColor={subPl.pos === 'GK' ? undefined : (subTeam.id === homeId ? homeTrim : awayTrim)}
                          size="sm"
                          dark={true}
                          ringClassName={isSubMotm ? 'ring-amber-400' : 'ring-white/25'}
                          isMotm={isSubMotm}
                        />
                      )}
                      <div className="min-w-0 flex flex-col justify-center gap-1 mland:gap-0.5">
                        <div className="flex items-center gap-1 leading-none">
                          {ftPitchMode === 'all' && (
                            <span className="shrink-0 inline-flex">
                              <ClubCrest name={subTeam.name} size={11} team={subTeam} club={state.club} isMyClub={subTeam.id === state.me && state.mode === 'm'} />
                            </span>
                          )}
                          {subPl?.ro && <PositionBadge role={subPl.ro} size="2xs" />}
                          <span className="font-extrabold text-[11px] mland:text-[9px] max-w-[90px] truncate">
                            {sb.inPlayer.split(' ')[0]}
                          </span>
                          <span className="text-[9px] mland:text-[7.5px] font-semibold shrink-0 text-white/55">
                            #{subNo}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] mland:text-[7.5px] leading-none">
                          <span className="inline-flex items-center gap-0.5 font-bold text-emerald-300">
                            <StatIconBadge kind="subIn" size="xs" />
                            <span>{sb.m}&apos;</span>
                          </span>
                          <span
                            className="inline-flex items-center gap-0.5 font-medium text-rose-300/85"
                            title={`เปลี่ยนออก: ${sb.outPlayer}`}
                          >
                            <StatIconBadge kind="subOut" size="xs" />
                            <span className="max-w-[56px] truncate">{sb.outPlayer.split(' ')[0]}</span>
                          </span>
                          {(subGl > 0 || subAs > 0 || subCards.length > 0) && (
                            <span className="inline-flex items-center gap-0.5 shrink-0">
                              {subGl > 0 && <StatIconBadge kind="goal" count={subGl} size="xs" />}
                              {subAs > 0 && <StatIconBadge kind="assist" count={subAs} size="xs" />}
                              {subCards.map((c, cIdx) => (
                                <StatIconBadge key={cIdx} kind={c.type === 'Y' ? 'yellow' : 'red'} size="xs" />
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`ml-0.5 text-[11px] mland:text-[9px] font-black tabular leading-none shrink-0 ${subRtColorCls}`}>
                        {subRt.toFixed(1)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Penalty Shootout Strip */}
        {shootoutUi && (
          <div className="p-2.5 sm:p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--lamp)]/60 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#8a5b00] dark:text-[var(--lamp)]">
                🎯 ดวลจุดโทษตัดสิน{shootoutUi.round != null ? ` (รอบที่ ${shootoutUi.round})` : ''}
              </span>
              <span className="font-bold tabular text-sm">
                {shootoutUi.hScore} - {shootoutUi.aScore}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                <span className="font-bold truncate max-w-[110px]">{homeOrig.name}</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.max(5, shootoutUi.hKicks.length) }).map((_, i) => {
                    const res = shootoutUi.hKicks[i];
                    return (
                      <span
                        key={i}
                        className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          res === 'G' ? 'bg-[var(--g)] text-white' : res === 'M' ? 'bg-[var(--red)] text-white' : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--mut)]'
                        }`}
                      >
                        {res === 'G' ? '✓' : res === 'M' ? '✕' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                <span className="font-bold truncate max-w-[110px]">{awayOrig.name}</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.max(5, shootoutUi.aKicks.length) }).map((_, i) => {
                    const res = shootoutUi.aKicks[i];
                    return (
                      <span
                        key={i}
                        className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          res === 'G' ? 'bg-[var(--g)] text-white' : res === 'M' ? 'bg-[var(--red)] text-white' : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--mut)]'
                        }`}
                      >
                        {res === 'G' ? '✓' : res === 'M' ? '✕' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            {shootoutUi.lastMsg && (
              <div className="text-[11px] text-[var(--mut)] flex items-center justify-between gap-2">
                <span className="truncate">{shootoutUi.lastMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Commentary & Match Events Below the Pitch */}
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden">
          <div className="bg-[var(--surface-2)]/65 border-b border-[var(--line)] px-2.5 py-1.5 sm:px-3 mland:px-2 mland:py-1 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs mland:text-[9.5px] font-extrabold text-[var(--ink)] tracking-tight whitespace-nowrap shrink-0">
              <span>🎙️</span>
              <span>เหตุการณ์</span>
              <span className="hidden xl:inline">ในสนาม</span>
            </span>

            <div className="inline-flex flex-nowrap items-center p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] shadow-2xs gap-0.5 min-w-0 max-w-full overflow-x-auto ml-auto">
              {(
                [
                  ['all', 'ทั้งหมด'],
                  ['goal', '⚽ ประตู'],
                  ['card', '🖥 VAR'],
                  ['sub', `🔄 เปลี่ยน${subLog.length ? ` (${subLog.length})` : ''}`]
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setEventFilter(k)}
                  className={`h-6 mland:h-5.5 px-1.5 sm:px-2 mland:px-1.5 rounded-md text-[10.5px] mland:text-[9px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                    eventFilter === k
                      ? 'bg-[var(--g)] text-white shadow-2xs'
                      : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]/70'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2 sm:p-2.5 mland:p-1.5 space-y-1 mland:space-y-0.5">
            {(eventFilter === 'all' || eventFilter === 'goal') && (() => {
              const sortedGoals = evs.slice().sort((a, b) => a.m - b.m);
              const homeGoals = sortedGoals.filter((e) => e.t === homeOrig.id);
              const awayGoals = sortedGoals.filter((e) => e.t === awayOrig.id);

              const renderSideColumn = (team: Team, sideGoals: typeof sortedGoals, isHomeSide: boolean) => {
                const sideKit = isHomeSide ? homeKit : awayKit;
                const sideGoalCount = isHomeSide ? gh : ga;
                return (
                  <div className="min-w-0 flex flex-col">
                    <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 bg-[var(--surface-2)]/65 border-b border-[var(--line)]/65 flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-1 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: sideKit }}
                        />
                        <span className="shrink-0 inline-flex">
                          <ClubCrest
                            name={team.name}
                            size={13}
                            team={team}
                            club={state.club}
                            isMyClub={team.id === state.me && state.mode === 'm'}
                          />
                        </span>
                        <span className="font-extrabold text-[10.5px] mland:text-[9px] text-[var(--ink)] truncate">
                          {team.name}
                        </span>
                        {team.id === state.me && <MyTeamBadge size="2xs" />}
                      </div>
                      <span
                        className={`text-[10.5px] mland:text-[9px] font-black tabular shrink-0 ${
                          sideGoalCount > 0
                            ? isHomeSide
                              ? 'text-[var(--g)]'
                              : 'text-amber-600 dark:text-amber-400'
                            : 'text-[var(--mut)]'
                        }`}
                      >
                        {sideGoalCount}
                      </span>
                    </div>

                    {sideGoals.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center px-2 py-2.5 mland:py-1.5 text-[10px] mland:text-[8.5px] text-[var(--mut)] text-center">
                        ไม่มีประตู
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--line)]/45">
                        {sideGoals.map((ev, gIdx) => {
                          const scoringTeam = isHomeSide ? homeOrig : awayOrig;
                          const culpritTeam = ev.og ? (isHomeSide ? awayOrig : homeOrig) : scoringTeam;
                          const scorerPl = culpritTeam.sq.find((q) => q.n === ev.who) || null;
                          const scorerNo = scorerPl ? getShirtNo(culpritTeam, scorerPl) : null;
                          const assisterPl = !ev.og && ev.as ? scoringTeam.sq.find((q) => q.n === ev.as) || null : null;
                          const isPenGoal = !ev.og && (ev.style === 'penalty' || ev.style === 'panenka');
                          const isPicked = ftPickedPlayer === ev.who;
                          return (
                            <button
                              key={`${ev.m}-${ev.t}-${ev.who}-${gIdx}`}
                              type="button"
                              onClick={() => {
                                setFtPickedPlayer((prev) => (prev === ev.who ? null : ev.who));
                                if (ftPitchMode !== 'all') {
                                  setFtPitchMode(culpritTeam.id === homeOrig.id ? 'H' : 'A');
                                }
                              }}
                              className={`w-full text-left px-2 py-1 mland:px-1.5 mland:py-0.5 transition-colors flex flex-col gap-0.5 cursor-pointer ${
                                isPicked ? 'bg-[var(--g)]/10' : 'hover:bg-[var(--surface)]/85'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`min-w-[24px] h-4.5 px-1 rounded-md text-[9.5px] mland:text-[8px] font-extrabold tabular inline-flex items-center justify-center shrink-0 ${
                                    ev.og
                                      ? 'bg-rose-500/18 text-rose-600 dark:text-rose-300'
                                      : isHomeSide
                                        ? 'bg-[var(--g)] text-white'
                                        : 'bg-amber-500 text-white'
                                  }`}
                                >
                                  {ev.m}&apos;
                                </span>
                                {scorerPl && (
                                  <MatchPlayerThumb
                                    player={scorerPl}
                                    team={culpritTeam}
                                    state={state}
                                    kitColor={
                                      culpritTeam.id === homeId
                                        ? (scorerPl.pos === 'GK' ? homeGkKit : homeKit)
                                        : (scorerPl.pos === 'GK' ? awayGkKit : awayKit)
                                    }
                                    trimColor={scorerPl.pos === 'GK' ? undefined : (culpritTeam.id === homeId ? homeTrim : awayTrim)}
                                    size="xs"
                                  />
                                )}
                                {scorerPl?.ro && <PositionBadge role={scorerPl.ro} size="2xs" />}
                                <span className="font-bold text-[11px] mland:text-[9.5px] text-[var(--ink)] truncate min-w-0 flex-1">
                                  {ev.who}
                                </span>
                                {scorerNo != null && (
                                  <span className="text-[9.5px] mland:text-[8px] font-extrabold tabular text-[#b45309] dark:text-[var(--lamp)] shrink-0">
                                    #{scorerNo}
                                  </span>
                                )}
                                {ev.og && (
                                  <span
                                    title="ทำเข้าประตูตัวเอง"
                                    className="text-[9px] mland:text-[7.5px] font-black text-rose-600 dark:text-rose-300 shrink-0"
                                  >
                                    OG
                                  </span>
                                )}
                                {isPenGoal && (
                                  <span
                                    title="ประตูจุดโทษ"
                                    className="text-[9.5px] mland:text-[8px] font-extrabold text-amber-700 dark:text-amber-300 shrink-0"
                                  >
                                    🎯
                                  </span>
                                )}
                              </div>
                              {!ev.og && ev.as && (
                                <div
                                  title={`ผู้จ่ายบอล: ${ev.as}`}
                                  className="pl-[30px] mland:pl-[28px] flex items-center gap-1 text-[9.5px] mland:text-[8px] text-[var(--mut)] leading-tight min-w-0"
                                >
                                  <span className="leading-none shrink-0">👟</span>
                                  {assisterPl?.ro && <PositionBadge role={assisterPl.ro} size="2xs" />}
                                  <span className="font-medium text-[var(--ink)]/85 truncate">{ev.as}</span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)] overflow-hidden">
                  <div className="px-2.5 py-1 mland:px-2 mland:py-0.5 bg-[var(--surface-2)] border-b border-[var(--line)]/75 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] mland:text-[9.5px] font-extrabold text-[var(--ink)]">
                      <span>⚽</span>
                      <span>สรุปผู้ทำประตู</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] mland:text-[9px] font-extrabold tabular text-[var(--ink)]">
                      <ClubCrest name={homeOrig.name} size={13} team={homeOrig} club={state.club} isMyClub={homeId === state.me && state.mode === 'm'} />
                      <span>{gh} - {ga}</span>
                      <ClubCrest name={awayOrig.name} size={13} team={awayOrig} club={state.club} isMyClub={awayId === state.me && state.mode === 'm'} />
                    </span>
                  </div>
                  {sortedGoals.length === 0 ? (
                    <div className="px-2.5 py-1.5 mland:px-2 mland:py-1 text-[10.5px] mland:text-[9px] text-[var(--mut)] text-center">
                      ไม่มีประตูในเวลาปกติ ({gh} - {ga})
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 divide-x divide-[var(--line)]/70">
                      {renderSideColumn(homeOrig, homeGoals, true)}
                      {renderSideColumn(awayOrig, awayGoals, false)}
                    </div>
                  )}
                </div>
              );
            })()}

            {eventFilter === 'sub' ? (
              subLog.length === 0 ? (
                <div className="text-xs text-[var(--mut)] py-4 text-center">ยังไม่มีการเปลี่ยนตัวในแมตช์นี้</div>
              ) : (
                subLog
                  .slice()
                  .reverse()
                  .map((sb, i) => {
                    const tObj = sb.t === homeOrig.id ? homeOrig : awayOrig;
                    const matchedLog = logs.find(
                      (l) => l.tone === 'sub' && l.subInfo?.teamId === sb.t && l.subInfo?.inName === sb.inPlayer && l.subInfo?.outName === sb.outPlayer
                    );
                    return (
                      <SubEventCard
                        key={`${sb.t}-${sb.m}-${sb.inPlayer}-${i}`}
                        minute={sb.m}
                        team={tObj}
                        inName={sb.inPlayer}
                        outName={sb.outPlayer}
                        badge={matchedLog?.subInfo?.badge}
                        isInjury={matchedLog?.subInfo?.isInjury}
                        isMeIn={isPlayerMode && sb.inPlayer === myPlayerName}
                        isMeOut={isPlayerMode && sb.outPlayer === myPlayerName}
                        homeId={homeId}
                        homeKit={homeKit}
                        awayKit={awayKit}
                        homeGkKit={homeGkKit}
                        awayGkKit={awayGkKit}
                        homeTrim={homeTrim}
                        awayTrim={awayTrim}
                        state={state}
                      />
                    );
                  })
              )
            ) : (() => {
              const filteredLogs = logs.filter((l) => {
                if (eventFilter === 'goal') return l.tone === 'goal';
                if (eventFilter === 'card') return Boolean(l.varReplayId) || l.tone === 'card' || l.text.includes('VAR') || l.text.includes('จุดโทษ');
                return true;
              });
              if (!filteredLogs.length) {
                return <div className="text-xs text-[var(--mut)] py-4 text-center">ยังไม่มีเหตุการณ์ในหมวดนี้</div>;
              }
              return filteredLogs.map((l) => (
                <MatchLogRow
                  key={l.id}
                  l={l}
                  matchVisualIndex={matchVisualIndex}
                  homeOrig={homeOrig}
                  awayOrig={awayOrig}
                  meTeamOrig={meTeamOrig}
                  homeId={homeId}
                  awayId={awayId}
                  homeKit={homeKit}
                  awayKit={awayKit}
                  homeGkKit={homeGkKit}
                  awayGkKit={awayGkKit}
                  homeTrim={homeTrim}
                  awayTrim={awayTrim}
                  state={state}
                  isPlayerMode={isPlayerMode}
                  myPlayerSquadObj={myPlayerSquadObj}
                  onOpenVarReplay={onOpenVarReplay}
                />
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Right Stage: Players / Stats+Timeline / Live Stream Chat + Career Perf */}
      <div className="space-y-1.5 min-w-0 h-full flex flex-col min-h-0">
        <div className="seg-bar grid w-full shrink-0 grid-cols-3">
          <button
            type="button"
            onClick={() => onChangeRightTab('players')}
            className={`seg-btn w-full whitespace-nowrap ${rightTab === 'players' ? 'seg-btn-active' : ''}`}
          >
            <span>👥 รายชื่อ</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeRightTab('stats')}
            className={`seg-btn w-full whitespace-nowrap ${rightTab === 'stats' ? 'seg-btn-active' : ''}`}
          >
            <span>📊 สถิติ</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeRightTab('chat')}
            className={`seg-btn w-full whitespace-nowrap ${rightTab === 'chat' ? 'seg-btn-active' : ''}`}
          >
            <span>🔴</span>
            <span>ไลฟ์สด</span>
            <span className="tabular font-extrabold text-[9.5px] mland:text-[8.5px] opacity-85">
              {fmtFansShort(liveViewers)}
            </span>
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-1.5">
          {rightTab === 'players' ? (
            renderFullTimePlayersPanel()
          ) : rightTab === 'chat' ? (
            (() => {
              const vTier = getStreamViewerTier(liveViewers);
              const tierMeta = getViewerTierMeta(vTier);
              const myG = meIsHome ? gh : ga;
              const oppG = meIsHome ? ga : gh;
              const totalG = gh + ga;
              const winMul = myG > oppG ? 1.12 : myG === oppG ? 1.0 : 0.92;
              const hypeMul = clamp(1 + totalG * 0.045 + (isDerby ? 0.14 : 0), 0.95, 1.45);
              const estLiveIn =
                state.mode === 'm' && streamProj.plan.id !== 'off'
                  ? Math.max(1, Math.round((streamProj.plan.revBase + (peakViewers / 1000) * streamProj.plan.revPer1k) * winMul * hypeMul))
                  : 0;
              return (
                <div className="flex-1 min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-col overflow-hidden">
                  <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 bg-[var(--surface-2)]/70 border-b border-[var(--line)] space-y-1.5 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`leading-none shrink-0 text-[11px] ${streamProj.plan.id === 'off' ? 'opacity-50 grayscale' : ''}`}>🔴</span>
                        <span className="font-bold text-xs mland:text-[10.5px] truncate text-[var(--ink)]">
                          {broadcastChannel.name}
                        </span>
                      </div>
                      <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] shrink-0">
                        {broadcastChannel.badge}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] mland:text-[9px] tabular">
                      <span className="text-[var(--mut)]">
                        ผู้ชมสด <b className="text-[var(--ink)]">{liveViewers.toLocaleString()}</b> · สูงสุด <b className="text-[var(--ink)]">{peakViewers.toLocaleString()}</b>
                      </span>
                      {state.mode === 'm' && (
                        streamProj.plan.id === 'off' ? (
                          <span className="text-[var(--mut)]">ช่องกลาง ({tierMeta.label})</span>
                        ) : (
                          <span className="font-bold">
                            <span className="text-[var(--g)]">+{fmtMoneyNum(estLiveIn)}</span>
                            <span className="text-[var(--mut)] mx-1">/</span>
                            <span className="text-[var(--red)]">-{fmtMoneyNum(streamProj.plan.totalCost)}</span>
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div ref={rightChatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-2.5 mland:p-2 divide-y divide-[var(--line)]/45">
                    {liveComments.map((cm) => (
                      <div
                        key={cm.id}
                        className={`py-1.5 mland:py-1 text-[11px] mland:text-[9.5px] leading-snug ${
                          cm.kind === 'club'
                            ? 'px-2 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/30 my-0.5'
                            : cm.donateBaht
                              ? 'px-2 rounded-lg bg-[#facc15]/15 border border-[#facc15]/40 my-0.5'
                              : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`font-bold truncate ${
                            cm.kind === 'club'
                              ? 'text-[var(--g)]'
                              : cm.kind === 'goal'
                                ? 'text-[var(--g)]'
                                : cm.kind === 'var' || cm.kind === 'card'
                                  ? 'text-[var(--red)]'
                                  : 'text-[var(--ink)]'
                          }`}>
                            {cm.user}
                          </span>
                          <span className="inline-flex items-center gap-1.5 shrink-0 tabular">
                            {cm.donateBaht && (
                              <span className="font-extrabold text-[#9a6700] dark:text-[var(--lamp)] text-[10px]">
                                💎 {cm.donateBaht.toLocaleString()}฿
                              </span>
                            )}
                            <span className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">{cm.m}&apos;</span>
                          </span>
                        </div>
                        <div className="text-[var(--mut)] mt-0.5 break-words">
                          <span className={cm.kind === 'goal' || cm.donateBaht || cm.kind === 'club' ? 'text-[var(--ink)] font-medium' : ''}>
                            {cm.text}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          ) : (
            <div ref={rightStageScrollRef} className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-1.5">
              <button
                type="button"
                onClick={() => onChangeRightTab('chat')}
                className="w-full text-left rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)]/60 transition-colors px-3 py-2 mland:px-2.5 mland:py-1.5 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[9px]">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[var(--ink)] min-w-0">
                    <span className={`leading-none shrink-0 text-[10px] ${streamProj.plan.id === 'off' ? 'opacity-50 grayscale' : ''}`}>🔴</span>
                    <span className="truncate">{broadcastChannel.short}: <b className="tabular">{liveViewers.toLocaleString()}</b> คนดู</span>
                    <span className="text-[var(--mut)] font-medium hidden sm:inline shrink-0">({getViewerTierMeta(getStreamViewerTier(liveViewers)).label})</span>
                  </span>
                  <span className="font-bold text-[var(--g)] shrink-0">ดูแชท →</span>
                </div>
                {liveComments[0] && (
                  <div className="mt-1 text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate">
                    <b className="text-[var(--ink)]">{liveComments[0].user}:</b>{' '}
                    {liveComments[0].donateBaht ? `💎 ${liveComments[0].donateBaht}฿ ` : ''}
                    {liveComments[0].text}
                  </div>
                )}
              </button>

              <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden">
                <MatchStatsPanel
                  homeOrig={homeOrig}
                  awayOrig={awayOrig}
                  state={state}
                  matchStats={matchStats}
                  matchCards={matchCards}
                />
                <MatchTimelinePanel
                  timelineEvents={timelineEvents}
                  homeOrig={homeOrig}
                  awayOrig={awayOrig}
                  state={state}
                  homeKit={homeKit}
                  awayKit={awayKit}
                  homeGkKit={homeGkKit}
                  awayGkKit={awayGkKit}
                  homeTrim={homeTrim}
                  awayTrim={awayTrim}
                />
              </div>
            </div>
          )}

          {fullTimeAnalysis.pf && (
            <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[11px] shrink-0">
              {fullTimeAnalysis.pf.played === false ? (
                <span className="font-semibold text-[var(--mut)]">
                  {myInitialBanned ? '🟥 ไม่ได้ลงสนาม (ติดโทษแบน)' : '🪑 ตัวสำรองไม่ได้ถูกส่งลงสนาม (0 นาที)'}
                </span>
              ) : (
                <>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>ฟอร์มคุณ ({fullTimeAnalysis.pf.mins} น.): <b>⭐ {fullTimeAnalysis.pf.rt.toFixed(1)}</b> ·</span>
                    <span className="inline-flex items-center gap-1 tabular font-extrabold">
                      <span>{fullTimeAnalysis.pf.gl}</span>
                      <StatIconBadge kind="goal" count={1} size="sm" title={`ทำประตู ${fullTimeAnalysis.pf.gl} ลูก`} />
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 tabular font-extrabold">
                      <span>{fullTimeAnalysis.pf.as}</span>
                      <StatIconBadge kind="assist" count={1} size="sm" title={`แอสซิสต์ ${fullTimeAnalysis.pf.as} ครั้ง`} />
                    </span>
                    {fullTimeAnalysis.pf.subIn && <span className="inline-flex items-center gap-0.5">· <StatIconBadge kind="subIn" size="xs" /> สำรอง</span>}
                    {fullTimeAnalysis.pf.subOut && <span className="inline-flex items-center gap-0.5">· <StatIconBadge kind="subOut" size="xs" /> เปลี่ยนออก</span>}
                    {(fullTimeAnalysis.pf.yc || 0) > 0 && <StatIconBadge kind="yellow" count={fullTimeAnalysis.pf.yc} size="xs" />}
                    {(fullTimeAnalysis.pf.rc || 0) > 0 && <StatIconBadge kind="red" count={fullTimeAnalysis.pf.rc} size="xs" />}
                    {fullTimeAnalysis.pf.motm && <span className="font-bold text-[#9a6700] dark:text-[var(--lamp)]">· 🏆 MoM</span>}
                  </span>
                  <span className="inline-flex items-center gap-2 tabular">
                    {(fullTimeAnalysis.pf.repGain ?? 0) > 0 && (
                      <span className="font-bold text-[#9a6700] dark:text-[var(--lamp)]">+{fullTimeAnalysis.pf.repGain} ★ ชื่อเสียง</span>
                    )}
                    {fullTimeAnalysis.pf.pts > 0 && (
                      <span className="font-bold text-[var(--g)]">+{fullTimeAnalysis.pf.pts} แต้มพัฒนา!</span>
                    )}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
