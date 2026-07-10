import { Navigate, Route, Routes } from 'react-router-dom';
import { readStorageValue, storageKeys } from '../utils/storage';
import { AppShell } from '../components/layout/AppShell';
import { WelcomePage } from '../pages/WelcomePage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { PlanSummaryPage } from '../pages/PlanSummaryPage';
import { TodayPage } from '../pages/TodayPage';
import { WeekCloseoutPage } from '../pages/WeekCloseoutPage';
import { WeekPlannerPage } from '../pages/WeekPlannerPage';
import { WorkoutDetailPage } from '../pages/WorkoutDetailPage';
import { CompleteWorkoutPage } from '../pages/CompleteWorkoutPage';
import { SettingsExportPage } from '../pages/SettingsExportPage';
import { DesignSystemPage } from '../pages/DesignSystemPage';
import { PlanReviewPage } from '../pages/PlanReviewPage';
import { EngineLabPage } from '../pages/EngineLabPage';
function DefaultRoute() {
  const hasProfile = readStorageValue(storageKeys.profile, null) !== null;
  const hasPlan = readStorageValue(storageKeys.plan, null) !== null;
  return <Navigate to={hasProfile && hasPlan ? '/plan-summary' : '/onboarding'} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DefaultRoute />} />
        <Route path="welcome" element={<WelcomePage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="plan-summary" element={<PlanSummaryPage />} />
        <Route path="plan-review" element={<PlanReviewPage />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="week" element={<WeekPlannerPage />} />
        <Route path="workout/:id" element={<WorkoutDetailPage />} />
        <Route path="workout/:id/complete" element={<CompleteWorkoutPage />} />
        <Route path="closeout" element={<WeekCloseoutPage />} />
        <Route path="settings" element={<SettingsExportPage />} />
        <Route path="design-system" element={<DesignSystemPage />} />
        <Route path="engine-lab" element={<EngineLabPage />} />
        <Route path="*" element={<DefaultRoute />} />
      </Route>
    </Routes>
  );
}
