declare function require(name: string): any;
declare const process: { cwd(): string };
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
import { evaluateEngineHealth } from '../src/engine/engineHealth';
import { generateTrainingPlan } from '../src/engine/planGenerator';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, PlanGeneratorInput, RaceType } from '../src/engine/planTypes';

const currentDate = '2026-07-10';
const outputDir = path.resolve(process.cwd(), 'engine-test-output');
const raceDistances: RaceType[] = ['5k', '10k', '15k', 'half_marathon', 'marathon'];
const raceGoals = ['First Race', 'Finish Comfortably', 'Personal Best', 'Race Competitively'];
const runwayWeeks = [6, 14, 24];
const currentWeeklyKm = [12, 32, 58];
const longestRunProfiles = [0.25, 0.38, 0.55];
const runsPerWeek: Array<3 | 4 | 5 | 6> = [3, 4, 5, 6];
const safeLongRunMax: Record<RaceType, number> = { '5k': 14, '10k': 18, '15k': 22, half_marathon: 28, marathon: 34 };

interface CaseRecord { caseId: string; input: PlanGeneratorInput; plan: GeneratedTrainingPlan; suspicious: string[]; }

function main() {
  mkdirSync(outputDir, { recursive: true });
  const cases = buildCases();
  writeCsv('plan-test-summary.csv', summaryRows(cases));
  writeCsv('plan-test-weeks.csv', weekRows(cases));
  writeCsv('plan-test-workouts.csv', workoutRows(cases));
  writeCsv('plan-test-health.csv', healthRows(cases));

  const suspicious = cases.flatMap((item) => item.suspicious.map((warning) => `${item.caseId}: ${warning}`));
  console.log(`Generated ${cases.length} deterministic plan cases in ${outputDir}`);
  console.log(`CSV files: plan-test-summary.csv, plan-test-weeks.csv, plan-test-workouts.csv, plan-test-health.csv`);
  const counts = raceDistances.map((race) => `${race}: ${cases.filter((item) => item.input.raceDistance === race).length}`).join(', ');
  console.log(`Race distance counts: ${counts}`);
  if (suspicious.length) {
    console.warn(`Suspicious patterns found (${suspicious.length}); review CSV outputs:`);
    suspicious.forEach((warning) => console.warn(`- ${warning}`));
  } else {
    console.log('No suspicious patterns found.');
  }
}

function buildCases(): CaseRecord[] {
  const selected: PlanGeneratorInput[] = [];
  let cursor = 0;
  for (const raceDistance of raceDistances) {
    for (const raceGoal of raceGoals) {
      for (const weeks of runwayWeeks) {
        for (const weeklyKm of currentWeeklyKm) {
          const runCount = runsPerWeek[cursor % runsPerWeek.length];
          const longRunKm = Math.max(3, Math.round(weeklyKm * longestRunProfiles[cursor % longestRunProfiles.length]));
          selected.push(makeInput(selected.length + 1, raceDistance, raceGoal, weeks, weeklyKm, longRunKm, runCount));
          cursor += 1;
        }
      }
    }
  }

  selected.push({ athleteName: 'Lauren PB Marathon', raceDistance: 'marathon', raceGoal: 'Personal Best', raceDate: addDays(currentDate, 14 * 7 - 2), currentWeeklyKm: 35, longestRunKm: 19, runsPerWeek: 4, currentDate });
  selected.push({ athleteName: 'Lauren Competitive Marathon', raceDistance: 'marathon', raceGoal: 'Race Competitively', raceDate: addDays(currentDate, 14 * 7 - 2), currentWeeklyKm: 35, longestRunKm: 19, runsPerWeek: 4, currentDate });

  return selected.map((input, index) => {
    const plan = generateTrainingPlan(input);
    const caseId = `CASE-${String(index + 1).padStart(3, '0')}`;
    return { caseId, input, plan, suspicious: suspiciousPatterns(plan) };
  });
}

function makeInput(index: number, raceDistance: RaceType, raceGoal: string, weeks: number, weeklyKm: number, longestRunKm: number, runCount: 3 | 4 | 5 | 6): PlanGeneratorInput {
  const raceDate = addDays(currentDate, weeks * 7 - 2);
  const milestoneDate = addDays(currentDate, Math.max(21, Math.floor(weeks * 7 * 0.62)));
  return {
    athleteName: `Test Athlete ${String(index).padStart(3, '0')}`,
    raceDistance,
    raceGoal,
    raceDate,
    currentWeeklyKm: weeklyKm,
    longestRunKm,
    runsPerWeek: runCount,
    currentDate,
    milestoneRaces: index % 5 === 0 ? [{ name: 'Tune-up race', date: milestoneDate, distance: raceDistance === 'marathon' ? 'half_marathon' : raceDistance }] : undefined,
  };
}

