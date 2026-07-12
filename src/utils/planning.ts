import { addDays, parseIsoDate, toIsoDate } from '../engine/dateHelpers';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout } from '../engine/planTypes';
import type { WorkoutLog } from '../engine/types';

export type PlannerState = { assignments: Record<string, string>; extraWorkouts: GeneratedWorkout[] };
export const emptyPlanner: PlannerState = { assignments: {}, extraWorkouts: [] };
export type CompletionLog = WorkoutLog & { feeling?: string; actualDistanceKm?: number; actualDurationMinutes?: number; journalNote?: string; raceFinishTime?: string; weekNumber?: number; status?: 'completed' };
export type WeeklyCompletionRecord = { weekNumber: number; archived: boolean; completedAt: string; weeklyReflection?: string; metrics?: { plannedWorkouts: number; completedWorkouts: number; plannedDistanceKm?: number; actualDistanceKm?: number; actualDurationMinutes?: number } };

export type ResolvedWorkout = GeneratedWorkout & { assignedDay?: string; suggestedDate?: string; moved: boolean; isRemoved: boolean; isExtra: boolean; completion?: CompletionLog; status: 'unplanned' | 'planned' | 'completed' | 'skipped' };
export type ResolvedWeek = { week: GeneratedTrainingWeek; workouts: ResolvedWorkout[]; progress: WeekProgress };
export type WeekProgress = { foundationPlanned: number; foundationCompleted: number; optionalPlanned: number; optionalCompleted: number; extraCompleted: number; actualKm: number; actualMinutes: number; completedWorkoutIds: string[]; missedFoundationWorkoutIds: string[]; missedOptionalWorkoutIds: string[] };
const dayIndex: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function normalizePlannerState(value: Partial<PlannerState> | null | undefined): PlannerState {
  const assignments = value?.assignments && typeof value.assignments === 'object' ? Object.fromEntries(Object.entries(value.assignments).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {};
  const extraWorkouts = Array.isArray(value?.extraWorkouts) ? value.extraWorkouts.filter((w): w is GeneratedWorkout => Boolean(w?.id && w.weekNumber && w.category)) : [];
  return { assignments, extraWorkouts };
}

export function normalizeWorkoutLogs(logs: CompletionLog[] | null | undefined): CompletionLog[] {
  const latest = new Map<string, CompletionLog>();
  for (const log of Array.isArray(logs) ? logs : []) {
    if (!log?.workoutId) continue;
    const current = latest.get(log.workoutId);
    if (!current || (log.completedAt || '').localeCompare(current.completedAt || '') >= 0) latest.set(log.workoutId, log);
  }
  return [...latest.values()];
}

export function upsertWorkoutLog(logs: CompletionLog[], next: CompletionLog): CompletionLog[] {
  return [...normalizeWorkoutLogs(logs).filter((log) => log.workoutId !== next.workoutId), next];
}

export function normalizeWeeklyCompletionRecords(records: WeeklyCompletionRecord[] | null | undefined): WeeklyCompletionRecord[] {
  const latest = new Map<number, WeeklyCompletionRecord>();
  for (const record of Array.isArray(records) ? records : []) {
    if (!record || typeof record.weekNumber !== 'number') continue;
    const normalized: WeeklyCompletionRecord = {
      weekNumber: record.weekNumber,
      archived: Boolean(record.archived),
      completedAt: typeof record.completedAt === 'string' ? record.completedAt : '',
      weeklyReflection: typeof record.weeklyReflection === 'string' ? record.weeklyReflection : undefined,
      metrics: record.metrics,
    };
    const current = latest.get(record.weekNumber);
    if (!current || normalized.completedAt.localeCompare(current.completedAt) >= 0) latest.set(record.weekNumber, normalized);
  }
  return [...latest.values()];
}

export function upsertWeeklyCompletionRecord(records: WeeklyCompletionRecord[], next: WeeklyCompletionRecord): WeeklyCompletionRecord[] {
  return [...normalizeWeeklyCompletionRecords(records).filter((record) => record.weekNumber !== next.weekNumber), next];
}

export function buildSuggestedPlanner(plan: GeneratedTrainingPlan, existing: PlannerState = emptyPlanner): PlannerState {
  const normalized = normalizePlannerState(existing);
  const assignments = { ...normalized.assignments };
  for (const week of plan.weeks) for (const workout of [...week.foundationWorkouts, ...week.optionalWorkouts]) {
    const assignedDate = assignments[workout.id];
    if (!assignedDate || !isAssignmentValidForWeek(assignedDate, week)) assignments[workout.id] = suggestedDateForWorkout(week, workout);
  }
  return { assignments, extraWorkouts: normalized.extraWorkouts };
}

export function isAssignmentValidForWeek(date: string | undefined, week: GeneratedTrainingWeek): date is string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = parseIsoDate(date);
  if (Number.isNaN(parsed.getTime()) || toIsoDate(parsed) !== date) return false;
  return date >= week.startsOn && date <= week.endsOn;
}

