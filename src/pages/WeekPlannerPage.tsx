import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, InfoBanner, PageStack, PrimaryButton, ProgressBar, SecondaryButton, SectionCard, SlidePanel, TextInput } from '../components/ui';
import { colors, radius, spacing, typography } from '../design';
import { addDays, parseIsoDate, toIsoDate } from '../engine/dateHelpers';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, GeneratedWorkoutType, TrainingPhase, WeekType } from '../engine/planTypes';
import { readStorageValue, storageKeys, writeStorageValue } from '../utils/storage';
import { buildSuggestedPlanner, normalizeWeeklyCompletionRecords, resolveWeek, upsertWeeklyCompletionRecord, upsertWorkoutLog, type CompletionLog, type ResolvedWorkout, type WeeklyCompletionRecord } from '../utils/planning';

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const plannerKey = storageKeys.weeklyPlanner;
type PlannerCategory = 'foundation' | 'optional' | 'extra';
type PlannerState = { assignments: Record<string, string>; extraWorkouts: GeneratedWorkout[] };
type PanelMode = { kind: 'remaining' } | { kind: 'chooseForDay'; date: string } | { kind: 'day'; date: string } | { kind: 'assignWorkout'; workoutId: string } | { kind: 'moveWorkout'; workoutId: string } | { kind: 'detail'; workoutId: string } | { kind: 'complete'; workoutId: string; date?: string } | { kind: 'past'; date: string } | { kind: 'review'; done?: boolean; confirm?: boolean } | null;
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
  const [searchParams] = useSearchParams();
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  const storedWeek = readStorageValue<GeneratedTrainingWeek | null>(storageKeys.currentWeek, null);
  const requestedWeek = Number(searchParams.get('week'));
  const currentWeek = (requestedWeek && plan?.weeks.find((week) => week.weekNumber === requestedWeek)) ?? storedWeek ?? plan?.weeks[0] ?? null;
  const [planner, setPlanner] = useState<PlannerState>(() => plan ? buildSuggestedPlanner(plan, readPlanner()) : readPlanner());
  const [panel, setPanel] = useState<PanelMode>(null);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraTypeLabel, setExtraTypeLabel] = useState(extraTypes[0].label);
  const [extraCategory, setExtraCategory] = useState<PlannerCategory>('extra');
  const [feedback, setFeedback] = useState('');
  const [logs, setLogs] = useState<CompletionLog[]>(() => readStorageValue<CompletionLog[]>(storageKeys.workoutLogs, []));
  const [weekRecords, setWeekRecords] = useState<WeeklyCompletionRecord[]>(() => normalizeWeeklyCompletionRecords(readStorageValue<WeeklyCompletionRecord[]>(storageKeys.weekSummaries, [])));
  const [weeklyReflection, setWeeklyReflection] = useState('');

  const resolvedWeek = useMemo(() => currentWeek ? resolveWeek(currentWeek, planner, logs) : null, [currentWeek, planner, logs]);
  const workouts = resolvedWeek?.workouts ?? [];
  const days = useMemo(() => currentWeek ? dayNames.map((name, index) => ({ name, date: toIsoDate(addDays(parseIsoDate(currentWeek.startsOn), index)) })) : [], [currentWeek]);
  const assignedByDay = days.map((day) => ({ ...day, workouts: workouts.filter((workout) => planner.assignments[workout.id] === day.date) }));
  const remaining = workouts.filter((workout) => !planner.assignments[workout.id]);
  const todayIso = toIsoDate(new Date());
  const today = assignedByDay.find((day) => day.date === todayIso);
  const warnings = buildWarnings(assignedByDay);
  const weekRecord = currentWeek ? weekRecords.find((record) => record.weekNumber === currentWeek.weekNumber && record.archived) : undefined;
  const isArchived = Boolean(weekRecord);
  const isReadyToReview = currentWeek ? todayIso >= currentWeek.endsOn : false;

  function savePlanner(next: PlannerState) { if (isArchived) return; setPlanner(next); writeStorageValue(plannerKey, next); }
  function assign(workoutId: string, date: string) {
    savePlanner({ ...planner, assignments: { ...planner.assignments, [workoutId]: date } });
    const dayName = days.find((day) => day.date === date)?.name ?? 'that day';
    setFeedback(`Workout planned for ${dayName}.`);
    setPanel(null);
  }
  function completeWorkout(workoutId: string, details: { actualDistanceKm?: number; actualDurationMinutes?: number; perceivedEffort?: number; journalNote?: string }) {
    if (!currentWeek || isArchived) return;
    const existing = logs.find((log) => log.workoutId === workoutId);
    const nextLogs = upsertWorkoutLog(logs, {
      ...existing,
      id: existing?.id ?? `log-${workoutId}-${Date.now()}`,
      workoutId,
      weekNumber: currentWeek.weekNumber,
      completedAt: existing?.completedAt ?? new Date().toISOString(),
      status: 'completed',
      ...details,
    });
    setLogs(nextLogs); writeStorageValue(storageKeys.workoutLogs, nextLogs);
    setFeedback('Workout complete. Your reflection has been saved.'); setPanel(null);
  }
  function remove(workoutId: string) { if (isArchived) { setFeedback('Archived weeks are read-only.'); return; } if (logs.some((log) => log.workoutId === workoutId)) { setFeedback('Completed workouts stay locked. Use Edit Summary instead.'); return; } const { [workoutId]: _removed, ...assignments } = planner.assignments; savePlanner({ ...planner, assignments }); setFeedback('Workout returned to Available Workouts.'); }
  function addExtraWorkout() {
    if (!currentWeek || isArchived) return;
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

  function archiveWeek() {
    if (!currentWeek || !resolvedWeek) return;
    const metrics = buildWeeklyMetrics(resolvedWeek.workouts);
    const nextRecord: WeeklyCompletionRecord = { weekNumber: currentWeek.weekNumber, archived: true, completedAt: new Date().toISOString(), weeklyReflection: weeklyReflection.trim().slice(0, 1500) || undefined, metrics };
    const nextRecords = upsertWeeklyCompletionRecord(weekRecords, nextRecord);
    setWeekRecords(nextRecords); writeStorageValue(storageKeys.weekSummaries, nextRecords); setPanel({ kind: 'review', done: true });
  }
  function planNextWeek() { const next = plan?.weeks.find((week) => currentWeek && week.weekNumber > currentWeek.weekNumber); if (next) navigate(`/week?week=${next.weekNumber}`); else setFeedback('No next training week exists in this plan.'); }

  if (!currentWeek) return <PageStack><HeroTitle eyebrow="Weekly planner" title="No plan found">Create a plan first, then come back to organise your week.</HeroTitle></PageStack>;

  const foundationDone = currentWeek.foundationWorkouts.filter((workout) => planner.assignments[workout.id]).length;
  const optionalDone = currentWeek.optionalWorkouts.filter((workout) => planner.assignments[workout.id]).length;

  const activeDay = panel && ('date' in panel) ? assignedByDay.find((day) => day.date === panel.date) : null;
  const activeWorkout = panel && ('workoutId' in panel) ? workouts.find((workout) => workout.id === panel.workoutId) : null;

  return <PageStack>
    <div style={compactHeroStyle}>
      <div>
        <p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' }}>Week {currentWeek.weekNumber}</p>
        <h2 style={{ ...typography.h2, margin: `${spacing.xxs}px 0 0` }}>This Week</h2>
      </div>
      <SecondaryButton onClick={() => navigate('/plan-review')}>Full Plan</SecondaryButton>
    </div>
    <SectionCard><CardStack>
      <div style={summaryLeadStyle}>
        <p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' }}>Coach Focus</p>
        <p style={{ ...typography.body, color: colors.neutral.text, margin: `${spacing.xxs}px 0 0` }}>{coachFocus(currentWeek)}</p>
        {warnings.map((warning) => <p key={warning} style={{ ...typography.small, color: colors.accent.amber, margin: `${spacing.xs}px 0 0` }}>{warning}</p>)}
      </div>
      <div style={summaryGridStyle}>
        <Stat label="Phase" value={formatPhase(currentWeek.phase)} compact />
        <Stat label="Dates" value={`${formatDate(currentWeek.startsOn)}–${formatDate(currentWeek.endsOn)}`} compact />
        <Stat label="Target Distance" value={`${currentWeek.targetDistanceRangeKm.min}–${currentWeek.targetDistanceRangeKm.max} km`} compact />
        <Stat label="Estimated Time" value={`${currentWeek.targetDurationRangeMin.min}–${currentWeek.targetDurationRangeMin.max} min`} compact />
        <Stat label="Key Session" value={keySessionLabel(workouts)} compact />
        <Stat label="Recovery Status" value={formatWeekType(currentWeek.weekType)} compact />
      </div>
      <div style={{ display: 'grid', gap: spacing.xs }}>
        <ProgressRow label="Planned key work" value={foundationDone} total={currentWeek.foundationWorkouts.length} />
        <ProgressRow label="Optional support" value={optionalDone} total={currentWeek.optionalWorkouts.length} />
      </div>
    </CardStack></SectionCard>
    {feedback ? <InfoBanner>{feedback}</InfoBanner> : null}
    {(isReadyToReview || isArchived) ? <SectionCard><div style={reviewEntryStyle}><div><h3 style={{ ...typography.h3, margin: 0 }}>{isArchived ? 'Completed Week' : 'Ready to review'}</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xxs}px 0 0` }}>{isArchived ? 'This weekly record is archived and read-only.' : 'Pause, look back, and finish the week when you are ready.'}</p></div><PrimaryButton onClick={() => { setWeeklyReflection(weekRecord?.weeklyReflection ?? ''); setPanel({ kind: 'review' }); }}>{isArchived ? 'Review Completed Week' : 'Review & Finish Week'}</PrimaryButton></div></SectionCard> : null}
    {!isArchived && today && today.workouts.length === 0 ? <InfoBanner>No workout planned today. <button onClick={() => setPanel({ kind: 'chooseForDay', date: today.date })} style={linkButton}>Choose Today&apos;s Workout</button></InfoBanner> : null}
    <WeekSnapshot days={assignedByDay} todayIso={todayIso} archived={isArchived} onDayTap={(day) => isArchived ? setPanel({ kind: 'review' }) : setPanel({ kind: day.date < todayIso ? 'past' : day.workouts.length ? 'day' : 'chooseForDay', date: day.date })} onWorkoutTap={(workout) => isArchived ? setPanel({ kind: 'review' }) : setPanel({ kind: 'detail', workoutId: workout.id })} onMove={(workout) => isArchived ? setFeedback('Archived weeks are read-only.') : setPanel({ kind: 'moveWorkout', workoutId: workout.id })} />
    {!isArchived ? <button type="button" onClick={() => setPanel({ kind: 'remaining' })} style={remainingButtonStyle}>
      <span><strong>Available Workouts</strong><small>{remaining.length} workout{remaining.length === 1 ? '' : 's'} ready to place</small></span>
      <span aria-hidden="true">→</span>
    </button> : null}
    <SlidePanel isOpen={Boolean(panel)} title={panelTitle(panel, activeDay, activeWorkout)} subtitle={panelSubtitle(panel, activeDay)} onClose={() => setPanel(null)}>
      {panel?.kind === 'remaining' ? <RemainingPanel remaining={remaining} onAssign={(workout) => setPanel({ kind: 'assignWorkout', workoutId: workout.id })} extraTitle={extraTitle} setExtraTitle={setExtraTitle} extraTypeLabel={extraTypeLabel} setExtraTypeLabel={setExtraTypeLabel} extraCategory={extraCategory} setExtraCategory={setExtraCategory} onAdd={addExtraWorkout} /> : null}
      {panel?.kind === 'past' && activeDay ? <PastDayPanel day={activeDay} onComplete={(workout) => setPanel({ kind: 'complete', workoutId: workout.id, date: activeDay.date })} /> : null}
      {panel?.kind === 'chooseForDay' && activeDay ? <ChooseForDayPanel day={activeDay} remaining={remaining} onAssign={(workout) => assign(workout.id, activeDay.date)} onOpenRemaining={() => setPanel({ kind: 'remaining' })} /> : null}
      {panel?.kind === 'day' && activeDay ? <PlannedDayPanel day={activeDay} onView={(workout) => setPanel({ kind: 'detail', workoutId: workout.id })} onMove={(workout) => setPanel({ kind: 'moveWorkout', workoutId: workout.id })} onRemove={remove} /> : null}
      {panel?.kind === 'detail' && activeWorkout ? <WorkoutDetailPanel workout={activeWorkout} week={currentWeek} plannedDay={days.find((day) => day.date === planner.assignments[activeWorkout.id])?.name} onMove={() => setPanel({ kind: 'moveWorkout', workoutId: activeWorkout.id })} onComplete={() => setPanel({ kind: 'complete', workoutId: activeWorkout.id })} onRemove={() => remove(activeWorkout.id)} /> : null}
      {panel?.kind === 'complete' && activeWorkout ? <CompletePanel workout={activeWorkout} plannedDay={days.find((day) => day.date === (panel.date ?? planner.assignments[activeWorkout.id]))?.name} onViewPrescription={() => setPanel({ kind: 'detail', workoutId: activeWorkout.id })} onSave={(details) => completeWorkout(activeWorkout.id, details)} /> : null}
      {panel?.kind === 'review' && resolvedWeek ? <WeeklyReviewPanel week={currentWeek} workouts={resolvedWeek.workouts} nextWeek={plan?.weeks.find((week) => week.weekNumber > currentWeek.weekNumber)} archivedRecord={weekRecord} reflection={weeklyReflection} setReflection={setWeeklyReflection} done={Boolean(panel.done)} confirm={Boolean(panel.confirm)} onAskConfirm={() => setPanel({ kind: 'review', confirm: true })} onArchive={archiveWeek} onReviewAgain={() => setPanel({ kind: 'review' })} onPlanNext={planNextWeek} /> : null}
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

function WeekSnapshot({ days, todayIso, archived, onDayTap, onWorkoutTap, onMove }: { days: Array<{ name: string; date: string; workouts: ResolvedWorkout[] }>; todayIso: string; archived?: boolean; onDayTap: (day: { name: string; date: string; workouts: ResolvedWorkout[] }) => void; onWorkoutTap: (workout: ResolvedWorkout) => void; onMove: (workout: ResolvedWorkout) => void }) {
  return <SectionCard><CardStack>
    <div><h3 style={{ ...typography.h3, margin: 0 }}>Weekly Planner</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xxs}px 0 0` }}>{archived ? 'Archived weekly schedule. Training records are read-only.' : 'Coach recommendation. Tap a workout for details, or move it to fit life.'}</p></div>
    <div style={{ display: 'grid', gap: spacing.xs }}>
      {days.map((day) => { const past = day.date < todayIso; return <div key={day.date} style={{ ...dayButtonStyle, opacity: past ? 0.62 : 1, background: past ? colors.neutral.faint : colors.neutral.surface }}>
        <button type="button" onClick={() => onDayTap(day)} style={dayHeaderButtonStyle}><strong>{day.name}</strong><span style={{ ...typography.caption, color: colors.neutral.muted }}>{formatDate(day.date)}</span></button>
        <div style={{ display: 'grid', gap: spacing.xs }}>
          {day.workouts.length ? day.workouts.map((workout) => <WorkoutRow key={workout.id} workout={workout} onOpen={() => onWorkoutTap(workout)} onMove={() => onMove(workout)} />) : <button type="button" onClick={() => onDayTap(day)} style={restRowStyle}><span>{past ? 'Past' : `${roleIndicator(null)} Rest`}</span><span style={{ ...typography.caption, color: colors.neutral.muted }}>{past ? 'No planned workout' : 'Open'}</span></button>}
        </div>
      </div>})}
    </div>
  </CardStack></SectionCard>;
}
function Stat({ label, value, detail, compact }: { label: string; value: string; detail?: string; compact?: boolean }) { return <div><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{label}</p><h3 style={{ ...(compact ? typography.small : typography.h3), fontWeight: compact ? 650 : typography.h3.fontWeight, margin: `${spacing.xxs}px 0 0` }}>{value}</h3>{detail ? <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{detail}</p> : null}</div>; }
function panelTitle(panel: PanelMode, day?: { name: string } | null, workout?: GeneratedWorkout | null) { if (!panel) return ''; if (panel.kind === 'review') return panel.done ? 'Week complete' : 'Review & Finish Week'; if (panel.kind === 'past') return 'Update past day'; if (panel.kind === 'detail') return workout?.title ?? 'Workout details'; if (panel.kind === 'complete') return 'Complete workout'; if (panel.kind === 'remaining') return 'Available Workouts'; if (panel.kind === 'chooseForDay' || panel.kind === 'day') return day?.name ?? 'Day'; return panel.kind === 'moveWorkout' ? `Move ${workout?.title ?? 'Workout'}` : `Assign ${workout?.title ?? 'Workout'}`; }
function panelSubtitle(panel: PanelMode, day?: { workouts: GeneratedWorkout[] } | null) { if (panel?.kind === 'chooseForDay') return 'Choose a workout for this day'; if (panel?.kind === 'day') return day?.workouts.length ? 'Planned workouts' : 'Open'; return undefined; }
function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) { return <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}><span style={typography.small}>{label}</span><span style={{ ...typography.small, color: colors.neutral.muted }}>{value} / {total}</span></div><ProgressBar value={total ? (value / total) * 100 : 0} /></div>; }

