# T330 - Rebrand follow-up SHA drift after T227 completion

Status: DONE

## Context

After rebasing the R.10 follow-up branch onto PR #75, T321 was rewritten to
`f82da7f`. The dynamic permanent gate correctly failed because the release
mapping still recorded the previous T321 commit.

## Goal

Refresh the R.10 follow-up closeout evidence after the PR #75 rebase without
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
2. Update the prior SHA-drift evidence docs to name the current PR #75 rebase point.
3. Do not change runtime behavior.

## Validation Commands

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [x] The permanent gate fails before implementation for the expected SHA drift.
- [x] The release mapping records T321 as `f82da7f`.
- [x] Prior SHA-drift evidence no longer names the previous T321 SHA as current.
- [x] Rebrand/docs/roadmap validation passes.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T330-rebrand-followup-sha-drift-after-t227-completion.md`.
