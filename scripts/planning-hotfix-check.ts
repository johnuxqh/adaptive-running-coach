import { appendCompactDurationLabel, buildHistoricalWeekSummary, buildSuggestedPlanner, resolveWeek, suggestedDateForWorkout } from '../src/utils/planning';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout } from '../src/engine/planTypes';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const makeWorkout = (id: string, suggestedDay: string, overrides: Partial<GeneratedWorkout> = {}): GeneratedWorkout => ({
  id,
  weekNumber: 2,
  title: 'Easy Run 32 min',
  type: 'easy_run',
  category: 'foundation',
  plannedDurationMin: 32,
  intensity: 'Easy',
  purpose: 'Regression fixture',
  warmup: 'Warm up',
  mainSet: 'Run',
  cooldown: 'Cool down',
  coachTip: 'Keep it easy',
  suggestedDay,
  status: 'planned',
  ...overrides,
});

const race = makeWorkout('race-week-2', 'Sunday', { title: 'Half Marathon Tune-Up', type: 'race', plannedDistanceKm: 21.1, plannedDurationMin: undefined });
const easy = makeWorkout('easy-week-2', 'Tuesday');
const week: GeneratedTrainingWeek = {
  id: 'week-2',
  weekNumber: 2,
  startsOn: '2026-07-13',
  endsOn: '2026-07-19',
  phase: 'base',
  weekType: 'normal',
  targetDistanceRangeKm: { min: 20, max: 30 },
  targetDurationRangeMin: { min: 120, max: 180 },
  foundationWorkouts: [race, easy],
  optionalWorkouts: [],
  coachingMessage: 'Tune up race week.',
  warnings: [],
};
const plan: GeneratedTrainingPlan = { id: 'plan', inputs: {} as GeneratedTrainingPlan['inputs'], weeksFromNowToRaceWeek: 2, weeks: [week], summary: {} as GeneratedTrainingPlan['summary'], warnings: [] };

const validMove = buildSuggestedPlanner(plan, { assignments: { [race.id]: '2026-07-18', [easy.id]: '2026-07-14' }, extraWorkouts: [] });
assert(validMove.assignments[race.id] === '2026-07-18', 'valid athlete move inside the week should be preserved');
assert(validMove.assignments[easy.id] === '2026-07-14', 'valid assignment inside the week should be preserved');

for (const stale of ['2026-07-12', '2026-07-20', 'not-a-date']) {
  const repaired = buildSuggestedPlanner(plan, { assignments: { [race.id]: stale }, extraWorkouts: [] });
  assert(repaired.assignments[race.id] === suggestedDateForWorkout(week, race), `stale assignment ${stale} should repair to suggested date`);
}

const repairedRacePlanner = buildSuggestedPlanner(plan, { assignments: { [race.id]: '2026-07-12', [easy.id]: '2026-07-14' }, extraWorkouts: [] });
const resolvedRaceWeek = resolveWeek(week, repairedRacePlanner, []);
const raceInstances = resolvedRaceWeek.workouts.filter((workout) => workout.type === 'race' && workout.assignedDay === '2026-07-19');
assert(raceInstances.length === 1, 'intermediate race should appear exactly once on the suggested in-week date');
assert(resolvedRaceWeek.workouts.find((workout) => workout.id === race.id)?.status === 'planned', 'intermediate race should not disappear as Rest/unplanned');

assert(appendCompactDurationLabel('Recovery Jog 21 min', 21) === 'Recovery Jog 21 min', 'compact label should not duplicate an existing duration');
assert(appendCompactDurationLabel('Threshold Intervals', 48) === 'Threshold Intervals · 48 min', 'compact label should add a missing duration');

const archivedLogs = [{ id: 'log-easy', workoutId: easy.id, completedAt: '2026-07-14T12:00:00.000Z', status: 'completed' as const, actualDistanceKm: 4.9, actualDurationMinutes: 32, perceivedEffort: 4, journalNote: 'Work stress was high.' }];
const historical = buildHistoricalWeekSummary(week, resolveWeek(week, validMove, archivedLogs).workouts, { weekNumber: 2, archived: true, completedAt: '2026-07-20T08:00:00.000Z', weeklyReflection: 'Sunday helped.', metrics: { plannedWorkouts: 6, completedWorkouts: 5, actualDistanceKm: 42.8, actualDurationMinutes: 252 } });
assert(historical.metrics.plannedWorkouts === 6 && historical.metrics.completedWorkouts === 5, 'archived stored completion metrics should be preferred when available');
assert(historical.storyWorkouts.some((workout) => workout.id === race.id && !workout.completion), 'incomplete archived workouts should remain visible in the story');
assert(historical.storyWorkouts.some((workout) => workout.completion?.perceivedEffort === 4 && workout.completion.journalNote === 'Work stress was high.'), 'workout effort and journal note should remain attached to historical story items');
assert(historical.coachSummary.some((line) => line.includes('weekly reflection')), 'coach summary should acknowledge a saved weekly reflection without interpreting it');
const olderHistorical = buildHistoricalWeekSummary(week, resolveWeek(week, validMove, []).workouts, { weekNumber: 2, archived: true, completedAt: '2026-07-20T08:00:00.000Z' });
assert(olderHistorical.metrics.plannedWorkouts === 2 && olderHistorical.metrics.completedWorkouts === 0, 'older archived records without metrics should derive safe counts');
