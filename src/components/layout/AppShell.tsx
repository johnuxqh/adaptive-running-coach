import { Outlet } from 'react-router-dom';
import { colors } from '../../design';
import { BottomNavigation, Header, PageContainer } from '../ui';

export function AppShell() {
  return (
    <div style={{ minHeight: '100vh', background: colors.neutral.background }}>
      <PageContainer>
        <Header />
        <main>
          <Outlet />
        </main>
        <BottomNavigation />
      </PageContainer>
    </div>
  );
}
