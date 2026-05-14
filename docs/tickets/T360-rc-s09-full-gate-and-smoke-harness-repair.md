# T360 - RC S09 Full Gate And Smoke Harness Repair

Status: Blocked

## Context

Phase 20 RC Scenario S09 validates that the current upstream base still passes
the ROX-owned custom-flow surface. T347 requires the shared smoke command:

```bash
bun run e2e:smoke -- --scenario s09-upstream-rox-flows
```

On rebased code base `e10537ef`, the S09 smoke scenario is now registered in
`scripts/e2e-smoke.ts` and passes. The full `bun test` gate is still red with
181 failures and 2 errors across the community-link audit, file RPC scope
handling, session persistence, audit sink/bootstrap, storage/config migration
and scope behavior, user-data and theme persistence, tenant credential fallback,
i18n/labels, resource/session bundling, workspace skills, large-result guards,
default workspace bundle, Electron storage scope, runtime resolver paths, and
backend creation.

`origin/main` advanced again to `303b0b05` after this evidence was captured.
[T361](T361-rc-s09-full-suite-shared-fixture-repair.md) carries the remaining
full-suite repair so the S09 harness registration can stay atomic.

## Goal

Register `s09-upstream-rox-flows` in the RC smoke harness and identify the
remaining full-gate blocker so the upstream base can be validated against the
ROX custom-flow surface without hiding broad suite regressions.

## TDD Requirements

1. Extend `scripts/__tests__/e2e-smoke-harness.test.ts` first so it fails while
   `s09-upstream-rox-flows` is unsupported.
2. Add or update focused regression tests before each production/source repair
   when a failing full-suite cluster lacks an exact failing test.
3. Keep the existing S01 through S08 smoke behavior unchanged.
4. Prove the final S09 repair with `bun run e2e:smoke -- --scenario
   s09-upstream-rox-flows` and the full `bun test` gate.

## Implementation Requirements

- Add no production dependency.
- Do not weaken the R.9 community-link audit, C4 storage isolation, RBAC, or
  Experience Layer contracts.
- Preserve the `plan.md §6.2` protected ROX path list.
- Split follow-up repair tickets if investigation shows unrelated root causes
  that should not be fixed atomically with the S09 harness registration.
- Keep this ticket `Blocked` while [T361](T361-rc-s09-full-suite-shared-fixture-repair.md)
  owns the remaining full-suite failures.

## Validation Commands

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s09-upstream-rox-flows
bun test
bun run typecheck
bun run lint
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## Acceptance Criteria

- [x] `s09-upstream-rox-flows` is listed in supported smoke scenarios.
- [x] S09 smoke runs the current ROX custom-flow coverage rather than stale
      globs.
- [ ] `bun test` passes with zero failures.
- [ ] C4 tenant isolation tests pass in the full gate.
- [ ] RBAC policy and RPC tests pass in the full gate.
- [ ] Experience Layer tests pass in the full gate.
- [ ] The R.9 community-link audit remains strict and passes.
- [x] `bun run typecheck` and `bun run lint` pass.
- [x] Worklog captures red/green evidence for the harness registration and
      points the remaining full-suite clusters at T361.

## Worklog

Update `docs/worklog/T360-rc-s09-full-gate-and-smoke-harness-repair.md`.
