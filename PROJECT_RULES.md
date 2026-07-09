# Life-Fit Running Coach Project Rules

## Project philosophy
Life-Fit Running Coach is a mobile-first Progressive Web App that feels like a calm running coach in your pocket. It should be clean, premium, friendly, encouraging, simple, warm, and confident. It must never feel intimidating, cluttered, data-heavy, or like Garmin, TrainingPeaks, Excel, or a Material Design demo.

## UI philosophy
- Primary target width is iPhone-sized: 390–430px.
- Desktop is only a centred mobile preview; do not create desktop-first layouts.
- Screens should be quiet, warm, and easy to scan.
- Use the permanent design system in `src/design/` for all colours, spacing, typography, radii, shadows, animation, icons, and theme values.
- Do not introduce magic values in components or pages.
- Use white cards over a very light warm grey background.
- Use primary green sparingly for primary actions, success, completed states, and progress.
- Use semantic accent colours consistently: sky blue for information/recovery/Zone 2, purple for threshold/quality, orange for long runs/energy, amber for warnings, and red for errors only.
- Keep shadows subtle and Apple-like.
- Keep animations fast and small: card press, button press, complete workout tick, and page transition only.

## Coding rules
- Do not redesign, restructure, or refactor the existing project unless a pass explicitly asks for it.
- Do not redesign existing routing.
- Do not add business logic unless explicitly requested.
- Do not implement training engine logic, onboarding, drag/drop, analytics, charts, or AI unless a future pass explicitly asks for them.
- Build reusable UI from `src/components/ui/` and design tokens from `src/design/`.
- Avoid duplicated styling.
- Avoid inline colours and hardcoded spacing; import tokens instead.
- Keep components mobile-first and accessible.
- Never put try/catch blocks around imports.

## Future pass rules
- Every future page and component must reuse the locked design system.
- Preserve the calm running coach design language.
- Add only the scope requested by the pass.
- Do not invent additional features.
- Hidden `/design-system` remains the reference page for validating UI consistency.

## Definition of Done
A pass is done only when:
- The requested scope is implemented and no future-pass work is added.
- Routing still works and placeholder pages remain intact unless explicitly changed.
- The project builds successfully.
- New UI uses design tokens and shared components.
- The design-system preview reflects any new reusable component patterns.

## Definition of No Drift
No Drift means the product continues to look and feel like the locked design language:
- Calm, premium, warm, friendly, and simple.
- Mobile-first at 390–430px with desktop as a centred preview.
- No heavy dashboards, dense tables, chart-first screens, floating menus, or intimidating performance language.
- No one-off colours, spacing, radii, shadows, or animations outside `src/design/`.
