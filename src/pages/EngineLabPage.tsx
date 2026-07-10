import { useMemo, useState } from 'react';
import { evaluateEngineHealth } from '../engine/engineHealth';
import { generateTrainingPlan } from '../engine/planGenerator';
import type { PlanGeneratorInput, RaceType } from '../engine/planTypes';

const currentDate = '2026-07-10';
const races: RaceType[] = ['5k', '10k', '15k', 'half_marathon', 'marathon'];
const goals = ['First Race', 'Finish Comfortably', 'Personal Best', 'Race Competitively'];
const weeklyOptions = [12, 20, 28, 35, 45, 58, 72];
const runOptions: Array<3 | 4 | 5 | 6> = [3, 4, 5, 6];

export function EngineLabPage() {
  const [seed, setSeed] = useState(1);
  const cases = useMemo(() => Array.from({ length: 10 }, (_, index) => makeCase(seed * 31 + index)), [seed]);
  const results = cases.map((input, index) => {
    const plan = generateTrainingPlan(input);
    return { input, plan, health: evaluateEngineHealth(plan, `LAB-${index + 1}`) };
  });

  function downloadCsv() {
    const header = ['caseId','raceDistance','raceGoal','weeksToRace','currentWeeklyKm','longestRunKm','runsPerWeek','peakLongRunKm','targetPeakLongRunMin','targetPeakLongRunMax','longRunTargetMet','peakWeeklyKm','targetPeakWeeklyKmMin','targetPeakWeeklyKmMax','weeklyVolumeTargetMet','engineScore','engineGrade','warnings','issues'];
    const rows = results.map(({ plan, health }) => [health.caseId,health.raceDistance,health.raceGoal,String(health.weeksToRace),String(health.currentWeeklyKm),String(health.longestRunKm),String(health.runsPerWeek),String(health.peakLongRunKm),String(health.targetPeakLongRunMin),String(health.targetPeakLongRunMax),String(health.longRunTargetMet),String(health.peakWeeklyKm),String(health.targetPeakWeeklyKmMin),String(health.targetPeakWeeklyKmMax),String(health.weeklyVolumeTargetMet),String(health.engineScore),health.engineGrade,plan.warnings.map((warning) => warning.message).join(' | '),health.issues]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'engine-lab.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Engine Lab</h1><p className="text-sm text-slate-600">Hidden developer stress test for random training plans.</p></div>
        <div className="flex gap-2"><button className="rounded bg-slate-900 px-4 py-2 text-white" onClick={() => setSeed((value) => value + 1)}>Randomise 10 Plans</button><button className="rounded border border-slate-300 px-4 py-2" onClick={downloadCsv}>Download CSV</button></div>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        {results.map(({ input, plan, health }) => (
          <article key={health.caseId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between"><div><h2 className="font-semibold">{health.caseId}: {input.raceDistance} / {input.raceGoal}</h2><p className="text-sm text-slate-600">{health.weeksToRace} weeks · {input.currentWeeklyKm} km/wk · long {input.longestRunKm} km · {input.runsPerWeek} runs/wk</p></div><span className="rounded bg-slate-100 px-2 py-1 text-sm font-semibold">{health.engineScore} {health.engineGrade}</span></div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-slate-500">Peak long run</dt><dd>{health.peakLongRunKm} km vs {health.targetPeakLongRunMin}-{health.targetPeakLongRunMax} km</dd></div><div><dt className="text-slate-500">Peak weekly</dt><dd>{health.peakWeeklyKm} km vs {health.targetPeakWeeklyKmMin}-{health.targetPeakWeeklyKmMax} km</dd></div></dl>
            <p className="mt-3 text-sm text-amber-700">{[...plan.warnings.map((warning) => warning.message), health.issues].filter(Boolean).join(' | ') || 'No warnings or issues.'}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function makeCase(seed: number): PlanGeneratorInput {
  const raceDistance = pick(races, seed);
  const raceGoal = pick(goals, seed + 3);
  const weeks = 6 + (seed * 7) % 23;
  const currentWeeklyKm = pick(weeklyOptions, seed + 5);
  const longestRunKm = Math.max(3, Math.round(currentWeeklyKm * (0.25 + ((seed % 5) * 0.08))));
  return { athleteName: `Lab Athlete ${seed}`, raceDistance, raceGoal, raceDate: addDays(currentDate, weeks * 7 - 2), currentWeeklyKm, longestRunKm, runsPerWeek: pick(runOptions, seed + 9), currentDate };
}
function pick<T>(items: T[], seed: number): T { return items[Math.abs(seed) % items.length]; }
function addDays(isoDate: string, days: number) { const date = new Date(`${isoDate}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function csvEscape(value: string) { return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value; }
