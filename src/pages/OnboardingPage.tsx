import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardStack, HeroTitle, PrimaryButton, ProgressBar, SecondaryButton, SectionCard, TextInput } from '../components/ui';
import { colors, radius, spacing, typography } from '../design';
import { generateTrainingPlan } from '../engine/planGenerator';
import type { GoalType, PlanGeneratorInput, RaceType } from '../engine/planTypes';
import type { AthleteProfile, MilestoneRace } from '../engine/types';
import { storageKeys, writeStorageValue } from '../utils/storage';

const raceOptions: Array<{ label: string; value: RaceType }> = [
  { label: '5 km', value: '5k' },
  { label: '10 km', value: '10k' },
  { label: '15 km', value: '15k' },
  { label: 'Half Marathon', value: 'half_marathon' },
  { label: 'Marathon', value: 'marathon' },
];

const goalOptions: Array<{ label: string; value: GoalType }> = [
  { label: 'First Race', value: 'first_race' },
  { label: 'Finish Comfortably', value: 'finish_comfortably' },
  { label: 'Personal Best', value: 'personal_best' },
  { label: 'Race Competitively', value: 'race_competitively' },
];

const runsPerWeekOptions: PlanGeneratorInput['runsPerWeek'][] = [3, 4, 5, 6];
const totalSteps = 9;
const inputStyle = { ...typography.body, width: '100%', boxSizing: 'border-box' as const, minHeight: 56, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.input, padding: spacing.md, color: colors.neutral.text, background: colors.neutral.surface };
const fieldLabelStyle = { ...typography.caption, color: colors.neutral.muted, margin: 0, textTransform: 'uppercase' as const };
const errorStyle = { ...typography.small, color: colors.accent.red, margin: 0 };

type FormState = {
  name: string;
  raceDistance?: RaceType;
  raceDate: string;
  goal?: GoalType;
  currentWeeklyKm: number;
  longestRunKm: number;
  runsPerWeek?: PlanGeneratorInput['runsPerWeek'];
  milestones: MilestoneRace[];
  milestoneDistance: RaceType;
  milestoneDate: string;
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>({
    name: '',
    raceDate: '',
    currentWeeklyKm: 35,
    longestRunKm: 19,
    milestones: [],
    milestoneDistance: 'half_marathon',
    milestoneDate: '',
  });

  const progress = useMemo(() => ((step + 1) / totalSteps) * 100, [step]);

  function updateForm(next: Partial<FormState>) {
    setForm((current) => ({ ...current, ...next }));
    setError('');
  }

  function validateCurrentStep() {
    if (step === 0 && !form.name.trim()) return 'Tell me what to call you so your plan feels personal.';
    if (step === 1 && !form.raceDistance) return 'Choose the race distance you are training for.';
    if (step === 2) {
      if (!form.raceDate) return 'Choose your race day.';
      if (!isFutureDate(form.raceDate)) return 'Race day needs to be in the future.';
    }
    if (step === 3 && !form.goal) return 'Choose the goal that feels most honest right now.';
    if (step === 4 && form.currentWeeklyKm < 5) return 'Current weekly running needs to be at least 5 km.';
    if (step === 5 && form.longestRunKm > form.currentWeeklyKm * 0.8) return 'That long run is a little high for your weekly volume. Choose a calmer recent long run.';
    if (step === 6 && !form.runsPerWeek) return 'Choose at least 3 days so the plan has room to breathe.';
    return '';
  }

  function nextStep() {
    const message = validateCurrentStep();
    if (message) {
      setError(message);
      return;
    }
    setStep((current) => Math.min(totalSteps - 1, current + 1));
  }

  function addMilestone() {
    if (!form.milestoneDate) {
      setError('Choose a milestone race date, or tap Done to skip this step.');
      return;
    }
    if (!isFutureDate(form.milestoneDate)) {
      setError('Milestone races need to be in the future.');
      return;
    }
    const option = raceOptions.find((race) => race.value === form.milestoneDistance);
    updateForm({
      milestones: [...form.milestones, { id: `milestone-${Date.now()}`, name: `${option?.label ?? 'Milestone'} milestone`, date: form.milestoneDate, distance: form.milestoneDistance }],
      milestoneDate: '',
    });
  }

  function finishOnboarding() {
    const message = validateAll(form);
    if (message) {
      setError(message);
      return;
    }

    const now = new Date().toISOString();
    const profile: AthleteProfile = {
      id: `athlete-${form.name.trim().toLowerCase().replace(/\s+/g, '-')}`,
      name: form.name.trim(),
      currentWeeklyVolume: form.currentWeeklyKm,
      raceGoal: { distance: form.raceDistance!, raceDate: form.raceDate, goalDescription: goalOptions.find((goal) => goal.value === form.goal)?.label },
      milestoneRaces: form.milestones,
      createdAt: now,
      updatedAt: now,
    };
    const plan = generateTrainingPlan({
      athleteName: profile.name!,
      raceDistance: form.raceDistance!,
      raceDate: form.raceDate,
      raceGoal: goalOptions.find((goal) => goal.value === form.goal)?.label ?? 'Finish Comfortably',
      currentWeeklyKm: form.currentWeeklyKm,
      longestRunKm: form.longestRunKm,
      runsPerWeek: form.runsPerWeek!,
      milestoneRaces: form.milestones.map((race) => ({ name: race.name, date: race.date, distance: race.distance as RaceType })),
      currentDate: todayIso(),
    });
    const currentWeek = plan.weeks.find((week) => todayIso() >= week.startsOn && todayIso() <= week.endsOn) ?? plan.weeks[0];

    writeStorageValue(storageKeys.profile, profile);
    writeStorageValue(storageKeys.plan, plan);
    writeStorageValue(storageKeys.currentWeek, currentWeek);
    navigate('/plan-summary', { replace: true });
  }

  return (
    <SectionCard>
      <CardStack>
        <ProgressBar value={progress} />
        {renderStep({ step, form, updateForm, addMilestone, error, nextStep })}
        {error ? <p style={errorStyle}>{error}</p> : null}
        {step < totalSteps - 1 ? <PrimaryButton onClick={nextStep}>Next</PrimaryButton> : <PrimaryButton onClick={finishOnboarding}>Let&apos;s Get Fit</PrimaryButton>}
      </CardStack>
    </SectionCard>
  );
}

