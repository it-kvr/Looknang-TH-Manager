import React, { useState } from 'react';
import type { Player, GameState } from '../types/game';
import { clamp } from '../utils/math';
import { ATT, SIGL, PACT, CAREER_PERKS } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, getFormationSlots, xi, dtInfo, ovMe, syncMe } from '../engine/playerCore';
import { ovColor, countReadyMissions } from '../engine/missions';
import { PlayerFace } from '../components/SvgVisuals';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';

export const PlayerCareerView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ state, onUpdateState, onToast }) => {
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] mland:flex-1 mland:min-h-0 mland:grid-cols-[215px_1fr] gap-4 mland:gap-2 items-start mland:items-stretch mland:overflow-hidden">
      <div className="space-y-4 mland:space-y-1.5 mland:h-full mland:overflow-y-auto mland:pr-0.5">
        <div className="rounded-3xl mland:rounded-2xl p-4 mland:p-2 text-white border border-white/20" style={{ background: `linear-gradient(155deg, ${ovColor(ov)}, #0b1f15 78%)` }}>
          <div className="flex items-center justify-between gap-3 mland:gap-1.5 mland:[&_svg]:w-14 mland:[&_svg]:h-14">
            <div className="text-center">
              <div className="text-4xl mland:text-xl font-bold font-display leading-none">{ov}</div>
              <div className="text-xs mland:text-[9px] font-bold mt-1 mland:mt-0.5 border-t border-white/40 pt-1 mland:pt-0.5">{p.sp} · #{myShirtNo}</div>
            </div>
            <PlayerFace player={fakePlayer} team={meTeam} state={state} careerProfile={p} size={86} bare />
          </div>
          <div className="text-center font-bold text-lg mland:text-xs border-b border-white/30 py-2 mland:py-0.5 truncate">{p.name}</div>
          <div className="text-center text-xs mland:text-[9.5px] opacity-85 py-1.5 mland:py-0.5">{meTeam.name} · เสื้อ #{myShirtNo} · อายุ {p.age} ปี · ชื่อเสียง {p.rep ?? 10}</div>
          {(p.archName || details.D0.sig) && (
            <div className="text-center text-[11px] mland:text-[9px] font-semibold text-white/90 pb-1 mland:pb-0.5">
              {p.archName || 'สไตล์เฉพาะตัว'} · ⭐ {SIGL[details.D0.sig] || details.D0.sig}
            </div>
          )}
          <div className="grid grid-cols-5 gap-1 pt-2 mland:pt-1 text-center text-[11px] mland:text-[9px]">
            {ATT.map(([k, l]) => (
              <div key={k}>
                <div className="text-base mland:text-xs font-bold tabular">{p.a[k]}</div>
                <div className="opacity-85">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
          <div className="flex items-center justify-between text-xs mland:text-[10.5px] font-bold">
            <span>⚡ พลังกาย (Energy)</span>
            <span className="tabular">{p.en}%</span>
          </div>
          <div className="h-2.5 mland:h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${p.en}%`, background: p.en >= 70 ? 'var(--g)' : p.en >= 45 ? 'var(--lamp)' : 'var(--red)' }} />
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
        </div>
      </div>

      <div className="space-y-4 mland:space-y-1 mland:h-full mland:flex mland:flex-col mland:min-h-0">
        <div className="hidden mland:grid grid-cols-4 gap-1 p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
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
              className={`py-1 rounded-lg text-[10px] font-bold cursor-pointer ${careerTab === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="space-y-4 mland:space-y-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
        <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'plan' ? '' : 'mland:hidden'}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm mland:text-xs">📅 แผนฝึกซ้อมประจำสัปดาห์</h3>
            {p.vid ? <span className="text-xs mland:text-[10px] font-bold text-[var(--g)]">📺 มีบัฟวิดีโอนัดหน้า (+0.3 เรตติ้ง)</span> : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

        <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'missions' ? '' : 'mland:hidden'}`}>
          <PlayerMissionsPanel
            player={fakePlayer}
            team={meTeam}
            state={state}
            onUpdateState={onUpdateState}
            onToast={onToast}
          />
        </div>

        <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'perks' ? '' : 'mland:hidden'}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm mland:text-xs">🌟 สกิลติดตัวนักเตะ (Career Perks)</h3>
            <span className="text-xs font-bold text-[var(--lamp)]">ชื่อเสียงคงเหลือ: {p.rep ?? 10}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

        <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'stats' ? '' : 'mland:hidden'}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm mland:text-xs">📊 รายละเอียดค่าพลัง</h3>
            <span className="text-[11px] text-[var(--mut)]">จุดเด่น: <b className="text-[var(--g)]">⭐ {SIGL[details.D0.sig] || details.D0.sig}</b></span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mland:gap-2">
            {details.G.map(([grp, items]) => (
              <div key={grp} className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/75 space-y-1">
                <div className="font-bold text-xs mb-1.5 pb-1 border-b border-[var(--line)]/60">{grp}</div>
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
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};


