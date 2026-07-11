import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, PageStack, PrimaryButton, ProgressBar, SecondaryButton, SectionCard, SlidePanel, StatCard, TextArea, TextInput } from '../components/ui';
import { colors, spacing, typography } from '../design';
import { addDays, parseIsoDate, toIsoDate } from '../engine/dateHelpers';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, GeneratedWorkoutType, TrainingPhase } from '../engine/planTypes';
import type { AthleteProfile } from '../engine/types';
import { seedMessages } from '../data/seedMessages';
import { readStorageValue, storageKeys, writeStorageValue } from '../utils/storage';
import { buildSuggestedPlanner, resolveWeek, upsertWorkoutLog, type CompletionLog } from '../utils/planning';

type PlannerState = { assignments: Record<string, string>; extraWorkouts: GeneratedWorkout[] };
const emptyPlanner: PlannerState = { assignments: {}, extraWorkouts: [] };
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TodayPage() {
  const navigate = useNavigate();
  const profile = readStorageValue<AthleteProfile | null>(storageKeys.profile, null);
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  const currentWeek = readStorageValue<GeneratedTrainingWeek | null>(storageKeys.currentWeek, null) ?? plan?.weeks[0] ?? null;
  const [planner, setPlanner] = useState<PlannerState>(() => plan ? buildSuggestedPlanner(plan, readStorageValue<PlannerState>(storageKeys.weeklyPlanner, emptyPlanner)) : readStorageValue<PlannerState>(storageKeys.weeklyPlanner, emptyPlanner));
  const [message] = useState(() => seedMessages[Math.floor(Math.random() * seedMessages.length)]);
  const [logs, setLogs] = useState<CompletionLog[]>(() => readStorageValue<CompletionLog[]>(storageKeys.workoutLogs, []));
  const todayIso = toIsoDate(new Date());

  const workouts = useMemo(() => currentWeek ? resolveWeek(currentWeek, planner, logs).workouts : [], [currentWeek, planner, logs]);
  const todayWorkouts = workouts.filter((workout) => planner.assignments[workout.id] === todayIso);
  const todaysWorkout = todayWorkouts[0];
  const raceToday = todayWorkouts.find((workout) => workout.type === 'race');
  const nextWorkout = findNextWorkout(workouts, planner.assignments, todayIso);
  const remaining = workouts.filter((workout) => !planner.assignments[workout.id] && workout.status !== 'completed');
  const [chooserOpen, setChooserOpen] = useState(false);
  const [panel, setPanel] = useState<'countdown' | 'complete' | 'details' | null>(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  if (!plan || !currentWeek) return <PageStack><HeroTitle eyebrow="Today" title="No plan yet">Create your plan first, then this becomes your daily coaching screen.</HeroTitle><PrimaryButton onClick={() => navigate('/onboarding')}>Create Plan</PrimaryButton></PageStack>;

  const raceName = raceLabel(plan.summary.raceDistance);
  const raceDate = parseIsoDate(plan.summary.raceDate);
  const daysUntil = Math.max(0, Math.ceil((raceDate.getTime() - new Date().getTime()) / 86400000));
  const foundationDone = currentWeek.foundationWorkouts.filter((workout) => workout.status === 'completed').length;
  const optionalDone = currentWeek.optionalWorkouts.filter((workout) => workout.status === 'completed').length;
  const allTodayDone = todayWorkouts.length > 0 && todayWorkouts.every((workout) => workout.status === 'completed' || completedIds.includes(workout.id));
  const hasCompletedThisWeek = workouts.some((workout) => workout.status === 'completed');
  const activeWorkout = workouts.find((workout) => workout.id === activeWorkoutId) ?? todaysWorkout;

  function assignToday(workout: GeneratedWorkout) {
    const next = { ...planner, assignments: { ...planner.assignments, [workout.id]: todayIso } };
    setPlanner(next);
    writeStorageValue(storageKeys.weeklyPlanner, next);
    setChooserOpen(false);
  }

  function completeToday() {
    if (!activeWorkout || !currentWeek || !plan) return;
    const nextLogs = upsertWorkoutLog(logs, { id: activeWorkout.completion?.id ?? `log-${activeWorkout.id}-${Date.now()}`, workoutId: activeWorkout.id, weekNumber: currentWeek.weekNumber, completedAt: activeWorkout.completion?.completedAt ?? new Date().toISOString(), status: 'completed' });
    setLogs(nextLogs); writeStorageValue(storageKeys.workoutLogs, nextLogs);
    setCompletedIds((ids) => ids.includes(activeWorkout.id) ? ids : [...ids, activeWorkout.id]); setPanel(null); setSuccess('Workout saved. Nice work.');
  }

  return <PageStack>
    <HeroTitle eyebrow={`${dayNames[new Date().getDay()]} • ${formatDate(todayIso)}`} title={`${greeting()} ${profile?.name ?? plan.summary.athleteName}`.trim()} />
    <button type="button" onClick={() => setPanel('countdown')} style={{ border: 0, padding: 0, background: 'transparent', textAlign: 'left', width: '100%' }}><SectionCard><CardStack>
      <p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' }}>Countdown</p>
      <h2 style={{ ...typography.h1, margin: 0 }}>{daysUntil} Days</h2>
      <p style={{ ...typography.body, color: colors.neutral.muted, margin: 0 }}>until<br />{raceName}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}><StatCard label="Phase" value={formatPhase(currentWeek.phase)} /><StatCard label="Week" value={`${currentWeek.weekNumber} of ${plan.summary.trainingWeeks}`} /></div>
    </CardStack></SectionCard></button>
    {success ? <SectionCard><Chip tone="green">{success}</Chip></SectionCard> : null}
    {raceToday ? <RaceDayCard workout={raceToday} onComplete={() => { setActiveWorkoutId(raceToday.id); setPanel('complete'); }} onDetails={() => { setActiveWorkoutId(raceToday.id); setPanel('details'); }} /> : null}
    <SectionCard><CardStack><h3 style={{ ...typography.h2, margin: 0 }}>Today&apos;s Plan</h3>{todayWorkouts.length ? todayWorkouts.map((workout) => <TodayWorkoutCard key={workout.id} workout={workout} onComplete={() => { setActiveWorkoutId(workout.id); setPanel('complete'); }} onDetails={() => { setActiveWorkoutId(workout.id); setPanel('details'); }} onMove={() => navigate('/week')} />) : <p style={{ ...typography.body, color: colors.neutral.muted, margin: 0 }}>Rest day. Build your fitness over the week, not by forcing life into a calendar.</p>}{allTodayDone ? <Chip tone="green">✓ Today&apos;s Plan Complete</Chip> : null}{allTodayDone && todayWorkouts.some(w => w.category === 'optional' && w.status !== 'completed') ? <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Optional workout still available.</p> : null}</CardStack></SectionCard>
    {nextWorkout ? <SimpleNextCard item={nextWorkout} /> : null}
    <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Weekly Progress</h3><ProgressRow label="Foundation" value={foundationDone} total={currentWeek.foundationWorkouts.length} /><ProgressRow label="Optional" value={optionalDone} total={currentWeek.optionalWorkouts.length} /></CardStack></SectionCard>
    {hasCompletedThisWeek ? <SectionCard><CardStack><Chip tone="green">Every completed run counts.</Chip><SecondaryButton onClick={() => navigate('/closeout')}>Close This Week</SecondaryButton></CardStack></SectionCard> : null}
    <SectionCard><Chip tone="green">{message}</Chip></SectionCard>
  <SlidePanel isOpen={Boolean(panel)} title={panel === 'countdown' ? 'Plan details' : panel === 'details' ? 'Workout details' : (activeWorkout?.status === 'completed' ? 'Edit summary' : 'Complete workout')} onClose={() => setPanel(null)}>{panel === 'countdown' ? <CardStack><StatCard label="Days to race" value={String(daysUntil)} /><StatCard label="Current week" value={`${currentWeek.weekNumber} of ${plan.summary.trainingWeeks}`} /><ProgressRow label="Plan progress" value={currentWeek.weekNumber} total={plan.summary.trainingWeeks} /><ProgressRow label="Foundation completed" value={foundationDone} total={currentWeek.foundationWorkouts.length} /><ProgressRow label="Optional completed" value={optionalDone} total={currentWeek.optionalWorkouts.length} /><StatCard label="Race" value={raceName} detail={plan.summary.raceDate} /></CardStack> : null}{panel === 'details' && activeWorkout ? <WorkoutDetails workout={activeWorkout} /> : null}{panel === 'complete' && activeWorkout ? <CompletePanel workout={activeWorkout} onSave={completeToday} /> : null}</SlidePanel>
  </PageStack>;
}