export function suggestedDateForWorkout(week: GeneratedTrainingWeek, workout: GeneratedWorkout): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(workout.suggestedDay)) return workout.suggestedDay;
  const label = workout.suggestedDay.split(/\s+or\s+|,|\//)[0].trim();
  const key = Object.keys(dayIndex).find((day) => label.startsWith(day));
  return toIsoDate(addDays(parseIsoDate(week.startsOn), key ? dayIndex[key] : 5));
}

export function workoutsForWeek(week: GeneratedTrainingWeek, planner: PlannerState): GeneratedWorkout[] { return resolveWeek(week, planner, []).workouts; }
export function getCurrentTrainingWeek(plan: GeneratedTrainingPlan | null, stored?: GeneratedTrainingWeek | null) { return stored ?? plan?.weeks[0] ?? null; }
export function getWorkoutCompletion(workoutId: string, logs: CompletionLog[]) { return normalizeWorkoutLogs(logs).find((log) => log.workoutId === workoutId); }
export function getPlannerAssignment(workout: GeneratedWorkout, week: GeneratedTrainingWeek, planner: PlannerState) {
  const assignedDate = normalizePlannerState(planner).assignments[workout.id];
  if (isAssignmentValidForWeek(assignedDate, week)) return assignedDate;
  return workout.status === 'unplanned' ? undefined : suggestedDateForWorkout(week, workout);
}
export function resolveWorkout(workout: GeneratedWorkout, week: GeneratedTrainingWeek, planner: PlannerState, logs: CompletionLog[]): ResolvedWorkout {
  const completion = getWorkoutCompletion(workout.id, logs);
  const suggestedDate = suggestedDateForWorkout(week, workout);
  const assignedDay = getPlannerAssignment(workout, week, planner);
  return { ...workout, assignedDay, suggestedDate, moved: Boolean(assignedDay && assignedDay !== suggestedDate), isRemoved: !assignedDay, isExtra: workout.category === 'extra', completion, status: completion ? 'completed' : assignedDay ? 'planned' : 'unplanned' };
}
export function resolveWeek(week: GeneratedTrainingWeek, planner: PlannerState, logs: CompletionLog[] = []): ResolvedWeek {
  const base = [...week.foundationWorkouts, ...week.optionalWorkouts, ...normalizePlannerState(planner).extraWorkouts.filter((workout) => workout.weekNumber === week.weekNumber)];
  const workouts = base.map((workout) => resolveWorkout(workout, week, planner, logs));
  return { week, workouts, progress: getResolvedWeekProgress(workouts) };
}
export function getResolvedWorkoutsForDay(week: GeneratedTrainingWeek, planner: PlannerState, logs: CompletionLog[], day: string) { return resolveWeek(week, planner, logs).workouts.filter((workout) => workout.assignedDay === day); }
export function appendCompactDurationLabel(title: string, plannedDurationMin?: number) {
  if (!plannedDurationMin || hasSameDurationLabel(title, plannedDurationMin)) return title;
  return `${title} · ${plannedDurationMin} min`;
}
function hasSameDurationLabel(title: string, minutes: number) { return new RegExp(`(^|\\D)${minutes}\\s*(m|min|mins|minutes)(\\D|$)`, 'i').test(title); }
export function getResolvedWeekProgress(workouts: ResolvedWorkout[]): WeekProgress {
  const planned = workouts.filter((w) => !w.isRemoved);
  const completed = planned.filter((w) => w.completion);
  const actualKm = completed.reduce((sum, w) => sum + (w.completion?.actualDistanceKm ?? w.completion?.distanceKm ?? 0), 0);
  const actualMinutes = completed.reduce((sum, w) => sum + (w.completion?.actualDurationMinutes ?? w.completion?.durationMinutes ?? 0), 0);
  return { foundationPlanned: planned.filter((w) => w.category === 'foundation').length, foundationCompleted: completed.filter((w) => w.category === 'foundation').length, optionalPlanned: planned.filter((w) => w.category === 'optional').length, optionalCompleted: completed.filter((w) => w.category === 'optional').length, extraCompleted: completed.filter((w) => w.category === 'extra').length, actualKm: Math.round(actualKm * 10) / 10, actualMinutes: Math.round(actualMinutes), completedWorkoutIds: completed.map((w) => w.id), missedFoundationWorkoutIds: planned.filter((w) => w.category === 'foundation' && !w.completion).map((w) => w.id), missedOptionalWorkoutIds: planned.filter((w) => w.category === 'optional' && !w.completion).map((w) => w.id) };
}
