import { CardStack, HeroTitle, PageStack, SectionCard, StatCard } from '../components/ui';
import { colors, typography } from '../design';

const cards = ['Profile','Export Plan','Export Coach Report','About'];

export function SettingsExportPage() {
  return <PageStack><HeroTitle eyebrow="Settings" title="Simple and calm">No functionality in this pass.</HeroTitle><CardStack>{cards.map((card) => <SectionCard key={card}><h3 style={{ ...typography.h3, margin: 0 }}>{card}</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: '8px 0 0' }}>Placeholder setting card.</p></SectionCard>)}</CardStack><StatCard label="Version" value="0.2.0" detail="Pass 2 placeholder UI" /></PageStack>;
}
