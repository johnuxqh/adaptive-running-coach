import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, InfoBanner, PageStack, PrimaryButton, SectionCard, SlidePanel, StatCard } from '../components/ui';
import { colors, radius, spacing, typography } from '../design';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, RaceType, TrainingPhase, WeekType } from '../engine/planTypes';
import { readStorageValue, storageKeys } from '../utils/storage';

const raceLabels: Record<RaceType, string> = { '5k': '5 km', '10k': '10 km', '15k': '15 km', half_marathon: 'Half Marathon', marathon: 'Marathon' };
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function PlanReviewPage() {
  const navigate = useNavigate();
  const [selectedWeek, setSelectedWeek] = useState<GeneratedTrainingWeek | null>(null);
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  if (!plan) return <PageStack><SectionCard><HeroTitle eyebrow="Plan review" title="No plan yet">Complete onboarding and I&apos;ll build your personalised plan.</HeroTitle><PrimaryButton onClick={() => navigate('/onboarding')}>Start Onboarding</PrimaryButton></SectionCard></PageStack>;
  const summary = plan.summary;
  return <PageStack>
    <SectionCard><HeroTitle eyebrow="Full plan review" title={raceLabels[summary.raceDistance]}>{summary.athleteName} • {summary.daysUntilRace} days • {summary.trainingWeeks} weeks</HeroTitle><PrimaryButton onClick={() => navigate('/week')}>Back to Week Planner</PrimaryButton></SectionCard>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.md }}><StatCard label="Foundation" value={String(summary.totalFoundationWorkouts)} /><StatCard label="Optional" value={String(summary.totalOptionalWorkouts)} /><StatCard label="Distance" value={`${summary.estimatedDistanceRangeKm.min}–${summary.estimatedDistanceRangeKm.max} km`} /><StatCard label="Time" value={`${formatMinutes(summary.estimatedTimeRangeMin.min)}–${formatMinutes(summary.estimatedTimeRangeMin.max)}`} /></div>
    <InfoBanner>{summary.planEmphasis.slice(0, 2).join(' · ')}</InfoBanner>
    <CardStack>{plan.weeks.map((week) => <WeekReviewCard key={week.id} week={week} onOpen={() => setSelectedWeek(week)} />)}</CardStack>
    <SlidePanel isOpen={Boolean(selectedWeek)} title={selectedWeek ? `Week ${selectedWeek.weekNumber}` : 'Week details'} subtitle={selectedWeek ? `${formatPhase(selectedWeek.phase)} • ${formatWeekType(selectedWeek.weekType)} • ${formatDate(selectedWeek.startsOn)} – ${formatDate(selectedWeek.endsOn)}` : undefined} onClose={() => setSelectedWeek(null)}>{selectedWeek ? <WeekDetail week={selectedWeek} /> : null}</SlidePanel>
  </PageStack>;
}

function WeekReviewCard({ week, onOpen }: { week: GeneratedTrainingWeek; onOpen: () => void }) {
  const longRun = findLongRun(week);
  const quality = findQuality(week);
  return <button type="button" onClick={onOpen} style={{ border: 0, padding: 0, background: 'transparent', textAlign: 'left', width: '100%' }}><SectionCard><CardStack>
    <div style={{ display: 'grid', gap: spacing.sm }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: spacing.xs }}><Chip tone={weekTone(week.weekType)}>Week {week.weekNumber}</Chip><h3 style={{ ...typography.h3, margin: 0 }}>{formatPhase(week.phase)}</h3><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{formatDate(week.startsOn)} – {formatDate(week.endsOn)}</p></div>
        <Chip tone={weekTone(week.weekType)}>{formatWeekType(week.weekType)}</Chip>
      </div>
      <div style={metricStripStyle}><Metric label="Target" value={`${week.targetDistanceRangeKm.min}–${week.targetDistanceRangeKm.max} km`} /><Metric label="Time" value={`${week.targetDurationRangeMin.min}–${week.targetDurationRangeMin.max} min`} /></div>
    </div>
    <div style={highlightGridStyle}>
      <Highlight label="Long run" value={longRun ? workoutMeasure(longRun) : 'None'} />
      <Highlight label="Quality" value={quality?.title ?? 'None'} />
      <Highlight label="Foundation" value={`${week.foundationWorkouts.length} workouts`} />
      <Highlight label="Optional" value={`${week.optionalWorkouts.length} workouts`} />
    </div>
    <SampleWeek workouts={[...week.foundationWorkouts, ...week.optionalWorkouts]} />
  </CardStack></SectionCard></button>;
}

