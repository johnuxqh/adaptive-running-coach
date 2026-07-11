import { daysBetween, getTrainingWeekDates, parseIsoDate, startOfTrainingWeek } from './dateHelpers';
import { buildPlanSummary } from './planSummary';
import { finalisePlanIntegrity } from './planValidation';
import { goalKey, peakLongRunTargets, peakWeeklyTargets, raceDistanceKm, targetForRunway } from './targets';
import { planTemplates } from './trainingTemplates';
import { buildWorkouts } from './workoutBuilder';
import { getCoachingMessage, getPhaseForWeek, getWeekType } from './weekBuilder';
import { createPlanWarnings, milestoneWarning, type PlanWarning } from './warnings';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, PlanGeneratorInput, PlanGeneratorMilestoneRace } from './planTypes';

const MAX_WEEKLY_INCREASE = 1.1;
const SHORT_RUNWAY_INCREASE = 1.06;
const DISTANCE_RANGE = 0.08;
const MINUTES_PER_KM = 6.5;
const LONG_RUN_SHARE_CAP = 0.44;

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
  const key = goalKey(input.raceGoal);
  const longRunRange = peakLongRunTargets[input.raceDistance][key];
  const weeklyRange = peakWeeklyTargets[input.raceDistance][key];
  const progressionRate = weekDates.length < template.preferredWeeks ? SHORT_RUNWAY_INCREASE : MAX_WEEKLY_INCREASE;
  const peakWeekIndex = Math.max(0, weekDates.length - (input.raceDistance === 'marathon' ? 4 : input.raceDistance === 'half_marathon' ? 3 : 2));
  const buildWeeks = Math.max(1, peakWeekIndex);
  const strongThreshold = weeklyRange.min * 0.85;
  let targetPeakLongRun = targetForRunway(longRunRange, weekDates.length, template.preferredWeeks, input.currentWeeklyKm, strongThreshold);
  let targetPeakWeeklyKm = targetForRunway(weeklyRange, weekDates.length, template.preferredWeeks, input.currentWeeklyKm, strongThreshold);
  const startingLongRun = Math.min(Math.max(3, input.longestRunKm), longRunRange.max);
  const longRunCeiling = startingLongRun * Math.pow(input.raceDistance === 'marathon' ? 1.105 : 1.11, buildWeeks);
  const weeklyCeiling = Math.max(5, input.currentWeeklyKm) * Math.pow(progressionRate, buildWeeks);
  if (longRunCeiling < longRunRange.min) targetPeakLongRun = Math.max(startingLongRun, Math.min(targetPeakLongRun, longRunCeiling));
  if (weeklyCeiling < weeklyRange.min) targetPeakWeeklyKm = Math.max(input.currentWeeklyKm, Math.min(targetPeakWeeklyKm, weeklyCeiling));
  targetPeakWeeklyKm = Math.max(targetPeakWeeklyKm, targetPeakLongRun / LONG_RUN_SHARE_CAP);
  addDestinationWarnings(baseWarnings, input, weekDates.length, targetPeakLongRun, targetPeakWeeklyKm, longRunRange.min, weeklyRange.min);

  const weeks: GeneratedTrainingWeek[] = weekDates.map((dates, index) => {
    const weekNumber = index + 1;
    const phase = getPhaseForWeek(weekNumber, weekDates.length, input.raceDistance);
    const weekType = getWeekType(weekNumber, weekDates.length, phase);
    const progress = peakWeekIndex <= 0 ? 1 : Math.min(1, index / peakWeekIndex);
    const shape = Math.pow(progress, 0.85);
    let weeklyKm = input.currentWeeklyKm + (targetPeakWeeklyKm - input.currentWeeklyKm) * shape;
    let longRunKm = startingLongRun + (targetPeakLongRun - startingLongRun) * shape;

    if (weekType === 'recovery') {
      weeklyKm *= phase === 'taper' ? (weekNumber === weekDates.length - 1 ? 0.62 : 0.76) : 0.78;
      longRunKm *= phase === 'taper' ? (weekNumber === weekDates.length - 1 ? 0.55 : 0.7) : 0.75;
    }
    if (weekType === 'race') {
      weeklyKm = Math.max(input.currentWeeklyKm * 0.35, targetPeakWeeklyKm * 0.42);
      longRunKm = raceDistanceKm[input.raceDistance];
    }
    const shareCap = input.raceDistance === 'marathon' ? 0.48 : LONG_RUN_SHARE_CAP;
    if (weekType !== 'race' && longRunKm > weeklyKm * shareCap) weeklyKm = longRunKm / shareCap;
    weeklyKm = Math.max(5, weeklyKm);
    longRunKm = Math.max(3, longRunKm);

    const milestone = milestoneForWeek(input.milestoneRaces ?? [], dates.startsOn, dates.endsOn);
    const workouts = buildWorkouts({ race: input.raceDistance, raceGoal: input.raceGoal, weekNumber, phase, weekType, weeklyKm, longRunKm, runsPerWeek: input.runsPerWeek, milestone, raceDate: input.raceDate });
    if (milestone) baseWarnings.push(milestoneWarning(weekNumber));

    const minKm = weeklyKm * (1 - DISTANCE_RANGE);
    const maxKm = weeklyKm * (1 + DISTANCE_RANGE);
    return { id: `week-${weekNumber}`, weekNumber, startsOn: dates.startsOn, endsOn: dates.endsOn, phase, weekType, targetDistanceRangeKm: { min: Math.round(minKm), max: Math.round(maxKm) }, targetDurationRangeMin: { min: Math.round(minKm * MINUTES_PER_KM), max: Math.round(maxKm * MINUTES_PER_KM) }, foundationWorkouts: workouts.foundation, optionalWorkouts: workouts.optional, coachingMessage: milestone ? `${getCoachingMessage(phase, weekType)} Treat the milestone as this week's key effort.` : getCoachingMessage(phase, weekType), warnings: workouts.warnings };
  });

  addWorkoutRealismWarnings(baseWarnings, input, weeks);

  const peakLongRun = Math.max(...weeks.flatMap((week) => week.foundationWorkouts.map((workout) => workout.type === 'long_run' ? workout.plannedDistanceKm ?? 0 : 0)));
  const peakWeekly = Math.max(...weeks.map((week) => week.targetDistanceRangeKm.max));
  if (peakLongRun < longRunRange.min) baseWarnings.push({ id: 'target_long_run_not_met', severity: 'caution', message: `Peak long run ${peakLongRun}km is below the ${longRunRange.min}-${longRunRange.max}km destination target; treat this as an under-target plan.` });
  if (peakWeekly < weeklyRange.min) baseWarnings.push({ id: 'target_weekly_volume_not_met', severity: 'caution', message: `Peak weekly volume ${peakWeekly}km is below the ${weeklyRange.min}-${weeklyRange.max}km destination target.` });

  const plan = { id: `plan-${input.athleteName.toLowerCase().replace(/\s+/g, '-')}-${input.raceDate}`, inputs: input, weeksFromNowToRaceWeek: weeks.length, weeks, warnings: baseWarnings, summary: buildPlanSummary(input, weeks, daysUntilRace, template.emphasis, baseWarnings) };
  const checkedPlan = finalisePlanIntegrity(plan);
  return { ...checkedPlan, summary: buildPlanSummary(input, checkedPlan.weeks, daysUntilRace, template.emphasis, checkedPlan.warnings) };
}

