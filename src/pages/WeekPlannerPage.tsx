import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, InfoBanner, PageStack, PrimaryButton, ProgressBar, SecondaryButton, SectionCard, SlidePanel, StatusChip, TextArea, TextInput } from '../components/ui';
import { colors, radius, spacing, typography } from '../design';
import { addDays, parseIsoDate, toIsoDate } from '../engine/dateHelpers';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, GeneratedWorkoutType, TrainingPhase, WeekType } from '../engine/planTypes';
import { readStorageValue, storageKeys, writeStorageValue } from '../utils/storage';
import { buildSuggestedPlanner, workoutsForWeek } from '../utils/planning';

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const plannerKey = storageKeys.weeklyPlanner;
type PlannerCategory = 'foundation' | 'optional' | 'extra';
type PlannerState = { assignments: Record<string, string>; extraWorkouts: GeneratedWorkout[] };
type PanelMode = { kind: 'remaining' } | { kind: 'chooseForDay'; date: string } | { kind: 'day'; date: string } | { kind: 'assignWorkout'; workoutId: string } | { kind: 'moveWorkout'; workoutId: string } | { kind: 'detail'; workoutId: string } | { kind: 'complete'; workoutId: string; date?: string } | { kind: 'past'; date: string } | null;
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
  const navigate = useNavigate();
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  const storedWeek = readStorageValue<GeneratedTrainingWeek | null>(storageKeys.currentWeek, null);
  const currentWeek = storedWeek ?? plan?.weeks[0] ?? null;
  const [planner, setPlanner] = useState<PlannerState>(() => plan ? buildSuggestedPlanner(plan, readPlanner()) : readPlanner());
  const [panel, setPanel] = useState<PanelMode>(null);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraTypeLabel, setExtraTypeLabel] = useState(extraTypes[0].label);
  const [extraCategory, setExtraCategory] = useState<PlannerCategory>('extra');
  const [feedback, setFeedback] = useState('');

  const workouts = useMemo(() => currentWeek ? workoutsForWeek(currentWeek, planner) : [], [currentWeek, planner]);
  const days = useMemo(() => currentWeek ? dayNames.map((name, index) => ({ name, date: toIsoDate(addDays(parseIsoDate(currentWeek.startsOn), index)) })) : [], [currentWeek]);
  const assignedByDay = days.map((day) => ({ ...day, workouts: workouts.filter((workout) => planner.assignments[workout.id] === day.date) }));
  const remaining = workouts.filter((workout) => !planner.assignments[workout.id]);
  const todayIso = toIsoDate(new Date());
  const today = assignedByDay.find((day) => day.date === todayIso);
  const warnings = buildWarnings(assignedByDay);

  function savePlanner(next: PlannerState) { setPlanner(next); writeStorageValue(plannerKey, next); }
  function assign(workoutId: string, date: string) {
    savePlanner({ ...planner, assignments: { ...planner.assignments, [workoutId]: date } });
    const dayName = days.find((day) => day.date === date)?.name ?? 'that day';
    setFeedback(`Workout planned for ${dayName}.`);
    setPanel(null);
  }
  function completeWorkout(workoutId: string) {
    const update = (week: GeneratedTrainingWeek) => ({ ...week, foundationWorkouts: week.foundationWorkouts.map((w) => w.id === workoutId ? { ...w, status: 'completed' as const } : w), optionalWorkouts: week.optionalWorkouts.map((w) => w.id === workoutId ? { ...w, status: 'completed' as const } : w) });
    if (currentWeek) writeStorageValue(storageKeys.currentWeek, update(currentWeek));
    if (plan) writeStorageValue(storageKeys.plan, { ...plan, weeks: plan.weeks.map((week) => week.weekNumber === currentWeek?.weekNumber ? update(week) : week) });
    setFeedback('Workout completed. Nice work.'); setPanel(null);
  }
  function remove(workoutId: string) { const { [workoutId]: _removed, ...assignments } = planner.assignments; savePlanner({ ...planner, assignments }); setFeedback('Workout returned to Remaining Workouts.'); }
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

  const activeDay = panel && ('date' in panel) ? assignedByDay.find((day) => day.date === panel.date) : null;
  const activeWorkout = panel && ('workoutId' in panel) ? workouts.find((workout) => workout.id === panel.workoutId) : null;

  return <PageStack>
    <HeroTitle eyebrow="Week planner" title="This Week">Week {currentWeek.weekNumber} • {formatPhase(currentWeek.phase)} • {formatWeekType(currentWeek.weekType)}</HeroTitle>
    <PrimaryButton onClick={() => navigate('/plan-review')}>View Full Plan</PrimaryButton>
    <SectionCard><CardStack>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
        <Stat label="Week" value={`${currentWeek.weekNumber}`} />
        <Stat label="Phase" value={formatPhase(currentWeek.phase)} />
        <Stat label="Type" value={formatWeekType(currentWeek.weekType)} />
        <Stat label="Target" value={`${currentWeek.targetDistanceRangeKm.min}–${currentWeek.targetDistanceRangeKm.max} km`} detail={`${currentWeek.targetDurationRangeMin.min}–${currentWeek.targetDurationRangeMin.max} min`} />
      </div>
      <ProgressRow label="Foundation" value={foundationDone} total={currentWeek.foundationWorkouts.length} />
      <ProgressRow label="Optional" value={optionalDone} total={currentWeek.optionalWorkouts.length} />
      <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{currentWeek.coachingMessage}</p>
    </CardStack></SectionCard>
    {feedback ? <InfoBanner>{feedback}</InfoBanner> : null}
    {today && today.workouts.length === 0 ? <InfoBanner>No workout planned today. <button onClick={() => setPanel({ kind: 'chooseForDay', date: today.date })} style={linkButton}>Choose Today&apos;s Workout</button></InfoBanner> : null}
    {warnings.map((warning) => <WarningRibbon key={warning}>{warning}</WarningRibbon>)}
    <WeekSnapshot days={assignedByDay} todayIso={todayIso} onDayTap={(day) => setPanel({ kind: day.date < todayIso ? 'past' : day.workouts.length ? 'day' : 'chooseForDay', date: day.date })} />
    <button type="button" onClick={() => setPanel({ kind: 'remaining' })} style={remainingButtonStyle}>
      <span><strong>Remaining Workouts</strong><small>{remaining.length} workout{remaining.length === 1 ? '' : 's'} waiting</small></span>
      <span aria-hidden="true">→</span>
    </button>
    <SlidePanel isOpen={Boolean(panel)} title={panelTitle(panel, activeDay, activeWorkout)} subtitle={panelSubtitle(panel, activeDay)} onClose={() => setPanel(null)}>
      {panel?.kind === 'remaining' ? <RemainingPanel remaining={remaining} onAssign={(workout) => setPanel({ kind: 'assignWorkout', workoutId: workout.id })} extraTitle={extraTitle} setExtraTitle={setExtraTitle} extraTypeLabel={extraTypeLabel} setExtraTypeLabel={setExtraTypeLabel} extraCategory={extraCategory} setExtraCategory={setExtraCategory} onAdd={addExtraWorkout} /> : null}
      {panel?.kind === 'past' && activeDay ? <PastDayPanel day={activeDay} onComplete={(workout) => setPanel({ kind: 'complete', workoutId: workout.id, date: activeDay.date })} /> : null}
      {panel?.kind === 'chooseForDay' && activeDay ? <ChooseForDayPanel day={activeDay} remaining={remaining} onAssign={(workout) => assign(workout.id, activeDay.date)} onOpenRemaining={() => setPanel({ kind: 'remaining' })} /> : null}
      {panel?.kind === 'day' && activeDay ? <PlannedDayPanel day={activeDay} onView={(workout) => setPanel({ kind: 'detail', workoutId: workout.id })} onMove={(workout) => setPanel({ kind: 'moveWorkout', workoutId: workout.id })} onRemove={remove} /> : null}
      {panel?.kind === 'detail' && activeWorkout ? <WorkoutDetailPanel workout={activeWorkout} onMove={() => setPanel({ kind: 'moveWorkout', workoutId: activeWorkout.id })} onComplete={() => setPanel({ kind: 'complete', workoutId: activeWorkout.id })} onRemove={() => remove(activeWorkout.id)} /> : null}
      {panel?.kind === 'complete' && activeWorkout ? <CompletePanel workout={activeWorkout} onSave={() => completeWorkout(activeWorkout.id)} /> : null}
      {(panel?.kind === 'assignWorkout' || panel?.kind === 'moveWorkout') && activeWorkout ? <DayPickerPanel workout={activeWorkout} days={days} onAssign={(date) => assign(activeWorkout.id, date)} /> : null}
    </SlidePanel>
  </PageStack>;
}

