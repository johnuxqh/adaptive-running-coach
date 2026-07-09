import { CardStack, HeroTitle, InfoBanner, PageStack, PrimaryButton, SectionCard, StatCard } from '../components/ui';
import { typography } from '../design';

export function PlanSummaryPage() {
  return <PageStack><SectionCard><HeroTitle eyebrow="Plan ready" title="82 Days">until<br />Melbourne Marathon</HeroTitle><PrimaryButton>Start My Plan</PrimaryButton></SectionCard><div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}><StatCard label="Weeks Remaining" value="14" /><StatCard label="Estimated Training Time" value="5h 20m" /><StatCard label="Foundation Workouts" value="4 / week" /><StatCard label="Optional Sessions" value="2 / week" /><StatCard label="Estimated Distance" value="38 km" /></div><InfoBanner>Your plan is built around consistency. Complete the foundation sessions. The optional sessions are there if life allows.</InfoBanner><SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Simple rules</h3><p>• Protect the long run<br />• Easy means easy<br />• Avoid stacking hard sessions<br />• Missing one run isn&apos;t failure</p></CardStack></SectionCard></PageStack>;
}
