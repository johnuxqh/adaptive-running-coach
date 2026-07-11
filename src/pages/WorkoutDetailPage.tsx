import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, PageStack, PrimaryButton, SecondaryButton, SectionCard, TextInput } from '../components/ui';
import { colors, radius, spacing, typography } from '../design';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, GeneratedWorkoutType } from '../engine/planTypes';
import type { WorkoutLog } from '../engine/types';
import { seedMessages } from '../data/seedMessages';
import { readStorageValue, storageKeys, writeStorageValue } from '../utils/storage';
import { resolveWeek, upsertWorkoutLog } from '../utils/planning';

type PlannerState = { assignments: Record<string, string>; extraWorkouts: GeneratedWorkout[] };
type CompletionFeeling = { label: string; value: number; text: string };
type CompletionLog = WorkoutLog & { feeling?: string; actualDistanceKm?: number; actualDurationMinutes?: number; weekNumber?: number; status?: 'completed' };
const emptyPlanner: PlannerState = { assignments: {}, extraWorkouts: [] };
const feelings: CompletionFeeling[] = [
  { label: '😁 Excellent', value: 1, text: 'Excellent' },
  { label: '🙂 Good', value: 2, text: 'Good' },
  { label: '😐 Okay', value: 3, text: 'Okay' },
  { label: '🙁 Tough', value: 4, text: 'Tough' },
  { label: '😫 Very Hard', value: 5, text: 'Very Hard' },
];

export function WorkoutDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  const currentWeek = readStorageValue<GeneratedTrainingWeek | null>(storageKeys.currentWeek, null) ?? plan?.weeks[0] ?? null;
  const planner = readStorageValue<PlannerState>(storageKeys.weeklyPlanner, emptyPlanner);
  const logs = readStorageValue<CompletionLog[]>(storageKeys.workoutLogs, []);
  const workout = useMemo(() => findWorkout(id, currentWeek, planner, logs), [id, currentWeek, planner, logs]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const existingLog = workout?.completion;
  const [feeling, setFeeling] = useState<CompletionFeeling | null>(() => feelings.find((item) => item.text === existingLog?.feeling || item.value === existingLog?.perceivedEffort) ?? null);
  const [notes, setNotes] = useState(existingLog?.notes ?? '');
  const [distance, setDistance] = useState(String(existingLog?.actualDistanceKm ?? existingLog?.distanceKm ?? ''));
  const [duration, setDuration] = useState(String(existingLog?.actualDurationMinutes ?? existingLog?.durationMinutes ?? ''));
  const [savedMessage, setSavedMessage] = useState('');

  if (!workout || !currentWeek) return <PageStack><HeroTitle eyebrow="Workout" title="Workout not found">Head back to Today and choose the workout you want to complete.</HeroTitle><PrimaryButton onClick={() => navigate('/today')}>Back to Today</PrimaryButton></PageStack>;

  function saveWorkout() {
    if (!currentWeek || !workout) return;
    const completedAt = workout.completion?.completedAt ?? new Date().toISOString();
    const logs = readStorageValue<CompletionLog[]>(storageKeys.workoutLogs, []);
    const log: CompletionLog = {
      id: workout.completion?.id ?? `log-${workout.id}-${Date.now()}`,
      workoutId: workout.id,
      completedAt,
      weekNumber: currentWeek.weekNumber,
      status: 'completed',
      durationMinutes: duration ? Number(duration) : undefined,
      distanceKm: distance ? Number(distance) : undefined,
      actualDurationMinutes: duration ? Number(duration) : undefined,
      actualDistanceKm: distance ? Number(distance) : undefined,
      perceivedEffort: feeling?.value,
      feeling: feeling?.text,
      notes: notes.trim() || undefined,
    };
    writeStorageValue(storageKeys.workoutLogs, upsertWorkoutLog(logs, log));
    setSavedMessage(seedMessages[Math.floor(Math.random() * seedMessages.length)]);
    setSheetOpen(false);
  }

  return <PageStack>
    <SectionCard><CardStack>
      <HeroTitle eyebrow="Workout Detail" title={workout.title}><Chip tone={tone(workout.type)}>{workout.type.replace('_', ' ')}</Chip></HeroTitle>
      <DetailBlock title="Purpose">{workout.purpose}</DetailBlock>
      <DetailBlock title="Warm Up">{workout.warmup}</DetailBlock>
      <DetailBlock title="Main Set">{workout.mainSet}</DetailBlock>
      <DetailBlock title="Cool Down">{workout.cooldown}</DetailBlock>
      <DetailBlock title="Coach Tip">{workout.coachTip}</DetailBlock>
      {workout.status === 'completed' ? <><Chip tone="green">Completed</Chip><PrimaryButton onClick={() => setSheetOpen(true)}>Edit Summary</PrimaryButton></> : <PrimaryButton onClick={() => setSheetOpen(true)}>Workout Complete</PrimaryButton>}
      <SecondaryButton onClick={() => navigate('/today')}>Back to Today</SecondaryButton>
    </CardStack></SectionCard>
    {sheetOpen ? <SectionCard><CardStack>
      <h3 style={{ ...typography.h2, margin: 0 }}>How did today&apos;s workout feel?</h3>
      <div style={{ display: 'grid', gap: spacing.sm }}>{feelings.map((item) => feeling?.value === item.value ? <PrimaryButton key={item.text} onClick={() => setFeeling(item)}>{item.label}</PrimaryButton> : <SecondaryButton key={item.text} onClick={() => setFeeling(item)}>{item.label}</SecondaryButton>)}</div>
      <label style={labelStyle}>How long did you run?</label><TextInput inputMode="numeric" placeholder="Time in minutes" value={duration} onChange={(event) => setDuration(event.currentTarget.value)} />
      <label style={labelStyle}>Optional distance</label><TextInput inputMode="decimal" placeholder="Distance in km" value={distance} onChange={(event) => setDistance(event.currentTarget.value)} />
      <TextAreaWithState value={notes} onChange={setNotes} />
      <PrimaryButton onClick={saveWorkout}>Save Workout</PrimaryButton><SecondaryButton onClick={() => setSheetOpen(false)}>Not Yet</SecondaryButton>
    </CardStack></SectionCard> : null}
    {savedMessage ? <SectionCard><Chip tone="green">{savedMessage}</Chip></SectionCard> : null}
  </PageStack>;
}

function TextAreaWithState({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <textarea aria-label="Completion notes" value={value} onChange={(event) => onChange(event.currentTarget.value)} placeholder="Optional notes" style={{ ...typography.body, width: '100%', minHeight: 120, boxSizing: 'border-box', resize: 'vertical', border: `1px solid ${colors.neutral.border}`, borderRadius: radius.input, padding: spacing.md, color: colors.neutral.text, background: colors.neutral.surface }} />; }
function DetailBlock({ title, children }: { title: string; children: string }) { return <div style={{ borderTop: `1px solid ${colors.neutral.border}`, paddingTop: spacing.md }}><h3 style={{ ...typography.h3, margin: 0 }}>{title}</h3><p style={{ ...typography.body, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>{children}</p></div>; }
function findWorkout(id: string | undefined, week: GeneratedTrainingWeek | null, planner: PlannerState, logs: CompletionLog[]) { if (!id || !week) return null; return resolveWeek(week, planner, logs).workouts.find((workout) => workout.id === id) ?? null; }
function tone(type: GeneratedWorkoutType) { if (type === 'quality_session') return 'purple'; if (type === 'long_run') return 'orange'; if (type === 'recovery' || type === 'cross_training') return 'sky'; return 'green'; }
const labelStyle = { ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' as const };
