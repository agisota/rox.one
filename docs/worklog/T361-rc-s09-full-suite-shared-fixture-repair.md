# T361 - RC S09 Full Suite Shared Fixture Repair

## 1. Task Summary

Repair the remaining full `bun test` failures that keep RC Scenario S09 blocked
after the S09 smoke harness registration itself was repaired.

## 2. Repo Context Discovered

T360 proves the S09 smoke harness path on code base `e10537ef`: the command
`bun run e2e:smoke -- --scenario s09-upstream-rox-flows` passes 325 tests
across 32 files. The full suite remains red with a broad set of failures that
pre-date the harness registration and span multiple ownership areas.

## 3. Files Inspected

- `docs/tickets/T360-rc-s09-full-gate-and-smoke-harness-repair.md`
- `docs/worklog/T360-rc-s09-full-gate-and-smoke-harness-repair.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- Full `bun test` terminal output from `2026-05-14T00:17:32Z`

## 4. Tests Added First

Pending. Start with the smallest failing command for the selected cluster.

## 5. Expected Failing Test Output

Initial full-gate blocker:

```text
6380 pass
13 skip
181 fail
2 errors
Ran 6574 tests across 556 files. [141.55s]
```

## 6. Implementation Changes

Pending.

## 7. Validation Commands Run

Pending.

## 8. Passing Test Output Summary

Pending.

## 9. Build Output Summary

Pending.

## 10. Remaining Risks

- The red full-suite clusters span independent areas and may need multiple
  atomic repair tickets.
- `origin/main` advanced to `303b0b05` after this evidence was captured, so the
  next repair pass must rebase and refresh the failure shape first.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Full `bun test` passes with zero failures and zero errors | Pending | Initial evidence: 181 failures and 2 errors |
| S09 smoke remains green | Pending | T360 evidence passes; not rerun in this ticket yet |
| C4 tenant isolation passes in full gate | Pending | Full gate still red |
| RBAC policy/RPC passes in full gate | Pending | S09 targeted smoke passes; full gate still red |
| Experience Layer passes in full gate | Pending | S09 targeted smoke passes; full gate still red |
| R.9 community-link audit remains strict and passes | Pending | Full gate currently fails R.9 audit |
| Typecheck and lint pass | Pending | T360 evidence passes; not rerun in this ticket yet |
| Worklog captures red/green evidence per repaired cluster | Pending | No repairs started |