function renderStep({ step, form, updateForm, addMilestone, error, nextStep }: { step: number; form: FormState; updateForm: (next: Partial<FormState>) => void; addMilestone: () => void; error: string; nextStep: () => void }) {
  if (step === 0) return <><HeroTitle eyebrow="Question 1 of 8" title="What should I call you?" /><TextInput placeholder="Lauren" value={form.name} onChange={(event) => updateForm({ name: event.currentTarget.value })} /></>;
  if (step === 1) return <ChoiceStep eyebrow="Question 2 of 8" title="What are we training for?" options={raceOptions} selected={form.raceDistance} onSelect={(value) => updateForm({ raceDistance: value })} />;
  if (step === 2) return <><HeroTitle eyebrow="Question 3 of 8" title="When is race day?" /><input aria-label="Race day" type="date" value={form.raceDate} onChange={(event) => updateForm({ raceDate: event.currentTarget.value })} style={inputStyle} /></>;
  if (step === 3) return <ChoiceStep eyebrow="Question 4 of 8" title="What is your goal?" options={goalOptions} selected={form.goal} onSelect={(value) => updateForm({ goal: value })} />;
  if (step === 4) return <SliderStep eyebrow="Question 5 of 8" title="How many kilometres do you currently run each week?" value={form.currentWeeklyKm} min={5} max={120} unit="km" onChange={(value) => updateForm({ currentWeeklyKm: value })} />;
  if (step === 5) return <SliderStep eyebrow="Question 6 of 8" title="What is the longest run you've completed in the last four weeks?" value={form.longestRunKm} min={3} max={40} unit="km" onChange={(value) => updateForm({ longestRunKm: value })} />;
  if (step === 6) return <ChoiceStep eyebrow="Question 7 of 8" title="Realistically..." body="How many days each week can you run?" options={runsPerWeekOptions.map((value) => ({ label: String(value), value }))} selected={form.runsPerWeek} onSelect={(value) => updateForm({ runsPerWeek: value })} />;
  if (step === 7) return <><HeroTitle eyebrow="Question 8 of 8" title="Do you have any milestone races before your goal race?">Optional. Add one if it matters, or tap Done.</HeroTitle><label style={fieldLabelStyle}>Distance</label><select value={form.milestoneDistance} onChange={(event) => updateForm({ milestoneDistance: event.currentTarget.value as RaceType })} style={inputStyle}>{raceOptions.map((race) => <option key={race.value} value={race.value}>{race.label}</option>)}</select><label style={fieldLabelStyle}>Date</label><input aria-label="Milestone race date" type="date" value={form.milestoneDate} onChange={(event) => updateForm({ milestoneDate: event.currentTarget.value })} style={inputStyle} /><SecondaryButton onClick={addMilestone}>Add milestone race</SecondaryButton>{form.milestones.map((race) => <p key={race.id} style={{ ...typography.small, color: colors.neutral.muted, margin: 0 }}>{race.name} · {race.date}</p>)}<PrimaryButton onClick={nextStep}>Done</PrimaryButton>{error ? null : null}</>;
  return <HeroTitle title="Perfect.">I&apos;ve got everything I need.<br />I&apos;ll build your personalised plan using evidence-based coaching principles.</HeroTitle>;
}

function ChoiceStep<T extends string | number>({ eyebrow, title, body, options, selected, onSelect }: { eyebrow: string; title: string; body?: string; options: Array<{ label: string; value: T }>; selected?: T; onSelect: (value: T) => void }) {
  return <><HeroTitle eyebrow={eyebrow} title={title}>{body}</HeroTitle>{options.map((option) => selected === option.value ? <PrimaryButton key={option.label} onClick={() => onSelect(option.value)}>{option.label}</PrimaryButton> : <SecondaryButton key={option.label} onClick={() => onSelect(option.value)}>{option.label}</SecondaryButton>)}</>;
}

function SliderStep({ eyebrow, title, value, min, max, unit, onChange }: { eyebrow: string; title: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return <><HeroTitle eyebrow={eyebrow} title={title} /><p style={{ ...typography.h2, color: colors.neutral.text, margin: 0 }}>{value} {unit}</p><input aria-label={title} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} /></>;
}

function isFutureDate(date: string) {
  return date > todayIso();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function validateAll(form: FormState) {
  if (!form.name.trim()) return 'Tell me what to call you so your plan feels personal.';
  if (!form.raceDistance) return 'Choose the race distance you are training for.';
  if (!form.raceDate) return 'Choose your race day.';
  if (!isFutureDate(form.raceDate)) return 'Race day needs to be in the future.';
  if (!form.goal) return 'Choose your goal.';
  if (form.currentWeeklyKm < 5) return 'Current weekly running needs to be at least 5 km.';
  if (form.longestRunKm > form.currentWeeklyKm * 0.8) return 'That long run is a little high for your weekly volume.';
  if (!form.runsPerWeek || form.runsPerWeek < 3) return 'Choose at least 3 days each week.';
  return '';
}
