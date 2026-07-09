import { CardStack, Chip, HeroTitle, PageStack, ProgressBar, SectionCard, StatCard, WorkoutCard } from '../components/ui';
import { colors, typography } from '../design';

export function TodayPage() {
  return <PageStack><HeroTitle eyebrow="Week 2 of 16" title="Good Morning Lauren ☀️">82 days until Melbourne Marathon</HeroTitle><WorkoutCard title="Easy Run" meta="40 min comfortable • Keep it conversational" tone="easy" /><SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Weekly Progress</h3><ProgressBar value={62} /><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>3 of 5 sessions gently completed.</p></CardStack></SectionCard><StatCard label="Foundation Progress" value="3 / 4" detail="One calm foundation run remains." /><WorkoutCard title="Threshold" meta="Thursday • 3 × 8 min steady" tone="threshold" /><SectionCard><Chip tone="green">“Small consistent steps become big changes.”</Chip></SectionCard></PageStack>;
}
