# T356 - RC S05 Smoke Harness Registration

Status: Todo

## Context

Phase 20 RC Scenario S05 validates the Team invite -> shared workspace -> RBAC
check path. T343 requires the shared smoke command:

```bash
bun run e2e:smoke -- --scenario s05-team-invite-rbac
```

Current `scripts/e2e-smoke.ts` registers S01 through S04, but not S05. The
targeted RBAC, policy, and scope-forgery commands in T343 pass on current main,
so the remaining deterministic blocker is the missing harness scenario entry.

## Goal

Register `s05-team-invite-rbac` in the RC smoke harness so the deterministic
Team invite, RBAC, policy, and scope-forgery coverage is rerunnable from the
shared Phase 20 smoke command.

## TDD Requirements

1. Extend `scripts/__tests__/e2e-smoke-harness.test.ts` first so it fails while
   `s05-team-invite-rbac` is unsupported.
2. Assert the S05 scenario points at current roles RPC, policy engine,
   scope-forgery, account team invite, and RBAC settings state tests.
3. Keep existing S01 through S04 behavior unchanged.

## Implementation Requirements

- Add no production dependency.
- Do not change RBAC, account team, or settings runtime behavior.
- Mark this ticket DONE only after the S05 smoke command passes locally.

## Validation Commands

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s05-team-invite-rbac
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## Acceptance Criteria

- [ ] Harness contract test fails before implementation for unsupported S05.
- [ ] `s05-team-invite-rbac` is listed in supported scenarios.
- [ ] S05 smoke runs current roles RPC and role audit/rate-limit tests.
- [ ] S05 smoke runs current policy engine and scope-forgery tests.
- [ ] S05 smoke runs current account-team invite and RBAC settings state tests.
- [ ] Existing S01 Linux host-blocker behavior is unchanged.
- [ ] Worklog captures red/green evidence.

## Worklog

Update `docs/worklog/T356-rc-s05-smoke-harness-registration.md`.
