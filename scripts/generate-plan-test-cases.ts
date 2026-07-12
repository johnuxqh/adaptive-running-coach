declare function require(name: string): any;
declare const process: { cwd(): string };
const { mkdirSync, writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
import { classifyRunway, evaluateEngineHealth, grade, isWithinRange, validateQualityProgression } from '../src/engine/engineHealth';
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
  const outputs = writeAuditExports(cases);
  runValidationAssertions(cases);
  const integrity = verifyIntegrity(outputs);
  const deterministic = JSON.stringify(outputs) === JSON.stringify({ summary: summaryRows(cases), weeks: weekRows(cases), workouts: workoutRows(cases), health: healthRows(cases) });
  assert(deterministic, 'audit export generation must be deterministic for the same inputs');
  const report = corpusReport(cases, outputs);
  writeManifest(cases, outputs, integrity, deterministic);
  createValidationBundle();

  const suspicious = cases.flatMap((item) => item.suspicious.map((warning) => `${item.caseId}: ${warning}`));
  console.log(`Generated ${cases.length} deterministic plan cases in ${outputDir}`);
  console.log(`CSV files: plan-test-summary.csv, plan-test-weeks.csv, plan-test-workouts.csv, plan-test-health.csv, validation-manifest.txt, life-fit-full-validation.zip`);
  printCorpusReport(report);
  printLaurenSummary(cases, 'Lauren PB Marathon');
  printLaurenSummary(cases, 'Lauren Competitive Marathon');
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


function runValidationAssertions(cases: CaseRecord[]) {
  assert(isWithinRange(30, 30, 34) === true, 'exact long-run minimum must meet target');
  assert(isWithinRange(34, 30, 34) === true, 'exact long-run maximum must meet target');
  assert(isWithinRange(29.9, 30, 34) === false, 'below long-run minimum must miss target');
  assert(isWithinRange(32, 30, 34) === true, 'inside long-run range must meet target');
  assert(isWithinRange(34.1, 30, 34) === false, 'above long-run maximum must miss target');
  assert(grade(90) === 'A' && grade(100) === 'A', 'A grade boundaries must be 90-100');
  assert(grade(89) === 'B' && grade(80) === 'B', 'B grade boundaries must be 80-89');
  assert(grade(79) === 'C' && grade(70) === 'C', 'C grade boundaries must be 70-79');
  assert(grade(69) === 'D' && grade(60) === 'D', 'D grade boundaries must be 60-69');
  assert(grade(59) === 'F', 'F grade boundary must be below 60');
  assert(classifyRunway('marathon', 13) === 'SHORT', '13-week marathon is below minimum viable duration');
  assert(classifyRunway('marathon', 15) === 'COMPRESSED', '15-week marathon is compressed but workable');
  assert(classifyRunway('marathon', 16) === 'COMPRESSED', '16-week marathon is compressed but workable');
  assert(classifyRunway('marathon', 20) === 'NORMAL', 'preferred marathon duration is normal');

  const health = cases.map(({ caseId, plan }) => evaluateEngineHealth(plan, caseId));
  for (const row of health) {
    assert(row.longRunTargetMet === isWithinRange(row.achievedPeakLongRunKm, row.targetPeakLongRunMin, row.targetPeakLongRunMax), `${row.caseId} longRunTargetMet contradicts numeric range`);
    assert(row.weeklyVolumeTargetMet === isWithinRange(row.achievedPeakWeeklyKm, row.targetPeakWeeklyKmMin, row.targetPeakWeeklyKmMax), `${row.caseId} weeklyVolumeTargetMet contradicts numeric range`);
  }
  assert(health.some((row) => (!row.longRunTargetMet || !row.weeklyVolumeTargetMet) && row.engineScore < 80), 'major target misses must reduce score below excellent/good');
  assert(health.some((row) => row.engineGrade === 'D' || row.engineGrade === 'F'), 'structurally or coaching-weak plans must be able to receive D/F');
  assert(health.some((row) => row.raceWeekPresent && row.taperPresent && (!row.longRunTargetMet || !row.weeklyVolumeTargetMet) && (row.engineGrade === 'C' || row.engineGrade === 'B')), 'structurally sound constrained plans may receive C/B');
  const lauren = health.filter((row) => row.caseId === 'CASE-181' || row.caseId === 'CASE-182');
  assert(lauren.every((row) => row.runwayClassification !== 'SHORT' && !row.warnings.includes('Race day is close')), 'Lauren-style marathon runway must not be labelled race day is close');
  const laurenPb = cases.find((item) => item.input.athleteName === 'Lauren PB Marathon');
  const laurenCompetitive = cases.find((item) => item.input.athleteName === 'Lauren Competitive Marathon');
  if (!laurenPb || !laurenCompetitive) throw new Error('Lauren marathon validation cases must exist');
  assert(validateFinalMarathonTaper(laurenPb.plan, 30).valid, 'Lauren PB Marathon must keep a 30km+ peak and progressive final taper');
  assert(validateQualityProgression(laurenPb.plan).qualityProgressionValid, 'Lauren PB Marathon must avoid duplicate normal-week primary quality and include marathon progression');
  assert(earlyQuality(laurenPb.plan), 'Lauren PB Marathon early quality must be introductory');
  assert(validateQualityProgression(laurenCompetitive.plan).qualityProgressionValid, 'Lauren Competitive Marathon must avoid duplicate normal-week primary quality and include marathon progression');
  assert(validateFinalMarathonTaper(laurenCompetitive.plan, 32).valid, 'Lauren Competitive Marathon must keep a 32km+ peak and progressive final taper');
  printQualityAudit('Lauren PB Marathon', laurenPb.plan);
  printQualityAudit('Lauren Competitive Marathon', laurenCompetitive.plan);
  validateNegativeQualityDuplicate(laurenPb.plan);
  const duplicateTaperPlan = clonePlanWithDuplicateTaper(laurenPb.plan);
  assert(!validateFinalMarathonTaper(duplicateTaperPlan, 30).valid, 'duplicated or non-reducing taper must fail validation');
  assert(health.some((row) => row.maxRecoveryBouncePercent > 18 && row.maxBuildToBuildIncreasePercent <= 12 && !row.issues.includes('recovery rebound')), 'recovery bounce alone must not create unsafe-build issue');
  assert(health.some((row) => row.maxBuildToBuildIncreasePercent > 12 && row.issues.includes('build-to-build increase')), 'unsafe build-to-build increases must warn');
  validateIntermediateRaceSupport();
}

function validateIntermediateRaceSupport() {
  const marathonRaceDate = addDays(currentDate, 40 * 7 - 2);
  const halfPlan = generateTrainingPlan({ athleteName: 'Intermediate Half Test', raceDistance: 'marathon', raceGoal: 'Personal Best', raceDate: marathonRaceDate, currentWeeklyKm: 35, longestRunKm: 19, runsPerWeek: 4, currentDate, milestoneRaces: [{ name: 'Supported Half Marathon', date: '2026-11-21', distance: 'half_marathon' }] });
  const noMilestonePlan = generateTrainingPlan({ athleteName: 'No Intermediate Race Test', raceDistance: 'marathon', raceGoal: 'Personal Best', raceDate: marathonRaceDate, currentWeeklyKm: 35, longestRunKm: 19, runsPerWeek: 4, currentDate });
  const halfHealth = evaluateEngineHealth(halfPlan, 'INTERMEDIATE-HALF');
  const halfWeek = halfPlan.weeks[19];
  const halfRecoveryWeek = halfPlan.weeks[20];
  const normalWeek = noMilestonePlan.weeks[19];
  assert(halfHealth.intermediateRaceSupportPresent, 'half-marathon milestone support must be reported present');
  assert(halfHealth.intermediateRacePrimary, 'half-marathon milestone race must be reported as primary');
  assert(halfHealth.intermediateRaceConflictFree, 'half-marathon milestone race must be reported conflict-free');
  assert(halfHealth.intermediateRaceLongRunValid, 'half-marathon milestone long-run handling must be valid');
  assert(halfHealth.intermediateRaceRecoveryValid, 'half-marathon recovery must be valid');
  assert(halfHealth.destinationProgressionResumed, 'destination progression must be reported as resumed after half-marathon');
  assert(halfHealth.intermediateRaceSupportValid, 'half-marathon intermediate support must pass combined validation');
  assert(halfWeek.foundationWorkouts.some((workout) => workout.type === 'race' && workout.plannedDistanceKm === 21.1), 'week 20 must contain the supported half-marathon race');
  assert(halfWeek.targetDistanceRangeKm.max < normalWeek.targetDistanceRangeKm.max * 0.75, 'half-marathon milestone week must reduce total workload versus normal build');
  assert(primaryWorkout(halfWeek)?.type === 'race', 'half-marathon milestone must be the primary hard session');
  assert(!halfWeek.foundationWorkouts.some((workout) => workout.type === 'long_run'), 'half-marathon milestone week must not stack a separate traditional long run');
  assert(!hasCompetingMajorQuality(halfWeek), 'half-marathon milestone week must not keep a competing major quality session');
  assert(halfRecoveryWeek.targetDistanceRangeKm.max < halfPlan.weeks[21].targetDistanceRangeKm.max, 'week after half-marathon milestone must apply recovery before build resumes');
  assert(halfPlan.weeks[21].targetDistanceRangeKm.max > halfRecoveryWeek.targetDistanceRangeKm.max, 'destination progression must resume after half-marathon recovery');
  assert(maxLongRunWeek(halfPlan) > 20, 'destination marathon peak long run must remain later than the half-marathon milestone');
  assert(validateFinalMarathonTaper(halfPlan, 30).valid, 'final marathon taper must remain intact after half-marathon milestone');
  assert(validateQualityProgression(halfPlan).qualityProgressionValid, 'quality progression must resume without duplicate normal-week quality after half-marathon milestone');

  const tenKPlan = generateTrainingPlan({ athleteName: 'Intermediate 10k Test', raceDistance: 'marathon', raceGoal: 'Personal Best', raceDate: marathonRaceDate, currentWeeklyKm: 35, longestRunKm: 19, runsPerWeek: 4, currentDate, milestoneRaces: [{ name: 'Supported 10k', date: '2026-11-21', distance: '10k' }] });
  const tenKHealth = evaluateEngineHealth(tenKPlan, 'INTERMEDIATE-10K');
  const tenKWeek = tenKPlan.weeks[19];
  assert(tenKHealth.intermediateRaceSupportPresent && tenKHealth.intermediateRacePrimary && tenKHealth.intermediateRaceConflictFree, '10k milestone must be supported, primary, and conflict-free');
  assert(tenKHealth.intermediateRaceLongRunValid && tenKHealth.intermediateRaceRecoveryValid && tenKHealth.destinationProgressionResumed && tenKHealth.intermediateRaceSupportValid, '10k milestone support and destination resumption must validate');
  assert(tenKWeek.foundationWorkouts.some((workout) => workout.type === 'race' && workout.plannedDistanceKm === 10), '10k milestone week must contain the supported race');
  assert(tenKWeek.targetDistanceRangeKm.max < normalWeek.targetDistanceRangeKm.max && tenKWeek.targetDistanceRangeKm.max > halfWeek.targetDistanceRangeKm.max, '10k milestone support must be lighter than half-marathon support but below normal build');
  assert(primaryWorkout(tenKWeek)?.type === 'race', '10k milestone must replace the normal major quality session');
  assert(!hasCompetingMajorQuality(tenKWeek), '10k milestone week must not keep an unnecessary competing hard workout');
  assert(tenKPlan.weeks[21].targetDistanceRangeKm.max > tenKPlan.weeks[20].targetDistanceRangeKm.max, 'training must resume after 10k milestone recovery');
  assert(validateFinalMarathonTaper(tenKPlan, 30).valid, 'final marathon taper must remain intact after 10k milestone');
  const noMilestoneHealth = evaluateEngineHealth(noMilestonePlan, 'NO-INTERMEDIATE');
  assert(!noMilestoneHealth.intermediateRaceSupportPresent && noMilestoneHealth.intermediateRaceSupportValid, 'no-intermediate plan must remain neutral for intermediate-race validation');
  assert(!noMilestoneHealth.issues.includes('Intermediate race'), 'no-intermediate plan must not create intermediate-race issues');
  assert(validateFinalMarathonTaper(noMilestonePlan, 30).valid, 'no-intermediate marathon plan must keep Pass 2A taper behaviour');

  const halfDestinationPlan = generateTrainingPlan({ athleteName: 'Shorter Distance Quality Test', raceDistance: 'half_marathon', raceGoal: 'Personal Best', raceDate: addDays(currentDate, 14 * 7 - 2), currentWeeklyKm: 30, longestRunKm: 14, runsPerWeek: 4, currentDate });
  assert(validateQualityProgression(halfDestinationPlan).qualityProgressionValid, 'half-marathon destination must avoid duplicate normal-week primary quality');
  assert(halfDestinationPlan.weeks.some((week) => week.phase === 'specific' && week.foundationWorkouts.some((workout) => /half-marathon|threshold/i.test(`${workout.title} ${workout.mainSet}`))), 'half-marathon destination must receive half-marathon-specific quality');
  assert(!halfDestinationPlan.weeks.some((week) => week.foundationWorkouts.some((workout) => /(^|[^-])marathon effort|marathon-effort/i.test(`${workout.title} ${workout.mainSet}`))), 'half-marathon destination must not receive marathon-specific quality');

  const invalidLongRunPlan = JSON.parse(JSON.stringify(halfPlan)) as GeneratedTrainingPlan;
  invalidLongRunPlan.weeks[19].foundationWorkouts.push({ ...invalidLongRunPlan.weeks[18].foundationWorkouts.find((workout) => workout.type === 'long_run')!, id: 'invalid-stacked-long-run', weekNumber: 20 });
  const invalidLongRunHealth = evaluateEngineHealth(invalidLongRunPlan, 'INVALID-HALF-LONG-RUN');
  assert(!invalidLongRunHealth.intermediateRaceLongRunValid && !invalidLongRunHealth.intermediateRaceSupportValid, 'half-marathon plus separate traditional long run must fail intermediate validation');
  assert(invalidLongRunHealth.issues.includes('Half-marathon race week includes a separate traditional long run.'), 'invalid half-marathon long-run case must report the correct issue');

  const invalidRecoveryPlan = JSON.parse(JSON.stringify(halfPlan)) as GeneratedTrainingPlan;
  invalidRecoveryPlan.weeks[20].targetDistanceRangeKm.max = invalidRecoveryPlan.weeks[21].targetDistanceRangeKm.max;
  invalidRecoveryPlan.weeks[20].foundationWorkouts.unshift({ ...invalidRecoveryPlan.weeks[21].foundationWorkouts.find((workout) => workout.type === 'quality_session')!, id: 'invalid-post-race-quality', weekNumber: 21 });
  const invalidRecoveryHealth = evaluateEngineHealth(invalidRecoveryPlan, 'INVALID-HALF-RECOVERY');
  assert(!invalidRecoveryHealth.intermediateRaceRecoveryValid && !invalidRecoveryHealth.intermediateRaceSupportValid, 'immediate full-quality loading after half-marathon must fail recovery validation');
  assert(invalidRecoveryHealth.issues.includes('Post-race recovery is insufficient for the scheduled race demand.'), 'invalid recovery case must report the correct issue');

  printIntermediateRaceAudit('40-week marathon + half marathon', halfPlan, halfHealth);
  printIntermediateRaceAudit('40-week marathon + 10k', tenKPlan, tenKHealth);
}


function printQualityAudit(label: string, plan: GeneratedTrainingPlan) {
  const progression = validateQualityProgression(plan);
  console.log(`[Quality audit] ${label}: qualityProgressionValid=${progression.qualityProgressionValid}; duplicateWeeks=${progression.duplicateWeeks.join(',') || 'none'}; marathonSpecificSessionCount=${progression.marathonSpecificSessionCount}`);
  plan.weeks.forEach((week) => {
    const workout = week.foundationWorkouts.find((item) => item.type === 'quality_session' || item.type === 'race');
    if (!workout) return;
    console.log(`[Quality audit] week=${week.weekNumber}; phase=${week.phase}; title=${workout.title}; category=${qualityCategory(workout)}; mainSet=${workout.mainSet}; qualityMin=${qualityMinutes(workout) || 'n/a'}; status=${week.weekType === 'recovery' ? 'recovery' : 'normal'}; raceSupport=${week.foundationWorkouts.some((item) => item.type === 'race') && week.weekType !== 'race'}; taper=${week.phase === 'taper'}`);
  });
}

function validateNegativeQualityDuplicate(plan: GeneratedTrainingPlan) {
  const clone = JSON.parse(JSON.stringify(plan)) as GeneratedTrainingPlan;
  const normalQualityWeeks = clone.weeks.filter((week) => week.phase === 'build' && week.weekType === 'normal' && week.foundationWorkouts.some((workout) => workout.type === 'quality_session'));
  assert(normalQualityWeeks.length >= 2, 'negative duplicate case needs two normal build quality weeks');
  const first = normalQualityWeeks[0].foundationWorkouts.find((workout) => workout.type === 'quality_session')!;
  const second = normalQualityWeeks[1].foundationWorkouts.find((workout) => workout.type === 'quality_session')!;
  Object.assign(second, { title: first.title, mainSet: first.mainSet, intensity: first.intensity });
  const result = validateQualityProgression(clone);
  assert(!result.qualityProgressionValid, 'negative duplicate quality case must fail qualityProgressionValid');
  assert(result.issues.some((issue) => /Duplicate primary quality/.test(issue)), 'negative duplicate quality case must report duplicate primary quality issue');
  console.log(`[Quality audit] negative duplicate case: qualityProgressionValid=${result.qualityProgressionValid}; duplicateWeeks=${result.duplicateWeeks.join(',')}; issues=${result.issues.join(' | ')}`);
}

function earlyQuality(plan: GeneratedTrainingPlan) { return plan.weeks.filter((week) => week.phase === 'base').some((week) => week.foundationWorkouts.some((workout) => /stride|light tempo/i.test(`${workout.title} ${workout.mainSet}`))); }
function qualityCategory(workout: GeneratedWorkout) { return /race/.test(workout.type) ? 'race' : /marathon/.test(`${workout.title} ${workout.mainSet}`) ? 'marathon-specific' : /half-marathon/.test(`${workout.title} ${workout.mainSet}`) ? 'half-specific' : /threshold|cruise/.test(`${workout.title} ${workout.mainSet}`) ? 'threshold' : /hill/.test(`${workout.title} ${workout.mainSet}`) ? 'hills' : /VO2|race/i.test(`${workout.title} ${workout.mainSet}`) ? 'race-pace' : 'introductory'; }
function qualityMinutes(workout: GeneratedWorkout) { const reps = /^(\d+) x (\d+) min/.exec(workout.mainSet); if (reps) return Number(reps[1]) * Number(reps[2]); const doubles = /^(\d+) x (\d+) min/.exec(workout.title); return doubles ? Number(doubles[1]) * Number(doubles[2]) : undefined; }


function printIntermediateRaceAudit(label: string, plan: GeneratedTrainingPlan, health: ReturnType<typeof evaluateEngineHealth>) {
  const milestone = plan.inputs.milestoneRaces?.[0];
  if (!milestone) return;
  const raceWeek = plan.weeks.find((week) => week.foundationWorkouts.some((workout) => workout.type === 'race' && workout.plannedDistanceKm === (milestone.distance === 'half_marathon' ? 21.1 : milestone.distance === 'marathon' ? 42.2 : milestone.distance === '15k' ? 15 : milestone.distance === '10k' ? 10 : 5)));
  if (!raceWeek) return;
  const nextWeek = plan.weeks[raceWeek.weekNumber];
  const finalTaperWeeks = plan.weeks.filter((week) => week.phase === 'taper').map((week) => week.weekNumber).join(',');
  console.log(`[Intermediate race audit] ${label}: destination=${plan.inputs.raceDistance}; intermediate=${milestone.distance}; week=${raceWeek.weekNumber}; nonRaceKm=${raceWeekTrainingLoadKm(raceWeek)}; racePrimary=${primaryWorkout(raceWeek)?.type === 'race'}; competingHard=${hasCompetingMajorQuality(raceWeek) ? 1 : 0}; separateLongRun=${raceWeek.foundationWorkouts.some((workout) => workout.type === 'long_run')}; followingRecoveryLoad=${nextWeek?.targetDistanceRangeKm.max ?? 0}; destinationPeakWeek=${maxLongRunWeek(plan)}; finalTaperWeeks=${finalTaperWeeks}; intermediateRaceSupportValid=${health.intermediateRaceSupportValid}; issues=${health.issues || 'none'}; warnings=${health.warnings || 'none'}`);
}

function validateFinalMarathonTaper(plan: GeneratedTrainingPlan, minimumPeakLongRunKm: number): { valid: boolean; reason?: string } {
  const raceWeek = plan.weeks.at(-1);
  const taperWeeks = plan.weeks.filter((week) => week.phase === 'taper');
  const peakWeek = [...plan.weeks].reverse().find((week) => week.phase === 'peak');
  if (!raceWeek || raceWeek.weekType !== 'race') return { valid: false, reason: 'missing race week' };
  if (!peakWeek || taperWeeks.length < 2) return { valid: false, reason: 'missing final peak or taper' };
  const peakLongRun = max(plan.weeks.flatMap((week) => week.foundationWorkouts.map((workout) => workout.type === 'long_run' ? workout.plannedDistanceKm ?? 0 : 0)));
  if (peakLongRun < minimumPeakLongRunKm) return { valid: false, reason: 'peak long run below destination minimum' };
  const taperLoads = taperWeeks.map(trainingLoadKm);
  const taperLongRuns = taperWeeks.map(longRunKm);
  if (!(trainingLoadKm(peakWeek) > taperLoads[0])) return { valid: false, reason: 'first taper does not reduce from peak' };
  for (let index = 1; index < taperLoads.length; index += 1) {
    if (!(taperLoads[index] < taperLoads[index - 1])) return { valid: false, reason: 'taper load is not progressive' };
    if (!(taperLongRuns[index] < taperLongRuns[index - 1])) return { valid: false, reason: 'taper long run is not progressive' };
    if (taperSignature(taperWeeks[index]) === taperSignature(taperWeeks[index - 1])) return { valid: false, reason: 'duplicate taper weeks' };
  }
  if (!(taperLongRuns[0] < longRunKm(peakWeek))) return { valid: false, reason: 'first taper long run does not reduce from peak' };
  if (!(raceWeekTrainingLoadKm(raceWeek) < taperLoads.at(-1)!)) return { valid: false, reason: 'race week training load rebounds' };
  return { valid: true };
}

function primaryWorkout(week: GeneratedTrainingWeek): GeneratedWorkout | undefined { return [...week.foundationWorkouts].sort((a, b) => workoutDemandKm(b) - workoutDemandKm(a))[0]; }
function workoutDemandKm(workout: GeneratedWorkout): number { return (workout.plannedDistanceKm ?? 0) * (workout.type === 'race' ? 1.4 : workout.type === 'quality_session' ? 1.2 : 1); }
function hasCompetingMajorQuality(week: GeneratedTrainingWeek): boolean { return week.foundationWorkouts.some((workout) => workout.type === 'quality_session' && /threshold|VO2|hill|marathon effort|half-marathon effort|race-effort|tempo/i.test(`${workout.title} ${workout.mainSet}`)); }
function maxLongRunWeek(plan: GeneratedTrainingPlan): number { return plan.weeks.reduce((best, week) => longRunKm(week) > longRunKm(plan.weeks[best - 1]) ? week.weekNumber : best, 1); }
function trainingLoadKm(week: GeneratedTrainingWeek): number { return week.targetDistanceRangeKm.max; }
function raceWeekTrainingLoadKm(week: GeneratedTrainingWeek): number { return sum(week.foundationWorkouts.filter((workout) => workout.type !== 'race').map((workout) => workout.plannedDistanceKm ?? 0)); }
function longRunKm(week: GeneratedTrainingWeek): number { return week.foundationWorkouts.find((workout) => workout.type === 'long_run')?.plannedDistanceKm ?? 0; }
function taperSignature(week: GeneratedTrainingWeek): string {
  const quality = week.foundationWorkouts.find((workout) => workout.type === 'quality_session');
  return [week.targetDistanceRangeKm.max, longRunKm(week), quality?.title ?? '', quality?.plannedDistanceKm ?? 0].join('|');
}
function clonePlanWithDuplicateTaper(plan: GeneratedTrainingPlan): GeneratedTrainingPlan {
  const clone = JSON.parse(JSON.stringify(plan)) as GeneratedTrainingPlan;
  const taperIndexes = clone.weeks.map((week, index) => week.phase === 'taper' ? index : -1).filter((index) => index >= 0);
  if (taperIndexes.length >= 2) clone.weeks[taperIndexes[1]] = { ...JSON.parse(JSON.stringify(clone.weeks[taperIndexes[0]])), id: clone.weeks[taperIndexes[1]].id, weekNumber: clone.weeks[taperIndexes[1]].weekNumber };
  return clone;
}

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }


