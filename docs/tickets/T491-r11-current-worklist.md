# T491 - R.11 current worklist

Status: DONE

## Context

After PR #225 merged, `main` is clean and synchronized with `origin/main`, but
the active rebrand-sweep objective is still not complete. The operator asked
for the remaining project edits and merge path to be made explicit so the work
can continue from a single list instead of scattered branch state.

## Goal

Add a current, report-only R.11 remaining-work list to the durable completion
audit, backed by fresh local evidence from `main` after PR #225.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

None.

## Required Subagents

Read-only explorer/verifier help is optional. Any subagent output is advisory;
the durable evidence must come from local commands.

## TDD Requirements

- Confirm RED before editing: this ticket/worklog pair is absent and the
  2026-05-15 audit does not yet contain the phrase `Current Remaining Worklist`.

## Implementation Requirements

- Keep the change report-only.
- Do not mutate tags, branches, backup refs, offline mirrors, rewritten
  history, force-pushed refs, or `/goal` state.
- Separate operator-owned/destructive R.11 actions from safe documentation and
  validation actions.
- Record fresh evidence from current `main` after PR #225.

## Validation Commands

- `test ! -f docs/tickets/T491-r11-current-worklist.md`
- `test ! -f docs/worklog/T491-r11-current-worklist.md`
- `rg -q "Current Remaining Worklist" docs/release/r11-completion-audit-2026-05-15.md`
  (expected RED before implementation)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED checks prove the ticket, worklog, and audit section were absent.
- [x] The audit contains a current remaining-work list based on fresh
  post-PR #225 evidence.
- [x] The list distinguishes safe report-only work from destructive R.11 work.
- [x] T298 worklog points at T491.
- [x] Validators pass.
- [x] No destructive R.11 action is performed.

## Worklog

See `docs/worklog/T491-r11-current-worklist.md`.
