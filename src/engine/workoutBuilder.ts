import type { GeneratedWorkout, PlanGeneratorMilestoneRace, RaceType, TrainingPhase, WeekType } from './planTypes';

const EASY_PACE_MIN_PER_KM = 6.5;
const QUALITY_SHARE = 0.22;
const EASY_SHARE = 0.2;
const SECOND_EASY_SHARE = 0.18;
const RECOVERY_SHARE = 0.12;

export function buildWorkouts(input: {
  race: RaceType;
  weekNumber: number;
  phase: TrainingPhase;
  weekType: WeekType;
  weeklyKm: number;
  longRunKm: number;
  runsPerWeek: number;
  milestone?: PlanGeneratorMilestoneRace;
  raceDate: string;
}): { foundation: GeneratedWorkout[]; optional: GeneratedWorkout[]; warnings: string[] } {
  const warnings: string[] = [];
  const foundation: GeneratedWorkout[] = [];
  const optional: GeneratedWorkout[] = [];
  const add = (workout: Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'>, bucket = foundation) => bucket.push({ ...workout, id: `w${input.weekNumber}-${bucket.length + 1}-${workout.type}`, weekNumber: input.weekNumber, status: 'unplanned' });

  if (input.weekType === 'race') {
    add(easy('Easy Run', Math.max(4, input.weeklyKm * 0.18), 'Tuesday'));
    add(shakeout('Shakeout 20 min', 'Saturday'), optional);
    add(raceWorkout(input));
    return { foundation, optional, warnings };
  }

  const milestone = input.milestone;
  add(easy('Easy Run', input.weeklyKm * EASY_SHARE, 'Tuesday'));

  if (milestone) {
    warnings.push('Milestone race replaces a key workout this week. Keep the days around it very easy.');
    add(milestoneWorkout(input, milestone));
  } else if (input.weekType !== 'recovery') {
    add(quality(input));
  } else {
    add(easy('Light Easy Run', input.weeklyKm * QUALITY_SHARE, 'Thursday'));
  }

  if (input.runsPerWeek >= 4) {
    add(easy('Easy Run', input.weeklyKm * SECOND_EASY_SHARE, 'Friday'));
  } else {
    add(easy('Optional Easy Run', input.weeklyKm * SECOND_EASY_SHARE, 'Friday'), optional);
  }

  if (!milestone) add(longRun(input.longRunKm, input));

  optional.push(optionalRecovery(input.weekNumber, input.weeklyKm * RECOVERY_SHARE));
  if (input.runsPerWeek >= 5) optional.push(optionalEasy(input.weekNumber, input.weeklyKm * 0.14));
  if (input.runsPerWeek >= 6) optional.push(optionalMobility(input.weekNumber));

  return { foundation, optional, warnings };
}

function minutes(km: number): number { return Math.round(km * EASY_PACE_MIN_PER_KM); }
function roundKm(km: number): number { return Math.round(km * 10) / 10; }

function easy(title: string, km: number, day: string): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> {
  const distance = roundKm(km);
  return { title: `${title} ${minutes(distance)} min Zone 2`, type: 'easy_run', category: 'foundation', plannedDistanceKm: distance, plannedDurationMin: minutes(distance), intensity: 'Easy Zone 2', purpose: 'Build aerobic fitness with low stress.', warmup: 'Start relaxed for 5–10 minutes.', mainSet: 'Run conversationally and keep effort controlled.', cooldown: 'Finish with easy jogging or walking.', coachTip: 'You should finish feeling like you could keep going.', suggestedDay: day };
}

function longRun(km: number, input: { phase: TrainingPhase; race: RaceType }): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> {
  const distance = roundKm(km);
  const steady = input.phase === 'specific' || input.phase === 'peak';
  return { title: steady && input.race === 'marathon' ? `Long Run ${distance} km with last 5 km steady` : `Long Run ${distance} km Zone 2`, type: 'long_run', category: 'foundation', plannedDistanceKm: distance, plannedDurationMin: minutes(distance), intensity: steady ? 'Easy to steady' : 'Easy Zone 2', purpose: 'Develop endurance, durability, and confidence.', warmup: 'First 10 minutes very relaxed.', mainSet: steady ? 'Run mostly easy; finish the final controlled segment steady, not hard.' : 'Keep the full run comfortable and aerobic.', cooldown: 'Walk and refuel soon after finishing.', coachTip: 'Protect this workout, but never force it through pain or illness.', suggestedDay: 'Sunday' };
}

function quality(input: { weekNumber: number; phase: TrainingPhase; weeklyKm: number; race: RaceType }): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> {
  const distance = roundKm(input.weeklyKm * QUALITY_SHARE);
  const isSpecific = input.phase === 'specific' || input.phase === 'peak';
  const title = isSpecific ? (input.race === '5k' || input.race === '10k' ? 'Intervals 6 x 2 min' : 'Threshold 4 x 6 min') : 'Threshold 3 x 6 min';
  return { title, type: 'quality_session', category: 'foundation', plannedDistanceKm: distance, plannedDurationMin: minutes(distance), intensity: isSpecific ? 'Controlled hard' : 'Comfortably hard', purpose: 'Improve sustainable speed while keeping one clear hard session.', warmup: '10–15 minutes easy plus a few relaxed strides.', mainSet: isSpecific ? 'Run the repetitions controlled with easy recoveries.' : 'Run controlled threshold repeats with 2 minutes easy jog recovery.', cooldown: '10 minutes easy.', coachTip: 'Finish with one more rep in reserve.', suggestedDay: 'Wednesday' };
}

function milestoneWorkout(input: { weekNumber: number }, race: PlanGeneratorMilestoneRace): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> {
  return { title: `${race.name} milestone race`, type: 'race', category: 'foundation', intensity: 'Race effort, controlled', purpose: 'Use the milestone as a supported long-run or quality substitute.', warmup: 'Jog easily and add a few relaxed strides.', mainSet: `Run the ${race.distance} milestone with discipline; do not chase extra fitness afterward.`, cooldown: 'Walk, refuel, and keep the next day very easy.', coachTip: 'This replaces—not adds to—the weekly key session.', suggestedDay: 'Sunday', warningIds: [`milestone_race_week_${input.weekNumber}`] };
}

function raceWorkout(input: { race: RaceType; raceDate: string }): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> {
  return { title: `${input.race} Race Day`, type: 'race', category: 'foundation', intensity: 'Race effort', purpose: 'Execute the goal race fresh and confident.', warmup: 'Use your familiar pre-race warmup.', mainSet: 'Race calmly from the start and build only when settled.', cooldown: 'Walk, hydrate, and celebrate the work.', coachTip: 'Trust the work. Nothing new on race day.', suggestedDay: input.raceDate };
}

function shakeout(title: string, day: string): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> { return { title, type: 'shakeout', category: 'optional', plannedDurationMin: 20, intensity: 'Very easy', purpose: 'Loosen up without adding fatigue.', warmup: 'Walk first if stiff.', mainSet: 'Jog very easily.', cooldown: 'Stop while you feel fresh.', coachTip: 'Optional means optional.', suggestedDay: day }; }
function optionalRecovery(weekNumber: number, km: number): GeneratedWorkout { return { ...easy('Recovery Jog', km, 'Monday or Saturday'), id: `w${weekNumber}-optional-recovery`, weekNumber, type: 'recovery', category: 'optional', intensity: 'Very easy', status: 'unplanned' }; }
function optionalEasy(weekNumber: number, km: number): GeneratedWorkout { return { ...easy('Optional Easy Run', km, 'Flexible'), id: `w${weekNumber}-optional-easy`, weekNumber, category: 'optional', status: 'unplanned' }; }
function optionalMobility(weekNumber: number): GeneratedWorkout { return { id: `w${weekNumber}-optional-mobility`, weekNumber, title: 'Mobility 20 min', type: 'mobility', category: 'optional', plannedDurationMin: 20, intensity: 'Very easy', purpose: 'Support recovery and movement quality.', warmup: 'Move gently.', mainSet: 'Light mobility and activation.', cooldown: 'Breathe slowly and relax.', coachTip: 'Keep it restorative.', suggestedDay: 'Flexible', status: 'unplanned' }; }
