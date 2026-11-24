import React, { useEffect, useMemo, useState } from 'react';
import type { GameState, Player, Position, Team } from '../types/game';
import { clamp } from '../utils/math';
import { POS } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import {
  autoAssignAllTeamShirtNumbers,
  getShirtNo,
  getTeamClubIdentity,
  xi
} from '../engine/playerCore';
import { ClubCrest, KitJersey, PlayerFace } from './SvgVisuals';

type LockerFilter = 'ALL' | 'XI' | Position;

const QUICK_NUMBERS = Array.from({ length: 36 }, (_, i) => i + 1);

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
  const [customNo, setCustomNo] = useState<string>(String(selectedNo));

  useEffect(() => {
    if (selectedPlayer) {
      setCustomNo(String(getShirtNo(team, selectedPlayer)));
    }
  }, [selectedPlayer, team]);

  const numberHolderMap = useMemo(() => {
    const map = new Map<number, Player>();
    team.sq.forEach((q) => {
      map.set(getShirtNo(team, q), q);
    });
    return map;
  }, [team]);

  const isSelectedMe = Boolean(selectedPlayer && (selectedPlayer.me || (!isMgr && state.p?.name === selectedPlayer.n)));
  const canEditSelected = Boolean(selectedPlayer && (isMgr || isSelectedMe));
  const isSelectedCap = Boolean(selectedPlayer && team.cap === selectedPlayer.n);

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
    setCustomNo(String(nextNo));

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

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Locker Room Top Controls */}
      <div className="shrink-0 px-3 py-2 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 mland:gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/70 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
            <ClubCrest name={team.name} size={20} team={team} club={state.club} isMyClub={isMgr} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm mland:text-[11px] font-extrabold font-display text-[var(--ink)] truncate">
              ห้องล็อกเกอร์ &amp; เบอร์เสื้อ
            </div>
            <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate tabular">
              <span>{team.name}</span>
              <span aria-hidden="true"> · </span>
              <span>นักเตะ {team.sq.length} คน</span>
              <span aria-hidden="true"> · </span>
              <span>ตัวจริง 11</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mland:gap-1">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
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
                className={`px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-md text-[10.5px] mland:text-[9px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  posFilter === key
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                    : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setKitSide('home');
              }}
              className={`px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-md text-[10.5px] mland:text-[9px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                kitSide === 'home'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--mut)] hover:text-[var(--ink)]'
              }`}
            >
              ชุดเหย้า
            </button>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setKitSide('away');
              }}
              className={`px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-md text-[10.5px] mland:text-[9px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                kitSide === 'away'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--mut)] hover:text-[var(--ink)]'
              }`}
            >
              ชุดเยือน
            </button>
          </div>

          <button
            type="button"
            onClick={handleAutoAssignAll}
            className="px-3 mland:px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--g)] text-white text-[11px] mland:text-[9.5px] font-bold hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            เปลี่ยนเบอร์เสื้อออโต้ทั้งทีม
          </button>
        </div>
      </div>

      {/* Main 2-Column Locker Stage */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_276px] mland:grid-cols-[1fr_230px] gap-2.5 mland:gap-2 overflow-hidden">
        {/* Left: Locker Stalls Grid */}
        <div className="min-h-0 overflow-y-auto rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 mland:p-1.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mland:gap-1.5">
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
                  className={`group text-left rounded-xl border p-2 mland:p-1.5 transition-all cursor-pointer flex flex-col gap-1.5 mland:gap-1 focus-visible:outline-2 focus-visible:outline-[var(--g)] ${
                    isSelected
                      ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/40 shadow-xs'
                      : 'bg-[var(--surface-2)]/60 border-[var(--line)] hover:border-[var(--g)]/60'
                  }`}
                >
                  {/* Locker Header Meta (Unboxed Clean Typography) */}
                  <div className="flex items-center justify-between gap-1 text-[10px] mland:text-[8.5px] tabular">
                    <span className="font-bold text-[var(--ink)] truncate">
                      {q.ro}
                      <span className="text-[var(--mut)] font-medium">
                        {isStarter ? ' · ตัวจริง' : ' · สำรอง'}
                      </span>
                    </span>
                    <span className="font-extrabold text-[var(--g)] shrink-0">OVR {q.ov}</span>
                  </div>

                  {/* Locker Display: Club Kit Jersey + Player Face */}
                  <div className="relative rounded-lg bg-gradient-to-b from-[#17231e] to-[#0c1411] border border-white/10 py-2 mland:py-1 px-2 flex items-center justify-center gap-2 overflow-hidden">
                    <div className="shrink-0 [&>svg]:w-[52px] [&>svg]:h-[52px] mland:[&>svg]:w-[42px] mland:[&>svg]:h-[42px] drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]">
                      <KitJersey
                        club={clubIdentity}
                        away={kitSide === 'away'}
                        size={52}
                        team={team}
                        shirtNo={no}
                        isGK={q.pos === 'GK'}
                      />
                    </div>
                    <div className="shrink-0 [&>svg]:w-[36px] [&>svg]:h-[38px] mland:[&>svg]:w-[28px] mland:[&>svg]:h-[30px] drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
                      <PlayerFace player={{ ...q, no }} team={team} state={state} size={36} />
                    </div>
                  </div>

                  {/* Locker Nameplate */}
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate">
                      {isMe ? '★ ' : ''}
                      {isCap ? '(C) ' : ''}
                      {q.n}
                    </span>
                    <span className="text-xs mland:text-[10px] font-extrabold font-display tabular text-[var(--g)] shrink-0">
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

        {/* Right: Selected Locker Inspector & Number Board */}
        <div className="min-h-0 overflow-y-auto rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 flex flex-col gap-2.5 mland:gap-1.5">
          {selectedPlayer ? (
            <>
              <div className="flex items-center gap-2.5 mland:gap-2 pb-2 mland:pb-1.5 border-b border-[var(--line)]">
                <div className="shrink-0 rounded-xl bg-gradient-to-b from-[#17231e] to-[#0c1411] border border-white/10 p-1.5 flex items-center justify-center [&>svg]:w-[52px] [&>svg]:h-[52px] mland:[&>svg]:w-[42px] mland:[&>svg]:h-[42px]">
                  <KitJersey
                    club={clubIdentity}
                    away={kitSide === 'away'}
                    size={52}
                    team={team}
                    shirtNo={selectedNo}
                    isGK={selectedPlayer.pos === 'GK'}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs sm:text-sm mland:text-[11px] font-extrabold font-display text-[var(--ink)] truncate">
                      {selectedPlayer.n}
                    </span>
                    <span className="text-base mland:text-xs font-extrabold font-display tabular text-[var(--g)] shrink-0">
                      #{selectedNo}
                    </span>
                  </div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate tabular">
                    {selectedPlayer.ro} · อายุ {selectedPlayer.age} · OVR {selectedPlayer.ov}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      onInspectPlayer(selectedPlayer, team);
                    }}
                    className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--g)] hover:underline cursor-pointer"
                  >
                    เปิดการ์ดข้อมูลนักเตะ →
                  </button>
                </div>
              </div>

              {/* Number Board 1-36 */}
              <div className="space-y-1.5 mland:space-y-1">
                <div className="flex items-center justify-between gap-1 text-[10.5px] mland:text-[9px]">
                  <span className="font-bold text-[var(--ink)]">กระดานเบอร์เสื้อ (1–36)</span>
                  <span className="text-[var(--mut)]">คลิกเพื่อเปลี่ยน/สลับ</span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {QUICK_NUMBERS.map((num) => {
                    const holder = numberHolderMap.get(num);
                    const isCurrent = holder?.n === selectedPlayer.n;
                    const isTaken = Boolean(holder && !isCurrent);

                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={!canEditSelected}
                        onClick={() => handleAssignNumber(selectedPlayer, num)}
                        title={
                          isCurrent
                            ? `เบอร์ปัจจุบันของ ${selectedPlayer.n}`
                            : isTaken
                              ? `เบอร์ #${num} เป็นของ ${holder!.n} (คลิกเพื่อสลับ)`
                              : `เบอร์ #${num} ว่าง (คลิกเพื่อเลือก)`
                        }
                        className={`h-7 mland:h-6 rounded-lg border text-[11px] mland:text-[9.5px] font-extrabold tabular transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex flex-col items-center justify-center leading-none ${
                          isCurrent
                            ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-xs'
                            : isTaken
                              ? 'bg-[var(--surface-2)]/70 border-dashed border-[var(--line)] text-[var(--mut)] hover:border-[var(--lamp)] hover:text-[var(--ink)]'
                              : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)] hover:text-[var(--g)]'
                        }`}
                      >
                        <span>{num}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Number Input 1-99 */}
              <div className="space-y-1 pt-1 border-t border-[var(--line)]">
                <label className="block text-[10.5px] mland:text-[9px] font-bold text-[var(--ink)]">
                  กำหนดเบอร์เอง (1–99)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    disabled={!canEditSelected}
                    value={customNo}
                    onChange={(e) => setCustomNo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canEditSelected) {
                        e.preventDefault();
                        handleAssignNumber(selectedPlayer, parseInt(customNo, 10) || selectedNo);
                      }
                    }}
                    className="w-20 px-2 py-1.5 mland:py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] font-extrabold text-center tabular disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={!canEditSelected}
                    onClick={() => handleAssignNumber(selectedPlayer, parseInt(customNo, 10) || selectedNo)}
                    className="flex-1 py-1.5 mland:py-1 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    บันทึกเบอร์
                  </button>
                </div>
                {!canEditSelected && (
                  <p className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">
                    ในโหมดนักเตะอาชีพ สามารถปรับเบอร์ของตัวเองได้ หรือใช้ปุ่มเปลี่ยนเบอร์ออโต้ทั้งทีมด้านบน
                  </p>
                )}
              </div>

              {/* Captain Toggle (Manager Mode) */}
              {isMgr && (
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onUpdateState((d) => {
                      d.teams[d.me].cap = selectedPlayer.n;
                    });
                    onToast(`แต่งตั้ง ${selectedPlayer.n} เป็นกัปตันทีมแล้ว`);
                  }}
                  className={`mt-auto w-full py-2 mland:py-1.5 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-bold cursor-pointer transition-colors ${
                    isSelectedCap
                      ? 'bg-[var(--lamp)] text-[#261900]'
                      : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                  }`}
                >
                  {isSelectedCap ? 'กัปตันทีมปัจจุบัน' : 'แต่งตั้งเป็นกัปตันทีม'}
                </button>
              )}
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
