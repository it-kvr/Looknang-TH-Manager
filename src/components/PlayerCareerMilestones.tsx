import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Award, Crown, Flame, LayoutGrid, Medal, Sparkles, Star, Table2, Trophy } from 'lucide-react';
import type { GameState, Player, PlayerCareerProfile, PlayerSeasonHistoryRecord, Team } from '../types/game';
import { getPlayerCareerSummary } from '../engine/history';
import { SFX, triggerConfetti } from '../utils/audioTheme';

export type MilestoneCategory = 'all' | 'apps' | 'scoring' | 'impact' | 'glory';
export type MilestoneTier = 'bronze' | 'silver' | 'gold' | 'legend';
export type MilestoneIconKind = 'pitch' | 'boot' | 'glove' | 'assist' | 'star' | 'flag' | 'trophy' | 'captain';

export interface CareerMilestoneItem {
  id: string;
  category: Exclude<MilestoneCategory, 'all'>;
  categoryLabel: string;
  tier: MilestoneTier;
  icon: MilestoneIconKind;
  title: string;
  subtitle: string;
  targetLabel: string;
  current: number;
  target: number;
  unlocked: boolean;
  pct: number;
  highlightWeight: number;
  historyContext: string;
  achievedSeason?: number;
}

interface PlayerCareerMilestonesProps {
  player: Player;
  team: Team | null;
  state: GameState;
  careerProfile: PlayerCareerProfile;
  variant?: 'full' | 'compact';
  onOpenFull?: () => void;
}

const TIER_META: Record<
  MilestoneTier,
  {
    label: string;
    ringStroke: string;
    cardCls: string;
    crestBg: string;
    crestBorder: string;
    accentText: string;
    glowColor: string;
  }
> = {
  bronze: {
    label: 'ระดับเริ่มต้น',
    ringStroke: '#d97706',
    cardCls:
      'bg-gradient-to-br from-amber-500/[0.08] via-[var(--surface)] to-orange-500/[0.06] border-amber-500/35 dark:border-amber-400/30',
    crestBg: 'from-amber-600/20 to-orange-700/25',
    crestBorder: 'border-amber-500/45',
    accentText: 'text-amber-700 dark:text-amber-300',
    glowColor: 'rgba(217, 119, 6, 0.32)'
  },
  silver: {
    label: 'ระดับซิลเวอร์',
    ringStroke: '#64748b',
    cardCls:
      'bg-gradient-to-br from-slate-400/[0.12] via-[var(--surface)] to-sky-500/[0.06] border-slate-400/45 dark:border-slate-400/35',
    crestBg: 'from-slate-400/25 to-sky-500/20',
    crestBorder: 'border-slate-400/50',
    accentText: 'text-slate-700 dark:text-slate-200',
    glowColor: 'rgba(148, 163, 184, 0.34)'
  },
  gold: {
    label: 'ระดับโกลด์',
    ringStroke: '#eab308',
    cardCls:
      'bg-gradient-to-br from-amber-400/[0.16] via-[var(--surface)] to-yellow-500/[0.07] border-amber-400/55 dark:border-amber-400/45',
    crestBg: 'from-amber-400/30 to-yellow-600/25',
    crestBorder: 'border-amber-400/65',
    accentText: 'text-[#9a6700] dark:text-[var(--lamp)]',
    glowColor: 'rgba(245, 194, 66, 0.42)'
  },
  legend: {
    label: 'ระดับตำนาน',
    ringStroke: '#10b981',
    cardCls:
      'bg-gradient-to-br from-emerald-500/[0.16] via-[var(--surface)] to-amber-400/[0.12] border-emerald-500/55 dark:border-emerald-400/45',
    crestBg: 'from-emerald-500/30 to-amber-500/25',
    crestBorder: 'border-emerald-400/70',
    accentText: 'text-emerald-700 dark:text-emerald-300',
    glowColor: 'rgba(47, 196, 118, 0.42)'
  }
};

const BURST_PARTICLES = [
  { x: -46, y: -36, color: '#f5c242', size: 6, delay: 0 },
  { x: 48, y: -34, color: '#2fc476', size: 6, delay: 0.03 },
  { x: -56, y: 8, color: '#60a5fa', size: 5, delay: 0.05 },
  { x: 56, y: 10, color: '#fde047', size: 5, delay: 0.04 },
  { x: -34, y: 44, color: '#fb7185', size: 6, delay: 0.06 },
  { x: 36, y: 42, color: '#f5c242', size: 5, delay: 0.02 },
  { x: 0, y: -54, color: '#fde047', size: 7, delay: 0.01 },
  { x: 0, y: 52, color: '#2fc476', size: 5, delay: 0.07 },
  { x: -24, y: -48, color: '#ffffff', size: 4, delay: 0.04 },
  { x: 26, y: -48, color: '#38bdf8', size: 4, delay: 0.05 }
];

function extractSeasonFromLog(line: string): number | undefined {
  const m = line.match(/ซีซั่น\s*(\d+)/);
  return m ? Number(m[1]) : undefined;
}

function findLogMatch(logsChrono: string[], matcher: RegExp): { season?: number; line: string } | null {
  for (const line of logsChrono) {
    if (matcher.test(line)) {
      return { season: extractSeasonFromLog(line), line };
    }
  }
  return null;
}

