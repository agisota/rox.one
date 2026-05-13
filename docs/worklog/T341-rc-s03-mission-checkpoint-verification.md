# T341 - RC Scenario S03: Mission Checkpoint Verification

## 1. Task Summary

Validate RC Scenario S03: create a 24h mission, persist checkpoint state across
restart, and reach final verification from evidence.

## 2. Repo Context Discovered

`T341` is a validation-only Phase 20 ticket. It says to file blocking tickets for
regressions instead of changing runtime behavior in this ticket.

The shared RC smoke harness exists after T352 and S02 is registered after T353,
but `s03-mission-checkpoint` is not registered. The S03 smoke command exits at
the harness before it can run current mission coverage.

Current durable mission coverage exists under
`packages/server-core/src/missions/__tests__/`. Current Mission Control and Deep
Missions UI coverage exists under
`apps/electron/src/renderer/components/workbench/__tests__/`.

## 3. Files Inspected

- `docs/tickets/T341-rc-s03-mission-checkpoint-verification.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `packages/server-core/src/missions/__tests__/`
- `apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx`

## 4. Tests Added First

No code test was added in this validation-only ticket. The red validation checks
are the required S03 smoke command and the T341-listed Mission Control UI glob.

## 5. Expected Failing Test Output

Command:

```bash
bun run e2e:smoke -- --scenario s03-mission-checkpoint
```

Observed failure:

```text
[e2e-smoke] Unsupported scenario "s03-mission-checkpoint". Supported scenarios: s01-registration, s02-prompt-pipeline
error: script "e2e:smoke" exited with code 1
```

The Mission Control UI command listed in T341 also failed because its filter
matched zero files:

```text
The following filters did not match any test files:
 apps/electron/src/renderer/components/workbench/**/__tests__/mission*.test.*
```

## 6. Implementation Changes

- Marked `T341` as `Status: Blocked`.
- Filed blocker ticket `T354-rc-s03-smoke-harness-and-command-repair.md`.
- Updated the RC evidence table row for S03 to `Blocked`.
- Added the blocker to the RC evidence blocker table.

No runtime files were changed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s03-mission-checkpoint
bun test packages/server-core/src/missions/__tests__/**
bun test apps/electron/src/renderer/components/workbench/**/__tests__/mission*.test.*
bun test apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx
```

## 8. Passing Test Output Summary

- Durable scheduler/store mission tests: 125 pass, 0 fail, 352 expectations.
- Current Mission Control/Deep Missions UI tests: 31 pass, 0 fail, 134
  expectations.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes.

## 10. Remaining Risks

- S03 smoke harness entry is not registered yet; T354 tracks that repair.
- S03 has not produced packaged Electron UI screenshots or browser-console
  evidence.
- The passing tests prove deterministic mission/checkpoint state behavior, not a
  full packaged restart smoke run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| 24h mission is created via the Deep Missions launch form | Partial | Deep Missions tests pass; packaged UI smoke pending |
| Mission appears in Mission Control with `running` status | Partial | Mission Control render tests pass; packaged UI smoke pending |
| At least one checkpoint record is persisted in the store | Partial | Mission/store and runtime tests pass; packaged UI smoke pending |
| App restart shows the mission in the same running state | Blocked | No packaged restart smoke ran |
| Mission transitions to `completed` with final verification status | Partial | Mission Control finalization tests pass; packaged UI smoke pending |
| Final status is derived from validation evidence, not timer | Partial | Evidence-gated finalization tests pass; packaged UI smoke pending |
| Screenshot evidence captured and referenced | Blocked | No screenshot captured in current deterministic test harness |
| RC evidence row S03 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S03 is `Blocked` |
| Initial blocking ticket filed | Pass | `T354-rc-s03-smoke-harness-and-command-repair.md` |