function writeAuditExports(cases: CaseRecord[]) {
  const outputs = { summary: summaryRows(cases), weeks: weekRows(cases), workouts: workoutRows(cases), health: healthRows(cases) };
  writeCsv('plan-test-summary.csv', outputs.summary);
  writeCsv('plan-test-weeks.csv', outputs.weeks);
  writeCsv('plan-test-workouts.csv', outputs.workouts);
  writeCsv('plan-test-health.csv', outputs.health);
  return outputs;
}

function summaryRows(cases: CaseRecord[]): string[][] {
  const header = ['planId','caseName','destinationDistance','goalType','athleteLevel','planWeeks','runsPerWeek','startingWeeklyKm','startingLongRunKm','targetPeakLongRunMin','targetPeakLongRunMax','achievedPeakLongRunKm','targetPeakWeeklyKmMin','targetPeakWeeklyKmMax','achievedPeakWeeklyKm','taperWeekCount','recoveryWeekCount','intermediateRaceCount','raceSpecificSessionCount','fuelPracticeCount','engineScore','engineGrade'];
  return [header, ...cases.map(({ caseId, input, plan }) => {
    const h = evaluateEngineHealth(plan, caseId), audit = auditCounts(plan);
    return [caseId,input.athleteName,input.raceDistance,input.raceGoal,athleteLevel(input),String(plan.weeks.length),String(input.runsPerWeek),String(input.currentWeeklyKm),String(input.longestRunKm),String(h.targetPeakLongRunMin),String(h.targetPeakLongRunMax),String(h.achievedPeakLongRunKm),String(h.targetPeakWeeklyKmMin),String(h.targetPeakWeeklyKmMax),String(h.achievedPeakWeeklyKm),String(audit.taperWeekCount),String(audit.recoveryWeekCount),String(input.milestoneRaces?.length ?? 0),String(audit.raceSpecificSessionCount),String(audit.fuelPracticeCount),String(h.engineScore),h.engineGrade];
  })];
}

