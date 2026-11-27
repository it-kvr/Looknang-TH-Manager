import React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronsDown, ChevronsUp } from 'lucide-react';
import type { GameState, Player, Team } from '../types/game';
import { getActiveFavBoost, getPlayerMentalScore, getPlayerPhysScore } from '../engine/wellbeing';

export type FormTrendDir = 'hot' | 'up' | 'flat' | 'down' | 'cold';

export interface PlayerFormTrend {
  dir: FormTrendDir;
  score: number;
  label: string;
  reason: string;
  lastRt: number | null;
  avgRt: number | null;
}

export function buildRecentRatingsMap(state: GameState): Map<string, number[]> {
  const map = new Map<string, number[]>();
  const sched = state.schedRes;
  if (!sched) return map;
  const keys = Object.keys(sched)
    .map(Number)
    .filter((k) => Number.isFinite(k))
    .sort((a, b) => a - b);
  for (const mdKey of keys) {
    const ratings = sched[mdKey]?.ratings;
    if (!ratings) continue;
    for (const [name, rt] of Object.entries(ratings)) {
      if (typeof rt !== 'number' || !Number.isFinite(rt)) continue;
      const arr = map.get(name);
      if (arr) {
        arr.push(rt);
        if (arr.length > 5) arr.shift();
      } else {
        map.set(name, [rt]);
      }
    }
  }
  return map;
}

export function getPlayerFormTrend(
  player: Player,
  team: Team,
  state: GameState,
  recentRatingsMap?: Map<string, number[]>
): PlayerFormTrend {
  const isMe = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
  const cp = isMe ? state.p : null;
  const recent = recentRatingsMap?.get(player.n) || [];
  const lastRt = recent.length > 0 ? recent[recent.length - 1] : null;
  const avgRt = (player.sra || 0) > 0 ? (player.srs || 0) / player.sra! : null;

  const mental = getPlayerMentalScore(player, cp);
  const phys = getPlayerPhysScore(player, cp);
  const favBoost = getActiveFavBoost(player, team, cp);
  const fit = Math.round(player.fit ?? 100);

  let score = 0;
  const reasons: string[] = [];

  if (lastRt !== null) {
    const baseline =
      recent.length >= 2
        ? recent.slice(0, -1).reduce((s, v) => s + v, 0) / (recent.length - 1)
        : avgRt ?? 6.65;
    const diff = lastRt - baseline;
    if (lastRt >= 7.5 || (lastRt >= 7.0 && diff >= 0.45)) {
      score += 2.1;
      reasons.push(`นัดล่าสุด ${lastRt.toFixed(1)}`);
    } else if (lastRt >= 6.85 || diff >= 0.3) {
      score += 1.1;
      reasons.push(`นัดล่าสุด ${lastRt.toFixed(1)}`);
    } else if (lastRt <= 5.9 || (lastRt <= 6.3 && diff <= -0.45)) {
      score -= 2.1;
      reasons.push(`นัดล่าสุด ${lastRt.toFixed(1)}`);
    } else if (lastRt <= 6.35 || diff <= -0.35) {
      score -= 1.1;
      reasons.push(`นัดล่าสุด ${lastRt.toFixed(1)}`);
    } else if (avgRt !== null) {
      reasons.push(`เฉลี่ย ${avgRt.toFixed(2)}`);
    }
  } else if (avgRt !== null) {
    if (avgRt >= 7.25) {
      score += 1.6;
    } else if (avgRt >= 6.9) {
      score += 0.9;
    } else if (avgRt <= 6.05) {
      score -= 1.6;
    } else if (avgRt <= 6.35) {
      score -= 0.9;
    }
    reasons.push(`เฉลี่ย ${avgRt.toFixed(2)}`);
  }

  if (favBoost > 0) {
    score += 1.4;
    reasons.push(`ลูกรัก +${favBoost}`);
  }

  if (mental >= 78 && phys >= 74) {
    score += 0.9;
    reasons.push(`ใจ ${mental}/กาย ${phys} ดีมาก`);
  } else if (mental < 46 || phys < 46) {
    score -= 1.5;
    reasons.push(mental < phys ? `จิตใจต่ำ (${mental})` : `ร่างกายล้า (${phys})`);
  } else if (mental < 56 || phys < 54) {
    score -= 0.9;
    reasons.push(mental < phys ? `จิตใจแผ่ว (${mental})` : `ร่างกายแผ่ว (${phys})`);
  }

  if (fit < 58 && (player.inj || 0) === 0) {
    score -= 0.9;
    reasons.push(`ฟิต ${fit}%`);
  }

  const sp = player.sp || 0;
  const prod = (player.sg || 0) + (player.sa || 0);
  if (sp >= 3 && prod / sp >= 0.65) {
    score += 0.6;
  }

  let dir: FormTrendDir = 'flat';
  let label = 'ฟอร์มทรงตัว';
  if (score >= 2.1) {
    dir = 'hot';
    label = 'ฟอร์มพุ่งแรง';
  } else if (score >= 0.8) {
    dir = 'up';
    label = 'ฟอร์มขาขึ้น';
  } else if (score <= -2.1) {
    dir = 'cold';
    label = 'ฟอร์มตกหนัก';
  } else if (score <= -0.8) {
    dir = 'down';
    label = 'ฟอร์มตกลง';
  }

  const detailText = reasons.length > 0 ? reasons.join(' · ') : `ใจ ${mental} · กาย ${phys}`;
  return {
    dir,
    score: Math.round(score * 10) / 10,
    label,
    reason: `${label} (${detailText})`,
    lastRt,
    avgRt
  };
}

