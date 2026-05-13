# T325 - RBAC ticket status contract repair

Status: DONE
Phase: M.2 metadata contract repair
Ticket: docs/tickets/T325-rbac-ticket-status-contract-repair.md

## 1. Task summary

Repair the required `Status:` metadata on the RBAC foundation tickets that
arrived from PR #72.

## 2. Repo context discovered

`bun run validate:docs` and `bun run validate:agent-contract` failed on
`T224-rbac-roles-schema.md missing Status line` after the branch rebased
onto `baadce6`. Inspecting T224 and T225 showed both RBAC tickets and
worklogs omitted the status metadata used by surrounding tickets/worklogs.

## 3. Files inspected

- `docs/tickets/T224-rbac-roles-schema.md`
- `docs/worklog/T224-rbac-roles-schema.md`
- `docs/tickets/T225-rbac-policy-engine.md`
- `docs/worklog/T225-rbac-policy-engine.md`
- `docs/tickets/TEMPLATE.md`

## 4. Tests added first

No new test file was needed. The existing agent-contract validator already
catches missing ticket status metadata.

## 5. Expected failing test output

`bun run validate:agent-contract` failed with
`[agent-contract] T224-rbac-roles-schema.md missing Status line`.

## 6. Implementation changes

- Added `Status: DONE` to `docs/tickets/T224-rbac-roles-schema.md`.
- Added `Status: DONE` to `docs/tickets/T225-rbac-policy-engine.md`.
- Added matching `Status: DONE` metadata to both RBAC worklogs.

## 7. Validation commands run

- `bun run validate:agent-contract` (red)
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills,
  231 tickets, 7 required docs`.
- `bun run validate:docs`: agent-contract, architecture-docs, and
  sync-v2-design validators passed.
- `git diff --check`: clean.

## 9. Build output summary

Not run. This ticket changes documentation metadata only.

## 10. Remaining risks

This ticket does not validate the RBAC implementation itself; it only
restores the docs metadata contract required by the repo validators.

## 11. Acceptance criteria matrix

- [x] Agent-contract validation fails before implementation for the expected RBAC ticket.
- [x] T224 and T225 ticket metadata include `Status: DONE`.
- [x] T224 and T225 worklog metadata include `Status: DONE`.
- [x] Agent-contract/docs validation passes.
- [x] Worklog complete.