function resolveCumulativeHit(
  rowsChrono: PlayerSeasonHistoryRecord[],
  statKey: 'apps' | 'goals' | 'assists' | 'cs' | 'motm',
  target: number
): { season: number; teamName: string } | null {
  let acc = 0;
  for (const r of rowsChrono) {
    const val =
      statKey === 'apps'
        ? (r.sp || 0) + (r.cupSp || 0)
        : statKey === 'goals'
          ? (r.sg || 0) + (r.cupSg || 0)
          : statKey === 'assists'
            ? (r.sa || 0) + (r.cupSa || 0)
            : statKey === 'cs'
              ? (r.cs || 0) + (r.cupCs || 0)
              : (r.motm || 0) + (r.cupMotm || 0);
    acc += val;
    if (acc >= target) {
      return { season: r.season, teamName: r.teamName };
    }
  }
  return null;
}

function MilestoneEmblem({
  kind,
  tier,
  unlocked,
  size = 'md'
}: {
  kind: MilestoneIconKind;
  tier: MilestoneTier;
  unlocked: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const meta = TIER_META[tier];
  const boxCls =
    size === 'lg'
      ? 'w-14 h-14 mland:w-11 mland:h-11 rounded-2xl'
      : size === 'sm'
        ? 'w-9 h-9 mland:w-8 mland:h-8 rounded-xl'
        : 'w-10 h-10 mland:w-8 mland:h-8 rounded-xl';
  const iconCls =
    size === 'lg'
      ? 'w-7 h-7 mland:w-5.5 mland:h-5.5'
      : size === 'sm'
        ? 'w-4.5 h-4.5 mland:w-4 mland:h-4'
        : 'w-5 h-5 mland:w-4 mland:h-4';

  const renderIcon = () => {
    switch (kind) {
      case 'flag':
        return (
          <svg viewBox="0 0 24 24" className={iconCls} aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2.5" fill="#A51931" />
            <rect x="3" y="6.8" width="18" height="10.4" fill="#F4F5F8" />
            <rect x="3" y="9.2" width="18" height="5.6" fill="#2D2A4A" />
            <rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
          </svg>
        );
      case 'trophy':
        return <Trophy className={iconCls} strokeWidth={2.1} />;
      case 'captain':
        return <Crown className={iconCls} strokeWidth={2.1} />;
      case 'star':
        return <Star className={iconCls} strokeWidth={2.1} />;
      case 'boot':
        return <Flame className={iconCls} strokeWidth={2.1} />;
      case 'glove':
        return <Award className={iconCls} strokeWidth={2.1} />;
      case 'assist':
        return <Sparkles className={iconCls} strokeWidth={2.1} />;
      case 'pitch':
      default:
        return <Medal className={iconCls} strokeWidth={2.1} />;
    }
  };

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center border transition-colors ${boxCls} ${
        unlocked
          ? `bg-gradient-to-br ${meta.crestBg} ${meta.crestBorder} ${meta.accentText}`
          : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]/75'
      }`}
    >
      {unlocked && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60"
          style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 0 14px -4px ${meta.glowColor}` }}
        />
      )}
      {renderIcon()}
    </div>
  );
}