function milestoneForWeek(milestones: PlanGeneratorMilestoneRace[], startsOn: string, endsOn: string): PlanGeneratorMilestoneRace | undefined {
  const start = startOfTrainingWeek(parseIsoDate(startsOn));
  const end = parseIsoDate(endsOn);
  return milestones.find((race) => { const date = parseIsoDate(race.date); return date >= start && date <= end; });
}


function addDestinationWarnings(warnings: PlanWarning[], input: PlanGeneratorInput, weeks: number, targetLongRun: number, targetWeeklyKm: number, minLongRun: number, minWeeklyKm: number) {
  if (weeks < 8) warnings.push({ id: 'runway_too_short', severity: 'caution', message: 'Runway is very short, so the plan may safely under-target destination volume.' });
  if (input.raceDistance === 'marathon' && weeks < 12) warnings.push({ id: 'marathon_under_12_weeks', severity: 'caution', message: 'Marathon plans under 12 weeks are maintenance/survival plans rather than full builds.' });
  if (input.longestRunKm < minLongRun * 0.55) warnings.push({ id: 'current_long_run_too_low', severity: 'caution', message: 'Current long run is well below the destination demand; progression is capped.' });
  if (targetLongRun < minLongRun) warnings.push({ id: 'long_run_under_target', severity: 'caution', message: 'Available runway and starting fitness mean the peak long run is intentionally under the target range.' });
  if (targetWeeklyKm < minWeeklyKm) warnings.push({ id: 'weekly_volume_under_target', severity: 'caution', message: 'Available runway and starting fitness mean peak weekly volume is below the target range.' });
  if (targetWeeklyKm > input.currentWeeklyKm * 1.65 || targetLongRun > input.longestRunKm * 1.65) warnings.push({ id: 'aggressive_progression_required', severity: 'caution', message: 'Aggressive progression is required to approach the destination targets; listen closely to fatigue signals.' });
  if (input.runsPerWeek <= 3) warnings.push({ id: 'limited_runs_per_week', severity: 'caution', message: 'Limited runs per week constrains safe weekly volume and long-run support.' });
  if (goalKey(input.raceGoal) === 'competitive' && input.currentWeeklyKm < minWeeklyKm * 0.75) warnings.push({ id: 'competitive_low_starting_volume', severity: 'caution', message: 'Competitive goal starts from relatively low volume, so expectations should be adjusted.' });
}


