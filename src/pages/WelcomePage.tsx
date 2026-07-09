import { HeroTitle, IllustrationPlaceholder, PageStack, PrimaryButton, SectionCard } from '../components/ui';

export function WelcomePage() {
  return (
    <PageStack>
      <IllustrationPlaceholder>🏃‍♀️<br />Calm miles ahead</IllustrationPlaceholder>
      <SectionCard>
        <HeroTitle title="Hello Athlete 👋">Ready to build something amazing?</HeroTitle>
        <PrimaryButton>Let&apos;s Get Fit</PrimaryButton>
      </SectionCard>
    </PageStack>
  );
}