function WeekDetail({ week }: { week: GeneratedTrainingWeek }) {
  const longRun = findLongRun(week);
  const quality = findQuality(week);
  return <CardStack>
    <PanelSection title="Week at a glance"><div style={highlightGridStyle}><Highlight label="Target" value={`${week.targetDistanceRangeKm.min}–${week.targetDistanceRangeKm.max} km`} /><Highlight label="Time" value={`${formatMinutes(week.targetDurationRangeMin.min)}–${formatMinutes(week.targetDurationRangeMin.max)}`} /><Highlight label="Foundation" value={`${week.foundationWorkouts.length} workouts`} /><Highlight label="Optional" value={`${week.optionalWorkouts.length} workouts`} /></div></PanelSection>
    <PanelSection title="Focus this week"><p style={{ ...typography.small, color: colors.neutral.text, margin: 0 }}>{week.coachingMessage}</p></PanelSection>
    <PanelSection title="Suggested week"><SampleWeek workouts={[...week.foundationWorkouts, ...week.optionalWorkouts]} compact /></PanelSection>
    <WorkoutPanelSection title="Foundation workouts" workouts={week.foundationWorkouts} />
    <WorkoutPanelSection title="Optional workouts" workouts={week.optionalWorkouts} />
    <WorkoutPanelSection title="Long run" workouts={longRun ? [longRun] : []} />
    <WorkoutPanelSection title="Quality session" workouts={quality ? [quality] : []} />
    <PanelSection title="Warnings">{week.warnings.length ? <div style={{ display: 'grid', gap: spacing.xs }}>{week.warnings.map((warning) => <Chip key={warning} tone="orange">{warning}</Chip>)}</div> : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>No warnings this week.</p>}</PanelSection>
  </CardStack>;
}

function SampleWeek({ workouts, compact = false }: { workouts: GeneratedWorkout[]; compact?: boolean }) { return <div style={{ display: 'grid', gap: compact ? spacing.xs : spacing.sm }}>{weekDays.map((day) => { const workout = workoutForDay(workouts, day); return <div key={day} style={sampleRowStyle}><span style={{ ...typography.caption, color: colors.neutral.muted, minWidth: 38 }}>{day}</span><span style={{ ...typography.small, color: workout ? colors.neutral.text : colors.neutral.muted, fontWeight: workout ? 700 : 400 }}>{workout?.title ?? 'Open'}</span></div>; })}</div>; }
function PanelSection({ title, children }: { title: string; children: ReactNode }) { return <section style={panelSectionStyle}><h3 style={{ ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' }}>{title}</h3>{children}</section>; }
function WorkoutPanelSection({ title, workouts }: { title: string; workouts: GeneratedWorkout[] }) { return <PanelSection title={title}>{workouts.length ? <div style={{ display: 'grid', gap: spacing.sm }}>{workouts.map((workout) => <div key={workout.id} style={workoutPillStyle}><strong>{workout.title}</strong><span>{workoutMeasure(workout)} • {workout.intensity}</span></div>)}</div> : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>None</p>}</PanelSection>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{label}</p><p style={{ ...typography.h3, color: colors.neutral.text, margin: 0 }}>{value}</p></div>; }
function Highlight({ label, value }: { label: string; value: string }) { return <div style={highlightStyle}><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{label}</p><p style={{ ...typography.small, color: colors.neutral.text, margin: `${spacing.xs}px 0 0`, fontWeight: 700 }}>{value}</p></div>; }
function findLongRun(week: GeneratedTrainingWeek) { return week.foundationWorkouts.find((workout) => workout.type === 'long_run'); }
function findQuality(week: GeneratedTrainingWeek) { return week.foundationWorkouts.find((workout) => workout.type === 'quality_session' || workout.type === 'race'); }
function workoutForDay(workouts: GeneratedWorkout[], day: string) { return workouts.find((workout) => workout.suggestedDay.startsWith(day) || workout.suggestedDay.includes(day)); }
function workoutMeasure(workout: GeneratedWorkout) { return workout.plannedDistanceKm ? `${workout.plannedDistanceKm} km / ${workout.plannedDurationMin ? formatMinutes(workout.plannedDurationMin) : formatMinutes(Math.round(workout.plannedDistanceKm * 6.5))}` : `${workout.plannedDurationMin ?? 0} min`; }
function formatMinutes(minutes: number) { const hours = Math.floor(minutes / 60); const mins = minutes % 60; return hours ? `${hours}h ${mins}m` : `${mins}m`; }
function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`)); }
function formatPhase(phase: TrainingPhase) { return phase.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatWeekType(type: WeekType) { return `${type[0].toUpperCase()}${type.slice(1)}`; }
function weekTone(type: WeekType): 'neutral' | 'green' | 'sky' | 'purple' | 'orange' { return type === 'recovery' ? 'sky' : type === 'peak' ? 'orange' : type === 'race' ? 'purple' : 'green'; }

const metricStripStyle = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm, padding: spacing.md, background: colors.neutral.faint, borderRadius: radius.card };
const highlightGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm };
const highlightStyle = { border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.sm, background: colors.neutral.surface };
const sampleRowStyle = { display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr)', gap: spacing.sm, alignItems: 'center', padding: spacing.sm, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.input, background: colors.neutral.surface };
const panelSectionStyle = { display: 'grid', gap: spacing.sm, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.md, background: colors.neutral.surface };
const workoutPillStyle = { display: 'grid', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.input, background: colors.neutral.faint, ...typography.small, color: colors.neutral.text };
