import { parseIsoDate } from './dateHelpers';
import { raceDistanceKm } from './targets';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, PlanGeneratorInput } from './planTypes';
import type { PlanWarning } from './warnings';

export interface PlanValidationIssue { id: string; message: string; weekNumber?: number; workoutId?: string; }
export interface PlanRepairAction { id: string; message: string; weekNumber?: number; }
export interface PlanValidationResult { valid: boolean; errors: PlanValidationIssue[]; warnings: PlanWarning[]; repairActions: PlanRepairAction[]; unrepairedIssues: PlanValidationIssue[]; }

type PlanDraft = Omit<GeneratedTrainingPlan, 'summary'> & { summary?: GeneratedTrainingPlan['summary'] };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HARD_RE = /finish|race simulation|marathon effort|controlled-hard|comfortably hard|race specific|VO2|threshold|tempo|hill/i;

export function validateGeneratedPlan(plan: PlanDraft): PlanValidationResult {
  const errors: PlanValidationIssue[] = [];
  const warnings: PlanWarning[] = [...dedupeWarnings(plan.warnings)];
  const seenWeeks = new Set<number>();
  const seenIds = new Set<string>();
  const raceKm = raceDistanceKm[plan.inputs.raceDistance];

  if (!plan.weeks.length) errors.push(issue('plan_empty', 'Plan needs at least one training week.'));
  let sawRace = false;
  let sawSpecificOrPeak = false;
  let sawTaper = false;

  plan.weeks.forEach((week, index) => {
    if (seenWeeks.has(week.weekNumber)) errors.push(issue('duplicate_week_number', 'Training weeks need unique week numbers.', week.weekNumber));
    seenWeeks.add(week.weekNumber);
    if (week.weekNumber !== index + 1) errors.push(issue('weeks_not_sequential', 'Training weeks need to stay in calendar order.', week.weekNumber));
    if (index > 0 && parseIsoDate(week.startsOn) <= parseIsoDate(plan.weeks[index - 1].startsOn)) errors.push(issue('week_dates_not_chronological', 'Training week dates need to move forward.', week.weekNumber));
    if (sawRace) errors.push(issue('week_after_race', 'No training weeks should appear after race week.', week.weekNumber));
    if (week.weekType === 'race') sawRace = true;
    if (week.phase === 'taper') sawTaper = true;
    if (sawTaper && week.phase === 'peak') errors.push(issue('peak_after_taper', 'Peak training should not appear after taper begins.', week.weekNumber));
    if ((week.phase === 'specific' || week.phase === 'peak')) sawSpecificOrPeak = true;
    if (sawSpecificOrPeak && week.phase === 'base') errors.push(issue('base_after_specific', 'Base training should not appear after specific preparation begins.', week.weekNumber));

    validateWeek(plan.inputs, week, seenIds, errors, warnings);
  });

  const finalWeek = plan.weeks.at(-1);
  if (finalWeek && finalWeek.weekType !== 'race') errors.push(issue('final_week_not_race', 'Final week should be race week.', finalWeek.weekNumber));
  if (finalWeek && !dateInWeek(plan.inputs.raceDate, finalWeek)) errors.push(issue('race_date_outside_final_week', 'Race date should sit inside the final race week.', finalWeek.weekNumber));
  const finalRaces = plan.weeks.flatMap((week) => week.foundationWorkouts.filter((w) => isFinalRaceWorkout(plan.inputs, week, w)).map((w) => ({ week, workout: w })));
  if (finalRaces.length === 0) errors.push(issue('missing_final_race_event', 'Race day needs to be included in the plan.'));
  if (finalRaces.length > 1) errors.push(issue('duplicate_final_race_event', 'Race day should appear once.'));
  finalRaces.forEach(({ week, workout }) => {
    if (workout.suggestedDay !== plan.inputs.raceDate || !dateInWeek(plan.inputs.raceDate, week)) errors.push(issue('race_event_wrong_date', 'Race day needs the correct date.', week.weekNumber, workout.id));
    if (!approx(workout.plannedDistanceKm, raceKm)) errors.push(issue('race_distance_missing', 'Race day needs the official distance.', week.weekNumber, workout.id));
  });
  if (finalWeek) finalWeek.foundationWorkouts.filter((w) => w.type === 'race' && (w.suggestedDay === plan.inputs.raceDate || /Race Day/i.test(w.title)) && !approx(w.plannedDistanceKm, raceKm)).forEach((w) => errors.push(issue('race_distance_missing', 'Race day needs the official distance.', finalWeek.weekNumber, w.id)));
  if (plan.weeks.length > 6 && !plan.weeks.some((w) => w.phase === 'taper')) warnings.push(coachWarning('compressed_taper', 'Your available runway is shorter than ideal, so this plan keeps the taper simple and conservative.'));
  if (plan.weeks.length > 8 && !plan.weeks.some((w) => w.weekType === 'recovery')) warnings.push(coachWarning('missing_recovery_warning', 'Recovery weeks are limited, so keep easy days genuinely easy.'));
  if (plan.weeks.length < 8) warnings.push(coachWarning('compressed_phases', 'Your available runway is shorter than ideal, so this plan prioritises safe progression.'));

  return { valid: errors.length === 0, errors, warnings: dedupeWarnings(warnings), repairActions: [], unrepairedIssues: errors };
}

