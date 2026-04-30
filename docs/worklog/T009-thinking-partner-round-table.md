# T009 — Thinking Partner mode and Round Table screen

## 1. Task summary
Added a Thinking Partner execution path for the `Think With Me` composer action. The action now runs a deterministic Thinking Partner provider, opens a Round Table dialog, shows role/hypothesis/question/option cards, and can emit selected output to Spec Builder through a typed `craft:spec-builder-intent` event.

## 2. Repo context discovered
- Composer workflow actions are rendered by the product mode toolbar and dispatched through `craft:product-mode-intent` events.
- T008 established the preferred pattern for modal-first composer flows with a shared schema/service module, renderer flow helpers, deterministic test provider, and a dialog component.
- Renderer code must import runtime-safe shared modules through direct package subpaths to avoid pulling Node-only workspace helpers into the Vite bundle.
- UI routes were not needed for the MVP; a composer-owned modal follows the existing rewrite flow and keeps the change narrow.

## 3. Files inspected
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `apps/electron/src/renderer/components/app-shell/input/PromptRewriteDialog.tsx`
- `apps/electron/src/renderer/components/app-shell/input/prompt-rewrite-flow.ts`
- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`
- `packages/shared/src/workbench/prompt-rewrite-engine.ts`
- `packages/shared/package.json`
- `packages/shared/src/i18n/locales/*.json`

## 4. Tests added first
- `packages/shared/src/workbench/__tests__/thinking-partner.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/thinking-partner-flow.test.ts`

## 5. Expected failing test output
Initial TDD run failed before implementation for the expected missing modules:

```text
error: Cannot find module '../thinking-partner'
error: Cannot find module '../thinking-partner-flow'
0 pass, 2 fail
```

## 6. Implementation changes
- Added `packages/shared/src/workbench/thinking-partner.ts` with Zod schemas, role registry, deterministic provider, and service factory.
- Added direct package export `@craft-agent/shared/workbench/thinking-partner`.
- Added renderer flow helpers in `thinking-partner-flow.ts` for Think intent detection, request creation, and Spec Builder event payloads.
- Added `ThinkingPartnerRoundTableDialog.tsx` with role cards, selectable hypotheses, selectable questions, selectable options, retry/error/loading states, and Add to Spec / Generate Spec actions.
- Wired `FreeFormInput.tsx` so `think-with-me` launches the Thinking Partner flow while preserving existing composer behavior.
- Added localized Round Table copy for all active locales.

## 7. Validation commands run
```text
bun test packages/shared/src/workbench/__tests__/thinking-partner.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/thinking-partner-flow.test.ts
```
Result: `9 pass, 0 fail, 44 expect() calls`.

```text
bun test packages/shared/src/workbench/__tests__/thinking-partner.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/thinking-partner-flow.test.ts packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts
```
Result: `25 pass, 0 fail, 99 expect() calls`.

```text
bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts packages/shared/src/i18n/__tests__/locale-registry.test.ts packages/shared/src/i18n/__tests__/workbench-brand-localization.test.ts
```
Result: `76 pass, 0 fail, 107 expect() calls`.

```text
bun run typecheck:shared
bun run typecheck:electron
bun run validate:agent-contract
bun run validate:docs
git diff --check
bun run electron:build
```
Results: all passed. `electron:build` completed renderer/main/preload/resources/assets builds with existing chunk-size warnings only.

## 8. Passing test output summary
- Targeted Thinking Partner tests: passed.
- Composer workflow regression tests: passed.
- i18n locale parity and registry tests: passed.
- Shared and Electron typechecks: passed.
- Agent contract and architecture docs validators: passed.
- Desktop build gate: passed.

## 9. Build output summary
`bun run electron:build` completed successfully. The renderer build did not regress into Node-only import failures because the Thinking Partner runtime path uses the direct shared package subpath.

## 10. Remaining risks
- Real provider-backed Thinking Partner generation is not implemented yet; tests intentionally use a deterministic provider.
- Spec Builder currently receives a typed browser event; durable artifact persistence/history is owned by later logs/spec tasks.
- The Round Table is modal-first rather than a dedicated route; this is deliberate for the T009 MVP and may be expanded later if product navigation requires it.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Think With Me button opens round table | PASS | `FreeFormInput` routes `think-with-me` to Thinking Partner dialog |
| Cards are selectable | PASS | Dialog tracks selected hypotheses/questions/options and tests cover selection payload helpers |
| Selected cards can be passed to Spec Builder | PASS | `craft:spec-builder-intent` payload includes selected IDs and labels |
| Schema and role registry exist | PASS | Shared Thinking Partner schemas and role registry added with unit tests |
| Fake deterministic provider used in tests | PASS | `createDeterministicThinkingPartnerProvider` powers tests and renderer MVP |
| Tests pass | PASS | Targeted, regression, i18n, typecheck, validation, and build gates passed |