function addWorkoutRealismWarnings(warnings: PlanWarning[], input: PlanGeneratorInput, weeks: GeneratedTrainingWeek[]) {
  const qualityByWeek = weeks.map((week) => ({ week, quality: week.foundationWorkouts.find((workout) => workout.type === 'quality_session') }));
  let repeated = 0;
  for (let index = 1; index < qualityByWeek.length; index += 1) {
    const current = qualityByWeek[index];
    const previous = qualityByWeek[index - 1];
    if (current.quality?.title && current.quality.title === previous.quality?.title && current.week.weekType === 'normal' && previous.week.weekType === 'normal') repeated += 1;
  }
  if (repeated > 1) warnings.push({ id: 'quality_repeated_too_often', severity: 'info', message: 'Some quality sessions repeat across normal weeks; review load if the athlete needs more variety.' });

  const buildSpecificQuality = qualityByWeek.filter(({ week }) => week.phase === 'build' || week.phase === 'specific').map(({ quality }) => quality?.mainSet ?? '').join(' | ');
  if (!/threshold|marathon|half|race|VO2|hill|tempo/i.test(buildSpecificQuality)) warnings.push({ id: 'no_quality_progression', severity: 'caution', message: 'Build and Specific phases show limited quality progression.' });
  if (input.raceDistance === 'marathon' && !weeks.some((week) => week.phase === 'specific' && week.foundationWorkouts.some((workout) => /marathon effort|marathon-effort/i.test(`${workout.title} ${workout.mainSet}`)))) warnings.push({ id: 'marathon_specific_missing', severity: 'caution', message: 'Marathon Specific phase contains no marathon-effort work.' });
  if (input.raceDistance === 'marathon' && !weeks.some((week) => week.foundationWorkouts.some((workout) => /Fuel Practice/i.test(workout.title)))) warnings.push({ id: 'marathon_fuel_practice_missing', severity: 'caution', message: 'Marathon plan contains no fuel-practice long run.' });
  if (input.raceDistance === 'half_marathon' && !weeks.some((week) => week.phase === 'specific' && week.foundationWorkouts.some((workout) => /half-marathon|race effort|race-effort/i.test(`${workout.title} ${workout.mainSet}`)))) warnings.push({ id: 'half_specific_missing', severity: 'caution', message: 'Half-marathon Specific phase contains no race-specific work.' });

  weeks.forEach((week) => {
    const weekText = week.foundationWorkouts.map((workout) => `${workout.title} ${workout.mainSet}`).join(' | ');
    if (week.weekType === 'recovery' && /fast finish|race-pace finish|race simulation|marathon-effort finish/i.test(weekText)) week.warnings.push('Recovery week contains a demanding long-run finish.');
    if (week.phase === 'taper' && week.foundationWorkouts.filter((workout) => workout.type === 'quality_session').some((workout) => /20 min|15 min|3 x 10|2 x 15|VO2/i.test(workout.mainSet))) week.warnings.push('Taper contains excessive quality.');
    if (week.phase === 'race_week' && week.foundationWorkouts.filter((workout) => workout.type === 'quality_session').length > 1) week.warnings.push('Race week contains excessive fatigue.');
    const hardDays = week.foundationWorkouts.filter((workout) => workout.type === 'quality_session' || (/finish|race simulation|marathon effort/i.test(`${workout.title} ${workout.mainSet}`) && workout.type === 'long_run')).map((workout) => workout.suggestedDay);
    if (hardDays.includes('Wednesday') && hardDays.includes('Thursday')) week.warnings.push('Hard sessions are assigned on consecutive days; keep the secondary session controlled or move it.');
  });
}