function weekRows(cases: CaseRecord[]): string[][] {
  const header = ['planId','caseName','weekNumber','phase','phaseWeekNumber','plannedWeeklyKm','actualGeneratedWeeklyKm','longRunKm','hardSessionCount','qualitySessionCount','recoveryWeek','taperWeek','raceWeek','intermediateRaceSupportWeek','postRaceRecoveryWeek','raceDistanceKm','primaryQualityTitle','primaryQualityCategory','weeklyGoal','phaseGoal'];
  const rows = cases.flatMap(({ caseId, input, plan }) => plan.weeks.map((week) => {
    const quality = primaryWorkout(week), milestone = milestoneForWeek(plan, week), phaseWeekNumber = plan.weeks.filter((w) => w.phase === week.phase && w.weekNumber <= week.weekNumber).length;
    return [caseId,input.athleteName,String(week.weekNumber),week.phase,String(phaseWeekNumber),String(week.targetDistanceRangeKm.max),String(generatedWeeklyKm(week)),String(longRunKm(week)),String(week.foundationWorkouts.filter(hardWorkout).length),String(week.foundationWorkouts.filter((w) => w.type === 'quality_session').length),String(week.weekType === 'recovery'),String(week.phase === 'taper'),String(week.weekType === 'race'),String(!!milestone),String(isPostRaceRecoveryWeek(plan, week)),String(milestone ? raceDistanceKmFor(milestone.distance) : week.weekType === 'race' ? raceDistanceKmFor(input.raceDistance) : ''),quality?.title ?? '',quality ? auditQualityCategory(quality) : '',week.coachingMessage,phaseGoal(week.phase)];
  }));
  return [header, ...rows];
}

