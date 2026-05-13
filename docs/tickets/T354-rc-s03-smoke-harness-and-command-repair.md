# T354 - RC S03 Smoke Harness And Command Repair

Status: DONE

## Context

Phase 20 RC Scenario S03 validates the 24h mission -> checkpoint -> final
verification path. T341 requires the shared smoke command:

```bash
bun run e2e:smoke -- --scenario s03-mission-checkpoint
```

Current `scripts/e2e-smoke.ts` only registers S01 and S02, so the S03 command
exits before it can run the deterministic mission coverage. T341 also names a
Mission Control UI glob that does not match current test files.

## Goal

Register `s03-mission-checkpoint` in the RC smoke harness and repair the T341
validation command paths so the deterministic S03 mission/checkpoint coverage is
rerunnable.

## TDD Requirements

1. Extend `scripts/__tests__/e2e-smoke-harness.test.ts` first so it fails while
   `s03-mission-checkpoint` is unsupported.
2. Assert the S03 scenario points at the current durable mission scheduler/store
   tests and current Mission Control/Deep Missions UI tests.
3. Keep existing S01 and S02 behavior unchanged.

## Implementation Requirements

- Add no production dependency.
- Do not change mission runtime behavior.
- Update T341 validation commands from stale globs to current test paths.
- Mark this ticket DONE only after the S03 smoke command passes locally.

## Validation Commands

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

## Acceptance Criteria

- [ ] Harness contract test fails before implementation for unsupported S03.
- [ ] `s03-mission-checkpoint` is listed in supported scenarios.
- [ ] S03 smoke runs current server mission tests.
- [ ] S03 smoke runs current Mission Control/Deep Missions UI tests.
- [ ] T341 no longer references the stale Mission Control glob.
- [ ] Existing S01 Linux host-blocker behavior is unchanged.
- [ ] Worklog captures red/green evidence.

## Worklog

Update `docs/worklog/T354-rc-s03-smoke-harness-and-command-repair.md`.
