# T324 - Rebrand follow-up SHA drift guard

Status: DONE

## Context

Rebasing the R.10 follow-up branch changed the local T321 commit SHA more than
once, with the current post-PR #75 value at `f82da7f`. The closeout mapping and
its permanent gate still hardcoded the previous SHA, which made the evidence
stale even though the branch was otherwise green.

## Goal

Make the closeout evidence follow the current T321 commit and prevent the
permanent gate from silently accepting stale follow-up SHA literals after a
future rebase.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Extend the existing R.10 permanent gate to derive the T321 commit from git
instead of hardcoding a fixed SHA in the test.

## Required Subagents

None.

## TDD Requirements

Update `scripts/__tests__/rebrand-permanent-gate.test.ts` first so it
expects the current T321 commit from git. Confirm it fails while the
mapping still references the old rebased-away SHA.

## Implementation Requirements

1. Replace stale previous evidence with the current T321 commit SHA.
2. Keep the release mapping and T322 evidence docs consistent.
3. Do not change runtime behavior.

## Validation Commands

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `git diff --check`

## Acceptance Criteria

- [x] The revised permanent gate fails before docs are refreshed.
- [x] The release mapping records T321 as `f82da7f`.
- [x] T322 ticket/worklog evidence no longer names the stale T321 SHA.
- [x] Rebrand/docs/roadmap/typecheck/lint/test/build gates stay green.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T324-rebrand-followup-sha-drift-guard.md`.