function healthRows(cases: CaseRecord[]): string[][] {
  const header = ['planId','caseName','achievedPeakLongRunKm','targetPeakLongRunMin','targetPeakLongRunMax','longRunTargetMet','achievedPeakWeeklyKm','targetPeakWeeklyKmMin','targetPeakWeeklyKmMax','weeklyVolumeTargetMet','maxOrdinaryWeekIncreasePercent','maxBuildToBuildIncreasePercent','maxRecoveryBouncePercent','qualityProgressionValid','duplicateQualityWeeks','raceSpecificWorkPresent','marathonSpecificSessionCount','fuelPracticePresent','fuelPracticeCount','taperPresent','taperProgressive','taperWeekCount','intermediateRaceSupportPresent','intermediateRacePrimary','intermediateRaceConflictFree','intermediateRaceLongRunValid','intermediateRaceRecoveryValid','destinationProgressionResumed','intermediateRaceSupportValid','raceWeekPresent','recoveryWeeksValid','foundationCountValid','runwayClassification','engineScore','engineGrade','issues','warnings'];
  const rows = cases.map(({ caseId, input, plan }) => {
    const h = evaluateEngineHealth(plan, caseId), audit = auditCounts(plan), taper = input.raceDistance === 'marathon' ? validateFinalMarathonTaper(plan, input.raceGoal === 'Race Competitively' ? 32 : 30).valid : h.taperPresent;
    return [caseId,input.athleteName,String(h.achievedPeakLongRunKm),String(h.targetPeakLongRunMin),String(h.targetPeakLongRunMax),String(h.longRunTargetMet),String(h.achievedPeakWeeklyKm),String(h.targetPeakWeeklyKmMin),String(h.targetPeakWeeklyKmMax),String(h.weeklyVolumeTargetMet),String(h.maxOrdinaryWeekIncreasePercent),String(h.maxBuildToBuildIncreasePercent),String(h.maxRecoveryBouncePercent),String(h.qualityProgressionValid),h.duplicateQualityWeeks,String(audit.raceSpecificSessionCount > 0 || !['marathon','half_marathon'].includes(input.raceDistance)),String(h.marathonSpecificSessionCount),String(audit.fuelPracticeCount > 0 || input.raceDistance !== 'marathon'),String(audit.fuelPracticeCount),String(h.taperPresent),String(taper),String(audit.taperWeekCount),String(h.intermediateRaceSupportPresent),String(h.intermediateRacePrimary),String(h.intermediateRaceConflictFree),String(h.intermediateRaceLongRunValid),String(h.intermediateRaceRecoveryValid),String(h.destinationProgressionResumed),String(h.intermediateRaceSupportValid),String(h.raceWeekPresent),String(h.recoveryWeeksPresent),String(h.foundationCountValid),h.runwayClassification,String(h.engineScore),h.engineGrade,h.issues,h.warnings];
  });
  return [header, ...rows];
}

