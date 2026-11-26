import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Check, ExternalLink, Sparkles } from 'lucide-react';
import type { GameState, Player, Position, Team } from '../types/game';
import { clamp } from '../utils/math';
import { POS } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import {
  autoAssignAllTeamShirtNumbers,
  getPositionShirtGuide,
  getShirtNo,
  getTeamClubIdentity,
  xi
} from '../engine/playerCore';
import { ClubCrest, KitJersey, PlayerFace } from './SvgVisuals';
import { CaptainBadge } from './CaptainBadge';

type LockerFilter = 'ALL' | 'XI' | Position;

const NUMBER_PAGES: ReadonlyArray<{ label: string; start: number; end: number; nums: number[] }> = [
  { label: '1–25', start: 1, end: 25, nums: Array.from({ length: 25 }, (_, i) => i + 1) },
  { label: '26–50', start: 26, end: 50, nums: Array.from({ length: 25 }, (_, i) => i + 26) },
  { label: '51–75', start: 51, end: 75, nums: Array.from({ length: 25 }, (_, i) => i + 51) },
  { label: '76–99', start: 76, end: 99, nums: Array.from({ length: 24 }, (_, i) => i + 76) }
];

const getPageForNumber = (num: number): number => clamp(Math.floor((num - 1) / 25), 0, NUMBER_PAGES.length - 1);

