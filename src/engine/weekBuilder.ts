import type { TrainingPhase, WeekType } from './planTypes';

const MARATHON_TAPER_WEEKS = 3;
const HALF_TAPER_WEEKS = 2;
const SHORT_TAPER_WEEKS = 1;
const RECOVERY_FREQUENCY = 4;

export function getTaperWeeks(race: string, totalWeeks: number): number {
  if (totalWeeks <= 4) return 1;
  if (race === 'marathon') return Math.min(MARATHON_TAPER_WEEKS, totalWeeks - 2);
  if (race === 'half_marathon') return Math.min(HALF_TAPER_WEEKS, totalWeeks - 2);
  return SHORT_TAPER_WEEKS;
}

export function getPhaseForWeek(weekNumber: number, totalWeeks: number, race: string): TrainingPhase {
  if (weekNumber === totalWeeks) return 'race_week';
  const taperWeeks = getTaperWeeks(race, totalWeeks);
  if (weekNumber >= totalWeeks - taperWeeks) return 'taper';

  const trainingWeeks = totalWeeks - taperWeeks - 1;
  const ratio = weekNumber / Math.max(1, trainingWeeks);
  if (ratio <= 0.38) return 'base';
  if (ratio <= 0.65) return 'build';
  if (ratio <= 0.88) return 'specific';
  return 'peak';
}

export function getWeekType(weekNumber: number, totalWeeks: number, phase: TrainingPhase): WeekType {
  if (phase === 'race_week') return 'race';
  if (phase === 'peak') return 'peak';
  if (phase === 'taper') return 'recovery';
  if (weekNumber % RECOVERY_FREQUENCY === 0) return 'recovery';
  return 'normal';
}

export function getCoachingMessage(phase: TrainingPhase, weekType: WeekType): string {
  if (weekType === 'recovery') return 'Recovery is training too.';
  if (weekType === 'peak') return 'Big week ahead. Keep the easy days easy.';
  if (weekType === 'race') return 'Trust the work. Stay calm.';
  if (phase === 'base') return 'Easy miles are building the engine.';
  if (phase === 'build') return 'This week nudges the needle forward.';
  if (phase === 'specific') return 'Specific work builds race-day confidence.';
  if (phase === 'taper') return 'The work is done. Freshness matters now.';
  return 'Keep showing up with patience and consistency.';
}

export function getVolumeMultiplier(weekNumber: number, totalWeeks: number, phase: TrainingPhase, weekType: WeekType): number {
  if (weekType === 'race') return 0.45;
  if (phase === 'taper') return weekNumber === totalWeeks - 1 ? 0.62 : 0.78;
  if (weekType === 'recovery') return 0.78;
  if (weekType === 'peak') return 1.08;
  return 1;
}
