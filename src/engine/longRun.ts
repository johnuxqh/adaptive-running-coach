export const longRunRules = [
  {
    id: 'long_run_weekly_anchor',
    rule: 'The long run is the primary endurance anchor for 10k through marathon plans and a useful aerobic anchor for 5k plans.',
    reason: 'Long-term endurance performance depends on repeated exposure to extended aerobic work.',
  },
  {
    id: 'long_run_share_of_week',
    rule: 'The long run should usually remain a controlled share of weekly volume rather than an isolated overload.',
    reason: 'Balanced weekly load is safer and more repeatable than one disproportionately large session.',
  },
  {
    id: 'marathon_specific_long_runs',
    rule: 'Marathon long runs may include race-specific segments only in specific and peak phases.',
    reason: 'Fueling and race-pace durability matter most after an aerobic base exists.',
  },
] as const;

export const longRunDevelopmentByRace = {
  '5k': { minimumMinutes: 45, maximumMinutes: 90, emphasis: 'General aerobic durability.' },
  '10k': { minimumMinutes: 55, maximumMinutes: 105, emphasis: 'Aerobic endurance plus late-race strength.' },
  '15k': { minimumMinutes: 65, maximumMinutes: 120, emphasis: 'Sustained endurance and threshold support.' },
  half_marathon: { minimumMinutes: 75, maximumMinutes: 150, emphasis: 'Endurance and fatigue resistance near race duration.' },
  marathon: { minimumMinutes: 90, maximumMinutes: 210, emphasis: 'Durability, fueling practice, and marathon-specific endurance.' },
} as const;
