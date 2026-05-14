# T457 - R.11 history scan checklist command refresh

Status: DONE

## Context

The R.11 current-blocker evidence and history-scan inventory now use the
unbounded `bun run rebrand:r11-history-scan` command and record 81 findings.
The completion audit's prompt-to-artifact checklist still references the older
bounded `REBRAND_R11_HISTORY_MAX_FINDINGS=8` helper text.

## Goal

Refresh the prompt-to-artifact checklist so history-scan evidence uses the same
unbounded command and finding count as the current blocker inventory.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-completion-audit.test.ts` so the
  history-scan checklist row must use the unbounded command and current
  81-finding count.

## Required Subagents

None. This is a narrow report-only audit consistency fix.

## TDD Requirements

- Add the failing completion-audit regression before editing the audit.
- Confirm RED because the checklist still records the stale bounded command.

## Implementation Requirements

- Update only the completion audit, its regression test, and this
  ticket/worklog pair.
- Do not clear `/goal`, call `update_goal`, mutate tags, create backup
  artifacts, create an offline mirror, run `git filter-repo`, force-push,
  clean branches, or contact fork owners.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails because the checklist still records the stale bounded
  history-scan command.
- [x] Completion audit prompt-to-artifact checklist records
  `bun run rebrand:r11-history-scan`.
- [x] Completion audit prompt-to-artifact checklist records the current
  81-finding red history-scan result.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