function suspiciousPatterns(plan: GeneratedTrainingPlan): string[] {
  const warnings: string[] = [];
  const longRuns = plan.weeks.flatMap((week) => week.foundationWorkouts.filter((workout) => workout.type === 'long_run'));
  const peakLongRun = max(longRuns.map((workout) => workout.plannedDistanceKm ?? 0));
  const peakWeeklyKm = max(plan.weeks.map((week) => week.targetDistanceRangeKm.max));
  const race = plan.inputs.raceDistance;
  if (race === 'marathon' && peakLongRun < 26) warnings.push(`marathon peak long run below 26km (${peakLongRun}km)`);
  if (race === 'half_marathon' && peakLongRun < 18) warnings.push(`half marathon peak long run below 18km (${peakLongRun}km)`);
  if (peakLongRun > safeLongRunMax[race]) warnings.push(`peak long run exceeds safe max (${peakLongRun}km > ${safeLongRunMax[race]}km)`);
  for (let index = 1; index < plan.weeks.length; index += 1) {
    const previous = plan.weeks[index - 1].targetDistanceRangeKm.max;
    const current = plan.weeks[index].targetDistanceRangeKm.max;
    if (previous > 0 && current / previous > 1.18) {
      const previousWeek = plan.weeks[index - 1];
      const currentWeek = plan.weeks[index];
      const weekBeforeRecovery = plan.weeks[index - 2]?.targetDistanceRangeKm.max;
      const isRecoveryBounce = previousWeek.weekType === 'recovery' && weekBeforeRecovery && current <= weekBeforeRecovery * 1.12;
      const isTaperOrRace = currentWeek.phase === 'taper' || currentWeek.weekType === 'race';
      if (!isRecoveryBounce && !isTaperOrRace) warnings.push(`weekly km jump too high before week ${currentWeek.weekNumber} (${previous}km to ${current}km)`);
    }
  }
  if (plan.weeks.length > 8 && !plan.weeks.some((week) => week.weekType === 'recovery')) warnings.push('no recovery weeks in plan longer than 8 weeks');
  if (plan.weeks.at(-1)?.weekType !== 'race') warnings.push('race week not marked as Race');
  const foundationCount = plan.summary.totalFoundationWorkouts;
  const optionalCount = plan.summary.totalOptionalWorkouts;
  if (optionalCount > foundationCount) warnings.push(`optional workouts exceed foundation workouts (${optionalCount} > ${foundationCount})`);
  if (plan.inputs.runsPerWeek === 3 && max(plan.weeks.map((week) => week.foundationWorkouts.length)) > 3) warnings.push('3-run plan generated more than 3 foundation workouts in a week');
  if (race === 'marathon' && peakLongRun < 24) warnings.push('marathon plan never reaches a meaningful long run');
  if (peakWeeklyKm < plan.inputs.currentWeeklyKm * 0.8) warnings.push(`peak weekly km unexpectedly below current volume (${peakWeeklyKm}km)`);
  return warnings;
}

function summaryRows(cases: CaseRecord[]): string[][] {
  return [[
    'caseId','athleteName','raceDistance','raceGoal','raceDate','weeksToRace','currentWeeklyKm','longestRunKm','runsPerWeek','totalFoundationWorkouts','totalOptionalWorkouts','estimatedKmMin','estimatedKmMax','estimatedMinutesMin','estimatedMinutesMax','peakWeeklyKmMax','peakLongRunKm','numberRecoveryWeeks','numberTaperWeeks','warningCount','warnings'
  ], ...cases.map(({ caseId, input, plan, suspicious }) => [
    caseId,input.athleteName,input.raceDistance,input.raceGoal,input.raceDate,String(plan.weeksFromNowToRaceWeek),String(input.currentWeeklyKm),String(input.longestRunKm),String(input.runsPerWeek),String(plan.summary.totalFoundationWorkouts),String(plan.summary.totalOptionalWorkouts),String(plan.summary.estimatedDistanceRangeKm.min),String(plan.summary.estimatedDistanceRangeKm.max),String(plan.summary.estimatedTimeRangeMin.min),String(plan.summary.estimatedTimeRangeMin.max),String(max(plan.weeks.map((week) => week.targetDistanceRangeKm.max))),String(max(plan.weeks.flatMap((week) => week.foundationWorkouts.map((workout) => workout.type === 'long_run' ? workout.plannedDistanceKm ?? 0 : 0)))),String(plan.weeks.filter((week) => week.weekType === 'recovery').length),String(plan.weeks.filter((week) => week.phase === 'taper').length),String(plan.warnings.length + suspicious.length),[...plan.warnings.map((warning) => warning.message), ...suspicious].join(' | ')
  ])];
}

