# T328 - RBAC T227 status contract repair

Status: DONE
Phase: M.2 metadata contract repair
Ticket: docs/tickets/T328-rbac-t227-status-contract-repair.md

## 1. Task summary

Repair the required `Status:` metadata on the foundation-only T227 RBAC
ticket/worklog that arrived from PR #74.

## 2. Repo context discovered

`bun run validate:agent-contract` failed on
`T227-rbac-admin-rpc.md missing Status line` after the branch rebased onto
`21f4543`. PR #74 was a foundation-only T227 landing with a pending handler
test, so the metadata needed to be `IN_PROGRESS`, not `DONE`, until PR #75
completed the handler slice.

## 3. Files inspected

- `docs/tickets/T227-rbac-admin-rpc.md`
- `docs/worklog/T227-rbac-admin-rpc.md`
- `docs/tickets/T326-rbac-t226-status-contract-repair.md`
- `docs/worklog/T326-rbac-t226-status-contract-repair.md`
- `scripts/validate-agent-contract.ts`

## 4. Tests added first

No new test file was needed. The existing agent-contract validator already
catches missing ticket status metadata.

## 5. Expected failing test output

`bun run validate:agent-contract` failed with
`[agent-contract] T227-rbac-admin-rpc.md missing Status line`.

## 6. Implementation changes

- Added `Status: IN_PROGRESS` to `docs/tickets/T227-rbac-admin-rpc.md` for
  the PR #74 foundation state.
- Added `Status: IN_PROGRESS` to `docs/worklog/T227-rbac-admin-rpc.md` for
  the PR #74 foundation state.

## 7. Validation commands run

- `bun run validate:agent-contract` (red)
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills,
  236 tickets, 7 required docs`.
- `bun run validate:docs`: agent-contract, architecture-docs, and
  sync-v2-design validators passed.
- `git diff --check`: clean.

## 9. Build output summary

Not run. This ticket changes documentation metadata only.

## 10. Remaining risks

This ticket's `IN_PROGRESS` repair was intentionally scoped to PR #74. PR #75
later completed the T227 handler slice, and T331 updates the live T227
metadata to `DONE`.

## 11. Acceptance criteria matrix

- [x] Agent-contract validation fails before implementation for the expected T227 ticket.
- [x] T227 ticket metadata included `Status: IN_PROGRESS` for the PR #74 foundation state.
- [x] T227 worklog metadata included `Status: IN_PROGRESS` for the PR #74 foundation state.
- [x] Agent-contract/docs validation passes.
- [x] Worklog complete.
