import React, { useState } from 'react';
import type { Player, GameState } from '../types/game';
import { clamp } from '../utils/math';
import { PACT, CAREER_PERKS, FOOTBALL_TRAITS, SIGL, ALL_SUB_ROLES, LINE, SPN } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import {
  getShirtNo,
  getFormationSlots,
  xi,
  dtInfo,
  summarizeStatGroups,
  ovMe,
  syncMe,
  tc,
  learnCareerTrait,
  forgetCareerTrait,
  setCareerRoleTrainTarget,
  switchCareerSignature,
  trainCareerSignatureDrill,
  ROLE_ADAPT_THRESHOLD_ADJ,
  ROLE_ADAPT_THRESHOLD_CROSS
} from '../engine/playerCore';
import { statBarColor, statTierMeta, getPlayerTalent } from '../engine/missions';
import { ClubCrest } from '../components/SvgVisuals';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { PlayerHistoryPanel } from '../components/PlayerHistoryPanel';
import { PlayerSeasonProgressionCard } from '../components/PlayerSeasonProgressionCard';
import { PlayerTraitsStrip } from '../components/PlayerTraitsStrip';
import { ShirtNumberLockerModal } from '../components/ShirtNumberLockerModal';
import { AthleteCard } from '../components/AthleteCard';

