import { useNavigate } from 'react-router-dom';
import { CardStack, HeroTitle, PageStack, PrimaryButton, SectionCard, StatCard } from '../components/ui';
import { colors, typography } from '../design';
import { removeStorageValue, storageKeys } from '../utils/storage';

const cards = ['Profile', 'Export Plan', 'Export Coach Report', 'About'];

export function SettingsExportPage() {
  const navigate = useNavigate();

  function resetApp() {
    if (!window.confirm('Reset Life-Fit Running Coach? This removes your profile, plan, current week, workout logs, and settings.')) return;
    removeStorageValue(storageKeys.profile);
    removeStorageValue(storageKeys.plan);
    removeStorageValue(storageKeys.currentWeek);
    removeStorageValue(storageKeys.workoutLogs);
    removeStorageValue(storageKeys.settings);
    navigate('/onboarding', { replace: true });
  }

  return (
    <PageStack>
      <HeroTitle eyebrow="Settings" title="Simple and calm">
        Manage your local app data.
      </HeroTitle>
      <CardStack>
        {cards.map((card) => (
          <SectionCard key={card}>
            <h3 style={{ ...typography.h3, margin: 0 }}>{card}</h3>
            <p style={{ ...typography.small, color: colors.neutral.muted, margin: '8px 0 0' }}>
              Placeholder setting card.
            </p>
          </SectionCard>
        ))}
        <SectionCard>
          <CardStack>
            <h3 style={{ ...typography.h3, margin: 0 }}>Reset App</h3>
            <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>
              Remove your profile, plan, current week, workout logs, and settings from this device.
            </p>
            <PrimaryButton onClick={resetApp}>Reset App</PrimaryButton>
          </CardStack>
        </SectionCard>
      </CardStack>
      <StatCard label="Version" value="0.5.0" detail="Pass 5 onboarding and plan generation" />
      <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>
        Build target: GitHub Pages
      </p>
    </PageStack>
  );
}
