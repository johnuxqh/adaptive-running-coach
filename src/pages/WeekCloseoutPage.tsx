import { CardStack, HeroTitle, InfoBanner, PageStack, PrimaryButton, SectionCard, StatCard, TextArea } from '../components/ui';
import { typography } from '../design';

export function WeekCloseoutPage() {
  return <PageStack><HeroTitle eyebrow="Week closeout" title="Great Work Lauren 🎉">Another great week. Consistency beats perfection.</HeroTitle><div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}><StatCard label="Foundation" value="4 / 4" /><StatCard label="Optional" value="1 / 2" /></div><InfoBanner>Another great week. Consistency beats perfection.</InfoBanner><SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Notes</h3><TextArea placeholder="What went well this week?" /><TextArea placeholder="Reason workouts were missed (optional)" /><PrimaryButton>Continue To Next Week</PrimaryButton></CardStack></SectionCard></PageStack>;
}
