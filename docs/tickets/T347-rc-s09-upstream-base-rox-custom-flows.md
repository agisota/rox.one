# T347 - RC Scenario S09: Upstream Base Still Passes ROX Custom Flows

Status: Todo

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 9** from `plan.md §16`:

> Upstream v0.9.1 base still passes ROX custom flows.

The scenario verifies that the upstream merge integration (Phase 3 / T230/T231)
has not regressed any ROX-owned custom flows. All ROX-protected surfaces listed
in `plan.md §6.2` — including the Experience Layer, the brand config, the RBAC
system, and the C.4 multi-tenant storage isolation — must continue to pass their
tests after the upstream base is present.

## Goal

Verify that the merged upstream base introduces no behavioral regressions in the
ROX-owned surface area. The ROX custom test suite (including multi-tenant
isolation, RBAC policy, Composer pipeline, and Experience Layer) must be
completely green on a build that carries the upstream merge commit.

## Required UI

None beyond what the existing test suites exercise.

## Required Data/API

- Full test suite coverage including:
  - C.4 tenant isolation tests (`packages/shared/src/config/__tests__/`)
  - RBAC policy tests (`packages/shared/src/auth/__tests__/`)
  - Composer and Experience Layer tests
  - Upstream merge evidence log (T231)

## Required Automations

- CI runs the full gate matrix from `plan.md §6.4` after every upstream merge
- Any regression immediately blocks the merge PR

## Required Subagents

None for this validation ticket.

## TDD Requirements

1. Run `bun test` (full suite) → assert zero failures attributable to
   ROX-owned surfaces.
2. Run `bun run typecheck` → assert zero type errors.
3. Run `bun run lint` → assert zero lint errors.
4. Verify `plan.md §6.2` protected-file list is intact (no upstream overwrite of
   ROX-protected files).

## Implementation Requirements

No new implementation. This is an RC validation scenario.
If the upstream merge has introduced regressions, file blocking tickets under the
Phase 3 scope before Phase 20 can close.

## Validation Commands

```bash
# Full test suite
bun test

# Typecheck
bun run typecheck

# Lint
bun run lint

# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s09-upstream-rox-flows

# Docs and contract gate
bun run validate:agent-contract
bun run validate:docs
```

## Acceptance Criteria

- [ ] `bun test` passes with zero failures on all ROX-protected surfaces
- [ ] `bun run typecheck` passes with zero errors
- [ ] `bun run lint` passes with zero errors
- [ ] All files in `plan.md §6.2` protected-file list are intact and unmodified
      by the upstream merge
- [ ] C.4 tenant isolation tests pass
- [ ] RBAC policy tests pass
- [ ] Experience Layer tests pass
- [ ] Screenshot / terminal output evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S09)

## Worklog

Update `docs/worklog/T347-rc-s09-upstream-base-rox-custom-flows.md` with run
log, test output, and any blocker ticket references.
