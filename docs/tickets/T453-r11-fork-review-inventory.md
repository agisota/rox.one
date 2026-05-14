# T453 - R.11 fork review inventory

Status: DONE

## Context

The R.11 completion audit records `fork-review` as a hard blocker because
GitHub reports 1 fork while the expected count is 0. Other R.11 blockers have
dedicated read-only inventory files under `docs/release/`, but fork review is
currently recorded only inline in the audit and T298 worklog.

## Goal

Create a read-only `docs/release/r11-fork-review-inventory-2026-05-14.md`
artifact and point the completion audit at it.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-completion-audit.test.ts` so the
  completion audit must point at the fork inventory and the inventory must
  record the current fork count.

## Required Subagents

None. This is a narrow report-only inventory refresh.

## TDD Requirements

- Add the failing completion-audit regression before creating the inventory.
- Confirm RED because the fork review inventory is absent.

## Implementation Requirements

- Update only the completion audit, fork review inventory, its regression test,
  and this ticket/worklog pair.
- Do not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, or clean branches.
- Do not contact fork owners or perform any external-production action.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails because the fork review inventory is absent.
- [x] Completion audit points at `docs/release/r11-fork-review-inventory-2026-05-14.md`.
- [x] Fork inventory records current count 1 and expected count 0.
- [x] Fork inventory names the visible fork requiring operator review.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