function workoutRows(cases: CaseRecord[]): string[][] {
  const header = ['planId','caseName','weekNumber','phase','workoutId','workoutType','workoutTitle','plannedDistanceKm','plannedDurationMinutes','warmup','mainSet','cooldown','workoutPurpose','coachTip','expectedEffort','phaseGoal','hardSession','keySession','qualityCategory','longRunVariant','recoveryWorkout','taperWorkout','raceWorkout','intermediateRaceWorkout','racePaceIncluded','marathonEffortIncluded','thresholdIncluded','intervalIncluded','stridesIncluded','hillsIncluded','fuelPractice','raceDistanceKm','destinationRace','intermediateRace','raceSupportWeek'];
  const rows = cases.flatMap(({ caseId, input, plan }) => plan.weeks.flatMap((week) => [...week.foundationWorkouts, ...week.optionalWorkouts].map((workout) => workoutRow(caseId, input, plan, week, workout))));
  return [header, ...rows];
}

function workoutRow(caseId: string, input: PlanGeneratorInput, plan: GeneratedTrainingPlan, week: GeneratedTrainingWeek, workout: GeneratedWorkout): string[] {
  const text = `${workout.title} ${workout.mainSet} ${workout.intensity}`, milestone = milestoneForWeek(plan, week), isRace = workout.type === 'race';
  return [caseId,input.athleteName,String(week.weekNumber),week.phase,workout.id,workout.type,workout.title,String(workout.plannedDistanceKm ?? ''),String(workout.plannedDurationMin ?? ''),workout.warmup,workout.mainSet,workout.cooldown,workout.purpose,workout.coachTip,workout.intensity,phaseGoal(week.phase),String(hardWorkout(workout)),String(primaryWorkout(week)?.id === workout.id),auditQualityCategory(workout),longRunVariant(workout),String(workout.type === 'recovery' || /recovery/i.test(text)),String(week.phase === 'taper'),String(isRace && week.weekType === 'race'),String(isRace && !!milestone),String(/race[ -]?pace|race effort|race-rhythm/i.test(text)),String(/marathon effort|marathon-effort/i.test(text)),String(/threshold|tempo|cruise/i.test(text)),String(/VO2|interval|x \d|min on|repeats/i.test(text)),String(/stride|pickup/i.test(text)),String(/hill/i.test(text)),String(/fuel/i.test(text)),String(isRace ? workout.plannedDistanceKm ?? '' : ''),String(isRace && week.weekType === 'race'),String(isRace && !!milestone),String(!!milestone)];
}

