import type { Player } from '../types/game';

export type SortDir = 'asc' | 'desc';

/**
 * Compares two players by fitness & availability status (best/fittest first):
 * 1. Ready/healthy players (no injury, no suspension) ordered by highest stamina (`fit`)
 * 2. Suspended-only players ordered by fewest matches left, then stamina
 * 3. Injured players ordered by fewest matches left, then stamina
 */
export function comparePlayerFitnessStatus(a: Player, b: Player, dir: SortDir = 'desc'): number {
  const statusRank = (p: Player): number => {
    if (p.inj > 0) return 0;
    if ((p.sus || 0) > 0) return 1;
    return 2;
  };

  let cmp = 0;
  const rankDiff = statusRank(b) - statusRank(a);
  if (rankDiff !== 0) {
    cmp = rankDiff;
  } else if (a.inj > 0 && b.inj > 0 && a.inj !== b.inj) {
    cmp = a.inj - b.inj;
  } else if ((a.sus || 0) !== (b.sus || 0)) {
    cmp = (a.sus || 0) - (b.sus || 0);
  } else {
    const fitDiff = Math.round(b.fit ?? 100) - Math.round(a.fit ?? 100);
    cmp = fitDiff !== 0 ? fitDiff : b.ov - a.ov;
  }

  return dir === 'asc' ? -cmp : cmp;
}
