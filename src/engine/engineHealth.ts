import { parseIsoDate, startOfTrainingWeek } from './dateHelpers';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, PlanGeneratorMilestoneRace } from './planTypes';
import { goalKey, peakLongRunTargets, peakWeeklyTargets, raceDistanceKm } from './targets';
import { planTemplates } from './trainingTemplates';

export type EngineGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type RunwayClassification = 'SHORT' | 'COMPRESSED' | 'NORMAL' | 'LONG';

export interface EngineHealthRow {
  caseId: string; raceDistance: string; raceGoal: string; weeksToRace: number; currentWeeklyKm: number; longestRunKm: number; runsPerWeek: number; achievedPeakLongRunKm: number; peakLongRunKm: number; peakLongRunWeek: number; targetPeakLongRunMin: number; targetPeakLongRunMax: number; longRunTargetMet: boolean; achievedPeakWeeklyKm: number; peakWeeklyKm: number; targetPeakWeeklyKmMin: number; targetPeakWeeklyKmMax: number; weeklyVolumeTargetMet: boolean; maxOrdinaryWeekIncreasePercent: number; maxBuildToBuildIncreasePercent: number; maxRecoveryBouncePercent: number; runwayClassification: RunwayClassification; recoveryWeeksPresent: boolean; taperPresent: boolean; raceWeekPresent: boolean; foundationCountValid: boolean; intermediateRaceSupportPresent: boolean; intermediateRacePrimary: boolean; intermediateRaceConflictFree: boolean; intermediateRaceLongRunValid: boolean; intermediateRaceRecoveryValid: boolean; destinationProgressionResumed: boolean; intermediateRaceSupportValid: boolean; qualityProgressionValid: boolean; duplicateQualityWeeks: string; marathonSpecificSessionCount: number; suspiciousWarningCount: number; engineScore: number; engineGrade: EngineGrade; issues: string; warnings: string;
}

const SAFE_BUILD_TO_BUILD_PERCENT = 12;
const SAFE_RECOVERY_BOUNCE_PERCENT = 18;

