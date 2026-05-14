# T360 - RC S09 Full Gate And Smoke Harness Repair

## 1. Task Summary

Register the missing `s09-upstream-rox-flows` RC smoke scenario and repair the
S09 validation harness so the upstream base can be checked against ROX-owned
custom-flow coverage. The targeted smoke path is repaired; the full-suite gate
is split to T361 because it remains broadly red outside this atomic harness
change.

## 2. Repo Context Discovered

The root `e2e:smoke` package script points at `scripts/e2e-smoke.ts`. The smoke
harness currently registers S01 through S08 as static scenario definitions, and
`scripts/__tests__/e2e-smoke-harness.test.ts` keeps one documentation-style
coverage test per scenario.

T347 requires S09 to cover ROX-owned surfaces after upstream merge: C4 tenant
storage isolation, RBAC policy/RPC behavior, Composer pipeline, Experience
Layer, and the protected path list from `plan.md §6.2`. An explorer pass
confirmed the existing harness pattern and recommended the current distributed
C4/RBAC/Experience matrix. `origin/main` later advanced to `303b0b05`; this
ticket's fresh local evidence is on code base `e10537ef`.

## 3. Files Inspected

- `AGENTS.md`
- `docs/tickets/T347-rc-s09-upstream-base-rox-custom-flows.md`
- `docs/tickets/T360-rc-s09-full-gate-and-smoke-harness-repair.md`
- `docs/tickets/T361-rc-s09-full-suite-shared-fixture-repair.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `scripts/__tests__/protected-rox-paths.test.ts`
- `plan.md`

## 4. Tests Added First

Added `RC E2E smoke harness > recognizes S09 upstream ROX flows and documents
current validation paths` to `scripts/__tests__/e2e-smoke-harness.test.ts`
before implementing the harness scenario.

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
```

The test requires `s09-upstream-rox-flows` to be listed and to include the
current C4, RBAC, Composer, Experience Layer, and protected-path validation
surface.

## 5. Expected Failing Test Output

Observed before implementation:

```text
error: Unsupported scenario "s09-upstream-rox-flows". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi, s05-team-invite-rbac, s06-file-upload-entity-graph, s07-sync-conflict-resolution, s08-share-session-shortlink
(fail) RC E2E smoke harness > recognizes S09 upstream ROX flows and documents current validation paths

9 pass
1 fail
```

## 6. Implementation Changes

- Added `S09_UPSTREAM_ROX_FLOW_TESTS` to `scripts/e2e-smoke.ts`.
- Registered `s09-upstream-rox-flows` in `SUPPORTED_SCENARIOS`.
- Added `scripts/__tests__/protected-rox-paths.test.ts` to keep `plan.md §6.2`
  and the worktree protected-path list executable.
- Updated the T360 ticket to `Blocked` because the smoke harness is repaired
  but the full suite remains red.
- Filed T361 for the remaining full-suite shared-fixture/runtime failures.
- Updated the RC evidence row and blocker table for S09.

## 7. Validation Commands Run

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun test scripts/__tests__/protected-rox-paths.test.ts
bun run e2e:smoke -- --scenario s09-upstream-rox-flows
bun run typecheck
bun run lint
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
bun test
git diff --check
```

## 8. Passing Test Output Summary

- `bun test scripts/__tests__/e2e-smoke-harness.test.ts`: 10 pass, 0 fail.
- `bun test scripts/__tests__/protected-rox-paths.test.ts`: 2 pass, 0 fail.
- `bun run e2e:smoke -- --scenario s09-upstream-rox-flows`: 325 pass, 0 fail,
  1 snapshot, 10270 expect calls, 32 files, then `[e2e-smoke] pass
  s09-upstream-rox-flows`.
- `bun run typecheck`: pass.
- `bun run lint`: exit 0 with 7 warnings and 0 errors.
- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills, 324 tickets, 7 required docs`.
- `bun run validate:docs`: agent contract, architecture docs, and sync v2 design validations pass.
- `bun run validate:rebrand`: pass.
- `bun run validate:roadmap`: `validate:roadmap OK — 46 phases, 110 tickets across detail files`.
- `git diff --check`: pass.

## 9. Build Output Summary

No build was run in this pass. The change is limited to the RC smoke harness,
tests, and release/ticket documentation, and the full `bun test` gate is still
red. Build remains part of the downstream RC completion gate.

## 10. Remaining Risks

- Full `bun test` exits 1 with 181 failures and 2 errors on code base
  `e10537ef`; T361 owns this remaining blocker.
- `origin/main` advanced to `303b0b05` after the fresh local evidence, so T361
  must rebase and refresh the full-gate shape before editing.
- Packaged Electron screenshot/browser-console evidence is still pending for
  the RC scenario.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| `s09-upstream-rox-flows` is listed in supported smoke scenarios | Pass | Harness test resolves S09 |
| S09 smoke runs current ROX custom-flow coverage | Pass | S09 smoke passes 325 tests across 32 files |
| `bun test` passes with zero failures | Blocked | Full gate exits 1 with 181 fail and 2 errors; split to T361 |
| C4 tenant isolation tests pass in the full gate | Blocked | Targeted S09 C4 smoke passes; full gate has C4-adjacent failures |
| RBAC policy and RPC tests pass in the full gate | Pass | Targeted S09 RBAC policy/RPC tests pass |
| Experience Layer tests pass in the full gate | Pass | Targeted S09 Experience Layer tests pass |
| R.9 community-link audit remains strict and passes | Blocked | Full gate still fails R.9 community-link audit |
| `bun run typecheck` and `bun run lint` pass | Pass | Typecheck exits 0; lint exits 0 with 7 warnings |
| Worklog captures red/green evidence for every repaired cluster | Pass | Harness red/green captured; full-suite clusters split to T361 |