function validateWeek(input: PlanGeneratorInput, week: GeneratedTrainingWeek, seenIds: Set<string>, errors: PlanValidationIssue[], warnings: PlanWarning[]) {
  const all = [...week.foundationWorkouts, ...week.optionalWorkouts];
  if (week.foundationWorkouts.length > input.runsPerWeek) errors.push(issue('foundation_count_exceeds_runs', 'Required runs should fit your selected weekly run frequency.', week.weekNumber));
  const hasRace = week.foundationWorkouts.some((w) => w.type === 'race');
  if (week.weekType === 'normal' && !hasRace && !week.foundationWorkouts.some((w) => w.type === 'long_run')) errors.push(issue('missing_long_run', 'Normal training weeks need an endurance anchor.', week.weekNumber));
  if (week.weekType === 'normal' && (week.phase === 'build' || week.phase === 'specific') && !week.foundationWorkouts.some((w) => w.type === 'quality_session')) errors.push(issue('missing_quality', 'Build and specific weeks need one primary quality stimulus.', week.weekNumber));
  if (hasRace && week.foundationWorkouts.some((w) => w.type === 'long_run')) errors.push(issue('milestone_long_run_conflict', 'A milestone race should replace the long run, not stack with it.', week.weekNumber));
  const hardDays = week.foundationWorkouts.filter(isHard).map((w) => ({ workout: w, day: dayIndex(w.suggestedDay) })).filter((x) => x.day >= 0).sort((a, b) => a.day - b.day);
  for (let i = 1; i < hardDays.length; i += 1) if (hardDays[i].day - hardDays[i - 1].day === 1) errors.push(issue('consecutive_hard_days', 'Harder sessions should be separated where possible.', week.weekNumber, hardDays[i].workout.id));
  all.forEach((workout) => validateWorkout(week, workout, seenIds, errors));
  if ((week.weekType === 'recovery' || week.phase === 'taper') && week.foundationWorkouts.some((w) => w.type === 'long_run' && HARD_RE.test(`${w.title} ${w.mainSet}`))) errors.push(issue('hard_recovery_taper_long_run', 'Recovery and taper long runs should stay easy.', week.weekNumber));
  if (week.phase === 'race_week' && week.foundationWorkouts.filter(isHard).length > 2) warnings.push(coachWarning(`race_week_fatigue_${week.weekNumber}`, 'Race week keeps intensity brief so you can arrive fresh.', week.weekNumber));
}

