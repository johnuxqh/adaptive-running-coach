import { CardStack, HeroTitle, PrimaryButton, ProgressBar, SectionCard, TextInput } from '../components/ui';
import { colors, spacing, typography } from '../design';

const questions = ['Name', 'Race Distance', 'Race Date', 'Goal', 'Current Fitness', 'Longest Run', 'Average Weekly Running', 'Milestone Races'];

export function OnboardingPage() {
  return (
    <CardStack>
      {questions.map((question, index) => (
        <SectionCard key={question}>
          <CardStack>
            <ProgressBar value={((index + 1) / (questions.length + 1)) * 100} />
            <HeroTitle eyebrow={`Question ${index + 1} of ${questions.length}`} title={question}>{index === 0 ? 'What should your coach call you?' : 'Choose the placeholder answer that feels closest.'}</HeroTitle>
            {index === 0 || index === 2 || index === 7 ? <TextInput placeholder={index === 0 ? 'Lauren' : index === 2 ? '12 October 2026' : 'Half marathon tune-up'} /> : <div style={{ display: 'grid', gap: spacing.sm }}><PrimaryButton>{index === 1 ? 'Melbourne Marathon' : index === 3 ? 'Finish strong and happy' : index === 4 ? 'Running 3 times per week' : index === 5 ? '18 km' : '35 km per week'}</PrimaryButton><button style={{ ...typography.button, minHeight: 52, border: `1px solid ${colors.neutral.border}`, borderRadius: 18, background: colors.neutral.surface, color: colors.neutral.text }}>Another option</button></div>}
            <PrimaryButton>Next</PrimaryButton>
          </CardStack>
        </SectionCard>
      ))}
      <SectionCard><HeroTitle title="Perfect.">I&apos;ve got everything I need.<br />Let&apos;s build your plan.</HeroTitle><PrimaryButton>Build My Plan</PrimaryButton></SectionCard>
    </CardStack>
  );
}
