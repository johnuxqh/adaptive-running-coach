import type { RaceType } from './planTypes';

export type GoalKey = 'first' | 'finish' | 'pb' | 'competitive';
export interface TargetRange { min: number; max: number; }

export function goalKey(goal: string): GoalKey {
  const normalised = goal.toLowerCase();
  if (normalised.includes('competitive')) return 'competitive';
  if (normalised.includes('personal') || normalised === 'pb') return 'pb';
  if (normalised.includes('finish')) return 'finish';
  return 'first';
}

export const peakLongRunTargets: Record<RaceType, Record<GoalKey, TargetRange>> = {
  '5k': { first: { min: 8, max: 12 }, finish: { min: 10, max: 14 }, pb: { min: 12, max: 16 }, competitive: { min: 14, max: 18 } },
  '10k': { first: { min: 12, max: 16 }, finish: { min: 14, max: 18 }, pb: { min: 16, max: 20 }, competitive: { min: 18, max: 22 } },
  '15k': { first: { min: 16, max: 20 }, finish: { min: 18, max: 22 }, pb: { min: 20, max: 24 }, competitive: { min: 22, max: 26 } },
  half_marathon: { first: { min: 18, max: 22 }, finish: { min: 20, max: 24 }, pb: { min: 22, max: 28 }, competitive: { min: 24, max: 30 } },
  marathon: { first: { min: 26, max: 30 }, finish: { min: 28, max: 32 }, pb: { min: 30, max: 34 }, competitive: { min: 32, max: 36 } },
};

export const peakWeeklyTargets: Record<RaceType, Record<GoalKey, TargetRange>> = {
  '5k': { first: { min: 20, max: 35 }, finish: { min: 25, max: 40 }, pb: { min: 30, max: 50 }, competitive: { min: 40, max: 60 } },
  '10k': { first: { min: 25, max: 40 }, finish: { min: 30, max: 45 }, pb: { min: 40, max: 60 }, competitive: { min: 50, max: 75 } },
  '15k': { first: { min: 30, max: 45 }, finish: { min: 35, max: 55 }, pb: { min: 45, max: 70 }, competitive: { min: 55, max: 85 } },
  half_marathon: { first: { min: 35, max: 55 }, finish: { min: 40, max: 65 }, pb: { min: 50, max: 80 }, competitive: { min: 65, max: 95 } },
  marathon: { first: { min: 45, max: 65 }, finish: { min: 50, max: 75 }, pb: { min: 60, max: 90 }, competitive: { min: 70, max: 105 } },
};

export function targetForRunway(range: TargetRange, weeks: number, preferredWeeks: number, current: number, strongThreshold: number): number {
  const runway = weeks >= preferredWeeks + 6 ? 0.75 : weeks >= preferredWeeks ? 0.45 : weeks >= Math.max(8, preferredWeeks - 6) ? 0.35 : -0.15;
  const strong = current >= strongThreshold ? 0.15 : 0;
  const fraction = Math.max(-0.25, Math.min(0.9, runway + strong));
  return range.min + (range.max - range.min) * fraction;
}

export const raceDistanceKm: Record<RaceType, number> = { '5k': 5, '10k': 10, '15k': 15, half_marathon: 21.1, marathon: 42.2 };
