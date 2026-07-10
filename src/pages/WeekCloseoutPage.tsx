import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, InfoBanner, PageStack, PrimaryButton, SectionCard, StatCard } from '../components/ui';
import { colors, radius, spacing, typography } from '../design';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout } from '../engine/planTypes';
import { buildCoachReportPayload, savePendingSync, sendCoachReport } from '../utils/googleSheetsSync';
import { defaultSettings, readStorageValue, storageKeys, writeStorageValue, type LifeFitSettings } from '../utils/storage';
import type { PlannerState, WeekSummary } from '../utils/exportUtils';
import type { WorkoutLog } from '../engine/types';

type Log = { workoutId: string; distanceKm?: number; actualDistanceKm?: number; durationMinutes?: number; actualDurationMinutes?: number };
const emptyPlanner: PlannerState = { assignments: {}, extraWorkouts: [] };

export function WeekCloseoutPage() {
  const navigate = useNavigate();
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  const currentWeek = readStorageValue<GeneratedTrainingWeek | null>(storageKeys.currentWeek, null) ?? plan?.weeks[0] ?? null;
  const planner = readStorageValue<PlannerState>(storageKeys.weeklyPlanner, emptyPlanner);
  const logs = readStorageValue<Log[]>(storageKeys.workoutLogs, []);
  const [weeklyNote, setWeeklyNote] = useState('');
  const [missedReason, setMissedReason] = useState('');
  const [complete, setComplete] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const data = useMemo(() => currentWeek && plan ? buildCloseout(plan, currentWeek, planner, logs) : null, [plan, currentWeek, planner, logs]);
  if (!plan || !currentWeek || !data) return <PageStack><HeroTitle eyebrow="Week closeout" title="No active week">Create a plan first, then come back to close out your week.</HeroTitle><PrimaryButton onClick={() => navigate('/onboarding')}>Create Plan</PrimaryButton></PageStack>;

  async function closeWeek() {
    if (!plan || !currentWeek || !data) return;
    const summary: WeekSummary = { id: `week-${currentWeek.weekNumber}-${Date.now()}`, athleteName: data.athleteName, weekNumber: currentWeek.weekNumber, phase: currentWeek.phase, weekType: currentWeek.weekType, weekStart: currentWeek.startsOn, weekEnd: currentWeek.endsOn, foundationPlanned: currentWeek.foundationWorkouts.length, foundationCompleted: data.foundationCompleted, optionalPlanned: currentWeek.optionalWorkouts.length, optionalCompleted: data.optionalCompleted, extraCompleted: data.extraCompleted, targetKmMin: currentWeek.targetDistanceRangeKm.min, targetKmMax: currentWeek.targetDistanceRangeKm.max, actualKm: data.actualKm, targetMinutesMin: currentWeek.targetDurationRangeMin.min, targetMinutesMax: currentWeek.targetDurationRangeMin.max, actualMinutes: data.actualMinutes, completedWorkoutIds: data.completed.map((w) => w.id), missedFoundationWorkoutIds: data.missedFoundation.map((w) => w.id), missedOptionalWorkoutIds: data.missedOptional.map((w) => w.id), weeklyNote: weeklyNote.trim(), missedReason: missedReason.trim(), closedAt: new Date().toISOString() };
    const summaries = readStorageValue<WeekSummary[]>(storageKeys.weekSummaries, []);
    writeStorageValue(storageKeys.weekSummaries, [...summaries.filter((item) => item.weekNumber !== currentWeek.weekNumber), summary]);
    const nextWeek = plan.weeks.find((week) => week.weekNumber === currentWeek.weekNumber + 1);
    if (nextWeek && currentWeek.phase !== 'race_week' && currentWeek.weekType !== 'race') writeStorageValue(storageKeys.currentWeek, nextWeek);
    const message = await syncCoachReport(plan, currentWeek, planner, logs as WorkoutLog[], summary);
    setSyncMessage(message);
    if (!nextWeek || currentWeek.phase === 'race_week' || currentWeek.weekType === 'race') { setComplete(true); return; }
    window.alert(message);
    navigate('/today', { replace: true });
  }

  if (complete) return <PageStack><HeroTitle eyebrow="Plan complete" title="Plan complete. Trust the work.">Every completed run counts. Take the learning with you.</HeroTitle><InfoBanner>{syncMessage || 'Consistency beats perfection.'}</InfoBanner><PrimaryButton onClick={() => navigate('/today')}>Back to Today</PrimaryButton></PageStack>;

  return <PageStack>
    <HeroTitle eyebrow="Week closeout" title={`Week ${currentWeek.weekNumber} with ${data.athleteName}`}>{currentWeek.coachingMessage}</HeroTitle>
    <InfoBanner>Consistency beats perfection. Every completed run counts. Let&apos;s take the learning into next week.</InfoBanner>
    <SectionCard><CardStack><Chip tone="green">{formatPhase(currentWeek.phase)} • {currentWeek.weekType}</Chip><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{formatDate(currentWeek.startsOn)} – {formatDate(currentWeek.endsOn)}</p></CardStack></SectionCard>
    <div style={{ display: 'grid', gap: spacing.md, gridTemplateColumns: '1fr 1fr' }}><StatCard label="Foundation" value={`${data.foundationCompleted} / ${currentWeek.foundationWorkouts.length}`} /><StatCard label="Optional" value={`${data.optionalCompleted} / ${currentWeek.optionalWorkouts.length}`} /></div>
    {data.extraCompleted ? <StatCard label="Extra completed" value={`${data.extraCompleted}`} /> : null}
    <div style={{ display: 'grid', gap: spacing.md, gridTemplateColumns: '1fr 1fr' }}><StatCard label="Target km" value={`${currentWeek.targetDistanceRangeKm.min}-${currentWeek.targetDistanceRangeKm.max}`} detail={`${data.actualKm} km completed`} /><StatCard label="Target time" value={`${currentWeek.targetDurationRangeMin.min}-${currentWeek.targetDurationRangeMin.max} min`} detail={`${data.actualMinutes} min completed`} /></div>
    <WorkoutList title="Completed workouts" workouts={data.completed} empty="Completed runs will appear here." />
    <WorkoutList title="Uncompleted foundation workouts" workouts={data.missedFoundation} empty="Foundation is complete this week." />
    <WorkoutList title="Uncompleted optional workouts" workouts={data.missedOptional} empty="No optional workouts waiting." />
    <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Weekly note</h3><ControlledTextArea value={weeklyNote} onChange={setWeeklyNote} placeholder="Anything worth remembering from this week?" />{data.missedFoundation.length ? <><h3 style={{ ...typography.h3, margin: 0 }}>Missed workout note</h3><ControlledTextArea value={missedReason} onChange={setMissedReason} placeholder="Life happens. Anything that got in the way this week?" /></> : null}<PrimaryButton onClick={closeWeek}>Close Week</PrimaryButton></CardStack></SectionCard>
  </PageStack>;
}

