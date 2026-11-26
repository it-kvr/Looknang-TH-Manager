import React, { useMemo, useState } from 'react';
import type { GameState, Player, SubRole, Team } from '../types/game';
import { clamp } from '../utils/math';
import { TN, AR_T, LINE } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import {
  ovMe,
  xi,
  getFormationSlots,
  assignTeamShirtNumbers,
  buildPlayerFromCareerProfile,
  listManagedClubsFromSaves,
  loadGameFromSlot,
  saveGameToSlot,
  syncMe,
  pushFeed,
  wagOf
} from '../engine/playerCore';
import { statTierMeta } from '../engine/missions';
import { evaluateNationalTeamCallup } from '../engine/simulation';
import { ClubCrest } from '../components/SvgVisuals';

export const PlayerClubTransferView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectTeam: (tid: number) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onToast: (msg: string) => void;
}> = ({ state, onUpdateState, onInspectTeam, onInspectPlayer, onToast }) => {
  const [subTab, setSubTab] = useState<'status' | 'transfer'>('status');
  const [boardTab, setBoardTab] = useState<'national' | 'division'>('national');
  const [tierFilter, setTierFilter] = useState<number>(state.teams[state.me]?.tier ?? 0);
  const [targetQuery, setTargetQuery] = useState('');
  const [targetFilter, setTargetFilter] = useState<'all' | 'high' | 'fit'>('all');
  const [rejectedClubs, setRejectedClubs] = useState<Record<number, number>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  const p = state.p;
  const meTeam = state.teams[state.me];
  const meSq = p && meTeam ? meTeam.sq.find((q) => q.me || q.n === p.name) || null : null;
  const ov = p ? ovMe(p) : 0;
  const starters = useMemo(() => (meTeam ? xi(meTeam) : []), [meTeam]);
  const myAltRoles = useMemo(() => ((p?.altRoles || meSq?.altRoles || []) as SubRole[]), [p?.altRoles, meSq?.altRoles]);

  const samePosTeam = useMemo(
    () =>
      p && meTeam
        ? meTeam.sq
            .filter((q) => q.pos === p.pos)
            .slice()
            .sort((a, b) => b.ov - a.ov)
        : [],
    [meTeam, p]
  );

  const myTeamSlots = useMemo(() => (meTeam ? getFormationSlots(meTeam).map((sl) => sl.sp) : []), [meTeam]);

  const divisionTable = useMemo(
    () =>
      meTeam
        ? state.teams
            .filter((t) => t.tier === meTeam.tier)
            .slice()
            .sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf)
        : [],
    [state.teams, meTeam]
  );

  const divisionPosLeaderboard = useMemo(() => {
    if (!p || !meTeam) return { top5: [], myRank: 0, total: 0 };
    const rows: { player: Player; team: Team }[] = [];
    state.teams
      .filter((t) => t.tier === meTeam.tier)
      .forEach((t) => {
        t.sq.forEach((q) => {
          if (q.pos === p.pos) rows.push({ player: q, team: t });
        });
      });
    rows.sort((a, b) => b.player.ov - a.player.ov);
    const myRank = rows.findIndex((r) => r.player.me || (r.team.id === meTeam.id && r.player.n === p.name)) + 1;
    return { top5: rows.slice(0, 5), myRank, total: rows.length };
  }, [state.teams, meTeam, p]);

  const ntEval = useMemo(() => evaluateNationalTeamCallup(state), [state]);

  const managedClubs = useMemo(() => listManagedClubsFromSaves(), [refreshTick, state.md, state.season]);

  const leagueTargets = useMemo(() => {
    if (!p || !meTeam) return [];
    const qNorm = targetQuery.trim().toLowerCase();
    const myRolesSet = new Set<SubRole>([p.sp, ...myAltRoles]);
    return state.teams
      .filter((t) => t.id !== meTeam.id && t.tier === tierFilter)
      .map((t) => {
        const avgOv = Math.round(t.sq.reduce((s, q) => s + q.ov, 0) / Math.max(1, t.sq.length));
        const samePos = t.sq.filter((q) => q.pos === p.pos).sort((a, b) => b.ov - a.ov);
        const topSame = samePos[0]?.ov || 55;
        const slots = getFormationSlots(t).map((sl) => sl.sp);
        const primaryFit = slots.includes(p.sp);
        const altFitRole = !primaryFit ? myAltRoles.find((r) => slots.includes(r)) || null : null;
        const fitsFormation = primaryFit || Boolean(altFitRole);
        const needsPosition = samePos.length <= 3 || ov >= topSame;
        const reqOv = t.tier === 0 ? 68 : t.tier === 1 ? 58 : 48;
        const fitBonus = primaryFit ? 2.5 : altFitRole ? 2.0 : 0;
        const needBonus = samePos.length <= 3 ? 2 : 0;
        const versBonus = Math.min(3, myAltRoles.length * 1.1);
        const score = ov - reqOv + ((p.rep ?? 10) - 12) * 0.35 + (ov >= topSame ? 4 : -4) + fitBonus + needBonus + versBonus;
        const chance: 'สูง' | 'ปานกลาง' | 'ยาก' = score >= 4 ? 'สูง' : score >= -4 ? 'ปานกลาง' : 'ยาก';
        return {
          team: t,
          avgOv,
          samePosCount: samePos.length,
          topSame,
          chance,
          score,
          primaryFit,
          altFitRole,
          fitsFormation,
          needsPosition,
          matchedCount: myRolesSet.size
        };
      })
      .filter((row) => {
        if (qNorm && !row.team.name.toLowerCase().includes(qNorm)) return false;
        if (targetFilter === 'high') return row.chance === 'สูง';
        if (targetFilter === 'fit') return row.fitsFormation && row.needsPosition;
        return true;
      })
      .sort((a, b) => b.score - a.score || b.avgOv - a.avgOv);
  }, [state.teams, meTeam, tierFilter, p, ov, myAltRoles, targetQuery, targetFilter]);

  if (!p || !meTeam) return null;

  const clubLeaguePos = divisionTable.findIndex((t) => t.id === meTeam.id) + 1;
  const isMyStarter = starters.some((s) => s.me || s.n === p.name);
  const myClubPosRank = Math.max(1, samePosTeam.findIndex((q) => q.me || q.n === p.name) + 1);
  const primaryInFormation = myTeamSlots.includes(p.sp);
  const altInFormation = myAltRoles.find((r) => myTeamSlots.includes(r)) || null;
  const curTurnKey = state.season * 100 + state.md;

  const handleJoinManagedClub = (slotNum: number) => {
    const mc = managedClubs.find((c) => c.slot === slotNum);
    if (!mc) return;
    const mgrSave = loadGameFromSlot('m', mc.slot);
    if (!mgrSave || !mgrSave.teams[mgrSave.me]) {
      onToast('ไม่พบข้อมูลเซฟทีมผู้จัดการที่เลือก');
      return;
    }

    const mgrTeam = mgrSave.teams[mgrSave.me];
    const hgPlayer = buildPlayerFromCareerProfile(p, {
      livePlayer: meSq,
      ovOverride: ov,
      asHomegrown: true
    });
    hgPlayer.con = {
      yr: 3,
      wg: wagOf(hgPlayer),
      role: ov >= 72 ? 'key' : 'pro'
    };
    hgPlayer.signedSeason = mgrSave.season;
    hgPlayer.signedMd = mgrSave.md;

    mgrTeam.sq = mgrTeam.sq.filter((q) => q.n !== hgPlayer.n);
    mgrTeam.sq.push(hgPlayer);
    assignTeamShirtNumbers(mgrTeam);
    pushFeed(mgrSave, 'เด็กปั้นสโมสร', `🌱 ${hgPlayer.n} (${hgPlayer.pos} OVR ${hgPlayer.ov}) ย้ายเข้าสู่ทีมชุดใหญ่ในฐานะเด็กปั้นสโมสร!`, 'ok');
    saveGameToSlot(mgrSave, mc.slot);

    onUpdateState((d) => {
      if (!d.p) return;
      const oldTeam = d.teams[d.me];
      const existingMe = oldTeam.sq.find((q) => q.me || q.n === d.p!.name);
      oldTeam.sq = oldTeam.sq.filter((q) => !q.me && q.n !== d.p!.name);
      oldTeam.lu = null;

      let targetIdx = d.teams.findIndex((t) => t.name === mc.name);
      if (targetIdx < 0) {
        const alt = d.teams.findIndex((t) => t.tier === mc.tier && t.id !== d.me);
        targetIdx = alt >= 0 ? alt : d.me;
        if (targetIdx !== d.me || d.teams[targetIdx].name !== mc.name) {
          d.teams[targetIdx].name = mc.name;
          d.teams[targetIdx].kc = [...mc.kc];
        }
      }

      const targetTeam = d.teams[targetIdx];
      const movedPlayer: Player = existingMe
        ? { ...existingMe, ov: ovMe(d.p), me: 1, hg: 1, customCreated: 1 }
        : { ...hgPlayer, me: 1, hg: 1, customCreated: 1 };
      targetTeam.sq = targetTeam.sq.filter((q) => !q.me && q.n !== movedPlayer.n);
      targetTeam.sq.push(movedPlayer);
      targetTeam.lu = null;
      d.me = targetIdx;
      d.lg = targetTeam.tier;
      assignTeamShirtNumbers(targetTeam);
      syncMe(d);
      pushFeed(d, 'ย้ายทีม', `🌱 ${d.p.name} ย้ายเข้าสู่ทีมที่คุมอยู่ "${mc.name}" (เด็กปั้นสโมสร)!`, 'ok');
    });

    SFX.win();
    setRefreshTick((x) => x + 1);
    onToast(`🌱 ย้ายเข้าสู่ "${mc.name}" (เซฟผู้จัดการ #${mc.slot}) ในฐานะเด็กปั้นสโมสรเรียบร้อย!`);
  };

  const handleRequestLeagueTransfer = (targetTeam: Team, score: number) => {
    if ((rejectedClubs[targetTeam.id] ?? -1) === curTurnKey) {
      SFX.tap();
      onToast(`${targetTeam.name} เพิ่งปฏิเสธคำขอในสัปดาห์นี้ รอหลังแข่งนัดถัดไปหรืออัปเกรดฟอร์มก่อนยื่นใหม่`);
      return;
    }
    const reqRep = targetTeam.tier === 0 ? 14 : targetTeam.tier === 1 ? 8 : 4;
    if ((p.rep ?? 10) < reqRep && score < -4) {
      SFX.tap();
      setRejectedClubs((prev) => ({ ...prev, [targetTeam.id]: curTurnKey }));
      onToast(`สโมสร ${targetTeam.name} ปฏิเสธคำขอ: ต้องการชื่อเสียงอย่างน้อย ★ ${reqRep} หรือค่าพลังสูงกว่านี้`);
      return;
    }
    const acceptProb = clamp(0.62 + score * 0.045, 0.22, 0.96);
    if (Math.random() > acceptProb) {
      SFX.tap();
      setRejectedClubs((prev) => ({ ...prev, [targetTeam.id]: curTurnKey }));
      onToast(`❌ ${targetTeam.name} ยังไม่พร้อมเปิดดีลตำแหน่ง ${p.pos} ในสัปดาห์นี้ (ลองเพิ่ม OVR/ชื่อเสียง หรือฝึกตำแหน่งเสริม)`);
      return;
    }

    onUpdateState((d) => {
      if (!d.p) return;
      const oldTeam = d.teams[d.me];
      const existingMe = oldTeam.sq.find((q) => q.me || q.n === d.p!.name);
      oldTeam.sq = oldTeam.sq.filter((q) => !q.me && q.n !== d.p!.name);
      oldTeam.lu = null;

      const newIdx = d.teams.findIndex((t) => t.id === targetTeam.id);
      if (newIdx < 0) return;
      const dest = d.teams[newIdx];
      const movedPlayer: Player = existingMe
        ? { ...existingMe, ov: ovMe(d.p), me: 1 }
        : buildPlayerFromCareerProfile(d.p, { livePlayer: meSq, ovOverride: ovMe(d.p), asHomegrown: false });
      movedPlayer.me = 1;
      dest.sq = dest.sq.filter((q) => !q.me && q.n !== movedPlayer.n);
      dest.sq.push(movedPlayer);
      dest.lu = null;
      d.me = newIdx;
      d.lg = dest.tier;
      assignTeamShirtNumbers(dest);
      syncMe(d);
      pushFeed(d, 'ย้ายทีม', `🤝 ${d.p.name} ย้ายร่วมทัพ ${dest.name} (${TN[dest.tier]}) สำเร็จ!`, 'ok');
    });
    SFX.win();
    setRejectedClubs({});
    onToast(`🎉 ยินดีด้วย! คุณย้ายร่วมทีม ${targetTeam.name} (${TN[targetTeam.tier]}) แล้ว`);
  };

  const passLabel = meTeam.pass === 0 ? 'ต่อบอลสั้น' : meTeam.pass === 2 ? 'บอลยาว' : meTeam.pass === 3 ? 'สวนกลับตรง' : 'ผสมสมดุล';
  const tempoLabel = meTeam.tempo === 0 ? 'ครองบอลช้า' : meTeam.tempo === 2 ? 'จังหวะเร็ว' : 'สมดุล';
  const pressLabel = meTeam.press === 2 ? 'กดดันสูง' : meTeam.press === 0 ? 'รับต่ำคุมโซน' : 'กดดันสมดุล';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Header Bar + Sub-Tab Switch */}
      <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => { SFX.tap(); onInspectTeam(meTeam.id); }}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
          title="ดูข้อมูลสโมสรต้นสังกัด"
        >
          <div className="shrink-0 [&>svg]:w-8 [&>svg]:h-8 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
            <ClubCrest name={meTeam.name} size={32} team={meTeam} club={state.club} isMyClub={false} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm mland:text-[11px] truncate flex items-center gap-1.5 group-hover:text-[var(--g)] transition-colors">
              <span className="truncate">{meTeam.name}</span>
              <span className="text-[11px] mland:text-[9px] font-semibold text-[var(--g)] shrink-0">
                อันดับ {clubLeaguePos}/{divisionTable.length} · {TN[meTeam.tier]}
              </span>
            </div>
            <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1.5">
              <span>แผน {meTeam.form} ({AR_T[meTeam.tac]}) · {passLabel} · {tempoLabel} · {pressLabel}</span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-bold">
            <span className={`px-2 py-1 rounded-lg border ${isMyStarter ? 'bg-[var(--g-soft)] border-[var(--g)]/40 text-[var(--g)]' : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]'}`}>
              {isMyStarter ? '⭐ ตัวจริง XI' : '🪑 สำรอง/หมุนเวียน'}
            </span>
            <span className="px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] tabular">
              OVR {ov}
            </span>
          </div>
          <div className="seg-bar grid grid-cols-2 shrink-0">
            <button
              type="button"
              onClick={() => { SFX.tap(); setSubTab('status'); }}
              className={`seg-btn whitespace-nowrap px-2.5 ${subTab === 'status' ? 'seg-btn-active' : ''}`}
            >
              🏟️ สถานะ &amp; ทีมชาติ
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setSubTab('transfer'); }}
              className={`seg-btn whitespace-nowrap px-2.5 ${subTab === 'transfer' ? 'seg-btn-active' : ''}`}
            >
              🤝 ย้ายสโมสร
            </button>
          </div>
        </div>
      </div>

      {subTab === 'status' ? (
        <div className="grid grid-cols-1 md:grid-cols-12 mland:grid-cols-12 gap-2.5 mland:gap-1.5 flex-1 min-h-0 overflow-hidden">
          {/* Left: Club Standing + Tactical Fit + Positional Competitors */}
          <div className="md:col-span-5 mland:col-span-5 flex flex-col gap-2 mland:gap-1.5 min-h-0 overflow-hidden">
            {/* Club Role & Tactical Fit Card */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">📋 บทบาทในสโมสร &amp; แท็กติก</h3>
                <span className={`text-[10.5px] mland:text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border ${isMyStarter ? 'bg-[var(--g-soft)] border-[var(--g)]/40 text-[var(--g)]' : 'bg-[var(--lamp-soft)] border-[var(--lamp)]/40 text-[#8a5b00] dark:text-[var(--lamp)]'}`}>
                  {isMyStarter ? '⭐ 11 ตัวจริง' : '🪑 สำรองลุ้นสอดแทรก'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-1.5 rounded-xl bg-[var(--surface-2)]/80 border border-[var(--line)]/60">
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">อันดับในตำแหน่ง</div>
                  <div className="font-extrabold text-xs mland:text-[10px] tabular text-[var(--ink)]">
                    #{myClubPosRank}/{samePosTeam.length} ({p.pos})
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-[var(--surface-2)]/80 border border-[var(--line)]/60">
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">ความเข้าแผนทีม</div>
                  <div className={`font-extrabold text-xs mland:text-[10px] ${primaryInFormation ? 'text-[var(--g)]' : altInFormation ? 'text-[#8a5b00] dark:text-[var(--lamp)]' : 'text-[var(--red)]'}`}>
                    {primaryInFormation ? `ตรง (${p.sp})` : altInFormation ? `เสริม (${altInFormation})` : 'นอกแผน'}
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-[var(--surface-2)]/80 border border-[var(--line)]/60">
                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">ชื่อเสียงนักเตะ</div>
                  <div className="font-extrabold text-xs mland:text-[10px] tabular text-[var(--lamp)]">
                    ★ {p.rep ?? 10}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[10px] mland:text-[8.5px]">
                <span className="text-[var(--mut)] font-semibold">บทบาทหลัก:</span>
                <span className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] font-bold">{p.sp}</span>
                <span className="text-[var(--mut)] font-semibold ml-1">ตำแหน่งเสริม:</span>
                {myAltRoles.length > 0 ? (
                  myAltRoles.map((r) => (
                    <span
                      key={r}
                      className={`px-1.5 py-0.5 rounded border font-bold ${
                        (LINE[r] || p.pos) !== p.pos
                          ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45 text-[#8a5b00] dark:text-[var(--lamp)]'
                          : 'bg-[var(--g-soft)] border-[var(--g)]/35 text-[var(--g)]'
                      }`}
                      title={(LINE[r] || p.pos) !== p.pos ? 'ตำแหน่งข้ามสาย (เพิ่มโอกาสติดทีมชาติสูงขึ้น)' : 'ตำแหน่งเสริมสายเดียวกัน'}
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-[var(--mut)] italic">ยังไม่ปลดล็อก (ฝึกในหน้าอาชีพ)</span>
                )}
              </div>
            </div>

            {/* Club Competitors */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col flex-1 min-h-0 gap-2 mland:gap-1">
              <div className="flex items-center justify-between shrink-0">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">⚔️ คู่แข่งตำแหน่ง {p.pos} ในสโมสร</h3>
                <span className="text-[11px] mland:text-[9px] text-[var(--mut)] font-semibold">{samePosTeam.length} คน</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
                {samePosTeam.map((q, idx) => {
                  const isMe = Boolean(q.me || q.n === p.name);
                  const isStarter = starters.some((s) => s.n === q.n);
                  return (
                    <div
                      key={q.n}
                      onClick={() => { SFX.tap(); onInspectPlayer(q, meTeam); }}
                      className={`p-2 mland:p-1.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors ${isMe ? 'bg-[var(--g-soft)] border-[var(--g)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 text-center font-bold text-xs mland:text-[10px] tabular text-[var(--mut)]">#{idx + 1}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs mland:text-[10px] truncate flex items-center gap-1">
                            <span className="truncate">{q.n}</span>
                            {isMe && <span className="text-[var(--g)] font-extrabold shrink-0">(คุณ)</span>}
                            {(q.hg || q.customCreated) ? <span className="text-[10px] shrink-0" title="เด็กปั้นสโมสร">🌱</span> : null}
                          </div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                            {q.ro} · อายุ {q.age} ปี · {isStarter ? '⭐ ตัวจริง' : '🪑 สำรอง'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm mland:text-xs font-extrabold tabular ${statTierMeta(q.ov).textClass}`}>{q.ov}</div>
                        <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular">⚽ {q.sg || 0} · 👟 {q.sa || 0}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: National Team Competitive Evaluation + Switchable Rankings */}
          <div className="md:col-span-7 mland:col-span-7 flex flex-col gap-2 mland:gap-1.5 min-h-0 overflow-hidden">
            {/* Thailand National Team Competitive Card */}
            {ntEval && (
              <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">🇹🇭 คัดเลือกทีมชาติไทย (ช้างศึก · ชุด 26 คน)</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] mland:text-[8px] font-extrabold border ${
                        ntEval.qualified
                          ? 'bg-[var(--g-soft)] border-[var(--g)]/50 text-[var(--g)]'
                          : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]'
                      }`}
                    >
                      {ntEval.qualified ? '✅ อยู่ในข่ายติดธง' : '⏳ กำลังลุ้นโควต้า'}
                    </span>
                  </div>
                  <span className="text-xs mland:text-[10px] font-extrabold text-[var(--g)] tabular">
                    ความพร้อม {ntEval.readinessPct}% · อันดับ #{ntEval.myNationalRank}/{ntEval.nationalPoolCount} ({ntEval.pos})
                  </span>
                </div>

                <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ntEval.qualified
                        ? 'bg-gradient-to-r from-[#22c55e] via-[#16a34a] to-[#facc15]'
                        : 'bg-gradient-to-r from-[#2563eb] via-[#38bdf8] to-[#22c55e]'
                    }`}
                    style={{ width: `${ntEval.readinessPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {ntEval.checklist.map((item) => (
                    <div
                      key={item.id}
                      className={`px-2 py-1 mland:py-0.5 rounded-xl border text-[10.5px] mland:text-[8.5px] flex items-start gap-1.5 ${
                        item.ok
                          ? 'bg-[var(--g-soft)]/55 border-[var(--g)]/35'
                          : 'bg-[var(--surface-2)]/65 border-[var(--line)]'
                      }`}
                    >
                      <span className="shrink-0 mt-0.5">{item.ok ? '✅' : '▫️'}</span>
                      <div className="min-w-0 leading-tight">
                        <div className="font-bold text-[var(--ink)] truncate">{item.label}</div>
                        <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate">{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] mland:text-[8.5px] text-[var(--mut)] pt-0.5">
                  <span>
                    ติดทีมชาติแล้ว: <b className="text-[var(--ink)]">{p.ntCaps || 0} นัด · {p.ntGoals || 0} ประตู</b>
                  </span>
                  <span>
                    เกณฑ์ประเมิน 48 สโมสรไทย (โควต้า {ntEval.pos} {ntEval.posQuota} คน
                    {ntEval.utilityPath ? ` · สายเสริม ${ntEval.utilityPath.pos} #${ntEval.utilityPath.rank}/${ntEval.utilityPath.quota}` : ''})
                  </span>
                </div>
              </div>
            )}

            {/* Switchable Rankings: National Pool vs Division Top 5 */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex-1 min-h-0 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="seg-bar">
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); setBoardTab('national'); }}
                    className={`seg-btn text-[11px] mland:text-[9px] ${boardTab === 'national' ? 'seg-btn-active' : ''}`}
                  >
                    🇹🇭 แข่งขันติดทีมชาติ (48 ทีม)
                  </button>
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); setBoardTab('division'); }}
                    className={`seg-btn text-[11px] mland:text-[9px] ${boardTab === 'division' ? 'seg-btn-active' : ''}`}
                  >
                    🏆 ท็อป 5 {TN[meTeam.tier]}
                  </button>
                </div>
                <span className="text-[11px] mland:text-[9px] font-bold text-[var(--g)] tabular">
                  {boardTab === 'national' && ntEval
                    ? `อันดับประเทศ #${ntEval.myNationalRank}/${ntEval.nationalPoolCount}`
                    : `อันดับลีก #${divisionPosLeaderboard.myRank}/${divisionPosLeaderboard.total}`}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
                {boardTab === 'national' && ntEval ? (
                  ntEval.topRivals.map((row) => {
                    const inQuota = row.rank <= ntEval.posQuota;
                    return (
                      <div
                        key={`${row.team.id}-${row.player.n}-${row.rank}`}
                        onClick={() => { SFX.tap(); onInspectPlayer(row.player, row.team); }}
                        className={`px-2.5 py-1.5 mland:py-1 rounded-xl border flex items-center justify-between gap-2 cursor-pointer text-xs mland:text-[10px] ${
                          row.isMe
                            ? 'bg-[var(--g-soft)] border-[var(--g)]'
                            : inQuota
                              ? 'bg-[var(--surface-2)]/80 border-[var(--line)] hover:border-[var(--g)]'
                              : 'bg-[var(--surface-2)]/40 border-dashed border-[var(--line)] hover:border-[var(--g)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`font-extrabold w-6 text-center tabular shrink-0 ${
                              inQuota ? 'text-[var(--g)]' : 'text-[var(--mut)]'
                            }`}
                          >
                            #{row.rank}
                          </span>
                          <div className="shrink-0 [&>svg]:w-5 [&>svg]:h-5">
                            <ClubCrest name={row.team.name} size={20} team={row.team} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold truncate flex items-center gap-1">
                              <span className="truncate">{row.player.n}</span>
                              {row.isMe && <span className="text-[var(--g)] font-extrabold shrink-0">(คุณ)</span>}
                              {row.altRolesCount > 0 && (
                                <span
                                  className="px-1 rounded bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] text-[9px] font-bold shrink-0"
                                  title={`เล่นได้หลายตำแหน่ง (+${row.altRolesCount} บทบาทเสริม)`}
                                >
                                  +{row.altRolesCount} ตำแหน่ง
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] mland:text-[8px] text-[var(--mut)] truncate tabular">
                              {row.team.name} · {TN[row.team.tier]} · {row.apps} นัด · เรตติ้ง {row.avgRating ? row.avgRating.toFixed(2) : '-'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 tabular">
                          <div className={`font-extrabold ${statTierMeta(row.ov).textClass}`}>OVR {row.ov}</div>
                          <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">คะแนน {row.score.toFixed(1)}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  divisionPosLeaderboard.top5.map(({ player: q, team: t }, idx) => (
                    <div
                      key={`${t.id}-${q.n}`}
                      onClick={() => { SFX.tap(); onInspectPlayer(q, t); }}
                      className={`px-2.5 py-1.5 mland:py-1 rounded-xl border flex items-center justify-between gap-2 cursor-pointer text-xs mland:text-[10px] ${
                        q.me || q.n === p.name ? 'bg-[var(--g-soft)] border-[var(--g)]' : 'bg-[var(--surface-2)]/65 border-[var(--line)] hover:border-[var(--g)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-extrabold text-[var(--mut)] w-4 text-center tabular">{idx + 1}</span>
                        <span className="font-bold truncate">{q.n}</span>
                        <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">({t.name})</span>
                      </div>
                      <span className={`font-extrabold tabular shrink-0 ${statTierMeta(q.ov).textClass}`}>OVR {q.ov}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 mland:grid-cols-12 gap-2.5 mland:gap-1.5 flex-1 min-h-0 overflow-hidden">
          {/* Left: Transfer to Managed Club Save as Homegrown 🌱 */}
          <div className="md:col-span-5 mland:col-span-5 p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 gap-2 mland:gap-1.5">
            <div className="shrink-0">
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px] flex items-center gap-1">
                <span>🌱 ย้ายไปเล่นทีมที่ตัวเองคุมอยู่</span>
              </h3>
              <p className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] mt-0.5 leading-snug">
                ส่งตัวคุณเข้าสู่เซฟผู้จัดการที่คุมอยู่พร้อมตราสัญลักษณ์พิเศษ <b className="text-[var(--g)]">🌱 เด็กปั้น</b> และย้ายสโมสรในอาชีพนี้ทันที
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mland:space-y-1 pr-0.5">
              {managedClubs.length ? (
                managedClubs.map((mc) => (
                  <div key={mc.slot} className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/80 border border-[var(--line)] space-y-2 mland:space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="shrink-0 [&>svg]:w-7 [&>svg]:h-7 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                          <ClubCrest name={mc.name} size={28} team={mc.team} club={mc.club || undefined} isMyClub />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs mland:text-[10.5px] truncate">{mc.name}</div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">
                            ช่องเซฟผู้จัดการ #{mc.slot} · {mc.tierLabel} · ซ.{mc.season} ({mc.squadCount} คน)
                          </div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--g-soft)] border border-[var(--g)]/35 text-[var(--g)] text-[10px] mland:text-[8px] font-bold shrink-0">
                        🌱 เด็กปั้น
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleJoinManagedClub(mc.slot)}
                      className="btn btn-sm btn-primary w-full"
                    >
                      🌱 ย้ายเข้าทีมนี้เลย (รับบทเด็กปั้น)
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-[var(--surface-2)]/60 border border-dashed border-[var(--line)] text-center text-xs mland:text-[10px] text-[var(--mut)] space-y-1">
                  <div className="text-lg">🏟️</div>
                  <div className="font-bold text-[var(--ink)]">ยังไม่มีเซฟโหมดผู้จัดการทีม</div>
                  <div>สร้างเซฟ "ผู้จัดการทีม" อย่างน้อย 1 ช่อง แล้วจะสามารถย้ายตัวนักเตะของคุณไปเล่นในทีมที่คุมอยู่ได้ทันที</div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Transfer Request across League Tiers */}
          <div className="md:col-span-7 mland:col-span-7 p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 gap-2 mland:gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">🔄 ยื่นขอย้ายทีมในลีก</h3>
              <div className="seg-bar">
                {[0, 1, 2].map((tIdx) => (
                  <button
                    key={tIdx}
                    type="button"
                    onClick={() => { SFX.tap(); setTierFilter(tIdx); }}
                    className={`seg-btn ${tierFilter === tIdx ? 'seg-btn-active' : ''}`}
                  >
                    {TN[tIdx]}
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Fit Filters */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <input
                type="text"
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                placeholder="🔍 ค้นหาชื่อสโมสร..."
                className="flex-1 min-w-[140px] px-2.5 py-1.5 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] focus:outline-none focus:border-[var(--g)]"
              />
              <div className="flex items-center gap-1 shrink-0">
                {[
                  { id: 'all' as const, label: 'ทั้งหมด' },
                  { id: 'high' as const, label: 'โอกาสสูง' },
                  { id: 'fit' as const, label: 'ตรงแผน & ต้องการตัว' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { SFX.tap(); setTargetFilter(f.id); }}
                    className={`px-2 py-1 mland:py-0.5 rounded-lg border text-[10.5px] mland:text-[8.5px] font-bold cursor-pointer transition-colors ${
                      targetFilter === f.id
                        ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--g)]'
                        : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)] hover:border-[var(--g)]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {leagueTargets.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--mut)] rounded-xl bg-[var(--surface-2)]/50 border border-dashed border-[var(--line)]">
                  ไม่พบสโมสรที่ตรงกับเงื่อนไขการค้นหา
                </div>
              ) : (
                leagueTargets.map(({ team, avgOv, samePosCount, topSame, chance, score, primaryFit, altFitRole, needsPosition }) => {
                  const isCooling = (rejectedClubs[team.id] ?? -1) === curTurnKey;
                  return (
                    <div key={team.id} className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 cursor-pointer flex-1" onClick={() => onInspectTeam(team.id)}>
                        <div className="shrink-0 [&>svg]:w-6 [&>svg]:h-6 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                          <ClubCrest name={team.name} size={24} team={team} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs mland:text-[10px] truncate flex items-center gap-1.5">
                            <span className="truncate">{team.name}</span>
                            {primaryFit ? (
                              <span className="text-[9.5px] mland:text-[8px] font-bold text-[var(--g)] shrink-0" title={`ระบบ ${team.form} มีตำแหน่ง ${p.sp}`}>
                                🎯 ตรงแผน
                              </span>
                            ) : altFitRole ? (
                              <span className="text-[9.5px] mland:text-[8px] font-bold text-[#8a5b00] dark:text-[var(--lamp)] shrink-0" title={`ระบบ ${team.form} ใช้ตำแหน่งเสริม ${altFitRole} ของคุณได้`}>
                                ✨ เสริม {altFitRole}
                              </span>
                            ) : null}
                            {needsPosition && (
                              <span className="hidden sm:inline text-[9.5px] mland:text-[8px] font-bold text-sky-600 dark:text-sky-300 shrink-0">
                                · ขาดตัวหลัก
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                            แผน {team.form} · ทีมเฉลี่ย {avgOv} · ตำแหน่ง {p.pos}: {samePosCount} คน (สูงสุด {topSame})
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] mland:text-[8.5px] font-bold ${chance === 'สูง' ? 'text-[var(--g)]' : chance === 'ปานกลาง' ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--red)]'}`}>
                          โอกาส{chance}
                        </span>
                        <button
                          type="button"
                          disabled={isCooling}
                          onClick={() => handleRequestLeagueTransfer(team, score)}
                          className={`btn btn-xs ${
                            isCooling
                              ? 'btn-secondary opacity-60 cursor-not-allowed'
                              : 'btn-surface hover:bg-[var(--g)] hover:text-white hover:border-[var(--g)]'
                          }`}
                        >
                          {isCooling ? 'รอสัปดาห์หน้า' : '📩 ขอย้าย'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
