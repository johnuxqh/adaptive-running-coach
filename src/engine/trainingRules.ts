import type { WorkoutId } from './planTypes';

export const foundationRules = [
  {
    id: 'hard_sessions_spaced',
    rule: 'Hard foundation sessions should be separated by at least one easy, recovery, walk, mobility, or rest day.',
    reason: 'Fitness improves during adaptation; spacing quality sessions protects consistency and lowers injury risk.',
    appliesTo: ['threshold', 'intervals', 'tempo', 'race_pace', 'hill_repeats'] satisfies WorkoutId[],
  },
  {
    id: 'threshold_not_after_threshold',
    rule: 'Threshold should not follow Threshold.',
    reason: 'Back-to-back sustained metabolic stress increases fatigue faster than it improves threshold fitness.',
    appliesTo: ['threshold'] satisfies WorkoutId[],
  },
  {
    id: 'long_run_after_easy_preferred',
    rule: 'Long Run is preferred after Easy Run, Recovery Run, Walk, Mobility, or rest.',
    reason: 'A fresher athlete can keep the long run aerobic and mechanically smooth.',
    appliesTo: ['long_run'] satisfies WorkoutId[],
  },
  {
    id: 'long_run_not_after_threshold_where_possible',
    rule: 'Long Run should not follow Threshold, Tempo, Intervals, Race Pace, or Hill Repeats where possible.',
    reason: 'Stacking long duration on residual intensity fatigue changes the session from endurance development to survival.',
    appliesTo: ['long_run'] satisfies WorkoutId[],
  },
  {
    id: 'intervals_require_recovery',
    rule: 'Intervals require recovery before and after unless the surrounding run is explicitly very easy.',
    reason: 'Fast running carries high neuromuscular and connective-tissue load.',
    appliesTo: ['intervals'] satisfies WorkoutId[],
  },
  {
    id: 'race_pace_limited',
    rule: 'Race Pace sessions are limited to specific, peak, and taper phases and should not dominate weekly volume.',
    reason: 'Specificity is valuable close to racing, but too much goal-pace work crowds out aerobic development.',
    appliesTo: ['race_pace'] satisfies WorkoutId[],
  },
  {
    id: 'minimum_foundation_sessions',
    rule: 'Every training week needs at least three foundation sessions unless it is a race week or clinical recovery week.',
    reason: 'A durable plan depends on repeatable weekly anchors rather than isolated heroic workouts.',
    appliesTo: ['easy_run', 'long_run', 'threshold'] satisfies WorkoutId[],
  },
] as const;

export const intensityWorkoutIds = ['threshold', 'intervals', 'tempo', 'race_pace', 'hill_repeats'] as const;
export const recoveryCompatibleWorkoutIds = ['easy_run', 'recovery_run', 'recovery_jog', 'walk', 'mobility'] as const;
