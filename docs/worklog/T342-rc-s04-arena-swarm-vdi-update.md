# T342 - RC Scenario S04: Arena Swarm VDI Update

## 1. Task Summary

Validate RC Scenario S04: Arena swarm produces signals, dedupes duplicate
signals, surfaces the consolidated signal set in Review Board coverage, and
updates VDI/Experience HUD state from evidence.

## 2. Repo Context Discovered

`T342` is a validation-only Phase 20 ticket. It says to file blocking tickets for
regressions instead of changing runtime behavior in this ticket.

The shared RC smoke harness registers S01 through S03 after T354, but
`s04-arena-swarm-vdi` is not registered. The S04 smoke command exits at the
harness before it can run current Arena swarm/VDI coverage.

Current swarm signal coverage lives under `packages/shared/src/workbench`, not
`packages/shared/src/agent/swarm`. Current VDI/HUD coverage lives in explicit
Workbench renderer test files; the VDI glob in T342 matches zero files.

## 3. Files Inspected

- `docs/tickets/T342-rc-s04-arena-swarm-vdi-update.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `packages/shared/src/workbench/swarm-signal-processor.ts`
- `packages/shared/src/workbench/__tests__/swarm-signal-processor.test.ts`
- `packages/shared/src/workbench/__tests__/review-board.test.ts`
- `packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts`
- `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`
- `packages/shared/src/workbench/__tests__/experience-state-binding.test.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx`

## 4. Tests Added First

No code test was added in this validation-only ticket. The red validation checks
are the required S04 smoke command and the T342-listed swarm/VDI test paths.

## 5. Expected Failing Test Output

Command:

```bash
bun run e2e:smoke -- --scenario s04-arena-swarm-vdi
```

Observed failure:

```text
[e2e-smoke] Unsupported scenario "s04-arena-swarm-vdi". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint
error: script "e2e:smoke" exited with code 1
```

The T342-listed targeted paths also failed because their filters matched zero
files:

```text
The following filters did not match any test files:
 packages/shared/src/agent/swarm/__tests__/**

The following filters did not match any test files:
 apps/electron/src/renderer/components/workbench/**/__tests__/vdi*.test.*
```

## 6. Implementation Changes

- Marked `T342` as `Status: Blocked`.
- Filed blocker ticket `T355-rc-s04-smoke-harness-and-command-repair.md`.
- Updated the RC evidence table row for S04 to `Blocked`.
- Added the blocker to the RC evidence blocker table.

No runtime files were changed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s04-arena-swarm-vdi
bun test packages/shared/src/agent/swarm/__tests__/**
bun test apps/electron/src/renderer/components/workbench/**/__tests__/vdi*.test.*
bun test packages/shared/src/workbench/__tests__/swarm-signal-processor.test.ts packages/shared/src/workbench/__tests__/review-board.test.ts packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts packages/shared/src/workbench/__tests__/experience-state-binding.test.ts apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx
```

## 8. Passing Test Output Summary

- Current adjacent swarm/review/VDI tests: 42 pass, 0 fail, 197 expectations.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes.

## 10. Remaining Risks

- S04 smoke harness entry is not registered yet; T355 tracks that repair.
- S04 has not produced packaged Electron UI screenshots or browser-console
  evidence.
- The passing tests prove deterministic swarm/review/VDI behavior, not a full
  packaged UI run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Arena builder allows selecting and launching 2+ agents as a swarm | Partial | Arena Builder tests pass; packaged UI smoke pending |
| Swarm run produces visible signals in the signal list | Partial | Experience e2e scenario and Mission Control swarm coverage are adjacent; packaged UI smoke pending |
| Duplicate signals are collapsed with a dedup count | Partial | `swarm-signal-processor` tests pass |
| Review Board shows consolidated deduped signals | Partial | Review Board tests pass; packaged UI smoke pending |
| Global HUD VDI indicator updates after swarm completes | Partial | Global HUD and Progression tests pass; packaged UI smoke pending |
| VDI update is traceable to swarm output | Partial | Experience runtime/e2e tests pass; packaged UI smoke pending |
| Screenshot evidence captured and referenced | Blocked | No screenshot captured in current deterministic test harness |
| RC evidence row S04 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S04 is `Blocked` |
| Initial blocking ticket filed | Pass | `T355-rc-s04-smoke-harness-and-command-repair.md` |
