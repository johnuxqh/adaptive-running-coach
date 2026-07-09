import { CardStack, Chip, HeroTitle, InfoBanner, PageStack, SectionCard, StatusChip, WorkoutCard } from '../components/ui';
import { colors, spacing, typography } from '../design';

const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export function WeekPlannerPage() {
  return <PageStack><HeroTitle eyebrow="Plan my week" title="Week 2 of 16">Drag workouts onto the days. Placeholder only.</HeroTitle><CardStack>{days.map((day) => <SectionCard key={day}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}><h3 style={{ ...typography.h3, margin: 0 }}>{day}</h3><StatusChip tone="notPlanned" /></div><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.sm}px 0 0` }}>Beautiful empty workout card</p></SectionCard>)}</CardStack><SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Workout tray</h3><div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}><Chip tone="green">Foundation</Chip><Chip tone="sky">Optional</Chip><Chip tone="purple">Extra</Chip></div><WorkoutCard title="Long Run" meta="75 min relaxed" tone="longRun" /><WorkoutCard title="Recovery" meta="25 min very easy" tone="recovery" /></CardStack></SectionCard><InfoBanner>Drag workouts onto the days</InfoBanner></PageStack>;
}
