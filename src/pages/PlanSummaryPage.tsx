import { useNavigate } from 'react-router-dom';
import { CardStack, HeroTitle, InfoBanner, PageStack, PrimaryButton, SectionCard, StatCard } from '../components/ui';
import { colors, typography } from '../design';
import type { GeneratedTrainingPlan } from '../engine/planTypes';
import { readStorageValue, storageKeys } from '../utils/storage';

const raceLabels: Record<string, string> = { '5k': '5 km', '10k': '10 km', '15k': '15 km', half_marathon: 'Half Marathon', marathon: 'Marathon' };

export function PlanSummaryPage() {
  const navigate = useNavigate();
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);

  if (!plan) {
    return <PageStack><SectionCard><HeroTitle eyebrow="Plan summary" title="No plan yet">Complete onboarding and I&apos;ll build your personalised plan.</HeroTitle><PrimaryButton onClick={() => navigate('/onboarding')}>Start Onboarding</PrimaryButton></SectionCard></PageStack>;
  }

  const summary = plan.summary;
  const timeRange = `${formatMinutes(summary.estimatedTimeRangeMin.min)}–${formatMinutes(summary.estimatedTimeRangeMin.max)}`;
  const distanceRange = `${summary.estimatedDistanceRangeKm.min}–${summary.estimatedDistanceRangeKm.max} km`;

  return (
    <PageStack>
      <SectionCard>
        <HeroTitle eyebrow={`Plan ready for ${summary.athleteName}`} title={`${summary.daysUntilRace} Days`}>
          until<br />{raceLabels[summary.raceDistance]} on {summary.raceDate}
        </HeroTitle>
        <PrimaryButton onClick={() => navigate('/today')}>Start My Plan</PrimaryButton>
      </SectionCard>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <StatCard label="Athlete" value={summary.athleteName} />
        <StatCard label="Race" value={raceLabels[summary.raceDistance]} />
        <StatCard label="Weeks Remaining" value={String(summary.trainingWeeks)} />
        <StatCard label="Foundation Workouts" value={String(summary.totalFoundationWorkouts)} />
        <StatCard label="Optional Workouts" value={String(summary.totalOptionalWorkouts)} />
        <StatCard label="Estimated Distance" value={distanceRange} />
        <StatCard label="Estimated Training Time" value={timeRange} />
      </div>
      <InfoBanner>{summary.planEmphasis.join(' · ')}</InfoBanner>
      <SectionCard>
        <CardStack>
          <h3 style={{ ...typography.h3, margin: 0 }}>Warnings</h3>
          {summary.planWarnings.length ? summary.planWarnings.map((warning) => <p key={warning} style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>• {warning}</p>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>No major warnings. Keep listening to your body.</p>}
        </CardStack>
      </SectionCard>
      <SectionCard>
        <CardStack>
          <h3 style={{ ...typography.h3, margin: 0 }}>Simple coaching rules</h3>
          <p style={{ ...typography.body, color: colors.neutral.text, margin: 0 }}>{summary.rules.map((rule) => `• ${rule}`).join('\n')}</p>
        </CardStack>
      </SectionCard>
    </PageStack>
  );
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}
