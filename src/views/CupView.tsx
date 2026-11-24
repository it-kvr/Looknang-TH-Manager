import React, { useState } from 'react';
import type { Team, GameState } from '../types/game';
import { fmtMoney } from '../utils/math';
import { RN } from '../data/thaiFootballData';
import { ClubCrest } from '../components/SvgVisuals';

export const CupView: React.FC<{ state: GameState; onInspectTeam: (id: number) => void }> = ({ state, onInspectTeam }) => {
  const [cupTab, setCupTab] = useState<'fa' | 'asia'>('fa');
  const cup = state.cup;
  const ac = state.ac;

  const renderBracketCard = (
    title: string,
    subtitle: string,
    done: boolean,
    alive: boolean,
    round: number,
    ids: number[],
    log: string[],
    prize: string
  ) => {
    const pairs: [Team, Team][] = [];
    if (!done) {
      for (let i = 0; i < ids.length; i += 2) {
        if (state.teams[ids[i]] && state.teams[ids[i + 1]]) {
          pairs.push([state.teams[ids[i]], state.teams[ids[i + 1]]]);
        }
      }
    }
    const champ = done && ids[0] != null ? state.teams[ids[0]] : null;
    return (
      <div className="space-y-4 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
        <div className="p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-3 mland:gap-1.5 shrink-0">
          <div>
            <h3 className="font-bold text-base mland:text-[11px]">{title}</h3>
            <p className="text-xs mland:text-[9.5px] text-[var(--mut)]">{subtitle} · รางวัลแชมป์ {prize}</p>
          </div>
          <div className="text-xs mland:text-[10px] font-bold px-3 mland:px-2 py-1.5 mland:py-0.5 rounded-xl bg-[var(--surface-2)]">
            {done ? (champ ? `🏆 แชมป์: ${champ.name}` : 'จบการแข่งขันแล้ว') : alive ? `✅ อยู่ในเส้นทาง (${RN[round] || 'รอบถัดไป'})` : `❌ ตกรอบแล้ว (${RN[round] || 'กำลังแข่งขัน'})`}
          </div>
        </div>

        <div className="space-y-4 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:grid mland:grid-cols-2 mland:gap-2 mland:overflow-hidden mland:items-stretch">
        {!done && pairs.length > 0 && (
          <div className="p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1 mland:h-full mland:flex mland:flex-col mland:min-h-0">
            <h4 className="font-bold text-sm mland:text-[11px] shrink-0">ประกบคู่ {RN[round]} ({pairs.length} คู่)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-1 gap-2.5 mland:gap-1 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
              {pairs.map(([h, a], idx) => {
                const involvesMe = h.id === state.me || a.id === state.me;
                return (
                  <div key={idx} className={`flex items-center justify-between gap-2 p-2.5 mland:p-1.5 rounded-xl border ${involvesMe ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)]'}`}>
                    <button type="button" onClick={() => onInspectTeam(h.id)} className="flex items-center gap-2 mland:gap-1.5 min-w-0 flex-1 text-left cursor-pointer">
                      <ClubCrest name={h.name} size={22} team={h} club={state.club} isMyClub={h.id === state.me && state.mode === 'm'} />
                      <span className={`text-xs mland:text-[10.5px] truncate ${h.id === state.me ? 'font-bold' : ''}`}>{h.name}</span>
                    </button>
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] px-1">vs</span>
                    <button type="button" onClick={() => onInspectTeam(a.id)} className="flex items-center justify-end gap-2 mland:gap-1.5 min-w-0 flex-1 text-right cursor-pointer">
                      <span className={`text-xs mland:text-[10.5px] truncate ${a.id === state.me ? 'font-bold' : ''}`}>{a.name}</span>
                      <ClubCrest name={a.name} size={22} team={a} club={state.club} isMyClub={a.id === state.me && state.mode === 'm'} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:h-full mland:flex mland:flex-col mland:min-h-0 ${done || pairs.length === 0 ? 'mland:col-span-2' : ''}`}>
          <h4 className="font-bold text-sm mland:text-xs shrink-0">📜 ผลการแข่งขันในรายการ</h4>
          {log.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-1 gap-1.5 max-h-64 mland:max-h-none mland:flex-1 mland:min-h-0 overflow-y-auto pr-0.5">
              {log.slice().reverse().map((l, i) => (
                <div key={i} className={`text-xs p-2 rounded-lg bg-[var(--surface-2)]/70 ${l.includes(state.teams[state.me].name) ? 'font-bold border border-[var(--lamp)]/50' : ''}`}>
                  {l}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--mut)]">ยังไม่เริ่มการแข่งขันรอบแรก</p>
          )}
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
      <div className="grid grid-cols-2 sm:inline-flex mland:inline-flex gap-1 p-1 mland:p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] sm:w-fit mland:w-fit max-w-full shrink-0">
        <button type="button" onClick={() => setCupTab('fa')} className={`px-3 sm:px-4 mland:px-3 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-bold cursor-pointer transition-colors ${cupTab === 'fa' ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
          🏆 ถ้วยประชาชน
        </button>
        <button type="button" onClick={() => setCupTab('asia')} className={`px-3 sm:px-4 mland:px-3 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10.5px] font-bold cursor-pointer transition-colors ${cupTab === 'asia' ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
          🌏 บอลถ้วยทวีป
        </button>
      </div>
      {cupTab === 'fa'
        ? renderBracketCard('🏆 ถ้วยประชาชน (น็อกเอาต์ 16 ทีม)', 'รวมทีมจากทุกระดับลีกในประเทศ แข่งนัดเดียวรู้ผล (เสมอตัดสินจุดโทษ)', cup.done, cup.alive, cup.r, cup.ids, cup.log, fmtMoney(250))
        : ac
          ? renderBracketCard('🌏 ชิงแชมป์สโมสรทวีป (16 ทีม)', 'ตัวแทนลีกสูงสุดไทยปะทะยอดทีมต่างแดนทั่วเอเชีย', ac.done, ac.alive, ac.r, ac.ids, ac.log, fmtMoney(500))
          : null}
    </div>
  );
};

