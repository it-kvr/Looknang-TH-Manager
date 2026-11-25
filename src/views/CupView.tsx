import React, { useState } from 'react';
import type { Team, GameState } from '../types/game';
import { fmtMoney } from '../utils/math';
import { RN } from '../data/thaiFootballData';
import { EXTRA_CUP_META } from '../engine/simulation';
import { ClubCrest } from '../components/SvgVisuals';

type CupTabId = 'fa' | 'lc' | 'dc' | 'sc' | 'asia';

export const CupView: React.FC<{ state: GameState; onInspectTeam: (id: number) => void }> = ({ state, onInspectTeam }) => {
  const [cupTab, setCupTab] = useState<CupTabId>('fa');
  const myTeamName = state.teams[state.me]?.name || '';
  const cup = state.cup;
  const lc = state.lc;
  const dc = state.dc;
  const sc = state.sc;
  const ac = state.ac;

  const renderBracketCard = (
    title: string,
    subtitle: string,
    done: boolean,
    alive: boolean,
    round: number,
    ids: number[],
    log: string[],
    prize: string,
    isSingleFinal = false
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
    const roundLbl = isSingleFinal ? 'ชิงชนะเลิศ' : RN[round] || `รอบ ${round + 1}`;
    const neverEntered = !alive && !ids.includes(state.me) && !log.some((l) => myTeamName && l.includes(myTeamName));
    const statusText = done
      ? champ
        ? `🏆 แชมป์: ${champ.name}`
        : 'จบการแข่งขันแล้ว'
      : alive
        ? `✅ อยู่ในเส้นทาง (${roundLbl})`
        : neverEntered
          ? '➖ ไม่ได้ร่วมรายการนี้ในซีซั่นนี้'
          : `❌ ตกรอบแล้ว (${roundLbl})`;

    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
        <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 mland:gap-1.5 shrink-0">
          <div>
            <h3 className="font-bold text-sm mland:text-[11px]">{title}</h3>
            <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">{subtitle} · รางวัลแชมป์ {prize}</p>
          </div>
          <div className="text-[11px] mland:text-[10px] font-bold px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-xl bg-[var(--surface-2)]">
            {statusText}
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-2 gap-2.5 mland:gap-2 overflow-hidden items-stretch">
          {!done && pairs.length > 0 && (
            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1 h-full flex flex-col min-h-0">
              <h4 className="font-bold text-xs mland:text-[11px] shrink-0">
                ประกบคู่ {roundLbl} ({pairs.length} คู่)
              </h4>
              <div className="grid grid-cols-1 gap-2 mland:gap-1 flex-1 min-h-0 overflow-y-auto pr-0.5 content-start">
                {pairs.map(([h, a], idx) => {
                  const involvesMe = h.id === state.me || a.id === state.me;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between gap-2 p-2 mland:p-1.5 rounded-xl border ${
                        involvesMe ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onInspectTeam(h.id)}
                        className="flex items-center gap-2 mland:gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <ClubCrest name={h.name} size={22} team={h} club={state.club} isMyClub={h.id === state.me && state.mode === 'm'} />
                        <span className={`text-xs mland:text-[10.5px] truncate ${h.id === state.me ? 'font-bold' : ''}`}>{h.name}</span>
                      </button>
                      <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] px-1">vs</span>
                      <button
                        type="button"
                        onClick={() => onInspectTeam(a.id)}
                        className="flex items-center justify-end gap-2 mland:gap-1.5 min-w-0 flex-1 text-right cursor-pointer"
                      >
                        <span className={`text-xs mland:text-[10.5px] truncate ${a.id === state.me ? 'font-bold' : ''}`}>{a.name}</span>
                        <ClubCrest name={a.name} size={22} team={a} club={state.club} isMyClub={a.id === state.me && state.mode === 'm'} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={`p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 h-full flex flex-col min-h-0 ${
              done || pairs.length === 0 ? 'col-span-2' : ''
            }`}
          >
            <h4 className="font-bold text-xs shrink-0">📜 ผลการแข่งขันในรายการ</h4>
            {log.length ? (
              <div className="grid grid-cols-1 gap-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5 content-start">
                {log.slice().reverse().map((l, i) => (
                  <div
                    key={i}
                    className={`text-xs p-2 rounded-lg bg-[var(--surface-2)]/70 ${
                      myTeamName && l.includes(myTeamName) ? 'font-bold border border-[var(--lamp)]/50' : ''
                    }`}
                  >
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

  const tabs: { id: CupTabId; label: string; dot?: boolean }[] = [
    { id: 'fa', label: '🏆 ถ้วยประชาชน', dot: state.pc },
    { id: 'lc', label: `${EXTRA_CUP_META.lc.icon} ${EXTRA_CUP_META.lc.short}`, dot: state.plc },
    { id: 'dc', label: `${EXTRA_CUP_META.dc.icon} ${EXTRA_CUP_META.dc.short}`, dot: state.pdc },
    { id: 'sc', label: `${EXTRA_CUP_META.sc.icon} ${EXTRA_CUP_META.sc.short}`, dot: state.psc },
    { id: 'asia', label: '🌏 บอลถ้วยทวีป', dot: state.pa }
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      <div className="seg-bar w-fit max-w-full overflow-x-auto no-scrollbar shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setCupTab(t.id)}
            className={`seg-btn whitespace-nowrap shrink-0 ${cupTab === t.id ? 'seg-btn-active' : ''}`}
          >
            <span>{t.label}</span>
            {t.dot && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-[var(--lamp)]" />}
          </button>
        ))}
      </div>

      {cupTab === 'fa'
        ? renderBracketCard(
            '🏆 ถ้วยประชาชน (น็อกเอาต์ 16 ทีม)',
            'รวมทีมจากทุกระดับลีก แข่งนัดเดียวรู้ผล (นัดที่ 6, 13, 20, 27)',
            cup.done,
            cup.alive,
            cup.r,
            cup.ids,
            cup.log,
            fmtMoney(250)
          )
        : cupTab === 'lc'
          ? lc
            ? renderBracketCard(
                `${EXTRA_CUP_META.lc.icon} ${EXTRA_CUP_META.lc.name} (16 ทีม)`,
                'ศึกน็อกเอาต์สปีดเกมดุเดือด แข่งกลางสัปดาห์ (นัดที่ 4, 11, 18, 25)',
                lc.done,
                lc.alive,
                lc.r,
                lc.ids,
                lc.log,
                fmtMoney(EXTRA_CUP_META.lc.prize)
              )
            : (
              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-xs text-[var(--mut)]">
                รายการไทยลีก คัพ จะเปิดฉากในฤดูกาลนี้
              </div>
            )
          : cupTab === 'dc'
            ? dc
              ? renderBracketCard(
                  `${EXTRA_CUP_META.dc.icon} ${EXTRA_CUP_META.dc.name} (16 ทีม)`,
                  'เวทีชิงโล่สำหรับทีมลีกจังหวัด & ลีกในประเทศ 2 (นัดที่ 5, 12, 19, 26)',
                  dc.done,
                  dc.alive,
                  dc.r,
                  dc.ids,
                  dc.log,
                  fmtMoney(EXTRA_CUP_META.dc.prize)
                )
              : (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-xs text-[var(--mut)]">
                  รายการถ้วยดิวิชั่น &amp; ภูมิภาค จะเปิดฉากในฤดูกาลนี้
                </div>
              )
            : cupTab === 'sc'
              ? sc
                ? renderBracketCard(
                    `${EXTRA_CUP_META.sc.icon} ${EXTRA_CUP_META.sc.name} (นัดชิงถ้วยเปิดฤดูกาล)`,
                    'แชมป์ลีกสูงสุดปะทะแชมป์ถ้วยประชาชนในนัดเดียว (ช่วงนัดที่ 2)',
                    sc.done,
                    sc.alive,
                    sc.r,
                    sc.ids,
                    sc.log,
                    fmtMoney(EXTRA_CUP_META.sc.prize),
                    true
                  )
                : (
                  <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-xs text-[var(--mut)]">
                    ศึกไทยแลนด์ แชมเปี้ยนส์ คัพ จะเริ่มชิงชัยในช่วงนัดที่ 2
                  </div>
                )
              : ac
                ? renderBracketCard(
                    '🌏 ชิงแชมป์สโมสรทวีป (16 ทีม)',
                    'ตัวแทนลีกสูงสุดไทยปะทะยอดทีมต่างแดนทั่วเอเชีย (นัดที่ 3, 10, 17, 24)',
                    ac.done,
                    ac.alive,
                    ac.r,
                    ac.ids,
                    ac.log,
                    fmtMoney(500)
                  )
                : null}
    </div>
  );
};

