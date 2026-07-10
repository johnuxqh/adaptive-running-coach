import { useMemo, useState } from 'react';
import { CardStack, Chip, HeroTitle, InfoBanner, PageStack, PrimaryButton, ProgressBar, SecondaryButton, SectionCard, StatusChip, TextInput } from '../components/ui';
import { colors, radius, spacing, typography } from '../design';
import { addDays, parseIsoDate, toIsoDate } from '../engine/dateHelpers';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, GeneratedWorkoutType, TrainingPhase, WeekType } from '../engine/planTypes';
import { readStorageValue, storageKeys, writeStorageValue } from '../utils/storage';

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const plannerKey = storageKeys.weeklyPlanner;
type PlannerCategory = 'foundation' | 'optional' | 'extra';
type PlannerState = { assignments: Record<string, string>; extraWorkouts: GeneratedWorkout[] };
type PickerMode = { title: string; workoutId: string } | { title: string; date: string } | null;
const emptyPlanner: PlannerState = { assignments: {}, extraWorkouts: [] };

const extraTypes: { label: string; type: GeneratedWorkoutType }[] = [
  { label: 'Easy Run', type: 'easy_run' },
  { label: 'Recovery', type: 'recovery' },
  { label: 'Threshold', type: 'quality_session' },
  { label: 'Long Run', type: 'long_run' },
  { label: 'Strength', type: 'mobility' },
  { label: 'Squash', type: 'cross_training' },
  { label: 'Cross Training', type: 'cross_training' },
  { label: 'Custom', type: 'mobility' },
];

