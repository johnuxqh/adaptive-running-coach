import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, InfoBanner, PageStack, PrimaryButton, SectionCard, SlidePanel, StatCard } from '../components/ui';
import { colors, radius, spacing, typography } from '../design';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, GeneratedWorkout, RaceType, TrainingPhase, WeekType } from '../engine/planTypes';
import { readStorageValue, storageKeys } from '../utils/storage';
import { appendCompactDurationLabel, buildHistoricalWeekSummary, completionDistance, completionDuration, buildSuggestedPlanner, normalizeWeeklyCompletionRecords, resolveWeek, type CompletionLog, type PlannerState, type ResolvedWorkout, type WeeklyCompletionRecord } from '../utils/planning';

const raceLabels: Record<RaceType, string> = { '5k': '5 km', '10k': '10 km', '15k': '15 km', half_marathon: 'Half Marathon', marathon: 'Marathon' };
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function PlanReviewPage() {
  const navigate = useNavigate();
  const [selectedWeek, setSelectedWeek] = useState<GeneratedTrainingWeek | null>(null);
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  const planner = plan ? buildSuggestedPlanner(plan, readStorageValue<PlannerState>(storageKeys.weeklyPlanner, { assignments: {}, extraWorkouts: [] })) : { assignments: {}, extraWorkouts: [] };
  const logs = readStorageValue<CompletionLog[]>(storageKeys.workoutLogs, []);
  const weekRecords = normalizeWeeklyCompletionRecords(readStorageValue<WeeklyCompletionRecord[]>(storageKeys.weekSummaries, []));
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!plan) return <PageStack><SectionCard><HeroTitle eyebrow="Plan review" title="No plan yet">Complete onboarding and I&apos;ll build your personalised plan.</HeroTitle><PrimaryButton onClick={() => navigate('/onboarding')}>Start Onboarding</PrimaryButton></SectionCard></PageStack>;
  const summary = plan.summary;
  return <PageStack>
    <SectionCard><HeroTitle eyebrow="Full plan review" title={raceLabels[summary.raceDistance]}>{summary.athleteName} • {summary.daysUntilRace} days • {summary.trainingWeeks} weeks</HeroTitle><PrimaryButton onClick={() => navigate('/week')}>Back to Week Planner</PrimaryButton></SectionCard>
    <div style={planStatsStyle}><StatCard label="Foundation" value={String(summary.totalFoundationWorkouts)} /><StatCard label="Optional" value={String(summary.totalOptionalWorkouts)} /><StatCard label="Distance" value={`${summary.estimatedDistanceRangeKm.min}–${summary.estimatedDistanceRangeKm.max} km`} /><StatCard label="Time" value={`${formatMinutes(summary.estimatedTimeRangeMin.min)}–${formatMinutes(summary.estimatedTimeRangeMin.max)}`} /></div>
    <InfoBanner>{summary.planEmphasis.slice(0, 2).join(' · ')}</InfoBanner>
    {summary.planWarnings.length ? <InfoBanner>{summary.planWarnings.slice(0, 2).join(' · ')}</InfoBanner> : null}
    <CardStack>{plan.weeks.map((week) => <WeekReviewCard key={week.id} week={week} planner={planner} logs={logs} todayIso={todayIso} archivedRecord={archivedRecordFor(week, weekRecords)} onOpen={() => setSelectedWeek(week)} onOpenPlanner={() => navigate(`/week?week=${week.weekNumber}`)} />)}</CardStack>
    <SlidePanel isOpen={Boolean(selectedWeek)} title={selectedWeek ? `Week ${selectedWeek.weekNumber}` : 'Week details'} subtitle={selectedWeek ? `${formatPhase(selectedWeek.phase)} • ${formatWeekType(selectedWeek.weekType)} • ${formatDate(selectedWeek.startsOn)} – ${formatDate(selectedWeek.endsOn)}` : undefined} onClose={() => setSelectedWeek(null)}>{selectedWeek ? <WeekDetail week={selectedWeek} planner={planner} logs={logs} todayIso={todayIso} archivedRecord={archivedRecordFor(selectedWeek, weekRecords)} nextWeek={plan.weeks.find((week) => week.weekNumber === selectedWeek.weekNumber + 1)} onOpenPlanner={() => navigate(`/week?week=${selectedWeek.weekNumber}`)} /> : null}</SlidePanel>
  </PageStack>;
}