export function evaluateEngineHealth(plan: GeneratedTrainingPlan, caseId = plan.id): EngineHealthRow {
  const input = plan.inputs;
  const key = goalKey(input.raceGoal);
  const longTarget = peakLongRunTargets[input.raceDistance][key];
  const weeklyTarget = peakWeeklyTargets[input.raceDistance][key];
  const longRunByWeek = plan.weeks.map((week) => ({ weekNumber: week.weekNumber, km: max(week.foundationWorkouts.map((workout) => workout.type === 'long_run' ? workout.plannedDistanceKm ?? 0 : 0)) }));
  const achievedPeakLongRunKm = max(longRunByWeek.map((week) => week.km));
  const peakLongRunWeek = longRunByWeek.find((week) => week.km === achievedPeakLongRunKm)?.weekNumber ?? 0;
  const achievedPeakWeeklyKm = max(plan.weeks.map((week) => week.targetDistanceRangeKm.max));
  const issues: string[] = [];
  const healthWarnings = plan.warnings.map((warning) => warning.message);
  const longRunTargetMet = isWithinRange(achievedPeakLongRunKm, longTarget.min, longTarget.max);
  const weeklyVolumeTargetMet = isWithinRange(achievedPeakWeeklyKm, weeklyTarget.min, weeklyTarget.max);
  const progression = progressionMetrics(plan.weeks);
  const runwayClassification = classifyRunway(input.raceDistance, plan.weeksFromNowToRaceWeek);
  const recoveryWeeksPresent = plan.weeks.length <= 8 || plan.weeks.some((week) => week.weekType === 'recovery');
  const taperPresent = plan.weeks.some((week) => week.phase === 'taper');
  const raceWeekPresent = plan.weeks.at(-1)?.weekType === 'race';
  const foundationCountValid = plan.weeks.every((week) => week.foundationWorkouts.length <= input.runsPerWeek || week.weekType === 'race');
  const hasRaceSpecific = !['marathon', 'half_marathon'].includes(input.raceDistance) || !plan.warnings.some((warning) => ['marathon_specific_missing', 'half_specific_missing', 'no_quality_progression'].includes(warning.id));
  const fuelPracticeOk = input.raceDistance !== 'marathon' || achievedPeakLongRunKm < 24 || !plan.warnings.some((warning) => warning.id === 'marathon_fuel_practice_missing');
  const intermediate = intermediateRaceValidation(plan);
  const qualityProgression = validateQualityProgression(plan);

  if (!longRunTargetMet) issues.push(`peak long run ${achievedPeakLongRunKm}km outside target ${longTarget.min}-${longTarget.max}km`);
  if (!weeklyVolumeTargetMet) issues.push(`peak weekly ${achievedPeakWeeklyKm}km outside target ${weeklyTarget.min}-${weeklyTarget.max}km`);
  if (progression.maxBuildToBuildIncreasePercent > SAFE_BUILD_TO_BUILD_PERCENT) issues.push(`build-to-build increase ${progression.maxBuildToBuildIncreasePercent}% exceeds ${SAFE_BUILD_TO_BUILD_PERCENT}%`);
  if (progression.maxRecoveryBouncePercent > SAFE_RECOVERY_BOUNCE_PERCENT && progression.maxBuildToBuildIncreasePercent > SAFE_BUILD_TO_BUILD_PERCENT) issues.push(`recovery rebound ${progression.maxRecoveryBouncePercent}% is excessive in build context`);
  if (!hasRaceSpecific) issues.push('missing race-specific work');
  if (!fuelPracticeOk) issues.push('missing marathon fuel practice');
  if (!recoveryWeeksPresent) issues.push('missing recovery week');
  if (!taperPresent) issues.push('missing taper');
  if (!raceWeekPresent) issues.push('missing race week');
  if (!foundationCountValid) issues.push('too many foundation runs for selected run frequency');
  if (!qualityProgression.qualityProgressionValid) issues.push(...qualityProgression.issues);
  issues.push(...intermediate.issues);
  healthWarnings.push(...intermediate.warnings);

  const suspiciousWarningCount = plan.warnings.filter((warning) => warning.severity === 'caution').length + issues.length;
  let score = 100;
  if (!raceWeekPresent) score -= 24;
  if (!taperPresent) score -= 18;
  if (!recoveryWeeksPresent) score -= 14;
  if (!foundationCountValid) score -= 14;
  if (!longRunTargetMet) score -= 18;
  if (!weeklyVolumeTargetMet) score -= 16;
  if (progression.maxBuildToBuildIncreasePercent > SAFE_BUILD_TO_BUILD_PERCENT) score -= 12;
  if (!hasRaceSpecific) score -= 8;
  if (!fuelPracticeOk) score -= 6;
  if ((input.milestoneRaces?.length ?? 0) > 0 && !intermediate.intermediateRaceSupportValid) score -= 10;
  score -= Math.min(10, plan.warnings.filter((warning) => warning.severity === 'caution').length * 1);
  const engineScore = Math.max(0, Math.round(score));
  return { caseId, raceDistance: input.raceDistance, raceGoal: input.raceGoal, weeksToRace: plan.weeksFromNowToRaceWeek, currentWeeklyKm: input.currentWeeklyKm, longestRunKm: input.longestRunKm, runsPerWeek: input.runsPerWeek, achievedPeakLongRunKm, peakLongRunKm: achievedPeakLongRunKm, peakLongRunWeek, targetPeakLongRunMin: longTarget.min, targetPeakLongRunMax: longTarget.max, longRunTargetMet, achievedPeakWeeklyKm, peakWeeklyKm: achievedPeakWeeklyKm, targetPeakWeeklyKmMin: weeklyTarget.min, targetPeakWeeklyKmMax: weeklyTarget.max, weeklyVolumeTargetMet, ...progression, runwayClassification, recoveryWeeksPresent, taperPresent, raceWeekPresent, foundationCountValid, intermediateRaceSupportPresent: intermediate.intermediateRaceSupportPresent, intermediateRacePrimary: intermediate.intermediateRacePrimary, intermediateRaceConflictFree: intermediate.intermediateRaceConflictFree, intermediateRaceLongRunValid: intermediate.intermediateRaceLongRunValid, intermediateRaceRecoveryValid: intermediate.intermediateRaceRecoveryValid, destinationProgressionResumed: intermediate.destinationProgressionResumed, intermediateRaceSupportValid: intermediate.intermediateRaceSupportValid, qualityProgressionValid: qualityProgression.qualityProgressionValid, duplicateQualityWeeks: qualityProgression.duplicateWeeks.join(','), marathonSpecificSessionCount: qualityProgression.marathonSpecificSessionCount, suspiciousWarningCount, engineScore, engineGrade: grade(engineScore), issues: issues.join(' | '), warnings: healthWarnings.join(' | ') };
}

