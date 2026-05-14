# T487 - Mode manager CI timeout stabilization

Status: DONE

## Context

PR #222's GitHub `validate` job failed one unit test under hosted load:
`shouldAllowToolInMode - Bash plans folder exception > should allow Codex-style
zsh write to plans folder`. The same test passed locally in isolation in 16ms,
and the full local `bun test` already passed before the PR was opened.

## Goal

Keep the mode-manager write-detection assertions unchanged while giving the
file an explicit timeout budget for hosted CI contention.

## Required UI

None.

## Required Data/API

No data model or API changes.

## Required Automations

None.

## Required Subagents

None required. The failure is isolated by hosted CI evidence and a local
isolation pass.

## TDD Requirements

- Treat the GitHub `validate` failure as RED evidence.
- Confirm the target test passes in isolation before changing assertions.
- Do not skip, weaken, or delete any write-detection scenario.

## Implementation Requirements

- Apply a test-only stabilization in the mode-manager write-detection test file.
- Do not modify mode-manager runtime behavior.
- Do not perform destructive R.11 operations.

## Validation Commands

- `bun test packages/shared/tests/mode-manager-write-detection.test.ts --test-name-pattern "Codex-style zsh write to plans folder"`
- `bun test packages/shared/tests/mode-manager-write-detection.test.ts`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `bun test`

## Acceptance Criteria

- [x] Hosted CI RED evidence is recorded and points only at the mode-manager
  write-detection timeout.
- [x] The mode-manager write-detection timeout budget is explicit and test-only.
- [x] The target test passes locally without skipped assertions.
- [x] Full `bun test` passes locally after the patch.
- [x] No destructive R.11 action is performed.