function WeekReviewCard({ week, planner, logs, todayIso, archivedRecord, onOpen, onOpenPlanner }: { week: GeneratedTrainingWeek; planner: PlannerState; logs: CompletionLog[]; todayIso: string; archivedRecord?: WeeklyCompletionRecord; onOpen: () => void; onOpenPlanner: () => void }) {
  const workouts = resolveWeek(week, planner, logs).workouts;
  const archived = Boolean(archivedRecord);
  const historical = buildHistoricalWeekSummary(week, workouts, archivedRecord);
  const keySession = keySessionLabel(workouts, week);
  return <div style={compactCardStyle}>
    <button type="button" onClick={onOpen} style={cardButtonStyle}>
      <div style={cardHeaderStyle}><div style={wrapHeaderStyle}><Chip tone={weekTone(week.weekType)}>Week {week.weekNumber}</Chip><Chip tone={archived ? 'neutral' : weekTone(week.weekType)}>{weekStatus(week, todayIso, archived)}</Chip></div><span style={phaseTextStyle}>{formatPhase(week.phase)} • {formatDate(week.startsOn)} – {formatDate(week.endsOn)}</span></div>
      {archived ? <ArchivedCardSummary historical={historical} archivedRecord={archivedRecord} /> : <><p style={focusStyle}>{coachFocus(week, workouts)}</p>
        {week.warnings[0] ? <p style={warningLineStyle}>Supporting note: {calmWarning(week.warnings[0])}</p> : null}
        <div style={summaryLineStyle}><span><strong>{week.targetDistanceRangeKm.min}–{week.targetDistanceRangeKm.max} km</strong></span><span>{formatMinutes(week.targetDurationRangeMin.min)}–{formatMinutes(week.targetDurationRangeMin.max)}</span></div>
        <KeySession label={keySession} /><CompactSchedule workouts={workouts} week={week} /></>}
    </button>
    <PrimaryButton aria-label={archived ? `Review Week ${week.weekNumber}` : `Open Weekly Planner for Week ${week.weekNumber}`} onClick={archived ? onOpen : onOpenPlanner}>{archived ? 'Review Week' : 'Open Weekly Planner'}</PrimaryButton>
  </div>;
}

function WeekDetail({ week, planner, logs, todayIso, archivedRecord, nextWeek, onOpenPlanner }: { week: GeneratedTrainingWeek; planner: PlannerState; logs: CompletionLog[]; todayIso: string; archivedRecord?: WeeklyCompletionRecord; nextWeek?: GeneratedTrainingWeek; onOpenPlanner: () => void }) {
  const resolved = resolveWeek(week, planner, logs);
  const workouts = resolved.workouts;
  const archived = Boolean(archivedRecord);
  if (archived) return <ArchivedWeekDetail week={week} workouts={workouts} archivedRecord={archivedRecord} nextWeek={nextWeek} />;
  return <CardStack>
    <PanelSection title="Coach focus"><p style={panelCopyStyle}>{coachFocus(week, workouts)}</p>{week.warnings.length ? <p style={warningLineStyle}>Supporting note: {calmWarning(week.warnings[0])}</p> : null}</PanelSection>
    <PanelSection title="Week summary"><div style={summaryGridStyle}><SummaryItem label="Target distance" value={`${week.targetDistanceRangeKm.min}–${week.targetDistanceRangeKm.max} km`} /><SummaryItem label="Estimated time" value={`${formatMinutes(week.targetDurationRangeMin.min)}–${formatMinutes(week.targetDurationRangeMin.max)}`} /><SummaryItem label="Key session" value={keySessionLabel(workouts, week)} /><SummaryItem label="Recovery status" value={formatWeekType(week.weekType)} /></div></PanelSection>
    <PanelSection title="Week schedule"><CompactSchedule workouts={workouts} week={week} /></PanelSection>
    <PanelSection title="Available workouts"><p style={panelCopyStyle}>{workouts.filter((workout) => workout.status === 'unplanned').length} workout{workouts.filter((workout) => workout.status === 'unplanned').length === 1 ? '' : 's'} not currently assigned.</p></PanelSection>
    <PrimaryButton onClick={onOpenPlanner}>{archived ? 'Review Completed Week' : weekStatus(week, todayIso, archived) === 'Current' ? 'Plan This Week' : 'Open Weekly Planner'}</PrimaryButton>
  </CardStack>;
}