function weekRows(cases: CaseRecord[]): string[][] {
  const header = ['caseId','raceDistance','raceGoal','weekNumber','phase','weekType','weekStart','weekEnd','targetKmMin','targetKmMax','targetMinutesMin','targetMinutesMax','longRunTitle','longRunKm','qualityTitle','foundationCount','optionalCount','warningCount','warnings'];
  const rows = cases.flatMap(({ caseId, input, plan }) => plan.weeks.map((week) => {
    const longRun = week.foundationWorkouts.find((workout) => workout.type === 'long_run');
    const quality = week.foundationWorkouts.find((workout) => workout.type === 'quality_session' || workout.type === 'race');
    return [caseId,input.raceDistance,input.raceGoal,String(week.weekNumber),week.phase,week.weekType,week.startsOn,week.endsOn,String(week.targetDistanceRangeKm.min),String(week.targetDistanceRangeKm.max),String(week.targetDurationRangeMin.min),String(week.targetDurationRangeMin.max),longRun?.title ?? '',String(longRun?.plannedDistanceKm ?? ''),quality?.title ?? '',String(week.foundationWorkouts.length),String(week.optionalWorkouts.length),String(week.warnings.length),week.warnings.join(' | ')];
  }));
  return [header, ...rows];
}

function healthRows(cases: CaseRecord[]): string[][] {
  const header = ['caseId','raceDistance','raceGoal','weeksToRace','currentWeeklyKm','longestRunKm','runsPerWeek','achievedPeakLongRunKm','peakLongRunWeek','targetPeakLongRunMin','targetPeakLongRunMax','longRunTargetMet','achievedPeakWeeklyKm','targetPeakWeeklyKmMin','targetPeakWeeklyKmMax','weeklyVolumeTargetMet','recoveryWeeksPresent','taperPresent','raceWeekPresent','foundationCountValid','suspiciousWarningCount','engineScore','engineGrade','issues'];
  const rows = cases.map(({ caseId, plan }) => {
    const h = evaluateEngineHealth(plan, caseId);
    return [h.caseId,h.raceDistance,h.raceGoal,String(h.weeksToRace),String(h.currentWeeklyKm),String(h.longestRunKm),String(h.runsPerWeek),String(h.peakLongRunKm),String(h.peakLongRunWeek),String(h.targetPeakLongRunMin),String(h.targetPeakLongRunMax),String(h.longRunTargetMet),String(h.peakWeeklyKm),String(h.targetPeakWeeklyKmMin),String(h.targetPeakWeeklyKmMax),String(h.weeklyVolumeTargetMet),String(h.recoveryWeeksPresent),String(h.taperPresent),String(h.raceWeekPresent),String(h.foundationCountValid),String(h.suspiciousWarningCount),String(h.engineScore),h.engineGrade,h.issues];
  });
  return [header, ...rows];
}

function workoutRows(cases: CaseRecord[]): string[][] {
  const header = ['caseId','raceDistance','raceGoal','weekNumber','phase','weekType','category','type','title','suggestedDay','plannedDistanceKm','plannedDurationMin','intensity','purpose'];
  const rows = cases.flatMap(({ caseId, input, plan }) => plan.weeks.flatMap((week) => [...week.foundationWorkouts, ...week.optionalWorkouts].map((workout) => workoutRow(caseId, input, week, workout))));
  return [header, ...rows];
}

function workoutRow(caseId: string, input: PlanGeneratorInput, week: GeneratedTrainingWeek, workout: GeneratedWorkout): string[] {
  return [caseId,input.raceDistance,input.raceGoal,String(week.weekNumber),week.phase,week.weekType,workout.category,workout.type,workout.title,workout.suggestedDay,String(workout.plannedDistanceKm ?? ''),String(workout.plannedDurationMin ?? ''),workout.intensity,workout.purpose];
}

function writeCsv(fileName: string, rows: string[][]) { writeFileSync(path.join(outputDir, fileName), rows.map((row) => row.map(csvEscape).join(',')).join('\n')); }
function csvEscape(value: string) { return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value; }
function max(values: number[]) { return values.length ? Math.max(...values) : 0; }
function addDays(isoDate: string, days: number) { const date = new Date(`${isoDate}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }

main();
