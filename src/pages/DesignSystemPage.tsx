import { colors, radius, spacing, typography } from '../design';
import { Divider, EmptyState, InfoBanner, LoadingSpinner, PlaceholderSkeleton, PrimaryButton, ProgressBar, ScreenTitle, SecondaryButton, SectionCard, StatusChip, WorkoutCard } from '../components/ui';

const stack = { display: 'grid', gap: spacing.md };

export function DesignSystemPage() {
  return (
    <div style={{ display: 'grid', gap: spacing.lg }}>
      <ScreenTitle eyebrow="Hidden reference" title="Design system">Permanent component and token preview for future passes.</ScreenTitle>

      <SectionCard>
        <ScreenTitle title="Typography" />
        <p style={{ ...typography.display, margin: 0 }}>Display</p>
        <p style={{ ...typography.h1, margin: 0 }}>Heading 1</p>
        <p style={{ ...typography.h2, margin: 0 }}>Heading 2</p>
        <p style={{ ...typography.h3, margin: 0 }}>Heading 3</p>
        <p style={{ ...typography.body, margin: 0 }}>Body text should feel warm, readable, and calm.</p>
        <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Small supporting copy.</p>
        <p style={{ ...typography.caption, color: colors.neutral.muted, margin: 0 }}>CAPTION</p>
      </SectionCard>

      <SectionCard>
        <ScreenTitle title="Colours" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.sm }}>
          {Object.entries({ Green: colors.primary.green, Sky: colors.accent.sky, Purple: colors.accent.purple, Orange: colors.accent.orange, Amber: colors.accent.amber, Red: colors.accent.red, Background: colors.neutral.background, Text: colors.neutral.text }).map(([name, color]) => (
            <div key={name} style={{ background: color, minHeight: spacing.xxxl + spacing.xs, borderRadius: radius.button, padding: spacing.sm, color: name === 'Background' ? colors.neutral.text : colors.neutral.white, border: `1px solid ${colors.neutral.border}` }}>{name}</div>
          ))}
        </div>
      </SectionCard>

      <section style={stack}>
        <ScreenTitle title="Buttons" />
        <PrimaryButton>Start today</PrimaryButton>
        <SecondaryButton>Maybe later</SecondaryButton>
      </section>

      <section style={stack}>
        <ScreenTitle title="Workout cards" />
        <WorkoutCard title="Easy run" meta="35 min comfortable" tone="easy" />
        <WorkoutCard title="Threshold session" meta="3 × 8 min steady" tone="threshold" />
        <WorkoutCard title="Long run" meta="75 min relaxed" tone="longRun" />
        <WorkoutCard title="Recovery jog" meta="25 min very easy" tone="recovery" />
        <WorkoutCard title="Optional strides" meta="Keep it light" tone="optional" />
        <WorkoutCard title="Extra mobility" meta="Short support session" tone="extra" />
      </section>

      <SectionCard>
        <ScreenTitle title="Progress" />
        <ProgressBar value={64} />
        <Divider />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
          <StatusChip tone="completed" /><StatusChip tone="moved" /><StatusChip tone="notPlanned" /><StatusChip tone="foundation" /><StatusChip tone="optional" /><StatusChip tone="extra" />
        </div>
      </SectionCard>

      <InfoBanner>Helpful guidance should feel reassuring, never alarming.</InfoBanner>
      <EmptyState title="Nothing planned yet">Your coach will keep this space calm until there is something useful to show.</EmptyState>
      <SectionCard><PlaceholderSkeleton /></SectionCard>
      <SectionCard><LoadingSpinner /></SectionCard>
    </div>
  );
}
