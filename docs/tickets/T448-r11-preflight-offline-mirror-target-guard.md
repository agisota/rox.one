# T448 - R.11 preflight offline mirror target guard

Status: DONE

## Context

The R.11 pre-rewrite gate verifies that the offline mirror exists before any
history rewrite. Presence alone is not enough: a stale mirror could exist while
its `main` ref points at an older commit than the current checkout.

## Goal

Make the report-only R.11 preflight fail closed when the offline mirror exists
but its `main` ref does not match the current `main` commit.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-preflight.test.ts` with RED coverage
  for a mismatched offline mirror `main` target.
- Extend `scripts/rebrand-r11-preflight.ts` with a report-only offline mirror
  target check.
- Update the R.11 goal/runbook text so operators see the mirror target-match
  requirement before any destructive rewrite window.

## Required Subagents

None. This is a narrow report-only preflight guard.

## TDD Requirements

- Write failing preflight and runbook tests before editing the preflight
  implementation or runbook.
- Confirm RED because `offline-mirror-target` does not exist yet.

## Implementation Requirements

- Do not require offline mirror target checks in the default pre-backup stage.
- In the pre-rewrite stage, keep the existing offline mirror presence check.
- In the pre-rewrite stage, when the offline mirror exists, require its `main`
  ref to match the current `main` commit.
- Avoid double-counting a missing offline mirror as both missing and a target
  mismatch.
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

- [x] RED tests fail because `offline-mirror-target` does not exist yet.
- [x] Default pre-backup preflight does not require offline mirror target rows.
- [x] Pre-rewrite preflight fails when the offline mirror `main` target differs
      from `main`.
- [x] Missing offline mirror is not double-counted as a target mismatch.
- [x] R.11 runbook documents the offline mirror target row.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
