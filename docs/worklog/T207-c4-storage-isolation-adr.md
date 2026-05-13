# T207 - C4 storage isolation ADR

## 1. Task summary

Document the implemented C4 multi-tenant storage isolation contract in ADR 0007 and update ADR 0005's deferred-tenancy section to reference it.

## 2. Repo context discovered

- ADR 0005 reserved the `kind: 'workspace'` arm but explicitly deferred forgery defense, per-tenant config-dir resolution, and audit logging.
- C4 now implements nominal branded scopes, opt-in tenant path resolution, downgrade behavior, audit events, and one demo RPC caller.
- Per-tenant credential key derivation, RBAC population, data migration tooling, audit storage backend, Pi IPC propagation, and remaining handler migrations remain out of scope.

## 3. Files inspected

- `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`
- `docs/decision-records/audit-harness/0006-account-identity-foundation.md`
- `docs/superpowers/plans/2026-05-10-c4-multi-tenant-storage-isolation.md`
- `docs/superpowers/specs/2026-05-10-c4-multi-tenant-storage-isolation-design.md`

## 4. Tests added first

No runtime tests are added for this documentation-only ticket.

## 5. Expected failing test output

None. Verification is file/reference checks after documentation edits.

## 6. Implementation changes

- Added `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`.
- Documented branded scope minting, `deriveScopeFromAuth()`, `ROX_MULTI_TENANT=1`, flat single-user preservation, tenant-prefixed path resolution, audit events, runtime brand checks, demo RPC caller status, and C4 out-of-scope follow-ups.
- Updated ADR 0005's multi-tenant out-of-scope item to point at ADR 0007 for the implemented forgery, config-dir resolution, and audit baseline while preserving deferred follow-up work.

## 7. Validation commands run

- `test -f docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md && echo ADR0007_EXISTS`
- `rg -n "ADR 0007|multi-tenant runtime|workspace-id forgery|scope leakage|audit logging|scope.factory.forgery_rejected|BrandedScopeBreachError|ROX_MULTI_TENANT" docs/decision-records/audit-harness/0005-storage-tenancy-contract.md docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `git diff --check`

## 8. Passing test output summary

- ADR existence check printed `ADR0007_EXISTS`.
- Reference scan found ADR 0007's runtime/forgery/audit terms and ADR 0005's ADR 0007 reference.
- `git diff --check`: passed.

## 9. Build output summary

Not run for this documentation-only ticket. Full build remains part of the final C4 validation gate.

## 10. Remaining risks

- Final lint/full-test/build validation remains pending.
- ADR 0007 records follow-up work for credential key derivation, RBAC, migration tooling, audit storage, Pi IPC propagation, and remaining handler migrations.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| ADR 0007 exists and documents the contract | Pass | ADR existence and content scan |
| ADR 0005 references ADR 0007 for implemented C4 concerns | Pass | ADR 0005 out-of-scope update |
| Worklog complete | Pass | This 11-section worklog is updated with evidence |
| Commit created | Pass | This ticket commit |
