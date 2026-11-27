import React, { useMemo, useState } from 'react';
import { Scissors } from 'lucide-react';
import type { Player, GameState } from '../types/game';
import { clamp } from '../utils/math';
import { PACT, CAREER_PERKS, FOOTBALL_TRAITS, SIGL, ALL_SUB_ROLES, SPN, ATT } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import {
  getShirtNo,
  getFormationSlots,
  xi,
  dtInfo,
  summarizeStatGroups,
  ovMe,
  tc,
  pen,
  learnCareerTrait,
  forgetCareerTrait,
  setCareerRoleTrainTarget,
  switchCareerSignature,
  trainCareerSignatureDrill,
  ROLE_ADAPT_THRESHOLD_ADJ,
  ROLE_ADAPT_THRESHOLD_CROSS,
  ROLE_ADAPT_TARGETS
} from '../engine/playerCore';
import { getPlayerTalent } from '../engine/missions';
import { ClubCrest } from '../components/SvgVisuals';
import { StatBarRow, PlayerMissionsPanel } from '../components/PlayerMissionsPanel';
import { PlayerHistoryPanel } from '../components/PlayerHistoryPanel';
import { PlayerSeasonProgressionCard } from '../components/PlayerSeasonProgressionCard';
import { PlayerTraitsStrip } from '../components/PlayerTraitsStrip';
import { PlayerCardOverviewBox } from '../components/PlayerCardOverviewBox';
import { ShirtNumberLockerModal } from '../components/ShirtNumberLockerModal';
import { PlayerAppearanceModal } from '../modals/PlayerAppearanceModal';
import { AthleteCard } from '../components/AthleteCard';
import { StaminaBar } from '../components/StaminaBar';
import { CaptainBadge } from '../components/CaptainBadge';
import {
  getActiveFavBoost,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getWellbeingTierMeta
} from '../engine/wellbeing';
import { PlayerWellbeingCard } from '../components/PlayerWellbeingCard';

