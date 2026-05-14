# T398 - R.11 backup branch runbook wire

Status: DONE

## Context

T386 added a distinct `backup-branch` row to the explicit
`bun run rebrand:r11-preflight --stage pre-rewrite` gate. The canonical R.11
backup procedure creates and pushes the branch, but the paragraph immediately
before the pre-rewrite helper still says only the backup tag and offline mirror
must exist before `git filter-repo`.

## Goal

Make the R.11 runbook state the same three backup artifacts enforced by the
pre-rewrite helper: backup tag, backup branch, and offline mirror.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the focused R.11 goal documentation regression in
`scripts/__tests__/rebrand-r11-preflight.test.ts`.

## Required Subagents

None.

## TDD Requirements

Write the failing documentation regression first. It must fail until the R.11
goal file says the backup tag, backup branch, and offline mirror must all
exist before any `git filter-repo` invocation.

## Implementation Requirements

- Update only the R.11 runbook text around the pre-rewrite helper.
- Do not change the backup command sequence.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not re-point `rebrand-v1`.
- Do not call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Regression test fails before documentation update.
- [x] Regression test passes after documentation update.
- [x] R.11 runbook names backup tag, backup branch, and offline mirror before pre-rewrite.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T398-r11-backup-branch-runbook-wire.md`.
