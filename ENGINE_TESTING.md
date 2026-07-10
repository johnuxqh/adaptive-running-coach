# Training Engine Test Cases

## Why these cases exist

The plan generator can produce very different plans depending on race distance, runway, current fitness, long-run history, weekly frequency, race goal, and milestone races. The deterministic test-case export gives developers and coaches a broad review set without changing deployment, adding AI, or relying on external services.

The CSVs are intended for manual quality review. They make it easier to spot patterns such as too-aggressive progressions, inadequate long-run development, missing recovery weeks, or week structures that do not match the athlete's run frequency.

## How to run

```bash
npm run test:plans
```

The script generates around 100 deterministic plans and writes CSV files into `engine-test-output/`.

## Generated files

- `engine-test-output/plan-test-summary.csv` — one row per generated plan with athlete inputs, plan totals, peak volume, recovery/taper counts, and warnings.
- `engine-test-output/plan-test-weeks.csv` — one row per week with phase, week type, target km/time, key workout titles, workout counts, and week warnings.
- `engine-test-output/plan-test-workouts.csv` — one row per workout with category, type, title, suggested day, distance/time, intensity, and purpose.

## What to review

When opening the CSVs in a spreadsheet, review these quality signals:

1. **Race-specific long runs** — marathon plans should build toward meaningful long runs, and half-marathon plans should not peak too low.
2. **Safe weekly progression** — week-to-week target km should not jump sharply unless there is a clear recovery/taper context.
3. **Recovery and taper structure** — plans longer than 8 weeks should include recovery weeks, and the final week should be marked as race week.
4. **Workout count fit** — 3-run plans should not contain too many foundation workouts, and optional workouts should remain genuinely optional.
5. **Milestone handling** — milestone races should replace a key workout instead of adding an extra hard effort.
6. **Warnings** — suspicious-pattern console warnings are review prompts only; they do not fail the build yet.

## Downloading or sharing outputs

After running `npm run test:plans`, download or upload the CSV files from the `engine-test-output/` directory. The files are plain CSVs and can be opened in Excel, Numbers, Google Sheets, or uploaded to a review ticket.
