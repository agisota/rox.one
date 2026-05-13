# T358 - RC S07 Smoke Harness And Command Repair

Status: Todo

## Context

Phase 20 RC Scenario S07 validates the sync push/pull conflict path. T345
requires the shared smoke command:

```bash
bun run e2e:smoke -- --scenario s07-sync-conflict-resolution
```

Current `scripts/e2e-smoke.ts` registers S01 through S06, but not S07. T345 also
points at a stale sync glob that matches no files because current sync coverage
uses explicit filenames such as `workspace-sync-service.test.ts`,
`local-cloud-sync.test.ts`, and `workspace-sync-multi-client-conflict.test.ts`.

## Goal

Register `s07-sync-conflict-resolution` in the RC smoke harness and repair T345
validation command paths so deterministic sync conflict coverage is rerunnable.

## TDD Requirements

1. Extend `scripts/__tests__/e2e-smoke-harness.test.ts` first so it fails while
   `s07-sync-conflict-resolution` is unsupported.
2. Assert the S07 scenario points at current local/cloud sync, workspace sync,
   and multi-client conflict tests.
3. Keep existing S01 through S06 behavior unchanged.

## Implementation Requirements

- Add no production dependency.
- Do not change sync runtime behavior.
- Update T345 validation commands from the stale glob to current explicit paths.
- Mark this ticket DONE only after the S07 smoke command passes locally.

## Validation Commands

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s07-sync-conflict-resolution
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## Acceptance Criteria

- [ ] Harness contract test fails before implementation for unsupported S07.
- [ ] `s07-sync-conflict-resolution` is listed in supported scenarios.
- [ ] S07 smoke runs current local/cloud sync tests.
- [ ] S07 smoke runs current workspace sync service tests.
- [ ] S07 smoke runs current multi-client conflict tests.
- [ ] T345 no longer references the stale sync glob.
- [ ] Existing S01 Linux host-blocker behavior is unchanged.
- [ ] Worklog captures red/green evidence.

## Worklog

Update `docs/worklog/T358-rc-s07-smoke-harness-and-command-repair.md`.
