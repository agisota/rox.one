# T383 - R.11 exact closeout audit refresh

Status: DONE

## Context

The live T298 R.11 blocker surface still labels the exact closeout-ticket
existence check as "In progress", even though
`docs/tickets/T298-rebrand-git-history-rewrite.md` and its matching worklog now
exist and are intentionally `Status: BLOCKED`.

There is also an unrelated `T298-rc-preflight` ticket, so audits must inspect
the exact R.11 closeout file instead of treating any `T298-*` ticket as proof
that the rebrand goal's T298 closeout is done.

## Goal

Refresh the R.11 blocker surface so exact closeout-ticket existence is green
while the destructive R.11 phase remains blocked.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

No automation changes. This is a closeout evidence refresh.

## Required Subagents

None.

## TDD Requirements

Use the stale T298 marker as RED evidence:
`rg -n "R\\.11 closeout ticket exists" docs/worklog/T298-rebrand-git-history-rewrite.md`
must show the old `In progress` status before the refresh.

## Implementation Requirements

- Update T298's R.11 closeout-ticket existence row to `Green`.
- Record that the exact R.11 T298 file is `Status: BLOCKED`, distinct from
  `T298-rc-preflight`.
- Keep T298 `Status: BLOCKED`.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `rg -n "R\\.11 closeout ticket exists|T298-rc-preflight|Status: BLOCKED" docs/worklog/T298-rebrand-git-history-rewrite.md docs/tickets/T298-rebrand-git-history-rewrite.md docs/tickets/T298-rc-preflight.md`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] T298 marks exact closeout-ticket existence green.
- [x] T298 records the exact R.11 closeout file remains `Status: BLOCKED`.
- [x] The T298-rc-preflight collision risk is documented.
- [x] Destructive R.11 actions are not executed.
- [x] Documentation/rebrand validation remains green.
- [x] Commit created.

## Worklog

See `docs/worklog/T383-r11-exact-closeout-audit-refresh.md`.