function ArchivedCardSummary({ historical, archivedRecord }: { historical: ReturnType<typeof buildHistoricalWeekSummary>; archivedRecord?: WeeklyCompletionRecord }) {
  const { metrics, completionPercent, keyWorkout, longestCompletedRun } = historical;
  return <div style={{ display: 'grid', gap: spacing.xs }}>
    <p style={focusStyle}>{metrics.completedWorkouts} of {metrics.plannedWorkouts} workouts completed{completionPercent !== undefined ? ` · ${completionPercent}%` : ''}</p>
    <div style={summaryLineStyle}>{metrics.actualDistanceKm ? <span>{metrics.actualDistanceKm} km</span> : null}{metrics.actualDurationMinutes ? <span>{formatMinutes(metrics.actualDurationMinutes)}</span> : null}</div>
    {keyWorkout ? <p style={warningLineStyle}>Key Session: {cleanLabel(keyWorkout.title)}{keyWorkout.completion ? ' · Completed' : ' · Incomplete'}</p> : null}
    {longestCompletedRun ? <p style={warningLineStyle}>Longest Run: {completionDistance(longestCompletedRun.completion)} km</p> : null}
    {archivedRecord?.weeklyReflection ? <p style={warningLineStyle}>Weekly reflection saved</p> : null}
  </div>;
}

function ArchivedWeekDetail({ week, workouts, archivedRecord, nextWeek }: { week: GeneratedTrainingWeek; workouts: ResolvedWorkout[]; archivedRecord?: WeeklyCompletionRecord; nextWeek?: GeneratedTrainingWeek }) {
  const historical = buildHistoricalWeekSummary(week, workouts, archivedRecord, nextWeek);
  const { metrics, completionPercent, keyWorkout, longestCompletedRun } = historical;
  return <CardStack>
    <section style={readOnlyCueStyle} aria-label="Archived training record"><strong>Archived training record</strong><p style={panelCopyStyle}>This week is preserved as part of your history. Review is read-only.</p></section>
    <PanelSection title="Week summary"><div style={summaryGridStyle}><SummaryItem label="Sessions planned" value={String(metrics.plannedWorkouts)} /><SummaryItem label="Sessions completed" value={String(metrics.completedWorkouts)} />{completionPercent !== undefined ? <SummaryItem label="Completion" value={`${completionPercent}%`} /> : null}<SummaryItem label="Planned distance" value={metrics.plannedDistanceKm ? `${metrics.plannedDistanceKm} km` : 'Not recorded'} /><SummaryItem label="Completed distance" value={metrics.actualDistanceKm ? `${metrics.actualDistanceKm} km` : 'Not recorded'} /><SummaryItem label="Planned duration" value={metrics.plannedDurationMinutes ? formatMinutes(metrics.plannedDurationMinutes) : 'Not recorded'} /><SummaryItem label="Completed duration" value={metrics.actualDurationMinutes ? formatMinutes(metrics.actualDurationMinutes) : 'Not recorded'} /><SummaryItem label="Longest run" value={longestCompletedRun ? `${completionDistance(longestCompletedRun.completion)} km` : 'Not recorded'} /><SummaryItem label="Key session" value={keyWorkout ? `${cleanLabel(keyWorkout.title)} · ${keyWorkout.completion ? 'Completed' : 'Incomplete'}` : 'Not planned'} /></div></PanelSection>
    <PanelSection title="Planned versus completed"><div style={summaryGridStyle}><SummaryItem label="Distance · Planned" value={metrics.plannedDistanceKm ? `${metrics.plannedDistanceKm} km` : 'Not recorded'} /><SummaryItem label="Distance · Completed" value={metrics.actualDistanceKm ? `${metrics.actualDistanceKm} km` : 'Not recorded'} /><SummaryItem label="Time · Planned" value={metrics.plannedDurationMinutes ? formatMinutes(metrics.plannedDurationMinutes) : 'Not recorded'} /><SummaryItem label="Time · Completed" value={metrics.actualDurationMinutes ? formatMinutes(metrics.actualDurationMinutes) : 'Not recorded'} /></div></PanelSection>
    <PanelSection title="Coach Summary">{historical.coachSummary.map((line) => <p key={line} style={panelCopyStyle}>{line}</p>)}</PanelSection>
    <PanelSection title="This Week’s Story">{historical.storyWorkouts.map((workout) => <StoryItem key={workout.id} workout={workout} />)}</PanelSection>
    <PanelSection title="Weekly Reflection"><p style={reflectionTextStyle}>{archivedRecord?.weeklyReflection || 'No weekly reflection was recorded.'}</p></PanelSection>
  </CardStack>;
}

