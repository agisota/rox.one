# T458 - R.11 T298 history scan evidence refresh

Status: DONE

## Context

The current R.11 history-scan inventory records the unbounded
`bun run rebrand:r11-history-scan` result as 81 forbidden-token patch lines.
The blocked T298 closeout worklog still describes the same gate as bounded
finding output, which no longer matches the durable audit evidence.

## Goal

Refresh the T298 closeout worklog wording so it points operators at the current
unbounded history-scan evidence and does not preserve the older bounded-output
description.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-preflight.test.ts` so the T298 worklog
  must cite the current history-scan inventory, record the 81-finding result,
  and omit the stale bounded-output wording.

## Required Subagents

None. This is a narrow report-only closeout-surface consistency fix.

## TDD Requirements

- Add the failing preflight regression before editing the T298 worklog.
- Confirm RED because the T298 worklog still records the stale bounded-output
  wording.

## Implementation Requirements

- Update only the T298 worklog, its regression test, and this ticket/worklog
  pair.
- Do not clear `/goal`, call `update_goal`, mutate tags, create backup
  artifacts, create an offline mirror, run `git filter-repo`, force-push,
  clean branches, or contact fork owners.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails because the T298 worklog still records the stale
  bounded-output history-scan wording.
- [x] T298 worklog cites `docs/release/r11-history-scan-inventory-2026-05-14.md`.
- [x] T298 worklog records the current 81-finding red history-scan result.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
