# T355 - RC S04 Smoke Harness And Command Repair

Status: Todo

## Context

Phase 20 RC Scenario S04 validates the Arena swarm -> dedupe signals -> Review
Board -> VDI update path. T342 requires the shared smoke command:

```bash
bun run e2e:smoke -- --scenario s04-arena-swarm-vdi
```

Current `scripts/e2e-smoke.ts` registers S01 through S03, but not S04. T342 also
points at stale test paths: `packages/shared/src/agent/swarm/__tests__/**` and a
VDI UI glob that matches no files.

## Goal

Register `s04-arena-swarm-vdi` in the RC smoke harness and repair the T342
validation command paths so the deterministic Arena swarm, signal dedupe, Review
Board, and VDI coverage is rerunnable.

## TDD Requirements

1. Extend `scripts/__tests__/e2e-smoke-harness.test.ts` first so it fails while
   `s04-arena-swarm-vdi` is unsupported.
2. Assert the S04 scenario points at the current swarm signal processor, Review
   Board, Experience runtime, Arena Builder, Progression, and Global HUD tests.
3. Keep existing S01, S02, and S03 behavior unchanged.

## Implementation Requirements

- Add no production dependency.
- Do not change Arena, Review Board, VDI, or Experience runtime behavior.
- Update T342 validation commands from stale globs to current test paths.
- Mark this ticket DONE only after the S04 smoke command passes locally.

## Validation Commands

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

## Acceptance Criteria

- [ ] Harness contract test fails before implementation for unsupported S04.
- [ ] `s04-arena-swarm-vdi` is listed in supported scenarios.
- [ ] S04 smoke runs current swarm signal processor and Review Board tests.
- [ ] S04 smoke runs current Experience runtime and VDI/HUD tests.
- [ ] T342 no longer references stale swarm/VDI globs.
- [ ] Existing S01 Linux host-blocker behavior is unchanged.
- [ ] Worklog captures red/green evidence.

## Worklog

Update `docs/worklog/T355-rc-s04-smoke-harness-and-command-repair.md`.
