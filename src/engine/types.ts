export type RaceDistance = '5k' | '10k' | 'half_marathon' | 'marathon' | 'custom';

export type WorkoutType = 'easy' | 'long' | 'tempo' | 'interval' | 'recovery' | 'rest' | 'strength' | 'race';

export type WorkoutStatus = 'planned' | 'scheduled' | 'completed' | 'skipped';

export interface RaceGoal {
  distance: RaceDistance;
  raceDate?: string;
  targetTime?: string;
  goalDescription?: string;
}

export interface MilestoneRace {
  id: string;
  name: string;
  date: string;
  distance: RaceDistance;
  notes?: string;
}

export interface AthleteProfile {
  id: string;
  name?: string;
  experienceLevel?: 'new' | 'returning' | 'consistent' | 'experienced';
  currentWeeklyVolume?: number;
  preferredRunDays?: string[];
  raceGoal?: RaceGoal;
  milestoneRaces?: MilestoneRace[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutCard {
  id: string;
  title: string;
  type: WorkoutType;
  status: WorkoutStatus;
  weekNumber: number;
  plannedDay?: string;
  durationMinutes?: number;
  distanceKm?: number;
  effort?: string;
  notes?: string;
}

export interface TrainingWeek {
  id: string;
  weekNumber: number;
  startsOn: string;
  focus?: string;
  targetDistanceKm?: number;
  targetDurationMinutes?: number;
  workouts: WorkoutCard[];
}

export interface TrainingPlan {
  id: string;
  profileId: string;
  title: string;
  raceGoal?: RaceGoal;
  weeks: TrainingWeek[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  completedAt: string;
  durationMinutes?: number;
  distanceKm?: number;
  perceivedEffort?: number;
  notes?: string;
}

export interface WeekSummary {
  weekId: string;
  completedWorkoutIds: string[];
  skippedWorkoutIds: string[];
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  reflection?: string;
  closedAt?: string;
}