function TodayWorkoutCard({ workout, onComplete, onMove, onDetails }: { workout: GeneratedWorkout; onComplete: () => void; onMove: () => void; onDetails: () => void }) { return <div style={{ border: `1px solid ${colors.neutral.border}`, borderRadius: 18, padding: spacing.md, background: workout.status === 'completed' ? colors.primary.greenTint : colors.neutral.surface }}><CardStack><Chip tone={workout.status === 'completed' ? 'green' : tone(workout.type)}>{(workout.status === 'completed') ? 'Completed' : workout.category === 'optional' ? 'Optional' : workout.type.replace('_', ' ')}</Chip><h3 style={{ ...typography.h3, margin: 0 }}>{workout.title}</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{meta(workout)}</p>{workout.status === 'completed' ? <><p style={{ ...typography.small, color: colors.neutral.text, margin: 0 }}>Completed • Summary saved</p><PrimaryButton onClick={onDetails}>Review Summary</PrimaryButton><SecondaryButton onClick={onComplete}>Edit Summary</SecondaryButton></> : <><PrimaryButton onClick={onComplete}>Complete Workout</PrimaryButton><SecondaryButton onClick={onMove}>Move Workout</SecondaryButton><SecondaryButton onClick={onDetails}>View Details</SecondaryButton></>}</CardStack></div>; }
function RaceDayCard({ workout, onComplete, onDetails }: { workout: GeneratedWorkout; onComplete: () => void; onDetails: () => void }) { return <SectionCard><CardStack><Chip tone="orange">🏁 TODAY IS RACE DAY</Chip><h2 style={{ ...typography.h1, margin: 0 }}>{workout.title}</h2><p style={{ ...typography.body, color: colors.neutral.text, margin: 0 }}>Countdown finished. Trust the work. You&apos;ve earned this. Go enjoy your race.</p>{workout.status === 'completed' ? <PrimaryButton onClick={onDetails}>Review Race Result</PrimaryButton> : <PrimaryButton onClick={onComplete}>Save Race Result</PrimaryButton>}</CardStack></SectionCard>; }
function WorkoutDetails({ workout }: { workout: GeneratedWorkout }) { return <CardStack><h3 style={{ ...typography.h2, margin: 0 }}>{workout.title}</h3><Detail label="Purpose" value={workout.purpose} /><Detail label="Warm up" value={workout.warmup} /><Detail label="Main Set" value={workout.mainSet} /><Detail label="Cool down" value={workout.cooldown} /><Detail label="Coach Tip" value={workout.coachTip} /></CardStack>; }
function CompletePanel({ workout, onSave }: { workout: GeneratedWorkout; onSave: () => void }) { return <CardStack><h3 style={{ ...typography.h3, margin: 0 }}>{workout.title}</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: spacing.xs }}>{['😫','🙁','😐','🙂','😁'].map((feel) => <button key={feel} type="button" style={{ minHeight: 44, border: `1px solid ${colors.neutral.border}`, background: colors.neutral.surface }}>{feel}</button>)}</div><TextArea placeholder="Note" /><TextInput placeholder="Actual time" inputMode="numeric" /><TextInput placeholder="Actual distance" inputMode="decimal" /><PrimaryButton onClick={onSave}>Save</PrimaryButton></CardStack>; }
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
