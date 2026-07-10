import type { PlanTemplateDefinition } from './planTypes';

export interface PlanWarning {
  id: string;
  message: string;
  severity: 'info' | 'caution';
  weekNumber?: number;
}

export function createPlanWarnings(input: {
  weeks: number;
  template: PlanTemplateDefinition;
  longestRunKm: number;
  currentWeeklyKm: number;
  raceGoal: string;
}): PlanWarning[] {
  const warnings: PlanWarning[] = [];

  if (input.weeks < input.template.preferredWeeks) {
    warnings.push({
      id: 'short_runway',
      severity: 'caution',
      message: 'Race day is close, so this plan prioritises the safest useful gains rather than aggressive fitness building.',
    });
  }

  if (input.weeks > input.template.preferredWeeks) {
    warnings.push({
      id: 'extended_base',
      severity: 'info',
      message: 'Extra time before race day is used to extend the base phase and keep early progression controlled.',
    });
  }

  const longRunShare = input.currentWeeklyKm > 0 ? input.longestRunKm / input.currentWeeklyKm : 0;
  if (longRunShare < 0.28 && ['marathon', 'half_marathon'].includes(input.template.race)) {
    warnings.push({
      id: 'long_run_low_for_distance',
      severity: 'caution',
      message: 'Current long run is low for the selected distance, so long-run progression is capped and conservative.',
    });
  }

  if (input.raceGoal.toLowerCase().includes('personal best') && input.weeks < input.template.minimumWeeks) {
    warnings.push({
      id: 'ambitious_goal_short_runway',
      severity: 'caution',
      message: 'A personal-best goal with limited training runway is ambitious; use the plan as a safe preparation path, not a guarantee.',
    });
  }

  return warnings;
}

export function milestoneWarning(weekNumber: number): PlanWarning {
  return {
    id: `milestone_race_week_${weekNumber}`,
    severity: 'info',
    weekNumber,
    message: 'Milestone race replaces the long run or quality workout this week; avoid stacking extra hard running around it.',
  };
}
