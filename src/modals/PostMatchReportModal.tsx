import React, { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type {
  ArchivedMatchLog,
  ArchivedMatchReport,
  GameState,
  Player,
  Team,
  VarReplayRecord
} from '../types/game';
import { clamp } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, matchKits, visOf, xi } from '../engine/playerCore';
import { computePlayerRatings } from '../engine/simulation';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { PositionBadge } from '../components/PositionBadge';
import { useScrollTopOnChange } from '../utils/scrollReset';

interface PostMatchReportModalProps {
  report: ArchivedMatchReport;
  title?: string;
  state: GameState;
  onClose: () => void;
  onOpenVarReplay: (homeId: number, awayId: number, records: VarReplayRecord[], activeId?: string) => void;
  onInspectTeam?: (teamId: number) => void;
}

const PlayerReportAvatar: React.FC<{
  player: Player;
  team: Team;
  state: GameState;
  kitColor: string;
  trimColor?: string;
  isMotm?: boolean;
}> = ({ player, team, state, kitColor, trimColor, isMotm }) => {
  const isUser = Boolean(player.me || (state.mode === 'p' && state.p?.name === player.n));
  const vis = useMemo(() => visOf(player, state.p), [player, state.p]);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 w-7 h-7 border border-black/20 ${
        isMotm ? 'ring-2 ring-amber-400' : isUser ? 'ring-1 ring-[#facc15]' : ''
      }`}
      style={{ backgroundColor: kitColor }}
    >
      <PlayerFace
        vis={vis}
        size={28}
        kitColor={kitColor}
        trimColor={trimColor}
        isGk={player.pos === 'GK'}
        noBg
      />
    </span>
  );
};

export const PostMatchReportModal: React.FC<PostMatchReportModalProps> = ({
  report,
  title,
  state,
  onClose,
  onOpenVarReplay,
  onInspectTeam
}) => {
  const [tab, setTab] = useState<'players' | 'stats' | 'events'>('players');
  const [rosterTeam, setRosterTeam] = useState<'all' | 'H' | 'A'>('all');
  const [eventFilter, setEventFilter] = useState<'all' | 'goal' | 'card' | 'sub'>('all');

  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  useScrollTopOnChange(bodyScrollRef, [tab, rosterTeam, eventFilter], { includeAncestors: false });

  const hTeam = state.teams[report.h];
  const aTeam = state.teams[report.a];

  const [homeKit, awayKit, homeTrim, awayTrim] = useMemo(() => {
    if (!hTeam || !aTeam) return ['#15803d', '#2563eb', '#facc15', '#ffffff'];
    return matchKits(hTeam, aTeam, state);
  }, [hTeam, aTeam, state]);

  const evs = useMemo(() => report.evs || [], [report.evs]);
  const cards = useMemo(() => report.cards || [], [report.cards]);
  const subs = useMemo(() => report.subs || [], [report.subs]);
  const varReplays = useMemo(() => report.varReplays || [], [report.varReplays]);

  const varById = useMemo(() => {
    const m = new Map<string, VarReplayRecord>();
    varReplays.forEach((v) => m.set(v.id, v));
    return m;
  }, [varReplays]);

  // Compute fallback ratings / MOTM for legacy or lightweight archived matches
  const resolvedRatingsAndMotm = useMemo(() => {
    if (!hTeam || !aTeam) {
      return { ratings: report.ratings || {}, motm: report.motm };
    }
    if (report.ratings && Object.keys(report.ratings).length > 0) {
      let motm = report.motm;
      if (!motm) {
        let bestN = '';
        let bestV = -1;
        Object.entries(report.ratings).forEach(([n, v]) => {
          if (v > bestV) {
            bestV = v;
            bestN = n;
          }
        });
        motm = bestN || undefined;
      }
      return { ratings: report.ratings, motm };
    }
    const { ratings, motm } = computePlayerRatings(
      hTeam,
      aTeam,
      {
        gh: report.gh,
        ga: report.ga,
        evs,
        xgH: report.xgH ?? 1.1,
        xgA: report.xgA ?? 1.0,
        cards,
        subs,
        playedNames: report.playedNames
      },
      state.p
    );
    return { ratings, motm: report.motm || motm };
  }, [hTeam, aTeam, report, evs, cards, subs, state.p]);

  const playerEntries = useMemo(() => {
    if (!hTeam || !aTeam) return [];
    const sides: { side: 'H' | 'A'; team: Team; oppGoals: number; kit: string; trim: string }[] = [
      { side: 'H', team: hTeam, oppGoals: report.ga, kit: homeKit, trim: homeTrim },
      { side: 'A', team: aTeam, oppGoals: report.gh, kit: awayKit, trim: awayTrim }
    ];

    return sides
      .filter((s) => rosterTeam === 'all' || rosterTeam === s.side)
      .flatMap(({ side, team, oppGoals, kit, trim }) => {
        const storedNames = report.playedNames?.[team.id];
        const namesSet = new Set<string>(storedNames && storedNames.length ? storedNames : xi(team).map((q) => q.n));
        // Ensure scorers, assisters, card recipients, and subs appear even if legacy record omitted playedNames
        evs.forEach((e) => {
          if (e.t === team.id && !e.og && e.who) namesSet.add(e.who);
          if (e.t === team.id && !e.og && e.as) namesSet.add(e.as);
          if (e.t !== team.id && e.og && e.who) namesSet.add(e.who);
        });
        cards.forEach((c) => {
          if (c.t === team.id && c.who) namesSet.add(c.who);
        });
        subs.forEach((sb) => {
          if (sb.t === team.id) {
            if (sb.inPlayer) namesSet.add(sb.inPlayer);
            if (sb.outPlayer) namesSet.add(sb.outPlayer);
          }
        });

        return Array.from(namesSet).map((name) => {
          const pl = team.sq.find((q) => q.n === name) || null;
          const no = pl ? getShirtNo(team, pl) : null;
          const rt = resolvedRatingsAndMotm.ratings[name] ?? 6.5;
          const goals = evs.filter((e) => !e.og && e.t === team.id && e.who === name).length;
          const ownGoals = evs.filter((e) => e.og && e.t !== team.id && e.who === name).length;
          const assists = evs.filter((e) => !e.og && e.t === team.id && e.as === name).length;
          const cleanSheet = oppGoals === 0 && Boolean(pl && (pl.pos === 'GK' || pl.pos === 'DF'));
          const pCards = cards.filter((c) => c.t === team.id && c.who === name);
          const yellowCards = pCards.filter((c) => c.type === 'Y').length;
          const redCards = pCards.filter((c) => c.type === 'R' || c.type === 'Y2R').length;
          const subIn = subs.find((s) => s.t === team.id && s.inPlayer === name);
          const subOut = subs.find((s) => s.t === team.id && s.outPlayer === name);
          const isMotm = resolvedRatingsAndMotm.motm === name;
          const impactScore =
            (isMotm ? 10000 : 0) +
            goals * 500 +
            assists * 350 +
            (cleanSheet ? 180 : 0) +
            (yellowCards + redCards * 2) * 14 +
            (subIn ? 10 : 0) +
            rt * 10;

          return {
            key: `${team.id}-${name}`,
            side,
            team,
            pl,
            name,
            no,
            rt,
            goals,
            ownGoals,
            assists,
            cleanSheet,
            yellowCards,
            redCards,
            subIn,
            subOut,
            isMotm,
            kit,
            trim,
            impactScore
          };
        });
      })
      .sort((u, v) => v.impactScore - u.impactScore || v.rt - u.rt);
  }, [hTeam, aTeam, rosterTeam, report, homeKit, awayKit, homeTrim, awayTrim, evs, cards, subs, resolvedRatingsAndMotm]);

  // Build unified event feed (prefer archived live logs; fallback to synthesized chronological events)
  const resolvedLogs: ArchivedMatchLog[] = useMemo(() => {
    if (!hTeam || !aTeam) return [];
    if (report.logs && report.logs.length > 0) {
      return report.logs;
    }

    const items: ArchivedMatchLog[] = [];
    const matchedVarIds = new Set<string>();

    items.push({
      m: 90,
      text: report.penText
        ? `🏁 จบเกม! ${hTeam.name} ${report.gh}-${report.ga} ${aTeam.name} (${report.penText})`
        : `🏁 จบเกม! ${hTeam.name} ${report.gh}-${report.ga} ${aTeam.name}`,
      tone: 'sys'
    });

    evs.forEach((ev) => {
      const scTeam = ev.t === hTeam.id ? hTeam.name : aTeam.name;
      const linkedVar = varReplays.find(
        (v) =>
          !matchedVarIds.has(v.id) &&
          Math.abs(v.minute - ev.m) <= 1 &&
          v.verdictTone === 'goal' &&
          (!v.varState.shooterId || v.varState.shooterId === ev.who)
      );
      if (linkedVar) matchedVarIds.add(linkedVar.id);
      const txt = ev.og
        ? `🤦 นาที ${ev.m}': ${ev.who} สกัดเข้าประตูตัวเอง (${scTeam} ได้ประตู)`
        : ev.as
          ? `⚽ นาที ${ev.m}': โกล!! ${ev.who} (${scTeam}) ซัดประตู (👟 ${ev.as})`
          : `⚽ นาที ${ev.m}': โกล!! ${ev.who} (${scTeam}) ยิงประตู!`;
      items.push({
        m: ev.m,
        text: txt,
        tone: 'goal',
        ...(linkedVar ? { varReplayId: linkedVar.id } : {})
      });
    });

    cards.forEach((c) => {
      const tmName = c.t === hTeam.id ? hTeam.name : aTeam.name;
      const linkedVar = varReplays.find(
        (v) =>
          !matchedVarIds.has(v.id) &&
          Math.abs(v.minute - c.m) <= 1 &&
          (v.verdictTone === 'red' || v.verdictTone === 'yellow' || v.verdictTone === 'penalty')
      );
      if (linkedVar) matchedVarIds.add(linkedVar.id);
      const cardLbl = c.type === 'Y' ? '🟨 ใบเหลือง' : c.type === 'Y2R' ? '🟨➡🟥 เหลืองแดง' : '🟥 ใบแดง';
      items.push({
        m: c.m,
        text: `${cardLbl} นาที ${c.m}': ${c.who} (${tmName})${c.reason ? ` — ${c.reason}` : ''}`,
        tone: 'card',
        ...(linkedVar ? { varReplayId: linkedVar.id } : {})
      });
    });

    // Any remaining VAR events (e.g., overturned goals / overturned penalties)
    varReplays.forEach((vr) => {
      if (matchedVarIds.has(vr.id)) return;
      items.push({
        m: vr.minute,
        text: `🖥 ${vr.verdictLabel} — ${vr.varState.reasonText}`,
        tone: vr.verdictTone === 'goal' ? 'goal' : 'card',
        varReplayId: vr.id
      });
    });

    subs.forEach((sb) => {
      const tmName = sb.t === hTeam.id ? hTeam.name : aTeam.name;
      items.push({
        m: sb.m,
        text: `🔄 นาที ${sb.m}' เปลี่ยนตัว (${tmName}): 🔼 เข้า ${sb.inPlayer} · 🔽 ออก ${sb.outPlayer}`,
        tone: 'sub',
        subInfo: {
          teamId: sb.t,
          inName: sb.inPlayer,
          outName: sb.outPlayer
        }
      });
    });

    items.push({
      m: 0,
      text: `📣 กรรมการเป่านกหวีดเริ่มเกม! ${hTeam.name} พบ ${aTeam.name}`,
      tone: 'sys'
    });

    return items.sort((u, v) => v.m - u.m);
  }, [hTeam, aTeam, report, evs, cards, subs, varReplays]);

  const filteredLogs = useMemo(() => {
    return resolvedLogs.filter((l) => {
      if (eventFilter === 'goal') return l.tone === 'goal';
      if (eventFilter === 'card') {
        return Boolean(l.varReplayId) || l.tone === 'card' || l.text.includes('VAR') || l.text.includes('จุดโทษ');
      }
      if (eventFilter === 'sub') return l.tone === 'sub' || Boolean(l.subInfo);
      return true;
    });
  }, [resolvedLogs, eventFilter]);

  if (!hTeam || !aTeam) return null;

  const yH = cards.filter((c) => c.t === hTeam.id && c.type === 'Y').length;
  const yA = cards.filter((c) => c.t === aTeam.id && c.type === 'Y').length;
  const rH = cards.filter((c) => c.t === hTeam.id && (c.type === 'R' || c.type === 'Y2R')).length;
  const rA = cards.filter((c) => c.t === aTeam.id && (c.type === 'R' || c.type === 'Y2R')).length;

  const xgH = Number((report.xgH ?? Math.max(0.25, report.gh * 0.78 + 0.42)).toFixed(2));
  const xgA = Number((report.xgA ?? Math.max(0.25, report.ga * 0.78 + 0.38)).toFixed(2));
  const possH = clamp(
    report.possH ?? Math.round(50 + clamp((xgH - xgA) * 7, -14, 14)),
    30,
    70
  );
  const shotsH = report.shotsH ?? Math.max(report.gh + 1, Math.round(xgH * 5.6 + 2));
  const shotsA = report.shotsA ?? Math.max(report.ga + 1, Math.round(xgA * 5.6 + 2));
  const onTargetH = report.onTargetH ?? clamp(Math.max(report.gh, Math.round(shotsH * 0.45)), report.gh, shotsH);
  const onTargetA = report.onTargetA ?? clamp(Math.max(report.ga, Math.round(shotsA * 0.45)), report.ga, shotsA);
  const passesH = report.passesH ?? Math.round(possH * 6.8);
  const passesA = report.passesA ?? Math.round((100 - possH) * 6.8);

  const motmName = resolvedRatingsAndMotm.motm;
  const motmTeam = motmName
    ? hTeam.sq.some((q) => q.n === motmName)
      ? hTeam
      : aTeam.sq.some((q) => q.n === motmName)
        ? aTeam
        : null
    : null;
  const motmPlayer = motmName && motmTeam ? motmTeam.sq.find((q) => q.n === motmName) || null : null;
  const motmNo = motmTeam && motmPlayer ? getShirtNo(motmTeam, motmPlayer) : null;
  const motmRt = motmName ? resolvedRatingsAndMotm.ratings[motmName] ?? 7.4 : 0;
  const motmGl = motmName && motmTeam ? evs.filter((e) => !e.og && e.t === motmTeam.id && e.who === motmName).length : 0;
  const motmAs = motmName && motmTeam ? evs.filter((e) => !e.og && e.t === motmTeam.id && e.as === motmName).length : 0;

  const sortedGoals = evs.slice().sort((a, b) => a.m - b.m);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="รายงานหลังเกม"
    >
      <div className="w-full max-w-3xl max-h-[92vh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden">
        {/* Match Header */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-[var(--surface-2)] border-b border-[var(--line)] shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-[var(--g-soft)] border border-[var(--g)]/35 text-[var(--g)] text-[10px] font-extrabold shrink-0">
                📊 หลังเกม
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-[var(--ink)] truncate">
                {title || 'สรุปผลการแข่งขัน'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              aria-label="ปิดหน้าต่าง"
              className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--ink)]/40 text-[var(--ink)] inline-flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onInspectTeam?.(hTeam.id)}
              className={`flex-1 min-w-0 flex items-center justify-end gap-2 text-right ${onInspectTeam ? 'cursor-pointer hover:text-[var(--g)]' : 'cursor-default'}`}
            >
              <span className={`text-xs sm:text-sm truncate ${report.gh > report.ga || hTeam.id === state.me ? 'font-extrabold text-[var(--ink)]' : 'font-semibold text-[var(--ink)]/85'}`}>
                {hTeam.name}
              </span>
              <div className="shrink-0">
                <ClubCrest name={hTeam.name} size={28} team={hTeam} club={state.club} isMyClub={hTeam.id === state.me && state.mode === 'm'} />
              </div>
            </button>

            <div className="px-3 py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-center shrink-0">
              <div className="text-lg sm:text-xl font-black tabular tracking-tight text-[var(--ink)] leading-none">
                {report.gh} - {report.ga}
              </div>
              {report.penText && (
                <div className="text-[9.5px] font-bold text-[#9a6700] dark:text-[var(--lamp)] mt-0.5 whitespace-nowrap">
                  {report.penText}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onInspectTeam?.(aTeam.id)}
              className={`flex-1 min-w-0 flex items-center justify-start gap-2 text-left ${onInspectTeam ? 'cursor-pointer hover:text-[var(--g)]' : 'cursor-default'}`}
            >
              <div className="shrink-0">
                <ClubCrest name={aTeam.name} size={28} team={aTeam} club={state.club} isMyClub={aTeam.id === state.me && state.mode === 'm'} />
              </div>
              <span className={`text-xs sm:text-sm truncate ${report.ga > report.gh || aTeam.id === state.me ? 'font-extrabold text-[var(--ink)]' : 'font-semibold text-[var(--ink)]/85'}`}>
                {aTeam.name}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="seg-bar grid grid-cols-3 w-full sm:w-auto sm:min-w-[300px]">
              {(
                [
                  ['players', '👥 รายชื่อ'],
                  ['stats', '📊 สถิติ'],
                  ['events', `🎙️ เหตุการณ์${varReplays.length ? ` · VAR (${varReplays.length})` : ''}`]
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setTab(k);
                  }}
                  className={`seg-btn whitespace-nowrap ${tab === k ? 'seg-btn-active' : ''}`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {report.att && report.att > 0 && (
              <span className="text-[10.5px] font-semibold text-[var(--mut)] tabular">
                🏟️ ผู้ชม {report.att.toLocaleString()} คน
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div ref={bodyScrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
          {tab === 'players' && (
            <>
              {/* MOTM Card */}
              {motmName && motmTeam && (
                <div className="rounded-xl overflow-hidden border border-amber-400/50 bg-gradient-to-r from-amber-400/16 via-amber-300/8 to-[var(--surface-2)]/70 px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {motmPlayer && (
                      <div className="relative shrink-0">
                        <PlayerReportAvatar
                          player={motmPlayer}
                          team={motmTeam}
                          state={state}
                          kitColor={motmTeam.id === hTeam.id ? homeKit : awayKit}
                          trimColor={motmTeam.id === hTeam.id ? homeTrim : awayTrim}
                          isMotm
                        />
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-[#1c1300] text-[9px] flex items-center justify-center shadow">
                          👑
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-[1px] rounded bg-amber-400 text-[#1c1300] text-[9px] font-black shrink-0">
                          MOTM
                        </span>
                        {motmPlayer?.ro && <PositionBadge role={motmPlayer.ro} size="2xs" />}
                        <span className="text-xs font-extrabold text-[var(--ink)] truncate">{motmName}</span>
                        {motmNo != null && (
                          <span className="text-[10px] font-extrabold tabular text-[#b45309] dark:text-[var(--lamp)] shrink-0">
                            #{motmNo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[var(--mut)] truncate">
                        <ClubCrest name={motmTeam.name} size={12} team={motmTeam} club={state.club} isMyClub={motmTeam.id === state.me && state.mode === 'm'} />
                        <span className="truncate font-semibold">{motmTeam.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 tabular">
                    {motmGl > 0 && <StatIconBadge kind="goal" count={motmGl} size="xs" />}
                    {motmAs > 0 && <StatIconBadge kind="assist" count={motmAs} size="xs" />}
                    <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-[#1c1300] text-[11px] font-black shadow-2xs">
                      ⭐ {motmRt.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}

              {/* Goal Scorers Summary */}
              <div className="rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] overflow-hidden">
                <div className="px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)]/75 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--ink)]">
                    <span>⚽</span>
                    <span>สรุปผู้ทำประตู</span>
                  </span>
                  <span className="text-[11px] font-extrabold tabular text-[var(--ink)]">
                    {report.gh} - {report.ga}
                  </span>
                </div>
                {sortedGoals.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-[var(--mut)] text-center">
                    ไม่มีประตูในเวลาปกติ ({report.gh} - {report.ga})
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--line)]/55">
                    {sortedGoals.map((ev, gIdx) => {
                      const isHomeScore = ev.t === hTeam.id;
                      const scoringTeam = isHomeScore ? hTeam : aTeam;
                      const culpritTeam = ev.og ? (isHomeScore ? aTeam : hTeam) : scoringTeam;
                      const scorerPl = culpritTeam.sq.find((q) => q.n === ev.who) || null;
                      const scorerNo = scorerPl ? getShirtNo(culpritTeam, scorerPl) : null;
                      const assisterPl = !ev.og && ev.as ? scoringTeam.sq.find((q) => q.n === ev.as) || null : null;
                      const isPenGoal = !ev.og && (ev.style === 'penalty' || ev.style === 'panenka');
                      return (
                        <div
                          key={`${ev.m}-${ev.t}-${ev.who}-${gIdx}`}
                          className="px-3 py-1.5 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span
                              className={`min-w-[28px] h-5 px-1 rounded-md text-[9.5px] font-extrabold tabular inline-flex items-center justify-center shrink-0 ${
                                ev.og
                                  ? 'bg-rose-500/18 text-rose-600 dark:text-rose-300'
                                  : isHomeScore
                                    ? 'bg-[var(--g)] text-white'
                                    : 'bg-amber-500 text-white'
                              }`}
                            >
                              {ev.m}&apos;
                            </span>
                            <ClubCrest name={scoringTeam.name} size={13} team={scoringTeam} club={state.club} isMyClub={scoringTeam.id === state.me && state.mode === 'm'} />
                            {scorerPl?.ro && <PositionBadge role={scorerPl.ro} size="2xs" />}
                            <span className="font-bold text-[11.5px] text-[var(--ink)] truncate">{ev.who}</span>
                            {scorerNo != null && (
                              <span className="text-[9.5px] font-extrabold tabular text-[#b45309] dark:text-[var(--lamp)] shrink-0">
                                #{scorerNo}
                              </span>
                            )}
                            {ev.og && (
                              <span className="px-1 py-[1px] rounded bg-rose-500/18 text-rose-600 dark:text-rose-300 text-[9px] font-black shrink-0">
                                OG
                              </span>
                            )}
                            {isPenGoal && (
                              <span className="px-1 py-[1px] rounded bg-amber-500/18 text-amber-700 dark:text-amber-300 text-[9px] font-extrabold shrink-0">
                                🎯 จุดโทษ
                              </span>
                            )}
                          </div>
                          {!ev.og && ev.as && (
                            <span
                              title={`ผู้จ่ายบอล: ${ev.as}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)]/80 text-[10px] shrink-0 max-w-[44%]"
                            >
                              <span className="leading-none shrink-0">👟</span>
                              {assisterPl?.ro && <PositionBadge role={assisterPl.ro} size="2xs" />}
                              <span className="font-bold text-[var(--ink)] truncate">{ev.as}</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Roster & Player Performance */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden">
                <div className="px-3 py-2 bg-[var(--surface-2)]/75 border-b border-[var(--line)] flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[var(--ink)] truncate">
                    👥 รายชื่อ &amp; ผลงานนักเตะ ({playerEntries.length})
                  </span>
                  <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setRosterTeam('all');
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                        rosterTeam === 'all' ? 'bg-[var(--g)] text-white shadow-2xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                      }`}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setRosterTeam('H');
                      }}
                      className={`px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-colors ${
                        rosterTeam === 'H' ? 'bg-[var(--g)] text-white shadow-2xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                      }`}
                      title={hTeam.name}
                    >
                      <ClubCrest name={hTeam.name} size={14} team={hTeam} club={state.club} isMyClub={hTeam.id === state.me && state.mode === 'm'} />
                      <span className="hidden sm:inline max-w-[80px] truncate">{hTeam.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setRosterTeam('A');
                      }}
                      className={`px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-colors ${
                        rosterTeam === 'A' ? 'bg-[var(--g)] text-white shadow-2xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                      }`}
                      title={aTeam.name}
                    >
                      <ClubCrest name={aTeam.name} size={14} team={aTeam} club={state.club} isMyClub={aTeam.id === state.me && state.mode === 'm'} />
                      <span className="hidden sm:inline max-w-[80px] truncate">{aTeam.name}</span>
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-[var(--line)]/55">
                  {playerEntries.map((item) => {
                    const rtTone =
                      item.isMotm || item.rt >= 8.0
                        ? 'bg-amber-400 text-[#1c1300]'
                        : item.rt >= 7.0
                          ? 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35'
                          : item.rt < 6.0
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                            : 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)]';
                    return (
                      <div
                        key={item.key}
                        className={`px-3 py-2 flex items-center justify-between gap-2 ${
                          item.isMotm ? 'bg-amber-400/10' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.pl && (
                              <PlayerReportAvatar
                                player={item.pl}
                                team={item.team}
                                state={state}
                                kitColor={item.kit}
                                trimColor={item.trim}
                                isMotm={item.isMotm}
                              />
                            )}
                            <ClubCrest name={item.team.name} size={13} team={item.team} club={state.club} isMyClub={item.team.id === state.me && state.mode === 'm'} />
                            {item.pl?.ro && <PositionBadge role={item.pl.ro} size="2xs" />}
                            <span className="text-xs font-bold text-[var(--ink)] truncate">{item.name}</span>
                            {item.no != null && (
                              <span className="text-[10px] font-extrabold tabular text-[#b45309] dark:text-[var(--lamp)] shrink-0">
                                #{item.no}
                              </span>
                            )}
                            {item.isMotm && (
                              <span className="px-1 py-[0.5px] rounded bg-amber-400 text-[#1c1300] text-[8.5px] font-black shrink-0">
                                👑 MOTM
                              </span>
                            )}
                          </div>
                          {(item.goals > 0 ||
                            item.assists > 0 ||
                            item.cleanSheet ||
                            item.ownGoals > 0 ||
                            item.yellowCards > 0 ||
                            item.redCards > 0 ||
                            item.subIn ||
                            item.subOut) && (
                            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] tabular pl-1">
                              {item.goals > 0 && <StatIconBadge kind="goal" count={item.goals} size="xs" />}
                              {item.assists > 0 && <StatIconBadge kind="assist" count={item.assists} size="xs" />}
                              {item.cleanSheet && (
                                <span className="inline-flex items-center gap-0.5 font-extrabold text-emerald-700 dark:text-emerald-300">
                                  <span>{item.pl?.pos === 'GK' ? '🧤' : '🛡️'}</span>
                                  <span>คลีนชีต</span>
                                </span>
                              )}
                              {item.ownGoals > 0 && <span className="font-extrabold text-[var(--red)]">🤦 OG {item.ownGoals}</span>}
                              {item.yellowCards > 0 && <StatIconBadge kind="yellow" count={item.yellowCards} size="xs" />}
                              {item.redCards > 0 && <StatIconBadge kind="red" count={item.redCards} size="xs" />}
                              {item.subIn && (
                                <span className="inline-flex items-center gap-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                                  <StatIconBadge kind="subIn" size="xs" />
                                  <span>เข้า {item.subIn.m}&apos;</span>
                                </span>
                              )}
                              {item.subOut && (
                                <span className="inline-flex items-center gap-0.5 font-bold text-rose-600 dark:text-rose-300">
                                  <StatIconBadge kind="subOut" size="xs" />
                                  <span>ออก {item.subOut.m}&apos;</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold tabular shrink-0 ${rtTone}`}>
                          ⭐ {item.rt.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {tab === 'stats' && (
            <div className="rounded-xl bg-[var(--surface-2)]/50 border border-[var(--line)] overflow-hidden">
              <div className="px-3.5 py-2.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-2 text-xs font-bold">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <ClubCrest name={hTeam.name} size={20} team={hTeam} club={state.club} isMyClub={hTeam.id === state.me && state.mode === 'm'} />
                  <span className="truncate text-[var(--ink)]">{hTeam.name}</span>
                </div>
                <span className="text-[10.5px] text-[var(--mut)] font-extrabold uppercase tracking-wider shrink-0">
                  📊 สถิติการแข่งขัน
                </span>
                <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1 text-right">
                  <span className="truncate text-[var(--ink)]">{aTeam.name}</span>
                  <ClubCrest name={aTeam.name} size={20} team={aTeam} club={state.club} isMyClub={aTeam.id === state.me && state.mode === 'm'} />
                </div>
              </div>

              <div className="p-3.5 space-y-3">
                {[
                  { label: 'ครองบอล', hVal: possH, aVal: 100 - possH, hText: `${possH}%`, aText: `${100 - possH}%` },
                  { label: 'โอกาสยิง (เข้ากรอบ)', hVal: shotsH, aVal: shotsA, hText: `${shotsH} (${onTargetH})`, aText: `${shotsA} (${onTargetA})` },
                  { label: 'ความแม่นยำประตู (xG)', hVal: xgH, aVal: xgA, hText: xgH.toFixed(2), aText: xgA.toFixed(2) },
                  { label: 'จ่ายบอลสำเร็จ', hVal: passesH, aVal: passesA, hText: `${passesH}`, aText: `${passesA}` }
                ].map((row) => {
                  const tot = Math.max(0.01, row.hVal + row.aVal);
                  const hPct = row.hVal === 0 && row.aVal === 0 ? 50 : clamp((row.hVal / tot) * 100, 6, 94);
                  return (
                    <div key={row.label} className="space-y-1 text-xs">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 tabular">
                        <span className={`font-extrabold ${row.hVal >= row.aVal ? 'text-[var(--ink)]' : 'text-[var(--mut)]'}`}>
                          {row.hText}
                        </span>
                        <span className="text-[11px] text-[var(--mut)] font-semibold text-center">{row.label}</span>
                        <span className={`font-extrabold text-right ${row.aVal >= row.hVal ? 'text-[var(--ink)]' : 'text-[var(--mut)]'}`}>
                          {row.aText}
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden bg-[var(--surface)] flex gap-0.5">
                        <div className="h-full rounded-l-full" style={{ width: `${hPct}%`, backgroundColor: 'var(--g)' }} />
                        <div className="h-full rounded-r-full bg-amber-500/85" style={{ width: `${100 - hPct}%` }} />
                      </div>
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--line)]/65 text-xs tabular">
                  <div className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 font-bold">
                      <StatIconBadge kind="yellow" count={Math.max(1, yH)} size="xs" />
                      {yH === 0 && <span className="text-[var(--mut)]">0</span>}
                      {rH > 0 && <StatIconBadge kind="red" count={rH} size="xs" />}
                    </span>
                    <span className="text-[11px] text-[var(--mut)] font-semibold">ใบเหลือง / แดง</span>
                    <span className="inline-flex items-center gap-1 font-bold">
                      {rA > 0 && <StatIconBadge kind="red" count={rA} size="xs" />}
                      <StatIconBadge kind="yellow" count={Math.max(1, yA)} size="xs" />
                      {yA === 0 && <span className="text-[var(--mut)]">0</span>}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--mut)] font-semibold">การเปลี่ยนตัว</span>
                    <span className="font-bold">
                      {subs.filter((s) => s.t === hTeam.id).length} - {subs.filter((s) => s.t === aTeam.id).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'events' && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[var(--ink)]">
                  🎙️ เหตุการณ์สำคัญในเกม ({filteredLogs.length})
                </span>
                <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] gap-0.5">
                  {(
                    [
                      ['all', 'ทั้งหมด'],
                      ['goal', '⚽ ประตู'],
                      ['card', `🖥 VAR / ใบ`],
                      ['sub', `🔄 เปลี่ยน${subs.length ? ` (${subs.length})` : ''}`]
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setEventFilter(k);
                      }}
                      className={`h-6 px-2 rounded-md text-[10.5px] font-bold cursor-pointer transition-colors ${
                        eventFilter === k
                          ? 'bg-[var(--g)] text-white shadow-2xs'
                          : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--mut)] rounded-xl bg-[var(--surface-2)]/50 border border-[var(--line)]">
                  ไม่มีเหตุการณ์ในหมวดนี้
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredLogs.map((l, idx) => {
                    const matchedVar = l.varReplayId ? varById.get(l.varReplayId) : undefined;
                    const rowCls =
                      l.tone === 'goal'
                        ? 'bg-[var(--g-soft)] border-[var(--g)]/35'
                        : l.tone === 'card' || matchedVar
                          ? 'bg-sky-500/10 border-sky-500/30'
                          : l.tone === 'sub'
                            ? 'bg-emerald-500/8 border-emerald-500/25'
                            : 'bg-[var(--surface-2)]/65 border-[var(--line)]/70';
                    return (
                      <div
                        key={`${l.m}-${idx}`}
                        className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${rowCls}`}
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="min-w-[30px] h-5 px-1 rounded bg-[var(--surface)] border border-[var(--line)] text-[10px] font-extrabold tabular inline-flex items-center justify-center shrink-0">
                            {l.m}&apos;
                          </span>
                          <span className="leading-snug text-[var(--ink)] font-medium break-words">{l.text}</span>
                        </div>
                        {matchedVar && (
                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              onOpenVarReplay(hTeam.id, aTeam.id, varReplays, matchedVar.id);
                            }}
                            className="shrink-0 px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/32 border border-sky-400/50 text-sky-700 dark:text-sky-300 text-[10.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <span>🖥</span>
                            <span>ดูภาพช้า</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