function coachFocus(week: GeneratedTrainingWeek) {
  const race = [...week.foundationWorkouts, ...week.optionalWorkouts].find((workout) => workout.type === 'race');
  if (race) return `This week’s ${race.title.replace(/^🏁\s*/, '')} replaces your normal key workout.`;
  if (week.weekType === 'recovery') return 'This is a recovery week. Absorb the work and keep the easy days easy.';
  if (week.phase === 'taper') return 'This week reduces fatigue before race day.';
  if ([...week.foundationWorkouts, ...week.optionalWorkouts].some((workout) => workout.type === 'quality_session')) return 'This week introduces purposeful quality while protecting recovery.';
  return week.coachingMessage;
}
function keySessionLabel(workouts: GeneratedWorkout[]) {
  const key = workouts.find((workout) => workout.type === 'race') ?? workouts.find((workout) => workout.type === 'long_run') ?? workouts.find((workout) => workout.type === 'quality_session') ?? workouts[0];
  return key ? `${roleIndicator(key)} ${key.type === 'long_run' && key.plannedDistanceKm ? `Long Run – ${key.plannedDistanceKm} km` : key.title}` : 'Recovery week';
}
function roleIndicator(workout: GeneratedWorkout | null) {
  if (!workout) return '⚪';
  if (workout.type === 'race') return '🏁';
  if (workout.type === 'quality_session') return '⭐';
  if (workout.type === 'long_run') return '🟣';
  if (workout.type === 'recovery' || workout.type === 'shakeout') return '🟢';
  if (workout.type === 'easy_run') return '💙';
  return workout.category === 'optional' ? '⚪' : '•';
}
function roleLabel(workout: GeneratedWorkout) {
  if (workout.type === 'race') return '🏁 Race';
  if (workout.type === 'quality_session') return '⭐ Key Session';
  if (workout.type === 'long_run') return '🟣 Long Run';
  if (workout.type === 'recovery' || workout.type === 'shakeout') return '🟢 Recovery';
  if (workout.type === 'easy_run') return '💙 Easy';
  return workout.category === 'optional' ? '⚪ Optional' : 'Support';
}
function WorkoutRow({ workout, onOpen, onMove }: { workout: ResolvedWorkout; onOpen: () => void; onMove: () => void }) {
  return <div style={workoutRowShellStyle}>
    <button type="button" onClick={onOpen} style={workoutRowButtonStyle}>
      <span aria-hidden="true" style={{ width: 22 }}>{roleIndicator(workout)}</span>
      <span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.title}</strong><small style={{ color: colors.neutral.muted }}>{workout.completion ? 'Completed' : ([workout.plannedDurationMin && `${workout.plannedDurationMin} min`, workout.plannedDistanceKm && `${workout.plannedDistanceKm} km`].filter(Boolean).join(' • ') || 'Flexible')}</small></span>
    </button>
    <button type="button" aria-label={`Move ${workout.title}`} onClick={onMove} style={moveIconButtonStyle}>↔</button>
  </div>;
}

