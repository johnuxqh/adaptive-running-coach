import type { GeneratedTrainingPlan, GeneratedTrainingWeek } from './planTypes';
import { goalKey, peakLongRunTargets, peakWeeklyTargets } from './targets';
import { planTemplates } from './trainingTemplates';

export type EngineGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type RunwayClassification = 'SHORT' | 'COMPRESSED' | 'NORMAL' | 'LONG';

export interface EngineHealthRow {
  caseId: string; raceDistance: string; raceGoal: string; weeksToRace: number; currentWeeklyKm: number; longestRunKm: number; runsPerWeek: number; achievedPeakLongRunKm: number; peakLongRunKm: number; peakLongRunWeek: number; targetPeakLongRunMin: number; targetPeakLongRunMax: number; longRunTargetMet: boolean; achievedPeakWeeklyKm: number; peakWeeklyKm: number; targetPeakWeeklyKmMin: number; targetPeakWeeklyKmMax: number; weeklyVolumeTargetMet: boolean; maxOrdinaryWeekIncreasePercent: number; maxBuildToBuildIncreasePercent: number; maxRecoveryBouncePercent: number; runwayClassification: RunwayClassification; recoveryWeeksPresent: boolean; taperPresent: boolean; raceWeekPresent: boolean; foundationCountValid: boolean; suspiciousWarningCount: number; engineScore: number; engineGrade: EngineGrade; issues: string; warnings: string;
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
  score -= Math.min(10, plan.warnings.filter((warning) => warning.severity === 'caution').length * 1);
  const engineScore = Math.max(0, Math.round(score));
  return { caseId, raceDistance: input.raceDistance, raceGoal: input.raceGoal, weeksToRace: plan.weeksFromNowToRaceWeek, currentWeeklyKm: input.currentWeeklyKm, longestRunKm: input.longestRunKm, runsPerWeek: input.runsPerWeek, achievedPeakLongRunKm, peakLongRunKm: achievedPeakLongRunKm, peakLongRunWeek, targetPeakLongRunMin: longTarget.min, targetPeakLongRunMax: longTarget.max, longRunTargetMet, achievedPeakWeeklyKm, peakWeeklyKm: achievedPeakWeeklyKm, targetPeakWeeklyKmMin: weeklyTarget.min, targetPeakWeeklyKmMax: weeklyTarget.max, weeklyVolumeTargetMet, ...progression, runwayClassification, recoveryWeeksPresent, taperPresent, raceWeekPresent, foundationCountValid, suspiciousWarningCount, engineScore, engineGrade: grade(engineScore), issues: issues.join(' | '), warnings: healthWarnings.join(' | ') };
}

export function isWithinRange(value: unknown, min: unknown, max: unknown) { return Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && (value as number) >= (min as number) && (value as number) <= (max as number); }
export function grade(score: number): EngineGrade { if (score >= 90) return 'A'; if (score >= 80) return 'B'; if (score >= 70) return 'C'; if (score >= 60) return 'D'; return 'F'; }
export function classifyRunway(raceDistance: GeneratedTrainingPlan['inputs']['raceDistance'], weeks: number): RunwayClassification { const template = planTemplates.find((item) => item.race === raceDistance); if (!template || weeks < template.minimumWeeks - 2) return 'SHORT'; if (weeks < template.preferredWeeks) return 'COMPRESSED'; if (weeks <= template.maximumWeeks) return 'NORMAL'; return 'LONG'; }

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