function StoryItem({ workout }: { workout: ResolvedWorkout }) {
  const log = workout.completion;
  const status = log ? ['Completed', feelingLabel(log.perceivedEffort)].filter(Boolean).join(' · ') : 'Incomplete';
  return <article style={storyItemStyle} aria-label={`${workout.title}, ${status}`}>
    <p style={dayLabelStyle}>{workout.assignedDay ? `${formatWeekday(workout.assignedDay)} · ${formatDate(workout.assignedDay)}` : 'Unscheduled'}</p>
    <h4 style={{ ...typography.h3, margin: `${spacing.xxs}px 0 0`, overflowWrap: 'anywhere' }}>{cleanLabel(workout.title)}</h4>
    <p style={warningLineStyle}>{roleLabel(workout)} · {status}{completionDistance(log) ? ` · ${completionDistance(log)} km` : ''}{completionDuration(log) ? ` · ${formatMinutes(completionDuration(log) ?? 0)}` : ''}</p>
    {workout.moved && workout.suggestedDate && workout.assignedDay ? <p style={warningLineStyle}>Moved from {formatWeekday(workout.suggestedDate)} to {formatWeekday(workout.assignedDay)}.</p> : null}
    {log ? <div style={journalBlockStyle}><p style={sectionLabelStyle}>How it felt</p><p style={panelCopyStyle}>{feelingLabel(log.perceivedEffort) ?? 'Not recorded'}</p>{log.journalNote || log.notes ? <><p style={sectionLabelStyle}>Training Journal</p><p style={reflectionTextStyle}>“{log.journalNote ?? log.notes}”</p></> : null}</div> : null}
  </article>;
}

function CompactSchedule({ workouts, week }: { workouts: ResolvedWorkout[]; week: GeneratedTrainingWeek }) { return <div style={scheduleStyle}>{weekDays.map((day, index) => { const date = isoAdd(week.startsOn, index); const dayWorkouts = workouts.filter((workout) => workout.assignedDay === date); return <div key={day} style={scheduleRowStyle}><span style={dayLabelStyle}>{day}</span><span style={scheduleTitleStyle}>{dayWorkouts.length ? dayWorkouts.map(compactWorkoutLabel).join(' + ') : 'Rest'}</span></div>; })}</div>; }
function KeySession({ label }: { label: string }) { return <div style={keySessionStyle}><span style={dayLabelStyle}>Key Session</span><strong style={keyValueStyle}>{label}</strong></div>; }
function PanelSection({ title, children }: { title: string; children: ReactNode }) { return <section style={panelSectionStyle}><h3 style={sectionLabelStyle}>{title}</h3>{children}</section>; }
function SummaryItem({ label, value }: { label: string; value: string }) { return <div><p style={sectionLabelStyle}>{label}</p><p style={{ ...typography.small, color: colors.neutral.text, margin: `${spacing.xxs}px 0 0`, fontWeight: 750 }}>{value}</p></div>; }

