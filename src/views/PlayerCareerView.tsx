import React, { useState } from 'react';
import type { Player, GameState } from '../types/game';
import { clamp } from '../utils/math';
import { ATT, SIGL, PACT, CAREER_PERKS } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, getFormationSlots, xi, dtInfo, ovMe, syncMe, tc } from '../engine/playerCore';
import { statTierMeta, countReadyMissions } from '../engine/missions';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';

export const PlayerCareerView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
  onOpenSeasonStats?: (season?: number) => void;
}> = ({ state, onUpdateState, onToast, onOpenSeasonStats }) => {
  const [careerTab, setCareerTab] = useState<'plan' | 'missions' | 'perks' | 'stats'>('plan');
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
  const fakePlayer: Player = meSq || { n: p.name, pos: p.pos, ro: p.sp, ov, age: p.age, pot: 95, fit: p.en, inj: injCount, sus: susCount, yc: ycCount, rc: rcCount, no: myShirtNo, me: 1, sb: p.sb, missions: p.missions };
  const details = dtInfo(fakePlayer, p);
  const readyMissionCount = countReadyMissions(fakePlayer, p);
  const starters = xi(meTeam);
  const starterIdx = starters.findIndex((q) => q.me || q.n === p.name);
  const mySlot = starterIdx >= 0 ? getFormationSlots(meTeam)[starterIdx]?.sp : null;
  const kit1 = tc(meTeam, state, false);
  const kit2 = tc(meTeam, state, true);

  return (
    <div className="grid grid-cols-[255px_1fr] mland:grid-cols-[215px_1fr] flex-1 min-h-0 gap-3 mland:gap-2 items-stretch overflow-hidden">
      <div className="space-y-2.5 mland:space-y-1.5 h-full overflow-y-auto pr-0.5">
        {/* Collectible Career Athlete Card */}
        <div className="relative rounded-2xl mland:rounded-xl border border-white/15 bg-gradient-to-b from-[#16231d] via-[#0e1713] to-[#080e0b] text-white shadow-lg overflow-hidden flex flex-col">
          <div
            aria-hidden="true"
            className="h-1 w-full shrink-0"
            style={{ background: `linear-gradient(90deg, ${kit1}, ${kit2})` }}
          />
          <div className="px-3 pt-2 mland:px-2 mland:pt-1.5 flex items-start justify-between gap-2">
            <div className="leading-none">
              <div className={`text-2xl sm:text-[28px] mland:text-lg font-extrabold font-display tabular leading-none ${statTierMeta(ov).darkTextClass}`}>
                {ov}
                <span className="text-[10px] mland:text-[8px] text-white/45 font-semibold ml-0.5">/100</span>
              </div>
              <div className="text-[10px] mland:text-[8px] font-bold text-white/80 tracking-wide mt-0.5">
                {p.sp} · #{myShirtNo}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] mland:text-[8px] font-bold text-amber-200/90 tabular">
                ★ {p.rep ?? 10}
              </span>
              <div className="w-6 h-6 mland:w-5 mland:h-5 rounded-md bg-white/10 border border-white/15 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4 mland:[&>svg]:w-3.5 mland:[&>svg]:h-3.5">
                <ClubCrest name={meTeam.name} size={16} team={meTeam} club={state.club} isMyClub={false} />
              </div>
            </div>
          </div>

          {/* Studio Spotlight Portrait Stage */}
          <div className="relative mx-2.5 my-1.5 mland:mx-2 mland:my-1 rounded-xl border border-white/10 bg-gradient-to-b from-[#23322c] via-[#18231e] to-[#111915] pt-1.5 mland:pt-1 flex items-end justify-center overflow-hidden shadow-inner">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle at 50% 48%, rgba(241, 248, 244, 0.24) 0%, rgba(212, 228, 220, 0.08) 46%, transparent 74%)'
              }}
            />
            <div className="relative z-10 [&>svg]:w-[80px] [&>svg]:h-[86px] mland:[&>svg]:w-[54px] mland:[&>svg]:h-[58px] drop-shadow-[0_10px_16px_rgba(0,0,0,0.72)]">
              <PlayerFace
                player={fakePlayer}
                team={meTeam}
                state={state}
                careerProfile={p}
                kitColor={kit1}
                trimColor={kit2}
                size={82}
                bare
              />
            </div>
          </div>

          <div className="px-2.5 pb-1.5 mland:px-2 mland:pb-1 text-center space-y-0.5">
            <div className="font-display font-extrabold text-sm mland:text-[11px] text-white truncate leading-tight">
              {p.name}
            </div>
            <div className="text-[10px] mland:text-[8px] text-emerald-100/80 truncate tabular">
              {meTeam.name} · อายุ {p.age} ปี
            </div>
            {(p.archName || details.D0.sig) && (
              <div className="text-[10px] mland:text-[8px] font-semibold text-[#fad05a] truncate">
                {p.archName || 'สไตล์เฉพาะตัว'} · ⭐ {SIGL[details.D0.sig] || details.D0.sig}
              </div>
            )}
          </div>

          {/* Bar-less Tier-Colored 5 Core Stats Strip (/100) */}
          <div className="bg-[#060c09]/92 border-t border-white/10 px-2 py-2 mland:px-1.5 mland:py-1 grid grid-cols-5 gap-1 text-center">
            {ATT.map(([k, l]) => {
              const val = p.a[k];
              const tier = statTierMeta(val);
              return (
                <div key={k} className="rounded-lg bg-white/[0.04] py-1 mland:py-0.5 px-0.5">
                  <div className="text-[8.5px] mland:text-[7px] text-white/60 leading-tight truncate">{l}</div>
                  <div className={`text-xs sm:text-[13px] mland:text-[10px] font-extrabold font-display tabular leading-tight mt-0.5 ${tier.darkTextClass}`}>
                    {val}
                    <span className="text-[7.5px] mland:text-[6.5px] text-white/40 font-semibold">/100</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-2 mland:space-y-1">
          <div className="flex items-center justify-between text-xs mland:text-[10px] font-bold">
            <span>⚡ พลังกาย (Energy)</span>
            <span className={`tabular font-extrabold ${statTierMeta(p.en).textClass}`}>
              {p.en}<span className="text-[9.5px] opacity-60 font-semibold">/100</span>
            </span>
          </div>

          <div className={`p-2.5 mland:p-1.5 rounded-xl border text-xs mland:text-[10px] space-y-1.5 mland:space-y-0.5 ${injCount > 0 || susCount > 0 ? 'bg-[var(--red-soft)] border-[var(--red)]/40' : mySlot ? 'bg-[var(--g-soft)] border-[var(--g)]/35' : 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45'}`}>
            <div className="flex items-center justify-between font-bold">
              <span>
                {injCount > 0
                  ? `🩹 บาดเจ็บ พักอีก ${injCount} นัด`
                  : susCount > 0
                    ? `🟥 โดนแบน ${susCount} นัด`
                    : mySlot
                      ? `⭐ สถานะ: ตัวจริง (${mySlot})`
                      : '🪑 สถานะ: ตัวสำรอง'}
              </span>
              <span className="tabular text-[11px] mland:text-[9.5px]">🟨 {ycCount}/3 · 🟥 {rcCount}</span>
            </div>
            <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">
              {injCount > 0
                ? 'เลือก "😴 พักผ่อน" จะฟื้นเร็ว -2 นัด/สัปดาห์ หรือทำกายภาพส่วนตัวเพื่อลดวันพักทันที'
                : susCount > 0
                  ? 'ชดใช้โทษแบนหมดแล้วจึงจะกลับมาลงสนามได้ (สะสม 3 เหลือง = แบน 1 นัด)'
                  : mySlot
                    ? 'หากพลังกายต่ำกว่า 58% หรือฟอร์มตก โค้ชอาจดรอปเป็นตัวสำรองหรือเปลี่ยนออก'
                    : 'มีคู่แข่งตำแหน่งเดียวกันพลังสูงกว่า หรือพลังกายยังล้า — รอโอกาสเปลี่ยนตัวลงครึ่งหลัง'}
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
                className="w-full py-1.5 mland:py-1 rounded-lg bg-[var(--g)] text-white text-[11px] mland:text-[9.5px] font-bold cursor-pointer disabled:opacity-45"
              >
                💆 ทำกายภาพส่วนตัว (-1 นัด · +12% พลังกาย · ใช้ 4 ชื่อเสียง)
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mland:gap-1 pt-1 mland:pt-0 text-center">
            <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">ลงสนาม / ประตู</div><b className="text-sm mland:text-[10.5px] tabular">{p.ap} นัด · ⚽ {p.gl}</b></div>
            <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">แอสซิสต์ / เรตติ้ง</div><b className="text-sm mland:text-[10.5px] tabular">🎯 {p.as} · ⭐ {avgRt}</b></div>
            <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">ทีมชาติไทย 🇹🇭</div><b className="text-sm mland:text-[10.5px] tabular">{p.ntCaps || 0} นัด · {p.ntGoals || 0} ประตู</b></div>
            <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">ฟอร์ม 5 นัดหลัง</div><b className="text-xs mland:text-[9.5px] tabular">{(p.fm || []).length ? p.fm!.join(' · ') : '-'}</b></div>
          </div>

          {onOpenSeasonStats && (state.seasonArchives?.length || 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onOpenSeasonStats();
              }}
              className="w-full py-2 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-xs mland:text-[10px] font-bold cursor-pointer transition-colors"
            >
              📊 สถิติทีมและผู้เล่นซีซั่นที่จบแล้ว ({state.seasonArchives!.length})
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mland:space-y-1 h-full flex flex-col min-h-0">
        <div className="grid grid-cols-4 gap-1 p-1 mland:p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          {([
            ['plan', '📅 แผนฝึกซ้อม'],
            ['missions', `🎯 ภารกิจ${readyMissionCount ? ` (${readyMissionCount})` : ''}`],
            ['perks', `🌟 สกิล (${perks.length})`],
            ['stats', '📊 ค่าพลัง']
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setCareerTab(k)}
              className={`py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-bold cursor-pointer transition-colors ${careerTab === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="space-y-2.5 mland:space-y-2 flex-1 min-h-0 overflow-y-auto pr-0.5">
        <div className={`p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'plan' ? '' : 'hidden'}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm mland:text-xs">📅 แผนฝึกซ้อมประจำสัปดาห์</h3>
            {p.vid ? <span className="text-xs mland:text-[10px] font-bold text-[var(--g)]">📺 มีบัฟวิดีโอนัดหน้า (+0.3 เรตติ้ง)</span> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PACT.map((ac, idx) => (
              <button
                key={ac.n}
                type="button"
                onClick={() => {
                  SFX.tap();
                  onUpdateState((d) => { if (d.p) d.p.plan = idx; });
                  onToast(`ตั้งแผนสัปดาห์นี้เป็น "${ac.n}"`);
                }}
                className={`p-3 mland:p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  (p.plan ?? 1) === idx ? 'bg-[var(--g-soft)] border-[var(--g)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>{ac.i} {ac.n}</span>
                  {(p.plan ?? 1) === idx && <span className="text-[var(--g)]">● เลือกอยู่</span>}
                </div>
                <div className="text-[11px] text-[var(--mut)] mt-0.5">{ac.d}</div>
              </button>
            ))}
          </div>
          {p.last && <p className="text-xs text-[var(--g)] font-semibold pt-1">สัปดาห์ล่าสุด: {p.last}</p>}
        </div>

        <div className={`p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'missions' ? '' : 'hidden'}`}>
          <PlayerMissionsPanel
            player={fakePlayer}
            team={meTeam}
            state={state}
            onUpdateState={onUpdateState}
            onToast={onToast}
          />
        </div>

        <div className={`p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'perks' ? '' : 'hidden'}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm mland:text-xs">🌟 สกิลติดตัวนักเตะ (Career Perks)</h3>
            <span className="text-xs font-bold text-[#9a6700] dark:text-[var(--lamp)] tabular">ชื่อเสียงคงเหลือ: {p.rep ?? 10}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CAREER_PERKS.map((pk) => {
              const owned = perks.includes(pk.id);
              const canBuy = !owned && (p.rep ?? 10) >= pk.cost;
              return (
                <div key={pk.id} className={`p-3 mland:p-2 rounded-xl border flex items-center justify-between gap-2 ${owned ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)]'}`}>
                  <div className="min-w-0">
                    <div className="font-bold text-xs">{pk.name}</div>
                    <div className="text-[11px] text-[var(--mut)]">{pk.desc}</div>
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer disabled:opacity-45 ${owned ? 'bg-[var(--g)] text-white' : 'bg-[var(--lamp)] text-[#261900]'}`}
                  >
                    {owned ? 'มีแล้ว' : `ปลด ${pk.cost}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`space-y-2 mland:space-y-1.5 ${careerTab === 'stats' ? '' : 'hidden'}`}>
          <div className="px-3 py-2 mland:px-2.5 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex items-center justify-between gap-2">
            <h3 className="font-bold text-xs sm:text-sm mland:text-[10.5px]">📊 รายละเอียดค่าพลังเฉพาะทาง (เต็ม 100)</h3>
            <span className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate">
              จุดเด่น: <b className="text-[var(--g)]">⭐ {SIGL[details.D0.sig] || details.D0.sig}</b>
            </span>
          </div>
          {details.G.length === 5 ? (
            <div className="flex flex-col gap-2 mland:gap-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
                {details.G.slice(0, 2).map(([grp, items]) => (
                  <div
                    key={grp}
                    className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                  >
                    <div className="font-bold text-xs mland:text-[9.5px] mb-1 pb-1 border-b border-[var(--line)]/70">{grp}</div>
                    <div className="space-y-0.5">
                      {items.map(([lbl, val, statKey]) => (
                        <StatBarRow
                          key={lbl}
                          label={lbl}
                          value={val}
                          isSig={!!(statKey && statKey === details.D0.sig)}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-2 mland:gap-1.5">
                {details.G.slice(2).map(([grp, items]) => (
                  <div
                    key={grp}
                    className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                  >
                    <div className="font-bold text-xs mland:text-[9.5px] mb-1 pb-1 border-b border-[var(--line)]/70">{grp}</div>
                    <div className="space-y-0.5">
                      {items.map(([lbl, val, statKey]) => (
                        <StatBarRow
                          key={lbl}
                          label={lbl}
                          value={val}
                          isSig={!!(statKey && statKey === details.D0.sig)}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
              {details.G.map(([grp, items]) => (
                <div
                  key={grp}
                  className="px-3 py-2 mland:px-2 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
                >
                  <div className="font-bold text-xs mland:text-[9.5px] mb-1 pb-1 border-b border-[var(--line)]/70">{grp}</div>
                  <div className="space-y-0.5">
                    {items.map(([lbl, val, statKey]) => (
                      <StatBarRow
                        key={lbl}
                        label={lbl}
                        value={val}
                        isSig={!!(statKey && statKey === details.D0.sig)}
                        compact
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};


