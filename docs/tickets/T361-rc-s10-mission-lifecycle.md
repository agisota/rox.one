# T361 - RC S10 Mission Lifecycle Smoke Harness

Status: OPEN

## Context

Phase 20 RC scenarios S01-S08 are registered in `scripts/e2e-smoke.ts`. S09
(T360) adds the RBAC admin flow as a standalone harness in
`scripts/rc-smoke/`. S10 continues the series with the mission lifecycle:

```
create mission -> dispatch Start -> dispatch Complete -> assert audit-event
                                                         emitted
```

S03 (mission checkpoint) already validates checkpoint-and-final-verification
behavior, but does not assert the audit-event emission on each Start/Complete
transition end-to-end. S10 binds the lifecycle + audit emission paths into a
single rerunnable smoke target.

## Goal

Ship a standalone S10 smoke harness at
`scripts/rc-smoke/s10-mission-lifecycle.ts` that mirrors the S04-S08 pattern
(`spawn` + explicit test list) and runs the deterministic mission lifecycle
plus audit-event coverage already present in server-core and shared test
suites.

## Implementation Requirements

- Add no production dependency.
- Do not change mission scheduler, mission RPC, or audit producer runtime
  behavior.
- Do not modify `scripts/e2e-smoke.ts` or
  `scripts/__tests__/e2e-smoke-harness.test.ts` (codex-managed).
- Keep the harness under 300 LOC.

## Validation Commands

```bash
bun run scripts/rc-smoke/s10-mission-lifecycle.ts
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
```

## Acceptance Criteria

- [x] `scripts/rc-smoke/s10-mission-lifecycle.ts` exists and mirrors the
      S04-S08 scenario shape.
- [x] S10 test list covers mission id/store, state, transitions, scheduler,
      host, mission RPC, scheduler audit, audit event, audit producer, and
      audit event store.
- [x] Harness exits non-zero on test failure and zero on success.
- [x] Existing S01-S08 entries in `scripts/e2e-smoke.ts` remain unchanged.
- [x] Worklog captures smoke and validation evidence.

## Worklog

See `docs/worklog/T361-rc-s10-mission-lifecycle.md`.
