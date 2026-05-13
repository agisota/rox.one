# T340 - RC Scenario S02: Prompt Pipeline Flow

## 1. Task Summary

Validate RC Scenario S02: raw prompt -> rewrite -> spec -> TDD task generation
-> Review Board.

## 2. Repo Context Discovered

`T340` is a validation-only Phase 20 ticket. Its implementation section says to
file blocking tickets for regressions instead of changing runtime behavior in
this ticket.

After T352, the RC smoke harness exists, but it only registers
`s01-registration`. The S02 scenario id is not yet available in the harness.

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

## 6. Implementation Changes

- Marked `T340` as `Status: Blocked`.
- Filed blocker ticket `T353-rc-s02-smoke-harness-and-command-repair.md`.
- Updated the RC evidence table row for S02 to `Blocked`.
- Added the blocker to the RC evidence blocker table.

No runtime files were changed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s02-prompt-pipeline
bun test apps/electron/src/renderer/components/composer/**/__tests__/**
bun test packages/server-core/src/handlers/rpc/__tests__/prompt*.test.ts
bun test packages/server-core/src/handlers/rpc/__tests__/spec*.test.ts
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx
bun test packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts packages/shared/src/workbench/__tests__/spec-compiler.test.ts packages/shared/src/workbench/__tests__/tdd-task-generator.test.ts packages/shared/src/workbench/__tests__/review-board.test.ts
bun run validate:agent-contract
```

## 8. Passing Test Output Summary

- Adjacent renderer/workbench tests: 27 pass, 0 fail, 113 expectations.
- Adjacent shared workbench pipeline tests: 19 pass, 0 fail, 58 expectations,
  1 snapshot.
- `bun run validate:agent-contract`: ok, 11 skills, 307 tickets, 7 required
  docs.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes and the S02
smoke did not reach a runnable scenario.

## 10. Remaining Risks

- S02 has not produced clean Electron smoke evidence or screenshots.
- The S02 smoke harness registry entry still needs implementation under T353.
- The stale validation command paths in T340 need repair before this scenario can
  be rerun without manual path substitution.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Freeform prompt reaches Rewrite Engine | Blocked | S02 smoke scenario is unsupported in harness |
| Rewrite output is displayed in preview panel | Blocked | S02 smoke scenario is unsupported in harness |
| Spec Builder is populated from rewrite output | Blocked | S02 smoke scenario is unsupported in harness |
| Compiled spec export passes schema validator | Partial | Adjacent `spec-compiler` tests pass; smoke pending |
| TDD mode generates at least one task | Partial | Adjacent `tdd-task-generator` tests pass; smoke pending |
| Review Board shows gate status from TDD output | Partial | Adjacent `review-board` and artifact-screen tests pass; smoke pending |
| No unhandled browser console errors | Blocked | No browser smoke ran |
| Screenshot evidence referenced in RC evidence doc | Blocked | No screenshot possible before S02 harness entry exists |
| RC evidence row S02 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S02 is `Blocked` |
| Blocking ticket filed | Pass | `T353-rc-s02-smoke-harness-and-command-repair.md` |
