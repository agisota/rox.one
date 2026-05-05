# T016 - Automation presets

## 1. Task summary
Implement safe Agent Workbench automation presets that can be materialized into the existing `automations.json` config shape. Presets should be deterministic, prompt-only, idempotent when applied repeatedly, and valid under the existing automation schema.

## 2. Repo context discovered
- T016 ticket is present but stubbed and points back to the master backlog.
- Existing automation config shape lives in `packages/shared/src/automations/types.ts`.
- Existing validation lives in `packages/shared/src/automations/schemas.ts` and `validation.ts`.
- `AutomationSystem` loads `automations.json`; this task should not write files or run triggers.
- Existing security guidance warns against direct config edits; a shared preset materializer gives later UI/CLI code a safe source of truth.
- No `mise.toml` / `.mise.toml` exists, so existing `bun` package scripts are the project interface for this task.

Assumptions and boundaries:
- Presets are prompt-only and do not include webhook URLs, shell commands, or secrets.
- Applying presets returns a new config object; no disk writes happen in this shared module.
- Manual trigger/runtime execution is deferred because current automation execution is handled by `AutomationSystem` and prompt handlers.

Schema view:

```mermaid
erDiagram
  AUTOMATION_PRESET ||--|| AUTOMATION_MATCHER : materializes
  AUTOMATIONS_CONFIG ||--o{ AUTOMATION_MATCHER : contains
  AUTOMATION_PRESET_CONFIG ||--o{ AUTOMATION_PRESET : selects
```

Sequence view:

```mermaid
sequenceDiagram
  participant UI
  participant Presets
  participant Validator
  participant Worklog
  UI->>Presets: selected preset ids and timezone
  Presets->>Presets: materialize prompt-only matchers
  Presets->>Validator: existing automations schema
  Presets->>Worklog: deterministic config evidence
```

Options compared:
- New shared preset module: safest boundary and reusable by UI/CLI.
- Edit `AutomationSystem`: overreaches into runtime execution and disk loading.
- Add static JSON templates: less type-safe and easy to drift from schema.

Recommended path: add a pure `presets.ts` module plus unit tests against existing automation validation.

## 3. Files inspected
- `docs/tickets/T016-automation-presets.md`
- `.agents/skills/automation-designer/SKILL.md`
- `packages/shared/src/automations/types.ts`
- `packages/shared/src/automations/schemas.ts`
- `packages/shared/src/automations/validation.ts`
- `packages/shared/src/automations/index.ts`
- `packages/shared/src/automations/automation-system.test.ts`
- `docs/worklog/T005-skill-bundle-installer.md`
- `docs/worklog/T008-prompt-rewrite-engine.md`

## 4. Tests added first
Added `packages/shared/src/automations/automation-presets.test.ts` before production implementation.

Covered:
- Catalog ships deterministic prompt-only presets with stable IDs.
- Presets materialize into existing matcher/config shape.
- Applying presets is idempotent and preserves existing automations.
- Generated config validates with existing automation validator.
- Unknown preset IDs are rejected before config production.

## 5. Expected failing test output
Initial targeted run failed for the expected missing implementation reason:

```text
error: Cannot find module './presets.ts'
0 pass
1 fail
1 error
```

## 6. Implementation changes
Added `packages/shared/src/automations/presets.ts` with:
- Stable preset IDs and a typed preset catalog.
- Prompt-only matcher definitions for daily review, blocked-session triage, and TDD failure follow-up.
- `materializeAutomationPreset()` for deterministic matcher generation with timezone/enabled overrides.
- `applyAutomationPresets()` for idempotent config merging that preserves existing automations.
- Public exports through the automations barrel.

## 7. Validation commands run
```text
bun test packages/shared/src/automations/automation-presets.test.ts
bun test packages/shared/src/automations/automation-presets.test.ts packages/shared/src/automations/automation-system.test.ts packages/shared/src/automations/resolve-config-path.test.ts
bun run typecheck:shared
bun run typecheck:electron
bun run validate:docs
git diff --check
bun run electron:build
```

## 8. Passing test output summary
```text
automation-presets.test.ts: 4 pass, 0 fail, 10 expect() calls
automation regression pack: 29 pass, 0 fail, 54 expect() calls
```

`typecheck:shared`, `typecheck:electron`, `validate:docs`, and `git diff --check` passed.

## 9. Build output summary
`bun run electron:build` passed:
- main process build verified
- preload builds verified
- renderer production build completed in 25.70s
- resources/assets copied

Existing Vite chunk-size and Jotai deprecation warnings remain present and are not introduced by T016.

## 10. Remaining risks
- Master plan details for T016 are absent from the repo; implementation is scoped to safe shared presets over the existing automation schema.
- Runtime/UI installation of presets is deferred to later integration work.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Preset catalog exists | PASS | Catalog test checks stable IDs |
| Presets are prompt-only | PASS | Catalog test asserts every action is `prompt` |
| Presets materialize to valid automation config | PASS | Materializer test and existing validator pass |
| Applying presets is idempotent | PASS | Double-apply test returns identical config |
| Existing automations are preserved | PASS | Existing matcher remains before preset matchers |
| Unknown presets are rejected | PASS | Schema rejection test passes |
| Targeted tests pass | PASS | `automation-presets.test.ts`: 4 pass |
| Relevant typecheck/build validation passes | PASS | Shared/electron typecheck, docs validation, diff check, and Electron build passed |

