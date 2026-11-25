import React, { useMemo, useState } from 'react';
import type { GameState, Player, Team } from '../types/game';
import { clamp } from '../utils/math';
import { TN, AR_T } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import {
  ovMe,
  xi,
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
import { ClubCrest } from '../components/SvgVisuals';

export const PlayerClubTransferView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectTeam: (tid: number) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onToast: (msg: string) => void;
}> = ({ state, onUpdateState, onInspectTeam, onInspectPlayer, onToast }) => {
  const [subTab, setSubTab] = useState<'status' | 'transfer'>('status');
  const [tierFilter, setTierFilter] = useState<number>(state.teams[state.me]?.tier ?? 0);
  const [refreshTick, setRefreshTick] = useState(0);

  const p = state.p;
  if (!p) return null;

  const meTeam = state.teams[state.me];
  const meSq = meTeam.sq.find((q) => q.me || q.n === p.name) || null;
  const ov = ovMe(p);
  const starters = xi(meTeam);

  const samePosTeam = useMemo(
    () =>
      meTeam.sq
        .filter((q) => q.pos === p.pos)
        .slice()
        .sort((a, b) => b.ov - a.ov),
    [meTeam, p.pos]
  );

  const divisionTable = useMemo(
    () =>
      state.teams
        .filter((t) => t.tier === meTeam.tier)
        .slice()
        .sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf),
    [state.teams, meTeam.tier]
  );
  const clubLeaguePos = divisionTable.findIndex((t) => t.id === meTeam.id) + 1;

  const divisionPosLeaderboard = useMemo(() => {
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
  }, [state.teams, meTeam.tier, meTeam.id, p.pos, p.name]);

  const ntReadyScore = clamp(Math.round((ov - 62) * 3.1 + ((p.rep ?? 10) - 10) * 1.15), 8, 99);
  const managedClubs = useMemo(() => listManagedClubsFromSaves(), [refreshTick, state.md, state.season]);

  const leagueTargets = useMemo(() => {
    return state.teams
      .filter((t) => t.id !== meTeam.id && t.tier === tierFilter)
      .map((t) => {
        const avgOv = Math.round(t.sq.reduce((s, q) => s + q.ov, 0) / Math.max(1, t.sq.length));
        const samePos = t.sq.filter((q) => q.pos === p.pos).sort((a, b) => b.ov - a.ov);
        const topSame = samePos[0]?.ov || 55;
        const reqOv = t.tier === 0 ? 68 : t.tier === 1 ? 58 : 48;
        const score = ov - reqOv + ((p.rep ?? 10) - 12) * 0.35 + (ov >= topSame ? 4 : -4);
        const chance: 'สูง' | 'ปานกลาง' | 'ยาก' = score >= 4 ? 'สูง' : score >= -4 ? 'ปานกลาง' : 'ยาก';
        return { team: t, avgOv, samePosCount: samePos.length, topSame, chance, score };
      })
      .sort((a, b) => b.avgOv - a.avgOv);
  }, [state.teams, meTeam.id, tierFilter, p.pos, ov, p.rep]);

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
    const reqRep = targetTeam.tier === 0 ? 14 : targetTeam.tier === 1 ? 8 : 4;
    if ((p.rep ?? 10) < reqRep && score < -4) {
      SFX.tap();
      onToast(`สโมสร ${targetTeam.name} ปฏิเสธคำขอ: ต้องการชื่อเสียงอย่างน้อย ★ ${reqRep} หรือค่าพลังสูงกว่านี้`);
      return;
    }
    const acceptProb = clamp(0.62 + score * 0.045, 0.22, 0.96);
    if (Math.random() > acceptProb) {
      SFX.tap();
      onToast(`❌ ${targetTeam.name} ยังไม่พร้อมรับตำแหน่ง ${p.pos} ในตอนนี้ (ลองเพิ่ม OVR/ชื่อเสียง หรือลองใหม่อีกครั้ง)`);
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
    onToast(`🎉 ยินดีด้วย! คุณย้ายร่วมทีม ${targetTeam.name} (${TN[targetTeam.tier]}) แล้ว`);
  };

  const passLabel = meTeam.pass === 0 ? 'ต่อบอลสั้น' : meTeam.pass === 2 ? 'บอลยาว' : meTeam.pass === 3 ? 'สวนกลับตรง' : 'ผสมสมดุล';
  const tempoLabel = meTeam.tempo === 0 ? 'ครองบอลช้า' : meTeam.tempo === 2 ? 'จังหวะเร็ว' : 'สมดุล';
  const pressLabel = meTeam.press === 2 ? 'กดดันสูง' : meTeam.press === 0 ? 'รับต่ำคุมโซน' : 'กดดันสมดุล';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Header Bar + Sub-Tab Switch */}
      <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 [&>svg]:w-7 [&>svg]:h-7 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
            <ClubCrest name={meTeam.name} size={28} team={meTeam} club={state.club} isMyClub={false} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm mland:text-[11px] truncate flex items-center gap-1.5">
              <span>{meTeam.name}</span>
              <span className="text-[11px] mland:text-[9px] font-semibold text-[var(--g)]">อันดับ {clubLeaguePos}/{divisionTable.length} · {TN[meTeam.tier]}</span>
            </div>
            <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
              แผนทีม: {AR_T[meTeam.tac]} · {passLabel} · {tempoLabel} · {pressLabel}
            </div>
          </div>
        </div>
        <div className="seg-bar grid grid-cols-2 shrink-0">
          <button
            type="button"
            onClick={() => { SFX.tap(); setSubTab('status'); }}
            className={`seg-btn whitespace-nowrap px-2.5 ${subTab === 'status' ? 'seg-btn-active' : ''}`}
          >
            🏟️ สถานะทีม
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

      {subTab === 'status' ? (
        <div className="grid grid-cols-1 md:grid-cols-12 mland:grid-cols-12 gap-2.5 mland:gap-1.5 flex-1 min-h-0 overflow-hidden">
          {/* Left: Positional Competitors in Club */}
          <div className="md:col-span-6 mland:col-span-6 p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col min-h-0 gap-2 mland:gap-1">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">⚔️ คู่แข่งตำแหน่ง {p.pos} ในสโมสร</h3>
              <span className="text-[11px] mland:text-[9px] text-[var(--mut)] font-semibold">{samePosTeam.length} คนในทีม</span>
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
                      <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular">⚽ {q.sg || 0} · 🎯 {q.sa || 0}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Division Pos Leaderboard + Thailand NT */}
          <div className="md:col-span-6 mland:col-span-6 flex flex-col gap-2 mland:gap-1.5 min-h-0 overflow-hidden">
            {/* Thailand National Team Readiness */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-1.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">🇹🇭 โอกาสติดทีมชาติไทย (ช้างศึก)</h3>
                <span className="text-xs mland:text-[10px] font-extrabold text-[var(--g)] tabular">ความพร้อม {ntReadyScore}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#2563eb] via-[#38bdf8] to-[#22c55e] transition-all" style={{ width: `${ntReadyScore}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] mland:text-[9px] text-[var(--mut)]">
                <span>ติดทีมชาติแล้ว: <b className="text-[var(--ink)]">{p.ntCaps || 0} นัด · {p.ntGoals || 0} ประตู</b></span>
                <span>ชื่อเสียง: <b className="text-[var(--lamp)]">★ {p.rep ?? 10}</b></span>
              </div>
            </div>

            {/* League Position Top 5 */}
            <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex-1 min-h-0 flex flex-col gap-1.5">
              <div className="flex items-center justify-between shrink-0">
                <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">🏆 ท็อป 5 ตำแหน่ง {p.pos} ใน {TN[meTeam.tier]}</h3>
                <span className="text-[11px] mland:text-[9px] font-bold text-[var(--g)] tabular">
                  อันดับคุณ #{divisionPosLeaderboard.myRank}/{divisionPosLeaderboard.total}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
                {divisionPosLeaderboard.top5.map(({ player: q, team: t }, idx) => (
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
                ))}
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
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {leagueTargets.map(({ team, avgOv, samePosCount, topSame, chance, score }) => (
                <div key={team.id} className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => onInspectTeam(team.id)}>
                    <div className="shrink-0 [&>svg]:w-6 [&>svg]:h-6 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                      <ClubCrest name={team.name} size={24} team={team} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs mland:text-[10px] truncate">{team.name}</div>
                      <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                        ทีมเฉลี่ย {avgOv} · ตำแหน่ง {p.pos}: {samePosCount} คน (สูงสุด {topSame})
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] mland:text-[8.5px] font-bold ${chance === 'สูง' ? 'text-[var(--g)]' : chance === 'ปานกลาง' ? 'text-[#9a6700] dark:text-[var(--lamp)]' : 'text-[var(--red)]'}`}>
                      โอกาส{chance}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRequestLeagueTransfer(team, score)}
                      className="btn btn-xs btn-surface hover:bg-[var(--g)] hover:text-white hover:border-[var(--g)]"
                    >
                      📩 ขอย้าย
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
