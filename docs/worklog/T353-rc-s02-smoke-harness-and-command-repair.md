# T353 - RC S02 Smoke Harness And Command Repair

## 1. Task Summary

Repair the S02 RC smoke harness path and stale validation commands so
`T340-rc-s02-prompt-pipeline-flow` can be rerun reproducibly.

## 2. Repo Context Discovered

The root `e2e:smoke` script exists after T352, but
`scripts/e2e-smoke.ts` only registers `s01-registration`. T340 asks for
`s02-prompt-pipeline`, which fails with an unsupported-scenario message.

The T340 targeted test globs reference old Composer/RPC locations. Current
pipeline coverage exists under app-shell/workbench renderer tests and shared
workbench tests.

## 3. Files Inspected

- `docs/tickets/T340-rc-s02-prompt-pipeline-flow.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- Current renderer/workbench and shared/workbench test paths listed in T340's
  worklog.

## 4. Tests Added First

Not implemented in this handoff ticket. The expected red condition is recorded
from the S02 validation run.

## 5. Expected Failing Test Output

```text
[e2e-smoke] Unsupported scenario "s02-prompt-pipeline". Supported scenarios: s01-registration
```

The T340-listed targeted test globs also match zero files.

## 6. Implementation Changes

No harness repair was implemented in this handoff. This ticket captures the
blocker that must be implemented before S02 can proceed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s02-prompt-pipeline
bun test apps/electron/src/renderer/components/composer/**/__tests__/**
bun test packages/server-core/src/handlers/rpc/__tests__/prompt*.test.ts
bun test packages/server-core/src/handlers/rpc/__tests__/spec*.test.ts
bun run validate:agent-contract
```

## 8. Passing Test Output Summary

- Adjacent renderer/workbench tests: 27 pass, 0 fail, 113 expectations.
- Adjacent shared workbench pipeline tests: 19 pass, 0 fail, 58 expectations,
  1 snapshot.
- `bun run validate:agent-contract`: ok, 11 skills, 307 tickets, 7 required
  docs.

## 9. Build Output Summary

No build was run. This blocker ticket contains no runtime/source changes.

## 10. Remaining Risks

- S02 remains blocked until `s02-prompt-pipeline` is registered in the smoke
  harness.
- Passing adjacent tests do not replace the required RC smoke and screenshot
  evidence.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| S02 unsupported-scenario blocker is reproduced | Pass | `bun run e2e:smoke -- --scenario s02-prompt-pipeline` exits 1 |
| Stale T340 globs are reproduced | Pass | Three T340 commands match zero test files |
| Adjacent pipeline tests identified | Pass | Current renderer/shared workbench tests pass |
| Dedicated blocker ticket exists | Pass | `docs/tickets/T353-rc-s02-smoke-harness-and-command-repair.md` |