export function WeekPlannerPage() {
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  const storedWeek = readStorageValue<GeneratedTrainingWeek | null>(storageKeys.currentWeek, null);
  const currentWeek = storedWeek ?? plan?.weeks[0] ?? null;
  const [planner, setPlanner] = useState<PlannerState>(() => readPlanner());
  const [picker, setPicker] = useState<PickerMode>(null);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraTypeLabel, setExtraTypeLabel] = useState(extraTypes[0].label);
  const [extraCategory, setExtraCategory] = useState<PlannerCategory>('extra');

  const workouts = useMemo(() => currentWeek ? [...currentWeek.foundationWorkouts, ...currentWeek.optionalWorkouts, ...planner.extraWorkouts.filter((workout) => workout.weekNumber === currentWeek.weekNumber)] : [], [currentWeek, planner.extraWorkouts]);
  const days = useMemo(() => currentWeek ? dayNames.map((name, index) => ({ name, date: toIsoDate(addDays(parseIsoDate(currentWeek.startsOn), index)) })) : [], [currentWeek]);
  const assignedByDay = days.map((day) => ({ ...day, workouts: workouts.filter((workout) => planner.assignments[workout.id] === day.date) }));
  const remaining = workouts.filter((workout) => !planner.assignments[workout.id]);
  const todayIso = toIsoDate(new Date());
  const today = assignedByDay.find((day) => day.date === todayIso);
  const warnings = buildWarnings(assignedByDay);

  function savePlanner(next: PlannerState) { setPlanner(next); writeStorageValue(plannerKey, next); }
  function assign(workoutId: string, date: string) { savePlanner({ ...planner, assignments: { ...planner.assignments, [workoutId]: date } }); setPicker(null); }
  function remove(workoutId: string) { const { [workoutId]: _removed, ...assignments } = planner.assignments; savePlanner({ ...planner, assignments }); }
  function addExtraWorkout() {
    if (!currentWeek) return;
    const selected = extraTypes.find((item) => item.label === extraTypeLabel) ?? extraTypes[0];
    const workout: GeneratedWorkout = {
      id: `extra-${currentWeek.weekNumber}-${Date.now()}`,
      weekNumber: currentWeek.weekNumber,
      title: extraTitle.trim() || selected.label,
      type: selected.type,
      category: extraCategory,
      plannedDurationMin: 30,
      intensity: selected.label === 'Threshold' ? 'Comfortably hard' : 'Flexible',
      purpose: 'Added by you to fit this week around real life.',
      warmup: 'Start gently.',
      mainSet: 'Keep this session appropriate for how you feel.',
      cooldown: 'Finish calmly.',
      coachTip: 'Extra sessions should support the plan, not crowd it.',
      suggestedDay: 'Flexible',
      status: 'unplanned',
    };
    savePlanner({ ...planner, extraWorkouts: [...planner.extraWorkouts, workout] });
    setExtraTitle('');
  }

  if (!currentWeek) return <PageStack><HeroTitle eyebrow="Weekly planner" title="No plan found">Create a plan first, then come back to organise your week.</HeroTitle></PageStack>;

  const foundationDone = currentWeek.foundationWorkouts.filter((workout) => planner.assignments[workout.id]).length;
  const optionalDone = currentWeek.optionalWorkouts.filter((workout) => planner.assignments[workout.id]).length;

  return <PageStack>
    <HeroTitle eyebrow="Weekly planner" title={`Week ${currentWeek.weekNumber}`}>{formatPhase(currentWeek.phase)} • {formatWeekType(currentWeek.weekType)}</HeroTitle>
    <SectionCard><CardStack>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md }}><div><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>TARGET</p><h3 style={{ ...typography.h2, margin: `${spacing.xs}px 0 0` }}>{currentWeek.targetDistanceRangeKm.min}–{currentWeek.targetDistanceRangeKm.max} km</h3></div><div style={{ textAlign: 'right' }}><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>TIME</p><h3 style={{ ...typography.h2, margin: `${spacing.xs}px 0 0` }}>{currentWeek.targetDurationRangeMin.min}–{currentWeek.targetDurationRangeMin.max} min</h3></div></div>
      <ProgressRow label="Foundation" value={foundationDone} total={currentWeek.foundationWorkouts.length} />
      <ProgressRow label="Optional" value={optionalDone} total={currentWeek.optionalWorkouts.length} />
      <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{currentWeek.coachingMessage}</p>
    </CardStack></SectionCard>
    {today && today.workouts.length === 0 ? <InfoBanner>No workout planned today. <button onClick={() => setPicker({ date: today.date, title: "Choose Today's Workout" })} style={linkButton}>Choose Today's Workout</button></InfoBanner> : null}
    {warnings.map((warning) => <WarningRibbon key={warning}>{warning}</WarningRibbon>)}
    <CardStack>{assignedByDay.map((day) => <DayCard key={day.date} day={day} onAssign={() => setPicker({ date: day.date, title: `Assign to ${day.name}` })} onMove={(workout) => setPicker({ workoutId: workout.id, title: `Move ${workout.title}` })} onRemove={remove} />)}</CardStack>
    <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Remaining Workouts</h3>{(['foundation','optional','extra'] as PlannerCategory[]).map((category) => <WorkoutGroup key={category} category={category} workouts={remaining.filter((workout) => workout.category === category)} onAssign={(workout) => setPicker({ workoutId: workout.id, title: `Assign ${workout.title}` })} />)}</CardStack></SectionCard>
    <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Add workout</h3><TextInput value={extraTitle} onChange={(event) => setExtraTitle(event.target.value)} placeholder="Optional title" /><Select value={extraTypeLabel} onChange={setExtraTypeLabel} options={extraTypes.map((item) => item.label)} /><Select value={extraCategory} onChange={(value) => setExtraCategory(value as PlannerCategory)} options={['foundation','optional','extra']} /><PrimaryButton onClick={addExtraWorkout}>Add Workout</PrimaryButton></CardStack></SectionCard>
    {picker ? <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>{picker.title}</h3>{'date' in picker ? (remaining.length ? remaining.map((workout) => <SecondaryButton key={workout.id} onClick={() => assign(workout.id, picker.date)}>{workout.title}</SecondaryButton>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>No remaining workouts to assign.</p>) : days.map((day) => <SecondaryButton key={day.date} onClick={() => assign(picker.workoutId, day.date)}>{day.name} • {formatDate(day.date)}</SecondaryButton>)}<SecondaryButton onClick={() => setPicker(null)}>Cancel</SecondaryButton></CardStack></SectionCard> : null}
  </PageStack>;
}

function readPlanner(): PlannerState { return readStorageValue<PlannerState>(plannerKey, emptyPlanner); }
function formatPhase(phase: TrainingPhase) { return phase.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatWeekType(type: WeekType) { return `${type[0].toUpperCase()}${type.slice(1)} week`; }
function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(parseIsoDate(date)); }
function workoutTone(workout: GeneratedWorkout) { if (workout.type === 'quality_session') return 'purple'; if (workout.type === 'long_run') return 'orange'; if (workout.type === 'recovery' || workout.type === 'cross_training') return 'sky'; return workout.category === 'extra' ? 'purple' : 'green'; }
function hard(workout: GeneratedWorkout) { return workout.type === 'quality_session' || workout.type === 'long_run' || workout.intensity.toLowerCase().includes('hard'); }
function buildWarnings(days: { workouts: GeneratedWorkout[] }[]) { const warnings: string[] = []; const hardDays = days.filter((day) => day.workouts.some(hard)).length; days.forEach((day, index) => { const today = day.workouts; const previous = days[index - 1]?.workouts ?? []; if (today.some((w) => w.type === 'quality_session') && previous.some((w) => w.type === 'quality_session')) warnings.push('Gentle note: threshold-style sessions on back-to-back days can feel spicy.'); if (today.some((w) => w.type === 'long_run') && previous.some((w) => w.type === 'quality_session')) warnings.push('Friendly reminder: a long run after threshold may need extra recovery.'); }); if (hardDays >= 3) warnings.push('This week now has three hard days. Keep the easy days truly easy.'); return [...new Set(warnings)]; }

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) { return <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}><span style={typography.small}>{label}</span><span style={{ ...typography.small, color: colors.neutral.muted }}>{value} / {total}</span></div><ProgressBar value={total ? (value / total) * 100 : 0} /></div>; }
function WarningRibbon({ children }: { children: string }) { return <div style={{ ...typography.small, color: colors.accent.amber, background: colors.accent.amberTint, border: `1px solid ${colors.accent.amber}`, borderRadius: radius.card, padding: spacing.md }}>{children}</div>; }
function WorkoutMini({ workout, children }: { workout: GeneratedWorkout; children: React.ReactNode }) { return <div style={{ border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.md, background: colors.neutral.surface }}><CardStack><div><Chip tone={workoutTone(workout)}>{workout.category} • {workout.type.replace('_', ' ')}</Chip><h4 style={{ ...typography.h3, margin: `${spacing.xs}px 0 0` }}>{workout.title}</h4><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>{[workout.plannedDurationMin && `${workout.plannedDurationMin} min`, workout.plannedDistanceKm && `${workout.plannedDistanceKm} km`].filter(Boolean).join(' • ') || 'Flexible'} • {workout.purpose}</p></div>{children}</CardStack></div>; }
function DayCard({ day, onAssign, onMove, onRemove }: { day: { name: string; date: string; workouts: GeneratedWorkout[] }; onAssign: () => void; onMove: (workout: GeneratedWorkout) => void; onRemove: (id: string) => void }) { return <SectionCard><CardStack><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}><div><h3 style={{ ...typography.h3, margin: 0 }}>{day.name}</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>{formatDate(day.date)}</p></div><StatusChip tone={day.workouts.length ? 'moved' : 'notPlanned'} /></div>{day.workouts.length ? day.workouts.map((workout) => <WorkoutMini key={workout.id} workout={workout}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}><SecondaryButton onClick={() => onMove(workout)}>Move</SecondaryButton><SecondaryButton onClick={() => onRemove(workout.id)}>Remove</SecondaryButton></div></WorkoutMini>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>No workout here yet. Tap below to fit one in.</p>}<SecondaryButton onClick={onAssign}>Assign workout</SecondaryButton></CardStack></SectionCard>; }
function WorkoutGroup({ category, workouts, onAssign }: { category: PlannerCategory; workouts: GeneratedWorkout[]; onAssign: (workout: GeneratedWorkout) => void }) { return <CardStack><h4 style={{ ...typography.h3, margin: 0 }}>{category[0].toUpperCase() + category.slice(1)}</h4>{workouts.length ? workouts.map((workout) => <WorkoutMini key={workout.id} workout={workout}><PrimaryButton onClick={() => onAssign(workout)}>Assign</PrimaryButton></WorkoutMini>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Nothing waiting here.</p>}</CardStack>; }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} style={{ ...typography.body, minHeight: 56, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.input, padding: spacing.md, background: colors.neutral.surface, color: colors.neutral.text }}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
const linkButton = { ...typography.button, color: colors.accent.sky, background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer' };