function verifyIntegrity(outputs: { summary: string[][]; weeks: string[][]; workouts: string[][]; health: string[][] }) {
  const summary = objects(outputs.summary), weeks = objects(outputs.weeks), workouts = objects(outputs.workouts), health = objects(outputs.health);
  const planIds = new Set(summary.map((r) => r.planId));
  assert(planIds.size === summary.length, 'every plan must have exactly one summary row');
  assert(new Set(health.map((r) => r.planId)).size === health.length && health.length === summary.length, 'every plan must have exactly one health row');
  for (const row of [...weeks, ...workouts, ...health]) assert(planIds.has(row.planId), `${row.planId} row is orphaned`);
  const weekKeys = new Set(weeks.map((r) => `${r.planId}:${r.weekNumber}`));
  for (const row of workouts) assert(weekKeys.has(`${row.planId}:${row.weekNumber}`), `${row.workoutId} references missing week`);
  for (const id of planIds) { assert(weeks.some((r) => r.planId === id), `${id} has no weeks`); assert(health.filter((r) => r.planId === id).length === 1, `${id} health row count mismatch`); const ids = workouts.filter((r) => r.planId === id).map((r) => r.workoutId); assert(new Set(ids).size === ids.length, `${id} has duplicate workoutId`); }
  for (const row of health) { assert((row.longRunTargetMet === 'true') === isWithinRange(Number(row.achievedPeakLongRunKm), Number(row.targetPeakLongRunMin), Number(row.targetPeakLongRunMax)), `${row.planId} longRunTargetMet contradicts range`); assert((row.weeklyVolumeTargetMet === 'true') === isWithinRange(Number(row.achievedPeakWeeklyKm), Number(row.targetPeakWeeklyKmMin), Number(row.targetPeakWeeklyKmMax)), `${row.planId} weeklyVolumeTargetMet contradicts range`); assert(grade(Number(row.engineScore)) === row.engineGrade, `${row.planId} grade contradicts score`); }
  for (const table of Object.values(outputs)) { const width = table[0].length; table.forEach((row) => assert(row.length === width, 'malformed CSV row')); }
  return 'passed';
}

