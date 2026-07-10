import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, HeroTitle, PageStack, PrimaryButton, SectionCard, SecondaryButton, SlidePanel, StatCard, TextInput } from '../components/ui';
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
  const [panel, setPanel] = useState<string | null>(null);
  const [name, setName] = useState(athleteName);
  const [raceDate, setRaceDate] = useState(plan?.summary.raceDate ?? '');
  const [raceGoal, setRaceGoal] = useState(profile?.raceGoal?.goalDescription ?? '');
  const [runsPerWeek, setRunsPerWeek] = useState('');


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

  function saveProfileName() { if (profile) writeStorageValue(storageKeys.profile, { ...profile, name, updatedAt: new Date().toISOString() }); setPanel(null); }
  function savePlanEdit() { if (profile) writeStorageValue(storageKeys.profile, { ...profile, raceGoal: { ...profile.raceGoal, raceDate, goalDescription: raceGoal }, updatedAt: new Date().toISOString() }); setPanel(null); }

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
    <HeroTitle eyebrow="Settings" title="Simple and calm">Athlete settings stay focused. Coach and developer tools are tucked away.</HeroTitle>
    <CardStack>{['Profile','Help','About Life-Fit'].map((item) => <button key={item} type="button" onClick={() => setPanel(item)} style={settingsButton}>{item}<span>→</span></button>)}</CardStack>
    <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>Advanced</h3><SecondaryButton onClick={() => setPanel('Advanced')}>Coach & Developer Tools</SecondaryButton></CardStack></SectionCard>
    <SlidePanel isOpen={Boolean(panel)} title={panel ?? 'Settings'} onClose={() => setPanel(null)}><CardStack>
      {panel === 'Profile' ? <><TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Edit Name" /><PrimaryButton onClick={saveProfileName}>Save Name</PrimaryButton><SecondaryButton onClick={() => setPanel('plan')}>Edit Future Plan</SecondaryButton></> : null}
      {panel === 'Help' ? <SettingsCard title="Help">Planning support is coming soon. For now, follow the plan, move sessions around real life, and keep easy days easy.</SettingsCard> : null}
      {panel === 'About Life-Fit' ? <><StatCard label="Version" value="0.9.0" detail="Planning Engine UX" /><SettingsCard title="Training Philosophy">Build your fitness over the week, not by forcing life into a calendar.</SettingsCard><SettingsCard title="Privacy">Your profile, plan, workout notes, and backups are stored locally on this device unless you export them.</SettingsCard><SettingsCard title="Credits">Life-Fit Running Coach planning engine and Calm Coach interface.</SettingsCard></> : null}
      {panel === 'Advanced' ? <CardStack>{['Coach Sync','Export Coach Report','Export Full Plan','Export Backup','Import Backup','Engine Lab','Reset App','Developer Information'].map((item) => <button key={item} type="button" onClick={() => item === 'Engine Lab' ? navigate('/engine-lab') : setPanel(item)} style={settingsButton}>{item}<span>→</span></button>)}</CardStack> : null}
      {panel === 'plan' ? <><p style={{ ...typography.small, color: colors.accent.amber, margin: 0 }}>This only updates future plan details. Completed history is kept.</p><TextInput type="date" value={raceDate} onChange={(e) => setRaceDate(e.currentTarget.value)} /><TextInput placeholder="Race goal" value={raceGoal} onChange={(e) => setRaceGoal(e.currentTarget.value)} /><TextInput placeholder="Realistic runs per week" inputMode="numeric" value={runsPerWeek} onChange={(e) => setRunsPerWeek(e.currentTarget.value)} /><PrimaryButton onClick={savePlanEdit}>Save</PrimaryButton></> : null}
      {panel === 'Coach Sync' ? <><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Send weekly summaries to your coach.</p><TextInput value={coachReportLink} onChange={(event) => setCoachReportLink(event.currentTarget.value)} placeholder="Paste your coach report link" inputMode="url" /><PrimaryButton onClick={saveCoachSync}>Save</PrimaryButton><SecondaryButton onClick={testCoachSync}>Test Connection</SecondaryButton><SecondaryButton onClick={clearCoachSync}>Clear</SecondaryButton><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Pending coach reports: {pendingReports}</p><SecondaryButton onClick={retryReports} disabled={!pendingReports}>Retry Pending Reports</SecondaryButton><SecondaryButton onClick={clearReports} disabled={!pendingReports}>Clear Pending Reports</SecondaryButton>{coachSyncMessage ? <p style={{ ...typography.small, color: colors.primary.green, margin: 0 }}>{coachSyncMessage}</p> : null}</> : null}
      {panel === 'Export Full Plan' ? <ActionCard title="Export Full Plan" text="Download every planned workout as CSV." action="Export Full Plan" onClick={exportPlan} disabled={!plan} /> : null}
      {panel === 'Export Coach Report' ? <ActionCard title="Export Coach Report" text="Download logs and summaries." action="Export Coach Report" onClick={exportCoachReport} disabled={!plan} /> : null}
      {panel === 'Export Backup' ? <ActionCard title="Export Backup" text="Download a JSON backup." action="Export Backup" onClick={exportBackup} /> : null}
      {panel === 'Import Backup' ? <><input ref={fileRef} type="file" accept="application/json,.json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) importBackup(file); }} style={{ display: 'none' }} /><SecondaryButton onClick={() => fileRef.current?.click()}>Import Backup</SecondaryButton></> : null}
      {panel === 'Reset App' ? <><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>Remove all local app data from this device.</p><PrimaryButton onClick={resetApp}>Reset App</PrimaryButton></> : null}
      {panel === 'Developer Information' ? <SettingsCard title="Developer Information">Local storage keys, exports, and engine lab are for support and debugging.</SettingsCard> : null}
    </CardStack></SlidePanel>
  </PageStack>;
}
function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) { return <SectionCard><h3 style={{ ...typography.h3, margin: 0 }}>{title}</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: `${spacing.xs}px 0 0` }}>{children}</p></SectionCard>; }
function ActionCard({ title, text, action, onClick, disabled }: { title: string; text: string; action: string; onClick: () => void; disabled?: boolean }) { return <SectionCard><CardStack><h3 style={{ ...typography.h3, margin: 0 }}>{title}</h3><p style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{text}</p><SecondaryButton onClick={onClick} disabled={disabled}>{action}</SecondaryButton></CardStack></SectionCard>; }
function clearApp() { removeStorageValue(storageKeys.profile); removeStorageValue(storageKeys.plan); removeStorageValue(storageKeys.currentWeek); removeStorageValue(storageKeys.workoutLogs); removeStorageValue(storageKeys.settings); removeStorageValue(storageKeys.weeklyPlanner); removeStorageValue(storageKeys.weekSummaries); removeStorageValue(storageKeys.pendingSync); }
function parseBackup(raw: string): BackupPayload | null { try { const value = JSON.parse(raw) as Partial<BackupPayload>; if (!('profile' in value) || !('plan' in value) || !Array.isArray(value.workoutLogs) || !value.plannerState || !Array.isArray(value.weekSummaries)) return null; return value as BackupPayload; } catch { return null; } }

const settingsButton = { ...typography.button, display: 'flex', justifyContent: 'space-between', width: '100%', border: `1px solid ${colors.neutral.border}`, borderRadius: 18, padding: spacing.md, background: colors.neutral.surface, color: colors.neutral.text } as const;
const linkButton = { ...typography.caption, border: 0, background: 'transparent', color: colors.primary.green, textDecoration: 'underline', cursor: 'pointer' } as const;
