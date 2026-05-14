# T378 - R.11 preflight stage split

Status: DONE

## Context

The R.11 goal says to run `bun run rebrand:r11-preflight` before any backup
step, then create backup artifacts, then verify those artifacts before
`git filter-repo`. The preflight runner was failing on missing backup artifacts
in the default pre-backup check, which made the backup procedure unreachable.

## Goal

Split the report-only preflight into a default pre-backup stage and an explicit
pre-rewrite stage so the runner matches the R.11 sequence.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Update only the report-only R.11 preflight runner and its tests.

## Required Subagents

None. The behavior is isolated to one script and one test file.

## TDD Requirements

Write failing tests first:

- Default pre-backup preflight passes when all hard prerequisites are true even
  if backup tag and offline mirror are absent.
- Explicit `pre-rewrite` preflight fails when backup tag and offline mirror are
  absent.

## Implementation Requirements

- Keep default `bun run rebrand:r11-preflight` as the pre-backup gate.
- Add `--stage pre-rewrite` for the gate that runs after backup creation and
  before `git filter-repo`.
- Keep `no-active-goal` fail-closed.
- Keep backup tag and offline mirror fail-closed in `pre-rewrite`.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Default preflight does not require backup artifacts before backup creation.
- [x] Explicit pre-rewrite preflight requires backup artifacts before rewrite.
- [x] No-active-goal remains a default hard stop.
- [x] Targeted tests pass.
- [x] Documentation/rebrand validation remains green.
- [x] Commit created.

## Worklog

See `docs/worklog/T378-r11-preflight-stage-split.md`.
