import React, { useEffect, useState } from 'react';
import type { Position, MainTab, Player, Team, GameState } from '../types/game';
import { R, P, clamp, fmtMoney, fmtMoneyNum } from '../utils/math';
import { CREST_SHAPES, CREST_PATTERNS, CREST_IC, CREST_IC_NAMES, KIT_PATTERNS, KIT_COLLARS } from '../data/crestAndKitData';
import { TN, KIT_P, KIT_SW } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { wagOf, logFin, colDist, ensureClubIdentity } from '../engine/playerCore';
import { sortTable, getStaffState, getLeagueTransferContext, calcMatchdayFinanceEstimate, teamStats } from '../engine/simulation';
import { renderCrestPattern, ClubCrest, KitJersey } from '../components/SvgVisuals';
import { ClubHistoryPanel } from '../components/ClubHistoryPanel';

export const FinanceClubView: React.FC<{
  tab: 'f' | 'u';
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
  onInspectPlayer?: (p: Player, t: Team) => void;
  onOpenSeasonStats?: (season?: number) => void;
  navIntent?: { tab: MainTab; sub?: string; ts: number } | null;
}> = ({ tab, state, onUpdateState, onToast, onInspectPlayer, onOpenSeasonStats, navIntent }) => {
  const [finTab, setFinTab] = useState<'overview' | 'commercial' | 'ledger'>('overview');
  const [clubTab, setClubTab] = useState<'info' | 'infra' | 'identity' | 'activities' | 'legacy'>('info');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'in' | 'out'>('all');

  useEffect(() => {
    if (navIntent?.tab === 'f' && (navIntent.sub === 'overview' || navIntent.sub === 'commercial' || navIntent.sub === 'ledger')) {
      setFinTab(navIntent.sub);
    } else if (
      navIntent?.tab === 'u' &&
      (navIntent.sub === 'info' || navIntent.sub === 'infra' || navIntent.sub === 'identity' || navIntent.sub === 'activities' || navIntent.sub === 'legacy')
    ) {
      setClubTab(navIntent.sub);
    } else if (navIntent?.tab === 'f' && navIntent.sub === 'infra') {
      setClubTab('infra');
    }
  }, [navIntent]);

  const me = state.teams[state.me];
  const est = calcMatchdayFinanceEstimate(state, me);
  const stf = getStaffState(state);

  const upgradeFac = (key: 'st' | 'tr' | 'ya' | 'med' | 'merchLv', title: string, baseCost: number) => {
    const lv = state[key] ?? 1;
    const cost = lv * baseCost;
    if (lv >= 5 || state.money < cost) {
      onToast(lv >= 5 ? 'ระดับสูงสุดแล้ว' : 'งบสโมสรไม่พอ');
      return;
    }
    SFX.tap();
    onUpdateState((d) => {
      d.money -= cost;
      d[key] = (d[key] ?? 1) + 1;
      logFin(d, `อัปเกรด${title} Lv.${d[key]}`, -cost);
    });
    onToast(`อัปเกรด${title}เป็น Lv.${lv + 1} สำเร็จ!`);
  };

  const hireStaff = (role: 'asst' | 'fit' | 'scout' | 'physio', title: string) => {
    const cur = stf[role];
    if (cur >= 3) {
      onToast(`${title} ระดับสูงสุดแล้ว`);
      return;
    }
    const cost = [45, 75, 110][cur];
    if (state.money < cost) {
      onToast(`งบไม่พอ (ต้องการ ${fmtMoney(cost)})`);
      return;
    }
    SFX.tap();
    onUpdateState((d) => {
      d.money -= cost;
      d.staff = { ...getStaffState(d), [role]: cur + 1 };
      logFin(d, `จ้าง/อัปเกรด${title} Lv.${cur + 1}`, -cost);
    });
    onToast(`จ้าง${title} Lv.${cur + 1} เรียบร้อย`);
  };

  const fireStaff = (role: 'asst' | 'fit' | 'scout' | 'physio', title: string) => {
    const cur = stf[role];
    if (cur <= 0) return;
    SFX.tap();
    onUpdateState((d) => {
      d.staff = { ...getStaffState(d), [role]: cur - 1 };
    });
    onToast(`ลดระดับ${title}เหลือ Lv.${cur - 1} (ประหยัดค่าจ้าง ${fmtMoneyNum(1.5)}/นัด)`);
  };

  if (tab === 'f') {
    const tx = getLeagueTransferContext(state, me);
    const bankRemain = state.bankLoan ? state.bankLoan.left * state.bankLoan.per : 0;
    const totalDebt = bankRemain + (state.payDue || 0);
    const tierMult = 1 + me.tier * 0.45;

    const partnerDeals = [
      {
        id: 'drink',
        name: 'เครื่องดื่มเกลือแร่สปอร์ต',
        perMatch: Math.round(5 * tierMult),
        matches: 8,
        signBonus: Math.round(12 * tierMult),
        reqOk: true,
        reqText: 'พร้อมเซ็นสัญญาได้ทันที'
      },
      {
        id: 'apparel',
        name: 'แบรนด์ชุดกีฬาลูกหนังไทย',
        perMatch: Math.round(7 * tierMult),
        matches: 10,
        signBonus: Math.round(15 * tierMult),
        reqOk: (state.fan ?? 55) >= 45,
        reqText: 'ต้องการขวัญแฟนบอล ≥ 45%'
      },
      {
        id: 'telecom',
        name: 'เครือข่ายมือถือ & ถ่ายทอดสด',
        perMatch: Math.round(10 * tierMult),
        matches: 12,
        signBonus: Math.round(22 * tierMult),
        reqOk: me.tier >= 1 || (state.fan ?? 55) >= 65,
        reqText: 'ต้องการอยู่ระดับ D2 ขึ้นไป หรือแฟนบอล ≥ 65%'
      }
    ];

    const loanPackages = [
      { id: 'short', title: 'สินเชื่อหมุนเวียนระยะสั้น', amount: 80, per: 9, left: 10, desc: 'ดอกเบี้ยต่ำ เหมาะอุดงบขาดมือชั่วคราว' },
      { id: 'std', title: 'สินเชื่อมาตรฐานสโมสร', amount: 150, per: 18, left: 10, desc: 'วงเงินสมดุลสำหรับเสริมทัพหรืออัปสิ่งก่อสร้าง' },
      { id: 'big', title: 'สินเชื่อลงทุนโครงสร้างใหญ่', amount: 300, per: 30, left: 12, desc: 'ทุนก้อนโตสำหรับขยายสนามและทีมงาน' }
    ];

    const finEntries = state.finLog || [];
    const totalLogIn = finEntries.filter((x) => x.amt > 0).reduce((a, x) => a + x.amt, 0);
    const totalLogOut = finEntries.filter((x) => x.amt < 0).reduce((a, x) => a + Math.abs(x.amt), 0);
    const filteredEntries = finEntries.filter((x) => (ledgerFilter === 'in' ? x.amt > 0 : ledgerFilter === 'out' ? x.amt < 0 : true));

    const posWageMap: Record<Position, number> = {
      GK: me.sq.filter((q) => q.pos === 'GK').reduce((a, q) => a + wagOf(q), 0),
      DF: me.sq.filter((q) => q.pos === 'DF').reduce((a, q) => a + wagOf(q), 0),
      MF: me.sq.filter((q) => q.pos === 'MF').reduce((a, q) => a + wagOf(q), 0),
      FW: me.sq.filter((q) => q.pos === 'FW').reduce((a, q) => a + wagOf(q), 0)
    };
    const topEarners = me.sq.slice().sort((a, b) => wagOf(b) - wagOf(a)).slice(0, 3);

    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
        {/* Top 4 Financial KPIs */}
        <div className="grid grid-cols-4 gap-2 mland:gap-1.5 shrink-0">
          <div className="p-3.5 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">งบสโมสรปัจจุบัน</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-xs tabular mt-0.5 mland:mt-0 ${state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>
              {fmtMoney(state.money)}
            </div>
            <div className={`text-[11px] mland:text-[8.5px] mt-0.5 mland:mt-0 truncate ${state.money < 0 ? 'text-[var(--red)] font-bold' : 'text-[var(--mut)]'}`}>
              {state.money < 0 ? '⚠️ ติดลบ (ล็อก FFP ซื้อตัว)' : 'สถานะการเงินพร้อมดำเนินการ'}
            </div>
          </div>

          <div className="p-3.5 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">คาดการณ์สุทธิ / นัดเหย้า</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-xs tabular mt-0.5 mland:mt-0 ${est.homeNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
              {est.homeNet >= 0 ? `+${fmtMoneyNum(est.homeNet)}` : fmtMoneyNum(est.homeNet)}
            </div>
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5 mland:mt-0 truncate">
              เกมเยือน: <b className={est.awayNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>{est.awayNet >= 0 ? `+${fmtMoneyNum(est.awayNet)}` : fmtMoneyNum(est.awayNet)}</b>
            </div>
          </div>

          <div className="p-3.5 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">ค่าเหนื่อยนักเตะ / เพดาน</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-xs tabular mt-0.5 mland:mt-0 ${tx.wagePct >= 95 ? 'text-[var(--red)]' : ''}`}>
              {fmtMoneyNum(tx.curWage)} <span className="text-xs mland:text-[9.5px] font-semibold text-[var(--mut)]">/ {fmtMoneyNum(tx.wageCap)}</span>
            </div>
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5 mland:mt-0 truncate">
              ใช้ไป {tx.wagePct}% · สตาฟฟ์ -{fmtMoneyNum(est.staffCost)}/นัด
            </div>
          </div>

          <div className="p-3.5 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">ภาระหนี้คงค้างรวม</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-xs tabular mt-0.5 mland:mt-0 ${totalDebt > 0 ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--g)]'}`}>
              {fmtMoney(totalDebt)}
            </div>
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5 mland:mt-0 truncate">
              ธนาคาร {fmtMoneyNum(bankRemain)} · ค่าตัวปลายปี {fmtMoneyNum(state.payDue || 0)}
            </div>
          </div>
        </div>

        {/* Finance Sub-navigation (3 Focused Commercial & Cashflow Tabs) */}
        <div className="grid grid-cols-3 gap-1 p-1 mland:p-0.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          {(
            [
              ['overview', '📊 กระแสเงิน & แคมเปญ'],
              ['commercial', '💼 สปอนเซอร์ & ตั๋ว'],
              ['ledger', '📒 ธนาคาร & บัญชี']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFinTab(id)}
              className={`px-2 mland:px-1.5 py-2 mland:py-1 rounded-xl mland:rounded-lg text-[11px] sm:text-xs mland:text-[10px] font-bold truncate cursor-pointer transition-colors whitespace-nowrap ${
                finTab === id ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sub-tab 1: Cashflow & Matchday Boosters */}
        {finTab === 'overview' && (
          <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
            <div className="space-y-2.5 mland:space-y-2 h-full overflow-y-auto pr-0.5">
              <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2">
                <h3 className="font-bold text-sm mland:text-xs">💰 ประมาณการกระแสเงินสดต่อแมตช์</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-1.5 text-xs">
                    <div className="font-bold text-[var(--g)] flex justify-between">
                      <span>🏠 เกมเหย้า</span>
                      <span className="tabular">{est.homeNet >= 0 ? `+${fmtMoneyNum(est.homeNet)}` : fmtMoneyNum(est.homeNet)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--mut)]"><span>ค่าตั๋วเข้าชม (~{est.estAtt.toLocaleString()} คน)</span><b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estTicket)}</b></div>
                    <div className="flex justify-between text-[var(--mut)]"><span>ขายของที่ระลึก (Lv.{state.merchLv ?? 1})</span><b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estMerch)}</b></div>
                    <div className="flex justify-between text-[var(--mut)]"><span>สปอนเซอร์หลัก + พาร์ทเนอร์</span><b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estSponsor + est.dealIncome)}</b></div>
                    <div className="flex justify-between text-[var(--mut)] pt-1 border-t border-[var(--line)]/60"><span>รายจ่ายรวม/นัด</span><b className="text-[var(--red)] tabular">-{fmtMoneyNum(est.totalOut)}</b></div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-1.5 text-xs">
                    <div className="font-bold flex justify-between">
                      <span>✈️ เกมเยือน</span>
                      <span className={`tabular ${est.awayNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>{est.awayNet >= 0 ? `+${fmtMoneyNum(est.awayNet)}` : fmtMoneyNum(est.awayNet)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--mut)]"><span>สปอนเซอร์หลัก</span><b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.estSponsor)}</b></div>
                    <div className="flex justify-between text-[var(--mut)]"><span>ดีลพาร์ทเนอร์</span><b className="text-[var(--g)] tabular">+{fmtMoneyNum(est.dealIncome)}</b></div>
                    <div className="flex justify-between text-[var(--mut)]"><span>ค่าเหนื่อยนักเตะ + สตาฟฟ์</span><b className="text-[var(--red)] tabular">-{fmtMoneyNum(est.wageCost + est.staffCost)}</b></div>
                    <div className="flex justify-between text-[var(--mut)] pt-1 border-t border-[var(--line)]/60"><span>ผ่อนเงินกู้ธนาคาร</span><b className="text-[var(--red)] tabular">-{fmtMoneyNum(est.loanCost)}</b></div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">⚖️ สรุปเสถียรภาพการเงิน &amp; เพดาน FFP</span>
                  <span className={`font-bold tabular ${tx.wagePct >= 95 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>
                    เพดานค่าเหนื่อย {tx.wagePct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${clamp(tx.wagePct, 4, 100)}%`,
                      background: tx.wagePct >= 95 ? 'var(--red)' : tx.wagePct >= 80 ? 'var(--lamp)' : 'var(--g)'
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                    <div className="text-[10px] text-[var(--mut)]">เฉลี่ยสุทธิเหย้า/เยือน</div>
                    <div className={`font-bold text-xs tabular ${Math.round((est.homeNet + est.awayNet) / 2) >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                      {Math.round((est.homeNet + est.awayNet) / 2) >= 0
                        ? `+${fmtMoneyNum(Math.round((est.homeNet + est.awayNet) / 2))}`
                        : fmtMoneyNum(Math.round((est.homeNet + est.awayNet) / 2))}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                    <div className="text-[10px] text-[var(--mut)]">อัตราเข้าชมเหย้า</div>
                    <div className="font-bold text-xs tabular">{est.attPct}%</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                    <div className="text-[10px] text-[var(--mut)]">สปอนเซอร์พาร์ทเนอร์</div>
                    <div className="font-bold text-xs tabular">{state.sponsorDeal ? `เหลือ ${state.sponsorDeal.left}น` : 'ว่าง'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 h-full overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-sm mland:text-xs">⚡ มาตรการกระตุ้นนัดถัดไป</h3>
                <span className="text-[11px] text-[var(--mut)]">มีผลทันทีในแมตช์ที่กำลังจะลงแข่ง</span>
              </div>
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-2">
                  <div className="font-bold text-xs">🏆 โบนัสอัดฉีดชัยชนะ (จ่ายเฉพาะเมื่อชนะ)</div>
                  <div className="text-[11px] text-[var(--mut)]">เพิ่มความมุ่งมั่นและโอกาสทำผลงานดีในนัดสำคัญ</div>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      [0, 'ไม่มีโบนัส'],
                      [10, '10k (ขวัญ +)'],
                      [25, '25k (ขวัญ ++)']
                    ] as const).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => onUpdateState((d) => { d.winBonus = v; })}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold cursor-pointer ${
                          (state.winBonus || 0) === v ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] border border-[var(--line)]'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-2">
                  <div className="font-bold text-xs">📣 แคมเปญโปรโมตวันแข่ง</div>
                  <div className="text-[11px] text-[var(--mut)]">
                    {state.promo === 1
                      ? '✅ กำลังใช้งาน: แคมเปญดึงดูดผู้ชม (ตั๋วนัดหน้า +35% และแฟนเข้าชม +15%)'
                      : state.promo === 2
                        ? '✅ กำลังใช้งาน: บูสต์สปอนเซอร์วันแข่ง (+35% รายได้สปอนเซอร์)'
                        : 'เลือกลงทุนโปรโมต 1 นัด เพื่อดันรายได้วันแข่งขัน'}
                  </div>
                  {!state.promo && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={state.money < 15}
                        onClick={() => {
                          onUpdateState((d) => {
                            d.money -= 15;
                            d.promo = 1;
                            logFin(d, 'โปรโมตตั๋ววันแข่ง', -15);
                          });
                          onToast('เปิดแคมเปญโปรโมตตั๋ววันแข่งแล้ว');
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold disabled:opacity-40 cursor-pointer hover:border-[var(--g)]"
                      >
                        โปรโมตตั๋ว (15k)
                      </button>
                      <button
                        type="button"
                        disabled={state.money < 25}
                        onClick={() => {
                          onUpdateState((d) => {
                            d.money -= 25;
                            d.promo = 2;
                            logFin(d, 'บูสต์สปอนเซอร์วันแข่ง', -25);
                          });
                          onToast('เปิดแคมเปญบูสต์สปอนเซอร์แล้ว');
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold disabled:opacity-40 cursor-pointer hover:border-[var(--g)]"
                      >
                        บูสต์สปอนฯ (25k)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sub-tab 2: Sponsors, Partner Deals, Tickets & Merch */}
        {finTab === 'commercial' && (
          <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
            <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-0.5">
              <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
                <h3 className="font-bold text-sm">🤝 สปอนเซอร์หลักคาดอกเสื้อ</h3>
                <div className="space-y-2">
                  {[
                    { idx: 0, title: 'แพ็กเกจมั่นคงสม่ำเสมอ', base: `${fmtMoneyNum(8 + me.tier * 6)} / นัด`, note: 'รับรายได้คงที่ทุกแมตช์ทั้งเหย้าและเยือน' },
                    { idx: 1, title: 'แพ็กเกจโบนัสชัยชนะ', base: `${fmtMoneyNum(4 + me.tier * 4)} + โบนัสชนะ ${fmtMoneyNum(10 + me.tier * 6)}`, note: 'พื้นฐานต่ำกว่า แต่ถ้าชนะรับเงินก้อนโต' },
                    { idx: 2, title: 'แพ็กเกจบิ๊กแมตช์ & ดาร์บี้', base: `${fmtMoneyNum(5 + me.tier * 5)} + ดาร์บี้ ${fmtMoneyNum(18 + me.tier * 8)}`, note: 'จ่ายหนักพิเศษเมื่อลงเล่นเกมดาร์บี้แมตช์' }
                  ].map((opt) => {
                    const active = (state.sp ?? 0) === opt.idx;
                    return (
                      <button
                        key={opt.idx}
                        type="button"
                        onClick={() => onUpdateState((d) => { d.sp = opt.idx; })}
                        className={`w-full p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                          active ? 'bg-[var(--g-soft)] border-[var(--g)]' : 'bg-[var(--surface-2)] border-transparent hover:border-[var(--line)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-bold">
                          <span>{opt.title}</span>
                          <span className="text-[var(--g)] tabular">{opt.base}</span>
                        </div>
                        <div className="text-[11px] text-[var(--mut)] mt-0.5">{opt.note}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">📄 ดีลพาร์ทเนอร์ระยะสั้น</h3>
                  <span className="text-[11px] text-[var(--mut)]">{state.sponsorDeal ? 'มีสัญญาใช้งานอยู่' : 'เลือกเซ็นสัญญาเพิ่มรายได้'}</span>
                </div>
                {state.sponsorDeal ? (
                  <div className="p-3.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/50 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{state.sponsorDeal.name}</span>
                      <span className="text-[var(--g)] tabular">+{fmtMoneyNum(state.sponsorDeal.perMatch)} / นัด</span>
                    </div>
                    <div className="text-[11px] text-[var(--mut)] tabular">
                      เหลืออายุสัญญาอีก {state.sponsorDeal.left} นัด (คาดการณ์รับเพิ่ม {fmtMoney(state.sponsorDeal.left * state.sponsorDeal.perMatch)})
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {partnerDeals.map((deal) => (
                      <div key={deal.id} className="p-3 rounded-xl bg-[var(--surface-2)] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{deal.name}</div>
                          <div className="text-[11px] text-[var(--mut)] tabular">
                            +{fmtMoneyNum(deal.perMatch)}/นัด · {deal.matches} นัด · โบนัสเซ็น +{fmtMoneyNum(deal.signBonus)}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${deal.reqOk ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>{deal.reqText}</div>
                        </div>
                        <button
                          type="button"
                          disabled={!deal.reqOk}
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              d.sponsorDeal = { id: deal.id, name: deal.name, perMatch: deal.perMatch, left: deal.matches };
                              d.money += deal.signBonus;
                              logFin(d, `โบนัสเซ็นสัญญา: ${deal.name}`, deal.signBonus);
                            });
                            onToast(`เซ็นสัญญากับ ${deal.name} สำเร็จ (+${fmtMoney(deal.signBonus)})`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          เซ็นสัญญา
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-0.5">
              <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">🎫 นโยบายราคาตั๋วเข้าชม</h3>
                  <span className="text-xs font-bold text-[var(--g)] tabular">~{est.estAtt.toLocaleString()} / {est.cap.toLocaleString()} ({est.attPct}%)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { idx: 0, label: 'ตั๋วถูก', desc: 'คนดูเยอะ +ขวัญแฟน' },
                    { idx: 1, label: 'ตั๋วกลาง', desc: 'สมดุลคนดู & รายรับ' },
                    { idx: 2, label: 'ตั๋วแพง', desc: 'ทำเงินสูง / คนดูลด' }
                  ].map((opt) => (
                    <button
                      key={opt.idx}
                      type="button"
                      onClick={() => onUpdateState((d) => { d.tp = opt.idx; })}
                      className={`p-2.5 rounded-xl text-left border cursor-pointer ${
                        (state.tp ?? 1) === opt.idx ? 'bg-[var(--g)] text-white border-[var(--g)]' : 'bg-[var(--surface-2)] border-transparent'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.label}</div>
                      <div className={`text-[10px] mt-0.5 ${(state.tp ?? 1) === opt.idx ? 'text-white/85' : 'text-[var(--mut)]'}`}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)] flex items-center justify-between text-xs">
                  <span className="text-[var(--mut)]">รายได้ค่าตั๋วเหย้าโดยประมาณ</span>
                  <b className="text-[var(--g)] tabular">+{fmtMoney(est.estTicket)} / นัดเหย้า</b>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">🛍️ ร้านค้าของที่ระลึกสโมสร</h3>
                  <span className="text-xs font-bold tabular">Lv.{state.merchLv ?? 1}/5</span>
                </div>
                <p className="text-xs text-[var(--mut)]">
                  สร้างรายได้เสริมทุกนัดเหย้า ({fmtMoney(est.estMerch)}/นัด) และช่วยขยายเพดานค่าเหนื่อยลีก +5% ต่อเลเวล
                </p>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((lv) => (
                      <span key={lv} className={`h-2 w-7 rounded-full ${lv <= (state.merchLv ?? 1) ? 'bg-[var(--g)]' : 'bg-[var(--surface-2)]'}`} />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={(state.merchLv ?? 1) >= 5 || state.money < (state.merchLv ?? 1) * 75}
                    onClick={() => upgradeFac('merchLv', 'ร้านค้าของที่ระลึก', 75)}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {(state.merchLv ?? 1) >= 5 ? 'เต็มแล้ว' : `ขยายร้าน ${fmtMoneyNum((state.merchLv ?? 1) * 75)}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bank Loans, Wage Structure & Filterable Ledger */}
        {finTab === 'ledger' && (
          <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
            <div className="space-y-3 mland:space-y-2 h-full overflow-y-auto pr-0.5">
              <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
                <h3 className="font-bold text-sm">🏦 ธนาคาร &amp; จัดการหนี้สิน</h3>
                {state.bankLoan ? (
                  <div className="p-3.5 rounded-xl bg-[var(--surface-2)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>เงินกู้ธนาคารคงค้าง</span>
                      <span className="text-[var(--red)] tabular">{fmtMoney(bankRemain)} ({state.bankLoan.left} งวด)</span>
                    </div>
                    <div className="text-[11px] text-[var(--mut)] tabular">ผ่อนชำระงวดละ {fmtMoney(state.bankLoan.per)} ทุกแมตช์</div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={state.money < state.bankLoan.per}
                        onClick={() => {
                          const per = state.bankLoan!.per;
                          onUpdateState((d) => {
                            if (!d.bankLoan) return;
                            d.money -= per;
                            d.bankLoan.left--;
                            logFin(d, 'ชำระล่วงหน้าเงินกู้ 1 งวด', -per);
                            if (d.bankLoan.left <= 0) d.bankLoan = null;
                          });
                          onToast('ชำระเงินกู้ล่วงหน้า 1 งวดแล้ว');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        จ่าย 1 งวด ({fmtMoneyNum(state.bankLoan.per)})
                      </button>
                      <button
                        type="button"
                        disabled={state.money < bankRemain}
                        onClick={() => {
                          onUpdateState((d) => {
                            d.money -= bankRemain;
                            logFin(d, 'โปะปิดเงินกู้ธนาคาร', -bankRemain);
                            d.bankLoan = null;
                          });
                          onToast('ปิดยอดหนี้ธนาคารทั้งหมดแล้ว');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        โปะปิดทั้งหมด ({fmtMoneyNum(bankRemain)})
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {loanPackages.map((lp) => (
                      <div key={lp.id} className="p-3 rounded-xl bg-[var(--surface-2)] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-xs">{lp.title} (+{fmtMoney(lp.amount)})</div>
                          <div className="text-[11px] text-[var(--mut)] tabular">ผ่อน {fmtMoneyNum(lp.per)} × {lp.left} นัด · {lp.desc}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              d.money += lp.amount;
                              d.bankLoan = { left: lp.left, per: lp.per };
                              logFin(d, `กู้${lp.title}`, lp.amount);
                            });
                            onToast(`รับเงินกู้ +${fmtMoney(lp.amount)} เข้าคลังสโมสรแล้ว`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] text-xs font-bold cursor-pointer shrink-0"
                        >
                          กู้ +{fmtMoneyNum(lp.amount)}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(state.payDue || 0) > 0 && (
                  <div className="p-3 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/40 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-bold">ค้างผ่อนค่าตัวนักเตะปลายปี</div>
                      <div className="text-[11px] text-[var(--mut)] tabular">ยอดคงเหลือ {fmtMoney(state.payDue || 0)} (หักอัตโนมัติเมื่อจบซีซั่น)</div>
                    </div>
                    <button
                      type="button"
                      disabled={state.money < (state.payDue || 0)}
                      onClick={() => {
                        const amt = state.payDue || 0;
                        onUpdateState((d) => {
                          d.money -= amt;
                          d.payDue = 0;
                          logFin(d, 'ชำระยอดผ่อนค่าตัวล่วงหน้า', -amt);
                        });
                        onToast('ชำระยอดค้างผ่อนค่าตัวครบแล้ว');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs font-bold disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      ปิดยอด {fmtMoneyNum(state.payDue || 0)}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                <h3 className="font-bold text-sm">📊 โครงสร้างค่าเหนื่อยรายตำแหน่ง</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(['GK', 'DF', 'MF', 'FW'] as Position[]).map((pos) => (
                    <div key={pos} className="p-2 rounded-xl bg-[var(--surface-2)]">
                      <div className="text-[10px] font-bold text-[var(--mut)]">{pos}</div>
                      <div className="font-bold text-xs tabular mt-0.5">{fmtMoneyNum(posWageMap[pos])}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-1 space-y-1">
                  <div className="text-[11px] font-bold text-[var(--mut)]">นักเตะค่าเหนื่อยสูงสุด 3 อันดับ</div>
                  {topEarners.map((q) => (
                    <div key={q.n} className="flex justify-between text-xs py-1 border-b border-[var(--line)]/50 last:border-0">
                      <span className="truncate">{q.ro} · {q.n}</span>
                      <b className="tabular text-[var(--mut)]">{fmtMoneyNum(wagOf(q))}/นัด</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 h-full flex flex-col min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <h3 className="font-bold text-sm mland:text-xs">📒 สมุดบัญชีรายรับ-รายจ่าย</h3>
                <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--surface-2)] text-[11px]">
                  {([['all', 'ทั้งหมด'], ['in', 'รายรับ'], ['out', 'รายจ่าย']] as const).map(([fId, fLbl]) => (
                    <button
                      key={fId}
                      type="button"
                      onClick={() => setLedgerFilter(fId)}
                      className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${ledgerFilter === fId ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}
                    >
                      {fLbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mland:gap-1.5 text-center text-xs shrink-0">
                <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">รายรับ (บันทึก)</div>
                  <div className="font-bold text-[var(--g)] tabular">+{fmtMoneyNum(totalLogIn)}</div>
                </div>
                <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">รายจ่าย (บันทึก)</div>
                  <div className="font-bold text-[var(--red)] tabular">-{fmtMoneyNum(totalLogOut)}</div>
                </div>
                <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">ดุลสุทธิ</div>
                  <div className={`font-bold tabular ${totalLogIn - totalLogOut >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                    {totalLogIn - totalLogOut >= 0 ? `+${fmtMoneyNum(totalLogIn - totalLogOut)}` : fmtMoneyNum(totalLogIn - totalLogOut)}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
                {filteredEntries.length === 0 ? (
                  <div className="text-xs text-[var(--mut)] py-8 text-center">ยังไม่มีรายการบัญชีในหมวดนี้</div>
                ) : (
                  filteredEntries.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[var(--line)]/50 last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.t}</div>
                        <div className="text-[10px] text-[var(--mut)] tabular">ซีซั่น {e.s} · นัดที่ {e.m}</div>
                      </div>
                      <b className={`tabular shrink-0 ${e.amt >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                        {e.amt >= 0 ? `+${fmtMoneyNum(e.amt)}` : fmtMoneyNum(e.amt)}
                      </b>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Club Identity, Board, Facilities & Legacy View (tab === 'u')
  const k = ensureClubIdentity(state);
  const ts = teamStats(me, state);
  const bd = clamp(state.bd ?? 50, 0, 100);
  const rep = state.mgrRep ?? 50;
  const repRank =
    rep >= 180 ? 'ตำนานลูกหนังไทย' : rep >= 130 ? 'ยอดกุนซือระดับทวีป' : rep >= 90 ? 'กุนซือมือทอง' : rep >= 65 ? 'โค้ชฝีมือดี' : 'กุนซือหน้าใหม่';
  const tierTbl = sortTable(state.teams.filter((t) => t.tier === me.tier));
  const curRank = Math.max(1, tierTbl.findIndex((t) => t.id === me.id) + 1);
  const targetRank = state.obj || 8;
  const cap = est.cap;
  const totV = me.sq.reduce((a, q) => a + Math.round((q.ov * q.ov) / 40), 0);
  const avgAge = (me.sq.reduce((a, q) => a + q.age, 0) / Math.max(1, me.sq.length)).toFixed(1);
  const trophies = state.trophies || [];
  const bs = me.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0))[0];
  const ba = me.sq.slice().sort((a, b) => (b.sa || 0) - (a.sa || 0))[0];
  const bm = me.sq.slice().sort((a, b) => (b.ap || 0) - (a.ap || 0))[0];
  const topO = me.sq.slice().sort((a, b) => b.ov - a.ov)[0];
  const curTurn = state.season * 40 + state.md;
  const actCool = state.clubActMd != null && curTurn - state.clubActMd < 3;
  const remCd = state.clubActMd != null ? Math.max(0, 3 - (curTurn - state.clubActMd)) : 0;

  const clubPresets: { label: string; c1: string; c2: string; c3?: string }[] = [
    { label: 'แดง-ทอง', c1: '#c0392b', c2: '#f4c63d', c3: '#ffffff' },
    { label: 'น้ำเงิน-ขาว', c1: '#2f6fd6', c2: '#ffffff', c3: '#f4c63d' },
    { label: 'เขียว-ขาว', c1: '#1c7a4a', c2: '#ffffff', c3: '#f4c63d' },
    { label: 'กรมท่า-ทอง', c1: '#1b263b', c2: '#f4c63d', c3: '#0ea5e9' },
    { label: 'ส้ม-ดำ', c1: '#e67e22', c2: '#111111', c3: '#ffffff' },
    { label: 'ม่วง-ทอง', c1: '#7c3aed', c2: '#f4c63d', c3: '#ffffff' },
    { label: 'ฟ้า-ขาว', c1: '#0ea5e9', c2: '#ffffff', c3: '#1b263b' },
    { label: 'ชมพู-กรมท่า', c1: '#d6336c', c2: '#1b263b', c3: '#ffffff' },
    { label: 'เลือดหมู-ฟ้า', c1: '#881337', c2: '#0ea5e9', c3: '#f4c63d' },
    { label: 'เหลือง-ดำ', c1: '#facc15', c2: '#111111', c3: '#ffffff' }
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Club Hero Identity Banner (unifies live preview when on identity tab so crests/kits never duplicate) */}
      <div
        className={`p-3 mland:p-2 rounded-2xl border border-[var(--line)] shrink-0 ${
          clubTab === 'identity' ? 'border-[var(--g)]/35 shadow-sm' : ''
        }`}
        style={{ background: `linear-gradient(155deg, color-mix(in srgb, ${k.c1} 18%, var(--surface)), var(--surface) 58%)` }}
      >
        <div className="flex flex-row items-center justify-between gap-3 mland:gap-2">
          <div className="flex flex-row items-center gap-3 mland:gap-2.5 text-left min-w-0">
            <div className="flex items-end gap-2 mland:gap-1.5 shrink-0 [&_svg]:w-12 [&_svg]:h-12 mland:[&_svg]:w-10 mland:[&_svg]:h-10">
              <div className="text-center">
                <ClubCrest name={me.name} size={64} team={me} club={k} isMyClub />
              </div>
              <div className="text-center">
                <KitJersey club={k} away={false} size={56} />
              </div>
              <div className="text-center">
                <KitJersey club={k} away={true} size={56} />
              </div>
            </div>
            <div className="space-y-1 mland:space-y-0 min-w-0">
              <div className="text-[11px] mland:text-[10px] font-bold text-[var(--g)]">
                {clubTab === 'identity' ? 'ตัวอย่างตรา & ชุดแข่งแบบเรียลไทม์' : `${TN[me.tier]} · ก่อตั้งปี ${k.founded || 2568}`}
              </div>
              <h2 className="font-bold text-2xl mland:text-base font-display leading-tight truncate">
                {me.name} {k.nick ? <span className="text-base mland:text-xs font-semibold text-[var(--mut)]">«{k.nick}»</span> : null}
              </h2>
              {clubTab === 'identity' ? (
                <p className="text-xs mland:text-[10px] text-[var(--mut)] truncate">
                  ตรา: <b>{CREST_SHAPES[k.shape]?.label || 'โล่คลาสสิก'}</b> · <b>{CREST_PATTERNS[k.pat] || 'แถบขวาง'}</b> · เสื้อ: <b>{KIT_PATTERNS[k.kit || 0]}</b> / เยือน <b>{KIT_PATTERNS[(k.awayKit ?? k.kit) || 0]}</b> · <b>{KIT_COLLARS[(k.collar ?? 0) % 4]}</b>
                </p>
              ) : (
                <>
                  <p className="text-xs mland:text-[10px] text-[var(--mut)] truncate">
                    🏟️ {k.std} ({cap.toLocaleString()} ที่นั่ง · Lv.{state.st ?? 1}) · 👔 กุนซือ: {k.managerName || 'หัวหน้าผู้ฝึกสอน'}
                  </p>
                  {k.motto && <p className="text-xs italic text-[var(--ink)]/85 mland:hidden">&ldquo;{k.motto}&rdquo;</p>}
                </>
              )}
            </div>
          </div>

          {clubTab === 'identity' ? (
            <button
              type="button"
              onClick={() => {
                const kp = P(KIT_P);
                const icons = Object.keys(CREST_IC);
                onUpdateState((d) => {
                  const cl = ensureClubIdentity(d);
                  cl.c1 = kp[0];
                  cl.c2 = kp[1];
                  cl.c3 = P(['', '#f4c63d', '#ffffff', '#0ea5e9', '#111111']);
                  cl.shape = R(0, CREST_SHAPES.length - 1);
                  cl.pat = R(0, CREST_PATTERNS.length - 1);
                  cl.crestBorder = R(0, 3);
                  cl.kit = R(0, KIT_PATTERNS.length - 1);
                  cl.awayKit = Math.random() < 0.5 ? R(0, KIT_PATTERNS.length - 1) : undefined;
                  cl.collar = R(0, KIT_COLLARS.length - 1);
                  cl.cuffTrim = Math.random() < 0.75;
                  cl.icon = P(icons);
                  cl.iconColor = '';
                  d.teams[d.me].kc = [cl.c1, cl.c2];
                });
                onToast('สุ่มตราสโมสรและชุดแข่งใหม่แล้ว!');
              }}
              className="px-3.5 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] text-xs mland:text-[11px] font-bold cursor-pointer shadow-xs shrink-0 hover:brightness-105"
            >
              🎲 สุ่มดีไซน์ทั้งหมด
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 mland:gap-1 w-auto text-center shrink-0">
              <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/60">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">พลัง XI / ทีม</div>
                <b className="text-xs mland:text-[10.5px] tabular">{ts.ovXi} / {ts.ovSq}</b>
              </div>
              <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/60">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">แฟนบอล</div>
                <b className="text-xs mland:text-[10.5px] tabular">{state.fan ?? 50}%</b>
              </div>
              <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/60">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">บอร์ด</div>
                <b className="text-xs mland:text-[10.5px] tabular">{state.bd ?? 50}%</b>
              </div>
              <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/60">
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">มูลค่าทีม</div>
                <b className="text-xs mland:text-[10.5px] tabular">{fmtMoneyNum(totV)}</b>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Club HQ Sub-navigation (5 Tabs) */}
      <div className="grid grid-cols-5 gap-1 p-1 mland:p-0.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
        {(
          [
            ['info', '🏛️ ข้อมูล & บอร์ด'],
            ['infra', '🏗️ สนาม & ทีมงาน'],
            ['identity', '🎨 ตรา & ชุดแข่ง'],
            ['activities', '🤝 กิจกรรม'],
            ['legacy', '🏆 ประวัติ & ถ้วย']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setClubTab(id)}
            className={`px-2 mland:px-1.5 py-2 mland:py-1 rounded-xl mland:rounded-lg text-[11px] sm:text-xs mland:text-[10px] font-bold truncate cursor-pointer transition-colors whitespace-nowrap ${
              clubTab === id ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Club Tab 1: Basic Info + Board Confidence & Dressing Room */}
      {clubTab === 'info' && (
        <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
          <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 h-full overflow-y-auto">
            <h3 className="font-bold text-sm mland:text-xs">✏️ แก้ไขข้อมูลพื้นฐานสโมสร</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-[var(--mut)] block mb-1">ชื่อสโมสร</label>
                <input
                  value={k.name}
                  maxLength={20}
                  onChange={(e) => {
                    const val = e.target.value.replace(/["'<>`]/g, '');
                    onUpdateState((d) => {
                      const cl = ensureClubIdentity(d);
                      cl.name = val;
                      d.teams[d.me].name = val.trim() || 'ทีมของฉัน';
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--mut)] block mb-1">ฉายาสโมสร</label>
                <input
                  value={k.nick}
                  maxLength={20}
                  placeholder="เช่น เสือล้านนา"
                  onChange={(e) => {
                    const val = e.target.value.replace(/["'<>`]/g, '');
                    onUpdateState((d) => { ensureClubIdentity(d).nick = val; });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--mut)] block mb-1">ชื่อสนามเหย้า</label>
                <input
                  value={k.std}
                  maxLength={24}
                  onChange={(e) => {
                    const val = e.target.value.replace(/["'<>`]/g, '');
                    onUpdateState((d) => { ensureClubIdentity(d).std = val; });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--mut)] block mb-1">ชื่อผู้จัดการทีม</label>
                <input
                  value={k.managerName || ''}
                  maxLength={22}
                  placeholder="เช่น โค้ชต้น"
                  onChange={(e) => {
                    const val = e.target.value.replace(/["'<>`]/g, '');
                    onUpdateState((d) => { ensureClubIdentity(d).managerName = val; });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                />
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="text-[11px] text-[var(--mut)] block mb-1">คำขวัญสโมสร</label>
                  <input
                    value={k.motto || ''}
                    maxLength={40}
                    placeholder="เช่น สู้สุดใจเพื่อชัยชนะ"
                    onChange={(e) => {
                      const val = e.target.value.replace(/["'<>`]/g, '');
                      onUpdateState((d) => { ensureClubIdentity(d).motto = val; });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--mut)] block mb-1">ปีก่อตั้ง (พ.ศ.)</label>
                  <input
                    type="number"
                    min={2450}
                    max={2600}
                    value={k.founded || 2568}
                    onChange={(e) => {
                      const yr = clamp(Number(e.target.value) || 2568, 2450, 2600);
                      onUpdateState((d) => { ensureClubIdentity(d).founded = yr; });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold tabular"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 mland:space-y-2 h-full overflow-y-auto pr-0.5">
            {/* Board & Manager Reputation (Moved from Finance) */}
            <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm mland:text-xs">👔 บอร์ดบริหาร &amp; เครดิตกุนซือ</h3>
                  <p className="text-[11px] text-[var(--mut)]">
                    อันดับ <b className="text-[var(--ink)] tabular">#{curRank}/{tierTbl.length}</b> · เป้าหมายบอร์ด <b className="text-[var(--g)] tabular">อันดับ {targetRank}+</b>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-[#9a6700] dark:text-[var(--lamp)] tabular">ชื่อเสียง {rep}</div>
                  <div className="text-[10.5px] text-[var(--mut)]">{repRank}</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--mut)]">ความเชื่อมั่นบอร์ดบริหาร</span>
                  <b className={`tabular ${bd < 30 ? 'text-[var(--red)]' : bd >= 70 ? 'text-[var(--g)]' : ''}`}>{bd}%</b>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${bd}%`, background: bd < 30 ? 'var(--red)' : bd < 55 ? 'var(--lamp)' : 'var(--g)' }}
                  />
                </div>
                <div className="text-[10.5px] text-[var(--mut)]">
                  {bd < 30
                    ? '⚠️ ความเชื่อมั่นวิกฤติ! ต้องรีบทำผลงานและคุมงบไม่ให้ติดลบ'
                    : curRank <= targetRank
                      ? '✅ ผลงานเป็นไปตามเป้าหมายบอร์ดบริหาร'
                      : '📌 อันดับยังต่ำกว่าเป้าหมายบอร์ด — เร่งเก็บแต้มในลีก'}
                </div>
              </div>
            </div>

            {/* Dressing Room & Key Leaders */}
            <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
              <h3 className="font-bold text-sm mland:text-xs">📊 บรรยากาศห้องแต่งตัว &amp; แกนหลักทีม</h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">ขวัญทีม</div>
                  <div className="font-bold text-sm tabular">{state.mor ?? 55}%</div>
                </div>
                <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">คุ้นเคยแผน</div>
                  <div className="font-bold text-sm tabular">{me.tacFam ?? 65}%</div>
                </div>
                <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">อายุเฉลี่ย</div>
                  <div className="font-bold text-sm tabular">{avgAge} ปี</div>
                </div>
                <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">จำนวนนักเตะ</div>
                  <div className="font-bold text-sm tabular">{me.sq.length} คน</div>
                </div>
              </div>
              <div className="space-y-1 text-xs pt-0.5">
                <div className="flex justify-between py-1 border-b border-[var(--line)]/60">
                  <span className="text-[var(--mut)]">กัปตันทีม</span>
                  <b>{me.cap || topO?.n || '-'}</b>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--line)]/60">
                  <span className="text-[var(--mut)]">ดาวเด่นพลังสูงสุด</span>
                  <b>{topO ? `${topO.n} (${topO.ro} · OVR ${topO.ov})` : '-'}</b>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--line)]/60">
                  <span className="text-[var(--mut)]">ดาวซัลโวซีซั่นนี้</span>
                  <b>{bs && bs.sg ? `${bs.n} (${bs.sg} ประตู)` : 'ยังไม่มีประตู'}</b>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--line)]/60">
                  <span className="text-[var(--mut)]">จอมแอสซิสต์ซีซั่นนี้</span>
                  <b>{ba && ba.sa ? `${ba.n} (${ba.sa} ครั้ง)` : 'ยังไม่มีข้อมูล'}</b>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--mut)]">ลงสนามมากที่สุด</span>
                  <b>{bm && bm.ap ? `${bm.n} (${bm.ap} นัด)` : 'ยังไม่มีข้อมูล'}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Club Tab 2: Facilities & Backroom Staff (Moved from Finance, zero training duplicate) */}
      {clubTab === 'infra' && (
        <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
          <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 h-full overflow-y-auto">
            <h3 className="font-bold text-sm mland:text-xs">🏟️ สิ่งอำนวยความสะดวกสโมสร (สูงสุด Lv.5)</h3>
            {(
              [
                ['st', 'สนามกีฬา', `ความจุ ${est.cap.toLocaleString()} ที่นั่ง · เพิ่มตั๋ว & เพดานค่าจ้าง +10%/Lv`, 100],
                ['tr', 'ศูนย์ฝึกซ้อม', 'เพิ่มโอกาสอัปค่าพลังซ้อม & ฟื้นความฟิต +2%/Lv', 80],
                ['ya', 'อะคาเดมี่เยาวชน', 'สร้างเยาวชน OVR สูงขึ้น & เพิ่มคุณภาพแมวมอง', 80],
                ['med', 'ศูนย์การแพทย์ & ฟื้นฟู', 'ลดโอกาสบาดเจ็บ -8%/Lv และเร่งฟื้นฟูอาการเจ็บ', 75]
              ] as const
            ).map(([facKey, title, desc, baseCost]) => {
              const lv = state[facKey] ?? 1;
              const cost = lv * baseCost;
              return (
                <div key={facKey} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)]/60 last:border-0">
                  <div className="min-w-0">
                    <div className="font-bold text-xs">{title} · Lv.{lv}/5</div>
                    <div className="text-[11px] text-[var(--mut)]">{desc}</div>
                    <div className="flex gap-1 mt-1.5">
                      {[1, 2, 3, 4, 5].map((x) => (
                        <span key={x} className={`h-1.5 w-5 rounded-full ${x <= lv ? 'bg-[var(--g)]' : 'bg-[var(--surface-2)]'}`} />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={lv >= 5 || state.money < cost}
                    onClick={() => upgradeFac(facKey, title, baseCost)}
                    className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    {lv >= 5 ? 'เต็มแล้ว' : `อัป ${fmtMoneyNum(cost)}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 h-full overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm mland:text-xs">🧑‍🏫 ทีมงานสตาฟฟ์โค้ช (สูงสุด Lv.3)</h3>
              <span className="text-xs font-bold text-[var(--red)] tabular">ค่าจ้างรวม -{fmtMoneyNum(est.staffCost)}/นัด</span>
            </div>
            {(
              [
                ['asst', 'ผู้ช่วยโค้ช', 'เพิ่มความคุ้นเคยแท็กติก & โอกาสซ้อมพัฒนา +2%/Lv'],
                ['fit', 'โค้ชฟิตเนส', 'ฟื้นฟูความฟิตทั้งทีมหลังจบแมตช์ +2%/Lv'],
                ['scout', 'หัวหน้าแมวมอง', 'เพิ่มคุณภาพ & จำนวนนักเตะจากภารกิจแมวมอง'],
                ['physio', 'นักกายภาพบำบัด', 'ลดความเสี่ยงบาดเจ็บ -8%/Lv & หายเจ็บไวขึ้น']
              ] as const
            ).map(([role, title, desc]) => {
              const lv = stf[role];
              const nextCost = [45, 75, 110][lv] ?? 0;
              return (
                <div key={role} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--line)]/60 last:border-0">
                  <div className="min-w-0">
                    <div className="font-bold text-xs">{title} · Lv.{lv}/3</div>
                    <div className="text-[11px] text-[var(--mut)]">{desc}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {lv > 0 && (
                      <button
                        type="button"
                        onClick={() => fireStaff(role, title)}
                        className="px-2 py-1.5 rounded-lg bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--mut)] hover:text-[var(--red)] cursor-pointer"
                      >
                        ลด
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={lv >= 3 || state.money < nextCost}
                      onClick={() => hireStaff(role, title)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      {lv >= 3 ? 'เต็ม' : `จ้าง ${fmtMoneyNum(nextCost)}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Club Tab 2: Crest & Jersey Studio */}
      {clubTab === 'identity' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="grid grid-cols-2 gap-3 mland:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
            {/* Crest Studio */}
            <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 h-full overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm mland:text-xs">🛡️ สตูดิโอออกแบบตราสโมสร</h3>
                <span className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--g)] truncate">
                  {CREST_SHAPES[k.shape]?.label} · {CREST_PATTERNS[k.pat]}
                </span>
              </div>

              <div>
                <div className="text-xs mland:text-[10.5px] text-[var(--mut)] font-semibold mb-1.5">รูปทรงตรา ({CREST_SHAPES.length} แบบ)</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {CREST_SHAPES.map((sh, i) => {
                    const active = k.shape === i;
                    return (
                      <button
                        key={sh.label}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).shape = i; })}
                        className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl text-[10.5px] mland:text-[9.5px] font-semibold cursor-pointer border transition-all ${
                          active
                            ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--ink)] shadow-xs'
                            : 'bg-[var(--surface-2)]/70 border-transparent text-[var(--mut)] hover:text-[var(--ink)] hover:border-[var(--line)]'
                        }`}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                          <path d={sh.d} fill={k.c1} stroke={active ? 'var(--g)' : 'var(--line)'} strokeWidth="1.6" />
                        </svg>
                        <span className="truncate max-w-full leading-tight">{sh.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs mland:text-[10.5px] text-[var(--mut)] font-semibold mb-1.5">ลวดลายพื้นหลังตรา ({CREST_PATTERNS.length} แบบ)</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {CREST_PATTERNS.map((l, i) => {
                    const active = k.pat === i;
                    const shPath = CREST_SHAPES[k.shape % CREST_SHAPES.length]?.d || CREST_SHAPES[0].d;
                    const patUid = `patprev-${i}`;
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).pat = i; })}
                        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-xl text-[10.5px] mland:text-[9.5px] font-semibold cursor-pointer border transition-colors min-w-0 ${
                          active
                            ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-xs'
                            : 'bg-[var(--surface-2)]/70 border-transparent text-[var(--mut)] hover:text-[var(--ink)] hover:border-[var(--line)]'
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
                          <defs>
                            <clipPath id={`cp-${patUid}`}>
                              <path d={shPath} />
                            </clipPath>
                            {i === 9 && (
                              <linearGradient id={`cg-${patUid}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={k.c1} />
                                <stop offset="100%" stopColor={k.c2} />
                              </linearGradient>
                            )}
                            {i === 19 && (
                              <radialGradient id={`cr-${patUid}`} cx="50%" cy="50%" r="55%">
                                <stop offset="0%" stopColor={k.c2} />
                                <stop offset="100%" stopColor={k.c1} />
                              </radialGradient>
                            )}
                          </defs>
                          <g clipPath={`url(#cp-${patUid})`}>
                            {renderCrestPattern(i, patUid, k.c1, k.c2)}
                          </g>
                          <path d={shPath} fill="none" stroke={active ? '#ffffff' : 'var(--line)'} strokeWidth="1.5" />
                        </svg>
                        <span className="truncate">{l}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mland:gap-2">
                <div>
                  <div className="text-xs mland:text-[10.5px] text-[var(--mut)] font-semibold mb-1.5">สไตล์ขอบตรา</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['ขาว', 'ทอง', 'ขอบคู่', 'ดำเข้ม'] as const).map((lbl, i) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).crestBorder = i; })}
                        className={`py-1.5 rounded-xl text-[11px] mland:text-[9.5px] font-semibold cursor-pointer ${(k.crestBorder ?? 0) === i ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface-2)]/70 text-[var(--mut)] hover:text-[var(--ink)]'}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs mland:text-[10.5px] text-[var(--mut)] font-semibold mb-1.5">ดาวเกียรติยศบนตรา</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 1, 2, 3].map((stCnt) => (
                      <button
                        key={stCnt}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).stars = stCnt; })}
                        className={`py-1.5 rounded-xl text-[11px] mland:text-[9.5px] font-semibold cursor-pointer ${(k.stars ?? 0) === stCnt ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface-2)]/70 text-[var(--mut)] hover:text-[var(--ink)]'}`}
                      >
                        {stCnt === 0 ? 'ไม่มี' : '⭐'.repeat(stCnt)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs mland:text-[10.5px] text-[var(--mut)] font-semibold">
                    สัญลักษณ์กลางตรา ({Object.keys(CREST_IC).length} แบบ)
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const icKeys = Object.keys(CREST_IC);
                      const picked = P(icKeys);
                      onUpdateState((d) => { ensureClubIdentity(d).icon = picked; });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--g)] hover:text-white text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer border border-[var(--line)]/80"
                  >
                    🎲 สุ่มสัญลักษณ์
                  </button>
                </div>

                {/* Emblem contrast color selector */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] mland:text-[9.5px] text-[var(--mut)] font-semibold mr-1">สีสัญลักษณ์:</span>
                  {(
                    [
                      ['', 'อัตโนมัติ'],
                      ['#ffffff', 'ขาว'],
                      ['#0f172a', 'ดำเข้ม'],
                      ['#facc15', 'ทอง'],
                      ['#38bdf8', 'ฟ้า'],
                      ['#ef4444', 'แดง']
                    ] as const
                  ).map(([colVal, lbl]) => {
                    const active = (k.iconColor || '') === colVal;
                    return (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).iconColor = colVal; })}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] mland:text-[9px] font-bold border cursor-pointer transition-colors ${
                          active
                            ? 'bg-[var(--g)] text-white border-[var(--g)]'
                            : 'bg-[var(--surface-2)]/75 text-[var(--mut)] border-[var(--line)]/70 hover:text-[var(--ink)]'
                        }`}
                      >
                        {colVal && <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ background: colVal }} />}
                        <span>{lbl}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Visual Vector Emblem Grid */}
                <div className="grid grid-cols-6 gap-1.5">
                  {Object.keys(CREST_IC).map((ic) => {
                    const active = k.icon === ic;
                    return (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).icon = ic; })}
                        className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl cursor-pointer border transition-all ${
                          active
                            ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--g)] ring-1 ring-[var(--g)] shadow-xs'
                            : 'bg-[var(--surface-2)]/65 border-transparent text-[var(--ink)] hover:border-[var(--line)] hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                          <g
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            dangerouslySetInnerHTML={{ __html: CREST_IC[ic] }}
                          />
                        </svg>
                        <span className="text-[9.5px] mland:text-[8.5px] font-semibold truncate max-w-full leading-tight">
                          {CREST_IC_NAMES[ic] || ic}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Jersey Studio */}
            <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 h-full overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm mland:text-xs">🎽 สตูดิโอสีชุดแข่ง &amp; ลายเสื้อ</h3>
                <span className="text-[11px] font-semibold text-[var(--g)]">
                  เหย้า: {KIT_PATTERNS[k.kit || 0]}
                </span>
              </div>

              <div>
                <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ชุดสีสโมสรยอดนิยม</div>
                <div className="flex flex-wrap gap-1.5">
                  {clubPresets.map((pr) => {
                    const active = k.c1.toLowerCase() === pr.c1.toLowerCase() && k.c2.toLowerCase() === pr.c2.toLowerCase();
                    return (
                      <button
                        key={pr.label}
                        type="button"
                        onClick={() => {
                          onUpdateState((d) => {
                            const cl = ensureClubIdentity(d);
                            cl.c1 = pr.c1;
                            cl.c2 = pr.c2;
                            cl.c3 = pr.c3 || '';
                            d.teams[d.me].kc = [pr.c1, pr.c2];
                          });
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border ${
                          active ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--ink)]' : 'bg-[var(--surface-2)] border-transparent hover:border-[var(--g)]'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full border border-white/60" style={{ background: pr.c1 }} />
                        <span className="w-3 h-3 rounded-full border border-black/20" style={{ background: pr.c2 }} />
                        {pr.c3 && <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ background: pr.c3 }} />}
                        <span>{pr.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1">สีหลัก · ชุดเหย้า</div>
                  <div className="flex flex-wrap gap-1.5">
                    {KIT_SW.map((col) => (
                      <button
                        key={col}
                        type="button"
                        disabled={colDist(col, k.c2) < 150}
                        onClick={() => onUpdateState((d) => {
                          const cl = ensureClubIdentity(d);
                          cl.c1 = col;
                          d.teams[d.me].kc = [cl.c1, cl.c2];
                        })}
                        className={`w-6 h-6 rounded-full border-2 border-white disabled:opacity-25 cursor-pointer ${k.c1 === col ? 'ring-2 ring-[var(--lamp)] scale-110' : ''}`}
                        style={{ background: col }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1">สีหลัก · ชุดเยือน / ลายรอง</div>
                  <div className="flex flex-wrap gap-1.5">
                    {KIT_SW.map((col) => (
                      <button
                        key={col}
                        type="button"
                        disabled={colDist(col, k.c1) < 150}
                        onClick={() => onUpdateState((d) => {
                          const cl = ensureClubIdentity(d);
                          cl.c2 = col;
                          d.teams[d.me].kc = [cl.c1, cl.c2];
                        })}
                        className={`w-6 h-6 rounded-full border-2 border-white disabled:opacity-25 cursor-pointer ${k.c2 === col ? 'ring-2 ring-[var(--lamp)] scale-110' : ''}`}
                        style={{ background: col }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[var(--mut)] font-semibold">สีขลิบ &amp; เส้นตัด (Accent)</span>
                    <button
                      type="button"
                      onClick={() => onUpdateState((d) => { ensureClubIdentity(d).c3 = ''; })}
                      className={`text-[11px] font-semibold cursor-pointer ${!k.c3 ? 'text-[var(--g)] underline' : 'text-[var(--mut)]'}`}
                    >
                      อัตโนมัติ
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {KIT_SW.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).c3 = col; })}
                        className={`w-6 h-6 rounded-full border-2 border-white cursor-pointer ${k.c3 === col ? 'ring-2 ring-[var(--lamp)] scale-110' : ''}`}
                        style={{ background: col }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ลายเสื้อชุดเหย้า ({KIT_PATTERNS.length} ลาย)</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {KIT_PATTERNS.map((l, i) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => onUpdateState((d) => { ensureClubIdentity(d).kit = i; })}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold cursor-pointer truncate ${k.kit === i ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ลายเสื้อชุดเยือน (แยกได้)</div>
                  <select
                    value={k.awayKit != null ? String(k.awayKit) : 'same'}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdateState((d) => {
                        ensureClubIdentity(d).awayKit = v === 'same' ? undefined : Number(v);
                      });
                    }}
                    className="w-full px-2.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold"
                  >
                    <option value="same">ใช้ลายเดียวกับชุดเหย้า</option>
                    {KIT_PATTERNS.map((l, i) => (
                      <option key={l} value={i}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ทรงคอเสื้อ ({KIT_COLLARS.length} แบบ)</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {KIT_COLLARS.map((clbl, ci) => (
                      <button
                        key={clbl}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).collar = ci; })}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${(k.collar ?? 0) === ci ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                      >
                        {clbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onUpdateState((d) => {
                  const cl = ensureClubIdentity(d);
                  cl.cuffTrim = !(cl.cuffTrim ?? true);
                })}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--surface-2)] text-xs font-semibold cursor-pointer"
              >
                <span>แถบขลิบปลายแขนเสื้อ &amp; ชายเสื้อ</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${(k.cuffTrim ?? true) ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)]'}`}>
                  {(k.cuffTrim ?? true) ? 'เปิด' : 'ปิด'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Club Tab 3: Club Activities */}
      {clubTab === 'activities' && (
        <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div>
              <h3 className="font-bold text-sm mland:text-xs">🤝 กิจกรรมสโมสร &amp; มวลชนสัมพันธ์</h3>
              <p className="text-xs mland:text-[10px] text-[var(--mut)]">จัดกิจกรรมเพื่อปลุกขวัญนักเตะ ดึงดูดแฟนบอล และเสริมความเชื่อมั่นบอร์ด (คูลดาวน์ 3 นัดต่อครั้ง)</p>
            </div>
            <span className={`text-xs mland:text-[11px] font-bold ${actCool ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--g)]'}`}>
              {actCool ? `⏳ รออีก ${remCd} นัด` : '✅ พร้อมจัดกิจกรรม'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mland:gap-2 flex-1 min-h-0 overflow-y-auto pr-0.5">
            <button
              type="button"
              disabled={actCool}
              onClick={() => {
                onUpdateState((d) => {
                  d.fan = clamp((d.fan ?? 50) + 6, 5, 100);
                  d.clubActMd = curTurn;
                });
                onToast('แฟนบอลประทับใจ! ขวัญแฟนบอล +6%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>📣 พบปะแฟนบอล</span>
                <span className="text-[var(--g)]">ฟรี</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">ขวัญแฟนบอล +6%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 20}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 20;
                  logFin(d, 'จัดงาน Open House สโมสร', -20);
                  d.fan = clamp((d.fan ?? 50) + 8, 5, 100);
                  d.mor = clamp((d.mor ?? 50) + 5, 0, 100);
                  d.bd = clamp((d.bd ?? 50) + 3, 0, 100);
                  d.clubActMd = curTurn;
                });
                onToast('Open House สำเร็จ! แฟน +8% ขวัญ +5% บอร์ด +3%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>🎉 Open House สโมสร</span>
                <span className="tabular">20k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">แฟน +8% · ขวัญ +5% · บอร์ด +3%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 25}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 25;
                  logFin(d, 'แคมป์กระชับความสัมพันธ์ทีม', -25);
                  d.mor = clamp((d.mor ?? 50) + 8, 0, 100);
                  d.teams[d.me].sq.forEach((q) => {
                    q.fit = clamp((q.fit ?? 100) + 6, 30, 100);
                  });
                  d.clubActMd = curTurn;
                });
                onToast('เข้าแคมป์สำเร็จ! ขวัญทีม +8% ความฟิต +6%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>🏃 แคมป์กระชับทีม</span>
                <span className="tabular">25k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">ขวัญทีม +8% · ฟิตทั้งทีม +6%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 15}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 15;
                  logFin(d, 'ติวเข้มแท็กติกทีม', -15);
                  d.teams[d.me].tacFam = clamp((d.teams[d.me].tacFam ?? 65) + 10, 30, 100);
                  d.mor = clamp((d.mor ?? 50) + 3, 0, 100);
                  d.clubActMd = curTurn;
                });
                onToast('ติวเข้มแท็กติกสำเร็จ! ความคุ้นเคยแผน +10% · ขวัญ +3%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>🎯 ติวเข้มแท็กติก</span>
                <span className="tabular">15k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">ความคุ้นเคยแผน +10% · ขวัญ +3%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 10}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 10;
                  logFin(d, 'จัดแมตช์การกุศลสโมสร', -10);
                  d.fan = clamp((d.fan ?? 50) + 10, 5, 100);
                  d.mgrRep = (d.mgrRep ?? 50) + 4;
                  d.bd = clamp((d.bd ?? 50) + 2, 0, 100);
                  d.clubActMd = curTurn;
                });
                onToast('แมตช์การกุศลสุดประทับใจ! แฟน +10% · ชื่อเสียง +4');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>⚽ แมตช์การกุศล</span>
                <span className="tabular">10k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">แฟน +10% · ชื่อเสียงกุนซือ +4 · บอร์ด +2%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 12}
              onClick={() => {
                let boostedName = '';
                onUpdateState((d) => {
                  d.money -= 12;
                  logFin(d, 'แคมเปญโซเชียลสโมสร', -12);
                  d.fan = clamp((d.fan ?? 50) + 7, 5, 100);
                  const yPool = d.teams[d.me].sq.filter((q) => q.age <= 22 && q.ov < (q.pot || 90));
                  if (yPool.length) {
                    const pick = P(yPool);
                    pick.ov++;
                    boostedName = pick.n;
                  }
                  d.clubActMd = curTurn;
                });
                onToast(boostedName ? `แฟน +7% และ ${boostedName} มีกำลังใจพัฒนา +1 OVR!` : 'แคมเปญโซเชียลปังมาก! ขวัญแฟนบอล +7%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>📱 แคมเปญโซเชียล</span>
                <span className="tabular">12k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">แฟน +7% · กระตุ้นดาวรุ่งในทีม</div>
            </button>
          </div>
        </div>
      )}

      {/* Club Tab 4: Hall of Fame & Season History */}
      {clubTab === 'legacy' && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
          <ClubHistoryPanel
            team={me}
            state={state}
            onOpenSeasonStats={onOpenSeasonStats}
            onInspectPlayer={onInspectPlayer}
          />
        </div>
      )}
    </div>
  );
};

