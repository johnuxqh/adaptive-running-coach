import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout } from '../engine/planTypes';
import type { WorkoutLog } from '../engine/types';
import type { PlannerState, WeekSummary } from './exportUtils';
import { resolveWeek, type CompletionLog, type ResolvedWorkout } from './planning';
import { readStorageValue, storageKeys, writeStorageValue } from './storage';

export type CoachReportPayload = {
  source: 'life-fit-running-coach';
  version: '0.1';
  sentAt: string;
  athlete: { name: string; raceDistance: string; raceDate: string; goal: string };
  weekSummary: {
    id: string; weekNumber: number; phase: string; weekType: string; weekStart: string; weekEnd: string;
    foundationPlanned: number; foundationCompleted: number; optionalPlanned: number; optionalCompleted: number; extraCompleted: number;
    targetKmMin: number; targetKmMax: number; actualKm: number; targetMinutesMin: number; targetMinutesMax: number; actualMinutes: number;
    weeklyNote: string; missedReason: string; closedAt: string;
  };
  workouts: CoachReportWorkout[];
};

export type CoachReportWorkout = {
  workoutId: string;
  workoutTitle: string;
  category: string;
  type: string;
  plannedDay: string;
  status: string;
  plannedDistanceKm: number | '';
  actualDistanceKm: number | '';
  plannedDurationMin: number | '';
  actualDurationMin: number | '';
  feeling: string | number;
  notes: string;
  completedAt: string;
};

export type PendingCoachSync = { id: string; webhookUrl: string; payload: CoachReportPayload; savedAt: string };


export async function sendCoachReport(webhookUrl: string, payload: CoachReportPayload): Promise<void> {
  await postJson(webhookUrl, payload);
}

export async function testCoachWebhook(webhookUrl: string): Promise<void> {
  await postJson(webhookUrl, { source: 'life-fit-running-coach', type: 'test', sentAt: new Date().toISOString() });
}

export function savePendingSync(webhookUrl: string, payload: CoachReportPayload): void {
  const pending = readStorageValue<PendingCoachSync[]>(storageKeys.pendingSync, []);
  writeStorageValue(storageKeys.pendingSync, [...pending.filter((item) => item.payload.weekSummary.id !== payload.weekSummary.id), { id: `${payload.weekSummary.id}-${Date.now()}`, webhookUrl, payload, savedAt: new Date().toISOString() }]);
}

export async function retryPendingSync(webhookUrl?: string): Promise<{ sent: number; failed: number }> {
  const pending = readStorageValue<PendingCoachSync[]>(storageKeys.pendingSync, []);
  const remaining: PendingCoachSync[] = [];
  let sent = 0;
  for (const item of pending) {
    try {
      await sendCoachReport(webhookUrl || item.webhookUrl, item.payload);
      sent += 1;
    } catch {
      remaining.push(item);
    }
  }
  writeStorageValue(storageKeys.pendingSync, remaining);
  return { sent, failed: remaining.length };
}

export function clearPendingSync(): void {
  writeStorageValue(storageKeys.pendingSync, []);
}

export function getPendingSyncCount(): number {
  return readStorageValue<PendingCoachSync[]>(storageKeys.pendingSync, []).length;
}

export function buildCoachReportPayload(plan: GeneratedTrainingPlan, week: GeneratedTrainingWeek, planner: PlannerState, logs: WorkoutLog[], summary: WeekSummary): CoachReportPayload {
  const allWorkouts = resolveWeek(week, planner, logs as CompletionLog[]).workouts;
  return {
    source: 'life-fit-running-coach',
    version: '0.1',
    sentAt: new Date().toISOString(),
    athlete: { name: plan.summary.athleteName, raceDistance: plan.summary.raceDistance, raceDate: plan.summary.raceDate, goal: plan.inputs.raceGoal },
    weekSummary: {
      id: summary.id, weekNumber: summary.weekNumber, phase: summary.phase, weekType: summary.weekType, weekStart: summary.weekStart, weekEnd: summary.weekEnd,
      foundationPlanned: summary.foundationPlanned, foundationCompleted: summary.foundationCompleted, optionalPlanned: summary.optionalPlanned, optionalCompleted: summary.optionalCompleted, extraCompleted: summary.extraCompleted,
      targetKmMin: summary.targetKmMin, targetKmMax: summary.targetKmMax, actualKm: summary.actualKm, targetMinutesMin: summary.targetMinutesMin, targetMinutesMax: summary.targetMinutesMax, actualMinutes: summary.actualMinutes,
      weeklyNote: summary.weeklyNote, missedReason: summary.missedReason, closedAt: summary.closedAt,
    },
    workouts: allWorkouts.map(buildWorkoutPayload),
  };
}

function buildWorkoutPayload(workout: ResolvedWorkout): CoachReportWorkout {
  const log = workout.completion;
  return {
    workoutId: workout.id,
    workoutTitle: workout.title,
    category: workout.category,
    type: workout.type,
    plannedDay: workout.assignedDay ?? 'Unplanned',
    status: workout.status,
    plannedDistanceKm: workout.plannedDistanceKm ?? '',
    actualDistanceKm: log?.actualDistanceKm ?? log?.distanceKm ?? '',
    plannedDurationMin: workout.plannedDurationMin ?? '',
    actualDurationMin: log?.actualDurationMinutes ?? log?.durationMinutes ?? '',
    feeling: log?.feeling ?? log?.perceivedEffort ?? '',
    notes: log?.notes ?? '',
    completedAt: log?.completedAt ?? '',
  };
}

async function postJson(webhookUrl: string, payload: unknown): Promise<void> {
  const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Coach report failed with ${response.status}`);
}
