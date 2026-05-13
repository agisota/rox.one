# T340 - RC Scenario S02: Prompt Pipeline Flow

## 1. Task Summary

Validate RC Scenario S02: raw prompt -> rewrite -> spec -> TDD task generation
-> Review Board.

## 2. Repo Context Discovered

`T340` is a validation-only Phase 20 ticket. Its implementation section says to
file blocking tickets for regressions instead of changing runtime behavior in
this ticket.

After T352, the RC smoke harness existed but only registered
`s01-registration`. T353 added the S02 scenario id and repaired the stale
validation command paths.

The product pipeline has adjacent tests in current paths under
`apps/electron/src/renderer/components/app-shell/input`,
`apps/electron/src/renderer/components/workbench`, and
`packages/shared/src/workbench`. The paths listed directly in T340 are stale.

## 3. Files Inspected

- `docs/tickets/T340-rc-s02-prompt-pipeline-flow.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx`
- `packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts`
- `packages/shared/src/workbench/__tests__/spec-compiler.test.ts`
- `packages/shared/src/workbench/__tests__/tdd-task-generator.test.ts`
- `packages/shared/src/workbench/__tests__/review-board.test.ts`

## 4. Tests Added First

No code test was added because this is a validation-only ticket. The red
validation checks are the required S02 smoke command and the T340-listed test
globs.

## 5. Expected Failing Test Output

Command:

```bash
bun run e2e:smoke -- --scenario s02-prompt-pipeline
```

Observed failure:

```text
[e2e-smoke] Unsupported scenario "s02-prompt-pipeline". Supported scenarios: s01-registration
error: script "e2e:smoke" exited with code 1
```

The three targeted commands listed in T340 also failed because their filters
matched zero files:

```text
The following filters did not match any test files:
 apps/electron/src/renderer/components/composer/**/__tests__/**

The following filters did not match any test files:
 packages/server-core/src/handlers/rpc/__tests__/prompt*.test.ts

The following filters did not match any test files:
 packages/server-core/src/handlers/rpc/__tests__/spec*.test.ts
```

After `T353`, the S02 smoke command reaches the harness and passes the current
prompt-pipeline test path:

```text
[e2e-smoke] pass s02-prompt-pipeline
46 pass
0 fail
1 snapshots
171 expect() calls
```

## 6. Implementation Changes

- Marked `T340` as `Status: Blocked`.
- Filed blocker ticket `T353-rc-s02-smoke-harness-and-command-repair.md`.
- Updated the RC evidence table row for S02 to `Blocked`.
- Added the blocker to the RC evidence blocker table.
- After `T353`, updated the validation command paths and RC evidence note to
  show the S02 harness repair is complete while screenshot evidence remains
  pending.

No runtime files were changed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s02-prompt-pipeline
bun test apps/electron/src/renderer/components/composer/**/__tests__/**
bun test packages/server-core/src/handlers/rpc/__tests__/prompt*.test.ts
bun test packages/server-core/src/handlers/rpc/__tests__/spec*.test.ts
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s02-prompt-pipeline
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx
bun test packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts packages/shared/src/workbench/__tests__/spec-compiler.test.ts packages/shared/src/workbench/__tests__/tdd-task-generator.test.ts packages/shared/src/workbench/__tests__/review-board.test.ts
bun run validate:agent-contract
```

## 8. Passing Test Output Summary

- `bun run e2e:smoke -- --scenario s02-prompt-pipeline`: 46 pass, 0 fail, 171
  expectations, 1 snapshot.
- `bun test scripts/__tests__/e2e-smoke-harness.test.ts`: 3 pass, 0 fail, 9
  expectations.
- Adjacent renderer/workbench tests: 27 pass, 0 fail, 113 expectations.
- Adjacent shared workbench pipeline tests: 19 pass, 0 fail, 58 expectations,
  1 snapshot.
- `bun run validate:agent-contract`: ok, 11 skills, 307 tickets, 7 required
  docs.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes and the S02
smoke did not reach a runnable scenario.

## 10. Remaining Risks

- S02 has not produced packaged Electron UI screenshots or browser-console
  evidence.
- The repaired S02 smoke currently proves deterministic renderer/shared pipeline
  behavior, not a full packaged UI screenshot run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Freeform prompt reaches Rewrite Engine | Partial | S02 harness passes prompt rewrite flow tests; packaged UI smoke pending |
| Rewrite output is displayed in preview panel | Partial | Renderer artifact tests pass; packaged UI smoke pending |
| Spec Builder is populated from rewrite output | Partial | Spec builder tests pass; packaged UI smoke pending |
| Compiled spec export passes schema validator | Partial | `spec-compiler` tests pass; packaged UI smoke pending |
| TDD mode generates at least one task | Partial | `tdd-task-generator` tests pass; packaged UI smoke pending |
| Review Board shows gate status from TDD output | Partial | `review-board` and artifact-screen tests pass; packaged UI smoke pending |
| No unhandled browser console errors | Blocked | No packaged browser smoke ran |
| Screenshot evidence referenced in RC evidence doc | Blocked | No screenshot captured in current deterministic test harness |
| RC evidence row S02 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S02 is `Blocked` |
| Initial blocking ticket filed | Pass | `T353-rc-s02-smoke-harness-and-command-repair.md` |
