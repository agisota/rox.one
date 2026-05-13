# T354 - RC S03 Smoke Harness And Command Repair

## 1. Task Summary

Repair the S03 RC smoke harness path and stale Mission Control UI command so
`T341-rc-s03-mission-checkpoint-verification` can be rerun reproducibly.

## 2. Repo Context Discovered

The root `e2e:smoke` script exists after T352, and S02 is registered after T353.
`scripts/e2e-smoke.ts` still did not register `s03-mission-checkpoint`, so T341
failed at the harness with an unsupported-scenario error.

Current durable mission coverage exists in explicit files under
`packages/server-core/src/missions/__tests__/`. Current Mission Control and Deep
Missions coverage exists in explicit workbench renderer tests; the glob in T341
matched zero files.

## 3. Files Inspected

- `docs/tickets/T341-rc-s03-mission-checkpoint-verification.md`
- `docs/tickets/T354-rc-s03-smoke-harness-and-command-repair.md`
- `docs/worklog/T341-rc-s03-mission-checkpoint-verification.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `packages/server-core/src/missions/__tests__/`
- `apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx`

## 4. Tests Added First

Added a failing S03 harness/path contract to
`scripts/__tests__/e2e-smoke-harness.test.ts`.

## 5. Expected Failing Test Output

```text
error: Unsupported scenario "s03-mission-checkpoint". Supported scenarios: s01-registration, s02-prompt-pipeline
```

The stale T341 Mission Control UI glob also matched zero files.

## 6. Implementation Changes

- Registered `s03-mission-checkpoint` in `scripts/e2e-smoke.ts`.
- Routed S03 to current durable mission scheduler/store tests.
- Routed S03 to current Mission Control and Deep Missions renderer tests.
- Replaced the stale T341 Mission Control UI validation command with current
  explicit test paths.
- Marked `T354` as `Status: DONE`.
- Updated T341 worklog and RC evidence to show the harness repair is complete
  while packaged restart screenshot evidence remains pending.

## 7. Validation Commands Run

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s03-mission-checkpoint
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## 8. Passing Test Output Summary

- Initial S03 harness contract failed for the expected unsupported-scenario
  reason, then passed after implementation: 4 pass, 0 fail, 13 expectations.
- `bun run e2e:smoke -- --scenario s03-mission-checkpoint`: pass, 156 tests, 0
  fail, 486 expectations.
- `bun run e2e:smoke -- --scenario s01-registration`: still exits code 78 with
  the expected `darwin` host-environment blocker on this Linux host.
- `bun run validate:agent-contract`: ok, 11 skills, 308 tickets, 7 required
  docs.
- `bun run validate:docs`, `bun run validate:rebrand`, `bun run
  validate:roadmap`, and `git diff --check` passed.

## 9. Build Output Summary

No build was run. The change is a smoke harness/test-path repair and does not
change runtime application code.

## 10. Remaining Risks

- S03 still needs packaged Electron restart, screenshot, and browser-console
  evidence before T341 can move to `DONE`.
- The S03 harness currently uses deterministic server/renderer tests rather
  than a packaged Electron UI restart run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Harness contract test fails before implementation for unsupported S03 | Pass | Initial harness test exited 1 with unsupported S03 |
| `s03-mission-checkpoint` is listed in supported scenarios | Pass | Harness test passes and `e2e:smoke` runs S03 |
| S03 smoke runs current server mission tests | Pass | `e2e:smoke` S03 includes mission tests and passes |
| S03 smoke runs current Mission Control/Deep Missions UI tests | Pass | `e2e:smoke` S03 includes workbench tests and passes |
| T341 no longer references the stale Mission Control glob | Pass | Harness test asserts stale glob is absent |
| Existing S01 Linux host-blocker behavior is unchanged | Pass | S01 still exits 78 on Linux with explicit darwin requirement |
| Worklog captures red/green evidence | Pass | This worklog records the failing and passing commands |
