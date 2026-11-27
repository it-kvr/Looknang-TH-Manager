import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Check, Shuffle, X } from 'lucide-react';
import type { GameState, Player, Team } from '../types/game';
import { clamp } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import {
  getShirtNo,
  getTeamClubIdentity,
  getPositionShirtGuide,
  autoAssignAllTeamShirtNumbers
} from '../engine/playerCore';
import { KitJersey, PlayerFace } from './SvgVisuals';

const ALL_SHIRT_NUMBERS = Array.from({ length: 99 }, (_, i) => i + 1);
const NUMBER_PAGES: ReadonlyArray<{ label: string; start: number; end: number }> = [
  { label: '1–25', start: 1, end: 25 },
  { label: '26–50', start: 26, end: 50 },
  { label: '51–75', start: 51, end: 75 },
  { label: '76–99', start: 76, end: 99 }
];

export const ShirtNumberLockerModal: React.FC<{
  player: Player;
  team: Team;
  state: GameState;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ player, team, state, onClose, onUpdateState, onToast }) => {
  const currentNo = getShirtNo(team, player);
  const [filter, setFilter] = useState<'all' | 'recommended' | 'free' | 'taken'>('all');
  const [pageIdx, setPageIdx] = useState<number>(() => clamp(Math.floor((currentNo - 1) / 25), 0, NUMBER_PAGES.length - 1));

  const clubIdentity = useMemo(() => getTeamClubIdentity(team, state), [team, state]);
  const shirtGuide = useMemo(() => getPositionShirtGuide(player.ro, player.pos), [player.ro, player.pos]);
  const primarySet = useMemo(() => new Set(shirtGuide.primary), [shirtGuide.primary]);
  const altSet = useMemo(() => new Set(shirtGuide.alt), [shirtGuide.alt]);

  const holderMap = useMemo(() => {
    const map = new Map<number, Player>();
    team.sq.forEach((q) => {
      map.set(getShirtNo(team, q), q);
    });
    return map;
  }, [team]);

  const counts = useMemo(() => {
    let free = 0;
    let taken = 0;
    ALL_SHIRT_NUMBERS.forEach((num) => {
      const h = holderMap.get(num);
      if (!h) free += 1;
      else if (h.n !== player.n) taken += 1;
    });
    return { free, taken, recommended: new Set([...shirtGuide.primary, ...shirtGuide.alt]).size };
  }, [holderMap, player.n, shirtGuide]);

  const activeRange = NUMBER_PAGES[pageIdx] || NUMBER_PAGES[0];

  const visibleNumbers = useMemo(() => {
    if (filter === 'all') {
      return ALL_SHIRT_NUMBERS.filter((num) => num >= activeRange.start && num <= activeRange.end);
    }
    if (filter === 'recommended') {
      return [...shirtGuide.primary, ...shirtGuide.alt.filter((n) => !primarySet.has(n))];
    }
    return ALL_SHIRT_NUMBERS.filter((num) => {
      const h = holderMap.get(num);
      if (filter === 'free') return !h || h.n === player.n;
      return Boolean(h && h.n !== player.n);
    });
  }, [filter, activeRange, holderMap, player.n, shirtGuide, primarySet]);

  const handleSelectNumber = (rawNum: number) => {
    const nextNo = clamp(Math.round(rawNum) || 1, 1, 99);
    if (nextNo === currentNo) return;

    const currentHolder = team.sq.find((q) => q.n !== player.n && getShirtNo(team, q) === nextNo);
    SFX.tap();
    onUpdateState((d) => {
      const t = d.teams[d.me];
      if (!t) return;
      const pl = t.sq.find((q) => q.n === player.n) || (player.me ? t.sq.find((q) => q.me) : undefined);
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

    if (currentHolder) {
      onToast(`สลับเบอร์ #${nextNo} (${player.n.split(' ')[0]}) ↔ #${currentNo} (${currentHolder.n.split(' ')[0]}) แล้ว`);
    } else {
      onToast(`เปลี่ยนเบอร์เสื้อ ${player.n.split(' ')[0]} เป็น #${nextNo} แล้ว`);
    }
    onClose();
  };

  const handleRandomizeTeamNumbers = () => {
    SFX.tap();
    onUpdateState((d) => {
      const t = d.teams[d.me];
      if (!t) return;
      autoAssignAllTeamShirtNumbers(t, d.mode === 'p' ? d.p : null, true);
    });
    onToast(`สุ่มจัดเบอร์เสื้อให้ ${team.name} ตามตำแหน่ง (1–11 และเบอร์นิยม) แล้ว`);
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/75 flex items-center justify-center p-2.5 sm:p-4 mland:p-2 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-2xl mland:max-w-[82vw] max-h-[calc(var(--app-dvh,1dvh)*88)] mland:max-h-[calc(var(--app-dvh,1dvh)*94)] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <header className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 mland:gap-2 min-w-0">
            <div className="relative shrink-0 rounded-xl bg-gradient-to-b from-[#1a2922] via-[#101a16] to-[#0a110e] border border-white/10 p-1.5 mland:p-1 flex items-center justify-center shadow-inner">
              <div className="[&>svg]:w-10 [&>svg]:h-10 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                <KitJersey
                  club={clubIdentity}
                  away={false}
                  size={40}
                  team={team}
                  shirtNo={currentNo}
                  isGK={player.pos === 'GK'}
                />
              </div>
              <div className="hidden sm:flex absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0b1410] border border-white/25 shadow-md items-center justify-center overflow-hidden [&>svg]:w-[20px] [&>svg]:h-[22px]">
                <PlayerFace player={{ ...player, no: currentNo }} team={team} state={state} size={20} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm mland:text-xs font-extrabold font-display text-[var(--ink)] truncate">
                ล็อกเกอร์เลือกเบอร์เสื้อ · {player.n}
              </div>
              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
                เบอร์ปัจจุบัน <b className="text-[var(--g)] tabular">#{currentNo}</b> · แตะเบอร์ว่างเพื่อเปลี่ยน หรือแตะเบอร์เพื่อนเพื่อสลับทันที
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {state.mode === 'm' && (
              <button
                type="button"
                onClick={handleRandomizeTeamNumbers}
                className="btn btn-xs btn-secondary whitespace-nowrap"
                title="สุ่มจัดเบอร์ใหม่ทั้งสโมสรตามเบอร์ประเพณีของแต่ละตำแหน่ง"
              >
                <Shuffle className="w-3 h-3" />
                <span>สุ่มตามตำแหน่ง</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดล็อกเกอร์เบอร์เสื้อ"
              className="btn-icon rounded-full shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Position Tradition Guide */}
        <div className="shrink-0 px-4 py-2 mland:px-3 mland:py-1 bg-[var(--g-soft)]/30 border-b border-[var(--line)]/70 flex flex-col gap-0.5 text-[10.5px] mland:text-[8.5px]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-extrabold text-[var(--g)]">{shirtGuide.label} ({player.ro || player.pos})</span>
            <span className="text-[var(--ink)] font-semibold tabular">
              เบอร์หลัก (1–11): <b>{shirtGuide.primary.join(', ')}</b>
            </span>
            <span className="text-[var(--mut)] tabular">
              · ทางเลือกยอดนิยม: {shirtGuide.alt.join(', ')}
            </span>
          </div>
          <div className="text-[var(--mut)] leading-snug">{shirtGuide.reason}</div>
        </div>

        {/* Filter & 4-Page Switcher */}
        <div className="shrink-0 px-3 py-2 mland:px-2.5 mland:py-1 bg-[var(--surface)]/80 border-b border-[var(--line)]/70 flex flex-wrap items-center justify-between gap-2">
          <div className="seg-bar overflow-x-auto max-w-full">
            {([
              ['all', 'ทั้งหมด (1–99)'],
              ['recommended', `แนะนำ (${counts.recommended})`],
              ['free', `เบอร์ว่าง (${counts.free})`],
              ['taken', `เบอร์เพื่อน (${counts.taken})`]
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  SFX.tap();
                  setFilter(key);
                }}
                className={`seg-btn whitespace-nowrap shrink-0 ${filter === key ? 'seg-btn-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {filter === 'all' ? (
            <div className="seg-bar grid grid-cols-4">
              {NUMBER_PAGES.map((pg, idx) => {
                const active = pageIdx === idx;
                const hasCurrent = currentNo >= pg.start && currentNo <= pg.end;
                return (
                  <button
                    key={pg.label}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setPageIdx(idx);
                    }}
                    className={`seg-btn px-1.5! tabular whitespace-nowrap ${
                      active ? 'seg-btn-active' : hasCurrent ? 'text-[var(--g)]! font-extrabold!' : ''
                    }`}
                  >
                    {pg.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[var(--g)] inline-block" />
                <span>ใช้อยู่</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[var(--lamp-soft)] border border-[var(--lamp)] inline-block" />
                <span>สลับกับเพื่อน</span>
              </span>
            </div>
          )}
        </div>

        {/* Number Locker Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 mland:p-2">
          <div className="grid grid-cols-5 gap-1.5 mland:gap-1">
            {visibleNumbers.map((num) => {
              const holder = holderMap.get(num);
              const isCurrent = holder?.n === player.n || num === currentNo;
              const isTaken = Boolean(holder && !isCurrent);
              const isPrimaryPos = primarySet.has(num);
              const isAltPos = !isPrimaryPos && altSet.has(num);
              const holderShortName = holder ? holder.n.split(' ')[0] : '';

              return (
                <button
                  key={num}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleSelectNumber(num)}
                  title={
                    isCurrent
                      ? `เบอร์ปัจจุบันของ ${player.n}`
                      : isTaken
                        ? `เบอร์ #${num} เป็นของ ${holder!.n} (${holder!.ro}) — แตะเพื่อสลับ`
                        : `เบอร์ #${num} ว่าง${isPrimaryPos ? ' (เบอร์หลักประจำตำแหน่ง)' : isAltPos ? ' (เบอร์ยอดนิยมประจำตำแหน่ง)' : ''} — แตะเพื่อเลือก`
                  }
                  className={`relative rounded-xl mland:rounded-lg border px-1.5 py-2 mland:py-1 text-center transition-all flex flex-col items-center justify-center gap-0.5 min-h-[52px] mland:min-h-[40px] ${
                    isCurrent
                      ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-xs cursor-default'
                      : isTaken
                        ? 'bg-[var(--lamp-soft)]/55 border-dashed border-[var(--lamp)]/65 text-[var(--ink)] hover:border-[var(--lamp)] hover:bg-[var(--lamp-soft)]/90 cursor-pointer'
                        : isPrimaryPos
                          ? 'bg-[var(--g-soft)]/40 border-[var(--g)]/60 text-[var(--ink)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/70 cursor-pointer'
                          : isAltPos
                            ? 'bg-[var(--surface)] border-[var(--g)]/35 text-[var(--ink)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/30 cursor-pointer'
                            : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/30 cursor-pointer'
                  }`}
                >
                  {(isPrimaryPos || isAltPos) && !isCurrent && (
                    <span
                      className={`text-[7.5px] font-extrabold leading-none ${
                        isPrimaryPos ? 'text-[var(--g)]' : 'text-[var(--mut)]'
                      }`}
                    >
                      {isPrimaryPos ? 'หลัก' : 'นิยม'}
                    </span>
                  )}
                  <span className="text-sm mland:text-xs font-extrabold font-display tabular leading-none">
                    #{num}
                  </span>
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] mland:text-[7.5px] font-bold text-white/95 leading-tight">
                      <Check className="w-2.5 h-2.5" />
                      <span>ใช้อยู่</span>
                    </span>
                  ) : isTaken ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] mland:text-[7.5px] font-bold text-[#7a4f00] dark:text-[var(--lamp)] leading-tight truncate max-w-full">
                      <ArrowLeftRight className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{holderShortName}</span>
                    </span>
                  ) : (
                    <span className="text-[9px] mland:text-[7.5px] font-medium text-[var(--mut)] leading-tight">
                      ว่าง
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

