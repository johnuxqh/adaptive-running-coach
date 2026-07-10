const MS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

export function parseIsoDate(date: string): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  return parsed;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function daysBetween(start: Date, end: Date): number {
  return Math.ceil((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / MS_PER_DAY);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfTrainingWeek(date: Date): Date {
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  return addDays(startOfUtcDay(date), -daysFromMonday);
}

export function endOfTrainingWeek(date: Date): Date {
  return addDays(startOfTrainingWeek(date), 6);
}

export function weeksUntilRace(today: Date, raceDate: Date): number {
  const firstWeekStart = startOfTrainingWeek(today);
  const raceWeekStart = startOfTrainingWeek(raceDate);
  return Math.max(1, Math.floor(daysBetween(firstWeekStart, raceWeekStart) / 7) + 1);
}

export function getTrainingWeekDates(today: Date, raceDate: Date): { startsOn: string; endsOn: string }[] {
  const count = weeksUntilRace(today, raceDate);
  const firstStart = startOfTrainingWeek(today);

  return Array.from({ length: count }, (_, index) => {
    const startsOnDate = addDays(firstStart, index * 7);
    const endsOnDate = index === count - 1 ? startOfUtcDay(raceDate) : endOfTrainingWeek(startsOnDate);
    return { startsOn: toIsoDate(startsOnDate), endsOn: toIsoDate(endsOnDate) };
  });
}