function ProgressRing({
  pct,
  stroke,
  size = 36
}: {
  pct: number;
  stroke: string;
  size?: number;
}) {
  const strokeWidth = 3.2;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circ - (clamped / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-[var(--line)]"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-[9px] font-extrabold tabular text-[var(--ink)]">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function CelebrationBurst({ burstKey }: { burstKey: number }) {
  if (burstKey <= 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible z-20" aria-hidden="true">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={burstKey}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="relative w-0 h-0"
        >
          <motion.span
            initial={{ scale: 0.3, opacity: 0.9 }}
            animate={{ scale: 2.25, opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="absolute -left-7 -top-7 w-14 h-14 rounded-full border-2 border-amber-400/80"
          />
          {BURST_PARTICLES.map((pt, idx) => (
            <motion.span
              key={idx}
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
              animate={{ x: pt.x, y: pt.y, scale: [0.6, 1.15, 0.2], opacity: [1, 1, 0] }}
              transition={{ duration: 0.72, delay: pt.delay, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: pt.size,
                height: pt.size,
                marginLeft: -pt.size / 2,
                marginTop: -pt.size / 2,
                backgroundColor: pt.color
              }}
              className="absolute rounded-full shadow-xs"
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export const PlayerCareerMilestones: React.FC<PlayerCareerMilestonesProps> = ({
  player,
  team,
  state,
  careerProfile,
  variant = 'full',
  onOpenFull
}) => {
  const [category, setCategory] = useState<MilestoneCategory>('all');
  const [displayMode, setDisplayMode] = useState<'table' | 'cards'>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState<number>(0);
  const [cardBurstMap, setCardBurstMap] = useState<Record<string, number>>({});
  const [newlyUnlockedIds, setNewlyUnlockedIds] = useState<string[]>([]);

  const isGk = player.pos === 'GK' || careerProfile.sp === 'GK';
  const summary = useMemo(
    () => getPlayerCareerSummary(player, team, state, careerProfile),
    [player, team, state, careerProfile]
  );

  const ntCaps = careerProfile.ntCaps || 0;
  const ntGoals = careerProfile.ntGoals || 0;
  const honorsCount = summary.honors.length;
  const isCaptain = !!team && (team.cap === player.n || team.cap === careerProfile.name);

  const rowsChrono = useMemo(() => {
    const list = [...summary.seasons];
    if (summary.currentRow) list.push(summary.currentRow);
    return list.sort((a, b) => a.season - b.season);
  }, [summary.seasons, summary.currentRow]);

  const logsChrono = useMemo(() => [...summary.careerLog].reverse(), [summary.careerLog]);

  const ntTrophiesChrono = useMemo(
    () =>
      (state.trophies || [])
        .filter((t) => t.type === 'nt')
        .sort((a, b) => a.season - b.season),
    [state.trophies]
  );

  const honorsChrono = useMemo(
    () => [...summary.honors].sort((a, b) => a.season - b.season),
    [summary.honors]
  );

  const milestones = useMemo<CareerMilestoneItem[]>(() => {
    const mkStat = (
      id: string,
      category: Exclude<MilestoneCategory, 'all'>,
      categoryLabel: string,
      tier: MilestoneTier,
      icon: MilestoneIconKind,
      title: string,
      subtitle: string,
      targetLabel: string,
      statKey: 'apps' | 'goals' | 'assists' | 'cs' | 'motm',
      currentRaw: number,
      target: number,
      highlightWeight: number,
      logRegex?: RegExp
    ): CareerMilestoneItem => {
      const unlocked = currentRaw >= target;
      const pct = target > 0 ? Math.min(100, Math.round((currentRaw / target) * 100)) : 0;
      let historyContext = `เหลืออีก ${Math.max(1, target - currentRaw)} ${targetLabel.replace(/^\d+\s*/, '') || 'ครั้ง'}`;
      let achievedSeason: number | undefined;

      if (unlocked) {
        const logHit = logRegex ? findLogMatch(logsChrono, logRegex) : null;
        const rowHit = resolveCumulativeHit(rowsChrono, statKey, target);
        if (rowHit) {
          achievedSeason = rowHit.season;
          historyContext = `ซีซั่น ${rowHit.season} · ${rowHit.teamName}`;
        } else if (logHit?.season) {
          achievedSeason = logHit.season;
          historyContext = `ซีซั่น ${logHit.season}`;
        } else if (rowsChrono[0]) {
          achievedSeason = rowsChrono[0].season;
          historyContext = `บันทึกอาชีพ · ${rowsChrono[0].teamName}`;
        } else {
          historyContext = `ซีซั่น ${state.season}`;
          achievedSeason = state.season;
        }
      }

      return {
        id,
        category,
        categoryLabel,
        tier,
        icon,
        title,
        subtitle,
        targetLabel,
        current: Math.min(currentRaw, target),
        target,
        unlocked,
        pct,
        highlightWeight,
        historyContext,
        achievedSeason
      };
    };

    const ntCallupLogs = logsChrono.filter((l) => l.includes('ติดทีมชาติไทย'));
    const firstNtSeason = ntTrophiesChrono[0]?.season ?? (ntCallupLogs[0] ? extractSeasonFromLog(ntCallupLogs[0]) : undefined);
    const firstNtGoalLog = findLogMatch(logsChrono, /ติดทีมชาติไทย.*ยิง\s*\d+\s*ประตู/);
    const firstHonor = honorsChrono[0];

    const mkCustom = (
      id: string,
      category: Exclude<MilestoneCategory, 'all'>,
      categoryLabel: string,
      tier: MilestoneTier,
      icon: MilestoneIconKind,
      title: string,
      subtitle: string,
      targetLabel: string,
      currentRaw: number,
      target: number,
      highlightWeight: number,
      unlockedContext: string,
      lockedContext: string,
      achievedSeason?: number
    ): CareerMilestoneItem => {
      const unlocked = currentRaw >= target;
      const pct = target > 0 ? Math.min(100, Math.round((currentRaw / target) * 100)) : 0;
      return {
        id,
        category,
        categoryLabel,
        tier,
        icon,
        title,
        subtitle,
        targetLabel,
        current: Math.min(currentRaw, target),
        target,
        unlocked,
        pct,
        highlightWeight,
        historyContext: unlocked ? unlockedContext : lockedContext,
        achievedSeason: unlocked ? achievedSeason : undefined
      };
    };

    const list: CareerMilestoneItem[] = [
      // Appearances
      mkStat(
        'apps_1',
        'apps',
        'ลงสนาม',
        'bronze',
        'pitch',
        'ประเดิมสนามอาชีพ',
        'ลงเล่นนัดแรกในระดับสโมสรอาชีพ',
        '1 นัด',
        'apps',
        summary.totalApps,
        1,
        10
      ),
      mkStat(
        'apps_25',
        'apps',
        'ลงสนาม',
        'silver',
        'pitch',
        'แข้งตัวหลัก 25 นัด',
        'ลงสนามช่วยทีมครบ 25 นัดในอาชีพ',
        '25 นัด',
        'apps',
        summary.totalApps,
        25,
        25
      ),
      mkStat(
        'apps_50',
        'apps',
        'ลงสนาม',
        'gold',
        'pitch',
        'ครึ่งร้อยลงสนาม (50 นัด)',
        'กรำศึกฟุตบอลอาชีพครบ 50 นัด',
        '50 นัด',
        'apps',
        summary.totalApps,
        50,
        55,
        /ลงเล่นครบ\s*50\s*นัด/
      ),
      mkStat(
        'apps_100',
        'apps',
        'ลงสนาม',
        'legend',
        'pitch',
        'ตำนาน 100 นัด',
        'ลงสนามระดับอาชีพแตะหลัก 100 นัด',
        '100 นัด',
        'apps',
        summary.totalApps,
        100,
        92,
        /ลงเล่นครบ\s*100\s*นัด/
      ),
      mkStat(
        'apps_200',
        'apps',
        'ลงสนาม',
        'legend',
        'pitch',
        'ขุนพลเหล็ก 200 นัด',
        'ยืนระยะอย่างแข็งแกร่งครบ 200 นัด',
        '200 นัด',
        'apps',
        summary.totalApps,
        200,
        98,
        /ลงเล่นครบ\s*200\s*นัด/
      ),

      // Scoring / Goalkeeping
      ...(isGk
        ? [
            mkStat(
              'gk_1',
              'scoring',
              'คลีนชีต',
              'bronze',
              'glove',
              'คลีนชีตแรกในอาชีพ',
              'เก็บเกมไม่เสียประตูครั้งแรก',
              '1 คลีนชีต',
              'cs',
              summary.totalCleanSheets,
              1,
              15
            ),
            mkStat(
              'gk_10',
              'scoring',
              'คลีนชีต',
              'silver',
              'glove',
              'มือหนึบ 10 คลีนชีต',
              'ปราการด่านสุดท้าย 10 นัดไม่เสียประตู',
              '10 คลีนชีต',
              'cs',
              summary.totalCleanSheets,
              10,
              40
            ),
            mkStat(
              'gk_25',
              'scoring',
              'คลีนชีต',
              'gold',
              'glove',
              'กำแพงเหล็ก 25 คลีนชีต',
              'เหนียวแน่นระดับแนวหน้าครบ 25 คลีนชีต',
              '25 คลีนชีต',
              'cs',
              summary.totalCleanSheets,
              25,
              74
            ),
            mkStat(
              'gk_50',
              'scoring',
              'คลีนชีต',
              'legend',
              'glove',
              'ถุงมือทอง 50 คลีนชีต',
              'ปิดตายคู่แข่งครบ 50 นัดตลอดอาชีพ',
              '50 คลีนชีต',
              'cs',
              summary.totalCleanSheets,
              50,
              96
            )
          ]
        : [
            mkStat(
              'goal_1',
              'scoring',
              'ทำประตู',
              'bronze',
              'boot',
              'ประตูแรกในอาชีพ',
              'เปิดบัญชีสกอร์ลูกแรกในเกมอาชีพ',
              '1 ประตู',
              'goals',
              summary.totalGoals,
              1,
              16
            ),
            mkStat(
              'goal_10',
              'scoring',
              'ทำประตู',
              'silver',
              'boot',
              'จอมยิง 10 ประตู',
              'สับไกพาทีมเฮครบ 10 ประตู',
              '10 ประตู',
              'goals',
              summary.totalGoals,
              10,
              36,
              /ยิงครบ\s*10\s*ประตู/
            ),
            mkStat(
              'goal_25',
              'scoring',
              'ทำประตู',
              'gold',
              'boot',
              'คมกริบ 25 ประตู',
              'ตัวจบสกอร์อันตรายครบ 25 ประตู',
              '25 ประตู',
              'goals',
              summary.totalGoals,
              25,
              64,
              /ยิงครบ\s*25\s*ประตู/
            ),
            mkStat(
              'goal_50',
              'scoring',
              'ทำประตู',
              'gold',
              'boot',
              'เพชฌฆาต 50 ประตู',
              'ซัดตาข่ายคู่แข่งครบหลัก 50 ประตู',
              '50 ประตู',
              'goals',
              summary.totalGoals,
              50,
              90,
              /ยิงครบ\s*50\s*ประตู/
            ),
            mkStat(
              'goal_100',
              'scoring',
              'ทำประตู',
              'legend',
              'boot',
              'ทำเนียบ 100 ประตู',
              'สุดยอดดาวยิงระดับตำนานครบ 100 ประตู',
              '100 ประตู',
              'goals',
              summary.totalGoals,
              100,
              100,
              /ยิงครบ\s*100\s*ประตู/
            )
          ]),

      // Impact: Assists & MOTM
      mkStat(
        'ast_10',
        'impact',
        'แอสซิสต์ & MOTM',
        'silver',
        'assist',
        'จอมปั้นเกม 10 แอสซิสต์',
        'จ่ายบอลให้เพื่อนสังหารครบ 10 ครั้ง',
        '10 แอสซิสต์',
        'assists',
        summary.totalAssists,
        10,
        32
      ),
      mkStat(
        'ast_25',
        'impact',
        'แอสซิสต์ & MOTM',
        'gold',
        'assist',
        'เพลย์เมคเกอร์ 25 แอสซิสต์',
        'คีย์พาสแม่นยำสร้างโอกาส 25 ประตู',
        '25 แอสซิสต์',
        'assists',
        summary.totalAssists,
        25,
        68
      ),
      mkStat(
        'ast_50',
        'impact',
        'แอสซิสต์ & MOTM',
        'legend',
        'assist',
        'มาสเตอร์ 50 แอสซิสต์',
        'จอมทัพสร้างสรรค์เกมครบ 50 แอสซิสต์',
        '50 แอสซิสต์',
        'assists',
        summary.totalAssists,
        50,
        94
      ),
      mkStat(
        'motm_5',
        'impact',
        'แอสซิสต์ & MOTM',
        'silver',
        'star',
        'ขวัญใจแฟนบอล 5 MOTM',
        'คว้าตำแหน่งผู้เล่นยอดเยี่ยม 5 นัด',
        '5 MOTM',
        'motm',
        summary.totalMotm,
        5,
        34
      ),
      mkStat(
        'motm_15',
        'impact',
        'แอสซิสต์ & MOTM',
        'legend',
        'star',
        'เดอะแบก 15 MOTM',
        'โดดเด่นที่สุดในสนามครบ 15 นัด',
        '15 MOTM',
        'motm',
        summary.totalMotm,
        15,
        85
      ),

      // National Team & Glory
      mkCustom(
        'nt_cap_1',
        'glory',
        'ทีมชาติไทย',
        'gold',
        'flag',
        'ติดทีมชาติไทยนัดแรก',
        'สวมเสื้อช้างศึกชุดใหญ่ลงสนามเป็นครั้งแรก',
        'ทีมชาติ 1 นัด',
        ntCaps,
        1,
        88,
        firstNtSeason ? `ซีซั่น ${firstNtSeason} · ติดทีมชาติชุดใหญ่ (${ntCaps} นัด)` : `ติดทีมชาติไทยแล้ว ${ntCaps} นัด`,
        'ทำผลงานเด่นในลีกเพื่อติดทัพช้างศึก',
        firstNtSeason
      ),
      mkCustom(
        'nt_cap_10',
        'glory',
        'ทีมชาติไทย',
        'gold',
        'flag',
        'ขุนพลช้างศึก 10 นัด',
        'รับใช้ทัพช้างศึกอย่างต่อเนื่อง 10 นัด',
        'ทีมชาติ 10 นัด',
        ntCaps,
        10,
        91,
        `รับใช้ชาติครบ 10 นัด (รวม ${ntCaps} นัด)`,
        `เหลืออีก ${Math.max(1, 10 - ntCaps)} นัดทีมชาติ`,
        ntTrophiesChrono[ntTrophiesChrono.length - 1]?.season
      ),
      mkCustom(
        'nt_cap_25',
        'glory',
        'ทีมชาติไทย',
        'legend',
        'flag',
        'ตำนานทีมชาติ 25 นัด',
        'ติดธงช้างศึกครบ 25 นัดระดับนานาชาติ',
        'ทีมชาติ 25 นัด',
        ntCaps,
        25,
        97,
        `รับใช้ชาติครบ 25 นัด (รวม ${ntCaps} นัด)`,
        `เหลืออีก ${Math.max(1, 25 - ntCaps)} นัดทีมชาติ`,
        ntTrophiesChrono[ntTrophiesChrono.length - 1]?.season
      ),
      ...(!isGk
        ? [
            mkCustom(
              'nt_goal_1',
              'glory',
              'ทีมชาติไทย',
              'gold',
              'flag',
              'ประตูแรกในสีเสื้อทีมชาติ',
              'เบิกสกอร์ให้ทัพช้างศึกในเวทีทีมชาติ',
              '1 ประตูทีมชาติ',
              ntGoals,
              1,
              89,
              firstNtGoalLog?.season
                ? `ซีซั่น ${firstNtGoalLog.season} · ยิงในนามทีมชาติ (รวม ${ntGoals} ลูก)`
                : `ทำประตูทีมชาติแล้ว ${ntGoals} ประตู`,
              'ลุ้นเบิกสกอร์แรกเมื่อถูกเรียกติดทีมชาติ',
              firstNtGoalLog?.season
            )
          ]
        : []),
      mkCustom(
        'honor_1',
        'glory',
        'เกียรติยศ',
        'gold',
        'trophy',
        'แชมป์แรกในอาชีพ',
        'ชูถ้วยรางวัลรายการใหญ่ร่วมกับสโมสร',
        '1 แชมป์',
        honorsCount,
        1,
        95,
        firstHonor
          ? `ซีซั่น ${firstHonor.season} · ${firstHonor.honor} (${firstHonor.teamName})`
          : 'คว้าแชมป์ระดับสโมสร',
        'ลุ้นคว้าแชมป์ลีกหรือบอลถ้วยกับสโมสร',
        firstHonor?.season
      ),
      mkCustom(
        'captain_1',
        'glory',
        'เกียรติยศ',
        'gold',
        'captain',
        'ปลอกแขนกัปตันทีม',
        'ได้รับความไว้วางใจเป็นผู้นำทัพในสนาม',
        'กัปตันทีม',
        isCaptain ? 1 : 0,
        1,
        80,
        `กัปตันทีม ${team?.name || 'สโมสร'} · ซีซั่น ${state.season}`,
        'สะสมประสบการณ์และภาวะผู้นำในทีม',
        isCaptain ? state.season : undefined
      )
    ];

    return list;
  }, [summary, rowsChrono, logsChrono, ntTrophiesChrono, honorsChrono, isGk, ntCaps, ntGoals, honorsCount, isCaptain, team?.name, state.season]);

  const unlockedList = useMemo(
    () =>
      milestones
        .filter((m) => m.unlocked)
        .sort((a, b) => b.highlightWeight - a.highlightWeight),
    [milestones]
  );

  const upcomingList = useMemo(
    () =>
      milestones
        .filter((m) => !m.unlocked)
        .sort((a, b) => b.pct - a.pct || a.target - b.target),
    [milestones]
  );

  // Track newly unlocked milestones across matches/sessions
  const storageKey = `looknang_milestones_seen_${careerProfile.name}_${careerProfile.pos}`;
  useEffect(() => {
    const unlockedIds = unlockedList.map((m) => m.id);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        localStorage.setItem(storageKey, JSON.stringify(unlockedIds));
        return;
      }
      const prevIds = JSON.parse(raw) as string[];
      if (Array.isArray(prevIds)) {
        const fresh = unlockedIds.filter((id) => !prevIds.includes(id));
        if (fresh.length > 0) {
          setNewlyUnlockedIds(fresh);
          setSelectedId(fresh[0]);
          setBurstKey((k) => k + 1);
          localStorage.setItem(storageKey, JSON.stringify(unlockedIds));
        }
      }
    } catch {
      // ignore storage failure
    }
  }, [unlockedList, storageKey]);

  const spotlight = useMemo(() => {
    if (selectedId) {
      const found = milestones.find((m) => m.id === selectedId);
      if (found) return found;
    }
    if (newlyUnlockedIds.length > 0) {
      const fresh = milestones.find((m) => m.id === newlyUnlockedIds[0]);
      if (fresh) return fresh;
    }
    return unlockedList[0] || upcomingList[0] || milestones[0];
  }, [selectedId, newlyUnlockedIds, milestones, unlockedList, upcomingList]);

  const filteredMilestones = useMemo(() => {
    const base = category === 'all' ? milestones : milestones.filter((m) => m.category === category);
    return [...base].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked && b.unlocked) return b.highlightWeight - a.highlightWeight;
      return b.pct - a.pct || a.target - b.target;
    });
  }, [milestones, category]);

  const triggerSpotlightCelebration = (item: CareerMilestoneItem, withConfetti = true) => {
    setSelectedId(item.id);
    if (item.unlocked) {
      setBurstKey((k) => k + 1);
      setCardBurstMap((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
      SFX.win();
      if (withConfetti) triggerConfetti(1);
    } else {
      SFX.tap();
    }
  };

  const unlockedCount = unlockedList.length;
  const totalCount = milestones.length;
  const overallPct = Math.round((unlockedCount / Math.max(1, totalCount)) * 100);
  const nextGoal = upcomingList[0] || null;
  const latestHonor = summary.honors[0] || null;

  if (variant === 'compact') {
    const latestUnlocked = unlockedList[0] || null;
    return (
      <MotionConfig reducedMotion="user">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-[var(--line)] bg-gradient-to-r from-amber-500/[0.08] via-[var(--surface-2)]/70 to-emerald-500/[0.07] px-2.5 py-2 mland:px-2 mland:py-1.5 flex items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0">
              <MilestoneEmblem
                kind={latestUnlocked ? latestUnlocked.icon : nextGoal?.icon || 'trophy'}
                tier={latestUnlocked ? latestUnlocked.tier : 'bronze'}
                unlocked={!!latestUnlocked}
                size="sm"
              />
              {newlyUnlockedIds.length > 0 && <CelebrationBurst burstKey={burstKey} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11.5px] mland:text-[9.5px] font-extrabold text-[var(--ink)] truncate">
                <span>
                  {latestUnlocked
                    ? `🏆 หมุดหมายล่าสุด: ${latestUnlocked.title}`
                    : '🌟 เส้นทางหมุดหมายอาชีพ'}
                </span>
                {newlyUnlockedIds.length > 0 && (
                  <span className="text-[10px] mland:text-[8px] font-black text-amber-600 dark:text-amber-300">
                    · ปลดล็อกใหม่!
                  </span>
                )}
              </div>
              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular truncate">
                ปลดล็อกแล้ว <b className="text-[var(--ink)]">{unlockedCount}/{totalCount}</b>
                {nextGoal ? (
                  <>
                    {' '}
                    · เป้าถัดไป: <span className="text-[var(--g)] font-semibold">{nextGoal.title}</span> ({nextGoal.current}/{nextGoal.target})
                  </>
                ) : (
                  ' · ครบทุกหมุดหมายระดับตำนานแล้ว!'
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {nextGoal && (
              <ProgressRing
                pct={nextGoal.pct}
                stroke={TIER_META[nextGoal.tier].ringStroke}
                size={32}
              />
            )}
            {onOpenFull && (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onOpenFull();
                }}
                className="px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--g-soft)] border border-[var(--line)] hover:border-[var(--g)] text-[11px] mland:text-[9px] font-bold text-[var(--ink)] cursor-pointer transition-colors whitespace-nowrap"
              >
                ตารางหมุดหมาย →
              </button>
            )}
          </div>
        </motion.div>
      </MotionConfig>
    );
  }

  const spotlightMeta = TIER_META[spotlight.tier];

  return (
    <MotionConfig reducedMotion="user">
      <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 space-y-3 mland:space-y-2 overflow-hidden">
        {/* Top Section Header & Summary Metrics */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)] flex items-center gap-1.5">
              <span>🏆 ตารางหมุดหมายสำคัญในอาชีพ</span>
              <span className="font-display text-[11px] mland:text-[9.5px] text-[var(--g)] tabular">
                {unlockedCount}/{totalCount} ({overallPct}%)
              </span>
            </h3>
            <p className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular truncate">
              {player.n} · ลงเล่น {summary.totalApps} นัด · {isGk ? `${summary.totalCleanSheets} คลีนชีต` : `${summary.totalGoals} ประตู`} · ทีมชาติ {ntCaps} นัด ({ntGoals} ประตู)
              {latestHonor ? ` · 🏆 ${latestHonor.honor}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap max-w-full">
            {/* Table vs Cards View Switcher */}
            <div className="seg-bar bg-[var(--surface-2)] shrink-0">
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setDisplayMode('table');
                }}
                className={`seg-btn py-0.5 px-2 text-[10.5px] mland:text-[8.5px] inline-flex items-center gap-1 whitespace-nowrap ${
                  displayMode === 'table' ? 'seg-btn-active' : ''
                }`}
              >
                <Table2 className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
                <span>ตาราง</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setDisplayMode('cards');
                }}
                className={`seg-btn py-0.5 px-2 text-[10.5px] mland:text-[8.5px] inline-flex items-center gap-1 whitespace-nowrap ${
                  displayMode === 'cards' ? 'seg-btn-active' : ''
                }`}
              >
                <LayoutGrid className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
                <span>การ์ด</span>
              </button>
            </div>

            {/* Category Filter */}
            <div className="seg-bar bg-[var(--surface-2)] overflow-x-auto no-scrollbar max-w-full">
              {(
                [
                  ['all', 'ทั้งหมด'],
                  ['apps', 'ลงสนาม'],
                  ['scoring', isGk ? 'คลีนชีต' : 'ประตู'],
                  ['impact', 'แอสซิสต์ & MOTM'],
                  ['glory', 'ทีมชาติ & แชมป์']
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setCategory(k);
                  }}
                  className={`seg-btn py-0.5 px-2 text-[10.5px] mland:text-[8.5px] whitespace-nowrap ${
                    category === k ? 'seg-btn-active' : ''
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Celebratory Hero Spotlight Banner */}
        <motion.div
          key={spotlight.id}
          initial={{ opacity: 0, y: 6, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className={`relative overflow-hidden rounded-2xl mland:rounded-xl border p-3 mland:p-2 ${
            spotlight.unlocked
              ? spotlightMeta.cardCls
              : 'bg-[var(--surface-2)]/75 border-[var(--line)]'
          }`}
        >
          {spotlight.unlocked && (
            <motion.div
              aria-hidden="true"
              initial={{ x: '-110%' }}
              animate={{ x: '220%' }}
              transition={{ duration: 1.4, ease: 'easeInOut', repeat: 0 }}
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
          )}

          <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 mland:gap-2">
            <div className="flex items-center gap-3 mland:gap-2 min-w-0 flex-1">
              <div className="relative shrink-0 flex items-center justify-center">
                <motion.div
                  key={`${spotlight.id}-${burstKey}`}
                  initial={spotlight.unlocked ? { scale: 0.88, rotate: -5 } : false}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 18 }}
                >
                  <MilestoneEmblem
                    kind={spotlight.icon}
                    tier={spotlight.tier}
                    unlocked={spotlight.unlocked}
                    size="lg"
                  />
                </motion.div>
                <CelebrationBurst burstKey={burstKey} />
              </div>

              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] mland:text-[8.5px] font-bold">
                  <span className={spotlight.unlocked ? spotlightMeta.accentText : 'text-[var(--mut)]'}>
                    {spotlight.unlocked ? `✨ ปลดล็อกแล้ว · ${spotlightMeta.label}` : `🎯 เป้าหมายถัดไป · ${spotlightMeta.label}`}
                  </span>
                  <span className="text-[var(--mut)]">· {spotlight.historyContext}</span>
                  {newlyUnlockedIds.includes(spotlight.id) && (
                    <span className="text-amber-600 dark:text-amber-300 font-black">· เพิ่งปลดล็อก!</span>
                  )}
                </div>

                <div className="font-display font-extrabold text-sm sm:text-base mland:text-xs text-[var(--ink)] leading-tight truncate">
                  {spotlight.title}
                </div>

                <div className="text-[11px] mland:text-[9px] text-[var(--mut)] leading-snug">
                  {spotlight.subtitle} ·{' '}
                  <span className="font-bold text-[var(--ink)] tabular">
                    {spotlight.current}/{spotlight.target} ({spotlight.targetLabel})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {!spotlight.unlocked ? (
                <ProgressRing pct={spotlight.pct} stroke={spotlightMeta.ringStroke} size={42} />
              ) : (
                <button
                  type="button"
                  onClick={() => triggerSpotlightCelebration(spotlight, true)}
                  className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-xs mland:text-[9.5px] shadow-sm cursor-pointer transition-transform active:scale-95 whitespace-nowrap flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 mland:w-3 mland:h-3" />
                  <span>ฉลองความสำเร็จ</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Table View (Default) */}
        {displayMode === 'table' ? (
          <div className="rounded-xl border border-[var(--line)] overflow-hidden bg-[var(--surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] mland:text-[9px] border-collapse">
                <thead>
                  <tr className="bg-[var(--surface-2)] border-b border-[var(--line)] text-[var(--mut)]">
                    <th className="py-2 mland:py-1 px-2.5 mland:px-2 font-bold">ความสำเร็จ (Milestone)</th>
                    <th className="py-2 mland:py-1 px-2 font-bold whitespace-nowrap hidden sm:table-cell">หมวดหมู่</th>
                    <th className="py-2 mland:py-1 px-2 font-bold whitespace-nowrap">ความคืบหน้า</th>
                    <th className="py-2 mland:py-1 px-2 font-bold whitespace-nowrap">บันทึกประวัติ / ซีซั่นที่ทำได้</th>
                    <th className="py-2 mland:py-1 px-2.5 mland:px-2 font-bold text-right whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMilestones.map((item) => {
                    const meta = TIER_META[item.tier];
                    const isSelected = spotlight.id === item.id;
                    const isNear = !item.unlocked && item.pct >= 70;
                    const itemBurst = cardBurstMap[item.id] || 0;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => triggerSpotlightCelebration(item, true)}
                        className={`border-b border-[var(--line)]/60 last:border-b-0 cursor-pointer transition-colors ${
                          isSelected
                            ? item.unlocked
                              ? 'bg-amber-500/[0.11] dark:bg-amber-400/[0.10]'
                              : 'bg-[var(--g-soft)]/50'
                            : item.unlocked
                              ? 'bg-emerald-500/[0.03] hover:bg-amber-500/[0.08]'
                              : 'hover:bg-[var(--surface-2)]/70'
                        }`}
                      >
                        <td className="py-2 mland:py-1.5 px-2.5 mland:px-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative shrink-0">
                              <MilestoneEmblem
                                kind={item.icon}
                                tier={item.tier}
                                unlocked={item.unlocked}
                                size="sm"
                              />
                              <CelebrationBurst burstKey={itemBurst} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[11.5px] mland:text-[9.5px] text-[var(--ink)] leading-snug">
                                {item.title}
                                {newlyUnlockedIds.includes(item.id) && (
                                  <span className="ml-1.5 text-[9.5px] font-black text-amber-600 dark:text-amber-300">
                                    · ใหม่!
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] mland:text-[8px] text-[var(--mut)] leading-snug truncate max-w-[240px] sm:max-w-[300px]">
                                {item.subtitle}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2 mland:py-1.5 px-2 whitespace-nowrap hidden sm:table-cell text-[var(--mut)] font-medium">
                          {item.categoryLabel}
                        </td>

                        <td className="py-2 mland:py-1.5 px-2 whitespace-nowrap">
                          <div className="w-24 sm:w-28 space-y-1">
                            <div className="flex items-center justify-between text-[10px] mland:text-[8.5px] tabular font-bold">
                              <span className={item.unlocked ? meta.accentText : isNear ? 'text-[var(--g)]' : 'text-[var(--ink)]'}>
                                {item.current}/{item.target}
                              </span>
                              <span className="text-[var(--mut)]">{item.pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${item.pct}%`,
                                  backgroundColor: item.unlocked ? meta.ringStroke : 'var(--g)'
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-2 mland:py-1.5 px-2 text-[10.5px] mland:text-[8.5px] tabular">
                          <span className={item.unlocked ? 'font-semibold text-[var(--ink)]' : 'text-[var(--mut)]'}>
                            {item.historyContext}
                          </span>
                        </td>

                        <td className="py-2 mland:py-1.5 px-2.5 mland:px-2 text-right whitespace-nowrap">
                          {item.unlocked ? (
                            <span className={`font-extrabold text-[11px] mland:text-[9px] ${meta.accentText}`}>
                              ✓ สำเร็จ
                            </span>
                          ) : (
                            <span className={`font-bold tabular text-[10.5px] mland:text-[8.5px] ${isNear ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                              {isNear ? 'ใกล้ถึงแล้ว' : 'กำลังไล่ล่า'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Visual Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mland:grid-cols-2 gap-2 mland:gap-1.5">
            {filteredMilestones.map((item, index) => {
              const meta = TIER_META[item.tier];
              const isSelected = spotlight.id === item.id;
              const isNear = !item.unlocked && item.pct >= 70;
              const itemBurst = cardBurstMap[item.id] || 0;

              return (
                <motion.button
                  key={item.id}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => triggerSpotlightCelebration(item, true)}
                  className={`relative text-left rounded-xl border p-2.5 mland:p-1.5 transition-all cursor-pointer flex items-center justify-between gap-2.5 overflow-hidden ${
                    item.unlocked
                      ? `${meta.cardCls} ${isSelected ? 'ring-1.5 ring-amber-400/80 shadow-sm' : 'hover:border-amber-400/65'}`
                      : `bg-[var(--surface-2)]/65 border-[var(--line)] hover:border-[var(--g)]/55 ${
                          isSelected ? 'ring-1 ring-[var(--g)]/60' : ''
                        }`
                  }`}
                >
                  <div className="flex items-center gap-2.5 mland:gap-2 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <MilestoneEmblem
                        kind={item.icon}
                        tier={item.tier}
                        unlocked={item.unlocked}
                        size="md"
                      />
                      <CelebrationBurst burstKey={itemBurst} />
                    </div>

                    <div className="min-w-0 space-y-0.5 flex-1">
                      <div
                        className={`font-bold text-xs mland:text-[10px] leading-snug truncate ${
                          item.unlocked ? 'text-[var(--ink)]' : 'text-[var(--ink)]/85'
                        }`}
                      >
                        {item.title}
                      </div>
                      <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug truncate">
                        {item.historyContext}
                      </div>
                      <div className="text-[10px] mland:text-[8px] font-semibold tabular truncate">
                        {item.unlocked ? (
                          <span className={meta.accentText}>
                            ✓ สำเร็จ · {item.targetLabel}
                            {newlyUnlockedIds.includes(item.id) ? ' · ใหม่!' : ''}
                          </span>
                        ) : (
                          <span className={isNear ? 'text-[var(--g)] font-bold' : 'text-[var(--mut)]'}>
                            {item.current}/{item.target} · {item.pct}%{isNear ? ' · ใกล้ถึงแล้ว!' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {item.unlocked ? (
                      <span className={`text-[11px] mland:text-[9px] font-black ${meta.accentText}`}>
                        ★
                      </span>
                    ) : (
                      <ProgressRing pct={item.pct} stroke={meta.ringStroke} size={36} />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </MotionConfig>
  );
};