export const LockerRoomPanel: React.FC<{
  state: GameState;
  team: Team;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onToast: (msg: string) => void;
}> = ({ state, team, onUpdateState, onInspectPlayer, onToast }) => {
  const isMgr = state.mode === 'm';
  const clubIdentity = useMemo(() => getTeamClubIdentity(team, state), [team, state]);
  const starters = useMemo(() => xi(team), [team]);
  const starterNames = useMemo(() => new Set(starters.map((q) => q.n)), [starters]);

  const [posFilter, setPosFilter] = useState<LockerFilter>('ALL');
  const [kitSide, setKitSide] = useState<'home' | 'away'>('home');
  const [selectedName, setSelectedName] = useState<string>(() => {
    const meSq = team.sq.find((q) => q.me);
    return meSq?.n || starters[0]?.n || team.sq[0]?.n || '';
  });

  const sortedSquad = useMemo(() => {
    return team.sq
      .slice()
      .sort((a, b) => {
        const aIn = starterNames.has(a.n) ? 0 : 1;
        const bIn = starterNames.has(b.n) ? 0 : 1;
        if (aIn !== bIn) return aIn - bIn;
        const posDiff = POS.indexOf(a.pos) - POS.indexOf(b.pos);
        if (posDiff !== 0) return posDiff;
        return b.ov - a.ov;
      });
  }, [team.sq, starterNames]);

  const filteredPlayers = useMemo(() => {
    if (posFilter === 'ALL') return sortedSquad;
    if (posFilter === 'XI') return sortedSquad.filter((q) => starterNames.has(q.n));
    return sortedSquad.filter((q) => q.pos === posFilter);
  }, [sortedSquad, posFilter, starterNames]);

  const selectedPlayer = useMemo(
    () => team.sq.find((q) => q.n === selectedName) || filteredPlayers[0] || sortedSquad[0] || null,
    [team.sq, selectedName, filteredPlayers, sortedSquad]
  );

  const selectedNo = selectedPlayer ? getShirtNo(team, selectedPlayer) : 10;
  const [numPage, setNumPage] = useState<number>(() => getPageForNumber(selectedNo));

  useEffect(() => {
    if (selectedPlayer) {
      const no = getShirtNo(team, selectedPlayer);
      setNumPage(getPageForNumber(no));
    }
  }, [selectedPlayer?.n, team]);

  const numberHolderMap = useMemo(() => {
    const map = new Map<number, Player>();
    team.sq.forEach((q) => {
      map.set(getShirtNo(team, q), q);
    });
    return map;
  }, [team]);

  const shirtGuide = useMemo(
    () => (selectedPlayer ? getPositionShirtGuide(selectedPlayer.ro, selectedPlayer.pos) : null),
    [selectedPlayer?.ro, selectedPlayer?.pos]
  );
  const primaryRecSet = useMemo(() => new Set(shirtGuide?.primary || []), [shirtGuide]);
  const altRecSet = useMemo(() => new Set(shirtGuide?.alt || []), [shirtGuide]);

  const isSelectedMe = Boolean(selectedPlayer && (selectedPlayer.me || (!isMgr && state.p?.name === selectedPlayer.n)));
  const canEditSelected = Boolean(selectedPlayer && (isMgr || isSelectedMe));
  const isSelectedStarter = Boolean(selectedPlayer && starterNames.has(selectedPlayer.n));

  const handleAssignNumber = (targetPlayer: Player, rawNum: number) => {
    const nextNo = clamp(Math.round(rawNum) || 1, 1, 99);
    const oldNo = getShirtNo(team, targetPlayer);
    if (oldNo === nextNo) return;

    const currentHolder = team.sq.find((q) => q.n !== targetPlayer.n && getShirtNo(team, q) === nextNo);
    SFX.tap();
    onUpdateState((d) => {
      const t = d.teams[d.me];
      const pl = t.sq.find((q) => q.n === targetPlayer.n);
      if (!pl) return;
      const curOldNo = getShirtNo(t, pl);
      const holder = t.sq.find((q) => q !== pl && getShirtNo(t, q) === nextNo);
      if (holder) {
        holder.no = curOldNo;
        if (Array.isArray(holder.vis) && holder.vis.length >= 6) holder.vis[5] = curOldNo;
        if (holder.me && d.p) d.p.no = curOldNo;
      }
      pl.no = nextNo;
      if (Array.isArray(pl.vis) && pl.vis.length >= 6) pl.vis[5] = nextNo;
      if (pl.me && d.p) d.p.no = nextNo;
    });
    setNumPage(getPageForNumber(nextNo));

    if (currentHolder) {
      onToast(`สลับเบอร์ #${nextNo} (${targetPlayer.n.split(' ')[0]}) ↔ #${oldNo} (${currentHolder.n.split(' ')[0]}) แล้ว`);
    } else {
      onToast(`เปลี่ยนเบอร์เสื้อ ${targetPlayer.n.split(' ')[0]} เป็น #${nextNo} แล้ว`);
    }
  };

  const handleAutoAssignAll = () => {
    SFX.confirm();
    let changedCount = 0;
    onUpdateState((d) => {
      const t = d.teams[d.me];
      changedCount = autoAssignAllTeamShirtNumbers(t, d.p);
    });
    if (changedCount > 0) {
      onToast(`เปลี่ยนเบอร์เสื้อออโต้ทั้งทีม (${changedCount} คน) ตามตำแหน่งและบทบาทตัวจริงแล้ว`);
    } else {
      onToast('เบอร์เสื้อทั้งทีมจัดเรียงตามตำแหน่งเหมาะสมครบแล้ว');
    }
  };

  const activePageSpec = NUMBER_PAGES[numPage] || NUMBER_PAGES[0];

  const quickRecommendedNumbers = useMemo(() => {
    if (!shirtGuide) return [];
    const seen = new Set<number>();
    const list: number[] = [];
    for (const n of [...shirtGuide.primary, ...shirtGuide.alt]) {
      if (!seen.has(n)) {
        seen.add(n);
        list.push(n);
      }
    }
    return list.slice(0, 7);
  }, [shirtGuide]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Top Locker Room Header & Controls */}
      <div className="shrink-0 px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mland:gap-1.5">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
            <div className="shrink-0 w-8 h-8 mland:w-6.5 mland:h-6.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/80 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
              <ClubCrest name={team.name} size={20} team={team} club={state.club} isMyClub={isMgr} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm mland:text-[11px] font-extrabold font-display text-[var(--ink)] truncate leading-tight">
                ห้องล็อกเกอร์ &amp; เบอร์เสื้อ
              </h2>
              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate tabular leading-tight mt-0.5">
                <span>{team.name}</span>
                <span aria-hidden="true"> · </span>
                <span>นักเตะ {team.sq.length} คน</span>
                <span aria-hidden="true"> · </span>
                <span>ตัวจริง {starters.length}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoAssignAll}
            className="lg:hidden btn btn-xs sm:btn-sm btn-primary whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
            <span>จัดเบอร์ออโต้</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-1.5 mland:gap-1">
          <div className="seg-bar overflow-x-auto max-w-full">
            {([
              ['ALL', 'ทั้งหมด'],
              ['XI', 'ตัวจริง'],
              ['GK', 'GK'],
              ['DF', 'DF'],
              ['MF', 'MF'],
              ['FW', 'FW']
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  SFX.tap();
                  setPosFilter(key);
                }}
                className={`seg-btn whitespace-nowrap shrink-0 ${posFilter === key ? 'seg-btn-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mland:gap-1 shrink-0">
            <div className="seg-bar">
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setKitSide('home');
                }}
                className={`seg-btn whitespace-nowrap ${kitSide === 'home' ? 'seg-btn-active' : ''}`}
              >
                ชุดเหย้า
              </button>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setKitSide('away');
                }}
                className={`seg-btn whitespace-nowrap ${kitSide === 'away' ? 'seg-btn-active' : ''}`}
              >
                ชุดเยือน
              </button>
            </div>

            <button
              type="button"
              onClick={handleAutoAssignAll}
              className="hidden lg:inline-flex btn btn-sm btn-primary whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>จัดเบอร์ออโต้ทั้งทีม</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Locker Stage */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_368px] mland:grid-cols-[1fr_290px] gap-2.5 mland:gap-2 overflow-y-auto md:overflow-hidden mland:overflow-hidden">
        {/* Left: Pro Dressing Room Locker Stalls */}
        <div className="min-h-[240px] md:min-h-0 overflow-y-auto rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 sm:p-3 mland:p-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mland:gap-1.5">
            {filteredPlayers.map((q) => {
              const no = getShirtNo(team, q);
              const isSelected = selectedPlayer?.n === q.n;
              const isStarter = starterNames.has(q.n);
              const isCap = team.cap === q.n;
              const isMe = Boolean(q.me || (!isMgr && state.p?.name === q.n));

              return (
                <button
                  key={q.n}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setSelectedName(q.n);
                  }}
                  className={`group text-left rounded-xl border transition-all cursor-pointer flex flex-col overflow-hidden focus-visible:outline-2 focus-visible:outline-[var(--g)] ${
                    isSelected
                      ? 'bg-[var(--g-soft)]/55 border-[var(--g)] ring-1 ring-[var(--g)]/55 shadow-sm'
                      : 'bg-[var(--surface-2)]/45 border-[var(--line)] hover:border-[var(--g)]/55 hover:bg-[var(--surface-2)]/75'
                  }`}
                >
                  {/* Stall Top Rail */}
                  <div
                    className={`px-2 py-1 mland:px-1.5 mland:py-0.5 flex items-center justify-between gap-1 text-[10px] mland:text-[8.5px] tabular border-b ${
                      isSelected
                        ? 'bg-[var(--g)]/12 border-[var(--g)]/30'
                        : 'bg-[var(--surface)]/75 border-[var(--line)]/70'
                    }`}
                  >
                    <span className="truncate font-bold text-[var(--ink)]">
                      {q.ro}
                      <span className={`font-medium ${isStarter ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                        {isStarter ? ' · ตัวจริง' : ' · สำรอง'}
                      </span>
                    </span>
                    <span className="font-extrabold text-[var(--ink)] shrink-0">OVR {q.ov}</span>
                  </div>

                  {/* Locker Compartment Interior */}
                  <div className="relative mx-2 mt-2 mland:mx-1.5 mland:mt-1.5 rounded-lg bg-gradient-to-b from-[#1a2922] via-[#101a16] to-[#0a110e] border border-white/10 pt-3 pb-2 mland:pt-2 mland:pb-1.5 px-2 flex items-center justify-center overflow-hidden shadow-inner">
                    {/* Locker Top Vent Slits & Hanger Rod */}
                    <div
                      aria-hidden="true"
                      className="absolute top-1 left-2 flex items-center gap-[2px] opacity-35"
                    >
                      <span className="w-[2px] h-1.5 rounded-full bg-white/70" />
                      <span className="w-[2px] h-1.5 rounded-full bg-white/70" />
                      <span className="w-[2px] h-1.5 rounded-full bg-white/70" />
                    </div>
                    <div
                      aria-hidden="true"
                      className={`absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full ${
                        isSelected ? 'bg-emerald-300/65' : 'bg-white/20'
                      }`}
                    />
                    {isSelected && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-3 top-0 h-8 bg-gradient-to-b from-emerald-400/20 to-transparent"
                      />
                    )}

                    {/* Hanging Jersey */}
                    <div className="relative z-10 shrink-0 [&>svg]:w-[54px] [&>svg]:h-[54px] mland:[&>svg]:w-[42px] mland:[&>svg]:h-[42px] drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)] transition-transform duration-150 group-hover:scale-[1.03]">
                      <KitJersey
                        club={clubIdentity}
                        away={kitSide === 'away'}
                        size={54}
                        team={team}
                        shirtNo={no}
                        isGK={q.pos === 'GK'}
                      />
                    </div>

                    {/* Docked Player Portrait */}
                    <div className="absolute bottom-1.5 right-1.5 mland:bottom-1 mland:right-1 z-20 w-8 h-8 mland:w-6.5 mland:h-6.5 rounded-full bg-[#0a130f]/95 border border-white/20 shadow-md flex items-center justify-center overflow-hidden [&>svg]:w-[28px] [&>svg]:h-[30px] mland:[&>svg]:w-[22px] mland:[&>svg]:h-[24px]">
                      <PlayerFace player={{ ...q, no }} team={team} state={state} size={28} />
                    </div>
                  </div>

                  {/* Locker Nameplate */}
                  <div className="px-2 py-1.5 mland:px-1.5 mland:py-1 flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate flex items-center gap-1 min-w-0">
                      {isMe ? (
                        <span className="text-[#9a6700] dark:text-[var(--lamp)] shrink-0" title="ตัวคุณ">
                          ★
                        </span>
                      ) : null}
                      {isCap ? <CaptainBadge team={team} state={state} size="xs" className="shrink-0" /> : null}
                      <span className="truncate">{q.n}</span>
                    </span>
                    <span
                      className={`text-xs mland:text-[10px] font-extrabold font-display tabular shrink-0 ${
                        isSelected ? 'text-[var(--g)]' : 'text-[var(--ink)]'
                      }`}
                    >
                      #{no}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {!filteredPlayers.length && (
            <div className="py-12 text-center text-xs text-[var(--mut)]">
              ไม่มีนักเตะในหมวดหมู่นี้
            </div>
          )}
        </div>

        {/* Right: Selected Locker Spotlight & 1–99 Number Assignment */}
        <div className="min-h-0 overflow-y-auto rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 flex flex-col gap-2.5 mland:gap-1.5">
          {selectedPlayer ? (
            <>
              {/* Selected Player Showcase */}
              <div className="flex items-center gap-2.5 mland:gap-2 pb-2.5 mland:pb-1.5 border-b border-[var(--line)]">
                <div className="relative shrink-0 rounded-xl bg-gradient-to-b from-[#1a2922] via-[#101a16] to-[#0a110e] border border-white/10 p-2 mland:p-1.5 flex items-center justify-center shadow-inner">
                  <div className="[&>svg]:w-[58px] [&>svg]:h-[58px] mland:[&>svg]:w-[44px] mland:[&>svg]:h-[44px] drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]">
                    <KitJersey
                      club={clubIdentity}
                      away={kitSide === 'away'}
                      size={58}
                      team={team}
                      shirtNo={selectedNo}
                      isGK={selectedPlayer.pos === 'GK'}
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 mland:w-6.5 mland:h-6.5 rounded-full bg-[#0b1410] border border-white/25 shadow-md flex items-center justify-center overflow-hidden [&>svg]:w-[28px] [&>svg]:h-[30px] mland:[&>svg]:w-[22px] mland:[&>svg]:h-[24px]">
                    <PlayerFace player={{ ...selectedPlayer, no: selectedNo }} team={team} state={state} size={28} />
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-1 mland:space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm mland:text-[11px] font-extrabold font-display text-[var(--ink)] truncate flex items-center gap-1">
                        {isSelectedMe ? (
                          <span className="text-[#9a6700] dark:text-[var(--lamp)] shrink-0">★</span>
                        ) : null}
                        {team.cap === selectedPlayer.n ? (
                          <CaptainBadge team={team} state={state} size="sm" className="shrink-0" />
                        ) : null}
                        <span className="truncate">{selectedPlayer.n}</span>
                      </div>
                      <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate tabular mt-0.5">
                        <span>{selectedPlayer.ro}</span>
                        <span aria-hidden="true"> · </span>
                        <span className={isSelectedStarter ? 'text-[var(--g)] font-semibold' : ''}>
                          {isSelectedStarter ? 'ตัวจริง' : 'สำรอง'}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>อายุ {selectedPlayer.age}</span>
                        <span aria-hidden="true"> · </span>
                        <span>OVR {selectedPlayer.ov}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right leading-none">
                      <div className="text-lg sm:text-xl mland:text-sm font-extrabold font-display tabular text-[var(--g)]">
                        #{selectedNo}
                      </div>
                      <div className="text-[9px] mland:text-[7.5px] text-[var(--mut)] mt-0.5">
                        {kitSide === 'home' ? 'ชุดเหย้า' : 'ชุดเยือน'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      onInspectPlayer(selectedPlayer, team);
                    }}
                    className="inline-flex items-center gap-1 text-[10.5px] mland:text-[8.5px] font-bold text-[var(--g)] hover:underline cursor-pointer"
                  >
                    <span>เปิดการ์ดข้อมูลนักเตะ</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

              {/* Position Traditional Shirt Number Quick-Picks */}
              {shirtGuide && quickRecommendedNumbers.length > 0 && (
                <div className="pb-2 mland:pb-1.5 border-b border-[var(--line)]/80 space-y-1.5 mland:space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[8.5px]">
                    <span className="font-bold text-[var(--ink)] truncate">{shirtGuide.label}</span>
                    <span className="text-[var(--mut)] shrink-0">เบอร์แนะนำตำแหน่ง</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {quickRecommendedNumbers.map((num) => {
                      const holder = numberHolderMap.get(num);
                      const isCurrent = holder?.n === selectedPlayer.n || num === selectedNo;
                      const isTaken = Boolean(holder && !isCurrent);
                      const isPrimary = primaryRecSet.has(num);

                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={!canEditSelected || isCurrent}
                          onClick={() => handleAssignNumber(selectedPlayer, num)}
                          title={
                            isCurrent
                              ? `ใช้อยู่แล้ว (#${num})`
                              : isTaken
                                ? `สลับกับ ${holder!.n} (#${num})`
                                : `เลือกเบอร์ #${num}`
                          }
                          className={`h-6 mland:h-5 px-2 mland:px-1.5 rounded-md border text-[10.5px] mland:text-[8.5px] font-extrabold tabular inline-flex items-center gap-1 transition-colors cursor-pointer disabled:cursor-default ${
                            isCurrent
                              ? 'bg-[var(--g)] border-[var(--g)] text-white'
                              : isTaken
                                ? 'bg-[var(--lamp-soft)]/50 border-[var(--lamp)]/60 text-[var(--ink)] hover:bg-[var(--lamp-soft)]/85 disabled:opacity-45'
                                : isPrimary
                                  ? 'bg-[var(--g-soft)] border-[var(--g)]/50 text-[var(--g)] hover:bg-[var(--g)] hover:text-white disabled:opacity-45'
                                  : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)] hover:text-[var(--g)] disabled:opacity-45'
                          }`}
                        >
                          <span>#{num}</span>
                          {isTaken && <ArrowLeftRight className="w-2.5 h-2.5 opacity-80" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4-Page 5x5 Number Board (1–99) */}
              <div className="space-y-2 mland:space-y-1.5 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] whitespace-nowrap">
                    เลือกเบอร์เสื้อ (1–99)
                  </span>
                  <div className="seg-bar grid grid-cols-4 flex-1 max-w-[228px]">
                    {NUMBER_PAGES.map((pg, idx) => {
                      const active = numPage === idx;
                      const containsCurrent = selectedNo >= pg.start && selectedNo <= pg.end;
                      return (
                        <button
                          key={pg.label}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            setNumPage(idx);
                          }}
                          className={`seg-btn px-1! py-0.5! text-[10px] mland:text-[8.5px] tabular whitespace-nowrap ${
                            active ? 'seg-btn-active' : containsCurrent ? 'text-[var(--g)]! font-extrabold!' : ''
                          }`}
                          title={`หน้า ${idx + 1}: เบอร์ ${pg.label}${containsCurrent ? ' (เบอร์ปัจจุบันอยู่ในหน้านี้)' : ''}`}
                        >
                          {pg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5 mland:gap-1">
                  {activePageSpec.nums.map((num) => {
                    const holder = numberHolderMap.get(num);
                    const isCurrent = holder?.n === selectedPlayer.n;
                    const isTaken = Boolean(holder && !isCurrent);
                    const isPrimaryRec = primaryRecSet.has(num);
                    const isAltRec = !isPrimaryRec && altRecSet.has(num);
                    const holderShort = holder ? holder.n.split(' ')[0] : '';

                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={!canEditSelected || isCurrent}
                        onClick={() => handleAssignNumber(selectedPlayer, num)}
                        title={
                          isCurrent
                            ? `เบอร์ปัจจุบันของ ${selectedPlayer.n}`
                            : isTaken
                              ? `เบอร์ #${num} เป็นของ ${holder!.n} (${holder!.ro}) — แตะเพื่อสลับ`
                              : `เบอร์ #${num} ว่าง${isPrimaryRec || isAltRec ? ' (เบอร์แนะนำประจำตำแหน่ง)' : ''} — แตะเพื่อเลือก`
                        }
                        className={`relative h-10 mland:h-7 rounded-lg border px-1 transition-colors cursor-pointer disabled:cursor-default flex flex-col items-center justify-center leading-none ${
                          isCurrent
                            ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-xs'
                            : isTaken
                              ? 'bg-[var(--lamp-soft)]/50 border-dashed border-[var(--lamp)]/65 text-[var(--ink)] hover:border-[var(--lamp)] hover:bg-[var(--lamp-soft)]/85 disabled:opacity-45'
                              : isPrimaryRec
                                ? 'bg-[var(--g-soft)]/45 border-[var(--g)]/55 text-[var(--ink)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/75 disabled:opacity-45'
                                : isAltRec
                                  ? 'bg-[var(--surface-2)]/70 border-[var(--g)]/35 text-[var(--ink)] hover:border-[var(--g)] hover:text-[var(--g)] disabled:opacity-45'
                                  : 'bg-[var(--surface-2)]/35 border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)] hover:text-[var(--g)] disabled:opacity-45'
                        }`}
                      >
                        <span className="text-xs mland:text-[9.5px] font-extrabold tabular">{num}</span>
                        {isCurrent ? (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] mland:text-[7px] font-bold text-white/95">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        ) : isTaken ? (
                          <span className="mt-0.5 text-[8px] mland:text-[6.5px] font-semibold text-[#855800] dark:text-[var(--lamp)] truncate max-w-full">
                            ⇄ {holderShort}
                          </span>
                        ) : isPrimaryRec || isAltRec ? (
                          <span className="mt-0.5 text-[8px] mland:text-[6.5px] font-bold text-[var(--g)]">
                            แนะนำ
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Board Footer Legend & Pagination */}
                <div className="flex items-center justify-between gap-2 pt-1 text-[10px] mland:text-[8px] text-[var(--mut)] border-t border-[var(--line)]/60">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 min-w-0">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-xs bg-[var(--g)] inline-block" />
                      <span>ใช้อยู่</span>
                    </span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-xs bg-[var(--lamp-soft)] border border-dashed border-[var(--lamp)] inline-block" />
                      <span>⇄ สลับเบอร์</span>
                    </span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-xs bg-[var(--g-soft)] border border-[var(--g)]/60 inline-block" />
                      <span>แนะนำตำแหน่ง</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setNumPage((p) => (p + NUMBER_PAGES.length - 1) % NUMBER_PAGES.length);
                      }}
                      className="px-2 py-0.5 rounded border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--g)] text-[var(--ink)] font-bold cursor-pointer"
                      aria-label="หน้าก่อนหน้า"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setNumPage((p) => (p + 1) % NUMBER_PAGES.length);
                      }}
                      className="px-2 py-0.5 rounded border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--g)] text-[var(--ink)] font-bold cursor-pointer"
                      aria-label="หน้าถัดไป"
                    >
                      ›
                    </button>
                  </div>
                </div>

                {!canEditSelected && (
                  <p className="text-[10px] mland:text-[8px] text-[var(--mut)] leading-snug">
                    ในโหมดนักเตะอาชีพ สามารถปรับเบอร์ของตัวเองได้ หรือใช้ปุ่มจัดเบอร์ออโต้ด้านบน
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--mut)]">
              เลือกนักเตะจากล็อกเกอร์เพื่อจัดการเบอร์เสื้อ
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

