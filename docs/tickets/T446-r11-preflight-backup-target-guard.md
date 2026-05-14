# T446 - R.11 preflight backup target guard

Status: DONE

## Context

The R.11 pre-rewrite preflight currently checks that the backup tag and backup
branch exist before any destructive rewrite window. Presence alone is not
enough: a stale backup ref could exist while pointing at an older commit than
the current `main` snapshot.

## Goal

Make the report-only R.11 preflight fail closed when the pre-rewrite backup tag
or backup branch exists but does not point at the current `main` commit.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-preflight.test.ts` with RED tests for
  mismatched backup tag and backup branch targets.
- Extend `scripts/rebrand-r11-preflight.ts` with report-only target checks.
- Update the R.11 goal/runbook text so operators see the target-match
  requirement before any destructive rewrite window.

## Required Subagents

None. This is a narrow report-only preflight guard.

## TDD Requirements

- Write failing preflight tests before editing the preflight implementation.
- Confirm RED because backup target rows do not exist yet.

## Implementation Requirements

- Do not require backup target checks in the default pre-backup stage.
- In the pre-rewrite stage, keep the existing presence checks.
- In the pre-rewrite stage, when a backup tag exists, require its peeled commit
  to match the current `main` commit.
- In the pre-rewrite stage, when a backup branch exists, require its remote
  commit to match the current `main` commit.
- Avoid double-counting missing backup artifacts as both missing and target
  mismatches.
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
- `bun run rebrand:r11-preflight` (expected red while existing blockers remain)
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
  (expected red while existing blockers remain)

## Acceptance Criteria

- [x] RED tests fail because backup target rows do not exist yet.
- [x] Default pre-backup preflight does not require backup target rows.
- [x] Pre-rewrite preflight fails when a backup tag target differs from `main`.
- [x] Pre-rewrite preflight fails when a backup branch target differs from
      `main`.
- [x] Missing backup artifacts are not double-counted as target mismatches.
- [x] R.11 runbook documents the backup target rows.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
