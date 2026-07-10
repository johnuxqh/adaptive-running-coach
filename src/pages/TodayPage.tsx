import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, PageStack, PrimaryButton, ProgressBar, SecondaryButton, SectionCard, StatCard } from '../components/ui';
import { colors, spacing, typography } from '../design';
import { addDays, parseIsoDate, toIsoDate } from '../engine/dateHelpers';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, GeneratedWorkoutType, TrainingPhase } from '../engine/planTypes';
import type { AthleteProfile } from '../engine/types';
import { seedMessages } from '../data/seedMessages';
import { readStorageValue, storageKeys, writeStorageValue } from '../utils/storage';

type PlannerState = { assignments: Record<string, string>; extraWorkouts: GeneratedWorkout[] };
const emptyPlanner: PlannerState = { assignments: {}, extraWorkouts: [] };
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TodayPage() {
  const navigate = useNavigate();
  const profile = readStorageValue<AthleteProfile | null>(storageKeys.profile, null);
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  const currentWeek = readStorageValue<GeneratedTrainingWeek | null>(storageKeys.currentWeek, null) ?? plan?.weeks[0] ?? null;
  const [planner, setPlanner] = useState<PlannerState>(() => readStorageValue<PlannerState>(storageKeys.weeklyPlanner, emptyPlanner));
  const [message] = useState(() => seedMessages[Math.floor(Math.random() * seedMessages.length)]);
  const todayIso = toIsoDate(new Date());

  const workouts = useMemo(() => currentWeek ? [...currentWeek.foundationWorkouts, ...currentWeek.optionalWorkouts, ...planner.extraWorkouts.filter((workout) => workout.weekNumber === currentWeek.weekNumber)] : [], [currentWeek, planner.extraWorkouts]);
  const todayWorkouts = workouts.filter((workout) => planner.assignments[workout.id] === todayIso);
  const todaysWorkout = todayWorkouts[0];
  const nextWorkout = findNextWorkout(workouts, planner.assignments, todayIso);
  const remaining = workouts.filter((workout) => !planner.assignments[workout.id] && workout.status !== 'completed');
  const [chooserOpen, setChooserOpen] = useState(false);

  if (!plan || !currentWeek) return <PageStack><HeroTitle eyebrow="Today" title="No plan yet">Create your plan first, then this becomes your daily coaching screen.</HeroTitle><PrimaryButton onClick={() => navigate('/onboarding')}>Create Plan</PrimaryButton></PageStack>;

  const raceName = raceLabel(plan.summary.raceDistance);
  const raceDate = parseIsoDate(plan.summary.raceDate);
  const daysUntil = Math.max(0, Math.ceil((raceDate.getTime() - new Date().getTime()) / 86400000));
  const foundationDone = currentWeek.foundationWorkouts.filter((workout) => workout.status === 'completed').length;
  const optionalDone = currentWeek.optionalWorkouts.filter((workout) => workout.status === 'completed').length;
  const hasCompletedThisWeek = workouts.some((workout) => workout.status === 'completed');

  function assignToday(workout: GeneratedWorkout) {
    const next = { ...planner, assignments: { ...planner.assignments, [workout.id]: todayIso } };
    setPlanner(next);
    writeStorageValue(storageKeys.weeklyPlanner, next);
    setChooserOpen(false);
  }

  return <PageStack>
    <HeroTitle eyebrow={`${dayNames[new Date().getDay()]} • ${formatDate(todayIso)}`} title={`${greeting()} ${profile?.name ?? plan.summary.athleteName}`.trim()} />
    <SectionCard><CardStack>
      <p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' }}>Countdown</p>
      <h2 style={{ ...typography.display, margin: 0 }}>{daysUntil} Days</h2>
      <p style={{ ...typography.body, color: colors.neutral.muted, margin: 0 }}>until<br />{raceName}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}><StatCard label="Phase" value={formatPhase(currentWeek.phase)} /><StatCard label="Week" value={`${currentWeek.weekNumber} of ${plan.summary.trainingWeeks}`} /></div>
    </CardStack></SectionCard>
    {todaysWorkout ? <TodayWorkoutCard workout={todaysWorkout} onStart={() => navigate(`/workout/${todaysWorkout.id}`)} onMove={() => navigate('/week')} /> : <SectionCard><CardStack><h3 style={{ ...typography.h2, margin: 0 }}>{workouts.length ? 'Rest Day' : 'Nothing Planned'}</h3><p style={{ ...typography.body, color: colors.neutral.muted, margin: 0 }}>A calmer day still counts. If life has opened a window, you can choose one remaining workout for today.</p><PrimaryButton onClick={() => setChooserOpen(true)}>Choose Today&apos;s Workout</PrimaryButton>{chooserOpen ? (remaining.length ? remaining.map((workout) => <SecondaryButton key={workout.id} onClick={() => assignToday(workout)}>{workout.title}</SecondaryButton>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>No remaining workouts this week.</p>) : null}</CardStack></SectionCard>}
    {nextWorkout ? <SimpleNextCard item={nextWorkout} /> : null}
    <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Weekly Progress</h3><ProgressRow label="Foundation" value={foundationDone} total={currentWeek.foundationWorkouts.length} /><ProgressRow label="Optional" value={optionalDone} total={currentWeek.optionalWorkouts.length} /></CardStack></SectionCard>
    {hasCompletedThisWeek ? <SectionCard><CardStack><Chip tone="green">Every completed run counts.</Chip><SecondaryButton onClick={() => navigate('/closeout')}>Close This Week</SecondaryButton></CardStack></SectionCard> : null}
    <SectionCard><Chip tone="green">{message}</Chip></SectionCard>
  </PageStack>;
}

