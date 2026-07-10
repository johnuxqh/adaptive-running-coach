import type { GeneratedTrainingPlan } from './planTypes';
import { goalKey, peakLongRunTargets, peakWeeklyTargets } from './targets';

export interface EngineHealthRow {
  caseId: string; raceDistance: string; raceGoal: string; weeksToRace: number; currentWeeklyKm: number; longestRunKm: number; runsPerWeek: number; peakLongRunKm: number; targetPeakLongRunMin: number; targetPeakLongRunMax: number; longRunTargetMet: boolean; peakWeeklyKm: number; targetPeakWeeklyKmMin: number; targetPeakWeeklyKmMax: number; weeklyVolumeTargetMet: boolean; recoveryWeeksPresent: boolean; taperPresent: boolean; raceWeekPresent: boolean; foundationCountValid: boolean; suspiciousWarningCount: number; engineScore: number; engineGrade: string; issues: string;
}

export function evaluateEngineHealth(plan: GeneratedTrainingPlan, caseId = plan.id): EngineHealthRow {
  const input = plan.inputs;
  const key = goalKey(input.raceGoal);
  const longTarget = peakLongRunTargets[input.raceDistance][key];
  const weeklyTarget = peakWeeklyTargets[input.raceDistance][key];
  const peakLongRun = max(plan.weeks.flatMap((week) => week.foundationWorkouts.map((workout) => workout.type === 'long_run' ? workout.plannedDistanceKm ?? 0 : 0)));
  const peakWeekly = max(plan.weeks.map((week) => week.targetDistanceRangeKm.max));
  const issues: string[] = [];
  const reasonable = input.longestRunKm >= longTarget.min * 0.55 && input.currentWeeklyKm >= weeklyTarget.min * 0.6 && plan.weeksFromNowToRaceWeek >= 10;
  const longRunTargetMet = peakLongRun >= longTarget.min || !reasonable;
  const weeklyVolumeTargetMet = peakWeekly >= weeklyTarget.min || !reasonable;
  const recoveryWeeksPresent = plan.weeks.length <= 8 || plan.weeks.some((week) => week.weekType === 'recovery');
  const taperPresent = plan.weeks.some((week) => week.phase === 'taper');
  const raceWeekPresent = plan.weeks.at(-1)?.weekType === 'race';
  const foundationCountValid = plan.weeks.every((week) => week.foundationWorkouts.length <= input.runsPerWeek || week.weekType === 'race');
  if (!longRunTargetMet) issues.push(`peak long run ${peakLongRun}km below target ${longTarget.min}-${longTarget.max}km`);
  if (!weeklyVolumeTargetMet) issues.push(`peak weekly ${peakWeekly}km below target ${weeklyTarget.min}-${weeklyTarget.max}km`);
  if (!recoveryWeeksPresent) issues.push('missing recovery week');
  if (!taperPresent) issues.push('missing taper');
  if (!raceWeekPresent) issues.push('missing race week');
  if (!foundationCountValid) issues.push('too many foundation runs for selected run frequency');
  const suspiciousWarningCount = plan.warnings.filter((warning) => warning.severity === 'caution').length + issues.length;
  let score = 100;
  if (!longRunTargetMet) score -= 22;
  if (!weeklyVolumeTargetMet) score -= 16;
  if (!recoveryWeeksPresent) score -= 12;
  if (!taperPresent) score -= 12;
  if (!raceWeekPresent) score -= 18;
  if (!foundationCountValid) score -= 10;
  score -= Math.min(15, plan.warnings.filter((warning) => warning.severity === 'caution').length * 2);
  const engineScore = Math.max(0, score);
  return { caseId, raceDistance: input.raceDistance, raceGoal: input.raceGoal, weeksToRace: plan.weeksFromNowToRaceWeek, currentWeeklyKm: input.currentWeeklyKm, longestRunKm: input.longestRunKm, runsPerWeek: input.runsPerWeek, peakLongRunKm: peakLongRun, targetPeakLongRunMin: longTarget.min, targetPeakLongRunMax: longTarget.max, longRunTargetMet, peakWeeklyKm: peakWeekly, targetPeakWeeklyKmMin: weeklyTarget.min, targetPeakWeeklyKmMax: weeklyTarget.max, weeklyVolumeTargetMet, recoveryWeeksPresent, taperPresent, raceWeekPresent, foundationCountValid, suspiciousWarningCount, engineScore, engineGrade: grade(engineScore), issues: issues.join(' | ') };
}
function grade(score: number) { if (score >= 90) return 'excellent'; if (score >= 80) return 'acceptable'; if (score >= 60) return 'review needed'; return 'fail'; }
function max(values: number[]) { return values.length ? Math.max(...values) : 0; }