export const PlayerCareerView = React.memo<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
  onOpenSeasonStats?: (season?: number) => void;
}>(({ state, onUpdateState, onToast, onOpenSeasonStats }) => {
  const [careerTab, setCareerTab] = useState<'plan' | 'missions' | 'perks' | 'stats' | 'history'>('plan');
  const [skillSubTab, setSkillSubTab] = useState<'perks' | 'traits' | 'roles' | 'sig'>('perks');
  const [showLockerPicker, setShowLockerPicker] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const p = state.p;
  const meTeam = state.teams[state.me];
  const meSq = useMemo(() => (p && meTeam ? meTeam.sq.find((q) => q.me) : undefined), [meTeam, p]);
  const ov = p ? ovMe(p) : 0;
  const myShirtNo = p ? (p.no || meSq?.no || getShirtNo(meTeam, { n: p.name, pos: p.pos, ro: p.sp })) : 10;
  const susCount = meSq?.sus ?? p?.sus ?? 0;
  const injCount = meSq?.inj ?? p?.inj ?? 0;
  const ycCount = meSq?.yc ?? p?.yc ?? 0;
  const rcCount = meSq?.rc ?? p?.rc ?? 0;

  const fakePlayer = useMemo<Player | null>(() => {
    if (!p) return null;
    return (
      meSq || {
        n: p.name,
        pos: p.pos,
        ro: p.sp,
        ov,
        age: p.age,
        ht: p.ht,
        wt: p.wt,
        foot: p.foot,
        pot: 95,
        talent: p.talent,
        traits: p.traits,
        fit: p.en,
        inj: injCount,
        sus: susCount,
        yc: ycCount,
        rc: rcCount,
        no: myShirtNo,
        me: 1,
        sb: p.sb,
        missions: p.missions
      }
    );
  }, [meSq, p, ov, injCount, susCount, ycCount, rcCount, myShirtNo]);

  const details = useMemo(() => (fakePlayer && p ? dtInfo(fakePlayer, p) : null), [fakePlayer, p]);
  const myTalent = useMemo(() => (fakePlayer && p ? getPlayerTalent(fakePlayer, p) : 60), [fakePlayer, p]);
  const starters = useMemo(() => (meTeam ? xi(meTeam) : []), [meTeam]);
  const mySlot = useMemo(() => {
    if (!p || !meTeam) return null;
    const starterIdx = starters.findIndex((q) => q.me || q.n === p.name);
    return starterIdx >= 0 ? getFormationSlots(meTeam)[starterIdx]?.sp ?? null : null;
  }, [starters, p, meTeam]);

  if (!p || !fakePlayer || !details) return null;
  const perks = p.perks || [];
  const myPot = meSq?.pot ?? clamp(Math.max(88, myTalent + 6), ov + 4, 96);
  const kit1 = tc(meTeam, state, false);
  const kit2 = tc(meTeam, state, true);
  const isPitchOrNaturalGK = mySlot ? mySlot === 'GK' : (p.pos === 'GK' || p.sp === 'GK');
  const isCoachFav = meTeam.favPlayer === p.name || meTeam.favPlayer === fakePlayer.n;
  const favBoost = getActiveFavBoost(fakePlayer, meTeam, p);
  const myMental = getPlayerMentalScore(fakePlayer, p);
  const myPhys = getPlayerPhysScore(fakePlayer, p);
  const mentalMeta = getWellbeingTierMeta(myMental, 'mental', false);
  const physMeta = getWellbeingTierMeta(myPhys, 'phys', injCount > 0);

  return (
    <div className="grid grid-cols-[240px_1fr] mland:grid-cols-[214px_1fr] grid-rows-[minmax(0,1fr)] flex-1 min-h-0 gap-2.5 mland:gap-1.5 items-stretch overflow-hidden">
      <div className="flex flex-col gap-1.5 mland:gap-1 h-full min-h-0 overflow-y-auto pr-0.5 pb-2">
        {/* Collectible Career Athlete Card */}
        <AthleteCard
          ov={ov}
          pot={myPot}
          talent={myTalent}
          roleLabel={p.sp}
          altRolesCount={p.altRoles?.length || 0}
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
            isGK: isPitchOrNaturalGK,
            careerProfile: p
          }}
          name={p.name}
          clubCrest={<ClubCrest name={meTeam.name} size={14} team={meTeam} club={state.club} isMyClub={false} />}
          subtitle={`${meTeam.name} · อายุ ${p.age} ปี`}
          bio={details.bio}
          categories={summarizeStatGroups(details.G)}
          renderStageTopLeft={(palette) => (
            <div className="flex items-center gap-1 min-w-0">
              <span className={`text-[9.5px] mland:text-[7.5px] font-bold tabular whitespace-nowrap ${palette.repText}`}>
                ★ {p.rep ?? 10}
              </span>
              {isCoachFav && (
                <span
                  title={favBoost > 0 ? `ลูกรักโค้ช (+${favBoost} OVR ชั่วคราว)` : 'ลูกรักโค้ชประจำทีม'}
                  className={`px-1 py-[1px] rounded text-[8px] mland:text-[6.5px] font-black leading-none shrink-0 ${
                    favBoost > 0
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-500/25 border border-rose-400/60 text-rose-100'
                  }`}
                >
                  {favBoost > 0 ? `💖+${favBoost}` : '💖'}
                </span>
              )}
              {meTeam.cap === p.name && (
                <CaptainBadge team={meTeam} state={state} size="sm" />
              )}
            </div>
          )}
          renderStageTopRight={(_palette, tone) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                SFX.tap();
                setShowAppearanceModal(true);
              }}
              title="ปรับแต่งทรงผมและหน้าตา"
              aria-label="ปรับแต่งทรงผมและหน้าตา"
              className={`w-6 h-6 mland:w-5 mland:h-5 rounded-lg border flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                tone === 'light'
                  ? 'bg-white/85 hover:bg-white border-slate-300/85 text-slate-700 hover:text-[var(--g)] shadow-2xs'
                  : 'bg-black/35 hover:bg-black/55 border-white/18 text-emerald-200 hover:text-white'
              }`}
            >
              <Scissors className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
            </button>
          )}
        />

        {/* Unified Personal Info Box below Portrait Card */}
        <PlayerCardOverviewBox
          player={fakePlayer}
          state={state}
          team={meTeam}
          careerProfile={p}
          isMePlayer
          isMyTeam
          onUpdateState={onUpdateState}
          onToast={onToast}
          onOpenSeasonStats={onOpenSeasonStats}
        />

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
            ['perks', '🌟 สกิล & สไตล์'],
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
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 pb-1 border-b border-[var(--line)]/60">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h3 className="font-bold text-sm mland:text-xs">📅 แผนฝึกซ้อม &amp; ดูแลตัวเอง</h3>
                  <StaminaBar
                    value={p.en}
                    variant="inline"
                    label="ฟิต"
                    barWidthClass="w-10 mland:w-8"
                  />
                  <span className="text-[11px] mland:text-[9px] tabular inline-flex items-center gap-1.5 text-[var(--mut)]">
                    <span aria-hidden="true">·</span>
                    <span className={`font-bold ${mentalMeta.txtCls}`}>🧠 ใจ {myMental}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-bold ${physMeta.txtCls}`}>💪 กาย {myPhys}</span>
                    {favBoost > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-black text-rose-600 dark:text-rose-400">💖 ลูกรัก +{favBoost}</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[10.5px] mland:text-[8.5px]">
                  {p.vid ? (
                    <span className="font-bold text-[var(--g)]">📺 บัฟวิดีโอนัดหน้า (+0.3 เรตติ้ง)</span>
                  ) : null}
                  <span className="text-[var(--mut)]">มีผลหลังจบการแข่งแต่ละนัด</span>
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
                    ? '😴 ความฟิตเริ่มต่ำ แนะนำเลือก "พักผ่อน" หรือ "ซ้อมเบา" เพื่อเลี่ยงอาการบาดเจ็บ'
                    : '💪 ความฟิตพร้อมเต็มที่ เหมาะสำหรับเร่งซ้อมพัฒนาค่าพลังหรือดูวิดีโอก่อนแข่ง'}
                </span>
                {p.last && (
                  <span className="px-2 py-0.5 rounded-lg bg-[var(--g-soft)] text-[var(--g)] font-bold">
                    ผลซ้อมล่าสุด: {p.last}
                  </span>
                )}
              </div>
              <PlayerWellbeingCard
                player={fakePlayer}
                team={meTeam}
                state={state}
                isMyTeam
                isMePlayer
                onUpdateState={onUpdateState}
                onToast={onToast}
                compact
              />
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
                <div className="seg-bar flex items-stretch flex-1 min-w-0 overflow-x-auto no-scrollbar">
                  {([
                    ['perks', `🌟 สกิลติดตัว (${perks.length})`],
                    ['traits', `🧬 สไตล์การเล่น (${(p.traits || []).length}/6)`],
                    ['roles', `🎯 ตำแหน่งถนัด (${(p.altRoles || []).length})`],
                    ['sig', '⚡ อาวุธประจำตัว']
                  ] as const).map(([sk, slbl]) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => { SFX.tap(); setSkillSubTab(sk); }}
                      className={`seg-btn flex-1 min-w-fit whitespace-nowrap px-2 mland:px-1.5 text-[10px] sm:text-[11px] mland:text-[8.5px] ${skillSubTab === sk ? 'seg-btn-active' : ''}`}
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
                  <div className="space-y-2">
                    <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">
                      สกิลติดตัวระดับอาชีพ (ใช้ ★ ชื่อเสียงปลดล็อกถาวรเพื่อเสริมศักยภาพเฉพาะด้านของอาชีพ)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5 content-start">
                      {CAREER_PERKS.map((pk) => {
                        const owned = perks.includes(pk.id);
                        const canBuy = !owned && (p.rep ?? 10) >= pk.cost;
                        return (
                          <div key={pk.id} className={`p-2.5 mland:p-1.5 rounded-xl border flex items-start justify-between gap-2 ${owned ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)]'}`}>
                            <div className="min-w-0 space-y-0.5">
                              <div className="font-bold text-xs mland:text-[10px] leading-snug">{pk.name}</div>
                              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug whitespace-normal break-words">{pk.desc}</div>
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
                                onToast(`ปลดล็อกสกิลติดตัว "${pk.name}" แล้ว!`);
                              }}
                              className={`btn btn-sm shrink-0 whitespace-nowrap ${owned ? 'btn-primary opacity-80' : 'btn-gold'}`}
                            >
                              {owned ? '✓ มีแล้ว' : `ปลด ${pk.cost}★`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
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
                            className={`p-2.5 mland:p-1.5 rounded-xl border flex items-start justify-between gap-2 ${
                              owned
                                ? 'bg-[var(--g-soft)]/60 border-[var(--g)]/55'
                                : 'bg-[var(--surface-2)]/70 border-[var(--line)]'
                            }`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="font-bold text-xs mland:text-[10px] leading-snug">
                                {tr.icon} {tr.name}
                                {isFitRole && !owned && <span className="ml-1 text-[9.5px] text-[var(--g)]">· ถนัด</span>}
                              </div>
                              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] leading-snug whitespace-normal break-words">
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
                      <div className="text-[var(--mut)] leading-snug">
                        <b className="text-[var(--ink)]">ผลจริงในเกม:</b> เล่นตำแหน่งที่ปลดล็อกได้ <b className="text-[var(--g)]">เต็ม 100%</b> (ไม่โดนหักพลังหลุดตำแหน่ง -6% ถึง -15%) + เพิ่มความยืดหยุ่นแท็กติก และระหว่างฝึก/ปลดล็อกจะปรับ <b className="text-[var(--ink)]">+1 ค่าพลังหลัก &amp; +3 ค่าพลังย่อยประจำตำแหน่ง</b> (ต้องเก็บ {ROLE_ADAPT_THRESHOLD_ADJ} ขั้นสำหรับตำแหน่งใกล้เคียง หรือ {ROLE_ADAPT_THRESHOLD_CROSS} ขั้นสำหรับตำแหน่งข้ามสาย)
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mland:gap-1.5">
                      {ALL_SUB_ROLES.filter((r) => r !== p.sp).map((role) => {
                        const unlocked = (p.altRoles || []).includes(role);
                        const isTarget = p.roleTrain === role;
                        const need = pen(p.sp, role) === 1 ? ROLE_ADAPT_THRESHOLD_ADJ : ROLE_ADAPT_THRESHOLD_CROSS;
                        const exp = p.roleExp?.[role] || 0;
                        const pct = unlocked ? 100 : clamp(Math.round((exp / need) * 100), 0, 100);
                        const rTarget = ROLE_ADAPT_TARGETS[role] || ROLE_ADAPT_TARGETS.CM;
                        const coreName = ATT.find((x) => x[0] === rTarget.cores[0])?.[1] || rTarget.cores[0];
                        const sub1Name = SIGL[rTarget.subs[0]] || rTarget.subs[0];
                        const sub2Name = SIGL[rTarget.subs[1]] || rTarget.subs[1];
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
                                <div className="font-bold text-xs mland:text-[10px] truncate">
                                  {role} · {SPN[role] || role}
                                </div>
                                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                                  {unlocked ? '✓ ปลดล็อกเล่นเต็ม 100% แล้ว' : `ความคุ้นเคย: ${exp}/${need} นัด/ขั้น`}
                                </div>
                                <div className="text-[9.5px] mland:text-[8px] text-[var(--g)] font-semibold leading-snug whitespace-normal break-words">
                                  {unlocked ? 'รับโบนัสค่าพลังตำแหน่งนี้แล้ว' : `ปลดล็อกได้: ${coreName} +1 · ${sub1Name} +2 · ${sub2Name} +1`}
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
                                ⚡ อาวุธประจำตัวปัจจุบัน: <span className="text-[#8a5b00] dark:text-[var(--lamp)]">{SIGL[activeSig] || activeSig}</span> (+8 ค่าพลังพื้นฐาน)
                              </div>
                              <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular">
                                โบนัสซ้อมพิเศษสะสม: <b className="text-[var(--g)]">+{sigBonus}/12</b> · ติวเฉพาะทางเพิ่ม +1 ถาวร (ใช้ 4 ★ และความฟิต 6%)
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
              <PlayerWellbeingCard
                player={fakePlayer}
                team={meTeam}
                state={state}
                isMyTeam
                isMePlayer
                onUpdateState={onUpdateState}
                onToast={onToast}
                compact
              />
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
      {showAppearanceModal && (
        <PlayerAppearanceModal
          state={state}
          onClose={() => setShowAppearanceModal(false)}
          onUpdateState={onUpdateState}
          onToast={onToast}
        />
      )}
    </div>
  );
});


