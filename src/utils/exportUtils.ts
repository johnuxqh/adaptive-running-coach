import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout } from '../engine/planTypes';
import type { AthleteProfile, WorkoutLog } from '../engine/types';
import type { LifeFitSettings } from './storage';

export type PlannerState = { assignments: Record<string, string>; extraWorkouts: GeneratedWorkout[] };
export type WeekSummary = {
  id: string; athleteName: string; weekNumber: number; phase: string; weekType: string; weekStart: string; weekEnd: string;
  foundationPlanned: number; foundationCompleted: number; optionalPlanned: number; optionalCompleted: number; extraCompleted: number;
  targetKmMin: number; targetKmMax: number; actualKm: number; targetMinutesMin: number; targetMinutesMax: number; actualMinutes: number;
  completedWorkoutIds: string[]; missedFoundationWorkoutIds: string[]; missedOptionalWorkoutIds: string[]; weeklyNote: string; missedReason: string; closedAt: string;
};

export type BackupPayload = { profile: AthleteProfile | null; plan: GeneratedTrainingPlan | null; currentWeek: GeneratedTrainingWeek | null; plannerState: PlannerState; workoutLogs: WorkoutLog[]; weekSummaries: WeekSummary[]; settings: LifeFitSettings | null };

export function csv(rows: Record<string, unknown>[], columns: string[]) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\n');
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function safeName(name: string) { return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'athlete'; }
export function stamp() { return new Date().toISOString().slice(0, 10); }

export function buildFullPlanCsv(plan: GeneratedTrainingPlan) {
  const columns = ['athleteName','raceDistance','raceDate','weekNumber','weekStart','weekEnd','phase','weekType','category','workoutTitle','type','suggestedDay','plannedDistanceKm','plannedDurationMin','intensity','purpose','warmup','mainSet','cooldown','coachTip'];
  const rows = plan.weeks.flatMap((week) => [...week.foundationWorkouts, ...week.optionalWorkouts].map((workout) => ({ athleteName: plan.summary.athleteName, raceDistance: plan.summary.raceDistance, raceDate: plan.summary.raceDate, weekNumber: week.weekNumber, weekStart: week.startsOn, weekEnd: week.endsOn, phase: week.phase, weekType: week.weekType, category: workout.category, workoutTitle: workout.title, type: workout.type, suggestedDay: workout.suggestedDay, plannedDistanceKm: workout.plannedDistanceKm ?? '', plannedDurationMin: workout.plannedDurationMin ?? '', intensity: workout.intensity, purpose: workout.purpose, warmup: workout.warmup, mainSet: workout.mainSet, cooldown: workout.cooldown, coachTip: workout.coachTip })));
  return csv(rows, columns);
}

export function buildCoachReportCsv(plan: GeneratedTrainingPlan, planner: PlannerState, logs: WorkoutLog[], summaries: WeekSummary[]) {
  const columns = ['athleteName','weekNumber','phase','weekType','workoutId','workoutTitle','category','type','plannedDay','status','plannedDistanceKm','actualDistanceKm','plannedDurationMin','actualDurationMin','feeling','notes','completedAt'];
  const allLogs = new Map(logs.map((log) => [log.workoutId, log as WorkoutLog & { feeling?: string; actualDistanceKm?: number; actualDurationMinutes?: number }]));
  const rows = plan.weeks.flatMap((week) => [...week.foundationWorkouts, ...week.optionalWorkouts, ...planner.extraWorkouts.filter((w) => w.weekNumber === week.weekNumber)].map((workout) => {
    const log = allLogs.get(workout.id);
    return { athleteName: plan.summary.athleteName, weekNumber: week.weekNumber, phase: week.phase, weekType: week.weekType, workoutId: workout.id, workoutTitle: workout.title, category: workout.category, type: workout.type, plannedDay: planner.assignments[workout.id] ?? workout.suggestedDay, status: workout.status, plannedDistanceKm: workout.plannedDistanceKm ?? '', actualDistanceKm: log?.actualDistanceKm ?? log?.distanceKm ?? '', plannedDurationMin: workout.plannedDurationMin ?? '', actualDurationMin: log?.actualDurationMinutes ?? log?.durationMinutes ?? '', feeling: log?.feeling ?? log?.perceivedEffort ?? '', notes: log?.notes ?? '', completedAt: log?.completedAt ?? '' };
  }));
  const weekRows = summaries.map((summary) => ({ athleteName: summary.athleteName, weekNumber: summary.weekNumber, phase: summary.phase, weekType: summary.weekType, workoutId: `week-${summary.weekNumber}`, workoutTitle: 'Week summary', category: 'week', type: 'summary', plannedDay: `${summary.weekStart} to ${summary.weekEnd}`, status: 'closed', plannedDistanceKm: `${summary.targetKmMin}-${summary.targetKmMax}`, actualDistanceKm: summary.actualKm, plannedDurationMin: `${summary.targetMinutesMin}-${summary.targetMinutesMax}`, actualDurationMin: summary.actualMinutes, feeling: '', notes: [summary.weeklyNote, summary.missedReason].filter(Boolean).join(' | '), completedAt: summary.closedAt }));
  return csv([...rows, ...weekRows], columns);
}

function quote(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
