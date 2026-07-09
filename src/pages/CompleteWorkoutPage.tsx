import { CardStack, HeroTitle, PageStack, PrimaryButton, SectionCard, TextArea, TextInput } from '../components/ui';
import { colors, radius, spacing, typography } from '../design';

const feels = ['😫','🙁','😐','🙂','😁'];

export function CompleteWorkoutPage() {
  return <PageStack><SectionCard><CardStack><div style={{ fontSize: 48, textAlign: 'center' }}>✨</div><HeroTitle title="How did today&apos;s workout feel?">Nice work showing up, Lauren.</HeroTitle><div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: spacing.xs }}>{feels.map((feel) => <button key={feel} style={{ minHeight: 56, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.button, background: colors.neutral.surface, fontSize: 24 }}>{feel}</button>)}</div></CardStack></SectionCard><SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Notes</h3><TextArea placeholder="What should your coach remember?" /><TextInput placeholder="Actual Time" /><TextInput placeholder="Actual Distance" /><PrimaryButton>Save Workout</PrimaryButton></CardStack></SectionCard></PageStack>;
}
