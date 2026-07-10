import { daysBetween, getTrainingWeekDates, parseIsoDate, startOfTrainingWeek } from './dateHelpers';
import { buildPlanSummary } from './planSummary';
import { planTemplates } from './trainingTemplates';
import { buildWorkouts } from './workoutBuilder';
import { getCoachingMessage, getPhaseForWeek, getVolumeMultiplier, getWeekType } from './weekBuilder';
import { createPlanWarnings, milestoneWarning } from './warnings';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, PlanGeneratorInput, PlanGeneratorMilestoneRace } from './planTypes';

const MAX_WEEKLY_INCREASE = 1.08;
const SHORT_RUNWAY_INCREASE = 1.04;
const DISTANCE_RANGE = 0.08;
const MINUTES_PER_KM = 6.5;
const LONG_RUN_MAX_KM: Record<string, number> = { '5k': 14, '10k': 18, '15k': 22, half_marathon: 28, marathon: 34 };
const LONG_RUN_SHARE_CAP = 0.38;

export const laurenSamplePlanInput: PlanGeneratorInput = {
  athleteName: 'Lauren',
  raceDistance: 'marathon',
  raceDate: '2026-10-11',
  raceGoal: 'Personal Best',
  currentWeeklyKm: 35,
  longestRunKm: 19,
  runsPerWeek: 4,
  currentDate: '2026-07-10',
  milestoneRaces: [{ name: 'Half Marathon milestone', date: '2026-07-21', distance: 'half_marathon' }],
};

export function generateTrainingPlan(input: PlanGeneratorInput): GeneratedTrainingPlan {
  const today = input.currentDate ? parseIsoDate(input.currentDate) : new Date();
  const raceDate = parseIsoDate(input.raceDate);
  const template = planTemplates.find((item) => item.race === input.raceDistance);
  if (!template) throw new Error(`Unsupported race distance: ${input.raceDistance}`);

  const weekDates = getTrainingWeekDates(today, raceDate);
  const daysUntilRace = daysBetween(today, raceDate);
  const baseWarnings = createPlanWarnings({ weeks: weekDates.length, template, longestRunKm: input.longestRunKm, currentWeeklyKm: input.currentWeeklyKm, raceGoal: input.raceGoal });
  const progressionRate = weekDates.length < template.preferredWeeks ? SHORT_RUNWAY_INCREASE : MAX_WEEKLY_INCREASE;

  let previousKm = Math.max(5, input.currentWeeklyKm);
  let previousLongRun = Math.max(3, input.longestRunKm);
  const weeks: GeneratedTrainingWeek[] = weekDates.map((dates, index) => {
    const weekNumber = index + 1;
    const phase = getPhaseForWeek(weekNumber, weekDates.length, input.raceDistance);
    const weekType = getWeekType(weekNumber, weekDates.length, phase);
    const multiplier = getVolumeMultiplier(weekNumber, weekDates.length, phase, weekType);
    const progressedKm = weekNumber === 1 ? previousKm : previousKm * progressionRate;
    const weeklyKm = Math.max(5, progressedKm * multiplier);
    const cappedWeeklyKm = weekType === 'recovery' || weekType === 'race' ? weeklyKm : Math.min(weeklyKm, previousKm * MAX_WEEKLY_INCREASE);
    previousKm = cappedWeeklyKm;

    const longRunCap = Math.min(LONG_RUN_MAX_KM[input.raceDistance], cappedWeeklyKm * LONG_RUN_SHARE_CAP);
    const longRunGrowth = weekType === 'recovery' || phase === 'taper' || weekType === 'race' ? 0.78 : 1.1;
    const longRunKm = Math.max(3, Math.min(longRunCap, previousLongRun * longRunGrowth));
    previousLongRun = longRunKm;

    const milestone = milestoneForWeek(input.milestoneRaces ?? [], dates.startsOn, dates.endsOn);
    const workouts = buildWorkouts({ race: input.raceDistance, weekNumber, phase, weekType, weeklyKm: cappedWeeklyKm, longRunKm, runsPerWeek: input.runsPerWeek, milestone, raceDate: input.raceDate });
    if (milestone) baseWarnings.push(milestoneWarning(weekNumber));

    const minKm = cappedWeeklyKm * (1 - DISTANCE_RANGE);
    const maxKm = cappedWeeklyKm * (1 + DISTANCE_RANGE);
    return {
      id: `week-${weekNumber}`,
      weekNumber,
      startsOn: dates.startsOn,
      endsOn: dates.endsOn,
      phase,
      weekType,
      targetDistanceRangeKm: { min: Math.round(minKm), max: Math.round(maxKm) },
      targetDurationRangeMin: { min: Math.round(minKm * MINUTES_PER_KM), max: Math.round(maxKm * MINUTES_PER_KM) },
      foundationWorkouts: workouts.foundation,
      optionalWorkouts: workouts.optional,
      coachingMessage: milestone ? `${getCoachingMessage(phase, weekType)} Treat the milestone as this week's key effort.` : getCoachingMessage(phase, weekType),
      warnings: workouts.warnings,
    };
  });

  return {
    id: `plan-${input.athleteName.toLowerCase().replace(/\s+/g, '-')}-${input.raceDate}`,
    inputs: input,
    weeksFromNowToRaceWeek: weeks.length,
    weeks,
    warnings: baseWarnings,
    summary: buildPlanSummary(input, weeks, daysUntilRace, template.emphasis, baseWarnings),
  };
}

function milestoneForWeek(milestones: PlanGeneratorMilestoneRace[], startsOn: string, endsOn: string): PlanGeneratorMilestoneRace | undefined {
  const start = startOfTrainingWeek(parseIsoDate(startsOn));
  const end = parseIsoDate(endsOn);
  return milestones.find((race) => {
    const date = parseIsoDate(race.date);
    return date >= start && date <= end;
  });
}
