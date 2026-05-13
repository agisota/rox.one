# T345 - User data migration PR120 fixture alignment

Status: DONE

## Context

After rebasing the validation repair branch onto current `origin/main`,
PR #120 restored the intended `.rox-agent` priority behavior when `.rox` is
also present as a lower-priority legacy source. The older T340 fixture rewrite
kept the destination as `.rox-new`, which no longer exercises the current
post-rebrand `.rox === newRoot` contract and fails the focused validation
bundle.

## Goal

Align the T340 fixture with the current PR #120 migration contract without
changing migration runtime behavior.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

The existing focused migration test must pass:

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`

## Required Subagents

None. The failing assertion and PR #120 diff identify the stale fixture.

## TDD Requirements

Use the existing focused bundle as the red check.

## Implementation Requirements

- Restore the priority fixture destination to the current `.rox` root.
- Keep the assertion that higher-priority `.rox-agent` data overwrites the
  lower-priority `.rox` source when `.rox` is also the new root.
- Do not change `user-data-migration.ts`.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- focused C4/rebrand/credential/observability bundle
- `bun test`
- `git diff --check`

## Acceptance Criteria

- [x] The user-data migration focused test passes.
- [x] Runtime migration code is unchanged.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T345-user-data-migration-pr120-fixture-alignment.md`.
