import { raceDistanceKm } from './targets';
import type { GeneratedWorkout, PlanGeneratorMilestoneRace, RaceType, TrainingPhase, WeekType } from './planTypes';

const EASY_PACE_MIN_PER_KM = 6.5;
const QUALITY_SHARE = 0.2;
const EASY_SHARE = 0.18;
const SECOND_EASY_SHARE = 0.16;
const RECOVERY_SHARE = 0.12;

type BuildInput = {
  race: RaceType;
  raceGoal: string;
  weekNumber: number;
  phase: TrainingPhase;
  weekType: WeekType;
  weeklyKm: number;
  longRunKm: number;
  runsPerWeek: number;
  milestone?: PlanGeneratorMilestoneRace;
  raceDate: string;
  phaseWeekNumber?: number;
};

export function buildWorkouts(input: BuildInput): { foundation: GeneratedWorkout[]; optional: GeneratedWorkout[]; warnings: string[] } {
  const warnings: string[] = [];
  const foundation: GeneratedWorkout[] = [];
  const optional: GeneratedWorkout[] = [];
  const add = (workout: Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'>, bucket = foundation) => bucket.push({ ...workout, id: `w${input.weekNumber}-${bucket.length + 1}-${workout.type}`, weekNumber: input.weekNumber, status: 'unplanned' });

  if (input.weekType === 'race') {
    add(easy('Easy Run', Math.max(3, input.weeklyKm * 0.14), 'Tuesday'));
    add(sharpening(input, 0.1, 'Thursday'));
    add(raceWorkout(input));
    add(shakeout('Optional Shakeout 15–20 min', 'Saturday'), optional);
    return { foundation, optional, warnings };
  }

  const milestone = input.milestone;
  add(easy('Easy Run', input.weeklyKm * EASY_SHARE, 'Tuesday'));

  if (milestone) {
    warnings.push('Milestone race replaces a key workout this week. Keep the days before and after very easy.');
    add(easy('Mini-taper Easy Run', input.weeklyKm * 0.14, 'Thursday'));
    add(milestoneWorkout(input, milestone));
  } else if (input.weekType === 'recovery') {
    add(recoveryQuality(input));
    if (input.runsPerWeek >= 4) add(easy('Recovery Run', input.weeklyKm * SECOND_EASY_SHARE, 'Friday'));
    add(longRun(input.longRunKm, input));
  } else {
    add(quality(input));
    if (allowSecondary(input)) add(secondaryStimulus(input));
    if (input.runsPerWeek >= 4) add(easy(input.runsPerWeek >= 6 && allowSecondary(input) ? 'Easy Aerobic Run' : 'Easy Run', input.weeklyKm * SECOND_EASY_SHARE, 'Friday'));
    if (input.runsPerWeek >= 5) add(easy('Easy Aerobic Run', input.weeklyKm * 0.12, 'Saturday'));
    add(longRun(input.longRunKm, input));
  }

  if (!milestone && input.weekType !== 'recovery' && input.runsPerWeek < 4) add(easy('Optional Easy Run', input.weeklyKm * SECOND_EASY_SHARE, 'Friday'), optional);
  optional.push(optionalRecovery(input.weekNumber, input.weeklyKm * RECOVERY_SHARE));
  if (input.runsPerWeek >= 5) optional.push(optionalMobility(input.weekNumber));

  if (foundation.length > input.runsPerWeek) warnings.push('Foundation workouts exceed selected run frequency; move only optional work if you need more recovery.');
  return { foundation: foundation.slice(0, input.runsPerWeek), optional, warnings };
}

function minutes(km: number): number { return Math.max(15, Math.round(km * EASY_PACE_MIN_PER_KM)); }
function roundKm(km: number): number { return Math.max(1, Math.round(km * 10) / 10); }
function competitive(goal: string) { return /personal best|competitively/i.test(goal); }
function shortRace(race: RaceType) { return race === '5k' || race === '10k'; }
function allowSecondary(input: BuildInput) { return input.runsPerWeek === 6 && competitive(input.raceGoal) && ['build', 'specific', 'peak'].includes(input.phase); }

function easy(title: string, km: number, day: string): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> {
  const distance = roundKm(km);
  const recovery = /recovery/i.test(title);
  return { title: `${title} ${minutes(distance)} min`, type: recovery ? 'recovery' : 'easy_run', category: 'foundation', plannedDistanceKm: distance, plannedDurationMin: minutes(distance), intensity: recovery ? 'Very easy' : 'Easy Zone 2', purpose: recovery ? 'Support recovery while maintaining consistency.' : 'Build aerobic endurance with low training stress.', warmup: 'Start with 5–10 minutes very relaxed.', mainSet: 'Run conversationally; keep breathing calm and form relaxed.', cooldown: 'Finish with 5 minutes easy jogging or walking.', coachTip: 'Easy means you could hold a full conversation.', suggestedDay: day };
}

function longRun(km: number, input: BuildInput): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> {
  const distance = roundKm(km);
  const recovery = input.weekType === 'recovery' || input.phase === 'taper';
  const weekMod = input.weekNumber % 4;
  let title = recovery ? `Reduced Easy Long Run ${distance} km` : `Easy Long Run ${distance} km`;
  let intensity = 'Easy Zone 2';
  let mainSet = 'Keep the full run comfortable and aerobic.';
  let purpose = 'Build endurance and durability for race day.';
  if (!recovery && input.phase === 'build' && input.race !== '5k') {
    if (weekMod === 1) { title = `Progressive Long Run ${distance} km`; intensity = 'Easy to steady'; mainSet = 'Run easy for most of the distance, then progress gently over the final 15–20 minutes.'; }
    if (weekMod === 2 && ['half_marathon', 'marathon'].includes(input.race)) { title = `Fuel Practice Long Run ${distance} km`; mainSet = 'Run easy and practise planned fluids and carbohydrate timing.'; purpose = 'Rehearse race-day nutrition and hydration while building endurance.'; }
  }
  if (!recovery && input.phase === 'specific') {
    if (input.race === 'marathon' && competitive(input.raceGoal) && weekMod === 1) { title = `Long Run ${distance} km with last 5 km steady`; intensity = 'Easy to marathon effort'; mainSet = 'Run easy, then finish the final 5 km steady around controlled marathon effort.'; }
    else if (input.race === 'marathon' && weekMod === 2) { title = `Fuel Practice Long Run ${distance} km`; mainSet = 'Run easy and rehearse race-day fuel and hydration exactly as planned.'; purpose = 'Rehearse race-day nutrition and hydration.'; }
    else if (input.race !== '5k') { title = `Progressive Long Run ${distance} km`; intensity = 'Easy to steady'; mainSet = 'Start easy, settle, and finish the last quarter steady but not hard.'; }
  }
  if (!recovery && input.phase === 'peak') {
    title = input.race === 'marathon' && competitive(input.raceGoal) ? `Final Peak Long Run ${distance} km with marathon-effort finish` : `Final Peak Long Run ${distance} km`;
    intensity = input.race === 'marathon' && competitive(input.raceGoal) ? 'Easy to marathon effort' : 'Easy to steady';
    mainSet = input.race === 'marathon' && competitive(input.raceGoal) ? 'Run mostly easy; finish the final 6–8 km at controlled marathon effort if feeling smooth.' : 'Run controlled and confident; no late-race heroics.';
  }
  return { title, type: 'long_run', category: 'foundation', plannedDistanceKm: distance, plannedDurationMin: minutes(distance), intensity, purpose, warmup: 'First 10 minutes very relaxed.', mainSet, cooldown: 'Walk 5 minutes, then refuel soon after finishing.', coachTip: recovery ? 'Absorb the work; no fast finish this week.' : 'Practise patience early so the finish stays controlled.', suggestedDay: 'Sunday' };
}

function quality(input: BuildInput): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> {
  const distance = roundKm(Math.max(4, input.weeklyKm * QUALITY_SHARE));
  const step = Math.max(0, (input.phaseWeekNumber ?? input.weekNumber) - 1);
  let title = 'Strides + light tempo';
  let intensity = 'Moderate';
  let purpose = 'Maintain running economy while building aerobic rhythm.';
  let mainSet = pickProgression(step, ['6 x 10 sec relaxed hill strides, walk back; then easy running.', 'Strides then 10 minutes light tempo, never straining.', 'Strides then 2 x 8 minutes controlled light tempo with 3 minutes easy.']);
  if (input.phase === 'build') {
    const sessions = [
      ['Controlled hill repeats', 'Build strength, power and running economy.', '8 x 60 sec uphill controlled-hard; jog down easy.'],
      ['Threshold intervals 3 x 5 min', 'Improve sustainable speed and lactate clearance.', '3 x 5 min threshold with 2 min easy jog.'],
      ['Cruise intervals 3 x 8 min', 'Improve sustainable speed and lactate clearance.', '3 x 8 min threshold with 2–3 min easy jog.'],
      ['Threshold intervals 4 x 6 min', 'Improve sustainable speed and lactate clearance.', '4 x 6 min threshold with 2 min easy jog.'],
    ];
    const session = sessions[step < sessions.length ? step : 2 + (step % 2)];
    title = session[0]; intensity = 'Comfortably hard'; purpose = session[1]; mainSet = session[2];
  } else if (input.phase === 'specific') {
    intensity = 'Race specific';
    purpose = 'Practise controlled race effort and pacing.';
    const marathon = [['3 x 10 min steady marathon effort', '3 x 10 min steady/marathon effort with 3 min easy jog.'], ['2 x 20 min marathon effort', '2 x 20 min at marathon effort with 5 min easy between.']];
    const half = [['3 x 10 min threshold', '3 x 10 min threshold with 3 min easy jog.'], ['2 x 15 min half-marathon effort', '2 x 15 min controlled half-marathon effort with 4 min easy.']];
    const short = input.race === '5k' ? [['Race-pace intervals', '8 x 90 sec at 5k effort with 2 min easy jog.'], ['5 x 3 min controlled VO2', '5 x 3 min at controlled 5k effort with 2–3 min easy.']] : [['Race-pace intervals', '6 x 2 min at 10k effort with 2 min easy jog.'], ['5 x 3 min controlled VO2', '5 x 3 min at controlled 10k effort with 2–3 min easy.']];
    const session = (input.race === 'marathon' ? marathon : input.race === 'half_marathon' ? half : short)[step % 2];
    title = session[0]; mainSet = session[1];
  } else if (input.phase === 'peak') {
    const later = step > 0;
    title = input.race === 'marathon' ? (later ? 'Controlled marathon-effort sharpening' : 'Marathon-effort sharpening') : (later ? 'Short race-specific sharpening' : 'Race-specific sharpening');
    intensity = 'Controlled hard';
    purpose = 'Sharpen race rhythm without adding unnecessary fatigue.';
    mainSet = input.race === 'marathon' ? (later ? '2 x 10 min marathon effort with relaxed easy running between.' : '3 x 8 min marathon effort with relaxed easy running between.') : (later ? '5 x 90 sec at race effort with full easy recoveries.' : '6 x 90 sec at race effort with full easy recoveries.');
  } else if (input.phase === 'taper') return sharpening(input, QUALITY_SHARE, 'Wednesday');
  return { title, type: 'quality_session', category: 'foundation', plannedDistanceKm: distance, plannedDurationMin: minutes(distance), intensity, purpose, warmup: '10–15 minutes easy plus 4 relaxed strides.', mainSet, cooldown: '10 minutes easy.', coachTip: 'Finish with one rep in reserve.', suggestedDay: 'Wednesday' };
}

function pickProgression<T>(index: number, values: T[]): T { return values[index < values.length ? index : 1 + (index % (values.length - 1))]; }

function recoveryQuality(input: BuildInput): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> { return input.phase === 'taper' ? sharpening(input, 0.12, 'Wednesday') : { ...quality({ ...input, phase: 'base' }), title: 'Recovery-week strides', plannedDistanceKm: roundKm(input.weeklyKm * 0.14), plannedDurationMin: minutes(roundKm(input.weeklyKm * 0.14)), intensity: 'Easy with relaxed strides', purpose: 'Reduce quality load while keeping light rhythm.', mainSet: 'Easy running plus 6 x 15 sec relaxed strides with full easy recovery.', coachTip: 'This should freshen the legs, not test them.' }; }
function sharpening(input: BuildInput, share: number, day: string): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> { const d = roundKm(Math.max(3, input.weeklyKm * share)); return { title: 'Short controlled sharpening', type: 'quality_session', category: 'foundation', plannedDistanceKm: d, plannedDurationMin: minutes(d), intensity: 'Moderate', purpose: 'Preserve rhythm while reducing fatigue.', warmup: '10 minutes easy.', mainSet: '4–6 x 30 sec smooth pickups with full easy jogging.', cooldown: '10 minutes easy.', coachTip: 'Stop while you feel snappy.', suggestedDay: day }; }
function secondaryStimulus(input: BuildInput): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> { const d = roundKm(input.weeklyKm * 0.11); return { title: input.phase === 'build' ? 'Light tempo support' : 'Controlled race-rhythm strides', type: 'quality_session', category: 'foundation', plannedDistanceKm: d, plannedDurationMin: minutes(d), intensity: 'Moderate, controlled', purpose: 'Add a small secondary stimulus without competing with the key session.', warmup: '10 minutes easy.', mainSet: input.phase === 'build' ? '15 minutes steady tempo, controlled throughout.' : '8 x 20 sec relaxed race-rhythm strides, full easy recovery.', cooldown: '5–10 minutes easy.', coachTip: 'This is support work, not another hard day.', suggestedDay: 'Thursday' }; }

function milestoneWorkout(input: { weekNumber: number }, race: PlanGeneratorMilestoneRace): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> { return { title: `${race.name} milestone race`, type: 'race', category: 'foundation', plannedDistanceKm: raceDistanceKm[race.distance], plannedDurationMin: minutes(raceDistanceKm[race.distance]), intensity: 'Race effort, controlled', purpose: 'Use the milestone as a supported long-run or quality substitute.', warmup: '10–15 minutes easy plus a few relaxed strides.', mainSet: `Run the ${race.distance} milestone with discipline; no extra workout afterward.`, cooldown: 'Walk, refuel, and keep the next day very easy.', coachTip: 'This replaces—not adds to—the weekly key session.', suggestedDay: 'Sunday', warningIds: [`milestone_race_week_${input.weekNumber}`] }; }
function raceWorkout(input: { race: RaceType; raceDate: string }): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> { return { title: `${input.race} Race Day`, type: 'race', category: 'foundation', plannedDistanceKm: raceDistanceKm[input.race], plannedDurationMin: minutes(raceDistanceKm[input.race]), intensity: 'Race effort', purpose: 'Execute the goal race fresh and confident.', warmup: 'Use your familiar pre-race warmup; keep it short and calm.', mainSet: 'Race calmly from the start and build only when settled.', cooldown: 'Walk, hydrate, and refuel.', coachTip: 'Nothing new on race day.', suggestedDay: input.raceDate }; }
function shakeout(title: string, day: string): Omit<GeneratedWorkout, 'status' | 'weekNumber' | 'id'> { return { title, type: 'shakeout', category: 'optional', plannedDurationMin: 20, intensity: 'Very easy', purpose: 'Loosen up without adding fatigue.', warmup: 'Walk first if stiff.', mainSet: 'Jog very easily with 3–4 relaxed strides only if natural.', cooldown: 'Stop while you feel fresh.', coachTip: 'Optional means optional.', suggestedDay: day }; }
function optionalRecovery(weekNumber: number, km: number): GeneratedWorkout { return { ...easy('Recovery Jog', km, 'Monday or Saturday'), id: `w${weekNumber}-optional-recovery`, weekNumber, type: 'recovery', category: 'optional', intensity: 'Very easy', status: 'unplanned' }; }
function optionalMobility(weekNumber: number): GeneratedWorkout { return { id: `w${weekNumber}-optional-mobility`, weekNumber, title: 'Mobility 20 min', type: 'mobility', category: 'optional', plannedDurationMin: 20, intensity: 'Very easy', purpose: 'Support recovery and movement quality.', warmup: 'Move gently.', mainSet: 'Light mobility and activation.', cooldown: 'Breathe slowly and relax.', coachTip: 'Keep it restorative.', suggestedDay: 'Flexible', status: 'unplanned' }; }
