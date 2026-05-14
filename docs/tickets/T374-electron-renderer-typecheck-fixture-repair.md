# T374 - Electron renderer typecheck fixture repair

Status: DONE

## Context

After merging current `origin/main` into the R.11 repair branch,
`bun run typecheck:electron` is still red on renderer test/playground fixtures.
The errors are type-surface drift, not runtime behavior changes.

## Goal

Restore `bun run typecheck:electron` by updating renderer fixtures and tests to
match the current typed contracts.

## Required UI

None.

## Required Data/API

No data/API changes. Fixture-only repair.

## Required Automations

Run `bun run typecheck:electron` before and after the repair.

## Required Subagents

None; the failure output points directly at the affected fixtures.

## TDD Requirements

Use the existing failing `bun run typecheck:electron` output as the RED test.

## Implementation Requirements

- Add `hungTab` to `BrowserInstanceInfo` fixtures.
- Avoid adding matcher dependencies; use standard DOM assertions.
- Use a valid `TeamManagementStatus` in the seeded team-management a11y test.

## Validation Commands

- `bun run typecheck:electron`
- Existing branch validation matrix after merge

## Acceptance Criteria

- [x] `bun run typecheck:electron` passes.
- [x] No production dependency is added.
- [x] Runtime behavior is unchanged.

## Worklog

See `docs/worklog/T374-electron-renderer-typecheck-fixture-repair.md`.
