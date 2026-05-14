# T454 - R.11 history scan count refresh

Status: DONE

## Context

Fresh post-push report-only evidence shows `bun run rebrand:r11-history-scan`
now reports 81 forbidden-token patch lines outside the legal-preserve allowlist.
The R.11 completion audit and history-scan inventory still record the older
bounded cutoff count of 9.

## Goal

Refresh the report-only completion audit and history-scan inventory so they
record the current unbounded history-scan count without adding raw forbidden
token text to docs.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-completion-audit.test.ts` so the
  completion audit and history-scan inventory must record the current count of
  81 and keep the listed findings sanitized.

## Required Subagents

None. This is a narrow report-only evidence refresh.

## TDD Requirements

- Update the completion-audit regression before changing the audit or
  inventory.
- Confirm RED because the docs still record the stale count of 9.

## Implementation Requirements

- Update only the completion audit, history-scan inventory, its regression
  test, and this ticket/worklog pair.
- Do not add raw forbidden token line text to the refreshed docs.
- Do not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, clean branches, or contact fork owners.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails because the audit/inventory still record the stale
  history-scan count.
- [x] Completion audit records 81 forbidden-token patch lines for
  `history-scan`.
- [x] History-scan inventory records the unbounded count of 81.
- [x] History-scan inventory keeps listed findings sanitized and bounded.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
