# T450 - R.11 T298 backup target guard refresh

Status: DONE

## Context

T446 and T448 added explicit pre-rewrite target guard rows for R.11 backup
artifacts: `backup-tag-target`, `backup-branch-target`, and
`offline-mirror-target`. T449 recorded those rows in the durable completion
audit. The future destructive closeout surface in T298 should also name those
rows so operators do not treat artifact presence as sufficient.

## Goal

Refresh the T298 ticket/worklog so the future R.11 closeout path requires the
backup tag, backup branch, and offline mirror to point at current `main` before
any `git filter-repo` invocation.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-preflight.test.ts` so T298's ticket
  and worklog must mention all three target guard IDs.

## Required Subagents

None. This is a narrow report-only documentation/test hardening slice.

## TDD Requirements

- Add the failing T298 documentation regression before editing T298.
- Confirm RED because the target guard IDs are absent from T298.

## Implementation Requirements

- Update only the T298 ticket/worklog, the T298 documentation regression, and
  this ticket/worklog pair.
- Keep T298 `Status: BLOCKED`.
- Do not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, or clean branches.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails because T298 lacks the backup target guard IDs.
- [x] T298 ticket names `backup-tag-target`.
- [x] T298 ticket names `backup-branch-target`.
- [x] T298 ticket names `offline-mirror-target`.
- [x] T298 worklog names all three target guard IDs and keeps R.11 blocked.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