export function isWithinRange(value: unknown, min: unknown, max: unknown) { return Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && (value as number) >= (min as number) && (value as number) <= (max as number); }
export function grade(score: number): EngineGrade { if (score >= 90) return 'A'; if (score >= 80) return 'B'; if (score >= 70) return 'C'; if (score >= 60) return 'D'; return 'F'; }
export function classifyRunway(raceDistance: GeneratedTrainingPlan['inputs']['raceDistance'], weeks: number): RunwayClassification { const template = planTemplates.find((item) => item.race === raceDistance); if (!template || weeks < template.minimumWeeks - 2) return 'SHORT'; if (weeks < template.preferredWeeks) return 'COMPRESSED'; if (weeks <= template.maximumWeeks) return 'NORMAL'; return 'LONG'; }

export function validateQualityProgression(plan: GeneratedTrainingPlan): { qualityProgressionValid: boolean; duplicateWeeks: number[]; marathonSpecificSessionCount: number; issues: string[] } {
  const duplicateWeeks: number[] = [];
  for (let index = 1; index < plan.weeks.length; index += 1) {
    const previous = plan.weeks[index - 1], current = plan.weeks[index];
    if (!normalProgressionWeek(previous) || !normalProgressionWeek(current)) continue;
    const previousQuality = primaryQuality(previous), currentQuality = primaryQuality(current);
    if (previousQuality && currentQuality && qualitySignature(previousQuality) === qualitySignature(currentQuality)) duplicateWeeks.push(current.weekNumber);
  }
  const marathonSpecificSessionCount = plan.weeks.filter((week) => week.phase === 'specific' || week.phase === 'peak').flatMap((week) => week.foundationWorkouts).filter((workout) => /(^|[^-])marathon effort|marathon-effort/i.test(`${workout.title} ${workout.mainSet}`)).length;
  const issues = duplicateWeeks.length ? [`Duplicate primary quality sessions in normal progression weeks: ${duplicateWeeks.join(',')}.`] : [];
  if (plan.inputs.raceDistance === 'marathon' && plan.weeks.length >= 10 && marathonSpecificSessionCount === 0) issues.push('Marathon plan lacks marathon-specific quality work.');
  return { qualityProgressionValid: issues.length === 0, duplicateWeeks, marathonSpecificSessionCount, issues };
}

