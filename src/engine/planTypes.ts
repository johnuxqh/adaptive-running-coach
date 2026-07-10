export type RaceType = '5k' | '10k' | '15k' | 'half_marathon' | 'marathon';

export type GoalType = 'first_race' | 'finish_comfortably' | 'personal_best' | 'race_competitively';

export type TrainingPhase = 'base' | 'build' | 'specific' | 'peak' | 'taper' | 'race_week';

export type WeekType = 'normal' | 'recovery' | 'peak' | 'race';

export type WorkoutPriority = 'foundation' | 'optional';

export type WorkoutCategory =
  | 'aerobic'
  | 'recovery'
  | 'endurance'
  | 'threshold'
  | 'speed'
  | 'strength'
  | 'race_specific'
  | 'mobility';

export type Intensity = 'very_easy' | 'easy' | 'moderate' | 'comfortably_hard' | 'hard' | 'race_specific';

export type WorkoutId =
  | 'easy_run'
  | 'recovery_run'
  | 'long_run'
  | 'threshold'
  | 'intervals'
  | 'tempo'
  | 'race_pace'
  | 'hill_repeats'
  | 'strides'
  | 'recovery_jog'
  | 'shakeout'
  | 'easy_double'
  | 'cross_training'
  | 'walk'
  | 'mobility';

export interface DurationRange {
  minMinutes: number;
  maxMinutes: number;
}

export interface CountRange {
  min: number;
  max: number;
}

export interface WorkoutDefinition {
  id: WorkoutId;
  name: string;
  description: string;
  purpose: string;
  trainingEffect: string;
  typicalDuration: DurationRange;
  intensity: Intensity;
  priority: WorkoutPriority;
  category: WorkoutCategory;
  colourToken: string;
  icon: string;
  minimumRecoveryAfterHours: number;
  canFollow: WorkoutId[] | 'any';
  cannotFollow: WorkoutId[];
}

export interface PhaseDefinition {
  id: TrainingPhase;
  name: string;
  description: string;
  primaryAdaptations: string[];
  typicalFoundationWorkouts: WorkoutId[];
  notes: string[];
}

export interface PhaseBlockTemplate {
  phase: TrainingPhase;
  startWeek: number;
  endWeek: number;
  weekTypePattern: WeekType[];
}

export interface PlanTemplateDefinition {
  race: RaceType;
  name: string;
  minimumWeeks: number;
  maximumWeeks: number;
  preferredWeeks: number;
  typicalWeeklyFoundationCount: number;
  optionalWorkoutCount: CountRange;
  minimumLongRunMinutes: number;
  maximumLongRunMinutes: number;
  foundationWorkoutMix: WorkoutId[];
  emphasis: string[];
}

export interface PlanGeneratorMilestoneRace {
  id?: string;
  name: string;
  date: string;
  distance: RaceType;
}

export interface PlanGeneratorInput {
  athleteName: string;
  raceDistance: RaceType;
  raceDate: string;
  raceGoal: string;
  currentWeeklyKm: number;
  longestRunKm: number;
  runsPerWeek: 3 | 4 | 5 | 6;
  milestoneRaces?: PlanGeneratorMilestoneRace[];
  currentDate?: string;
}

export type GeneratedWorkoutType =
  | 'easy_run'
  | 'quality_session'
  | 'long_run'
  | 'recovery'
  | 'shakeout'
  | 'cross_training'
  | 'mobility'
  | 'race';

export type GeneratedWorkoutStatus = 'unplanned' | 'planned' | 'completed' | 'skipped';

export interface GeneratedWorkout {
  id: string;
  weekNumber: number;
  title: string;
  type: GeneratedWorkoutType;
  category: 'foundation' | 'optional' | 'extra';
  plannedDistanceKm?: number;
  plannedDurationMin?: number;
  intensity: string;
  purpose: string;
  warmup: string;
  mainSet: string;
  cooldown: string;
  coachTip: string;
  suggestedDay: string;
  status: GeneratedWorkoutStatus;
  warningIds?: string[];
}

export interface GeneratedTrainingWeek {
  id: string;
  weekNumber: number;
  startsOn: string;
  endsOn: string;
  phase: TrainingPhase;
  weekType: WeekType;
  targetDistanceRangeKm: { min: number; max: number };
  targetDurationRangeMin: { min: number; max: number };
  foundationWorkouts: GeneratedWorkout[];
  optionalWorkouts: GeneratedWorkout[];
  coachingMessage: string;
  warnings: string[];
}

export interface GeneratedPlanSummary {
  athleteName: string;
  raceDistance: RaceType;
  raceDate: string;
  daysUntilRace: number;
  trainingWeeks: number;
  totalFoundationWorkouts: number;
  totalOptionalWorkouts: number;
  estimatedDistanceRangeKm: { min: number; max: number };
  estimatedTimeRangeMin: { min: number; max: number };
  planEmphasis: string[];
  planWarnings: string[];
  rules: string[];
}

export interface GeneratedTrainingPlan {
  id: string;
  inputs: PlanGeneratorInput;
  weeksFromNowToRaceWeek: number;
  weeks: GeneratedTrainingWeek[];
  summary: GeneratedPlanSummary;
  warnings: import('./warnings').PlanWarning[];
}
