import React, { useMemo, useState } from 'react';
import { Calendar, ChevronRight, Coins, Trophy } from 'lucide-react';
import type { ArchivedMatchReport, Player, Team, GameState, VarReplayRecord } from '../types/game';
import { fmtMoney } from '../utils/math';
import { RN, TN } from '../data/thaiFootballData';
import { EXTRA_CUP_META, getPlayerCupTotals, normalizeCupCompKey } from '../engine/simulation';
import { xi } from '../engine/playerCore';
import { SFX } from '../utils/audioTheme';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { PositionBadge } from '../components/PositionBadge';
import { StatIconBadge } from '../components/StatIconBadge';
import { MyTeamBadge } from '../components/MyTeamBadge';
import { getRatingPalette } from '../components/RatingBadge';

type CupTabId = 'fa' | 'lc' | 'dc' | 'sc' | 'asia';
type CupStatCat = 'sg' | 'sa' | 'cs' | 'motm' | 'rt' | 'sp';

interface ParsedCupLog {
  roundLabel: string;
  homeName: string;
  gh: number;
  ga: number;
  awayName: string;
  penText?: string;
  raw: string;
}

function parseCupLogLine(raw: string): ParsedCupLog | null {
  const colonIdx = raw.indexOf(': ');
  if (colonIdx < 0) return null;
  const roundLabel = raw.slice(0, colonIdx).trim();
  const body = raw.slice(colonIdx + 2).trim();
  const m = body.match(/^(.*?)\s+(\d+)-(\d+)\s+(.*?)(?:\s+\(([^)]+)\))?$/);
  if (!m) return null;
  return {
    roundLabel,
    homeName: m[1].trim(),
    gh: Number(m[2]),
    ga: Number(m[3]),
    awayName: m[4].trim(),
    penText: m[5]?.trim(),
    raw
  };
}

function teamOvrQuick(team: Team): number {
  const starters = xi(team);
  if (!starters.length) return 60;
  return Math.round(starters.reduce((s, q) => s + q.ov, 0) / starters.length);
}

function tierLabelOf(team: Team): string {
  if (team.tier < 3) return TN[team.tier] || `ลีก ${team.tier + 1}`;
  return 'สโมสรต่างแดน';
}