function readPlanner(): PlannerState { return readStorageValue<PlannerState>(plannerKey, emptyPlanner); }
function formatPhase(phase: TrainingPhase) { return phase.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatWeekType(type: WeekType) { return `${type[0].toUpperCase()}${type.slice(1)} week`; }
function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(parseIsoDate(date)); }
function workoutTone(workout: GeneratedWorkout) { if (workout.type === 'quality_session') return 'purple'; if (workout.type === 'long_run') return 'orange'; if (workout.type === 'recovery' || workout.type === 'cross_training') return 'sky'; return workout.category === 'extra' ? 'purple' : 'green'; }
function hard(workout: GeneratedWorkout) { return workout.type === 'quality_session' || workout.type === 'long_run' || workout.intensity.toLowerCase().includes('hard'); }
function buildWarnings(days: { workouts: GeneratedWorkout[] }[]) { const warnings: string[] = []; const hardDays = days.filter((day) => day.workouts.some(hard)).length; days.forEach((day, index) => { const today = day.workouts; const previous = days[index - 1]?.workouts ?? []; if (today.some((w) => w.type === 'quality_session') && previous.some((w) => w.type === 'quality_session')) warnings.push('Gentle note: threshold-style sessions on back-to-back days can feel spicy.'); if (today.some((w) => w.type === 'long_run') && previous.some((w) => w.type === 'quality_session')) warnings.push('Friendly reminder: a long run after threshold may need extra recovery.'); }); if (hardDays >= 3) warnings.push('This week now has three hard days. Keep the easy days truly easy.'); return [...new Set(warnings)]; }

