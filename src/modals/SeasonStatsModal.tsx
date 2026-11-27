import React, { useMemo, useState } from 'react';
import type { GameState, SeasonArchiveRecord, SeasonPlayerStatRecord } from '../types/game';
import { TN } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { ClubCrest } from '../components/SvgVisuals';
import { PositionBadge } from '../components/PositionBadge';
import { StatIconBadge } from '../components/StatIconBadge';
import { OvrBadge } from '../components/OvrBadge';
import { RatingBadge } from '../components/RatingBadge';

type SortKey = 'avgRating' | 'sg' | 'sa' | 'sp' | 'motm' | 'ov';

export const SeasonStatsModal: React.FC<{
  state: GameState;
  archives: SeasonArchiveRecord[];
  initialSeason?: number;
  onClose: () => void;
}> = ({ state, archives, initialSeason, onClose }) => {
  const sortedArchives = useMemo(
    () => archives.slice().sort((a, b) => b.season - a.season),
    [archives]
  );

  const [selectedSeason, setSelectedSeason] = useState<number>(() => {
    if (initialSeason != null && sortedArchives.some((a) => a.season === initialSeason)) {
      return initialSeason;
    }
    return sortedArchives[0]?.season ?? state.season;
  });

  const [sortBy, setSortBy] = useState<SortKey>('avgRating');
  const [compScope, setCompScope] = useState<'league' | 'cup' | 'all'>('league');

  const rec = sortedArchives.find((a) => a.season === selectedSeason) || sortedArchives[0];
  const recPlayers = useMemo(() => rec?.players || [], [rec]);

  const scopedPlayers = useMemo(() => {
    return recPlayers.map((pl: SeasonPlayerStatRecord) => {
      const cSp = pl.cupSp || 0;
      const cSg = pl.cupSg || 0;
      const cSa = pl.cupSa || 0;
      const cCs = pl.cupCs || 0;
      const cYc = pl.cupYc || 0;
      const cRc = pl.cupRc || 0;
      const cMotm = pl.cupMotm || 0;
      const cRt = pl.cupAvgRating || 0;
      if (compScope === 'cup') {
        return { ...pl, sp: cSp, sg: cSg, sa: cSa, cs: cCs, yc: cYc, rc: cRc, motm: cMotm, avgRating: cRt };
      }
      if (compScope === 'all') {
        const lgW = pl.avgRating > 0 ? pl.sp : 0;
        const cupW = cRt > 0 ? cSp : 0;
        const avgRating =
          lgW + cupW > 0 ? Math.round(((pl.avgRating * lgW + cRt * cupW) / (lgW + cupW)) * 100) / 100 : 0;
        return {
          ...pl,
          sp: pl.sp + cSp,
          sg: pl.sg + cSg,
          sa: pl.sa + cSa,
          cs: pl.cs + cCs,
          motm: pl.motm + cMotm,
          avgRating
        };
      }
      return pl;
    });
  }, [recPlayers, compScope]);

  const sortedPlayers = useMemo(() => {
    const list = scopedPlayers.slice();
    return list.sort((a: SeasonPlayerStatRecord, b: SeasonPlayerStatRecord) => {
      if (sortBy === 'avgRating') {
        return b.avgRating - a.avgRating || b.sg + b.sa - (a.sg + a.sa) || b.sp - a.sp || b.ov - a.ov;
      }
      if (sortBy === 'sg') {
        return b.sg - a.sg || b.sa - a.sa || b.avgRating - a.avgRating || b.sp - a.sp;
      }
      if (sortBy === 'sa') {
        return b.sa - a.sa || b.sg - a.sg || b.avgRating - a.avgRating || b.sp - a.sp;
      }
      if (sortBy === 'sp') {
        return b.sp - a.sp || b.avgRating - a.avgRating || b.sg - a.sg;
      }
      if (sortBy === 'motm') {
        return b.motm - a.motm || b.avgRating - a.avgRating || b.sg + b.sa - (a.sg + a.sa);
      }
      return b.ov - a.ov || b.avgRating - a.avgRating || b.sp - a.sp;
    });
  }, [scopedPlayers, sortBy]);

  const scopedTopScorer = useMemo(() => {
    if (compScope === 'league' && rec?.topScorer) return rec.topScorer;
    const f = scopedPlayers
      .filter((x) => x.sg > 0)
      .slice()
      .sort((a, b) => b.sg - a.sg || b.sa - a.sa || a.sp - b.sp || b.avgRating - a.avgRating)[0];
    return f ? { name: f.name, pos: f.pos, sg: f.sg, sp: f.sp } : null;
  }, [compScope, rec?.topScorer, scopedPlayers]);

  const scopedTopAssist = useMemo(() => {
    if (compScope === 'league' && rec?.topAssist) return rec.topAssist;
    const f = scopedPlayers
      .filter((x) => x.sa > 0)
      .slice()
      .sort((a, b) => b.sa - a.sa || b.sg - a.sg || a.sp - b.sp || b.avgRating - a.avgRating)[0];
    return f ? { name: f.name, pos: f.pos, sa: f.sa, sp: f.sp } : null;
  }, [compScope, rec?.topAssist, scopedPlayers]);

  const scopedTopRating = useMemo(() => {
    if (compScope === 'league' && rec?.topRating) return rec.topRating;
    const f = scopedPlayers
      .filter((x) => x.avgRating > 0 && x.sp > 0)
      .slice()
      .sort((a, b) => b.avgRating - a.avgRating || b.sp - a.sp || b.sg + b.sa - (a.sg + a.sa))[0];
    return f ? { name: f.name, pos: f.pos, avgRating: f.avgRating, sp: f.sp, motm: f.motm } : null;
  }, [compScope, rec?.topRating, scopedPlayers]);

  const scopedTopCleanSheet = useMemo(() => {
    if (compScope === 'league' && rec?.topCleanSheet) return rec.topCleanSheet;
    const f = scopedPlayers
      .filter((x) => x.pos === 'GK' && x.cs > 0)
      .slice()
      .sort((a, b) => b.cs - a.cs || b.sp - a.sp || b.avgRating - a.avgRating)[0];
    return f ? { name: f.name, pos: f.pos, cs: f.cs, sp: f.sp } : null;
  }, [compScope, rec?.topCleanSheet, scopedPlayers]);

  const topMotm = useMemo(() => {
    return scopedPlayers
      .filter((p) => p.motm > 0)
      .slice()
      .sort((a, b) => b.motm - a.motm || b.avgRating - a.avgRating)[0];
  }, [scopedPlayers]);

  if (!rec) return null;

  const gd = rec.gf - rec.ga;
  const archiveTeam = state.teams[rec.teamId];
  const isMyClubCrest = state.mode === 'm' && rec.teamId === state.me;

  const totalTeamGoals = scopedPlayers.reduce((sum, p) => sum + p.sg, 0);
  const totalTeamAssists = scopedPlayers.reduce((sum, p) => sum + p.sa, 0);
  const ratedPlayers = scopedPlayers.filter((p) => p.avgRating > 0 && p.sp > 0);
  const squadAvgRating = ratedPlayers.length
    ? (ratedPlayers.reduce((sum, p) => sum + p.avgRating, 0) / ratedPlayers.length).toFixed(2)
    : '-';

  const outcomeTone = rec.champion
    ? 'bg-[var(--lamp)] text-[#261900]'
    : rec.nextTier > rec.tier
      ? 'bg-[var(--g)] text-white'
      : rec.nextTier < rec.tier
        ? 'bg-[var(--red)] text-white'
        : 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)]';

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'avgRating', label: '⭐ คะแนนเฉลี่ย' },
    { key: 'sg', label: '⚽ ประตู' },
    { key: 'sa', label: '👟 แอสซิสต์' },
    { key: 'sp', label: '👕 ลงเล่น' },
    { key: 'motm', label: '👑 MOTM' },
    { key: 'ov', label: 'OVR' }
  ];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl mland:max-w-[96vw] max-h-[calc(var(--app-dvh,1dvh)*92)] mland:h-[calc(var(--app-dvh,1dvh)*96)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 mland:px-2.5 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
            <div className="shrink-0 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
              <ClubCrest
                name={rec.teamName}
                size={34}
                team={archiveTeam}
                club={isMyClubCrest ? state.club : undefined}
                isMyClub={isMyClubCrest}
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base mland:text-xs font-display truncate">
                📊 สรุปสถิตินักเตะและสโมสร · ซีซั่น {rec.season}
              </h3>
              <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate">
                {rec.teamName} · {TN[rec.tier]} · อันดับ {rec.rank}/{rec.totalTeams} ({rec.pts} แต้ม)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {sortedArchives.length > 1 && (
              <div className="seg-bar bg-[var(--surface)] overflow-x-auto max-w-[180px] sm:max-w-[300px]">
                {sortedArchives.map((item) => (
                  <button
                    key={item.season}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setSelectedSeason(item.season);
                    }}
                    className={`seg-btn ${
                      item.season === rec.season ? 'seg-btn-active' : ''
                    }`}
                  >
                    ซ.{item.season}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onClose();
              }}
              aria-label="ปิดหน้าต่าง"
              className="btn-icon"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2 space-y-3 mland:space-y-2">
          {/* Club Performance Overview */}
          <section className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm mland:text-[11px]">🏟️ สรุปผลงานสโมสรประจำซีซั่น</span>
                <span className={`px-2 py-0.5 rounded-lg text-[11px] mland:text-[9.5px] font-bold ${outcomeTone}`}>
                  {rec.statusText}
                </span>
              </div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">
                ค่าเฉลี่ยเรตติ้งทีม: <b className="text-[var(--ink)]">{squadAvgRating}</b> · ประตูรวมผู้เล่น{' '}
                <b className="text-[var(--ink)]">{totalTeamGoals}</b> · แอสซิสต์{' '}
                <b className="text-[var(--ink)]">{totalTeamAssists}</b>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 mland:grid-cols-6 gap-2 mland:gap-1.5 text-center">
              <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]/70">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">อันดับลีก</div>
                <b className="text-sm mland:text-[11px] tabular">
                  #{rec.rank}/{rec.totalTeams}
                </b>
              </div>
              <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]/70">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">แข่ง {rec.played} นัด</div>
                <b className="text-xs mland:text-[10.5px] tabular">
                  <span className="text-[var(--g)]">{rec.won}ช</span> · {rec.drawn}ส ·{' '}
                  <span className="text-[var(--red)]">{rec.lost}พ</span>
                </b>
              </div>
              <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]/70">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ได้ / เสีย</div>
                <b className="text-xs mland:text-[10.5px] tabular">
                  {rec.gf}-{rec.ga} ({gd >= 0 ? `+${gd}` : gd})
                </b>
              </div>
              <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]/70">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">คะแนนรวม</div>
                <b className="text-sm mland:text-[11px] text-[var(--g)] tabular">{rec.pts} แต้ม</b>
              </div>
              <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]/70">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">ถ้วยประชาชน</div>
                <b className="text-xs mland:text-[10.5px] truncate block">{rec.cupStatus}</b>
              </div>
              <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]/70">
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)]">
                  {rec.asiaStatus ? 'ถ้วยทวีป' : 'ลีกถัดไป'}
                </div>
                <b className="text-xs mland:text-[10.5px] truncate block">
                  {rec.asiaStatus ? rec.asiaStatus : TN[rec.nextTier]}
                </b>
              </div>
            </div>

            {(rec.leagueCupStatus || rec.divCupStatus || rec.superCupStatus || rec.leagueBestScorer || rec.leagueBestAssist) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] mland:text-[9.5px] text-[var(--mut)] pt-0.5">
                {rec.leagueCupStatus && (
                  <span>
                    🥇 ลีกคัพ: <b className="text-[var(--ink)]">{rec.leagueCupStatus}</b>
                  </span>
                )}
                {rec.divCupStatus && (
                  <span>
                    🛡️ ถ้วยดิวิชั่น: <b className="text-[var(--ink)]">{rec.divCupStatus}</b>
                  </span>
                )}
                {rec.superCupStatus && (
                  <span>
                    🏅 แชมเปี้ยนส์คัพ: <b className="text-[var(--ink)]">{rec.superCupStatus}</b>
                  </span>
                )}
                {rec.leagueBestScorer && (
                  <span>
                    ⚽ ดาวซัลโวลีก: <b className="text-[var(--ink)]">{rec.leagueBestScorer}</b>
                  </span>
                )}
                {rec.leagueBestAssist && (
                  <span>
                    👟 แอสซิสต์สูงสุดลีก: <b className="text-[var(--ink)]">{rec.leagueBestAssist}</b>
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Team Player Leaders */}
          <section className="grid grid-cols-2 lg:grid-cols-4 mland:grid-cols-4 gap-2 mland:gap-1.5">
            <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--lamp-soft)]/55 border border-[var(--lamp)]/45 space-y-0.5">
              <div className="text-[11px] mland:text-[9px] font-bold text-[#9a6300] dark:text-[var(--lamp)]">
                ⚽ ดาวยิงสูงสุดในทีม
              </div>
              {scopedTopScorer ? (
                <>
                  <div className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">{scopedTopScorer.name}</div>
                  <div className="text-[11px] mland:text-[9.5px] font-semibold tabular">
                    {scopedTopScorer.sg} ประตู · {scopedTopScorer.sp} นัด ({scopedTopScorer.pos})
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-[var(--mut)]">ไม่มีผู้ทำประตู</div>
              )}
            </div>

            <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--g-soft)]/60 border border-[var(--g)]/35 space-y-0.5">
              <div className="text-[11px] mland:text-[9px] font-bold text-[var(--g)]">👟 แอสซิสต์สูงสุดในทีม</div>
              {scopedTopAssist ? (
                <>
                  <div className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">{scopedTopAssist.name}</div>
                  <div className="text-[11px] mland:text-[9.5px] font-semibold tabular">
                    {scopedTopAssist.sa} ครั้ง · {scopedTopAssist.sp} นัด ({scopedTopAssist.pos})
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-[var(--mut)]">ไม่มีผู้ทำแอสซิสต์</div>
              )}
            </div>

            <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-0.5">
              <div className="text-[11px] mland:text-[9px] font-bold text-[var(--ink)]">⭐ คะแนนเฉลี่ยสูงสุด</div>
              {scopedTopRating ? (
                <>
                  <div className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">{scopedTopRating.name}</div>
                  <div className="text-[11px] mland:text-[9.5px] font-semibold tabular flex items-center gap-1.5">
                    <RatingBadge rt={scopedTopRating.avgRating} decimals={2} size="2xs" />
                    <span>· {scopedTopRating.sp} นัด{scopedTopRating.motm > 0 ? ` · 👑${scopedTopRating.motm}` : ''}</span>
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-[var(--mut)]">ยังไม่มีคะแนนเฉลี่ย</div>
              )}
            </div>

            <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-0.5">
              {scopedTopCleanSheet ? (
                <>
                  <div className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] inline-flex items-center gap-1">
                    <StatIconBadge kind="cleansheet" size="xs" />
                    <span>คลีนชีตสูงสุด</span>
                  </div>
                  <div className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
                    {scopedTopCleanSheet.name}
                  </div>
                  <div className="text-[11px] mland:text-[9.5px] font-semibold tabular">
                    {scopedTopCleanSheet.cs} นัด · ลงเล่น {scopedTopCleanSheet.sp} นัด
                  </div>
                </>
              ) : topMotm ? (
                <>
                  <div className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">👑 MOTM สูงสุด</div>
                  <div className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">{topMotm.name}</div>
                  <div className="text-[11px] mland:text-[9.5px] font-semibold tabular">
                    {topMotm.motm} ครั้ง · เฉลี่ย {topMotm.avgRating.toFixed(2)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] inline-flex items-center gap-1">
                    <StatIconBadge kind="cleansheet" size="xs" />
                    <span>คลีนชีต / MOTM</span>
                  </div>
                  <div className="text-[11px] text-[var(--mut)]">ยังไม่มีบันทึก</div>
                </>
              )}
            </div>
          </section>

          {/* Full Squad Stats Table */}
          <section className="rounded-2xl mland:rounded-xl border border-[var(--line)] overflow-hidden bg-[var(--surface)]">
            <div className="px-3 py-2 mland:px-2 mland:py-1.5 bg-[var(--surface-2)]/80 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-bold text-xs sm:text-sm mland:text-[11px]">
                  👥 ตารางสถิตินักเตะทั้งหมด ({sortedPlayers.length} คน)
                </div>
                <div className="seg-bar bg-[var(--surface)]">
                  {(
                    [
                      ['league', '⚽ บอลลีก'],
                      ['cup', '🏆 บอลถ้วย'],
                      ['all', '📊 รวมทั้งหมด']
                    ] as const
                  ).map(([id, lbl]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setCompScope(id);
                      }}
                      className={`seg-btn ${compScope === id ? 'seg-btn-active' : ''}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="seg-bar flex-wrap bg-[var(--surface)]">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setSortBy(opt.key);
                    }}
                    className={`seg-btn ${
                      sortBy === opt.key ? 'seg-btn-active' : ''
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs mland:text-[10px]">
                <thead>
                  <tr className="bg-[var(--surface-2)]/45 text-[10.5px] mland:text-[9px] text-[var(--mut)] border-b border-[var(--line)]">
                    <th className="py-2 mland:py-1 px-2.5 mland:px-1.5 w-7 text-left">#</th>
                    <th className="py-2 mland:py-1 px-2 mland:px-1.5">นักเตะ</th>
                    <th className="py-2 mland:py-1 px-1.5 text-center">OVR</th>
                    <th className="py-2 mland:py-1 px-1.5 text-center">ลงเล่น</th>
                    <th className="py-2 mland:py-1 px-1.5 text-center">ประตู</th>
                    <th className="py-2 mland:py-1 px-1.5 text-center">แอสซิสต์</th>
                    <th className="py-2 mland:py-1 px-1.5 text-center">คลีนชีต</th>
                    <th className="py-2 mland:py-1 px-1.5 text-center">เหลือง/แดง</th>
                    <th className="py-2 mland:py-1 px-1.5 text-center">MOTM</th>
                    <th className="py-2 mland:py-1 px-2.5 mland:px-1.5 text-right">เฉลี่ย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]/60">
                  {sortedPlayers.map((pl, idx) => {
                    const isTopGoal = scopedTopScorer?.name === pl.name && pl.sg > 0;
                    const isTopAst = scopedTopAssist?.name === pl.name && pl.sa > 0;
                    const isTopRt = scopedTopRating?.name === pl.name && pl.avgRating > 0;
                    return (
                      <tr
                        key={`${pl.name}-${pl.no || idx}`}
                        className={
                          pl.isMe
                            ? 'bg-[var(--lamp-soft)]/50'
                            : idx % 2 === 1
                              ? 'bg-[var(--surface-2)]/25'
                              : ''
                        }
                      >
                        <td className="py-1.5 mland:py-1 px-2.5 mland:px-1.5 text-left text-[var(--mut)] font-bold tabular">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 mland:py-1 px-2 mland:px-1.5 min-w-[140px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <PositionBadge role={pl.ro} size="xs" />
                            {pl.no != null && (
                              <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--mut)] tabular w-[22px] text-left shrink-0">
                                #{pl.no}
                              </span>
                            )}
                            <span className="font-bold truncate">{pl.name}</span>
                            {pl.isMe && <span className="text-[var(--lamp)] shrink-0">★</span>}
                            {isTopRt && <span className="shrink-0" title="คะแนนเฉลี่ยสูงสุดในทีม">⭐</span>}
                            {isTopGoal && <span className="shrink-0" title="ดาวซัลโวทีม">⚽</span>}
                            {isTopAst && <span className="shrink-0" title="แอสซิสต์สูงสุดทีม">👟</span>}
                          </div>
                        </td>
                        <td className="py-1.5 mland:py-1 px-1.5 text-center">
                          <OvrBadge ov={pl.ov} size="xs" />
                        </td>
                        <td className="py-1.5 mland:py-1 px-1.5 text-center font-semibold tabular">{pl.sp}</td>
                        <td className="py-1.5 mland:py-1 px-1.5 text-center font-bold tabular">
                          {pl.sg > 0 ? <span className="text-[var(--g)]">{pl.sg}</span> : <span className="text-[var(--mut)]">0</span>}
                        </td>
                        <td className="py-1.5 mland:py-1 px-1.5 text-center font-bold tabular">
                          {pl.sa > 0 ? <span className="text-[var(--ink)]">{pl.sa}</span> : <span className="text-[var(--mut)]">0</span>}
                        </td>
                        <td className="py-1.5 mland:py-1 px-1.5 text-center tabular">
                          {pl.cs > 0 ? pl.cs : <span className="text-[var(--mut)]">-</span>}
                        </td>
                        <td className="py-1.5 mland:py-1 px-1.5 text-center tabular">
                          {pl.yc > 0 || pl.rc > 0 ? (
                            <span>
                              {pl.yc > 0 ? `🟨${pl.yc}` : ''}
                              {pl.yc > 0 && pl.rc > 0 ? ' ' : ''}
                              {pl.rc > 0 ? `🟥${pl.rc}` : ''}
                            </span>
                          ) : (
                            <span className="text-[var(--mut)]">-</span>
                          )}
                        </td>
                        <td className="py-1.5 mland:py-1 px-1.5 text-center tabular">
                          {pl.motm > 0 ? <b className="text-[#b45309] dark:text-[var(--lamp)]">{pl.motm}</b> : <span className="text-[var(--mut)]">-</span>}
                        </td>
                        <td className="py-1.5 mland:py-1 px-2.5 mland:px-1.5 text-right font-extrabold tabular">
                          {pl.avgRating > 0 && pl.sp > 0 ? (
                            <RatingBadge rt={pl.avgRating} decimals={2} size="xs" />
                          ) : (
                            <span className="text-[var(--mut)] font-normal">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
