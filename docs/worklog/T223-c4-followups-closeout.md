# T223 - C4 follow-ups closeout

## 1. Task summary

Close the Phase 1 C4 follow-up sequence by recording the landed follow-up
commits and updating ADR 0007's implementation status.

## 2. Repo context discovered

- T213 through T222 are all marked `Status: DONE`.
- The first-parent branch history contains the Phase 1 follow-up commits.
- ADR 0007 still has an "Out of scope" section written for the original C4
  slice, before the follow-up tickets landed.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `docs/tickets/T213-c4-workspace-rpc-full-scope-migration.md`
- `docs/tickets/T214-c4-electron-main-handlers-scope-migration.md`
- `docs/tickets/T215-c4-server-core-rpc-handlers-scope-migration.md`
- `docs/tickets/T216-pi-ipc-scope-propagation.md`
- `docs/tickets/T217-tenant-credential-key-derivation.md`
- `docs/tickets/T218-audit-storage-schema.md`
- `docs/tickets/T219-audit-event-writer.md`
- `docs/tickets/T220-audit-event-query-api.md`
- `docs/tickets/T221-audit-event-retention-policy.md`
- `docs/tickets/T222-multi-tenant-data-migration-tool.md`
- `docs/worklog/T213-c4-workspace-rpc-full-scope-migration.md`
- `docs/worklog/T214-c4-electron-main-handlers-scope-migration.md`
- `docs/worklog/T215-c4-server-core-rpc-handlers-scope-migration.md`
- `docs/worklog/T216-pi-ipc-scope-propagation.md`
- `docs/worklog/T217-tenant-credential-key-derivation.md`
- `docs/worklog/T218-audit-storage-schema.md`
- `docs/worklog/T219-audit-event-writer.md`
- `docs/worklog/T220-audit-event-query-api.md`
- `docs/worklog/T221-audit-event-retention-policy.md`
- `docs/worklog/T222-multi-tenant-data-migration-tool.md`

## 4. Tests added first

No runtime tests were added because T223 is a documentation closeout. The
test-first check is a docs assertion run before editing ADR 0007:

- It fails while the ADR still contains deferred wording for completed Phase 1
  follow-ups.
- It passes after those completed items move to implemented status.

## 5. Expected failing test output

Red docs assertion:

- Command:
  `if rg -n "Deferred follow-up slices|Per-tenant credential key derivation|Pi-agent-server IPC scope propagation|Data migration tooling|Queryable audit storage|Remaining webui handler migrations|Electron handler migrations" docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md; then echo "ADR 0007 still marks completed Phase 1 follow-ups as deferred"; exit 1; fi`
- Result: exit 1.
- Expected output: ADR 0007 still matched `Deferred follow-up slices` and the
  completed follow-up headings for credential key derivation, Pi IPC
  propagation, data migration tooling, queryable audit storage, workspace RPC
  migrations, and Electron handler migrations.

## 6. Implementation changes

- Updated ADR 0007's former "Out of scope" section to "Follow-up Status".
- Marked these Phase 1 follow-ups implemented:
  - T213 `8c1edf9` - remaining workspace RPC migrations.
  - T214 `9b29b30` - Electron main handler scope migration.
  - T215 `ee47a29` - server-core non-workspace RPC scope decisions.
  - T216 `5e8b17a` - Pi-agent-server IPC scope propagation.
  - T217 `baee220` - per-tenant credential key derivation.
  - T218 `1e3c76e` - audit storage schema.
  - T219 `1f69afc` - structured audit event writer.
  - T220 `28cc2a2` - audit event query API.
  - T221 `ee49153` - audit event retention policy.
  - T222 `9ffb0a3` - multi-tenant data migration tooling.
- Kept RBAC-owned `session.permittedWorkspaces` population explicitly deferred
  to Phase 2.
- Updated ADR 0007's audit coverage security note to include queryable audit
  storage, tenant credential access signals, and retention evaluation.
- Added this closeout ticket and worklog.

## 7. Validation commands run

- Red docs assertion before ADR update.
- Green docs assertion after ADR update:
  `if rg -n "Deferred follow-up slices|Data migration tooling\\.\\*need a migration tool|Queryable audit storage\\.\\*future work|Remaining webui handler migrations|Electron handler migrations\\.\\*remain" docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md; then exit 1; fi`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- Green docs assertion: exit 0.
- Docs validation: exit 0.
- Whitespace check: exit 0.

## 9. Build output summary

No build was run for T223 because the slice only changes docs and ticket
records. The immediately preceding T222 runtime slice already passed
`bun run build`.

## 10. Remaining risks

- Phase 2 still owns RBAC population of `session.permittedWorkspaces`.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Worklog summarizes T213 through T222 with commit SHAs | Green | Section 6 lists each Phase 1 follow-up commit |
| ADR 0007 marks implemented Phase 1 C4 follow-ons as implemented | Green | ADR 0007 "Follow-up Status" lists T213-T222 as implemented |
| ADR 0007 keeps RBAC population deferred to Phase 2 | Green | ADR 0007 still lists RBAC population under "Still out of scope" |
| Docs validation passes | Green | `bun run validate:docs` exits 0 |
| Whitespace check passes | Green | `git diff --check` exits 0 |
| No runtime source files are modified | Green | T223 diff is ADR, ticket, and worklog only |
| Worklog complete | Green | All 11 sections complete |
| Commit created | Green | T223 committed with Lore protocol |
