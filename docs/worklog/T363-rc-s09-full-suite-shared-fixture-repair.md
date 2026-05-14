# T363 - RC S09 Full Suite Shared Fixture Repair

## 1. Task Summary

Repair the remaining full `bun test` failures that keep RC Scenario S09 blocked
after the S09 smoke harness registration itself was repaired.

## 2. Repo Context Discovered

T362 proves the S09 smoke harness path. After rebase onto `origin/main` at
`303b0b05` and the T364 lint repair, the command
`bun run e2e:smoke -- --scenario s09-upstream-rox-flows` passes 325 tests
across 32 files.

The full suite remains red with a broad set of failures that pre-date the
harness registration and span multiple ownership areas. Fresh full-suite
evidence on the current branch exits 1 with 6404 pass, 13 skip, 181 fail, and 2
errors across 558 files.

## 3. Files Inspected

- `docs/tickets/T362-rc-s09-full-gate-and-smoke-harness-repair.md`
- `docs/worklog/T362-rc-s09-full-gate-and-smoke-harness-repair.md`
- `docs/tickets/T364-rc-rebased-cheatsheet-shadow-lint-repair.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- Full `bun test` terminal output from `2026-05-14T00:31:03Z`

## 4. Tests Added First

Pending. Start with the smallest failing command for the selected cluster.

## 5. Expected Failing Test Output

Fresh full-gate blocker on `303b0b05`:

```text
6404 pass
13 skip
181 fail
2 errors
Ran 6598 tests across 558 files. [130.59s]
```

## 6. Implementation Changes

No source repair was attempted in this ticket. The current pass refreshed the
full-suite blocker evidence after rebase and after T364 restored the lint gate.

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
git diff --check
```

## 8. Passing Test Output Summary

- `bun run e2e:smoke -- --scenario s09-upstream-rox-flows`: 325 pass, 0 fail,
  1 snapshot, 10270 expect calls, 32 files, then `[e2e-smoke] pass
  s09-upstream-rox-flows`.
- `bun run typecheck`: pass.
- `bun run lint`: pass with 7 warnings and 0 errors.
- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills, 328
  tickets, 7 required docs`.
- `bun run validate:docs`: agent contract, architecture docs, and sync v2
  design validations pass.
- `bun run validate:rebrand`: pass.
- `bun run validate:roadmap`: `validate:roadmap OK - 46 phases, 110 tickets
  across detail files`.
- `git diff --check`: pass.

## 9. Build Output Summary

No build was run in this evidence-refresh pass. The full test gate is still
red, and this ticket has not started source repairs.

## 10. Remaining Risks

- The red full-suite clusters span independent areas and may need multiple
  atomic repair tickets.
- The two unhandled errors are still the Electron `BrowserView` named export
  import between tests and the i18n `en.json is required` locale bootstrap
  failure.
- The 181 failing assertions still span R.9 community-link audit, file RPC
  scopes, session persistence, audit file sinks, config/storage migration,
  user-data/theme/credentials, labels, resource/session bundles, skills,
  large-result guards, workspace storage, RPC registration, Electron storage
  scope, packaged runtime resolution, and backend creation.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Full `bun test` passes with zero failures and zero errors | Blocked | Fresh full gate exits 1: 6404 pass, 13 skip, 181 fail, 2 errors |
| S09 smoke remains green | Pass | S09 smoke passes 325 tests across 32 files |
| C4 tenant isolation passes in full gate | Blocked | Targeted S09 C4 storage/RPC tests pass; full gate still has C4-adjacent failures |
| RBAC policy/RPC passes in full gate | Pass | Targeted S09 RBAC policy/RPC tests pass |
| Experience Layer passes in full gate | Pass | Targeted S09 Experience Layer tests pass |
| R.9 community-link audit remains strict and passes | Blocked | Full gate fails `R.9 community-link audit` |
| Typecheck and lint pass | Pass | Typecheck exits 0; lint exits 0 with 7 warnings |
| Worklog captures red/green evidence per repaired cluster | Pending | No repair clusters started; blocker evidence refreshed |
