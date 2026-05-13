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

Added a failing S02 harness/path contract to
`scripts/__tests__/e2e-smoke-harness.test.ts`.

## 5. Expected Failing Test Output

```text
[e2e-smoke] Unsupported scenario "s02-prompt-pipeline". Supported scenarios: s01-registration
```

The T340-listed targeted test globs also match zero files.

## 6. Implementation Changes

- Registered `s02-prompt-pipeline` in `scripts/e2e-smoke.ts`.
- Routed S02 to the current renderer/workbench and shared/workbench prompt
  pipeline tests.
- Extended `scripts/__tests__/e2e-smoke-harness.test.ts` to lock S02 registry
  and current validation paths.
- Replaced the stale T340 validation commands with current paths.
- Marked `T353` as `Status: DONE`.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s02-prompt-pipeline
bun test apps/electron/src/renderer/components/composer/**/__tests__/**
bun test packages/server-core/src/handlers/rpc/__tests__/prompt*.test.ts
bun test packages/server-core/src/handlers/rpc/__tests__/spec*.test.ts
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s02-prompt-pipeline
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
```

## 8. Passing Test Output Summary

- Initial S02 harness contract test failed for the expected unsupported-scenario
  reason, then passed after implementation: 3 pass, 0 fail, 9 expectations.
- `bun run e2e:smoke -- --scenario s02-prompt-pipeline`: pass, 46 tests, 0
  fail, 171 expectations, 1 snapshot.
- `bun run e2e:smoke -- --scenario s01-registration`: still exits code 78 with
  the expected `darwin` host-environment blocker on this Linux host.
- Adjacent renderer/workbench tests: 27 pass, 0 fail, 113 expectations.
- Adjacent shared workbench pipeline tests: 19 pass, 0 fail, 58 expectations,
  1 snapshot.
- `bun run validate:agent-contract`: ok, 11 skills, 307 tickets, 7 required
  docs.

## 9. Build Output Summary

No build was run. The change is a smoke harness/test-path repair and does not
change runtime application code.

## 10. Remaining Risks

- S02 still needs screenshot and browser-console evidence before T340 can move to
  `DONE`.
- The S02 harness currently uses deterministic renderer/shared tests rather than
  a packaged Electron UI screenshot run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| S02 unsupported-scenario blocker is reproduced | Pass | Initial `bun run e2e:smoke -- --scenario s02-prompt-pipeline` exited 1 |
| Stale T340 globs are reproduced | Pass | Three T340 commands matched zero test files |
| S02 harness entry is registered | Pass | Harness test passes and `e2e:smoke` runs S02 |
| T340 stale commands are repaired | Pass | T340 now references current renderer/shared test paths |
| Existing S01 behavior is unchanged | Pass | S01 still exits 78 on Linux with explicit darwin requirement |
| Dedicated blocker ticket exists | Pass | `docs/tickets/T353-rc-s02-smoke-harness-and-command-repair.md` |
