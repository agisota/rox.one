# T363 - RC S09 Full Suite Shared Fixture Repair

Status: Todo

## Context

T362 repaired the missing `s09-upstream-rox-flows` smoke harness registration.
After rebase onto `origin/main` at `303b0b05` and the T364 lint repair, the
targeted S09 smoke still passes 325 tests across 32 files, including protected
ROX paths, C4 storage isolation, RBAC, Composer, and Experience Layer coverage.

The full `bun test` gate remains red with 181 failures and 2 errors across 558
files. Many failing clusters also failed before the S09 harness registration and
are not safe to fold into the harness commit.

## Goal

Repair the remaining full-suite blockers so S09 can move from `Blocked` to
`Pass` without weakening the existing R.9, C4, RBAC, Experience Layer, storage,
resource-bundle, skill, and packaged-runtime contracts.

## TDD Requirements

1. Rebase onto latest `origin/main` before starting repairs.
2. Pick one failing cluster at a time and run its smallest failing test first.
3. Confirm the failure reproduces for the expected reason before editing code.
4. Add or tighten focused regression coverage when a cluster lacks a direct
   failing test.
5. Keep unrelated clusters split into follow-up tickets when they require
   independent ownership or broad refactors.

## Initial Failure Clusters

- R.9 community-link audit.
- File RPC scope/runtime fixture expectations.
- Electron BrowserView import error between tests.
- Session persistence cold-load/flush/hydration behavior.
- File audit sink and host audit producer file output.
- Shared config directory/default bootstrap and C4 storage migration behavior.
- User-data/theme persistence and tenant credential fallback.
- i18n locale file parity and label CRUD default seeding.
- Resource/session bundle export/import, workspace skills, large-result guards,
  default workspace bundle, workspace storage normalization.
- RPC handler registration/profile coverage.
- Electron global storage scope, packaged runtime resolver paths, backend
  creation, and ClaudeAgent model switching.

## Validation Commands

```bash
bun test
bun run e2e:smoke -- --scenario s09-upstream-rox-flows
bun run typecheck
bun run lint
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## Acceptance Criteria

- [ ] Full `bun test` passes with zero failures and zero errors.
- [ ] `bun run e2e:smoke -- --scenario s09-upstream-rox-flows` still passes.
- [ ] C4 tenant isolation tests pass in the full gate.
- [ ] RBAC policy/RPC tests pass in the full gate.
- [ ] Experience Layer tests pass in the full gate.
- [ ] R.9 community-link audit remains strict and passes.
- [ ] `bun run typecheck` and `bun run lint` pass.
- [ ] Worklog captures red/green evidence for each repaired cluster.

## Worklog

Update `docs/worklog/T363-rc-s09-full-suite-shared-fixture-repair.md`.
