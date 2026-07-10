import type { PhaseBlockTemplate, PhaseDefinition } from './planTypes';

export const trainingPhases: PhaseDefinition[] = [
  {
    id: 'base',
    name: 'Base',
    description: 'Establish repeatable aerobic frequency and durable easy volume.',
    primaryAdaptations: ['aerobic capacity', 'tissue tolerance', 'routine consistency'],
    typicalFoundationWorkouts: ['easy_run', 'long_run', 'strides'],
    notes: ['Intensity is light and mostly neuromuscular through strides or hills.'],
  },
  {
    id: 'build',
    name: 'Build',
    description: 'Gradually add structured quality while continuing aerobic development.',
    primaryAdaptations: ['threshold development', 'running economy', 'weekly load tolerance'],
    typicalFoundationWorkouts: ['easy_run', 'long_run', 'threshold', 'hill_repeats'],
    notes: ['Hard sessions stay limited and well-spaced.'],
  },
  {
    id: 'specific',
    name: 'Specific',
    description: 'Shift key work toward the demands of the target race distance.',
    primaryAdaptations: ['race specificity', 'fatigue resistance', 'pacing skill'],
    typicalFoundationWorkouts: ['easy_run', 'long_run', 'threshold', 'race_pace'],
    notes: ['Specificity rises without abandoning easy aerobic support.'],
  },
  {
    id: 'peak',
    name: 'Peak',
    description: 'Reach the highest specific fitness before unloading.',
    primaryAdaptations: ['specific endurance', 'confidence', 'sharpening'],
    typicalFoundationWorkouts: ['easy_run', 'long_run', 'race_pace', 'intervals'],
    notes: ['Peak weeks are demanding and should not be stacked indefinitely.'],
  },
  {
    id: 'taper',
    name: 'Taper',
    description: 'Reduce volume while preserving rhythm, freshness, and race feel.',
    primaryAdaptations: ['fatigue reduction', 'fitness preservation', 'neuromuscular freshness'],
    typicalFoundationWorkouts: ['easy_run', 'race_pace', 'strides'],
    notes: ['Volume drops more than intensity.'],
  },
  {
    id: 'race_week',
    name: 'Race Week',
    description: 'Keep the athlete fresh, calm, and ready for the event.',
    primaryAdaptations: ['readiness', 'confidence', 'recovery'],
    typicalFoundationWorkouts: ['easy_run', 'shakeout', 'race_pace'],
    notes: ['No fitness is forced during race week.'],
  },
];

export const sixteenWeekPhaseTemplate: PhaseBlockTemplate[] = [
  { phase: 'base', startWeek: 1, endWeek: 4, weekTypePattern: ['normal', 'normal', 'normal', 'recovery'] },
  { phase: 'build', startWeek: 5, endWeek: 8, weekTypePattern: ['normal', 'normal', 'normal', 'recovery'] },
  { phase: 'specific', startWeek: 9, endWeek: 11, weekTypePattern: ['normal', 'normal', 'recovery'] },
  { phase: 'peak', startWeek: 12, endWeek: 13, weekTypePattern: ['peak', 'peak'] },
  { phase: 'taper', startWeek: 14, endWeek: 15, weekTypePattern: ['normal', 'recovery'] },
  { phase: 'race_week', startWeek: 16, endWeek: 16, weekTypePattern: ['race'] },
];
