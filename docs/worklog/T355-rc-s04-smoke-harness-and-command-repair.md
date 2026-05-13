# T355 - RC S04 Smoke Harness And Command Repair

## 1. Task Summary

Repair the S04 RC smoke harness path and stale validation commands so
`T342-rc-s04-arena-swarm-vdi-update` can be rerun reproducibly.

## 2. Repo Context Discovered

The root `e2e:smoke` script exists after T352, with S02 and S03 registered by
T353 and T354. `scripts/e2e-smoke.ts` still did not register
`s04-arena-swarm-vdi`, so T342 failed with an unsupported-scenario message.

The T342 test paths reference an old `packages/shared/src/agent/swarm` location
and a VDI glob that matches no files. Current coverage lives under
`packages/shared/src/workbench` and explicit Workbench renderer tests.

## 3. Files Inspected

- `docs/tickets/T342-rc-s04-arena-swarm-vdi-update.md`
- `docs/tickets/T355-rc-s04-smoke-harness-and-command-repair.md`
- `docs/worklog/T342-rc-s04-arena-swarm-vdi-update.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
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

Added a failing S04 harness/path contract to
`scripts/__tests__/e2e-smoke-harness.test.ts`.

## 5. Expected Failing Test Output

```text
error: Unsupported scenario "s04-arena-swarm-vdi". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint
```

The stale T342 swarm and VDI paths also matched zero files.

## 6. Implementation Changes

- Registered `s04-arena-swarm-vdi` in `scripts/e2e-smoke.ts`.
- Routed S04 to current swarm signal processor, Review Board, Experience
  runtime, Arena Builder, Progression, and Global HUD tests.
- Replaced the stale T342 validation commands with current explicit test paths.
- Marked `T355` as `Status: DONE`.
- Updated T342 worklog and RC evidence to show the harness repair is complete
  while packaged screenshot/browser-console evidence remains pending.

## 7. Validation Commands Run

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s04-arena-swarm-vdi
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## 8. Passing Test Output Summary

- Initial S04 harness contract failed for the expected unsupported-scenario
  reason, then passed after implementation: 5 pass, 0 fail, 19 expectations.
- `bun run e2e:smoke -- --scenario s04-arena-swarm-vdi`: pass, 42 tests, 0
  fail, 197 expectations.
- `bun run e2e:smoke -- --scenario s01-registration`: still exits code 78 with
  the expected `darwin` host-environment blocker on this Linux host.
- `bun run validate:agent-contract`: ok, 11 skills, 310 tickets, 7 required
  docs.
- `bun run validate:docs`, `bun run validate:rebrand`, `bun run
  validate:roadmap`, and `git diff --check` passed.

## 9. Build Output Summary

No build was run. The change is a smoke harness/test-path repair and does not
change runtime application code.

## 10. Remaining Risks

- S04 still needs packaged Electron UI screenshots and browser-console evidence
  before T342 can move to `DONE`.
- The S04 harness currently uses deterministic shared/renderer tests rather than
  a packaged Electron UI run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Harness contract test fails before implementation for unsupported S04 | Pass | Initial harness test exited 1 with unsupported S04 |
| `s04-arena-swarm-vdi` is listed in supported scenarios | Pass | Harness test passes and `e2e:smoke` runs S04 |
| S04 smoke runs current swarm signal processor and Review Board tests | Pass | `e2e:smoke` S04 includes shared workbench tests and passes |
| S04 smoke runs current Experience runtime and VDI/HUD tests | Pass | `e2e:smoke` S04 includes renderer HUD/Progression tests and passes |
| T342 no longer references stale swarm/VDI globs | Pass | Harness test asserts stale paths are absent |
| Existing S01 Linux host-blocker behavior is unchanged | Pass | S01 still exits 78 on Linux with explicit darwin requirement |
| Worklog captures red/green evidence | Pass | This worklog records the failing and passing commands |
