export const progressionConstants = {
  maximumWeeklyDurationIncreasePercent: 10,
  preferredWeeklyDurationIncreasePercent: 5,
  recoveryWeekFrequencyWeeks: 4,
  recoveryWeekReductionPercentRange: { min: 15, max: 30 },
  taperReductionPercentRange: { min: 20, max: 60 },
  minimumFoundationSessionsPerWeek: 3,
  maximumHardSessionsPerWeek: 2,
  maximumRacePaceSessionsPerWeek: 1,
} as const;

export const progressionRules = [
  {
    id: 'weekly_duration_progression',
    name: 'Weekly duration progression',
    rule: 'Increase total weekly duration conservatively, usually around 5% and never more than 10% in normal build weeks.',
    reason: 'Progressive overload works best when the athlete can absorb the load and keep training consistently.',
  },
  {
    id: 'long_run_progression',
    name: 'Long run progression',
    rule: 'Progress the long run gradually for two to three weeks, then reduce it during a recovery week.',
    reason: 'Long runs create large endurance stimulus but also high musculoskeletal cost.',
  },
  {
    id: 'threshold_progression',
    name: 'Threshold progression',
    rule: 'Progress threshold by extending total controlled work before increasing intensity.',
    reason: 'Threshold gains come from sustainable aerobic stress, not racing the workout.',
  },
  {
    id: 'optional_run_progression',
    name: 'Optional workout progression',
    rule: 'Add optional workouts only after foundation workouts are consistently completed and recovery markers are stable.',
    reason: 'Optional volume should support the plan, not compete with the key weekly anchors.',
  },
  {
    id: 'recovery_week_frequency',
    name: 'Recovery week frequency',
    rule: 'Schedule a recovery week about every fourth week, or sooner for newer athletes or high life stress.',
    reason: 'Adaptation requires planned unloading before fatigue becomes forced downtime.',
  },
  {
    id: 'taper_reductions',
    name: 'Taper reductions',
    rule: 'Reduce volume in taper phases while retaining small touches of intensity and race rhythm.',
    reason: 'Tapering preserves fitness while reducing fatigue before race day.',
  },
] as const;
