# T407 - R.11 legal preserve goal wire

Status: DONE

## Context

T406 added `bun run rebrand:r11-legal-preserve` as a report-only executable
gate for the R.11 post-filter-repo, pre-force-push legal-preserve checks. The
canonical rebrand-sweep goal still documents those checks as manual `/tmp`
byte-diff snippets.

## Goal

Wire the R.11 goal documentation to the executable legal-preserve runner so
future operators run one deterministic gate instead of copying manual snippets.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

No new automation. Reuse the T406 `rebrand:r11-legal-preserve` package script.

## Required Subagents

None. This is bounded to documentation plus the existing R.11 documentation
test surface.

## TDD Requirements

Add a failing documentation test first that requires the R.11 goal to mention
`bun run rebrand:r11-legal-preserve`.

## Implementation Requirements

- Update `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
  to point the legal-preserve step at `bun run rebrand:r11-legal-preserve`.
- Keep the Apache 2.0 attribution boundaries unchanged.
- Do not run or document any destructive R.11 action as completed.
- Do not create backup refs, backup branches, mirrors, rewritten history,
  force-pushes, or call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-legal-preserve.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run rebrand:r11-legal-preserve` (expected red until the backup tag exists)
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED documentation test fails before implementation.
- [x] R.11 goal mentions `bun run rebrand:r11-legal-preserve`.
- [x] Legal-preserve manual command snippets are replaced by the executable
  runner instruction.
- [x] Relevant validation passes.
- [x] Commit created.

## Worklog

See `docs/worklog/T407-r11-legal-preserve-goal-wire.md`.
