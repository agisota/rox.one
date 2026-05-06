# T080 - Global Experience HUD + App-Wide Integration

## 1. Task summary

Сделать Experience видимым во всем продукте через компактный HUD и связать ключевые composer actions с typed Experience events, чтобы Prompt Lab, Spec Builder, TDD Plan и Review Gate двигали общий runtime truth, а не оставались локальными preview panels.

## 2. Repo context discovered

- `ExperienceRuntimeStore` уже хранит события, notifications, metrics, quests, ledger, missions and gates.
- `MainContentPanel` является общей точкой для sessions, settings, skills, automations and workbench route content.
- Experience screens уже принимают `truthState`, но app shell не показывает cross-cutting runtime summary.
- `composer-artifact-flow.ts` уже создает локальные preview states for Prompt Lab, TDD Plan, Review Gate and Spec Builder, но не выпускает Experience events.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx`
- `apps/electron/src/renderer/components/app-shell/Panel.tsx`
- `apps/electron/src/renderer/components/app-shell/input/composer-artifact-flow.ts`
- `apps/electron/src/renderer/components/workbench/experience-ui.tsx`
- `apps/electron/src/renderer/components/workbench/WorkbenchRoutePage.tsx`
- `packages/shared/src/workbench/experience-runtime-store.ts`

## 4. Tests added first

- HUD component/state tests requiring runtime-derived VDI, readiness, active mission, next quest, blockers, XP/level, latest notification, mode-invariant truth values, and compact-safe wrapping classes.
- Composer artifact flow tests requiring typed Experience events for prompt rewrite, spec compile, TDD plan, and review failure.

## 5. Expected failing test output

Red run:

```text
Cannot find module '../ExperienceGlobalHud'
Export named 'createExperienceEventsForComposerArtifact' not found in module .../composer-artifact-flow.ts
```

## 6. Implementation changes

- Added `ExperienceGlobalHud` with runtime-derived VDI, readiness, quality, mission status, next quest, blockers, XP/level, and priority notification state.
- Added `createExperienceGlobalHudState()` projection over `ExperienceRuntimeState`.
- Added compact-safe HUD markup using wrapping and `min-w-0`/`max-w-full` constraints.
- Added composer artifact event bridge:
  - Prompt Lab emits `prompt.submitted` and `prompt.rewritten`.
  - Spec Builder emits `spec.compiled`.
  - TDD Plan emits `tdd.plan.created`.
  - Review Gate emits `review.completed` plus blocking `gate.failed` or warning `gate.warned` where applicable.
- Added HUD to the shared `MainContentPanel` wrapper so app surfaces receive cross-cutting Experience feedback.

## 7. Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts`
- `bun test apps/electron/src/renderer/components/workbench apps/electron/src/renderer/components/app-shell/input`
- `bun run typecheck:all`
- `bun run validate:docs`
- `bun run lint`
- `bun run electron:build`
- `git diff --check`

## 8. Passing test output summary

- Targeted T080 tests: `11 pass`, `0 fail`, `44 expect() calls`.
- Workbench + app-shell input subset: `120 pass`, `0 fail`, `508 expect() calls`.
- `bun run typecheck:all`: pass.

## 9. Build output summary

- `bun run validate:docs`: pass, including agent contract, architecture docs, and sync design validation.
- `bun run lint`: pass with three pre-existing React hook dependency warnings outside T080 scope.
- `bun run electron:build`: pass with pre-existing renderer chunk-size warnings.
- `git diff --check`: pass.

## 10. Remaining risks

- T080 introduces the UI/event bridge but does not yet make every renderer click persist through a durable global store provider; broader E2E journey remains T082.
- Toast emission through `sonner` is not triggered from SSR tests; HUD exposes notification truth and inline feedback state.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| HUD reads from ExperienceRuntimeStore | Pass | `ExperienceGlobalHud` test replays typed events and renders runtime projection |
| Prompt rewrite advances quest | Pass | Composer event bridge test replays events into runtime quest progress |
| Spec compile advances quest | Pass | Composer event bridge test emits `spec.compiled` |
| Review failure shows blocker | Pass | Composer event bridge emits blocking `gate.failed`; HUD renders blocking gate |
| Command/Game/Arena modes show same truth values | Pass | HUD state mode-invariance test |
| No text overflow at compact widths | Pass | HUD markup test asserts wrapping/min-width-safe classes |
| Worklog complete | Pass | This file |
| Commit exists | Pass | Scoped Lore commit for T080 |
