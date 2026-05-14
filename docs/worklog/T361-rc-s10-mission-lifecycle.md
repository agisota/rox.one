# T361 - RC S10 Mission Lifecycle Smoke Harness

## 1. Task Summary

Add the RC S10 mission lifecycle smoke harness at
`scripts/rc-smoke/s10-mission-lifecycle.ts`. Walks the deterministic mission
path: create -> dispatch Start -> dispatch Complete -> assert audit-event
emitted on each transition.

## 2. Repo Context Discovered

`scripts/e2e-smoke.ts` registers S01-S08 and is codex-managed. S03 already
covers mission checkpoint + final verification but does not bind the
lifecycle (Start/Complete dispatch) and audit-event emission into a single
rerunnable target. S10 is shipped as a standalone harness in
`scripts/rc-smoke/` so it does not mutate the existing scenario registry or
its contract test (`scripts/__tests__/e2e-smoke-harness.test.ts`).

Existing deterministic mission lifecycle + audit coverage lives in:

- `packages/server-core/src/missions/__tests__/mission-id.test.ts`
- `packages/server-core/src/missions/__tests__/mission-store.test.ts`
- `packages/server-core/src/missions/__tests__/state.test.ts`
- `packages/server-core/src/missions/__tests__/transitions.test.ts`
- `packages/server-core/src/missions/__tests__/scheduler.test.ts`
- `packages/server-core/src/missions/__tests__/host.test.ts`
- `packages/server-core/src/handlers/rpc/__tests__/missions-rpc.test.ts`
- `packages/server-core/src/handlers/rpc/__tests__/missions-rate-limit.test.ts`
- `packages/server-core/src/missions/__tests__/scheduler-audit.test.ts`
- `packages/shared/src/observability/__tests__/audit-event.test.ts`
- `packages/shared/src/observability/__tests__/audit-producer.test.ts`
- `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- `packages/shared/src/workbench/__tests__/mission-lifecycle.test.ts`

## 3. Implementation Changes

- Created `scripts/rc-smoke/s10-mission-lifecycle.ts` (91 LOC) mirroring the
  `scripts/e2e-smoke.ts` S04-S08 shape: explicit `Bun.spawn` runner with an
  explicit test list and `[rc-smoke/s10] start/pass/fail` log line format.
- No production source touched.
- No change to `scripts/e2e-smoke.ts` or its harness contract test.

## 4. Smoke Output

```text
[rc-smoke/s10] start s10-mission-lifecycle: RC S10 mission lifecycle: create, dispatch Start, dispatch Complete, assert audit-event emitted
bun test v1.3.13 (bf2e2cec)
 183 pass
 0 fail
 522 expect() calls
Ran 183 tests across 13 files. [210.00ms]
[rc-smoke/s10] pass s10-mission-lifecycle
```

## 5. Validation Commands Run

```text
$ bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

$ bun run validate:agent-contract
[agent-contract] ok: 11 skills, 324 tickets, 7 required docs

$ bun run validate:roadmap
validate:roadmap OK -- 46 phases, 110 tickets across detail files
```

## 6. Acceptance Matrix

| Criterion | Status | Evidence |
|---|---|---|
| S10 harness file exists and mirrors S04-S08 shape | Pass | `scripts/rc-smoke/s10-mission-lifecycle.ts` |
| Covers mission id/store, state, transitions, scheduler, audit | Pass | Explicit test list in harness |
| Exits non-zero on failure / zero on success | Pass | `process.exit(await runCli())` |
| Existing S01-S08 entries unchanged | Pass | `scripts/e2e-smoke.ts` untouched |
| Worklog captures smoke + validation evidence | Pass | Sections 4-5 above |