function buildCloseout(plan: GeneratedTrainingPlan, week: GeneratedTrainingWeek, planner: PlannerState, logs: Log[]) {
  const extras = planner.extraWorkouts.filter((workout) => workout.weekNumber === week.weekNumber);
  const workouts = [...week.foundationWorkouts, ...week.optionalWorkouts, ...extras];
  const logMap = new Map(logs.map((log) => [log.workoutId, log]));
  const completed = workouts.filter((workout) => workout.status === 'completed' || logMap.has(workout.id));
  const actualKm = completed.reduce((sum, workout) => sum + (logMap.get(workout.id)?.actualDistanceKm ?? logMap.get(workout.id)?.distanceKm ?? workout.plannedDistanceKm ?? 0), 0);
  const actualMinutes = completed.reduce((sum, workout) => sum + (logMap.get(workout.id)?.actualDurationMinutes ?? logMap.get(workout.id)?.durationMinutes ?? workout.plannedDurationMin ?? 0), 0);
  return { athleteName: plan.summary.athleteName, completed, foundationCompleted: week.foundationWorkouts.filter((w) => completed.some((item) => item.id === w.id)).length, optionalCompleted: week.optionalWorkouts.filter((w) => completed.some((item) => item.id === w.id)).length, extraCompleted: extras.filter((w) => completed.some((item) => item.id === w.id)).length, missedFoundation: week.foundationWorkouts.filter((w) => !completed.some((item) => item.id === w.id)), missedOptional: week.optionalWorkouts.filter((w) => !completed.some((item) => item.id === w.id)), actualKm: round(actualKm), actualMinutes: Math.round(actualMinutes) };
}
function WorkoutList({ title, workouts, empty }: { title: string; workouts: GeneratedWorkout[]; empty: string }) { return <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>{title}</h3>{workouts.length ? workouts.map((workout) => <p key={workout.id} style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{workout.title}</p>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{empty}</p>}</CardStack></SectionCard>; }
function ControlledTextArea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <textarea value={value} onChange={(event) => onChange(event.currentTarget.value)} placeholder={placeholder} style={{ ...typography.body, width: '100%', minHeight: 120, boxSizing: 'border-box', resize: 'vertical', border: `1px solid ${colors.neutral.border}`, borderRadius: radius.input, padding: spacing.md, color: colors.neutral.text, background: colors.neutral.surface }} />; }
function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00.000Z`)); }
function formatPhase(phase: string) { return phase.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function round(value: number) { return Math.round(value * 10) / 10; }

async function syncCoachReport(plan: GeneratedTrainingPlan, week: GeneratedTrainingWeek, planner: PlannerState, logs: WorkoutLog[], summary: WeekSummary) {
  const settings = readStorageValue<LifeFitSettings>(storageKeys.settings, defaultSettings);
  const webhookUrl = settings.googleSheetsWebhookUrl?.trim();
  if (!webhookUrl) return 'Week saved on this device.';
  const payload = buildCoachReportPayload(plan, week, planner, logs, summary);
  try {
    await sendCoachReport(webhookUrl, payload);
    return 'Coach report sent.';
  } catch {
    savePendingSync(webhookUrl, payload);
    return 'Week saved. Coach report could not be sent, but nothing was lost.';
  }
}
