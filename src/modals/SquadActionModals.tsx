import React, { useMemo, useState } from 'react';
import type { GameState, Player, Team } from '../types/game';
import { clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { ensureCon, logFin, vlu, wagOf } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import {
  getLeagueTransferContext,
  quickSellSquadPlayers,
  releaseSquadPlayers,
  validateBatchSquadRemoval
} from '../engine/simulation';
import { PlayerFace } from '../components/SvgVisuals';
import { SFX } from '../utils/audioTheme';

export const SquadRenewModal: React.FC<{
  state: GameState;
  team: Team;
  player: Player;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ state, team, player, onClose, onUpdateState, onToast }) => {
  const con = ensureCon(player);
  const [renewYr, setRenewYr] = useState<number>(() => Math.max(2, Math.min(5, con.yr + 2)));
  const [renewRole, setRenewRole] = useState<'key' | 'rot' | 'pro'>(
    (con.role as 'key' | 'rot' | 'pro') || (player.ov >= 74 ? 'key' : player.age <= 21 ? 'pro' : 'rot')
  );
  const [renewWb, setRenewWb] = useState<0 | 1 | 2>(1);
  const [renewMsg, setRenewMsg] = useState('');

  const tx = useMemo(() => getLeagueTransferContext(state, team), [state, team]);
  const wf = [0.9, 1.05, 1.25][renewWb];
  const baseWg = Math.max(con.wg || 0.2, wagOf(player));
  const newWg = +(baseWg * wf).toFixed(1);
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
        className="w-full max-w-2xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center gap-3 px-3.5 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <PlayerFace player={player} team={team} state={state} size={42} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm mland:text-xs truncate">📋 ต่อสัญญา · {player.n}</div>
            <div className="text-xs mland:text-[10.5px] text-[var(--mut)] tabular">
              เหลือสัญญา <b>{con.yr} ปี</b> · ค่าเหนื่อยเดิม {fmtMoneyNum(con.wg)}/นัด
            </div>
          </div>
          <span
            className="px-2 py-0.5 rounded-lg text-white font-bold text-xs tabular shrink-0"
            style={{ background: ovColor(player.ov) }}
          >
            {player.ov}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างต่อสัญญา"
            className="btn-icon rounded-full!"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2.5 items-start">
          <div className="space-y-2.5 mland:space-y-2">
            <div>
              <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1">ระยะเวลาสัญญาใหม่</div>
              <div className="grid grid-cols-4 gap-1.5 mland:gap-1">
                {[2, 3, 4, 5].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setRenewYr(y);
                    }}
                    className={`btn btn-sm w-full ${
                      renewYr === y ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {y} ปี
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1">บทบาทในทีม</div>
              <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                {([
                  ['key', '⭐ ตัวหลัก'],
                  ['rot', '🔄 หมุนเวียน'],
                  ['pro', '🌱 ดาวรุ่ง']
                ] as const).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setRenewRole(k);
                    }}
                    className={`btn btn-sm w-full ${
                      renewRole === k ? 'btn-primary' : 'btn-secondary'
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
              <div className="text-xs mland:text-[10.5px] font-bold text-[var(--mut)] mb-1">ระดับค่าเหนื่อยที่เสนอ</div>
              <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                {([
                  ['รัดเข็มขัด (-10%)', 0],
                  ['เพิ่มนิด (+5%)', 1],
                  ['จัดเต็ม (+25%)', 2]
                ] as const).map(([l, k]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setRenewWb(k);
                    }}
                    className={`btn btn-sm w-full truncate ${
                      renewWb === k ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-1.5">
              <div className="flex items-center gap-2 text-xs mland:text-[10.5px]">
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
              <p className="text-xs mland:text-[10.5px] text-[var(--red)] font-semibold">
                ⚠️ ค่าเหนื่อยใหม่จะทำให้ทีมเกินเพดาน {fmtMoneyNum(tx.wageCap)}/นัด
              </p>
            )}
            {renewMsg && <p className="text-xs mland:text-[10.5px] text-[var(--red)]">{renewMsg}</p>}
          </div>
        </div>

        <div className="shrink-0 p-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-md btn-surface"
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
                  const target = d.teams[d.me]?.sq.find((q) => q.n === player.n);
                  if (!target) return;
                  d.money -= bonus;
                  if (bonus) logFin(d, `โบนัสต่อสัญญา ${player.n}`, -bonus);
                  target.con = { yr: renewYr, wg: newWg, role: renewRole };
                });
                onClose();
                onToast(`ต่อสัญญา ${player.n} อีก ${renewYr} ปีแล้ว!`);
              } else {
                SFX.foul();
                setRenewMsg('นักเตะยังไม่พอใจข้อเสนอ ลองเพิ่มค่าเหนื่อยหรือบทบาท');
              }
            }}
            className="btn btn-md btn-gold flex-1"
          >
            {renewOverCap
              ? `เกินเพดาน ${fmtMoneyNum(tx.wageCap)}`
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
  const [pricePct, setPricePct] = useState<number>(85);
  const check = useMemo(
    () => validateBatchSquadRemoval(state, team, playerNames, 'sell', pricePct),
    [state, team, playerNames, pricePct]
  );

  const handleConfirm = () => {
    if (!check.canConfirm) return;
    let soldOut: string[] = [];
    let gainOut = 0;
    let errOut = '';
    onUpdateState((d) => {
      const res = quickSellSquadPlayers(d, playerNames, pricePct);
      if (res.ok) {
        soldOut = res.soldNames;
        gainOut = res.totalGain;
      } else {
        errOut = res.err || 'ขายไม่สำเร็จ';
      }
    });
    if (errOut) {
      SFX.foul();
      onToast(errOut);
      return;
    }
    SFX.coin();
    onClearSelection?.(soldOut.length ? soldOut : check.eligiblePlayers.map((q) => q.n));
    onClose();
    onToast(`ขายนักเตะ ${soldOut.length || check.eligiblePlayers.length} ราย รับ +${fmtMoney(gainOut || check.totalQuickSellValue)}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <div>
            <div className="font-bold text-sm mland:text-xs">💰 ขายนักเตะด่วน ({check.eligiblePlayers.length} ราย)</div>
            <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">
              รับเงินทันทีตามราคาตลาดหรือข้อเสนอสูงสุดที่เข้ามา
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างขายนักเตะ"
            className="btn-icon rounded-full!"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 space-y-2.5">
          {!check.twOpen && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs font-semibold text-rose-300">
              ⛔ ตลาดซื้อขายปิดอยู่ — สามารถขายนักเตะได้เฉพาะช่วงตลาดเปิดเท่านั้น
            </div>
          )}

          {check.eligiblePlayers.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs mland:text-[10.5px]">
                <span className="font-semibold text-[var(--mut)]">ระดับราคาขายด่วน</span>
                <div className="seg-bar">
                  {[75, 85, 95].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setPricePct(pct);
                      }}
                      className={`seg-btn ${
                        pricePct === pct ? 'seg-btn-active' : ''
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                {check.eligiblePlayers.map((q) => {
                  const val = Math.max(5, vlu(q));
                  const quickVal = Math.max(4, Math.round((val * pricePct) / 100));
                  return (
                    <div
                      key={q.n}
                      className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]"
                    >
                      <PlayerFace player={q} team={team} state={state} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{q.n}</div>
                        <div className="text-[10px] text-[var(--mut)]">
                          {q.ro} · อายุ {q.age} · ประเมิน {fmtMoney(val)}
                        </div>
                      </div>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white tabular"
                        style={{ background: ovColor(q.ov) }}
                      >
                        {q.ov}
                      </span>
                      <span className="text-xs font-bold text-emerald-400 tabular">+{fmtMoney(quickVal)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {check.blockedPlayers.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <div className="text-[11px] font-bold text-amber-300">รายการที่ขายไม่ได้:</div>
              {check.blockedPlayers.map((b) => (
                <div key={b.player.n} className="text-[11px] text-[var(--mut)]">
                  • <b>{b.player.n}</b> — {b.reason}
                </div>
              ))}
            </div>
          )}

          {check.squadErrors.length > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 space-y-0.5">
              {check.squadErrors.map((err, i) => (
                <div key={i} className="text-xs font-semibold text-rose-300">
                  ⚠️ {err}
                </div>
              ))}
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] grid grid-cols-3 gap-2 text-center text-xs tabular">
            <div>
              <div className="text-[10px] text-[var(--mut)]">รับเงินรวม</div>
              <div className="font-bold text-emerald-400">+{fmtMoney(check.totalQuickSellValue)}</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--mut)]">ประหยัดค่าเหนื่อย</div>
              <div className="font-bold text-[var(--ink)]">{fmtMoneyNum(check.totalSavedWage)}/นัด</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--mut)]">เหลือในทีม</div>
              <div className="font-bold text-[var(--ink)]">{check.afterSquadCount} คน</div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-md btn-surface"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!check.canConfirm}
            onClick={handleConfirm}
            className="btn btn-md btn-primary flex-1"
          >
            ✅ ยืนยันขาย {check.eligiblePlayers.length} ราย (+{fmtMoney(check.totalQuickSellValue)})
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
  const check = useMemo(
    () => validateBatchSquadRemoval(state, team, playerNames, 'release'),
    [state, team, playerNames]
  );

  const handleConfirm = () => {
    if (!check.canConfirm) return;
    let relOut: string[] = [];
    let costOut = 0;
    let errOut = '';
    onUpdateState((d) => {
      const res = releaseSquadPlayers(d, playerNames);
      if (res.ok) {
        relOut = res.releasedNames;
        costOut = res.cost;
      } else {
        errOut = res.err || 'ปลดนักเตะไม่สำเร็จ';
      }
    });
    if (errOut) {
      SFX.foul();
      onToast(errOut);
      return;
    }
    SFX.confirm();
    onClearSelection?.(relOut.length ? relOut : check.eligiblePlayers.map((q) => q.n));
    onClose();
    onToast(
      `ปล่อยตัวนักเตะ ${relOut.length || check.eligiblePlayers.length} ราย${
        costOut > 0 ? ` (ค่าชดเชย ${fmtMoney(costOut)})` : ''
      }`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 mland:px-3 mland:py-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <div>
            <div className="font-bold text-sm mland:text-xs">🔓 ปล่อยตัว / ยกเลิกสัญญา ({check.eligiblePlayers.length} ราย)</div>
            <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">
              นักเตะยืมตัวจะส่งกลับต้นสังกัดทันทีโดยไม่มีค่าชดเชย
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างปล่อยตัวนักเตะ"
            className="btn-icon rounded-full!"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 space-y-2.5">
          {check.eligiblePlayers.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
              {check.eligiblePlayers.map((q) => {
                const con = ensureCon(q);
                const wg = con.wg || wagOf(q);
                const relCost = q.loan || con.yr <= 0 ? 0 : Math.max(1, Math.round(wg * con.yr * 1.5));
                return (
                  <div
                    key={q.n}
                    className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]"
                  >
                    <PlayerFace player={q} team={team} state={state} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">
                        {q.n} {q.loan ? <span className="text-[10px] text-amber-400">(ยืมตัว)</span> : null}
                      </div>
                      <div className="text-[10px] text-[var(--mut)]">
                        {q.ro} · เหลือ {con.yr} ปี · ค่าเหนื่อย {fmtMoneyNum(wg)}/นัด
                      </div>
                    </div>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white tabular"
                      style={{ background: ovColor(q.ov) }}
                    >
                      {q.ov}
                    </span>
                    <span className={`text-xs font-bold tabular ${relCost > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {relCost > 0 ? `-${fmtMoney(relCost)}` : 'ฟรี'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {check.blockedPlayers.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <div className="text-[11px] font-bold text-amber-300">รายการที่ปล่อยตัวไม่ได้:</div>
              {check.blockedPlayers.map((b) => (
                <div key={b.player.n} className="text-[11px] text-[var(--mut)]">
                  • <b>{b.player.n}</b> — {b.reason}
                </div>
              ))}
            </div>
          )}

          {check.squadErrors.length > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 space-y-0.5">
              {check.squadErrors.map((err, i) => (
                <div key={i} className="text-xs font-semibold text-rose-300">
                  ⚠️ {err}
                </div>
              ))}
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] grid grid-cols-3 gap-2 text-center text-xs tabular">
            <div>
              <div className="text-[10px] text-[var(--mut)]">ค่าชดเชยรวม</div>
              <div className={`font-bold ${check.totalReleaseCost > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {check.totalReleaseCost > 0 ? `-${fmtMoney(check.totalReleaseCost)}` : 'ฟรี'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--mut)]">ประหยัดค่าเหนื่อย</div>
              <div className="font-bold text-[var(--ink)]">{fmtMoneyNum(check.totalSavedWage)}/นัด</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--mut)]">เหลือในทีม</div>
              <div className="font-bold text-[var(--ink)]">{check.afterSquadCount} คน</div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-md btn-surface"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!check.canConfirm}
            onClick={handleConfirm}
            className="btn btn-md btn-danger flex-1"
          >
            🔓 ยืนยันปล่อยตัว {check.eligiblePlayers.length} ราย
            {check.totalReleaseCost > 0 ? ` (-${fmtMoney(check.totalReleaseCost)})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
