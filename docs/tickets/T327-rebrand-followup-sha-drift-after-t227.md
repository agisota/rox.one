# T327 - Rebrand follow-up SHA drift after T227

Status: DONE

## Context

After rebasing the rebrand follow-up branch onto PR #74, T321 was rewritten to
`33e08cf`. The dynamic permanent gate correctly failed because the release
mapping still recorded the previous T321 commit.

## Goal

Refresh the R.10 follow-up closeout evidence after the PR #74 rebase without
changing runtime behavior.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Use `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` as the
regression gate.

## Required Subagents

None.

## TDD Requirements

Run the existing dynamic permanent gate first and confirm it fails because the
release mapping no longer names the current T321 commit.

## Implementation Requirements

1. Update the release mapping to record the current T321 commit.
2. Update T322/T324 evidence wording to match the current rebase point.
3. Do not change runtime behavior.

## Validation Commands

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [x] The permanent gate fails before implementation for the expected SHA drift.
- [x] The release mapping records T321 as `33e08cf`.
- [x] T322/T324 evidence no longer names the previous current T321 SHA as current.
- [x] Rebrand and roadmap validation pass.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T327-rebrand-followup-sha-drift-after-t227.md`.