function normalProgressionWeek(week: GeneratedTrainingWeek) { return week.weekType === 'normal' && week.phase !== 'taper' && week.phase !== 'race_week' && !week.foundationWorkouts.some((workout) => workout.type === 'race'); }
function primaryQuality(week: GeneratedTrainingWeek) { return week.foundationWorkouts.find((workout) => workout.type === 'quality_session'); }
function qualitySignature(workout: GeneratedWorkout) { return `${categoryForQuality(workout)}|${workout.mainSet}|${workout.intensity}`.toLowerCase().replace(/\s+/g, ' ').trim(); }
function categoryForQuality(workout: GeneratedWorkout) { return /marathon/.test(`${workout.title} ${workout.mainSet}`) ? 'marathon' : /half-marathon/.test(`${workout.title} ${workout.mainSet}`) ? 'half' : /threshold|cruise/.test(`${workout.title} ${workout.mainSet}`) ? 'threshold' : /hill/.test(`${workout.title} ${workout.mainSet}`) ? 'hills' : /vo2|race/.test(`${workout.title} ${workout.mainSet}`) ? 'race-pace' : /stride/.test(`${workout.title} ${workout.mainSet}`) ? 'strides' : workout.type; }

function progressionMetrics(weeks: GeneratedTrainingWeek[]) {
  let maxOrdinaryWeekIncreasePercent = 0, maxBuildToBuildIncreasePercent = 0, maxRecoveryBouncePercent = 0;
  let previousBuildKm = isBuildWeek(weeks[0]) ? weeks[0].targetDistanceRangeKm.max : undefined;
  for (let index = 1; index < weeks.length; index += 1) {
    const previous = weeks[index - 1], current = weeks[index];
    const previousKm = previous.targetDistanceRangeKm.max, currentKm = current.targetDistanceRangeKm.max;
    if (previousKm > 0) maxOrdinaryWeekIncreasePercent = Math.max(maxOrdinaryWeekIncreasePercent, percent(previousKm, currentKm));
    if (previous.weekType === 'recovery' && previousKm > 0) maxRecoveryBouncePercent = Math.max(maxRecoveryBouncePercent, percent(previousKm, currentKm));
    if (isBuildWeek(current)) {
      if (previousBuildKm !== undefined && previousBuildKm > 0) maxBuildToBuildIncreasePercent = Math.max(maxBuildToBuildIncreasePercent, percent(previousBuildKm, currentKm));
      previousBuildKm = currentKm;
    }
  }
  return { maxOrdinaryWeekIncreasePercent: round(maxOrdinaryWeekIncreasePercent), maxBuildToBuildIncreasePercent: round(maxBuildToBuildIncreasePercent), maxRecoveryBouncePercent: round(maxRecoveryBouncePercent) };
}
function isBuildWeek(week: GeneratedTrainingWeek | undefined) { return !!week && week.weekType !== 'recovery' && week.weekType !== 'race' && week.phase !== 'taper'; }
function percent(from: number, to: number) { return ((to - from) / from) * 100; }
function round(value: number) { return Math.round(value * 10) / 10; }
function max(values: number[]) { return values.filter(Number.isFinite).length ? Math.max(...values.filter(Number.isFinite)) : 0; }

type IntermediateRaceHealth = Pick<EngineHealthRow, 'intermediateRaceSupportPresent' | 'intermediateRacePrimary' | 'intermediateRaceConflictFree' | 'intermediateRaceLongRunValid' | 'intermediateRaceRecoveryValid' | 'destinationProgressionResumed' | 'intermediateRaceSupportValid'> & { issues: string[]; warnings: string[] };

