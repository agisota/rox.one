# T014 - Validation Gates engine

## 1. Task summary
Implement a deterministic shared Validation Gates engine for Agent Workbench. It should turn product-mode/spec validation gates into an auditable catalog and pure run result, enforce evidence for blocking gates, and avoid real LLM, browser, S3, billing, or cloud calls in tests.

## 2. Repo context discovered
- T014 ticket is present but stubbed and points back to the master backlog.
- T006 introduced `ValidationGateSchema` and default gates in `product-mode-registry.ts`.
- T010/T012 route option and compiler choices into `metadata.validationGates` and `spec.validationPlan`.
- T013 added `review-board.ts`, but evidence-required gate semantics are local to the board.
- UI currently displays validation gates in the spec builder, but does not execute them.
- No `mise.toml` / `.mise.toml` exists, so existing `bun` package scripts are the project interface for this task.

Assumptions and boundaries:
- The T014 engine is a pure shared module, not a UI screen and not an external command runner.
- Evidence is supplied by callers/tests as structured fake command results; the engine never shells out.
- Review Board may consume the same gate catalog later or in this task to avoid duplicated policy.

Schema view:

```mermaid
erDiagram
  VALIDATION_GATE_DEFINITION ||--o{ VALIDATION_GATE_CHECK : describes
  VALIDATION_GATE_RUN ||--o{ VALIDATION_GATE_EVIDENCE : receives
  VALIDATION_GATE_RUN ||--o{ VALIDATION_GATE_CHECK : produces
  COMPILED_SPEC ||--o{ VALIDATION_GATE_RUN : seeds
```

Sequence view:

```mermaid
sequenceDiagram
  participant Caller
  participant Compiler
  participant GateEngine
  participant Worklog
  Caller->>Compiler: compile selected mode/options
  Compiler->>GateEngine: metadata.validationGates
  Caller->>GateEngine: fake command/review evidence
  GateEngine->>GateEngine: catalog lookup and evidence policy
  GateEngine->>Worklog: verdict, checks, missing evidence
```

Options compared:
- New `validation-gates` shared module: clearest T014 boundary, reusable by Review Board and UI.
- Expand `review-board.ts` only: smaller diff, but keeps validation policy coupled to one consumer.
- UI execution first: visible, but overreaches the current pure shared backlog layer.

Recommended path: add a small pure shared gate engine, tests first, then optionally refactor Review Board onto the shared policy if it stays low-risk.

## 3. Files inspected
- `docs/tickets/T014-validation-gates-engine.md`
- `docs/worklog/T013-review-board.md`
- `packages/shared/src/workbench/product-mode-registry.ts`
- `packages/shared/src/workbench/option-graph.ts`
- `packages/shared/src/workbench/spec-compiler.ts`
- `packages/shared/src/workbench/review-board.ts`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/package.json`
- `apps/electron/src/renderer/components/workbench/spec-builder-state.ts`
- `apps/electron/src/renderer/components/workbench/SpecBuilderScreen.tsx`

## 4. Tests added first
Added `packages/shared/src/workbench/__tests__/validation-gates.test.ts` before production implementation.

Covered:
- Catalog has one definition for every `ValidationGateSchema` option.
- Test/RBAC/quota/sync gates require blocking evidence.
- Non-evidence gates pass without command evidence.
- Missing RBAC/quota/sync evidence fails.
- Explicit failed command evidence fails.
- Compiled specs can seed a validation run without external providers.

## 5. Expected failing test output
Initial targeted run failed for the expected missing implementation reason:

```text
error: Cannot find module '../validation-gates'
0 pass
1 fail
1 error
```

## 6. Implementation changes
Added `packages/shared/src/workbench/validation-gates.ts` with:
- Zod schemas for gate definitions, evidence, checks, run input, and run results.
- A catalog covering every `ValidationGateSchema` option.
- Evidence-required blocking policy for unit, integration, UI, E2E, RBAC, quota, and sync gates.
- `runValidationGates()` to produce deterministic pass/warn/fail results without executing commands.
- `createValidationGateRunFromCompiledSpec()` to seed runs from compiled spec metadata.
- Public exports through the workbench barrel and package subpath.

Refactored `review-board.ts` missing-evidence findings to consume the shared validation gate runner instead of maintaining a separate evidence-required set.

## 7. Validation commands run
```text
bun test packages/shared/src/workbench/__tests__/validation-gates.test.ts
bun test packages/shared/src/workbench/__tests__/validation-gates.test.ts packages/shared/src/workbench/__tests__/review-board.test.ts
bun test packages/shared/src/workbench/__tests__/validation-gates.test.ts packages/shared/src/workbench/__tests__/review-board.test.ts packages/shared/src/workbench/__tests__/spec-compiler.test.ts packages/shared/src/workbench/__tests__/option-graph.test.ts packages/shared/src/workbench/__tests__/product-mode-registry.test.ts
bun run typecheck:shared
bun run typecheck:electron
bun run validate:docs
git diff --check
bun run electron:build
```

## 8. Passing test output summary
```text
validation-gates.test.ts: 6 pass, 0 fail, 15 expect() calls
validation-gates + review-board regression: 11 pass, 0 fail, 30 expect() calls
workbench regression pack: 27 pass, 0 fail, 1 snapshot, 206 expect() calls
```

`typecheck:shared`, `typecheck:electron`, `validate:docs`, and `git diff --check` passed.

## 9. Build output summary
`bun run electron:build` passed:
- main process build verified
- preload builds verified
- renderer production build completed in 24.04s
- resources/assets copied

Existing Vite chunk-size and Jotai deprecation warnings remain present and are not introduced by T014.

## 10. Remaining risks
- Master plan details for T014 are absent from the repo; implementation is scoped to the deterministic shared contract implied by T006-T013.
- UI execution remains deferred; this task only supplies the reusable engine.
- The engine records caller-supplied evidence and verdicts; it intentionally does not execute shell commands itself.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Gate catalog covers every known gate | PASS | `validation-gates.test.ts` checks every `ValidationGateSchema` option |
| Evidence-required gates are explicit | PASS | Test/RBAC/quota/sync evidence policy test passes |
| Missing protected evidence fails | PASS | Missing RBAC/quota/sync evidence test returns `fail` |
| Failed evidence fails | PASS | Explicit failed command evidence test returns `fail` |
| Compiled spec can seed a run | PASS | `createValidationGateRunFromCompiledSpec()` test passes |
| Shared package export exists | PASS | Workbench barrel and package subpath export added |
| Targeted tests pass | PASS | `validation-gates.test.ts`: 6 pass |
| Relevant typecheck/build validation passes | PASS | Shared/electron typecheck, docs validation, diff check, and Electron build passed |
