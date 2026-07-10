import { useNavigate } from 'react-router-dom';
import { CardStack, Chip, HeroTitle, InfoBanner, PageStack, PrimaryButton, SectionCard, StatCard } from '../components/ui';
import { colors, spacing, typography } from '../design';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek, RaceType, TrainingPhase, WeekType } from '../engine/planTypes';
import { readStorageValue, storageKeys } from '../utils/storage';

const raceLabels: Record<RaceType, string> = { '5k': '5 km', '10k': '10 km', '15k': '15 km', half_marathon: 'Half Marathon', marathon: 'Marathon' };

export function PlanReviewPage() {
  const navigate = useNavigate();
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);

  if (!plan) {
    return <PageStack><SectionCard><HeroTitle eyebrow="Plan review" title="No plan yet">Complete onboarding and I&apos;ll build your personalised plan.</HeroTitle><PrimaryButton onClick={() => navigate('/onboarding')}>Start Onboarding</PrimaryButton></SectionCard></PageStack>;
  }

  const summary = plan.summary;
  const distanceRange = `${summary.estimatedDistanceRangeKm.min}–${summary.estimatedDistanceRangeKm.max} km`;
  const timeRange = `${formatMinutes(summary.estimatedTimeRangeMin.min)}–${formatMinutes(summary.estimatedTimeRangeMin.max)}`;

  return <PageStack>
    <SectionCard>
      <HeroTitle eyebrow="Full plan review" title={raceLabels[summary.raceDistance]}>{summary.athleteName} • {summary.daysUntilRace} days until race day on {summary.raceDate}</HeroTitle>
      <PrimaryButton onClick={() => navigate('/week')}>Back to Week Planner</PrimaryButton>
    </SectionCard>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.md }}>
      <StatCard label="Weeks Remaining" value={String(summary.trainingWeeks)} />
      <StatCard label="Foundation" value={String(summary.totalFoundationWorkouts)} detail="total workouts" />
      <StatCard label="Optional" value={String(summary.totalOptionalWorkouts)} detail="total workouts" />
      <StatCard label="Distance" value={distanceRange} />
      <StatCard label="Training Time" value={timeRange} />
    </div>
    <InfoBanner>{summary.planEmphasis.join(' · ')}</InfoBanner>
    <CardStack>{plan.weeks.map((week) => <WeekReviewCard key={week.id} week={week} />)}</CardStack>
  </PageStack>;
}

function WeekReviewCard({ week }: { week: GeneratedTrainingWeek }) {
  return <SectionCard><CardStack>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
      <div><Chip tone={week.weekType === 'recovery' ? 'sky' : week.weekType === 'peak' ? 'orange' : week.weekType === 'race' ? 'purple' : 'green'}>Week {week.weekNumber}</Chip><h3 style={{ ...typography.h3, margin: `${spacing.xs}px 0 0` }}>{formatDate(week.startsOn)} – {formatDate(week.endsOn)}</h3></div>
      <div style={{ textAlign: 'right' }}><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{formatPhase(week.phase)}</p><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>{formatWeekType(week.weekType)}</p></div>
    </div>
    <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Target: {week.targetDistanceRangeKm.min}–{week.targetDistanceRangeKm.max} km • {week.targetDurationRangeMin.min}–{week.targetDurationRangeMin.max} min</p>
    <WorkoutList title="Foundation workouts" workouts={week.foundationWorkouts.map((workout) => workout.title)} />
    <WorkoutList title="Optional workouts" workouts={week.optionalWorkouts.map((workout) => workout.title)} />
    {week.warnings.length ? <div><p style={{ ...typography.caption, color: colors.accent.amber, margin: 0 }}>{week.warnings.length} warning{week.warnings.length === 1 ? '' : 's'}</p>{week.warnings.map((warning) => <p key={warning} style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>• {warning}</p>)}</div> : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>No week-specific warnings.</p>}
  </CardStack></SectionCard>;
}

function WorkoutList({ title, workouts }: { title: string; workouts: string[] }) { return <div><p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>{title}</p><p style={{ ...typography.small, color: colors.neutral.text, margin: `${spacing.xs}px 0 0` }}>{workouts.length ? workouts.join(' · ') : 'None'}</p></div>; }
function formatMinutes(minutes: number) { const hours = Math.floor(minutes / 60); const mins = minutes % 60; return hours ? `${hours}h ${mins}m` : `${mins}m`; }
function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`)); }
function formatPhase(phase: TrainingPhase) { return phase.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatWeekType(type: WeekType) { return `${type[0].toUpperCase()}${type.slice(1)} week`; }
