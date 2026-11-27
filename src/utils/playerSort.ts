import type { Player } from '../types/game';

/**
 * Compares two players by fitness & availability status:
 * 1. Ready/healthy players (no injury, no suspension) ordered by highest stamina (`fit`)
 * 2. Suspended-only players ordered by fewest matches left, then stamina
 * 3. Injured players ordered by fewest matches left, then stamina
 */
export function comparePlayerFitnessStatus(a: Player, b: Player): number {
  const statusRank = (p: Player): number => {
    if (p.inj > 0) return 0;
    if ((p.sus || 0) > 0) return 1;
    return 2;
  };

  const rankDiff = statusRank(b) - statusRank(a);
  if (rankDiff !== 0) return rankDiff;

  if (a.inj > 0 && b.inj > 0 && a.inj !== b.inj) {
    return a.inj - b.inj;
  }
  if ((a.sus || 0) !== (b.sus || 0)) {
    return (a.sus || 0) - (b.sus || 0);
  }

  const fitDiff = Math.round(b.fit ?? 100) - Math.round(a.fit ?? 100);
  if (fitDiff !== 0) return fitDiff;

  return b.ov - a.ov;
}