function validateWorkout(week: GeneratedTrainingWeek, workout: GeneratedWorkout, seenIds: Set<string>, errors: PlanValidationIssue[]) {
  if (!workout.id) errors.push(issue('missing_workout_id', 'Each workout needs a unique reference.', week.weekNumber));
  else if (seenIds.has(workout.id)) errors.push(issue('duplicate_workout_id', 'Workout references need to be unique.', week.weekNumber, workout.id));
  seenIds.add(workout.id);
  if (!workout.title || !workout.type || !workout.category || !workout.purpose || !workout.intensity || !workout.suggestedDay) errors.push(issue('missing_workout_content', 'Workout details need to be complete.', week.weekNumber, workout.id));
  if (!['unplanned', 'planned', 'completed', 'skipped'].includes(workout.status)) errors.push(issue('bad_workout_status', 'Workout status needs a known value.', week.weekNumber, workout.id));
  if (['easy_run', 'quality_session', 'long_run', 'recovery', 'shakeout', 'race'].includes(workout.type) && !(positive(workout.plannedDistanceKm) || positive(workout.plannedDurationMin))) errors.push(issue('missing_workout_load', 'Running workouts need a planned distance or duration.', week.weekNumber, workout.id));
  if (workout.type === 'quality_session' && (!workout.warmup || !workout.mainSet || !workout.cooldown)) errors.push(issue('missing_quality_content', 'Quality sessions need warmup, main set, and cooldown.', week.weekNumber, workout.id));
  if (workout.type === 'race' && /long run/i.test(workout.title)) errors.push(issue('race_labelled_long_run', 'Race events should be labelled as races.', week.weekNumber, workout.id));
  if (!validDay(workout.suggestedDay)) errors.push(issue('invalid_suggested_day', 'Suggested days should be Monday to Sunday or the race date.', week.weekNumber, workout.id));
}

export function repairGeneratedPlan(plan: PlanDraft, _validation: PlanValidationResult): { plan: PlanDraft; repairActions: PlanRepairAction[] } {
  const next: PlanDraft = { ...plan, weeks: plan.weeks.map((w) => ({ ...w, foundationWorkouts: w.foundationWorkouts.map(cloneWorkout), optionalWorkouts: w.optionalWorkouts.map(cloneWorkout), warnings: [...w.warnings] })) };
  const actions: PlanRepairAction[] = [];
  const raceKm = raceDistanceKm[next.inputs.raceDistance];
  repairDuplicateIds(next, actions);
  const finalWeek = next.weeks.at(-1);
  if (finalWeek) {
    const races = next.weeks.flatMap((w) => w.foundationWorkouts.map((workout) => ({ week: w, workout })).filter((x) => isFinalRaceWorkout(next.inputs, x.week, x.workout)));
    const correct = races.find((r) => r.workout.suggestedDay === next.inputs.raceDate && dateInWeek(next.inputs.raceDate, r.week)) ?? races.find((r) => r.week === finalWeek);
    next.weeks.forEach((week) => { week.foundationWorkouts = week.foundationWorkouts.filter((w) => w.type !== 'race' || w === correct?.workout || !isFinalRaceWorkout(next.inputs, week, w)); });
    if (races.length > 1) actions.push(action('duplicate_race_removed', 'Removed duplicate race-day entries.'));
    if (correct) { Object.assign(correct.workout, raceWorkout(next.inputs, finalWeek.weekNumber)); actions.push(action('race_event_normalised', 'Checked race-day date and distance.', finalWeek.weekNumber)); }
    else { finalWeek.foundationWorkouts.push(raceWorkout(next.inputs, finalWeek.weekNumber)); actions.push(action('race_event_added', 'Added the race-day workout.', finalWeek.weekNumber)); }
  }
  next.weeks.forEach((week) => {
    if (week.foundationWorkouts.some((w) => w.type === 'race')) {
      const before = week.foundationWorkouts.length;
      week.optionalWorkouts.push(...week.foundationWorkouts.filter((w) => w.type === 'long_run' && !isCompletedHistory(w)).map((w) => ({ ...w, id: stableId(week, 'optional-recovery-long'), type: 'recovery' as const, category: 'optional' as const, title: 'Optional Easy Recovery Jog', intensity: 'Very easy', mainSet: 'Keep this short and relaxed only if you feel fresh.' })));
      week.foundationWorkouts = week.foundationWorkouts.filter((w) => w.type !== 'long_run' || isCompletedHistory(w));
      if (week.foundationWorkouts.length !== before) actions.push(action('milestone_long_run_repaired', 'Kept the race as the key session and removed stacked long-run load.', week.weekNumber));
    }
    if (week.weekType === 'normal' && !week.foundationWorkouts.some((w) => w.type === 'race') && !week.foundationWorkouts.some((w) => w.type === 'long_run')) { week.foundationWorkouts.push(longRunFromWeek(week)); actions.push(action('long_run_restored', 'Restored the weekly long run.', week.weekNumber)); }
    while (week.foundationWorkouts.length > next.inputs.runsPerWeek) {
      const idx = findDemotionIndex(week); if (idx < 0) break;
      const [moved] = week.foundationWorkouts.splice(idx, 1); week.optionalWorkouts.push({ ...moved, category: 'optional' }); actions.push(action('foundation_demoted', 'Moved an easy run to optional to match run frequency.', week.weekNumber));
    }
    week.foundationWorkouts.filter((w) => (week.weekType === 'recovery' || week.phase === 'taper') && w.type === 'long_run' && !isCompletedHistory(w)).forEach((w) => { if (HARD_RE.test(`${w.title} ${w.mainSet}`)) Object.assign(w, { title: `Reduced Easy Long Run ${w.plannedDistanceKm ?? longRunTarget(week)} km`, intensity: 'Easy Zone 2', mainSet: 'Keep the full run comfortable and aerobic.', coachTip: 'Absorb the work; no fast finish this week.' }); });
    separateHardDays(week, actions);
  });
  repairDuplicateIds(next, actions);
  return { plan: next, repairActions: actions };
}

