import type { AthleteProfile, TrainingPlan, WorkoutLog, WeekSummary } from '../engine/types';

export const storageKeys = {
  profile: 'lfrc_profile',
  plan: 'lfrc_plan',
  currentWeek: 'lfrc_current_week',
  workoutLogs: 'lfrc_workout_logs',
  settings: 'lfrc_settings',
} as const;

export type StorageKey = (typeof storageKeys)[keyof typeof storageKeys];

export interface LifeFitSettings {
  distanceUnit: 'km' | 'mi';
  weekStartsOn: 'monday' | 'sunday';
}

export interface LifeFitStorageShape {
  [storageKeys.profile]: AthleteProfile | null;
  [storageKeys.plan]: TrainingPlan | null;
  [storageKeys.currentWeek]: WeekSummary | null;
  [storageKeys.workoutLogs]: WorkoutLog[];
  [storageKeys.settings]: LifeFitSettings;
}

export const defaultSettings: LifeFitSettings = {
  distanceUnit: 'km',
  weekStartsOn: 'monday',
};

export function readStorageValue<T>(key: StorageKey, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

export function writeStorageValue<T>(key: StorageKey, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageValue(key: StorageKey): void {
  window.localStorage.removeItem(key);
}

export function hasAthleteProfile(): boolean {
  return readStorageValue<AthleteProfile | null>(storageKeys.profile, null) !== null;
}
