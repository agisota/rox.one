# T125 - Composer Toolbar Keyboard Access

Status: DONE

## Context

The composer product-mode picker is now a custom listbox-style control. It has mouse behavior and explanatory labels, but keyboard navigation is still incomplete for power-user and accessibility workflows.

## Goal

Make the composer mode picker work predictably with keyboard controls while preserving the existing action-button behavior and local artifact flow.

## Required UI

- Mode picker opens from keyboard navigation.
- `ArrowDown`, `ArrowUp`, `Home`, and `End` move the active mode through the visible mode order.
- `Enter` and `Space` select the active mode while the listbox is open.
- `Escape` closes the picker and returns focus to the picker button.
- The custom listbox exposes active-option state through ARIA hooks.

## Required Data/API

No new data model or API. The change stays inside the renderer composer toolbar contract.

## Required Automations

No new automations.

## Required Subagents

None for this scoped slice; the relevant files and tests are already localized.

## TDD Requirements

- Add contract tests for mode keyboard target resolution.
- Add static-render checks for the improved picker ARIA contract.
- Run targeted tests and confirm the new helper test fails before implementation.

## Implementation Requirements

Implement the smallest toolbar change that passes the contract tests. Do not add dependencies.

## Validation Commands

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts packages/shared/src/workbench/__tests__/experience-state-binding.test.ts packages/shared/src/workbench/__tests__/mission-mode-prompt-registry.test.ts`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run lint:i18n:sorted`
- `bun run lint:i18n:parity`
- `bun run lint:i18n:coverage`
- `bun run electron:build`
- `bun run electron:smoke`

## Acceptance Criteria

- [x] Keyboard target resolution is covered by tests.
- [x] Picker markup exposes a stable listbox active-option contract.
- [x] Existing composer action behavior is unchanged.
- [x] Relevant validation passes.
- [x] Build and smoke pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T125-composer-toolbar-keyboard-access.md`.