function intermediateRaceValidation(plan: GeneratedTrainingPlan): IntermediateRaceHealth {
  const milestones = (plan.inputs.milestoneRaces ?? []).map((race) => ({ race, week: weekForMilestone(plan.weeks, race) })).filter((item): item is { race: PlanGeneratorMilestoneRace; week: GeneratedTrainingWeek } => !!item.week && item.week.weekType !== 'race');
  if (!milestones.length) return neutralIntermediateRaceHealth();
  const issues: string[] = [], warnings: string[] = [];
  let primary = true, conflictFree = true, longRunValid = true, recoveryValid = true, progressionResumed = true, supportPresent = true;
  const finalRaceWeek = plan.weeks.at(-1);
  const finalTaperWeeks = plan.weeks.filter((week) => week.phase === 'taper').map((week) => week.weekNumber);

  for (const { race, week } of milestones) {
    const tier = raceDemandTier(race.distance);
    const raceKm = raceDistanceKm[race.distance];
    const raceWorkouts = week.foundationWorkouts.filter((workout) => workout.type === 'race' && approx(workout.plannedDistanceKm, raceKm));
    const weekSupportPresent = raceWorkouts.length === 1 && nonRaceKm(week) < surroundingNormalLoad(plan.weeks, week.weekNumber) * supportLoadCeiling(tier);
    if (!weekSupportPresent) { supportPresent = false; issues.push('Intermediate race support week was not applied with an appropriate local workload reduction.'); }
    if (!week.coachingMessage.includes('key effort')) { supportPresent = false; issues.push('Intermediate race week is not recognised as a local support week.'); }

    const racePrimary = raceWorkouts.length === 1 && isHard(raceWorkouts[0]) && primaryWorkout(week)?.type === 'race' && !duplicatedRaceDistance(week, raceKm);
    if (!racePrimary) { primary = false; issues.push('Intermediate race is not the primary weekly stimulus.'); }

    const competingHard = competingHardSessions(week, raceKm, tier);
    if (competingHard > 0) { conflictFree = false; issues.push('Intermediate race week retains a competing major quality session.'); }

    const separateLong = week.foundationWorkouts.find((workout) => workout.type === 'long_run');
    if (separateLong && tier >= 3) { longRunValid = false; issues.push('Half-marathon race week includes a separate traditional long run.'); }
    else if (separateLong && tier === 2 && (separateLong.plannedDistanceKm ?? 0) > 12) { longRunValid = false; issues.push('10 km or 15 km race week includes an uncompromised separate long run.'); }
    else if (separateLong && tier === 1 && (separateLong.plannedDistanceKm ?? 0) > 16) warnings.push('Short race week retains a long run; review placement and recovery.');

    const next = plan.weeks[week.weekNumber];
    if (next && !recoveryIsProportionate(plan.weeks, week, next, tier)) { recoveryValid = false; issues.push('Post-race recovery is insufficient for the scheduled race demand.'); }
    if (tier >= 4) warnings.push('Intermediate marathon creates substantial recovery cost within the destination build.');

    const resumed = !!finalRaceWeek && finalRaceWeek.weekType === 'race' && finalRaceWeek.weekNumber > week.weekNumber && finalTaperWeeks.every((weekNumber) => weekNumber > week.weekNumber) && plan.weeks.slice(week.weekNumber + 1).some((later) => ['specific', 'peak'].includes(later.phase) || (later.weekNumber > week.weekNumber + 1 && later.weekType === 'normal'));
    if (!resumed) { progressionResumed = false; issues.push(finalTaperWeeks.some((weekNumber) => weekNumber <= week.weekNumber) ? 'Intermediate race support has consumed the final destination taper.' : 'Destination progression does not resume after the intermediate race.'); }
  }

  const intermediateRaceSupportValid = supportPresent && primary && conflictFree && longRunValid && recoveryValid && progressionResumed;
  return { intermediateRaceSupportPresent: supportPresent, intermediateRacePrimary: primary, intermediateRaceConflictFree: conflictFree, intermediateRaceLongRunValid: longRunValid, intermediateRaceRecoveryValid: recoveryValid, destinationProgressionResumed: progressionResumed, intermediateRaceSupportValid, issues, warnings };
}

