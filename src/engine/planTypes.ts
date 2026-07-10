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
