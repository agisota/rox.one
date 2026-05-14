# T437 - R.11 R.9.5 closeout preflight coverage

Status: DONE

## Context

The R.11 report-only preflight checks R.0-R.10 ticket/worklog closeouts before
any destructive history rewrite can start. The current ticket list stops at
T297, while the R.10 closeout and rebrand mapping record the interstitial R.9.5
phase as T298a/T300a. Those suffixed tickets currently lack the standard
`Status: DONE` line and matching worklogs.

## Goal

Make the R.11 preflight verify the actual R.9.5 closeout tickets and restore
their ticket/worklog evidence in the standard AGENTS.md shape.

## Required UI

None.

## Required Data/API

None.

## Required Automations

- Regression tests must fail before the preflight and closeout artifacts are
  updated.
- No R.11 destructive commands are allowed.

## Required Subagents

None.

## TDD Requirements

- Add preflight regression coverage that requires T298a/T300a to be part of the
  R.0-R.10 closeout set.
- Add regression coverage that the two R.9.5 tickets have `Status: DONE` and
  matching 11-section worklogs.
- Confirm RED before implementation.

## Implementation Requirements

- Add `docs/tickets/T298a-rebrand-allowlist-expansion.md` and
  `docs/tickets/T300a-rebrand-agents-md-and-misc.md` to the preflight closeout
  list.
- Add standard `Status: DONE` lines to the two R.9.5 tickets.
- Add matching 11-section worklogs for the two R.9.5 tickets using historical
  evidence from the existing tickets, T296 closeout, and rebrand mapping.
- Do not create a T299a artifact unless current repo evidence proves it exists.
- Do not run tag mutation, backup creation, mirror creation, `git filter-repo`,
  force-push, or branch cleanup.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight` (expected red while existing hard blockers remain)

## Acceptance Criteria

- [x] RED assertions fail before implementation.
- [x] R.11 preflight closeout list includes T298a and T300a.
- [x] T298a and T300a tickets are `Status: DONE`.
- [x] T298a and T300a worklogs exist with 11 sections.
- [x] Targeted tests and docs validators pass.
- [x] No destructive R.11 action is performed.