const TREND_STYLE: Record<
  FormTrendDir,
  {
    boxCls: string;
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    shortText: string;
  }
> = {
  hot: {
    boxCls: 'bg-emerald-500/18 border-emerald-500/50 text-emerald-700 dark:text-emerald-300',
    Icon: ChevronsUp,
    shortText: 'พุ่งแรง'
  },
  up: {
    boxCls: 'bg-emerald-500/12 border-emerald-500/35 text-emerald-600 dark:text-emerald-400',
    Icon: ArrowUpRight,
    shortText: 'ขาขึ้น'
  },
  flat: {
    boxCls: 'bg-[var(--surface-2)]/85 border-[var(--line)]/80 text-[var(--mut)]',
    Icon: ArrowRight,
    shortText: 'ทรงตัว'
  },
  down: {
    boxCls: 'bg-amber-500/15 border-amber-500/45 text-amber-700 dark:text-amber-300',
    Icon: ArrowDownRight,
    shortText: 'ตกลง'
  },
  cold: {
    boxCls: 'bg-rose-500/18 border-rose-500/50 text-rose-700 dark:text-rose-300',
    Icon: ChevronsDown,
    shortText: 'ตกหนัก'
  }
};

export const FormTrendBadge: React.FC<{
  trend: PlayerFormTrend;
  size?: 'xs' | 'sm';
  showLabel?: boolean;
  className?: string;
}> = ({ trend, size = 'xs', showLabel = false, className = '' }) => {
  const meta = TREND_STYLE[trend.dir];
  const Icon = meta.Icon;
  const sizeCls = showLabel
    ? size === 'sm'
      ? 'h-5 px-1.5 text-[10px] mland:text-[8.5px] gap-0.5 rounded-md'
      : 'h-[17px] px-1 text-[9px] mland:text-[7.5px] gap-0.5 rounded'
    : size === 'sm'
      ? 'w-5 h-5 mland:w-4 mland:h-4 rounded-md'
      : 'w-[17px] h-[17px] mland:w-[14px] mland:h-[14px] rounded-[5px]';
  const iconCls =
    size === 'sm'
      ? 'w-3.5 h-3.5 mland:w-3 mland:h-3 shrink-0'
      : 'w-3 h-3 mland:w-2.5 mland:h-2.5 shrink-0';

  return (
    <span
      title={trend.reason}
      aria-label={trend.reason}
      className={`inline-flex items-center justify-center border font-extrabold leading-none select-none shrink-0 ${meta.boxCls} ${sizeCls} ${className}`}
    >
      <Icon className={iconCls} strokeWidth={2.75} />
      {showLabel && <span className="whitespace-nowrap">{meta.shortText}</span>}
    </span>
  );
};
