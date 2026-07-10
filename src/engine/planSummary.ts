import type { GeneratedPlanSummary, GeneratedTrainingWeek, PlanGeneratorInput, RaceType } from './planTypes';
import type { PlanWarning } from './warnings';

export function buildPlanSummary(input: PlanGeneratorInput, weeks: GeneratedTrainingWeek[], daysUntilRace: number, emphasis: string[], warnings: PlanWarning[]): GeneratedPlanSummary {
  const totals = weeks.reduce(
    (sum, week) => ({
      foundation: sum.foundation + week.foundationWorkouts.length,
      optional: sum.optional + week.optionalWorkouts.length,
      minKm: sum.minKm + week.targetDistanceRangeKm.min,
      maxKm: sum.maxKm + week.targetDistanceRangeKm.max,
      minMin: sum.minMin + week.targetDurationRangeMin.min,
      maxMin: sum.maxMin + week.targetDurationRangeMin.max,
    }),
    { foundation: 0, optional: 0, minKm: 0, maxKm: 0, minMin: 0, maxMin: 0 },
  );

  return {
    athleteName: input.athleteName,
    raceDistance: input.raceDistance as RaceType,
    raceDate: input.raceDate,
    daysUntilRace,
    trainingWeeks: weeks.length,
    totalFoundationWorkouts: totals.foundation,
    totalOptionalWorkouts: totals.optional,
    estimatedDistanceRangeKm: { min: Math.round(totals.minKm), max: Math.round(totals.maxKm) },
    estimatedTimeRangeMin: { min: Math.round(totals.minMin), max: Math.round(totals.maxMin) },
    planEmphasis: emphasis,
    planWarnings: warnings.map((warning) => warning.message),
    rules: ['Protect the long run', 'Easy means easy', 'Avoid stacking hard sessions', 'Missing one run is not failure', 'Optional means optional'],
  };
}