function WorkoutMini({ workout, children, onClick }: { workout: GeneratedWorkout; children?: React.ReactNode; onClick?: () => void }) { const content = <CardStack><div><Chip tone={workoutTone(workout)}>{roleLabel(workout)}</Chip><h4 style={{ ...typography.h3, margin: `${spacing.xs}px 0 0` }}>{workout.title}</h4><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>{[workout.plannedDurationMin && `${workout.plannedDurationMin} min`, workout.plannedDistanceKm && `${workout.plannedDistanceKm} km`].filter(Boolean).join(' • ') || 'Flexible'} • {workout.purpose}</p></div>{children}</CardStack>; return onClick ? <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onClick(); }} style={workoutButtonStyle}>{content}</div> : <div style={workoutCardStyle}>{content}</div>; }
function ChooseForDayPanel({ day, remaining, onAssign, onOpenRemaining }: { day: { date: string; workouts: GeneratedWorkout[] }; remaining: GeneratedWorkout[]; onAssign: (workout: GeneratedWorkout) => void; onOpenRemaining: () => void }) { return <CardStack>{remaining.length ? remaining.map((workout) => <WorkoutMini key={workout.id} workout={workout} onClick={() => onAssign(workout)} />) : <><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>All workouts are already planned.</p><PrimaryButton onClick={onOpenRemaining}>Open Available Workouts</PrimaryButton></>}</CardStack>; }
function PlannedDayPanel({ day, onView, onMove, onRemove }: { day: { workouts: GeneratedWorkout[] }; onView: (workout: GeneratedWorkout) => void; onMove: (workout: GeneratedWorkout) => void; onRemove: (id: string) => void }) { return <CardStack>{day.workouts.map((workout) => <WorkoutMini key={workout.id} workout={workout}><div style={{ display: 'grid', gap: spacing.sm }}><PrimaryButton onClick={() => onView(workout)}>View Details</PrimaryButton><SecondaryButton onClick={() => onMove(workout)}>Move</SecondaryButton><SecondaryButton onClick={() => onRemove(workout.id)}>Remove</SecondaryButton></div></WorkoutMini>)}</CardStack>; }
function RemainingPanel(props: { remaining: GeneratedWorkout[]; onAssign: (workout: GeneratedWorkout) => void; extraTitle: string; setExtraTitle: (value: string) => void; extraTypeLabel: string; setExtraTypeLabel: (value: string) => void; extraCategory: PlannerCategory; setExtraCategory: (value: PlannerCategory) => void; onAdd: () => void }) { const [formOpen, setFormOpen] = useState(false); return <CardStack>{(['foundation','optional','extra'] as PlannerCategory[]).map((category) => <CardStack key={category}><h4 style={{ ...typography.h3, margin: 0 }}>{category === 'foundation' ? 'Coach Workouts' : category === 'optional' ? 'Optional Support' : 'Added Workouts'}</h4>{props.remaining.filter((workout) => workout.category === category).length ? props.remaining.filter((workout) => workout.category === category).map((workout) => <WorkoutMini key={workout.id} workout={workout} onClick={() => props.onAssign(workout)}></WorkoutMini>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Nothing waiting here.</p>}</CardStack>)}<SecondaryButton onClick={() => setFormOpen(!formOpen)}>+ Add Workout</SecondaryButton>{formOpen ? <CardStack><TextInput value={props.extraTitle} onChange={(event) => props.setExtraTitle(event.target.value)} placeholder="Title" /><Select value={props.extraTypeLabel} onChange={props.setExtraTypeLabel} options={extraTypes.map((item) => item.label)} /><Select value={props.extraCategory} onChange={(value) => props.setExtraCategory(value as PlannerCategory)} options={['foundation','optional','extra']} /><PrimaryButton onClick={props.onAdd}>Save Workout</PrimaryButton></CardStack> : null}</CardStack>; }
function DayPickerPanel({ workout, days, onAssign }: { workout: GeneratedWorkout; days: Array<{ name: string; date: string }>; onAssign: (date: string) => void }) { return <CardStack><WorkoutMini workout={workout} />{days.map((day) => <SecondaryButton key={day.date} onClick={() => onAssign(day.date)}>{day.name} • {formatDate(day.date)}</SecondaryButton>)}</CardStack>; }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} style={{ ...typography.body, width: '100%', maxWidth: '100%', boxSizing: 'border-box', minHeight: 48, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.input, padding: spacing.sm, background: colors.neutral.surface, color: colors.neutral.text }}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }

const compactHeroStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(88px, 112px)', gap: spacing.sm, alignItems: 'center' } as const;
const summaryLeadStyle = { borderLeft: `3px solid ${colors.primary.green}`, paddingLeft: spacing.sm } as const;
const reviewEntryStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: spacing.sm, alignItems: 'center' } as const;
const summaryGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing.sm}px ${spacing.md}px` } as const;
const dayHeaderButtonStyle = { ...typography.small, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, width: '100%', border: 0, background: 'transparent', color: colors.neutral.text, padding: 0, textAlign: 'left' as const, cursor: 'pointer' } as const;
const restRowStyle = { ...typography.small, width: '100%', display: 'flex', justifyContent: 'space-between', gap: spacing.sm, border: 0, borderRadius: radius.input, padding: `${spacing.xxs}px 0`, background: 'transparent', color: colors.neutral.muted, cursor: 'pointer' } as const;
const workoutRowShellStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 36px', gap: spacing.xs, alignItems: 'center' } as const;
const workoutRowButtonStyle = { ...typography.small, display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: spacing.xs, alignItems: 'center', width: '100%', border: 0, borderRadius: radius.input, padding: `${spacing.xs}px 0`, background: 'transparent', color: colors.neutral.text, textAlign: 'left' as const, cursor: 'pointer', minWidth: 0 } as const;
const moveIconButtonStyle = { width: 36, height: 36, borderRadius: radius.button, border: `1px solid ${colors.neutral.border}`, background: colors.neutral.surface, color: colors.neutral.muted, cursor: 'pointer' } as const;
const dayButtonStyle = { ...typography.body, width: '100%', textAlign: 'left' as const, display: 'grid', gap: spacing.sm, alignItems: 'center', border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.sm, background: colors.neutral.surface, color: colors.neutral.text, cursor: 'pointer' } as const;
const workoutCardStyle = { border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.sm, background: colors.neutral.surface } as const;
const workoutButtonStyle = { ...workoutCardStyle, width: '100%', textAlign: 'left' as const, color: colors.neutral.text, cursor: 'pointer' } as const;
const remainingButtonStyle = { ...typography.body, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.md, background: colors.neutral.surface, color: colors.neutral.text, boxShadow: 'none', cursor: 'pointer' } as const;
const linkButton = { ...typography.button, color: colors.accent.sky, background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer' };

function WorkoutDetailPanel({ workout, week, plannedDay, onMove, onComplete, onRemove }: { workout: ResolvedWorkout; week: GeneratedTrainingWeek; plannedDay?: string; onMove: () => void; onComplete: () => void; onRemove: () => void }) {
  const summary = [workout.plannedDistanceKm ? { label: 'Distance', value: `${workout.plannedDistanceKm} km` } : null, workout.plannedDurationMin ? { label: 'Duration', value: `${workout.plannedDurationMin} min` } : null, workout.intensity ? { label: 'Expected Effort', value: friendlyEffort(workout.intensity) } : null, hard(workout) ? { label: 'Session Load', value: 'Hard / focused' } : { label: 'Session Load', value: 'Easy / supportive' }, fuelPractice(workout) ? { label: 'Focus', value: 'Fuel practice' } : null, racePace(workout) ? { label: 'Pace', value: 'Race pace included' } : null].filter(Boolean) as Array<{ label: string; value: string }>;
  return <CardStack>
    <section style={detailHeroStyle} aria-labelledby="workout-detail-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'flex-start' }}>
        <Chip tone={workoutTone(workout)}>{primaryRole(workout, week)}</Chip>
        {workout.status === 'completed' ? <Chip tone="green">Completed</Chip> : null}
      </div>
      <h3 id="workout-detail-title" style={{ ...typography.h2, margin: `${spacing.xs}px 0 0`, overflowWrap: 'anywhere' }}>{workout.title}</h3>
      <p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>{[plannedDay ? `Planned for ${plannedDay}` : workout.status === 'unplanned' ? 'Unscheduled — choose a day when useful' : null, `Week ${week.weekNumber}`, formatPhase(week.phase), workout.category === 'optional' ? 'Optional Support Session' : null].filter(Boolean).join(' • ')}</p>
    </section>
    <div style={summaryStripStyle}>{summary.map((item) => <div key={item.label}><p style={detailLabelStyle}>{item.label}</p><p style={detailValueStyle}>{item.value}</p></div>)}</div>
    {workout.completion ? <CompletedReflection workout={workout} plannedDay={plannedDay} /> : null}
    {workout.purpose ? <CoachBlock title="Why this workout matters">{workout.purpose}</CoachBlock> : null}
    <section aria-labelledby="prescription-title" style={{ display: 'grid', gap: spacing.xs }}>
      <h4 id="prescription-title" style={{ ...typography.h3, margin: 0 }}>Workout Prescription</h4>
      <PrescriptionPart title="Warm-Up" value={workout.warmup} />
      <PrescriptionPart title="Main Set" value={workout.mainSet} emphasis />
      <PrescriptionPart title="Cooldown" value={workout.cooldown} />
    </section>
    {workout.intensity ? <CoachBlock title="Expected Effort">{friendlyEffort(workout.intensity)}</CoachBlock> : null}
    <ContextBlock workout={workout} week={week} />
    {workout.coachTip ? <CoachBlock title="Coach Tip">{workout.coachTip}</CoachBlock> : null}
    <div style={{ display: 'grid', gap: spacing.sm }}>
      {workout.status === 'completed' ? <><Chip tone="green">Completed</Chip><SecondaryButton onClick={onComplete}>Edit Reflection</SecondaryButton></> : <PrimaryButton onClick={onComplete}>Complete Workout</PrimaryButton>}
      <SecondaryButton onClick={onMove}>Move to another day</SecondaryButton>
      <SecondaryButton onClick={onRemove}>Remove</SecondaryButton>
    </div>
  </CardStack>;
}
function friendlyEffort(value: string) { return value.replace('Zone 2', 'and conversational').replace('Comfortably hard', 'Controlled, comfortably hard'); }
function fuelPractice(workout: GeneratedWorkout) { return /fuel|carbohydrate|hydration|fluids/i.test(`${workout.title} ${workout.purpose} ${workout.mainSet} ${workout.coachTip}`); }
function racePace(workout: GeneratedWorkout) { return /race effort|race-rhythm|marathon effort|half-marathon|race pace/i.test(`${workout.title} ${workout.mainSet} ${workout.intensity}`); }
function primaryRole(workout: GeneratedWorkout, week: GeneratedTrainingWeek) { if (workout.category === 'optional') return 'Optional Support'; if (workout.type === 'race') return workout.title.toLowerCase().includes('milestone') || workout.title.toLowerCase().includes('tune') ? '🏁 Tune-Up Race' : '🏁 Goal Race'; if (week.phase === 'taper' && workout.type === 'quality_session') return 'Taper Sharpening'; if (workout.type === 'long_run') return racePace(workout) ? 'Marathon-Specific Long Run' : 'Long Run'; if (workout.type === 'quality_session') return /threshold|tempo/i.test(`${workout.title} ${workout.mainSet}`) ? 'Threshold' : 'Key Session'; if (workout.type === 'recovery' || workout.type === 'shakeout') return 'Recovery'; if (workout.type === 'easy_run') return 'Easy'; return 'Support'; }
function ContextBlock({ workout, week }: { workout: GeneratedWorkout; week: GeneratedTrainingWeek }) { const items = [workout.type === 'long_run' && fuelPractice(workout) ? 'Practise fuel and hydration as written.' : null, workout.type === 'long_run' && racePace(workout) ? 'Includes controlled race-specific running.' : null, workout.type === 'quality_session' ? `Quality focus: ${primaryRole(workout, week).replace('Taper ', '')}.` : null, workout.type === 'race' ? `${primaryRole(workout, week)} • ${workout.plannedDistanceKm ?? 'Race'} km.` : null, (workout.type === 'recovery' || workout.type === 'easy_run') ? 'Easy effort is intentional; this supports adaptation.' : null, week.phase === 'taper' ? 'Reduced load protects freshness before race day.' : null, workout.category === 'optional' ? 'Optional means useful only if it supports the week.' : null].filter(Boolean); return items.length ? <div style={contextStyle}>{items.map((item) => <p key={item} style={{ ...typography.small, color: colors.neutral.text, margin: 0 }}>{item}</p>)}</div> : null; }
function CoachBlock({ title, children }: { title: string; children: string }) { return <section style={coachBlockStyle}><h4 style={{ ...typography.caption, color: colors.neutral.muted, textTransform: 'uppercase', margin: 0 }}>{title}</h4><p style={{ ...typography.body, color: colors.neutral.text, margin: `${spacing.xs}px 0 0`, overflowWrap: 'anywhere' }}>{children}</p></section>; }
function PrescriptionPart({ title, value, emphasis }: { title: string; value?: string; emphasis?: boolean }) { if (!value) return null; return <section style={{ ...prescriptionPartStyle, borderColor: emphasis ? colors.primary.green : colors.neutral.border, background: emphasis ? colors.primary.greenTint : colors.neutral.surface }}><h5 style={{ ...typography.caption, color: emphasis ? colors.primary.green : colors.neutral.muted, margin: 0, textTransform: 'uppercase' }}>{title}</h5><p style={{ ...typography.body, color: colors.neutral.text, fontWeight: emphasis ? 650 : 400, margin: `${spacing.xs}px 0 0`, overflowWrap: 'anywhere' }}>{value}</p></section>; }
function PastDayPanel({ day, onComplete }: { day: { workouts: GeneratedWorkout[] }; onComplete: (workout: GeneratedWorkout) => void }) { return <CardStack><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Past days cannot receive new future assignments. Record what happened instead.</p>{day.workouts.length ? day.workouts.map((workout) => <WorkoutMini key={workout.id} workout={workout}><PrimaryButton onClick={() => onComplete(workout)}>Update past day</PrimaryButton></WorkoutMini>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>No workout was planned for this day.</p>}</CardStack>; }
const feelingOptions = [
  { value: 1, label: 'Easier than expected' },
  { value: 2, label: 'Comfortable' },
  { value: 3, label: 'About right' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Very hard' },
] as const;
function feelingLabel(value?: number) { return feelingOptions.find((option) => option.value === value)?.label; }
function completionDistance(log?: CompletionLog) { return log?.actualDistanceKm ?? log?.distanceKm; }
function completionDuration(log?: CompletionLog) { return log?.actualDurationMinutes ?? log?.durationMinutes; }
function plannedSummary(workout: GeneratedWorkout) { return [workout.plannedDistanceKm ? `${workout.plannedDistanceKm} km` : null, workout.plannedDurationMin ? `${workout.plannedDurationMin} min` : null, workout.intensity ? friendlyEffort(workout.intensity) : null].filter(Boolean).join(' · ') || 'Flexible'; }
function CompletedReflection({ workout, plannedDay }: { workout: ResolvedWorkout; plannedDay?: string }) {
  const log = workout.completion;
  if (!log) return null;
  return <section style={completedBlockStyle} aria-labelledby="completed-reflection-title">
    <Chip tone="green">Completed</Chip>
    <h4 id="completed-reflection-title" style={{ ...typography.h3, margin: `${spacing.xs}px 0 0` }}>Your Reflection</h4>
    <div style={summaryStripStyle}>
      <div><p style={detailLabelStyle}>Actual Distance</p><p style={detailValueStyle}>{completionDistance(log) ? `${completionDistance(log)} km` : 'Not recorded'}</p></div>
      <div><p style={detailLabelStyle}>Actual Duration</p><p style={detailValueStyle}>{completionDuration(log) ? `${completionDuration(log)} min` : 'Not recorded'}</p></div>
      <div><p style={detailLabelStyle}>How it felt</p><p style={detailValueStyle}>{feelingLabel(log.perceivedEffort) ?? 'Not recorded'}</p></div>
      <div><p style={detailLabelStyle}>Completed</p><p style={detailValueStyle}>{plannedDay ?? formatDate(log.completedAt.slice(0, 10))}</p></div>
    </div>
    {workout.moved && workout.suggestedDate && workout.assignedDay ? <p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>Moved from {formatDate(workout.suggestedDate)} to {formatDate(workout.assignedDay)}.</p> : null}
    {log.journalNote || log.notes ? <div><p style={detailLabelStyle}>Training Journal</p><p style={{ ...typography.body, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: `${spacing.xs}px 0 0` }}>{log.journalNote ?? log.notes}</p></div> : null}
  </section>;
}
function CompletePanel({ workout, plannedDay, onViewPrescription, onSave }: { workout: ResolvedWorkout; plannedDay?: string; onViewPrescription: () => void; onSave: (details: { actualDistanceKm?: number; actualDurationMinutes?: number; perceivedEffort?: number; journalNote?: string }) => void }) {
  const existing = workout.completion;
  const [distance, setDistance] = useState(completionDistance(existing)?.toString() ?? '');
  const [duration, setDuration] = useState(completionDuration(existing)?.toString() ?? '');
  const [effort, setEffort] = useState<number | undefined>(existing?.perceivedEffort);
  const [journalNote, setJournalNote] = useState(existing?.journalNote ?? existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  function save() {
    if (saving) return;
    setSaving(true);
    onSave({ actualDistanceKm: distance.trim() ? Number(distance) : undefined, actualDurationMinutes: duration.trim() ? Number(duration) : undefined, perceivedEffort: effort, journalNote: journalNote.trim().slice(0, 1000) || undefined });
  }
  return <CardStack>
    <section style={plannedContextStyle} aria-labelledby="completion-title">
      <p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' }}>{plannedDay ?? 'Planned workout'}</p>
      <h3 id="completion-title" style={{ ...typography.h3, margin: `${spacing.xxs}px 0 0`, overflowWrap: 'anywhere' }}>{workout.title}</h3>
      <p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>Planned: {plannedSummary(workout)} · {roleLabel(workout).replace(/[🏁⭐🟣🟢💙⚪]/g, '').trim()}</p>
      <button type="button" onClick={onViewPrescription} style={linkButton}>View full prescription</button>
    </section>
    <section style={{ display: 'grid', gap: spacing.xs }} aria-labelledby="actual-details-title">
      <h4 id="actual-details-title" style={{ ...typography.h3, margin: 0 }}>Completed workout details</h4>
      <TextInput aria-label="Actual distance in kilometres" placeholder="Actual distance (km)" inputMode="decimal" value={distance} onChange={(event) => setDistance(event.target.value)} />
      <TextInput aria-label="Actual duration in minutes" placeholder="Actual duration (min)" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} />
    </section>
    <section style={{ display: 'grid', gap: spacing.xs }} aria-labelledby="felt-title">
      <h4 id="felt-title" style={{ ...typography.h3, margin: 0 }}>How did it feel?</h4>
      <div style={feelingGridStyle}>{feelingOptions.map((option) => <button key={option.value} type="button" aria-pressed={effort === option.value} onClick={() => setEffort(option.value)} style={{ ...feelingButtonStyle, borderColor: effort === option.value ? colors.primary.green : colors.neutral.border, background: effort === option.value ? colors.primary.greenTint : colors.neutral.surface }}><span>{option.label}</span>{effort === option.value ? <strong>Selected</strong> : null}</button>)}</div>
    </section>
    <section style={{ display: 'grid', gap: spacing.xs }}>
      <label htmlFor="training-journal" style={{ ...typography.h3, margin: 0 }}>Training Journal</label>
      <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Record anything you may want to remember later.</p>
      <textarea id="training-journal" maxLength={1000} value={journalNote} onChange={(event) => setJournalNote(event.target.value)} placeholder="Legs felt heavy, heart rate was higher than usual, but the final kilometre felt better." style={journalTextAreaStyle} />
      <p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{journalNote.length}/1000</p>
    </section>
    <PrimaryButton onClick={save} disabled={saving}>{workout.completion ? 'Save Reflection' : 'Save & Complete Workout'}</PrimaryButton>
  </CardStack>;
}



function buildWeeklyMetrics(workouts: ResolvedWorkout[]) {
  const planned = workouts.filter((workout) => !workout.isRemoved);
  const completed = planned.filter((workout) => workout.completion);
  const plannedDistanceKm = planned.reduce((sum, workout) => sum + (workout.plannedDistanceKm ?? 0), 0);
  const actualDistanceKm = completed.reduce((sum, workout) => sum + (completionDistance(workout.completion) ?? 0), 0);
  const actualDurationMinutes = completed.reduce((sum, workout) => sum + (completionDuration(workout.completion) ?? 0), 0);
  return { plannedWorkouts: planned.length, completedWorkouts: completed.length, plannedDistanceKm: Math.round(plannedDistanceKm * 10) / 10 || undefined, actualDistanceKm: Math.round(actualDistanceKm * 10) / 10 || undefined, actualDurationMinutes: Math.round(actualDurationMinutes) || undefined };
}
function keyWorkout(workouts: ResolvedWorkout[]) { return workouts.find((w) => w.type === 'race') ?? workouts.find((w) => w.type === 'quality_session') ?? workouts.find((w) => w.type === 'long_run'); }
function WeeklyReviewPanel(props: { week: GeneratedTrainingWeek; workouts: ResolvedWorkout[]; nextWeek?: GeneratedTrainingWeek; archivedRecord?: WeeklyCompletionRecord; reflection: string; setReflection: (value: string) => void; done: boolean; confirm: boolean; onAskConfirm: () => void; onArchive: () => void; onReviewAgain: () => void; onPlanNext: () => void }) {
  const { week, workouts, nextWeek, archivedRecord } = props;
  const archived = Boolean(archivedRecord);
  const metrics = archivedRecord?.metrics ?? buildWeeklyMetrics(workouts);
  const completed = workouts.filter((workout) => !workout.isRemoved && workout.completion);
  const longest = completed.filter((workout) => completionDistance(workout.completion)).sort((a, b) => (completionDistance(b.completion) ?? 0) - (completionDistance(a.completion) ?? 0))[0];
  const key = keyWorkout(workouts.filter((workout) => !workout.isRemoved));
  const longRun = workouts.find((workout) => workout.type === 'long_run');
  const story = workouts.filter((workout) => !workout.isRemoved).sort((a, b) => (a.assignedDay ?? '').localeCompare(b.assignedDay ?? ''));
  if (props.done) return <CardStack><section style={completedBlockStyle}><h3 style={{ ...typography.h2, margin: 0 }}>Nice work.</h3><p style={{ ...typography.body, margin: `${spacing.xs}px 0 0` }}>You completed {metrics.completedWorkouts} of {metrics.plannedWorkouts} planned sessions this week.</p><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>Consistency beats perfection. Your next training week is ready when you are.</p></section><PrimaryButton onClick={props.onPlanNext}>Plan Next Week</PrimaryButton><SecondaryButton onClick={props.onReviewAgain}>Review Completed Week</SecondaryButton></CardStack>;
  return <CardStack>
    <section style={reviewHeaderStyle} aria-labelledby="week-review-title"><div><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>Week {week.weekNumber} · {formatPhase(week.phase)}</p><h3 id="week-review-title" style={{ ...typography.h3, margin: `${spacing.xxs}px 0 0` }}>{formatDate(week.startsOn)}–{formatDate(week.endsOn)}</h3></div><Chip tone={archived ? 'green' : 'sky'}>{archived ? 'Archived' : `${metrics.completedWorkouts} of ${metrics.plannedWorkouts} completed`}</Chip></section>
    <section style={summaryStripStyle} aria-labelledby="weekly-summary-title"><h4 id="weekly-summary-title" style={{ ...typography.h3, margin: 0, gridColumn: '1 / -1' }}>Weekly Completion Summary</h4><Stat label="Sessions" value={`${metrics.completedWorkouts} of ${metrics.plannedWorkouts}`} compact /><Stat label="Completion" value={`${metrics.plannedWorkouts ? Math.round((metrics.completedWorkouts / metrics.plannedWorkouts) * 100) : 0}%`} compact />{metrics.actualDistanceKm ? <Stat label="Actual Distance" value={`${metrics.actualDistanceKm} km`} compact /> : null}{metrics.plannedDistanceKm ? <Stat label="Planned Distance" value={`${metrics.plannedDistanceKm} km`} compact /> : null}{metrics.actualDurationMinutes ? <Stat label="Actual Duration" value={`${metrics.actualDurationMinutes} min`} compact /> : null}<Stat label="Longest Run" value={longest ? `${completionDistance(longest.completion)} km` : 'Not recorded'} compact /><Stat label="Key Session" value={key?.completion ? 'Completed' : key ? 'Not completed' : 'Not planned'} compact /></section>
    <section style={plannedContextStyle}><h4 style={{ ...typography.h3, margin: 0 }}>Planned versus Completed</h4><div style={comparisonGridStyle}><Stat label="Distance · Planned" value={metrics.plannedDistanceKm ? `${metrics.plannedDistanceKm} km` : 'Not planned'} compact /><Stat label="Distance · Completed" value={metrics.actualDistanceKm ? `${metrics.actualDistanceKm} km` : 'Not recorded'} compact /><Stat label="Sessions · Planned" value={`${metrics.plannedWorkouts}`} compact /><Stat label="Sessions · Completed" value={`${metrics.completedWorkouts}`} compact /></div></section>
    <section style={coachBlockStyle}><h4 style={{ ...typography.h3, margin: 0 }}>Coach Summary</h4>{coachSummaryLines(week, workouts, nextWeek).map((line) => <p key={line} style={{ ...typography.body, margin: `${spacing.xs}px 0 0` }}>{line}</p>)}</section>
    <section style={{ display: 'grid', gap: spacing.xs }} aria-labelledby="week-story-title"><h4 id="week-story-title" style={{ ...typography.h3, margin: 0 }}>This Week’s Story</h4>{story.map((workout) => <StoryItem key={workout.id} workout={workout} />)}</section>
    <section style={{ display: 'grid', gap: spacing.xs }}><label htmlFor="weekly-reflection" style={{ ...typography.h3, margin: 0 }}>Weekly Reflection</label><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Looking back on the week... What would you like to remember about this week?</p>{archived ? <p style={{ ...typography.body, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>{archivedRecord?.weeklyReflection || 'No weekly reflection recorded.'}</p> : <><textarea id="weekly-reflection" maxLength={1500} value={props.reflection} onChange={(event) => props.setReflection(event.target.value)} placeholder="Work was stressful early in the week, but the Sunday long run restored my confidence." style={journalTextAreaStyle} /><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{props.reflection.length}/1500</p></>}</section>
    {!archived && (props.confirm ? <section style={contextStyle}><h4 style={{ ...typography.h3, margin: 0 }}>Finish this week?</h4><p style={{ ...typography.small, margin: 0 }}>Your schedule and workout records will become part of your training history. The weekly record will remain available to review.</p><PrimaryButton onClick={props.onArchive}>Finish & Archive Week</PrimaryButton></section> : <PrimaryButton onClick={props.onAskConfirm}>Finish & Archive Week</PrimaryButton>)}
    {archived ? <PrimaryButton onClick={props.onPlanNext}>Plan Next Week</PrimaryButton> : null}
  </CardStack>;
}
function coachSummaryLines(week: GeneratedTrainingWeek, workouts: ResolvedWorkout[], nextWeek?: GeneratedTrainingWeek) { const planned = workouts.filter((w) => !w.isRemoved); const completed = planned.filter((w) => w.completion); const key = keyWorkout(planned); const longRun = planned.find((w) => w.type === 'long_run'); return [`You completed ${completed.length} of ${planned.length} planned sessions this week.`, key?.completion && longRun?.completion ? 'Your key session and long run were both completed.' : key?.completion ? 'Your key session was completed.' : longRun?.completion ? 'Your long run was completed.' : '', week.weekType === 'recovery' ? 'This was a recovery week, so reduced volume was intentional.' : week.phase === 'taper' ? 'This week reduced fatigue while maintaining rhythm.' : key?.type === 'race' ? `${key.title.replace(/^🏁\s*/, '')} was the primary session this week.` : '', nextWeek ? `Next week ${nextWeek.phase === week.phase ? 'continues' : 'moves into'} the ${formatPhase(nextWeek.phase).toLowerCase()} phase.` : 'No next training week is currently available in this plan.'].filter(Boolean); }
function StoryItem({ workout }: { workout: ResolvedWorkout }) { const log = workout.completion; const status = log ? ['Completed', feelingLabel(log.perceivedEffort)].filter(Boolean).join(' · ') : 'Not completed'; return <article style={storyItemStyle} aria-label={`${workout.title}, ${status}`}><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{workout.assignedDay ? new Intl.DateTimeFormat('en', { weekday: 'long' }).format(parseIsoDate(workout.assignedDay)) : 'Unscheduled'}</p><h5 style={{ ...typography.h3, margin: `${spacing.xxs}px 0 0` }}>{workout.title}</h5><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xxs}px 0 0` }}>{roleLabel(workout).replace(/[🏁⭐🟣🟢💙⚪]/g, '').trim()} · {status}{completionDistance(log) ? ` · ${completionDistance(log)} km` : ''}{completionDuration(log) ? ` · ${completionDuration(log)} min` : ''}</p>{workout.moved && workout.suggestedDate && workout.assignedDay ? <p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xxs}px 0 0` }}>Moved from {new Intl.DateTimeFormat('en', { weekday: 'long' }).format(parseIsoDate(workout.suggestedDate))} to {new Intl.DateTimeFormat('en', { weekday: 'long' }).format(parseIsoDate(workout.assignedDay))}.</p> : null}{log?.journalNote || log?.notes ? <p style={{ ...typography.body, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: `${spacing.xs}px 0 0` }}>“{log.journalNote ?? log.notes}”</p> : null}</article>; }

const detailHeroStyle = { border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.sm, background: colors.neutral.surface } as const;
const summaryStripStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: spacing.xs, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.sm, background: colors.neutral.faint } as const;
const detailLabelStyle = { ...typography.caption, color: colors.neutral.muted, margin: 0 } as const;
const detailValueStyle = { ...typography.small, color: colors.neutral.text, margin: `${spacing.xxs}px 0 0`, overflowWrap: 'anywhere' } as const;
const coachBlockStyle = { borderLeft: `3px solid ${colors.primary.green}`, padding: `${spacing.xs}px 0 ${spacing.xs}px ${spacing.sm}`, background: colors.neutral.surface } as const;
const prescriptionPartStyle = { border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.sm } as const;
const contextStyle = { display: 'grid', gap: spacing.xs, border: `1px solid ${colors.accent.sky}`, borderRadius: radius.card, padding: spacing.sm, background: colors.accent.skyTint } as const;
const plannedContextStyle = { border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.sm, background: colors.neutral.surface } as const;
const completedBlockStyle = { display: 'grid', gap: spacing.sm, border: `1px solid ${colors.primary.green}`, borderRadius: radius.card, padding: spacing.sm, background: colors.primary.greenTint } as const;
const feelingGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: spacing.xs } as const;
const feelingButtonStyle = { ...typography.small, display: 'grid', gap: 2, alignContent: 'center', minHeight: 52, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.button, padding: spacing.xs, background: colors.neutral.surface, color: colors.neutral.text, cursor: 'pointer' } as const;
const reviewHeaderStyle = { display: 'flex', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'center', border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.sm, background: colors.neutral.surface } as const;
const comparisonGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginTop: spacing.sm } as const;
const storyItemStyle = { borderLeft: `3px solid ${colors.neutral.border}`, padding: `${spacing.xs}px 0 ${spacing.xs}px ${spacing.sm}`, background: colors.neutral.surface } as const;
const journalTextAreaStyle = { ...typography.body, width: '100%', minHeight: 112, maxHeight: 220, boxSizing: 'border-box' as const, resize: 'vertical' as const, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.input, padding: spacing.md, color: colors.neutral.text, background: colors.neutral.surface, overflowWrap: 'anywhere' as const } as const;
