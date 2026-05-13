# T331 - RBAC T227 completion status repair

Status: DONE
Phase: M.2 metadata contract repair
Ticket: docs/tickets/T331-rbac-t227-completion-status-repair.md

## 1. Task summary

Update T227 completion metadata after PR #75 landed the roles RPC handler
implementation and tests.

## 2. Repo context discovered

The branch is rebased onto `533d837`, whose merge title is
`M.2 T227 part 2: roles.ts RPC handler module (list/create/grant/revoke)`.
`.swarm/master-roadmap-log.md` records `M.2-T227-complete`, and T227's worklog
already contains a green acceptance matrix, but both the T227 ticket and
worklog still say `Status: IN_PROGRESS`.

## 3. Files inspected

- `docs/tickets/T227-rbac-admin-rpc.md`
- `docs/worklog/T227-rbac-admin-rpc.md`
- `docs/tickets/T328-rbac-t227-status-contract-repair.md`
- `docs/worklog/T328-rbac-t227-status-contract-repair.md`
- `.swarm/master-roadmap-log.md`
- `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `packages/shared/src/auth/__tests__/role-store.test.ts`
- `packages/shared/src/auth/__tests__/rbac-resolver.test.ts`

## 4. Tests added first

No new test file was needed. The red check was a status-contract assertion over
the T227 ticket/worklog status metadata.

## 5. Expected failing test output

The status-contract check failed with:

```text
ticket=Status: IN_PROGRESS
worklog=Status: IN_PROGRESS
```

## 6. Implementation changes

- Changed `docs/tickets/T227-rbac-admin-rpc.md` and
  `docs/worklog/T227-rbac-admin-rpc.md` from `Status: IN_PROGRESS` to
  `Status: DONE`.
- Checked the T227 ticket acceptance criteria that PR #75 satisfies.
- Updated T328 ticket/worklog wording so its `IN_PROGRESS` repair is scoped to
  the historical PR #74 foundation state and no longer claims T227 is
  incomplete as current fact.

## 7. Validation commands run

- status-contract check (red)
- status-contract check
- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `bun test packages/shared/src/auth/__tests__/`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- status-contract check: `ticket=Status: DONE`, `worklog=Status: DONE`.
- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`:
  30 pass, 0 fail, 34 expects.
- `bun test packages/shared/src/auth/__tests__/`: 186 pass, 0 fail,
  274 expects.
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`:
  59 pass, 0 fail, 73 expects.
- `bun run validate:docs`: agent-contract, architecture-docs, and
  sync-v2-design validators passed; agent contract reported 11 skills,
  239 tickets, and 7 required docs.
- `git diff --check`: clean.

## 9. Build output summary

Not run. This ticket changes documentation metadata only; the branch-level build
is run separately after the current repair set is committed.

## 10. Remaining risks

T229 remains absent and R.11 remains blocked independently of this metadata
repair.

## 11. Acceptance criteria matrix

- [x] Status-contract check fails before implementation for the expected T227 metadata.
- [x] T227 ticket and worklog metadata are `Status: DONE`.
- [x] T227 ticket acceptance boxes match the green PR #75 worklog evidence.
- [x] T328 no longer states that T227 is still incomplete as current fact.
- [x] T227 targeted tests and docs validators pass.
- [x] Worklog complete.
