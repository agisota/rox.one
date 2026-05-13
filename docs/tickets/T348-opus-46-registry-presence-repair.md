# T348 - Opus 4.6 registry presence repair

Status: DONE

## Context

After rebasing the validation repair branch onto current `origin/main`, the
full `bun test` suite exposed that the model registry no longer included the
restored `claude-opus-4-6` entry even though the model contract tests still
reserve it as a selectable fallback behind Opus 4.7.

## Goal

Restore Opus 4.6 as an Anthropic registry entry without changing the default
Opus resolution, which must continue to prefer `claude-opus-4-7`.

## Required UI

None.

## Required Data/API

No API shape changes. `ANTHROPIC_MODELS` should again include the Opus 4.6
`ModelDefinition`.

## Required Automations

Use `packages/shared/tests/models.test.ts` as the red/green regression gate.

## Required Subagents

None. The failing model contract points directly at the registry entry.

## TDD Requirements

Run the existing model contract test first and confirm it fails for the
missing `claude-opus-4-6` registry entry.

## Implementation Requirements

- Add `claude-opus-4-6` to `MODEL_REGISTRY` after `claude-opus-4-7`.
- Keep `claude-opus-4-7` first so `getModelIdByShortName('Opus')` remains the
  default Opus model.
- Do not change model helper fallback logic.

## Validation Commands

- `bun test packages/shared/tests/models.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `git diff --check`

## Acceptance Criteria

- [x] Model contract test fails before implementation for the expected Opus 4.6 registry absence.
- [x] `ANTHROPIC_MODELS` includes both Opus 4.7 and Opus 4.6.
- [x] `getModelIdByShortName('Opus')` continues to resolve to Opus 4.7.
- [x] Targeted model contract test passes.
- [x] Full validation matrix passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T348-opus-46-registry-presence-repair.md`.
