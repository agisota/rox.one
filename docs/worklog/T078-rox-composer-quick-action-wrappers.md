# T078 ROX composer quick-action wrappers

## 1. Task summary

Convert the six composer quick controls from noisy in-app artifact entry points into deterministic prompt wrappers over the current user target, while preserving artifact screens as explicit secondary actions.

## 2. Repo context discovered

- `product-mode-toolbar.ts` defines the six quick controls and currently emits plain action-id intents.
- `FreeFormInput.tsx` handles those intents by opening `ComposerArtifactPanel` before any lightweight prompt flow can run.
- `composer-artifact-flow.ts` maps all six quick actions to artifact state.
- `prompt-rewrite-flow.ts` still treats Improve prompt as a dialog-opening intent.
- `ComposerArtifactPanel.tsx` needs an explicit secondary artifact intent for internal transitions.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/product-mode-toolbar.ts`
- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `apps/electron/src/renderer/components/app-shell/input/composer-artifact-flow.ts`
- `apps/electron/src/renderer/components/app-shell/input/composer-quick-action-flow.ts`
- `apps/electron/src/renderer/components/app-shell/input/ComposerArtifactPanel.tsx`
- `apps/electron/src/renderer/components/app-shell/input/prompt-rewrite-flow.ts`
- `apps/electron/src/renderer/components/workbench/ExperienceGlobalHud.tsx`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.send.rtl.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx`

## 4. Tests added first

- Added `composer-quick-action-flow.test.ts` before implementing the wrapper module.
- Updated `product-mode-toolbar.test.ts` to require `behavior: 'wrap-prompt'`, `wrapperId`, and `artifactKind`.
- Updated `composer-artifact-flow.test.ts` to assert default quick actions do not open artifacts and explicit `open-artifact` intents do.
- Updated `prompt-rewrite-flow.test.ts` to assert the legacy Prompt Rewrite dialog does not open for quick-action wrapper intents.
- Updated `freeform-input.send.rtl.test.tsx` to assert quick actions submit wrappers, follow-up context is valid, and workspace metadata alone is a no-op.
- Added `experience-global-hud.test.tsx` coverage that idle HUD does not invent an `Artifact accepted` chip.

## 5. Expected failing test output

Initial red run:

- `createOpenArtifactProductModeIntent` missing from `product-mode-toolbar.ts`.
- `composer-quick-action-flow` module missing.
- `shouldOpenPromptRewriteForIntent(createProductModeIntent('improve-prompt', ...))` still returned `true`.
- `createProductModeIntent` did not include `behavior`, `wrapperId`, or `artifactKind`.

## 6. Implementation changes

- Added `composer-quick-action-flow.ts` with deterministic wrapper generation for all six quick actions.
- Added explicit intent behavior: `wrap-prompt` for toolbar quick actions and `open-artifact` for secondary artifact paths.
- Changed `FreeFormInput` so quick actions build and submit a wrapper prompt through the existing `onSubmit` path.
- Quick action target resolution now accepts typed input, follow-up context, attachments, and enabled sources; `workingDirectory`, labels, and session status are context-only and do not validate an empty action.
- `composer-artifact-flow` now fails closed unless the intent is explicit `open-artifact` and the raw input is valid.
- `ComposerArtifactPanel` transitions now use `createOpenArtifactProductModeIntent`.
- Legacy `PromptRewriteDialog` no longer opens for quick-action wrapper intents.
- `ExperienceGlobalHud` no longer invents an idle `Artifact accepted` feedback chip when no artifact exists.

## 7. Validation commands run

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-quick-action-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/app-shell/input/__tests__/thinking-partner-flow.test.ts apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx`
- `~/.bun/bin/bunx vitest run --config vitest.config.ts src/renderer/components/app-shell/input/__tests__/freeform-input.send.rtl.test.tsx`
- `cd apps/electron && bun run typecheck`
- `cd apps/electron && bun run build:renderer`
- `git diff --check`

## 8. Passing test output summary

- Bun targeted tests: 39 passed, 0 failed, 164 assertions.
- FreeFormInput RTL: 8 passed, 0 failed.
- Typecheck: `tsc --noEmit` passed.

## 9. Build output summary

- `vite build` completed successfully.
- Existing warning remains: several chunks exceed 500 kB after minification.

## 10. Remaining risks

- Full app E2E in the installed `.app` was not rerun in this implementation pass.
- Explicit artifact screens still exist by design; they are now secondary paths, but broader UI disclosure work for menus/Experience navigation remains outside this ticket.
- Build chunk-size warnings are pre-existing and not addressed here.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Quick actions default to prompt wrappers | Pass | `product-mode-toolbar.test.ts`, `composer-quick-action-flow.test.ts` |
| Empty/invalid target does not open artifact or submit | Pass | `freeform-input.send.rtl.test.tsx`, `composer-quick-action-flow.test.ts` |
| Explicit secondary artifact path still works | Pass | `composer-artifact-flow.test.ts`, `composer-artifact-panel.test.tsx` |
| Legacy artifact routing fails closed | Pass | `composer-artifact-flow.test.ts` |
| Experience events are artifact-only | Pass | `composer-artifact-flow.test.ts`, `experience-global-hud.test.tsx` |
