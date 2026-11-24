import React, { useState } from 'react';
import type { Player, GameState } from '../types/game';
import { clamp } from '../utils/math';
import { ATT, PACT, CAREER_PERKS } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, getFormationSlots, xi, dtInfo, ovMe, syncMe, tc } from '../engine/playerCore';
import { statBarColor, statTierMeta, getPlayerTalent, talentTierMeta } from '../engine/missions';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { PlayerHistoryPanel } from '../components/PlayerHistoryPanel';
import { PlayerSeasonProgressionCard } from '../components/PlayerSeasonProgressionCard';

export const PlayerCareerView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
  onOpenSeasonStats?: (season?: number) => void;
}> = ({ state, onUpdateState, onToast, onOpenSeasonStats }) => {
  const [careerTab, setCareerTab] = useState<'plan' | 'missions' | 'perks' | 'stats' | 'history'>('plan');
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
  const fakePlayer: Player = meSq || { n: p.name, pos: p.pos, ro: p.sp, ov, age: p.age, pot: 95, talent: p.talent, traits: p.traits, fit: p.en, inj: injCount, sus: susCount, yc: ycCount, rc: rcCount, no: myShirtNo, me: 1, sb: p.sb, missions: p.missions };
  const details = dtInfo(fakePlayer, p);
  const myTalent = getPlayerTalent(fakePlayer, p);
  const tlMeta = talentTierMeta(myTalent);
  const starters = xi(meTeam);
  const starterIdx = starters.findIndex((q) => q.me || q.n === p.name);
  const mySlot = starterIdx >= 0 ? getFormationSlots(meTeam)[starterIdx]?.sp : null;
  const kit1 = tc(meTeam, state, false);
  const kit2 = tc(meTeam, state, true);

  return (
    <div className="grid grid-cols-[248px_1fr] mland:grid-cols-[206px_1fr] flex-1 min-h-0 gap-2.5 mland:gap-1.5 items-stretch overflow-hidden">
      <div className="flex flex-col gap-2 mland:gap-1 h-full min-h-0 overflow-y-auto pr-0.5">
        {/* Collectible Career Athlete Card */}
        <div className="relative rounded-2xl mland:rounded-xl border border-white/15 bg-gradient-to-b from-[#16231d] via-[#0e1713] to-[#080e0b] text-white shadow-lg overflow-hidden flex flex-col shrink-0">
          <div
            aria-hidden="true"
            className="h-1 w-full shrink-0"
            style={{ background: `linear-gradient(90deg, ${kit1}, ${kit2})` }}
          />
          <div className="px-2.5 pt-1.5 mland:px-2 mland:pt-1 flex items-start justify-between gap-1.5">
            <div className="leading-none">
              <div className={`text-xl sm:text-[24px] mland:text-base font-extrabold font-display tabular leading-none ${statTierMeta(ov).darkTextClass}`}>
                {ov}
              </div>
              <div className="text-[9.5px] mland:text-[7.5px] font-bold text-white/80 tracking-wide mt-0.5">
                {p.sp} · #{myShirtNo}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span
                className="px-1.5 py-[1px] rounded text-[8.5px] mland:text-[7px] font-extrabold tabular border border-white/15"
                style={{ background: tlMeta.bg, color: tlMeta.color }}
                title={`พรสวรรค์ ${myTalent}/99 (${tlMeta.label})`}
              >
                TL {myTalent}
              </span>
              <span className="text-[9.5px] mland:text-[7.5px] font-bold text-amber-200/90 tabular">
                ★ {p.rep ?? 10}
              </span>
              <div className="w-5 h-5 mland:w-4 mland:h-4 rounded-md bg-white/10 border border-white/15 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5 mland:[&>svg]:w-3 mland:[&>svg]:h-3">
                <ClubCrest name={meTeam.name} size={14} team={meTeam} club={state.club} isMyClub={false} />
              </div>
            </div>
          </div>

          {/* Studio Spotlight Portrait Stage */}
          <div className="relative mx-2 my-1 mland:mx-1.5 mland:my-0.5 rounded-xl border border-white/10 bg-gradient-to-b from-[#23322c] via-[#18231e] to-[#111915] pt-1 mland:pt-0.5 flex items-end justify-center overflow-hidden shadow-inner">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle at 50% 48%, rgba(241, 248, 244, 0.24) 0%, rgba(212, 228, 220, 0.08) 46%, transparent 74%)'
              }}
            />
            <div className="relative z-10 [&>svg]:w-[64px] [&>svg]:h-[68px] mland:[&>svg]:w-[44px] mland:[&>svg]:h-[48px] drop-shadow-[0_8px_12px_rgba(0,0,0,0.72)]">
              <PlayerFace
                player={fakePlayer}
                team={meTeam}
                state={state}
                careerProfile={p}
                kitColor={kit1}
                trimColor={kit2}
                size={66}
                bare
              />
            </div>
          </div>

          <div className="px-2 pb-1.5 mland:px-1.5 mland:pb-1 text-center space-y-0.5">
            <div className="font-display font-extrabold text-[13px] mland:text-[10.5px] text-white truncate leading-tight">
              {p.name}
            </div>
            <div className="text-[9.5px] mland:text-[7.5px] text-emerald-100/80 truncate tabular">
              {meTeam.name} · อายุ {p.age} ปี
            </div>
            {p.archName && (
              <div className="text-[9.5px] mland:text-[7.5px] font-semibold text-[#fad05a] truncate">
                {p.archName}
              </div>
            )}
            {details.traits.length > 0 && (
              <div className="flex flex-wrap justify-center gap-0.5 pt-0.5">
                {details.traits.map((t) => (
                  <span
                    key={t.id}
                    title={t.desc}
                    className={`px-1 py-[1px] rounded text-[8px] mland:text-[6.5px] font-bold border leading-tight ${
                      ['hot_headed', 'selfish_shooter', 'glass_cannon', 'slide_tackler'].includes(t.id)
                        ? 'bg-amber-400/15 border-amber-300/35 text-amber-200'
                        : 'bg-emerald-400/15 border-emerald-300/30 text-emerald-100'
                    }`}
                  >
                    {t.icon} {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 5 Core Stats Strip with Color Bars */}
          <div className="bg-[#060c09]/92 border-t border-white/10 px-1.5 py-1.5 mland:px-1 mland:py-1 grid grid-cols-5 gap-1 text-center">
            {ATT.map(([k, l]) => {
              const val = p.a[k];
              const tier = statTierMeta(val);
              return (
                <div key={k} className="rounded-lg bg-white/[0.04] py-0.5 px-0.5 space-y-0.5">
                  <div className="text-[8px] mland:text-[6.5px] text-white/60 leading-tight truncate">{l}</div>
                  <div className={`text-[11.5px] mland:text-[9.5px] font-extrabold font-display tabular leading-tight ${tier.darkTextClass}`}>
                    {val}
                  </div>
                  <div className="h-2 mland:h-1.5 rounded-full bg-white/15 overflow-hidden mx-0.5">
                    <div className="h-full rounded-full transition-all" style={{ width: `${clamp(val, 8, 100)}%`, background: statBarColor(val) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-1.5 mland:space-y-1 flex-1 min-h-0 flex flex-col justify-between">
          <div className="space-y-1.5 mland:space-y-1">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11.5px] mland:text-[9.5px] font-bold">
                <span>⚡ พลังกาย (Energy)</span>
                <span className={`tabular font-extrabold ${statTierMeta(p.en).textClass}`}>
                  {p.en}
                </span>
              </div>
              <div className="h-2.5 mland:h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${clamp(p.en, 6, 100)}%`, background: statBarColor(p.en) }} />
              </div>
            </div>

            <div className={`p-2 mland:p-1 rounded-xl border text-[11px] mland:text-[9px] space-y-1 mland:space-y-0.5 ${injCount > 0 || susCount > 0 ? 'bg-[var(--red-soft)] border-[var(--red)]/40' : mySlot ? 'bg-[var(--g-soft)] border-[var(--g)]/35' : 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45'}`}>
              <div className="flex items-center justify-between font-bold">
                <span>
                  {injCount > 0
                    ? `🩹 เจ็บพัก ${injCount} นัด`
                    : susCount > 0
                      ? `🟥 แบน ${susCount} นัด`
                      : mySlot
                        ? `⭐ ตัวจริง (${mySlot})`
                        : '🪑 ตัวสำรอง'}
                </span>
                <span className="tabular text-[10px] mland:text-[8.5px]">🟨 {ycCount}/3 · 🟥 {rcCount}</span>
              </div>
              <div className="text-[10px] mland:text-[8px] text-[var(--mut)] leading-snug line-clamp-2">
                {injCount > 0
                  ? 'เลือก "😴 พักผ่อน" ฟื้นเร็ว -2 นัด หรือทำกายภาพส่วนตัวทันที'
                  : susCount > 0
                    ? 'ชดใช้โทษแบนหมดจึงกลับมาลงได้ (3 เหลือง = แบน 1 นัด)'
                    : mySlot
                      ? 'ฟิตต่ำกว่า 58% หรือฟอร์มตก โค้ชอาจดรอปเป็นสำรอง'
                      : 'รอโอกาสเปลี่ยนตัวลงครึ่งหลัง หรือเร่งแซงคู่แข่งตำแหน่งเดียวกัน'}
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
                  className="w-full py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-[10.5px] mland:text-[8.5px] font-bold cursor-pointer disabled:opacity-45"
                >
                  💆 กายภาพ (-1 นัด · +12% ฟิต · 4 ★)
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 mland:gap-1 text-center">
              <div className="p-1.5 mland:p-1 rounded-xl bg-[var(--surface-2)]">
                <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">ลงสนาม / ประตู</div>
                <div className="text-xs mland:text-[9.5px] font-extrabold tabular inline-flex items-center justify-center gap-1">
                  <span>👕 {p.ap}</span>
                  <span className="opacity-45">·</span>
                  <span>⚽ {p.gl}</span>
                </div>
              </div>
              <div className="p-1.5 mland:p-1 rounded-xl bg-[var(--surface-2)]">
                <div className="text-[10px] mland:text-[8px] text-[var(--mut)]">{p.pos === 'GK' ? 'คลีนชีต / เรต' : 'แอสซิสต์ / เรต'}</div>
                <div className="text-xs mland:text-[9.5px] font-extrabold tabular inline-flex items-center justify-center gap-1">
                  <span>{p.pos === 'GK' ? '🧤' : '🎯'} {p.pos === 'GK' ? (meSq?.cs || 0) : p.as}</span>
                  <span className="opacity-45">·</span>
                  <span>⭐ {avgRt}</span>
                </div>
              </div>
              <div className="col-span-2 px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-xl bg-[var(--surface-2)] flex items-center justify-between gap-2 text-left">
                <span className="text-[10px] mland:text-[8px] text-[var(--mut)] font-semibold">🇹🇭 ทีมชาติไทย</span>
                <b className="text-[11px] mland:text-[9px] tabular">{p.ntCaps || 0} นัด · {p.ntGoals || 0} ประตู</b>
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
                        ? '↘ แผ่วลง'
                        : recentAvg >= 7.1
                          ? '✨ สม่ำเสมอ'
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
                  <div className="col-span-2 p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]/70 space-y-1.5 mland:space-y-1 text-left">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[10px] mland:text-[8px] font-bold text-[var(--mut)]">ฟอร์ม 5 นัดล่าสุด</span>
                        <span className="text-[9.5px] mland:text-[7.5px] font-bold text-[var(--ink)]/80 truncate">· {trendLabel}</span>
                      </div>
                      {recentFm.length > 0 && (
                        <span className={`text-[10px] mland:text-[8px] font-extrabold tabular shrink-0 ${avgCls}`}>
                          เฉลี่ย {recentAvg.toFixed(1)}
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
                              className="rounded-lg border border-dashed border-[var(--line)]/80 bg-[var(--surface)]/45 py-1 mland:py-0.5 flex flex-col items-center justify-end gap-0.5 text-[var(--mut)]/55"
                            >
                              <div className="w-full px-1.5 h-3.5 mland:h-2.5 flex items-end justify-center">
                                <span className="w-2 h-[2px] rounded-full bg-current opacity-50" />
                              </div>
                              <span className="text-[9.5px] mland:text-[7.5px] font-bold tabular leading-none">-</span>
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
                            className={`rounded-lg border py-1 mland:py-0.5 flex flex-col items-center justify-end gap-0.5 transition-all ${tier.box} ${
                              isLatest ? 'ring-1 ring-[var(--ink)]/25 shadow-2xs' : 'opacity-90'
                            }`}
                          >
                            <div className="w-full px-1.5 h-3.5 mland:h-2.5 flex items-end justify-center">
                              <div className="w-2.5 mland:w-2 h-full rounded-sm bg-black/10 dark:bg-white/10 overflow-hidden flex items-end">
                                <div
                                  className="w-full rounded-sm"
                                  style={{ height: `${pct}%`, background: tier.bar }}
                                />
                              </div>
                            </div>
                            <span className={`text-[10px] mland:text-[8px] tabular leading-none ${isLatest ? 'font-black' : 'font-extrabold'}`}>
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
          </div>

          {onOpenSeasonStats && (state.seasonArchives?.length || 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onOpenSeasonStats();
              }}
              className="w-full py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-[11px] mland:text-[9px] font-bold cursor-pointer transition-colors shrink-0"
            >
              📊 สถิติซีซั่นที่จบแล้ว ({state.seasonArchives!.length})
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mland:space-y-1 h-full flex flex-col min-h-0">
        <div className="grid grid-cols-5 gap-1 p-1 mland:p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          {([
            ['plan', '📅 แผนฝึก'],
            ['missions', '🎯 ภารกิจ'],
            ['perks', `🌟 สกิล (${perks.length})`],
            ['stats', '📊 ค่าพลัง'],
            ['history', '📜 ประวัติ']
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setCareerTab(k)}
              className={`py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-bold cursor-pointer transition-colors truncate px-1 ${careerTab === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          {careerTab === 'plan' && (
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex-1 min-h-0 flex flex-col justify-between gap-2 mland:gap-1.5 overflow-y-auto">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <h3 className="font-bold text-sm mland:text-xs">📅 แผนฝึกซ้อมประจำสัปดาห์</h3>
                {p.vid ? <span className="text-xs mland:text-[9.5px] font-bold text-[var(--g)]">📺 มีบัฟวิดีโอนัดหน้า (+0.3 เรตติ้ง)</span> : null}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 mland:grid-cols-3 gap-2 mland:gap-1.5 flex-1 content-start">
                {PACT.map((ac, idx) => (
                  <button
                    key={ac.n}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      onUpdateState((d) => { if (d.p) d.p.plan = idx; });
                      onToast(`ตั้งแผนสัปดาห์นี้เป็น "${ac.n}"`);
                    }}
                    className={`p-2.5 mland:p-1.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      (p.plan ?? 1) === idx ? 'bg-[var(--g-soft)] border-[var(--g)] shadow-xs' : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
                    }`}
                  >
                    <div className="font-bold text-xs mland:text-[10px] flex items-center justify-between gap-1">
                      <span className="truncate">{ac.i} {ac.n}</span>
                      {(p.plan ?? 1) === idx && <span className="text-[var(--g)] text-[10px] mland:text-[8.5px] shrink-0">● เลือกอยู่</span>}
                    </div>
                    <div className="text-[11px] mland:text-[9px] text-[var(--mut)] mt-1 leading-snug">{ac.d}</div>
                  </button>
                ))}
              </div>
              <div className="shrink-0 pt-1.5 border-t border-[var(--line)]/60 flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[9.5px]">
                <span className="text-[var(--mut)]">
                  💡 แตะตราสโมสรมุมบนซ้าย 5 ครั้ง เพื่อเปิด <b className="text-[var(--ink)]">โหมดลับ VIP</b> (เติมชื่อเสียง/ฟื้นพลังกาย/เพิ่มพลังนักเตะได้)
                </span>
                {p.last && <span className="text-[var(--g)] font-bold">ล่าสุด: {p.last}</span>}
              </div>
            </div>
          )}

          {careerTab === 'missions' && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
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
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-y-auto">
              <div className="flex items-center justify-between shrink-0">
                <h3 className="font-bold text-sm mland:text-xs">🌟 สกิลติดตัวนักเตะ (Career Perks)</h3>
                <span className="text-xs mland:text-[10px] font-bold text-[#9a6700] dark:text-[var(--lamp)] tabular">ชื่อเสียงคงเหลือ: ★ {p.rep ?? 10}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mland:gap-1.5 flex-1 content-start">
                {CAREER_PERKS.map((pk) => {
                  const owned = perks.includes(pk.id);
                  const canBuy = !owned && (p.rep ?? 10) >= pk.cost;
                  return (
                    <div key={pk.id} className={`p-2.5 mland:p-1.5 rounded-xl border flex items-center justify-between gap-2 ${owned ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)]'}`}>
                      <div className="min-w-0">
                        <div className="font-bold text-xs mland:text-[10px] truncate">{pk.name}</div>
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
                        className={`px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-lg text-[11px] mland:text-[9px] font-bold shrink-0 cursor-pointer disabled:opacity-45 ${owned ? 'bg-[var(--g)] text-white' : 'bg-[var(--lamp)] text-[#261900]'}`}
                      >
                        {owned ? 'มีแล้ว' : `ปลด ${pk.cost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {careerTab === 'stats' && (
            <div className="flex-1 min-h-0 flex flex-col gap-1.5 mland:gap-1 overflow-y-auto pr-0.5">
              <PlayerSeasonProgressionCard
                player={fakePlayer}
                state={state}
                careerProfile={p}
                variant="inline"
                defaultOpen
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
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
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
    </div>
  );
};


