# T363 - RC S09 Full Suite Shared Fixture Repair

## 1. Task Summary

Repair the remaining full `bun test` failures that keep RC Scenario S09 blocked
after the S09 smoke harness registration itself was repaired.

## 2. Repo Context Discovered

T362 proves the S09 smoke harness path. After rebase onto `origin/main` at
`303b0b05` and the T364 lint repair, the command
`bun run e2e:smoke -- --scenario s09-upstream-rox-flows` passes 325 tests
across 32 files.

The full suite initially remained red with a broad set of failures that
pre-dated the harness registration and spanned multiple ownership areas. Fresh
full-suite evidence on the rebased branch first exited 1 with 6404 pass, 13
skip, 181 fail, and 2 errors across 558 files.

The blocker was repaired through focused follow-up tickets:

- T365 repaired the R.9 community-link audit allowlist.
- T366 repaired the auto-update signature test's filesystem/path/os mock
  pollution against shared config/storage tests.
- T367 repaired the auto-update signature test's Electron/shared-config mock
  pollution against later Electron main tests.

After T367, full `bun test` exits 0 with 6709 pass, 13 skip, 0 fail, and 1
snapshot across 558 files.

## 3. Files Inspected

- `docs/tickets/T362-rc-s09-full-gate-and-smoke-harness-repair.md`
- `docs/worklog/T362-rc-s09-full-gate-and-smoke-harness-repair.md`
- `docs/tickets/T364-rc-rebased-cheatsheet-shadow-lint-repair.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- Full `bun test` terminal output from `2026-05-14T00:31:03Z`
- `/tmp/rox-m11-repair-bun-test-after-t367-20260514.log`
- `docs/tickets/T365-rc-full-suite-r9-community-link-audit.md`
- `docs/worklog/T365-rc-full-suite-r9-community-link-audit.md`
- `docs/tickets/T366-rc-full-suite-fs-mock-isolation.md`
- `docs/worklog/T366-rc-full-suite-fs-mock-isolation.md`
- `docs/tickets/T367-rc-full-suite-electron-config-mock-isolation.md`
- `docs/worklog/T367-rc-full-suite-electron-config-mock-isolation.md`

## 4. Tests Added First

No new test file was added directly in this umbrella ticket. The RED evidence
was captured in the focused repair tickets:

- T365: full-suite `scripts/__tests__/community-link-audit.test.ts` failure.
- T366: `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
  packages/shared/src/config/__tests__/storage-migrations.test.ts`.
- T367: `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
  apps/electron/src/main/__tests__/browser-pane-manager.test.ts`.

## 5. Expected Failing Test Output

Fresh full-gate blocker on `303b0b05`:

```text
6404 pass
13 skip
181 fail
2 errors
Ran 6598 tests across 558 files. [130.59s]
```

Intermediate full-gate evidence after T366:

```text
6615 pass
13 skip
6 fail
1 error
Ran 6634 tests across 558 files. [137.80s]
```

## 6. Implementation Changes

- Kept the umbrella T363 ticket as the full-gate blocker tracker.
- Split independent failures into focused T365/T366/T367 repair tickets with
  their own RED/GREEN evidence and atomic commits.
- Refreshed this worklog after the full test gate, S09 smoke, typecheck, lint,
  and build gates passed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s09-upstream-rox-flows
bun run typecheck
bun run lint
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
bun test
bun run build
git diff --check
```

## 8. Passing Test Output Summary

- `bun test`: 6709 pass, 13 skip, 0 fail, 1 snapshot, 26631 expect calls,
  558 files.
- `bun run e2e:smoke -- --scenario s09-upstream-rox-flows`: 325 pass, 0 fail,
  1 snapshot, 10270 expect calls, 32 files, then `[e2e-smoke] pass
  s09-upstream-rox-flows`.
- `bun run typecheck`: exits 0 (`typecheck:shared`).
- `bun run lint`: exits 0 with 7 pre-existing warnings and 0 errors.
- `bun run validate:docs`: agent contract (`11 skills, 331 tickets, 7
  required docs`), architecture docs, and sync v2 design validations pass.
- `bun run validate:rebrand`: pass, no forbidden tokens outside the allowlist.
- `bun run validate:roadmap`: `validate:roadmap OK - 46 phases, 110 tickets
  across detail files`.
- `git diff --check`: pass.

## 9. Build Output Summary

`bun run build` exits 0. The Electron build completed main, preload, renderer,
resources, and asset copy steps. Vite emitted its existing dynamic-import/chunk
size warnings, but the build command completed successfully.

## 10. Remaining Risks

- Root `bun run typecheck` passes because the repository script currently runs
  `typecheck:shared`. Separate `bun run typecheck:electron` was run during
  T366/T367 and still exits 2 on unrelated renderer/playground fixture errors
  (`BrowserInstanceInfo.hungTab`, RTL matcher declarations, and
  `TeamManagementStatus`).
- Full lint still reports 7 pre-existing warnings and 0 errors.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Full `bun test` passes with zero failures and zero errors | Pass | 6709 pass, 13 skip, 0 fail |
| S09 smoke remains green | Pass | S09 smoke passes 325 tests across 32 files |
| C4 tenant isolation passes in full gate | Pass | Full `bun test` exits 0; S09 C4 storage/RPC subset passes |
| RBAC policy/RPC passes in full gate | Pass | Full `bun test` exits 0; S09 RBAC subset passes |
| Experience Layer passes in full gate | Pass | Full `bun test` exits 0; S09 Experience subset passes |
| R.9 community-link audit remains strict and passes | Pass | Full `bun test` exits 0 after T365 |
| Typecheck and lint pass | Pass | Root typecheck exits 0; lint exits 0 with 7 warnings |
| Worklog captures red/green evidence per repaired cluster | Pass | T365, T366, and T367 worklogs contain RED/GREEN evidence |
