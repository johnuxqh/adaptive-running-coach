import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, InfoBanner, PageStack, PrimaryButton, SectionCard, SlidePanel, StatCard } from '../components/ui';
import { colors, spacing, typography } from '../design';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, RaceType, TrainingPhase, WeekType } from '../engine/planTypes';
import { readStorageValue, storageKeys } from '../utils/storage';

const raceLabels: Record<RaceType, string> = { '5k': '5 km', '10k': '10 km', '15k': '15 km', half_marathon: 'Half Marathon', marathon: 'Marathon' };

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
    <SlidePanel isOpen={Boolean(selectedWeek)} title={selectedWeek ? `Week ${selectedWeek.weekNumber} details` : 'Week details'} onClose={() => setSelectedWeek(null)}>{selectedWeek ? <WeekDetail week={selectedWeek} /> : null}</SlidePanel>
  </PageStack>;
}

function WeekReviewCard({ week, onOpen }: { week: GeneratedTrainingWeek; onOpen: () => void }) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const workouts = [...week.foundationWorkouts, ...week.optionalWorkouts];
  return <button type="button" onClick={onOpen} style={{ border: 0, padding: 0, background: 'transparent', textAlign: 'left', width: '100%' }}><SectionCard><CardStack>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md }}><div><Chip tone={week.weekType === 'recovery' ? 'sky' : week.weekType === 'peak' ? 'orange' : week.weekType === 'race' ? 'purple' : 'green'}>Week {week.weekNumber}</Chip><h3 style={{ ...typography.h3, margin: `${spacing.xs}px 0 0` }}>{formatDate(week.startsOn)} – {formatDate(week.endsOn)}</h3></div><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{formatPhase(week.phase)}<br />{formatWeekType(week.weekType)}</p></div>
    <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Target: {week.targetDistanceRangeKm.min}–{week.targetDistanceRangeKm.max} km • {week.targetDurationRangeMin.min}–{week.targetDurationRangeMin.max} min</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: spacing.xs }}>{days.map((day, index) => <div key={day} style={{ border: `1px solid ${colors.neutral.border}`, borderRadius: 12, padding: 6, minHeight: 54 }}><p style={{ ...typography.caption, margin: 0 }}>{day}</p><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{workouts[index]?.title ?? 'Rest'}</p></div>)}</div>
  </CardStack></SectionCard></button>;
}
function WeekDetail({ week }: { week: GeneratedTrainingWeek }) { return <CardStack><WorkoutList title="Foundation workouts" workouts={week.foundationWorkouts.map((w) => w.title)} /><WorkoutList title="Optional workouts" workouts={week.optionalWorkouts.map((w) => w.title)} /><WorkoutList title="Long run" workouts={week.foundationWorkouts.filter((w) => w.type === 'long_run').map((w) => w.title)} /><WorkoutList title="Quality session" workouts={week.foundationWorkouts.filter((w) => w.type === 'quality_session').map((w) => w.title)} /><p style={{ ...typography.small, color: colors.neutral.text, margin: 0 }}>{week.coachingMessage}</p>{week.warnings.map((warning) => <p key={warning} style={{ ...typography.small, color: colors.accent.amber, margin: 0 }}>• {warning}</p>)}</CardStack>; }
function WorkoutList({ title, workouts }: { title: string; workouts: string[] }) { return <div><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{title}</p><p style={{ ...typography.small, color: colors.neutral.text, margin: `${spacing.xs}px 0 0` }}>{workouts.length ? workouts.join(' · ') : 'None'}</p></div>; }
function formatMinutes(minutes: number) { const hours = Math.floor(minutes / 60); const mins = minutes % 60; return hours ? `${hours}h ${mins}m` : `${mins}m`; }
function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`)); }
function formatPhase(phase: TrainingPhase) { return phase.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatWeekType(type: WeekType) { return `${type[0].toUpperCase()}${type.slice(1)} week`; }
