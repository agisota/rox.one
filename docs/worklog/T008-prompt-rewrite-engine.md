# T008 — Prompt Rewrite engine and diff modal

## 1. Task summary
Implemented a deterministic Prompt Rewrite MVP for the composer:
- typed rewrite request/output schemas
- fake deterministic provider and service abstraction
- rewrite history event factory with `mode::rewrite` and `artifact::prompt` labels
- composer rewrite flow helper
- modal dialog with original prompt, editable rewritten prompt, simple before/after diff, accept, retry, and send-to-Spec-Builder actions
- localized rewrite UI strings across all registered locales

No real LLM calls were added. Tests use only deterministic local provider behavior.

## 2. Repo context discovered
- T007 toolbar emitted `rox:product-mode-intent` but had no runtime consumer yet.
- `ProductModeRegistry` already declares `rewrite` with `prompt-rewriter-pack`, prompt artifacts, and validation gates.
- Renderer build must not import `@rox-agent/shared/workbench` index from browser code because the index also exports Node-only workspace bundle code that imports `fs/path`.
- Dialog UI can use existing Radix-based `Dialog` primitives and `ModalContext` registration.
- Locale parity tests require every locale to have identical keys and default JS `.sort()` key order.

## 3. Files inspected
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `apps/electron/src/renderer/components/app-shell/input/product-mode-toolbar.ts`
- `apps/electron/src/renderer/components/ui/dialog.tsx`
- `apps/electron/src/renderer/components/ResetConfirmationDialog.tsx`
- `apps/electron/src/renderer/components/shiki/ShikiDiffViewer.tsx`
- `packages/shared/src/workbench/product-mode-registry.ts`
- `packages/shared/src/automations/*` via read-only explorer summary
- `packages/shared/src/i18n/__tests__/locale-parity.test.ts` behavior via failing output

## 4. Tests added first
- `packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts`

Test coverage added:
- empty prompt validation
- malformed provider output validation
- deterministic build-ready rewrite acceptance criteria and verification plan
- service output validation
- rewrite history labels
- toolbar intent -> rewrite flow gating
- composer input -> rewrite request
- accept rewritten text
- rewrite output -> Spec Builder intent payload

## 5. Expected failing test output
Initial failing run before implementation:

```text
error: Cannot find module '../prompt-rewrite-engine'
error: Cannot find module '../prompt-rewrite-flow'
0 pass
2 fail
```

This was the expected TDD failure: the tests referenced the not-yet-implemented shared service and renderer flow helper.

## 6. Implementation changes
- Added `packages/shared/src/workbench/prompt-rewrite-engine.ts`.
- Exported the prompt rewrite engine from `packages/shared/src/workbench/index.ts` and direct package subpath `./workbench/prompt-rewrite-engine`.
- Added `apps/electron/src/renderer/components/app-shell/input/prompt-rewrite-flow.ts`.
- Added `apps/electron/src/renderer/components/app-shell/input/PromptRewriteDialog.tsx`.
- Wired `FreeFormInput` so `rewrite-prompt` still dispatches `rox:product-mode-intent` and also opens the local rewrite modal.
- Added all `workbench.rewrite.*` locale keys to `de`, `en`, `es`, `hu`, `ja`, `pl`, `ru`, and `zh-Hans`.
- Fixed renderer import to use `@rox-agent/shared/workbench/prompt-rewrite-engine` instead of the shared workbench index, avoiding Node-only exports in the browser bundle.

## 7. Validation commands run
- `bun install --frozen-lockfile`
- `bun test packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts`
- `bun test packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts packages/shared/src/i18n/__tests__/locale-parity.test.ts packages/shared/src/i18n/__tests__/locale-registry.test.ts packages/shared/src/i18n/__tests__/workbench-brand-localization.test.ts`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## 8. Passing test output summary
- Targeted T008 tests: `10 pass, 0 fail`.
- Expanded regression pack: `92 pass, 0 fail`.
- Typecheck shared: pass.
- Typecheck electron: pass.
- Agent contract validation: pass (`11 skills, 41 tickets, 7 required docs`).
- Architecture/docs validation: pass (`4 docs, 10 subsystem headings`).
- Whitespace check: pass.

## 9. Build output summary
- First `electron:build` failed during renderer build because `FreeFormInput` imported shared workbench index, which pulled Node-only `fs/path` exports into Vite.
- Fixed by importing prompt rewrite runtime from the new direct browser-safe subpath.
- Final `bun run electron:build`: pass. Main, preload, renderer, resources, and assets completed successfully.

## 10. Remaining risks
- The diff view is a simple before/after prompt comparison, not the full Shiki/MultiDiff overlay integration. This is acceptable for T008 because the user-visible modal and accept/spec-builder flow are working without adding heavier artifact plumbing.
- Rewrite event logging is currently a typed factory, not yet wired into the existing automation/history JSONL store. That belongs naturally with T019/T039 history/audit tasks or a future automation integration slice.
- The provider is deterministic and local by design; real provider routing remains a later integration concern.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Rewrite request/output schemas exist | PASS | `prompt-rewrite-engine.ts`, schema tests |
| Fake deterministic provider exists | PASS | `createDeterministicPromptRewriteProvider`, targeted tests |
| Service validates input/output | PASS | malformed provider output test |
| Rewrite button opens local rewrite flow | PASS | `FreeFormInput` consumes `rewrite-prompt` intent and opens `PromptRewriteDialog` |
| User can accept rewritten prompt into composer | PASS | `applyPromptRewriteAcceptance` test and `handlePromptRewriteAccept` wiring |
| User can send rewritten prompt to Spec Builder event | PASS | `createSpecBuilderIntentFromRewrite` test and dialog wiring |
| Error state exists | PASS | empty prompt flow opens modal error state |
| No real LLM calls in tests | PASS | deterministic provider only |
| Tests pass | PASS | 10/10 targeted, 92/92 regression pack |
| Build passes | PASS | `bun run electron:build` |
| Worklog complete | PASS | This file |
