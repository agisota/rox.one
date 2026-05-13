# T271 - Rebrand plan and snapshot rewrite

Status: DONE

## Context

Phase R.4 allows `plan.md` and `snapshot.md` to be revised even though they were
historical planning artifacts, because they are active orientation docs for the
ROX.ONE roadmap.

## Goal

Rewrite stale product references in `plan.md` and `snapshot.md`, add the
successor-goal note to the plan header, and mark the prior snapshot as
historical.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; the stale references are bounded by direct `rg` hits.

## TDD Requirements

Extend the R.4 documentation regression test before editing the plan/snapshot
docs and confirm it fails on the existing stale text.

## Implementation Requirements

- Add `Successor goal: this rebrand sweep (R.0-R.10).` near the `plan.md`
  header.
- Use `ROX.ONE` as the written wordmark in `plan.md` and `snapshot.md`.
- Rewrite stale plan references where legacy product names mean the ROX.ONE
  product rather than upstream attribution.
- Rewrite `snapshot.md` to current ROX.ONE state and mark the prior snapshot as
  historical.
- Preserve upstream attribution where the docs intentionally describe upstream
  origin or merge targets.

## Validation Commands

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Red test proves the plan/snapshot cleanup gap.
- [x] `plan.md` carries the successor-goal note and canonical wordmark.
- [x] `snapshot.md` marks the old snapshot as historical and uses canonical
  product language.
- [x] Upstream attribution remains clear.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T271-rebrand-plan-and-snapshot-rewrite.md`.