function corpusReport(cases: CaseRecord[], outputs: { summary: string[][]; weeks: string[][]; workouts: string[][]; health: string[][] }) {
  const health = objects(outputs.health), summary = objects(outputs.summary);
  return { totals: { plans: summary.length, weeks: outputs.weeks.length - 1, workouts: outputs.workouts.length - 1, healthRows: health.length }, distances: countBy(summary, 'destinationDistance'), goals: countBy(summary, 'goalType'), grades: countBy(summary, 'engineGrade'), flags: { longRunTargetMisses: health.filter((r) => r.longRunTargetMet !== 'true').length, weeklyVolumeTargetMisses: health.filter((r) => r.weeklyVolumeTargetMet !== 'true').length, taperFailures: health.filter((r) => r.taperPresent !== 'true' || r.taperProgressive !== 'true').length, qualityProgressionFailures: health.filter((r) => r.qualityProgressionValid !== 'true').length, raceSpecificWorkFailures: health.filter((r) => r.raceSpecificWorkPresent !== 'true').length, fuelPracticeFailures: health.filter((r) => r.fuelPracticePresent !== 'true').length, intermediateRaceSupportFailures: health.filter((r) => r.intermediateRaceSupportValid !== 'true').length, structuralFailures: health.filter((r) => r.raceWeekPresent !== 'true' || r.recoveryWeeksValid !== 'true' || r.foundationCountValid !== 'true').length }, issues: topMessages(health.map((r) => r.issues)), warnings: topMessages(health.map((r) => r.warnings)) };
}

function printCorpusReport(report: ReturnType<typeof corpusReport>) {
  console.log(`[Corpus totals] plans=${report.totals.plans}; weeks=${report.totals.weeks}; workouts=${report.totals.workouts}; healthRows=${report.totals.healthRows}`);
  console.log(`[Distance distribution] ${formatCounts(report.distances)}`);
  console.log(`[Goal distribution] ${formatCounts(report.goals)}`);
  console.log(`[Grade distribution] ${['A','B','C','D','F'].map((g) => `${g}: ${report.grades[g] ?? 0} (${pct(report.grades[g] ?? 0, report.totals.plans)}%)`).join(', ')}`);
  console.log(`[Validation flags] ${Object.entries(report.flags).map(([k,v]) => `${k}=${v}`).join('; ')}`);
  console.log(`[Top issues] ${report.issues.map(([m,c]) => `${c}× ${m}`).join(' || ') || 'none'}`);
  console.log(`[Top warnings] ${report.warnings.map(([m,c]) => `${c}× ${m}`).join(' || ') || 'none'}`);
}

function printLaurenSummary(cases: CaseRecord[], name: string) {
  const item = cases.find((c) => c.input.athleteName === name); if (!item) return;
  const h = evaluateEngineHealth(item.plan, item.caseId), audit = auditCounts(item.plan), taperVolumes = item.plan.weeks.filter((w) => w.phase === 'taper').map((w) => `W${w.weekNumber}:${w.targetDistanceRangeKm.max}km`).join(', ');
  console.log(`[Lauren summary] ${name} (${item.caseId}): planWeeks=${item.plan.weeks.length}; peakLongRun=${h.achievedPeakLongRunKm}; peakWeeklyVolume=${h.achievedPeakWeeklyKm}; taperWeeks=${taperVolumes}; qualityProgressionValid=${h.qualityProgressionValid}; marathonSpecificSessionCount=${h.marathonSpecificSessionCount}; fuelPracticeCount=${audit.fuelPracticeCount}; longRunTargetMet=${h.longRunTargetMet}; weeklyVolumeTargetMet=${h.weeklyVolumeTargetMet}; engineScore=${h.engineScore}; engineGrade=${h.engineGrade}; issues=${h.issues || 'none'}; warnings=${h.warnings || 'none'}`);
}

function writeManifest(cases: CaseRecord[], outputs: { summary: string[][]; weeks: string[][]; workouts: string[][]; health: string[][] }, integrity: string, deterministic: boolean) {
  const report = corpusReport(cases, outputs), commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), laurenPb = cases.find((c) => c.input.athleteName === 'Lauren PB Marathon')?.caseId ?? '', laurenCompetitive = cases.find((c) => c.input.athleteName === 'Lauren Competitive Marathon')?.caseId ?? '';
  const text = [`generationDateTime=${new Date().toISOString()}`,`sourceCommitHash=${commit}`,`actualPlanCount=${report.totals.plans}`,`actualWeekCount=${report.totals.weeks}`,`actualWorkoutCount=${report.totals.workouts}`,`healthRowCount=${report.totals.healthRows}`,'generatedFiles=plan-test-summary.csv, plan-test-weeks.csv, plan-test-workouts.csv, plan-test-health.csv, validation-manifest.txt','buildResult=passed before export','testResult=passed current test:plans assertions',`integrityCheckResult=${integrity}`,`deterministicGeneration=${deterministic}`,`laurenPbPlanId=${laurenPb}`,`laurenCompetitivePlanId=${laurenCompetitive}`].join('\n') + '\n';
  writeFileSync(path.join(outputDir, 'validation-manifest.txt'), text);
}