function archivedRecordFor(week: GeneratedTrainingWeek, records: WeeklyCompletionRecord[]) { return records.find((record) => record.weekNumber === week.weekNumber && record.archived); }
function weekStatus(week: GeneratedTrainingWeek, todayIso: string, archived: boolean) { if (archived) return 'Archived'; if (todayIso >= week.startsOn && todayIso <= week.endsOn) return 'Current'; if (todayIso > week.endsOn) return 'Past'; return 'Future'; }
function coachFocus(week: GeneratedTrainingWeek, workouts: ResolvedWorkout[]) { const race = workouts.find((workout) => workout.type === 'race'); if (race) return `${formatRaceLabel(race)} is this week’s primary training demand.`; return week.coachingMessage; }
function keySessionLabel(workouts: ResolvedWorkout[], week: GeneratedTrainingWeek) { const race = workouts.find((workout) => workout.type === 'race'); if (race) return `🏁 ${formatRaceLabel(race)}`; const longRun = workouts.find((workout) => workout.type === 'long_run'); if (longRun) return `Long Run${longRun.plannedDistanceKm ? ` · ${longRun.plannedDistanceKm} km` : ''}`; const quality = workouts.find((workout) => workout.type === 'quality_session'); if (quality) return cleanLabel(quality.title); return week.weekType === 'recovery' ? 'Recovery and adaptation' : 'Aerobic support'; }
export function compactWorkoutLabel(workout: ResolvedWorkout) { const title = workout.type === 'race' ? `🏁 ${formatRaceLabel(workout)}` : appendCompactDurationLabel(cleanLabel(workout.title), workout.plannedDurationMin); return `${title}${workout.status === 'completed' ? ' ✓' : ''}`; }
function formatRaceLabel(workout: GeneratedWorkout) { const raw = cleanLabel(workout.title).replace(/\bmilestone\b/ig, '').replace(/\btune[- ]?up\b/ig, '').replace(/\bgoal\b/ig, '').trim(); const distance = raceDistanceLabel(workout) ?? (raw.replace(/\s*(race|workout)$/i, '').trim() || 'Goal'); const lower = workout.title.toLowerCase(); const suffix = lower.includes('tune') || lower.includes('milestone') ? 'Tune-Up' : distance.toLowerCase().includes('marathon') || lower.includes('goal') ? (distance.toLowerCase().includes('marathon') ? 'Race' : 'Goal Race') : 'Race'; return cleanLabel(`${distance} ${suffix}`).replace(/^Marathon Race$/, 'Goal Marathon').replace(/^Goal Goal Race$/, 'Goal Race'); }
function raceDistanceLabel(workout: GeneratedWorkout) { const text = `${workout.title} ${workout.plannedDistanceKm ?? ''}`.toLowerCase(); if (text.includes('half') || workout.plannedDistanceKm === 21.1) return 'Half Marathon'; if (text.includes('marathon') || workout.plannedDistanceKm === 42.2) return 'Marathon'; if (text.includes('10k') || text.includes('10 km') || workout.plannedDistanceKm === 10) return '10 km'; if (text.includes('5k') || text.includes('5 km') || workout.plannedDistanceKm === 5) return '5 km'; if (text.includes('15k') || text.includes('15 km') || workout.plannedDistanceKm === 15) return '15 km'; return undefined; }
function cleanLabel(value: string) { return value.replace(/\b(milestone|race|workout)\s+\1\b/ig, '$1').replace(/\s+/g, ' ').replace(/\s+([·–-])\s+/g, ' $1 ').trim(); }
function calmWarning(warning: string) { return warning.replace(/^Warning:\s*/i, '').replace(/\.$/, '') + '.'; }
function formatMinutes(minutes: number) { const hours = Math.floor(minutes / 60); const mins = minutes % 60; return hours ? `${hours}h ${mins}m` : `${mins}m`; }
function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`)); }
function formatWeekday(date: string) { return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date(`${date}T00:00:00`)); }
function feelingLabel(value?: number) { if (!value) return undefined; return ({ 1: 'Very easy', 2: 'Comfortable', 3: 'About right', 4: 'Hard', 5: 'Very hard' } as Record<number, string>)[value] ?? `Effort ${value}`; }
function roleLabel(workout: ResolvedWorkout) { if (workout.type === 'race') return 'Race'; if (workout.type === 'quality_session') return 'Key session'; if (workout.type === 'long_run') return 'Long run'; if (workout.type === 'recovery') return 'Recovery'; if (workout.type === 'cross_training') return 'Cross-training'; return workout.category === 'optional' ? 'Optional support' : 'Foundation run'; }
function formatPhase(phase: TrainingPhase) { return phase.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatWeekType(type: WeekType) { return `${type[0].toUpperCase()}${type.slice(1)}`; }
function weekTone(type: WeekType): 'neutral' | 'green' | 'sky' | 'purple' | 'orange' { return type === 'recovery' ? 'sky' : type === 'peak' ? 'orange' : type === 'race' ? 'purple' : 'green'; }
function isoAdd(start: string, days: number) { const date = new Date(`${start}T00:00:00`); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }

const planStatsStyle = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm };
const compactCardStyle = { display: 'grid', gap: spacing.sm, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.md, background: colors.neutral.surface, boxSizing: 'border-box' as const, width: '100%', overflow: 'hidden' };
const cardButtonStyle = { display: 'grid', gap: spacing.sm, border: 0, padding: 0, background: 'transparent', textAlign: 'left' as const, width: '100%', minWidth: 0 };
const cardHeaderStyle = { display: 'grid', gap: spacing.xs };
const wrapHeaderStyle = { display: 'flex', gap: spacing.xs, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const };
const phaseTextStyle = { ...typography.caption, color: colors.neutral.muted, overflowWrap: 'anywhere' as const };
const focusStyle = { ...typography.small, color: colors.neutral.text, margin: 0, fontWeight: 650 };
const warningLineStyle = { ...typography.small, color: colors.neutral.muted, margin: 0 };
const summaryLineStyle = { display: 'flex', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' as const, ...typography.small, color: colors.neutral.text };
const keySessionStyle = { display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: spacing.sm, alignItems: 'center', padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.input, background: colors.neutral.faint };
const keyValueStyle = { ...typography.small, color: colors.neutral.text, overflowWrap: 'anywhere' as const };
const scheduleStyle = { display: 'grid', gap: 2 };
const scheduleRowStyle = { display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr)', gap: spacing.xs, alignItems: 'baseline', minHeight: 24, padding: `${spacing.xxs}px 0`, borderBottom: `1px solid ${colors.neutral.faint}` };
const dayLabelStyle = { ...typography.caption, color: colors.neutral.muted, whiteSpace: 'nowrap' as const };
const scheduleTitleStyle = { ...typography.small, color: colors.neutral.text, fontWeight: 650, overflowWrap: 'anywhere' as const };
const panelSectionStyle = { display: 'grid', gap: spacing.sm, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card, padding: spacing.md, background: colors.neutral.surface, minWidth: 0 };
const sectionLabelStyle = { ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' as const };
const panelCopyStyle = { ...typography.small, color: colors.neutral.text, margin: 0 };
const summaryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm };
const readOnlyCueStyle = { display: 'grid', gap: spacing.xxs, border: `1px solid ${colors.accent.sky}`, borderRadius: radius.card, padding: spacing.sm, background: colors.accent.skyTint, ...typography.small, color: colors.neutral.text } as const;
const storyItemStyle = { borderLeft: `3px solid ${colors.neutral.border}`, padding: `${spacing.xs}px 0 ${spacing.xs}px ${spacing.sm}`, background: colors.neutral.surface, minWidth: 0 } as const;
const journalBlockStyle = { display: 'grid', gap: spacing.xxs, marginTop: spacing.xs, minWidth: 0 } as const;
const reflectionTextStyle = { ...typography.body, whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const, margin: 0 };
