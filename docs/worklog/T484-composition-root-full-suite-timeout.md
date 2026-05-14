# T484 - Composition root full-suite timeout stabilization

Status: DONE
Phase: Full-suite validation repair
Ticket: docs/tickets/T484-composition-root-full-suite-timeout.md

## 1. Task summary

Stabilize the T246d composition-root audit-producer test file after the current
main full-suite run showed a timeout cluster that does not reproduce when the
file is run alone.

## 2. Repo context discovered

Current main is aligned with `origin/main` after PR #218. Targeted C4 tests,
`validate:docs`, `typecheck`, and `lint` are green. A fresh full `bun test`
failed 10 tests, all under `bootstrapServer composition root - T246d audit
producer wire`. The same file passes in isolation, with each case taking about
2s because `bootstrapServer` opens a local server and then exercises shutdown.

## 3. Files inspected

- `packages/server-core/src/bootstrap/__tests__/composition-root.test.ts`
- `packages/server-core/src/bootstrap/headless-start.ts`
- `packages/server-core/src/bootstrap/audit-bootstrap.ts`
- `docs/tickets/T483-workspace-scope-circleci-timeout.md`
- `docs/worklog/T483-workspace-scope-circleci-timeout.md`

## 4. Tests added first

No new assertion was added. The RED evidence is the fresh full `bun test`
failure against the existing composition-root scenarios.

## 5. Expected failing test output

Fresh full-suite RED summary:

```text
10 tests failed:
(fail) bootstrapServer composition root - T246d audit producer wire > attaches a real audit producer onto deps.auditProducer when env is not disabled
(fail) bootstrapServer composition root - T246d audit producer wire > installs a no-op producer when ROX_AUDIT_DISABLE=1 (factory never called)
(fail) bootstrapServer composition root - T246d audit producer wire > stop() disposes the audit chain exactly once even when called repeatedly
(fail) bootstrapServer composition root - T246d audit producer wire > emits real events through the wired producer (round-trip via deps.auditProducer)
(fail) bootstrapServer composition root - T246d audit producer wire > forwards auditProducerOptions host options (logDir / retention / clock) to the chain factory
(fail) bootstrapServer composition root - T246d audit producer wire > exposes the auditHandle on ServerInstance so hosts can flush manually
(fail) bootstrapServer composition root - T246d audit producer wire > honours an absent auditProducerOptions (defaults flow through to attachAuditProducer)
(fail) bootstrapServer composition root - T246d audit producer wire > attaches the producer BEFORE registerAllRpcHandlers fires (so handlers see auditProducer)
(fail) bootstrapServer composition root - T246d audit producer wire > swallows audit dispose errors during stop() so shutdown finishes cleanly
(fail) bootstrapServer composition root - T246d audit producer wire > keeps the audit wire scoped to deps.auditProducer (other deps fields preserved)
```

Isolation check before the change passed: 10 pass, 0 fail, about 20.25s total,
with individual cases around 2s.

## 6. Implementation changes

- Added `setDefaultTimeout(30_000)` to
  `packages/server-core/src/bootstrap/__tests__/composition-root.test.ts`.
- Left every composition-root scenario and expectation unchanged.

## 7. Validation commands run

- `bun test packages/server-core/src/bootstrap/__tests__/composition-root.test.ts`
- `bun test packages/server-core`
- `bun test`

## 8. Passing test output summary

The targeted composition-root file passed after the timeout stabilization: 10
pass, 0 fail, 27 expect calls, about 20.24s.

The package-level server-core smoke passed: 978 pass, 0 fail, 2692 expect
calls across 83 files.

The full suite passed after the stabilization: 6918 pass, 13 skip, 0 fail, 1
snapshot, and 27571 expect calls across 566 files.

## 9. Build output summary

No runtime build is required for this test-only change. Build status remains
tracked separately for the broader PR #218/main validation pass.

## 10. Remaining risks

R.11 remains blocked by report-only preflight gates and is not part of this
fix. The composition-root test remains intentionally slower than a unit-only
test because it exercises the full bootstrap/stop lifecycle with a local socket.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Full-suite RED evidence points only at the composition-root timeout cluster | PASS | Fresh `bun test` failed 10 tests, all in the T246d composition-root describe block |
| Composition-root timeout budget is explicit and test-only | PASS | `composition-root.test.ts` calls `setDefaultTimeout(30_000)` and no runtime file changed |
| Composition-root test file passes locally without skipped cases | PASS | 10 pass, 0 fail, 27 expect calls |
| Full `bun test` passes locally or any remaining failure is documented as unrelated fresh evidence | PASS | 6918 pass, 13 skip, 0 fail |
| No destructive R.11 action is performed | PASS | Only read-only R.11 commands and this test/docs patch were used |
