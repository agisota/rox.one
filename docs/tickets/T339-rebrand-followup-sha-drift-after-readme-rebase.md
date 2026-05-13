# T339 - Rebrand follow-up SHA drift after README rebase

Status: DONE

## Context

After rebasing the post-merge validation branch onto the current canonical
`origin/main`, the dynamic R.10 permanent gate recalculated the current T321
commit as `c42e3d59`. The release mapping still recorded the previous
rewritten-history value `f82da7f`, so the full `bun test` suite and the
targeted permanent gate failed even though the underlying T321 change was
already present on the canonical history.

## Goal

Refresh the R.10 follow-up closeout evidence after the README/canonical-history
rebase without changing runtime behavior.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Use `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` as the
regression gate.

## Required Subagents

None. The existing gate reports the exact expected commit abbreviation.

## TDD Requirements

Use the existing dynamic permanent gate as the red check and confirm it fails
because the release mapping no longer names the current T321 commit
abbreviation.

## Implementation Requirements

1. Update the release mapping to record the current T321 commit abbreviation.
2. Do not change runtime behavior.
3. Do not edit unrelated R.10 evidence files.

## Validation Commands

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`
- `bun test`

## Acceptance Criteria

- [x] The permanent gate fails before implementation for the expected SHA drift.
- [x] The release mapping records T321 as `c42e3d59`.
- [x] The permanent gate passes after the mapping repair.
- [x] Docs/roadmap/rebrand validators pass.
- [x] Full `bun test` passes.
- [x] No runtime files are changed.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T339-rebrand-followup-sha-drift-after-readme-rebase.md`.
