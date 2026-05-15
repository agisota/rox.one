# T490 - R.11 audit moving-head wording

Status: DONE

## Context

T489 landed the 2026-05-15 R.11 completion audit through PR #224. The audit
correctly records a captured `/tmp` evidence packet, but one row describes that
packet as "current" while naming the pre-PR #224 commit. Future report-only
audit commits will naturally advance `main`, so exact commit SHAs in durable
audit packets must be presented as captured evidence rather than a moving
latest-head claim.

## Goal

Clarify that the 2026-05-15 audit's `/tmp` hashes and `527e594f...` status row
are captured evidence from the audit packet, not proof of the latest `main`
after later report-only commits.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

- Confirm RED before editing: the T490 ticket is absent and the audit does not
  contain the phrase `captured evidence packet`.

## Implementation Requirements

- Keep this ticket report-only.
- Do not mutate tags, branches, backup refs, mirrors, history, or goal state.
- Avoid pinning this follow-up to another "latest main" SHA that would become
  stale after merge.

## Validation Commands

- `test ! -f docs/tickets/T490-r11-audit-moving-head-wording.md`
- `rg -q "captured evidence packet" docs/release/r11-completion-audit-2026-05-15.md`
  (expected RED before implementation)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED checks prove the ticket and wording were absent before the change.
- [x] The audit distinguishes captured evidence from moving latest-head state.
- [x] T298 worklog points at T490.
- [x] Validators pass.
- [x] No destructive R.11 action is performed.

## Worklog

See `docs/worklog/T490-r11-audit-moving-head-wording.md`.