export const CupView: React.FC<{
  state: GameState;
  onInspectTeam: (id: number) => void;
  onInspectPlayer?: (p: Player, t: Team) => void;
  onOpenVarReplay?: (homeId: number, awayId: number, records: VarReplayRecord[]) => void;
  onOpenMatchReport?: (report: ArchivedMatchReport, title?: string) => void;
  initialRightPane?: 'results' | 'stats';
}> = ({ state, onInspectTeam, onInspectPlayer, onOpenVarReplay, onOpenMatchReport, initialRightPane = 'results' }) => {
  const initialTab: CupTabId = state.pc
    ? 'fa'
    : state.plc
      ? 'lc'
      : state.pdc
        ? 'dc'
        : state.psc
          ? 'sc'
          : state.pa
            ? 'asia'
            : 'fa';

  const [cupTab, setCupTab] = useState<CupTabId>(initialTab);
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [rightPane, setRightPane] = useState<'results' | 'stats'>(initialRightPane);
  const [statScope, setStatScope] = useState<'comp' | 'all'>('comp');
  const [teamFilter, setTeamFilter] = useState<'all' | 'me'>('all');
  const [statCat, setStatCat] = useState<CupStatCat>('sg');
  const myTeamName = state.teams[state.me]?.name || '';

  const teamByName = useMemo(() => {
    const map = new Map<string, Team>();
    state.teams.forEach((t) => {
      if (t?.name) map.set(t.name, t);
    });
    return map;
  }, [state.teams]);

  const competitions = useMemo(() => {
    const list: {
      id: CupTabId;
      icon: string;
      short: string;
      title: string;
      subtitle: string;
      scheduleHint: string;
      prize: number;
      queued: boolean;
      isSingleFinal?: boolean;
      notStartedMsg: string;
      data?: { r: number; ids: number[]; alive: boolean; done: boolean; log: string[] } | null;
    }[] = [
      {
        id: 'fa',
        icon: '🏆',
        short: 'ถ้วยประชาชน',
        title: 'ถ้วยประชาชน (16 ทีม)',
        subtitle: 'รวมสโมสรทุกระดับลีก แข่งน็อกเอาต์นัดเดียวรู้ผล',
        scheduleHint: 'นัด 6, 13, 20, 27',
        prize: 250,
        queued: Boolean(state.pc),
        notStartedMsg: 'รายการถ้วยประชาชนจะเริ่มประกบคู่ในฤดูกาลนี้',
        data: state.cup
      },
      {
        id: 'lc',
        icon: EXTRA_CUP_META.lc.icon,
        short: EXTRA_CUP_META.lc.short,
        title: `${EXTRA_CUP_META.lc.name} (16 ทีม)`,
        subtitle: 'ศึกน็อกเอาต์สปีดเกมดุเดือด แข่งขันกลางสัปดาห์',
        scheduleHint: 'นัด 4, 11, 18, 25',
        prize: EXTRA_CUP_META.lc.prize,
        queued: Boolean(state.plc),
        notStartedMsg: 'รายการไทยลีก คัพ จะเปิดฉากในฤดูกาลนี้',
        data: state.lc
      },
      {
        id: 'dc',
        icon: EXTRA_CUP_META.dc.icon,
        short: EXTRA_CUP_META.dc.short,
        title: `${EXTRA_CUP_META.dc.name} (16 ทีม)`,
        subtitle: 'เวทีชิงโล่สำหรับสโมสรลีกจังหวัด & ลีกในประเทศ 2',
        scheduleHint: 'นัด 5, 12, 19, 26',
        prize: EXTRA_CUP_META.dc.prize,
        queued: Boolean(state.pdc),
        notStartedMsg: 'รายการถ้วยดิวิชั่น & ภูมิภาค จะเปิดฉากในฤดูกาลนี้',
        data: state.dc
      },
      {
        id: 'sc',
        icon: EXTRA_CUP_META.sc.icon,
        short: EXTRA_CUP_META.sc.short,
        title: EXTRA_CUP_META.sc.name,
        subtitle: 'แชมป์ลีกสูงสุดปะทะแชมป์ถ้วยประชาชน นัดชิงถ้วยเปิดฤดูกาล',
        scheduleHint: 'นัด 2',
        prize: EXTRA_CUP_META.sc.prize,
        queued: Boolean(state.psc),
        isSingleFinal: true,
        notStartedMsg: 'ศึกไทยแลนด์ แชมเปี้ยนส์ คัพ จะเริ่มชิงชัยในช่วงนัดที่ 2',
        data: state.sc
      },
      {
        id: 'asia',
        icon: '🌏',
        short: 'ถ้วยทวีป',
        title: 'ชิงแชมป์สโมสรทวีป (16 ทีม)',
        subtitle: 'ตัวแทนลีกสูงสุดไทยดวลยอดทีมต่างแดนทั่วเอเชีย',
        scheduleHint: 'นัด 3, 10, 17, 24',
        prize: 500,
        queued: Boolean(state.pa),
        notStartedMsg: 'รายการชิงแชมป์สโมสรทวีปจะเปิดฉากในฤดูกาลนี้',
        data: state.ac
      }
    ];
    return list;
  }, [state]);

  const activeComp = competitions.find((c) => c.id === cupTab) || competitions[0];
  const compData = activeComp.data;

  const pairs = useMemo(() => {
    const out: [Team, Team][] = [];
    if (!compData || compData.done) return out;
    for (let i = 0; i < compData.ids.length; i += 2) {
      const h = state.teams[compData.ids[i]];
      const a = state.teams[compData.ids[i + 1]];
      if (h && a) out.push([h, a]);
    }
    return out;
  }, [compData, state.teams]);

  const parsedLogs = useMemo(() => {
    if (!compData?.log?.length) return [];
    return compData.log.slice().reverse().map((raw) => ({
      raw,
      parsed: parseCupLogLine(raw)
    }));
  }, [compData]);

  const availableRounds = useMemo(() => {
    const seen = new Set<string>();
    parsedLogs.forEach((item) => {
      if (item.parsed?.roundLabel) seen.add(item.parsed.roundLabel);
    });
    return Array.from(seen);
  }, [parsedLogs]);

  const effectiveRoundFilter = roundFilter === 'all' || availableRounds.includes(roundFilter) ? roundFilter : 'all';

  const visibleLogs = useMemo(() => {
    if (effectiveRoundFilter === 'all') return parsedLogs;
    return parsedLogs.filter((item) => item.parsed?.roundLabel === effectiveRoundFilter);
  }, [parsedLogs, effectiveRoundFilter]);

  const champ = compData?.done && compData.ids[0] != null ? state.teams[compData.ids[0]] : null;
  const roundLbl = activeComp.isSingleFinal
    ? 'ชิงชนะเลิศ'
    : compData
      ? RN[compData.r] || `รอบ ${compData.r + 1}`
      : 'รอเปิดฉาก';

  const neverEntered = compData
    ? !compData.alive && !compData.ids.includes(state.me) && !compData.log.some((l) => myTeamName && l.includes(myTeamName))
    : true;

  const myLastMatchLog = useMemo(() => {
    if (!myTeamName) return null;
    return parsedLogs.find((x) => x.raw.includes(myTeamName)) || null;
  }, [parsedLogs, myTeamName]);

  const stages = activeComp.isSingleFinal
    ? ['ชิงชนะเลิศ']
    : ['รอบ 16 ทีม', 'รอบ 8 ทีม', 'รอบรองชนะเลิศ', 'รอบชิงชนะเลิศ'];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* 5-Tournament Selector Strip */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-5 mland:grid-cols-5 gap-1.5 mland:gap-1">
        {competitions.map((comp) => {
          const isActive = comp.id === activeComp.id;
          const d = comp.data;
          const compChamp = d?.done && d.ids[0] != null ? state.teams[d.ids[0]] : null;
          const compRound = comp.isSingleFinal ? 'ชิงฯ' : d ? RN[d.r] || `รอบ ${d.r + 1}` : 'รอเริ่ม';
          const statusLine = comp.queued
            ? 'แข่งสัปดาห์นี้'
            : !d
              ? comp.scheduleHint
              : d.done
                ? compChamp
                  ? `แชมป์: ${compChamp.name}`
                  : 'จบรายการ'
                : d.alive
                  ? `อยู่ในเส้นทาง · ${compRound}`
                  : compRound;

          return (
            <button
              key={comp.id}
              type="button"
              onClick={() => {
                setCupTab(comp.id);
                setRoundFilter('all');
              }}
              className={`px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border text-left transition-all cursor-pointer min-w-0 flex items-center gap-2 mland:gap-1.5 ${
                isActive
                  ? 'bg-[var(--surface)] border-[var(--g)] ring-1 ring-[var(--g)]/35 shadow-xs'
                  : comp.queued
                    ? 'bg-[var(--lamp-soft)]/70 border-[var(--lamp)]/70 hover:border-[var(--lamp)]'
                    : 'bg-[var(--surface)]/75 border-[var(--line)] hover:border-[var(--g)]/55 hover:bg-[var(--surface)]'
              }`}
            >
              <span className="text-base sm:text-lg mland:text-sm leading-none shrink-0">{comp.icon}</span>
              <div className="min-w-0 flex-1">
                <div className={`text-xs mland:text-[10px] font-bold truncate leading-tight ${isActive ? 'text-[var(--g)]' : 'text-[var(--ink)]'}`}>
                  {comp.short}
                </div>
                <div
                  className={`text-[10px] mland:text-[8px] truncate leading-tight mt-0.5 tabular ${
                    comp.queued
                      ? 'font-bold text-[#8a5b00] dark:text-[var(--lamp)]'
                      : d?.done && compChamp?.id === state.me
                        ? 'font-bold text-[var(--g)]'
                        : 'text-[var(--mut)]'
                  }`}
                >
                  {statusLine}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hero Competition Overview & Knockout Stage Stepper */}
      <section className="shrink-0 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mland:gap-1.5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base sm:text-lg mland:text-sm leading-none shrink-0">{activeComp.icon}</span>
            <h3 className="font-display font-extrabold text-sm sm:text-base mland:text-xs text-[var(--ink)] truncate">
              {activeComp.title}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] mland:text-[9px] text-[var(--mut)] tabular">
            <span>{activeComp.subtitle}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--ink)]/85">
              <Calendar className="w-3 h-3 text-[var(--mut)] shrink-0" />
              {activeComp.scheduleHint}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-bold text-[#9a6700] dark:text-[var(--lamp)]">
              <Coins className="w-3 h-3 shrink-0" />
              แชมป์ {fmtMoney(activeComp.prize)}
            </span>
          </div>
        </div>

        {/* Stage Progress & Club Status */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mland:gap-1.5 shrink-0">
          {compData && (
            <div className="hidden md:flex items-center gap-1 text-[10.5px] font-semibold text-[var(--mut)]">
              {stages.map((st, idx) => {
                const isDoneStage = compData.done || idx < compData.r;
                const isCurStage = !compData.done && idx === compData.r;
                return (
                  <React.Fragment key={st}>
                    {idx > 0 && <span className="opacity-35">›</span>}
                    <span
                      className={`px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                        isCurStage
                          ? 'bg-[var(--g-soft)] text-[var(--g)] font-bold'
                          : isDoneStage
                            ? 'text-[var(--ink)]/75'
                            : 'opacity-50'
                      }`}
                    >
                      {st.replace('รอบ', '').replace('ชนะเลิศ', 'ชิงฯ')}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          <div
            className={`px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-lg text-[11px] mland:text-[9.5px] font-bold whitespace-nowrap border ${
              !compData
                ? 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]'
                : compData.done
                  ? champ?.id === state.me
                    ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] text-[#7a4f00] dark:text-[var(--lamp)]'
                    : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)]'
                  : compData.alive
                    ? 'bg-[var(--g-soft)] border-[var(--g)]/40 text-[var(--g)]'
                    : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]'
            }`}
          >
            {!compData
              ? 'ยังไม่เริ่มรายการ'
              : compData.done
                ? champ
                  ? `🏆 แชมป์: ${champ.name}`
                  : 'จบรายการแล้ว'
                : compData.alive
                  ? `✅ อยู่ในเส้นทาง (${roundLbl})`
                  : neverEntered
                    ? '➖ ไม่ได้ร่วมรายการนี้'
                    : `❌ ตกรอบ (${roundLbl})`}
          </div>
        </div>
      </section>

      {/* Main Content Split */}
      {!compData ? (
        <div className="flex-1 min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col items-center justify-center p-6 text-center gap-2">
          <Trophy className="w-8 h-8 text-[var(--mut)]/50" />
          <div className="text-sm font-bold text-[var(--ink)]">{activeComp.title}</div>
          <p className="text-xs text-[var(--mut)] max-w-md">
            {activeComp.notStartedMsg} · กำหนดการแข่งขัน {activeComp.scheduleHint}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.02fr_0.98fr] mland:grid-cols-[1.02fr_0.98fr] gap-2.5 mland:gap-2 overflow-hidden items-stretch">
          {/* Left Pane: Current Round Bracket OR Champion Showcase */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)]/75 flex items-center justify-between gap-2">
              <h4 className="font-bold text-xs sm:text-sm mland:text-[11px] text-[var(--ink)] truncate">
                {compData.done ? '🏆 บทสรุปแชมป์ประจำรายการ' : `⚔️ ประกบคู่ ${roundLbl}`}
              </h4>
              {!compData.done && pairs.length > 0 && (
                <span className="text-[11px] mland:text-[9px] font-semibold text-[var(--mut)] tabular shrink-0">
                  {pairs.length} คู่
                </span>
              )}
            </div>

            {!compData.done && pairs.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-2.5 mland:p-1.5 space-y-1.5 mland:space-y-1 content-start">
                {pairs.map(([h, a], idx) => {
                  const involvesMe = h.id === state.me || a.id === state.me;
                  const hOvr = teamOvrQuick(h);
                  const aOvr = teamOvrQuick(a);
                  return (
                    <div
                      key={`${h.id}-${a.id}-${idx}`}
                      className={`px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                        involvesMe
                          ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]'
                          : 'bg-[var(--surface-2)]/45 border-[var(--line)]/80 hover:border-[var(--g)]/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onInspectTeam(h.id)}
                        className="flex items-center gap-2 mland:gap-1.5 min-w-0 flex-1 text-left cursor-pointer group"
                      >
                        <div className="shrink-0 [&>svg]:w-6 [&>svg]:h-6 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                          <ClubCrest name={h.name} size={24} team={h} club={state.club} isMyClub={h.id === state.me && state.mode === 'm'} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs mland:text-[10px] flex items-center gap-1 min-w-0 leading-tight group-hover:text-[var(--g)] ${h.id === state.me ? 'font-extrabold text-[var(--ink)]' : 'font-semibold text-[var(--ink)]'}`}>
                            <span className="truncate">{h.name}</span>
                            {h.id === state.me && <MyTeamBadge size="2xs" />}
                          </div>
                          <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate tabular leading-tight">
                            {tierLabelOf(h)} · OVR {hOvr}
                          </div>
                        </div>
                      </button>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] mland:text-[8.5px] font-bold tabular shrink-0 ${
                        involvesMe ? 'bg-[var(--lamp)] text-[#261900]' : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--mut)]'
                      }`}>
                        VS
                      </span>

                      <button
                        type="button"
                        onClick={() => onInspectTeam(a.id)}
                        className="flex items-center justify-end gap-2 mland:gap-1.5 min-w-0 flex-1 text-right cursor-pointer group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs mland:text-[10px] flex items-center justify-end gap-1 min-w-0 leading-tight group-hover:text-[var(--g)] ${a.id === state.me ? 'font-extrabold text-[var(--ink)]' : 'font-semibold text-[var(--ink)]'}`}>
                            {a.id === state.me && <MyTeamBadge size="2xs" />}
                            <span className="truncate">{a.name}</span>
                          </div>
                          <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate tabular leading-tight">
                            OVR {aOvr} · {tierLabelOf(a)}
                          </div>
                        </div>
                        <div className="shrink-0 [&>svg]:w-6 [&>svg]:h-6 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                          <ClubCrest name={a.name} size={24} team={a} club={state.club} isMyClub={a.id === state.me && state.mode === 'm'} />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : compData.done && champ ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-3 flex flex-col items-center justify-center text-center gap-3 mland:gap-2">
                <div className="p-3 mland:p-2 rounded-2xl bg-[var(--lamp-soft)]/70 border border-[var(--lamp)]/60">
                  <div className="[&>svg]:w-14 [&>svg]:h-14 mland:[&>svg]:w-10 mland:[&>svg]:h-10">
                    <ClubCrest name={champ.name} size={56} team={champ} club={state.club} isMyClub={champ.id === state.me && state.mode === 'm'} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] mland:text-[9px] font-bold text-[#9a6700] dark:text-[var(--lamp)]">
                    แชมป์{activeComp.short} · ซีซั่น {state.season}
                  </div>
                  <h4 className="font-display font-extrabold text-lg sm:text-xl mland:text-sm text-[var(--ink)] flex items-center justify-center gap-1.5">
                    <span>{champ.name}</span>
                    {champ.id === state.me && <MyTeamBadge size="md" />}
                  </h4>
                  <p className="text-xs mland:text-[9.5px] text-[var(--mut)] tabular">
                    {tierLabelOf(champ)} · พลัง 11 ตัวจริง {teamOvrQuick(champ)} · รางวัลแชมป์ {fmtMoney(activeComp.prize)}
                  </p>
                </div>

                {myLastMatchLog && (
                  <div className="w-full max-w-sm pt-2 border-t border-[var(--line)]/70 text-xs mland:text-[9.5px] text-[var(--mut)]">
                    {champ.id === state.me
                      ? '🎉 สโมสรของคุณคว้าแชมป์รายการนี้ได้สำเร็จ!'
                      : `ผลงานทีมคุณล่าสุด · ${myLastMatchLog.raw}`}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onInspectTeam(champ.id)}
                  className="btn btn-sm btn-secondary"
                >
                  <span>ส่องสโมสรแชมป์</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center gap-1.5 text-xs text-[var(--mut)]">
                <p>ยังไม่มีการประกบคู่ในรอบถัดไป</p>
                <p className="text-[11px]">กำหนดการแข่งขัน: {activeComp.scheduleHint}</p>
              </div>
            )}
          </section>

          {/* Right Pane: Match Results OR Cup Player Stats */}
          <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)]/75 flex flex-wrap items-center justify-between gap-1.5">
              <div className="seg-bar">
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setRightPane('results');
                  }}
                  className={`seg-btn py-0.5 px-2.5 text-[11px] mland:text-[9.5px] ${rightPane === 'results' ? 'seg-btn-active' : ''}`}
                >
                  📜 ผลแข่ง ({parsedLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setRightPane('stats');
                  }}
                  className={`seg-btn py-0.5 px-2.5 text-[11px] mland:text-[9.5px] ${rightPane === 'stats' ? 'seg-btn-active' : ''}`}
                >
                  ⭐ สถิตินักเตะ
                </button>
              </div>

              {rightPane === 'results' ? (
                availableRounds.length > 1 && (
                  <div className="seg-bar">
                    <button
                      type="button"
                      onClick={() => setRoundFilter('all')}
                      className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] ${effectiveRoundFilter === 'all' ? 'seg-btn-active' : ''}`}
                    >
                      ทั้งหมด
                    </button>
                    {availableRounds.map((rl) => (
                      <button
                        key={rl}
                        type="button"
                        onClick={() => setRoundFilter(rl)}
                        className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] ${effectiveRoundFilter === rl ? 'seg-btn-active' : ''}`}
                      >
                        {rl.replace('รอบ', '').replace('ชนะเลิศ', 'ชิงฯ')}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="flex flex-wrap items-center gap-1">
                  <div className="seg-bar">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setStatScope('comp');
                      }}
                      className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] ${statScope === 'comp' ? 'seg-btn-active' : ''}`}
                    >
                      {activeComp.short}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setStatScope('all');
                      }}
                      className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] ${statScope === 'all' ? 'seg-btn-active' : ''}`}
                    >
                      รวมทุกถ้วย
                    </button>
                  </div>
                  <div className="seg-bar">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setTeamFilter('all');
                      }}
                      className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] ${teamFilter === 'all' ? 'seg-btn-active' : ''}`}
                    >
                      ทุกทีม
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setTeamFilter('me');
                      }}
                      className={`seg-btn py-0.5 px-2 text-[10px] mland:text-[8.5px] ${teamFilter === 'me' ? 'seg-btn-active' : ''}`}
                    >
                      <MyTeamBadge size="2xs" />
                      <span>ทีมฉัน</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {rightPane === 'results' ? (
              visibleLogs.length > 0 ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 mland:p-1.5 space-y-1.5 mland:space-y-1 content-start">
                  {visibleLogs.map((item, idx) => {
                    const p = item.parsed;
                    if (!p) {
                      const isMine = myTeamName && item.raw.includes(myTeamName);
                      return (
                        <div
                          key={idx}
                          className={`px-3 py-2 rounded-xl border text-xs ${
                            isMine ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/60 font-bold' : 'bg-[var(--surface-2)]/50 border-[var(--line)]/75'
                          }`}
                        >
                          {item.raw}
                        </div>
                      );
                    }
                    const ht = teamByName.get(p.homeName);
                    const at = teamByName.get(p.awayName);
                    const involvesMe = (ht && ht.id === state.me) || (at && at.id === state.me);
                    const homeWon = p.gh > p.ga;
                    const awayWon = p.ga > p.gh;
                    const compKey = activeComp.id === 'fa' ? 'cup' : activeComp.id;
                    const matchedCupLog =
                      ht && at
                        ? (state.cupLog || []).find(
                            (cl) =>
                              cl.comp === compKey &&
                              cl.h === ht.id &&
                              cl.a === at.id &&
                              cl.gh === p.gh &&
                              cl.ga === p.ga &&
                              (compKey === 'sc' || (RN[cl.r] || `รอบ ${cl.r + 1}`) === p.roundLabel)
                          )
                        : undefined;

                    return (
                      <div
                        key={`${item.raw}-${idx}`}
                        className={`px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border flex flex-col gap-1 transition-colors ${
                          involvesMe
                            ? 'bg-[var(--lamp-soft)]/80 border-[var(--lamp)]/70'
                            : 'bg-[var(--surface-2)]/40 border-[var(--line)]/75'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] mland:text-[8px] text-[var(--mut)]">
                          <span className="font-semibold">{p.roundLabel}</span>
                          <div className="flex items-center gap-1.5">
                            {p.penText && (
                              <span className="font-semibold text-[#8a5b00] dark:text-[var(--lamp)] tabular">
                                {p.penText}
                              </span>
                            )}
                            {matchedCupLog?.varReplays?.length && onOpenVarReplay && (
                              <button
                                type="button"
                                onClick={() => onOpenVarReplay(matchedCupLog.h, matchedCupLog.a, matchedCupLog.varReplays!)}
                                className="px-1.5 py-[1px] rounded bg-sky-500/18 border border-sky-400/50 text-sky-700 dark:text-sky-300 text-[9.5px] mland:text-[8px] font-extrabold hover:bg-sky-500/28 cursor-pointer transition-colors whitespace-nowrap"
                                title="ดูภาพช้า VAR ย้อนหลัง"
                              >
                                🖥 VAR ({matchedCupLog.varReplays.length})
                              </button>
                            )}
                            {matchedCupLog && onOpenMatchReport && (
                              <button
                                type="button"
                                onClick={() => onOpenMatchReport(matchedCupLog, `${activeComp.title} · ${p.roundLabel}`)}
                                className="px-1.5 py-[1px] rounded bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-[var(--ink)] text-[9.5px] mland:text-[8px] font-bold cursor-pointer transition-colors whitespace-nowrap"
                                title="ดูหน้าสรุปหลังเกม"
                              >
                                📊 สรุป
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={!ht}
                            onClick={() => ht && onInspectTeam(ht.id)}
                            className={`flex items-center gap-1.5 min-w-0 flex-1 text-left ${ht ? 'cursor-pointer hover:text-[var(--g)]' : 'cursor-default'}`}
                          >
                            {ht && (
                              <div className="shrink-0 [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                                <ClubCrest name={ht.name} size={20} team={ht} club={state.club} isMyClub={ht.id === state.me && state.mode === 'm'} />
                              </div>
                            )}
                            <span className={`text-xs mland:text-[9.5px] truncate ${homeWon || ht?.id === state.me ? 'font-bold text-[var(--ink)]' : 'text-[var(--ink)]/80'}`}>
                              {p.homeName}
                            </span>
                            {ht?.id === state.me && <MyTeamBadge size="2xs" />}
                          </button>

                          {matchedCupLog && onOpenMatchReport ? (
                            <button
                              type="button"
                              onClick={() => onOpenMatchReport(matchedCupLog, `${activeComp.title} · ${p.roundLabel}`)}
                              title="ดูหน้าสรุปหลังเกม"
                              className={`px-2 py-0.5 rounded-md text-xs mland:text-[10px] font-extrabold tabular shrink-0 cursor-pointer hover:brightness-105 transition-all ${
                                involvesMe ? 'bg-[var(--lamp)] text-[#261900]' : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)]'
                              }`}
                            >
                              {p.gh} - {p.ga}
                            </button>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-md text-xs mland:text-[10px] font-extrabold tabular shrink-0 ${
                              involvesMe ? 'bg-[var(--lamp)] text-[#261900]' : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)]'
                            }`}>
                              {p.gh} - {p.ga}
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={!at}
                            onClick={() => at && onInspectTeam(at.id)}
                            className={`flex items-center justify-end gap-1.5 min-w-0 flex-1 text-right ${at ? 'cursor-pointer hover:text-[var(--g)]' : 'cursor-default'}`}
                          >
                            {at?.id === state.me && <MyTeamBadge size="2xs" />}
                            <span className={`text-xs mland:text-[9.5px] truncate ${awayWon || at?.id === state.me ? 'font-bold text-[var(--ink)]' : 'text-[var(--ink)]/80'}`}>
                              {p.awayName}
                            </span>
                            {at && (
                              <div className="shrink-0 [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                                <ClubCrest name={at.name} size={20} team={at} club={state.club} isMyClub={at.id === state.me && state.mode === 'm'} />
                              </div>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center gap-1.5 text-xs text-[var(--mut)]">
                  <p>ยังไม่เริ่มการแข่งขันรอบแรก</p>
                  <p className="text-[11px]">ผลการแข่งขันทุกรอบจะสรุปไว้ที่นี่ ({activeComp.scheduleHint})</p>
                </div>
              )
            ) : (
              (() => {
                const scopeKey = statScope === 'all' ? 'all' : normalizeCupCompKey(activeComp.id);
                const pool = state.teams
                  .filter((tm) => teamFilter === 'all' || tm.id === state.me)
                  .flatMap((tm) =>
                    tm.sq.map((q) => ({
                      q,
                      t: tm,
                      st: getPlayerCupTotals(q, scopeKey)
                    }))
                  )
                  .filter((x) => x.st.sp > 0 || x.st.sg > 0 || x.st.sa > 0 || x.st.cs > 0 || x.st.motm > 0);

                const topGoal = pool
                  .filter((x) => x.st.sg > 0)
                  .slice()
                  .sort((a, b) => b.st.sg - a.st.sg || a.st.sp - b.st.sp || b.st.avgRating - a.st.avgRating)[0];
                const topAst = pool
                  .filter((x) => x.st.sa > 0)
                  .slice()
                  .sort((a, b) => b.st.sa - a.st.sa || a.st.sp - b.st.sp || b.st.avgRating - a.st.avgRating)[0];
                const topRt = pool
                  .filter((x) => x.st.avgRating > 0 && x.st.sra > 0)
                  .slice()
                  .sort((a, b) => b.st.avgRating - a.st.avgRating || b.st.sp - a.st.sp || b.st.sg - a.st.sg)[0];

                const sortedRows = pool
                  .filter((x) => {
                    if (statCat === 'sg') return x.st.sg > 0;
                    if (statCat === 'sa') return x.st.sa > 0;
                    if (statCat === 'cs') return x.q.pos === 'GK' && x.st.cs > 0;
                    if (statCat === 'motm') return x.st.motm > 0;
                    if (statCat === 'rt') return x.st.avgRating > 0 && x.st.sra > 0;
                    return x.st.sp > 0;
                  })
                  .slice()
                  .sort((a, b) => {
                    if (statCat === 'sg') return b.st.sg - a.st.sg || b.st.sa - a.st.sa || a.st.sp - b.st.sp || b.st.avgRating - a.st.avgRating;
                    if (statCat === 'sa') return b.st.sa - a.st.sa || b.st.sg - a.st.sg || a.st.sp - b.st.sp || b.st.avgRating - a.st.avgRating;
                    if (statCat === 'cs') return b.st.cs - a.st.cs || a.st.sp - b.st.sp || b.st.avgRating - a.st.avgRating;
                    if (statCat === 'motm') return b.st.motm - a.st.motm || b.st.avgRating - a.st.avgRating || b.st.sg - a.st.sg;
                    if (statCat === 'rt') return b.st.avgRating - a.st.avgRating || b.st.sp - a.st.sp || b.st.sg - a.st.sg;
                    return b.st.sp - a.st.sp || b.st.avgRating - a.st.avgRating || b.st.sg - a.st.sg;
                  })
                  .slice(0, 30);

                const catTabs: { id: CupStatCat; lbl: React.ReactNode }[] = [
                  { id: 'sg', lbl: '⚽ ประตู' },
                  { id: 'sa', lbl: '👟 จ่าย' },
                  {
                    id: 'cs',
                    lbl: (
                      <span className="inline-flex items-center gap-1">
                        <StatIconBadge kind="cleansheet" size="xs" />
                        <span>คลีน</span>
                      </span>
                    )
                  },
                  { id: 'motm', lbl: '👑 MOTM' },
                  { id: 'rt', lbl: '⭐ เรตติ้ง' },
                  { id: 'sp', lbl: '👕 ลงเล่น' }
                ];

                const formatVal = (item: (typeof pool)[number]) => {
                  if (statCat === 'sg') return `${item.st.sg} ลูก`;
                  if (statCat === 'sa') return `${item.st.sa} ครั้ง`;
                  if (statCat === 'cs') return `${item.st.cs} นัด`;
                  if (statCat === 'motm') return `${item.st.motm} ครั้ง`;
                  if (statCat === 'rt') return item.st.avgRating.toFixed(2);
                  return `${item.st.sp} นัด`;
                };

                const handlePickPlayer = (pl: Player, tm: Team) => {
                  SFX.tap();
                  if (onInspectPlayer) onInspectPlayer(pl, tm);
                  else onInspectTeam(tm.id);
                };

                return (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {/* Stat Category Strip */}
                    <div className="shrink-0 px-2.5 py-1.5 mland:px-2 mland:py-1 border-b border-[var(--line)]/60 bg-[var(--surface-2)]/35 overflow-x-auto">
                      <div className="seg-bar w-max">
                        {catTabs.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              setStatCat(c.id);
                            }}
                            className={`seg-btn py-0.5 px-2 text-[10.5px] mland:text-[8.5px] whitespace-nowrap ${
                              statCat === c.id ? 'seg-btn-active' : ''
                            }`}
                          >
                            {c.lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {pool.length > 0 ? (
                      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 mland:p-1.5 space-y-2 mland:space-y-1.5">
                        {/* Top 3 Leaders Strip */}
                        <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                          {[
                            {
                              title: '⚽ ดาวซัลโว',
                              entry: topGoal,
                              val: topGoal ? `${topGoal.st.sg} ประตู` : '-',
                              tone: 'bg-[var(--lamp-soft)]/55 border-[var(--lamp)]/45'
                            },
                            {
                              title: '👟 จอมแอสซิสต์',
                              entry: topAst,
                              val: topAst ? `${topAst.st.sa} ครั้ง` : '-',
                              tone: 'bg-[var(--g-soft)]/55 border-[var(--g)]/35'
                            },
                            {
                              title: '⭐ เรตติ้งสูงสุด',
                              entry: topRt,
                              val: topRt ? topRt.st.avgRating.toFixed(2) : '-',
                              tone: 'bg-[var(--surface-2)]/70 border-[var(--line)]'
                            }
                          ].map((box) => (
                            <button
                              key={box.title}
                              type="button"
                              disabled={!box.entry}
                              onClick={() => box.entry && handlePickPlayer(box.entry.q, box.entry.t)}
                              className={`p-2 mland:p-1.5 rounded-xl mland:rounded-lg border text-left transition-colors ${box.tone} ${
                                box.entry ? 'cursor-pointer hover:border-[var(--g)]' : 'opacity-65 cursor-default'
                              }`}
                            >
                              <div className="text-[9.5px] mland:text-[7.5px] font-bold text-[var(--mut)] truncate">
                                {box.title}
                              </div>
                              <div className="font-bold text-[11px] mland:text-[9px] text-[var(--ink)] flex items-center gap-1 min-w-0 mt-0.5">
                                {box.entry && box.entry.t.id === state.me && <MyTeamBadge size="2xs" />}
                                <span className="truncate">{box.entry ? box.entry.q.n : 'รอสถิติ'}</span>
                              </div>
                              <div className="text-[10.5px] mland:text-[8.5px] font-extrabold text-[var(--g)] tabular truncate">
                                {box.val}
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* Ranked List */}
                        {sortedRows.length > 0 ? (
                          <div className="space-y-1">
                            {sortedRows.map((item, idx) => {
                              const isMine = item.t.id === state.me;
                              return (
                                <button
                                  key={`${item.t.id}-${item.q.n}`}
                                  type="button"
                                  onClick={() => handlePickPlayer(item.q, item.t)}
                                  className={`w-full flex items-center gap-2 mland:gap-1.5 px-2 py-1.5 mland:px-1.5 mland:py-1 rounded-xl mland:rounded-lg border text-left cursor-pointer transition-colors ${
                                    isMine
                                      ? 'bg-[var(--lamp-soft)]/75 border-[var(--lamp)]/60 hover:border-[var(--g)]'
                                      : 'bg-[var(--surface-2)]/35 border-[var(--line)]/70 hover:border-[var(--g)]/60'
                                  }`}
                                >
                                  <span className={`w-4 text-[11px] mland:text-[9px] font-extrabold tabular text-left shrink-0 ${
                                    idx === 0 ? 'text-[#b45309] dark:text-[var(--lamp)]' : 'text-[var(--mut)]'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <div className="shrink-0 mland:[&_svg]:w-5 mland:[&_svg]:h-5">
                                    <PlayerFace
                                      player={item.q}
                                      team={item.t}
                                      state={state}
                                      club={state.club}
                                      isMyClub={isMine && state.mode === 'm'}
                                      size={28}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs mland:text-[9.5px] font-bold text-[var(--ink)] flex items-center gap-1 min-w-0">
                                      <PositionBadge role={item.q.ro} size="2xs" />
                                      <span className="truncate">{item.q.n}</span>
                                    </div>
                                    <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate flex items-center gap-1 tabular mt-0.5">
                                      <ClubCrest name={item.t.name} size={12} team={item.t} club={state.club} isMyClub={isMine && state.mode === 'm'} />
                                      <span className="truncate">{item.t.name}</span>
                                      {isMine && <MyTeamBadge size="2xs" />}
                                      <span aria-hidden="true">·</span>
                                      <span className="shrink-0">{item.st.sp} นัด</span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="px-2 py-0.5 rounded-md bg-[var(--g)] text-white text-[11px] mland:text-[9px] font-extrabold tabular">
                                      {formatVal(item)}
                                    </div>
                                    {(statCat === 'sg' || statCat === 'sa' || statCat === 'sp') && (item.st.avgRating > 0) && (
                                      <div className={`text-[9px] mland:text-[7.5px] font-bold tabular mt-0.5 ${getRatingPalette(item.st.avgRating).textCls}`}>
                                        ⭐ {item.st.avgRating.toFixed(1)}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-xs text-[var(--mut)]">
                            ยังไม่มีสถิติในหมวดนี้ ({statScope === 'all' ? 'รวมทุกถ้วย' : activeComp.short})
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center gap-1.5 text-xs text-[var(--mut)]">
                        <p>ยังไม่มีสถิตินักเตะใน{statScope === 'all' ? 'รายการบอลถ้วย' : activeComp.title}</p>
                        <p className="text-[11px]">สถิติยิง จ่าย คลีนชีต MOTM และเรตติ้งจะอัปเดตอัตโนมัติหลังจบแมตช์</p>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </section>
        </div>
      )}
    </div>
  );
};
