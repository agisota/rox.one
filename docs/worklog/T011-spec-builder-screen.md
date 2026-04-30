# T011 — Spec Builder screen

## 1. Task summary
Added the first Spec Builder screen surface and state model on top of the shared Option Graph. The screen renders input summary, option categories, selectable option cards, selected requirements, derived skills/agents/validation gates/artifacts, and a deterministic Markdown-style preview. It supports preselected option payloads from upstream flows through `initialState` / `initialInput` props without executing real agents.

## 2. Repo context discovered
- T010 added the shared Option Graph contract and direct package export.
- Rewrite and Thinking Partner flows already emit `craft:spec-builder-intent` payloads, but the app has no unified `spec-builder` route/listener yet.
- Existing navigation stack is route/parser/panel based and sensitive to multi-panel URL state, so T011 keeps the change to a standalone renderer workbench screen plus pure state helpers.
- Renderer component tests in this repo are mostly contract-level Bun tests; this task uses `react-dom/server` rendering plus pure state tests instead of adding a new DOM test harness.

## 3. Files inspected
- `apps/electron/src/renderer/components/app-shell/input/product-mode-toolbar.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/thinking-partner-flow.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/ThinkingPartnerRoundTableDialog.tsx`
- `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx`
- `apps/electron/src/shared/routes.ts`
- `apps/electron/src/shared/route-parser.ts`
- `packages/shared/src/workbench/option-graph.ts`

## 4. Tests added first
- `apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx`

## 5. Expected failing test output
Initial TDD run failed before implementation for the expected missing screen module:

```text
error: Cannot find module '../SpecBuilderScreen'
0 pass, 1 fail, 1 error
```

## 6. Implementation changes
- Added `apps/electron/src/renderer/components/workbench/spec-builder-state.ts`.
- Added `apps/electron/src/renderer/components/workbench/SpecBuilderScreen.tsx`.
- Added pure state helpers:
  - `createSpecBuilderState`
  - `toggleSpecBuilderOption`
  - `clearSpecBuilderOptions`
  - `createSpecBuilderPreview`
- Added category grouping for Option Graph options.
- Added dependency-aware option toggling that removes dependents when a required option is deselected.
- Added screen UI for input summary, source/mode badges, option categories, selectable cards, selected requirements, derived config, preview, Export, Save Preset, and Start Agent Plan.

## 7. Validation commands run
```text
bun test apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx
```
Initial after implementation result: `5 pass, 0 fail, 27 expect() calls`.

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx packages/shared/src/workbench/__tests__/option-graph.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/thinking-partner-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts
```
Final regression result: `20 pass, 0 fail, 71 expect() calls`.

```text
bun run typecheck:shared
bun run typecheck:electron
bun run validate:agent-contract
bun run validate:docs
git diff --check
bun run electron:build
```
Results: all passed. `typecheck:electron` initially caught an invalid test fixture source (`rewrite` instead of `prompt-rewrite`); the test fixture was corrected and the typecheck passed.

## 8. Passing test output summary
- Spec Builder screen/state tests: passed.
- Option Graph regression tests: passed.
- Rewrite and Thinking Partner flow regression tests: passed.
- Shared and Electron typechecks: passed.
- Agent contract and architecture docs validators: passed.
- Whitespace diff check: passed.
- Electron build: passed.

## 9. Build output summary
`bun run electron:build` completed main, preload, renderer, resources, and assets build steps. Renderer produced existing large chunk warnings only.

## 10. Remaining risks
- The screen is implemented as a standalone renderer component; route registration and the central `craft:spec-builder-intent` listener are intentionally deferred to the next integration slice.
- Export/Start Agent Plan buttons expose callbacks only; persistent artifact creation and agent-plan execution belong to T012/T015.
- The screen currently uses static English labels; broader i18n polish should be handled when the screen is wired into app navigation.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Screen renders option categories | PASS | `SpecBuilderScreen` renders category groups from `OPTION_GRAPH_CATEGORIES` |
| Selecting option updates selected panel | PASS | `toggleSpecBuilderOption` state test covers selected requirements and dependencies |
| Derived config updates | PASS | Tests assert derived agents, skills, gates, and sections from selected options |
| Export disabled until valid spec | PASS | `canExport` tests cover missing input and missing selected requirements |
| Input from Thinking Partner can preselect options | PASS | State test covers `source: thinking-partner` with preselected option IDs |
| Spec preview generated | PASS | Preview test asserts selected requirements, sections, and skills |
| No real execution yet | PASS | Buttons call optional callbacks only; no provider/agent execution |
| Tests pass | PASS | Targeted and regression packs pass |
| Build passes | PASS | Electron build passes |