export const PlayerCareerView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
  onOpenSeasonStats?: (season?: number) => void;
}> = ({ state, onUpdateState, onToast, onOpenSeasonStats }) => {
  const [careerTab, setCareerTab] = useState<'plan' | 'missions' | 'perks' | 'stats' | 'history'>('plan');
  const [skillSubTab, setSkillSubTab] = useState<'perks' | 'traits' | 'roles' | 'sig'>('perks');
  const [showLockerPicker, setShowLockerPicker] = useState(false);
  const p = state.p;
  if (!p) return null;
  const meTeam = state.teams[state.me];
  const meSq = meTeam.sq.find((q) => q.me);
  const myShirtNo = p.no || meSq?.no || getShirtNo(meTeam, { n: p.name, pos: p.pos, ro: p.sp });
  const ov = ovMe(p);
  const avgRt = p.ap ? (p.rs / p.ap).toFixed(2) : '-';
  const perks = p.perks || [];
  const susCount = meSq?.sus ?? p.sus ?? 0;
  const injCount = meSq?.inj ?? p.inj ?? 0;
  const ycCount = meSq?.yc ?? p.yc ?? 0;
  const rcCount = meSq?.rc ?? p.rc ?? 0;
  const fakePlayer: Player = meSq || { n: p.name, pos: p.pos, ro: p.sp, ov, age: p.age, ht: p.ht, wt: p.wt, foot: p.foot, pot: 95, talent: p.talent, traits: p.traits, fit: p.en, inj: injCount, sus: susCount, yc: ycCount, rc: rcCount, no: myShirtNo, me: 1, sb: p.sb, missions: p.missions };
  const details = dtInfo(fakePlayer, p);
  const myTalent = getPlayerTalent(fakePlayer, p);
  const myPot = meSq?.pot ?? clamp(Math.max(88, myTalent + 6), ov + 4, 96);
  const starters = xi(meTeam);
  const starterIdx = starters.findIndex((q) => q.me || q.n === p.name);
  const mySlot = starterIdx >= 0 ? getFormationSlots(meTeam)[starterIdx]?.sp : null;
  const kit1 = tc(meTeam, state, false);
  const kit2 = tc(meTeam, state, true);

  return (
    <div className="grid grid-cols-[240px_1fr] mland:grid-cols-[214px_1fr] grid-rows-[minmax(0,1fr)] flex-1 min-h-0 gap-2.5 mland:gap-1.5 items-stretch overflow-hidden">
      <div className="flex flex-col gap-1.5 mland:gap-1 h-full min-h-0 overflow-y-auto pr-0.5 pb-2">
        {/* Collectible Career Athlete Card */}
        <AthleteCard
          ov={ov}
          pot={myPot}
          talent={myTalent}
          roleLabel={`${p.sp}${p.altRoles?.length ? `/${p.altRoles.slice(0, 2).join('/')}` : ''}`}
          shirtNo={myShirtNo}
          onShirtClick={() => {
            SFX.tap();
            setShowLockerPicker(true);
          }}
          shirtButtonTitle="เปิดล็อกเกอร์เปลี่ยน/สลับเบอร์เสื้อ"
          kit1={kit1}
          kit2={kit2}
          faceProps={{
            player: fakePlayer,
            team: meTeam,
            state,
            careerProfile: p
          }}
          name={p.name}
          subtitle={`${meTeam.name} · อายุ ${p.age} ปี`}
          bio={details.bio}
          categories={summarizeStatGroups(details.G)}
          renderBadges={(palette) => (
            <>
              <span className={`text-[9px] mland:text-[7px] font-bold tabular ${palette.repText}`}>
                ★ {p.rep ?? 10}
              </span>
              <div className="shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5 mland:[&>svg]:w-3 mland:[&>svg]:h-3">
                <ClubCrest name={meTeam.name} size={14} team={meTeam} club={state.club} isMyClub={false} />
              </div>
            </>
          )}
        />

        {/* Personal Info Box below Portrait Card */}
        <div className="p-2 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs shrink-0 flex flex-col gap-1.5 mland:gap-1">

          <div className="space-y-1 mland:space-y-0.5">
            <div className="flex items-center justify-between text-[11px] mland:text-[9px] font-bold">
              <span>⚡ พลังกาย</span>
              <span className={`tabular font-extrabold ${statTierMeta(p.en).textClass}`}>
                {Math.round(p.en)}%
              </span>
            </div>
            <div className="h-2 mland:h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${clamp(p.en, 6, 100)}%`, background: statBarColor(p.en) }} />
            </div>
          </div>

          <div className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg border text-[10.5px] mland:text-[8.5px] space-y-0.5 ${injCount > 0 || susCount > 0 ? 'bg-[var(--red-soft)] border-[var(--red)]/40' : mySlot ? 'bg-[var(--g-soft)] border-[var(--g)]/35' : 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45'}`}>
            <div className="flex items-center justify-between font-bold gap-1">
              <span className="truncate">
                {injCount > 0
                  ? `🩹 เจ็บพัก ${injCount} นัด`
                  : susCount > 0
                    ? `🟥 แบน ${susCount} นัด`
                    : mySlot
                      ? `⭐ ตัวจริง (${mySlot})`
                      : '🪑 ตัวสำรอง'}
              </span>
              <span className="tabular text-[9.5px] mland:text-[8px] shrink-0">🟨{ycCount}/3 · 🟥{rcCount}</span>
            </div>
            {injCount > 0 && (
              <button
                type="button"
                disabled={(p.rep ?? 10) < 4}
                onClick={() => {
                  SFX.tap();
                  onUpdateState((d) => {
                    if (!d.p || (d.p.rep ?? 10) < 4) return;
                    d.p.rep = (d.p.rep ?? 10) - 4;
                    d.p.inj = Math.max(0, (d.p.inj ?? injCount) - 1);
                    d.p.en = clamp((d.p.en ?? 80) + 12, 35, 100);
                    syncMe(d);
                  });
                  onToast(injCount - 1 <= 0 ? '💆 กายภาพส่วนตัวสำเร็จ! คุณหายเจ็บพร้อมลงสนามแล้ว' : `💆 กายภาพส่วนตัวสำเร็จ! ลดวันพักเหลือ ${injCount - 1} นัด (+12% พลังกาย)`);
                }}
                className="btn btn-xs btn-primary w-full"
              >
                💆 กายภาพ (-1 นัด · +12% ฟิต · 4 ★)
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1 text-center">
            <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
              <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">👕 ลง</div>
              <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none">{p.ap}</div>
            </div>
            <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
              <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">⚽ ยิง</div>
              <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none">{p.gl}</div>
            </div>
            <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
              <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">{p.pos === 'GK' ? '🧤 คลีน' : '🎯 จ่าย'}</div>
              <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none">{p.pos === 'GK' ? (meSq?.cs || 0) : p.as}</div>
            </div>
            <div className="py-1 px-0.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)]">
              <div className="text-[9px] mland:text-[7px] text-[var(--mut)] leading-none">⭐ เรต</div>
              <div className="text-[11px] mland:text-[9px] font-extrabold tabular mt-0.5 leading-none text-[#8a5b00] dark:text-[#fde047]">{avgRt}</div>
            </div>
          </div>

          <div className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg bg-[var(--surface-2)] flex items-center justify-between gap-1.5">
            <span className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] font-semibold truncate">
              🇹🇭 ทีมชาติ <b className="text-[var(--ink)] tabular">{p.ntCaps || 0} นัด · {p.ntGoals || 0} ลูก</b>
            </span>
            {onOpenSeasonStats && (state.seasonArchives?.length || 0) > 0 && (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onOpenSeasonStats();
                }}
                className="btn btn-xs btn-surface shrink-0"
              >
                📊 ซีซั่น ({state.seasonArchives!.length})
              </button>
            )}
          </div>

          {(() => {
            const recentFm = (p.fm || []).slice(-5);
            const recentAvg = recentFm.length
              ? recentFm.reduce((sum, val) => sum + val, 0) / recentFm.length
              : 0;
            const lastRt = recentFm.length ? recentFm[recentFm.length - 1] : 0;
            const prevRt = recentFm.length >= 2 ? recentFm[recentFm.length - 2] : lastRt;
            const trendLabel =
              recentFm.length < 2
                ? recentFm.length === 1
                  ? 'นัดแรก'
                  : 'รอลงสนาม'
                : lastRt >= 7.8 || (lastRt - prevRt >= 0.45 && recentAvg >= 7.1)
                  ? '🔥 ร้อนแรง'
                  : lastRt - prevRt <= -0.55
                    ? '↘ แผ่ว'
                    : recentAvg >= 7.1
                      ? '✨ คงเส้น'
                      : '⚖️ ทรงตัว';
            const avgCls =
              recentAvg >= 8.0
                ? 'text-[#9a6700] dark:text-[#fde047]'
                : recentAvg >= 7.1
                  ? 'text-[var(--g)]'
                  : recentAvg >= 6.4
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-[var(--red)]';
            return (
              <div className="p-1.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/70 space-y-1 mland:space-y-0.5 text-left">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[9.5px] mland:text-[7.5px] font-bold text-[var(--mut)] truncate">ฟอร์ม 5 นัด</span>
                    <span className="text-[9px] mland:text-[7px] font-bold text-[var(--ink)]/80 truncate">· {trendLabel}</span>
                  </div>
                  {recentFm.length > 0 && (
                    <span className={`text-[9.5px] mland:text-[7.5px] font-extrabold tabular shrink-0 ${avgCls}`}>
                      {recentAvg.toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const val = recentFm[idx];
                    if (val == null) {
                      return (
                        <div
                          key={idx}
                          className="rounded-md border border-dashed border-[var(--line)]/80 bg-[var(--surface)]/45 py-0.5 flex flex-col items-center justify-end gap-0.5 text-[var(--mut)]/55"
                        >
                          <div className="w-full px-1 h-2.5 mland:h-2 flex items-end justify-center">
                            <span className="w-1.5 h-[2px] rounded-full bg-current opacity-50" />
                          </div>
                          <span className="text-[8.5px] mland:text-[7px] font-bold tabular leading-none">-</span>
                        </div>
                      );
                    }
                    const isLatest = idx === recentFm.length - 1;
                    const tier =
                      val >= 8.2
                        ? {
                            box: 'bg-amber-400/20 border-amber-400/65 text-[#8a5b00] dark:text-[#fde047]',
                            bar: '#f59e0b'
                          }
                        : val >= 7.2
                          ? {
                              box: 'bg-emerald-500/15 border-emerald-500/45 text-emerald-700 dark:text-emerald-300',
                              bar: '#10b981'
                            }
                          : val >= 6.4
                            ? {
                                box: 'bg-sky-500/12 border-sky-500/35 text-sky-700 dark:text-sky-300',
                                bar: '#38bdf8'
                              }
                            : {
                                box: 'bg-rose-500/14 border-rose-500/45 text-rose-700 dark:text-rose-300',
                                bar: '#f43f5e'
                              };
                    const pct = clamp(Math.round(((val - 4.5) / 5.5) * 100), 18, 100);
                    return (
                      <div
                        key={idx}
                        title={`นัดที่ ${idx + 1}${isLatest ? ' (ล่าสุด)' : ''}: เรตติ้ง ${val.toFixed(1)}`}
                        className={`rounded-md border py-0.5 flex flex-col items-center justify-end gap-0.5 transition-all ${tier.box} ${
                          isLatest ? 'ring-1 ring-[var(--ink)]/25 shadow-2xs' : 'opacity-90'
                        }`}
                      >
                        <div className="w-full px-1 h-2.5 mland:h-2 flex items-end justify-center">
                          <div className="w-2 mland:w-1.5 h-full rounded-sm bg-black/10 dark:bg-white/10 overflow-hidden flex items-end">
                            <div
                              className="w-full rounded-sm"
                              style={{ height: `${pct}%`, background: tier.bar }}
                            />
                          </div>
                        </div>
                        <span className={`text-[9px] mland:text-[7px] tabular leading-none ${isLatest ? 'font-black' : 'font-extrabold'}`}>
                          {val.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Personality, Style & Insights Strip below Athlete Card */}
        <PlayerTraitsStrip
          player={fakePlayer}
          careerProfile={p}
          trPair={details.TR}
          traits={details.traits}
          talent={myTalent}
          growthStage={details.gro}
          peakAge={details.D0.pk}
          sigKey={details.D0.sig}
          archName={p.archName}
        />
      </div>

      <div className="gap-2 mland:gap-1 h-full flex flex-col min-h-0">
        <div className="seg-bar grid grid-cols-5 w-full shrink-0">
          {([
            ['plan', '📅 แผนฝึก'],
            ['missions', '🎯 ภารกิจ'],
            ['perks', '🌟 สกิล'],
            ['stats', '📊 ค่าพลัง'],
            ['history', '📜 ประวัติ']
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => { SFX.tap(); setCareerTab(k); }}
              className={`seg-btn py-1.5 mland:py-1 px-1 whitespace-nowrap ${careerTab === k ? 'seg-btn-active' : ''}`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {careerTab === 'plan' && (
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex-1 min-h-0 flex flex-col justify-between gap-2 mland:gap-1.5 overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-bold text-sm mland:text-xs">📅 แผนฝึกซ้อมประจำสัปดาห์</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] mland:text-[8.5px] font-bold tabular text-[var(--ink)]">
                    ⚡ พลังกาย <b className={(p.en ?? 100) >= 75 ? 'text-[var(--g)]' : (p.en ?? 100) >= 55 ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--red)]'}>{Math.round(p.en ?? 100)}%</b>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.vid ? (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--g-soft)] border border-[var(--g)]/35 text-[10.5px] mland:text-[8.5px] font-bold text-[var(--g)]">
                      📺 บัฟวิดีโอนัดหน้า (+0.3 เรตติ้ง)
                    </span>
                  ) : null}
                  <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">มีผลหลังจบการแข่งแต่ละนัด</span>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 mland:grid-cols-3 gap-2 mland:gap-1.5 flex-1 content-start">
                {PACT.map((ac, idx) => {
                  const isSelected = (p.plan ?? 1) === idx;
                  const tagText =
                    ac.gr >= 0.14
                      ? ac.k === 'ph'
                        ? '💪 อัปความแกร่งไว'
                        : '📈 อัปพลังหลักไว'
                      : ac.gr > 0
                        ? '⚖️ พัฒนาสม่ำเสมอ'
                        : ac.vid
                          ? `📺 เรตติ้ง +${ac.vid}`
                          : ac.fan
                            ? `🤝 ขวัญ +${ac.fan}%`
                            : '💚 พักฟื้นเต็มที่';
                  return (
                    <button
                      key={ac.n}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onUpdateState((d) => { if (d.p) d.p.plan = idx; });
                        onToast(`ตั้งแผนสัปดาห์นี้เป็น "${ac.n}"`);
                      }}
                      className={`p-2.5 mland:p-1.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/40 shadow-xs'
                          : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-xs mland:text-[10px] flex items-center justify-between gap-1">
                          <span className="truncate">{ac.i} {ac.n}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded bg-[var(--g)] text-white text-[9px] mland:text-[7.5px] font-bold shrink-0">
                              เลือกอยู่
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug">{ac.d}</div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-[var(--line)]/50 text-[10px] mland:text-[8px] font-bold tabular">
                        <span className="text-[var(--g)]">{tagText}</span>
                        <span className="text-[var(--mut)]">⚡ ฟื้น +{ac.en}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="shrink-0 pt-1.5 border-t border-[var(--line)]/60 flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                <span className="text-[var(--mut)]">
                  {(p.en ?? 100) < 70
                    ? '😴 พลังกายเริ่มต่ำ แนะนำเลือก "พักผ่อน" หรือ "ซ้อมเบา" เพื่อเลี่ยงอาการบาดเจ็บ'
                    : '💪 พลังกายพร้อมเต็มที่ เหมาะสำหรับเร่งซ้อมพัฒนาค่าพลังหรือดูวิดีโอก่อนแข่ง'}
                </span>
                {p.last && (
                  <span className="px-2 py-0.5 rounded-lg bg-[var(--g-soft)] text-[var(--g)] font-bold">
                    ผลซ้อมล่าสุด: {p.last}
                  </span>
                )}
              </div>
            </div>
          )}

          {careerTab === 'missions' && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-2">
              <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
                <PlayerMissionsPanel
                  player={fakePlayer}
                  team={meTeam}
                  state={state}
                  onUpdateState={onUpdateState}
                  onToast={onToast}
                />
              </div>
            </div>
          )}

          {careerTab === 'perks' && (
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="seg-bar grid grid-cols-4 flex-1 min-w-0">
                  {([
                    ['perks', `🌟 ติดตัว (${perks.length})`],
                    ['traits', `🧬 สไตล์ (${(p.traits || []).length}/6)`],
                    ['roles', `🎯 ตำแหน่ง (${(p.altRoles || []).length})`],
                    ['sig', '⚡ อาวุธ']
                  ] as const).map(([sk, slbl]) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => { SFX.tap(); setSkillSubTab(sk); }}
                      className={`seg-btn whitespace-nowrap px-1.5 ${skillSubTab === sk ? 'seg-btn-active' : ''}`}
                    >
                      {slbl}
                    </button>
                  ))}
                </div>
                <span
                  title="ชื่อเสียงคงเหลือ"
                  className="px-2 py-1 rounded-lg bg-[var(--lamp-soft)] border border-[var(--lamp)]/40 text-xs mland:text-[10px] font-extrabold text-[#9a6700] dark:text-[var(--lamp)] tabular shrink-0 whitespace-nowrap"
                >
                  ★ {p.rep ?? 10}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                {skillSubTab === 'perks' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5 content-start">
                    {CAREER_PERKS.map((pk) => {
                      const owned = perks.includes(pk.id);
                      const canBuy = !owned && (p.rep ?? 10) >= pk.cost;
                      return (
                        <div key={pk.id} className={`p-2.5 mland:p-1.5 rounded-xl border flex items-center justify-between gap-2 ${owned ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)]'}`}>
                          <div className="min-w-0">
                            <div className="font-bold text-xs mland:text-[10] truncate">{pk.name}</div>
                            <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug line-clamp-2">{pk.desc}</div>
                          </div>
                          <button
                            type="button"
                            disabled={owned || !canBuy}
                            onClick={() => {
                              SFX.win();
                              onUpdateState((d) => {
                                if (!d.p) return;
                                d.p.rep = (d.p.rep ?? 10) - pk.cost;
                                d.p.perks = [...(d.p.perks || []), pk.id];
                              });
                              onToast(`ปลดล็อกสกิล "${pk.name}" แล้ว!`);
                            }}
                            className={`btn btn-sm shrink-0 whitespace-nowrap ${owned ? 'btn-primary opacity-80' : 'btn-gold'}`}
                          >
                            {owned ? '✓ มีแล้ว' : `ปลด ${pk.cost}★`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {skillSubTab === 'traits' && (
                  <div className="space-y-2">
                    <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">
                      เรียนรู้สไตล์การเล่นจริงในสนามให้เหมาะกับตำแหน่ง <b className="text-[var(--ink)]">{p.pos}</b> (สูงสุด 6 สไตล์ · เรียนเพิ่ม 6 ★ · ถอดเปลี่ยน 3 ★)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5">
                      {FOOTBALL_TRAITS.filter((tr) => tr.pos.includes(p.pos)).map((tr) => {
                        const myTraits = p.traits || [];
                        const owned = myTraits.includes(tr.id);
                        const conflictId = myTraits.find((cid) => tr.conflicts?.includes(cid));
                        const isFitRole = !tr.roles || tr.roles.includes(p.sp) || (p.altRoles || []).some((r) => tr.roles?.includes(r));
                        return (
                          <div
                            key={tr.id}
                            className={`p-2.5 mland:p-1.5 rounded-xl border flex items-center justify-between gap-2 ${
                              owned
                                ? 'bg-[var(--g-soft)]/60 border-[var(--g)]/55'
                                : 'bg-[var(--surface-2)]/70 border-[var(--line)]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-xs mland:text-[10] truncate">
                                {tr.icon} {tr.name}
                                {isFitRole && !owned && <span className="ml-1 text-[9.5px] text-[var(--g)]">· ถนัด</span>}
                              </div>
                              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug line-clamp-2">
                                {tr.desc}
                              </div>
                              {conflictId && !owned && (
                                <div className="text-[9.5px] text-[var(--red)] font-semibold">
                                  ขัดกับ: {FOOTBALL_TRAITS.find((x) => x.id === conflictId)?.name || conflictId}
                                </div>
                              )}
                            </div>
                            {owned ? (
                              <button
                                type="button"
                                disabled={myTraits.length <= 1 || (p.rep ?? 10) < 3}
                                onClick={() => {
                                  SFX.tap();
                                  let resMsg = '';
                                  onUpdateState((d) => {
                                    resMsg = forgetCareerTrait(d, tr.id).msg;
                                  });
                                  if (resMsg) onToast(resMsg);
                                }}
                                className="btn btn-xs btn-secondary shrink-0 whitespace-nowrap"
                              >
                                ถอด 3★
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!!conflictId || myTraits.length >= 6 || (p.rep ?? 10) < 6}
                                onClick={() => {
                                  SFX.win();
                                  let resMsg = '';
                                  onUpdateState((d) => {
                                    resMsg = learnCareerTrait(d, tr.id).msg;
                                  });
                                  if (resMsg) onToast(resMsg);
                                }}
                                className="btn btn-xs btn-primary shrink-0 whitespace-nowrap"
                              >
                                เรียน 6★
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {skillSubTab === 'roles' && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] mland:text-[9px] space-y-1">
                      <div>
                        ตำแหน่งหลัก: <b className="text-[var(--ink)]">{p.sp} ({SPN[p.sp] || p.sp})</b>
                        {(p.altRoles || []).length > 0 && (
                          <span className="ml-2 text-[var(--g)] font-bold">
                            · ถนัดเสริม: {(p.altRoles || []).join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="text-[var(--mut)]">
                        เลือก 1 ตำแหน่งเพื่อเก็บประสบการณ์ซ้อมพิเศษรายสัปดาห์ควบคู่กับการลงแข่งจริงจนปลดล็อกเป็นตำแหน่งถนัดเสริม
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mland:gap-1.5">
                      {ALL_SUB_ROLES.filter((r) => r !== p.sp && (p.pos === 'GK' ? r === 'GK' : r !== 'GK')).map((role) => {
                        const unlocked = (p.altRoles || []).includes(role);
                        const isTarget = p.roleTrain === role;
                        const need = LINE[role] === p.pos ? ROLE_ADAPT_THRESHOLD_ADJ : ROLE_ADAPT_THRESHOLD_CROSS;
                        const exp = p.roleExp?.[role] || 0;
                        const pct = unlocked ? 100 : clamp(Math.round((exp / need) * 100), 0, 100);
                        return (
                          <div
                            key={role}
                            className={`p-2.5 mland:p-1.5 rounded-xl border flex flex-col justify-between gap-1.5 ${
                              unlocked
                                ? 'bg-[var(--g-soft)]/55 border-[var(--g)]/55'
                                : isTarget
                                  ? 'bg-[var(--lamp-soft)]/60 border-[var(--lamp)]'
                                  : 'bg-[var(--surface-2)]/70 border-[var(--line)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-xs mland:text-[10] truncate">
                                  {role} · {SPN[role] || role}
                                </div>
                                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                                  {unlocked ? '✓ ปลดล็อกเล่นได้เต็มประสิทธิภาพ' : `ความคุ้นเคย: ${exp}/${need} ขั้น`}
                                </div>
                              </div>
                              {!unlocked && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    SFX.tap();
                                    let resMsg = '';
                                    onUpdateState((d) => {
                                      resMsg = setCareerRoleTrainTarget(d, isTarget ? null : role).msg;
                                    });
                                    if (resMsg) onToast(resMsg);
                                  }}
                                  className={`btn btn-xs shrink-0 whitespace-nowrap ${isTarget ? 'btn-gold' : 'btn-secondary'}`}
                                >
                                  {isTarget ? 'กำลังฝึก ✕' : 'ตั้งเป้าฝึก'}
                                </button>
                              )}
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                              <div className="h-full rounded-full bg-[var(--g)] transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {skillSubTab === 'sig' && (
                  <div className="space-y-2.5">
                    {(() => {
                      const activeSig = p.sig || details.D0.sig;
                      const sigBonus = p.sb?.[activeSig] || 0;
                      const sigKeys = (p.pos === 'GK'
                        ? ['sv', 'rfx', 'hnd', 'cl', 'pos', 'dist', 'sta', 'comp']
                        : Object.keys(SIGL).filter((k) => !['sv', 'rfx', 'hnd', 'cl', 'dist'].includes(k))
                      );
                      return (
                        <>
                          <div className="p-3 mland:p-2 rounded-xl bg-[var(--lamp-soft)]/55 border border-[var(--lamp)]/60 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-xs sm:text-sm font-extrabold text-[var(--ink)]">
                                ⚡ อาวุธประจำตัวปัจจุบัน: <span className="text-[#8a5b00] dark:text-[var(--lamp)]">{SIGL[activeSig] || activeSig}</span> (+8 สกิลพื้นฐาน)
                              </div>
                              <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular">
                                โบนัสซ้อมพิเศษสะสม: <b className="text-[var(--g)]">+{sigBonus}/12</b> · ติวเฉพาะทางเพิ่ม +1 ถาวร (ใช้ 4 ★ และพลังกาย 6%)
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={sigBonus >= 12 || (p.rep ?? 10) < 4 || (p.en ?? 100) < 25}
                              onClick={() => {
                                SFX.win();
                                let resMsg = '';
                                onUpdateState((d) => {
                                  resMsg = trainCareerSignatureDrill(d).msg;
                                });
                                if (resMsg) onToast(resMsg);
                              }}
                              className="btn btn-sm btn-gold shrink-0 whitespace-nowrap"
                            >
                              {sigBonus >= 12 ? 'เต็ม +12 แล้ว' : '🔥 ติวอาวุธ +1 (4 ★)'}
                            </button>
                          </div>

                          <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">
                            เปลี่ยนทักษะอาวุธประจำตัวใหม่ได้ทุกเมื่อ (ค่าใช้จ่าย 5 ★):
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                            {sigKeys.map((sk) => {
                              const isActive = activeSig === sk;
                              const curSkillVal = details.D0.d[sk] || 60;
                              return (
                                <button
                                  key={sk}
                                  type="button"
                                  disabled={isActive || (p.rep ?? 10) < 5}
                                  onClick={() => {
                                    SFX.tap();
                                    let resMsg = '';
                                    onUpdateState((d) => {
                                      resMsg = switchCareerSignature(d, sk).msg;
                                    });
                                    if (resMsg) onToast(resMsg);
                                  }}
                                  className={`p-2 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-1 ${
                                    isActive
                                      ? 'bg-[var(--g-soft)] border-[var(--g)] font-bold'
                                      : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)] disabled:opacity-55'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="text-[11px] mland:text-[9px] truncate text-[var(--ink)]">{SIGL[sk] || sk}</div>
                                    <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular">ค่าพลัง {curSkillVal}</div>
                                  </div>
                                  <span className="text-[9.5px] font-bold shrink-0 text-[var(--g)]">
                                    {isActive ? '✓ ใช้อยู่' : '5★'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {careerTab === 'stats' && (
            <div className="flex-1 min-h-0 flex flex-col gap-1.5 mland:gap-1 overflow-y-auto pr-0.5 pb-2">
              <PlayerSeasonProgressionCard
                player={fakePlayer}
                state={state}
                careerProfile={p}
                variant="inline"
              />
              <div
                className={`grid grid-cols-1 gap-1.5 mland:gap-1 ${
                  details.G.length === 6 ? 'sm:grid-cols-3 mland:grid-cols-3' : 'sm:grid-cols-2 mland:grid-cols-2'
                }`}
              >
                {details.G.map(([grp, items]) => (
                  <div
                    key={grp}
                    className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                  >
                    <div className="font-bold text-[11px] mland:text-[9px] mb-1 pb-0.5 border-b border-[var(--line)]/70">{grp}</div>
                    <div className="space-y-0.5">
                      {items.map(([lbl, val]) => (
                        <StatBarRow
                          key={lbl}
                          label={lbl}
                          value={val}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {careerTab === 'history' && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-2">
              <PlayerHistoryPanel
                player={fakePlayer}
                team={meTeam}
                state={state}
                onOpenSeasonStats={onOpenSeasonStats}
              />
            </div>
          )}
        </div>
      </div>

      {showLockerPicker && (
        <ShirtNumberLockerModal
          player={fakePlayer}
          team={meTeam}
          state={state}
          onClose={() => setShowLockerPicker(false)}
          onUpdateState={onUpdateState}
          onToast={onToast}
        />
      )}
    </div>
  );
};