function WeekSnapshot({ days, todayIso, onDayTap }: { days: Array<{ name: string; date: string; workouts: GeneratedWorkout[] }>; todayIso: string; onDayTap: (day: { name: string; date: string; workouts: GeneratedWorkout[] }) => void }) {
  return <SectionCard><CardStack>
    <h3 style={{ ...typography.h3, margin: 0 }}>Monday–Sunday</h3>
    <div style={{ display: 'grid', gap: spacing.sm }}>
      {days.map((day) => { const past = day.date < todayIso; return <button key={day.date} type="button" onClick={() => onDayTap(day)} style={{ ...dayButtonStyle, opacity: past ? 0.55 : 1, background: past ? colors.neutral.faint : colors.neutral.surface }}>
        <div style={{ minWidth: 0 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.sm }}><strong>{day.name}</strong><span style={{ ...typography.small, color: colors.neutral.muted }}>{formatDate(day.date)}</span></div>
          <div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.xs }}>{day.workouts.length ? day.workouts.map((workout) => <Chip key={workout.id} tone={workoutTone(workout)}>{workout.type === 'race' ? '🏁 ' : ''}{workout.title}</Chip>) : <span style={{ ...typography.small, color: colors.neutral.muted }}>{past ? 'Past' : 'Open'}</span>}</div></div>
        <span style={{ ...typography.caption, color: colors.neutral.muted }}>{day.workouts.some((workout) => workout.status === 'completed') ? 'Completed' : past ? (day.workouts.length ? 'Missed' : 'Past') : day.workouts.length ? 'Planned' : 'Open'}</span>
      </button>})}
    </div>
  </CardStack></SectionCard>;
}
function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{label}</p><h3 style={{ ...typography.h3, margin: `${spacing.xs}px 0 0` }}>{value}</h3>{detail ? <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{detail}</p> : null}</div>; }
function panelTitle(panel: PanelMode, day?: { name: string } | null, workout?: GeneratedWorkout | null) { if (!panel) return ''; if (panel.kind === 'past') return 'Update past day'; if (panel.kind === 'detail') return workout?.title ?? 'Workout details'; if (panel.kind === 'complete') return 'Complete workout'; if (panel.kind === 'remaining') return 'Remaining Workouts'; if (panel.kind === 'chooseForDay' || panel.kind === 'day') return day?.name ?? 'Day'; return panel.kind === 'moveWorkout' ? `Move ${workout?.title ?? 'Workout'}` : `Assign ${workout?.title ?? 'Workout'}`; }
function panelSubtitle(panel: PanelMode, day?: { workouts: GeneratedWorkout[] } | null) { if (panel?.kind === 'chooseForDay') return 'Choose a workout for this day'; if (panel?.kind === 'day') return day?.workouts.length ? 'Planned workouts' : 'Open'; return undefined; }
function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) { return <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}><span style={typography.small}>{label}</span><span style={{ ...typography.small, color: colors.neutral.muted }}>{value} / {total}</span></div><ProgressBar value={total ? (value / total) * 100 : 0} /></div>; }
function WarningRibbon({ children }: { children: string }) { return <div style={{ ...typography.small, color: colors.accent.amber, background: colors.accent.amberTint, border: `1px solid ${colors.accent.amber}`, borderRadius: radius.card, padding: spacing.md }}>{children}</div>; }
function WorkoutMini({ workout, children, onClick }: { workout: GeneratedWorkout; children?: React.ReactNode; onClick?: () => void }) { const content = <CardStack><div><Chip tone={workoutTone(workout)}>{workout.category} • {workout.type.replace('_', ' ')}</Chip><h4 style={{ ...typography.h3, margin: `${spacing.xs}px 0 0` }}>{workout.title}</h4><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>{[workout.plannedDurationMin && `${workout.plannedDurationMin} min`, workout.plannedDistanceKm && `${workout.plannedDistanceKm} km`].filter(Boolean).join(' • ') || 'Flexible'} • {workout.purpose}</p></div>{children}</CardStack>; return onClick ? <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onClick(); }} style={workoutButtonStyle}>{content}</div> : <div style={workoutCardStyle}>{content}</div>; }
function ChooseForDayPanel({ day, remaining, onAssign, onOpenRemaining }: { day: { date: string; workouts: GeneratedWorkout[] }; remaining: GeneratedWorkout[]; onAssign: (workout: GeneratedWorkout) => void; onOpenRemaining: () => void }) { return <CardStack>{remaining.length ? remaining.map((workout) => <WorkoutMini key={workout.id} workout={workout} onClick={() => onAssign(workout)} />) : <><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>All workouts are already planned.</p><PrimaryButton onClick={onOpenRemaining}>Open Remaining Workouts</PrimaryButton></>}</CardStack>; }
function PlannedDayPanel({ day, onView, onMove, onRemove }: { day: { workouts: GeneratedWorkout[] }; onView: (workout: GeneratedWorkout) => void; onMove: (workout: GeneratedWorkout) => void; onRemove: (id: string) => void }) { return <CardStack>{day.workouts.map((workout) => <WorkoutMini key={workout.id} workout={workout}><div style={{ display: 'grid', gap: spacing.sm }}><PrimaryButton onClick={() => onView(workout)}>View Details</PrimaryButton><SecondaryButton onClick={() => onMove(workout)}>Move</SecondaryButton><SecondaryButton onClick={() => onRemove(workout.id)}>Remove</SecondaryButton></div></WorkoutMini>)}</CardStack>; }
function RemainingPanel(props: { remaining: GeneratedWorkout[]; onAssign: (workout: GeneratedWorkout) => void; extraTitle: string; setExtraTitle: (value: string) => void; extraTypeLabel: string; setExtraTypeLabel: (value: string) => void; extraCategory: PlannerCategory; setExtraCategory: (value: PlannerCategory) => void; onAdd: () => void }) { const [formOpen, setFormOpen] = useState(false); return <CardStack>{(['foundation','optional','extra'] as PlannerCategory[]).map((category) => <CardStack key={category}><h4 style={{ ...typography.h3, margin: 0 }}>{category[0].toUpperCase() + category.slice(1)}</h4>{props.remaining.filter((workout) => workout.category === category).length ? props.remaining.filter((workout) => workout.category === category).map((workout) => <WorkoutMini key={workout.id} workout={workout} onClick={() => props.onAssign(workout)}><PrimaryButton onClick={() => props.onAssign(workout)}>Assign</PrimaryButton></WorkoutMini>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Nothing waiting here.</p>}</CardStack>)}<SecondaryButton onClick={() => setFormOpen(!formOpen)}>+ Add Workout</SecondaryButton>{formOpen ? <CardStack><TextInput value={props.extraTitle} onChange={(event) => props.setExtraTitle(event.target.value)} placeholder="Title" /><Select value={props.extraTypeLabel} onChange={props.setExtraTypeLabel} options={extraTypes.map((item) => item.label)} /><Select value={props.extraCategory} onChange={(value) => props.setExtraCategory(value as PlannerCategory)} options={['foundation','optional','extra']} /><PrimaryButton onClick={props.onAdd}>Save Workout</PrimaryButton></CardStack> : null}</CardStack>; }
function DayPickerPanel({ workout, days, onAssign }: { workout: GeneratedWorkout; days: Array<{ name: string; date: string }>; onAssign: (date: string) => void }) { return <CardStack><WorkoutMini workout={workout} />{days.map((day) => <SecondaryButton key={day.date} onClick={() => onAssign(day.date)}>{day.name} • {formatDate(day.date)}</SecondaryButton>)}</CardStack>; }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} style={{ ...typography.body, minHeight: 56, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.input, padding: spacing.md, background: colors.neutral.surface, color: colors.neutral.text }}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
const dayButtonStyle = { ...typography.body, width: '100%', textAlign: 'left' as const, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: spacing.sm, alignItems: 'center', border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.md, background: colors.neutral.surface, color: colors.neutral.text, cursor: 'pointer' } as const;
const workoutCardStyle = { border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.md, background: colors.neutral.surface } as const;
const workoutButtonStyle = { ...workoutCardStyle, width: '100%', textAlign: 'left' as const, color: colors.neutral.text, cursor: 'pointer' } as const;
const remainingButtonStyle = { ...typography.body, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.lg, background: colors.neutral.surface, color: colors.neutral.text, boxShadow: 'none', cursor: 'pointer' } as const;
const linkButton = { ...typography.button, color: colors.accent.sky, background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer' };

function WorkoutDetailPanel({ workout, onMove, onComplete, onRemove }: { workout: GeneratedWorkout; onMove: () => void; onComplete: () => void; onRemove: () => void }) { return <CardStack><WorkoutMini workout={workout} /><Detail label="Purpose" value={workout.purpose} /><Detail label="Warmup" value={workout.warmup} /><Detail label="Main set" value={workout.mainSet} /><Detail label="Cooldown" value={workout.cooldown} /><Detail label="Coach tip" value={workout.coachTip} /><SecondaryButton onClick={onMove}>Move</SecondaryButton>{workout.status === 'completed' ? <SecondaryButton onClick={onComplete}>Edit Summary</SecondaryButton> : <PrimaryButton onClick={onComplete}>Complete</PrimaryButton>}<SecondaryButton onClick={onRemove}>Remove</SecondaryButton></CardStack>; }
function PastDayPanel({ day, onComplete }: { day: { workouts: GeneratedWorkout[] }; onComplete: (workout: GeneratedWorkout) => void }) { return <CardStack><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Past days cannot receive new future assignments. Record what happened instead.</p>{day.workouts.length ? day.workouts.map((workout) => <WorkoutMini key={workout.id} workout={workout}><PrimaryButton onClick={() => onComplete(workout)}>Update past day</PrimaryButton></WorkoutMini>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>No workout was planned for this day.</p>}</CardStack>; }
function CompletePanel({ workout, onSave }: { workout: GeneratedWorkout; onSave: () => void }) { return <CardStack><WorkoutMini workout={workout} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: spacing.xs }}>{['😫','🙁','😐','🙂','😁'].map((feel) => <button key={feel} type="button" style={{ minHeight: 44, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.button, background: colors.neutral.surface }}>{feel}</button>)}</div><TextArea placeholder="Add note" /><TextInput placeholder="Actual time" inputMode="numeric" /><TextInput placeholder="Actual distance" inputMode="decimal" /><PrimaryButton onClick={onSave}>Save</PrimaryButton></CardStack>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{label}</p><p style={{ ...typography.small, color: colors.neutral.text, margin: `${spacing.xs}px 0 0` }}>{value}</p></div>; }
