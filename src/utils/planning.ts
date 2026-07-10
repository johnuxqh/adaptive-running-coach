import { addDays, parseIsoDate, toIsoDate } from '../engine/dateHelpers';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout } from '../engine/planTypes';

export type PlannerState = { assignments: Record<string, string>; extraWorkouts: GeneratedWorkout[] };
export const emptyPlanner: PlannerState = { assignments: {}, extraWorkouts: [] };
const dayIndex: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function buildSuggestedPlanner(plan: GeneratedTrainingPlan, existing: PlannerState = emptyPlanner): PlannerState {
  const assignments = { ...existing.assignments };
  for (const week of plan.weeks) {
    for (const workout of [...week.foundationWorkouts, ...week.optionalWorkouts]) {
      if (!assignments[workout.id]) assignments[workout.id] = suggestedDateForWorkout(week, workout);
    }
  }
  return { assignments, extraWorkouts: existing.extraWorkouts ?? [] };
}

export function suggestedDateForWorkout(week: GeneratedTrainingWeek, workout: GeneratedWorkout): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(workout.suggestedDay)) return workout.suggestedDay;
  const label = workout.suggestedDay.split(/\s+or\s+|,|\//)[0].trim();
  const key = Object.keys(dayIndex).find((day) => label.startsWith(day));
  return toIsoDate(addDays(parseIsoDate(week.startsOn), key ? dayIndex[key] : 5));
}

export function workoutsForWeek(week: GeneratedTrainingWeek, planner: PlannerState): GeneratedWorkout[] {
  return [...week.foundationWorkouts, ...week.optionalWorkouts, ...(planner.extraWorkouts ?? []).filter((workout) => workout.weekNumber === week.weekNumber)];
}
