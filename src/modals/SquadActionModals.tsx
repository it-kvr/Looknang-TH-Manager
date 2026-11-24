import React, { useMemo, useState } from 'react';
import type { GameState, Player, Position, Team } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { ROLE_L, SPN } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { ensureCon, logFin, vlu, wagOf } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import {
  batchListOrPitchPlayers,
  getIncomingOffers,
  getLeagueTransferContext,
  quickSellSquadPlayers,
  releaseSquadPlayers,
  validateBatchSquadRemoval
} from '../engine/simulation';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';

export const SquadRenewModal: React.FC<{
  state: GameState;
  team: Team;
  player: Player;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ state, team, player, onClose, onUpdateState, onToast }) => {
  const tx = getLeagueTransferContext(state, team);
  const con = ensureCon(player);
  const [renewYr, setRenewYr] = useState<number>(() => Math.max(2, con.yr + 2 > 5 ? 3 : con.yr + 2));
  const [renewRole, setRenewRole] = useState<'key' | 'rot' | 'pro'>(con.role || 'rot');
  const [renewWb, setRenewWb] = useState<0 | 1 | 2>(1);
  const [msg, setMsg] = useState('');

  const wf = [0.9, 1.05, 1.25][renewWb];
  const newWg = +(wagOf(player) * wf).toFixed(1);
  const bonus = renewWb === 2 ? Math.max(5, Math.round(player.ov / 7)) : renewWb === 1 ? 2 : 0;
  const ch = clamp(
    Math.round(58 + (wf - 1) * 120 + (renewRole === 'key' ? 14 : renewRole === 'rot' ? 4 : -10) + (renewYr >= 3 ? 6 : 0)),
    15,
    98
  );
  const wageDelta = newWg - con.wg;
  const renewOverCap = tx.curWage + wageDelta > tx.wageCap;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92dvh] mland:max-h-[96dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center gap-3 px-3.5 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <PlayerFace player={player} team={team} state={state} size={40} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm mland:text-xs truncate">
              📋 ต่อสัญญา · {player.n} <span className="text-xs text-[var(--g)]">({player.ro})</span>
            </div>
            <div className="text-xs mland:text-[10px] text-[var(--mut)] tabular">
              {con.yr <= 0 ? 'หมดสัญญาแล้ว' : `เหลือสัญญา ${con.yr} ปี`} · ค่าเหนื่อยเดิม {fmtMoneyNum(con.wg)}/นัด · {ROLE_L[con.role]}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-lg text-white font-bold text-xs tabular shrink-0" style={{ background: ovColor(player.ov) }}>
            {player.ov}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างต่อสัญญา"
            className="w-8 h-8 mland:w-7 mland:h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer shrink-0 hover:border-[var(--g)]"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2 items-start">
          <div className="space-y-2.5 mland:space-y-2">
            <div>
              <div className="text-xs mland:text-[10px] font-bold text-[var(--mut)] mb-1">ระยะเวลาสัญญาใหม่</div>
              <div className="grid grid-cols-4 gap-1.5 mland:gap-1">
                {[2, 3, 4, 5].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setRenewYr(y);
                    }}
                    className={`py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-semibold whitespace-nowrap cursor-pointer ${
                      renewYr === y ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'
                    }`}
                  >
                    {y} ปี
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs mland:text-[10px] font-bold text-[var(--mut)] mb-1">บทบาทในทีม</div>
              <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                {([['key', '⭐ ตัวหลัก'], ['rot', '🔄 หมุนเวียน'], ['pro', '🌱 ดาวรุ่ง']] as const).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setRenewRole(k);
                    }}
                    className={`py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-semibold whitespace-nowrap cursor-pointer ${
                      renewRole === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 mland:space-y-2">
            <div>
              <div className="text-xs mland:text-[10px] font-bold text-[var(--mut)] mb-1">ระดับค่าเหนื่อยที่เสนอ</div>
              <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                {([['รัดเข็มขัด (-10%)', 0], ['เพิ่มนิด (+5%)', 1], ['จัดเต็ม (+25%)', 2]] as const).map(([l, k]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setRenewWb(k);
                    }}
                    className={`px-1.5 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-semibold whitespace-nowrap truncate cursor-pointer ${
                      renewWb === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-1.5">
              <div className="flex items-center gap-2 text-xs mland:text-[10px]">
                <span className="whitespace-nowrap font-semibold">โอกาสตกลง</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--g)] transition-all" style={{ width: `${ch}%` }} />
                </div>
                <b className="tabular">{ch}%</b>
              </div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">
                ค่าเหนื่อยใหม่: <b className="text-[var(--ink)]">{fmtMoneyNum(newWg)}/นัด</b>
                {bonus ? ` · โบนัสเซ็น ${fmtMoneyNum(bonus)}` : ''}
              </div>
            </div>

            {renewOverCap && (
              <p className="text-xs mland:text-[10px] text-[var(--red)] font-semibold">
                ค่าเหนื่อยใหม่จะทำให้ทีมเกินเพดาน {fmtMoneyNum(tx.wageCap)}/นัด
              </p>
            )}
            {msg && <p className="text-xs mland:text-[10px] text-[var(--red)] font-semibold">{msg}</p>}
          </div>
        </div>

        <div className="shrink-0 p-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] font-semibold text-xs cursor-pointer whitespace-nowrap"
          >
            ปิด
          </button>
          <button
            type="button"
            disabled={state.money < bonus || renewOverCap}
            onClick={() => {
              if (Math.random() * 100 < ch) {
                SFX.confirm();
                onUpdateState((d) => {
                  const t = d.teams[d.me];
                  const target = t.sq.find((p) => p.n === player.n);
                  if (!target) return;
                  d.money -= bonus;
                  if (bonus) logFin(d, `โบนัสต่อสัญญา ${player.n}`, -bonus);
                  target.con = { yr: renewYr, wg: newWg, role: renewRole };
                });
                onClose();
                onToast(`ต่อสัญญา ${player.n} อีก ${renewYr} ปีแล้ว!`);
              } else {
                SFX.tap();
                setMsg('นักเตะยังไม่พอใจข้อเสนอ ลองเพิ่มค่าเหนื่อยหรือบทบาท');
              }
            }}
            className="flex-1 py-2 mland:py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-xs disabled:opacity-40 cursor-pointer"
          >
            {renewOverCap
              ? `เกินเพดาน ${fmtMoneyNum(tx.wageCap)}`
              : state.money < bonus
                ? 'งบสโมสรไม่พอจ่ายโบนัสเซ็น'
                : `✅ ยืนยันต่อสัญญา (${fmtMoneyNum(newWg)}/นัด${bonus ? `, โบนัส ${fmtMoneyNum(bonus)}` : ''})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export const SquadSellModal: React.FC<{
  state: GameState;
  team: Team;
  playerNames: string[];
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onClearSelection?: (soldNames: string[]) => void;
  onToast: (msg: string) => void;
}> = ({ state, team, playerNames, onClose, onUpdateState, onClearSelection, onToast }) => {
  const tx = getLeagueTransferContext(state, team);
  const [askPct, setAskPct] = useState<85 | 100 | 118>(100);
  const validation = useMemo(
    () => validateBatchSquadRemoval(state, team, playerNames, 'sell', 85),
    [state, team, playerNames]
  );
  const incomingOffers = useMemo(() => getIncomingOffers(state), [state]);

  const canPitchOrList = validation.eligiblePlayers.length > 0;
  const eligibleNames = validation.eligiblePlayers.map((q) => q.n);
  const askTotal = validation.eligiblePlayers.reduce(
    (sum, q) => sum + Math.max(5, Math.round((Math.max(5, vlu(q)) * askPct) / 100)),
    0
  );
  const singlePlayer =
    validation.eligiblePlayers.length === 1 && validation.blockedPlayers.length === 0
      ? validation.eligiblePlayers[0]
      : validation.blockedPlayers.length === 1 && validation.eligiblePlayers.length === 0
        ? validation.blockedPlayers[0].player
        : null;

  const priceOptions: { pct: 85 | 100 | 118; title: string; hint: string }[] = [
    { pct: 85, title: 'ลดราคา 85%', hint: 'โอกาสมีสโมสรยื่นข้อเสนอสูง' },
    { pct: 100, title: 'ราคาตลาด 100%', hint: 'สมดุลระหว่างค่าตัวและความสนใจ' },
    { pct: 118, title: 'โก่งราคา 118%', hint: 'ได้ราคาดี หากมีสโมสรต้องการตัว' }
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92dvh] mland:max-h-[95dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center gap-3 mland:gap-2 px-4 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
          {singlePlayer ? (
            <PlayerFace player={singlePlayer} team={team} state={state} size={42} />
          ) : (
            <div className="w-10 h-10 mland:w-8 mland:h-8 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center shrink-0">
              <ClubCrest
                name={team.name}
                size={28}
                team={team}
                club={state.club}
                isMyClub={team.id === state.me && state.mode === 'm'}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm sm:text-base mland:text-xs truncate">
              {singlePlayer ? (
                <>
                  💰 ขายนักเตะ · {singlePlayer.n}{' '}
                  <span className="text-xs mland:text-[10px] text-[var(--g)]">
                    ({singlePlayer.ro} · {SPN[singlePlayer.ro] || singlePlayer.pos})
                  </span>
                </>
              ) : (
                `💰 ขายนักเตะพร้อมกัน (${playerNames.length} คน)`
              )}
            </h3>
            <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular truncate">
              {singlePlayer
                ? `อายุ ${singlePlayer.age} ปี · ประเมิน ${fmtMoney(Math.max(5, vlu(singlePlayer)))} · ค่าเหนื่อย ${fmtMoneyNum(ensureCon(singlePlayer).wg)}/นัด`
                : tx.tw.open
                  ? `${tx.tw.label} · ขายด่วนรับเงินสดทันที หรือขึ้นบัญชีเสนอขายรับข้อเสนอ`
                  : `${tx.tw.label} · ช่วงปิดตลาดสามารถขึ้นบัญชีขายรอไว้ได้`}
            </p>
          </div>
          {singlePlayer && (
            <span
              className="px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-xl text-white font-bold text-sm mland:text-xs tabular shrink-0"
              style={{ background: ovColor(singlePlayer.ov) }}
            >
              {singlePlayer.ov}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างขายนักเตะ"
            className="w-8 h-8 mland:w-7 mland:h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer shrink-0 hover:border-[var(--g)]"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 grid grid-cols-1 md:grid-cols-[1.12fr_0.88fr] mland:grid-cols-[1.12fr_0.88fr] gap-3 mland:gap-2.5 items-start">
          {/* Left: Selected Players & Squad Guard */}
          <div className="space-y-2.5 mland:space-y-1.5">
            <div className="flex items-center justify-between text-xs mland:text-[10px] font-bold text-[var(--mut)]">
              <span>รายชื่อที่พร้อมขาย ({validation.eligiblePlayers.length} คน)</span>
              <span className="tabular">ประเมินรวม {fmtMoney(validation.totalMarketValue)}</span>
            </div>

            <div className="rounded-xl border border-[var(--line)] divide-y divide-[var(--line)]/60 max-h-[250px] mland:max-h-[165px] overflow-y-auto bg-[var(--surface-2)]/35">
              {validation.eligiblePlayers.map((q) => {
                const mVal = Math.max(5, vlu(q));
                const bestBid = incomingOffers.filter((o) => o.n === q.n).sort((a, b) => b.p - a.p)[0];
                const qVal = Math.max(bestBid?.p || 0, Math.max(4, Math.round((mVal * 85) / 100)));
                const wg = ensureCon(q).wg;
                return (
                  <div key={q.n} className="flex items-center gap-2.5 px-3 py-2 mland:px-2 mland:py-1 text-xs mland:text-[10px]">
                    <PlayerFace player={q} team={team} state={state} size={30} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate flex items-center gap-1">
                        <span className="text-[var(--g)]">{q.ro}</span>
                        <span className="truncate">{q.n}</span>
                        {q.listed ? (
                          <span className="px-1 rounded bg-[var(--lamp-soft)] border border-[var(--lamp)]/45 text-[#8a5b00] dark:text-[var(--lamp)] text-[9.5px] mland:text-[8px] font-bold shrink-0">
                            ตั้งขาย {fmtMoneyNum(q.askPrice || mVal)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular truncate">
                        อายุ {q.age} ปี · ค่าเหนื่อย {fmtMoneyNum(wg)}/นัด · มูลค่า {fmtMoneyNum(mVal)}
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md text-white text-[10px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                      {q.ov}
                    </span>
                    <div className="text-right shrink-0 tabular">
                      <div className="font-bold text-[var(--g)] text-[11px] mland:text-[9.5px]">{fmtMoney(qVal)}</div>
                      <div className="text-[9.5px] text-[var(--mut)]">
                        {bestBid && bestBid.p >= Math.round((mVal * 85) / 100) ? 'ข้อเสนอสูงสุด' : 'ขายด่วน 85%'}
                      </div>
                    </div>
                  </div>
                );
              })}

              {validation.blockedPlayers.map(({ player: q, reason }) => (
                <div key={q.n} className="flex items-center gap-2.5 px-3 py-2 mland:px-2 mland:py-1 text-xs mland:text-[10px] bg-[var(--red-soft)]/45">
                  <PlayerFace player={q} team={team} state={state} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate text-[var(--mut)]">
                      {q.ro} · {q.n}
                    </div>
                    <div className="text-[10px] mland:text-[8.5px] text-[var(--red)] font-semibold truncate">{reason}</div>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--red)] shrink-0">ขายไม่ได้</span>
                </div>
              ))}

              {!validation.eligiblePlayers.length && !validation.blockedPlayers.length && (
                <div className="p-4 text-center text-xs text-[var(--mut)]">ยังไม่ได้เลือกนักเตะ</div>
              )}
            </div>

            {validation.squadErrors.length > 0 && (
              <div className="p-2.5 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/40 text-xs mland:text-[10px] text-[var(--red)] space-y-0.5 font-semibold">
                {validation.squadErrors.map((err, i) => (
                  <div key={i}>⚠️ {err}</div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-4 gap-2 mland:gap-1.5 p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-center tabular">
              <div>
                <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">ขายด่วนรับทันที</div>
                <b className="text-xs sm:text-sm mland:text-[11px] text-[var(--g)]">+{fmtMoney(validation.totalQuickSellValue)}</b>
              </div>
              <div>
                <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">ลดค่าเหนื่อย</div>
                <b className="text-xs sm:text-sm mland:text-[11px] text-[var(--ink)]">-{fmtMoneyNum(validation.totalSavedWage)}/นัด</b>
              </div>
              <div>
                <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">ทีมหลังขาย</div>
                <b className={`text-xs mland:text-[10.5px] ${validation.afterSquadCount < tx.minSquad ? 'text-[var(--red)]' : ''}`}>
                  {validation.afterSquadCount} / ≥{tx.minSquad}
                </b>
              </div>
              <div>
                <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">เหลือตำแหน่ง</div>
                <div className="text-[10px] mland:text-[8.5px] font-bold leading-tight mt-0.5">
                  {(['GK', 'DF', 'MF', 'FW'] as Position[]).map((p, idx) => (
                    <span key={p} className={validation.afterPosCounts[p] < tx.minPos[p] ? 'text-[var(--red)]' : ''}>
                      {idx > 0 ? ' · ' : ''}
                      {p}:{validation.afterPosCounts[p]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Ask Price Options for Listing / Pitching */}
          <div className="space-y-2 mland:space-y-1.5">
            <div className="flex items-center justify-between text-xs mland:text-[10px]">
              <span className="font-bold text-[var(--ink)]">ตั้งราคาขึ้นบัญชี / เสนอขายสโมสรอื่น</span>
              <span className="font-bold text-[var(--g)] tabular">~{fmtMoney(askTotal)}</span>
            </div>

            <div className="space-y-1.5 mland:space-y-1">
              {priceOptions.map((opt) => {
                const optionTotal = validation.eligiblePlayers.reduce(
                  (sum, q) => sum + Math.max(5, Math.round((Math.max(5, vlu(q)) * opt.pct) / 100)),
                  0
                );
                const active = askPct === opt.pct;
                return (
                  <button
                    key={opt.pct}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setAskPct(opt.pct);
                    }}
                    className={`w-full text-left px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      active
                        ? 'border-[var(--g)] bg-[var(--g-soft)]'
                        : 'border-[var(--line)] bg-[var(--surface-2)]/50 hover:border-[var(--mut)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs mland:text-[10.5px]">{opt.title}</div>
                      <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate">{opt.hint}</div>
                    </div>
                    <div className="font-bold text-xs sm:text-sm mland:text-[11px] tabular shrink-0 text-[var(--g)]">
                      {fmtMoney(optionTotal)}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-[10.5px] mland:text-[9px] text-[var(--mut)] leading-snug px-0.5">
              {tx.tw.open
                ? 'กด "ขึ้นบัญชี & เสนอขาย" เพื่อเรียกข้อเสนอราคาตามที่ตั้ง หรือกด "ขายด่วนทันที" เพื่อรับเงินสดเข้าสโมสรเลย'
                : 'ขณะนี้ตลาดปิดอยู่ สามารถขึ้นบัญชีขายรอไว้ล่วงหน้าได้ และจะขายออกได้เมื่อตลาดเปิดรอบถัดไป'}
            </p>
          </div>
        </div>

        <div className="shrink-0 p-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] font-semibold text-xs cursor-pointer"
          >
            ปิด
          </button>

          <button
            type="button"
            disabled={!canPitchOrList}
            onClick={() => {
              let res = { listedCount: 0, pitchedCount: 0, offerCount: 0 };
              onUpdateState((d) => {
                res = batchListOrPitchPlayers(d, eligibleNames, askPct, tx.tw.open);
              });
              SFX.tap();
              onClose();
              onClearSelection?.(eligibleNames);
              if (tx.tw.open) {
                onToast(
                  res.offerCount > 0
                    ? `ขึ้นบัญชีและเสนอขาย ${res.listedCount} คน — มี ${res.offerCount} ข้อเสนอเข้าตลาดแล้ว!`
                    : res.pitchedCount > 0
                      ? `ขึ้นบัญชีและเสนอขาย ${res.listedCount} คนในตลาดแล้ว รอดูข้อเสนอในแท็บขายออก`
                      : `อัปเดตราคาตั้งขาย ${res.listedCount} คนเป็น ${askPct}% แล้ว (เสนอนักเตะไปแล้วในนัดนี้)`
                );
              } else {
                onToast(`ขึ้นบัญชีขาย ${res.listedCount} คนรอไว้สำหรับรอบตลาดเปิดแล้ว`);
              }
            }}
            className="px-3.5 py-2 mland:py-1.5 rounded-xl bg-[var(--g)] text-white font-bold text-xs disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            {tx.tw.open ? `📨 ขึ้นบัญชี & เสนอขาย (${askPct}%)` : `🏷️ ขึ้นบัญชีขายรอตลาด (${eligibleNames.length})`}
          </button>

          <button
            type="button"
            disabled={!validation.canConfirm}
            onClick={() => {
              let result: ReturnType<typeof quickSellSquadPlayers> = { ok: false, count: 0, totalGain: 0, soldNames: [] };
              onUpdateState((d) => {
                result = quickSellSquadPlayers(d, eligibleNames, 85);
              });
              if (!result.ok) {
                onToast(result.err || 'ขายนักเตะไม่สำเร็จ');
                return;
              }
              SFX.win();
              onClearSelection?.(result.soldNames);
              onClose();
              onToast(`✅ ขายนักเตะ ${result.count} คนสำเร็จ! รับเงิน +${fmtMoney(result.totalGain)}`);
            }}
            className="flex-1 py-2 mland:py-1.5 px-4 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-xs disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            {!tx.tw.open
              ? `🔒 ตลาดปิด (${tx.tw.rangeText})`
              : validation.canConfirm
                ? `⚡ ขายด่วนทันที (${validation.eligiblePlayers.length} คน · +${fmtMoney(validation.totalQuickSellValue)})`
                : 'ไม่สามารถขายด่วนได้'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const SquadReleaseModal: React.FC<{
  state: GameState;
  team: Team;
  playerNames: string[];
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onClearSelection?: (releasedNames: string[]) => void;
  onToast: (msg: string) => void;
}> = ({ state, team, playerNames, onClose, onUpdateState, onClearSelection, onToast }) => {
  const tx = getLeagueTransferContext(state, team);
  const validation = useMemo(
    () => validateBatchSquadRemoval(state, team, playerNames, 'release'),
    [state, team, playerNames]
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92dvh] mland:max-h-[95dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <div className="min-w-0">
            <h3 className="font-bold text-sm mland:text-xs text-[var(--red)] truncate">
              🔓 {playerNames.length > 1 ? `ปลด / ยกเลิกสัญญานักเตะ (${playerNames.length} คน)` : `ปลดนักเตะ · ${playerNames[0] || ''}`}
            </h3>
            <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">
              ปล่อยตัวเป็นฟรีเอเยนต์ (หรือส่งนักเตะยืมกลับต้นสังกัด) เพื่อลดเพดานค่าเหนื่อยและเปิดโควตาทีม
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างปลดนักเตะ"
            className="w-8 h-8 mland:w-7 mland:h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer shrink-0 hover:border-[var(--g)]"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 space-y-2.5 mland:space-y-2">
          <div className="rounded-xl border border-[var(--line)] divide-y divide-[var(--line)]/60 max-h-[210px] mland:max-h-[140px] overflow-y-auto bg-[var(--surface-2)]/35">
            {validation.eligiblePlayers.map((q) => {
              const con = ensureCon(q);
              const wg = con.wg || wagOf(q);
              const cost = q.loan || con.yr <= 0 ? 0 : Math.max(1, Math.round(wg * con.yr * 1.5));
              return (
                <div key={q.n} className="flex items-center gap-2 px-2.5 py-1.5 mland:px-2 mland:py-1 text-xs mland:text-[10px]">
                  <PlayerFace player={q} team={team} state={state} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">
                      <span className="text-[var(--g)] mr-1">{q.ro}</span>
                      {q.n}
                      {q.loan ? <span className="ml-1 text-blue-600 dark:text-blue-400">[ยืมตัว]</span> : null}
                    </div>
                    <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] tabular">
                      {q.loan ? 'ส่งกลับต้นสังกัดฟรี' : con.yr <= 0 ? 'หมดสัญญาแล้ว' : `เหลือสัญญา ${con.yr} ปี`} · ค่าเหนื่อย {fmtMoneyNum(wg)}/นัด
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular">
                    <div className={`font-bold text-[11px] mland:text-[9.5px] ${cost > 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                      {cost > 0 ? `-${fmtMoney(cost)}` : 'ฟรี'}
                    </div>
                    <div className="text-[9.5px] text-[var(--mut)]">{q.loan ? 'คืนยืม' : 'ค่าชดเชย'}</div>
                  </div>
                </div>
              );
            })}
            {validation.blockedPlayers.map(({ player: q, reason }) => (
              <div key={q.n} className="flex items-center gap-2 px-2.5 py-1.5 text-xs bg-[var(--red-soft)]/45">
                <span className="font-bold truncate">{q.n}</span>
                <span className="ml-auto text-[var(--red)] text-[10.5px] font-semibold">{reason}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mland:gap-1.5 p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-center tabular">
            <div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ค่าชดเชยรวม</div>
              <b className={`text-sm mland:text-xs ${validation.totalReleaseCost > 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                {validation.totalReleaseCost > 0 ? `-${fmtMoney(validation.totalReleaseCost)}` : 'ฟรี'}
              </b>
            </div>
            <div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ลดค่าเหนื่อย/นัด</div>
              <b className="text-sm mland:text-xs text-[var(--g)]">-{fmtMoneyNum(validation.totalSavedWage)}</b>
            </div>
            <div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ขนาดทีมหลังปลด</div>
              <b className={`text-sm mland:text-xs ${validation.afterSquadCount < tx.minSquad ? 'text-[var(--red)]' : ''}`}>
                {validation.afterSquadCount} / {tx.minSquad}+
              </b>
            </div>
          </div>

          {validation.squadErrors.length > 0 && (
            <div className="p-2.5 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/40 text-xs mland:text-[10px] text-[var(--red)] space-y-0.5 font-semibold">
              {validation.squadErrors.map((err, i) => (
                <div key={i}>⚠️ {err}</div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 p-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] font-semibold text-xs cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!validation.canConfirm}
            onClick={() => {
              const targetNames = validation.eligiblePlayers.map((q) => q.n);
              let result: ReturnType<typeof releaseSquadPlayers> = { ok: false, count: 0, cost: 0, releasedNames: [] };
              onUpdateState((d) => {
                result = releaseSquadPlayers(d, targetNames);
              });
              if (!result.ok) {
                onToast(result.err || 'ไม่สามารถปลดนักเตะได้');
                return;
              }
              SFX.tap();
              onClearSelection?.(result.releasedNames);
              onClose();
              onToast(
                result.count === 1
                  ? `ปลด ${result.releasedNames[0]} ออกจากทีมแล้ว${result.cost > 0 ? ` (ค่าชดเชย ${fmtMoney(result.cost)})` : ''}`
                  : `ปลดนักเตะ ${result.count} คนออกจากทีมแล้ว`
              );
            }}
            className="flex-1 py-2 mland:py-1.5 rounded-xl bg-[var(--red)] text-white font-bold text-xs disabled:opacity-40 cursor-pointer"
          >
            {validation.canConfirm
              ? `🔓 ยืนยันปลด ${validation.eligiblePlayers.length} คน${validation.totalReleaseCost > 0 ? ` (จ่าย ${fmtMoney(validation.totalReleaseCost)})` : ' (ไม่มีค่าใช้จ่าย)'}`
              : 'ไม่สามารถปลดนักเตะที่เลือกได้'}
          </button>
        </div>
      </div>
    </div>
  );
};
