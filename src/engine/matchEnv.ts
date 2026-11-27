import { clamp } from '../utils/math';
import { getAiTeamStadiumStyleId, getStadiumStyleSpec, getTurfGradeForLevel } from '../data/crestAndKitData';
import type { GameState, MatchEnvironment, MatchPitchPuddle, StadiumStyleId, Team } from '../types/game';
import { getFacilityCondition } from './simulation';

export type MatchFixtureKind = 'league' | 'cup' | 'asia' | 'lc' | 'sc' | 'dc' | 'nt';

export function buildMatchEnvironment(
  homeOrig: Team,
  kind: MatchFixtureKind,
  meIsHome: boolean,
  state: GameState
): MatchEnvironment {
  const season: 'rainy' | 'summer' = Math.random() < 0.5 ? 'rainy' : 'summer';
  const timeOfDay: 'day' | 'night' = Math.random() < 0.5 ? 'night' : 'day';
  const clubSeed = (homeOrig.id + 1) * 97 + (homeOrig.name?.length || 5) * 31;
  let turfLv = 4;
  let turfCond = 90;
  let effectiveCond = 90;

  if (meIsHome && kind !== 'nt') {
    turfLv = clamp(state.turfLv ?? 1, 0, 10);
    turfCond = turfLv <= 0 ? 40 : getFacilityCondition(state, 'turfLv');
    const deficitPenalty = state.money < -30 ? 14 : state.money < 0 ? 7 : 0;
    effectiveCond = clamp(turfCond - deficitPenalty, 30, 100);
  } else if (kind === 'asia' || kind === 'sc' || kind === 'nt') {
    turfLv = homeOrig.tier >= 2 || kind === 'nt' ? 9 : 8;
    turfCond = 96;
    effectiveCond = 96;
  } else {
    const avgOv = Math.round(homeOrig.sq.reduce((s, q) => s + q.ov, 0) / Math.max(1, homeOrig.sq.length));
    const budgetBoost =
      homeOrig.tier === 2
        ? clamp(Math.round((avgOv - 66) / 3), -1, 3)
        : homeOrig.tier === 1
          ? clamp(Math.round((avgOv - 57) / 3), -1, 2)
          : clamp(Math.round((avgOv - 49) / 3), -1, 2);
    turfLv =
      homeOrig.tier === 2
        ? clamp(6 + budgetBoost + (clubSeed % 3), 4, 10)
        : homeOrig.tier === 1
          ? clamp(2 + budgetBoost + (clubSeed % 4), 1, 7)
          : clamp(budgetBoost + (clubSeed % 4), 0, 4);
    turfCond = clamp(68 + ((clubSeed + state.md * 7) % 28) - (season === 'rainy' ? 6 : 0) + homeOrig.tier * 4, 46, 100);
    effectiveCond = turfCond;
  }

  const turfSpecInit = getTurfGradeForLevel(turfLv, effectiveCond);
  const grassLength: 'short' | 'medium' | 'long' =
    turfLv >= 6 && effectiveCond >= 72
      ? 'short'
      : turfLv <= 1 || effectiveCond < 58
        ? 'long'
        : effectiveCond < 70 || (!meIsHome && clubSeed % 4 === 0 && turfLv <= 4)
          ? 'long'
          : turfLv >= 4 && effectiveCond >= 84
            ? 'short'
            : 'medium';

  const rawDirtMix =
    turfLv <= 0
      ? 0.82
      : turfLv === 1
        ? clamp(0.42 + (100 - effectiveCond) * 0.0055, 0.34, 0.78)
        : turfLv <= 3
          ? clamp(0.14 + Math.max(0, 82 - effectiveCond) * 0.006, 0.06, 0.5)
          : turfLv <= 6
            ? effectiveCond < 72
              ? clamp((74 - effectiveCond) * 0.0085, 0.05, 0.32)
              : 0
            : effectiveCond < 58
              ? clamp((60 - effectiveCond) * 0.007, 0.04, 0.22)
              : 0;
  const dirtMix = Number(clamp(rawDirtMix + (season === 'rainy' && rawDirtMix > 0 ? 0.08 : 0), 0, 0.92).toFixed(2));

  const stadiumStyle: StadiumStyleId =
    kind === 'sc' || kind === 'nt'
      ? 'modern_bowl'
      : meIsHome && state.mode === 'm'
        ? state.club?.stadiumStyle || 'open_track'
        : getAiTeamStadiumStyleId(homeOrig.id, homeOrig.name, homeOrig.tier);
  const styleSpec = getStadiumStyleSpec(stadiumStyle);

  const rawPuddleCount =
    season === 'rainy'
      ? Math.min(7, turfSpecInit.maxPuddles + (turfSpecInit.maxPuddles > 0 && effectiveCond < 70 ? 1 : 0))
      : 0;
  const puddleCount =
    styleSpec.rainShield === 'full'
      ? 0
      : styleSpec.rainShield === 'partial'
        ? Math.floor(rawPuddleCount * 0.5)
        : rawPuddleCount;
  const puddles: MatchPitchPuddle[] =
    puddleCount > 0
      ? Array.from({ length: puddleCount }, () => ({
          x: 12 + Math.random() * 76,
          y: 12 + Math.random() * 76,
          rx: 2.3 + Math.random() * 2.5,
          ry: 1.4 + Math.random() * 1.6,
          rot: (Math.random() - 0.5) * 1.4,
          alpha: 0.14 + Math.random() * 0.1
        }))
      : [];

  return {
    season,
    timeOfDay,
    puddles,
    sunAngle: 0.25 + Math.random() * 0.4,
    turfGrade: turfSpecInit.id,
    turfCond: effectiveCond,
    grassLength,
    dirtMix,
    pitchSeed: clubSeed,
    stadiumStyle
  };
}

export function getStadiumDisplayName(
  homeOrig: Team,
  kind: MatchFixtureKind,
  meIsHome: boolean,
  state: GameState
): string {
  if (kind === 'nt') {
    return meIsHome ? 'ราชมังคลากีฬาสถาน (ทีมชาติไทย)' : `สนามกีฬาแห่งชาติ (${homeOrig.name})`;
  }
  if (meIsHome && state.mode === 'm' && state.club?.std?.trim()) {
    return state.club.std.trim();
  }
  if (kind === 'sc') {
    return 'สนามราชมังคลากีฬาสถาน (สนามกลาง)';
  }
  return `สนามเหย้า ${homeOrig.name}`;
}