export function finalisePlanIntegrity(plan: GeneratedTrainingPlan): GeneratedTrainingPlan {
  const initial = validateGeneratedPlan(plan);
  const repaired = repairGeneratedPlan(plan, initial);
  const final = validateGeneratedPlan(repaired.plan);
  const warnings = dedupeWarnings([...final.warnings]);
  const out = { ...repaired.plan, warnings, validation: { ...final, repairActions: repaired.repairActions, unrepairedIssues: final.errors } } as GeneratedTrainingPlan;
  return out;
}

function raceWorkout(input: PlanGeneratorInput, weekNumber: number): GeneratedWorkout { const km = raceDistanceKm[input.raceDistance]; return { id: `w${weekNumber}-race-day`, weekNumber, title: `${input.raceDistance} Race Day`, type: 'race', category: 'foundation', plannedDistanceKm: km, plannedDurationMin: Math.round(km * 6.5), intensity: 'Race effort', purpose: 'Execute the goal race fresh and confident.', warmup: 'Use your familiar pre-race warmup; keep it short and calm.', mainSet: 'Race calmly from the start and build only when settled.', cooldown: 'Walk, hydrate, and refuel.', coachTip: 'Nothing new on race day.', suggestedDay: input.raceDate, status: 'unplanned' }; }
function longRunFromWeek(week: GeneratedTrainingWeek): GeneratedWorkout { const km = longRunTarget(week); return { id: stableId(week, 'restored-long-run'), weekNumber: week.weekNumber, title: `Easy Long Run ${km} km`, type: 'long_run', category: 'foundation', plannedDistanceKm: km, plannedDurationMin: Math.round(km * 6.5), intensity: 'Easy Zone 2', purpose: 'Build endurance and durability for race day.', warmup: 'First 10 minutes very relaxed.', mainSet: 'Keep the full run comfortable and aerobic.', cooldown: 'Walk 5 minutes, then refuel soon after finishing.', coachTip: 'Practise patience early so the finish stays controlled.', suggestedDay: 'Sunday', status: 'unplanned' }; }
function longRunTarget(week: GeneratedTrainingWeek) { return Math.max(3, Math.round(week.targetDistanceRangeKm.max * 0.42 * 10) / 10); }
function separateHardDays(week: GeneratedTrainingWeek, actions: PlanRepairAction[]) { const hard = week.foundationWorkouts.filter((w) => isHard(w) && !isCompletedHistory(w)); const used = new Set(week.foundationWorkouts.map((w) => dayIndex(w.suggestedDay)).filter((d) => d >= 0)); hard.sort((a, b) => priority(a) - priority(b)); for (let i = 1; i < hard.length; i += 1) { const prev = dayIndex(hard[i - 1].suggestedDay); const cur = dayIndex(hard[i].suggestedDay); if (Math.abs(cur - prev) === 1) { const target = [1, 2, 3, 4, 5, 0].find((d) => !used.has(d) && Math.abs(d - prev) > 1); if (target !== undefined) { used.delete(cur); used.add(target); hard[i].suggestedDay = DAYS[target]; actions.push(action('hard_day_moved', 'Separated harder sessions where the week allowed.', week.weekNumber)); } } } }
function repairDuplicateIds(plan: PlanDraft, actions: PlanRepairAction[]) { const seen = new Set<string>(); plan.weeks.forEach((week) => [...week.foundationWorkouts, ...week.optionalWorkouts].forEach((w) => { if (!w.id || seen.has(w.id)) { w.id = stableId(week, `${w.type}-${seen.size}`); actions.push(action('duplicate_id_repaired', 'Assigned a unique workout reference.', week.weekNumber)); } seen.add(w.id); })); }
function findDemotionIndex(week: GeneratedTrainingWeek) { for (let i = week.foundationWorkouts.length - 1; i >= 0; i -= 1) { const w = week.foundationWorkouts[i]; if (!isCompletedHistory(w) && (w.type === 'easy_run' || w.type === 'recovery' || w.type === 'shakeout')) return i; } return -1; }
function isCompletedHistory(w: GeneratedWorkout) { return w.status === 'completed' || w.status === 'skipped'; }
function isHard(w: GeneratedWorkout) { return w.type === 'quality_session' || (w.type === 'long_run' && HARD_RE.test(`${w.title} ${w.mainSet} ${w.intensity}`)) || w.type === 'race'; }
function priority(w: GeneratedWorkout) { return w.type === 'race' ? 0 : w.type === 'long_run' ? 1 : w.type === 'quality_session' ? 2 : 3; }
function isFinalRaceWorkout(input: PlanGeneratorInput, week: GeneratedTrainingWeek, workout: GeneratedWorkout) { return workout.type === 'race' && (workout.suggestedDay === input.raceDate || (dateInWeek(input.raceDate, week) && /Race Day/i.test(workout.title))); }
function validDay(day: string) { return DAYS.includes(day) || day === 'Flexible' || /Monday or Saturday/.test(day) || /^\d{4}-\d{2}-\d{2}$/.test(day); }
function dayIndex(day: string) { return DAYS.indexOf(day); }
function dateInWeek(date: string, week: GeneratedTrainingWeek) { const d = parseIsoDate(date); return d >= parseIsoDate(week.startsOn) && d <= parseIsoDate(week.endsOn); }
function positive(n?: number) { return typeof n === 'number' && n > 0; }
function approx(a: number | undefined, b: number) { return typeof a === 'number' && Math.abs(a - b) < 0.15; }
function issue(id: string, message: string, weekNumber?: number, workoutId?: string): PlanValidationIssue { return { id, message, weekNumber, workoutId }; }
function action(id: string, message: string, weekNumber?: number): PlanRepairAction { return { id, message, weekNumber }; }
function coachWarning(id: string, message: string, weekNumber?: number): PlanWarning { return { id, severity: 'caution', message, weekNumber }; }
function dedupeWarnings(warnings: PlanWarning[]) { return Array.from(new Map(warnings.map((w) => [w.id, w])).values()); }
function stableId(week: GeneratedTrainingWeek, suffix: string) { return `w${week.weekNumber}-${suffix}`; }
function cloneWorkout(w: GeneratedWorkout): GeneratedWorkout { return { ...w, warningIds: w.warningIds ? [...w.warningIds] : undefined }; }
