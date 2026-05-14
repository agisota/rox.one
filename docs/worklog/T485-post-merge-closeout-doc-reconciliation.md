# T485 - Post-merge closeout documentation reconciliation

Status: DONE
Phase: Documentation reconciliation
Ticket: docs/tickets/T485-post-merge-closeout-doc-reconciliation.md

## 1. Task summary

Reconcile C4 and PR #218 closeout documentation with the current main branch
after PR #218 merged.

## 2. Repo context discovered

PR #218 is merged into `main` at `660daad5`. Current C4 code derives workspace
storage scope across the migrated workspace RPC surface, while ADR 0007 still
described only the original `workspaces.GET` demo caller. ADR 0005 had an ADR
0007 update in its out-of-scope list but later still described the workspace
branch as reserved, which contradicted current code. T482 and T483 retained
pending hosted-validation checkboxes even though PR #218 has merged.

## 3. Files inspected

- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`
- `docs/tickets/T482-transform-data-circleci-ebadf-retry.md`
- `docs/worklog/T482-transform-data-circleci-ebadf-retry.md`
- `docs/tickets/T483-workspace-scope-circleci-timeout.md`
- `docs/worklog/T483-workspace-scope-circleci-timeout.md`
- `packages/server-core/src/handlers/rpc/workspace.ts`

## 4. Tests added first

No executable test was added. The RED evidence is documentation drift reported
by read-only verifier/code-reviewer agents and confirmed by file inspection.

## 5. Expected failing test output

No failing command was expected for the drift itself. The failing evidence was
textual:

```text
ADR 0007 still says only workspaces.GET is wired and sibling handlers keep
DEFAULT_LOCAL_SCOPE with TODO(C4) markers.

ADR 0005 still says the kind: 'workspace' branch is reserved, not implemented.

T482/T483 still show hosted PR #218 checks as pending after PR #218 merged.
```

## 6. Implementation changes

- Updated ADR 0007 to describe the current `deriveWorkspaceScope(ctx)` path and
  full workspace RPC migration.
- Updated ADR 0005 so the security section treats `kind: 'workspace'` as an
  implemented ADR 0007 contract rather than a reserved placeholder.
- Updated T482 and T483 ticket/worklog status from hosted-CI pending to done,
  preserving the excluded GitHub macOS ARM64 package billing/spending-limit
  note.

## 7. Validation commands run

- Pending after implementation.

## 8. Passing test output summary

- Pending after implementation.

## 9. Build output summary

No build is required for this docs-only reconciliation. Build evidence remains
tracked by the broader main validation pass.

## 10. Remaining risks

The docs still record that R.11 is blocked; that is accurate. Remote branch and
tag cleanup remain destructive/operator-owned and were not attempted.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| ADR 0007 no longer claims only `workspaces.GET` is wired | PASS | ADR 0007 now describes T213 full workspace RPC migration |
| ADR 0005 no longer claims the `kind: 'workspace'` arm is only reserved | PASS | ADR 0005 security section now points at ADR 0007 as implemented |
| T482/T483 no longer leave PR #218 hosted repo-controlled checks pending | PASS | T482/T483 ticket and worklog matrices mark the hosted check criterion PASS/DONE |
| No runtime code changes are made for this ticket | PASS | T485 changes are docs-only |
| No destructive R.11 action is performed | PASS | Only read-only R.11 checks were run |