function TodayWorkoutCard({ workout, onStart, onMove }: { workout: GeneratedWorkout; onStart: () => void; onMove: () => void }) { return <SectionCard><CardStack><Chip tone={tone(workout.type)}>{workout.type.replace('_', ' ')}</Chip><h3 style={{ ...typography.h2, margin: 0 }}>{workout.title}</h3><p style={{ ...typography.body, color: colors.neutral.muted, margin: 0 }}>{meta(workout)}</p><Detail label="Purpose" value={workout.purpose} /><Detail label="Warm up" value={workout.warmup} /><Detail label="Main Set" value={workout.mainSet} /><Detail label="Cool down" value={workout.cooldown} /><Detail label="Coach Tip" value={workout.coachTip} /><PrimaryButton onClick={onStart}>Start Workout</PrimaryButton><SecondaryButton onClick={onMove}>Move Workout</SecondaryButton></CardStack></SectionCard>; }
function SimpleNextCard({ item }: { item: { workout: GeneratedWorkout; label: string } }) { return <SectionCard><CardStack><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' }}>Next Up • {item.label}</p><h3 style={{ ...typography.h3, margin: 0 }}>{item.workout.title}</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{meta(item.workout)} • {item.workout.purpose}</p></CardStack></SectionCard>; }
function Detail({ label, value }: { label: string; value: string }) { return <div style={{ borderTop: `1px solid ${colors.neutral.border}`, paddingTop: spacing.sm }}><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{label}</p><p style={{ ...typography.small, color: colors.neutral.text, margin: `${spacing.xs}px 0 0` }}>{value}</p></div>; }
function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) { return <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}><span style={typography.small}>{label}</span><span style={{ ...typography.small, color: colors.neutral.muted }}>{value} / {total}</span></div><ProgressBar value={total ? (value / total) * 100 : 0} /></div>; }
function findNextWorkout(workouts: GeneratedWorkout[], assignments: Record<string, string>, todayIso: string) {
  const next = workouts
    .map((workout) => ({ workout, date: assignments[workout.id] }))
    .filter((item): item is { workout: GeneratedWorkout; date: string } => Boolean(item.date) && item.date > todayIso && item.workout.status !== 'completed')
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return null;
  const tomorrowIso = toIsoDate(addDays(parseIsoDate(todayIso), 1));
  return { workout: next.workout, label: next.date === tomorrowIso ? 'Tomorrow' : formatDate(next.date) };
}
function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening'; }
function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(parseIsoDate(date)); }
function formatPhase(phase: TrainingPhase) { return phase.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function raceLabel(race: string) { return ({ marathon: 'Melbourne Marathon', half_marathon: 'Half Marathon', '5k': '5 km', '10k': '10 km', '15k': '15 km' } as Record<string, string>)[race] ?? race; }
function meta(workout: GeneratedWorkout) { return [workout.plannedDurationMin && `${workout.plannedDurationMin} min`, workout.plannedDistanceKm && `${workout.plannedDistanceKm} km`].filter(Boolean).join(' • ') || 'Flexible'; }
function tone(type: GeneratedWorkoutType) { if (type === 'quality_session') return 'purple'; if (type === 'long_run') return 'orange'; if (type === 'recovery' || type === 'cross_training') return 'sky'; return 'green'; }
