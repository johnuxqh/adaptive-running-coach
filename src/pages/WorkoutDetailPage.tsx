import { CardStack, Chip, HeroTitle, PageStack, PrimaryButton, SecondaryButton, SectionCard, TextArea } from '../components/ui';
import { colors, typography } from '../design';

function DetailBlock({ title, children }: { title: string; children: string }) {
  return <SectionCard><h3 style={{ ...typography.h3, margin: 0 }}>{title}</h3><p style={{ ...typography.body, color: colors.neutral.muted, margin: '8px 0 0' }}>{children}</p></SectionCard>;
}

export function WorkoutDetailPage() {
  return <PageStack><HeroTitle eyebrow="Today&apos;s workout" title="Easy Run"><Chip tone="green">Foundation</Chip></HeroTitle><DetailBlock title="Warm Up">10 minutes relaxed jog. Let the body arrive gradually.</DetailBlock><DetailBlock title="Main Set">25 minutes easy running. You should be able to talk the whole time.</DetailBlock><DetailBlock title="Cool Down">5 minutes gentle jog, then a few easy stretches if they feel good.</DetailBlock><DetailBlock title="Purpose">Build aerobic consistency without adding stress to the week.</DetailBlock><DetailBlock title="Coach Tip">Easy means easy. Finish feeling like you could do a little more.</DetailBlock><SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Workout Notes</h3><TextArea placeholder="Add notes after your run" /></CardStack></SectionCard><PrimaryButton>I&apos;ve Completed This Workout</PrimaryButton><SecondaryButton>Life Got In The Way</SecondaryButton></PageStack>;
}
