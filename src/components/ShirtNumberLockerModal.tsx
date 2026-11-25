import React, { useMemo, useState } from 'react';
import type { GameState, Player, Team } from '../types/game';
import { clamp } from '../utils/math';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, getTeamClubIdentity } from '../engine/playerCore';
import { KitJersey } from './SvgVisuals';

const ALL_SHIRT_NUMBERS = Array.from({ length: 99 }, (_, i) => i + 1);

export const ShirtNumberLockerModal: React.FC<{
  player: Player;
  team: Team;
  state: GameState;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ player, team, state, onClose, onUpdateState, onToast }) => {
  const [filter, setFilter] = useState<'all' | 'free' | 'taken'>('all');
  const currentNo = getShirtNo(team, player);
  const clubIdentity = useMemo(() => getTeamClubIdentity(team, state), [team, state]);

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
    return { free, taken };
  }, [holderMap, player.n]);

  const visibleNumbers = useMemo(() => {
    if (filter === 'all') return ALL_SHIRT_NUMBERS;
    return ALL_SHIRT_NUMBERS.filter((num) => {
      const h = holderMap.get(num);
      if (filter === 'free') return !h || h.n === player.n;
      return Boolean(h && h.n !== player.n);
    });
  }, [filter, holderMap, player.n]);

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

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/68 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-2 overflow-hidden"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-2xl mland:max-w-[82vw] max-h-[88dvh] mland:max-h-[94dvh] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 rounded-xl bg-gradient-to-b from-[#17231e] to-[#0c1411] border border-white/10 p-1.5 mland:p-1 flex items-center justify-center [&>svg]:w-9 [&>svg]:h-9 mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <KitJersey
                club={clubIdentity}
                away={false}
                size={36}
                team={team}
                shirtNo={currentNo}
                isGK={player.pos === 'GK'}
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm mland:text-xs font-extrabold font-display text-[var(--ink)] truncate">
                👕 ล็อกเกอร์เลือกเบอร์เสื้อ · {player.n}
              </div>
              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
                เบอร์ปัจจุบัน <b className="text-[var(--g)] tabular">#{currentNo}</b> · แตะเบอร์ว่างเพื่อเปลี่ยน หรือแตะเบอร์เพื่อนเพื่อสลับทันที
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดล็อกเกอร์เบอร์เสื้อ"
            className="btn-icon rounded-full shrink-0"
          >
            ✕
          </button>
        </header>

        {/* Filter & Legend Strip */}
        <div className="shrink-0 px-3 py-2 mland:px-2.5 mland:py-1 bg-[var(--surface)]/70 border-b border-[var(--line)]/70 flex flex-wrap items-center justify-between gap-2">
          <div className="seg-bar">
            {([
              ['all', 'ทั้งหมด (1–99)'],
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
                className={`seg-btn ${filter === key ? 'seg-btn-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-[var(--g)] inline-block" />
              <span>ใช้อยู่</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-[var(--surface)] border border-[var(--line)] inline-block" />
              <span>เบอร์ว่าง</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-[var(--lamp-soft)] border border-[var(--lamp)] inline-block" />
              <span>สลับกับเพื่อน</span>
            </span>
          </div>
        </div>

        {/* Number Locker Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 mland:p-2">
          <div className="grid grid-cols-4 sm:grid-cols-6 mland:grid-cols-6 gap-1.5 mland:gap-1">
            {visibleNumbers.map((num) => {
              const holder = holderMap.get(num);
              const isCurrent = holder?.n === player.n || num === currentNo;
              const isTaken = Boolean(holder && !isCurrent);
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
                        : `เบอร์ #${num} ว่าง — แตะเพื่อเลือก`
                  }
                  className={`rounded-xl mland:rounded-lg border px-1.5 py-2 mland:py-1 text-center transition-all flex flex-col items-center justify-center gap-0.5 min-h-[52px] mland:min-h-[42px] ${
                    isCurrent
                      ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-xs cursor-default'
                      : isTaken
                        ? 'bg-[var(--lamp-soft)]/55 border-[var(--lamp)]/55 text-[var(--ink)] hover:border-[var(--lamp)] hover:bg-[var(--lamp-soft)]/90 cursor-pointer'
                        : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/30 cursor-pointer'
                  }`}
                >
                  <span className="text-sm mland:text-xs font-extrabold font-display tabular leading-none">
                    #{num}
                  </span>
                  {isCurrent ? (
                    <span className="text-[9.5px] mland:text-[8px] font-bold text-white/95 leading-tight truncate max-w-full">
                      ✓ ใช้อยู่
                    </span>
                  ) : isTaken ? (
                    <span className="text-[9.5px] mland:text-[8px] font-bold text-[#7a4f00] dark:text-[var(--lamp)] leading-tight truncate max-w-full">
                      ⇄ {holderShortName}
                    </span>
                  ) : (
                    <span className="text-[9.5px] mland:text-[8px] font-medium text-[var(--mut)] leading-tight">
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
