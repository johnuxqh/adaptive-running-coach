import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { CardStack, HeroTitle, InfoBanner, PageStack, PrimaryButton, SecondaryButton, SectionCard, SlidePanel, StatCard } from '../components/ui';
import { colors, typography } from '../design';
import type { GeneratedTrainingPlan } from '../engine/planTypes';
import { readStorageValue, storageKeys } from '../utils/storage';

const raceLabels: Record<string, string> = { '5k': '5 km', '10k': '10 km', '15k': '15 km', half_marathon: 'Half Marathon', marathon: 'Marathon' };

export function PlanSummaryPage() {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<'warnings' | 'rules' | 'details' | null>(null);
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
        <SecondaryButton onClick={() => navigate('/plan-review')}>Review Plan</SecondaryButton>
      </SectionCard>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <StatCard label="Athlete" value={summary.athleteName} />
        <StatCard label="Race" value={raceLabels[summary.raceDistance]} />
        <StatCard label="Weeks" value={String(summary.trainingWeeks)} />
        <StatCard label="Foundation" value={String(summary.totalFoundationWorkouts)} />
        <StatCard label="Optional" value={String(summary.totalOptionalWorkouts)} />
        <StatCard label="Distance" value={distanceRange} />
        <StatCard label="Training Time" value={timeRange} />
      </div>
      <InfoBanner>{summary.planEmphasis.slice(0, 2).join(' · ')}</InfoBanner><SectionCard><CardStack><SecondaryButton onClick={() => setPanel('warnings')}>Warnings</SecondaryButton><SecondaryButton onClick={() => setPanel('rules')}>Coaching Rules</SecondaryButton><SecondaryButton onClick={() => setPanel('details')}>Plan Details</SecondaryButton></CardStack></SectionCard><SlidePanel isOpen={Boolean(panel)} title={panel === 'warnings' ? 'Warnings' : panel === 'rules' ? 'Coaching rules' : 'Plan details'} onClose={() => setPanel(null)}><CardStack>{panel === 'warnings' ? (summary.planWarnings.length ? summary.planWarnings.map((warning) => <p key={warning} style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>• {warning}</p>) : <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>No major warnings. Keep listening to your body.</p>) : null}{panel === 'rules' ? summary.rules.map((rule) => <p key={rule} style={{ ...typography.small, color: colors.neutral.text, margin: 0 }}>• {rule}</p>) : null}{panel === 'details' ? summary.planEmphasis.map((item) => <p key={item} style={{ ...typography.small, color: colors.neutral.text, margin: 0 }}>• {item}</p>) : null}</CardStack></SlidePanel>
    </PageStack>
  );
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}
