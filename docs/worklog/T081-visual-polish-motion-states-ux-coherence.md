# T081 - Visual Polish, Motion, States, and UX Coherence

## 1. Task summary

Усилить общий Experience UI для inline feedback после продуктовых действий: `+VDI`, `+XP`, quest advanced, gate failed, mission blocked and artifact accepted должны выглядеть единообразно, с аккуратным motion contract и без изменения runtime truth.

## 2. Repo context discovered

- `experience-ui.tsx` уже содержит shell, cards, panels, progress, chips, state blocks and skeletons.
- `ExperienceGlobalHud` теперь показывает runtime feedback, но inline feedback states пока не вынесены в общий primitive.
- T069 уже закрыл loading/empty/error/skeleton primitives, поэтому T081 должен быть узким визуальным increment.

## 3. Files inspected

- `apps/electron/src/renderer/components/workbench/experience-ui.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx`
- `apps/electron/src/renderer/components/workbench/ExperienceGlobalHud.tsx`

## 4. Tests added first

- Add component tests for inline feedback state variants, reduced-motion support, compact wrapping, and Command/Game/Arena tone separation.

## 5. Expected failing test output

Red run:

```text
Export named 'ExperienceFeedbackStrip' not found in module .../experience-ui.tsx
```

## 6. Implementation changes

- Added `ExperienceFeedbackStrip` shared primitive with state variants for `vdi`, `xp`, `quest_advanced`, `gate_failed`, `mission_blocked`, and `artifact_accepted`.
- Added tone separation via `data-feedback-tone` for Command/Game/Arena presentation without changing runtime truth.
- Added motion-safe and reduced-motion classes for positive feedback while preserving accessibility with `role="status"` and `aria-live="polite"`.
- Added compact-width protections: `max-w-full`, `min-w-0`, `flex-wrap`, and `break-words`.
- Integrated the feedback strip into `ExperienceGlobalHud` for app-wide inline feedback after runtime actions.

## 7. Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx`
- `bun test apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx`
- `bun test apps/electron/src/renderer/components/workbench`
- `bun run typecheck:all`
- `bun run validate:docs`
- `bun run lint`
- `bun run electron:build`
- `git diff --check`

## 8. Passing test output summary

- Targeted polish test: `5 pass`, `0 fail`, `52 expect() calls`.
- Targeted polish + HUD tests: `8 pass`, `0 fail`, `69 expect() calls`.
- Full workbench component suite: `76 pass`, `0 fail`, `397 expect() calls`.
- `bun run typecheck:all`: pass.

## 9. Build output summary

- `bun run validate:docs`: pass, including agent contract, architecture docs, and sync design validation.
- `bun run lint`: pass with three pre-existing React hook dependency warnings outside T081 scope.
- `bun run electron:build`: pass with pre-existing renderer chunk-size warnings.
- `git diff --check`: pass.

## 10. Remaining risks

- Screenshot/manual visual pass remains in T087 final RC evidence.
- This ticket only adds shared visual primitives; it does not change runtime event semantics.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Inline feedback variants covered | Pass | `experience-ui-polish.test.tsx` |
| Motion-safe/reduced-motion classes covered | Pass | `experience-ui-polish.test.tsx` |
| Compact text overflow protections covered | Pass | `experience-ui-polish.test.tsx` |
| Command/Game/Arena tones do not mutate truth | Pass | Tone is presentational `data-feedback-tone`; HUD truth invariance remains covered |
| Worklog complete | Pass | This file |
| Commit exists | Pass | Scoped Lore commit for T081 |