## 12. Worker D integration closure - 2026-05-05

### Task summary
Closed the remaining T016 integration gap: automation presets can now be resolved and applied from product workflow selections into a valid automation config consumer shape.

### Repo context discovered
- The preset catalog and `applyAutomationPresets()` already covered selected preset IDs.
- No helper mapped Spec Builder / product workflow options to automation preset IDs.
- No consumer result linked selected workflow mode/options/gates to a config object that can be handed to existing automation consumers.
- Existing automation validation remains the source of truth for config validity.

### Files inspected
- `packages/shared/src/automations/presets.ts`
- `packages/shared/src/automations/automation-presets.test.ts`
- `packages/shared/src/automations/index.ts`
- `packages/shared/src/automations/types.ts`
- `packages/shared/src/automations/schemas.ts`
- `packages/shared/src/automations/validation.ts`
- `packages/shared/src/workbench/option-graph.ts`
- `apps/electron/src/renderer/components/workbench/spec-builder-state.ts`
- `apps/electron/src/renderer/components/workbench/SpecBuilderScreen.tsx`
- `docs/tickets/T016-automation-presets.md`
- `docs/worklog/T016-automation-presets.md`

### Tests added first
Extended `packages/shared/src/automations/automation-presets.test.ts` with a red integration test:
- passes a build workflow selection with `tdd:test-first`, `security:tenant-isolation`, and `validation:strict-gates`;
- expects deterministic preset IDs: daily review, blocked triage, TDD follow-up;
- applies those presets into `AutomationsConfig`;
- validates the resulting config through `validateAutomationsConfig()`.

Also extended the Spec Builder UI test to prove selected workflow options expose the derived automation preset plan.

### Expected failing test output
Initial targeted red run failed for the expected missing export:

```text
SyntaxError: Export named 'resolveProductWorkflowAutomationPresetIds' not found
0 pass
1 fail
1 error
```

### Implementation changes
- Added `ProductWorkflowAutomationPresetInputSchema`.
- Added `resolveProductWorkflowAutomationPresetIds()` to map mode/options/gates to preset IDs.
- Added `applyProductWorkflowAutomationPresets()` to merge resolved presets into an `AutomationsConfig` without disk writes.
- Preserved idempotent config copying semantics.
- Exported the product workflow preset helpers through `@rox-agent/shared/automations`.
- Wired Spec Builder state to expose `automationPresetPlan`, and Spec Builder UI to show derived automation preset IDs.

### Validation commands run
```text
bun test packages/shared/src/automations/automation-presets.test.ts
bun test packages/shared/src/workbench/__tests__/agent-pipeline-planner.test.ts packages/shared/src/automations/automation-presets.test.ts apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx
bun run typecheck:shared
bun run typecheck:electron
bun run lint:shared
bun run lint:electron
bun run validate:agent-contract
git diff --check
bun run electron:build
bun run electron:smoke
```

### Passing test output summary
```text
automation-presets.test.ts: 5 pass, 0 fail, 16 expect() calls
combined targeted pack: 15 pass, 0 fail, 70 expect() calls
```

`typecheck:shared`, `typecheck:electron`, `lint:shared`, `lint:electron`, `validate:agent-contract`, `git diff --check`, `electron:build`, and `electron:smoke` passed.

### Build output summary
Supervisor integration initially caught a renderer build failure because `SpecBuilderState` imported from the broad `@rox-agent/shared/automations` barrel, which pulled node-only automation config code into the Vite browser bundle:

```text
packages/shared/src/automations/resolve-config-path.ts (5:9): "randomBytes" is not exported by "__vite-browser-external"
```

The fix added the browser-safe `@rox-agent/shared/automations/presets` package export and changed the renderer import to use it. `bun run electron:build` then completed successfully, and `bun run electron:smoke` reached `[smoke] Electron headless startup passed`.

### Remaining risks
- The helper creates a valid config object but does not persist it to disk; parent product flow must decide where saving belongs.
- Preset resolution is intentionally conservative and prompt-only; webhook/external actions remain out of scope.

### Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Product workflow can resolve preset IDs | PASS | `resolveProductWorkflowAutomationPresetIds()` test passes |
| Product workflow can produce config consumer shape | PASS | `applyProductWorkflowAutomationPresets()` test passes |
| Generated config validates | PASS | `validateAutomationsConfig(result.config).valid` is true |
| Spec Builder exposes automation preset plan | PASS | UI/state test asserts `automationPresetPlan.presetIds` |
| Presets remain prompt-only/fake-provider safe | PASS | Existing catalog test asserts prompt-only actions |
| Relevant targeted tests pass | PASS | Combined targeted pack: 15 pass |
| Relevant typecheck/lint passes | PASS | Shared/electron typecheck and lint passed |