function createValidationBundle() { execFileSync('zip', ['-j', path.join(outputDir, 'life-fit-full-validation.zip'), ...['plan-test-summary.csv','plan-test-weeks.csv','plan-test-workouts.csv','plan-test-health.csv','validation-manifest.txt'].map((f) => path.join(outputDir, f))], { stdio: 'inherit' }); }

function auditCounts(plan: GeneratedTrainingPlan) { const workouts = plan.weeks.flatMap((week) => [...week.foundationWorkouts, ...week.optionalWorkouts]); return { taperWeekCount: plan.weeks.filter((w) => w.phase === 'taper').length, recoveryWeekCount: plan.weeks.filter((w) => w.weekType === 'recovery').length, raceSpecificSessionCount: workouts.filter((w) => /race[ -]?pace|race effort|race-rhythm|marathon effort|half-marathon effort/i.test(`${w.title} ${w.mainSet} ${w.intensity}`)).length, fuelPracticeCount: workouts.filter((w) => /fuel/i.test(`${w.title} ${w.purpose} ${w.mainSet}`)).length }; }
function athleteLevel(input: PlanGeneratorInput) { return input.currentWeeklyKm >= 50 ? 'experienced' : input.currentWeeklyKm >= 30 ? 'consistent' : 'developing'; }
function generatedWeeklyKm(week: GeneratedTrainingWeek) { return round(sum([...week.foundationWorkouts, ...week.optionalWorkouts].map((w) => w.plannedDistanceKm ?? 0))); }
function hardWorkout(workout: GeneratedWorkout) { return workout.type === 'race' || workout.type === 'quality_session' || /finish|race simulation|marathon effort|controlled-hard|comfortably hard|race specific|VO2|threshold|tempo|hill/i.test(`${workout.title} ${workout.intensity} ${workout.mainSet}`); }
function auditQualityCategory(workout: GeneratedWorkout) { const t = `${workout.title} ${workout.mainSet}`; return /marathon/i.test(t) ? 'marathon_specific' : /half-marathon/i.test(t) ? 'half_marathon_specific' : /threshold|tempo|cruise/i.test(t) ? 'threshold' : /hill/i.test(t) ? 'hills' : /VO2|interval|race effort|race-rhythm/i.test(t) ? 'race_pace' : /stride|pickup/i.test(t) ? 'strides' : workout.type === 'long_run' ? 'long_run' : workout.type === 'race' ? 'race' : ''; }
function longRunVariant(workout: GeneratedWorkout) { if (workout.type !== 'long_run') return ''; const t = `${workout.title} ${workout.mainSet}`; return /Fuel Practice/i.test(t) ? 'fuel_practice' : /marathon effort|steady|finish/i.test(t) ? 'fast_finish_or_specific' : 'standard'; }
function phaseGoal(phase: GeneratedTrainingWeek['phase']) { return ({ base: 'Build durable aerobic consistency.', build: 'Add controlled quality while extending endurance.', specific: 'Practise race-specific demands.', peak: 'Reach peak race-specific load.', taper: 'Reduce fatigue while preserving rhythm.', race_week: 'Arrive fresh for race execution.' })[phase]; }
function milestoneForWeek(plan: GeneratedTrainingPlan, week: GeneratedTrainingWeek) { return (plan.inputs.milestoneRaces ?? []).find((race) => new Date(`${race.date}T00:00:00.000Z`) >= new Date(`${week.startsOn}T00:00:00.000Z`) && new Date(`${race.date}T00:00:00.000Z`) <= new Date(`${week.endsOn}T00:00:00.000Z`)); }
function isPostRaceRecoveryWeek(plan: GeneratedTrainingPlan, week: GeneratedTrainingWeek) { return plan.weeks.some((candidate) => milestoneForWeek(plan, candidate) && week.weekNumber === candidate.weekNumber + 1); }
function raceDistanceKmFor(race: RaceType) { return ({ '5k': 5, '10k': 10, '15k': 15, half_marathon: 21.1, marathon: 42.2 })[race]; }
function objects(rows: string[][]) { const header = rows[0]; return rows.slice(1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])) as Record<string, string>); }
function countBy(rows: Record<string, string>[], key: string) { return rows.reduce((acc, row) => { acc[row[key]] = (acc[row[key]] ?? 0) + 1; return acc; }, {} as Record<string, number>); }
function formatCounts(counts: Record<string, number>) { return Object.entries(counts).map(([k,v]) => `${k}: ${v}`).join(', '); }
function pct(count: number, total: number) { return total ? Math.round((count / total) * 1000) / 10 : 0; }
function topMessages(values: string[]) { const counts: Record<string, number> = {}; values.flatMap((v) => v ? v.split(' | ') : []).filter(Boolean).forEach((m) => counts[m] = (counts[m] ?? 0) + 1); return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10); }


function writeCsv(fileName: string, rows: string[][]) { writeFileSync(path.join(outputDir, fileName), rows.map((row) => row.map(csvEscape).join(',')).join('\n')); }
function csvEscape(value: string) { return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value; }
function max(values: number[]) { return values.length ? Math.max(...values) : 0; }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function round(value: number) { return Math.round(value * 10) / 10; }
function addDays(isoDate: string, days: number) { const date = new Date(`${isoDate}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }

main();
