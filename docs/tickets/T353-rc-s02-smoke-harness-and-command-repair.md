# T353 - RC S02 smoke harness and command repair

Status: DONE

## Context

`T340` requires the S02 RC smoke command:

```bash
bun run e2e:smoke -- --scenario s02-prompt-pipeline
```

After T352, the root smoke harness exists, but only `s01-registration` is
registered. The S02 command now fails closed with an unsupported-scenario
message. The targeted test globs named by T340 also point at stale paths and
match zero files.

## Goal

Make S02 runnable through the RC smoke harness and replace the stale validation
commands with current repo paths so the prompt rewrite -> spec -> TDD -> review
pipeline can be validated reproducibly.

## Required Scope

- Register `s02-prompt-pipeline` in `scripts/e2e-smoke.ts`.
- Add/extend harness contract tests for S02.
- Update `T340` validation commands to current test paths or add a wrapper that
  preserves the original ticket command intent.
- Preserve the existing S01 behavior and host-environment blocker semantics.

## TDD Requirements

1. Add a failing harness contract test for `s02-prompt-pipeline`.
2. Add a failing validation-path contract for at least one stale T340 glob.
3. Implement the minimal harness/path repair.
4. Re-run S02 smoke plus adjacent renderer/shared workbench tests.

## Validation Commands

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s02-prompt-pipeline
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx
bun test packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts packages/shared/src/workbench/__tests__/spec-compiler.test.ts packages/shared/src/workbench/__tests__/tdd-task-generator.test.ts packages/shared/src/workbench/__tests__/review-board.test.ts
bun run validate:agent-contract
```

## Acceptance Criteria

- [x] `bun run e2e:smoke -- --scenario s02-prompt-pipeline` no longer fails
      with `Unsupported scenario`.
- [x] S02 harness command runs a reproducible prompt-pipeline validation path.
- [x] T340 no longer points at test globs that match zero files.
- [x] Existing S01 harness behavior is unchanged.

## Worklog

Update `docs/worklog/T353-rc-s02-smoke-harness-and-command-repair.md` when
implementing the repair.
