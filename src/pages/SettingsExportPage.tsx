import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, HeroTitle, PageStack, PrimaryButton, SectionCard, SecondaryButton, StatCard, TextInput } from '../components/ui';
import { colors, spacing, typography } from '../design';
import type { GeneratedTrainingPlan, GeneratedTrainingWeek } from '../engine/planTypes';
import type { AthleteProfile, WorkoutLog } from '../engine/types';
import { clearPendingSync, getPendingSyncCount, retryPendingSync, testCoachWebhook } from '../utils/googleSheetsSync';
import { buildCoachReportCsv, buildFullPlanCsv, download, safeName, stamp, type BackupPayload, type PlannerState, type WeekSummary } from '../utils/exportUtils';
import { defaultSettings, readStorageValue, removeStorageValue, storageKeys, writeStorageValue, type LifeFitSettings } from '../utils/storage';

const emptyPlanner: PlannerState = { assignments: {}, extraWorkouts: [] };

export function SettingsExportPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = readStorageValue<AthleteProfile | null>(storageKeys.profile, null);
  const plan = readStorageValue<GeneratedTrainingPlan | null>(storageKeys.plan, null);
  const athleteName = plan?.summary.athleteName ?? profile?.name ?? 'athlete';
  const savedSettings = readStorageValue<LifeFitSettings>(storageKeys.settings, defaultSettings);
  const [coachReportLink, setCoachReportLink] = useState(savedSettings.googleSheetsWebhookUrl ?? '');
  const [coachSyncMessage, setCoachSyncMessage] = useState('');
  const [pendingReports, setPendingReports] = useState(getPendingSyncCount());


  function saveCoachSync() {
    const settings = readStorageValue<LifeFitSettings>(storageKeys.settings, defaultSettings);
    writeStorageValue(storageKeys.settings, { ...settings, googleSheetsWebhookUrl: coachReportLink.trim() || undefined });
    setCoachSyncMessage(coachReportLink.trim() ? 'Coach report link saved.' : 'Coach report link cleared.');
  }

  async function testCoachSync() {
    const url = coachReportLink.trim();
    if (!url) { setCoachSyncMessage('Add your coach report link first.'); return; }
    try {
      await testCoachWebhook(url);
      setCoachSyncMessage('Connection looks good.');
    } catch {
      setCoachSyncMessage('Connection could not be checked. Your saved weeks are still safe.');
    }
  }

  function clearCoachSync() {
    setCoachReportLink('');
    const settings = readStorageValue<LifeFitSettings>(storageKeys.settings, defaultSettings);
    writeStorageValue(storageKeys.settings, { ...settings, googleSheetsWebhookUrl: undefined });
    setCoachSyncMessage('Coach report link cleared.');
  }

  async function retryReports() {
    const url = coachReportLink.trim() || undefined;
    const result = await retryPendingSync(url);
    setPendingReports(getPendingSyncCount());
    setCoachSyncMessage(result.failed ? `${result.sent} sent. ${result.failed} still waiting.` : 'Pending coach reports sent.');
  }

  function clearReports() {
    clearPendingSync();
    setPendingReports(0);
    setCoachSyncMessage('Pending coach reports cleared.');
  }

  function resetApp() {
    if (!window.confirm('Reset Life-Fit Running Coach? This removes your profile, plan, current week, workout logs, week summaries, and settings.')) return;
    clearApp();
    navigate('/onboarding', { replace: true });
  }

  function exportPlan() {
    if (!plan) return;
    download(`life-fit-full-plan-${safeName(athleteName)}-${stamp()}.csv`, buildFullPlanCsv(plan), 'text/csv;charset=utf-8');
  }

  function exportCoachReport() {
    if (!plan) return;
    const planner = readStorageValue<PlannerState>(storageKeys.weeklyPlanner, emptyPlanner);
    const logs = readStorageValue<WorkoutLog[]>(storageKeys.workoutLogs, []);
    const summaries = readStorageValue<WeekSummary[]>(storageKeys.weekSummaries, []);
    download(`life-fit-coach-report-${safeName(athleteName)}-${stamp()}.csv`, buildCoachReportCsv(plan, planner, logs, summaries), 'text/csv;charset=utf-8');
  }

  function exportBackup() {
    const payload: BackupPayload = { profile, plan, currentWeek: readStorageValue<GeneratedTrainingWeek | null>(storageKeys.currentWeek, null), plannerState: readStorageValue<PlannerState>(storageKeys.weeklyPlanner, emptyPlanner), workoutLogs: readStorageValue<WorkoutLog[]>(storageKeys.workoutLogs, []), weekSummaries: readStorageValue<WeekSummary[]>(storageKeys.weekSummaries, []), settings: readStorageValue<LifeFitSettings>(storageKeys.settings, defaultSettings) };
    download(`life-fit-backup-${safeName(athleteName)}-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBackup(String(reader.result ?? ''));
      if (!parsed) { window.alert('That backup file does not look like a Life-Fit backup.'); return; }
      if (!window.confirm('Import backup and overwrite the current local app data?')) return;
      writeStorageValue(storageKeys.profile, parsed.profile);
      writeStorageValue(storageKeys.plan, parsed.plan);
      writeStorageValue(storageKeys.currentWeek, parsed.currentWeek);
      writeStorageValue(storageKeys.weeklyPlanner, parsed.plannerState);
      writeStorageValue(storageKeys.workoutLogs, parsed.workoutLogs);
      writeStorageValue(storageKeys.weekSummaries, parsed.weekSummaries);
      writeStorageValue(storageKeys.settings, parsed.settings ?? defaultSettings);
      navigate('/today', { replace: true });
    };
    reader.readAsText(file);
  }

  return <PageStack>
    <HeroTitle eyebrow="Settings" title="Simple and calm">Manage your local app data.</HeroTitle>
    <CardStack>
      <SettingsCard title="Profile">{athleteName}</SettingsCard>
      <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Coach Sync</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>This lets your weekly summary be sent to your coach when you close a week.</p><label style={{ ...typography.caption, color: colors.neutral.muted, textTransform: 'uppercase' }}>Coach report link</label><TextInput value={coachReportLink} onChange={(event) => setCoachReportLink(event.currentTarget.value)} placeholder="Paste your coach report link" inputMode="url" /><PrimaryButton onClick={saveCoachSync}>Save</PrimaryButton><SecondaryButton onClick={testCoachSync}>Test Connection</SecondaryButton><SecondaryButton onClick={clearCoachSync}>Clear</SecondaryButton><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Pending coach reports: {pendingReports}</p><SecondaryButton onClick={retryReports} disabled={!pendingReports}>Retry Pending Reports</SecondaryButton><SecondaryButton onClick={clearReports} disabled={!pendingReports}>Clear Pending Reports</SecondaryButton>{coachSyncMessage ? <p style={{ ...typography.small, color: colors.primary.green, margin: 0 }}>{coachSyncMessage}</p> : null}</CardStack></SectionCard>
      <ActionCard title="Export Full Plan" text="Download every planned workout as a CSV safety net." action="Export Full Plan" onClick={exportPlan} disabled={!plan} />
      <ActionCard title="Export Coach Report" text="Download planned workouts, logs, and week summaries for your coach." action="Export Coach Report" onClick={exportCoachReport} disabled={!plan} />
      <ActionCard title="Export Backup" text="Download your profile, plan, logs, summaries, planner state, and settings as JSON." action="Export Backup" onClick={exportBackup} />
      <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Import Backup</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Restore a Life-Fit backup JSON from this device.</p><input ref={fileRef} type="file" accept="application/json,.json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) importBackup(file); }} style={{ display: 'none' }} /><SecondaryButton onClick={() => fileRef.current?.click()}>Import Backup</SecondaryButton></CardStack></SectionCard>
      <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Reset App</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Remove your profile, plan, current week, workout logs, week summaries, and settings from this device.</p><PrimaryButton onClick={resetApp}>Reset App</PrimaryButton></CardStack></SectionCard>
      <SettingsCard title="About">Life-Fit Running Coach stores your data locally on this device.</SettingsCard>
    </CardStack>
    <StatCard label="Version" value="0.8.0" detail="Pass 8 week closeout and export tools" />
    <p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Build target: GitHub Pages</p>
  </PageStack>;
}
function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) { return <SectionCard><h3 style={{ ...typography.h3, margin: 0 }}>{title}</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>{children}</p></SectionCard>; }
function ActionCard({ title, text, action, onClick, disabled }: { title: string; text: string; action: string; onClick: () => void; disabled?: boolean }) { return <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>{title}</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{text}</p><SecondaryButton onClick={onClick} disabled={disabled}>{action}</SecondaryButton></CardStack></SectionCard>; }
function clearApp() { removeStorageValue(storageKeys.profile); removeStorageValue(storageKeys.plan); removeStorageValue(storageKeys.currentWeek); removeStorageValue(storageKeys.workoutLogs); removeStorageValue(storageKeys.settings); removeStorageValue(storageKeys.weeklyPlanner); removeStorageValue(storageKeys.weekSummaries); removeStorageValue(storageKeys.pendingSync); }
function parseBackup(raw: string): BackupPayload | null { try { const value = JSON.parse(raw) as Partial<BackupPayload>; if (!('profile' in value) || !('plan' in value) || !Array.isArray(value.workoutLogs) || !value.plannerState || !Array.isArray(value.weekSummaries)) return null; return value as BackupPayload; } catch { return null; } }
