# T359 - RC S08 Smoke Harness And Command Repair

Status: DONE

## Context

Phase 20 RC Scenario S08 validates the Share session -> public shortlink path.
T346 requires the shared smoke command:

```bash
bun run e2e:smoke -- --scenario s08-share-session-shortlink
```

Current `scripts/e2e-smoke.ts` registers S01 through S07, but not S08. T346 also
points at stale shortlink/share globs that match no files. Current share
coverage uses explicit session share provider, share provider contract, share
error mapping, and renderer share-flow state tests.

## Goal

Register `s08-share-session-shortlink` in the RC smoke harness and repair T346
validation command paths so deterministic share shortlink coverage is
rerunnable.

## TDD Requirements

1. Extend `scripts/__tests__/e2e-smoke-harness.test.ts` first so it fails while
   `s08-share-session-shortlink` is unsupported.
2. Assert the S08 scenario points at current session share provider, share
   provider contract, share error mapping, and renderer share-flow state tests.
3. Keep existing S01 through S07 behavior unchanged.

## Implementation Requirements

- Add no production dependency.
- Do not change share/provider/runtime behavior.
- Update T346 validation commands from stale globs to current explicit paths.
- Mark this ticket DONE only after the S08 smoke command passes locally.

## Validation Commands

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s08-share-session-shortlink
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## Acceptance Criteria

- [x] Harness contract test fails before implementation for unsupported S08.
- [x] `s08-share-session-shortlink` is listed in supported scenarios.
- [x] S08 smoke runs current session share provider integration tests.
- [x] S08 smoke runs current share provider contract/security tests.
- [x] S08 smoke runs current share error mapping tests.
- [x] S08 smoke runs current renderer share-flow state tests.
- [x] T346 no longer references stale shortlink/share globs.
- [x] Existing S01 Linux host-blocker behavior is unchanged.
- [x] Worklog captures red/green evidence.

## Worklog

Update `docs/worklog/T359-rc-s08-smoke-harness-and-command-repair.md`.