function neutralIntermediateRaceHealth(): IntermediateRaceHealth { return { intermediateRaceSupportPresent: false, intermediateRacePrimary: true, intermediateRaceConflictFree: true, intermediateRaceLongRunValid: true, intermediateRaceRecoveryValid: true, destinationProgressionResumed: true, intermediateRaceSupportValid: true, issues: [], warnings: [] }; }
function weekForMilestone(weeks: GeneratedTrainingWeek[], race: PlanGeneratorMilestoneRace) { const date = parseIsoDate(race.date); return weeks.find((week) => date >= startOfTrainingWeek(parseIsoDate(week.startsOn)) && date <= parseIsoDate(week.endsOn)); }
function raceDemandTier(race: PlanGeneratorMilestoneRace['distance']) { const km = raceDistanceKm[race]; return km >= 42 ? 4 : km >= 21 ? 3 : km >= 10 ? 2 : 1; }
function supportLoadCeiling(tier: number) { return tier >= 4 ? 0.64 : tier === 3 ? 0.72 : tier === 2 ? 0.84 : 0.94; }
function nonRaceKm(week: GeneratedTrainingWeek) { return sum(week.foundationWorkouts.filter((workout) => workout.type !== 'race').map((workout) => workout.plannedDistanceKm ?? 0)); }
function surroundingNormalLoad(weeks: GeneratedTrainingWeek[], weekNumber: number) { const nearby = weeks.filter((week) => Math.abs(week.weekNumber - weekNumber) <= 3 && week.weekNumber !== weekNumber && isBuildWeek(week)); return max(nearby.map((week) => nonRaceKm(week) || week.targetDistanceRangeKm.max)); }
function primaryWorkout(week: GeneratedTrainingWeek): GeneratedWorkout | undefined { return [...week.foundationWorkouts].sort((a, b) => workoutDemandKm(b) - workoutDemandKm(a))[0]; }
function workoutDemandKm(workout: GeneratedWorkout) { return (workout.plannedDistanceKm ?? 0) * (workout.type === 'race' ? 1.4 : workout.type === 'quality_session' ? 1.2 : 1); }
function isHard(workout: GeneratedWorkout) { return workout.type === 'race' || workout.type === 'quality_session' || /finish|race simulation|marathon effort|controlled-hard|comfortably hard|race specific|VO2|threshold|tempo|hill/i.test(`${workout.title} ${workout.intensity} ${workout.mainSet}`); }
function competingHardSessions(week: GeneratedTrainingWeek, raceKm: number, tier: number) { return week.foundationWorkouts.filter((workout) => workout.type !== 'race' && (workout.type === 'quality_session' || (tier >= 3 && workout.type === 'long_run') || duplicatedRaceWork(workout, raceKm))).length; }
function duplicatedRaceDistance(week: GeneratedTrainingWeek, raceKm: number) { return week.foundationWorkouts.filter((workout) => approx(workout.plannedDistanceKm, raceKm)).length > 1; }
function duplicatedRaceWork(workout: GeneratedWorkout, raceKm: number) { return workout.type !== 'race' && approx(workout.plannedDistanceKm, raceKm) && /race|simulation|effort/i.test(`${workout.title} ${workout.mainSet}`); }
function recoveryIsProportionate(weeks: GeneratedTrainingWeek[], raceWeek: GeneratedTrainingWeek, next: GeneratedTrainingWeek, tier: number) { if (tier === 1) return true; const following = weeks[raceWeek.weekNumber + 1]; const loadOk = next.targetDistanceRangeKm.max <= surroundingNormalLoad(weeks, raceWeek.weekNumber) * (tier >= 3 ? 0.86 : 0.95); const hardCount = next.foundationWorkouts.filter(isHard).length; const hardOk = tier >= 3 ? hardCount <= 1 && !next.foundationWorkouts.some((workout) => workout.type === 'quality_session' && /threshold|VO2|hill|marathon effort|half-marathon effort|race-effort|tempo|2 x 20|3 x 10/i.test(`${workout.title} ${workout.mainSet}`)) : hardCount <= 1; const resumes = !following || following.targetDistanceRangeKm.max >= next.targetDistanceRangeKm.max; return loadOk && hardOk && resumes; }
function approx(value: number | undefined, target: number) { return value !== undefined && Math.abs(value - target) < 0.2; }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
